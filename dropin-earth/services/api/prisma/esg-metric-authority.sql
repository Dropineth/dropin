-- Immutable, route-closed CanopyProof ESG metric definition and result authority.
-- Depends on canopyproof-os.sql, mrv-graph.sql, and environmental-proof-lifecycle.sql.
-- Metric facts prepare bounded disclosures; they are not assurance opinions, credits, offsets, or assets.

CREATE OR REPLACE FUNCTION reporting.esg_metric_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_APPEND_ONLY_VIOLATION';
END;
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'immutableAuthority', true,
    'exactDecimalRequired', true,
    'explicitMissingValueStateRequired', true,
    'currentMethodologyRequired', true,
    'currentEnvironmentalProofRequired', true,
    'activeSignedLifecycleRequired', true,
    'reviewedMrvRequired', true,
    'independentHumanReviewRequired', true,
    'appendOnly', true,
    'exactRetryRequired', true,
    'tenantBound', true,
    'routeMounted', false,
    'productionActivationEnabled', false,
    'frameworkPreparationOnly', true,
    'notAssuranceOpinion', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_text_is_safe(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT value !~* '(certified[[:space:]]+carbon[[:space:]]+credit|carbon[-[:space:]]?tax[[:space:]]+offset|guaranteed[[:space:]]+(rwa[[:space:]]+)?yield|automatic[[:space:]]+[$]?canopy[[:space:]]+distribution|regulatory[[:space:]]+approval|assurance[[:space:]]+opinion)'
    OR value ~* '\mnot\M';
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_decimal_is_canonical(value text, precision_scale integer)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  fraction text;
BEGIN
  IF precision_scale < 0 OR precision_scale > 12 OR length(value) > 128
     OR value !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?$'
     OR value ~ '^-0(\.0+)?$' THEN
    RETURN false;
  END IF;
  fraction := CASE WHEN position('.' IN value) = 0 THEN '' ELSE split_part(value, '.', 2) END;
  RETURN length(fraction) <= precision_scale AND (fraction = '' OR right(fraction, 1) <> '0');
END;
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_semver_is_greater(candidate text, predecessor text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE
    WHEN candidate !~ '^v[0-9]+\.[0-9]+\.[0-9]+$'
      OR predecessor !~ '^v[0-9]+\.[0-9]+\.[0-9]+$' THEN false
    ELSE ARRAY(
      SELECT component::numeric FROM unnest(string_to_array(substring(candidate FROM 2), '.')) component
    ) > ARRAY(
      SELECT component::numeric FROM unnest(string_to_array(substring(predecessor FROM 2), '.')) component
    )
  END;
$$;

CREATE TABLE IF NOT EXISTS reporting.esg_metric_definition_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  owner_snapshot jsonb NOT NULL CHECK (jsonb_typeof(owner_snapshot) = 'object'),
  slug text NOT NULL CHECK (slug ~ '^[a-z][a-z0-9]*(_[a-z0-9]+)*$'),
  version text NOT NULL CHECK (version ~ '^v[0-9]+\.[0-9]+\.[0-9]+$'),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 8 AND 240),
  description text NOT NULL CHECK (length(btrim(description)) BETWEEN 32 AND 4000),
  dimension text NOT NULL CHECK (dimension IN ('percentage','mass_tco2e','area_hectare','volume_m3','count','index')),
  canonical_unit text NOT NULL CHECK (canonical_unit IN ('percent','tCO2e','ha','m3','count','index')),
  allowed_units text[] NOT NULL CHECK (cardinality(allowed_units) BETWEEN 1 AND 6),
  precision_scale integer NOT NULL CHECK (precision_scale BETWEEN 0 AND 12),
  value_domain text NOT NULL CHECK (value_domain IN ('non_negative','signed')),
  rounding_mode text NOT NULL CHECK (rounding_mode IN ('half_even','half_up','floor','ceiling')),
  aggregation_method text NOT NULL CHECK (aggregation_method IN ('none','sum','minimum','maximum','mean','weighted_mean','last_observation')),
  spatial_aggregation text NOT NULL CHECK (spatial_aggregation IN ('grid','project','region')),
  temporal_aggregation text NOT NULL CHECK (temporal_aggregation IN ('instant','period_sum','period_mean','period_end')),
  source_requirements text[] NOT NULL CHECK (cardinality(source_requirements) = 3),
  uncertainty_policy jsonb NOT NULL CHECK (jsonb_typeof(uncertainty_policy) = 'object'),
  framework_mappings jsonb NOT NULL CHECK (jsonb_typeof(framework_mappings) = 'array'),
  methodology_id text NOT NULL REFERENCES governance.methodologies(id),
  methodology_hash text NOT NULL CHECK (methodology_hash ~ '^[0-9a-f]{64}$'),
  methodology_publication_id text NOT NULL REFERENCES governance.methodology_publications(id),
  methodology_publication_root text NOT NULL CHECK (methodology_publication_root ~ '^[0-9a-f]{64}$'),
  methodology_publication_bundle_root text NOT NULL CHECK (methodology_publication_bundle_root ~ '^[0-9a-f]{64}$'),
  publisher_id text NOT NULL REFERENCES identity.participants(id),
  publisher_snapshot jsonb NOT NULL CHECK (jsonb_typeof(publisher_snapshot) = 'object'),
  reviewer_ids text[] NOT NULL CHECK (cardinality(reviewer_ids) BETWEEN 2 AND 32),
  reviewer_snapshots jsonb NOT NULL CHECK (jsonb_typeof(reviewer_snapshots) = 'array'),
  reviewer_root text NOT NULL CHECK (reviewer_root ~ '^[0-9a-f]{64}$'),
  limitations text[] NOT NULL CHECK (cardinality(limitations) BETWEEN 1 AND 32),
  supersedes_definition_id text REFERENCES reporting.esg_metric_definition_facts(id),
  supersedes_definition_root text CHECK (supersedes_definition_root IS NULL OR supersedes_definition_root ~ '^[0-9a-f]{64}$'),
  effective_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  definition_sequence bigint NOT NULL CHECK (definition_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  definition_hash text NOT NULL UNIQUE CHECK (definition_hash ~ '^[0-9a-f]{64}$'),
  definition_root text NOT NULL UNIQUE CHECK (definition_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (organization_id, slug, version),
  UNIQUE (organization_id, slug, definition_sequence),
  CHECK ((supersedes_definition_id IS NULL) = (supersedes_definition_root IS NULL))
);

CREATE TABLE IF NOT EXISTS reporting.esg_metric_result_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  definition_id text NOT NULL REFERENCES reporting.esg_metric_definition_facts(id),
  definition_root text NOT NULL CHECK (definition_root ~ '^[0-9a-f]{64}$'),
  definition_version text NOT NULL CHECK (definition_version ~ '^v[0-9]+\.[0-9]+\.[0-9]+$'),
  reporting_starts_at timestamptz NOT NULL,
  reporting_ends_at timestamptz NOT NULL,
  observation_starts_at timestamptz NOT NULL,
  observation_ends_at timestamptz NOT NULL,
  value_state text NOT NULL CHECK (value_state IN ('reported','below_detection_limit','not_applicable','withheld','unavailable')),
  decimal_value text,
  unit text NOT NULL CHECK (unit IN ('percent','tCO2e','ha','m3','count','index')),
  detection_limit text,
  withheld_reason text,
  unavailable_reason text,
  uncertainty jsonb NOT NULL CHECK (jsonb_typeof(uncertainty) = 'object'),
  calculation_artifact_hash text NOT NULL CHECK (calculation_artifact_hash ~ '^[0-9a-f]{64}$'),
  calculator_id text NOT NULL REFERENCES identity.participants(id),
  calculator_snapshot jsonb NOT NULL CHECK (jsonb_typeof(calculator_snapshot) = 'object'),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  reviewer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(reviewer_snapshot) = 'object'),
  review_rationale text NOT NULL CHECK (length(btrim(review_rationale)) BETWEEN 24 AND 4000),
  limitations text[] NOT NULL CHECK (cardinality(limitations) BETWEEN 1 AND 32),
  source_record_ids text[] NOT NULL CHECK (cardinality(source_record_ids) BETWEEN 1 AND 128),
  source_member_roots text[] NOT NULL CHECK (cardinality(source_member_roots) BETWEEN 1 AND 128),
  source_count integer NOT NULL CHECK (source_count BETWEEN 1 AND 128),
  source_set_root text NOT NULL CHECK (source_set_root ~ '^[0-9a-f]{64}$'),
  evidence_root text NOT NULL CHECK (evidence_root ~ '^[0-9a-f]{64}$'),
  verification_root text NOT NULL CHECK (verification_root ~ '^[0-9a-f]{64}$'),
  monitoring_root text NOT NULL CHECK (monitoring_root ~ '^[0-9a-f]{64}$'),
  confidence_score integer NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  calculated_at timestamptz NOT NULL,
  reviewed_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  result_hash text NOT NULL UNIQUE CHECK (result_hash ~ '^[0-9a-f]{64}$'),
  result_root text NOT NULL UNIQUE CHECK (result_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (organization_id, project_id, project_sequence),
  CHECK (reporting_starts_at <= observation_starts_at),
  CHECK (observation_starts_at <= observation_ends_at),
  CHECK (observation_ends_at <= reporting_ends_at),
  CHECK (reporting_ends_at <= reviewed_at),
  CHECK (calculated_at <= reviewed_at),
  CHECK (source_count = cardinality(source_record_ids)),
  CHECK (source_count = cardinality(source_member_roots)),
  CHECK (calculator_id <> reviewer_id)
);

CREATE TABLE IF NOT EXISTS reporting.esg_metric_result_source_facts (
  id text PRIMARY KEY,
  result_id text NOT NULL REFERENCES reporting.esg_metric_result_facts(id) DEFERRABLE INITIALLY DEFERRED,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  member_index integer NOT NULL CHECK (member_index >= 0),
  record_id text NOT NULL REFERENCES certificates.environmental_proof_record_facts(id),
  record_root text NOT NULL CHECK (record_root ~ '^[0-9a-f]{64}$'),
  governed_record_projection_root text NOT NULL CHECK (governed_record_projection_root ~ '^[0-9a-f]{64}$'),
  lifecycle_binding_id text NOT NULL REFERENCES certificates.environmental_proof_lifecycle_binding_facts(id),
  lifecycle_binding_root text NOT NULL CHECK (lifecycle_binding_root ~ '^[0-9a-f]{64}$'),
  lifecycle_projection_root text NOT NULL CHECK (lifecycle_projection_root ~ '^[0-9a-f]{64}$'),
  signing_key_authority_id text NOT NULL REFERENCES governance.environmental_proof_signing_key_attestation_facts(id),
  signing_key_root text NOT NULL CHECK (signing_key_root ~ '^[0-9a-f]{64}$'),
  signature_receipt_id text NOT NULL REFERENCES certificates.environmental_proof_signature_receipt_facts(id),
  signature_receipt_root text NOT NULL CHECK (signature_receipt_root ~ '^[0-9a-f]{64}$'),
  mrv_snapshot_id text NOT NULL REFERENCES mrv.graph_snapshot_facts(id),
  mrv_snapshot_root text NOT NULL CHECK (mrv_snapshot_root ~ '^[0-9a-f]{64}$'),
  evidence_root text NOT NULL CHECK (evidence_root ~ '^[0-9a-f]{64}$'),
  verification_root text NOT NULL CHECK (verification_root ~ '^[0-9a-f]{64}$'),
  monitoring_root text NOT NULL CHECK (monitoring_root ~ '^[0-9a-f]{64}$'),
  confidence_score integer NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  member_hash text NOT NULL UNIQUE CHECK (member_hash ~ '^[0-9a-f]{64}$'),
  member_root text NOT NULL UNIQUE CHECK (member_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (result_id, member_index),
  UNIQUE (result_id, record_id)
);

CREATE INDEX IF NOT EXISTS esg_metric_definitions_slug_time
  ON reporting.esg_metric_definition_facts (organization_id, slug, effective_at DESC, id);
CREATE INDEX IF NOT EXISTS esg_metric_results_project_time
  ON reporting.esg_metric_result_facts (organization_id, project_id, reviewed_at DESC, id);
CREATE INDEX IF NOT EXISTS esg_metric_result_sources_result
  ON reporting.esg_metric_result_source_facts (result_id, member_index, id);
CREATE INDEX IF NOT EXISTS esg_metric_result_sources_record
  ON reporting.esg_metric_result_source_facts (organization_id, record_id, result_id);

CREATE OR REPLACE FUNCTION reporting.esg_metric_definition_command_hash(document jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-esg-metric-definition-command-v1') ||
    (document - ARRAY['factType','id','commandHash','definitionSequence','previousEventRoot','definitionHash','definitionRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_definition_hash(document jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-esg-metric-definition-v1') ||
    (document - ARRAY['factType','definitionHash','definitionRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_definition_root(document jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-esg-metric-definition-root-v1') ||
    (document - ARRAY['factType','definitionRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_source_member_hash(document jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-esg-metric-source-member-v1') ||
    (document - ARRAY['factType','id','memberHash','memberRoot','safety']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_source_member_root(document jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-esg-metric-source-member-root-v1') ||
    jsonb_build_object('id', document->>'id') ||
    (document - ARRAY['factType','id','memberHash','memberRoot','safety']::text[]) ||
    jsonb_build_object('memberHash', document->>'memberHash')
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_result_command_hash(document jsonb, source_seeds jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-esg-metric-result-command-v1') ||
    (document - ARRAY[
      'factType','id','sourceRecordIds','sourceMemberRoots','sourceCount','sourceSetRoot',
      'evidenceRoot','verificationRoot','monitoringRoot','confidenceScore','commandHash',
      'projectSequence','previousEventRoot','resultHash','resultRoot','safety','auditEvent'
    ]::text[]) || jsonb_build_object('sources', source_seeds)
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_result_hash(document jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-esg-metric-result-v1') ||
    (document - ARRAY['factType','resultHash','resultRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_result_root(document jsonb)
RETURNS text LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-esg-metric-result-root-v1') ||
    (document - ARRAY['factType','resultRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_methodology_is_current(target_methodology_id text)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM governance.methodology_publications publication
    WHERE publication.methodology_id = target_methodology_id
      AND NOT EXISTS (
        SELECT 1 FROM governance.proof_policy_versions successor_policy
        WHERE successor_policy.supersedes_policy_id = publication.policy_id
      )
      AND NOT EXISTS (
        SELECT 1
        FROM governance.methodologies successor_methodology
        JOIN governance.methodology_publications successor_publication
          ON successor_publication.methodology_id = successor_methodology.id
        WHERE successor_methodology.supersedes = target_methodology_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_event_is_contiguous(target_event_root text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE
  current_event audit.domain_events%ROWTYPE;
  prior_event audit.domain_events%ROWTYPE;
  genesis_root text;
BEGIN
  SELECT * INTO current_event FROM audit.domain_events WHERE event_root = target_event_root;
  IF current_event.id IS NULL THEN RETURN false; END IF;
  SELECT * INTO prior_event FROM audit.domain_events
  WHERE stream_id = current_event.stream_id AND sequence_no < current_event.sequence_no
  ORDER BY sequence_no DESC LIMIT 1;
  genesis_root := audit.sha256_stable_json(jsonb_build_object('kind', 'canopyproof-audit-genesis-v1'));
  RETURN NOT EXISTS (
      SELECT 1 FROM audit.domain_events later
      WHERE later.stream_id = current_event.stream_id AND later.sequence_no > current_event.sequence_no
    ) AND (
      (current_event.sequence_no = 1 AND prior_event.id IS NULL AND current_event.previous_root = genesis_root)
      OR (prior_event.id IS NOT NULL
        AND current_event.sequence_no = prior_event.sequence_no + 1
        AND current_event.previous_root = prior_event.event_root)
    );
END;
$$;

CREATE OR REPLACE FUNCTION reporting.validate_esg_metric_definition_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  organization_record organizations.organizations%ROWTYPE;
  methodology_record governance.methodologies%ROWTYPE;
  publication_record governance.methodology_publications%ROWTYPE;
  policy_record governance.proof_policy_versions%ROWTYPE;
  predecessor reporting.esg_metric_definition_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  reviewer jsonb;
  mapping jsonb;
  reviewer_ids_value text[];
  reviewer_roots text[];
  required_components text[];
  allowed_dimension_units text[];
  expected_owner jsonb;
  expected_bundle_root text;
  expected_document jsonb;
  expected_stream_id text;
  genesis_root text;
BEGIN
  SELECT * INTO STRICT organization_record FROM organizations.organizations WHERE id = NEW.organization_id;
  SELECT * INTO STRICT methodology_record FROM governance.methodologies WHERE id = NEW.methodology_id;
  SELECT * INTO STRICT publication_record FROM governance.methodology_publications WHERE id = NEW.methodology_publication_id;
  SELECT * INTO STRICT policy_record FROM governance.proof_policy_versions WHERE id = publication_record.policy_id;
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT * INTO predecessor FROM reporting.esg_metric_definition_facts
  WHERE organization_id = NEW.organization_id AND slug = NEW.slug
  ORDER BY definition_sequence DESC LIMIT 1;

  expected_owner := jsonb_build_object(
    'id', organization_record.id,
    'name', COALESCE(organization_record.name, organization_record.legal_name),
    'verificationStatus', 'verified',
    'organizationRoot', organization_record.profile_hash
  );
  expected_bundle_root := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-methodology-publication-bundle-v1',
    'methodologyHash', methodology_record.methodology_hash,
    'methodologyEventRoot', methodology_record.event_root,
    'policyRoot', publication_record.policy_root,
    'policyEventRoot', policy_record.audit_event_root,
    'approvalRoots', to_jsonb(ARRAY(
      SELECT value FROM unnest(publication_record.approval_roots) value ORDER BY value
    )),
    'publicationRoot', publication_record.publication_root,
    'publicationEventRoot', publication_record.audit_event_root
  ));
  reviewer_ids_value := ARRAY(
    SELECT value->>'id' FROM jsonb_array_elements(NEW.reviewer_snapshots) WITH ORDINALITY item(value, position)
    ORDER BY position
  );
  reviewer_roots := ARRAY(
    SELECT value->>'authorityRoot' FROM jsonb_array_elements(NEW.reviewer_snapshots) WITH ORDINALITY item(value, position)
    ORDER BY position
  );
  required_components := ARRAY(
    SELECT jsonb_array_elements_text(NEW.uncertainty_policy->'requiredComponents')
  );
  allowed_dimension_units := CASE NEW.dimension
    WHEN 'percentage' THEN ARRAY['percent']::text[]
    WHEN 'mass_tco2e' THEN ARRAY['tCO2e']::text[]
    WHEN 'area_hectare' THEN ARRAY['ha']::text[]
    WHEN 'volume_m3' THEN ARRAY['m3']::text[]
    WHEN 'count' THEN ARRAY['count']::text[]
    ELSE ARRAY['index']::text[]
  END;
  genesis_root := audit.sha256_stable_json(jsonb_build_object('kind', 'canopyproof-audit-genesis-v1'));

  IF organization_record.verification_status <> 'verified'
     OR organization_record.profile_hash IS NULL
     OR NEW.owner_snapshot <> expected_owner
     OR NEW.methodology_hash <> methodology_record.methodology_hash
     OR publication_record.methodology_id <> NEW.methodology_id
     OR publication_record.methodology_hash <> NEW.methodology_hash
     OR NEW.methodology_publication_root <> publication_record.publication_root
     OR NEW.methodology_publication_bundle_root <> expected_bundle_root
     OR NOT reporting.esg_metric_methodology_is_current(NEW.methodology_id)
     OR NEW.effective_at < publication_record.published_at
     OR NEW.effective_at <> date_trunc('milliseconds', NEW.effective_at)
     OR NOT verification.actor_snapshot_is_valid(
       NEW.publisher_snapshot, NEW.publisher_id, NEW.organization_id,
       'human', ARRAY['owner','admin','verifier','researcher']::text[]
     )
     OR NEW.publisher_snapshot->>'membershipStatus' <> 'active'
     OR NEW.publisher_snapshot->>'accreditationStatus' <> 'approved'
     OR NOT (NEW.publisher_snapshot->'accreditationScope' @> jsonb_build_array('esg_metric:govern'))
     OR NEW.reviewer_ids <> reviewer_ids_value
     OR NOT audit.is_sorted_unique_text_array(NEW.reviewer_ids)
     OR NEW.publisher_id = ANY(NEW.reviewer_ids)
     OR NEW.reviewer_root <> audit.merkle_root(reviewer_roots)
     OR NOT audit.is_sorted_unique_text_array(NEW.allowed_units)
     OR NOT (NEW.canonical_unit = ANY(NEW.allowed_units))
     OR NOT (NEW.allowed_units <@ allowed_dimension_units)
     OR NEW.source_requirements <> ARRAY['active_signed_lifecycle','current_environmental_proof','reviewed_mrv']::text[]
     OR NOT audit.is_sorted_unique_text_array(NEW.limitations)
     OR NOT audit.is_bounded_text_array(NEW.limitations, 1, 1000, 32)
     OR NOT reporting.esg_metric_text_is_safe(NEW.title)
     OR NOT reporting.esg_metric_text_is_safe(NEW.description)
     OR EXISTS (SELECT 1 FROM unnest(NEW.limitations) value WHERE NOT reporting.esg_metric_text_is_safe(value))
     OR NEW.uncertainty_policy->>'method' NOT IN ('confidence_interval','bounded_range','not_quantified')
     OR jsonb_typeof(NEW.uncertainty_policy->'allowNotQuantified') <> 'boolean'
     OR jsonb_typeof(NEW.uncertainty_policy->'requiredComponents') <> 'array'
     OR cardinality(required_components) NOT BETWEEN 1 AND 32
     OR NOT audit.is_sorted_unique_text_array(required_components)
     OR NEW.uncertainty_policy->>'policyRoot' <> audit.sha256_stable_json(
       jsonb_build_object('kind', 'canopyproof-esg-metric-uncertainty-policy-v1') ||
       (NEW.uncertainty_policy - 'policyRoot')
     )
     OR (NEW.uncertainty_policy->>'method' = 'not_quantified'
       AND (NEW.uncertainty_policy->>'allowNotQuantified')::boolean IS NOT TRUE)
     OR jsonb_array_length(NEW.framework_mappings) NOT BETWEEN 1 AND 32
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_DEFINITION_AUTHORITY_INVALID';
  END IF;

  FOR reviewer IN SELECT value FROM jsonb_array_elements(NEW.reviewer_snapshots) item(value) LOOP
    IF NOT verification.actor_snapshot_is_valid(
         reviewer, reviewer->>'id', reviewer->>'organizationId',
         'human', ARRAY['owner','admin','verifier','researcher']::text[]
       )
       OR reviewer->>'membershipStatus' <> 'active'
       OR reviewer->>'accreditationStatus' <> 'approved'
       OR NOT (reviewer->'accreditationScope' @> jsonb_build_array('esg_metric:govern')) THEN
      RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_DEFINITION_REVIEWER_AUTHORITY_INVALID';
    END IF;
  END LOOP;

  IF NEW.framework_mappings <> (
    SELECT jsonb_agg(value ORDER BY value->>'framework', value->>'disclosureCode')
    FROM jsonb_array_elements(NEW.framework_mappings) item(value)
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_FRAMEWORK_MAPPING_ORDER_INVALID';
  END IF;
  FOR mapping IN SELECT value FROM jsonb_array_elements(NEW.framework_mappings) item(value) LOOP
    IF mapping->>'framework' NOT IN ('GRI','SDG','TNFD','BIODIVERSITY','CLIMATE_IMPACT')
       OR mapping->>'status' <> 'preparation_only'
       OR length(btrim(mapping->>'rationale')) NOT BETWEEN 24 AND 2000
       OR jsonb_typeof(mapping->'limitations') <> 'array'
       OR NOT audit.is_sorted_unique_text_array(ARRAY(SELECT jsonb_array_elements_text(mapping->'limitations')))
       OR NOT reporting.esg_metric_text_is_safe(mapping->>'rationale')
       OR EXISTS (
         SELECT 1 FROM jsonb_array_elements_text(mapping->'limitations') value
         WHERE NOT reporting.esg_metric_text_is_safe(value)
       )
       OR mapping->>'mappingRoot' <> audit.sha256_stable_json(
         jsonb_build_object('kind', 'canopyproof-esg-metric-framework-mapping-v1') || (mapping - 'mappingRoot')
       ) THEN
      RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_FRAMEWORK_MAPPING_INVALID';
    END IF;
  END LOOP;

  IF predecessor.id IS NULL THEN
    IF NEW.supersedes_definition_id IS NOT NULL OR NEW.supersedes_definition_root IS NOT NULL
       OR NEW.definition_sequence <> 1 OR NEW.previous_event_root <> genesis_root THEN
      RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_DEFINITION_PREDECESSOR_INVALID';
    END IF;
  ELSIF NEW.supersedes_definition_id IS DISTINCT FROM predecessor.id
     OR NEW.supersedes_definition_root IS DISTINCT FROM predecessor.definition_root
     OR NEW.definition_sequence <> predecessor.definition_sequence + 1
     OR NEW.previous_event_root <> predecessor.audit_event_root
     OR NOT reporting.esg_metric_semver_is_greater(NEW.version, predecessor.version) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_DEFINITION_PREDECESSOR_INVALID';
  END IF;

  expected_document := jsonb_strip_nulls(jsonb_build_object(
    'factType', 'esg_metric_definition', 'id', NEW.id,
    'owner', NEW.owner_snapshot, 'slug', NEW.slug, 'version', NEW.version,
    'title', NEW.title, 'description', NEW.description, 'dimension', NEW.dimension,
    'canonicalUnit', NEW.canonical_unit, 'allowedUnits', to_jsonb(NEW.allowed_units),
    'precisionScale', NEW.precision_scale, 'valueDomain', NEW.value_domain,
    'roundingMode', NEW.rounding_mode, 'aggregationMethod', NEW.aggregation_method,
    'spatialAggregation', NEW.spatial_aggregation, 'temporalAggregation', NEW.temporal_aggregation,
    'sourceRequirements', to_jsonb(NEW.source_requirements),
    'uncertaintyPolicy', NEW.uncertainty_policy, 'frameworkMappings', NEW.framework_mappings,
    'methodologyId', NEW.methodology_id, 'methodologyHash', NEW.methodology_hash,
    'methodologyPublicationId', NEW.methodology_publication_id,
    'methodologyPublicationRoot', NEW.methodology_publication_root,
    'methodologyPublicationBundleRoot', NEW.methodology_publication_bundle_root,
    'publisher', NEW.publisher_snapshot, 'reviewers', NEW.reviewer_snapshots,
    'reviewerRoot', NEW.reviewer_root, 'limitations', to_jsonb(NEW.limitations),
    'supersedesDefinitionId', NEW.supersedes_definition_id,
    'supersedesDefinitionRoot', NEW.supersedes_definition_root,
    'effectiveAt', audit.iso8601_millis(NEW.effective_at),
    'commandHash', NEW.command_hash, 'definitionSequence', NEW.definition_sequence,
    'previousEventRoot', NEW.previous_event_root, 'definitionHash', NEW.definition_hash,
    'definitionRoot', NEW.definition_root, 'safety', reporting.esg_metric_safety_canonical(),
    'auditEvent', mrv.audit_event_record(semantic_event)
  ));
  expected_stream_id := 'esg-metric-definition:' || length(NEW.organization_id)::text || ':' || NEW.organization_id
    || length(NEW.slug)::text || ':' || NEW.slug;

  IF NEW.fact_record <> expected_document
     OR NEW.command_hash <> reporting.esg_metric_definition_command_hash(expected_document)
     OR NEW.id <> 'cp_esg_metric_definition_' || left(NEW.command_hash, 24)
     OR NEW.definition_hash <> reporting.esg_metric_definition_hash(expected_document)
     OR NEW.definition_root <> reporting.esg_metric_definition_root(expected_document)
     OR semantic_event.stream_id <> expected_stream_id
     OR semantic_event.sequence_no <> NEW.definition_sequence
     OR semantic_event.action <> 'ASSERT'
     OR semantic_event.actor_id <> NEW.publisher_id
     OR semantic_event.entity_type <> 'esg_metric_definition'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.payload_hash <> audit.sha256_stable_json(expected_document - 'auditEvent')
     OR semantic_event.created_at <> NEW.effective_at
     OR semantic_event.rationale <> 'Independent accredited humans published an immutable route-closed ESG metric definition.'
     OR NOT reporting.esg_metric_event_is_contiguous(NEW.audit_event_root)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_DEFINITION_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reporting.validate_esg_metric_result_source_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  result_fact reporting.esg_metric_result_facts%ROWTYPE;
  record_fact certificates.environmental_proof_record_facts%ROWTYPE;
  binding_fact certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  signature_fact certificates.environmental_proof_signature_receipt_facts%ROWTYPE;
  governed record;
  lifecycle record;
  expected_verification_root text;
  expected_document jsonb;
BEGIN
  SELECT * INTO STRICT result_fact FROM reporting.esg_metric_result_facts WHERE id = NEW.result_id;
  SELECT * INTO STRICT record_fact FROM certificates.environmental_proof_record_facts WHERE id = NEW.record_id;
  SELECT * INTO STRICT binding_fact FROM certificates.environmental_proof_lifecycle_binding_facts WHERE id = NEW.lifecycle_binding_id;
  SELECT * INTO STRICT signature_fact FROM certificates.environmental_proof_signature_receipt_facts WHERE id = NEW.signature_receipt_id;
  SELECT * INTO STRICT governed FROM certificates.environmental_proof_governed_record_projection(NEW.record_id);
  SELECT * INTO STRICT lifecycle
  FROM certificates.environmental_proof_lifecycle_projection(NEW.lifecycle_binding_id, result_fact.reviewed_at);
  expected_verification_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(record_fact.evidence_final_decision_roots) value ORDER BY value
  ));
  expected_document := jsonb_build_object(
    'factType', 'esg_metric_result_source', 'id', NEW.id,
    'resultId', NEW.result_id, 'organizationId', NEW.organization_id,
    'projectId', NEW.project_id, 'memberIndex', NEW.member_index,
    'recordId', NEW.record_id, 'recordRoot', NEW.record_root,
    'governedRecordProjectionRoot', NEW.governed_record_projection_root,
    'lifecycleBindingId', NEW.lifecycle_binding_id, 'lifecycleBindingRoot', NEW.lifecycle_binding_root,
    'lifecycleProjectionRoot', NEW.lifecycle_projection_root,
    'signingKeyAuthorityId', NEW.signing_key_authority_id, 'signingKeyRoot', NEW.signing_key_root,
    'signatureReceiptId', NEW.signature_receipt_id, 'signatureReceiptRoot', NEW.signature_receipt_root,
    'mrvSnapshotId', NEW.mrv_snapshot_id, 'mrvSnapshotRoot', NEW.mrv_snapshot_root,
    'evidenceRoot', NEW.evidence_root, 'verificationRoot', NEW.verification_root,
    'monitoringRoot', NEW.monitoring_root, 'confidenceScore', NEW.confidence_score,
    'memberHash', NEW.member_hash, 'memberRoot', NEW.member_root,
    'safety', reporting.esg_metric_safety_canonical()
  );

  IF NEW.organization_id <> result_fact.organization_id OR NEW.project_id <> result_fact.project_id
     OR record_fact.organization_id <> NEW.organization_id OR record_fact.project_id <> NEW.project_id
     OR record_fact.status <> 'issued' OR record_fact.record_root <> NEW.record_root
     OR governed.record_root <> NEW.record_root OR governed.state <> 'issued'
     OR governed.source_authority_current IS NOT TRUE
     OR governed.projection_root <> NEW.governed_record_projection_root
     OR binding_fact.organization_id <> NEW.organization_id OR binding_fact.project_id <> NEW.project_id
     OR binding_fact.record_id <> NEW.record_id OR binding_fact.record_root <> NEW.record_root
     OR binding_fact.binding_root <> NEW.lifecycle_binding_root
     OR binding_fact.signing_key_authority_id <> NEW.signing_key_authority_id
     OR binding_fact.signing_key_root <> NEW.signing_key_root
     OR binding_fact.mrv_snapshot_id <> NEW.mrv_snapshot_id OR binding_fact.mrv_snapshot_root <> NEW.mrv_snapshot_root
     OR lifecycle.projection_root <> NEW.lifecycle_projection_root OR lifecycle.state <> 'active'
     OR lifecycle.governed_record_state <> 'issued' OR lifecycle.source_authority_current IS NOT TRUE
     OR lifecycle.mrv_state <> 'reviewed_for_lineage' OR lifecycle.bound_mrv_snapshot_current IS NOT TRUE
     OR lifecycle.key_state <> 'active' OR lifecycle.signature_verified IS NOT TRUE OR lifecycle.validity_current IS NOT TRUE
     OR signature_fact.organization_id <> NEW.organization_id OR signature_fact.project_id <> NEW.project_id
     OR signature_fact.record_id <> NEW.record_id OR signature_fact.record_root <> NEW.record_root
     OR signature_fact.binding_id <> NEW.lifecycle_binding_id OR signature_fact.binding_root <> NEW.lifecycle_binding_root
     OR signature_fact.signing_key_authority_id <> NEW.signing_key_authority_id
     OR signature_fact.signing_key_root <> NEW.signing_key_root
     OR signature_fact.receipt_root <> NEW.signature_receipt_root OR signature_fact.verified_at > result_fact.reviewed_at
     OR record_fact.evidence_root <> NEW.evidence_root OR expected_verification_root <> NEW.verification_root
     OR record_fact.monitoring_root <> NEW.monitoring_root OR record_fact.confidence_score <> NEW.confidence_score
     OR NEW.fact_record <> expected_document
     OR NEW.member_hash <> reporting.esg_metric_source_member_hash(NEW.fact_record)
     OR NEW.id <> 'cp_esg_metric_source_' || left(NEW.member_hash, 24)
     OR NEW.member_root <> reporting.esg_metric_source_member_root(NEW.fact_record)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_SOURCE_AUTHORITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reporting.validate_esg_metric_result_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  definition reporting.esg_metric_definition_facts%ROWTYPE;
  latest_definition reporting.esg_metric_definition_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  member_count integer;
  distinct_index_count integer;
  minimum_index integer;
  maximum_index integer;
  member_record_ids text[];
  member_roots text[];
  member_evidence_roots text[];
  member_verification_roots text[];
  member_monitoring_roots text[];
  minimum_confidence integer;
  source_seeds jsonb;
  uncertainty_components text[];
  required_components text[];
  expected_document jsonb;
  expected_stream_id text;
BEGIN
  SELECT * INTO STRICT definition FROM reporting.esg_metric_definition_facts WHERE id = NEW.definition_id;
  SELECT * INTO STRICT latest_definition FROM reporting.esg_metric_definition_facts
  WHERE organization_id = NEW.organization_id AND slug = definition.slug
  ORDER BY definition_sequence DESC LIMIT 1;
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT count(*)::integer, count(DISTINCT member_index)::integer, min(member_index), max(member_index),
    array_agg(record_id ORDER BY member_index), array_agg(member_root ORDER BY member_index),
    array_agg(evidence_root ORDER BY member_index), array_agg(verification_root ORDER BY member_index),
    array_agg(monitoring_root ORDER BY member_index), min(confidence_score),
    jsonb_agg(
      fact_record - ARRAY['factType','id','resultId','memberIndex','memberHash','memberRoot','safety']::text[]
      ORDER BY member_index
    )
  INTO member_count, distinct_index_count, minimum_index, maximum_index,
    member_record_ids, member_roots, member_evidence_roots, member_verification_roots,
    member_monitoring_roots, minimum_confidence, source_seeds
  FROM reporting.esg_metric_result_source_facts WHERE result_id = NEW.id;
  uncertainty_components := ARRAY(SELECT jsonb_array_elements_text(NEW.uncertainty->'components'));
  required_components := ARRAY(SELECT jsonb_array_elements_text(definition.uncertainty_policy->'requiredComponents'));

  IF definition.organization_id <> NEW.organization_id OR definition.definition_root <> NEW.definition_root
     OR definition.version <> NEW.definition_version OR latest_definition.id <> NEW.definition_id
     OR NOT reporting.esg_metric_methodology_is_current(definition.methodology_id)
     OR NOT (NEW.unit = ANY(definition.allowed_units))
     OR NOT verification.actor_snapshot_is_valid(
       NEW.calculator_snapshot, NEW.calculator_id, NEW.organization_id,
       'human', ARRAY['owner','admin','verifier','researcher']::text[]
     )
     OR NEW.calculator_snapshot->>'membershipStatus' <> 'active'
     OR NEW.calculator_snapshot->>'accreditationStatus' <> 'approved'
     OR NOT (NEW.calculator_snapshot->'accreditationScope' @> jsonb_build_array('esg_metric:calculate'))
     OR NOT verification.actor_snapshot_is_valid(
       NEW.reviewer_snapshot, NEW.reviewer_id, NEW.reviewer_snapshot->>'organizationId',
       'human', ARRAY['owner','admin','verifier','researcher']::text[]
     )
     OR NEW.reviewer_snapshot->>'membershipStatus' <> 'active'
     OR NEW.reviewer_snapshot->>'accreditationStatus' <> 'approved'
     OR NOT (NEW.reviewer_snapshot->'accreditationScope' @> jsonb_build_array('esg_metric:review'))
     OR NEW.calculated_at <> date_trunc('milliseconds', NEW.calculated_at)
     OR NEW.reviewed_at <> date_trunc('milliseconds', NEW.reviewed_at)
     OR NEW.reporting_starts_at <> date_trunc('milliseconds', NEW.reporting_starts_at)
     OR NEW.reporting_ends_at <> date_trunc('milliseconds', NEW.reporting_ends_at)
     OR NEW.observation_starts_at <> date_trunc('milliseconds', NEW.observation_starts_at)
     OR NEW.observation_ends_at <> date_trunc('milliseconds', NEW.observation_ends_at)
     OR NOT audit.is_sorted_unique_text_array(NEW.limitations)
     OR NOT audit.is_bounded_text_array(NEW.limitations, 1, 1000, 32)
     OR NOT reporting.esg_metric_text_is_safe(NEW.review_rationale)
     OR EXISTS (SELECT 1 FROM unnest(NEW.limitations) value WHERE NOT reporting.esg_metric_text_is_safe(value))
     OR jsonb_typeof(NEW.uncertainty->'components') <> 'array'
     OR NOT audit.is_sorted_unique_text_array(uncertainty_components)
     OR NOT (required_components <@ uncertainty_components)
     OR NEW.uncertainty->>'uncertaintyRoot' <> audit.sha256_stable_json(
       jsonb_build_object('kind', 'canopyproof-esg-metric-uncertainty-v1',
         'uncertainty', NEW.uncertainty - 'uncertaintyRoot')
     )
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_AUTHORITY_INVALID';
  END IF;

  IF NEW.value_state = 'reported' THEN
    IF NEW.decimal_value IS NULL OR NEW.detection_limit IS NOT NULL OR NEW.withheld_reason IS NOT NULL OR NEW.unavailable_reason IS NOT NULL
       OR NOT reporting.esg_metric_decimal_is_canonical(NEW.decimal_value, definition.precision_scale)
       OR (definition.value_domain = 'non_negative' AND NEW.decimal_value::numeric < 0) THEN
      RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_VALUE_INVALID';
    END IF;
  ELSIF NEW.value_state = 'below_detection_limit' THEN
    IF NEW.decimal_value IS NOT NULL OR NEW.detection_limit IS NULL OR NEW.withheld_reason IS NOT NULL OR NEW.unavailable_reason IS NOT NULL
       OR NOT reporting.esg_metric_decimal_is_canonical(NEW.detection_limit, definition.precision_scale)
       OR NEW.detection_limit::numeric <= 0 THEN
      RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_VALUE_INVALID';
    END IF;
  ELSIF NEW.value_state = 'withheld' THEN
    IF NEW.decimal_value IS NOT NULL OR NEW.detection_limit IS NOT NULL OR NEW.withheld_reason IS NULL OR NEW.unavailable_reason IS NOT NULL
       OR NOT reporting.esg_metric_text_is_safe(NEW.withheld_reason) THEN
      RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_VALUE_INVALID';
    END IF;
  ELSIF NEW.value_state = 'unavailable' THEN
    IF NEW.decimal_value IS NOT NULL OR NEW.detection_limit IS NOT NULL OR NEW.withheld_reason IS NOT NULL OR NEW.unavailable_reason IS NULL
       OR NOT reporting.esg_metric_text_is_safe(NEW.unavailable_reason) THEN
      RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_VALUE_INVALID';
    END IF;
  ELSIF NEW.decimal_value IS NOT NULL OR NEW.detection_limit IS NOT NULL OR NEW.withheld_reason IS NOT NULL OR NEW.unavailable_reason IS NOT NULL THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_VALUE_INVALID';
  END IF;

  IF NEW.uncertainty->>'kind' = 'interval' THEN
    IF NOT reporting.esg_metric_decimal_is_canonical(NEW.uncertainty->>'lower', definition.precision_scale)
       OR NOT reporting.esg_metric_decimal_is_canonical(NEW.uncertainty->>'upper', definition.precision_scale)
       OR (NEW.uncertainty->>'lower')::numeric > (NEW.uncertainty->>'upper')::numeric
       OR (NEW.uncertainty->>'confidenceLevelPct')::integer NOT BETWEEN 1 AND 100
       OR (NEW.decimal_value IS NOT NULL AND (
         NEW.decimal_value::numeric < (NEW.uncertainty->>'lower')::numeric
         OR NEW.decimal_value::numeric > (NEW.uncertainty->>'upper')::numeric
       )) THEN
      RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_UNCERTAINTY_INVALID';
    END IF;
  ELSIF NEW.uncertainty->>'kind' = 'not_quantified' THEN
    IF (definition.uncertainty_policy->>'allowNotQuantified')::boolean IS NOT TRUE
       OR length(btrim(NEW.uncertainty->>'reason')) NOT BETWEEN 24 AND 2000
       OR NOT reporting.esg_metric_text_is_safe(NEW.uncertainty->>'reason') THEN
      RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_UNCERTAINTY_INVALID';
    END IF;
  ELSE
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_UNCERTAINTY_INVALID';
  END IF;

  expected_document := jsonb_strip_nulls(jsonb_build_object(
    'factType', 'esg_metric_result', 'id', NEW.id,
    'organizationId', NEW.organization_id, 'projectId', NEW.project_id,
    'definitionId', NEW.definition_id, 'definitionRoot', NEW.definition_root,
    'definitionVersion', NEW.definition_version,
    'reportingPeriod', jsonb_build_object('startsAt', audit.iso8601_millis(NEW.reporting_starts_at), 'endsAt', audit.iso8601_millis(NEW.reporting_ends_at)),
    'observationPeriod', jsonb_build_object('startsAt', audit.iso8601_millis(NEW.observation_starts_at), 'endsAt', audit.iso8601_millis(NEW.observation_ends_at)),
    'valueState', NEW.value_state, 'decimalValue', NEW.decimal_value, 'unit', NEW.unit,
    'detectionLimit', NEW.detection_limit, 'withheldReason', NEW.withheld_reason,
    'unavailableReason', NEW.unavailable_reason, 'uncertainty', NEW.uncertainty,
    'calculationArtifactHash', NEW.calculation_artifact_hash,
    'calculator', NEW.calculator_snapshot, 'reviewer', NEW.reviewer_snapshot,
    'reviewRationale', NEW.review_rationale, 'limitations', to_jsonb(NEW.limitations),
    'sourceRecordIds', to_jsonb(NEW.source_record_ids), 'sourceMemberRoots', to_jsonb(NEW.source_member_roots),
    'sourceCount', NEW.source_count, 'sourceSetRoot', NEW.source_set_root,
    'evidenceRoot', NEW.evidence_root, 'verificationRoot', NEW.verification_root,
    'monitoringRoot', NEW.monitoring_root, 'confidenceScore', NEW.confidence_score,
    'calculatedAt', audit.iso8601_millis(NEW.calculated_at), 'reviewedAt', audit.iso8601_millis(NEW.reviewed_at),
    'commandHash', NEW.command_hash, 'projectSequence', NEW.project_sequence,
    'previousEventRoot', NEW.previous_event_root, 'resultHash', NEW.result_hash,
    'resultRoot', NEW.result_root, 'safety', reporting.esg_metric_safety_canonical(),
    'auditEvent', mrv.audit_event_record(semantic_event)
  ));
  expected_stream_id := 'esg-metric-result:' || length(NEW.organization_id)::text || ':' || NEW.organization_id
    || length(NEW.project_id)::text || ':' || NEW.project_id;

  IF member_count <> NEW.source_count OR distinct_index_count <> NEW.source_count
     OR minimum_index <> 0 OR maximum_index <> NEW.source_count - 1
     OR member_record_ids <> NEW.source_record_ids OR member_roots <> NEW.source_member_roots
     OR NEW.source_set_root <> audit.merkle_root(member_roots)
     OR NEW.evidence_root <> audit.merkle_root(member_evidence_roots)
     OR NEW.verification_root <> audit.merkle_root(member_verification_roots)
     OR NEW.monitoring_root <> audit.merkle_root(member_monitoring_roots)
     OR NEW.confidence_score <> minimum_confidence
     OR NEW.fact_record <> expected_document
     OR NEW.command_hash <> reporting.esg_metric_result_command_hash(expected_document, source_seeds)
     OR NEW.id <> 'cp_esg_metric_result_' || left(NEW.command_hash, 24)
     OR NEW.result_hash <> reporting.esg_metric_result_hash(expected_document)
     OR NEW.result_root <> reporting.esg_metric_result_root(expected_document)
     OR semantic_event.stream_id <> expected_stream_id OR semantic_event.sequence_no <> NEW.project_sequence
     OR semantic_event.action <> 'ASSERT' OR semantic_event.actor_id <> NEW.reviewer_id
     OR semantic_event.entity_type <> 'esg_metric_result' OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.payload_hash <> audit.sha256_stable_json(expected_document - 'auditEvent')
     OR semantic_event.created_at <> NEW.reviewed_at
     OR semantic_event.rationale <> 'An independent accredited human accepted an immutable route-closed ESG metric result.'
     OR NOT reporting.esg_metric_event_is_contiguous(NEW.audit_event_root)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_RESULT_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_definition_projection(target_definition_id text, evaluated_at timestamptz)
RETURNS TABLE (
  owner_organization_id text, slug_value text, definition_id text, definition_root text,
  state text, methodology_publication_id text, methodology_publication_root text,
  evaluated_at_value timestamptz, latest_definition_id text, latest_definition_root text,
  issue_codes text[], projection_root text, safety jsonb
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  definition reporting.esg_metric_definition_facts%ROWTYPE;
  latest reporting.esg_metric_definition_facts%ROWTYPE;
  issues text[] := ARRAY[]::text[];
  projected_state text;
  projected_root text;
BEGIN
  IF evaluated_at IS NULL OR evaluated_at <> date_trunc('milliseconds', evaluated_at) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_EVALUATION_TIME_INVALID';
  END IF;
  SELECT * INTO STRICT definition FROM reporting.esg_metric_definition_facts WHERE id = target_definition_id;
  SELECT * INTO STRICT latest FROM reporting.esg_metric_definition_facts
  WHERE organization_id = definition.organization_id AND slug = definition.slug
  ORDER BY definition_sequence DESC LIMIT 1;
  IF NOT reporting.esg_metric_methodology_is_current(definition.methodology_id) THEN
    issues := array_append(issues, 'methodology_not_current');
  END IF;
  IF latest.id <> definition.id THEN issues := array_append(issues, 'definition_superseded'); END IF;
  SELECT COALESCE(array_agg(issue ORDER BY issue), ARRAY[]::text[]) INTO issues FROM unnest(issues) issue;
  projected_state := CASE WHEN 'methodology_not_current' = ANY(issues) THEN 'methodology_superseded'
    WHEN 'definition_superseded' = ANY(issues) THEN 'superseded' ELSE 'current' END;
  projected_root := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-esg-metric-definition-projection-v1',
    'ownerOrganizationId', definition.organization_id, 'slug', definition.slug,
    'definitionId', definition.id, 'definitionRoot', definition.definition_root,
    'state', projected_state, 'methodologyPublicationId', definition.methodology_publication_id,
    'methodologyPublicationRoot', definition.methodology_publication_root,
    'evaluatedAt', audit.iso8601_millis(evaluated_at), 'latestDefinitionId', latest.id,
    'latestDefinitionRoot', latest.definition_root, 'issueCodes', to_jsonb(issues)
  ));
  RETURN QUERY SELECT definition.organization_id, definition.slug, definition.id, definition.definition_root,
    projected_state, definition.methodology_publication_id, definition.methodology_publication_root,
    evaluated_at, latest.id, latest.definition_root, issues, projected_root, reporting.esg_metric_safety_canonical();
END;
$$;

CREATE OR REPLACE FUNCTION reporting.esg_metric_result_projection(target_result_id text, evaluated_at timestamptz)
RETURNS TABLE (
  organization_id text, project_id text, result_id text, result_root text,
  definition_id text, definition_root text, state text, evaluated_at_value timestamptz,
  source_count integer, current_source_count integer, issue_codes text[],
  current_source_root text, projection_root text, safety jsonb
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  result_fact reporting.esg_metric_result_facts%ROWTYPE;
  source_fact reporting.esg_metric_result_source_facts%ROWTYPE;
  definition_projection record;
  record_fact certificates.environmental_proof_record_facts%ROWTYPE;
  binding_fact certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  signature_fact certificates.environmental_proof_signature_receipt_facts%ROWTYPE;
  governed record;
  lifecycle record;
  issues text[] := ARRAY[]::text[];
  current_roots text[] := ARRAY[]::text[];
  projected_state text;
  projected_current_count integer := 0;
  challenged boolean := false;
  revoked boolean := false;
  expired boolean := false;
  exact_binding boolean;
  eligible boolean;
  projected_current_root text;
  projected_root text;
BEGIN
  IF evaluated_at IS NULL OR evaluated_at <> date_trunc('milliseconds', evaluated_at) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_EVALUATION_TIME_INVALID';
  END IF;
  SELECT * INTO STRICT result_fact FROM reporting.esg_metric_result_facts WHERE id = target_result_id;
  SELECT * INTO STRICT definition_projection
  FROM reporting.esg_metric_definition_projection(result_fact.definition_id, evaluated_at);
  IF definition_projection.definition_root <> result_fact.definition_root THEN
    issues := array_append(issues, 'definition_projection_mismatch');
  END IF;
  IF definition_projection.state = 'superseded' THEN issues := array_append(issues, 'definition_superseded'); END IF;
  IF definition_projection.state = 'methodology_superseded' THEN issues := array_append(issues, 'methodology_superseded'); END IF;

  FOR source_fact IN SELECT source.* FROM reporting.esg_metric_result_source_facts source
    WHERE source.result_id = target_result_id ORDER BY source.member_index LOOP
    SELECT * INTO STRICT record_fact FROM certificates.environmental_proof_record_facts WHERE id = source_fact.record_id;
    SELECT * INTO STRICT binding_fact FROM certificates.environmental_proof_lifecycle_binding_facts WHERE id = source_fact.lifecycle_binding_id;
    SELECT * INTO STRICT signature_fact FROM certificates.environmental_proof_signature_receipt_facts WHERE binding_id = binding_fact.id;
    SELECT * INTO STRICT governed FROM certificates.environmental_proof_governed_record_projection(source_fact.record_id);
    SELECT * INTO STRICT lifecycle FROM certificates.environmental_proof_lifecycle_projection(binding_fact.id, evaluated_at);
    IF governed.state = 'revoked' THEN revoked := true; ELSIF governed.state = 'challenged' THEN challenged := true; END IF;
    IF lifecycle.state = 'expired' THEN expired := true; END IF;
    current_roots := array_append(current_roots, audit.sha256_stable_json(jsonb_build_object(
      'kind', 'canopyproof-esg-metric-current-source-v1',
      'recordId', record_fact.id, 'recordRoot', record_fact.record_root,
      'governedRecordProjectionRoot', governed.projection_root,
      'lifecycleBindingId', binding_fact.id, 'lifecycleBindingRoot', binding_fact.binding_root,
      'lifecycleProjectionRoot', lifecycle.projection_root,
      'signatureReceiptId', signature_fact.id, 'signatureReceiptRoot', signature_fact.receipt_root
    )));
    exact_binding := source_fact.record_root = record_fact.record_root
      AND source_fact.governed_record_projection_root = governed.projection_root
      AND source_fact.lifecycle_binding_id = binding_fact.id
      AND source_fact.lifecycle_binding_root = binding_fact.binding_root
      AND source_fact.lifecycle_projection_root = lifecycle.projection_root
      AND source_fact.signature_receipt_id = signature_fact.id
      AND source_fact.signature_receipt_root = signature_fact.receipt_root
      AND source_fact.mrv_snapshot_id = binding_fact.mrv_snapshot_id
      AND source_fact.mrv_snapshot_root = binding_fact.mrv_snapshot_root;
    eligible := governed.state = 'issued' AND governed.source_authority_current IS TRUE
      AND lifecycle.state = 'active' AND lifecycle.source_authority_current IS TRUE
      AND lifecycle.bound_mrv_snapshot_current IS TRUE AND lifecycle.signature_verified IS TRUE
      AND lifecycle.validity_current IS TRUE;
    IF NOT exact_binding THEN issues := array_append(issues, 'source_binding_changed:' || source_fact.record_id); END IF;
    IF NOT eligible THEN issues := array_append(issues, 'source_not_current:' || source_fact.record_id); END IF;
    IF exact_binding AND eligible THEN projected_current_count := projected_current_count + 1; END IF;
  END LOOP;

  SELECT COALESCE(array_agg(DISTINCT issue ORDER BY issue), ARRAY[]::text[]) INTO issues FROM unnest(issues) issue;
  projected_state := CASE WHEN revoked THEN 'revoked' WHEN challenged THEN 'challenged' WHEN expired THEN 'expired'
    WHEN 'methodology_superseded' = ANY(issues) THEN 'methodology_superseded'
    WHEN 'definition_superseded' = ANY(issues) THEN 'definition_superseded'
    WHEN cardinality(issues) > 0 THEN 'source_stale' ELSE 'current' END;
  projected_current_root := audit.merkle_root(ARRAY(SELECT value FROM unnest(current_roots) value ORDER BY value));
  projected_root := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-esg-metric-result-projection-v1',
    'organizationId', result_fact.organization_id, 'projectId', result_fact.project_id,
    'resultId', result_fact.id, 'resultRoot', result_fact.result_root,
    'definitionId', result_fact.definition_id, 'definitionRoot', result_fact.definition_root,
    'state', projected_state, 'evaluatedAt', audit.iso8601_millis(evaluated_at),
    'sourceCount', result_fact.source_count, 'currentSourceCount', projected_current_count,
    'issueCodes', to_jsonb(issues), 'currentSourceRoot', projected_current_root
  ));
  RETURN QUERY SELECT result_fact.organization_id, result_fact.project_id, result_fact.id, result_fact.result_root,
    result_fact.definition_id, result_fact.definition_root, projected_state, evaluated_at,
    result_fact.source_count, projected_current_count, issues, projected_current_root,
    projected_root, reporting.esg_metric_safety_canonical();
END;
$$;

DROP TRIGGER IF EXISTS esg_metric_definitions_validate ON reporting.esg_metric_definition_facts;
CREATE TRIGGER esg_metric_definitions_validate BEFORE INSERT ON reporting.esg_metric_definition_facts
FOR EACH ROW EXECUTE FUNCTION reporting.validate_esg_metric_definition_insert();
DROP TRIGGER IF EXISTS esg_metric_results_validate ON reporting.esg_metric_result_facts;
CREATE CONSTRAINT TRIGGER esg_metric_results_validate AFTER INSERT ON reporting.esg_metric_result_facts
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reporting.validate_esg_metric_result_insert();
DROP TRIGGER IF EXISTS esg_metric_result_sources_validate ON reporting.esg_metric_result_source_facts;
CREATE TRIGGER esg_metric_result_sources_validate BEFORE INSERT ON reporting.esg_metric_result_source_facts
FOR EACH ROW EXECUTE FUNCTION reporting.validate_esg_metric_result_source_insert();

DROP TRIGGER IF EXISTS esg_metric_definitions_no_update ON reporting.esg_metric_definition_facts;
CREATE TRIGGER esg_metric_definitions_no_update BEFORE UPDATE ON reporting.esg_metric_definition_facts
FOR EACH ROW EXECUTE FUNCTION reporting.esg_metric_reject_mutation();
DROP TRIGGER IF EXISTS esg_metric_definitions_no_delete ON reporting.esg_metric_definition_facts;
CREATE TRIGGER esg_metric_definitions_no_delete BEFORE DELETE ON reporting.esg_metric_definition_facts
FOR EACH ROW EXECUTE FUNCTION reporting.esg_metric_reject_mutation();
DROP TRIGGER IF EXISTS esg_metric_definitions_audit ON reporting.esg_metric_definition_facts;
CREATE TRIGGER esg_metric_definitions_audit AFTER INSERT OR UPDATE OR DELETE ON reporting.esg_metric_definition_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS esg_metric_results_no_update ON reporting.esg_metric_result_facts;
CREATE TRIGGER esg_metric_results_no_update BEFORE UPDATE ON reporting.esg_metric_result_facts
FOR EACH ROW EXECUTE FUNCTION reporting.esg_metric_reject_mutation();
DROP TRIGGER IF EXISTS esg_metric_results_no_delete ON reporting.esg_metric_result_facts;
CREATE TRIGGER esg_metric_results_no_delete BEFORE DELETE ON reporting.esg_metric_result_facts
FOR EACH ROW EXECUTE FUNCTION reporting.esg_metric_reject_mutation();
DROP TRIGGER IF EXISTS esg_metric_results_audit ON reporting.esg_metric_result_facts;
CREATE TRIGGER esg_metric_results_audit AFTER INSERT OR UPDATE OR DELETE ON reporting.esg_metric_result_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS esg_metric_result_sources_no_update ON reporting.esg_metric_result_source_facts;
CREATE TRIGGER esg_metric_result_sources_no_update BEFORE UPDATE ON reporting.esg_metric_result_source_facts
FOR EACH ROW EXECUTE FUNCTION reporting.esg_metric_reject_mutation();
DROP TRIGGER IF EXISTS esg_metric_result_sources_no_delete ON reporting.esg_metric_result_source_facts;
CREATE TRIGGER esg_metric_result_sources_no_delete BEFORE DELETE ON reporting.esg_metric_result_source_facts
FOR EACH ROW EXECUTE FUNCTION reporting.esg_metric_reject_mutation();
DROP TRIGGER IF EXISTS esg_metric_result_sources_audit ON reporting.esg_metric_result_source_facts;
CREATE TRIGGER esg_metric_result_sources_audit AFTER INSERT OR UPDATE OR DELETE ON reporting.esg_metric_result_source_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE reporting.esg_metric_definition_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.esg_metric_definition_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS esg_metric_definitions_tenant ON reporting.esg_metric_definition_facts;
CREATE POLICY esg_metric_definitions_tenant ON reporting.esg_metric_definition_facts
USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE reporting.esg_metric_result_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.esg_metric_result_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS esg_metric_results_tenant ON reporting.esg_metric_result_facts;
CREATE POLICY esg_metric_results_tenant ON reporting.esg_metric_result_facts
USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE reporting.esg_metric_result_source_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.esg_metric_result_source_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS esg_metric_result_sources_tenant ON reporting.esg_metric_result_source_facts;
CREATE POLICY esg_metric_result_sources_tenant ON reporting.esg_metric_result_source_facts
USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));
