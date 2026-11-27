import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import type { Request } from 'express';
import { verifyAccessToken } from '../../../common/security/verify-access-token';
import { PolicyResolverService } from '../../policies/policy-resolver.service';
import { SessionIpBindingService } from '../services/session-ip-binding.service';

@Injectable()
export class UserSessionGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly dataSource: DataSource,
    private readonly policyResolver: PolicyResolverService,
    private readonly ipBinding: SessionIpBindingService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        identity?: { userId: string; sessionId: string; appId: string };
      }
    >();
    const token = request.header('authorization')?.replace(/^Bearer\s+/i, '');
    const appSlug = request.header('x-app-id');
    if (!token || !appSlug)
      throw new UnauthorizedException(
        'Sign in to this app and include your access token to continue.',
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
        'Your access token is invalid or expired. Please sign in again.',
      );
    }
    if (claims.typ !== 'access')
      throw new UnauthorizedException(
        'Use an access token to continue. Refresh tokens cannot access this route.',
      );
    if (claims.aud !== appSlug)
      throw new ForbiddenException({
        code: 'TOKEN_APP_MISMATCH',
        message: `This access token was issued for a different app. Use an access token issued for "${appSlug}".`,
      });

    let session: { user_id: string; slug: string; application_id: string; ip_address: string | null } | undefined;
    try {
      [session] = await this.dataSource.query(
        `SELECT s.user_id AS user_id, s.application_id, s.ip_address, a.slug FROM auth.sessions s JOIN apps.applications a ON a.id = s.application_id
         JOIN identity.user_configs c ON c.user_id = s.user_id
         JOIN identity.user_application_access g ON g.user_id = s.user_id AND g.application_id = a.id
         WHERE s.id = $1 AND s.user_id = $2 AND s.revoked_at IS NULL AND s.expires_at > now()
         AND s.hard_expires_at > now() AND a.status = 'active'
         AND c.status = 'active' AND (NOT c.is_banned OR c.ban_expires_at <= now())
         AND g.status = 'active'`,
        [claims.sid, claims.sub],
      );
    } catch {
      throw new ServiceUnavailableException(
        'We could not verify your sign-in right now. Please try again shortly.',
      );
    }
    if (!session || session.slug !== appSlug)
      throw new UnauthorizedException(
        'Your session has ended or is no longer active. Please sign in again.',
      );

    const binding = await this.dataSource.transaction(async (tx) => {
      const policy = await this.policyResolver.execute(tx, session!.application_id);
      return this.ipBinding.enforce(tx, {
        sessionId: claims.sid,
        userId: claims.sub,
        applicationId: session!.application_id,
        storedIp: session!.ip_address,
        requestIp: request.ip,
        policy: policy['session.ip_binding'],
      });
    });
    if (binding !== 'ok')
      throw new UnauthorizedException('Your session IP changed or could not be verified. Please sign in again.');

    request.identity = {
      userId: claims.sub,
      sessionId: claims.sid,
      appId: appSlug,
    };
    return true;
  }
}
