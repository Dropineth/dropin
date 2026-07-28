DO $$
BEGIN
  IF to_regclass('audit.mobile_sync_admission_denial_facts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM audit.mobile_sync_admission_denial_facts LIMIT 1) THEN
    RAISE EXCEPTION 'CANOPYPROOF_MOBILE_SYNC_ADMISSION_ROLLBACK_BLOCKED: denial facts exist';
  END IF;
  IF to_regclass('audit.mobile_sync_admission_buckets') IS NOT NULL
     AND EXISTS (SELECT 1 FROM audit.mobile_sync_admission_buckets LIMIT 1) THEN
    RAISE EXCEPTION 'CANOPYPROOF_MOBILE_SYNC_ADMISSION_ROLLBACK_BLOCKED: admission buckets exist';
  END IF;
END;
$$;

DROP TABLE IF EXISTS audit.mobile_sync_admission_denial_facts;
DROP TABLE IF EXISTS audit.mobile_sync_admission_buckets;
DROP FUNCTION IF EXISTS audit.reject_mobile_sync_admission_denial_mutation();
DROP FUNCTION IF EXISTS audit.mobile_sync_admission_denial_root(
  text, text, text, text, timestamptz, timestamptz,
  integer, integer, bigint, bigint, text, timestamptz
);
DROP FUNCTION IF EXISTS audit.mobile_sync_admission_denial_reason(bigint, bigint, integer, integer);
DROP FUNCTION IF EXISTS audit.mobile_sync_admission_limit(text, text);
