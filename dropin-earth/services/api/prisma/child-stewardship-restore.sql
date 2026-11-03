-- Optional strict restore gate. Installing this module leaves all sessions
-- quarantined until a separately scoped verifier admits the exact restored state.
BEGIN;
CREATE TABLE IF NOT EXISTS child_stewardship.restore_verifier_roles(
 database_role name NOT NULL,scope_version bigint NOT NULL CHECK(scope_version>0),enabled boolean NOT NULL,approval_ref text NOT NULL,expires_at timestamptz NOT NULL,PRIMARY KEY(database_role,scope_version)
);
CREATE OR REPLACE FUNCTION child_stewardship.restore_database_role() RETURNS name LANGUAGE sql STABLE AS $$
 SELECT CASE WHEN coalesce(current_setting('role',true),'none') IN('none','') THEN session_user ELSE current_setting('role',true)::name END
$$;
CREATE OR REPLACE FUNCTION child_stewardship.is_restore_verifier() RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
 SELECT coalesce((SELECT enabled AND expires_at>clock_timestamp() FROM child_stewardship.restore_verifier_roles WHERE database_role=child_stewardship.restore_database_role() ORDER BY scope_version DESC LIMIT 1),false)
$$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_restore_role() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,child_stewardship AS $$
DECLARE owner_name name;relation text;conflicting boolean;BEGIN
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid=TG_RELID;
 IF TG_OP<>'INSERT' OR current_user<>owner_name THEN RAISE EXCEPTION 'CHILD_RESTORE_SCOPE_ADMIN_ONLY' USING ERRCODE='42501';END IF;
 IF NEW.scope_version<=coalesce((SELECT max(scope_version) FROM child_stewardship.restore_verifier_roles WHERE database_role=NEW.database_role),0) THEN RAISE EXCEPTION 'CHILD_RESTORE_SCOPE_VERSION' USING ERRCODE='23514';END IF;
 FOREACH relation IN ARRAY ARRAY['child_stewardship.service_role_scopes','child_stewardship.privacy_worker_roles','child_stewardship.media_roles','child_stewardship.agent_verifier_roles','child_stewardship_webauthn.verifier_roles'] LOOP
  IF to_regclass(relation) IS NOT NULL THEN
   EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s WHERE database_role=$1 AND enabled)',to_regclass(relation)) INTO conflicting USING NEW.database_role;
   IF NEW.enabled AND conflicting THEN RAISE EXCEPTION 'CHILD_RESTORE_SCOPE_MUST_BE_SEPARATE' USING ERRCODE='42501';END IF;
  END IF;
 END LOOP;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS restore_scope_guard ON child_stewardship.restore_verifier_roles;
CREATE TRIGGER restore_scope_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.restore_verifier_roles FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_restore_role();
CREATE OR REPLACE FUNCTION child_stewardship.guard_restore_scope_conflict() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$ BEGIN
 IF NEW.enabled AND EXISTS(SELECT 1 FROM child_stewardship.restore_verifier_roles WHERE database_role=NEW.database_role AND enabled) THEN RAISE EXCEPTION 'CHILD_RESTORE_SCOPE_MUST_BE_SEPARATE' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
DO $$ DECLARE relation text;BEGIN
 FOREACH relation IN ARRAY ARRAY['child_stewardship.service_role_scopes','child_stewardship.privacy_worker_roles','child_stewardship.media_roles','child_stewardship.agent_verifier_roles','child_stewardship_webauthn.verifier_roles'] LOOP
  IF to_regclass(relation) IS NOT NULL THEN
   EXECUTE format('DROP TRIGGER IF EXISTS restore_scope_conflict ON %s',to_regclass(relation));EXECUTE format('CREATE TRIGGER restore_scope_conflict BEFORE INSERT OR UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_restore_scope_conflict()',to_regclass(relation));
  END IF;
 END LOOP;
END $$;
CREATE TABLE IF NOT EXISTS child_stewardship.restore_quarantines(
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
 instance_id uuid NOT NULL,database_oid oid NOT NULL,anchor_digest text NOT NULL CHECK(anchor_digest~'^[a-f0-9]{64}$'),checkpoint_id text NOT NULL,checkpoint_sequence bigint NOT NULL CHECK(checkpoint_sequence>0),recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE IF NOT EXISTS child_stewardship.restore_admissions(
 quarantine_sequence bigint PRIMARY KEY REFERENCES child_stewardship.restore_quarantines(sequence),session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
 checkpoint_digest text NOT NULL CHECK(checkpoint_digest~'^[a-f0-9]{64}$'),anchor_digest text NOT NULL CHECK(anchor_digest~'^[a-f0-9]{64}$'),canonical_root text NOT NULL,security_root text NOT NULL,privacy_root text NOT NULL,
 admitted_revision bigint NOT NULL CHECK(admitted_revision>=0),signer_key_ids jsonb NOT NULL CHECK(jsonb_typeof(signer_key_ids)='array' AND jsonb_array_length(signer_key_ids)>=2),admitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),expires_at timestamptz NOT NULL
);
CREATE OR REPLACE FUNCTION child_stewardship.restore_state_roots(tenant uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship SET TimeZone='UTC' AS $$
DECLARE owner_name name;kind text;relations text[];relation text;rows jsonb;aggregate jsonb;result jsonb:='{}';sandbox uuid;part jsonb;prior_sandbox text:=current_setting('app.webauthn_sandbox',true);BEGIN
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='child_stewardship.restore_admissions'::regclass;
 IF tenant::text IS DISTINCT FROM current_setting('app.child_session_id',true) OR (child_stewardship.restore_database_role()<>owner_name AND NOT child_stewardship.is_restore_verifier()) THEN RAISE EXCEPTION 'CHILD_RESTORE_READER_REQUIRED' USING ERRCODE='42501';END IF;
 FOREACH kind IN ARRAY ARRAY['canonical','security','privacy'] LOOP
  relations:=CASE kind WHEN 'canonical' THEN ARRAY['state_records','entitlement_balances','funding_balances','payment_facts','contribution_keys','economic_keys','rights_operations','signed_approvals','authority_journal','audit','outbox','media_assets','media_reviews','media_canonical_keys','agent_outputs','agent_audit'] WHEN 'security' THEN ARRAY['subject_epochs','credential_revocations','registry_checkpoints','rights_nonces','session_resumption','session_tokens','resume_token_lookup','resume_tickets','resume_mints','draft_authorizations','draft_authorization_uses','verification_admissions','verification_uses','receipts','registry_decisions','registry_decision_uses','agent_registries','agent_admissions','session_births'] ELSE ARRAY['privacy_suppressions','privacy_jobs','privacy_plan_items','privacy_receipts','privacy_legal_holds','privacy_objects'] END;
  aggregate:='{}';
  FOREACH relation IN ARRAY relations LOOP
   IF to_regclass('child_stewardship.'||relation) IS NULL THEN rows:='null'::jsonb;
   ELSE EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text COLLATE "C"),''[]''::jsonb) FROM child_stewardship.%I r WHERE session_id=$1',relation) INTO rows USING tenant;END IF;
   aggregate:=aggregate||jsonb_build_object(relation,rows);
  END LOOP;
  IF kind='security' THEN
   -- Guardian product sessions and their authentication sources are part of the
   -- revocation/replay floor. New schema changes roots; old checkpoints cannot
   -- authorize it silently. Never omit authentication state from backups.
   IF to_regclass('child_stewardship_guardian.bindings') IS NOT NULL THEN
    IF current_user<>pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='child_stewardship_guardian.bindings'::regclass)) THEN RAISE EXCEPTION 'CHILD_RESTORE_GUARDIAN_READER_REQUIRED';END IF;
    EXECUTE 'SELECT coalesce(jsonb_agg(to_jsonb(b) ORDER BY b.id),''[]''::jsonb) FROM child_stewardship_guardian.bindings b WHERE session_id=$1' INTO rows USING tenant;
    aggregate:=aggregate||jsonb_build_object('guardian_bindings',rows);
    FOREACH relation IN ARRAY ARRAY['sessions','audit'] LOOP
     EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY to_jsonb(s)::text COLLATE "C"),''[]''::jsonb) FROM child_stewardship_guardian.%I s JOIN child_stewardship_guardian.bindings b ON b.id=s.binding_id WHERE b.session_id=$1',relation) INTO rows USING tenant;
     aggregate:=aggregate||jsonb_build_object('guardian_'||relation,rows);
    END LOOP;
    FOREACH relation IN ARRAY ARRAY['sandboxes','credentials','sessions','ceremonies','audit'] LOOP
     rows:='[]'::jsonb;
     FOR sandbox IN EXECUTE 'SELECT sandbox_id FROM child_stewardship_guardian.bindings WHERE session_id=$1 ORDER BY sandbox_id' USING tenant LOOP
      PERFORM set_config('app.webauthn_sandbox',sandbox::text,true);
      EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(s) ORDER BY to_jsonb(s)::text COLLATE "C"),''[]''::jsonb) FROM child_stewardship_webauthn.%I s WHERE s.%I=$1',relation,CASE WHEN relation='sandboxes' THEN 'id' ELSE 'sandbox_id' END) INTO part USING sandbox;
      IF relation='sandboxes' AND jsonb_array_length(part)<>1 THEN RAISE EXCEPTION 'CHILD_RESTORE_GUARDIAN_STATE_MISSING';END IF;
      rows:=rows||part;
     END LOOP;
     aggregate:=aggregate||jsonb_build_object('guardian_webauthn_'||relation,rows);
    END LOOP;
    PERFORM set_config('app.webauthn_sandbox',coalesce(prior_sandbox,''),true);
   END IF;
   FOREACH relation IN ARRAY ARRAY['child_stewardship.service_role_scopes','child_stewardship.privacy_worker_roles','child_stewardship.media_roles','child_stewardship.agent_verifier_roles','child_stewardship_webauthn.verifier_roles','child_stewardship.restore_verifier_roles','child_stewardship.media_fixture_allowlist'] LOOP
    IF to_regclass(relation) IS NULL THEN rows:='null'::jsonb;
    ELSE EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text COLLATE "C"),''[]''::jsonb) FROM %s r',to_regclass(relation)) INTO rows;END IF;
    aggregate:=aggregate||jsonb_build_object(relation,rows);
   END LOOP;
  END IF;
  result:=result||jsonb_build_object(kind,encode(sha256(convert_to(aggregate::text,'UTF8')),'hex'));
 END LOOP;RETURN result;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_restore_fact() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE latest child_stewardship.restore_quarantines%ROWTYPE;roots jsonb;revision_value bigint;BEGIN
 IF TG_OP<>'INSERT' OR NOT child_stewardship.is_restore_verifier() OR NEW.session_id::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RAISE EXCEPTION 'CHILD_RESTORE_VERIFIER_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT revision INTO revision_value FROM child_stewardship.sessions WHERE id=NEW.session_id FOR UPDATE;
 IF TG_TABLE_NAME='restore_quarantines' THEN
  IF NEW.database_oid IS DISTINCT FROM (SELECT oid FROM pg_database WHERE datname=current_database()) THEN RAISE EXCEPTION 'CHILD_RESTORE_TARGET_MISMATCH' USING ERRCODE='42501';END IF;
  IF EXISTS(SELECT 1 FROM child_stewardship.restore_quarantines WHERE session_id=NEW.session_id AND checkpoint_sequence>NEW.checkpoint_sequence) THEN RAISE EXCEPTION 'CHILD_RESTORE_CHECKPOINT_ROLLBACK' USING ERRCODE='42501';END IF;
 ELSE
  SELECT * INTO latest FROM child_stewardship.restore_quarantines WHERE session_id=NEW.session_id ORDER BY sequence DESC LIMIT 1;
  roots:=child_stewardship.restore_state_roots(NEW.session_id);
  IF latest.sequence IS DISTINCT FROM NEW.quarantine_sequence OR latest.database_oid IS DISTINCT FROM (SELECT oid FROM pg_database WHERE datname=current_database()) OR latest.anchor_digest IS DISTINCT FROM NEW.anchor_digest OR NEW.admitted_revision IS DISTINCT FROM revision_value
   OR NEW.canonical_root IS DISTINCT FROM roots->>'canonical' OR NEW.security_root IS DISTINCT FROM roots->>'security' OR NEW.privacy_root IS DISTINCT FROM roots->>'privacy' OR NEW.expires_at<=clock_timestamp() OR NEW.expires_at>clock_timestamp()+interval '1 hour' THEN RAISE EXCEPTION 'CHILD_RESTORE_ADMISSION_MISMATCH' USING ERRCODE='42501';END IF;
 END IF;RETURN NEW;
END $$;
DO $$ DECLARE relation text;BEGIN
 FOREACH relation IN ARRAY ARRAY['restore_quarantines','restore_admissions'] LOOP
  EXECUTE format('ALTER TABLE child_stewardship.%I ENABLE ROW LEVEL SECURITY',relation);EXECUTE format('ALTER TABLE child_stewardship.%I FORCE ROW LEVEL SECURITY',relation);
  EXECUTE format('DROP POLICY IF EXISTS restore_tenant ON child_stewardship.%I',relation);EXECUTE format('CREATE POLICY restore_tenant ON child_stewardship.%I USING(session_id::text=current_setting(''app.child_session_id'',true)) WITH CHECK(session_id::text=current_setting(''app.child_session_id'',true))',relation);
  EXECUTE format('DROP TRIGGER IF EXISTS restore_fact_guard ON child_stewardship.%I',relation);EXECUTE format('CREATE TRIGGER restore_fact_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_restore_fact()',relation);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.restore_cleanup_permitted(tenant uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
 SELECT coalesce(tenant::text=current_setting('app.child_session_id',true) AND EXISTS(
  SELECT 1 FROM child_stewardship.restore_quarantines q JOIN child_stewardship.restore_admissions a ON a.quarantine_sequence=q.sequence JOIN child_stewardship.sessions s ON s.id=q.session_id
  WHERE q.session_id=tenant AND q.sequence=(SELECT max(sequence) FROM child_stewardship.restore_quarantines WHERE session_id=tenant)
   AND q.database_oid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND a.expires_at>clock_timestamp() AND s.revision>=a.admitted_revision AND a.anchor_digest=q.anchor_digest),false)
$$;
-- Application startup supplies these three values from outside the restored DB.
CREATE OR REPLACE FUNCTION child_stewardship.restore_cleanup_anchor_current(tenant uuid,expected_checkpoint_id text,expected_sequence bigint,expected_digest text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
 SELECT coalesce(child_stewardship.restore_cleanup_permitted(tenant) AND EXISTS(
  SELECT 1 FROM child_stewardship.restore_quarantines q JOIN child_stewardship.restore_admissions a ON a.quarantine_sequence=q.sequence
  WHERE q.session_id=tenant AND q.sequence=(SELECT max(sequence) FROM child_stewardship.restore_quarantines WHERE session_id=tenant)
    AND q.checkpoint_id=expected_checkpoint_id AND q.checkpoint_sequence=expected_sequence AND a.checkpoint_digest=expected_digest AND q.anchor_digest=expected_digest),false)
$$;
CREATE OR REPLACE FUNCTION child_stewardship.restore_execution_permitted(tenant uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
 SELECT coalesce(tenant::text=current_setting('app.child_session_id',true) AND EXISTS(
  SELECT 1 FROM child_stewardship.restore_quarantines q JOIN child_stewardship.restore_admissions a ON a.quarantine_sequence=q.sequence JOIN child_stewardship.sessions s ON s.id=q.session_id
  WHERE q.session_id=tenant AND q.sequence=(SELECT max(sequence) FROM child_stewardship.restore_quarantines WHERE session_id=tenant)
   AND q.database_oid=(SELECT oid FROM pg_database WHERE datname=current_database()) AND a.expires_at>clock_timestamp() AND s.expires_at>clock_timestamp() AND s.revision>=a.admitted_revision AND a.anchor_digest=q.anchor_digest),false)
$$;
-- Application startup supplies these three values from outside the restored DB.
CREATE OR REPLACE FUNCTION child_stewardship.restore_anchor_current(tenant uuid,expected_checkpoint_id text,expected_sequence bigint,expected_digest text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
 SELECT coalesce(child_stewardship.restore_execution_permitted(tenant) AND EXISTS(
  SELECT 1 FROM child_stewardship.restore_quarantines q JOIN child_stewardship.restore_admissions a ON a.quarantine_sequence=q.sequence
  WHERE q.session_id=tenant AND q.sequence=(SELECT max(sequence) FROM child_stewardship.restore_quarantines WHERE session_id=tenant)
    AND q.checkpoint_id=expected_checkpoint_id AND q.checkpoint_sequence=expected_sequence AND a.checkpoint_digest=expected_digest AND q.anchor_digest=expected_digest),false)
$$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_restore_execution() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE tenant uuid;BEGIN
 tenant:=CASE WHEN TG_OP='DELETE' THEN OLD.session_id ELSE NEW.session_id END;
 IF NOT child_stewardship.restore_execution_permitted(tenant) THEN
  IF child_stewardship.restore_cleanup_permitted(tenant) AND child_stewardship.is_privacy_worker() AND (
   (TG_TABLE_NAME='state_records' AND TG_OP='DELETE') OR (TG_TABLE_NAME='privacy_objects' AND TG_OP='DELETE') OR
   (TG_TABLE_NAME='privacy_jobs' AND TG_OP='UPDATE') OR (TG_TABLE_NAME IN('privacy_plan_items','privacy_receipts') AND TG_OP='INSERT')) THEN
   IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
  END IF;
  RAISE EXCEPTION 'CHILD_RESTORE_QUARANTINED' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD;END IF;RETURN NEW;
END $$;
DO $$ DECLARE relation text;BEGIN
 FOREACH relation IN ARRAY ARRAY['state_records','session_tokens','session_resumption','resume_tickets','resume_mints','draft_authorizations','draft_authorization_uses','verification_admissions','verification_uses','registry_decisions','registry_decision_uses','agent_registries','agent_admissions','agent_outputs','agent_audit','media_assets','media_reviews','privacy_jobs','privacy_plan_items','privacy_receipts','privacy_objects','privacy_suppressions','privacy_legal_holds'] LOOP
  IF to_regclass('child_stewardship.'||relation) IS NOT NULL THEN
   EXECUTE format('DROP TRIGGER IF EXISTS restore_execution_guard ON child_stewardship.%I',relation);EXECUTE format('CREATE TRIGGER restore_execution_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_restore_execution()',relation);
  END IF;
 END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
