-- Destructive rollback for disposable, unpopulated E3c installations only.
-- Production rollback must disable writers and preserve committed facts.

DO $$
BEGIN
  IF to_regclass('evidence.metadata_extraction_verification_facts') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM evidence.metadata_extraction_verification_facts LIMIT 1
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3C_ROLLBACK_REFUSED: metadata verification facts exist';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS evidence.metadata_extraction_trust_projection(text, timestamptz);
DROP TRIGGER IF EXISTS evidence_e3c_verification_validate
  ON evidence.metadata_extraction_verification_facts;
DROP TRIGGER IF EXISTS evidence_e3c_verification_append_only
  ON evidence.metadata_extraction_verification_facts;
DROP TRIGGER IF EXISTS evidence_e3c_verification_audit
  ON evidence.metadata_extraction_verification_facts;
DROP FUNCTION IF EXISTS evidence.validate_e3c_verification_insert();
DROP FUNCTION IF EXISTS evidence.e3c_fact_root(evidence.metadata_extraction_verification_facts);
DROP FUNCTION IF EXISTS evidence.e3c_command_hash(evidence.metadata_extraction_verification_facts);
DROP FUNCTION IF EXISTS evidence.e3c_verification_root(evidence.metadata_extraction_verification_facts);
DROP TABLE IF EXISTS evidence.metadata_extraction_verification_facts;
DROP FUNCTION IF EXISTS evidence.e3c_has_forbidden_key(jsonb);
DROP FUNCTION IF EXISTS evidence.e3c_safety_canonical();
