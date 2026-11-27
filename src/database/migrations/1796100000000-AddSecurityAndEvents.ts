import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSecurityAndEvents1796100000000 implements MigrationInterface {
  name = 'AddSecurityAndEvents1796100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE system.policy_definitions SET availability = 'available';
      UPDATE system.policy_definitions SET scope = 'both'
        WHERE key IN ('risk.lockout_threshold', 'risk.lockout_duration_minutes');
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'mfa.methods', value FROM jsonb_array_elements('["totp","sms","email_otp","webauthn_passkey","any"]') value
      ON CONFLICT DO NOTHING;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'mfa.grace_period_days', value FROM jsonb_array_elements('[3,7,14,30]') value ON CONFLICT DO NOTHING;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'mfa.remember_device_days', value FROM jsonb_array_elements('[0,7,30,90]') value ON CONFLICT DO NOTHING;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'step_up.auth', value FROM jsonb_array_elements('["off","admin_actions","billing_and_security","always"]') value ON CONFLICT DO NOTHING;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'session.ip_binding', value FROM jsonb_array_elements('["off","warn_on_change","strict_revoke"]') value ON CONFLICT DO NOTHING;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'risk.lockout_threshold', value FROM jsonb_array_elements('[0,3,5,10]') value ON CONFLICT DO NOTHING;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'risk.lockout_duration_minutes', value FROM jsonb_array_elements('["5","15","60","until_admin_unlock"]') value ON CONFLICT DO NOTHING;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'risk.captcha_mode', value FROM jsonb_array_elements('["off","after_failed_attempts","suspicious_ip","always"]') value ON CONFLICT DO NOTHING;
      INSERT INTO system.policy_allowed_values(policy_key,value)
      SELECT 'risk.new_device_alert', value FROM jsonb_array_elements('["off","notify_email","require_mfa","block"]') value ON CONFLICT DO NOTHING;
      DROP TRIGGER IF EXISTS trg_validate_global_policy ON system.settings;
      DROP TRIGGER IF EXISTS trg_validate_app_policy ON apps.application_policy_entries;
      CREATE OR REPLACE FUNCTION system.validate_policy_value() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE definition system.policy_definitions; actual_type text;
      BEGIN
        SELECT * INTO definition FROM system.policy_definitions WHERE key = NEW.key;
        IF NOT FOUND THEN RETURN NEW; END IF;
        IF TG_TABLE_SCHEMA = 'apps' AND definition.scope = 'deployment' THEN
          RAISE EXCEPTION 'Policy % is deployment-only', NEW.key;
        END IF;
        actual_type := jsonb_typeof(NEW.value);
        IF definition.value_type = 'string_set' THEN
          IF actual_type <> 'array' OR EXISTS (
            SELECT 1 FROM jsonb_array_elements(NEW.value) item
            WHERE jsonb_typeof(item) <> 'string' OR NOT EXISTS (
              SELECT 1 FROM system.policy_allowed_values allowed
              WHERE allowed.policy_key = NEW.key AND allowed.value = item)) THEN
            RAISE EXCEPTION 'Invalid members for policy %', NEW.key;
          END IF;
          actual_type := 'string_set';
        END IF;
        IF actual_type <> definition.value_type THEN RAISE EXCEPTION 'Invalid type for policy %', NEW.key; END IF;
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
    await queryRunner.query(`CREATE SCHEMA security; CREATE SCHEMA events`);
    await queryRunner.query(`
      CREATE TABLE security.audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid,
        actor_user_id text, target_user_id text, action text NOT NULL,
        outcome text NOT NULL CHECK (outcome IN ('success','denied')),
        changes jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_audit_app_time ON security.audit_logs(application_id, created_at DESC);
      CREATE INDEX idx_audit_actor_time ON security.audit_logs(actor_user_id, created_at DESC);
      CREATE INDEX idx_audit_target_time ON security.audit_logs(target_user_id, created_at DESC);
      CREATE FUNCTION security.reject_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'Audit log rows are append-only'; END $$;
      CREATE TRIGGER trg_audit_append_only BEFORE UPDATE OR DELETE ON security.audit_logs
        FOR EACH ROW EXECUTE FUNCTION security.reject_audit_mutation();
      CREATE TABLE security.security_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid,
        user_id text, event_type text NOT NULL, severity text NOT NULL DEFAULT 'info',
        details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_security_events_app_time ON security.security_events(application_id, created_at DESC);
      CREATE TABLE security.login_attempts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL,
        subject_hash bytea NOT NULL, user_id text, ip_address inet,
        succeeded boolean NOT NULL, attempted_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_login_attempt_subject_time ON security.login_attempts(application_id, subject_hash, attempted_at DESC);
      CREATE TABLE security.account_lockouts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL,
        subject_hash bytea NOT NULL, user_id text, failed_attempts integer NOT NULL,
        locked_until timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        unlocked_at timestamptz, unlocked_by_user_id text
      );
      CREATE INDEX idx_account_lockout_active ON security.account_lockouts(application_id, subject_hash, locked_until) WHERE unlocked_at IS NULL;
      CREATE TABLE security.ip_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL,
        operation text NOT NULL CHECK (operation IN ('login','registration')),
        effect text NOT NULL CHECK (effect IN ('allow','deny')), network cidr NOT NULL,
        expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX idx_ip_rules_app_operation ON security.ip_rules(application_id, operation);
      CREATE TABLE security.email_domain_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL,
        effect text NOT NULL CHECK (effect IN ('allow','deny')), domain text NOT NULL,
        expires_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(application_id, effect, domain)
      );
      CREATE TABLE security.user_devices (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL,
        user_id text NOT NULL, device_hash bytea NOT NULL, first_seen_at timestamptz NOT NULL DEFAULT now(),
        last_seen_at timestamptz NOT NULL DEFAULT now(), UNIQUE(application_id,user_id,device_hash),
        UNIQUE(application_id,id)
      );
      ALTER TABLE auth.sessions ADD COLUMN device_id uuid;
      ALTER TABLE auth.sessions ADD CONSTRAINT fk_sessions_device_app FOREIGN KEY(application_id,device_id)
        REFERENCES security.user_devices(application_id,id);
    `);
    await queryRunner.query(`
      CREATE TABLE events.event_catalog (
        name text PRIMARY KEY,
        description text NOT NULL,
        payload_fields text[] NOT NULL
      );
      INSERT INTO events.event_catalog(name, description, payload_fields) VALUES
        ('user.created', 'A user account and its initial app access grant were created.', ARRAY['userId','source']),
        ('user.app_access.granted', 'App access was granted or restored for a user.', ARRAY['userId','source']),
        ('user.app_access.revoked', 'A user app access grant was revoked.', ARRAY['userId']),
        ('session.created', 'A session was created after a successful login.', ARRAY['sessionId','userId']),
        ('session.revoked', 'A session was revoked.', ARRAY['sessionId','userId','reason']);
      CREATE TABLE events.domain_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL,
        event_type text NOT NULL, schema_version integer NOT NULL DEFAULT 1,
        aggregate_type text NOT NULL, aggregate_id text NOT NULL,
        payload jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(application_id, id)
      );
      CREATE INDEX idx_domain_events_app_time ON events.domain_events(application_id, created_at);
      CREATE TABLE events.webhook_endpoints (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL,
        endpoint_key text NOT NULL, url text NOT NULL, event_types text[] NOT NULL,
        secret_reference text NOT NULL, is_active boolean NOT NULL DEFAULT true,
        created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE(application_id, endpoint_key), UNIQUE(application_id,id)
      );
      CREATE FUNCTION events.validate_webhook_event_types() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM unnest(NEW.event_types) AS item(name)
          WHERE NOT EXISTS (SELECT 1 FROM events.event_catalog c WHERE c.name = item.name)
        ) THEN
          RAISE EXCEPTION 'Webhook endpoint contains an unsupported event type';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_validate_webhook_event_types
        BEFORE INSERT OR UPDATE OF event_types ON events.webhook_endpoints
        FOR EACH ROW EXECUTE FUNCTION events.validate_webhook_event_types();
      CREATE TABLE events.webhook_deliveries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), application_id uuid NOT NULL,
        endpoint_id uuid NOT NULL, event_id uuid NOT NULL,
        status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','failed','dead')),
        attempt_count integer NOT NULL DEFAULT 0, next_attempt_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(endpoint_id,event_id),
        FOREIGN KEY(application_id,endpoint_id) REFERENCES events.webhook_endpoints(application_id,id),
        FOREIGN KEY(application_id,event_id) REFERENCES events.domain_events(application_id,id)
      );
      CREATE INDEX idx_webhook_delivery_pending ON events.webhook_deliveries(status,next_attempt_at) WHERE status IN ('pending','failed');
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE auth.sessions DROP CONSTRAINT fk_sessions_device_app; ALTER TABLE auth.sessions DROP COLUMN device_id;
      DROP SCHEMA events CASCADE; DROP SCHEMA security CASCADE;
      DROP TRIGGER IF EXISTS trg_validate_global_policy ON system.settings;
      DROP TRIGGER IF EXISTS trg_validate_app_policy ON apps.application_policy_entries;
      CREATE FUNCTION system.validate_policy_value() RETURNS trigger LANGUAGE plpgsql AS $$
      DECLARE definition system.policy_definitions; actual_type text;
      BEGIN
        SELECT * INTO definition FROM system.policy_definitions WHERE key = NEW.key;
        IF NOT FOUND THEN RETURN NEW; END IF;
        IF TG_TABLE_SCHEMA = 'apps' AND definition.scope = 'deployment' THEN RAISE EXCEPTION 'Policy % is deployment-only', NEW.key; END IF;
        actual_type := jsonb_typeof(NEW.value);
        IF definition.value_type = 'string_set' AND actual_type = 'array' THEN actual_type := 'string_set'; END IF;
        IF actual_type <> definition.value_type THEN RAISE EXCEPTION 'Invalid type for policy %', NEW.key; END IF;
        IF EXISTS (SELECT 1 FROM system.policy_allowed_values WHERE policy_key=NEW.key) AND definition.value_type <> 'string_set'
          AND NOT EXISTS (SELECT 1 FROM system.policy_allowed_values WHERE policy_key=NEW.key AND value=NEW.value) THEN RAISE EXCEPTION 'Unsupported value for policy %', NEW.key; END IF;
        IF definition.availability='unavailable' AND NEW.value<>definition.default_value THEN RAISE EXCEPTION 'Policy % unavailable', NEW.key; END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER trg_validate_global_policy BEFORE INSERT OR UPDATE ON system.settings FOR EACH ROW EXECUTE FUNCTION system.validate_policy_value();
      CREATE TRIGGER trg_validate_app_policy BEFORE INSERT OR UPDATE ON apps.application_policy_entries FOR EACH ROW EXECUTE FUNCTION system.validate_policy_value();
      UPDATE system.policy_definitions SET availability='unavailable' WHERE key IN ('mfa.methods','mfa.grace_period_days','mfa.remember_device_days','step_up.auth','session.ip_binding','risk.lockout_threshold','risk.lockout_duration_minutes','risk.captcha_mode','risk.new_device_alert');
      UPDATE system.policy_definitions SET scope='deployment' WHERE key IN ('risk.lockout_threshold','risk.lockout_duration_minutes');`);
  }
}
