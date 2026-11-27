import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { AppDataSource } from '../../../database/data-source';
import { DOMAIN_EVENT_TYPES } from '../event-catalog';

interface EndpointInput {
  key: string;
  url: string;
  secretRef: string;
  subscriptions: string[];
}

interface AppInput {
  appSlug: string;
  endpoints: EndpointInput[];
}

interface EndpointFile {
  apps: AppInput[];
}

function validate(file: EndpointFile): void {
  if (!Array.isArray(file.apps) || file.apps.length === 0)
    throw new Error('Provide at least one app endpoint configuration.');
  for (const app of file.apps) {
    if (!app.appSlug?.trim() || !Array.isArray(app.endpoints))
      throw new Error('Each app requires an appSlug and endpoints list.');
    const keys = new Set<string>();
    for (const endpoint of app.endpoints) {
      if (!endpoint.key?.trim() || keys.has(endpoint.key))
        throw new Error(`Endpoint keys must be present and unique for ${app.appSlug}.`);
      keys.add(endpoint.key);
      let url: URL;
      try {
        url = new URL(endpoint.url);
      } catch {
        throw new Error(`Endpoint ${endpoint.key} requires a valid HTTPS URL.`);
      }
      if (url.protocol !== 'https:' || !endpoint.secretRef?.trim())
        throw new Error(`Endpoint ${endpoint.key} requires HTTPS and a secretRef.`);
      if (!Array.isArray(endpoint.subscriptions) || endpoint.subscriptions.some((event) => !(DOMAIN_EVENT_TYPES as readonly string[]).includes(event)))
        throw new Error(`Endpoint ${endpoint.key} has an unsupported event subscription.`);
    }
  }
}

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: make webhook-endpoints ENDPOINTS_FILE=path');
  const file = JSON.parse(await readFile(path, 'utf8')) as EndpointFile;
  validate(file);
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (tx) => {
      for (const appInput of file.apps) {
        const slug = appInput.appSlug.trim().toLowerCase();
        const [app] = await tx.query(`SELECT id FROM apps.applications WHERE slug = $1`, [slug]);
        if (!app) throw new Error(`App ${slug} was not found. Bootstrap apps first.`);
        const keys = appInput.endpoints.map(({ key }) => key);
        await tx.query(
          `UPDATE events.webhook_endpoints SET is_active = false
           WHERE application_id = $1 AND NOT (endpoint_key = ANY($2::text[])) AND is_active = true`,
          [app.id, keys],
        );
        for (const endpoint of appInput.endpoints) {
          const [existing] = await tx.query(
            `SELECT url FROM events.webhook_endpoints WHERE application_id = $1 AND endpoint_key = $2`,
            [app.id, endpoint.key],
          );
          if (existing && existing.url !== endpoint.url)
            throw new Error(`Endpoint key ${endpoint.key} cannot change URL. Use a new key.`);
          await tx.query(
            `INSERT INTO events.webhook_endpoints
             (id, application_id, endpoint_key, url, secret_reference, event_types, is_active)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true)
             ON CONFLICT (application_id, endpoint_key) DO UPDATE
             SET secret_reference = EXCLUDED.secret_reference, event_types = EXCLUDED.event_types, is_active = true`,
            [app.id, endpoint.key, endpoint.url, endpoint.secretRef, endpoint.subscriptions],
          );
        }
      }
    });
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Endpoint provisioning failed.');
  process.exitCode = 1;
});
