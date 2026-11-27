import { ConflictException, ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
jest.mock('../../../auth/better-auth', () => ({
  auth: { api: { signInEmail: jest.fn(), signJWT: jest.fn() } },
}));
import { auth } from '../../../auth/better-auth';
import { LoginService } from './login.service';
import { PolicyResolverService } from '../../policies';

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
      user: { id: 'user-1', name: 'Alex Rivera' },
      token: 'framework-token',
    } as never);
    dataSource.query.mockResolvedValue([{ id: 'session-1' }]);
    (auth.api as unknown as { signJWT: jest.Mock }).signJWT.mockResolvedValue({
      token: 'access-token',
    });
    tx.query
      .mockResolvedValueOnce([{ id: 'app-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'grant-1' }])
      .mockResolvedValueOnce([
        { status: 'active', is_banned: false, session_limit_override: null },
      ])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);
    jwt.signAsync.mockResolvedValueOnce('refresh-token');
    service = new LoginService(
      jwt as never,
      dataSource as unknown as DataSource,
      new PolicyResolverService(),
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
      userName: 'Alex Rivera',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });
    expect(result.sessionId).not.toBe('framework-token');
  });

  it('returns a readable unauthorized error for invalid credentials', async () => {
    signIn.mockRejectedValue({
      status: 'UNAUTHORIZED',
      statusCode: 401,
      body: { code: 'INVALID_EMAIL_OR_PASSWORD' },
    });

    await expect(
      service.execute({
        identifier: 'person@example.com',
        password: 'wrong-password',
        appId: 'shop',
      }),
    ).rejects.toMatchObject({
      status: 401,
      response: {
        message: 'The email, username, or password is incorrect.',
      },
    });
  });

  it('removes the newly created framework session when the app limit is reached', async () => {
    tx.query.mockReset();
    tx.query
      .mockResolvedValueOnce([{ id: 'app-1' }])
      .mockResolvedValueOnce([
        { key: 'session.max_concurrent', value: 1 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'grant-1' }])
      .mockResolvedValueOnce([
        { status: 'active', is_banned: false, session_limit_override: null },
      ])
      .mockResolvedValueOnce([{ count: 1 }]);
    let thrown: unknown;
    try {
      await service.execute({
        identifier: 'person@example.com',
        password: 'password',
        appId: 'shop',
      });
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConflictException);
    expect((thrown as ConflictException).getResponse()).toMatchObject({
      code: 'SESSION_LIMIT_REACHED',
      message:
        'You have reached the maximum number of active sessions for this app. End another session before signing in again.',
    });
    expect(dataSource.query).toHaveBeenCalledWith(
      'DELETE FROM auth.sessions WHERE id = $1',
      ['session-1'],
    );
  });

  it('explains when a valid account is not registered for the selected app', async () => {
    tx.query.mockReset();
    tx.query
      .mockResolvedValueOnce([{ id: 'app-1' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    let thrown: unknown;
    try {
      await service.execute({
        identifier: 'person@example.com',
        password: 'password',
        appId: 'mobile-app',
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ForbiddenException);
    expect((thrown as ForbiddenException).getStatus()).toBe(403);
    expect((thrown as ForbiddenException).getResponse()).toMatchObject({
      message:
        "This account isn't registered for this app. Please register through the app or contact its administrator for access.",
    });
    expect(dataSource.query).toHaveBeenCalledWith(
      'DELETE FROM auth.sessions WHERE id = $1',
      ['session-1'],
    );
  });
});
