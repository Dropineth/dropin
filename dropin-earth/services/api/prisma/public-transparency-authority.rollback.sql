-- Roll back only an empty, route-closed public transparency authority.
-- Canonical Environmental Proof, lifecycle, organization, and shared audit
-- authority remain outside this rollback boundary.

DO $$
BEGIN
  IF to_regclass('transparency.public_disclosure_review_facts') IS NOT NULL
     AND (
       EXISTS (SELECT 1 FROM transparency.public_disclosure_review_facts)
       OR EXISTS (SELECT 1 FROM transparency.public_transparency_publication_facts)
       OR EXISTS (
         SELECT 1 FROM audit.domain_events
         WHERE entity_type IN ('public_disclosure_review', 'public_transparency_publication')
           AND stream_id LIKE 'public-transparency:%'
       )
       OR EXISTS (
         SELECT 1 FROM audit.command_receipts
         WHERE result_entity_type IN ('public_disclosure_review', 'public_transparency_publication')
       )
     ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_PUBLIC_TRANSPARENCY_ROLLBACK_REQUIRES_EMPTY_AUTHORITY';
  END IF;
END;
$$;

DROP TABLE IF EXISTS transparency.public_transparency_publication_facts;
DROP TABLE IF EXISTS transparency.public_disclosure_review_facts;

DROP FUNCTION IF EXISTS transparency.validate_public_transparency_publication_insert();
DROP FUNCTION IF EXISTS transparency.validate_public_disclosure_review_insert();
DROP FUNCTION IF EXISTS transparency.public_transparency_publication_root(jsonb);
DROP FUNCTION IF EXISTS transparency.public_transparency_publication_hash(jsonb);
DROP FUNCTION IF EXISTS transparency.public_transparency_publication_command_hash(jsonb);
DROP FUNCTION IF EXISTS transparency.public_disclosure_review_root(jsonb);
DROP FUNCTION IF EXISTS transparency.public_disclosure_review_hash(jsonb);
DROP FUNCTION IF EXISTS transparency.public_disclosure_review_command_hash(jsonb);
DROP FUNCTION IF EXISTS transparency.public_transparency_event_is_contiguous(text);
DROP FUNCTION IF EXISTS transparency.public_transparency_text_is_safe(text);
DROP FUNCTION IF EXISTS transparency.public_transparency_document_is_minimized(jsonb);
DROP FUNCTION IF EXISTS transparency.public_transparency_safety_canonical();
DROP FUNCTION IF EXISTS transparency.public_transparency_reject_mutation();

DROP SCHEMA IF EXISTS transparency;
