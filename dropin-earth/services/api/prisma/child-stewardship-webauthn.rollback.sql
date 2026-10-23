-- Non-destructive rollback: retain counters, consumed challenges, revocations and audit.
-- Disable/unmount the isolated fixture router before running. Do not reopen old sessions.
BEGIN;
UPDATE child_stewardship_webauthn.sessions SET revoked=true WHERE NOT revoked;
UPDATE child_stewardship_webauthn.credentials SET revoked=true WHERE NOT revoked;
UPDATE child_stewardship_webauthn.sandboxes SET revoked=true,epoch=epoch+1 WHERE NOT revoked;
REVOKE ALL ON SCHEMA child_stewardship_webauthn FROM PUBLIC;
COMMIT;
