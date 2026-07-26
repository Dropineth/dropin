# RFC: Canonical Early-Warning Publication Authority

Status: Proposed for route-closed implementation

Date: 2026-07-19

Owners: CanopyProof Trust, Risk, and Governance domains

## 1. Problem Statement

CanopyProof currently exposes a useful compatibility risk service for drought,
wildfire, flooding, and ecosystem-degradation signals. It can derive alerts,
record acknowledgements, describe response playbooks, and model dispatch and
closure receipts. Its state is process-local. A restart loses the authority,
concurrent writers can fork it, and a caller cannot prove that a public alert
was derived from current sources and independently reviewed.

An early-warning statement can alter field operations and public behavior. It
must not be published merely because a model score crossed a threshold. A
canonical authority must preserve the source lineage, distinguish scientific
and operational review, require independent human publication, fail closed
under challenge, and never present an advisory as an emergency declaration.

This RFC defines that authority. It does not connect a live climate feed, send
a notification, declare an emergency, or mount a production route.

## 2. Decision

The canonical unit is one immutable, scope-specific risk-alert publication.
Its authority chain is:

```text
current source and scope authority
             |
             v
       signal candidate
             |
       +-----+-----+
       |           |
 scientific     operational
 human review   human review
       |           |
       +-----+-----+
             |
    independent human publisher
             |
             v
      public advisory projection
             |
       challenge or withdrawal
```

The candidate, two reviews, publication, and control facts are deterministic.
Every accepted write commits its semantic event and idempotency receipt in the
same serializable PostgreSQL transaction.

The existing mounted `/canopyproof/risk/*` API remains a compatibility service
and must report or be documented as non-canonical. It cannot become a source
for institutional reliance without a separately reviewed migration.

## 3. Scope and Terminology

Supported risk classes are:

- `drought`;
- `wildfire`;
- `flooding`;
- `ecosystem_degradation`.

Supported severity levels are `low`, `medium`, `high`, and `critical`.

A scope is one governed project or governed region. Every candidate binds an
internal `organizationId` and `scopeId` plus privacy-reviewed public
identifiers. A current-authority resolver must prove the scope root inside the
same database transaction used to commit the review or publication.

A source member contains only:

- source type;
- opaque source identifier;
- SHA-256 source root;
- observation time;
- received time;
- provenance-policy root.

The authority does not store raw imagery, exact coordinates, contact details,
sensor payloads, model prompts, access tokens, or provider credentials.

## 4. Trust Model

### 4.1 Actors

A candidate preparer may be a verified human with the
`risk:signal:prepare` accreditation scope or a current organization-bound
Dropin agent. The current authority resolver must explicitly authorize the
agent for preparation because the canonical identity snapshot intentionally
does not grant human accreditation records to agents. An agent is advisory and
can never review, publish, challenge-resolve, or withdraw an alert.

Each publication requires three distinct accredited humans:

1. a scientific reviewer with `risk:scientific-review`;
2. an operational reviewer with `risk:operational-review`;
3. a publisher with `risk:publish`.

If the preparer is human, the preparer must also be distinct from all three.
The publisher cannot approve their own review. Current identity,
organization, membership, accreditation, and authority roots are re-resolved
inside the write transaction.

Challenge and withdrawal controls require a verified human with
`risk:govern`. A control actor must be independent of the publisher. A
challenged or withdrawn publication never falls back to an older publication.
A corrected alert requires a new candidate and publication version.

### 4.2 Current Authority

The database repository accepts injected current-authority resolvers. A
resolver receives only immutable identifiers, roots, and the effective time,
plus the active transaction. It must return:

- the exact candidate or control subject;
- current scope authority;
- current source authority;
- current policy authority;
- current actor snapshots.

The repository hashes and compares every returned value against the command.
Process-local fallback is forbidden.

### 4.3 Human Authority

Models and agents may prepare a candidate. They cannot make either review,
publish an advisory, withdraw it, or resolve a challenge. A public projection
exists only after both accepted reviews and independent publication.

## 5. Canonical Data Model

### 5.1 Signal Candidate

A candidate binds:

- schema version;
- organization, internal scope, and public scope identifiers;
- scope type and current scope-authority root;
- risk class, severity, and confidence in integer basis points;
- advisory code and bounded summary;
- sorted, unique intended audiences;
- sorted, unique source members and their Merkle root;
- sorted, unique indicator members and their Merkle root;
- current risk-policy identifier, version, root, and validity interval;
- observation interval and candidate expiry;
- preparer authority snapshot;
- fixed safety boundary;
- deterministic candidate root.

Indicator values are signed safe integers plus an explicit positive scale and
unit. IEEE-754 values are not accepted in the canonical hash surface.

### 5.2 Review Fact

Each review fact binds the complete candidate, review kind, decision,
reviewer authority, controlled reason codes, reviewed time, command hash,
review root, and one semantic audit event. A candidate can have at most one
canonical review command for each review kind. Rejection is terminal for that
candidate.

### 5.3 Publication Fact

A publication binds:

- the complete candidate;
- one accepted scientific review;
- one accepted operational review;
- the independent publisher;
- previous publication root for the same organization, scope, and risk class;
- publication and validity times;
- a minimized public projection;
- command hash, publication root, and semantic audit event.

The public projection contains public identifiers, risk class, severity,
confidence band, advisory code and summary, audience classes, observation and
validity intervals, aggregate source and indicator roots, review roots,
publication root, and safety disclosure. It excludes internal actor, source,
project, device, contributor, and evidence identifiers.

### 5.4 Control Fact

Supported controls are `challenge` and `withdraw`. A control binds the target
publication, independent human governor, controlled reason code, event time,
command hash, control root, and semantic audit event.

There is no mutable resolution that reactivates the same publication. A new
reviewed version is the sole recovery path.

### 5.5 Current Projection

For one organization, scope, and risk class, the current projection is:

- `active` when the latest publication is within its validity interval and has
  no challenge or withdrawal;
- `challenged` after its first challenge;
- `withdrawn` after withdrawal;
- `expired` when the query time exceeds `validUntil`;
- absent when no publication exists.

Adverse states return the affected latest version and never fall back.

## 6. Deterministic Roots

All collections are sorted and duplicate-free before hashing. Roots use
canonical JSON and SHA-256 through `@dropin/crypto` in TypeScript and
`audit.hash_canonical_json` in PostgreSQL.

Root domains are versioned and distinct:

- source-member root;
- indicator-member root;
- source-authority root;
- candidate command hash and candidate root;
- review command hash and review root;
- public-projection root;
- publication command hash and publication root;
- control command hash and control root.

The SQL migration recomputes every accepted root. A root supplied by a client
is never trusted by comparison alone.

## 7. Command and API Design

The route-closed library exports commands to:

- build and verify a candidate;
- build and verify scientific and operational reviews;
- build and verify a publication;
- build and verify a control;
- resolve a deterministic current projection;
- commit each fact through PostgreSQL with an exact idempotency key;
- query the current projection under tenant context.

Repository status is fixed to:

```text
routeMounted=false
schedulerMounted=false
productionActivationEnabled=false
liveFeedEnabled=false
notificationDeliveryEnabled=false
emergencyDeclarationEnabled=false
```

No HTTP route is introduced by this implementation. A future route must use
the canonical repository, preserve the existing API/Worker separation, and
pass independent security, privacy, safeguarding, accessibility, legal,
operations, and governance review.

## 8. Database Changes

The migration adds append-only tables under the existing `impact` schema:

- `impact.early_warning_review_facts`;
- `impact.early_warning_publication_facts`;
- `impact.early_warning_control_facts`.

Each table stores indexed identifiers and roots plus the complete canonical
JSON fact and audit-event root. Database triggers enforce:

- exact document shape and fixed safety values;
- SQL/TypeScript root parity;
- accepted scientific and operational reviews before publication;
- human role and accreditation-scope separation;
- predecessor continuity and no publication forks;
- control actor independence;
- matching semantic event in `audit.domain_events`;
- immutable rows;
- organization-scoped forced row-level security.

Commands use existing `audit.command_receipts`. The receipt, event, and fact
commit atomically at `SERIALIZABLE` isolation with transaction-scoped advisory
locks.

## 9. Threat Model

| Threat | Required control |
| --- | --- |
| Agent self-approves alert | Human-only reviews and publication; database trigger repeats check |
| Reviewer-role substitution | Exact review kind and accreditation scope bound into review root |
| Same human occupies two roles | TypeScript, resolver, and SQL identity-separation checks |
| Stale source or policy | Current authority re-resolved inside serializable transaction |
| Signal collection reorder | Canonical sort, uniqueness, and member roots |
| Floating-point replay drift | Integer scaled values and integer confidence basis points |
| Duplicate or forked publication | Exact receipts, predecessor constraint, stream advisory lock |
| Cross-tenant read/write | Transaction context plus forced RLS |
| Direct SQL fact insertion | Root, authority, predecessor, review, and semantic-event triggers |
| Challenge hidden by older alert | Latest-version adverse projection with no fallback |
| Raw location or contact disclosure | Strict schemas and recursive forbidden-field/text checks |
| Automated emergency declaration | Fixed advisory-only safety contract and forbidden claim text |
| Notification side effect in transaction | No notification port or route in this authority |
| Partial database failure | One serializable transaction for event, fact, and receipt |

## 10. Migration Strategy

1. Apply the base CanopyProof OS schema.
2. Apply this idempotent migration in a disposable database.
3. Run TypeScript/SQL root-parity, replay, tamper, RLS, and rollback tests.
4. Run the same tests with a `NOBYPASSRLS` application role against native
   PostgreSQL and two concurrent connections.
5. Build a durable source adapter for project/region, source, policy, and actor
   authority. No memory fallback is permitted.
6. Perform privacy, safeguarding, scientific, emergency-management, legal,
   accessibility, security, observability, backup/restore, and on-call review.
7. Migrate compatibility data only through an explicit evidence-backed review;
   process-local rows are not canonical by default.
8. Open a route only in a separate human-approved activation change.

## 11. Rollback Strategy

The rollback is fail closed:

- it refuses to run when any early-warning authority fact exists;
- it removes only empty tables, policies, triggers, and helper functions;
- it does not delete audit events or command receipts;
- it never converts compatibility records into canonical facts.

After facts exist, recovery is forward-only through a corrective migration.

## 12. Verification Gates

Before route activation, evidence must prove:

- deterministic replay for candidate, reviews, publication, projection, and
  controls;
- scientific/operational/publisher independence;
- machine-authority denial;
- stale source, stale scope, stale policy, and stale identity rejection;
- exact retry and conflicting retry rejection;
- no-fork publication under concurrent writers;
- forced-RLS cross-tenant denial with a non-bypass native role;
- direct insert, update, delete, and missing-event rejection;
- restart replay and SQL/TypeScript root parity;
- challenge, withdrawal, and expiry without fallback;
- empty rollback success and non-empty rollback refusal;
- no live feed, notification, scheduler, or emergency side effect.

## 13. Fixed Safety Boundary

The canonical authority is an environmental risk advisory ledger only:

- no emergency declaration;
- no automated public warning or notification delivery;
- no guarantee of safety or forecast accuracy;
- no raw coordinates or personal contact data;
- no mainnet funds;
- no automatic CANOPY distribution;
- no private-key handling;
- no certified carbon-credit claim;
- no carbon-tax offset claim;
- no financial asset or ownership right;
- no guaranteed yield;
- no admin proxy;
- no production activation in this change.
