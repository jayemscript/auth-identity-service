import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyApiKey(expected: string, supplied?: string): boolean {
  if (!expected || !supplied) return false;
  const expectedHash = createHmac('sha256', expected).digest();
  const suppliedHash = createHmac('sha256', supplied).digest();
  return timingSafeEqual(expectedHash, suppliedHash);
}

export function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}

export function sessionIsActive(
  session: {
    revokedAt?: Date | null;
    idleExpiresAt: Date;
    hardExpiresAt: Date;
  },
  now = new Date(),
): boolean {
  return (
    !session.revokedAt &&
    session.idleExpiresAt > now &&
    session.hardExpiresAt > now
  );
}
