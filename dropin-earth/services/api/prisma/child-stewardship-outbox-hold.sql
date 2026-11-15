BEGIN;
-- These rows record internal events only. Until a delivery verifier can fence
-- the downstream effect against current authorization, no row is deliverable.
-- Validate historical rows too; never silently clear or reclassify a receipt.
ALTER TABLE child_stewardship.outbox
  ADD CONSTRAINT child_outbox_delivery_closed CHECK (delivered_at IS NULL);
COMMIT;
