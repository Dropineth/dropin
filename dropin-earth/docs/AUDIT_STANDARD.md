# CanopyProof Audit Standard

Status: DRAFT - NON-PRODUCTION

Version: 0.1

Date: 2026-07-13

## 1. Purpose

CanopyProof audit records must let an independent party answer:

- who attempted and authorized an action;
- what immutable facts were accepted;
- which policy and evidence roots were used;
- whether any required event is missing or altered;
- how current state was derived; and
- what can safely be disclosed without exposing protected data.

Application logs are operational telemetry. They are not the audit authority.

## 2. Audit Layers

The audit system has five complementary layers:

1. **Domain facts**: immutable business facts owned by each authority domain.
2. **Semantic events**: human-readable event meaning using bounded actions such
   as `ASSERT`, `REASON`, `DELEGATE`, `FULFILL`, and `CHALLENGE`.
3. **Command receipts**: idempotency and normalized command-hash evidence.
4. **Database mutation streams**: independent table-level insert/update/delete
   evidence with monotonic sequence and hash chaining.
5. **Checkpoints and export manifests**: independently verifiable roots over a
   bounded stream or disclosure package.

No layer may be used to silently replace another.

## 3. Semantic Audit Event

Every event contains:

```text
id
stream_id
sequence
actor_id
actor_type
actor_role
organization_id
action
target_type
target_id
occurred_at
source_root
payload_hash
prior_event_hash
event_hash
correlation_id
trace_id
schema_version
```

The event payload contains bounded identifiers, status transitions, policy and
methodology references, and integrity roots. It must not contain secrets,
credentials, raw private media, private keys, exact restricted coordinates, or
unbounded personal data.

## 4. Hashing

Hashing uses a versioned canonical serialization and a cryptographic digest
approved by the security policy. Current SHA-256 commitments are lowercase
hexadecimal strings of exactly 64 characters.

The hash seed includes:

- event kind and schema version;
- stream and sequence;
- actor and organization binding;
- action and target;
- immutable UTC timestamp;
- source and payload roots; and
- prior event hash.

Application and database implementations must pass fixed parity vectors.
Changing canonicalization requires a new schema version and migration plan.

## 5. Transaction Rule

An authoritative command succeeds only when its domain fact, semantic event,
command receipt, required risk/governance facts and database mutation evidence
commit together.

Telemetry publication and external checkpoint export may be asynchronous, but
must retry from durable outbox state. A network outage must not create an
unaudited write.

## 6. Append-Only Enforcement

Authority facts, semantic events, command receipts, challenge facts, final
decisions, transparency entries and checkpoint records reject update and
delete at database level.

Corrections are new facts referencing the original. Privacy minimization uses
cryptographic tombstones, access restriction, key destruction or separately
governed redaction facts where legally permitted; it does not rewrite history.

## 7. Replay

A replay verifier must:

1. validate schema and bounded values;
2. sort by stream and sequence;
3. reject gaps, duplicates and non-monotonic sequence;
4. recompute command, fact, payload and event hashes;
5. verify prior-hash continuity;
6. verify referenced source roots exist and are allowed;
7. fold the deterministic projection; and
8. compare the recomputed projection root to the published root.

Replay never calls external AI, mutable provider APIs or wall-clock defaults.

## 8. Database Mutation Stream

The database independently records mutations with:

- schema and table;
- operation;
- transaction identifier;
- monotonic table or subject sequence;
- actor and request context set by a trusted transaction boundary;
- hash-only before and after state;
- prior entry hash; and
- entry hash.

Missing trusted context rejects authority writes. Database owners, application
roles, migration roles and audit-reader roles must be separate and
least-privileged.

## 9. Checkpoints

Checkpoints bind a closed stream range:

```text
checkpoint_id
stream_scope
first_sequence
last_sequence
entry_count
root
created_at
signer_key_id
signature
prior_checkpoint_root
```

Production checkpoints must be copied to independently controlled immutable
storage. External anchoring records integrity only and never grants
environmental, financial or governance authority.

## 10. Export Manifests

Audit exports are purpose-bound and hash-only by default. A manifest records:

- requesting and approving organizations;
- lawful/contractual purpose;
- classification;
- subject and time scope;
- included record identifiers and roots;
- excluded or redacted categories;
- policy and agreement versions;
- expiry and permitted use;
- manifest root; and
- approval and delivery receipts.

Exports must fail closed when rights, purpose, tenant authority, consent,
classification or agreement state is unavailable.

## 11. Access And Privacy

Audit access is itself audited. Readers receive the least detail required for
their approved purpose.

Public transparency views expose bounded project, proof, organization, status,
timeline and root references. They do not expose personal identity, device
fingerprints, private reviewer notes, exact restricted locations, private media
URLs or security telemetry.

## 12. Availability And Recovery

The audit authority requires:

- encrypted primary and backup storage;
- tested point-in-time recovery;
- immutable checkpoint replication;
- documented RPO and RTO;
- reconciliation of domain, semantic and mutation streams;
- alerting on sequence gaps, hash mismatch and event lag;
- key rotation and revocation; and
- incident procedures that preserve evidence.

Recovery is complete only when replay reproduces the pre-failure projection
roots.

## 13. Metrics

Required metrics include:

- audit events and command receipts written;
- transaction aborts due to audit failure;
- replay duration and result;
- hash, sequence and reference failures;
- checkpoint age and export lag;
- outbox backlog and retry age;
- unauthorized audit reads;
- disclosure denials; and
- cross-stream reconciliation mismatch.

Metric labels are bounded and contain no personal or sensitive record IDs.

## 14. Required Tests

Conformance tests must cover:

- update and delete rejection;
- sequence gap, duplicate and reorder detection;
- fact, payload, actor, timestamp and prior-hash tampering;
- command idempotency under concurrency;
- rollback on missing semantic event;
- deterministic replay after restart;
- checkpoint and export manifest verification;
- cross-tenant and unauthorized audit denial;
- secret and personal-data exclusion;
- backup/restore replay parity; and
- database partial-write and event-bus outage behavior.

Native PostgreSQL tests are mandatory for transaction, lock, trigger, grant and
concurrency claims. In-memory and PGlite tests are supporting evidence only.

## 15. Current Boundary

The repository contains semantic events, command receipts, mutation streams,
checkpoints, replay helpers and hash-only export manifests with substantial
unit/PGlite coverage. It does not yet have production least-privilege grants,
independently controlled checkpoint storage, executed native concurrency and
restore evidence, or end-to-end audit observability. This standard is therefore
not production-conformant.
