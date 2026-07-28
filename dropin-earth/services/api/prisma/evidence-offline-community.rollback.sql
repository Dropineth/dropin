-- Disposable-install rollback for CanopyProof Evidence Protocol E4.
-- Production authority is append-only; this script refuses destructive rollback.

DO $$
DECLARE
  fact_count bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM evidence.offline_sync_batch_facts) +
    (SELECT count(*) FROM evidence.offline_sync_item_facts) +
    (SELECT count(*) FROM evidence.community_attestation_facts)
  INTO fact_count;
  IF fact_count > 0 THEN
    RAISE EXCEPTION 'CANOPYPROOF_E4_ROLLBACK_REFUSED: % committed facts must be preserved', fact_count;
  END IF;
END;
$$;

DROP TABLE IF EXISTS evidence.offline_sync_item_facts;
DROP TABLE IF EXISTS evidence.community_attestation_facts;
DROP TABLE IF EXISTS evidence.offline_sync_batch_facts;

DROP FUNCTION IF EXISTS evidence.validate_e4_community_attestation_insert();
DROP FUNCTION IF EXISTS evidence.validate_e4_offline_bundle_complete();
DROP FUNCTION IF EXISTS evidence.validate_e4_offline_item_insert();
DROP FUNCTION IF EXISTS evidence.validate_e4_offline_batch_insert();
DROP FUNCTION IF EXISTS evidence.e4_payload_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e4_community_genesis(text, text);
DROP FUNCTION IF EXISTS evidence.e4_community_root(jsonb);
DROP FUNCTION IF EXISTS evidence.e4_community_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e4_community_command_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e4_offline_batch_command_hash(jsonb, jsonb);
DROP FUNCTION IF EXISTS evidence.e4_offline_batch_genesis(text, text);
DROP FUNCTION IF EXISTS evidence.e4_offline_batch_root(jsonb);
DROP FUNCTION IF EXISTS evidence.e4_offline_batch_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e4_offline_item_root(jsonb);
DROP FUNCTION IF EXISTS evidence.e4_offline_item_hash(jsonb);
DROP FUNCTION IF EXISTS evidence.e4_keys_are_valid(jsonb, text[], text[]);
DROP FUNCTION IF EXISTS evidence.e4_has_forbidden_key(jsonb);
DROP FUNCTION IF EXISTS evidence.e4_safety_canonical();
DROP FUNCTION IF EXISTS evidence.e4_reject_mutation();
