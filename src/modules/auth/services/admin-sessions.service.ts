import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SessionMapper, SessionResponseRow } from '../mappers';

@Injectable()
export class AdminSessionsService {
  constructor(private readonly dataSource: DataSource) {}

  async execute(input: { appId: string; userId: string; sessionId?: string; revoke?: boolean }) {
    const [app] = await this.dataSource.query(`SELECT id FROM apps.applications WHERE id::text = $1 OR slug = $1`, [input.appId]);
    if (!app) throw new NotFoundException('App not found');
    if (input.revoke && input.sessionId) {
      const rows = await this.dataSource.query(`UPDATE auth.sessions SET revoked_at = now() WHERE id = $1 AND user_id = $2 AND application_id = $3 AND revoked_at IS NULL RETURNING id`, [input.sessionId, input.userId, app.id]);
      return { revoked: rows.length > 0 };
    }
    const query = `SELECT id, created_at AS created_at, last_refreshed_at AS last_refresh_at,
      expires_at AS idle_expires_at, hard_expires_at AS hard_expires_at,
      CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN expires_at <= now() OR hard_expires_at <= now() THEN 'expired' ELSE 'active' END AS status
      FROM auth.sessions WHERE user_id = $1 AND application_id = $2 ${input.sessionId ? 'AND id = $3' : ''}
      ORDER BY created_at DESC`;
    const sessions = (await this.dataSource.query(query, input.sessionId ? [input.userId, app.id, input.sessionId] : [input.userId, app.id])) as SessionResponseRow[];
    if (input.sessionId && !sessions.length) throw new NotFoundException('Session not found');
    const mapped = sessions.map(SessionMapper.toResponse);
    return input.sessionId ? mapped[0] : mapped;
  }
}
