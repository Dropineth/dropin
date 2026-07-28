-- Route-closed canonical organization lifecycle and appeal authority.
-- Depends on canopyproof-os.sql. This migration mounts no route, grants no
-- environmental or financial claim, moves no funds, and handles no secrets.

BEGIN;

CREATE OR REPLACE FUNCTION organizations.organization_lifecycle_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'routeMounted', false,
    'schedulerMounted', false,
    'productionActivationEnabled', false,
    'appendOnly', true,
    'exactRetryRequired', true,
    'currentAuthorityReResolutionRequired', true,
    'independentHumanAuthorityRequired', true,
    'aiIsNeverFinalAuthority', true,
    'revocationTerminal', true,
    'rawDocumentsForbidden', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true,
    'noPrivateKeyHandling', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true
  );
$$;

CREATE OR REPLACE FUNCTION organizations.organization_authority_document_is_minimized(document jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT document::text !~* '"(accessToken|address|coordinates|email|geometry|latitude|longitude|password|phone|privateKey|rawDocument|refreshToken|secret)"[[:space:]]*:'
    AND document::text !~* '(certified[[:space:]]+carbon[[:space:]]+credit|carbon[-[:space:]]*tax[[:space:]]+offset|guaranteed[[:space:]]+(rwa[[:space:]]+)?yield|automatic[[:space:]]+canopy[[:space:]]+distribution|mainnet[[:space:]]+fund|private[[:space:]]+key)';
$$;

CREATE OR REPLACE FUNCTION organizations.organization_registration_reference_root(
  organization_value text,
  registration_number_value text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-registration-reference-v1',
    'organizationId', organization_value,
    'registrationNumber', btrim(registration_number_value)
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_authority_roots_are_sorted_unique(roots jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  values_array text[];
BEGIN
  IF jsonb_typeof(roots) <> 'array' THEN RETURN false; END IF;
  SELECT ARRAY(SELECT value FROM jsonb_array_elements_text(roots) value) INTO values_array;
  RETURN cardinality(values_array) <= 128
    AND audit.is_sorted_unique_text_array(values_array)
    AND NOT EXISTS (SELECT 1 FROM unnest(values_array) value WHERE value !~ '^[0-9a-f]{64}$');
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_authority_merkle_root(roots jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM jsonb_array_elements_text(roots) value ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_lifecycle_document_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT organizations.organization_authority_merkle_root(document->'documentRoots');
$$;

CREATE OR REPLACE FUNCTION organizations.organization_lifecycle_source_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT value FROM jsonb_array_elements_text(document->'sourceEventRoots') value
      UNION ALL SELECT document->>'profileRoot'
      UNION ALL SELECT document->>'documentRoot'
      UNION ALL SELECT document->>'previousLifecycleRoot' WHERE document ? 'previousLifecycleRoot'
      UNION ALL SELECT document->>'acceptedReviewRoot' WHERE document ? 'acceptedReviewRoot'
      UNION ALL SELECT document->>'appealDecisionRoot' WHERE document ? 'appealDecisionRoot'
    ) members ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_appeal_evidence_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT value FROM jsonb_array_elements_text(document->'evidenceEventRoots') value
      UNION ALL SELECT document->>'challengedLifecycleRoot'
    ) members ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_appeal_decision_source_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT value FROM jsonb_array_elements_text(document->'sourceEventRoots') value
      UNION ALL SELECT document->>'appealRoot'
      UNION ALL SELECT document->>'priorDecisionRoot' WHERE document ? 'priorDecisionRoot'
    ) members ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_lifecycle_command_hash(document jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
BEGIN
  IF document->'fromStatus' = 'null'::jsonb THEN
    RETURN audit.sha256_stable_json(jsonb_build_object(
      'kind', 'canopyproof-organization-lifecycle-command-v1',
      'organizationId', document->'organizationId',
      'profileRoot', document->'profileRoot',
      'documentRoots', document->'documentRoots',
      'fromStatus', document->'fromStatus',
      'toStatus', document->'toStatus',
      'trustLevel', document->'trustLevel',
      'reasonCode', document->'reasonCode',
      'rationale', document->'rationale',
      'sourceEventRoots', document->'sourceEventRoots',
      'actor', document->'actor',
      'decidedAt', document->'decidedAt'
    ));
  END IF;
  RETURN audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-lifecycle-command-v1',
    'organizationId', document->'organizationId',
    'previousLifecycleRoot', document->'previousLifecycleRoot',
    'profileRoot', document->'profileRoot',
    'documentRoots', document->'documentRoots',
    'fromStatus', document->'fromStatus',
    'toStatus', document->'toStatus',
    'trustLevel', document->'trustLevel',
    'reasonCode', document->'reasonCode',
    'rationale', document->'rationale',
    'sourceEventRoots', document->'sourceEventRoots',
    'acceptedReviewRoot', COALESCE(document->'acceptedReviewRoot', 'null'::jsonb),
    'appealDecisionRoot', COALESCE(document->'appealDecisionRoot', 'null'::jsonb),
    'actor', document->'actor',
    'decidedAt', document->'decidedAt'
  ));
END;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_document_review_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-document-review-command-v1',
    'organizationId', document->'organizationId',
    'lifecycleRoot', document->'lifecycleRoot',
    'profileRoot', document->'profileRoot',
    'registrationReferenceRoot', document->'registrationReferenceRoot',
    'documentRoots', document->'documentRoots',
    'decision', document->'decision',
    'reasonCode', document->'reasonCode',
    'rationale', document->'rationale',
    'conflictDisclosure', document->'conflictDisclosure',
    'sourceEventRoots', document->'sourceEventRoots',
    'reviewer', document->'reviewer',
    'reviewedAt', document->'reviewedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_appeal_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-appeal-command-v1',
    'organizationId', document->'organizationId',
    'challengedLifecycleRoot', document->'challengedLifecycleRoot',
    'reasonCode', document->'reasonCode',
    'requestedRemedy', document->'requestedRemedy',
    'grounds', document->'grounds',
    'evidenceEventRoots', document->'evidenceEventRoots',
    'submitter', document->'submitter',
    'submittedAt', document->'submittedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_appeal_decision_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-appeal-decision-command-v1',
    'organizationId', document->'organizationId',
    'appealRoot', document->'appealRoot',
    'priorDecisionRoot', COALESCE(document->'priorDecisionRoot', 'null'::jsonb),
    'appealDecisionSequence', document->'appealDecisionSequence',
    'decision', document->'decision',
    'remedy', document->'remedy',
    'rationale', document->'rationale',
    'conflictDisclosure', document->'conflictDisclosure',
    'sourceEventRoots', document->'sourceEventRoots',
    'reviewer', document->'reviewer',
    'decidedAt', document->'decidedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_authority_fact_hash(document jsonb, fact_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-organization-' || fact_kind || '-fact-v1') ||
    (document - ARRAY[
      'factType',
      CASE fact_kind
        WHEN 'lifecycle' THEN 'lifecycleHash'
        WHEN 'document-review' THEN 'reviewHash'
        WHEN 'appeal' THEN 'appealHash'
        ELSE 'decisionHash'
      END,
      CASE fact_kind
        WHEN 'lifecycle' THEN 'lifecycleRoot'
        WHEN 'document-review' THEN 'reviewRoot'
        WHEN 'appeal' THEN 'appealRoot'
        ELSE 'decisionRoot'
      END,
      'safety','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION organizations.organization_authority_fact_root(
  document jsonb,
  fact_kind text,
  fact_hash text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-' || fact_kind || '-root-v1',
    'organizationId', document->'organizationId',
    CASE fact_kind
      WHEN 'lifecycle' THEN 'lifecycleHash'
      WHEN 'document-review' THEN 'factHash'
      WHEN 'appeal' THEN 'factHash'
      ELSE 'factHash'
    END, to_jsonb(fact_hash),
    'organizationSequence', document->'organizationSequence',
    'previousEventRoot', document->'previousEventRoot'
  ));
$$;

CREATE TABLE IF NOT EXISTS organizations.organization_lifecycle_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  actor_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  previous_lifecycle_fact_id text REFERENCES organizations.organization_lifecycle_facts(id),
  previous_lifecycle_root text CHECK (previous_lifecycle_root ~ '^[0-9a-f]{64}$'),
  profile_root text NOT NULL CHECK (profile_root ~ '^[0-9a-f]{64}$'),
  document_root text NOT NULL CHECK (document_root ~ '^[0-9a-f]{64}$'),
  from_status text CHECK (from_status IN ('pending','document_review','verified','suspended','revoked')),
  to_status text NOT NULL CHECK (to_status IN ('pending','document_review','verified','suspended','revoked')),
  trust_level text NOT NULL CHECK (trust_level IN ('unverified','basic','verified','institutional','suspended')),
  reason_code text NOT NULL CHECK (reason_code IN (
    'registration_anchor','documents_submitted','verification_approved',
    'compliance_suspension','legal_suspension','fraud_revocation',
    'legal_revocation','governance_revocation','appeal_reinstatement'
  )),
  accepted_review_id text,
  appeal_decision_id text,
  actor_id text NOT NULL REFERENCES identity.participants(id),
  actor_snapshot jsonb NOT NULL CHECK (jsonb_typeof(actor_snapshot) = 'object'),
  decided_at timestamptz NOT NULL,
  organization_sequence bigint NOT NULL CHECK (organization_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  lifecycle_hash text NOT NULL UNIQUE CHECK (lifecycle_hash ~ '^[0-9a-f]{64}$'),
  lifecycle_root text NOT NULL UNIQUE CHECK (lifecycle_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (organization_id, organization_sequence)
);

CREATE TABLE IF NOT EXISTS organizations.organization_document_review_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  lifecycle_fact_id text NOT NULL REFERENCES organizations.organization_lifecycle_facts(id),
  lifecycle_root text NOT NULL CHECK (lifecycle_root ~ '^[0-9a-f]{64}$'),
  profile_root text NOT NULL CHECK (profile_root ~ '^[0-9a-f]{64}$'),
  registration_reference_root text CHECK (registration_reference_root ~ '^[0-9a-f]{64}$'),
  document_root text NOT NULL CHECK (document_root ~ '^[0-9a-f]{64}$'),
  decision text NOT NULL CHECK (decision IN ('accepted','rejected')),
  reason_code text NOT NULL CHECK (reason_code IN (
    'identity_documents_valid','documents_insufficient','registration_unconfirmed','conflict_detected'
  )),
  reviewer_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  reviewer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(reviewer_snapshot) = 'object'),
  reviewed_at timestamptz NOT NULL,
  organization_sequence bigint NOT NULL CHECK (organization_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  review_hash text NOT NULL UNIQUE CHECK (review_hash ~ '^[0-9a-f]{64}$'),
  review_root text NOT NULL UNIQUE CHECK (review_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (organization_id, organization_sequence)
);

ALTER TABLE organizations.organization_document_review_facts
  ADD COLUMN IF NOT EXISTS registration_reference_root text
  CHECK (registration_reference_root ~ '^[0-9a-f]{64}$');

CREATE TABLE IF NOT EXISTS organizations.organization_appeal_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  challenged_lifecycle_fact_id text NOT NULL UNIQUE REFERENCES organizations.organization_lifecycle_facts(id),
  challenged_lifecycle_root text NOT NULL UNIQUE CHECK (challenged_lifecycle_root ~ '^[0-9a-f]{64}$'),
  challenged_status text NOT NULL CHECK (challenged_status IN ('suspended','revoked')),
  challenged_actor_id text NOT NULL REFERENCES identity.participants(id),
  profile_root text NOT NULL CHECK (profile_root ~ '^[0-9a-f]{64}$'),
  reason_code text NOT NULL CHECK (reason_code IN (
    'procedural_error','material_new_evidence','mistaken_identity','disproportionate_action'
  )),
  requested_remedy text NOT NULL CHECK (requested_remedy IN ('reinstatement','procedural_remedy')),
  submitter_id text NOT NULL REFERENCES identity.participants(id),
  submitter_snapshot jsonb NOT NULL CHECK (jsonb_typeof(submitter_snapshot) = 'object'),
  submitted_at timestamptz NOT NULL,
  organization_sequence bigint NOT NULL CHECK (organization_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  appeal_hash text NOT NULL UNIQUE CHECK (appeal_hash ~ '^[0-9a-f]{64}$'),
  appeal_root text NOT NULL UNIQUE CHECK (appeal_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (organization_id, organization_sequence)
);

CREATE TABLE IF NOT EXISTS organizations.organization_appeal_decision_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  appeal_id text NOT NULL REFERENCES organizations.organization_appeal_facts(id),
  appeal_root text NOT NULL CHECK (appeal_root ~ '^[0-9a-f]{64}$'),
  challenged_lifecycle_root text NOT NULL CHECK (challenged_lifecycle_root ~ '^[0-9a-f]{64}$'),
  challenged_status text NOT NULL CHECK (challenged_status IN ('suspended','revoked')),
  prior_decision_id text REFERENCES organizations.organization_appeal_decision_facts(id),
  prior_decision_root text CHECK (prior_decision_root ~ '^[0-9a-f]{64}$'),
  appeal_decision_sequence bigint NOT NULL CHECK (appeal_decision_sequence > 0),
  decision text NOT NULL CHECK (decision IN ('upheld','denied','needs_more_evidence')),
  remedy text NOT NULL CHECK (remedy IN ('none','reinstate','new_identity_required')),
  reviewer_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  reviewer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(reviewer_snapshot) = 'object'),
  decided_at timestamptz NOT NULL,
  organization_sequence bigint NOT NULL CHECK (organization_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  decision_hash text NOT NULL UNIQUE CHECK (decision_hash ~ '^[0-9a-f]{64}$'),
  decision_root text NOT NULL UNIQUE CHECK (decision_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (organization_id, organization_sequence),
  UNIQUE (appeal_id, appeal_decision_sequence)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_lifecycle_accepted_review_fk'
      AND conrelid = 'organizations.organization_lifecycle_facts'::regclass
  ) THEN
    ALTER TABLE organizations.organization_lifecycle_facts
      ADD CONSTRAINT organization_lifecycle_accepted_review_fk
      FOREIGN KEY (accepted_review_id) REFERENCES organizations.organization_document_review_facts(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_lifecycle_appeal_decision_fk'
      AND conrelid = 'organizations.organization_lifecycle_facts'::regclass
  ) THEN
    ALTER TABLE organizations.organization_lifecycle_facts
      ADD CONSTRAINT organization_lifecycle_appeal_decision_fk
      FOREIGN KEY (appeal_decision_id) REFERENCES organizations.organization_appeal_decision_facts(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_document_review_source_root(document jsonb)
RETURNS text
LANGUAGE sql
STABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT value FROM jsonb_array_elements_text(document->'sourceEventRoots') value
      UNION ALL SELECT document->>'lifecycleRoot'
      UNION ALL SELECT document->>'profileRoot'
      UNION ALL SELECT document->>'registrationReferenceRoot'
        WHERE document->>'registrationReferenceRoot' IS NOT NULL
      UNION ALL SELECT document->>'documentRoot'
      UNION ALL SELECT latest.review_root FROM (
        SELECT prior.review_root
        FROM organizations.organization_document_review_facts prior
        WHERE prior.organization_id = document->>'organizationId'
        ORDER BY prior.organization_sequence DESC
        LIMIT 1
      ) latest
    ) members ORDER BY value
  ));
$$;

CREATE UNIQUE INDEX IF NOT EXISTS organization_lifecycle_predecessor_no_fork
  ON organizations.organization_lifecycle_facts (
    organization_id, COALESCE(previous_lifecycle_root, 'GENESIS')
  );
CREATE UNIQUE INDEX IF NOT EXISTS organization_appeal_decision_predecessor_no_fork
  ON organizations.organization_appeal_decision_facts (
    appeal_id, COALESCE(prior_decision_root, 'GENESIS')
  );
CREATE INDEX IF NOT EXISTS organization_lifecycle_status_time
  ON organizations.organization_lifecycle_facts (organization_id, decided_at DESC, organization_sequence DESC);
CREATE INDEX IF NOT EXISTS organization_document_reviews_time
  ON organizations.organization_document_review_facts (organization_id, reviewed_at DESC, organization_sequence DESC);
CREATE INDEX IF NOT EXISTS organization_appeals_time
  ON organizations.organization_appeal_facts (organization_id, submitted_at DESC, organization_sequence DESC);
CREATE INDEX IF NOT EXISTS organization_appeal_decisions_time
  ON organizations.organization_appeal_decision_facts (organization_id, appeal_id, decided_at DESC, appeal_decision_sequence DESC);

CREATE OR REPLACE FUNCTION organizations.organization_authority_latest_sequence(organization_value text)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(max(organization_sequence), 0) FROM (
    SELECT organization_sequence FROM organizations.organization_lifecycle_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_sequence FROM organizations.organization_document_review_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_sequence FROM organizations.organization_appeal_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_sequence FROM organizations.organization_appeal_decision_facts WHERE organization_id = organization_value
  ) authority_events;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_authority_latest_event_root(organization_value text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT audit_event_root FROM (
    SELECT organization_sequence, audit_event_root FROM organizations.organization_lifecycle_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_sequence, audit_event_root FROM organizations.organization_document_review_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_sequence, audit_event_root FROM organizations.organization_appeal_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_sequence, audit_event_root FROM organizations.organization_appeal_decision_facts WHERE organization_id = organization_value
  ) authority_events
  ORDER BY organization_sequence DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_subject_actor_is_current(
  actor_snapshot jsonb,
  actor_id_value text,
  organization_id_value text,
  expected_status text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE
  participant identity.participants%ROWTYPE;
  organization organizations.organizations%ROWTYPE;
  membership organizations.memberships%ROWTYPE;
  scope_values text[];
BEGIN
  IF jsonb_typeof(actor_snapshot) <> 'object'
    OR actor_snapshot->>'id' <> actor_id_value
    OR actor_snapshot->>'participantType' <> 'human'
    OR actor_snapshot->>'role' NOT IN ('owner','admin')
    OR actor_snapshot->>'verificationStatus' <> 'verified'
    OR actor_snapshot->>'organizationId' <> organization_id_value
    OR actor_snapshot->>'organizationVerificationStatus' <> expected_status
    OR actor_snapshot->>'participantRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'organizationRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'membershipStatus' <> 'active'
    OR actor_snapshot->>'membershipRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'authorityRoot' <> verification.actor_snapshot_authority_root(actor_snapshot)
    OR jsonb_typeof(actor_snapshot->'accreditationScope') <> 'array'
    OR actor_snapshot ? 'accreditationId'
    OR actor_snapshot ? 'accreditationStatus'
    OR actor_snapshot ? 'accreditationRoot'
  THEN
    RETURN false;
  END IF;
  SELECT ARRAY(SELECT jsonb_array_elements_text(actor_snapshot->'accreditationScope')) INTO scope_values;
  IF cardinality(scope_values) <> 0 THEN RETURN false; END IF;
  SELECT * INTO participant FROM identity.participants WHERE id = actor_id_value;
  SELECT * INTO organization FROM organizations.organizations WHERE id = organization_id_value;
  SELECT * INTO membership FROM organizations.memberships WHERE id = actor_snapshot->>'membershipId';
  RETURN participant.id IS NOT NULL
    AND participant.participant_type = 'human'
    AND participant.verification_status = 'verified'
    AND participant.subject_hash = actor_snapshot->>'participantRoot'
    AND actor_snapshot->>'role' = ANY(participant.roles)
    AND organization.id IS NOT NULL
    AND organization.verification_status = expected_status
    AND organization.profile_hash = actor_snapshot->>'organizationRoot'
    AND membership.id IS NOT NULL
    AND membership.organization_id = organization_id_value
    AND membership.actor_id = actor_id_value
    AND membership.role = actor_snapshot->>'role'
    AND membership.status = 'active'
    AND membership.audit_event_root = actor_snapshot->>'membershipRoot';
END;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_governance_actor_is_current(
  actor_snapshot jsonb,
  actor_id_value text,
  subject_organization_id text,
  required_scope text,
  allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
AS $$
  SELECT actor_snapshot->>'organizationId' <> subject_organization_id
    AND verification.actor_snapshot_is_valid(
      actor_snapshot,
      actor_id_value,
      actor_snapshot->>'organizationId',
      'human',
      allowed_roles
    )
    AND actor_snapshot->>'membershipStatus' = 'active'
    AND actor_snapshot->>'accreditationStatus' = 'approved'
    AND actor_snapshot->'accreditationScope' ? required_scope;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_authority_event_is_valid(
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
      AND semantic_event.stream_id = 'organization-lifecycle:' || (document->>'organizationId')
      AND semantic_event.sequence_no = (document->>'organizationSequence')::bigint
      AND semantic_event.action = expected_action
      AND semantic_event.actor_id = expected_actor_id
      AND semantic_event.entity_type = expected_entity_type
      AND semantic_event.entity_id = document->>'id'
      AND semantic_event.previous_root = document->>'previousEventRoot'
      AND semantic_event.payload_hash = audit.sha256_stable_json(document - 'auditEvent')
      AND semantic_event.event_root = document->'auditEvent'->>'eventRoot'
      AND semantic_event.created_at = expected_timestamp
      AND document->'auditEvent'->>'actor' = expected_actor_id
      AND document->'auditEvent'->>'entityType' = expected_entity_type
      AND document->'auditEvent'->>'entityId' = document->>'id'
      AND document->'auditEvent'->>'previousRoot' = document->>'previousEventRoot'
      AND document->'auditEvent'->>'payloadHash' = semantic_event.payload_hash
      AND (document->'auditEvent'->>'createdAt')::timestamptz = expected_timestamp
  );
$$;

CREATE OR REPLACE FUNCTION organizations.validate_organization_lifecycle_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  organization organizations.organizations%ROWTYPE;
  current_lifecycle organizations.organization_lifecycle_facts%ROWTYPE;
  accepted_review organizations.organization_document_review_facts%ROWTYPE;
  latest_review_id text;
  appeal_decision organizations.organization_appeal_decision_facts%ROWTYPE;
  appeal organizations.organization_appeal_facts%ROWTYPE;
  expected_sequence bigint;
  expected_previous_root text;
  expected_action text;
  expected_hash text;
  expected_root text;
  transition_valid boolean := false;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('organization-lifecycle:' || NEW.organization_id, 0));
  SELECT * INTO STRICT organization FROM organizations.organizations WHERE id = NEW.organization_id;
  SELECT * INTO current_lifecycle
  FROM organizations.organization_lifecycle_facts
  WHERE organization_id = NEW.organization_id
  ORDER BY organization_sequence DESC
  LIMIT 1;
  expected_sequence := organizations.organization_authority_latest_sequence(NEW.organization_id) + 1;
  expected_previous_root := COALESCE(
    organizations.organization_authority_latest_event_root(NEW.organization_id),
    audit.sha256_stable_json(jsonb_build_object('kind','canopyproof-audit-genesis-v1'))
  );

  IF document->>'factType' <> 'organization_lifecycle'
    OR document->>'id' <> NEW.id
    OR document->>'organizationId' <> NEW.organization_id
    OR document->'actor' <> NEW.actor_snapshot
    OR document->'actor'->>'id' <> NEW.actor_id
    OR document->'actor'->>'organizationId' <> NEW.actor_organization_id
    OR document->>'profileRoot' <> NEW.profile_root
    OR document->>'documentRoot' <> NEW.document_root
    OR document->>'toStatus' <> NEW.to_status
    OR document->>'trustLevel' <> NEW.trust_level
    OR document->>'reasonCode' <> NEW.reason_code
    OR (document->>'decidedAt')::timestamptz <> NEW.decided_at
    OR document->>'decidedAt' <> audit.iso8601_millis(NEW.decided_at)
    OR (document->>'organizationSequence')::bigint <> NEW.organization_sequence
    OR NEW.organization_sequence <> expected_sequence
    OR document->>'previousEventRoot' <> NEW.previous_event_root
    OR NEW.previous_event_root <> expected_previous_root
    OR document->>'commandHash' <> NEW.command_hash
    OR NEW.command_hash <> organizations.organization_lifecycle_command_hash(document)
    OR document->>'lifecycleHash' <> NEW.lifecycle_hash
    OR NEW.lifecycle_hash <> organizations.organization_authority_fact_hash(document, 'lifecycle')
    OR document->>'lifecycleRoot' <> NEW.lifecycle_root
    OR NEW.lifecycle_root <> organizations.organization_authority_fact_root(document, 'lifecycle', NEW.lifecycle_hash)
    OR document->'safety' <> organizations.organization_lifecycle_safety_canonical()
    OR NOT organizations.organization_authority_roots_are_sorted_unique(document->'documentRoots')
    OR NOT organizations.organization_authority_roots_are_sorted_unique(document->'sourceEventRoots')
    OR NEW.document_root <> organizations.organization_lifecycle_document_root(document)
    OR document->>'sourceRoot' <> organizations.organization_lifecycle_source_root(document)
    OR NOT organizations.organization_authority_document_is_minimized(document)
    OR length(btrim(document->>'rationale')) NOT BETWEEN 24 AND 4000
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_LIFECYCLE_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;

  IF current_lifecycle.id IS NULL THEN
    transition_valid := NEW.from_status IS NULL
      AND document->'fromStatus' = 'null'::jsonb
      AND NEW.to_status = 'pending'
      AND NEW.trust_level = 'unverified'
      AND NEW.reason_code = 'registration_anchor'
      AND NEW.previous_lifecycle_fact_id IS NULL
      AND NEW.previous_lifecycle_root IS NULL
      AND NOT (document ? 'previousLifecycleFactId')
      AND NOT (document ? 'previousLifecycleRoot')
      AND organization.verification_status = 'pending'
      AND organization.profile_hash = NEW.profile_root
      AND organizations.organization_subject_actor_is_current(
        NEW.actor_snapshot, NEW.actor_id, NEW.organization_id, 'pending'
      );
  ELSE
    IF current_lifecycle.to_status = 'revoked' THEN
      RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_REVOKED_IDENTITY_TERMINAL' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.previous_lifecycle_fact_id <> current_lifecycle.id
      OR NEW.previous_lifecycle_root <> current_lifecycle.lifecycle_root
      OR document->>'previousLifecycleFactId' <> current_lifecycle.id
      OR document->>'previousLifecycleRoot' <> current_lifecycle.lifecycle_root
      OR NEW.from_status <> current_lifecycle.to_status
      OR document->>'fromStatus' <> current_lifecycle.to_status
      OR NEW.profile_root <> current_lifecycle.profile_root
      OR organization.verification_status <> current_lifecycle.to_status
      OR NEW.decided_at <= current_lifecycle.decided_at
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_LIFECYCLE_PREDECESSOR_INVALID' USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.from_status = 'pending' AND NEW.to_status = 'document_review' THEN
      transition_valid := NEW.reason_code = 'documents_submitted'
        AND jsonb_array_length(document->'documentRoots') > 0
        AND NEW.trust_level = 'basic'
        AND NEW.accepted_review_id IS NULL
        AND NEW.appeal_decision_id IS NULL
        AND NEW.actor_organization_id = NEW.organization_id
        AND NEW.actor_snapshot->>'organizationRoot' = NEW.profile_root
        AND organizations.organization_subject_actor_is_current(
          NEW.actor_snapshot, NEW.actor_id, NEW.organization_id, 'pending'
        );
    ELSIF NEW.from_status = 'document_review' AND NEW.to_status = 'verified' THEN
      SELECT * INTO accepted_review FROM organizations.organization_document_review_facts
      WHERE id = NEW.accepted_review_id;
      SELECT id INTO latest_review_id FROM organizations.organization_document_review_facts
      WHERE organization_id = NEW.organization_id
      ORDER BY organization_sequence DESC LIMIT 1;
      transition_valid := NEW.reason_code = 'verification_approved'
        AND NEW.trust_level IN ('verified','institutional')
        AND accepted_review.id IS NOT NULL
        AND accepted_review.id = latest_review_id
        AND accepted_review.decision = 'accepted'
        AND accepted_review.lifecycle_root = current_lifecycle.lifecycle_root
        AND accepted_review.profile_root = NEW.profile_root
        AND accepted_review.registration_reference_root IS NOT NULL
        AND organization.registration_number IS NOT NULL
        AND length(btrim(organization.registration_number)) BETWEEN 2 AND 240
        AND organization.profile_hash = NEW.profile_root
        AND accepted_review.registration_reference_root =
          organizations.organization_registration_reference_root(
            NEW.organization_id, organization.registration_number
          )
        AND accepted_review.document_root = NEW.document_root
        AND document->>'acceptedReviewId' = accepted_review.id
        AND document->>'acceptedReviewRoot' = accepted_review.review_root
        AND NEW.actor_id <> accepted_review.reviewer_id
        AND NEW.decided_at > accepted_review.reviewed_at
        AND organizations.organization_governance_actor_is_current(
          NEW.actor_snapshot, NEW.actor_id, NEW.organization_id,
          'organization:lifecycle:decide', ARRAY['admin','verifier']::text[]
        );
    ELSIF (
      NEW.from_status = 'verified' AND NEW.to_status IN ('suspended','revoked')
    ) OR (
      NEW.from_status IN ('pending','document_review') AND NEW.to_status = 'revoked'
    ) OR (
      NEW.from_status = 'suspended' AND NEW.to_status = 'revoked'
    ) THEN
      transition_valid := NEW.document_root = current_lifecycle.document_root
        AND NEW.accepted_review_id IS NULL
        AND NEW.appeal_decision_id IS NULL
        AND NEW.trust_level = 'suspended'
        AND (
          (NEW.to_status = 'suspended' AND NEW.reason_code IN ('compliance_suspension','legal_suspension'))
          OR (NEW.to_status = 'revoked' AND NEW.reason_code IN ('fraud_revocation','legal_revocation','governance_revocation'))
        )
        AND organizations.organization_governance_actor_is_current(
          NEW.actor_snapshot, NEW.actor_id, NEW.organization_id,
          'organization:lifecycle:govern', ARRAY['owner','admin','verifier']::text[]
        );
    ELSIF NEW.from_status = 'suspended' AND NEW.to_status = 'verified' THEN
      SELECT * INTO appeal_decision FROM organizations.organization_appeal_decision_facts
      WHERE id = NEW.appeal_decision_id;
      SELECT * INTO appeal FROM organizations.organization_appeal_facts
      WHERE id = appeal_decision.appeal_id;
      transition_valid := NEW.reason_code = 'appeal_reinstatement'
        AND NEW.document_root = current_lifecycle.document_root
        AND NEW.trust_level IN ('verified','institutional')
        AND appeal_decision.id IS NOT NULL
        AND appeal_decision.decision = 'upheld'
        AND appeal_decision.remedy = 'reinstate'
        AND appeal_decision.challenged_status = 'suspended'
        AND appeal_decision.challenged_lifecycle_root = current_lifecycle.lifecycle_root
        AND document->>'appealDecisionId' = appeal_decision.id
        AND document->>'appealDecisionRoot' = appeal_decision.decision_root
        AND NEW.actor_id NOT IN (appeal_decision.reviewer_id, appeal.submitter_id, appeal.challenged_actor_id)
        AND NEW.decided_at > appeal_decision.decided_at
        AND NOT EXISTS (
          SELECT 1 FROM organizations.organization_lifecycle_facts used
          WHERE used.appeal_decision_id = appeal_decision.id
        )
        AND organizations.organization_governance_actor_is_current(
          NEW.actor_snapshot, NEW.actor_id, NEW.organization_id,
          'organization:appeal:resolve', ARRAY['owner','admin','verifier']::text[]
        );
    END IF;
  END IF;

  IF NOT transition_valid THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_LIFECYCLE_TRANSITION_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  expected_action := CASE
    WHEN NEW.to_status = 'verified' THEN 'FULFILL'
    WHEN NEW.to_status IN ('suspended','revoked') THEN 'CHALLENGE'
    ELSE 'ASSERT'
  END;
  IF NOT organizations.organization_authority_event_is_valid(
    document, NEW.audit_event_root, expected_action,
    'organization_lifecycle', NEW.actor_id, NEW.decided_at
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_LIFECYCLE_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION organizations.validate_organization_document_review_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  organization organizations.organizations%ROWTYPE;
  current_lifecycle organizations.organization_lifecycle_facts%ROWTYPE;
  latest_review organizations.organization_document_review_facts%ROWTYPE;
  expected_sequence bigint;
  expected_previous_root text;
  expected_action text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('organization-lifecycle:' || NEW.organization_id, 0));
  SELECT * INTO STRICT organization FROM organizations.organizations WHERE id = NEW.organization_id;
  SELECT * INTO current_lifecycle FROM organizations.organization_lifecycle_facts
  WHERE organization_id = NEW.organization_id ORDER BY organization_sequence DESC LIMIT 1;
  SELECT * INTO latest_review FROM organizations.organization_document_review_facts
  WHERE organization_id = NEW.organization_id ORDER BY organization_sequence DESC LIMIT 1;
  expected_sequence := organizations.organization_authority_latest_sequence(NEW.organization_id) + 1;
  expected_previous_root := COALESCE(
    organizations.organization_authority_latest_event_root(NEW.organization_id),
    audit.sha256_stable_json(jsonb_build_object('kind','canopyproof-audit-genesis-v1'))
  );
  IF current_lifecycle.id IS NULL
    OR current_lifecycle.to_status <> 'document_review'
    OR document->>'factType' <> 'organization_document_review'
    OR document->>'id' <> NEW.id
    OR document->>'organizationId' <> NEW.organization_id
    OR document->>'lifecycleFactId' <> NEW.lifecycle_fact_id
    OR document->>'lifecycleRoot' <> NEW.lifecycle_root
    OR NEW.lifecycle_fact_id <> current_lifecycle.id
    OR NEW.lifecycle_root <> current_lifecycle.lifecycle_root
    OR document->>'profileRoot' <> NEW.profile_root
    OR NEW.profile_root <> current_lifecycle.profile_root
    OR NOT (document ? 'registrationReferenceRoot')
    OR COALESCE(document->>'registrationReferenceRoot', '') <>
      COALESCE(NEW.registration_reference_root, '')
    OR document->>'documentRoot' <> NEW.document_root
    OR NEW.document_root <> current_lifecycle.document_root
    OR document->'documentRoots' <> current_lifecycle.fact_record->'documentRoots'
    OR NOT organizations.organization_authority_roots_are_sorted_unique(document->'documentRoots')
    OR NOT organizations.organization_authority_roots_are_sorted_unique(document->'sourceEventRoots')
    OR NEW.document_root <> organizations.organization_lifecycle_document_root(document)
    OR document->>'decision' <> NEW.decision
    OR document->>'reasonCode' <> NEW.reason_code
    OR document->'reviewer' <> NEW.reviewer_snapshot
    OR document->'reviewer'->>'id' <> NEW.reviewer_id
    OR document->'reviewer'->>'organizationId' <> NEW.reviewer_organization_id
    OR NEW.reviewer_id = current_lifecycle.actor_id
    OR latest_review.decision = 'accepted'
    OR NOT organizations.organization_governance_actor_is_current(
      NEW.reviewer_snapshot, NEW.reviewer_id, NEW.organization_id,
      'organization:lifecycle:review', ARRAY['admin','verifier','researcher']::text[]
    )
    OR (document->>'reviewedAt')::timestamptz <> NEW.reviewed_at
    OR document->>'reviewedAt' <> audit.iso8601_millis(NEW.reviewed_at)
    OR NEW.reviewed_at <= current_lifecycle.decided_at
    OR (latest_review.id IS NOT NULL AND NEW.reviewed_at <= latest_review.reviewed_at)
    OR (document->>'organizationSequence')::bigint <> NEW.organization_sequence
    OR NEW.organization_sequence <> expected_sequence
    OR document->>'previousEventRoot' <> NEW.previous_event_root
    OR NEW.previous_event_root <> expected_previous_root
    OR document->>'commandHash' <> NEW.command_hash
    OR NEW.command_hash <> organizations.organization_document_review_command_hash(document)
    OR document->>'sourceRoot' <> organizations.organization_document_review_source_root(document)
    OR document->>'reviewHash' <> NEW.review_hash
    OR NEW.review_hash <> organizations.organization_authority_fact_hash(document, 'document-review')
    OR document->>'reviewRoot' <> NEW.review_root
    OR NEW.review_root <> organizations.organization_authority_fact_root(document, 'document-review', NEW.review_hash)
    OR document->'safety' <> organizations.organization_lifecycle_safety_canonical()
    OR NOT organizations.organization_authority_document_is_minimized(document)
    OR length(btrim(document->>'rationale')) NOT BETWEEN 24 AND 4000
    OR length(btrim(document->>'conflictDisclosure')) NOT BETWEEN 24 AND 2000
    OR (
      NEW.decision = 'accepted' AND (
        NEW.reason_code <> 'identity_documents_valid'
        OR NEW.registration_reference_root IS NULL
        OR organization.registration_number IS NULL
        OR length(btrim(organization.registration_number)) NOT BETWEEN 2 AND 240
        OR organization.profile_hash <> NEW.profile_root
        OR NEW.registration_reference_root <>
          organizations.organization_registration_reference_root(
            NEW.organization_id, organization.registration_number
          )
      )
    )
    OR (NEW.decision = 'rejected' AND NEW.reason_code = 'identity_documents_valid')
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_DOCUMENT_REVIEW_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  expected_action := CASE WHEN NEW.decision = 'accepted' THEN 'REASON' ELSE 'CHALLENGE' END;
  IF NOT organizations.organization_authority_event_is_valid(
    document, NEW.audit_event_root, expected_action,
    'organization_document_review', NEW.reviewer_id, NEW.reviewed_at
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_DOCUMENT_REVIEW_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION organizations.validate_organization_appeal_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  current_lifecycle organizations.organization_lifecycle_facts%ROWTYPE;
  expected_sequence bigint;
  expected_previous_root text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('organization-lifecycle:' || NEW.organization_id, 0));
  SELECT * INTO current_lifecycle FROM organizations.organization_lifecycle_facts
  WHERE organization_id = NEW.organization_id ORDER BY organization_sequence DESC LIMIT 1;
  expected_sequence := organizations.organization_authority_latest_sequence(NEW.organization_id) + 1;
  expected_previous_root := COALESCE(
    organizations.organization_authority_latest_event_root(NEW.organization_id),
    audit.sha256_stable_json(jsonb_build_object('kind','canopyproof-audit-genesis-v1'))
  );
  IF current_lifecycle.id IS NULL
    OR current_lifecycle.to_status NOT IN ('suspended','revoked')
    OR document->>'factType' <> 'organization_appeal'
    OR document->>'id' <> NEW.id
    OR document->>'organizationId' <> NEW.organization_id
    OR document->>'challengedLifecycleFactId' <> NEW.challenged_lifecycle_fact_id
    OR document->>'challengedLifecycleRoot' <> NEW.challenged_lifecycle_root
    OR NEW.challenged_lifecycle_fact_id <> current_lifecycle.id
    OR NEW.challenged_lifecycle_root <> current_lifecycle.lifecycle_root
    OR document->>'challengedStatus' <> NEW.challenged_status
    OR NEW.challenged_status <> current_lifecycle.to_status
    OR document->>'challengedActorId' <> NEW.challenged_actor_id
    OR NEW.challenged_actor_id <> current_lifecycle.actor_id
    OR document->>'profileRoot' <> NEW.profile_root
    OR NEW.profile_root <> current_lifecycle.profile_root
    OR document->>'reasonCode' <> NEW.reason_code
    OR document->>'requestedRemedy' <> NEW.requested_remedy
    OR (NEW.challenged_status = 'suspended' AND NEW.requested_remedy <> 'reinstatement')
    OR (NEW.challenged_status = 'revoked' AND NEW.requested_remedy <> 'procedural_remedy')
    OR document->'submitter' <> NEW.submitter_snapshot
    OR document->'submitter'->>'id' <> NEW.submitter_id
    OR NOT organizations.organization_subject_actor_is_current(
      NEW.submitter_snapshot, NEW.submitter_id, NEW.organization_id, NEW.challenged_status
    )
    OR NEW.submitter_snapshot->>'organizationRoot' <> NEW.profile_root
    OR NOT organizations.organization_authority_roots_are_sorted_unique(document->'evidenceEventRoots')
    OR jsonb_array_length(document->'evidenceEventRoots') = 0
    OR document->>'evidenceRoot' <> organizations.organization_appeal_evidence_root(document)
    OR (document->>'submittedAt')::timestamptz <> NEW.submitted_at
    OR document->>'submittedAt' <> audit.iso8601_millis(NEW.submitted_at)
    OR NEW.submitted_at <= current_lifecycle.decided_at
    OR (document->>'organizationSequence')::bigint <> NEW.organization_sequence
    OR NEW.organization_sequence <> expected_sequence
    OR document->>'previousEventRoot' <> NEW.previous_event_root
    OR NEW.previous_event_root <> expected_previous_root
    OR document->>'commandHash' <> NEW.command_hash
    OR NEW.command_hash <> organizations.organization_appeal_command_hash(document)
    OR document->>'appealHash' <> NEW.appeal_hash
    OR NEW.appeal_hash <> organizations.organization_authority_fact_hash(document, 'appeal')
    OR document->>'appealRoot' <> NEW.appeal_root
    OR NEW.appeal_root <> organizations.organization_authority_fact_root(document, 'appeal', NEW.appeal_hash)
    OR document->'safety' <> organizations.organization_lifecycle_safety_canonical()
    OR NOT organizations.organization_authority_document_is_minimized(document)
    OR length(btrim(document->>'grounds')) NOT BETWEEN 24 AND 4000
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_APPEAL_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  IF NOT organizations.organization_authority_event_is_valid(
    document, NEW.audit_event_root, 'CHALLENGE',
    'organization_appeal', NEW.submitter_id, NEW.submitted_at
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_APPEAL_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION organizations.validate_organization_appeal_decision_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  appeal organizations.organization_appeal_facts%ROWTYPE;
  current_lifecycle organizations.organization_lifecycle_facts%ROWTYPE;
  prior_decision organizations.organization_appeal_decision_facts%ROWTYPE;
  latest_decision organizations.organization_appeal_decision_facts%ROWTYPE;
  expected_sequence bigint;
  expected_previous_root text;
  expected_action text;
  remedy_valid boolean;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('organization-lifecycle:' || NEW.organization_id, 0));
  SELECT * INTO appeal FROM organizations.organization_appeal_facts WHERE id = NEW.appeal_id;
  SELECT * INTO current_lifecycle FROM organizations.organization_lifecycle_facts
  WHERE organization_id = NEW.organization_id ORDER BY organization_sequence DESC LIMIT 1;
  SELECT * INTO latest_decision FROM organizations.organization_appeal_decision_facts
  WHERE appeal_id = NEW.appeal_id ORDER BY appeal_decision_sequence DESC LIMIT 1;
  IF NEW.prior_decision_id IS NOT NULL THEN
    SELECT * INTO prior_decision FROM organizations.organization_appeal_decision_facts WHERE id = NEW.prior_decision_id;
  END IF;
  expected_sequence := organizations.organization_authority_latest_sequence(NEW.organization_id) + 1;
  expected_previous_root := COALESCE(
    organizations.organization_authority_latest_event_root(NEW.organization_id),
    audit.sha256_stable_json(jsonb_build_object('kind','canopyproof-audit-genesis-v1'))
  );
  remedy_valid :=
    (NEW.decision IN ('denied','needs_more_evidence') AND NEW.remedy = 'none')
    OR (NEW.decision = 'upheld' AND NEW.challenged_status = 'suspended' AND NEW.remedy = 'reinstate')
    OR (NEW.decision = 'upheld' AND NEW.challenged_status = 'revoked' AND NEW.remedy = 'new_identity_required');
  IF appeal.id IS NULL
    OR current_lifecycle.id IS NULL
    OR appeal.organization_id <> NEW.organization_id
    OR current_lifecycle.lifecycle_root <> appeal.challenged_lifecycle_root
    OR current_lifecycle.to_status <> appeal.challenged_status
    OR document->>'factType' <> 'organization_appeal_decision'
    OR document->>'id' <> NEW.id
    OR document->>'organizationId' <> NEW.organization_id
    OR document->>'appealId' <> NEW.appeal_id
    OR document->>'appealRoot' <> NEW.appeal_root
    OR NEW.appeal_root <> appeal.appeal_root
    OR document->>'challengedLifecycleRoot' <> NEW.challenged_lifecycle_root
    OR NEW.challenged_lifecycle_root <> appeal.challenged_lifecycle_root
    OR document->>'challengedStatus' <> NEW.challenged_status
    OR NEW.challenged_status <> appeal.challenged_status
    OR document->>'decision' <> NEW.decision
    OR document->>'remedy' <> NEW.remedy
    OR NOT remedy_valid
    OR document->'reviewer' <> NEW.reviewer_snapshot
    OR document->'reviewer'->>'id' <> NEW.reviewer_id
    OR document->'reviewer'->>'organizationId' <> NEW.reviewer_organization_id
    OR NEW.reviewer_id IN (appeal.submitter_id, appeal.challenged_actor_id)
    OR NOT organizations.organization_governance_actor_is_current(
      NEW.reviewer_snapshot, NEW.reviewer_id, NEW.organization_id,
      CASE WHEN NEW.decision = 'needs_more_evidence'
        THEN 'organization:appeal:review' ELSE 'organization:appeal:resolve' END,
      ARRAY['admin','verifier','researcher']::text[]
    )
    OR (document->>'decidedAt')::timestamptz <> NEW.decided_at
    OR document->>'decidedAt' <> audit.iso8601_millis(NEW.decided_at)
    OR NEW.decided_at <= appeal.submitted_at
    OR (latest_decision.id IS NOT NULL AND NEW.decided_at <= latest_decision.decided_at)
    OR (latest_decision.id IS NOT NULL AND latest_decision.decision <> 'needs_more_evidence')
    OR (latest_decision.id IS NULL AND (NEW.prior_decision_id IS NOT NULL OR NEW.appeal_decision_sequence <> 1))
    OR (latest_decision.id IS NOT NULL AND (
      NEW.prior_decision_id <> latest_decision.id
      OR NEW.prior_decision_root <> latest_decision.decision_root
      OR NEW.appeal_decision_sequence <> latest_decision.appeal_decision_sequence + 1
      OR NEW.reviewer_id = latest_decision.reviewer_id
    ))
    OR (NEW.prior_decision_id IS NULL AND (document ? 'priorDecisionId' OR document ? 'priorDecisionRoot'))
    OR (NEW.prior_decision_id IS NOT NULL AND (
      prior_decision.id IS NULL
      OR document->>'priorDecisionId' <> NEW.prior_decision_id
      OR document->>'priorDecisionRoot' <> NEW.prior_decision_root
    ))
    OR (document->>'appealDecisionSequence')::bigint <> NEW.appeal_decision_sequence
    OR NOT organizations.organization_authority_roots_are_sorted_unique(document->'sourceEventRoots')
    OR document->>'sourceRoot' <> organizations.organization_appeal_decision_source_root(document)
    OR (document->>'organizationSequence')::bigint <> NEW.organization_sequence
    OR NEW.organization_sequence <> expected_sequence
    OR document->>'previousEventRoot' <> NEW.previous_event_root
    OR NEW.previous_event_root <> expected_previous_root
    OR document->>'commandHash' <> NEW.command_hash
    OR NEW.command_hash <> organizations.organization_appeal_decision_command_hash(document)
    OR document->>'decisionHash' <> NEW.decision_hash
    OR NEW.decision_hash <> organizations.organization_authority_fact_hash(document, 'appeal-decision')
    OR document->>'decisionRoot' <> NEW.decision_root
    OR NEW.decision_root <> organizations.organization_authority_fact_root(document, 'appeal-decision', NEW.decision_hash)
    OR document->'safety' <> organizations.organization_lifecycle_safety_canonical()
    OR NOT organizations.organization_authority_document_is_minimized(document)
    OR length(btrim(document->>'rationale')) NOT BETWEEN 24 AND 4000
    OR length(btrim(document->>'conflictDisclosure')) NOT BETWEEN 24 AND 2000
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_APPEAL_DECISION_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  expected_action := CASE
    WHEN NEW.decision = 'upheld' THEN 'FULFILL'
    WHEN NEW.decision = 'denied' THEN 'CHALLENGE'
    ELSE 'REASON'
  END;
  IF NOT organizations.organization_authority_event_is_valid(
    document, NEW.audit_event_root, expected_action,
    'organization_appeal_decision', NEW.reviewer_id, NEW.decided_at
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_APPEAL_DECISION_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION organizations.guard_organization_lifecycle_projection_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    NEW.verification_status IS DISTINCT FROM OLD.verification_status
    OR NEW.trust_level IS DISTINCT FROM OLD.trust_level
  ) AND (
    pg_trigger_depth() < 2
    OR current_setting('app.organization_lifecycle_projection_write', true) <> 'on'
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_STATUS_REQUIRES_CANONICAL_LIFECYCLE_FACT'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION organizations.apply_organization_lifecycle_projection()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prior_setting text := current_setting('app.organization_lifecycle_projection_write', true);
BEGIN
  PERFORM set_config('app.organization_lifecycle_projection_write', 'on', true);
  UPDATE organizations.organizations
  SET verification_status = NEW.to_status,
      trust_level = NEW.trust_level,
      updated_at = NEW.decided_at
  WHERE id = NEW.organization_id;
  PERFORM set_config('app.organization_lifecycle_projection_write', COALESCE(prior_setting, ''), true);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_lifecycle_validate
  ON organizations.organization_lifecycle_facts;
CREATE TRIGGER organization_lifecycle_validate
BEFORE INSERT ON organizations.organization_lifecycle_facts
FOR EACH ROW EXECUTE FUNCTION organizations.validate_organization_lifecycle_insert();

DROP TRIGGER IF EXISTS organization_document_review_validate
  ON organizations.organization_document_review_facts;
CREATE TRIGGER organization_document_review_validate
BEFORE INSERT ON organizations.organization_document_review_facts
FOR EACH ROW EXECUTE FUNCTION organizations.validate_organization_document_review_insert();

DROP TRIGGER IF EXISTS organization_appeal_validate
  ON organizations.organization_appeal_facts;
CREATE TRIGGER organization_appeal_validate
BEFORE INSERT ON organizations.organization_appeal_facts
FOR EACH ROW EXECUTE FUNCTION organizations.validate_organization_appeal_insert();

DROP TRIGGER IF EXISTS organization_appeal_decision_validate
  ON organizations.organization_appeal_decision_facts;
CREATE TRIGGER organization_appeal_decision_validate
BEFORE INSERT ON organizations.organization_appeal_decision_facts
FOR EACH ROW EXECUTE FUNCTION organizations.validate_organization_appeal_decision_insert();

DROP TRIGGER IF EXISTS organizations_lifecycle_projection_guard
  ON organizations.organizations;
CREATE TRIGGER organizations_lifecycle_projection_guard
BEFORE UPDATE OF verification_status, trust_level ON organizations.organizations
FOR EACH ROW EXECUTE FUNCTION organizations.guard_organization_lifecycle_projection_update();

DROP TRIGGER IF EXISTS organization_lifecycle_apply_projection
  ON organizations.organization_lifecycle_facts;
CREATE TRIGGER organization_lifecycle_apply_projection
AFTER INSERT ON organizations.organization_lifecycle_facts
FOR EACH ROW EXECUTE FUNCTION organizations.apply_organization_lifecycle_projection();

ALTER TABLE organizations.organization_lifecycle_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations.organization_lifecycle_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_lifecycle_tenant ON organizations.organization_lifecycle_facts;
CREATE POLICY organization_lifecycle_tenant ON organizations.organization_lifecycle_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE organizations.organization_document_review_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations.organization_document_review_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_document_review_tenant ON organizations.organization_document_review_facts;
CREATE POLICY organization_document_review_tenant ON organizations.organization_document_review_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE organizations.organization_appeal_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations.organization_appeal_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_appeal_tenant ON organizations.organization_appeal_facts;
CREATE POLICY organization_appeal_tenant ON organizations.organization_appeal_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE organizations.organization_appeal_decision_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations.organization_appeal_decision_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_appeal_decision_tenant ON organizations.organization_appeal_decision_facts;
CREATE POLICY organization_appeal_decision_tenant ON organizations.organization_appeal_decision_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

DROP TRIGGER IF EXISTS organization_lifecycle_no_update ON organizations.organization_lifecycle_facts;
CREATE TRIGGER organization_lifecycle_no_update
BEFORE UPDATE ON organizations.organization_lifecycle_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_lifecycle_no_delete ON organizations.organization_lifecycle_facts;
CREATE TRIGGER organization_lifecycle_no_delete
BEFORE DELETE ON organizations.organization_lifecycle_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_lifecycle_audit ON organizations.organization_lifecycle_facts;
CREATE TRIGGER organization_lifecycle_audit
AFTER INSERT OR UPDATE OR DELETE ON organizations.organization_lifecycle_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS organization_document_review_no_update ON organizations.organization_document_review_facts;
CREATE TRIGGER organization_document_review_no_update
BEFORE UPDATE ON organizations.organization_document_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_document_review_no_delete ON organizations.organization_document_review_facts;
CREATE TRIGGER organization_document_review_no_delete
BEFORE DELETE ON organizations.organization_document_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_document_review_audit ON organizations.organization_document_review_facts;
CREATE TRIGGER organization_document_review_audit
AFTER INSERT OR UPDATE OR DELETE ON organizations.organization_document_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS organization_appeal_no_update ON organizations.organization_appeal_facts;
CREATE TRIGGER organization_appeal_no_update
BEFORE UPDATE ON organizations.organization_appeal_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_appeal_no_delete ON organizations.organization_appeal_facts;
CREATE TRIGGER organization_appeal_no_delete
BEFORE DELETE ON organizations.organization_appeal_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_appeal_audit ON organizations.organization_appeal_facts;
CREATE TRIGGER organization_appeal_audit
AFTER INSERT OR UPDATE OR DELETE ON organizations.organization_appeal_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS organization_appeal_decision_no_update ON organizations.organization_appeal_decision_facts;
CREATE TRIGGER organization_appeal_decision_no_update
BEFORE UPDATE ON organizations.organization_appeal_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_appeal_decision_no_delete ON organizations.organization_appeal_decision_facts;
CREATE TRIGGER organization_appeal_decision_no_delete
BEFORE DELETE ON organizations.organization_appeal_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_appeal_decision_audit ON organizations.organization_appeal_decision_facts;
CREATE TRIGGER organization_appeal_decision_audit
AFTER INSERT OR UPDATE OR DELETE ON organizations.organization_appeal_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

COMMIT;
