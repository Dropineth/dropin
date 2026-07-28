-- Empty-only rollback for the route-closed root-governance authority.

DO $$
BEGIN
  IF to_regclass('governance.root_governance_proposal_facts') IS NOT NULL
    AND EXISTS (SELECT 1 FROM governance.root_governance_proposal_facts)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_ROLLBACK_BLOCKED_FACTS_EXIST';
  END IF;
  IF to_regclass('governance.root_governance_attestation_facts') IS NOT NULL
    AND EXISTS (SELECT 1 FROM governance.root_governance_attestation_facts)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_ROLLBACK_BLOCKED_FACTS_EXIST';
  END IF;
  IF to_regclass('governance.root_governance_decision_facts') IS NOT NULL
    AND EXISTS (SELECT 1 FROM governance.root_governance_decision_facts)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_ROOT_GOVERNANCE_ROLLBACK_BLOCKED_FACTS_EXIST';
  END IF;
END;
$$;

ALTER TABLE IF EXISTS governance.root_governance_proposal_facts
  DROP CONSTRAINT IF EXISTS root_governance_proposal_predecessor_fk;
ALTER TABLE IF EXISTS governance.root_governance_proposal_facts
  DROP CONSTRAINT IF EXISTS root_governance_proposal_target_fk;

DROP TABLE IF EXISTS governance.root_governance_attestation_facts;
DROP TABLE IF EXISTS governance.root_governance_decision_facts;
DROP TABLE IF EXISTS governance.root_governance_proposal_facts;

DROP FUNCTION IF EXISTS governance.validate_root_governance_fact_insert();
DROP FUNCTION IF EXISTS governance.root_governance_member_in_council(jsonb, jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_event_is_valid(jsonb, text, text, text, text, timestamptz);
DROP FUNCTION IF EXISTS governance.root_governance_decision_root(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_decision_hash(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_decision_command_hash(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_attestation_root(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_attestation_hash(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_attestation_command_hash(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_verification_receipt_root(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_signature_hash(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_signed_payload_root(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_proposal_root(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_proposal_hash(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_proposal_command_hash(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_proposal_evidence_root(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_council_root(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_member_is_current(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_council_is_valid(jsonb, integer);
DROP FUNCTION IF EXISTS governance.root_governance_member_is_valid(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_member_root(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_public_key_fingerprint(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_text_array_is_sorted_unique(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_semver_is_greater(text, text);
DROP FUNCTION IF EXISTS governance.root_governance_roots_are_sorted_unique(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_document_is_minimized(jsonb);
DROP FUNCTION IF EXISTS governance.root_governance_safety_canonical();
