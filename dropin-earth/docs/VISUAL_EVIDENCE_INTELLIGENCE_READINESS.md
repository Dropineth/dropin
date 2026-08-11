# Visual Evidence Intelligence Readiness

Date: 2026-07-13

Status: **NON-PRODUCTION FOUNDATION - NOT DEPLOYED**

Decision: **NOT READY FOR INSTITUTIONAL OR PRODUCTION DATA**

This assessment covers the Visual Evidence Intelligence and 3D structural MRV
foundation only. It does not authorize a deployment, a production migration,
institutional data ingestion, environmental proof verification, certificate
issuance, ESG publication, or funding release.

## Authority Boundary

The implemented contracts preserve the required separation of authority:

- CanopyProof remains authoritative for identity, projects, evidence,
  verification, challenges, governance, audit, reporting, and funding
  decisions.
- TerraProof is intended to remain authoritative for spatial acquisitions,
  spatial assets, processing recipes, derived products, quality,
  uncertainty, and spatial provenance. The TerraProof implementation gate in
  `ADR_SPATIAL_STACK.md` remains closed.
- FiftyOne is modeled only as an isolated internal review workbench. Its
  labels, saved views, embeddings, operators, and decisions are not proof
  records and cannot become final authority.
- Model output is a candidate signal. AI cannot verify evidence, issue a
  certificate, publish an ESG metric, or release funding.
- Human review is necessary but is not sufficient for proof. Existing
  CanopyProof verification and governance authority remains required.

## Implemented

### Governance and design

- An architecture RFC defines authority, trust boundaries, data flow, threat
  model, lifecycle, APIs, persistence, migration, and rollback posture.
- Separate policies define FiftyOne isolation, visual-evidence threats,
  point-cloud MRV handling, and visual-data licensing.
- Official-source due diligence records the capabilities and limitations of
  FiftyOne, VineLiDAR, and Ariel Scans.
- VineLiDAR is restricted to an attributed CC BY 4.0 lab benchmark.
- Ariel Scans is fail-closed as `EXPLICIT_RIGHTS_REQUIRED` and is denied for
  institutional redistribution, training, or public export by default.

### Typed domain and policy contracts

- Strongly typed records cover acquisitions, sensor streams, datasets and
  snapshots, media and point clouds, derived assets, models and model runs,
  embeddings, candidates, immutable review queues, human decisions, field
  checks, hard negatives, known decoys, sensor gaps, bounded findings, and
  visual provenance edges.
- License decisions are computed as the intersection of asset, dataset,
  project, and requested-use policies.
- Sensor applicability declares supported sensor, resolution, altitude,
  season, ecosystem, geography, limitations, and calibration references.
- RGB/thermal, altitude, ecosystem, and unregistered-coordinate mismatches
  fail closed.
- Rejected candidates, known decoys, and hard negatives remain append-only
  inputs for calibration, evaluation, reviewer training, and regression
  testing.

### Point-cloud contracts

- LAZ and COPC are authoritative formats; PCD and rendered previews are review
  derivatives only.
- Raw object identity is checksum-bound and immutable.
- Local-frame and absolute-CRS scenes cannot be compared until an explicit
  registration record exists.
- Cross-season comparison requires an uncertainty plan.
- Derived DTM, DSM, CHM, density, continuity, and review products retain
  source and processing lineage.
- A downsampled PCD cannot replace an authoritative LAZ or COPC asset.

### Review and field workflow

- Review queues freeze dataset snapshot, manifest hash, sample and candidate
  membership, filters, sort expression, model runs, creator, time, and queue
  hash.
- Changed membership produces a new queue version and hash instead of
  mutating prior review context.
- Candidate ranking can combine model score, geometry, novelty, uncertainty,
  cross-sensor agreement, temporal change, and random QA sampling without
  becoming a final decision.
- Field tasks require bounded location handling, observations, organization,
  reviewer, expiration, device binding, and audit linkage.
- A field-confirmed result requires device attestation and still cannot issue
  proof by itself.

### FiftyOne isolation scaffold

- An internal integration workspace defines an allowlisted CanopyProof review
  plugin and loopback-only sidecar client.
- Short-lived, queue-bound manifests contain internal media handles rather
  than storage credentials or public object URLs.
- Manifests are signature-verifiable, expire after at most 15 minutes, and
  support replay denial through an injected replay store contract.
- Plugin actions are limited to review, second-review requests, field-task
  requests, challenge drafts, and hard-negative registration.
- The client rejects redirects, non-loopback endpoints, unknown actions,
  oversized payloads, and secret-shaped values.
- Delegated and distributed plugin execution is disabled in the scaffold.

### API, persistence, and observability contracts

- Strict Zod contracts cover dataset registration and reads, model runs,
  review queues, candidate reviews, field checks and results, hard negatives,
  and FiftyOne manifests.
- Visual authority snapshots now bind a credential-free actor snapshot, actor
  type, and authority root into every fact hash. Snapshot replay rejects
  embedded/canonical audit divergence, cross-scope references, broken queue
  version lineage, missing source records, and machine-to-proof promotion, and
  can safely rebuild in-memory indexes after restart.
- Mutation contracts reject caller-supplied authority fields and unknown
  properties. A durable Trust Registry adapter now accepts only a verified
  complete authority snapshot, derives its append-only delta, binds every new
  actor to canonical identity/organization/membership/accreditation state, and
  commits the delta under Serializable isolation.
- A PostgreSQL schema contract defines append-only facts, queue snapshots,
  queue membership, canonical hash/audit binding, mutation-denial triggers,
  database audit capture, constraints, and row-level security. Idempotency uses
  the Trust Kernel's canonical `audit.command_receipts`; no parallel visual
  receipt truth exists.
- The upstream Evidence Protocol E2 boundary now durably records consent- and
  device-bound media intents, modeled provider object receipts, scan results,
  quarantine projections, semantic events, and command receipts without
  persisting upload grants or provider credentials. E3a additionally records
  independent media review and exact-source custody facts. Visual-intelligence
  facts now share the Trust Registry identity and audit transaction boundary,
  but no route yet promotes them into evidence, verification, or proof.
- The rollback script refuses destructive rollback after authority facts exist;
  canonical semantic events, database events, and command receipts remain in
  the Trust Kernel regardless of visual-schema lifecycle.
- Low-cardinality counters and quality aggregates cover ingestion, point
  clouds, model runs, candidates, reviews, field checks, false positives,
  decoys, sensor conflicts, CRS denials, license denials, review time,
  confirmation, disagreement, and failure rates.

## Not Implemented

The following are explicit blockers, not deferred polish:

- No production route mounts these API contracts.
- No production route or command-specific application service invokes the
  durable snapshot adapter. It is connected to Trust Registry identity,
  tenant, organization, audit, and idempotency authority, but intentionally
  does not grant verification, challenge resolution, governance, certificate,
  ESG, or funding authority.
- No production PostgreSQL migration has been applied. The new SQL contract
  was exercised with PGlite only.
- No production object store, PostGIS layer, TerraProof spatial authority,
  STAC catalog, PMTiles/3D Tiles pipeline, or native LAZ/COPC parser is wired.
- No real VineLiDAR, Ariel Scans, institutional, project, field-device, image,
  thermal, or point-cloud bytes were downloaded or ingested.
- No checksum validation, CRS transformation, COPC normalization, DTM, DSM,
  CHM, density, continuity, or cross-season computation ran on real assets.
- No production model runtime, embedding index, detector, calibration set, or
  model registry is connected.
- No live FiftyOne or MongoDB service is configured. There is intentionally no
  runnable unpinned Docker image, so a Docker build was not performed.
- No approved image digest, software bill of materials, vulnerability scan,
  network policy, identity provider, or tenant-specific workbench deployment
  exists.
- No KMS/HSM-backed manifest signer, durable replay store, short-lived media
  capability issuer, or auditable credential broker is connected.
- No reviewer assignment service, separation-of-duties engine, collusion
  control, appeals workflow, or institution-approved field protocol is
  connected.
- No native PostgreSQL concurrency, row-level-security, migration, restore,
  disaster-recovery, load, soak, parser-fuzzing, or end-to-end system test has
  been completed for this layer.
- No public UI, operational console, external API, deployment, or production
  report was created or changed in this phase.

## Security Risks

| Risk | Current control | Required before production |
| --- | --- | --- |
| Native media and point-cloud parser compromise | No parser or untrusted bytes are executed | Sandboxed workers, pinned parsers, size/complexity limits, fuzzing, malware scanning, and process isolation |
| FiftyOne plugin or dependency compromise | Allowlisted local actions and loopback-only scaffold | Pinned image digest, SBOM, signature verification, egress policy, runtime hardening, vulnerability review, and incident kill switch |
| Cross-tenant disclosure | Tenant-bound durable adapter, RLS contract, canonical actor checks, and opaque media handles | Object-level capabilities, native PostgreSQL RLS tests, and adversarial tenancy testing |
| Precise-location exposure | Generalized-location contract | Formal sensitivity classes, redaction policy, minimum necessary disclosure, access logging, retention limits, and field-worker safety review |
| Manifest replay or theft | Short expiry, signature contract, replay-store interface | KMS/HSM signer, durable single-use nonce store, clock policy, key rotation, revocation, and alerting |
| Reviewer collusion or account takeover | Human identity and audit fields are required | Strong authentication, accredited memberships, separation of duties, independent second review, anomaly detection, and recovery procedures |
| Embedding leakage or membership inference | No embeddings are exported by the scaffold | Treat indexes as sensitive derivatives, enforce tenant isolation and deletion/retention controls, and test extraction resistance |
| Audit omission or split-brain authority | Visual facts, canonical semantic events, database events, and Trust Kernel receipts commit in one Serializable transaction | Native database tests, reconciliation, transparency roots, and recovery drills |

## License Risks

- VineLiDAR's CC BY 4.0 terms require attribution and do not make its scenes
  production project evidence. The source dataset has no ground-truth
  detection or segmentation labels.
- The downsampled VineLiDAR PCD copies are review derivatives and cannot
  substitute for the original full-resolution LAZ assets.
- Original redistribution and downstream training rights for Ariel Scans
  imagery are not established by the reviewed repository metadata. All such
  uses remain denied until counsel records explicit rights and provenance.
- Dataset-level permission does not automatically grant rights over people,
  property, sensitive locations, derived embeddings, model weights, or public
  exports.
- A production license registry, takedown process, retention schedule,
  attribution renderer, and rights-revocation propagation mechanism do not
  yet exist.

## Sensor Risks

- RGB and thermal measurements are not interchangeable, and uncalibrated RGB
  is not reflectance evidence.
- Resolution, altitude, viewing geometry, season, ecosystem, geography,
  platform motion, weather, and calibration can cause domain shift.
- VineLiDAR mixes local/relative coordinate frames and EPSG:32629 scenes;
  direct comparison without registration is invalid.
- Downsampling can remove canopy structure, small objects, and uncertainty
  signals needed for institutional MRV.
- Thermal artifacts, shadows, vegetation, rocks, clouds, noise, and seasonal
  change remain first-class confounders rather than removable outliers.
- Device attestation establishes device context, not measurement correctness;
  calibration, custody, field protocol, and uncertainty are still required.

## Model Risks

- Machine-generated candidates can be confidently wrong. The known Ariel
  shadow false positive is preserved as a regression decoy.
- Embedding similarity and uniqueness are ranking aids, not identity,
  causality, ecological impact, or proof.
- Candidate reduction can hide systematic misses; random QA sampling and
  false-negative studies are required before operational use.
- Calibration and thresholds are dataset- and sensor-specific. Cross-domain
  reuse remains blocked until applicability review and validation.
- Human review can inherit automation bias. Interfaces must expose provenance,
  uncertainty, limitations, and decoys without presenting scores as truth.
- No production model cards, drift thresholds, shadow evaluation, rollback,
  reproducible model artifacts, or independent validation have been approved.

## Institutional Risks

- The contracts have not been reviewed or accepted by an accredited verifier,
  auditor, research institution, government body, UN partner, field
  organization, privacy officer, or legal counsel.
- There is no approved methodology tying visual findings to a governed
  environmental claim or uncertainty budget.
- No operational SLA, evidence retention policy, records hold, data residency
  decision, incident response exercise, or disaster-recovery objective exists
  for this layer.
- No institutional separation of acquisition, model operation, review,
  verification, challenge resolution, and governance authority has been
  exercised end to end.
- A bounded VisualFinding is not certified carbon credit evidence, a tax
  offset, a funding entitlement, a token allocation, or a guaranteed yield.

## Validation Evidence

Validation was performed locally on 2026-07-13 without deployment or real
institutional data.

| Check | Result |
| --- | --- |
| Focused TypeScript and PGlite visual tests | PASS - 24 tests, 0 failures |
| FiftyOne Python unit tests | PASS - 4 tests, 0 failures |
| Ruff lint and format check | PASS |
| Mypy strict adapter/plugin check | PASS - 3 source files |
| Python bytecode compilation | PASS |
| Focused ESLint and TypeScript checks | PASS |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run test` | PASS - 586 tests, 0 failures |
| `npm run db:verify:canopyproof` | PASS - 8 tests, 0 failures |
| `npm run build` | PASS |
| `npm run audit` | PASS - 0 vulnerabilities at moderate level |
| `npm --workspace apps/web run cf:build` | PASS |
| OpenNext worker and assets existence | PASS - worker present and assets directory populated |
| Aggregate `npm run ci` | PASS - exit code 0 |
| Docker build | NOT RUN - deployment-grade pinned image is intentionally absent |
| Native PostgreSQL migration and RLS suite | NOT RUN - PGlite contract coverage only |
| Real point-cloud or imagery pipeline | NOT RUN - no real data was ingested |

The existing Next.js builds emit two known warnings outside this visual layer:
the Next.js ESLint plugin is not detected in the current ESLint configuration,
and an Edge-runtime page disables static generation. Both builds completed,
but the warnings must be owned and resolved separately before claiming a
zero-warning production baseline.

## Next Phase Gates

Proceed only through an explicit architecture and security review. The next
phase should:

1. Approve or reject the TerraProof spatial authority ADR and define its
   durable interface to the Trust Kernel.
2. Obtain legal decisions for each dataset and intended action, especially
   Ariel Scans imagery, embeddings, training, and redistribution.
3. Add a native PostgreSQL migration in a disposable environment and test
   constraints, RLS, concurrency, idempotency, backup, restore, and rollback.
4. Add command-specific application services around the durable snapshot
   adapter, enforce canonical license-policy records and optimistic source
   roots, and validate the same transaction boundary under native PostgreSQL
   concurrency and RLS roles.
5. Establish KMS/HSM manifest signing, one-time replay protection, scoped
   media capabilities, key rotation, and credential-broker auditing.
6. Produce a pinned FiftyOne/MongoDB image set with SBOM, signatures,
   vulnerability scans, network isolation, storage encryption, and an
   operational kill switch before any Docker deployment.
7. Sandbox and fuzz native image, video, LAZ, COPC, and PCD processing before
   accepting untrusted bytes.
8. Run one synthetic, license-safe pilot through acquisition, processing,
   candidate generation, immutable review, field verification, challenge, and
   governance without issuing a real environmental claim.
9. Obtain independent security, privacy, scientific, licensing, and
   institutional-methodology approvals.
10. Re-run full validation, load and failure testing, disaster recovery, and a
    formal production readiness review. Deployment must remain a separately
    approved action.

## Safety Boundaries Preserved

- No production deployment or production report mutation occurred.
- No secrets, private keys, storage credentials, or admin tokens were added.
- No production API route or FiftyOne service was exposed.
- No mainnet funds or real-money path was enabled.
- No automatic CANOPY distribution was enabled.
- No certified carbon-credit or carbon-tax-offset claim was enabled.
- No guaranteed RWA yield was enabled.
- Existing API and Web Worker boundaries were not merged.
- Existing admin-proxy controls were not changed.

The phase is ready for design and security review of the non-production
foundation. It is not ready for deployment, institutional reliance, or
environmental claims.
