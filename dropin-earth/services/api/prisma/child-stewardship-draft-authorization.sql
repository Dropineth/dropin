-- Fresh per-draft synthetic upload capabilities. No real bytes or real identity admission.
BEGIN;
CREATE TABLE IF NOT EXISTS child_stewardship.draft_authorizations(
 proof_hash text PRIMARY KEY CHECK(proof_hash~'^[a-f0-9]{64}$'),session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
 actor_id text NOT NULL,device_id text NOT NULL,actor_epoch integer NOT NULL,generation bigint NOT NULL,
 proposal jsonb NOT NULL,issued_at timestamptz NOT NULL,expires_at timestamptz NOT NULL CHECK(expires_at>issued_at)
);
CREATE TABLE IF NOT EXISTS child_stewardship.draft_authorization_uses(
 proof_hash text PRIMARY KEY REFERENCES child_stewardship.draft_authorizations(proof_hash),session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
 actor_id text NOT NULL,command_id text NOT NULL,command_digest text NOT NULL CHECK(command_digest~'^[a-f0-9]{64}$'),expected_version bigint NOT NULL CHECK(expected_version>=0),outcome text NOT NULL CHECK(outcome IN('observation','receipt')),request_digest text NOT NULL CHECK(request_digest~'^[a-f0-9]{64}$'),transaction_id text NOT NULL,used_at timestamptz NOT NULL
);
CREATE OR REPLACE FUNCTION child_stewardship.guard_draft_capability() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_name name;BEGIN
 SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid=TG_RELID;
 IF TG_OP<>'INSERT' OR current_user<>owner_name THEN RAISE EXCEPTION 'CHILD_DRAFT_CAPABILITY_IMMUTABLE' USING ERRCODE='42501';END IF;RETURN NEW;
END $$;
DO $$ DECLARE relation text;BEGIN
 FOREACH relation IN ARRAY ARRAY['draft_authorizations','draft_authorization_uses'] LOOP
  EXECUTE format('ALTER TABLE child_stewardship.%I ENABLE ROW LEVEL SECURITY',relation);EXECUTE format('ALTER TABLE child_stewardship.%I FORCE ROW LEVEL SECURITY',relation);
  EXECUTE format('DROP POLICY IF EXISTS draft_tenant ON child_stewardship.%I',relation);
  EXECUTE format('CREATE POLICY draft_tenant ON child_stewardship.%I USING(session_id::text=current_setting(''app.child_session_id'',true)) WITH CHECK(session_id::text=current_setting(''app.child_session_id'',true))',relation);
  EXECUTE format('DROP TRIGGER IF EXISTS draft_immutable ON child_stewardship.%I',relation);
  EXECUTE format('CREATE TRIGGER draft_immutable BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_draft_capability()',relation);
 END LOOP;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.draft_canonical_json(value jsonb) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,child_stewardship AS $$
DECLARE encoded text;BEGIN
 CASE jsonb_typeof(value)
 WHEN 'object' THEN SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||child_stewardship.draft_canonical_json(val),',' ORDER BY key COLLATE "C"),'')||'}' INTO encoded FROM jsonb_each(value) AS item(key,val);
 WHEN 'array' THEN SELECT '['||coalesce(string_agg(child_stewardship.draft_canonical_json(val),',' ORDER BY position),'')||']' INTO encoded FROM jsonb_array_elements(value) WITH ORDINALITY AS item(val,position);
 ELSE encoded:=value::text;END CASE;RETURN encoded;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.draft_command_valid(command jsonb) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,child_stewardship AS $$
BEGIN
 PERFORM (command->>'capturedAtClaimed')::timestamptz;
 RETURN coalesce(jsonb_typeof(command)='object' AND command ?& ARRAY['type','commandId','expectedVersion','assignmentId','sampleId','answer','capturedAtClaimed']
 AND command-ARRAY['type','commandId','expectedVersion','assignmentId','sampleId','answer','capturedAtClaimed']='{}'::jsonb
 AND command->>'type'='submit-observation' AND command->>'commandId'~'^demo-[a-z0-9-]{1,72}$' AND command->>'assignmentId'~'^demo-[a-z0-9-]{1,72}$'
 AND jsonb_typeof(command->'expectedVersion')='number' AND command->>'expectedVersion'~'^[0-9]{1,15}$'
 AND command->>'sampleId' IN('demo-leaf-green','demo-leaf-yellow') AND command->>'answer' IN('green','yellow','uncertain')
 AND command->>'capturedAtClaimed'~'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{3})?Z$',false);
EXCEPTION WHEN invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $$;
-- The raw capability is the only caller-supplied authority. These context checks
-- bind the result to current server records rather than claims in a draft.
CREATE OR REPLACE FUNCTION child_stewardship.draft_authority_current(tenant uuid,actor_ref text,device_ref text,epoch_value integer,generation_value bigint,proposal jsonb,check_version boolean) RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE actor jsonb;assignment jsonb;profile jsonb;task jsonb;link jsonb;guardian jsonb;consent jsonb;meta jsonb;purpose text;active_generation bigint;active_state text;database_actor name;permitted boolean;moment timestamptz:=clock_timestamp();BEGIN
 IF tenant::text IS DISTINCT FROM current_setting('app.child_session_id',true) OR NOT EXISTS(SELECT 1 FROM child_stewardship.sessions WHERE id=tenant AND mode='synthetic-demo' AND storage_format='normalized-v2' AND expires_at>moment) THEN RETURN false;END IF;
 SELECT generation,state INTO active_generation,active_state FROM child_stewardship.session_resumption WHERE session_id=tenant;
 IF generation_value<>coalesce(active_generation,0) OR coalesce(active_state,'active')<>'active' THEN RETURN false;END IF;
 SELECT payload INTO actor FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='actors' AND record_id=actor_ref;
 IF actor IS NULL OR actor->>'role' NOT IN('guardian','child') OR actor->>'revoked' IS DISTINCT FROM 'false' OR (actor->>'epoch')::integer IS DISTINCT FROM epoch_value OR NOT((actor->'deviceIds')?device_ref) OR (actor->>'expiresAt')::timestamptz<=moment THEN RETURN false;END IF;
 database_actor:=CASE WHEN coalesce(current_setting('role',true),'none') IN('none','') THEN session_user ELSE current_setting('role',true)::name END;
 SELECT enabled AND expires_at>moment INTO permitted FROM child_stewardship.service_role_scopes WHERE database_role=database_actor AND actor_role=actor->>'role' ORDER BY scope_version DESC LIMIT 1;
 IF permitted IS DISTINCT FROM true THEN RETURN false;END IF;
 SELECT payload INTO meta FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='meta' AND record_id='current';
 SELECT payload INTO assignment FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='assignments' AND record_id=proposal->>'assignmentId';
 SELECT payload INTO profile FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='profiles' AND record_id=assignment->>'profileId';
 SELECT payload INTO task FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='tasks' AND record_id=assignment->>'taskId';
 SELECT payload INTO link FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='guardianLinks' AND record_id=assignment->>'profileId';
 SELECT payload INTO guardian FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='actors' AND record_id=profile->>'guardianActorId';
 IF assignment IS NULL OR profile IS NULL OR task IS NULL OR link IS NULL OR guardian IS NULL OR meta IS NULL
 OR profile->>'status' IS DISTINCT FROM 'active' OR actor_ref NOT IN(profile->>'actorId',profile->>'guardianActorId')
 OR proposal->>'originalSessionId' IS DISTINCT FROM tenant::text OR proposal->>'policyVersion' IS DISTINCT FROM meta->>'policyVersion'
 OR (check_version AND proposal->>'expectedVersion' IS DISTINCT FROM meta->>'version')
 OR assignment->>'status' IS DISTINCT FROM 'active' OR assignment->>'taskVersion' IS DISTINCT FROM task->>'templateVersion' OR task->>'cancelled' IS DISTINCT FROM 'false'
 OR (task->>'opensAt')::timestamptz>moment OR (task->>'closesAt')::timestamptz<=moment OR NOT((task->'ageBands')?(profile->>'ageBand')) OR NOT((meta->'agePolicy'->'ageBands')?(profile->>'ageBand'))
 OR (link->>'expiresAt')::timestamptz<=moment OR guardian->>'revoked' IS DISTINCT FROM 'false' OR (guardian->>'expiresAt')::timestamptz<=moment THEN RETURN false;END IF;
 IF to_regclass('child_stewardship.privacy_suppressions') IS NOT NULL THEN
  IF EXISTS(SELECT 1 FROM child_stewardship.privacy_suppressions WHERE session_id=tenant AND profile_id=profile->>'id') THEN RETURN false;END IF;
 END IF;
 FOREACH purpose IN ARRAY ARRAY['learning','upload'] LOOP
  SELECT payload INTO consent FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='consents' AND record_id=(profile->>'id')||':'||purpose;
  IF consent IS NULL OR consent->>'guardianGranted' IS DISTINCT FROM 'true' OR consent->>'childAssent' IS DISTINCT FROM 'true' OR consent->>'withdrawnAt' IS NOT NULL OR consent->>'policyVersion' IS DISTINCT FROM meta->>'policyVersion' OR consent->>'guardianLinkVersion' IS DISTINCT FROM link->>'version' OR (consent->>'expiresAt')::timestamptz<=moment
   OR (purpose='upload' AND (consent->>'version' IS DISTINCT FROM assignment->>'consentVersion' OR consent->>'version' IS DISTINCT FROM proposal->>'originalConsentEpoch')) THEN RETURN false;END IF;
 END LOOP;RETURN true;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.issue_draft_authorization(raw_bearer text,proposal jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE token child_stewardship.session_tokens%ROWTYPE;raw_proof text;moment timestamptz;session_expiry timestamptz;BEGIN
 IF raw_bearer IS NULL OR raw_bearer !~ '^cp-demo\.[A-Za-z0-9_-]{43}$' OR jsonb_typeof(proposal) IS DISTINCT FROM 'object' THEN RETURN NULL;END IF;
 IF NOT(proposal ?& ARRAY['draftId','intentDigest','assignmentId','originalSessionId','originalConsentEpoch','purpose','schemaVersion','policyVersion','expectedVersion']) OR proposal-ARRAY['draftId','intentDigest','assignmentId','originalSessionId','originalConsentEpoch','purpose','schemaVersion','policyVersion','expectedVersion']<>'{}'::jsonb
 OR jsonb_typeof(proposal->'draftId') IS DISTINCT FROM 'string' OR jsonb_typeof(proposal->'intentDigest') IS DISTINCT FROM 'string' OR jsonb_typeof(proposal->'assignmentId') IS DISTINCT FROM 'string' OR proposal->>'assignmentId'!~'^demo-[a-z0-9-]{1,72}$' OR proposal->>'draftId'!~'^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' OR proposal->>'intentDigest'!~'^[a-f0-9]{64}$' OR proposal->>'purpose' IS DISTINCT FROM 'synthetic-learning-upload' OR proposal->>'schemaVersion' IS DISTINCT FROM 'CanopyProof-SyntheticDraft/2'
 OR jsonb_typeof(proposal->'expectedVersion') IS DISTINCT FROM 'number' OR proposal->>'expectedVersion'!~'^[0-9]{1,15}$' OR jsonb_typeof(proposal->'originalConsentEpoch') IS DISTINCT FROM 'number' OR proposal->>'originalConsentEpoch'!~'^[1-9][0-9]{0,14}$' THEN RETURN NULL;END IF;
 PERFORM set_config('app.child_token_hash',encode(sha256(convert_to(raw_bearer,'UTF8')),'hex'),true);
 SELECT * INTO token FROM child_stewardship.session_tokens WHERE token_hash=current_setting('app.child_token_hash',true);IF NOT FOUND THEN RETURN NULL;END IF;
 PERFORM set_config('app.child_session_id',token.session_id::text,true);
 SELECT expires_at INTO session_expiry FROM child_stewardship.sessions WHERE id=token.session_id FOR UPDATE;moment:=clock_timestamp();
 IF NOT child_stewardship.draft_authority_current(token.session_id,token.actor_id,token.device_id,token.epoch,token.generation,proposal,true) THEN RETURN NULL;END IF;
 raw_proof:='cp-upload.'||rtrim(translate(encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'base64'),'+/','-_'),'=');
 INSERT INTO child_stewardship.draft_authorizations VALUES(encode(sha256(convert_to(raw_proof,'UTF8')),'hex'),token.session_id,token.actor_id,token.device_id,token.epoch,token.generation,proposal,moment,least(session_expiry,moment+interval '5 minutes'));
 RETURN raw_proof;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.consume_draft_authorization(raw_proof text,tenant uuid,actor_ref text,command jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE grant_record child_stewardship.draft_authorizations%ROWTYPE;prior_use child_stewardship.draft_authorization_uses%ROWTYPE;request_hash text;command_hash text;receipt_exists boolean;BEGIN
 IF tenant::text IS DISTINCT FROM current_setting('app.child_session_id',true) OR actor_ref IS DISTINCT FROM current_setting('app.child_actor_id',true) OR raw_proof IS NULL OR raw_proof!~'^cp-upload\.[A-Za-z0-9_-]{43}$' OR NOT child_stewardship.draft_command_valid(command) THEN RETURN false;END IF;
 PERFORM 1 FROM child_stewardship.sessions WHERE id=tenant FOR UPDATE;
 SELECT * INTO grant_record FROM child_stewardship.draft_authorizations WHERE proof_hash=encode(sha256(convert_to(raw_proof,'UTF8')),'hex') AND session_id=tenant FOR UPDATE;
 command_hash:=encode(sha256(convert_to(child_stewardship.draft_canonical_json(command),'UTF8')),'hex');
 request_hash:=encode(sha256(convert_to(child_stewardship.draft_canonical_json(jsonb_build_object('path','/commands','body',command)),'UTF8')),'hex');
 IF NOT FOUND OR grant_record.actor_id<>actor_ref OR grant_record.expires_at<=clock_timestamp() OR grant_record.proposal->>'intentDigest' IS DISTINCT FROM command_hash OR command->>'commandId' IS DISTINCT FROM 'demo-'||(grant_record.proposal->>'draftId') OR command->>'assignmentId' IS DISTINCT FROM grant_record.proposal->>'assignmentId' THEN RETURN false;END IF;
 SELECT EXISTS(SELECT 1 FROM child_stewardship.receipts WHERE session_id=tenant AND actor_id=actor_ref AND idempotency_key=command->>'commandId' AND request_digest=request_hash) INTO receipt_exists;
 SELECT * INTO prior_use FROM child_stewardship.draft_authorization_uses WHERE proof_hash=grant_record.proof_hash;
 IF FOUND THEN
  RETURN receipt_exists AND prior_use.session_id=tenant AND prior_use.actor_id=actor_ref AND prior_use.command_id=command->>'commandId' AND prior_use.command_digest=command_hash AND prior_use.request_digest=request_hash
   AND child_stewardship.draft_authority_current(tenant,actor_ref,grant_record.device_id,grant_record.actor_epoch,grant_record.generation,grant_record.proposal,false);
 END IF;
 IF NOT child_stewardship.draft_authority_current(tenant,actor_ref,grant_record.device_id,grant_record.actor_epoch,grant_record.generation,grant_record.proposal,true) OR (NOT receipt_exists AND grant_record.proposal->>'expectedVersion' IS DISTINCT FROM command->>'expectedVersion') THEN RETURN false;END IF;
 INSERT INTO child_stewardship.draft_authorization_uses VALUES(grant_record.proof_hash,tenant,actor_ref,command->>'commandId',command_hash,(command->>'expectedVersion')::bigint,CASE WHEN receipt_exists THEN 'receipt' ELSE 'observation' END,request_hash,pg_current_xact_id()::text,clock_timestamp());RETURN true;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.guard_fresh_draft_observation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE use_record child_stewardship.draft_authorization_uses%ROWTYPE;grant_record child_stewardship.draft_authorizations%ROWTYPE;assignment jsonb;profile jsonb;task jsonb;command jsonb;BEGIN
 IF NEW.domain<>'learning' OR NEW.collection<>'observations' THEN RETURN NEW;END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.payload-'state') IS DISTINCT FROM (OLD.payload-'state') THEN RAISE EXCEPTION 'CHILD_OBSERVATION_CONTENT_IMMUTABLE' USING ERRCODE='42501';END IF;
  IF NEW.payload->>'state' IS DISTINCT FROM OLD.payload->>'state' AND (current_setting('app.child_actor_role',true) NOT IN('reviewer','protector') OR current_setting('app.child_operation',true) IS DISTINCT FROM 'review-observation' OR NEW.payload->>'state' NOT IN('accepted_for_learning','needs_review')) THEN RAISE EXCEPTION 'CHILD_OBSERVATION_REVIEW_REQUIRED' USING ERRCODE='42501';END IF;RETURN NEW;
 END IF;
 -- INSERT ON CONFLICT subsequently invokes the immutable-content UPDATE guard.
 IF EXISTS(SELECT 1 FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain=NEW.domain AND collection=NEW.collection AND record_id=NEW.record_id) THEN RETURN NEW;END IF;
 SELECT * INTO use_record FROM child_stewardship.draft_authorization_uses WHERE session_id=NEW.session_id AND actor_id=current_setting('app.child_actor_id',true) AND transaction_id=pg_current_xact_id()::text AND outcome='observation' AND 'demo-submit-observation-'||substring(command_id FROM 6)=NEW.record_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'CHILD_FRESH_DRAFT_AUTHORIZATION_REQUIRED' USING ERRCODE='42501';END IF;
 SELECT * INTO grant_record FROM child_stewardship.draft_authorizations WHERE proof_hash=use_record.proof_hash;
 command:=jsonb_build_object('type','submit-observation','commandId',use_record.command_id,'expectedVersion',use_record.expected_version,'assignmentId',NEW.payload->'assignmentId','sampleId',NEW.payload->'sampleId','answer',NEW.payload->'answer','capturedAtClaimed',NEW.payload->'capturedAtClaimed');
 IF NOT child_stewardship.draft_command_valid(command) OR encode(sha256(convert_to(child_stewardship.draft_canonical_json(command),'UTF8')),'hex') IS DISTINCT FROM use_record.command_digest THEN RAISE EXCEPTION 'CHILD_DRAFT_COMMAND_MISMATCH' USING ERRCODE='42501';END IF;
 IF NOT child_stewardship.draft_authority_current(NEW.session_id,use_record.actor_id,grant_record.device_id,grant_record.actor_epoch,grant_record.generation,grant_record.proposal,false) THEN RAISE EXCEPTION 'CHILD_DRAFT_AUTHORITY_REVOKED' USING ERRCODE='42501';END IF;
 SELECT payload INTO assignment FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='assignments' AND record_id=command->>'assignmentId';
 SELECT payload INTO profile FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='profiles' AND record_id=assignment->>'profileId';
 SELECT payload INTO task FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='tasks' AND record_id=assignment->>'taskId';
 IF NEW.payload->>'id' IS DISTINCT FROM NEW.record_id OR NEW.payload->>'assignmentId' IS DISTINCT FROM command->>'assignmentId' OR NEW.payload->>'enteredBy' IS DISTINCT FROM use_record.actor_id OR NEW.payload->>'sampleId' IS DISTINCT FROM command->>'sampleId' OR NEW.payload->>'answer' IS DISTINCT FROM command->>'answer' OR NEW.payload->>'capturedAtClaimed' IS DISTINCT FROM command->>'capturedAtClaimed'
 OR NEW.payload->>'treeId' IS DISTINCT FROM task->>'treeId' OR NEW.payload->>'observerRef' IS DISTINCT FROM profile->>'participantRef' OR NEW.payload->>'sourceType' IS DISTINCT FROM 'synthetic-reference' OR NEW.payload->>'evidenceLevel' IS DISTINCT FROM 'E0' OR NEW.payload->'captureTimeVerified' IS DISTINCT FROM 'false'::jsonb
 OR NEW.payload->>'digest' IS DISTINCT FROM encode(sha256(convert_to('{"sampleId":'||to_jsonb(command->>'sampleId')::text||'}','UTF8')),'hex')
 OR NOT(NEW.payload ?& ARRAY['id','assignmentId','treeId','observerRef','enteredBy','sourceType','sampleId','answer','capturedAtClaimed','receivedAt','captureTimeVerified','digest','state','evidenceLevel','duplicateOf']) OR NEW.payload->>'state' IS NULL OR NEW.payload->>'state' NOT IN('pending_review','needs_review') OR NEW.payload-ARRAY['id','assignmentId','treeId','observerRef','enteredBy','sourceType','sampleId','answer','capturedAtClaimed','receivedAt','captureTimeVerified','digest','state','evidenceLevel','duplicateOf']<>'{}'::jsonb THEN RAISE EXCEPTION 'CHILD_DRAFT_COMMAND_MISMATCH' USING ERRCODE='42501';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fresh_draft_observation ON child_stewardship.state_records;
CREATE TRIGGER fresh_draft_observation BEFORE INSERT OR UPDATE ON child_stewardship.state_records FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_fresh_draft_observation();
CREATE OR REPLACE FUNCTION child_stewardship.check_draft_consumption() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE prior text;BEGIN
 prior:=current_setting('app.child_session_id',true);PERFORM set_config('app.child_session_id',NEW.session_id::text,true);
 IF NEW.outcome='receipt' THEN
  IF NOT EXISTS(SELECT 1 FROM child_stewardship.receipts WHERE session_id=NEW.session_id AND actor_id=NEW.actor_id AND idempotency_key=NEW.command_id AND request_digest=NEW.request_digest) THEN RAISE EXCEPTION 'CHILD_DRAFT_RECEIPT_REQUIRED' USING ERRCODE='23514';END IF;
  PERFORM set_config('app.child_session_id',coalesce(prior,''),true);RETURN NULL;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM child_stewardship.state_records WHERE session_id=NEW.session_id AND domain='learning' AND collection='observations' AND record_id='demo-submit-observation-'||substring(NEW.command_id FROM 6) AND payload->>'enteredBy'=NEW.actor_id AND xmin::text::numeric=mod(NEW.transaction_id::numeric,4294967296)) THEN RAISE EXCEPTION 'CHILD_DRAFT_OBSERVATION_REQUIRED' USING ERRCODE='23514';END IF;
 PERFORM set_config('app.child_session_id',coalesce(prior,''),true);RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS draft_consumption_complete ON child_stewardship.draft_authorization_uses;
CREATE CONSTRAINT TRIGGER draft_consumption_complete AFTER INSERT ON child_stewardship.draft_authorization_uses DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION child_stewardship.check_draft_consumption();
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
