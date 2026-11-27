import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AccessMapper } from '../mappers/access.mapper';
import { AuditLogService } from '../../security';
import { PublishDomainEventService } from '../../events/services';

@Injectable()
export class UserAccessRepository {
  constructor(private readonly dataSource: DataSource, private readonly audit: AuditLogService, private readonly events: PublishDomainEventService) {}

  async grant(input: { userId: string; appId: string; actorId?: string }) {
    return this.dataSource.transaction(async (tx) => {
      const [row] = await tx.query(
        `INSERT INTO identity.user_application_access (id, user_id, application_id, status, grant_source, granted_by_user_id, granted_at, revoked_at)
         VALUES (gen_random_uuid(), $1, $2, 'active', 'operator', $3, now(), NULL)
         ON CONFLICT (user_id, application_id) DO UPDATE SET status = 'active', grant_source = 'operator', granted_by_user_id = $3, granted_at = now(), revoked_at = NULL
         WHERE identity.user_application_access.status <> 'active'
         RETURNING id, user_id, application_id, status, grant_source, granted_by_user_id, granted_at, revoked_at`,
        [input.userId, input.appId, input.actorId ?? null],
      );
      const [existing] = row ? [] : await tx.query(`SELECT id, user_id, application_id, status, grant_source, granted_by_user_id, granted_at, revoked_at FROM identity.user_application_access WHERE user_id = $1 AND application_id = $2`, [input.userId, input.appId]);
      if (row) {
        await this.audit.execute(tx, { applicationId: input.appId, actorUserId: input.actorId, targetUserId: input.userId, action: 'user.app_access.granted' });
        await this.events.execute(tx, { applicationId: input.appId, eventType: 'user.app_access.granted', aggregateType: 'user', aggregateId: input.userId, payload: { userId: input.userId } });
      }
      return AccessMapper.toResponse(row ?? existing);
    });
  }
}
