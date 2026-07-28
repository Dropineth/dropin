-- Destructive rollback for disposable, unpopulated E2a installations only.
-- Production rollback must disable writers and preserve committed authority.

DO $$
BEGIN
  IF to_regclass('evidence.media_provider_receipt_verification_facts') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM evidence.media_provider_receipt_verification_facts LIMIT 1
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E2A_ROLLBACK_REFUSED: provider verification facts exist';
  END IF;
  IF to_regclass('evidence.media_scanner_receipt_verification_facts') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM evidence.media_scanner_receipt_verification_facts LIMIT 1
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E2A_ROLLBACK_REFUSED: scanner verification facts exist';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS evidence.effective_media_object_projection(text, timestamptz);
DROP FUNCTION IF EXISTS evidence.effective_media_safety_canonical();
DROP FUNCTION IF EXISTS evidence.media_adapter_trust_projection(text, timestamptz);
DROP TRIGGER IF EXISTS evidence_e2a_scanner_validate
  ON evidence.media_scanner_receipt_verification_facts;
DROP TRIGGER IF EXISTS evidence_e2a_scanner_append_only
  ON evidence.media_scanner_receipt_verification_facts;
DROP TRIGGER IF EXISTS evidence_e2a_scanner_audit
  ON evidence.media_scanner_receipt_verification_facts;
DROP TRIGGER IF EXISTS evidence_e2a_provider_validate
  ON evidence.media_provider_receipt_verification_facts;
DROP TRIGGER IF EXISTS evidence_e2a_provider_append_only
  ON evidence.media_provider_receipt_verification_facts;
DROP TRIGGER IF EXISTS evidence_e2a_provider_audit
  ON evidence.media_provider_receipt_verification_facts;
DROP FUNCTION IF EXISTS evidence.validate_e2a_scanner_verification_insert();
DROP FUNCTION IF EXISTS evidence.validate_e2a_provider_verification_insert();
DROP FUNCTION IF EXISTS evidence.e2a_scanner_fact_root(evidence.media_scanner_receipt_verification_facts);
DROP FUNCTION IF EXISTS evidence.e2a_scanner_command_hash(evidence.media_scanner_receipt_verification_facts);
DROP FUNCTION IF EXISTS evidence.e2a_scanner_verification_root(evidence.media_scanner_receipt_verification_facts);
DROP FUNCTION IF EXISTS evidence.e2a_scanner_receipt_hash(evidence.media_scanner_receipt_verification_facts);
DROP FUNCTION IF EXISTS evidence.e2a_provider_fact_root(evidence.media_provider_receipt_verification_facts);
DROP FUNCTION IF EXISTS evidence.e2a_provider_command_hash(evidence.media_provider_receipt_verification_facts);
DROP FUNCTION IF EXISTS evidence.e2a_provider_verification_root(evidence.media_provider_receipt_verification_facts);
DROP FUNCTION IF EXISTS evidence.e2a_provider_receipt_hash(evidence.media_provider_receipt_verification_facts);
DROP FUNCTION IF EXISTS evidence.e2a_provider_receipt_seed(evidence.media_provider_receipt_verification_facts);
DROP TABLE IF EXISTS evidence.media_scanner_receipt_verification_facts;
DROP TABLE IF EXISTS evidence.media_provider_receipt_verification_facts;
DROP FUNCTION IF EXISTS evidence.e2a_safety_canonical();
