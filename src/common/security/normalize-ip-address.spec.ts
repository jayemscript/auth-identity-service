import { normalizeIpAddress } from './normalize-ip-address';

describe('normalizeIpAddress', () => {
  it('normalizes equivalent IPv6 and IPv4-mapped addresses', () => {
    expect(normalizeIpAddress('2001:0db8:0:0:0:0:0:1')).toBe('2001:db8:0:0:0:0:0:1');
    expect(normalizeIpAddress('::ffff:192.0.2.8')).toBe('192.0.2.8');
    expect(normalizeIpAddress('192.0.2.8')).toBe('192.0.2.8');
  });

  it('rejects absent and invalid addresses', () => {
    expect(normalizeIpAddress(undefined)).toBeNull();
    expect(normalizeIpAddress('not-an-ip')).toBeNull();
  });
});
