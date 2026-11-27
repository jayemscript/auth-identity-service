import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { SessionMapper, SessionResponseRow } from '../mappers';
import { AuditLogService } from '../../security';
import { PublishDomainEventService } from '../../events/services';

@Injectable()
export class AdminSessionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLog: AuditLogService,
    private readonly publishEvent: PublishDomainEventService,
  ) {}

  async execute(input: {
    appId: string;
    userId: string;
    sessionId?: string;
    revoke?: boolean;
    actorId?: string;
  }) {
    const [app] = await this.dataSource.query(
      `SELECT id FROM apps.applications WHERE id::text = $1 OR slug = $1`,
      [input.appId],
    );
    if (!app) throw new NotFoundException('We could not find this app.');
    if (input.revoke && input.sessionId) {
      return this.dataSource.transaction(async (tx) => {
        const rows = await tx.query(
          `WITH revoked AS (
            UPDATE auth.sessions SET revoked_at = now(), updated_at = now()
            WHERE id = $1 AND user_id = $2 AND application_id = $3 AND revoked_at IS NULL
            RETURNING id
          ) SELECT id FROM revoked`,
          [input.sessionId, input.userId, app.id],
        ) as Array<{ id: string }>;
        if (rows.length) {
          await this.auditLog.execute(tx, {
            applicationId: app.id,
            actorUserId: input.actorId,
            targetUserId: input.userId,
            action: 'session.revoked',
            changes: { source: 'admin' },
          });
          await this.publishEvent.execute(tx, {
            applicationId: app.id,
            eventType: 'session.revoked',
            aggregateType: 'session',
            aggregateId: rows[0].id,
            payload: { sessionId: rows[0].id, source: 'admin' },
          });
        }
        return { revoked: rows.length > 0 };
      });
    }
    const query = `SELECT id, created_at AS created_at, last_refreshed_at AS last_refresh_at,
      expires_at AS idle_expires_at, hard_expires_at AS hard_expires_at,
      CASE WHEN revoked_at IS NOT NULL THEN 'revoked' WHEN expires_at <= now() OR hard_expires_at <= now() THEN 'expired' ELSE 'active' END AS status
      FROM auth.sessions WHERE user_id = $1 AND application_id = $2 ${input.sessionId ? 'AND id = $3' : ''}
      ORDER BY created_at DESC`;
    const sessions = (await this.dataSource.query(
      query,
      input.sessionId
        ? [input.userId, app.id, input.sessionId]
        : [input.userId, app.id],
    )) as SessionResponseRow[];
    if (input.sessionId && !sessions.length)
      throw new NotFoundException(
        'We could not find this session for the user.',
      );
    const mapped = sessions.map(SessionMapper.toResponse);
    return input.sessionId ? mapped[0] : mapped;
  }
}
