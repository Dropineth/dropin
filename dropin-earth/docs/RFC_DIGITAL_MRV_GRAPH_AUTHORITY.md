# RFC: CanopyProof Digital MRV Graph Authority

Status: IMPLEMENTED ROUTE-CLOSED - PGLITE VERIFIED; NATIVE GATE PENDING

Date: 2026-07-14

Owners: Trust Kernel, Evidence, Verification, Environmental Proof, Data Governance

## 1. Problem Statement

CanopyProof now has durable project, evidence-registration, evidence-custody,
verification, challenge, monitoring, Environmental Proof, and selected Earth-
observation authorities. Their roots are individually replayable, but there is
no durable cross-domain record answering which exact source facts supported a
measurement, review, decision, or proof at a particular point in time.

The existing `docs/MRV_STANDARD.md` defines the intended graph vocabulary. It
does not provide a PostgreSQL authority, transaction contract, reviewed graph
snapshot, restart replay, or safe certificate input. Process-memory objects and
ad hoc API joins cannot fill that gap: they lose lineage after restart and can
silently bind current records to historical decisions.

This RFC defines a first route-closed Digital MRV graph slice with two facts:

1. immutable, endpoint-root-bound graph edges; and
2. immutable, human-reviewed project graph snapshots containing an exact edge
   set and Merkle root.

The graph is a reproducible lineage index. Source domains remain authoritative.
Neither an edge nor a snapshot verifies environmental truth, issues an
Environmental Proof Record, creates a certificate, releases funds, or makes a
public impact claim.

## 2. Decision And Scope

Implement a separate `mrv` PostgreSQL schema and pure TypeScript authority with
no mounted HTTP route. The first slice accepts only endpoint types whose source
facts already have durable roots and semantic events.

### 2.1 Enabled Endpoint Types

- `project_registration`
- `project_monitoring_event`
- `evidence_object`
- `evidence_validation`
- `ai_analysis_advisory`
- `human_review`
- `verification_decision`
- `community_attestation`
- `environmental_proof_record`

An endpoint type is not enabled merely because it appears in documentation.
The PostgreSQL resolver must know its owning table, ID, root, organization,
project, event time, and current reliance projection.

### 2.2 Enabled Relationships

- `MEASURES`
- `CORROBORATES`
- `CONTRADICTS`
- `ANALYZES`
- `REVIEWS`
- `DECIDES`
- `SUPPORTS`

The relationship matrix is closed by default. Unknown node or relationship
combinations are rejected in TypeScript and PostgreSQL. `SUPERSEDES`, cross-
project sharing, report publication, certificate linkage, funding, drone, IoT,
and unrestricted satellite edges remain outside this slice.

Challenge/resolution endpoints and relationships are deliberately deferred
until a current-reliance projection can prove terminal challenge state without
rewriting historical edges.

### 2.3 Explicit Non-Goals

- no graph database dependency;
- no mutable property graph;
- no generic caller-defined endpoint table or SQL identifier;
- no public `/mrv` API;
- no raw media, coordinates, EXIF, notes, contacts, credentials, or secrets;
- no AI-authored reviewed snapshot;
- no certificate, carbon-credit, tax-offset, asset, token, fund, or yield
  authority;
- no historical backfill without independently provable endpoint roots and
  event times.

## 3. Trust Model

### 3.1 Source Authority

Each edge binds two immutable source facts by:

- endpoint type;
- endpoint ID;
- endpoint root;
- owning organization;
- owning project;
- source semantic-event root; and
- source event time.

The graph never copies an endpoint's raw payload. PostgreSQL resolves both
endpoints through a fixed allowlist and rejects missing, cross-tenant,
cross-project, stale-root, future-event, or unsupported endpoint authority.

### 3.2 Edge Authority

An edge is an append-only assertion by a currently authorized human or advisory
agent. Human-only relationships are `REVIEWS` and `DECIDES`. Agents may add
`ANALYZES` edges only when the source is a durable
advisory AI fact produced by that same registered agent. Agents cannot create a
snapshot or change source reliance state.

Each edge commits one semantic event, one edge fact, and one hashed idempotency
receipt in a Serializable transaction.

### 3.3 Snapshot Authority

A project graph snapshot binds:

- one organization and project;
- the current project root;
- one published methodology ID, version, and publication root;
- a sorted, duplicate-free list of exact edge roots;
- an edge-set Merkle root;
- the latest source event time represented;
- explicit limitation and conflict-disclosure hashes;
- an accredited, verified human reviewer snapshot;
- a predecessor snapshot root and monotonically increasing sequence;
- a semantic event and command receipt.

The reviewer must have active same-organization membership and approved
`mrv_graph_review` accreditation. The reviewer cannot be an agent or the actor
who authored any included edge. A snapshot is `reviewed_for_lineage` or
`review_required`; it is never `verified`, `certified`, or `approved_for_funds`.

### 3.4 Current Reliance

Historical edge and snapshot facts never change. This slice records the source
state observed when each edge was appended and marks stale, challenged, revoked,
or contradictory inputs `review_required`. A future current-reliance projection
must re-resolve challenge and supersession state without rewriting the
historical graph; it is not implemented or exposed by this slice.

## 4. Data Flow

```text
Durable project/evidence/verification/proof source facts
  -> fixed endpoint resolver
  -> relationship-matrix validation
  -> actor and tenant authority validation
  -> canonical edge hash/root
  -> semantic event + edge fact + command receipt (atomic)
  -> exact retry or changed-request conflict

Project edge set
  -> endpoint/current-root replay
  -> methodology and reviewer authority checks
  -> sorted edge-root manifest
  -> Merkle graph root
  -> semantic event + snapshot + snapshot members + receipt (atomic)
  -> non-final current-reliance projection
  -> future certificate authority input only after its own RFC and gates
```

The server chooses no source fact on behalf of a caller. A command submits exact
IDs and roots. The repository re-resolves every source inside the write
transaction before accepting it.

## 5. Canonical Domain Contract

### 5.1 Graph Edge Fact

```text
factType: mrv_graph_edge
id
organizationId
projectId
source: { type, id, root, eventRoot, occurredAt }
relationship
target: { type, id, root, eventRoot, occurredAt }
methodologyId
methodologyVersion
methodologyPublicationRoot
actorSnapshot
actorMode: human | advisory_agent
reasonHash
limitations[]
commandHash
projectSequence
previousEventRoot
edgeHash
edgeRoot
safety
auditEvent
```

Canonical ID is derived from the command hash. One exact directed edge may
exist once per methodology publication. Reverse direction is a different edge
and must independently satisfy the relationship matrix. Self-edges are denied.

### 5.2 Reviewed Snapshot Fact

```text
factType: mrv_graph_snapshot
id
organizationId
projectId
projectRoot
methodologyId
methodologyVersion
methodologyPublicationRoot
edgeIds[]
edgeRoots[]
edgeSetRoot
edgeCount
coverage: { requiredRelationshipCounts, observedRelationshipCounts }
state: reviewed_for_lineage | review_required
issueCodes[]
reviewerSnapshot
conflictDisclosureHash
limitations[]
snapshotSequence
previousSnapshotRoot
commandHash
projectSequence
previousEventRoot
snapshotHash
snapshotRoot
safety
auditEvent
```

Snapshot members are stored in a separate append-only relation with contiguous
indexes. A deferred constraint trigger validates member completeness and the
ordered Merkle root at commit.

## 6. Relationship Matrix

The initial matrix is:

| Source | Relationship | Target |
| --- | --- | --- |
| `evidence_object` | `MEASURES` | `project_registration` |
| `project_monitoring_event` | `MEASURES` | `project_registration` |
| `community_attestation` | `CORROBORATES` | `evidence_object` |
| `community_attestation` | `CONTRADICTS` | `evidence_object` |
| `evidence_validation` | `ANALYZES` | `evidence_object` |
| `ai_analysis_advisory` | `ANALYZES` | `evidence_object` |
| `human_review` | `REVIEWS` | `evidence_object` |
| `verification_decision` | `DECIDES` | `evidence_object` |
| `evidence_object` | `SUPPORTS` | `environmental_proof_record` |
| `verification_decision` | `SUPPORTS` | `environmental_proof_record` |
| `project_monitoring_event` | `SUPPORTS` | `environmental_proof_record` |
`CORROBORATES` is allowed only for a community `support` statement;
`CONTRADICTS` only for `challenge` or `needs_review`. An advisory AI fact cannot
be the source of `SUPPORTS`, `DECIDES`, or `REVIEWS`.

## 7. Database Changes

Create an additive migration with:

### `mrv.graph_edge_facts`

- immutable canonical JSON fact;
- denormalized organization/project/source/target/relationship columns;
- unique edge ID and edge root;
- unique canonical endpoint/relationship/methodology tuple;
- exact semantic-event root;
- forced row-level security on organization scope;
- validation, mutation-audit, and append-only triggers.

### `mrv.graph_snapshot_facts`

- immutable reviewed snapshot fact;
- unique snapshot ID/root and project sequence;
- project/methodology/reviewer bindings;
- edge count/set root and predecessor root;
- exact semantic-event root;
- forced RLS and append-only/audit/validation triggers.

### `mrv.graph_snapshot_member_facts`

- snapshot ID and contiguous edge index;
- exact edge ID/root;
- immutable canonical member JSON;
- foreign keys to snapshot and edge facts;
- forced RLS and append-only/audit/validation triggers.

### Canonical Functions

- safety boundary;
- forbidden recursive JSON-key detector;
- fixed endpoint resolver;
- relationship-matrix validator;
- edge command/hash/root functions;
- snapshot command/hash/root functions;
- ordered edge-set root function;
- reviewed historical graph projection. Current-reliance projection is deferred.

No generic dynamic SQL accepts caller-controlled table or column names.

## 8. Transaction And Idempotency Contract

Every command:

1. parses strict bounded input;
2. hashes the idempotency key;
3. sets tenant and actor transaction context;
4. obtains a command advisory lock;
5. obtains the project MRV stream lock;
6. resolves source scope before reading a receipt;
7. returns a prior result only when request, result, response, and event hashes
   match exactly;
8. replays the existing edge/snapshot stream;
9. validates actor, endpoints, relationship, chronology, methodology, and prior
   roots;
10. inserts one semantic event;
11. inserts the immutable fact or complete snapshot bundle;
12. inserts one command receipt; and
13. commits atomically.

Serializable conflicts retry a small bounded number of times. Exhaustion fails
closed. No fallback writes to process memory.

## 9. Threat Model

### Endpoint Substitution

Attack: submit a valid ID with another root, project, organization, or source
event.

Control: fixed PostgreSQL resolver and TypeScript replay compare every binding.

### Graph Poisoning

Attack: create semantically invalid or AI-authoritative edges.

Control: closed relationship matrix, actor-mode rules, accreditation checks,
and no caller-defined relationship or endpoint type.

### Incomplete Snapshot

Attack: declare a count/root that omits members or inserts members after the
snapshot.

Control: same-transaction inserts and deferred completeness/Merkle validation.

### Cross-Tenant Or Cross-Project Linkage

Attack: connect facts from separate institutions or projects.

Control: source resolver equality checks, forced RLS, and no v1 sharing edge.

### Replay And Idempotency Confusion

Attack: reuse an idempotency key with altered roots or edge members.

Control: canonical request hash and exact receipt comparison under command lock.

### Cycle And Self-Authority

Attack: self-edge, challenge-resolution cycle, or graph path used as its own
authority.

Control: self-edge denial, relationship direction rules, and source domains
remaining authoritative. Challenge/resolution graph edges remain disabled until
cycle and terminal-state rules are implemented.

### Historical Rebinding

Attack: silently replace a stale endpoint with its current root.

Control: edge roots are immutable; current reliance is a separate projection.

### Privacy Exfiltration

Attack: place location, contact, note, media, credential, or data-room content
inside graph facts.

Control: strict schemas, hash-only rationale/limitations, recursive forbidden-
key database validation, and no raw source payload copying.

### Denial Of Service

Attack: oversized graphs, arrays, reason text, or expensive arbitrary traversal.

Control: bounded command sizes, at most 512 edges per first-slice snapshot,
indexed fixed-depth queries, request limits, and no generic graph query language.

## 10. API Design

No route is mounted in this slice. The future reviewed internal contract is:

```text
POST /canopyproof/mrv/edges
GET  /canopyproof/mrv/edges/:edgeId
POST /canopyproof/mrv/projects/:projectId/snapshots
GET  /canopyproof/mrv/projects/:projectId/snapshots/:snapshotId
GET  /canopyproof/mrv/projects/:projectId/current-reliance
```

Writes require verified origin identity, durable same-organization authority,
role/accreditation checks, `Idempotency-Key`, rate limits, and explicit route
allowlisting. Public graph projection is a later privacy RFC and separate route.

## 11. Migration Strategy

1. Land this RFC and keep all MRV routes closed.
2. Apply additive tables/functions/triggers to disposable PGlite and native
   PostgreSQL environments.
3. Enable only endpoint resolvers with durable source authority.
4. Create new edges through explicit commands. Do not import process-memory
   graph objects as institutional facts.
5. Backfill only records whose endpoint ID/root/event/project/time can be proven;
   quarantine every ambiguity.
6. Execute replay, parity, RLS, concurrent retry, partial-write, mutation,
   privacy, cycle, and restart tests.
7. Complete independent MRV methodology, privacy, security, and institutional
   operations review.
8. Open internal reads first. Writes and public projection require separate
   approval evidence.

## 12. Rollback Strategy

- keep route flags closed or remove the explicit route allowlist;
- stop graph writers and snapshot jobs;
- preserve committed edge/snapshot facts, semantic events, receipts, and audit;
- refuse destructive rollback when any MRV fact exists;
- the supplied rollback refuses to drop a non-empty authority; use a forward
  compensating migration for schema defects;
- never fall back to process-memory authority;
- leave source project, evidence, verification, proof, and challenge services
  independently available.

## 13. Verification Plan

### Unit

- relationship matrix and actor-mode enforcement;
- deterministic edge and snapshot roots;
- endpoint/project/time mismatch denial;
- sorted member manifest and duplicate denial;
- AI cannot review, decide, support, or snapshot;
- stale/challenged source projection is non-final;
- unsafe claims and raw/private keys rejected;
- snapshot replay and tamper detection.

### PostgreSQL / PGlite

- migration idempotency;
- TypeScript/SQL command, edge, snapshot, and Merkle parity;
- exact and conflicting retry;
- endpoint resolver substitution rejection;
- cross-tenant and cross-project denial;
- semantic-event and actor binding;
- deferred snapshot completeness rollback;
- append-only mutation denial and database audit;
- restart and historical receipt replay;
- non-empty rollback refusal.

### Native PostgreSQL

- two independent connections commit one exact edge;
- same project/different commands serialize without stream fork;
- competing snapshots cannot reuse a sequence or predecessor;
- failed endpoint/member insert leaves no event, fact, or receipt;
- disconnect/reconnect produces the same graph and projection.

## 14. Safety Boundary

Every MRV fact states and enforces:

- graph lineage only;
- source domains remain authoritative;
- human review is required for a snapshot;
- AI is advisory only;
- no certified carbon-credit authority;
- no carbon-tax offset authority;
- no financial asset or guaranteed yield;
- no mainnet funds;
- no automatic CANOPY distribution;
- no raw evidence, precise location, contact data, credentials, or secrets;
- no production route until all named gates pass.

## 15. Implementation Evidence And Remaining Gates

Implemented artifacts:

- `services/api/src/domain/canopyproof/mrv-graph-authority.ts`;
- `services/api/src/domain/canopyproof/mrv-graph-postgres.ts`;
- `services/api/prisma/mrv-graph.sql` and fail-closed rollback;
- `tests/unit/canopyproof-mrv-graph-authority.test.ts`;
- `tests/integration/canopyproof-mrv-graph-pglite.integration.ts`.

The PGlite gate proves migration idempotency, TypeScript/SQL root parity, exact
and conflicting retries, durable restart replay, source-root substitution
rollback, semantic-event atomicity, immutable rows, forced RLS metadata, and
non-empty rollback refusal. The native harness applies the migration, but no
native MRV dual-connection runtime result is claimed in this environment.

Before any route opens, execute native concurrent writers, role/grant RLS,
backup/restore and failover tests; implement challenge/current-reliance
projection; complete privacy, scientific, security, and institutional review;
and add explicit route authorization and rate-limit evidence.
