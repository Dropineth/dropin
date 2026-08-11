-- Destructive rollback for the route-closed project lifecycle authority.
-- Refuses to erase any durable fact. Export and govern a migration before
-- attempting a rollback of a non-empty authority.

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM projects.project_lifecycle_registration_facts LIMIT 1)
    OR EXISTS (SELECT 1 FROM projects.project_lifecycle_review_facts LIMIT 1)
    OR EXISTS (SELECT 1 FROM projects.project_lifecycle_transition_facts LIMIT 1)
    OR EXISTS (SELECT 1 FROM projects.project_lifecycle_control_facts LIMIT 1)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_ROLLBACK_BLOCKED_FACTS_EXIST';
  END IF;
END;
$$;

DROP TABLE IF EXISTS projects.project_lifecycle_control_facts;
DROP TABLE IF EXISTS projects.project_lifecycle_transition_facts;
DROP TABLE IF EXISTS projects.project_lifecycle_review_facts;
DROP TABLE IF EXISTS projects.project_lifecycle_registration_facts;

DROP FUNCTION IF EXISTS projects.validate_project_lifecycle_fact_insert();
DROP FUNCTION IF EXISTS projects.project_lifecycle_validate_semantic_event(jsonb, text, text, text, text, text);
DROP FUNCTION IF EXISTS projects.project_lifecycle_current_stage(text, text);
DROP FUNCTION IF EXISTS projects.project_lifecycle_fact_root(jsonb, text);
DROP FUNCTION IF EXISTS projects.project_lifecycle_control_command_hash(jsonb);
DROP FUNCTION IF EXISTS projects.project_lifecycle_transition_command_hash(jsonb);
DROP FUNCTION IF EXISTS projects.project_lifecycle_review_command_hash(jsonb);
DROP FUNCTION IF EXISTS projects.project_lifecycle_registration_command_hash(jsonb);
DROP FUNCTION IF EXISTS projects.project_lifecycle_source_root(jsonb);
DROP FUNCTION IF EXISTS projects.project_lifecycle_monitoring_plan_root(jsonb);
DROP FUNCTION IF EXISTS projects.project_lifecycle_intervention_root(jsonb);
DROP FUNCTION IF EXISTS projects.project_lifecycle_baseline_root(jsonb);
DROP FUNCTION IF EXISTS projects.project_lifecycle_text_array_is_sorted_unique(jsonb, integer, integer);
DROP FUNCTION IF EXISTS projects.project_lifecycle_hash_array_is_sorted_unique(jsonb, integer, integer);
DROP FUNCTION IF EXISTS projects.project_lifecycle_document_is_minimized(jsonb);
DROP FUNCTION IF EXISTS projects.project_lifecycle_safety_canonical();

COMMIT;
