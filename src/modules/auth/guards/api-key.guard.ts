import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { DataSource } from 'typeorm';
import { verifyApiKey } from '../../../common/security';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly dataSource: DataSource) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    if (!verifyApiKey(process.env.API_KEY ?? '', request.header('x-api-key'))) {
      throw new UnauthorizedException(
        'The API key is missing or invalid. Check the X-API-Key header and try again.',
      );
    }
    const slug = request.header('x-app-id');
    if (!slug)
      throw new UnauthorizedException(
        'Choose an app by including its slug in the X-App-Id header.',
      );
    const [app] = await this.dataSource.query(
      `SELECT id FROM apps.applications WHERE slug = $1 AND status = 'active'`,
      [slug.toLowerCase()],
    );
    if (!app)
      throw new UnauthorizedException(
        'This app could not be found or is currently unavailable.',
      );
    return true;
  }
}
