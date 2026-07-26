# RFC: CanopyProof Trust Layer

Status: draft implementation baseline

## 1. Problem Statement

CanopyProof must be credible to UN agencies, ESG auditors, climate funds,
NGOs, governments, and research institutions. Credibility cannot come from UI
copy or unverifiable impact claims. It must come from an institutional trust
layer where identity, evidence, verification, audit, and governance are explicit
systems with reproducible lineage.

The trust layer must ensure that no environmental proof, ESG report, partner
claim, funding milestone, or public risk release becomes final without:

- authenticated accountable actors.
- immutable evidence records.
- deterministic validation and advisory AI.
- human or governance review.
- append-only audit events.
- bounded public claim language.

CanopyProof proof records remain environmental accountability records. They are
not certified carbon credits, financial assets, tax offsets, automatic CANOPY
distribution promises, or guaranteed-yield instruments.

## 2. Trust Model

The trust model is event-first:

```text
Identity Event
  -> Evidence Event
  -> Verification Event
  -> Human Review Event
  -> Governance Event
  -> Public Record Event
```

Core identities:

- `Human`: community members, field workers, reviewers, auditors, researchers,
  government users, and UN partner users.
- `Organization`: UN agencies, NGOs, governments, universities, research
  institutions, auditors, climate funds, community organizations, and corporate
  sustainability teams.
- `Agent`: CanopyProof and Dropin agents that assert, reason, delegate, fulfill,
  or challenge but cannot become final authority.
- `Device`: field devices, sensor gateways, mobile clients, and trusted capture
  kits that contribute evidence.
- `Project`: restoration, biodiversity, water, soil, and climate projects whose
  public state depends on evidence and review.

Roles:

- Community Member.
- Field Worker.
- NGO.
- Researcher.
- Verifier.
- Auditor.
- Investor.
- Government.
- UN Partner.
- Administrator.

The default rule is least privilege. Mutations require an authenticated actor,
an authorized role, and an audit event. AI can propose, score, and flag risk,
but cannot approve itself or issue final proof.

## 3. Data Flow

Evidence submission:

```text
Authenticated actor
  -> identity and role check
  -> evidence envelope validation
  -> device / consent / metadata checks
  -> immutable evidence event
  -> verification work queue
  -> rules engine
  -> advisory AI
  -> TerraProof / external evidence cross-check
  -> human review
  -> governance approval
  -> Environmental Proof Record
```

Institution onboarding:

```text
Organization registration
  -> document capture
  -> document review
  -> verification status transition
  -> trust level assignment
  -> member authorization
  -> accreditation / data sharing agreement
  -> partner access to evidence, reports, and audit views
```

Every state transition creates an `AuditEvent` with actor, action, target,
previous state, new state, timestamp, rationale, and hash/signature material.

## 4. Threat Model

Primary threats:

- fake evidence or copied media.
- GPS spoofing and metadata tampering.
- duplicate planting or duplicate impact claims.
- compromised devices or forged device attestations.
- unauthorized verifier or reviewer escalation.
- fake organization onboarding.
- certificate manipulation or deletion attempts.
- report access outside authorized scope.
- audit tampering, deletion, or replay without detection.
- unsafe public claims such as certified carbon credits, tax offsets, automatic
  token distribution, or guaranteed yield.

Required controls:

- RBAC and policy checks before every mutation.
- strict evidence schema validation.
- content-addressed media and metadata hashes.
- device, consent, and extraction provenance.
- duplicate and contradiction detection.
- append-only audit history and hash roots.
- human review required before final proof.
- governance approval for public institutional records.
- privacy filtering for public explorer surfaces.

## 5. API Design

Trust-layer APIs are grouped by bounded context:

```text
POST /canopyproof/organizations
GET  /canopyproof/organizations
GET  /canopyproof/organizations/:id
POST /canopyproof/organizations/:id/verification
POST /canopyproof/organizations/:id/memberships
GET  /canopyproof/organizations/:id/memberships
PATCH /canopyproof/organizations/:id/memberships/:membershipId
POST /canopyproof/organizations/:id/accreditations
GET  /canopyproof/organizations/:id/accreditations
POST /canopyproof/organizations/:id/data-sharing-agreements
GET  /canopyproof/organizations/:id/data-sharing-agreements

POST /canopyproof/evidence
GET  /canopyproof/evidence
GET  /canopyproof/evidence/:id
POST /canopyproof/evidence/:id/ai-analysis
POST /canopyproof/evidence/:id/community-attestations

GET  /canopyproof/verification/queue/status
POST /canopyproof/verification/queue/pipelines
POST /canopyproof/verification/queue/work-items
GET  /canopyproof/verification/queue/work-items
POST /canopyproof/verification/queue/work-items/:workItemId/start
POST /canopyproof/verification/queue/work-items/:workItemId/complete
POST /canopyproof/verification/queue/work-items/:workItemId/block
GET  /canopyproof/verification/decisions/status
POST /canopyproof/verification/decisions
GET  /canopyproof/verification/decisions
GET  /canopyproof/verification/decisions/:decisionId
GET  /canopyproof/verification/challenge-cases/status
POST /canopyproof/verification/challenge-cases
GET  /canopyproof/verification/challenge-cases
GET  /canopyproof/verification/challenge-cases/:challengeCaseId
POST /canopyproof/verification/challenge-cases/:challengeCaseId/resolve
GET  /canopyproof/certificates/transparency/status
POST /canopyproof/proof-records/:recordId/certificate/transparency
GET  /canopyproof/certificates/transparency/entries
GET  /canopyproof/certificates/transparency/entries/:entryId
POST /canopyproof/certificates/transparency/verify

POST /canopyproof/governance/approvals
GET  /canopyproof/governance/approvals
POST /canopyproof/governance/conflict-disclosures
GET  /canopyproof/governance/conflict-disclosures

POST /canopyproof/data-access-accountability-packets/:packetId/disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/status
GET  /canopyproof/public-accountability/data-access-disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId
POST /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
POST /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
GET  /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
POST /canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId/notices
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/notices
```

All mutating APIs require:

- a verified request subject and exactly one recognized signed role in
  production.
- role and organization-scope authorization.
- audit event creation bound to the verified subject.

Raw actor headers are restricted to explicit local/test compatibility mode and
cannot establish production identity.

Read APIs must avoid exposing personal data on public or observer surfaces.

Partner accountability publication follows a stricter flow:

```text
hash-only accountability packet
  -> replay by an independent verifier
  -> publication by a distinct owner/admin actor
  -> append-only disclosure root
  -> bounded unauthenticated public index with current/stale replay state
```

The generator, verifier, and publisher must be three different actors. Public
reads expose no governed dataset, evidence media, precise location, private
contact, or access token.

Public disclosure disputes follow an immutable corrective flow:

```text
authenticated human challenge + evidence roots
  -> independent owner/admin/verifier review
  -> needs-more-evidence follow-up OR immutable final decision
  -> append-only correction linked to a current replacement disclosure
     OR append-only withdrawal/non-reliance notice
  -> original disclosure and every decision remain public
```

Agent actors cannot resolve challenges or publish corrective notices. Database
triggers enforce actor separation, chronology, resolution chaining, finality,
and notice/remedial-action matching independently from the API.

## 6. Database Changes

Production PostgreSQL schemas:

- `identity`: participants, devices, identity status, reputation, and account
  linkage.
- `organizations`: institution registry, memberships, accreditations,
  verification documents, data-sharing agreements, governed access lineage,
  accountability packets, replay verifications, and public disclosure roots.
- `projects`: project lifecycle, baselines, intervention plans, monitoring
  plans, and verification status.
- `evidence`: immutable evidence objects, media objects, consent receipts,
  device attestations, metadata extractions, review tasks, retention decisions,
  offline sync batches, and community attestations.
- `verification`: validation runs, AI analyses, work items, human reviews,
  quality scorecards, human decision dossiers, and challenge cases.
- `certificates`: Environmental Proof Records and public proof challenges.
- `satellite`: TerraProof providers, scenes, layers, and connector runs.
- `impact`: metrics, observations, and monitored indicators.
- `funding`: sources, allocations, milestones, and evidence links.
- `governance`: policies, approvals, conflict disclosures, council decisions,
  and votes.
- `audit`: event log, abuse signals, resilience drills, and hash-chain exports.

Required database properties:

- append-only audit log.
- no silent deletes for evidence, verification, certificate, organization, or
  audit lineage.
- indexes on actor, project, organization, evidence, status, timestamp, and
  hash roots.
- reversible migrations where table creation and trigger addition can be rolled
  back without data loss in non-production environments.

## 7. Migration Strategy

Migrations must be safe and incremental:

1. Add schemas and tables without removing existing columns or routes.
2. Add indexes concurrently where the target database supports it.
3. Add triggers after tables exist and before production writes depend on them.
4. Backfill deterministic roots from existing records in read-only batches.
5. Enable API writes behind existing RBAC and test gates.
6. Run unit, integration, security, OpenNext, and audit checks before promotion.

For the current in-memory compatibility layer, domain types and tests must mirror
the SQL contract so later repository adapters can persist the same state without
changing API semantics.

## 8. Rollback Strategy

Rollback must preserve trust evidence:

- Never delete audit events as part of rollback.
- Disable new writes by feature flag or route gate before reverting storage.
- Preserve existing evidence, organization, verification, and proof records in
  read-only mode.
- If a migration fails after audit writes but before domain state completes,
  mark the operation recoverable and require an idempotency key for retry.
- If a new trust-layer route misbehaves, roll back route exposure while keeping
  append-only records available for investigation.
- Do not roll back by enabling unsafe claims, bypassing human review, exposing
  admin proxy routes, or changing production deployment guardrails.

## Database Audit Transparency Extension

Status: accepted design for incremental implementation. This extension hardens
the generic PostgreSQL mutation log; it does not replace domain audit events or
authorize a claim, proof, payment, or governance decision.

### Problem Statement

The application audit format already binds actor, action, payload hash,
timestamp, rationale, and previous root. The generic SQL trigger currently
looks up the prior mutation for one row without serializing concurrent writers,
does not assign a monotonic sequence, omits actor and timestamp from its event
hash, and copies complete row images into the audit table. Those properties can
produce competing successors under concurrency and can unnecessarily duplicate
restricted fields in the audit schema.

### Trust Model

- Domain audit events remain the semantic record of why an action occurred.
- Database mutation events independently prove what persisted.
- A mutation stream is scoped by `schema.table:row_pk_hash`; unrelated records do
  not contend on one global lock.
- PostgreSQL assigns one strictly increasing sequence per stream while holding
  a transaction-scoped advisory lock.
- The event hash binds version, stream key, sequence, operation, actor,
  microsecond timestamp, previous event hash, and before/after state hashes.
- Raw row snapshots are not copied into the v2 transparency stream. Restricted
  source rows remain protected by their owning schema and access policy.
- Checkpoints are append-only summaries of a contiguous stream interval. They
  do not make the underlying event valid and cannot repair a broken chain.
- Independent clients recompute every event and checkpoint hash; the database
  is not trusted merely because it returned `valid=true`.

### Data Flow

```text
authenticated transaction
  -> SET LOCAL app.actor_id
  -> domain row mutation
  -> AFTER trigger
  -> advisory lock(stream key)
  -> read terminal event FOR UPDATE
  -> hash before/after row documents
  -> append sequence + chained event hash
  -> optional contiguous checkpoint
  -> independent TypeScript replay
  -> observer-safe verification result
```

### Threat Model

The design must detect or prevent:

- two concurrent mutations claiming the same predecessor or sequence.
- event removal, reordering, duplication, field modification, or stream
  substitution.
- actor substitution and timestamp modification after insertion.
- a checkpoint that skips, duplicates, or mixes stream events.
- audit-table update or deletion through normal application credentials.
- leakage of private keys, raw evidence, personal contact data, or precise
  restricted locations into the transparency ledger or verification response.
- an AI or agent treating a valid database chain as final proof authority.

The design does not protect against a fully compromised PostgreSQL superuser
rewriting both data and all external checkpoint copies. Production operations
must export checkpoint roots to independently controlled, immutable storage.

### API Design

`POST /canopyproof/audit/database-streams/verify` accepts one bounded,
single-stream sequence of hash-only v2 mutation entries and an optional
checkpoint. It returns deterministic issue codes, first/terminal hashes,
recomputed checkpoint information, and explicit safety boundaries. The route
requires an authenticated institutional reader; Agent actors cannot invoke it.
It performs no database mutation and creates no attestation automatically.

The verifier rejects oversized input, mixed streams, gaps, duplicate sequence
numbers or event hashes, invalid genesis/previous links, malformed SHA-256
values, non-monotonic timestamps, mismatched event hashes, and invalid
checkpoint coverage.

### Database Changes

- Replace raw `before_state` and `after_state` copies in the target v2 contract
  with `before_state_hash` and `after_state_hash`.
- Add `event_version`, `stream_key`, `sequence_no`,
  `recorded_at_unix_micros`, and uniqueness over `(stream_key, sequence_no)` and
  `(stream_key, event_hash)`.
- Use a length-prefixed canonical hash material shared by PL/pgSQL and the
  independent verifier.
- Serialize sequence allocation with
  `pg_advisory_xact_lock(hashtextextended(...))` and lock the current terminal
  row before appending.
- Add append-only `audit.event_log_checkpoints` rows covering one non-empty,
  contiguous range with first/terminal event hashes, event-root aggregate,
  checkpoint hash, creator, and timestamp.
- Add indexes for stream pagination and actor/time investigation. Audit writer
  privileges remain separate from application read privileges.

### Migration Strategy

1. Introduce v2 columns and checkpoint storage without deleting v1 rows.
2. Stop old trigger writes, deploy the v2 trigger, and record a migration
   boundary root for every active stream.
3. Backfill only hashes and ordering metadata from v1 rows in deterministic,
   read-only batches; never copy additional source payloads.
4. Compare row counts, terminal hashes, sequence continuity, and independently
   replayed checkpoint roots before enabling reliance.
5. Keep v1 rows read-only for the retention period and expose their version so
   a verifier never interprets them as v2.
6. Apply least-privilege grants and integration-test concurrent writers on a
   real PostgreSQL instance before production promotion.

### Rollback Strategy

- Disable new v2 trigger writes only after placing affected mutations in
  read-only mode.
- Preserve all v1/v2 events, migration boundary roots, and checkpoints.
- Roll back API exposure independently from stored evidence.
- Resume from the last independently verified terminal hash; never reset a
  sequence or create a second genesis event for an existing stream.
- A failed checkpoint is appended as a failed verification record or incident,
  not deleted or overwritten.
- Rollback cannot weaken RBAC, human review, public claim boundaries, admin
  proxy blocking, or API/Web Worker separation.

## Verified Identity Assertion Extension

Status: accepted design for incremental implementation. This extension
authenticates the actor presented to RBAC and ABAC. It does not grant a role,
replace organization membership checks, or make Cloudflare the final authority
for an environmental decision.

### Problem Statement

CanopyProof route handlers currently read `x-dropin-actor-id`,
`x-dropin-actor-role`, and `x-dropin-organization-id` directly from the request.
Those values are useful for isolated tests, but they are client-controlled HTTP
headers and therefore cannot establish identity at a production origin. RBAC
over an unverified actor is only a role-shaped allowlist, not authentication.

The production API must validate a cryptographically signed identity assertion
at the origin even when Cloudflare Access or API Shield already checked it at
the edge. Cloudflare documents `Cf-Access-Jwt-Assertion` as the origin-facing
application token and requires validation of its signature, issuer, and
application audience against the account JWKS.

Reference:
`https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/`.

### Trust Model

- `cloudflare_access_jwt` is the only accepted authenticated identity mode when
  `DROPIN_CANOPYPROOF_MODE=production` or `NODE_ENV=production`.
- The origin verifies the Access JWT with a remote public JWKS over HTTPS. It
  validates RS256 signature, issuer, audience, expiry, not-before, issued-at,
  and subject claims before constructing a principal.
- The verified JWT `sub` is the actor ID. A configured signed claim supplies
  one recognized CanopyProof role; an optional signed claim supplies the
  organization ID.
- RBAC decides whether the verified role may invoke a route. ABAC and durable
  membership/accreditation records remain responsible for organization scope,
  conflicts, classification, purpose, and governance approval.
- Public status routes may remain anonymous. Any route whose policy or handler
  requires an actor fails closed when no verified principal exists.
- `development_headers` exists only for local/test workflows. Production
  configuration must reject it before trusting any actor header.
- The API proxy removes client-supplied Dropin actor and organization headers.
  It preserves the Access assertion for independent origin validation.
- Telemetry and actor-keyed rate limits use only the verified principal, never
  raw identity headers.
- Verification uses public keys only. CanopyProof does not load, generate, or
  handle an identity-provider private key.

### Data Flow

```text
identity provider
  -> Cloudflare Access policy
  -> Cf-Access-Jwt-Assertion
  -> API proxy strips client actor headers
  -> API origin validates JWKS + RS256 + issuer + audience + time claims
  -> immutable request principal (subject, role, organization, token id)
  -> rate limit + telemetry
  -> RBAC
  -> ABAC / membership / governance checks
  -> domain operation
  -> audit event bound to verified subject
```

### Threat Model

The design must reject or contain:

- spoofed `x-dropin-actor-*` or organization headers.
- unsigned, malformed, expired, not-yet-valid, wrong-issuer, wrong-audience,
  wrong-algorithm, or unknown-key tokens.
- a valid identity token with a missing or unrecognized role claim.
- accidental production startup in development-header mode.
- direct-origin requests that bypass the Cloudflare edge policy.
- token verification errors leaking token content, JWKS responses, or internal
  exception details.
- a verified identity being treated as sufficient authority for confidential
  exports, proof issuance, funding decisions, or public claims.

Residual risks include identity-provider compromise, revoked membership not yet
reflected in a signed role claim, and token replay within its validity window.
Short token lifetimes, durable membership lookup, Access session revocation,
and API Shield replay controls are required operational follow-ups.

### API Design

No new public route is required. A request-scoped principal contains:

```text
actorId
role
organizationId?
issuer
audience
tokenId?
authenticatedAt
authenticationMethod
```

Authentication failures return `401` with a stable
`CANOPYPROOF_AUTH_REQUIRED` or `CANOPYPROOF_AUTH_INVALID` code. A valid
principal lacking route authority returns `403` with
`CANOPYPROOF_RBAC_DENIED`. Responses never echo the token or JOSE exception.

Configuration is presence-checked and never exposed by status routes:

- `DROPIN_CANOPYPROOF_AUTH_MODE`
- `DROPIN_ACCESS_TEAM_DOMAIN`
- `DROPIN_ACCESS_AUD`
- `DROPIN_ACCESS_ROLE_CLAIM`
- `DROPIN_ACCESS_ORGANIZATION_CLAIM`

### Database Changes

This increment requires no schema mutation. Existing actor fields will receive
the verified subject. A later repository adapter must resolve signed subject
claims against durable `identity.participants` and
`organizations.memberships` records before high-risk institutional actions.

### Migration Strategy

1. Add the authenticator and request-principal contract behind an explicit
   `development_headers` mode for tests and local development.
2. Strip client actor headers in both Cloudflare proxy source copies and prove
   that the Access assertion remains available to the origin.
3. Configure a non-production Access application, audience, and role claim.
4. Run negative tests for spoofed headers and every JWT validation dimension.
5. Enable `cloudflare_access_jwt` in staging and compare actor/audit lineage
   without accepting header fallback.
6. Require the JWT mode for production before any new CanopyProof mutation is
   promoted. Do not silently infer a production role from legacy headers.

### Rollback Strategy

- Roll back route exposure or Access policy configuration before reverting the
  origin verifier.
- Keep production fail-closed; never restore raw actor-header trust as a
  production fallback.
- Public health/readiness routes may remain available for recovery without an
  authenticated principal, but mutation and institutional-read routes remain
  blocked.
- Preserve audit events produced with verified subjects and identify the
  authentication method in operational telemetry.
- Rollback cannot enable admin proxying, merge API and Web Workers, weaken
  human review, or alter financial and environmental claim boundaries.

## Durable Authorization Binding Extension

Status: accepted design for incremental implementation. This extension binds
an origin-verified request principal to current institutional records before
RBAC or ABAC can authorize protected work. It does not let an identity
provider, database lookup, organization, or AI agent become final proof
authority.

### Problem Statement

A valid Cloudflare Access assertion proves who issued a bounded request token
and what claims were signed into that token. It does not prove that the subject
is still an active CanopyProof participant, that a claimed organization still
trusts the subject, or that a verifier's accreditation remains in force. A
short-lived but otherwise valid token can therefore outlive a membership,
organization, or accreditation revocation.

Production authorization must resolve the verified JWT subject against the
current PostgreSQL trust registry on every protected request. A stale signed
role is advisory input until it matches an active participant role and, for an
organization-scoped principal, an active membership with the same role.
Suspension or revocation in the durable registry must take effect without
waiting for token expiry.

### Trust Model

- The verified JWT `sub`, role, and optional organization claim are immutable
  request inputs. They never create or update trust-registry records.
- `identity.participants` is the durable subject registry. A production
  subject must exist, be `verified`, and contain the signed role in its current
  role set.
- Human institutional roles (`owner`, `admin`, `verifier`, `researcher`, and
  `observer`) require an organization claim. `community` and `agent` may be
  standalone only when their participant record grants that exact role.
- An organization-scoped principal must have exactly one current `active`
  membership for the claimed organization, actor, and role. Suspended or
  revoked memberships deny access even if another historical record or token
  says otherwise.
- The claimed organization must exist and must not be `suspended` or `revoked`.
  Organization onboarding operations may run while an organization is
  `pending` or in `document_review`, but institutional approval operations
  require a `verified` organization.
- Final verification, accreditation, audit attestation, governance approval,
  and restricted export operations additionally require the organization's
  current accreditation to be `approved`. A later `suspended` or `revoked`
  accreditation supersedes an older approval.
- A participant of type `agent` may perform only routes that already permit the
  `agent` role and can never satisfy a human-review or final-authority policy.
- Production is fail-closed when the registry is unavailable, malformed, or
  missing required schema. Development-header mode remains an explicit,
  non-production compatibility boundary and cannot silently emulate durable
  production authorization.
- Authorization decisions are request-scoped and are not cached beyond the
  request, so revocation is observed by the next request.

### Data Flow

```text
Cloudflare Access assertion
  -> origin JWT verification
  -> immutable request principal
  -> durable participant lookup by JWT subject
  -> participant verification + exact role check
  -> optional organization lookup
  -> exact active membership check
  -> latest accreditation-state check
  -> request-scoped authorization binding
  -> route RBAC
  -> route ABAC assurance requirement
  -> domain mutation
  -> append-only domain + database audit events
```

The authorization binding records only bounded identifiers, states, the
effective role, evaluation time, and a deterministic decision hash. It never
contains the JWT, organization documents, conflict-disclosure text, evidence
payloads, private contact data, or database credentials.

### Threat Model

The design must reject or contain:

- a valid token for a subject absent from the durable participant registry.
- a signed role that is no longer present in the participant role set.
- a suspended or revoked participant, membership, organization, or
  accreditation.
- organization substitution where a subject presents a valid role for a
  different organization.
- role substitution where a subject has an active membership under a less
  privileged role than the signed claim.
- duplicate active membership rows that make authority ambiguous.
- use of an older approved accreditation after a newer suspension or
  revocation.
- authorization during registry outage, schema drift, timeout, or malformed
  database response.
- raw JWTs, database errors, membership conflict disclosures, or protected
  organization data leaking into API errors or telemetry.
- an agent, verifier, or administrator treating authentication or
  accreditation as sufficient environmental proof.

Residual risks include compromise of both the identity provider and trust
registry, malicious privileged database administration, and delayed external
revocation propagation into CanopyProof. Independent database audit replay,
external checkpoint publication, least-privilege database roles, and incident
response remain required.

### API Design

No public authorization-management endpoint is introduced by this increment.
Protected request context gains a server-created binding:

```text
actorId
participantType
role
participantVerificationStatus
organizationId?
organizationVerificationStatus?
organizationAccreditationStatus?
membershipId?
evaluatedAt
decisionHash
source = postgres | development_isolation
```

Route assurance levels are explicit:

- `participant`: verified participant and exact durable role.
- `organization_member`: participant plus non-suspended organization and exact
  active membership.
- `verified_organization`: organization membership plus organization status
  `verified`.
- `accredited_organization`: verified organization plus latest accreditation
  status `approved`.

Authentication failures remain `401`. A valid identity assertion that fails a
durable authorization condition returns a stable `403`
`CANOPYPROOF_AUTHORIZATION_DENIED` response. Registry unavailability or invalid
production configuration returns `503`
`CANOPYPROOF_AUTHORIZATION_UNAVAILABLE`. Neither response exposes the rejected
claim, token, SQL, or record contents.

### Database Changes

`identity.participants` gains columns required to bind the domain identity
contract without storing identity-provider tokens:

- `owner_id text` for accountable provenance.
- `organization_id text NULL` for the participant's declared home scope.
- `roles text[] NOT NULL` constrained to recognized CanopyProof roles.
- `verification_status text NOT NULL` constrained to `unverified`, `pending`,
  `verified`, `suspended`, or `revoked`.
- `updated_at timestamptz NOT NULL` for registry recency.

`organizations.memberships` already provides organization, actor, role, and
status. Its existing unique constraint over organization, actor, and role makes
an exact active binding deterministic; deletion remains prohibited and status
changes remain audited.

`organizations.organizations` remains the source of current organization
verification and accreditation summary state. The latest append-only row in
`organizations.accreditations`, ordered deterministically by decision time and
ID, is independently checked against that summary for accreditation-required
operations. A mismatch fails closed.

All participant and authorization-state mutations continue through the v2
database audit trigger. Application SQL uses parameterized queries and a
read-only authorization repository role; no request claim may become SQL text.

### Migration Strategy

1. Add nullable participant provenance, role, verification, and update columns
   without changing runtime authorization.
2. Backfill participants from reviewed identity records. Do not infer a
   privileged role from historical API headers or audit actor strings.
3. Reconcile participant roles with active organization memberships and place
   every ambiguous, missing, suspended, or revoked subject in a denied report.
4. Add constraints and non-null requirements only after reconciliation is
   independently reviewed and database audit replay passes.
5. Deploy the repository and decision engine in staging with shadow evaluation;
   compare deny reasons without allowing the shadow result to grant access.
6. Enable enforced production binding for protected reads, then mutations, then
   accredited final-authority routes. Every expansion requires negative tests
   and a rollback checkpoint.
7. Provision the first owner/admin through a separately approved database
   migration or break-glass runbook with dual control. No public bootstrap route
   may bypass the binding.

### Rollback Strategy

- Roll back route exposure or assurance-level enforcement independently, but
  never fall back to trusting production actor headers or signed role claims
  alone.
- If the durable registry is unavailable, protected routes remain unavailable;
  public health and transparency reads may continue where their existing policy
  permits anonymous access.
- Preserve all participant, membership, organization, accreditation, audit, and
  shadow-evaluation records. Do not delete denied or superseded authority.
- Revert schema readers before dropping any newly added column, and retain a
  verified audit checkpoint spanning the migration.
- Emergency access uses the documented dual-control break-glass procedure and
  creates an append-only incident record; it is not an API query parameter or
  environment-variable bypass.
- Rollback cannot enable admin proxying, merge API and Web Workers, restore SVG
  branding, weaken human review, or alter financial and environmental claim
  boundaries.

## Transactional Trust Registry Write Extension

Status: accepted design for incremental implementation. This extension makes
PostgreSQL the production system of record for the identity and institutional
authority that the durable authorization binding reads. It does not make
registration, membership, accreditation, or a successful transaction final
environmental proof authority.

### Problem Statement

The compatibility identity and partner services currently mutate process-local
maps. The production authorization layer reads `identity.participants`,
`organizations.organizations`, `organizations.memberships`, and
`organizations.accreditations` from PostgreSQL. A route can therefore return a
successful participant, membership, or accreditation response while the next
request still observes the old durable authority. Restarting the API also loses
the compatibility mutation.

Production cannot have one state machine for writes and another for reads.
Identity registration, reputation changes, organization registration and
verification, membership grants and status changes, and accreditation decisions
must validate and commit their domain object, semantic audit event, current
state, and database mutation event in one PostgreSQL transaction.

### Trust Model

- PostgreSQL is the sole production source of current identity and
  institutional authority. In-memory repositories are allowed only in explicit
  local/test isolation.
- Existing domain services remain the canonical business-rule implementation.
  A transaction loads a bounded snapshot, hydrates an isolated domain service,
  computes the proposed result, and persists it only if every invariant passes.
  The request-global compatibility maps are never mutated before a production
  commit.
- Every command sets transaction-local `app.actor_id` to the already
  authenticated and durably authorized subject. Database audit triggers reject
  writes without that context.
- The domain semantic event and its source row commit atomically. Semantic
  events contain hashes and bounded rationale, not evidence payloads, identity
  tokens, private contact data, or registration documents.
- One advisory lock serializes each semantic event stream. The next event must
  reference the current terminal root and have a non-decreasing timestamp.
- Every command first takes a transaction-scoped advisory lock derived from
  actor, operation, and the hashed idempotency key, then reads its receipt. This
  closes the absent-row race that `SELECT ... FOR UPDATE` cannot protect.
- Commands that can append to the same participant or organization stream take
  the semantic stream advisory lock before any current-state row lock. This
  global lock order prevents registration/review and membership/accreditation
  commands from deadlocking each other or calculating from a stale predecessor.
- Semantic event timestamps are normalized to UTC ISO-8601 millisecond
  precision before domain hashing. The database independently recomputes the
  canonical event root and derived event ID from the persisted fields; a writer
  cannot commit an arbitrary root while satisfying only the predecessor link.
- Organization verification and accreditation acquire a row lock on the
  organization. Membership status updates lock the exact membership. Reputation
  changes lock the participant. Concurrent stale decisions cannot silently
  overwrite one another.
- Registration commands are idempotent only when the existing immutable hash
  matches. Reuse of an ID or unique authority key with different content fails
  as a conflict.
- Command idempotency guarantees one committed effect. Receipts retain hashed
  request/response evidence and the semantic event root, not a duplicate raw
  response or private payload. A retry validates the receipt-to-event binding
  and returns the current committed resource identified by that receipt; it
  does not reapply the command.
- Append-only records such as reputation snapshots, accreditation decisions,
  and semantic audit events cannot be updated or deleted. Current summary rows
  may change only through their governed command and remain independently
  recorded by the database audit stream.
- A production endpoint without a completed durable adapter returns a stable
  `503 CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE`; it never falls back to a process
  map or reports a non-durable success.

### Data Flow

```text
origin-verified principal
  -> durable authorization binding
  -> route RBAC / assurance requirement
  -> BEGIN PostgreSQL transaction
  -> SET LOCAL app.actor_id
  -> lock hashed command identity
  -> replay validated receipt when present
  -> lock semantic stream
  -> lock and read bounded current snapshot
  -> hydrate isolated domain service
  -> validate command + build deterministic object/event
  -> append audit.domain_events row
  -> insert/update governed source rows
  -> database v2 mutation triggers append hash-only events
  -> COMMIT
  -> return committed read model
```

If validation, semantic-event insertion, source-row mutation, a constraint, or
the database audit trigger fails, the entire transaction rolls back and no
success response is returned.

### Threat Model

The design must reject or contain:

- a process-local write reported as production success.
- partial commit of an authority row without its semantic audit event, or an
  event without its authority row.
- lost updates from concurrent membership revocation, organization suspension,
  accreditation decisions, or reputation changes.
- stale snapshot replay that appends to an obsolete semantic audit root.
- two concurrent first-use requests passing an absent receipt lookup and
  applying the same command twice.
- row-lock/advisory-lock inversion between registration and later authority
  decisions on the same semantic stream.
- duplicate participant, organization, membership, reputation, or accreditation
  IDs with conflicting payloads.
- actor substitution through request bodies or SQL session state.
- mutation without `app.actor_id`, or with a transaction actor different from
  the semantic event actor.
- deletion or rewriting of authority history.
- raw JWTs, credentials, private contact data, registration documents, database
  errors, or unrestricted row images entering semantic audit events or API
  errors.
- an Agent writing human verification, governance approval, or accreditation
  decisions.

Residual risks include a compromised database owner, incomplete production
migration of non-authority partner workflows, and external identity revocation
not yet synchronized into CanopyProof. Least-privilege roles, independent audit
checkpoints, staged adapter rollout, and operational revocation runbooks remain
required.

### API Design

The existing route shapes remain stable. Their production implementation
becomes asynchronous and repository-backed:

```text
POST /canopyproof/identity/participants
GET  /canopyproof/identity/participants
GET  /canopyproof/identity/participants/:participantId
POST /canopyproof/identity/participants/:participantId/reputation-snapshots
GET  /canopyproof/identity/participants/:participantId/reputation-snapshots

POST /canopyproof/organizations
GET  /canopyproof/organizations
GET  /canopyproof/organizations/:id
POST /canopyproof/organizations/:id/verification
POST /canopyproof/organizations/:id/memberships
GET  /canopyproof/organizations/:id/memberships
PATCH /canopyproof/organizations/:id/memberships/:membershipId
POST /canopyproof/organizations/:id/accreditations
GET  /canopyproof/organizations/:id/accreditations
```

Production command errors are stable and payload-free:

- `409 CANOPYPROOF_TRUST_REGISTRY_CONFLICT` for conflicting idempotency keys or
  stale authority state.
- `503 CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE` for missing adapters, database
  outage, invalid schema, or transaction failure that cannot be safely
  classified.

Validation and RBAC errors retain their existing `400`/`401`/`403` semantics.
Reads return only committed state. Status responses disclose adapter mode and
configuration presence, never connection strings or protected row content.

### Database Changes

`identity.participants` gains migration-safe columns for credential commitment
hashes, public-key hash, and deterministic subject hash. The subject hash is
unique after reviewed backfill. Reputation history moves to append-only
`identity.reputation_snapshots` with previous/new scores, source, rationale,
actor/time, snapshot hash, and semantic audit root.

`organizations.organizations` gains the domain profile fields needed to
reconstruct the API read model: display name, public contact, operating regions,
verification capabilities, data-sharing policy, and profile hash. Registration
documents remain hash-only metadata in the normalized document table and
bounded JSON compatibility projection; raw documents are not stored.

`audit.domain_events` stores the semantic event contract:

```text
id, stream_id, action, actor_id, entity_type, entity_id,
previous_root, payload_hash, event_root, created_at, rationale
```

It is append-only, uniquely rooted, actor-bound, stream-serialized, and covered
by the independent database v2 audit trigger. Its insert trigger also
recomputes the canonical semantic root and `cp_audit_*` ID. Source rows store
only the relevant semantic event root. `audit.command_receipts` stores hashed
idempotency and request material, original response hash, result identifier,
and event root; it is append-only and contains no raw key or response payload.
Query indexes support participant, organization, membership, accreditation,
stream, and time lookups.

### Native PostgreSQL Validation Gate

PGlite remains the deterministic SQL/trigger contract gate, but promotion of
the Prisma adapter requires a disposable native PostgreSQL database and at
least two independent Prisma clients. The opt-in native gate must verify:

- concurrent exact retries produce one domain effect and one command receipt,
  while every caller resolves the same result.
- reuse of the same idempotency key with a different request returns a stable
  conflict and does not mutate source or audit state.
- concurrent commands on one participant or organization preserve semantic
  sequence continuity and source-summary consistency.
- a domain/source constraint failure rolls back its semantic event and command
  receipt.
- receipt-to-event actor/entity binding and independently replayed event roots
  remain valid after all clients disconnect and reconnect.

The harness must refuse non-PostgreSQL URLs and databases that are not clearly
marked disposable test/CI targets. It must never reset, migrate, or write to a
production database by inference.

### Migration Strategy

1. Add nullable compatibility columns and append-only tables without changing
   production route behavior.
2. Backfill subject/profile hashes and semantic events from independently
   reviewed domain records. Never derive privileged roles from historical HTTP
   headers or free-form audit actors.
3. Reconcile participant, organization, membership, accreditation, and audit
   roots. Quarantine conflicting IDs and ambiguous active authority.
4. Add uniqueness/non-null constraints only after reconciliation and
   independent audit replay pass.
5. Deploy durable reads, then shadow-write commands inside rollback-only
   transactions and compare their computed domain roots with compatibility
   results.
6. Enable durable identity commands, then organization registration, membership,
   verification, and accreditation commands. Each boundary gets rollback,
   idempotency, concurrent-update, and outage tests.
7. Return explicit unavailable responses for remaining production partner
   commands until their own transactional adapters are promoted. Do not use a
   mixed durable/in-memory success path.

### Rollback Strategy

- Disable affected production command routes or return durable-write
  unavailable; never switch them back to process-local success.
- Preserve every committed authority row, semantic event, database event, and
  migration reconciliation report.
- Roll back API readers before removing schema fields, and retain external
  checkpoints spanning the transition.
- A failed command is retried only with the same bounded idempotency material;
  operators must inspect conflicts rather than overwrite them.
- Break-glass repair requires dual control, a transaction actor, an incident
  record, and independent audit replay. There is no header, query parameter, or
  environment-variable bypass.
- Rollback cannot enable admin proxying, merge API and Web Workers, weaken human
  review, restore SVG branding, or alter financial and environmental claim
  boundaries.

## Durable Partner Data Governance Extension

Status: accepted and implemented for the delivery-receipt boundary. This extension moves
data-sharing agreement creation, revocation, renewal, and constrained
supersession into the transactional PostgreSQL trust registry. It does not yet
make data-access requests, deliveries, use attestations, accountability
packets, or public disclosures durable; those routes remain fail-closed in
production.

### Problem Statement

Institutional data-sharing agreements define which bounded datasets and uses an
organization may request. The domain model already prevents scope expansion,
privacy escalation, reuse of revoked agreements, and silent predecessor
replacement, while the SQL contract already provides append-only agreement,
revocation, and supersession tables. Production routes still use process-local
maps and are therefore blocked by the durable-write guard. Returning those
routes without transactional adapters would create non-recoverable authority
and could let a later data-access decision observe a different agreement state.

### Trust Model

- `organizations.data_sharing_agreements` is an immutable agreement version.
  Revocation or supersession never rewrites or deletes that row.
- Current `revoked`, `superseded`, predecessor, and successor state is derived
  from append-only revocation and supersession records inside the same
  repeatable-read snapshot as the organization and semantic audit stream.
- Agreement creation, revocation, and supersession take the organization
  semantic stream lock before organization/current-lineage row locks. Every
  command uses the hashed command-identity lock and receipt protocol defined by
  the trust registry.
- Supersession creates the immutable successor agreement, successor semantic
  event, append-only lineage event, and supersession record in one serializable
  transaction. Neither half may become visible alone.
- The database independently rejects cross-organization revocation, duplicate
  revocation, revocation after expiry, revocation of a superseded predecessor,
  scope expansion, privacy escalation, duration expansion, or lineage hash
  mismatch.
- Agreement metadata contains normalized scope/use labels and hashes. It never
  contains raw evidence, private documents, access credentials, JWTs, database
  secrets, payment material, or private keys.
- Agreement governance is authorization metadata, not environmental proof,
  carbon-credit certification, a tax offset, fund movement, automatic CANOPY
  distribution, or guaranteed yield.

### Data Flow

```text
origin-verified and durably authorized owner/admin
  -> bounded Idempotency-Key
  -> command advisory lock
  -> validate/replay immutable command receipt
  -> organization semantic stream advisory lock
  -> lock and load organization + agreement lineage
  -> hydrate isolated partner domain service
  -> evaluate least-privilege and temporal invariants
  -> append semantic event(s)
  -> insert immutable agreement/revocation/supersession row(s)
  -> update organization summary timestamp only
  -> append database v2 mutation events + command receipt
  -> COMMIT
  -> return derived committed view
```

Reads reconstruct all agreement versions and derive state from revocation and
supersession rows. A missing source row, event root, actor binding, hash,
organization relationship, or lineage endpoint fails with
`503 CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE`; it is not silently omitted.

### Threat Model

The design must reject or contain:

- mutating an immutable agreement row to hide its original scope or use.
- revocation whose organization differs from the agreement owner.
- more than one revocation for an agreement, or revocation after supersession.
- supersession after revocation, multiple successors, cross-organization
  lineage, or predecessor/successor hash substitution.
- renewal that changes scope, permitted use, or privacy tier instead of merely
  extending a finite expiry.
- supersession that expands scope/use, raises privacy tier, extends duration,
  or creates a materially identical successor.
- a successor agreement without its lineage record, or lineage without both
  agreement versions and both semantic events.
- stale concurrent commands calculating from the same active predecessor.
- process-memory success in production or access/delivery routes being opened
  before their own durable adapter exists.

Residual risks are privileged database-owner compromise, policy text that is
semantically ambiguous despite normalized labels, and downstream data-access
workflows that are not yet migrated. Least-privilege database roles,
institutional legal review, independent audit replay, and continued fail-closed
route gating remain required.

### API Design

The following existing routes become durable when authorization binding source
is PostgreSQL:

```text
POST /canopyproof/organizations/:id/data-sharing-agreements
GET  /canopyproof/organizations/:id/data-sharing-agreements
POST /canopyproof/data-sharing-agreements/:agreementId/revocations
GET  /canopyproof/data-sharing-agreements/:agreementId/revocations
GET  /canopyproof/data-sharing-agreement-revocations/:revocationId
POST /canopyproof/data-sharing-agreements/:agreementId/supersessions
GET  /canopyproof/data-sharing-agreements/:agreementId/supersessions
GET  /canopyproof/data-sharing-agreement-supersessions/:supersessionId
```

All three mutations require a bounded `Idempotency-Key`. Reads preserve current
RBAC. Stable trust-registry `400`/`409`/`503` errors apply. Every
`/data-access-*`, `/data-use-*`, and public accountability route remains behind
the pending-persistence guard.

### Database Changes

- Add migration-safe hash, non-empty array, and timestamp constraints to
  agreement lineage tables.
- Add one-revocation-per-agreement uniqueness and indexes for organization,
  agreement, predecessor, successor, and event-time reads.
- Add a revocation validation trigger that locks the agreement and rejects
  cross-organization, expired, already-revoked, or superseded targets.
- Retain the existing supersession validation trigger and append-only
  update/delete guards.
- Do not update the legacy `revoked` compatibility column in the immutable base
  row. New runtime reads derive revocation from the append-only table, while an
  already-true legacy value remains conservatively revoked.

### Migration Strategy

1. Deploy constraints, indexes, and validation trigger without exposing routes.
2. Reconcile legacy `revoked=true` rows with append-only revocation records; do
   not fabricate rationale or actor authority. Quarantine unexplained rows.
3. Verify every agreement/revocation/supersession event root against the
   semantic stream and every source mutation against the database v2 stream.
4. Shadow-read durable lineage and compare it with compatibility service output
   on reviewed fixtures.
5. Enable durable creation, then revocation, then supersession routes. Each
   step requires exact-retry, conflicting-retry, rollback, concurrent
   predecessor, and read-reconstruction tests.
6. Keep downstream data-access and accountability routes fail-closed until
   their own source rows and dependency graph are transactional.

### Rollback Strategy

- Disable agreement mutations or return durable-write unavailable; never
  restore process-local production success.
- Preserve all committed agreement versions, revocations, supersessions,
  command receipts, and semantic/database audit events.
- A successor already committed remains visible as lineage even if route code
  rolls back. Do not reactivate its predecessor by deleting history.
- Reconcile partial migration anomalies in an independently reviewed repair
  transaction with actor context and incident audit evidence.
- Rollback cannot open downstream access routes, enable admin proxying, merge
  API/Web Workers, weaken human review, restore SVG branding, or alter financial
  and environmental claim boundaries.

## Durable Purpose-Bound Data Access Extension

Status: accepted and implemented for the data-access request and decision
boundary. This extension moves
data-access request submission, human decision, and request reads into the
transactional PostgreSQL trust registry. It does not enable dataset delivery,
use attestation, enforcement, restriction, accountability packet, or public
disclosure routes; those downstream routes remain fail-closed in production.

### Problem Statement

An approved data-sharing agreement is necessary but insufficient authority to
release institutional data. Each access attempt must identify a bounded scope,
permitted use, privacy tier, purpose, requester, validity window, and an
independent human decision. The current compatibility model overwrites a
process-local request object when a decision occurs, while the SQL request table
is append-only. Persisting that overwrite would either violate the database
contract or erase the original request fact. Returning the existing routes from
memory would also lose approvals on restart and permit later delivery code to
observe authority that was never durably committed.

### Trust Model

- `organizations.data_access_requests` stores only the immutable request fact.
  New rows are always `pending` and contain no decision actor, time, or
  rationale.
- `organizations.data_access_request_decisions` stores one immutable transition
  per human decision. It binds the request, organization, agreement, previous
  state, next state, actor, rationale, semantic event, decision hash, and
  decision root.
- Current request status is a projection obtained by replaying decisions in
  organization semantic-event sequence. A request row is never updated to
  represent approval, denial, revocation, or expiry.
- The first decision may transition `pending` to `approved`, `denied`, or
  `expired`. A later decision may transition `approved` to `revoked` or
  `expired`. All other transitions are rejected independently by the domain and
  database.
- A requester cannot decide their own request. Requesters must have an active
  owner, admin, verifier, or researcher membership in the request organization;
  decision actors must have an active owner, admin, or verifier membership in
  that same organization.
- Request submission and every decision take the organization semantic stream
  lock before request, agreement-lineage, or decision row locks. Commands use
  the bounded, hash-only idempotency receipt protocol.
- Request approval is authorization metadata only. It does not deliver data,
  certify environmental proof, issue carbon credit, create a tax offset, move
  funds, distribute CANOPY, or promise yield.

### Data Flow

```text
origin-verified and durably authorized organization member
  -> bounded Idempotency-Key
  -> command advisory lock
  -> validate/replay immutable command receipt
  -> organization semantic stream advisory lock
  -> lock organization + agreement lineage + request decision stream
  -> reconstruct current agreement and request state
  -> evaluate scope, purpose, privacy, expiry, role, and independence rules
  -> append semantic event
  -> insert immutable request or decision source row
  -> update organization summary timestamp only
  -> append database v2 mutation event + command receipt
  -> COMMIT
  -> return the committed derived request view
```

Reads load the organization audit stream, agreement versions, revocations,
supersessions, immutable requests, and decisions in one repeatable-read
transaction. A missing event, source row, actor binding, relationship, hash, or
state predecessor returns `503 CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE`; the
reader never guesses a status.

### Threat Model

The design must reject or contain:

- cross-organization requests or decisions, including a valid actor attempting
  to operate on another institution's route identifier.
- requests outside agreement scope, permitted use, privacy tier, or validity
  window, and requests made under revoked or superseded agreements.
- self-approval, unverified organizations, inactive memberships, and decision
  actors without an authorized human role.
- a decision without its exact semantic event or a semantic event without its
  immutable source row.
- stale concurrent approvals, duplicate terminal decisions, transition
  rewrites, backdated decisions, and status derivation by timestamp tie-breaks.
- idempotency-key reuse with different request material or replay that resolves
  to a different decision event.
- delivery or accountability routes becoming reachable merely because request
  persistence is complete.

Residual risks are privileged database-owner compromise, ambiguous purpose
language, and a future delivery adapter failing to re-evaluate revocation,
supersession, restriction, or expiry at delivery time. Least-privilege database
roles, institutional policy review, semantic audit replay, and continued
downstream fail-closed routing remain required.

### API Design

The following existing routes become durable when authorization binding source
is PostgreSQL:

```text
POST  /canopyproof/organizations/:id/data-access-requests
GET   /canopyproof/organizations/:id/data-access-requests
GET   /canopyproof/data-access-requests/:requestId
PATCH /canopyproof/data-access-requests/:requestId
```

Both mutations require a bounded `Idempotency-Key`. Submission preserves the
existing owner/admin/verifier/researcher policy. Decisions preserve the
owner/admin/verifier policy and verified-organization assurance, with database
membership and requester-independence enforcement. Stable trust-registry
`400`/`409`/`503` errors apply. Every delivery, use, enforcement, restriction,
accountability, and public-disclosure route remains behind the pending adapter
guard.

### Database Changes

- Retain `organizations.data_access_requests` for compatibility, but add a
  validation trigger requiring every new row to be a pending immutable request
  with null decision fields.
- Add `organizations.data_access_request_decisions` with transition, actor,
  timestamp, rationale, decision hash/root, safety boundary, and semantic event
  binding columns.
- Add append-only update/delete guards, database v2 audit capture, request/event
  uniqueness, and organization/request/sequence read indexes.
- Validate request agreement ownership, active agreement lineage, subset scope
  and use, privacy rank, organization verification/trust, expiry order, and
  requester membership inside PostgreSQL.
- Validate each decision against the latest prior decision by semantic event
  sequence, enforce requester independence and decision membership, and reject
  decisions before request creation or after a terminal state.
- Do not update compatibility status or decision columns. Existing non-pending
  rows require reviewed migration into decision records before durable reads
  may treat them as authoritative.

### Migration Strategy

1. Add the decision table, indexes, constraints, validation triggers, event
   binding, append-only controls, and audit capture without opening routes.
2. Inventory legacy non-pending request rows. Reconstruct a decision only when
   actor, time, rationale, and matching semantic event are independently
   verifiable; quarantine every ambiguous row.
3. Reconcile request and decision roots against organization semantic streams
   and database v2 mutation streams.
4. Shadow-read reviewed fixtures and verify deterministic state projection,
   requester independence, and agreement lineage at request time.
5. Enable durable request submission and reads, then enable decisions after
   exact-retry, conflicting-retry, rollback, concurrent-decision, backdating,
   cross-organization, and reconnect tests pass.
6. Keep delivery and all downstream accountability routes fail-closed until
   each has its own transactional dependency revalidation.

### Rollback Strategy

- Disable request mutations or return durable-write unavailable; never restore
  process-local production success.
- Preserve all request facts, decisions, command receipts, and semantic/database
  audit events. A committed approval is not undone by deleting history.
- Roll back readers before schema removal and keep compatibility columns
  read-only. Repair requires dual control, actor context, incident evidence, and
  independent replay.
- Rollback cannot enable data delivery, admin proxying, mainnet funds, automatic
  CANOPY distribution, carbon-credit or tax-offset claims, guaranteed yield,
  merged API/Web Workers, or SVG logo restoration.

## Durable Hash-Only Audit Export Manifest Extension

Status: implemented for project registration, v1 lifecycle transitions, and
monitoring authority in PostgreSQL; native-wire execution remains gated pending
an explicitly confirmed disposable database. This extension moves
audit export manifest creation and organization-scoped reads into the
transactional PostgreSQL trust registry. A manifest is a hash-only index for a
governed data room. It is not a dataset, download, delivery receipt, proof
certificate, public disclosure, or authorization to bypass the data-access
decision lifecycle.

### Problem Statement

Approved data access can only be delivered against a reviewed export manifest
whose entries, classifications, redaction policies, and source roots are
durable. The current API stores manifests in a process-global `Map` even though
an append-only SQL table exists. A restart loses the manifest, multiple workers
can disagree, and the later delivery route can resolve a different object from
the one an institutional reviewer approved. The current table also lacks exact
semantic-event binding, actor/organization membership validation, hash-shape
constraints, and a transactional idempotency receipt.

### Trust Model

- `audit.export_manifests` stores normalized entry metadata and cryptographic
  roots only. Raw evidence, media bytes, private contacts, credentials, access
  tokens, database secrets, and private keys are forbidden.
- Each manifest belongs to exactly one requester organization and is appended
  to that organization's semantic audit stream. The source row must bind the
  same actor, entity ID, event root, and millisecond timestamp.
- Creation requires an active owner, admin, verifier, or researcher membership
  in a verified organization. Production route binding must match the signed
  principal's organization, and PostgreSQL independently rechecks membership.
- Manifest classification cannot be lower than any included entry. Restricted
  or confidential entries require explicit non-public redaction; a public
  manifest may include only public-safe entries.
- Entry IDs, hashes, optional event roots, entry root, redaction root, source
  event root, export hash, expiry, and safety boundary are deterministic and
  replay-validated before a row becomes authoritative.
- Creation takes the organization semantic stream lock and uses the hash-only
  command receipt protocol. Exact retries return the original immutable
  manifest; conflicting key reuse returns a stable conflict.
- A manifest cannot authorize delivery by itself. Delivery must later
  re-evaluate the active agreement, approved request, request expiry,
  restrictions, manifest ownership/classification, recipient, and purpose in
  its own transaction.

### Data Flow

```text
origin-verified organization reviewer
  -> organization-bound request body + bounded Idempotency-Key
  -> command advisory lock
  -> validate/replay immutable command receipt
  -> organization semantic stream advisory lock
  -> lock organization + load prior manifests and complete audit history
  -> normalize entries and evaluate classification/redaction rules
  -> compute entry/redaction/source roots and export hash
  -> append semantic event
  -> insert immutable manifest source row
  -> append database v2 mutation event + command receipt
  -> COMMIT
  -> return hash-only manifest
```

Reads run in a repeatable-read transaction, validate every row against its
semantic event and recompute all deterministic roots. Sensitive manifests are
returned only to existing institutional reviewer roles. Organization scope is
always applied in PostgreSQL mode; an arbitrary manifest ID cannot cross that
boundary.

### Threat Model

The design must reject or contain:

- a valid actor creating or reading a manifest for another organization.
- a source row without its exact semantic event, or a semantic event whose
  source insert rolls back.
- raw payloads, private contact data, secrets, keys, unsupported claims, or
  unbounded entry metadata embedded in the JSON document.
- under-classification, public inclusion of restricted material, missing
  redaction, duplicate entry IDs, malformed hashes, and root substitution.
- backdated creation, expiry at or before creation, duplicate manifest IDs, and
  idempotency-key reuse with changed content.
- process-memory success in production or a delivery endpoint becoming
  reachable before its own transactional adapter exists.

Residual risks are false source hashes supplied by a compromised upstream
registry, privileged database-owner compromise, and policy labels that do not
capture the real sensitivity of a resource. Source-registry verification,
least-privilege database roles, human review, independent replay, and delivery-
time revalidation remain required.

### API Design

The following existing routes become durable when authorization binding source
is PostgreSQL:

```text
GET  /canopyproof/audit/export-manifests/status
POST /canopyproof/audit/export-manifests
GET  /canopyproof/audit/export-manifests
GET  /canopyproof/audit/export-manifests/:manifestId
```

`POST` requires a bounded `Idempotency-Key`, verified-organization assurance,
and an organization ID matching the signed principal binding. Lists and reads
remain role-filtered; observers and agents cannot receive restricted or
confidential manifests. Stable trust-registry `400`/`409`/`503` errors apply.
Data-access delivery routes remain behind the pending-persistence guard.

### Database Changes

- Add migration-safe purpose, hash/root shape, expiry, JSON-array, and exact
  safety constraints to `audit.export_manifests`.
- Add organization/time, subject/time, and classification indexes.
- Add a validation trigger for transaction actor, active organization
  membership, verified organization state, deterministic timestamp bounds,
  entry shape, classification, and redaction policy.
- Add an exact semantic-event binding trigger using requester organization as
  stream ID and `audit_export_manifest` as entity type.
- Retain append-only update/delete guards and database v2 mutation capture.
  Existing ambiguous or malformed rows are not silently accepted by durable
  readers.

### Migration Strategy

1. Deploy constraints, indexes, validation, and semantic binding without
   changing route behavior.
2. Inventory process-local fixtures and existing SQL rows. Import only records
   with independently verifiable normalized entries, hashes, actor authority,
   and semantic events; quarantine all others.
3. Replay entry, redaction, source-event, export, semantic, and database-event
   roots for every candidate.
4. Shadow-read reviewed manifests and compare classification filters and
   organization scope with compatibility output.
5. Enable durable creation, then organization-scoped list/get/status after
   exact-retry, conflicting-retry, rollback, tamper, cross-organization, and
   reconnect tests pass.
6. Keep delivery routes fail-closed until they atomically bind this manifest to
   an approved request and revalidate every upstream authority dependency.

### Rollback Strategy

- Disable manifest creation/reads or return durable-write unavailable; never
  restore process-local production success.
- Preserve every committed manifest, semantic event, command receipt, and
  database audit event. Do not rewrite classification or redaction history.
- Repair requires dual control, an accountable transaction actor, incident
  evidence, and independent root replay.
- Rollback cannot expose raw data, open delivery routes, bypass environment
  approval, enable admin proxying, merge API/Web Workers, restore SVG branding,
  or alter the financial and environmental claim boundaries.

## Durable Purpose-Bound Data Delivery Receipt Extension

Status: accepted design for incremental implementation. This extension moves
hash-only data-access delivery receipt creation and organization-scoped reads
into the transactional PostgreSQL trust registry. A receipt records that an
authorized human bound an approved request to a previously committed export
manifest for a named recipient and channel. It is not the payload, a download,
a transport acknowledgement from the recipient, a data-use attestation, proof
authority, or permission to exceed the approved request.

### Problem Statement

The current delivery endpoint resolves a durable-looking request and manifest
through process-local services and stores the resulting receipt in a `Map`.
Multiple workers can therefore disagree about whether delivery occurred, a
restart loses the receipt, and a stale worker can deliver after a request,
agreement, manifest, membership, or restriction has become invalid. The SQL
table is append-only but currently does not independently verify those
dependencies, the transaction actor, recipient authority, manifest expiry, or
the receipt's semantic event. Production cannot open this route until the
database is an enforcing authority rather than passive storage.

### Trust Model

- The approved request is reconstructed from its immutable request fact and
  append-only decisions in organization semantic-event order. Its latest state
  must be `approved` at `deliveredAt`; a revoked, denied, expired, pending, or
  structurally ambiguous request cannot authorize a receipt.
- The original data-sharing agreement must belong to the same organization and
  remain unrevoked, unsuperseded, and unexpired. Revocation and supersession are
  checked from their append-only records, not only compatibility columns.
- The manifest is read server-side from `audit.export_manifests` in the same
  serializable transaction. ID, requester organization, export hash, entry
  root, classification, safety boundary, and expiry are authoritative; callers
  cannot supply or override those fields.
- The manifest classification must not exceed the approved request privacy
  tier. Public, internal, restricted, and confidential manifest ranks map to
  the request's public/restricted/confidential ceiling without widening it.
- The delivery actor must match `app.actor_id`, be an active owner, admin, or
  verifier member of the verified organization, and differ from the recipient.
  The recipient must be a verified participant with an active membership in
  that organization. Restricted recipients are limited to owner, admin,
  verifier, or researcher; confidential recipients are limited to owner,
  admin, or verifier.
- Any current `remediation_hold`, `suspended`, or `revoked` restriction blocks
  delivery. A later `restored` record only clears the restriction when its
  append-only lineage is structurally valid. Until durable restriction replay
  is implemented, any existing restriction lineage that cannot be proven
  unambiguously fails closed.
- The receipt stores identifiers, hashes, classification, channel, recipient,
  purpose statement, access root, deterministic receipt/delivery roots, and
  safety flags only. Raw evidence, media, private contacts, credentials,
  secrets, and private keys are forbidden.
- The organization semantic stream is locked before authority reconstruction.
  Exact idempotent retries return the original immutable receipt; reuse of the
  key with different content returns a stable conflict.
- The receipt does not prove that an external transport delivered bytes or that
  the recipient used them lawfully. Those require separate transport evidence
  and a future durable data-use attestation adapter. All use, enforcement,
  restriction mutation, accountability, and public-disclosure routes remain
  fail-closed in production.

### Data Flow

```text
origin-verified owner/admin/verifier
  -> request ID + manifest ID + channel + recipient + bounded purpose
  -> bounded Idempotency-Key
  -> command advisory lock
  -> validate/replay immutable command receipt
  -> organization semantic stream advisory lock
  -> lock organization, request fact, decisions, agreement lineage, manifest
  -> reconstruct current request and agreement authority
  -> verify actor and recipient memberships
  -> reject expired manifest/request/agreement or active restriction
  -> derive manifest fields server-side
  -> compute deterministic receipt hash and delivery root
  -> append organization semantic event
  -> insert immutable delivery receipt
  -> append database v2 mutation event + command receipt
  -> COMMIT
  -> return hash-only receipt
```

Reads use repeatable-read transactions, scope lookup through the request's
organization, replay the complete organization authority snapshot, recompute
the receipt roots, and require its exact semantic event. A corrupt row, missing
event, cross-organization reference, or ambiguous restriction state makes the
read unavailable rather than partially trusted.

### Threat Model

The design must reject or contain:

- caller substitution of manifest hash, entry root, classification, requester
  organization, access root, delivery actor, or timestamp.
- delivery after request revocation/expiry, agreement revocation/supersession/
  expiry, manifest expiry, organization suspension, membership revocation, or
  an active access restriction.
- delivery by the requester without an independently approved decision, by an
  actor outside the organization, to an unverified or unauthorized recipient,
  or to the delivery actor themself.
- classification escalation, cross-organization manifest references, malformed
  roots, unbounded purpose text, raw/private material, and unsupported claims.
- a source row without its exact semantic event, an event whose source insert
  rolls back, duplicate receipt IDs, and idempotency-key reuse with changed
  command content.
- a process-memory success response in production, or accidental opening of
  downstream data-use, restriction, enforcement, accountability, or disclosure
  routes.

Residual risks are false hashes supplied by a compromised source registry,
external transport failure after receipt creation, recipient compromise after
authorization, privileged database-owner compromise, and semantic mismatch
between a manifest's declared purpose and its actual upstream content. The
receipt exposes these limits explicitly; source verification, transport proof,
human review, least-privilege database roles, and later durable use attestations
remain separate controls.

### API Design

The following existing routes become durable when authorization binding source
is PostgreSQL:

```text
POST /canopyproof/data-access-requests/:requestId/deliveries
GET  /canopyproof/data-access-requests/:requestId/deliveries
GET  /canopyproof/data-access-deliveries/:deliveryId
```

`POST` accepts only `manifestId`, `channel`, `recipientActorId`, `purpose`, and
an optional timestamp. It requires a bounded `Idempotency-Key`, accredited-
organization assurance, and an organization binding matching the request.
Manifest hashes, roots, classification, requester organization, agreement, and
access root are always loaded server-side. Reads require the same organization
binding in PostgreSQL mode and remain visible only to existing institutional
reader roles. Stable trust-registry `400`/`409`/`503` errors apply.

Every route under `/data-access-deliveries/:id/use-attestations`, plus data-use
enforcement, restriction mutation, accountability, and public disclosure,
remains behind the pending-persistence guard.

### Database Changes

- Harden `organizations.data_access_delivery_receipts` with bounded text,
  hash/root shapes, exact safety, timestamp, organization/request/agreement/
  manifest lineage, and organization/request/time indexes.
- Add an insert validator requiring matching `app.actor_id`, a verified
  organization, active delivery and recipient memberships, actor/recipient
  separation, current approved request state, active agreement, unexpired
  request/agreement/manifest, classification bounds, and no active restriction.
- Extend the data-access semantic-event binding trigger to delivery receipts,
  requiring exact stream, actor, entity ID, event root, timestamp, and canonical
  payload hash. PostgreSQL recomputes receipt ID/hash and delivery root from the
  same stable key ordering used by the TypeScript domain.
- Retain append-only update/delete guards and database v2 mutation capture.
  Existing malformed or unbound rows are never silently accepted by durable
  readers.

### Migration Strategy

1. Deploy constraints, indexes, validation, semantic binding, and append-only
   controls without opening delivery routes.
2. Inventory legacy receipt and restriction rows. Import or retain authority
   only when request decision, agreement, manifest, memberships, restriction
   state, roots, actor, time, and semantic event can be independently replayed;
   quarantine every ambiguous row.
3. Replay receipt, delivery, access, manifest, semantic, and database-event
   roots for reviewed candidates.
4. Shadow-read reviewed receipts and compare organization scope, current
   authorization, classification, expiry, and restriction outcomes.
5. Enable durable creation, then list/get after exact-retry, conflicting-retry,
   rollback, tamper, cross-organization, expiry, restriction, concurrency, and
   reconnect tests pass.
6. Keep all downstream workflows fail-closed until each receives its own RFC,
   transaction adapter, dependency revalidation, and adversarial tests.

### Rollback Strategy

- Disable delivery mutations/reads or return durable-write unavailable; never
  restore process-local production success.
- Preserve every committed receipt, semantic event, command receipt, and
  database audit event. Revocation affects future authority and never deletes
  historical delivery facts.
- Repair requires dual control, an accountable transaction actor, incident
  evidence, and independent root replay. Do not rewrite receipt or manifest
  history.
- Rollback cannot expose raw data, open downstream routes, bypass environment
  approval, enable admin proxying, merge API/Web Workers, restore SVG branding,
  or alter the financial and environmental claim boundaries.

## Durable Hash-Only Data Use Attestation Extension

Status: accepted and implemented for the data-use attestation boundary. This
extension moves
data-use attestation creation and organization-scoped reads into the
transactional PostgreSQL trust registry. An attestation is an accountable human
statement about a prior hash-only delivery. It is not proof that use occurred,
proof that use was lawful, an enforcement decision, an access mutation, or an
environmental or financial certification.

### Problem Statement

The compatibility service currently stores use attestations in a process-local
`Map`. A restart loses the statement, concurrent workers can diverge, and the
SQL table accepts rows without independently validating delivery lineage,
attester authority, current use authority, canonical hashes, or semantic-event
payload. The current domain rule also requires the request to remain approved
for every state, which would prevent a recipient from recording `no_use` or an
institution from recording a misuse challenge after revocation. Production must
separate positive use assertions from accountability statements and persist both
without opening the enforcement or restriction paths.

### Trust Model

- Every attestation binds an immutable, historically valid delivery receipt,
  request ID, manifest ID, delivery root, and access root. These fields are read
  from PostgreSQL and never accepted from the caller.
- `within_scope` is a recipient self-attestation. The actor must equal the
  delivery recipient, the request and original agreement must still authorize
  use at `attestedAt`, and the manifest must be unexpired. At least one output
  hash is required. Until restriction replay is durable, any restriction row
  blocks a positive use assertion.
- `no_use` is also a recipient self-attestation and cannot contain output
  hashes. It may be recorded after request/agreement expiry or revocation because
  it asserts no use rather than continued authority.
- `misuse_challenged` and `revocation_requested` are non-final challenge
  statements. They may be recorded after expiry, revocation, supersession, or
  restriction and require at least one evidence event root. Blocking those
  statements would suppress accountability evidence precisely when governance
  has withdrawn authority.
- Every actor must be a verified human participant with an active owner, admin,
  verifier, or researcher membership in the delivery organization. An Agent
  cannot attest or challenge data use on its own authority.
- `attestedAt` cannot precede `deliveredAt`. Hash arrays are normalized, unique,
  bounded, and CSPRNG-independent; use case and limitations are bounded text and
  cannot contain raw evidence, private contacts, credentials, secrets, or
  private keys.
- The safety boundary is exact. PostgreSQL and TypeScript independently
  recompute attestation ID/hash, usage root, and semantic-event payload hash
  using the same canonical JSON ordering.
- Exact command retries return the original event-time projection. Different
  content under the same idempotency key returns a stable conflict. Multiple
  distinct attestations remain append-only facts; contradictions are preserved
  for later independent review rather than silently overwritten.
- A use attestation cannot mutate access, approve itself, settle an enforcement
  case, certify environmental impact, move funds, issue a carbon credit or tax
  offset, distribute CANOPY, or promise yield.

### Data Flow

```text
origin-verified human owner/admin/verifier/researcher
  -> delivery ID + usage state + bounded statement
  -> output hashes and/or evidence event roots + limitations
  -> bounded Idempotency-Key
  -> command advisory lock
  -> validate/replay immutable command receipt
  -> organization semantic stream advisory lock
  -> lock delivery, request decisions, agreement lineage, manifest, actor membership
  -> reconstruct event-time authority for the selected usage state
  -> derive delivery/request/manifest roots server-side
  -> normalize bounded hash arrays and text
  -> compute deterministic attestation hash and usage root
  -> append ASSERT or CHALLENGE semantic event
  -> insert immutable data-use attestation
  -> append database v2 mutation event + command receipt
  -> COMMIT
  -> return hash-only attestation
```

Reads use repeatable-read transactions and resolve organization scope from the
stored delivery. They replay request decisions and delivery/attestation roots at
semantic-event order. Missing events, forged roots, cross-organization lineage,
or non-canonical arrays make the read unavailable rather than partially trusted.

### Threat Model

The design must reject or contain:

- a caller substituting request, manifest, delivery/access roots, recipient,
  attester, timestamp, or server-derived safety fields;
- positive use asserted by a non-recipient, after request/agreement/manifest
  authority ends, or while a restriction exists;
- suppression of `no_use`, misuse challenges, or revocation requests merely
  because access was later revoked or expired;
- Agent self-approval, inactive/cross-organization membership, anonymous
  attestation, duplicate or malformed hashes, unbounded arrays/text, raw/private
  material, and unsafe claims;
- a source row without an exact semantic event, mismatched event action or
  payload, canonical ID/hash/root substitution, update/delete mutation, and
  idempotency-key reuse with changed content;
- accidental opening of enforcement, restriction, accountability, or public
  disclosure routes before their durable adapters exist.

Residual risks are dishonest human statements, compromised upstream evidence,
colluding organization members, incomplete external transport telemetry, and
privileged database-owner compromise. Attestations expose actor, time,
limitations, hashes, and challenge evidence so independent review can assess
those risks; they do not claim to eliminate them.

### API Design

The following existing routes become durable when authorization binding source
is PostgreSQL:

```text
POST /canopyproof/data-access-deliveries/:deliveryId/use-attestations
GET  /canopyproof/data-access-deliveries/:deliveryId/use-attestations
GET  /canopyproof/data-use-attestations/:attestationId
```

`POST` accepts only `usageState`, `useCase`, `outputHashes`,
`evidenceEventRoots`, `limitations`, and optional `attestedAt`. It requires a
bounded `Idempotency-Key` and organization binding matching the delivery.
Delivery, request, manifest, access, and actor fields are server-derived. Reads
remain limited to existing institutional reader roles and the same organization
scope. Stable trust-registry `400`/`409`/`503` errors apply.

The subsequent independent enforcement-review and restriction-state-stream
extensions govern their exact create/list/get routes. Accountability and public
disclosure remain behind the pending-persistence guard.

### Database Changes

- Harden `organizations.data_use_attestations` with bounded text/arrays, hash
  shapes, exact safety, normalized-array checks, chronology, delivery/request/
  manifest lineage, and organization/delivery/time indexes.
- Add an insert validator requiring matching `app.actor_id`, a verified human
  participant, active classification-appropriate organization membership,
  delivery chronology, state-specific recipient and authority rules, and exact
  source lineage.
- Extend semantic-event binding to use attestations and require the expected
  `ASSERT` or `CHALLENGE` action, stream, actor, entity ID, timestamp, and
  canonical payload hash.
- Recompute attestation ID/hash and usage root in PostgreSQL. Keep update/delete
  guards and database v2 mutation capture.

### Migration Strategy

1. Deploy constraints, canonical hash functions, insert validation, event
   binding, indexes, and append-only controls before opening routes.
2. Inventory legacy attestations. Accept only rows whose delivery, request,
   manifest, actor membership, event action/time, normalized arrays, safety, and
   roots replay exactly; quarantine ambiguous rows.
3. Shadow-read reviewed rows and compare event-time request/agreement authority,
   recipient separation, state-specific evidence requirements, and roots.
4. Enable creation, then list/get after exact/conflicting retry, rollback,
   tamper, post-revocation challenge, positive-use expiry, cross-organization,
   concurrency, and reconnect tests pass.
5. Keep enforcement and all downstream mutation/read paths fail-closed until
   their own RFCs and durable dependency replay are complete.

### Rollback Strategy

- Disable attestation mutations/reads or return durable-write unavailable; never
  restore process-local production success.
- Preserve every committed attestation, semantic event, command receipt, and
  database audit event. Corrections and contradictions are new attestations or
  later governance records, never updates or deletes.
- Repair requires dual control, incident evidence, accountable actors, and
  independent root replay. Rollback cannot suppress challenge evidence, expose
  raw data, bypass the dedicated enforcement-review contract, open restriction
  routes, weaken origin authentication, enable admin proxying, merge API/Web
  Workers, or alter claim/fund safety boundaries.

## Durable Independent Data Use Enforcement Review Extension

Status: accepted and implemented for the independent enforcement-review
boundary. This extension moves
data-use enforcement case creation and organization-scoped reads into the
transactional PostgreSQL trust registry. An enforcement case is an immutable,
independent human review disposition over a challenged use attestation. It is
not an access restriction, legal judgment, environmental verification, carbon
claim, financial authority, or automated decision.

### Problem Statement

The compatibility service currently stores enforcement cases in a process-local
`Map`. A restart loses the review, concurrent workers can diverge, and the SQL
table accepts rows without independently proving reviewer identity, conflict
separation, challenged-attestation lineage, canonical hashes, or semantic-event
payload. The domain also requires the data-access request to remain currently
approved. That suppresses review after revocation or expiry, even though those
events are precisely when an institution must preserve challenge handling.

Production needs a durable review boundary that can investigate historically
valid deliveries after authority ends while remaining incapable of mutating
access by itself.

### Trust Model

- A case may reference only a `misuse_challenged` or
  `revocation_requested` attestation whose delivery, request, manifest, access
  root, delivery root, attestation hash, usage root, and semantic event replay
  exactly.
- The original delivery must have been valid when recorded. Current request,
  agreement, or manifest authority is not required to append a later review;
  revocation and expiry must not erase accountability.
- The reviewer must be a verified human participant in the same verified
  organization with an active owner, admin, or verifier membership. Agents
  cannot open or resolve enforcement review on their own authority.
- The reviewer must differ from the attester, delivery recipient, and delivery
  actor. This is a minimum conflict-separation rule, not a claim of complete
  institutional independence.
- `reviewedAt` cannot precede the challenged attestation. Evidence roots include
  every root carried by the challenge plus any additional normalized,
  hash-only review evidence.
- Case state and recommended action use a closed compatibility matrix. Actions
  named `suspend_data_access` or `revoke_data_access` are recommendations only;
  they cannot mutate access without the separately governed restriction path.
- Each row is an immutable review disposition, not a mutable workflow object.
  Multiple independent or contradictory dispositions remain visible for later
  governance. Exact duplicate commands return the original record.
- PostgreSQL and TypeScript independently recompute the deterministic case ID,
  enforcement hash, enforcement root, expected event action, and semantic-event
  payload hash from the same canonical JSON ordering.
- A case cannot approve itself, settle a dispute automatically, certify impact,
  expose raw/private data, move funds, distribute CANOPY, issue a carbon credit
  or tax offset, create a financial asset, or promise yield.

### Data Flow

```text
origin-verified human owner/admin/verifier
  -> challenged attestation ID + bounded review disposition
  -> normalized evidence-event roots + bounded Idempotency-Key
  -> command advisory lock
  -> organization semantic-stream advisory lock
  -> lock and replay organization, request, delivery, attestation, and actor rows
  -> verify historical delivery and challenged-attestation canonical lineage
  -> verify reviewer identity, membership, separation, chronology, state/action
  -> append semantic event
  -> insert immutable enforcement review row
  -> update organization summary timestamp only
  -> append database v2 mutation event + command receipt
  -> COMMIT
  -> return the committed event-time projection
```

Reads reconstruct the organization audit stream and every upstream authority
row in one repeatable-read transaction. Missing, malformed, unbound, reordered,
or non-canonical lineage returns durable-write unavailable rather than a
partially trusted case.

### Threat Model

The extension must reject or contain:

- a within-scope or no-use attestation being relabelled as an enforcement
  challenge;
- self-review, review by the delivery recipient or delivery actor, Agent review,
  inactive membership, cross-organization substitution, or unverified actors;
- deletion of challenge evidence, malformed/duplicate/unbounded roots,
  backwards timestamps, invalid state/action combinations, raw evidence,
  private contacts, credentials, secrets, and private keys;
- suppression of review because the request or agreement was later revoked,
  superseded, restricted, or expired;
- a forged delivery, attestation, case hash/root, case identifier, event action,
  payload hash, actor, time, or stream binding;
- idempotency-key reuse with different content, partial event/source commits,
  update/delete mutation, and process-memory success in production;
- treating a recommended enforcement action as an access mutation, opening the
  restriction route early, or allowing an enforcement record to claim final
  legal, environmental, carbon, tax, or financial authority.

Residual risks include colluding humans, dishonest challenge evidence,
compromised upstream source registries, institutional conflicts not expressible
by actor IDs, and privileged database-owner compromise. The case exposes
reviewer, evidence roots, lineage, time, limitations, and recommendation so
external governance can assess those risks; it does not claim to eliminate
them.

### API Design

The following existing routes become durable when authorization binding source
is PostgreSQL:

```text
POST /canopyproof/data-use-attestations/:attestationId/enforcement-cases
GET  /canopyproof/data-use-attestations/:attestationId/enforcement-cases
GET  /canopyproof/data-use-enforcement-cases/:caseId
```

`POST` accepts only `caseState`, `enforcementAction`, `rationale`,
`evidenceEventRoots`, and optional `reviewedAt`. It requires a bounded
`Idempotency-Key`, verified-organization assurance, and an organization binding
matching the attestation. Request, delivery, manifest, attestation roots, actor
organization, and safety fields are server-derived. Reads remain limited to
existing institutional reader roles in the same organization. Stable trust-
registry `400`/`409`/`503` errors apply.

The subsequent restriction-state-stream extension governs access-restriction
mutation and reads. Accountability packets and public disclosure remain behind
the pending-persistence guard. This RFC does not open or emulate those paths.

### Database Changes

- Harden `organizations.data_use_enforcement_cases` with bounded rationale and
  evidence arrays, normalized SHA-256 roots, exact safety, hash/root shapes,
  state/action compatibility, chronology, and organization/attestation/request
  indexes.
- Add an insert validator requiring matching `app.actor_id`, a verified
  organization, a verified human reviewer with active owner/admin/verifier
  membership, reviewer/attester/recipient/deliverer separation, challenged
  attestation state, retained challenge roots, and exact request/delivery/
  manifest lineage.
- Recompute and revalidate upstream delivery and use-attestation IDs, hashes,
  roots, and event payloads before admitting the downstream case.
- Extend semantic-event binding to require the expected `CHALLENGE` or
  `FULFILL` action, stream, actor, entity ID, timestamp, and canonical payload
  hash. Recompute case ID/hash and enforcement root in PostgreSQL.
- Retain append-only update/delete guards and database v2 mutation capture.

### Migration Strategy

1. Deploy constraints, indexes, canonical hash functions, dependency replay,
   semantic binding, and append-only validation before opening routes.
2. Inventory legacy case rows. Admit only rows whose challenged attestation,
   delivery, request, manifest, reviewer membership/separation, event, safety,
   normalized roots, and canonical hashes replay exactly; quarantine every
   ambiguous row.
3. Shadow-read reviewed rows and compare TypeScript/PostgreSQL projections,
   including post-revocation review and conflict-separation outcomes.
4. Enable create, then list/get after exact/conflicting retry, rollback,
   tampering, invalid-state/action, self-review, recipient-review,
   post-revocation, concurrency, append-only, and reconnect tests pass.
5. Keep restriction and downstream accountability paths fail-closed until each
   receives its own RFC, durable command adapter, dependency replay, and
   adversarial tests.

### Rollback Strategy

- Disable enforcement-case mutations/reads or return durable-write unavailable;
  never restore process-local production success.
- Preserve every committed case, challenge, semantic event, command receipt,
  and database audit event. Corrections and competing findings are new rows,
  never updates or deletes.
- Rollback cannot mutate access, suppress adverse evidence, expose raw data,
  weaken human review or origin authentication, open restriction routes, bypass
  environment approval, enable admin proxying, merge API/Web Workers, restore
  SVG branding, or alter claim/fund safety boundaries.

## Durable Data Access Restriction State Stream Extension

Status: accepted and implemented for the durable restriction boundary. This
extension moves request-level access restriction creation and
organization-scoped reads into the transactional PostgreSQL trust registry. A
restriction is a separately approved operational control over future governed
deliveries. It is not a
rewrite of the original request, a legal judgment, an environmental
certificate, or financial/carbon authority.

### Problem Statement

The compatibility service stores restrictions in a process-local `Map` and
chooses current state by caller-supplied timestamp plus identifier. Concurrent
workers can therefore disagree, equal/backdated timestamps can reorder state,
and a restore row has no cryptographic predecessor. The database currently
blocks delivery when any restriction row exists, so an explicit restore can
never take effect. It also admits rows without independently validating the
separate approver, enforcement lineage, state transition, canonical hashes, or
semantic event payload.

Production requires one deterministic append-only restriction state stream per
request, serialized by semantic-event order and cryptographically linked to its
predecessor. It must fail closed under ambiguity without allowing an expired
timer or enforcement recommendation to restore access automatically.

### Trust Model

- Initial state is unrestricted and has no stored row. The first restriction
  may be `remediation_hold`, `suspended`, or `revoked`; it cannot be
  `restored`.
- Every later row binds the exact previous restriction ID, root, and state.
  A partial unique successor rule plus the organization semantic-stream lock
  prevents two concurrent successors from consuming the same predecessor.
- Allowed transitions are monotonic escalation or explicit restoration:
  `remediation_hold -> suspended|revoked|restored`,
  `suspended -> revoked|restored`, `revoked -> restored`, and
  `restored -> remediation_hold|suspended|revoked` when a new challenged case
  justifies a new cycle. Repeating an active state is rejected.
- `remediation_hold`, `suspended`, and `revoked` must match respectively a
  `require_remediation`, `suspend_data_access`, or `revoke_data_access`
  enforcement recommendation. `restored` requires a separate immutable
  enforcement disposition in `resolved` state.
- The decision actor must be a verified human in the same verified organization
  with active owner or admin membership. The actor must differ from the
  enforcement reviewer, challenge attester, delivery recipient, and delivery
  actor. A restoration actor must also differ from the actor who imposed the
  immediately preceding active restriction.
- Every row retains all enforcement evidence roots. `decidedAt` cannot predate
  the enforcement review or predecessor restriction. An optional `expiresAt`
  must follow `decidedAt`, but it is a review deadline only: expiry never
  auto-restores access. Explicit restored state is mandatory.
- Current restriction state is replayed strictly in organization semantic-event
  sequence, never by client timestamp. Any missing predecessor, fork, gap,
  malformed event, or non-canonical hash fails closed.
- PostgreSQL and TypeScript independently recompute restriction ID/hash/root,
  predecessor binding, expected event action, and semantic-event payload hash.
- An active restriction blocks future delivery receipts and positive
  `within_scope` attestations. It does not erase historical delivery/use facts,
  mutate request history, decide an enforcement case, expose raw data, move
  funds, distribute CANOPY, or create carbon, tax, asset, or yield claims.

### Data Flow

```text
origin-verified human owner/admin
  -> enforcement case ID + bounded restriction decision
  -> bounded Idempotency-Key
  -> command advisory lock
  -> organization semantic-stream advisory lock
  -> lock/replay request, delivery, challenge, enforcement, restriction stream
  -> derive exact predecessor from semantic event sequence
  -> verify human authority, separation, state/action, chronology, evidence
  -> append semantic event
  -> insert immutable predecessor-bound restriction row
  -> update organization summary timestamp only
  -> append database v2 mutation event + command receipt
  -> COMMIT
  -> future delivery/use authorization replays latest restriction event
```

Reads return the complete append-only stream or one exact row after replaying
all upstream authority and predecessor links in a repeatable-read transaction.
They never synthesize a restore from wall-clock expiry.

### Threat Model

The extension must reject or contain:

- an enforcement recommendation directly mutating access without a distinct
  owner/admin decision actor;
- self-approval, recipient/deliverer approval, Agent approval, inactive or
  cross-organization membership, and unverified actors;
- a remediation/suspension/revocation state inconsistent with its enforcement
  recommendation, or restoration without a resolved independent review;
- first-row restore, active-state repetition, de-escalation without explicit
  restore, stale predecessor, concurrent successor fork, backdated decision,
  and invalid/automatic expiry-based restoration;
- omitted enforcement evidence, malformed/duplicate/unbounded roots, raw or
  private material, credentials, secrets, and private keys;
- forged request/delivery/attestation/enforcement lineage, restriction ID/hash/
  root, event action/payload/actor/time/stream, update/delete mutation, or
  idempotency-key reuse with changed content;
- a restored historical row bypassing a later active restriction, or an active
  restriction being ignored by delivery or positive-use authorization;
- suppression of historical facts, accidental opening of accountability/public
  disclosure routes, or treating operational access control as legal,
  environmental, carbon, tax, or financial authority.

Residual risks include colluding owner/admin actors, compromised upstream
evidence, governance conflicts not represented by actor IDs, external systems
that ignore the CanopyProof decision endpoint, and privileged database-owner
compromise. The stream makes those decisions attributable and replayable; it
does not claim jurisdiction over external systems.

### API Design

The following existing routes become durable when authorization binding source
is PostgreSQL:

```text
POST /canopyproof/data-use-enforcement-cases/:caseId/access-restrictions
GET  /canopyproof/data-access-requests/:requestId/restrictions
GET  /canopyproof/data-access-restrictions/:restrictionId
```

`POST` accepts only `restrictionState`, `rationale`, `evidenceEventRoots`,
optional `decidedAt`, and optional `expiresAt`. It requires a bounded
`Idempotency-Key`, verified-organization assurance, and an organization binding
matching the enforcement case. The request, delivery, attestation, enforcement,
predecessor, roots, actor organization, and safety boundary are server-derived.
Reads remain limited to institutional reader roles in the same organization.
Stable trust-registry `400`/`409`/`503` errors apply.

The subsequent packet and replay-verification extensions govern those exact
create/read routes. Public disclosure and challenge workflows remain behind the
pending-persistence guard.

### Database Changes

- Add nullable predecessor ID/root/state columns for migration, exact
  predecessor consistency checks, a partial unique successor index, and
  organization/request/event-order indexes.
- Harden rationale, evidence roots, timestamps, hash/root/event shapes, exact
  safety, state values, and expiry rules with migration-safe constraints.
- Add an insert validator requiring matching `app.actor_id`, verified
  organization and human owner/admin membership, conflict separation, complete
  upstream canonical replay, retained enforcement evidence, allowed transition,
  chronology, and exact predecessor.
- Extend semantic-event binding for restriction rows and recompute restriction
  ID/hash/root plus canonical payload hash in PostgreSQL.
- Replace the conservative any-row delivery block with fail-closed semantic
  replay of the latest valid restriction state. A latest non-restored state
  blocks delivery and positive use; a valid restored row clears only the
  restriction layer and cannot override request/agreement/manifest checks.
- Retain append-only update/delete guards and database v2 mutation capture.

### Migration Strategy

1. Deploy nullable predecessor columns, constraints, indexes, canonical
   functions, validators, and replay helpers while routes remain closed.
2. Inventory legacy restrictions in semantic-event order. Construct predecessor
   links only where one unambiguous, fully event-bound stream can be replayed;
   quarantine forks, gaps, timestamp-only ordering, invalid transitions, and
   rows lacking independent approval.
3. Validate or replace constraints only after reviewed rows replay identically
   in TypeScript and PostgreSQL. Do not infer restoration from expiry.
4. Shadow-evaluate delivery and positive-use authorization against the durable
   restriction projection and compare fail-closed outcomes.
5. Enable create, then list/get after exact/conflicting retry, concurrent
   successor, stale predecessor, self-approval, state/action mismatch,
   backdating, expiry, restoration, tamper, append-only, reconnect, and delivery-
   blocking tests pass.
6. Keep accountability and public disclosure closed until their separate RFCs
   and durable replay adapters are complete.

### Rollback Strategy

- Disable restriction mutations/reads and fail future delivery/positive use
  closed when restriction state cannot be durably replayed. Never restore
  process-local production success or treat missing data as unrestricted.
- Preserve every committed restriction, enforcement case, challenge, semantic
  event, command receipt, and database audit event. Repair adds governed rows or
  quarantines authority; it never rewrites or deletes history.
- Rollback cannot auto-restore expired restrictions, bypass independent human
  approval, suppress adverse evidence, expose raw data, open accountability or
  disclosure routes, weaken origin authentication, enable admin proxying, merge
  API/Web Workers, restore SVG branding, or alter claim/fund boundaries.

## Durable Hash-Only Data Access Accountability Packet Extension

Status: accepted and implemented for the durable packet boundary. This
extension moves accountability packet creation and organization-scoped reads into the
transactional PostgreSQL trust registry. A packet is an immutable, bounded
snapshot of hash-only governance lineage at one semantic-event position. It is
not proof that data was downloaded or used correctly, not a replay verification,
and not environmental, legal, carbon, tax, asset, or yield authority.

### Problem Statement

The compatibility service currently builds packets from process-local maps and
orders them by caller timestamps. The existing SQL table accepts loosely shaped
JSON counts, lineage arrays, and subset safety flags without independently
recomputing the packet ID, hash, root, source snapshot, or semantic event
payload. A worker restart loses packets, an arbitrary row can claim unrelated
roots, and loading a historical packet after later governance events risks
recomputing it against the present instead of its creation boundary.

Production requires database-authoritative packet generation at an exact
organization event sequence. Historical packet integrity must replay the
ledger as it existed immediately before the packet event, while a later replay-
verification workflow may separately compare that preserved snapshot with the
current ledger.

### Trust Model

- A packet binds exactly one immutable data-access request and its agreement in
  the same verified organization.
- The generator must be a verified human with active owner, admin, verifier, or
  researcher membership in that organization. Observer and Agent identities
  cannot create packets.
- Packet source state is the ledger prefix before the packet semantic event:
  request decisions, agreement revocation/supersession, deliveries, use
  attestations, enforcement cases, and restrictions are included only when
  their exact bound event precedes the packet event.
- Request status is projected from the latest preceding decision. Active
  restriction count is `0` or `1` from the latest preceding restriction state;
  total restriction count preserves the full preceding history.
- Counts are exact non-negative integers. Every lineage root array is bounded,
  lowercase SHA-256, sorted, and unique. Version 1 rejects an over-limit packet
  rather than silently truncating lineage; segmented checkpoints require a
  separate RFC.
- Intended audience is bounded institutional metadata and cannot contain raw
  data, private contact material, credentials, secrets, or private keys.
- PostgreSQL and TypeScript independently recompute the packet snapshot, ID,
  packet hash, packet root, expected `ASSERT` event, and event payload hash.
- Packet rows, semantic events, command receipts, and database audit events are
  append-only. Exact idempotent retries return the original packet; changed
  payload under the same key returns a conflict.
- Creating or reading a packet grants no access, mutates no restriction, makes
  no verification decision, publishes nothing, moves no funds, and creates no
  CANOPY, carbon-credit, tax-offset, financial-asset, or guaranteed-yield claim.

### Data Flow

```text
origin-verified institutional human
  -> request ID + bounded intended audience
  -> bounded Idempotency-Key
  -> command advisory lock
  -> organization semantic-stream advisory lock
  -> lock and replay request authority plus hash-only ledger prefix
  -> derive current status, exact counts, and sorted roots
  -> append ASSERT semantic event
  -> insert immutable canonical packet
  -> update organization summary timestamp only
  -> append database v2 mutation event + command receipt
  -> COMMIT
```

Reads hydrate the packet together with its source authority and verify it at the
packet event order. They do not silently refresh an old packet with newer roots.

### Threat Model

The extension must reject or contain:

- unverified, inactive, cross-organization, observer, or Agent generators;
- a packet bound to a missing or foreign request/agreement;
- caller-supplied counts, lineage roots, request status, safety flags, actor, or
  organization fields;
- malformed, duplicate, unsorted, unbounded, non-SHA-256, omitted, or truncated
  lineage roots and negative/fractional/overflowing counts;
- a future source event included in a historical packet, a preceding source
  event omitted from it, or timestamp ordering substituted for event order;
- forged packet ID/hash/root, event actor/action/time/stream/payload, update or
  delete mutation, and idempotency-key reuse with changed content;
- stale current-state comparison being confused with historical packet
  corruption;
- accidental opening of replay verification or public governance paths before
  their own durable adapters exist.

Residual risks include colluding institutional actors, compromised upstream
evidence, denial of service from very large histories, and privileged database-
owner compromise. Version 1 fails closed when a lineage category exceeds its
bound; it does not summarize or truncate without an explicitly versioned
checkpoint design.

### API Design

The following existing routes become durable when authorization binding source
is PostgreSQL:

```text
POST /canopyproof/data-access-requests/:requestId/accountability-packets
GET  /canopyproof/data-access-requests/:requestId/accountability-packets
GET  /canopyproof/data-access-accountability-packets/:packetId
```

`POST` accepts only `intendedAudience` and optional `generatedAt`, requires a
bounded `Idempotency-Key`, verified-organization assurance, and an organization
binding matching the request. All authority, counts, roots, status, hash, and
safety fields are server-derived. Reads require an institutional reader role in
the same organization. Stable trust-registry `400`/`409`/`503` errors apply.

At this packet-extension boundary, replay verification and the later public
governance routes remained behind the pending-persistence guard. The subsequent
extensions in this RFC now implement verification, disclosure, challenge,
resolution, and notice durability.

### Database Changes

- Harden packet audience, timestamps, request status, exact count keys/values,
  exact lineage keys/arrays, ID/hash/root/event shapes, and exact safety with
  migration-safe constraints and organization/request/event indexes.
- Add canonical JSON helpers for counts, lineage roots, and safety, plus
  database functions for packet hash, packet root, and semantic payload hash.
- Add an insert validator requiring matching `app.actor_id`, verified human
  institutional authority, exact request/agreement lineage, exact packet event
  order, complete source-event bindings, bounded source sets, and database-
  recomputed packet fields.
- Extend data-access semantic-event binding to packet rows with exact actor,
  organization stream, `ASSERT` action, entity, and generated timestamp.
- Retain append-only update/delete guards and database v2 mutation capture.

### Migration Strategy

1. Deploy constraints, canonical helpers, validator, event binding, and indexes
   while packet routes remain closed.
2. Inventory legacy packets. Admit a row only when its exact event-bound ledger
   prefix can be reconstructed and matches all stored fields; quarantine all
   ambiguous, timestamp-only, over-limit, or non-canonical rows.
3. Validate constraints only after reviewed rows replay identically in
   TypeScript and PostgreSQL. Never rewrite a packet to current lineage.
4. Enable create, then list/get after exact/conflicting retry, concurrent
   creation, source omission/addition, tamper, event mismatch, append-only,
   reconnect, and historical-versus-current replay tests pass.
5. Keep verification and every public-accountability path closed until each has
   a separate durable RFC, implementation, and review gate.

### Rollback Strategy

- Disable packet mutation/reads with durable-write unavailable; never restore a
  process-memory production fallback.
- Preserve every committed packet, source record, semantic event, command
  receipt, and database audit event. Repair adds governed records or quarantines
  authority; it never rewrites or deletes history.
- Rollback cannot expose raw data, treat a packet as current verification,
  publish a disclosure, weaken human authorization or origin authentication,
  bypass restrictions, enable admin proxying, merge API/Web Workers, restore SVG
  branding, or alter claim/fund boundaries.

## Durable Data Access Accountability Replay Verification Extension

Status: accepted and implemented for the durable replay-verification boundary.
This extension moves accountability packet replay verification and organization-scoped verification
reads into the transactional PostgreSQL trust registry. A verification is an
immutable human-attributed comparison between one canonical historical packet
and the governed ledger prefix at a later event boundary. It is not public
publication, final proof authority, or legal, carbon, tax, asset, or yield
certification.

### Problem Statement

The compatibility service currently computes verification in process memory,
stores it in a `Map`, and conflates normal ledger evolution with packet
corruption: any later event causes `packet_hash_mismatch` and
`packet_root_mismatch` even when the historical packet remains canonical. The
SQL table accepts caller-shaped issues, recomputed roots, validity, and subset
safety flags without replaying either the packet creation boundary or current
ledger boundary. It has no exact semantic-event or actor-authority validator.

Production requires two distinct replays. First, the packet must remain
canonical against the ledger prefix at its own event. Second, current counts and
roots must be derived immediately before the verification event. A difference
between those valid snapshots is `lineage_stale`, not evidence that the
historical packet was altered.

### Trust Model

- Verification binds one canonical packet, request, and organization. The
  packet creation snapshot is replayed before current-state comparison.
- The verifier must be a verified human with active owner, admin, verifier,
  researcher, or observer membership in the same verified organization and
  must differ from the packet generator. Agent identities cannot verify.
- Verification source state is the exact ledger prefix before the verification
  semantic event. Caller timestamps never choose event ordering.
- `packet_hash_mismatch` and `packet_root_mismatch` mean the stored historical
  packet does not match its own canonical fields or creation snapshot.
  `lineage_stale` alone represents later governed ledger evolution.
  `expected_root_mismatch` represents an optional caller-pinned root mismatch;
  `safety_boundary_violation` represents a non-canonical packet safety boundary.
- Issues are bounded, sorted, unique, and fully database-derived. `valid=true`
  is allowed only when the issue set is empty.
- The verification root binds organization, packet/request IDs, valid flag,
  issues, optional expected root, stored and recomputed hashes/roots, verifier,
  timestamp, and exact safety boundary. Its event payload binds the same fields.
- Exact idempotent retries return the original verification; changed content
  under the same key conflicts. Every row, event, receipt, and database audit
  record is append-only.
- Verification does not grant access, mutate a restriction, publish a packet,
  move funds, distribute CANOPY, or create proof, carbon-credit, tax-offset,
  financial-asset, or guaranteed-yield authority.

### Data Flow

```text
origin-verified independent institutional human
  -> packet ID + optional expected packet root
  -> bounded Idempotency-Key
  -> command advisory lock
  -> organization semantic-stream advisory lock
  -> replay packet at packet event boundary
  -> replay current ledger before verification event
  -> derive stored/current hashes, roots, issues, and valid flag
  -> append ASSERT or CHALLENGE semantic event
  -> insert immutable canonical verification
  -> update organization summary timestamp only
  -> append database v2 mutation event + command receipt
  -> COMMIT
```

Reads replay packet and verification integrity at their historical event
boundaries. They never recalculate and overwrite a prior verification when the
ledger changes again.

### Threat Model

The extension must reject or contain:

- self-verification by the packet generator, Agent verification, unverified,
  inactive, missing, or cross-organization membership;
- caller-supplied valid flags, issue lists, hashes, roots, actor, organization,
  request, safety, or event fields;
- a packet accepted without canonical creation-boundary replay;
- current ledger sources omitted, added, reordered by timestamp, unbound to
  exact events, or silently truncated;
- normal staleness mislabeled as packet corruption, or a stale packet reported
  valid because only stored fields were checked;
- malformed/duplicate/unsorted issues, inconsistent valid flag, non-canonical
  optional expected root, forged verification root, or mismatched event payload;
- update/delete mutation, duplicate concurrent effects, or idempotency-key reuse
  with changed content;
- accidental opening of disclosure, public challenge, resolution, or notice
  routes before their durable adapters exist.

Residual risks include colluding institutional humans, compromised upstream
evidence, external consumers ignoring stale results, and privileged database-
owner compromise. Replay verification makes the comparison attributable; it
does not certify ecological truth beyond the referenced governance lineage.

### API Design

The following existing routes become durable when authorization binding source
is PostgreSQL:

```text
POST /canopyproof/data-access-accountability-packets/:packetId/verify
GET  /canopyproof/data-access-accountability-packets/:packetId/verifications
GET  /canopyproof/data-access-accountability-verifications/:verificationId
```

`POST` accepts only optional `expectedPacketRoot` and optional `verifiedAt`,
requires a bounded `Idempotency-Key`, verified-organization assurance, and an
organization binding matching the packet. Every replay field is server-derived.
Reads require an institutional reader role in the same organization. Stable
trust-registry `400`/`409`/`503` errors apply.

Disclosure publication and every public-accountability challenge, resolution,
and notice path remain behind the pending-persistence guard.

### Database Changes

- Harden optional expected root, all stored/recomputed hash shapes, sorted issue
  set, valid consistency, exact safety, chronology, and event root with
  migration-safe constraints and packet/organization event indexes.
- Add canonical verification safety, root, and event-payload functions.
- Add an insert validator requiring matching `app.actor_id`, verified human
  institutional membership, packet-generator separation, exact packet
  creation-boundary replay, exact current-boundary replay, database-derived
  issues/validity, and canonical verification/event fields.
- Extend data-access semantic-event binding with exact `ASSERT` for valid and
  `CHALLENGE` for invalid verification rows.
- Retain append-only update/delete guards and database v2 mutation capture.

### Migration Strategy

1. Deploy constraints, canonical helpers, validator, event binding, and indexes
   while verification routes remain closed.
2. Inventory legacy verifications. Admit only rows whose packet and current
   historical boundaries can both be reconstructed exactly; quarantine rows
   whose timestamp-only ordering or issue semantics are ambiguous.
3. Reclassify normal historical evolution as `lineage_stale`; never rewrite a
   committed row. Migration corrections require new governed verification rows.
4. Enable create, then list/get after clean, stale, expected-root mismatch,
   tamper, self-verification, event mismatch, append-only, concurrent retry, and
   reconnect tests pass.
5. Keep disclosure and public governance routes closed until their own durable
   RFCs and adapters are complete.

### Rollback Strategy

- Disable verification mutation/reads with durable-write unavailable; never
  restore process-memory production success or treat an absent verification as
  valid.
- Preserve every packet, verification, semantic event, command receipt, and
  database audit record. Repair appends governed facts; it never rewrites prior
  results.
- Rollback cannot publish a disclosure, suppress stale findings, expose raw
  data, weaken independent human authorization or origin authentication, bypass
  restrictions, enable admin proxying, merge API/Web Workers, restore SVG
  branding, or alter claim/fund boundaries.

## Durable Public Data Access Accountability Disclosure Extension

Status: accepted and implemented at the disclosure-publication boundary.
This extension makes one hash-only accountability packet disclosure durable and
publicly readable after independent replay verification. It does not open the
challenge, resolution, correction, or withdrawal mutation surfaces. A
disclosure is a transparency record about governed data-access lineage, not a
grant of access, an environmental proof decision, or legal, carbon, tax, asset,
or yield certification.

### Problem Statement

The compatibility service currently publishes disclosures into a process-local
`Map`. PostgreSQL has a preliminary table, but its insert trigger checks only a
subset of source fields. It does not independently derive the disclosure ID,
hash, root, exact safety boundary, publication event payload, actor authority,
or packet currency at the publication event. Public reads use process memory,
so a worker restart loses the index and production correctly fails them closed.

Production needs a database-authoritative publication command and public,
hash-only reads. The database must prove that packet generation, replay
verification, and publication are three distinct human actions in one verified
organization and that no governed ledger event made the packet stale between
verification and publication.

### Trust Model

- A disclosure binds exactly one canonical packet and one valid replay
  verification for that packet. One packet can have at most one disclosure.
- The publisher must be a verified human with active owner or admin membership
  in the packet organization. The publisher, packet generator, and replay
  verifier must be three different actors. Agent identities cannot publish.
- Packet, verification, and disclosure semantic events must be strictly ordered
  in one organization stream. Caller timestamps do not establish authority.
- The packet is replayed at its creation event and again immediately before the
  disclosure event. Publication is rejected if the historical packet is
  non-canonical, its verification is invalid, or current lineage differs.
- PostgreSQL and TypeScript independently derive the disclosure ID, hash, root,
  exact safety object, `FULFILL` event binding, and semantic payload hash.
- The public representation contains stable IDs, SHA-256 hashes/roots,
  pseudonymous actor IDs, timestamps, policy ID, safety boundaries, and derived
  current/stale state. It contains no raw dataset, evidence body, precise
  location, private contact data, credential, secret, token, or private key.
- Public list reads are cursor-paginated with a hard limit of 100. They expose
  immutable source roots and make later lineage staleness visible rather than
  rewriting the original disclosure.
- Exact idempotent retries return the committed disclosure. Changed input under
  the same key conflicts. Disclosure rows, events, receipts, and database audit
  records are append-only.
- Publication does not grant data access, mutate restrictions, decide a proof,
  move funds, distribute CANOPY, or create a carbon-credit, tax-offset,
  financial-asset, or guaranteed-yield claim.

### Data Flow

```text
origin-verified owner/admin publisher
  -> packet ID + valid verification ID
  -> bounded Idempotency-Key
  -> command advisory lock
  -> organization semantic-stream advisory lock
  -> lock packet, verification, request, organization, publisher authority
  -> replay packet creation boundary
  -> replay current lineage before disclosure event
  -> enforce three distinct human actors and strict event order
  -> derive canonical hash, root, safety, ID, and FULFILL event payload
  -> append semantic event
  -> insert immutable disclosure
  -> update organization summary timestamp only
  -> append database v2 mutation event + command receipt
  -> COMMIT
```

Unauthenticated public reads use the configured PostgreSQL trust registry. In
production they never fall back to process memory. They hydrate and verify only
the bounded page plus the authority needed to derive each current/stale view.

### Threat Model

The extension must reject or contain:

- publication by an unverified, inactive, cross-organization, non-human,
  observer, researcher, verifier, community, or Agent identity;
- packet generation, replay verification, and publication by fewer than three
  distinct actors;
- a verification for another packet/request/organization, an invalid or stale
  verification, or publication before verification;
- a valid verification followed by a ledger mutation that makes the packet
  stale before publication;
- caller-supplied organization, packet hashes/roots, policy, actor, safety,
  disclosure hash/root/ID, event action, stream, timestamp, or payload;
- subset safety JSON, malformed hashes, non-millisecond timestamps, forged or
  missing semantic-event binding, updates/deletes, duplicate concurrent
  effects, and changed-content idempotency retries;
- unauthenticated reads disclosing raw data or private identity/contact fields,
  unbounded enumeration, or silently using memory in production;
- accidental opening of challenge, resolution, correction, or withdrawal
  mutation/read paths before those records receive their own durable replay and
  authorization review.

Residual risks include collusion among three institutional humans, compromised
upstream evidence, denial of service through very large public indexes, public
consumers ignoring a later `stale` state, and privileged database-owner
compromise. A disclosure attests to transparent lineage and separation of
duties; it does not independently establish ecological truth.

### API Design

The following existing routes become durable:

```text
POST /canopyproof/data-access-accountability-packets/:packetId/disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/status
GET  /canopyproof/public-accountability/data-access-disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId
```

`POST` accepts only `verificationId` and optional `publishedAt`, requires a
bounded `Idempotency-Key`, verified-organization assurance, owner/admin role,
and an organization binding matching the packet. All other fields are
server-derived. Public `GET` routes require no institutional identity, remain
rate limited, expose only the hash-only disclosure view, and use a maximum page
size of 100. Filters remain limited to organization ID, current/stale state,
and governance state; until the challenge adapter is implemented, newly
durable disclosures are `unchallenged`.

Challenge, resolution, correction, withdrawal, and their record reads remain
behind the pending-persistence guard.

### Database Changes

- Harden disclosure hash/root/event shapes, millisecond chronology, exact
  policy and safety JSON, and packet/organization publication indexes with
  migration-safe constraints.
- Add canonical disclosure safety, hash, root, and event-payload functions.
- Add an insert validator requiring matching `app.actor_id`, verified owner or
  admin human membership, exact packet/verification/request/organization
  lineage, three-actor separation, exact event ordering, packet creation replay,
  current publication-boundary replay, canonical fields, and exact event
  payload.
- Extend data-access semantic-event binding to disclosure rows with exact
  publisher, organization stream, `FULFILL` action, entity, and publication
  timestamp.
- Load disclosures into historical authority snapshots after packets and
  verifications, validating each at its own event boundary. Retain append-only
  update/delete guards and database v2 mutation capture.

### Migration Strategy

1. Deploy constraints, canonical functions, event binding, validator, indexes,
   and durable read adapter while all disclosure routes remain closed.
2. Inventory legacy rows. Admit only disclosures whose packet creation,
   verification, publication boundary, three actors, event payload, and exact
   hashes can be reconstructed. Quarantine ambiguous or process-memory-only
   records; never manufacture missing authority.
3. Validate constraints only after TypeScript and PostgreSQL replay identically.
4. Enable publication, then public list/get/status after exact/conflicting retry,
   concurrent publication, actor separation, post-verification staleness,
   tamper, event mismatch, append-only, reconnect, pagination, and no-auth public
   read tests pass.
5. Keep all challenge and corrective-governance routes closed until their own
   RFC, migration, durable commands, and independent-human tests pass.

### Rollback Strategy

- Disable publication and public reads with durable-write unavailable; never
  restore production process-memory success or return a partial public index.
- Preserve every committed disclosure, packet, verification, semantic event,
  command receipt, and database audit record. Corrections are future append-only
  records, never edits or deletes.
- Rollback cannot hide stale lineage, expose raw data, weaken three-party human
  separation or origin authentication, open challenge/correction paths, bypass
  restrictions, enable admin proxying, merge API/Web Workers, restore SVG
  branding, or alter claim/fund boundaries.

## Durable Public Data Access Accountability Disclosure Challenge Extension

Status: accepted and implemented at the public-challenge boundary. This
extension makes evidence-rooted challenges against durable accountability
disclosures append-only, database-authoritative, and publicly readable. It does
not itself approve a resolution, correction, or withdrawal. A challenge records a
human-attributed dispute requiring later independent review; it is not a
finding, proof reversal, legal judgment, carbon-credit decision, or financial
authority.

### Problem Statement

The compatibility service currently stores disclosure challenges in process
memory. The preliminary SQL trigger checks only disclosure ID/root and wall-
clock chronology. It accepts caller-shaped roles, arbitrary evidence arrays,
subset safety flags, IDs, hashes, roots, and unbound event payloads. A restart
loses challenges, while opening the route as-is would let an unverified actor or
forged row change the public governance state.

Production needs a durable challenge command that attributes one bounded public
statement to one verified human role, binds every cited evidence root to an
earlier semantic event, and derives all integrity fields in both TypeScript and
PostgreSQL. Public disclosure views must show an unresolved challenge without
pretending that a resolution exists.

### Trust Model

- A challenge binds one immutable disclosure ID and disclosure root. The
  disclosure event must precede the challenge event in the target organization
  stream.
- The challenger must be a verified human. The claimed owner, admin, verifier,
  researcher, community, or observer role must be present in a current active
  durable membership for the challenger's own verified organization. Agent
  identities cannot challenge.
- Cross-organization challenge is allowed: the event is appended to the
  challenged disclosure's organization stream while actor authority remains
  rooted in the challenger's organization. The command grants no membership or
  access in the target organization.
- Public statement text is bounded and rejects private keys, secrets, passwords,
  email/phone contact material, raw payload material, and unsupported certified-
  credit, tax-offset, automatic-token, or guaranteed-yield claims.
- Evidence event roots are required, lowercase SHA-256, sorted, unique, and
  capped at 128. Every root must identify an existing semantic event preceding
  the challenge event; callers cannot cite a future or missing event.
- PostgreSQL and TypeScript independently derive the challenge ID, hash, root,
  exact safety object, `CHALLENGE` event binding, and event payload hash.
- One actor can submit one challenge reason per disclosure. Exact idempotent
  retries return the committed challenge; changed input conflicts. Rows, events,
  command receipts, and database audit records are append-only.
- A challenge remains open until the separately governed durable resolution
  extension below appends an independent review. Public views preserve the
  original disclosure; the later notice extension now supplies the complete
  durable notice projection.

### Data Flow

```text
origin-verified human challenger
  -> disclosure ID + bounded reason/statement/evidence event roots
  -> bounded Idempotency-Key
  -> command advisory lock
  -> target organization semantic-stream advisory lock
  -> lock disclosure and challenger durable authority
  -> validate every evidence root at a prior semantic-event sequence
  -> derive canonical challenge hash, root, safety, ID, and payload
  -> append CHALLENGE semantic event to target organization stream
  -> insert immutable challenge
  -> update target organization summary timestamp only
  -> append database v2 mutation event + command receipt
  -> COMMIT
```

Unauthenticated challenge list/get and disclosure status/index/get reads use the
configured PostgreSQL trust registry. They expose public statement and hash-only
lineage but no private identity profile or contact material.

### Threat Model

The extension must reject or contain:

- anonymous, Agent, unverified, inactive, role-substituting, or membership-
  revoked challengers;
- a challenge bound to a missing disclosure, foreign organization/root, or an
  event that does not follow publication;
- missing, future, malformed, duplicate, unsorted, or over-limit evidence roots;
- private keys, credentials, secrets, email/phone material, raw data, or unsafe
  public claims embedded in the statement;
- caller-supplied organization, role not backed by durable authority, safety,
  challenge ID/hash/root, event action/stream/time/payload, or duplicate reason;
- update/delete mutation, duplicate concurrent effects, changed-content
  idempotency reuse, and process-memory production fallback;
- a public view hiding an unresolved challenge or treating it as upheld,
  dismissed, corrected, or withdrawn without durable independent review;
- accidental opening of correction, withdrawal, or notice reads before their
  adapters validate historical chains.

Residual risks include coordinated false challenges, harassment through many
independent identities, compromised evidence events, and privileged database-
owner compromise. Rate limiting, moderation, and independent resolution remain
necessary; challenge publication alone cannot determine truth.

### API Design

The following existing routes become durable:

```text
POST /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
GET  /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId
```

`POST` accepts only `reason`, `statement`, `evidenceEventRoots`, and optional
`challengedAt`; requires a bounded `Idempotency-Key`; and derives actor, role,
organization, disclosure root, safety, hashes, and event fields. Reads are
public, ordered deterministically, and remain bounded by a single disclosure or
challenge ID. Existing disclosure status/list/get routes include durable
challenge counts and `challenged` governance state.

Resolution routes are governed by the separate extension below. At this
challenge-extension boundary, correction and withdrawal notices remained
guarded; the later notice extension now implements them durably.

### Database Changes

- Harden statement length, reason, evidence-root shape/bounds/order, hash/root/
  event shapes, millisecond chronology, exact safety, and publication indexes
  with migration-safe constraints.
- Add canonical challenge safety, hash, root, and event-payload functions.
- Add an insert validator requiring matching `app.actor_id`, verified human
  durable role authority, exact disclosure lineage, prior evidence events,
  strict event order, canonical fields, and exact event payload.
- Extend data-access semantic-event binding to challenge rows with exact actor,
  target organization stream, `CHALLENGE` action, entity, and timestamp.
- Load challenges into authority snapshots after disclosures, validate each at
  its challenge event boundary, and retain append-only/database-audit triggers.

### Migration Strategy

1. Deploy constraints, canonical functions, event binding, validator, indexes,
   and durable read adapter while challenge routes remain closed.
2. Inventory legacy rows. Admit only challenges with reconstructable challenger
   authority, prior evidence events, exact disclosure binding, canonical event
   payload, and safe public text. Quarantine all ambiguous rows.
3. Validate constraints only after TypeScript and PostgreSQL replay identically.
4. Enable create, then public list/get and challenged disclosure views after
   exact/conflicting retry, concurrent challenge, role substitution, missing/
   future evidence, text leakage, tamper, event mismatch, append-only,
   reconnect, and public no-auth read tests pass.
5. Keep resolution paths closed until the separate durable RFC below, human
   independence checks, and migration review pass; keep notice paths closed
   until their own extension passes.

### Rollback Strategy

- Disable challenge mutation/reads with durable-write unavailable; never return
  an in-memory or challenge-free partial public view in production.
- Preserve every committed disclosure, challenge, event, receipt, and database
  audit record. A false or abusive challenge is resolved by future append-only
  review, never deletion.
- Rollback cannot suppress a challenge, expose raw/private material, weaken
  human authority or origin authentication, fabricate a resolution, bypass
  restrictions, enable admin proxying, merge API/Web Workers, restore SVG
  branding, or alter claim/fund boundaries.

## Durable Public Data Access Accountability Challenge Resolution Extension

Status: accepted and implemented at the durable independent-resolution
boundary. This extension makes independent human resolution of durable public
accountability challenges append-only,
database-authoritative, and publicly readable. It does not open correction or
withdrawal notice commands. A resolution is a bounded governance finding about
one challenge; it is not autonomous AI approval, final proof authority, a legal
judgment, a certified carbon-credit decision, a tax-offset decision, or a
financial or yield instrument.

### Problem Statement

Challenge resolutions currently exist only in the compatibility service. The
API route writes process memory, public reads do not reconstruct PostgreSQL
authority, and durable disclosure reads fail closed when any resolution row is
present. The preliminary SQL table checks a small subset of lineage rules but
accepts caller-shaped identity authority, safety flags, evidence roots, IDs,
hashes, roots, and semantic-event payloads.

The preliminary trigger names also exceed PostgreSQL's 63-byte identifier
limit. PostgreSQL silently truncates them to the same prefix, so validate,
append-only, event-binding, and database-audit triggers can replace one another.
Opening the route without a migration would therefore permit lost resolutions,
forged review authority, ambiguous concurrent successors, mutable records, or a
public governance state that cannot be replayed after restart.

### Trust Model

- A resolution binds exactly one immutable challenge, disclosure ID, disclosure
  root, and challenge root in the challenged organization's semantic stream.
- The reviewer must be a verified human with an active `owner`, `admin`, or
  `verifier` membership in the challenged organization. Agents and asserted
  roles without current durable membership cannot resolve a challenge.
- The reviewer must differ from both the challenger and the disclosure
  publisher. The rule applies to every review in the chain and cannot be
  delegated to AI. AI may assist analysis but cannot append the final decision.
- The first resolution has no predecessor. A later resolution must name and
  root the current latest resolution, which must have decision
  `needs_more_evidence`. Only one successor is permitted. `upheld` and
  `dismissed` are terminal and cannot be silently replaced.
- `upheld` requires `publish_correction` or `publish_withdrawal_notice`;
  `dismissed` and `needs_more_evidence` require `none`. Notice commands remain
  closed until their own durable extension is accepted.
- Rationale text is bounded and rejects private keys, credentials, passwords,
  email/phone contact material, raw payload material, and unsupported certified-
  credit, tax-offset, automatic-token, or guaranteed-yield claims.
- Evidence event roots are required, lowercase SHA-256, sorted, unique, and
  capped at 128. Every root must identify an existing semantic event preceding
  the resolution event. The resolution event and future events cannot be cited.
- PostgreSQL and TypeScript independently derive the exact safety object,
  resolution hash, root, ID, semantic-event action, and payload hash. The event
  action is `REASON` for `needs_more_evidence`, `ASSERT` for `dismissed`, and
  `FULFILL` for `upheld`.
- Exact idempotent retries return the historical committed resolution even after
  a successor exists. Changed-content key reuse conflicts. Resolution rows,
  events, receipts, and database audit records are append-only.
- Public governance state is replayed from the latest resolution per challenge:
  unresolved challenge, needs-more-evidence, correction-required, withdrawal-
  required, or challenge-dismissed. The original disclosure always remains
  visible. `corrected` and `withdrawn` remain unavailable until durable notices
  are implemented.

### Data Flow

```text
origin-verified owner/admin/verifier
  -> challenge ID + bounded decision/remedial action/rationale/evidence roots
  -> bounded Idempotency-Key
  -> command advisory lock
  -> challenged organization semantic-stream advisory lock
  -> lock challenge, disclosure, reviewer authority, and resolution chain
  -> validate reviewer independence and current target-organization membership
  -> validate predecessor and every evidence root at prior event sequence
  -> derive canonical safety, hash, root, ID, action, and payload
  -> append exact semantic event to challenged organization stream
  -> insert immutable resolution
  -> update organization summary timestamp only
  -> append database v2 mutation event + command receipt
  -> COMMIT
```

Unauthenticated resolution list/get and disclosure status/index/get reads use
the configured PostgreSQL registry. They expose public rationale and hash-only
lineage, never private identity profiles, credentials, contact data, raw
evidence, or restricted dataset material.

### Threat Model

The extension must reject or contain:

- anonymous, Agent, unverified, inactive, foreign-organization, role-
  substituting, or membership-revoked reviewers;
- self-review by the challenger or disclosure publisher, including on a follow-
  up review;
- a resolution bound to a missing/foreign challenge, disclosure, organization,
  challenge root, or semantic stream;
- a second root resolution, a forked/non-latest successor, a successor to a
  terminal decision, duplicate final decisions, or backwards/equal chronology;
- invalid decision/remedial-action combinations;
- missing, future, malformed, duplicate, unsorted, or over-limit evidence roots;
- private keys, credentials, secrets, email/phone material, raw data, or unsafe
  public claims embedded in rationale;
- caller-supplied organization, predecessor root, safety, ID/hash/root, event
  action/stream/time/payload, or database actor;
- update/delete mutation, trigger loss through identifier truncation, duplicate
  concurrent effects, changed-content idempotency reuse, and production memory
  fallback;
- public reads hiding a challenge, selecting a non-latest resolution, or
  claiming correction/withdrawal before a durable notice exists.

Residual risks include reviewer collusion, compromised evidence events,
malicious but syntactically safe rationale, and privileged database-owner
compromise. Separation of duties and append-only replay make those risks
observable but cannot independently establish scientific or legal truth.

### API Design

The following existing routes become durable:

```text
POST /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
GET  /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
GET  /canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId
```

`POST` accepts only `decision`, `remedialAction`, `rationale`,
`evidenceEventRoots`, and optional `reviewedAt`; requires a bounded
`Idempotency-Key`; and derives actor, role authority, organization, predecessor,
safety, hashes, roots, and event fields. It returns `202` only for
`needs_more_evidence`, otherwise `200`. Public reads are deterministically
ordered by semantic-event sequence and bounded to one challenge or resolution
ID. Disclosure status/list/get include the durable latest-resolution governance
state and open-challenge count.

Correction, withdrawal, and notice create/list/get routes remain behind the
pending-persistence guard.

### Database Changes

- Harden rationale, evidence-root bounds/order, ID/hash/root/event shape,
  millisecond timestamp precision, exact safety, predecessor pair consistency,
  and decision/remedial-action constraints with migration-safe checks.
- Add canonical resolution safety, hash, root, and event-payload functions.
- Add a robust insert validator requiring matching `app.actor_id`, verified
  human target-organization authority, reviewer independence, exact challenge/
  disclosure lineage, current predecessor, prior evidence events, ordered exact
  semantic events, canonical fields, and exact payload hash.
- Extend data-access semantic-event binding to resolutions with exact actor,
  target stream, decision-derived action, entity, and timestamp.
- Replace every overlong resolution trigger name with a short unique name and
  explicitly remove the legacy truncated name before creating validate,
  event-binding, append-only, and database-audit triggers.
- Load resolutions into authority snapshots after challenges, ordered by
  semantic-event sequence. Revalidate every row at its historical event
  boundary before exposing command replay or public state.

### Migration Strategy

1. Deploy additive constraints as `NOT VALID`, canonical functions, short unique
   triggers, event binding, validator, indexes, and durable read adapter while
   resolution routes remain closed.
2. Inventory legacy rows and trigger catalog state. Admit only resolutions with
   reconstructable reviewer authority, exact independent lineage, a single
   predecessor chain, prior evidence events, canonical payload, and safe text.
   Quarantine ambiguous rows rather than rewriting history.
3. Validate constraints after TypeScript and PostgreSQL replay identically and
   the catalog proves all five short trigger names coexist.
4. Enable create, then public list/get and resolved disclosure views after exact/
   conflicting retry, role substitution, self-review, missing/future evidence,
   fork/final-state, concurrent command, text leakage, tamper, event mismatch,
   append-only, reconnect, and no-auth public-read tests pass.
5. Keep notice paths closed until their separate durable RFC, replacement-
   disclosure checks, and migration review pass.

### Rollback Strategy

- Disable resolution mutation/reads with durable-write unavailable; never return
  process-memory resolutions or a partial public governance view in production.
- Preserve every committed disclosure, challenge, resolution, event, receipt,
  and database audit record. Errors are corrected through a permitted successor
  after `needs_more_evidence`, or a future append-only governance mechanism,
  never update/delete.
- Reinstall all short unique triggers if catalog verification fails. Do not
  restore colliding legacy names or validate constraints over quarantined data.
- Rollback cannot suppress challenges, fabricate or erase findings, expose raw/
  private material, weaken human independence or origin authentication, open
  notice paths, bypass restrictions, enable admin proxying, merge API/Web
  Workers, restore SVG branding, or alter claim/fund boundaries.

## Durable Public Accountability Correction and Withdrawal Notice Extension

Status: accepted and implemented at the durable correction/withdrawal notice
boundary. This extension makes the corrective public
action required by an upheld disclosure challenge durable, append-only, and
publicly replayable. A correction links the immutable original disclosure to a
separate valid replacement disclosure. A withdrawal records non-reliance while
preserving the original. Neither notice is a deletion, autonomous AI decision,
legal judgment, certified carbon credit, tax offset, financial asset, token
distribution, or guaranteed yield.

### Problem Statement

Correction and withdrawal notices currently exist only in the compatibility
service. The API writes process memory, public reads do not reconstruct
PostgreSQL notice authority, and durable disclosure reads fail closed when any
notice row exists. The preliminary table validates only a subset of resolution
and replacement bindings. It accepts caller-shaped publisher authority, safety,
evidence roots, IDs, hashes, roots, and unbound semantic-event payloads.

Its trigger names also exceed PostgreSQL's 63-byte identifier limit. The update
and delete trigger names truncate to the same identifier, so one append-only
guard replaces the other. A naive replacement check against current state would
create another failure: a later challenge to a once-valid replacement could
make a historical correction impossible to replay. Production therefore needs
event-bound replacement validation at the notice's own audit boundary.

### Trust Model

- A notice binds exactly one latest terminal `upheld` resolution, its challenge,
  its immutable original disclosure, and the challenged organization stream.
- `publish_correction` permits only a `correction`; `publish_withdrawal_notice`
  permits only a `withdrawal`. Every resolution has at most one notice.
- The publisher must be a verified human with an active `owner` or `admin`
  membership in the challenged organization. The publisher must differ from the
  original disclosure publisher, challenger, and final resolution reviewer.
  Agents and AI cannot publish corrective outcomes.
- A correction requires a distinct replacement disclosure in the same
  organization. At the semantic event immediately before notice publication,
  the replacement must have a valid current packet lineage and governance state
  `unchallenged` or `challenge_dismissed`. Later changes never invalidate the
  historical notice; public current views may separately show later disputes.
- A withdrawal must not reference a replacement disclosure. It records that the
  original is no longer suitable for institutional reliance without erasing it.
- Public statement text is bounded and rejects private keys, credentials,
  passwords, email/phone material, raw payloads, and unsupported certified-
  credit, tax-offset, automatic-token, or guaranteed-yield claims.
- Evidence event roots are required, lowercase SHA-256, sorted, unique, capped
  at 128, and must bind existing semantic events preceding the notice event.
- PostgreSQL and TypeScript independently derive exact safety, notice ID/hash/
  root, replacement root (or null), `FULFILL` event binding, and event payload.
- Exact idempotent retries return the historical committed notice even after
  later ledger events. Changed-content key reuse conflicts. Notice rows, source
  disclosures, events, receipts, and database audit records are append-only.
- Public governance state is replayed as `corrected` only after a valid
  correction and `withdrawn` only after a valid withdrawal. The original
  disclosure, challenge, resolution, notice, and replacement root remain
  discoverable as hash-only public history.

### Data Flow

```text
origin-verified owner/admin
  -> upheld resolution ID + bounded notice type/statement/evidence roots
  -> optional replacement disclosure ID for correction only
  -> bounded Idempotency-Key
  -> command advisory lock
  -> challenged organization semantic-stream advisory lock
  -> lock resolution, challenge, original disclosure, publisher authority
  -> lock optional replacement disclosure and replay it before notice event
  -> validate publisher separation, remedy/type, and prior evidence roots
  -> derive canonical safety, replacement root, hash, root, ID, and payload
  -> append exact FULFILL semantic event to challenged organization stream
  -> insert immutable notice
  -> update organization summary timestamp only
  -> append database v2 mutation event + command receipt
  -> COMMIT
```

Unauthenticated notice list/get and disclosure status/index/get reads use the
configured PostgreSQL registry. They expose bounded public statements and hash-
only lineage, never identity profiles, credentials, private contact data, raw
evidence, or restricted dataset material.

### Threat Model

The extension must reject or contain:

- anonymous, Agent, unverified, inactive, foreign-organization, role-
  substituting, or membership-revoked publishers;
- publication by the challenger, original publisher, or final reviewer;
- a notice bound to a missing/foreign/non-latest/non-upheld resolution,
  challenge, disclosure, organization, or semantic stream;
- a correction using the original, foreign, stale, challenged, corrected, or
  withdrawn replacement disclosure at the notice event boundary;
- a withdrawal carrying a replacement or a remedy/type mismatch;
- duplicate notices for one resolution, update/delete mutation, or a hidden
  original disclosure;
- missing, future, malformed, duplicate, unsorted, or over-limit evidence roots;
- private keys, credentials, secrets, email/phone material, raw data, or unsafe
  claims embedded in public statement text;
- caller-supplied organization, replacement root, safety, ID/hash/root, event
  action/stream/time/payload, or database actor;
- trigger loss through identifier truncation, duplicate concurrent effects,
  changed-content idempotency reuse, and production memory fallback;
- current-state replay incorrectly rewriting whether a replacement was valid at
  the historical notice boundary.

Residual risks include colluding publishers/reviewers, misleading but bounded
statements, compromised source events, and privileged database-owner compromise.
The append-only lineage makes these observable but cannot independently prove a
scientific claim or legal remedy.

### API Design

The following existing routes become durable:

```text
POST /canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId/notices
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/notices
GET  /canopyproof/public-accountability/data-access-disclosure-notices/:noticeId
```

`POST` accepts only `noticeType`, optional `replacementDisclosureId`,
`statement`, `evidenceEventRoots`, and optional `publishedAt`; requires a
bounded `Idempotency-Key`; and derives actor, role authority, organization,
resolution/disclosure/replacement roots, safety, hashes, and event fields. It
returns `201` for the first commit and the receipt-bound historical projection
for an exact retry. Public reads are ordered by semantic-event sequence and
bounded to one disclosure or notice ID. Disclosure status/list/get include
`corrected`/`withdrawn`, notice IDs, and replacement disclosure IDs.

### Database Changes

- Harden statement, evidence-root bounds/order, ID/hash/root/event shape,
  millisecond timestamp precision, exact safety, correction/withdrawal shape,
  and public lookup indexes with migration-safe constraints.
- Add canonical notice safety, hash, root, and event-payload functions.
- Add an insert validator requiring matching `app.actor_id`, verified target-
  organization owner/admin authority, three-way publisher independence, exact
  latest upheld resolution lineage, prior evidence events, and event-bound
  replacement current/uncontested replay.
- Extend data-access semantic-event binding to notices with exact actor, target
  stream, `FULFILL` action, entity, and timestamp.
- Replace overlong notice trigger names with short unique validate, event-
  binding, no-update, no-delete, and database-audit names, explicitly dropping
  every legacy truncated identifier.
- Load notices after resolutions into authority snapshots. Validate original and
  replacement state at each notice's historical event boundary before exposing
  command replay or public state.
- Extend database governance-state projection and status aggregates to derive
  corrected/withdrawn and retain open-challenge semantics.

### Migration Strategy

1. Deploy additive `NOT VALID` constraints, canonical functions, short triggers,
   event binding, validator, indexes, historical snapshot adapter, and public
   projection while notice routes remain closed.
2. Inventory legacy rows and trigger catalog state. Admit only notices with
   reconstructable publisher authority, exact final-resolution lineage, prior
   evidence roots, event-bound replacement validity, canonical payload, and safe
   text. Quarantine ambiguity instead of rewriting history.
3. Validate constraints only after TypeScript/PostgreSQL replay parity, repeated
   SQL contract application, and catalog proof that all five triggers coexist.
4. Enable create, then public list/get and corrected/withdrawn disclosure views
   after role substitution, self-publication, wrong remedy, stale/challenged/
   foreign replacement, missing evidence, text leakage, exact/conflicting retry,
   concurrent command, tamper, event mismatch, append-only, historical replay,
   reconnect, and public no-auth tests pass.

### Rollback Strategy

- Disable notice mutation/reads with durable-write unavailable; never return
  process-memory notices or a notice-free partial public projection in
  production.
- Preserve every committed original/replacement disclosure, challenge,
  resolution, notice, event, receipt, and database audit record. A mistaken
  notice is addressed by a future append-only governance mechanism, never
  update/delete or history suppression.
- Reinstall all short triggers if catalog verification fails. Do not restore
  colliding legacy names or validate constraints over quarantined data.
- Rollback cannot erase or hide an original disclosure, fabricate a replacement,
  expose raw/private material, weaken human independence or origin
  authentication, bypass restrictions, enable admin proxying, merge API/Web
  Workers, restore SVG branding, or alter claim/fund boundaries.

## Durable Project Lifecycle Authority Extension

Status: accepted design for incremental implementation. This extension moves
the root of the future Digital MRV graph from process memory into PostgreSQL.
It makes project registration, lifecycle decisions, and monitoring assertions
event-sourced and replayable before any evidence, certificate, or report layer
may treat a project as an institutional authority record.

### Problem Statement

The project registry currently stores authoritative state in two in-process
maps. The preliminary SQL tables mirror mutable project status, a rewritten
project hash, and a JSON audit-history copy. They do not bind project creation
or status changes to exact semantic events, do not independently verify
organization membership, allow arbitrary status jumps, and have no durable
idempotency or restart replay. Monitoring rows are append-only in intent but
their referenced evidence/Terra IDs are unchecked strings and the project row
is silently rewritten when monitoring arrives.

Building an MRV graph over that model would create false durability: a graph
could outlive, misstate, or fail to reconstruct its project root. Project
authority must therefore become durable before the graph can be implemented.

### Trust Model

- A project registration is an immutable fact owned by one verified
  organization. The creator must be a verified human with an active exact-role
  `owner`, `admin`, or `verifier` membership in that organization.
- Registration starts at `submitted`. The existing v1 lifecycle vocabulary is
  preserved during migration: `submitted`, `under_review`, `active`,
  `monitored`, `challenged`, `suspended`, and `archived`. Current status is
  derived from ordered transition and monitoring events; the registration row
  is never rewritten.
- This vocabulary is not relabelled as Phase 3 `FUNDED`, `VERIFIED`, or
  `LONG_TERM_OBSERVATION`. Those states require durable funding, MRV review, and
  observation-window authorities that do not yet exist. A later versioned
  migration must add them with source-bound prerequisites rather than aliases.
- Lifecycle transitions follow a finite state machine. `active` and
  `monitored` require a real governance approval row whose policy applies to
  projects, whose decision is approved, and whose reviewer is independent from
  the project creator. `archived` is terminal.
- A monitoring assertion is immutable, ordered after registration, and authored
  by a verified human active `owner`, `admin`, `verifier`, or `researcher` in
  the owning organization. It references at least one existing same-project
  evidence object or Terra scene; unresolved string references are rejected.
- Accepted monitoring can advance `active` to `monitored`. Challenged
  monitoring can derive project state `challenged`; it cannot delete, rewrite,
  or certify source evidence. AI and Agent identities cannot register projects,
  decide lifecycle transitions, or author final monitoring state.
- Location, arrays, numeric metrics, claim boundary, IDs, hashes, roots,
  semantic event payloads, event chronology, and status derivation are computed
  independently in TypeScript and PostgreSQL.
- Every command requires a bounded idempotency key. Exact retries return the
  original committed projection, changed retries conflict, and concurrent
  commands serialize on command identity and project stream.
- A project record is not a carbon credit, tax offset, financial asset,
  mainnet-fund instruction, automatic CANOPY distribution, or guaranteed yield.

### Data Flow

```text
origin-verified institutional human
  -> bounded registration / transition / monitoring command
  -> bounded Idempotency-Key
  -> command advisory lock
  -> project semantic-stream advisory lock
  -> lock organization, participant, membership, and project authority
  -> for activation: lock and verify governance policy + approval
  -> for monitoring: lock and verify same-project evidence / Terra references
  -> derive canonical payload, hash, root, ID, and event action
  -> append semantic event
  -> insert immutable registration, transition, or monitoring fact
  -> append database v2 mutation event + command receipt
  -> COMMIT
```

Reads rebuild a project by replaying the registration event followed by every
transition and monitoring event in semantic sequence. Production reads never
fall back to the process-memory compatibility registry.

### Threat Model

The extension must reject or contain:

- anonymous, Agent, unverified, inactive, foreign-organization, or role-
  substituting project actors;
- fake organization ownership, arbitrary creator IDs, and organization changes;
- duplicate registration, changed idempotency reuse, concurrent double effects,
  missing semantic events, or mismatched event stream/action/actor/time/payload;
- out-of-order, same-time, backward, skipped, or terminal-state transitions;
- activation without an applicable approved governance decision, use of a
  rejected approval, or self-approval by the project creator;
- monitoring without a registered project, without source lineage, with
  foreign-project evidence/Terra scenes, or with future/missing source events;
- NaN/infinite metrics, duplicate or unsorted arrays, malformed coordinates or
  boundary hashes, unsafe public claims, raw secrets, or private contacts;
- caller-shaped claim boundaries, current status, hash/root, audit history, or
  database actor;
- update/delete of registration, transition, monitoring, semantic event,
  receipt, or database audit history;
- production memory fallback and stale partial reconstruction after restart.

Residual risks include colluding human reviewers, fraudulent but internally
consistent source records, compromised database-owner authority, and incorrect
scientific methodology. Append-only project lineage makes those risks
investigable; it does not independently prove environmental impact.

### API Design

The existing routes become durable in PostgreSQL mode:

```text
GET   /canopyproof/projects/status
POST  /canopyproof/projects
GET   /canopyproof/projects
GET   /canopyproof/projects/:projectId
PATCH /canopyproof/projects/:projectId/status
POST  /canopyproof/projects/:projectId/monitoring-events
GET   /canopyproof/projects/:projectId/monitoring-events
GET   /canopyproof/projects/monitoring-events
```

Mutation routes require a bounded `Idempotency-Key`. Actor identity and role are
derived from the origin-authenticated principal, never from the body. Filters
are strict enums with bounded result limits. Institutional reads require an
authenticated human role; a future public explorer will use a separately
redacted projection rather than exposing internal project records directly.

### Database Changes

- Harden `projects.projects` as immutable registration facts with exact
  registration event root, canonical project hash/root, fixed initial status,
  normalized location/arrays, exact claim boundary, and no-update/no-delete
  triggers.
- Add `projects.project_status_transitions` as append-only predecessor-bound
  lifecycle facts with exact actor role, previous/new state, optional verified
  governance approval, rationale, timestamp, hash/root, and event root.
- Harden `projects.monitoring_events` with exact actor role, source references,
  bounded sorted arrays and metric object, rationale, hash/root, event binding,
  chronology, and append-only controls.
- Add short unique validate, event-binding, no-update, no-delete, and database-
  audit triggers for all three tables. Repeated contract application must prove
  the complete trigger catalogs.
- Add organization, status, region, chronology, source-reference, and
  predecessor indexes without rewriting accepted history.
- Add a transactional Prisma adapter and snapshot replay that recomputes every
  project projection from immutable rows and semantic events.

### Migration Strategy

1. Add new columns/table/functions/indexes/triggers without opening durable
   routes. Inventory existing project rows and classify each as reconstructable,
   legacy-compatible, or quarantined.
2. Admit only rows with one valid registration event, verified organization and
   creator authority at that event, canonical location/claims/hash/root, and a
   fully reconstructable event order. Never synthesize missing events.
3. Convert each historical status change into an evidence-backed append-only
   transition only when its original actor/time/approval can be proven. Leave
   ambiguous mutable snapshots quarantined and non-authoritative.
4. Validate SQL/TypeScript replay parity, repeated migration application,
   trigger catalogs, role substitution, invalid state paths, false approvals,
   source mismatch, tamper, idempotency, concurrency, reconnect, and production
   no-memory-fallback tests before switching routes.
5. After project authority is durable, bind evidence persistence to project
   roots; only then implement the cross-domain Digital MRV Evidence Graph.

### Rollback Strategy

- Close project mutation and reads with durable-write unavailable; never return
  memory state as production authority.
- Preserve every committed registration, transition, monitoring assertion,
  semantic event, command receipt, and database audit event. Corrective action
  is a later append-only transition or challenge, never update/delete.
- Reinstall validators and append-only triggers if catalog verification fails.
  Quarantine invalid legacy rows instead of weakening constraints.
- Rollback cannot fabricate funding/verification states, detach evidence,
  expose private material, weaken origin authentication, enable admin proxying,
  merge API/Web Workers, restore SVG branding, or alter fund/claim boundaries.

## Durable Evidence Registration Authority Extension

Status: accepted design for incremental implementation. This extension is the
next prerequisite after durable project authority and before any Digital MRV
graph edge can treat evidence as a durable node.

### Problem Statement

The compatibility proof service stores evidence in a process-local map. A single
`submitEvidence` call creates a contributor assertion, runs deterministic checks,
appends a synthetic `Evidence Agent` event, and rewrites the envelope from
`submitted` to `validated` or `challenged`. Conflicting IDs rewrite the original
object into a challenged state. The preliminary `evidence.evidence_objects` SQL
row has no project-root boundary, organization/role binding, canonical evidence
hash/root, semantic event root, idempotency receipt, duplicate media control, or
append-only protection.

Persisting that mutable object directly would make restart replay and MRV lineage
untrustworthy. Registration must first become one immutable contributor-authored
fact. AI analysis, human review, verification decisions, challenges,
supersessions, custody, and proof issuance remain separate future facts and may
not silently mutate registration.

### Trust Model

- Registration is authored by a verified human with an exact active `owner`,
  `admin`, `verifier`, `researcher`, or `community` membership in the verified
  organization that owns the project. Agent identities cannot register human
  field evidence.
- The registration binds the project's current root, status, and authority time at submission.
  Archived projects reject new evidence. Later project transitions do not rewrite
  the historical evidence-to-project boundary.
- The evidence ID, location, observed/created times, source commitments,
  contributor/role, initial deterministic issues/status, confidence, project
  root, claim boundary, evidence hash/root, and singular semantic event are
  canonical in TypeScript and PostgreSQL.
- Initial `validated` means only that the envelope passed bounded structural
  checks. Initial `challenged` retains a structurally questionable envelope for
  review. Neither state is human verification, certification, or impact proof.
- GPS accuracy over the bounded ingestion threshold or an explicit region that
  conflicts with the project creates deterministic challenge issues. Malformed
  coordinates, hashes, timestamps, secret material, or unsupported claim text
  are rejected before storage.
- A media hash is single-use across evidence registration. Exact retries use the
  command receipt; a second evidence identity reusing the media conflicts rather
  than rewriting either record. A later duplicate-evidence challenge protocol
  may append a dispute without changing registration.
- Every command requires a bounded idempotency key and serializes on command ID,
  evidence stream, and media commitment. Exact retries return the original
  historical registration; changed retries conflict.
- Evidence registration is not final verification, a certificate, a carbon
  credit, tax offset, financial asset, guaranteed yield, mainnet-fund movement,
  or automatic CANOPY distribution.

### Data Flow

```text
origin-verified project organization human
  -> bounded evidence envelope + Idempotency-Key
  -> resolve durable project current status/root
  -> command advisory lock
  -> evidence-stream + media-commitment advisory locks
  -> verify participant, exact active membership, and organization
  -> normalize hashes/location and derive structural issues/status
  -> derive deterministic ID, evidence hash/root, payload, and event
  -> append evidence semantic event
  -> insert immutable evidence registration
  -> append database v2 event + hashed command receipt
  -> COMMIT
```

Reads hydrate the singular registration event and independently recompute the
registration. They do not mix in process-memory AI/review state. Future evidence
state projections must replay separate append-only facts in semantic order.

### Threat Model

The extension must reject or contain:

- anonymous, Agent, unverified, inactive, foreign-organization, or role-
  substituting contributors;
- evidence attached to a missing or archived project, a caller-shaped project
  root, or a project root that changed before commit;
- arbitrary contributor IDs, current status, validation issues, reviewers,
  confidence changes, project authority time, hash/root, claim boundary, or audit history;
- malformed or future timestamps, non-millisecond command time, invalid
  coordinates, unbounded GPS accuracy, malformed commitments, unsafe claims,
  private keys, credentials, or secrets;
- duplicate media, changed idempotency reuse, conflicting explicit IDs,
  concurrent duplicate registration, or missing/mismatched semantic events;
- update/delete of registration, event, receipt, or database audit trail;
- a synthetic Agent being represented as final reviewer or a structural
  validation being described as verification/certification;
- production reads or writes falling back to process memory.

Residual risks include staged media with internally consistent commitments,
compromised contributor devices, incorrect project boundaries, colluding humans,
and database-owner compromise. Registration makes provenance investigable; it
does not prove environmental truth.

### API Design

The following routes become durable in PostgreSQL mode:

```text
POST /canopyproof/evidence
GET  /canopyproof/evidence?projectId=&status=&evidenceType=&limit=
GET  /canopyproof/evidence/:evidenceId
```

`POST` ignores caller-shaped contributor/status/reviewer/audit fields, derives
the contributor from the authenticated principal, requires `Idempotency-Key`,
and returns an immutable registration plus `valid` and structural `issues` for
compatibility. `valid` means structurally admitted for review only. Filters are
strict and bounded to 100.

Nested media, custody, community attestation, AI analysis, human review, proof,
and certificate routes remain development compatibility surfaces until their own
durable adapters exist. In enforced mode they fail closed rather than using an
in-memory evidence object.

### Database Changes

- Harden `evidence.evidence_objects` into immutable registration facts with
  organization, exact contributor role, project root/status/time boundary, canonical
  location, created/observed times, optional offline/device/EXIF commitments,
  deterministic issue set and initial status, reviewers fixed empty, evidence
  hash/root, exact claim boundary, and semantic event root.
- Add unique and lookup indexes for evidence root, event root, media hash,
  project/time, contributor/time, and status/type.
- Add canonical issue, claim-boundary, hash/root, and event-payload functions.
- Add exact project-authority, participant/membership, media uniqueness,
  timestamp, field, hash/root, and semantic-event validators.
- Add short event-binding, validate, no-update, no-delete, and database-audit
  triggers. Repeated contract application must prove all five coexist.
- Add a serializable Prisma adapter with receipt-bound historical replay and
  production API routing.

### Migration Strategy

1. Add columns, canonical functions, indexes, validators, event binding, adapter,
   and reads while production evidence registration remains closed.
2. Inventory legacy rows. Admit only rows with a reconstructable project root,
   contributor authority, source commitments, event, issue/status derivation,
   and evidence root. Quarantine every ambiguous mutable snapshot.
3. Never synthesize contributor events or copy later reviewers/status into the
   registration fact. Historical review/AI data requires separate future facts.
4. Validate SQL/TypeScript parity, double migration, trigger catalogs, role and
   project substitution, archived project, duplicate media, malformed/private
   input, exact/conflicting/concurrent retry, missing event, update/delete,
   tamper, historical replay, reconnect, and no-production-memory-fallback tests.
5. Only then open registration/list/get. Implement durable validation, AI,
   human-review, challenge, and verification facts before opening those enforced
   routes or adding MRV graph edges.

### Rollback Strategy

- Close durable evidence reads/writes with unavailable; do not reveal process-
  memory evidence as a fallback.
- Preserve every registration, semantic event, receipt, and database audit
  record. Corrections use future challenge/supersession facts, never mutation.
- Reinstall validators and append-only triggers if catalog verification fails.
  Quarantine legacy rows rather than relaxing constraints.
- Rollback cannot detach evidence from its historical project root, fabricate a
  verifier, expose private location/media/contact material, weaken origin auth,
  enable admin proxying, merge API/Web Workers, restore SVG branding, or alter
  claim/fund boundaries.

## Durable Evidence Verification Authority Extension

Status: accepted and implemented at the durable evidence-governance boundary. This extension follows
durable evidence registration and precedes Environmental Proof Record or MRV
authority.

### Problem Statement

The compatibility proof service mutates an evidence envelope when AI analysis
runs, writes a synthetic `Canopy AI Agent` actor string, and embeds a human
review supplied inside proof issuance. The verification queue also rewrites work
items in place. Preliminary `verification.ai_analyses` and
`verification.human_reviews` rows lack model/input provenance, project and
organization boundaries, deterministic roots, predecessor binding, exact actor
authority, semantic events, idempotency, independence checks, and update/delete
protection. A decision dossier currently verifies only that reference arrays are
non-empty, not that the referenced authority exists or precedes the decision.

These surfaces are useful development simulations but cannot tell an auditor
which immutable evidence version was validated, which model and source set made
an advisory observation, whether an independent accredited human reviewed those
exact inputs, or whether later mutation changed the answer.

### Trust Model

- Evidence registration remains immutable. Validation, AI analysis, and human
  review append new facts; none rewrites registration status, confidence,
  reviewer arrays, commitments, or audit history.
- All verification facts append to the registered evidence semantic stream in
  database sequence order. Every fact binds the evidence registration root and
  the exact predecessor event root visible when it was committed.
- A deterministic validation run is derived from the hydrated registration and
  a versioned ruleset. The caller cannot supply pass/fail, checks, issues,
  confidence, evidence root, or output root. A verified Agent or verified human
  project-organization member may execute it, but it grants no final authority.
- An AI analysis must be authored by a verified `agent` participant with the
  exact `agent` role. It binds a prior validation run, model provider/name/
  version, model artifact hash, prompt hash, source and dataset roots, execution
  environment, bounded findings, and an advisory recommendation. It cannot set
  evidence reliance state, approve itself, issue proof, or act as a human.
- AI findings are records, not truth. Their messages and source references are
  bounded and hash-rooted. Model changes produce new analyses; they never
  replace old output.
- A human review must be authored by a verified human with an exact active
  `verifier` or `researcher` membership in the evidence-owning verified
  organization. Approval additionally requires the `verifier` role and a
  current approved organization accreditation.
- The reviewer must differ from the evidence contributor and every referenced
  AI agent. Approval requires a passing deterministic validation run and at
  least one prior AI analysis. Every high or critical AI finding must have an
  explicit human disposition. An `escalated` finding blocks approval; an
  accepted or overruled risk requires rationale and prior semantic evidence
  roots.
- Review decisions are `approve`, `reject`, `challenge`, or `request_changes`.
  They govern bounded reliance on one evidence registration only. They do not
  create a certificate, carbon credit, tax offset, financial asset, guaranteed
  yield, mainnet-fund instruction, or automatic CANOPY distribution.
- Operational queue records schedule work but are not verification authority.
  Queue loss, retry, or mutation cannot change a committed validation, AI, or
  human-review fact.

### Data Flow

```text
immutable evidence registration (evidence stream sequence 1)
  -> deterministic ruleset execution
  -> append validation_run fact + semantic event + command receipt
  -> verified Canopy AI agent consumes evidence/validation/source roots
  -> append advisory ai_analysis fact + semantic event + command receipt
  -> independent organization human resolves exact findings and limitations
  -> append human_review fact + semantic event + command receipt
  -> derive current evidence reliance projection by ordered replay
  -> future challenge/final-verification/proof/MRV authority
```

The transaction locks the command identity, evidence stream, and referenced
facts; resolves the immutable evidence registration and owning project; checks
current actor authority; independently recomputes canonical hashes and roots;
inserts the semantic event before the source fact; then writes the hashed receipt
and database mutation audit event before commit.

### Threat Model

The extension must reject or contain:

- validation outcomes, checks, issue codes, confidence, or ruleset roots shaped
  by the caller;
- validation against a missing, foreign, legacy, mutated, or future evidence
  registration;
- unregistered synthetic AI identities, human-as-agent or agent-as-human role
  substitution, foreign-organization analysis, and model provenance omission;
- prompt/model/dataset/source-root substitution, unbounded findings, unsafe
  public claims, raw secrets, private keys, or raw media embedded in analysis;
- AI output represented as approval, final verification, certificate authority,
  or proof issuance;
- contributor self-review, AI self-review, role substitution, inactive
  membership, suspended organization/accreditation, and reviewer conflicts;
- human approval with blocked validation, missing AI, missing finding
  dispositions, escalated high/critical findings, fabricated evidence roots, or
  future references;
- changed idempotency reuse, conflicting explicit IDs, concurrent duplicate
  facts, stream forks, missing/mismatched events, backwards timestamps, and
  update/delete of facts, receipts, or audit records;
- production verification, queue, decision, or proof routes falling back to
  process memory.

Residual risks include compromised models or devices, colluding humans,
semantically weak but hash-consistent source data, biased rulesets, and database-
owner compromise. Independent methodology governance, external checkpoints,
challenge authority, model evaluation, and operational review remain required.

### API Design

The first durable endpoints are:

```text
POST /canopyproof/evidence/:evidenceId/validation-runs
GET  /canopyproof/evidence/:evidenceId/validation-runs
GET  /canopyproof/verification/validation-runs/:runId

POST /canopyproof/evidence/:evidenceId/ai-analyses
GET  /canopyproof/evidence/:evidenceId/ai-analyses
GET  /canopyproof/verification/ai-analyses/:analysisId

POST /canopyproof/evidence/:evidenceId/human-reviews
GET  /canopyproof/evidence/:evidenceId/human-reviews
GET  /canopyproof/verification/human-reviews/:reviewId
GET  /canopyproof/evidence/:evidenceId/reliance
```

Every `POST` requires a bounded `Idempotency-Key`. Actor identity and role come
only from the origin-verified authorization binding. Reads are scoped to the
authenticated organization; Agent reads are limited to evidence explicitly
referenced by their own durable analysis unless a future sharing policy grants
more.

Validation accepts only ruleset selection and execution time. AI accepts model
and source provenance plus bounded advisory findings; it never accepts final
status. Human review accepts exact validation/analysis references, decision,
finding dispositions, rationale, and limitations; it never accepts reviewer,
organization, project/evidence roots, event roots, or final proof state.

Until their own durable adapters exist, `/canopyproof/verification/queue/*`,
legacy `/canopyproof/verification/decisions*`, challenge-case mutations,
`/canopyproof/proof-records*`, and public-record derivation from process memory
remain unavailable in enforced production mode.

### Database Changes

- Add immutable `verification.validation_runs` with evidence/project/
  organization boundary, ruleset ID/version/hash, deterministic checks/issues/
  outcome/confidence, validation hash/root, executor/role/time, and semantic
  event root.
- Harden `verification.ai_analyses` with organization/project/evidence root,
  validation run/root, verified Agent, complete model/prompt/artifact/source/
  dataset provenance, bounded findings, advisory recommendation, analysis hash/
  root, safety boundary, and semantic event root.
- Harden `verification.human_reviews` with evidence and source boundaries,
  validation and AI roots, reviewer organization/role/accreditation snapshot,
  conflict and finding dispositions, decision/limitations, review hash/root,
  safety boundary, and semantic event root.
- Add deterministic current-reliance replay functions and indexes over evidence,
  time, actor, outcome, decision, roots, and events.
- Add exact actor, predecessor, reference existence/order, project ownership,
  accreditation, independence, canonical hash/root/payload, event-binding,
  no-update/no-delete, and database-audit triggers. Repeated schema application
  must preserve the complete trigger catalog.
- Extend the serializable Prisma trust adapter and hashed command receipts. No
  Prisma model is required for these schema-qualified tables because all writes
  use parameterized raw SQL under the database contract.

### Migration Strategy

1. Create new validation facts and shadow provenance/root columns on existing AI
   and human-review tables while production routes remain closed.
2. Inventory legacy AI/review rows. Quarantine rows without a durable evidence
   root, registered actor, exact model/input provenance, accountable reviewer,
   predecessor event, and reproducible output root. Never fabricate them.
3. Implement pure-domain replay and SQL parity before adapters. Validate empty,
   pass, needs-review, blocked, AI no-finding, AI critical-finding, human approve,
   reject/challenge/request-changes, and finding-disposition branches.
4. Validate double schema load, trigger catalogs, direct-write rejection, role/
   organization/type substitution, contributor self-review, inactive authority,
   model/source tamper, reference time/order, exact/conflicting/concurrent retry,
   stream fork, update/delete, restart replay, and no-memory-fallback behavior.
5. Run the explicit disposable native PostgreSQL multi-connection gate before
   enabling enforced routes. PGlite alone is insufficient for concurrency proof.
6. Open validation first, AI second, and human review last. Do not open proof or
   MRV authority until challenge and final-verification facts are durable.

### Rollback Strategy

- Close validation/AI/human-review endpoints with durable-unavailable; never
  serve compatibility memory state as production authority.
- Preserve all committed facts, semantic events, receipts, and database audit
  records. A model correction or review reversal appends a successor/challenge;
  it never updates or deletes history.
- Restore missing validators and append-only triggers from the idempotent
  contract. Quarantine legacy or malformed rows instead of relaxing checks.
- Operational queues may be rebuilt from immutable authority roots without
  changing verification outcomes.
- Rollback cannot grant AI final authority, detach a review from evidence/model
  roots, permit self-review, expose raw media or secrets, enable admin proxying,
  merge API/Web Workers, restore SVG branding, or alter claim/fund boundaries.

## Durable Evidence Challenge, Resolution, and Correction Extension

Status: accepted and implemented at the durable evidence-governance boundary.
This extension follows
the durable evidence verification authority and must land before any
Environmental Proof Record, certificate, public-record, or MRV authority can
rely on an approved evidence projection.

### Problem Statement

An approved human review is a bounded reliance decision, not immutable truth.
Later field observations, device attestations, satellite comparisons, duplicate
detection, or governance evidence may contradict it. The compatibility
`challenge_cases` service resolves a challenge by overwriting the current
in-memory object, while its preliminary SQL table is append-only and has no
separate resolution lineage. The proof-record challenge path also rewrites
record and challenge status. Neither path binds a challenge to the exact
evidence reliance projection, independently proves actor authority, preserves a
multi-step needs-more-evidence review, or requires an upheld challenge to end in
an auditable correction.

Production therefore needs one evidence-specific authority stream in which a
challenge, each resolution, and each remedy are immutable semantic facts.
Current reliance is a replay projection only. No fact may edit or erase the
registration, deterministic validation, advisory AI output, human review,
challenge, resolution, or prior projection that preceded it.

### Trust Model

- A challenge binds one immutable evidence registration, its root, the exact
  terminal semantic event and reliance root visible when the challenge opened,
  the challenged reliance state, bounded reason/severity/rationale, prior event
  roots, and hash-only supporting-artifact commitments. Raw media, coordinates,
  personal data, credentials, keys, tokens, and secrets are excluded.
- Only a verified human with an active durable membership in a verified
  organization may open a challenge. Permitted roles are `owner`, `admin`,
  `verifier`, and `researcher`. A challenger may belong to another verified
  organization; that records standing and provenance but grants no membership,
  private evidence access, or authority in the evidence-owning organization.
  Agents cannot challenge on their own authority.
- Opening a challenge always suspends current reliance. `open` and
  `needs_more_evidence` project as `challenged`, regardless of the previously
  approved state. A challenge is never silently withdrawn or deleted.
- A resolution binds one challenge and the exact latest resolution predecessor.
  Decisions are `upheld`, `dismissed`, or `needs_more_evidence`. Only
  `needs_more_evidence` may have a successor resolution; `upheld` and
  `dismissed` are terminal.
- A resolution requires a verified human `verifier` or `researcher` with an
  active membership in the evidence-owning organization. Terminal decisions
  require the exact `verifier` role and current approved organization
  accreditation. The reviewer must differ from the evidence contributor,
  challenger, challenged human reviewer, every AI agent in the challenged
  cycle, and every previous reviewer in the same challenge chain.
- `dismissed` may restore only the currently replayable underlying validation/
  AI/human-review state. It cannot resurrect an approval made stale by a later
  validation or AI fact, and it cannot override another open, needs-more, or
  upheld-without-remedy challenge.
- `upheld` projects as `correction_required`; it never edits evidence and never
  grants proof or certificate authority. Exactly one append-only remedy must
  later record either `withdraw` or `supersede`.
- A `withdraw` remedy permanently removes current reliance on the original
  registration while preserving its entire history. A `supersede` remedy binds
  a distinct replacement evidence registration in the same organization and
  project. At remedy time the replacement must independently project as
  `approved`, have no unresolved or upheld-unremedied challenge, and precede the
  remedy event. Supersession does not copy approval or mutate either stream.
- A remedy publisher must be a verified human `owner`, `admin`, or accredited
  `verifier` with active membership in the evidence-owning organization and
  must differ from the contributor, challenger, challenged reviewer, and final
  resolution reviewer.
- Challenge, resolution, and correction facts are not final verification,
  certificates, certified carbon credits, tax offsets, financial assets,
  guaranteed yield, mainnet-fund instructions, or automatic CANOPY
  distribution.

### Data Flow

```text
current evidence reliance projection
  -> verified human commits challenge basis hashes and prior event roots
  -> append evidence_challenge fact to original evidence stream
  -> current reliance = challenged
  -> independent owning-organization human reviews exact challenge lineage
  -> append one or more evidence_challenge_resolution facts
       needs_more_evidence -> challenged, one successor resolution permitted
       dismissed           -> replay underlying current reliance if unblocked
       upheld              -> correction_required
  -> independent owning-organization publisher appends evidence_correction
       withdraw  -> original reliance = withdrawn
       supersede -> bind separately approved replacement; original = superseded
  -> proof/MRV consumers accept only the current bounded replay projection
```

Every write transaction takes the idempotency-command lock and an advisory lock
for the original evidence stream, locks referenced actor and fact rows, derives
the next stream sequence, independently recomputes canonical IDs/hashes/roots
and the exact semantic-event payload, appends the event and fact, writes the
hashed command receipt and database mutation audit event, and commits once.
Supersession additionally locks the replacement stream in lexical evidence-ID
order to avoid cross-stream deadlocks.

### Threat Model

The extension must reject or contain:

- anonymous, agent-authored, inactive, unverified, or role-asserted challenges;
- a challenge bound to missing, foreign, mutated, future, stale, or caller-
  fabricated evidence/reliance/event roots;
- raw evidence, personal data, credentials, secrets, private keys, unsafe public
  claims, malformed or duplicate hashes, and unbounded rationale/artifacts;
- cross-organization challenge treated as private data access or target-
  organization membership;
- self-resolution by the contributor, challenger, challenged reviewer, AI
  agent, or prior challenge reviewer; terminal resolution without current
  verifier accreditation;
- skipped or forked resolution predecessors, multiple terminal resolutions,
  resolution before challenge, future evidence roots, and dismissal that masks
  another blocking challenge or stale approval;
- an upheld challenge treated as rejected/dismissed, approved, or remediated
  before its exact correction fact exists;
- remedy by a conflicted actor, remedy against a non-upheld or non-latest
  resolution, duplicate remedy, or action inconsistent with the committed
  resolution;
- supersession to the same, foreign, cross-project, unapproved, challenged,
  withdrawn, superseded, future, or otherwise non-current replacement;
- caller-selected IDs, outputs, current status, roots, safety flags, event
  sequence, or event payload; changed idempotency reuse and concurrent forks;
- update/delete of facts, events, receipts, or database audit records; process-
  memory fallback in enforced production mode.

Residual risks include colluding institutions, fraudulent but hash-consistent
supporting artifacts, compromised identity/accreditation sources, harassment by
high-volume challenges, and database-owner compromise. Rate limits, abuse-case
governance, independent checkpoints, public transparency, and external audit
remain required; challenge volume alone is never evidence of truth.

### API Design

```text
POST /canopyproof/evidence/:evidenceId/challenges
GET  /canopyproof/evidence/:evidenceId/challenges
GET  /canopyproof/verification/evidence-challenges/:challengeId

POST /canopyproof/verification/evidence-challenges/:challengeId/resolutions
GET  /canopyproof/verification/evidence-challenges/:challengeId/resolutions
GET  /canopyproof/verification/evidence-challenge-resolutions/:resolutionId

POST /canopyproof/verification/evidence-challenge-resolutions/:resolutionId/corrections
GET  /canopyproof/evidence/:evidenceId/corrections
GET  /canopyproof/verification/evidence-corrections/:correctionId
```

Every `POST` requires a bounded `Idempotency-Key`; actor identity, durable role,
organization, membership, verification, and accreditation are resolved from the
origin-verified authorization binding, never request JSON. Challenge input
contains reason, severity, rationale, supporting-artifact hashes, prior evidence
event roots, and time. Resolution input contains decision, rationale, evidence
event roots, limitations, and time. Correction input contains only action,
rationale, evidence event roots, optional replacement evidence ID, and time.
Callers never supply project/organization/evidence roots, actor snapshots,
current status, predecessor/sequence, canonical IDs, hashes, safety, or event
payloads.

Challenge reads expose only bounded hash commitments and governance state to an
authenticated organization member in the first release. Cross-organization
public transparency is a later disclosure policy, not implicit access. Legacy
`/canopyproof/verification/challenge-cases*`, proof-record challenge mutation,
and all proof/certificate/MRV issuance remain fail-closed in enforced production
mode until their own durable authority adapters exist.

### Database Changes

- Add immutable `verification.evidence_challenges` with evidence/project/owning
  and challenger organization boundaries, challenged reliance/event roots and
  state, reason/severity/rationale, normalized prior event roots, supporting
  artifact hashes, complete challenger authority snapshot, canonical command/
  challenge hash/root, stream sequence/predecessor, safety, and audit event.
- Add immutable `verification.evidence_challenge_resolutions` with exact
  challenge/evidence roots, predecessor resolution ID/root, decision,
  rationale/limitations/evidence roots, reviewer authority/accreditation,
  canonical command/resolution hash/root, stream sequence/predecessor, safety,
  and audit event.
- Add immutable `verification.evidence_corrections` with the terminal upheld
  resolution/challenge roots, `withdraw|supersede`, optional replacement
  evidence/root/reliance/event roots, rationale/evidence roots, publisher
  authority, canonical command/correction hash/root, stream sequence/
  predecessor, safety, and audit event.
- Add indexes for evidence/challenge/resolution/replacement lineage and actor,
  time, decision, action, and roots. Add uniqueness for one exact challenger
  reason per challenged reliance root and one remedy per terminal resolution.
- PostgreSQL independently enforces actor authority, owning-organization
  resolution/remedy authority, conflict separation, exact current accreditation,
  historical event ordering, latest resolution chain, terminality, one remedy,
  replacement current approval, canonical ID/hash/root/payload, monotonic stream
  sequence, append-only rows, and database audit capture.
- Extend serializable Prisma adapters, stream advisory locks, cross-stream lock
  ordering, hashed command receipts, snapshot hydration, and deterministic
  reliance replay. No Prisma model is required for schema-qualified raw SQL.

### Migration Strategy

1. Add domain facts and replay tests first while every new route remains closed.
2. Add SQL tables, canonical functions, validators, append-only/audit triggers,
   adapters, and reads. Repeated schema application must preserve the complete
   trigger catalog.
3. Do not import mutable compatibility challenge status as authority. Quarantine
   legacy cases unless the original evidence/reliance root, verified actors,
   exact event order, independent resolution, and reproducible hashes can all be
   reconstructed without invention.
4. Validate open/dismissed/upheld/needs-more chains, multiple independent
   challenges, stale-review restoration, replacement approval, cross-org
   standing without access, exact/conflicting/concurrent retry, role and actor
   substitution, stream/cross-stream forks, direct SQL tamper, update/delete,
   restart replay, and enforced no-memory fallback.
5. Run the explicit disposable native PostgreSQL multi-connection gate before
   enabling routes. PGlite validates SQL behavior but is not proof of advisory-
   lock or concurrent serialization behavior.
6. Open challenge create/read, then resolution, then correction. Keep proof,
   certificate, public-record, and MRV reliance closed until challenge state is
   consumed by their own durable bounded-reliance checks.

### Rollback Strategy

- Close challenge/resolution/correction endpoints with durable-unavailable;
  never answer from compatibility memory or a challenge-free projection.
- Preserve every registration, validation, AI analysis, review, challenge,
  resolution, correction, semantic event, receipt, and database audit event.
  False findings are countered by later immutable decisions, never deletion.
- Restore missing validators and append-only triggers from the idempotent schema
  contract. Quarantine malformed rows instead of weakening constraints.
- A rollback may recompute projections from immutable facts but cannot restore a
  dismissed approval while another challenge blocks it, hide an upheld finding,
  detach a supersession, expose private evidence, or fabricate actor authority.
- Rollback cannot enable admin proxying, merge API/Web Workers, restore SVG
  branding, enable mainnet funds or automatic CANOPY distribution, or introduce
  certified-carbon-credit, tax-offset, financial-asset, or guaranteed-yield
  claims.

## Durable Final Evidence Verification Decision Extension

Status: implemented and locally verified. This extension follows
durable evidence challenge/correction authority and precedes Environmental
Proof Record issuance.

### Problem Statement

The compatibility `verification-decisions` service accepts caller-selected
evidence, AI, quality, work-item, governance, and audit-root arrays; checks
mostly that approval arrays are non-empty; and permits owner, admin, verifier,
or researcher roles to approve. It does not resolve the referenced facts,
verify current challenge-aware evidence reliance, prove organization or project
scope, enforce current accreditation, separate the final decision maker from
the contributor/reviewer/AI/challenge actors, bind a predecessor event, or make
later evidence automatically stale. Its preliminary SQL table preserves rows
but repeats those weak checks.

The compatibility proof service is more dangerous: it marks evidence accepted
in process memory from a human-review payload supplied inside the issuance
request. A proof record can therefore bypass the durable registration,
validation, AI, human-review, challenge, correction, and final-decision chain.
Those routes must remain closed.

Production needs a dedicated final evidence decision fact. It is a second-human
maker-checker judgment over one exact current evidence reliance projection. It
does not rewrite reliance, issue a proof, or certify an environmental outcome.

### Trust Model

- A final decision binds one immutable evidence registration and the exact
  challenge-aware reliance root, state, terminal event, validation root,
  complete current AI set, and current authoritative human-review root visible
  immediately before the decision event.
- Decisions are `verify`, `reject`, or `request_changes`. `verify` requires
  current evidence reliance `approved` and a current human review whose decision
  is `approve`. A final verifier may veto an otherwise approved review with
  `reject` or `request_changes`, but can never promote a non-approved review.
- No final decision is permitted while reliance is `registered`,
  `validation_passed`, `ai_advised`, `challenged`, `correction_required`,
  `withdrawn`, or `superseded`, or while no current authoritative human review
  exists. Blocked/needs-review/rejected/changes-requested evidence may receive
  only `reject` or `request_changes`.
- The decision maker must be a verified human with the exact active `verifier`
  role in the evidence-owning verified organization and current approved
  organization accreditation. Owner/admin/researcher/observer/community/Agent
  role assertions cannot author a final decision.
- The final verifier must differ from the evidence contributor, current human
  reviewer, every current AI agent, every challenger/resolution reviewer/
  correction publisher in the evidence stream, and the author of the latest
  prior final decision. This creates maker-checker separation and prevents a
  challenge adjudicator from immediately certifying their own outcome.
- Source event roots must include registration, latest validation, every current
  AI analysis, current human review, and the pre-decision terminal event. Every
  source must be an earlier event in the same evidence stream. A terminal root
  commits the complete predecessor history; callers cannot cite future or
  foreign facts.
- Only one final decision can be current. A new decision is prohibited while the
  latest decision event is still terminal, except an exact idempotent retry.
  Any later validation, AI, human review, challenge, resolution, or correction
  event makes the prior final decision `stale`; a successor decision then binds
  the new current reliance and a different final verifier.
- Current final-verification projection states are `not_decided`, `verified`,
  `rejected`, `changes_requested`, or `stale`. Historical decisions remain
  visible and append-only.
- `verified` means only that the bounded evidence registration completed this
  internal two-human verification stage. It is not an Environmental Proof
  Record, certificate, certified carbon credit, carbon-tax offset, financial
  asset, guaranteed yield, mainnet-fund instruction, or automatic CANOPY
  distribution. Proof issuance still requires separate project, monitoring,
  methodology, governance, and certificate authority.

### Data Flow

```text
immutable evidence registration
  -> deterministic validation
  -> complete advisory AI set
  -> independent accredited human review
  -> challenge-aware bounded reliance replay
  -> second independent accredited verifier reads exact reliance/source roots
  -> append evidence_final_decision + semantic event + command receipt
  -> derive current final-verification projection
       verify          -> verified
       reject          -> rejected
       request_changes -> changes_requested
  -> any later evidence-stream fact -> stale
  -> future Environmental Proof Record authority consumes only current verified
```

The write transaction locks command identity and the evidence semantic stream,
locks the registration and every referenced authority row, resolves current
actor/accreditation, replays current reliance, derives all IDs/hashes/roots and
the exact event payload, appends event then fact, writes the command receipt and
database mutation audit event, and commits once.

### Threat Model

The extension must reject or contain:

- AI, Agent, owner, admin, researcher, observer, community, inactive,
  unverified, foreign-organization, role-substituted, or stale-accreditation
  final decision makers;
- contributor self-decision, human-review self-approval, AI self-approval,
  challenge/resolution/correction conflict, and repeated use of the prior final
  verifier;
- caller-selected evidence/project/organization roots, current state,
  validation/review/AI sets, actor snapshots, sequence, predecessor, canonical
  ID/hash/root, safety, or semantic-event payload;
- verify over missing/stale/non-approve review, incomplete AI set, blocked or
  challenged reliance, upheld-without-remedy challenge, withdrawn/superseded
  evidence, or stale replacement context;
- foreign, future, omitted, duplicate, malformed, or unbounded source roots;
  raw evidence, personal data, credentials, secrets, keys, tokens, or unsafe
  public/financial/carbon claims in rationale or limitations;
- a second current final decision, decision flip without an intervening
  authority fact, changed idempotency reuse, concurrent duplicate/forked facts,
  backwards time, missing event, or mismatched event action/actor/payload;
- update/delete of decisions, events, receipts, or database audit rows;
  compatibility dossier or proof routes falling back to process memory in
  enforced production mode.

Residual risks include colluding reviewers, compromised accreditation or
identity systems, semantically false but hash-consistent evidence, biased
rulesets/models, and database-owner compromise. External audit checkpoints,
methodology governance, reviewer rotation, challenge operations, and native
PostgreSQL concurrency testing remain required.

### API Design

```text
POST /canopyproof/evidence/:evidenceId/final-decisions
GET  /canopyproof/evidence/:evidenceId/final-decisions
GET  /canopyproof/verification/evidence-final-decisions/:decisionId
GET  /canopyproof/evidence/:evidenceId/final-verification
```

`POST` requires a bounded `Idempotency-Key` and an origin-verified human with
the exact `verifier` role and accredited-organization assurance. Request JSON
contains only decision, rationale, limitations, source event roots, and time.
Actor, organization, registration/reliance/validation/AI/review roots, prior
decision, sequence/predecessor, canonical output, safety, and event payload are
derived server-side.

Reads are scoped to authenticated members of the evidence-owning organization.
Legacy `/canopyproof/verification/decisions*`, generalized compatibility
challenges, proof records, public records, certificates, and MRV issuance remain
fail-closed in enforced production mode.

### Database Changes

- Add immutable `verification.evidence_final_decisions` with evidence/project/
  organization and evidence root; exact pre-decision reliance state/root/event;
  validation ID/root; complete AI IDs/roots; current human-review ID/root;
  optional prior final-decision ID/root; decision, rationale, limitations,
  source event roots/root; verified final-verifier authority/accreditation
  snapshot; command/decision hashes and roots; evidence sequence/predecessor;
  safety; and semantic event root.
- Add indexes over evidence sequence, decision, reviewer, time, current source
  roots, and prior-decision lineage. Enforce one `(evidence_id,
  evidence_sequence)` and canonical command hash.
- Add deterministic current final-verification projection/root functions.
  PostgreSQL independently replays the pre-decision reliance projection,
  resolves every referenced fact and conflict actor, validates current
  membership/accreditation and source order, rejects a still-current prior
  decision, and recomputes canonical ID/hash/root/event payload.
- Add insert-only and database-audit triggers. Extend the serializable Prisma
  trust adapter, stream advisory lock, hashed command receipts, snapshot
  hydration, organization-scoped reads, and status reporting.

### Migration Strategy

1. Implement pure-domain fact/replay and adversarial tests while routes remain
   closed.
2. Add the SQL table, projection/hash functions, validator, append-only/audit
   triggers, adapter, and reads. Repeated schema application must preserve the
   complete trigger catalog.
3. Do not import compatibility decision dossiers as final authority. Quarantine
   every row without an exact durable evidence/reliance root, complete current
   fact set, independent current accredited verifier, ordered semantic event,
   and reproducible canonical root.
4. Validate verify/veto/request-changes, later-fact staleness, successor reviewer
   rotation, challenge/correction states, actor and role substitution, source
   omission/future/foreign roots, exact/conflicting/concurrent retry, direct SQL
   tamper, update/delete, restart replay, and no-memory-fallback behavior.
5. Run the explicitly confirmed disposable native PostgreSQL multi-connection
   gate before enabling the mutation route. PGlite proves hash and trigger
   parity but not native advisory-lock/serialization behavior.
6. Open final-decision create/read only after all gates pass. Keep proof/public-
   record/certificate/MRV issuance closed until its own RFC and durable adapter
   consume current `verified` projections exclusively.

### Rollback Strategy

- Close final-decision endpoints with durable-unavailable; never return legacy
  dossier or process-memory proof state as fallback authority.
- Preserve every decision and its registration/validation/AI/review/challenge/
  correction/event/receipt/audit lineage. Corrections are successor authority
  facts, never updates or deletes.
- Restore missing validators and append-only triggers from the idempotent SQL
  contract. Quarantine malformed or legacy rows instead of weakening checks.
- Recompute current/stale projections from immutable facts after recovery. A
  rollback cannot revive a stale decision, ignore a challenge, verify withdrawn
  or superseded evidence, fabricate a reviewer, or detach source roots.
- Rollback cannot expose raw/private material, enable admin proxying, merge API
  and Web Workers, restore SVG branding, enable mainnet funds or automatic
  CANOPY distribution, or introduce certified-carbon-credit, tax-offset,
  financial-asset, or guaranteed-yield claims.

## Durable Environmental Proof Record Authority Extension

Status: pure domain, canonical PostgreSQL facts, Prisma command adapters, and
current/stale projection implemented and PGlite-verified. Organization-scoped
HTTP routes remain closed pending the disposable native PostgreSQL concurrency
gate, security review, and durable challenge/revocation projection. Existing
process-memory proof, public-record, certificate-transparency, and downstream
report surfaces remain closed in enforced production mode.

### Problem Statement

The compatibility proof path is not an authority boundary. `issueProofRecord`
accepts a human-review object inside the issuance request, rewrites referenced
in-memory evidence to `accepted`, selects only the latest in-memory AI object,
and trusts caller-supplied monitoring text and governance approval IDs. The app
looks up project monitoring and governance in process memory, does not consume
the durable current final-verification projection, does not bind a governed
methodology, and attributes issuance to the synthetic string `CanopyProof
Governance Layer`. Its combined verification history concatenates unrelated
event chains instead of creating a valid cross-domain source graph.

The preliminary `certificates.environmental_proof_records` table repeats this
weak model. It has no organization/project/methodology/final-decision source
roots, no command receipt or actor snapshot, no canonical insert validator, and
no update/delete prevention. Compatibility challenges mutate record status in
memory. Public records, certificate artifacts, ESG reports, funding views, and
the global dashboard can therefore consume facts that are not restart-safe or
replayable. Production correctly closes these routes today.

An Environmental Proof Record must instead be an immutable institutional
statement over an exact historical cross-domain authority bundle. It is not a
generic evidence approval and cannot create a carbon, tax, financial, funding,
token, or yield entitlement.

### Trust Model

- A proof candidate binds one verified organization and project; the exact
  current project root and eligible `active|monitored` status; a current
  published, unchallenged methodology version; one or more same-project
  evidence registrations; each registration's current `verified` final-
  decision ID/root; accepted project-monitoring events; and every source event
  root visible at candidate derivation time.
- Every evidence final decision must still be terminal in its own stream when
  the candidate, governance approval, and record are written. `stale`,
  `not_decided`, `rejected`, or `changes_requested` evidence cannot enter a
  candidate. Withdrawn, superseded, challenged, or correction-required reliance
  is necessarily ineligible.
- The methodology must be durable, immutable, canonically hashed, `published`,
  applicable to every evidence type (or `multi_scope`), and current at the
  candidate boundary. It must require human review, governance approval, public
  challenge, and monitoring timeline quality gates. Draft, deprecated,
  challenged, weakly imported, or process-memory methodology objects grant no
  issuance authority.
- Accepted monitoring must belong to the same project and organization, cover
  every evidence ID, postdate each final evidence decision, bind prior evidence
  and optional Terra roots, and satisfy the methodology cadence and required
  data-source policy. Free-form monitoring strings have no authority.
- Governance is a separate append-only candidate-approval stream. The applicable
  immutable policy requires at least two unique verified humans: at least one
  accredited verifier and at least one owner/admin. Approvers must be distinct
  from evidence contributors, AI agents, evidence reviewers/final verifiers,
  monitoring observers, one another, and the eventual record issuer. A conflict
  disclosure is mandatory; AI and Agent actors never approve.
- Issuance requires the exact approved candidate root and complete current
  approval quorum. The issuer is a verified human owner/admin with active
  membership in the owning organization, distinct from every candidate
  approver and source-authority actor. The server derives every source ID/root,
  record ID/hash/root, claim boundary, event payload, sequence, and predecessor.
- The record fact is immutable and initially `issued`. Its current projection is
  `issued`, `stale`, `challenged`, or `revoked`. A later project, methodology,
  evidence, final-decision, monitoring, governance, or proof-challenge fact
  never rewrites the record; projection replay makes outdated authority visible.
  Public discovery must not present `stale|challenged|revoked` as clean issued
  authority.
- The record contains hash commitments, bounded public location, contributor
  IDs, verification and monitoring roots, methodology and governance lineage,
  limitations, confidence derivation, and a claim boundary. Raw media, EXIF,
  private GPS detail, device identifiers, contact data, credentials, secrets,
  keys, tokens, and unrestricted personal data remain outside it.
- `issued` means Environmental Proof Record only. It is not a certificate of
  title, certified carbon credit, carbon-tax offset, financial asset, guaranteed
  yield, mainnet-fund instruction, automatic CANOPY distribution, or permission
  for an ESG/funding system to overstate the bounded observation.

### Data Flow

```text
durable project authority + current project root
  + published governed methodology authority
  + current verified evidence final-decision projections
  + accepted post-verification monitoring facts
  -> deterministically derive proof candidate + candidate root
  -> independent verifier approval fact
  -> independent owner/admin approval fact
  -> complete policy quorum + conflict separation replay
  -> independent owner/admin issuer replays every source at one transaction boundary
  -> append Environmental Proof Record event + immutable record + command receipt
  -> derive current proof projection
       source roots still current -> issued
       later authority changed    -> stale
       open proof challenge       -> challenged
       upheld terminal challenge -> revoked
  -> later public record/certificate/report adapters consume projection only
```

Candidate derivation is pure and read-only. Approval and issuance transactions
lock the command identity, project source stream, all evidence streams in sorted
order, methodology/policy identity, candidate approval stream, and record stream
before replay. They resolve rows under serializable isolation, append one
semantic event and one source fact, write one hashed command receipt and one
database audit mutation, then commit once.

### Threat Model

The authority must reject or contain:

- caller-supplied evidence acceptance, human review, AI result, contributor,
  project/location/root, methodology, monitoring timeline, approval quorum,
  status, confidence, sequence/predecessor, actor snapshot, record ID/hash/root,
  claim boundary, or event payload;
- missing, stale, rejected, challenged, correction-required, withdrawn, or
  superseded evidence; a final decision that is no longer terminal; mixed
  projects/organizations; duplicate evidence; foreign or future source roots;
- draft/deprecated/challenged/superseded or hash-invalid methodologies; missing
  quality gates; scope/data-source/cadence mismatch; process-memory methodology
  substitution;
- absent, rejected, foreign-subject, stale-policy, duplicate-reviewer, Agent,
  inactive, unverified, unaccredited, role-substituted, self-approved, colluding,
  or conflict-undisclosed governance authority;
- free-form, foreign, rejected, stale, pre-verification, incomplete-coverage, or
  hash-invalid monitoring; synthetic issuer identities;
- changed idempotency reuse, concurrent candidate/approval/issuance forks,
  backwards time, future roots, missing events, weak cross-domain concatenated
  histories, direct SQL insertion, update/delete, and restart replay divergence;
- stale records shown as current; generalized compatibility challenge state
  overriding the durable proof projection; downstream certificate, report,
  funding, or dashboard code reading process memory in enforced production;
- raw/private data, secret material, unsafe public claims, or any mainnet/token/
  carbon/tax/asset/yield behavior in record text or source envelopes.

Residual risks include reviewer collusion, compromised identity/accreditation or
database-owner authority, semantically false but hash-consistent source facts,
methodology bias, delayed satellite/field contradiction, privacy inference from
public location, and unavailable external audit operations. Reviewer rotation,
external checkpoints, rate-limited challenges, privacy review, and native
PostgreSQL concurrency/chaos gates remain required.

### API Design

```text
POST /canopyproof/projects/:projectId/environmental-proof-candidates/derive
GET  /canopyproof/environmental-proof-candidates/:candidateRoot
POST /canopyproof/environmental-proof-candidates/:candidateRoot/approvals
GET  /canopyproof/environmental-proof-candidates/:candidateRoot/approvals
POST /canopyproof/environmental-proof-records
GET  /canopyproof/environmental-proof-records
GET  /canopyproof/environmental-proof-records/:recordId
GET  /canopyproof/environmental-proof-records/:recordId/status
```

Candidate derivation accepts only bounded evidence IDs, methodology ID, and
monitoring event IDs. Approval accepts decision, rationale, conflict disclosure,
limitations, prior source-event roots, and time. Issuance accepts candidate root,
approval IDs, public limitations, and time. All actor/source authority and
canonical outputs are server-derived.

Mutations require a bounded `Idempotency-Key` and origin-authenticated durable
authorization. Candidate reads and approval reads are owning-organization
scoped. Record discovery remains organization-scoped until the separate public-
record/privacy RFC is implemented. Legacy `/canopyproof/proof-records*`,
`/canopyproof/public-records*`, certificate-transparency, ESG/funding consumers,
and generalized proof challenges stay fail-closed in enforced production.

### Database Changes

- Add immutable `certificates.environmental_proof_candidates` containing exact
  organization/project/project-root, methodology ID/hash/root, sorted evidence
  registration/final-decision IDs and roots, monitoring IDs/roots, source event
  roots/root, derived contributor/public-location/confidence/limitations,
  candidate hash/root, derivation actor/time, safety, and semantic event root.
- Add immutable `governance.environmental_proof_candidate_approvals` containing
  candidate root, policy ID/hash, decision, approver authority/accreditation
  snapshot, role class, conflict disclosure, limitations, predecessor approval,
  command/approval hashes and roots, safety, and event root. PostgreSQL derives
  quorum from unique current approvals and rejects conflicted actors.
- Add immutable `certificates.environmental_proof_record_facts` as the canonical
  issuance authority. It carries organization/project roots, candidate root,
  methodology publication authority, evidence final-decision roots, monitoring
  roots, approval IDs/roots/quorum root, issuer snapshot, source/command/record
  roots, safety, and semantic event binding. The preliminary
  `certificates.environmental_proof_records` table remains an explicitly
  non-authoritative compatibility projection so its existing downstream foreign
  keys cannot accidentally promote old rows into the trust root.
- Add deterministic candidate, approval-quorum, record, and current-status
  projection functions; exact TypeScript/PostgreSQL hash parity; canonical insert
  validators; per-source indexes; append-only and database-audit triggers.
- Extend the Prisma trust registry with sorted advisory locks, hashed command
  receipts, restart hydration, organization-scoped reads, and no memory fallback.
  Add proof source entity types to the semantic event allowlist.

### Migration Strategy

1. Implement and test pure candidate/approval/record replay while every legacy
   proof/public/certificate/report route remains closed in enforced mode.
2. Make methodology and proof-governance authority durable first. Do not accept
   process-memory methodology or approval objects and do not fabricate semantic
   roots for preliminary SQL rows.
3. Add candidate, approval, record-fact, and projection SQL contracts
   idempotently. Inventory existing `environmental_proof_records`; quarantine
   every row there as compatibility data unless a later, separately reviewed
   migration deterministically reissues it through the complete candidate and
   quorum path. The durable adapter reads only `environmental_proof_record_facts`.
4. Add Prisma/API adapters and preserve legacy development compatibility only
   behind explicit non-production isolation. Production has no fallback.
5. Test source staleness, challenge/revocation, methodology replacement,
   monitoring coverage/cadence, quorum and reviewer collisions, role/accreditation
   substitution, unsafe/private input, exact/conflicting/concurrent retry, direct
   SQL tamper, update/delete, restart replay, downstream refusal, and database
   outage rollback.
6. Run PGlite parity and the explicitly confirmed disposable native PostgreSQL
   multi-connection/serialization gate. Keep all new mutation/public routes
   closed until the native gate and security review pass.
7. Open organization-scoped candidate/approval/record APIs first. Public record,
   certificate artifact, ESG, funding, and dashboard consumption require their
   own privacy/currentness adapters and smoke gates.

### Rollback Strategy

- Close candidate, approval, and record endpoints with durable-unavailable; never
  return compatibility memory records or preliminary SQL rows as authority.
- Preserve every candidate, approval, record, source event, command receipt,
  database audit event, and later challenge. Rollback cannot update/delete facts,
  revive stale authority, lower quorum, substitute methodology, or detach roots.
- Restore missing functions/triggers from the idempotent SQL contract and
  quarantine malformed rows. Rebuild read projections from immutable facts.
- Downstream systems must fail closed when current proof projection cannot be
  reproduced; they cannot cache `issued` across a source change or outage.
- Rollback cannot expose raw/private evidence, enable admin proxying, merge API
  and Web Workers, restore SVG branding, enable mainnet funds or automatic
  CANOPY distribution, or introduce certified-carbon-credit, tax-offset,
  financial-asset, guaranteed-yield, or guaranteed-impact claims.

## Durable Methodology Publication And Proof Policy Authority Extension

Status: implemented as immutable policy, technical methodology, approval, and
publication facts with canonical PostgreSQL validation and restart replay.
Environmental Proof persistence consumes this authority; every new proof HTTP
route remains closed until the remaining native and security gates pass.

### Problem Statement

The compatibility methodology registry is process-local. A caller can create a
`published` object by supplying arbitrary `governanceApprovalIds`; those IDs are
not resolved to reviewers, memberships, accreditation, decisions, predecessor
events, or a publication quorum. The compatibility proof policy is static
configuration with a policy hash but no creator authority, semantic event,
version lineage, activation fact, or restart-safe status. Preliminary
`governance.methodologies`, `governance.policies`, and `governance.approvals`
tables preserve some fields but do not canonically validate cross-row authority.

An Environmental Proof Record cannot rely on these objects. Hash-consistent
configuration is not equivalent to governed publication. CanopyProof needs a
separate immutable authority for exact methodology publication and proof-policy
activation before candidate derivation can become a durable command.

### Trust Model

- A methodology version remains an immutable, canonically hashed technical fact.
  It does not become current publication authority merely because its embedded
  status says `published` or it contains approval-looking strings.
- Publication approval is a separate append-only stream bound to one exact
  methodology ID, hash, quality-gate root, methodology event root, publication
  policy root, predecessor approval, conflict disclosure, actor authority, and
  time. At least two unique verified humans are required: one currently
  accredited verifier and one researcher or owner/admin. The author, another
  approver, an Agent, an inactive member, and a role-substituted actor cannot
  approve.
- Publication is a final immutable fact issued by a verified owner/admin who is
  independent from the methodology author and every approver. It binds the
  complete approval set and derives one publication root. A newer published
  successor makes the prior publication non-current without rewriting it.
- A proof-governance policy version is an immutable canonical fact with a creator
  authority snapshot, explicit `proof_record` scope, reviewer roles, threshold,
  safety invariants, predecessor policy root, event root, and authority root.
  The constitutional minimum is not caller-configurable: at least two unique
  human approvals, including an accredited verifier and an owner/admin, remain
  mandatory even if policy data is tampered with.
- Initial policy bootstrap is migration-governed and routes remain closed. A
  later policy-activation extension can add external council signatures without
  changing existing policy or publication facts.
- Environmental Proof candidates consume only a methodology publication bundle
  and active proof-policy authority. They bind publication/policy roots and
  events, not raw process-memory objects or arbitrary approval IDs.
- None of these facts authorizes certified carbon credits, tax offsets, title,
  financial assets, funding entitlement, guaranteed yield, mainnet funds, or
  automatic CANOPY distribution.

### Data Flow

```text
immutable methodology version + exact quality gates
  -> independent accredited verifier publication approval
  -> independent researcher|owner|admin publication approval
  -> independent owner|admin publication fact
  -> current publication projection (published|superseded|challenged)

canonical proof policy version + creator authority + predecessor root
  -> active proof-policy authority projection

current methodology publication bundle + active proof policy
  -> Environmental Proof candidate source replay
```

Each mutation locks command identity and subject stream, resolves actor,
membership, organization, and accreditation under serializable isolation,
recomputes canonical IDs/hashes/roots and exact semantic-event payload, appends
one fact plus one event, writes a hashed command receipt and database audit row,
then commits once. Exact retries return the existing fact; changed retries fail.

### Threat Model

The authority must reject or contain arbitrary approval IDs; missing, rejected,
duplicate, foreign, stale, or self approvals; Agent or role substitution;
inactive/foreign membership; missing or stale verifier accreditation; publication
by an author or approver; incomplete quorum; draft, deprecated, challenged,
superseded, unsafe, hash-invalid, or weakly imported methodologies; missing
quality gates; changed policy thresholds or reviewer roles; foreign/future source
roots; sequence/predecessor forks; backwards time; direct SQL insertion;
update/delete; restart divergence; unsafe claims; and secrets or private material.

Residual risks include reviewer collusion, compromised identity/accreditation,
methodology bias, governance capture, database-owner compromise, and absence of
external council signatures during bootstrap. External checkpoints and policy
activation signatures are later additive controls, never retroactive mutation.

### API Design

```text
POST /canopyproof/methodology-publications/:methodologyId/approvals
GET  /canopyproof/methodology-publications/:methodologyId/approvals
POST /canopyproof/methodology-publications
GET  /canopyproof/methodology-publications/:publicationId
GET  /canopyproof/methodologies/:methodologyId/publication-status

POST /canopyproof/proof-governance-policies
GET  /canopyproof/proof-governance-policies
GET  /canopyproof/proof-governance-policies/:policyId
GET  /canopyproof/proof-governance-policies/:policyId/status
```

Mutations require a bounded `Idempotency-Key` and origin-authenticated durable
authorization. Request bodies contain only bounded decision/rationale/conflict/
source-root/time or policy configuration fields. Actor snapshots, predecessor,
sequence, canonical output, safety, and events are server-derived. Existing
compatibility methodology and governance routes remain non-authoritative and
fail closed in enforced production until migration is complete.

### Database Changes

- Add immutable `governance.proof_policy_versions` with canonical configuration,
  creator authority, predecessor, command/policy/authority roots, safety, and
  semantic event. Do not treat preliminary `governance.policies` rows as active
  authority.
- Add immutable `governance.methodology_publication_approvals` with methodology
  and policy roots, prior approval, decision, conflict disclosure, full actor and
  accreditation authority, command/approval roots, sequence, safety, and event.
- Add immutable `governance.methodology_publications` with complete approval IDs
  and roots, quorum root, independent publisher authority, command/publication
  roots, predecessor, safety, and event.
- Add deterministic current-publication and current-policy projection functions,
  canonical insert validators, indexes, append-only triggers, database mutation
  audit triggers, command receipts, and exact TypeScript/PostgreSQL hash parity.
- Extend the Prisma trust adapter with restart hydration and organization-scoped
  reads. Environmental Proof adapters may reference these new tables only.

### Migration Strategy

1. Implement pure policy/publication facts, replay, idempotency, independence,
   staleness, and adversarial tests while all new routes remain closed.
2. Add SQL contracts idempotently. Inventory preliminary policy, methodology,
   and approval rows; quarantine rather than promote any row lacking reproducible
   canonical actor, quorum, event, and root authority.
3. Seed an initial proof policy only through reviewed migration evidence; record
   its exact root. Do not synthesize publication approvals for existing methods.
4. Add Prisma commands and reads, PGlite hash/trigger tests, and explicit native
   PostgreSQL multi-connection concurrency tests.
5. Open organization-scoped authority routes only after native gates and security
   review. Then wire Environmental Proof candidate persistence to these sources.

### Rollback Strategy

- Close policy and publication endpoints with durable-unavailable. Never fall
  back to static policy objects, process-memory methods, or preliminary rows.
- Preserve all versions, approvals, publications, events, receipts, and audit
  rows. Supersession and challenge are successor facts, never update/delete.
- Restore validators/triggers from the idempotent contract and quarantine rows
  whose authority cannot replay. Rebuild current projections from immutable
  facts after recovery.
- Rollback cannot lower constitutional quorum, revive superseded methodology,
  detach source roots, fabricate actors, expose private evidence, weaken admin
  proxying, merge API/Web Workers, handle private keys, or enable any prohibited
  financial, carbon, tax, token, mainnet, or guaranteed-yield behavior.

## Environmental Proof Challenge, Risk, Review, And Resolution Authority Extension

Status: accepted design for implementation. Canonical Environmental Proof
record issuance exists, but its HTTP routes remain closed until this challenge
authority, native PostgreSQL concurrency gate, and security review are complete.

### Problem Statement

An immutable Environmental Proof Record cannot be trustworthy if disputes are
handled by mutating its status, by a generic in-memory challenge object, or by a
single reviewer. The compatibility `proof_record_challenges` path lacks the
canonical record root, current projection, challenger authority snapshot,
independent risk fact, governed review quorum, exact predecessor/event stream,
restart replay, and database-enforced resolution authority. It cannot revoke a
canonical `environmental_proof_record_facts` record.

The challenge system must preserve the original issued fact, make open disputes
immediately visible, independently record operational risk, require conflict-
separated human governance review, and derive revocation only through a final
append-only resolution.

### Trust Model

- A challenge binds one exact canonical record ID/root, candidate ID/root,
  authority root, current record projection root/state, proof-policy root, reason,
  severity, hash-only supporting artifacts, source events, challenger identity,
  organization, and time. Raw evidence and personal data never enter the fact.
- A verified human owner/admin/verifier/researcher with active membership in a
  verified organization may open a challenge. Cross-organization standing is
  permitted but grants no record-owner membership, private evidence, review, or
  resolution authority. Agents cannot challenge or review.
- Opening appends two facts in one serializable command: the challenge and an
  independently hash-rooted risk signal. The risk signal is deterministic from
  challenge severity/reason/record root and can only escalate operational
  attention; it cannot resolve the dispute.
- Reviews are append-only facts in the record-owning organization. Each binds
  the exact challenge/risk roots, prior review, conflict disclosure, rationale,
  source events, and current actor authority. Reviewers must be independent from
  the challenger, record issuer, candidate deriver, source actors, original
  candidate approvers, each other, and the eventual resolver.
- A complete terminal quorum requires at least the record policy threshold,
  including one currently accredited verifier and one owner/admin. Every review
  must agree on `uphold` or `reject`; `needs_more_evidence` keeps the challenge
  `UNDER_REVIEW` and prevents final resolution.
- Final resolution is issued by another independent verified owner/admin in the
  record-owning organization. It binds the complete review set/quorum, challenge
  risk root, prior events, rationale, time, and canonical resolution root.
- Projection is derived, never stored by updating the record: `OPEN` before a
  review, `UNDER_REVIEW` after any non-final/incomplete review, `RESOLVED` after
  upheld resolution, and `REJECTED` after rejected resolution. Record projection
  becomes `challenged` while open/under review, `revoked` after upheld resolution,
  and otherwise returns to its independently computed `issued|stale` source
  projection after a rejected resolution.
- Challenge resolution is environmental accountability only. It cannot create
  title, compensation, payment, certified carbon credit, tax offset, financial
  asset, guaranteed yield, mainnet movement, or automatic CANOPY distribution.

### Data Flow

```text
canonical record + current source projection + authenticated challenger
  -> append challenge fact
  -> append deterministic risk-signal fact
  -> project challenge OPEN / record CHALLENGED
  -> independent governance review 1
  -> independent governance review N
  -> complete verifier + owner/admin unanimous quorum
  -> independent owner/admin resolution
       uphold -> challenge RESOLVED / record REVOKED
       reject -> challenge REJECTED / record returns to ISSUED or STALE
  -> public/certificate/report consumers read projection only
```

Every command locks the record candidate stream before replay, appends contiguous
semantic events, inserts immutable facts and database mutation audit records,
writes a hash-only command receipt, and commits once under serializable isolation.

### Threat Model

The authority must reject caller-supplied record/source/policy/projection/risk/
sequence/hash roots; unknown or compatibility records; duplicate unresolved
challenges; mixed record/candidate/organization bindings; raw/private evidence;
missing or malformed artifact hashes; unsafe claims; Agent or unverified actors;
inactive/foreign reviewer membership; stale verifier accreditation; challenger,
source, issuer, approver, reviewer, or resolver collisions; duplicate reviewers;
incomplete, adverse, mixed, or stale-policy quorum; backwards time; missing,
foreign, or future events; direct SQL insertion; update/delete; restart forks;
and resolving a challenge whose record stream advanced outside the expected
predecessor.

Residual risks include coordinated reviewer capture, malicious but hash-valid
artifacts, identity/accreditation compromise, abusive challenge volume, delayed
external evidence, and database-owner compromise. Rate limits, abuse triage,
external audit checkpoints, reviewer rotation, and independent operations remain
required controls.

### API Design

```text
POST /canopyproof/environmental-proof-records/:recordId/challenges
GET  /canopyproof/environmental-proof-records/:recordId/challenges
GET  /canopyproof/environmental-proof-challenges/:challengeId
POST /canopyproof/environmental-proof-challenges/:challengeId/reviews
GET  /canopyproof/environmental-proof-challenges/:challengeId/reviews
POST /canopyproof/environmental-proof-challenges/:challengeId/resolutions
GET  /canopyproof/environmental-proof-challenges/:challengeId/resolution
GET  /canopyproof/environmental-proof-records/:recordId/status
```

All mutations require bounded `Idempotency-Key` and origin-authenticated durable
authorization. The server derives actor snapshots, record/candidate/policy
authority, current projection, risk level/root, predecessor/sequence, quorum,
claim boundary, and all canonical hashes. Reads remain organization-scoped until
a separately reviewed privacy-safe public projection exists. Routes remain
fail-closed until native concurrency and security gates pass.

### Database Changes

- Add immutable `certificates.environmental_proof_challenges` with exact record,
  candidate, projection, policy, reason/severity, artifacts, challenger, source,
  command/challenge roots, safety, and semantic event binding.
- Add immutable `certificates.environmental_proof_challenge_risk_signals` with
  challenge/record roots, deterministic risk level/reason, source/risk roots,
  safety, and its own contiguous semantic event.
- Add immutable `governance.environmental_proof_challenge_reviews` with challenge
  and risk roots, prior review, decision, conflict disclosure, reviewer authority,
  source/command/review roots, safety, and event.
- Add immutable `governance.environmental_proof_challenge_resolutions` with the
  complete review IDs/roots, quorum root, independent resolver, terminal decision,
  source/command/resolution roots, safety, and event.
- Add deterministic challenge and record projection functions, canonical insert
  validators, source/currentness checks, append-only/database-audit triggers,
  indexes, command receipts, Prisma hydration, and TypeScript/PostgreSQL parity.

### Migration Strategy

1. Implement pure challenge/risk/review/resolution facts and replay tests while
   all canonical proof HTTP routes remain closed.
2. Add idempotent SQL contracts and quarantine every preliminary compatibility
   challenge; do not synthesize record roots, actors, reviews, or resolutions.
3. Add Prisma serializable commands, exact retry, restart hydration, scoped reads,
   PGlite direct-tamper tests, and optional native multi-connection concurrency.
4. Add API isolation/security tests. Open organization-scoped routes only after
   the native gate and security review pass.
5. Make certificate, public record, ESG, funding and dashboard consumers use only
   the canonical record/challenge projection in later reviewed migrations.

### Rollback Strategy

- Close challenge/review/resolution endpoints with durable-unavailable. Never
  fall back to compatibility challenges or mutate record status.
- Preserve every record, challenge, risk signal, review, resolution, event,
  command receipt and database audit fact. Rebuild projections by replay.
- Restore validators/triggers from the idempotent contract and quarantine facts
  that cannot reproduce exact actor, predecessor, quorum, source and hash roots.
- Rollback cannot dismiss an open challenge, revive a revoked record, remove an
  adverse review, expose private evidence, reduce quorum, substitute AI, weaken
  admin proxying, merge API/Web Workers, access private keys, or enable prohibited
  financial, carbon, tax, token, mainnet, reward, or yield behavior.
