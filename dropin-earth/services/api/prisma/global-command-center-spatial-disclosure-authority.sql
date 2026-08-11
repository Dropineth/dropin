-- Route-closed Global Command Center spatial-disclosure authority.
-- Depends on canopyproof-os.sql. Stores integer-degree regional commitments
-- only; raw coordinates, geometries, personal data, and project identifiers are forbidden.

BEGIN;

CREATE OR REPLACE FUNCTION impact.global_spatial_disclosure_safety_canonical()
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
    'independentHumanPrivacyReviewRequired', true,
    'independentHumanSafeguardingReviewRequired', true,
    'accreditedHumanPublisherRequired', true,
    'withdrawalFailClosed', true,
    'rawCoordinatesForbidden', true,
    'minimumCohortSize', 3,
    'noMainnetFunds', true,
    'noAutomaticCanopyDistribution', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true
  );
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_json_has_exact_keys(
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

CREATE OR REPLACE FUNCTION impact.global_spatial_document_is_minimized(document jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT document::text !~* '"(latitude|longitude|coordinates|geometry|boundary|sceneBounds|accuracyMeters|projectId|evidenceId|deviceId|contributorId|email|phone|address|privateKey|secret|token)"[[:space:]]*:';
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_candidate_root(candidate jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-global-command-center-spatial-candidate-v1') ||
    (candidate - 'candidateRoot')
  );
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_review_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-global-command-center-spatial-review-command-v1',
    'candidate', document->'candidate',
    'reviewKind', document->'reviewKind',
    'decision', document->'decision',
    'reviewerAuthorityRoot', document->'reviewer'->'authorityRoot',
    'reviewedAt', document->'reviewedAt',
    'rationale', document->'rationale'
  ));
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_review_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-global-command-center-spatial-review-v1') ||
    (document - ARRAY['reviewRoot','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_public_disclosure_root(disclosure jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-global-command-center-spatial-disclosure-v1') ||
    (disclosure - 'disclosureRoot')
  );
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_publication_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-global-command-center-spatial-disclosure-command-v1',
    'candidate', document->'candidate',
    'privacyReviewRoot', document->'privacyReviewRoot',
    'safeguardingReviewRoot', document->'safeguardingReviewRoot',
    'publisherAuthorityRoot', document->'publisher'->'authorityRoot',
    'publishedAt', document->'publishedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_publication_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-global-command-center-spatial-disclosure-publication-v1') ||
    (document - ARRAY['publicationRoot','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_withdrawal_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-global-command-center-spatial-withdrawal-command-v1',
    'publicationId', document->'publicationId',
    'publicationRoot', document->'publicationRoot',
    'disclosureRoot', document->'disclosureRoot',
    'reasonCode', document->'reasonCode',
    'rationale', document->'rationale',
    'governorAuthorityRoot', document->'governor'->'authorityRoot',
    'controlledAt', document->'controlledAt'
  ));
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_control_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-global-command-center-spatial-withdrawal-v1') ||
    (document - ARRAY['controlRoot','auditEvent']::text[])
  );
$$;

CREATE TABLE IF NOT EXISTS impact.global_command_center_spatial_review_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  region_id text NOT NULL CHECK (length(btrim(region_id)) BETWEEN 1 AND 240),
  candidate_root text NOT NULL CHECK (candidate_root ~ '^[0-9a-f]{64}$'),
  region_source_root text NOT NULL CHECK (region_source_root ~ '^[0-9a-f]{64}$'),
  source_project_count bigint NOT NULL CHECK (source_project_count >= 3),
  review_kind text NOT NULL CHECK (review_kind IN ('privacy','safeguarding')),
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  reviewer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(reviewer_snapshot) = 'object'),
  reviewed_at timestamptz NOT NULL,
  review_root text NOT NULL UNIQUE CHECK (review_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (organization_id, candidate_root, review_kind)
);

CREATE TABLE IF NOT EXISTS impact.global_command_center_spatial_disclosure_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  region_id text NOT NULL CHECK (length(btrim(region_id)) BETWEEN 1 AND 240),
  candidate_root text NOT NULL CHECK (candidate_root ~ '^[0-9a-f]{64}$'),
  region_source_root text NOT NULL CHECK (region_source_root ~ '^[0-9a-f]{64}$'),
  source_project_count bigint NOT NULL CHECK (source_project_count >= 3),
  privacy_review_id text NOT NULL UNIQUE REFERENCES impact.global_command_center_spatial_review_facts(id),
  safeguarding_review_id text NOT NULL UNIQUE REFERENCES impact.global_command_center_spatial_review_facts(id),
  publisher_id text NOT NULL REFERENCES identity.participants(id),
  publisher_snapshot jsonb NOT NULL CHECK (jsonb_typeof(publisher_snapshot) = 'object'),
  published_at timestamptz NOT NULL,
  disclosure_root text NOT NULL UNIQUE CHECK (disclosure_root ~ '^[0-9a-f]{64}$'),
  publication_root text NOT NULL UNIQUE CHECK (publication_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object')
);

CREATE TABLE IF NOT EXISTS impact.global_command_center_spatial_control_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  region_id text NOT NULL CHECK (length(btrim(region_id)) BETWEEN 1 AND 240),
  publication_id text NOT NULL UNIQUE REFERENCES impact.global_command_center_spatial_disclosure_facts(id),
  publication_root text NOT NULL CHECK (publication_root ~ '^[0-9a-f]{64}$'),
  disclosure_root text NOT NULL CHECK (disclosure_root ~ '^[0-9a-f]{64}$'),
  action text NOT NULL CHECK (action = 'withdraw'),
  reason_code text NOT NULL CHECK (reason_code IN ('privacy_risk','safeguarding_risk','source_invalidated','governance_order')),
  governor_id text NOT NULL REFERENCES identity.participants(id),
  governor_snapshot jsonb NOT NULL CHECK (jsonb_typeof(governor_snapshot) = 'object'),
  controlled_at timestamptz NOT NULL,
  control_root text NOT NULL UNIQUE CHECK (control_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object')
);

CREATE INDEX IF NOT EXISTS impact_global_spatial_reviews_region_time
  ON impact.global_command_center_spatial_review_facts (organization_id, region_id, reviewed_at DESC, id);
CREATE INDEX IF NOT EXISTS impact_global_spatial_disclosures_region_time
  ON impact.global_command_center_spatial_disclosure_facts (organization_id, region_id, published_at DESC, id);
CREATE INDEX IF NOT EXISTS impact_global_spatial_controls_region_time
  ON impact.global_command_center_spatial_control_facts (organization_id, region_id, controlled_at DESC, id);

CREATE OR REPLACE FUNCTION impact.validate_global_spatial_candidate(candidate jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT impact.global_spatial_json_has_exact_keys(candidate, ARRAY[
      'schemaVersion','organizationId','regionId','centroid','precisionDegrees',
      'sourceProjectCount','minimumCohortSize','regionSourceRoot','policyId','policyRoot',
      'validFrom','validUntil','candidateRoot'
    ])
    AND candidate->>'schemaVersion' = 'canopyproof.global-command-center.spatial-disclosure.v1'
    AND impact.global_spatial_json_has_exact_keys(candidate->'centroid', ARRAY['latitudeDegrees','longitudeDegrees'])
    AND jsonb_typeof(candidate->'centroid'->'latitudeDegrees') = 'number'
    AND jsonb_typeof(candidate->'centroid'->'longitudeDegrees') = 'number'
    AND (candidate->'centroid'->>'latitudeDegrees')::numeric = trunc((candidate->'centroid'->>'latitudeDegrees')::numeric)
    AND (candidate->'centroid'->>'longitudeDegrees')::numeric = trunc((candidate->'centroid'->>'longitudeDegrees')::numeric)
    AND (candidate->'centroid'->>'latitudeDegrees')::integer BETWEEN -90 AND 90
    AND (candidate->'centroid'->>'longitudeDegrees')::integer BETWEEN -180 AND 179
    AND (candidate->>'precisionDegrees')::integer = 1
    AND (candidate->>'sourceProjectCount')::bigint >= 3
    AND (candidate->>'minimumCohortSize')::integer = 3
    AND candidate->>'regionSourceRoot' ~ '^[0-9a-f]{64}$'
    AND candidate->>'policyRoot' ~ '^[0-9a-f]{64}$'
    AND (candidate->>'validFrom')::timestamptz < (candidate->>'validUntil')::timestamptz
    AND candidate->>'candidateRoot' = impact.global_spatial_candidate_root(candidate)
    AND impact.global_spatial_document_is_minimized(candidate);
$$;

CREATE OR REPLACE FUNCTION impact.global_spatial_actor_is_current(
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

CREATE OR REPLACE FUNCTION impact.validate_global_spatial_review_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  candidate jsonb := NEW.fact_record->'candidate';
  semantic_event audit.domain_events%ROWTYPE;
  required_scope text;
BEGIN
  required_scope := CASE NEW.review_kind
    WHEN 'privacy' THEN 'global_command_center:spatial_privacy_review'
    ELSE 'global_command_center:spatial_safeguarding_review'
  END;
  IF NOT impact.global_spatial_json_has_exact_keys(document, ARRAY[
      'factType','id','candidate','reviewKind','decision','reviewer','reviewedAt','rationale',
      'commandHash','reviewSequence','previousEventRoot','reviewRoot','safety','auditEvent'
    ])
    OR document->>'factType' <> 'global_command_center_spatial_review'
    OR document->>'id' <> NEW.id
    OR NOT impact.validate_global_spatial_candidate(candidate)
    OR candidate->>'organizationId' <> NEW.organization_id
    OR candidate->>'regionId' <> NEW.region_id
    OR candidate->>'candidateRoot' <> NEW.candidate_root
    OR candidate->>'regionSourceRoot' <> NEW.region_source_root
    OR (candidate->>'sourceProjectCount')::bigint <> NEW.source_project_count
    OR document->>'reviewKind' <> NEW.review_kind
    OR document->>'decision' <> NEW.decision
    OR document->'reviewer' <> NEW.reviewer_snapshot
    OR document->'reviewer'->>'id' <> NEW.reviewer_id
    OR (document->>'reviewedAt')::timestamptz <> NEW.reviewed_at
    OR length(btrim(document->>'rationale')) NOT BETWEEN 12 AND 512
    OR (document->>'reviewSequence')::bigint <> 1
    OR document->>'previousEventRoot' <> audit.sha256_stable_json(jsonb_build_object('kind','canopyproof-audit-genesis-v1'))
    OR document->>'commandHash' <> impact.global_spatial_review_command_hash(document)
    OR document->>'reviewRoot' <> NEW.review_root
    OR NEW.review_root <> impact.global_spatial_review_root(document)
    OR document->'safety' <> impact.global_spatial_disclosure_safety_canonical()
    OR NOT impact.global_spatial_document_is_minimized(document)
    OR NOT impact.global_spatial_actor_is_current(
      NEW.reviewer_snapshot, NEW.reviewer_id, NEW.organization_id,
      required_scope, ARRAY['owner','admin','verifier']::text[]
    )
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_SPATIAL_REVIEW_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  IF semantic_event.stream_id <> 'global-command-center:spatial-review:' || NEW.candidate_root || ':' || NEW.review_kind
    OR semantic_event.sequence_no <> 1
    OR semantic_event.action <> 'ASSERT'
    OR semantic_event.actor_id <> NEW.reviewer_id
    OR semantic_event.entity_type <> 'global_command_center_spatial_review'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> document->>'previousEventRoot'
    OR semantic_event.payload_hash <> audit.sha256_stable_json(document - 'auditEvent')
    OR semantic_event.event_root <> document->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.reviewed_at
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_SPATIAL_REVIEW_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION impact.validate_global_spatial_disclosure_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  candidate jsonb := NEW.fact_record->'candidate';
  public_disclosure jsonb := NEW.fact_record->'disclosure';
  privacy_review impact.global_command_center_spatial_review_facts%ROWTYPE;
  safeguarding_review impact.global_command_center_spatial_review_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
BEGIN
  SELECT * INTO STRICT privacy_review FROM impact.global_command_center_spatial_review_facts
    WHERE id = NEW.privacy_review_id;
  SELECT * INTO STRICT safeguarding_review FROM impact.global_command_center_spatial_review_facts
    WHERE id = NEW.safeguarding_review_id;
  IF NOT impact.global_spatial_json_has_exact_keys(document, ARRAY[
      'factType','id','candidate','privacyReviewId','privacyReviewRoot','privacyReviewerId',
      'privacyReviewerAuthorityRoot','safeguardingReviewId','safeguardingReviewRoot',
      'safeguardingReviewerId','safeguardingReviewerAuthorityRoot','publisher','publishedAt',
      'commandHash','regionSequence','previousEventRoot','disclosure','disclosureRoot',
      'publicationRoot','safety','auditEvent'
    ])
    OR document->>'factType' <> 'global_command_center_spatial_disclosure'
    OR document->>'id' <> NEW.id
    OR NOT impact.validate_global_spatial_candidate(candidate)
    OR candidate->>'organizationId' <> NEW.organization_id
    OR candidate->>'regionId' <> NEW.region_id
    OR candidate->>'candidateRoot' <> NEW.candidate_root
    OR candidate->>'regionSourceRoot' <> NEW.region_source_root
    OR (candidate->>'sourceProjectCount')::bigint <> NEW.source_project_count
    OR privacy_review.organization_id <> NEW.organization_id
    OR safeguarding_review.organization_id <> NEW.organization_id
    OR privacy_review.candidate_root <> NEW.candidate_root
    OR safeguarding_review.candidate_root <> NEW.candidate_root
    OR privacy_review.review_kind <> 'privacy' OR privacy_review.decision <> 'approved'
    OR safeguarding_review.review_kind <> 'safeguarding' OR safeguarding_review.decision <> 'approved'
    OR privacy_review.reviewer_id = safeguarding_review.reviewer_id
    OR NOT impact.global_spatial_actor_is_current(
      privacy_review.reviewer_snapshot, privacy_review.reviewer_id, NEW.organization_id,
      'global_command_center:spatial_privacy_review', ARRAY['owner','admin','verifier']::text[]
    )
    OR NOT impact.global_spatial_actor_is_current(
      safeguarding_review.reviewer_snapshot, safeguarding_review.reviewer_id, NEW.organization_id,
      'global_command_center:spatial_safeguarding_review', ARRAY['owner','admin','verifier']::text[]
    )
    OR document->>'privacyReviewId' <> privacy_review.id
    OR document->>'privacyReviewRoot' <> privacy_review.review_root
    OR document->>'privacyReviewerId' <> privacy_review.reviewer_id
    OR document->>'privacyReviewerAuthorityRoot' <> privacy_review.reviewer_snapshot->>'authorityRoot'
    OR document->>'safeguardingReviewId' <> safeguarding_review.id
    OR document->>'safeguardingReviewRoot' <> safeguarding_review.review_root
    OR document->>'safeguardingReviewerId' <> safeguarding_review.reviewer_id
    OR document->>'safeguardingReviewerAuthorityRoot' <> safeguarding_review.reviewer_snapshot->>'authorityRoot'
    OR document->'publisher' <> NEW.publisher_snapshot
    OR document->'publisher'->>'id' <> NEW.publisher_id
    OR NEW.publisher_id IN (privacy_review.reviewer_id, safeguarding_review.reviewer_id)
    OR NOT impact.global_spatial_actor_is_current(
      NEW.publisher_snapshot, NEW.publisher_id, NEW.organization_id,
      'global_command_center:spatial_publish', ARRAY['owner','admin']::text[]
    )
    OR (document->>'publishedAt')::timestamptz <> NEW.published_at
    OR NEW.published_at < GREATEST(privacy_review.reviewed_at, safeguarding_review.reviewed_at)
    OR NEW.published_at NOT BETWEEN (candidate->>'validFrom')::timestamptz AND (candidate->>'validUntil')::timestamptz
    OR document->>'commandHash' <> impact.global_spatial_publication_command_hash(document)
    OR NOT impact.global_spatial_json_has_exact_keys(public_disclosure, ARRAY[
      'regionId','centroid','precisionDegrees','sourceProjectCount','minimumCohortSize','regionSourceRoot',
      'privacyReviewRoot','safeguardingReviewRoot','validFrom','validUntil','disclosureRoot'
    ])
    OR public_disclosure->>'regionId' <> NEW.region_id
    OR public_disclosure->'centroid' <> candidate->'centroid'
    OR public_disclosure->'precisionDegrees' <> candidate->'precisionDegrees'
    OR public_disclosure->'sourceProjectCount' <> candidate->'sourceProjectCount'
    OR public_disclosure->'minimumCohortSize' <> candidate->'minimumCohortSize'
    OR public_disclosure->>'regionSourceRoot' <> NEW.region_source_root
    OR public_disclosure->>'privacyReviewRoot' <> privacy_review.review_root
    OR public_disclosure->>'safeguardingReviewRoot' <> safeguarding_review.review_root
    OR public_disclosure->'validFrom' <> candidate->'validFrom'
    OR public_disclosure->'validUntil' <> candidate->'validUntil'
    OR public_disclosure->>'disclosureRoot' <> NEW.disclosure_root
    OR NEW.disclosure_root <> impact.global_spatial_public_disclosure_root(public_disclosure)
    OR document->>'disclosureRoot' <> NEW.disclosure_root
    OR document->>'publicationRoot' <> NEW.publication_root
    OR NEW.publication_root <> impact.global_spatial_publication_root(document)
    OR document->'safety' <> impact.global_spatial_disclosure_safety_canonical()
    OR NOT impact.global_spatial_document_is_minimized(document)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_SPATIAL_DISCLOSURE_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  IF semantic_event.stream_id <> 'global-command-center:spatial:' || NEW.organization_id || ':' || NEW.region_id
    OR semantic_event.sequence_no <> (document->>'regionSequence')::bigint
    OR semantic_event.action <> 'ASSERT'
    OR semantic_event.actor_id <> NEW.publisher_id
    OR semantic_event.entity_type <> 'global_command_center_spatial_disclosure'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> document->>'previousEventRoot'
    OR semantic_event.payload_hash <> audit.sha256_stable_json(document - 'auditEvent')
    OR semantic_event.event_root <> document->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.published_at
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_SPATIAL_DISCLOSURE_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION impact.validate_global_spatial_control_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  disclosure impact.global_command_center_spatial_disclosure_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
BEGIN
  SELECT * INTO STRICT disclosure FROM impact.global_command_center_spatial_disclosure_facts
    WHERE id = NEW.publication_id;
  IF NOT impact.global_spatial_json_has_exact_keys(document, ARRAY[
      'factType','id','organizationId','regionId','publicationId','publicationRoot',
      'disclosureRoot','action','reasonCode','rationale','governor','controlledAt',
      'commandHash','regionSequence','previousEventRoot','controlRoot','safety','auditEvent'
    ])
    OR document->>'factType' <> 'global_command_center_spatial_disclosure_control'
    OR document->>'id' <> NEW.id
    OR document->>'organizationId' <> NEW.organization_id
    OR document->>'regionId' <> NEW.region_id
    OR disclosure.organization_id <> NEW.organization_id
    OR disclosure.region_id <> NEW.region_id
    OR document->>'publicationId' <> NEW.publication_id
    OR document->>'publicationRoot' <> NEW.publication_root
    OR disclosure.publication_root <> NEW.publication_root
    OR document->>'disclosureRoot' <> NEW.disclosure_root
    OR disclosure.disclosure_root <> NEW.disclosure_root
    OR document->>'action' <> NEW.action OR NEW.action <> 'withdraw'
    OR document->>'reasonCode' <> NEW.reason_code
    OR length(btrim(document->>'rationale')) NOT BETWEEN 12 AND 512
    OR document->'governor' <> NEW.governor_snapshot
    OR document->'governor'->>'id' <> NEW.governor_id
    OR NEW.governor_id = disclosure.publisher_id
    OR NOT impact.global_spatial_actor_is_current(
      NEW.governor_snapshot, NEW.governor_id, NEW.organization_id,
      'global_command_center:spatial_withdraw', ARRAY['owner','admin','verifier']::text[]
    )
    OR (document->>'controlledAt')::timestamptz <> NEW.controlled_at
    OR NEW.controlled_at < disclosure.published_at
    OR document->>'commandHash' <> impact.global_spatial_withdrawal_command_hash(document)
    OR document->>'controlRoot' <> NEW.control_root
    OR NEW.control_root <> impact.global_spatial_control_root(document)
    OR document->'safety' <> impact.global_spatial_disclosure_safety_canonical()
    OR NOT impact.global_spatial_document_is_minimized(document)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_SPATIAL_CONTROL_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  IF semantic_event.stream_id <> 'global-command-center:spatial:' || NEW.organization_id || ':' || NEW.region_id
    OR semantic_event.sequence_no <> (document->>'regionSequence')::bigint
    OR semantic_event.action <> 'CHALLENGE'
    OR semantic_event.actor_id <> NEW.governor_id
    OR semantic_event.entity_type <> 'global_command_center_spatial_disclosure'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> disclosure.audit_event_root
    OR semantic_event.previous_root <> document->>'previousEventRoot'
    OR semantic_event.payload_hash <> audit.sha256_stable_json(document - 'auditEvent')
    OR semantic_event.event_root <> document->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.controlled_at
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_SPATIAL_CONTROL_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS impact_global_spatial_reviews_validate
  ON impact.global_command_center_spatial_review_facts;
CREATE TRIGGER impact_global_spatial_reviews_validate
BEFORE INSERT ON impact.global_command_center_spatial_review_facts
FOR EACH ROW EXECUTE FUNCTION impact.validate_global_spatial_review_insert();

DROP TRIGGER IF EXISTS impact_global_spatial_disclosures_validate
  ON impact.global_command_center_spatial_disclosure_facts;
CREATE TRIGGER impact_global_spatial_disclosures_validate
BEFORE INSERT ON impact.global_command_center_spatial_disclosure_facts
FOR EACH ROW EXECUTE FUNCTION impact.validate_global_spatial_disclosure_insert();

DROP TRIGGER IF EXISTS impact_global_spatial_controls_validate
  ON impact.global_command_center_spatial_control_facts;
CREATE TRIGGER impact_global_spatial_controls_validate
BEFORE INSERT ON impact.global_command_center_spatial_control_facts
FOR EACH ROW EXECUTE FUNCTION impact.validate_global_spatial_control_insert();

ALTER TABLE impact.global_command_center_spatial_review_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact.global_command_center_spatial_review_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS global_spatial_reviews_tenant ON impact.global_command_center_spatial_review_facts;
CREATE POLICY global_spatial_reviews_tenant ON impact.global_command_center_spatial_review_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE impact.global_command_center_spatial_disclosure_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact.global_command_center_spatial_disclosure_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS global_spatial_disclosures_tenant ON impact.global_command_center_spatial_disclosure_facts;
CREATE POLICY global_spatial_disclosures_tenant ON impact.global_command_center_spatial_disclosure_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE impact.global_command_center_spatial_control_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact.global_command_center_spatial_control_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS global_spatial_controls_tenant ON impact.global_command_center_spatial_control_facts;
CREATE POLICY global_spatial_controls_tenant ON impact.global_command_center_spatial_control_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

DROP TRIGGER IF EXISTS impact_global_spatial_reviews_no_update ON impact.global_command_center_spatial_review_facts;
CREATE TRIGGER impact_global_spatial_reviews_no_update
BEFORE UPDATE ON impact.global_command_center_spatial_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS impact_global_spatial_reviews_no_delete ON impact.global_command_center_spatial_review_facts;
CREATE TRIGGER impact_global_spatial_reviews_no_delete
BEFORE DELETE ON impact.global_command_center_spatial_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS impact_global_spatial_reviews_audit ON impact.global_command_center_spatial_review_facts;
CREATE TRIGGER impact_global_spatial_reviews_audit
AFTER INSERT OR UPDATE OR DELETE ON impact.global_command_center_spatial_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS impact_global_spatial_disclosures_no_update ON impact.global_command_center_spatial_disclosure_facts;
CREATE TRIGGER impact_global_spatial_disclosures_no_update
BEFORE UPDATE ON impact.global_command_center_spatial_disclosure_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS impact_global_spatial_disclosures_no_delete ON impact.global_command_center_spatial_disclosure_facts;
CREATE TRIGGER impact_global_spatial_disclosures_no_delete
BEFORE DELETE ON impact.global_command_center_spatial_disclosure_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS impact_global_spatial_disclosures_audit ON impact.global_command_center_spatial_disclosure_facts;
CREATE TRIGGER impact_global_spatial_disclosures_audit
AFTER INSERT OR UPDATE OR DELETE ON impact.global_command_center_spatial_disclosure_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS impact_global_spatial_controls_no_update ON impact.global_command_center_spatial_control_facts;
CREATE TRIGGER impact_global_spatial_controls_no_update
BEFORE UPDATE ON impact.global_command_center_spatial_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS impact_global_spatial_controls_no_delete ON impact.global_command_center_spatial_control_facts;
CREATE TRIGGER impact_global_spatial_controls_no_delete
BEFORE DELETE ON impact.global_command_center_spatial_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS impact_global_spatial_controls_audit ON impact.global_command_center_spatial_control_facts;
CREATE TRIGGER impact_global_spatial_controls_audit
AFTER INSERT OR UPDATE OR DELETE ON impact.global_command_center_spatial_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

COMMIT;
