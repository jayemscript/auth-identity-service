import { resolve } from 'node:path';
import { parseAndValidateEnv, readE2EConfig } from './support/config';

const safeEnv = `
DB_ENV=local
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=root
DB_NAME=auth_db
DB_SSL=false
PORT=7000
API_KEY=local-test-key
BETTER_AUTH_URL=http://localhost:7000
`;

describe('local-only E2E safety gate', () => {
  it('accepts a local .env and ignores shell environment values', () => {
    const original = process.env.DB_ENV;
    process.env.DB_ENV = 'production';
    try {
      expect(parseAndValidateEnv(safeEnv).db.host).toBe('localhost');
    } finally {
      if (original === undefined) delete process.env.DB_ENV;
      else process.env.DB_ENV = original;
    }
  });

  it.each([
    ['missing DB_ENV', safeEnv.replace('DB_ENV=local\n', '')],
    ['production DB_ENV', safeEnv.replace('DB_ENV=local', 'DB_ENV=production')],
    ['remote database host', safeEnv.replace('DB_HOST=localhost', 'DB_HOST=db.example.com')],
    ['remote API host', `${safeEnv}E2E_API_URL=https://api.example.com\n`],
  ])('rejects %s before connecting', (_case, content) => {
    expect(() => parseAndValidateEnv(content)).toThrow(/E2E tests stopped/);
  });

  it('rejects a missing .env file', () => {
    expect(() => readE2EConfig(resolve(process.cwd(), 'test', 'missing.e2e.env'))).toThrow(
      /missing or unreadable/,
    );
  });
});
