import { createPublicKey } from 'node:crypto';
import type { JwtService } from '@nestjs/jwt';
import type { DataSource } from 'typeorm';

export async function verifyAccessToken(
  token: string,
  jwt: JwtService,
  dataSource: DataSource,
) {
  const [encodedHeader] = token.split('.');
  if (!encodedHeader) throw new Error('Malformed token');
  const header = JSON.parse(
    Buffer.from(encodedHeader, 'base64url').toString('utf8'),
  ) as { alg?: string; kid?: string };
  if (header.alg === 'HS256') {
    const cutoff = process.env.JWT_LEGACY_ACCESS_CUTOFF;
    if (cutoff && Date.now() >= new Date(cutoff).getTime())
      throw new Error('Legacy token support has ended');
    return jwt.verifyAsync(token, {
      secret: process.env.JWT_SECRET,
      algorithms: ['HS256'],
      issuer: 'auth-identity-service',
    });
  }
  if (header.alg !== 'ES256' || !header.kid)
    throw new Error('Unsupported token signing key');
  const [key] = await dataSource.query(
    `SELECT public_key FROM auth.jwks WHERE id = $1`,
    [header.kid],
  );
  if (!key) throw new Error('Unknown signing key');
  const publicKey = createPublicKey({
    key: JSON.parse(key.public_key),
    format: 'jwk',
  }).export({ type: 'spki', format: 'pem' }) as string;
  return jwt.verifyAsync(token, {
    publicKey,
    algorithms: ['ES256'],
    issuer: 'auth-identity-service',
  });
}
