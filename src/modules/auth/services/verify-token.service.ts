import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { sessionIsActive } from '../../../common/security';
import { VerifyTokenResponseDto } from '../dtos';
import { verifyAccessToken } from '../../../common/security/verify-access-token';

@Injectable()
export class VerifyTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async execute(input: {
    token: string;
    tokenType: 'access' | 'refresh';
    appSlug: string;
  }): Promise<VerifyTokenResponseDto> {
    let claims: {
      sub: string;
      aud: string;
      sid: string;
      typ: string;
      generation?: number;
      exp?: number;
    };
    try {
      claims = (await verifyAccessToken(
        input.token,
        this.jwt,
        this.dataSource,
      )) as typeof claims;
      if (claims.typ !== input.tokenType || claims.aud !== input.appSlug)
        return Object.assign(new VerifyTokenResponseDto(), { active: false });
    } catch {
      return Object.assign(new VerifyTokenResponseDto(), { active: false });
    }
    if (claims.typ !== input.tokenType || claims.aud !== input.appSlug)
      return { active: false };
    try {
      const [state] = await this.dataSource.query(
        `SELECT s.user_id AS user_id, s.application_id AS application_id, s.expires_at AS idle_expires_at,
          s.hard_expires_at AS hard_expires_at, s.revoked_at AS revoked_at, s.refresh_generation AS refresh_generation,
          a.slug AS app_slug, c.status AS user_status, c.is_banned, c.ban_expires_at, g.status AS grant_status
         FROM auth.sessions s JOIN apps.applications a ON a.id = s.application_id
         JOIN identity.user_configs c ON c.user_id = s.user_id
         JOIN identity.user_application_access g ON g.user_id = s.user_id AND g.application_id = a.id
         WHERE s.id = $1 AND s.user_id = $2`,
        [claims.sid, claims.sub],
      );
      if (
        !state ||
        state.app_slug !== input.appSlug ||
        state.grant_status !== 'active' ||
        state.user_status !== 'active' ||
        (state.is_banned &&
          (!state.ban_expires_at ||
            new Date(state.ban_expires_at) > new Date())) ||
        !sessionIsActive({
          revokedAt: state.revoked_at,
          idleExpiresAt: new Date(state.idle_expires_at),
          hardExpiresAt: new Date(state.hard_expires_at),
        }) ||
        (input.tokenType === 'refresh' &&
          claims.generation !== state.refresh_generation)
      )
        return Object.assign(new VerifyTokenResponseDto(), { active: false });
      return Object.assign(new VerifyTokenResponseDto(), {
        active: true,
        userId: claims.sub,
        appId: input.appSlug,
        sessionId: claims.sid,
        expiresAt: claims.exp
          ? new Date(claims.exp * 1000).toISOString()
          : null,
      });
    } catch {
      throw new ServiceUnavailableException(
        'We could not check this session right now. Please try again shortly.',
      );
    }
  }
}
