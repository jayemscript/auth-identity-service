import { RevokeSessionsService } from './revoke-sessions.service';

describe('RevokeSessionsService', () => {
  const rows = [{ id: 'session-1' }, { id: 'session-2' }];
  const manager = { query: jest.fn() };
  const dataSource = {
    transaction: jest.fn((callback: (tx: typeof manager) => unknown) => callback(manager)),
  };
  const auditLog = { execute: jest.fn() };
  const publishEvent = { execute: jest.fn() };
  let service: RevokeSessionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RevokeSessionsService(dataSource as never, auditLog as never, publishEvent as never);
    manager.query.mockResolvedValueOnce([{ id: 'app-1' }]).mockResolvedValueOnce(rows);
  });

  it('records one event per session actually revoked', async () => {
    await expect(service.execute({ userId: 'user-1', appSlug: 'shop' })).resolves.toEqual({ revoked: 2 });
    expect(auditLog.execute).toHaveBeenCalledWith(manager, expect.objectContaining({ action: 'session.revoked', targetUserId: 'user-1' }));
    expect(publishEvent.execute).toHaveBeenCalledTimes(2);
    expect(publishEvent.execute).toHaveBeenCalledWith(manager, expect.objectContaining({ aggregateId: 'session-1' }));
  });

  it('does not create records when no session changed', async () => {
    manager.query.mockReset().mockResolvedValueOnce([{ id: 'app-1' }]).mockResolvedValueOnce([]);
    await expect(service.execute({ userId: 'user-1', appSlug: 'shop' })).resolves.toEqual({ revoked: 0 });
    expect(auditLog.execute).not.toHaveBeenCalled();
    expect(publishEvent.execute).not.toHaveBeenCalled();
  });
});
