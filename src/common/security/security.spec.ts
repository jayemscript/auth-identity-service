import { normalizeIdentifier, sessionIsActive, verifyApiKey } from './index';

describe('security helpers', () => {
  it('compares API keys without a direct string comparison', () => {
    expect(verifyApiKey('secret-key', 'secret-key')).toBe(true);
    expect(verifyApiKey('secret-key', 'wrong-key')).toBe(false);
    expect(verifyApiKey('', 'secret-key')).toBe(false);
  });

  it('normalizes login identifiers', () => {
    expect(normalizeIdentifier('  User@Example.com ')).toBe('user@example.com');
  });

  it('rejects revoked, idle-expired, or hard-expired sessions', () => {
    const now = new Date('2026-01-01T00:00:00Z');
    expect(
      sessionIsActive(
        {
          idleExpiresAt: new Date('2026-01-02'),
          hardExpiresAt: new Date('2026-01-03'),
        },
        now,
      ),
    ).toBe(true);
    expect(
      sessionIsActive(
        {
          idleExpiresAt: new Date('2025-12-31'),
          hardExpiresAt: new Date('2026-01-03'),
        },
        now,
      ),
    ).toBe(false);
  });
});
