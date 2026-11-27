import { ForbiddenException } from '@nestjs/common';
import { DataSource } from 'typeorm';
jest.mock('../../../auth/better-auth', () => ({
  auth: { api: { signUpEmail: jest.fn() } },
}));
import { auth } from '../../../auth/better-auth';
import { RegisterUserService } from './register-user.service';

describe('RegisterUserService', () => {
  const query = jest.fn();
  const transactionQuery = jest.fn();
  const dataSource = {
    manager: { query },
    transaction: jest.fn(
      (callback: (manager: { query: jest.Mock }) => unknown) =>
        callback({ query: transactionQuery }),
    ),
  };
  let service: RegisterUserService;
  let signUp: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockReset();
    transactionQuery.mockReset();
    signUp = auth.api.signUpEmail as unknown as jest.Mock;
    service = new RegisterUserService(dataSource as unknown as DataSource);
  });

  it('rejects disabled public registration before creating an identity', async () => {
    query.mockResolvedValueOnce([
      {
        id: 'app-1',
        status: 'active',
      },
    ]);
    query.mockResolvedValueOnce([
      { key: 'registrationMode', value: 'disabled' },
    ]);
    query.mockResolvedValueOnce([]);
    query.mockResolvedValueOnce([]);
    await expect(
      service.execute({
        name: 'User',
        email: 'user@example.com',
        password: 'long-password',
        source: 'public_registration',
        appSlug: 'shop',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(signUp).not.toHaveBeenCalled();
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('requires matching proof when effective verification policy is enabled', async () => {
    query.mockResolvedValueOnce([
      { id: 'app-1', status: 'active' },
    ]);
    query.mockResolvedValueOnce([]);
    query.mockResolvedValueOnce([
      { key: 'email_verification.required', value: true },
    ]);
    await expect(
      service.execute({
        name: 'User',
        email: 'user@example.com',
        password: 'long-password',
        source: 'public_registration',
        appSlug: 'shop',
        verifiedEmail: 'other@example.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(signUp).not.toHaveBeenCalled();
  });

  it('creates user config and app grant after Better Auth creates the user', async () => {
    query
      .mockResolvedValueOnce([{ id: 'app-1', status: 'active' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'user-1' }]);
    signUp.mockResolvedValueOnce({ user: { id: 'user-1' } });
    const result = await service.execute({
      name: 'User',
      email: ' USER@example.com ',
      password: 'long-password',
      source: 'public_registration',
      appSlug: 'SHOP',
    });
    expect(signUp).toHaveBeenCalledWith({
      body: {
        name: 'User',
        email: 'user@example.com',
        password: 'long-password',
      },
    });
    expect(transactionQuery).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ userId: 'user-1' });
  });
});
