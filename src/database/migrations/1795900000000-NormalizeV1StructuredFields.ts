import { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizeV1StructuredFields1795900000000
  implements MigrationInterface
{
  name = 'NormalizeV1StructuredFields1795900000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE item record;
      BEGIN
        FOR item IN SELECT id, policy FROM apps.applications
        LOOP
          IF jsonb_typeof(item.policy) IS DISTINCT FROM 'object' THEN
            RAISE EXCEPTION 'Cannot normalize policy for app % because its policy is not a JSON object', item.id;
          END IF;
        END LOOP;
        FOR item IN
          SELECT c.id
          FROM apps.application_credentials c
          CROSS JOIN LATERAL unnest(c.scopes) AS scopes(scope)
          WHERE scopes.scope IS NULL
          LIMIT 1
        LOOP
          RAISE EXCEPTION 'Cannot normalize scopes for credential % because a scope is null', item.id;
        END LOOP;
        FOR item IN SELECT id, result_metadata FROM system.bootstrap_runs
        LOOP
          IF jsonb_typeof(item.result_metadata) IS DISTINCT FROM 'object' THEN
            RAISE EXCEPTION 'Cannot normalize bootstrap result metadata for run % because it contains unsupported values', item.id;
          END IF;
          IF item.result_metadata - 'apps' - 'users' <> '{}'::jsonb THEN
            RAISE EXCEPTION 'Cannot normalize bootstrap result metadata for run % because it contains unsupported fields', item.id;
          END IF;
          IF item.result_metadata ? 'apps' THEN
            IF jsonb_typeof(item.result_metadata->'apps') IS DISTINCT FROM 'number' THEN
              RAISE EXCEPTION 'Cannot normalize bootstrap result metadata for run % because apps is not an integer', item.id;
            END IF;
            IF (item.result_metadata->>'apps')::numeric < 0
              OR (item.result_metadata->>'apps')::numeric > 2147483647
              OR (item.result_metadata->>'apps')::numeric <> trunc((item.result_metadata->>'apps')::numeric) THEN
              RAISE EXCEPTION 'Cannot normalize bootstrap result metadata for run % because apps is outside the integer count range', item.id;
            END IF;
          END IF;
          IF item.result_metadata ? 'users' THEN
            IF jsonb_typeof(item.result_metadata->'users') IS DISTINCT FROM 'number' THEN
              RAISE EXCEPTION 'Cannot normalize bootstrap result metadata for run % because users is not an integer', item.id;
            END IF;
            IF (item.result_metadata->>'users')::numeric < 0
              OR (item.result_metadata->>'users')::numeric > 2147483647
              OR (item.result_metadata->>'users')::numeric <> trunc((item.result_metadata->>'users')::numeric) THEN
              RAISE EXCEPTION 'Cannot normalize bootstrap result metadata for run % because users is outside the integer count range', item.id;
            END IF;
          END IF;
        END LOOP;
      END $$
    `);
    await queryRunner.query(`
      CREATE TABLE apps.application_credential_scopes (
        credential_id text NOT NULL REFERENCES apps.application_credentials(id) ON DELETE CASCADE,
        scope text NOT NULL,
        PRIMARY KEY (credential_id, scope)
      )
    `);
    await queryRunner.query(`
      INSERT INTO apps.application_credential_scopes(credential_id, scope)
      SELECT DISTINCT c.id, scopes.scope
      FROM apps.application_credentials c
      CROSS JOIN LATERAL unnest(c.scopes) AS scopes(scope)
    `);
    await queryRunner.query(`
      CREATE TABLE apps.application_policy_entries (
        application_id uuid NOT NULL,
        key text NOT NULL,
        value jsonb NOT NULL,
        CONSTRAINT fk_application_policy_app FOREIGN KEY (application_id)
          REFERENCES apps.applications(id) DEFERRABLE INITIALLY DEFERRED,
        PRIMARY KEY (application_id, key)
      )
    `);
    await queryRunner.query(`
      INSERT INTO apps.application_policy_entries(application_id, key, value)
      SELECT a.id, entry.key, entry.value
      FROM apps.applications a
      CROSS JOIN LATERAL jsonb_each(a.policy) AS entry
    `);
    await queryRunner.query(`
      CREATE FUNCTION apps.reject_application_policy_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF EXISTS (SELECT 1 FROM apps.applications WHERE id = NEW.application_id) THEN
            RAISE EXCEPTION 'Policy entries must be inserted before their application';
          END IF;
          RETURN NEW;
        END IF;
        RAISE EXCEPTION 'Application policy entries are immutable';
      END $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_application_policy_immutable
      BEFORE INSERT OR UPDATE OR DELETE ON apps.application_policy_entries
      FOR EACH ROW EXECUTE FUNCTION apps.reject_application_policy_mutation()
    `);
    await queryRunner.query(`ALTER TABLE apps.applications DROP COLUMN policy`);
    await queryRunner.query(`
      ALTER TABLE system.bootstrap_runs
        ADD COLUMN apps_count integer,
        ADD COLUMN users_count integer
    `);
    await queryRunner.query(`
      UPDATE system.bootstrap_runs
      SET apps_count = CASE WHEN result_metadata ? 'apps' THEN (result_metadata->>'apps')::integer END,
          users_count = CASE WHEN result_metadata ? 'users' THEN (result_metadata->>'users')::integer END
    `);
    await queryRunner.query(`ALTER TABLE system.bootstrap_runs DROP COLUMN result_metadata`);
    await queryRunner.query(`ALTER TABLE apps.application_credentials DROP COLUMN scopes`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE apps.application_credentials ADD COLUMN scopes text[] NOT NULL DEFAULT '{}'`);
    await queryRunner.query(`
      UPDATE apps.application_credentials c
      SET scopes = COALESCE((SELECT array_agg(s.scope ORDER BY s.scope)
        FROM apps.application_credential_scopes s WHERE s.credential_id = c.id), '{}')
    `);
    await queryRunner.query(`ALTER TABLE system.bootstrap_runs ADD COLUMN result_metadata jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await queryRunner.query(`
      UPDATE system.bootstrap_runs
      SET result_metadata = jsonb_strip_nulls(jsonb_build_object('apps', apps_count, 'users', users_count))
    `);
    await queryRunner.query(`ALTER TABLE system.bootstrap_runs DROP COLUMN apps_count, DROP COLUMN users_count`);
    await queryRunner.query(`ALTER TABLE apps.applications ADD COLUMN policy jsonb NOT NULL DEFAULT '{}'::jsonb`);
    await queryRunner.query(`ALTER TABLE apps.applications DISABLE TRIGGER trg_applications_append_only`);
    await queryRunner.query(`
      UPDATE apps.applications a
      SET policy = COALESCE((SELECT jsonb_object_agg(e.key, e.value)
        FROM apps.application_policy_entries e WHERE e.application_id = a.id), '{}'::jsonb)
    `);
    await queryRunner.query(`ALTER TABLE apps.applications ENABLE TRIGGER trg_applications_append_only`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_application_policy_immutable ON apps.application_policy_entries`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS apps.reject_application_policy_mutation()`);
    await queryRunner.query(`DROP TABLE IF EXISTS apps.application_policy_entries`);
    await queryRunner.query(`DROP TABLE IF EXISTS apps.application_credential_scopes`);
  }
}
