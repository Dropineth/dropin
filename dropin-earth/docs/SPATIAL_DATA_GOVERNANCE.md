# TerraProof Spatial Data Governance

Status: PROPOSED - ADR approval required

Date: 2026-07-12

Scope: TerraProof Spatial Fabric P0 data, metadata, processing, disclosure, and
institutional use

## 1. Purpose

This policy defines how spatial data enters, moves through, and leaves
CanopyProof. It preserves a strict distinction between spatial observations and
institutional proof. A map, sensor reading, model output, or external catalog
record is evidence input until CanopyProof verification and governance rules
authorize a bounded conclusion.

The policy applies to employees, contractors, partners, services, devices,
agents, processing workers, and external connectors. It does not authorize
implementation or deployment before `ADR_SPATIAL_STACK.md` is accepted.

## 2. Authority And Stewardship

| Record | System authority | Accountable steward |
| --- | --- | --- |
| Identity, organization, membership | CanopyProof Trust Layer | Identity and Security |
| Project and project authorization | CanopyProof Trust Layer | Project Governance |
| Evidence and verification state | CanopyProof Trust Layer | Verification Authority |
| Certificate, challenge, correction, audit | CanopyProof Trust Layer | Governance and Audit |
| Spatial asset metadata and object registration | TerraProof | Spatial Data Steward |
| Geometry and spatial relationships | TerraProof/PostGIS | Spatial Data Steward |
| STAC discovery record | TerraProof/pgSTAC | Catalog Steward |
| Processing recipe and run | TerraProof | Methodology Owner |
| Derived product, quality, uncertainty | TerraProof | Methodology Owner and Human Reviewer |
| Binary object | Immutable object storage | Data Custodian |
| Public map projection | SignedMapManifest | Disclosure Authority |
| External GIS/source record | External provider | External provider; treated as untrusted input by CanopyProof |

No steward may approve an output they generated when independent review is
required. AI and processing services cannot be accountable reviewers.

## 3. Classification

Every asset, geometry, catalog item, product, package, and manifest source must
have exactly one classification.

| Class | Examples | Minimum controls |
| --- | --- | --- |
| `PUBLIC` | Approved generalized project boundary, public basemap snapshot, published proof reference | Signed/versioned disclosure, license permits public display, no credentials or sensitive locations. |
| `INTERNAL` | Routine processing metadata, non-sensitive quality diagnostics | Authenticated workforce/service access, tenant scope, audit correlation. |
| `RESTRICTED` | Precise project plots, unpublished imagery, partner data, device locations | Explicit role and purpose, project scope, short-lived access, export policy, detailed audit. |
| `HIGHLY_RESTRICTED` | Sensitive species, vulnerable community locations, embargoed government data, security-sensitive infrastructure | Named approval, minimum precision, no public tiles, no bulk export, enhanced monitoring and legal controls. |

Classification inheritance is monotonic by default: a derived product inherits
the highest classification of any input. Lowering classification requires an
approved `SpatialDisclosureView`, documented transformation, license decision,
quality review, and audit event.

## 4. Tenant, Organization, And Project Isolation

- `tenantId` is mandatory on every production record and storage registration.
- `organizationId` identifies the owning/stewarding institution.
- `projectId` is mandatory unless a governance-approved shared reference
  collection explicitly permits cross-project use.
- Authorization uses verified identity and membership. Client-supplied tenant
  or role headers are not authority.
- Application policy and database row-level security both enforce tenant scope.
- Object storage, cache keys, processing queues, logs, and metrics carry opaque
  tenant/project partitions without exposing names or restricted coordinates.
- Cross-tenant data combination requires an approved agreement, explicit input
  references, a new output tenant/owner, and a complete audit trail.

An administrator role does not imply unrestricted data access. Access must also
match purpose, project, classification, license, and legal constraints.

## 5. Registration And Ingest

No binary or external reference is queryable until registration succeeds:

1. Authenticate the source actor/service and bind tenant/project context.
2. Verify `bodyId`; production accepts only `earth`.
3. Resolve the source through a connector allowlist. Reject arbitrary URLs,
   redirects outside the allowlist, local/private addresses, and unsupported
   schemes.
4. Stream into quarantine with byte, time, recursion, dimension, and feature
   limits.
5. Detect media type independently from the filename.
6. Compute checksum and byte size while ingesting.
7. Validate format structure, CRS, geometry, extent, temporal metadata, and
   decompression bounds in an isolated worker.
8. Evaluate license, classification, retention, residency, consent, and
   sensitive-location policy.
9. Write the immutable object version.
10. Register metadata, geometry, provenance root, and quality state.
11. Append the CanopyProof audit event.

Failure at any step leaves the object quarantined or rejected and unavailable
to map, processing, export, verification, and reporting paths.

## 6. Immutability And Versioning

- Raw assets and accepted derived products are immutable.
- A byte change creates a new asset version with a new checksum and object
  reference.
- Geometry correction creates a new geometry version; prior geometry remains
  addressable for audit and challenge review.
- Catalog updates occur only after the corresponding immutable TerraProof
  version and audit event exist.
- Processing recipes are immutable after approval. A parameter, software,
  quality-gate, or uncertainty-method change creates a new recipe version.
- PMTiles, GeoPackage, GeoParquet, and other exports are immutable generated
  packages with source and policy versions embedded in their manifest.
- Deletion is a lifecycle state and access revocation, not silent history
  removal. Legal and contractual erasure is performed through governed deletion
  records while preserving non-sensitive proof of the action where permitted.

PMTiles can never write back to PostGIS or replace authoritative geometry.

## 7. License Governance

Every source and derived product references a versioned
`SpatialLicensePolicy`. The policy must record:

- licensor, source terms URL/document hash, and effective dates;
- attribution text and citation requirements;
- permitted access audiences and purposes;
- redistribution and public-display rights;
- derivative-work and model-training rights;
- commercial-use constraints;
- geographic, jurisdictional, and data-residency restrictions;
- expiration, revocation, and downstream-deletion obligations;
- share-alike or output-license requirements;
- whether precise coordinates may be exported.

Missing, conflicting, expired, or non-machine-resolvable terms block
institutional use. A permissive source license does not override personal,
community, indigenous, sensitive-species, security, or contractual restrictions.

Every export and manifest issue stores the evaluated license-policy version and
decision ID. `no-redistribution` inputs may be viewed only through an approved
non-exportable disclosure if the terms permit it; otherwise they remain hidden.

## 8. Quality Governance

Quality is multidimensional and methodology-specific. A single score may
summarize status for display but cannot replace measured checks.

Required assessment dimensions include:

- source identity and acquisition integrity;
- checksum and object completeness;
- CRS definition and transformation validity;
- geometry validity, topology, extent, and body/domain consistency;
- spatial resolution and positional accuracy;
- temporal resolution, latency, and expiry;
- cloud, shadow, missing-data, sensor, and atmospheric flags where relevant;
- sample coverage, bias, and representativeness;
- processing determinism and replay result;
- reference-data and ground-truth fitness;
- reviewer qualifications and conflicts.

Thresholds belong to an approved methodology version. They cannot be relaxed by
a renderer, connector, AI model, or processing worker.

## 9. Uncertainty Governance

Every institutional metric or material spatial conclusion requires a versioned
`UncertaintyBudget` containing:

- components and units;
- source or estimation method for each component;
- probability distribution or bounded interval;
- correlations and independence assumptions;
- propagation method and software version;
- resulting confidence interval;
- sensitivity analysis for material assumptions;
- reviewer, review time, and methodology version.

Unknown uncertainty is represented as unknown and blocks claims that require a
quantified bound. It must not be converted to zero. Map styling must not imply
greater precision than the source and uncertainty permit.

## 10. Sensitive Location Policy

Precise locations may expose endangered species, vulnerable communities,
land-tenure disputes, cultural sites, field workers, or critical infrastructure.

Controls:

- classify precise coordinates before catalog publication;
- retain precise geometry only in the restricted authority;
- create a separate generalized disclosure geometry using a documented method;
- apply minimum aggregation, coordinate jitter, masking, or regional summaries
  appropriate to the threat and methodology;
- remove identifying attributes and fine timestamps where linkage could
  reconstruct a location;
- prohibit raw tile enumeration and bulk export;
- require re-identification risk review for joined datasets;
- expose the generalization method and fitness limitations without exposing the
  hidden location.

GBIF, field, drone, and SensorThings inputs receive the same treatment even when
the source endpoint is public.

## 11. Provenance And Methodology Governance

Each derived product must have a complete path to immutable inputs. The path
records input hashes, ordered operations, canonical parameters, software and
image digests, execution environment, actor/service identities, start/end
times, output hashes, quality gates, uncertainty method, human-review state,
and audit event.

Requirements:

- provenance edges are append-only;
- cycles are rejected;
- all referenced versions must exist and match hashes;
- processing cannot silently substitute an input or software version;
- external provider identifiers are preserved alongside internal IDs;
- W3C PROV/OpenLineage mappings are exports, not replacement authority;
- AHIN `ASSERT`, `REASON`, `DELEGATE`, `FULFILL`, and `CHALLENGE` events link to
  the same correlation/provenance root;
- a challenge never deletes the original lineage; resolution appends a new
  state, correction, supersession, or non-reliance notice.

## 12. Retention, Legal Hold, And Disposal

Retention policies are versioned identifiers evaluated at ingest and whenever
classification, license, agreement, or legal status changes.

- Raw evidence-supporting assets remain available for the proof/audit retention
  period unless law or contract requires earlier deletion.
- Derived caches and regenerable tiles may have shorter retention but retain
  recipe and source references.
- Active challenge, investigation, litigation, or audit creates a legal hold
  that suspends lifecycle deletion.
- Expired access is revoked promptly even when bytes remain under legal hold.
- Disposal verifies object versions, replicas, caches, and offline packages;
  appends a disposal audit event; and retains only the minimum lawful tombstone.
- Backups follow the same residency and access controls, with documented expiry
  and restoration handling for deleted/held data.

## 13. Disclosure And Export

Public and partner disclosure uses an approved `SpatialDisclosureView` and a
signed map/export manifest. The manifest is versioned, expiring, audience-bound,
tenant/project-scoped, read-only, credential-free, and limited to allowlisted
assets.

Before release, policy verifies:

- identity/audience and purpose;
- classification and sensitive-location treatment;
- license and attribution;
- project and tenant scope;
- asset currency, challenge, withdrawal, and expiry state;
- provenance, quality, and uncertainty fitness;
- format-specific risks and size limits.

Exports include a machine-readable manifest with source hashes, license terms,
classification, CRS, geometry precision, methodology, provenance root, quality,
uncertainty, creation time, expiry, and audit reference.

Credentials, private object URLs, raw access tokens, database identifiers, and
unapproved precise locations are never exported.

## 14. Planetary Scope

Production is Earth-only:

- `bodyId` must equal `earth` at ingest, processing, catalog, manifest, map, ESG,
  and certificate boundaries.
- Moon, Mars, unknown, or missing body values fail closed.
- `PLANETARY_LAB=true` is permitted only in a separately isolated non-production
  environment with separate storage, database, identity audience, and routes.
- Planetary-lab assets cannot be copied, linked, or aggregated into an Earth
  ESG report or production proof record.

## 15. AI And Automated Processing

AI may classify, detect anomalies, estimate uncertainty components, or recommend
review. It must:

- identify the model, version, input hashes, parameters, and execution context;
- expose confidence and known limitations;
- remain reproducible or retain sufficient output evidence;
- never approve its own output;
- never issue a certificate or final institutional conclusion;
- route material disagreement and low confidence to a qualified human.

## 16. Incident, Challenge, And Correction

Suspected tampering, license violation, cross-tenant exposure, sensitive-location
leak, invalid geometry/CRS, provenance break, or processing compromise triggers:

1. suspend affected manifests, exports, and processing;
2. preserve objects, logs, decisions, and audit evidence under legal hold;
3. append a challenge/incident event;
4. identify affected products, reports, projects, tenants, and recipients through
   provenance edges;
5. notify accountable governance/security roles;
6. issue an append-only correction, supersession, withdrawal, or non-reliance
   notice after independent review;
7. rotate/revoke service or signing credentials where applicable;
8. document root cause, remediation, and controlled re-enable decision.

## 17. Governance Gates

An asset or product cannot enter institutional reporting when license is
missing, provenance is incomplete, CRS/geometry is invalid, cloud or resolution
violates methodology, the asset is expired, tenant scope mismatches, sensitive
location is exposed, methodology is unapproved, uncertainty is absent, or human
review is required but missing.

Exceptions require a governance decision that narrows use; an exception cannot
waive law, contract, tenant isolation, audit integrity, or the prohibition on AI
self-approval.

## 18. Review Cadence

Data Governance, Security, Earth Science, and Platform Operations review this
policy at least annually and whenever a material format, provider, jurisdiction,
methodology, service, disclosure class, or threat changes. Changes are versioned
and auditable; they do not retroactively erase prior policy decisions.
