-- Pause API submission before applying this fail-closed rollback.
-- Keep grants, uses, replay history and the observation guard intact.
BEGIN;
CREATE OR REPLACE FUNCTION child_stewardship.issue_draft_authorization(raw_bearer text,proposal jsonb) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
BEGIN RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION child_stewardship.consume_draft_authorization(raw_proof text,tenant uuid,actor_ref text,command jsonb) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$
BEGIN RETURN false; END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
-- Explicit runtime EXECUTE grants cannot bypass the deny-only function bodies.
