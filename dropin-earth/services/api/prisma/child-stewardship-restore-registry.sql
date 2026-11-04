-- Bind new admissions to the exact externally authenticated registry snapshot.
-- Existing admissions intentionally remain NULL and require fresh verification.
BEGIN;
ALTER TABLE child_stewardship.restore_admissions
 ADD COLUMN IF NOT EXISTS registry_digest text CHECK(registry_digest ~ '^[a-f0-9]{64}$');
COMMIT;
