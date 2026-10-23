-- Pause privacy workers and public privacy processing before rollback.
-- Never remove suppression tombstones, deletion receipts, holds or backup-expiry tasks.
BEGIN;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
-- Application rollback must continue checking durable suppressions before views or writes.
