import {
  ConflictException,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { auth } from '../../../auth/better-auth';
import { normalizeIdentifier } from '../../../common/security';
import { signAccessToken } from '../../../common/security/sign-access-token';
import { AuthTokenPairResponseDto } from '../dtos';
import { PolicyResolverService } from '../../policies';
import { SecurityRulesService, LoginAttemptsService, UserDevicesService, AuditLogService, digestLoginSubject } from '../../security';
import { PublishDomainEventService } from '../../events/services';
import { normalizeIpAddress } from '../../../common/security/normalize-ip-address';

export interface LoginExecutionResult extends AuthTokenPairResponseDto {
  userName: string;
}

@Injectable()
export class LoginService {
  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    private readonly policyResolver: PolicyResolverService,
    private readonly securityRules: SecurityRulesService,
    private readonly loginAttempts: LoginAttemptsService,
    private readonly devices: UserDevicesService,
    private readonly auditLog: AuditLogService,
    private readonly publishEvent: PublishDomainEventService,
  ) {}

  async execute(input: {
    identifier: string;
    password: string;
    appId: string;
    ipAddress?: string;
    deviceId?: string;
  }): Promise<LoginExecutionResult> {
    const appSlug = input.appId;
    const identifier = normalizeIdentifier(input.identifier);
    const digestSecret = process.env.LOGIN_SUBJECT_HMAC_SECRET;
    if (!digestSecret) throw new ServiceUnavailableException('Sign-in is temporarily unavailable.');
    const [appRow] = await this.dataSource.query(
      `SELECT id FROM apps.applications WHERE slug = $1 AND status = 'active'`, [appSlug],
    );
    if (!appRow) throw new UnauthorizedException('This app could not be found or is currently unavailable.');
    const [knownUser] = await this.dataSource.query(
      `SELECT id FROM identity.users WHERE lower(email) = $1 OR lower(username) = $1 LIMIT 1`,
      [identifier],
    );
    const subject = knownUser?.id ?? identifier;
    const identifierHash = digestLoginSubject(subject, digestSecret);
    if (input.ipAddress)
      await this.securityRules.checkIp(this.dataSource.manager, { applicationId: appRow.id, ipAddress: input.ipAddress, operation: 'login' });
    const loginPolicy = await this.policyResolver.execute(this.dataSource.manager, appRow.id);
    const threshold = Number(loginPolicy['risk.lockout_threshold'] ?? 0);
    const durationValue = loginPolicy['risk.lockout_duration_minutes'];
    const durationMinutes = durationValue === '5' ? 5 : durationValue === '60' ? 60 : 15;
    if (await this.loginAttempts.isLocked(this.dataSource.manager, appRow.id, identifierHash))
      throw new UnauthorizedException('The email, username, or password is incorrect.');
    const signInUsername = (
      auth.api as unknown as {
        signInUsername: (args: {
          body: { username: string; password: string };
        }) => Promise<Awaited<ReturnType<typeof auth.api.signInEmail>>>;
      }
    ).signInUsername;
    let result: Awaited<ReturnType<typeof auth.api.signInEmail>>;
    try {
      result = identifier.includes('@')
        ? await auth.api.signInEmail({
            body: { email: identifier, password: input.password },
          })
        : await signInUsername({
            body: { username: identifier, password: input.password },
          });
    } catch (error) {
      const failure = error as {
        status?: unknown;
        statusCode?: unknown;
        body?: { code?: unknown };
        code?: unknown;
      };
      const invalidCredential = [
        'INVALID_EMAIL_OR_PASSWORD',
        'INVALID_USERNAME_OR_PASSWORD',
      ].includes(String(failure?.body?.code ?? failure?.code ?? ''));
      if (invalidCredential) {
        await this.dataSource.transaction(async (tx) => {
          await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${appRow.id}:${identifierHash}`]);
          await this.loginAttempts.recordFailure(tx, { applicationId: appRow.id, identifierHash, userId: knownUser?.id, ipAddress: input.ipAddress, threshold, durationMinutes });
        });
        throw new UnauthorizedException(
          'The email, username, or password is incorrect.',
        );
      }
      if (failure?.statusCode === 401 || failure?.status === 'UNAUTHORIZED')
        throw new UnauthorizedException('The email, username, or password is incorrect.');
      throw new ServiceUnavailableException(
        'We could not sign you in right now. Please try again shortly.',
      );
    }
    if (!result?.user || !result?.token)
      throw new UnauthorizedException(
        'The email, username, or password is incorrect.',
      );
    const [frameworkSession] = await this.dataSource.query(
      `SELECT id FROM auth.sessions WHERE token = $1`,
      [result.token],
    );
    if (!frameworkSession)
      throw new UnauthorizedException(
        'The email, username, or password is incorrect.',
      );
    const sessionId = frameworkSession.id as string;

    const nowDate = new Date();
    const hardExpiry = new Date(
      nowDate.getTime() +
        Number(process.env.JWT_REFRESH_EXPIRATION ?? 2592000) * 1000,
    );
    let tokenPair: LoginExecutionResult | undefined;
    try {
      await this.dataSource.transaction(async (tx) => {
        const [app] = await tx.query(
          `SELECT id FROM apps.applications WHERE slug = $1 AND status = 'active' FOR UPDATE`,
          [input.appId],
        );
        if (!app)
          throw new UnauthorizedException(
            'This app could not be found or is currently unavailable.',
          );
        const appPolicy = await this.policyResolver.execute(tx, app.id);
        const loginIp = normalizeIpAddress(input.ipAddress);
        if (appPolicy['session.ip_binding'] === 'strict_revoke' && !loginIp)
          throw new ForbiddenException('A client IP address is required for this app.');
        await this.loginAttempts.recordSuccess(tx, { applicationId: app.id, identifierHash, userId: result.user.id });
        if (input.deviceId) {
          const recognized = await this.devices.recognize(tx, { applicationId: app.id, userId: result.user.id, deviceId: input.deviceId });
          await tx.query(`UPDATE auth.sessions SET device_id = $1 WHERE id = $2`, [recognized.deviceId, sessionId]);
          if (recognized.isNew) await tx.query(`INSERT INTO security.security_events(application_id,user_id,event_type,severity,details) VALUES ($1,$2,'device.new','info','{}'::jsonb)`, [app.id, result.user.id]);
        }
        const [grant] = await tx.query(
          `SELECT id FROM identity.user_application_access WHERE user_id = $1 AND application_id = $2 AND status = 'active' FOR UPDATE`,
          [result.user.id, app.id],
        );
        if (!grant)
          throw new ForbiddenException(
            "This account isn't registered for this app. Please register through the app or contact its administrator for access.",
          );
        const [config] = await tx.query(
          `SELECT status, is_banned, ban_expires_at, session_limit_override FROM identity.user_configs WHERE user_id = $1`,
          [result.user.id],
        );
        if (
          !config ||
          config.status !== 'active' ||
          (config.is_banned &&
            (!config.ban_expires_at ||
              new Date(config.ban_expires_at) > nowDate))
        ) {
          throw new UnauthorizedException(
            'This account is currently unavailable. Contact the app administrator for help.',
          );
        }
        const cap = Number(
          config.session_limit_override ??
          Number(appPolicy['session.max_concurrent']),
        );
        const [{ count }] = await tx.query(
          `SELECT count(*)::int AS count FROM auth.sessions WHERE user_id = $1 AND application_id = $2 AND revoked_at IS NULL AND expires_at > now() AND hard_expires_at > now()`,
          [result.user.id, app.id],
        );
        const overflowPolicy = appPolicy['session.overflow_policy'];
        const evictedCount = Math.max(0, Number(count) - cap + 1);
        if (evictedCount && overflowPolicy === 'block_new')
          throw new ConflictException({
            code: 'SESSION_LIMIT_REACHED',
            message:
              'You have reached the maximum number of active sessions for this app. End another session before signing in again.',
          });
        if (evictedCount) {
          const orderBy = overflowPolicy === 'evict_least_active'
            ? 'COALESCE(last_refreshed_at, created_at) ASC, created_at ASC, id ASC'
            : 'created_at ASC, id ASC';
          const sessions = await tx.query(
            `SELECT id FROM auth.sessions
             WHERE user_id = $1 AND application_id = $2 AND revoked_at IS NULL
               AND expires_at > now() AND hard_expires_at > now()
             ORDER BY ${orderBy} LIMIT $3 FOR UPDATE`,
            [result.user.id, app.id, evictedCount],
          ) as Array<{ id: string }>;
          if (sessions.length < evictedCount)
            throw new ConflictException({
              code: 'SESSION_LIMIT_REACHED',
              message: 'You have reached the maximum number of active sessions for this app. End another session before signing in again.',
            });
          for (const session of sessions) {
            await tx.query(
              `UPDATE auth.sessions SET revoked_at = now(), updated_at = now() WHERE id = $1`,
              [session.id],
            );
            await this.auditLog.execute(tx, {
              applicationId: app.id,
              targetUserId: result.user.id,
              action: 'session.revoked',
              changes: { sessionId: session.id, reason: 'session_overflow' },
            });
            await this.publishEvent.execute(tx, {
              applicationId: app.id,
              eventType: 'session.revoked',
              aggregateType: 'session',
              aggregateId: session.id,
              payload: { sessionId: session.id, userId: result.user.id, reason: 'session_overflow' },
            });
          }
        }
        const idleTimeoutMinutes = Number(
          appPolicy['session.idle_timeout_minutes'],
        );
        const idleSeconds =
          idleTimeoutMinutes === 0
            ? Number(process.env.JWT_REFRESH_EXPIRATION ?? 2592000)
            : idleTimeoutMinutes * 60;
        const resolvedIdleExpiry = new Date(
          Math.min(
            nowDate.getTime() + idleSeconds * 1000,
            hardExpiry.getTime(),
          ),
        );
        await tx.query(
          `UPDATE auth.sessions SET application_id = $1, expires_at = $2, hard_expires_at = $3, ip_address = $4 WHERE id = $5`,
          [app.id, resolvedIdleExpiry, hardExpiry, loginIp, sessionId],
        );
        await this.auditLog.execute(tx, { applicationId: app.id, targetUserId: result.user.id, action: 'session.created', changes: { sessionId } });
        await this.publishEvent.execute(tx, { applicationId: app.id, eventType: 'session.created', aggregateType: 'session', aggregateId: sessionId, payload: { sessionId, userId: result.user.id } });
        const now = Math.floor(Date.now() / 1000);
        const refreshLifetime = Math.max(1, Math.floor((resolvedIdleExpiry.getTime() - Date.now()) / 1000));
        const accessExpiresAt = now + Math.min(Number(process.env.JWT_ACCESS_EXPIRATION ?? 900), refreshLifetime);
        const claims = { sub: result.user.id, aud: appSlug, sid: sessionId, iat: now };
        tokenPair = Object.assign(new AuthTokenPairResponseDto(), {
          userName: result.user.name,
          sessionId,
          accessToken: await signAccessToken({ ...claims, typ: 'access', exp: accessExpiresAt, iss: 'auth-identity-service' }),
          refreshToken: await this.jwt.signAsync({ ...claims, typ: 'refresh', generation: 0 }, {
            secret: process.env.JWT_SECRET,
            algorithm: 'HS256',
            expiresIn: refreshLifetime,
            issuer: 'auth-identity-service',
          }),
          accessTokenExpiresAt: new Date(accessExpiresAt * 1000).toISOString(),
          refreshTokenExpiresAt: resolvedIdleExpiry.toISOString(),
        });
      });
    } catch (error) {
      await this.dataSource.query(`DELETE FROM auth.sessions WHERE id = $1`, [
        sessionId,
      ]);
      throw error;
    }

    return tokenPair!;
  }
}
