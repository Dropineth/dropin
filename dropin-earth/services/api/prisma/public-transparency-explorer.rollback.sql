DO $$
BEGIN
  IF to_regclass('transparency.public_transparency_query_catalog') IS NOT NULL
     AND EXISTS (SELECT 1 FROM transparency.public_transparency_query_catalog)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_PUBLIC_EXPLORER_ROLLBACK_REQUIRES_EMPTY_CATALOG';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS public_transparency_publications_append_query_catalog
  ON transparency.public_transparency_publication_facts;
DROP TRIGGER IF EXISTS public_transparency_query_catalog_validate
  ON transparency.public_transparency_query_catalog;
DROP TRIGGER IF EXISTS public_transparency_query_catalog_no_update
  ON transparency.public_transparency_query_catalog;
DROP TRIGGER IF EXISTS public_transparency_query_catalog_no_delete
  ON transparency.public_transparency_query_catalog;
DROP TRIGGER IF EXISTS public_transparency_query_catalog_audit
  ON transparency.public_transparency_query_catalog;

DROP FUNCTION IF EXISTS transparency.append_public_transparency_query_catalog();
DROP FUNCTION IF EXISTS transparency.validate_public_transparency_query_catalog_insert();
DROP TABLE IF EXISTS transparency.public_transparency_query_catalog;
