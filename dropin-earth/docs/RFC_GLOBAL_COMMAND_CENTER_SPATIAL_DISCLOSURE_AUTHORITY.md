# RFC: Global Command Center Spatial Disclosure Authority

Status: Proposed for route-closed implementation
Decision owner: CanopyProof Governance and Safeguarding
Last updated: 2026-07-19

## 1. Problem Statement

The Global Impact Command Center can display an integer-degree regional
centroid only when a root-bound `CanopyProofGlobalCommandCenterSpatialDisclosure`
is supplied. The projection verifier already rejects raw coordinates,
under-sized cohorts, stale disclosure windows, wrong source roots, and reused
review roots. That is a read-side contract, not a production authority.

Without a durable writer, a caller could manufacture two hash-shaped review
roots and pass them to the projection builder. CanopyProof therefore cannot
claim that visible geometry was independently reviewed, can be withdrawn, or
can be replayed from an append-only institutional record.

This RFC defines a separate, tenant-bound spatial-disclosure authority. It does
not activate the dashboard writer or any public route. It never stores project,
evidence, device, scene, or contributor coordinates. Its most precise location
is the same integer-degree regional centroid already allowed by the v2 public
projection.

## 2. Decision

Spatial publication is a four-command authority:

1. an accredited human privacy reviewer appends a decision over one immutable
   candidate;
2. a different accredited human safeguarding reviewer appends a decision over
   the exact same candidate;
3. an authorized publisher appends a disclosure only when both current
   decisions approve the candidate; and
4. an accredited human governor may append a withdrawal control. Expiry is a
   deterministic projection of `validUntil`, not a mutable status update.

Each command owns a semantic audit event, exact idempotency receipt, actor
authority snapshot, source root, sequence, predecessor, and deterministic root.
Review, disclosure, and control rows are immutable. A withdrawn or expired
latest disclosure never falls back to an older geometry.

## 3. Trust Model

### 3.1 Authorities

| Action | Required actor | Accreditation scope |
| --- | --- | --- |
| Privacy review | verified human, active membership, verifier/admin/owner | `global_command_center:spatial_privacy_review` |
| Safeguarding review | verified human, active membership, verifier/admin/owner | `global_command_center:spatial_safeguarding_review` |
| Publish disclosure | verified human, active membership, admin/owner | `global_command_center:spatial_publish` |
| Withdraw disclosure | verified human, active membership, verifier/admin/owner | `global_command_center:spatial_withdraw` |

Privacy and safeguarding reviewers must be different people. The publisher
must be different from both reviewers. A withdrawal governor must be different
from the publisher. AI and agents cannot review, publish, or withdraw geometry.

All actors belong to the same verified authority organization. The repository
re-resolves current participant, organization, membership, accreditation, and
source authority inside each serializable command transaction. Stored snapshots
are evidence of the command; they are not accepted as current authority.

### 3.2 Candidate

An immutable candidate commits:

- authority organization and region;
- integer latitude `[-90, 90]` and longitude `[-180, 179]`;
- exactly one-degree precision;
- current regional source root and exact project count;
- a fixed minimum cohort of three and project count of at least three;
- governed policy ID and root;
- canonical UTC validity interval; and
- a deterministic candidate root.

The candidate has no raw coordinate, geometry, boundary, scene extent,
accuracy, project ID, evidence ID, device ID, or personal identifier.

### 3.3 Current Projection

For a requested region/source/project-count/time tuple, the resolver:

1. reads only the latest published disclosure in the tenant and region stream;
2. verifies its complete deterministic fact and both stored review facts;
3. verifies a contiguous semantic event chain;
4. rejects a source, cohort, policy, or interval mismatch;
5. withholds when the latest disclosure is expired or has a valid withdrawal;
6. never searches backward for an older still-valid geometry; and
7. returns only the existing public-safe disclosure commitment.

## 4. Data Flow

```text
Current regional authority
  -> minimized candidate + candidateRoot
  -> privacy review command + semantic event
  -> safeguarding review command + semantic event
  -> disclosure publication command
       -> re-read both review facts
       -> re-resolve current source and all actor authorities
       -> append disclosure fact + semantic event
  -> current disclosure resolver
       -> current/expired/withdrawn projection
       -> Global Command Center source resolver
       -> governed snapshot publication

Human withdrawal command
  -> re-read current disclosure
  -> re-resolve governor
  -> append control fact + semantic event
  -> current resolver returns withheld
```

Review streams are scoped by candidate and review kind. Disclosure and control
events share one organization/region stream, making publication ordering and
withdrawal ordering explicit.

## 5. Threat Model

| Threat | Control |
| --- | --- |
| Caller invents review hashes | Publication requires two stored, root-replayed review facts and their semantic events |
| One person performs both reviews | Distinct human IDs are enforced in TypeScript and PostgreSQL |
| Publisher self-reviews | Publisher must differ from both reviewers |
| Stale actor credentials are replayed | Transaction callback re-resolves all current authority snapshots |
| Source changes after review | Publication re-resolves the exact candidate source; dashboard publishing re-resolves it again |
| Low-cohort region is exposed | Candidate and database require at least three projects and fixed cohort size three |
| Raw coordinates leak | Strict schemas and JSON key denylist reject precise-location fields; only integer degrees are stored |
| Withdrawn geometry reappears | Current projection examines the latest disclosure only and never falls back |
| Concurrent publications fork | Serializability, region advisory lock, semantic predecessor, and unique stream sequence |
| Idempotency key is reused with new content | Exact command receipt binds operation, actor, request, result, response, and audit root |
| Tenant reads another authority's record | `ENABLE` and `FORCE ROW LEVEL SECURITY` with exact `app.organization_id` policy |
| Row or event is changed later | append-only triggers, row-mutation audit, and root replay |
| Rollback erases governance evidence | rollback refuses while any review, disclosure, or control fact exists |
| Geometry implies a claim or ownership right | fixed safety boundary forbids carbon, tax, financial, title, emergency, and yield claims |

## 6. API and Service Boundary

The implementation exports a domain authority and PostgreSQL repository only.
No HTTP route, scheduler, queue consumer, or composition-root binding is added.

```ts
commitReview(review, idempotencyKey, resolveCurrentAuthority)
commitDisclosure(disclosure, idempotencyKey, resolveCurrentAuthority)
commitWithdrawal(control, idempotencyKey, resolveCurrentAuthority)
resolveCurrentDisclosure(query)
```

Every resolver receives the active transaction. It must use durable source and
identity stores and must not read process-local fixtures. The status contract is
fixed to `routeMounted=false`, `schedulerMounted=false`, and
`productionActivationEnabled=false`.

## 7. Database Changes

Add three tenant-bound append-only tables under `impact`:

- `global_command_center_spatial_review_facts`;
- `global_command_center_spatial_disclosure_facts`; and
- `global_command_center_spatial_control_facts`.

Each row stores selected indexed columns plus a strict `fact_record`. Database
triggers bind selected columns to the JSON fact, validate the referenced
semantic event, enforce review/disclosure/control relationships, and reject
unknown unsafe JSON keys. TypeScript performs full canonical replay; SQL
performs independent structural and authority invariants.

All three tables use forced RLS. Canonical commands also append to
`audit.domain_events`, `audit.command_receipts`, and `audit.event_log` in the
same transaction.

## 8. Migration Strategy

1. Apply the additive migration after `canopyproof-os.sql`.
2. Apply it twice in PGlite to prove idempotence.
3. Run deterministic unit and PostgreSQL contract tests, including RLS under a
   non-bypass role in native PostgreSQL.
4. Keep all routes and schedulers absent.
5. Implement the durable Global Command Center source resolver against this
   repository in a later separately reviewed slice.
6. Provision a least-privilege authority organization and database role only
   after privacy, safeguarding, legal, security, and operations approval.
7. Activate through a separate guarded change with human environment approval.

No existing snapshot is backfilled from project coordinates. Existing regions
remain withheld until a new governed disclosure is created.

## 9. Rollback Strategy

Before any durable fact exists, the rollback migration removes policies,
triggers, functions, and tables. Once a fact exists, destructive rollback
aborts. Operational rollback instead:

1. disables the future disclosure resolver and writer composition roots;
2. appends withdrawals for unsafe current disclosures when governance requires;
3. publishes a new dashboard snapshot with every affected region withheld; and
4. preserves all historical facts and audit events.

Removing the canvas is an acceptable UI rollback. Restoring illustrative or raw
coordinates is not.

## 10. Acceptance and Activation Gates

Implementation is complete for this route-closed slice only when tests prove:

- deterministic candidate, review, disclosure, control, and current-state roots;
- two independent accredited human reviews;
- source/actor re-resolution and exact idempotency;
- atomic commit and restart replay;
- expiry and withdrawal without fallback;
- tamper, cross-tenant, direct insert, update, and delete rejection;
- non-empty rollback refusal; and
- unchanged non-claim and no-funds boundaries.

Production activation additionally requires durable source integration, native
PostgreSQL RLS evidence, data-protection impact assessment, protected-species
and community safeguarding review, load/abuse testing, SLOs, alerts, incident
and rollback drills, least-privilege role provisioning, and separate human
governance approval.
