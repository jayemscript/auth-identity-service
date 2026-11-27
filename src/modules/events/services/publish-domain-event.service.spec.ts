import { PublishDomainEventService } from './publish-domain-event.service';

describe('PublishDomainEventService', () => {
  it('writes an event and queues matching active endpoint deliveries', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };
    const result = await new PublishDomainEventService().execute(manager, {
      applicationId: 'app-id',
      eventType: 'user.created',
      aggregateType: 'user',
      aggregateId: 'user-id',
      payload: { userId: 'user-id' },
    });

    expect(result).toMatchObject({ eventType: 'user.created', version: 1 });
    expect(result.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(manager.query).toHaveBeenCalledTimes(2);
    expect(manager.query.mock.calls[0][0]).toContain('INSERT INTO events.domain_events');
    expect(manager.query.mock.calls[1][0]).toContain('ON CONFLICT (endpoint_id, event_id) DO NOTHING');
  });

  it('does not queue deliveries if event persistence fails', async () => {
    const manager = {
      query: jest.fn().mockRejectedValueOnce(new Error('database unavailable')),
    };
    await expect(
      new PublishDomainEventService().execute(manager, {
        applicationId: 'app-id',
        eventType: 'session.revoked',
        aggregateType: 'session',
        aggregateId: 'session-id',
        payload: { sessionId: 'session-id' },
      }),
    ).rejects.toThrow('database unavailable');
    expect(manager.query).toHaveBeenCalledTimes(1);
  });
});
