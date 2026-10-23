-- Apply after child-stewardship.sql and child-stewardship-authority.sql.
-- Synthetic sessions only. No production role grants or credentials are created.
BEGIN;
ALTER TABLE child_stewardship.session_tokens ADD COLUMN IF NOT EXISTS generation bigint NOT NULL DEFAULT 0 CHECK(generation>=0);
CREATE TABLE IF NOT EXISTS child_stewardship.session_resumption (
  session_id uuid PRIMARY KEY REFERENCES child_stewardship.sessions(id),
  generation bigint NOT NULL CHECK(generation>0),
  state text NOT NULL CHECK(state IN ('active','suspended'))
);
CREATE TABLE IF NOT EXISTS child_stewardship.resume_tickets (
  ticket_hash text PRIMARY KEY CHECK(ticket_hash ~ '^[a-f0-9]{64}$'),
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
  generation bigint NOT NULL CHECK(generation>0),
  bindings jsonb NOT NULL CHECK(jsonb_typeof(bindings)='array' AND jsonb_array_length(bindings)=5),
  issued_at timestamptz NOT NULL, expires_at timestamptz NOT NULL,
  consumed_at timestamptz, outcome text CHECK(outcome IN ('resumed','denied')),
  transaction_id text,
  UNIQUE(session_id,generation),
  CHECK(expires_at>issued_at),
  CHECK((consumed_at IS NULL AND outcome IS NULL AND transaction_id IS NULL)
    OR (consumed_at IS NOT NULL AND outcome IS NOT NULL AND transaction_id IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS child_stewardship.resume_mints (
  token_hash text PRIMARY KEY CHECK(token_hash ~ '^[a-f0-9]{64}$'),
  ticket_hash text NOT NULL REFERENCES child_stewardship.resume_tickets(ticket_hash),
  session_id uuid NOT NULL, generation bigint NOT NULL,
  actor_id text NOT NULL, device_id text NOT NULL, epoch integer NOT NULL,
  transaction_id text NOT NULL,
  UNIQUE(ticket_hash,actor_id)
);
-- Narrow lookup avoids recursively reading session_tokens from its own RLS
-- predicate. Populated only from an already-admitted immutable token insert.
CREATE TABLE IF NOT EXISTS child_stewardship.resume_token_lookup (
  token_hash text PRIMARY KEY REFERENCES child_stewardship.session_tokens(token_hash),
  session_id uuid NOT NULL REFERENCES child_stewardship.sessions(id),
  generation bigint NOT NULL CHECK(generation>=0)
);
CREATE OR REPLACE FUNCTION child_stewardship.guard_resumption() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,child_stewardship AS $$
DECLARE owner_name name;
BEGIN
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class
    WHERE oid='child_stewardship.resume_tickets'::regclass;
  IF current_user<>owner_name THEN RAISE EXCEPTION 'CHILD_RESUME_FUNCTION_REQUIRED' USING ERRCODE='42501'; END IF;
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'CHILD_RESUME_HISTORY_IMMUTABLE'; END IF;
  IF TG_TABLE_NAME IN ('resume_mints','resume_token_lookup') AND TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_RESUME_HISTORY_IMMUTABLE'; END IF;
  IF TG_TABLE_NAME='resume_tickets' AND TG_OP='UPDATE' THEN
    IF (to_jsonb(NEW)-ARRAY['consumed_at','outcome','transaction_id']) IS DISTINCT FROM
      (to_jsonb(OLD)-ARRAY['consumed_at','outcome','transaction_id']) OR OLD.consumed_at IS NOT NULL
      OR NEW.consumed_at IS NULL THEN RAISE EXCEPTION 'CHILD_RESUME_HISTORY_IMMUTABLE'; END IF;
  END IF;
  IF TG_TABLE_NAME='session_resumption' AND TG_OP='UPDATE' THEN
    IF NEW.session_id<>OLD.session_id OR NOT(
      (OLD.state='active' AND NEW.state='suspended' AND NEW.generation=OLD.generation+1)
      OR (OLD.state='suspended' AND NEW.state='active' AND NEW.generation=OLD.generation)
    ) THEN RAISE EXCEPTION 'CHILD_RESUME_GENERATION_INVALID'; END IF;
  END IF;
  RETURN NEW;
END $$;
DO $$ DECLARE relation text; BEGIN
  FOREACH relation IN ARRAY ARRAY['session_resumption','resume_tickets','resume_mints','resume_token_lookup'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS resumption_guard ON child_stewardship.%I',relation);
    EXECUTE format('CREATE TRIGGER resumption_guard BEFORE INSERT OR UPDATE OR DELETE ON child_stewardship.%I FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_resumption()',relation);
    EXECUTE format('ALTER TABLE child_stewardship.%I ENABLE ROW LEVEL SECURITY',relation);
    EXECUTE format('ALTER TABLE child_stewardship.%I FORCE ROW LEVEL SECURITY',relation);
    EXECUTE format('DROP POLICY IF EXISTS resume_tenant ON child_stewardship.%I',relation);
    IF relation='resume_token_lookup' THEN
      EXECUTE format('CREATE POLICY resume_tenant ON child_stewardship.%I USING (session_id::text=current_setting(''app.child_session_id'',true) OR token_hash=current_setting(''app.child_token_hash'',true)) WITH CHECK (session_id::text=current_setting(''app.child_session_id'',true))',relation);
    ELSIF relation='resume_tickets' THEN
      EXECUTE format('CREATE POLICY resume_tenant ON child_stewardship.%I USING (session_id::text=current_setting(''app.child_session_id'',true) OR ticket_hash=current_setting(''app.child_resume_ticket_hash'',true)) WITH CHECK (session_id::text=current_setting(''app.child_session_id'',true))',relation);
    ELSE
      EXECUTE format('CREATE POLICY resume_tenant ON child_stewardship.%I USING (session_id::text=current_setting(''app.child_session_id'',true)) WITH CHECK (session_id::text=current_setting(''app.child_session_id'',true))',relation);
    END IF;
  END LOOP;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.record_resume_token_lookup() RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
BEGIN
  INSERT INTO child_stewardship.resume_token_lookup VALUES(NEW.token_hash,NEW.session_id,NEW.generation);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS resume_token_lookup ON child_stewardship.session_tokens;
CREATE TRIGGER resume_token_lookup AFTER INSERT ON child_stewardship.session_tokens
  FOR EACH ROW EXECUTE FUNCTION child_stewardship.record_resume_token_lookup();
-- Migration authority must be able to see the approved historical token rows;
-- verify backfill completeness before activation. Missing mappings fail closed.
INSERT INTO child_stewardship.resume_token_lookup SELECT token_hash,session_id,generation
  FROM child_stewardship.session_tokens ON CONFLICT(token_hash) DO NOTHING;

-- Restrictive policy composes with the existing tenant policy. Old generations
-- become unreadable to ordinary authentication immediately on suspension.
CREATE OR REPLACE FUNCTION child_stewardship.token_generation_active(target uuid, token_generation bigint) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE prior text:=current_setting('app.child_session_id',true); accepted boolean;
BEGIN
  IF target::text IS DISTINCT FROM prior AND NOT EXISTS(
    SELECT 1 FROM child_stewardship.resume_token_lookup WHERE session_id=target
      AND token_hash=current_setting('app.child_token_hash',true) AND generation=token_generation
  ) THEN RETURN false; END IF;
  -- The lookup policy runs before authentication has selected its tenant.
  -- Scope this small internal lookup, then restore the caller's tenant context.
  PERFORM set_config('app.child_session_id',target::text,true);
  SELECT coalesce((SELECT state='active' AND generation=token_generation
    FROM child_stewardship.session_resumption WHERE session_id=target),token_generation=0) INTO accepted;
  PERFORM set_config('app.child_session_id',coalesce(prior,''),true);
  RETURN accepted;
END $$;
DROP POLICY IF EXISTS current_token_generation ON child_stewardship.session_tokens;
CREATE POLICY current_token_generation ON child_stewardship.session_tokens AS RESTRICTIVE FOR SELECT
  USING (child_stewardship.token_generation_active(session_id,generation));

CREATE OR REPLACE FUNCTION child_stewardship.guard_session_token() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,child_stewardship AS $$
DECLARE permitted boolean; actor jsonb; owner_name name;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'CHILD_TOKEN_MAPPING_IMMUTABLE' USING ERRCODE='42501'; END IF;
  IF NEW.generation>0 THEN
    SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid='child_stewardship.resume_tickets'::regclass;
    IF current_user<>owner_name OR NOT EXISTS(
      SELECT 1 FROM child_stewardship.resume_mints m JOIN child_stewardship.resume_tickets t USING(ticket_hash)
      WHERE m.token_hash=NEW.token_hash AND m.session_id=NEW.session_id AND m.generation=NEW.generation
        AND m.actor_id=NEW.actor_id AND m.device_id=NEW.device_id AND m.epoch=NEW.epoch
        AND m.transaction_id=pg_current_xact_id()::text AND t.transaction_id=m.transaction_id
        AND t.session_id=m.session_id AND t.generation=m.generation AND t.outcome='resumed'
        AND t.consumed_at IS NOT NULL
    ) THEN RAISE EXCEPTION 'CHILD_TOKEN_RESUME_ADMISSION_REQUIRED' USING ERRCODE='42501'; END IF;
  ELSE
    SELECT enabled AND expires_at>clock_timestamp() INTO permitted FROM child_stewardship.service_role_scopes
      WHERE database_role=current_user AND actor_role='bootstrap' ORDER BY scope_version DESC LIMIT 1;
    IF permitted IS DISTINCT FROM true OR current_setting('app.child_actor_role',true) IS DISTINCT FROM 'bootstrap'
      OR current_setting('app.child_operation',true) IS DISTINCT FROM 'create-synthetic-session'
      OR NOT EXISTS(SELECT 1 FROM child_stewardship.session_births WHERE session_id=NEW.session_id AND transaction_id=pg_current_xact_id()::text)
      THEN RAISE EXCEPTION 'CHILD_TOKEN_BOOTSTRAP_CLOSED' USING ERRCODE='42501'; END IF;
  END IF;
  SELECT payload INTO actor FROM child_stewardship.state_records WHERE session_id=NEW.session_id
    AND domain='learning' AND collection='actors' AND record_id=NEW.actor_id;
  IF actor IS NULL OR (actor->>'epoch')::integer IS DISTINCT FROM NEW.epoch
    OR actor->>'revoked' IS DISTINCT FROM 'false' OR NOT((actor->'deviceIds') ? NEW.device_id)
    THEN RAISE EXCEPTION 'CHILD_TOKEN_PRINCIPAL_INVALID' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END $$;

-- SECURITY DEFINER accepts raw high-entropy bearer material, hashes internally,
-- and rechecks binding under the same session row lock used by domain writes.
-- No caller-supplied actor, known hash, generation, approval flag or clock is trusted.
-- Read-only proof-to-tenant lookup for the server's independently current
-- outside-backup anchor check. Never accepts a caller asserted tenant or hash.
CREATE OR REPLACE FUNCTION child_stewardship.resume_capability_session(raw_capability text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE digest text;tenant uuid;prior_token text:=current_setting('app.child_token_hash',true);prior_ticket text:=current_setting('app.child_resume_ticket_hash',true);
BEGIN
 IF raw_capability IS NULL THEN RETURN NULL;END IF;
 digest:=encode(sha256(convert_to(raw_capability,'UTF8')),'hex');
 IF raw_capability~'^cp-demo\.[A-Za-z0-9_-]{43}$' THEN
  PERFORM set_config('app.child_token_hash',digest,true);
  SELECT session_id INTO tenant FROM child_stewardship.session_tokens WHERE token_hash=digest;
 ELSIF raw_capability~'^cp-resume\.[A-Za-z0-9_-]{43}$' THEN
  PERFORM set_config('app.child_resume_ticket_hash',digest,true);
  SELECT session_id INTO tenant FROM child_stewardship.resume_tickets WHERE ticket_hash=digest;
 END IF;
 PERFORM set_config('app.child_token_hash',coalesce(prior_token,''),true);
 PERFORM set_config('app.child_resume_ticket_hash',coalesce(prior_ticket,''),true);
 RETURN tenant;
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.suspend_synthetic_session(raw_bearer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE digest text; token child_stewardship.session_tokens%ROWTYPE; session child_stewardship.sessions%ROWTYPE;
  current_generation bigint; current_state text; actor jsonb; bindings jsonb; raw_ticket text;
  moment timestamptz:=clock_timestamp(); ticket_expiry timestamptz;
BEGIN
  IF raw_bearer IS NULL OR raw_bearer !~ '^cp-demo\.[A-Za-z0-9_-]{43}$' THEN RETURN jsonb_build_object('denied',true); END IF;
  digest:=encode(sha256(convert_to(raw_bearer,'UTF8')),'hex');
  PERFORM set_config('app.child_token_hash',digest,true);
  SELECT * INTO token FROM child_stewardship.session_tokens WHERE token_hash=digest;
  IF NOT FOUND THEN RETURN jsonb_build_object('denied',true); END IF;
  PERFORM set_config('app.child_session_id',token.session_id::text,true);
  SELECT * INTO session FROM child_stewardship.sessions WHERE id=token.session_id FOR UPDATE;
  moment:=clock_timestamp();
  IF NOT FOUND OR session.mode<>'synthetic-demo' OR session.storage_format<>'normalized-v2'
    OR session.expires_at<=moment THEN RETURN jsonb_build_object('denied',true); END IF;
  SELECT generation,state INTO current_generation,current_state FROM child_stewardship.session_resumption WHERE session_id=session.id;
  IF token.generation<>coalesce(current_generation,0) OR coalesce(current_state,'active')<>'active' THEN RETURN jsonb_build_object('denied',true); END IF;
  SELECT payload INTO actor FROM child_stewardship.state_records WHERE session_id=session.id AND domain='learning' AND collection='actors' AND record_id=token.actor_id;
  IF actor IS NULL OR actor->>'revoked'<>'false' OR (actor->>'epoch')::integer<>token.epoch
    OR NOT((actor->'deviceIds') ? token.device_id) OR (actor->>'expiresAt')::timestamptz<=moment THEN RETURN jsonb_build_object('denied',true); END IF;
  SELECT jsonb_agg(jsonb_build_object('actorId',actor_id,'deviceId',device_id,'epoch',epoch) ORDER BY actor_id)
    INTO bindings FROM child_stewardship.session_tokens WHERE session_id=session.id AND generation=token.generation;
  IF jsonb_array_length(bindings) IS DISTINCT FROM 5 THEN RETURN jsonb_build_object('denied',true); END IF;
  current_generation:=coalesce(current_generation,0)+1;
  INSERT INTO child_stewardship.session_resumption VALUES(session.id,current_generation,'suspended')
    ON CONFLICT(session_id) DO UPDATE SET generation=EXCLUDED.generation,state='suspended';
  raw_ticket:='cp-resume.'||rtrim(translate(encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'base64'),'+/','-_'),'=');
  ticket_expiry:=least(session.expires_at,moment+interval '24 hours');
  INSERT INTO child_stewardship.resume_tickets(ticket_hash,session_id,generation,bindings,issued_at,expires_at)
    VALUES(encode(sha256(convert_to(raw_ticket,'UTF8')),'hex'),session.id,current_generation,bindings,moment,ticket_expiry);
  RETURN jsonb_build_object('resumeTicket',raw_ticket,'sessionId',session.id,'expiresAt',ticket_expiry,'syntheticOnly',true);
END $$;

CREATE OR REPLACE FUNCTION child_stewardship.resume_synthetic_session(raw_ticket text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE digest text; ticket child_stewardship.resume_tickets%ROWTYPE; session child_stewardship.sessions%ROWTYPE;
  active child_stewardship.session_resumption%ROWTYPE; binding jsonb; actor jsonb; raw_token text;
  token_hash text; tokens jsonb:='{}'; moment timestamptz:=clock_timestamp(); permitted boolean:=true;
BEGIN
  IF raw_ticket IS NULL OR raw_ticket !~ '^cp-resume\.[A-Za-z0-9_-]{43}$' THEN RETURN jsonb_build_object('denied',true); END IF;
  digest:=encode(sha256(convert_to(raw_ticket,'UTF8')),'hex');
  PERFORM set_config('app.child_resume_ticket_hash',digest,true);
  SELECT * INTO ticket FROM child_stewardship.resume_tickets WHERE ticket_hash=digest;
  IF NOT FOUND THEN RETURN jsonb_build_object('denied',true); END IF;
  PERFORM set_config('app.child_session_id',ticket.session_id::text,true);
  SELECT * INTO session FROM child_stewardship.sessions WHERE id=ticket.session_id FOR UPDATE;
  SELECT * INTO ticket FROM child_stewardship.resume_tickets WHERE ticket_hash=digest FOR UPDATE;
  moment:=clock_timestamp();
  IF ticket.consumed_at IS NOT NULL THEN RETURN jsonb_build_object('denied',true); END IF;
  SELECT * INTO active FROM child_stewardship.session_resumption WHERE session_id=ticket.session_id;
  IF session.id IS NULL OR session.mode<>'synthetic-demo' OR session.storage_format<>'normalized-v2'
    OR session.expires_at<=moment OR ticket.expires_at<=moment OR active.state IS DISTINCT FROM 'suspended'
    OR active.generation IS DISTINCT FROM ticket.generation THEN permitted:=false; END IF;
  FOR binding IN SELECT value FROM jsonb_array_elements(ticket.bindings) LOOP
    SELECT payload INTO actor FROM child_stewardship.state_records WHERE session_id=ticket.session_id
      AND domain='learning' AND collection='actors' AND record_id=binding->>'actorId';
    IF actor IS NULL OR actor->>'revoked' IS DISTINCT FROM 'false' OR actor->>'epoch' IS DISTINCT FROM binding->>'epoch'
      OR NOT((actor->'deviceIds') ? (binding->>'deviceId')) OR (actor->>'expiresAt')::timestamptz<=moment THEN permitted:=false; END IF;
  END LOOP;
  UPDATE child_stewardship.resume_tickets SET consumed_at=moment,
    outcome=CASE WHEN permitted THEN 'resumed' ELSE 'denied' END,transaction_id=pg_current_xact_id()::text WHERE ticket_hash=digest;
  IF NOT permitted THEN RETURN jsonb_build_object('denied',true); END IF;
  FOR binding IN SELECT value FROM jsonb_array_elements(ticket.bindings) LOOP
    raw_token:='cp-demo.'||rtrim(translate(encode(sha256(convert_to(gen_random_uuid()::text||gen_random_uuid()::text,'UTF8')),'base64'),'+/','-_'),'=');
    token_hash:=encode(sha256(convert_to(raw_token,'UTF8')),'hex');
    INSERT INTO child_stewardship.resume_mints VALUES(token_hash,digest,ticket.session_id,ticket.generation,
      binding->>'actorId',binding->>'deviceId',(binding->>'epoch')::integer,pg_current_xact_id()::text);
    INSERT INTO child_stewardship.session_tokens(token_hash,session_id,actor_id,device_id,epoch,generation)
      VALUES(token_hash,ticket.session_id,binding->>'actorId',binding->>'deviceId',(binding->>'epoch')::integer,ticket.generation);
    tokens:=tokens||jsonb_build_object(substring(binding->>'actorId' FROM 6),raw_token);
  END LOOP;
  UPDATE child_stewardship.session_resumption SET state='active' WHERE session_id=ticket.session_id;
  RETURN jsonb_build_object('sessionId',ticket.session_id,'expiresAt',session.expires_at,'tokens',tokens,'syntheticOnly',true,'identityVerified',false);
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.cancel_synthetic_resume(raw_ticket text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE digest text; ticket child_stewardship.resume_tickets%ROWTYPE;
BEGIN
  IF raw_ticket IS NULL OR raw_ticket !~ '^cp-resume\.[A-Za-z0-9_-]{43}$' THEN
    RETURN jsonb_build_object('cancelled',true,'syntheticOnly',true);
  END IF;
  digest:=encode(sha256(convert_to(raw_ticket,'UTF8')),'hex');
  PERFORM set_config('app.child_resume_ticket_hash',digest,true);
  SELECT * INTO ticket FROM child_stewardship.resume_tickets WHERE ticket_hash=digest;
  IF FOUND THEN
    PERFORM set_config('app.child_session_id',ticket.session_id::text,true);
    PERFORM 1 FROM child_stewardship.sessions WHERE id=ticket.session_id FOR UPDATE;
    SELECT * INTO ticket FROM child_stewardship.resume_tickets WHERE ticket_hash=digest FOR UPDATE;
    IF ticket.consumed_at IS NULL THEN
      UPDATE child_stewardship.resume_tickets SET consumed_at=clock_timestamp(),outcome='denied',
        transaction_id=pg_current_xact_id()::text WHERE ticket_hash=digest;
    END IF;
  END IF;
  -- Do not reveal whether the ticket exists, was already spent, or was cancelled.
  RETURN jsonb_build_object('cancelled',true,'syntheticOnly',true);
END $$;
REVOKE ALL ON child_stewardship.session_resumption,child_stewardship.resume_tickets,child_stewardship.resume_mints,child_stewardship.resume_token_lookup FROM PUBLIC;
REVOKE ALL ON FUNCTION child_stewardship.guard_resumption(),child_stewardship.record_resume_token_lookup(),child_stewardship.token_generation_active(uuid,bigint),child_stewardship.suspend_synthetic_session(text),child_stewardship.resume_synthetic_session(text),child_stewardship.cancel_synthetic_resume(text) FROM PUBLIC;
-- The caller proves possession of a raw capability. Security counters commit in
-- their own server transaction and do not grant mutation or signature authority.
CREATE OR REPLACE FUNCTION child_stewardship.consume_child_capability_limit(kind text,raw_capability text) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
DECLARE digest text;tenant uuid;token child_stewardship.session_tokens%ROWTYPE;actor jsonb;
 bucket text;moment timestamptz;database_actor name:=session_user;permitted boolean;conflict boolean;session_expiry timestamptz;
BEGIN
 IF kind NOT IN ('session_suspend','session_resume','agent_request') OR raw_capability IS NULL THEN RETURN 'unauthorized';END IF;
 IF kind='session_resume' AND raw_capability !~ '^cp-resume\.[A-Za-z0-9_-]{43}$'
 OR kind<>'session_resume' AND raw_capability !~ '^cp-demo\.[A-Za-z0-9_-]{43}$' THEN RETURN 'unauthorized';END IF;
 digest:=encode(sha256(convert_to(raw_capability,'UTF8')),'hex');
 tenant:=child_stewardship.resume_capability_session(raw_capability);
 IF tenant IS NULL THEN RETURN 'unauthorized';END IF;
 PERFORM set_config('app.child_session_id',tenant::text,true);
 SELECT expires_at INTO session_expiry FROM child_stewardship.sessions WHERE id=tenant AND mode='synthetic-demo' AND storage_format='normalized-v2' FOR SHARE;
 IF session_expiry IS NULL THEN RETURN 'unauthorized';END IF;
 IF kind='session_resume' THEN bucket:=tenant::text||':'||digest;
 ELSE
  PERFORM set_config('app.child_token_hash',digest,true);
  SELECT * INTO token FROM child_stewardship.session_tokens WHERE token_hash=digest;
  IF NOT FOUND OR NOT child_stewardship.token_generation_active(tenant,token.generation) THEN RETURN 'unauthorized';END IF;
  bucket:=tenant::text||':'||CASE WHEN kind='session_suspend' THEN token.actor_id ELSE encode(sha256(convert_to(token.actor_id,'UTF8')),'hex') END;
 END IF;
 moment:=child_stewardship.lock_child_scoped_limit(kind,bucket);
 IF kind<>'session_resume' THEN
  SELECT payload INTO actor FROM child_stewardship.state_records WHERE session_id=tenant AND domain='learning' AND collection='actors' AND record_id=token.actor_id;
 END IF;
 IF coalesce(current_setting('role',true),'none') NOT IN ('none','',database_actor::text)
 OR NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname=database_actor AND rolcanlogin AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreatedb AND NOT rolcreaterole AND NOT rolreplication)
 OR EXISTS(SELECT 1 FROM pg_roles WHERE rolname<>database_actor AND pg_has_role(database_actor,oid,'MEMBER'))
 OR EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(nspowner)=database_actor)
 OR EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('child_stewardship','child_stewardship_webauthn') AND pg_get_userbyid(c.relowner)=database_actor)
 THEN RETURN 'unavailable';END IF;
 IF kind='agent_request' THEN
  IF to_regclass('child_stewardship.agent_verifier_roles') IS NULL THEN RETURN 'unavailable';END IF;
  EXECUTE 'SELECT coalesce((SELECT enabled AND expires_at>$2 FROM child_stewardship.agent_verifier_roles WHERE database_role=$1 ORDER BY version DESC LIMIT 1),false)' INTO permitted USING database_actor,moment;
  IF permitted IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(actor_role) enabled,expires_at FROM child_stewardship.service_role_scopes WHERE database_role=database_actor ORDER BY actor_role,scope_version DESC) s WHERE enabled AND expires_at>moment) THEN RETURN 'unavailable';END IF;
 ELSE
  SELECT coalesce((SELECT enabled AND expires_at>moment FROM child_stewardship.service_role_scopes WHERE database_role=database_actor AND actor_role=CASE WHEN kind='session_resume' THEN 'bootstrap' ELSE actor->>'role' END ORDER BY scope_version DESC LIMIT 1),false) INTO permitted;
  IF permitted IS DISTINCT FROM true OR EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(actor_role) actor_role,enabled,expires_at FROM child_stewardship.service_role_scopes WHERE database_role=database_actor ORDER BY actor_role,scope_version DESC) s WHERE enabled AND expires_at>moment AND actor_role IN ('operation-verifier','registry-publisher')) THEN RETURN 'unavailable';END IF;
 END IF;
 IF to_regclass('child_stewardship.privacy_worker_roles') IS NOT NULL THEN EXECUTE 'SELECT coalesce((SELECT enabled AND expires_at>$2 FROM child_stewardship.privacy_worker_roles WHERE database_role=$1 ORDER BY scope_version DESC LIMIT 1),false)' INTO conflict USING database_actor,moment;IF conflict THEN RETURN 'unavailable';END IF;END IF;
 IF to_regclass('child_stewardship.media_roles') IS NOT NULL THEN EXECUTE 'SELECT EXISTS(SELECT 1 FROM (SELECT DISTINCT ON(scope) enabled,expires_at FROM child_stewardship.media_roles WHERE database_role=$1 ORDER BY scope,scope_version DESC) s WHERE enabled AND expires_at>$2)' INTO conflict USING database_actor,moment;IF conflict THEN RETURN 'unavailable';END IF;END IF;
 IF to_regclass('child_stewardship_webauthn.verifier_roles') IS NOT NULL THEN EXECUTE 'SELECT EXISTS(SELECT 1 FROM child_stewardship_webauthn.verifier_roles WHERE database_role=$1 AND enabled AND expires_at>$2)' INTO conflict USING database_actor,moment;IF conflict THEN RETURN 'unavailable';END IF;END IF;
 IF to_regclass('child_stewardship.restore_verifier_roles') IS NOT NULL THEN EXECUTE 'SELECT coalesce((SELECT enabled AND expires_at>$2 FROM child_stewardship.restore_verifier_roles WHERE database_role=$1 ORDER BY scope_version DESC LIMIT 1),false)' INTO conflict USING database_actor,moment;IF conflict THEN RETURN 'unavailable';END IF;END IF;
 IF kind<>'session_resume' AND (session_expiry<=moment OR actor IS NULL OR actor->>'revoked' IS DISTINCT FROM 'false'
 OR (actor->>'epoch')::integer IS DISTINCT FROM token.epoch OR NOT((actor->'deviceIds') ? token.device_id)
 OR coalesce((actor->>'expiresAt')::timestamptz,'-infinity'::timestamptz)<=moment) THEN RETURN 'unauthorized';END IF;
 -- Identified expired/revoked resume tickets still reach atomic redemption so
 -- the existing one-use denial is committed; this quota never renews a ticket.
 RETURN CASE WHEN child_stewardship.consume_child_scoped_limit(kind,bucket) THEN 'allowed' ELSE 'limited' END;
END $$;
REVOKE ALL ON FUNCTION child_stewardship.consume_child_capability_limit(text,text) FROM PUBLIC;

COMMIT;
