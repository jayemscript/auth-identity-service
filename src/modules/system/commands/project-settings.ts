import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { AppDataSource } from '../../../database/data-source';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: make project-settings SETTINGS_FILE=path');
  const settings = JSON.parse(await readFile(path, 'utf8')) as Record<
    string,
    unknown
  >;
  const allowedKeys = new Set([
    'registration.mode',
    'email_verification.required',
    'session.idle_timeout_seconds',
    'session.max_concurrent',
  ]);
  for (const key of Object.keys(settings)) {
    if (!allowedKeys.has(key))
      throw new Error(`Unsupported project setting ${key}`);
  }
  const defaults: Record<string, unknown> = {
    'registration.mode': 'public',
    'email_verification.required': false,
    'session.idle_timeout_seconds': 604800,
    'session.max_concurrent': 3,
  };
  const merged = { ...defaults, ...settings };
  if (
    !['public', 'operator_only', 'disabled'].includes(
      String(merged['registration.mode']),
    )
  )
    throw new Error('Invalid registration.mode');
  if (typeof merged['email_verification.required'] !== 'boolean')
    throw new Error('email_verification.required must be boolean');
  for (const key of [
    'session.idle_timeout_seconds',
    'session.max_concurrent',
  ]) {
    if (!Number.isInteger(merged[key]) || Number(merged[key]) < 1)
      throw new Error(`${key} must be a positive integer`);
  }
  const idle = Number(merged['session.idle_timeout_seconds']);
  const access = Number(process.env.JWT_ACCESS_EXPIRATION ?? 900);
  const hard = Number(process.env.JWT_REFRESH_EXPIRATION ?? 2592000);
  if (idle < access || idle > hard)
    throw new Error(
      'Idle timeout must be between access-token and hard-session lifetimes',
    );
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (tx) => {
      for (const [key, value] of Object.entries(merged)) {
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
