import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPolicyCatalog1796000000000 implements MigrationInterface {
  name = 'AddPolicyCatalog1796000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE system.policy_definitions (
        key text PRIMARY KEY,
        value_type text NOT NULL CHECK (value_type IN ('string','number','boolean','string_set')),
        scope text NOT NULL CHECK (scope IN ('deployment','application','both')),
        default_value jsonb NOT NULL,
        availability text NOT NULL CHECK (availability IN ('available','unavailable'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE system.policy_allowed_values (
        policy_key text NOT NULL REFERENCES system.policy_definitions(key) ON DELETE CASCADE,
        value jsonb NOT NULL,
        PRIMARY KEY (policy_key, value)
      )
    `);
    await queryRunner.query(`
      INSERT INTO system.policy_definitions(key,value_type,scope,default_value,availability) VALUES
      ('registration.mode','string','both','"disabled"','available'),
      ('account.approval','string','both','"auto_approve"','available'),
      ('auth.methods','string_set','both','["password"]','available'),
      ('mfa.required','boolean','both','false','available'),
      ('mfa.methods','string','both','"any"','unavailable'),
      ('mfa.grace_period_days','number','both','7','unavailable'),
      ('mfa.remember_device_days','number','both','0','unavailable'),
      ('step_up.auth','string','deployment','"off"','unavailable'),
      ('session.max_concurrent','number','both','3','available'),
      ('session.overflow_policy','string','both','"block_new"','available'),
      ('session.idle_timeout_minutes','number','both','10080','available'),
      ('session.ip_binding','string','both','"off"','unavailable'),
      ('token.refresh_rotation','string','deployment','"rotate"','available'),
      ('risk.lockout_threshold','number','deployment','0','unavailable'),
      ('risk.lockout_duration_minutes','string','deployment','"15"','unavailable'),
      ('risk.captcha_mode','string','both','"off"','unavailable'),
      ('risk.new_device_alert','string','both','"off"','unavailable'),
      ('email_verification.required','boolean','both','false','available')
    `);
    await queryRunner.query(`
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'registration.mode', value FROM jsonb_array_elements('["public","operator_only","hybrid","invite_only","disabled"]') value;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'account.approval', value FROM jsonb_array_elements('["auto_approve","email_verification","admin_approval"]') value;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'auth.methods', method.value
      FROM jsonb_array_elements('["password","magic_link","passkey","oauth","any"]'::jsonb) AS method(value);
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'session.overflow_policy', value FROM jsonb_array_elements('["block_new","evict_oldest","evict_least_active"]') value;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'token.refresh_rotation', value FROM jsonb_array_elements('["off","rotate","rotate_with_reuse_detection"]') value;
    `);
    await queryRunner.query(`
      ALTER TABLE apps.application_policy_entries DISABLE TRIGGER trg_application_policy_immutable;
      UPDATE apps.application_policy_entries SET key = CASE key
        WHEN 'registrationMode' THEN 'registration.mode'
        WHEN 'maxConcurrentSessions' THEN 'session.max_concurrent'
        WHEN 'idleTimeoutSeconds' THEN 'session.idle_timeout_minutes'
        WHEN 'emailVerificationRequired' THEN 'email_verification.required'
        ELSE key END;
      UPDATE apps.application_policy_entries SET value = '"hybrid"'::jsonb
        WHERE key = 'registration.mode' AND value = '"public"'::jsonb;
      UPDATE apps.application_policy_entries SET value = to_jsonb((value #>> '{}')::numeric / 60)
        WHERE key = 'session.idle_timeout_minutes';
      ALTER TABLE apps.application_policy_entries ENABLE TRIGGER trg_application_policy_immutable;
      UPDATE system.settings SET value = '"hybrid"'::jsonb
        WHERE key = 'registration.mode' AND value = '"public"'::jsonb;
      UPDATE system.settings SET key = 'session.idle_timeout_minutes', value = to_jsonb((value #>> '{}')::numeric / 60)
        WHERE key = 'session.idle_timeout_seconds';
      INSERT INTO system.settings(id,key,value)
        SELECT gen_random_uuid(), d.key, d.default_value FROM system.policy_definitions d
        WHERE d.scope IN ('deployment','both')
        ON CONFLICT (key) WHERE application_id IS NULL DO NOTHING;
      ALTER TABLE apps.application_policy_entries ADD CONSTRAINT fk_app_policy_key
        FOREIGN KEY (key) REFERENCES system.policy_definitions(key);
      CREATE FUNCTION system.validate_policy_value() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE definition system.policy_definitions; actual_type text;
      BEGIN
        SELECT * INTO definition FROM system.policy_definitions WHERE key = NEW.key;
        IF NOT FOUND THEN RETURN NEW; END IF;
        IF TG_TABLE_SCHEMA = 'apps' AND definition.scope = 'deployment' THEN
          RAISE EXCEPTION 'Policy % is deployment-only', NEW.key;
        END IF;
        actual_type := jsonb_typeof(NEW.value);
        IF definition.value_type = 'string_set' THEN actual_type := CASE WHEN actual_type = 'array' THEN 'string_set' ELSE actual_type END; END IF;
        IF actual_type <> definition.value_type THEN RAISE EXCEPTION 'Invalid type for policy %', NEW.key; END IF;
        IF definition.availability = 'unavailable' AND NEW.value <> definition.default_value THEN
          RAISE EXCEPTION 'Policy % is registered but not available yet', NEW.key;
        END IF;
        IF EXISTS (SELECT 1 FROM system.policy_allowed_values WHERE policy_key = NEW.key)
          AND definition.value_type <> 'string_set'
          AND NOT EXISTS (SELECT 1 FROM system.policy_allowed_values WHERE policy_key = NEW.key AND value = NEW.value) THEN
          RAISE EXCEPTION 'Unsupported value for policy %', NEW.key;
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_validate_global_policy BEFORE INSERT OR UPDATE ON system.settings
        FOR EACH ROW EXECUTE FUNCTION system.validate_policy_value();
      CREATE TRIGGER trg_validate_app_policy BEFORE INSERT OR UPDATE ON apps.application_policy_entries
        FOR EACH ROW EXECUTE FUNCTION system.validate_policy_value();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_validate_global_policy ON system.settings`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS trg_validate_app_policy ON apps.application_policy_entries`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS system.validate_policy_value()`);
    await queryRunner.query(`ALTER TABLE apps.application_policy_entries DROP CONSTRAINT IF EXISTS fk_app_policy_key`);
    await queryRunner.query(`DELETE FROM system.settings WHERE key IN (SELECT key FROM system.policy_definitions) AND key <> 'administration.app_slug'`);
    await queryRunner.query(`ALTER TABLE apps.application_policy_entries DISABLE TRIGGER trg_application_policy_immutable`);
    await queryRunner.query(`UPDATE apps.application_policy_entries SET key = CASE key
      WHEN 'registration.mode' THEN 'registrationMode'
      WHEN 'session.max_concurrent' THEN 'maxConcurrentSessions'
      WHEN 'session.idle_timeout_minutes' THEN 'idleTimeoutSeconds'
      WHEN 'email_verification.required' THEN 'emailVerificationRequired'
      ELSE key END`);
    await queryRunner.query(`UPDATE apps.application_policy_entries SET value = to_jsonb((value #>> '{}')::numeric * 60)
      WHERE key = 'idleTimeoutSeconds'`);
    await queryRunner.query(`ALTER TABLE apps.application_policy_entries ENABLE TRIGGER trg_application_policy_immutable`);
    await queryRunner.query(`UPDATE system.settings SET key = 'session.idle_timeout_seconds', value = to_jsonb((value #>> '{}')::numeric * 60)
      WHERE key = 'session.idle_timeout_minutes'`);
    await queryRunner.query(`DROP TABLE system.policy_allowed_values`);
    await queryRunner.query(`DROP TABLE system.policy_definitions`);
  }
}
