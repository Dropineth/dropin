# CanopyProof Data Model

Status: Phase 1 design baseline

This document defines the target PostgreSQL bounded contexts for CanopyProof OS.
It is a production design contract, not a claim that every table already exists.
The current Prisma schema is reviewed in `docs/ARCHITECTURE_CURRENT_STATE.md`.

## Principles

- PostgreSQL is the system of record.
- Mutations write append-only audit events.
- Evidence media is content-addressed and stored outside the relational database.
- AI outputs are advisory records and never final authority.
- Public environmental records must preserve the boundary: no certified carbon
  credit, no tax offset, no financial asset, no guaranteed yield.

## Schemas

```text
identity
organizations
projects
evidence
verification
certificates
satellite
impact
funding
governance
reporting
audit
```

## identity

Purpose: bind humans, organizations, agents, and devices to Dropin identity.

Compatibility tables:

- `identity.participants`: human, organization, agent, and device participant
  identities used by the current CanopyProof OS SQL contract.
- `identity.credentials`: wallet, email, OAuth, device public key, institutional
  credential.
- `identity.reputation_snapshots`: non-authoritative trust and contribution
  score snapshots.
- `identity.device_fingerprints`: mobile/device attestation metadata with
  privacy controls.
- `identity.device_attestation_verification_facts`: additive, append-only E1a
  signed-receipt verification facts bound to an unchanged modeled E1 device
  row, active consent, a verifier agent, command receipt, and semantic event.
- `identity.agent_profiles`: CanopyProof agent capabilities, allowed AHIN
  actions, and human-review boundaries.

Production requirements:

- no anonymous settlement-grade evidence.
- credential revocation must not delete history.
- device identifiers must support privacy-preserving hashing and lawful erasure
  workflows where applicable.
- agents cannot be final authority; their actions must resolve into audit events
  and human review where proof, ESG, funding, or public-risk decisions are made.

Current CanopyProof OS slice exposes `/canopyproof/identity/*` as the identity
compatibility layer. Participant records include accountable owner ID,
organization scope, roles, credential commitments, verification status,
reputation score, subject hash, timestamps, and append-only audit history.
Reputation snapshots capture previous score, new score, source, reason,
recorder, snapshot hash, and audit event root. Reputation is advisory context;
it does not replace RBAC, governance approval, conflict disclosure, or human
review.

The SQL-first `identity.participants` table now carries `owner_id`, optional
`organization_id`, bounded role array, verification status, and update time in
addition to its participant type and display identity. Existing rows migrate to
`observer`/`pending`, which is intentionally non-authoritative until reviewed.
Participants cannot be deleted through the normal contract. The stable
`identity.resolve_authorization_binding(actor, role, organization)` function
returns a bounded current-state projection across participant, exact
membership, organization, and latest accreditation records; it returns no JWT,
documents, conflict disclosure, contact data, or evidence payload.

`identity.participants` additionally stores credential commitment hashes,
public-key hash, and unique subject hash for durable reconstruction.
`identity.reputation_snapshots` is append-only and stores previous/new bounded
scores, source, rationale, reviewer/time, snapshot hash, and semantic audit root.
Current participant reputation updates in the same transaction as the snapshot
and event.

## organizations

Purpose: institutional collaboration and authorization.

Target tables:

- `organizations.organizations`
- `organizations.memberships`
- `organizations.roles`
- `organizations.permissions`
- `organizations.accreditations`
- `organizations.verification_documents`
- `organizations.organization_lifecycle_facts`
- `organizations.organization_document_review_facts`
- `organizations.organization_appeal_facts`
- `organizations.organization_appeal_decision_facts`
- `organizations.organization_accreditation_application_facts`
- `organizations.organization_accreditation_review_facts`
- `organizations.organization_accreditation_decision_facts`
- `organizations.organization_accreditation_control_facts`
- `organizations.data_sharing_agreements`
- `organizations.data_access_requests`
- `organizations.data_access_request_decisions`
- `organizations.data_access_delivery_receipts`
- `organizations.data_use_attestations`

Required roles:

- Owner.
- Admin.
- Verifier.
- Researcher.
- Community.
- Observer.

Institution registry requirements:

- organization types include UN agency, government, NGO, research institution,
  corporate, community organization, auditor, investor, restoration operator,
  and climate fund.
- organization records carry legal name, jurisdiction, registration number,
  verification status, trust level, hash-bound documents, authorized users,
  accreditation status, and data-sharing policy.
- verification states are `pending`, `document_review`, `verified`,
  `suspended`, and `revoked`.
- `document_review` requires at least one hash-bound document.
- `verified` requires a registration number and at least one hash-bound
  document.
- compatibility verification transitions append an
  `organization_verification` audit event, but the mutable organization row is
  not the canonical lifecycle authority.

Implemented compatibility tables in `services/api/prisma/canopyproof-os.sql`:

- `organizations.organizations`: legal profile, type, jurisdiction,
  registration number, verification status, trust level, document JSON,
  authorized users, accreditation status, and update timestamps.
- `organizations.roles`: canonical role catalog for owner, admin, verifier,
  researcher, community, and observer.
- `organizations.permissions`: role/resource/action permission catalog for
  organization, membership, accreditation, data-sharing, evidence, report, and
  audit resources.
- `organizations.memberships`: organization-scoped actor role, status, conflict
  disclosure, granting actor, timestamps, and audit event root.
- `organizations.verification_documents`: normalized hash-bound registration,
  tax, accreditation, mandate, audit-letter, or other document records.
- `organizations.accreditations`: accreditation status, scope, decision actor,
  rationale, evidence hash, and audit event root.

Compatibility authorization treats membership updates as revocable current
state while audit events preserve every transition. Its latest accreditation is
selected by `decided_at` and ID. That mutable compatibility row is not the
canonical accreditation authority and must not be used by a new institutional
reliance path.

`organizations.organizations` now includes the domain fields needed for a
durable read model: display name, public contact, operating regions,
verification capabilities, data-sharing policy, and immutable registration
profile hash. Registration/verification commands maintain normalized hash-only
verification-document rows in the same transaction.

The additive route-closed migration
`services/api/prisma/organization-lifecycle-authority.sql` introduces the
canonical organization lifecycle and appeal authority:

- `organizations.organization_lifecycle_facts` records `pending`,
  `document_review`, `verified`, `suspended`, `revoked`, and appeal-driven
  reinstatement as one ordered append-only organization stream. The first fact
  must be a safe `pending` genesis anchor. Revocation is terminal for the
  organization ID.
- `organizations.organization_document_review_facts` binds the exact current
  profile, lifecycle, sorted document roots, and hash-only registration
  reference to an independent accredited human review. An accepted review must
  carry the deterministic reference to the current registration number;
  PostgreSQL recomputes it without copying the raw number into the fact. A
  different independent human must make the final verification transition.
- `organizations.organization_appeal_facts` preserves an appeal against the
  current suspension or revocation without changing the challenged fact.
- `organizations.organization_appeal_decision_facts` forms an append-only
  predecessor chain for `needs_more_evidence`, `denied`, or `upheld` decisions.
  Suspension can be reinstated only by a third human after an upheld appeal;
  an upheld revocation appeal requires a new identity and cannot reactivate the
  old ID.

All four tables share one monotonic `organization_sequence`, semantic event
predecessor, exact command receipt, deterministic fact root, forced tenant RLS,
and no-update/no-delete enforcement. PostgreSQL independently validates current
membership/accreditation, cross-organization authority, role separation,
registration-reference freshness, source roots, timestamps, transitions, and
event payloads. The mutable
`organizations.organizations.verification_status` and `trust_level` columns are
compatibility projections driven by accepted lifecycle facts after this
migration; direct changes fail closed. No route or automatic legacy backfill is
enabled.

The additive route-closed migration
`services/api/prisma/organization-accreditation-authority.sql` introduces a
separate canonical accreditation stream:

- `organization_accreditation_application_facts` binds the exact verified
  subject profile, sorted requested scope, evidence roots, policy root,
  requested expiry, and an optional prior approved decision for renewal;
- `organization_accreditation_review_facts` records one independent external
  human review over the exact application, profile, policy, and scope roots;
- `organization_accreditation_decision_facts` requires a different external
  human decider and records an approved interval of at most 366 days or a
  terminal denial for that application; and
- `organization_accreditation_control_facts` forms a no-fork suspension or
  terminal revocation chain over the latest approved decision.

All four families share one `organizationAccreditationSequence`, semantic
event predecessor, exact receipt, deterministic TypeScript/PostgreSQL roots,
forced tenant RLS, and append-only mutation guards. Projection uses a caller
supplied canonical `asOf`: approval is valid only while
`validFrom <= asOf < validUntil`; suspension, revocation, and expiry never
rewrite the original decision. Renewal is a new application, review, and
decision and cannot silently widen scope.

The repository re-resolves profile, policy, subject membership, and governance
authority inside the serializable transaction. PostgreSQL independently checks
the current participant, organization, membership, bounded authority snapshot,
separation of duties, transitions, roots, and event payload. A route-closed
canonical resolver now replays either the current signed root-governance
charter or the actor organization's canonical accreditation facts; the old
`organizations.accreditations` row is explicitly not a fallback. No ceremony,
route, scheduler, compatibility backfill, session migration, writer grant, or
production authorization is enabled.

The additive root-governance migration introduces one global, route-closed
constitutional stream for bootstrapping that accreditation authority:

- `governance.root_governance_proposal_facts` binds the charter version and
  document root, exact three-scope delegation, policy root, bounded interval,
  council public-key/member commitments, evidence roots, and predecessor;
- `governance.root_governance_attestation_facts` stores an immutable Ed25519
  approval or rejection over the exact proposal root, signer member root, and
  timestamp; and
- `governance.root_governance_decision_facts` materializes only a valid
  multi-organization quorum. Successor decisions require both old and new
  council thresholds.

All three families share one global sequence, semantic event chain, exact
receipt discipline, append-only guards, and forced RLS. Projection is explicit
as-of and returns only uninitialized, pending, active, suspended, revoked, or
expired. Actor snapshots bind `subject_membership`,
`root_governance_bootstrap`, or `canonical_accreditation` in their authority
root. No private key or compatibility accreditation is part of this model.

`organizations.data_sharing_agreements` stores immutable agreement versions.
Current revocation and supersession state is derived from append-only
`data_sharing_agreement_revocations` and
`data_sharing_agreement_supersessions`; the base row is never rewritten to hide
its original scope, use, privacy tier, or duration. Database triggers bind each
source row to its exact organization semantic event and independently reject
cross-organization, expired, duplicate, widened, or privacy-escalating lineage.

`audit.domain_events` is the append-only semantic event ledger. Rows carry
stream ID and database-assigned sequence, actor/action/entity binding, previous
root, payload hash, event root, time, and rationale. A trigger serializes each
stream, validates actor context and predecessor roots, independently recomputes
the canonical event root and derived ID, and prevents backwards time. Runtime
commands lock hashed command identity before receipt lookup and lock the
semantic stream before current-state rows. `audit.command_receipts` stores only
hashed idempotency/request material,
result identifiers/hashes, audit root, and time; update/delete is prohibited.
Both tables are themselves covered by the database v2 mutation stream.
- `organizations.data_sharing_agreements`: dataset scopes, privacy tier,
  permitted uses, revocation flag, expiry, agreement hash, and audit event root.
- `organizations.data_sharing_agreement_revocations`: append-only agreement
  revocation governance records. Rows bind organization, agreement, rationale,
  evidence event roots, revocation actor/time, revocation hash/root, and safety
  flags. These rows preserve why an agreement was closed while the current
  agreement view marks it revoked so future requests and deliveries fail closed.
- `organizations.data_sharing_agreement_supersessions`: append-only renewal and
  replacement lineage between immutable predecessor and successor agreements.
  Rows bind both agreement IDs and hashes, transition type, rationale, evidence
  event roots, decision actor/time, supersession hash/root, and least-privilege
  safety flags. One predecessor can have only one successor, and the successor
  cannot expand scope, permitted use, privacy tier, or duration except that a
  renewal may extend expiry while preserving all access terms. Persistent
  adapters must insert the successor agreement and supersession row in one
  transaction; the database validation trigger independently rechecks these
  invariants.
- `organizations.data_access_requests`: append-only governed access requests
  bound to a data-sharing agreement, requested dataset scopes, permitted uses,
  privacy tier, purpose, request hash, access root, and explicit safety flags.
  New durable rows remain immutable pending facts; compatibility decision
  columns stay null and are never updated.
- `organizations.data_access_request_decisions`: append-only human decision
  transitions bound to the organization, request, agreement, previous state,
  next state, independent decision actor, decision hash/root, and exact semantic
  event. The `(request_id, previous_status)` uniqueness boundary prevents two
  concurrent decisions from consuming the same state.
- `organizations.data_access_delivery_receipts`: append-only delivery receipts
  for approved data-access requests. Rows bind request ID, agreement ID,
  manifest ID, manifest export hash, entry root, classification, delivery
  channel, recipient actor ID, accountable delivery actor/time, purpose, access
  root, receipt hash, delivery root, exact safety boundary, and semantic event
  root. The database replays the latest request decision, requires an active
  unexpired agreement and manifest, checks classification against the approved
  privacy tier, verifies organization and participant memberships, and rejects
  actor/recipient self-delivery. It also recomputes the receipt ID, receipt hash,
  delivery root, and bound semantic-event payload hash from the same canonical
  JSON contract used by the TypeScript domain. Manifest hashes and classification
  are loaded server-side rather than trusted from the API request. Rows are hash-only
  delivery evidence, not raw evidence export records or proof that bytes were
  downloaded, used correctly, or accepted by the recipient.
- `organizations.data_use_attestations`: append-only use declarations and
  misuse challenges bound to delivery receipts. Rows store usage state, use
  case, output hashes, evidence event roots, limitations, attestation hash,
  usage root, safety flags, and exact semantic event. Arrays are bounded,
  normalized, sorted, and unique. PostgreSQL resolves delivery/request/manifest
  lineage, requires a verified human institutional member, enforces recipient
  authorship for positive/no-use statements, applies current authority only to
  positive use, and recomputes attestation ID/hash, usage root, and event payload
  hash. Rows do not store raw data or final enforcement outcomes; no-use and
  challenge facts remain admissible after access authority ends.
- `organizations.data_use_enforcement_cases`: append-only independent reviewer
  response records opened from misuse-challenged or revocation-requested
  attestations. Rows store case state, response action, evidence event roots,
  reviewer, enforcement hash/root, and safety flags requiring human review,
  independent review, separate approval for access mutation, and no financial or
  carbon-credit claims. Evidence arrays are bounded, normalized, sorted, and
  retain every challenged-attestation root. PostgreSQL replays historical
  delivery approval, validates the delivery and attestation hash/event chains,
  requires a verified human owner/admin/verifier, separates the reviewer from
  attester/recipient/deliverer, and recomputes case ID/hash/root and event
  payload. A later revocation does not erase or block independent review, and a
  case alone never mutates access.
- `organizations.data_access_restrictions`: append-only separate-approval
  records that bind an enforcement case to an actual request-level access
  restriction. Rows store the exact predecessor ID/root/state, restriction
  state, rationale, normalized evidence event roots, decision actor, optional
  review deadline, restriction hash/root, safety flags, and exact semantic-event
  root. PostgreSQL verifies the complete request/delivery/attestation/enforcement
  lineage, human owner/admin authority, four-way actor separation, allowed state
  transition, chronology, retained evidence, canonical ID/hash/root, and event
  payload. Current state is replayed by semantic-event sequence. Active
  remediation, suspension, or revocation blocks future delivery and positive
  use; expiry never clears it. Only a predecessor-bound `restored` row backed by
  a later resolved enforcement review reopens the restriction layer.
- `organizations.data_access_accountability_packets`: append-only
  observer-readable institutional review snapshots for governed data access.
  Rows store the request status at the packet event boundary, exact non-negative
  count summaries, bounded sorted agreement-revocation, agreement-supersession,
  delivery, use, enforcement, and restriction roots, packet hash/root, exact
  safety flags, and semantic-event root. PostgreSQL derives the complete ledger
  prefix by event sequence, verifies human institutional generator authority,
  and independently recomputes every packet field and event payload. Historical
  rows remain tied to creation-time lineage when later events make them stale;
  they are never silently refreshed. Packets carry no raw evidence, personal
  data, current verification result, or final proof authority.
- `organizations.data_access_accountability_verifications`: append-only replay
  verification attempts for accountability packets. Rows store a database-
  derived valid flag, sorted issue codes, optional expected packet root, stored
  and current hashes/roots, independent human verifier, verification root,
  exact safety flags, and semantic-event root. PostgreSQL replays the packet at
  its creation boundary and the ledger at the verification boundary. Normal
  later events produce `lineage_stale` without falsely claiming historical
  packet hash/root corruption. Every result is immutable and remains tied to
  the ledger prefix assessed at that event.
- `organizations.data_access_accountability_disclosures`: append-only public
  publication records for accountability packet roots. Rows bind one packet to
  one valid replay verification, a fixed disclosure policy, three-party
  separation metadata, publication hash/root, and exact public-safe flags. A
  database trigger independently replays packet creation, verification, and
  publication event boundaries; verifies active owner/admin human authority;
  and derives the disclosure ID, hash, root, and semantic-event payload. The
  public index derives `current` or `stale` state at read time without updating
  the row and uses bounded keyset pagination.
- `organizations.data_access_accountability_disclosure_challenges`: append-only
  public challenge statements bound to a disclosure root, reason, evidence event
  roots, authenticated human challenger role, and exact non-final safety
  boundary. The database verifies the challenger's active role in its own
  verified organization, allows cross-organization accountability without
  granting target access, requires every bounded root to reference a prior
  semantic event, and recomputes challenge ID/hash/root/event payload.
- `organizations.data_access_accountability_disclosure_resolutions`:
  append-only independent human review events. Initial and follow-up reviews
  form a previous-resolution chain; only `needs_more_evidence` may transition to
  another resolution, while a final decision is immutable. Upheld decisions
  must require a correction or withdrawal notice. PostgreSQL verifies current
  target-organization reviewer authority and independence from challenger and
  publisher, bounds prior semantic-event roots, derives the decision-specific
  event action and exact ID/hash/root/payload, and protects the one-root, one-
  successor, and one-final chain with distinct short indexes and triggers.
- `organizations.data_access_accountability_disclosure_notices`: append-only
  correction or withdrawal statements. Corrections bind a distinct replacement
  disclosure from the same organization; withdrawals contain no replacement.
  Both preserve the original disclosure and its challenge/resolution history.
  The database requires an active verified owner/admin publisher independent
  from the original publisher, challenger, and final reviewer; replays the
  replacement packet and governance state at the notice event boundary; binds
  prior evidence roots; and recomputes exact safety, ID/hash/root, and `FULFILL`
  payload. Five unique short triggers separately enforce validation, semantic
  event binding, no-update, no-delete, and database audit capture.

Disclosure publication, hash-only status/list/get reads, challenge
create/list/get, independent resolution create/list/get, and correction or
withdrawal notice create/list/get use the production PostgreSQL adapter. Public
projections derive `corrected` and `withdrawn` from event-ordered notices and
retain immutable notice and replacement roots without exposing raw evidence.

Catalog, verification-document, accreditation, data-sharing, data-sharing
agreement revocation, agreement supersession, data-access request, data-access
request decision, data-access delivery receipt, data-use attestation, and data-use enforcement case rows,
data-access restriction rows, and accountability packet, verification, and
disclosure, challenge, resolution, and notice rows are append-only in the SQL
contract. A packet cannot be republished and a final challenge decision cannot
be replaced. Membership rows can transition status but cannot be deleted;
every transition is captured by the audit trigger.

## projects

Purpose: restoration and environmental work units.

Target tables:

- `projects.projects`
- `projects.project_status_transitions`
- `projects.regions`
- `projects.sites`
- `projects.milestones`
- `projects.species_plans`
- `projects.monitoring_events`
- `projects.monitoring_windows`
- `projects.project_lifecycle_registration_facts`
- `projects.project_lifecycle_review_facts`
- `projects.project_lifecycle_transition_facts`
- `projects.project_lifecycle_control_facts`

`projects.projects` is an immutable registration fact, not a mutable current-
state row. It binds the verified owning organization, canonical location,
bounded indicator sets, governance policy, exact human creator role, claim
boundary, project hash/root, and singular semantic registration event. It must
start at `submitted`; update and delete are database-rejected.

`projects.project_status_transitions` appends predecessor-bound lifecycle facts.
Current state is replayed across `submitted`, `under_review`, `active`,
`monitored`, `challenged`, `suspended`, and terminal `archived`. The database
checks the finite state machine, actor membership, monotonic event time, previous
project root, canonical hash/root, and exact semantic event. An `active` or
`monitored` transition requires an applicable approved policy decision from a
verified human who is neither the project creator nor transition actor.

`projects.monitoring_events` appends project-level observations. Each row stores
the exact observer role, previous and resulting project status/root, bounded
sorted evidence and satellite references, indicators, numeric metrics,
deterministic event/root, and semantic event root. Every source ID must already
exist, belong to the same project, and not postdate the observation. Accepted
monitoring can move `active` to `monitored`; challenged monitoring derives
`challenged`. It does not certify the source evidence.

PostgreSQL-mode `/canopyproof/projects*` mutations require a bounded
`Idempotency-Key` and replay from these immutable facts after restart. Exact
retries return the historical committed result and changed retries conflict.
The compatibility states above are not aliases for the institutional lifecycle.
A separate route-closed authority now stores four immutable fact families. A
registration binds the current project root/status, bounded baseline,
intervention, monitoring plan, policy and human subject-authority snapshot. An
external canonically accredited human reviews the exact registration. Later
facts permit only `PROPOSED -> FUNDED -> VERIFIED ->
LONG_TERM_OBSERVATION -> CLOSED`, with exact funding, Environmental Proof,
post-verification monitoring, or closure source commitments re-resolved at the
transition time by the repository callback. The canonical resolver currently
supports funding, Environmental Proof, and post-verification monitoring. Closure
and restoration fail closed because no independent governed closure-review or
restoration-decision fact family exists. Challenge and suspension dominate the
projection; revocation is terminal and expiry never falls back to older
authority.

Each project-lifecycle stream has one monotonic sequence, semantic audit-event
predecessor, exact command receipt, TypeScript/PostgreSQL root parity, forced
tenant RLS, and update/delete denial. Compatibility rows are input lineage only;
there is no automatic backfill or status promotion. The immutable registration
project root is a historical anchor, while stage-source `currentRoots` bind the
current project and source projections at transition time. A dedicated governed
policy subject, `project_lifecycle`, supplies the exact policy ID/root and human
separation constraints. The authority has no HTTP route, scheduler, or
activation approval.
Project profiles and lifecycle projections remain accountability records, not
certified carbon credits, tax offsets, financial assets, ownership rights,
mainnet fund movements, guaranteed-yield products, or automatic CANOPY
distributions.

## evidence

Purpose: raw and normalized evidence envelopes.

Target tables:

- `evidence.evidence_objects`
- `evidence.evidence_items`
- `evidence.media_upload_intents`
- `evidence.media_objects`
- `evidence.media_provider_receipt_verification_facts`
- `evidence.media_scanner_receipt_verification_facts`
- `evidence.consent_receipts`
- `evidence.consent_revocations`
- `identity.device_attestations`
- `evidence.media_metadata_extractions`
- `evidence.media_metadata_extraction_facts`
- `evidence.metadata_extraction_verification_facts`
- `evidence.review_tasks`
- `evidence.retention_policy_decisions`
- `evidence.retention_decision_facts`
- `evidence.retention_execution_facts`
- `evidence.location_observations`
- `evidence.exif_metadata`
- `evidence.offline_sync_batches`
- `evidence.offline_sync_items`
- `evidence.community_attestations`
- `evidence.offline_sync_batch_facts`
- `evidence.offline_sync_item_facts`
- `evidence.community_attestation_facts`
- `evidence.custody_events`
- `evidence.duplicate_candidates`

Canonical evidence envelope:

```json
{
  "id": "evidence_...",
  "location": {
    "latitude": 0,
    "longitude": 0,
    "accuracy_meters": 0,
    "privacy_mode": "precise"
  },
  "timestamp": "2026-07-08T00:00:00.000Z",
  "contributor": "identity_subject_id",
  "media_hash": "sha256:...",
  "gps_hash": "sha256:...",
  "verification_status": "submitted",
  "confidence_score": 0,
  "reviewers": [],
  "audit_history": []
}
```

Evidence statuses:

- submitted.
- quarantined.
- normalized.
- pending_ai_analysis.
- pending_human_review.
- accepted.
- rejected.
- challenged.
- revoked.
- superseded.

### Durable Registration Fact

`evidence.evidence_objects` now stores one immutable contributor-authored
registration fact. It binds the owning organization, exact contributor role,
project status/region/root and authority time at submission, normalized location and timestamps,
media/GPS/device/EXIF commitments, deterministic structural issues, initial
`validated` or `challenged` status, fixed-empty reviewer set, bounded confidence,
claim boundary, evidence hash/root, and one exact semantic event. `validated`
means structural ingestion only; it does not mean human verification.

PostgreSQL independently checks that the contributor is a verified human with
the exact active project-organization role, the project is current and not
archived, the project boundary cannot be supplied by the caller, media hashes
are single-use, issues/status are canonical, and TypeScript/SQL hashes match.
Registration, semantic event, hashed idempotency receipt, and database audit
event commit atomically. Update and delete are prohibited. Exact retries replay
the original fact; conflicting IDs, requests, or media commitments fail closed.

In PostgreSQL mode, `POST /canopyproof/evidence`, `GET /canopyproof/evidence`,
and `GET /canopyproof/evidence/:id` use this authority and scope reads to the
authenticated organization. The broader status vocabulary above belongs to
future append-only validation, AI, human-review, challenge, and supersession
facts; it must not be written back into the registration row.

### Durable Consent And Device Custody Facts

`evidence.consent_receipts` is an immutable, subject-authored grant or lawful-
basis fact. It binds the verified human and active organization membership,
subject and authority roots, sorted purposes, privacy mode, policy version,
evidence commitment, optional device-fingerprint commitment, retention window,
semantic-event sequence, command hash, receipt hash/root, and safety boundary.
The row is never updated to represent withdrawal.

`evidence.consent_revocations` appends one later subject-authored revocation
fact against the exact receipt root. The current consent projection is derived
as `active`, `expired`, or `revoked` for an explicit evaluation time. Database
triggers recompute the same projection root and hash lineage as TypeScript.

`identity.device_attestations` appends a consent-bound device fact with only
hashed device/provider material, provider/key identifiers, issue/expiry,
reputation, sorted risk flags, and a provider-verification state. Current E1
commands accept only `modeled_only`; no request can assert trusted hardware
verification. The derived state is `current`, `expired`, `consent_revoked`,
`consent_expired`, or `needs_review`. Provider signature verification requires
a future dedicated adapter and remains a production gate.

All three facts share the `evidence-custody:<subjectId>` semantic stream and
commit with a hashed command receipt in one serializable transaction. Update
and delete triggers reject mutation. PGlite parity/restart tests pass; the
authored native dual-connection gate remains unexecuted without an explicitly
confirmed disposable PostgreSQL database. HTTP compatibility routes remain
closed in enforced production mode.

### Durable Metadata And Retention Facts

The additive E3b migration creates three route-closed authority relations:

- `evidence.media_metadata_extraction_facts` stores minimized extractor output
  commitments, exact E1/E2 source roots, bounded quality bands, modeled-provider
  state, and no raw EXIF, coordinates, credentials, or precise location;
- `evidence.retention_decision_facts` stores an accredited human decision,
  consent projection, policy/rationale commitments, source lineage, and an
  append-only per-source decision sequence;
- `evidence.retention_execution_facts` stores modeled provider-operation
  receipts separately from the decision. A modeled `completed` claim remains a
  pending projection and cannot assert physical minimization or disposal.

All three bind the shared `evidence-media:<evidenceId>` semantic stream, a
hashed idempotency receipt, organization RLS, and database audit event in one
serializable transaction. PostgreSQL recomputes command/fact/root hashes and
rejects source, projection, actor, event, sequence, or safety mismatch. A legal
hold is terminal until a future governed release authority exists, and an
execution must target the latest decision so stale disposal authority cannot be
replayed. The rollback migration refuses non-empty relations. No E3b HTTP route
or provider worker is mounted.

### Durable Metadata Extractor Verification Facts

The additive E3c migration leaves every E3b extraction fact immutable and
`modeled_only`. `evidence.metadata_extraction_verification_facts` records one
independent verification for an exact extraction root and binds the evidence,
object, provider receipt, extractor image/schema/policy, allowlisted signer key,
signature hash, accountable verifier, semantic event, idempotent command
receipt, database audit event, and deterministic verification/fact roots. The
raw Ed25519 signature, EXIF/GPS payloads, coordinates, provider URLs,
credentials, and private key material are forbidden.

E3c uses `evidence-metadata-adapter:<evidenceId>` rather than consuming the E3b
base stream. Its effective projection may remove only
`metadata_provider_verification_pending`; any remaining media, device,
accuracy, clock, consent, or review issue keeps the extraction non-final. The
table is append-only, forced-RLS tenant scoped, SQL-root verified, and protected
by a rollback that refuses non-empty authority.

The runtime policy adapter accepts only a privately branded receipt produced by
strict schema, lineage, freshness, minimization, hash, and Ed25519 checks. The
fixed HTTP port has no caller-selectable endpoint and sends only immutable
locators and hash/categorical context. Both remain absent from the application
composition root. A governed effective-media projection reconciling E1 base
state with E2a receipt trust is required before live orchestration can satisfy
the adapter's strict `available` media prerequisite.

### Durable Media Adapter Verification Facts

The additive, route-closed E2a migration does not mutate historical media
objects or scan results from `modeled_only` to `verified`. It appends:

- `evidence.media_provider_receipt_verification_facts`, one fact per immutable
  media object. The fact binds exact intent/object roots, provider receipt,
  namespace and version, content constraints, upload time, encryption,
  governed retention-policy root/state, accountable verifier authority,
  semantic event, hashed command receipt, and deterministic verification/fact
  roots; and
- `evidence.media_scanner_receipt_verification_facts`, one fact per immutable
  scan result. The fact binds exact object/scan roots, scanner receipt,
  scanner-policy root, public signer-key identifier, Ed25519 signature hash,
  accountable verifier authority, semantic event, hashed command receipt, and
  deterministic verification/fact roots. Raw signatures are not persisted.

The internal, route-closed adapter orchestrator uses two phases. Provider HEAD
or scanner I/O and cryptographic verification complete before a database
transaction is opened. Only an adapter-branded, policy-validated provider
receipt or a signature-free minimized scanner receipt may enter the durable
port. The serializable commit then reloads and revalidates all immutable source
roots, binds the organization and agent authority, locks both the base media
stream and the adapter stream, and atomically appends a missing modeled E2
object/scan fact together with its E2a verification event, command receipt,
fact, and database audit record. Failure exposes none of that bundle.

E2a facts use the dedicated semantic stream
`evidence-media-adapter:<evidenceId>` so infrastructure-verification authority
does not consume or forge predecessor roots owned by the base E2 media stream.
A scanner call is refused before external I/O unless the exact object already
has a durable provider-verification fact; PostgreSQL repeats that prerequisite
and verifies provider/scanner chronology at insert time. Exact retries consult
the durable fact before repeating external I/O, while stream and uniqueness
locks close concurrent-write races.

Both tables are append-only, forced-RLS tenant scoped, database audited, and
protected by non-empty rollback refusal. SQL independently recomputes provider
receipt, scanner receipt, verification, command, and fact roots.
`evidence.media_adapter_trust_projection` reports only infrastructure receipt
state (`provider_pending`, `retention_pending`, `scanner_pending`,
`receipt_challenged`, or `verified_receipts`). It is explicitly not a media
availability, evidence verification, proof, certification, funding, or token
decision.

### Durable Offline And Community Facts

The additive E4 migration creates three route-closed authority relations:

- `evidence.offline_sync_batch_facts` stores the organization/project/subject,
  consent and device roots, contiguous device sequence, advisory clock window,
  received time, ordered manifest root, aggregate outcomes, semantic-event
  binding, and safety boundary;
- `evidence.offline_sync_item_facts` stores ordered per-item reconciliation
  outcomes bound to an immutable evidence registration/root and client payload
  commitment, without raw payload or raw coordinates;
- `evidence.community_attestation_facts` stores one hash-only, non-final
  statement per actor/evidence pair. It cannot mutate evidence verification.

Offline batch plus items commit atomically. A deferred database trigger checks
completeness, contiguous item indexes, aggregate counts, the ordered Merkle
root, and command hash at commit. Community facts reject self-attestation,
unregistered or cross-organization actors, source substitution, raw notes, and
final-authority claims. Both streams use Serializable writes, advisory locks,
exact hashed idempotency receipts, semantic events, forced RLS, database audit,
and append-only triggers. The rollback refuses non-empty facts. A dedicated
authenticated adapter is now mounted below
`/canopyproof/evidence/mobile-sync`, but every command remains default closed
unless PostgreSQL, Cloudflare Access JWT authentication, the mobile-sync feature
flag, and the separate governance unlock are all present. The browser
coordinator accepts only an injected transport; no production `fetch`, automatic
background loop, or compatibility-memory fallback is mounted.

The binding write is a distinct `evidence.mobile-binding.create` Trust Registry
command. It acquires the subject-scoped custody lock and project shared lock,
then resolves actor membership, project, consent receipt/projection, device
attestation/projection, and appends the canonical evidence row in one
serializable transaction. Its command request excludes server evaluation time
from logical idempotency identity, so an exact retry replays the original fact;
changed authority IDs or evidence input conflict. Consent/device roots returned
to the browser are immutable facts, while a new command re-evaluates current
authority. E4 batch reconciliation remains a separate recoverable phase.

`audit.authority_fences` is a mutable concurrency primitive, not a trust fact.
It stores only a bounded authority key, monotonic revision, and database update
time. Custody and project writers advance their corresponding revision. Mobile
binding advances the subject revision and reads the project revision with a row
share lock after acquiring the matching advisory locks. Under PostgreSQL
Serializable isolation, a waiter whose snapshot predates a winning writer gets
a retryable serialization error instead of reading stale authority. Canonical
state, roots, timestamps, and audit history remain exclusively in append-only
domain facts/events; no projection may treat a fence row as evidence.

### Mobile Sync Admission Control

The additive, default-closed admission migration creates two tenant-scoped
relations:

- `audit.mobile_sync_admission_buckets` stores mutable fixed-window actor or
  organization counters keyed by command. It is operational coordination, not
  evidence, authorization, verification, or audit authority.
- `audit.mobile_sync_admission_denial_facts` stores one append-only denial fact
  per exhausted attempt. PostgreSQL independently derives the policy limits,
  denial reason, identifier, and deterministic root.

Both relations use forced RLS. Denial facts reject update/delete and feed the
database mutation audit. They contain organization ID, actor ID, command,
policy/window/count data, reason, time, and root only; raw request bodies,
coordinates, client IPs, media metadata, tokens, credentials, idempotency keys,
and private keys are excluded. The authority acquires organization then actor
locks and advances both counters in one Serializable transaction. It cannot
change evidence state or authorize verification, certification, funds, CANOPY,
tax treatment, ownership, or yield.

Current CanopyProof OS slice exposes an offline-first Evidence Collection
Network under `/canopyproof/evidence/*`. Media upload intents are
content-addressed and do not expose storage secrets. Confirmed media objects
bind to an existing upload intent, object key, byte length, encryption-at-rest
mode, malware scan status, and integrity root. Pending scans, quarantined
objects, and duplicate content hashes are non-final and cannot support clean
proof lineage. Consent receipts bind subject, purpose, lawful basis, privacy
mode, policy version, retention, evidence hash, and optional device fingerprint.
Revocation is a separate fact in the durable E1 authority. Device attestations
bind device fingerprint, public key hash,
attestation hash, expiry, reputation, and risk flags to an active consent
receipt and remain `modeled_only`. E1a stores no raw attestation, challenge,
signature, device identifier, or provider credential; its strict as-of
effective projection alone may become `current`, and effective-media v2 binds
that projection root. Durable metadata extraction facts bind available or explicitly
`needs_review` media, active consent, current or `needs_review` device
attestation, EXIF/GPS commitments, bounded accuracy/clock bands, and review
issues. Only fully verified sources can produce an accepted extraction;
modeled sources remain non-final. Evidence review tasks queue non-final media and metadata artifacts for
human decision. Retention policy decisions append consent-retention,
revocation, minimization, tombstone, and legal-hold outcomes without silent
deletion. The durable E4 authority requires an `Idempotency-Key`; exact offline
batch retries return the original immutable bundle and changed retries conflict
without overwriting prior evidence. Community attestations can support or
challenge field evidence, but they are hash-only advisory facts and cannot issue
proof records or mutate verification. Custody events append source-rooted,
previous-root-linked
records over evidence artifacts such as upload intents, media objects, metadata
extractions, review tasks, retention decisions, offline sync batches, and
community attestations. They provide institutional chain-of-custody lineage but
do not finalize proof, certify carbon credits, create tax offsets, move funds,
or guarantee yield. The legacy nested Evidence Network routes remain development
compatibility surfaces until each route is bound to its durable adapter and
named external-provider/privacy gates are approved; they fail closed in enforced
production mode. The separate mobile-sync adapter composes the durable Evidence
Registry and E4 authority without opening the legacy route family. Implementing
E1-E4 or mounting the adapter does not activate a production write path by
itself.

## mrv

Purpose: immutable cross-domain lineage indexing without replacing project,
evidence, verification, methodology, community, monitoring, or Environmental
Proof source authority.

The additive route-closed MRV migration creates:

- `mrv.graph_edge_facts`, one exact directed source-root/relationship/target-
  root assertion per methodology publication;
- `mrv.graph_snapshot_facts`, a predecessor-linked human-reviewed project edge
  manifest with coverage, issue codes, ordered edge-set Merkle root, and a
  non-final `reviewed_for_lineage` or `review_required` state;
- `mrv.graph_snapshot_member_facts`, contiguous immutable edge membership for
  each snapshot.

PostgreSQL resolves every endpoint through a fixed source-table allowlist and
recomputes endpoint, methodology, actor, command, fact, member, and root hashes.
It rejects caller-selected SQL, stale or substituted roots, cross-tenant or
cross-project edges, unsupported relationships, AI final authority, incomplete
snapshot manifests, future facts, raw/private fields, and semantic-event
mismatch. Serializable project-stream writes use advisory locks and exact
hashed command receipts. All three relations are append-only, database-audited,
forced-RLS, and covered by a rollback that refuses non-empty authority.

This first slice enables nine durable endpoint types and seven relationships.
Challenge/resolution edges, live current-reliance recomputation, native
multi-connection evidence, and all HTTP routes remain closed. A reviewed graph
snapshot is lineage only: it is not a certificate, certified carbon credit,
tax offset, financial asset, fund instruction, token distribution, or yield.

## verification

Purpose: deterministic validation, AI assistance, and human review.

Target tables:

- `verification.validation_runs`
- `verification.work_items`
- `verification.ai_observations`
- `verification.review_tasks`
- `verification.review_decisions`
- `verification.challenge_cases`
- `verification.challenge_evidence`
- `verification.quality_scorecards`
- `verification.decision_dossiers`

Rules:

- AI observations are advisory.
- `verification.ai_observations` stores structured satellite, ecological, and
  survival-estimation envelopes. Ecological contradiction and survival-risk
  findings reduce confidence but do not finalize status; critical survival
  contradictions must be resolved by a human reviewer before proof issuance.
- Human review decisions must link to evidence, reviewer identity, role, policy,
  timestamp, and audit event.
- Review decisions cannot overwrite evidence; they append state transitions.
- Verification decision dossiers bind human reviewer identity, reviewer role,
  evidence IDs, advisory AI IDs, Terra scene IDs, quality scorecard IDs, human
  review work item IDs, governance approval IDs, audit event roots, limitations,
  and source root before any downstream proof reliance.
- Approval dossiers cannot reference a blocked quality gate and cannot omit
  evidence, AI, quality scorecard, human-review, or audit-root references.
- Challenge cases bind disputed subjects, reason, severity, content-addressed
  evidence hashes, related audit roots, human-review assignment, safety
  boundary, and audit history. They can require more evidence, accept, reject,
  or withdraw a dispute, but they cannot delete or overwrite the challenged
  subject.

Current CanopyProof OS slice adds `verification.work_items` as the deterministic
queue and backpressure contract for Evidence -> Validation -> AI Analysis ->
TerraProof -> Human Review -> Proof Issuance. Work items store evidence,
project, stage, priority, status, dependencies, reason codes, role assignment,
queue/start/block/complete timestamps, transition actor, and immutable work
root. Rows are append-only for deletion purposes and every insert/update emits
an audit event. Backpressure blocks new work when active capacity is exhausted;
it does not silently drop evidence, auto-issue proof, or let AI bypass human
review.

## certificates

Purpose: Environmental Proof Records.

Target tables:

- `certificates.environmental_proof_candidates`
- `governance.environmental_proof_candidate_approvals`
- `certificates.environmental_proof_record_facts`
- `certificates.environmental_proof_records`
- `certificates.certificate_versions`
- `certificates.certificate_evidence`
- `certificates.governance_approvals`
- `certificates.monitoring_events`
- `certificates.public_records`
- `certificates.certificate_transparency_entries`
- `certificates.certificate_verifications`
- `certificates.proof_record_challenges`

Certificate statuses:

- draft.
- pending_review.
- issued.
- challenged.
- revoked.
- expired.
- superseded.

Certificate disclosure must state:

- not a certified carbon credit.
- not a financial asset.
- not a tax offset.
- not guaranteed yield.

Current CanopyProof OS slice stores public challenge cases for Environmental
Proof Records in `certificates.proof_record_challenges`.

`certificates.environmental_proof_candidates` is the immutable cross-domain
source bundle. It binds the current project root, governed methodology
publication bundle, current proof-policy root, sorted evidence registration and
final-decision roots, current final-verification projection roots, accepted
monitoring roots, contributor/source-actor sets, bounded public location,
confidence derivation, source-event graph, derivation actor snapshot, and
canonical authority/candidate roots.

`governance.environmental_proof_candidate_approvals` is an append-only stream
under the candidate ID. Each approval binds the exact candidate and policy,
mandatory conflict disclosure, prior approval, source events, human membership
and accreditation snapshot, and canonical approval root. One human can approve
a candidate only once. Source actors and the candidate deriver cannot approve.

`certificates.environmental_proof_record_facts` is the canonical issuance
authority. It preserves the candidate source fields, the complete sorted
approval set and quorum root, an independent owner/admin issuer snapshot, claim
boundary, record root, and semantic event. It is immutable and its projection
becomes `stale` whenever project, methodology/policy, or evidence final
authority changes.

The preliminary `certificates.environmental_proof_records` row persists the
record type, registered project ID, primary location, evidence IDs, evidence
root, verification history, monitoring timeline, contributors, governance
approval IDs, accepted monitoring event IDs, confidence score, status, record
hash, claim boundary, and issue time. Status is limited to `issued`,
`challenged`, or `revoked`. Monitoring event IDs connect the certificate record
back to `projects.monitoring_events`. It is retained only for compatibility with
existing public-record/certificate foreign keys and is not read by the durable
authority adapter. Existing rows are never silently promoted into
`environmental_proof_record_facts`.

The API exposes a deterministic CanopyProof Certificate Artifact read model for
each issued Environmental Proof Record. The artifact binds project ID, primary
and evidence locations, evidence IDs, evidence root, verification history,
monitoring timeline, accepted monitoring event IDs, monitoring event root,
monitoring event summaries, contributors, governance approval IDs, governance
approval summaries, public challenge summaries, source record hash, claim
boundary, and certificate hash. Governance approval summaries include policy
ID, reviewer, reviewer role, decision, rationale, conflict disclosure, approval
hash, and audit event root so an institutional verifier can audit authority
without a second lookup. It is a verification artifact only: it does not create a
certified carbon credit, tax-offset, financial asset, automatic CANOPY
distribution, or guaranteed-yield claim.

Certificate transparency entries live in
`certificates.certificate_transparency_entries`. They publish replayable,
hash-only certificate metadata: certificate ID/version/hash, record ID, project
ID, source record hash, evidence root, monitoring-event root, governance
approval root, challenge root, claim-boundary root, status, publication actor,
entry hash, safety boundary, and audit root. Entry hashes are recomputable from
the certificate artifact without private state, while publication metadata is
preserved through the audit event.

Certificate verification attempts live in
`certificates.certificate_verifications`. Each row stores verifier identity,
certificate hash, recomputed certificate hash, optional expected entry hash,
recomputed entry hash, validity flag, issue codes, verification root, safety
boundary, timestamp, and audit root. Failed verification attempts are retained
as tamper evidence rather than overwritten.

The public registry projection lives in `certificates.public_records` and is
served by `/canopyproof/public-records`. It stores and exposes a redacted public
record hash, source record hash, coarse public location, evidence root/count,
monitoring event root/count, governance approval root/count, challenge root,
claim boundary, and issue/publish timestamps. It intentionally omits precise
evidence locations, contributor identifiers, internal verification history,
governance rationale, and raw evidence IDs. Challenged and revoked records stay
visible with their public challenge state, so institutional users can see
disputed lineage instead of relying on silent deletion.

Challenge records include challenger identity, reason, severity, status,
description, challenge evidence IDs/hashes, evidence root, V1 abuse-control
policy, public outcome, resolver identity, resolution rationale, and immutable
challenge hash. Opening a challenge changes the public proof record status to
`challenged`; accepting a challenge revokes the record; rejecting it restores
`issued` only when no other open or accepted challenge remains.

## satellite

Purpose: Earth observation ingestion and derived environmental layers.

Target tables:

- `satellite.providers`
- `satellite.scenes`
- `satellite.scene_assets`
- `satellite.indices`
- `satellite.layer_tiles`
- `satellite.connector_runs`

Required metadata:

- provider.
- dataset.
- acquisition timestamp.
- processing version.
- cloud cover.
- spatial resolution.
- license.
- source URI.
- content hash.

## impact

Purpose: public impact accounting without overclaiming.

Target tables:

- `impact.metrics`
- `impact.metric_observations`
- `impact.biodiversity_indicators`
- `impact.water_indicators`
- `impact.soil_indicators`
- `impact.carbon_estimates`
- `impact.global_command_center_snapshots`
- `impact.global_command_center_publication_facts`
- `impact.risk_signals`
- `impact.risk_alerts`
- `impact.risk_responses`
- `impact.risk_alert_dispatch_receipts`
- `impact.risk_response_playbooks`
- `impact.risk_response_activations`
- `impact.risk_response_closures`
- `impact.risk_after_action_reviews`
- `impact.early_warning_review_facts`
- `impact.early_warning_publication_facts`
- `impact.early_warning_control_facts`

Carbon estimates must remain estimates unless a future approved registry and
retirement workflow exists outside this V1 proof record.

Risk alerts are operational warnings, not official emergency declarations.
Public release requires human review and governance policy approval. The current
compatibility slice lives under `/canopyproof/risk/*` and monitors drought,
wildfire, flooding, and ecosystem degradation.

The separate canonical early-warning authority is route-closed. A candidate is
embedded in immutable scientific and operational review facts. An accepted
review pair may be consumed once by an immutable publication fact, which binds
the exact current source/scope authority, two independent reviewer snapshots, a
third independent publisher snapshot, predecessor, semantic event, minimized
public projection, validity interval, and deterministic roots. A challenge or
withdrawal is an append-only control fact over the current publication. The
resolver projects `active`, `challenged`, `withdrawn`, or `expired`; adverse
states never reveal an older advisory as current.

All three relations use forced tenant RLS, update/delete rejection, row mutation
audit, semantic-event foreign keys, exact command receipts, no-fork/event-order
indexes, and SQL root recomputation. Candidate indicators are integer-scaled;
PostgreSQL compares cross-scales with exact numeric multiplication. Sources,
indicators, and audiences are sorted and unique before hashing. The migration
is idempotent. Its rollback removes only an empty authority and refuses to
erase existing facts.

`impact.risk_alert_dispatch_receipts` records immutable delivery attempts for
community, NGO, government, operator, and verifier audiences. Each receipt stores
only participant/organization identifiers, channel, delivery status, message
hash, delivery root, dispatch hash, and safety flags; it must not store raw email
addresses, phone numbers, payment data, or private contact payloads.

`impact.risk_response_playbooks` stores governed operational templates for
early-warning response. `impact.risk_response_activations` records the exact
alert, playbook, dispatch receipts, assigned audiences, organizations, evidence
references, activation root, and safety boundary for each response activation.
Activations are operational coordination records; they are not emergency
declarations, carbon credits, financial assets, tax offsets, or yield promises.

`impact.risk_response_closures` records human-reviewed completion or challenge
decisions over an activation. Closure rows preserve reviewer role, evidence
root, dispatch receipts, optional governance approvals, unresolved actions,
closure root, closure hash, and safety flags. They are append-only and cannot be
written by AI/agent actors as final authority.

`impact.risk_after_action_reviews` records institutional post-closure review.
Rows bind a response closure, evidence root, lessons learned, corrective
actions, policy recommendation IDs, optional governance approvals, review root,
review hash, and safety flags. Challenged closures require follow-up or
governance escalation; governance escalation requires a policy recommendation
reference. Rows are append-only and cannot become emergency, carbon-credit,
tax-offset, financial-asset, or guaranteed-yield claims.

The Global Impact Command Center read model lives at
`/canopyproof/dashboard/global`. Its source contract is the append-only
`impact.global_command_center_snapshots` table: each row stores bounded metric,
regional, indicator, recent-activity, lineage, and safety documents plus a
unique `dashboard_root` and participant-bound `created_by`. Database checks bind
the lineage root to the column root and require every fixed safety flag; audit
and immutable-table triggers reject update and delete.

Every new snapshot must now be committed atomically with exactly one immutable
`impact.global_command_center_publication_facts` row. The publication fact
binds the projection schema, complete snapshot-content root, current source
authority root, policy and independent-human approval roots, publisher
authority snapshot, global semantic-event predecessor, publication root, and
fixed safety boundary. A deferred constraint rejects a snapshot that reaches
transaction commit without its matching governed fact. Both relations reject
update/delete and emit hash-only database mutation audit records.

The route-closed writer uses a serializable transaction, command and global
stream advisory locks, exact command receipts, and a transaction-owned resolver
that re-resolves the complete current snapshot plus publisher and governor
authority. The human governor must be distinct from the publisher. A changed
source or credential snapshot fails closed.

Regional geometry now has its own route-closed authority rather than accepting
hash-shaped review placeholders. The additive
`global-command-center-spatial-disclosure-authority.sql` migration creates:

- `impact.global_command_center_spatial_review_facts`, with one immutable
  privacy or safeguarding decision per candidate and review kind;
- `impact.global_command_center_spatial_disclosure_facts`, which requires two
  stored approved decisions by different accredited humans and a third,
  independent accredited human publisher; and
- `impact.global_command_center_spatial_control_facts`, which appends a
  fail-closed withdrawal by an independent accredited human governor.

All three tables are tenant-bound with forced RLS, append-only triggers,
database mutation audit, semantic-event binding, and SQL/TypeScript root
parity. The candidate stores only an integer-degree centroid, exact current
region source root/project count, fixed cohort minimum, governed policy root,
and validity interval. Raw coordinates, geometries, scene bounds, accuracy,
project/evidence/device/contributor identifiers, and personal or secret fields
are rejected. Expiry is projected from immutable time bounds; withdrawal never
mutates a prior fact and the current resolver never falls back to older
geometry.

The spatial repository uses separate review, publication, and withdrawal
commands with serializable locks and exact receipts. Every new command
re-resolves current source and actor authority through a transaction-owned
resolver. No route, scheduler, source composition root, production identity,
or activation flag is mounted.

The production repository reads one latest row in a repeatable-read transaction,
strictly validates every document, and replays each `regionRoot`, the aggregate
`regionRoot`, and `dashboardRoot`. Missing or inconsistent rows fail closed and
cannot fall back to the process-local compatibility aggregate. The separately
governed writer route and scheduler remain unmounted, so a production
installation with no approved snapshot correctly reports unavailable.
Snapshots are operational views, not
certificate authorities: final proof still requires accepted evidence,
advisory AI, accredited human review, governance approval, and accepted
monitoring-event lineage.

## funding

Purpose: open-government style transparency for grants and allocations.

Target tables:

- `funding.sources`
- `funding.allocations`
- `funding.milestones`
- `funding.evidence_links`
- `funding.reconciliation_reports`

The mounted `/canopyproof/funding/*` service remains a transparency-only,
process-local compatibility boundary. It can reference existing Dropin fund
allocation IDs, but it is not canonical authority.

The route-closed canonical authority adds:

- `funding.accountability_review_facts`: one independently reviewed complete
  candidate, reviewer snapshot, review root, and semantic event;
- `funding.accountability_publication_facts`: one approved review, third-party
  publisher snapshot, minimized public projection, publication root, and event;
- `funding.accountability_control_facts`: one independent challenge or
  withdrawal over the exact publication and projection roots.

Candidates bind current project, funding-source, policy, evidence, and proof
authority roots; safe integer-cent commitment/allocation totals; sorted
milestones; reporting and validity windows; and the accredited human preparer.
A reconciled milestone requires evidence and current Environmental Proof Record
members. Three different accredited humans prepare, review, and publish.

All three canonical tables force tenant RLS, reject update/delete, and bind
selected columns to strict JSON facts, SQL-recomputed roots, semantic events,
row audit, and exact command receipts. Current state is replayed as `active`,
`challenged`, `withdrawn`, or `expired`; the latest adverse state never falls
back to an older publication. No model creates a payment rail, moves mainnet
funds, distributes CANOPY, mints a carbon credit, creates a tax offset, or
promises yield.

## governance

Purpose: decisions, policies, approvals, and conflict disclosures.

Target tables:

- `governance.policies`
- `governance.proposals`
- `governance.votes`
- `governance.approvals`
- `governance.release_council_reviews`
- `governance.conflict_disclosures`
- `governance.methodologies`
- `verification.quality_scorecards`

Current CanopyProof OS slice implements policy-bound approval and conflict
disclosure records under `/canopyproof/governance/*`, and the SQL contract also
defines durable proposal, vote, and release-council review records for the next
repository-backed governance adapter.

Implemented compatibility tables in `services/api/prisma/canopyproof-os.sql`:

- `governance.policies`: policy ID, title, subject types, required approval
  count, allowed reviewer roles, human-authority flag, conflict-disclosure flag,
  claim-boundary flag, and policy hash.
- `governance.approvals`: subject type, deterministic subject ID, policy ID,
  approver identity and role, decision, rationale, conflict disclosure,
  approval hash, and decision timestamp.
- `governance.methodologies`: append-only methodology version records with
  slug, semantic version, scope, publication status, required data sources,
  quality gates, GPS accuracy threshold, monitoring cadence, evidence retention
  window, governance approvals, superseded methodology pointer, limitations,
  claim boundary, quality-gate root, methodology hash, creator, publication
  timestamp, and audit root.
- `verification.quality_scorecards`: append-only institutional data-quality
  records for evidence, proof records, projects, reporting packages, and Terra
  scenes. Rows store evidence IDs, source roots, quality signals, dimensional
  scores, findings, finding root, `pass` / `needs_review` / `blocked`
  decision, scorecard hash, safety boundary, creator, timestamp, and audit
  root without embedding raw media or personal data.
- `verification.decision_dossiers`: append-only human-in-the-loop verification
  decisions with subject binding, reviewer identity and role, evidence, AI,
  Terra, quality, human-review, governance, and audit-root references, quality
  gate state, source root, rationale, limitations, decision hash, safety
  boundary, decision timestamp, and audit root.
- `verification.challenge_cases`: append-only institutional challenge cases
  for evidence, proof records, projects, quality scorecards, verification
  decisions, methodologies, Terra scenes, reporting packages, and funding
  allocations. Rows store subject binding, reason, severity, status, title,
  description, opener, assignment role, evidence root, related audit roots,
  challenge hash, optional resolution, safety boundary, and audit root.
- `verification.challenge_evidence`: append-only content-addressed evidence
  references for challenge cases. Rows store evidence type, hash, optional
  source ID, description, submitter, timestamp, and uniqueness per
  challenge/hash/type without embedding raw media or unrestricted personal data.
- `governance.conflict_disclosures`: subject type, deterministic subject ID,
  actor, severity, status, disclosure text, disclosure hash, and timestamp.
- `governance.proposals`: proposal type, subject binding, optional policy,
  title, summary, status, creator, proposal hash, audit root, and open/close
  timestamps.
- `governance.votes`: immutable proposal vote, voter identity and role,
  approve/reject/abstain/challenge decision, rationale, conflict disclosure,
  vote weight, vote hash, audit root, and uniqueness per proposal/voter.
- `governance.release_council_reviews`: deployment target, 40-character target
  commit, workflow context, release-council reviewer, approve/reject/challenge
  decision, rationale, conflict disclosure, review hash, audit root, and
  uniqueness per target/commit/reviewer.

Canonical Environmental Proof approvals bind to an immutable candidate ID and
candidate root derived from exact project, methodology publication, proof
policy, current final-evidence, and accepted monitoring authority. Preliminary
compatibility approvals based only on `projectId` plus evidence IDs cannot
authorize a canonical record fact.
Methodology versions are governance objects, not report prose. Published
methodologies require governance approvals and the human-review,
governance-approval, and public-challenge quality gates; revisions must create
new rows rather than mutating published methodology history.
Quality scorecards are verification objects, not approval records. They make
missing GPS hashes, weak spatial accuracy, duplicate evidence risk, satellite
contradiction, unresolved challenges, missing audit lineage, and redaction gaps
machine-visible before a verifier or governance body relies on an evidence or
proof bundle.
Challenge cases are the broader institutional dispute lane beside public proof
record challenges. They let community, verifier, researcher, and governance
actors challenge non-record subjects such as scorecards, verification dossiers,
methodology versions, Terra scenes, reporting packages, or funding allocations
without mutating the disputed record or embedding raw evidence payloads.

Rules:

- API proof issuance validates referenced approval IDs before issuing a record.
- approval reviewer identity and role come from authenticated request headers,
  never from client-supplied body fields.
- unresolved conflict disclosures block approval validation until cleared or
  waived.
- AI agents cannot create final authority; approvals remain human/role-bound.
- approval text cannot introduce certified carbon-credit, tax-offset,
  guaranteed-yield, automatic-CANOPY, or mainnet-funds claims.
- proposals, votes, and release-council reviews are append-only. Corrections
  require a new record, not in-place mutation.

## reporting

Purpose: institutional report packages and investor due-diligence artifacts.

Target tables:

- `reporting.framework_packages`
- `reporting.investor_review_packages`

Current CanopyProof OS slice implements an in-memory institutional reporting
boundary under `/canopyproof/reports/*` and a PostgreSQL contract in
`services/api/prisma/canopyproof-os.sql`.

The separate route-closed canonical authority uses these additive PostgreSQL
relations:

- `reporting.esg_metric_definition_facts`: immutable organization-owned metric
  definitions, units, precision, aggregation, uncertainty policy, methodology
  publication, independent review quorum, supersession, and definition root.
- `reporting.esg_metric_result_facts`: independently reviewed exact-decimal or
  explicit missing-state results, definition/version binding, periods,
  uncertainty, calculation artifact, source-set commitments, and result root.
- `reporting.esg_metric_result_source_facts`: ordered current Environmental
  Proof/MRV/lifecycle/signature source commitments for each metric result.
- `reporting.canonical_esg_report_facts`: organization/project report facts
  binding reporting period, frameworks, material topics, publisher, aggregate
  source and metric roots, disclosures, artifact hash, and report root.
- `reporting.canonical_esg_report_member_facts`: ordered Environmental Proof,
  MRV, lifecycle, signature, evidence, verification, monitoring, and confidence
  commitments.
- `reporting.canonical_esg_report_metric_member_facts`: ordered metric result,
  current projection, definition/version, exact value state, unit, uncertainty,
  and review-time commitments.

All six fact relations are append-only and forced-RLS organization scoped.
Commands append semantic `audit.domain_events`, database mutation audit rows,
and exact `audit.command_receipts` in the same serializable transaction.
Definition/result/report SQL triggers re-resolve current upstream authority and
recompute canonical hashes rather than accepting caller-declared current state.
Rollback scripts remove only empty route-closed authorities and fail closed
after any fact exists.

Implemented compatibility tables:

- `reporting.framework_packages`: framework, verified organization, reporting
  period, proof record IDs, ESG report IDs, metric JSON, framework sections,
  methodology, confidence, verification references, audit references,
  limitations, claim boundary, package root, generator, and generation time.
- `reporting.investor_review_packages`: verified organization, reporting
  period, project portfolio, evidence coverage, verification statistics, risk
  profile, audit history, ESG report IDs, proof record IDs, claim boundary,
  package root, generator, and generation time.

Rules:

- framework packages support UN SDG, UNFCCC, GRI, ISSB, and TCFD adapters.
- packages require a verified organization and issued Environmental Proof
  Records.
- every metric must carry source proof record, methodology, confidence,
  verification reference, audit reference, and limitations.
- canonical report facts require at least one current governed metric result;
  metric IDs, ordered member roots, metric Merkle root, and each disclosure's
  metric binding must agree.
- metric values use canonical decimal strings and explicit `reported`,
  `not_applicable`, `below_detection_limit`, `withheld`, or `unavailable`
  semantics; absence is never converted to numeric zero.
- metric calculation and review must be performed by distinct eligible humans;
  AI and Agent identities cannot publish definitions, review results, publish
  canonical reports, or grant final authority.
- investor review packages require at least one ESG report reference.
- report packages are append-only; corrections are new packages, not updates.
- package text cannot introduce certified carbon-credit, tax-offset,
  guaranteed-yield, automatic-CANOPY, or mainnet-funds claims.

The canonical metric/report relations have no mounted HTTP route and are not a
production publication system, assurance opinion, certified environmental
instrument, tax treatment, financial asset, or funding/token authority.

## audit

Purpose: immutable mutation and agent-event lineage.

Target tables:

- `audit.event_log`
- `audit.event_log_checkpoints`
- `audit.agent_events`
- `audit.memory_records`
- `audit.abuse_signals`
- `audit.resilience_drills`
- `audit.audit_verifications`
- `audit.attestations`
- `audit.export_manifests`

`audit.agent_events` stores AHIN events emitted by Evidence, Verification, ESG,
Funding, Risk, and Community agents. Each row includes the accountable actor,
agent ID, action, subject, payload hash, source root, confidence score,
human-review flag, and event root.

`audit.event_log` stores the hash-only PostgreSQL persistence trail. A stream
is scoped to `schema.table:row_pk_hash`. Every v2 row binds a strictly
increasing sequence, mutation action, accountable actor, monotonic microsecond
timestamp, previous event hash, before/after state hashes, and event hash. The
trigger takes a transaction-scoped advisory lock per stream and locks the
terminal event before assigning a successor, preventing concurrent forks
without serializing unrelated records. Full before/after row documents are not
duplicated into the audit schema.

`audit.event_log_checkpoints` stores append-only, full-stream checkpoints. Each
checkpoint covers sequence one through a terminal sequence and binds event
count, first/terminal event hashes, aggregate event root, creator, timestamp,
and checkpoint hash. Checkpoints remain independently replayable and do not
replace the underlying events or confer proof authority.

`audit.memory_records` stores Dropin OS memory read models for CanopyProof
institutional recall. Each row binds subject type, subject ID, project,
organization, scope, retention class, summary, tags, source IDs, related record
IDs, payload hash, source root, creator, memory hash, and event root. Memory
records are append-only; recall queries return deterministic read models and
cannot mutate evidence, issue proof, move funds, or create climate/finance
claims.

`audit.abuse_signals` stores security-policy challenge records for anonymous
mutations, rate-limit overflow, and unsafe public-claim attempts. Actor identity
may be `anonymous`, but route, method, reason, severity, event root, and
creation time are immutable and must be chained through the audit log.

`audit.resilience_drills` stores database, API-origin, object-storage, and edge
failure drills. Each row records dependency, scenario, route, actor,
idempotency key, simulation facts, safety assertions, decision,
recommended actions, drill hash, and event root. Rows are append-only; failed
drills must be resolved operationally, not edited away.

`audit.audit_verifications` stores institutional audit-chain verification
attempts. Each row binds the verifying actor, scope, subject, submitted event
roots, event count, first root, terminal root, deterministic chain root,
verifier version, issue codes, optional payload bundle hash, verification
timestamp, and `audit_verification` event root. Rows are append-only; a failed
verification is preserved as tamper evidence rather than edited into success.

`audit.attestations` stores independent institutional audit attestations over
evidence, proof-record, organization, funding, governance, reporting, or system
scopes. Each row binds auditor organization, auditor name, methodology,
standards, source event roots, source event Merkle root, `/audit/verify` chain
root, findings, decision, independence statement, limitations, public summary,
claim boundary, attestation hash, issued timestamp, and `audit_attestation`
event root. Rows are append-only; `qualified` and `reject` decisions are
preserved as reviewable records instead of being edited into clean
attestations.

`audit.export_manifests` stores hash-only institutional data-room manifests for
auditors, regulators, ESG reviewers, and public transparency packets. Each row
binds manifest kind, scope, subject, requester organization, actor, purpose,
classification, redacted entry JSON, entry Merkle root, redaction root, source
event root, export hash, safety assertions, expiration, creation timestamp, and
`audit_export_manifest` event root. It indexes evidence/proof/reporting records
by resource IDs and hashes only; raw media, private keys, payment credentials,
and unrestricted personal data are outside the manifest boundary. Durable rows
are organization-scoped, append-only, command-receipt bound, and linked to an
exact `audit_export_manifest` event in the requester organization's semantic
stream. Readers recompute normalized entry, redaction, source-event, and export
roots before returning a row.

Governance decisions must be reproducible from policy version, voters/reviewers,
quorum, rationale, timestamp, and final decision.

## Durable Evidence Verification Authority

The evidence registration row is immutable. Verification is an ordered stream
of successor facts, never status columns rewritten on the registration:

- `verification.evidence_validation_runs`: evidence/project/organization root,
  ruleset ID/version/hash, deterministic checks/issues/outcome/confidence,
  executor authority snapshot, command hash, evidence sequence, predecessor
  root, validation hash/root, safety boundary, and semantic event root.
- `verification.evidence_ai_analyses`: exact validation root, verified Agent
  authority snapshot, model provider/name/version, model artifact and prompt
  hashes, dataset/source roots, execution environment, canonical findings,
  derived capabilities/recommendation/effective confidence, advisory-only flag,
  command/analysis hashes and roots, sequence, predecessor, safety, and event.
- `verification.evidence_human_reviews`: exact latest validation and complete AI
  ID/root set, verified human membership/accreditation snapshot, decision,
  finding dispositions with prior evidence-event roots, rationale, limitations,
  source/command/review hashes and roots, sequence, predecessor, safety, and
  semantic event.
- `verification.evidence_challenges`: exact pre-challenge reliance/event roots
  and state, validation/AI/review context, reason/severity/rationale, prior
  event roots, hash-only supporting artifacts, verified human challenger and
  challenger-organization authority snapshot, command/challenge hashes and
  roots, evidence sequence/predecessor, safety, and semantic event.
- `verification.evidence_challenge_resolutions`: exact challenge root and latest
  optional predecessor resolution, `upheld|dismissed|needs_more_evidence`,
  evidence roots, rationale/limitations, independent owning-organization human
  reviewer and accreditation snapshot, source/command/resolution hashes and
  roots, sequence/predecessor, safety, and semantic event.
- `verification.evidence_corrections`: exact latest upheld resolution and
  challenge roots, `withdraw|supersede`, optional separately approved
  replacement evidence/reliance/event roots, evidence roots, independent
  publisher authority, source/command/correction hashes and roots, sequence/
  predecessor, safety, and semantic event.
- `verification.evidence_final_decisions`: exact pre-decision challenge-aware
  reliance state/root/event, latest validation, complete current AI set,
  authoritative human review, optional prior final decision, independent
  accredited verifier snapshot, decision/rationale/limitations/source roots,
  command/decision hashes and roots, sequence/predecessor, safety, and semantic
  event.

All seven tables are insert-only, independently revalidated by PostgreSQL, and
covered by the hash-only database mutation audit. The current reliance read
model is replayed as `registered`, `validation_passed`, `needs_review`,
`blocked`, `ai_advised`, `approved`, `rejected`, `challenged`, or
`changes_requested`, with challenge governance additionally deriving
`correction_required`, `withdrawn`, or `superseded`. A later validation or AI
analysis makes an earlier review historical; an open challenge suspends
reliance; dismissal restores only the currently replayable baseline; upheld
findings require an explicit remedy. The separate final-verification projection
is `not_decided`, `verified`, `rejected`, `changes_requested`, or `stale`; only
a terminal final-decision event is current, so any later fact stales it. No row
is changed or deleted. Reliance or internal final-verification state is not an
Environmental Proof Record, certificate, carbon credit, tax offset, asset, or
yield claim.

## audit

Purpose: immutable mutation log.

Target tables:

- `audit.events`
- `audit.abuse_signals`
- `audit.event_hash_chain`
- `audit.merkle_batches`
- `audit.export_manifests`

Every mutation must write:

- actor subject.
- organization scope.
- action.
- entity type and ID.
- request ID.
- before and after state hashes.
- policy decision.
- source IP or edge request context where available.
- timestamp.
- previous audit hash.

Deletion policy: production systems must never delete audit rows. Corrections are
new events.

## Implemented SQL Contract

The first executable PostgreSQL contract is
`services/api/prisma/canopyproof-os.sql`.

It defines the required production schemas:

- `identity`
- `organizations`
- `projects`
- `evidence`
- `verification`
- `certificates`
- `satellite`
- `impact`
- `funding`
- `governance`
- `reporting`
- `audit`

It also defines an append-only, hash-only `audit.event_log`, serializes each
row-scoped stream with an advisory transaction lock, blocks update/delete
mutation on the audit log itself, and attaches row mutation triggers to the
initial CanopyProof OS tables so inserts, updates, and deletes produce audit
events. The v2 event hash binds stream, sequence, operation, actor, microsecond
timestamp, previous event hash, and before/after state hashes. Append-only
`audit.event_log_checkpoints` summarize complete contiguous streams and can be
recomputed with the independent database-stream verifier.
Runtime audit events use deterministic `payloadHash`, `previousRoot`, and
`eventRoot` fields. The `/canopyproof/audit/verify` read model recomputes those
roots, checks chain linkage from the CanopyProof genesis audit root, rejects
duplicate IDs, and verifies payload hashes when payload bundles are provided.
Verification attempts are represented as `audit_verification` events so clean
and tampered-chain reviews remain visible to institutional auditors. The
PostgreSQL contract persists those attempts in `audit.audit_verifications` with
update/delete triggers and a row-mutation audit trigger.
Independent institutional audit conclusions are represented separately in
`audit.attestations` so third-party auditors can bind methodology, standards,
findings, limitations, source event roots, and the verified chain root without
mutating the underlying evidence, certificate, funding, governance, or report
state.
Hash-only institutional export packages are represented in
`audit.export_manifests`; they make auditor data-room contents reproducible
without embedding the raw evidence payloads in the API or audit table.
Governed methodology versions live in `governance.methodologies`; their row
mutation triggers make proof/report interpretation rules reproducible from
versioned records rather than mutable document text.

## Public Transparency Authority

The dedicated `transparency` schema adds two immutable fact tables:

- `public_disclosure_review_facts` binds one independently accredited human
  privacy review to the exact canonical record, challenge-aware projection,
  lifecycle binding/projection, signature receipt, disclosure classification,
  minimization modes, normalized reason codes, and source roots.
- `public_transparency_publication_facts` binds one reviewed disclosure to a
  separate accredited human publisher and stores only deterministic public
  counts, bands, pseudonymous IDs, day boundaries, methodology and authority
  commitments in its private authority fact.

Both tables have forced organization RLS, update/delete rejection, row-mutation
audit triggers, deterministic SQL root functions, and semantic event/root
checks. Repository writes use `SERIALIZABLE` transactions, command and stream
advisory locks, exact `audit.command_receipts`, and a transaction-scoped source
resolver. Current public state is a derived projection; challenge, suspension,
revocation, expiry, supersession, or stale roots never rewrite publication
history. No anonymous database policy or public HTTP read model exists.
