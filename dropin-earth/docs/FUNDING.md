# CanopyProof Funding Transparency Layer

Status: compatibility API mounted; canonical authority implemented and route-closed

CanopyProof records open-government style accountability for funding sources,
project allocations, milestones, evidence, and Environmental Proof Record
lineage. Neither implementation is a payment rail and neither moves funds.

## Fixed Boundaries

- No mainnet funds are moved by `/canopyproof/funding/*` or the canonical authority.
- No automatic CANOPY distribution is created.
- No certified carbon credit or carbon-tax offset is issued or claimed.
- No financial asset, ownership right, RWA, or guaranteed yield is created.
- No wallet, bank account, payment token, private key, or donor contact data is accepted.
- API and web Workers remain separate from production deployment boundaries.

## Canonical Authority

The route-closed authority in
`services/api/src/domain/canopyproof/funding-accountability-authority.ts`
builds one immutable project-scoped candidate from:

- current project, funding-source, policy, evidence, and proof-record roots;
- one commitment and allocation represented only as safe integer cents;
- one to 128 sorted milestone summaries;
- exact reconciled and challenged totals; and
- a bounded reporting and validity interval.

Publication requires three different verified, active, accredited humans:

1. a preparer with `funding:accountability_prepare`;
2. an independent reconciliation reviewer with `funding:accountability_review`;
3. an independent publisher with `funding:accountability_publish`.

An independent governor with `funding:accountability_control` may append a
`challenge` or `withdraw` fact. Challenge removes reconciled operational totals;
withdrawal makes every operational total zero. Expiry is projected from the
immutable validity interval. None of these states falls back to an older
publication.

## Durable Contract

`funding-accountability-authority.sql` adds three append-only tables:

- `funding.accountability_review_facts`;
- `funding.accountability_publication_facts`;
- `funding.accountability_control_facts`.

Every repository write runs in a serializable transaction, sets organization
and actor context, acquires command and semantic-stream advisory locks,
re-resolves current authority through a transaction-owned callback, requires an
exact idempotency receipt, appends one semantic event and one fact, and reads the
result back through deterministic replay. SQL independently recomputes the
candidate, milestone, review, public projection, publication, and control roots.
All three tables enable and force tenant RLS and reject update or delete.

The rollback migration removes only an empty authority. Once any canonical fact
exists, destructive rollback aborts and operations must append challenge or
withdrawal facts instead.

## Compatibility API

The currently mounted routes remain process-local compatibility surfaces and
must not be treated as canonical institutional records:

```text
GET   /canopyproof/funding/status
POST  /canopyproof/funding/sources
GET   /canopyproof/funding/sources
GET   /canopyproof/funding/sources/:sourceId
POST  /canopyproof/funding/allocations
GET   /canopyproof/funding/allocations
GET   /canopyproof/funding/allocations/:allocationId
POST  /canopyproof/funding/milestones
GET   /canopyproof/funding/milestones
GET   /canopyproof/funding/milestones/:milestoneId
POST  /canopyproof/funding/milestones/:milestoneId/evidence
PATCH /canopyproof/funding/milestones/:milestoneId
GET   /canopyproof/funding/ledger
GET   /canopyproof/funding/ledger/:projectId
```

The compatibility service can reference existing Dropin allocation IDs for
lineage, but it does not inherit payment authority and is not a source for the
canonical repository.

## Verification Evidence

- Unit tests cover deterministic roots, integer-cent conservation, sorted and
  unique members, independent actors, unsafe-key rejection, challenge,
  withdrawal, expiry, and no-fallback behavior.
- PGlite applies the additive migration twice and executes the real repository,
  trigger, exact-retry, restart, current-authority rejection, SQL/TypeScript
  root parity, row audit, forced-RLS catalog, direct mutation, missing-event,
  cross-tenant query, empty rollback, and non-empty rollback scenarios.

PGlite is not proof of non-bypass RLS. Production activation remains blocked
until a disposable native PostgreSQL gate proves a `NOBYPASSRLS` role and
concurrent writers, and until the durable source adapter, institutional funding
policy, privacy, sanctions, legal, accounting, accessibility, observability,
backup/restore, and separate human-approved activation reviews are complete.
