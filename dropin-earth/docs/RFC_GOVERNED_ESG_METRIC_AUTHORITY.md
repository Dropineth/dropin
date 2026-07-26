# RFC: Governed ESG Metric Authority

Status: ACCEPTED FOR ROUTE-CLOSED IMPLEMENTATION

Date: 2026-07-14

Owners: CanopyProof Trust Kernel, Scientific Governance, ESG Reporting

## 1. Problem Statement

CanopyProof has a durable canonical ESG report authority, but the report facts
currently bind frameworks and Environmental Proof lineage without a governed
machine-readable metric definition or calculation result. A framework-shaped
report is not an institutional data product unless every number and explicit
missing value can answer:

- what was measured or calculated;
- which definition and methodology version governed it;
- which unit, precision, rounding, aggregation, spatial boundary and temporal
  boundary were used;
- which immutable source records and calculation artifact produced it;
- what uncertainty interval or unavailable state applies;
- which independent human reviewed it; and
- whether its definition and source authority remain current.

JavaScript binary floating point is also unsuitable as a canonical interchange
for report roots. The authority must hash exact decimal representations and
must never convert missing, withheld, below-detection or unavailable values to
zero.

This RFC introduces a route-closed, tenant-bound, append-only ESG metric
authority. It does not claim framework conformance, assurance, certified carbon
credits, tax treatment, financial assets, guaranteed yield, mainnet funds or
automatic CANOPY distribution.

## 2. Goals

1. Publish immutable, versioned metric definitions under independent human
   scientific governance.
2. Record exact metric results with deterministic decimal normalization,
   explicit value state, unit, precision, rounding and uncertainty.
3. Bind each result to one current metric definition, one current published
   methodology and immutable Environmental Proof source members.
4. Require an accredited human calculator and a distinct accredited human
   reviewer. AI and agents may contribute calculation artifacts but cannot
   approve results.
5. Re-resolve definition, methodology and source currentness when projecting a
   result for a report.
6. Commit facts, semantic audit events, database audit events and exact command
   receipts atomically under serializable transactions and advisory locks.
7. Supply deterministic roots that the canonical ESG report authority can bind
   without copying mutable source payloads.
8. Keep every HTTP route and production activation flag closed until privacy,
   scientific, legal, security and operations review is complete.

## 3. Non-Goals

- No live satellite, model, object-storage or provider call.
- No automatic aggregation across projects or organizations.
- No currency, token, credit, offset or financial valuation metric.
- No claim that a metric mapping is endorsed by GRI, ISSB, TCFD, TNFD, UNFCCC
  or the United Nations.
- No production PDF rendering or public disclosure route.
- No deletion or mutation of historical definitions or results.
- No private-key custody or application-generated institutional signature.

## 4. Authority Model

### 4.1 Metric Definition Publication

A definition is publishable only when:

- its owner organization is verified;
- its publisher is a verified human with an active membership and approved
  `esg_metric:govern` accreditation;
- at least two unique, verified, active and approved human reviewers hold
  `esg_metric:govern` accreditation;
- publisher and reviewers are distinct;
- its bound methodology publication is current and published;
- dimensions, units, precision, rounding, aggregation, boundaries, source
  requirements, uncertainty policy, limitations and framework mappings are
  complete; and
- any predecessor is the latest definition version for the same slug.

Definitions use immutable semantic versions. Supersession creates a new fact;
the predecessor remains replayable and projects as `superseded`.

### 4.2 Metric Result Review

A result is recordable only when:

- organization and project match every source member;
- the metric definition and its methodology publication are current;
- the calculator is a verified human with `esg_metric:calculate` authority;
- the reviewer is a different verified human with `esg_metric:review`
  authority;
- the reviewer decision is `accept`;
- reporting and observation periods are valid and bounded;
- the unit is permitted by the exact definition version;
- decimal precision does not exceed the definition precision;
- every source is a current governed Environmental Proof record with active,
  signed lifecycle and reviewed MRV lineage;
- the calculation artifact digest and source-member roots are complete; and
- uncertainty is explicit.

The value state is one of:

- `reported`: exact decimal value and uncertainty interval required;
- `below_detection_limit`: no value, detection limit required;
- `not_applicable`: no value;
- `withheld`: no value and a privacy-safe reason required; or
- `unavailable`: no value and a limitation required.

Unknown is never encoded as zero.

### 4.3 Currentness Projection

A historical result is immutable. At evaluation time its projection is:

- `current`: exact definition and every source authority remain current;
- `definition_superseded`: a successor definition exists;
- `methodology_superseded`: the bound methodology publication is no longer
  current;
- `source_stale`: a source binding changed or is incomplete;
- `challenged`: any source is challenged;
- `revoked`: any source is revoked; or
- `expired`: any source lifecycle is expired.

Only `current` results may enter a newly generated canonical ESG report.

## 5. Canonical Data Contracts

### 5.1 Definition Fact

```text
metric_definition_id
slug
version
title
description
dimension
canonical_unit
allowed_units[]
precision_scale
rounding_mode
aggregation_method
spatial_aggregation
temporal_aggregation
source_requirements[]
uncertainty_policy
framework_mappings[]
methodology_publication_id/root
owner_organization_snapshot
publisher_snapshot
reviewer_snapshots[]
limitations[]
supersedes_definition_id/root?
effective_at
command_hash
definition_hash
definition_root
semantic_event
safety
```

### 5.2 Result And Source-Member Facts

```text
metric_result_id
organization_id
project_id
metric_definition_id/root
reporting_period
observation_period
value_state
decimal_value?
unit
detection_limit?
uncertainty_lower/upper?
uncertainty_confidence_pct?
calculation_artifact_hash
calculator_snapshot
reviewer_snapshot
review_rationale
limitations[]
source_record_ids[]
source_member_roots[]
source_set_root
evidence_root
verification_root
monitoring_root
command_hash
result_hash
result_root
semantic_event
safety
```

Each source member repeats only immutable identifiers and roots required to
prove exact historical binding. Raw evidence, coordinates, media, personal data
and reviewer notes are excluded.

### 5.3 Decimal Canonicalization

- Input is a string matching `-?[0-9]+(\.[0-9]+)?`.
- Leading plus signs, exponent notation, commas, whitespace, `NaN`, infinity
  and negative zero are rejected.
- Leading integer zeros are removed; trailing fractional zeros are removed.
- Canonical zero is `0`.
- Fractional digits must not exceed `precision_scale`.
- Interval order is compared with exact signed integer coefficients at a common
  scale, never with binary floating point.

## 6. Deterministic Roots

All roots use `hashJson` with an explicit domain and canonical arrays:

- `canopyproof/esg-metric-definition-command/v1`
- `canopyproof/esg-metric-definition/v1`
- `canopyproof/esg-metric-definition-root/v1`
- `canopyproof/esg-metric-source-member/v1`
- `canopyproof/esg-metric-result-command/v1`
- `canopyproof/esg-metric-result/v1`
- `canopyproof/esg-metric-result-root/v1`
- `canopyproof/esg-metric-result-projection/v1`

Arrays are sorted where order has no meaning. Reviewers are sorted by actor ID.
Source members are sorted by record ID and assigned a contiguous member index.
Tenant/project semantic stream keys use length-prefixed components to prevent
delimiter collisions.

## 7. Data Flow

```text
Governed Methodology Publication
  -> independent definition review
  -> immutable MetricDefinition fact
  -> current definition projection

Current Environmental Proof + MRV + signed lifecycle sources
  -> deterministic calculation outside DB transaction
  -> exact decimal and uncertainty envelope
  -> independent human result review
  -> serializable MetricResult + members + audit + receipt commit
  -> current result projection
  -> canonical ESG report member binding
```

External computation must occur before the database transaction. The database
transaction validates hashes and current authority; it must not make network or
model calls.

## 8. Threat Model

| Threat | Required control |
| --- | --- |
| Definition substitution | Result binds exact definition ID/root and methodology publication root. |
| Self-approval | Publisher, definition reviewers, calculator and result reviewer are role-checked; calculator and result reviewer must differ. |
| Agent approval | Participant type must be `human`; AI artifacts are non-authoritative inputs. |
| Unit confusion | Closed dimension/unit registry and exact allowed-unit membership. |
| Floating-point drift | Canonical decimal strings and exact coefficient comparison. |
| Missing-as-zero | Typed value states and mutually exclusive field constraints. |
| False precision | Definition precision limit plus mandatory uncertainty policy. |
| Stale source laundering | Projection re-resolves current proof, MRV, lifecycle and signature authority. |
| Cross-tenant read/write | Forced RLS plus transaction-local organization and actor context. |
| Command replay conflict | Exact command receipt; same key with different hash fails. |
| Stream collision | Length-prefixed organization/project/definition stream keys. |
| Partial write | Report/result, members, semantic event and receipt in one serializable transaction. |
| Audit rewrite | Append-only triggers and database mutation audit stream. |
| Unsafe public claim | Bounded text validation and fixed safety object. |
| Rollback erasure | Rollback refuses while any authority fact, event or receipt exists. |

## 9. Database Design

New additive migration `services/api/prisma/esg-metric-authority.sql` creates:

- `reporting.esg_metric_definition_facts`;
- `reporting.esg_metric_result_facts`; and
- `reporting.esg_metric_result_source_facts`.

The migration also creates canonical hash/projection functions, validation
triggers, append-only guards, database-audit triggers, forced RLS policies and
indexes by owner organization, project, definition slug/version and time.

No existing column is removed or rewritten. The migration is idempotent and
runs after the Trust Kernel, MRV, lifecycle and canonical ESG migrations.

## 10. Repository And Transaction Design

The Prisma repository:

1. opens a serializable transaction;
2. sets tenant and actor context;
3. locks the exact idempotency key and semantic stream;
4. re-resolves organization, actor, accreditation, methodology, definition and
   proof/lifecycle source authority;
5. checks an existing receipt for exact retry;
6. inserts immutable facts and source members;
7. inserts the semantic audit event;
8. inserts the exact command receipt; and
9. reloads and deterministically replays the committed bundle.

Retry is bounded to PostgreSQL serialization, deadlock and unique-race errors;
the command and authority inputs never change across retry.

## 11. API Design

No HTTP route is mounted in this phase. Future reviewed routes are:

```text
POST /canopyproof/reporting/metric-definitions
GET  /canopyproof/reporting/metric-definitions/:id
POST /canopyproof/reporting/metric-results
GET  /canopyproof/reporting/metric-results/:id
GET  /canopyproof/reporting/metric-results/:id/projection
```

Route activation requires production identity binding, purpose-limited
authorization, privacy review, rate limits, audit export, schema versioning and
institutional governance approval. Compatibility `/reports/esg` routes cannot
write canonical metric facts.

## 12. Migration Strategy

1. Apply Trust Kernel and governance migrations.
2. Apply MRV and Environmental Proof lifecycle migrations.
3. Apply canonical ESG reporting migration.
4. Apply this additive metric migration twice in an empty PGlite database to
   prove idempotency.
5. Run unit root/replay tests, PGlite contract tests and disposable native
   PostgreSQL dual-connection tests.
6. Keep route and production activation flags false.
7. Backfill nothing automatically. Any future legacy report migration creates
   new governed facts after human review.

## 13. Rollback Strategy

`services/api/prisma/esg-metric-authority.rollback.sql` removes only an empty
authority. It first refuses if any definition, result, source member, semantic
event or command receipt exists. Once facts exist, remediation is forward-only
through supersession or a challenged/revoked projection. Historical evidence
must never be deleted to make rollback succeed.

## 14. Test Plan

### Unit

- deterministic definition, member, result and projection roots;
- exact decimal normalization and comparison;
- version supersession;
- missing-value states never serialize numeric zero;
- unit, precision and interval rejection;
- agent, self-review, stale accreditation and unsafe text rejection;
- challenged, revoked, expired, stale and superseded projections;
- replay and self-consistent tamper rejection.

### Database

- idempotent migration;
- SQL/TypeScript hash parity;
- exact retry and conflicting retry;
- concurrent dual-connection writes;
- forced RLS and cross-tenant denial;
- append-only update/delete denial;
- current authority re-resolution;
- non-empty rollback refusal and empty rollback success;
- restart replay.

### Reporting Integration

- canonical ESG report accepts only current metric results;
- report root changes when any metric result root changes;
- stale/challenged/revoked/expired metric result blocks new report generation;
- compatibility report APIs cannot claim canonical metric authority.

## 15. Activation And Claims Boundary

Implementation completion is engineering evidence only. Production and
institutional reliance remain blocked until scientific methodology review,
framework mapping review, privacy and legal review, verifier operations,
least-privilege database grants, observability, backup/restore, incident
response and external security review are complete.
