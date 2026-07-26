# CanopyProof Trust Layer Security Review

Status: Phase 1/3 security baseline

The CanopyProof trust layer secures identity, evidence, verification, audit, and
governance. It assumes public-interest environmental infrastructure will be
attacked through fake evidence, fake institutions, privilege escalation,
misleading impact claims, and audit tampering.

## Security Boundaries

- Every institutional mutation requires a request principal derived from an
  origin-verified Cloudflare Access JWT in production. Raw
  `x-dropin-actor-*` headers are accepted only in explicit local/test mode.
- Missing or invalid authentication fails with `CANOPYPROOF_AUTH_REQUIRED` or
  `CANOPYPROOF_AUTH_INVALID`. A valid assertion that does not bind to a current
  verified participant, exact durable role, active membership, or active
  organization fails with `CANOPYPROOF_AUTHORIZATION_DENIED`; a registry outage
  or integrity mismatch fails with `CANOPYPROOF_AUTHORIZATION_UNAVAILABLE`.
- Production authorization re-evaluates `identity.participants`, the exact
  organization membership, organization status, and latest accreditation on
  every authenticated request. A signed role cannot outlive durable suspension
  or revocation.
- Invalid assertions produce de-identified security challenge events without
  retaining the assertion, source IP, or key-set response.
- AI agents may analyze, recommend, and flag risk, but cannot approve final
  proof, organization verification, ESG publication, funding release, or public
  risk claims.
- Public claim boundaries block certified carbon-credit, carbon-tax offset,
  guaranteed-yield, automatic CANOPY distribution, and live-mainnet-funds
  language.
- Audit events are append-only lineage records, not optional logs.

## Required Controls

### RBAC

Role checks must cover:

- organization registration.
- organization verification transition.
- membership grants and revocation.
- accreditation decisions.
- evidence submission and review.
- AI analysis.
- proof issuance.
- ESG report generation.
- funding allocations.
- risk public release.

Unauthorized verifier, community, observer, or agent escalation must be rejected
before domain state changes.

Production request bindings have four explicit assurance levels:

- `participant`: verified participant and exact durable role.
- `organization_member`: active exact-role membership in a non-suspended
  organization.
- `verified_organization`: organization membership plus verified organization.
- `accredited_organization`: verified organization plus a current approved
  accreditation whose latest append-only decision matches the organization
  summary.

Proof issuance, governance approval, verification decisions, organization
verification/accreditation, audit attestations, and challenge resolution require
the accredited level. Restricted export and institutional reporting operations
require at least a verified organization. Development isolation may synthesize
test bindings but is rejected as production authority.

Production identity and institutional-authority commands use the transactional
trust registry. They require a bounded `Idempotency-Key`, store only its hash,
and commit the source row, append-only semantic event, command receipt, and
hash-only database audit events in one serializable PostgreSQL transaction.
Identity participant/reputation, organization registration/verification,
membership grant/status, and accreditation commands cannot fall back to process
memory. Partner workflows without a completed durable adapter return
`CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE` in enforced mode.

Project lifecycle commands use the same boundary. PostgreSQL independently
requires a verified human, verified owning organization, exact active role,
matching transaction actor, bounded idempotency receipt, project-stream lock,
canonical fields/hash/root, and exact semantic event. Registration, status
transition, and monitoring rows are update/delete protected. Current project
state is replayed rather than read from a mutable status column.

Activation requires a project-applicable approved policy decision from a human
independent of both creator and transition actor. Monitoring references must
exist first, belong to the same project, and not be future-dated. These controls
establish accountable lineage; they do not certify evidence or environmental
impact.

The canonical institutional project lifecycle is a separate route-closed
authority over the compatibility registry. It binds one current project root,
baseline, intervention, monitoring plan and policy before an external
canonically accredited human review. Stage transitions and adverse controls
require a second independent human governance actor. Every repository write
re-resolves project, policy, actor and stage-specific source authority in the
same serializable transaction; PostgreSQL then independently recomputes roots,
checks current memberships, legal sequence/source/time, semantic events and
forced tenant RLS. Exact retries replay the committed result; changed retries,
membership drift, source drift, forked successors, updates and deletes fail
closed without orphan facts, events or receipts. Funding, Environmental Proof,
and post-verification monitoring composition are implemented and exercised in
PGlite; closure and restoration reject because their independent authorities do
not exist. Native PostgreSQL non-bypass RLS, dual-writer serialization,
backup/restore and production activation remain mandatory and unproven.

Evidence registration uses the same transaction boundary but writes to an
independent evidence stream. The database takes a shared project-authority lock
and exclusive evidence/media locks, then independently checks the current
project root and authority time, exact verified-human organization role, single-use media hash,
timestamp/location bounds, deterministic validation issues, fixed-empty reviewer
set, claim boundary, evidence hash/root, and exact semantic event. Registration
rows and receipts are append-only. Changed retries, role or organization
substitution, archived projects, duplicate media, missing events, and direct
updates/deletes are rejected. A `validated` registration remains pending AI and
accountable human review and cannot authorize proof or financial/environmental
claims.

### Evidence Integrity

Evidence must include:

- content-addressed media hash.
- metadata hash or EXIF/GPS commitment.
- contributor identity.
- project ID.
- timestamp.
- location and GPS accuracy.
- device or consent lineage where applicable.

Tampering scenarios:

- changed media hash.
- duplicate media hash across reports.
- conflicting GPS or EXIF metadata.
- revoked consent before metadata extraction.
- risky device attestation.

Expected result: evidence remains challenged, under review, or non-final until
human review resolves the issue.

Legacy process-memory evidence routes are disabled unless
`CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED=true` is set in a non-production
runtime. The flag cannot open them when `NODE_ENV=production` or
`DROPIN_CANOPYPROOF_MODE=production`, and the durable-write guard remains an
independent control.

The default-off media adapters treat every upload grant as a bearer secret and
never persist it. Grant validation binds the allowlisted HTTPS host, decoded
object path, intent root, method, bounded TTL, content type, byte length, and
either the exact hexadecimal content SHA-256 or its S3 checksum Base64 form.
For R2/S3 it also rejects missing, duplicated, overlong, mismatched, or
improperly scoped SigV4 query parameters and unsigned content constraints; GCS
is explicitly unsupported rather than weakly accepted.
Stored-object receipts must independently bind provider namespace, object
version, ETag hash, upload time, encryption metadata, and a governed retention
root. Scanner results require a fresh object-bound receipt signed by an
allowlisted Ed25519 public key; the verifier rejects private JWK material.
Neither adapter is configured in production, and adapter outage cannot fall
back to caller-supplied `verified` state.

The route-closed E2a migration records successful infrastructure verification
as separate append-only facts. Provider facts bind the exact immutable object,
provider receipt, verifier, and governed retention policy. Scanner facts bind
the exact scan, scanner receipt, signer-key identifier, policy root, and a hash
of the verified signature; the raw signature is not persisted. Both require
forced organization RLS, an exact semantic event, a hashed idempotent command
receipt, database audit, and SQL-recomputed roots. Historical object and scan
rows remain `modeled_only`; no mutable promotion is permitted. The E2a
projection is explicitly not media availability, evidence approval, proof, or
financial/environmental claim authority.

The route-closed orchestration layer adds a runtime capability boundary around
those facts. A plain object that merely matches the provider or scanner receipt
shape cannot be committed: only the policy adapter can attach the private
runtime brand, and spreading/serializing the value removes that brand. The raw
scanner signature is verified outside PostgreSQL and replaced by its hash
before the durable port is called. External HEAD and scanning calls occur before
the serializable transaction; the transaction reloads immutable roots, applies
the organization context and explicit tenant predicates, and atomically writes
the base modeled fact plus the independent verification fact. Provider and
scanner verification events use their own
`evidence-media-adapter:<evidenceId>` stream. Scanner I/O is refused unless the
exact object already has durable provider verification, and the database
independently enforces that dependency and chronology. This is defense in
depth, not proof that a real provider or scanner is deployed.

The constructor-only provider runtime adds a fixed Cloudflare R2 account/bucket
boundary and a fixed external scanner endpoint without mounting either route.
R2 upload capabilities are SigV4 `PUT` grants that sign the content type,
length, checksum, time, and expiry; the signer is held in an ECMAScript private
field and caught provider errors are reduced to stable codes. Stored-object
verification uses the Workers R2 binding `head()` result and refuses missing
provider versions or SHA-256 checksums. Ordinary object metadata is never
treated as bucket-lock proof. An optional fixed management-API verifier accepts
only bounded, uncompressed, non-redirected Cloudflare responses, selects the
strictest applicable finite `Age` or `Date` rule, rejects indefinite or expired
retention, and binds a runtime-branded governance attestation to the exact
object version. Without that verifier, receipts deliberately remain
`retentionVerificationState = modeled_only` and cannot unlock availability.
The scanner transport rejects non-HTTPS/private/IP endpoints, endpoint query
or fragment substitution, redirects, compressed responses, wrong media types,
declared/actual length mismatch, streamed overflow, timeout, and response-body
error forwarding. It sends no media bytes, GPS/EXIF, upload grant, or provider
credential. Deterministic tests use only fake R2 bindings and injected `fetch`;
no real account, credential, bucket-lock observation, scanner, or network is
claimed.

The Environmental Proof lifecycle now also has a constructor-only AWS KMS
verification port. It accepts one configured full key ARN, organization,
governance key-version label, and protocol algorithm; aliases and caller-
selected endpoints are forbidden. `GetPublicKey` revalidates the exact public
SPKI hash, `SIGN_VERIFY` use, key spec, and algorithm before both attestation
and signature verification. `Verify` receives the canonical lifecycle digest
and provider-native detached signature. The port cannot call `Sign`, has no
private-key material, is not selected by the API composition root, and uses
private error branding plus bounded uncompressed provider responses. Tests use
fake credentials and deterministic AWS-shaped responses only. Least-privilege
IAM, CloudTrail, key ceremony, live compatibility, rotation/revocation,
institutional review, and route activation remain production blockers.

E3b metadata and retention facts use a separate additive PostgreSQL authority.
The database recursively rejects raw coordinates, EXIF/GPS payloads,
credentials, secrets, and provider URLs; binds each fact to the exact E1/E2
source projection and actor/accreditation; enforces organization RLS; and
recomputes TypeScript command/fact/root hashes. Modeled provider receipts can
produce only `needs_review` metadata and pending retention projections. A legal
hold cannot be superseded until a governed release authority exists, and stale
pre-hold decisions cannot execute. The E3b HTTP boundary remains closed.

The additive E3c boundary authenticates a minimized extractor receipt without
promoting or rewriting E3b. A fixed-endpoint transport may send only immutable
object locators and hash/categorical authority context. The policy adapter
revalidates object, media, consent, device, GPS, privacy, extractor image/schema,
policy, signer, receipt root, and observation time, then verifies one
allowlisted Ed25519 public key. Runtime branding is module-private and does not
survive spread or serialization. Durable facts store only the signature hash
and recursively reject raw signatures, EXIF/GPS payloads, coordinates, URLs,
credentials, private keys, and unexpected nested fields. E3c has its own
semantic stream, forced RLS, append-only triggers, SQL root recomputation, and a
non-empty rollback refusal. It can remove only the provider-pending issue from
an effective projection; it cannot make evidence true, override human review,
or satisfy other custody/quality issues. No live provider, parser, signer,
credential, route, or composition root is active.
E4 offline and community facts use another additive route-closed authority.
Offline bundles bind active consent, device projection, project, contributor,
registered evidence roots, contiguous device sequence, prior root, and ordered
item Merkle root. A deferred trigger rejects partial bundles at commit.
Community facts require a verified same-organization human, reject contributor
self-attestation and duplicate actor/evidence statements, store only note/media/
GPS hashes, and remain advisory. Both fact families enforce forced RLS,
Serializable exact-retry receipts, semantic-event parity, database audit, and
append-only mutation denial. No community statement can finalize evidence.

The `/mobile/report` client stores new drafts only in an IndexedDB vault. Draft
payloads are validated through a strict shared schema and encrypted with
AES-256-GCM using a non-exportable Web Crypto key, fresh 96-bit IV, and AAD that
binds schema/key versions, opaque record ID and revision. IndexedDB writes use
strict-durability transactions, bounded quota and compare-and-swap revisions;
the legacy plaintext migration verifies decrypted ciphertext before removing
the old value. Tamper, missing-key, storage and quota failures remain distinct
fail-closed states.

The authenticated mobile-sync adapter is mounted separately from the legacy
process-memory route, but its command path is default closed. It requires a
Prisma repository, configured PostgreSQL, Cloudflare Access JWT identity, a
PostgreSQL authorization binding, the mobile-sync feature flag, the independent
durable-admission flag, and the separate governance unlock. Development-header
identity and memory authorization are rejected before durable service
resolution. The client has only an injected transport contract: it performs no
production `fetch`, background sync, or UI-driven write. Requests exclude raw
notes; responses bind evidence, item, batch, and audit roots; exact retries and
actor-scoped recovery replay immutable facts. No acknowledgement is final
verification.

Command bodies are capped before JSON parsing. Authenticated bounded attempts
then consume actor and organization fixed-window counters under Serializable
PostgreSQL locks. Denials append forced-RLS, root-verified immutable facts, while
operational buckets remain mutable non-authority. The relations omit raw body,
coordinate, IP, media, token, credential, idempotency-key and private-key data.
Provider failure returns `503` and quota exhaustion returns `429`; neither path
invokes an evidence command. Edge WAF/DDoS enforcement remains a separate
activation prerequisite.

The bind command now resolves consent/device/project authority and registers
evidence in one serializable Trust Registry transaction. Subject and project
locks are paired with a monotonic, non-authoritative database fence so a waiter
cannot continue on a pre-lock PostgreSQL snapshot. A disposable PostgreSQL 17
dual-connection test proves revoke-first contention retries and rejects with no
evidence row or binding receipt. Evidence registration and E4 reconciliation
remain recoverable phases, so a client disappearance after a successful bind
can still leave an independently valid audited registration without a batch.
This control does not defend against same-origin XSS using the active key,
browser storage eviction, device loss, or an unapproved retention policy. Those
risks require CSP and supply-chain hardening, field-device testing, recovery
design, consent-aware retention and independent review before activation.

The route-closed Digital MRV authority adds a separate `mrv` schema. Its fixed
endpoint resolver re-reads source ID, root, semantic-event root, organization,
project, time, state, and accountable actors from allowlisted tables. A closed
relationship matrix prevents caller-defined graph semantics; agents may append
only their own advisory `ANALYZES` edge. Snapshot insertion requires an
independent accredited human, the complete then-current methodology edge set,
contiguous deferred members, and exact Merkle, coverage, predecessor, event,
and command roots. Recursive key denial excludes raw evidence, location,
contacts, credentials, URLs, and secrets. The graph remains lineage-only and no
HTTP route is mounted.
Verification decision dossiers must include an accountable human reviewer,
quality scorecard reference, advisory AI reference, human-review work item, and
audit roots before an approval can be recorded. A blocked quality gate cannot be
approved, and agent actors cannot write final decision dossiers.
Institutional challenge cases must use content-addressed evidence references
and reason-specific evidence requirements. GPS-spoofing or duplicate-planting
challenges require GPS hash evidence; satellite contradiction challenges
require satellite scene evidence; audit-gap challenges require audit-root
lineage. Community actors can open cases, but only accountable institutional
human roles can resolve them.
Certificate transparency verification must recompute certificate artifact
hashes, replayable entry hashes, and expected roots before an institution relies
on a certificate artifact. Mismatched record, evidence, monitoring, governance,
or challenge roots must emit a `certificate_verification` challenge event.

### Institution Integrity

Organization verification must include:

- legal name.
- jurisdiction.
- registration number for verified status.
- at least one hash-bound document for document review or verified status.
- authorized users.
- audit event on every transition.

Fake organizations, missing documents, or community-driven verification attempts
must fail closed.

### Audit Integrity

Audit events must include:

- actor.
- action.
- entity type.
- entity ID.
- previous root.
- payload hash.
- event root.
- timestamp.
- rationale.

Important state transitions without an audit event are invalid. Deletion of
audit history must be treated as a critical incident.

Database persistence events use a second, hash-only v2 chain. Each row-scoped
stream has a monotonic sequence allocated under a PostgreSQL advisory
transaction lock, and each event binds actor, operation, microsecond timestamp,
previous event hash, and before/after state hashes. Raw row snapshots are not
copied into the audit schema. Full-stream checkpoints are append-only and must
be independently replayed; a checkpoint cannot repair an invalid event chain.

## Tests

Current trust-layer tests cover:

- RBAC rejection for unauthorized evidence, verification, governance, partner,
  and proof actions.
- organization verification requiring registration documents.
- community actors rejected from institutional verification.
- evidence duplicate and GPS spoofing risks.
- proof issuance blocked by unresolved AI findings.
- institutional challenge cases rejecting missing evidence and unauthorized
  resolution.
- certificate transparency replay detecting tampered artifact roots and unsafe
  claim boundaries.
- evidence custody events preserving source-root and previous-root linkage
  while rejecting mismatched artifact ownership and raw private contact data.
- E3b restart replay, idempotency, tenant denial, SQL/TypeScript hash parity,
  rejected-write atomicity, append-only mutation rejection, fail-closed rollback,
  modeled-provider non-promotion, and stale-decision/legal-hold bypass rejection.
- E2a migration idempotency, exact provider and scanner receipt/root parity,
  semantic-event and command-receipt binding, forced-RLS policy metadata,
  atomic base-fact plus verification-fact commit, dedicated adapter-stream
  sequencing, exact-retry I/O suppression, explicit tenant reads, provider-
  before-scanner enforcement, runtime-brand forgery rejection, append-only
  mutation denial, secret/raw-signature column denial, and non-empty rollback
  refusal.
- E4 device sequence/prior-root enforcement, revoked-consent and evidence-source
  substitution rejection, exact/conflicting replay, cross-tenant denial,
  SQL/TypeScript root parity, deferred batch completeness, unregistered-actor
  rollback, self-attestation denial, hash-only community context, non-final
  projection, append-only mutation rejection, and fail-closed rollback.
- Digital MRV relationship/agent/reviewer boundaries, complete edge manifests,
  duplicate and cross-tenant denial, semantic payload substitution detection,
  SQL/TypeScript endpoint/edge/snapshot/member root parity, exact/conflicting
  retry, source-root substitution rollback, restart replay across historical
  snapshots and later edges, append-only mutation denial, forced-RLS metadata,
  migration idempotency, and non-empty rollback refusal.
- partner data-access requests requiring verified organizations, active
  data-sharing agreements, subset-scoped dataset/use requests, independent
  human approval, immutable pending request facts, append-only decision rows,
  exact semantic-event binding, active organization membership,
  cross-organization rejection, stale-transition rejection, and rejection of
  raw contact or secret material.
- partner data-sharing agreement revocations requiring owner/admin authority,
  evidence event roots, append-only SQL controls, and fail-closed blocking of
  future requests and delivery receipts without deleting historical access
  records.
- partner data-access delivery receipts binding approved requests to server-read
  audit export manifest hashes, enforcing privacy-tier limits, delivery/recipient
  separation, verified classification-appropriate membership, active request,
  agreement and manifest time windows, exact semantic-event binding, append-only
  SQL controls, deterministic historical replay after later revocation, and
  database-recomputed receipt/event hash lineage plus no-raw-data/no-financial-
  claim safety flags.
- audit export manifests requiring verified organization membership,
  organization-scoped reads, hash-only normalized entries, strict
  classification/redaction controls, exact semantic-event binding, immutable
  SQL rows, and deterministic root replay before any future delivery may refer
  to them.
- partner data-use attestations binding delivered manifests to output hashes,
  evidence event roots, recipient-authored positive/no-use statements,
  post-revocation misuse challenge states, verified human membership,
  database-recomputed canonical roots/events, append-only SQL controls, and
  non-final human-review accountability.
- partner data-use enforcement cases requiring challenged attestations,
  verified independent human reviewers separated from challenger, recipient,
  and deliverer, retained normalized evidence roots, historical review after
  revocation, database-recomputed upstream/case/event hashes, append-only SQL
  controls, idempotent concurrency, and explicit separation between governance
  response records and actual access mutation.
- partner data-access restrictions requiring separate owner/admin approval from
  enforcement cases, reviewer/attester/recipient/deliverer separation, exact
  predecessor-bound state transitions, retained evidence event roots,
  database-recomputed canonical hashes and semantic-event payloads, append-only
  SQL controls, concurrent idempotency, explicit restoration, and fail-closed
  blocking of future data delivery and positive-use assertions.
- partner data-access accountability packets generated from append-only ledgers
  with verified human institutional generators, exact event-bound historical
  snapshots, bounded sorted roots, database-recomputed counts/IDs/hashes/event
  payloads, conflicting idempotency rejection, append-only SQL controls, and
  explicit no-raw-data/no-final-proof/no-financial/no-carbon-claim boundaries.
- partner data-sharing agreement renewal and supersession records linking
  immutable predecessor/successor hashes, enforcing one-successor lineage,
  blocking privilege expansion, and fail-closing predecessor reuse.
- partner data-access accountability verification replaying packet hashes
  at both creation and verification event boundaries, requiring a verified
  independent human, deriving sorted issues and validity in PostgreSQL,
  distinguishing normal lineage staleness from packet corruption, binding the
  optional expected root and exact safety into the verification root/event, and
  preserving every stale result as append-only history.
- partner accountability disclosure publication requiring three-party role
  separation, active owner/admin human authority, packet replay at creation,
  verification, and publication boundaries, canonical database-derived
  hashes/roots/event payload, concurrent idempotency, append-only SQL controls,
  bounded unauthenticated hash-only discovery, and visible stale lineage.
- partner disclosure challenges requiring a verified human with active durable
  role authority, exact disclosure/event binding, bounded prior semantic-event
  roots, public-text secret/contact/claim screening, canonical database-derived
  roots/payload, append-only concurrency, and public challenged-state replay.
- independent human challenge resolutions requiring active target-organization
  authority, separation from challenger and publisher, one-root/one-successor/
  one-final lineage, bounded prior evidence roots, exact database-derived
  hashes/events, immutable SQL rows, concurrent idempotency, and restart-safe
  public governance replay.
- durable correction or withdrawal notices requiring an active verified human
  target-organization owner/admin independent from original publisher,
  challenger, and final reviewer; exact latest upheld remedy binding; prior
  evidence roots; event-bound replacement replay for corrections; canonical
  safety/ID/hash/root/payload; five distinct short SQL triggers; concurrent
  idempotency; append-only enforcement; tamper rejection; public
  `corrected`/`withdrawn` replay; and historical validity after later events.
- durable project registration, finite-state transitions, and monitoring facts;
  exact organization-role binding; independent activation approval; same-project
  source references; canonical TypeScript/PostgreSQL hash parity; exact and
  conflicting retry behavior; append-only rejection; tamper/fork detection;
  repeated SQL migration; and restart replay.
- durable evidence validation, advisory AI analysis, and independent human
  review in one evidence stream; deterministic caller-independent validation;
  exact latest-cycle binding; verified Agent-only AI authority; model, prompt,
  artifact, dataset, and source provenance; contributor/AI self-review
  rejection; active membership and approval accreditation; complete AI-set
  review; high/critical finding disposition; canonical TypeScript/PostgreSQL
  hash parity; exact/conflicting retry; missing-event, update/delete, tamper,
  sequence-gap, predecessor-fork, cross-organization, unsafe-claim, and secret-
  material rejection; restart replay; and database mutation audit coverage.
- durable evidence challenges, independent resolution chains, and corrective
  remedies in the same evidence stream; exact pre-challenge reliance binding;
  verified-human cross-organization standing without target access; AI,
  contributor, challenger, original-reviewer, referenced-agent, and prior-
  resolver conflict rejection; accredited terminal decisions; one-terminal and
  one-remedy enforcement; needs-more predecessor binding; independently
  approved same-project replacement replay; TypeScript/PostgreSQL reliance-root
  parity; deterministic lock ordering; exact/conflicting retry; append-only
  tamper rejection; and restart-safe challenged/correction-required/withdrawn/
  superseded projections.
- durable final evidence decisions requiring a second current accredited human
  verifier; exact challenge-aware reliance/validation/AI/review/predecessor
  binding; contributor, reviewer, AI, challenge, resolution, correction, and
  prior-verifier conflict rejection; verify-only-from-approved enforcement;
  current-decision uniqueness; later-fact staleness; successor verifier
  rotation; TypeScript/PostgreSQL hash and projection parity; organization-
  scoped reads; role-substitution/no-memory-fallback rejection; append-only
  update/delete protection; and restart-safe replay.
- early-warning alert dispatch receipts rejecting raw contact data and unsafe
  public risk claims.
- early-warning response playbook activations requiring delivered dispatch
  receipts and rejecting unbounded emergency or financial claims.
- early-warning response closures requiring evidence-bound human review and
  rejecting agent final authority.
- early-warning after-action reviews requiring institutional human reviewers,
  preserved closure evidence references, and corrective actions for follow-up
  or governance escalation.
- SQL append-only and audit trigger contracts.
- database audit replay rejecting mutation, gaps, duplicates, mixed streams,
  invalid genesis links, and forged checkpoints.
- database audit verifier rejecting anonymous and Agent callers.
- durable authorization binding rejecting missing or revoked participants,
  stale signed roles, organization substitution, inactive membership, suspended
  organizations, agent/human substitution, and inconsistent accreditation
  summaries.
- PostgreSQL authorization lookup returning a newly revoked membership on the
  next query while preserving its append-only audit history.
- transaction rollback removing a semantic event when the governed source-row
  mutation fails, plus append-only enforcement for reputation snapshots and
  hashed command receipts.
- semantic event actor/predecessor enforcement, per-stream sequence assignment,
  database-recomputed semantic roots/IDs, conflicting idempotency rejection,
  command/receipt/stream lock ordering, and independent semantic-chain replay
  on every hydrated authority stream.
- queue backpressure and dependency blocking.

Required next tests:

- fake certificate manipulation.
- unauthorized report access.
- organization document replay across conflicting identities.
- execute the implemented `db:verify:canopyproof:native` multi-connection gate
  against a disposable PostgreSQL test/CI database, then extend it for
  revocation and sustained serialization load. The gate now includes concurrent
  exact-retry access-restriction, accountability-packet, replay-verification,
  disclosure-publication, disclosure-challenge, resolution, and disclosure-
  notice, project lifecycle, evidence registration, deterministic validation,
  advisory AI analysis, independent human-review, final-decision,
  evidence-challenge, challenge-resolution, and withdrawal-correction commands,
  but it remains
  opt-in and has not run in this environment because
  no explicitly confirmed disposable native database is configured. PGlite and
  lock-order tests prove SQL/application invariants but not Prisma's native wire
  behavior.
- durable write adapters for the remaining in-memory trust services. Project
  lifecycle authority and purpose-bound
  data-access requests, decisions, hash-only manifests, delivery receipts,
  data-use attestations, independent enforcement reviews, restriction state
  streams, hash-only accountability packet generation, and replay verification
  disclosure publication/public reads, disclosure challenge and resolution, and
  correction/withdrawal notice publication/public reads already use the
  PostgreSQL trust registry. Evidence registration, deterministic validation,
  advisory AI analysis, independent human review, evidence challenge,
  resolution, withdrawal/supersession correction, current bounded evidence
  reliance, and internal final evidence decisions now use the same durable
  boundary. Environmental Proof candidate, independent approval, issuance, and
  current/stale projection commands now also use immutable PostgreSQL facts and
  canonical insert validators. Their HTTP routes stay fail-closed until the
  native PostgreSQL concurrency gate and security review pass. Media/custody
  processing, proof challenge/revocation, certificate, reporting, and funding
  still require explicit durable adapters
  before they can rely on these roots in production.

## Operational Response

When a trust-layer security alert fires:

1. Stop new public proof issuance for affected subjects.
2. Preserve all audit, evidence, and organization records.
3. Query the relevant status endpoint and audit history.
4. Resolve through human/governance review.
5. Do not clear the alert by weakening RBAC, deleting evidence, relaxing
   document requirements, or changing public claim boundaries.
