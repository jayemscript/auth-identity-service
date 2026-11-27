import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChallenges1796200000000 implements MigrationInterface {
  name = 'AddChallenges1796200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE SCHEMA challenges;
      CREATE TABLE challenges.catalog (
        type text PRIMARY KEY,
        default_expiry_seconds integer,
        max_attempts integer NOT NULL CHECK (max_attempts >= 0),
        delivery_channel text NOT NULL,
        template_key text NOT NULL
      );
      INSERT INTO challenges.catalog(type, default_expiry_seconds, max_attempts, delivery_channel, template_key) VALUES
        ('password-reset',900,5,'email','password-reset'),
        ('forgotten-credentials',900,5,'email','forgotten-credentials'),
        ('email-verification',900,5,'email','email-verification'),
        ('otp-verification',300,5,'email','otp-verification'),
        ('security-alert',NULL,0,'email','security-alert'),
        ('invitation',86400,5,'email','invitation'),
        ('magic-link',900,5,'email','magic-link'),
        ('mfa',300,5,'email','mfa');
      CREATE TABLE challenges.instances (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL REFERENCES apps.applications(id),
        challenge_type text NOT NULL REFERENCES challenges.catalog(type), subject_ref text NOT NULL,
        proof_digest char(64), status text NOT NULL CHECK(status IN ('pending','verified','consumed','expired','exhausted','revoked')),
        expires_at timestamptz, max_attempts integer NOT NULL, failed_attempts integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(application_id,id)
      );
      CREATE INDEX idx_challenges_subject ON challenges.instances(application_id,challenge_type,subject_ref,created_at DESC);
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP SCHEMA challenges CASCADE');
  }
}
