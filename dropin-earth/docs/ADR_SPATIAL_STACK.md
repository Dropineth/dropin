# ADR-TP-001: TerraProof Spatial Stack

Status: PROPOSED

Date: 2026-07-12

Implementation gate: CLOSED

Supersedes: none

## 1. Context

CanopyProof requires an evidence-first spatial foundation without becoming a
general-purpose GIS. The repository currently contains an in-memory TerraProof
prototype and a static Terra page. It lacks durable spatial authority,
cloud-native catalog/storage boundaries, tenant-safe service contracts,
reproducible processing lineage, and a signed public-map projection.

The decision must support institutional interoperability while preserving the
following authority split:

- CanopyProof owns identity, projects, evidence, verification, certificates,
  challenges, governance, funding, ESG reporting, and audit events.
- TerraProof owns governed spatial metadata, geometry references, observation
  and processing provenance, derived products, quality, and uncertainty.
- External GIS and analytical tools are inputs or compatibility surfaces, never
  final proof authorities.

## 2. Decision Drivers

- Explicit tenant, organization, project, classification, and license scope.
- Immutable input/output assets with verifiable hashes.
- Authoritative and valid geometry with indexed spatial queries.
- Reproducible processing and complete provenance.
- Institutional STAC and OGC compatibility.
- Efficient browser delivery without exposing storage or database credentials.
- Bounded operational complexity and no duplicate P0 browser-map runtime.
- Fail-closed treatment of non-Earth data.
- Independent human review for reportable or certifiable conclusions.

## 3. Proposed Decision

Adopt the following P0 stack after the approval gate opens.

| Capability | Proposed selection | Boundary |
| --- | --- | --- |
| Public map renderer | MapLibre GL JS | Read-only base/vector map consuming a signed manifest. |
| Analytical overlays | deck.gl | Shares MapLibre camera and receives bounded binary/tile data. |
| Geometry authority | PostgreSQL + PostGIS | Private, multi-tenant, versioned geometry and spatial relationships. |
| Spatiotemporal catalog | STAC + pgSTAC | Discovery and search; not audit or proof authority. |
| Catalog API | stac-fastapi | Private service behind the CanopyProof gateway; response validation required. |
| Binary storage | R2/S3-compatible immutable objects | Large assets and logs; no large binaries in PostgreSQL. |
| Raster delivery | TiTiler | Private service resolving registered asset IDs only. |
| Vector tile delivery | Martin | Private service over approved PostGIS views/snapshots. |
| OGC compatibility | pygeoapi | Bounded read/process facade behind the gateway. |
| Native processing | GDAL + Rasterio + Xarray + PDAL | Pinned, sandboxed worker images; absent from web/edge hot paths. |
| Raster format | COG | Immutable raster source and range delivery. |
| Datacube format | Zarr | Chunked multidimensional arrays with pinned codecs/layout. |
| Analytical format | GeoParquet + GeoArrow | Columnar exchange and bounded analytical execution. |
| Public tile snapshot | PMTiles | Immutable snapshot only; never transactional or authoritative geometry. |
| Offline exchange | GeoPackage | Versioned offline package with import review. |
| Point clouds | COPC + EPT | Indexed point-cloud storage/delivery. |
| Expert workbench | GeoLibre in P1 | Separate authenticated workbench; not embedded in P0. |

## 4. Required Service Shape

```text
Public/partner client
  -> CanopyProof edge and authorization gateway
  -> TerraProof registry/policy service
     -> PostGIS / pgSTAC
     -> immutable object storage
     -> TiTiler / Martin / pygeoapi
     -> isolated processing queue
  -> managed KMS/HSM signature
  -> signed, expiring map manifest
```

Every internal call must bind:

- short-lived service identity and audience;
- tenant, organization, and project context;
- declared purpose and operation;
- classification ceiling;
- evaluated license decision;
- audit correlation ID.

No public or service endpoint accepts an arbitrary remote URL. Callers provide
an opaque registry ID, and the private registry resolves only allowlisted,
policy-approved locations.

## 5. Data Authority Consequences

### Positive

- Geometry, catalog, object, provenance, and trust responsibilities are
  explicit and independently testable.
- Standards-based interchange does not surrender CanopyProof audit authority.
- Cloud-native formats can scale independently of transactional metadata.
- The public viewer receives a minimal disclosure-safe read model.
- Processing runtimes containing native parsers are isolated from Next.js and
  Cloudflare Worker request paths.

### Negative

- P0 requires several private services and disciplined operational ownership.
- A single transaction cannot atomically cover PostgreSQL, object storage,
  processing, signing, and CanopyProof audit; workflows need idempotency and
  reconciliation.
- STAC and OGC compatibility introduce versioning and conformance obligations.
- Object immutability, key rotation, disaster recovery, and license policy
  require continuing governance rather than one-time setup.

### Neutral

- PostgreSQL remains the authority for metadata and geometry, while binaries
  use object storage. This is intentional separation, not data duplication to
  be eliminated.
- PMTiles, GeoParquet, and GeoPackage are generated projections or exchange
  packages. They do not become writable systems of record.

## 6. Alternatives Considered

### 6.1 One Full-Stack GIS Portal

GeoNode, TerriaJS, GeoServer, or another portal could expose many capabilities
quickly. Rejected as the P0 core because it creates a second identity/catalog
surface and obscures proof authority. These products remain compatibility
targets where appropriate.

### 6.2 OpenLayers Instead Of MapLibre

OpenLayers is capable and standards-rich. Rejected for P0 because MapLibre plus
deck.gl better matches the selected vector-tile and high-volume overlay path,
and introducing both creates duplicate camera, style, accessibility, cache, and
security behavior.

### 6.3 CesiumJS As The P0 Renderer

CesiumJS is a strong 3D globe and 3D Tiles platform. Deferred to `LAB_ONLY`
because P0 needs an accountable 2D/2.5D evidence viewer, not a second global 3D
runtime. A later decision may approve it for measured 3D/time-dynamic needs.

### 6.4 GeoLibre Embedded In P0

Rejected. An expert desktop/browser workbench has a larger file, plugin,
processing, and export surface than the public map requires. GeoLibre remains a
P1 separately authenticated workbench.

### 6.5 STAC Or PMTiles As Proof Authority

Rejected. STAC is a discovery contract and pgSTAC records may be replaced;
PMTiles is an immutable tile archive. Neither supplies CanopyProof identity,
verification, challenge, governance, or append-only audit semantics.

### 6.6 Large Binaries In PostgreSQL

Rejected because it couples transactional recovery, replication, and query
capacity to large raster/point-cloud payloads. PostgreSQL stores metadata,
relationships, checksums, and object references.

### 6.7 Distributed Processing In P0

Dask, Sedona, and broad Open Data Cube deployment are deferred. They add
schedulers and failure domains before measurements prove bounded workers and
PostGIS insufficient.

## 7. Mandatory Controls Before Implementation

Architecture approval is necessary but not sufficient. The first implementation
change must include or reference approved designs for:

- row-level tenant isolation and application authorization;
- immutable object registration and checksum verification;
- safe geometry and CRS validation, including antimeridian/polar cases;
- service token issuance, audience, expiry, replay, and revocation;
- no-arbitrary-URL enforcement and outbound-network allowlists;
- manifest canonicalization, signature verification, expiry, nonce, and key
  rotation;
- license-policy evaluation and export restrictions;
- sensitive-location generalization;
- processing sandbox, resource quotas, parser limits, and supply-chain pins;
- provenance completeness and uncertainty acceptance;
- human-review and AI non-authority enforcement;
- Earth-only production policy.

## 8. Implementation Sequence After Approval

1. Define pure domain contracts and policy tests.
2. Add reversible PostGIS/pgSTAC migrations and immutable object registry.
3. Add private gateway contracts and service authentication.
4. Add one fixture collection and deterministic processing recipe in a
   non-production environment.
5. Add signed manifest generation and verification tests.
6. Add the MapLibre plus deck.gl shell against fixture manifests.
7. Add security, governance, provenance, uncertainty, load, and recovery gates.
8. Produce `docs/TERRAPROOF_P0_READINESS.md`.

No production deployment is part of this sequence without a separate guarded
release decision.

## 9. Rollback Decision

Each phase is feature-gated and additive. Rollback disables routes, service
audiences, processing queues, and manifest issuance while preserving immutable
objects, audit events, run records, and provenance. Database migrations must
have documented reverse operations where data-preserving reversal is possible;
otherwise rollback uses forward compensating migrations.

## 10. Approval Record

No approval is implied by authoring or reviewing this document. A role must be
filled by a named accountable human with a UTC timestamp and rationale.

| Required role | Reviewer | Decision | Timestamp | Rationale |
| --- | --- | --- | --- | --- |
| Principal Architecture | PENDING | PENDING | PENDING | PENDING |
| Security | PENDING | PENDING | PENDING | PENDING |
| Data Governance and Licensing | PENDING | PENDING | PENDING | PENDING |
| Earth Science / MRV Methodology | PENDING | PENDING | PENDING | PENDING |
| Platform Operations | PENDING | PENDING | PENDING | PENDING |

Approval rule: all five roles must record `APPROVE`. Any `REJECT`, missing role,
or conditional decision keeps the implementation gate closed. Approval must be
committed as a review-only change before any implementation commit.

## 11. Current Decision

`PROPOSED`. Do not install dependencies, create migrations, add services,
implement the manifest route, or build the viewer until the approval record is
complete and this ADR status is changed to `ACCEPTED` in a separate review
commit.
