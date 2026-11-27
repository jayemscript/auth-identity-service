import { isIP } from 'node:net';

export function normalizeIpAddress(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const address = value.trim();
  const mappedIpv4 = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mappedIpv4 && isIP(mappedIpv4[1]) === 4)
    return mappedIpv4[1].split('.').map(Number).join('.');
  const version = isIP(address);
  if (version === 4) return address.split('.').map(Number).join('.');
  if (version !== 6) return null;

  const groups = address.toLowerCase().split('::');
  const left = groups[0] ? groups[0].split(':') : [];
  const right = groups[1] ? groups[1].split(':') : [];
  const all = [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  if (all.length !== 8) return null;
  const mappedPrefix = all.slice(0, 5).every((group) => parseInt(group, 16) === 0) &&
    parseInt(all[5], 16) === 0xffff;
  if (mappedPrefix) {
    const high = parseInt(all[6], 16);
    const low = parseInt(all[7], 16);
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
  }
  return all.map((group) => parseInt(group, 16).toString(16)).join(':');
}
