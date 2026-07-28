-- Fail-closed rollback for the route-closed early-warning authority.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM impact.early_warning_review_facts)
    OR EXISTS (SELECT 1 FROM impact.early_warning_publication_facts)
    OR EXISTS (SELECT 1 FROM impact.early_warning_control_facts)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_EARLY_WARNING_ROLLBACK_REFUSES_NON_EMPTY_AUTHORITY'
      USING ERRCODE = 'object_not_in_prerequisite_state';
  END IF;
END;
$$;

DROP TABLE IF EXISTS impact.early_warning_control_facts;
DROP TABLE IF EXISTS impact.early_warning_publication_facts;
DROP TABLE IF EXISTS impact.early_warning_review_facts;

DROP FUNCTION IF EXISTS impact.validate_early_warning_control_insert();
DROP FUNCTION IF EXISTS impact.validate_early_warning_publication_insert();
DROP FUNCTION IF EXISTS impact.validate_early_warning_review_insert();
DROP FUNCTION IF EXISTS impact.early_warning_latest_publication_root(text,text,text);
DROP FUNCTION IF EXISTS impact.early_warning_latest_event_root(text,text,text);
DROP FUNCTION IF EXISTS impact.early_warning_latest_event_sequence(text,text,text);
DROP FUNCTION IF EXISTS impact.validate_early_warning_candidate(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_preparer_is_current(jsonb,text,text);
DROP FUNCTION IF EXISTS impact.early_warning_human_actor_is_current(jsonb,text,text,text,text[]);
DROP FUNCTION IF EXISTS impact.early_warning_control_root(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_control_command_hash(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_publication_root(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_publication_command_hash(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_projection_root(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_review_root(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_review_command_hash(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_candidate_root(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_source_authority_root(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_member_root(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_indicator_member_root(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_source_member_root(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_candidate_text_is_safe(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_document_is_minimized(jsonb);
DROP FUNCTION IF EXISTS impact.early_warning_json_has_exact_keys(jsonb,text[]);
DROP FUNCTION IF EXISTS impact.early_warning_safety_canonical();

COMMIT;
