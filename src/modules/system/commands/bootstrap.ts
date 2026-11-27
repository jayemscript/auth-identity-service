import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { AppDataSource } from '../../../database/data-source';
import { auth } from '../../../auth/better-auth';
import { randomUUID } from 'node:crypto';
import { withBetterAuthTransaction } from '../../../common/database';
import { findApplicationPolicy } from '../../apps/repositories/application-policy.repository';

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

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: make bootstrap SEED_FILE=path');
  const seed = JSON.parse(await readFile(path, 'utf8')) as SeedInput;
  if (!seed.runKey || !seed.adminAppSlug || !seed.apps?.length)
    throw new Error('Seed requires runKey, adminAppSlug, and apps');
  const adminAppSlug = seed.adminAppSlug.trim().toLowerCase();
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
  if (!seed.apps.some((app) => app.slug.trim().toLowerCase() === adminAppSlug))
    throw new Error('adminAppSlug must reference a seeded app');
  const normalizedSlugs = seed.apps.map((app) => app.slug.trim().toLowerCase());
  if (new Set(normalizedSlugs).size !== normalizedSlugs.length)
    throw new Error('App slugs must be unique');
  for (const app of seed.apps) {
    if (!/^[a-z0-9][a-z0-9._-]{1,62}$/.test(app.slug.trim().toLowerCase()))
      throw new Error(`Invalid app slug ${app.slug}`);
    if (!app.name.trim() || !app.clientType.trim())
      throw new Error(`App ${app.slug} requires a name and clientType`);
  }
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
      appSlugs: [adminAppSlug],
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
        'auth-identity-service-bootstrap',
      ]);
      for (const app of seed.apps) {
        const slug = app.slug.trim().toLowerCase();
        const policy = app.policy ?? {};
        const [existingApp] = await tx.query(
          `SELECT id, name, client_type FROM apps.applications WHERE slug = $1`,
          [slug],
        );
        if (existingApp) {
          const existingPolicy = await findApplicationPolicy(tx, existingApp.id);
          if (
            existingApp.name !== app.name.trim() ||
            existingApp.client_type !== app.clientType.trim() ||
            stableJson(existingPolicy) !== stableJson(policy)
          )
            throw new Error(
              `App ${slug} is already registered with different settings. App records are immutable; add a new app with a new slug instead.`,
            );
          appIds.set(slug, existingApp.id);
          continue;
        }

        const applicationId = randomUUID();
        for (const [key, value] of Object.entries(policy)) {
          await tx.query(
            `INSERT INTO apps.application_policy_entries(application_id, key, value) VALUES ($1, $2, $3)`,
            [applicationId, key, JSON.stringify(value)],
          );
        }
        await tx.query(
          `INSERT INTO apps.applications(id, slug, name, client_type) VALUES ($1, $2, $3, $4)`,
          [applicationId, slug, app.name.trim(), app.clientType.trim()],
        );
        appIds.set(slug, applicationId);
      }

      for (const [key, value] of Object.entries({
        'registration.mode': 'disabled',
        'account.approval': 'auto_approve',
        'auth.methods': ['password'],
        'mfa.required': false,
        'session.overflow_policy': 'block_new',
        'token.refresh_rotation': 'rotate',
        'email_verification.required': false,
        'session.idle_timeout_minutes': 10080,
        'session.max_concurrent': 3,
        ...seed.settings,
        'administration.app_slug': seed.adminAppSlug.toLowerCase(),
      })) {
        await tx.query(
          `INSERT INTO system.settings(id, key, value) VALUES ($1, $2, $3)
           ON CONFLICT (key) WHERE application_id IS NULL DO NOTHING`,
          [randomUUID(), key, JSON.stringify(value)],
        );
      }
      const [configuredAdmin] = await tx.query(
        `SELECT value #>> '{}' AS slug FROM system.settings WHERE key = 'administration.app_slug' AND application_id IS NULL`,
      );
      if (configuredAdmin?.slug?.toLowerCase() !== adminAppSlug)
        throw new Error(
          'The designated admin app cannot change after bootstrap. Keep adminAppSlug unchanged.',
        );

      const [existingRun] = await tx.query(
        `SELECT id FROM system.bootstrap_runs WHERE run_key = $1`,
        [seed.runKey],
      );
      if (existingRun) return;

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
        `INSERT INTO system.bootstrap_runs(id,run_key,completed_at,apps_count,users_count) VALUES ($1,$2,now(),$3,$4)`,
        [
          randomUUID(),
          seed.runKey,
          seed.apps.length,
          people.length,
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
