-- Canonical, privacy-minimized CanopyProof public transparency authority.
-- Depends on canopyproof-os.sql and environmental-proof-lifecycle.sql.
-- This authority is additive and route-closed. Its facts are not carbon credits,
-- financial instruments, tax offsets, or public-reliance authorization.

CREATE SCHEMA IF NOT EXISTS transparency;

CREATE OR REPLACE FUNCTION transparency.public_transparency_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'CANOPYPROOF_PUBLIC_TRANSPARENCY_APPEND_ONLY_VIOLATION';
END;
$$;

CREATE OR REPLACE FUNCTION transparency.public_transparency_safety_canonical()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_build_object(
    'currentCanonicalRecordRequired', true,
    'activeSignedLifecycleAtPublicationRequired', true,
    'independentHumanPrivacyReviewRequired', true,
    'accreditedHumanPublisherRequired', true,
    'preciseLocationForbidden', true,
    'rawEvidenceForbidden', true,
    'personalDataForbidden', true,
    'challengeVisibilityRequired', true,
    'appendOnly', true,
    'exactRetryRequired', true,
    'tenantBound', true,
    'routeMounted', false,
    'productionActivationEnabled', false,
    'publicRelianceAuthorized', false,
    'notCertifiedCarbonCredit', true,
    'notCarbonTaxOffset', true,
    'notFinancialAsset', true,
    'notGuaranteedYield', true,
    'noMainnetFunds', true,
    'notAutomaticCanopyDistribution', true
  );
$$;

CREATE OR REPLACE FUNCTION transparency.public_transparency_document_is_minimized(document jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT document::text !~* '"(latitude|longitude|coordinates|geometry|boundaryHash|accuracyMeters|contributorIds|evidenceIds|detachedSignature|providerKeyId)"[[:space:]]*:';
$$;

CREATE OR REPLACE FUNCTION transparency.public_transparency_text_is_safe(value text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT value !~* '(certified carbon credit|carbon[- ]?tax offset|guaranteed (rwa )?yield|automatic [$]?canopy distribution|mainnet funds|regulatory approval|assurance opinion)';
$$;

CREATE OR REPLACE FUNCTION transparency.public_transparency_event_is_contiguous(target_event_root text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
STRICT
AS $$
DECLARE
  current_event audit.domain_events%ROWTYPE;
  prior_event audit.domain_events%ROWTYPE;
  genesis_root text;
BEGIN
  SELECT * INTO current_event FROM audit.domain_events WHERE event_root = target_event_root;
  IF current_event.id IS NULL THEN RETURN false; END IF;
  SELECT * INTO prior_event
  FROM audit.domain_events
  WHERE stream_id = current_event.stream_id AND sequence_no < current_event.sequence_no
  ORDER BY sequence_no DESC LIMIT 1;
  genesis_root := audit.sha256_stable_json(jsonb_build_object('kind', 'canopyproof-audit-genesis-v1'));
  RETURN NOT EXISTS (
      SELECT 1 FROM audit.domain_events later
      WHERE later.stream_id = current_event.stream_id AND later.sequence_no > current_event.sequence_no
    )
    AND (
      (current_event.sequence_no = 1 AND prior_event.id IS NULL AND current_event.previous_root = genesis_root)
      OR
      (prior_event.id IS NOT NULL
        AND current_event.sequence_no = prior_event.sequence_no + 1
        AND current_event.previous_root = prior_event.event_root)
    );
END;
$$;

CREATE OR REPLACE FUNCTION transparency.public_disclosure_review_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-public-disclosure-review-command-v1') ||
    (document - ARRAY[
      'factType','id','commandHash','projectSequence','previousEventRoot','sourceEventRoots',
      'sourceRoot','reviewHash','reviewRoot','safety','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION transparency.public_disclosure_review_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-public-disclosure-review-v1') ||
    (document - ARRAY['factType','reviewHash','reviewRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION transparency.public_disclosure_review_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-public-disclosure-review-root-v1',
    'recordRoot', document->>'recordRoot',
    'lifecycleProjectionRoot', document->>'lifecycleProjectionRoot',
    'sourceRoot', document->>'sourceRoot',
    'reviewHash', document->>'reviewHash',
    'previousEventRoot', document->>'previousEventRoot',
    'projectSequence', document->'projectSequence'
  ));
$$;

CREATE OR REPLACE FUNCTION transparency.public_transparency_publication_command_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-public-transparency-publication-command-v1') ||
    (document - ARRAY[
      'factType','id','commandHash','projectSequence','previousEventRoot','sourceEventRoots',
      'sourceRoot','publicationHash','publicationRoot','safety','auditEvent'
    ]::text[])
  );
$$;

CREATE OR REPLACE FUNCTION transparency.public_transparency_publication_hash(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(
    jsonb_build_object('kind', 'canopyproof-public-transparency-publication-v1') ||
    (document - ARRAY['factType','publicationHash','publicationRoot','safety','auditEvent']::text[])
  );
$$;

CREATE OR REPLACE FUNCTION transparency.public_transparency_publication_root(document jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
AS $$
  SELECT audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-public-transparency-publication-root-v1',
    'recordRoot', document->>'recordRoot',
    'reviewRoot', document->>'reviewRoot',
    'lifecycleProjectionRoot', document->>'lifecycleProjectionRoot',
    'sourceRoot', document->>'sourceRoot',
    'publicationHash', document->>'publicationHash',
    'previousEventRoot', document->>'previousEventRoot',
    'projectSequence', document->'projectSequence'
  ));
$$;

CREATE TABLE IF NOT EXISTS transparency.public_disclosure_review_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  record_id text NOT NULL REFERENCES certificates.environmental_proof_record_facts(id),
  record_root text NOT NULL CHECK (record_root ~ '^[0-9a-f]{64}$'),
  governed_record_projection_root text NOT NULL CHECK (governed_record_projection_root ~ '^[0-9a-f]{64}$'),
  lifecycle_binding_id text NOT NULL REFERENCES certificates.environmental_proof_lifecycle_binding_facts(id),
  lifecycle_binding_root text NOT NULL CHECK (lifecycle_binding_root ~ '^[0-9a-f]{64}$'),
  lifecycle_projection_root text NOT NULL CHECK (lifecycle_projection_root ~ '^[0-9a-f]{64}$'),
  signature_receipt_id text NOT NULL REFERENCES certificates.environmental_proof_signature_receipt_facts(id),
  signature_receipt_root text NOT NULL CHECK (signature_receipt_root ~ '^[0-9a-f]{64}$'),
  classification text NOT NULL CHECK (classification IN ('public','sensitive','restricted')),
  location_disclosure text NOT NULL CHECK (location_disclosure IN ('region','withheld')),
  area_disclosure text NOT NULL CHECK (area_disclosure IN ('band','withheld')),
  reason_codes text[] NOT NULL CHECK (cardinality(reason_codes) BETWEEN 3 AND 5),
  limitation_hashes text[] NOT NULL CHECK (cardinality(limitation_hashes) <= 64),
  reviewer_id text NOT NULL REFERENCES identity.participants(id),
  reviewer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(reviewer_snapshot) = 'object'),
  reviewed_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  source_event_roots text[] NOT NULL CHECK (cardinality(source_event_roots) = 3),
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  review_hash text NOT NULL UNIQUE CHECK (review_hash ~ '^[0-9a-f]{64}$'),
  review_root text NOT NULL UNIQUE CHECK (review_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (organization_id, project_id, project_sequence)
);

CREATE TABLE IF NOT EXISTS transparency.public_transparency_publication_facts (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations.organizations(id),
  project_id text NOT NULL REFERENCES projects.projects(id),
  public_organization_id text NOT NULL,
  public_project_id text NOT NULL,
  record_id text NOT NULL REFERENCES certificates.environmental_proof_record_facts(id),
  record_root text NOT NULL CHECK (record_root ~ '^[0-9a-f]{64}$'),
  review_id text NOT NULL UNIQUE REFERENCES transparency.public_disclosure_review_facts(id),
  review_root text NOT NULL CHECK (review_root ~ '^[0-9a-f]{64}$'),
  lifecycle_binding_id text NOT NULL REFERENCES certificates.environmental_proof_lifecycle_binding_facts(id),
  lifecycle_binding_root text NOT NULL CHECK (lifecycle_binding_root ~ '^[0-9a-f]{64}$'),
  lifecycle_projection_root text NOT NULL CHECK (lifecycle_projection_root ~ '^[0-9a-f]{64}$'),
  signature_receipt_id text NOT NULL REFERENCES certificates.environmental_proof_signature_receipt_facts(id),
  signature_receipt_root text NOT NULL CHECK (signature_receipt_root ~ '^[0-9a-f]{64}$'),
  issuer_authority_root text NOT NULL CHECK (issuer_authority_root ~ '^[0-9a-f]{64}$'),
  publisher_id text NOT NULL REFERENCES identity.participants(id),
  publisher_snapshot jsonb NOT NULL CHECK (jsonb_typeof(publisher_snapshot) = 'object'),
  published_at timestamptz NOT NULL,
  command_hash text NOT NULL UNIQUE CHECK (command_hash ~ '^[0-9a-f]{64}$'),
  project_sequence bigint NOT NULL CHECK (project_sequence > 0),
  previous_event_root text NOT NULL CHECK (previous_event_root ~ '^[0-9a-f]{64}$'),
  source_event_roots text[] NOT NULL CHECK (cardinality(source_event_roots) = 4),
  source_root text NOT NULL CHECK (source_root ~ '^[0-9a-f]{64}$'),
  publication_hash text NOT NULL UNIQUE CHECK (publication_hash ~ '^[0-9a-f]{64}$'),
  publication_root text NOT NULL UNIQUE CHECK (publication_root ~ '^[0-9a-f]{64}$'),
  fact_record jsonb NOT NULL CHECK (jsonb_typeof(fact_record) = 'object'),
  audit_event_root text NOT NULL UNIQUE REFERENCES audit.domain_events(event_root),
  UNIQUE (organization_id, project_id, project_sequence)
);

CREATE INDEX IF NOT EXISTS public_disclosure_reviews_project_time
  ON transparency.public_disclosure_review_facts (organization_id, project_id, reviewed_at DESC, id);
CREATE INDEX IF NOT EXISTS public_disclosure_reviews_record
  ON transparency.public_disclosure_review_facts (organization_id, record_id, reviewed_at DESC, id);
CREATE INDEX IF NOT EXISTS public_transparency_publications_project_time
  ON transparency.public_transparency_publication_facts (organization_id, project_id, published_at DESC, id);
CREATE INDEX IF NOT EXISTS public_transparency_publications_record
  ON transparency.public_transparency_publication_facts (organization_id, record_id, published_at DESC, id);

CREATE OR REPLACE FUNCTION transparency.validate_public_disclosure_review_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  record_fact certificates.environmental_proof_record_facts%ROWTYPE;
  binding_fact certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  signature_fact certificates.environmental_proof_signature_receipt_facts%ROWTYPE;
  governed record;
  lifecycle record;
  semantic_event audit.domain_events%ROWTYPE;
  expected_source_event_roots text[];
  expected_source_root text;
  expected_audit_event jsonb;
  required_reasons text[] := ARRAY[
    'community_safety_reviewed','data_rights_reviewed','location_minimized','personal_data_excluded'
  ]::text[];
BEGIN
  SELECT * INTO STRICT record_fact
  FROM certificates.environmental_proof_record_facts WHERE id = NEW.record_id;
  SELECT * INTO STRICT binding_fact
  FROM certificates.environmental_proof_lifecycle_binding_facts WHERE id = NEW.lifecycle_binding_id;
  SELECT * INTO STRICT signature_fact
  FROM certificates.environmental_proof_signature_receipt_facts WHERE id = NEW.signature_receipt_id;
  SELECT * INTO STRICT governed
  FROM certificates.environmental_proof_governed_record_projection(NEW.record_id);
  SELECT * INTO STRICT lifecycle
  FROM certificates.environmental_proof_lifecycle_projection(NEW.lifecycle_binding_id, NEW.reviewed_at);
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events WHERE event_root = NEW.audit_event_root;

  SELECT array_agg(value ORDER BY value) INTO expected_source_event_roots
  FROM unnest(ARRAY[
    record_fact.audit_event_root, binding_fact.audit_event_root, signature_fact.audit_event_root
  ]::text[]) AS value;
  expected_source_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(ARRAY[
      record_fact.record_root, governed.projection_root, binding_fact.binding_root,
      lifecycle.projection_root, signature_fact.receipt_root,
      NEW.reviewer_snapshot->>'authorityRoot'
    ]::text[] || expected_source_event_roots) AS value ORDER BY value
  ));
  expected_audit_event := jsonb_build_object(
    'id', semantic_event.id,
    'action', semantic_event.action,
    'actor', semantic_event.actor_id,
    'entityType', semantic_event.entity_type,
    'entityId', semantic_event.entity_id,
    'previousRoot', semantic_event.previous_root,
    'payloadHash', semantic_event.payload_hash,
    'eventRoot', semantic_event.event_root,
    'createdAt', audit.iso8601_millis(semantic_event.created_at),
    'rationale', semantic_event.rationale
  );

  IF NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','recordId','recordRoot',
         'governedRecordProjectionRoot','lifecycleBindingId','lifecycleBindingRoot',
         'lifecycleProjectionRoot','signatureReceiptId','signatureReceiptRoot',
         'classification','locationDisclosure','areaDisclosure','reasonCodes',
         'limitationHashes','reviewer','reviewedAt','commandHash','projectSequence',
         'previousEventRoot','sourceEventRoots','sourceRoot','reviewHash','reviewRoot',
         'safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','recordId','recordRoot',
         'governedRecordProjectionRoot','lifecycleBindingId','lifecycleBindingRoot',
         'lifecycleProjectionRoot','signatureReceiptId','signatureReceiptRoot',
         'classification','locationDisclosure','areaDisclosure','reasonCodes',
         'limitationHashes','reviewer','reviewedAt','commandHash','projectSequence',
         'previousEventRoot','sourceEventRoots','sourceRoot','reviewHash','reviewRoot',
         'safety','auditEvent'
       ]::text[]
     )
     OR NEW.fact_record->>'factType' <> 'public_disclosure_review'
     OR NEW.fact_record->>'id' <> NEW.id
     OR NEW.fact_record->>'organizationId' <> NEW.organization_id
     OR NEW.fact_record->>'projectId' <> NEW.project_id
     OR NEW.fact_record->>'recordId' <> NEW.record_id
     OR NEW.fact_record->>'recordRoot' <> NEW.record_root
     OR NEW.fact_record->>'governedRecordProjectionRoot' <> NEW.governed_record_projection_root
     OR NEW.fact_record->>'lifecycleBindingId' <> NEW.lifecycle_binding_id
     OR NEW.fact_record->>'lifecycleBindingRoot' <> NEW.lifecycle_binding_root
     OR NEW.fact_record->>'lifecycleProjectionRoot' <> NEW.lifecycle_projection_root
     OR NEW.fact_record->>'signatureReceiptId' <> NEW.signature_receipt_id
     OR NEW.fact_record->>'signatureReceiptRoot' <> NEW.signature_receipt_root
     OR NEW.fact_record->>'classification' <> NEW.classification
     OR NEW.fact_record->>'locationDisclosure' <> NEW.location_disclosure
     OR NEW.fact_record->>'areaDisclosure' <> NEW.area_disclosure
     OR NEW.fact_record->'reviewer' <> NEW.reviewer_snapshot
     OR NEW.fact_record->>'reviewedAt' <> audit.iso8601_millis(NEW.reviewed_at)
     OR NEW.fact_record->>'commandHash' <> NEW.command_hash
     OR (NEW.fact_record->>'projectSequence')::bigint <> NEW.project_sequence
     OR NEW.fact_record->>'previousEventRoot' <> NEW.previous_event_root
     OR NEW.fact_record->>'sourceRoot' <> NEW.source_root
     OR NEW.fact_record->>'reviewHash' <> NEW.review_hash
     OR NEW.fact_record->>'reviewRoot' <> NEW.review_root
     OR NEW.fact_record->'safety' <> transparency.public_transparency_safety_canonical()
     OR NEW.fact_record->'auditEvent' <> expected_audit_event
     OR NOT transparency.public_transparency_document_is_minimized(NEW.fact_record)
     OR NOT transparency.public_transparency_text_is_safe(NEW.fact_record::text)
     OR NOT audit.is_sorted_unique_text_array(NEW.reason_codes)
     OR NOT audit.is_sha256_hash_array(NEW.limitation_hashes)
     OR NOT audit.is_sorted_unique_text_array(NEW.limitation_hashes)
     OR NOT required_reasons <@ NEW.reason_codes
     OR (NEW.classification <> 'public' AND NEW.location_disclosure <> 'withheld')
     OR (NEW.classification = 'restricted' AND NEW.area_disclosure <> 'withheld')
     OR (NEW.location_disclosure = 'region' AND NOT ('habitat_sensitivity_reviewed' = ANY(NEW.reason_codes)))
     OR NEW.organization_id <> record_fact.organization_id
     OR NEW.project_id <> record_fact.project_id
     OR NEW.record_root <> record_fact.record_root
     OR record_fact.status <> 'issued'
     OR governed.record_root <> NEW.record_root
     OR governed.projection_root <> NEW.governed_record_projection_root
     OR governed.state <> 'issued'
     OR governed.source_authority_current IS NOT TRUE
     OR binding_fact.organization_id <> NEW.organization_id
     OR binding_fact.project_id <> NEW.project_id
     OR binding_fact.record_id <> NEW.record_id
     OR binding_fact.record_root <> NEW.record_root
     OR binding_fact.binding_root <> NEW.lifecycle_binding_root
     OR binding_fact.governed_record_projection_root <> NEW.governed_record_projection_root
     OR lifecycle.organization_id <> NEW.organization_id
     OR lifecycle.project_id <> NEW.project_id
     OR lifecycle.record_id <> NEW.record_id
     OR lifecycle.record_root <> NEW.record_root
     OR lifecycle.binding_id <> NEW.lifecycle_binding_id
     OR lifecycle.binding_root <> NEW.lifecycle_binding_root
     OR lifecycle.projection_root <> NEW.lifecycle_projection_root
     OR lifecycle.state <> 'active'
     OR lifecycle.governed_record_state <> 'issued'
     OR lifecycle.source_authority_current IS NOT TRUE
     OR lifecycle.mrv_state <> 'reviewed_for_lineage'
     OR lifecycle.bound_mrv_snapshot_current IS NOT TRUE
     OR lifecycle.key_state <> 'active'
     OR lifecycle.signature_verified IS NOT TRUE
     OR lifecycle.validity_current IS NOT TRUE
     OR signature_fact.organization_id <> NEW.organization_id
     OR signature_fact.project_id <> NEW.project_id
     OR signature_fact.record_id <> NEW.record_id
     OR signature_fact.record_root <> NEW.record_root
     OR signature_fact.binding_id <> NEW.lifecycle_binding_id
     OR signature_fact.binding_root <> NEW.lifecycle_binding_root
     OR signature_fact.receipt_root <> NEW.signature_receipt_root
     OR signature_fact.verified_at > NEW.reviewed_at
     OR record_fact.issued_at > NEW.reviewed_at
     OR NOT certificates.environmental_proof_lifecycle_actor_is_valid(
       NEW.reviewer_snapshot, NEW.reviewer_id, NEW.organization_id,
       ARRAY['verifier','researcher']::text[], 'public_transparency:privacy_review'
     )
     OR NEW.reviewer_id = record_fact.issuer_id
     OR NEW.reviewer_id = ANY(record_fact.contributor_ids)
     OR NEW.source_event_roots <> expected_source_event_roots
     OR NEW.source_root <> expected_source_root
     OR NEW.command_hash <> transparency.public_disclosure_review_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_public_disclosure_review_' || left(NEW.command_hash, 24)
     OR NEW.review_hash <> transparency.public_disclosure_review_hash(NEW.fact_record)
     OR NEW.review_root <> transparency.public_disclosure_review_root(NEW.fact_record)
     OR semantic_event.stream_id <> 'public-transparency:' || NEW.organization_id || ':' || NEW.project_id
     OR semantic_event.sequence_no <> NEW.project_sequence
     OR semantic_event.action <> 'ASSERT'
     OR semantic_event.actor_id <> NEW.reviewer_id
     OR semantic_event.entity_type <> 'public_disclosure_review'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.payload_hash <> audit.sha256_stable_json(NEW.fact_record - 'auditEvent')
     OR semantic_event.created_at <> NEW.reviewed_at
     OR semantic_event.rationale <> 'An independent human reviewed the exact public disclosure allowlist and privacy classification.'
     OR NOT transparency.public_transparency_event_is_contiguous(NEW.audit_event_root)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_PUBLIC_DISCLOSURE_REVIEW_AUTHORITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION transparency.validate_public_transparency_publication_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  review_fact transparency.public_disclosure_review_facts%ROWTYPE;
  record_fact certificates.environmental_proof_record_facts%ROWTYPE;
  binding_fact certificates.environmental_proof_lifecycle_binding_facts%ROWTYPE;
  signature_fact certificates.environmental_proof_signature_receipt_facts%ROWTYPE;
  governed record;
  lifecycle record;
  semantic_event audit.domain_events%ROWTYPE;
  expected_source_event_roots text[];
  expected_source_root text;
  expected_audit_event jsonb;
  expected_public_organization_id text;
  expected_public_project_id text;
  expected_region_hash text;
  expected_area_band text;
  expected_verification_root text;
  expected_limitation_root text;
  area_hectares numeric;
BEGIN
  SELECT * INTO STRICT review_fact
  FROM transparency.public_disclosure_review_facts WHERE id = NEW.review_id;
  SELECT * INTO STRICT record_fact
  FROM certificates.environmental_proof_record_facts WHERE id = NEW.record_id;
  SELECT * INTO STRICT binding_fact
  FROM certificates.environmental_proof_lifecycle_binding_facts WHERE id = NEW.lifecycle_binding_id;
  SELECT * INTO STRICT signature_fact
  FROM certificates.environmental_proof_signature_receipt_facts WHERE id = NEW.signature_receipt_id;
  SELECT * INTO STRICT governed
  FROM certificates.environmental_proof_governed_record_projection(NEW.record_id);
  SELECT * INTO STRICT lifecycle
  FROM certificates.environmental_proof_lifecycle_projection(NEW.lifecycle_binding_id, NEW.published_at);
  SELECT * INTO STRICT semantic_event
  FROM audit.domain_events WHERE event_root = NEW.audit_event_root;

  SELECT array_agg(value ORDER BY value) INTO expected_source_event_roots
  FROM unnest(ARRAY[
    review_fact.audit_event_root, record_fact.audit_event_root,
    binding_fact.audit_event_root, signature_fact.audit_event_root
  ]::text[]) AS value;
  expected_source_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(ARRAY[
      review_fact.review_root, record_fact.record_root, governed.projection_root,
      binding_fact.binding_root, lifecycle.projection_root, signature_fact.receipt_root,
      NEW.publisher_snapshot->>'authorityRoot'
    ]::text[] || expected_source_event_roots) AS value ORDER BY value
  ));
  expected_public_organization_id := 'cp_public_org_' || left(audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-public-organization-id-v1',
    'organizationId', record_fact.organization_id,
    'organizationRoot', record_fact.issuer_snapshot->>'organizationRoot'
  )), 24);
  expected_public_project_id := 'cp_public_project_' || left(audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-public-project-id-v1',
    'organizationId', record_fact.organization_id,
    'projectId', record_fact.project_id,
    'projectRoot', record_fact.project_root
  )), 24);
  expected_region_hash := audit.sha256_stable_json(jsonb_build_object(
    'kind', 'canopyproof-public-source-region-v1',
    'regionId', record_fact.public_location->>'regionId'
  ));
  area_hectares := (record_fact.public_location->>'areaHectares')::numeric;
  expected_area_band := CASE
    WHEN review_fact.area_disclosure = 'withheld' THEN 'withheld'
    WHEN area_hectares < 10 THEN 'under_10_ha'
    WHEN area_hectares < 100 THEN '10_to_100_ha'
    WHEN area_hectares < 1000 THEN '100_to_1000_ha'
    ELSE 'over_1000_ha'
  END;
  expected_verification_root := audit.merkle_root(ARRAY(
    SELECT value FROM unnest(record_fact.evidence_final_decision_roots) AS value ORDER BY value
  ));
  expected_limitation_root := CASE
    WHEN cardinality(review_fact.limitation_hashes) = 0
      THEN audit.sha256_stable_json(jsonb_build_object('kind', 'canopyproof-empty-public-limitation-root-v1'))
    ELSE audit.merkle_root(ARRAY(
      SELECT value FROM unnest(review_fact.limitation_hashes) AS value ORDER BY value
    ))
  END;
  expected_audit_event := jsonb_build_object(
    'id', semantic_event.id,
    'action', semantic_event.action,
    'actor', semantic_event.actor_id,
    'entityType', semantic_event.entity_type,
    'entityId', semantic_event.entity_id,
    'previousRoot', semantic_event.previous_root,
    'payloadHash', semantic_event.payload_hash,
    'eventRoot', semantic_event.event_root,
    'createdAt', audit.iso8601_millis(semantic_event.created_at),
    'rationale', semantic_event.rationale
  );

  IF NOT mrv.keys_are_valid(
       NEW.fact_record,
       ARRAY[
         'factType','id','organizationId','projectId','publicOrganizationId','publicProjectId',
         'recordId','recordRoot','recordIssuedOn','reviewId','reviewRoot','lifecycleBindingId',
         'lifecycleBindingRoot','lifecycleProjectionRoot','signatureReceiptId','signatureReceiptRoot',
         'issuerAuthorityRoot','assertionType','observationPeriod','validity','methodology','location',
         'areaBand','evidence','verification','monitoring','governance','confidenceBand',
         'limitationCount','limitationRoot','claimBoundary','publisher','publishedAt','commandHash',
         'projectSequence','previousEventRoot','sourceEventRoots','sourceRoot','publicationHash',
         'publicationRoot','safety','auditEvent'
       ]::text[],
       ARRAY[
         'factType','id','organizationId','projectId','publicOrganizationId','publicProjectId',
         'recordId','recordRoot','recordIssuedOn','reviewId','reviewRoot','lifecycleBindingId',
         'lifecycleBindingRoot','lifecycleProjectionRoot','signatureReceiptId','signatureReceiptRoot',
         'issuerAuthorityRoot','assertionType','observationPeriod','validity','methodology','location',
         'areaBand','evidence','verification','monitoring','governance','confidenceBand',
         'limitationCount','limitationRoot','claimBoundary','publisher','publishedAt','commandHash',
         'projectSequence','previousEventRoot','sourceEventRoots','sourceRoot','publicationHash',
         'publicationRoot','safety','auditEvent'
       ]::text[]
     )
     OR NEW.fact_record->>'factType' <> 'public_transparency_publication'
     OR NEW.fact_record->>'id' <> NEW.id
     OR NEW.fact_record->>'organizationId' <> NEW.organization_id
     OR NEW.fact_record->>'projectId' <> NEW.project_id
     OR NEW.fact_record->>'publicOrganizationId' <> NEW.public_organization_id
     OR NEW.fact_record->>'publicProjectId' <> NEW.public_project_id
     OR NEW.fact_record->>'recordId' <> NEW.record_id
     OR NEW.fact_record->>'recordRoot' <> NEW.record_root
     OR NEW.fact_record->>'reviewId' <> NEW.review_id
     OR NEW.fact_record->>'reviewRoot' <> NEW.review_root
     OR NEW.fact_record->>'lifecycleBindingId' <> NEW.lifecycle_binding_id
     OR NEW.fact_record->>'lifecycleBindingRoot' <> NEW.lifecycle_binding_root
     OR NEW.fact_record->>'lifecycleProjectionRoot' <> NEW.lifecycle_projection_root
     OR NEW.fact_record->>'signatureReceiptId' <> NEW.signature_receipt_id
     OR NEW.fact_record->>'signatureReceiptRoot' <> NEW.signature_receipt_root
     OR NEW.fact_record->>'issuerAuthorityRoot' <> NEW.issuer_authority_root
     OR NEW.fact_record->'publisher' <> NEW.publisher_snapshot
     OR NEW.fact_record->>'publishedAt' <> audit.iso8601_millis(NEW.published_at)
     OR NEW.fact_record->>'commandHash' <> NEW.command_hash
     OR (NEW.fact_record->>'projectSequence')::bigint <> NEW.project_sequence
     OR NEW.fact_record->>'previousEventRoot' <> NEW.previous_event_root
     OR NEW.fact_record->>'sourceRoot' <> NEW.source_root
     OR NEW.fact_record->>'publicationHash' <> NEW.publication_hash
     OR NEW.fact_record->>'publicationRoot' <> NEW.publication_root
     OR NEW.fact_record->'claimBoundary' <> transparency.public_transparency_safety_canonical()
     OR NEW.fact_record->'safety' <> transparency.public_transparency_safety_canonical()
     OR NEW.fact_record->'auditEvent' <> expected_audit_event
     OR NOT transparency.public_transparency_document_is_minimized(NEW.fact_record)
     OR NOT transparency.public_transparency_text_is_safe(NEW.fact_record::text)
     OR NEW.organization_id <> review_fact.organization_id
     OR NEW.project_id <> review_fact.project_id
     OR NEW.record_id <> review_fact.record_id
     OR NEW.record_root <> review_fact.record_root
     OR NEW.review_root <> review_fact.review_root
     OR NEW.lifecycle_binding_id <> review_fact.lifecycle_binding_id
     OR NEW.lifecycle_binding_root <> review_fact.lifecycle_binding_root
     OR NEW.signature_receipt_id <> review_fact.signature_receipt_id
     OR NEW.signature_receipt_root <> review_fact.signature_receipt_root
     OR NEW.published_at < review_fact.reviewed_at
     OR NEW.published_at > review_fact.reviewed_at + interval '30 days'
     OR NEW.organization_id <> record_fact.organization_id
     OR NEW.project_id <> record_fact.project_id
     OR NEW.record_root <> record_fact.record_root
     OR record_fact.status <> 'issued'
     OR governed.record_root <> NEW.record_root
     OR governed.state <> 'issued'
     OR governed.source_authority_current IS NOT TRUE
     OR binding_fact.record_id <> NEW.record_id
     OR binding_fact.record_root <> NEW.record_root
     OR binding_fact.binding_root <> NEW.lifecycle_binding_root
     OR binding_fact.governed_record_projection_root <> governed.projection_root
     OR lifecycle.binding_id <> NEW.lifecycle_binding_id
     OR lifecycle.binding_root <> NEW.lifecycle_binding_root
     OR lifecycle.projection_root <> NEW.lifecycle_projection_root
     OR lifecycle.state <> 'active'
     OR lifecycle.governed_record_state <> 'issued'
     OR lifecycle.source_authority_current IS NOT TRUE
     OR lifecycle.mrv_state <> 'reviewed_for_lineage'
     OR lifecycle.bound_mrv_snapshot_current IS NOT TRUE
     OR lifecycle.key_state <> 'active'
     OR lifecycle.signature_verified IS NOT TRUE
     OR lifecycle.validity_current IS NOT TRUE
     OR signature_fact.record_id <> NEW.record_id
     OR signature_fact.record_root <> NEW.record_root
     OR signature_fact.binding_id <> NEW.lifecycle_binding_id
     OR signature_fact.binding_root <> NEW.lifecycle_binding_root
     OR signature_fact.receipt_root <> NEW.signature_receipt_root
     OR signature_fact.verified_at > NEW.published_at
     OR NOT certificates.environmental_proof_lifecycle_actor_is_valid(
       NEW.publisher_snapshot, NEW.publisher_id, NEW.organization_id,
       ARRAY['owner','admin']::text[], 'public_transparency:publish'
     )
     OR NEW.publisher_id = review_fact.reviewer_id
     OR NEW.publisher_id = record_fact.issuer_id
     OR NEW.publisher_id = ANY(record_fact.contributor_ids)
     OR NEW.public_organization_id <> expected_public_organization_id
     OR NEW.public_project_id <> expected_public_project_id
     OR NEW.issuer_authority_root <> record_fact.issuer_snapshot->>'authorityRoot'
     OR NEW.fact_record->>'recordIssuedOn' <> to_char(record_fact.issued_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
     OR NEW.fact_record->>'assertionType' <> binding_fact.assertion_type
     OR NEW.fact_record->'observationPeriod' <> jsonb_build_object(
       'startsOn', to_char(binding_fact.observation_starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
       'endsOn', to_char(binding_fact.observation_ends_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
     )
     OR NEW.fact_record->'validity' <> jsonb_build_object(
       'validFrom', audit.iso8601_millis(binding_fact.valid_from),
       'expiresAt', audit.iso8601_millis(binding_fact.expires_at)
     )
     OR NEW.fact_record->'methodology' <> jsonb_build_object(
       'id', record_fact.methodology_id,
       'methodologyHash', record_fact.methodology_hash,
       'publicationRoot', record_fact.methodology_publication_root
     )
     OR NEW.fact_record->'location'->>'disclosure' <> review_fact.location_disclosure
     OR NEW.fact_record->'location'->>'sourceRegionIdHash' <> expected_region_hash
     OR (review_fact.location_disclosure = 'region'
       AND NEW.fact_record->'location'->>'regionId' <> record_fact.public_location->>'regionId')
     OR (review_fact.location_disclosure = 'withheld' AND NEW.fact_record->'location' ? 'regionId')
     OR NEW.fact_record->>'areaBand' <> expected_area_band
     OR NEW.fact_record->'evidence' <> jsonb_build_object(
       'count', cardinality(record_fact.evidence_ids), 'root', record_fact.evidence_root
     )
     OR NEW.fact_record->'verification' <> jsonb_build_object(
       'count', cardinality(record_fact.evidence_final_decision_ids), 'root', expected_verification_root
     )
     OR NEW.fact_record->'monitoring' <> jsonb_build_object(
       'count', cardinality(record_fact.monitoring_event_ids), 'root', record_fact.monitoring_root
     )
     OR NEW.fact_record->'governance' <> jsonb_build_object(
       'approvalCount', cardinality(record_fact.governance_approval_ids),
       'quorumRoot', record_fact.governance_quorum_root
     )
     OR NEW.fact_record->>'confidenceBand' <> (CASE
       WHEN record_fact.confidence_score >= 85 THEN 'high'
       WHEN record_fact.confidence_score >= 65 THEN 'moderate'
       ELSE 'limited'
     END)
     OR (NEW.fact_record->>'limitationCount')::integer <> cardinality(review_fact.limitation_hashes)
     OR NEW.fact_record->>'limitationRoot' <> expected_limitation_root
     OR NEW.source_event_roots <> expected_source_event_roots
     OR NEW.source_root <> expected_source_root
     OR NEW.command_hash <> transparency.public_transparency_publication_command_hash(NEW.fact_record)
     OR NEW.id <> 'cp_public_transparency_' || left(NEW.command_hash, 24)
     OR NEW.publication_hash <> transparency.public_transparency_publication_hash(NEW.fact_record)
     OR NEW.publication_root <> transparency.public_transparency_publication_root(NEW.fact_record)
     OR semantic_event.stream_id <> 'public-transparency:' || NEW.organization_id || ':' || NEW.project_id
     OR semantic_event.sequence_no <> NEW.project_sequence
     OR semantic_event.action <> 'FULFILL'
     OR semantic_event.actor_id <> NEW.publisher_id
     OR semantic_event.entity_type <> 'public_transparency_publication'
     OR semantic_event.entity_id <> NEW.id
     OR semantic_event.previous_root <> NEW.previous_event_root
     OR semantic_event.payload_hash <> audit.sha256_stable_json(NEW.fact_record - 'auditEvent')
     OR semantic_event.created_at <> NEW.published_at
     OR semantic_event.rationale <> 'An accredited human published a privacy-minimized transparency fact from current signed authority.'
     OR NOT transparency.public_transparency_event_is_contiguous(NEW.audit_event_root)
  THEN
    RAISE EXCEPTION 'CANOPYPROOF_PUBLIC_TRANSPARENCY_PUBLICATION_AUTHORITY_INVALID';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS public_disclosure_reviews_validate
  ON transparency.public_disclosure_review_facts;
CREATE TRIGGER public_disclosure_reviews_validate
BEFORE INSERT ON transparency.public_disclosure_review_facts
FOR EACH ROW EXECUTE FUNCTION transparency.validate_public_disclosure_review_insert();

DROP TRIGGER IF EXISTS public_transparency_publications_validate
  ON transparency.public_transparency_publication_facts;
CREATE TRIGGER public_transparency_publications_validate
BEFORE INSERT ON transparency.public_transparency_publication_facts
FOR EACH ROW EXECUTE FUNCTION transparency.validate_public_transparency_publication_insert();

DROP TRIGGER IF EXISTS public_disclosure_reviews_no_update
  ON transparency.public_disclosure_review_facts;
CREATE TRIGGER public_disclosure_reviews_no_update
BEFORE UPDATE ON transparency.public_disclosure_review_facts
FOR EACH ROW EXECUTE FUNCTION transparency.public_transparency_reject_mutation();
DROP TRIGGER IF EXISTS public_disclosure_reviews_no_delete
  ON transparency.public_disclosure_review_facts;
CREATE TRIGGER public_disclosure_reviews_no_delete
BEFORE DELETE ON transparency.public_disclosure_review_facts
FOR EACH ROW EXECUTE FUNCTION transparency.public_transparency_reject_mutation();
DROP TRIGGER IF EXISTS public_disclosure_reviews_audit
  ON transparency.public_disclosure_review_facts;
CREATE TRIGGER public_disclosure_reviews_audit
AFTER INSERT OR UPDATE OR DELETE ON transparency.public_disclosure_review_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

DROP TRIGGER IF EXISTS public_transparency_publications_no_update
  ON transparency.public_transparency_publication_facts;
CREATE TRIGGER public_transparency_publications_no_update
BEFORE UPDATE ON transparency.public_transparency_publication_facts
FOR EACH ROW EXECUTE FUNCTION transparency.public_transparency_reject_mutation();
DROP TRIGGER IF EXISTS public_transparency_publications_no_delete
  ON transparency.public_transparency_publication_facts;
CREATE TRIGGER public_transparency_publications_no_delete
BEFORE DELETE ON transparency.public_transparency_publication_facts
FOR EACH ROW EXECUTE FUNCTION transparency.public_transparency_reject_mutation();
DROP TRIGGER IF EXISTS public_transparency_publications_audit
  ON transparency.public_transparency_publication_facts;
CREATE TRIGGER public_transparency_publications_audit
AFTER INSERT OR UPDATE OR DELETE ON transparency.public_transparency_publication_facts
FOR EACH ROW EXECUTE FUNCTION audit.capture_row_mutation();

ALTER TABLE transparency.public_disclosure_review_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transparency.public_disclosure_review_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_disclosure_reviews_tenant
  ON transparency.public_disclosure_review_facts;
CREATE POLICY public_disclosure_reviews_tenant
  ON transparency.public_disclosure_review_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));

ALTER TABLE transparency.public_transparency_publication_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transparency.public_transparency_publication_facts FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS public_transparency_publications_tenant
  ON transparency.public_transparency_publication_facts;
CREATE POLICY public_transparency_publications_tenant
  ON transparency.public_transparency_publication_facts
  USING (organization_id = NULLIF(current_setting('app.organization_id', true), ''))
  WITH CHECK (organization_id = NULLIF(current_setting('app.organization_id', true), ''));
