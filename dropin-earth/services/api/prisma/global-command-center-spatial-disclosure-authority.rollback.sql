BEGIN;

DO $$
DECLARE
  durable_fact_exists boolean := FALSE;
BEGIN
  IF to_regclass('impact.global_command_center_spatial_review_facts') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM impact.global_command_center_spatial_review_facts)'
      INTO durable_fact_exists;
  END IF;
  IF NOT durable_fact_exists
     AND to_regclass('impact.global_command_center_spatial_disclosure_facts') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM impact.global_command_center_spatial_disclosure_facts)'
      INTO durable_fact_exists;
  END IF;
  IF NOT durable_fact_exists
     AND to_regclass('impact.global_command_center_spatial_control_facts') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM impact.global_command_center_spatial_control_facts)'
      INTO durable_fact_exists;
  END IF;
  IF durable_fact_exists THEN
    RAISE EXCEPTION 'rollback refused: global command center spatial disclosure facts exist';
  END IF;
END;
$$;

DROP TABLE IF EXISTS impact.global_command_center_spatial_control_facts;
DROP TABLE IF EXISTS impact.global_command_center_spatial_disclosure_facts;
DROP TABLE IF EXISTS impact.global_command_center_spatial_review_facts;

DROP FUNCTION IF EXISTS impact.validate_global_spatial_control_insert();
DROP FUNCTION IF EXISTS impact.validate_global_spatial_disclosure_insert();
DROP FUNCTION IF EXISTS impact.validate_global_spatial_review_insert();
DROP FUNCTION IF EXISTS impact.global_spatial_actor_is_current(jsonb, text, text, text, text[]);
DROP FUNCTION IF EXISTS impact.validate_global_spatial_candidate(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_control_root(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_withdrawal_command_hash(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_publication_root(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_publication_command_hash(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_public_disclosure_root(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_review_root(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_review_command_hash(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_candidate_root(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_document_is_minimized(jsonb);
DROP FUNCTION IF EXISTS impact.global_spatial_json_has_exact_keys(jsonb, text[]);
DROP FUNCTION IF EXISTS impact.global_spatial_disclosure_safety_canonical();

COMMIT;
