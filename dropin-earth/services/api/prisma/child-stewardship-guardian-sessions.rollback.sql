-- Stop guardian-session ingress first. Run only through reviewed migration authority.
-- Preserve bindings, one-use authentication IDs, counters and audit evidence.
BEGIN;
CREATE OR REPLACE FUNCTION child_stewardship_guardian.runtime_allowed() RETURNS boolean LANGUAGE sql STABLE
SECURITY DEFINER SET search_path=pg_catalog,child_stewardship_guardian AS $$ SELECT false $$;
UPDATE child_stewardship_guardian.sessions SET revoked=true WHERE NOT revoked;
UPDATE child_stewardship_guardian.bindings SET revoked=true WHERE NOT revoked;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship_guardian FROM PUBLIC;
COMMIT;
-- A forward migration alone cannot revive revoked bindings or sessions. Fresh
-- reviewed binding/authentication and current restore admission are required.
