-- Destructive rollback for disposable, unpopulated E3b installations only.
-- Production rollback must disable writers and preserve committed authority.

DO $$
BEGIN
  IF to_regclass('evidence.media_metadata_extraction_facts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM evidence.media_metadata_extraction_facts LIMIT 1) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_ROLLBACK_REFUSED: metadata facts exist';
  END IF;
  IF to_regclass('evidence.retention_decision_facts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM evidence.retention_decision_facts LIMIT 1) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_ROLLBACK_REFUSED: retention decisions exist';
  END IF;
  IF to_regclass('evidence.retention_execution_facts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM evidence.retention_execution_facts LIMIT 1) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3B_ROLLBACK_REFUSED: retention executions exist';
  END IF;
END;
$$;

DROP TABLE IF EXISTS evidence.retention_execution_facts;
DROP TABLE IF EXISTS evidence.retention_decision_facts;
DROP TABLE IF EXISTS evidence.media_metadata_extraction_facts;

DROP FUNCTION IF EXISTS evidence.validate_e3b_retention_execution_insert();
DROP FUNCTION IF EXISTS evidence.validate_e3b_retention_decision_insert();
DROP FUNCTION IF EXISTS evidence.validate_e3b_metadata_fact_insert();
DROP FUNCTION IF EXISTS evidence.e3b_payload_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_execution_genesis(text, text, text);
DROP FUNCTION IF EXISTS evidence.e3b_execution_root(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_execution_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_execution_command_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_execution_command_seed(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_decision_genesis(text, text, text);
DROP FUNCTION IF EXISTS evidence.e3b_decision_root(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_decision_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_decision_command_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_decision_command_seed(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_metadata_genesis(text);
DROP FUNCTION IF EXISTS evidence.e3b_metadata_root(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_metadata_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_metadata_command_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_metadata_command_seed(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_keys_are_valid(jsonb, text[], text[]);
DROP FUNCTION IF EXISTS evidence.e3b_has_forbidden_key(jsonb);
DROP FUNCTION IF EXISTS evidence.e3b_safety_canonical();
DROP FUNCTION IF EXISTS evidence.e3b_reject_mutation();
