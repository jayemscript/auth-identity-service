import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';

type QueryManager = Pick<EntityManager, 'query'>;

export interface AuditLogInput {
  applicationId?: string | null;
  actorUserId?: string | null;
  targetUserId?: string | null;
  action: string;
  outcome?: 'success' | 'denied' | 'failure';
  changes?: Record<string, unknown>;
}

@Injectable()
export class AuditLogService {
  async execute(manager: QueryManager, input: AuditLogInput): Promise<void> {
    await manager.query(
      `INSERT INTO security.audit_logs
        (application_id, actor_user_id, target_user_id, action, outcome, changes)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [input.applicationId ?? null, input.actorUserId ?? null,
        input.targetUserId ?? null, input.action, input.outcome ?? 'success',
        JSON.stringify(input.changes ?? {})],
    );
  }
}
