-- Data-preserving rollback for the TerraProof NASA GIBS connector.
-- This rollback intentionally refuses to remove any authority records.

DO $$
DECLARE
  record_count bigint;
BEGIN
  SELECT
    (SELECT count(*) FROM satellite.nasa_gibs_catalog_snapshots) +
    (SELECT count(*) FROM satellite.nasa_gibs_sync_failures) +
    (SELECT count(*) FROM satellite.nasa_gibs_manifest_issuances) +
    (SELECT count(*) FROM satellite.nasa_gibs_observation_comparisons) +
    (SELECT count(*) FROM satellite.nasa_gibs_source_handoffs) +
    (SELECT count(*) FROM satellite.nasa_gibs_event_watches)
  INTO record_count;

  IF record_count > 0 THEN
    RAISE EXCEPTION 'NASA_GIBS_ROLLBACK_REFUSED: % immutable authority records exist; disable routes and apply a forward compensating migration', record_count;
  END IF;
END;
$$;

DROP TABLE IF EXISTS satellite.nasa_gibs_manifest_nonce_consumptions;
DROP TABLE IF EXISTS satellite.nasa_gibs_event_watches;
DROP TABLE IF EXISTS satellite.nasa_gibs_source_handoffs;
DROP TABLE IF EXISTS satellite.nasa_gibs_observation_comparisons;
DROP TABLE IF EXISTS satellite.nasa_gibs_manifest_issuances;
DROP TABLE IF EXISTS satellite.nasa_gibs_sync_failures;
DROP TABLE IF EXISTS satellite.nasa_gibs_layer_availability;
DROP TABLE IF EXISTS satellite.nasa_gibs_products;
DROP TABLE IF EXISTS satellite.nasa_gibs_catalog_snapshots;
DROP FUNCTION IF EXISTS satellite.nasa_gibs_validate_project_binding();
DROP FUNCTION IF EXISTS satellite.nasa_gibs_reject_mutation();
