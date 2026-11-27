import { Client } from 'pg';
import { credentialFor, readE2EConfig } from './support/config';

async function teardown(): Promise<void> {
  const config = readE2EConfig();
  const slugs = new Set([
    config.publicAppSlug,
    config.adminAppSlug,
    config.alternateAppSlug,
  ]);
  const client = new Client(config.db);
  await client.connect();
  try {
    await client.query('BEGIN');
    try {
      await client.query(
        `DELETE FROM identity.users WHERE email::text ILIKE $1`,
        [`e2e-${config.runTag}-%@example.test`],
      );
      const ids = [...slugs].flatMap((slug) => [
        credentialFor(config, slug, 'full').id,
        credentialFor(config, slug, 'limited').id,
      ]);
      await client.query(
        `DELETE FROM apps.application_credentials WHERE id = ANY($1::text[])`,
        [ids],
      );
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}

export default teardown;
