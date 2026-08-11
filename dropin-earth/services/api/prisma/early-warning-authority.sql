-- Route-closed canonical environmental early-warning publication authority.
-- Depends on canopyproof-os.sql. This migration declares no emergency,
-- invokes no live feed, sends no notification, and creates no financial path.

BEGIN;

CREATE OR REPLACE FUNCTION impact.early_warning_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'routeMounted', false,
    'schedulerMounted', false,
    'productionActivationEnabled', false,
    'liveFeedEnabled', false,
    'notificationDeliveryEnabled', false,
    'emergencyDeclarationEnabled', false,
    'advisoryOnly', true,
    'appendOnly', true,
    'exactRetryRequired', true,
    'currentSourceReResolutionRequired', true,
    'threeIndependentAccreditedHumansRequired', true,
    'machineCannotReviewPublishOrControl', true,
    'integerScaledIndicatorsOnly', true,
    'rawCoordinatesAndPrivateContactDataForbidden', true,
    'adverseStateNeverFallsBack', true,
    'noSafetyOrForecastGuarantee', true,
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

CREATE OR REPLACE FUNCTION impact.early_warning_json_has_exact_keys(
  document jsonb,
  expected_keys text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_typeof(document) = 'object'
    AND (SELECT count(*) FROM jsonb_object_keys(document)) = cardinality(expected_keys)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_object_keys(document) AS key
      WHERE NOT (key = ANY(expected_keys))
    );
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_document_is_minimized(document jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT document::text !~* '"(accessToken|address|coordinates|email|geometry|latitude|longitude|password|phone|privateKey|refreshToken|secret)"[[:space:]]*:';
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_candidate_text_is_safe(candidate jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT concat_ws(' ',
      candidate->>'organizationPublicId', candidate->>'scopePublicId',
      candidate->>'advisoryCode', candidate->>'summary',
      COALESCE((SELECT string_agg(source->>'sourceId', ' ')
        FROM jsonb_array_elements(candidate->'sources') source), '')
    ) !~* '(official[[:space:]]+emergency|emergency[[:space:]]+declaration|evacuat(e|ion)[[:space:]]+now|guaranteed[[:space:]]+(safe|safety|forecast|accuracy|yield)|certified[[:space:]]+carbon[[:space:]]+credit|carbon[-[:space:]]*tax[[:space:]]+offset|private[[:space:]]+key|mainnet[[:space:]]+fund|automatic[[:space:]]+canopy[[:space:]]+distribution|[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,})';
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_source_member_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-early-warning-source-member-v1') ||
    (document - 'memberRoot')
  );
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_indicator_member_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-early-warning-indicator-member-v1') ||
    (document - 'memberRoot')
  );
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_member_root(members jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  leaves text[];
BEGIN
  IF jsonb_typeof(members) <> 'array' OR jsonb_array_length(members) = 0 THEN
    RETURN NULL;
  END IF;
  SELECT ARRAY(
    SELECT member_root
    FROM jsonb_array_elements_text(members) member_root
    ORDER BY member_root
  ) INTO leaves;
  RETURN audit.merkle_root(leaves);
END;
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_source_authority_root(candidate jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-early-warning-source-authority-v1',
    'organizationId', candidate->'organizationId',
    'scopeType', candidate->'scopeType',
    'scopeId', candidate->'scopeId',
    'scopeAuthorityRoot', candidate->'scopeAuthorityRoot',
    'riskClass', candidate->'riskClass',
    'sourceMemberRoot', candidate->'sourceMemberRoot',
    'indicatorMemberRoot', candidate->'indicatorMemberRoot',
    'policyId', candidate->'policyId',
    'policyVersion', candidate->'policyVersion',
    'policyRoot', candidate->'policyRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_candidate_root(candidate jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-early-warning-candidate-v1') ||
    (candidate - 'candidateRoot')
  );
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_review_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-early-warning-review-command-v1',
    'candidateRoot', document->'candidate'->'candidateRoot',
    'reviewKind', document->'reviewKind',
    'decision', document->'decision',
    'reasonCode', document->'reasonCode',
    'rationale', document->'rationale',
    'reviewerAuthorityRoot', document->'reviewer'->'authorityRoot',
    'reviewedAt', document->'reviewedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_review_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-early-warning-review-v1') ||
    (document - ARRAY['reviewRoot','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_projection_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-early-warning-public-projection-v1') ||
    (document - 'projectionRoot')
  );
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_publication_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-early-warning-publication-command-v1',
    'candidateRoot', document->'candidate'->'candidateRoot',
    'scientificReviewRoot', document->'scientificReviewRoot',
    'operationalReviewRoot', document->'operationalReviewRoot',
    'publisherAuthorityRoot', document->'publisher'->'authorityRoot',
    'predecessorPublicationRoot', document->'predecessorPublicationRoot',
    'publishedAt', document->'publishedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_publication_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-early-warning-publication-v1') ||
    (document - ARRAY['publicationRoot','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_control_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-early-warning-control-command-v1',
    'publicationId', document->'publicationId',
    'publicationRoot', document->'publicationRoot',
    'projectionRoot', document->'projectionRoot',
    'action', document->'action',
    'reasonCode', document->'reasonCode',
    'rationale', document->'rationale',
    'governorAuthorityRoot', document->'governor'->'authorityRoot',
    'controlledAt', document->'controlledAt'
  ));
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_control_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-early-warning-control-v1') ||
    (document - ARRAY['controlRoot','auditEvent']::text[])
  );
$$;

CREATE TABLE IF NOT EXISTS impact.early_warning_review_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  scope_id text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('project','region')),
  risk_class text NOT NULL CHECK (risk_class IN ('drought','wildfire','flooding','ecosystem_degradation')),
  candidate_root text NOT NULL CHECK (candidate_root ~ '^[0-9a-f]{64}$'),
  source_authority_root text NOT NULL CHECK (source_authority_root ~ '^[0-9a-f]{64}$'),
  review_kind text NOT NULL CHECK (review_kind IN ('scientific','operational')),
  decision text NOT NULL CHECK (decision IN ('accepted','rejected')),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  reviewer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(reviewer_snapshot) = 'object'),
  reviewed_at timestamptz NOT NULL,
  review_root text NOT NULL UNIQUE CHECK (review_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (candidate_root, review_kind)
);

CREATE TABLE IF NOT EXISTS impact.early_warning_publication_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  scope_id text NOT NULL,
  scope_type text NOT NULL CHECK (scope_type IN ('project','region')),
  risk_class text NOT NULL CHECK (risk_class IN ('drought','wildfire','flooding','ecosystem_degradation')),
  candidate_root text NOT NULL UNIQUE CHECK (candidate_root ~ '^[0-9a-f]{64}$'),
  source_authority_root text NOT NULL CHECK (source_authority_root ~ '^[0-9a-f]{64}$'),
  scientific_review_id text NOT NULL UNIQUE REFERENCES impact.early_warning_review_facts(id),
  operational_review_id text NOT NULL UNIQUE REFERENCES impact.early_warning_review_facts(id),
  publisher_id text NOT NULL REFERENCES identity.participants(id),
  publisher_snapshot jsonb NOT NULL CHECK (jsonb_typeof(publisher_snapshot) = 'object'),
  predecessor_publication_root text CHECK (predecessor_publication_root ~ '^[0-9a-f]{64}$'),
  published_at timestamptz NOT NULL,
  valid_until timestamptz NOT NULL,
  event_sequence bigint NOT NULL CHECK (event_sequence > 0),
  projection_root text NOT NULL UNIQUE CHECK (projection_root ~ '^[0-9a-f]{64}$'),
  publication_root text NOT NULL UNIQUE CHECK (publication_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object')
);

CREATE TABLE IF NOT EXISTS impact.early_warning_control_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  scope_id text NOT NULL,
  risk_class text NOT NULL CHECK (risk_class IN ('drought','wildfire','flooding','ecosystem_degradation')),
  publication_id text NOT NULL UNIQUE REFERENCES impact.early_warning_publication_facts(id),
  publication_root text NOT NULL CHECK (publication_root ~ '^[0-9a-f]{64}$'),
  projection_root text NOT NULL CHECK (projection_root ~ '^[0-9a-f]{64}$'),
  action text NOT NULL CHECK (action IN ('challenge','withdraw')),
  reason_code text NOT NULL CHECK (reason_code IN (
    'source_invalidated','scientific_dispute','operational_context_changed',
    'scope_authority_changed','policy_superseded','governance_order','legal_hold'
  )),
  governor_id text NOT NULL REFERENCES identity.participants(id),
  governor_snapshot jsonb NOT NULL CHECK (jsonb_typeof(governor_snapshot) = 'object'),
  controlled_at timestamptz NOT NULL,
  event_sequence bigint NOT NULL CHECK (event_sequence > 0),
  control_root text NOT NULL UNIQUE CHECK (control_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS early_warning_publication_predecessor_no_fork
  ON impact.early_warning_publication_facts (
    organization_id, scope_id, risk_class,
    COALESCE(predecessor_publication_root, 'GENESIS')
  );
CREATE UNIQUE INDEX IF NOT EXISTS early_warning_publication_event_sequence
  ON impact.early_warning_publication_facts (
    organization_id, scope_id, risk_class, event_sequence
  );
CREATE UNIQUE INDEX IF NOT EXISTS early_warning_control_event_sequence
  ON impact.early_warning_control_facts (
    organization_id, scope_id, risk_class, event_sequence
  );
CREATE INDEX IF NOT EXISTS early_warning_reviews_scope_time
  ON impact.early_warning_review_facts (
    organization_id, scope_id, risk_class, reviewed_at DESC, id
  );
CREATE INDEX IF NOT EXISTS early_warning_publications_scope_time
  ON impact.early_warning_publication_facts (
    organization_id, scope_id, risk_class, published_at DESC, id
  );
CREATE INDEX IF NOT EXISTS early_warning_controls_scope_time
  ON impact.early_warning_control_facts (
    organization_id, scope_id, risk_class, controlled_at DESC, id
  );

CREATE OR REPLACE FUNCTION impact.early_warning_human_actor_is_current(
  actor_snapshot jsonb,
  actor_id text,
  organization_id text,
  required_scope text,
  allowed_roles text[]
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
AS $$
  SELECT verification.actor_snapshot_is_valid(
      actor_snapshot, actor_id, organization_id, 'human', allowed_roles
    )
    AND actor_snapshot->>'membershipStatus' = 'active'
    AND actor_snapshot->>'accreditationStatus' = 'approved'
    AND actor_snapshot->'accreditationScope' ? required_scope;
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_preparer_is_current(
  actor_snapshot jsonb,
  actor_id text,
  organization_id text
)
RETURNS boolean
LANGUAGE sql
STABLE
STRICT
AS $$
  SELECT (
    actor_snapshot->>'participantType' = 'agent'
    AND verification.actor_snapshot_is_valid(
      actor_snapshot, actor_id, organization_id, 'agent', ARRAY['agent']::text[]
    )
  ) OR (
    actor_snapshot->>'participantType' = 'human'
    AND impact.early_warning_human_actor_is_current(
      actor_snapshot, actor_id, organization_id, 'risk:signal:prepare',
      ARRAY['owner','admin','verifier','researcher']::text[]
    )
  );
$$;

CREATE OR REPLACE FUNCTION impact.validate_early_warning_candidate(candidate jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  source jsonb;
  indicator jsonb;
  previous_source_key text := NULL;
  previous_indicator_key text := NULL;
  source_key text;
  source_roots jsonb := '[]'::jsonb;
  indicator_roots jsonb := '[]'::jsonb;
  intended_audiences text[];
  breached_count integer := 0;
  expected_breach boolean;
BEGIN
  IF NOT impact.early_warning_json_has_exact_keys(candidate, ARRAY[
      'schemaVersion','organizationId','organizationPublicId','scopeType','scopeId',
      'scopePublicId','scopeAuthorityRoot','riskClass','severity','confidenceBps',
      'advisoryCode','summary','intendedAudiences','sources','indicators',
      'sourceMemberRoot','indicatorMemberRoot','sourceAuthorityRoot',
      'observationStart','observationEnd','policyId','policyVersion','policyRoot',
      'validFrom','validUntil','preparedAt','preparer','safety','candidateRoot'
    ])
    OR candidate->>'schemaVersion' <> 'canopyproof.early-warning.v1'
    OR candidate->>'scopeType' NOT IN ('project','region')
    OR candidate->>'riskClass' NOT IN ('drought','wildfire','flooding','ecosystem_degradation')
    OR candidate->>'severity' NOT IN ('low','medium','high','critical')
    OR candidate->>'scopeAuthorityRoot' !~ '^[0-9a-f]{64}$'
    OR candidate->>'policyRoot' !~ '^[0-9a-f]{64}$'
    OR jsonb_typeof(candidate->'confidenceBps') <> 'number'
    OR (candidate->>'confidenceBps')::numeric <> trunc((candidate->>'confidenceBps')::numeric)
    OR (candidate->>'confidenceBps')::numeric NOT BETWEEN 0 AND 10000
    OR length(btrim(candidate->>'summary')) NOT BETWEEN 12 AND 280
    OR jsonb_typeof(candidate->'intendedAudiences') <> 'array'
    OR jsonb_array_length(candidate->'intendedAudiences') NOT BETWEEN 1 AND 5
    OR jsonb_typeof(candidate->'sources') <> 'array'
    OR jsonb_array_length(candidate->'sources') NOT BETWEEN 1 AND 64
    OR jsonb_typeof(candidate->'indicators') <> 'array'
    OR jsonb_array_length(candidate->'indicators') NOT BETWEEN 1 AND 64
    OR (candidate->>'observationStart')::timestamptz > (candidate->>'observationEnd')::timestamptz
    OR (candidate->>'observationEnd')::timestamptz > (candidate->>'preparedAt')::timestamptz
    OR (candidate->>'preparedAt')::timestamptz > (candidate->>'validFrom')::timestamptz
    OR (candidate->>'validFrom')::timestamptz >= (candidate->>'validUntil')::timestamptz
    OR candidate->'safety' <> impact.early_warning_safety_canonical()
    OR NOT impact.early_warning_document_is_minimized(candidate)
    OR NOT impact.early_warning_candidate_text_is_safe(candidate)
  THEN
    RETURN FALSE;
  END IF;

  SELECT ARRAY(
    SELECT value FROM jsonb_array_elements_text(candidate->'intendedAudiences') value
  ) INTO intended_audiences;
  IF NOT audit.is_sorted_unique_text_array(intended_audiences)
    OR EXISTS (
      SELECT 1 FROM unnest(intended_audiences) audience
      WHERE audience NOT IN ('community','ngo','government','operator','verifier')
    )
  THEN
    RETURN FALSE;
  END IF;

  FOR source IN SELECT value FROM jsonb_array_elements(candidate->'sources') value LOOP
    source_key := (source->>'sourceType') || ':' || (source->>'sourceId');
    IF NOT impact.early_warning_json_has_exact_keys(source, ARRAY[
        'sourceType','sourceId','sourceRoot','observedAt','receivedAt',
        'provenancePolicyRoot','memberRoot'
      ])
      OR source->>'sourceType' NOT IN (
        'satellite_observation','field_evidence','community_report','open_climate_dataset'
      )
      OR source->>'sourceRoot' !~ '^[0-9a-f]{64}$'
      OR source->>'provenancePolicyRoot' !~ '^[0-9a-f]{64}$'
      OR previous_source_key IS NOT NULL AND previous_source_key >= source_key
      OR (source->>'observedAt')::timestamptz NOT BETWEEN
        (candidate->>'observationStart')::timestamptz AND
        (candidate->>'observationEnd')::timestamptz
      OR (source->>'receivedAt')::timestamptz < (source->>'observedAt')::timestamptz
      OR (source->>'receivedAt')::timestamptz > (candidate->>'preparedAt')::timestamptz
      OR source->>'memberRoot' <> impact.early_warning_source_member_root(source)
    THEN
      RETURN FALSE;
    END IF;
    previous_source_key := source_key;
    source_roots := source_roots || jsonb_build_array(source->'memberRoot');
  END LOOP;

  FOR indicator IN SELECT value FROM jsonb_array_elements(candidate->'indicators') value LOOP
    IF NOT impact.early_warning_json_has_exact_keys(indicator, ARRAY[
        'indicatorKey','valueScaled','scale','unit','thresholdScaled','thresholdScale',
        'comparison','breached','memberRoot'
      ])
      OR previous_indicator_key IS NOT NULL
        AND previous_indicator_key >= indicator->>'indicatorKey'
      OR jsonb_typeof(indicator->'valueScaled') <> 'number'
      OR jsonb_typeof(indicator->'thresholdScaled') <> 'number'
      OR jsonb_typeof(indicator->'scale') <> 'number'
      OR jsonb_typeof(indicator->'thresholdScale') <> 'number'
      OR (indicator->>'valueScaled')::numeric <> trunc((indicator->>'valueScaled')::numeric)
      OR (indicator->>'thresholdScaled')::numeric <> trunc((indicator->>'thresholdScaled')::numeric)
      OR (indicator->>'scale')::numeric <> trunc((indicator->>'scale')::numeric)
      OR (indicator->>'thresholdScale')::numeric <> trunc((indicator->>'thresholdScale')::numeric)
      OR (indicator->>'valueScaled')::numeric NOT BETWEEN -9007199254740991 AND 9007199254740991
      OR (indicator->>'thresholdScaled')::numeric NOT BETWEEN -9007199254740991 AND 9007199254740991
      OR (indicator->>'scale')::numeric NOT BETWEEN 1 AND 1000000000
      OR (indicator->>'thresholdScale')::numeric NOT BETWEEN 1 AND 1000000000
      OR indicator->>'comparison' NOT IN ('gte','lte')
      OR jsonb_typeof(indicator->'breached') <> 'boolean'
    THEN
      RETURN FALSE;
    END IF;
    expected_breach := CASE indicator->>'comparison'
      WHEN 'gte' THEN
        (indicator->>'valueScaled')::numeric * (indicator->>'thresholdScale')::numeric >=
        (indicator->>'thresholdScaled')::numeric * (indicator->>'scale')::numeric
      ELSE
        (indicator->>'valueScaled')::numeric * (indicator->>'thresholdScale')::numeric <=
        (indicator->>'thresholdScaled')::numeric * (indicator->>'scale')::numeric
      END;
    IF (indicator->>'breached')::boolean <> expected_breach
      OR indicator->>'memberRoot' <> impact.early_warning_indicator_member_root(indicator)
    THEN
      RETURN FALSE;
    END IF;
    IF expected_breach THEN breached_count := breached_count + 1; END IF;
    previous_indicator_key := indicator->>'indicatorKey';
    indicator_roots := indicator_roots || jsonb_build_array(indicator->'memberRoot');
  END LOOP;

  IF breached_count = 0
    OR candidate->>'sourceMemberRoot' <> impact.early_warning_member_root(source_roots)
    OR candidate->>'indicatorMemberRoot' <> impact.early_warning_member_root(indicator_roots)
    OR candidate->>'sourceAuthorityRoot' <> impact.early_warning_source_authority_root(candidate)
    OR candidate->>'candidateRoot' <> impact.early_warning_candidate_root(candidate)
  THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_latest_event_sequence(
  organization_value text,
  scope_value text,
  risk_value text
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(max(event_sequence), 0) FROM (
    SELECT event_sequence FROM impact.early_warning_publication_facts
      WHERE organization_id = organization_value
        AND scope_id = scope_value AND risk_class = risk_value
    UNION ALL
    SELECT event_sequence FROM impact.early_warning_control_facts
      WHERE organization_id = organization_value
        AND scope_id = scope_value AND risk_class = risk_value
  ) events;
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_latest_event_root(
  organization_value text,
  scope_value text,
  risk_value text
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT audit_event_root FROM (
    SELECT event_sequence, audit_event_root
      FROM impact.early_warning_publication_facts
      WHERE organization_id = organization_value
        AND scope_id = scope_value AND risk_class = risk_value
    UNION ALL
    SELECT event_sequence, audit_event_root
      FROM impact.early_warning_control_facts
      WHERE organization_id = organization_value
        AND scope_id = scope_value AND risk_class = risk_value
  ) events ORDER BY event_sequence DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION impact.early_warning_latest_publication_root(
  organization_value text,
  scope_value text,
  risk_value text
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT publication_root FROM impact.early_warning_publication_facts
  WHERE organization_id = organization_value
    AND scope_id = scope_value AND risk_class = risk_value
  ORDER BY event_sequence DESC LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION impact.validate_early_warning_review_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  candidate jsonb := NEW.fact_record->'candidate';
  semantic_event audit.domain_events%ROWTYPE;
  required_scope text;
  allowed_roles text[];
BEGIN
  required_scope := CASE NEW.review_kind
    WHEN 'scientific' THEN 'risk:scientific-review'
    ELSE 'risk:operational-review'
  END;
  allowed_roles := CASE NEW.review_kind
    WHEN 'scientific' THEN ARRAY['verifier','researcher']::text[]
    ELSE ARRAY['owner','admin','verifier']::text[]
  END;
  IF NOT impact.early_warning_json_has_exact_keys(document, ARRAY[
      'factType','id','candidate','reviewKind','decision','reasonCode','rationale',
      'reviewer','reviewedAt','commandHash','reviewSequence','previousEventRoot',
      'reviewRoot','safety','auditEvent'
    ])
    OR document->>'factType' <> 'early_warning_review'
    OR document->>'id' <> NEW.id
    OR NOT impact.validate_early_warning_candidate(candidate)
    OR candidate->>'organizationId' <> NEW.organization_id
    OR candidate->>'scopeId' <> NEW.scope_id
    OR candidate->>'scopeType' <> NEW.scope_type
    OR candidate->>'riskClass' <> NEW.risk_class
    OR candidate->>'candidateRoot' <> NEW.candidate_root
    OR candidate->>'sourceAuthorityRoot' <> NEW.source_authority_root
    OR document->>'reviewKind' <> NEW.review_kind
    OR document->>'decision' <> NEW.decision
    OR document->'reviewer' <> NEW.reviewer_snapshot
    OR document->'reviewer'->>'id' <> NEW.reviewer_id
    OR NEW.reviewer_id = candidate->'preparer'->>'id'
    OR NOT impact.early_warning_preparer_is_current(
      candidate->'preparer', candidate->'preparer'->>'id', NEW.organization_id
    )
    OR NOT impact.early_warning_human_actor_is_current(
      NEW.reviewer_snapshot, NEW.reviewer_id, NEW.organization_id,
      required_scope, allowed_roles
    )
    OR (document->>'reviewedAt')::timestamptz <> NEW.reviewed_at
    OR NEW.reviewed_at NOT BETWEEN
      (candidate->>'preparedAt')::timestamptz AND (candidate->>'validUntil')::timestamptz
    OR length(btrim(document->>'rationale')) NOT BETWEEN 12 AND 512
    OR (document->>'reviewSequence')::integer <> 1
    OR document->>'previousEventRoot' <> audit.sha256_stable_json(
      jsonb_build_object('kind','canopyproof-audit-genesis-v1')
    )
    OR document->>'commandHash' <> impact.early_warning_review_command_hash(document)
    OR document->>'reviewRoot' <> NEW.review_root
    OR NEW.review_root <> impact.early_warning_review_root(document)
    OR document->'safety' <> impact.early_warning_safety_canonical()
    OR NOT impact.early_warning_document_is_minimized(document)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_EARLY_WARNING_REVIEW_FACT_INVALID'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO STRICT semantic_event
    FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  IF semantic_event.stream_id <>
      'early-warning:review:' || NEW.candidate_root || ':' || NEW.review_kind
    OR semantic_event.sequence_no <> 1
    OR semantic_event.action <> (
      CASE WHEN NEW.decision = 'accepted' THEN 'REASON' ELSE 'CHALLENGE' END
    )
    OR semantic_event.actor_id <> NEW.reviewer_id
    OR semantic_event.entity_type <> 'risk_response'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> document->>'previousEventRoot'
    OR semantic_event.payload_hash <> audit.sha256_stable_json(document - 'auditEvent')
    OR semantic_event.event_root <> document->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.reviewed_at
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_EARLY_WARNING_REVIEW_EVENT_INVALID'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION impact.validate_early_warning_publication_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  candidate jsonb := NEW.fact_record->'candidate';
  projection jsonb := NEW.fact_record->'publicProjection';
  scientific_review impact.early_warning_review_facts%ROWTYPE;
  operational_review impact.early_warning_review_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  expected_sequence bigint;
  expected_previous_root text;
  expected_predecessor text;
  expected_confidence_band text;
BEGIN
  SELECT * INTO STRICT scientific_review FROM impact.early_warning_review_facts
    WHERE id = NEW.scientific_review_id;
  SELECT * INTO STRICT operational_review FROM impact.early_warning_review_facts
    WHERE id = NEW.operational_review_id;
  expected_sequence := impact.early_warning_latest_event_sequence(
    NEW.organization_id, NEW.scope_id, NEW.risk_class
  ) + 1;
  expected_previous_root := COALESCE(
    impact.early_warning_latest_event_root(
      NEW.organization_id, NEW.scope_id, NEW.risk_class
    ),
    audit.sha256_stable_json(jsonb_build_object('kind','canopyproof-audit-genesis-v1'))
  );
  expected_predecessor := impact.early_warning_latest_publication_root(
    NEW.organization_id, NEW.scope_id, NEW.risk_class
  );
  expected_confidence_band := CASE
    WHEN (candidate->>'confidenceBps')::integer < 2500 THEN 'low'
    WHEN (candidate->>'confidenceBps')::integer < 5000 THEN 'medium'
    WHEN (candidate->>'confidenceBps')::integer < 7500 THEN 'high'
    ELSE 'very_high'
  END;

  IF NOT impact.early_warning_json_has_exact_keys(document, ARRAY[
      'factType','id','candidate','scientificReviewId','scientificReviewRoot',
      'scientificReviewerId','scientificReviewerAuthorityRoot','operationalReviewId',
      'operationalReviewRoot','operationalReviewerId','operationalReviewerAuthorityRoot',
      'publisher','predecessorPublicationRoot','publishedAt','commandHash',
      'eventSequence','previousEventRoot','publicProjection','publicationRoot',
      'safety','auditEvent'
    ])
    OR document->>'factType' <> 'early_warning_publication'
    OR document->>'id' <> NEW.id
    OR NOT impact.validate_early_warning_candidate(candidate)
    OR candidate->>'organizationId' <> NEW.organization_id
    OR candidate->>'scopeId' <> NEW.scope_id
    OR candidate->>'scopeType' <> NEW.scope_type
    OR candidate->>'riskClass' <> NEW.risk_class
    OR candidate->>'candidateRoot' <> NEW.candidate_root
    OR candidate->>'sourceAuthorityRoot' <> NEW.source_authority_root
    OR scientific_review.organization_id <> NEW.organization_id
    OR scientific_review.scope_id <> NEW.scope_id
    OR scientific_review.risk_class <> NEW.risk_class
    OR scientific_review.candidate_root <> NEW.candidate_root
    OR scientific_review.review_kind <> 'scientific'
    OR scientific_review.decision <> 'accepted'
    OR operational_review.organization_id <> NEW.organization_id
    OR operational_review.scope_id <> NEW.scope_id
    OR operational_review.risk_class <> NEW.risk_class
    OR operational_review.candidate_root <> NEW.candidate_root
    OR operational_review.review_kind <> 'operational'
    OR operational_review.decision <> 'accepted'
    OR scientific_review.reviewer_id = operational_review.reviewer_id
    OR document->>'scientificReviewId' <> scientific_review.id
    OR document->>'scientificReviewRoot' <> scientific_review.review_root
    OR document->>'scientificReviewerId' <> scientific_review.reviewer_id
    OR document->>'scientificReviewerAuthorityRoot' <>
      scientific_review.reviewer_snapshot->>'authorityRoot'
    OR document->>'operationalReviewId' <> operational_review.id
    OR document->>'operationalReviewRoot' <> operational_review.review_root
    OR document->>'operationalReviewerId' <> operational_review.reviewer_id
    OR document->>'operationalReviewerAuthorityRoot' <>
      operational_review.reviewer_snapshot->>'authorityRoot'
    OR NOT impact.early_warning_preparer_is_current(
      candidate->'preparer', candidate->'preparer'->>'id', NEW.organization_id
    )
    OR NOT impact.early_warning_human_actor_is_current(
      scientific_review.reviewer_snapshot, scientific_review.reviewer_id,
      NEW.organization_id, 'risk:scientific-review',
      ARRAY['verifier','researcher']::text[]
    )
    OR NOT impact.early_warning_human_actor_is_current(
      operational_review.reviewer_snapshot, operational_review.reviewer_id,
      NEW.organization_id, 'risk:operational-review',
      ARRAY['owner','admin','verifier']::text[]
    )
    OR document->'publisher' <> NEW.publisher_snapshot
    OR document->'publisher'->>'id' <> NEW.publisher_id
    OR NEW.publisher_id IN (
      candidate->'preparer'->>'id', scientific_review.reviewer_id,
      operational_review.reviewer_id
    )
    OR NOT impact.early_warning_human_actor_is_current(
      NEW.publisher_snapshot, NEW.publisher_id, NEW.organization_id,
      'risk:publish', ARRAY['owner','admin']::text[]
    )
    OR document->>'predecessorPublicationRoot' IS DISTINCT FROM expected_predecessor
    OR NEW.predecessor_publication_root IS DISTINCT FROM expected_predecessor
    OR (document->>'publishedAt')::timestamptz <> NEW.published_at
    OR NEW.valid_until <> (candidate->>'validUntil')::timestamptz
    OR NEW.published_at < scientific_review.reviewed_at
    OR NEW.published_at < operational_review.reviewed_at
    OR NEW.published_at NOT BETWEEN
      (candidate->>'validFrom')::timestamptz AND (candidate->>'validUntil')::timestamptz
    OR (document->>'eventSequence')::bigint <> NEW.event_sequence
    OR NEW.event_sequence <> expected_sequence
    OR document->>'previousEventRoot' <> expected_previous_root
    OR document->>'commandHash' <> impact.early_warning_publication_command_hash(document)
    OR NOT impact.early_warning_json_has_exact_keys(projection, ARRAY[
      'schemaVersion','publicationId','organizationPublicId','scopeType','scopePublicId',
      'riskClass','severity','confidenceBand','advisoryCode','summary',
      'intendedAudiences','observationStart','observationEnd','validFrom','validUntil',
      'sourceMemberCount','indicatorMemberCount','sourceMemberRoot',
      'indicatorMemberRoot','scientificReviewRoot','operationalReviewRoot',
      'policyId','policyVersion','policyRoot','safetyDisclosure','projectionRoot'
    ])
    OR projection->>'schemaVersion' <> 'canopyproof.early-warning.v1'
    OR projection->>'publicationId' <> NEW.id
    OR projection->>'organizationPublicId' <> candidate->>'organizationPublicId'
    OR projection->>'scopeType' <> NEW.scope_type
    OR projection->>'scopePublicId' <> candidate->>'scopePublicId'
    OR projection->>'riskClass' <> NEW.risk_class
    OR projection->>'severity' <> candidate->>'severity'
    OR projection->>'confidenceBand' <> expected_confidence_band
    OR projection->>'advisoryCode' <> candidate->>'advisoryCode'
    OR projection->>'summary' <> candidate->>'summary'
    OR projection->'intendedAudiences' <> candidate->'intendedAudiences'
    OR projection->>'observationStart' <> candidate->>'observationStart'
    OR projection->>'observationEnd' <> candidate->>'observationEnd'
    OR projection->>'validFrom' <> candidate->>'validFrom'
    OR projection->>'validUntil' <> candidate->>'validUntil'
    OR (projection->>'sourceMemberCount')::integer <> jsonb_array_length(candidate->'sources')
    OR (projection->>'indicatorMemberCount')::integer <> jsonb_array_length(candidate->'indicators')
    OR projection->>'sourceMemberRoot' <> candidate->>'sourceMemberRoot'
    OR projection->>'indicatorMemberRoot' <> candidate->>'indicatorMemberRoot'
    OR projection->>'scientificReviewRoot' <> scientific_review.review_root
    OR projection->>'operationalReviewRoot' <> operational_review.review_root
    OR projection->>'policyId' <> candidate->>'policyId'
    OR projection->>'policyVersion' <> candidate->>'policyVersion'
    OR projection->>'policyRoot' <> candidate->>'policyRoot'
    OR projection->>'safetyDisclosure' <>
      'Environmental risk advisory only; not an emergency declaration or guarantee.'
    OR projection->>'projectionRoot' <> NEW.projection_root
    OR NEW.projection_root <> impact.early_warning_projection_root(projection)
    OR document->>'publicationRoot' <> NEW.publication_root
    OR NEW.publication_root <> impact.early_warning_publication_root(document)
    OR document->'safety' <> impact.early_warning_safety_canonical()
    OR NOT impact.early_warning_document_is_minimized(document)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_EARLY_WARNING_PUBLICATION_FACT_INVALID'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO STRICT semantic_event
    FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  IF semantic_event.stream_id <>
      'early-warning:' || NEW.organization_id || ':' || NEW.scope_id || ':' || NEW.risk_class
    OR semantic_event.sequence_no <> NEW.event_sequence
    OR semantic_event.action <> 'ASSERT'
    OR semantic_event.actor_id <> NEW.publisher_id
    OR semantic_event.entity_type <> 'risk_alert'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> expected_previous_root
    OR semantic_event.payload_hash <> audit.sha256_stable_json(document - 'auditEvent')
    OR semantic_event.event_root <> document->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.published_at
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_EARLY_WARNING_PUBLICATION_EVENT_INVALID'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION impact.validate_early_warning_control_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  publication impact.early_warning_publication_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
  expected_sequence bigint;
  expected_previous_root text;
BEGIN
  SELECT * INTO STRICT publication FROM impact.early_warning_publication_facts
    WHERE id = NEW.publication_id;
  expected_sequence := impact.early_warning_latest_event_sequence(
    NEW.organization_id, NEW.scope_id, NEW.risk_class
  ) + 1;
  expected_previous_root := impact.early_warning_latest_event_root(
    NEW.organization_id, NEW.scope_id, NEW.risk_class
  );
  IF NOT impact.early_warning_json_has_exact_keys(document, ARRAY[
      'factType','id','organizationId','scopeId','riskClass','publicationId',
      'publicationRoot','projectionRoot','action','reasonCode','rationale',
      'governor','controlledAt','commandHash','eventSequence','previousEventRoot',
      'controlRoot','safety','auditEvent'
    ])
    OR document->>'factType' <> 'early_warning_control'
    OR document->>'id' <> NEW.id
    OR document->>'organizationId' <> NEW.organization_id
    OR document->>'scopeId' <> NEW.scope_id
    OR document->>'riskClass' <> NEW.risk_class
    OR publication.organization_id <> NEW.organization_id
    OR publication.scope_id <> NEW.scope_id
    OR publication.risk_class <> NEW.risk_class
    OR impact.early_warning_latest_publication_root(
      NEW.organization_id, NEW.scope_id, NEW.risk_class
    ) <> publication.publication_root
    OR expected_previous_root <> publication.audit_event_root
    OR document->>'publicationId' <> NEW.publication_id
    OR document->>'publicationRoot' <> NEW.publication_root
    OR publication.publication_root <> NEW.publication_root
    OR document->>'projectionRoot' <> NEW.projection_root
    OR publication.projection_root <> NEW.projection_root
    OR document->>'action' <> NEW.action
    OR document->>'reasonCode' <> NEW.reason_code
    OR length(btrim(document->>'rationale')) NOT BETWEEN 12 AND 512
    OR document->'governor' <> NEW.governor_snapshot
    OR document->'governor'->>'id' <> NEW.governor_id
    OR NEW.governor_id = publication.publisher_id
    OR NOT impact.early_warning_human_actor_is_current(
      NEW.governor_snapshot, NEW.governor_id, NEW.organization_id,
      'risk:govern', ARRAY['owner','admin','verifier']::text[]
    )
    OR (document->>'controlledAt')::timestamptz <> NEW.controlled_at
    OR NEW.controlled_at < publication.published_at
    OR (document->>'eventSequence')::bigint <> NEW.event_sequence
    OR NEW.event_sequence <> expected_sequence
    OR document->>'previousEventRoot' <> expected_previous_root
    OR document->>'commandHash' <> impact.early_warning_control_command_hash(document)
    OR document->>'controlRoot' <> NEW.control_root
    OR NEW.control_root <> impact.early_warning_control_root(document)
    OR document->'safety' <> impact.early_warning_safety_canonical()
    OR NOT impact.early_warning_document_is_minimized(document)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_EARLY_WARNING_CONTROL_FACT_INVALID'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO STRICT semantic_event
    FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  IF semantic_event.stream_id <>
      'early-warning:' || NEW.organization_id || ':' || NEW.scope_id || ':' || NEW.risk_class
    OR semantic_event.sequence_no <> NEW.event_sequence
    OR semantic_event.action <> 'CHALLENGE'
    OR semantic_event.actor_id <> NEW.governor_id
    OR semantic_event.entity_type <> 'risk_alert'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> expected_previous_root
    OR semantic_event.payload_hash <> audit.sha256_stable_json(document - 'auditEvent')
    OR semantic_event.event_root <> document->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.controlled_at
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_EARLY_WARNING_CONTROL_EVENT_INVALID'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS early_warning_reviews_validate
  ON impact.early_warning_review_facts;
CREATE TRIGGER early_warning_reviews_validate
BEFORE INSERT ON impact.early_warning_review_facts
FOR EACH ROW EXECUTE FUNCTION impact.validate_early_warning_review_insert();

DROP TRIGGER IF EXISTS early_warning_publications_validate
  ON impact.early_warning_publication_facts;
CREATE TRIGGER early_warning_publications_validate
BEFORE INSERT ON impact.early_warning_publication_facts
FOR EACH ROW EXECUTE FUNCTION impact.validate_early_warning_publication_insert();

DROP TRIGGER IF EXISTS early_warning_controls_validate
  ON impact.early_warning_control_facts;
CREATE TRIGGER early_warning_controls_validate
BEFORE INSERT ON impact.early_warning_control_facts
FOR EACH ROW EXECUTE FUNCTION impact.validate_early_warning_control_insert();

ALTER TABLE impact.early_warning_review_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact.early_warning_review_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS early_warning_reviews_tenant
  ON impact.early_warning_review_facts;
CREATE POLICY early_warning_reviews_tenant ON impact.early_warning_review_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE impact.early_warning_publication_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact.early_warning_publication_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS early_warning_publications_tenant
  ON impact.early_warning_publication_facts;
CREATE POLICY early_warning_publications_tenant ON impact.early_warning_publication_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE impact.early_warning_control_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact.early_warning_control_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS early_warning_controls_tenant
  ON impact.early_warning_control_facts;
CREATE POLICY early_warning_controls_tenant ON impact.early_warning_control_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

DROP TRIGGER IF EXISTS early_warning_reviews_no_update
  ON impact.early_warning_review_facts;
CREATE TRIGGER early_warning_reviews_no_update
BEFORE UPDATE ON impact.early_warning_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS early_warning_reviews_no_delete
  ON impact.early_warning_review_facts;
CREATE TRIGGER early_warning_reviews_no_delete
BEFORE DELETE ON impact.early_warning_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS early_warning_reviews_audit
  ON impact.early_warning_review_facts;
CREATE TRIGGER early_warning_reviews_audit
AFTER INSERT OR UPDATE OR DELETE ON impact.early_warning_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS early_warning_publications_no_update
  ON impact.early_warning_publication_facts;
CREATE TRIGGER early_warning_publications_no_update
BEFORE UPDATE ON impact.early_warning_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS early_warning_publications_no_delete
  ON impact.early_warning_publication_facts;
CREATE TRIGGER early_warning_publications_no_delete
BEFORE DELETE ON impact.early_warning_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS early_warning_publications_audit
  ON impact.early_warning_publication_facts;
CREATE TRIGGER early_warning_publications_audit
AFTER INSERT OR UPDATE OR DELETE ON impact.early_warning_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS early_warning_controls_no_update
  ON impact.early_warning_control_facts;
CREATE TRIGGER early_warning_controls_no_update
BEFORE UPDATE ON impact.early_warning_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS early_warning_controls_no_delete
  ON impact.early_warning_control_facts;
CREATE TRIGGER early_warning_controls_no_delete
BEFORE DELETE ON impact.early_warning_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS early_warning_controls_audit
  ON impact.early_warning_control_facts;
CREATE TRIGGER early_warning_controls_audit
AFTER INSERT OR UPDATE OR DELETE ON impact.early_warning_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

COMMIT;
