import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { EntityManager } from 'typeorm';
import { DomainEventType } from '../event-catalog';

export interface PublishDomainEventInput {
  applicationId: string;
  eventType: DomainEventType;
  aggregateType: 'user' | 'session';
  aggregateId: string;
  payload: Record<string, string | number | boolean | null>;
}

type QueryManager = Pick<EntityManager, 'query'>;

@Injectable()
export class PublishDomainEventService {
  async execute(manager: QueryManager, input: PublishDomainEventInput) {
    const eventId = randomUUID();
    const payload = { ...input.payload };
    await manager.query(
      `INSERT INTO events.domain_events
       (id, event_type, schema_version, application_id, aggregate_type, aggregate_id, payload)
       VALUES ($1, $2, 1, $3, $4, $5, $6::jsonb)`,
      [eventId, input.eventType, input.applicationId, input.aggregateType, input.aggregateId, JSON.stringify(payload)],
    );
    await manager.query(
      `INSERT INTO events.webhook_deliveries
       (id, application_id, endpoint_id, event_id, status, attempt_count, next_attempt_at)
       SELECT gen_random_uuid(), e.application_id, w.id, e.id, 'pending', 0, now()
       FROM events.domain_events e
       JOIN events.webhook_endpoints w ON w.application_id = e.application_id
       WHERE e.id = $1 AND w.is_active = true AND w.event_types @> ARRAY[e.event_type]::text[]
       ON CONFLICT (endpoint_id, event_id) DO NOTHING`,
      [eventId],
    );
    return { id: eventId, eventType: input.eventType, version: 1 };
  }
}
