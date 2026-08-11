-- CanopyProof Visual Evidence Intelligence
-- Additive non-production schema. Applying this file does not authorize routes,
-- institutional data, FiftyOne deployment, or TerraProof spatial processing.

BEGIN;

DO $$
BEGIN
  IF to_regclass('identity.participants') IS NULL
     OR to_regclass('organizations.organizations') IS NULL
     OR to_regclass('audit.domain_events') IS NULL
     OR to_regclass('audit.command_receipts') IS NULL THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_TRUST_KERNEL_REQUIRED: apply canopyproof-os.sql first';
  END IF;
END
$$;

CREATE SCHEMA IF NOT EXISTS visual;

DO $$
BEGIN
  CREATE TYPE visual.entity_type AS ENUM (
    'acquisition_mission',
    'sensor_stream',
    'multimodal_dataset',
    'dataset_snapshot',
    'media_asset',
    'point_cloud_asset',
    'derived_visual_asset',
    'model_definition',
    'model_run',
    'embedding_index',
    'candidate_finding',
    'review_queue',
    'review_queue_snapshot',
    'review_decision',
    'field_verification_task',
    'field_verification_result',
    'hard_negative',
    'known_decoy',
    'sensor_domain_gap',
    'visual_finding',
    'visual_provenance_edge'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE visual.actor_type AS ENUM ('human', 'agent', 'device', 'service');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE visual.classification AS ENUM ('PUBLIC', 'INTERNAL', 'RESTRICTED', 'HIGHLY_RESTRICTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

CREATE OR REPLACE FUNCTION visual.expected_record_type(input visual.entity_type)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE input
    WHEN 'acquisition_mission' THEN 'acquisition_mission'
    WHEN 'sensor_stream' THEN 'sensor_stream'
    WHEN 'multimodal_dataset' THEN 'multimodal_dataset'
    WHEN 'dataset_snapshot' THEN 'dataset_snapshot'
    WHEN 'media_asset' THEN 'media_asset'
    WHEN 'point_cloud_asset' THEN 'point_cloud_asset'
    WHEN 'derived_visual_asset' THEN 'derived_visual_asset'
    WHEN 'model_definition' THEN 'model_definition'
    WHEN 'model_run' THEN 'model_run'
    WHEN 'embedding_index' THEN 'embedding_index'
    WHEN 'candidate_finding' THEN 'candidate_finding'
    WHEN 'review_queue' THEN 'review_queue'
    WHEN 'review_queue_snapshot' THEN 'review_queue_snapshot'
    WHEN 'review_decision' THEN 'review_decision'
    WHEN 'field_verification_task' THEN 'field_verification_task'
    WHEN 'field_verification_result' THEN 'field_verification_result'
    WHEN 'hard_negative' THEN 'hard_negative'
    WHEN 'known_decoy' THEN 'known_decoy'
    WHEN 'sensor_domain_gap' THEN 'sensor_domain_gap'
    WHEN 'visual_finding' THEN 'visual_finding'
    WHEN 'visual_provenance_edge' THEN 'visual_provenance_edge'
  END
$$;

CREATE OR REPLACE FUNCTION visual.expected_audit_entity_type(input visual.entity_type)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE input
    WHEN 'acquisition_mission' THEN 'visual_acquisition_mission'
    WHEN 'sensor_stream' THEN 'visual_sensor_stream'
    WHEN 'multimodal_dataset' THEN 'visual_dataset'
    WHEN 'dataset_snapshot' THEN 'visual_dataset_snapshot'
    WHEN 'media_asset' THEN 'visual_media_asset'
    WHEN 'point_cloud_asset' THEN 'visual_point_cloud_asset'
    WHEN 'derived_visual_asset' THEN 'visual_derived_asset'
    WHEN 'model_definition' THEN 'visual_model_definition'
    WHEN 'model_run' THEN 'visual_model_run'
    WHEN 'embedding_index' THEN 'visual_embedding_index'
    WHEN 'candidate_finding' THEN 'visual_candidate'
    WHEN 'review_queue' THEN 'visual_review_queue'
    WHEN 'review_queue_snapshot' THEN 'visual_review_queue_snapshot'
    WHEN 'review_decision' THEN 'visual_review_decision'
    WHEN 'field_verification_task' THEN 'visual_field_verification_task'
    WHEN 'field_verification_result' THEN 'visual_field_verification_result'
    WHEN 'hard_negative' THEN 'visual_hard_negative'
    WHEN 'known_decoy' THEN 'visual_known_decoy'
    WHEN 'sensor_domain_gap' THEN 'visual_sensor_domain_gap'
    WHEN 'visual_finding' THEN 'visual_finding'
    WHEN 'visual_provenance_edge' THEN 'visual_provenance_edge'
  END
$$;

CREATE OR REPLACE FUNCTION visual.fact_kind(input visual.entity_type)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT CASE input
    WHEN 'acquisition_mission' THEN 'visual-acquisition-mission'
    WHEN 'sensor_stream' THEN 'visual-sensor-stream'
    WHEN 'multimodal_dataset' THEN 'visual-dataset'
    WHEN 'dataset_snapshot' THEN 'visual-dataset-snapshot'
    WHEN 'media_asset' THEN 'visual-media-asset'
    WHEN 'point_cloud_asset' THEN 'visual-point-cloud-asset'
    WHEN 'derived_visual_asset' THEN 'visual-derived-asset'
    WHEN 'model_definition' THEN 'visual-model-definition'
    WHEN 'model_run' THEN 'visual-model-run'
    WHEN 'embedding_index' THEN 'visual-embedding-index'
    WHEN 'candidate_finding' THEN 'visual-candidate'
    WHEN 'review_queue' THEN 'visual-review-queue'
    WHEN 'review_queue_snapshot' THEN 'visual-review-queue-snapshot'
    WHEN 'review_decision' THEN 'visual-review-decision'
    WHEN 'field_verification_task' THEN 'visual-field-task'
    WHEN 'field_verification_result' THEN 'visual-field-result'
    WHEN 'hard_negative' THEN 'visual-hard-negative'
    WHEN 'known_decoy' THEN 'visual-known-decoy'
    WHEN 'sensor_domain_gap' THEN 'visual-sensor-domain-gap'
    WHEN 'visual_finding' THEN 'visual-finding'
    WHEN 'visual_provenance_edge' THEN 'visual-provenance-edge'
  END
$$;

CREATE OR REPLACE FUNCTION visual.authority_stream_id(
  tenant_identifier text,
  organization_identifier text,
  project_identifier text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT 'visual:' || audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-visual-authority-stream-v1',
    'tenantId', tenant_identifier,
    'organizationId', organization_identifier,
    'projectId', nullif(project_identifier, '')
  ))
$$;

CREATE OR REPLACE FUNCTION visual.safety_boundary()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '{
    "appendOnly": true,
    "tenantBound": true,
    "licenseBound": true,
    "sensorDomainBound": true,
    "humanReviewRequired": true,
    "governanceStillRequiredForProof": true,
    "fiftyOneNotAuthority": true,
    "modelCandidateNotEvidence": true,
    "notCertifiedCarbonCredit": true,
    "notCarbonTaxOffset": true,
    "notFinancialAsset": true,
    "notGuaranteedYield": true,
    "noMainnetFunds": true,
    "notAutomaticCanopyDistribution": true
  }'::jsonb
$$;

CREATE OR REPLACE FUNCTION visual.jsonb_text_array_is_unique(input jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT
    jsonb_typeof(input) = 'array'
    AND jsonb_array_length(input) = (
      SELECT count(DISTINCT value)
      FROM jsonb_array_elements_text(input)
    )
$$;

CREATE OR REPLACE FUNCTION visual.reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CANOPYPROOF_VISUAL_APPEND_ONLY: %.% cannot be updated or deleted', TG_TABLE_SCHEMA, TG_TABLE_NAME
    USING ERRCODE = '55000';
END
$$;

CREATE TABLE IF NOT EXISTS visual.authority_facts (
  entity_type visual.entity_type NOT NULL,
  id text NOT NULL,
  entity_version bigint NOT NULL DEFAULT 1,
  stream_sequence bigint NOT NULL DEFAULT 1,
  tenant_id text NOT NULL,
  organization_id text NOT NULL REFERENCES organizations.organizations(id) ON DELETE RESTRICT,
  project_id text REFERENCES projects.projects(id) ON DELETE RESTRICT,
  classification visual.classification NOT NULL,
  license_policy_id text NOT NULL,
  actor_id text NOT NULL REFERENCES identity.participants(id) ON DELETE RESTRICT,
  actor_type visual.actor_type NOT NULL,
  actor_authority_root text NOT NULL,
  created_at timestamptz NOT NULL,
  source_roots jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL,
  fact_hash text NOT NULL,
  fact_root text NOT NULL,
  prior_fact_root text NOT NULL,
  audit_event_id text NOT NULL,
  audit_event_root text NOT NULL,
  PRIMARY KEY (entity_type, id, entity_version),
  UNIQUE (entity_type, id, stream_sequence),
  UNIQUE (fact_root),
  UNIQUE (audit_event_id),
  UNIQUE (audit_event_root),
  FOREIGN KEY (audit_event_id) REFERENCES audit.domain_events(id) ON DELETE RESTRICT,
  FOREIGN KEY (audit_event_root) REFERENCES audit.domain_events(event_root) ON DELETE RESTRICT,
  CHECK (id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{2,255}$'),
  CHECK (tenant_id <> '' AND organization_id <> ''),
  CHECK (entity_version > 0 AND stream_sequence > 0),
  CHECK (entity_version = stream_sequence),
  CHECK (jsonb_typeof(source_roots) = 'array'),
  CHECK (visual.jsonb_text_array_is_unique(source_roots)),
  CHECK (jsonb_typeof(payload) = 'object'),
  CHECK (payload ->> 'recordType' = visual.expected_record_type(entity_type)),
  CHECK (fact_hash ~ '^[a-f0-9]{64}$'),
  CHECK (fact_root ~ '^[a-f0-9]{64}$'),
  CHECK (prior_fact_root ~ '^[a-f0-9]{64}$'),
  CHECK (audit_event_root ~ '^[a-f0-9]{64}$'),
  CHECK (actor_authority_root ~ '^[a-f0-9]{64}$')
);

CREATE OR REPLACE FUNCTION visual.validate_authority_fact()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  previous_root text;
  expected_fact_hash text;
  expected_fact_root text;
  expected_payload_hash text;
  expected_actor_authority_root text;
  semantic_event audit.domain_events%ROWTYPE;
  participant identity.participants%ROWTYPE;
  organization organizations.organizations%ROWTYPE;
  actor_capability text;
  actor_role text;
  semantic_genesis_root constant text := 'f9eb6f91a48893e686f0b033bd12f0308b65918aa00c91d16d8146124600f6e4';
BEGIN
  IF NEW.stream_sequence = 1 THEN
    IF NEW.entity_version <> 1 OR NEW.prior_fact_root <> semantic_genesis_root THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_SEQUENCE_INVALID: first fact must be version 1 and link to genesis';
    END IF;
  ELSE
    IF NEW.entity_type = 'review_queue_snapshot' THEN
      SELECT fact_root
        INTO previous_root
        FROM visual.authority_facts
       WHERE entity_type = NEW.entity_type
         AND id = NEW.payload ->> 'priorQueueSnapshotId'
         AND entity_version = NEW.entity_version - 1;
    ELSE
      SELECT fact_root
        INTO previous_root
        FROM visual.authority_facts
       WHERE entity_type = NEW.entity_type
         AND id = NEW.id
         AND entity_version = NEW.entity_version - 1;
    END IF;
    IF previous_root IS NULL OR previous_root <> NEW.prior_fact_root THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_SEQUENCE_INVALID: prior fact root mismatch';
    END IF;
  END IF;

  SELECT * INTO semantic_event
  FROM audit.domain_events
  WHERE id = NEW.audit_event_id;
  IF semantic_event.id IS NULL
     OR semantic_event.event_root <> NEW.audit_event_root
     OR semantic_event.stream_id <> visual.authority_stream_id(
       NEW.tenant_id,
       NEW.organization_id,
       coalesce(NEW.project_id, '')
     )
     OR semantic_event.actor_id <> NEW.actor_id
     OR semantic_event.entity_type <> visual.expected_audit_entity_type(NEW.entity_type)
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.created_at <> NEW.created_at THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_AUDIT_BINDING_INVALID: authority fact requires its exact canonical audit event';
  END IF;

  IF jsonb_typeof(NEW.payload -> 'auditEvent') <> 'object'
     OR NEW.payload -> 'auditEvent' <> jsonb_build_object(
       'id', semantic_event.id,
       'action', semantic_event.action,
       'actor', semantic_event.actor_id,
       'entityType', semantic_event.entity_type,
       'entityId', semantic_event.entity_id,
       'previousRoot', semantic_event.previous_root,
       'payloadHash', semantic_event.payload_hash,
       'eventRoot', semantic_event.event_root,
       'createdAt', audit.iso8601_millis(semantic_event.created_at),
       'rationale', semantic_event.rationale
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_AUDIT_BINDING_INVALID: embedded audit event diverges from canonical audit';
  END IF;

  IF NEW.payload ->> 'id' <> NEW.id
     OR NEW.payload ->> 'tenantId' <> NEW.tenant_id
     OR NEW.payload ->> 'organizationId' <> NEW.organization_id
     OR (NEW.payload ->> 'projectId') IS DISTINCT FROM NEW.project_id
     OR NEW.payload ->> 'classification' <> NEW.classification::text
     OR NEW.payload ->> 'licensePolicyId' <> NEW.license_policy_id
     OR NEW.payload ->> 'createdBy' <> NEW.actor_id
     OR NEW.payload ->> 'createdByActorType' <> NEW.actor_type::text
     OR NEW.payload ->> 'actorAuthorityRoot' <> NEW.actor_authority_root
     OR NEW.payload ->> 'createdAt' <> audit.iso8601_millis(NEW.created_at)
     OR NEW.payload -> 'sourceRoots' <> NEW.source_roots
     OR NEW.payload -> 'version' <> to_jsonb(NEW.entity_version)
     OR NEW.payload ->> 'factHash' <> NEW.fact_hash
     OR NEW.payload ->> 'factRoot' <> NEW.fact_root
     OR NEW.payload -> 'safety' <> visual.safety_boundary()
     OR NEW.payload -> 'actorSnapshot' ->> 'id' <> NEW.actor_id
     OR NEW.payload -> 'actorSnapshot' ->> 'actorType' <> NEW.actor_type::text
     OR NEW.payload -> 'actorSnapshot' ->> 'tenantId' <> NEW.tenant_id
     OR NEW.payload -> 'actorSnapshot' ->> 'organizationId' <> NEW.organization_id
     OR NEW.payload -> 'actorSnapshot' ->> 'authorityRoot' <> NEW.actor_authority_root THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_FACT_BINDING_INVALID: envelope columns diverge from immutable payload';
  END IF;

  expected_actor_authority_root := audit.sha256_stable_json(jsonb_strip_nulls(jsonb_build_object(
    'kind', 'canopyproof-visual-authority-actor-v1',
    'id', NEW.payload -> 'actorSnapshot' -> 'id',
    'actorType', NEW.payload -> 'actorSnapshot' -> 'actorType',
    'tenantId', NEW.payload -> 'actorSnapshot' -> 'tenantId',
    'organizationId', NEW.payload -> 'actorSnapshot' -> 'organizationId',
    'role', NEW.payload -> 'actorSnapshot' -> 'role',
    'verificationStatus', NEW.payload -> 'actorSnapshot' -> 'verificationStatus',
    'capability', NEW.payload -> 'actorSnapshot' -> 'capability',
    'accreditationId', NEW.payload -> 'actorSnapshot' -> 'accreditationId',
    'accreditationRoot', NEW.payload -> 'actorSnapshot' -> 'accreditationRoot',
    'conflictFree', NEW.payload -> 'actorSnapshot' -> 'conflictFree'
  )));
  IF NEW.actor_authority_root <> expected_actor_authority_root
     OR NEW.payload -> 'actorSnapshot' ->> 'verificationStatus' <> 'verified' THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_ACTOR_AUTHORITY_INVALID: actor authority root is not canonical';
  END IF;

  expected_payload_hash := audit.sha256_stable_json(jsonb_build_object(
    'factHash', NEW.fact_hash,
    'sourceRoots', NEW.source_roots,
    'recordType', visual.fact_kind(NEW.entity_type)
  ));
  IF semantic_event.payload_hash <> expected_payload_hash THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_AUDIT_BINDING_INVALID: semantic event payload hash is not canonical';
  END IF;

  expected_fact_hash := audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-' || visual.fact_kind(NEW.entity_type) || '-fact-v1')
    || (NEW.payload - ARRAY['factHash', 'factRoot', 'auditEvent', 'safety'])
  );
  expected_fact_root := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-' || visual.fact_kind(NEW.entity_type) || '-root-v1',
    'factHash', expected_fact_hash,
    'sourceRoots', NEW.source_roots,
    'auditEventRoot', NEW.audit_event_root
  ));
  IF NEW.fact_hash <> expected_fact_hash OR NEW.fact_root <> expected_fact_root THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_FACT_HASH_INVALID: fact hash or root is not canonical';
  END IF;

  SELECT * INTO participant
  FROM identity.participants
  WHERE id = NEW.actor_id;
  SELECT * INTO organization
  FROM organizations.organizations
  WHERE id = NEW.organization_id;
  actor_capability := NEW.payload -> 'actorSnapshot' ->> 'capability';
  actor_role := NEW.payload -> 'actorSnapshot' ->> 'role';
  IF participant.id IS NULL
     OR participant.verification_status <> 'verified'
     OR organization.id IS NULL
     OR organization.verification_status <> 'verified'
     OR participant.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_ACTOR_AUTHORITY_INVALID: actor or organization is not verified';
  END IF;

  IF NEW.actor_type = 'agent' THEN
    IF participant.participant_type <> 'agent'
       OR actor_capability IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM identity.agent_profiles profile
         WHERE profile.id = NEW.actor_id
           AND profile.status = 'active'
           AND profile.final_authority IS false
           AND actor_capability = ANY(profile.capabilities)
       ) THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_ACTOR_AUTHORITY_INVALID: agent capability is not active';
    END IF;
  ELSIF NEW.actor_type = 'human' THEN
    IF participant.participant_type <> 'human'
       OR actor_role IS NULL
       OR NOT (
         actor_role = ANY(participant.roles)
         OR (actor_role IN ('auditor', 'government', 'un_partner') AND 'verifier' = ANY(participant.roles))
       )
       OR NOT EXISTS (
         SELECT 1
         FROM organizations.memberships membership
         WHERE membership.organization_id = NEW.organization_id
           AND membership.actor_id = NEW.actor_id
           AND membership.status = 'active'
           AND (
             membership.role = actor_role
             OR (actor_role IN ('auditor', 'government', 'un_partner') AND membership.role = 'verifier')
           )
       ) THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_ACTOR_AUTHORITY_INVALID: human membership is not active';
    END IF;
  ELSE
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_ACTOR_AUTHORITY_INVALID: durable visual facts require human or agent identity';
  END IF;

  IF NEW.entity_type IN (
    'review_decision',
    'field_verification_result',
    'hard_negative',
    'known_decoy',
    'visual_finding'
  ) THEN
    IF NEW.actor_type <> 'human'
       OR NEW.payload -> 'actorSnapshot' ->> 'conflictFree' <> 'true'
       OR NOT EXISTS (
         SELECT 1
         FROM organizations.accreditations accreditation
         WHERE accreditation.id = NEW.payload -> 'actorSnapshot' ->> 'accreditationId'
           AND accreditation.organization_id = NEW.organization_id
           AND accreditation.status = 'approved'
           AND 'visual_evidence_review' = ANY(accreditation.scope)
           AND accreditation.audit_event_root = NEW.payload -> 'actorSnapshot' ->> 'accreditationRoot'
       ) THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_HUMAN_REVIEW_INVALID: independent accredited human review is required';
    END IF;
  END IF;

  IF NEW.entity_type = 'candidate_finding' THEN
    IF NEW.payload ->> 'status' <> 'CANDIDATE'
       OR NEW.payload ->> 'evidenceAuthority' <> 'NONE'
       OR NEW.payload ->> 'advisoryOnly' <> 'true' THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_MACHINE_PROOF_FORBIDDEN: candidate is advisory only';
    END IF;
  ELSIF NEW.entity_type = 'model_definition' THEN
    IF NEW.payload ->> 'advisoryOnly' <> 'true' THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_MACHINE_PROOF_FORBIDDEN: model must be advisory only';
    END IF;
  ELSIF NEW.entity_type = 'visual_finding' THEN
    IF NEW.payload ->> 'boundedObservation' <> 'true'
       OR NEW.payload ->> 'evidenceVerificationState' <> 'NOT_EVIDENCE'
       OR NEW.payload ->> 'governanceApprovalRequired' <> 'true' THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_MACHINE_PROOF_FORBIDDEN: finding is not evidence or proof';
    END IF;
  ELSIF NEW.entity_type = 'point_cloud_asset' THEN
    IF NOT (
      (NEW.payload ->> 'format' = 'LAZ' AND NEW.payload ->> 'assetRole' = 'RAW_AUTHORITATIVE')
      OR (NEW.payload ->> 'format' = 'COPC' AND NEW.payload ->> 'assetRole' = 'NORMALIZED_AUTHORITATIVE')
      OR (NEW.payload ->> 'format' = 'PCD' AND NEW.payload ->> 'assetRole' = 'REVIEW_DERIVATIVE')
    ) THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_POINT_CLOUD_ROLE_INVALID';
    END IF;
  ELSIF NEW.entity_type = 'field_verification_result' THEN
    IF coalesce(NEW.payload ->> 'deviceAttestationRoot', '') !~ '^[a-f0-9]{64}$' THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_DEVICE_ATTESTATION_REQUIRED';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS visual_authority_fact_validate ON visual.authority_facts;
CREATE TRIGGER visual_authority_fact_validate
BEFORE INSERT ON visual.authority_facts
FOR EACH ROW EXECUTE FUNCTION visual.validate_authority_fact();

DROP TRIGGER IF EXISTS visual_authority_fact_immutable ON visual.authority_facts;
CREATE TRIGGER visual_authority_fact_immutable
BEFORE UPDATE OR DELETE ON visual.authority_facts
FOR EACH ROW EXECUTE FUNCTION visual.reject_mutation();

DROP TRIGGER IF EXISTS visual_authority_fact_audit ON visual.authority_facts;
CREATE TRIGGER visual_authority_fact_audit
AFTER INSERT ON visual.authority_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

CREATE TABLE IF NOT EXISTS visual.dataset_snapshot_members (
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  project_id text,
  dataset_snapshot_id text NOT NULL,
  ordinal integer NOT NULL,
  sample_id text NOT NULL,
  asset_id text NOT NULL,
  asset_version bigint NOT NULL,
  asset_root text NOT NULL,
  content_hash text NOT NULL,
  sensor_stream_id text NOT NULL,
  paired_sample_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  license_policy_id text NOT NULL,
  snapshot_fact_root text NOT NULL REFERENCES visual.authority_facts(fact_root) ON DELETE RESTRICT,
  PRIMARY KEY (tenant_id, dataset_snapshot_id, sample_id),
  UNIQUE (tenant_id, dataset_snapshot_id, ordinal),
  CHECK (ordinal >= 0 AND asset_version > 0),
  CHECK (asset_root ~ '^[a-f0-9]{64}$' AND content_hash ~ '^[a-f0-9]{64}$'),
  CHECK (visual.jsonb_text_array_is_unique(paired_sample_ids))
);

DROP TRIGGER IF EXISTS visual_dataset_snapshot_member_immutable ON visual.dataset_snapshot_members;
CREATE TRIGGER visual_dataset_snapshot_member_immutable
BEFORE UPDATE OR DELETE ON visual.dataset_snapshot_members
FOR EACH ROW EXECUTE FUNCTION visual.reject_mutation();

CREATE TABLE IF NOT EXISTS visual.review_queue_snapshots (
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  project_id text,
  id text NOT NULL,
  review_queue_id text NOT NULL,
  version bigint NOT NULL,
  dataset_snapshot_id text NOT NULL,
  dataset_manifest_hash text NOT NULL,
  sample_ids jsonb NOT NULL,
  candidate_ids jsonb NOT NULL,
  filter_expression text NOT NULL,
  sort_expression text NOT NULL,
  model_run_ids jsonb NOT NULL,
  random_qa_seed_hash text,
  prior_queue_snapshot_id text,
  review_queue_hash text NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  snapshot_fact_root text NOT NULL REFERENCES visual.authority_facts(fact_root) ON DELETE RESTRICT,
  PRIMARY KEY (tenant_id, id),
  UNIQUE (tenant_id, review_queue_id, version),
  UNIQUE (tenant_id, review_queue_id, review_queue_hash),
  FOREIGN KEY (tenant_id, prior_queue_snapshot_id)
    REFERENCES visual.review_queue_snapshots(tenant_id, id)
    ON DELETE RESTRICT,
  CHECK (version > 0),
  CHECK (dataset_manifest_hash ~ '^[a-f0-9]{64}$'),
  CHECK (review_queue_hash ~ '^[a-f0-9]{64}$'),
  CHECK (random_qa_seed_hash IS NULL OR random_qa_seed_hash ~ '^[a-f0-9]{64}$'),
  CHECK (visual.jsonb_text_array_is_unique(sample_ids) AND jsonb_array_length(sample_ids) > 0),
  CHECK (visual.jsonb_text_array_is_unique(candidate_ids) AND jsonb_array_length(candidate_ids) > 0),
  CHECK (visual.jsonb_text_array_is_unique(model_run_ids) AND jsonb_array_length(model_run_ids) > 0),
  CHECK (filter_expression <> '' AND sort_expression <> '')
);

CREATE OR REPLACE FUNCTION visual.validate_review_queue_snapshot()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  prior_queue_id text;
  prior_version bigint;
BEGIN
  IF NEW.version = 1 THEN
    IF NEW.prior_queue_snapshot_id IS NOT NULL THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_QUEUE_VERSION_INVALID: version 1 cannot have prior snapshot';
    END IF;
  ELSE
    SELECT review_queue_id, version
      INTO prior_queue_id, prior_version
      FROM visual.review_queue_snapshots
     WHERE tenant_id = NEW.tenant_id
       AND id = NEW.prior_queue_snapshot_id;
    IF prior_queue_id IS NULL
       OR prior_queue_id <> NEW.review_queue_id
       OR prior_version <> NEW.version - 1 THEN
      RAISE EXCEPTION 'CANOPYPROOF_VISUAL_QUEUE_VERSION_INVALID: prior snapshot mismatch';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM jsonb_array_elements_text(NEW.candidate_ids) requested(candidate_id)
      LEFT JOIN visual.authority_facts candidate
        ON candidate.entity_type = 'candidate_finding'
       AND candidate.id = requested.candidate_id
       AND candidate.tenant_id = NEW.tenant_id
       AND candidate.organization_id = NEW.organization_id
       AND candidate.project_id IS NOT DISTINCT FROM NEW.project_id
     WHERE candidate.id IS NULL
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_QUEUE_MEMBERSHIP_INVALID: missing or cross-scope candidate';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS visual_review_queue_snapshot_validate ON visual.review_queue_snapshots;
CREATE TRIGGER visual_review_queue_snapshot_validate
BEFORE INSERT ON visual.review_queue_snapshots
FOR EACH ROW EXECUTE FUNCTION visual.validate_review_queue_snapshot();

DROP TRIGGER IF EXISTS visual_review_queue_snapshot_immutable ON visual.review_queue_snapshots;
CREATE TRIGGER visual_review_queue_snapshot_immutable
BEFORE UPDATE OR DELETE ON visual.review_queue_snapshots
FOR EACH ROW EXECUTE FUNCTION visual.reject_mutation();

DROP TRIGGER IF EXISTS visual_review_queue_snapshot_audit ON visual.review_queue_snapshots;
CREATE TRIGGER visual_review_queue_snapshot_audit
AFTER INSERT ON visual.review_queue_snapshots
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

CREATE TABLE IF NOT EXISTS visual.review_queue_members (
  tenant_id text NOT NULL,
  organization_id text NOT NULL,
  project_id text,
  review_queue_snapshot_id text NOT NULL,
  ordinal integer NOT NULL,
  sample_id text NOT NULL,
  candidate_id text NOT NULL,
  model_run_id text NOT NULL,
  candidate_fact_root text NOT NULL REFERENCES visual.authority_facts(fact_root) ON DELETE RESTRICT,
  PRIMARY KEY (tenant_id, review_queue_snapshot_id, candidate_id),
  UNIQUE (tenant_id, review_queue_snapshot_id, ordinal),
  FOREIGN KEY (tenant_id, review_queue_snapshot_id)
    REFERENCES visual.review_queue_snapshots(tenant_id, id)
    ON DELETE RESTRICT,
  CHECK (ordinal >= 0)
);

DROP TRIGGER IF EXISTS visual_review_queue_member_immutable ON visual.review_queue_members;
CREATE TRIGGER visual_review_queue_member_immutable
BEFORE UPDATE OR DELETE ON visual.review_queue_members
FOR EACH ROW EXECUTE FUNCTION visual.reject_mutation();

CREATE INDEX IF NOT EXISTS visual_authority_facts_scope_created_idx
  ON visual.authority_facts (tenant_id, organization_id, project_id, entity_type, created_at DESC);
CREATE INDEX IF NOT EXISTS visual_authority_facts_source_roots_idx
  ON visual.authority_facts USING gin (source_roots);
CREATE INDEX IF NOT EXISTS visual_authority_facts_payload_idx
  ON visual.authority_facts USING gin (payload jsonb_path_ops);
CREATE INDEX IF NOT EXISTS visual_review_queue_snapshots_current_idx
  ON visual.review_queue_snapshots (tenant_id, review_queue_id, version DESC);
CREATE INDEX IF NOT EXISTS visual_review_queue_members_sample_idx
  ON visual.review_queue_members (tenant_id, review_queue_snapshot_id, sample_id);

ALTER TABLE visual.authority_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual.dataset_snapshot_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual.review_queue_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE visual.review_queue_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS visual_authority_facts_tenant ON visual.authority_facts;
CREATE POLICY visual_authority_facts_tenant ON visual.authority_facts
  USING (tenant_id = nullif(current_setting('canopyproof.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('canopyproof.tenant_id', true), ''));

DROP POLICY IF EXISTS visual_dataset_snapshot_members_tenant ON visual.dataset_snapshot_members;
CREATE POLICY visual_dataset_snapshot_members_tenant ON visual.dataset_snapshot_members
  USING (tenant_id = nullif(current_setting('canopyproof.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('canopyproof.tenant_id', true), ''));

DROP POLICY IF EXISTS visual_review_queue_snapshots_tenant ON visual.review_queue_snapshots;
CREATE POLICY visual_review_queue_snapshots_tenant ON visual.review_queue_snapshots
  USING (tenant_id = nullif(current_setting('canopyproof.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('canopyproof.tenant_id', true), ''));

DROP POLICY IF EXISTS visual_review_queue_members_tenant ON visual.review_queue_members;
CREATE POLICY visual_review_queue_members_tenant ON visual.review_queue_members
  USING (tenant_id = nullif(current_setting('canopyproof.tenant_id', true), ''))
  WITH CHECK (tenant_id = nullif(current_setting('canopyproof.tenant_id', true), ''));

COMMIT;
