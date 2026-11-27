import { createHash } from 'node:crypto';
import { Client } from 'pg';
import { credentialFor, E2E_SCOPES, readE2EConfig } from './support/config';

async function setup(): Promise<void> {
  const config = readE2EConfig();
  if (!config.superAdminEmail || !config.superAdminPassword) {
    throw new Error(
      'E2E tests stopped: .env must define SUPERADMINEMAIL and SUPERADMINPASSWORD for admin API coverage.',
    );
  }

  const client = new Client(config.db);
  const requiredSlugs = [
    config.publicAppSlug,
    config.adminAppSlug,
    config.alternateAppSlug,
  ];
  await client.connect();
  try {
    const relations = await client.query<{ relation: string; found: string | null }>(
      `SELECT relation, to_regclass(relation)::text AS found
       FROM unnest($1::text[]) AS t(relation)`,
      [
        [
          'public.migrations',
          'system.bootstrap_runs',
          'system.policy_definitions',
          'apps.applications',
          'apps.application_credentials',
          'apps.application_credential_scopes',
          'auth.jwks',
        ],
      ],
    );
    const missing = relations.rows
      .filter((row) => !row.found)
      .map((row) => row.relation);
    if (missing.length) {
      throw new Error(
        `E2E tests stopped: migrations are incomplete. Missing: ${missing.join(', ')}.`,
      );
    }

    const bootstrap = await client.query(
      'SELECT 1 FROM system.bootstrap_runs LIMIT 1',
    );
    if (!bootstrap.rowCount) {
      throw new Error(
        'E2E tests stopped: apply the bootstrap seed before running API tests.',
      );
    }

    const apps = await client.query<{ slug: string }>(
      `SELECT slug::text AS slug FROM apps.applications
       WHERE status = 'active' AND slug = ANY($1::text[])`,
      [requiredSlugs],
    );
    const foundSlugs = new Set(apps.rows.map((row) => row.slug.toLowerCase()));
    const absentSlugs = requiredSlugs.filter((slug) => !foundSlugs.has(slug));
    if (absentSlugs.length) {
      throw new Error(
        `E2E tests stopped: bootstrap is missing active app(s): ${absentSlugs.join(', ')}.`,
      );
    }
  } finally {
    await client.end();
  }

  const cleanupClient = new Client(config.db);
  await cleanupClient.connect();
  try {
    await cleanupClient.query('BEGIN');
    try {
      await cleanupClient.query(
        `DELETE FROM identity.users WHERE email::text ILIKE $1`,
        [`e2e-${config.runTag}-%@example.test`],
      );
      await cleanupClient.query(
        `DELETE FROM apps.application_credentials WHERE name LIKE $1`,
        [`local-e2e-${config.runTag}-%`],
      );
      await cleanupClient.query('COMMIT');
    } catch (error) {
      await cleanupClient.query('ROLLBACK');
      throw error;
    }
  } finally {
    await cleanupClient.end();
  }

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}/health`, {
      headers: { 'X-API-Key': config.apiKey },
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    throw new Error(
      `E2E tests stopped: the local API is not reachable at ${config.apiBaseUrl}. Start the server and retry.`,
    );
  }
  if (!response.ok) {
    throw new Error(
      `E2E tests stopped: GET /health returned ${response.status}. Confirm the service is ready and the .env API_KEY matches the running server.`,
    );
  }
  const health = (await response.json()) as { data?: { status?: string } };
  if (health.data?.status !== 'ready') {
    throw new Error('E2E tests stopped: GET /health did not report ready.');
  }

  const setupClient = new Client(config.db);
  await setupClient.connect();
  try {
    await provisionCredentials(setupClient, config, requiredSlugs);
  } finally {
    await setupClient.end();
  }
}

async function provisionCredentials(
  client: Client,
  config: ReturnType<typeof readE2EConfig>,
  appSlugs: string[],
): Promise<void> {
  await client.query('BEGIN');
  try {
    for (const slug of new Set(appSlugs)) {
      const [full, limited] = [
        credentialFor(config, slug, 'full'),
        credentialFor(config, slug, 'limited'),
      ];
      const app = await client.query<{ id: string }>(
        `SELECT id FROM apps.applications WHERE slug = $1 AND status = 'active'`,
        [slug],
      );
      const applicationId = app.rows[0]?.id;
      if (!applicationId) throw new Error(`App ${slug} disappeared during setup.`);

      for (const credential of [full, limited]) {
        const hash = createHash('sha256')
          .update(credential.secret)
          .digest('hex');
        await client.query(
          `DELETE FROM apps.application_credentials WHERE id = $1`,
          [credential.id],
        );
        await client.query(
          `INSERT INTO apps.application_credentials
             (id, application_id, name, secret_hash, expires_at, revoked_at)
           VALUES ($1, $2, $3, $4, now() + interval '4 hours', NULL)`,
          [credential.id, applicationId, credential.name, hash],
        );
        const scopes = credential === full ? E2E_SCOPES : ['auth:login'];
        for (const scope of scopes) {
          await client.query(
            `INSERT INTO apps.application_credential_scopes (credential_id, scope)
             VALUES ($1, $2)`,
            [credential.id, scope],
          );
        }
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

export default setup;
