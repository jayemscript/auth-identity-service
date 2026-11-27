import { UserSessionGuard } from './user-session.guard';

describe('UserSessionGuard', () => {
  it('explains when an access token is used with a different app', async () => {
    const jwt = {
      verifyAsync: jest.fn().mockResolvedValue({
        sub: 'user-1',
        sid: 'session-1',
        aud: 'internal-admin',
        typ: 'access',
      }),
    };
    const dataSource = { query: jest.fn() };
    const request = {
      header: (name: string) =>
        name === 'authorization'
          ? 'Bearer eyJhbGciOiJIUzI1NiJ9.e30.sig'
          : name === 'x-app-id'
            ? 'merchant-app'
            : undefined,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };
    const guard = new UserSessionGuard(jwt as never, dataSource as never);

    await expect(guard.canActivate(context as never)).rejects.toMatchObject({
      status: 403,
      response: {
        code: 'TOKEN_APP_MISMATCH',
        message:
          'This access token was issued for a different app. Use an access token issued for "merchant-app".',
      },
    });
    expect(dataSource.query).not.toHaveBeenCalled();
  });
});
