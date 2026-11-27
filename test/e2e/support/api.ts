import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { credentialFor, readE2EConfig, type CredentialProfile } from './config';

export function api() {
  return request(readE2EConfig().apiBaseUrl);
}

export function appHeaders(
  appSlug: string,
  options: { profile?: CredentialProfile; accessToken?: string } = {},
): Record<string, string> {
  const config = readE2EConfig();
  const credential = credentialFor(
    config,
    appSlug,
    options.profile ?? 'full',
  );
  return {
    'X-API-Key': credential.value,
    'X-App-Id': appSlug,
    ...(options.accessToken
      ? { Authorization: `Bearer ${options.accessToken}` }
      : {}),
  };
}

export function uniqueUser(prefix = 'user') {
  const config = readE2EConfig();
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  return {
    name: `E2E ${prefix} ${suffix}`,
    email: `e2e-${config.runTag}-${suffix}@example.test`,
    username: `e2e${suffix}`,
    password: 'LocalTest123!',
  };
}

export function withVerifiedEmail<T extends { email: string }>(user: T) {
  return { ...user, verifiedEmail: user.email };
}
