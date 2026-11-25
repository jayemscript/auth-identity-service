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
      throw new UnauthorizedException('Invalid API key');
    }
    const slug = request.header('x-app-id');
    if (!slug) throw new UnauthorizedException('X-App-Id is required');
    const [app] = await this.dataSource.query(
      `SELECT id FROM apps.applications WHERE slug = $1 AND status = 'active'`,
      [slug.toLowerCase()],
    );
    if (!app) throw new UnauthorizedException('Unknown or inactive app');
    return true;
  }
}
