-- Roll back only an empty, route-closed canonical ESG reporting authority.
-- Environmental Proof, MRV, lifecycle, organization, and shared audit facts remain untouched.

DO $$
BEGIN
  IF to_regclass('reporting.canonical_esg_report_facts') IS NOT NULL
     AND (
       EXISTS (SELECT 1 FROM reporting.canonical_esg_report_facts)
       OR EXISTS (SELECT 1 FROM reporting.canonical_esg_report_member_facts)
       OR EXISTS (SELECT 1 FROM reporting.canonical_esg_report_metric_member_facts)
       OR EXISTS (
         SELECT 1 FROM audit.domain_events
         WHERE entity_type = 'esg_report'
           AND stream_id LIKE 'canonical-esg-report:%'
       )
       OR EXISTS (
         SELECT 1 FROM audit.command_receipts
         WHERE result_entity_type = 'canonical_esg_report'
       )
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_CANONICAL_ESG_ROLLBACK_REQUIRES_EMPTY_AUTHORITY';
  END IF;
END;
$$;

DROP TABLE IF EXISTS reporting.canonical_esg_report_metric_member_facts;
DROP TABLE IF EXISTS reporting.canonical_esg_report_member_facts;
DROP TABLE IF EXISTS reporting.canonical_esg_report_facts;

DROP FUNCTION IF EXISTS reporting.canonical_esg_report_projection(text, timestamptz);
DROP FUNCTION IF EXISTS reporting.validate_canonical_esg_report_insert();
DROP FUNCTION IF EXISTS reporting.validate_canonical_esg_report_metric_member_insert();
DROP FUNCTION IF EXISTS reporting.validate_canonical_esg_report_member_insert();
DROP FUNCTION IF EXISTS reporting.canonical_esg_event_is_contiguous(text);
DROP FUNCTION IF EXISTS reporting.canonical_esg_report_root(jsonb);
DROP FUNCTION IF EXISTS reporting.canonical_esg_report_hash(jsonb);
DROP FUNCTION IF EXISTS reporting.canonical_esg_artifact_hash(jsonb);
DROP FUNCTION IF EXISTS reporting.canonical_esg_command_hash(jsonb, jsonb, jsonb);
DROP FUNCTION IF EXISTS reporting.canonical_esg_command_hash(jsonb, jsonb);
DROP FUNCTION IF EXISTS reporting.canonical_esg_disclosures(text[], text[], text, text[], text);
DROP FUNCTION IF EXISTS reporting.canonical_esg_disclosures(text[], text[], text);
DROP FUNCTION IF EXISTS reporting.canonical_esg_metric_member_root(jsonb);
DROP FUNCTION IF EXISTS reporting.canonical_esg_metric_member_hash(jsonb);
DROP FUNCTION IF EXISTS reporting.canonical_esg_member_root(jsonb);
DROP FUNCTION IF EXISTS reporting.canonical_esg_member_hash(jsonb);
DROP FUNCTION IF EXISTS reporting.canonical_esg_text_is_safe(text);
DROP FUNCTION IF EXISTS reporting.canonical_esg_safety_canonical();
DROP FUNCTION IF EXISTS reporting.canonical_esg_reject_mutation();
