# RFC: Canonical Institutional Project Lifecycle Authority

Status: Accepted for route-closed implementation; no HTTP route, scheduler, or
production activation is authorized by this RFC

Date: 2026-07-19

Owners: CanopyProof Trust Kernel, Projects, Evidence, Verification, Funding,
Governance, Security, and Platform Operations

Decision class: Canonical project lifecycle and institutional reliance authority

## 1. Problem Statement

CanopyProof has an append-only project registration and monitoring registry, but
its compatibility status vocabulary (`submitted`, `active`, `monitored`, and
related operational states) does not establish the institutional lifecycle
required by governments, climate funds, research institutions, or UN partners.
In particular, it does not bind one reviewed baseline, intervention plan,
monitoring plan, governed funding state, current Environmental Proof state, or
long-term observation record into one deterministic authority.

The Global Impact Command Center and every downstream institutional report need
an answer to a narrower and harder question than “does a project row exist?”:

> What is the current, independently governed project stage, and which exact
> durable authorities justify that stage at a stated time?

Treating compatibility project status as that answer would upgrade an
operational row into a reliance claim. This RFC introduces a separate canonical
authority with the required lifecycle:

```text
PENDING_REVIEW
       |
       v
   PROPOSED -> FUNDED -> VERIFIED -> LONG_TERM_OBSERVATION -> CLOSED
                   \          \                 \
                    +----------+-----------------+-> CHALLENGED / SUSPENDED
                                                        |
                                                        +-> RESTORED or REVOKED
```

The authority remains an environmental accountability record. It does not
issue a certified carbon credit, tax offset, ownership right, financial asset,
funding instruction, guaranteed return, or automatic CANOPY distribution.

## 2. Decision And Scope

Create a deterministic lifecycle domain and append-only PostgreSQL authority
with four fact families:

1. `project_lifecycle_registration` binds one existing project authority, one
   baseline commitment, one intervention commitment, one monitoring-plan
   commitment, one policy, one validity interval, and the proposer authority.
2. `project_lifecycle_review` records an independent accredited human decision
   on the exact registration root.
3. `project_lifecycle_transition` advances exactly one canonical stage after
   re-resolving the stage-specific source authority.
4. `project_lifecycle_control` challenges, suspends, restores, or terminally
   revokes the current lifecycle without rewriting prior facts.

The initial implementation is a library and database boundary only. It does
not mount generic or CanopyProof HTTP routes, run a scheduler, migrate existing
compatibility status rows, or authorize production reliance.

## 3. Trust Model

```text
Current durable project authority
       + baseline evidence roots
       + intervention methodology root
       + monitoring plan
                     |
                     v
          deterministic registration
                     |
          independent accredited human review
                     |
                     v
        append-only canonical PROPOSED stage
                     |
      stage-specific current-source resolver
     funding / proof / monitoring / closure
                     |
          distinct accredited human governor
                     |
                     v
       serializable append-only transition
                     |
       deterministic as-of-time projection
```

Hash integrity is necessary but not sufficient. Current authority comes from
source re-resolution inside the same transaction, independent human review,
exact actor accreditation, one canonical predecessor, immutable semantic audit
events, and exact command receipts.

Agents may prepare off-record registration and source summaries. The on-record
proposer must be a verified human owner/admin with current membership in the
project organization; an Agent cannot appear as proposer, approve a
registration, govern a stage transition, control a lifecycle, or become final
authority. Reviewers and governors must be external verified humans with
current organization membership and canonical accreditation.

## 4. Canonical Data Model

### 4.1 Baseline commitment

The baseline is a bounded lineage commitment, not a scientific certification:

- `baselineId`;
- `observedAt`;
- sorted, unique `evidenceRoots`;
- sorted, unique optional `satelliteRoots`;
- sorted, unique optional `metricRoots`;
- `limitations` with at least one explicit limitation; and
- deterministic `baselineRoot`.

At least one evidence root is required. No media bytes, exact coordinates,
personal identifiers, provider credentials, or private keys are embedded.

### 4.2 Intervention commitment

The intervention binds:

- `interventionId` and one bounded intervention type;
- start and optional end time;
- target area in integer square metres;
- target tree count as a safe integer;
- methodology root;
- sorted intervention evidence roots; and
- deterministic `interventionRoot`.

These are declared project bounds. They are not verified impact outcomes.

### 4.3 Monitoring-plan commitment

The monitoring plan binds:

- `monitoringPlanId`;
- starts/ends interval;
- integer cadence days;
- sorted unique indicator codes;
- sorted unique evidence requirement codes;
- responsible organization ID;
- escalation policy root; and
- deterministic `monitoringPlanRoot`.

### 4.4 Registration fact

The registration commits the exact current project ID/root/status, all three
commitments, policy ID/version/root, validity interval, proposer snapshot,
command hash, stream sequence, predecessor, semantic audit event, fixed safety
boundary, and `registrationRoot`.

Only an eligible current project (`submitted`, `under_review`, `active`, or
`monitored`) may register. Challenged, suspended, or archived compatibility
projects fail closed. Registration does not itself produce `PROPOSED`;
independent approval is required.

### 4.5 Review fact

The review binds the complete registration, `approve` or `reject`, reason code,
rationale, a human reviewer authority snapshot, time, sequence, predecessor,
audit event, and `reviewRoot`. The reviewer must be distinct from the proposer
and accredited for `projects:lifecycle_review`.

### 4.6 Transition fact

The transition binds one legal stage edge and one stage-specific source:

| Edge | Required source commitment |
| --- | --- |
| `PROPOSED -> FUNDED` | one or more current active funding-accountability projection roots, a safe positive allocated-cent total, and their current-root commitment |
| `FUNDED -> VERIFIED` | one or more current active Environmental Proof lifecycle projection roots and their current-root commitment |
| `VERIFIED -> LONG_TERM_OBSERVATION` | at least one accepted monitoring-event root observed after verification and the current monitoring-plan root |
| `LONG_TERM_OBSERVATION -> CLOSED` | closure evidence roots, final monitoring root, and closure review root |

The transition also binds a distinct accredited human governor, rationale,
time, sequence, predecessor, audit event, and `transitionRoot`. A governor may
not be the registration proposer or registration reviewer. The exact scope is
`projects:lifecycle_govern`.

### 4.7 Control fact

Controls are append-only:

- `challenge` moves a non-terminal stage to `CHALLENGED`;
- `suspend` moves a non-terminal stage to `SUSPENDED`;
- `restore` returns only to the recorded underlying stage after a later,
  independently governed source re-resolution;
- `revoke` moves any non-closed stage to terminal `REVOKED`.

`CLOSED` and `REVOKED` are terminal. No control may resurrect them. Challenge,
suspension, revocation, or expiry never falls back to an older registration or
transition.

## 5. Deterministic Projection

Replay is scoped by `(organizationId, projectId)` and verifies every root,
sequence, predecessor, actor separation rule, transition edge, source
commitment, and audit chain. The projection returns:

- current stage and underlying stage;
- registration, review, latest transition, and latest control roots;
- baseline, intervention, and monitoring-plan roots;
- project and policy roots;
- evaluated time and validity state;
- explicit issue codes;
- deterministic `projectionRoot`; and
- the fixed non-claim safety boundary.

At `validUntil`, an otherwise active lifecycle projects `EXPIRED`. Expiry does
not mutate history and cannot be repaired by evaluating at a different time.
A fresh reviewed registration is required for future reliance.

## 6. Data Flow And Transaction Boundary

Every command follows the same order:

1. Parse and canonicalize input before opening a transaction.
2. Begin `SERIALIZABLE` and set actor/organization context.
3. Acquire command-idempotency and project-stream advisory locks.
4. Return an existing receipt only when request hashes match exactly.
5. Re-resolve current project, source, actor, policy, and accreditation inside
   the active transaction.
6. Load all lifecycle facts and semantic events, then replay from genesis.
7. Verify the proposed fact against the current projection and legal edge.
8. Insert one semantic event, one lifecycle fact, and one command receipt.
9. Read back and replay the stored stream before returning.

Serialization failures and deadlocks may retry at most three times. Every retry
must re-resolve all current authorities and must not reuse transaction state.

## 7. Library API

The route-closed repository exposes typed commands only:

```ts
commitRegistration(fact, idempotencyKey, resolveCurrentAuthority)
commitReview(fact, idempotencyKey, resolveCurrentAuthority)
commitTransition(fact, idempotencyKey, resolveCurrentAuthority)
commitControl(fact, idempotencyKey, resolveCurrentAuthority)
getProjection(organizationId, projectId, evaluatedAt, actorId)
getHistory(organizationId, projectId, actorId)
```

Resolver callbacks receive the active `Prisma.TransactionClient`. They cannot
return compatibility accreditation rows. Actor authority must come from the
canonical organization-accreditation/root-governance resolver. Source
projections must be reconstructed from append-only canonical facts.

No endpoint is authorized by this API design. A future HTTP surface requires a
separate RFC, threat model, least-privilege role, abuse controls, and activation
decision.

## 8. Database Changes

Add four append-only tables under `projects`:

- `project_lifecycle_registration_facts`;
- `project_lifecycle_review_facts`;
- `project_lifecycle_transition_facts`;
- `project_lifecycle_control_facts`.

Each table stores indexed scope/sequence/source columns plus the complete
strict fact JSON. Constraints and triggers enforce:

- one registration per lifecycle generation;
- unique project sequence and predecessor;
- exact fact/column/root equality;
- legal stage/source shape;
- semantic-event linkage;
- append-only update/delete denial;
- forced RLS by `app.organization_id`;
- current subject-membership and external governance-actor validation; and
- insert-time checks that reject orphaned, stale, or forked facts.

The migration is additive. It does not alter `projects.projects`, rewrite
compatibility statuses, or backfill historical projects as canonical.

The route-closed implementation now includes the pure deterministic domain,
Prisma repository, additive/rollback SQL, unit tests, and PGlite transaction
tests. PGlite proves SQL/TypeScript root parity, exact retry and conflicting
retry behavior, current-authority and membership drift rollback, challenge and
independent restoration, one-winner competing transitions, forced-RLS tenant
filtering, append-only mutation denial, migration idempotency, and non-empty
rollback refusal. It is not native PostgreSQL, production migration, backup,
restore, load, or activation evidence.

## 9. Threat Model

| Threat | Control |
| --- | --- |
| Compatibility `active` is presented as canonical `VERIFIED` | Separate fact families and no automatic backfill |
| Fabricated baseline or plan | Domain-separated roots, bounded schemas, source re-resolution, full replay |
| Funding stage without governed allocation | Current active funding projection roots and positive integer-cent commitment |
| Verified stage without current proof | Current active Environmental Proof lifecycle roots |
| Monitoring stage without post-verification evidence | Accepted monitoring roots, observed-time ordering, monitoring-plan binding |
| Proposer self-approves | Distinct verified human reviewer with exact accreditation scope |
| Reviewer later governs transition | Governor must differ from proposer and registration reviewer |
| Agent becomes final authority | Review, transition, and control schemas require human actors |
| Stale source is reused after review | Transaction-owned current-source resolver on every write and restore |
| Concurrent transitions fork | Project advisory lock, serializable transaction, sequence/predecessor uniqueness |
| Same idempotency key changes payload | Exact receipt request hash and result-root equality |
| Suspended project falls back to older stage | Latest adverse control dominates; no fallback |
| Cross-tenant lifecycle read/write | Forced RLS and transaction organization context |
| Database owner mutates history | Update/delete denial and row-mutation audit; owner compromise remains an operations threat |
| Lifecycle becomes a carbon or financial claim | Fixed safety boundary is root-bound and SQL constrained |

## 10. Migration Strategy

1. Ship RFC, pure domain, additive SQL, repository, and tests with routes closed.
2. Apply the migration idempotently in PGlite and disposable PostgreSQL.
3. Verify root parity, exact retry, failed-write atomicity, RLS metadata,
   non-bypass tenant denial, append-only triggers, restart replay, and rollback.
4. Classify existing projects. Do not infer baseline, intervention, monitoring,
   funding, proof, or approval facts from compatibility rows.
5. Provision canonical actor accreditation, policy, and source resolvers.
6. Run a shadow migration that creates new registrations only from complete
   reviewed evidence.
7. Independently review each proposed canonical lifecycle.
8. Activate read consumers before considering any writer route.
9. Compose the Global Command Center only after it consumes the canonical
   lifecycle projection and rejects compatibility status.

## 11. Rollback Strategy

Rollback is fail-closed:

1. keep routes and schedulers disabled;
2. revoke any lifecycle writer role;
3. stop downstream reliance and return explicit unavailable states;
4. preserve all facts, audit events, receipts, and source records;
5. replay the affected project stream for investigation;
6. append a governed control or successor registration when correction is
   justified; and
7. never update or delete a lifecycle fact.

The rollback SQL may drop the new objects only when all four fact tables are
empty. It must abort when any durable lifecycle fact exists.

## 12. Verification And Activation Gates

The route-closed library has completed deterministic unit coverage and the
PGlite portions below. Required before code is considered route-ready:

- deterministic root and replay tests for every stage;
- illegal-edge, missing-source, stale-source, actor-substitution, self-review,
  duplicate, tamper, expiry, challenge, suspension, restoration, and terminal
  state tests;
- disposable native PostgreSQL dual-writer and `NOBYPASSRLS` tests;
- backup/restore and incident replay evidence;
- a production composition resolver that derives project, policy, actor,
  funding, proof, monitoring, closure, and restoration authority from current
  canonical facts inside the supplied transaction;
- privacy, scientific, funding, governance, security, accessibility, legal,
  and operations review; and
- a separate guarded activation decision.

Until those gates pass, status remains route-closed and no production claim or
deployment is authorized.
