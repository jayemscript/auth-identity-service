import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { verifyApiKey } from '../../../common/security';

@Injectable()
export class ApiKeyOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (!verifyApiKey(process.env.API_KEY ?? '', request.header('x-api-key')))
      throw new UnauthorizedException(
        'The API key is missing or invalid. Check the X-API-Key header and try again.',
      );
    return true;
  }
}
