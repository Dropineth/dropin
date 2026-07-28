-- Empty-only rollback for the route-closed organization accreditation authority.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM organizations.organization_accreditation_application_facts)
    OR EXISTS (SELECT 1 FROM organizations.organization_accreditation_review_facts)
    OR EXISTS (SELECT 1 FROM organizations.organization_accreditation_decision_facts)
    OR EXISTS (SELECT 1 FROM organizations.organization_accreditation_control_facts)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_ACCREDITATION_ROLLBACK_BLOCKED_FACTS_EXIST';
  END IF;
END;
$$;

ALTER TABLE IF EXISTS organizations.organization_accreditation_application_facts
  DROP CONSTRAINT IF EXISTS organization_accreditation_application_prior_decision_fk;

DROP TABLE IF EXISTS organizations.organization_accreditation_control_facts;
DROP TABLE IF EXISTS organizations.organization_accreditation_decision_facts;
DROP TABLE IF EXISTS organizations.organization_accreditation_review_facts;
DROP TABLE IF EXISTS organizations.organization_accreditation_application_facts;

DROP FUNCTION IF EXISTS organizations.validate_organization_accreditation_fact_insert();
DROP FUNCTION IF EXISTS organizations.organization_accreditation_event_is_valid(jsonb, text, text, text, text, timestamptz);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_governance_actor_is_current(jsonb, text, text, text, text[], timestamptz);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_subject_actor_is_current(jsonb, text, text);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_latest_fact_time(text);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_latest_event_root(text);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_latest_sequence(text);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_fact_root(jsonb, text, text);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_fact_hash(jsonb, text);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_control_command_hash(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_decision_command_hash(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_review_command_hash(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_application_command_hash(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_actor_authority_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_control_evidence_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_decision_source_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_review_source_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_application_evidence_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_scope_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_merkle_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_scope_is_sorted_unique(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_roots_are_sorted_unique(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_document_is_minimized(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_accreditation_safety_canonical();

COMMIT;
