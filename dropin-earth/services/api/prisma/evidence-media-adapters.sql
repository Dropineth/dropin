-- CanopyProof evidence media adapter verification authority.
-- Apply after canopyproof-os.sql and evidence-device-attestation-adapters.sql.
-- This migration is additive and route-closed.

CREATE OR REPLACE FUNCTION evidence.e2a_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'appendOnly', true,
    'organizationBound', true,
    'projectBound', true,
    'evidenceBound', true,
    'objectBound', true,
    'semanticEventBound', true,
    'commandReceiptBound', true,
    'providerReceiptVerifiedIndependently', true,
    'retentionPolicyVerifiedIndependently', true,
    'scannerSignatureVerifiedIndependently', true,
    'noPersistedUploadGrant', true,
    'noRawSignature', true,
    'noProviderCredential', true,
    'notAvailabilityDecision', true,
    'notFinalProofAuthority', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true
  );
$$;

CREATE TABLE IF NOT EXISTS evidence.media_provider_receipt_verification_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  evidence_id text NOT NULL REFERENCES evidence.evidence_objects(id),
  object_id text NOT NULL UNIQUE REFERENCES evidence.media_object_facts(id),
  object_root text NOT NULL CHECK (object_root ~ '^[0-9a-f]{64}$'),
  intent_id text NOT NULL UNIQUE REFERENCES evidence.media_upload_intent_facts(id),
  intent_root text NOT NULL CHECK (intent_root ~ '^[0-9a-f]{64}$'),
  verifier_id text NOT NULL REFERENCES identity.participants(id),
  verifier_snapshot jsonb NOT NULL CHECK (jsonb_typeof(verifier_snapshot) = 'object'),
  storage_provider text NOT NULL CHECK (storage_provider IN ('cloudflare_r2', 's3', 'gcs')),
  provider_namespace text NOT NULL CHECK (length(btrim(provider_namespace)) BETWEEN 1 AND 240),
  object_key text NOT NULL CHECK (length(btrim(object_key)) BETWEEN 1 AND 1024),
  object_version text NOT NULL CHECK (length(btrim(object_version)) BETWEEN 1 AND 512),
  content_hash text NOT NULL CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  content_type text NOT NULL CHECK (
    content_type IN ('image/jpeg', 'image/png', 'image/webp', 'application/json')
  ),
  byte_length bigint NOT NULL CHECK (byte_length > 0 AND byte_length <= 52428800),
  etag_hash text NOT NULL CHECK (etag_hash ~ '^[0-9a-f]{64}$'),
  uploaded_at timestamptz NOT NULL,
  encryption_mode text NOT NULL CHECK (encryption_mode IN ('r2_managed', 'sse_kms', 'client_side')),
  encryption_key_ref text CHECK (
    encryption_key_ref IS NULL OR length(btrim(encryption_key_ref)) BETWEEN 1 AND 240
  ),
  object_lock_mode text NOT NULL CHECK (object_lock_mode IN ('none', 'governance', 'compliance')),
  retain_until timestamptz,
  retention_policy_root text CHECK (
    retention_policy_root IS NULL OR retention_policy_root ~ '^[0-9a-f]{64}$'
  ),
  retention_verification_state text NOT NULL CHECK (
    retention_verification_state IN ('modeled_only', 'verified')
  ),
  provider_receipt_hash text NOT NULL UNIQUE CHECK (provider_receipt_hash ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz NOT NULL,
  provider_verification_root text NOT NULL UNIQUE CHECK (
    provider_verification_root ~ '^[0-9a-f]{64}$'
  ),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  evidence_sequence bigint NOT NULL CHECK (evidence_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  command_receipt_id text NOT NULL UNIQUE REFERENCES audit.command_receipts(id),
  fact_root text NOT NULL UNIQUE CHECK (fact_root ~ '^[0-9a-f]{64}$'),
  safety jsonb NOT NULL CHECK (jsonb_typeof(safety) = 'object'),
  UNIQUE (evidence_id, evidence_sequence),
  CHECK (uploaded_at = date_trunc('milliseconds', uploaded_at)),
  CHECK (verified_at = date_trunc('milliseconds', verified_at)),
  CHECK (verified_at >= uploaded_at),
  CHECK (
    (encryption_mode = 'sse_kms' AND encryption_key_ref IS NOT NULL)
    OR encryption_mode <> 'sse_kms'
  ),
  CHECK (
    (object_lock_mode = 'none' AND retain_until IS NULL AND retention_policy_root IS NULL)
    OR (
      object_lock_mode <> 'none'
      AND retain_until IS NOT NULL
      AND retention_policy_root IS NOT NULL
      AND retain_until > uploaded_at
    )
  ),
  CHECK (
    retention_verification_state <> 'verified'
    OR (object_lock_mode <> 'none' AND retention_policy_root IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS evidence_media_provider_verification_org_time
  ON evidence.media_provider_receipt_verification_facts (
    organization_id, verified_at DESC, id DESC
  );

CREATE INDEX IF NOT EXISTS evidence_media_provider_verification_evidence
  ON evidence.media_provider_receipt_verification_facts (
    evidence_id, evidence_sequence, id
  );

CREATE TABLE IF NOT EXISTS evidence.media_scanner_receipt_verification_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  evidence_id text NOT NULL REFERENCES evidence.evidence_objects(id),
  object_id text NOT NULL REFERENCES evidence.media_object_facts(id),
  object_root text NOT NULL CHECK (object_root ~ '^[0-9a-f]{64}$'),
  scan_result_id text NOT NULL UNIQUE REFERENCES evidence.media_scan_result_facts(id),
  scan_root text NOT NULL CHECK (scan_root ~ '^[0-9a-f]{64}$'),
  verifier_id text NOT NULL REFERENCES identity.participants(id),
  verifier_snapshot jsonb NOT NULL CHECK (jsonb_typeof(verifier_snapshot) = 'object'),
  scanner_id text NOT NULL CHECK (length(btrim(scanner_id)) BETWEEN 1 AND 240),
  signer_key_id text NOT NULL CHECK (length(btrim(signer_key_id)) BETWEEN 1 AND 240),
  signature_algorithm text NOT NULL CHECK (signature_algorithm = 'ed25519'),
  signature_hash text NOT NULL CHECK (signature_hash ~ '^[0-9a-f]{64}$'),
  scanner_policy_root text NOT NULL CHECK (scanner_policy_root ~ '^[0-9a-f]{64}$'),
  object_provider_receipt_hash text NOT NULL CHECK (
    object_provider_receipt_hash ~ '^[0-9a-f]{64}$'
  ),
  scanner_receipt_hash text NOT NULL UNIQUE CHECK (scanner_receipt_hash ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz NOT NULL,
  scanner_verification_root text NOT NULL UNIQUE CHECK (
    scanner_verification_root ~ '^[0-9a-f]{64}$'
  ),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  evidence_sequence bigint NOT NULL CHECK (evidence_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  command_receipt_id text NOT NULL UNIQUE REFERENCES audit.command_receipts(id),
  fact_root text NOT NULL UNIQUE CHECK (fact_root ~ '^[0-9a-f]{64}$'),
  safety jsonb NOT NULL CHECK (jsonb_typeof(safety) = 'object'),
  UNIQUE (evidence_id, evidence_sequence),
  CHECK (verified_at = date_trunc('milliseconds', verified_at))
);

CREATE INDEX IF NOT EXISTS evidence_media_scanner_verification_org_time
  ON evidence.media_scanner_receipt_verification_facts (
    organization_id, verified_at DESC, id DESC
  );

CREATE INDEX IF NOT EXISTS evidence_media_scanner_verification_object
  ON evidence.media_scanner_receipt_verification_facts (
    object_id, verified_at DESC, id DESC
  );

CREATE OR REPLACE FUNCTION evidence.e2a_provider_receipt_seed(
  fact evidence.media_provider_receipt_verification_facts
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_build_object(
    'intentId', fact.intent_id,
    'intentRoot', fact.intent_root,
    'provider', fact.storage_provider,
    'providerNamespace', fact.provider_namespace,
    'objectKey', fact.object_key,
    'objectVersion', fact.object_version,
    'contentHash', fact.content_hash,
    'contentType', fact.content_type,
    'byteLength', fact.byte_length,
    'etagHash', fact.etag_hash,
    'uploadedAt', audit.iso8601_millis(fact.uploaded_at),
    'encryptionMode', fact.encryption_mode,
    'objectLockMode', fact.object_lock_mode,
    'retentionVerificationState', fact.retention_verification_state,
    'verifiedAt', audit.iso8601_millis(fact.verified_at)
  )
  || CASE WHEN fact.encryption_key_ref IS NULL THEN '{}'::jsonb
     ELSE jsonb_build_object('encryptionKeyRef', fact.encryption_key_ref) END
  || CASE WHEN fact.retain_until IS NULL THEN '{}'::jsonb
     ELSE jsonb_build_object('retainUntil', audit.iso8601_millis(fact.retain_until)) END
  || CASE WHEN fact.retention_policy_root IS NULL THEN '{}'::jsonb
     ELSE jsonb_build_object('retentionPolicyRoot', fact.retention_policy_root) END;
$$;

CREATE OR REPLACE FUNCTION evidence.e2a_provider_receipt_hash(
  fact evidence.media_provider_receipt_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-stored-object-provider-receipt-v1')
    || evidence.e2a_provider_receipt_seed(fact)
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e2a_provider_verification_root(
  fact evidence.media_provider_receipt_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-stored-object-provider-verification-v1',
    'intentId', fact.intent_id,
    'intentRoot', fact.intent_root,
    'provider', fact.storage_provider,
    'providerNamespace', fact.provider_namespace,
    'providerReceiptHash', fact.provider_receipt_hash,
    'verifiedAt', audit.iso8601_millis(fact.verified_at)
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e2a_provider_command_hash(
  fact evidence.media_provider_receipt_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-media-provider-verification-command-v1',
    'objectId', fact.object_id,
    'objectRoot', fact.object_root,
    'providerReceiptHash', fact.provider_receipt_hash,
    'providerVerificationRoot', fact.provider_verification_root,
    'verifierId', fact.verifier_id,
    'verifierAuthorityRoot', fact.verifier_snapshot->>'authorityRoot',
    'verifiedAt', audit.iso8601_millis(fact.verified_at)
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e2a_provider_fact_root(
  fact evidence.media_provider_receipt_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-media-provider-verification-fact-root-v1',
    'commandHash', fact.command_hash,
    'providerVerificationRoot', fact.provider_verification_root,
    'auditEventRoot', fact.audit_event_root,
    'commandReceiptId', fact.command_receipt_id,
    'safety', fact.safety
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e2a_scanner_receipt_hash(
  fact evidence.media_scanner_receipt_verification_facts
)
RETURNS text
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE
  scan_fact evidence.media_scan_result_facts%ROWTYPE;
BEGIN
  SELECT * INTO STRICT scan_fact
  FROM evidence.media_scan_result_facts
  WHERE id = fact.scan_result_id;
  RETURN audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-malware-scan-receipt-v1',
    'objectId', fact.object_id,
    'objectRoot', fact.object_root,
    'providerReceiptHash', fact.object_provider_receipt_hash,
    'scannerId', fact.scanner_id,
    'scannerName', scan_fact.scanner_name,
    'scannerVersion', scan_fact.scanner_version,
    'scannerImageDigest', scan_fact.scanner_image_digest,
    'signatureDatabaseVersion', scan_fact.signature_database_version,
    'verdict', scan_fact.verdict,
    'findingHashes', to_jsonb(scan_fact.finding_hashes),
    'scannedAt', audit.iso8601_millis(scan_fact.scanned_at),
    'signerKeyId', fact.signer_key_id,
    'signatureAlgorithm', fact.signature_algorithm
  ));
END;
$$;

CREATE OR REPLACE FUNCTION evidence.e2a_scanner_verification_root(
  fact evidence.media_scanner_receipt_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-malware-scan-verification-v1',
    'receiptHash', fact.scanner_receipt_hash,
    'signerKeyId', fact.signer_key_id,
    'scannerPolicyRoot', fact.scanner_policy_root,
    'signatureHash', fact.signature_hash,
    'verifiedAt', audit.iso8601_millis(fact.verified_at)
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e2a_scanner_command_hash(
  fact evidence.media_scanner_receipt_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-media-scanner-verification-command-v1',
    'scanResultId', fact.scan_result_id,
    'scanRoot', fact.scan_root,
    'scannerReceiptHash', fact.scanner_receipt_hash,
    'scannerVerificationRoot', fact.scanner_verification_root,
    'verifierId', fact.verifier_id,
    'verifierAuthorityRoot', fact.verifier_snapshot->>'authorityRoot',
    'verifiedAt', audit.iso8601_millis(fact.verified_at)
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e2a_scanner_fact_root(
  fact evidence.media_scanner_receipt_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-media-scanner-verification-fact-root-v1',
    'commandHash', fact.command_hash,
    'scannerVerificationRoot', fact.scanner_verification_root,
    'auditEventRoot', fact.audit_event_root,
    'commandReceiptId', fact.command_receipt_id,
    'safety', fact.safety
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e2a_provider_verification_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  object_fact evidence.media_object_facts%ROWTYPE;
  intent_fact evidence.media_upload_intent_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  command_receipt audit.command_receipts%ROWTYPE;
  expected_action text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT object_fact
  FROM evidence.media_object_facts WHERE id = NEW.object_id FOR SHARE;
  SELECT * INTO STRICT intent_fact
  FROM evidence.media_upload_intent_facts WHERE id = NEW.intent_id FOR SHARE;
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT * INTO STRICT command_receipt
  FROM audit.command_receipts WHERE id = NEW.command_receipt_id;
  expected_action := CASE
    WHEN NEW.retention_verification_state = 'verified' THEN 'FULFILL'
    ELSE 'REASON'
  END;

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.verifier_id
     OR transaction_organization_id <> NEW.organization_id
     OR NEW.verifier_snapshot->>'id' <> NEW.verifier_id
     OR NOT evidence.evidence_media_agent_is_valid(
       NEW.verifier_snapshot, NEW.organization_id, 'object_storage_receipt'
     )
     OR NEW.organization_id <> object_fact.organization_id
     OR NEW.project_id <> object_fact.project_id
     OR NEW.evidence_id <> object_fact.evidence_id
     OR NEW.object_root <> object_fact.object_root
     OR NEW.intent_id <> object_fact.intent_id
     OR NEW.intent_id <> intent_fact.id
     OR NEW.intent_root <> intent_fact.intent_root
     OR NEW.intent_root <> object_fact.intent_root
     OR NEW.storage_provider <> object_fact.storage_provider
     OR NEW.provider_namespace <> object_fact.provider_namespace
     OR NEW.object_key <> object_fact.object_key
     OR NEW.object_key <> intent_fact.object_key
     OR NEW.object_version <> object_fact.object_version
     OR NEW.content_hash <> object_fact.content_hash
     OR NEW.content_type <> object_fact.content_type
     OR NEW.byte_length <> object_fact.byte_length
     OR NEW.etag_hash <> object_fact.etag_hash
     OR NEW.uploaded_at <> object_fact.stored_at
     OR NEW.encryption_mode <> object_fact.encryption_mode
     OR NEW.encryption_key_ref IS DISTINCT FROM object_fact.encryption_key_ref
     OR NEW.object_lock_mode <> object_fact.object_lock_mode
     OR NEW.retain_until IS DISTINCT FROM object_fact.retain_until
     OR object_fact.provider_verification_state <> 'modeled_only'
     OR NEW.provider_receipt_hash <> object_fact.provider_receipt_hash
     OR NEW.provider_receipt_hash <> evidence.e2a_provider_receipt_hash(NEW)
     OR NEW.provider_verification_root <> evidence.e2a_provider_verification_root(NEW)
     OR NEW.verified_at < NEW.uploaded_at
     OR NOT evidence.evidence_media_safe_material(ARRAY[
       NEW.provider_namespace,
       NEW.object_version,
       COALESCE(NEW.encryption_key_ref, '')
     ])
     OR NEW.safety <> evidence.e2a_safety_canonical() THEN
    RAISE EXCEPTION 'CANOPYPROOF_E2A_PROVIDER_VERIFICATION_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-media-adapter:' || NEW.evidence_id
     OR semantic_event.sequence_no <> NEW.evidence_sequence
     OR semantic_event.action <> expected_action
     OR semantic_event.actor_id <> NEW.verifier_id
     OR semantic_event.entity_type <> 'media_provider_receipt_verification'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.verified_at
     OR semantic_event.payload_hash <> NEW.provider_verification_root
     OR semantic_event.rationale <>
       'An independent provider receipt and retention-policy verification fact was appended.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_E2A_PROVIDER_VERIFICATION_EVENT_INVALID';
  END IF;

  IF NEW.command_hash <> evidence.e2a_provider_command_hash(NEW)
     OR NEW.id <> 'cp_media_provider_verify_' || left(NEW.command_hash, 24)
     OR NEW.fact_root <> evidence.e2a_provider_fact_root(NEW)
     OR command_receipt.actor_id <> NEW.verifier_id
     OR command_receipt.operation <> 'evidence.media-provider-receipt.verify'
     OR command_receipt.idempotency_key_hash <> NEW.command_hash
     OR command_receipt.request_hash <> NEW.command_hash
     OR command_receipt.result_entity_type <> 'media_provider_receipt_verification'
     OR command_receipt.result_entity_id <> NEW.id
     OR command_receipt.response_hash <> NEW.fact_root
     OR command_receipt.audit_event_root <> NEW.audit_event_root
     OR command_receipt.created_at <> NEW.verified_at THEN
    RAISE EXCEPTION 'CANOPYPROOF_E2A_PROVIDER_VERIFICATION_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e2a_scanner_verification_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  object_fact evidence.media_object_facts%ROWTYPE;
  provider_fact evidence.media_provider_receipt_verification_facts%ROWTYPE;
  scan_fact evidence.media_scan_result_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  command_receipt audit.command_receipts%ROWTYPE;
  expected_action text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT object_fact
  FROM evidence.media_object_facts WHERE id = NEW.object_id FOR SHARE;
  SELECT * INTO STRICT provider_fact
  FROM evidence.media_provider_receipt_verification_facts
  WHERE object_id = NEW.object_id FOR SHARE;
  SELECT * INTO STRICT scan_fact
  FROM evidence.media_scan_result_facts WHERE id = NEW.scan_result_id FOR SHARE;
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT * INTO STRICT command_receipt
  FROM audit.command_receipts WHERE id = NEW.command_receipt_id;
  expected_action := CASE WHEN scan_fact.verdict = 'clean' THEN 'FULFILL' ELSE 'CHALLENGE' END;

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.verifier_id
     OR transaction_organization_id <> NEW.organization_id
     OR NEW.verifier_snapshot->>'id' <> NEW.verifier_id
     OR NOT evidence.evidence_media_agent_is_valid(
       NEW.verifier_snapshot, NEW.organization_id, 'malware_scan_result'
     )
     OR NEW.organization_id <> object_fact.organization_id
     OR NEW.organization_id <> scan_fact.organization_id
     OR NEW.project_id <> object_fact.project_id
     OR NEW.project_id <> scan_fact.project_id
     OR NEW.evidence_id <> object_fact.evidence_id
     OR NEW.evidence_id <> scan_fact.evidence_id
     OR NEW.object_id <> scan_fact.object_id
     OR NEW.object_root <> object_fact.object_root
     OR NEW.object_root <> scan_fact.object_root
     OR provider_fact.organization_id <> NEW.organization_id
     OR provider_fact.object_root <> NEW.object_root
     OR provider_fact.provider_receipt_hash <> object_fact.provider_receipt_hash
     OR NEW.scan_root <> scan_fact.scan_root
     OR NEW.object_provider_receipt_hash <> object_fact.provider_receipt_hash
     OR NEW.scanner_receipt_hash <> scan_fact.provider_receipt_hash
     OR NEW.scanner_receipt_hash <> evidence.e2a_scanner_receipt_hash(NEW)
     OR NEW.scanner_verification_root <> evidence.e2a_scanner_verification_root(NEW)
     OR NEW.verified_at < scan_fact.scanned_at
     OR NEW.verified_at < provider_fact.verified_at
     OR scan_fact.provider_verification_state <> 'modeled_only'
     OR NOT evidence.evidence_media_safe_material(ARRAY[
       NEW.scanner_id,
       NEW.signer_key_id
     ])
     OR NEW.safety <> evidence.e2a_safety_canonical() THEN
    RAISE EXCEPTION 'CANOPYPROOF_E2A_SCANNER_VERIFICATION_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-media-adapter:' || NEW.evidence_id
     OR semantic_event.sequence_no <> NEW.evidence_sequence
     OR semantic_event.action <> expected_action
     OR semantic_event.actor_id <> NEW.verifier_id
     OR semantic_event.entity_type <> 'media_scanner_receipt_verification'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.verified_at
     OR semantic_event.payload_hash <> NEW.scanner_verification_root
     OR semantic_event.rationale <>
       'An independently signed malware-scanner receipt verification fact was appended.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_E2A_SCANNER_VERIFICATION_EVENT_INVALID';
  END IF;

  IF NEW.command_hash <> evidence.e2a_scanner_command_hash(NEW)
     OR NEW.id <> 'cp_media_scanner_verify_' || left(NEW.command_hash, 24)
     OR NEW.fact_root <> evidence.e2a_scanner_fact_root(NEW)
     OR command_receipt.actor_id <> NEW.verifier_id
     OR command_receipt.operation <> 'evidence.media-scanner-receipt.verify'
     OR command_receipt.idempotency_key_hash <> NEW.command_hash
     OR command_receipt.request_hash <> NEW.command_hash
     OR command_receipt.result_entity_type <> 'media_scanner_receipt_verification'
     OR command_receipt.result_entity_id <> NEW.id
     OR command_receipt.response_hash <> NEW.fact_root
     OR command_receipt.audit_event_root <> NEW.audit_event_root
     OR command_receipt.created_at <> NEW.verified_at THEN
    RAISE EXCEPTION 'CANOPYPROOF_E2A_SCANNER_VERIFICATION_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidence_e2a_provider_validate
  ON evidence.media_provider_receipt_verification_facts;
CREATE TRIGGER evidence_e2a_provider_validate
BEFORE INSERT ON evidence.media_provider_receipt_verification_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e2a_provider_verification_insert();

DROP TRIGGER IF EXISTS evidence_e2a_scanner_validate
  ON evidence.media_scanner_receipt_verification_facts;
CREATE TRIGGER evidence_e2a_scanner_validate
BEFORE INSERT ON evidence.media_scanner_receipt_verification_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e2a_scanner_verification_insert();

DROP TRIGGER IF EXISTS evidence_e2a_provider_append_only
  ON evidence.media_provider_receipt_verification_facts;
CREATE TRIGGER evidence_e2a_provider_append_only
BEFORE UPDATE OR DELETE ON evidence.media_provider_receipt_verification_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();

DROP TRIGGER IF EXISTS evidence_e2a_scanner_append_only
  ON evidence.media_scanner_receipt_verification_facts;
CREATE TRIGGER evidence_e2a_scanner_append_only
BEFORE UPDATE OR DELETE ON evidence.media_scanner_receipt_verification_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();

DROP TRIGGER IF EXISTS evidence_e2a_provider_audit
  ON evidence.media_provider_receipt_verification_facts;
CREATE TRIGGER evidence_e2a_provider_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.media_provider_receipt_verification_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS evidence_e2a_scanner_audit
  ON evidence.media_scanner_receipt_verification_facts;
CREATE TRIGGER evidence_e2a_scanner_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.media_scanner_receipt_verification_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE evidence.media_provider_receipt_verification_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.media_provider_receipt_verification_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE evidence.media_scanner_receipt_verification_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.media_scanner_receipt_verification_facts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_e2a_provider_tenant
  ON evidence.media_provider_receipt_verification_facts;
CREATE POLICY evidence_e2a_provider_tenant
ON evidence.media_provider_receipt_verification_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS evidence_e2a_scanner_tenant
  ON evidence.media_scanner_receipt_verification_facts;
CREATE POLICY evidence_e2a_scanner_tenant
ON evidence.media_scanner_receipt_verification_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

CREATE OR REPLACE FUNCTION evidence.media_adapter_trust_projection(
  target_object_id text,
  evaluated_at timestamptz
)
RETURNS TABLE (
  object_id text,
  object_root text,
  organization_id text,
  provider_verification_fact_id text,
  provider_verification_root text,
  retention_verification_state text,
  latest_scan_result_id text,
  latest_scan_root text,
  scanner_verification_fact_id text,
  scanner_verification_root text,
  state text,
  evaluated_at_utc timestamptz,
  projection_root text,
  safety jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  object_fact evidence.media_object_facts%ROWTYPE;
  provider_fact evidence.media_provider_receipt_verification_facts%ROWTYPE;
  scan_fact evidence.media_scan_result_facts%ROWTYPE;
  scanner_fact evidence.media_scanner_receipt_verification_facts%ROWTYPE;
  projected_state text;
  projected_root text;
  boundary jsonb := evidence.e2a_safety_canonical();
BEGIN
  SELECT * INTO STRICT object_fact
  FROM evidence.media_object_facts WHERE id = target_object_id;
  IF object_fact.stored_at > evaluated_at THEN
    RAISE EXCEPTION 'CANOPYPROOF_E2A_OBJECT_NOT_VISIBLE_AT_EVALUATION';
  END IF;
  SELECT * INTO provider_fact
  FROM evidence.media_provider_receipt_verification_facts
  WHERE media_provider_receipt_verification_facts.object_id = target_object_id
    AND verified_at <= evaluated_at;
  SELECT * INTO scan_fact
  FROM evidence.media_scan_result_facts
  WHERE media_scan_result_facts.object_id = target_object_id
    AND scanned_at <= evaluated_at
  ORDER BY evidence_sequence DESC, id DESC
  LIMIT 1;
  IF scan_fact.id IS NOT NULL THEN
    SELECT * INTO scanner_fact
    FROM evidence.media_scanner_receipt_verification_facts
    WHERE scan_result_id = scan_fact.id
      AND verified_at <= evaluated_at;
  END IF;

  projected_state := CASE
    WHEN provider_fact.id IS NULL THEN 'provider_pending'
    WHEN provider_fact.retention_verification_state <> 'verified' THEN 'retention_pending'
    WHEN scan_fact.id IS NULL OR scanner_fact.id IS NULL THEN 'scanner_pending'
    WHEN scan_fact.verdict <> 'clean' THEN 'receipt_challenged'
    ELSE 'verified_receipts'
  END;
  projected_root := audit.sha256_stable_json(jsonb_strip_nulls(jsonb_build_object(
    'kind', 'canopyproof-media-adapter-trust-projection-v1',
    'objectId', object_fact.id,
    'objectRoot', object_fact.object_root,
    'providerVerificationRoot', provider_fact.provider_verification_root,
    'retentionVerificationState', provider_fact.retention_verification_state,
    'latestScanResultId', scan_fact.id,
    'latestScanRoot', scan_fact.scan_root,
    'scannerVerificationRoot', scanner_fact.scanner_verification_root,
    'state', projected_state,
    'evaluatedAt', audit.iso8601_millis(evaluated_at),
    'safety', boundary
  )));
  RETURN QUERY SELECT
    object_fact.id,
    object_fact.object_root,
    object_fact.organization_id,
    provider_fact.id,
    provider_fact.provider_verification_root,
    provider_fact.retention_verification_state,
    scan_fact.id,
    scan_fact.scan_root,
    scanner_fact.id,
    scanner_fact.scanner_verification_root,
    projected_state,
    evaluated_at,
    projected_root,
    boundary;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.effective_media_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'derivedProjectionOnly', true,
    'baseProjectionBound', true,
    'adapterTrustProjectionBound', true,
    'asOfEvaluationBound', true,
    'hardStateCannotBePromoted', true,
    'verifiedReceiptsRequired', true,
    'activeConsentRequired', true,
    'currentDeviceRequired', true,
    'notFinalProofAuthority', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true
  );
$$;

CREATE OR REPLACE FUNCTION evidence.effective_media_object_projection(
  target_object_id text,
  evaluated_at timestamptz
)
RETURNS TABLE (
  object_id text,
  object_root text,
  organization_id text,
  project_id text,
  evidence_id text,
  base_projection_root text,
  adapter_trust_projection_root text,
  device_trust_projection_root text,
  state text,
  issue_codes text[],
  evaluated_at_utc timestamptz,
  projection_root text,
  safety jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  base_projection record;
  adapter_projection record;
  media_intent evidence.media_upload_intent_facts%ROWTYPE;
  media_object evidence.media_object_facts%ROWTYPE;
  device_projection record;
  projected_state text;
  projected_issues text[] := ARRAY[]::text[];
  projected_root text;
  boundary jsonb := evidence.effective_media_safety_canonical();
BEGIN
  SELECT * INTO STRICT base_projection
  FROM evidence.media_object_projection(target_object_id, evaluated_at);
  SELECT * INTO STRICT adapter_projection
  FROM evidence.media_adapter_trust_projection(target_object_id, evaluated_at);
  SELECT * INTO STRICT media_object
  FROM evidence.media_object_facts
  WHERE id = target_object_id;
  SELECT * INTO STRICT media_intent
  FROM evidence.media_upload_intent_facts
  WHERE id = media_object.intent_id;
  SELECT * INTO STRICT device_projection
  FROM evidence.effective_device_attestation_projection(
    media_intent.device_attestation_id,
    evaluated_at
  );

  IF base_projection.object_id <> adapter_projection.object_id
     OR base_projection.object_root <> adapter_projection.object_root
     OR base_projection.organization_id <> adapter_projection.organization_id
     OR base_projection.evaluated_at_utc <> adapter_projection.evaluated_at_utc
     OR device_projection.organization_id <> base_projection.organization_id
     OR device_projection.evaluated_at_utc <> base_projection.evaluated_at_utc
     OR device_projection.state <> base_projection.device_state THEN
    RAISE EXCEPTION 'CANOPYPROOF_EFFECTIVE_MEDIA_PROJECTION_AUTHORITY_MISMATCH';
  END IF;

  IF base_projection.state = 'duplicate' THEN
    projected_issues := array_append(projected_issues, 'media_duplicate');
  ELSIF base_projection.state = 'pending_scan' THEN
    projected_issues := array_append(projected_issues, 'media_scan_pending');
  ELSIF base_projection.state = 'quarantined' THEN
    projected_issues := array_append(projected_issues, 'media_quarantined');
  END IF;
  IF base_projection.consent_state <> 'active' THEN
    projected_issues := array_append(projected_issues, 'media_consent_inactive');
  END IF;
  IF base_projection.device_state <> 'current' THEN
    projected_issues := array_append(projected_issues, 'media_device_not_current');
  END IF;
  IF adapter_projection.state = 'provider_pending' THEN
    projected_issues := array_append(projected_issues, 'media_provider_verification_pending');
  ELSIF adapter_projection.state = 'retention_pending' THEN
    projected_issues := array_append(projected_issues, 'media_retention_verification_pending');
  ELSIF adapter_projection.state = 'scanner_pending' THEN
    projected_issues := array_append(projected_issues, 'media_scanner_verification_pending');
  ELSIF adapter_projection.state = 'receipt_challenged' THEN
    projected_issues := array_append(projected_issues, 'media_receipt_challenged');
  END IF;
  SELECT COALESCE(array_agg(DISTINCT issue ORDER BY issue), ARRAY[]::text[])
  INTO projected_issues
  FROM unnest(projected_issues) AS issue;

  projected_state := CASE
    WHEN base_projection.state IN ('duplicate', 'pending_scan', 'quarantined')
      THEN base_projection.state
    WHEN base_projection.consent_state = 'active'
      AND base_projection.device_state = 'current'
      AND adapter_projection.state = 'verified_receipts'
      THEN 'available'
    ELSE 'needs_review'
  END;
  projected_root := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-effective-media-object-projection-v2',
    'objectId', base_projection.object_id,
    'objectRoot', base_projection.object_root,
    'organizationId', base_projection.organization_id,
    'projectId', base_projection.project_id,
    'evidenceId', base_projection.evidence_id,
    'baseProjectionRoot', base_projection.projection_root,
    'adapterTrustProjectionRoot', adapter_projection.projection_root,
    'deviceTrustProjectionRoot', device_projection.projection_root,
    'state', projected_state,
    'issueCodes', to_jsonb(projected_issues),
    'evaluatedAt', audit.iso8601_millis(evaluated_at),
    'safety', boundary
  ));

  RETURN QUERY SELECT
    base_projection.object_id,
    base_projection.object_root,
    base_projection.organization_id,
    base_projection.project_id,
    base_projection.evidence_id,
    base_projection.projection_root,
    adapter_projection.projection_root,
    device_projection.projection_root,
    projected_state,
    projected_issues,
    evaluated_at,
    projected_root,
    boundary;
END;
$$;
