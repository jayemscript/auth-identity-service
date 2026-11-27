import { createHash, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'dotenv';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface E2EConfig {
  envFile: string;
  apiBaseUrl: string;
  apiKey: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl: false;
  };
  runTag: string;
  publicAppSlug: string;
  adminAppSlug: string;
  alternateAppSlug: string;
  superAdminEmail: string;
  superAdminPassword: string;
}

export function parseAndValidateEnv(content: string, envFile = '.env'): E2EConfig {
  const values = parse(content);
  if (values.DB_ENV !== 'local') {
    throw new Error(
      `E2E tests stopped: ${envFile} must contain DB_ENV=local exactly.`,
    );
  }

  const dbHost = values.DB_HOST?.trim().toLowerCase();
  if (!dbHost || !LOCAL_HOSTS.has(dbHost)) {
    throw new Error(
      `E2E tests stopped: DB_HOST in ${envFile} must be localhost, 127.0.0.1, or ::1.`,
    );
  }

  const dbPort = Number(values.DB_PORT ?? '5432');
  const port = Number(values.PORT ?? '7000');
  if (!Number.isInteger(dbPort) || dbPort < 1 || dbPort > 65535) {
    throw new Error(`E2E tests stopped: DB_PORT in ${envFile} is invalid.`);
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`E2E tests stopped: PORT in ${envFile} is invalid.`);
  }
  if (values.DB_SSL === 'true') {
    throw new Error(
      `E2E tests stopped: DB_SSL must be false for local-only tests.`,
    );
  }

  for (const name of ['E2E_API_URL', 'BETTER_AUTH_URL']) {
    const configuredUrl = values[name];
    if (!configuredUrl) continue;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(configuredUrl);
    } catch {
      throw new Error(`E2E tests stopped: ${name} in ${envFile} is invalid.`);
    }
    if (
      parsedUrl.protocol !== 'http:' ||
      !LOCAL_HOSTS.has(parsedUrl.hostname.toLowerCase())
    ) {
      throw new Error(
        `E2E tests stopped: ${name} in ${envFile} must target a local HTTP host.`,
      );
    }
    if (name === 'E2E_API_URL' && Number(parsedUrl.port || 80) !== port) {
      throw new Error(
        `E2E tests stopped: E2E_API_URL must use PORT from ${envFile}.`,
      );
    }
  }

  const apiKey = values.API_KEY?.trim();
  const database = values.DB_NAME?.trim();
  const user = values.DB_USER?.trim();
  const password = values.DB_PASS;
  if (!apiKey || !database || !user || password === undefined) {
    throw new Error(
      `E2E tests stopped: ${envFile} must define API_KEY, DB_NAME, DB_USER, and DB_PASS.`,
    );
  }

  const apiBaseUrl = values.E2E_API_URL
    ? new URL(values.E2E_API_URL).origin
    : `http://127.0.0.1:${port}`;
  const runTag = createHash('sha256')
    .update(`${dbHost}:${dbPort}:${user}:${database}:${apiKey}:local-e2e`)
    .digest('hex')
    .slice(0, 10);

  return {
    envFile,
    apiBaseUrl,
    apiKey,
    db: {
      host: dbHost,
      port: dbPort,
      user,
      password,
      database,
      ssl: false,
    },
    runTag,
    publicAppSlug: (values.E2E_PUBLIC_APP_SLUG ?? 'public-ecommerce-web')
      .trim()
      .toLowerCase(),
    adminAppSlug: (values.E2E_ADMIN_APP_SLUG ?? 'internal-admin')
      .trim()
      .toLowerCase(),
    alternateAppSlug: (values.E2E_ALTERNATE_APP_SLUG ?? 'mobile-app')
      .trim()
      .toLowerCase(),
    superAdminEmail: values.SUPERADMINEMAIL?.trim() ?? '',
    superAdminPassword: values.SUPERADMINPASSWORD ?? '',
  };
}

export function readE2EConfig(envFile = resolve(process.cwd(), '.env')): E2EConfig {
  let contents: string;
  try {
    contents = readFileSync(envFile, 'utf8');
  } catch {
    throw new Error(
      `E2E tests stopped: ${envFile} is missing or unreadable. Create a local .env with DB_ENV=local.`,
    );
  }
  return parseAndValidateEnv(contents, envFile);
}

export type CredentialProfile = 'full' | 'limited';

export function credentialFor(
  config: E2EConfig,
  appSlug: string,
  profile: CredentialProfile = 'full',
): { id: string; secret: string; value: string; name: string } {
  const slug = appSlug.toLowerCase();
  const name = `local-e2e-${config.runTag}-${slug}-${profile}`;
  const id = createHash('sha256')
    .update(name)
    .digest('hex')
    .slice(0, 32);
  const secret = createHmac('sha256', config.apiKey)
    .update(`local-e2e-credential:${name}`)
    .digest('base64url');
  return { id, secret, value: `${id}.${secret}`, name };
}

export const E2E_SCOPES = [
  'auth:login',
  'tokens:verify',
  'tokens:refresh',
  'sessions:revoke:self',
  'sessions:read:self',
  'app-access:check',
  'users:register',
  'users:access:write',
  'users:config:write',
  'sessions:read',
  'sessions:revoke',
  'apps:read',
];
