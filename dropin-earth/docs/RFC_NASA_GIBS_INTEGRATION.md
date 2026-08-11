# RFC: NASA GIBS Read-Only Earth Observation Connector

Status: IMPLEMENTED FOR NON-PRODUCTION REVIEW - NOT APPROVED

Date: 2026-07-14

Production activation gate: CLOSED (`CANOPYPROOF_NASA_GIBS_ENABLED=false`)

Parent decision: `ADR_SPATIAL_STACK.md`

## 1. Problem Statement

TerraProof needs near-real-time and historical Earth-observation context without
turning a visualization service into scientific source data or environmental
proof. NASA Global Imagery Browse Services (GIBS) exposes more than one thousand
visualizations through standards-based map services. Before this phase, the
repository had only an in-memory, generic NASA layer placeholder and none of the
governed connector controls defined here.

This RFC defines a read-only adapter. It does not fork Worldview, iframe
Worldview, ingest NASA imagery into CanopyProof evidence, or grant NASA any
CanopyProof proof authority.

## 2. Authority Boundary

| System | Authoritative for | Explicitly not authoritative for |
| --- | --- | --- |
| NASA GIBS | Published visualization services and their capabilities | CanopyProof evidence, verification, claims, funding, or governance |
| NASA Earthdata / CMR | Discovery metadata and links to science collections and granules | A CanopyProof interpretation or decision |
| TerraProof | Normalized products, provenance, comparisons, project linkage, and source-data handoff | Final proof, certificate, ESG metric, or funding decision |
| CanopyProof | Evidence, human verification, challenges, governance, proof records, reporting, and funding accountability | NASA product publication or scientific data stewardship |

GIBS tiles are rendered visualizations. A tile, screenshot, color, pixel value,
or visual change is not a numerical source measurement unless a separately
governed method resolves and processes the underlying science product.

## 3. Official-Source Due Diligence

Reviewed on 2026-07-14:

- GIBS developer documentation: https://nasa-gibs.github.io/gibs-api-docs/
- Access basics and time dimensions:
  https://nasa-gibs.github.io/gibs-api-docs/access-basics/
- Advanced topics and best-available behavior:
  https://nasa-gibs.github.io/gibs-api-docs/access-advanced-topics/
- Visualization catalog:
  https://nasa-gibs.github.io/gibs-api-docs/available-visualizations/
- NASA Earthdata GIBS API and acknowledgement:
  https://www.earthdata.nasa.gov/engage/open-data-services-software/earthdata-developer-portal/gibs-api
- NASA Earthdata data-use guidance:
  https://www.earthdata.nasa.gov/engage/open-data-services-software/data-use-policy
- Worldview repository and architecture entry point:
  https://github.com/nasa-gibs/worldview
- Worldview configuration documentation:
  https://github.com/nasa-gibs/worldview/blob/main/doc/config/configuration.md
- Worldview URL parameter contract:
  https://github.com/nasa-gibs/worldview/blob/main/doc/url_parameters.md
- Worldview embedding policy:
  https://github.com/nasa-gibs/worldview/blob/main/doc/embed.md
- Worldview NASA Open Source Agreement 1.3:
  https://github.com/nasa-gibs/worldview/blob/main/LICENSE.md

Findings:

1. GIBS supports WMTS, WMS, TWMS, generic XYZ adaptation, and GDAL clients.
2. The supported projections are EPSG:4326, EPSG:3857, EPSG:3413, and
   EPSG:3031. Products are not necessarily available in every projection.
3. `best`, `std`, `nrt`, and `all` service families exist. `best` can select a
   standard or near-real-time source according to provider-coordinated rules.
4. WMTS GetCapabilities reports at most the latest 100 time periods per layer.
   DescribeDomains is required for complete availability.
5. Daily products accept `YYYY-MM-DD`; subdaily products require an ISO-8601
   UTC timestamp. The `current` keyword is not supported for imagery. Omitting
   time or using `default` selects the service default and is too ambiguous for
   an immutable comparison.
6. GIBS imagery resolution is not necessarily sensor-native resolution.
   EPSG:3857 visualizations are resampled from geographic imagery.
7. Worldview is an OpenLayers client with a substantial configuration and
   application architecture. Reusing GIBS does not require embedding or
   vendoring Worldview.
8. Non-NASA Worldview embedding is disabled by default and requires NASA
   permission. This integration will not use an iframe.
9. Worldview source is NASA-1.3. No Worldview source is copied by this design.
10. NASA requests a GIBS acknowledgement and prohibits suggesting NASA
    endorsement.
11. Worldview deep links use the documented `p`, `v`, `l`, and `t` parameters.
    Projection values are `geographic`, `arctic`, or `antarctic`; caller query
    keys are never forwarded.
12. The latest Worldview release observed during review was `v4.100.1`,
    published 2026-07-06. CanopyProof does not import or automatically follow
    that release; it is an upstream compatibility baseline only.

A live HEAD request to the official EPSG:3857 WMTS capabilities document on
2026-07-13 reported 5,579,454 bytes. The connector therefore uses a bounded
stream with a configurable upper limit, not an unbounded `response.text()`.

## 4. Service Architecture

```text
authorized operator
  -> CanopyProof API authorization and tenant binding
  -> NASA GIBS connector application service
     -> fixed endpoint registry (no caller URL)
     -> bounded HTTP fetch with timeout and redirect denial
     -> defensive XML validation and normalization
     -> append-only catalog snapshot and audit event
  -> TerraProof product registry
     -> signed, expiring disclosure-safe map manifest
     -> immutable comparison / source-data handoff / watch records
  -> CanopyProof MapLibre/deck viewer
```

The connector is fail-soft: an upstream timeout or invalid response preserves
the last valid snapshot, marks it stale, increments failure telemetry, and
returns a typed outage state. It never replaces a valid catalog with an empty
or partially parsed response.

## 5. Endpoint Registry

Only HTTPS URLs derived from this immutable tuple may be contacted:

- host: `gibs.earthdata.nasa.gov`
- service: `WMTS` or `WMS`
- projection: `EPSG:4326`, `EPSG:3857`, `EPSG:3413`, or `EPSG:3031`
- collection: `best`
- operation: approved GetCapabilities plus locally constructed WMTS tile or WMS
  GetMap templates

The first implementation does not contact domain-sharding aliases, arbitrary
metadata links, caller-provided URLs, Earthdata Login, CMR, DAAC, or
DescribeDomains endpoints. Source-data handoff stores opaque approved
references; later connectors must separately allowlist those operations.

Redirects are denied. DNS rebinding protection must be enforced by the
production egress proxy in addition to hostname validation in application code.

## 6. Domain Model

### 6.1 Product Registry

`NasaGibsProduct` contains:

- stable internal product ID;
- NASA layer identifier, title, and description;
- service type and projection;
- tile matrix set and supported formats;
- normalized temporal intervals and default date;
- bounded available dates from the source document;
- source capabilities hash and source endpoint ID;
- GIBS acknowledgement;
- synchronized-at and freshness state.

The registry stores one product projection/service variant per record. A NASA
layer appearing in multiple services or projections has multiple variants that
share the NASA layer identifier. No arbitrary source URL is persisted in the
public read model.

### 6.2 Map Manifest

The signed `NasaGibsMapManifest` freezes:

- tenant, actor, purpose, product, NASA layer, date, projection, and bbox;
- approved service type, tile matrix set, format, and opacity;
- capabilities hash, observed/published timestamp when known, freshness, and
  attribution;
- issued-at, expiry, nonce, key ID, and detached signature.

The manifest contains an endpoint ID and a constrained template identifier, not
an arbitrary URL or credential. A gateway or client resolves it against the
same immutable endpoint registry. WMTS paths are assembled from bounded path
segments; WMS requests use fixed `GetMap` parameters and WMS 1.3.0 axis order,
including latitude/longitude order for EPSG:4326. Manifests expire after at most
15 minutes and are not accepted after product or capabilities-root mismatch.

### 6.3 Observation Comparison

`ObservationComparison` is append-only and freezes product, before/after dates,
bbox, projection, display mode, layer configuration, capabilities hash, tenant,
actor, audit event, and comparison hash. Mutating any field produces a new
record and hash. `SIDE_BY_SIDE`, `SWIPE`, `OPACITY`, and `ANIMATION` are display
modes, not scientific inference methods.

### 6.4 Source-Data Handoff

`NasaSourceDataHandoff` links a visualization product to approved science
dataset, collection, and granule-search references plus area, time, purpose,
actor, tenant, and audit event. It does not claim that GIBS tile bytes are the
underlying measurement.

### 6.5 Event Watch

Internal watches may cover wildfire, flood, drought, dust, air quality, storm,
snow/ice, and vegetation change. A watch can emit only
`OBSERVATION_SIGNAL`, `RISK_CANDIDATE`, or `REVIEW_TASK`. It cannot emit a public
emergency, verified proof, ESG claim, certificate, or funding decision.

## 7. API Design

```text
GET  /canopyproof/terra/connectors/nasa-gibs/status
POST /canopyproof/terra/connectors/nasa-gibs/sync
GET  /canopyproof/terra/connectors/nasa-gibs/products
GET  /canopyproof/terra/connectors/nasa-gibs/products/:id
GET  /canopyproof/terra/connectors/nasa-gibs/products/:id/availability
POST /canopyproof/terra/connectors/nasa-gibs/tile-failures
POST /canopyproof/terra/connectors/nasa-gibs/products/:id/manifests
POST /canopyproof/terra/connectors/nasa-gibs/comparisons
GET  /canopyproof/terra/connectors/nasa-gibs/comparisons/:id
GET  /canopyproof/terra/connectors/nasa-gibs/comparisons/:id/attribution/:artifactKind
POST /canopyproof/terra/connectors/nasa-gibs/source-data-handoffs
POST /canopyproof/terra/connectors/nasa-gibs/event-watches
```

Read routes require an authenticated participant in the initial phase because
catalog freshness and internal endpoint IDs are operational metadata. Sync
requires a durable organization-bound `agent`, `administrator`, or approved
research operator, an idempotency key, and the `nasa_gibs_catalog_sync`
capability. The request selects only service and projection enums. Idempotency
binds caller-controlled fields, actor, organization, and endpoint; a
server-generated execution timestamp does not turn a transport retry into a
different request.

The routes are mounted but fail closed behind a default-off feature flag. The
application uses PostgreSQL persistence and existing identity/RBAC binding, but
production activation remains forbidden until controlled egress, an external
KMS/HSM signing adapter, native PostgreSQL/RLS evidence, live-source testing,
and named approvals are available.

## 8. Defensive XML Pipeline

1. Build the URL from the immutable endpoint registry.
2. Apply connect/total timeout and `redirect: error`.
3. Reject non-2xx responses and unexpected media types.
4. Reject declared or streamed bodies above the configured byte limit.
5. Decode UTF-8 strictly; reject NUL bytes, DOCTYPE, ENTITY, XInclude, and
   processing instructions other than the XML declaration.
6. Validate XML syntax using a maintained parser configured without external
   entity resolution.
7. Require the expected WMTS or WMS root and supported protocol version.
8. Enforce layer, string, interval, format, and matrix-set count/length limits.
9. Accept only supported projections, formats, and time grammar.
10. Normalize, hash the exact source bytes, and validate the full candidate
    snapshot before replacing the current catalog projection.

Titles and descriptions are data, not trusted HTML. They are length-bounded,
stored as text, and escaped by every renderer.

## 9. Persistence and Audit

Production persistence uses append-only catalog snapshots and immutable
records in the TerraProof authority store. A successful sync writes in one
transaction:

1. sync command receipt;
2. source document hash and endpoint identity;
3. complete normalized snapshot;
4. product variants and availability projection;
5. canonical CanopyProof audit event;
6. terminal snapshot root.

Failed sync attempts append a bounded operational audit event but do not alter
the last valid catalog. Comparison, handoff, and watch records are tenant-bound
and append-only. Optional project references are checked against the canonical
project organization in both the repository and a database insert trigger.
Product and availability reads use only the newest complete endpoint snapshot,
so a withdrawn layer cannot remain current through older immutable history.
Database schema and native PostgreSQL/RLS tests are required
before route mounting; an in-memory service is never an acceptable production
fallback.

## 10. Observability

Required low-cardinality metrics:

- `nasa_gibs_sync_total`
- `nasa_gibs_sync_failures_total`
- `nasa_gibs_products_total`
- `nasa_gibs_tile_failures_total`
- `nasa_gibs_stale_products_total`
- `nasa_gibs_comparisons_total`
- `nasa_gibs_source_handoffs_total`

Traces cover capabilities sync, availability lookup, manifest generation,
comparison creation, and source-data handoff. Attributes use endpoint IDs,
service type, projection, outcome, and bounded error code. Layer IDs, bbox,
tenant IDs, URLs, query strings, and credentials are excluded from metric
labels. The browser reports only the first MapLibre error per map instance and
product selection to an authenticated, product-validated telemetry route; it
never forwards tile URLs, coordinates, or upstream response bodies.

## 11. UI Integration

The `/terra` page extends the existing CanopyProof OS surface with a client-only,
lazy-loaded MapLibre/deck viewer containing a catalog,
date and projection controls, freshness state, comparison modes, attribution,
Worldview deep link, and source-data handoff action. It will not iframe
Worldview. A source outage keeps the last valid catalog visible with an explicit
stale warning. The UI must never label a NASA layer as evidence, verified,
certified, or ESG-ready.

When the connector is disabled, unavailable, or unsigned, the viewer renders a
fixed-size boundary state and does not substitute imagery.

## 12. Migration Strategy

1. Completed: pure domain schemas, fixed endpoint registry, defensive parser,
   synthetic fixtures, and focused security tests.
2. Completed: additive PostgreSQL SQL, RLS policies, command receipts, audit
   integration, fail-soft catalog snapshots, and empty-only rollback guard.
3. Completed: authenticated routes behind a disabled-by-default feature flag
   and a lazy-loaded MapLibre/deck viewer.
4. Required: approve this RFC and the parent spatial ADR with named reviewers.
5. Required: validate migration and FORCE RLS behavior on native PostgreSQL.
6. Required: run a non-production live sync through controlled egress.
7. Required: add and exercise an external KMS/HSM manifest signing adapter.
8. Required: complete accessibility, parser-fuzz, load, chaos, tile-failure,
   and end-to-end tests.
9. Required: complete a separate production-readiness and release approval.

No existing generic TerraProof NASA placeholder is silently migrated. It is
deprecated only after consumers use stable GIBS product IDs.

## 13. Rollback Strategy

Rollback disables route registration, manifest issuance, live sync, and UI
controls while preserving catalog snapshots, hashes, comparisons, handoffs,
audit events, and command receipts. A previous valid catalog remains readable
but explicitly stale. Database rollback refuses destructive removal when
authority records exist and uses a forward compensating migration instead.

## 14. Approval Gate

The implementation is available for review. No production authority,
institutional reliance, NASA endorsement, or approval is implied by this
document.

| Required role | Reviewer | Decision | Timestamp | Rationale |
| --- | --- | --- | --- | --- |
| Principal Architecture | PENDING | PENDING | PENDING | PENDING |
| Security | PENDING | PENDING | PENDING | PENDING |
| Earth Science / MRV | PENDING | PENDING | PENDING | PENDING |
| Data Governance and Licensing | PENDING | PENDING | PENDING | PENDING |
| Platform Operations | PENDING | PENDING | PENDING | PENDING |

All roles must approve this RFC and `ADR_SPATIAL_STACK.md` before enabling live
NASA synchronization or this connector in any non-test deployment.
