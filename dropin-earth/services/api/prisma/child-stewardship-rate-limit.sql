-- Synthetic API capacity limits only. No IP, user name, token, or request content.
-- Apply after child-stewardship.sql and child-stewardship-authority.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS child_stewardship.api_rate_limits (
  kind text NOT NULL,
  bucket_id text NOT NULL,
  window_start timestamptz NOT NULL,
  consumed integer NOT NULL CHECK(consumed BETWEEN 1 AND 1200),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(kind,bucket_id),
  CONSTRAINT api_rate_limits_bucket_scope CHECK((kind='session_creation' AND bucket_id='global') OR
    (kind='session_request' AND bucket_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:demo-(guardian|child|reviewer|protector|operator)$')),
  CONSTRAINT api_rate_limits_actor_capacity CHECK(kind<>'session_request' OR consumed<=120),
  CONSTRAINT api_rate_limits_ttl CHECK(expires_at=window_start+interval '2 minutes')
);
-- Discard only obsolete, unreleased shared-session TTL counters; never rights/audit.
ALTER TABLE child_stewardship.api_rate_limits DROP CONSTRAINT IF EXISTS api_rate_limits_check;
ALTER TABLE child_stewardship.api_rate_limits DROP CONSTRAINT IF EXISTS api_rate_limits_bucket_scope;
DELETE FROM child_stewardship.api_rate_limits WHERE kind='session_request' AND bucket_id NOT LIKE '%:%';
ALTER TABLE child_stewardship.api_rate_limits DROP CONSTRAINT IF EXISTS api_rate_limits_kind_check;
ALTER TABLE child_stewardship.api_rate_limits ADD CONSTRAINT api_rate_limits_kind_check
 CHECK(kind IN('session_creation','session_request','session_suspend','session_resume','agent_request'));
ALTER TABLE child_stewardship.api_rate_limits ADD CONSTRAINT api_rate_limits_bucket_scope CHECK(
 (kind='session_creation' AND bucket_id='global') OR
 (kind IN('session_request','session_suspend') AND bucket_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:demo-(guardian|child|reviewer|protector|operator)$') OR
 (kind IN('session_resume','agent_request') AND bucket_id ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:[a-f0-9]{64}$'));
ALTER TABLE child_stewardship.api_rate_limits DROP CONSTRAINT IF EXISTS api_rate_limits_actor_capacity;
ALTER TABLE child_stewardship.api_rate_limits ADD CONSTRAINT api_rate_limits_actor_capacity CHECK(
 consumed <= CASE WHEN kind='session_creation' THEN 1200
   WHEN kind IN('session_request','agent_request') THEN 120 ELSE 12 END);
CREATE INDEX IF NOT EXISTS api_rate_limits_expiry ON child_stewardship.api_rate_limits(expires_at);

CREATE OR REPLACE FUNCTION child_stewardship.guard_api_rate_limits() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,child_stewardship AS $$
DECLARE owner_name name;
BEGIN
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class WHERE oid=TG_RELID;
  IF current_user<>owner_name THEN
    RAISE EXCEPTION 'CHILD_RATE_LIMIT_OWNER_ONLY' USING ERRCODE='42501';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF TG_OP='TRUNCATE' THEN RETURN NULL; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS api_rate_limit_write_guard ON child_stewardship.api_rate_limits;
CREATE TRIGGER api_rate_limit_write_guard BEFORE INSERT OR UPDATE OR DELETE
ON child_stewardship.api_rate_limits FOR EACH ROW EXECUTE FUNCTION child_stewardship.guard_api_rate_limits();
DROP TRIGGER IF EXISTS api_rate_limit_truncate_guard ON child_stewardship.api_rate_limits;
CREATE TRIGGER api_rate_limit_truncate_guard BEFORE TRUNCATE
ON child_stewardship.api_rate_limits FOR EACH STATEMENT EXECUTE FUNCTION child_stewardship.guard_api_rate_limits();
ALTER TABLE child_stewardship.api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_stewardship.api_rate_limits FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS api_rate_limit_owner ON child_stewardship.api_rate_limits;
CREATE POLICY api_rate_limit_owner ON child_stewardship.api_rate_limits
USING(current_user=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='child_stewardship.api_rate_limits'::regclass)))
WITH CHECK(current_user=pg_get_userbyid((SELECT relowner FROM pg_class WHERE oid='child_stewardship.api_rate_limits'::regclass)));

CREATE OR REPLACE FUNCTION child_stewardship.consume_child_api_limit(kind text,session_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,child_stewardship AS $$
DECLARE
  database_actor name:=session_user;
  bucket text;
  capacity integer;
  moment timestamptz;
  window_value timestamptz;
  accepted integer;
  actor_id text:=current_setting('app.child_actor_id',true);
  actor jsonb;
  session_expiry timestamptz;
BEGIN
  IF kind='session_creation' AND session_id IS NULL THEN
    bucket:='global';capacity:=1200;
  ELSIF kind='session_request' AND session_id IS NOT NULL
     AND session_id::text IS NOT DISTINCT FROM current_setting('app.child_session_id',true)
     AND actor_id IN ('demo-guardian','demo-child','demo-reviewer','demo-protector','demo-operator') THEN
    bucket:=session_id::text||':'||actor_id;capacity:=120;
  ELSE RETURN false;
  END IF;

  -- One lock per fixed bucket. Re-read time and role status after any lock wait.
  PERFORM pg_advisory_xact_lock(hashtextextended('child-api-limit:'||kind||':'||bucket,0));
  PERFORM 1 FROM child_stewardship.api_rate_limits b
    WHERE b.kind=consume_child_api_limit.kind AND b.bucket_id=bucket FOR UPDATE;
  IF kind='session_request' THEN
    SELECT s.expires_at INTO session_expiry FROM child_stewardship.sessions s
      WHERE s.id=session_id AND s.mode='synthetic-demo' AND s.storage_format='normalized-v2' FOR SHARE;
    SELECT r.payload INTO actor FROM child_stewardship.state_records r
      WHERE r.session_id=consume_child_api_limit.session_id AND r.domain='learning'
      AND r.collection='actors' AND r.record_id=actor_id FOR SHARE;
  END IF;
  moment:=clock_timestamp();
  -- SECURITY DEFINER must not mistake the owner for the original connection.
  -- Membership and SET ROLE cannot manufacture an approved API service identity.
  IF coalesce(current_setting('role',true),'none') NOT IN ('none','',database_actor::text)
     OR NOT EXISTS(SELECT 1 FROM pg_roles r WHERE r.rolname=database_actor
       AND r.rolcanlogin AND NOT r.rolsuper AND NOT r.rolbypassrls
       AND NOT r.rolcreatedb AND NOT r.rolcreaterole AND NOT r.rolreplication
       AND NOT EXISTS(SELECT 1 FROM pg_auth_members m WHERE m.member=r.oid)
       AND r.oid<>(SELECT relowner FROM pg_class WHERE oid='child_stewardship.api_rate_limits'::regclass)) THEN
    RETURN false;
  END IF;

  IF NOT EXISTS(
    SELECT 1 FROM (
      SELECT DISTINCT ON(actor_role) actor_role,enabled,expires_at
      FROM child_stewardship.service_role_scopes
      WHERE database_role=database_actor ORDER BY actor_role,scope_version DESC
    ) latest WHERE enabled AND expires_at>moment AND
      ((kind='session_creation' AND actor_role='bootstrap') OR
       (kind='session_request' AND actor_role=actor->>'role'))
  ) OR EXISTS(
    SELECT 1 FROM (
      SELECT DISTINCT ON(actor_role) actor_role,enabled,expires_at
      FROM child_stewardship.service_role_scopes
      WHERE database_role=database_actor ORDER BY actor_role,scope_version DESC
    ) latest WHERE enabled AND expires_at>moment AND actor_role IN('operation-verifier','registry-publisher')
  ) THEN RETURN false; END IF;
  IF kind='session_request' AND (session_expiry IS NULL OR session_expiry<=moment OR actor IS NULL
    OR actor->>'id' IS DISTINCT FROM actor_id OR actor->>'revoked' IS DISTINCT FROM 'false'
    OR actor->>'role' IS DISTINCT FROM substring(actor_id FROM 6)
    OR coalesce((actor->>'expiresAt')::timestamptz,'-infinity'::timestamptz)<=moment)
    THEN RETURN false; END IF;

  -- Epoch arithmetic is unaffected by caller SET TIME ZONE settings.
  window_value:=to_timestamp(floor(extract(epoch FROM moment)/60)*60);
  -- Expired counters contain no audit/rights evidence; reclaim them on admission.
  DELETE FROM child_stewardship.api_rate_limits WHERE ctid IN (
    SELECT b.ctid FROM child_stewardship.api_rate_limits b
    WHERE b.expires_at<=moment AND NOT(b.kind=consume_child_api_limit.kind AND b.bucket_id=bucket)
    ORDER BY b.expires_at LIMIT 256 FOR UPDATE SKIP LOCKED
  );
  INSERT INTO child_stewardship.api_rate_limits AS b(kind,bucket_id,window_start,consumed,expires_at)
    VALUES(kind,bucket,window_value,1,window_value+interval '2 minutes')
  ON CONFLICT ON CONSTRAINT api_rate_limits_pkey DO UPDATE SET
    window_start=excluded.window_start,
    consumed=CASE WHEN b.window_start=excluded.window_start THEN b.consumed+1 ELSE 1 END,
    expires_at=excluded.expires_at
  WHERE b.window_start<excluded.window_start OR
    (b.window_start=excluded.window_start AND b.consumed<capacity)
  RETURNING consumed INTO accepted;
  RETURN accepted IS NOT NULL;
END $$;
-- Internal primitives are INVOKER, never callable as authority by a runtime.
-- A domain SECURITY DEFINER wrapper must derive the bucket from a verified
-- capability, acquire this lock, and revalidate current authority at the returned
-- DB time before consuming. Its security transaction commits independently of
-- business execution. No caller-selected quota or clock is accepted.
CREATE OR REPLACE FUNCTION child_stewardship.lock_child_scoped_limit(kind text,bucket text)
RETURNS timestamptz LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,child_stewardship AS $$
DECLARE owner_name name;
BEGIN
  SELECT pg_get_userbyid(relowner) INTO owner_name FROM pg_class
    WHERE oid='child_stewardship.api_rate_limits'::regclass;
  IF current_user IS DISTINCT FROM owner_name THEN
    RAISE EXCEPTION 'CHILD_RATE_LIMIT_OWNER_ONLY' USING ERRCODE='42501';
  END IF;
  IF kind IS NULL OR bucket IS NULL OR NOT (
    (kind='session_suspend' AND bucket ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:demo-(guardian|child|reviewer|protector|operator)$') OR
    (kind IN('session_resume','agent_request') AND bucket ~ '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}:[a-f0-9]{64}$')) THEN
    RAISE EXCEPTION 'CHILD_RATE_LIMIT_INVALID_SCOPE' USING ERRCODE='22023';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('child-api-limit:'||kind||':'||bucket,0));
  PERFORM 1 FROM child_stewardship.api_rate_limits b
    WHERE b.kind=lock_child_scoped_limit.kind AND b.bucket_id=bucket FOR UPDATE;
  RETURN clock_timestamp();
END $$;
CREATE OR REPLACE FUNCTION child_stewardship.consume_child_scoped_limit(kind text,bucket text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY INVOKER
SET search_path=pg_catalog,child_stewardship AS $$
DECLARE moment timestamptz; window_value timestamptz; capacity integer; accepted integer;
BEGIN
  moment:=child_stewardship.lock_child_scoped_limit(kind,bucket);
  capacity:=CASE WHEN kind='agent_request' THEN 120 ELSE 12 END;
  window_value:=to_timestamp(floor(extract(epoch FROM moment)/60)*60);
  DELETE FROM child_stewardship.api_rate_limits WHERE ctid IN (
    SELECT b.ctid FROM child_stewardship.api_rate_limits b
    WHERE b.expires_at<=moment AND NOT(b.kind=consume_child_scoped_limit.kind AND b.bucket_id=bucket)
    ORDER BY b.expires_at LIMIT 256 FOR UPDATE SKIP LOCKED
  );
  INSERT INTO child_stewardship.api_rate_limits AS b(kind,bucket_id,window_start,consumed,expires_at)
    VALUES(kind,bucket,window_value,1,window_value+interval '2 minutes')
  ON CONFLICT ON CONSTRAINT api_rate_limits_pkey DO UPDATE SET
    window_start=excluded.window_start,
    consumed=CASE WHEN b.window_start=excluded.window_start THEN b.consumed+1 ELSE 1 END,
    expires_at=excluded.expires_at
  WHERE b.window_start<excluded.window_start OR
    (b.window_start=excluded.window_start AND b.consumed<capacity)
  RETURNING consumed INTO accepted;
  RETURN accepted IS NOT NULL;
END $$;
REVOKE ALL ON FUNCTION child_stewardship.lock_child_scoped_limit(text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION child_stewardship.consume_child_scoped_limit(text,text) FROM PUBLIC;
REVOKE ALL ON child_stewardship.api_rate_limits FROM PUBLIC;
REVOKE ALL ON FUNCTION child_stewardship.guard_api_rate_limits() FROM PUBLIC;
REVOKE ALL ON FUNCTION child_stewardship.consume_child_api_limit(text,uuid) FROM PUBLIC;
COMMIT;
