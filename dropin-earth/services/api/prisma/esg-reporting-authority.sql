-- Canonical, route-closed CanopyProof ESG reporting authority.
-- Depends on canopyproof-os.sql, mrv-graph.sql, and environmental-proof-lifecycle.sql.
-- Reports are disclosure-preparation artifacts, not assurance opinions or financial instruments.

CREATE OR REPLACE FUNCTION reporting.canonical_esg_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CANOPYPROOF_CANONICAL_ESG_APPEND_ONLY_VIOLATION';
END;
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'currentEnvironmentalProofRequired', true,
    'activeSignedLifecycleRequired', true,
    'reviewedMrvRequired', true,
    'accreditedHumanPublisherRequired', true,
    'currentGovernedMetricRequired', true,
    'independentMetricReviewRequired', true,
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

CREATE OR REPLACE FUNCTION reporting.canonical_esg_text_is_safe(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT value !~* '(certified carbon credit|carbon[- ]?tax offset|guaranteed (rwa )?yield|automatic [$]?canopy distribution|regulatory approval|assurance opinion)';
$$;

DO $$
DECLARE
  has_report_facts boolean;
BEGIN
  IF to_regclass('reporting.canonical_esg_report_facts') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM reporting.canonical_esg_report_facts)'
      INTO has_report_facts;
  END IF;
  IF COALESCE(has_report_facts, false)
     AND NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'reporting' AND table_name = 'canonical_esg_report_facts'
         AND column_name = 'metric_set_root'
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CANONICAL_ESG_METRIC_BINDING_REQUIRES_EMPTY_REPORT_AUTHORITY';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS reporting.canonical_esg_report_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  organization_snapshot jsonb NOT NULL CHECK (jsonb_typeof(organization_snapshot) = 'object'),
  reporting_starts_at timestamptz NOT NULL,
  reporting_ends_at timestamptz NOT NULL,
  frameworks text[] NOT NULL CHECK (cardinality(frameworks) BETWEEN 1 AND 5),
  material_topics text[] NOT NULL CHECK (cardinality(material_topics) <= 32),
  publisher_id text NOT NULL REFERENCES identity.participants(id),
  publisher_snapshot jsonb NOT NULL CHECK (jsonb_typeof(publisher_snapshot) = 'object'),
  source_record_ids text[] NOT NULL CHECK (cardinality(source_record_ids) BETWEEN 1 AND 128),
  source_member_roots text[] NOT NULL CHECK (cardinality(source_member_roots) BETWEEN 1 AND 128),
  source_count integer NOT NULL CHECK (source_count BETWEEN 1 AND 128),
  source_set_root text NOT NULL CHECK (source_set_root ~ '^[0-9a-f]{64}$'),
  evidence_root text NOT NULL CHECK (evidence_root ~ '^[0-9a-f]{64}$'),
  verification_root text NOT NULL CHECK (verification_root ~ '^[0-9a-f]{64}$'),
  monitoring_root text NOT NULL CHECK (monitoring_root ~ '^[0-9a-f]{64}$'),
  confidence_score integer NOT NULL CHECK (confidence_score BETWEEN 0 AND 100),
  metric_result_ids text[] NOT NULL CHECK (cardinality(metric_result_ids) BETWEEN 1 AND 128),
  metric_member_roots text[] NOT NULL CHECK (cardinality(metric_member_roots) BETWEEN 1 AND 128),
  metric_count integer NOT NULL CHECK (metric_count BETWEEN 1 AND 128),
  metric_set_root text NOT NULL CHECK (metric_set_root ~ '^[0-9a-f]{64}$'),
  disclosures jsonb NOT NULL CHECK (jsonb_typeof(disclosures) = 'array'),
  generated_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  artifact_hash text NOT NULL UNIQUE CHECK (artifact_hash ~ '^[0-9a-f]{64}$'),
  report_hash text NOT NULL UNIQUE CHECK (report_hash ~ '^[0-9a-f]{64}$'),
  report_root text NOT NULL UNIQUE CHECK (report_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (organization_id, project_id, project_sequence),
  CHECK (reporting_starts_at <= reporting_ends_at),
  CHECK (reporting_ends_at <= generated_at),
  CHECK (source_count = cardinality(source_record_ids)),
  CHECK (source_count = cardinality(source_member_roots)),
  CHECK (metric_count = cardinality(metric_result_ids)),
  CHECK (metric_count = cardinality(metric_member_roots))
);

ALTER TABLE reporting.canonical_esg_report_facts
  ADD COLUMN IF NOT EXISTS metric_result_ids text[] NOT NULL CHECK (cardinality(metric_result_ids) BETWEEN 1 AND 128),
  ADD COLUMN IF NOT EXISTS metric_member_roots text[] NOT NULL CHECK (cardinality(metric_member_roots) BETWEEN 1 AND 128),
  ADD COLUMN IF NOT EXISTS metric_count integer NOT NULL CHECK (metric_count BETWEEN 1 AND 128),
  ADD COLUMN IF NOT EXISTS metric_set_root text NOT NULL CHECK (metric_set_root ~ '^[0-9a-f]{64}$');

CREATE TABLE IF NOT EXISTS reporting.canonical_esg_report_member_facts (
  id text PRIMARY KEY,
  report_id text NOT NULL REFERENCES reporting.canonical_esg_report_facts(id)
    DEFERRABLE INITIALLY DEFERRED,
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
  UNIQUE (report_id, member_index),
  UNIQUE (report_id, record_id)
);

CREATE TABLE IF NOT EXISTS reporting.canonical_esg_report_metric_member_facts (
  id text PRIMARY KEY,
  report_id text NOT NULL REFERENCES reporting.canonical_esg_report_facts(id) DEFERRABLE INITIALLY DEFERRED,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  member_index integer NOT NULL CHECK (member_index >= 0),
  result_id text NOT NULL REFERENCES reporting.esg_metric_result_facts(id),
  result_root text NOT NULL CHECK (result_root ~ '^[0-9a-f]{64}$'),
  result_projection_root text NOT NULL CHECK (result_projection_root ~ '^[0-9a-f]{64}$'),
  definition_id text NOT NULL REFERENCES reporting.esg_metric_definition_facts(id),
  definition_root text NOT NULL CHECK (definition_root ~ '^[0-9a-f]{64}$'),
  definition_version text NOT NULL CHECK (definition_version ~ '^v[0-9]+\.[0-9]+\.[0-9]+$'),
  value_state text NOT NULL CHECK (value_state IN ('reported','below_detection_limit','not_applicable','withheld','unavailable')),
  decimal_value text,
  unit text NOT NULL CHECK (unit IN ('percent','tCO2e','ha','m3','count','index')),
  detection_limit text,
  uncertainty_root text NOT NULL CHECK (uncertainty_root ~ '^[0-9a-f]{64}$'),
  reviewed_at timestamptz NOT NULL,
  member_hash text NOT NULL UNIQUE CHECK (member_hash ~ '^[0-9a-f]{64}$'),
  member_root text NOT NULL UNIQUE CHECK (member_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (report_id, member_index),
  UNIQUE (report_id, result_id)
);

CREATE INDEX IF NOT EXISTS canonical_esg_reports_project_time
  ON reporting.canonical_esg_report_facts (organization_id, project_id, generated_at DESC, id);
CREATE INDEX IF NOT EXISTS canonical_esg_report_members_report
  ON reporting.canonical_esg_report_member_facts (report_id, member_index, id);
CREATE INDEX IF NOT EXISTS canonical_esg_report_members_record
  ON reporting.canonical_esg_report_member_facts (organization_id, record_id, report_id);
CREATE INDEX IF NOT EXISTS canonical_esg_report_metric_members_report
  ON reporting.canonical_esg_report_metric_member_facts (report_id, member_index, id);
CREATE INDEX IF NOT EXISTS canonical_esg_report_metric_members_result
  ON reporting.canonical_esg_report_metric_member_facts (organization_id, result_id, report_id);

CREATE OR REPLACE FUNCTION reporting.canonical_esg_member_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-canonical-esg-report-member-v1') ||
    (document - ARRAY['factType','id','memberHash','memberRoot','safety']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_member_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-canonical-esg-report-member-root-v1') ||
    jsonb_build_object('id', document->>'id') ||
    (document - ARRAY['factType','id','memberHash','memberRoot','safety']::text[]) ||
    jsonb_build_object('memberHash', document->>'memberHash')
  );
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_metric_member_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-canonical-esg-metric-member-v1') ||
    (document - ARRAY['factType','id','memberHash','memberRoot','safety']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_metric_member_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-canonical-esg-metric-member-root-v1') ||
    jsonb_build_object('id', document->>'id') ||
    (document - ARRAY['factType','id','memberHash','memberRoot','safety']::text[]) ||
    jsonb_build_object('memberHash', document->>'memberHash')
  );
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_disclosures(
  framework_values text[],
  record_ids text[],
  source_root text,
  metric_result_ids text[],
  metric_root text
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_agg(
    CASE framework
      WHEN 'GRI' THEN jsonb_build_object(
        'framework', framework, 'status', 'preparation_only',
        'title', 'GRI environmental disclosure preparation',
        'statement', 'Source-linked environmental accountability facts are organized for independent GRI mapping review.',
        'sourceRecordIds', to_jsonb(record_ids), 'sourceRoot', source_root,
        'metricResultIds', to_jsonb(metric_result_ids), 'metricRoot', metric_root,
        'limitations', jsonb_build_array('No GRI conformance or external assurance is asserted.')
      )
      WHEN 'SDG' THEN jsonb_build_object(
        'framework', framework, 'status', 'preparation_only',
        'title', 'UN Sustainable Development Goal mapping preparation',
        'statement', 'Current Environmental Proof sources are linked for independent SDG 6, 13, and 15 mapping review.',
        'sourceRecordIds', to_jsonb(record_ids), 'sourceRoot', source_root,
        'metricResultIds', to_jsonb(metric_result_ids), 'metricRoot', metric_root,
        'limitations', jsonb_build_array('No United Nations endorsement or SDG achievement claim is asserted.')
      )
      WHEN 'TNFD' THEN jsonb_build_object(
        'framework', framework, 'status', 'preparation_only',
        'title', 'TNFD nature-related disclosure preparation',
        'statement', 'Governance, strategy, risk, metric, and limitation anchors are prepared for independent TNFD review.',
        'sourceRecordIds', to_jsonb(record_ids), 'sourceRoot', source_root,
        'metricResultIds', to_jsonb(metric_result_ids), 'metricRoot', metric_root,
        'limitations', jsonb_build_array('This is not a TNFD filing or assurance opinion.')
      )
      WHEN 'BIODIVERSITY' THEN jsonb_build_object(
        'framework', framework, 'status', 'preparation_only',
        'title', 'Biodiversity accountability preparation',
        'statement', 'Biodiversity observations remain bounded to signed, monitored Environmental Proof sources.',
        'sourceRecordIds', to_jsonb(record_ids), 'sourceRoot', source_root,
        'metricResultIds', to_jsonb(metric_result_ids), 'metricRoot', metric_root,
        'limitations', jsonb_build_array('No ecosystem completeness, permanence, or recovery guarantee is asserted.')
      )
      WHEN 'CLIMATE_IMPACT' THEN jsonb_build_object(
        'framework', framework, 'status', 'preparation_only',
        'title', 'Climate impact accountability preparation',
        'statement', 'Climate observations remain evidence-linked and challenge-aware for independent review.',
        'sourceRecordIds', to_jsonb(record_ids), 'sourceRoot', source_root,
        'metricResultIds', to_jsonb(metric_result_ids), 'metricRoot', metric_root,
        'limitations', jsonb_build_array('No certified credit, tax offset, financial asset, or guaranteed yield is created.')
      )
    END
    ORDER BY position
  )
  FROM unnest(framework_values) WITH ORDINALITY AS item(framework, position);
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_command_hash(
  document jsonb,
  source_seeds jsonb,
  metric_seeds jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-canonical-esg-report-command-v1',
    'organization', document->'organization',
    'projectId', document->>'projectId',
    'reportingPeriod', document->'reportingPeriod',
    'frameworks', document->'frameworks',
    'materialTopics', document->'materialTopics',
    'publisher', document->'publisher',
    'sources', source_seeds,
    'metrics', metric_seeds,
    'generatedAt', document->>'generatedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_artifact_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-canonical-esg-report-artifact-v1',
    'organization', document->'organization',
    'projectId', document->>'projectId',
    'reportingPeriod', document->'reportingPeriod',
    'frameworks', document->'frameworks',
    'materialTopics', document->'materialTopics',
    'sourceRecordIds', document->'sourceRecordIds',
    'sourceMemberRoots', document->'sourceMemberRoots',
    'sourceCount', document->'sourceCount',
    'sourceSetRoot', document->>'sourceSetRoot',
    'evidenceRoot', document->>'evidenceRoot',
    'verificationRoot', document->>'verificationRoot',
    'monitoringRoot', document->>'monitoringRoot',
    'confidenceScore', document->'confidenceScore',
    'metricResultIds', document->'metricResultIds',
    'metricMemberRoots', document->'metricMemberRoots',
    'metricCount', document->'metricCount',
    'metricSetRoot', document->>'metricSetRoot',
    'disclosures', document->'disclosures',
    'generatedAt', document->>'generatedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_report_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-canonical-esg-report-v1') ||
    (document - ARRAY['factType','reportHash','reportRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_report_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-canonical-esg-report-root-v1',
    'report', document - ARRAY['factType','reportRoot','safety','auditEvent']::text[]
  ));
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_event_is_contiguous(target_event_root text)
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
  SELECT * INTO prior_event
  FROM audit.domain_events
  WHERE stream_id = current_event.stream_id AND sequence_no < current_event.sequence_no
  ORDER BY sequence_no DESC LIMIT 1;
  genesis_root := audit.sha256_stable_json(jsonb_build_object('kind', 'canopyproof-audit-genesis-v1'));
  RETURN NOT EXISTS (
      SELECT 1 FROM audit.domain_events later
      WHERE later.stream_id = current_event.stream_id AND later.sequence_no > current_event.sequence_no
    )
    AND (
      (current_event.sequence_no = 1 AND prior_event.id IS NULL AND current_event.previous_root = genesis_root)
      OR
      (prior_event.id IS NOT NULL
        AND current_event.sequence_no = prior_event.sequence_no + 1
        AND current_event.previous_root = prior_event.event_root)
    );
END;
$$;

CREATE OR REPLACE FUNCTION reporting.validate_canonical_esg_report_member_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  report_fact reporting.canonical_esg_report_facts%ROWTYPE;
  record_fact certificates.environmental_proof_record_facts%ROWTYPE;
  binding_fact certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  signature_fact certificates.environmental_proof_signature_receipt_facts%ROWTYPE;
  governed record;
  lifecycle record;
  expected_verification_root text;
  expected_document jsonb;
BEGIN
  SELECT * INTO STRICT report_fact
  FROM reporting.canonical_esg_report_facts WHERE id = NEW.report_id;
  SELECT * INTO STRICT record_fact
  FROM certificates.environmental_proof_record_facts WHERE id = NEW.record_id;
  SELECT * INTO STRICT binding_fact
  FROM certificates.environmental_proof_lifecycle_binding_facts WHERE id = NEW.lifecycle_binding_id;
  SELECT * INTO STRICT signature_fact
  FROM certificates.environmental_proof_signature_receipt_facts WHERE id = NEW.signature_receipt_id;
  SELECT * INTO STRICT governed
  FROM certificates.environmental_proof_governed_record_projection(NEW.record_id);
  SELECT * INTO STRICT lifecycle
  FROM certificates.environmental_proof_lifecycle_projection(NEW.lifecycle_binding_id, report_fact.generated_at);

  expected_verification_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(record_fact.evidence_final_decision_roots) AS value ORDER BY value
  ));
  expected_document := jsonb_build_object(
    'factType', 'canonical_esg_report_member',
    'id', NEW.id,
    'reportId', NEW.report_id,
    'organizationId', NEW.organization_id,
    'projectId', NEW.project_id,
    'memberIndex', NEW.member_index,
    'recordId', NEW.record_id,
    'recordRoot', NEW.record_root,
    'governedRecordProjectionRoot', NEW.governed_record_projection_root,
    'lifecycleBindingId', NEW.lifecycle_binding_id,
    'lifecycleBindingRoot', NEW.lifecycle_binding_root,
    'lifecycleProjectionRoot', NEW.lifecycle_projection_root,
    'signingKeyAuthorityId', NEW.signing_key_authority_id,
    'signingKeyRoot', NEW.signing_key_root,
    'signatureReceiptId', NEW.signature_receipt_id,
    'signatureReceiptRoot', NEW.signature_receipt_root,
    'mrvSnapshotId', NEW.mrv_snapshot_id,
    'mrvSnapshotRoot', NEW.mrv_snapshot_root,
    'evidenceRoot', NEW.evidence_root,
    'verificationRoot', NEW.verification_root,
    'monitoringRoot', NEW.monitoring_root,
    'confidenceScore', NEW.confidence_score,
    'memberHash', NEW.member_hash,
    'memberRoot', NEW.member_root,
    'safety', reporting.canonical_esg_safety_canonical()
  );

  IF NEW.organization_id <> report_fact.organization_id
     OR NEW.project_id <> report_fact.project_id
     OR record_fact.organization_id <> NEW.organization_id
     OR record_fact.project_id <> NEW.project_id
     OR record_fact.status <> 'issued'
     OR record_fact.record_root <> NEW.record_root
     OR governed.record_root <> NEW.record_root
     OR governed.state <> 'issued'
     OR governed.source_authority_current IS NOT TRUE
     OR governed.projection_root <> NEW.governed_record_projection_root
     OR binding_fact.organization_id <> NEW.organization_id
     OR binding_fact.project_id <> NEW.project_id
     OR binding_fact.record_id <> NEW.record_id
     OR binding_fact.record_root <> NEW.record_root
     OR binding_fact.binding_root <> NEW.lifecycle_binding_root
     OR binding_fact.signing_key_authority_id <> NEW.signing_key_authority_id
     OR binding_fact.signing_key_root <> NEW.signing_key_root
     OR binding_fact.mrv_snapshot_id <> NEW.mrv_snapshot_id
     OR binding_fact.mrv_snapshot_root <> NEW.mrv_snapshot_root
     OR lifecycle.organization_id <> NEW.organization_id
     OR lifecycle.project_id <> NEW.project_id
     OR lifecycle.record_id <> NEW.record_id
     OR lifecycle.record_root <> NEW.record_root
     OR lifecycle.binding_root <> NEW.lifecycle_binding_root
     OR lifecycle.projection_root <> NEW.lifecycle_projection_root
     OR lifecycle.state <> 'active'
     OR lifecycle.governed_record_state <> 'issued'
     OR lifecycle.source_authority_current IS NOT TRUE
     OR lifecycle.mrv_state <> 'reviewed_for_lineage'
     OR lifecycle.bound_mrv_snapshot_current IS NOT TRUE
     OR lifecycle.key_state <> 'active'
     OR lifecycle.signature_verified IS NOT TRUE
     OR lifecycle.validity_current IS NOT TRUE
     OR signature_fact.organization_id <> NEW.organization_id
     OR signature_fact.project_id <> NEW.project_id
     OR signature_fact.record_id <> NEW.record_id
     OR signature_fact.record_root <> NEW.record_root
     OR signature_fact.binding_id <> NEW.lifecycle_binding_id
     OR signature_fact.binding_root <> NEW.lifecycle_binding_root
     OR signature_fact.signing_key_authority_id <> NEW.signing_key_authority_id
     OR signature_fact.signing_key_root <> NEW.signing_key_root
     OR signature_fact.receipt_root <> NEW.signature_receipt_root
     OR signature_fact.verified_at > report_fact.generated_at
     OR record_fact.evidence_root <> NEW.evidence_root
     OR expected_verification_root <> NEW.verification_root
     OR record_fact.monitoring_root <> NEW.monitoring_root
     OR record_fact.confidence_score <> NEW.confidence_score
     OR NEW.fact_record <> expected_document
     OR NEW.member_hash <> reporting.canonical_esg_member_hash(NEW.fact_record)
     OR NEW.id <> 'cp_canonical_esg_member_' || left(NEW.member_hash, 24)
     OR NEW.member_root <> reporting.canonical_esg_member_root(NEW.fact_record)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_CANONICAL_ESG_MEMBER_AUTHORITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reporting.validate_canonical_esg_report_metric_member_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  report_fact reporting.canonical_esg_report_facts%ROWTYPE;
  result_fact reporting.esg_metric_result_facts%ROWTYPE;
  result_projection record;
  expected_document jsonb;
BEGIN
  SELECT * INTO STRICT report_fact
  FROM reporting.canonical_esg_report_facts WHERE id = NEW.report_id;
  SELECT * INTO STRICT result_fact
  FROM reporting.esg_metric_result_facts WHERE id = NEW.result_id;
  SELECT * INTO STRICT result_projection
  FROM reporting.esg_metric_result_projection(NEW.result_id, report_fact.generated_at);

  expected_document := jsonb_strip_nulls(jsonb_build_object(
    'factType', 'canonical_esg_report_metric_member',
    'id', NEW.id,
    'reportId', NEW.report_id,
    'organizationId', NEW.organization_id,
    'projectId', NEW.project_id,
    'memberIndex', NEW.member_index,
    'resultId', NEW.result_id,
    'resultRoot', NEW.result_root,
    'resultProjectionRoot', NEW.result_projection_root,
    'definitionId', NEW.definition_id,
    'definitionRoot', NEW.definition_root,
    'definitionVersion', NEW.definition_version,
    'valueState', NEW.value_state,
    'decimalValue', NEW.decimal_value,
    'unit', NEW.unit,
    'detectionLimit', NEW.detection_limit,
    'uncertaintyRoot', NEW.uncertainty_root,
    'reviewedAt', audit.iso8601_millis(NEW.reviewed_at),
    'memberHash', NEW.member_hash,
    'memberRoot', NEW.member_root,
    'safety', reporting.canonical_esg_safety_canonical()
  ));

  IF NEW.organization_id <> report_fact.organization_id
     OR NEW.project_id <> report_fact.project_id
     OR result_fact.organization_id <> NEW.organization_id
     OR result_fact.project_id <> NEW.project_id
     OR result_fact.result_root <> NEW.result_root
     OR result_fact.definition_id <> NEW.definition_id
     OR result_fact.definition_root <> NEW.definition_root
     OR result_fact.definition_version <> NEW.definition_version
     OR result_fact.value_state <> NEW.value_state
     OR result_fact.decimal_value IS DISTINCT FROM NEW.decimal_value
     OR result_fact.unit <> NEW.unit
     OR result_fact.detection_limit IS DISTINCT FROM NEW.detection_limit
     OR result_fact.uncertainty->>'uncertaintyRoot' <> NEW.uncertainty_root
     OR result_fact.reviewed_at <> NEW.reviewed_at
     OR result_fact.reviewed_at > report_fact.generated_at
     OR NOT (result_fact.source_record_ids <@ report_fact.source_record_ids)
     OR result_projection.state <> 'current'
     OR result_projection.result_root <> NEW.result_root
     OR result_projection.evaluated_at_value <> report_fact.generated_at
     OR result_projection.projection_root <> NEW.result_projection_root
     OR NEW.fact_record <> expected_document
     OR NEW.member_hash <> reporting.canonical_esg_metric_member_hash(NEW.fact_record)
     OR NEW.id <> 'cp_canonical_esg_metric_' || left(NEW.member_hash, 24)
     OR NEW.member_root <> reporting.canonical_esg_metric_member_root(NEW.fact_record)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_CANONICAL_ESG_METRIC_MEMBER_AUTHORITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reporting.validate_canonical_esg_report_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  organization_record organizations.organizations%ROWTYPE;
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
  metric_member_count integer;
  distinct_metric_index_count integer;
  minimum_metric_index integer;
  maximum_metric_index integer;
  metric_result_ids text[];
  metric_member_roots text[];
  metric_seeds jsonb;
  expected_metric_set_root text;
  expected_source_set_root text;
  expected_evidence_root text;
  expected_verification_root text;
  expected_monitoring_root text;
  expected_disclosures jsonb;
  expected_organization jsonb;
  expected_document jsonb;
  expected_command_hash text;
  expected_artifact_hash text;
  expected_report_hash text;
  expected_report_root text;
  expected_stream_id text;
BEGIN
  SELECT * INTO STRICT organization_record
  FROM organizations.organizations WHERE id = NEW.organization_id;
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT
    count(*)::integer,
    count(DISTINCT member_index)::integer,
    min(member_index),
    max(member_index),
    array_agg(record_id ORDER BY member_index),
    array_agg(member_root ORDER BY member_index),
    array_agg(evidence_root ORDER BY member_index),
    array_agg(verification_root ORDER BY member_index),
    array_agg(monitoring_root ORDER BY member_index),
    min(confidence_score),
    jsonb_agg(
      fact_record - ARRAY['factType','id','reportId','memberIndex','memberHash','memberRoot','safety']::text[]
      ORDER BY member_index
    )
  INTO member_count, distinct_index_count, minimum_index, maximum_index,
    member_record_ids, member_roots, member_evidence_roots, member_verification_roots,
    member_monitoring_roots, minimum_confidence, source_seeds
  FROM reporting.canonical_esg_report_member_facts
  WHERE report_id = NEW.id;

  SELECT
    count(*)::integer,
    count(DISTINCT member_index)::integer,
    min(member_index),
    max(member_index),
    array_agg(result_id ORDER BY member_index),
    array_agg(member_root ORDER BY member_index),
    jsonb_agg(
      fact_record - ARRAY['factType','id','reportId','memberIndex','memberHash','memberRoot','safety']::text[]
      ORDER BY member_index
    )
  INTO metric_member_count, distinct_metric_index_count, minimum_metric_index,
    maximum_metric_index, metric_result_ids, metric_member_roots, metric_seeds
  FROM reporting.canonical_esg_report_metric_member_facts
  WHERE report_id = NEW.id;

  expected_source_set_root := audit.merkle_root(member_roots);
  expected_evidence_root := audit.merkle_root(member_evidence_roots);
  expected_verification_root := audit.merkle_root(member_verification_roots);
  expected_monitoring_root := audit.merkle_root(member_monitoring_roots);
  expected_metric_set_root := audit.merkle_root(metric_member_roots);
  expected_disclosures := reporting.canonical_esg_disclosures(
    NEW.frameworks, NEW.source_record_ids, expected_source_set_root,
    NEW.metric_result_ids, expected_metric_set_root
  );
  expected_organization := jsonb_build_object(
    'id', organization_record.id,
    'name', COALESCE(organization_record.name, organization_record.legal_name),
    'verificationStatus', 'verified',
    'organizationRoot', organization_record.profile_hash
  );
  expected_document := jsonb_build_object(
    'factType', 'canonical_esg_report',
    'id', NEW.id,
    'organization', NEW.organization_snapshot,
    'projectId', NEW.project_id,
    'reportingPeriod', jsonb_build_object(
      'startsAt', audit.iso8601_millis(NEW.reporting_starts_at),
      'endsAt', audit.iso8601_millis(NEW.reporting_ends_at)
    ),
    'frameworks', to_jsonb(NEW.frameworks),
    'materialTopics', to_jsonb(NEW.material_topics),
    'publisher', NEW.publisher_snapshot,
    'sourceRecordIds', to_jsonb(NEW.source_record_ids),
    'sourceMemberRoots', to_jsonb(NEW.source_member_roots),
    'sourceCount', NEW.source_count,
    'sourceSetRoot', NEW.source_set_root,
    'evidenceRoot', NEW.evidence_root,
    'verificationRoot', NEW.verification_root,
    'monitoringRoot', NEW.monitoring_root,
    'confidenceScore', NEW.confidence_score,
    'metricResultIds', to_jsonb(NEW.metric_result_ids),
    'metricMemberRoots', to_jsonb(NEW.metric_member_roots),
    'metricCount', NEW.metric_count,
    'metricSetRoot', NEW.metric_set_root,
    'disclosures', NEW.disclosures,
    'generatedAt', audit.iso8601_millis(NEW.generated_at),
    'commandHash', NEW.command_hash,
    'projectSequence', NEW.project_sequence,
    'previousEventRoot', NEW.previous_event_root,
    'artifactHash', NEW.artifact_hash,
    'reportHash', NEW.report_hash,
    'reportRoot', NEW.report_root,
    'safety', reporting.canonical_esg_safety_canonical(),
    'auditEvent', mrv.audit_event_record(semantic_event)
  );
  expected_command_hash := reporting.canonical_esg_command_hash(expected_document, source_seeds, metric_seeds);
  expected_artifact_hash := reporting.canonical_esg_artifact_hash(expected_document);
  expected_report_hash := reporting.canonical_esg_report_hash(expected_document);
  expected_report_root := reporting.canonical_esg_report_root(expected_document);
  expected_stream_id := 'canonical-esg-report:'
    || length(NEW.organization_id)::text || ':' || NEW.organization_id
    || length(NEW.project_id)::text || ':' || NEW.project_id;

  IF organization_record.verification_status <> 'verified'
     OR organization_record.profile_hash IS NULL
     OR NEW.organization_snapshot <> expected_organization
     OR NOT verification.actor_snapshot_is_valid(
       NEW.publisher_snapshot, NEW.publisher_id, NEW.organization_id,
       'human', ARRAY['owner','admin','verifier','researcher']::text[]
     )
     OR NEW.publisher_snapshot->>'membershipStatus' <> 'active'
     OR NEW.publisher_snapshot->>'accreditationStatus' <> 'approved'
     OR NOT (NEW.publisher_snapshot->'accreditationScope' @> jsonb_build_array('esg_reporting:publish'))
     OR NOT audit.is_sorted_unique_text_array(NEW.frameworks)
     OR NOT (NEW.frameworks <@ ARRAY['GRI','SDG','TNFD','BIODIVERSITY','CLIMATE_IMPACT']::text[])
     OR NOT audit.is_sorted_unique_text_array(NEW.material_topics)
     OR NOT audit.is_sorted_unique_text_array(NEW.source_record_ids)
     OR NOT audit.is_sorted_unique_text_array(NEW.metric_result_ids)
     OR NOT reporting.canonical_esg_text_is_safe(COALESCE(organization_record.name, organization_record.legal_name))
     OR EXISTS (
       SELECT 1 FROM unnest(NEW.material_topics) AS topic
       WHERE NOT reporting.canonical_esg_text_is_safe(topic)
     )
     OR NEW.generated_at <> date_trunc('milliseconds', NEW.generated_at)
     OR NEW.reporting_starts_at <> date_trunc('milliseconds', NEW.reporting_starts_at)
     OR NEW.reporting_ends_at <> date_trunc('milliseconds', NEW.reporting_ends_at)
     OR member_count <> NEW.source_count
     OR distinct_index_count <> NEW.source_count
     OR minimum_index <> 0
     OR maximum_index <> NEW.source_count - 1
     OR member_record_ids <> NEW.source_record_ids
     OR member_roots <> NEW.source_member_roots
     OR expected_source_set_root <> NEW.source_set_root
     OR expected_evidence_root <> NEW.evidence_root
     OR expected_verification_root <> NEW.verification_root
     OR expected_monitoring_root <> NEW.monitoring_root
     OR minimum_confidence <> NEW.confidence_score
     OR metric_member_count <> NEW.metric_count
     OR distinct_metric_index_count <> NEW.metric_count
     OR minimum_metric_index <> 0
     OR maximum_metric_index <> NEW.metric_count - 1
     OR metric_result_ids <> NEW.metric_result_ids
     OR metric_member_roots <> NEW.metric_member_roots
     OR expected_metric_set_root <> NEW.metric_set_root
     OR expected_disclosures <> NEW.disclosures
     OR expected_command_hash <> NEW.command_hash
     OR NEW.id <> 'cp_canonical_esg_' || left(NEW.command_hash, 24)
     OR expected_artifact_hash <> NEW.artifact_hash
     OR expected_report_hash <> NEW.report_hash
     OR expected_report_root <> NEW.report_root
     OR NEW.fact_record <> expected_document
     OR semantic_event.stream_id <> expected_stream_id
     OR semantic_event.sequence_no <> NEW.project_sequence
     OR semantic_event.action <> 'ASSERT'
     OR semantic_event.actor_id <> NEW.publisher_id
     OR semantic_event.entity_type <> 'esg_report'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.payload_hash <> audit.sha256_stable_json(expected_document - 'auditEvent')
     OR semantic_event.created_at <> NEW.generated_at
     OR semantic_event.rationale <>
       'An accredited human published a route-closed ESG preparation report from current signed Environmental Proof authority.'
     OR NOT reporting.canonical_esg_event_is_contiguous(NEW.audit_event_root)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_CANONICAL_ESG_REPORT_AUTHORITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION reporting.canonical_esg_report_projection(
  target_report_id text,
  evaluated_at timestamptz
)
RETURNS TABLE (
  organization_id text,
  project_id text,
  report_id text,
  report_root text,
  state text,
  evaluated_at_value timestamptz,
  source_count integer,
  current_source_count integer,
  issue_codes text[],
  current_source_root text,
  metric_count integer,
  current_metric_count integer,
  current_metric_root text,
  projection_root text,
  safety jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  report_fact reporting.canonical_esg_report_facts%ROWTYPE;
  member_fact reporting.canonical_esg_report_member_facts%ROWTYPE;
  record_fact certificates.environmental_proof_record_facts%ROWTYPE;
  binding_fact certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  signature_fact certificates.environmental_proof_signature_receipt_facts%ROWTYPE;
  governed record;
  lifecycle record;
  issues text[] := ARRAY[]::text[];
  current_roots text[] := ARRAY[]::text[];
  projected_state text;
  projected_current_count integer := 0;
  metric_member reporting.canonical_esg_report_metric_member_facts%ROWTYPE;
  metric_projection record;
  current_metric_roots text[] := ARRAY[]::text[];
  projected_current_metric_count integer := 0;
  challenged boolean := false;
  revoked boolean := false;
  expired boolean := false;
  exact_historical_binding boolean;
  currently_eligible boolean;
  current_root text;
  projected_current_root text;
  projected_current_metric_root text;
  projected_root text;
BEGIN
  IF evaluated_at IS NULL OR evaluated_at <> date_trunc('milliseconds', evaluated_at) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CANONICAL_ESG_EVALUATION_TIME_INVALID';
  END IF;
  SELECT * INTO STRICT report_fact
  FROM reporting.canonical_esg_report_facts WHERE id = target_report_id;

  FOR member_fact IN
    SELECT member_source.* FROM reporting.canonical_esg_report_member_facts AS member_source
    WHERE member_source.report_id = target_report_id ORDER BY member_source.member_index
  LOOP
    SELECT * INTO STRICT record_fact
    FROM certificates.environmental_proof_record_facts WHERE id = member_fact.record_id;
    SELECT * INTO STRICT binding_fact
    FROM certificates.environmental_proof_lifecycle_binding_facts WHERE id = member_fact.lifecycle_binding_id;
    SELECT * INTO STRICT signature_fact
    FROM certificates.environmental_proof_signature_receipt_facts
    WHERE binding_id = binding_fact.id;
    SELECT * INTO STRICT governed
    FROM certificates.environmental_proof_governed_record_projection(member_fact.record_id);
    SELECT * INTO STRICT lifecycle
    FROM certificates.environmental_proof_lifecycle_projection(binding_fact.id, evaluated_at);

    IF governed.state = 'revoked' THEN revoked := true;
    ELSIF governed.state = 'challenged' THEN challenged := true;
    END IF;
    IF lifecycle.state = 'expired' THEN expired := true; END IF;

    current_root := audit.sha256_stable_json(jsonb_build_object(
      'kind', 'canopyproof-canonical-esg-current-source-v1',
      'recordId', record_fact.id,
      'recordRoot', record_fact.record_root,
      'governedRecordProjectionRoot', governed.projection_root,
      'lifecycleBindingId', binding_fact.id,
      'lifecycleBindingRoot', binding_fact.binding_root,
      'lifecycleProjectionRoot', lifecycle.projection_root,
      'signatureReceiptId', signature_fact.id,
      'signatureReceiptRoot', signature_fact.receipt_root
    ));
    current_roots := array_append(current_roots, current_root);

    exact_historical_binding :=
      member_fact.record_root = record_fact.record_root
      AND member_fact.lifecycle_binding_id = binding_fact.id
      AND member_fact.lifecycle_binding_root = binding_fact.binding_root
      AND member_fact.signature_receipt_id = signature_fact.id
      AND member_fact.signature_receipt_root = signature_fact.receipt_root
      AND member_fact.mrv_snapshot_id = binding_fact.mrv_snapshot_id
      AND member_fact.mrv_snapshot_root = binding_fact.mrv_snapshot_root;
    currently_eligible :=
      governed.state = 'issued'
      AND governed.source_authority_current IS TRUE
      AND lifecycle.state = 'active'
      AND lifecycle.source_authority_current IS TRUE
      AND lifecycle.bound_mrv_snapshot_current IS TRUE
      AND lifecycle.signature_verified IS TRUE
      AND lifecycle.validity_current IS TRUE;
    IF NOT exact_historical_binding THEN
      issues := array_append(issues, 'source_binding_changed:' || member_fact.record_id);
    END IF;
    IF NOT currently_eligible THEN
      issues := array_append(issues, 'source_not_current:' || member_fact.record_id);
    END IF;
    IF exact_historical_binding AND currently_eligible THEN
      projected_current_count := projected_current_count + 1;
    END IF;
  END LOOP;

  FOR metric_member IN
    SELECT metric_source.* FROM reporting.canonical_esg_report_metric_member_facts metric_source
    WHERE metric_source.report_id = target_report_id ORDER BY metric_source.member_index
  LOOP
    SELECT * INTO STRICT metric_projection
    FROM reporting.esg_metric_result_projection(metric_member.result_id, evaluated_at);
    current_metric_roots := array_append(current_metric_roots, metric_projection.projection_root);
    IF metric_projection.state = 'revoked' THEN revoked := true;
    ELSIF metric_projection.state = 'challenged' THEN challenged := true;
    END IF;
    IF metric_projection.state = 'expired' THEN expired := true; END IF;
    IF metric_projection.result_root <> metric_member.result_root THEN
      issues := array_append(issues, 'metric_binding_changed:' || metric_member.result_id);
    ELSIF metric_projection.state <> 'current' THEN
      issues := array_append(issues, 'metric_not_current:' || metric_member.result_id);
    ELSE
      projected_current_metric_count := projected_current_metric_count + 1;
    END IF;
  END LOOP;

  SELECT COALESCE(array_agg(DISTINCT issue ORDER BY issue), ARRAY[]::text[])
  INTO issues FROM unnest(issues) AS issue;
  projected_state := CASE
    WHEN revoked THEN 'revoked'
    WHEN challenged THEN 'challenged'
    WHEN expired THEN 'expired'
    WHEN cardinality(issues) > 0 THEN 'stale'
    ELSE 'current'
  END;
  projected_current_root := audit.merkle_root(ARRAY(
    SELECT root_value FROM unnest(current_roots) AS root_value ORDER BY root_value
  ));
  projected_current_metric_root := audit.merkle_root(ARRAY(
    SELECT root_value FROM unnest(current_metric_roots) AS root_value ORDER BY root_value
  ));
  projected_root := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-canonical-esg-report-projection-v1',
    'organizationId', report_fact.organization_id,
    'projectId', report_fact.project_id,
    'reportId', report_fact.id,
    'reportRoot', report_fact.report_root,
    'state', projected_state,
    'evaluatedAt', audit.iso8601_millis(evaluated_at),
    'sourceCount', report_fact.source_count,
    'currentSourceCount', projected_current_count,
    'issueCodes', to_jsonb(issues),
    'currentSourceRoot', projected_current_root,
    'metricCount', report_fact.metric_count,
    'currentMetricCount', projected_current_metric_count,
    'currentMetricRoot', projected_current_metric_root
  ));

  RETURN QUERY SELECT
    report_fact.organization_id,
    report_fact.project_id,
    report_fact.id,
    report_fact.report_root,
    projected_state,
    evaluated_at,
    report_fact.source_count,
    projected_current_count,
    issues,
    projected_current_root,
    report_fact.metric_count,
    projected_current_metric_count,
    projected_current_metric_root,
    projected_root,
    reporting.canonical_esg_safety_canonical();
END;
$$;

DROP TRIGGER IF EXISTS canonical_esg_report_members_validate
  ON reporting.canonical_esg_report_member_facts;
CREATE TRIGGER canonical_esg_report_members_validate
BEFORE INSERT ON reporting.canonical_esg_report_member_facts
FOR EACH ROW EXECUTE FUNCTION reporting.validate_canonical_esg_report_member_insert();

DROP TRIGGER IF EXISTS canonical_esg_report_metric_members_validate
  ON reporting.canonical_esg_report_metric_member_facts;
CREATE TRIGGER canonical_esg_report_metric_members_validate
BEFORE INSERT ON reporting.canonical_esg_report_metric_member_facts
FOR EACH ROW EXECUTE FUNCTION reporting.validate_canonical_esg_report_metric_member_insert();

DROP TRIGGER IF EXISTS canonical_esg_reports_validate
  ON reporting.canonical_esg_report_facts;
CREATE CONSTRAINT TRIGGER canonical_esg_reports_validate
AFTER INSERT ON reporting.canonical_esg_report_facts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION reporting.validate_canonical_esg_report_insert();

DROP TRIGGER IF EXISTS canonical_esg_reports_no_update
  ON reporting.canonical_esg_report_facts;
CREATE TRIGGER canonical_esg_reports_no_update
BEFORE UPDATE ON reporting.canonical_esg_report_facts
FOR EACH ROW EXECUTE FUNCTION reporting.canonical_esg_reject_mutation();
DROP TRIGGER IF EXISTS canonical_esg_reports_no_delete
  ON reporting.canonical_esg_report_facts;
CREATE TRIGGER canonical_esg_reports_no_delete
BEFORE DELETE ON reporting.canonical_esg_report_facts
FOR EACH ROW EXECUTE FUNCTION reporting.canonical_esg_reject_mutation();
DROP TRIGGER IF EXISTS canonical_esg_reports_audit
  ON reporting.canonical_esg_report_facts;
CREATE TRIGGER canonical_esg_reports_audit
AFTER INSERT OR UPDATE OR DELETE ON reporting.canonical_esg_report_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS canonical_esg_report_members_no_update
  ON reporting.canonical_esg_report_member_facts;
CREATE TRIGGER canonical_esg_report_members_no_update
BEFORE UPDATE ON reporting.canonical_esg_report_member_facts
FOR EACH ROW EXECUTE FUNCTION reporting.canonical_esg_reject_mutation();
DROP TRIGGER IF EXISTS canonical_esg_report_members_no_delete
  ON reporting.canonical_esg_report_member_facts;
CREATE TRIGGER canonical_esg_report_members_no_delete
BEFORE DELETE ON reporting.canonical_esg_report_member_facts
FOR EACH ROW EXECUTE FUNCTION reporting.canonical_esg_reject_mutation();
DROP TRIGGER IF EXISTS canonical_esg_report_members_audit
  ON reporting.canonical_esg_report_member_facts;
CREATE TRIGGER canonical_esg_report_members_audit
AFTER INSERT OR UPDATE OR DELETE ON reporting.canonical_esg_report_member_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS canonical_esg_report_metric_members_no_update
  ON reporting.canonical_esg_report_metric_member_facts;
CREATE TRIGGER canonical_esg_report_metric_members_no_update
BEFORE UPDATE ON reporting.canonical_esg_report_metric_member_facts
FOR EACH ROW EXECUTE FUNCTION reporting.canonical_esg_reject_mutation();
DROP TRIGGER IF EXISTS canonical_esg_report_metric_members_no_delete
  ON reporting.canonical_esg_report_metric_member_facts;
CREATE TRIGGER canonical_esg_report_metric_members_no_delete
BEFORE DELETE ON reporting.canonical_esg_report_metric_member_facts
FOR EACH ROW EXECUTE FUNCTION reporting.canonical_esg_reject_mutation();
DROP TRIGGER IF EXISTS canonical_esg_report_metric_members_audit
  ON reporting.canonical_esg_report_metric_member_facts;
CREATE TRIGGER canonical_esg_report_metric_members_audit
AFTER INSERT OR UPDATE OR DELETE ON reporting.canonical_esg_report_metric_member_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE reporting.canonical_esg_report_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.canonical_esg_report_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS canonical_esg_reports_tenant
  ON reporting.canonical_esg_report_facts;
CREATE POLICY canonical_esg_reports_tenant
  ON reporting.canonical_esg_report_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE reporting.canonical_esg_report_member_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.canonical_esg_report_member_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS canonical_esg_report_members_tenant
  ON reporting.canonical_esg_report_member_facts;
CREATE POLICY canonical_esg_report_members_tenant
  ON reporting.canonical_esg_report_member_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE reporting.canonical_esg_report_metric_member_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting.canonical_esg_report_metric_member_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS canonical_esg_report_metric_members_tenant
  ON reporting.canonical_esg_report_metric_member_facts;
CREATE POLICY canonical_esg_report_metric_members_tenant
  ON reporting.canonical_esg_report_metric_member_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));
