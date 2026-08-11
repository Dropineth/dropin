-- Fail-closed rollback for the project-lifecycle governed-policy subject.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM governance.proof_policy_versions WHERE subject = 'project_lifecycle'
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_PROJECT_LIFECYCLE_SOURCE_RESOLVER_ROLLBACK_BLOCKED_POLICY_EXISTS';
  END IF;
END;
$$;

ALTER TABLE governance.proof_policy_versions
  DROP CONSTRAINT IF EXISTS proof_policy_versions_subject_check;

ALTER TABLE governance.proof_policy_versions
  ADD CONSTRAINT proof_policy_versions_subject_check CHECK (
    subject IN ('methodology_publication', 'environmental_proof_record')
  ) NOT VALID;

ALTER TABLE governance.proof_policy_versions
  VALIDATE CONSTRAINT proof_policy_versions_subject_check;

COMMIT;
