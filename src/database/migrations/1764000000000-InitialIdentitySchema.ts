import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialIdentitySchema1764000000000 implements MigrationInterface {
  name = 'InitialIdentitySchema1764000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS citext`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS identity`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS apps`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS auth`);
    await queryRunner.query(`CREATE SCHEMA IF NOT EXISTS system`);
    await queryRunner.query(`
      CREATE TABLE identity.users (
        id text PRIMARY KEY, name text NOT NULL, email citext NOT NULL UNIQUE,
        email_verified boolean NOT NULL DEFAULT false,
        email_verified_at timestamptz, image text,
        username citext UNIQUE, phone_number text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE identity.accounts (
        id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL,
        user_id text NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
        password_hash text, access_token text, refresh_token text, id_token text,
        access_token_expires_at timestamptz, refresh_token_expires_at timestamptz,
        scope text, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(provider_id, account_id)
      )`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_identity_accounts_credential_user ON identity.accounts(user_id) WHERE provider_id = 'credential'`,
    );
    await queryRunner.query(`
      CREATE TABLE auth.sessions (
        id text PRIMARY KEY, token text NOT NULL UNIQUE,
        user_id text NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
        expires_at timestamptz NOT NULL, ip_address text, user_agent text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        application_id uuid, hard_expires_at timestamptz,
        refresh_generation integer NOT NULL DEFAULT 0, revoked_at timestamptz,
        last_refreshed_at timestamptz
      )`);
    await queryRunner.query(
      `CREATE INDEX idx_auth_sessions_user_app ON auth.sessions(user_id, application_id)`,
    );
    await queryRunner.query(
      `CREATE TABLE auth.verifications (id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(`
      CREATE TABLE identity.user_configs (
        id uuid PRIMARY KEY, user_id text NOT NULL UNIQUE REFERENCES identity.users(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'active', is_banned boolean NOT NULL DEFAULT false,
        ban_expires_at timestamptz, is_superadmin boolean NOT NULL DEFAULT false,
        can_create_users boolean NOT NULL DEFAULT false, session_limit_override integer,
        creation_source text NOT NULL DEFAULT 'public_registration', created_by_user_id text,
        created_by_application_id uuid, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`
      CREATE TABLE apps.applications (
        id uuid PRIMARY KEY, slug citext NOT NULL UNIQUE, name text NOT NULL,
        client_type text NOT NULL, status text NOT NULL DEFAULT 'active',
        policy jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(
      `ALTER TABLE auth.sessions ADD CONSTRAINT fk_auth_sessions_application FOREIGN KEY (application_id) REFERENCES apps.applications(id)`,
    );
    await queryRunner.query(`
      CREATE TABLE identity.user_application_access (
        id uuid PRIMARY KEY, user_id text NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
        application_id uuid NOT NULL REFERENCES apps.applications(id) ON DELETE CASCADE,
        status text NOT NULL DEFAULT 'active', grant_source text NOT NULL DEFAULT 'operator', granted_by_user_id text,
        granted_at timestamptz NOT NULL DEFAULT now(), revoked_at timestamptz,
        UNIQUE(user_id, application_id)
      )`);
    await queryRunner.query(
      `CREATE TABLE system.settings (id uuid PRIMARY KEY, application_id uuid REFERENCES apps.applications(id) ON DELETE CASCADE, key text NOT NULL, value jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_settings_global ON system.settings(key) WHERE application_id IS NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX uq_settings_application ON system.settings(application_id, key) WHERE application_id IS NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TABLE system.bootstrap_runs (id uuid PRIMARY KEY, run_key text NOT NULL UNIQUE, completed_at timestamptz NOT NULL DEFAULT now(), result_metadata jsonb NOT NULL DEFAULT '{}'::jsonb)`,
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SCHEMA IF EXISTS auth CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS system CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS apps CASCADE`);
    await queryRunner.query(`DROP SCHEMA IF EXISTS identity CASCADE`);
  }
}
