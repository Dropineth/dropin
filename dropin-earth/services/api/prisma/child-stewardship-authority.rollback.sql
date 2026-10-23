-- Non-destructive rollback: disable the child API and stop consumers first.
-- Do not DROP the canonical facts, revocation checkpoints, obligations or signature evidence.
BEGIN;
REVOKE ALL ON SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
-- Keep canonical guards and append-only journal active. Deploy the prior read-only service.
-- Restoring older data requires independent nonce/epoch/payment/delete reconciliation first.
