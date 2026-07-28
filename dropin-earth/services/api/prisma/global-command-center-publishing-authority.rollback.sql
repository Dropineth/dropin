BEGIN;

DO $$
DECLARE
  durable_fact_exists boolean := FALSE;
BEGIN
  IF to_regclass('impact.global_command_center_publication_facts') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM impact.global_command_center_publication_facts)'
      INTO durable_fact_exists;
  END IF;
  IF durable_fact_exists THEN
    RAISE EXCEPTION 'rollback refused: global command center publication facts exist';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS impact_global_command_center_snapshot_requires_publication
  ON impact.global_command_center_snapshots;
DROP TRIGGER IF EXISTS impact_global_command_center_publication_facts_validate
  ON impact.global_command_center_publication_facts;
DROP FUNCTION IF EXISTS impact.require_global_command_center_snapshot_publication();
DROP FUNCTION IF EXISTS impact.validate_global_command_center_publication_fact();
DROP TABLE IF EXISTS impact.global_command_center_publication_facts;

COMMIT;
