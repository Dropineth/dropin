# CanopyProof Evidence Protocol

Status: E1-E4 DURABLE CORES IMPLEMENTED; PROVIDERS, CLIENT SYNC, AND PRODUCTION ROUTES CLOSED

Date: 2026-07-17

Scope: mobile/offline evidence capture, consent, device attestation, media
objects, metadata extraction, custody, moderation, retention, community
attestation, and their relationship to canonical evidence verification

## 1. Purpose

CanopyProof evidence must survive institutional review, dispute, replay, and
provider failure. A photo plus coordinates is not proof. It is a claim-bearing
artifact whose identity, consent, device context, bytes, metadata, custody,
quality, review, and use must remain independently inspectable.

This protocol turns the existing Evidence Network prototype into a sequence of
immutable authority facts. It does not make an AI model, scanner, storage
provider, device, contributor, or community attester final authority.

## 2. Current-State Boundary

Current strengths:

- canonical evidence registration, validation, advisory AI, human review,
  challenge, correction, final decision, and replay are durable in the
  CanopyProof trust registry;
- the Evidence Network domain models content-addressed uploads, encryption
  metadata, malware state, consent, device attestation, EXIF/GPS hashes,
  moderation, retention, offline batches, community attestations, and custody;
- the SQL contract contains tables for these concepts;
- the E1 custody authority now persists immutable consent receipts, separate
  consent revocations, and device-attestation facts in the same serializable
  transaction as semantic events and hashed command receipts;
- the E2 custody authority now persists immutable media upload intents, object
  receipts, duplicate-relation facts, and scan-result facts without storing an
  upload grant, provider endpoint, token, or credential;
- the default-off object-storage boundary now validates exact provider,
  namespace, intent root, content-addressed key, HTTPS host, URL path, method,
  declared and SigV4-signed TTL, credential scope, signed headers, content
  type, byte length, S3 SHA-256 checksum encoding, object version,
  upload/verification time, encryption metadata, and governed retention root;
- the default-off scanner boundary now binds a result to the immutable object
  root and provider receipt, canonicalizes finding hashes, constrains receipt
  age and approved signer IDs, verifies Ed25519 receipts using public JWKs
  only, rejects private signing keys, hashes the accepted signature, and binds
  that hash into the server-computed scanner verification root;
- the additive E2a authority now persists independent provider/retention and
  scanner-signature verification facts without mutating historical object or
  scan facts. Each fact binds an exact semantic event and idempotent command
  receipt, is forced-RLS tenant scoped and append-only, and has TypeScript/SQL
  root parity. A route-closed two-phase orchestrator performs provider/scanner
  I/O outside the database transaction, accepts only runtime-branded verified
  receipts, strips raw scanner signatures, and atomically commits any missing
  modeled E2 fact with the E2a verification fact. E2a uses a dedicated
  `evidence-media-adapter:<evidenceId>` stream, and scanning is refused before
  external I/O unless the exact object has durable provider verification. Its
  projection reports receipt trust only, never evidence truth;
- the E3a review authority now persists separate review-task, independent
  assignment, review-decision, and exact-source custody facts. Human review
  cannot promote a modeled provider/scanner receipt or issue final proof;
- the E3b repository now persists minimized metadata-extraction receipts,
  human-governed retention decisions, and provider execution receipts in
  separate append-only relations. It replays the shared media event stream,
  requires serializable idempotent writes, and refuses a stale decision after a
  legal hold;
- the additive E3c authority keeps those E3b extraction facts permanently
  `modeled_only` and records an independent signed-receipt verification fact.
  Its fixed-policy adapter binds the exact object, media, consent, device, GPS,
  privacy, extractor image/schema/policy, signer, observation window, and
  minimized output; verifies Ed25519 with an allowlisted public JWK; discards
  the raw signature before persistence; and may remove only the provider-
  verification-pending issue in the effective projection. Other quality or
  custody issues remain review-required;
- the E1/E2a effective-media projection now combines unchanged base custody
  facts with independently verified provider/scanner receipts using strict
  as-of semantics. It cannot override duplicate, pending-scan, quarantine,
  consent, or device hard states;
- the E3d authority now commits a minimized append-only extraction request
  before provider I/O. Its route-closed orchestrator invokes the extractor
  outside database transactions, appends E3b and E3c descendants separately,
  and resumes from durable facts after provider failure without persisting raw
  idempotency keys, EXIF, GPS, coordinates, signatures, or credentials;
- the E4 repository now persists consent-, device-, project-, and evidence-bound
  offline batch manifests plus per-item outcomes and hash-only community
  attestations. Exact retries replay, changed retries conflict, local clocks are
  advisory, and community statements cannot mutate verification authority;
- PostgreSQL validation triggers independently recompute actor authority,
  command/fact/root hashes, stream sequence, event payload parity, and current
  consent/device/media projections;
- the executed PGlite gate covers exact replay, conflicting idempotency,
  subject substitution, caller-asserted provider verification, SQL/TypeScript
  parity, E2a provider/scanner verification roots, forced-RLS policy metadata,
  E3c receipt/signature/verification/fact/projection roots, raw metadata and
  signature exclusion, immutable modeled-only E3b ancestry,
  atomic base-plus-verification commits, dedicated-stream sequencing, restart
  replay, cross-tenant reads, no-repeat adapter calls on exact retry, provider-
  before-scanner enforcement, revocation quarantine, forbidden credential/
  signature columns, append-only mutation rejection, and non-empty rollback
  refusal;
- legacy in-memory Evidence Network routes now require the explicit
  `CANOPYPROOF_LEGACY_EVIDENCE_NETWORK_ENABLED=true` development flag and still
  cannot run when either `NODE_ENV` or `DROPIN_CANOPYPROOF_MODE` is
  `production`; enforced production middleware independently fails closed for
  unported durable routes.

Current gaps:

- the legacy Evidence Network compatibility projection is held in process-local
  `Map` instances and is not production authority;
- the legacy process-memory compatibility service still represents revocation
  on a mutable current receipt; production authority does not use that model;
- the legacy compatibility media tables remain mutable and may contain an
  `upload_url`; they are not authoritative and are not read by the E2 adapter;
- receipt validators and policy-enforced adapter orchestration exist, but no
  approved object-storage provider port, grant signer, bucket-lock policy
  attestation, or production configuration is active, so no real short-lived
  upload grant is issued;
- device attestation hashes remain modeled in E1 and the public write service
  rejects caller-asserted `verified` state. Default-off E1a verifies signed
  fixture receipts into additive facts and supplies the effective projection,
  but no live provider protocol, unpredictable nonce/replay store, revocation
  feed, approved key ceremony, or production composition is active;
- no approved scanner service port or staffed quarantine operation is active;
  the metadata extractor has a default-off fixed HTTP port and signed-fixture
  verifier, but no live parser image, object-store capability, signer ceremony,
  service credential, production composition root, or mounted route. The
  effective-media composition and durable route-closed orchestrator now exist,
  while E3b correctly stays `modeled_only`; object lock,
  retention/lifecycle executors, offline client queues, and delivery transport
  are not operational integrations. E4 has no service-worker/native client or
  mounted route;
- E3a has no reviewed production route or staffed operational review queue.

No memory-only Evidence Network route may open in enforced production mode.

## 3. Authority Model

| Authority | Owns | Does not own |
| --- | --- | --- |
| Dropin/CanopyProof identity | human, organization, agent, and device subject identity; memberships; accreditation | truth of environmental observation |
| Evidence registration authority | immutable evidence envelope and project/contributor binding | media storage, final verification, certificate |
| Evidence custody authority | artifact identity, consent/device/media/metadata/custody facts and current projections | environmental conclusion or proof issuance |
| Verification authority | validation, advisory AI, independent human review, challenge/correction, final evidence decision | storage-provider state |
| Environmental Proof authority | governed candidate, approvals, record, challenge, revocation | certified carbon credit or financial entitlement |
| External provider | provider-specific receipt, scan, attestation, or object operation | CanopyProof identity, verification, audit, or proof authority |

Every external result is an input fact with provider identity and version. It is
never silently promoted to a CanopyProof decision.

## 4. Evidence Flow

```text
Local capture
  -> consent fact
  -> device attestation fact
  -> durable upload intent
  -> short-lived provider upload grant
  -> quarantined immutable object confirmation
  -> malware/content verification
  -> metadata extraction in isolated worker
  -> signed minimized extractor receipt
  -> additive E3c receipt verification fact
  -> custody facts
  -> canonical evidence registration
  -> deterministic validation
  -> advisory AI
  -> independent human review
  -> independent final evidence decision
  -> governed Environmental Proof candidate/record
```

Offline clients may reorder delivery, but the server does not reorder authority.
Dependencies must exist and be current before a later fact is accepted.

## 5. Lifecycle Facts And Projections

### 5.1 Consent

Facts:

- `ConsentReceiptFact`: immutable grant/basis, purposes, policy version,
  privacy mode, retention, subject, optional device commitment, and hash.
- `ConsentRevocationFact`: immutable later revocation with reason hash, actor,
  time, prior receipt root, semantic event, and command receipt.

Projection:

- `active`: no revocation, not expired, and required purposes present;
- `expired`: expiry precedes the evaluation time;
- `revoked`: a valid revocation fact exists;
- `invalid`: hash, actor, chronology, or lineage cannot replay.

The base receipt is never updated to represent revocation.

### 5.2 Device Attestation

Facts:

- immutable subject, device fingerprint commitment, consent root, attestation
  type, public-key commitment, provider attestation commitment, issue/expiry,
  reputation snapshot, risk flags, provider, provider key/version, and audit
  event;
- later revocation or supersession is a separate fact, not an update.

Projection:

- `current`, `expired`, `revoked`, `superseded`, or `needs_review`.

The base device attestation always remains `modeled_only`. Only an unexpired,
independently verified E1a fact can make the strict as-of effective projection
`current`. Fixture verification exists; live hardware-trust activation remains
closed.

### 5.3 Media

Facts:

- upload intent metadata, excluding the ephemeral upload URL;
- immutable object confirmation with checksum, size, provider object version,
  encryption key identifier (never key material), scan state, and receipt hash;
- scan result facts rather than in-place scanner-state replacement;
- separate provider/retention and scanner-signature verification facts rather
  than changing an object's or scan's historical `modeled_only` field;
- duplicate relation facts without deleting either artifact;
- retention/disposal facts without overwriting historical confirmation.

Projection:

- `quarantined`, `pending_scan`, `available`, `duplicate`, `rejected`,
  `retained`, or `disposed`.

An `available` object may support an accepted extraction. A `needs_review`
object may support only a minimized, non-final `needs_review` extraction so a
provider adapter can be integrated without losing lineage. Quarantined,
duplicate, consent-revoked, consent-expired, or device-expired media is rejected.
Only `available` objects with approved provider/device authority may support
canonical evidence or MRV reliance.

The E2a adapter-trust projection is intentionally narrower than this media
projection. `verified_receipts` means only that the exact provider and scanner
receipts have independent durable verification facts. Consent, device trust,
duplicate status, extraction policy, human review, and final evidence authority
must still be evaluated by their owning projections.

### 5.4 Metadata, Review, Retention, And Custody

- each extraction is immutable and bound to media, consent, device, extractor
  image/version, EXIF hash, GPS hash, and output root;
- review assignment and each review decision are separate facts;
- retention evaluation and disposal execution are separate facts;
- each custody event links the previous custody root and exact artifact source
  root;
- a challenge or correction appends facts and never erases the original chain.

Current implementation boundary: E3a review/custody and E3b metadata/retention
facts are durable. E3b stores no raw EXIF, coordinates, rationale, credential,
or provider endpoint. PostgreSQL independently verifies source projections,
actor/accreditation, semantic events, TypeScript hash parity, sequence roots,
tenant scope, legal-hold ordering, and append-only behavior. Provider
verification, real metadata/lifecycle execution, production command handlers,
and queues remain closed.

### 5.5 Offline Reconciliation And Community Context

- one offline batch fact binds a contiguous device sequence, prior batch root,
  current consent/device projections, project root, contributor authority,
  local clock interval, server receipt time, and ordered item Merkle root;
- each item is a separate immutable result bound to a registered evidence root
  and client payload commitment; no raw payload or raw location is stored;
- a modeled device can produce only `needs_review`, never trusted reconciliation;
- each community attestation is a separate hash-only statement from a verified
  same-organization human. Self-attestation and duplicate actor/evidence
  statements are rejected;
- support is advisory context and challenge requires human review. Neither state
  changes canonical evidence verification, proof, funding, or claims.

The E4 authority is durable and route-closed. PostgreSQL independently verifies
source existence, actor membership, event lineage, command/fact/root parity,
item completeness, ordered Merkle roots, RLS scope, and append-only behavior.
Real offline delivery, conflict UX, retraction/supersession policy, and native
multi-connection execution remain gates.

## 6. Common Fact Envelope

Every durable evidence-supporting fact contains:

```json
{
  "id": "opaque deterministic or server-issued id",
  "organizationId": "owning organization",
  "projectId": "project where applicable",
  "evidenceId": "canonical evidence id where available",
  "actorId": "verified subject",
  "occurredAt": "server-validated RFC3339 time",
  "sourceRoots": ["sha256 commitments"],
  "factHash": "canonical sha256",
  "factRoot": "lineage root",
  "auditEventId": "semantic event id",
  "auditEventRoot": "semantic event root",
  "idempotencyKeyHash": "stored only in the command receipt"
}
```

No fact contains a bearer token, signed upload/download URL, private key,
unhashed public contact, raw biometric/device identifier, or unredacted secret.

## 7. Transaction Contract

External provider and scanner calls are never made inside a database
transaction. Phase A loads a tenant-scoped immutable source, invokes the
default-off adapter, verifies its policy/signature, and reduces it to the
minimum durable receipt. Phase B is the durable command below. The transaction
revalidates every Phase A source root, so time between the phases cannot turn a
stale or substituted result into authority.

Every durable command follows one serializable transaction:

1. normalize and hash the idempotency key;
2. lock command identity `(actor, operation, idempotency key)`;
3. return the prior result only when the request hash matches exactly;
4. lock the semantic stream(s);
5. load and replay current authority from immutable facts;
6. bind actor, organization, role, project, consent, and prior roots;
7. compute the command hash, fact hash/root, and semantic event;
8. insert the semantic event;
9. insert exactly one immutable fact (or an atomic fact bundle);
10. insert one command receipt bound to result ID/root and event root;
11. commit or expose no state.

An upload grant is obtained only after the durable intent commits. The grant is
ephemeral and returned to the caller without being stored. Provider failure
does not roll back the intent; it appends a failed/expired grant attempt or the
client requests a new bounded grant for the same intent.

## 8. First Durable Slice

Implementation order is intentionally dependency-first.

### Slice E1: Consent And Device Facts

- immutable consent receipt;
- append-only consent revocation;
- consent current-state projection;
- immutable device attestation bound to the exact current consent root;
- idempotency, semantic event, hash parity, no-update/no-delete triggers;
- production routes remain closed until provider signature verification and
  privacy review are approved.

Implementation state on 2026-07-12: the domain authority, Prisma trust-registry
adapter, SQL validation/projection functions, immutable triggers, unit tests,
PGlite tests, and opt-in native dual-connection scenario are present. The
native scenario has not been executed in this environment because no explicitly
confirmed disposable PostgreSQL database is available. The command adapter
accepts only `modeled_only`; a caller cannot self-promote a provider receipt to
`verified`.

### Slice E2: Media Intent And Object Registry

- immutable upload intent without persisted URL;
- `ObjectStorageAdapter` that returns a short-lived upload grant;
- immutable object confirmation using provider version/checksum receipt;
- separate scan facts and duplicate relations;
- object-lock/lifecycle integration and quarantine policy.

E2 authority rules:

- canonical tables use new `*_facts` names; legacy rows containing persisted
  `upload_url` or mutable scan state are never promoted by migration accident;
- a verified human subject creates the intent for itself, bound to an exact
  active consent root, device-attestation root, organization membership, and
  current project root;
- the database stores a deterministic internal object key but never a grant
  URL, bearer token, signed headers, provider credential, or private endpoint;
- object confirmation and scan results require dedicated active Evidence Agent
  capabilities. Human request fields cannot impersonate those agents;
- storage and scanner receipts remain `modeled_only` until an injected adapter
  verifies provider signatures. Caller-supplied `verified` state is rejected;
- a clean client-asserted scan is not enough. The object projection is
  `pending_scan`, `quarantined`, `duplicate`, `needs_review`, or `available`;
  only independently verified storage and scan receipts plus current consent
  and device trust can derive `available`;
- duplicate detection is server-derived under a content-hash transaction lock
  and appends a relation to the prior object rather than deleting either fact;
- upload grants are generated after the intent transaction commits, bounded to
  one object key/content type/size/checksum and at most fifteen minutes. Grant
  generation failure never creates an object fact and never changes the intent.

Implementation state on 2026-07-13: the E2 domain authority, Trust Registry
adapter, four append-only PostgreSQL fact tables, database-side hash and actor
validation, current-state media projection, immutable triggers, unit tests, and
PGlite restart/adversarial test are present. The adapter and database accept
only `modeled_only` provider/scanner receipts. No production route, object
store, scanner, parser, or lifecycle worker is enabled. Canonical evidence
registration currently rejects a duplicate media hash before E2, so the
duplicate-relation table is a defensive lineage contract until a reviewed
rejected-submission audit workflow makes that path reachable without weakening
duplicate-evidence prevention.

### Slice E3a: Review And Custody

- immutable review task bound to exact object and current media projection;
- separate assignment requiring an independent verified, accredited human
  verifier with `evidence_media_review` scope;
- separate decision with hash-only rationale and limitations;
- exact-source custody event after every task, assignment, and decision, linked
  to the previous custody root;
- human review cannot override provider verification or create proof,
  certificate, credit, offset, financial asset, token distribution, or yield.

Implementation state on 2026-07-13: the domain authority, Trust Registry
adapter, four append-only PostgreSQL tables, canonical SQL hash functions,
database validation/audit/immutability triggers, focused unit tests, and PGlite
restart/adversarial execution are present. Production routes remain closed.

### Slice E3b: Metadata And Retention Execution

- durable minimized extractor receipts with advisory `needs_review` fallback;
- append-only, accredited-human retention decisions with terminal legal hold;
- modeled provider minimization/disposal receipts that remain pending until an
  approved adapter verifies the provider result;
- additive migration, fail-closed rollback, restart replay, SQL/TypeScript hash
  parity, RLS tenant scope, semantic events, and command receipts;
- no mounted HTTP route or production worker.

### Slice E4: Offline Sync And Community Attestation

- batch command receipt and per-item immutable result;
- exact retry replay and conflicting retry rejection;
- local-clock/device/consent binding;
- community statements remain non-final and cannot alter verification state.

Implementation state on 2026-07-14: the E4 domain authorities, route-closed
PostgreSQL repository, three append-only fact tables, canonical SQL hash/root
functions, deferred atomic-bundle validation, RLS, database audit triggers,
fail-closed rollback, focused unit tests, and PGlite restart/adversarial tests
are present. No public command route or client sync adapter is mounted.

## 9. API Contract

The existing route family remains, but durable commands require
`Idempotency-Key` and verified organization binding:

```text
POST /canopyproof/evidence/consent-receipts
POST /canopyproof/evidence/consent-receipts/:id/revocations
GET  /canopyproof/evidence/consent-receipts/:id
GET  /canopyproof/evidence/consent-receipts/:id/status

POST /canopyproof/evidence/devices/attestations
GET  /canopyproof/evidence/devices/attestations/:id

POST /canopyproof/evidence/media/upload-intents
POST /canopyproof/evidence/media/upload-intents/:id/grants
POST /canopyproof/evidence/media/objects
POST /canopyproof/evidence/media/objects/:id/scan-results
```

Compatibility aliases may remain in development, but production opens only
routes backed by the durable registry and approved external adapters. A request
body cannot supply actor, organization authority, object-store endpoint, bucket,
arbitrary object key, callback URL, scanner command, or executable extractor.

Reads are organization/project scoped and privacy filtered. `observer` and
public surfaces never receive precise coordinates, device commitments,
attestation details, consent evidence hashes, object keys, or internal provider
receipts.

## 10. Database Changes

The E1 and E2 development contract now:

- add organization, fact hash/root, audit event root, and creator fields to
  consent receipts;
- make the base consent receipt append-only;
- move revocation into `evidence.consent_revocations`;
- add provider/key/version and semantic-event bindings to device attestations;
- add deterministic unique constraints and organization/time indexes;
- add validation triggers that recompute hashes and verify event parity;
- add no-update/no-delete triggers;
- separates authoritative media intent, object, duplicate, and scan facts from
  legacy mutable tables and excludes grant URL or credential columns;
- derives media availability from current consent/device state and immutable
  provider/scanner facts rather than a mutable status column;
- use forward-compatible `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` only for the
  unversioned development contract, followed by a reviewed versioned migration
  before production.

Large media bytes never enter PostgreSQL.

## 11. Security And Privacy Controls

- derive actor/organization from origin-verified identity, never request body;
- reject cross-organization subject, consent, device, project, and evidence
  substitution;
- validate content type independently from filename/client declaration;
- quarantine before parsing; native parsers run without credentials or default
  network access under byte/time/memory/dimension limits;
- permit only registry-generated object keys and configured providers;
- never persist ephemeral URLs or tokens;
- hash device identifiers with a policy-controlled domain separator;
- minimize precise GPS and EXIF access; log only opaque IDs and policy results;
- require independent human review for risk flags, duplicates, GPS conflict,
  scanner uncertainty, or provider-verification failure;
- prevent AI, scanner, connector, device, or contributor from final approval;
- preserve no-mainnet, no automatic CANOPY, no carbon-credit, no tax-offset,
  and no guaranteed-yield boundaries.

## 12. Required Tests

### Unit

- consent creation and exact replay;
- revocation appends without changing the receipt;
- expired/revoked consent blocks device facts;
- device subject/fingerprint/consent mismatch rejected;
- secret-like key/provider material rejected;
- AI or agent cannot grant/revoke human consent.

### PostgreSQL / PGlite

- TypeScript and SQL hash/root parity;
- one semantic event and one receipt per exact command;
- conflicting idempotency request rejected;
- update/delete of receipt, revocation, and attestation rejected;
- cross-organization substitution rejected by service and database;
- restart replay produces the same projection;
- partial insert leaves no fact/event/receipt residue.
- offline batch item count, sequence, prior root, command hash, and ordered
  Merkle root are revalidated at transaction commit;
- unregistered community actors and cross-tenant reads fail without leaving an
  event, fact, or receipt;
- raw community text and raw offline payload/location fields are rejected.

### Native PostgreSQL

- two connections submit the same command and commit one result;
- competing revocations cannot fork the stream;
- independent idempotency keys cannot duplicate one deterministic fact;
- transaction/advisory locks preserve monotonic event sequence.

The opt-in native harness now includes E4 concurrent exact retry, changed-retry
rejection, append-only mutation denial, and replay after reconnect. It compiles
and lints, but has not run in this environment because no confirmed disposable
native PostgreSQL database is available. This remains an unmet gate.

### Provider Integration

- expired/tampered upload grant rejected;
- object checksum/version mismatch rejected;
- structurally valid but non-adapter-branded provider receipts rejected;
- scanner invocation refused until the exact object has a durable provider fact;
- external provider/scanner calls proven outside the durable transaction;
- exact retry returns the existing fact without repeating provider/scanner I/O;
- scanner timeout remains quarantined;
- metadata parser bomb is terminated;
- storage or scanner outage never promotes an object;
- credentials never enter response, event, receipt, log, or export.

## 13. Migration Strategy

1. Land E1 schema and adapter behind the existing production 503 guard.
2. Replay development fixtures into a disposable database; do not migrate
   process-memory state as institutional truth.
3. Run unit, PGlite, and native dual-connection tests.
4. Add provider-verification and privacy review.
5. Open only E1 routes through an explicit allowlist change and deployment
   security test.
6. Repeat per slice; do not open an entire prefix because one route is durable.

Existing consent rows with in-place revocation fields are development fixtures.
Migration converts each into one immutable receipt and, when revoked, one
separate revocation fact with an explicit legacy provenance marker. Rows lacking
hash/audit/actor evidence remain non-authoritative and are not silently promoted.

## 14. Rollback Strategy

- keep production route guards closed or restore the prior allowlist;
- stop provider grants and workers;
- preserve committed facts, semantic events, and receipts;
- use a forward compensating migration when dropping a schema would destroy
  audit evidence;
- revoke service audiences and ephemeral grants;
- leave canonical evidence verification and the rest of CanopyProof available;
- never fall back to process memory in enforced production mode.

## 15. Readiness Gate

E1, E2, E3a, E3b, and E4 are not production-ready until native PostgreSQL
concurrency, provider signature verification, real object-storage/scanner/
metadata/lifecycle integration, privacy review, least-privilege grants,
backup/restore, incident response, staffed review operations, and route-level
security tests all pass. E4 additionally requires a reviewed service-worker or
native sync client, conflict/recovery UX, and community retraction/supersession
policy. Every production route remains independently closed.
