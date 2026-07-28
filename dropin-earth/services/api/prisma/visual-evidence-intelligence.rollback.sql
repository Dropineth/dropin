-- Destructive rollback is allowed only before authoritative facts exist.
-- Operational rollback normally disables routes/workers/manifests and preserves
-- this schema for audit, challenge, and replay.

BEGIN;

DO $$
BEGIN
  IF to_regclass('visual.authority_facts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM visual.authority_facts LIMIT 1) THEN
    RAISE EXCEPTION 'CANOPYPROOF_VISUAL_ROLLBACK_BLOCKED: authority facts must be preserved';
  END IF;
END
$$;

DROP SCHEMA IF EXISTS visual CASCADE;

COMMIT;
