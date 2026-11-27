import { digestDeviceId, digestLoginSubject, isValidDeviceId } from './security-digest';

describe('security digests', () => {
  it('normalizes login subjects and separates device digests by app and user', () => {
    expect(digestLoginSubject(' Alice@Example.com ', 'secret')).toBe(
      digestLoginSubject('alice@example.com', 'secret'),
    );
    const first = digestDeviceId({ applicationId: 'app-a', userId: 'u1', deviceId: 'A'.repeat(22), secret: 'secret' });
    expect(first).not.toBe(digestDeviceId({ applicationId: 'app-b', userId: 'u1', deviceId: 'A'.repeat(22), secret: 'secret' }));
    expect(first).not.toBe(digestDeviceId({ applicationId: 'app-a', userId: 'u2', deviceId: 'A'.repeat(22), secret: 'secret' }));
  });

  it('accepts only opaque device identifiers in the specified length range', () => {
    expect(isValidDeviceId('A'.repeat(22))).toBe(true);
    expect(isValidDeviceId('A'.repeat(21))).toBe(false);
    expect(isValidDeviceId('A'.repeat(129))).toBe(false);
    expect(isValidDeviceId('invalid+/id'.repeat(3))).toBe(false);
  });
});
