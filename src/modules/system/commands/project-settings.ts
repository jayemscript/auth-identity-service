import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { AppDataSource } from '../../../database/data-source';
import { validateProjectSettings } from './project-settings.validation';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: make project-settings SETTINGS_FILE=path');
  const settings = JSON.parse(await readFile(path, 'utf8')) as Record<
    string,
    unknown
  >;
  validateProjectSettings(settings);
  const idleMinutes = Number(settings['session.idle_timeout_minutes'] ?? 10080);
  const idle = idleMinutes === 0 ? Number(process.env.JWT_REFRESH_EXPIRATION ?? 2592000) : idleMinutes * 60;
  const access = Number(process.env.JWT_ACCESS_EXPIRATION ?? 900);
  const hard = Number(process.env.JWT_REFRESH_EXPIRATION ?? 2592000);
  if (idle < access || idle > hard)
    throw new Error(
      'Idle timeout must be between access-token and hard-session lifetimes',
    );
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (tx) => {
      for (const [key, value] of Object.entries(settings)) {
        await tx.query(
          `INSERT INTO system.settings(id,key,value) VALUES ($1,$2,$3) ON CONFLICT (key) WHERE application_id IS NULL DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
          [randomUUID(), key, JSON.stringify(value)],
        );
      }
    });
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
