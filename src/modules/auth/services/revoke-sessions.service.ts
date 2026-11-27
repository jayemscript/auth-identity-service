import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class RevokeSessionsService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(input: {
    userId: string;
    appSlug: string;
    sessionId?: string;
  }) {
    const result = await this.dataSource.query(
      `UPDATE auth.sessions s SET revoked_at = now(), updated_at = now()
       FROM apps.applications a WHERE a.id = s.application_id AND a.slug = $2 AND s.user_id = $1
       AND s.revoked_at IS NULL AND ($3::text IS NULL OR s.id = $3) RETURNING s.id`,
      [input.userId, input.appSlug, input.sessionId ?? null],
    );
    return { revoked: result.length };
  }
}
