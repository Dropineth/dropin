# RFC: Canonical Organization Accreditation Authority

Status: proposed for route-closed implementation

Date: 2026-07-19

## 1. Problem Statement

CanopyProof currently stores organization accreditation as a compatibility row
containing `status`, `scope`, `decided_by`, and `decided_at`. Authorization
resolvers select the latest row. That model cannot prove:

- when an approval becomes effective or expires;
- which policy and evidence were reviewed;
- that a reviewer and final decider were independent humans;
- that a suspension or revocation has one immutable predecessor;
- that an approval was not silently widened to additional scopes;
- that an expired approval cannot continue authorizing institutional actions;
- that retries, concurrent decisions, and database replay produce one result.

An approval without a bounded validity interval is effectively permanent. That
is not an acceptable authority primitive for UN, government, auditor, research,
or climate-fund workflows.

This RFC adds an immutable, deterministic accreditation authority to the
existing Trust Registry. It does not create a second organization identity
system, mount an HTTP route, migrate current sessions, or activate production
authorization.

## 2. Scope And Non-Goals

This increment will:

- create immutable application, review, decision, and control facts;
- bind sorted scopes, evidence roots, policy root, actor authority, and time;
- require two independent external human authorities for approval;
- derive `pending`, `approved`, `expired`, `suspended`, `revoked`, and `denied`
  projections at an explicit `asOf` time;
- support renewal as a new application over an existing approved, expired, or
  suspended decision;
- require revocation to be terminal for the accreditation stream;
- provide exact idempotency, serializable writes, append-only SQL, forced RLS,
  and TypeScript/PostgreSQL root parity;
- remain route-closed and default-off.

This increment will not:

- send invitations or accreditation notices;
- replace legal, scientific, safeguarding, sanctions, or conflict review;
- backfill compatibility accreditation rows automatically;
- alter active sessions or mounted authorization routes;
- let AI, an Agent identity, or the subject organization approve itself;
- move funds, distribute CANOPY, handle private keys, issue a certified carbon
  credit or tax offset, create a financial asset, or promise yield.

## 3. Trust Model

### 3.1 Participants

The subject organization may submit an application through a verified human
owner or admin with an active subject membership. It cannot review, decide, or
control its own accreditation.

Governance actors must be verified humans in a different, currently verified
organization. Their current membership and approved governance accreditation
must be re-resolved inside the serializable database transaction.

The route-closed repository accepts this re-resolution through an injected
transaction-bound resolver and compares the complete actor/profile/policy
snapshot before replay. PostgreSQL independently rechecks current participant,
organization, membership, role, scope, authority interval, and authority root.
The route-closed canonical resolver and signed root-governance protocol are now
implemented by `RFC_ROOT_GOVERNANCE_BOOTSTRAP_AUTHORITY.md`. No production
ceremony, identity/key provisioning, writer grant, route, or activation has
occurred. A deterministic root fixture remains test-only; the mutable
compatibility accreditation row is never an authority fallback.

Required scopes:

```text
organization:accreditation:review
organization:accreditation:decide
organization:accreditation:govern
```

### 3.2 Separation Of Duties

- the application submitter cannot review or decide;
- the reviewer cannot be the final decider;
- the subject organization cannot supply a governance actor;
- an Agent or AI result can be evidence only and cannot be final authority;
- a control actor cannot be from the subject organization;
- renewal uses a new review and a new decision; prior approval is not copied.

### 3.3 Policy Authority

Every application binds one 64-byte-lowercase-hex `policyRoot`. The current
policy resolver must reproduce that root at review and decision time. A stale or
withdrawn policy makes the command fail closed.

### 3.4 Validity

An approved decision has canonical `validFrom` and `validUntil` timestamps.
The interval must be positive and no longer than 366 days. `validFrom` equals
the final decision timestamp in v1. Expiry is a deterministic projection, not a
mutation or scheduled rewrite.

No authorization consumer may use wall-clock time implicitly. It must pass a
canonical `asOf` value and consume the projection generated for that value.

## 4. Immutable Fact Model

All four fact families share one monotonic organization accreditation sequence
and one semantic-event predecessor root.

### 4.1 Application Fact

```text
applicationId
organizationId
applicationKind: initial | renewal
priorDecisionId/root (renewal only)
profileRoot
scope[]
scopeRoot
evidenceEventRoots[]
evidenceRoot
policyRoot
requestedValidUntil
submitter snapshot
submittedAt
commandHash
applicationHash/root
auditEvent
```

Scopes and evidence roots are sorted, unique, bounded, and non-empty. Renewal
must reference the current decision for the same exact scope. Revoked streams
cannot renew.

### 4.2 Review Fact

```text
reviewId
applicationId/root
decision: accepted | rejected
reasonCode
conflictDisclosure
sourceEventRoots[]
sourceRoot
reviewer snapshot
reviewedAt
reviewHash/root
auditEvent
```

Only one accepted review may be current for an application. A rejected review
cannot authorize a decision. A later retry with changed input is a conflict,
not a correction.

### 4.3 Decision Fact

```text
decisionId
applicationId/root
acceptedReviewId/root
decision: approved | denied
scope[]/scopeRoot
policyRoot
validFrom/validUntil (approved only)
rationale
decider snapshot
decidedAt
decisionHash/root
auditEvent
```

Approval requires the latest accepted review, exact current profile/policy,
the same requested scope, and a different external human decider. Denial has no
validity interval and is terminal for that application.

V1 does not permit the same organization identity to submit another initial
application after denial. Reapplication requires a separately governed
successor-application design so denial cannot be bypassed by resetting the
stream.

### 4.4 Control Fact

```text
controlId
decisionId/root
previousControlId/root
action: suspend | revoke
reasonCode
evidenceEventRoots[]
evidenceRoot
governor snapshot
controlledAt
controlHash/root
auditEvent
```

Control facts form a no-fork predecessor chain over one approved decision.
Revocation is terminal. Suspension stops current authority immediately and
requires a newly reviewed renewal application to restore authority.

## 5. Deterministic Projection

Projection input is `(organizationId, applicationId, asOf)`.

```text
no decision                         -> pending
latest decision denied              -> denied
approved + latest control revoked   -> revoked
approved + latest control suspended -> suspended
approved + asOf >= validUntil       -> expired
approved + validFrom <= asOf        -> approved
approved + asOf < validFrom         -> pending
```

The projection includes exact application, review, decision, control, policy,
scope, actor-authority, and event roots. It exposes no raw registration
document, private contact, credential, signature, coordinate, or secret.

An authorization adapter may consume only `approved`, exact required scope,
and `validFrom <= asOf < validUntil`. It must not fall back to an older approval
after expiry, suspension, revocation, or a newer adverse decision.

## 6. Data Flow

```text
subject owner/admin
  -> resolve current profile, membership and requested scope
  -> append application fact
external accredited reviewer
  -> re-resolve application, profile, policy and reviewer authority
  -> append accepted/rejected review fact
different external accredited decider
  -> re-resolve application, accepted review, profile, policy and authority
  -> append approved/denied decision fact
authorization consumer
  -> load full immutable stream
  -> verify roots and projection at explicit asOf
  -> permit only exact current approved scope
external governor
  -> append suspension/revocation control fact
```

Provider, email, notification, or workflow I/O must occur outside the database
transaction. Only minimized deterministic receipts may enter the fact writer.

## 7. Threat Model

| Threat | Required control |
| --- | --- |
| Subject self-accreditation | Cross-organization human authority at review and decision |
| Reviewer self-approval | Reviewer/decider identity separation |
| Scope widening | Sorted exact scope bound in every application and decision root |
| Permanent approval | Maximum 366-day interval and explicit as-of projection |
| Expired fallback | No older-decision fallback after expiry or adverse control |
| Stale policy | Current policy root re-resolved in the write transaction |
| Stale membership/accreditation | Current actor authority re-resolved under lock |
| Concurrent decision fork | Serializable transaction, advisory stream lock, unique predecessor |
| Retry mutation | Actor/operation/key receipt binds exact request and response roots |
| Fact tampering | SQL recomputes command, fact, Merkle, event, and predecessor roots |
| Cross-tenant read | Forced RLS plus explicit `NOBYPASSRLS` test role |
| Silent correction | Append-only/no-update/no-delete triggers |
| Raw sensitive material | Recursive key and unsafe-claim rejection in TypeScript and SQL |
| AI becomes authority | Human literal in schema and SQL actor predicates |
| Destructive rollback | Rollback refuses while any canonical fact exists |

## 8. API And Service Design

No HTTP route is mounted by this RFC. The route-closed domain API is:

```text
submitApplication(input, subjectActor)
reviewApplication(input, reviewer)
decideApplication(input, decider)
controlDecision(input, governor)
getProjection(organizationId, applicationId, asOf)
getAuthoritySnapshot(organizationId)
verifyAuthoritySnapshot(snapshot)
```

The PostgreSQL repository exposes one commit method per fact family. Every
method requires a bounded idempotency key and resolver callbacks for current
profile, policy, membership, organization, and governance authority.

Status reports must state:

```text
routeMounted: false
schedulerMounted: false
productionActivationEnabled: false
compatibilityAccreditationIsNotCanonical: true
```

## 9. Database Changes

The additive migration creates:

- `organizations.organization_accreditation_application_facts`;
- `organizations.organization_accreditation_review_facts`;
- `organizations.organization_accreditation_decision_facts`;
- `organizations.organization_accreditation_control_facts`.

Each table stores normalized query columns plus the complete immutable fact
JSON. Shared controls include:

- one organization accreditation sequence across all four tables;
- exact semantic-event root and payload binding;
- unique command/fact/root values;
- no-fork application, decision, and control predecessors;
- forced `app.organization_id` RLS;
- update/delete rejection and database mutation audit;
- serializable writer transactions and advisory locks;
- non-empty rollback refusal.

The existing `organizations.accreditations` table and
`organizations.organizations.accreditation_status` remain compatibility data.
This migration neither rewrites nor trusts them as canonical facts and does not
change mounted route behavior.

## 10. Migration Strategy

1. Apply the additive migration twice in a disposable PGlite/PostgreSQL gate.
2. Deploy no route and grant no production writer role.
3. Verify TypeScript/SQL root parity, exact retry, restart replay, forced RLS,
   expiry boundaries, adverse-control projection, and failed-write atomicity.
4. Execute a disposable native PostgreSQL dual-writer and `NOBYPASSRLS` gate.
5. Inventory compatibility accreditations and classify each as accepted,
   rejected, expired, or requiring human remediation.
6. Backfill only through separately approved signed migration facts; never
   synthesize current approval from the mutable status column.
7. Add a read-shadow comparison without affecting authorization.
8. Migrate one consumer only after security, legal, governance, and operations
   approval, then invalidate affected sessions.

Before step 7, governance must separately approve and execute the root-authority
ceremony, provision reviewed public identities and keys, and approve the
canonical resolver's least-privilege production composition. Test fixtures are
not migratable governance evidence.

## 11. Rollback Strategy

Before any canonical fact exists and while no route or consumer is mounted, the
rollback may remove only the four new tables, triggers, policies, indexes, and
helper functions.

If any fact exists, rollback fails closed. Recovery must disable future writes,
preserve facts and audit events, and project adverse/expired state. Canonical
history is never deleted to restore a compatibility status.

## 12. Testing And Acceptance

Required deterministic scenarios:

1. initial application -> accepted review -> distinct approval -> expiry;
2. application without current subject authority rejects;
3. self-review and reviewer-as-decider reject;
4. scope or policy substitution rejects;
5. approval longer than 366 days rejects;
6. suspension immediately removes authority without deleting approval;
7. revocation is terminal;
8. renewal requires a new review and decision and cannot widen scope silently;
9. exact retry returns the original fact and changed retry conflicts;
10. two concurrent decisions cannot fork;
11. SQL/TypeScript roots and as-of projections match;
12. cross-tenant RLS, append-only rows, failed-write atomicity, migration replay,
    and empty/non-empty rollback behave as specified.

Acceptance does not authorize route activation. It proves only a route-closed
institutional authority foundation.
