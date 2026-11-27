import { resolveSessionPolicy } from './index';

describe('resolveSessionPolicy', () => {
  it('applies app then project then built-in defaults', () => {
    expect(
      resolveSessionPolicy({
        accessLifetimeSeconds: 900,
        hardLifetimeSeconds: 2592000,
      }),
    ).toEqual({
      registrationMode: 'public',
      idleTimeoutSeconds: 604800,
      maxConcurrentSessions: 3,
    });
    expect(
      resolveSessionPolicy({
        app: { idleTimeoutSeconds: 3600 },
        project: { maxConcurrentSessions: 8 },
        accessLifetimeSeconds: 900,
        hardLifetimeSeconds: 2592000,
      }),
    ).toMatchObject({ idleTimeoutSeconds: 3600, maxConcurrentSessions: 8 });
  });

  it('applies a user session limit before app and project limits', () => {
    expect(
      resolveSessionPolicy({
        userSessionLimit: 2,
        app: { maxConcurrentSessions: 4 },
        accessLifetimeSeconds: 900,
        hardLifetimeSeconds: 2592000,
      }).maxConcurrentSessions,
    ).toBe(2);
  });

  it('rejects invalid idle timeouts and caps', () => {
    expect(() =>
      resolveSessionPolicy({
        app: { idleTimeoutSeconds: 60 },
        accessLifetimeSeconds: 900,
        hardLifetimeSeconds: 2592000,
      }),
    ).toThrow(RangeError);
    expect(() =>
      resolveSessionPolicy({
        userSessionLimit: 0,
        accessLifetimeSeconds: 900,
        hardLifetimeSeconds: 2592000,
      }),
    ).toThrow(RangeError);
  });
});
