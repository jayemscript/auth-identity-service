import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuditLogService } from '../../security';
import { PublishDomainEventService } from '../../events/services';

@Injectable()
export class RevokeSessionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly auditLog: AuditLogService,
    private readonly publishEvent: PublishDomainEventService,
  ) {}

  async execute(input: {
    userId: string;
    appSlug: string;
    sessionId?: string;
  }) {
    return this.dataSource.transaction(async (tx) => {
      const [app] = await tx.query(
        `SELECT id FROM apps.applications WHERE slug = $1`,
        [input.appSlug],
      );
      if (!app) return { revoked: 0 };
      const sessions = await tx.query(
        `WITH revoked AS (
          UPDATE auth.sessions SET revoked_at = now(), updated_at = now()
          WHERE application_id = $1 AND user_id = $2 AND revoked_at IS NULL
            AND ($3::text IS NULL OR id = $3)
          RETURNING id
        ) SELECT id FROM revoked`,
        [app.id, input.userId, input.sessionId ?? null],
      ) as Array<{ id: string }>;
      if (sessions.length) {
        await this.auditLog.execute(tx, {
          applicationId: app.id,
          actorUserId: input.userId,
          targetUserId: input.userId,
          action: 'session.revoked',
          changes: { count: sessions.length },
        });
        for (const session of sessions)
          await this.publishEvent.execute(tx, {
            applicationId: app.id,
            eventType: 'session.revoked',
            aggregateType: 'session',
            aggregateId: session.id,
            payload: { sessionId: session.id, source: 'self_service' },
          });
      }
      return { revoked: sessions.length };
    });
  }
}
