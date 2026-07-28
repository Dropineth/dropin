CREATE SCHEMA IF NOT EXISTS transparency;

CREATE TABLE IF NOT EXISTS transparency.public_transparency_query_catalog (
  publication_id text PRIMARY KEY
    REFERENCES transparency.public_transparency_publication_facts(id),
  id text NOT NULL UNIQUE CHECK (id = publication_id),
  public_project_id text NOT NULL
    CHECK (public_project_id ~ '^cp_public_project_[0-9a-f]{24}$'),
  public_organization_id text NOT NULL
    CHECK (public_organization_id ~ '^cp_public_org_[0-9a-f]{24}$'),
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  publication_root text NOT NULL CHECK (publication_root ~ '^[0-9a-f]{64}$'),
  published_at timestamptz NOT NULL,
  audit_event_root text NOT NULL REFERENCES audit.domain_events(event_root)
);

CREATE INDEX IF NOT EXISTS public_transparency_query_catalog_project_time
  ON transparency.public_transparency_query_catalog
  (public_project_id, published_at DESC, publication_id DESC);

CREATE OR REPLACE FUNCTION transparency.validate_public_transparency_query_catalog_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  publication transparency.public_transparency_publication_facts%ROWTYPE;
BEGIN
  SELECT * INTO STRICT publication
  FROM transparency.public_transparency_publication_facts
  WHERE id = NEW.publication_id;

  IF publication.organization_id <> NEW.organization_id
     OR publication.public_project_id <> NEW.public_project_id
     OR publication.public_organization_id <> NEW.public_organization_id
     OR publication.publication_root <> NEW.publication_root
     OR publication.published_at <> NEW.published_at
     OR publication.audit_event_root <> NEW.audit_event_root
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_PUBLIC_EXPLORER_CATALOG_SOURCE_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM transparency.public_transparency_query_catalog existing
    WHERE existing.public_project_id = NEW.public_project_id
      AND existing.organization_id <> NEW.organization_id
  ) OR EXISTS (
    SELECT 1
    FROM transparency.public_transparency_query_catalog existing
    WHERE existing.public_organization_id = NEW.public_organization_id
      AND existing.organization_id <> NEW.organization_id
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_PUBLIC_EXPLORER_PUBLIC_ID_COLLISION';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM transparency.public_transparency_query_catalog existing
    JOIN transparency.public_transparency_publication_facts existing_publication
      ON existing_publication.id = existing.publication_id
    WHERE existing.public_project_id = NEW.public_project_id
      AND existing_publication.project_id <> publication.project_id
  ) THEN
    RAISE EXCEPTION 'CANOPYPROOF_PUBLIC_EXPLORER_PUBLIC_ID_COLLISION';
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'CANOPYPROOF_PUBLIC_EXPLORER_CATALOG_SOURCE_MISMATCH';
END;
$$;

CREATE OR REPLACE FUNCTION transparency.append_public_transparency_query_catalog()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO transparency.public_transparency_query_catalog (
    publication_id,
    id,
    public_project_id,
    public_organization_id,
    organization_id,
    publication_root,
    published_at,
    audit_event_root
  ) VALUES (
    NEW.id,
    NEW.id,
    NEW.public_project_id,
    NEW.public_organization_id,
    NEW.organization_id,
    NEW.publication_root,
    NEW.published_at,
    NEW.audit_event_root
  )
  ON CONFLICT (publication_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS public_transparency_query_catalog_validate
  ON transparency.public_transparency_query_catalog;
CREATE TRIGGER public_transparency_query_catalog_validate
BEFORE INSERT ON transparency.public_transparency_query_catalog
FOR EACH ROW EXECUTE FUNCTION transparency.validate_public_transparency_query_catalog_insert();

DROP TRIGGER IF EXISTS public_transparency_query_catalog_no_update
  ON transparency.public_transparency_query_catalog;
CREATE TRIGGER public_transparency_query_catalog_no_update
BEFORE UPDATE ON transparency.public_transparency_query_catalog
FOR EACH ROW EXECUTE FUNCTION transparency.public_transparency_reject_mutation();

DROP TRIGGER IF EXISTS public_transparency_query_catalog_no_delete
  ON transparency.public_transparency_query_catalog;
CREATE TRIGGER public_transparency_query_catalog_no_delete
BEFORE DELETE ON transparency.public_transparency_query_catalog
FOR EACH ROW EXECUTE FUNCTION transparency.public_transparency_reject_mutation();

DROP TRIGGER IF EXISTS public_transparency_query_catalog_audit
  ON transparency.public_transparency_query_catalog;
CREATE TRIGGER public_transparency_query_catalog_audit
AFTER INSERT OR UPDATE OR DELETE ON transparency.public_transparency_query_catalog
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS public_transparency_publications_append_query_catalog
  ON transparency.public_transparency_publication_facts;
CREATE TRIGGER public_transparency_publications_append_query_catalog
AFTER INSERT ON transparency.public_transparency_publication_facts
FOR EACH ROW EXECUTE FUNCTION transparency.append_public_transparency_query_catalog();

DO $$
DECLARE
  tenant record;
  previous_organization text := current_setting('app.organization_id', true);
BEGIN
  FOR tenant IN SELECT id FROM organizations.organizations ORDER BY id LOOP
    PERFORM set_config('app.organization_id', tenant.id, true);
    INSERT INTO transparency.public_transparency_query_catalog (
      publication_id,
      id,
      public_project_id,
      public_organization_id,
      organization_id,
      publication_root,
      published_at,
      audit_event_root
    )
    SELECT
      publication.id,
      publication.id,
      publication.public_project_id,
      publication.public_organization_id,
      publication.organization_id,
      publication.publication_root,
      publication.published_at,
      publication.audit_event_root
    FROM transparency.public_transparency_publication_facts publication
    WHERE publication.organization_id = tenant.id
    ON CONFLICT (publication_id) DO NOTHING;
  END LOOP;
  PERFORM set_config('app.organization_id', COALESCE(previous_organization, ''), true);
END;
$$;

COMMENT ON TABLE transparency.public_transparency_query_catalog IS
  'Internal append-only locator for canonical public transparency reads. It is not an anonymous data surface.';
