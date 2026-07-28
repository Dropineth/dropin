-- TerraProof NASA GIBS read-only connector authority schema.
-- Requires the CanopyProof OS identity and audit schemas to be installed first.

CREATE SCHEMA IF NOT EXISTS satellite;

CREATE OR REPLACE FUNCTION satellite.nasa_gibs_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'NASA_GIBS_APPEND_ONLY_VIOLATION: %.% cannot be updated or deleted', TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION satellite.nasa_gibs_validate_project_binding()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM projects.projects project
    WHERE project.id = NEW.project_id
      AND project.organization_id = NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'NASA_GIBS_PROJECT_AUTHORITY_MISMATCH: project % is not bound to organization %',
      NEW.project_id, NEW.organization_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS satellite.nasa_gibs_catalog_snapshots (
  id text PRIMARY KEY,
  endpoint_id text NOT NULL CHECK (endpoint_id ~ '^nasa-gibs-(wmts|wms)-epsg(4326|3857|3413|3031)-best$'),
  service_type text NOT NULL CHECK (service_type IN ('WMTS', 'WMS')),
  projection text NOT NULL CHECK (projection IN ('EPSG:4326', 'EPSG:3857', 'EPSG:3413', 'EPSG:3031')),
  source_capabilities_hash text NOT NULL CHECK (source_capabilities_hash ~ '^[0-9a-f]{64}$'),
  product_count integer NOT NULL CHECK (product_count > 0 AND product_count <= 12000),
  product_ids text[] NOT NULL CHECK (cardinality(product_ids) > 0 AND cardinality(product_ids) <= 12000),
  synchronized_at timestamptz NOT NULL,
  snapshot_root text NOT NULL UNIQUE CHECK (snapshot_root ~ '^[0-9a-f]{64}$'),
  snapshot_record jsonb NOT NULL CHECK (jsonb_typeof(snapshot_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  created_by text NOT NULL REFERENCES identity.participants(id),
  UNIQUE (endpoint_id, source_capabilities_hash, synchronized_at),
  CHECK (product_count = cardinality(product_ids)),
  CHECK (snapshot_record->>'id' = id),
  CHECK (snapshot_record->>'snapshotRoot' = snapshot_root),
  CHECK (snapshot_record->>'sourceCapabilitiesHash' = source_capabilities_hash)
);

CREATE INDEX IF NOT EXISTS nasa_gibs_catalog_snapshots_current
  ON satellite.nasa_gibs_catalog_snapshots (endpoint_id, synchronized_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS satellite.nasa_gibs_products (
  snapshot_id text NOT NULL REFERENCES satellite.nasa_gibs_catalog_snapshots(id),
  product_id text NOT NULL,
  endpoint_id text NOT NULL,
  service_type text NOT NULL CHECK (service_type IN ('WMTS', 'WMS')),
  projection text NOT NULL CHECK (projection IN ('EPSG:4326', 'EPSG:3857', 'EPSG:3413', 'EPSG:3031')),
  nasa_layer_id text NOT NULL CHECK (nasa_layer_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{0,255}$'),
  source_capabilities_hash text NOT NULL CHECK (source_capabilities_hash ~ '^[0-9a-f]{64}$'),
  product_record jsonb NOT NULL CHECK (jsonb_typeof(product_record) = 'object'),
  PRIMARY KEY (snapshot_id, product_id),
  CHECK (product_record->>'id' = product_id),
  CHECK (product_record->>'sourceEndpointId' = endpoint_id),
  CHECK (product_record->>'nasaLayerId' = nasa_layer_id),
  CHECK (product_record->>'sourceCapabilitiesHash' = source_capabilities_hash),
  CHECK (product_record->>'attribution' = 'We acknowledge the use of imagery provided by services from NASA''s Global Imagery Browse Services (GIBS), part of NASA''s Earth Science Data and Information System (ESDIS).'),
  CHECK (product_record->>'nonEndorsement' = 'NASA does not endorse CanopyProof, TerraProof, their interpretations, reports, certificates, funding decisions, or services.')
);

CREATE INDEX IF NOT EXISTS nasa_gibs_products_layer_projection
  ON satellite.nasa_gibs_products (nasa_layer_id, projection, service_type, product_id);

CREATE TABLE IF NOT EXISTS satellite.nasa_gibs_layer_availability (
  snapshot_id text NOT NULL REFERENCES satellite.nasa_gibs_catalog_snapshots(id),
  product_id text NOT NULL,
  source_capabilities_hash text NOT NULL CHECK (source_capabilities_hash ~ '^[0-9a-f]{64}$'),
  availability_record jsonb NOT NULL CHECK (jsonb_typeof(availability_record) = 'object'),
  PRIMARY KEY (snapshot_id, product_id),
  FOREIGN KEY (snapshot_id, product_id) REFERENCES satellite.nasa_gibs_products(snapshot_id, product_id),
  CHECK (availability_record->>'productId' = product_id),
  CHECK (availability_record->>'sourceCapabilitiesHash' = source_capabilities_hash)
);

CREATE TABLE IF NOT EXISTS satellite.nasa_gibs_sync_failures (
  id text PRIMARY KEY,
  endpoint_id text NOT NULL,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  actor_id text NOT NULL REFERENCES identity.participants(id),
  error_code text NOT NULL CHECK (
    error_code IN (
      'TIMEOUT', 'UPSTREAM_STATUS', 'CONTENT_TYPE', 'OVERSIZED', 'MALFORMED_XML',
      'UNSUPPORTED_SCHEMA', 'CATALOG_INVARIANT', 'ENDPOINT_DENIED', 'AUTHORIZATION_DENIED'
    )
  ),
  failed_at timestamptz NOT NULL,
  failure_root text NOT NULL UNIQUE CHECK (failure_root ~ '^[0-9a-f]{64}$'),
  failure_record jsonb NOT NULL CHECK (jsonb_typeof(failure_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  CHECK (failure_record->>'id' = id),
  CHECK (failure_record->>'failureRoot' = failure_root)
);

CREATE INDEX IF NOT EXISTS nasa_gibs_sync_failures_endpoint_time
  ON satellite.nasa_gibs_sync_failures (endpoint_id, failed_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS satellite.nasa_gibs_manifest_issuances (
  manifest_hash text PRIMARY KEY CHECK (manifest_hash ~ '^[0-9a-f]{64}$'),
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  actor_id text NOT NULL REFERENCES identity.participants(id),
  nonce text NOT NULL CHECK (nonce ~ '^[0-9a-f]{48}$'),
  product_id text NOT NULL,
  source_capabilities_hash text NOT NULL CHECK (source_capabilities_hash ~ '^[0-9a-f]{64}$'),
  issued_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  manifest_record jsonb NOT NULL CHECK (jsonb_typeof(manifest_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (organization_id, nonce),
  CHECK (issued_at < expires_at),
  CHECK (expires_at <= issued_at + interval '15 minutes'),
  CHECK (manifest_record->>'manifestHash' = manifest_hash),
  CHECK (manifest_record->>'organizationId' = organization_id),
  CHECK (manifest_record->>'productId' = product_id),
  CHECK (manifest_record ? 'signature'),
  CHECK (NOT (manifest_record ? 'url')),
  CHECK (NOT (manifest_record ? 'credentials'))
);

CREATE TABLE IF NOT EXISTS satellite.nasa_gibs_manifest_nonce_consumptions (
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  nonce text NOT NULL CHECK (nonce ~ '^[0-9a-f]{48}$'),
  consumed_at timestamptz NOT NULL,
  consumed_by text NOT NULL REFERENCES identity.participants(id),
  PRIMARY KEY (organization_id, nonce),
  FOREIGN KEY (organization_id, nonce)
    REFERENCES satellite.nasa_gibs_manifest_issuances(organization_id, nonce)
);

CREATE TABLE IF NOT EXISTS satellite.nasa_gibs_observation_comparisons (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text,
  product_id text NOT NULL,
  source_capabilities_hash text NOT NULL CHECK (source_capabilities_hash ~ '^[0-9a-f]{64}$'),
  comparison_hash text NOT NULL UNIQUE CHECK (comparison_hash ~ '^[0-9a-f]{64}$'),
  comparison_record jsonb NOT NULL CHECK (jsonb_typeof(comparison_record) = 'object'),
  created_by text NOT NULL REFERENCES identity.participants(id),
  created_at timestamptz NOT NULL,
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  CHECK (comparison_record->>'id' = id),
  CHECK (comparison_record->>'organizationId' = organization_id),
  CHECK (comparison_record->>'comparisonHash' = comparison_hash),
  CHECK (comparison_record->>'authority' = 'terraproof_observation_context_only'),
  CHECK (comparison_record->>'disclosure' = 'visualization_not_verified_evidence_or_science_data'),
  CHECK (comparison_record->>'attribution' = 'We acknowledge the use of imagery provided by services from NASA''s Global Imagery Browse Services (GIBS), part of NASA''s Earth Science Data and Information System (ESDIS).'),
  CHECK (comparison_record->>'nonEndorsement' = 'NASA does not endorse CanopyProof, TerraProof, their interpretations, reports, certificates, funding decisions, or services.')
);

CREATE INDEX IF NOT EXISTS nasa_gibs_comparisons_org_time
  ON satellite.nasa_gibs_observation_comparisons (organization_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS satellite.nasa_gibs_source_handoffs (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text,
  product_id text NOT NULL,
  handoff_hash text NOT NULL UNIQUE CHECK (handoff_hash ~ '^[0-9a-f]{64}$'),
  handoff_record jsonb NOT NULL CHECK (jsonb_typeof(handoff_record) = 'object'),
  created_by text NOT NULL REFERENCES identity.participants(id),
  created_at timestamptz NOT NULL,
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  CHECK (handoff_record->>'id' = id),
  CHECK (handoff_record->>'organizationId' = organization_id),
  CHECK (handoff_record->>'handoffHash' = handoff_hash),
  CHECK (handoff_record->>'disclosure' = 'visualization_is_not_numerical_source_data')
);

CREATE INDEX IF NOT EXISTS nasa_gibs_source_handoffs_org_time
  ON satellite.nasa_gibs_source_handoffs (organization_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS satellite.nasa_gibs_event_watches (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text,
  product_id text NOT NULL,
  watch_type text NOT NULL CHECK (watch_type IN ('wildfire', 'flood', 'drought', 'dust', 'air_quality', 'storm', 'snow_ice', 'vegetation_change')),
  watch_hash text NOT NULL UNIQUE CHECK (watch_hash ~ '^[0-9a-f]{64}$'),
  watch_record jsonb NOT NULL CHECK (jsonb_typeof(watch_record) = 'object'),
  created_by text NOT NULL REFERENCES identity.participants(id),
  created_at timestamptz NOT NULL,
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  CHECK (watch_record->>'id' = id),
  CHECK (watch_record->>'organizationId' = organization_id),
  CHECK (watch_record->>'watchHash' = watch_hash),
  CHECK ((watch_record->>'finalAuthority')::boolean IS FALSE),
  CHECK (NOT (watch_record->'outputs' ?| ARRAY['PUBLIC_EMERGENCY', 'VERIFIED_PROOF', 'ESG_CLAIM', 'FUNDING_DECISION']))
);

CREATE INDEX IF NOT EXISTS nasa_gibs_event_watches_org_type
  ON satellite.nasa_gibs_event_watches (organization_id, watch_type, created_at DESC, id DESC);

DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'nasa_gibs_catalog_snapshots',
    'nasa_gibs_products',
    'nasa_gibs_layer_availability',
    'nasa_gibs_sync_failures',
    'nasa_gibs_manifest_issuances',
    'nasa_gibs_manifest_nonce_consumptions',
    'nasa_gibs_observation_comparisons',
    'nasa_gibs_source_handoffs',
    'nasa_gibs_event_watches'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON satellite.%I', relation_name || '_append_only', relation_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON satellite.%I FOR EACH ROW EXECUTE FUNCTION satellite.nasa_gibs_reject_mutation()',
      relation_name || '_append_only',
      relation_name
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS nasa_gibs_comparison_project_binding
  ON satellite.nasa_gibs_observation_comparisons;
CREATE TRIGGER nasa_gibs_comparison_project_binding
BEFORE INSERT ON satellite.nasa_gibs_observation_comparisons
FOR EACH ROW EXECUTE FUNCTION satellite.nasa_gibs_validate_project_binding();

DROP TRIGGER IF EXISTS nasa_gibs_handoff_project_binding
  ON satellite.nasa_gibs_source_handoffs;
CREATE TRIGGER nasa_gibs_handoff_project_binding
BEFORE INSERT ON satellite.nasa_gibs_source_handoffs
FOR EACH ROW EXECUTE FUNCTION satellite.nasa_gibs_validate_project_binding();

DROP TRIGGER IF EXISTS nasa_gibs_watch_project_binding
  ON satellite.nasa_gibs_event_watches;
CREATE TRIGGER nasa_gibs_watch_project_binding
BEFORE INSERT ON satellite.nasa_gibs_event_watches
FOR EACH ROW EXECUTE FUNCTION satellite.nasa_gibs_validate_project_binding();

ALTER TABLE satellite.nasa_gibs_sync_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_sync_failures FORCE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_manifest_issuances ENABLE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_manifest_issuances FORCE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_manifest_nonce_consumptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_manifest_nonce_consumptions FORCE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_observation_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_observation_comparisons FORCE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_source_handoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_source_handoffs FORCE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_event_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE satellite.nasa_gibs_event_watches FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nasa_gibs_sync_failures_tenant ON satellite.nasa_gibs_sync_failures;
CREATE POLICY nasa_gibs_sync_failures_tenant ON satellite.nasa_gibs_sync_failures
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS nasa_gibs_manifest_issuances_tenant ON satellite.nasa_gibs_manifest_issuances;
CREATE POLICY nasa_gibs_manifest_issuances_tenant ON satellite.nasa_gibs_manifest_issuances
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS nasa_gibs_manifest_nonce_consumptions_tenant ON satellite.nasa_gibs_manifest_nonce_consumptions;
CREATE POLICY nasa_gibs_manifest_nonce_consumptions_tenant ON satellite.nasa_gibs_manifest_nonce_consumptions
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS nasa_gibs_observation_comparisons_tenant ON satellite.nasa_gibs_observation_comparisons;
CREATE POLICY nasa_gibs_observation_comparisons_tenant ON satellite.nasa_gibs_observation_comparisons
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS nasa_gibs_source_handoffs_tenant ON satellite.nasa_gibs_source_handoffs;
CREATE POLICY nasa_gibs_source_handoffs_tenant ON satellite.nasa_gibs_source_handoffs
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS nasa_gibs_event_watches_tenant ON satellite.nasa_gibs_event_watches;
CREATE POLICY nasa_gibs_event_watches_tenant ON satellite.nasa_gibs_event_watches
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));
