import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SessionMapper, SessionResponseRow } from '../mappers';

@Injectable()
export class ListSessionsService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(input: {
    userId: string;
    appSlug: string;
    limit: number;
    offset: number;
    sessionId?: string;
    status?: string;
  }) {
    const limit = Math.min(Math.max(input.limit || 20, 1), 100);
    const offset = Math.max(input.offset || 0, 0);
    const rows = (await this.dataSource.query(
      `SELECT s.id, CASE WHEN s.revoked_at IS NOT NULL THEN 'revoked'
        WHEN s.expires_at <= now() OR s.hard_expires_at <= now() THEN 'expired' ELSE 'active' END AS status,
        s.created_at AS created_at, s.last_refreshed_at AS last_refresh_at,
        s.expires_at AS idle_expires_at, s.hard_expires_at AS hard_expires_at
       FROM auth.sessions s JOIN apps.applications a ON a.id = s.application_id
       WHERE s.user_id = $1 AND a.slug = $2
       AND ($3::text IS NULL OR s.id = $3)
       AND ($4 = 'all' OR ($4 = 'active' AND s.revoked_at IS NULL AND s.expires_at > now() AND s.hard_expires_at > now())
         OR ($4 = 'revoked' AND s.revoked_at IS NOT NULL)
         OR ($4 = 'expired' AND s.revoked_at IS NULL AND (s.expires_at <= now() OR s.hard_expires_at <= now())))
       ORDER BY s.created_at DESC LIMIT $5 OFFSET $6`,
      [input.userId, input.appSlug, input.sessionId ?? null, input.status ?? 'active', limit, offset],
    )) as SessionResponseRow[];
    return rows.map(SessionMapper.toResponse);
  }
}
