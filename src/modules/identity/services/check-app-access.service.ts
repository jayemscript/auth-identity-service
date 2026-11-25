import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppAccessCheckResponseDto } from '../dtos';

@Injectable()
export class CheckAppAccessService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(
    userId: string,
    appSlug: string,
  ): Promise<AppAccessCheckResponseDto> {
    const [access] = await this.dataSource.query(
      `SELECT 1 FROM identity.users u JOIN identity.user_configs c ON c.user_id = u.id
       JOIN identity.user_application_access g ON g.user_id = u.id
       JOIN apps.applications a ON a.id = g.application_id
       WHERE u.id = $1 AND a.slug = $2 AND a.status = 'active' AND g.status = 'active'
       AND c.status = 'active' AND (NOT c.is_banned OR c.ban_expires_at <= now())`,
      [userId, appSlug],
    );
    return Object.assign(new AppAccessCheckResponseDto(), {
      allowed: Boolean(access),
    });
  }
}
