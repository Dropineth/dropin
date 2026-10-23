-- Synthetic approved-static gateway. No model/provider or production role is enabled.
-- Apply after base, authority and resume migrations with migration authority.
BEGIN;
CREATE TABLE IF NOT EXISTS child_stewardship.agent_verifier_roles(
 database_role name NOT NULL,version bigint NOT NULL CHECK(version>0),enabled boolean NOT NULL,
 expires_at timestamptz NOT NULL,approval_ref text NOT NULL CHECK(length(approval_ref)>0),PRIMARY KEY(database_role,version)
);
CREATE TABLE IF NOT EXISTS child_stewardship.agent_registries(
 session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),version bigint NOT NULL CHECK(version>0),
 credentials jsonb NOT NULL CHECK(jsonb_typeof(credentials)='object'),delegations jsonb NOT NULL CHECK(jsonb_typeof(delegations)='object'),
 expires_at timestamptz NOT NULL,approval_ref text NOT NULL CHECK(length(approval_ref)>0),published_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,version)
);
CREATE TABLE IF NOT EXISTS child_stewardship.agent_admissions(
 session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),event_id text NOT NULL,actor_id text NOT NULL,nonce text NOT NULL,
 registry_version bigint NOT NULL,session_generation bigint NOT NULL,state_revision bigint NOT NULL,
 envelope_digest text NOT NULL CHECK(envelope_digest~'^[a-f0-9]{64}$'),signature_digest text NOT NULL CHECK(signature_digest~'^[a-f0-9]{64}$'),
 output_digest text NOT NULL CHECK(output_digest~'^[a-f0-9]{64}$'),expires_at timestamptz NOT NULL,
 transaction_id text NOT NULL DEFAULT pg_current_xact_id()::text,verified_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,event_id),UNIQUE(session_id,actor_id,nonce),FOREIGN KEY(session_id,registry_version) REFERENCES child_stewardship.agent_registries(session_id,version)
);
CREATE TABLE IF NOT EXISTS child_stewardship.agent_outputs(
 session_id uuid NOT NULL,event_id text NOT NULL,output jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,event_id),FOREIGN KEY(session_id,event_id) REFERENCES child_stewardship.agent_admissions(session_id,event_id)
);
CREATE TABLE IF NOT EXISTS child_stewardship.agent_audit(
 session_id uuid NOT NULL,event_id text NOT NULL,actor_id text NOT NULL,envelope_digest text NOT NULL,output_digest text NOT NULL,
 mode text NOT NULL DEFAULT 'approved_static_content' CHECK(mode='approved_static_content'),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(session_id,event_id),FOREIGN KEY(session_id,event_id) REFERENCES child_stewardship.agent_admissions(session_id,event_id)
);
CREATE OR REPLACE FUNCTION child_stewardship.agent_verifier_active() RETURNS boolean LANGUAGE plpgsql VOLATILE SET search_path=pg_catalog,child_stewardship AS $$
DECLARE conflict boolean;
BEGIN
 IF current_user<>session_user OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=current_user AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname<>current_user AND pg_has_role(current_user,oid,'MEMBER'))
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(nspowner)=current_user)
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(c.relowner)=current_user)
 OR NOT coalesce((SELECT enabled AND expires_at>clock_timestamp() FROM child_stewardship.agent_verifier_roles WHERE database_role=current_user ORDER BY version DESC LIMIT 1),false)
 OR EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(actor_role) enabled,expires_at FROM child_stewardship.service_role_scopes WHERE database_role=current_user ORDER BY actor_role,scope_version DESC) s WHERE enabled AND expires_at>clock_timestamp()) THEN RETURN false;END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship' AND c.relname='privacy_worker_roles') THEN
  EXECUTE 'SELECT coalesce((SELECT enabled AND expires_at>clock_timestamp() FROM child_stewardship.privacy_worker_roles WHERE database_role=current_user ORDER BY scope_version DESC LIMIT 1),false)' INTO conflict;IF conflict THEN RETURN false;END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship' AND c.relname='media_roles') THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(scope) enabled,expires_at FROM child_stewardship.media_roles WHERE database_role=current_user ORDER BY scope,scope_version DESC) s WHERE enabled AND expires_at>clock_timestamp())' INTO conflict;IF conflict THEN RETURN false;END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship_webauthn' AND c.relname='verifier_roles') THEN
  EXECUTE 'SELECT EXISTS(SELECT 1 FROM child_stewardship_webauthn.verifier_roles WHERE database_role=current_user AND enabled AND expires_at>clock_timestamp())' INTO conflict;IF conflict THEN RETURN false;END IF;
 END IF;
 IF to_regclass('child_stewardship.restore_verifier_roles') IS NOT NULL THEN
  EXECUTE 'SELECT coalesce((SELECT enabled AND expires_at>clock_timestamp() FROM child_stewardship.restore_verifier_roles WHERE database_role=current_user ORDER BY scope_version DESC LIMIT 1),false)' INTO conflict;IF conflict THEN RETURN false;END IF;
 END IF;
 RETURN true;
END
$$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_agent_registry() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,child_stewardship AS $$
DECLARE owner_name name;previous bigint;
BEGIN
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid=TG_RELID;
 IF current_user<>owner_name OR TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_AGENT_REGISTRY_OWNER_APPEND_ONLY' USING ERRCODE='42501';END IF;
 IF TG_TABLE_NAME='agent_registries' THEN
  PERFORM 1 FROM child_stewardship.sessions WHERE id=NEW.session_id FOR UPDATE;
  SELECT max(version) INTO previous FROM child_stewardship.agent_registries WHERE session_id=NEW.session_id;
 ELSE SELECT max(version) INTO previous FROM child_stewardship.agent_verifier_roles WHERE database_role=NEW.database_role;END IF;
 IF NEW.version<>coalesce(previous,0)+1 THEN RAISE EXCEPTION 'CHILD_AGENT_REGISTRY_VERSION' USING ERRCODE='23514';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS agent_registry_guard ON child_stewardship.agent_registries;
CREATE TRIGGER agent_registry_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.agent_registries FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_agent_registry();
DROP TRIGGER IF EXISTS agent_role_guard ON child_stewardship.agent_verifier_roles;
CREATE TRIGGER agent_role_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.agent_verifier_roles FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_agent_registry();
CREATE OR REPLACE FUNCTION child_stewardship.guard_agent_result() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,child_stewardship AS $$
DECLARE admission child_stewardship.agent_admissions%ROWTYPE;current_revision bigint;current_generation bigint;current_status text;registry bigint;restore_allowed boolean;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_AGENT_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF NOT child_stewardship.agent_verifier_active() THEN RAISE EXCEPTION 'CHILD_AGENT_VERIFIER_REQUIRED' USING ERRCODE='42501';END IF;
 IF NEW.session_id::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RAISE EXCEPTION 'CHILD_AGENT_TENANT_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT revision INTO current_revision FROM child_stewardship.sessions WHERE id=NEW.session_id AND mode='synthetic-demo' AND expires_at>clock_timestamp() FOR UPDATE;
 IF current_revision IS NULL THEN RAISE EXCEPTION 'CHILD_AGENT_SESSION_EXPIRED' USING ERRCODE='42501';END IF;
 IF to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL THEN
  EXECUTE 'SELECT child_stewardship.restore_execution_permitted($1)' INTO restore_allowed USING NEW.session_id;
  IF restore_allowed IS DISTINCT FROM true THEN RAISE EXCEPTION 'CHILD_AGENT_RESTORE_QUARANTINED' USING ERRCODE='42501';END IF;
 END IF;
 IF TG_TABLE_NAME='agent_admissions' THEN
  SELECT generation,state INTO current_generation,current_status FROM child_stewardship.session_resumption WHERE session_id=NEW.session_id;
  SELECT version INTO registry FROM child_stewardship.agent_registries WHERE session_id=NEW.session_id ORDER BY version DESC LIMIT 1;
  IF current_status IS NOT NULL AND current_status<>'active' OR NEW.session_generation<>coalesce(current_generation,0)
    OR NEW.state_revision<>current_revision OR NEW.registry_version IS DISTINCT FROM registry OR NEW.expires_at<=clock_timestamp()
    OR NEW.transaction_id<>pg_current_xact_id()::text THEN RAISE EXCEPTION 'CHILD_AGENT_STALE_ADMISSION' USING ERRCODE='42501';END IF;
 ELSE
  SELECT * INTO admission FROM child_stewardship.agent_admissions WHERE session_id=NEW.session_id AND event_id=NEW.event_id;
  IF admission.transaction_id IS DISTINCT FROM pg_current_xact_id()::text OR admission.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'CHILD_AGENT_ADMISSION_REQUIRED' USING ERRCODE='42501';END IF;
  IF TG_TABLE_NAME='agent_outputs' THEN
   IF NEW.output->>'outputDigest' IS DISTINCT FROM admission.output_digest
     OR NEW.output->>'schema' IS DISTINCT FROM 'CanopyProof-StaticAgentReceipt/1'
     OR (SELECT array_agg(key ORDER BY key) FROM jsonb_object_keys(NEW.output) key) IS DISTINCT FROM ARRAY['finalAuthority','outputDigest','schema','source','syntheticOnly']::text[]
     OR NEW.output->>'finalAuthority' IS DISTINCT FROM 'false' OR NEW.output->>'syntheticOnly' IS DISTINCT FROM 'true'
     OR NEW.output->>'source' IS DISTINCT FROM 'approved-static-learning-v1' THEN RAISE EXCEPTION 'CHILD_AGENT_OUTPUT_MISMATCH' USING ERRCODE='42501';END IF;
  ELSE
   IF NEW.actor_id<>admission.actor_id OR NEW.envelope_digest<>admission.envelope_digest OR NEW.output_digest<>admission.output_digest THEN RAISE EXCEPTION 'CHILD_AGENT_AUDIT_MISMATCH' USING ERRCODE='42501';END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$DECLARE name text;BEGIN
 FOREACH name IN ARRAY ARRAY['agent_registries','agent_admissions','agent_outputs','agent_audit'] LOOP
  EXECUTE format('ALTER TABLE child_stewardship.%I ENABLE ROW LEVEL SECURITY',name);
  EXECUTE format('ALTER TABLE child_stewardship.%I FORCE ROW LEVEL SECURITY',name);
  EXECUTE format('DROP POLICY IF EXISTS agent_tenant ON child_stewardship.%I',name);
  EXECUTE format('CREATE POLICY agent_tenant ON child_stewardship.%I USING(session_id::text=current_setting(''app.child_session_id'',true)) WITH CHECK(session_id::text=current_setting(''app.child_session_id'',true))',name);
  IF name<>'agent_registries' THEN
   EXECUTE format('DROP TRIGGER IF EXISTS agent_result_guard ON child_stewardship.%I',name);
   EXECUTE format('CREATE TRIGGER agent_result_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_agent_result()',name);
  END IF;
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.agent_result_complete() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,child_stewardship AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM child_stewardship.agent_outputs WHERE session_id=NEW.session_id AND event_id=NEW.event_id)
 OR NOT EXISTS(SELECT 1 FROM child_stewardship.agent_audit WHERE session_id=NEW.session_id AND event_id=NEW.event_id)
 THEN RAISE EXCEPTION 'CHILD_AGENT_RESULT_INCOMPLETE' USING ERRCODE='23514';END IF;
 RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS agent_result_complete ON child_stewardship.agent_admissions;
CREATE CONSTRAINT TRIGGER agent_result_complete AFTER INSERT ON child_stewardship.agent_admissions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION child_stewardship.agent_result_complete();
COMMIT;
