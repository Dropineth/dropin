-- Execute with approved migration authority. Retain all registry, nonce,
-- admission, output and audit history. Never re-enable a used nonce by rollback.
BEGIN;
CREATE OR REPLACE FUNCTION child_stewardship.agent_verifier_active() RETURNS boolean LANGUAGE sql VOLATILE AS $$ SELECT false $$;
COMMIT;
-- Disable the optional router before rolling back application binaries.
-- The SQL pause blocks new admissions even for explicitly granted verifier roles.
