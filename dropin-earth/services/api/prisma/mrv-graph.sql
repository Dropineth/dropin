-- CanopyProof Digital MRV Graph durable lineage authority.
-- Apply after canopyproof-os.sql and evidence-offline-community.sql.
-- This migration is additive, route-closed, and does not issue final proof.

CREATE SCHEMA IF NOT EXISTS mrv;

CREATE OR REPLACE FUNCTION mrv.reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CANOPYPROOF_MRV_APPEND_ONLY_VIOLATION: %.% cannot be updated or deleted',
    TG_TABLE_SCHEMA, TG_TABLE_NAME;
END;
$$;

CREATE OR REPLACE FUNCTION mrv.safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'lineageIndexOnly', true,
    'sourceDomainsAuthoritative', true,
    'appendOnly', true,
    'organizationBound', true,
    'projectBound', true,
    'exactEndpointRootsRequired', true,
    'closedRelationshipMatrix', true,
    'semanticEventBound', true,
    'exactRetryRequired', true,
    'humanSnapshotReviewRequired', true,
    'aiAdvisoryOnly', true,
    'rawEvidenceExcluded', true,
    'preciseLocationExcluded', true,
    'rawContactDataExcluded', true,
    'credentialsAndSecretsExcluded', true,
    'notFinalProofAuthority', true,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true,
    'routeMounted', false
  );
$$;

CREATE OR REPLACE FUNCTION mrv.has_forbidden_key(document jsonb)
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
        'latitude', 'longitude', 'location', 'preciselocation', 'rawlocation',
        'rawpayload', 'rawmedia', 'media', 'exif', 'contact', 'email', 'phone',
        'address', 'idempotencykey', 'credential', 'privatekey', 'secret',
        'accesskey', 'accesstoken', 'refreshtoken', 'signedurl', 'uploadurl'
      ]::text[]) THEN
        RETURN true;
      END IF;
      IF mrv.has_forbidden_key(entry.value) THEN RETURN true; END IF;
    END LOOP;
  ELSIF jsonb_typeof(document) = 'array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(document)
    LOOP
      IF mrv.has_forbidden_key(item) THEN RETURN true; END IF;
    END LOOP;
  END IF;
  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION mrv.keys_are_valid(
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
    AND document ?& required_keys
    AND NOT EXISTS (
      SELECT 1
      FROM jsonb_object_keys(document) AS present_key
      WHERE NOT (present_key = ANY(allowed_keys))
    );
$$;

CREATE OR REPLACE FUNCTION mrv.endpoint_hash(endpoint jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-mrv-endpoint-v1') || (endpoint - 'endpointHash')
  );
$$;

CREATE OR REPLACE FUNCTION mrv.methodology_root(methodology jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-mrv-methodology-authority-v1') ||
    (methodology - 'methodologyRoot')
  );
$$;

CREATE OR REPLACE FUNCTION mrv.actor_authority_root(actor jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-mrv-actor-authority-v1') || (actor - 'authorityRoot')
  );
$$;

CREATE OR REPLACE FUNCTION mrv.snapshot_genesis(target_project_id text, target_project_root text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-mrv-graph-snapshot-genesis-v1',
    'projectId', target_project_id,
    'projectRoot', target_project_root
  ));
$$;

CREATE OR REPLACE FUNCTION mrv.audit_event_record(event audit.domain_events)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT jsonb_build_object(
    'id', event.id,
    'action', event.action,
    'actor', event.actor_id,
    'entityType', event.entity_type,
    'entityId', event.entity_id,
    'previousRoot', event.previous_root,
    'payloadHash', event.payload_hash,
    'eventRoot', event.event_root,
    'createdAt', audit.iso8601_millis(event.created_at),
    'rationale', event.rationale
  );
$$;

CREATE OR REPLACE FUNCTION mrv.resolve_endpoint(endpoint_type text, endpoint_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE
  endpoint jsonb;
BEGIN
  CASE endpoint_type
    WHEN 'project_registration' THEN
      SELECT jsonb_build_object(
        'type', endpoint_type,
        'id', project.id,
        'root', project.project_root,
        'eventRoot', project.audit_event_root,
        'organizationId', project.organization_id,
        'projectId', project.id,
        'occurredAt', audit.iso8601_millis(project.created_at),
        'state', 'current',
        'actorIds', jsonb_build_array(project.created_by)
      ) INTO endpoint
      FROM projects.projects project
      WHERE project.id = endpoint_id;
    WHEN 'project_monitoring_event' THEN
      SELECT jsonb_build_object(
        'type', endpoint_type,
        'id', event.id,
        'root', event.monitoring_root,
        'eventRoot', event.audit_event_root,
        'organizationId', event.organization_id,
        'projectId', event.project_id,
        'occurredAt', audit.iso8601_millis(event.observed_at),
        'state', CASE event.state
          WHEN 'accepted' THEN 'current'
          WHEN 'challenged' THEN 'challenged'
          ELSE 'review_required'
        END,
        'actorIds', jsonb_build_array(event.observed_by)
      ) INTO endpoint
      FROM projects.monitoring_events event
      WHERE event.id = endpoint_id;
    WHEN 'evidence_object' THEN
      SELECT jsonb_build_object(
        'type', endpoint_type,
        'id', evidence_record.id,
        'root', evidence_record.evidence_root,
        'eventRoot', evidence_record.audit_event_root,
        'organizationId', evidence_record.organization_id,
        'projectId', evidence_record.project_id,
        'occurredAt', audit.iso8601_millis(evidence_record.created_at),
        'state', CASE evidence_record.verification_status
          WHEN 'validated' THEN 'current'
          ELSE 'challenged'
        END,
        'actorIds', jsonb_build_array(evidence_record.contributor_id)
      ) INTO endpoint
      FROM evidence.evidence_objects evidence_record
      WHERE evidence_record.id = endpoint_id;
    WHEN 'evidence_validation' THEN
      SELECT jsonb_build_object(
        'type', endpoint_type,
        'id', validation.id,
        'root', validation.validation_root,
        'eventRoot', validation.audit_event_root,
        'organizationId', validation.organization_id,
        'projectId', validation.project_id,
        'occurredAt', audit.iso8601_millis(validation.executed_at),
        'state', CASE validation.outcome
          WHEN 'pass' THEN 'current'
          WHEN 'blocked' THEN 'revoked'
          ELSE 'review_required'
        END,
        'actorIds', jsonb_build_array(validation.executor_id)
      ) INTO endpoint
      FROM verification.evidence_validation_runs validation
      WHERE validation.id = endpoint_id;
    WHEN 'ai_analysis_advisory' THEN
      SELECT jsonb_build_object(
        'type', endpoint_type,
        'id', analysis.id,
        'root', analysis.analysis_root,
        'eventRoot', analysis.audit_event_root,
        'organizationId', analysis.organization_id,
        'projectId', analysis.project_id,
        'occurredAt', audit.iso8601_millis(analysis.analyzed_at),
        'state', 'current',
        'actorIds', jsonb_build_array(analysis.agent_id)
      ) INTO endpoint
      FROM verification.evidence_ai_analyses analysis
      WHERE analysis.id = endpoint_id AND analysis.advisory_only IS TRUE;
    WHEN 'human_review' THEN
      SELECT jsonb_build_object(
        'type', endpoint_type,
        'id', review.id,
        'root', review.review_root,
        'eventRoot', review.audit_event_root,
        'organizationId', review.organization_id,
        'projectId', review.project_id,
        'occurredAt', audit.iso8601_millis(review.reviewed_at),
        'state', CASE review.decision
          WHEN 'approve' THEN 'current'
          WHEN 'reject' THEN 'revoked'
          WHEN 'challenge' THEN 'challenged'
          ELSE 'review_required'
        END,
        'actorIds', jsonb_build_array(review.reviewer_id)
      ) INTO endpoint
      FROM verification.evidence_human_reviews review
      WHERE review.id = endpoint_id;
    WHEN 'verification_decision' THEN
      SELECT jsonb_build_object(
        'type', endpoint_type,
        'id', decision_record.id,
        'root', decision_record.decision_root,
        'eventRoot', decision_record.audit_event_root,
        'organizationId', decision_record.organization_id,
        'projectId', decision_record.project_id,
        'occurredAt', audit.iso8601_millis(decision_record.decided_at),
        'state', CASE decision_record.decision
          WHEN 'verify' THEN 'current'
          WHEN 'reject' THEN 'revoked'
          ELSE 'review_required'
        END,
        'actorIds', jsonb_build_array(decision_record.verifier_id)
      ) INTO endpoint
      FROM verification.evidence_final_decisions decision_record
      WHERE decision_record.id = endpoint_id;
    WHEN 'community_attestation' THEN
      SELECT jsonb_build_object(
        'type', endpoint_type,
        'id', attestation.id,
        'root', attestation.attestation_root,
        'eventRoot', attestation.audit_event_root,
        'organizationId', attestation.organization_id,
        'projectId', attestation.project_id,
        'occurredAt', audit.iso8601_millis(attestation.created_at),
        'state', CASE attestation.attestation_state
          WHEN 'supporting_context' THEN 'current'
          ELSE 'challenged'
        END,
        'actorIds', jsonb_build_array(attestation.actor_id)
      ) INTO endpoint
      FROM evidence.community_attestation_facts attestation
      WHERE attestation.id = endpoint_id;
    WHEN 'environmental_proof_record' THEN
      SELECT jsonb_build_object(
        'type', endpoint_type,
        'id', proof.id,
        'root', proof.record_root,
        'eventRoot', proof.audit_event_root,
        'organizationId', proof.organization_id,
        'projectId', proof.project_id,
        'occurredAt', audit.iso8601_millis(proof.issued_at),
        'state', 'current',
        'actorIds', jsonb_build_array(proof.issuer_id)
      ) INTO endpoint
      FROM certificates.environmental_proof_record_facts proof
      WHERE proof.id = endpoint_id AND proof.status = 'issued';
    ELSE
      RAISE EXCEPTION 'CANOPYPROOF_MRV_ENDPOINT_TYPE_NOT_ENABLED: %', endpoint_type;
  END CASE;
  IF endpoint IS NULL THEN
    RAISE EXCEPTION 'CANOPYPROOF_MRV_ENDPOINT_NOT_FOUND: %/%', endpoint_type, endpoint_id;
  END IF;
  RETURN endpoint || jsonb_build_object('endpointHash', mrv.endpoint_hash(endpoint));
END;
$$;

CREATE OR REPLACE FUNCTION mrv.resolve_methodology(target_methodology_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE
  methodology jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', source.id,
    'version', source.version,
    'methodologyHash', source.methodology_hash,
    'publicationId', publication.id,
    'publicationRoot', publication.publication_root,
    'publishedAt', audit.iso8601_millis(publication.published_at),
    'status', 'published'
  ) INTO methodology
  FROM governance.methodologies source
  JOIN governance.methodology_publications publication
    ON publication.methodology_id = source.id
  -- Publication is an immutable authority fact. The source methodology row is
  -- intentionally not rewritten from draft to published after governance
  -- approval, so the joined publication is the canonical publication gate.
  WHERE source.id = target_methodology_id;
  IF methodology IS NULL THEN
    RAISE EXCEPTION 'CANOPYPROOF_MRV_METHODOLOGY_NOT_PUBLISHED: %', target_methodology_id;
  END IF;
  RETURN methodology || jsonb_build_object('methodologyRoot', mrv.methodology_root(methodology));
END;
$$;

CREATE OR REPLACE FUNCTION mrv.actor_is_valid(
  actor jsonb,
  expected_actor_id text,
  expected_organization_id text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  participant identity.participants%ROWTYPE;
  organization organizations.organizations%ROWTYPE;
  membership organizations.memberships%ROWTYPE;
  accreditation organizations.accreditations%ROWTYPE;
  scopes text[];
BEGIN
  IF jsonb_typeof(actor) <> 'object'
     OR NOT mrv.keys_are_valid(
       actor,
       ARRAY[
         'id','participantType','role','verificationStatus','organizationId',
         'organizationVerificationStatus','participantRoot','organizationRoot',
         'membershipId','membershipStatus','membershipRoot','accreditationId',
         'accreditationStatus','accreditationRoot','accreditationScope','authorityRoot'
       ]::text[],
       ARRAY[
         'id','participantType','role','verificationStatus','organizationId',
         'organizationVerificationStatus','participantRoot','organizationRoot',
         'accreditationScope','authorityRoot'
       ]::text[]
     )
     OR actor->>'id' <> expected_actor_id
     OR actor->>'organizationId' <> expected_organization_id
     OR actor->>'verificationStatus' <> 'verified'
     OR actor->>'organizationVerificationStatus' <> 'verified'
     OR actor->>'participantRoot' !~ '^[0-9a-f]{64}$'
     OR actor->>'organizationRoot' !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(actor->'accreditationScope') <> 'array'
     OR actor->>'authorityRoot' <> mrv.actor_authority_root(actor) THEN
    RETURN false;
  END IF;
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO scopes
  FROM jsonb_array_elements_text(actor->'accreditationScope') WITH ORDINALITY AS item(value, position);
  IF NOT audit.is_sorted_unique_text_array(scopes) THEN RETURN false; END IF;
  SELECT * INTO participant FROM identity.participants WHERE id = expected_actor_id;
  SELECT * INTO organization FROM organizations.organizations WHERE id = expected_organization_id;
  IF participant.id IS NULL
     OR organization.id IS NULL
     OR participant.verification_status <> 'verified'
     OR participant.organization_id <> expected_organization_id
     OR participant.subject_hash <> actor->>'participantRoot'
     OR organization.verification_status <> 'verified'
     OR organization.profile_hash <> actor->>'organizationRoot' THEN
    RETURN false;
  END IF;
  IF actor->>'participantType' = 'agent' THEN
    RETURN actor->>'role' = 'agent'
      AND participant.participant_type = 'agent'
      AND 'agent' = ANY(participant.roles)
      AND EXISTS (
        SELECT 1 FROM identity.agent_profiles profile
        WHERE profile.id = expected_actor_id
          AND profile.status = 'active'
          AND profile.final_authority IS FALSE
      )
      AND NOT (actor ? 'membershipId')
      AND NOT (actor ? 'membershipRoot')
      AND NOT (actor ? 'accreditationId')
      AND NOT (actor ? 'accreditationStatus')
      AND NOT (actor ? 'accreditationRoot')
      AND cardinality(scopes) = 0;
  END IF;
  IF actor->>'participantType' <> 'human'
     OR actor->>'role' NOT IN ('owner','admin','verifier','researcher','community')
     OR participant.participant_type <> 'human'
     OR NOT ((actor->>'role') = ANY(participant.roles))
     OR actor->>'membershipStatus' <> 'active'
     OR actor->>'membershipRoot' !~ '^[0-9a-f]{64}$' THEN
    RETURN false;
  END IF;
  SELECT * INTO membership FROM organizations.memberships WHERE id = actor->>'membershipId';
  IF membership.id IS NULL
     OR membership.organization_id <> expected_organization_id
     OR membership.actor_id <> expected_actor_id
     OR membership.role <> actor->>'role'
     OR membership.status <> 'active'
     OR membership.audit_event_root <> actor->>'membershipRoot' THEN
    RETURN false;
  END IF;
  IF actor ? 'accreditationId' OR actor ? 'accreditationStatus'
     OR actor ? 'accreditationRoot' OR cardinality(scopes) > 0 THEN
    IF NOT (
      actor ? 'accreditationId'
      AND actor ? 'accreditationStatus'
      AND actor ? 'accreditationRoot'
      AND cardinality(scopes) > 0
    ) THEN RETURN false; END IF;
    IF actor->>'accreditationStatus' <> 'approved' THEN RETURN false; END IF;
    SELECT * INTO accreditation FROM organizations.accreditations WHERE id = actor->>'accreditationId';
    IF accreditation.id IS NULL
       OR accreditation.organization_id <> expected_organization_id
       OR accreditation.status <> 'approved'
       OR accreditation.audit_event_root <> actor->>'accreditationRoot'
       OR scopes <> ARRAY(SELECT value FROM unnest(accreditation.scope) AS value ORDER BY value) THEN
      RETURN false;
    END IF;
  END IF;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION mrv.snapshot_reviewer_is_valid(actor jsonb, expected_organization_id text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT mrv.actor_is_valid(actor, actor->>'id', expected_organization_id)
    AND actor->>'participantType' = 'human'
    AND actor->>'role' IN ('verifier','researcher')
    AND actor->>'accreditationStatus' = 'approved'
    AND actor->'accreditationScope' @> '["mrv_graph_review"]'::jsonb;
$$;

CREATE OR REPLACE FUNCTION mrv.relationship_enabled(
  source_type text,
  relationship text,
  target_type text
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT (source_type, relationship, target_type) IN (
    ('evidence_object', 'MEASURES', 'project_registration'),
    ('project_monitoring_event', 'MEASURES', 'project_registration'),
    ('community_attestation', 'CORROBORATES', 'evidence_object'),
    ('community_attestation', 'CONTRADICTS', 'evidence_object'),
    ('evidence_validation', 'ANALYZES', 'evidence_object'),
    ('ai_analysis_advisory', 'ANALYZES', 'evidence_object'),
    ('human_review', 'REVIEWS', 'evidence_object'),
    ('verification_decision', 'DECIDES', 'evidence_object'),
    ('evidence_object', 'SUPPORTS', 'environmental_proof_record'),
    ('verification_decision', 'SUPPORTS', 'environmental_proof_record'),
    ('project_monitoring_event', 'SUPPORTS', 'environmental_proof_record')
  );
$$;

CREATE TABLE IF NOT EXISTS mrv.graph_edge_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  source_type text NOT NULL,
  source_id text NOT NULL,
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  relationship text NOT NULL CHECK (relationship IN (
    'MEASURES','CORROBORATES','CONTRADICTS','ANALYZES','REVIEWS','DECIDES','SUPPORTS'
  )),
  target_type text NOT NULL,
  target_id text NOT NULL,
  target_root text NOT NULL CHECK (target_root ~ '^[0-9a-f]{64}$'),
  methodology_id text NOT NULL REFERENCES governance.methodologies(id),
  methodology_publication_root text NOT NULL CHECK (methodology_publication_root ~ '^[0-9a-f]{64}$'),
  actor_id text NOT NULL REFERENCES identity.participants(id),
  actor_mode text NOT NULL CHECK (actor_mode IN ('human','advisory_agent')),
  edge_state text NOT NULL CHECK (edge_state IN ('current','review_required')),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  created_at timestamptz NOT NULL,
  edge_hash text NOT NULL UNIQUE CHECK (edge_hash ~ '^[0-9a-f]{64}$'),
  edge_root text NOT NULL UNIQUE CHECK (edge_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (
    source_type, source_id, source_root, relationship,
    target_type, target_id, target_root, methodology_publication_root
  ),
  CHECK (fact_record->>'factType' = 'mrv_graph_edge'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->'source'->>'type' = source_type),
  CHECK (fact_record->'source'->>'id' = source_id),
  CHECK (fact_record->'source'->>'root' = source_root),
  CHECK (fact_record->>'relationship' = relationship),
  CHECK (fact_record->'target'->>'type' = target_type),
  CHECK (fact_record->'target'->>'id' = target_id),
  CHECK (fact_record->'target'->>'root' = target_root),
  CHECK (fact_record->'methodology'->>'id' = methodology_id),
  CHECK (fact_record->'methodology'->>'publicationRoot' = methodology_publication_root),
  CHECK (fact_record->'actor'->>'id' = actor_id),
  CHECK (fact_record->>'actorMode' = actor_mode),
  CHECK (fact_record->>'edgeState' = edge_state),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK ((fact_record->>'projectSequence')::bigint = project_sequence),
  CHECK (fact_record->>'previousEventRoot' = previous_event_root),
  CHECK ((fact_record->>'createdAt')::timestamptz = created_at),
  CHECK (fact_record->>'edgeHash' = edge_hash),
  CHECK (fact_record->>'edgeRoot' = edge_root),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE TABLE IF NOT EXISTS mrv.graph_snapshot_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  project_root text NOT NULL CHECK (project_root ~ '^[0-9a-f]{64}$'),
  methodology_id text NOT NULL REFERENCES governance.methodologies(id),
  methodology_publication_root text NOT NULL CHECK (methodology_publication_root ~ '^[0-9a-f]{64}$'),
  edge_count integer NOT NULL CHECK (edge_count BETWEEN 1 AND 512),
  edge_set_root text NOT NULL CHECK (edge_set_root ~ '^[0-9a-f]{64}$'),
  coverage_root text NOT NULL CHECK (coverage_root ~ '^[0-9a-f]{64}$'),
  snapshot_state text NOT NULL CHECK (snapshot_state IN ('reviewed_for_lineage','review_required')),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  snapshot_sequence bigint NOT NULL CHECK (snapshot_sequence > 0),
  previous_snapshot_root text NOT NULL CHECK (previous_snapshot_root ~ '^[0-9a-f]{64}$'),
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  reviewed_at timestamptz NOT NULL,
  snapshot_hash text NOT NULL UNIQUE CHECK (snapshot_hash ~ '^[0-9a-f]{64}$'),
  snapshot_root text NOT NULL UNIQUE CHECK (snapshot_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (project_id, snapshot_sequence),
  CHECK (fact_record->>'factType' = 'mrv_graph_snapshot'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK (fact_record->>'projectRoot' = project_root),
  CHECK (fact_record->'methodology'->>'id' = methodology_id),
  CHECK (fact_record->'methodology'->>'publicationRoot' = methodology_publication_root),
  CHECK ((fact_record->>'edgeCount')::integer = edge_count),
  CHECK (fact_record->>'edgeSetRoot' = edge_set_root),
  CHECK (fact_record->'coverage'->>'coverageRoot' = coverage_root),
  CHECK (fact_record->>'state' = snapshot_state),
  CHECK (fact_record->'reviewer'->>'id' = reviewer_id),
  CHECK ((fact_record->>'snapshotSequence')::bigint = snapshot_sequence),
  CHECK (fact_record->>'previousSnapshotRoot' = previous_snapshot_root),
  CHECK (fact_record->>'commandHash' = command_hash),
  CHECK ((fact_record->>'projectSequence')::bigint = project_sequence),
  CHECK (fact_record->>'previousEventRoot' = previous_event_root),
  CHECK ((fact_record->>'reviewedAt')::timestamptz = reviewed_at),
  CHECK (fact_record->>'snapshotHash' = snapshot_hash),
  CHECK (fact_record->>'snapshotRoot' = snapshot_root),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root)
);

CREATE TABLE IF NOT EXISTS mrv.graph_snapshot_member_facts (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL REFERENCES mrv.graph_snapshot_facts(id) DEFERRABLE INITIALLY DEFERRED,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  member_index integer NOT NULL CHECK (member_index BETWEEN 0 AND 511),
  edge_id text NOT NULL REFERENCES mrv.graph_edge_facts(id),
  edge_root text NOT NULL CHECK (edge_root ~ '^[0-9a-f]{64}$'),
  member_hash text NOT NULL UNIQUE CHECK (member_hash ~ '^[0-9a-f]{64}$'),
  member_root text NOT NULL UNIQUE CHECK (member_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  UNIQUE (snapshot_id, member_index),
  UNIQUE (snapshot_id, edge_id),
  CHECK (fact_record->>'factType' = 'mrv_graph_snapshot_member'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'snapshotId' = snapshot_id),
  CHECK (fact_record->>'organizationId' = organization_id),
  CHECK (fact_record->>'projectId' = project_id),
  CHECK ((fact_record->>'memberIndex')::integer = member_index),
  CHECK (fact_record->>'edgeId' = edge_id),
  CHECK (fact_record->>'edgeRoot' = edge_root),
  CHECK (fact_record->>'memberHash' = member_hash),
  CHECK (fact_record->>'memberRoot' = member_root)
);

CREATE INDEX IF NOT EXISTS mrv_graph_edges_project_sequence
  ON mrv.graph_edge_facts (organization_id, project_id, project_sequence, id);
CREATE INDEX IF NOT EXISTS mrv_graph_edges_methodology
  ON mrv.graph_edge_facts (project_id, methodology_publication_root, edge_root, id);
CREATE INDEX IF NOT EXISTS mrv_graph_snapshots_project_sequence
  ON mrv.graph_snapshot_facts (organization_id, project_id, snapshot_sequence DESC, id);
CREATE INDEX IF NOT EXISTS mrv_graph_snapshot_members_manifest
  ON mrv.graph_snapshot_member_facts (snapshot_id, member_index, id);

CREATE OR REPLACE FUNCTION mrv.edge_command_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-mrv-graph-edge-command-v1') ||
    (record - ARRAY[
      'factType','id','commandHash','projectSequence','previousEventRoot',
      'edgeHash','edgeRoot','safety','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION mrv.edge_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-mrv-graph-edge-v1') ||
    (record - ARRAY['factType','edgeHash','edgeRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION mrv.edge_root(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-mrv-graph-edge-root-v1',
    'sourceRoot', record->'source'->>'root',
    'targetRoot', record->'target'->>'root',
    'methodologyPublicationRoot', record->'methodology'->>'publicationRoot',
    'relationship', record->>'relationship',
    'commandHash', record->>'commandHash',
    'edgeHash', record->>'edgeHash',
    'projectSequence', (record->>'projectSequence')::bigint,
    'previousEventRoot', record->>'previousEventRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION mrv.snapshot_command_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-mrv-graph-snapshot-command-v1') ||
    (record - ARRAY[
      'factType','id','commandHash','projectSequence','previousEventRoot',
      'snapshotHash','snapshotRoot','safety','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION mrv.snapshot_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-mrv-graph-snapshot-v1') ||
    (record - ARRAY['factType','snapshotHash','snapshotRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION mrv.snapshot_root(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-mrv-graph-snapshot-root-v1',
    'projectRoot', record->>'projectRoot',
    'methodologyPublicationRoot', record->'methodology'->>'publicationRoot',
    'edgeSetRoot', record->>'edgeSetRoot',
    'coverageRoot', record->'coverage'->>'coverageRoot',
    'snapshotSequence', (record->>'snapshotSequence')::bigint,
    'previousSnapshotRoot', record->>'previousSnapshotRoot',
    'commandHash', record->>'commandHash',
    'snapshotHash', record->>'snapshotHash',
    'projectSequence', (record->>'projectSequence')::bigint,
    'previousEventRoot', record->>'previousEventRoot'
  ));
$$;

CREATE OR REPLACE FUNCTION mrv.member_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-mrv-graph-snapshot-member-v1') ||
    (record - ARRAY['factType','id','memberHash','memberRoot','safety']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION mrv.member_root(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-mrv-graph-snapshot-member-root-v1') ||
    (record - ARRAY['factType','memberRoot','safety']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION mrv.payload_hash(record jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(record - 'auditEvent');
$$;

CREATE OR REPLACE FUNCTION mrv.validate_edge_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  source_snapshot jsonb;
  target_snapshot jsonb;
  methodology_snapshot jsonb;
  semantic_event audit.domain_events%ROWTYPE;
  expected_state text;
  expected_action text;
  limitation_hashes text[];
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  source_snapshot := mrv.resolve_endpoint(NEW.source_type, NEW.source_id);
  target_snapshot := mrv.resolve_endpoint(NEW.target_type, NEW.target_id);
  methodology_snapshot := mrv.resolve_methodology(NEW.methodology_id);
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  expected_state := CASE
    WHEN source_snapshot->>'state' = 'current'
      AND target_snapshot->>'state' = 'current'
      AND NEW.relationship <> 'CONTRADICTS'
      THEN 'current'
    ELSE 'review_required'
  END;
  expected_action := CASE
    WHEN NEW.relationship = 'CONTRADICTS' THEN 'CHALLENGE'
    WHEN NEW.relationship = 'DECIDES' THEN 'FULFILL'
    WHEN NEW.relationship IN ('ANALYZES','REVIEWS') THEN 'REASON'
    ELSE 'ASSERT'
  END;
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO limitation_hashes
  FROM jsonb_array_elements_text(NEW.fact_record->'limitationHashes') WITH ORDINALITY AS item(value, position);

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.actor_id
     OR transaction_organization_id <> NEW.organization_id
     OR mrv.has_forbidden_key(NEW.fact_record)
     OR NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','source','relationship','target',
         'methodology','actor','actorMode','reasonHash','limitationHashes','edgeState',
         'commandHash','projectSequence','previousEventRoot','createdAt','edgeHash',
         'edgeRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','source','relationship','target',
         'methodology','actor','actorMode','reasonHash','limitationHashes','edgeState',
         'commandHash','projectSequence','previousEventRoot','createdAt','edgeHash',
         'edgeRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.fact_record->'source' <> source_snapshot
     OR NEW.fact_record->'target' <> target_snapshot
     OR NEW.fact_record->'methodology' <> methodology_snapshot
     OR source_snapshot->>'organizationId' <> NEW.organization_id
     OR target_snapshot->>'organizationId' <> NEW.organization_id
     OR source_snapshot->>'projectId' <> NEW.project_id
     OR target_snapshot->>'projectId' <> NEW.project_id
     OR (NEW.source_type = NEW.target_type AND NEW.source_id = NEW.target_id)
     OR NOT mrv.relationship_enabled(NEW.source_type, NEW.relationship, NEW.target_type)
     OR NOT ((source_snapshot->'actorIds') @> jsonb_build_array(NEW.actor_id))
     OR NOT COALESCE(mrv.actor_is_valid(NEW.fact_record->'actor', NEW.actor_id, NEW.organization_id), false)
     OR (NEW.fact_record->'actor'->>'participantType' = 'agent' AND (
       NEW.relationship <> 'ANALYZES' OR NEW.source_type <> 'ai_analysis_advisory'
     ))
     OR NEW.actor_mode <> (CASE
       WHEN NEW.fact_record->'actor'->>'participantType' = 'agent' THEN 'advisory_agent'
       ELSE 'human'
     END)
     OR (source_snapshot->>'occurredAt')::timestamptz > NEW.created_at
     OR (target_snapshot->>'occurredAt')::timestamptz > NEW.created_at
     OR (methodology_snapshot->>'publishedAt')::timestamptz > NEW.created_at
     OR NEW.created_at <> date_trunc('milliseconds', NEW.created_at)
     OR NEW.fact_record->>'reasonHash' !~ '^[0-9a-f]{64}$'
     OR jsonb_typeof(NEW.fact_record->'limitationHashes') <> 'array'
     OR cardinality(limitation_hashes) > 32
     OR NOT audit.is_sorted_unique_text_array(limitation_hashes)
     OR EXISTS (SELECT 1 FROM unnest(limitation_hashes) AS value WHERE value !~ '^[0-9a-f]{64}$')
     OR NEW.edge_state <> expected_state
     OR NEW.fact_record->'safety' <> mrv.safety_canonical()
     OR NEW.command_hash <> mrv.edge_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_mrv_edge_' || left(NEW.command_hash, 24)
     OR NEW.edge_hash <> mrv.edge_hash(NEW.fact_record)
     OR NEW.edge_root <> mrv.edge_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_MRV_EDGE_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'mrv-project:' || NEW.project_id
     OR semantic_event.sequence_no <> NEW.project_sequence
     OR semantic_event.action <> expected_action
     OR semantic_event.actor_id <> NEW.actor_id
     OR semantic_event.entity_type <> 'mrv_graph_edge'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.created_at
     OR semantic_event.payload_hash <> mrv.payload_hash(NEW.fact_record)
     OR NEW.fact_record->'auditEvent' <> mrv.audit_event_record(semantic_event)
     OR semantic_event.rationale <>
       'A bounded MRV lineage edge was appended without changing source-domain authority.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_MRV_EDGE_EVENT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mrv.validate_snapshot_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  transaction_actor_id text;
  transaction_organization_id text;
  project_record projects.projects%ROWTYPE;
  methodology_snapshot jsonb;
  semantic_event audit.domain_events%ROWTYPE;
  previous_snapshot mrv.graph_snapshot_facts%ROWTYPE;
  expected_previous_root text;
  expected_edge_ids text[];
  expected_edge_roots text[];
  expected_edge_count integer;
  observed_counts jsonb;
  expected_coverage jsonb;
  expected_issues text[] := ARRAY[]::text[];
  expected_state text;
  submitted_edge_ids text[];
  submitted_edge_roots text[];
  submitted_issues text[];
  limitation_hashes text[];
  required_relationship text;
BEGIN
  transaction_actor_id := NULLIF(btrim(current_setting('app.actor_id', true)), '');
  transaction_organization_id := NULLIF(btrim(current_setting('app.organization_id', true)), '');
  SELECT * INTO STRICT project_record FROM projects.projects WHERE id = NEW.project_id FOR SHARE;
  methodology_snapshot := mrv.resolve_methodology(NEW.methodology_id);
  SELECT * INTO STRICT semantic_event FROM audit.domain_events WHERE event_root = NEW.audit_event_root;
  SELECT candidate.* INTO previous_snapshot
  FROM mrv.graph_snapshot_facts candidate
  WHERE candidate.organization_id = NEW.organization_id AND candidate.project_id = NEW.project_id
  ORDER BY candidate.snapshot_sequence DESC, candidate.id DESC
  LIMIT 1;
  expected_previous_root := COALESCE(
    previous_snapshot.snapshot_root,
    mrv.snapshot_genesis(NEW.project_id, NEW.project_root)
  );
  SELECT
    COALESCE(array_agg(edge.id ORDER BY edge.edge_root, edge.id), ARRAY[]::text[]),
    COALESCE(array_agg(edge.edge_root ORDER BY edge.edge_root, edge.id), ARRAY[]::text[]),
    count(*)::integer
  INTO expected_edge_ids, expected_edge_roots, expected_edge_count
  FROM mrv.graph_edge_facts edge
  WHERE edge.organization_id = NEW.organization_id
    AND edge.project_id = NEW.project_id
    AND edge.methodology_publication_root = NEW.methodology_publication_root;
  SELECT COALESCE(jsonb_object_agg(relationship, relationship_count ORDER BY relationship), '{}'::jsonb)
  INTO observed_counts
  FROM (
    SELECT edge.relationship, count(*)::integer AS relationship_count
    FROM mrv.graph_edge_facts edge
    WHERE edge.organization_id = NEW.organization_id
      AND edge.project_id = NEW.project_id
      AND edge.methodology_publication_root = NEW.methodology_publication_root
    GROUP BY edge.relationship
  ) counts;
  expected_coverage := jsonb_build_object(
    'requiredRelationships', jsonb_build_array('MEASURES','REVIEWS','DECIDES','SUPPORTS'),
    'observedRelationshipCounts', observed_counts
  );
  expected_coverage := expected_coverage || jsonb_build_object(
    'coverageRoot', audit.sha256_stable_json(
      jsonb_build_object('kind', 'canopyproof-mrv-graph-coverage-v1') || expected_coverage
    )
  );
  FOREACH required_relationship IN ARRAY ARRAY['MEASURES','REVIEWS','DECIDES','SUPPORTS']::text[]
  LOOP
    IF NOT (observed_counts ? required_relationship) THEN
      expected_issues := array_append(expected_issues, 'missing_' || lower(required_relationship));
    END IF;
  END LOOP;
  IF EXISTS (
    SELECT 1 FROM mrv.graph_edge_facts edge
    WHERE edge.organization_id = NEW.organization_id
      AND edge.project_id = NEW.project_id
      AND edge.methodology_publication_root = NEW.methodology_publication_root
      AND edge.edge_state <> 'current'
  ) THEN
    expected_issues := array_append(expected_issues, 'edge_review_required');
  END IF;
  SELECT ARRAY(SELECT DISTINCT value FROM unnest(expected_issues) AS value ORDER BY value)
  INTO expected_issues;
  expected_state := CASE WHEN cardinality(expected_issues) = 0
    THEN 'reviewed_for_lineage' ELSE 'review_required' END;
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO submitted_edge_ids
  FROM jsonb_array_elements_text(NEW.fact_record->'edgeIds') WITH ORDINALITY AS item(value, position);
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO submitted_edge_roots
  FROM jsonb_array_elements_text(NEW.fact_record->'edgeRoots') WITH ORDINALITY AS item(value, position);
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO submitted_issues
  FROM jsonb_array_elements_text(NEW.fact_record->'issueCodes') WITH ORDINALITY AS item(value, position);
  SELECT COALESCE(array_agg(value ORDER BY position), ARRAY[]::text[])
  INTO limitation_hashes
  FROM jsonb_array_elements_text(NEW.fact_record->'limitationHashes') WITH ORDINALITY AS item(value, position);

  IF transaction_actor_id IS NULL
     OR transaction_organization_id IS NULL
     OR transaction_actor_id <> NEW.reviewer_id
     OR transaction_organization_id <> NEW.organization_id
     OR mrv.has_forbidden_key(NEW.fact_record)
     OR NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','projectRoot','methodology',
         'edgeIds','edgeRoots','edgeSetRoot','edgeCount','coverage','state','issueCodes',
         'reviewer','conflictDisclosureHash','limitationHashes','snapshotSequence',
         'previousSnapshotRoot','commandHash','projectSequence','previousEventRoot',
         'reviewedAt','snapshotHash','snapshotRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','projectRoot','methodology',
         'edgeIds','edgeRoots','edgeSetRoot','edgeCount','coverage','state','issueCodes',
         'reviewer','conflictDisclosureHash','limitationHashes','snapshotSequence',
         'previousSnapshotRoot','commandHash','projectSequence','previousEventRoot',
         'reviewedAt','snapshotHash','snapshotRoot','safety','auditEvent'
       ]::text[]
     )
     OR project_record.organization_id <> NEW.organization_id
     OR project_record.project_root <> NEW.project_root
     OR NEW.fact_record->'methodology' <> methodology_snapshot
     OR NOT COALESCE(mrv.snapshot_reviewer_is_valid(NEW.fact_record->'reviewer', NEW.organization_id), false)
     OR EXISTS (
       SELECT 1 FROM mrv.graph_edge_facts edge
       WHERE edge.organization_id = NEW.organization_id
         AND edge.project_id = NEW.project_id
         AND edge.methodology_publication_root = NEW.methodology_publication_root
         AND edge.actor_id = NEW.reviewer_id
     )
     OR EXISTS (
       SELECT 1 FROM mrv.graph_edge_facts edge
       WHERE edge.organization_id = NEW.organization_id
         AND edge.project_id = NEW.project_id
         AND edge.methodology_publication_root = NEW.methodology_publication_root
         AND edge.created_at > NEW.reviewed_at
     )
     OR NEW.reviewed_at <> date_trunc('milliseconds', NEW.reviewed_at)
     OR expected_edge_count = 0
     OR submitted_edge_ids <> expected_edge_ids
     OR submitted_edge_roots <> expected_edge_roots
     OR NEW.edge_count <> expected_edge_count
     OR NEW.edge_set_root <> audit.merkle_root(expected_edge_roots)
     OR NEW.fact_record->'coverage' <> expected_coverage
     OR submitted_issues <> expected_issues
     OR NEW.snapshot_state <> expected_state
     OR NEW.snapshot_sequence <> COALESCE(previous_snapshot.snapshot_sequence + 1, 1)
     OR NEW.previous_snapshot_root <> expected_previous_root
     OR NEW.fact_record->>'conflictDisclosureHash' !~ '^[0-9a-f]{64}$'
     OR cardinality(limitation_hashes) > 32
     OR NOT audit.is_sorted_unique_text_array(limitation_hashes)
     OR EXISTS (SELECT 1 FROM unnest(limitation_hashes) AS value WHERE value !~ '^[0-9a-f]{64}$')
     OR NEW.fact_record->'safety' <> mrv.safety_canonical()
     OR NEW.command_hash <> mrv.snapshot_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_mrv_snapshot_' || left(NEW.command_hash, 24)
     OR NEW.snapshot_hash <> mrv.snapshot_hash(NEW.fact_record)
     OR NEW.snapshot_root <> mrv.snapshot_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_MRV_SNAPSHOT_AUTHORITY_INVALID';
  END IF;

  IF semantic_event.stream_id <> 'mrv-project:' || NEW.project_id
     OR semantic_event.sequence_no <> NEW.project_sequence
     OR semantic_event.action <> (CASE
       WHEN NEW.snapshot_state = 'reviewed_for_lineage' THEN 'ASSERT' ELSE 'CHALLENGE'
     END)
     OR semantic_event.actor_id <> NEW.reviewer_id
     OR semantic_event.entity_type <> 'mrv_graph_snapshot'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.created_at <> NEW.reviewed_at
     OR semantic_event.payload_hash <> mrv.payload_hash(NEW.fact_record)
     OR NEW.fact_record->'auditEvent' <> mrv.audit_event_record(semantic_event)
     OR semantic_event.rationale <>
       'An independent human reviewed an immutable MRV edge manifest for lineage only, without issuing proof.' THEN
    RAISE EXCEPTION 'CANOPYPROOF_MRV_SNAPSHOT_EVENT_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mrv.validate_member_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  snapshot mrv.graph_snapshot_facts%ROWTYPE;
  edge mrv.graph_edge_facts%ROWTYPE;
BEGIN
  SELECT * INTO STRICT snapshot FROM mrv.graph_snapshot_facts WHERE id = NEW.snapshot_id FOR SHARE;
  SELECT * INTO STRICT edge FROM mrv.graph_edge_facts WHERE id = NEW.edge_id FOR SHARE;
  IF mrv.has_forbidden_key(NEW.fact_record)
     OR NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','snapshotId','organizationId','projectId','memberIndex',
         'edgeId','edgeRoot','memberHash','memberRoot','safety'
       ]::text[],
       ARRAY[
         'factType','id','snapshotId','organizationId','projectId','memberIndex',
         'edgeId','edgeRoot','memberHash','memberRoot','safety'
       ]::text[]
     )
     OR NEW.organization_id <> snapshot.organization_id
     OR NEW.project_id <> snapshot.project_id
     OR NEW.organization_id <> edge.organization_id
     OR NEW.project_id <> edge.project_id
     OR NEW.edge_root <> edge.edge_root
     OR NEW.fact_record->'safety' <> mrv.safety_canonical()
     OR NEW.member_hash <> mrv.member_hash(NEW.fact_record)
     OR NEW.id <> 'cp_mrv_snapshot_member_' || left(NEW.member_hash, 24)
     OR NEW.member_root <> mrv.member_root(NEW.fact_record) THEN
    RAISE EXCEPTION 'CANOPYPROOF_MRV_SNAPSHOT_MEMBER_AUTHORITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION mrv.validate_snapshot_members_complete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  member_count integer;
  member_indexes integer[];
  member_edge_ids text[];
  member_edge_roots text[];
  expected_indexes integer[];
BEGIN
  SELECT
    count(*)::integer,
    COALESCE(array_agg(member.member_index ORDER BY member.member_index), ARRAY[]::integer[]),
    COALESCE(array_agg(member.edge_id ORDER BY member.member_index), ARRAY[]::text[]),
    COALESCE(array_agg(member.edge_root ORDER BY member.member_index), ARRAY[]::text[])
  INTO member_count, member_indexes, member_edge_ids, member_edge_roots
  FROM mrv.graph_snapshot_member_facts member
  WHERE member.snapshot_id = NEW.id;
  SELECT COALESCE(array_agg(value), ARRAY[]::integer[])
  INTO expected_indexes
  FROM generate_series(0, NEW.edge_count - 1) AS value;
  IF member_count <> NEW.edge_count
     OR member_indexes <> expected_indexes
     OR to_jsonb(member_edge_ids) <> NEW.fact_record->'edgeIds'
     OR to_jsonb(member_edge_roots) <> NEW.fact_record->'edgeRoots'
     OR NEW.edge_set_root <> audit.merkle_root(member_edge_roots) THEN
    RAISE EXCEPTION 'CANOPYPROOF_MRV_SNAPSHOT_MEMBERS_INCOMPLETE';
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS mrv_graph_edge_validate ON mrv.graph_edge_facts;
CREATE TRIGGER mrv_graph_edge_validate
BEFORE INSERT ON mrv.graph_edge_facts
FOR EACH ROW EXECUTE FUNCTION mrv.validate_edge_insert();

DROP TRIGGER IF EXISTS mrv_graph_snapshot_validate ON mrv.graph_snapshot_facts;
CREATE TRIGGER mrv_graph_snapshot_validate
BEFORE INSERT ON mrv.graph_snapshot_facts
FOR EACH ROW EXECUTE FUNCTION mrv.validate_snapshot_insert();

DROP TRIGGER IF EXISTS mrv_graph_snapshot_member_validate ON mrv.graph_snapshot_member_facts;
CREATE TRIGGER mrv_graph_snapshot_member_validate
BEFORE INSERT ON mrv.graph_snapshot_member_facts
FOR EACH ROW EXECUTE FUNCTION mrv.validate_member_insert();

DROP TRIGGER IF EXISTS mrv_graph_snapshot_members_complete ON mrv.graph_snapshot_facts;
CREATE CONSTRAINT TRIGGER mrv_graph_snapshot_members_complete
AFTER INSERT ON mrv.graph_snapshot_facts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION mrv.validate_snapshot_members_complete();

DO $$
DECLARE
  relation_name text;
BEGIN
  FOREACH relation_name IN ARRAY ARRAY[
    'graph_edge_facts', 'graph_snapshot_facts', 'graph_snapshot_member_facts'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON mrv.%I', relation_name || '_append_only', relation_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON mrv.%I FOR EACH ROW EXECUTE FUNCTION mrv.reject_mutation()',
      relation_name || '_append_only', relation_name
    );
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS mrv_graph_edge_audit ON mrv.graph_edge_facts;
CREATE TRIGGER mrv_graph_edge_audit
AFTER INSERT OR UPDATE OR DELETE ON mrv.graph_edge_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS mrv_graph_snapshot_audit ON mrv.graph_snapshot_facts;
CREATE TRIGGER mrv_graph_snapshot_audit
AFTER INSERT OR UPDATE OR DELETE ON mrv.graph_snapshot_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS mrv_graph_snapshot_member_audit ON mrv.graph_snapshot_member_facts;
CREATE TRIGGER mrv_graph_snapshot_member_audit
AFTER INSERT OR UPDATE OR DELETE ON mrv.graph_snapshot_member_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE mrv.graph_edge_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrv.graph_edge_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE mrv.graph_snapshot_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrv.graph_snapshot_facts FORCE ROW LEVEL SECURITY;
ALTER TABLE mrv.graph_snapshot_member_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE mrv.graph_snapshot_member_facts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mrv_graph_edge_tenant ON mrv.graph_edge_facts;
CREATE POLICY mrv_graph_edge_tenant ON mrv.graph_edge_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS mrv_graph_snapshot_tenant ON mrv.graph_snapshot_facts;
CREATE POLICY mrv_graph_snapshot_tenant ON mrv.graph_snapshot_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));

DROP POLICY IF EXISTS mrv_graph_snapshot_member_tenant ON mrv.graph_snapshot_member_facts;
CREATE POLICY mrv_graph_snapshot_member_tenant ON mrv.graph_snapshot_member_facts
  USING (organization_id = nullif(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = nullif(current_setting('app.organization_id', true), ''));
