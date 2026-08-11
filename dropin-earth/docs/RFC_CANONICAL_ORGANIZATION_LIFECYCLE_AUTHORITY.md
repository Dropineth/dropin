# RFC: Canonical Organization Lifecycle And Appeal Authority

Status: DRAFT - NON-PRODUCTION

Version: 0.1

Date: 2026-07-19

## 1. Problem Statement

CanopyProof currently persists organization profiles, verification documents,
memberships, accreditations, command receipts, and semantic audit events in the
Trust Registry. The compatibility verification command also updates
`organizations.organizations.verification_status` in place. That row is useful
as a read model, but it is not sufficient as an institutional verification
authority because it cannot independently prove every transition, reviewer
eligibility, separation of duties, or appeal outcome.

The missing authority must support the complete lifecycle:

```text
PENDING -> DOCUMENT_REVIEW -> VERIFIED -> SUSPENDED -> REVOKED
```

It must also support governed appeals without rewriting the action under
appeal. Suspension may be reversed only through a successful appeal followed
by a separate reinstatement transition. Revocation is terminal for the
organization identity; even a successful procedural appeal requires a new
identity and does not reactivate the revoked identifier.

This RFC defines an additive authority inside the existing Trust Registry. It
does not create a second organization registry, mount a route, migrate live
traffic, or activate production behavior.

## 2. Trust Model

### 2.1 Authorities

The canonical authority consists of four append-only fact streams:

1. `organization_lifecycle_facts` records the genesis anchor and every state
   transition.
2. `organization_document_review_facts` records independent review of the
   profile and exact document commitments used for verification.
3. `organization_appeal_facts` records an appeal against one suspension or
   revocation fact.
4. `organization_appeal_decision_facts` records ordered, immutable appeal
   decisions.

The existing `organizations.organizations` row remains the profile and
compatibility projection. Its status is not accepted as canonical once a
lifecycle genesis fact exists. Canonical status is always replayed from the
lifecycle facts.

### 2.2 Actor Classes

Subject-organization actors may:

- anchor a registered organization in `PENDING`;
- submit document commitments for `DOCUMENT_REVIEW`; and
- open an appeal against a suspension or revocation.

They must be verified human `owner` or `admin` members of the subject
organization. A pending organization may perform these bounded onboarding
actions; it does not gain general verified-organization authority.

Governance-organization actors may:

- review organization documents;
- make verification decisions;
- suspend or revoke an organization;
- review an appeal; and
- authorize reinstatement after an upheld suspension appeal.

They must be verified humans in a different, currently verified organization,
with active membership, current approved accreditation, and the exact required
scope. Organization type alone grants no authority.

Required scopes are:

```text
organization:lifecycle:review
organization:lifecycle:decide
organization:lifecycle:govern
organization:appeal:review
organization:appeal:resolve
```

Agents may prepare advisory material but cannot create any canonical fact in
this authority. AI cannot review, decide, suspend, revoke, resolve an appeal,
or reinstate an organization.

### 2.3 Separation Of Duties

- A subject actor cannot review or decide the subject organization's status.
- A document reviewer cannot make the final `VERIFIED` transition.
- A suspension or revocation governor cannot review the resulting appeal.
- An appeal reviewer cannot make the final reinstatement transition.
- An appeal submitter cannot review or resolve the appeal.
- All final authority is human and current authority is re-resolved inside the
  serializable database transaction.

### 2.4 Determinism

Every fact binds:

- canonical UTC timestamp;
- subject organization and profile root;
- sorted, unique source roots;
- actor authority snapshot and authority root;
- command hash;
- stream sequence and previous event root;
- fact root; and
- semantic audit event root.

The same canonical inputs produce the same fact ID, command hash, fact root,
and audit root. Exact retries return the committed fact. Reusing an idempotency
key with a different request fails closed.

### 2.5 Safety Boundary

This authority performs institutional identity governance only. It does not:

- issue a certified carbon credit;
- create a carbon-tax offset;
- create an ownership or financial asset;
- guarantee yield;
- move mainnet funds;
- distribute CANOPY automatically;
- handle private keys;
- authorize evidence or certificate issuance by itself; or
- mount a public route or scheduler.

## 3. State And Data Flow

### 3.1 Genesis And Document Review

```text
registered organization profile
  -> subject owner/admin resolves current profile and document roots
  -> PENDING genesis lifecycle fact
  -> subject owner/admin submits exact document roots
  -> DOCUMENT_REVIEW lifecycle fact
  -> independent governance reviewer records review fact
  -> independent governance decider records VERIFIED transition
```

`DOCUMENT_REVIEW -> VERIFIED` requires the latest accepted document review for
the current lifecycle fact, exact profile/document roots, and a hash-only
`registrationReferenceRoot` deterministically derived from the current
registration number. PostgreSQL recalculates that reference at review and
verification-decision time; the raw registration number is not copied into the
fact. A rejected, stale, or registration-drifted review cannot be used.

### 3.2 Suspension And Revocation

```text
VERIFIED
  -> independent governor + evidence roots -> SUSPENDED
  -> independent governor + evidence roots -> REVOKED
```

Direct `VERIFIED -> REVOKED` is allowed only for a documented severe governance
or legal reason. `PENDING` and `DOCUMENT_REVIEW` may be revoked for fraudulent
or invalid registration, but they cannot be suspended because no verified
authority has been granted yet.

`SUSPENDED` and `REVOKED` immediately deny protected authorization in the
canonical resolver. Compatibility session invalidation is a separate runtime
integration and remains blocked until that integration is reviewed.

### 3.3 Appeals

```text
SUSPENDED or REVOKED lifecycle fact
  -> subject owner/admin opens appeal
  -> independent governance reviewer records decision
     -> needs_more_evidence: appeal remains unresolved
     -> denied: challenged action remains authoritative
     -> upheld:
          SUSPENDED -> separate resolver may authorize VERIFIED reinstatement
          REVOKED   -> new_identity_required; original identity remains revoked
```

Appeal decisions form their own predecessor chain. A final decision cannot be
rewritten. New material requires a new appeal or a new ordered decision only
where the prior decision explicitly requested more evidence.

### 3.4 Canonical Projection

The projection is derived from immutable facts and contains:

```text
organization_id
current_status
current_trust_level
latest_lifecycle_fact_id
latest_lifecycle_root
latest_profile_root
open_appeal_ids
terminal_revocation
projection_root
```

The projection is never trusted without replay validation. The mutable profile
row may be updated transactionally as a compatibility mirror, but a mismatch
between mirror and replay is an integrity failure, not a reason to fall back to
the mirror.

## 4. Threat Model

### 4.1 In-Scope Threats

| Threat | Required control |
| --- | --- |
| Subject self-verifies | Cross-organization reviewer and decider checks |
| Reviewer also decides | Actor-ID separation enforced in domain and SQL |
| Stale accreditation | Current authority re-resolution in the write transaction |
| Status rewritten | Append-only facts plus no-update/no-delete triggers |
| Stream fork | Advisory lock, predecessor root, unique sequence and predecessor constraints |
| Idempotency substitution | Exact request and response hashes in command receipt |
| Document substitution | Sorted document roots bound into review and transition roots |
| Appeal erases sanction | Appeal facts reference but never mutate challenged fact |
| Governor judges own action | Original governor excluded from appeal review |
| Revoked identity reactivated | Terminal transition rule in domain and SQL |
| Cross-tenant read/write | Forced RLS on subject organization ID |
| Database-only forged fact | SQL recomputes roots, actor authority, event chain, and transitions |
| Machine final authority | Human-only actor checks in domain and SQL |
| Raw secret or contact leakage | Minimized schemas and forbidden-key validation |
| Unsafe public claim | Canonical safety object and text-policy checks |

### 4.2 Out Of Scope For This Increment

- document malware scanning and object-storage access policy;
- external registry or sanctions-list lookup;
- invitation delivery and session invalidation;
- legal data-processing agreements;
- public partner profile publication;
- UI workflow;
- production route activation; and
- migration of existing compatibility history into legal evidence without
  institutional review.

## 5. API And Service Design

No HTTP route is mounted by this RFC. The domain service exposes pure,
deterministic operations:

```text
anchorOrganization(input, subjectActor)
submitDocumentReview(input, reviewer)
transitionOrganization(input, actor, acceptedReview?, appealDecision?)
openAppeal(input, subjectActor)
decideAppeal(input, reviewer)
resolveProjection(organizationId)
verifyFact(fact)
getAuthoritySnapshot()
fromAuthoritySnapshot(snapshot)
```

The PostgreSQL repository exposes equivalent commit methods with:

- required idempotency key;
- current-authority resolver callback;
- `SERIALIZABLE` transaction;
- advisory transaction locks;
- append-only semantic event insertion;
- exact command receipt insertion; and
- compatibility-mirror update only after the canonical fact is accepted.

Repository status must explicitly report:

```text
routeMounted: false
schedulerMounted: false
productionActivationEnabled: false
appendOnly: true
forcedRowLevelSecurity: true
serializableWrites: true
exactRetryRequired: true
currentAuthorityReResolved: true
independentHumanAuthorityRequired: true
revocationTerminal: true
```

## 6. Database Changes

The additive migration creates:

### 6.1 `organizations.organization_lifecycle_facts`

- immutable lifecycle fact JSON;
- subject and governance organization IDs;
- from/to status and resulting trust level;
- current profile root and sorted source roots;
- optional accepted review and upheld appeal-decision references;
- actor snapshot;
- sequence, predecessor, command hash, lifecycle root, and audit root.

Constraints prevent duplicate sequence numbers, predecessor forks, nonterminal
transitions after revocation, and use of an invalid review or appeal decision.

### 6.2 `organizations.organization_document_review_facts`

- immutable review JSON;
- exact current lifecycle/profile/document roots;
- a nullable hash-only registration reference, required for acceptance and
  recomputed from the current organization row by PostgreSQL;
- accepted or rejected decision;
- reviewer snapshot and conflict disclosure;
- ordered review sequence and predecessor;
- review and audit roots.

### 6.3 `organizations.organization_appeal_facts`

- immutable appeal JSON;
- challenged suspension or revocation lifecycle root;
- submitter snapshot;
- grounds and evidence roots;
- appeal and audit roots.

Only one open appeal may exist for one challenged lifecycle fact.

### 6.4 `organizations.organization_appeal_decision_facts`

- immutable ordered decision JSON;
- decision: `upheld`, `denied`, or `needs_more_evidence`;
- remedy: `none`, `reinstate`, or `new_identity_required`;
- reviewer snapshot and conflict disclosure;
- decision and audit roots.

An upheld suspended appeal requires `reinstate`; an upheld revoked appeal
requires `new_identity_required`.

### 6.5 Shared Controls

Each table receives:

- forced row-level security keyed by `app.organization_id`;
- no-update and no-delete triggers;
- row-mutation audit trigger;
- pre-insert validation trigger;
- stream and lookup indexes; and
- foreign keys into the existing organization, participant, audit, and fact
  tables.

The existing `audit.command_receipts` and `audit.domain_events` tables remain
the sole command and semantic-event authorities.

## 7. Migration Strategy

1. Apply this additive migration after `canopyproof-os.sql`.
2. Verify functions, triggers, forced RLS, indexes, and rollback in an isolated
   PostgreSQL-compatible test database.
3. Create genesis facts only from explicitly reviewed current organization
   profiles. Do not infer legal verification history from the mutable status.
4. For a currently `verified`, `suspended`, or `revoked` compatibility row,
   require a migration evidence bundle and governance approval before anchoring
   that state. The first implementation deliberately supports only safe
   `PENDING` genesis; legacy-state import remains a separate governed migration.
5. Compare replayed canonical projection to the compatibility row in shadow
   mode. Any mismatch blocks activation.
6. Add route integration only under a separate RFC, security review, and
   operator-controlled production gate.
7. Keep the compatibility verification endpoint clearly marked noncanonical
   until traffic has migrated. It must never be used to assert canonical
   institutional status after activation.

No automatic backfill, session invalidation, route switch, or production
activation is part of this increment.

## 8. Rollback Strategy

Before route activation, rollback may remove only the new route-closed
authority objects:

1. verify that no route, scheduler, or production process references them;
2. export fact and audit roots for test evidence;
3. drop RLS policies and authority triggers;
4. drop the four new tables in dependency order;
5. drop only functions introduced by this migration; and
6. leave existing organization profiles, documents, memberships,
   accreditations, domain events, and command receipts untouched.

After any production activation, destructive rollback is forbidden. The
operational rollback is to disable new writes, preserve all facts, restore the
last verified reader, and append a governance incident record. Historical
facts are never deleted or rewritten.

## 9. Acceptance Criteria

- Lifecycle replay is deterministic and rejects forks, gaps, stale roots, and
  invalid transitions.
- `VERIFIED` requires an accepted independent document review, a current
  registration reference, and a different independent human decider.
- High-authority actions require current cross-organization accreditation.
- Suspension appeals cannot be reviewed by the original governor.
- Reinstatement requires an upheld appeal and a separate resolver.
- Revocation is terminal for the organization ID.
- Domain and PostgreSQL constraints reject equivalent forged inputs.
- Exact retries return the original fact; conflicting retries fail closed.
- Forced RLS, append-only triggers, rollback, and deterministic replay are
  covered by tests.
- No route, scheduler, production flag, funds, token distribution, private-key
  path, or environmental/financial claim is enabled.
