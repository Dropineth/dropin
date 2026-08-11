-- CanopyProof Evidence Protocol E4 durable authority.
-- Apply after canopyproof-os.sql and evidence-device-attestation-adapters.sql.
-- This migration is additive and route-closed.

CREATE OR REPLACE FUNCTION evidence.e4_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CANOPYPROOF_E4_APPEND_ONLY_VIOLATION: %.% cannot be updated or deleted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.e4_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'appendOnly', true,
    'organizationBound', true,
    'projectBound', true,
    'evidenceBound', true,
    'consentBound', true,
    'deviceBound', true,
    'semanticEventBound', true,
    'exactRetryRequired', true,
    'clientSequenceBound', true,
    'localClockAdvisoryOnly', true,
    'rawPayloadExcluded', true,
    'rawLocationExcluded', true,
    'rawCommunityNoteExcluded', true,
    'rawContactDataExcluded', true,
    'selfAttestationRejected', true,
    'oneAttestationPerActorEvidence', true,
    'communityAttestationNonFinal', true,
    'communityCannotMutateVerification', true,
    'humanReviewRequiredForChallenge', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e4_has_forbidden_key(document jsonb)
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
        'latitude', 'longitude', 'preciselocation', 'rawlocation', 'rawpayload',
        'rawnote', 'note', 'contact', 'email', 'phone', 'address',
        'idempotencykey', 'providercredential', 'credential', 'privatekey',
        'secret', 'accesskey', 'accesstoken', 'refreshtoken', 'signedurl',
        'uploadurl'
      ]::text[]) THEN
        RETURN true;
      END IF;
      IF evidence.e4_has_forbidden_key(entry.value) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(document)
    LOOP
      IF evidence.e4_has_forbidden_key(item) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.e4_keys_are_valid(
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

CREATE TABLE IF NOT EXISTS evidence.offline_sync_batch_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  subject_id text NOT NULL REFERENCES identity.participants(id),
  device_attestation_id text NOT NULL REFERENCES identity.device_attestations(id),
  actor_id text NOT NULL REFERENCES identity.participants(id),
  client_batch_id text NOT NULL,
  device_sequence bigint NOT NULL CHECK (device_sequence > 0),
  stream_sequence bigint NOT NULL CHECK (stream_sequence > 0),
  item_count integer NOT NULL CHECK (item_count > 0 AND item_count <= 100),
  batch_state text NOT NULL CHECK (batch_state IN ('reconciled', 'needs_review')),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  manifest_root text NOT NULL CHECK (manifest_root ~ '^[0-9a-f]{64}$'),
  batch_hash text NOT NULL UNIQUE CHECK (batch_hash ~ '^[0-9a-f]{64}$'),
  batch_root text NOT NULL UNIQUE CHECK (batch_root ~ '^[0-9a-f]{64}$'),
  received_at timestamptz NOT NULL,
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (device_attestation_id, client_batch_id),
  UNIQUE (device_attestation_id, device_sequence),
  UNIQUE (device_attestation_id, stream_sequence),
  CHECK (fact_record->>'factType' = 'evidence_offline_sync_batch'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->>'subjectId' = subject_id),
  CHECK (fact_record->>'deviceAttestationId' = device_attestation_id),
  CHECK (fact_record->'actor'->>'id' = actor_id),
  CHECK (fact_record->>'clientBatchId' = client_batch_id),
  CHECK ((fact_record->>'deviceSequence')::bigint = device_sequence),
  CHECK ((fact_record->>'streamSequence')::bigint = stream_sequence),
  CHECK ((fact_record->>'itemCount')::integer = item_count),
  CHECK (fact_record->>'batchState' = batch_state),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK (fact_record->>'manifestRoot' = manifest_root),
  CHECK (fact_record->>'batchHash' = batch_hash),
  CHECK (fact_record->>'batchRoot' = batch_root),
  CHECK ((fact_record->>'receivedAt')::timestamptz = received_at),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE TABLE IF NOT EXISTS evidence.offline_sync_item_facts (
  id text PRIMARY KEY,
  batch_id text NOT NULL REFERENCES evidence.offline_sync_batch_facts(id)
    DEFERRABLE INITIALLY DEFERRED,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  subject_id text NOT NULL REFERENCES identity.participants(id),
  device_attestation_id text NOT NULL REFERENCES identity.device_attestations(id),
  item_index integer NOT NULL CHECK (item_index >= 0 AND item_index < 100),
  client_record_id text NOT NULL,
  evidence_id text NOT NULL REFERENCES evidence.evidence_objects(id),
  result_state text NOT NULL CHECK (result_state IN ('reconciled', 'needs_review')),
  item_hash text NOT NULL UNIQUE CHECK (item_hash ~ '^[0-9a-f]{64}$'),
  item_root text NOT NULL UNIQUE CHECK (item_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (batch_id, item_index),
  UNIQUE (batch_id, client_record_id),
  UNIQUE (batch_id, evidence_id),
  CHECK (fact_record->>'factType' = 'evidence_offline_sync_item'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'batchId' = batch_id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->>'subjectId' = subject_id),
  CHECK (fact_record->>'deviceAttestationId' = device_attestation_id),
  CHECK ((fact_record->>'itemIndex')::integer = item_index),
  CHECK (fact_record->>'clientRecordId' = client_record_id),
  CHECK (fact_record->>'evidenceId' = evidence_id),
  CHECK (fact_record->>'result' = result_state),
  CHECK (fact_record->>'itemHash' = item_hash),
  CHECK (fact_record->>'itemRoot' = item_root)
);

CREATE TABLE IF NOT EXISTS evidence.community_attestation_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  evidence_id text NOT NULL REFERENCES evidence.evidence_objects(id),
  actor_id text NOT NULL REFERENCES identity.participants(id),
  attestation_sequence bigint NOT NULL CHECK (attestation_sequence > 0),
  stream_sequence bigint NOT NULL CHECK (stream_sequence > 0),
  stance text NOT NULL CHECK (stance IN ('support', 'challenge', 'needs_review')),
  attestation_state text NOT NULL CHECK (attestation_state IN ('supporting_context', 'review_required')),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  attestation_hash text NOT NULL UNIQUE CHECK (attestation_hash ~ '^[0-9a-f]{64}$'),
  attestation_root text NOT NULL UNIQUE CHECK (attestation_root ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (evidence_id, actor_id),
  UNIQUE (evidence_id, attestation_sequence),
  UNIQUE (evidence_id, stream_sequence),
  CHECK (fact_record->>'factType' = 'evidence_community_attestation'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->>'evidenceId' = evidence_id),
  CHECK (fact_record->>'attesterId' = actor_id),
  CHECK ((fact_record->>'attestationSequence')::bigint = attestation_sequence),
  CHECK ((fact_record->>'streamSequence')::bigint = stream_sequence),
  CHECK (fact_record->>'stance' = stance),
  CHECK (fact_record->>'attestationState' = attestation_state),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK (fact_record->>'attestationHash' = attestation_hash),
  CHECK (fact_record->>'attestationRoot' = attestation_root),
  CHECK ((fact_record->>'createdAt')::timestamptz = created_at),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE INDEX IF NOT EXISTS evidence_e4_batch_org_time
  ON evidence.offline_sync_batch_facts (organization_id, received_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS evidence_e4_batch_device_sequence
  ON evidence.offline_sync_batch_facts (device_attestation_id, device_sequence, id);
CREATE INDEX IF NOT EXISTS evidence_e4_item_org_evidence
  ON evidence.offline_sync_item_facts (organization_id, evidence_id, id);
CREATE INDEX IF NOT EXISTS evidence_e4_community_org_time
  ON evidence.community_attestation_facts (organization_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS evidence_e4_community_evidence_sequence
  ON evidence.community_attestation_facts (evidence_id, attestation_sequence, id);

CREATE OR REPLACE FUNCTION evidence.e4_offline_item_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-offline-sync-item-v1') ||
    (record - ARRAY['factType','id','itemHash','itemRoot','safety']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e4_offline_item_root(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-offline-sync-item-root-v1',
    'batchCommandHash', record->>'batchCommandHash',
    'itemIndex', (record->>'itemIndex')::integer,
    'clientRecordId', record->>'clientRecordId',
    'evidenceRoot', record->>'evidenceRoot',
    'clientPayloadHash', record->>'clientPayloadHash',
    'result', record->>'result',
    'itemHash', record->>'itemHash'
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e4_offline_batch_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-offline-sync-batch-v1') ||
    (record - ARRAY['factType','batchHash','batchRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e4_offline_batch_root(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-offline-sync-batch-root-v1',
    'projectRoot', record->>'projectRoot',
    'consentReceiptRoot', record->>'consentReceiptRoot',
    'deviceAttestationRoot', record->>'deviceAttestationRoot',
    'deviceProjectionRoot', record->>'deviceProjectionRoot',
    'manifestRoot', record->>'manifestRoot',
    'deviceSequence', (record->>'deviceSequence')::bigint,
    'previousBatchRoot', record->>'previousBatchRoot',
    'commandHash', record->>'commandHash',
    'batchHash', record->>'batchHash',
    'streamSequence', (record->>'streamSequence')::bigint,
    'previousEventRoot', record->>'previousEventRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e4_offline_batch_genesis(
  target_device_id text,
  target_device_root text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-offline-sync-batch-genesis-v1',
    'deviceAttestationId', target_device_id,
    'deviceAttestationRoot', target_device_root
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e4_offline_batch_command_hash(
  record jsonb,
  item_records jsonb
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-offline-sync-batch-command-v1') ||
    jsonb_build_object(
      'organizationId', record->>'organizationId',
      'projectId', record->>'projectId',
      'projectRoot', record->>'projectRoot',
      'subjectId', record->>'subjectId',
      'consentReceiptId', record->>'consentReceiptId',
      'consentReceiptRoot', record->>'consentReceiptRoot',
      'consentProjectionRoot', record->>'consentProjectionRoot',
      'deviceAttestationId', record->>'deviceAttestationId',
      'deviceAttestationRoot', record->>'deviceAttestationRoot',
      'deviceProjectionState', record->>'deviceProjectionState',
      'deviceProjectionRoot', record->>'deviceProjectionRoot',
      'clientBatchId', record->>'clientBatchId',
      'deviceSequence', (record->>'deviceSequence')::bigint,
      'previousBatchRoot', record->>'previousBatchRoot',
      'deviceClockStartedAt', record->'deviceClockStartedAt',
      'deviceClockEndedAt', record->'deviceClockEndedAt',
      'receivedAt', record->'receivedAt',
      'connectivity', record->>'connectivity',
      'items', item_records,
      'actor', record->'actor'
    )
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e4_community_command_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-community-attestation-command-v1') ||
    (record - ARRAY[
      'factType','id','commandHash','streamSequence','previousEventRoot',
      'attestationHash','attestationRoot','safety','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e4_community_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-community-attestation-fact-v1') ||
    (record - ARRAY['factType','attestationHash','attestationRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e4_community_root(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-community-attestation-root-v1',
    'evidenceRoot', record->>'evidenceRoot',
    'attesterAuthorityRoot', record->'attester'->>'authorityRoot',
    'stance', record->>'stance',
    'noteHash', record->>'noteHash',
    'attestationSequence', (record->>'attestationSequence')::bigint,
    'previousAttestationRoot', record->>'previousAttestationRoot',
    'commandHash', record->>'commandHash',
    'attestationHash', record->>'attestationHash',
    'streamSequence', (record->>'streamSequence')::bigint,
    'previousEventRoot', record->>'previousEventRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e4_community_genesis(
  target_evidence_id text,
  target_evidence_root text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-community-attestation-genesis-v1',
    'evidenceId', target_evidence_id,
    'evidenceRoot', target_evidence_root
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e4_payload_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(record - 'auditEvent');
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e4_offline_batch_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  project_record projects.projects%ROWTYPE;
  project_authority record;
  consent evidence.consent_receipts%ROWTYPE;
  device identity.device_attestations%ROWTYPE;
  consent_projection record;
  device_projection record;
  semantic_event audit.domain_events%ROWTYPE;
  previous_batch evidence.offline_sync_batch_facts%ROWTYPE;
  expected_previous_root text;
  expected_action text;
  item_roots text[];
  issue_codes text[];
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT project_record FROM projects.projects WHERE id = NEW.project_id FOR SHARE;
  SELECT * INTO STRICT project_authority FROM projects.current_authority(NEW.project_id);
  SELECT * INTO STRICT device FROM identity.device_attestations WHERE id = NEW.device_attestation_id FOR SHARE;
  SELECT * INTO STRICT consent FROM evidence.consent_receipts WHERE id = device.consent_receipt_id FOR SHARE;
  SELECT * INTO STRICT consent_projection
    FROM evidence.consent_receipt_projection(consent.id, NEW.received_at);
  SELECT * INTO STRICT device_projection
    FROM evidence.effective_device_attestation_projection(device.id, NEW.received_at);
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT candidate.* INTO previous_batch
  FROM evidence.offline_sync_batch_facts candidate
  WHERE candidate.device_attestation_id = NEW.device_attestation_id
  ORDER BY candidate.device_sequence DESC, candidate.id DESC
  LIMIT 1;
  expected_previous_root := COALESCE(
    previous_batch.batch_root,
    evidence.e4_offline_batch_genesis(device.id, device.attestation_root)
  );
  expected_action := CASE WHEN NEW.batch_state = 'reconciled' THEN 'ASSERT' ELSE 'CHALLENGE' END;
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO item_roots
  FROM jsonb_array_elements_text(NEW.fact_record->'itemRoots') WITH ORDINALITY AS item(value, position);
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO issue_codes
  FROM jsonb_array_elements_text(NEW.fact_record->'issueCodes') WITH ORDINALITY AS item(value, position);

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.actor_id
     OR transaction_organization_id <> NEW.organization_id
     OR evidence.e4_has_forbidden_key(NEW.fact_record)
     OR NOT evidence.e4_keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','projectRoot','subjectId',
         'consentReceiptId','consentReceiptRoot','consentProjectionRoot',
         'deviceAttestationId','deviceAttestationRoot','deviceProjectionState',
         'deviceProjectionRoot','clientBatchId','deviceSequence','previousBatchRoot',
         'deviceClockStartedAt','deviceClockEndedAt','receivedAt','connectivity',
         'itemCount','reconciledCount','needsReviewCount','itemRoots','manifestRoot',
         'issueCodes','batchState','actor','commandHash','streamSequence',
         'previousEventRoot','batchHash','batchRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','projectRoot','subjectId',
         'consentReceiptId','consentReceiptRoot','consentProjectionRoot',
         'deviceAttestationId','deviceAttestationRoot','deviceProjectionState',
         'deviceProjectionRoot','clientBatchId','deviceSequence','previousBatchRoot',
         'deviceClockStartedAt','deviceClockEndedAt','receivedAt','connectivity',
         'itemCount','reconciledCount','needsReviewCount','itemRoots','manifestRoot',
         'issueCodes','batchState','actor','commandHash','streamSequence',
         'previousEventRoot','batchHash','batchRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.organization_id <> project_record.organization_id
     OR NEW.fact_record->>'projectRoot' <> project_authority.project_root
     OR NEW.subject_id <> device.subject_id
     OR NEW.subject_id <> consent.subject_id
     OR NEW.fact_record->>'consentReceiptId' <> consent.id
     OR NEW.fact_record->>'consentReceiptRoot' <> consent.receipt_root
     OR NEW.fact_record->>'consentProjectionRoot' <> consent_projection.projection_root
     OR consent_projection.state <> 'active'
     OR NOT (consent.purposes @> ARRAY['evidence_collection','geolocation']::text[])
     OR NEW.fact_record->>'deviceAttestationRoot' <> device.attestation_root
     OR NEW.fact_record->>'deviceProjectionState' <> device_projection.state
     OR device_projection.state NOT IN ('current','needs_review')
     OR NEW.fact_record->>'deviceProjectionRoot' <> device_projection.projection_root
     OR NOT evidence.evidence_custody_actor_is_valid(
       NEW.fact_record->'actor', NEW.actor_id, NEW.organization_id
     )
     OR NEW.actor_id <> NEW.subject_id
     OR NEW.device_sequence <> COALESCE(previous_batch.device_sequence + 1, 1)
     OR NEW.fact_record->>'previousBatchRoot' <> expected_previous_root
     OR NEW.fact_record->>'clientBatchId' !~ '^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$'
     OR NOT evidence.evidence_media_safe_material(ARRAY[NEW.fact_record->>'clientBatchId'])
     OR NEW.fact_record->>'connectivity' NOT IN ('offline','cellular','wifi','satellite')
     OR (NEW.fact_record->>'deviceClockStartedAt')::timestamptz >
        (NEW.fact_record->>'deviceClockEndedAt')::timestamptz
     OR (NEW.fact_record->>'deviceClockEndedAt')::timestamptz > NEW.received_at
     OR (NEW.fact_record->>'deviceClockEndedAt')::timestamptz -
        (NEW.fact_record->>'deviceClockStartedAt')::timestamptz > interval '365 days'
     OR NEW.received_at <> date_trunc('milliseconds', NEW.received_at)
     OR (NEW.fact_record->>'deviceClockStartedAt')::timestamptz <>
        date_trunc('milliseconds', (NEW.fact_record->>'deviceClockStartedAt')::timestamptz)
     OR (NEW.fact_record->>'deviceClockEndedAt')::timestamptz <>
        date_trunc('milliseconds', (NEW.fact_record->>'deviceClockEndedAt')::timestamptz)
     OR jsonb_typeof(NEW.fact_record->'itemRoots') <> 'array'
     OR cardinality(item_roots) <> NEW.item_count
     OR EXISTS (SELECT 1 FROM unnest(item_roots) AS value WHERE value !~ '^[0-9a-f]{64}$')
     OR NEW.manifest_root <> audit.merkle_root(item_roots)
     OR jsonb_typeof(NEW.fact_record->'issueCodes') <> 'array'
     OR cardinality(issue_codes) > 32
     OR NOT audit.is_sorted_unique_text_array(issue_codes)
     OR EXISTS (SELECT 1 FROM unnest(issue_codes) AS value WHERE value !~ '^[a-z0-9][a-z0-9_:-]{0,119}$')
     OR (NEW.fact_record->>'reconciledCount')::integer < 0
     OR (NEW.fact_record->>'needsReviewCount')::integer < 0
     OR (NEW.fact_record->>'reconciledCount')::integer +
        (NEW.fact_record->>'needsReviewCount')::integer <> NEW.item_count
     OR NEW.fact_record->'safety' <> evidence.e4_safety_canonical()
     OR NEW.batch_hash <> evidence.e4_offline_batch_hash(NEW.fact_record)
     OR NEW.batch_root <> evidence.e4_offline_batch_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E4_OFFLINE_BATCH_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-offline-device:' || NEW.device_attestation_id
     OR semantic_event.sequence_no <> NEW.stream_sequence
     OR semantic_event.action <> expected_action
     OR semantic_event.actor_id <> NEW.actor_id
     OR semantic_event.entity_type <> 'evidence_sync_batch'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.fact_record->>'previousEventRoot'
     OR semantic_event.created_at <> NEW.received_at
     OR semantic_event.payload_hash <> evidence.e4_payload_hash(NEW.fact_record)
     OR semantic_event.rationale <>
       'An offline evidence reconciliation manifest was appended without replacing canonical evidence authority.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_E4_OFFLINE_BATCH_EVENT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e4_offline_item_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  batch evidence.offline_sync_batch_facts%ROWTYPE;
  evidence_record evidence.evidence_objects%ROWTYPE;
  device identity.device_attestations%ROWTYPE;
  expected_result text;
  expected_issues text[];
  issue_codes text[];
BEGIN
  SELECT * INTO STRICT batch FROM evidence.offline_sync_batch_facts WHERE id = NEW.batch_id FOR SHARE;
  SELECT * INTO STRICT evidence_record FROM evidence.evidence_objects WHERE id = NEW.evidence_id FOR SHARE;
  SELECT * INTO STRICT device FROM identity.device_attestations WHERE id = NEW.device_attestation_id FOR SHARE;
  expected_result := CASE
    WHEN evidence_record.verification_status = 'validated'
      AND batch.fact_record->>'deviceProjectionState' = 'current'
      THEN 'reconciled'
    ELSE 'needs_review'
  END;
  expected_issues := COALESCE(evidence_record.validation_issues, ARRAY[]::text[]);
  IF evidence_record.verification_status = 'challenged' THEN
    expected_issues := array_append(expected_issues, 'evidence_registration_needs_review');
  END IF;
  IF batch.fact_record->>'deviceProjectionState' <> 'current' THEN
    expected_issues := array_append(expected_issues, 'device_attestation_needs_review');
  END IF;
  SELECT ARRAY(SELECT DISTINCT value FROM unnest(expected_issues) AS value ORDER BY value)
  INTO expected_issues;
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO issue_codes
  FROM jsonb_array_elements_text(NEW.fact_record->'issueCodes') WITH ORDINALITY AS item(value, position);

  IF evidence.e4_has_forbidden_key(NEW.fact_record)
     OR NOT evidence.e4_keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','batchId','batchCommandHash','organizationId','projectId',
         'subjectId','deviceAttestationId','itemIndex','clientRecordId','evidenceId',
         'evidenceHash','evidenceRoot','clientPayloadHash','result','issueCodes',
         'itemHash','itemRoot','safety'
       ]::text[],
       ARRAY[
         'factType','id','batchId','batchCommandHash','organizationId','projectId',
         'subjectId','deviceAttestationId','itemIndex','clientRecordId','evidenceId',
         'evidenceHash','evidenceRoot','clientPayloadHash','result','issueCodes',
         'itemHash','itemRoot','safety'
       ]::text[]
     )
     OR NEW.organization_id <> batch.organization_id
     OR NEW.project_id <> batch.project_id
     OR NEW.subject_id <> batch.subject_id
     OR NEW.device_attestation_id <> batch.device_attestation_id
     OR NEW.fact_record->>'batchCommandHash' <> batch.command_hash
     OR NEW.organization_id <> evidence_record.organization_id
     OR NEW.project_id <> evidence_record.project_id
     OR NEW.subject_id <> evidence_record.contributor_id
     OR evidence_record.contributor_role <> batch.fact_record->'actor'->>'role'
     OR evidence_record.offline_sync_id <> batch.client_batch_id
     OR evidence_record.device_fingerprint_hash <> device.device_fingerprint_hash
     OR NEW.fact_record->>'evidenceHash' <> evidence_record.evidence_hash
     OR NEW.fact_record->>'evidenceRoot' <> evidence_record.evidence_root
     OR NEW.fact_record->>'clientPayloadHash' !~ '^[0-9a-f]{64}$'
     OR evidence_record.observed_at < (batch.fact_record->>'deviceClockStartedAt')::timestamptz
     OR evidence_record.observed_at > (batch.fact_record->>'deviceClockEndedAt')::timestamptz
     OR evidence_record.created_at > batch.received_at
     OR NEW.result_state <> expected_result
     OR issue_codes <> expected_issues
     OR NOT audit.is_sorted_unique_text_array(issue_codes)
     OR NEW.fact_record->'safety' <> evidence.e4_safety_canonical()
     OR NEW.item_hash <> evidence.e4_offline_item_hash(NEW.fact_record)
     OR NEW.id <> 'cp_offline_item_' || left(NEW.item_hash, 24)
     OR NEW.item_root <> evidence.e4_offline_item_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E4_OFFLINE_ITEM_AUTHORITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e4_offline_bundle_complete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item_records jsonb;
  item_roots text[];
  actual_item_count integer;
  actual_reconciled_count integer;
  actual_needs_review_count integer;
  expected_issue_codes text[] := ARRAY[]::text[];
  expected_batch_state text;
  expected_command_hash text;
BEGIN
  SELECT
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'itemIndex', item.item_index,
          'clientRecordId', item.client_record_id,
          'evidenceId', item.evidence_id,
          'evidenceHash', item.fact_record->>'evidenceHash',
          'evidenceRoot', item.fact_record->>'evidenceRoot',
          'clientPayloadHash', item.fact_record->>'clientPayloadHash',
          'result', item.result_state,
          'issueCodes', item.fact_record->'issueCodes'
        ) ORDER BY item.item_index
      ),
      '[]'::jsonb
    ),
    COALESCE(array_agg(item.item_root ORDER BY item.item_index), ARRAY[]::text[]),
    count(*)::integer,
    count(*) FILTER (WHERE item.result_state = 'reconciled')::integer,
    count(*) FILTER (WHERE item.result_state = 'needs_review')::integer
  INTO item_records, item_roots, actual_item_count, actual_reconciled_count, actual_needs_review_count
  FROM evidence.offline_sync_item_facts item
  WHERE item.batch_id = NEW.id;

  IF NEW.fact_record->>'deviceProjectionState' <> 'current' THEN
    expected_issue_codes := array_append(expected_issue_codes, 'device_attestation_needs_review');
  END IF;
  IF NEW.received_at - (NEW.fact_record->>'deviceClockEndedAt')::timestamptz > interval '30 days' THEN
    expected_issue_codes := array_append(expected_issue_codes, 'offline_delivery_delay_needs_review');
  END IF;
  SELECT ARRAY(SELECT DISTINCT value FROM unnest(expected_issue_codes) AS value ORDER BY value)
  INTO expected_issue_codes;
  expected_batch_state := CASE
    WHEN actual_needs_review_count = 0 AND cardinality(expected_issue_codes) = 0
      THEN 'reconciled'
    ELSE 'needs_review'
  END;
  expected_command_hash := evidence.e4_offline_batch_command_hash(NEW.fact_record, item_records);

  IF actual_item_count <> NEW.item_count
     OR actual_reconciled_count <> (NEW.fact_record->>'reconciledCount')::integer
     OR actual_needs_review_count <> (NEW.fact_record->>'needsReviewCount')::integer
     OR item_roots <> ARRAY(
       SELECT value FROM jsonb_array_elements_text(NEW.fact_record->'itemRoots') AS value
     )
     OR NEW.manifest_root <> audit.merkle_root(item_roots)
     OR expected_issue_codes <> ARRAY(
       SELECT value FROM jsonb_array_elements_text(NEW.fact_record->'issueCodes') AS value
     )
     OR NEW.batch_state <> expected_batch_state
     OR NEW.command_hash <> expected_command_hash
     OR NEW.id <> 'cp_offline_batch_' || left(expected_command_hash, 24) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E4_OFFLINE_BUNDLE_INCOMPLETE';
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e4_community_attestation_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  evidence_record evidence.evidence_objects%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  previous_attestation evidence.community_attestation_facts%ROWTYPE;
  expected_previous_root text;
  expected_action text;
  expected_state text;
  reason_codes text[];
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT evidence_record FROM evidence.evidence_objects WHERE id = NEW.evidence_id FOR SHARE;
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT candidate.* INTO previous_attestation
  FROM evidence.community_attestation_facts candidate
  WHERE candidate.evidence_id = NEW.evidence_id
  ORDER BY candidate.attestation_sequence DESC, candidate.id DESC
  LIMIT 1;
  expected_previous_root := COALESCE(
    previous_attestation.attestation_root,
    evidence.e4_community_genesis(evidence_record.id, evidence_record.evidence_root)
  );
  expected_action := CASE NEW.stance WHEN 'support' THEN 'ASSERT' WHEN 'challenge' THEN 'CHALLENGE' ELSE 'REASON' END;
  expected_state := CASE WHEN NEW.stance = 'support' THEN 'supporting_context' ELSE 'review_required' END;
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO reason_codes
  FROM jsonb_array_elements_text(NEW.fact_record->'reasonCodes') WITH ORDINALITY AS item(value, position);

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.actor_id
     OR transaction_organization_id <> NEW.organization_id
     OR evidence.e4_has_forbidden_key(NEW.fact_record)
     OR NOT evidence.e4_keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','evidenceRoot',
         'evidenceContributorId','attesterId','stance','relationship','observationBasis',
         'conflictOfInterestDeclared','noteHash','confidenceScore','reasonCodes',
         'supportingMediaHash','supportingGpsHash','observedAt','createdAt',
         'attestationState','attester','attestationSequence','previousAttestationRoot',
         'commandHash','streamSequence','previousEventRoot','attestationHash',
         'attestationRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','evidenceRoot',
         'evidenceContributorId','attesterId','stance','relationship','observationBasis',
         'conflictOfInterestDeclared','noteHash','confidenceScore','reasonCodes',
         'observedAt','createdAt','attestationState','attester','attestationSequence',
         'previousAttestationRoot','commandHash','streamSequence','previousEventRoot',
         'attestationHash','attestationRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.organization_id <> evidence_record.organization_id
     OR NEW.project_id <> evidence_record.project_id
     OR NEW.fact_record->>'evidenceRoot' <> evidence_record.evidence_root
     OR NEW.fact_record->>'evidenceContributorId' <> evidence_record.contributor_id
     OR NEW.actor_id = evidence_record.contributor_id
     OR NEW.fact_record->'attester'->>'role' NOT IN ('community','researcher','verifier')
     OR NOT evidence.evidence_custody_actor_is_valid(
       NEW.fact_record->'attester', NEW.actor_id, NEW.organization_id
     )
     OR NEW.fact_record->>'relationship' NOT IN (
       'resident','local_ngo','field_observer','independent_researcher'
     )
     OR NEW.fact_record->>'observationBasis' NOT IN (
       'direct_observation','local_knowledge','secondary_media','records_review'
     )
     OR (NEW.fact_record->>'conflictOfInterestDeclared')::boolean IS NOT FALSE
     OR NEW.fact_record->>'noteHash' !~ '^[0-9a-f]{64}$'
     OR (NEW.fact_record->>'confidenceScore')::integer NOT BETWEEN 0 AND 100
     OR jsonb_typeof(NEW.fact_record->'reasonCodes') <> 'array'
     OR cardinality(reason_codes) > 32
     OR NOT audit.is_sorted_unique_text_array(reason_codes)
     OR EXISTS (SELECT 1 FROM unnest(reason_codes) AS value WHERE value !~ '^[a-z0-9][a-z0-9_:-]{0,119}$')
     OR (NEW.stance = 'support' AND cardinality(reason_codes) <> 0)
     OR (NEW.stance <> 'support' AND cardinality(reason_codes) = 0)
     OR (NEW.fact_record ? 'supportingMediaHash' AND NEW.fact_record->>'supportingMediaHash' !~ '^[0-9a-f]{64}$')
     OR (NEW.fact_record ? 'supportingGpsHash' AND NEW.fact_record->>'supportingGpsHash' !~ '^[0-9a-f]{64}$')
     OR (NEW.fact_record->>'observedAt')::timestamptz < evidence_record.observed_at
     OR (NEW.fact_record->>'observedAt')::timestamptz > NEW.created_at
     OR NEW.created_at < evidence_record.created_at
     OR NEW.created_at <> date_trunc('milliseconds', NEW.created_at)
     OR (NEW.fact_record->>'observedAt')::timestamptz <>
        date_trunc('milliseconds', (NEW.fact_record->>'observedAt')::timestamptz)
     OR NEW.attestation_state <> expected_state
     OR NEW.attestation_sequence <> COALESCE(previous_attestation.attestation_sequence + 1, 1)
     OR NEW.fact_record->>'previousAttestationRoot' <> expected_previous_root
     OR NEW.fact_record->'safety' <> evidence.e4_safety_canonical()
     OR NEW.command_hash <> evidence.e4_community_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_community_attestation_' || left(NEW.command_hash, 24)
     OR NEW.attestation_hash <> evidence.e4_community_hash(NEW.fact_record)
     OR NEW.attestation_root <> evidence.e4_community_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E4_COMMUNITY_ATTESTATION_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-community:' || NEW.evidence_id
     OR semantic_event.sequence_no <> NEW.stream_sequence
     OR semantic_event.action <> expected_action
     OR semantic_event.actor_id <> NEW.actor_id
     OR semantic_event.entity_type <> 'community_attestation'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.fact_record->>'previousEventRoot'
     OR semantic_event.created_at <> NEW.created_at
     OR semantic_event.payload_hash <> evidence.e4_payload_hash(NEW.fact_record)
     OR semantic_event.rationale <>
       'A non-final community statement was appended without changing evidence verification authority.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_E4_COMMUNITY_ATTESTATION_EVENT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidence_e4_offline_batch_validate
  ON evidence.offline_sync_batch_facts;
CREATE TRIGGER evidence_e4_offline_batch_validate
BEFORE INSERT ON evidence.offline_sync_batch_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e4_offline_batch_insert();

DROP TRIGGER IF EXISTS evidence_e4_offline_item_validate
  ON evidence.offline_sync_item_facts;
CREATE TRIGGER evidence_e4_offline_item_validate
BEFORE INSERT ON evidence.offline_sync_item_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e4_offline_item_insert();

DROP TRIGGER IF EXISTS evidence_e4_offline_bundle_complete
  ON evidence.offline_sync_batch_facts;
CREATE CONSTRAINT TRIGGER evidence_e4_offline_bundle_complete
AFTER INSERT ON evidence.offline_sync_batch_facts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e4_offline_bundle_complete();

DROP TRIGGER IF EXISTS evidence_e4_community_validate
  ON evidence.community_attestation_facts;
CREATE TRIGGER evidence_e4_community_validate
BEFORE INSERT ON evidence.community_attestation_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e4_community_attestation_insert();

DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'offline_sync_batch_facts',
    'offline_sync_item_facts',
    'community_attestation_facts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON evidence.%I', relation_name || '_append_only', relation_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON evidence.%I FOR EACH ROW EXECUTE FUNCTION evidence.e4_reject_mutation()',
      relation_name || '_append_only', relation_name
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS evidence_e4_offline_batch_audit
  ON evidence.offline_sync_batch_facts;
CREATE TRIGGER evidence_e4_offline_batch_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.offline_sync_batch_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS evidence_e4_offline_item_audit
  ON evidence.offline_sync_item_facts;
CREATE TRIGGER evidence_e4_offline_item_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.offline_sync_item_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS evidence_e4_community_audit
  ON evidence.community_attestation_facts;
CREATE TRIGGER evidence_e4_community_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.community_attestation_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE evidence.offline_sync_batch_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.offline_sync_batch_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence.offline_sync_item_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.offline_sync_item_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence.community_attestation_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.community_attestation_facts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_e4_offline_batch_tenant ON evidence.offline_sync_batch_facts;
CREATE POLICY evidence_e4_offline_batch_tenant ON evidence.offline_sync_batch_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS evidence_e4_offline_item_tenant ON evidence.offline_sync_item_facts;
CREATE POLICY evidence_e4_offline_item_tenant ON evidence.offline_sync_item_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS evidence_e4_community_tenant ON evidence.community_attestation_facts;
CREATE POLICY evidence_e4_community_tenant ON evidence.community_attestation_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));
