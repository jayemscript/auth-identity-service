import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
jest.mock('../../../auth/better-auth', () => ({
  auth: { api: { signJWT: jest.fn().mockResolvedValue({ token: 'new-access' }) } },
}));
import { RefreshSessionService } from './refresh-session.service';
import { PolicyResolverService } from '../../policies';

describe('RefreshSessionService', () => {
  const verifyAsync = jest.fn();
  const signAsync = jest.fn();
  const transactionQuery = jest.fn();
  const dataSource = {
    transaction: jest.fn(
      (callback: (manager: { query: jest.Mock }) => unknown) =>
        callback({ query: transactionQuery }),
    ),
  };
  let service: RefreshSessionService;

  beforeEach(() => {
    jest.clearAllMocks();
    verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      aud: 'shop',
      typ: 'refresh',
      generation: 2,
    });
    signAsync.mockResolvedValueOnce('new-refresh');
    transactionQuery
      .mockResolvedValueOnce([
        {
          generation: 2,
          idleExpiry: new Date(Date.now() + 60_000),
          hardExpiry: new Date(Date.now() + 120_000),
          application_id: 'app-1',
          slug: 'shop',
        },
      ])
      .mockResolvedValueOnce([
        { key: 'idleTimeoutSeconds', value: 60 },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    service = new RefreshSessionService(
      { verifyAsync, signAsync } as unknown as JwtService,
      dataSource as unknown as DataSource,
      new PolicyResolverService(),
    );
  });

  it('rotates the generation under the transaction and returns a replacement pair', async () => {
    await expect(service.execute('old-refresh', 'shop')).resolves.toMatchObject({
      sessionId: 'session-1',
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
    });
    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    expect(transactionQuery).toHaveBeenCalledTimes(4);
    expect(transactionQuery.mock.calls[2][0]).toContain('system.settings');
    expect(signAsync.mock.calls[0][0]).toMatchObject({
      typ: 'refresh',
      generation: 3,
    });
  });

  it('rejects a refresh token of the wrong type', async () => {
    verifyAsync.mockResolvedValueOnce({ typ: 'access' });
    await expect(service.execute('access-token', 'shop')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
