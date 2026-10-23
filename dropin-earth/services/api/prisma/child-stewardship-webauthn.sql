-- Isolated synthetic WebAuthn verification. No production identity enrollment.
-- Apply with a migration identity; application runtime must not own this schema.
BEGIN;
CREATE SCHEMA IF NOT EXISTS child_stewardship_webauthn;
REVOKE ALL ON SCHEMA child_stewardship_webauthn FROM PUBLIC;
-- Provisioned only by the migration owner, never by an application request.
-- The verifier credential belongs to the isolated verification service; ordinary
-- runtime credentials must not be members of or able to SET ROLE to this role.
CREATE TABLE IF NOT EXISTS child_stewardship_webauthn.verifier_roles (
  database_role name PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS child_stewardship_webauthn.sandboxes (
  id uuid PRIMARY KEY,
  subject text NOT NULL DEFAULT 'demo-guardian' CHECK (subject='demo-guardian'),
  rp_id text NOT NULL DEFAULT 'webauthn.synthetic.invalid' CHECK (rp_id='webauthn.synthetic.invalid'),
  origin text NOT NULL DEFAULT 'https://webauthn.synthetic.invalid' CHECK (origin='https://webauthn.synthetic.invalid'),
  user_handle text NOT NULL CHECK (user_handle ~ '^[A-Za-z0-9_-]{43}$'),
  fixture_key_digest text NOT NULL CHECK (fixture_key_digest ~ '^[a-f0-9]{64}$'),
  fixture_credential_id text NOT NULL CHECK (length(fixture_credential_id) BETWEEN 16 AND 512 AND fixture_credential_id ~ '^[A-Za-z0-9_-]+$'),
  capability_hash text NOT NULL CHECK (capability_hash ~ '^[a-f0-9]{64}$'),
  epoch bigint NOT NULL DEFAULT 1 CHECK (epoch>0),
  revoked boolean NOT NULL DEFAULT false,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS child_stewardship_webauthn.ceremonies (
  id uuid PRIMARY KEY,
  sandbox_id uuid NOT NULL REFERENCES child_stewardship_webauthn.sandboxes(id),
  kind text NOT NULL CHECK (kind IN ('registration','authentication')),
  challenge text NOT NULL UNIQUE CHECK (challenge ~ '^[A-Za-z0-9_-]{43}$'),
  epoch bigint NOT NULL CHECK (epoch>0),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  CHECK (expires_at>issued_at AND expires_at<=issued_at+interval '5 minutes'),
  CHECK (consumed_at IS NULL OR consumed_at>=issued_at),
  UNIQUE (sandbox_id,id)
);
CREATE TABLE IF NOT EXISTS child_stewardship_webauthn.credentials (
  sandbox_id uuid PRIMARY KEY REFERENCES child_stewardship_webauthn.sandboxes(id),
  credential_id text NOT NULL UNIQUE CHECK (length(credential_id) BETWEEN 16 AND 512 AND credential_id ~ '^[A-Za-z0-9_-]+$'),
  public_key bytea NOT NULL CHECK (octet_length(public_key) BETWEEN 32 AND 1024),
  counter bigint NOT NULL CHECK (counter BETWEEN 0 AND 4294967295),
  epoch bigint NOT NULL CHECK (epoch>0),
  revoked boolean NOT NULL DEFAULT false,
  device_type text NOT NULL CHECK (device_type IN ('singleDevice','multiDevice')),
  backed_up boolean NOT NULL,
  created_at timestamptz NOT NULL,
  UNIQUE (sandbox_id,credential_id)
);
CREATE TABLE IF NOT EXISTS child_stewardship_webauthn.sessions (
  id uuid PRIMARY KEY,
  sandbox_id uuid NOT NULL REFERENCES child_stewardship_webauthn.sandboxes(id),
  credential_id text NOT NULL,
  token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  epoch bigint NOT NULL CHECK (epoch>0),
  created_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  revoked boolean NOT NULL DEFAULT false,
  CHECK (expires_at>created_at AND expires_at<=created_at+interval '15 minutes'),
  FOREIGN KEY (sandbox_id,credential_id) REFERENCES child_stewardship_webauthn.credentials(sandbox_id,credential_id)
);
CREATE TABLE IF NOT EXISTS child_stewardship_webauthn.audit (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sandbox_id uuid NOT NULL REFERENCES child_stewardship_webauthn.sandboxes(id),
  ceremony_id uuid,
  action text NOT NULL CHECK (action IN ('registration','authentication','revocation')),
  outcome text NOT NULL CHECK (outcome IN ('accepted','rejected')),
  code text NOT NULL CHECK (code ~ '^[A-Z_]{3,60}$'),
  recorded_at timestamptz NOT NULL,
  FOREIGN KEY (sandbox_id,ceremony_id) REFERENCES child_stewardship_webauthn.ceremonies(sandbox_id,id)
);
-- Reapplicable validation for an existing local fixture schema.
ALTER TABLE child_stewardship_webauthn.sandboxes DROP CONSTRAINT IF EXISTS sandboxes_fixture_credential_id_check;
ALTER TABLE child_stewardship_webauthn.sandboxes ADD CONSTRAINT sandboxes_fixture_credential_id_check
  CHECK (length(fixture_credential_id) BETWEEN 16 AND 512 AND fixture_credential_id ~ '^[A-Za-z0-9_-]+$');
ALTER TABLE child_stewardship_webauthn.credentials DROP CONSTRAINT IF EXISTS credentials_credential_id_check;
ALTER TABLE child_stewardship_webauthn.credentials ADD CONSTRAINT credentials_credential_id_check
  CHECK (length(credential_id) BETWEEN 16 AND 512 AND credential_id ~ '^[A-Za-z0-9_-]+$');
CREATE OR REPLACE FUNCTION child_stewardship_webauthn.guard_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE binding child_stewardship_webauthn.sandboxes%ROWTYPE; is_verifier boolean;
BEGIN
  IF TG_TABLE_NAME='verifier_roles' THEN
    IF NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      JOIN pg_roles r ON r.oid=c.relowner WHERE n.nspname='child_stewardship_webauthn'
      AND c.relname='verifier_roles' AND r.rolname=current_user) THEN
      RAISE EXCEPTION 'WEBAUTHN_VERIFIER_PROVISIONING_DENIED';
    END IF;
    IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'WEBAUTHN_DELETION_REQUIRES_RETENTION_PROCESS'; END IF;
  SELECT EXISTS(SELECT 1 FROM child_stewardship_webauthn.verifier_roles
    WHERE database_role=current_user AND enabled AND expires_at>clock_timestamp()) INTO is_verifier;
  IF TG_OP='INSERT' AND TG_TABLE_NAME IN ('credentials','sessions') AND NOT is_verifier THEN
    RAISE EXCEPTION 'WEBAUTHN_VERIFIER_ADMISSION_REQUIRED';
  END IF;
  IF TG_TABLE_NAME='credentials' AND TG_OP='UPDATE' THEN
    IF NEW.counter<>OLD.counter AND NOT is_verifier THEN
      RAISE EXCEPTION 'WEBAUTHN_VERIFIER_ADMISSION_REQUIRED';
    END IF;
  END IF;
  IF TG_TABLE_NAME='audit' AND TG_OP='INSERT' THEN
    IF NEW.action IN ('registration','authentication') AND NEW.outcome='accepted' AND NOT is_verifier THEN
      RAISE EXCEPTION 'WEBAUTHN_VERIFIER_ADMISSION_REQUIRED';
    END IF;
  END IF;
  IF TG_TABLE_NAME='audit' AND TG_OP<>'INSERT' THEN RAISE EXCEPTION 'WEBAUTHN_AUDIT_IMMUTABLE'; END IF;
  IF TG_TABLE_NAME='sandboxes' AND TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['epoch','revoked']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['epoch','revoked'])
      OR NEW.epoch<OLD.epoch OR OLD.revoked AND NOT NEW.revoked THEN
      RAISE EXCEPTION 'WEBAUTHN_BINDING_IMMUTABLE';
    END IF;
  ELSIF TG_TABLE_NAME='ceremonies' AND TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'consumed_at') IS DISTINCT FROM (to_jsonb(OLD)-'consumed_at')
      OR OLD.consumed_at IS NOT NULL OR NEW.consumed_at IS NULL THEN
      RAISE EXCEPTION 'WEBAUTHN_CHALLENGE_IMMUTABLE';
    END IF;
  ELSIF TG_TABLE_NAME='credentials' THEN
    SELECT * INTO binding FROM child_stewardship_webauthn.sandboxes WHERE id=NEW.sandbox_id;
    IF NOT FOUND OR NEW.credential_id<>binding.fixture_credential_id
      OR encode(sha256(NEW.public_key),'hex')<>binding.fixture_key_digest THEN
      RAISE EXCEPTION 'WEBAUTHN_SYNTHETIC_FIXTURE_REQUIRED';
    END IF;
    IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-ARRAY['counter','revoked']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['counter','revoked'])
      OR NEW.counter<OLD.counter OR OLD.revoked AND NOT NEW.revoked) THEN
      RAISE EXCEPTION 'WEBAUTHN_CREDENTIAL_IMMUTABLE';
    END IF;
  ELSIF TG_TABLE_NAME='sessions' AND TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-'revoked') IS DISTINCT FROM (to_jsonb(OLD)-'revoked') OR OLD.revoked AND NOT NEW.revoked THEN
      RAISE EXCEPTION 'WEBAUTHN_SESSION_IMMUTABLE';
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS webauthn_verifier_guard ON child_stewardship_webauthn.verifier_roles;
CREATE TRIGGER webauthn_verifier_guard BEFORE INSERT OR UPDATE OR DELETE
  ON child_stewardship_webauthn.verifier_roles FOR EACH ROW
  EXECUTE FUNCTION child_stewardship_webauthn.guard_mutation();
DO $$ DECLARE name text; BEGIN
  FOREACH name IN ARRAY ARRAY['sandboxes','ceremonies','credentials','sessions','audit'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS webauthn_guard ON child_stewardship_webauthn.%I',name);
    EXECUTE format('CREATE TRIGGER webauthn_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship_webauthn.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship_webauthn.guard_mutation()',name);
    EXECUTE format('ALTER TABLE child_stewardship_webauthn.%I ENABLE ROW LEVEL SECURITY',name);
    EXECUTE format('ALTER TABLE child_stewardship_webauthn.%I FORCE ROW LEVEL SECURITY',name);
    EXECUTE format('DROP POLICY IF EXISTS synthetic_scope ON child_stewardship_webauthn.%I',name);
    EXECUTE format('CREATE POLICY synthetic_scope ON child_stewardship_webauthn.%I USING (%I::text=current_setting(''app.webauthn_sandbox'',true)) WITH CHECK (%I::text=current_setting(''app.webauthn_sandbox'',true))',name,
      CASE WHEN name='sandboxes' THEN 'id' ELSE 'sandbox_id' END,CASE WHEN name='sandboxes' THEN 'id' ELSE 'sandbox_id' END);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship_webauthn FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA child_stewardship_webauthn FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship_webauthn FROM PUBLIC;
COMMIT;
