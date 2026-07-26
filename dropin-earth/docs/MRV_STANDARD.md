# CanopyProof Digital MRV Standard

Status: route-closed durable core implemented and PGlite verified; native
PostgreSQL, current-reliance, challenge-edge, and HTTP gates remain pending

## Purpose

This standard defines the minimum lineage required for a CanopyProof digital
measurement, reporting, and verification record to become institutionally
reviewable. It does not create a certified carbon credit, carbon-tax offset,
financial asset, guaranteed yield, mainnet-fund instruction, or automatic CANOPY
distribution.

No MRV implementation may present process-memory objects as durable authority.
The graph can open only after every participating domain has an append-only
PostgreSQL adapter with exact semantic-event binding and restart replay.

## Authority Model

The graph is a derived, reproducible index. Source domain records remain the
authority:

```text
Project Registration and Lifecycle
  -> Measurement Evidence
  -> Verification Work and Human Decision
  -> Environmental Proof or Certificate Record
  -> Framework or Institutional Report
```

An edge is admissible only when both endpoints exist durably, the source event
precedes the edge event, the relationship is allowed by this standard, and the
edge hash is reproducible from immutable endpoint roots.

AI and Agents may add advisory analysis edges. They cannot author a final
verification decision, activate a project, issue a certificate, or publish an
institutional report.

## Project Prerequisite

The implemented project authority supplies:

- an immutable registration root;
- a replayed current lifecycle status;
- append-only transition and monitoring roots;
- exact owning organization and human actor roles;
- independent governance approval for activation;
- prior same-project evidence or satellite references for monitoring.

The v1 states `active` and `monitored` are not aliases for `FUNDED`, `VERIFIED`,
or `LONG_TERM_OBSERVATION`. Future MRV lifecycle states must cite the specific
funding, final human verification, and observation-window roots that justify
them.

## Evidence Registration Prerequisite

The implemented evidence-registration authority supplies an immutable evidence
root, the exact project root/status/region and authority time at submission, owning organization,
human contributor role, observation/ingestion times, source commitments,
deterministic structural issues, and singular semantic event. Its initial
`validated` state means structural ingestion only.

Evidence registration, governed methodology, human review, final evidence
decision, monitoring, community context, and Environmental Proof source facts
now provide the first bounded durable endpoint set. The route-closed authority
can append only matrix-approved edges and reviewed historical snapshots. It does
not expose `/canopyproof/mrv/*`, recalculate current challenge reliance, or turn
graph lineage into final proof.

## Graph Record

The implemented `mrv.graph_edge_facts` fact contains at least:

```text
edge_id
project_id
source_type
source_id
source_root
relationship
target_type
target_id
target_root
methodology_id
created_by
created_by_role
created_at
edge_hash
edge_root
audit_event_root
```

Required properties:

- append-only; update and delete are prohibited;
- deterministic ID from canonical edge content;
- one owning project per edge;
- exact semantic event stream, actor, action, time, and payload binding;
- bounded idempotency receipt for mutation;
- no embedded media, precise private location, contact details, credentials, or
  secrets;
- endpoint roots and methodology version remain immutable even if a later
  challenge changes current reliance state.

## Allowed Node Types

- `project_registration`
- `project_status_transition`
- `project_monitoring_event`
- `satellite_observation`
- `drone_observation`
- `iot_observation`
- `mobile_evidence`
- `community_attestation`
- `evidence_object`
- `ai_analysis_advisory`
- `verification_work_item`
- `human_review`
- `verification_decision`
- `environmental_proof_record`
- `certificate_record`
- `framework_report`
- `institutional_report_package`
- `challenge`
- `challenge_resolution`

Node types may be enabled only after their durable source adapter, integrity
checks, and public/private projection rules are implemented. Listing a node type
here is not evidence that its adapter currently exists.

## Allowed Relationships

- `GOVERNS`: organization or policy authority to a project decision.
- `MEASURES`: evidence or observation to a project or monitoring window.
- `CORROBORATES`: independent source supporting another measurement.
- `CONTRADICTS`: source or review disputing another source or claim.
- `ANALYZES`: advisory AI or deterministic quality analysis of evidence.
- `REVIEWS`: accountable human review of evidence or verification work.
- `DECIDES`: final human/governance decision over a bounded subject.
- `SUPPORTS`: accepted evidence or decision supporting a proof record.
- `REPORTS`: proof records and methods included in a report package.
- `CHALLENGES`: a dispute linked to an immutable subject root.
- `RESOLVES`: a human/governance resolution linked to a challenge root.
- `SUPERSEDES`: a new version that preserves the predecessor.

Self-edges, cross-project evidence edges without an explicit governed sharing
agreement, future-dated sources, and cycles through `SUPERSEDES` are prohibited.

## Measurement

Every measurement node must bind:

- project ID and project root at observation time;
- source class and immutable source hash;
- observation timestamp and ingestion timestamp;
- location commitment and disclosed accuracy, with private precision separated
  from public projection;
- device, provider, consent, or custody lineage where applicable;
- methodology version and units;
- quality limitations and uncertainty;
- accountable contributor or provider;
- semantic audit root.

Source-specific minimums:

- satellite: provider, acquisition time, layer type, scene hash, cloud/quality
  metadata, and source license reference;
- drone: flight/mission ID, device attestation, capture envelope, custody chain,
  and operator authorization;
- IoT: sensor identity, calibration version, sampling interval, clock quality,
  and anomaly flags;
- mobile: consent receipt, media hash, metadata commitments, GPS accuracy,
  device risk, and offline synchronization lineage;
- community: contributor identity, bounded attestation, conflict disclosure, and
  corroboration or challenge state.

## Reporting

Every reported metric must include:

- metric name, value, unit, and reporting period;
- source node and root set;
- methodology ID and version;
- computation or aggregation hash;
- uncertainty/confidence representation;
- verification decision reference;
- known limitations;
- challenge and current reliance state;
- report package root and audit event root.

Reports must preserve the exact historical source set. A later correction creates
a successor package or append-only notice; it does not rewrite an issued report.

## Verification

Final verification requires:

- a verified human reviewer with current scoped authority;
- independence and conflict disclosure checks;
- an explicit bounded subject and methodology;
- complete required source roots;
- deterministic quality-gate results;
- advisory AI findings retained but non-authoritative;
- unresolved critical contradictions blocked;
- a signed or hash-bound decision record;
- a semantic audit event and challenge window.

Verification may result in approved, rejected, challenged, or more-evidence-
required state. Only an approved human/governance decision may support a final
certificate or institutional report.

## Challenge Semantics

A challenge never deletes a node or edge. It appends a `CHALLENGES` edge and
causes derived reliance state to reflect the open dispute. A resolution appends a
`RESOLVES` edge. Upheld challenges require correction, supersession, suspension,
or withdrawal through the responsible source domain.

Historical replay must answer both:

- what the graph showed at a specified semantic-event boundary; and
- what the current challenge-aware reliance state is now.

## Future API Boundary

The future API should use authenticated institutional routes for internal graph
access and a separate redacted public projection:

```text
GET  /canopyproof/mrv/status
GET  /canopyproof/mrv/projects/:projectId/graph
POST /canopyproof/mrv/edges
GET  /canopyproof/mrv/edges/:edgeId
POST /canopyproof/mrv/edges/:edgeId/challenges
```

Mutation routes require origin authentication, durable authorization, exact
organization scope, bounded `Idempotency-Key`, and a serializable transaction.
Public routes must not expose participant identities, private contacts, precise
restricted locations, raw media, access credentials, or private data-room links.

## Migration Gate

Implementation order is mandatory:

1. Durable project lifecycle authority.
2. Durable evidence and observation authority with custody and privacy controls.
3. Durable verification decisions with human independence.
4. Durable certificate/proof and reporting authority.
5. Additive graph-edge table, canonical functions, indexes, validators, event
   binding, and append-only controls.
6. Historical backfill only where every endpoint root and original event boundary
   can be proven. Quarantine ambiguous links.
7. Replay, concurrency, tamper, privacy, challenge, and native PostgreSQL tests.
8. Open authenticated graph reads, then a separately reviewed public projection.

Rollback closes graph reads and writes without deleting committed facts. It
cannot fabricate missing endpoint roots, weaken human authority, expose private
data, or replace durable source records with memory state.

## Current Implementation Boundary

As of the route-closed durable-core implementation:

- durable project registration, v1 status transitions, and monitoring authority
  are implemented and covered by PGlite replay/concurrency constraints;
- native PostgreSQL test code includes project command concurrency and reconnect
  assertions but remains unexecuted without the explicit disposable-database
  gate;
- immutable source-root-bound edge facts, human-reviewed graph snapshots,
  contiguous members, semantic events, exact command receipts, forced RLS,
  database audit, append-only triggers, restart replay, and fail-closed rollback
  are implemented in the `mrv` schema and PGlite verified;
- enabled endpoints and relationships are the closed subset documented by
  `docs/RFC_DIGITAL_MRV_GRAPH_AUTHORITY.md`;
- native MRV concurrent-writer execution, challenge/resolution graph edges,
  current-reliance projection, privacy-reviewed routes, and public graph views
  remain incomplete;
- no `/mrv` endpoint is mounted and the durable core is not claimed as a
  production-open MRV service.
