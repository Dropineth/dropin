-- CanopyProof E3d durable metadata-extraction request authority.
-- Apply after canopyproof-os.sql, evidence-device-attestation-adapters.sql,
-- evidence-media-adapters.sql, evidence-metadata-retention.sql, and
-- evidence-metadata-adapters.sql. This migration is additive and route-closed.

CREATE OR REPLACE FUNCTION evidence.e3d_request_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'appendOnly', true,
    'organizationBound', true,
    'objectBound', true,
    'effectiveMediaProjectionBound', true,
    'consentProjectionBound', true,
    'deviceProjectionBound', true,
    'extractorPolicyBound', true,
    'signerSetBound', true,
    'semanticEventBound', true,
    'commandReceiptBound', true,
    'externalIoAfterCommitOnly', true,
    'dispatchExpiryBound', true,
    'noRawExif', true,
    'noRawGps', true,
    'noPreciseLocation', true,
    'noRawSignature', true,
    'noProviderCredential', true,
    'notExtractionSuccess', true,
    'notFinalProofAuthority', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3d_has_forbidden_key(document jsonb)
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
        'signature', 'latitude', 'longitude', 'rawexif', 'rawgps',
        'preciselocation', 'providercredential', 'credential', 'privatekey',
        'secret', 'accesskey', 'accesstoken', 'refreshtoken', 'signedurl',
        'uploadurl', 'authorization', 'idempotencykey'
      ]::text[]) THEN
        RETURN true;
      END IF;
      IF evidence.e3d_has_forbidden_key(entry.value) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(document)
    LOOP
      IF evidence.e3d_has_forbidden_key(item) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;

CREATE TABLE IF NOT EXISTS evidence.metadata_extraction_request_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  evidence_id text NOT NULL REFERENCES evidence.evidence_objects(id),
  object_id text NOT NULL REFERENCES evidence.media_object_facts(id),
  object_root text NOT NULL CHECK (object_root ~ '^[0-9a-f]{64}$'),
  base_media_projection_root text NOT NULL CHECK (base_media_projection_root ~ '^[0-9a-f]{64}$'),
  media_adapter_trust_projection_root text NOT NULL CHECK (
    media_adapter_trust_projection_root ~ '^[0-9a-f]{64}$'
  ),
  media_projection_root text NOT NULL CHECK (media_projection_root ~ '^[0-9a-f]{64}$'),
  consent_receipt_id text NOT NULL REFERENCES evidence.consent_receipts(id),
  consent_receipt_root text NOT NULL CHECK (consent_receipt_root ~ '^[0-9a-f]{64}$'),
  consent_projection_root text NOT NULL CHECK (consent_projection_root ~ '^[0-9a-f]{64}$'),
  device_attestation_id text NOT NULL REFERENCES identity.device_attestations(id),
  device_attestation_root text NOT NULL CHECK (device_attestation_root ~ '^[0-9a-f]{64}$'),
  device_projection_root text NOT NULL CHECK (device_projection_root ~ '^[0-9a-f]{64}$'),
  registered_gps_hash text NOT NULL CHECK (registered_gps_hash ~ '^[0-9a-f]{64}$'),
  privacy_mode text NOT NULL CHECK (privacy_mode IN ('precise', 'masked', 'restricted')),
  extractor_id text NOT NULL CHECK (length(btrim(extractor_id)) BETWEEN 1 AND 240),
  extractor_name text NOT NULL CHECK (length(btrim(extractor_name)) BETWEEN 1 AND 100),
  extractor_version text NOT NULL CHECK (length(btrim(extractor_version)) BETWEEN 1 AND 100),
  extractor_image_digest text NOT NULL CHECK (extractor_image_digest ~ '^[0-9a-f]{64}$'),
  metadata_schema_version text NOT NULL CHECK (
    length(btrim(metadata_schema_version)) BETWEEN 1 AND 100
  ),
  extractor_policy_root text NOT NULL CHECK (extractor_policy_root ~ '^[0-9a-f]{64}$'),
  signer_set_root text NOT NULL CHECK (signer_set_root ~ '^[0-9a-f]{64}$'),
  maximum_observation_age_seconds integer NOT NULL CHECK (
    maximum_observation_age_seconds BETWEEN 86400 AND 31622400
  ),
  requested_by text NOT NULL REFERENCES identity.participants(id),
  requester_snapshot jsonb NOT NULL CHECK (jsonb_typeof(requester_snapshot) = 'object'),
  requested_at timestamptz NOT NULL CHECK (requested_at = date_trunc('milliseconds', requested_at)),
  dispatch_expires_at timestamptz NOT NULL CHECK (
    dispatch_expires_at = requested_at + interval '5 minutes'
  ),
  idempotency_key_hash text NOT NULL CHECK (idempotency_key_hash ~ '^[0-9a-f]{64}$'),
  request_hash text NOT NULL UNIQUE CHECK (request_hash ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  evidence_sequence bigint NOT NULL CHECK (evidence_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_receipt_id text NOT NULL UNIQUE REFERENCES audit.command_receipts(id),
  request_root text NOT NULL UNIQUE CHECK (request_root ~ '^[0-9a-f]{64}$'),
  safety jsonb NOT NULL CHECK (jsonb_typeof(safety) = 'object'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (evidence_id, evidence_sequence),
  CHECK (fact_record->>'factType' = 'evidence_metadata_extraction_request'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->>'evidenceId' = evidence_id),
  CHECK (fact_record->>'objectId' = object_id),
  CHECK (fact_record->>'objectRoot' = object_root),
  CHECK (fact_record->>'baseMediaProjectionRoot' = base_media_projection_root),
  CHECK (fact_record->>'mediaAdapterTrustProjectionRoot' = media_adapter_trust_projection_root),
  CHECK (fact_record->>'mediaProjectionRoot' = media_projection_root),
  CHECK (fact_record->>'consentReceiptId' = consent_receipt_id),
  CHECK (fact_record->>'consentReceiptRoot' = consent_receipt_root),
  CHECK (fact_record->>'consentProjectionRoot' = consent_projection_root),
  CHECK (fact_record->>'deviceAttestationId' = device_attestation_id),
  CHECK (fact_record->>'deviceAttestationRoot' = device_attestation_root),
  CHECK (fact_record->>'deviceProjectionRoot' = device_projection_root),
  CHECK (fact_record->>'registeredGpsHash' = registered_gps_hash),
  CHECK (fact_record->>'privacyMode' = privacy_mode),
  CHECK (fact_record->>'extractorId' = extractor_id),
  CHECK (fact_record->>'extractorName' = extractor_name),
  CHECK (fact_record->>'extractorVersion' = extractor_version),
  CHECK (fact_record->>'extractorImageDigest' = extractor_image_digest),
  CHECK (fact_record->>'metadataSchemaVersion' = metadata_schema_version),
  CHECK (fact_record->>'extractorPolicyRoot' = extractor_policy_root),
  CHECK (fact_record->>'signerSetRoot' = signer_set_root),
  CHECK ((fact_record->>'maximumObservationAgeSeconds')::integer = maximum_observation_age_seconds),
  CHECK (fact_record->>'requestedBy' = requested_by),
  CHECK (fact_record->'requester' = requester_snapshot),
  CHECK ((fact_record->>'requestedAt')::timestamptz = requested_at),
  CHECK ((fact_record->>'dispatchExpiresAt')::timestamptz = dispatch_expires_at),
  CHECK (fact_record->>'idempotencyKeyHash' = idempotency_key_hash),
  CHECK (fact_record->>'requestHash' = request_hash),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK ((fact_record->>'evidenceSequence')::bigint = evidence_sequence),
  CHECK (fact_record->>'previousEventRoot' = previous_event_root),
  CHECK (fact_record->>'commandReceiptId' = command_receipt_id),
  CHECK (fact_record->>'requestRoot' = request_root),
  CHECK (fact_record->'safety' = safety),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE INDEX IF NOT EXISTS evidence_e3d_request_org_time
  ON evidence.metadata_extraction_request_facts (organization_id, requested_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS evidence_e3d_request_object_time
  ON evidence.metadata_extraction_request_facts (object_id, requested_at DESC, id DESC);

CREATE OR REPLACE FUNCTION evidence.e3d_request_seed(
  fact evidence.metadata_extraction_request_facts
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_build_object(
    'organizationId', fact.organization_id,
    'projectId', fact.project_id,
    'evidenceId', fact.evidence_id,
    'objectId', fact.object_id,
    'objectRoot', fact.object_root,
    'baseMediaProjectionRoot', fact.base_media_projection_root,
    'mediaAdapterTrustProjectionRoot', fact.media_adapter_trust_projection_root,
    'mediaProjectionRoot', fact.media_projection_root,
    'consentReceiptId', fact.consent_receipt_id,
    'consentReceiptRoot', fact.consent_receipt_root,
    'consentProjectionRoot', fact.consent_projection_root,
    'deviceAttestationId', fact.device_attestation_id,
    'deviceAttestationRoot', fact.device_attestation_root,
    'deviceProjectionRoot', fact.device_projection_root,
    'registeredGpsHash', fact.registered_gps_hash,
    'privacyMode', fact.privacy_mode,
    'extractorId', fact.extractor_id,
    'extractorName', fact.extractor_name,
    'extractorVersion', fact.extractor_version,
    'extractorImageDigest', fact.extractor_image_digest,
    'metadataSchemaVersion', fact.metadata_schema_version,
    'extractorPolicyRoot', fact.extractor_policy_root,
    'signerSetRoot', fact.signer_set_root,
    'maximumObservationAgeSeconds', fact.maximum_observation_age_seconds,
    'requestedBy', fact.requested_by,
    'requester', fact.requester_snapshot,
    'requestedAt', audit.iso8601_millis(fact.requested_at),
    'dispatchExpiresAt', audit.iso8601_millis(fact.dispatch_expires_at)
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3d_request_hash(
  fact evidence.metadata_extraction_request_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-metadata-extraction-request-v1') ||
    evidence.e3d_request_seed(fact)
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3d_request_command_hash(
  fact evidence.metadata_extraction_request_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-metadata-extraction-request-command-v1',
    'requestHash', fact.request_hash,
    'idempotencyKeyHash', fact.idempotency_key_hash,
    'requestedBy', fact.requested_by,
    'requesterAuthorityRoot', fact.requester_snapshot->>'authorityRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e3d_request_root(
  fact evidence.metadata_extraction_request_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-metadata-extraction-request-root-v1',
    'requestHash', fact.request_hash,
    'commandHash', fact.command_hash,
    'auditEventRoot', fact.audit_event_root,
    'commandReceiptId', fact.command_receipt_id,
    'safety', fact.safety
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e3d_request_insert()
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
  command_receipt audit.command_receipts%ROWTYPE;
  expected_receipt_id text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT object_fact
  FROM evidence.media_object_facts WHERE id = NEW.object_id FOR SHARE;
  SELECT * INTO STRICT intent
  FROM evidence.media_upload_intent_facts WHERE id = object_fact.intent_id FOR SHARE;
  SELECT * INTO STRICT evidence_record
  FROM evidence.evidence_objects WHERE id = NEW.evidence_id FOR SHARE;
  SELECT * INTO STRICT consent
  FROM evidence.consent_receipts WHERE id = intent.consent_receipt_id FOR SHARE;
  SELECT * INTO STRICT device
  FROM identity.device_attestations WHERE id = intent.device_attestation_id FOR SHARE;
  SELECT * INTO STRICT media_projection
  FROM evidence.effective_media_object_projection(NEW.object_id, NEW.requested_at);
  SELECT * INTO STRICT consent_projection
  FROM evidence.consent_receipt_projection(consent.id, NEW.requested_at);
  SELECT * INTO STRICT device_projection
  FROM evidence.effective_device_attestation_projection(device.id, NEW.requested_at);
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT * INTO STRICT command_receipt
  FROM audit.command_receipts WHERE id = NEW.command_receipt_id;
  expected_receipt_id := 'cp_e3d_request_command_' || left(audit.sha256_stable_json(
    jsonb_build_object(
      'requestedBy', NEW.requested_by,
      'idempotencyKeyHash', NEW.idempotency_key_hash
    )
  ), 24);

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.requested_by
     OR transaction_organization_id <> NEW.organization_id
     OR evidence.e3d_has_forbidden_key(NEW.fact_record)
     OR NOT evidence.e3b_keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','objectId','objectRoot',
         'baseMediaProjectionRoot','mediaAdapterTrustProjectionRoot','mediaProjectionRoot',
         'consentReceiptId','consentReceiptRoot','consentProjectionRoot','deviceAttestationId',
         'deviceAttestationRoot','deviceProjectionRoot','registeredGpsHash','privacyMode',
         'extractorId','extractorName','extractorVersion','extractorImageDigest',
         'metadataSchemaVersion','extractorPolicyRoot','signerSetRoot',
         'maximumObservationAgeSeconds','requestedBy','requester','requestedAt',
         'dispatchExpiresAt','idempotencyKeyHash','requestHash','commandHash','evidenceSequence',
         'previousEventRoot','commandReceiptId','requestRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','objectId','objectRoot',
         'baseMediaProjectionRoot','mediaAdapterTrustProjectionRoot','mediaProjectionRoot',
         'consentReceiptId','consentReceiptRoot','consentProjectionRoot','deviceAttestationId',
         'deviceAttestationRoot','deviceProjectionRoot','registeredGpsHash','privacyMode',
         'extractorId','extractorName','extractorVersion','extractorImageDigest',
         'metadataSchemaVersion','extractorPolicyRoot','signerSetRoot',
         'maximumObservationAgeSeconds','requestedBy','requester','requestedAt',
         'dispatchExpiresAt','idempotencyKeyHash','requestHash','commandHash','evidenceSequence',
         'previousEventRoot','commandReceiptId','requestRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.requester_snapshot->>'id' <> NEW.requested_by
     OR NOT evidence.evidence_media_agent_is_valid(
       NEW.requester_snapshot, NEW.organization_id, 'metadata_extraction_receipt'
     )
     OR NEW.organization_id <> object_fact.organization_id
     OR NEW.project_id <> object_fact.project_id
     OR NEW.evidence_id <> object_fact.evidence_id
     OR evidence_record.organization_id <> NEW.organization_id
     OR evidence_record.project_id <> NEW.project_id
     OR NEW.object_root <> object_fact.object_root
     OR NEW.base_media_projection_root <> media_projection.base_projection_root
     OR NEW.media_adapter_trust_projection_root <> media_projection.adapter_trust_projection_root
     OR NEW.media_projection_root <> media_projection.projection_root
     OR media_projection.state <> 'available'
     OR cardinality(media_projection.issue_codes) <> 0
     OR NEW.consent_receipt_id <> consent.id
     OR NEW.consent_receipt_root <> consent.receipt_root
     OR NEW.consent_projection_root <> consent_projection.projection_root
     OR consent_projection.state <> 'active'
     OR NEW.device_attestation_id <> device.id
     OR NEW.device_attestation_root <> device.attestation_root
     OR NEW.device_projection_root <> device_projection.projection_root
     OR device_projection.state <> 'current'
     OR NEW.registered_gps_hash <> evidence_record.gps_hash
     OR NEW.privacy_mode <> consent.privacy_mode
     OR NOT ('media_upload' = ANY(consent.purposes))
     OR NOT ('geolocation' = ANY(consent.purposes))
     OR NOT evidence.evidence_media_safe_material(ARRAY[
       NEW.extractor_id, NEW.extractor_name, NEW.extractor_version, NEW.metadata_schema_version
     ])
     OR NEW.request_hash <> evidence.e3d_request_hash(NEW)
     OR NEW.command_hash <> evidence.e3d_request_command_hash(NEW)
     OR NEW.id <> 'cp_metadata_request_' || left(NEW.command_hash, 24)
     OR NEW.command_receipt_id <> expected_receipt_id
     OR NEW.request_root <> evidence.e3d_request_root(NEW)
     OR NEW.safety <> evidence.e3d_request_safety_canonical() THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3D_REQUEST_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-metadata-request:' || NEW.evidence_id
     OR semantic_event.sequence_no <> NEW.evidence_sequence
     OR semantic_event.action <> 'REASON'
     OR semantic_event.actor_id <> NEW.requested_by
     OR semantic_event.entity_type <> 'metadata_extraction_request'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.requested_at
     OR semantic_event.payload_hash <> NEW.request_hash
     OR semantic_event.rationale <>
       'A minimized metadata-extraction request was durably authorized before provider I/O.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3D_REQUEST_EVENT_INVALID';
  END IF;

  IF command_receipt.actor_id <> NEW.requested_by
     OR command_receipt.operation <> 'evidence.metadata-extraction-request.prepare'
     OR command_receipt.idempotency_key_hash <> NEW.idempotency_key_hash
     OR command_receipt.request_hash <> NEW.request_hash
     OR command_receipt.result_entity_type <> 'metadata_extraction_request'
     OR command_receipt.result_entity_id <> NEW.id
     OR command_receipt.response_hash <> NEW.request_root
     OR command_receipt.audit_event_root <> NEW.audit_event_root
     OR command_receipt.created_at <> NEW.requested_at THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3D_REQUEST_RECEIPT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidence_e3d_request_validate
  ON evidence.metadata_extraction_request_facts;
CREATE TRIGGER evidence_e3d_request_validate
BEFORE INSERT ON evidence.metadata_extraction_request_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e3d_request_insert();

DROP TRIGGER IF EXISTS evidence_e3d_request_append_only
  ON evidence.metadata_extraction_request_facts;
CREATE TRIGGER evidence_e3d_request_append_only
BEFORE UPDATE OR DELETE ON evidence.metadata_extraction_request_facts
FOR EACH ROW EXECUTE FUNCTION evidence.e3b_reject_mutation();

DROP TRIGGER IF EXISTS evidence_e3d_request_audit
  ON evidence.metadata_extraction_request_facts;
CREATE TRIGGER evidence_e3d_request_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.metadata_extraction_request_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE evidence.metadata_extraction_request_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.metadata_extraction_request_facts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_e3d_request_tenant
  ON evidence.metadata_extraction_request_facts;
CREATE POLICY evidence_e3d_request_tenant
ON evidence.metadata_extraction_request_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));
