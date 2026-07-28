-- CanopyProof Environmental Proof Record lifecycle authority.
-- Depends on canopyproof-os.sql and mrv-graph.sql. This migration is additive,
-- route-closed, and never stores private signing material.

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_LIFECYCLE_APPEND_ONLY_VIOLATION';
END;
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'extendsCanonicalEnvironmentalProofRecord', true,
    'immutableIssuancePreserved', true,
    'governedRecordProjectionRequired', true,
    'reviewedMrvLineageRequired', true,
    'managedKeyVerificationRequired', true,
    'detachedSignatureVerificationRequired', true,
    'privateKeyMaterialForbidden', true,
    'humanIssuerRequired', true,
    'independentHumanGovernanceRequired', true,
    'appendOnly', true,
    'routeMounted', false,
    'productionActivationEnabled', false,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_payload_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(document - 'auditEvent');
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_event_is_contiguous(target_event_root text)
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

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_actor_is_valid(
  actor jsonb,
  expected_actor_id text,
  expected_organization_id text,
  allowed_roles text[],
  required_scope text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(verification.actor_snapshot_is_valid(
      actor,
      expected_actor_id,
      expected_organization_id,
      'human',
      allowed_roles
    ), false)
    AND actor->>'participantType' = 'human'
    AND actor->>'role' = ANY(allowed_roles)
    AND actor->>'membershipStatus' = 'active'
    AND actor->>'accreditationStatus' = 'approved'
    AND actor->'accreditationScope' @> jsonb_build_array(required_scope);
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_external_verifier_is_valid(
  verifier_id text,
  expected_organization_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM identity.participants participant
    JOIN identity.agent_profiles profile ON profile.id = participant.id
    WHERE participant.id = verifier_id
      AND participant.participant_type = 'agent'
      AND participant.organization_id = expected_organization_id
      AND participant.verification_status = 'verified'
      AND 'agent' = ANY(participant.roles)
      AND profile.status = 'active'
      AND profile.final_authority IS FALSE
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_text_is_safe(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT value !~* '(certified carbon credit|carbon[- ]?tax offset|guaranteed (rwa )?yield|automatic [$]?canopy distribution|mainnet funds|private[_ -]?key|seed phrase|mnemonic|api[_ -]?secret|access[_ -]?secret|client[_ -]?secret|password)';
$$;

CREATE TABLE IF NOT EXISTS governance.environmental_proof_signing_key_attestation_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  provider text NOT NULL CHECK (provider IN ('aws_kms','gcp_cloud_kms','azure_key_vault','managed_hsm')),
  provider_key_id text NOT NULL CHECK (length(provider_key_id) BETWEEN 1 AND 240),
  key_version text NOT NULL CHECK (length(key_version) BETWEEN 1 AND 240),
  algorithm text NOT NULL CHECK (algorithm IN ('ES256','Ed25519','RSA_PSS_SHA256')),
  purpose text NOT NULL CHECK (purpose = 'canopyproof_environmental_proof_record'),
  public_key_hash text NOT NULL CHECK (public_key_hash ~ '^[0-9a-f]{64}$'),
  provider_attestation_hash text NOT NULL CHECK (provider_attestation_hash ~ '^[0-9a-f]{64}$'),
  active_from timestamptz NOT NULL,
  expires_at timestamptz,
  registrar_id text NOT NULL REFERENCES identity.participants(id),
  external_verifier_id text NOT NULL REFERENCES identity.participants(id),
  provider_receipt_id_hash text NOT NULL CHECK (provider_receipt_id_hash ~ '^[0-9a-f]{64}$'),
  provider_receipt_hash text NOT NULL CHECK (provider_receipt_hash ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz NOT NULL,
  attested_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  organization_sequence bigint NOT NULL CHECK (organization_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  key_hash text NOT NULL UNIQUE CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  key_root text NOT NULL UNIQUE CHECK (key_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (organization_id, provider, provider_key_id, key_version, purpose),
  UNIQUE (organization_id, organization_sequence),
  CHECK (active_from <= attested_at),
  CHECK (verified_at = attested_at),
  CHECK (expires_at IS NULL OR expires_at > attested_at)
);

CREATE TABLE IF NOT EXISTS governance.environmental_proof_signing_key_revocation_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  key_authority_id text NOT NULL UNIQUE REFERENCES governance.environmental_proof_signing_key_attestation_facts(id),
  key_root text NOT NULL CHECK (key_root ~ '^[0-9a-f]{64}$'),
  reason_code text NOT NULL CHECK (reason_code ~ '^[a-z0-9][a-z0-9_:-]{0,119}$'),
  rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 24 AND 4000),
  revoker_id text NOT NULL REFERENCES identity.participants(id),
  revoked_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  organization_sequence bigint NOT NULL CHECK (organization_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  revocation_hash text NOT NULL UNIQUE CHECK (revocation_hash ~ '^[0-9a-f]{64}$'),
  revocation_root text NOT NULL UNIQUE CHECK (revocation_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (organization_id, organization_sequence)
);

CREATE TABLE IF NOT EXISTS certificates.environmental_proof_lifecycle_binding_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  record_id text NOT NULL UNIQUE REFERENCES certificates.environmental_proof_record_facts(id),
  record_root text NOT NULL CHECK (record_root ~ '^[0-9a-f]{64}$'),
  record_issued_at timestamptz NOT NULL,
  governed_record_projection_root text NOT NULL CHECK (governed_record_projection_root ~ '^[0-9a-f]{64}$'),
  mrv_snapshot_id text NOT NULL REFERENCES mrv.graph_snapshot_facts(id),
  mrv_snapshot_root text NOT NULL CHECK (mrv_snapshot_root ~ '^[0-9a-f]{64}$'),
  mrv_edge_set_root text NOT NULL CHECK (mrv_edge_set_root ~ '^[0-9a-f]{64}$'),
  mrv_graph_root text NOT NULL CHECK (mrv_graph_root ~ '^[0-9a-f]{64}$'),
  mrv_reviewed_at timestamptz NOT NULL,
  methodology_id text NOT NULL REFERENCES governance.methodologies(id),
  methodology_publication_root text NOT NULL CHECK (methodology_publication_root ~ '^[0-9a-f]{64}$'),
  observation_starts_at timestamptz NOT NULL,
  observation_ends_at timestamptz NOT NULL,
  valid_from timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  monitoring_cadence_days integer NOT NULL CHECK (monitoring_cadence_days BETWEEN 1 AND 365),
  next_monitoring_due_at timestamptz NOT NULL,
  monitoring_grace_days integer NOT NULL CHECK (monitoring_grace_days BETWEEN 0 AND 90),
  assertion_type text NOT NULL CHECK (assertion_type IN (
    'restoration_activity','vegetation_condition','biodiversity_condition',
    'water_condition','soil_condition','climate_observation'
  )),
  assertion_scope_hash text NOT NULL CHECK (assertion_scope_hash ~ '^[0-9a-f]{64}$'),
  location_scope_hash text NOT NULL CHECK (location_scope_hash ~ '^[0-9a-f]{64}$'),
  uncertainty_hash text NOT NULL CHECK (uncertainty_hash ~ '^[0-9a-f]{64}$'),
  limitation_hashes text[] NOT NULL CHECK (cardinality(limitation_hashes) <= 32),
  reliance_statement text NOT NULL CHECK (reliance_statement = 'environmental_accountability_only'),
  issuer_id text NOT NULL REFERENCES identity.participants(id),
  signing_key_authority_id text NOT NULL REFERENCES governance.environmental_proof_signing_key_attestation_facts(id),
  signing_key_root text NOT NULL CHECK (signing_key_root ~ '^[0-9a-f]{64}$'),
  source_event_roots text[] NOT NULL CHECK (cardinality(source_event_roots) = 3),
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  signature_payload_hash text NOT NULL UNIQUE CHECK (signature_payload_hash ~ '^[0-9a-f]{64}$'),
  bound_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  record_sequence bigint NOT NULL CHECK (record_sequence = 1),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  binding_hash text NOT NULL UNIQUE CHECK (binding_hash ~ '^[0-9a-f]{64}$'),
  binding_root text NOT NULL UNIQUE CHECK (binding_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  CHECK (observation_starts_at < observation_ends_at),
  CHECK (observation_ends_at <= record_issued_at),
  CHECK (record_issued_at <= bound_at),
  CHECK (bound_at <= valid_from),
  CHECK (valid_from < expires_at),
  CHECK (expires_at <= valid_from + interval '366 days'),
  CHECK (valid_from < next_monitoring_due_at AND next_monitoring_due_at <= expires_at)
);

CREATE TABLE IF NOT EXISTS certificates.environmental_proof_signature_receipt_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  record_id text NOT NULL UNIQUE REFERENCES certificates.environmental_proof_record_facts(id),
  record_root text NOT NULL CHECK (record_root ~ '^[0-9a-f]{64}$'),
  binding_id text NOT NULL UNIQUE REFERENCES certificates.environmental_proof_lifecycle_binding_facts(id),
  binding_root text NOT NULL CHECK (binding_root ~ '^[0-9a-f]{64}$'),
  signing_key_authority_id text NOT NULL REFERENCES governance.environmental_proof_signing_key_attestation_facts(id),
  signing_key_root text NOT NULL CHECK (signing_key_root ~ '^[0-9a-f]{64}$'),
  algorithm text NOT NULL CHECK (algorithm IN ('ES256','Ed25519','RSA_PSS_SHA256')),
  signature_payload_hash text NOT NULL CHECK (signature_payload_hash ~ '^[0-9a-f]{64}$'),
  detached_signature text NOT NULL CHECK (
    length(detached_signature) BETWEEN 16 AND 8192
    AND detached_signature ~ '^[A-Za-z0-9_-]+$'
  ),
  signature_hash text NOT NULL UNIQUE CHECK (signature_hash ~ '^[0-9a-f]{64}$'),
  external_verifier_id text NOT NULL REFERENCES identity.participants(id),
  provider_receipt_id_hash text NOT NULL CHECK (provider_receipt_id_hash ~ '^[0-9a-f]{64}$'),
  provider_receipt_hash text NOT NULL CHECK (provider_receipt_hash ~ '^[0-9a-f]{64}$'),
  signed_at timestamptz NOT NULL,
  verified_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  record_sequence bigint NOT NULL CHECK (record_sequence > 1),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  receipt_hash text NOT NULL UNIQUE CHECK (receipt_hash ~ '^[0-9a-f]{64}$'),
  receipt_root text NOT NULL UNIQUE CHECK (receipt_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  CHECK (signed_at <= verified_at)
);

CREATE TABLE IF NOT EXISTS governance.environmental_proof_lifecycle_control_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  record_id text NOT NULL REFERENCES certificates.environmental_proof_record_facts(id),
  record_root text NOT NULL CHECK (record_root ~ '^[0-9a-f]{64}$'),
  binding_id text NOT NULL REFERENCES certificates.environmental_proof_lifecycle_binding_facts(id),
  binding_root text NOT NULL CHECK (binding_root ~ '^[0-9a-f]{64}$'),
  action text NOT NULL CHECK (action IN ('suspend','reinstate','supersede')),
  prior_state text NOT NULL CHECK (prior_state IN (
    'issued','active','challenged','suspended','revoked','expired','superseded'
  )),
  prior_projection_root text NOT NULL CHECK (prior_projection_root ~ '^[0-9a-f]{64}$'),
  successor_binding_id text REFERENCES certificates.environmental_proof_lifecycle_binding_facts(id),
  successor_binding_root text CHECK (successor_binding_root IS NULL OR successor_binding_root ~ '^[0-9a-f]{64}$'),
  successor_projection_root text CHECK (successor_projection_root IS NULL OR successor_projection_root ~ '^[0-9a-f]{64}$'),
  rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 24 AND 4000),
  conflict_disclosure text NOT NULL CHECK (length(btrim(conflict_disclosure)) BETWEEN 24 AND 2000),
  source_projection_roots text[] NOT NULL CHECK (cardinality(source_projection_roots) BETWEEN 3 AND 4),
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  governor_id text NOT NULL REFERENCES identity.participants(id),
  decided_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  record_sequence bigint NOT NULL CHECK (record_sequence > 1),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  control_hash text NOT NULL UNIQUE CHECK (control_hash ~ '^[0-9a-f]{64}$'),
  control_root text NOT NULL UNIQUE CHECK (control_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (record_id, record_sequence),
  CHECK (
    (action = 'supersede' AND successor_binding_id IS NOT NULL AND successor_binding_root IS NOT NULL AND successor_projection_root IS NOT NULL)
    OR
    (action <> 'supersede' AND successor_binding_id IS NULL AND successor_binding_root IS NULL AND successor_projection_root IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS environmental_proof_signing_keys_org_sequence
  ON governance.environmental_proof_signing_key_attestation_facts (organization_id, organization_sequence, id);
CREATE INDEX IF NOT EXISTS environmental_proof_key_revocations_org_sequence
  ON governance.environmental_proof_signing_key_revocation_facts (organization_id, organization_sequence, id);
CREATE INDEX IF NOT EXISTS environmental_proof_lifecycle_bindings_project
  ON certificates.environmental_proof_lifecycle_binding_facts (organization_id, project_id, bound_at DESC, id);
CREATE INDEX IF NOT EXISTS environmental_proof_signature_receipts_record
  ON certificates.environmental_proof_signature_receipt_facts (record_id, verified_at DESC, id);
CREATE INDEX IF NOT EXISTS environmental_proof_lifecycle_controls_record
  ON governance.environmental_proof_lifecycle_control_facts (record_id, record_sequence DESC, id);

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signing_key_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-signing-key-command-v1') ||
    (document - ARRAY[
      'factType','id','commandHash','organizationSequence','previousEventRoot',
      'sourceRoot','keyHash','keyRoot','safety','auditEvent'
    ]::text[]) ||
    jsonb_build_object('requestedAt', document->>'attestedAt')
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signing_key_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-signing-key-v1') ||
    (document - ARRAY['factType','keyHash','keyRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signing_key_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-environmental-proof-signing-key-root-v1',
    'organizationId', document->>'organizationId',
    'sourceRoot', document->>'sourceRoot',
    'keyHash', document->>'keyHash',
    'previousEventRoot', document->>'previousEventRoot',
    'organizationSequence', (document->>'organizationSequence')::bigint
  ));
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signing_key_revocation_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-signing-key-revocation-command-v1') ||
    (document - ARRAY[
      'factType','id','commandHash','organizationSequence','previousEventRoot',
      'sourceRoot','revocationHash','revocationRoot','safety','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signing_key_revocation_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-signing-key-revocation-v1') ||
    (document - ARRAY['factType','revocationHash','revocationRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signing_key_revocation_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-environmental-proof-signing-key-revocation-root-v1',
    'keyRoot', document->>'keyRoot',
    'sourceRoot', document->>'sourceRoot',
    'revocationHash', document->>'revocationHash',
    'previousEventRoot', document->>'previousEventRoot',
    'organizationSequence', (document->>'organizationSequence')::bigint
  ));
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_binding_authority_seed(document jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT document - ARRAY[
    'factType','id','signaturePayloadHash','commandHash','recordSequence',
    'previousEventRoot','bindingHash','bindingRoot','safety','auditEvent'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_signature_payload_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-signature-payload-v1') ||
    certificates.environmental_proof_lifecycle_binding_authority_seed(document)
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_binding_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-lifecycle-binding-command-v1') ||
    certificates.environmental_proof_lifecycle_binding_authority_seed(document) ||
    jsonb_build_object('signaturePayloadHash', document->>'signaturePayloadHash')
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_binding_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-lifecycle-binding-v1') ||
    (document - ARRAY['factType','bindingHash','bindingRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_binding_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-environmental-proof-lifecycle-binding-root-v1',
    'recordRoot', document->>'recordRoot',
    'mrvSnapshotRoot', document->>'mrvSnapshotRoot',
    'signingKeyRoot', document->>'signingKeyRoot',
    'sourceRoot', document->>'sourceRoot',
    'bindingHash', document->>'bindingHash',
    'previousEventRoot', document->>'previousEventRoot',
    'recordSequence', (document->>'recordSequence')::bigint
  ));
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signature_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-environmental-proof-detached-signature-v1',
    'algorithm', document->>'algorithm',
    'detachedSignature', document->>'detachedSignature'
  ));
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signature_receipt_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-signature-receipt-command-v1') ||
    (document - ARRAY[
      'factType','id','commandHash','recordSequence','previousEventRoot',
      'sourceRoot','receiptHash','receiptRoot','safety','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signature_receipt_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-signature-receipt-v1') ||
    (document - ARRAY['factType','receiptHash','receiptRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_signature_receipt_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-environmental-proof-signature-receipt-root-v1',
    'bindingRoot', document->>'bindingRoot',
    'signingKeyRoot', document->>'signingKeyRoot',
    'sourceRoot', document->>'sourceRoot',
    'receiptHash', document->>'receiptHash',
    'previousEventRoot', document->>'previousEventRoot',
    'recordSequence', (document->>'recordSequence')::bigint
  ));
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_control_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-lifecycle-control-command-v1') ||
    (document - ARRAY[
      'factType','id','sourceRoot','commandHash','recordSequence',
      'previousEventRoot','controlHash','controlRoot','safety','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_control_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-environmental-proof-lifecycle-control-v1') ||
    (document - ARRAY['factType','controlHash','controlRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_control_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-environmental-proof-lifecycle-control-root-v1',
    'bindingRoot', document->>'bindingRoot',
    'sourceRoot', document->>'sourceRoot',
    'controlHash', document->>'controlHash',
    'previousEventRoot', document->>'previousEventRoot',
    'recordSequence', (document->>'recordSequence')::bigint
  ));
$$;

CREATE OR REPLACE FUNCTION certificates.validate_environmental_proof_signing_key_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  registrar jsonb;
  semantic_event audit.domain_events%ROWTYPE;
  expected_source_root text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  registrar := NEW.fact_record->'registrar';
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  expected_source_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(ARRAY[
      registrar->>'authorityRoot', NEW.public_key_hash,
      NEW.provider_attestation_hash, NEW.provider_receipt_hash
    ]::text[]) AS value ORDER BY value
  ));

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.registrar_id
     OR transaction_organization_id <> NEW.organization_id
     OR mrv.has_forbidden_key(NEW.fact_record)
     OR NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','provider','providerKeyId','keyVersion',
         'algorithm','purpose','publicKeyHash','providerAttestationHash','activeFrom',
         'expiresAt','registrar','externalVerifierId','providerReceiptIdHash',
         'providerReceiptHash','verifiedAt','attestedAt','commandHash',
         'organizationSequence','previousEventRoot','sourceRoot','keyHash','keyRoot',
         'safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','provider','providerKeyId','keyVersion',
         'algorithm','purpose','publicKeyHash','providerAttestationHash','activeFrom',
         'registrar','externalVerifierId','providerReceiptIdHash','providerReceiptHash',
         'verifiedAt','attestedAt','commandHash','organizationSequence',
         'previousEventRoot','sourceRoot','keyHash','keyRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.fact_record->>'factType' <> 'environmental_proof_signing_key_attestation'
     OR NEW.fact_record->>'id' <> NEW.id
     OR NEW.fact_record->>'organizationId' <> NEW.organization_id
     OR NEW.fact_record->>'provider' <> NEW.provider
     OR NEW.fact_record->>'providerKeyId' <> NEW.provider_key_id
     OR NEW.fact_record->>'keyVersion' <> NEW.key_version
     OR NEW.fact_record->>'algorithm' <> NEW.algorithm
     OR NEW.fact_record->>'purpose' <> NEW.purpose
     OR NEW.fact_record->>'publicKeyHash' <> NEW.public_key_hash
     OR NEW.fact_record->>'providerAttestationHash' <> NEW.provider_attestation_hash
     OR (NEW.fact_record->>'activeFrom')::timestamptz <> NEW.active_from
     OR ((NEW.fact_record ? 'expiresAt') <> (NEW.expires_at IS NOT NULL))
     OR (NEW.expires_at IS NOT NULL AND (NEW.fact_record->>'expiresAt')::timestamptz <> NEW.expires_at)
     OR NEW.fact_record->'registrar'->>'id' <> NEW.registrar_id
     OR NEW.fact_record->>'externalVerifierId' <> NEW.external_verifier_id
     OR NEW.fact_record->>'providerReceiptIdHash' <> NEW.provider_receipt_id_hash
     OR NEW.fact_record->>'providerReceiptHash' <> NEW.provider_receipt_hash
     OR (NEW.fact_record->>'verifiedAt')::timestamptz <> NEW.verified_at
     OR (NEW.fact_record->>'attestedAt')::timestamptz <> NEW.attested_at
     OR NEW.fact_record->>'commandHash' <> NEW.command_hash
     OR (NEW.fact_record->>'organizationSequence')::bigint <> NEW.organization_sequence
     OR NEW.fact_record->>'previousEventRoot' <> NEW.previous_event_root
     OR NEW.fact_record->>'sourceRoot' <> NEW.source_root
     OR NEW.fact_record->>'keyHash' <> NEW.key_hash
     OR NEW.fact_record->>'keyRoot' <> NEW.key_root
     OR NOT certificates.environmental_proof_lifecycle_text_is_safe(NEW.provider_key_id)
     OR NOT certificates.environmental_proof_lifecycle_text_is_safe(NEW.key_version)
     OR NOT COALESCE(certificates.environmental_proof_lifecycle_actor_is_valid(
       registrar, NEW.registrar_id, NEW.organization_id,
       ARRAY['owner','admin']::text[], 'environmental_proof_signing_key:admin'
     ), false)
     OR NOT certificates.environmental_proof_lifecycle_external_verifier_is_valid(
       NEW.external_verifier_id, NEW.organization_id
     )
     OR NEW.active_from > NEW.attested_at
     OR NEW.verified_at <> NEW.attested_at
     OR NEW.attested_at <> date_trunc('milliseconds', NEW.attested_at)
     OR NEW.active_from <> date_trunc('milliseconds', NEW.active_from)
     OR (NEW.expires_at IS NOT NULL AND (
       NEW.expires_at <> date_trunc('milliseconds', NEW.expires_at)
       OR NEW.expires_at <= NEW.attested_at
       OR NEW.expires_at > NEW.active_from + interval '1830 days'
     ))
     OR NEW.source_root <> expected_source_root
     OR NEW.fact_record->'safety' <> certificates.environmental_proof_lifecycle_safety_canonical()
     OR NEW.command_hash <> certificates.environmental_proof_signing_key_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_environmental_proof_key_' || left(NEW.command_hash, 24)
     OR NEW.key_hash <> certificates.environmental_proof_signing_key_hash(NEW.fact_record)
     OR NEW.key_root <> certificates.environmental_proof_signing_key_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_SIGNING_KEY_AUTHORITY_INVALID';
  END IF;

  IF NOT certificates.environmental_proof_lifecycle_event_is_contiguous(NEW.audit_event_root)
     OR semantic_event.stream_id <> 'certificate-key:' || NEW.organization_id
     OR semantic_event.sequence_no <> NEW.organization_sequence
     OR semantic_event.action <> 'ASSERT'
     OR semantic_event.actor_id <> NEW.registrar_id
     OR semantic_event.entity_type <> 'environmental_proof_signing_key_attestation'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.attested_at
     OR semantic_event.payload_hash <> certificates.environmental_proof_lifecycle_payload_hash(NEW.fact_record)
     OR NEW.fact_record->'auditEvent' <> mrv.audit_event_record(semantic_event)
     OR semantic_event.rationale <> 'A managed signing key public commitment passed external attestation verification.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_SIGNING_KEY_EVENT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS environmental_proof_signing_keys_validate
  ON governance.environmental_proof_signing_key_attestation_facts;
CREATE TRIGGER environmental_proof_signing_keys_validate
BEFORE INSERT ON governance.environmental_proof_signing_key_attestation_facts
FOR EACH ROW EXECUTE FUNCTION certificates.validate_environmental_proof_signing_key_insert();

CREATE OR REPLACE FUNCTION certificates.validate_environmental_proof_signing_key_revocation_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  key_fact governance.environmental_proof_signing_key_attestation_facts%ROWTYPE;
  revoker jsonb;
  semantic_event audit.domain_events%ROWTYPE;
  expected_source_root text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT key_fact
  FROM governance.environmental_proof_signing_key_attestation_facts
  WHERE id = NEW.key_authority_id FOR SHARE;
  revoker := NEW.fact_record->'revoker';
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  expected_source_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(ARRAY[
      key_fact.key_root, revoker->>'authorityRoot', key_fact.audit_event_root
    ]::text[]) AS value ORDER BY value
  ));

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.revoker_id
     OR transaction_organization_id <> NEW.organization_id
     OR key_fact.organization_id <> NEW.organization_id
     OR key_fact.key_root <> NEW.key_root
     OR mrv.has_forbidden_key(NEW.fact_record)
     OR NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','keyAuthorityId','keyRoot','reasonCode',
         'rationale','revoker','revokedAt','commandHash','organizationSequence',
         'previousEventRoot','sourceRoot','revocationHash','revocationRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','keyAuthorityId','keyRoot','reasonCode',
         'rationale','revoker','revokedAt','commandHash','organizationSequence',
         'previousEventRoot','sourceRoot','revocationHash','revocationRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.fact_record->>'factType' <> 'environmental_proof_signing_key_revocation'
     OR NEW.fact_record->>'id' <> NEW.id
     OR NEW.fact_record->>'organizationId' <> NEW.organization_id
     OR NEW.fact_record->>'keyAuthorityId' <> NEW.key_authority_id
     OR NEW.fact_record->>'keyRoot' <> NEW.key_root
     OR NEW.fact_record->>'reasonCode' <> NEW.reason_code
     OR NEW.fact_record->>'rationale' <> NEW.rationale
     OR NEW.fact_record->'revoker'->>'id' <> NEW.revoker_id
     OR (NEW.fact_record->>'revokedAt')::timestamptz <> NEW.revoked_at
     OR NEW.fact_record->>'commandHash' <> NEW.command_hash
     OR (NEW.fact_record->>'organizationSequence')::bigint <> NEW.organization_sequence
     OR NEW.fact_record->>'previousEventRoot' <> NEW.previous_event_root
     OR NEW.fact_record->>'sourceRoot' <> NEW.source_root
     OR NEW.fact_record->>'revocationHash' <> NEW.revocation_hash
     OR NEW.fact_record->>'revocationRoot' <> NEW.revocation_root
     OR NOT certificates.environmental_proof_lifecycle_text_is_safe(NEW.reason_code)
     OR NOT certificates.environmental_proof_lifecycle_text_is_safe(NEW.rationale)
     OR NOT COALESCE(certificates.environmental_proof_lifecycle_actor_is_valid(
       revoker, NEW.revoker_id, NEW.organization_id,
       ARRAY['owner','admin']::text[], 'environmental_proof_signing_key:admin'
     ), false)
     OR NEW.revoked_at < key_fact.attested_at
     OR NEW.revoked_at <> date_trunc('milliseconds', NEW.revoked_at)
     OR NEW.source_root <> expected_source_root
     OR NEW.fact_record->'safety' <> certificates.environmental_proof_lifecycle_safety_canonical()
     OR NEW.command_hash <> certificates.environmental_proof_signing_key_revocation_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_environmental_proof_key_revocation_' || left(NEW.command_hash, 24)
     OR NEW.revocation_hash <> certificates.environmental_proof_signing_key_revocation_hash(NEW.fact_record)
     OR NEW.revocation_root <> certificates.environmental_proof_signing_key_revocation_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_SIGNING_KEY_REVOCATION_INVALID';
  END IF;

  IF NOT certificates.environmental_proof_lifecycle_event_is_contiguous(NEW.audit_event_root)
     OR semantic_event.stream_id <> 'certificate-key:' || NEW.organization_id
     OR semantic_event.sequence_no <> NEW.organization_sequence
     OR semantic_event.action <> 'CHALLENGE'
     OR semantic_event.actor_id <> NEW.revoker_id
     OR semantic_event.entity_type <> 'environmental_proof_signing_key_revocation'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.revoked_at
     OR semantic_event.payload_hash <> certificates.environmental_proof_lifecycle_payload_hash(NEW.fact_record)
     OR NEW.fact_record->'auditEvent' <> mrv.audit_event_record(semantic_event)
     OR semantic_event.rationale <> NEW.rationale THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_SIGNING_KEY_REVOCATION_EVENT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS environmental_proof_signing_key_revocations_validate
  ON governance.environmental_proof_signing_key_revocation_facts;
CREATE TRIGGER environmental_proof_signing_key_revocations_validate
BEFORE INSERT ON governance.environmental_proof_signing_key_revocation_facts
FOR EACH ROW EXECUTE FUNCTION certificates.validate_environmental_proof_signing_key_revocation_insert();

CREATE OR REPLACE FUNCTION certificates.validate_environmental_proof_lifecycle_binding_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  record_fact certificates.environmental_proof_record_facts%ROWTYPE;
  key_fact governance.environmental_proof_signing_key_attestation_facts%ROWTYPE;
  snapshot_fact mrv.graph_snapshot_facts%ROWTYPE;
  latest_snapshot mrv.graph_snapshot_facts%ROWTYPE;
  governed_projection record;
  issuer jsonb;
  semantic_event audit.domain_events%ROWTYPE;
  source_event_roots text[];
  limitation_hashes text[];
  expected_source_event_roots text[];
  expected_source_root text;
  expected_graph_root text;
  genesis_root text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT record_fact
  FROM certificates.environmental_proof_record_facts WHERE id = NEW.record_id FOR SHARE;
  SELECT * INTO STRICT key_fact
  FROM governance.environmental_proof_signing_key_attestation_facts
  WHERE id = NEW.signing_key_authority_id FOR SHARE;
  SELECT * INTO STRICT snapshot_fact
  FROM mrv.graph_snapshot_facts WHERE id = NEW.mrv_snapshot_id FOR SHARE;
  SELECT * INTO STRICT latest_snapshot
  FROM mrv.graph_snapshot_facts
  WHERE organization_id = NEW.organization_id AND project_id = NEW.project_id
  ORDER BY snapshot_sequence DESC, id DESC LIMIT 1;
  SELECT * INTO STRICT governed_projection
  FROM certificates.environmental_proof_governed_record_projection(NEW.record_id);
  issuer := NEW.fact_record->'issuer';
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO source_event_roots
  FROM jsonb_array_elements_text(NEW.fact_record->'sourceEventRoots') WITH ORDINALITY AS item(value, position);
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO limitation_hashes
  FROM jsonb_array_elements_text(NEW.fact_record->'limitationHashes') WITH ORDINALITY AS item(value, position);
  expected_source_event_roots := ARRAY(
    SELECT value FROM unnest(ARRAY[
      record_fact.audit_event_root, snapshot_fact.audit_event_root, key_fact.audit_event_root
    ]::text[]) AS value ORDER BY value
  );
  expected_graph_root := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-mrv-graph-projection-v1',
    'organizationId', NEW.organization_id,
    'projectId', NEW.project_id,
    'state', latest_snapshot.snapshot_state,
    'latestSnapshotId', latest_snapshot.id,
    'latestSnapshotRoot', latest_snapshot.snapshot_root,
    'finalProofChanged', false
  ));
  expected_source_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(ARRAY[
      record_fact.record_root, governed_projection.projection_root,
      snapshot_fact.snapshot_root, expected_graph_root, key_fact.key_root,
      issuer->>'authorityRoot',
      record_fact.audit_event_root, snapshot_fact.audit_event_root, key_fact.audit_event_root
    ]::text[]) AS value ORDER BY value
  ));
  genesis_root := audit.sha256_stable_json(jsonb_build_object('kind', 'canopyproof-audit-genesis-v1'));

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.issuer_id
     OR transaction_organization_id <> NEW.organization_id
     OR mrv.has_forbidden_key(NEW.fact_record)
     OR NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','recordId','recordRoot','recordIssuedAt',
         'governedRecordProjectionRoot','mrvSnapshotId','mrvSnapshotRoot','mrvEdgeSetRoot',
         'mrvGraphRoot','mrvReviewedAt','methodologyId','methodologyPublicationRoot',
         'observationPeriod','validity','monitoringSchedule','assertionType','assertionScopeHash',
         'locationScopeHash','uncertaintyHash','limitationHashes','relianceStatement','issuer',
         'signingKeyAuthorityId','signingKeyRoot','sourceEventRoots','sourceRoot',
         'signaturePayloadHash','boundAt','commandHash','recordSequence','previousEventRoot',
         'bindingHash','bindingRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','recordId','recordRoot','recordIssuedAt',
         'governedRecordProjectionRoot','mrvSnapshotId','mrvSnapshotRoot','mrvEdgeSetRoot',
         'mrvGraphRoot','mrvReviewedAt','methodologyId','methodologyPublicationRoot',
         'observationPeriod','validity','monitoringSchedule','assertionType','assertionScopeHash',
         'locationScopeHash','uncertaintyHash','limitationHashes','relianceStatement','issuer',
         'signingKeyAuthorityId','signingKeyRoot','sourceEventRoots','sourceRoot',
         'signaturePayloadHash','boundAt','commandHash','recordSequence','previousEventRoot',
         'bindingHash','bindingRoot','safety','auditEvent'
       ]::text[]
     )
     OR NOT mrv.keys_are_valid(
       NEW.fact_record->'observationPeriod',
       ARRAY['startsAt','endsAt']::text[], ARRAY['startsAt','endsAt']::text[]
     )
     OR NOT mrv.keys_are_valid(
       NEW.fact_record->'validity',
       ARRAY['validFrom','expiresAt']::text[], ARRAY['validFrom','expiresAt']::text[]
     )
     OR NOT mrv.keys_are_valid(
       NEW.fact_record->'monitoringSchedule',
       ARRAY['cadenceDays','nextDueAt','graceDays']::text[],
       ARRAY['cadenceDays','nextDueAt','graceDays']::text[]
     )
     OR NEW.fact_record->>'factType' <> 'environmental_proof_lifecycle_binding'
     OR NEW.fact_record->>'id' <> NEW.id
     OR NEW.fact_record->>'organizationId' <> NEW.organization_id
     OR NEW.fact_record->>'projectId' <> NEW.project_id
     OR NEW.fact_record->>'recordId' <> NEW.record_id
     OR NEW.fact_record->>'recordRoot' <> NEW.record_root
     OR (NEW.fact_record->>'recordIssuedAt')::timestamptz <> NEW.record_issued_at
     OR NEW.fact_record->>'governedRecordProjectionRoot' <> NEW.governed_record_projection_root
     OR NEW.fact_record->>'mrvSnapshotId' <> NEW.mrv_snapshot_id
     OR NEW.fact_record->>'mrvSnapshotRoot' <> NEW.mrv_snapshot_root
     OR NEW.fact_record->>'mrvEdgeSetRoot' <> NEW.mrv_edge_set_root
     OR NEW.fact_record->>'mrvGraphRoot' <> NEW.mrv_graph_root
     OR (NEW.fact_record->>'mrvReviewedAt')::timestamptz <> NEW.mrv_reviewed_at
     OR NEW.fact_record->>'methodologyId' <> NEW.methodology_id
     OR NEW.fact_record->>'methodologyPublicationRoot' <> NEW.methodology_publication_root
     OR (NEW.fact_record->'observationPeriod'->>'startsAt')::timestamptz <> NEW.observation_starts_at
     OR (NEW.fact_record->'observationPeriod'->>'endsAt')::timestamptz <> NEW.observation_ends_at
     OR (NEW.fact_record->'validity'->>'validFrom')::timestamptz <> NEW.valid_from
     OR (NEW.fact_record->'validity'->>'expiresAt')::timestamptz <> NEW.expires_at
     OR (NEW.fact_record->'monitoringSchedule'->>'cadenceDays')::integer <> NEW.monitoring_cadence_days
     OR (NEW.fact_record->'monitoringSchedule'->>'nextDueAt')::timestamptz <> NEW.next_monitoring_due_at
     OR (NEW.fact_record->'monitoringSchedule'->>'graceDays')::integer <> NEW.monitoring_grace_days
     OR NEW.fact_record->>'assertionType' <> NEW.assertion_type
     OR NEW.fact_record->>'assertionScopeHash' <> NEW.assertion_scope_hash
     OR NEW.fact_record->>'locationScopeHash' <> NEW.location_scope_hash
     OR NEW.fact_record->>'uncertaintyHash' <> NEW.uncertainty_hash
     OR limitation_hashes <> NEW.limitation_hashes
     OR NEW.fact_record->>'relianceStatement' <> NEW.reliance_statement
     OR NEW.fact_record->'issuer'->>'id' <> NEW.issuer_id
     OR NEW.fact_record->>'signingKeyAuthorityId' <> NEW.signing_key_authority_id
     OR NEW.fact_record->>'signingKeyRoot' <> NEW.signing_key_root
     OR source_event_roots <> NEW.source_event_roots
     OR NEW.fact_record->>'sourceRoot' <> NEW.source_root
     OR NEW.fact_record->>'signaturePayloadHash' <> NEW.signature_payload_hash
     OR (NEW.fact_record->>'boundAt')::timestamptz <> NEW.bound_at
     OR NEW.fact_record->>'commandHash' <> NEW.command_hash
     OR (NEW.fact_record->>'recordSequence')::bigint <> NEW.record_sequence
     OR NEW.fact_record->>'previousEventRoot' <> NEW.previous_event_root
     OR NEW.fact_record->>'bindingHash' <> NEW.binding_hash
     OR NEW.fact_record->>'bindingRoot' <> NEW.binding_root
     OR record_fact.organization_id <> NEW.organization_id
     OR record_fact.project_id <> NEW.project_id
     OR record_fact.record_root <> NEW.record_root
     OR record_fact.issued_at <> NEW.record_issued_at
     OR record_fact.issuer_id <> NEW.issuer_id
     OR record_fact.methodology_id <> NEW.methodology_id
     OR record_fact.methodology_publication_root <> NEW.methodology_publication_root
     OR governed_projection.state <> 'issued'
     OR governed_projection.source_authority_current IS NOT TRUE
     OR governed_projection.projection_root <> NEW.governed_record_projection_root
     OR snapshot_fact.organization_id <> NEW.organization_id
     OR snapshot_fact.project_id <> NEW.project_id
     OR snapshot_fact.id <> latest_snapshot.id
     OR snapshot_fact.snapshot_root <> NEW.mrv_snapshot_root
     OR snapshot_fact.edge_set_root <> NEW.mrv_edge_set_root
     OR snapshot_fact.reviewed_at <> NEW.mrv_reviewed_at
     OR snapshot_fact.snapshot_state <> 'reviewed_for_lineage'
     OR snapshot_fact.methodology_id <> NEW.methodology_id
     OR snapshot_fact.methodology_publication_root <> NEW.methodology_publication_root
     OR NEW.mrv_graph_root <> expected_graph_root
     OR NOT EXISTS (
       SELECT 1
       FROM mrv.graph_snapshot_member_facts member
       JOIN mrv.graph_edge_facts edge ON edge.id = member.edge_id
       WHERE member.snapshot_id = snapshot_fact.id
         AND edge.relationship = 'SUPPORTS'
         AND edge.target_type = 'environmental_proof_record'
         AND edge.target_id = NEW.record_id
         AND edge.target_root = NEW.record_root
     )
     OR key_fact.organization_id <> NEW.organization_id
     OR key_fact.key_root <> NEW.signing_key_root
     OR key_fact.active_from > NEW.bound_at
     OR (key_fact.expires_at IS NOT NULL AND NEW.valid_from >= key_fact.expires_at)
     OR EXISTS (
       SELECT 1 FROM governance.environmental_proof_signing_key_revocation_facts revocation
       WHERE revocation.key_authority_id = key_fact.id AND revocation.revoked_at <= NEW.bound_at
     )
     OR NOT COALESCE(certificates.environmental_proof_lifecycle_actor_is_valid(
       issuer, NEW.issuer_id, NEW.organization_id,
       ARRAY['owner','admin']::text[], 'environmental_proof_lifecycle:issue'
     ), false)
     OR NOT audit.is_sorted_unique_text_array(source_event_roots)
     OR source_event_roots <> expected_source_event_roots
     OR NOT audit.is_sorted_unique_text_array(limitation_hashes)
     OR EXISTS (SELECT 1 FROM unnest(limitation_hashes) AS value WHERE value !~ '^[0-9a-f]{64}$')
     OR NEW.observation_starts_at >= NEW.observation_ends_at
     OR NEW.observation_ends_at > NEW.record_issued_at
     OR NEW.bound_at < NEW.record_issued_at
     OR NEW.bound_at < NEW.mrv_reviewed_at
     OR NEW.valid_from < NEW.bound_at
     OR NEW.expires_at <= NEW.valid_from
     OR NEW.expires_at > NEW.valid_from + interval '366 days'
     OR NEW.next_monitoring_due_at <= NEW.valid_from
     OR NEW.next_monitoring_due_at > NEW.expires_at
     OR NEW.bound_at <> date_trunc('milliseconds', NEW.bound_at)
     OR NEW.source_root <> expected_source_root
     OR NEW.record_sequence <> 1
     OR NEW.previous_event_root <> genesis_root
     OR NEW.fact_record->'safety' <> certificates.environmental_proof_lifecycle_safety_canonical()
     OR NEW.signature_payload_hash <> certificates.environmental_proof_lifecycle_signature_payload_hash(NEW.fact_record)
     OR NEW.command_hash <> certificates.environmental_proof_lifecycle_binding_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_environmental_proof_lifecycle_' || left(NEW.command_hash, 24)
     OR NEW.binding_hash <> certificates.environmental_proof_lifecycle_binding_hash(NEW.fact_record)
     OR NEW.binding_root <> certificates.environmental_proof_lifecycle_binding_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_LIFECYCLE_BINDING_INVALID';
  END IF;

  IF NOT certificates.environmental_proof_lifecycle_event_is_contiguous(NEW.audit_event_root)
     OR semantic_event.stream_id <> 'certificate-lifecycle:' || NEW.record_id
     OR semantic_event.sequence_no <> NEW.record_sequence
     OR semantic_event.action <> 'ASSERT'
     OR semantic_event.actor_id <> NEW.issuer_id
     OR semantic_event.entity_type <> 'environmental_proof_lifecycle_binding'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.bound_at
     OR semantic_event.payload_hash <> certificates.environmental_proof_lifecycle_payload_hash(NEW.fact_record)
     OR NEW.fact_record->'auditEvent' <> mrv.audit_event_record(semantic_event)
     OR semantic_event.rationale <> 'A canonical Environmental Proof Record was bound to reviewed MRV lineage, fixed validity, and managed-key authority.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_LIFECYCLE_BINDING_EVENT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS environmental_proof_lifecycle_bindings_validate
  ON certificates.environmental_proof_lifecycle_binding_facts;
CREATE TRIGGER environmental_proof_lifecycle_bindings_validate
BEFORE INSERT ON certificates.environmental_proof_lifecycle_binding_facts
FOR EACH ROW EXECUTE FUNCTION certificates.validate_environmental_proof_lifecycle_binding_insert();

CREATE OR REPLACE FUNCTION certificates.validate_environmental_proof_signature_receipt_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  binding_fact certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  key_fact governance.environmental_proof_signing_key_attestation_facts%ROWTYPE;
  key_revocation governance.environmental_proof_signing_key_revocation_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  expected_signature_hash text;
  expected_source_root text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT binding_fact
  FROM certificates.environmental_proof_lifecycle_binding_facts WHERE id = NEW.binding_id FOR SHARE;
  SELECT * INTO STRICT key_fact
  FROM governance.environmental_proof_signing_key_attestation_facts
  WHERE id = NEW.signing_key_authority_id FOR SHARE;
  SELECT * INTO key_revocation
  FROM governance.environmental_proof_signing_key_revocation_facts
  WHERE key_authority_id = key_fact.id;
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  expected_signature_hash := certificates.environmental_proof_signature_hash(NEW.fact_record);
  expected_source_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(ARRAY[
      binding_fact.binding_root, key_fact.key_root,
      expected_signature_hash, NEW.provider_receipt_hash
    ]::text[]) AS value ORDER BY value
  ));

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.external_verifier_id
     OR transaction_organization_id <> NEW.organization_id
     OR mrv.has_forbidden_key(NEW.fact_record)
     OR NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','recordId','recordRoot',
         'bindingId','bindingRoot','signingKeyAuthorityId','signingKeyRoot','algorithm',
         'signaturePayloadHash','detachedSignature','signatureHash','externalVerifierId',
         'providerReceiptIdHash','providerReceiptHash','signedAt','verifiedAt','commandHash',
         'recordSequence','previousEventRoot','sourceRoot','receiptHash','receiptRoot',
         'safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','recordId','recordRoot',
         'bindingId','bindingRoot','signingKeyAuthorityId','signingKeyRoot','algorithm',
         'signaturePayloadHash','detachedSignature','signatureHash','externalVerifierId',
         'providerReceiptIdHash','providerReceiptHash','signedAt','verifiedAt','commandHash',
         'recordSequence','previousEventRoot','sourceRoot','receiptHash','receiptRoot',
         'safety','auditEvent'
       ]::text[]
     )
     OR NEW.fact_record->>'factType' <> 'environmental_proof_signature_receipt'
     OR NEW.fact_record->>'id' <> NEW.id
     OR NEW.fact_record->>'organizationId' <> NEW.organization_id
     OR NEW.fact_record->>'projectId' <> NEW.project_id
     OR NEW.fact_record->>'recordId' <> NEW.record_id
     OR NEW.fact_record->>'recordRoot' <> NEW.record_root
     OR NEW.fact_record->>'bindingId' <> NEW.binding_id
     OR NEW.fact_record->>'bindingRoot' <> NEW.binding_root
     OR NEW.fact_record->>'signingKeyAuthorityId' <> NEW.signing_key_authority_id
     OR NEW.fact_record->>'signingKeyRoot' <> NEW.signing_key_root
     OR NEW.fact_record->>'algorithm' <> NEW.algorithm
     OR NEW.fact_record->>'signaturePayloadHash' <> NEW.signature_payload_hash
     OR NEW.fact_record->>'detachedSignature' <> NEW.detached_signature
     OR NEW.fact_record->>'signatureHash' <> NEW.signature_hash
     OR NEW.fact_record->>'externalVerifierId' <> NEW.external_verifier_id
     OR NEW.fact_record->>'providerReceiptIdHash' <> NEW.provider_receipt_id_hash
     OR NEW.fact_record->>'providerReceiptHash' <> NEW.provider_receipt_hash
     OR (NEW.fact_record->>'signedAt')::timestamptz <> NEW.signed_at
     OR (NEW.fact_record->>'verifiedAt')::timestamptz <> NEW.verified_at
     OR NEW.fact_record->>'commandHash' <> NEW.command_hash
     OR (NEW.fact_record->>'recordSequence')::bigint <> NEW.record_sequence
     OR NEW.fact_record->>'previousEventRoot' <> NEW.previous_event_root
     OR NEW.fact_record->>'sourceRoot' <> NEW.source_root
     OR NEW.fact_record->>'receiptHash' <> NEW.receipt_hash
     OR NEW.fact_record->>'receiptRoot' <> NEW.receipt_root
     OR binding_fact.organization_id <> NEW.organization_id
     OR binding_fact.project_id <> NEW.project_id
     OR binding_fact.record_id <> NEW.record_id
     OR binding_fact.record_root <> NEW.record_root
     OR binding_fact.binding_root <> NEW.binding_root
     OR binding_fact.signing_key_authority_id <> NEW.signing_key_authority_id
     OR binding_fact.signing_key_root <> NEW.signing_key_root
     OR binding_fact.signature_payload_hash <> NEW.signature_payload_hash
     OR key_fact.organization_id <> NEW.organization_id
     OR key_fact.key_root <> NEW.signing_key_root
     OR key_fact.algorithm <> NEW.algorithm
     OR NOT certificates.environmental_proof_lifecycle_external_verifier_is_valid(
       NEW.external_verifier_id, NEW.organization_id
     )
     OR NEW.signed_at < binding_fact.bound_at
     OR NEW.signed_at < key_fact.active_from
     OR NEW.signed_at >= binding_fact.expires_at
     OR NEW.verified_at < NEW.signed_at
     OR NEW.verified_at >= binding_fact.expires_at
     OR (key_fact.expires_at IS NOT NULL AND NEW.signed_at >= key_fact.expires_at)
     OR (key_revocation.id IS NOT NULL AND NEW.signed_at >= key_revocation.revoked_at)
     OR NEW.signed_at <> date_trunc('milliseconds', NEW.signed_at)
     OR NEW.verified_at <> date_trunc('milliseconds', NEW.verified_at)
     OR NEW.signature_hash <> expected_signature_hash
     OR NEW.source_root <> expected_source_root
     OR NEW.fact_record->'safety' <> certificates.environmental_proof_lifecycle_safety_canonical()
     OR NEW.command_hash <> certificates.environmental_proof_signature_receipt_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_environmental_proof_signature_' || left(NEW.command_hash, 24)
     OR NEW.receipt_hash <> certificates.environmental_proof_signature_receipt_hash(NEW.fact_record)
     OR NEW.receipt_root <> certificates.environmental_proof_signature_receipt_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_SIGNATURE_RECEIPT_INVALID';
  END IF;

  IF NOT certificates.environmental_proof_lifecycle_event_is_contiguous(NEW.audit_event_root)
     OR semantic_event.stream_id <> 'certificate-lifecycle:' || NEW.record_id
     OR semantic_event.sequence_no <> NEW.record_sequence
     OR semantic_event.action <> 'FULFILL'
     OR semantic_event.actor_id <> NEW.external_verifier_id
     OR semantic_event.entity_type <> 'environmental_proof_signature_receipt'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.verified_at
     OR semantic_event.payload_hash <> certificates.environmental_proof_lifecycle_payload_hash(NEW.fact_record)
     OR NEW.fact_record->'auditEvent' <> mrv.audit_event_record(semantic_event)
     OR semantic_event.rationale <> 'An external managed-signature verifier accepted the detached signature for the exact lifecycle payload.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_SIGNATURE_RECEIPT_EVENT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS environmental_proof_signature_receipts_validate
  ON certificates.environmental_proof_signature_receipt_facts;
CREATE TRIGGER environmental_proof_signature_receipts_validate
BEFORE INSERT ON certificates.environmental_proof_signature_receipt_facts
FOR EACH ROW EXECUTE FUNCTION certificates.validate_environmental_proof_signature_receipt_insert();

CREATE OR REPLACE FUNCTION certificates.environmental_proof_lifecycle_projection(
  target_binding_id text,
  evaluated_at timestamptz
)
RETURNS TABLE (
  organization_id text,
  project_id text,
  record_id text,
  record_root text,
  binding_id text,
  binding_root text,
  state text,
  evaluated_at_value timestamptz,
  governed_record_state text,
  source_authority_current boolean,
  mrv_state text,
  bound_mrv_snapshot_current boolean,
  key_state text,
  signature_verified boolean,
  validity_current boolean,
  current_control_action text,
  successor_binding_id text,
  issue_codes text[],
  projection_root text,
  safety jsonb
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  binding_fact certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  key_fact governance.environmental_proof_signing_key_attestation_facts%ROWTYPE;
  key_revocation governance.environmental_proof_signing_key_revocation_facts%ROWTYPE;
  signature_fact certificates.environmental_proof_signature_receipt_facts%ROWTYPE;
  latest_snapshot mrv.graph_snapshot_facts%ROWTYPE;
  latest_control governance.environmental_proof_lifecycle_control_facts%ROWTYPE;
  governed record;
  projected_state text;
  projected_key_state text;
  projected_mrv_state text;
  mrv_current boolean;
  signature_current boolean;
  validity_is_current boolean;
  issues text[] := ARRAY[]::text[];
  projected_root text;
BEGIN
  IF evaluated_at IS NULL OR evaluated_at <> date_trunc('milliseconds', evaluated_at) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_LIFECYCLE_EVALUATION_TIME_INVALID';
  END IF;
  SELECT * INTO STRICT binding_fact
  FROM certificates.environmental_proof_lifecycle_binding_facts AS binding_source
  WHERE binding_source.id = target_binding_id;
  SELECT * INTO STRICT key_fact
  FROM governance.environmental_proof_signing_key_attestation_facts AS key_source
  WHERE key_source.id = binding_fact.signing_key_authority_id;
  SELECT * INTO key_revocation
  FROM governance.environmental_proof_signing_key_revocation_facts AS revocation_source
  WHERE revocation_source.key_authority_id = key_fact.id
    AND revocation_source.revoked_at <= evaluated_at;
  SELECT * INTO signature_fact
  FROM certificates.environmental_proof_signature_receipt_facts AS signature_source
  WHERE signature_source.binding_id = binding_fact.id
    AND signature_source.verified_at <= evaluated_at;
  SELECT * INTO STRICT latest_snapshot
  FROM mrv.graph_snapshot_facts AS snapshot_source
  WHERE snapshot_source.organization_id = binding_fact.organization_id
    AND snapshot_source.project_id = binding_fact.project_id
  ORDER BY snapshot_source.snapshot_sequence DESC, snapshot_source.id DESC LIMIT 1;
  SELECT * INTO latest_control
  FROM governance.environmental_proof_lifecycle_control_facts AS control_source
  WHERE control_source.binding_id = binding_fact.id
    AND control_source.decided_at <= evaluated_at
  ORDER BY control_source.record_sequence DESC, control_source.id DESC LIMIT 1;
  SELECT * INTO STRICT governed
  FROM certificates.environmental_proof_governed_record_projection(binding_fact.record_id);

  projected_mrv_state := latest_snapshot.snapshot_state;
  mrv_current := latest_snapshot.snapshot_state = 'reviewed_for_lineage'
    AND latest_snapshot.id = binding_fact.mrv_snapshot_id
    AND latest_snapshot.snapshot_root = binding_fact.mrv_snapshot_root;
  signature_current := signature_fact.id IS NOT NULL;
  validity_is_current := evaluated_at >= binding_fact.valid_from AND evaluated_at < binding_fact.expires_at;
  projected_key_state := CASE
    WHEN key_revocation.id IS NOT NULL THEN 'revoked'
    WHEN evaluated_at < key_fact.active_from THEN 'not_yet_active'
    WHEN key_fact.expires_at IS NOT NULL AND evaluated_at >= key_fact.expires_at THEN 'expired'
    ELSE 'active'
  END;

  IF governed.state <> 'issued' THEN issues := array_append(issues, 'record_' || governed.state); END IF;
  IF governed.source_authority_current IS NOT TRUE THEN issues := array_append(issues, 'record_source_stale'); END IF;
  IF NOT mrv_current THEN issues := array_append(issues, 'mrv_snapshot_not_current'); END IF;
  IF projected_mrv_state <> 'reviewed_for_lineage' THEN issues := array_append(issues, 'mrv_review_required'); END IF;
  IF NOT signature_current THEN issues := array_append(issues, 'signature_missing'); END IF;
  IF projected_key_state <> 'active' THEN issues := array_append(issues, 'signing_key_' || projected_key_state); END IF;
  IF evaluated_at < binding_fact.valid_from THEN issues := array_append(issues, 'not_yet_valid'); END IF;
  IF evaluated_at >= binding_fact.expires_at THEN issues := array_append(issues, 'validity_expired'); END IF;
  IF latest_control.action = 'suspend' THEN issues := array_append(issues, 'governance_suspended'); END IF;
  IF latest_control.action = 'supersede' THEN issues := array_append(issues, 'record_superseded'); END IF;
  SELECT COALESCE(array_agg(DISTINCT value ORDER BY value), ARRAY[]::text[])
  INTO issues FROM unnest(issues) AS value;

  projected_state := CASE
    WHEN latest_control.action = 'supersede' THEN 'superseded'
    WHEN governed.state = 'revoked' THEN 'revoked'
    WHEN governed.state = 'challenged' THEN 'challenged'
    WHEN evaluated_at >= binding_fact.expires_at THEN 'expired'
    WHEN latest_control.action = 'suspend'
      OR governed.state <> 'issued'
      OR governed.source_authority_current IS NOT TRUE
      OR NOT mrv_current
      OR projected_key_state <> 'active' THEN 'suspended'
    WHEN NOT signature_current OR evaluated_at < binding_fact.valid_from THEN 'issued'
    ELSE 'active'
  END;

  projected_root := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-environmental-proof-lifecycle-projection-v1',
    'organizationId', binding_fact.organization_id,
    'projectId', binding_fact.project_id,
    'recordId', binding_fact.record_id,
    'recordRoot', binding_fact.record_root,
    'bindingId', binding_fact.id,
    'bindingRoot', binding_fact.binding_root,
    'state', projected_state,
    'evaluatedAt', audit.iso8601_millis(evaluated_at),
    'governedRecordState', governed.state,
    'sourceAuthorityCurrent', governed.source_authority_current,
    'mrvState', projected_mrv_state,
    'boundMrvSnapshotCurrent', mrv_current,
    'keyState', projected_key_state,
    'signatureVerified', signature_current,
    'validityCurrent', validity_is_current,
    'currentControlAction', latest_control.action,
    'successorBindingId', latest_control.successor_binding_id,
    'issueCodes', to_jsonb(issues)
  ));

  RETURN QUERY SELECT
    binding_fact.organization_id, binding_fact.project_id, binding_fact.record_id,
    binding_fact.record_root, binding_fact.id, binding_fact.binding_root,
    projected_state, evaluated_at, governed.state, governed.source_authority_current,
    projected_mrv_state, mrv_current, projected_key_state, signature_current,
    validity_is_current, latest_control.action, latest_control.successor_binding_id,
    issues, projected_root, certificates.environmental_proof_lifecycle_safety_canonical();
END;
$$;

CREATE OR REPLACE FUNCTION certificates.validate_environmental_proof_lifecycle_control_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  binding_fact certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  successor_binding certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  prior_control governance.environmental_proof_lifecycle_control_facts%ROWTYPE;
  prior_projection record;
  successor_projection record;
  governed_projection record;
  latest_snapshot mrv.graph_snapshot_facts%ROWTYPE;
  governor jsonb;
  semantic_event audit.domain_events%ROWTYPE;
  source_projection_roots text[];
  expected_source_projection_roots text[];
  expected_mrv_graph_root text;
  expected_source_root text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT binding_fact
  FROM certificates.environmental_proof_lifecycle_binding_facts WHERE id = NEW.binding_id FOR SHARE;
  SELECT * INTO prior_control
  FROM governance.environmental_proof_lifecycle_control_facts
  WHERE binding_id = NEW.binding_id
  ORDER BY record_sequence DESC, id DESC LIMIT 1;
  SELECT * INTO STRICT prior_projection
  FROM certificates.environmental_proof_lifecycle_projection(NEW.binding_id, NEW.decided_at);
  SELECT * INTO STRICT governed_projection
  FROM certificates.environmental_proof_governed_record_projection(NEW.record_id);
  SELECT * INTO STRICT latest_snapshot
  FROM mrv.graph_snapshot_facts
  WHERE organization_id = NEW.organization_id AND project_id = NEW.project_id
  ORDER BY snapshot_sequence DESC, id DESC LIMIT 1;
  governor := NEW.fact_record->'governor';
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO source_projection_roots
  FROM jsonb_array_elements_text(NEW.fact_record->'sourceProjectionRoots') WITH ORDINALITY AS item(value, position);
  expected_mrv_graph_root := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-mrv-graph-projection-v1',
    'organizationId', NEW.organization_id,
    'projectId', NEW.project_id,
    'state', latest_snapshot.snapshot_state,
    'latestSnapshotId', latest_snapshot.id,
    'latestSnapshotRoot', latest_snapshot.snapshot_root,
    'finalProofChanged', false
  ));

  IF NEW.action = 'supersede' THEN
    SELECT * INTO STRICT successor_binding
    FROM certificates.environmental_proof_lifecycle_binding_facts
    WHERE id = NEW.successor_binding_id FOR SHARE;
    SELECT * INTO STRICT successor_projection
    FROM certificates.environmental_proof_lifecycle_projection(successor_binding.id, NEW.decided_at);
    expected_source_projection_roots := ARRAY(
      SELECT value FROM unnest(ARRAY[
        prior_projection.projection_root, governed_projection.projection_root,
        expected_mrv_graph_root, successor_projection.projection_root
      ]::text[]) AS value ORDER BY value
    );
  ELSE
    expected_source_projection_roots := ARRAY(
      SELECT value FROM unnest(ARRAY[
        prior_projection.projection_root, governed_projection.projection_root,
        expected_mrv_graph_root
      ]::text[]) AS value ORDER BY value
    );
  END IF;
  expected_source_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(
      ARRAY[binding_fact.binding_root, governor->>'authorityRoot']::text[] ||
      expected_source_projection_roots ||
      CASE WHEN prior_control.id IS NULL THEN ARRAY[]::text[] ELSE ARRAY[prior_control.control_root]::text[] END
    ) AS value ORDER BY value
  ));

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.governor_id
     OR transaction_organization_id <> NEW.organization_id
     OR mrv.has_forbidden_key(NEW.fact_record)
     OR NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','recordId','recordRoot','bindingId',
         'bindingRoot','action','priorState','priorProjectionRoot','successorBindingId',
         'successorBindingRoot','successorProjectionRoot','rationale','conflictDisclosure',
         'sourceProjectionRoots','sourceRoot','governor','decidedAt','commandHash',
         'recordSequence','previousEventRoot','controlHash','controlRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','recordId','recordRoot','bindingId',
         'bindingRoot','action','priorState','priorProjectionRoot','rationale','conflictDisclosure',
         'sourceProjectionRoots','sourceRoot','governor','decidedAt','commandHash',
         'recordSequence','previousEventRoot','controlHash','controlRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.fact_record->>'factType' <> 'environmental_proof_lifecycle_control'
     OR NEW.fact_record->>'id' <> NEW.id
     OR NEW.fact_record->>'organizationId' <> NEW.organization_id
     OR NEW.fact_record->>'projectId' <> NEW.project_id
     OR NEW.fact_record->>'recordId' <> NEW.record_id
     OR NEW.fact_record->>'recordRoot' <> NEW.record_root
     OR NEW.fact_record->>'bindingId' <> NEW.binding_id
     OR NEW.fact_record->>'bindingRoot' <> NEW.binding_root
     OR NEW.fact_record->>'action' <> NEW.action
     OR NEW.fact_record->>'priorState' <> NEW.prior_state
     OR NEW.fact_record->>'priorProjectionRoot' <> NEW.prior_projection_root
     OR ((NEW.fact_record ? 'successorBindingId') <> (NEW.successor_binding_id IS NOT NULL))
     OR ((NEW.fact_record ? 'successorBindingRoot') <> (NEW.successor_binding_root IS NOT NULL))
     OR ((NEW.fact_record ? 'successorProjectionRoot') <> (NEW.successor_projection_root IS NOT NULL))
     OR (NEW.successor_binding_id IS NOT NULL AND NEW.fact_record->>'successorBindingId' <> NEW.successor_binding_id)
     OR (NEW.successor_binding_root IS NOT NULL AND NEW.fact_record->>'successorBindingRoot' <> NEW.successor_binding_root)
     OR (NEW.successor_projection_root IS NOT NULL AND NEW.fact_record->>'successorProjectionRoot' <> NEW.successor_projection_root)
     OR NEW.fact_record->>'rationale' <> NEW.rationale
     OR NEW.fact_record->>'conflictDisclosure' <> NEW.conflict_disclosure
     OR source_projection_roots <> NEW.source_projection_roots
     OR NEW.fact_record->>'sourceRoot' <> NEW.source_root
     OR NEW.fact_record->'governor'->>'id' <> NEW.governor_id
     OR (NEW.fact_record->>'decidedAt')::timestamptz <> NEW.decided_at
     OR NEW.fact_record->>'commandHash' <> NEW.command_hash
     OR (NEW.fact_record->>'recordSequence')::bigint <> NEW.record_sequence
     OR NEW.fact_record->>'previousEventRoot' <> NEW.previous_event_root
     OR NEW.fact_record->>'controlHash' <> NEW.control_hash
     OR NEW.fact_record->>'controlRoot' <> NEW.control_root
     OR binding_fact.organization_id <> NEW.organization_id
     OR binding_fact.project_id <> NEW.project_id
     OR binding_fact.record_id <> NEW.record_id
     OR binding_fact.record_root <> NEW.record_root
     OR binding_fact.binding_root <> NEW.binding_root
     OR binding_fact.issuer_id = NEW.governor_id
     OR NOT COALESCE(certificates.environmental_proof_lifecycle_actor_is_valid(
       governor, NEW.governor_id, NEW.organization_id,
       ARRAY['owner','admin','verifier']::text[], 'environmental_proof_lifecycle:govern'
     ), false)
     OR NOT certificates.environmental_proof_lifecycle_text_is_safe(NEW.rationale)
     OR NOT certificates.environmental_proof_lifecycle_text_is_safe(NEW.conflict_disclosure)
     OR NEW.prior_state <> prior_projection.state
     OR NEW.prior_projection_root <> prior_projection.projection_root
     OR NOT audit.is_sorted_unique_text_array(source_projection_roots)
     OR source_projection_roots <> expected_source_projection_roots
     OR NEW.decided_at < binding_fact.bound_at
     OR NEW.decided_at <> date_trunc('milliseconds', NEW.decided_at)
     OR (NEW.action = 'suspend' AND prior_projection.state IN ('revoked','expired','superseded','suspended'))
     OR (NEW.action = 'reinstate' AND (
       prior_control.action IS DISTINCT FROM 'suspend'
       OR prior_projection.state <> 'suspended'
       OR prior_projection.governed_record_state <> 'issued'
       OR prior_projection.source_authority_current IS NOT TRUE
       OR prior_projection.bound_mrv_snapshot_current IS NOT TRUE
       OR prior_projection.key_state <> 'active'
       OR prior_projection.signature_verified IS NOT TRUE
       OR prior_projection.validity_current IS NOT TRUE
     ))
     OR (NEW.action = 'supersede' AND (
       successor_binding.id IS NULL
       OR successor_binding.id = binding_fact.id
       OR successor_binding.organization_id <> NEW.organization_id
       OR successor_binding.project_id <> NEW.project_id
       OR successor_binding.bound_at <= binding_fact.bound_at
       OR successor_binding.binding_root <> NEW.successor_binding_root
       OR successor_projection.projection_root <> NEW.successor_projection_root
       OR successor_projection.state <> 'active'
       OR prior_projection.state = 'superseded'
     ))
     OR NEW.source_root <> expected_source_root
     OR NEW.fact_record->'safety' <> certificates.environmental_proof_lifecycle_safety_canonical()
     OR NEW.command_hash <> certificates.environmental_proof_lifecycle_control_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_environmental_proof_lifecycle_control_' || left(NEW.command_hash, 24)
     OR NEW.control_hash <> certificates.environmental_proof_lifecycle_control_hash(NEW.fact_record)
     OR NEW.control_root <> certificates.environmental_proof_lifecycle_control_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_LIFECYCLE_CONTROL_INVALID';
  END IF;

  IF NOT certificates.environmental_proof_lifecycle_event_is_contiguous(NEW.audit_event_root)
     OR semantic_event.stream_id <> 'certificate-lifecycle:' || NEW.record_id
     OR semantic_event.sequence_no <> NEW.record_sequence
     OR semantic_event.action <> (CASE WHEN NEW.action = 'suspend' THEN 'CHALLENGE' ELSE 'FULFILL' END)
     OR semantic_event.actor_id <> NEW.governor_id
     OR semantic_event.entity_type <> 'environmental_proof_lifecycle_control'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.decided_at
     OR semantic_event.payload_hash <> certificates.environmental_proof_lifecycle_payload_hash(NEW.fact_record)
     OR NEW.fact_record->'auditEvent' <> mrv.audit_event_record(semantic_event)
     OR semantic_event.rationale <> NEW.rationale THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_LIFECYCLE_CONTROL_EVENT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS environmental_proof_lifecycle_controls_validate
  ON governance.environmental_proof_lifecycle_control_facts;
CREATE TRIGGER environmental_proof_lifecycle_controls_validate
BEFORE INSERT ON governance.environmental_proof_lifecycle_control_facts
FOR EACH ROW EXECUTE FUNCTION certificates.validate_environmental_proof_lifecycle_control_insert();

DROP TRIGGER IF EXISTS environmental_proof_signing_keys_no_update
  ON governance.environmental_proof_signing_key_attestation_facts;
CREATE TRIGGER environmental_proof_signing_keys_no_update
BEFORE UPDATE ON governance.environmental_proof_signing_key_attestation_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_signing_keys_no_delete
  ON governance.environmental_proof_signing_key_attestation_facts;
CREATE TRIGGER environmental_proof_signing_keys_no_delete
BEFORE DELETE ON governance.environmental_proof_signing_key_attestation_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_signing_keys_audit
  ON governance.environmental_proof_signing_key_attestation_facts;
CREATE TRIGGER environmental_proof_signing_keys_audit
AFTER INSERT OR UPDATE OR DELETE ON governance.environmental_proof_signing_key_attestation_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS environmental_proof_signing_key_revocations_no_update
  ON governance.environmental_proof_signing_key_revocation_facts;
CREATE TRIGGER environmental_proof_signing_key_revocations_no_update
BEFORE UPDATE ON governance.environmental_proof_signing_key_revocation_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_signing_key_revocations_no_delete
  ON governance.environmental_proof_signing_key_revocation_facts;
CREATE TRIGGER environmental_proof_signing_key_revocations_no_delete
BEFORE DELETE ON governance.environmental_proof_signing_key_revocation_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_signing_key_revocations_audit
  ON governance.environmental_proof_signing_key_revocation_facts;
CREATE TRIGGER environmental_proof_signing_key_revocations_audit
AFTER INSERT OR UPDATE OR DELETE ON governance.environmental_proof_signing_key_revocation_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS environmental_proof_lifecycle_bindings_no_update
  ON certificates.environmental_proof_lifecycle_binding_facts;
CREATE TRIGGER environmental_proof_lifecycle_bindings_no_update
BEFORE UPDATE ON certificates.environmental_proof_lifecycle_binding_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_lifecycle_bindings_no_delete
  ON certificates.environmental_proof_lifecycle_binding_facts;
CREATE TRIGGER environmental_proof_lifecycle_bindings_no_delete
BEFORE DELETE ON certificates.environmental_proof_lifecycle_binding_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_lifecycle_bindings_audit
  ON certificates.environmental_proof_lifecycle_binding_facts;
CREATE TRIGGER environmental_proof_lifecycle_bindings_audit
AFTER INSERT OR UPDATE OR DELETE ON certificates.environmental_proof_lifecycle_binding_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS environmental_proof_signature_receipts_no_update
  ON certificates.environmental_proof_signature_receipt_facts;
CREATE TRIGGER environmental_proof_signature_receipts_no_update
BEFORE UPDATE ON certificates.environmental_proof_signature_receipt_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_signature_receipts_no_delete
  ON certificates.environmental_proof_signature_receipt_facts;
CREATE TRIGGER environmental_proof_signature_receipts_no_delete
BEFORE DELETE ON certificates.environmental_proof_signature_receipt_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_signature_receipts_audit
  ON certificates.environmental_proof_signature_receipt_facts;
CREATE TRIGGER environmental_proof_signature_receipts_audit
AFTER INSERT OR UPDATE OR DELETE ON certificates.environmental_proof_signature_receipt_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS environmental_proof_lifecycle_controls_no_update
  ON governance.environmental_proof_lifecycle_control_facts;
CREATE TRIGGER environmental_proof_lifecycle_controls_no_update
BEFORE UPDATE ON governance.environmental_proof_lifecycle_control_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_lifecycle_controls_no_delete
  ON governance.environmental_proof_lifecycle_control_facts;
CREATE TRIGGER environmental_proof_lifecycle_controls_no_delete
BEFORE DELETE ON governance.environmental_proof_lifecycle_control_facts
FOR EACH ROW EXECUTE FUNCTION certificates.environmental_proof_lifecycle_reject_mutation();
DROP TRIGGER IF EXISTS environmental_proof_lifecycle_controls_audit
  ON governance.environmental_proof_lifecycle_control_facts;
CREATE TRIGGER environmental_proof_lifecycle_controls_audit
AFTER INSERT OR UPDATE OR DELETE ON governance.environmental_proof_lifecycle_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE governance.environmental_proof_signing_key_attestation_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.environmental_proof_signing_key_attestation_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS environmental_proof_signing_keys_tenant
  ON governance.environmental_proof_signing_key_attestation_facts;
CREATE POLICY environmental_proof_signing_keys_tenant
  ON governance.environmental_proof_signing_key_attestation_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE governance.environmental_proof_signing_key_revocation_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.environmental_proof_signing_key_revocation_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS environmental_proof_signing_key_revocations_tenant
  ON governance.environmental_proof_signing_key_revocation_facts;
CREATE POLICY environmental_proof_signing_key_revocations_tenant
  ON governance.environmental_proof_signing_key_revocation_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE certificates.environmental_proof_lifecycle_binding_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates.environmental_proof_lifecycle_binding_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS environmental_proof_lifecycle_bindings_tenant
  ON certificates.environmental_proof_lifecycle_binding_facts;
CREATE POLICY environmental_proof_lifecycle_bindings_tenant
  ON certificates.environmental_proof_lifecycle_binding_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE certificates.environmental_proof_signature_receipt_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates.environmental_proof_signature_receipt_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS environmental_proof_signature_receipts_tenant
  ON certificates.environmental_proof_signature_receipt_facts;
CREATE POLICY environmental_proof_signature_receipts_tenant
  ON certificates.environmental_proof_signature_receipt_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE governance.environmental_proof_lifecycle_control_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.environmental_proof_lifecycle_control_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS environmental_proof_lifecycle_controls_tenant
  ON governance.environmental_proof_lifecycle_control_facts;
CREATE POLICY environmental_proof_lifecycle_controls_tenant
  ON governance.environmental_proof_lifecycle_control_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));
