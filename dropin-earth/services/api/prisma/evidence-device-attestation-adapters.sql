-- CanopyProof E1a trusted device-attestation provider verification authority.
-- Apply after canopyproof-os.sql. This migration is additive and route-closed.
-- It never rewrites identity.device_attestations or grants final evidence trust.

CREATE OR REPLACE FUNCTION evidence.e1a_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'appendOnly', true,
    'organizationBound', true,
    'subjectBound', true,
    'consentBound', true,
    'baseAttestationBound', true,
    'semanticEventBound', true,
    'commandReceiptBound', true,
    'providerSignatureVerifiedIndependently', true,
    'baseAttestationRemainsModeledOnly', true,
    'strictAsOfProjection', true,
    'noRawDeviceIdentifier', true,
    'noRawAttestation', true,
    'noRawChallenge', true,
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

CREATE OR REPLACE FUNCTION evidence.e1a_has_forbidden_key(document jsonb)
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
        'signature', 'rawsignature', 'rawattestation', 'attestationobject',
        'rawchallenge', 'challenge', 'deviceidentifier', 'serialnumber',
        'certificatechain', 'credential', 'providercredential', 'privatekey',
        'secret', 'accesskey', 'accesstoken', 'refreshtoken', 'authorization',
        'endpoint', 'url'
      ]::text[]) THEN
        RETURN true;
      END IF;
      IF evidence.e1a_has_forbidden_key(entry.value) THEN RETURN true; END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(document)
    LOOP
      IF evidence.e1a_has_forbidden_key(item) THEN RETURN true; END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION evidence.e1a_keys_are_valid(
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
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(document) AS key
      WHERE NOT (key = ANY(allowed_keys))
    )
    AND NOT EXISTS (
      SELECT 1 FROM unnest(required_keys) AS key
      WHERE NOT (document ? key)
    );
$$;

CREATE TABLE IF NOT EXISTS identity.device_attestation_verification_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  subject_id text NOT NULL REFERENCES identity.participants(id),
  subject_root text NOT NULL CHECK (subject_root ~ '^[0-9a-f]{64}$'),
  consent_receipt_id text NOT NULL REFERENCES evidence.consent_receipts(id),
  consent_receipt_root text NOT NULL CHECK (consent_receipt_root ~ '^[0-9a-f]{64}$'),
  attestation_id text NOT NULL REFERENCES identity.device_attestations(id),
  attestation_root text NOT NULL CHECK (attestation_root ~ '^[0-9a-f]{64}$'),
  provider text NOT NULL CHECK (provider IN (
    'apple_app_attest', 'webauthn', 'android_key_attestation',
    'manual_field_kit_registry', 'sensor_gateway_registry'
  )),
  attestation_type text NOT NULL CHECK (attestation_type IN (
    'secure_enclave', 'webauthn', 'platform_key', 'manual_field_kit', 'sensor_gateway'
  )),
  provider_key_id text NOT NULL CHECK (length(btrim(provider_key_id)) BETWEEN 1 AND 240),
  provider_receipt_hash text NOT NULL CHECK (provider_receipt_hash ~ '^[0-9a-f]{64}$'),
  verifier_id text NOT NULL REFERENCES identity.participants(id),
  verifier_snapshot jsonb NOT NULL CHECK (jsonb_typeof(verifier_snapshot) = 'object'),
  provider_verifier_id text NOT NULL CHECK (length(btrim(provider_verifier_id)) BETWEEN 1 AND 240),
  provider_verifier_version text NOT NULL CHECK (length(btrim(provider_verifier_version)) BETWEEN 1 AND 100),
  signer_key_id text NOT NULL CHECK (length(btrim(signer_key_id)) BETWEEN 1 AND 240),
  signer_set_root text NOT NULL CHECK (signer_set_root ~ '^[0-9a-f]{64}$'),
  provider_policy_root text NOT NULL CHECK (provider_policy_root ~ '^[0-9a-f]{64}$'),
  challenge_hash text NOT NULL CHECK (challenge_hash ~ '^[0-9a-f]{64}$'),
  signed_receipt_hash text NOT NULL UNIQUE CHECK (signed_receipt_hash ~ '^[0-9a-f]{64}$'),
  signature_algorithm text NOT NULL CHECK (signature_algorithm = 'ed25519'),
  signature_hash text NOT NULL CHECK (signature_hash ~ '^[0-9a-f]{64}$'),
  adapter_verification_root text NOT NULL UNIQUE CHECK (adapter_verification_root ~ '^[0-9a-f]{64}$'),
  result text NOT NULL CHECK (result IN ('verified', 'rejected')),
  reason_codes text[] NOT NULL,
  verified_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  verification_root text NOT NULL UNIQUE CHECK (verification_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  attestation_sequence bigint NOT NULL CHECK (attestation_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_receipt_id text NOT NULL UNIQUE REFERENCES audit.command_receipts(id),
  fact_root text NOT NULL UNIQUE CHECK (fact_root ~ '^[0-9a-f]{64}$'),
  safety jsonb NOT NULL CHECK (jsonb_typeof(safety) = 'object'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (attestation_id, attestation_sequence),
  CHECK (verified_at < expires_at),
  CHECK ((result = 'verified' AND cardinality(reason_codes) = 0)
      OR (result = 'rejected' AND cardinality(reason_codes) > 0)),
  CHECK (fact_record->>'factType' = 'evidence_device_attestation_receipt_verification'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'subjectId' = subject_id),
  CHECK (fact_record->>'subjectRoot' = subject_root),
  CHECK (fact_record->>'consentReceiptId' = consent_receipt_id),
  CHECK (fact_record->>'consentReceiptRoot' = consent_receipt_root),
  CHECK (fact_record->>'attestationId' = attestation_id),
  CHECK (fact_record->>'attestationRoot' = attestation_root),
  CHECK (fact_record->>'provider' = provider),
  CHECK (fact_record->>'attestationType' = attestation_type),
  CHECK (fact_record->>'providerKeyId' = provider_key_id),
  CHECK (fact_record->>'providerReceiptHash' = provider_receipt_hash),
  CHECK (fact_record->>'verifierId' = verifier_id),
  CHECK (fact_record->'verifier' = verifier_snapshot),
  CHECK (fact_record->>'providerVerifierId' = provider_verifier_id),
  CHECK (fact_record->>'providerVerifierVersion' = provider_verifier_version),
  CHECK (fact_record->>'signerKeyId' = signer_key_id),
  CHECK (fact_record->>'signerSetRoot' = signer_set_root),
  CHECK (fact_record->>'providerPolicyRoot' = provider_policy_root),
  CHECK (fact_record->>'challengeHash' = challenge_hash),
  CHECK (fact_record->>'signedReceiptHash' = signed_receipt_hash),
  CHECK (fact_record->>'signatureAlgorithm' = signature_algorithm),
  CHECK (fact_record->>'signatureHash' = signature_hash),
  CHECK (fact_record->>'adapterVerificationRoot' = adapter_verification_root),
  CHECK (fact_record->>'result' = result),
  CHECK ((fact_record->>'verifiedAt')::timestamptz = verified_at),
  CHECK ((fact_record->>'expiresAt')::timestamptz = expires_at),
  CHECK (fact_record->>'verificationRoot' = verification_root),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK ((fact_record->>'attestationSequence')::bigint = attestation_sequence),
  CHECK (fact_record->>'previousEventRoot' = previous_event_root),
  CHECK (fact_record->>'commandReceiptId' = command_receipt_id),
  CHECK (fact_record->>'factRoot' = fact_root),
  CHECK (fact_record->'safety' = safety),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE INDEX IF NOT EXISTS identity_e1a_verification_org_time
  ON identity.device_attestation_verification_facts
  (organization_id, verified_at DESC, attestation_sequence DESC, id DESC);

CREATE UNIQUE INDEX IF NOT EXISTS identity_e1a_verification_challenge_once
  ON identity.device_attestation_verification_facts (attestation_id, challenge_hash);
CREATE INDEX IF NOT EXISTS identity_e1a_verification_attestation_time
  ON identity.device_attestation_verification_facts
  (attestation_id, verified_at DESC, attestation_sequence DESC, id DESC);

CREATE OR REPLACE FUNCTION evidence.e1a_adapter_verification_root(
  fact identity.device_attestation_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-device-attestation-adapter-verification-v1',
    'attestationRoot', fact.attestation_root,
    'receiptHash', fact.signed_receipt_hash,
    'provider', fact.provider,
    'verifierId', fact.provider_verifier_id,
    'signerKeyId', fact.signer_key_id,
    'providerPolicyRoot', fact.provider_policy_root,
    'signerSetRoot', fact.signer_set_root,
    'signatureHash', fact.signature_hash,
    'verifiedAt', audit.iso8601_millis(fact.verified_at)
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e1a_verification_root(
  fact identity.device_attestation_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-device-attestation-receipt-verification-v1',
    'attestationId', fact.attestation_id,
    'attestationRoot', fact.attestation_root,
    'signedReceiptHash', fact.signed_receipt_hash,
    'provider', fact.provider,
    'providerVerifierId', fact.provider_verifier_id,
    'verifierId', fact.verifier_id,
    'signerKeyId', fact.signer_key_id,
    'signerSetRoot', fact.signer_set_root,
    'providerPolicyRoot', fact.provider_policy_root,
    'challengeHash', fact.challenge_hash,
    'signatureHash', fact.signature_hash,
    'adapterVerificationRoot', fact.adapter_verification_root,
    'result', fact.result,
    'reasonCodes', to_jsonb(fact.reason_codes),
    'verifiedAt', audit.iso8601_millis(fact.verified_at),
    'expiresAt', audit.iso8601_millis(fact.expires_at)
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e1a_command_hash(
  fact identity.device_attestation_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-device-attestation-verification-command-v1',
    'organizationId', fact.organization_id,
    'attestationId', fact.attestation_id,
    'attestationRoot', fact.attestation_root,
    'signedReceiptHash', fact.signed_receipt_hash,
    'verificationRoot', fact.verification_root,
    'verifierId', fact.verifier_id,
    'verifierAuthorityRoot', fact.verifier_snapshot->>'authorityRoot',
    'verifiedAt', audit.iso8601_millis(fact.verified_at)
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.e1a_fact_root(
  fact identity.device_attestation_verification_facts
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-device-attestation-verification-fact-root-v1',
    'commandHash', fact.command_hash,
    'verificationRoot', fact.verification_root,
    'auditEventRoot', fact.audit_event_root,
    'commandReceiptId', fact.command_receipt_id,
    'safety', fact.safety
  ));
$$;

CREATE OR REPLACE FUNCTION evidence.validate_e1a_verification_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  base identity.device_attestations%ROWTYPE;
  consent evidence.consent_receipts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  command_receipt audit.command_receipts%ROWTYPE;
  expected_action text;
  expected_rationale text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT base FROM identity.device_attestations
  WHERE id = NEW.attestation_id FOR SHARE;
  SELECT * INTO STRICT consent FROM evidence.consent_receipts
  WHERE id = NEW.consent_receipt_id FOR SHARE;
  SELECT * INTO STRICT semantic_event FROM audit.domain_events
  WHERE event_root = NEW.audit_event_root;
  SELECT * INTO STRICT command_receipt FROM audit.command_receipts
  WHERE id = NEW.command_receipt_id;
  expected_action := CASE WHEN NEW.result = 'verified' THEN 'FULFILL' ELSE 'CHALLENGE' END;
  expected_rationale := CASE WHEN NEW.result = 'verified'
    THEN 'An independently signed device-attestation provider receipt was verified.'
    ELSE 'A signed device-attestation provider rejection was retained for review.' END;

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.verifier_id
     OR transaction_organization_id <> NEW.organization_id
     OR evidence.e1a_has_forbidden_key(NEW.fact_record)
     OR NOT evidence.e1a_keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','subjectId','subjectRoot','consentReceiptId',
         'consentReceiptRoot','attestationId','attestationRoot','provider','attestationType',
         'providerKeyId','providerReceiptHash','verifierId','verifier','providerVerifierId',
         'providerVerifierVersion','signerKeyId','signerSetRoot','providerPolicyRoot',
         'challengeHash','signedReceiptHash','signatureAlgorithm','signatureHash',
         'adapterVerificationRoot','result','reasonCodes','verifiedAt','expiresAt',
         'verificationRoot','commandHash','attestationSequence','previousEventRoot',
         'commandReceiptId','factRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','subjectId','subjectRoot','consentReceiptId',
         'consentReceiptRoot','attestationId','attestationRoot','provider','attestationType',
         'providerKeyId','providerReceiptHash','verifierId','verifier','providerVerifierId',
         'providerVerifierVersion','signerKeyId','signerSetRoot','providerPolicyRoot',
         'challengeHash','signedReceiptHash','signatureAlgorithm','signatureHash',
         'adapterVerificationRoot','result','reasonCodes','verifiedAt','expiresAt',
         'verificationRoot','commandHash','attestationSequence','previousEventRoot',
         'commandReceiptId','factRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.verifier_snapshot->>'id' <> NEW.verifier_id
     OR NEW.fact_record->'reasonCodes' <> to_jsonb(NEW.reason_codes)
     OR NOT evidence.evidence_media_agent_is_valid(
       NEW.verifier_snapshot, NEW.organization_id, 'device_attestation_receipt'
     )
     OR base.provider_verification_state <> 'modeled_only'
     OR NEW.organization_id <> base.organization_id
     OR NEW.subject_id <> base.subject_id
     OR NEW.subject_root <> base.subject_root
     OR NEW.consent_receipt_id <> base.consent_receipt_id
     OR NEW.consent_receipt_root <> base.consent_receipt_root
     OR NEW.attestation_root <> base.attestation_root
     OR NEW.provider <> base.provider
     OR NEW.attestation_type <> base.attestation_type
     OR NEW.provider_key_id <> base.provider_key_id
     OR NEW.provider_receipt_hash <> base.provider_receipt_hash
     OR NEW.organization_id <> consent.organization_id
     OR NEW.subject_id <> consent.subject_id
     OR NEW.verified_at < base.issued_at
     OR NEW.verified_at >= base.expires_at
     OR NEW.expires_at > base.expires_at
     OR NEW.verified_at <> date_trunc('milliseconds', NEW.verified_at)
     OR NEW.expires_at <> date_trunc('milliseconds', NEW.expires_at)
     OR NOT audit.is_sorted_unique_text_array(NEW.reason_codes)
     OR EXISTS (
       SELECT 1 FROM unnest(NEW.reason_codes) AS reason
       WHERE reason !~ '^[a-z][a-z0-9_]{1,63}$'
     )
     OR NOT evidence.evidence_media_safe_material(ARRAY[
       NEW.provider_key_id, NEW.provider_verifier_id, NEW.provider_verifier_version,
       NEW.signer_key_id
     ])
     OR NEW.adapter_verification_root <> evidence.e1a_adapter_verification_root(NEW)
     OR NEW.verification_root <> evidence.e1a_verification_root(NEW)
     OR NEW.safety <> evidence.e1a_safety_canonical() THEN
    RAISE EXCEPTION 'CANOPYPROOF_E1A_VERIFICATION_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'evidence-device-adapter:' || NEW.attestation_id
     OR semantic_event.sequence_no <> NEW.attestation_sequence
     OR semantic_event.action <> expected_action
     OR semantic_event.actor_id <> NEW.verifier_id
     OR semantic_event.entity_type <> 'device_attestation'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.verified_at
     OR semantic_event.payload_hash <> NEW.verification_root
     OR semantic_event.rationale <> expected_rationale THEN
    RAISE EXCEPTION 'CANOPYPROOF_E1A_VERIFICATION_EVENT_INVALID';
  END IF;

  IF NEW.command_hash <> evidence.e1a_command_hash(NEW)
     OR NEW.id <> 'cp_device_verify_' || left(NEW.command_hash, 24)
     OR NEW.command_receipt_id <> 'cp_e1a_command_' || left(NEW.command_hash, 24)
     OR NEW.fact_root <> evidence.e1a_fact_root(NEW)
     OR command_receipt.actor_id <> NEW.verifier_id
     OR command_receipt.operation <> 'evidence.device-attestation-receipt.verify'
     OR command_receipt.idempotency_key_hash <> NEW.command_hash
     OR command_receipt.request_hash <> NEW.command_hash
     OR command_receipt.result_entity_type <> 'device_attestation_receipt_verification'
     OR command_receipt.result_entity_id <> NEW.id
     OR command_receipt.response_hash <> NEW.fact_root
     OR command_receipt.audit_event_root <> NEW.audit_event_root
     OR command_receipt.created_at <> NEW.verified_at THEN
    RAISE EXCEPTION 'CANOPYPROOF_E1A_VERIFICATION_LINEAGE_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS identity_e1a_verification_validate
  ON identity.device_attestation_verification_facts;
CREATE TRIGGER identity_e1a_verification_validate
BEFORE INSERT ON identity.device_attestation_verification_facts
FOR EACH ROW EXECUTE FUNCTION evidence.validate_e1a_verification_insert();

DROP TRIGGER IF EXISTS identity_e1a_verification_append_only
  ON identity.device_attestation_verification_facts;
CREATE TRIGGER identity_e1a_verification_append_only
BEFORE UPDATE OR DELETE ON identity.device_attestation_verification_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();

DROP TRIGGER IF EXISTS identity_e1a_verification_audit
  ON identity.device_attestation_verification_facts;
CREATE TRIGGER identity_e1a_verification_audit
AFTER INSERT OR UPDATE OR DELETE ON identity.device_attestation_verification_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE identity.device_attestation_verification_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE identity.device_attestation_verification_facts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS identity_e1a_verification_tenant
  ON identity.device_attestation_verification_facts;
CREATE POLICY identity_e1a_verification_tenant
ON identity.device_attestation_verification_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

CREATE OR REPLACE FUNCTION evidence.effective_device_attestation_projection(
  target_attestation_id text,
  evaluated_at timestamptz
)
RETURNS TABLE (
  attestation_id text,
  attestation_root text,
  organization_id text,
  subject_id text,
  consent_receipt_id text,
  state text,
  issue_codes text[],
  evaluated_at_utc timestamptz,
  consent_projection_root text,
  verification_fact_id text,
  verification_root text,
  projection_root text,
  safety jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  base identity.device_attestations%ROWTYPE;
  consent record;
  verification identity.device_attestation_verification_facts%ROWTYPE;
  projected_state text;
  projected_issues text[] := ARRAY[]::text[];
  projected_root text;
  boundary jsonb := evidence.e1a_safety_canonical();
  projection_seed jsonb;
BEGIN
  SELECT * INTO STRICT base FROM identity.device_attestations
  WHERE id = target_attestation_id;
  SELECT * INTO STRICT consent FROM evidence.consent_receipt_projection(
    base.consent_receipt_id, evaluated_at
  );
  SELECT candidate.* INTO verification
  FROM identity.device_attestation_verification_facts candidate
  WHERE candidate.attestation_id = target_attestation_id
    AND candidate.verified_at <= evaluated_at
  ORDER BY candidate.verified_at DESC, candidate.attestation_sequence DESC, candidate.id DESC
  LIMIT 1;

  IF consent.state = 'revoked' THEN
    projected_state := 'consent_revoked';
    projected_issues := ARRAY['device_consent_revoked'];
  ELSIF consent.state = 'expired' THEN
    projected_state := 'consent_expired';
    projected_issues := ARRAY['device_consent_expired'];
  ELSIF base.expires_at <= evaluated_at THEN
    projected_state := 'expired';
    projected_issues := ARRAY['device_attestation_expired'];
  ELSIF cardinality(base.risk_flags) > 0 THEN
    projected_state := 'needs_review';
    SELECT array_agg('device_risk_' || flag ORDER BY 'device_risk_' || flag)
    INTO projected_issues FROM unnest(base.risk_flags) AS flag;
  ELSIF verification.id IS NULL THEN
    projected_state := 'needs_review';
    projected_issues := ARRAY['device_provider_verification_pending'];
  ELSIF verification.result = 'rejected' THEN
    projected_state := 'rejected';
    SELECT array_agg('device_provider_' || reason ORDER BY 'device_provider_' || reason)
    INTO projected_issues FROM unnest(verification.reason_codes) AS reason;
  ELSIF verification.expires_at <= evaluated_at THEN
    projected_state := 'verification_expired';
    projected_issues := ARRAY['device_provider_verification_expired'];
  ELSE
    projected_state := 'current';
  END IF;

  SELECT COALESCE(array_agg(DISTINCT issue ORDER BY issue), ARRAY[]::text[])
  INTO projected_issues FROM unnest(projected_issues) AS issue;
  projection_seed := jsonb_build_object(
    'attestationId', base.id,
    'attestationRoot', base.attestation_root,
    'organizationId', base.organization_id,
    'subjectId', base.subject_id,
    'consentReceiptId', base.consent_receipt_id,
    'state', projected_state,
    'issueCodes', to_jsonb(projected_issues),
    'evaluatedAt', audit.iso8601_millis(evaluated_at),
    'consentProjectionRoot', consent.projection_root
  ) || CASE WHEN verification.id IS NULL THEN '{}'::jsonb ELSE jsonb_build_object(
    'verificationFactId', verification.id,
    'verificationRoot', verification.verification_root
  ) END || jsonb_build_object('safety', boundary);
  projected_root := audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-effective-device-attestation-projection-v1') ||
    projection_seed
  );

  RETURN QUERY SELECT
    base.id,
    base.attestation_root,
    base.organization_id,
    base.subject_id,
    base.consent_receipt_id,
    projected_state,
    projected_issues,
    evaluated_at,
    consent.projection_root,
    verification.id,
    verification.verification_root,
    projected_root,
    boundary;
END;
$$;
