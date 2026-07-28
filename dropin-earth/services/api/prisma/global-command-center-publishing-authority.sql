BEGIN;

CREATE TABLE IF NOT EXISTS impact.global_command_center_publication_facts (
  id text PRIMARY KEY,
  snapshot_id text NOT NULL UNIQUE REFERENCES impact.global_command_center_snapshots(id),
  projection_schema text NOT NULL CHECK (projection_schema = 'canopyproof.global-command-center.snapshot.v2'),
  dashboard_root text NOT NULL UNIQUE CHECK (dashboard_root ~ '^[0-9a-f]{64}$'),
  snapshot_content_root text NOT NULL UNIQUE CHECK (snapshot_content_root ~ '^[0-9a-f]{64}$'),
  source_authority_root text NOT NULL CHECK (source_authority_root ~ '^[0-9a-f]{64}$'),
  policy_id text NOT NULL CHECK (length(btrim(policy_id)) > 0),
  policy_root text NOT NULL CHECK (policy_root ~ '^[0-9a-f]{64}$'),
  approval_root text NOT NULL CHECK (approval_root ~ '^[0-9a-f]{64}$'),
  publisher_id text NOT NULL REFERENCES identity.participants(id),
  publisher_snapshot jsonb NOT NULL,
  published_at timestamptz NOT NULL,
  publication_root text NOT NULL UNIQUE CHECK (publication_root ~ '^[0-9a-f]{64}$'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  fact_record jsonb NOT NULL,
  CHECK (jsonb_typeof(publisher_snapshot) = 'object'),
  CHECK (jsonb_typeof(fact_record) = 'object'),
  CHECK (fact_record->>'factType' = 'global_command_center_snapshot_publication'),
  CHECK (fact_record->>'id' = id),
  CHECK (fact_record->>'snapshotId' = snapshot_id),
  CHECK (fact_record->>'projectionSchema' = projection_schema),
  CHECK (fact_record->>'dashboardRoot' = dashboard_root),
  CHECK (fact_record->>'snapshotContentRoot' = snapshot_content_root),
  CHECK (fact_record->>'sourceAuthorityRoot' = source_authority_root),
  CHECK (fact_record->>'policyId' = policy_id),
  CHECK (fact_record->>'policyRoot' = policy_root),
  CHECK (fact_record->'governanceApproval'->>'approvalRoot' = approval_root),
  CHECK (fact_record->'publisher'->>'id' = publisher_id),
  CHECK (publisher_snapshot->>'id' = publisher_id),
  CHECK (publisher_snapshot = fact_record->'publisher'),
  CHECK (fact_record->'publisher'->>'membershipStatus' = 'active'),
  CHECK (fact_record->'publisher'->>'accreditationStatus' = 'approved'),
  CHECK ((fact_record->'publisher'->'accreditationScope') ? 'global_command_center:publish'),
  CHECK (fact_record->'governanceApproval'->'governor'->>'participantType' = 'human'),
  CHECK (fact_record->'governanceApproval'->'governor'->>'membershipStatus' = 'active'),
  CHECK (fact_record->'governanceApproval'->'governor'->>'accreditationStatus' = 'approved'),
  CHECK ((fact_record->'governanceApproval'->'governor'->'accreditationScope') ? 'global_command_center:govern'),
  CHECK (fact_record->'governanceApproval'->'governor'->>'id' <> publisher_id),
  CHECK (fact_record->>'publicationRoot' = publication_root),
  CHECK (fact_record->'auditEvent'->>'eventRoot' = audit_event_root),
  CHECK ((fact_record->'safety'->>'routeMounted')::boolean IS FALSE),
  CHECK ((fact_record->'safety'->>'schedulerMounted')::boolean IS FALSE),
  CHECK ((fact_record->'safety'->>'productionActivationEnabled')::boolean IS FALSE),
  CHECK ((fact_record->'safety'->>'independentHumanGovernanceRequired')::boolean IS TRUE),
  CHECK ((fact_record->'safety'->>'noMainnetFunds')::boolean IS TRUE),
  CHECK ((fact_record->'safety'->>'noAutomaticCanopyDistribution')::boolean IS TRUE),
  CHECK ((fact_record->'safety'->>'notCertifiedCarbonCredit')::boolean IS TRUE),
  CHECK ((fact_record->'safety'->>'notCarbonTaxOffset')::boolean IS TRUE),
  CHECK ((fact_record->'safety'->>'notFinancialAsset')::boolean IS TRUE),
  CHECK ((fact_record->'safety'->>'notGuaranteedYield')::boolean IS TRUE)
);

CREATE INDEX IF NOT EXISTS impact_global_command_center_publications_published
  ON impact.global_command_center_publication_facts (published_at DESC, id DESC);

CREATE OR REPLACE FUNCTION impact.validate_global_command_center_publication_fact()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  semantic_event audit.domain_events%ROWTYPE;
  snapshot_dashboard_root text;
BEGIN
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events
  WHERE event_root = NEW.audit_event_root;

  IF semantic_event.stream_id <> 'global-command-center:publications'
    OR semantic_event.action <> 'ASSERT'
    OR semantic_event.actor_id <> NEW.publisher_id
    OR semantic_event.entity_type <> 'global_command_center_snapshot'
    OR semantic_event.entity_id <> NEW.id
    OR semantic_event.previous_root <> NEW.fact_record->>'previousEventRoot'
    OR semantic_event.payload_hash <> NEW.fact_record->'auditEvent'->>'payloadHash'
    OR semantic_event.event_root <> NEW.fact_record->'auditEvent'->>'eventRoot'
    OR semantic_event.created_at <> NEW.published_at
  THEN
    RAISE EXCEPTION 'global command center publication semantic event binding is invalid'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT dashboard_root INTO STRICT snapshot_dashboard_root
  FROM impact.global_command_center_snapshots
  WHERE id = NEW.snapshot_id;
  IF snapshot_dashboard_root <> NEW.dashboard_root THEN
    RAISE EXCEPTION 'global command center publication snapshot binding is invalid'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS impact_global_command_center_publication_facts_validate
  ON impact.global_command_center_publication_facts;
CREATE TRIGGER impact_global_command_center_publication_facts_validate
BEFORE INSERT ON impact.global_command_center_publication_facts
FOR EACH ROW EXECUTE FUNCTION impact.validate_global_command_center_publication_fact();

CREATE OR REPLACE FUNCTION impact.require_global_command_center_snapshot_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  publication_count integer;
BEGIN
  SELECT count(*)::integer INTO publication_count
  FROM impact.global_command_center_publication_facts publication
  WHERE publication.snapshot_id = NEW.id
    AND publication.dashboard_root = NEW.dashboard_root;
  IF publication_count <> 1 THEN
    RAISE EXCEPTION 'global command center snapshot requires exactly one governed publication fact'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS impact_global_command_center_snapshot_requires_publication
  ON impact.global_command_center_snapshots;
CREATE CONSTRAINT TRIGGER impact_global_command_center_snapshot_requires_publication
AFTER INSERT ON impact.global_command_center_snapshots
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION impact.require_global_command_center_snapshot_publication();

DROP TRIGGER IF EXISTS impact_global_command_center_publication_facts_no_update
  ON impact.global_command_center_publication_facts;
CREATE TRIGGER impact_global_command_center_publication_facts_no_update
BEFORE UPDATE ON impact.global_command_center_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();

DROP TRIGGER IF EXISTS impact_global_command_center_publication_facts_no_delete
  ON impact.global_command_center_publication_facts;
CREATE TRIGGER impact_global_command_center_publication_facts_no_delete
BEFORE DELETE ON impact.global_command_center_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.prevent_event_log_update_or_delete();

DROP TRIGGER IF EXISTS impact_global_command_center_publication_facts_audit
  ON impact.global_command_center_publication_facts;
CREATE TRIGGER impact_global_command_center_publication_facts_audit
AFTER INSERT OR UPDATE OR DELETE ON impact.global_command_center_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

COMMIT;
