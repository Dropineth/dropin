-- Disable the client suspend/resume UI first. Apply only with approved migration
-- authority that can see all affected sessions. Never remove generation/RLS
-- guards: doing so would reactivate old immutable bearer mappings.
BEGIN;
UPDATE child_stewardship.resume_tickets SET consumed_at=clock_timestamp(),outcome='denied',
  transaction_id=pg_current_xact_id()::text WHERE consumed_at IS NULL;
UPDATE child_stewardship.session_resumption SET generation=generation+1,state='suspended' WHERE state='active';
CREATE OR REPLACE FUNCTION child_stewardship.suspend_synthetic_session(raw_bearer text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship
AS $$ SELECT jsonb_build_object('denied',true) $$;
CREATE OR REPLACE FUNCTION child_stewardship.resume_synthetic_session(raw_ticket text) RETURNS jsonb
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,child_stewardship
AS $$ SELECT jsonb_build_object('denied',true) $$;
-- Keep tickets, exact mint admissions, token lookup, generations and history.
-- Fresh activation requires the reviewed forward migration; old tickets stay spent.
COMMIT;
