# CanopyProof Trust Kernel Standard

Status: DRAFT - NON-PRODUCTION

Version: 0.1

Date: 2026-07-13

## 1. Purpose

The CanopyProof Trust Kernel is the authority boundary for environmental
accountability. It converts authenticated commands into immutable facts,
deterministic projections, audit events, and bounded public records.

This standard does not authorize deployment or environmental claims. It defines
the conditions an implementation must satisfy before institutional reliance.

## 2. Core Rule

Everything authoritative is an event. No important state transition may occur
only as an in-place update.

One accepted command must atomically produce:

1. the immutable domain fact;
2. the semantic audit event;
3. the idempotency command receipt;
4. any required risk or governance fact; and
5. a deterministic projection root.

Failure to append every required output aborts the entire command.

## 3. Authority Domains

| Domain | Owns | Must not own |
| --- | --- | --- |
| Identity | participant, organization, membership, accreditation and device authority | evidence or proof decisions |
| Project | registration, lifecycle, monitoring plan and ownership | verification outcome |
| Evidence | source envelope, media commitment, custody, consent and metadata lineage | final verification |
| Verification | validation, advisory AI, human reviews, final decisions and corrections | certificate publication |
| Methodology | governed methods, versions, applicability and proof policies | evidence facts |
| MRV | graph linkage, measurement lineage, reporting lineage and verification linkage | source-system mutation |
| Certificate | Environmental Proof Record lifecycle and transparency projection | carbon-credit issuance or financial rights |
| Governance | approvals, conflicts, councils, challenges and resolutions | silent domain mutation |
| Reporting | versioned bounded metrics and exports | unsupported claim creation |
| Funding | sources, allocations, milestones and evidence linkage | custody or movement of mainnet funds by default |
| Risk | advisory signals, alerts and response facts | unilateral final verification |
| Audit | semantic events, mutation streams, checkpoints and export manifests | domain business decisions |

Dropin Identity, AHIN, PoCC, CAI, and memory services are coordination and
provenance dependencies. They do not replace the domain authority above.

## 4. Identity Model

Canonical identity types are:

- `PERSON`
- `ORGANIZATION`
- `AGENT`
- `DEVICE`
- `PROJECT`

Canonical institutional roles are:

- `FIELD_WORKER`
- `NGO`
- `RESEARCHER`
- `AUDITOR`
- `INVESTOR`
- `GOVERNMENT`
- `UN_PARTNER`
- `ADMIN`

Compatibility roles may be mapped only through a documented, deny-by-default
matrix. A signed role claim is not sufficient authority. Every protected
command must bind the signed subject to current participant, organization,
membership, accreditation, suspension, and expiry state.

Agents cannot inherit human authority. Devices cannot become reviewers.
Organizations cannot substitute for their members.

## 5. Command Contract

Every mutating command requires:

- authenticated subject;
- current durable authorization binding;
- organization and tenant scope;
- explicit capability;
- conflict and separation-of-duty checks where applicable;
- idempotency key;
- expected source or prior projection root;
- normalized command hash;
- correlation and trace identifiers;
- policy and methodology versions where applicable; and
- a transaction timestamp supplied by the authority boundary.

The database must reject payloads that attempt to supply derived authority
fields such as sequence, fact hash, event hash, projection root, verification
status, or final decision without the corresponding governed command.

## 6. Fact Envelope

Every immutable authority fact contains, directly or through a typed envelope:

```text
id
subject_id
organization_id
sequence
actor_id
actor_role
action
occurred_at
source_root
command_hash
prior_fact_hash
fact_hash
fact_root
correlation_id
trace_id
schema_version
```

Hash inputs must use one canonical serialization shared by application and
database validation. Timestamps are UTC and immutable. Sequences are monotonic
within the documented subject stream.

## 7. Semantic Events

Critical CanopyProof actions map to the Dropin vocabulary:

| Meaning | AHIN action |
| --- | --- |
| assertion or registration | `ASSERT` |
| analysis or advisory reasoning | `REASON` |
| assignment or governed delegation | `DELEGATE` |
| completed authorized work | `FULFILL` |
| dispute, contradiction or appeal | `CHALLENGE` |

The semantic event is part of the same transaction as the fact it describes.
Asynchronous publication may retry from an outbox, but an unavailable event bus
must never create an unaudited domain write.

## 8. Projection Rules

Current state is a deterministic fold over immutable facts. A projection:

- never rewrites history;
- records the fact set and root used;
- rejects sequence gaps and broken hashes;
- is reproducible after process restart;
- treats suspension, revocation, challenge, expiry and correction as separate
  facts; and
- exposes uncertainty or unavailable state rather than inventing a default.

Materialized projections are caches. They may be rebuilt and cannot become the
sole authority.

## 9. Verification Boundary

The required pipeline is:

```text
evidence -> rules -> advisory AI -> independent human review -> final decision
```

AI, agents, models, embeddings, scores, satellite comparisons, FiftyOne labels,
and review rankings cannot finalize evidence or issue a record. Final authority
requires a currently eligible human and, where policy requires, a second
independent human or governance approval.

## 10. Audit Boundary

Every authoritative transaction must be independently replayable through:

- semantic events;
- command receipts;
- database mutation streams;
- checkpoint roots; and
- hash-only export manifests.

Audit deletion and mutation are prohibited. Public exports must not disclose
credentials, private media URLs, exact restricted locations, or personal data.

## 11. API Boundary

The canonical public namespace is `/canopyproof/*` behind the separated API
Worker. Compatibility aliases under `/api/*` are an edge-routing concern, not a
second authority API.

Every protected endpoint must provide:

- origin authentication;
- durable authorization;
- tenant isolation;
- bounded validation;
- idempotency for mutations;
- rate and abuse controls;
- one transactional audit boundary;
- stable error codes; and
- request, correlation and trace identifiers.

No administrative endpoint may be exposed through the public API proxy.

## 12. Persistence And Migration

PostgreSQL is the transactional authority. Object storage holds immutable media
and large spatial assets referenced by content hash. Search, vector, tile,
FiftyOne, cache, and analytics systems are rebuildable projections.

Production migration requires:

1. versioned forward migration;
2. explicit least-privilege owners and grants;
3. trigger and constraint tests on native PostgreSQL;
4. concurrency and idempotency tests using separate connections;
5. replay parity before and after migration;
6. backup and restore rehearsal;
7. a rollback that preserves appended facts; and
8. an approved data-retention and legal-hold plan.

Destructive rollback is forbidden after authority facts are accepted.

## 13. Safety Boundaries

The Trust Kernel must fail closed against:

- fake verified environmental claims;
- certified carbon-credit issuance;
- carbon-tax-offset claims;
- guaranteed RWA yield;
- automatic CANOPY distribution;
- mainnet fund movement without a separately approved control plane;
- AI self-approval;
- caller-supplied authority state;
- cross-tenant reads or writes; and
- deletion or mutation of authority history.

## 14. Current Implementation Status

Implemented and tested foundations include durable identity, organization,
membership, accreditation, project, evidence registration, evidence
verification, methodology, Environmental Proof record, challenge, audit, and
selected partner-governance facts. PGlite tests exercise these contracts.

The Trust Kernel is not production complete because:

- production SQL is not a reviewed versioned migration set;
- the native PostgreSQL concurrency gate has not been executed in the current
  environment;
- several media, custody, reporting, funding, risk, and partner workflows still
  use compatibility memory services or remain route-gated;
- explicit package ownership boundaries are not implemented;
- object storage, KMS, worker queues, external checkpoints, real providers, and
  institutional operations are not connected; and
- the current dirty tree is not a reproducible release baseline.

## 15. Conformance Gate

Trust Kernel conformance requires all of the following:

- native PostgreSQL migration, concurrency, replay, tamper and restore tests;
- authentication and current durable authorization on every authority route;
- no memory fallback in production mode;
- no silent or partially audited mutation;
- independent human authority for final verification;
- measured test coverage above the approved threshold;
- OpenTelemetry traces and bounded metrics across API, database and workers;
- threat-model and abuse-case sign-off;
- independent security and institutional review; and
- a separate, manually approved production release.
