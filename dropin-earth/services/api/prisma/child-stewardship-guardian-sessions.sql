-- Apply after child-stewardship authority, resume and WebAuthn migrations.
-- Synthetic product-session bridge only. No role grants, enrollment, legal
-- identity claims, production credentials or recovery bypass are installed.
BEGIN;
CREATE SCHEMA IF NOT EXISTS child_stewardship_guardian;
CREATE TABLE IF NOT EXISTS child_stewardship_guardian.bindings (
 id uuid PRIMARY KEY, session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
 sandbox_id uuid NOT NULL UNIQUE REFERENCES child_stewardship_webauthn.sandboxes(id),
 actor_id text NOT NULL, device_id text NOT NULL, actor_epoch integer NOT NULL CHECK(actor_epoch>0),
 generation bigint NOT NULL CHECK(generation>=0), profile_id text NOT NULL,
 guardian_link_version integer NOT NULL CHECK(guardian_link_version>0),
 credential_id text NOT NULL, credential_epoch bigint NOT NULL CHECK(credential_epoch>0),
 approval_ref text NOT NULL CHECK(length(approval_ref)>0),
 bound_at timestamptz NOT NULL DEFAULT clock_timestamp(), expires_at timestamptz NOT NULL,
 revoked boolean NOT NULL DEFAULT false, CHECK(expires_at>bound_at)
);
CREATE TABLE IF NOT EXISTS child_stewardship_guardian.sessions (
 token_hash text PRIMARY KEY CHECK(token_hash~'^[a-f0-9]{64}$'),
 binding_id uuid NOT NULL REFERENCES child_stewardship_guardian.bindings(id),
 authentication_id uuid NOT NULL UNIQUE REFERENCES child_stewardship_webauthn.sessions(id),
 created_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
 revoked boolean NOT NULL DEFAULT false,
 CHECK(expires_at>created_at AND expires_at<=created_at+interval '10 minutes')
);
CREATE TABLE IF NOT EXISTS child_stewardship_guardian.audit (
 sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 binding_id uuid NOT NULL REFERENCES child_stewardship_guardian.bindings(id),
 action text NOT NULL CHECK(action IN ('exchange','logout')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE OR REPLACE FUNCTION child_stewardship_guardian.guard_write() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,child_stewardship_guardian AS $$
DECLARE owner_name name;
BEGIN
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='child_stewardship_guardian.bindings'::regclass;
 IF current_user<>owner_name THEN RAISE EXCEPTION 'GUARDIAN_AUTH_FUNCTION_REQUIRED' USING ERRCODE='42501';END IF;
 IF TG_OP='DELETE' OR (TG_TABLE_NAME='audit' AND TG_OP<>'INSERT') THEN RAISE EXCEPTION 'GUARDIAN_AUTH_IMMUTABLE';END IF;
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW)-'revoked') IS DISTINCT FROM (to_jsonb(OLD)-'revoked') OR OLD.revoked OR NOT NEW.revoked
  THEN RAISE EXCEPTION 'GUARDIAN_AUTH_IMMUTABLE';END IF;
 END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE relation text; BEGIN
 FOREACH relation IN ARRAY ARRAY['bindings','sessions','audit'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS guardian_auth_guard ON child_stewardship_guardian.%I',relation);
  EXECUTE format('CREATE TRIGGER guardian_auth_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship_guardian.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship_guardian.guard_write()',relation);
  EXECUTE format('ALTER TABLE child_stewardship_guardian.%I ENABLE ROW LEVEL SECURITY',relation);
  EXECUTE format('ALTER TABLE child_stewardship_guardian.%I FORCE ROW LEVEL SECURITY',relation);
  EXECUTE format('DROP POLICY IF EXISTS owner_only ON child_stewardship_guardian.%I',relation);
  EXECUTE format('CREATE POLICY owner_only ON child_stewardship_guardian.%I USING (current_user=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid=''child_stewardship_guardian.bindings''::regclass)))',relation);
 END LOOP;
END $$;
-- session_user is the actual database login, not a caller-controlled GUC or
-- SECURITY DEFINER's current_user. Auth verifier and product runtime stay separate.
CREATE OR REPLACE FUNCTION child_stewardship_guardian.runtime_allowed() RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path=pg_catalog,child_stewardship_guardian AS $$
 SELECT coalesce((SELECT enabled AND expires_at>clock_timestamp() FROM child_stewardship.service_role_scopes
  WHERE database_role=session_user AND actor_role='guardian' ORDER BY scope_version DESC LIMIT 1),false)
 AND coalesce(current_setting('role',true),'none') IN ('none','',session_user::text)
 AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname=session_user AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb)
 AND NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname<>session_user AND pg_has_role(session_user,oid,'MEMBER'))
 AND NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('child_stewardship','child_stewardship_guardian','child_stewardship_webauthn') AND pg_get_userbyid(nspowner)=session_user)
 AND NOT EXISTS(SELECT 1 FROM child_stewardship_webauthn.verifier_roles WHERE database_role=session_user AND enabled AND expires_at>clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(actor_role) actor_role,enabled,expires_at FROM child_stewardship.service_role_scopes WHERE database_role=session_user ORDER BY actor_role,scope_version DESC) s WHERE actor_role IN ('operation-verifier','registry-publisher') AND enabled AND expires_at>clock_timestamp())
$$;
-- Raw-secret lookup is used only to select the tenant for the independent restore
-- anchor check. It does not authenticate or release data. No known-hash lookup.
CREATE OR REPLACE FUNCTION child_stewardship_guardian.capability_session(raw text,binding uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship_guardian AS $$
DECLARE target uuid; sb uuid;
BEGIN
 IF NOT runtime_allowed() THEN RETURN NULL;END IF;
 IF raw~'^cp-guardian\.[A-Za-z0-9_-]{43}$' AND binding IS NULL THEN
  SELECT b.session_id INTO target FROM sessions s JOIN bindings b ON b.id=s.binding_id
   WHERE s.token_hash=encode(sha256(convert_to(raw,'UTF8')),'hex');
 ELSIF raw~'^[A-Za-z0-9_-]{43}$' AND binding IS NOT NULL THEN
  SELECT sandbox_id INTO sb FROM bindings WHERE id=binding;
  PERFORM set_config('app.webauthn_sandbox',coalesce(sb::text,''),true);
  SELECT b.session_id INTO target FROM bindings b JOIN child_stewardship_webauthn.sessions s ON s.sandbox_id=b.sandbox_id
   WHERE b.id=binding AND s.token_hash=encode(sha256(convert_to(raw,'UTF8')),'hex');
 END IF;
 RETURN target;
END $$;
-- Internal only. The linearization order is child tenant -> binding -> WebAuthn
-- sandbox -> credential. Domain writes/revocation use the same tenant lock;
-- WebAuthn revocation uses the sandbox lock and never requests a child lock.
CREATE OR REPLACE FUNCTION child_stewardship_guardian.current_binding(binding uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship_guardian AS $$
DECLARE b bindings%ROWTYPE; tenant child_stewardship.sessions%ROWTYPE;
 sb child_stewardship_webauthn.sandboxes%ROWTYPE; credential child_stewardship_webauthn.credentials%ROWTYPE;
 actor jsonb; link jsonb; generation bigint; resume_state text; moment timestamptz; restore_allowed boolean;
BEGIN
 IF NOT runtime_allowed() THEN RETURN NULL;END IF;
 SELECT * INTO b FROM bindings WHERE id=binding;
 IF NOT FOUND THEN RETURN NULL;END IF;
 PERFORM set_config('app.child_session_id',b.session_id::text,true);
 SELECT * INTO tenant FROM child_stewardship.sessions WHERE id=b.session_id FOR UPDATE;
 SELECT * INTO b FROM bindings WHERE id=binding FOR SHARE;
 PERFORM set_config('app.webauthn_sandbox',b.sandbox_id::text,true);
 SELECT * INTO sb FROM child_stewardship_webauthn.sandboxes WHERE id=b.sandbox_id FOR UPDATE;
 SELECT * INTO credential FROM child_stewardship_webauthn.credentials WHERE sandbox_id=b.sandbox_id FOR SHARE;
 SELECT payload INTO actor FROM child_stewardship.state_records WHERE session_id=b.session_id AND domain='learning' AND collection='actors' AND record_id=b.actor_id;
 SELECT payload INTO link FROM child_stewardship.state_records WHERE session_id=b.session_id AND domain='learning' AND collection='guardianLinks' AND record_id=b.profile_id;
 SELECT r.generation,r.state INTO generation,resume_state FROM child_stewardship.session_resumption r WHERE session_id=b.session_id;
 IF to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL THEN
  EXECUTE 'SELECT child_stewardship.restore_execution_permitted($1)' INTO restore_allowed USING b.session_id;
  IF restore_allowed IS DISTINCT FROM true THEN RETURN NULL;END IF;
 END IF;
 moment:=clock_timestamp();
 IF NOT runtime_allowed() OR b.revoked OR b.expires_at<=moment OR tenant.id IS NULL OR tenant.mode<>'synthetic-demo' OR tenant.storage_format<>'normalized-v2' OR tenant.expires_at<=moment
  OR sb.id IS NULL OR sb.revoked OR sb.expires_at<=moment OR sb.epoch<>b.credential_epoch
  OR credential.sandbox_id IS NULL OR credential.revoked OR credential.epoch<>b.credential_epoch OR credential.credential_id<>b.credential_id
  OR coalesce(generation,0)<>b.generation OR coalesce(resume_state,'active')<>'active'
  OR actor IS NULL OR actor->>'role' IS DISTINCT FROM 'guardian' OR actor->>'revoked' IS DISTINCT FROM 'false'
  OR (actor->>'epoch')::integer IS DISTINCT FROM b.actor_epoch OR NOT coalesce((actor->'deviceIds')?b.device_id,false) OR (actor->>'expiresAt')::timestamptz<=moment
  OR link IS NULL OR link->>'guardianActorId' IS DISTINCT FROM b.actor_id OR (link->>'version')::integer IS DISTINCT FROM b.guardian_link_version
  OR (link->>'expiresAt')::timestamptz<=moment THEN RETURN NULL;END IF;
 RETURN jsonb_build_object('sessionId',b.session_id,'principal',jsonb_build_object('actorId',b.actor_id,'deviceId',b.device_id,'epoch',b.actor_epoch,'sessionGeneration',b.generation));
END $$;
CREATE OR REPLACE FUNCTION child_stewardship_guardian.exchange(raw_authentication text,binding uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship_guardian AS $$
DECLARE b bindings%ROWTYPE; auth child_stewardship_webauthn.sessions%ROWTYPE; identity jsonb; raw_token text; expiry timestamptz; moment timestamptz;
BEGIN
 IF raw_authentication IS NULL OR raw_authentication!~'^[A-Za-z0-9_-]{43}$' THEN RETURN NULL;END IF;
 identity:=current_binding(binding);IF identity IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO b FROM bindings WHERE id=binding;
 SELECT * INTO auth FROM child_stewardship_webauthn.sessions WHERE sandbox_id=b.sandbox_id
  AND token_hash=encode(sha256(convert_to(raw_authentication,'UTF8')),'hex') FOR UPDATE;
 moment:=clock_timestamp();
 IF auth.id IS NULL OR auth.revoked OR auth.epoch<>b.credential_epoch OR auth.credential_id<>b.credential_id
  OR auth.created_at<b.bound_at OR auth.created_at>moment OR auth.created_at+interval '2 minutes'<=moment OR auth.expires_at<=moment
  OR EXISTS(SELECT 1 FROM sessions WHERE authentication_id=auth.id) THEN RETURN NULL;END IF;
 expiry:=least(moment+interval '10 minutes',auth.expires_at,b.expires_at);
 raw_token:='cp-guardian.'||rtrim(translate(encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'base64'),'+/','-_'),'=');
 INSERT INTO sessions VALUES(encode(sha256(convert_to(raw_token,'UTF8')),'hex'),binding,auth.id,moment,expiry,false);
 INSERT INTO audit(binding_id,action) VALUES(binding,'exchange');
 RETURN identity||jsonb_build_object('sessionToken',raw_token,'expiresAt',expiry,'syntheticOnly',true,'identityVerified',false);
END $$;
CREATE OR REPLACE FUNCTION child_stewardship_guardian.authorize(raw text,target uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship_guardian AS $$
DECLARE s sessions%ROWTYPE; identity jsonb; auth child_stewardship_webauthn.sessions%ROWTYPE;
BEGIN
 IF NOT runtime_allowed() OR raw IS NULL OR raw!~'^cp-guardian\.[A-Za-z0-9_-]{43}$' THEN RETURN NULL;END IF;
 SELECT * INTO s FROM sessions WHERE token_hash=encode(sha256(convert_to(raw,'UTF8')),'hex');
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM bindings WHERE id=s.binding_id AND session_id=target) THEN RETURN NULL;END IF;
 identity:=current_binding(s.binding_id);IF identity IS NULL THEN RETURN NULL;END IF;
 SELECT * INTO s FROM sessions WHERE token_hash=s.token_hash FOR UPDATE;
 SELECT * INTO auth FROM child_stewardship_webauthn.sessions WHERE id=s.authentication_id FOR SHARE;
 IF s.revoked OR s.expires_at<=clock_timestamp() OR auth.id IS NULL OR auth.revoked OR auth.expires_at<=clock_timestamp() THEN RETURN NULL;END IF;
 RETURN identity;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship_guardian.logout(raw text,target uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship_guardian AS $$
DECLARE identity jsonb; b uuid;
BEGIN
 identity:=authorize(raw,target);IF identity IS NULL THEN RETURN false;END IF;
 UPDATE sessions SET revoked=true WHERE token_hash=encode(sha256(convert_to(raw,'UTF8')),'hex') RETURNING binding_id INTO b;
 INSERT INTO audit(binding_id,action) VALUES(b,'logout');
 RETURN true;
END $$;
REVOKE ALL ON SCHEMA child_stewardship_guardian FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship_guardian FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA child_stewardship_guardian FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship_guardian FROM PUBLIC;
-- Explicit deployment grants may include only capability_session, exchange,
-- authorize and logout. current_binding/runtime_allowed are internal functions.
COMMIT;
