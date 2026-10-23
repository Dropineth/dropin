-- Non-destructive application rollback: stop the child API before executing.
-- Keep sessions, receipts, audit and all obligations intact for review/expiry.
BEGIN;
REVOKE ALL ON SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
-- Disable CHILD_STEWARDSHIP_MODE. An older app ignores these additive tables.
-- No DROP, balance rewrite, or restoration of revoked credentials is permitted.
