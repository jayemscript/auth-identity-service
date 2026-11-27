import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import { AppDataSource } from '../../../database/data-source';

async function main() {
  const [action, appSlug, credentialId, scopesArgument] = process.argv.slice(2);
  if (!['issue', 'revoke'].includes(action))
    throw new Error(
      'Usage: issue <app-slug> <name> <comma-separated-scopes> [expires-at] | revoke <app-slug> <credential-id>',
    );
  await AppDataSource.initialize();
  try {
    if (action === 'issue') {
      const name = credentialId;
      const scopes = scopesArgument?.split(',').map((scope) => scope.trim()) ?? [];
      const expiresAt = process.argv[6] ? new Date(process.argv[6]) : null;
      if (!appSlug || !name || !scopes.length || scopes.some((scope) => !scope))
        throw new Error('Provide an app slug, credential name, and scopes.');
      if (expiresAt && Number.isNaN(expiresAt.getTime()))
        throw new Error('Expiry must be a valid date.');
      const [app] = await AppDataSource.query(
        `SELECT id FROM apps.applications WHERE slug = $1 AND status = 'active'`,
        [appSlug.toLowerCase()],
      );
      if (!app) throw new Error(`Active app ${appSlug} was not found.`);
      const id = randomBytes(16).toString('hex');
      const secret = randomBytes(32).toString('base64url');
      const secretHash = createHash('sha256').update(secret).digest('hex');
      await AppDataSource.transaction(async (tx) => {
        await tx.query(
          `INSERT INTO apps.application_credentials(id, application_id, name, secret_hash, expires_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [id, app.id, name, secretHash, expiresAt],
        );
        for (const scope of new Set(scopes))
          await tx.query(
            `INSERT INTO apps.application_credential_scopes(credential_id, scope) VALUES ($1, $2)`,
            [id, scope],
          );
      });
      console.log(`Save this credential once in the BFF secret store.\n${id}.${secret}`);
      return;
    }
    if (!appSlug || !credentialId)
      throw new Error('Provide an app slug and credential ID to revoke.');
    const result = await AppDataSource.query(
      `UPDATE apps.application_credentials c SET revoked_at = now()
       FROM apps.applications a
       WHERE c.application_id = a.id AND a.slug = $1 AND c.id = $2 AND c.revoked_at IS NULL
       RETURNING c.id`,
      [appSlug.toLowerCase(), credentialId],
    );
    if (!result.length) throw new Error('Active credential was not found for this app.');
    console.log(`Credential ${credentialId} was revoked.`);
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
