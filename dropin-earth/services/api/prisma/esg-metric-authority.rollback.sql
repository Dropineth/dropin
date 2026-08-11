-- Roll back only an empty, route-closed ESG metric authority.
-- Methodology, Environmental Proof, MRV, lifecycle, organization, and shared audit facts remain untouched.

DO $$
BEGIN
  IF to_regclass('reporting.esg_metric_definition_facts') IS NOT NULL
     AND (
       EXISTS (SELECT 1 FROM reporting.esg_metric_definition_facts)
       OR EXISTS (SELECT 1 FROM reporting.esg_metric_result_facts)
       OR EXISTS (SELECT 1 FROM reporting.esg_metric_result_source_facts)
       OR EXISTS (
         SELECT 1 FROM audit.domain_events
         WHERE entity_type IN ('esg_metric_definition', 'esg_metric_result')
           AND stream_id LIKE 'esg-metric-%'
       )
       OR EXISTS (
         SELECT 1 FROM audit.command_receipts
         WHERE result_entity_type IN ('esg_metric_definition', 'esg_metric_result')
       )
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_ESG_METRIC_ROLLBACK_REQUIRES_EMPTY_AUTHORITY';
  END IF;
END;
$$;

DROP TABLE IF EXISTS reporting.esg_metric_result_source_facts;
DROP TABLE IF EXISTS reporting.esg_metric_result_facts;
DROP TABLE IF EXISTS reporting.esg_metric_definition_facts;

DROP FUNCTION IF EXISTS reporting.esg_metric_result_projection(text, timestamptz);
DROP FUNCTION IF EXISTS reporting.esg_metric_definition_projection(text, timestamptz);
DROP FUNCTION IF EXISTS reporting.validate_esg_metric_result_insert();
DROP FUNCTION IF EXISTS reporting.validate_esg_metric_result_source_insert();
DROP FUNCTION IF EXISTS reporting.validate_esg_metric_definition_insert();
DROP FUNCTION IF EXISTS reporting.esg_metric_event_is_contiguous(text);
DROP FUNCTION IF EXISTS reporting.esg_metric_methodology_is_current(text);
DROP FUNCTION IF EXISTS reporting.esg_metric_result_root(jsonb);
DROP FUNCTION IF EXISTS reporting.esg_metric_result_hash(jsonb);
DROP FUNCTION IF EXISTS reporting.esg_metric_result_command_hash(jsonb, jsonb);
DROP FUNCTION IF EXISTS reporting.esg_metric_source_member_root(jsonb);
DROP FUNCTION IF EXISTS reporting.esg_metric_source_member_hash(jsonb);
DROP FUNCTION IF EXISTS reporting.esg_metric_definition_root(jsonb);
DROP FUNCTION IF EXISTS reporting.esg_metric_definition_hash(jsonb);
DROP FUNCTION IF EXISTS reporting.esg_metric_definition_command_hash(jsonb);
DROP FUNCTION IF EXISTS reporting.esg_metric_semver_is_greater(text, text);
DROP FUNCTION IF EXISTS reporting.esg_metric_decimal_is_canonical(text, integer);
DROP FUNCTION IF EXISTS reporting.esg_metric_text_is_safe(text);
DROP FUNCTION IF EXISTS reporting.esg_metric_safety_canonical();
DROP FUNCTION IF EXISTS reporting.esg_metric_reject_mutation();
