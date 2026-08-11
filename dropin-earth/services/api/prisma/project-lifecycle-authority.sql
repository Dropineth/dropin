-- Route-closed canonical project lifecycle authority.
-- Depends on canopyproof-os.sql and organization-accreditation-authority.sql.
-- This migration does not mount routes, move funds, distribute tokens, issue
-- credits, create tax offsets, establish ownership, or promise yield.

BEGIN;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_safety_canonical()
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
    'currentSourceReResolutionRequired', true,
    'independentHumanReviewRequired', true,
    'humanGovernanceRequiredForTransitions', true,
    'aiAdvisoryOnly', true,
    'adverseStateNeverFallsBack', true,
    'integerMeasurementsOnly', true,
    'noRawEvidenceOrCoordinates', true,
    'noMainnetFunds', true,
    'noAutomaticCanopyDistribution', true,
    'noPrivateKeyHandling', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notOwnershipRight', true,
    'notGuaranteedYield', true
  );
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_document_is_minimized(document jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT document::text !~* '"(accessToken|address|coordinates|email|geometry|latitude|longitude|password|phone|privateKey|private_key|rawDocument|rawEvidence|refreshToken|secret|seedPhrase|token|mnemonic)"[[:space:]]*:'
    AND document::text !~* '(certified[[:space:]]+carbon[[:space:]]+credit|carbon[-[:space:]]*tax[[:space:]]+offset|guaranteed[[:space:]]+(rwa[[:space:]]+)?yield|automatic[[:space:]]+canopy[[:space:]]+distribution|mainnet[[:space:]]+fund|private[[:space:]]+key)';
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_hash_array_is_sorted_unique(
  values_json jsonb,
  minimum_count integer,
  maximum_count integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE values_array text[];
BEGIN
  IF jsonb_typeof(values_json) <> 'array' THEN RETURN false; END IF;
  SELECT ARRAY(SELECT value FROM jsonb_array_elements_text(values_json) value) INTO values_array;
  RETURN cardinality(values_array) BETWEEN minimum_count AND maximum_count
    AND audit.is_sorted_unique_text_array(values_array)
    AND NOT EXISTS (SELECT 1 FROM unnest(values_array) value WHERE value !~ '^[0-9a-f]{64}$');
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_text_array_is_sorted_unique(
  values_json jsonb,
  minimum_count integer,
  maximum_count integer
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE values_array text[];
BEGIN
  IF jsonb_typeof(values_json) <> 'array' THEN RETURN false; END IF;
  SELECT ARRAY(SELECT value FROM jsonb_array_elements_text(values_json) value) INTO values_array;
  RETURN cardinality(values_array) BETWEEN minimum_count AND maximum_count
    AND audit.is_sorted_unique_text_array(values_array)
    AND NOT EXISTS (
      SELECT 1 FROM unnest(values_array) value WHERE length(btrim(value)) NOT BETWEEN 1 AND 512
    );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_baseline_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('domain', 'canopyproof/project-lifecycle/baseline/v1') ||
    (document - 'baselineRoot')
  );
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_intervention_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('domain', 'canopyproof/project-lifecycle/intervention/v1') ||
    (document - 'interventionRoot')
  );
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_monitoring_plan_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('domain', 'canopyproof/project-lifecycle/monitoring-plan/v1') ||
    (document - 'monitoringPlanRoot')
  );
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_source_root(document jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE source_domain text;
BEGIN
  source_domain := CASE document->>'kind'
    WHEN 'funding' THEN 'canopyproof/project-lifecycle/funding-source/v1'
    WHEN 'proof' THEN 'canopyproof/project-lifecycle/proof-source/v1'
    WHEN 'monitoring' THEN 'canopyproof/project-lifecycle/monitoring-source/v1'
    WHEN 'closure' THEN 'canopyproof/project-lifecycle/closure-source/v1'
    ELSE NULL
  END;
  IF source_domain IS NULL THEN RETURN NULL; END IF;
  RETURN audit.sha256_stable_json(
    jsonb_build_object('domain', source_domain) || (document - 'sourceAuthorityRoot')
  );
END;
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_registration_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'domain', 'canopyproof/project-lifecycle/registration-command/v1',
    'parsed', jsonb_build_object(
      'organizationId', document->'organizationId',
      'projectId', document->'projectId',
      'projectAuthorityRoot', document->'projectAuthorityRoot',
      'projectStatus', document->'projectStatus',
      'baseline', (document->'baseline') - 'baselineRoot'::text,
      'intervention', (document->'intervention') - 'interventionRoot'::text,
      'monitoringPlan', (document->'monitoringPlan') - 'monitoringPlanRoot'::text,
      'policyId', document->'policyId',
      'policyVersion', document->'policyVersion',
      'policyRoot', document->'policyRoot',
      'validFrom', document->'validFrom',
      'validUntil', document->'validUntil',
      'registeredAt', document->'registeredAt'
    ),
    'proposer', document->'proposer',
    'generation', document->'generation'
  ));
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_review_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'domain', 'canopyproof/project-lifecycle/review-command/v1',
    'parsed', jsonb_build_object(
      'registrationId', document->'registrationId',
      'registrationRoot', document->'registrationRoot',
      'decision', document->'decision',
      'reasonCode', document->'reasonCode',
      'rationale', document->'rationale',
      'reviewedAt', document->'reviewedAt'
    ),
    'reviewer', document->'reviewer',
    'generation', document->'generation'
  ));
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_transition_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'domain', 'canopyproof/project-lifecycle/transition-command/v1',
    'parsed', jsonb_build_object(
      'fromStage', document->'fromStage',
      'toStage', document->'toStage',
      'source', document->'source',
      'reasonCode', document->'reasonCode',
      'rationale', document->'rationale',
      'transitionedAt', document->'transitionedAt'
    ),
    'governor', document->'governor',
    'generation', document->'generation'
  ));
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_control_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'domain', 'canopyproof/project-lifecycle/control-command/v1',
    'parsed', jsonb_strip_nulls(jsonb_build_object(
      'action', document->'action',
      'reasonCode', document->'reasonCode',
      'reasonRoot', document->'reasonRoot',
      'rationale', document->'rationale',
      'restoresControlRoot', document->'restoresControlRoot',
      'restorationAuthorityRoot', document->'restorationAuthorityRoot',
      'controlledAt', document->'controlledAt'
    )),
    'governor', document->'governor',
    'generation', document->'generation',
    'underlyingStage', document->'underlyingStage'
  ));
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_fact_root(document jsonb, kind_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE domain_value text;
DECLARE root_key text;
BEGIN
  SELECT domain_name, key_name INTO domain_value, root_key
  FROM (VALUES
    ('registration', 'canopyproof/project-lifecycle/registration/v1', 'registrationRoot'),
    ('review', 'canopyproof/project-lifecycle/review/v1', 'reviewRoot'),
    ('transition', 'canopyproof/project-lifecycle/transition/v1', 'transitionRoot'),
    ('control', 'canopyproof/project-lifecycle/control/v1', 'controlRoot')
  ) mapping(kind_name, domain_name, key_name)
  WHERE kind_name = kind_value;
  IF domain_value IS NULL THEN RETURN NULL; END IF;
  RETURN audit.sha256_stable_json(
    jsonb_build_object('domain', domain_value) || (document - root_key - 'auditEvent'::text)
  );
END;
$$;

CREATE TABLE IF NOT EXISTS projects.project_lifecycle_registration_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  generation integer NOT NULL CHECK (generation > 0),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  project_authority_root text NOT NULL CHECK (project_authority_root ~ '^[0-9a-f]{64}$'),
  project_status text NOT NULL CHECK (project_status IN ('submitted','under_review','active','monitored')),
  policy_root text NOT NULL CHECK (policy_root ~ '^[0-9a-f]{64}$'),
  proposer_id text NOT NULL REFERENCES identity.participants(id),
  proposer_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  proposer_authority_root text NOT NULL CHECK (proposer_authority_root ~ '^[0-9a-f]{64}$'),
  registered_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL CHECK (valid_until > registered_at),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  registration_root text NOT NULL UNIQUE CHECK (registration_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL,
  UNIQUE (organization_id, project_id, generation),
  UNIQUE (organization_id, project_id, project_sequence)
);

CREATE TABLE IF NOT EXISTS projects.project_lifecycle_review_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  generation integer NOT NULL CHECK (generation > 0),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  registration_root text NOT NULL REFERENCES projects.project_lifecycle_registration_facts(registration_root),
  decision text NOT NULL CHECK (decision IN ('approve','reject')),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  reviewer_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  reviewer_authority_root text NOT NULL CHECK (reviewer_authority_root ~ '^[0-9a-f]{64}$'),
  reviewed_at timestamptz NOT NULL,
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  review_root text NOT NULL UNIQUE CHECK (review_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL,
  UNIQUE (registration_root),
  UNIQUE (organization_id, project_id, project_sequence)
);

CREATE TABLE IF NOT EXISTS projects.project_lifecycle_transition_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  generation integer NOT NULL CHECK (generation > 0),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  registration_root text NOT NULL REFERENCES projects.project_lifecycle_registration_facts(registration_root),
  review_root text NOT NULL REFERENCES projects.project_lifecycle_review_facts(review_root),
  from_stage text NOT NULL CHECK (from_stage IN ('PROPOSED','FUNDED','VERIFIED','LONG_TERM_OBSERVATION','CLOSED')),
  to_stage text NOT NULL CHECK (to_stage IN ('PROPOSED','FUNDED','VERIFIED','LONG_TERM_OBSERVATION','CLOSED')),
  source_kind text NOT NULL CHECK (source_kind IN ('funding','proof','monitoring','closure')),
  source_authority_root text NOT NULL CHECK (source_authority_root ~ '^[0-9a-f]{64}$'),
  governor_id text NOT NULL REFERENCES identity.participants(id),
  governor_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  governor_authority_root text NOT NULL CHECK (governor_authority_root ~ '^[0-9a-f]{64}$'),
  transitioned_at timestamptz NOT NULL,
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  transition_root text NOT NULL UNIQUE CHECK (transition_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL,
  UNIQUE (organization_id, project_id, project_sequence)
);

CREATE TABLE IF NOT EXISTS projects.project_lifecycle_control_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  generation integer NOT NULL CHECK (generation > 0),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  registration_root text NOT NULL REFERENCES projects.project_lifecycle_registration_facts(registration_root),
  action text NOT NULL CHECK (action IN ('challenge','suspend','restore','revoke')),
  underlying_stage text NOT NULL CHECK (underlying_stage IN ('PROPOSED','FUNDED','VERIFIED','LONG_TERM_OBSERVATION','CLOSED')),
  reason_root text NOT NULL CHECK (reason_root ~ '^[0-9a-f]{64}$'),
  control_root text NOT NULL UNIQUE CHECK (control_root ~ '^[0-9a-f]{64}$'),
  restores_control_root text REFERENCES projects.project_lifecycle_control_facts(control_root),
  restoration_authority_root text CHECK (restoration_authority_root ~ '^[0-9a-f]{64}$'),
  governor_id text NOT NULL REFERENCES identity.participants(id),
  governor_organization_id text NOT NULL REFERENCES organizations.organizations(id),
  governor_authority_root text NOT NULL CHECK (governor_authority_root ~ '^[0-9a-f]{64}$'),
  controlled_at timestamptz NOT NULL,
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL,
  CHECK (
    (action = 'restore' AND restores_control_root IS NOT NULL AND restoration_authority_root IS NOT NULL)
    OR (action <> 'restore' AND restores_control_root IS NULL AND restoration_authority_root IS NULL)
  ),
  UNIQUE (organization_id, project_id, project_sequence)
);

CREATE INDEX IF NOT EXISTS project_lifecycle_registration_stream
  ON projects.project_lifecycle_registration_facts (organization_id, project_id, project_sequence);
CREATE INDEX IF NOT EXISTS project_lifecycle_review_stream
  ON projects.project_lifecycle_review_facts (organization_id, project_id, project_sequence);
CREATE INDEX IF NOT EXISTS project_lifecycle_transition_stream
  ON projects.project_lifecycle_transition_facts (organization_id, project_id, project_sequence);
CREATE INDEX IF NOT EXISTS project_lifecycle_control_stream
  ON projects.project_lifecycle_control_facts (organization_id, project_id, project_sequence);

CREATE OR REPLACE FUNCTION projects.project_lifecycle_current_stage(
  organization_value text,
  project_value text
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  WITH facts AS (
    SELECT project_sequence, 'PENDING_REVIEW'::text AS stage
    FROM projects.project_lifecycle_registration_facts
    WHERE organization_id = organization_value AND project_id = project_value
    UNION ALL
    SELECT project_sequence, CASE decision WHEN 'approve' THEN 'PROPOSED' ELSE 'REJECTED' END
    FROM projects.project_lifecycle_review_facts
    WHERE organization_id = organization_value AND project_id = project_value
    UNION ALL
    SELECT project_sequence, to_stage
    FROM projects.project_lifecycle_transition_facts
    WHERE organization_id = organization_value AND project_id = project_value
    UNION ALL
    SELECT project_sequence, CASE action
      WHEN 'challenge' THEN 'CHALLENGED'
      WHEN 'suspend' THEN 'SUSPENDED'
      WHEN 'restore' THEN underlying_stage
      ELSE 'REVOKED'
    END
    FROM projects.project_lifecycle_control_facts
    WHERE organization_id = organization_value AND project_id = project_value
  )
  SELECT stage FROM facts ORDER BY project_sequence DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION projects.project_lifecycle_validate_semantic_event(
  document jsonb,
  stream_value text,
  kind_value text,
  fact_root_value text,
  actor_field text,
  timestamp_field text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE event_record audit.domain_events%ROWTYPE;
DECLARE actor_document jsonb := document->actor_field;
DECLARE expected_action text;
DECLARE expected_rationale text;
DECLARE expected_payload jsonb;
DECLARE expected_entity_type text := 'project_lifecycle_' || kind_value;
BEGIN
  SELECT * INTO event_record FROM audit.domain_events
  WHERE event_root = document->'auditEvent'->>'eventRoot';
  IF event_record.id IS NULL THEN RETURN false; END IF;
  expected_action := CASE
    WHEN kind_value = 'registration' THEN 'ASSERT'
    WHEN kind_value = 'review' AND document->>'decision' = 'reject' THEN 'CHALLENGE'
    WHEN kind_value = 'control' AND document->>'action' <> 'restore' THEN 'CHALLENGE'
    ELSE 'FULFILL'
  END;
  expected_rationale := CASE kind_value
    WHEN 'registration' THEN 'A bounded project lifecycle registration was proposed for independent review.'
    WHEN 'review' THEN 'An independent human reviewed the exact project lifecycle registration.'
    WHEN 'transition' THEN 'An independent human governed a source-bound canonical project lifecycle transition.'
    ELSE 'An independent human applied an append-only project lifecycle control.'
  END;
  expected_payload := CASE kind_value
    WHEN 'registration' THEN jsonb_build_object(
      'registrationRoot', fact_root_value,
      'projectAuthorityRoot', document->'projectAuthorityRoot',
      'generation', document->'generation'
    )
    WHEN 'review' THEN jsonb_build_object(
      'registrationRoot', document->'registrationRoot',
      'reviewRoot', fact_root_value,
      'decision', document->'decision'
    )
    WHEN 'transition' THEN jsonb_build_object(
      'fromStage', document->'fromStage',
      'toStage', document->'toStage',
      'transitionRoot', fact_root_value
    )
    ELSE jsonb_build_object(
      'action', document->'action',
      'reasonRoot', document->'reasonRoot',
      'controlRoot', fact_root_value
    )
  END;
  RETURN event_record.stream_id = stream_value
    AND event_record.sequence_no = (document->>'projectSequence')::bigint
    AND event_record.action = expected_action
    AND event_record.actor_id = actor_document->>'id'
    AND event_record.entity_type = expected_entity_type
    AND event_record.entity_id = document->>'id'
    AND event_record.previous_root = document->>'previousEventRoot'
    AND event_record.payload_hash = audit.sha256_stable_json(expected_payload)
    AND event_record.created_at = (document->>timestamp_field)::timestamptz
    AND event_record.rationale = expected_rationale
    AND document->'auditEvent' = jsonb_build_object(
      'id', event_record.id,
      'action', event_record.action,
      'actor', event_record.actor_id,
      'entityType', event_record.entity_type,
      'entityId', event_record.entity_id,
      'previousRoot', event_record.previous_root,
      'payloadHash', event_record.payload_hash,
      'eventRoot', event_record.event_root,
      'createdAt', audit.iso8601_millis(event_record.created_at),
      'rationale', event_record.rationale
    );
EXCEPTION WHEN OTHERS THEN
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION projects.validate_project_lifecycle_fact_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE row_document jsonb := to_jsonb(NEW);
DECLARE document jsonb := NEW.fact_record;
DECLARE kind_value text;
DECLARE actor_field text;
DECLARE timestamp_field text;
DECLARE fact_root_key text;
DECLARE fact_root_value text;
DECLARE expected_command_hash text;
DECLARE expected_stage text;
DECLARE current_stage text;
DECLARE stream_value text;
DECLARE registration_record projects.project_lifecycle_registration_facts%ROWTYPE;
DECLARE review_record projects.project_lifecycle_review_facts%ROWTYPE;
DECLARE adverse_record projects.project_lifecycle_control_facts%ROWTYPE;
DECLARE project_authority record;
BEGIN
  kind_value := CASE TG_TABLE_NAME
    WHEN 'project_lifecycle_registration_facts' THEN 'registration'
    WHEN 'project_lifecycle_review_facts' THEN 'review'
    WHEN 'project_lifecycle_transition_facts' THEN 'transition'
    WHEN 'project_lifecycle_control_facts' THEN 'control'
    ELSE NULL
  END;
  actor_field := CASE kind_value
    WHEN 'registration' THEN 'proposer'
    WHEN 'review' THEN 'reviewer'
    ELSE 'governor'
  END;
  timestamp_field := CASE kind_value
    WHEN 'registration' THEN 'registeredAt'
    WHEN 'review' THEN 'reviewedAt'
    WHEN 'transition' THEN 'transitionedAt'
    ELSE 'controlledAt'
  END;
  fact_root_key := CASE kind_value
    WHEN 'registration' THEN 'registrationRoot'
    WHEN 'review' THEN 'reviewRoot'
    WHEN 'transition' THEN 'transitionRoot'
    ELSE 'controlRoot'
  END;
  fact_root_value := document->>fact_root_key;
  stream_value := 'project-lifecycle:' || NEW.organization_id || ':' || NEW.project_id;
  expected_command_hash := CASE kind_value
    WHEN 'registration' THEN projects.project_lifecycle_registration_command_hash(document)
    WHEN 'review' THEN projects.project_lifecycle_review_command_hash(document)
    WHEN 'transition' THEN projects.project_lifecycle_transition_command_hash(document)
    ELSE projects.project_lifecycle_control_command_hash(document)
  END;

  IF kind_value IS NULL
    OR jsonb_typeof(document) <> 'object'
    OR document->>'factType' <> 'project_lifecycle_' || kind_value
    OR document->>'schemaVersion' <> 'canopyproof.project-lifecycle.v1'
    OR document->>'id' <> NEW.id
    OR document->>'organizationId' <> NEW.organization_id
    OR document->>'projectId' <> NEW.project_id
    OR (document->>'generation')::integer <> NEW.generation
    OR (document->>'projectSequence')::bigint <> NEW.project_sequence
    OR document->>'previousEventRoot' <> NEW.previous_event_root
    OR document->>'commandHash' <> NEW.command_hash
    OR document->'auditEvent'->>'eventRoot' <> NEW.audit_event_root
    OR document->'safety' <> projects.project_lifecycle_safety_canonical()
    OR projects.project_lifecycle_document_is_minimized(document) IS NOT TRUE
    OR fact_root_value !~ '^[0-9a-f]{64}$'
    OR fact_root_value <> row_document->>lower(kind_value || '_root')
    OR fact_root_value <> projects.project_lifecycle_fact_root(document, kind_value)
    OR NEW.command_hash <> expected_command_hash
    OR NEW.id <> 'cp_project_lifecycle_' || kind_value || '_' || substring(expected_command_hash FROM 1 FOR 24)
    OR document->>timestamp_field <> audit.iso8601_millis((document->>timestamp_field)::timestamptz)
    OR projects.project_lifecycle_validate_semantic_event(
      document, stream_value, kind_value, fact_root_value, actor_field, timestamp_field
    ) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_%_FACT_INVALID', upper(kind_value);
  END IF;

  current_stage := projects.project_lifecycle_current_stage(NEW.organization_id, NEW.project_id);

  IF kind_value = 'registration' THEN
    SELECT * INTO project_authority FROM projects.current_authority(NEW.project_id);
    IF project_authority.status IS NULL
      OR project_authority.status <> NEW.project_status
      OR project_authority.project_root <> NEW.project_authority_root
      OR document->>'projectAuthorityRoot' <> NEW.project_authority_root
      OR document->>'projectStatus' <> NEW.project_status
      OR document->>'policyRoot' <> NEW.policy_root
      OR document->'baseline'->>'baselineRoot' <>
        projects.project_lifecycle_baseline_root(document->'baseline')
      OR document->'intervention'->>'interventionRoot' <>
        projects.project_lifecycle_intervention_root(document->'intervention')
      OR document->'monitoringPlan'->>'monitoringPlanRoot' <>
        projects.project_lifecycle_monitoring_plan_root(document->'monitoringPlan')
      OR projects.project_lifecycle_hash_array_is_sorted_unique(
        document->'baseline'->'evidenceRoots', 1, 512
      ) IS NOT TRUE
      OR projects.project_lifecycle_hash_array_is_sorted_unique(
        document->'baseline'->'satelliteRoots', 0, 256
      ) IS NOT TRUE
      OR projects.project_lifecycle_hash_array_is_sorted_unique(
        document->'baseline'->'metricRoots', 0, 256
      ) IS NOT TRUE
      OR projects.project_lifecycle_text_array_is_sorted_unique(
        document->'monitoringPlan'->'indicatorCodes', 1, 256
      ) IS NOT TRUE
      OR projects.project_lifecycle_text_array_is_sorted_unique(
        document->'monitoringPlan'->'evidenceRequirementCodes', 1, 256
      ) IS NOT TRUE
      OR organizations.organization_accreditation_subject_actor_is_current(
        document->'proposer', NEW.proposer_id, NEW.organization_id
      ) IS NOT TRUE
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_REGISTRATION_SOURCE_INVALID';
    END IF;
    IF current_stage IS NOT NULL THEN
      SELECT * INTO registration_record
      FROM projects.project_lifecycle_registration_facts
      WHERE organization_id = NEW.organization_id AND project_id = NEW.project_id
      ORDER BY generation DESC LIMIT 1;
      IF current_stage <> 'REJECTED'
        AND NOT (
          current_stage IN ('PENDING_REVIEW','PROPOSED','FUNDED','VERIFIED','LONG_TERM_OBSERVATION')
          AND NEW.registered_at >= registration_record.valid_until
        )
      THEN
        RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_GENERATION_REPLACEMENT_INVALID';
      END IF;
    END IF;
    IF NEW.generation <> COALESCE((
      SELECT max(generation) + 1 FROM projects.project_lifecycle_registration_facts
      WHERE organization_id = NEW.organization_id AND project_id = NEW.project_id
    ), 1) THEN
      RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_GENERATION_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO STRICT registration_record
  FROM projects.project_lifecycle_registration_facts
  WHERE registration_root = NEW.registration_root;
  IF registration_record.organization_id <> NEW.organization_id
    OR registration_record.project_id <> NEW.project_id
    OR registration_record.generation <> NEW.generation
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_REGISTRATION_LINEAGE_INVALID';
  END IF;

  IF kind_value = 'review' THEN
    IF current_stage <> 'PENDING_REVIEW'
      OR NEW.reviewed_at >= registration_record.valid_until
      OR document->>'registrationId' <> registration_record.id
      OR document->>'registrationRoot' <> registration_record.registration_root
      OR document->'reviewer'->>'id' = registration_record.proposer_id
      OR organizations.organization_accreditation_governance_actor_is_current(
        document->'reviewer', NEW.reviewer_id, NEW.organization_id,
        'projects:lifecycle_review', ARRAY['owner','admin','verifier','researcher']::text[], NEW.reviewed_at
      ) IS NOT TRUE
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_REVIEW_AUTHORITY_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  SELECT * INTO STRICT review_record
  FROM projects.project_lifecycle_review_facts
  WHERE registration_root = NEW.registration_root;
  IF review_record.decision <> 'approve' THEN
    RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_APPROVED_REVIEW_REQUIRED';
  END IF;

  IF kind_value = 'transition' THEN
    expected_stage := CASE NEW.from_stage
      WHEN 'PROPOSED' THEN 'FUNDED'
      WHEN 'FUNDED' THEN 'VERIFIED'
      WHEN 'VERIFIED' THEN 'LONG_TERM_OBSERVATION'
      WHEN 'LONG_TERM_OBSERVATION' THEN 'CLOSED'
      ELSE NULL
    END;
    IF current_stage <> NEW.from_stage
      OR NEW.to_stage <> expected_stage
      OR NEW.transitioned_at >= registration_record.valid_until
      OR NEW.review_root <> review_record.review_root
      OR NEW.source_kind <> (CASE NEW.to_stage
        WHEN 'FUNDED' THEN 'funding'
        WHEN 'VERIFIED' THEN 'proof'
        WHEN 'LONG_TERM_OBSERVATION' THEN 'monitoring'
        WHEN 'CLOSED' THEN 'closure'
        ELSE NULL
      END)
      OR NEW.source_authority_root <> projects.project_lifecycle_source_root(document->'source')
      OR document->'source'->>'resolvedAt' <> audit.iso8601_millis(NEW.transitioned_at)
      OR NEW.governor_organization_id IN (
        registration_record.proposer_organization_id, review_record.reviewer_organization_id
      )
      OR NEW.governor_id IN (registration_record.proposer_id, review_record.reviewer_id)
      OR organizations.organization_accreditation_governance_actor_is_current(
        document->'governor', NEW.governor_id, NEW.organization_id,
        'projects:lifecycle_govern', ARRAY['owner','admin','verifier']::text[], NEW.transitioned_at
      ) IS NOT TRUE
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_TRANSITION_AUTHORITY_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.governor_organization_id IN (
      registration_record.proposer_organization_id, review_record.reviewer_organization_id
    )
    OR NEW.governor_id IN (registration_record.proposer_id, review_record.reviewer_id)
    OR organizations.organization_accreditation_governance_actor_is_current(
      document->'governor', NEW.governor_id, NEW.organization_id,
      'projects:lifecycle_govern', ARRAY['owner','admin','verifier']::text[], NEW.controlled_at
    ) IS NOT TRUE
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_CONTROL_AUTHORITY_INVALID';
  END IF;
  IF NEW.action IN ('challenge','suspend') AND current_stage NOT IN (
    'PROPOSED','FUNDED','VERIFIED','LONG_TERM_OBSERVATION'
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_ADVERSE_CONTROL_INVALID';
  ELSIF NEW.action = 'restore' THEN
    SELECT * INTO adverse_record
    FROM projects.project_lifecycle_control_facts
    WHERE organization_id = NEW.organization_id AND project_id = NEW.project_id
      AND action IN ('challenge','suspend')
    ORDER BY project_sequence DESC LIMIT 1;
    IF current_stage NOT IN ('CHALLENGED','SUSPENDED')
      OR adverse_record.id IS NULL
      OR NEW.restores_control_root <> adverse_record.control_root
      OR NEW.governor_id = adverse_record.governor_id
      OR NEW.governor_organization_id = adverse_record.governor_organization_id
    THEN
      RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_RESTORE_INVALID';
    END IF;
  ELSIF NEW.action = 'revoke' AND current_stage IN ('CLOSED','REVOKED','EXPIRED') THEN
    RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_REVOCATION_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_lifecycle_registration_validate ON projects.project_lifecycle_registration_facts;
CREATE TRIGGER project_lifecycle_registration_validate
BEFORE INSERT ON projects.project_lifecycle_registration_facts
FOR EACH ROW EXECUTE FUNCTION projects.validate_project_lifecycle_fact_insert();

DROP TRIGGER IF EXISTS project_lifecycle_review_validate ON projects.project_lifecycle_review_facts;
CREATE TRIGGER project_lifecycle_review_validate
BEFORE INSERT ON projects.project_lifecycle_review_facts
FOR EACH ROW EXECUTE FUNCTION projects.validate_project_lifecycle_fact_insert();

DROP TRIGGER IF EXISTS project_lifecycle_transition_validate ON projects.project_lifecycle_transition_facts;
CREATE TRIGGER project_lifecycle_transition_validate
BEFORE INSERT ON projects.project_lifecycle_transition_facts
FOR EACH ROW EXECUTE FUNCTION projects.validate_project_lifecycle_fact_insert();

DROP TRIGGER IF EXISTS project_lifecycle_control_validate ON projects.project_lifecycle_control_facts;
CREATE TRIGGER project_lifecycle_control_validate
BEFORE INSERT ON projects.project_lifecycle_control_facts
FOR EACH ROW EXECUTE FUNCTION projects.validate_project_lifecycle_fact_insert();

DO $$
DECLARE relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'project_lifecycle_registration_facts',
    'project_lifecycle_review_facts',
    'project_lifecycle_transition_facts',
    'project_lifecycle_control_facts'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_no_update ON projects.%I', relation_name, relation_name);
    EXECUTE format(
      'CREATE TRIGGER %I_no_update BEFORE UPDATE ON projects.%I FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete()',
      relation_name, relation_name
    );
    EXECUTE format('DROP TRIGGER IF EXISTS %I_no_delete ON projects.%I', relation_name, relation_name);
    EXECUTE format(
      'CREATE TRIGGER %I_no_delete BEFORE DELETE ON projects.%I FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete()',
      relation_name, relation_name
    );
  END LOOP;
END;
$$;

ALTER TABLE projects.project_lifecycle_registration_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects.project_lifecycle_registration_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_lifecycle_registration_tenant ON projects.project_lifecycle_registration_facts;
CREATE POLICY project_lifecycle_registration_tenant ON projects.project_lifecycle_registration_facts
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE projects.project_lifecycle_review_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects.project_lifecycle_review_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_lifecycle_review_tenant ON projects.project_lifecycle_review_facts;
CREATE POLICY project_lifecycle_review_tenant ON projects.project_lifecycle_review_facts
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE projects.project_lifecycle_transition_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects.project_lifecycle_transition_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_lifecycle_transition_tenant ON projects.project_lifecycle_transition_facts;
CREATE POLICY project_lifecycle_transition_tenant ON projects.project_lifecycle_transition_facts
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

ALTER TABLE projects.project_lifecycle_control_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects.project_lifecycle_control_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS project_lifecycle_control_tenant ON projects.project_lifecycle_control_facts;
CREATE POLICY project_lifecycle_control_tenant ON projects.project_lifecycle_control_facts
  USING (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));

COMMIT;
