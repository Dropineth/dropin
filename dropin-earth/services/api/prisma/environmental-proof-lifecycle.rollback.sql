-- Roll back only the route-closed Environmental Proof lifecycle authority.
-- Canonical Environmental Proof Records, MRV facts, and audit streams are
-- deliberately outside this rollback boundary.

DO $$
BEGIN
  IF to_regclass('governance.environmental_proof_signing_key_attestation_facts') IS NOT NULL
     AND (
       EXISTS (SELECT 1 FROM governance.environmental_proof_signing_key_attestation_facts)
       OR EXISTS (SELECT 1 FROM governance.environmental_proof_signing_key_revocation_facts)
       OR EXISTS (SELECT 1 FROM certificates.environmental_proof_lifecycle_binding_facts)
       OR EXISTS (SELECT 1 FROM certificates.environmental_proof_signature_receipt_facts)
       OR EXISTS (SELECT 1 FROM governance.environmental_proof_lifecycle_control_facts)
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CERTIFICATE_LIFECYCLE_ROLLBACK_REQUIRES_EMPTY_AUTHORITY';
  END IF;
END;
$$;

DROP TABLE IF EXISTS governance.environmental_proof_lifecycle_control_facts;
DROP TABLE IF EXISTS certificates.environmental_proof_signature_receipt_facts;
DROP TABLE IF EXISTS certificates.environmental_proof_lifecycle_binding_facts;
DROP TABLE IF EXISTS governance.environmental_proof_signing_key_revocation_facts;
DROP TABLE IF EXISTS governance.environmental_proof_signing_key_attestation_facts;

DROP FUNCTION IF EXISTS certificates.validate_environmental_proof_lifecycle_control_insert();
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_projection(text, timestamptz);
DROP FUNCTION IF EXISTS certificates.validate_environmental_proof_signature_receipt_insert();
DROP FUNCTION IF EXISTS certificates.validate_environmental_proof_lifecycle_binding_insert();
DROP FUNCTION IF EXISTS certificates.validate_environmental_proof_signing_key_revocation_insert();
DROP FUNCTION IF EXISTS certificates.validate_environmental_proof_signing_key_insert();
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_control_root(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_control_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_control_command_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signature_receipt_root(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signature_receipt_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signature_receipt_command_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signature_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_binding_root(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_binding_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_binding_command_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_signature_payload_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_binding_authority_seed(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signing_key_revocation_root(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signing_key_revocation_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signing_key_revocation_command_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signing_key_root(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signing_key_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_signing_key_command_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_text_is_safe(text);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_external_verifier_is_valid(text, text);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_actor_is_valid(jsonb, text, text, text[], text);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_event_is_contiguous(text);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_payload_hash(jsonb);
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_safety_canonical();
DROP FUNCTION IF EXISTS certificates.environmental_proof_lifecycle_reject_mutation();
