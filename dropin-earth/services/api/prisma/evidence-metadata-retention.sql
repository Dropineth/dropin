-- CanopyProof Evidence Protocol E3b durable authority.
-- Apply after canopyproof-os.sql, evidence-device-attestation-adapters.sql,
-- and evidence-media-adapters.sql. This migration is additive and route-closed.

CREATE OR REPLACE FUNCTION evidence.e3b_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CANOPYPROOF_E3B_APPEND_ONLY_VIOLATION: %.% cannot be updated or deleted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'appendOnly', true,
    'organizationBound', true,
    'projectBound', true,
    'evidenceBound', true,
    'subjectBound', true,
    'mediaObjectBound', true,
    'mediaProjectionBound', true,
    'consentBound', true,
    'deviceBound', true,
    'semanticEventBound', true,
    'metadataMinimizedByDefault', true,
    'noRawExif', true,
    'noRawGps', true,
    'noPreciseLocation', true,
    'noProviderCredential', true,
    'humanRetentionAuthorityRequired', true,
    'providerVerificationRequiredForCompletedExecution', true,
    'legalHoldBlocksDisposal', true,
    'notFinalProofAuthority', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_has_forbidden_key(document jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  entry record;
  item jsonb;
  normalized_key text;
BEGIN
  IF jsonb_typeof(document) = 'object' THEN
    FOR entry IN SELECT key, value FROM jsonb_each(document)
    LOOP
      normalized_key := lower(regexp_replace(entry.key, '[^a-zA-Z0-9]', '', 'g'));
      IF normalized_key = ANY(ARRAY[
        'latitude', 'longitude', 'rawexif', 'rawgps', 'preciselocation',
        'providercredential', 'credential', 'privatekey', 'secret', 'accesskey',
        'accesstoken', 'refreshtoken', 'signedurl', 'uploadurl'
      ]::text[]) THEN
        RETURN true;
      END IF;
      IF evidence.e3b_has_forbidden_key(entry.value) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(document)
    LOOP
      IF evidence.e3b_has_forbidden_key(item) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_keys_are_valid(
  document jsonb,
  allowed_keys text[],
  required_keys text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_typeof(document) = 'object'
    AND document ?& required_keys
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(document) AS present_key
      WHERE NOT (present_key = ANY(allowed_keys))
    );
$$;

CREATE TABLE IF NOT EXISTS evidence.media_metadata_extraction_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  evidence_id text NOT NULL REFERENCES evidence.evidence_objects(id),
  object_id text NOT NULL REFERENCES evidence.media_object_facts(id),
  actor_id text NOT NULL REFERENCES identity.participants(id),
  extraction_sequence bigint NOT NULL CHECK (extraction_sequence > 0),
  evidence_sequence bigint NOT NULL CHECK (evidence_sequence > 0),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  extraction_hash text NOT NULL UNIQUE CHECK (extraction_hash ~ '^[0-9a-f]{64}$'),
  extraction_root text NOT NULL UNIQUE CHECK (extraction_root ~ '^[0-9a-f]{64}$'),
  extracted_at timestamptz NOT NULL,
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (object_id, extraction_sequence),
  UNIQUE (evidence_id, evidence_sequence),
  CHECK (fact_record->>'factType' = 'evidence_media_metadata_extraction'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->>'evidenceId' = evidence_id),
  CHECK (fact_record->>'objectId' = object_id),
  CHECK (fact_record->'agent'->>'id' = actor_id),
  CHECK ((fact_record->>'extractionSequence')::bigint = extraction_sequence),
  CHECK ((fact_record->>'evidenceSequence')::bigint = evidence_sequence),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK (fact_record->>'extractionHash' = extraction_hash),
  CHECK (fact_record->>'extractionRoot' = extraction_root),
  CHECK ((fact_record->>'extractedAt')::timestamptz = extracted_at),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE INDEX IF NOT EXISTS evidence_e3b_metadata_org_time
  ON evidence.media_metadata_extraction_facts (organization_id, extracted_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS evidence_e3b_metadata_evidence_sequence
  ON evidence.media_metadata_extraction_facts (evidence_id, evidence_sequence, id);

CREATE TABLE IF NOT EXISTS evidence.retention_decision_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  evidence_id text NOT NULL REFERENCES evidence.evidence_objects(id),
  subject_id text NOT NULL REFERENCES identity.participants(id),
  source_type text NOT NULL CHECK (source_type IN ('media_object', 'metadata_extraction')),
  source_id text NOT NULL,
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  actor_id text NOT NULL REFERENCES identity.participants(id),
  decision_sequence bigint NOT NULL CHECK (decision_sequence > 0),
  evidence_sequence bigint NOT NULL CHECK (evidence_sequence > 0),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  decision_hash text NOT NULL UNIQUE CHECK (decision_hash ~ '^[0-9a-f]{64}$'),
  decision_root text NOT NULL UNIQUE CHECK (decision_root ~ '^[0-9a-f]{64}$'),
  evaluated_at timestamptz NOT NULL,
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (source_type, source_id, decision_sequence),
  UNIQUE (evidence_id, evidence_sequence),
  CHECK (fact_record->>'factType' = 'evidence_retention_decision'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->>'evidenceId' = evidence_id),
  CHECK (fact_record->>'subjectId' = subject_id),
  CHECK (fact_record->>'sourceType' = source_type),
  CHECK (fact_record->>'sourceId' = source_id),
  CHECK (fact_record->>'sourceRoot' = source_root),
  CHECK (fact_record->>'decidedBy' = actor_id),
  CHECK ((fact_record->>'decisionSequence')::bigint = decision_sequence),
  CHECK ((fact_record->>'evidenceSequence')::bigint = evidence_sequence),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK (fact_record->>'decisionHash' = decision_hash),
  CHECK (fact_record->>'decisionRoot' = decision_root),
  CHECK ((fact_record->>'evaluatedAt')::timestamptz = evaluated_at),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE INDEX IF NOT EXISTS evidence_e3b_decision_org_time
  ON evidence.retention_decision_facts (organization_id, evaluated_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS evidence_e3b_decision_evidence_sequence
  ON evidence.retention_decision_facts (evidence_id, evidence_sequence, id);

CREATE TABLE IF NOT EXISTS evidence.retention_execution_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  evidence_id text NOT NULL REFERENCES evidence.evidence_objects(id),
  subject_id text NOT NULL REFERENCES identity.participants(id),
  source_type text NOT NULL CHECK (source_type IN ('media_object', 'metadata_extraction')),
  source_id text NOT NULL,
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  decision_id text NOT NULL REFERENCES evidence.retention_decision_facts(id),
  actor_id text NOT NULL REFERENCES identity.participants(id),
  execution_sequence bigint NOT NULL CHECK (execution_sequence > 0),
  evidence_sequence bigint NOT NULL CHECK (evidence_sequence > 0),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  execution_hash text NOT NULL UNIQUE CHECK (execution_hash ~ '^[0-9a-f]{64}$'),
  execution_root text NOT NULL UNIQUE CHECK (execution_root ~ '^[0-9a-f]{64}$'),
  executed_at timestamptz NOT NULL,
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (source_type, source_id, execution_sequence),
  UNIQUE (evidence_id, evidence_sequence),
  CHECK (fact_record->>'factType' = 'evidence_retention_execution'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->>'evidenceId' = evidence_id),
  CHECK (fact_record->>'subjectId' = subject_id),
  CHECK (fact_record->>'sourceType' = source_type),
  CHECK (fact_record->>'sourceId' = source_id),
  CHECK (fact_record->>'sourceRoot' = source_root),
  CHECK (fact_record->>'decisionId' = decision_id),
  CHECK (fact_record->'agent'->>'id' = actor_id),
  CHECK ((fact_record->>'executionSequence')::bigint = execution_sequence),
  CHECK ((fact_record->>'evidenceSequence')::bigint = evidence_sequence),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK (fact_record->>'executionHash' = execution_hash),
  CHECK (fact_record->>'executionRoot' = execution_root),
  CHECK ((fact_record->>'executedAt')::timestamptz = executed_at),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE INDEX IF NOT EXISTS evidence_e3b_execution_org_time
  ON evidence.retention_execution_facts (organization_id, executed_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS evidence_e3b_execution_evidence_sequence
  ON evidence.retention_execution_facts (evidence_id, evidence_sequence, id);

CREATE OR REPLACE FUNCTION evidence.e3b_metadata_command_seed(record jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT record - ARRAY[
    'factType', 'id', 'commandHash', 'evidenceSequence', 'previousEventRoot',
    'extractionHash', 'extractionRoot', 'safety', 'auditEvent'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_metadata_command_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-evidence-metadata-extraction-command-v1') ||
    evidence.e3b_metadata_command_seed(record)
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_metadata_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-evidence-metadata-extraction-v1') ||
    (record - ARRAY['factType', 'extractionHash', 'extractionRoot', 'safety', 'auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_metadata_root(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-evidence-metadata-extraction-root-v1',
    'objectRoot', record->>'objectRoot',
    'mediaProjectionRoot', record->>'mediaProjectionRoot',
    'consentReceiptRoot', record->>'consentReceiptRoot',
    'deviceAttestationRoot', record->>'deviceAttestationRoot',
    'metadataOutputRoot', record->>'metadataOutputRoot',
    'extractionSequence', (record->>'extractionSequence')::bigint,
    'previousExtractionRoot', record->>'previousExtractionRoot',
    'commandHash', record->>'commandHash',
    'extractionHash', record->>'extractionHash',
    'evidenceSequence', (record->>'evidenceSequence')::bigint,
    'previousEventRoot', record->>'previousEventRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_metadata_genesis(target_object_id text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-evidence-metadata-extraction-genesis-v1',
    'objectId', target_object_id
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_decision_command_seed(record jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT record - ARRAY[
    'factType', 'id', 'commandHash', 'evidenceSequence', 'previousEventRoot',
    'decisionHash', 'decisionRoot', 'safety', 'auditEvent'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_decision_command_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-evidence-retention-decision-command-v1') ||
    evidence.e3b_decision_command_seed(record)
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_decision_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-evidence-retention-decision-v1') ||
    (record - ARRAY['factType', 'decisionHash', 'decisionRoot', 'safety', 'auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_decision_root(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-evidence-retention-decision-root-v1',
    'sourceType', record->>'sourceType',
    'sourceRoot', record->>'sourceRoot',
    'consentReceiptRoot', record->>'consentReceiptRoot',
    'consentProjectionRoot', record->>'consentProjectionRoot',
    'disposition', record->>'disposition',
    'decisionSequence', (record->>'decisionSequence')::bigint,
    'previousDecisionRoot', record->>'previousDecisionRoot',
    'deciderAuthorityRoot', record->'decider'->>'authorityRoot',
    'commandHash', record->>'commandHash',
    'decisionHash', record->>'decisionHash',
    'evidenceSequence', (record->>'evidenceSequence')::bigint,
    'previousEventRoot', record->>'previousEventRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_decision_genesis(
  target_source_type text,
  target_source_id text,
  target_source_root text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-evidence-retention-decision-genesis-v1',
    'sourceType', target_source_type,
    'sourceId', target_source_id,
    'sourceRoot', target_source_root
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_execution_command_seed(record jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT record - ARRAY[
    'factType', 'id', 'commandHash', 'evidenceSequence', 'previousEventRoot',
    'executionHash', 'executionRoot', 'safety', 'auditEvent'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_execution_command_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-evidence-retention-execution-command-v1') ||
    evidence.e3b_execution_command_seed(record)
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_execution_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-evidence-retention-execution-v1') ||
    (record - ARRAY['factType', 'executionHash', 'executionRoot', 'safety', 'auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_execution_root(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-evidence-retention-execution-root-v1',
    'sourceType', record->>'sourceType',
    'sourceRoot', record->>'sourceRoot',
    'decisionRoot', record->>'decisionRoot',
    'operation', record->>'operation',
    'result', record->>'result',
    'providerVerificationState', record->>'providerVerificationState',
    'resultingRoot', record->>'resultingRoot',
    'executionSequence', (record->>'executionSequence')::bigint,
    'previousExecutionRoot', record->>'previousExecutionRoot',
    'commandHash', record->>'commandHash',
    'executionHash', record->>'executionHash',
    'evidenceSequence', (record->>'evidenceSequence')::bigint,
    'previousEventRoot', record->>'previousEventRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_execution_genesis(
  target_source_type text,
  target_source_id text,
  target_source_root text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-evidence-retention-execution-genesis-v1',
    'sourceType', target_source_type,
    'sourceId', target_source_id,
    'sourceRoot', target_source_root
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e3b_payload_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(record - 'auditEvent');
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e3b_metadata_fact_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  object_fact evidence.media_object_facts%ROWTYPE;
  intent evidence.media_upload_intent_facts%ROWTYPE;
  evidence_record evidence.evidence_objects%ROWTYPE;
  consent evidence.consent_receipts%ROWTYPE;
  device identity.device_attestations%ROWTYPE;
  media_projection record;
  consent_projection record;
  device_projection record;
  semantic_event audit.domain_events%ROWTYPE;
  previous_root text;
  expected_issues text[] := ARRAY['metadata_provider_verification_pending']::text[];
  expected_location_hash boolean;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');

  SELECT * INTO STRICT object_fact
  FROM evidence.media_object_facts
  WHERE id = NEW.object_id
  FOR SHARE;
  SELECT * INTO STRICT intent
  FROM evidence.media_upload_intent_facts
  WHERE id = object_fact.intent_id
  FOR SHARE;
  SELECT * INTO STRICT evidence_record
  FROM evidence.evidence_objects
  WHERE id = NEW.evidence_id
  FOR SHARE;
  SELECT * INTO STRICT consent
  FROM evidence.consent_receipts
  WHERE id = intent.consent_receipt_id
  FOR SHARE;
  SELECT * INTO STRICT device
  FROM identity.device_attestations
  WHERE id = intent.device_attestation_id
  FOR SHARE;
  SELECT * INTO STRICT media_projection
  FROM evidence.effective_media_object_projection(NEW.object_id, NEW.extracted_at);
  SELECT * INTO STRICT consent_projection
  FROM evidence.consent_receipt_projection(consent.id, NEW.extracted_at);
  SELECT * INTO STRICT device_projection
  FROM evidence.effective_device_attestation_projection(device.id, NEW.extracted_at);
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events
  WHERE event_root = NEW.audit_event_root;

  IF media_projection.state <> 'available' THEN
    expected_issues := array_append(expected_issues, 'media_custody_verification_pending');
  END IF;
  IF device_projection.state <> 'current' THEN
    expected_issues := array_append(expected_issues, 'device_attestation_verification_pending');
  END IF;
  IF NEW.fact_record->>'accuracyBand' IN ('over_50m', 'unknown') THEN
    expected_issues := array_append(expected_issues, 'gps_accuracy_needs_review');
  END IF;
  IF NEW.fact_record->>'clockSkewBand' = 'over_5m' THEN
    expected_issues := array_append(expected_issues, 'device_clock_skew_needs_review');
  END IF;
  SELECT COALESCE(array_agg(value ORDER BY value), ARRAY[]::text[])
  INTO expected_issues
  FROM unnest(expected_issues) AS value;

  SELECT candidate.extraction_root INTO previous_root
  FROM evidence.media_metadata_extraction_facts candidate
  WHERE candidate.object_id = NEW.object_id
  ORDER BY candidate.extraction_sequence DESC, candidate.id DESC
  LIMIT 1;
  previous_root := COALESCE(previous_root, evidence.e3b_metadata_genesis(NEW.object_id));
  expected_location_hash := NEW.fact_record->>'locationDisclosure' <> 'none';

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.actor_id
     OR transaction_organization_id <> NEW.organization_id
     OR evidence.e3b_has_forbidden_key(NEW.fact_record)
     OR NOT evidence.e3b_keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','objectId','objectRoot',
         'mediaProjectionState','mediaProjectionRoot','subjectId','consentReceiptId',
         'consentReceiptRoot','consentProjectionRoot','deviceAttestationId',
         'deviceAttestationRoot','deviceProjectionRoot','privacyMode','extractorName',
         'extractorVersion','extractorImageDigest','metadataSchemaVersion','exifHash','gpsHash',
         'metadataOutputRoot','locationDisclosure','generalizedLocationHash','accuracyBand',
         'clockSkewBand','issueCodes','extractionState','providerReceiptHash',
         'providerVerificationState','observedAt','extractedAt','agent','extractionSequence',
         'previousExtractionRoot','commandHash','evidenceSequence','previousEventRoot',
         'extractionHash','extractionRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','objectId','objectRoot',
         'mediaProjectionState','mediaProjectionRoot','subjectId','consentReceiptId',
         'consentReceiptRoot','consentProjectionRoot','deviceAttestationId',
         'deviceAttestationRoot','deviceProjectionRoot','privacyMode','extractorName',
         'extractorVersion','extractorImageDigest','metadataSchemaVersion','exifHash','gpsHash',
         'metadataOutputRoot','locationDisclosure','accuracyBand','clockSkewBand','issueCodes',
         'extractionState','providerReceiptHash','providerVerificationState','observedAt',
         'extractedAt','agent','extractionSequence','previousExtractionRoot','commandHash',
         'evidenceSequence','previousEventRoot','extractionHash','extractionRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.organization_id <> object_fact.organization_id
     OR NEW.project_id <> object_fact.project_id
     OR NEW.evidence_id <> object_fact.evidence_id
     OR NEW.fact_record->>'objectRoot' <> object_fact.object_root
     OR evidence_record.organization_id <> NEW.organization_id
     OR evidence_record.project_id <> NEW.project_id
     OR NEW.fact_record->>'gpsHash' <> evidence_record.gps_hash
     OR NEW.fact_record->>'subjectId' <> intent.subject_id
     OR NEW.fact_record->>'consentReceiptId' <> consent.id
     OR NEW.fact_record->>'consentReceiptRoot' <> consent.receipt_root
     OR NEW.fact_record->>'consentProjectionRoot' <> consent_projection.projection_root
     OR NEW.fact_record->>'deviceAttestationId' <> device.id
     OR NEW.fact_record->>'deviceAttestationRoot' <> device.attestation_root
     OR NEW.fact_record->>'deviceProjectionRoot' <> device_projection.projection_root
     OR NEW.fact_record->>'privacyMode' <> consent.privacy_mode
     OR NEW.fact_record->>'mediaProjectionState' <> media_projection.state
     OR NEW.fact_record->>'mediaProjectionRoot' <> media_projection.projection_root
     OR media_projection.state NOT IN ('available', 'needs_review')
     OR consent_projection.state <> 'active'
     OR device_projection.state NOT IN ('current', 'needs_review')
     OR NOT ('media_upload' = ANY(consent.purposes))
     OR NOT ('geolocation' = ANY(consent.purposes))
     OR NEW.fact_record->>'providerVerificationState' <> 'modeled_only'
     OR NEW.fact_record->>'extractionState' <> 'needs_review'
     OR NEW.fact_record->'issueCodes' <> to_jsonb(expected_issues)
     OR NEW.fact_record->>'accuracyBand' NOT IN ('under_10m','10_to_50m','over_50m','unknown')
     OR NEW.fact_record->>'clockSkewBand' NOT IN ('under_1m','1_to_5m','over_5m','unknown')
     OR NEW.fact_record->>'locationDisclosure' NOT IN ('none','region_hash','coarse_cell_hash')
     OR expected_location_hash <> (NEW.fact_record ? 'generalizedLocationHash')
     OR (NEW.fact_record ? 'generalizedLocationHash'
       AND NEW.fact_record->>'generalizedLocationHash' !~ '^[0-9a-f]{64}$')
     OR (consent.privacy_mode = 'restricted' AND NEW.fact_record->>'locationDisclosure' <> 'none')
     OR (consent.privacy_mode = 'masked' AND NEW.fact_record->>'locationDisclosure' = 'coarse_cell_hash')
     OR NEW.fact_record->>'exifHash' !~ '^[0-9a-f]{64}$'
     OR NEW.fact_record->>'gpsHash' !~ '^[0-9a-f]{64}$'
     OR NEW.fact_record->>'metadataOutputRoot' !~ '^[0-9a-f]{64}$'
     OR NEW.fact_record->>'providerReceiptHash' !~ '^[0-9a-f]{64}$'
     OR NEW.fact_record->>'extractorImageDigest' !~ '^[0-9a-f]{64}$'
     OR NOT evidence.evidence_media_safe_material(ARRAY[
       NEW.fact_record->>'extractorName',
       NEW.fact_record->>'extractorVersion',
       NEW.fact_record->>'metadataSchemaVersion'
     ])
     OR (NEW.fact_record->>'observedAt')::timestamptz > NEW.extracted_at
     OR NEW.extracted_at <> date_trunc('milliseconds', NEW.extracted_at)
     OR (NEW.fact_record->>'observedAt')::timestamptz < object_fact.stored_at - interval '365 days'
     OR NEW.extraction_sequence <> COALESCE((
       SELECT max(candidate.extraction_sequence) + 1
       FROM evidence.media_metadata_extraction_facts candidate
       WHERE candidate.object_id = NEW.object_id
     ), 1)
     OR NEW.fact_record->>'previousExtractionRoot' <> previous_root
     OR NEW.fact_record->'safety' <> evidence.e3b_safety_canonical()
     OR NOT evidence.evidence_media_agent_is_valid(
       NEW.fact_record->'agent', NEW.organization_id, 'metadata_extraction_receipt'
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_METADATA_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-media:' || NEW.evidence_id
     OR semantic_event.sequence_no <> NEW.evidence_sequence
     OR semantic_event.action <> 'REASON'
     OR semantic_event.actor_id <> NEW.actor_id
     OR semantic_event.entity_type <> 'media_metadata_extraction'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.fact_record->>'previousEventRoot'
     OR semantic_event.created_at <> NEW.extracted_at
     OR semantic_event.payload_hash <> evidence.e3b_payload_hash(NEW.fact_record)
     OR semantic_event.rationale <>
       'A minimized metadata extraction receipt was appended without raw EXIF, GPS, or location data.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_METADATA_EVENT_INVALID';
  END IF;

  IF NEW.command_hash <> evidence.e3b_metadata_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_media_metadata_' || left(NEW.command_hash, 24)
     OR NEW.extraction_hash <> evidence.e3b_metadata_hash(NEW.fact_record)
     OR NEW.extraction_root <> evidence.e3b_metadata_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_METADATA_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e3b_retention_decision_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  object_fact evidence.media_object_facts%ROWTYPE;
  metadata_fact evidence.media_metadata_extraction_facts%ROWTYPE;
  intent evidence.media_upload_intent_facts%ROWTYPE;
  consent evidence.consent_receipts%ROWTYPE;
  consent_projection record;
  semantic_event audit.domain_events%ROWTYPE;
  previous_decision evidence.retention_decision_facts%ROWTYPE;
  expected_source_root text;
  expected_previous_root text;
  expected_action text;
  retention_deadline timestamptz;
  retain_until timestamptz;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');

  IF NEW.source_type = 'media_object' THEN
    SELECT * INTO STRICT object_fact
    FROM evidence.media_object_facts
    WHERE id = NEW.source_id
    FOR SHARE;
    expected_source_root := object_fact.object_root;
  ELSE
    SELECT * INTO STRICT metadata_fact
    FROM evidence.media_metadata_extraction_facts
    WHERE id = NEW.source_id
    FOR SHARE;
    SELECT * INTO STRICT object_fact
    FROM evidence.media_object_facts
    WHERE id = metadata_fact.object_id
    FOR SHARE;
    expected_source_root := metadata_fact.extraction_root;
  END IF;
  SELECT * INTO STRICT intent
  FROM evidence.media_upload_intent_facts
  WHERE id = object_fact.intent_id
  FOR SHARE;
  SELECT * INTO STRICT consent
  FROM evidence.consent_receipts
  WHERE id = intent.consent_receipt_id
  FOR SHARE;
  SELECT * INTO STRICT consent_projection
  FROM evidence.consent_receipt_projection(consent.id, NEW.evaluated_at);
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events
  WHERE event_root = NEW.audit_event_root;
  SELECT candidate.* INTO previous_decision
  FROM evidence.retention_decision_facts candidate
  WHERE candidate.source_type = NEW.source_type
    AND candidate.source_id = NEW.source_id
  ORDER BY candidate.decision_sequence DESC, candidate.id DESC
  LIMIT 1;

  expected_previous_root := COALESCE(
    previous_decision.decision_root,
    evidence.e3b_decision_genesis(NEW.source_type, NEW.source_id, NEW.source_root)
  );
  expected_action := CASE WHEN NEW.fact_record->>'disposition' = 'retain' THEN 'REASON' ELSE 'CHALLENGE' END;
  retention_deadline := consent.granted_at + consent.retention_days * interval '1 day';
  retain_until := CASE
    WHEN NEW.fact_record ? 'retainUntil' THEN (NEW.fact_record->>'retainUntil')::timestamptz
    ELSE NULL
  END;

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.actor_id
     OR transaction_organization_id <> NEW.organization_id
     OR evidence.e3b_has_forbidden_key(NEW.fact_record)
     OR NOT evidence.e3b_keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','subjectId','sourceType',
         'sourceId','sourceRoot','consentReceiptId','consentReceiptRoot',
         'consentProjectionState','consentProjectionRoot','retentionDeadline','basis',
         'disposition','retainUntil','legalHoldRoot','policyId','rationaleHash','decidedBy',
         'decider','evaluatedAt','decisionSequence','previousDecisionRoot','commandHash',
         'evidenceSequence','previousEventRoot','decisionHash','decisionRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','subjectId','sourceType',
         'sourceId','sourceRoot','consentReceiptId','consentReceiptRoot',
         'consentProjectionState','consentProjectionRoot','retentionDeadline','basis',
         'disposition','policyId','rationaleHash','decidedBy','decider','evaluatedAt',
         'decisionSequence','previousDecisionRoot','commandHash','evidenceSequence',
         'previousEventRoot','decisionHash','decisionRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.source_root <> expected_source_root
     OR NEW.organization_id <> object_fact.organization_id
     OR NEW.project_id <> object_fact.project_id
     OR NEW.evidence_id <> object_fact.evidence_id
     OR NEW.subject_id <> intent.subject_id
     OR NEW.fact_record->>'consentReceiptId' <> consent.id
     OR NEW.fact_record->>'consentReceiptRoot' <> consent.receipt_root
     OR NEW.fact_record->>'consentProjectionState' <> consent_projection.state
     OR NEW.fact_record->>'consentProjectionRoot' <> consent_projection.projection_root
     OR (NEW.fact_record->>'retentionDeadline')::timestamptz <> retention_deadline
     OR NEW.fact_record->>'basis' NOT IN (
       'consent_retention','expired_consent','revoked_consent','data_minimization','safety_review','legal_hold'
     )
     OR NEW.fact_record->>'disposition' NOT IN (
       'retain','minimize','tombstone_after_retention','legal_hold'
     )
     OR ((NEW.fact_record->>'disposition' = 'legal_hold') <> (NEW.fact_record ? 'legalHoldRoot'))
     OR (NEW.fact_record ? 'legalHoldRoot' AND NEW.fact_record->>'legalHoldRoot' !~ '^[0-9a-f]{64}$')
     OR (NEW.fact_record->>'disposition' <> 'legal_hold' AND NOT (NEW.fact_record ? 'retainUntil'))
     OR (NEW.fact_record->>'disposition' = 'legal_hold' AND NEW.fact_record ? 'retainUntil')
     OR (retain_until IS NOT NULL AND retain_until <> date_trunc('milliseconds', retain_until))
     OR (NEW.fact_record->>'basis' = 'revoked_consent' AND consent_projection.state <> 'revoked')
     OR (NEW.fact_record->>'basis' = 'expired_consent' AND consent_projection.state <> 'expired')
     OR ((NEW.fact_record->>'basis' = 'legal_hold') <> (NEW.fact_record->>'disposition' = 'legal_hold'))
     OR (NEW.fact_record->>'disposition' = 'retain' AND consent_projection.state <> 'active')
     OR (NEW.fact_record->>'disposition' = 'retain' AND retain_until > retention_deadline)
     OR (
       NEW.fact_record->>'basis' = 'consent_retention'
       AND NEW.fact_record->>'disposition' = 'tombstone_after_retention'
       AND NEW.evaluated_at < retention_deadline
     )
     OR (
       previous_decision.id IS NOT NULL
       AND previous_decision.fact_record->>'disposition' = 'legal_hold'
       AND NEW.fact_record->>'disposition' <> 'legal_hold'
     )
     OR NEW.fact_record->>'rationaleHash' !~ '^[0-9a-f]{64}$'
     OR NOT evidence.evidence_media_safe_material(ARRAY[NEW.fact_record->>'policyId'])
     OR NEW.evaluated_at <> date_trunc('milliseconds', NEW.evaluated_at)
     OR NEW.decision_sequence <> COALESCE(previous_decision.decision_sequence + 1, 1)
     OR NEW.fact_record->>'previousDecisionRoot' <> expected_previous_root
     OR NEW.fact_record->'safety' <> evidence.e3b_safety_canonical()
     OR NEW.fact_record->'decider'->>'id' <> NEW.actor_id
     OR NEW.fact_record->'decider'->>'role' NOT IN ('owner','admin','verifier')
     OR NEW.fact_record->'decider'->>'accreditationStatus' <> 'approved'
     OR NOT (NEW.fact_record->'decider'->'accreditationScope' ? 'evidence_retention_governance')
     OR NOT verification.actor_snapshot_is_valid(
       NEW.fact_record->'decider', NEW.actor_id, NEW.organization_id,
       'human', ARRAY['owner','admin','verifier']::text[]
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_RETENTION_DECISION_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-media:' || NEW.evidence_id
     OR semantic_event.sequence_no <> NEW.evidence_sequence
     OR semantic_event.action <> expected_action
     OR semantic_event.actor_id <> NEW.actor_id
     OR semantic_event.entity_type <> 'retention_policy_decision'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.fact_record->>'previousEventRoot'
     OR semantic_event.created_at <> NEW.evaluated_at
     OR semantic_event.payload_hash <> evidence.e3b_payload_hash(NEW.fact_record)
     OR semantic_event.rationale <>
       'A human-authorized retention decision was appended without mutating source evidence.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_RETENTION_DECISION_EVENT_INVALID';
  END IF;

  IF NEW.command_hash <> evidence.e3b_decision_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_retention_decision_' || left(NEW.command_hash, 24)
     OR NEW.decision_hash <> evidence.e3b_decision_hash(NEW.fact_record)
     OR NEW.decision_root <> evidence.e3b_decision_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_RETENTION_DECISION_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e3b_retention_execution_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  decision_fact evidence.retention_decision_facts%ROWTYPE;
  latest_decision evidence.retention_decision_facts%ROWTYPE;
  previous_execution evidence.retention_execution_facts%ROWTYPE;
  object_fact evidence.media_object_facts%ROWTYPE;
  metadata_fact evidence.media_metadata_extraction_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  expected_source_root text;
  expected_previous_root text;
  expected_operation text;
  expected_action text;
  decision_retain_until timestamptz;
  reason_hashes text[];
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT decision_fact
  FROM evidence.retention_decision_facts
  WHERE id = NEW.decision_id
  FOR SHARE;
  SELECT candidate.* INTO STRICT latest_decision
  FROM evidence.retention_decision_facts candidate
  WHERE candidate.source_type = NEW.source_type
    AND candidate.source_id = NEW.source_id
  ORDER BY candidate.decision_sequence DESC, candidate.id DESC
  LIMIT 1;
  IF NEW.source_type = 'media_object' THEN
    SELECT * INTO STRICT object_fact
    FROM evidence.media_object_facts
    WHERE id = NEW.source_id
    FOR SHARE;
    expected_source_root := object_fact.object_root;
  ELSE
    SELECT * INTO STRICT metadata_fact
    FROM evidence.media_metadata_extraction_facts
    WHERE id = NEW.source_id
    FOR SHARE;
    SELECT * INTO STRICT object_fact
    FROM evidence.media_object_facts
    WHERE id = metadata_fact.object_id
    FOR SHARE;
    expected_source_root := metadata_fact.extraction_root;
  END IF;
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events
  WHERE event_root = NEW.audit_event_root;
  SELECT candidate.* INTO previous_execution
  FROM evidence.retention_execution_facts candidate
  WHERE candidate.source_type = NEW.source_type
    AND candidate.source_id = NEW.source_id
  ORDER BY candidate.execution_sequence DESC, candidate.id DESC
  LIMIT 1;

  expected_previous_root := COALESCE(
    previous_execution.execution_root,
    evidence.e3b_execution_genesis(NEW.source_type, NEW.source_id, NEW.source_root)
  );
  expected_operation := CASE decision_fact.fact_record->>'disposition'
    WHEN 'tombstone_after_retention' THEN 'tombstone'
    WHEN 'legal_hold' THEN 'apply_legal_hold'
    ELSE decision_fact.fact_record->>'disposition'
  END;
  expected_action := CASE
    WHEN NEW.fact_record->>'result' <> 'completed' THEN 'CHALLENGE'
    ELSE 'REASON'
  END;
  decision_retain_until := CASE
    WHEN decision_fact.fact_record ? 'retainUntil'
      THEN (decision_fact.fact_record->>'retainUntil')::timestamptz
    ELSE NULL
  END;
  SELECT COALESCE(array_agg(value ORDER BY value), ARRAY[]::text[])
  INTO reason_hashes
  FROM jsonb_array_elements_text(NEW.fact_record->'reasonHashes') AS value;

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.actor_id
     OR transaction_organization_id <> NEW.organization_id
     OR evidence.e3b_has_forbidden_key(NEW.fact_record)
     OR NOT evidence.e3b_keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','subjectId','sourceType',
         'sourceId','sourceRoot','decisionId','decisionRoot','operation','result','storageProvider',
         'providerNamespace','providerReceiptHash','providerVerificationState','resultingRoot',
         'reasonHashes','executedAt','agent','executionSequence','previousExecutionRoot',
         'commandHash','evidenceSequence','previousEventRoot','executionHash','executionRoot',
         'safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','subjectId','sourceType',
         'sourceId','sourceRoot','decisionId','decisionRoot','operation','result','storageProvider',
         'providerNamespace','providerReceiptHash','providerVerificationState','resultingRoot',
         'reasonHashes','executedAt','agent','executionSequence','previousExecutionRoot',
         'commandHash','evidenceSequence','previousEventRoot','executionHash','executionRoot',
         'safety','auditEvent'
       ]::text[]
     )
     OR latest_decision.id <> decision_fact.id
     OR NEW.source_root <> expected_source_root
     OR NEW.source_type <> decision_fact.source_type
     OR NEW.source_id <> decision_fact.source_id
     OR NEW.source_root <> decision_fact.source_root
     OR NEW.organization_id <> decision_fact.organization_id
     OR NEW.project_id <> decision_fact.project_id
     OR NEW.evidence_id <> decision_fact.evidence_id
     OR NEW.subject_id <> decision_fact.subject_id
     OR NEW.fact_record->>'decisionRoot' <> decision_fact.decision_root
     OR NEW.fact_record->>'operation' <> expected_operation
     OR NEW.fact_record->>'operation' NOT IN ('retain','minimize','tombstone','apply_legal_hold')
     OR NEW.fact_record->>'result' NOT IN ('completed','blocked','failed')
     OR NEW.fact_record->>'storageProvider' NOT IN ('cloudflare_r2','s3','gcs','ipfs_archive')
     OR NEW.fact_record->>'providerVerificationState' <> 'modeled_only'
     OR NEW.fact_record->>'providerReceiptHash' !~ '^[0-9a-f]{64}$'
     OR NEW.fact_record->>'resultingRoot' !~ '^[0-9a-f]{64}$'
     OR NOT evidence.evidence_media_safe_material(ARRAY[NEW.fact_record->>'providerNamespace'])
     OR jsonb_typeof(NEW.fact_record->'reasonHashes') <> 'array'
     OR jsonb_array_length(NEW.fact_record->'reasonHashes') > 32
     OR reason_hashes <> ARRAY(
       SELECT value
       FROM jsonb_array_elements_text(NEW.fact_record->'reasonHashes') AS value
     )
     OR EXISTS (SELECT 1 FROM unnest(reason_hashes) AS value WHERE value !~ '^[0-9a-f]{64}$')
     OR (NEW.fact_record->>'result' = 'completed' AND cardinality(reason_hashes) <> 0)
     OR (NEW.fact_record->>'result' <> 'completed' AND cardinality(reason_hashes) = 0)
     OR NEW.executed_at < decision_fact.evaluated_at
     OR NEW.executed_at <> date_trunc('milliseconds', NEW.executed_at)
     OR (
       NEW.fact_record->>'result' = 'completed'
       AND NEW.fact_record->>'operation' = 'tombstone'
       AND (
         (decision_retain_until IS NOT NULL AND NEW.executed_at < decision_retain_until)
         OR (object_fact.retain_until IS NOT NULL AND NEW.executed_at < object_fact.retain_until)
       )
     )
     OR NEW.execution_sequence <> COALESCE(previous_execution.execution_sequence + 1, 1)
     OR NEW.fact_record->>'previousExecutionRoot' <> expected_previous_root
     OR NEW.fact_record->'safety' <> evidence.e3b_safety_canonical()
     OR NOT evidence.evidence_media_agent_is_valid(
       NEW.fact_record->'agent', NEW.organization_id, 'retention_execution_receipt'
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_RETENTION_EXECUTION_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-media:' || NEW.evidence_id
     OR semantic_event.sequence_no <> NEW.evidence_sequence
     OR semantic_event.action <> expected_action
     OR semantic_event.actor_id <> NEW.actor_id
     OR semantic_event.entity_type <> 'evidence_media_retention_execution'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.fact_record->>'previousEventRoot'
     OR semantic_event.created_at <> NEW.executed_at
     OR semantic_event.payload_hash <> evidence.e3b_payload_hash(NEW.fact_record)
     OR semantic_event.rationale <>
       'A provider execution receipt was appended; source evidence history remains immutable.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_RETENTION_EXECUTION_EVENT_INVALID';
  END IF;

  IF NEW.command_hash <> evidence.e3b_execution_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_retention_execution_' || left(NEW.command_hash, 24)
     OR NEW.execution_hash <> evidence.e3b_execution_hash(NEW.fact_record)
     OR NEW.execution_root <> evidence.e3b_execution_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_RETENTION_EXECUTION_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidence_e3b_metadata_validate
  ON evidence.media_metadata_extraction_facts;
CREATE TRIGGER evidence_e3b_metadata_validate
BEFORE INSERT ON evidence.media_metadata_extraction_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e3b_metadata_fact_insert();

DROP TRIGGER IF EXISTS evidence_e3b_decision_validate
  ON evidence.retention_decision_facts;
CREATE TRIGGER evidence_e3b_decision_validate
BEFORE INSERT ON evidence.retention_decision_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e3b_retention_decision_insert();

DROP TRIGGER IF EXISTS evidence_e3b_execution_validate
  ON evidence.retention_execution_facts;
CREATE TRIGGER evidence_e3b_execution_validate
BEFORE INSERT ON evidence.retention_execution_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e3b_retention_execution_insert();

DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'media_metadata_extraction_facts',
    'retention_decision_facts',
    'retention_execution_facts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON evidence.%I', relation_name || '_append_only', relation_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON evidence.%I FOR EACH ROW EXECUTE FUNCTION evidence.e3b_reject_mutation()',
      relation_name || '_append_only', relation_name
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS evidence_e3b_metadata_audit
  ON evidence.media_metadata_extraction_facts;
CREATE TRIGGER evidence_e3b_metadata_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.media_metadata_extraction_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS evidence_e3b_decision_audit
  ON evidence.retention_decision_facts;
CREATE TRIGGER evidence_e3b_decision_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.retention_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS evidence_e3b_execution_audit
  ON evidence.retention_execution_facts;
CREATE TRIGGER evidence_e3b_execution_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.retention_execution_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE evidence.media_metadata_extraction_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.media_metadata_extraction_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence.retention_decision_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.retention_decision_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence.retention_execution_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.retention_execution_facts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_e3b_metadata_tenant ON evidence.media_metadata_extraction_facts;
CREATE POLICY evidence_e3b_metadata_tenant ON evidence.media_metadata_extraction_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS evidence_e3b_decision_tenant ON evidence.retention_decision_facts;
CREATE POLICY evidence_e3b_decision_tenant ON evidence.retention_decision_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS evidence_e3b_execution_tenant ON evidence.retention_execution_facts;
CREATE POLICY evidence_e3b_execution_tenant ON evidence.retention_execution_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));
