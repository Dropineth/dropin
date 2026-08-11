-- Route-closed root-governance bootstrap authority.
-- Depends on canopyproof-os.sql. This migration does not mount a route,
-- provision an identity, trust compatibility accreditation, handle private
-- keys, authorize production, move funds, distribute tokens, or issue claims.

BEGIN;

CREATE OR REPLACE FUNCTION governance.root_governance_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'routeMounted', false,
    'schedulerMounted', false,
    'productionActivationEnabled', false,
    'publicBootstrapEndpoint', false,
    'privateKeyHandling', false,
    'compatibilityAuthorityFallback', false,
    'appendOnly', true,
    'exactRetryRequired', true,
    'explicitAsOfRequired', true,
    'multiOrganizationQuorumRequired', true,
    'ed25519VerificationRequired', true,
    'aiIsNeverFinalAuthority', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true
  );
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_document_is_minimized(document jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT document::text !~* '"(accessToken|address|coordinates|email|geometry|latitude|longitude|password|phone|privateKey|private_key|rawDocument|rawEvidence|refreshToken|secret|seedPhrase|token|mnemonic|d)"[[:space:]]*:'
    AND document::text !~* '(certified[[:space:]]+carbon[[:space:]]+credit|carbon[-[:space:]]*tax[[:space:]]+offset|guaranteed[[:space:]]+(rwa[[:space:]]+)?yield|automatic[[:space:]]+canopy[[:space:]]+distribution|mainnet[[:space:]]+fund|private[[:space:]]+key)';
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_roots_are_sorted_unique(roots jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE values_array text[];
BEGIN
  IF jsonb_typeof(roots) <> 'array' THEN RETURN false; END IF;
  SELECT ARRAY(SELECT value FROM jsonb_array_elements_text(roots) value) INTO values_array;
  RETURN cardinality(values_array) BETWEEN 1 AND 128
    AND audit.is_sorted_unique_text_array(values_array)
    AND NOT EXISTS (SELECT 1 FROM unnest(values_array) value WHERE value !~ '^[0-9a-f]{64}$');
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_text_array_is_sorted_unique(values_json jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE values_array text[];
BEGIN
  IF jsonb_typeof(values_json) <> 'array' THEN RETURN false; END IF;
  SELECT ARRAY(SELECT value FROM jsonb_array_elements_text(values_json) value) INTO values_array;
  RETURN cardinality(values_array) BETWEEN 1 AND 18
    AND audit.is_sorted_unique_text_array(values_array)
    AND NOT EXISTS (
      SELECT 1 FROM unnest(values_array) value WHERE length(btrim(value)) NOT BETWEEN 1 AND 240
    );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_semver_is_greater(
  candidate text,
  predecessor text
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE candidate_parts text[];
DECLARE predecessor_parts text[];
BEGIN
  candidate_parts := regexp_match(candidate, '^v([1-9][0-9]*)\.([0-9]+)\.([0-9]+)$');
  predecessor_parts := regexp_match(predecessor, '^v([1-9][0-9]*)\.([0-9]+)\.([0-9]+)$');
  IF candidate_parts IS NULL OR predecessor_parts IS NULL THEN RETURN false; END IF;
  RETURN ROW(
    candidate_parts[1]::numeric,
    candidate_parts[2]::numeric,
    candidate_parts[3]::numeric
  ) > ROW(
    predecessor_parts[1]::numeric,
    predecessor_parts[2]::numeric,
    predecessor_parts[3]::numeric
  );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_public_key_fingerprint(member jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-root-governance-public-key-v1',
    'publicKeyJwk', member->'publicKeyJwk'
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_member_root(member jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-root-governance-member-v1') ||
    (member - 'memberRoot')
  );
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_member_is_valid(member jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE jwk jsonb := member->'publicKeyJwk';
BEGIN
  RETURN jsonb_typeof(member) = 'object'
    AND member ?& ARRAY[
      'participantId','participantRoot','role','verificationStatus','organizationId',
      'organizationRoot','organizationVerificationStatus','membershipId','membershipRoot',
      'membershipStatus','keyId','publicKeyJwk','publicKeyFingerprint','memberRoot'
    ]
    AND (SELECT count(*) FROM jsonb_object_keys(member)) = 14
    AND length(btrim(member->>'participantId')) BETWEEN 1 AND 240
    AND member->>'participantRoot' ~ '^[0-9a-f]{64}$'
    AND member->>'role' IN ('owner','admin','verifier','researcher')
    AND member->>'verificationStatus' = 'verified'
    AND length(btrim(member->>'organizationId')) BETWEEN 1 AND 240
    AND member->>'organizationRoot' ~ '^[0-9a-f]{64}$'
    AND member->>'organizationVerificationStatus' = 'verified'
    AND length(btrim(member->>'membershipId')) BETWEEN 1 AND 240
    AND member->>'membershipRoot' ~ '^[0-9a-f]{64}$'
    AND member->>'membershipStatus' = 'active'
    AND length(btrim(member->>'keyId')) BETWEEN 1 AND 240
    AND jsonb_typeof(jwk) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(jwk)) = 5
    AND jwk->>'kty' = 'OKP'
    AND jwk->>'crv' = 'Ed25519'
    AND jwk->>'x' ~ '^[A-Za-z0-9_-]{43}$'
    AND jwk->'key_ops' = '["verify"]'::jsonb
    AND jwk->'ext' = 'true'::jsonb
    AND member->>'publicKeyFingerprint' = governance.root_governance_public_key_fingerprint(member)
    AND member->>'memberRoot' = governance.root_governance_member_root(member)
    AND governance.root_governance_document_is_minimized(member) IS TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_council_is_valid(
  council jsonb,
  required_approvals_value integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE member_count integer;
DECLARE participant_ids text[];
DECLARE organization_ids text[];
DECLARE membership_ids text[];
DECLARE key_ids text[];
DECLARE key_fingerprints text[];
BEGIN
  IF jsonb_typeof(council) <> 'array' THEN RETURN false; END IF;
  member_count := jsonb_array_length(council);
  IF member_count NOT BETWEEN 3 AND 9 OR required_approvals_value NOT BETWEEN 3 AND member_count THEN
    RETURN false;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(council) member
    WHERE governance.root_governance_member_is_valid(member) IS NOT TRUE
  ) THEN RETURN false; END IF;
  SELECT ARRAY(SELECT member->>'participantId' FROM jsonb_array_elements(council) member)
    INTO participant_ids;
  SELECT ARRAY(SELECT member->>'organizationId' FROM jsonb_array_elements(council) member)
    INTO organization_ids;
  SELECT ARRAY(SELECT member->>'membershipId' FROM jsonb_array_elements(council) member)
    INTO membership_ids;
  SELECT ARRAY(SELECT member->>'keyId' FROM jsonb_array_elements(council) member)
    INTO key_ids;
  SELECT ARRAY(SELECT member->>'publicKeyFingerprint' FROM jsonb_array_elements(council) member)
    INTO key_fingerprints;
  RETURN audit.is_sorted_unique_text_array(participant_ids)
    AND cardinality(organization_ids) = (SELECT count(DISTINCT value) FROM unnest(organization_ids) value)
    AND cardinality(membership_ids) = (SELECT count(DISTINCT value) FROM unnest(membership_ids) value)
    AND cardinality(key_ids) = (SELECT count(DISTINCT value) FROM unnest(key_ids) value)
    AND cardinality(key_fingerprints) = (SELECT count(DISTINCT value) FROM unnest(key_fingerprints) value);
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_member_is_current(member jsonb)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE participant identity.participants%ROWTYPE;
DECLARE organization organizations.organizations%ROWTYPE;
DECLARE membership organizations.memberships%ROWTYPE;
BEGIN
  IF governance.root_governance_member_is_valid(member) IS NOT TRUE THEN RETURN false; END IF;
  SELECT * INTO participant FROM identity.participants WHERE id = member->>'participantId';
  SELECT * INTO organization FROM organizations.organizations WHERE id = member->>'organizationId';
  SELECT * INTO membership FROM organizations.memberships WHERE id = member->>'membershipId';
  RETURN participant.id IS NOT NULL
    AND participant.participant_type = 'human'
    AND participant.verification_status = 'verified'
    AND participant.subject_hash = member->>'participantRoot'
    AND member->>'role' = ANY(participant.roles)
    AND organization.id IS NOT NULL
    AND organization.verification_status = 'verified'
    AND organization.profile_hash = member->>'organizationRoot'
    AND membership.id IS NOT NULL
    AND membership.organization_id = organization.id
    AND membership.actor_id = participant.id
    AND membership.role = member->>'role'
    AND membership.status = 'active'
    AND membership.audit_event_root = member->>'membershipRoot';
END;
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_council_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT member->>'memberRoot' FROM jsonb_array_elements(document->'councilMembers') member
    ORDER BY member->>'memberRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_proposal_evidence_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT value FROM jsonb_array_elements_text(document->'evidenceEventRoots') value
      UNION ALL SELECT document->>'charterDocumentRoot'
      UNION ALL SELECT document->>'policyRoot'
      UNION ALL SELECT document->>'councilRoot'
      UNION ALL SELECT document->>'predecessorDecisionRoot' WHERE document->'predecessorDecisionRoot' <> 'null'::jsonb
      UNION ALL SELECT document->>'targetDecisionRoot' WHERE document->'targetDecisionRoot' <> 'null'::jsonb
    ) members ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_proposal_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-root-governance-proposal-command-v1') ||
    (document - ARRAY[
      'factType','id','authorityDomain','globalSequence','previousEventRoot','commandHash',
      'safety','proposalHash','proposalRoot','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_proposal_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-root-governance-proposal-fact-v1',
    'id', document->'id',
    'globalSequence', document->'globalSequence',
    'previousEventRoot', document->'previousEventRoot',
    'commandHash', document->'commandHash'
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_proposal_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT document->>'proposalHash' value
      UNION ALL SELECT document->>'commandHash'
      UNION ALL SELECT document->>'evidenceRoot'
      UNION ALL SELECT document->'proposer'->>'memberRoot'
      UNION ALL SELECT document->>'predecessorDecisionRoot' WHERE document->'predecessorDecisionRoot' <> 'null'::jsonb
      UNION ALL SELECT document->>'targetDecisionRoot' WHERE document->'targetDecisionRoot' <> 'null'::jsonb
    ) members ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_signed_payload_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-root-governance-attestation-signed-payload-v1',
    'proposalRoot', document->'proposalRoot',
    'decision', document->'decision',
    'signerMemberRoot', document->'signer'->'memberRoot',
    'attestedAt', document->'attestedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_signature_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-root-governance-ed25519-signature-v1',
    'signatureBase64Url', document->'signatureBase64Url'
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_verification_receipt_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-root-governance-signature-verification-receipt-v1',
    'signedPayloadRoot', document->'signedPayloadRoot',
    'signatureHash', document->'signatureHash',
    'publicKeyFingerprint', document->'signer'->'publicKeyFingerprint',
    'keyId', document->'signer'->'keyId',
    'verifiedAt', document->'verifiedAt',
    'verifierVersion', document->'verifierVersion'
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_attestation_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-root-governance-attestation-command-v1') ||
    (document - ARRAY[
      'factType','id','authorityDomain','globalSequence','previousEventRoot','commandHash',
      'safety','attestationHash','attestationRoot','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_attestation_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-root-governance-attestation-fact-v1',
    'id', document->'id',
    'globalSequence', document->'globalSequence',
    'previousEventRoot', document->'previousEventRoot',
    'commandHash', document->'commandHash'
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_attestation_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM unnest(ARRAY[
      document->>'attestationHash', document->>'commandHash', document->>'proposalRoot',
      document->'signer'->>'memberRoot', document->>'signedPayloadRoot',
      document->>'verificationReceiptRoot'
    ]) value ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_decision_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-root-governance-decision-command-v1') ||
    (document - ARRAY[
      'factType','id','authorityDomain','globalSequence','previousEventRoot','commandHash',
      'safety','decisionHash','decisionRoot','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_decision_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-root-governance-decision-fact-v1',
    'id', document->'id',
    'globalSequence', document->'globalSequence',
    'previousEventRoot', document->'previousEventRoot',
    'commandHash', document->'commandHash'
  ));
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_decision_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT document->>'decisionHash' value
      UNION ALL SELECT document->>'commandHash'
      UNION ALL SELECT document->>'proposalRoot'
      UNION ALL SELECT document->>'approvalQuorumRoot'
      UNION ALL SELECT document->>'predecessorDecisionRoot' WHERE document->'predecessorDecisionRoot' <> 'null'::jsonb
      UNION ALL SELECT document->>'charterDecisionRoot' WHERE document->'charterDecisionRoot' <> 'null'::jsonb
    ) members ORDER BY value
  ));
$$;

CREATE TABLE IF NOT EXISTS governance.root_governance_proposal_facts (
  id text PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('activate_initial','supersede','suspend','revoke')),
  charter_version text NOT NULL CHECK (charter_version ~ '^v[1-9][0-9]*\.[0-9]+\.[0-9]+$'),
  charter_document_root text NOT NULL CHECK (charter_document_root ~ '^[0-9a-f]{64}$'),
  policy_root text NOT NULL CHECK (policy_root ~ '^[0-9a-f]{64}$'),
  delegated_scopes text[] NOT NULL CHECK (cardinality(delegated_scopes) = 3),
  council_members jsonb NOT NULL CHECK (jsonb_typeof(council_members) = 'array'),
  council_root text NOT NULL CHECK (council_root ~ '^[0-9a-f]{64}$'),
  required_approvals integer NOT NULL CHECK (required_approvals BETWEEN 3 AND 9),
  requested_valid_until timestamptz NOT NULL,
  predecessor_decision_id text,
  predecessor_decision_root text CHECK (predecessor_decision_root ~ '^[0-9a-f]{64}$'),
  target_decision_id text,
  target_decision_root text CHECK (target_decision_root ~ '^[0-9a-f]{64}$'),
  reason_code text NOT NULL CHECK (reason_code IN (
    'initial_constitution','scheduled_succession','authority_compromise',
    'governance_failure','legal_restriction','policy_transition'
  )),
  proposer_id text NOT NULL REFERENCES identity.participants(id),
  proposer_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  proposer_member_root text NOT NULL CHECK (proposer_member_root ~ '^[0-9a-f]{64}$'),
  proposed_at timestamptz NOT NULL,
  global_sequence bigint NOT NULL UNIQUE CHECK (global_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  proposal_hash text NOT NULL UNIQUE CHECK (proposal_hash ~ '^[0-9a-f]{64}$'),
  proposal_root text NOT NULL UNIQUE CHECK (proposal_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  CHECK ((predecessor_decision_id IS NULL) = (predecessor_decision_root IS NULL)),
  CHECK ((target_decision_id IS NULL) = (target_decision_root IS NULL)),
  CHECK (proposed_at < requested_valid_until)
);

CREATE TABLE IF NOT EXISTS governance.root_governance_attestation_facts (
  id text PRIMARY KEY,
  proposal_id text NOT NULL REFERENCES governance.root_governance_proposal_facts(id),
  proposal_root text NOT NULL CHECK (proposal_root ~ '^[0-9a-f]{64}$'),
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  signer_id text NOT NULL REFERENCES identity.participants(id),
  signer_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  signer_member_root text NOT NULL CHECK (signer_member_root ~ '^[0-9a-f]{64}$'),
  signed_payload_root text NOT NULL UNIQUE CHECK (signed_payload_root ~ '^[0-9a-f]{64}$'),
  signature_hash text NOT NULL UNIQUE CHECK (signature_hash ~ '^[0-9a-f]{64}$'),
  verification_receipt_root text NOT NULL UNIQUE CHECK (verification_receipt_root ~ '^[0-9a-f]{64}$'),
  attested_at timestamptz NOT NULL,
  global_sequence bigint NOT NULL UNIQUE CHECK (global_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  attestation_hash text NOT NULL UNIQUE CHECK (attestation_hash ~ '^[0-9a-f]{64}$'),
  attestation_root text NOT NULL UNIQUE CHECK (attestation_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (proposal_id, signer_id)
);

CREATE TABLE IF NOT EXISTS governance.root_governance_decision_facts (
  id text PRIMARY KEY,
  proposal_id text NOT NULL UNIQUE REFERENCES governance.root_governance_proposal_facts(id),
  proposal_root text NOT NULL CHECK (proposal_root ~ '^[0-9a-f]{64}$'),
  action text NOT NULL CHECK (action IN ('activate_initial','supersede','suspend','revoke')),
  approval_attestation_ids text[] NOT NULL CHECK (cardinality(approval_attestation_ids) BETWEEN 3 AND 18),
  approval_attestation_roots text[] NOT NULL CHECK (cardinality(approval_attestation_roots) BETWEEN 3 AND 18),
  approval_quorum_root text NOT NULL UNIQUE CHECK (approval_quorum_root ~ '^[0-9a-f]{64}$'),
  predecessor_decision_id text REFERENCES governance.root_governance_decision_facts(id),
  predecessor_decision_root text CHECK (predecessor_decision_root ~ '^[0-9a-f]{64}$'),
  charter_decision_id text REFERENCES governance.root_governance_decision_facts(id),
  charter_decision_root text CHECK (charter_decision_root ~ '^[0-9a-f]{64}$'),
  effective_from timestamptz NOT NULL,
  effective_until timestamptz NOT NULL,
  decided_at timestamptz NOT NULL,
  global_sequence bigint NOT NULL UNIQUE CHECK (global_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  decision_hash text NOT NULL UNIQUE CHECK (decision_hash ~ '^[0-9a-f]{64}$'),
  decision_root text NOT NULL UNIQUE CHECK (decision_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  CHECK ((predecessor_decision_id IS NULL) = (predecessor_decision_root IS NULL)),
  CHECK ((charter_decision_id IS NULL) = (charter_decision_root IS NULL)),
  CHECK (effective_from = decided_at AND effective_from < effective_until),
  CHECK (cardinality(approval_attestation_ids) = cardinality(approval_attestation_roots))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'root_governance_proposal_predecessor_fk'
      AND conrelid = 'governance.root_governance_proposal_facts'::regclass
  ) THEN
    ALTER TABLE governance.root_governance_proposal_facts
      ADD CONSTRAINT root_governance_proposal_predecessor_fk
      FOREIGN KEY (predecessor_decision_id) REFERENCES governance.root_governance_decision_facts(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'root_governance_proposal_target_fk'
      AND conrelid = 'governance.root_governance_proposal_facts'::regclass
  ) THEN
    ALTER TABLE governance.root_governance_proposal_facts
      ADD CONSTRAINT root_governance_proposal_target_fk
      FOREIGN KEY (target_decision_id) REFERENCES governance.root_governance_decision_facts(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS root_governance_proposal_predecessor_no_fork
  ON governance.root_governance_proposal_facts (predecessor_decision_id)
  WHERE predecessor_decision_id IS NOT NULL;

CREATE OR REPLACE FUNCTION governance.root_governance_event_is_valid(
  document jsonb,
  audit_event_root_value text,
  expected_action text,
  expected_entity_type text,
  expected_actor_id text,
  expected_timestamp timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
AS $$
  SELECT EXISTS (
    SELECT 1 FROM audit.domain_events semantic_event
    WHERE semantic_event.event_root = audit_event_root_value
      AND semantic_event.stream_id = 'root-governance:organization-accreditation'
      AND semantic_event.sequence_no = (document->>'globalSequence')::bigint
      AND semantic_event.action = expected_action
      AND semantic_event.actor_id = expected_actor_id
      AND semantic_event.entity_type = expected_entity_type
      AND semantic_event.entity_id = document->>'id'
      AND semantic_event.previous_root = document->>'previousEventRoot'
      AND semantic_event.payload_hash = audit.sha256_stable_json(document - 'auditEvent')
      AND semantic_event.created_at = expected_timestamp
      AND document->'auditEvent'->>'id' = semantic_event.id
      AND document->'auditEvent'->>'action' = expected_action
      AND document->'auditEvent'->>'actor' = expected_actor_id
      AND document->'auditEvent'->>'entityType' = expected_entity_type
      AND document->'auditEvent'->>'entityId' = document->>'id'
      AND document->'auditEvent'->>'previousRoot' = document->>'previousEventRoot'
      AND document->'auditEvent'->>'payloadHash' = semantic_event.payload_hash
      AND document->'auditEvent'->>'eventRoot' = semantic_event.event_root
      AND document->'auditEvent'->>'createdAt' = audit.iso8601_millis(expected_timestamp)
      AND document->'auditEvent'->>'rationale' = semantic_event.rationale
  );
$$;

CREATE OR REPLACE FUNCTION governance.root_governance_member_in_council(member jsonb, council jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements(council) candidate
    WHERE candidate->>'participantId' = member->>'participantId'
      AND candidate->>'memberRoot' = member->>'memberRoot'
  );
$$;

CREATE OR REPLACE FUNCTION governance.validate_root_governance_fact_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  row_document jsonb := to_jsonb(NEW);
  fact_kind text;
  fact_type text;
  expected_action text;
  expected_actor_id text;
  effective_at timestamptz;
  expected_sequence bigint;
  expected_previous_root text;
  latest_fact_time timestamptz;
  latest_proposal governance.root_governance_proposal_facts%ROWTYPE;
  latest_decision governance.root_governance_decision_facts%ROWTYPE;
  latest_charter_decision governance.root_governance_decision_facts%ROWTYPE;
  proposal governance.root_governance_proposal_facts%ROWTYPE;
  target_decision governance.root_governance_decision_facts%ROWTYPE;
  target_proposal governance.root_governance_proposal_facts%ROWTYPE;
  selected_count integer;
  selected_org_count integer;
  new_council_count integer;
  old_council_count integer;
  current_status text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('root-governance:organization-accreditation', 0));
  IF current_setting('app.root_governance_access', true) <> 'authorized' THEN
    RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_ACCESS_REQUIRED' USING ERRCODE = 'insufficient_privilege';
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'root_governance_proposal_facts' THEN
      fact_kind := 'proposal'; fact_type := 'root_governance_proposal';
      expected_action := CASE WHEN NEW.action = 'revoke' THEN 'CHALLENGE' ELSE 'ASSERT' END;
      expected_actor_id := NEW.proposer_id; effective_at := NEW.proposed_at;
    WHEN 'root_governance_attestation_facts' THEN
      fact_kind := 'attestation'; fact_type := 'root_governance_attestation';
      expected_action := CASE WHEN NEW.decision = 'approve' THEN 'ASSERT' ELSE 'CHALLENGE' END;
      expected_actor_id := NEW.signer_id; effective_at := NEW.attested_at;
    WHEN 'root_governance_decision_facts' THEN
      fact_kind := 'decision'; fact_type := 'root_governance_decision';
      SELECT * INTO proposal FROM governance.root_governance_proposal_facts WHERE id = NEW.proposal_id;
      expected_action := CASE WHEN NEW.action = 'revoke' THEN 'CHALLENGE' ELSE 'FULFILL' END;
      expected_actor_id := proposal.proposer_id; effective_at := NEW.decided_at;
    ELSE
      RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_TABLE_INVALID' USING ERRCODE = 'check_violation';
  END CASE;

  SELECT COALESCE(max(global_sequence), 0) + 1 INTO expected_sequence FROM (
    SELECT global_sequence FROM governance.root_governance_proposal_facts
    UNION ALL SELECT global_sequence FROM governance.root_governance_attestation_facts
    UNION ALL SELECT global_sequence FROM governance.root_governance_decision_facts
  ) facts;
  SELECT event_root, created_at INTO expected_previous_root, latest_fact_time
  FROM audit.domain_events
  WHERE stream_id = 'root-governance:organization-accreditation'
    AND sequence_no < NEW.global_sequence
  ORDER BY sequence_no DESC LIMIT 1;
  expected_previous_root := COALESCE(expected_previous_root, audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-audit-genesis-v1')
  ));

  IF document->>'factType' <> fact_type
    OR document->>'id' <> NEW.id
    OR document->>'authorityDomain' <> 'organization_accreditation'
    OR (document->>'globalSequence')::bigint <> NEW.global_sequence
    OR NEW.global_sequence <> expected_sequence
    OR document->>'previousEventRoot' <> NEW.previous_event_root
    OR NEW.previous_event_root <> expected_previous_root
    OR document->>'commandHash' <> NEW.command_hash
    OR document->'safety' <> governance.root_governance_safety_canonical()
    OR governance.root_governance_document_is_minimized(document) IS NOT TRUE
    OR effective_at <> date_trunc('milliseconds', effective_at)
    OR (latest_fact_time IS NOT NULL AND effective_at <= latest_fact_time)
    OR current_setting('app.actor_id', true) <> expected_actor_id
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_COMMON_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO latest_proposal FROM governance.root_governance_proposal_facts
    ORDER BY global_sequence DESC LIMIT 1;
  SELECT * INTO latest_decision FROM governance.root_governance_decision_facts
    ORDER BY global_sequence DESC LIMIT 1;
  SELECT * INTO latest_charter_decision FROM governance.root_governance_decision_facts
    WHERE action IN ('activate_initial','supersede')
    ORDER BY global_sequence DESC LIMIT 1;

  IF latest_charter_decision.id IS NULL THEN
    current_status := 'uninitialized';
  ELSIF latest_decision.action = 'revoke'
    AND latest_decision.global_sequence > latest_charter_decision.global_sequence
  THEN
    current_status := 'revoked';
  ELSIF latest_decision.action = 'suspend'
    AND latest_decision.global_sequence > latest_charter_decision.global_sequence
  THEN
    current_status := 'suspended';
  ELSIF effective_at < latest_charter_decision.effective_from THEN
    current_status := 'pending';
  ELSIF effective_at >= latest_charter_decision.effective_until THEN
    current_status := 'expired';
  ELSE
    current_status := 'active';
  END IF;

  IF fact_kind = 'proposal' THEN
    IF latest_proposal.id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM governance.root_governance_decision_facts d WHERE d.proposal_id = latest_proposal.id
      )
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_PROPOSAL_PENDING' USING ERRCODE = 'check_violation';
    END IF;
    IF document->>'action' <> NEW.action
      OR document->>'charterVersion' <> NEW.charter_version
      OR document->>'charterDocumentRoot' <> NEW.charter_document_root
      OR document->>'policyRoot' <> NEW.policy_root
      OR document->'delegatedScopes' <> to_jsonb(NEW.delegated_scopes)
      OR document->'delegatedScopes' <> '["organization:accreditation:decide","organization:accreditation:govern","organization:accreditation:review"]'::jsonb
      OR document->'councilMembers' <> NEW.council_members
      OR governance.root_governance_council_is_valid(NEW.council_members, NEW.required_approvals) IS NOT TRUE
      OR document->>'councilRoot' <> NEW.council_root
      OR NEW.council_root <> governance.root_governance_council_root(document)
      OR (document->>'requiredApprovals')::integer <> NEW.required_approvals
      OR document->>'requestedValidUntil' <> audit.iso8601_millis(NEW.requested_valid_until)
      OR document->>'reasonCode' <> NEW.reason_code
      OR document->'proposer'->>'participantId' <> NEW.proposer_id
      OR document->'proposer'->>'organizationId' <> NEW.proposer_organization_id
      OR document->'proposer'->>'memberRoot' <> NEW.proposer_member_root
      OR governance.root_governance_member_is_current(document->'proposer') IS NOT TRUE
      OR document->>'proposedAt' <> audit.iso8601_millis(NEW.proposed_at)
      OR governance.root_governance_roots_are_sorted_unique(document->'evidenceEventRoots') IS NOT TRUE
      OR document->>'evidenceRoot' <> governance.root_governance_proposal_evidence_root(document)
      OR NEW.command_hash <> governance.root_governance_proposal_command_hash(document)
      OR NEW.id <> 'cp_root_governance_proposal_' || left(NEW.command_hash, 24)
      OR document->>'proposalHash' <> NEW.proposal_hash
      OR NEW.proposal_hash <> governance.root_governance_proposal_hash(document)
      OR document->>'proposalRoot' <> NEW.proposal_root
      OR NEW.proposal_root <> governance.root_governance_proposal_root(document)
      OR length(btrim(document->>'rationale')) NOT BETWEEN 32 AND 4000
      OR NEW.requested_valid_until <= NEW.proposed_at
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_PROPOSAL_FACT_INVALID' USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.action = 'activate_initial' THEN
      IF latest_proposal.id IS NOT NULL OR latest_decision.id IS NOT NULL
        OR NEW.predecessor_decision_id IS NOT NULL OR NEW.target_decision_id IS NOT NULL
        OR governance.root_governance_member_in_council(document->'proposer', NEW.council_members) IS NOT TRUE
        OR NEW.requested_valid_until - NEW.proposed_at > interval '366 days'
      THEN RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_INITIAL_FACT_INVALID' USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      SELECT * INTO target_decision FROM governance.root_governance_decision_facts
        WHERE id = NEW.target_decision_id;
      SELECT * INTO target_proposal FROM governance.root_governance_proposal_facts
        WHERE id = target_decision.proposal_id;
      IF latest_decision.action = 'revoke'
        OR target_decision.id IS NULL
        OR target_decision.action NOT IN ('activate_initial','supersede')
        OR target_decision.id IS DISTINCT FROM latest_charter_decision.id
        OR NEW.predecessor_decision_id <> latest_decision.id
        OR NEW.predecessor_decision_root <> latest_decision.decision_root
        OR NEW.target_decision_root <> target_decision.decision_root
        OR governance.root_governance_member_in_council(document->'proposer', target_proposal.council_members) IS NOT TRUE
      THEN RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_PREDECESSOR_FACT_INVALID' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.action = 'supersede' THEN
        IF current_status NOT IN ('active','suspended')
          OR NEW.requested_valid_until - NEW.proposed_at > interval '366 days'
          OR governance.root_governance_semver_is_greater(
            NEW.charter_version, target_proposal.charter_version
          ) IS NOT TRUE
        THEN RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_SUCCESSOR_FACT_INVALID' USING ERRCODE = 'check_violation';
        END IF;
      ELSE
        IF NEW.charter_version <> target_proposal.charter_version
          OR NEW.charter_document_root <> target_proposal.charter_document_root
          OR NEW.policy_root <> target_proposal.policy_root
          OR NEW.delegated_scopes <> target_proposal.delegated_scopes
          OR NEW.council_members <> target_proposal.council_members
          OR NEW.council_root <> target_proposal.council_root
          OR NEW.required_approvals <> target_proposal.required_approvals
          OR NEW.requested_valid_until <> target_decision.effective_until
          OR (NEW.action = 'suspend' AND current_status <> 'active')
          OR (NEW.action = 'revoke' AND current_status NOT IN ('active','suspended'))
        THEN RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_CONTROL_FACT_INVALID' USING ERRCODE = 'check_violation';
        END IF;
      END IF;
    END IF;

  ELSIF fact_kind = 'attestation' THEN
    SELECT * INTO proposal FROM governance.root_governance_proposal_facts WHERE id = NEW.proposal_id;
    SELECT * INTO target_decision FROM governance.root_governance_decision_facts WHERE id = proposal.target_decision_id;
    SELECT * INTO target_proposal FROM governance.root_governance_proposal_facts WHERE id = target_decision.proposal_id;
    IF proposal.id IS NULL OR latest_proposal.id <> proposal.id
      OR EXISTS (SELECT 1 FROM governance.root_governance_decision_facts d WHERE d.proposal_id = proposal.id)
      OR document->>'proposalId' <> NEW.proposal_id
      OR document->>'proposalRoot' <> NEW.proposal_root OR NEW.proposal_root <> proposal.proposal_root
      OR document->>'decision' <> NEW.decision
      OR document->'signer'->>'participantId' <> NEW.signer_id
      OR document->'signer'->>'organizationId' <> NEW.signer_organization_id
      OR document->'signer'->>'memberRoot' <> NEW.signer_member_root
      OR governance.root_governance_member_is_current(document->'signer') IS NOT TRUE
      OR NOT (
        governance.root_governance_member_in_council(document->'signer', proposal.council_members)
        OR (proposal.action <> 'activate_initial' AND governance.root_governance_member_in_council(
          document->'signer', target_proposal.council_members
        ))
      )
      OR document->>'signedPayloadRoot' <> NEW.signed_payload_root
      OR NEW.signed_payload_root <> governance.root_governance_signed_payload_root(document)
      OR document->>'signatureAlgorithm' <> 'ed25519'
      OR document->>'signatureBase64Url' !~ '^[A-Za-z0-9_-]{85}[AQgw]$'
      OR document->>'signatureHash' <> NEW.signature_hash
      OR NEW.signature_hash <> governance.root_governance_signature_hash(document)
      OR document->>'verifiedAt' <> document->>'attestedAt'
      OR document->>'verifierVersion' <> 'webcrypto-ed25519-v1'
      OR document->>'verificationReceiptRoot' <> NEW.verification_receipt_root
      OR NEW.verification_receipt_root <> governance.root_governance_verification_receipt_root(document)
      OR document->>'attestedAt' <> audit.iso8601_millis(NEW.attested_at)
      OR NEW.attested_at < proposal.proposed_at
      OR NEW.command_hash <> governance.root_governance_attestation_command_hash(document)
      OR NEW.id <> 'cp_root_governance_attestation_' || left(NEW.command_hash, 24)
      OR document->>'attestationHash' <> NEW.attestation_hash
      OR NEW.attestation_hash <> governance.root_governance_attestation_hash(document)
      OR document->>'attestationRoot' <> NEW.attestation_root
      OR NEW.attestation_root <> governance.root_governance_attestation_root(document)
      OR length(btrim(document->>'rationale')) NOT BETWEEN 32 AND 4000
      OR length(btrim(document->>'conflictDisclosure')) NOT BETWEEN 32 AND 2000
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_ATTESTATION_FACT_INVALID' USING ERRCODE = 'check_violation';
    END IF;

  ELSE
    IF proposal.id IS NULL OR latest_proposal.id <> proposal.id
      OR EXISTS (SELECT 1 FROM governance.root_governance_decision_facts d WHERE d.proposal_id = proposal.id)
      OR document->>'proposalId' <> NEW.proposal_id
      OR document->>'proposalRoot' <> NEW.proposal_root OR NEW.proposal_root <> proposal.proposal_root
      OR document->>'action' <> NEW.action OR NEW.action <> proposal.action
      OR document->'approvalAttestationIds' <> to_jsonb(NEW.approval_attestation_ids)
      OR document->'approvalAttestationRoots' <> to_jsonb(NEW.approval_attestation_roots)
      OR governance.root_governance_text_array_is_sorted_unique(document->'approvalAttestationIds') IS NOT TRUE
      OR governance.root_governance_roots_are_sorted_unique(document->'approvalAttestationRoots') IS NOT TRUE
      OR document->>'approvalQuorumRoot' <> NEW.approval_quorum_root
      OR NEW.approval_quorum_root <> audit.merkle_root(NEW.approval_attestation_roots)
      OR NEW.predecessor_decision_id IS DISTINCT FROM latest_decision.id
      OR NEW.predecessor_decision_root IS DISTINCT FROM latest_decision.decision_root
      OR document->>'predecessorDecisionId' IS DISTINCT FROM NEW.predecessor_decision_id
      OR document->>'predecessorDecisionRoot' IS DISTINCT FROM NEW.predecessor_decision_root
      OR document->>'effectiveFrom' <> audit.iso8601_millis(NEW.effective_from)
      OR document->>'effectiveUntil' <> audit.iso8601_millis(NEW.effective_until)
      OR document->>'decidedAt' <> audit.iso8601_millis(NEW.decided_at)
      OR NEW.effective_from <> NEW.decided_at
      OR NEW.effective_until <> proposal.requested_valid_until
      OR NEW.command_hash <> governance.root_governance_decision_command_hash(document)
      OR NEW.id <> 'cp_root_governance_decision_' || left(NEW.command_hash, 24)
      OR document->>'decisionHash' <> NEW.decision_hash
      OR NEW.decision_hash <> governance.root_governance_decision_hash(document)
      OR document->>'decisionRoot' <> NEW.decision_root
      OR NEW.decision_root <> governance.root_governance_decision_root(document)
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_DECISION_FACT_INVALID' USING ERRCODE = 'check_violation';
    END IF;

    SELECT count(*), count(DISTINCT a.signer_organization_id)
      INTO selected_count, selected_org_count
    FROM governance.root_governance_attestation_facts a
    WHERE a.id = ANY(NEW.approval_attestation_ids)
      AND a.proposal_id = NEW.proposal_id
      AND a.decision = 'approve'
      AND a.attested_at <= NEW.decided_at;
    IF selected_count <> cardinality(NEW.approval_attestation_ids)
      OR selected_org_count <> selected_count
      OR NEW.approval_attestation_roots <> ARRAY(
        SELECT a.attestation_root FROM governance.root_governance_attestation_facts a
        WHERE a.id = ANY(NEW.approval_attestation_ids) ORDER BY a.attestation_root
      )
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_DECISION_SELECTION_INVALID' USING ERRCODE = 'check_violation';
    END IF;

    SELECT count(*) INTO new_council_count
    FROM governance.root_governance_attestation_facts a
    WHERE a.id = ANY(NEW.approval_attestation_ids)
      AND governance.root_governance_member_in_council(a.fact_record->'signer', proposal.council_members);
    IF NEW.action = 'activate_initial' THEN
      IF latest_decision.id IS NOT NULL OR new_council_count < proposal.required_approvals
        OR NEW.charter_decision_id IS NOT NULL OR NEW.charter_decision_root IS NOT NULL
      THEN RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_INITIAL_DECISION_INVALID' USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      SELECT * INTO target_decision FROM governance.root_governance_decision_facts
        WHERE id = proposal.target_decision_id;
      SELECT * INTO target_proposal FROM governance.root_governance_proposal_facts
        WHERE id = target_decision.proposal_id;
      SELECT count(*) INTO old_council_count
      FROM governance.root_governance_attestation_facts a
      WHERE a.id = ANY(NEW.approval_attestation_ids)
        AND governance.root_governance_member_in_council(a.fact_record->'signer', target_proposal.council_members);
      IF old_council_count < target_proposal.required_approvals
        OR (NEW.action = 'supersede' AND new_council_count < proposal.required_approvals)
      THEN RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_TRANSITION_QUORUM_INVALID' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.action = 'supersede' THEN
        IF NEW.charter_decision_id IS NOT NULL OR NEW.charter_decision_root IS NOT NULL
        THEN RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_SUCCESSOR_DECISION_INVALID' USING ERRCODE = 'check_violation';
        END IF;
      ELSIF NEW.charter_decision_id <> target_decision.id OR NEW.charter_decision_root <> target_decision.decision_root THEN
        RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_CONTROL_DECISION_INVALID' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  IF governance.root_governance_event_is_valid(
    document, NEW.audit_event_root, expected_action, fact_type, expected_actor_id, effective_at
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS root_governance_proposal_validate ON governance.root_governance_proposal_facts;
CREATE TRIGGER root_governance_proposal_validate
BEFORE INSERT ON governance.root_governance_proposal_facts
FOR EACH ROW EXECUTE FUNCTION governance.validate_root_governance_fact_insert();

DROP TRIGGER IF EXISTS root_governance_attestation_validate ON governance.root_governance_attestation_facts;
CREATE TRIGGER root_governance_attestation_validate
BEFORE INSERT ON governance.root_governance_attestation_facts
FOR EACH ROW EXECUTE FUNCTION governance.validate_root_governance_fact_insert();

DROP TRIGGER IF EXISTS root_governance_decision_validate ON governance.root_governance_decision_facts;
CREATE TRIGGER root_governance_decision_validate
BEFORE INSERT ON governance.root_governance_decision_facts
FOR EACH ROW EXECUTE FUNCTION governance.validate_root_governance_fact_insert();

ALTER TABLE governance.root_governance_proposal_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.root_governance_proposal_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS root_governance_proposal_authorized ON governance.root_governance_proposal_facts;
CREATE POLICY root_governance_proposal_authorized ON governance.root_governance_proposal_facts
  USING (current_setting('app.root_governance_access', true) = 'authorized')
  WITH CHECK (current_setting('app.root_governance_access', true) = 'authorized');

ALTER TABLE governance.root_governance_attestation_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.root_governance_attestation_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS root_governance_attestation_authorized ON governance.root_governance_attestation_facts;
CREATE POLICY root_governance_attestation_authorized ON governance.root_governance_attestation_facts
  USING (current_setting('app.root_governance_access', true) = 'authorized')
  WITH CHECK (current_setting('app.root_governance_access', true) = 'authorized');

ALTER TABLE governance.root_governance_decision_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE governance.root_governance_decision_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS root_governance_decision_authorized ON governance.root_governance_decision_facts;
CREATE POLICY root_governance_decision_authorized ON governance.root_governance_decision_facts
  USING (current_setting('app.root_governance_access', true) = 'authorized')
  WITH CHECK (current_setting('app.root_governance_access', true) = 'authorized');

DROP TRIGGER IF EXISTS root_governance_proposal_no_update ON governance.root_governance_proposal_facts;
CREATE TRIGGER root_governance_proposal_no_update BEFORE UPDATE ON governance.root_governance_proposal_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS root_governance_proposal_no_delete ON governance.root_governance_proposal_facts;
CREATE TRIGGER root_governance_proposal_no_delete BEFORE DELETE ON governance.root_governance_proposal_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS root_governance_proposal_audit ON governance.root_governance_proposal_facts;
CREATE TRIGGER root_governance_proposal_audit AFTER INSERT OR UPDATE OR DELETE ON governance.root_governance_proposal_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS root_governance_attestation_no_update ON governance.root_governance_attestation_facts;
CREATE TRIGGER root_governance_attestation_no_update BEFORE UPDATE ON governance.root_governance_attestation_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS root_governance_attestation_no_delete ON governance.root_governance_attestation_facts;
CREATE TRIGGER root_governance_attestation_no_delete BEFORE DELETE ON governance.root_governance_attestation_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS root_governance_attestation_audit ON governance.root_governance_attestation_facts;
CREATE TRIGGER root_governance_attestation_audit AFTER INSERT OR UPDATE OR DELETE ON governance.root_governance_attestation_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS root_governance_decision_no_update ON governance.root_governance_decision_facts;
CREATE TRIGGER root_governance_decision_no_update BEFORE UPDATE ON governance.root_governance_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS root_governance_decision_no_delete ON governance.root_governance_decision_facts;
CREATE TRIGGER root_governance_decision_no_delete BEFORE DELETE ON governance.root_governance_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS root_governance_decision_audit ON governance.root_governance_decision_facts;
CREATE TRIGGER root_governance_decision_audit AFTER INSERT OR UPDATE OR DELETE ON governance.root_governance_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

COMMIT;
