# RFC: Canonical Project Lifecycle Source Resolver

Status: Implemented as a route-closed authority composition layer

Owners: CanopyProof Architecture, Governance, Security, and MRV

Target: PostgreSQL transaction-owned project lifecycle writes

Activation: Disabled

## 1. Problem Statement

The canonical project lifecycle domain already defines deterministic facts for
registration, review, stage transitions, adverse controls, replay, and audit.
Its PostgreSQL repository deliberately accepts an authority resolver so every
write can re-resolve current authority inside the same serializable transaction.
Until this RFC, no production composition resolver defined how that callback
must derive actors, policy, project lineage, funding, proof, monitoring,
closure, or restoration authority from durable facts.

Accepting a caller-supplied callback is suitable for unit tests but is not an
institutional trust boundary. A permissive callback could echo stale roots,
select only favorable source records, or bless an opaque closure or restoration
hash. It could therefore create a cryptographically valid lifecycle fact whose
claimed source was not current when committed.

This RFC defines one fail-closed resolver for the route-closed repository. It
does not mount an API route, start a scheduler, activate production writes, or
make a carbon-credit, tax-offset, financial-asset, ownership, or yield claim.

## 2. Decisions

### 2.1 One transaction owns authority resolution

The repository opens a serializable transaction, obtains the command and
project-stream advisory locks, loads lifecycle history, and calls the resolver.
The resolver must use only that supplied transaction. It may not open a nested
transaction, consult an eventually consistent cache, or call a network service.

The resolver returns the exact actor, historical registration project root,
bound policy root, transition source root, and restoration root expected by the
candidate fact. The repository compares them before rebuilding and inserting
the fact. Any mismatch aborts the entire transaction, including audit events and
idempotency receipts.

### 2.2 Historical project anchor and current project authority are distinct

`projectAuthorityRoot` and `projectStatus` in a lifecycle registration bind the
immutable registration row in `projects.projects`. They are historical anchors.
They must continue to validate after append-only project status transitions or
accepted monitoring events advance `projects.current_authority(projectId)`.

The resolver also reads the current project authority. Current roots are
committed by the stage-specific source where they matter:

- funding `currentRoots` includes the current funding root and current project
  root;
- proof `currentRoots` includes the current governed-record, MRV graph, and
  project roots; and
- monitoring requires the latest accepted monitoring root to equal the current
  project root.

This avoids treating legitimate monitoring progression as registration drift
without allowing current project state to disappear from transition lineage.

### 2.3 Project lifecycle has its own governed policy subject

`governance.proof_policy_versions` gains the subject `project_lifecycle`.
Registration, review, and forward transitions require the exact bound policy ID
and root to exist and remain unsuperseded at the operation time. Emergency
`challenge`, `suspend`, and `revoke` controls may still execute under the bound
historical policy after supersession so governance can reduce risk. Restore is
not an emergency control and requires current policy plus a separate restoration
authority.

`policyVersion` remains a human-readable registration label. The authoritative
identity is the governed policy ID and root.

### 2.4 Human authority is re-resolved, not trusted from the fact

Registration requires a currently verified human owner or administrator with
an active membership in the subject organization. The resolver reconstructs a
`subject_membership` actor snapshot from current identity, organization, and
membership rows.

Review, transition, and control require a currently verified external human
whose organization has either current root-governance bootstrap authority or a
current canonical accreditation containing the exact required scope. The
canonical accreditation resolver selects the latest valid qualifying authority
deterministically. AI, agents, devices, and the project organization cannot be
final review or governance actors.

### 2.5 Source sets are complete, not caller-selected

For every supported transition, the resolver derives the complete eligible set
from durable rows at `effectiveAt`, canonicalizes it, builds the source with the
same domain builder used by replay, and returns only the resulting root. The
candidate fact must already contain that exact root.

## 3. Supported Source Composition

### 3.1 `PROPOSED -> FUNDED`

The resolver replays funding-accountability facts inside the caller transaction.
The current projection must:

- exist;
- be `active`;
- have a positive operational allocated-cent total; and
- be scoped to the same organization and project.

The canonical funding source is:

- `projectionRoots`: the active public projection root;
- `currentRoots`: the funding current root and current project root;
- `allocatedCents`: current operational allocated cents; and
- `resolvedAt`: transition time.

Challenged, withdrawn, expired, zero-allocation, missing, or malformed funding
fails closed.

### 3.2 `FUNDED -> VERIFIED`

The resolver evaluates every environmental-proof lifecycle binding for the
project whose binding time is not later than the transition. It requires at
least one `active` lifecycle projection. Any current `challenged` or `suspended`
projection fails the transition rather than permitting favorable-record
selection.

The canonical proof source is:

- `lifecycleProjectionRoots`: all active lifecycle projection roots;
- `currentRoots`: each active governed-record projection root, each active
  current MRV graph root, and the current project root; and
- `resolvedAt`: transition time.

The lifecycle projection itself enforces current signature, key, validity,
governed-record, challenge, and MRV state. Empty or adverse sets fail closed.

### 3.3 `VERIFIED -> LONG_TERM_OBSERVATION`

The resolver finds the committed `VERIFIED` transition for the current
generation and evaluates all project monitoring events after that transition
and not later than the proposed transition. Every event in that interval must
be `accepted`; unresolved submitted, review, or challenged events fail closed.

The canonical monitoring source contains:

- every accepted monitoring root in canonical order;
- the latest observation timestamp;
- the registration monitoring-plan root; and
- `resolvedAt`: transition time.

The latest accepted monitoring root must equal the current project root, which
prevents a later uncommitted project-state change from being omitted.

### 3.4 `LONG_TERM_OBSERVATION -> CLOSED`

Closure remains unavailable. The repository has no dedicated canonical closure
review authority that binds closure evidence, final monitoring, reviewer
independence, unresolved challenges, and policy. The resolver throws
`CANOPYPROOF_PROJECT_LIFECYCLE_CLOSURE_AUTHORITY_UNAVAILABLE` for every closure
attempt. A public-disclosure review is not a substitute for ecological closure
review.

### 3.5 Restoration

Restore remains unavailable. No canonical restoration-decision fact currently
binds the adverse control, remediation evidence, current source re-resolution,
independent governor, and policy. The resolver throws
`CANOPYPROOF_PROJECT_LIFECYCLE_RESTORATION_AUTHORITY_UNAVAILABLE` rather than
accepting an opaque `restorationAuthorityRoot`.

Challenge, suspend, and revoke remain supported because they only reduce
authority and the lifecycle control fact already binds their human governor,
reason root, stream predecessor, and audit event.

## 4. Data Flow

1. A caller builds a deterministic lifecycle fact off-line or in an unmounted
   service boundary.
2. The repository starts a serializable transaction and sets tenant/actor
   context.
3. Advisory locks serialize the idempotency key and project lifecycle stream.
4. Existing lifecycle history is replayed and the repository constructs a
   typed authority query from the candidate fact and registration.
5. The canonical resolver re-resolves actor, project anchor, current project,
   policy, and supported source facts using the same transaction.
6. The resolver builds the expected stage source root.
7. The repository compares all roots and the exact actor snapshot, rebuilds the
   fact, and checks deterministic equality.
8. Only then are the semantic audit event, fact, and command receipt appended.
9. The stored stream is replayed again before commit.

## 5. Threat Model

| Threat | Control |
| --- | --- |
| Caller echoes stale authority | Resolver ignores caller projections and rereads durable facts in the write transaction |
| Actor revoked between build and commit | Current identity, membership, organization, and accreditation are reconstructed at commit |
| Favorable funding or proof cherry-picking | Resolver derives the complete eligible source set |
| Nested-transaction time-of-check/time-of-use gap | Funding and proof projections reuse the caller transaction |
| Cross-tenant source substitution | Every query binds organization and project under forced RLS context |
| Project root legitimately changes after registration | Historical registration anchor and current project authority are checked separately |
| Challenged proof omitted from verification | Any current challenged or suspended proof projection fails closed |
| Unresolved monitoring omitted | Any post-verification non-accepted monitoring event fails closed |
| Arbitrary closure hash | Closure unavailable until a canonical closure authority exists |
| Arbitrary restoration hash | Restore unavailable until a canonical restoration authority exists |
| Policy supersession ignored | Forward authority requires the bound policy to remain current |
| Policy supersession blocks emergency mitigation | Challenge, suspend, and revoke may use the valid bound historical policy |
| AI becomes final authority | Actor reconstruction accepts verified humans only |

## 6. API And Type Changes

No HTTP API is added.

`CanopyProofProjectLifecycleAuthorityQuery` gains:

- `actorRole`;
- `policyId`;
- `transitionFromStage` and `transitionToStage`;
- `controlAction`; and
- `monitoringPlanRoot`.

These fields are derived from the fact and its registration, never from request
metadata. Existing test resolvers remain structurally compatible.

The funding repository gains `resolveCurrentProjectionInTransaction`. The
environmental-proof lifecycle repository gains
`listProjectLifecyclesInTransaction`. Neither method changes routes or
activation state.

## 7. Database Changes

A forward migration expands the immutable governed-policy subject constraint to
include `project_lifecycle`. It does not mutate existing facts. The migration is
idempotent and validates the replacement constraint.

No resolver-owned table is required. All source authority remains in existing
append-only facts:

- identity and organization membership;
- root governance and organization accreditation;
- project registration/status/monitoring;
- funding accountability;
- environmental proof lifecycle, governed-record challenge projection, and MRV
  graph snapshots; and
- governed policy versions.

## 8. Migration Strategy

1. Apply the base CanopyProof schema and existing authority migrations.
2. Apply the policy-subject expansion migration.
3. Run deterministic unit tests for actor, policy, and source composition.
4. Run PGlite parity, RLS, append-only, stale-source, adverse-state, and atomic
   rollback tests.
5. Run disposable native PostgreSQL verification before any route-readiness
   proposal.
6. Keep route, scheduler, and production activation flags false.

Existing project lifecycle facts remain replayable because their schema and
hash domains do not change. The new resolver only governs future writes.

## 9. Rollback Strategy

Rollback first disables any prospective caller and keeps all routes closed.
Code can be reverted without changing durable lifecycle facts.

The policy-subject constraint may be narrowed only when no
`project_lifecycle` policy rows exist. The rollback script checks that condition
and aborts otherwise. It never deletes a policy, lifecycle fact, audit event, or
command receipt.

If a source-composition defect is discovered after facts exist:

1. stop lifecycle writers;
2. preserve facts and audit evidence;
3. replay affected streams;
4. append a governed adverse control where permitted; and
5. introduce a versioned successor authority rather than rewriting history.

## 10. Non-Goals And Activation Boundary

This increment does not implement closure review, restoration decisions, API
routes, schedulers, production deployment, certificate issuance, token
distribution, payments, private-key handling, or public financial/environmental
claims. It is a route-closed trust-kernel dependency.

Production activation requires separate governance approval after native
PostgreSQL, security, privacy, scientific, legal, operations, and incident
recovery review.
