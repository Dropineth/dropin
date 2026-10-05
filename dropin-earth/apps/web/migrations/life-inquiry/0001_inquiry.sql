-- Optional dedicated D1 store. Apply only to an independently authorized binding.
-- No production binding, recipient or acceptance is created by this migration.
CREATE TABLE IF NOT EXISTS lifepp_inquiry_control (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO lifepp_inquiry_control(key, value) VALUES ('schema_version', '1');
CREATE TABLE IF NOT EXISTS lifepp_inquiries (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,
  fingerprint TEXT NOT NULL,
  body TEXT NOT NULL,
  withdrawal_hash TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  send_consent INTEGER NOT NULL CHECK(send_consent = 1),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lifepp_inquiries_expiry ON lifepp_inquiries(expires_at);
-- Retain only a keyed dedupe marker until the original expiry. This prevents
-- an in-flight retry from recreating personal data after authorized withdrawal.
CREATE TABLE IF NOT EXISTS lifepp_inquiry_withdrawals (
  idempotency_key TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lifepp_inquiry_withdrawals_expiry ON lifepp_inquiry_withdrawals(expires_at);
CREATE TABLE IF NOT EXISTS lifepp_inquiry_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL CHECK(count > 0),
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS lifepp_inquiry_limits_expiry ON lifepp_inquiry_limits(expires_at);
