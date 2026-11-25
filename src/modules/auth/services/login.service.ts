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
import { AuthTokenPairResponseDto } from '../dtos';

export interface LoginExecutionResult extends AuthTokenPairResponseDto {
  userName: string;
}

@Injectable()
export class LoginService {
  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async execute(input: {
    identifier: string;
    password: string;
    appId: string;
  }): Promise<LoginExecutionResult> {
    const appSlug = input.appId;
    const identifier = normalizeIdentifier(input.identifier);
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
      };
      if (
        failure?.statusCode === 401 ||
        failure?.status === 'UNAUTHORIZED' ||
        failure?.body?.code === 'INVALID_EMAIL_OR_PASSWORD'
      ) {
        throw new UnauthorizedException(
          'The email, username, or password is incorrect.',
        );
      }
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
    let idleExpiry = hardExpiry;
    try {
      await this.dataSource.transaction(async (tx) => {
        const [app] = await tx.query(
          `SELECT id, policy FROM apps.applications WHERE slug = $1 AND status = 'active' FOR UPDATE`,
          [input.appId],
        );
        if (!app)
          throw new UnauthorizedException(
            'This app could not be found or is currently unavailable.',
          );
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
        const configuredSettings = await tx.query(
          `SELECT key, value FROM system.settings WHERE application_id IS NULL OR application_id = $1 ORDER BY application_id NULLS FIRST`,
          [app.id],
        );
        const resolvedSettings = new Map(
          configuredSettings.map((row: { key: string; value: unknown }) => [
            row.key,
            row.value,
          ]),
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
            app.policy?.maxConcurrentSessions ??
            resolvedSettings.get('session.max_concurrent') ??
            3,
        );
        const [{ count }] = await tx.query(
          `SELECT count(*)::int AS count FROM auth.sessions WHERE user_id = $1 AND application_id = $2 AND revoked_at IS NULL AND expires_at > now() AND hard_expires_at > now()`,
          [result.user.id, app.id],
        );
        if (count >= cap)
          throw new ConflictException({
            code: 'SESSION_LIMIT_REACHED',
            message:
              'You have reached the maximum number of active sessions for this app. End another session before signing in again.',
          });
        const idleSeconds = Number(
          app.policy?.idleTimeoutSeconds ??
            resolvedSettings.get('session.idle_timeout_seconds') ??
            604800,
        );
        const resolvedIdleExpiry = new Date(
          Math.min(
            nowDate.getTime() + idleSeconds * 1000,
            hardExpiry.getTime(),
          ),
        );
        idleExpiry = resolvedIdleExpiry;
        await tx.query(
          `UPDATE auth.sessions SET application_id = $1, expires_at = $2, hard_expires_at = $3 WHERE id = $4`,
          [app.id, resolvedIdleExpiry, hardExpiry, sessionId],
        );
      });
    } catch (error) {
      await this.dataSource.query(`DELETE FROM auth.sessions WHERE id = $1`, [
        sessionId,
      ]);
      throw error;
    }

    const now = Math.floor(Date.now() / 1000);
    const accessLifetime = Math.min(
      Number(process.env.JWT_ACCESS_EXPIRATION ?? 900),
      Math.floor((idleExpiry.getTime() - Date.now()) / 1000),
    );
    const refreshLifetime = Math.max(
      1,
      Math.floor((idleExpiry.getTime() - Date.now()) / 1000),
    );
    const accessExpiresAt = now + accessLifetime;
    const refreshExpiresAt = now + refreshLifetime;
    const claims = {
      sub: result.user.id,
      aud: appSlug,
      sid: sessionId,
      iat: now,
    };
    return Object.assign(new AuthTokenPairResponseDto(), {
      userName: result.user.name,
      sessionId,
      accessToken: await this.jwt.signAsync(
        { ...claims, typ: 'access' },
        {
          secret: process.env.JWT_SECRET,
          algorithm: 'HS256',
          expiresIn: accessLifetime,
          issuer: 'auth-identity-service',
        },
      ),
      refreshToken: await this.jwt.signAsync(
        { ...claims, typ: 'refresh', generation: 0 },
        {
          secret: process.env.JWT_SECRET,
          algorithm: 'HS256',
          expiresIn: refreshLifetime,
          issuer: 'auth-identity-service',
        },
      ),
      accessTokenExpiresAt: new Date(accessExpiresAt * 1000).toISOString(),
      refreshTokenExpiresAt: new Date(refreshExpiresAt * 1000).toISOString(),
    });
  }
}
