import { UserAccessRepository } from './user-access.repository';

describe('UserAccessRepository', () => {
  const manager = { query: jest.fn() };
  const dataSource = {
    transaction: jest.fn((callback: (tx: typeof manager) => unknown) => callback(manager)),
  };
  const audit = { execute: jest.fn() };
  const events = { execute: jest.fn() };
  const repository = new UserAccessRepository(dataSource as never, audit as never, events as never);

  beforeEach(() => {
    manager.query.mockReset();
    dataSource.transaction.mockClear();
    audit.execute.mockReset();
    events.execute.mockReset();
  });

  it('records a grant transition and publishes one event', async () => {
    manager.query
      .mockResolvedValueOnce([{ id: 'grant-1', user_id: 'user-1', application_id: 'app-1', status: 'active', grant_source: 'operator', granted_by_user_id: 'admin-1', granted_at: new Date(), revoked_at: null }])
      .mockResolvedValueOnce([]);

    await repository.grant({ userId: 'user-1', appId: 'app-1', actorId: 'admin-1' });

    expect(audit.execute).toHaveBeenCalledTimes(1);
    expect(events.execute).toHaveBeenCalledTimes(1);
    expect(events.execute.mock.calls[0][1]).toMatchObject({ eventType: 'user.app_access.granted', aggregateId: 'user-1' });
  });

  it('does not duplicate audit or event records for an already active grant', async () => {
    manager.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'grant-1', user_id: 'user-1', application_id: 'app-1', status: 'active', grant_source: 'operator', granted_by_user_id: 'admin-1', granted_at: new Date(), revoked_at: null }]);

    await repository.grant({ userId: 'user-1', appId: 'app-1', actorId: 'admin-1' });

    expect(audit.execute).not.toHaveBeenCalled();
    expect(events.execute).not.toHaveBeenCalled();
  });
});
