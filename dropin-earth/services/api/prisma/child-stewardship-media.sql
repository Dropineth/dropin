-- Fixed synthetic fixtures only. No real/free uploads, external processing or human review claim.
BEGIN;
CREATE TABLE IF NOT EXISTS child_stewardship.media_roles(
 database_role name NOT NULL,scope text NOT NULL CHECK(scope IN ('ingest','reviewer')),scope_version bigint NOT NULL CHECK(scope_version>0),enabled boolean NOT NULL,approval_ref text NOT NULL,expires_at timestamptz NOT NULL,PRIMARY KEY(database_role,scope,scope_version)
);
CREATE OR REPLACE FUNCTION child_stewardship.media_role(wanted text) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
 SELECT coalesce((SELECT enabled AND expires_at>clock_timestamp() FROM child_stewardship.media_roles WHERE database_role=child_stewardship.privacy_database_role() AND scope=wanted ORDER BY scope_version DESC LIMIT 1),false)
$$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_media_role() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_name name;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_MEDIA_ROLE_APPEND_ONLY' USING ERRCODE='42501';END IF;
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='child_stewardship.media_roles'::regclass;
 IF current_user<>owner_name THEN RAISE EXCEPTION 'CHILD_MEDIA_ROLE_ADMIN_REQUIRED' USING ERRCODE='42501';END IF;
 IF NEW.scope_version<=coalesce((SELECT max(scope_version) FROM child_stewardship.media_roles WHERE database_role=NEW.database_role AND scope=NEW.scope),0) THEN RAISE EXCEPTION 'CHILD_MEDIA_ROLE_VERSION' USING ERRCODE='23514';END IF;
 IF NEW.enabled AND (EXISTS(SELECT 1 FROM child_stewardship.media_roles WHERE database_role=NEW.database_role AND scope<>NEW.scope AND enabled) OR EXISTS(SELECT 1 FROM child_stewardship.service_role_scopes WHERE database_role=NEW.database_role AND enabled) OR EXISTS(SELECT 1 FROM child_stewardship.privacy_worker_roles WHERE database_role=NEW.database_role AND enabled)) THEN RAISE EXCEPTION 'CHILD_MEDIA_ROLE_MUST_BE_SEPARATE' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS media_role_guard ON child_stewardship.media_roles;
CREATE TRIGGER media_role_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.media_roles FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_media_role();
CREATE TABLE IF NOT EXISTS child_stewardship.media_fixture_allowlist(fixture_id text PRIMARY KEY,raw_digest text NOT NULL UNIQUE CHECK(raw_digest~'^[a-f0-9]{64}$'),sanitized_digest text NOT NULL,pixel_digest text NOT NULL,index_digest text NOT NULL,width integer NOT NULL,height integer NOT NULL,perceptual_hashes jsonb NOT NULL);
INSERT INTO child_stewardship.media_fixture_allowlist VALUES ('demo-media-pattern-png','26455c6edb2a6b26197e56360663e72dba7e11da644c51f814832d6a6c962877','b6b9909b1403fcc614da5d4f5a118a9d132818f266339498b76859798353fffd','4d3c62c2ab4407580e85cdc18228d8830f874305f56004fbe527a2390200fcac','c532ac7a71abcfd05f4973f6645cfc04a4f450b2c8ad06ce1b62581223a53f81',64,48,'["0000000000000000", "0000800000000000"]'::jsonb),('demo-media-oriented-jpeg','ccdac9219118bc235a4f4bf5e30cb111bdd6f9adb9869606ce82a0e5cb3d0962','8301dc5730a021a2a62c667907f6274b1915a042a4d8d92456d39f3a215525e1','018636d44adbc0eb64d01ac65ce44fa669ff4fea39d3d1eb22b39156dd7021ad','cd4eaaa411c74de95511967ffa90869a7d241b418008cb180182a0c5724c26eb',48,64,'["fcfbfcfaf6f6f6fa", "f5faf5fdecfdaa55"]'::jsonb) ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION child_stewardship.guard_media_manifest() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_name name;BEGIN
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='child_stewardship.media_fixture_allowlist'::regclass;
 IF TG_OP<>'INSERT' OR current_user<>owner_name THEN RAISE EXCEPTION 'CHILD_MEDIA_MANIFEST_IMMUTABLE' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS media_manifest_guard ON child_stewardship.media_fixture_allowlist;
CREATE TRIGGER media_manifest_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.media_fixture_allowlist FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_media_manifest();
CREATE OR REPLACE FUNCTION child_stewardship.media_scope_conflict() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NEW.enabled AND EXISTS(SELECT 1 FROM child_stewardship.media_roles WHERE database_role=NEW.database_role AND enabled) THEN RAISE EXCEPTION 'CHILD_MEDIA_ROLE_MUST_BE_SEPARATE' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS media_scope_conflict ON child_stewardship.service_role_scopes;
CREATE TRIGGER media_scope_conflict BEFORE INSERT ON child_stewardship.service_role_scopes FOR EACH ROW EXECUTE FUNCTION child_stewardship.media_scope_conflict();
DROP TRIGGER IF EXISTS media_scope_conflict ON child_stewardship.privacy_worker_roles;
CREATE TRIGGER media_scope_conflict BEFORE INSERT ON child_stewardship.privacy_worker_roles FOR EACH ROW EXECUTE FUNCTION child_stewardship.media_scope_conflict();
CREATE TABLE IF NOT EXISTS child_stewardship.media_assets(
 session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),media_id text NOT NULL CHECK(media_id~'^demo-media-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$'),profile_id text NOT NULL,assignment_id text NOT NULL,fixture_id text NOT NULL REFERENCES child_stewardship.media_fixture_allowlist(fixture_id),uploaded_by text NOT NULL,uploaded_domain text NOT NULL,
 raw_object_id text NOT NULL,sanitized_object_id text NOT NULL,index_object_id text NOT NULL,
 raw_digest text NOT NULL CHECK(raw_digest~'^[a-f0-9]{64}$'),sanitized_digest text NOT NULL CHECK(sanitized_digest~'^[a-f0-9]{64}$'),pixel_digest text NOT NULL CHECK(pixel_digest~'^[a-f0-9]{64}$'),index_digest text NOT NULL CHECK(index_digest~'^[a-f0-9]{64}$'),
 perceptual_hashes jsonb NOT NULL CHECK(jsonb_typeof(perceptual_hashes)='array' AND jsonb_array_length(perceptual_hashes)=2),width integer NOT NULL CHECK(width BETWEEN 1 AND 1024),height integer NOT NULL CHECK(height BETWEEN 1 AND 1024),duplicate_flags jsonb NOT NULL CHECK(jsonb_typeof(duplicate_flags)='array' AND duplicate_flags <@ '["exact_repeat","pixel_repeat","possible_visual_repeat"]'::jsonb),
 status text NOT NULL DEFAULT 'quarantined' CHECK(status IN ('quarantined','accepted','rejected')),evidence_level text NOT NULL DEFAULT 'E0' CHECK(evidence_level='E0'),created_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(session_id,media_id)
);
-- Hash-only replay index survives source-purpose erasure; never identifies a child or grants C/R/F.
CREATE TABLE IF NOT EXISTS child_stewardship.media_canonical_keys(session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),kind text NOT NULL CHECK(kind IN ('exact','pixels')),digest text NOT NULL,first_media_id text NOT NULL,PRIMARY KEY(session_id,kind,digest));
CREATE TABLE IF NOT EXISTS child_stewardship.media_reviews(session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),media_id text NOT NULL,reviewer_id text NOT NULL,reviewer_domain text NOT NULL,sanitized_digest text NOT NULL,decision text NOT NULL CHECK(decision IN ('accepted','rejected')),reviewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),PRIMARY KEY(session_id,media_id));
CREATE OR REPLACE FUNCTION child_stewardship.media_actor(tenant uuid,allowed_roles text[]) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE actor jsonb;generation bigint:=0;session_state text;BEGIN
 IF tenant::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RETURN NULL;END IF;
 IF to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL THEN IF NOT child_stewardship.restore_execution_permitted(tenant) THEN RETURN NULL;END IF;END IF;
 IF NOT EXISTS(SELECT 1 FROM child_stewardship.sessions WHERE id=tenant AND expires_at>clock_timestamp()) THEN RETURN NULL;END IF;
 IF to_regclass('child_stewardship.session_resumption') IS NOT NULL THEN
  SELECT r.generation,r.state INTO generation,session_state FROM child_stewardship.session_resumption r WHERE session_id=tenant;
  IF session_state IS NOT NULL AND session_state<>'active' THEN RETURN NULL;END IF;
 END IF;
 IF coalesce(generation,0)::text IS DISTINCT FROM coalesce(nullif(current_setting('app.child_session_generation',true),''),'0') THEN RETURN NULL;END IF;
 SELECT payload INTO actor FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='actors' AND record_id=current_setting('app.child_actor_id',true);
 IF actor IS NULL OR NOT(actor->>'role'=ANY(allowed_roles)) OR actor->>'revoked' IS DISTINCT FROM 'false' OR actor->>'epoch' IS DISTINCT FROM current_setting('app.child_actor_epoch',true) OR NOT((actor->'deviceIds')?coalesce(current_setting('app.child_device_id',true),'')) OR (actor->>'expiresAt')::timestamptz<=clock_timestamp() THEN RETURN NULL;END IF;
 RETURN actor;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.media_purpose_current(tenant uuid,assignment_ref text) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE assignment jsonb;profile jsonb;task jsonb;link jsonb;guardian jsonb;consent jsonb;policy text;purpose text;BEGIN
 IF tenant::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RETURN false;END IF;
 IF to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL THEN IF NOT child_stewardship.restore_execution_permitted(tenant) THEN RETURN false;END IF;END IF;
 SELECT payload INTO assignment FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='assignments' AND record_id=assignment_ref;
 SELECT payload INTO profile FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='profiles' AND record_id=assignment->>'profileId';
 SELECT payload INTO task FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='tasks' AND record_id=assignment->>'taskId';
 SELECT payload INTO link FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='guardianLinks' AND record_id=assignment->>'profileId';
 SELECT payload INTO guardian FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='actors' AND record_id=profile->>'guardianActorId';
 SELECT payload->>'policyVersion' INTO policy FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='meta' AND record_id='current';
 IF assignment IS NULL OR profile IS NULL OR task IS NULL OR link IS NULL OR guardian IS NULL OR profile->>'status' IS DISTINCT FROM 'active' OR assignment->>'status' IS DISTINCT FROM 'active' OR task->>'cancelled' IS DISTINCT FROM 'false' OR assignment->>'taskVersion' IS DISTINCT FROM task->>'templateVersion' OR (task->>'opensAt')::timestamptz>clock_timestamp() OR (task->>'closesAt')::timestamptz<=clock_timestamp() OR (link->>'expiresAt')::timestamptz<=clock_timestamp() OR guardian->>'revoked' IS DISTINCT FROM 'false' OR (guardian->>'expiresAt')::timestamptz<=clock_timestamp() OR EXISTS(SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=tenant AND profile_id=profile->>'id') THEN RETURN false;END IF;
 FOREACH purpose IN ARRAY ARRAY['learning','upload'] LOOP
  SELECT payload INTO consent FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='consents' AND record_id=(profile->>'id')||':'||purpose;
  IF consent IS NULL OR consent->>'guardianGranted' IS DISTINCT FROM 'true' OR consent->>'childAssent' IS DISTINCT FROM 'true' OR consent->>'withdrawnAt' IS NOT NULL OR consent->>'policyVersion' IS DISTINCT FROM policy OR consent->>'guardianLinkVersion' IS DISTINCT FROM link->>'version' OR (consent->>'expiresAt')::timestamptz<=clock_timestamp() OR (purpose='upload' AND consent->>'version' IS DISTINCT FROM assignment->>'consentVersion') THEN RETURN false;END IF;
 END LOOP;RETURN true;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_media_asset() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE actor jsonb;profile jsonb;BEGIN
 IF TG_OP='DELETE' THEN
  IF pg_trigger_depth()>1 AND child_stewardship.is_privacy_worker() AND OLD.session_id::text=current_setting('app.child_session_id',true) AND NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_objects WHERE session_id=OLD.session_id AND object_id IN(OLD.raw_object_id,OLD.sanitized_object_id,OLD.index_object_id)) AND EXISTS(SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=OLD.session_id AND profile_id=OLD.profile_id) THEN RETURN OLD;END IF;
  RAISE EXCEPTION 'CHILD_MEDIA_PURPOSE_ERASURE_ONLY' USING ERRCODE='42501';
 END IF;
 IF NEW.session_id::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RAISE EXCEPTION 'CHILD_MEDIA_TENANT' USING ERRCODE='42501';END IF;
 IF TG_OP='UPDATE' THEN
  IF pg_trigger_depth()<2 OR NOT child_stewardship.media_role('reviewer') OR (to_jsonb(NEW)-'status')<>(to_jsonb(OLD)-'status') OR OLD.status<>'quarantined' OR NOT EXISTS(SELECT 1 FROM child_stewardship.media_reviews WHERE session_id=NEW.session_id AND media_id=NEW.media_id AND decision=NEW.status AND sanitized_digest=NEW.sanitized_digest) THEN RAISE EXCEPTION 'CHILD_MEDIA_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 PERFORM 1 FROM child_stewardship.sessions WHERE id=NEW.session_id FOR UPDATE;
 actor:=child_stewardship.media_actor(NEW.session_id,ARRAY['guardian','child']);
 IF NOT child_stewardship.media_role('ingest') OR actor IS NULL OR NEW.uploaded_by IS DISTINCT FROM actor->>'id' OR NEW.uploaded_domain IS DISTINCT FROM actor->>'controlDomain' OR NEW.status<>'quarantined' OR NOT child_stewardship.media_purpose_current(NEW.session_id,NEW.assignment_id) OR NOT EXISTS(SELECT 1 FROM child_stewardship.media_fixture_allowlist WHERE fixture_id=NEW.fixture_id AND raw_digest=NEW.raw_digest AND sanitized_digest=NEW.sanitized_digest AND pixel_digest=NEW.pixel_digest AND index_digest=NEW.index_digest AND width=NEW.width AND height=NEW.height AND perceptual_hashes=NEW.perceptual_hashes) THEN RAISE EXCEPTION 'CHILD_MEDIA_INGRESS_DENIED' USING ERRCODE='42501';END IF;
 SELECT payload INTO profile FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='profiles' AND record_id=NEW.profile_id;
 IF NEW.raw_object_id<>NEW.media_id||':source' OR NEW.sanitized_object_id<>NEW.media_id||':derived' OR NEW.index_object_id<>NEW.media_id||':index' OR profile IS NULL OR actor->>'id' NOT IN(profile->>'actorId',profile->>'guardianActorId') OR NOT EXISTS(SELECT 1 FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='assignments' AND record_id=NEW.assignment_id AND payload->>'profileId'=NEW.profile_id) THEN RAISE EXCEPTION 'CHILD_MEDIA_PROFILE_SCOPE' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS media_asset_guard ON child_stewardship.media_assets;
CREATE TRIGGER media_asset_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.media_assets FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_media_asset();
CREATE OR REPLACE FUNCTION child_stewardship.media_object_insert_allowed(tenant uuid,reference text,profile text,purpose text,kind text,content bytea,expiry timestamptz,external_object boolean) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
 SELECT tenant::text=current_setting('app.child_session_id',true) AND child_stewardship.media_role('ingest') AND NOT external_object AND purpose='upload' AND expiry>clock_timestamp() AND expiry<=clock_timestamp()+interval '25 hours' AND octet_length(content)<=2097152 AND EXISTS(SELECT 1 FROM child_stewardship.media_assets a WHERE a.session_id=tenant AND a.profile_id=profile AND a.status='quarantined' AND a.uploaded_by=current_setting('app.child_actor_id',true) AND child_stewardship.media_purpose_current(tenant,a.assignment_id) AND ((kind='source' AND a.raw_object_id=reference AND a.raw_digest=encode(sha256(content),'hex')) OR (kind='derived' AND a.sanitized_object_id=reference AND a.sanitized_digest=encode(sha256(content),'hex')) OR (kind='index' AND a.index_object_id=reference AND a.index_digest=encode(sha256(content),'hex'))))
$$;
CREATE OR REPLACE FUNCTION child_stewardship.check_media_bytes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE oldtenant text;BEGIN
 oldtenant:=current_setting('app.child_session_id',true);PERFORM set_config('app.child_session_id',NEW.session_id::text,true);
 IF NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_objects r JOIN child_stewardship.privacy_objects d ON d.session_id=r.session_id JOIN child_stewardship.privacy_objects i ON i.session_id=r.session_id WHERE r.session_id=NEW.session_id AND r.object_id=NEW.raw_object_id AND d.object_id=NEW.sanitized_object_id AND i.object_id=NEW.index_object_id AND encode(sha256(r.content),'hex')=NEW.raw_digest AND encode(sha256(d.content),'hex')=NEW.sanitized_digest AND encode(sha256(i.content),'hex')=NEW.index_digest) THEN RAISE EXCEPTION 'CHILD_MEDIA_BYTES_REQUIRED' USING ERRCODE='23514';END IF;
 INSERT INTO child_stewardship.media_canonical_keys VALUES(NEW.session_id,'exact',NEW.raw_digest,NEW.media_id),(NEW.session_id,'pixels',NEW.pixel_digest,NEW.media_id) ON CONFLICT DO NOTHING;
 PERFORM set_config('app.child_session_id',coalesce(oldtenant,''),true);RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS media_bytes_complete ON child_stewardship.media_assets;
CREATE CONSTRAINT TRIGGER media_bytes_complete AFTER INSERT ON child_stewardship.media_assets DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION child_stewardship.check_media_bytes();
CREATE OR REPLACE FUNCTION child_stewardship.guard_media_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE actor jsonb;asset child_stewardship.media_assets%ROWTYPE;guardian_domain text;BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_MEDIA_REVIEW_IMMUTABLE' USING ERRCODE='42501';END IF;
 IF NEW.session_id::text IS DISTINCT FROM current_setting('app.child_session_id',true) OR NOT child_stewardship.media_role('reviewer') THEN RAISE EXCEPTION 'CHILD_MEDIA_REVIEWER_REQUIRED' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM child_stewardship.sessions WHERE id=NEW.session_id FOR UPDATE;
 actor:=child_stewardship.media_actor(NEW.session_id,ARRAY['reviewer','protector']);SELECT * INTO asset FROM child_stewardship.media_assets WHERE session_id=NEW.session_id AND media_id=NEW.media_id FOR UPDATE;
 SELECT a.payload->>'controlDomain' INTO guardian_domain FROM child_stewardship.state_records p JOIN child_stewardship.state_records a ON a.session_id=p.session_id AND a.domain='learning' AND a.collection='actors' AND a.record_id=p.payload->>'guardianActorId' WHERE p.session_id=NEW.session_id AND p.domain='learning' AND p.collection='profiles' AND p.record_id=asset.profile_id;
 IF NOT child_stewardship.media_role('reviewer') OR actor IS NULL OR NEW.reviewer_id IS DISTINCT FROM actor->>'id' OR NEW.reviewer_domain IS DISTINCT FROM actor->>'controlDomain' OR asset.status IS DISTINCT FROM 'quarantined' OR NEW.sanitized_digest IS DISTINCT FROM asset.sanitized_digest OR actor->>'controlDomain' IN(asset.uploaded_domain,guardian_domain) OR NOT child_stewardship.media_purpose_current(NEW.session_id,asset.assignment_id) OR NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_objects WHERE session_id=NEW.session_id AND object_id=asset.sanitized_object_id AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'CHILD_MEDIA_REVIEW_SCOPE' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.apply_media_review() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$ BEGIN
 UPDATE child_stewardship.media_assets SET status=NEW.decision WHERE session_id=NEW.session_id AND media_id=NEW.media_id;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS media_review_guard ON child_stewardship.media_reviews;
CREATE TRIGGER media_review_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.media_reviews FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_media_review();
DROP TRIGGER IF EXISTS media_review_apply ON child_stewardship.media_reviews;
CREATE TRIGGER media_review_apply AFTER INSERT ON child_stewardship.media_reviews FOR EACH ROW EXECUTE FUNCTION child_stewardship.apply_media_review();
CREATE OR REPLACE FUNCTION child_stewardship.purge_media_links() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$ BEGIN
 IF child_stewardship.is_privacy_worker() THEN DELETE FROM child_stewardship.media_assets a WHERE a.session_id=OLD.session_id AND OLD.object_id IN(a.raw_object_id,a.sanitized_object_id,a.index_object_id) AND NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_objects o WHERE o.session_id=a.session_id AND o.object_id IN(a.raw_object_id,a.sanitized_object_id,a.index_object_id));END IF;RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS media_privacy_unlink ON child_stewardship.privacy_objects;
CREATE TRIGGER media_privacy_unlink AFTER DELETE ON child_stewardship.privacy_objects FOR EACH ROW EXECUTE FUNCTION child_stewardship.purge_media_links();
DO $$ DECLARE relation text;BEGIN
 FOREACH relation IN ARRAY ARRAY['media_assets','media_canonical_keys','media_reviews'] LOOP
  EXECUTE format('ALTER TABLE child_stewardship.%I ENABLE ROW LEVEL SECURITY',relation);EXECUTE format('ALTER TABLE child_stewardship.%I FORCE ROW LEVEL SECURITY',relation);EXECUTE format('DROP POLICY IF EXISTS private_session ON child_stewardship.%I',relation);
  EXECUTE format('CREATE POLICY private_session ON child_stewardship.%I USING(session_id::text=current_setting(''app.child_session_id'',true)) WITH CHECK(session_id::text=current_setting(''app.child_session_id'',true))',relation);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_media_canonical() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP<>'INSERT' OR pg_trigger_depth()<2 THEN RAISE EXCEPTION 'CHILD_MEDIA_INDEX_IMMUTABLE' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS media_canonical_guard ON child_stewardship.media_canonical_keys;
CREATE TRIGGER media_canonical_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.media_canonical_keys FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_media_canonical();
-- Media reads recheck the actual scope/principal, not just the application route.
CREATE OR REPLACE FUNCTION child_stewardship.media_read_allowed(tenant uuid,asset_id text) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE actor jsonb;asset child_stewardship.media_assets%ROWTYPE;profile jsonb;guardian_domain text;BEGIN
 IF tenant::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RETURN false;END IF;
 IF to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NOT NULL THEN IF NOT child_stewardship.restore_execution_permitted(tenant) THEN RETURN false;END IF;END IF;
 SELECT * INTO asset FROM child_stewardship.media_assets WHERE session_id=tenant AND media_id=asset_id;
 IF asset.media_id IS NULL OR NOT child_stewardship.media_purpose_current(tenant,asset.assignment_id) THEN RETURN false;END IF;
 SELECT payload INTO profile FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='profiles' AND record_id=asset.profile_id;
 IF child_stewardship.media_role('ingest') THEN
  actor:=child_stewardship.media_actor(tenant,ARRAY['guardian','child']);
  RETURN coalesce(actor IS NOT NULL AND asset.status='accepted' AND actor->>'id' IN(profile->>'actorId',profile->>'guardianActorId'),false);
 END IF;
 IF child_stewardship.media_role('reviewer') THEN
  actor:=child_stewardship.media_actor(tenant,ARRAY['reviewer','protector']);
  SELECT payload->>'controlDomain' INTO guardian_domain FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='actors' AND record_id=profile->>'guardianActorId';
  RETURN coalesce(actor IS NOT NULL AND actor->>'controlDomain' NOT IN(asset.uploaded_domain,guardian_domain),false);
 END IF;RETURN false;
END $$;
-- Even broadly granted media connections cannot select source bytes or exports.
DROP POLICY IF EXISTS media_private_bytes ON child_stewardship.privacy_objects;
CREATE POLICY media_private_bytes ON child_stewardship.privacy_objects AS RESTRICTIVE FOR SELECT USING(
 NOT EXISTS(SELECT 1 FROM child_stewardship.media_roles WHERE database_role=current_user AND enabled)
 OR (kind='derived' AND expires_at>clock_timestamp() AND EXISTS(SELECT 1 FROM child_stewardship.media_assets a WHERE a.session_id=privacy_objects.session_id AND a.sanitized_object_id=privacy_objects.object_id AND child_stewardship.media_read_allowed(a.session_id,a.media_id)))
);
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
