import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import {
  APP_SCOPES,
  hasRequiredScopes,
} from '../../../common/security/app-scopes';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const supplied = request.header('x-api-key') ?? '';
    const [credentialId, secret, extra] = supplied.split('.');
    if (!credentialId || !secret || extra) {
      throw new UnauthorizedException(
        'The API key is missing or invalid. Check the X-API-Key header and try again.',
      );
    }
    const slug = request.header('x-app-id');
    if (!slug)
      throw new UnauthorizedException(
        'Choose an app by including its slug in the X-App-Id header.',
      );
    const [credential] = await this.dataSource.query(
      `SELECT c.secret_hash, c.expires_at, c.revoked_at, a.id AS app_id,
         COALESCE(array_agg(s.scope) FILTER (WHERE s.scope IS NOT NULL), '{}') AS scopes
       FROM apps.application_credentials c
       JOIN apps.applications a ON a.id = c.application_id
       LEFT JOIN apps.application_credential_scopes s ON s.credential_id = c.id
       WHERE c.id = $1 AND a.slug = $2 AND a.status = 'active'
       GROUP BY c.secret_hash, c.expires_at, c.revoked_at, a.id`,
      [credentialId, slug.toLowerCase()],
    );
    const actualHash = createHash('sha256').update(secret).digest();
    const expectedHash = credential?.secret_hash
      ? Buffer.from(credential.secret_hash, 'hex')
      : Buffer.alloc(actualHash.length);
    const secretMatches =
      actualHash.length === expectedHash.length &&
      timingSafeEqual(actualHash, expectedHash);
    if (
      !credential ||
      !secretMatches ||
      credential.revoked_at ||
      (credential.expires_at && new Date(credential.expires_at) <= new Date())
    )
      throw new UnauthorizedException(
        'The API credential is invalid, expired, revoked, or is not issued for this app.',
      );

    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      APP_SCOPES,
      [context.getHandler(), context.getClass()],
    ) ?? ['auth:use'];
    const scopes = credential.scopes as string[];
    if (!hasRequiredScopes(scopes, requiredScopes))
      throw new ForbiddenException(
        'This API credential does not have permission to use this operation.',
      );
    request['applicationCredential'] = { id: credentialId, appId: credential.app_id, scopes };
    return true;
  }
}
