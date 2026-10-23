-- Synthetic-only canonical authority, applied AFTER child-stewardship.sql.
-- No role grants, production credentials, institutional approvals, or real-value capability.
-- The application must use a non-owner, non-BYPASSRLS role. A DBA can disable triggers;
-- external institutional verification and independent checkpoints remain separate release gates.
BEGIN;
-- Empty at installation. Approved deployment administrators must explicitly bind existing
-- non-owner service roles; this migration never creates roles or grants permissions.
CREATE TABLE IF NOT EXISTS child_stewardship.service_role_scopes (
  database_role name NOT NULL, actor_role text NOT NULL CHECK(actor_role IN ('bootstrap','guardian','child','reviewer','protector','operator','registry-publisher','operation-verifier')),
  scope_version bigint NOT NULL CHECK(scope_version>0), enabled boolean NOT NULL,
  approval_ref text NOT NULL CHECK(length(approval_ref)>0), expires_at timestamptz NOT NULL,
  PRIMARY KEY(database_role,actor_role,scope_version)
);
ALTER TABLE child_stewardship.service_role_scopes DROP CONSTRAINT IF EXISTS service_role_scopes_actor_role_check;
ALTER TABLE child_stewardship.service_role_scopes ADD CONSTRAINT service_role_scopes_actor_role_check CHECK(actor_role IN ('bootstrap','guardian','child','reviewer','protector','operator','registry-publisher','operation-verifier'));
CREATE OR REPLACE FUNCTION child_stewardship.guard_service_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_name name; BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_SCOPE_APPEND_ONLY' USING ERRCODE='23514'; END IF;
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='child_stewardship.service_role_scopes'::regclass;
  IF current_user<>owner_name THEN RAISE EXCEPTION 'CHILD_SCOPE_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NEW.scope_version<=coalesce((SELECT max(scope_version) FROM child_stewardship.service_role_scopes WHERE database_role=NEW.database_role AND actor_role=NEW.actor_role),0) THEN RAISE EXCEPTION 'CHILD_SCOPE_VERSION_ROLLBACK' USING ERRCODE='23514'; END IF;
  IF NEW.enabled AND ((NEW.actor_role='registry-publisher' AND EXISTS(SELECT 1 FROM child_stewardship.service_role_scopes WHERE database_role=NEW.database_role AND actor_role NOT IN ('operator','registry-publisher') AND enabled)) OR (NEW.actor_role NOT IN ('operator','registry-publisher') AND EXISTS(SELECT 1 FROM child_stewardship.service_role_scopes WHERE database_role=NEW.database_role AND actor_role='registry-publisher' AND enabled))) THEN RAISE EXCEPTION 'CHILD_REGISTRY_ROLE_MUST_BE_SEPARATE' USING ERRCODE='23514'; END IF;
  IF NEW.enabled AND ((NEW.actor_role='operation-verifier' AND EXISTS(SELECT 1 FROM child_stewardship.service_role_scopes WHERE database_role=NEW.database_role AND actor_role<>'operation-verifier' AND enabled)) OR (NEW.actor_role<>'operation-verifier' AND EXISTS(SELECT 1 FROM child_stewardship.service_role_scopes WHERE database_role=NEW.database_role AND actor_role='operation-verifier' AND enabled))) THEN RAISE EXCEPTION 'CHILD_VERIFIER_ROLE_MUST_BE_SEPARATE' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS service_scope_guard ON child_stewardship.service_role_scopes;
CREATE TRIGGER service_scope_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.service_role_scopes FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_service_scope();
-- Publication decisions are admitted only by the migration-owner/admin process AFTER
-- independent governance verification. No ordinary application route can issue one.
CREATE TABLE IF NOT EXISTS child_stewardship.registry_decisions (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), decision_id text NOT NULL,
  previous_digest text NOT NULL CHECK(previous_digest ~ '^[a-f0-9]{64}$'),
  approved_digest text NOT NULL CHECK(approved_digest ~ '^[a-f0-9]{64}$'),
  independent_approval_ref text NOT NULL CHECK(length(independent_approval_ref)>0),
  proof_digest text NOT NULL CHECK(proof_digest ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz NOT NULL, PRIMARY KEY(session_id,decision_id)
);
CREATE OR REPLACE FUNCTION child_stewardship.guard_registry_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_name name; BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_REGISTRY_DECISION_APPEND_ONLY' USING ERRCODE='23514'; END IF;
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='child_stewardship.registry_decisions'::regclass;
  IF current_user<>owner_name THEN RAISE EXCEPTION 'CHILD_INDEPENDENT_GOVERNANCE_ADMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS registry_decision_guard ON child_stewardship.registry_decisions;
CREATE TRIGGER registry_decision_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.registry_decisions FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_registry_decision();
CREATE TABLE IF NOT EXISTS child_stewardship.registry_decision_uses (
  session_id uuid NOT NULL, decision_id text NOT NULL, revision bigint NOT NULL,
  PRIMARY KEY(session_id,decision_id),
  FOREIGN KEY(session_id,decision_id) REFERENCES child_stewardship.registry_decisions(session_id,decision_id)
);
-- The verifier is a separate trusted service that runs actual Ed25519/current-registry
-- authorization and the deterministic transition. SQL checks its exact immutable admission;
-- SQL does not cryptographically verify an arbitrary signature-array JSON value.
CREATE TABLE IF NOT EXISTS child_stewardship.verification_admissions (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), operation_id text NOT NULL,
  approval_digest text NOT NULL CHECK(approval_digest ~ '^[a-f0-9]{64}$'),
  envelope_digest text NOT NULL CHECK(envelope_digest ~ '^[a-f0-9]{64}$'),
  signatures_digest text NOT NULL CHECK(signatures_digest ~ '^[a-f0-9]{64}$'),
  registry_digest text NOT NULL CHECK(registry_digest ~ '^[a-f0-9]{64}$'),
  expected_revision bigint NOT NULL CHECK(expected_revision>=0),
  approved_mutations jsonb NOT NULL CHECK(jsonb_typeof(approved_mutations)='array' AND jsonb_array_length(approved_mutations)>0),
  expires_at timestamptz NOT NULL, verification_ref text NOT NULL CHECK(length(verification_ref)>0),
  PRIMARY KEY(session_id,operation_id)
);
CREATE OR REPLACE FUNCTION child_stewardship.guard_verification_admission() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE permitted boolean; BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_VERIFICATION_APPEND_ONLY' USING ERRCODE='23514'; END IF;
  SELECT enabled AND expires_at>clock_timestamp() INTO permitted FROM child_stewardship.service_role_scopes WHERE database_role=current_user AND actor_role='operation-verifier' ORDER BY scope_version DESC LIMIT 1;
  IF permitted IS DISTINCT FROM true THEN RAISE EXCEPTION 'CHILD_SEPARATE_VERIFIER_REQUIRED' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(NEW.approved_mutations) m WHERE jsonb_typeof(m)<>'object' OR m->>'collection' IS NULL OR m->>'record_id' IS NULL OR NOT(m ? 'payload') OR m->>'collection'='securityContext') OR (SELECT count(*) FROM jsonb_array_elements(NEW.approved_mutations))<>(SELECT count(DISTINCT (m->>'collection',m->>'record_id')) FROM jsonb_array_elements(NEW.approved_mutations) m) THEN RAISE EXCEPTION 'CHILD_INVALID_VERIFIED_MUTATIONS' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS verification_admission_guard ON child_stewardship.verification_admissions;
CREATE TRIGGER verification_admission_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.verification_admissions FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_verification_admission();
CREATE TABLE IF NOT EXISTS child_stewardship.verification_uses (
  session_id uuid NOT NULL, operation_id text NOT NULL, transaction_id text NOT NULL,
  PRIMARY KEY(session_id,operation_id), FOREIGN KEY(session_id,operation_id) REFERENCES child_stewardship.verification_admissions(session_id,operation_id)
);
CREATE TABLE IF NOT EXISTS child_stewardship.session_births (
  session_id uuid PRIMARY KEY REFERENCES child_stewardship.sessions(id), transaction_id text NOT NULL
);
CREATE OR REPLACE FUNCTION child_stewardship.record_session_birth() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$ BEGIN
  INSERT INTO child_stewardship.session_births VALUES(NEW.id,pg_current_xact_id()::text);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS session_birth ON child_stewardship.sessions;
CREATE TRIGGER session_birth AFTER INSERT ON child_stewardship.sessions FOR EACH ROW EXECUTE FUNCTION child_stewardship.record_session_birth();
CREATE OR REPLACE FUNCTION child_stewardship.guard_session_token() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE permitted boolean; actor jsonb; BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_TOKEN_MAPPING_IMMUTABLE' USING ERRCODE='42501'; END IF;
  -- Serialize even direct concurrent record writers, not merely application callback execution.
  PERFORM 1 FROM child_stewardship.sessions WHERE id=NEW.session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHILD_SESSION_UNAVAILABLE' USING ERRCODE='23503'; END IF;
  -- Evaluate current role authority after any lock wait; signing-time/pre-wait scope is insufficient.
  SELECT enabled AND expires_at>clock_timestamp() INTO permitted FROM child_stewardship.service_role_scopes
    WHERE database_role=current_user AND actor_role='bootstrap' ORDER BY scope_version DESC LIMIT 1;
  IF permitted IS DISTINCT FROM true OR current_setting('app.child_actor_role',true) IS DISTINCT FROM 'bootstrap'
    OR current_setting('app.child_operation',true) IS DISTINCT FROM 'create-synthetic-session'
    OR NOT EXISTS(SELECT 1 FROM child_stewardship.session_births WHERE session_id=NEW.session_id AND transaction_id=pg_current_xact_id()::text)
    THEN RAISE EXCEPTION 'CHILD_TOKEN_BOOTSTRAP_CLOSED' USING ERRCODE='42501'; END IF;
  SELECT payload INTO actor FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='actors' AND record_id=NEW.actor_id;
  IF actor IS NULL OR (actor->>'epoch')::integer IS DISTINCT FROM NEW.epoch
    OR actor->>'revoked' IS DISTINCT FROM 'false' OR NOT((actor->'deviceIds') ? NEW.device_id)
    THEN RAISE EXCEPTION 'CHILD_TOKEN_PRINCIPAL_INVALID' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS session_token_guard ON child_stewardship.session_tokens;
CREATE TRIGGER session_token_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.session_tokens FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_session_token();
CREATE TABLE IF NOT EXISTS child_stewardship.rights_operations (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
  operation_id text NOT NULL,
  approval_digest text NOT NULL CHECK (approval_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY (session_id,operation_id), UNIQUE(session_id,operation_id,approval_digest)
);
CREATE TABLE IF NOT EXISTS child_stewardship.signed_approvals (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
  operation_id text NOT NULL,
  approval_digest text NOT NULL CHECK (approval_digest ~ '^[a-f0-9]{64}$'),
  envelope jsonb NOT NULL CHECK (envelope->>'environment' IS NOT DISTINCT FROM 'SIMULATION_ONLY' AND envelope->>'currency' IS NOT DISTINCT FROM 'XTS'),
  signatures jsonb NOT NULL CHECK (jsonb_typeof(signatures)='array' AND jsonb_array_length(signatures)>0),
  PRIMARY KEY (session_id,operation_id),
  FOREIGN KEY(session_id,operation_id,approval_digest) REFERENCES child_stewardship.rights_operations(session_id,operation_id,approval_digest) DEFERRABLE INITIALLY DEFERRED
);
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='child_stewardship.signed_approvals'::regclass AND conname='child_zero_fee_policy') THEN
  ALTER TABLE child_stewardship.signed_approvals ADD CONSTRAINT child_zero_fee_policy CHECK(envelope->'feesMinor' IS NOT DISTINCT FROM '0'::jsonb);
 END IF;
END $$;
CREATE TABLE IF NOT EXISTS child_stewardship.rights_nonces (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), nonce text NOT NULL,
  operation_id text, PRIMARY KEY(session_id,nonce),
  FOREIGN KEY(session_id,operation_id) REFERENCES child_stewardship.rights_operations(session_id,operation_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS child_stewardship.economic_keys (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), economic_key text NOT NULL,
  operation_id text, PRIMARY KEY(session_id,economic_key),
  FOREIGN KEY(session_id,operation_id) REFERENCES child_stewardship.rights_operations(session_id,operation_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS child_stewardship.contribution_keys (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
  canonical_participant_ref text NOT NULL, activity_instance text NOT NULL, contribution_kind text NOT NULL,
  contribution_id text NOT NULL, source_observation_id text NOT NULL,
  PRIMARY KEY(session_id,canonical_participant_ref,activity_instance,contribution_kind), UNIQUE(session_id,contribution_id)
);
CREATE TABLE IF NOT EXISTS child_stewardship.subject_epochs (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), subject_kind text NOT NULL,
  subject_ref text NOT NULL, epoch bigint NOT NULL CHECK(epoch>=0 AND epoch<=9007199254740991),
  source_revision bigint NOT NULL, PRIMARY KEY(session_id,subject_kind,subject_ref,epoch)
);
CREATE TABLE IF NOT EXISTS child_stewardship.credential_revocations (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), credential_id text NOT NULL,
  registry_version text NOT NULL, PRIMARY KEY(session_id,credential_id)
);
CREATE TABLE IF NOT EXISTS child_stewardship.registry_checkpoints (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), revision bigint NOT NULL,
  signer_version text NOT NULL, control_domain_version text NOT NULL, conflict_version text NOT NULL,
  policy_version text NOT NULL, payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  PRIMARY KEY(session_id,revision)
);
CREATE TABLE IF NOT EXISTS child_stewardship.entitlement_balances (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), entitlement_id text NOT NULL,
  beneficiary_ref text NOT NULL, legal_basis_ref text NOT NULL, obligor_ref text NOT NULL,
  right_kind text NOT NULL CHECK(right_kind IN ('contractual_grant','lawful_service_benefit')),
  currency text NOT NULL CHECK(currency='XTS'), amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=9007199254740991),
  paid_minor bigint NOT NULL CHECK(paid_minor>=0 AND paid_minor<=amount_minor),
  legal_state text NOT NULL CHECK(legal_state IN ('legally_committed','vested')), disputed boolean NOT NULL,
  revision bigint NOT NULL, PRIMARY KEY(session_id,entitlement_id)
);
CREATE TABLE IF NOT EXISTS child_stewardship.funding_balances (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), funding_lot_id text NOT NULL,
  currency text NOT NULL CHECK(currency='XTS'), clearing_receipt_ref text NOT NULL,
  cleared_assets_minor bigint NOT NULL CHECK(cleared_assets_minor BETWEEN 0 AND 9007199254740991),
  unallocated_minor bigint NOT NULL CHECK(unallocated_minor>=0), reserved_minor bigint NOT NULL CHECK(reserved_minor>=0),
  vested_minor bigint NOT NULL CHECK(vested_minor>=0), submitted_minor bigint NOT NULL CHECK(submitted_minor>=0),
  outcome_reserved_minor bigint NOT NULL CHECK(outcome_reserved_minor>=0), allocations jsonb NOT NULL,
  revision bigint NOT NULL, PRIMARY KEY(session_id,funding_lot_id), UNIQUE(session_id,clearing_receipt_ref),
  CHECK(cleared_assets_minor::numeric=unallocated_minor::numeric+reserved_minor::numeric+vested_minor::numeric+submitted_minor::numeric+outcome_reserved_minor::numeric)
);
CREATE TABLE IF NOT EXISTS child_stewardship.payment_facts (
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), payout_id text NOT NULL,
  operation_id text NOT NULL, entitlement_id text NOT NULL, funding_lot_id text NOT NULL,
  destination_ref text NOT NULL, destination_version bigint NOT NULL, destination_digest text NOT NULL CHECK(destination_digest ~ '^[a-f0-9]{64}$'),
  amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=9007199254740991),
  refunded_minor bigint NOT NULL CHECK(refunded_minor>=0 AND refunded_minor<=amount_minor),
  status text NOT NULL CHECK(status IN ('submitted','accepted','processing','unknown','settled','failed','returned')),
  submission_count integer NOT NULL CHECK(submission_count=1), revision bigint NOT NULL,
  PRIMARY KEY(session_id,payout_id), UNIQUE(session_id,operation_id),
  FOREIGN KEY(session_id,entitlement_id) REFERENCES child_stewardship.entitlement_balances(session_id,entitlement_id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY(session_id,funding_lot_id) REFERENCES child_stewardship.funding_balances(session_id,funding_lot_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE TABLE IF NOT EXISTS child_stewardship.authority_journal (
  sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
  domain text NOT NULL, collection text NOT NULL, record_id text NOT NULL, revision bigint NOT NULL,
  operation_id text, actor_role text NOT NULL, operation_type text NOT NULL,
  previous_digest text NOT NULL CHECK(previous_digest ~ '^[a-f0-9]{64}$'),
  payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(session_id,domain,collection,record_id,revision)
);

CREATE OR REPLACE FUNCTION child_stewardship.reject_authority_rewrite() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  RAISE EXCEPTION 'CHILD_AUTHORITY_APPEND_ONLY' USING ERRCODE='23514';
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.require_authority_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$ BEGIN
  IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'CHILD_AUTHORITY_DIRECT_WRITE_FORBIDDEN' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'CHILD_AUTHORITY_DELETE_FORBIDDEN' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['rights_operations','signed_approvals','rights_nonces','economic_keys','contribution_keys','subject_epochs','credential_revocations','registry_checkpoints','registry_decision_uses','verification_uses','session_births','authority_journal'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS immutable_authority ON child_stewardship.%I',relation);
    EXECUTE format('CREATE TRIGGER immutable_authority BEFORE UPDATE OR DELETE ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.reject_authority_rewrite()',relation);
    EXECUTE format('DROP TRIGGER IF EXISTS authority_insert_path ON child_stewardship.%I',relation);
    EXECUTE format('CREATE TRIGGER authority_insert_path BEFORE INSERT ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.require_authority_trigger()',relation);
  END LOOP;
  FOREACH relation IN ARRAY ARRAY['entitlement_balances','funding_balances','payment_facts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS authority_mutation_path ON child_stewardship.%I',relation);
    EXECUTE format('CREATE TRIGGER authority_mutation_path BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.require_authority_trigger()',relation);
  END LOOP;
  FOREACH relation IN ARRAY ARRAY['rights_operations','signed_approvals','rights_nonces','economic_keys','contribution_keys','subject_epochs','credential_revocations','registry_checkpoints','entitlement_balances','funding_balances','payment_facts','registry_decisions','registry_decision_uses','verification_admissions','verification_uses','session_births','authority_journal'] LOOP
    EXECUTE format('ALTER TABLE child_stewardship.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('ALTER TABLE child_stewardship.%I FORCE ROW LEVEL SECURITY',relation);
    EXECUTE format('DROP POLICY IF EXISTS private_session ON child_stewardship.%I',relation);
    EXECUTE format('CREATE POLICY private_session ON child_stewardship.%I USING (session_id::text=current_setting(''app.child_session_id'',true)) WITH CHECK (session_id::text=current_setting(''app.child_session_id'',true))',relation);
  END LOOP;
END $$;

-- Provider operation identity is unique across payouts, independent of request/policy IDs.
CREATE UNIQUE INDEX IF NOT EXISTS child_payment_provider_operation ON child_stewardship.state_records(session_id,(payload->>'providerOperationRef')) WHERE domain='rights' AND collection='payments' AND payload->>'providerOperationRef' IS NOT NULL;

CREATE OR REPLACE FUNCTION child_stewardship.mirror_canonical_authority() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE
  actor text:=current_setting('app.child_actor_role',true);
  op text:=coalesce(nullif(current_setting('app.child_operation',true),''),'unknown');
  opid text:=nullif(current_setting('app.child_operation_id',true),'');
  p jsonb; oldp jsonb; item record; prior bigint; epoch bigint; original bigint;
  reserved bigint:=0; vested bigint:=0; submitted bigint:=0; outcomes bigint:=0;
  previous text; pd text; chain text; database_actor name; permitted boolean; registry_publisher boolean; decision text; admission child_stewardship.verification_admissions%ROWTYPE; use_tx text;
BEGIN
  IF TG_OP='DELETE' THEN
    IF to_regprocedure('child_stewardship.privacy_delete_permitted(uuid,text,text,text,jsonb)') IS NOT NULL THEN
      IF child_stewardship.privacy_delete_permitted(OLD.session_id,OLD.domain,OLD.collection,OLD.record_id,OLD.payload) THEN RETURN OLD; END IF;
    END IF;
    RAISE EXCEPTION 'CHILD_CANONICAL_DELETE_FORBIDDEN' USING ERRCODE='23514';
  END IF;
  IF NEW.session_id::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RAISE EXCEPTION 'CHILD_TENANT_MISMATCH' USING ERRCODE='42501'; END IF;
  database_actor:=CASE WHEN coalesce(current_setting('role',true),'none') IN ('none','') THEN session_user ELSE current_setting('role',true)::name END;
  -- Serialize even direct concurrent record writers, not merely application callback execution.
  PERFORM 1 FROM child_stewardship.sessions WHERE id=NEW.session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CHILD_SESSION_UNAVAILABLE' USING ERRCODE='23503'; END IF;
  -- Evaluate current role authority after any lock wait; signing-time/pre-wait scope is insufficient.
  SELECT enabled AND expires_at>clock_timestamp() INTO permitted FROM child_stewardship.service_role_scopes
    WHERE database_role=database_actor AND actor_role=actor ORDER BY scope_version DESC LIMIT 1;
  IF permitted IS DISTINCT FROM true THEN RAISE EXCEPTION 'CHILD_DATABASE_ROLE_SCOPE_DENIED' USING ERRCODE='42501'; END IF;
  SELECT enabled AND expires_at>clock_timestamp() INTO registry_publisher FROM child_stewardship.service_role_scopes WHERE database_role=database_actor AND actor_role='registry-publisher' ORDER BY scope_version DESC LIMIT 1;
  IF registry_publisher IS TRUE AND (NEW.domain<>'rights' OR NEW.collection<>'securityContext') THEN RAISE EXCEPTION 'CHILD_REGISTRY_PUBLISHER_SCOPE_ONLY' USING ERRCODE='42501'; END IF;
  IF TG_OP='UPDATE' AND (NEW.session_id<>OLD.session_id OR NEW.domain<>OLD.domain OR NEW.collection<>OLD.collection OR NEW.record_id<>OLD.record_id OR NEW.revision<=OLD.revision) THEN
    RAISE EXCEPTION 'CHILD_RECORD_IDENTITY_OR_REVISION_CHANGED' USING ERRCODE='23514';
  END IF;
  p:=NEW.payload; IF TG_OP='UPDATE' THEN oldp:=OLD.payload; END IF;
  IF actor='bootstrap' THEN
    IF NEW.revision<>0 OR NOT EXISTS(SELECT 1 FROM child_stewardship.session_births WHERE session_id=NEW.session_id AND transaction_id=pg_current_xact_id()::text) OR EXISTS(SELECT 1 FROM child_stewardship.authority_journal WHERE session_id=NEW.session_id AND actor_role<>'bootstrap') THEN RAISE EXCEPTION 'CHILD_BOOTSTRAP_CLOSED' USING ERRCODE='42501'; END IF;
  ELSIF NEW.domain='rights' THEN
    IF actor<>'operator' THEN RAISE EXCEPTION 'CHILD_RIGHTS_ROLE_REQUIRED' USING ERRCODE='42501'; END IF;
    IF NEW.collection='securityContext' THEN
      IF op<>'rights-registry-update' OR registry_publisher IS DISTINCT FROM true THEN RAISE EXCEPTION 'CHILD_REGISTRY_GOVERNANCE_REQUIRED' USING ERRCODE='42501'; END IF;
      decision:=nullif(current_setting('app.child_registry_decision_id',true),'');
      IF decision IS NULL OR NOT EXISTS(SELECT 1 FROM child_stewardship.registry_decisions WHERE session_id=NEW.session_id AND decision_id=decision AND expires_at>clock_timestamp() AND previous_digest=encode(sha256(convert_to(OLD.payload::text,'UTF8')),'hex') AND approved_digest=encode(sha256(convert_to(NEW.payload::text,'UTF8')),'hex')) THEN RAISE EXCEPTION 'CHILD_REGISTRY_DECISION_REQUIRED' USING ERRCODE='42501'; END IF;
      INSERT INTO child_stewardship.registry_decision_uses VALUES(NEW.session_id,decision,NEW.revision);
    ELSE
      IF opid IS NULL THEN RAISE EXCEPTION 'CHILD_SIGNED_OPERATION_REQUIRED' USING ERRCODE='23514'; END IF;
      SELECT * INTO admission FROM child_stewardship.verification_admissions WHERE session_id=NEW.session_id AND operation_id=opid;
      IF NOT FOUND OR admission.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'CHILD_VERIFIED_ADMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
      IF NEW.revision<>admission.expected_revision+1 THEN RAISE EXCEPTION 'CHILD_VERIFIED_RECORD_REVISION' USING ERRCODE='23514'; END IF;
      IF admission.registry_digest IS DISTINCT FROM (SELECT encode(sha256(convert_to(payload::text,'UTF8')),'hex') FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='rights' AND collection='securityContext' AND record_id='current') THEN RAISE EXCEPTION 'CHILD_VERIFIED_REGISTRY_CHANGED' USING ERRCODE='42501'; END IF;
      IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(admission.approved_mutations) m WHERE m->>'collection'=NEW.collection AND m->>'record_id'=NEW.record_id AND m->'payload'=NEW.payload) THEN RAISE EXCEPTION 'CHILD_UNAPPROVED_STATE_MUTATION' USING ERRCODE='42501'; END IF;
      SELECT transaction_id INTO use_tx FROM child_stewardship.verification_uses WHERE session_id=NEW.session_id AND operation_id=opid;
      IF use_tx IS NULL THEN
        IF admission.expected_revision<>(SELECT revision FROM child_stewardship.sessions WHERE id=NEW.session_id) THEN RAISE EXCEPTION 'CHILD_VERIFIED_REVISION_CHANGED' USING ERRCODE='42501'; END IF;
        INSERT INTO child_stewardship.verification_uses VALUES(NEW.session_id,opid,pg_current_xact_id()::text);
      ELSIF use_tx<>pg_current_xact_id()::text THEN RAISE EXCEPTION 'CHILD_VERIFICATION_ALREADY_USED' USING ERRCODE='42501'; END IF;
    END IF;
  ELSIF NEW.domain='learning' AND NEW.collection='contributions' AND actor NOT IN ('reviewer','protector') THEN
    RAISE EXCEPTION 'CHILD_CONTRIBUTION_ROLE_REQUIRED' USING ERRCODE='42501';
  END IF;
  IF actor<>'bootstrap' AND NEW.domain='learning' AND NEW.collection='actors' THEN
    IF TG_OP<>'UPDATE' OR actor NOT IN ('guardian','protector') OR op<>'revoke-device' THEN RAISE EXCEPTION 'CHILD_ACTOR_GOVERNANCE_REQUIRED' USING ERRCODE='42501'; END IF;
    IF (p-'deviceIds'-'epoch') IS DISTINCT FROM (oldp-'deviceIds'-'epoch') OR (p->>'epoch')::bigint<>(oldp->>'epoch')::bigint+1 OR jsonb_typeof(p->'deviceIds')<>'array' OR NOT((oldp->'deviceIds') @> (p->'deviceIds')) OR jsonb_array_length(p->'deviceIds')<>jsonb_array_length(oldp->'deviceIds')-1 THEN RAISE EXCEPTION 'CHILD_ACTOR_SCOPE_EXPANSION' USING ERRCODE='42501'; END IF;
  END IF;
  IF actor<>'bootstrap' AND NEW.domain='learning' AND NEW.collection='consents' THEN
    IF actor NOT IN ('guardian','child') OR op NOT IN ('grant-consent','set-assent','withdraw-consent','request-privacy') THEN RAISE EXCEPTION 'CHILD_CONSENT_ROLE_DENIED' USING ERRCODE='42501'; END IF;
    IF oldp IS NOT NULL AND ((p->>'profileId') IS DISTINCT FROM (oldp->>'profileId') OR (p->>'purpose') IS DISTINCT FROM (oldp->>'purpose') OR (p->>'version')::bigint<>(oldp->>'version')::bigint+1) THEN RAISE EXCEPTION 'CHILD_CONSENT_IDENTITY_OR_VERSION' USING ERRCODE='23514'; END IF;
    IF op='grant-consent' THEN
      IF actor<>'guardian' OR p->>'guardianGranted' IS DISTINCT FROM 'true' OR p->>'childAssent' IS DISTINCT FROM 'false' OR p->>'withdrawnAt' IS NOT NULL THEN RAISE EXCEPTION 'CHILD_CONSENT_GRANT_FIELDS' USING ERRCODE='42501'; END IF;
    ELSIF op='set-assent' THEN
      IF actor<>'child' OR oldp IS NULL OR oldp->>'withdrawnAt' IS NOT NULL OR (p-'childAssent'-'version'-'withdrawnAt') IS DISTINCT FROM (oldp-'childAssent'-'version'-'withdrawnAt') OR (p->>'childAssent'='true' AND p->>'withdrawnAt' IS NOT NULL) OR (p->>'childAssent'='false' AND p->>'withdrawnAt' IS NULL) THEN RAISE EXCEPTION 'CHILD_ASSENT_FIELDS' USING ERRCODE='42501'; END IF;
    ELSE
      IF oldp IS NULL OR p->>'guardianGranted' IS DISTINCT FROM 'false' OR p->>'childAssent' IS DISTINCT FROM 'false' OR p->>'withdrawnAt' IS NULL OR (p-'guardianGranted'-'childAssent'-'withdrawnAt'-'version') IS DISTINCT FROM (oldp-'guardianGranted'-'childAssent'-'withdrawnAt'-'version') THEN RAISE EXCEPTION 'CHILD_WITHDRAWAL_FIELDS' USING ERRCODE='42501'; END IF;
    END IF;
  END IF;
  IF NEW.domain='learning' AND NEW.collection='contributions' THEN
    IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'CHILD_CONTRIBUTION_APPEND_ONLY' USING ERRCODE='23514'; END IF;
    IF p->>'unit' IS DISTINCT FROM 'EDU_FEEDBACK' OR p->>'transferable' IS DISTINCT FROM 'false' OR p->>'cashValue' IS DISTINCT FROM 'false' OR p->>'acceptedScope' IS DISTINCT FROM 'learning_only' OR (p->>'amount')::bigint NOT IN (0,1) THEN RAISE EXCEPTION 'CHILD_CONTRIBUTION_KIND' USING ERRCODE='23514'; END IF;
    IF p->>'entryType'='grant' THEN
      INSERT INTO child_stewardship.contribution_keys VALUES(NEW.session_id,p->>'canonicalParticipantRef',p->>'activityInstance',p->>'kind',NEW.record_id,p->>'sourceObservationId');
    ELSIF p->>'entryType'='correction' THEN
      IF NOT EXISTS(SELECT 1 FROM child_stewardship.contribution_keys WHERE session_id=NEW.session_id AND contribution_id=p->>'correctionOf') THEN RAISE EXCEPTION 'CHILD_CORRECTION_SOURCE_REQUIRED' USING ERRCODE='23503'; END IF;
    ELSE RAISE EXCEPTION 'CHILD_CONTRIBUTION_ENTRY_KIND' USING ERRCODE='23514'; END IF;
  END IF;
  IF (NEW.domain='learning' AND NEW.collection='actors') OR (NEW.domain='rights' AND NEW.collection='beneficiaries') THEN
    epoch:=(CASE WHEN NEW.domain='learning' THEN p->>'epoch' ELSE p->>'authorizationEpoch' END)::bigint;
    SELECT max(e.epoch) INTO prior FROM child_stewardship.subject_epochs e WHERE session_id=NEW.session_id AND subject_kind=NEW.domain||'.'||NEW.collection AND subject_ref=NEW.record_id;
    IF epoch IS NULL OR epoch<0 OR epoch<coalesce(prior,0) THEN RAISE EXCEPTION 'CHILD_EPOCH_ROLLBACK' USING ERRCODE='23514'; END IF;
    IF prior IS NULL OR epoch>prior THEN INSERT INTO child_stewardship.subject_epochs VALUES(NEW.session_id,NEW.domain||'.'||NEW.collection,NEW.record_id,epoch,NEW.revision); END IF;
    IF NEW.domain='learning' AND oldp->>'revoked'='true' AND p->>'revoked'<>'true' THEN RAISE EXCEPTION 'CHILD_CREDENTIAL_RESURRECTION' USING ERRCODE='23514'; END IF;
    IF NEW.domain='rights' AND oldp IS NOT NULL AND oldp->>'legalSubjectRef' IS DISTINCT FROM p->>'legalSubjectRef' THEN RAISE EXCEPTION 'CHILD_LEGAL_SUBJECT_IMMUTABLE' USING ERRCODE='23514'; END IF;
  END IF;
  IF NEW.domain='rights' THEN
    CASE NEW.collection
    WHEN 'consumedNonces' THEN
      IF TG_OP='UPDATE' OR jsonb_typeof(p)<>'string' OR p#>>'{}'<>NEW.record_id THEN RAISE EXCEPTION 'CHILD_NONCE_IMMUTABLE' USING ERRCODE='23514'; END IF;
      INSERT INTO child_stewardship.rights_nonces VALUES(NEW.session_id,NEW.record_id,opid);
    WHEN 'economicKeys' THEN
      IF TG_OP='UPDATE' OR jsonb_typeof(p)<>'string' OR p#>>'{}'<>NEW.record_id THEN RAISE EXCEPTION 'CHILD_ECONOMIC_KEY_IMMUTABLE' USING ERRCODE='23514'; END IF;
      INSERT INTO child_stewardship.economic_keys VALUES(NEW.session_id,NEW.record_id,opid);
    WHEN 'executedOperations' THEN
      IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'CHILD_EXECUTION_IMMUTABLE' USING ERRCODE='23514'; END IF;
      INSERT INTO child_stewardship.rights_operations VALUES(NEW.session_id,NEW.record_id,p#>>'{}');
    WHEN 'approvalRecords' THEN
      IF TG_OP='UPDATE' OR p->'operation'->>'operationId'<>NEW.record_id THEN RAISE EXCEPTION 'CHILD_APPROVAL_IMMUTABLE' USING ERRCODE='23514'; END IF;
      INSERT INTO child_stewardship.signed_approvals VALUES(NEW.session_id,NEW.record_id,p->>'approvalDigest',p->'operation',p->'approvals');
    WHEN 'entitlements' THEN
      IF oldp IS NOT NULL AND ((p->>'amountMinor')::bigint<>(oldp->>'amountMinor')::bigint OR p->>'legalBasisRef'<>oldp->>'legalBasisRef' OR p->>'policyVersion'<>oldp->>'policyVersion' OR p->>'obligorRef' IS DISTINCT FROM oldp->>'obligorRef' OR p->>'rightKind' IS DISTINCT FROM oldp->>'rightKind' OR p->>'currency' IS DISTINCT FROM oldp->>'currency' OR p->>'dueAt' IS DISTINCT FROM oldp->>'dueAt') THEN RAISE EXCEPTION 'CHILD_VESTED_TERMS_IMMUTABLE' USING ERRCODE='23514'; END IF;
      IF oldp IS NOT NULL AND p->>'beneficiaryRef'<>oldp->>'beneficiaryRef' AND op<>'LEGAL_CORRECTION' THEN RAISE EXCEPTION 'CHILD_LEGAL_CORRECTION_REQUIRED' USING ERRCODE='23514'; END IF;
      IF oldp->>'legalState'='vested' AND p->>'legalState'<>'vested' THEN RAISE EXCEPTION 'CHILD_VESTING_ROLLBACK' USING ERRCODE='23514'; END IF;
      INSERT INTO child_stewardship.entitlement_balances VALUES(NEW.session_id,NEW.record_id,p->>'beneficiaryRef',p->>'legalBasisRef',p->>'obligorRef',p->>'rightKind',p->>'currency',(p->>'amountMinor')::bigint,(p->>'paidMinor')::bigint,p->>'legalState',jsonb_array_length(p->'disputeIds')>0,NEW.revision)
      ON CONFLICT(session_id,entitlement_id) DO UPDATE SET beneficiary_ref=EXCLUDED.beneficiary_ref,paid_minor=EXCLUDED.paid_minor,legal_state=EXCLUDED.legal_state,disputed=EXCLUDED.disputed,revision=EXCLUDED.revision;
    WHEN 'fundingLots' THEN
      IF oldp IS NOT NULL AND p->>'clearingReceiptRef'<>oldp->>'clearingReceiptRef' THEN RAISE EXCEPTION 'CHILD_CLEARING_RECEIPT_CHANGED' USING ERRCODE='23514'; END IF;
      FOR item IN SELECT key,value FROM jsonb_each(p->'allocations') LOOP
        IF (item.value->>'reservedMinor')::bigint<0 OR (item.value->>'vestedMinor')::bigint<0 OR (item.value->>'submittedMinor')::bigint<0 THEN RAISE EXCEPTION 'CHILD_NEGATIVE_ALLOCATION' USING ERRCODE='23514'; END IF;
        reserved:=reserved+(item.value->>'reservedMinor')::bigint; vested:=vested+(item.value->>'vestedMinor')::bigint; submitted:=submitted+(item.value->>'submittedMinor')::bigint;
      END LOOP;
      FOR item IN SELECT value FROM jsonb_each(p->'outcomeReserves') LOOP IF (item.value#>>'{}')::bigint<0 THEN RAISE EXCEPTION 'CHILD_NEGATIVE_OUTCOME_RESERVE' USING ERRCODE='23514'; END IF; outcomes:=outcomes+(item.value#>>'{}')::bigint; END LOOP;
      INSERT INTO child_stewardship.funding_balances VALUES(NEW.session_id,NEW.record_id,p->>'currency',p->>'clearingReceiptRef',(p->>'clearedAssetsMinor')::bigint,(p->>'unallocatedMinor')::bigint,reserved,vested,submitted,outcomes,p->'allocations',NEW.revision)
      ON CONFLICT(session_id,funding_lot_id) DO UPDATE SET cleared_assets_minor=EXCLUDED.cleared_assets_minor,unallocated_minor=EXCLUDED.unallocated_minor,reserved_minor=EXCLUDED.reserved_minor,vested_minor=EXCLUDED.vested_minor,submitted_minor=EXCLUDED.submitted_minor,outcome_reserved_minor=EXCLUDED.outcome_reserved_minor,allocations=EXCLUDED.allocations,revision=EXCLUDED.revision;
    WHEN 'payments' THEN
      IF oldp->>'providerOperationRef' IS NOT NULL AND (p->>'providerOperationRef') IS DISTINCT FROM (oldp->>'providerOperationRef') THEN RAISE EXCEPTION 'CHILD_PROVIDER_OPERATION_IMMUTABLE' USING ERRCODE='23514';END IF;
      IF jsonb_typeof(p->'receiptRefs') IS DISTINCT FROM 'array' OR (oldp IS NOT NULL AND NOT((p->'receiptRefs') @> (oldp->'receiptRefs'))) THEN RAISE EXCEPTION 'CHILD_PROVIDER_RECEIPT_HISTORY' USING ERRCODE='23514';END IF;
      IF (SELECT count(*) FROM jsonb_array_elements_text(p->'receiptRefs'))<>(SELECT count(DISTINCT value) FROM jsonb_array_elements_text(p->'receiptRefs')) THEN RAISE EXCEPTION 'CHILD_PROVIDER_RECEIPT_REUSED' USING ERRCODE='23514';END IF;
      FOR item IN SELECT value FROM jsonb_array_elements_text(p->'receiptRefs') LOOP
        IF EXISTS(SELECT 1 FROM child_stewardship.state_records r WHERE r.session_id=NEW.session_id AND r.domain='rights' AND r.collection='payments' AND r.record_id<>NEW.record_id AND r.payload->'receiptRefs' ? item.value) THEN RAISE EXCEPTION 'CHILD_PROVIDER_RECEIPT_REUSED' USING ERRCODE='23514';END IF;
      END LOOP;
      IF oldp IS NOT NULL AND (p->>'operationId'<>oldp->>'operationId' OR p->>'recipientBindingRef'<>oldp->>'recipientBindingRef' OR p->>'recipientDestinationDigest'<>oldp->>'recipientDestinationDigest' OR p->>'recipientBindingVersion'<>oldp->>'recipientBindingVersion' OR p->>'amountMinor'<>oldp->>'amountMinor' OR p->>'entitlementId'<>oldp->>'entitlementId' OR p->>'fundingLotId'<>oldp->>'fundingLotId') THEN RAISE EXCEPTION 'CHILD_PAYMENT_BINDING_IMMUTABLE' USING ERRCODE='23514'; END IF;
      IF oldp->>'status' IN ('settled','returned','failed') AND p->>'status'<>oldp->>'status' AND NOT(oldp->>'status'='settled' AND p->>'status'='returned' AND op='REFUND') THEN RAISE EXCEPTION 'CHILD_PAYMENT_FINALITY_ROLLBACK' USING ERRCODE='23514'; END IF;
      IF oldp->>'status'='unknown' AND p->>'status' NOT IN ('unknown','settled','failed') THEN RAISE EXCEPTION 'CHILD_PAYMENT_RECONCILIATION_REQUIRED' USING ERRCODE='23514'; END IF;
      INSERT INTO child_stewardship.payment_facts VALUES(NEW.session_id,NEW.record_id,p->>'operationId',p->>'entitlementId',p->>'fundingLotId',p->>'recipientBindingRef',(p->>'recipientBindingVersion')::bigint,p->>'recipientDestinationDigest',(p->>'amountMinor')::bigint,(p->>'refundedMinor')::bigint,p->>'status',(p->>'submissionCount')::integer,NEW.revision)
      ON CONFLICT(session_id,payout_id) DO UPDATE SET status=EXCLUDED.status,refunded_minor=EXCLUDED.refunded_minor,revision=EXCLUDED.revision;
    WHEN 'delegations' THEN
      IF oldp->>'revoked'='true' AND p->>'revoked'<>'true' THEN RAISE EXCEPTION 'CHILD_DELEGATION_RESURRECTION' USING ERRCODE='23514'; END IF;
      IF oldp IS NOT NULL AND ((p->>'consumedMinor')::bigint<(oldp->>'consumedMinor')::bigint OR (p->>'consumedCalls')::bigint<(oldp->>'consumedCalls')::bigint OR (p-'consumedMinor'-'consumedCalls'-'revoked') IS DISTINCT FROM (oldp-'consumedMinor'-'consumedCalls'-'revoked')) THEN RAISE EXCEPTION 'CHILD_DELEGATION_REWRITE' USING ERRCODE='23514'; END IF;
    WHEN 'cumulativeAmounts' THEN
      IF (p#>>'{}')::bigint<0 OR (oldp IS NOT NULL AND (p#>>'{}')::bigint<(oldp#>>'{}')::bigint) THEN RAISE EXCEPTION 'CHILD_CUMULATIVE_LIMIT_ROLLBACK' USING ERRCODE='23514'; END IF;
    WHEN 'securityContext' THEN
      IF p->>'environment' IS DISTINCT FROM 'SIMULATION_ONLY' THEN RAISE EXCEPTION 'CHILD_REAL_ENVIRONMENT_DISABLED' USING ERRCODE='23514'; END IF;
      FOR item IN SELECT value FROM jsonb_array_elements(p->'credentials') LOOP
        IF item.value->>'revoked'='false' AND EXISTS(SELECT 1 FROM child_stewardship.credential_revocations WHERE session_id=NEW.session_id AND credential_id=item.value->>'keyId') THEN RAISE EXCEPTION 'CHILD_CREDENTIAL_RESURRECTION' USING ERRCODE='23514'; END IF;
        IF item.value->>'revoked'='true' AND NOT EXISTS(SELECT 1 FROM child_stewardship.credential_revocations WHERE session_id=NEW.session_id AND credential_id=item.value->>'keyId') THEN INSERT INTO child_stewardship.credential_revocations VALUES(NEW.session_id,item.value->>'keyId',p->>'signerRegistryVersion'); END IF;
      END LOOP;
      IF oldp IS NOT NULL AND p->'credentials' IS DISTINCT FROM oldp->'credentials' AND (p->>'signerRegistryVersion'=oldp->>'signerRegistryVersion' OR p->>'controlDomainRegistryVersion'=oldp->>'controlDomainRegistryVersion' OR p->>'conflictCheckVersion'=oldp->>'conflictCheckVersion') THEN RAISE EXCEPTION 'CHILD_REGISTRY_VERSION_REQUIRED' USING ERRCODE='23514'; END IF;
      INSERT INTO child_stewardship.registry_checkpoints VALUES(NEW.session_id,NEW.revision,p->>'signerRegistryVersion',p->>'controlDomainRegistryVersion',p->>'conflictCheckVersion',p->'policy'->>'version',encode(sha256(convert_to(p::text,'UTF8')),'hex'));
    ELSE NULL;
    END CASE;
  END IF;
  SELECT digest INTO previous FROM child_stewardship.authority_journal WHERE session_id=NEW.session_id ORDER BY sequence DESC LIMIT 1;
  previous:=coalesce(previous,repeat('0',64)); pd:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
  chain:=encode(sha256(convert_to(previous||':'||NEW.domain||':'||NEW.collection||':'||NEW.record_id||':'||NEW.revision::text||':'||pd,'UTF8')),'hex');
  INSERT INTO child_stewardship.authority_journal(session_id,domain,collection,record_id,revision,operation_id,actor_role,operation_type,previous_digest,payload_digest,digest)
    VALUES(NEW.session_id,NEW.domain,NEW.collection,NEW.record_id,NEW.revision,opid,actor,op,previous,pd,chain);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS canonical_authority ON child_stewardship.state_records;
CREATE TRIGGER canonical_authority AFTER INSERT OR UPDATE ON child_stewardship.state_records FOR EACH ROW EXECUTE FUNCTION child_stewardship.mirror_canonical_authority();
DROP TRIGGER IF EXISTS canonical_authority_delete ON child_stewardship.state_records;
CREATE TRIGGER canonical_authority_delete BEFORE DELETE ON child_stewardship.state_records FOR EACH ROW EXECUTE FUNCTION child_stewardship.mirror_canonical_authority();

CREATE OR REPLACE FUNCTION child_stewardship.check_authority_commit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE item record; reserved numeric; signed jsonb; source jsonb; operation_type text; amount bigint; target_entitlement text; old_assets bigint; new_assets bigint; original_tenant text; mutation_actor text; mutation_operation text; mutation_id text; admission child_stewardship.verification_admissions%ROWTYPE; BEGIN
  -- Deferred events bind the immutable admitted mutation, never caller-changeable COMMIT GUCs.
  original_tenant:=current_setting('app.child_session_id',true);
  PERFORM set_config('app.child_session_id',NEW.session_id::text,true);
  SELECT j.actor_role,j.operation_type,j.operation_id INTO mutation_actor,mutation_operation,mutation_id FROM child_stewardship.authority_journal j WHERE j.session_id=NEW.session_id AND j.domain=NEW.domain AND j.collection=NEW.collection AND j.record_id=NEW.record_id AND j.revision=NEW.revision;
  IF mutation_actor IS NULL THEN RAISE EXCEPTION 'CHILD_MUTATION_CHECKPOINT_REQUIRED' USING ERRCODE='23503'; END IF;
  -- Deferred checks see the complete atomic transaction, including late-inserted entitlements.
  FOR item IN SELECT * FROM child_stewardship.entitlement_balances WHERE session_id=NEW.session_id LOOP
    SELECT coalesce(sum((a.value->>'reservedMinor')::numeric+(a.value->>'vestedMinor')::numeric+(a.value->>'submittedMinor')::numeric),0)
      INTO reserved FROM child_stewardship.funding_balances f CROSS JOIN LATERAL jsonb_each(f.allocations) a WHERE f.session_id=NEW.session_id AND a.key=item.entitlement_id;
    IF reserved>item.amount_minor-item.paid_minor THEN RAISE EXCEPTION 'CHILD_OVERRESERVATION' USING ERRCODE='23514'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM child_stewardship.funding_balances f CROSS JOIN LATERAL jsonb_object_keys(f.allocations) a WHERE f.session_id=NEW.session_id AND NOT EXISTS(SELECT 1 FROM child_stewardship.entitlement_balances e WHERE e.session_id=f.session_id AND e.entitlement_id=a)) THEN RAISE EXCEPTION 'CHILD_ORPHAN_ALLOCATION' USING ERRCODE='23503'; END IF;
  IF NEW.domain='rights' AND mutation_actor<>'bootstrap' AND NEW.collection<>'securityContext' THEN
    SELECT * INTO admission FROM child_stewardship.verification_admissions WHERE session_id=NEW.session_id AND operation_id=mutation_id;
    IF admission.operation_id IS NULL OR admission.expires_at<=clock_timestamp() OR (SELECT revision FROM child_stewardship.sessions WHERE id=NEW.session_id)<>admission.expected_revision+1 THEN RAISE EXCEPTION 'CHILD_VERIFIED_COMMIT_REVISION' USING ERRCODE='23514'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_array_elements(admission.approved_mutations) m WHERE NOT EXISTS(SELECT 1 FROM child_stewardship.state_records r WHERE r.session_id=NEW.session_id AND r.domain='rights' AND r.collection=m->>'collection' AND r.record_id=m->>'record_id' AND r.payload=m->'payload' AND r.revision=admission.expected_revision+1 AND EXISTS(SELECT 1 FROM child_stewardship.authority_journal j WHERE j.session_id=r.session_id AND j.domain=r.domain AND j.collection=r.collection AND j.record_id=r.record_id AND j.revision=r.revision AND j.operation_id=mutation_id AND j.actor_role='operator'))) THEN RAISE EXCEPTION 'CHILD_VERIFIED_TRANSITION_INCOMPLETE' USING ERRCODE='23514'; END IF;
    IF NOT EXISTS(SELECT 1 FROM child_stewardship.signed_approvals a WHERE a.session_id=NEW.session_id AND a.operation_id=mutation_id AND a.approval_digest=admission.approval_digest AND encode(sha256(convert_to(a.envelope::text,'UTF8')),'hex')=admission.envelope_digest AND encode(sha256(convert_to(a.signatures::text,'UTF8')),'hex')=admission.signatures_digest) THEN RAISE EXCEPTION 'CHILD_VERIFIED_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
    SELECT envelope INTO signed FROM child_stewardship.signed_approvals WHERE session_id=NEW.session_id AND operation_id=mutation_id;
    IF signed IS NULL THEN RAISE EXCEPTION 'CHILD_SIGNED_APPROVAL_RECORD_REQUIRED' USING ERRCODE='23503'; END IF;
    IF signed->>'operationType' IS DISTINCT FROM mutation_operation AND mutation_operation<>'rights-op' THEN RAISE EXCEPTION 'CHILD_OPERATION_TYPE_MISMATCH' USING ERRCODE='23514'; END IF;
    IF NEW.collection='consumedNonces' AND signed->>'nonce'<>NEW.record_id THEN RAISE EXCEPTION 'CHILD_NONCE_OPERATION_MISMATCH' USING ERRCODE='23514'; END IF;
    operation_type:=signed->>'operationType'; amount:=(signed->>'amountMinor')::bigint;
    IF NEW.collection IN ('executedOperations','approvalRecords','audit') AND NEW.record_id<>signed->>'operationId' THEN RAISE EXCEPTION 'CHILD_OPERATION_RECORD_MISMATCH' USING ERRCODE='23514'; END IF;
    IF NEW.collection='destinations' THEN RAISE EXCEPTION 'CHILD_DESTINATION_GOVERNANCE_UNAVAILABLE' USING ERRCODE='23514'; END IF;
    IF NEW.collection='beneficiaries' THEN
      IF TG_OP='INSERT' THEN
        IF operation_type<>'REGISTER_BENEFICIARY' OR NEW.record_id<>signed->>'beneficiaryRef' OR NEW.payload->>'legalSubjectRef' IS DISTINCT FROM signed->'details'->>'legalSubjectRef' OR NEW.payload->>'guardianActorRef' IS DISTINCT FROM signed->'details'->>'guardianActorRef' THEN RAISE EXCEPTION 'CHILD_BENEFICIARY_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
      ELSE
        IF operation_type NOT IN ('ROTATE_GUARDIAN_KEY','RECOVER_GUARDIAN_KEY','CHANGE_GUARDIAN','CAPACITY_TRANSFER','LEGAL_CORRECTION') OR (NEW.payload->>'authorizationEpoch')::bigint<>(OLD.payload->>'authorizationEpoch')::bigint+1 THEN RAISE EXCEPTION 'CHILD_EPOCH_OPERATION_MISMATCH' USING ERRCODE='23514'; END IF;
        IF NEW.record_id<>signed->>'beneficiaryRef' AND NOT(operation_type='LEGAL_CORRECTION' AND NEW.record_id=signed->'details'->>'replacesBeneficiaryRef') THEN RAISE EXCEPTION 'CHILD_BENEFICIARY_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
        IF operation_type IN ('ROTATE_GUARDIAN_KEY','RECOVER_GUARDIAN_KEY','CHANGE_GUARDIAN') AND NEW.payload->>'guardianKeyId' IS DISTINCT FROM signed->'details'->>'newControllerRef' THEN RAISE EXCEPTION 'CHILD_RECOVERY_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
        IF operation_type='CHANGE_GUARDIAN' AND NEW.payload->>'guardianActorRef' IS DISTINCT FROM signed->'details'->>'guardianActorRef' THEN RAISE EXCEPTION 'CHILD_GUARDIAN_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
        IF operation_type='CAPACITY_TRANSFER' AND NEW.payload->>'participantKeyId' IS DISTINCT FROM signed->'details'->>'newControllerRef' THEN RAISE EXCEPTION 'CHILD_CAPACITY_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
      END IF;
    END IF;
    IF NEW.collection='entitlements' THEN
      IF NOT(signed->'entitlementIds' ? NEW.record_id) AND NOT(operation_type IN ('PAYMENT_RESULT','REFUND') AND EXISTS(SELECT 1 FROM child_stewardship.payment_facts WHERE session_id=NEW.session_id AND payout_id=signed->'details'->>'payoutId' AND entitlement_id=NEW.record_id)) THEN RAISE EXCEPTION 'CHILD_ENTITLEMENT_SCOPE_MISMATCH' USING ERRCODE='23514'; END IF;
      IF TG_OP='INSERT' THEN
        IF operation_type<>'RECORD_OBLIGATION' OR NEW.payload->>'beneficiaryRef' IS DISTINCT FROM signed->>'beneficiaryRef' OR (NEW.payload->>'amountMinor')::bigint<>amount OR NEW.payload->>'legalBasisRef' IS DISTINCT FROM signed->>'legalBasisRef' OR NEW.payload->>'obligorRef' IS DISTINCT FROM signed->'details'->>'obligorRef' THEN RAISE EXCEPTION 'CHILD_OBLIGATION_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
      ELSE
        IF NEW.payload->>'beneficiaryRef' IS DISTINCT FROM OLD.payload->>'beneficiaryRef' AND (operation_type<>'LEGAL_CORRECTION' OR NEW.payload->>'beneficiaryRef' IS DISTINCT FROM signed->'details'->>'replacesBeneficiaryRef') THEN RAISE EXCEPTION 'CHILD_CORRECTION_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
        IF (NEW.payload->>'paidMinor')::bigint<>(OLD.payload->>'paidMinor')::bigint THEN
          IF NOT((operation_type='PAYMENT_RESULT' AND signed->'details'->>'paymentStatus'='settled' AND (NEW.payload->>'paidMinor')::bigint-(OLD.payload->>'paidMinor')::bigint=amount) OR (operation_type='REFUND' AND (OLD.payload->>'paidMinor')::bigint-(NEW.payload->>'paidMinor')::bigint=amount)) THEN RAISE EXCEPTION 'CHILD_PAID_AMOUNT_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
        END IF;
        IF NEW.payload->>'legalState' IS DISTINCT FROM OLD.payload->>'legalState' AND operation_type<>'VEST' THEN RAISE EXCEPTION 'CHILD_VESTING_APPROVAL_REQUIRED' USING ERRCODE='23514'; END IF;
      END IF;
    END IF;
    IF NEW.collection='fundingLots' THEN
      IF TG_OP='INSERT' THEN
        IF operation_type<>'RECORD_CLEARED_FUNDING' OR NEW.record_id IS DISTINCT FROM signed->'details'->>'fundingLotId' OR (NEW.payload->>'clearedAssetsMinor')::bigint<>amount OR NEW.payload->>'clearingReceiptRef' IS DISTINCT FROM signed->'details'->>'clearingReceiptRef' THEN RAISE EXCEPTION 'CHILD_CLEARING_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
      ELSE
        old_assets:=(OLD.payload->>'clearedAssetsMinor')::bigint; new_assets:=(NEW.payload->>'clearedAssetsMinor')::bigint;
        IF old_assets<>new_assets AND NOT((operation_type='PAYMENT_RESULT' AND signed->'details'->>'paymentStatus'='settled' AND old_assets-new_assets=amount) OR (operation_type='REFUND' AND new_assets-old_assets=amount)) THEN RAISE EXCEPTION 'CHILD_ASSET_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
        target_entitlement:=signed->'entitlementIds'->>0;
        IF operation_type IN ('PAYMENT_RESULT','REFUND') THEN SELECT entitlement_id INTO target_entitlement FROM child_stewardship.payment_facts WHERE session_id=NEW.session_id AND payout_id=signed->'details'->>'payoutId'; END IF;
        IF operation_type<>'RESERVE_OUTCOME' THEN
          FOR item IN SELECT key,value FROM jsonb_each(NEW.payload->'allocations') LOOP
            IF item.value IS DISTINCT FROM OLD.payload->'allocations'->item.key AND item.key IS DISTINCT FROM target_entitlement THEN RAISE EXCEPTION 'CHILD_ALLOCATION_SCOPE_MISMATCH' USING ERRCODE='23514'; END IF;
          END LOOP;
          IF EXISTS(SELECT 1 FROM jsonb_object_keys(OLD.payload->'allocations') k WHERE NOT(NEW.payload->'allocations' ? k)) THEN RAISE EXCEPTION 'CHILD_ALLOCATION_ERASURE' USING ERRCODE='23514'; END IF;
        END IF;
        IF operation_type='RESERVE_FUNDING' AND NOT(signed->'fundingLotIds' ? NEW.record_id) THEN RAISE EXCEPTION 'CHILD_FUNDING_SCOPE_MISMATCH' USING ERRCODE='23514'; END IF;
      END IF;
    END IF;
    IF NEW.collection='payments' THEN
      IF TG_OP='INSERT' THEN
        IF operation_type NOT IN ('PAY_PROTECTED','PAY_EXCEPTIONAL','PAY_EMERGENCY') OR NEW.record_id IS DISTINCT FROM signed->'details'->>'payoutId' OR (NEW.payload->>'amountMinor')::bigint<>amount OR NEW.payload->>'beneficiaryRef' IS DISTINCT FROM signed->>'beneficiaryRef' OR NEW.payload->>'recipientBindingRef' IS DISTINCT FROM signed->>'recipientBindingRef' OR NEW.payload->>'recipientDestinationDigest' IS DISTINCT FROM signed->>'recipientDestinationDigest' OR NEW.payload->>'recipientBindingVersion' IS DISTINCT FROM signed->>'recipientBindingVersion' THEN RAISE EXCEPTION 'CHILD_PAYMENT_APPROVAL_MISMATCH' USING ERRCODE='23514'; END IF;
      ELSIF NEW.record_id IS DISTINCT FROM signed->'details'->>'payoutId' OR operation_type NOT IN ('PAYMENT_RESULT','REFUND') THEN RAISE EXCEPTION 'CHILD_PAYMENT_RESULT_SCOPE_MISMATCH' USING ERRCODE='23514'; END IF;
    END IF;
  END IF;
  PERFORM set_config('app.child_session_id',coalesce(original_tenant,''),true);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS canonical_authority_commit ON child_stewardship.state_records;
CREATE CONSTRAINT TRIGGER canonical_authority_commit AFTER INSERT OR UPDATE ON child_stewardship.state_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION child_stewardship.check_authority_commit();

CREATE TABLE IF NOT EXISTS child_stewardship.storage_version(version integer PRIMARY KEY CHECK(version=2), installed_at timestamptz NOT NULL DEFAULT clock_timestamp());
INSERT INTO child_stewardship.storage_version(version) VALUES(2) ON CONFLICT DO NOTHING;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
