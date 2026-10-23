-- Stop fixture ingress and synthetic review before application rollback.
-- Keep purpose inventory, suppression, immutable review evidence and canonical hashes.
-- Existing dedicated media roles must be disabled with a separately approved,
-- increasing media_roles scope version; this template grants no authority.
BEGIN;
REVOKE ALL ON ALL TABLES IN SCHEMA child_stewardship FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA child_stewardship FROM PUBLIC;
COMMIT;
-- Never roll back to an application that exposes source/quarantine bytes or ignores suppression.
