import { ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
jest.mock('../../../auth/better-auth', () => ({
  auth: { api: { signInEmail: jest.fn() } },
}));
import { auth } from '../../../auth/better-auth';
import { LoginService } from './login.service';

describe('LoginService', () => {
  const jwt = { signAsync: jest.fn() };
  const tx = { query: jest.fn() };
  const dataSource = {
    query: jest.fn(),
    transaction: jest.fn((callback: (manager: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  let service: LoginService;
  let signIn: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = 'unit-test-secret';
    signIn = jest.spyOn(auth.api, 'signInEmail').mockResolvedValue({
      user: { id: 'user-1' },
      token: 'framework-token',
    } as never);
    dataSource.query.mockResolvedValue([{ id: 'session-1' }]);
    tx.query
      .mockResolvedValueOnce([{ id: 'app-1', policy: {} }])
      .mockResolvedValueOnce([{ id: 'grant-1' }])
      .mockResolvedValueOnce([
        { status: 'active', is_banned: false, session_limit_override: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);
    jwt.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    service = new LoginService(
      jwt as never,
      dataSource as unknown as DataSource,
    );
  });

  afterEach(() => signIn.mockRestore());

  it('normalizes the identifier and returns a signed pair with the Better Auth session id', async () => {
    const result = await service.execute({
      identifier: ' Person@Example.com ',
      password: 'long-password',
      appId: 'shop',
    });
    expect(signIn).toHaveBeenCalledWith({
      body: { email: 'person@example.com', password: 'long-password' },
    });
    expect(result).toMatchObject({
      sessionId: 'session-1',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(result.sessionId).not.toBe('framework-token');
  });

  it('removes the newly created framework session when the app limit is reached', async () => {
    tx.query.mockReset();
    tx.query
      .mockResolvedValueOnce([
        { id: 'app-1', policy: { maxConcurrentSessions: 1 } },
      ])
      .mockResolvedValueOnce([{ id: 'grant-1' }])
      .mockResolvedValueOnce([
        { status: 'active', is_banned: false, session_limit_override: null },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 1 }]);
    await expect(
      service.execute({
        identifier: 'person@example.com',
        password: 'password',
        appId: 'shop',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(dataSource.query).toHaveBeenCalledWith(
      'DELETE FROM auth.sessions WHERE id = $1',
      ['session-1'],
    );
  });
});
