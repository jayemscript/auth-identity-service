import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { normalizeIpAddress } from '../../../common/security/normalize-ip-address';
import { AuditLogService } from '../../security';
import { PublishDomainEventService } from '../../events/services';

type QueryManager = Pick<EntityManager, 'query'>;

@Injectable()
export class SessionIpBindingService {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly publishEvent: PublishDomainEventService,
  ) {}

  async enforce(manager: QueryManager, input: {
    sessionId: string;
    userId: string;
    applicationId: string;
    storedIp: unknown;
    requestIp: unknown;
    policy: unknown;
  }): Promise<'ok' | 'missing_request_ip' | 'revoked'> {
    if (input.policy !== 'strict_revoke') return 'ok';
    const requestIp = normalizeIpAddress(input.requestIp);
    if (!requestIp) return 'missing_request_ip';
    const storedIp = normalizeIpAddress(input.storedIp);
    if (storedIp && storedIp === requestIp) return 'ok';
    const reason = storedIp ? 'session_ip_changed' : 'session_ip_unbound';
    const rows = await manager.query(
      `UPDATE auth.sessions SET revoked_at = now(), updated_at = now()
       WHERE id = $1 AND user_id = $2 AND application_id = $3 AND revoked_at IS NULL
       RETURNING id`,
      [input.sessionId, input.userId, input.applicationId],
    ) as Array<{ id: string }>;
    if (!rows.length) return 'revoked';
    await this.auditLog.execute(manager, {
      applicationId: input.applicationId,
      targetUserId: input.userId,
      action: 'session.revoked',
      changes: { sessionId: input.sessionId, reason },
    });
    await this.publishEvent.execute(manager, {
      applicationId: input.applicationId,
      eventType: 'session.revoked',
      aggregateType: 'session',
      aggregateId: input.sessionId,
      payload: { sessionId: input.sessionId, userId: input.userId, reason },
    });
    return 'revoked';
  }
}
