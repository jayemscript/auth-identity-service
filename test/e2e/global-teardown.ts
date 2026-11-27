import { Client } from 'pg';
import { credentialFor, readE2EConfig } from './support/config';

async function teardown(): Promise<void> {
  const config = readE2EConfig();
  const slugs = new Set([
    config.publicAppSlug,
    config.adminAppSlug,
    config.alternateAppSlug,
    config.securityAppSlug,
    config.lockoutAppSlug,
    config.eventAppSlug,
  ]);
  const fixtureSlugs = [
    config.securityAppSlug,
    config.lockoutAppSlug,
    config.eventAppSlug,
  ];
  const client = new Client(config.db);
  await client.connect();
  try {
    await client.query('BEGIN');
    try {
      const users = await client.query<{ id: string }>(
        `SELECT id FROM identity.users WHERE email::text ILIKE $1`,
        [`e2e-${config.runTag}-%@example.test`],
      );
      const userIds = users.rows.map(({ id }) => id);
      const fixtureApps = await client.query<{ id: string }>(
        'SELECT id FROM apps.applications WHERE slug = ANY($1::text[])',
        [fixtureSlugs],
      );
      const fixtureIds = fixtureApps.rows.map(({ id }) => id);
      if (userIds.length) {
        await client.query(
          `DELETE FROM events.webhook_deliveries d USING events.domain_events e
           WHERE d.application_id = e.application_id AND d.event_id = e.id
             AND (e.aggregate_id = ANY($1::text[]) OR e.payload->>'userId' = ANY($1::text[]))`,
          [userIds],
        );
        await client.query(
          `DELETE FROM events.domain_events
           WHERE aggregate_id = ANY($1::text[]) OR payload->>'userId' = ANY($1::text[])`,
          [userIds],
        );
        await client.query('DELETE FROM security.login_attempts WHERE user_id = ANY($1::text[])', [userIds]);
        await client.query('DELETE FROM security.account_lockouts WHERE user_id = ANY($1::text[])', [userIds]);
        await client.query('DELETE FROM auth.sessions WHERE user_id = ANY($1::text[])', [userIds]);
        await client.query('DELETE FROM security.user_devices WHERE user_id = ANY($1::text[])', [userIds]);
        await client.query('DELETE FROM security.security_events WHERE user_id = ANY($1::text[])', [userIds]);
      }
      if (fixtureIds.length) {
        await client.query(
          'DELETE FROM events.webhook_deliveries WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
        await client.query(
          'DELETE FROM auth.sessions WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
        await client.query(
          'DELETE FROM events.domain_events WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
        await client.query(
          'DELETE FROM events.webhook_endpoints WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
        await client.query(
          'DELETE FROM security.ip_rules WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
        await client.query(
          'DELETE FROM security.email_domain_rules WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
        await client.query(
          'DELETE FROM security.account_lockouts WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
        await client.query(
          'DELETE FROM security.login_attempts WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
        await client.query(
          'DELETE FROM security.user_devices WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
        await client.query(
          'DELETE FROM security.security_events WHERE application_id = ANY($1::uuid[])',
          [fixtureIds],
        );
      }
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
