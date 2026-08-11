-- Destructive rollback for disposable, unpopulated E3d installations only.
-- Production rollback must disable writers and preserve committed requests.

DO $$
BEGIN
  IF to_regclass('evidence.metadata_extraction_request_facts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM evidence.metadata_extraction_request_facts LIMIT 1) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E3D_ROLLBACK_REFUSED: metadata extraction requests exist';
  END IF;
END;
$$;

DROP POLICY IF EXISTS evidence_e3d_request_tenant
  ON evidence.metadata_extraction_request_facts;
DROP TRIGGER IF EXISTS evidence_e3d_request_validate
  ON evidence.metadata_extraction_request_facts;
DROP TRIGGER IF EXISTS evidence_e3d_request_append_only
  ON evidence.metadata_extraction_request_facts;
DROP TRIGGER IF EXISTS evidence_e3d_request_audit
  ON evidence.metadata_extraction_request_facts;
DROP FUNCTION IF EXISTS evidence.validate_e3d_request_insert();
DROP FUNCTION IF EXISTS evidence.e3d_request_root(evidence.metadata_extraction_request_facts);
DROP FUNCTION IF EXISTS evidence.e3d_request_command_hash(evidence.metadata_extraction_request_facts);
DROP FUNCTION IF EXISTS evidence.e3d_request_hash(evidence.metadata_extraction_request_facts);
DROP FUNCTION IF EXISTS evidence.e3d_request_seed(evidence.metadata_extraction_request_facts);
DROP TABLE IF EXISTS evidence.metadata_extraction_request_facts;
DROP FUNCTION IF EXISTS evidence.e3d_has_forbidden_key(jsonb);
DROP FUNCTION IF EXISTS evidence.e3d_request_safety_canonical();
