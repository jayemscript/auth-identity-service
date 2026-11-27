import { AdminSessionsService } from './admin-sessions.service';

describe('AdminSessionsService revocation', () => {
  const manager = { query: jest.fn() };
  const dataSource = {
    query: jest.fn(),
    transaction: jest.fn((callback: (tx: typeof manager) => unknown) => callback(manager)),
  };
  const auditLog = { execute: jest.fn() };
  const publishEvent = { execute: jest.fn() };
  let service: AdminSessionsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminSessionsService(dataSource as never, auditLog as never, publishEvent as never);
    dataSource.query.mockResolvedValueOnce([{ id: 'app-1' }]);
    manager.query.mockResolvedValueOnce([{ id: 'session-1' }]);
  });

  it('audits and publishes only a session that changed', async () => {
    await expect(service.execute({ appId: 'shop', userId: 'user-1', sessionId: 'session-1', revoke: true })).resolves.toEqual({ revoked: true });
    expect(auditLog.execute).toHaveBeenCalledWith(manager, expect.objectContaining({ applicationId: 'app-1', action: 'session.revoked' }));
    expect(publishEvent.execute).toHaveBeenCalledWith(manager, expect.objectContaining({ aggregateId: 'session-1' }));
  });
});
