import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import type { Request } from 'express';

@Injectable()
export class UserSessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<
        Request & {
          identity?: { userId: string; sessionId: string; appId: string };
        }
      >();
    const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
    const appSlug = request.header('x-app-id');
    if (!token || !appSlug) throw new UnauthorizedException();
    try {
      const claims = await this.jwt.verifyAsync<{
        sub: string;
        sid: string;
        aud: string;
        typ: string;
      }>(token, {
        secret: process.env.JWT_SECRET,
        algorithms: ['HS256'],
        issuer: 'auth-identity-service',
      });
      if (claims.typ !== 'access' || claims.aud !== appSlug)
        throw new Error('Invalid token');
      const [session] = await this.dataSource.query(
        `SELECT s.user_id AS user_id, a.slug FROM auth.sessions s JOIN apps.applications a ON a.id = s.application_id
         JOIN identity.user_configs c ON c.user_id = s.user_id
         JOIN identity.user_application_access g ON g.user_id = s.user_id AND g.application_id = a.id
         WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > now()
         AND s.hard_expires_at > now() AND a.status = 'active'
         AND c.status = 'active' AND (NOT c.is_banned OR c.ban_expires_at <= now())
         AND g.status = 'active'`,
        [claims.sid, claims.sub],
      );
      if (!session || session.slug !== appSlug)
        throw new Error('Inactive token');
      request.identity = {
        userId: claims.sub,
        sessionId: claims.sid,
        appId: appSlug,
      };
      return true;
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }
}
