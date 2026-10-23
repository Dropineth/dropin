-- Stop application traffic before rollback. Never drop quarantine or replay facts.
BEGIN;
CREATE OR REPLACE FUNCTION child_stewardship.restore_execution_permitted(tenant uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$ SELECT false $$;
CREATE OR REPLACE FUNCTION child_stewardship.restore_cleanup_permitted(tenant uuid) RETURNS boolean LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,child_stewardship AS $$ SELECT false $$;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
-- A reviewed forward migration and a fresh externally anchored verification are
-- required to resume. This script cannot make an old backup authoritative.
