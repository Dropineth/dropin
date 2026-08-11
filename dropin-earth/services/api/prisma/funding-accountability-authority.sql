-- Route-closed canonical funding-accountability authority.
-- Depends on canopyproof-os.sql. This migration records transparency facts
-- only and creates no payment, custody, settlement, token, or private-key path.

BEGIN;

CREATE OR REPLACE FUNCTION funding.accountability_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'routeMounted', false,
    'schedulerMounted', false,
    'productionActivationEnabled', false,
    'transparencyOnly', true,
    'appendOnly', true,
    'exactRetryRequired', true,
    'currentSourceReResolutionRequired', true,
    'threeIndependentAccreditedHumansRequired', true,
    'integerCentsOnly', true,
    'privateAndPaymentDataForbidden', true,
    'challengeAndWithdrawalFailClosed', true,
    'noMainnetFunds', true,
    'noAutomaticCanopyDistribution', true,
    'notPaymentRail', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notOwnershipRight', true,
    'notGuaranteedYield', true
  );
$$;

CREATE OR REPLACE FUNCTION funding.accountability_json_has_exact_keys(
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

CREATE OR REPLACE FUNCTION funding.accountability_document_is_minimized(document jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT document::text !~* '"(accountNumber|bankAccount|bankRouting|cardNumber|coordinates|email|iban|latitude|longitude|paymentToken|phone|privateKey|secret|taxIdentifier|walletAddress)"[[:space:]]*:';
$$;

CREATE OR REPLACE FUNCTION funding.accountability_member_root(kind_value text, members jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  leaves text[];
BEGIN
  IF jsonb_typeof(members) <> 'array' THEN
    RETURN NULL;
  END IF;
  SELECT ARRAY(
    SELECT value
    FROM jsonb_array_elements_text(members) AS value
    ORDER BY value
  ) INTO leaves;
  IF cardinality(leaves) = 0 THEN
    RETURN audit.sha256_stable_json(jsonb_build_object('kind', kind_value, 'members', '[]'::jsonb));
  END IF;
  RETURN audit.merkle_root(leaves);
END;
$$;

CREATE OR REPLACE FUNCTION funding.accountability_milestone_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-funding-accountability-milestone-v1') ||
    (document - 'milestoneRoot')
  );
$$;

CREATE OR REPLACE FUNCTION funding.accountability_source_authority_root(candidate jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-funding-accountability-source-authority-v1',
    'organizationId', candidate->'organizationId',
    'projectId', candidate->'projectId',
    'projectAuthorityRoot', candidate->'projectAuthorityRoot',
    'sourcePublicId', candidate->'sourcePublicId',
    'sourceDocumentRoot', candidate->'sourceDocumentRoot',
    'fundingSourceAuthorityRoot', candidate->'fundingSourceAuthorityRoot',
    'policyId', candidate->'policyId',
    'policyRoot', candidate->'policyRoot',
    'milestoneAuthorities', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'milestoneId', milestone->'milestoneId',
        'evidenceRoots', milestone->'evidenceRoots',
        'proofRecordRoots', milestone->'proofRecordRoots'
      ) ORDER BY milestone->>'milestoneId')
      FROM jsonb_array_elements(candidate->'milestones') AS milestone
    ), '[]'::jsonb)
  ));
$$;

CREATE OR REPLACE FUNCTION funding.accountability_candidate_root(candidate jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-funding-accountability-candidate-v1') ||
    (candidate - 'candidateRoot')
  );
$$;

CREATE OR REPLACE FUNCTION funding.accountability_review_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-funding-accountability-review-command-v1',
    'candidate', document->'candidate',
    'decision', document->'decision',
    'reviewerAuthorityRoot', document->'reviewer'->'authorityRoot',
    'reviewedAt', document->'reviewedAt',
    'rationale', document->'rationale'
  ));
$$;

CREATE OR REPLACE FUNCTION funding.accountability_review_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-funding-accountability-review-v1') ||
    (document - ARRAY['reviewRoot','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION funding.accountability_projection_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-funding-accountability-public-projection-v1') ||
    (document - 'projectionRoot')
  );
$$;

CREATE OR REPLACE FUNCTION funding.accountability_publication_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-funding-accountability-publication-command-v1',
    'candidate', document->'candidate',
    'reviewRoot', document->'reviewRoot',
    'publisherAuthorityRoot', document->'publisher'->'authorityRoot',
    'publishedAt', document->'publishedAt'
  ));
$$;

CREATE OR REPLACE FUNCTION funding.accountability_publication_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-funding-accountability-publication-v1') ||
    (document - ARRAY['publicationRoot','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION funding.accountability_control_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-funding-accountability-control-command-v1',
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

CREATE OR REPLACE FUNCTION funding.accountability_control_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-funding-accountability-control-v1') ||
    (document - ARRAY['controlRoot','auditEvent']::text[])
  );
$$;

CREATE TABLE IF NOT EXISTS funding.accountability_review_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  candidate_root text NOT NULL UNIQUE CHECK (candidate_root ~ '^[0-9a-f]{64}$'),
  source_authority_root text NOT NULL CHECK (source_authority_root ~ '^[0-9a-f]{64}$'),
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  reviewer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(reviewer_snapshot) = 'object'),
  reviewed_at timestamptz NOT NULL,
  review_root text NOT NULL UNIQUE CHECK (review_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object')
);

CREATE TABLE IF NOT EXISTS funding.accountability_publication_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  candidate_root text NOT NULL UNIQUE CHECK (candidate_root ~ '^[0-9a-f]{64}$'),
  source_authority_root text NOT NULL CHECK (source_authority_root ~ '^[0-9a-f]{64}$'),
  review_id text NOT NULL UNIQUE REFERENCES funding.accountability_review_facts(id),
  publisher_id text NOT NULL REFERENCES identity.participants(id),
  publisher_snapshot jsonb NOT NULL CHECK (jsonb_typeof(publisher_snapshot) = 'object'),
  published_at timestamptz NOT NULL,
  projection_root text NOT NULL UNIQUE CHECK (projection_root ~ '^[0-9a-f]{64}$'),
  publication_root text NOT NULL UNIQUE CHECK (publication_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object')
);

CREATE TABLE IF NOT EXISTS funding.accountability_control_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  publication_id text NOT NULL UNIQUE REFERENCES funding.accountability_publication_facts(id),
  publication_root text NOT NULL CHECK (publication_root ~ '^[0-9a-f]{64}$'),
  projection_root text NOT NULL CHECK (projection_root ~ '^[0-9a-f]{64}$'),
  action text NOT NULL CHECK (action IN ('challenge','withdraw')),
  reason_code text NOT NULL CHECK (reason_code IN (
    'source_invalidated','evidence_challenged','proof_record_challenged',
    'reconciliation_error','governance_order','legal_hold'
  )),
  governor_id text NOT NULL REFERENCES identity.participants(id),
  governor_snapshot jsonb NOT NULL CHECK (jsonb_typeof(governor_snapshot) = 'object'),
  controlled_at timestamptz NOT NULL,
  control_root text NOT NULL UNIQUE CHECK (control_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object')
);

CREATE INDEX IF NOT EXISTS funding_accountability_reviews_project_time
  ON funding.accountability_review_facts (organization_id, project_id, reviewed_at DESC, id);
CREATE INDEX IF NOT EXISTS funding_accountability_publications_project_time
  ON funding.accountability_publication_facts (organization_id, project_id, published_at DESC, id);
CREATE INDEX IF NOT EXISTS funding_accountability_controls_project_time
  ON funding.accountability_control_facts (organization_id, project_id, controlled_at DESC, id);

CREATE OR REPLACE FUNCTION funding.accountability_actor_is_current(
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

CREATE OR REPLACE FUNCTION funding.validate_accountability_candidate(candidate jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
STRICT
AS $$
DECLARE
  milestone jsonb;
  previous_milestone_id text := NULL;
  milestone_total numeric := 0;
  reconciled_total numeric := 0;
  challenged_total numeric := 0;
  evidence_members jsonb := '[]'::jsonb;
  proof_members jsonb := '[]'::jsonb;
  evidence_roots text[];
  proof_roots text[];
BEGIN
  IF NOT funding.accountability_json_has_exact_keys(candidate, ARRAY[
      'schemaVersion','organizationId','projectId','projectAuthorityRoot','sourcePublicId',
      'sourceType','sourceJurisdictionCode','sourceRestriction','commitmentCents',
      'sourceDocumentRoot','fundingSourceAuthorityRoot','allocationId','purposeCode',
      'allocatedCents','allocatedAt','milestones','reportingPeriodStart','reportingPeriodEnd',
      'policyId','policyRoot','validFrom','validUntil','preparedAt','totals','evidenceRoot',
      'proofRecordRoot','sourceAuthorityRoot','preparer','candidateRoot'
    ])
    OR candidate->>'schemaVersion' <> 'canopyproof.funding-accountability.v1'
    OR candidate->>'projectAuthorityRoot' !~ '^[0-9a-f]{64}$'
    OR candidate->>'sourceDocumentRoot' !~ '^[0-9a-f]{64}$'
    OR candidate->>'fundingSourceAuthorityRoot' !~ '^[0-9a-f]{64}$'
    OR candidate->>'policyRoot' !~ '^[0-9a-f]{64}$'
    OR candidate->>'sourceType' NOT IN ('donor','grant','public_budget','philanthropic_fund','climate_fund')
    OR candidate->>'sourceRestriction' NOT IN ('unrestricted','project_restricted','milestone_restricted')
    OR candidate->>'sourceJurisdictionCode' !~ '^[A-Z0-9][A-Z0-9-]{1,15}$'
    OR jsonb_typeof(candidate->'commitmentCents') <> 'number'
    OR jsonb_typeof(candidate->'allocatedCents') <> 'number'
    OR (candidate->>'commitmentCents')::numeric <> trunc((candidate->>'commitmentCents')::numeric)
    OR (candidate->>'allocatedCents')::numeric <> trunc((candidate->>'allocatedCents')::numeric)
    OR (candidate->>'commitmentCents')::numeric NOT BETWEEN 0 AND 9007199254740991
    OR (candidate->>'allocatedCents')::numeric NOT BETWEEN 0 AND (candidate->>'commitmentCents')::numeric
    OR jsonb_typeof(candidate->'milestones') <> 'array'
    OR jsonb_array_length(candidate->'milestones') NOT BETWEEN 1 AND 128
    OR NOT funding.accountability_json_has_exact_keys(candidate->'totals', ARRAY[
      'committedCents','allocatedCents','reconciledCents','challengedCents'
    ])
    OR (candidate->>'reportingPeriodStart')::timestamptz >= (candidate->>'reportingPeriodEnd')::timestamptz
    OR (candidate->>'allocatedAt')::timestamptz NOT BETWEEN
      (candidate->>'reportingPeriodStart')::timestamptz AND
      (candidate->>'reportingPeriodEnd')::timestamptz
    OR (candidate->>'reportingPeriodEnd')::timestamptz > (candidate->>'preparedAt')::timestamptz
    OR (candidate->>'preparedAt')::timestamptz > (candidate->>'validFrom')::timestamptz
    OR (candidate->>'validFrom')::timestamptz >= (candidate->>'validUntil')::timestamptz
    OR NOT funding.accountability_document_is_minimized(candidate)
  THEN
    RETURN FALSE;
  END IF;

  FOR milestone IN
    SELECT value FROM jsonb_array_elements(candidate->'milestones') AS value
    ORDER BY value->>'milestoneId'
  LOOP
    IF NOT funding.accountability_json_has_exact_keys(milestone, ARRAY[
        'milestoneId','amountCents','dueAt','status','evidenceRoots','proofRecordRoots',
        'evidenceRoot','proofRecordRoot','milestoneRoot'
      ])
      OR previous_milestone_id IS NOT NULL AND previous_milestone_id >= milestone->>'milestoneId'
      OR jsonb_typeof(milestone->'amountCents') <> 'number'
      OR (milestone->>'amountCents')::numeric <> trunc((milestone->>'amountCents')::numeric)
      OR (milestone->>'amountCents')::numeric NOT BETWEEN 0 AND 9007199254740991
      OR milestone->>'status' NOT IN ('planned','evidence_required','ready_for_review','reconciled','challenged')
      OR jsonb_typeof(milestone->'evidenceRoots') <> 'array'
      OR jsonb_typeof(milestone->'proofRecordRoots') <> 'array'
      OR jsonb_array_length(milestone->'evidenceRoots') > 256
      OR jsonb_array_length(milestone->'proofRecordRoots') > 256
    THEN
      RETURN FALSE;
    END IF;
    SELECT ARRAY(SELECT value FROM jsonb_array_elements_text(milestone->'evidenceRoots') value ORDER BY value)
      INTO evidence_roots;
    SELECT ARRAY(SELECT value FROM jsonb_array_elements_text(milestone->'proofRecordRoots') value ORDER BY value)
      INTO proof_roots;
    IF EXISTS (SELECT 1 FROM unnest(evidence_roots) value WHERE value !~ '^[0-9a-f]{64}$')
      OR EXISTS (SELECT 1 FROM unnest(proof_roots) value WHERE value !~ '^[0-9a-f]{64}$')
      OR cardinality(evidence_roots) <> (SELECT count(DISTINCT value) FROM unnest(evidence_roots) value)
      OR cardinality(proof_roots) <> (SELECT count(DISTINCT value) FROM unnest(proof_roots) value)
      OR milestone->'evidenceRoots' <> to_jsonb(evidence_roots)
      OR milestone->'proofRecordRoots' <> to_jsonb(proof_roots)
      OR (milestone->>'status' = 'reconciled' AND (cardinality(evidence_roots) = 0 OR cardinality(proof_roots) = 0))
      OR milestone->>'evidenceRoot' <> funding.accountability_member_root(
        'canopyproof-funding-accountability-milestone-evidence-v1', milestone->'evidenceRoots'
      )
      OR milestone->>'proofRecordRoot' <> funding.accountability_member_root(
        'canopyproof-funding-accountability-milestone-proof-records-v1', milestone->'proofRecordRoots'
      )
      OR milestone->>'milestoneRoot' <> funding.accountability_milestone_root(milestone)
    THEN
      RETURN FALSE;
    END IF;
    previous_milestone_id := milestone->>'milestoneId';
    milestone_total := milestone_total + (milestone->>'amountCents')::numeric;
    IF milestone->>'status' = 'reconciled' THEN
      reconciled_total := reconciled_total + (milestone->>'amountCents')::numeric;
    END IF;
    IF milestone->>'status' = 'challenged' THEN
      challenged_total := challenged_total + (milestone->>'amountCents')::numeric;
    END IF;
    evidence_members := evidence_members || milestone->'evidenceRoots';
    proof_members := proof_members || milestone->'proofRecordRoots';
  END LOOP;

  IF milestone_total > (candidate->>'allocatedCents')::numeric
    OR (candidate->'totals'->>'committedCents')::numeric <> (candidate->>'commitmentCents')::numeric
    OR (candidate->'totals'->>'allocatedCents')::numeric <> (candidate->>'allocatedCents')::numeric
    OR (candidate->'totals'->>'reconciledCents')::numeric <> reconciled_total
    OR (candidate->'totals'->>'challengedCents')::numeric <> challenged_total
    OR candidate->>'evidenceRoot' <> funding.accountability_member_root(
      'canopyproof-funding-accountability-evidence-members-v1', evidence_members
    )
    OR candidate->>'proofRecordRoot' <> funding.accountability_member_root(
      'canopyproof-funding-accountability-proof-record-members-v1', proof_members
    )
    OR candidate->>'sourceAuthorityRoot' <> funding.accountability_source_authority_root(candidate)
    OR candidate->>'candidateRoot' <> funding.accountability_candidate_root(candidate)
  THEN
    RETURN FALSE;
  END IF;
  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION funding.validate_accountability_review_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  candidate jsonb := NEW.fact_record->'candidate';
  semantic_event audit.domain_events%ROWTYPE;
BEGIN
  IF NOT funding.accountability_json_has_exact_keys(document, ARRAY[
      'factType','id','candidate','decision','reviewer','reviewedAt','rationale',
      'commandHash','reviewSequence','previousEventRoot','reviewRoot','safety','auditEvent'
    ])
    OR document->>'factType' <> 'funding_accountability_review'
    OR document->>'id' <> NEW.id
    OR NOT funding.validate_accountability_candidate(candidate)
    OR candidate->>'organizationId' <> NEW.organization_id
    OR candidate->>'projectId' <> NEW.project_id
    OR candidate->>'candidateRoot' <> NEW.candidate_root
    OR candidate->>'sourceAuthorityRoot' <> NEW.source_authority_root
    OR document->>'decision' <> NEW.decision
    OR document->'reviewer' <> NEW.reviewer_snapshot
    OR document->'reviewer'->>'id' <> NEW.reviewer_id
    OR NEW.reviewer_id = candidate->'preparer'->>'id'
    OR NOT funding.accountability_actor_is_current(
      candidate->'preparer', candidate->'preparer'->>'id', NEW.organization_id,
      'funding:accountability_prepare', ARRAY['owner','admin','researcher']::text[]
    )
    OR NOT funding.accountability_actor_is_current(
      NEW.reviewer_snapshot, NEW.reviewer_id, NEW.organization_id,
      'funding:accountability_review', ARRAY['admin','verifier']::text[]
    )
    OR (document->>'reviewedAt')::timestamptz <> NEW.reviewed_at
    OR NEW.reviewed_at NOT BETWEEN (candidate->>'preparedAt')::timestamptz AND (candidate->>'validUntil')::timestamptz
    OR length(btrim(document->>'rationale')) NOT BETWEEN 12 AND 512
    OR (document->>'reviewSequence')::integer <> 1
    OR document->>'previousEventRoot' <> audit.sha256_stable_json(jsonb_build_object('kind','canopyproof-audit-genesis-v1'))
    OR document->>'commandHash' <> funding.accountability_review_command_hash(document)
    OR document->>'reviewRoot' <> NEW.review_root
    OR NEW.review_root <> funding.accountability_review_root(document)
    OR document->'safety' <> funding.accountability_safety_canonical()
    OR NOT funding.accountability_document_is_minimized(document)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_FUNDING_ACCOUNTABILITY_REVIEW_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  IF semantic_event.stream_id <> 'funding-accountability:review:' || NEW.candidate_root
    OR semantic_event.sequence_no <> 1
    OR semantic_event.action <> (CASE WHEN NEW.decision = 'approved' THEN 'ASSERT' ELSE 'CHALLENGE' END)
    OR semantic_event.actor_id <> NEW.reviewer_id
    OR semantic_event.entity_type <> 'funding_accountability_review'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> document->>'previousEventRoot'
    OR semantic_event.payload_hash <> audit.sha256_stable_json(document - 'auditEvent')
    OR semantic_event.event_root <> document->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.reviewed_at
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_FUNDING_ACCOUNTABILITY_REVIEW_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION funding.validate_accountability_publication_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  candidate jsonb := NEW.fact_record->'candidate';
  projection jsonb := NEW.fact_record->'publicProjection';
  review funding.accountability_review_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
BEGIN
  SELECT * INTO STRICT review FROM funding.accountability_review_facts WHERE id = NEW.review_id;
  IF NOT funding.accountability_json_has_exact_keys(document, ARRAY[
      'factType','id','candidate','reviewId','reviewRoot','reviewerId',
      'reviewerAuthorityRoot','publisher','publishedAt','commandHash','projectSequence',
      'previousEventRoot','publicProjection','publicationRoot','safety','auditEvent'
    ])
    OR document->>'factType' <> 'funding_accountability_publication'
    OR document->>'id' <> NEW.id
    OR NOT funding.validate_accountability_candidate(candidate)
    OR candidate->>'organizationId' <> NEW.organization_id
    OR candidate->>'projectId' <> NEW.project_id
    OR candidate->>'candidateRoot' <> NEW.candidate_root
    OR candidate->>'sourceAuthorityRoot' <> NEW.source_authority_root
    OR review.organization_id <> NEW.organization_id
    OR review.project_id <> NEW.project_id
    OR review.candidate_root <> NEW.candidate_root
    OR review.decision <> 'approved'
    OR document->>'reviewId' <> review.id
    OR document->>'reviewRoot' <> review.review_root
    OR document->>'reviewerId' <> review.reviewer_id
    OR document->>'reviewerAuthorityRoot' <> review.reviewer_snapshot->>'authorityRoot'
    OR NOT funding.accountability_actor_is_current(
      candidate->'preparer', candidate->'preparer'->>'id', NEW.organization_id,
      'funding:accountability_prepare', ARRAY['owner','admin','researcher']::text[]
    )
    OR NOT funding.accountability_actor_is_current(
      review.reviewer_snapshot, review.reviewer_id, NEW.organization_id,
      'funding:accountability_review', ARRAY['admin','verifier']::text[]
    )
    OR document->'publisher' <> NEW.publisher_snapshot
    OR document->'publisher'->>'id' <> NEW.publisher_id
    OR NEW.publisher_id IN (candidate->'preparer'->>'id', review.reviewer_id)
    OR NOT funding.accountability_actor_is_current(
      NEW.publisher_snapshot, NEW.publisher_id, NEW.organization_id,
      'funding:accountability_publish', ARRAY['owner','admin']::text[]
    )
    OR (document->>'publishedAt')::timestamptz <> NEW.published_at
    OR NEW.published_at < review.reviewed_at
    OR NEW.published_at NOT BETWEEN (candidate->>'validFrom')::timestamptz AND (candidate->>'validUntil')::timestamptz
    OR document->>'commandHash' <> funding.accountability_publication_command_hash(document)
    OR NOT funding.accountability_json_has_exact_keys(projection, ARRAY[
      'schemaVersion','publicationId','organizationId','projectId','sourcePublicId','sourceType',
      'sourceJurisdictionCode','sourceRestriction','purposeCode','candidateRoot',
      'sourceAuthorityRoot','totals','milestoneCount','reconciledMilestoneCount',
      'challengedMilestoneCount','evidenceMemberCount','proofRecordMemberCount',
      'evidenceRoot','proofRecordRoot','policyId','policyRoot','reportingPeriodStart',
      'reportingPeriodEnd','validFrom','validUntil','projectionRoot'
    ])
    OR projection->>'publicationId' <> NEW.id
    OR projection->>'organizationId' <> NEW.organization_id
    OR projection->>'projectId' <> NEW.project_id
    OR projection->>'candidateRoot' <> NEW.candidate_root
    OR projection->>'sourceAuthorityRoot' <> NEW.source_authority_root
    OR projection->'totals' <> candidate->'totals'
    OR projection->>'evidenceRoot' <> candidate->>'evidenceRoot'
    OR projection->>'proofRecordRoot' <> candidate->>'proofRecordRoot'
    OR projection->>'policyRoot' <> candidate->>'policyRoot'
    OR projection->>'projectionRoot' <> NEW.projection_root
    OR NEW.projection_root <> funding.accountability_projection_root(projection)
    OR document->>'publicationRoot' <> NEW.publication_root
    OR NEW.publication_root <> funding.accountability_publication_root(document)
    OR document->'safety' <> funding.accountability_safety_canonical()
    OR NOT funding.accountability_document_is_minimized(document)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLICATION_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  IF semantic_event.stream_id <> 'funding-accountability:' || NEW.organization_id || ':' || NEW.project_id
    OR semantic_event.sequence_no <> (document->>'projectSequence')::bigint
    OR semantic_event.action <> 'ASSERT'
    OR semantic_event.actor_id <> NEW.publisher_id
    OR semantic_event.entity_type <> 'funding_accountability_publication'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> document->>'previousEventRoot'
    OR semantic_event.payload_hash <> audit.sha256_stable_json(document - 'auditEvent')
    OR semantic_event.event_root <> document->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.published_at
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLICATION_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION funding.validate_accountability_control_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  document jsonb := NEW.fact_record;
  publication funding.accountability_publication_facts%ROWTYPE;
  semantic_event audit.domain_events%ROWTYPE;
BEGIN
  SELECT * INTO STRICT publication FROM funding.accountability_publication_facts
    WHERE id = NEW.publication_id;
  IF NOT funding.accountability_json_has_exact_keys(document, ARRAY[
      'factType','id','organizationId','projectId','publicationId','publicationRoot',
      'projectionRoot','action','reasonCode','rationale','governor','controlledAt',
      'commandHash','projectSequence','previousEventRoot','controlRoot','safety','auditEvent'
    ])
    OR document->>'factType' <> 'funding_accountability_control'
    OR document->>'id' <> NEW.id
    OR document->>'organizationId' <> NEW.organization_id
    OR document->>'projectId' <> NEW.project_id
    OR publication.organization_id <> NEW.organization_id
    OR publication.project_id <> NEW.project_id
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
    OR NOT funding.accountability_actor_is_current(
      NEW.governor_snapshot, NEW.governor_id, NEW.organization_id,
      'funding:accountability_control', ARRAY['owner','admin','verifier']::text[]
    )
    OR (document->>'controlledAt')::timestamptz <> NEW.controlled_at
    OR NEW.controlled_at < publication.published_at
    OR document->>'commandHash' <> funding.accountability_control_command_hash(document)
    OR document->>'controlRoot' <> NEW.control_root
    OR NEW.control_root <> funding.accountability_control_root(document)
    OR document->'safety' <> funding.accountability_safety_canonical()
    OR NOT funding.accountability_document_is_minimized(document)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_FACT_INVALID' USING ERRCODE = 'check_violation';
  END IF;

  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  IF semantic_event.stream_id <> 'funding-accountability:' || NEW.organization_id || ':' || NEW.project_id
    OR semantic_event.sequence_no <> (document->>'projectSequence')::bigint
    OR semantic_event.action <> 'CHALLENGE'
    OR semantic_event.actor_id <> NEW.governor_id
    OR semantic_event.entity_type <> 'funding_accountability_publication'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> publication.audit_event_root
    OR semantic_event.previous_root <> document->>'previousEventRoot'
    OR semantic_event.payload_hash <> audit.sha256_stable_json(document - 'auditEvent')
    OR semantic_event.event_root <> document->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.controlled_at
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_EVENT_INVALID' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS funding_accountability_reviews_validate
  ON funding.accountability_review_facts;
CREATE TRIGGER funding_accountability_reviews_validate
BEFORE INSERT ON funding.accountability_review_facts
FOR EACH ROW EXECUTE FUNCTION funding.validate_accountability_review_insert();

DROP TRIGGER IF EXISTS funding_accountability_publications_validate
  ON funding.accountability_publication_facts;
CREATE TRIGGER funding_accountability_publications_validate
BEFORE INSERT ON funding.accountability_publication_facts
FOR EACH ROW EXECUTE FUNCTION funding.validate_accountability_publication_insert();

DROP TRIGGER IF EXISTS funding_accountability_controls_validate
  ON funding.accountability_control_facts;
CREATE TRIGGER funding_accountability_controls_validate
BEFORE INSERT ON funding.accountability_control_facts
FOR EACH ROW EXECUTE FUNCTION funding.validate_accountability_control_insert();

ALTER TABLE funding.accountability_review_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding.accountability_review_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS funding_accountability_reviews_tenant
  ON funding.accountability_review_facts;
CREATE POLICY funding_accountability_reviews_tenant ON funding.accountability_review_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE funding.accountability_publication_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding.accountability_publication_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS funding_accountability_publications_tenant
  ON funding.accountability_publication_facts;
CREATE POLICY funding_accountability_publications_tenant ON funding.accountability_publication_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE funding.accountability_control_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding.accountability_control_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS funding_accountability_controls_tenant
  ON funding.accountability_control_facts;
CREATE POLICY funding_accountability_controls_tenant ON funding.accountability_control_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

DROP TRIGGER IF EXISTS funding_accountability_reviews_no_update
  ON funding.accountability_review_facts;
CREATE TRIGGER funding_accountability_reviews_no_update
BEFORE UPDATE ON funding.accountability_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS funding_accountability_reviews_no_delete
  ON funding.accountability_review_facts;
CREATE TRIGGER funding_accountability_reviews_no_delete
BEFORE DELETE ON funding.accountability_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS funding_accountability_reviews_audit
  ON funding.accountability_review_facts;
CREATE TRIGGER funding_accountability_reviews_audit
AFTER INSERT OR UPDATE OR DELETE ON funding.accountability_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS funding_accountability_publications_no_update
  ON funding.accountability_publication_facts;
CREATE TRIGGER funding_accountability_publications_no_update
BEFORE UPDATE ON funding.accountability_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS funding_accountability_publications_no_delete
  ON funding.accountability_publication_facts;
CREATE TRIGGER funding_accountability_publications_no_delete
BEFORE DELETE ON funding.accountability_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS funding_accountability_publications_audit
  ON funding.accountability_publication_facts;
CREATE TRIGGER funding_accountability_publications_audit
AFTER INSERT OR UPDATE OR DELETE ON funding.accountability_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS funding_accountability_controls_no_update
  ON funding.accountability_control_facts;
CREATE TRIGGER funding_accountability_controls_no_update
BEFORE UPDATE ON funding.accountability_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS funding_accountability_controls_no_delete
  ON funding.accountability_control_facts;
CREATE TRIGGER funding_accountability_controls_no_delete
BEFORE DELETE ON funding.accountability_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();
DROP TRIGGER IF EXISTS funding_accountability_controls_audit
  ON funding.accountability_control_facts;
CREATE TRIGGER funding_accountability_controls_audit
AFTER INSERT OR UPDATE OR DELETE ON funding.accountability_control_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

COMMIT;
