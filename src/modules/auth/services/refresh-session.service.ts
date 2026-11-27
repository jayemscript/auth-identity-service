import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { AuthTokenPairResponseDto } from '../dtos';
import { signAccessToken } from '../../../common/security/sign-access-token';
import { findApplicationPolicy } from '../../apps/repositories/application-policy.repository';

@Injectable()
export class RefreshSessionService {
  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async execute(
    token: string,
    appSlug: string,
  ): Promise<AuthTokenPairResponseDto> {
    let claims: {
      sub: string;
      aud: string;
      sid: string;
      typ: string;
      generation: number;
    };
    try {
      claims = await this.jwt.verifyAsync(token, {
        secret: process.env.JWT_SECRET,
        algorithms: ['HS256'],
        issuer: 'auth-identity-service',
      });
    } catch {
      throw new UnauthorizedException(
        'This refresh token is invalid or expired. Please sign in again.',
      );
    }
    if (claims.typ !== 'refresh' || claims.aud !== appSlug)
      throw new UnauthorizedException(
        'This refresh token is invalid or expired. Please sign in again.',
      );
    const now = new Date();
    const [{ generation, idleExpiry, hardExpiry }] =
      await this.dataSource.transaction(async (tx) => {
        const [session] = await tx.query(
          `SELECT s.refresh_generation AS generation, s.expires_at AS "idleExpiry", s.hard_expires_at AS "hardExpiry",
           a.id AS application_id, a.slug FROM auth.sessions s JOIN apps.applications a ON a.id = s.application_id
         JOIN identity.user_application_access g ON g.user_id = s.user_id AND g.application_id = a.id AND g.status = 'active'
         JOIN identity.user_configs c ON c.user_id = s.user_id AND c.status = 'active'
         WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND a.status = 'active'
           AND (NOT c.is_banned OR c.ban_expires_at <= now()) FOR UPDATE OF a, g, c, s`,
          [claims.sid, claims.sub],
        );
        if (
          !session ||
          session.slug !== claims.aud ||
          session.generation !== claims.generation ||
          new Date(session.idleExpiry) <= now ||
          new Date(session.hardExpiry) <= now
        ) {
          throw new UnauthorizedException(
            'This refresh token is no longer valid. Please sign in again.',
          );
        }
        const appPolicy = await findApplicationPolicy(tx, session.application_id);
        const settings = await tx.query(
          `SELECT key, value FROM system.settings WHERE application_id IS NULL OR application_id = $1 ORDER BY application_id NULLS FIRST`,
          [session.application_id],
        );
        const resolvedSettings = new Map(
          settings.map((row: { key: string; value: unknown }) => [
            row.key,
            row.value,
          ]),
        );
        const idle = new Date(
          Math.min(
            now.getTime() +
              Number(
                appPolicy.idleTimeoutSeconds ??
                  resolvedSettings.get('session.idle_timeout_seconds') ??
                  604800,
              ) *
                1000,
            new Date(session.hardExpiry).getTime(),
          ),
        );
        await tx.query(
          `UPDATE auth.sessions SET refresh_generation = refresh_generation + 1, expires_at = $1, last_refreshed_at = $2 WHERE id = $3`,
          [idle, now, claims.sid],
        );
        return [
          {
            generation: session.generation + 1,
            idleExpiry: idle,
            hardExpiry: new Date(session.hardExpiry),
          },
        ];
      });
    const nowSeconds = Math.floor(now.getTime() / 1000);
    const accessSeconds = Math.min(
      Number(process.env.JWT_ACCESS_EXPIRATION ?? 900),
      Math.floor((idleExpiry.getTime() - now.getTime()) / 1000),
    );
    const refreshSeconds = Math.max(
      1,
      Math.floor((idleExpiry.getTime() - now.getTime()) / 1000),
    );
    const base = {
      sub: claims.sub,
      aud: claims.aud,
      sid: claims.sid,
      iat: nowSeconds,
    };
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken({
        ...base,
        typ: 'access',
        exp: nowSeconds + accessSeconds,
        iss: 'auth-identity-service',
      }),
      this.jwt.signAsync(
        { ...base, typ: 'refresh', generation },
        {
          secret: process.env.JWT_SECRET,
          algorithm: 'HS256',
          issuer: 'auth-identity-service',
          expiresIn: refreshSeconds,
        },
      ),
    ]);
    return Object.assign(new AuthTokenPairResponseDto(), {
      sessionId: claims.sid,
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(
        (nowSeconds + accessSeconds) * 1000,
      ).toISOString(),
      refreshTokenExpiresAt: idleExpiry.toISOString(),
    });
  }
}
