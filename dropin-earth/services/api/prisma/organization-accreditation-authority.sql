-- Route-closed canonical organization accreditation authority.
-- Depends on canopyproof-os.sql. This migration does not mount a route,
-- authorize production, trust compatibility accreditation rows, move funds,
-- distribute tokens, issue environmental claims, or handle secrets.

BEGIN;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_safety_canonical()
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
    'explicitAsOfRequired', true,
    'currentAuthorityReResolutionRequired', true,
    'independentHumanReviewRequired', true,
    'reviewerDeciderSeparationRequired', true,
    'aiIsNeverFinalAuthority', true,
    'revocationTerminal', true,
    'compatibilityAccreditationIsNotCanonical', true,
    'rawEvidenceForbidden', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true,
    'noPrivateKeyHandling', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true
  );
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_document_is_minimized(document jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT document::text !~* '"(accessToken|address|coordinates|email|geometry|latitude|longitude|password|phone|privateKey|rawDocument|rawEvidence|refreshToken|secret)"[[:space:]]*:'
    AND document::text !~* '(certified[[:space:]]+carbon[[:space:]]+credit|carbon[-[:space:]]*tax[[:space:]]+offset|guaranteed[[:space:]]+(rwa[[:space:]]+)?yield|automatic[[:space:]]+canopy[[:space:]]+distribution|mainnet[[:space:]]+fund|private[[:space:]]+key)';
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_roots_are_sorted_unique(roots jsonb)
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
  RETURN cardinality(values_array) BETWEEN 1 AND 128
    AND audit.is_sorted_unique_text_array(values_array)
    AND NOT EXISTS (SELECT 1 FROM unnest(values_array) value WHERE value !~ '^[0-9a-f]{64}$');
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_scope_is_sorted_unique(scope_value jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  values_array text[];
BEGIN
  IF jsonb_typeof(scope_value) <> 'array' THEN RETURN false; END IF;
  SELECT ARRAY(SELECT value FROM jsonb_array_elements_text(scope_value) value) INTO values_array;
  RETURN cardinality(values_array) BETWEEN 1 AND 64
    AND audit.is_sorted_unique_text_array(values_array)
    AND NOT EXISTS (
      SELECT 1 FROM unnest(values_array) value
      WHERE length(btrim(value)) NOT BETWEEN 1 AND 160
    );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_merkle_root(values_json jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM jsonb_array_elements_text(values_json) value ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_scope_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT organizations.organization_accreditation_merkle_root(document->'scope');
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_application_evidence_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT value FROM jsonb_array_elements_text(document->'evidenceEventRoots') value
      UNION ALL SELECT document->>'profileRoot'
      UNION ALL SELECT document->>'policyRoot'
      UNION ALL SELECT document->>'scopeRoot'
      UNION ALL SELECT document->>'priorDecisionRoot' WHERE document ? 'priorDecisionRoot'
    ) members ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_review_source_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT value FROM jsonb_array_elements_text(document->'sourceEventRoots') value
      UNION ALL SELECT document->>'applicationRoot'
      UNION ALL SELECT document->>'profileRoot'
      UNION ALL SELECT document->>'policyRoot'
      UNION ALL SELECT document->>'scopeRoot'
    ) members ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_decision_source_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT value FROM jsonb_array_elements_text(document->'sourceEventRoots') value
      UNION ALL SELECT document->>'applicationRoot'
      UNION ALL SELECT document->>'acceptedReviewRoot'
      UNION ALL SELECT document->>'profileRoot'
      UNION ALL SELECT document->>'policyRoot'
      UNION ALL SELECT document->>'scopeRoot'
    ) members ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_control_evidence_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.merkle_root(ARRAY(
    SELECT value FROM (
      SELECT value FROM jsonb_array_elements_text(document->'evidenceEventRoots') value
      UNION ALL SELECT document->>'decisionRoot'
      UNION ALL SELECT document->>'previousControlRoot' WHERE document ? 'previousControlRoot'
    ) members ORDER BY value
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_actor_authority_root(actor_snapshot jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-organization-accreditation-actor-authority-v1') ||
    (actor_snapshot - 'authorityRoot')
  );
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_application_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-accreditation-application-command-v1',
    'organizationId', document->'organizationId',
    'applicationKind', document->'applicationKind',
    'priorDecisionRoot', COALESCE(document->'priorDecisionRoot', 'null'::jsonb),
    'profileRoot', document->'profileRoot',
    'scope', document->'scope',
    'evidenceEventRoots', document->'evidenceEventRoots',
    'policyRoot', document->'policyRoot',
    'requestedValidUntil', document->'requestedValidUntil',
    'submitter', document->'submitter',
    'submittedAt', document->'submittedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_review_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-accreditation-review-command-v1',
    'organizationId', document->'organizationId',
    'applicationRoot', document->'applicationRoot',
    'profileRoot', document->'profileRoot',
    'policyRoot', document->'policyRoot',
    'decision', document->'decision',
    'reasonCode', document->'reasonCode',
    'rationale', document->'rationale',
    'conflictDisclosure', document->'conflictDisclosure',
    'sourceEventRoots', document->'sourceEventRoots',
    'reviewer', document->'reviewer',
    'reviewedAt', document->'reviewedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_decision_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-accreditation-decision-command-v1',
    'organizationId', document->'organizationId',
    'applicationRoot', document->'applicationRoot',
    'acceptedReviewRoot', document->'acceptedReviewRoot',
    'profileRoot', document->'profileRoot',
    'policyRoot', document->'policyRoot',
    'scope', document->'scope',
    'decision', document->'decision',
    'reasonCode', document->'reasonCode',
    'rationale', document->'rationale',
    'sourceEventRoots', document->'sourceEventRoots',
    'validFrom', document->'validFrom',
    'validUntil', document->'validUntil',
    'decider', document->'decider',
    'decidedAt', document->'decidedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_control_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-organization-accreditation-control-command-v1',
    'organizationId', document->'organizationId',
    'decisionRoot', document->'decisionRoot',
    'previousControlRoot', COALESCE(document->'previousControlRoot', 'null'::jsonb),
    'action', document->'action',
    'reasonCode', document->'reasonCode',
    'rationale', document->'rationale',
    'evidenceEventRoots', document->'evidenceEventRoots',
    'governor', document->'governor',
    'controlledAt', document->'controlledAt'
  ));
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_fact_hash(document jsonb, fact_kind text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object(
      'kind', 'canopyproof-organization-accreditation-' || fact_kind || '-fact-v1'
    ) ||
    (document - ARRAY[
      'factType',
      CASE fact_kind
        WHEN 'application' THEN 'applicationHash'
        WHEN 'review' THEN 'reviewHash'
        WHEN 'decision' THEN 'decisionHash'
        ELSE 'controlHash'
      END,
      CASE fact_kind
        WHEN 'application' THEN 'applicationRoot'
        WHEN 'review' THEN 'reviewRoot'
        WHEN 'decision' THEN 'decisionRoot'
        ELSE 'controlRoot'
      END,
      'safety', 'auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_fact_root(
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
    'kind', 'canopyproof-organization-accreditation-' || fact_kind || '-root-v1',
    'organizationId', document->'organizationId',
    'factHash', to_jsonb(fact_hash),
    'organizationAccreditationSequence', document->'organizationAccreditationSequence',
    'previousEventRoot', document->'previousEventRoot'
  ));
$$;

CREATE TABLE IF NOT EXISTS organizations.organization_accreditation_application_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  application_kind text NOT NULL CHECK (application_kind IN ('initial','renewal')),
  prior_decision_id text,
  prior_decision_root text CHECK (prior_decision_root ~ '^[0-9a-f]{64}$'),
  profile_root text NOT NULL CHECK (profile_root ~ '^[0-9a-f]{64}$'),
  scope text[] NOT NULL CHECK (cardinality(scope) BETWEEN 1 AND 64),
  scope_root text NOT NULL CHECK (scope_root ~ '^[0-9a-f]{64}$'),
  policy_root text NOT NULL CHECK (policy_root ~ '^[0-9a-f]{64}$'),
  requested_valid_until timestamptz NOT NULL,
  submitter_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  submitter_id text NOT NULL REFERENCES identity.participants(id),
  submitter_snapshot jsonb NOT NULL CHECK (jsonb_typeof(submitter_snapshot) = 'object'),
  submitted_at timestamptz NOT NULL,
  organization_accreditation_sequence bigint NOT NULL CHECK (organization_accreditation_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  application_hash text NOT NULL UNIQUE CHECK (application_hash ~ '^[0-9a-f]{64}$'),
  application_root text NOT NULL UNIQUE CHECK (application_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (organization_id, organization_accreditation_sequence),
  CHECK ((application_kind = 'initial' AND prior_decision_id IS NULL AND prior_decision_root IS NULL)
    OR (application_kind = 'renewal' AND prior_decision_id IS NOT NULL AND prior_decision_root IS NOT NULL)),
  CHECK (submitted_at < requested_valid_until)
);

CREATE TABLE IF NOT EXISTS organizations.organization_accreditation_review_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  application_id text NOT NULL UNIQUE REFERENCES organizations.organization_accreditation_application_facts(id),
  application_root text NOT NULL CHECK (application_root ~ '^[0-9a-f]{64}$'),
  profile_root text NOT NULL CHECK (profile_root ~ '^[0-9a-f]{64}$'),
  policy_root text NOT NULL CHECK (policy_root ~ '^[0-9a-f]{64}$'),
  scope_root text NOT NULL CHECK (scope_root ~ '^[0-9a-f]{64}$'),
  decision text NOT NULL CHECK (decision IN ('accepted','rejected')),
  reason_code text NOT NULL CHECK (reason_code IN (
    'evidence_sufficient','evidence_insufficient','scope_unsupported','conflict_detected'
  )),
  reviewer_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  reviewer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(reviewer_snapshot) = 'object'),
  reviewed_at timestamptz NOT NULL,
  organization_accreditation_sequence bigint NOT NULL CHECK (organization_accreditation_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  review_hash text NOT NULL UNIQUE CHECK (review_hash ~ '^[0-9a-f]{64}$'),
  review_root text NOT NULL UNIQUE CHECK (review_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (organization_id, organization_accreditation_sequence)
);

CREATE TABLE IF NOT EXISTS organizations.organization_accreditation_decision_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  application_id text NOT NULL UNIQUE REFERENCES organizations.organization_accreditation_application_facts(id),
  application_root text NOT NULL CHECK (application_root ~ '^[0-9a-f]{64}$'),
  accepted_review_id text NOT NULL UNIQUE REFERENCES organizations.organization_accreditation_review_facts(id),
  accepted_review_root text NOT NULL CHECK (accepted_review_root ~ '^[0-9a-f]{64}$'),
  profile_root text NOT NULL CHECK (profile_root ~ '^[0-9a-f]{64}$'),
  policy_root text NOT NULL CHECK (policy_root ~ '^[0-9a-f]{64}$'),
  scope text[] NOT NULL CHECK (cardinality(scope) BETWEEN 1 AND 64),
  scope_root text NOT NULL CHECK (scope_root ~ '^[0-9a-f]{64}$'),
  decision text NOT NULL CHECK (decision IN ('approved','denied')),
  reason_code text NOT NULL CHECK (reason_code IN (
    'requirements_satisfied','requirements_not_satisfied','policy_ineligible'
  )),
  valid_from timestamptz,
  valid_until timestamptz,
  decider_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  decider_id text NOT NULL REFERENCES identity.participants(id),
  decider_snapshot jsonb NOT NULL CHECK (jsonb_typeof(decider_snapshot) = 'object'),
  decided_at timestamptz NOT NULL,
  organization_accreditation_sequence bigint NOT NULL CHECK (organization_accreditation_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  decision_hash text NOT NULL UNIQUE CHECK (decision_hash ~ '^[0-9a-f]{64}$'),
  decision_root text NOT NULL UNIQUE CHECK (decision_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (organization_id, organization_accreditation_sequence),
  CHECK ((decision = 'approved' AND valid_from IS NOT NULL AND valid_until IS NOT NULL AND valid_from < valid_until)
    OR (decision = 'denied' AND valid_from IS NULL AND valid_until IS NULL))
);

CREATE TABLE IF NOT EXISTS organizations.organization_accreditation_control_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  decision_id text NOT NULL REFERENCES organizations.organization_accreditation_decision_facts(id),
  decision_root text NOT NULL CHECK (decision_root ~ '^[0-9a-f]{64}$'),
  previous_control_id text REFERENCES organizations.organization_accreditation_control_facts(id),
  previous_control_root text CHECK (previous_control_root ~ '^[0-9a-f]{64}$'),
  action text NOT NULL CHECK (action IN ('suspend','revoke')),
  reason_code text NOT NULL CHECK (reason_code IN (
    'compliance_concern','material_misrepresentation','governance_breach','legal_restriction'
  )),
  governor_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  governor_id text NOT NULL REFERENCES identity.participants(id),
  governor_snapshot jsonb NOT NULL CHECK (jsonb_typeof(governor_snapshot) = 'object'),
  controlled_at timestamptz NOT NULL,
  organization_accreditation_sequence bigint NOT NULL CHECK (organization_accreditation_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  control_hash text NOT NULL UNIQUE CHECK (control_hash ~ '^[0-9a-f]{64}$'),
  control_root text NOT NULL UNIQUE CHECK (control_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (organization_id, organization_accreditation_sequence),
  CHECK ((previous_control_id IS NULL AND previous_control_root IS NULL)
    OR (previous_control_id IS NOT NULL AND previous_control_root IS NOT NULL))
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'organization_accreditation_application_prior_decision_fk'
      AND conrelid = 'organizations.organization_accreditation_application_facts'::regclass
  ) THEN
    ALTER TABLE organizations.organization_accreditation_application_facts
      ADD CONSTRAINT organization_accreditation_application_prior_decision_fk
      FOREIGN KEY (prior_decision_id)
      REFERENCES organizations.organization_accreditation_decision_facts(id)
      DEFERRABLE INITIALLY DEFERRED;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS organization_accreditation_initial_application_once
  ON organizations.organization_accreditation_application_facts (organization_id)
  WHERE application_kind = 'initial';

CREATE UNIQUE INDEX IF NOT EXISTS organization_accreditation_renewal_predecessor_no_fork
  ON organizations.organization_accreditation_application_facts (prior_decision_id)
  WHERE prior_decision_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organization_accreditation_first_control_no_fork
  ON organizations.organization_accreditation_control_facts (decision_id)
  WHERE previous_control_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organization_accreditation_control_predecessor_no_fork
  ON organizations.organization_accreditation_control_facts (decision_id, previous_control_id)
  WHERE previous_control_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS organization_accreditation_application_stream_page
  ON organizations.organization_accreditation_application_facts
  (organization_id, organization_accreditation_sequence DESC);
CREATE INDEX IF NOT EXISTS organization_accreditation_review_stream_page
  ON organizations.organization_accreditation_review_facts
  (organization_id, organization_accreditation_sequence DESC);
CREATE INDEX IF NOT EXISTS organization_accreditation_decision_stream_page
  ON organizations.organization_accreditation_decision_facts
  (organization_id, organization_accreditation_sequence DESC);
CREATE INDEX IF NOT EXISTS organization_accreditation_control_stream_page
  ON organizations.organization_accreditation_control_facts
  (organization_id, organization_accreditation_sequence DESC);

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_latest_sequence(organization_value text)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(max(organization_accreditation_sequence), 0) FROM (
    SELECT organization_accreditation_sequence
    FROM organizations.organization_accreditation_application_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_accreditation_sequence
    FROM organizations.organization_accreditation_review_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_accreditation_sequence
    FROM organizations.organization_accreditation_decision_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_accreditation_sequence
    FROM organizations.organization_accreditation_control_facts WHERE organization_id = organization_value
  ) facts;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_latest_event_root(organization_value text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT audit_event_root FROM (
    SELECT organization_accreditation_sequence, audit_event_root
    FROM organizations.organization_accreditation_application_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_accreditation_sequence, audit_event_root
    FROM organizations.organization_accreditation_review_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_accreditation_sequence, audit_event_root
    FROM organizations.organization_accreditation_decision_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_accreditation_sequence, audit_event_root
    FROM organizations.organization_accreditation_control_facts WHERE organization_id = organization_value
  ) facts ORDER BY organization_accreditation_sequence DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_latest_fact_time(organization_value text)
RETURNS timestamptz
LANGUAGE sql
STABLE
AS $$
  SELECT effective_at FROM (
    SELECT organization_accreditation_sequence, submitted_at AS effective_at
    FROM organizations.organization_accreditation_application_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_accreditation_sequence, reviewed_at
    FROM organizations.organization_accreditation_review_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_accreditation_sequence, decided_at
    FROM organizations.organization_accreditation_decision_facts WHERE organization_id = organization_value
    UNION ALL
    SELECT organization_accreditation_sequence, controlled_at
    FROM organizations.organization_accreditation_control_facts WHERE organization_id = organization_value
  ) facts ORDER BY organization_accreditation_sequence DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_subject_actor_is_current(
  actor_snapshot jsonb,
  actor_id_value text,
  organization_id_value text
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
BEGIN
  IF NOT (actor_snapshot ?& ARRAY[
      'id','participantType','role','verificationStatus','organizationId',
      'organizationVerificationStatus','participantRoot','organizationRoot',
      'membershipId','membershipStatus','membershipRoot','authoritySource',
      'accreditationScope','authorityRoot'
    ])
    OR jsonb_typeof(actor_snapshot) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(actor_snapshot)) <> 14
    OR actor_snapshot->>'id' <> actor_id_value
    OR actor_snapshot->>'participantType' <> 'human'
    OR actor_snapshot->>'role' NOT IN ('owner','admin')
    OR actor_snapshot->>'verificationStatus' <> 'verified'
    OR actor_snapshot->>'organizationId' <> organization_id_value
    OR actor_snapshot->>'organizationVerificationStatus' <> 'verified'
    OR actor_snapshot->>'participantRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'organizationRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'membershipStatus' <> 'active'
    OR actor_snapshot->>'membershipRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'authoritySource' <> 'subject_membership'
    OR actor_snapshot->>'authorityRoot' <> organizations.organization_accreditation_actor_authority_root(actor_snapshot)
    OR jsonb_typeof(actor_snapshot->'accreditationScope') <> 'array'
    OR jsonb_array_length(actor_snapshot->'accreditationScope') <> 0
    OR actor_snapshot ?| ARRAY[
      'accreditationId','accreditationStatus','accreditationDecisionRoot',
      'accreditationProjectionRoot','accreditationValidFrom','accreditationValidUntil'
    ]
  THEN
    RETURN false;
  END IF;
  SELECT * INTO participant FROM identity.participants WHERE id = actor_id_value;
  SELECT * INTO organization FROM organizations.organizations WHERE id = organization_id_value;
  SELECT * INTO membership FROM organizations.memberships WHERE id = actor_snapshot->>'membershipId';
  RETURN participant.id IS NOT NULL
    AND participant.participant_type = 'human'
    AND participant.verification_status = 'verified'
    AND participant.subject_hash = actor_snapshot->>'participantRoot'
    AND actor_snapshot->>'role' = ANY(participant.roles)
    AND organization.id IS NOT NULL
    AND organization.verification_status = 'verified'
    AND organization.profile_hash = actor_snapshot->>'organizationRoot'
    AND membership.id IS NOT NULL
    AND membership.organization_id = organization_id_value
    AND membership.actor_id = actor_id_value
    AND membership.role = actor_snapshot->>'role'
    AND membership.status = 'active'
    AND membership.audit_event_root = actor_snapshot->>'membershipRoot';
END;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_governance_actor_is_current(
  actor_snapshot jsonb,
  actor_id_value text,
  subject_organization_id text,
  required_scope text,
  allowed_roles text[],
  effective_at timestamptz
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
  valid_from timestamptz;
  valid_until timestamptz;
BEGIN
  IF NOT (actor_snapshot ?& ARRAY[
      'id','participantType','role','verificationStatus','organizationId',
      'organizationVerificationStatus','participantRoot','organizationRoot',
      'membershipId','membershipStatus','membershipRoot','authoritySource','accreditationId',
      'accreditationStatus','accreditationDecisionRoot','accreditationProjectionRoot',
      'accreditationValidFrom','accreditationValidUntil','accreditationScope','authorityRoot'
    ])
    OR jsonb_typeof(actor_snapshot) <> 'object'
    OR (SELECT count(*) FROM jsonb_object_keys(actor_snapshot)) <> 20
    OR actor_snapshot->>'id' <> actor_id_value
    OR actor_snapshot->>'participantType' <> 'human'
    OR NOT (actor_snapshot->>'role' = ANY(allowed_roles))
    OR actor_snapshot->>'verificationStatus' <> 'verified'
    OR actor_snapshot->>'organizationId' = subject_organization_id
    OR actor_snapshot->>'organizationVerificationStatus' <> 'verified'
    OR actor_snapshot->>'participantRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'organizationRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'membershipStatus' <> 'active'
    OR actor_snapshot->>'membershipRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'authoritySource' NOT IN ('root_governance_bootstrap','canonical_accreditation')
    OR actor_snapshot->>'accreditationStatus' <> 'approved'
    OR actor_snapshot->>'accreditationDecisionRoot' !~ '^[0-9a-f]{64}$'
    OR actor_snapshot->>'accreditationProjectionRoot' !~ '^[0-9a-f]{64}$'
    OR length(btrim(actor_snapshot->>'accreditationId')) NOT BETWEEN 1 AND 240
    OR organizations.organization_accreditation_scope_is_sorted_unique(
      actor_snapshot->'accreditationScope'
    ) IS NOT TRUE
    OR NOT (actor_snapshot->'accreditationScope' ? required_scope)
    OR actor_snapshot->>'authorityRoot' <> organizations.organization_accreditation_actor_authority_root(actor_snapshot)
  THEN
    RETURN false;
  END IF;
  BEGIN
    valid_from := (actor_snapshot->>'accreditationValidFrom')::timestamptz;
    valid_until := (actor_snapshot->>'accreditationValidUntil')::timestamptz;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;
  IF actor_snapshot->>'accreditationValidFrom' <> audit.iso8601_millis(valid_from)
    OR actor_snapshot->>'accreditationValidUntil' <> audit.iso8601_millis(valid_until)
    OR effective_at < valid_from
    OR effective_at >= valid_until
  THEN
    RETURN false;
  END IF;
  SELECT * INTO participant FROM identity.participants WHERE id = actor_id_value;
  SELECT * INTO organization FROM organizations.organizations WHERE id = actor_snapshot->>'organizationId';
  SELECT * INTO membership FROM organizations.memberships WHERE id = actor_snapshot->>'membershipId';
  RETURN participant.id IS NOT NULL
    AND participant.participant_type = 'human'
    AND participant.verification_status = 'verified'
    AND participant.subject_hash = actor_snapshot->>'participantRoot'
    AND actor_snapshot->>'role' = ANY(participant.roles)
    AND organization.id IS NOT NULL
    AND organization.verification_status = 'verified'
    AND organization.profile_hash = actor_snapshot->>'organizationRoot'
    AND membership.id IS NOT NULL
    AND membership.organization_id = organization.id
    AND membership.actor_id = actor_id_value
    AND membership.role = actor_snapshot->>'role'
    AND membership.status = 'active'
    AND membership.audit_event_root = actor_snapshot->>'membershipRoot';
END;
$$;

CREATE OR REPLACE FUNCTION organizations.organization_accreditation_event_is_valid(
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
      AND semantic_event.stream_id = 'organization-accreditation:' || (document->>'organizationId')
      AND semantic_event.sequence_no = (document->>'organizationAccreditationSequence')::bigint
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

CREATE OR REPLACE FUNCTION organizations.validate_organization_accreditation_fact_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  row_document jsonb := to_jsonb(NEW);
  fact_kind text;
  fact_type text;
  fact_hash_key text;
  fact_root_key text;
  row_fact_hash text;
  row_fact_root text;
  expected_sequence bigint;
  expected_previous_root text;
  latest_fact_time timestamptz;
  expected_action text;
  expected_actor_id text;
  effective_at timestamptz;
  application organizations.organization_accreditation_application_facts%ROWTYPE;
  latest_application organizations.organization_accreditation_application_facts%ROWTYPE;
  review organizations.organization_accreditation_review_facts%ROWTYPE;
  decision organizations.organization_accreditation_decision_facts%ROWTYPE;
  latest_decision organizations.organization_accreditation_decision_facts%ROWTYPE;
  prior_control organizations.organization_accreditation_control_facts%ROWTYPE;
  latest_control organizations.organization_accreditation_control_facts%ROWTYPE;
  current_status text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('organization-accreditation:' || NEW.organization_id, 0));
  CASE TG_TABLE_NAME
    WHEN 'organization_accreditation_application_facts' THEN
      fact_kind := 'application'; fact_type := 'organization_accreditation_application';
      fact_hash_key := 'applicationHash'; fact_root_key := 'applicationRoot';
      row_fact_hash := row_document->>'application_hash'; row_fact_root := row_document->>'application_root';
      expected_action := 'ASSERT'; expected_actor_id := row_document->>'submitter_id';
      effective_at := (row_document->>'submitted_at')::timestamptz;
    WHEN 'organization_accreditation_review_facts' THEN
      fact_kind := 'review'; fact_type := 'organization_accreditation_review';
      fact_hash_key := 'reviewHash'; fact_root_key := 'reviewRoot';
      row_fact_hash := row_document->>'review_hash'; row_fact_root := row_document->>'review_root';
      expected_actor_id := row_document->>'reviewer_id';
      effective_at := (row_document->>'reviewed_at')::timestamptz;
    WHEN 'organization_accreditation_decision_facts' THEN
      fact_kind := 'decision'; fact_type := 'organization_accreditation_decision';
      fact_hash_key := 'decisionHash'; fact_root_key := 'decisionRoot';
      row_fact_hash := row_document->>'decision_hash'; row_fact_root := row_document->>'decision_root';
      expected_actor_id := row_document->>'decider_id';
      effective_at := (row_document->>'decided_at')::timestamptz;
    WHEN 'organization_accreditation_control_facts' THEN
      fact_kind := 'control'; fact_type := 'organization_accreditation_control';
      fact_hash_key := 'controlHash'; fact_root_key := 'controlRoot';
      row_fact_hash := row_document->>'control_hash'; row_fact_root := row_document->>'control_root';
      expected_action := 'CHALLENGE'; expected_actor_id := row_document->>'governor_id';
      effective_at := (row_document->>'controlled_at')::timestamptz;
    ELSE
      RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_ACCREDITATION_FACT_TABLE_INVALID'
        USING ERRCODE = 'check_violation';
  END CASE;

  expected_sequence := organizations.organization_accreditation_latest_sequence(NEW.organization_id) + 1;
  expected_previous_root := COALESCE(
    organizations.organization_accreditation_latest_event_root(NEW.organization_id),
    audit.sha256_stable_json(jsonb_build_object('kind','canopyproof-audit-genesis-v1'))
  );
  latest_fact_time := organizations.organization_accreditation_latest_fact_time(NEW.organization_id);

  IF NOT (document ?& ARRAY[
      'factType','id','organizationId','organizationAccreditationSequence',
      'previousEventRoot','commandHash',fact_hash_key,fact_root_key,'safety','auditEvent'
    ])
    OR document->>'factType' <> fact_type
    OR document->>'id' <> NEW.id
    OR document->>'organizationId' <> NEW.organization_id
    OR (document->>'organizationAccreditationSequence')::bigint <> NEW.organization_accreditation_sequence
    OR NEW.organization_accreditation_sequence <> expected_sequence
    OR document->>'previousEventRoot' <> NEW.previous_event_root
    OR NEW.previous_event_root <> expected_previous_root
    OR document->>'commandHash' <> NEW.command_hash
    OR document->>fact_hash_key <> row_fact_hash
    OR document->>fact_root_key <> row_fact_root
    OR document->'safety' <> organizations.organization_accreditation_safety_canonical()
    OR organizations.organization_accreditation_document_is_minimized(document) IS NOT TRUE
    OR effective_at <> date_trunc('milliseconds', effective_at)
    OR (latest_fact_time IS NOT NULL AND effective_at <= latest_fact_time)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_ACCREDITATION_COMMON_FACT_INVALID'
      USING ERRCODE = 'check_violation';
  END IF;

  IF fact_kind = 'application' THEN
    SELECT * INTO latest_application
    FROM organizations.organization_accreditation_application_facts
    WHERE organization_id = NEW.organization_id
    ORDER BY organization_accreditation_sequence DESC LIMIT 1;
    SELECT * INTO latest_decision
    FROM organizations.organization_accreditation_decision_facts
    WHERE organization_id = NEW.organization_id
    ORDER BY organization_accreditation_sequence DESC LIMIT 1;
    IF NEW.prior_decision_id IS NOT NULL THEN
      SELECT * INTO decision FROM organizations.organization_accreditation_decision_facts
      WHERE id = NEW.prior_decision_id;
      SELECT * INTO latest_control
      FROM organizations.organization_accreditation_control_facts
      WHERE decision_id = NEW.prior_decision_id
      ORDER BY organization_accreditation_sequence DESC LIMIT 1;
    END IF;
    IF document->>'applicationKind' <> NEW.application_kind
      OR document->>'profileRoot' <> NEW.profile_root
      OR document->'scope' <> to_jsonb(NEW.scope)
      OR organizations.organization_accreditation_scope_is_sorted_unique(document->'scope') IS NOT TRUE
      OR document->>'scopeRoot' <> NEW.scope_root
      OR NEW.scope_root <> organizations.organization_accreditation_scope_root(document)
      OR document->>'policyRoot' <> NEW.policy_root
      OR organizations.organization_accreditation_roots_are_sorted_unique(
        document->'evidenceEventRoots'
      ) IS NOT TRUE
      OR document->>'evidenceRoot' <> organizations.organization_accreditation_application_evidence_root(document)
      OR document->'submitter' <> NEW.submitter_snapshot
      OR document->'submitter'->>'id' <> NEW.submitter_id
      OR document->'submitter'->>'organizationId' <> NEW.submitter_organization_id
      OR NEW.submitter_organization_id <> NEW.organization_id
      OR organizations.organization_accreditation_subject_actor_is_current(
        NEW.submitter_snapshot, NEW.submitter_id, NEW.organization_id
      ) IS NOT TRUE
      OR NEW.profile_root <> NEW.submitter_snapshot->>'organizationRoot'
      OR NEW.profile_root <> (
        SELECT profile_hash FROM organizations.organizations WHERE id = NEW.organization_id
      )
      OR (document->>'submittedAt')::timestamptz <> NEW.submitted_at
      OR document->>'submittedAt' <> audit.iso8601_millis(NEW.submitted_at)
      OR (document->>'requestedValidUntil')::timestamptz <> NEW.requested_valid_until
      OR document->>'requestedValidUntil' <> audit.iso8601_millis(NEW.requested_valid_until)
      OR NEW.requested_valid_until <= NEW.submitted_at
      OR NEW.requested_valid_until - NEW.submitted_at > interval '366 days'
      OR NEW.command_hash <> organizations.organization_accreditation_application_command_hash(document)
      OR NEW.application_hash <> organizations.organization_accreditation_fact_hash(document, 'application')
      OR NEW.application_root <> organizations.organization_accreditation_fact_root(
        document, 'application', NEW.application_hash
      )
      OR (NEW.application_kind = 'initial' AND (
        latest_application.id IS NOT NULL OR NEW.prior_decision_id IS NOT NULL
        OR document ? 'priorDecisionId' OR document ? 'priorDecisionRoot'
      ))
      OR (NEW.application_kind = 'renewal' AND (
        decision.id IS NULL OR latest_decision.id <> decision.id
        OR latest_application.id IS NULL
        OR NOT EXISTS (
          SELECT 1 FROM organizations.organization_accreditation_decision_facts prior_application_decision
          WHERE prior_application_decision.application_id = latest_application.id
        )
        OR decision.decision <> 'approved'
        OR to_jsonb(decision.scope) <> document->'scope'
        OR latest_control.action = 'revoke'
        OR document->>'priorDecisionId' <> NEW.prior_decision_id
        OR document->>'priorDecisionRoot' <> NEW.prior_decision_root
        OR NEW.prior_decision_root <> decision.decision_root
      ))
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_ACCREDITATION_APPLICATION_FACT_INVALID'
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF fact_kind = 'review' THEN
    SELECT * INTO application FROM organizations.organization_accreditation_application_facts
    WHERE id = NEW.application_id;
    SELECT * INTO latest_application FROM organizations.organization_accreditation_application_facts
    WHERE organization_id = NEW.organization_id
    ORDER BY organization_accreditation_sequence DESC LIMIT 1;
    expected_action := CASE WHEN NEW.decision = 'accepted' THEN 'REASON' ELSE 'CHALLENGE' END;
    IF application.id IS NULL OR latest_application.id <> application.id
      OR EXISTS (SELECT 1 FROM organizations.organization_accreditation_review_facts WHERE application_id = NEW.application_id)
      OR EXISTS (SELECT 1 FROM organizations.organization_accreditation_decision_facts WHERE application_id = NEW.application_id)
      OR document->>'applicationId' <> NEW.application_id
      OR document->>'applicationRoot' <> NEW.application_root
      OR NEW.application_root <> application.application_root
      OR document->>'profileRoot' <> NEW.profile_root OR NEW.profile_root <> application.profile_root
      OR document->>'policyRoot' <> NEW.policy_root OR NEW.policy_root <> application.policy_root
      OR document->>'scopeRoot' <> NEW.scope_root OR NEW.scope_root <> application.scope_root
      OR document->>'decision' <> NEW.decision OR document->>'reasonCode' <> NEW.reason_code
      OR (NEW.decision = 'accepted' AND NEW.reason_code <> 'evidence_sufficient')
      OR (NEW.decision = 'rejected' AND NEW.reason_code = 'evidence_sufficient')
      OR document->'reviewer' <> NEW.reviewer_snapshot
      OR document->'reviewer'->>'id' <> NEW.reviewer_id
      OR document->'reviewer'->>'organizationId' <> NEW.reviewer_organization_id
      OR organizations.organization_accreditation_governance_actor_is_current(
        NEW.reviewer_snapshot, NEW.reviewer_id, NEW.organization_id,
        'organization:accreditation:review', ARRAY['admin','verifier','researcher']::text[], NEW.reviewed_at
      ) IS NOT TRUE
      OR NEW.reviewer_id = application.submitter_id
      OR NEW.reviewed_at <= application.submitted_at
      OR (document->>'reviewedAt')::timestamptz <> NEW.reviewed_at
      OR document->>'reviewedAt' <> audit.iso8601_millis(NEW.reviewed_at)
      OR organizations.organization_accreditation_roots_are_sorted_unique(document->'sourceEventRoots') IS NOT TRUE
      OR document->>'sourceRoot' <> organizations.organization_accreditation_review_source_root(document)
      OR NEW.command_hash <> organizations.organization_accreditation_review_command_hash(document)
      OR NEW.review_hash <> organizations.organization_accreditation_fact_hash(document, 'review')
      OR NEW.review_root <> organizations.organization_accreditation_fact_root(document, 'review', NEW.review_hash)
      OR length(btrim(document->>'rationale')) NOT BETWEEN 24 AND 4000
      OR length(btrim(document->>'conflictDisclosure')) NOT BETWEEN 24 AND 2000
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_ACCREDITATION_REVIEW_FACT_INVALID'
        USING ERRCODE = 'check_violation';
    END IF;

  ELSIF fact_kind = 'decision' THEN
    SELECT * INTO application FROM organizations.organization_accreditation_application_facts
    WHERE id = NEW.application_id;
    SELECT * INTO latest_application FROM organizations.organization_accreditation_application_facts
    WHERE organization_id = NEW.organization_id
    ORDER BY organization_accreditation_sequence DESC LIMIT 1;
    SELECT * INTO review FROM organizations.organization_accreditation_review_facts
    WHERE id = NEW.accepted_review_id;
    expected_action := CASE WHEN NEW.decision = 'approved' THEN 'FULFILL' ELSE 'CHALLENGE' END;
    IF application.id IS NULL OR latest_application.id <> application.id
      OR review.id IS NULL OR review.application_id <> application.id OR review.decision <> 'accepted'
      OR EXISTS (SELECT 1 FROM organizations.organization_accreditation_decision_facts WHERE application_id = NEW.application_id)
      OR document->>'applicationId' <> NEW.application_id
      OR document->>'applicationRoot' <> NEW.application_root OR NEW.application_root <> application.application_root
      OR document->>'acceptedReviewId' <> NEW.accepted_review_id
      OR document->>'acceptedReviewRoot' <> NEW.accepted_review_root OR NEW.accepted_review_root <> review.review_root
      OR document->>'profileRoot' <> NEW.profile_root OR NEW.profile_root <> application.profile_root
      OR document->>'policyRoot' <> NEW.policy_root OR NEW.policy_root <> application.policy_root
      OR document->'scope' <> to_jsonb(NEW.scope) OR to_jsonb(NEW.scope) <> to_jsonb(application.scope)
      OR organizations.organization_accreditation_scope_is_sorted_unique(document->'scope') IS NOT TRUE
      OR document->>'scopeRoot' <> NEW.scope_root OR NEW.scope_root <> application.scope_root
      OR document->>'decision' <> NEW.decision OR document->>'reasonCode' <> NEW.reason_code
      OR document->'decider' <> NEW.decider_snapshot
      OR document->'decider'->>'id' <> NEW.decider_id
      OR document->'decider'->>'organizationId' <> NEW.decider_organization_id
      OR organizations.organization_accreditation_governance_actor_is_current(
        NEW.decider_snapshot, NEW.decider_id, NEW.organization_id,
        'organization:accreditation:decide', ARRAY['admin','verifier']::text[], NEW.decided_at
      ) IS NOT TRUE
      OR NEW.decider_id IN (application.submitter_id, review.reviewer_id)
      OR NEW.decided_at <= review.reviewed_at
      OR (document->>'decidedAt')::timestamptz <> NEW.decided_at
      OR document->>'decidedAt' <> audit.iso8601_millis(NEW.decided_at)
      OR organizations.organization_accreditation_roots_are_sorted_unique(document->'sourceEventRoots') IS NOT TRUE
      OR document->>'sourceRoot' <> organizations.organization_accreditation_decision_source_root(document)
      OR (NEW.decision = 'approved' AND (
        NEW.reason_code <> 'requirements_satisfied'
        OR NEW.valid_from <> NEW.decided_at
        OR NEW.valid_until <> application.requested_valid_until
        OR NEW.valid_until <= NEW.valid_from
        OR NEW.valid_until - NEW.valid_from > interval '366 days'
        OR document->>'validFrom' <> audit.iso8601_millis(NEW.valid_from)
        OR document->>'validUntil' <> audit.iso8601_millis(NEW.valid_until)
      ))
      OR (NEW.decision = 'denied' AND (
        NEW.reason_code = 'requirements_satisfied'
        OR NEW.valid_from IS NOT NULL OR NEW.valid_until IS NOT NULL
        OR document->'validFrom' <> 'null'::jsonb OR document->'validUntil' <> 'null'::jsonb
      ))
      OR NEW.command_hash <> organizations.organization_accreditation_decision_command_hash(document)
      OR NEW.decision_hash <> organizations.organization_accreditation_fact_hash(document, 'decision')
      OR NEW.decision_root <> organizations.organization_accreditation_fact_root(document, 'decision', NEW.decision_hash)
      OR length(btrim(document->>'rationale')) NOT BETWEEN 24 AND 4000
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_ACCREDITATION_DECISION_FACT_INVALID'
        USING ERRCODE = 'check_violation';
    END IF;

  ELSE
    SELECT * INTO decision FROM organizations.organization_accreditation_decision_facts
    WHERE id = NEW.decision_id;
    SELECT * INTO latest_decision FROM organizations.organization_accreditation_decision_facts
    WHERE organization_id = NEW.organization_id
    ORDER BY organization_accreditation_sequence DESC LIMIT 1;
    SELECT * INTO latest_control FROM organizations.organization_accreditation_control_facts
    WHERE decision_id = NEW.decision_id
    ORDER BY organization_accreditation_sequence DESC LIMIT 1;
    IF NEW.previous_control_id IS NOT NULL THEN
      SELECT * INTO prior_control FROM organizations.organization_accreditation_control_facts
      WHERE id = NEW.previous_control_id;
    END IF;
    current_status := CASE
      WHEN latest_control.action = 'revoke' THEN 'revoked'
      WHEN latest_control.action = 'suspend' THEN 'suspended'
      WHEN NEW.controlled_at >= decision.valid_until THEN 'expired'
      WHEN NEW.controlled_at >= decision.valid_from THEN 'approved'
      ELSE 'pending'
    END;
    IF decision.id IS NULL OR latest_decision.id <> decision.id OR decision.decision <> 'approved'
      OR document->>'decisionId' <> NEW.decision_id
      OR document->>'decisionRoot' <> NEW.decision_root OR NEW.decision_root <> decision.decision_root
      OR document->>'action' <> NEW.action OR document->>'reasonCode' <> NEW.reason_code
      OR document->'governor' <> NEW.governor_snapshot
      OR document->'governor'->>'id' <> NEW.governor_id
      OR document->'governor'->>'organizationId' <> NEW.governor_organization_id
      OR organizations.organization_accreditation_governance_actor_is_current(
        NEW.governor_snapshot, NEW.governor_id, NEW.organization_id,
        'organization:accreditation:govern', ARRAY['owner','admin','verifier']::text[], NEW.controlled_at
      ) IS NOT TRUE
      OR NEW.controlled_at <= COALESCE(latest_control.controlled_at, decision.decided_at)
      OR (document->>'controlledAt')::timestamptz <> NEW.controlled_at
      OR document->>'controlledAt' <> audit.iso8601_millis(NEW.controlled_at)
      OR latest_control.action = 'revoke'
      OR (NEW.action = 'suspend' AND current_status <> 'approved')
      OR (NEW.action = 'revoke' AND current_status NOT IN ('approved','expired','suspended'))
      OR (latest_control.id IS NULL AND (
        NEW.previous_control_id IS NOT NULL OR document ? 'previousControlId' OR document ? 'previousControlRoot'
      ))
      OR (latest_control.id IS NOT NULL AND (
        prior_control.id IS NULL OR prior_control.id <> latest_control.id
        OR NEW.previous_control_id <> latest_control.id
        OR NEW.previous_control_root <> latest_control.control_root
        OR document->>'previousControlId' <> NEW.previous_control_id
        OR document->>'previousControlRoot' <> NEW.previous_control_root
      ))
      OR organizations.organization_accreditation_roots_are_sorted_unique(
        document->'evidenceEventRoots'
      ) IS NOT TRUE
      OR document->>'evidenceRoot' <> organizations.organization_accreditation_control_evidence_root(document)
      OR NEW.command_hash <> organizations.organization_accreditation_control_command_hash(document)
      OR NEW.control_hash <> organizations.organization_accreditation_fact_hash(document, 'control')
      OR NEW.control_root <> organizations.organization_accreditation_fact_root(document, 'control', NEW.control_hash)
      OR length(btrim(document->>'rationale')) NOT BETWEEN 24 AND 4000
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_ACCREDITATION_CONTROL_FACT_INVALID'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF organizations.organization_accreditation_event_is_valid(
    document, NEW.audit_event_root, expected_action, fact_type, expected_actor_id, effective_at
  ) IS NOT TRUE THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_ACCREDITATION_EVENT_INVALID'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organization_accreditation_application_validate
  ON organizations.organization_accreditation_application_facts;
CREATE TRIGGER organization_accreditation_application_validate
BEFORE INSERT ON organizations.organization_accreditation_application_facts
FOR EACH ROW EXECUTE FUNCTION organizations.validate_organization_accreditation_fact_insert();

DROP TRIGGER IF EXISTS organization_accreditation_review_validate
  ON organizations.organization_accreditation_review_facts;
CREATE TRIGGER organization_accreditation_review_validate
BEFORE INSERT ON organizations.organization_accreditation_review_facts
FOR EACH ROW EXECUTE FUNCTION organizations.validate_organization_accreditation_fact_insert();

DROP TRIGGER IF EXISTS organization_accreditation_decision_validate
  ON organizations.organization_accreditation_decision_facts;
CREATE TRIGGER organization_accreditation_decision_validate
BEFORE INSERT ON organizations.organization_accreditation_decision_facts
FOR EACH ROW EXECUTE FUNCTION organizations.validate_organization_accreditation_fact_insert();

DROP TRIGGER IF EXISTS organization_accreditation_control_validate
  ON organizations.organization_accreditation_control_facts;
CREATE TRIGGER organization_accreditation_control_validate
BEFORE INSERT ON organizations.organization_accreditation_control_facts
FOR EACH ROW EXECUTE FUNCTION organizations.validate_organization_accreditation_fact_insert();

ALTER TABLE organizations.organization_accreditation_application_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations.organization_accreditation_application_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_accreditation_application_tenant
  ON organizations.organization_accreditation_application_facts;
CREATE POLICY organization_accreditation_application_tenant
  ON organizations.organization_accreditation_application_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE organizations.organization_accreditation_review_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations.organization_accreditation_review_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_accreditation_review_tenant
  ON organizations.organization_accreditation_review_facts;
CREATE POLICY organization_accreditation_review_tenant
  ON organizations.organization_accreditation_review_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE organizations.organization_accreditation_decision_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations.organization_accreditation_decision_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_accreditation_decision_tenant
  ON organizations.organization_accreditation_decision_facts;
CREATE POLICY organization_accreditation_decision_tenant
  ON organizations.organization_accreditation_decision_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE organizations.organization_accreditation_control_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations.organization_accreditation_control_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_accreditation_control_tenant
  ON organizations.organization_accreditation_control_facts;
CREATE POLICY organization_accreditation_control_tenant
  ON organizations.organization_accreditation_control_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

DROP TRIGGER IF EXISTS organization_accreditation_application_no_update
  ON organizations.organization_accreditation_application_facts;
CREATE TRIGGER organization_accreditation_application_no_update
BEFORE UPDATE ON organizations.organization_accreditation_application_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_accreditation_application_no_delete
  ON organizations.organization_accreditation_application_facts;
CREATE TRIGGER organization_accreditation_application_no_delete
BEFORE DELETE ON organizations.organization_accreditation_application_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_accreditation_application_audit
  ON organizations.organization_accreditation_application_facts;
CREATE TRIGGER organization_accreditation_application_audit
AFTER INSERT OR UPDATE OR DELETE ON organizations.organization_accreditation_application_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS organization_accreditation_review_no_update
  ON organizations.organization_accreditation_review_facts;
CREATE TRIGGER organization_accreditation_review_no_update
BEFORE UPDATE ON organizations.organization_accreditation_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_accreditation_review_no_delete
  ON organizations.organization_accreditation_review_facts;
CREATE TRIGGER organization_accreditation_review_no_delete
BEFORE DELETE ON organizations.organization_accreditation_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_accreditation_review_audit
  ON organizations.organization_accreditation_review_facts;
CREATE TRIGGER organization_accreditation_review_audit
AFTER INSERT OR UPDATE OR DELETE ON organizations.organization_accreditation_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS organization_accreditation_decision_no_update
  ON organizations.organization_accreditation_decision_facts;
CREATE TRIGGER organization_accreditation_decision_no_update
BEFORE UPDATE ON organizations.organization_accreditation_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_accreditation_decision_no_delete
  ON organizations.organization_accreditation_decision_facts;
CREATE TRIGGER organization_accreditation_decision_no_delete
BEFORE DELETE ON organizations.organization_accreditation_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_accreditation_decision_audit
  ON organizations.organization_accreditation_decision_facts;
CREATE TRIGGER organization_accreditation_decision_audit
AFTER INSERT OR UPDATE OR DELETE ON organizations.organization_accreditation_decision_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS organization_accreditation_control_no_update
  ON organizations.organization_accreditation_control_facts;
CREATE TRIGGER organization_accreditation_control_no_update
BEFORE UPDATE ON organizations.organization_accreditation_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_accreditation_control_no_delete
  ON organizations.organization_accreditation_control_facts;
CREATE TRIGGER organization_accreditation_control_no_delete
BEFORE DELETE ON organizations.organization_accreditation_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS organization_accreditation_control_audit
  ON organizations.organization_accreditation_control_facts;
CREATE TRIGGER organization_accreditation_control_audit
AFTER INSERT OR UPDATE OR DELETE ON organizations.organization_accreditation_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

COMMIT;
