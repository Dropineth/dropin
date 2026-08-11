# RFC: Global Command Center Publishing Authority

Status: Route-closed publishing core implemented and locally verified; durable
source/spatial resolver composition, HTTP writer, scheduler, and production
activation remain closed

Date: 2026-07-18

Owners: CanopyProof Trust Kernel, Impact, Data Governance, Security, and
Platform Operations

Decision class: Global institutional read-model publication authority

## 1. Problem Statement

At RFC adoption, the Global Impact Command Center had a strict, append-only
PostgreSQL read model and deterministic root replay but no governed writer.
Tests and operators could insert a structurally valid snapshot directly, while
no application authority proved all of the following:

- the snapshot was recomputed from current durable source authorities;
- an accountable publisher held the exact publishing scope;
- an independent human approved the exact snapshot and source authority root;
- retries were exact rather than similar;
- concurrent publishers observed one canonical predecessor;
- one semantic audit event and one command receipt bind the mutation; and
- generalized spatial data was already approved by the separate privacy and
  safeguarding authority represented by its committed review roots.

Without that boundary, a self-consistent hash can prove internal consistency
but not authority. This RFC introduces a route-closed publishing authority. It
does not make dashboard summaries certificates, credits, offsets, financial
assets, ownership records, emergency declarations, or funding instructions.

## 2. Decision

Create a deterministic publication fact and a PostgreSQL commit repository.
The application will accept a candidate only when:

1. the snapshot passes the complete Global Command Center schema and root
   replay;
2. a current source resolver, invoked inside the commit transaction, returns
   byte-equivalent canonical snapshot content and the same source authority
   root;
3. the publisher is a verified participant with active organization
   membership, approved accreditation, and
   `global_command_center:publish` scope;
4. a distinct verified human governor with active membership, approved
   accreditation, and `global_command_center:govern` scope approved the exact
   dashboard root, source authority root, policy root, and validity interval;
5. publication time falls inside the approval interval and no more than the
   governed freshness limit after snapshot generation;
6. the command is serialized against the global publication stream and its
   idempotency key; and
7. the semantic audit event, snapshot row, publication fact, and command
   receipt commit atomically.

The writer is a library boundary only. No HTTP route, queue consumer,
scheduler, or production feature flag is enabled by this RFC.

## 3. Trust Model

```text
Durable source authorities + approved spatial disclosure roots
                              |
                              v
Transaction-owned current-source resolver
                              |
                              v
Deterministic candidate snapshot + sourceAuthorityRoot
                              |
              independent human governance approval
                              |
                              v
Serializable publishing repository
  advisory locks + exact idempotency + semantic audit event
                              |
                              v
Append-only snapshot + append-only publication fact + command receipt
                              |
                              v
Existing repeatable-read verifier and authenticated dashboard
```

Hash integrity is necessary but not sufficient. Authority is established by
current source re-resolution, durable actor credentials, independent human
approval, database serialization, and append-only audit linkage.

AI and agents may aggregate source facts or operate the scheduled publisher,
but they cannot create the governance approval. The governor must be human.

## 4. Data Model

### 4.1 Source authority

`sourceAuthorityRoot` commits the exact source boundary used to build the
snapshot:

- `generatedAt`;
- all lineage roots except the derived dashboard root;
- all sorted regional source roots;
- all generalized spatial disclosure roots; and
- the projection schema identifier.

It contains no raw evidence, personal data, device identifiers, exact
coordinates, provider credentials, or signatures.

### 4.2 Governance approval

The approval commits:

- approval ID;
- dashboard root;
- source authority root;
- publishing policy root;
- maximum snapshot age;
- validity interval;
- human governor authority snapshot; and
- deterministic approval root.

Approval is not reusable for a different snapshot, source set, policy, or time
window. Publisher and governor IDs must differ.

### 4.3 Publication fact

The immutable publication fact commits:

- fact ID and snapshot row ID;
- dashboard and source authority roots;
- policy and approval roots;
- publisher authority snapshot;
- publication timestamp;
- global stream sequence and predecessor root;
- deterministic publication root;
- the fixed non-claim safety boundary; and
- one semantic audit event root.

The fact is stored separately from the projection payload so the read model
remains bounded while institutional provenance remains replayable.

## 5. Command Flow

1. Parse and normalize the candidate snapshot, publisher, approval, and
   idempotency key.
2. Recompute source, approval, publication, and audit roots.
3. Begin a `SERIALIZABLE` transaction.
4. Set exact transaction actor context.
5. Acquire an idempotency advisory lock and the global publication-stream lock.
6. Read an existing command receipt. Return only for an exact request match;
   otherwise reject with an idempotency conflict.
7. Invoke the current-source resolver within the same transaction.
8. Compare canonical candidate content and source authority root exactly.
9. Replay all existing publication facts and semantic events, then verify the
   proposed sequence and predecessor.
10. Insert the semantic event, snapshot row, publication fact, and receipt.
11. Read back and replay the stored result before returning.

Serialization failures, deadlocks, and unique races may be retried up to three
times. A retry always re-resolves current sources and never reuses transaction
state.

## 6. Spatial Disclosure Boundary

This authority does not mint spatial approvals. The existing snapshot builder
accepts only generalized regional disclosures that bind current regional
source roots, cohort size, validity, and distinct non-zero privacy and
safeguarding review roots.

The transaction-owned source resolver must resolve those review roots from the
separate spatial disclosure authority before returning a candidate snapshot.
If a review is missing, expired, withdrawn, mismatched, or not independent, the
resolver must omit the disclosure and build a withheld projection, or fail the
candidate when governed input was explicitly requested. The publishing
repository never accepts raw coordinates and never silently manufactures a
disclosure.

## 7. Threat Model

| Threat | Control |
| --- | --- |
| A valid hash is built from stale or invented data | Current source authority is re-resolved inside the commit transaction and compared exactly |
| Agent self-approves a public snapshot | Governor must be a distinct accredited human with exact governance scope |
| A valid approval is replayed for another snapshot | Approval root binds dashboard, source, policy, freshness, and validity fields |
| Concurrent writers create divergent predecessors | Global stream advisory lock, serializable transaction, and database event-chain trigger |
| Same idempotency key carries altered content | Receipt binds actor, operation, key hash, request hash, result ID, response root, and audit root |
| Snapshot is inserted without semantic provenance | Deferred database constraint requires a matching publication fact for every new snapshot |
| Publication fact is edited or removed | Update and delete denial triggers plus row-mutation audit |
| Raw coordinates leak into the public projection | Strict snapshot schema permits only withheld or one-degree generalized spatial objects |
| Legacy rows are mistaken for governed publications | Governed reader selects only snapshots with a linked publication fact after activation |
| Projection implies a regulated or financial claim | Fixed safety object is root-bound and database constrained |
| Writer outage causes fallback to demo data | Production reader remains fail-closed with no process-local fallback |

## 8. Database Changes

Add `impact.global_command_center_publication_facts` with:

- primary and unique root constraints;
- foreign keys to snapshot, publisher, semantic event, and no mutable source
  record;
- strict JSON shape and root-binding checks;
- append-only update/delete triggers; and
- row-mutation audit capture.

Add a deferred constraint trigger on new snapshot inserts. At transaction end,
the trigger requires exactly one publication fact whose snapshot ID and
dashboard root match the inserted row. Historical rows are not rewritten.

No organization RLS is added to the global projection. The eventual publisher
uses a dedicated least-privilege database role. General API identities retain
read-only access to the governed projection and no cross-tenant source-table
authority.

## 9. Migration Strategy

1. Ship the domain authority, repository, additive SQL, and tests with no
   route or scheduler.
2. Apply the additive table, indexes, triggers, and deferred provenance check.
3. Verify existing rows remain readable only under the legacy pre-activation
   policy and cannot be mutated.
4. Provision a dedicated publisher identity and least-privilege database role.
5. Implement durable source and spatial-review resolvers in a separate reviewed
   change.
6. Run shadow publication and independently replay every root.
7. Activate governed-read filtering before activating the writer.
8. Activate a scheduler only after security, privacy, governance, freshness,
   and incident-response review.

Static UI data and process-local compatibility services are never backfilled
as governed snapshots.

## 10. Rollback Strategy

Rollback is fail-closed and non-destructive:

1. disable the publisher identity and scheduler;
2. revoke the database role and close writer activation;
3. return `CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE` if no current
   governed snapshot remains;
4. preserve publication facts, snapshots, receipts, and both semantic and row
   audit chains;
5. investigate by replaying source, approval, publication, and event roots;
6. append a corrected snapshot only after a new independent approval; and
7. never update, delete, or reinterpret an existing publication.

The rollback migration may remove code paths and unactivated schema objects
only when no publication fact exists. It must abort when durable facts are
present.

## 11. Verification Plan

Unit tests must prove:

- deterministic source, approval, publication, and audit roots;
- an agent cannot govern its own publication;
- missing scope, inactive membership, unapproved accreditation, reused actor,
  stale snapshot, expired approval, malformed snapshot, and root tampering are
  rejected;
- exact idempotent replay succeeds and altered replay fails;
- a changed source resolver result fails closed; and
- no raw coordinates or unsafe claims enter publication facts.

PostgreSQL integration tests must prove:

- one atomic governed publication survives repository reconstruction;
- a snapshot without a matching publication fact cannot commit;
- update and delete fail for both snapshot and publication fact;
- one semantic event and row-mutation records exist;
- concurrent predecessor conflicts cannot both commit; and
- current-source re-resolution occurs for every retry.

Activation additionally requires native PostgreSQL, OpenNext, Cloudflare
Worker, observability, load, backup/restore, and incident rollback evidence.

## 12. Safety Boundary

This projection remains read-only operational context. It does not issue or
represent certified carbon credits, carbon-tax offsets, financial assets,
ownership, title, guaranteed yield, mainnet fund movement, or automatic CANOPY
distribution. It does not authorize certificate issuance or protocol unlock.
