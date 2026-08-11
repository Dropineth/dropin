-- Destructive rollback for the route-closed organization lifecycle authority.
-- Do not run after production activation. Canonical facts must be preserved.

BEGIN;

DO $$
BEGIN
  IF to_regclass('organizations.organization_lifecycle_facts') IS NOT NULL
    AND (
      EXISTS (SELECT 1 FROM organizations.organization_lifecycle_facts)
      OR EXISTS (SELECT 1 FROM organizations.organization_document_review_facts)
      OR EXISTS (SELECT 1 FROM organizations.organization_appeal_facts)
      OR EXISTS (SELECT 1 FROM organizations.organization_appeal_decision_facts)
    )
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ORGANIZATION_LIFECYCLE_ROLLBACK_BLOCKED_FACTS_EXIST';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS organizations_lifecycle_projection_guard ON organizations.organizations;
DROP TRIGGER IF EXISTS organization_lifecycle_apply_projection ON organizations.organization_lifecycle_facts;
DROP TRIGGER IF EXISTS organization_lifecycle_validate ON organizations.organization_lifecycle_facts;
DROP TRIGGER IF EXISTS organization_document_review_validate ON organizations.organization_document_review_facts;
DROP TRIGGER IF EXISTS organization_appeal_validate ON organizations.organization_appeal_facts;
DROP TRIGGER IF EXISTS organization_appeal_decision_validate ON organizations.organization_appeal_decision_facts;

DROP TRIGGER IF EXISTS organization_lifecycle_no_update ON organizations.organization_lifecycle_facts;
DROP TRIGGER IF EXISTS organization_lifecycle_no_delete ON organizations.organization_lifecycle_facts;
DROP TRIGGER IF EXISTS organization_lifecycle_audit ON organizations.organization_lifecycle_facts;
DROP TRIGGER IF EXISTS organization_document_review_no_update ON organizations.organization_document_review_facts;
DROP TRIGGER IF EXISTS organization_document_review_no_delete ON organizations.organization_document_review_facts;
DROP TRIGGER IF EXISTS organization_document_review_audit ON organizations.organization_document_review_facts;
DROP TRIGGER IF EXISTS organization_appeal_no_update ON organizations.organization_appeal_facts;
DROP TRIGGER IF EXISTS organization_appeal_no_delete ON organizations.organization_appeal_facts;
DROP TRIGGER IF EXISTS organization_appeal_audit ON organizations.organization_appeal_facts;
DROP TRIGGER IF EXISTS organization_appeal_decision_no_update ON organizations.organization_appeal_decision_facts;
DROP TRIGGER IF EXISTS organization_appeal_decision_no_delete ON organizations.organization_appeal_decision_facts;
DROP TRIGGER IF EXISTS organization_appeal_decision_audit ON organizations.organization_appeal_decision_facts;

DROP POLICY IF EXISTS organization_lifecycle_tenant ON organizations.organization_lifecycle_facts;
DROP POLICY IF EXISTS organization_document_review_tenant ON organizations.organization_document_review_facts;
DROP POLICY IF EXISTS organization_appeal_tenant ON organizations.organization_appeal_facts;
DROP POLICY IF EXISTS organization_appeal_decision_tenant ON organizations.organization_appeal_decision_facts;

ALTER TABLE organizations.organization_lifecycle_facts
  DROP CONSTRAINT IF EXISTS organization_lifecycle_accepted_review_fk;
ALTER TABLE organizations.organization_lifecycle_facts
  DROP CONSTRAINT IF EXISTS organization_lifecycle_appeal_decision_fk;

DROP TABLE IF EXISTS organizations.organization_appeal_decision_facts;
DROP TABLE IF EXISTS organizations.organization_appeal_facts;
DROP TABLE IF EXISTS organizations.organization_document_review_facts;
DROP TABLE IF EXISTS organizations.organization_lifecycle_facts;

DROP FUNCTION IF EXISTS organizations.apply_organization_lifecycle_projection();
DROP FUNCTION IF EXISTS organizations.guard_organization_lifecycle_projection_update();
DROP FUNCTION IF EXISTS organizations.validate_organization_appeal_decision_insert();
DROP FUNCTION IF EXISTS organizations.validate_organization_appeal_insert();
DROP FUNCTION IF EXISTS organizations.validate_organization_document_review_insert();
DROP FUNCTION IF EXISTS organizations.validate_organization_lifecycle_insert();
DROP FUNCTION IF EXISTS organizations.organization_authority_event_is_valid(jsonb, text, text, text, text, timestamptz);
DROP FUNCTION IF EXISTS organizations.organization_governance_actor_is_current(jsonb, text, text, text, text[]);
DROP FUNCTION IF EXISTS organizations.organization_subject_actor_is_current(jsonb, text, text, text);
DROP FUNCTION IF EXISTS organizations.organization_authority_latest_event_root(text);
DROP FUNCTION IF EXISTS organizations.organization_authority_latest_sequence(text);
DROP FUNCTION IF EXISTS organizations.organization_document_review_source_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_authority_fact_root(jsonb, text, text);
DROP FUNCTION IF EXISTS organizations.organization_authority_fact_hash(jsonb, text);
DROP FUNCTION IF EXISTS organizations.organization_appeal_decision_command_hash(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_appeal_command_hash(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_document_review_command_hash(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_lifecycle_command_hash(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_appeal_decision_source_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_appeal_evidence_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_lifecycle_source_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_lifecycle_document_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_authority_merkle_root(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_authority_roots_are_sorted_unique(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_authority_document_is_minimized(jsonb);
DROP FUNCTION IF EXISTS organizations.organization_registration_reference_root(text, text);
DROP FUNCTION IF EXISTS organizations.organization_lifecycle_safety_canonical();

COMMIT;
