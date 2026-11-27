import { MigrationInterface, QueryRunner } from 'typeorm';

export class AppCredentialsAndJwks1795824000000 implements MigrationInterface {
  name = 'AppCredentialsAndJwks1795824000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE auth.jwks (
        id text PRIMARY KEY,
        public_key text NOT NULL,
        private_key text NOT NULL,
        alg text,
        crv text,
        created_at timestamptz NOT NULL DEFAULT now(),
        expires_at timestamptz
      )
    `);
    await queryRunner.query(`
      CREATE TABLE apps.application_credentials (
        id text PRIMARY KEY,
        application_id uuid NOT NULL REFERENCES apps.applications(id),
        name text NOT NULL,
        secret_hash char(64) NOT NULL,
        scopes text[] NOT NULL DEFAULT '{}',
        expires_at timestamptz,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_application_credentials_app ON apps.application_credentials(application_id) WHERE revoked_at IS NULL`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS apps.application_credentials`);
    await queryRunner.query(`DROP TABLE IF EXISTS auth.jwks`);
  }
}
