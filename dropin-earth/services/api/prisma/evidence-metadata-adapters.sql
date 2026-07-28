-- CanopyProof E3c signed metadata-extraction verification authority.
-- Apply after canopyproof-os.sql and evidence-metadata-retention.sql.
-- This migration is additive, route-closed, and never rewrites E3b facts.

CREATE OR REPLACE FUNCTION evidence.e3c_safety_canonical()
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
    'extractionBound', true,
    'semanticEventBound', true,
    'commandReceiptBound', true,
    'extractorSignatureVerifiedIndependently', true,
    'baseExtractionRemainsModeledOnly', true,
    'noRawExif', true,
    'noRawGps', true,
    'noPreciseLocation', true,
    'noRawSignature', true,
    'noProviderCredential', true,
    'notFinalProofAuthority', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true
  );
$$;

CREATE OR REPLACE FUNCTION evidence.e3c_has_forbidden_key(document jsonb)
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
        'uploadurl', 'authorization'
      ]::text[]) THEN
        RETURN true;
      END IF;
      IF evidence.e3c_has_forbidden_key(entry.value) THEN
        RETURN true;
      END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(document)
    LOOP
      IF evidence.e3c_has_forbidden_key(item) THEN
        RETURN true;
      END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;

CREATE TABLE IF NOT EXISTS evidence.metadata_extraction_verification_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  evidence_id text NOT NULL REFERENCES evidence.evidence_objects(id),
  object_id text NOT NULL REFERENCES evidence.media_object_facts(id),
  object_root text NOT NULL CHECK (object_root ~ '^[0-9a-f]{64}$'),
  extraction_id text NOT NULL UNIQUE REFERENCES evidence.media_metadata_extraction_facts(id),
  extraction_root text NOT NULL UNIQUE CHECK (extraction_root ~ '^[0-9a-f]{64}$'),
  verifier_id text NOT NULL REFERENCES identity.participants(id),
  verifier_snapshot jsonb NOT NULL CHECK (jsonb_typeof(verifier_snapshot) = 'object'),
  extractor_id text NOT NULL CHECK (length(btrim(extractor_id)) BETWEEN 1 AND 240),
  signer_key_id text NOT NULL CHECK (length(btrim(signer_key_id)) BETWEEN 1 AND 240),
  signature_algorithm text NOT NULL CHECK (signature_algorithm = 'ed25519'),
  signature_hash text NOT NULL CHECK (signature_hash ~ '^[0-9a-f]{64}$'),
  extractor_policy_root text NOT NULL CHECK (extractor_policy_root ~ '^[0-9a-f]{64}$'),
  metadata_receipt_hash text NOT NULL UNIQUE CHECK (metadata_receipt_hash ~ '^[0-9a-f]{64}$'),
  adapter_verification_root text NOT NULL UNIQUE CHECK (
    adapter_verification_root ~ '^[0-9a-f]{64}$'
  ),
  verified_at timestamptz NOT NULL,
  verification_root text NOT NULL UNIQUE CHECK (verification_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  evidence_sequence bigint NOT NULL CHECK (evidence_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_receipt_id text NOT NULL UNIQUE REFERENCES audit.command_receipts(id),
  fact_root text NOT NULL UNIQUE CHECK (fact_root ~ '^[0-9a-f]{64}$'),
  safety jsonb NOT NULL CHECK (jsonb_typeof(safety) = 'object'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (evidence_id, evidence_sequence),
  CHECK (fact_record->>'factType' = 'evidence_metadata_extraction_receipt_verification'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->>'evidenceId' = evidence_id),
  CHECK (fact_record->>'objectId' = object_id),
  CHECK (fact_record->>'objectRoot' = object_root),
  CHECK (fact_record->>'extractionId' = extraction_id),
  CHECK (fact_record->>'extractionRoot' = extraction_root),
  CHECK (fact_record->>'verifierId' = verifier_id),
  CHECK (fact_record->'verifier' = verifier_snapshot),
  CHECK (fact_record->>'extractorId' = extractor_id),
  CHECK (fact_record->>'signerKeyId' = signer_key_id),
  CHECK (fact_record->>'signatureAlgorithm' = signature_algorithm),
  CHECK (fact_record->>'signatureHash' = signature_hash),
  CHECK (fact_record->>'extractorPolicyRoot' = extractor_policy_root),
  CHECK (fact_record->>'metadataReceiptHash' = metadata_receipt_hash),
  CHECK (fact_record->>'adapterVerificationRoot' = adapter_verification_root),
  CHECK ((fact_record->>'verifiedAt')::timestamptz = verified_at),
  CHECK (fact_record->>'verificationRoot' = verification_root),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK ((fact_record->>'evidenceSequence')::bigint = evidence_sequence),
  CHECK (fact_record->>'previousEventRoot' = previous_event_root),
  CHECK (fact_record->>'commandReceiptId' = command_receipt_id),
  CHECK (fact_record->>'factRoot' = fact_root),
  CHECK (fact_record->'safety' = safety),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE INDEX IF NOT EXISTS evidence_e3c_verification_org_time
  ON evidence.metadata_extraction_verification_facts
  (organization_id, verified_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS evidence_e3c_verification_evidence
  ON evidence.metadata_extraction_verification_facts
  (evidence_id, evidence_sequence, id);

CREATE OR REPLACE FUNCTION evidence.e3c_verification_root(
  fact evidence.metadata_extraction_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-metadata-extraction-receipt-verification-v1',
    'metadataReceiptHash', fact.metadata_receipt_hash,
    'extractionRoot', fact.extraction_root,
    'objectRoot', fact.object_root,
    'extractorId', fact.extractor_id,
    'verifierId', fact.verifier_id,
    'signerKeyId', fact.signer_key_id,
    'extractorPolicyRoot', fact.extractor_policy_root,
    'signatureHash', fact.signature_hash,
    'adapterVerificationRoot', fact.adapter_verification_root,
    'verifiedAt', audit.iso8601_millis(fact.verified_at)
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e3c_command_hash(
  fact evidence.metadata_extraction_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-metadata-extraction-verification-command-v1',
    'extractionId', fact.extraction_id,
    'extractionRoot', fact.extraction_root,
    'objectId', fact.object_id,
    'objectRoot', fact.object_root,
    'metadataReceiptHash', fact.metadata_receipt_hash,
    'verificationRoot', fact.verification_root,
    'verifierId', fact.verifier_id,
    'verifierAuthorityRoot', fact.verifier_snapshot->>'authorityRoot',
    'verifiedAt', audit.iso8601_millis(fact.verified_at)
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e3c_fact_root(
  fact evidence.metadata_extraction_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-metadata-extraction-verification-fact-root-v1',
    'commandHash', fact.command_hash,
    'verificationRoot', fact.verification_root,
    'auditEventRoot', fact.audit_event_root,
    'commandReceiptId', fact.command_receipt_id,
    'safety', fact.safety
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e3c_verification_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  object_fact evidence.media_object_facts%ROWTYPE;
  extraction_fact evidence.media_metadata_extraction_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  command_receipt audit.command_receipts%ROWTYPE;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT object_fact
  FROM evidence.media_object_facts WHERE id = NEW.object_id FOR SHARE;
  SELECT * INTO STRICT extraction_fact
  FROM evidence.media_metadata_extraction_facts WHERE id = NEW.extraction_id FOR SHARE;
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT * INTO STRICT command_receipt
  FROM audit.command_receipts WHERE id = NEW.command_receipt_id;

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.verifier_id
     OR transaction_organization_id <> NEW.organization_id
     OR evidence.e3c_has_forbidden_key(NEW.fact_record)
     OR NOT evidence.e3b_keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','objectId','objectRoot',
         'extractionId','extractionRoot','verifierId','verifier','extractorId','signerKeyId',
         'signatureAlgorithm','signatureHash','extractorPolicyRoot','metadataReceiptHash',
         'adapterVerificationRoot','verifiedAt','verificationRoot','commandHash',
         'evidenceSequence','previousEventRoot','commandReceiptId','factRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','evidenceId','objectId','objectRoot',
         'extractionId','extractionRoot','verifierId','verifier','extractorId','signerKeyId',
         'signatureAlgorithm','signatureHash','extractorPolicyRoot','metadataReceiptHash',
         'adapterVerificationRoot','verifiedAt','verificationRoot','commandHash',
         'evidenceSequence','previousEventRoot','commandReceiptId','factRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.verifier_snapshot->>'id' <> NEW.verifier_id
     OR NOT evidence.evidence_media_agent_is_valid(
       NEW.verifier_snapshot, NEW.organization_id, 'verified_metadata_extraction_receipt'
     )
     OR NEW.organization_id <> object_fact.organization_id
     OR NEW.organization_id <> extraction_fact.organization_id
     OR NEW.project_id <> object_fact.project_id
     OR NEW.project_id <> extraction_fact.project_id
     OR NEW.evidence_id <> object_fact.evidence_id
     OR NEW.evidence_id <> extraction_fact.evidence_id
     OR NEW.object_id <> extraction_fact.object_id
     OR NEW.object_root <> object_fact.object_root
     OR NEW.object_root <> extraction_fact.fact_record->>'objectRoot'
     OR NEW.extraction_root <> extraction_fact.extraction_root
     OR extraction_fact.fact_record->>'providerVerificationState' <> 'modeled_only'
     OR extraction_fact.fact_record->>'extractionState' <> 'needs_review'
     OR NOT (extraction_fact.fact_record->'issueCodes' ? 'metadata_provider_verification_pending')
     OR NEW.metadata_receipt_hash <> extraction_fact.fact_record->>'providerReceiptHash'
     OR NEW.verified_at <> extraction_fact.extracted_at
     OR NEW.verified_at <> date_trunc('milliseconds', NEW.verified_at)
     OR NEW.verification_root <> evidence.e3c_verification_root(NEW)
     OR NOT evidence.evidence_media_safe_material(ARRAY[
       NEW.extractor_id, NEW.signer_key_id
     ])
     OR NEW.safety <> evidence.e3c_safety_canonical() THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3C_VERIFICATION_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-metadata-adapter:' || NEW.evidence_id
     OR semantic_event.sequence_no <> NEW.evidence_sequence
     OR semantic_event.action <> 'FULFILL'
     OR semantic_event.actor_id <> NEW.verifier_id
     OR semantic_event.entity_type <> 'metadata_extraction_receipt_verification'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.verified_at
     OR semantic_event.payload_hash <> NEW.verification_root
     OR semantic_event.rationale <>
       'An independently signed metadata-extraction receipt verification fact was appended.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3C_VERIFICATION_EVENT_INVALID';
  END IF;

  IF NEW.command_hash <> evidence.e3c_command_hash(NEW)
     OR NEW.id <> 'cp_metadata_verify_' || left(NEW.command_hash, 24)
     OR NEW.command_receipt_id <> 'cp_e3c_command_' || left(NEW.command_hash, 24)
     OR NEW.fact_root <> evidence.e3c_fact_root(NEW)
     OR command_receipt.actor_id <> NEW.verifier_id
     OR command_receipt.operation <> 'evidence.metadata-extraction-receipt.verify'
     OR command_receipt.idempotency_key_hash <> NEW.command_hash
     OR command_receipt.request_hash <> NEW.command_hash
     OR command_receipt.result_entity_type <> 'metadata_extraction_receipt_verification'
     OR command_receipt.result_entity_id <> NEW.id
     OR command_receipt.response_hash <> NEW.fact_root
     OR command_receipt.audit_event_root <> NEW.audit_event_root
     OR command_receipt.created_at <> NEW.verified_at THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3C_VERIFICATION_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS evidence_e3c_verification_validate
  ON evidence.metadata_extraction_verification_facts;
CREATE TRIGGER evidence_e3c_verification_validate
BEFORE INSERT ON evidence.metadata_extraction_verification_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e3c_verification_insert();

DROP TRIGGER IF EXISTS evidence_e3c_verification_append_only
  ON evidence.metadata_extraction_verification_facts;
CREATE TRIGGER evidence_e3c_verification_append_only
BEFORE UPDATE OR DELETE ON evidence.metadata_extraction_verification_facts
FOR EACH ROW EXECUTE FUNCTION evidence.e3b_reject_mutation();

DROP TRIGGER IF EXISTS evidence_e3c_verification_audit
  ON evidence.metadata_extraction_verification_facts;
CREATE TRIGGER evidence_e3c_verification_audit
AFTER INSERT OR UPDATE OR DELETE ON evidence.metadata_extraction_verification_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE evidence.metadata_extraction_verification_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence.metadata_extraction_verification_facts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evidence_e3c_verification_tenant
  ON evidence.metadata_extraction_verification_facts;
CREATE POLICY evidence_e3c_verification_tenant
ON evidence.metadata_extraction_verification_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

CREATE OR REPLACE FUNCTION evidence.metadata_extraction_trust_projection(
  target_extraction_id text,
  evaluated_at timestamptz
)
RETURNS TABLE (
  organization_id text,
  project_id text,
  evidence_id text,
  object_id text,
  object_root text,
  extraction_id text,
  extraction_root text,
  verification_fact_id text,
  verification_root text,
  verification_state text,
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
  extraction_fact evidence.media_metadata_extraction_facts%ROWTYPE;
  verification_fact evidence.metadata_extraction_verification_facts%ROWTYPE;
  projected_verification_state text;
  projected_state text;
  projected_issue_codes text[];
  projected_root text;
  boundary jsonb := evidence.e3c_safety_canonical();
  projection_seed jsonb;
BEGIN
  SELECT * INTO STRICT extraction_fact
  FROM evidence.media_metadata_extraction_facts
  WHERE id = target_extraction_id;
  SELECT * INTO verification_fact
  FROM evidence.metadata_extraction_verification_facts
  WHERE metadata_extraction_verification_facts.extraction_id = target_extraction_id
    AND verified_at <= evaluated_at;

  SELECT COALESCE(array_agg(issue ORDER BY issue), ARRAY[]::text[])
  INTO projected_issue_codes
  FROM jsonb_array_elements_text(extraction_fact.fact_record->'issueCodes') AS issue
  WHERE verification_fact.id IS NULL OR issue <> 'metadata_provider_verification_pending';
  projected_verification_state := CASE
    WHEN verification_fact.id IS NULL THEN 'modeled_only'
    ELSE 'verified'
  END;
  projected_state := CASE
    WHEN verification_fact.id IS NOT NULL AND cardinality(projected_issue_codes) = 0 THEN 'accepted'
    ELSE 'needs_review'
  END;
  projection_seed := jsonb_build_object(
    'organizationId', extraction_fact.organization_id,
    'projectId', extraction_fact.project_id,
    'evidenceId', extraction_fact.evidence_id,
    'objectId', extraction_fact.object_id,
    'objectRoot', extraction_fact.fact_record->>'objectRoot',
    'extractionId', extraction_fact.id,
    'extractionRoot', extraction_fact.extraction_root
  ) || CASE WHEN verification_fact.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'verificationFactId', verification_fact.id,
    'verificationRoot', verification_fact.verification_root
  ) END || jsonb_build_object(
    'verificationState', projected_verification_state,
    'state', projected_state,
    'issueCodes', to_jsonb(projected_issue_codes),
    'evaluatedAt', audit.iso8601_millis(evaluated_at),
    'safety', boundary
  );
  projected_root := audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-effective-metadata-extraction-projection-v1') ||
    projection_seed
  );
  RETURN QUERY SELECT
    extraction_fact.organization_id,
    extraction_fact.project_id,
    extraction_fact.evidence_id,
    extraction_fact.object_id,
    extraction_fact.fact_record->>'objectRoot',
    extraction_fact.id,
    extraction_fact.extraction_root,
    verification_fact.id,
    verification_fact.verification_root,
    projected_verification_state,
    projected_state,
    projected_issue_codes,
    evaluated_at,
    projected_root,
    boundary;
END;
$$;
