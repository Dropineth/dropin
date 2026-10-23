-- Additive synthetic-only authority. Apply manually only to an approved database.
-- Real-child and real-value capability is intentionally absent.
BEGIN;
CREATE SCHEMA IF NOT EXISTS child_stewardship;
CREATE TABLE IF NOT EXISTS child_stewardship.sessions (
  id uuid PRIMARY KEY,
  mode text NOT NULL CHECK (mode = 'synthetic-demo'),
  expires_at timestamptz NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 0),
  snapshot jsonb NOT NULL CHECK (snapshot->'learning'->>'mode' = 'synthetic-demo')
);
CREATE TABLE IF NOT EXISTS child_stewardship.session_tokens (
  token_hash text PRIMARY KEY CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id) ON DELETE CASCADE,
  actor_id text NOT NULL CHECK (actor_id IN ('demo-guardian','demo-child','demo-reviewer','demo-protector','demo-operator')),
  device_id text NOT NULL,
  epoch integer NOT NULL CHECK (epoch > 0)
);
CREATE TABLE IF NOT EXISTS child_stewardship.receipts (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  idempotency_key text NOT NULL,
  request_digest text NOT NULL,
  result jsonb NOT NULL,
  revision bigint NOT NULL,
  PRIMARY KEY (session_id, actor_id, idempotency_key)
);
CREATE TABLE IF NOT EXISTS child_stewardship.audit (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id) ON DELETE CASCADE,
  event jsonb NOT NULL,
  previous_digest text NOT NULL,
  digest text NOT NULL
);
CREATE TABLE IF NOT EXISTS child_stewardship.outbox (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id) ON DELETE CASCADE,
  event_id text NOT NULL,
  kind text NOT NULL,
  resource_id text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('ordinary','protection')),
  delivered_at timestamptz,
  PRIMARY KEY (session_id,event_id)
);
-- Distinct read projections, never a shared asset/points balance. All remain private.
REVOKE ALL ON SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;

-- v2: normalized records are authoritative; legacy snapshot is never read.
BEGIN;
ALTER TABLE child_stewardship.sessions ALTER COLUMN snapshot DROP NOT NULL;
ALTER TABLE child_stewardship.sessions ADD COLUMN IF NOT EXISTS storage_format text NOT NULL DEFAULT 'uninitialized';
CREATE TABLE IF NOT EXISTS child_stewardship.state_records (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
  domain text NOT NULL CHECK (domain IN ('learning','rights')),
  collection text NOT NULL CHECK (collection ~ '^[a-zA-Z][a-zA-Z0-9]{0,40}$'),
  record_id text NOT NULL CHECK (length(record_id) BETWEEN 1 AND 1024),
  payload jsonb NOT NULL,
  revision bigint NOT NULL CHECK (revision >= 0),
  position integer NOT NULL DEFAULT 0,
  PRIMARY KEY(session_id,domain,collection,record_id)
);
ALTER TABLE child_stewardship.state_records ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
ALTER TABLE child_stewardship.state_records DROP CONSTRAINT IF EXISTS state_records_record_id_check;
ALTER TABLE child_stewardship.state_records ADD CONSTRAINT state_records_record_id_check CHECK (length(record_id) BETWEEN 1 AND 1024);
CREATE TABLE IF NOT EXISTS child_stewardship.state_events (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
  domain text NOT NULL, collection text NOT NULL, record_id text NOT NULL,
  revision bigint NOT NULL, actor_role text NOT NULL, operation text NOT NULL,
  previous_digest text NOT NULL, new_digest text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION child_stewardship.guard_session_metadata() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'CHILD_HISTORY_APPEND_ONLY' USING ERRCODE='42501'; END IF;
  IF (NEW.id,NEW.mode,NEW.expires_at,NEW.storage_format,NEW.snapshot) IS DISTINCT FROM
     (OLD.id,OLD.mode,OLD.expires_at,OLD.storage_format,OLD.snapshot) THEN
    RAISE EXCEPTION 'CHILD_SESSION_IDENTITY_IMMUTABLE' USING ERRCODE='42501';
  END IF;
  IF NEW.revision<>OLD.revision+1 THEN RAISE EXCEPTION 'CHILD_SESSION_REVISION_INVALID' USING ERRCODE='23514'; END IF;
  IF NEW.storage_format='normalized-v2' AND NOT EXISTS(
    SELECT 1 FROM child_stewardship.state_records WHERE session_id=NEW.id AND revision=NEW.revision
      AND xmin::text::numeric=mod(pg_current_xact_id()::text::numeric,4294967296)
  ) THEN RAISE EXCEPTION 'CHILD_SESSION_MUTATION_REQUIRED' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS session_metadata_guard ON child_stewardship.sessions;
CREATE TRIGGER session_metadata_guard BEFORE UPDATE OR DELETE ON child_stewardship.sessions FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_session_metadata();
CREATE OR REPLACE FUNCTION child_stewardship.forbid_history_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'CHILD_HISTORY_APPEND_ONLY' USING ERRCODE='42501'; END $$;
DROP TRIGGER IF EXISTS immutable_state_events ON child_stewardship.state_events;
CREATE TRIGGER immutable_state_events BEFORE UPDATE OR DELETE ON child_stewardship.state_events FOR EACH ROW EXECUTE FUNCTION child_stewardship.forbid_history_change();
DROP TRIGGER IF EXISTS immutable_audit ON child_stewardship.audit;
CREATE TRIGGER immutable_audit BEFORE UPDATE OR DELETE ON child_stewardship.audit FOR EACH ROW EXECUTE FUNCTION child_stewardship.forbid_history_change();
DROP TRIGGER IF EXISTS immutable_receipts ON child_stewardship.receipts;
CREATE TRIGGER immutable_receipts BEFORE UPDATE OR DELETE ON child_stewardship.receipts FOR EACH ROW EXECUTE FUNCTION child_stewardship.forbid_history_change();
CREATE OR REPLACE FUNCTION child_stewardship.guard_state_record() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE role_name text := current_setting('app.child_actor_role',true); operation_name text := current_setting('app.child_operation',true);
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'CHILD_HISTORY_APPEND_ONLY' USING ERRCODE='42501'; END IF;
  IF role_name IS NULL OR role_name NOT IN ('bootstrap','guardian','child','reviewer','protector','operator') THEN RAISE EXCEPTION 'CHILD_ROLE_DENIED' USING ERRCODE='42501'; END IF;
  IF NEW.domain='rights' AND role_name NOT IN ('bootstrap','operator','protector') THEN RAISE EXCEPTION 'CHILD_RIGHTS_ROLE_DENIED' USING ERRCODE='42501'; END IF;
  IF role_name <> 'bootstrap' AND NEW.domain='learning' THEN
    IF NEW.collection IN ('reviews','assessments','contributions') AND role_name NOT IN ('reviewer','protector') THEN RAISE EXCEPTION 'CHILD_REVIEW_ROLE_DENIED' USING ERRCODE='42501'; END IF;
    IF NEW.collection IN ('profiles','guardianLinks') AND role_name NOT IN ('guardian','protector') THEN RAISE EXCEPTION 'CHILD_IDENTITY_ROLE_DENIED' USING ERRCODE='42501'; END IF;
    IF NEW.collection IN ('trees','tasks') AND role_name NOT IN ('operator','protector') THEN RAISE EXCEPTION 'CHILD_PROJECT_ROLE_DENIED' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_OP='UPDATE' THEN
    IF (NEW.session_id,NEW.domain,NEW.collection,NEW.record_id,NEW.position) IS DISTINCT FROM (OLD.session_id,OLD.domain,OLD.collection,OLD.record_id,OLD.position) THEN RAISE EXCEPTION 'CHILD_RECORD_IDENTITY_IMMUTABLE' USING ERRCODE='42501'; END IF;
    IF NEW.revision <= OLD.revision THEN RAISE EXCEPTION 'CHILD_REVISION_ROLLBACK' USING ERRCODE='23514'; END IF;
    IF NEW.domain='learning' AND NEW.collection IN ('contributions','reviews','audit','outbox') AND NEW.payload<>OLD.payload THEN RAISE EXCEPTION 'CHILD_LEDGER_APPEND_ONLY' USING ERRCODE='42501'; END IF;
    IF NEW.domain='rights' AND NEW.collection IN ('audit','consumedNonces','economicKeys','executedOperations') AND NEW.payload<>OLD.payload THEN RAISE EXCEPTION 'CHILD_LEDGER_APPEND_ONLY' USING ERRCODE='42501'; END IF;
  END IF;
  INSERT INTO child_stewardship.state_events(session_id,domain,collection,record_id,revision,actor_role,operation,previous_digest,new_digest)
  VALUES(NEW.session_id,NEW.domain,NEW.collection,NEW.record_id,NEW.revision,role_name,coalesce(operation_name,'unspecified'),
    CASE WHEN TG_OP='INSERT' THEN repeat('0',64) ELSE encode(sha256(convert_to(OLD.payload::text,'UTF8')),'hex') END,
    encode(sha256(convert_to(NEW.payload::text,'UTF8')),'hex'));
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_state_record ON child_stewardship.state_records;
CREATE TRIGGER guard_state_record BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.state_records FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_state_record();
-- Shared trusted service connection sets the tenant context from an opaque token.
-- These policies are exercised using a non-owner/non-BYPASSRLS role in native tests.
DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['sessions','session_tokens','receipts','audit','outbox','state_records','state_events'] LOOP
    EXECUTE format('ALTER TABLE child_stewardship.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('ALTER TABLE child_stewardship.%I FORCE ROW LEVEL SECURITY',relation);
    EXECUTE format('DROP POLICY IF EXISTS child_tenant ON child_stewardship.%I',relation);
    IF relation='sessions' THEN
      EXECUTE format('CREATE POLICY child_tenant ON child_stewardship.%I USING (id::text=current_setting(''app.child_session_id'',true)) WITH CHECK (id::text=current_setting(''app.child_session_id'',true))',relation);
    ELSIF relation='session_tokens' THEN
      EXECUTE format('CREATE POLICY child_tenant ON child_stewardship.%I USING (session_id::text=current_setting(''app.child_session_id'',true) OR token_hash=current_setting(''app.child_token_hash'',true)) WITH CHECK (session_id::text=current_setting(''app.child_session_id'',true))',relation);
    ELSE
      EXECUTE format('CREATE POLICY child_tenant ON child_stewardship.%I USING (session_id::text=current_setting(''app.child_session_id'',true)) WITH CHECK (session_id::text=current_setting(''app.child_session_id'',true))',relation);
    END IF;
  END LOOP;
END $$;
DROP VIEW IF EXISTS child_stewardship.evidence_ledger,child_stewardship.contribution_ledger,child_stewardship.entitlement_ledger,child_stewardship.funding_ledger;
CREATE VIEW child_stewardship.evidence_ledger WITH (security_invoker=true) AS SELECT session_id,record_id,payload FROM child_stewardship.state_records WHERE domain='learning' AND collection='observations';
CREATE VIEW child_stewardship.contribution_ledger WITH (security_invoker=true) AS SELECT session_id,record_id,payload FROM child_stewardship.state_records WHERE domain='learning' AND collection='contributions';
CREATE VIEW child_stewardship.entitlement_ledger WITH (security_invoker=true) AS SELECT session_id,record_id,payload FROM child_stewardship.state_records WHERE domain='rights' AND collection='entitlements';
CREATE VIEW child_stewardship.funding_ledger WITH (security_invoker=true) AS SELECT session_id,record_id,payload FROM child_stewardship.state_records WHERE domain='rights' AND collection='fundingLots';
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
