import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { verifyAccessToken } from '../../../common/security/verify-access-token';
import { PolicyResolverService } from '../../policies/policy-resolver.service';
import { SessionIpBindingService } from '../services/session-ip-binding.service';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    private readonly policyResolver: PolicyResolverService,
    private readonly ipBinding: SessionIpBindingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { identity?: { userId: string; sessionId: string; appId: string } }>();
    const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
    const appSlug = request.header('x-app-id');
    if (!token || !appSlug)
      throw new UnauthorizedException(
        'Sign in to the admin app with a SuperAdmin account to continue.',
      );
    let claims: { sub: string; sid: string; aud: string; typ: string };
    try {
      claims = (await verifyAccessToken(
        token,
        this.jwt,
        this.dataSource,
      )) as typeof claims;
    } catch {
      throw new UnauthorizedException(
        'Your sign-in has expired or is no longer valid. Please sign in again.',
      );
    }
    if (claims.typ !== 'access')
      throw new UnauthorizedException(
        'Use an access token to continue. Refresh tokens cannot access this route.',
      );
    if (claims.aud !== appSlug)
      throw new ForbiddenException({
        code: 'TOKEN_APP_MISMATCH',
        message:
          'This access token was issued for a different app. For admin routes, use the designated admin app in the X-App-Id header.',
      });
    const [adminApp] = await this.dataSource.query(
      `SELECT value #>> '{}' AS slug FROM system.settings WHERE key = 'administration.app_slug' AND application_id IS NULL`,
    );
    const [user] = await this.dataSource.query(
      `SELECT s.application_id, s.ip_address FROM identity.user_configs c JOIN auth.sessions s ON s.user_id = c.user_id
       JOIN apps.applications a ON a.id = s.application_id
       JOIN identity.user_application_access g ON g.user_id = c.user_id AND g.application_id = a.id
       WHERE c.user_id = $1 AND c.is_superadmin = true AND s.id = $2 AND s.revoked_at IS NULL
       AND s.expires_at > now() AND s.hard_expires_at > now() AND a.slug = $3 AND a.status = 'active'
       AND c.status = 'active' AND (NOT c.is_banned OR c.ban_expires_at <= now()) AND g.status = 'active'`,
      [claims.sub, claims.sid, appSlug],
    );
    if (!user || !adminApp || adminApp.slug !== appSlug)
      throw new ForbiddenException(
        'This account is not allowed to manage the service. Sign in with a SuperAdmin account.',
      );
    const binding = await this.dataSource.transaction(async (tx) => {
      const policy = await this.policyResolver.execute(tx, user.application_id);
      return this.ipBinding.enforce(tx, {
        sessionId: claims.sid,
        userId: claims.sub,
        applicationId: user.application_id,
        storedIp: user.ip_address,
        requestIp: request.ip,
        policy: policy['session.ip_binding'],
      });
    });
    if (binding !== 'ok') throw new UnauthorizedException('Your session IP changed or could not be verified. Please sign in again.');
    request.identity = { userId: claims.sub, sessionId: claims.sid, appId: appSlug };
    return true;
  }
}
