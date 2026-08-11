-- Destructive rollback is permitted only before canonical funding facts exist.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM funding.accountability_review_facts LIMIT 1)
    OR EXISTS (SELECT 1 FROM funding.accountability_publication_facts LIMIT 1)
    OR EXISTS (SELECT 1 FROM funding.accountability_control_facts LIMIT 1)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_FUNDING_ACCOUNTABILITY_ROLLBACK_REFUSED_NON_EMPTY';
  END IF;
END;
$$;

DROP TABLE IF EXISTS funding.accountability_control_facts;
DROP TABLE IF EXISTS funding.accountability_publication_facts;
DROP TABLE IF EXISTS funding.accountability_review_facts;

DROP FUNCTION IF EXISTS funding.validate_accountability_control_insert();
DROP FUNCTION IF EXISTS funding.validate_accountability_publication_insert();
DROP FUNCTION IF EXISTS funding.validate_accountability_review_insert();
DROP FUNCTION IF EXISTS funding.validate_accountability_candidate(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_actor_is_current(jsonb, text, text, text, text[]);
DROP FUNCTION IF EXISTS funding.accountability_control_root(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_control_command_hash(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_publication_root(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_publication_command_hash(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_projection_root(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_review_root(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_review_command_hash(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_candidate_root(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_source_authority_root(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_milestone_root(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_member_root(text, jsonb);
DROP FUNCTION IF EXISTS funding.accountability_document_is_minimized(jsonb);
DROP FUNCTION IF EXISTS funding.accountability_json_has_exact_keys(jsonb, text[]);
DROP FUNCTION IF EXISTS funding.accountability_safety_canonical();

COMMIT;
