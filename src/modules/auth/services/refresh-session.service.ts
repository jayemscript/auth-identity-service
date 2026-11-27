import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthTokenPairResponseDto } from '../dtos';
import { signAccessToken } from '../../../common/security/sign-access-token';
import { PolicyResolverService } from '../../policies';
import { SessionIpBindingService } from './session-ip-binding.service';
import { AuditLogService } from '../../security';
import { PublishDomainEventService } from '../../events/services';

@Injectable()
export class RefreshSessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    private readonly policyResolver: PolicyResolverService,
    private readonly ipBinding: SessionIpBindingService,
    private readonly auditLog: AuditLogService,
    private readonly publishEvent: PublishDomainEventService,
  ) {}

  async execute(token: string, appSlug: string, requestIp?: string): Promise<AuthTokenPairResponseDto> {
    let claims: { sub: string; aud: string; sid: string; typ: string; generation?: number };
    try {
      claims = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
        algorithms: ['HS256'],
        issuer: 'auth-identity-service',
      });
    } catch {
      throw new UnauthorizedException('This refresh token is invalid or expired. Please sign in again.');
    }
    if (claims.typ !== 'refresh' || claims.aud !== appSlug ||
      !Number.isInteger(claims.generation) || claims.generation! < 0)
      throw new UnauthorizedException('This refresh token is invalid or expired. Please sign in again.');

    const now = new Date();
    const outcome = await this.dataSource.transaction(async (tx) => {
      await tx.query(`SELECT id FROM apps.applications WHERE slug = $1 FOR UPDATE`, [appSlug]);
      const [session] = await tx.query(
        `SELECT s.refresh_generation AS generation, s.expires_at AS "idleExpiry", s.hard_expires_at AS "hardExpiry", s.ip_address,
          a.id AS application_id, a.slug FROM auth.sessions s JOIN apps.applications a ON a.id = s.application_id
         JOIN identity.user_application_access g ON g.user_id = s.user_id AND g.application_id = a.id AND g.status = 'active'
         JOIN identity.user_configs c ON c.user_id = s.user_id AND c.status = 'active'
         WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND a.status = 'active'
           AND (NOT c.is_banned OR c.ban_expires_at <= now()) FOR UPDATE OF a, g, c, s`,
        [claims.sid, claims.sub],
      );
      if (!session || session.slug !== claims.aud || new Date(session.idleExpiry) <= now || new Date(session.hardExpiry) <= now)
        throw new UnauthorizedException('This refresh token is no longer valid. Please sign in again.');

      const policy = await this.policyResolver.execute(tx, session.application_id);
      if (claims.generation! > session.generation)
        throw new UnauthorizedException('This refresh token is no longer valid. Please sign in again.');
      if (claims.generation! < session.generation) {
        if (policy['token.refresh_rotation'] !== 'rotate_with_reuse_detection')
          throw new UnauthorizedException('This refresh token is no longer valid. Please sign in again.');
        const revoked = await tx.query(
          `UPDATE auth.sessions SET revoked_at = now(), updated_at = now()
           WHERE id = $1 AND user_id = $2 AND application_id = $3 AND revoked_at IS NULL RETURNING id`,
          [claims.sid, claims.sub, session.application_id],
        );
        if (revoked.length) {
          await this.auditLog.execute(tx, {
            applicationId: session.application_id,
            targetUserId: claims.sub,
            action: 'session.revoked',
            changes: { sessionId: claims.sid, reason: 'refresh_token_reuse' },
          });
          await this.publishEvent.execute(tx, {
            applicationId: session.application_id,
            eventType: 'session.revoked',
            aggregateType: 'session',
            aggregateId: claims.sid,
            payload: { sessionId: claims.sid, userId: claims.sub, reason: 'refresh_token_reuse' },
          });
        }
        return { reused: true as const };
      }

      const binding = await this.ipBinding.enforce(tx, {
        sessionId: claims.sid,
        userId: claims.sub,
        applicationId: session.application_id,
        storedIp: session.ip_address,
        requestIp,
        policy: policy['session.ip_binding'],
      });
      if (binding !== 'ok') return { binding };

      const idleMinutes = Number(policy['session.idle_timeout_minutes']);
      const idleExpiry = new Date(Math.min(
        idleMinutes === 0 ? new Date(session.hardExpiry).getTime() : now.getTime() + idleMinutes * 60_000,
        new Date(session.hardExpiry).getTime(),
      ));
      const generation = session.generation + 1;
      const nowSeconds = Math.floor(now.getTime() / 1000);
      const refreshSeconds = Math.max(1, Math.floor((idleExpiry.getTime() - now.getTime()) / 1000));
      const accessSeconds = Math.min(Number(process.env.JWT_ACCESS_EXPIRATION ?? 900), refreshSeconds);
      const base = { sub: claims.sub, aud: claims.aud, sid: claims.sid, iat: nowSeconds };
      const [accessToken, refreshToken] = await Promise.all([
        signAccessToken({ ...base, typ: 'access', exp: nowSeconds + accessSeconds, iss: 'auth-identity-service' }),
        this.jwt.signAsync({ ...base, typ: 'refresh', generation }, {
          secret: process.env.JWT_SECRET,
          algorithm: 'HS256',
          issuer: 'auth-identity-service',
          expiresIn: refreshSeconds,
        }),
      ]);
      await tx.query(
        `UPDATE auth.sessions SET refresh_generation = $1, expires_at = $2, last_refreshed_at = $3 WHERE id = $4`,
        [generation, idleExpiry, now, claims.sid],
      );
      return { reused: false as const, binding, idleExpiry, nowSeconds, accessSeconds, accessToken, refreshToken };
    });

    if ('reused' in outcome && outcome.reused)
      throw new UnauthorizedException('This refresh token was already used. Please sign in again.');
    if ('binding' in outcome && outcome.binding !== 'ok')
      throw new UnauthorizedException('This session IP changed or could not be verified. Please sign in again.');
    if ('reused' in outcome && !outcome.reused)
      return Object.assign(new AuthTokenPairResponseDto(), {
        sessionId: claims.sid,
        accessToken: outcome.accessToken,
        refreshToken: outcome.refreshToken,
        accessTokenExpiresAt: new Date((outcome.nowSeconds + outcome.accessSeconds) * 1000).toISOString(),
        refreshTokenExpiresAt: outcome.idleExpiry.toISOString(),
      });
    throw new UnauthorizedException('This session IP changed or could not be verified. Please sign in again.');
  }
}
