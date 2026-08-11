# RFC: Canonical Funding Accountability Authority

Status: Proposed for route-closed implementation

Decision owners: CanopyProof Funding Accountability, Trust Kernel, Governance,
Security, and Institutional Partnerships

Last updated: 2026-07-19

## 1. Problem Statement

CanopyProof currently exposes a compatibility funding service that models
sources, allocations, milestones, evidence links, and ledger totals in process
memory. Its hashes and claim boundaries are useful domain prototypes, but they
do not establish a production authority:

- state disappears on restart and can diverge between API instances;
- a caller can cite an evidence, project, policy, or proof-record root without
  re-resolving its current durable authority;
- milestone settlement is not independently reviewed by an accredited human;
- retries are not bound to an exact command receipt;
- tenant isolation, append-only database enforcement, and immutable challenge
  history are absent;
- public totals do not distinguish an active, challenged, withdrawn, or
  expired disclosure package; and
- the mounted compatibility routes could be mistaken for reliance-authorized
  institutional records.

This RFC creates a canonical funding-accountability authority. It records
transparency facts only. It does not initiate, authorize, custody, settle, or
route money; it does not distribute CANOPY; and it does not create a carbon
credit, tax offset, financial asset, ownership interest, or guaranteed yield.

## 2. Decision

The canonical unit is one immutable, project-scoped funding accountability
candidate containing:

- a governed funding instrument commitment;
- one project allocation;
- a bounded set of milestone summaries;
- exact evidence and Environmental Proof Record authority roots;
- exact integer-cent totals and deterministic aggregate roots;
- current project, funding-source, and policy authority roots; and
- a canonical reporting and validity interval.

Publication uses three independent human roles:

1. an accredited human preparer builds the exact candidate;
2. a different accredited human reconciliation reviewer approves or rejects
   that candidate; and
3. a third accredited human publisher appends the public accountability fact.

An independent accredited human governor may append a `challenge` or
`withdraw` control over the latest publication. A challenged or withdrawn
latest publication never falls back to an older package. Expiry is projected
from `validUntil` and does not mutate historical facts.

The implementation is a domain and PostgreSQL library boundary only. It does
not mount an HTTP route, scheduler, queue consumer, payment adapter, wallet, or
production feature flag. Existing compatibility routes remain explicitly
non-canonical until a separately reviewed migration.

## 3. Trust Model

### 3.1 Roles and scopes

| Action | Required role | Scope |
| --- | --- | --- |
| Prepare candidate | verified accredited human, active membership, owner/admin/researcher | `funding:accountability_prepare` |
| Reconciliation review | different verified accredited human, active membership, verifier/admin | `funding:accountability_review` |
| Publish | third verified accredited human, active membership, owner/admin | `funding:accountability_publish` |
| Challenge or withdraw | verified accredited human distinct from publisher, verifier/admin/owner | `funding:accountability_control` |

All command actors belong to the same verified authority organization. Stored
actor snapshots prove what a command observed; the PostgreSQL repository must
re-resolve current participant, organization, membership, accreditation, and
scope inside every serializable transaction.

AI and agents may recommend classifications or identify anomalies. They cannot
prepare the canonical package, approve reconciliation, publish it, or remove a
challenge.

### 3.2 Source authority

The repository receives a transaction-owned resolver that returns:

- current project root and organization ownership;
- current funding-instrument root and policy root;
- exact evidence roots for every milestone member;
- exact Environmental Proof Record roots and current lifecycle states;
- preparer, reviewer, publisher, or governor actor authority snapshots; and
- unresolved project, evidence, proof, or funding challenges.

Publication fails closed when any root changed, a referenced record is stale,
challenged, revoked, expired, cross-tenant, or missing, or the source resolver
returns a non-canonical member set.

## 4. Data Model

### 4.1 Candidate

The candidate contains:

- `schemaVersion`, `organizationId`, and `projectId`;
- `projectAuthorityRoot`;
- a funding instrument with a pseudonymous source ID, source type,
  jurisdiction code, restriction, commitment cents, document root, and current
  funding-source authority root;
- one allocation ID, purpose code, amount cents, and allocation timestamp;
- one to 128 milestones, uniquely sorted by milestone ID;
- each milestone's amount, due time, status, evidence member roots, proof-record
  member roots, and deterministic milestone root;
- exact committed, allocated, reconciled, and challenged totals;
- reporting period, policy ID/root, validity interval, preparation timestamp,
  preparer authority snapshot, and candidate root.

Amounts are non-negative safe integers in cents. Floating-point or binary
currency values are forbidden. Allocation cannot exceed commitment. Milestone
amounts cannot exceed allocation. A reconciled milestone requires at least one
evidence root and one current Environmental Proof Record root. Duplicate member
roots and duplicate milestone IDs are rejected.

The candidate must not contain bank details, wallet addresses, payment tokens,
private keys, personal donor contact data, raw evidence payloads, raw media,
precise coordinates, or tax identifiers.

### 4.2 Review

The immutable review fact binds the complete candidate, decision, reviewer
authority, rationale, review time, command hash, review root, and one semantic
audit event. A candidate has one canonical review command. A rejected review
cannot be used for publication.

### 4.3 Publication

The immutable publication fact binds the approved review, publisher authority,
public minimized projection, sequence, predecessor root, publication root,
safety boundary, and one semantic audit event.

The public projection contains only project and publication IDs, status,
integer-cent totals, counts, aggregate evidence/proof/policy roots, reporting
period, validity, and deterministic projection root. It excludes source
documents, internal evidence IDs, personal identities, and payment data.

### 4.4 Control and current projection

A control fact is either:

- `challenge`: current totals remain visible but are classified as challenged
  and cannot be consumed as reconciled operational totals; or
- `withdraw`: the package remains historically discoverable but contributes
  zero current operational totals.

The current resolver replays the complete per-organization/project stream. It
uses only the latest publication, never falls back, and returns one of:
`active`, `challenged`, `withdrawn`, or `expired`.

## 5. Data Flow

```text
Durable project + funding instrument + policy + evidence + proof authorities
                                   |
                                   v
                    minimized deterministic candidate
                     prepared by accredited human
                                   |
                                   v
                  independent human reconciliation review
                                   |
                                   v
            serializable publication with current-source re-resolution
      semantic event + publication fact + exact receipt in one transaction
                                   |
                                   v
          current public projection for funding page / command center

Independent governor challenge/withdrawal
  -> append-only control fact
  -> no historical mutation and no fallback to an older publication
```

## 6. Command and API Design

The route-closed library exports:

```ts
buildFundingAccountabilityCandidate(input, preparer)
buildFundingAccountabilityReview(input, reviewer)
buildFundingAccountabilityPublication(input, publisher, history)
buildFundingAccountabilityControl(input, governor, history)
resolveFundingAccountabilityProjection(input)

repository.commitReview(review, idempotencyKey, resolveCurrentAuthority)
repository.commitPublication(publication, idempotencyKey, resolveCurrentAuthority)
repository.commitControl(control, idempotencyKey, resolveCurrentAuthority)
repository.resolveCurrentProjection(query)
```

Every repository command:

1. parses and replays all deterministic roots;
2. begins a `SERIALIZABLE` transaction;
3. sets exact organization and actor context;
4. acquires command and project-stream advisory locks;
5. returns an existing result only for an exact receipt match;
6. re-resolves every current source and actor authority;
7. verifies the current semantic predecessor;
8. appends one semantic event, one fact, one command receipt, and row audit;
9. reads back and replays the committed result; and
10. retries only recognized serialization/deadlock conflicts, up to three
    attempts, re-resolving current authority on every attempt.

No canonical HTTP route is introduced in this change. A future API migration
must expose compatibility routes as `canonical: false` until a reviewed,
authenticated route calls only this repository.

## 7. Threat Model

| Threat | Control |
| --- | --- |
| Caller invents evidence or proof linkage | Transaction-owned source resolver compares exact sorted member roots to current durable authorities |
| Reconciled total exceeds real allocation | Integer-cent invariants in TypeScript and PostgreSQL |
| One actor creates and approves a package | Three distinct accredited humans for preparation, review, and publication |
| Stale project or policy is republished | Current project/funding/policy roots are re-resolved inside every write transaction |
| Challenged or revoked proof is counted as reconciled | Source resolver rejects non-current proof lifecycle state; control projection removes challenged totals from current reconciliation |
| Retry changes content | Exact receipt binds actor, operation, key hash, request hash, result ID, response root, and audit root |
| Concurrent writers fork project history | Serializable transaction plus project advisory lock and semantic sequence |
| Tenant reads or writes another organization's package | `ENABLE` and `FORCE ROW LEVEL SECURITY` with exact transaction organization context |
| Historical fact is edited or deleted | Append-only triggers and row-mutation audit |
| Withdrawn package silently falls back | Resolver considers latest publication only |
| Personal/payment data leaks | Strict schemas, minimized public projection, and recursive forbidden-key checks |
| Transparency record is treated as a payment or regulated claim | Root-bound safety object and database constraints deny funds, CANOPY distribution, credit, tax, asset, title, and yield semantics |

## 8. Database Changes

Add three tenant-bound append-only tables:

- `funding.accountability_review_facts`;
- `funding.accountability_publication_facts`; and
- `funding.accountability_control_facts`.

Each table stores selected indexed columns plus one strict `fact_record`.
Database functions independently recompute candidate, milestone, review,
projection, publication, and control hashes. Insert triggers bind columns to the
JSON fact, current actor rows, semantic event, sequence, predecessor, safety,
and cross-table relationships.

All three tables use forced RLS. Facts, semantic events, exact command receipts,
and row audit records commit atomically. Existing compatibility tables remain
unchanged and are not automatically promoted.

## 9. Migration Strategy

1. Ship this RFC, deterministic authority, repository, additive SQL, and tests
   with all routes and schedulers closed.
2. Apply the migration twice in PGlite to prove idempotence.
3. Run TypeScript/SQL hash parity, append-only, exact retry, restart, RLS, and
   non-empty rollback tests.
4. Run the same cross-tenant and concurrent-writer scenarios against a
   confirmed disposable native PostgreSQL database with a `NOBYPASSRLS` role.
5. Implement the durable source adapter against canonical project, evidence,
   proof lifecycle, policy, and funding-instrument authorities.
6. Shadow-build accountability packages and compare them with independently
   reconciled institutional source documents.
7. Complete donor/grant policy, privacy, sanctions, legal, accounting,
   accessibility, abuse, load, backup/restore, and incident reviews.
8. Provision least-privilege identities and migrate reads before writes.
9. Activate through a separate guarded change with human environment approval.

Compatibility rows are never backfilled as canonical facts merely because
their hashes are structurally valid.

## 10. Rollback Strategy

Before any authority fact exists, the rollback migration may remove the new
tables, policies, functions, and triggers. Once any review, publication, or
control fact exists, destructive rollback aborts.

Operational rollback after activation must:

1. disable writer and scheduler identities;
2. revoke their database privileges;
3. append challenges or withdrawals where required;
4. make current reads fail closed or show challenged/withdrawn state;
5. preserve all facts, receipts, semantic events, and row audit history; and
6. publish a corrected package only after a new independent review.

## 11. Verification and Security Gates

Unit tests must prove deterministic replay, integer-cent conservation,
independent actors, sorted unique members, challenge/withdraw/expiry without
fallback, stale authority rejection, unsafe-key rejection, and fixed safety.

PostgreSQL tests must prove atomic commit, exact idempotency, current-source
re-resolution, SQL/TypeScript root parity, restart replay, append-only behavior,
cross-tenant denial, forced-RLS catalog state, missing-event rejection, and
non-empty rollback refusal.

Activation additionally requires native PostgreSQL non-bypass RLS and
concurrency evidence, a clean reviewed-commit CI run, observability, SLOs,
alerts, backup/restore, incident drills, institutional policy approval, and a
separate human-approved deployment.

## 12. Fixed Safety Boundary

Every candidate, fact, projection, and status object asserts:

- transparency only;
- no mainnet funds;
- no automatic CANOPY distribution;
- no payment rail, custody, settlement, wallet, or private-key handling;
- not a certified carbon credit;
- not a carbon-tax offset;
- not a financial asset or ownership right; and
- no guaranteed yield.

These are system invariants, not optional presentation copy.
