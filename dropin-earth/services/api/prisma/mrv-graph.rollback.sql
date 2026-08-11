-- Roll back only the route-closed Digital MRV Graph authority slice.
-- Source-domain facts and semantic audit events are intentionally retained.

DO $$
BEGIN
  IF to_regclass('mrv.graph_edge_facts') IS NOT NULL AND (
    EXISTS (SELECT 1 FROM mrv.graph_edge_facts)
    OR EXISTS (SELECT 1 FROM mrv.graph_snapshot_facts)
    OR EXISTS (SELECT 1 FROM mrv.graph_snapshot_member_facts)
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_MRV_ROLLBACK_REQUIRES_EMPTY_AUTHORITY';
  END IF;
END;
$$;

DROP SCHEMA IF EXISTS mrv CASCADE;
