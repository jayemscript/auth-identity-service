import { findApplicationPolicy } from './application-policy.repository';

describe('findApplicationPolicy', () => {
  it('returns an empty policy so configured service defaults can apply', async () => {
    const manager = { query: jest.fn().mockResolvedValue([]) };

    await expect(findApplicationPolicy(manager as never, 'app-1')).resolves.toEqual(
      {},
    );
  });

  it('rebuilds the policy object without changing JSON value types', async () => {
    const manager = {
      query: jest.fn().mockResolvedValue([
        { key: 'registrationMode', value: 'operator_only' },
        { key: 'idleTimeoutSeconds', value: 3600 },
        { key: 'emailVerificationRequired', value: false },
        { key: 'custom', value: { enabled: true } },
      ]),
    };

    await expect(findApplicationPolicy(manager as never, 'app-1')).resolves.toEqual({
      registrationMode: 'operator_only',
      idleTimeoutSeconds: 3600,
      emailVerificationRequired: false,
      custom: { enabled: true },
    });
  });
});
