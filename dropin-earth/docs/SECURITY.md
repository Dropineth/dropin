# CanopyProof Security Model

Status: Phase 1 design baseline

CanopyProof is environmental accountability infrastructure. The security model
must assume adversarial evidence, compromised devices, malicious funding actors,
misleading public claims, and accidental operator error.

## Safety Boundaries

These are release-blocking invariants:

- `DROPIN_ALLOW_ADMIN_PROXY=false` in production.
- `/api/admin/*` must not be publicly reachable.
- no mainnet funds by default.
- no private-key handling in web, API, or deployment workflows.
- no automatic CANOPY distribution.
- no certified carbon-credit claim.
- no carbon-tax offset claim.
- no guaranteed RWA yield.
- API and web Workers remain separated.
- official logo remains JPG-only unless a future brand-governance decision
  changes it.

The canonical Cloudflare proxy rejects production configuration when admin
proxying is enabled. It also rejects non-HTTPS production origins, localhost
upstreams, credential-bearing API URLs, and non-exact CORS origins before any
upstream request is attempted. The infrastructure entrypoint re-exports the
tested `@dropin/dropin-cloudflare` implementation to prevent deployment/test
drift.

## Zero Trust Controls

Required controls:

- authenticated identity for every mutation.
- RBAC plus organization scope.
- ABAC policy for sensitive evidence, certificates, funding, and governance.
- append-only audit log for every mutation.
- immutable event hashes for audit batches.
- encryption in transit.
- encryption at rest for database, object storage, and backups.
- secret storage only in GitHub/Cloudflare/approved vault systems.
- rate limits and abuse prevention at edge and API layers.
- fail-closed verification for payments, evidence, and certificate issuance.

Implemented CanopyProof routes now enforce authentication before the route-level
RBAC boundary:

- production accepts identity only from an origin-verified
  `Cf-Access-Jwt-Assertion`; signature, RS256 algorithm, issuer, audience,
  expiry, not-before, issued-at, subject, and signed role claims are validated.
- the Cloudflare API proxy strips client-supplied `x-dropin-actor-id`,
  `x-dropin-actor-role`, and `x-dropin-organization-id` before forwarding.
- the verified subject becomes the actor ID. The signed role must resolve to
  exactly one of `owner`, `admin`, `verifier`, `researcher`, `community`,
  `observer`, or `agent`.
- production then binds that subject and exact role to the current
  `identity.participants` record. Institutional roles require an exact active
  `organizations.memberships` row, a non-suspended organization, and the
  route's required verified/accredited assurance. These checks run per request,
  so durable suspension or revocation takes precedence over an unexpired token.
- `development_headers` exists for local/test compatibility and is rejected
  when either CanopyProof or Node is in production mode.
- missing/invalid identity returns `401`; durable authorization denial returns
  `403`; authorization registry outage or inconsistent accreditation state
  returns `503` without exposing SQL, tokens, or registry content.
- invalid assertions and authentication configuration failures create
  `abuse_signal` challenge events with a one-way source fingerprint; raw IPs,
  tokens, and JWKS responses are excluded.
- every `/canopyproof/*` request receives API-layer rate-limit headers:
  `x-ratelimit-limit`, `x-ratelimit-remaining`, and `x-ratelimit-reset`.
- `/canopyproof/identity/*` records participant identity and reputation context
  with append-only audit events. Community actors can register only human or
  device participants, agent actors can register only agent participants, and
  reputation snapshots require owner, admin, verifier, or researcher authority.
  Reputation is explicitly non-authoritative and cannot bypass RBAC, governance
  approval, conflict disclosure, or human review.
- anonymous mutations are rejected before domain handlers execute and recorded
  as `abuse_signal` challenge events.
- production identity, organization-authority, data-sharing agreement, and
  purpose-bound data-access request/decision mutations require a bounded
  `Idempotency-Key` and execute in a serializable PostgreSQL transaction. Raw
  keys are never stored. Source state, semantic audit event, command receipt,
  and database mutation events commit or roll back together.
- the route-closed canonical organization lifecycle repository re-resolves the
  exact current actor, profile, hash-only registration reference, document,
  membership, organization, and latest accreditation authority inside the
  serializable write. Four immutable fact families share one organization
  sequence and predecessor root. PostgreSQL recomputes every
  command/fact/event root and the registration reference from the current raw
  registration number, forces tenant RLS, rejects stream forks, registration
  drift, and stale accreditation, and prevents update/delete.
- pending or adverse subject organizations receive only bounded owner/admin
  rights to anchor, submit documents, or appeal. Verification, suspension,
  revocation, appeal resolution, and reinstatement require a human in a
  different verified organization with the exact scope. Reviewer/decider,
  governor/appeal-reviewer, and appeal-reviewer/reinstater separation is
  enforced in both TypeScript and SQL. Revocation is terminal.
- after the additive migration, direct updates to the organization status and
  trust-level compatibility columns are rejected; only an accepted lifecycle
  fact may drive that mirror. The migration and repository remain unmounted and
  do not invalidate sessions or activate production behavior in this increment.
- the route-closed accreditation authority stores application, independent
  review, separated decision, and suspension/revocation control as four
  immutable fact families in one organization accreditation stream. PostgreSQL
  recomputes scope/evidence/source/command/fact/event roots, rejects forks,
  forces tenant RLS, and derives no mutable approval mirror.
- every approved interval is positive and at most 366 days. Consumers must
  supply canonical `asOf`; approval is denied at the exact expiry boundary and
  after suspension or revocation. Renewal cannot copy review authority or widen
  scope and revocation is terminal.
- governance-actor snapshots are accepted only for current verified humans in
  a different verified organization with an active exact membership, required
  scope, canonical timestamps, a valid authority interval, and an explicit
  `authoritySource`. The repository compares that snapshot with a canonical
  resolver result inside the serializable transaction. The resolver replays
  current immutable PostgreSQL facts and accepts only an active root charter or
  an active canonical organization accreditation. The compatibility
  accreditation table is not queried and is not a permitted fallback.
- the route-closed root-governance authority requires an Ed25519-signed quorum
  of at least three verified humans from distinct organizations. It delegates
  only organization accreditation review, decision, and control scopes for no
  more than 366 days. Succession requires both old and new council quorums;
  suspension, expiry, and terminal revocation never revive an older charter.
  Only public verification JWKs may enter facts. Every durable commit replays
  signatures and roots before atomically writing the fact, semantic event, and
  exact-retry receipt.
- no accreditation or root-governance route is mounted. Direct SQL writer
  grants remain prohibited until a dedicated `NOBYPASSRLS` role, native
  PostgreSQL source-replay/concurrency tests, external ceremony records, public
  key revocation operations, and backup/adverse-control drills pass independent
  review.
- agreement versions remain immutable. Revocation and supersession state is
  derived from append-only rows whose actor, organization, entity, time, and
  semantic event root are independently checked by PostgreSQL triggers.
- data-access request facts remain immutable and pending. Human decisions are
  separate append-only rows replayed by semantic-event sequence. Production
  route binding and database membership checks prevent cross-organization
  access; PostgreSQL also rejects requester self-decisions and competing stale
  transitions.
- production routes whose downstream partner persistence adapter is not yet
  complete fail with `503 CANOPYPROOF_DURABLE_WRITE_UNAVAILABLE`; they do not
  read or mutate compatibility maps.
- offline evidence sync requires an `Idempotency-Key`; exact replays are safe,
  and conflicting evidence ID reuse becomes a challenge rather than an overwrite.
- mobile evidence binding resolves participant membership, project, consent,
  device projection, and evidence registration in one serializable Trust
  Registry command. A subject-scoped advisory lock serializes consent/device
  mutation, and a project shared lock prevents an in-flight authority transition.
  Monotonic subject/project fence revisions force stale serializable waiters to
  retry after those locks; fences are coordination metadata and grant no trust.
  Historical exact retries replay the command receipt; new post-revocation
  commands fail without partial evidence writes.
- mobile-sync command admission is independently default closed. Bounded
  requests consume fixed actor and organization windows in one serializable
  PostgreSQL transaction. Denials append tenant-scoped deterministic facts;
  mutable buckets grant no trust and store no request body, coordinates, IP,
  token, credential, idempotency key, or private key. This API control does not
  replace Cloudflare WAF, bot, timeout, or DDoS policy.
- object-storage media confirmation requires a prior content-addressed upload
  intent, matching content hash/object key/byte length, encryption-at-rest
  metadata, and malware scan state. Pending, quarantined, or duplicate media
  objects cannot become clean proof evidence.
- the route-closed provider runtime derives R2 destinations from one fixed
  account and bucket, signs short-lived content/checksum-bound PUT grants, and
  accepts stored-object metadata only from an injected Workers R2 `head()`
  binding. Its scanner transport permits one fixed public HTTPS endpoint,
  disables redirects, caps time and response bytes, rejects compression and
  length mismatch, and never forwards provider response bodies in errors.
  An optional fixed-account/bucket management-API verifier validates bounded
  bucket-lock responses, applies the strictest matching finite `Age` or `Date`
  rule, rejects `Indefinite`, expired, duplicate, or substituted policy, and
  returns a runtime-branded governance attestation. Without that verifier,
  receipts remain retention-modeled and cannot make media available. No real
  provider, credential, or route is activated.
- durable E1 consent receipts, consent revocations, and device attestations use
  one subject-scoped semantic stream and serializable transaction. PostgreSQL
  independently verifies the exact active organization membership, subject and
  authority roots, sorted sets, chronology, event sequence/payload, command
  hash, fact hash/root, and immutable safety boundary. Revocation is a separate
  fact; receipt and attestation rows reject update and delete.
- device-provider trust cannot be self-asserted. The E1 command accepts only
  `modeled_only`. Default-off E1a validates exact signed fixture receipts with
  public Ed25519 keys, strips raw signatures, appends a separate RLS-bound fact,
  and derives the effective state without mutating E1. Live provider protocol,
  nonce/replay, revocation, key-ceremony, privacy, monitoring, and field-device
  gates remain open. The production consent/device route family remains closed.
- EXIF/GPS metadata extraction requires an available clean media object, active
  consent receipt, active device attestation, matching metadata hashes, and
  bounded sensor accuracy. Revoked or expired consent fails closed; risky device
  attestations and weak location signals are routed to human review.
- the default-off metadata-extractor adapter fixes the endpoint, object
  namespace, parser image/schema, policy root, signer registry, freshness
  window, and response bounds at construction. Its strict receipt excludes raw
  EXIF/GPS, coordinates, arbitrary nested fields, URLs, credentials, and private
  key material; Ed25519 verification uses public JWKs only. A private runtime
  brand is required before E3c fact construction and is lost on spread or
  serialization. The raw signature is replaced by its hash before persistence.
  E3c never mutates the modeled E3b fact and can remove only the provider-
  verification-pending issue. The adapter is not mounted, has no real parser or
  storage capability, and cannot bypass the unresolved governed E1/E2a
  effective-media projection.
- evidence review tasks are human-gated moderation records for non-final media
  and metadata artifacts. They can resolve, retain non-final, quarantine, or
  escalate; they cannot silently promote evidence into final proof.
- retention automation writes append-only policy decisions for revoked consent,
  elapsed retention windows, minimization, tombstone handling, and legal hold.
  It does not silently delete or mutate evidence lineage.
- evidence custody events are append-only source-rooted records that link each
  artifact to the previous custody root for the same evidence ID. Custody
  records reject raw private contact data, private-key material, carbon-credit
  claims, tax-offset claims, financial-asset claims, and guaranteed-yield
  language; they are lineage evidence, not final proof authority.
- community attestations can challenge evidence, but they cannot finalize proof,
  release funds, or create public impact claims.
- resilience drills model database and API outages as fail-closed checks:
  partial mutations cannot be exposed as final state, outage retries require an
  `Idempotency-Key`, and public UI fallback must be read-only or queued.
- high-risk Environmental Proof Record issuance has a stricter mutation budget
  than ordinary CanopyProof write routes.
- `/canopyproof/security/status` exposes policy count, active rate-limit bucket
  count, abuse-signal count, and deterministic policy/abuse roots to authorized
  observers and operators only.
- `/canopyproof/security/status` also exposes a presence-only secret posture:
  required secret IDs, approved secret stores, configured booleans, rotation
  windows, and a deterministic posture root. It never returns secret values,
  connection strings, private keys, webhook URLs, or deployment tokens. Private
  key handling remains disabled for the CanopyProof production boundary.
- `/canopyproof/security/access-decisions` records append-only ABAC decisions
  for sensitive evidence, certificate, funding, governance, reporting, memory,
  Terra scene, and risk-alert resources. Actor identity and role are derived
  only from authenticated request headers; actor fields in the JSON body are not
  trusted. Decisions enforce organization scope, classification, purpose,
  action, conflict status, and governance approval for confidential exports.
  Allowed decisions create `ASSERT` audit events; denied decisions create
  `CHALLENGE` audit events.
- `/canopyproof/organizations/:id/data-access-requests` records governed
  partner data-access requests under active data-sharing agreements. Requests
  require verified organization status, verified or institutional trust, scope
  and permitted-use subsets, and privacy-tier limits. Confidential access
  requires institutional trust. Approval requires an independent human actor and
  creates `data_access_request` audit events; request payloads reject raw
  contact details, private keys, secrets, payment instructions, carbon-credit
  claims, tax-offset claims, financial-asset claims, and guaranteed-yield
  language.
- `/canopyproof/data-sharing-agreements/:agreementId/revocations` is the
  agreement-level fail-closed path. Creation is limited to owner/admin roles,
  requires evidence event roots, records a separate append-only
  `data_sharing_agreement_revocation` audit event, marks the current agreement
  view revoked, and blocks future requests and delivery receipts without
  deleting prior agreement, request, delivery, attestation, enforcement, or
  packet history.
- `/canopyproof/data-sharing-agreements/:agreementId/supersessions` is the
  owner/admin-only agreement version transition. It creates a new immutable
  successor and a separate append-only lineage event, rejects scope/use/privacy
  escalation, rejects renewal term changes other than expiry extension, and
  fail-closes future access and delivery under the predecessor.
- `/canopyproof/data-access-requests/:requestId/deliveries` records hash-only
  delivery receipts after a request is approved. The API resolves the audit
  export manifest server-side, binds its export hash and entry root, checks
  organization ownership and privacy classification, and records
  `data_access_delivery_receipt` audit events without embedding raw evidence,
  precise personal data, payment credentials, private keys, carbon-credit
  claims, tax-offset claims, or guaranteed-yield language.
- `/canopyproof/data-access-deliveries/:deliveryId/use-attestations` records
  data-use attestations and misuse challenges against delivery receipts.
  Within-scope use requires output hashes, no-use cannot include output hashes,
  and misuse or revocation requests require evidence event roots. The records
  are non-final audit evidence and preserve the same no-raw-data,
  no-private-contact, no-carbon-credit, no-tax-offset, no-financial-asset, and
  no-guaranteed-yield boundary.
- `/canopyproof/data-use-attestations/:attestationId/enforcement-cases` records
  independent human-review response cases for misuse or revocation attestations.
  Observer and researcher roles cannot create cases, self-review is rejected,
  evidence event roots are mandatory, and access mutation is explicitly marked
  as requiring a separate approval path.
- `/canopyproof/data-use-enforcement-cases/:caseId/access-restrictions` is the
  separate approval path for request-level access impact. Creation is limited to
  owner/admin roles, cannot be performed by the enforcement reviewer or original
  attester, requires evidence event roots, and active restrictions fail closed by
  blocking future delivery receipts.
- `/canopyproof/data-access-requests/:requestId/accountability-packets`
  generates hash-only accountability packets for institutional review. Observer
  roles can read packets but cannot create them; packets expose agreement
  revocation and supersession, delivery, use, enforcement, and restriction counts/roots only and
  preserve no-raw-data, no-private-contact, and no-financial/no-carbon claim
  boundaries.
- `/canopyproof/data-access-accountability-packets/:packetId/verify` is
  observer-readable replay verification. It recomputes current lineage roots and
  appends an audit event for valid replay, stale lineage, root mismatch, or
  safety-boundary mismatch without modifying the packet or underlying ledgers.
- `/canopyproof/data-access-accountability-packets/:packetId/disclosures` is
  owner/admin only and fails closed unless a distinct actor produced a valid,
  still-current replay verification. The packet generator, replay verifier, and
  publisher must all differ. Public disclosure reads are unauthenticated by
  design but return only hash roots, bounded metadata, safety flags, and dynamic
  current/stale status; pagination is capped at 100 rows.
- disclosure challenges require authenticated non-agent roles, bounded public
  statements, and evidence event roots. Final resolution is restricted to an
  owner, admin, or verifier independent from both challenger and original
  publisher. A final decision cannot be overwritten; `needs_more_evidence`
  follow-ups are hash-linked. Correction and withdrawal notices require
  owner/admin publication, preserve the original row, reject raw/private data,
  and must match the reviewed remedial action.
- `/canopyproof/risk/alerts/:alertId/dispatches` records audience-scoped alert
  delivery receipts for community, NGO, government, operator, and verifier
  notification flows. Creation is limited to owner, admin, verifier, and agent
  actors; observer/community roles may read receipts but cannot dispatch. The
  receipt payload stores IDs, hashes, channel, status, and safety flags only;
  raw contact details, private keys, payment instructions, carbon-credit claims,
  tax-offset claims, and guaranteed-yield language are rejected.
- `/canopyproof/risk/alerts/:alertId/playbook-activations` binds operational
  response playbooks to delivered or acknowledged dispatch receipts. Activation
  validates risk class, severity floor, alert audience scope, required audience
  coverage, evidence references, and safety flags. Community responders may
  activate bounded field-response playbooks, but AI/agent actors cannot close a
  playbook as final authority, and no playbook can create emergency declarations,
  certified carbon credits, tax offsets, financial assets, or guaranteed yield.
- `/canopyproof/risk/playbook-activations/:activationId/closures` records
  human-reviewed completion or challenge outcomes. Closure requires evidence
  IDs, authenticated reviewer-role matching, and explicit safety flags. Agent
  actors are denied at the route boundary, and unsafe language such as official
  emergency declarations, guaranteed safety, carbon-credit claims, tax-offset
  claims, or guaranteed-yield language is rejected before audit recording.
- `/canopyproof/risk/response-closures/:closureId/after-action-reviews`
  records institutional post-incident review. Creation is limited to owner,
  admin, verifier, and researcher roles; community, observer, and agent actors
  can read but cannot write reviews. Reviews must preserve closure evidence
  references, include lessons learned, require corrective actions for follow-up
  or governance escalation, and preserve the same no-emergency/no-carbon/no-tax
  and no-yield claim boundary.
- `/canopyproof/audit/verify` provides institutional tamper checks over
  submitted audit chains. It recomputes each event root, checks `previousRoot`
  linkage from the CanopyProof genesis audit root, rejects duplicate event IDs,
  and verifies payload hashes when payloads are supplied. Verification itself
  emits an `audit_verification` event: `ASSERT` for clean chains and
  `CHALLENGE` for tampered or incomplete lineage. The PostgreSQL contract
  stores verification attempts in append-only `audit.audit_verifications` rows
  so failed verifier runs remain reviewable tamper evidence.
- `/canopyproof/audit/database-streams/verify` separately verifies what the
  PostgreSQL persistence layer recorded. The v2 trigger stores only row-key and
  state hashes, binds actor and monotonic timestamp into each event hash, and
  serializes successor allocation with a stream-scoped advisory transaction
  lock plus terminal-row lock. Independent replay rejects forks, gaps,
  reordering, mixed streams, mutation, and forged checkpoints. The route is
  human/institutional RBAC protected and Agent actors cannot invoke it. A valid
  stream proves hash consistency only; it is not final proof authority.
- `/canopyproof/audit/attestations` records independent institutional audit
  attestations over a bounded scope after audit roots have been replayed.
  Creation is limited to accountable institutional roles; observer reads are
  allowed for review. Each attestation preserves auditor organization,
  methodology, standards, source event roots, verification root, findings,
  limitations, public summary, and claim boundary. High or critical unresolved
  findings cannot be hidden behind a clean `attest` decision, and `qualified`
  or `reject` decisions remain append-only audit records. Attestations do not
  certify carbon credits, create tax offsets, move funds, guarantee yield, or
  distribute CANOPY.
- `/canopyproof/audit/export-manifests` creates hash-only data-room manifests
  for institutional review. Manifests include resource IDs, content hashes,
  optional event roots, classification, and redaction policy; they do not embed
  raw media, unrestricted personal data, private keys, or payment credentials.
  Observer and agent reads filter out restricted/confidential manifests, while
  owner, admin, verifier, and researcher actors may review sensitive manifests
  under RBAC. Classification cannot be lower than the most sensitive entry, and
  restricted entries require explicit redaction policy. Production creation is
  serializable and idempotent; route and PostgreSQL checks bind the actor to the
  requester organization, semantic event, and active membership. Unknown JSON
  fields, private contacts, secret material, malformed hashes, and root tamper
  fail closed. A manifest never authorizes delivery by itself.
- `/canopyproof/methodologies` records versioned proof/reporting methodologies
  as governed records. Draft versions are visible only to institutional
  reviewer roles; published versions require governance approval IDs and the
  human-review, governance-approval, and public-challenge quality gates.
  Published methodology rows cannot be edited into new rules; revisions create
  new versions with new hashes and audit events.
- `/canopyproof/quality/scorecards` turns evidence integrity signals into
  append-only `pass`, `needs_review`, or `blocked` quality gates. Scorecards
  fail closed on satellite contradiction, duplicate evidence candidates, missing
  audit lineage, weak GPS accuracy, unresolved challenges, or raw personal-data
  exposure. They are advisory and cannot replace human review, governance
  approval, or proof issuance controls.
- `/canopyproof/verification/decisions` records the accountable human decision
  dossier after queue work, AI assistance, TerraProof cross-checks, quality
  scorecards, and audit roots are available. Agent and community actors cannot
  write dossiers. An approval dossier cannot reference a blocked quality gate
  and must include evidence, AI, quality scorecard, human-review, and audit-root
  references, preventing AI-only or low-integrity proof escalation.
- `/canopyproof/verification/challenge-cases` records hash-only institutional
  challenge cases across evidence, proof records, projects, quality scorecards,
  verification decisions, methodologies, Terra scenes, reporting packages, and
  funding allocations. Community actors can open disputes, observers and agents
  can read, and only owner/admin/verifier/researcher actors can resolve.
  Reason-specific checks require GPS hash, satellite scene, or audit-root
  evidence where applicable. Resolution appends `challenge_case` audit history
  and never deletes challenged subjects or promotes a carbon-credit, tax-offset,
  financial, guaranteed-yield, mainnet-fund, or token-distribution claim.
- `/canopyproof/projects/*` binds every restoration project to a verified
  organization context, bounded location, monitoring cadence, project hash, and
  `project` audit events. A project cannot move to `active` or `monitored`
  without governance approval, and its claim boundary blocks carbon-credit,
  tax-offset, financial-asset, guaranteed-yield, mainnet-fund, and automatic
  CANOPY distribution claims.
- Project monitoring events require a registered project and at least one
  evidence ID or TerraProof scene ID. Writes are limited to `owner`, `admin`,
  `verifier`, and `researcher`; reads include community and observer roles.
  Every monitoring append emits a `project_monitoring_event` audit event and a
  deterministic event hash.
- Institutional project stages are isolated in a route-closed canonical
  authority and are never inferred from `/canopyproof/projects/*` status. The
  on-record proposer is a current subject-organization human owner/admin; review
  and transition/control authority require external canonically accredited
  humans with separation of duties. Serializable writes take command and
  project-stream locks, re-resolve all current authority in-transaction, and
  append one semantic event, fact and exact receipt. PostgreSQL recomputes roots,
  checks source-time equality, current memberships, legal stage edges and forced
  tenant RLS. Challenge/suspension block progression, restoration binds the
  exact adverse root and a different actor/organization, and no adverse or
  expired state falls back to prior authority. This path has PGlite evidence
  only and remains unavailable to HTTP and production consumers.
- `/canopyproof/dashboard/global` exposes the Global Impact Command Center
  read model to authenticated CanopyProof roles, including observers. It is not
  anonymous and it is not a mutation path. Durable authorization selects one
  latest append-only PostgreSQL snapshot in a repeatable-read transaction; the
  repository strictly parses and independently replays region, activity,
  lineage, safety, and dashboard roots. Missing or inconsistent data returns a
  stable `503`, never a process-local or static fallback. Compatibility data is
  explicitly labeled and rejected by the production client. The fixed safety
  boundary blocks carbon-credit, tax-offset, financial-asset, mainnet-fund,
  automatic-CANOPY, and guaranteed-yield claims. The separately governed writer
  and production activation remain closed.
- Global Command Center spatial data is a separate minimized disclosure, not a
  projection of project or evidence coordinates. Regions are withheld unless a
  strict fact binds a one-degree generalized centroid to the current region
  source root and project count, a minimum cohort of three, distinct privacy
  and safeguarding review roots, and a current validity interval. Unknown/raw
  coordinate fields, stale or future disclosures, duplicated or absent regions,
  source/count substitution, and review self-equivalence fail closed. The
  spatial, region, and dashboard roots are independently replayed in TypeScript
  and the database requires a spatial member on every region. A separate
  route-closed PostgreSQL authority now appends privacy and safeguarding review
  facts, a third-human publication fact, and independent withdrawal controls.
  SQL replays candidate/review/disclosure/control roots, binds semantic events,
  checks current memberships/accreditation scopes, forces tenant RLS, rejects
  precise-location/secret keys, and prevents update/delete. Expiry and
  withdrawal withhold without falling back to older geometry. The durable
  project/source resolver, production identities/roles, privacy and
  safeguarding approval, and activation remain absent, so production-compatible
  snapshots still remain withheld by default.
- Global Command Center snapshot publication is route-closed and cannot be
  performed by inserting a projection row alone. A deferred database constraint
  requires a matching append-only publication fact in the same transaction.
  The writer re-resolves the complete source snapshot, publisher authority, and
  distinct human governor authority inside a serializable transaction; exact
  advisory locks, semantic audit linkage, and command receipts prevent
  predecessor and idempotency ambiguity. Policy, approval, source, snapshot,
  publication, and audit roots are independently replayed. No HTTP writer,
  scheduler, production flag, raw-coordinate input, fund movement, CANOPY
  distribution, certified-credit, tax-offset, asset, or yield authority is
  enabled.
- `/canopyproof/governance/status` exposes policy count, approval count,
  conflict-disclosure count, unresolved-conflict count, and deterministic
  governance root to authorized observers and operators only.
- governance approvals are policy-bound, role-bound, and tied to deterministic
  subject IDs. Proof issuance rejects missing approvals, rejected/challenged
  decisions, subject mismatches, unauthorized reviewer roles, and unresolved
  conflict disclosures.
- evidence submission accepts `owner`, `admin`, `verifier`, `researcher`, and
  `community`.
- evidence reads accept `owner`, `admin`, `verifier`, `researcher`,
  `community`, and `observer`.
- AI advisory analysis accepts `owner`, `admin`, `verifier`, `researcher`, and
  `agent`.
- Environmental Proof Record issuance is verifier-only, and reviewer identity is
  derived from the request actor rather than trusted from the request body.
- Evidence submission and Environmental Proof Record issuance both require a
  registered CanopyProof project. Unknown `projectId` values fail before
  evidence, proof-record, certificate, ESG, or challenge lineage can be created.
- Environmental Proof Record issuance can reference project monitoring events
  only after those events are accepted and belong to the same registered
  project. `submitted`, `needs_review`, and `challenged` monitoring events
  cannot support a public certificate artifact.
- `/canopyproof/public-records` is a public-safe read model over Environmental
  Proof Records. It does not require actor headers, but it returns only redacted
  registry fields: source region identifier without coordinates or geometry,
  project summary, evidence and
  governance roots/counts, public challenge outcomes, source record hash,
  public record hash, and mandatory claim boundaries. It omits contributor
  identifiers, precise evidence locations, raw evidence IDs, and internal review
  rationale. Challenged or revoked records remain visible instead of being
  hidden, preserving public dispute accountability.
- Environmental Proof Record reads require an authenticated `owner`, `admin`,
  `verifier`, `researcher`, or `observer`.
- `/canopyproof/certificates/transparency/*` publishes and verifies
  deterministic certificate artifacts without raw evidence payloads. Publishing
  is limited to owner/admin/verifier/researcher roles; observer and agent roles
  can replay verification. Tampered certificate hashes, mismatched record,
  evidence, monitoring, governance, or challenge roots, and unsafe claim
  boundaries produce `certificate_verification` challenge events. Transparency
  entries are explicitly not carbon-credit, tax-offset, financial, yield, or
  token-distribution registries.
- Environmental Proof Record challenges require authenticated actors and append
  both challenge and proof-record audit events. Opening a challenge marks the
  record as disputed; only `owner`, `admin`, or `verifier` can resolve it, and
  accepted challenges revoke the proof record.

## Funding Accountability Authority Boundary

The mounted funding routes are compatibility-only and process-local. The
canonical route-closed authority accepts only minimized project-scoped
commitments, allocations, milestones, and aggregate evidence/proof roots. It
forbids account and routing numbers, cards, wallets, payment tokens, private
keys, donor contact details, tax identifiers, raw media, and precise coordinates.
Amounts are safe integer cents; allocation and milestone conservation is checked
independently in TypeScript and PostgreSQL.

Canonical publication requires three different current accredited humans for
preparation, reconciliation review, and publication. AI and agents have no
authority in those roles. Every write re-resolves current actor and source
authority inside a serializable transaction, binds an exact command receipt,
and appends a semantic event plus immutable fact. Forced tenant RLS,
update/delete rejection, SQL root recomputation, and row audit protect the
database boundary.

Challenge and withdrawal are successor facts. They never erase history and the
current resolver never falls back to an older package. A challenged package
contributes no reconciled operational total; a withdrawn or expired package
contributes no operational total. This authority records transparency only and
cannot initiate, custody, settle, release, or route funds.

The PGlite gate proves trigger and transaction behavior but not effective
non-bypass RLS. Native PostgreSQL `NOBYPASSRLS`, concurrent-writer, least-
privilege role, backup/restore, observability, source-adapter, legal/accounting,
and separate activation reviews remain mandatory before any canonical route is
mounted.

## Early-Warning Publication Authority Boundary

The mounted `/canopyproof/risk/*` endpoints are compatibility-only. The
canonical authority has no mounted route, scheduler, live climate feed,
notification transport, or emergency-declaration capability. It accepts only
bounded public scope identifiers, lineage roots, timestamps, integer-scaled
indicators, basis-point confidence, policy references, and minimized advisory
text. Recursive key and text checks reject coordinates, geometry, contact data,
credentials, private keys, unsafe emergency commands, guarantees, and
unsupported environmental or financial claims.

A current organization-bound agent may prepare a candidate but machine actors
cannot review, publish, challenge, withdraw, or control it. Scientific review,
operational review, and publication require three different current accredited
humans; challenge or withdrawal requires a current accredited human distinct
from the publisher.
Every write re-resolves current actor/source authority in a serializable
transaction, acquires command and stream advisory locks, requires an exact
receipt, and appends its semantic event before the database trigger accepts the
fact.

PostgreSQL independently recomputes member, candidate, review, projection,
publication, control, and audit roots. Forced tenant RLS, unique predecessor
and sequence constraints, update/delete denial, and row mutation audit defend
the persistence boundary. Challenge, withdrawal, and expiry fail closed with no
older-publication fallback. PGlite verifies these trigger and transaction
properties but is not evidence of non-bypass RLS, concurrent writers, real feed
integrity, notification operations, regional emergency policy, or production
activation.

## Threat Model

### Fake Evidence Attack

Risk: copied media, synthetic images, forged metadata, or stale satellite data.

Controls:

- content hashes.
- EXIF/GPS extraction bound to content-addressed media, active consent, and
  active device attestation.
- duplicate media detection.
- device fingerprint risk scoring.
- moderation review tasks for quarantined, duplicate, pending-scan, or
  metadata-risk artifacts.
- satellite/field cross-check.
- human review before certificate issuance.

### Duplicate Planting Attack

Risk: same planting claimed multiple times by same or different actors.

Controls:

- media hash dedupe.
- geospatial duplicate candidate index.
- contributor and device reputation.
- challenge flow.
- certificate evidence-root comparison.

### GPS Spoofing

Risk: fake or manipulated location metadata.

Controls:

- compare GPS, EXIF, device location, network hints, and satellite/geospatial
  expectations.
- mark low-accuracy or inconsistent records as pending review.
- route `location_mocking`, clock-skew, weak reputation, masked privacy mode,
  and GPS accuracy over the review threshold into non-final metadata extraction
  records.
- never issue proof from GPS alone.

### Satellite Contradiction

Risk: field evidence claims restoration while satellite data contradicts it.

Controls:

- TerraProof scene links.
- dataset acquisition timestamps.
- cloud cover and resolution metadata.
- seasonal exception workflows.
- reviewer rationale for accepting or rejecting contradiction.

### Unauthorized Admin Access

Risk: direct API origin exposure or missing route guard.

Controls:

- Cloudflare Access or equivalent for admin origin.
- API-level auth and policy checks.
- edge proxy block for `/api/admin/*`.
- smoke test requiring `403`.
- audit event for every admin mutation.

### Database Failure

Risk: partial writes, missing audit rows, or inconsistent certificates.

Controls:

- transaction boundaries for mutation plus audit append.
- idempotency keys.
- retry-safe job design.
- backup and restore drills.
- read-only degradation mode.

### API Outage

Risk: public site up but evidence/funding/verification unavailable.

Controls:

- status page.
- health and readiness checks.
- queue-backed ingestion.
- graceful offline sync.
- incident response runbook.

## AI Security Boundary

AI agents may:

- detect anomalies.
- summarize evidence.
- compare satellite signals.
- recommend review actions.
- draft ESG explanations with citations.

AI agents must not:

- issue final proof.
- approve certificates.
- release funds.
- assert certified carbon credits.
- override human review.
- hide uncertainty.

Every AI output must store model version, prompt/context hash, evidence IDs,
confidence, caveats, and reviewer disposition.

## Managed Signature Verification Boundary

The default-off AWS KMS verifier is verification-only. Its constructor fixes
the account, partition, Region, full asymmetric key ARN, organization,
governance key-version label, algorithm, deadline, and response bound. Commands
cannot select an endpoint, alias, key, algorithm, credential, or request target.
The only provider operations are `GetPublicKey` and `Verify`; there is no
`Sign`, private-key import, export, custody, or fallback success path.

Every verification rechecks the exact key ARN, `SIGN_VERIFY` usage, compatible
key spec, expected signing algorithm, SHA-256 hash of the DER SPKI, canonical
digest bytes, canonical provider-native signature bytes, positive provider
response, and bounded local time. Redirects, compressed or oversized bodies,
malformed content length/media type/JSON/request ID, negative verification,
and dependency failures fail closed. Module-private error branding prevents a
dependency from forging a trusted error by copying its public name. Returned
facts contain only domain-separated receipt hashes and no credential, raw AWS
body, request ID, public key, or signature.

The current suite uses fake credentials and a mock transport. Production still
requires a least-privilege policy limited to `kms:GetPublicKey` and
`kms:Verify` on one exact key ARN, retained CloudTrail evidence, key ceremony,
rotation/revocation operations, live compatibility testing, independent
security/governance approval, and a separately reviewed composition root.

## Public Transparency Privacy Boundary

The canonical public transparency authority permits only pseudonymous project
and organization IDs, UTC day boundaries, optional source region or withheld
location, area/confidence bands, counts, aggregate roots, lifecycle state, and
bounded challenge roots. Coordinates, geometry, boundary hashes, raw evidence,
evidence/contributor/reviewer identities, internal rationale, credentials,
provider identifiers, and detached signatures are forbidden from the public
projection and checked by deterministic replay and SQL insert validation.

Writes require current canonical source re-resolution inside a serializable
transaction, independent accredited humans, exact command receipts, semantic
audit events, database mutation audit, forced tenant RLS, and append-only
triggers. A dedicated `NOBYPASSRLS` test role proves cross-tenant denial. The
legacy `/canopyproof/public-records*` compatibility response has no coordinates
and explicitly reports `canonical:false`, `durable:false`, and
`institutionalRelianceAuthorized:false`; it is not a public authority.

## OpenTelemetry Export Boundary

API server-span export is disabled by default and cannot be enabled by request
input. Activation requires explicit `http/json` protocol and one fixed endpoint.
The exporter rejects URL credentials, query strings, fragments, arbitrary
headers, unsupported compression or TLS-file configuration, redirects,
arbitrary plain-HTTP hosts, excessive bounds, and malformed protocol state.
Plain HTTP is limited to an explicitly approved loopback or Kubernetes
`.svc.cluster.local` collector exception.

OTLP payloads contain route templates, bounded HTTP semantics, deterministic
correlation hashes, and trace/span IDs. Actor ID/role, raw request IDs, JWT
data, IP, user agent, query string, request/response bodies, database values,
evidence, media, coordinates, and provider payloads are excluded. Queue,
payload, timeout, retry, response handling, and diagnostic emission are finite.
Exporter failure cannot alter authorization, audit, evidence, verification,
proof, certificate, funding, token, claims, or response state.

This boundary does not supply backend authentication, durable delivery,
retention, access governance, dashboards, incident ownership, or end-to-end
Worker/database/job traces. Those are mandatory independent production gates.

The separate Cloudflare API proxy now owns a default-off edge trace boundary.
It strips client `traceparent`, `tracestate`, and `baggage`, accepts only a
strict version-00 parent, generates edge identifiers with Web Crypto, and
forwards a canonical parent for the API server span. Its local sample decision
uses the random edge span ID and ignores the public sampled bit, preventing a
caller from directly forcing telemetry volume.

Eligible edge export is one finite HTTPS OTLP/JSON request registered through
`ctx.waitUntil()`. Missing context starts no export task. The payload allowlist
excludes actor identity, Access assertions, authorization, cookies, IP, user
agent, query, bodies, evidence, coordinates, and provider data. Unsafe endpoint,
header, compression, TLS-file, payload, timeout, and redirect states fail
closed. Checked-in deployment paths keep export false and the sample ratio zero.
This is not backend authentication, receipt evidence, or production activation.

## Incident Severity

- Critical: admin route publicly reachable, false certificate issuance, live
  fund movement, private-key exposure, unsafe carbon/yield/tax claims.
- High: evidence acceptance without review, RBAC bypass, audit write failure,
  public report with unsupported impact claims.
- Medium: stale satellite connector, delayed evidence processing, partial
  observability outage.
- Low: non-sensitive UI defect or recoverable report export failure.
