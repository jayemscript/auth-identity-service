import { ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { VerifyTokenService } from './verify-token.service';

describe('VerifyTokenService', () => {
  const verifyAsync = jest.fn();
  const query = jest.fn();
  let service: VerifyTokenService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new VerifyTokenService(
      { verifyAsync } as unknown as JwtService,
      { query } as unknown as DataSource,
    );
  });

  it('returns inactive without a database lookup for a token of the wrong type', async () => {
    verifyAsync.mockResolvedValue({ typ: 'refresh', aud: 'shop' });
    await expect(
      service.execute({ token: 'jwt', tokenType: 'access', appSlug: 'shop' }),
    ).resolves.toEqual({ active: false });
    expect(query).not.toHaveBeenCalled();
  });

  it('returns active only while its session, user, and app grant remain eligible', async () => {
    verifyAsync.mockResolvedValue({
      sub: 'user-1',
      sid: 'session-1',
      aud: 'shop',
      typ: 'refresh',
      generation: 4,
      exp: 1_800_000_000,
    });
    query.mockResolvedValueOnce([
      {
        app_slug: 'shop',
        user_status: 'active',
        is_banned: false,
        grant_status: 'active',
        refresh_generation: 4,
        revoked_at: null,
        idle_expires_at: new Date(Date.now() + 60_000),
        hard_expires_at: new Date(Date.now() + 120_000),
      },
    ]);

    await expect(
      service.execute({ token: 'eyJhbGciOiJIUzI1NiJ9.e30.sig', tokenType: 'refresh', appSlug: 'shop' }),
    ).resolves.toMatchObject({ active: true, userId: 'user-1' });
  });

  it('returns 503 when live session state cannot be checked', async () => {
    verifyAsync.mockResolvedValue({ typ: 'access', aud: 'shop' });
    query.mockRejectedValue(new Error('database offline'));
    await expect(
      service.execute({ token: 'eyJhbGciOiJIUzI1NiJ9.e30.sig', tokenType: 'access', appSlug: 'shop' }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
