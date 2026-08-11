-- CanopyProof mobile evidence sync admission control.
-- Apply after canopyproof-os.sql. This migration is additive and route-closed.

CREATE OR REPLACE FUNCTION audit.mobile_sync_admission_limit(
  command_value text,
  scope_value text
)
RETURNS integer
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN command_value = 'binding' AND scope_value = 'actor' THEN 30
    WHEN command_value = 'binding' AND scope_value = 'organization' THEN 300
    WHEN command_value = 'batch' AND scope_value = 'actor' THEN 12
    WHEN command_value = 'batch' AND scope_value = 'organization' THEN 120
    WHEN command_value = 'recovery' AND scope_value = 'actor' THEN 30
    WHEN command_value = 'recovery' AND scope_value = 'organization' THEN 300
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION audit.mobile_sync_admission_denial_reason(
  actor_count_value bigint,
  organization_count_value bigint,
  actor_limit_value integer,
  organization_limit_value integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN actor_count_value > actor_limit_value
      AND organization_count_value > organization_limit_value
      THEN 'actor_and_organization_limits_exceeded'
    WHEN actor_count_value > actor_limit_value THEN 'actor_limit_exceeded'
    WHEN organization_count_value > organization_limit_value THEN 'organization_limit_exceeded'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION audit.mobile_sync_admission_denial_root(
  organization_id_value text,
  actor_id_value text,
  command_value text,
  policy_version_value text,
  window_started_at_value timestamptz,
  reset_at_value timestamptz,
  actor_limit_value integer,
  organization_limit_value integer,
  actor_count_value bigint,
  organization_count_value bigint,
  denial_reason_value text,
  created_at_value timestamptz
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-mobile-sync-admission-denial-v1',
    'organizationId', organization_id_value,
    'actorId', actor_id_value,
    'command', command_value,
    'policyVersion', policy_version_value,
    'windowStartedAt', audit.iso8601_millis(window_started_at_value),
    'resetAt', audit.iso8601_millis(reset_at_value),
    'actorLimit', actor_limit_value,
    'organizationLimit', organization_limit_value,
    'actorCount', actor_count_value::text,
    'organizationCount', organization_count_value::text,
    'reason', denial_reason_value,
    'createdAt', audit.iso8601_millis(created_at_value)
  ));
$$;

CREATE TABLE IF NOT EXISTS audit.mobile_sync_admission_buckets (
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  scope_type text NOT NULL CHECK (scope_type IN ('actor', 'organization')),
  scope_id text NOT NULL,
  command_type text NOT NULL CHECK (command_type IN ('binding', 'batch', 'recovery')),
  policy_version text NOT NULL CHECK (policy_version = 'canopyproof.mobile-sync-admission/v1'),
  window_started_at timestamptz NOT NULL,
  reset_at timestamptz NOT NULL,
  limit_count integer NOT NULL CHECK (limit_count > 0),
  request_count bigint NOT NULL CHECK (request_count > 0),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (organization_id, scope_type, scope_id, command_type, window_started_at),
  CHECK (reset_at = window_started_at + interval '1 minute'),
  CHECK (window_started_at = date_trunc('minute', window_started_at)),
  CHECK (updated_at >= window_started_at AND updated_at < reset_at),
  CHECK (limit_count = audit.mobile_sync_admission_limit(command_type, scope_type)),
  CHECK (
    (scope_type = 'organization' AND scope_id = organization_id) OR
    (scope_type = 'actor' AND length(btrim(scope_id)) BETWEEN 1 AND 256)
  )
);

CREATE INDEX IF NOT EXISTS mobile_sync_admission_buckets_window
  ON audit.mobile_sync_admission_buckets (organization_id, reset_at DESC, command_type, scope_type);

CREATE TABLE IF NOT EXISTS audit.mobile_sync_admission_denial_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  actor_id text NOT NULL REFERENCES identity.participants(id),
  command_type text NOT NULL CHECK (command_type IN ('binding', 'batch', 'recovery')),
  policy_version text NOT NULL CHECK (policy_version = 'canopyproof.mobile-sync-admission/v1'),
  window_started_at timestamptz NOT NULL,
  reset_at timestamptz NOT NULL,
  actor_limit integer NOT NULL CHECK (actor_limit > 0),
  organization_limit integer NOT NULL CHECK (organization_limit > 0),
  actor_count bigint NOT NULL CHECK (actor_count > 0),
  organization_count bigint NOT NULL CHECK (organization_count > 0),
  denial_reason text NOT NULL CHECK (
    denial_reason IN (
      'actor_limit_exceeded',
      'organization_limit_exceeded',
      'actor_and_organization_limits_exceeded'
    )
  ),
  created_at timestamptz NOT NULL,
  denial_root text NOT NULL UNIQUE CHECK (denial_root ~ '^[0-9a-f]{64}$'),
  CHECK (id = 'cp_mobile_sync_denial_' || left(denial_root, 24)),
  CHECK (reset_at = window_started_at + interval '1 minute'),
  CHECK (window_started_at = date_trunc('minute', window_started_at)),
  CHECK (created_at >= window_started_at AND created_at < reset_at),
  CHECK (actor_limit = audit.mobile_sync_admission_limit(command_type, 'actor')),
  CHECK (organization_limit = audit.mobile_sync_admission_limit(command_type, 'organization')),
  CHECK (
    denial_reason = audit.mobile_sync_admission_denial_reason(
      actor_count,
      organization_count,
      actor_limit,
      organization_limit
    )
  ),
  CHECK (
    denial_root = audit.mobile_sync_admission_denial_root(
      organization_id,
      actor_id,
      command_type,
      policy_version,
      window_started_at,
      reset_at,
      actor_limit,
      organization_limit,
      actor_count,
      organization_count,
      denial_reason,
      created_at
    )
  )
);

CREATE INDEX IF NOT EXISTS mobile_sync_admission_denials_org_time
  ON audit.mobile_sync_admission_denial_facts (organization_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS mobile_sync_admission_denials_actor_time
  ON audit.mobile_sync_admission_denial_facts (organization_id, actor_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION audit.reject_mobile_sync_admission_denial_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CANOPYPROOF_MOBILE_SYNC_ADMISSION_APPEND_ONLY_VIOLATION';
END;
$$;

DROP TRIGGER IF EXISTS mobile_sync_admission_denials_append_only
  ON audit.mobile_sync_admission_denial_facts;
CREATE TRIGGER mobile_sync_admission_denials_append_only
BEFORE UPDATE OR DELETE ON audit.mobile_sync_admission_denial_facts
FOR EACH ROW EXECUTE FUNCTION audit.reject_mobile_sync_admission_denial_mutation();

DROP TRIGGER IF EXISTS mobile_sync_admission_denials_database_audit
  ON audit.mobile_sync_admission_denial_facts;
CREATE TRIGGER mobile_sync_admission_denials_database_audit
AFTER INSERT OR UPDATE OR DELETE ON audit.mobile_sync_admission_denial_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE audit.mobile_sync_admission_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.mobile_sync_admission_buckets FORCE ROW LEVEL SECURITY;
ALTER TABLE audit.mobile_sync_admission_denial_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit.mobile_sync_admission_denial_facts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mobile_sync_admission_buckets_tenant
  ON audit.mobile_sync_admission_buckets;
CREATE POLICY mobile_sync_admission_buckets_tenant
  ON audit.mobile_sync_admission_buckets
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS mobile_sync_admission_denials_tenant
  ON audit.mobile_sync_admission_denial_facts;
CREATE POLICY mobile_sync_admission_denials_tenant
  ON audit.mobile_sync_admission_denial_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));
