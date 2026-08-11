-- Destructive rollback for disposable, unpopulated E1a installations only.
-- Production rollback must disable writers and preserve committed facts.

DO $$
BEGIN
  IF to_regclass('identity.device_attestation_verification_facts') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM identity.device_attestation_verification_facts LIMIT 1
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_E1A_ROLLBACK_REFUSED: device verification facts exist';
  END IF;
END;
$$;

DROP FUNCTION IF EXISTS evidence.effective_device_attestation_projection(text, timestamptz);
DROP TRIGGER IF EXISTS identity_e1a_verification_validate
  ON identity.device_attestation_verification_facts;
DROP TRIGGER IF EXISTS identity_e1a_verification_append_only
  ON identity.device_attestation_verification_facts;
DROP TRIGGER IF EXISTS identity_e1a_verification_audit
  ON identity.device_attestation_verification_facts;
DROP FUNCTION IF EXISTS evidence.validate_e1a_verification_insert();
DROP FUNCTION IF EXISTS evidence.e1a_fact_root(identity.device_attestation_verification_facts);
DROP FUNCTION IF EXISTS evidence.e1a_command_hash(identity.device_attestation_verification_facts);
DROP FUNCTION IF EXISTS evidence.e1a_verification_root(identity.device_attestation_verification_facts);
DROP FUNCTION IF EXISTS evidence.e1a_adapter_verification_root(identity.device_attestation_verification_facts);
DROP TABLE IF EXISTS identity.device_attestation_verification_facts;
DROP FUNCTION IF EXISTS evidence.e1a_keys_are_valid(jsonb, text[], text[]);
DROP FUNCTION IF EXISTS evidence.e1a_has_forbidden_key(jsonb);
DROP FUNCTION IF EXISTS evidence.e1a_safety_canonical();
