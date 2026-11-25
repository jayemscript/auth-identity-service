import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { AppDataSource } from '../../../database/data-source';
import { auth } from '../../../auth/better-auth';
import { randomUUID } from 'node:crypto';
import { withBetterAuthTransaction } from '../../../common/database';

interface SeedInput {
  runKey: string;
  adminAppSlug: string;
  settings?: Record<string, unknown>;
  apps: Array<{
    slug: string;
    name: string;
    clientType: string;
    policy?: Record<string, unknown>;
  }>;
  users?: Array<{
    email: string;
    name: string;
    username?: string;
    passwordSecret: string;
    appSlugs: string[];
    canCreateUsers?: boolean;
  }>;
}

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: make bootstrap SEED_FILE=path');
  const seed = JSON.parse(await readFile(path, 'utf8')) as SeedInput;
  if (!seed.runKey || !seed.adminAppSlug || !seed.apps?.length)
    throw new Error('Seed requires runKey, adminAppSlug, and apps');
  const adminEmail = process.env.SUPERADMINEMAIL?.trim().toLowerCase();
  const adminPassword = process.env.SUPERADMINPASSWORD;
  if (!adminEmail)
    throw new Error('Set SUPERADMINEMAIL in the repository-root .env file');
  if (!adminPassword)
    throw new Error('Set SUPERADMINPASSWORD in the repository-root .env file');
  if (
    adminPassword === 'change_this' ||
    adminPassword.toLowerCase().startsWith('replace_with') ||
    adminPassword.length < 8
  )
    throw new Error(
      'SUPERADMINPASSWORD must be generated, at least 8 characters, and not a placeholder',
    );
  if (
    !seed.apps.some(
      (app) => app.slug.toLowerCase() === seed.adminAppSlug.toLowerCase(),
    )
  )
    throw new Error('adminAppSlug must reference a seeded app');
  const normalizedSlugs = seed.apps.map((app) => app.slug.trim().toLowerCase());
  if (new Set(normalizedSlugs).size !== normalizedSlugs.length)
    throw new Error('App slugs must be unique');
  const people: Array<{
    email: string;
    name: string;
    password: string;
    username?: string;
    appSlugs: string[];
    superAdmin: boolean;
    canCreateUsers: boolean;
  }> = [
    {
      email: adminEmail,
      name: 'SuperAdmin',
      password: adminPassword,
      appSlugs: [seed.adminAppSlug],
      superAdmin: true,
      canCreateUsers: true,
    },
    ...(seed.users ?? []).map((user) => {
      const password = process.env[user.passwordSecret];
      if (!password || user.passwordSecret === 'SUPERADMINPASSWORD')
        throw new Error(`Missing user password secret ${user.passwordSecret}`);
      if (
        password.length < 8 ||
        password.toLowerCase().startsWith('replace_with')
      )
        throw new Error(
          `${user.passwordSecret} must be generated and at least 8 characters`,
        );
      return {
        email: user.email.trim().toLowerCase(),
        name: user.name,
        username: user.username?.trim().toLowerCase(),
        password,
        appSlugs: user.appSlugs,
        superAdmin: false,
        canCreateUsers: Boolean(user.canCreateUsers),
      };
    }),
  ];
  const identifiers = people.flatMap((person) => [
    person.email,
    ...(person.username ? [person.username] : []),
  ]);
  if (new Set(identifiers).size !== identifiers.length)
    throw new Error('Seed email addresses and usernames must be unique');
  const seededAppSlugs = new Set(normalizedSlugs);
  for (const person of people)
    for (const slug of person.appSlugs) {
      if (!seededAppSlugs.has(slug.trim().toLowerCase()))
        throw new Error(`Unknown app slug ${slug}`);
    }
  await AppDataSource.initialize();
  const createdUserIds: string[] = [];
  try {
    const appIds = new Map<string, string>();
    await AppDataSource.transaction(async (tx) => {
      await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        seed.runKey,
      ]);
      const [existing] = await tx.query(
        `SELECT id FROM system.bootstrap_runs WHERE run_key = $1`,
        [seed.runKey],
      );
      if (existing) return;
      for (const app of seed.apps) {
        const id = randomUUID();
        await tx.query(
          `INSERT INTO apps.applications(id, slug, name, client_type, policy) VALUES ($1, lower($2), $3, $4, $5)`,
          [id, app.slug, app.name, app.clientType, app.policy ?? {}],
        );
        appIds.set(app.slug.toLowerCase(), id);
      }
      for (const [key, value] of Object.entries({
        'registration.mode': 'public',
        'email_verification.required': false,
        'session.idle_timeout_seconds': 604800,
        'session.max_concurrent': 3,
        ...seed.settings,
        'administration.app_slug': seed.adminAppSlug.toLowerCase(),
      })) {
        if (key === 'administration.app_slug') {
          await tx.query(
            `INSERT INTO system.settings(id, key, value) VALUES ($1, $2, $3)
             ON CONFLICT (key) WHERE application_id IS NULL
             DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
            [randomUUID(), key, JSON.stringify(value)],
          );
        } else {
          await tx.query(
            `INSERT INTO system.settings(id, key, value) VALUES ($1, $2, $3)
             ON CONFLICT (key) WHERE application_id IS NULL DO NOTHING`,
            [randomUUID(), key, JSON.stringify(value)],
          );
        }
      }
      for (const person of people) {
        const result = await withBetterAuthTransaction(tx, () =>
          auth.api.signUpEmail({
            body: {
              email: person.email,
              name: person.name,
              password: person.password,
              ...(person.username ? { username: person.username } : {}),
            },
          }),
        );
        createdUserIds.push(result.user.id);
        await tx.query(
          `INSERT INTO identity.user_configs(id, user_id, is_superadmin, can_create_users, creation_source) VALUES ($1,$2,$3,$4,'seed')`,
          [
            randomUUID(),
            result.user.id,
            person.superAdmin,
            person.canCreateUsers,
          ],
        );
        for (const slug of person.appSlugs) {
          const appId = appIds.get(slug.trim().toLowerCase());
          if (!appId) throw new Error(`Unknown app slug ${slug}`);
          await tx.query(
            `INSERT INTO identity.user_application_access(id,user_id,application_id,status,grant_source) VALUES ($1,$2,$3,'active','seed')`,
            [randomUUID(), result.user.id, appId],
          );
        }
      }
      await tx.query(
        `INSERT INTO system.bootstrap_runs(id,run_key,completed_at,result_metadata) VALUES ($1,$2,now(),$3)`,
        [
          randomUUID(),
          seed.runKey,
          JSON.stringify({ apps: seed.apps.length, users: people.length }),
        ],
      );
    });
  } catch (error) {
    if (createdUserIds.length) {
      await AppDataSource.query(
        `DELETE FROM identity.users WHERE id = ANY($1::text[])`,
        [createdUserIds],
      );
    }
    throw error;
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
