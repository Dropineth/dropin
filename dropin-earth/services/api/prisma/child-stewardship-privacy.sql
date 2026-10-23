-- Synthetic privacy lifecycle. Apply after base and authority migrations.
-- No provider acknowledgement, worker role grant, or external deletion is fabricated.
BEGIN;
CREATE TABLE IF NOT EXISTS child_stewardship.privacy_worker_roles(
  database_role name NOT NULL, scope_version bigint NOT NULL CHECK(scope_version>0), enabled boolean NOT NULL,
  approval_ref text NOT NULL CHECK(length(approval_ref)>0), expires_at timestamptz NOT NULL,
  PRIMARY KEY(database_role,scope_version)
);
CREATE OR REPLACE FUNCTION child_stewardship.privacy_database_role() RETURNS name LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN coalesce(current_setting('role',true),'none') IN ('none','') THEN session_user ELSE current_setting('role',true)::name END
$$;
CREATE OR REPLACE FUNCTION child_stewardship.is_privacy_worker() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
  SELECT coalesce((SELECT enabled AND expires_at>statement_timestamp() FROM child_stewardship.privacy_worker_roles WHERE database_role=child_stewardship.privacy_database_role() ORDER BY scope_version DESC LIMIT 1),false)
$$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_privacy_worker_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_name name; BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_PRIVACY_SCOPE_APPEND_ONLY' USING ERRCODE='42501'; END IF;
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='child_stewardship.privacy_worker_roles'::regclass;
  IF current_user<>owner_name THEN RAISE EXCEPTION 'CHILD_PRIVACY_SCOPE_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NEW.scope_version<=coalesce((SELECT max(scope_version) FROM child_stewardship.privacy_worker_roles WHERE database_role=NEW.database_role),0) THEN RAISE EXCEPTION 'CHILD_PRIVACY_SCOPE_VERSION' USING ERRCODE='23514'; END IF;
  IF NEW.enabled AND EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(actor_role) enabled,expires_at FROM child_stewardship.service_role_scopes WHERE database_role=NEW.database_role ORDER BY actor_role,scope_version DESC) s WHERE s.enabled AND s.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'CHILD_PRIVACY_WORKER_MUST_BE_SEPARATE' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS privacy_worker_scope_guard ON child_stewardship.privacy_worker_roles;
CREATE TRIGGER privacy_worker_scope_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.privacy_worker_roles FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_privacy_worker_scope();
CREATE OR REPLACE FUNCTION child_stewardship.guard_service_privacy_conflict() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.enabled AND coalesce((SELECT enabled AND expires_at>clock_timestamp() FROM child_stewardship.privacy_worker_roles WHERE database_role=NEW.database_role ORDER BY scope_version DESC LIMIT 1),false) THEN RAISE EXCEPTION 'CHILD_PRIVACY_WORKER_MUST_BE_SEPARATE' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS service_privacy_conflict ON child_stewardship.service_role_scopes;
CREATE TRIGGER service_privacy_conflict BEFORE INSERT ON child_stewardship.service_role_scopes FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_service_privacy_conflict();
CREATE TABLE IF NOT EXISTS child_stewardship.privacy_jobs(
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), request_id text NOT NULL,
  profile_id text NOT NULL, requested_by text NOT NULL, kind text NOT NULL CHECK(kind IN ('export_learning','delete_learning')),
  state text NOT NULL DEFAULT 'requested' CHECK(state IN ('requested','processing','waiting','completed')),
  policy_version text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz,
  PRIMARY KEY(session_id,request_id), CHECK((state='completed')=(completed_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS child_stewardship.privacy_suppressions(
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), profile_id text NOT NULL,
  request_id text NOT NULL, active boolean NOT NULL DEFAULT true CHECK(active),
  canonical_participant_ref text NOT NULL, created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(session_id,profile_id), FOREIGN KEY(session_id,request_id) REFERENCES child_stewardship.privacy_jobs(session_id,request_id)
);
CREATE TABLE IF NOT EXISTS child_stewardship.privacy_plan_items(
  session_id uuid NOT NULL, request_id text NOT NULL, domain text NOT NULL CHECK(domain IN ('learning','object')),
  collection text NOT NULL, record_id text NOT NULL, payload_digest text NOT NULL CHECK(payload_digest ~ '^[a-f0-9]{64}$'),
  action text NOT NULL CHECK(action IN ('erase','retain')),
  reason text NOT NULL CHECK(reason IN ('purpose_ended','legal_hold','protection_retention','rights_retention','replay_retention','processor_unavailable','backup_unexpired','shared_source','export_source')),
  PRIMARY KEY(session_id,request_id,domain,collection,record_id),
  FOREIGN KEY(session_id,request_id) REFERENCES child_stewardship.privacy_jobs(session_id,request_id)
);
CREATE TABLE IF NOT EXISTS child_stewardship.privacy_objects(
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), object_id text NOT NULL, profile_id text NOT NULL,
  purpose text NOT NULL CHECK(purpose IN ('learning','upload','protection','rights')),
  kind text NOT NULL CHECK(kind IN ('source','derived','index','cache','export','mirror','processor','backup')),
  content bytea, expires_at timestamptz, external boolean NOT NULL DEFAULT false,
  PRIMARY KEY(session_id,object_id), CHECK(NOT external OR content IS NULL), CHECK(kind<>'backup' OR expires_at IS NOT NULL)
);
CREATE TABLE IF NOT EXISTS child_stewardship.privacy_receipts(
  session_id uuid NOT NULL, request_id text NOT NULL, resource_kind text NOT NULL CHECK(resource_kind IN ('record','object')),
  resource_ref text NOT NULL, content_digest text NOT NULL CHECK(content_digest ~ '^[a-f0-9]{64}$'),
  outcome text NOT NULL CHECK(outcome IN ('deleted','retained','pending_processor','pending_backup')),
  recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(), transaction_id text NOT NULL DEFAULT pg_current_xact_id()::text, revision_before bigint NOT NULL DEFAULT 0,
  PRIMARY KEY(session_id,request_id,resource_kind,resource_ref,outcome),
  FOREIGN KEY(session_id,request_id) REFERENCES child_stewardship.privacy_jobs(session_id,request_id)
);
ALTER TABLE child_stewardship.privacy_receipts ADD COLUMN IF NOT EXISTS revision_before bigint NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS child_stewardship.privacy_legal_holds(
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id), profile_id text NOT NULL, hold_id text NOT NULL,
  authority_ref text NOT NULL CHECK(length(authority_ref)>0), expires_at timestamptz NOT NULL,
  PRIMARY KEY(session_id,profile_id,hold_id)
);
CREATE OR REPLACE FUNCTION child_stewardship.guard_privacy_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_PRIVACY_HISTORY_IMMUTABLE' USING ERRCODE='42501'; END IF;
  IF pg_trigger_depth()<2 THEN RAISE EXCEPTION 'CHILD_PRIVACY_RECEIPT_INTERNAL_ONLY' USING ERRCODE='42501'; END IF;
  IF TG_TABLE_NAME='privacy_receipts' THEN SELECT revision INTO NEW.revision_before FROM child_stewardship.sessions WHERE id=NEW.session_id; END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['privacy_suppressions','privacy_receipts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS privacy_immutable ON child_stewardship.%I',relation);
    EXECUTE format('CREATE TRIGGER privacy_immutable BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_privacy_immutable()',relation);
  END LOOP;
  FOREACH relation IN ARRAY ARRAY['privacy_jobs','privacy_suppressions','privacy_plan_items','privacy_objects','privacy_receipts','privacy_legal_holds'] LOOP
    EXECUTE format('ALTER TABLE child_stewardship.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('ALTER TABLE child_stewardship.%I FORCE ROW LEVEL SECURITY',relation);
    EXECUTE format('DROP POLICY IF EXISTS private_session ON child_stewardship.%I',relation);
    EXECUTE format('CREATE POLICY private_session ON child_stewardship.%I USING(session_id::text=current_setting(''app.child_session_id'',true)) WITH CHECK(session_id::text=current_setting(''app.child_session_id'',true))',relation);
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_privacy_hold() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_name name; BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_LEGAL_HOLD_IMMUTABLE' USING ERRCODE='42501'; END IF;
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='child_stewardship.privacy_legal_holds'::regclass;
  IF current_user<>owner_name THEN RAISE EXCEPTION 'CHILD_LEGAL_HOLD_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS privacy_hold_guard ON child_stewardship.privacy_legal_holds;
CREATE TRIGGER privacy_hold_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.privacy_legal_holds FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_privacy_hold();
CREATE OR REPLACE FUNCTION child_stewardship.privacy_profile_for_ref(tenant uuid,bucket text,reference text) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE p jsonb; answer text; BEGIN
  IF tenant::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RETURN NULL; END IF;
  SELECT payload INTO p FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection=bucket AND record_id=reference;
  IF p IS NULL THEN SELECT j.profile_id INTO answer FROM child_stewardship.privacy_plan_items i JOIN child_stewardship.privacy_jobs j USING(session_id,request_id) WHERE i.session_id=tenant AND i.domain='learning' AND i.collection=bucket AND i.record_id=reference LIMIT 1; RETURN answer; END IF;
  CASE bucket
    WHEN 'profiles' THEN RETURN reference;
    WHEN 'guardianLinks','consents','assignments','disputes','privacyRequests' THEN RETURN p->>'profileId';
    WHEN 'observations' THEN RETURN child_stewardship.privacy_profile_for_ref(tenant,'assignments',p->>'assignmentId');
    WHEN 'reviews' THEN RETURN child_stewardship.privacy_profile_for_ref(tenant,'observations',p->>'observationId');
    WHEN 'assessments' THEN
      SELECT CASE WHEN count(DISTINCT v)=1 THEN min(v) ELSE NULL END INTO answer FROM (SELECT child_stewardship.privacy_profile_for_ref(tenant,'reviews',r) v FROM jsonb_array_elements_text(p->'reviewIds') r) q; RETURN answer;
    ELSE RETURN NULL;
  END CASE;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.privacy_record_belongs_to(tenant uuid,bucket text,reference text,profile text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
  SELECT tenant::text=current_setting('app.child_session_id',true) AND (
    child_stewardship.privacy_profile_for_ref(tenant,bucket,reference)=profile
    OR (bucket='assessments' AND EXISTS(SELECT 1 FROM child_stewardship.state_records r CROSS JOIN LATERAL jsonb_array_elements_text(r.payload->'reviewIds') review_ref WHERE r.session_id=tenant AND r.domain='learning' AND r.collection='assessments' AND r.record_id=reference AND child_stewardship.privacy_profile_for_ref(tenant,'reviews',review_ref)=profile)))
$$;
CREATE OR REPLACE FUNCTION child_stewardship.privacy_profile_held(tenant uuid,profile text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
  SELECT tenant::text=current_setting('app.child_session_id',true) AND child_stewardship.is_privacy_worker() AND EXISTS(SELECT 1 FROM child_stewardship.privacy_legal_holds WHERE session_id=tenant AND profile_id=profile AND expires_at>statement_timestamp())
$$;
CREATE OR REPLACE FUNCTION child_stewardship.privacy_retention_due(tenant uuid,request text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
  SELECT child_stewardship.is_privacy_worker() AND tenant::text=current_setting('app.child_session_id',true) AND EXISTS(
    SELECT 1 FROM child_stewardship.privacy_jobs j JOIN child_stewardship.privacy_plan_items i USING(session_id,request_id)
    WHERE j.session_id=tenant AND j.request_id=request AND j.kind='delete_learning' AND i.reason='legal_hold'
      AND NOT child_stewardship.privacy_profile_held(tenant,j.profile_id)
      AND ((i.domain='learning' AND EXISTS(SELECT 1 FROM child_stewardship.state_records r WHERE r.session_id=tenant AND r.domain='learning' AND r.collection=i.collection AND r.record_id=i.record_id AND NOT(r.collection='disputes' AND r.payload->>'kind'='protection')))
        OR (i.domain='object' AND EXISTS(SELECT 1 FROM child_stewardship.privacy_objects o WHERE o.session_id=tenant AND o.object_id=i.record_id AND o.purpose IN ('learning','upload'))))
  )
$$;
CREATE OR REPLACE FUNCTION child_stewardship.privacy_retention_valid(tenant uuid,request text,resource_domain text,bucket text,reference text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
  SELECT tenant::text=current_setting('app.child_session_id',true) AND child_stewardship.is_privacy_worker() AND EXISTS(SELECT 1 FROM child_stewardship.privacy_jobs j WHERE j.session_id=tenant AND j.request_id=request AND
    (j.kind='export_learning' OR child_stewardship.privacy_profile_held(tenant,j.profile_id)
      OR (resource_domain='learning' AND bucket='disputes' AND EXISTS(SELECT 1 FROM child_stewardship.state_records r WHERE r.session_id=tenant AND r.domain='learning' AND r.collection=bucket AND r.record_id=reference AND r.payload->>'kind'='protection'))
      OR (resource_domain='object' AND EXISTS(SELECT 1 FROM child_stewardship.privacy_objects o WHERE o.session_id=tenant AND o.object_id=reference AND o.purpose IN ('protection','rights')))))
$$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_privacy_job() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE profile jsonb; request jsonb; permitted boolean; actor text; BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'CHILD_PRIVACY_JOB_IMMUTABLE' USING ERRCODE='42501'; END IF;
  IF NEW.session_id::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RAISE EXCEPTION 'CHILD_PRIVACY_TENANT' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM child_stewardship.sessions WHERE id=NEW.session_id FOR UPDATE;
  IF TG_OP='INSERT' THEN
    actor:=current_setting('app.child_actor_role',true);
    SELECT enabled AND expires_at>clock_timestamp() INTO permitted FROM child_stewardship.service_role_scopes WHERE database_role=child_stewardship.privacy_database_role() AND actor_role=actor ORDER BY scope_version DESC LIMIT 1;
    IF permitted IS DISTINCT FROM true OR actor NOT IN ('guardian','child') OR NEW.requested_by IS DISTINCT FROM current_setting('app.child_actor_id',true) OR NEW.state<>'requested' OR NEW.completed_at IS NOT NULL THEN RAISE EXCEPTION 'CHILD_PRIVACY_REQUEST_AUTHORITY' USING ERRCODE='42501'; END IF;
    SELECT payload INTO profile FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='profiles' AND record_id=NEW.profile_id;
    SELECT payload INTO request FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='privacyRequests' AND record_id=NEW.request_id;
    IF profile IS NULL OR request IS NULL OR request->>'profileId' IS DISTINCT FROM NEW.profile_id OR request->>'kind' IS DISTINCT FROM NEW.kind OR NEW.requested_by IS DISTINCT FROM (CASE actor WHEN 'guardian' THEN profile->>'guardianActorId' ELSE profile->>'actorId' END) OR NEW.policy_version IS DISTINCT FROM (SELECT payload->>'policyVersion' FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='meta' AND record_id='current') THEN RAISE EXCEPTION 'CHILD_PRIVACY_REQUEST_MISMATCH' USING ERRCODE='42501'; END IF;
  ELSE
    IF NOT child_stewardship.is_privacy_worker() OR NEW.request_id IS DISTINCT FROM current_setting('app.child_privacy_request_id',true) OR (NEW.session_id,NEW.request_id,NEW.profile_id,NEW.requested_by,NEW.kind,NEW.policy_version,NEW.created_at) IS DISTINCT FROM (OLD.session_id,OLD.request_id,OLD.profile_id,OLD.requested_by,OLD.kind,OLD.policy_version,OLD.created_at) OR (OLD.state='completed' AND NOT(NEW.state='processing' AND child_stewardship.privacy_retention_due(NEW.session_id,NEW.request_id))) OR (OLD.state='requested' AND NEW.state<>'processing') OR (OLD.state='waiting' AND NEW.state<>'processing') OR (OLD.state='processing' AND NEW.state NOT IN ('processing','waiting','completed')) THEN RAISE EXCEPTION 'CHILD_PRIVACY_WORKER_TRANSITION' USING ERRCODE='42501'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.suppress_privacy_job() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$ BEGIN
  IF NEW.kind='delete_learning' THEN INSERT INTO child_stewardship.privacy_suppressions(session_id,profile_id,request_id,canonical_participant_ref) SELECT NEW.session_id,NEW.profile_id,NEW.request_id,payload->>'canonicalParticipantRef' FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='profiles' AND record_id=NEW.profile_id ON CONFLICT(session_id,profile_id) DO NOTHING; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS privacy_job_guard ON child_stewardship.privacy_jobs;
CREATE TRIGGER privacy_job_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.privacy_jobs FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_privacy_job();
DROP TRIGGER IF EXISTS privacy_job_suppression ON child_stewardship.privacy_jobs;
CREATE TRIGGER privacy_job_suppression AFTER INSERT ON child_stewardship.privacy_jobs FOR EACH ROW EXECUTE FUNCTION child_stewardship.suppress_privacy_job();
CREATE OR REPLACE FUNCTION child_stewardship.guard_privacy_plan() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE job child_stewardship.privacy_jobs%ROWTYPE; p jsonb; object child_stewardship.privacy_objects%ROWTYPE; digest text; profile text; BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_PRIVACY_PLAN_IMMUTABLE' USING ERRCODE='42501'; END IF;
  IF NOT child_stewardship.is_privacy_worker() OR NEW.session_id::text IS DISTINCT FROM current_setting('app.child_session_id',true) OR NEW.request_id IS DISTINCT FROM current_setting('app.child_privacy_request_id',true) THEN RAISE EXCEPTION 'CHILD_PRIVACY_WORKER_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT * INTO job FROM child_stewardship.privacy_jobs WHERE session_id=NEW.session_id AND request_id=NEW.request_id FOR UPDATE;
  IF job.state<>'processing' THEN RAISE EXCEPTION 'CHILD_PRIVACY_JOB_NOT_PROCESSING' USING ERRCODE='42501'; END IF;
  IF NEW.domain='learning' THEN
    IF NEW.collection NOT IN ('profiles','guardianLinks','consents','assignments','observations','reviews','assessments','disputes') THEN RAISE EXCEPTION 'CHILD_PRIVACY_PROTECTED_RECORD' USING ERRCODE='42501'; END IF;
    SELECT payload INTO p FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection=NEW.collection AND record_id=NEW.record_id;
    IF child_stewardship.privacy_record_belongs_to(NEW.session_id,NEW.collection,NEW.record_id,job.profile_id) THEN profile:=job.profile_id; END IF;digest:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
    IF NEW.collection='disputes' AND p->>'kind'='protection' AND NEW.action<>'retain' THEN RAISE EXCEPTION 'CHILD_PRIVACY_PROTECTION_RETAINED' USING ERRCODE='42501'; END IF;
  ELSE
    SELECT * INTO object FROM child_stewardship.privacy_objects WHERE session_id=NEW.session_id AND object_id=NEW.record_id;
    IF NOT FOUND OR NEW.collection<>object.kind THEN RAISE EXCEPTION 'CHILD_PRIVACY_OBJECT_MISMATCH' USING ERRCODE='42501'; END IF;
    profile:=object.profile_id;digest:=encode(sha256(coalesce(object.content,''::bytea)),'hex');
    IF NEW.action='erase' AND (object.purpose IN ('protection','rights') OR object.external OR (object.kind='backup' AND object.expires_at>clock_timestamp())) THEN RAISE EXCEPTION 'CHILD_PRIVACY_OBJECT_NOT_ERASABLE' USING ERRCODE='42501'; END IF;
  END IF;
  IF NEW.action='erase' AND NEW.reason<>'purpose_ended' THEN RAISE EXCEPTION 'CHILD_PRIVACY_ERASE_REASON' USING ERRCODE='42501'; END IF;
  IF NEW.action='retain' AND (
    (job.kind='export_learning' AND NEW.reason='export_source') OR
    (NEW.reason='legal_hold' AND child_stewardship.privacy_profile_held(NEW.session_id,job.profile_id)) OR
    (NEW.domain='learning' AND NEW.collection='disputes' AND p->>'kind'='protection' AND NEW.reason='protection_retention') OR
    (NEW.domain='object' AND ((object.purpose='protection' AND NEW.reason='protection_retention') OR (object.purpose='rights' AND NEW.reason='rights_retention') OR (object.external AND object.purpose IN ('learning','upload') AND NEW.reason='processor_unavailable') OR (object.kind='backup' AND object.expires_at>clock_timestamp() AND NEW.reason='backup_unexpired')))
  ) IS DISTINCT FROM true THEN RAISE EXCEPTION 'CHILD_PRIVACY_RETENTION_REASON' USING ERRCODE='42501'; END IF;
  IF profile IS DISTINCT FROM job.profile_id OR digest IS DISTINCT FROM NEW.payload_digest OR (NEW.action='erase' AND (job.kind<>'delete_learning' OR child_stewardship.privacy_profile_held(NEW.session_id,job.profile_id))) THEN RAISE EXCEPTION 'CHILD_PRIVACY_PLAN_SCOPE' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS privacy_plan_guard ON child_stewardship.privacy_plan_items;
CREATE TRIGGER privacy_plan_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.privacy_plan_items FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_privacy_plan();
CREATE OR REPLACE FUNCTION child_stewardship.privacy_delete_permitted(tenant uuid,record_domain text,bucket text,reference text,p jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE job child_stewardship.privacy_jobs%ROWTYPE; BEGIN
  IF NOT child_stewardship.is_privacy_worker() OR tenant::text IS DISTINCT FROM current_setting('app.child_session_id',true) OR record_domain<>'learning' OR bucket NOT IN ('profiles','guardianLinks','consents','assignments','observations','reviews','assessments','disputes') THEN RETURN false; END IF;
  SELECT * INTO job FROM child_stewardship.privacy_jobs WHERE session_id=tenant AND request_id=current_setting('app.child_privacy_request_id',true) FOR UPDATE;
  IF job.kind IS DISTINCT FROM 'delete_learning' OR job.state IS DISTINCT FROM 'processing' OR child_stewardship.privacy_profile_held(tenant,job.profile_id) OR (bucket='disputes' AND p->>'kind'='protection') THEN RETURN false; END IF;
  RETURN EXISTS(SELECT 1 FROM child_stewardship.privacy_plan_items WHERE session_id=tenant AND request_id=job.request_id AND domain=record_domain AND collection=bucket AND record_id=reference AND (action='erase' OR reason='legal_hold') AND payload_digest=encode(sha256(convert_to(p::text,'UTF8')),'hex'));
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.record_privacy_deletion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$ BEGIN
  IF NOT child_stewardship.privacy_delete_permitted(OLD.session_id,OLD.domain,OLD.collection,OLD.record_id,OLD.payload) THEN RAISE EXCEPTION 'CHILD_PRIVACY_DELETE_NOT_AUTHORIZED' USING ERRCODE='42501'; END IF;
  INSERT INTO child_stewardship.privacy_receipts(session_id,request_id,resource_kind,resource_ref,content_digest,outcome) VALUES(OLD.session_id,current_setting('app.child_privacy_request_id',true),'record',OLD.collection||'/'||OLD.record_id,encode(sha256(convert_to(OLD.payload::text,'UTF8')),'hex'),'deleted');
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS privacy_deletion_receipt ON child_stewardship.state_records;
CREATE TRIGGER privacy_deletion_receipt AFTER DELETE ON child_stewardship.state_records FOR EACH ROW EXECUTE FUNCTION child_stewardship.record_privacy_deletion();
CREATE OR REPLACE FUNCTION child_stewardship.guard_privacy_suppression() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE profile text; blocked boolean:=false; BEGIN
  IF NEW.domain<>'learning' THEN RETURN NEW; END IF;
  CASE NEW.collection
    WHEN 'profiles' THEN profile:=NEW.record_id; SELECT EXISTS(SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=NEW.session_id AND canonical_participant_ref=NEW.payload->>'canonicalParticipantRef') INTO blocked;
    WHEN 'guardianLinks','consents','assignments','disputes' THEN profile:=NEW.payload->>'profileId';
    WHEN 'observations' THEN profile:=child_stewardship.privacy_profile_for_ref(NEW.session_id,'assignments',NEW.payload->>'assignmentId');
    WHEN 'reviews' THEN profile:=child_stewardship.privacy_profile_for_ref(NEW.session_id,'observations',NEW.payload->>'observationId');
    WHEN 'assessments' THEN SELECT EXISTS(SELECT 1 FROM jsonb_array_elements_text(NEW.payload->'reviewIds') r JOIN child_stewardship.privacy_suppressions s ON s.session_id=NEW.session_id AND s.profile_id=child_stewardship.privacy_profile_for_ref(NEW.session_id,'reviews',r)) INTO blocked;
    WHEN 'aliases','contributions' THEN SELECT EXISTS(SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=NEW.session_id AND canonical_participant_ref=CASE NEW.collection WHEN 'aliases' THEN NEW.payload#>>'{}' ELSE NEW.payload->>'canonicalParticipantRef' END) INTO blocked;
    ELSE RETURN NEW;
  END CASE;
  blocked:=blocked OR EXISTS(SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=NEW.session_id AND profile_id=profile);
  IF NOT blocked THEN RETURN NEW; END IF;
  -- Suppression never prevents protective reporting or a minimal correction to an old C fact.
  IF NEW.collection='disputes' AND NEW.payload->>'kind'='protection' THEN RETURN NEW; END IF;
  IF NEW.collection='contributions' AND NEW.payload->>'entryType'='correction' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND current_setting('app.child_operation',true)='request-privacy' AND ((NEW.collection='profiles' AND NEW.payload->>'status'='paused' AND (NEW.payload-'status')=(OLD.payload-'status')) OR (NEW.collection='consents' AND NEW.payload->>'guardianGranted'='false' AND NEW.payload->>'childAssent'='false' AND NEW.payload->>'withdrawnAt' IS NOT NULL)) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'CHILD_PRIVACY_PROFILE_SUPPRESSED' USING ERRCODE='42501';
END $$;
DROP TRIGGER IF EXISTS privacy_suppression_guard ON child_stewardship.state_records;
CREATE TRIGGER privacy_suppression_guard BEFORE INSERT OR UPDATE ON child_stewardship.state_records FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_privacy_suppression();
CREATE OR REPLACE FUNCTION child_stewardship.guard_privacy_object() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE job child_stewardship.privacy_jobs%ROWTYPE; permitted boolean; BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'CHILD_PRIVACY_OBJECT_IMMUTABLE' USING ERRCODE='42501'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.session_id::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RAISE EXCEPTION 'CHILD_PRIVACY_TENANT' USING ERRCODE='42501'; END IF;
    IF to_regprocedure('child_stewardship.media_object_insert_allowed(uuid,text,text,text,text,bytea,timestamp with time zone,boolean)') IS NOT NULL THEN
      IF child_stewardship.media_object_insert_allowed(NEW.session_id,NEW.object_id,NEW.profile_id,NEW.purpose,NEW.kind,NEW.content,NEW.expires_at,NEW.external) THEN RETURN NEW; END IF;
    END IF;
    IF child_stewardship.is_privacy_worker() THEN
      SELECT * INTO job FROM child_stewardship.privacy_jobs WHERE session_id=NEW.session_id AND request_id=current_setting('app.child_privacy_request_id',true);
      IF job.kind IS DISTINCT FROM 'export_learning' OR job.state IS DISTINCT FROM 'processing' OR NEW.profile_id<>job.profile_id OR NEW.object_id IS DISTINCT FROM ('export:'||job.request_id) OR NEW.kind<>'export' OR NEW.external OR NEW.purpose<>'learning' OR NEW.expires_at IS NULL OR NEW.expires_at>clock_timestamp()+interval '24 hours' OR NEW.expires_at<=clock_timestamp() THEN RAISE EXCEPTION 'CHILD_PRIVACY_EXPORT_SCOPE' USING ERRCODE='42501'; END IF;
    ELSE
      SELECT enabled AND expires_at>clock_timestamp() INTO permitted FROM child_stewardship.service_role_scopes WHERE database_role=child_stewardship.privacy_database_role() AND actor_role=current_setting('app.child_actor_role',true) ORDER BY scope_version DESC LIMIT 1;
      IF permitted IS DISTINCT FROM true OR NOT EXISTS(SELECT 1 FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='profiles' AND record_id=NEW.profile_id) OR EXISTS(SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=NEW.session_id AND profile_id=NEW.profile_id) THEN RAISE EXCEPTION 'CHILD_PRIVACY_OBJECT_SUPPRESSED' USING ERRCODE='42501'; END IF;
    END IF;
    RETURN NEW;
  END IF;
  IF NOT child_stewardship.is_privacy_worker() OR OLD.session_id::text IS DISTINCT FROM current_setting('app.child_session_id',true) THEN RAISE EXCEPTION 'CHILD_PRIVACY_WORKER_REQUIRED' USING ERRCODE='42501'; END IF;
  SELECT * INTO job FROM child_stewardship.privacy_jobs WHERE session_id=OLD.session_id AND request_id=current_setting('app.child_privacy_request_id',true) FOR UPDATE;
  -- Export expiry is a pre-bound lifecycle action: exact export/job/profile, actual
  -- approved worker role, immutable expiry in the past, and no external capability.
  IF job.kind='export_learning' AND job.state='completed' AND OLD.object_id='export:'||job.request_id AND OLD.profile_id=job.profile_id AND OLD.kind='export' AND OLD.purpose='learning' AND NOT OLD.external AND OLD.expires_at<=clock_timestamp() THEN RETURN OLD; END IF;
  IF job.kind IS DISTINCT FROM 'delete_learning' OR job.state IS DISTINCT FROM 'processing' OR OLD.profile_id<>job.profile_id OR OLD.purpose IN ('protection','rights') OR OLD.external OR child_stewardship.privacy_profile_held(OLD.session_id,OLD.profile_id) OR (OLD.kind='backup' AND OLD.expires_at>clock_timestamp()) OR NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_plan_items WHERE session_id=OLD.session_id AND request_id=job.request_id AND domain='object' AND collection=OLD.kind AND record_id=OLD.object_id AND payload_digest=encode(sha256(coalesce(OLD.content,''::bytea)),'hex') AND (action='erase' OR reason='legal_hold' OR (reason='backup_unexpired' AND OLD.kind='backup' AND OLD.expires_at<=clock_timestamp()))) THEN RAISE EXCEPTION 'CHILD_PRIVACY_OBJECT_DELETE_SCOPE' USING ERRCODE='42501'; END IF;
  RETURN OLD;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.record_privacy_object_deletion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$ BEGIN
  INSERT INTO child_stewardship.privacy_receipts(session_id,request_id,resource_kind,resource_ref,content_digest,outcome) VALUES(OLD.session_id,current_setting('app.child_privacy_request_id',true),'object',OLD.object_id,encode(sha256(coalesce(OLD.content,''::bytea)),'hex'),'deleted');
  RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS privacy_object_guard ON child_stewardship.privacy_objects;
CREATE TRIGGER privacy_object_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.privacy_objects FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_privacy_object();
DROP TRIGGER IF EXISTS privacy_object_deleted ON child_stewardship.privacy_objects;
CREATE TRIGGER privacy_object_deleted AFTER DELETE ON child_stewardship.privacy_objects FOR EACH ROW EXECUTE FUNCTION child_stewardship.record_privacy_object_deletion();
CREATE OR REPLACE FUNCTION child_stewardship.record_privacy_retention() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE outcome text; BEGIN
  IF NEW.action='retain' THEN
    outcome:=CASE NEW.reason WHEN 'processor_unavailable' THEN 'pending_processor' WHEN 'backup_unexpired' THEN 'pending_backup' ELSE 'retained' END;
    INSERT INTO child_stewardship.privacy_receipts(session_id,request_id,resource_kind,resource_ref,content_digest,outcome) VALUES(NEW.session_id,NEW.request_id,CASE NEW.domain WHEN 'object' THEN 'object' ELSE 'record' END,CASE NEW.domain WHEN 'object' THEN NEW.record_id ELSE NEW.collection||'/'||NEW.record_id END,NEW.payload_digest,outcome);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS privacy_retention_receipt ON child_stewardship.privacy_plan_items;
CREATE TRIGGER privacy_retention_receipt AFTER INSERT ON child_stewardship.privacy_plan_items FOR EACH ROW EXECUTE FUNCTION child_stewardship.record_privacy_retention();
CREATE OR REPLACE FUNCTION child_stewardship.privacy_revision_authorized(tenant uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
  SELECT child_stewardship.is_privacy_worker() AND tenant::text=current_setting('app.child_session_id',true) AND EXISTS(SELECT 1 FROM child_stewardship.privacy_receipts WHERE session_id=tenant AND request_id=current_setting('app.child_privacy_request_id',true) AND transaction_id=pg_current_xact_id()::text AND resource_kind='record' AND outcome='deleted' AND revision_before=(SELECT revision FROM child_stewardship.sessions WHERE id=tenant))
$$;
CREATE OR REPLACE FUNCTION child_stewardship.check_privacy_completion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE pending boolean; original_tenant text; BEGIN
  original_tenant:=current_setting('app.child_session_id',true);
  PERFORM set_config('app.child_session_id',NEW.session_id::text,true);
  IF NEW.state<>'completed' THEN PERFORM set_config('app.child_session_id',coalesce(original_tenant,''),true); RETURN NULL; END IF;
  IF EXISTS(SELECT 1 FROM child_stewardship.privacy_plan_items i WHERE i.session_id=NEW.session_id AND i.request_id=NEW.request_id AND NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_receipts r WHERE r.session_id=i.session_id AND r.request_id=i.request_id AND r.resource_kind=CASE i.domain WHEN 'object' THEN 'object' ELSE 'record' END AND r.resource_ref=CASE i.domain WHEN 'object' THEN i.record_id ELSE i.collection||'/'||i.record_id END AND r.content_digest=i.payload_digest AND (r.outcome='deleted' OR (r.outcome='retained' AND child_stewardship.privacy_retention_valid(i.session_id,i.request_id,i.domain,i.collection,i.record_id))))) THEN RAISE EXCEPTION 'CHILD_PRIVACY_PROCESSING_PENDING' USING ERRCODE='23514'; END IF;
  IF NEW.kind='delete_learning' THEN
    SELECT EXISTS(SELECT 1 FROM child_stewardship.privacy_objects o WHERE o.session_id=NEW.session_id AND o.profile_id=NEW.profile_id AND NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_receipts r WHERE r.session_id=o.session_id AND r.request_id=NEW.request_id AND r.resource_kind='object' AND r.resource_ref=o.object_id AND r.outcome='retained' AND child_stewardship.privacy_retention_valid(o.session_id,NEW.request_id,'object',o.kind,o.object_id))) INTO pending;
    IF pending OR EXISTS(SELECT 1 FROM child_stewardship.state_records s WHERE s.session_id=NEW.session_id AND s.domain='learning' AND s.collection IN ('profiles','guardianLinks','consents','assignments','observations','reviews','assessments','disputes') AND child_stewardship.privacy_record_belongs_to(s.session_id,s.collection,s.record_id,NEW.profile_id) AND NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_receipts r WHERE r.session_id=s.session_id AND r.request_id=NEW.request_id AND r.resource_kind='record' AND r.resource_ref=s.collection||'/'||s.record_id AND r.outcome='retained' AND child_stewardship.privacy_retention_valid(s.session_id,NEW.request_id,s.domain,s.collection,s.record_id))) THEN RAISE EXCEPTION 'CHILD_PRIVACY_INVENTORY_INCOMPLETE' USING ERRCODE='23514'; END IF;
  ELSE
    IF NOT EXISTS(SELECT 1 FROM child_stewardship.privacy_objects WHERE session_id=NEW.session_id AND profile_id=NEW.profile_id AND kind='export' AND NOT external AND expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'CHILD_PRIVACY_EXPORT_UNAVAILABLE' USING ERRCODE='23514'; END IF;
  END IF;
  PERFORM set_config('app.child_session_id',coalesce(original_tenant,''),true);
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS privacy_completion ON child_stewardship.privacy_jobs;
CREATE CONSTRAINT TRIGGER privacy_completion AFTER UPDATE ON child_stewardship.privacy_jobs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION child_stewardship.check_privacy_completion();
CREATE OR REPLACE FUNCTION child_stewardship.guard_privacy_worker_boundary() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
  IF child_stewardship.is_privacy_worker() THEN RAISE EXCEPTION 'CHILD_PRIVACY_WORKER_NARROW_SCOPE' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['session_tokens','receipts','audit','outbox','state_events'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS privacy_worker_boundary ON child_stewardship.%I',relation);
    EXECUTE format('CREATE TRIGGER privacy_worker_boundary BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_privacy_worker_boundary()',relation);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
