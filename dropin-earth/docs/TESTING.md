# CanopyProof Testing Standard

Status: active trust-kernel standard; local deterministic gates verified on
2026-07-17

CanopyProof must be tested as public climate accountability infrastructure, not
as a demo application.

## PostgreSQL Contract Verification

Run the focused database gate with:

```bash
npm run db:verify:canopyproof
```

The gate uses PGlite with the bundled `pgcrypto` extension to execute the full
`services/api/prisma/canopyproof-os.sql` contract twice against a fresh
PostgreSQL engine. Connector and bounded-authority integration tests also apply
their additive migrations, including `evidence-metadata-retention.sql` and
`evidence-offline-community.sql`. The evidence-media integration also applies
`evidence-media-adapters.sql` and `evidence-metadata-adapters.sql` twice. The Digital MRV integration applies
`mrv-graph.sql` twice to prove idempotency.
The gate then exercises real triggers and PL/pgSQL functions:

- missing `app.actor_id` mutation rejection.
- INSERT/UPDATE audit event generation with sequences `1,2,3`.
- TypeScript replay of PostgreSQL-generated length-prefixed event hashes.
- creation and independent replay of an append-only full-stream checkpoint.
- forged direct event rejection.
- audit-row update rejection.
- absence of raw `before_state` and `after_state` columns.
- E3b tenant isolation, restart replay, exact retry, rejected-write atomicity,
  SQL/TypeScript hash parity, modeled-provider non-promotion, legal-hold
  ordering, append-only mutation rejection, and non-empty rollback refusal.
- E3c metadata-extractor receipt, verification, command, fact, audit, and
  effective-projection root parity; immutable modeled-only E3b ancestry;
  recursive raw EXIF/GPS/signature/credential rejection; forced-RLS policy
  metadata; append-only mutation rejection; migration idempotency; and
  non-empty rollback refusal.
- E2a provider/scanner receipt, verification, command, and fact root parity;
  semantic-event and idempotency-receipt binding; forced-RLS policy metadata;
  migration idempotency; append-only mutation rejection; and non-empty rollback
  refusal.
- E4 atomic offline bundle completeness, device sequence/prior-root and source
  binding, exact/conflicting retry, tenant isolation, restart replay,
  SQL/TypeScript hash parity, unregistered-attester transaction rollback,
  hash-only non-final community context, append-only mutation rejection, and
  non-empty rollback refusal.
- mobile-sync admission migration idempotency, TypeScript/SQL denial-root
  parity, append-only denial facts, invalid-root rejection, forced-RLS tenant
  isolation, non-empty rollback refusal, and empty rollback execution.
- Digital MRV SQL/TypeScript endpoint, edge, snapshot, member, and Merkle parity;
  exact/conflicting retry; complete historical restart replay; source-root
  substitution rollback without orphan events; append-only rejection; forced
  RLS policy metadata; migration idempotency; and non-empty rollback refusal.
- canonical organization lifecycle migration replay, hash-only registration
  reference parity, exact/conflicting retry, current cross-organization human
  authority, reviewer/decider and appeal separation, guarded compatibility
  projection, explicit `NOLOGIN NOBYPASSRLS` tenant reads, append-only rows,
  registration-drift and stale-accreditation atomic rollback, terminal
  revocation, and empty/non-empty rollback behavior.
- Global Command Center deterministic source/approval/publication/audit roots,
  independent human governance, current source and credential re-resolution,
  exact/conflicting retries, atomic snapshot/publication/event/receipt commit,
  restart reconstruction, database audit capture, deferred rejection of a bare
  snapshot, update/delete rejection, non-empty rollback refusal, required
  per-region spatial shape, default-withheld behavior, and generalized-
  disclosure root binding. SQL expressions coalesce missing spatial members to
  false so JSON `NULL` cannot satisfy the table constraint.
- Global Command Center spatial-authority candidate/review/disclosure/control
  root parity, two distinct accredited human reviews, independent human
  publication and withdrawal, current source/actor rejection, atomic exact and
  conflicting retry, restart replay, forced-RLS policy metadata, missing-event
  and direct-mutation rejection, expiry/withdrawal without old-geometry
  fallback, migration idempotency, and non-empty rollback refusal.

This deterministic CI gate validates DDL ordering, idempotency, `pgcrypto`,
PL/pgSQL behavior, and cross-implementation hash compatibility. It does not
replace pre-production tests against native PostgreSQL with multiple physical
connections, role/grant enforcement, backup/restore, failover, and sustained
concurrent writers.

## Transactional Trust Registry Verification

The durable identity, organization-authority, agreement-governance,
purpose-bound data-access request/decision, and hash-only audit export manifest
write slices are covered by:

- `tests/unit/canopyproof-trust-registry.test.ts`: isolated domain hydration,
  deterministic replay, bounded idempotency keys, configuration secrecy,
  command-lock/receipt/stream-lock ordering, non-authoritative compatibility
  status in PostgreSQL mode, agreement and request-decision snapshot
  derivation, export-manifest deterministic root/tamper checks, exact route
  guard boundaries, and fail-closed unported downstream partner workflows.
- `tests/integration/canopyproof-postgres-audit.integration.ts`: semantic stream
  sequence/predecessor enforcement, transaction-actor binding, rollback when a
  domain mutation fails after event insertion, append-only reputation
  snapshots, immutable command receipts, participant deletion rejection,
  agreement source/event binding, append-only revocation, duplicate-revocation
  rollback, constrained supersession, immutable pending request facts,
  source/event binding, independent decision enforcement, and transaction
  rollback for rejected self-decisions.
- `tests/integration/canopyproof-trust-registry-pglite.integration.ts`: the
  actual `Prisma.sql` repository path over PGlite transactions, including
  organization registration, exact agreement replay, revocation-derived state,
  two-event supersession, exact request replay, approval/revocation projection,
  historical response replay, exact manifest replay, organization and sensitive
  read filtering, under-classification rollback, append-only rejection, receipt
  counts, and independent semantic-chain replay.

### Canonical Organization Lifecycle Authority

- `tests/unit/canopyproof-organization-lifecycle-authority.test.ts` covers
  deterministic lifecycle/review/appeal replay, exact registration-reference
  binding without raw registration disclosure, cross-organization human
  authority, reviewer/decider/governor/appeal/reinstater separation, terminal
  revocation, invalid transitions, stream forks, unsafe fields, and timestamp
  tampering.
- `tests/integration/canopyproof-organization-lifecycle-pglite.integration.ts`
  applies the additive migration twice and exercises the real serializable
  repository, exact/conflicting receipts, SQL/TypeScript roots, compatibility
  projection guard, append-only rows, explicit `NOBYPASSRLS` tenant isolation,
  stale accreditation, current registration drift without orphan events,
  restart replay, and empty/non-empty rollback behavior.
- This evidence does not activate a route, migrate the compatibility endpoint,
  invalidate sessions, backfill legacy profiles, or prove native
  multi-connection serialization. Those remain separate reviewed gates.

### Canonical Organization Accreditation Authority

- `tests/unit/canopyproof-organization-accreditation-authority.test.ts` covers
  deterministic application/review/decision/control replay, explicit approval
  and expiry projection, subject/reviewer/decider separation, stale policy and
  scope substitution, bounded validity, suspension plus fresh renewal,
  terminal revocation, timestamp canonicalization, tamper rejection, and unsafe
  claim text.
- `tests/integration/canopyproof-organization-accreditation-pglite.integration.ts`
  applies the additive migration twice and executes the serializable Prisma SQL
  repository. It checks four fact-family SQL/TypeScript roots, exact/conflicting
  receipts, current-membership drift with no orphan event, explicit expiry,
  suspension and renewal replay, terminal revocation, append-only mutation,
  `NOLOGIN NOBYPASSRLS` tenant isolation, and empty/non-empty rollback.
- The test governance actor is a deterministic route-closed root fixture. This
  proves the snapshot and transaction boundary, not a production
  root-governance ceremony or resolver. No compatibility accreditation row is
  used. Native multi-connection serialization, production grants, route
  migration, and session invalidation remain separate gates.

The opt-in native Prisma gate is:

```bash
# Inject the URL from an approved test secret store. Do not paste it into docs,
# reports, shell history, or CI logs.
export CANOPYPROOF_NATIVE_DATABASE_URL
export CANOPYPROOF_NATIVE_TEST_CONFIRM=confirm-disposable-test-database
npm run db:verify:canopyproof:native
```

The URL must use PostgreSQL and its database name must be explicitly marked
`test` or `ci`; otherwise the harness refuses to write. The harness applies the
base SQL contract plus the additive E2a, E3b, E3c, E4, MRV, and mobile-sync admission
migrations, opens two independent single-connection Prisma clients, and
checks exact concurrent retry, same-resource/different-key serialization,
conflicting retry rejection, FK-failure rollback, sequence continuity,
organization summary time, agreement creation/revocation/supersession,
receipt/event binding, concurrent offline-bundle and community-attestation exact
retry, changed-retry rejection, mobile consent-revocation versus binding fence
contention, append-only E4 mutation denial, disconnect, and replay after
reconnect. It also consumes 29 binding admissions and races two physical
connections at requests 30 and 31, proving exactly one allow and one immutable
denial; request 32 remains denied and the persisted actor/organization counts
and roots replay exactly. It does not reset or clean a database, so the target
must be disposable and uniquely provisioned for the gate.

PGlite validates SQL trigger and transaction semantics but is not evidence that
the Prisma/native wire path has passed. On 2026-07-17, the native gate passed
once against a newly initialized, disposable local PostgreSQL 17.10 cluster.
It exercised the complete two-connection trust, evidence, MRV, lifecycle,
governed ESG, public-transparency, governed Global Command Center publication,
and NASA GIBS
scenario, then the cluster was stopped and removed. This remains local
engineering evidence. That execution predates the E3c metadata-extractor and
governed Global Command Center publishing and spatial-disclosure changes; the
native harness now includes all three plus an explicit non-bypass spatial RLS
scenario, but its current path has not been rerun. Pre-production still needs a
clean reviewed-commit
GitHub Actions Node.js 22 run, reviewed role/grant enforcement,
migration/backfill, backup/restore, failover, and sustained-load drills.

The 2026-07-19 current foundation increment completed `npm run ci` under local
Node.js 24.14.0 with npm 10.9.4, 853/853 unit tests, 39/39 PGlite/PostgreSQL
contract scenarios, all workspace builds, and zero moderate-or-higher npm
audit findings. The current Node.js 24 all-source coverage ratchet measured
65.27 percent statements/lines, 73.83 percent branches, and 71.06 percent
functions. A clean reviewed-commit Node.js 22 run has not been executed for
this increment. The OpenNext Cloudflare build
completed under Node.js 22 with `.open-next/worker.js` and `.open-next/assets`
present. Local workerd returned `200` for the homepage, Global Command Center,
Explorer, Governance, Terra, and the required metadata assets. A prior focused
preview also exercised the dynamic Explorer project path. These are local build
facts, not production route, deployment, or institutional approval evidence.

## Browser-Local Evidence Vault Verification

`tests/unit/canopyproof-mobile-evidence-vault.test.ts` covers non-exportable
AES-GCM key use, randomized IVs and identifiers, deterministic payload hashes,
IV/ciphertext/AAD/record/key tamper rejection, quota without eviction,
idempotent binding/lease/retry/acknowledgement, competing lease clients, and
atomic deterministic legacy migration. `tests/unit/canopyproof-os-modules.test.ts`
asserts that `/mobile/report` uses the encrypted IndexedDB path, has no network
fallback, does not generate IDs with `Math.random`, and removes rather than
writes the legacy `localStorage` key.

The generated OpenNext Worker was also exercised in a real browser against
`/mobile/report`. The check observed an AES-GCM 256-bit secret non-exportable
`CryptoKey`, one 12-byte IV, an `ArrayBuffer` ciphertext envelope with no project,
latitude or field-note plaintext, deletion of the legacy value only after
migration, and successful draft recovery after reload. The test draft was then
removed; final IndexedDB draft count was zero, the legacy key was absent, and
browser error/warning logs were empty. This is local engineering evidence only:
server synchronization stayed closed and no field-device, XSS, storage-eviction,
cross-device recovery, or production transport claim is made.

## Authenticated Mobile Sync Verification

`tests/unit/canopyproof-mobile-evidence-sync.test.ts` covers browser/server hash
parity, deterministic bind and batch identities, raw-note exclusion, exact retry,
ambiguous-timeout recovery, changed-retry conflict, revoked consent, actor and
binding substitution, cross-actor recovery denial, default-closed client and API
paths, retryable outage, acknowledgement substitution, and rejection of
development identity or memory authorization before durable service resolution.
The client transport is injected; these tests do not mount `fetch` or a
background synchronization loop.

`tests/integration/canopyproof-evidence-media-pglite.integration.ts` composes the
real Trust Registry and E4 Prisma repositories. It appends the canonical
evidence registration, commits the next device-sequenced offline bundle, replays
the exact command and recovers the identical acknowledgement roots after durable
reload. It also proves that a binding exact-retry survives later consent
revocation, while a new binding is rejected and leaves exactly one mobile
command receipt and one evidence row. Actor/project/consent/device resolution
and evidence registration now execute in one serializable Trust Registry
command under subject and project advisory locks. This is database-level
engineering evidence, not authorization to enable the mobile-sync,
durable-admission, or governance gates. Activation still requires privacy,
Cloudflare edge abuse controls, field-device, recovery, reviewed transport and
operations evidence.

The opt-in native PostgreSQL gate now includes the mobile binding contention
case. One connection holds the custody stream lock and commits consent
revocation while a second connection has already entered the bind command. The
authority fence forces the stale serializable waiter to retry; the fresh attempt
observes `revoked`, rejects, and leaves zero matching evidence rows and zero
`evidence.mobile-binding.create` receipts. This closes the native contention
item above. The same native run passes the admission boundary race described
above. Privacy, edge abuse, field-device, recovery, transport and operations
evidence remain outstanding; an API-level limiter is not DDoS evidence.

## Repository Pull-Request Gate

The repository-root `.github/workflows/canopyproof-ci.yml` is the authoritative
CanopyProof pull-request gate authored for this slice. It:

- runs on pull requests and `main` pushes with read-only repository permission;
- pins Node.js 22 and npm 10.9.4 and installs the lockfile with optional native
  dependencies;
- executes `npm run ci` without weakening the moderate npm-audit gate;
- provisions a job-local PostgreSQL 17 database whose name is explicitly
  marked `ci_test`, supplies the required destructive-test confirmation, and
  executes the native two-connection authority gate;
- measures all first-party application, package, and service source files;
- builds and shape-checks the OpenNext Cloudflare Worker artifact; and
- exposes no deployment trigger, production environment, Cloudflare secret, or
  publish command. Mainnet transfers, protocol writes, automatic CANOPY
  distribution, admin proxying, and the NASA connector remain disabled.

The workflow file and its contract test are local implementation evidence only
until the change is committed and a repository-root GitHub Actions run passes.
No local result may be represented as a protected-branch or native PostgreSQL
CI pass.

## OpenNext Worker Runtime Verification

`@opennextjs/cloudflare` runs Next.js pages through the Worker Node.js
compatibility runtime. Page modules must not declare `runtime = "edge"`, and a
single-Worker deployment must not define split Cloudflare Edge page functions.
Middleware may continue to use its Web API runtime. The route contract tests
enforce this boundary because an unsupported split previously produced a
workerd dynamic-`require` failure even though compilation succeeded.

After `npm --workspace apps/web run cf:build`, run the generated Worker with
`npx opennextjs-cloudflare preview --port <unused-port>` and probe at least `/`,
`/dashboard/global`, `/explorer`, one dynamic Explorer project path,
`/robots.txt`, `/sitemap.xml`, and `/icon.jpg`. Compilation alone is not runtime
evidence. This local preview does not replace the guarded production smoke
suite or authorize deployment.

## Global Earth Renderer Verification

The `/dashboard/global` Earth view must be tested with a root-valid v2 Global
Command Center envelope; a visually plausible fixture with an invalid dashboard
root is not acceptable. The current focused unit and PGlite tests cover:

- strict unknown-key rejection and absence of raw latitude, longitude, GPS
  accuracy, and scene bounding-box fields;
- one-degree coordinate bounds, current region source-root and project-count
  binding, minimum cohort size, independent review roots, validity intervals,
  duplicate/absent region rejection, and deterministic spatial/region/dashboard
  root replay;
- default-withheld behavior and challenged, active-risk, monitored, then
  registered marker-state precedence;
- one `THREE.InstancedMesh` path, no per-marker `new THREE.Mesh`, no erroneous
  `meshBasicMaterial vertexColors` multiplier, SSR-disabled lazy loading, and a
  stable mobile-height fallback.

The 2026-07-17 in-app browser run used desktop and 390-by-844 mobile viewports.
It observed nonblank correctly framed WebGL output, one
`drawElementsInstanced` call for approved markers, no horizontal overflow or
section overlap, and 60 OrbitControls drag-triggered draw calls whose sampled
framebuffer hashes changed. The browser interception and test tab were removed
afterward. This is local renderer evidence; it is not production browser,
assistive-technology, safeguarding, or device-fleet certification.

## Evidence Media Intake Adapter Verification

Focused tests cover the default-off object-storage and malware-scanner
boundaries:

- grant provider, intent root, content-addressed key, allowlisted HTTPS host,
  decoded URL path, PUT method, declared/SigV4 expiry parity, credential scope,
  signed-header set, duplicate-header denial, content type, byte length, and
  exact S3 SHA-256 checksum binding;
- independent stored-object provider/namespace/key/version/content/time,
  encryption, retention-policy, ETag, receipt-root, and server-computed provider
  verification-root binding;
- cross-object, cross-provider, cross-namespace, stale, malformed, and
  content-substitution rejection;
- canonical scanner findings, object/provider receipt binding, approved signer
  and receipt-age policy, valid and invalid Ed25519 signatures, unknown keys,
  private-JWK rejection, raw-signature minimization, and signature-hash-bound
  verification roots;
- additive verification facts with exact SQL/TypeScript receipt and root parity,
  append-only/RLS/audit controls, idempotent command receipts, a receipt-only
  trust projection, and fail-closed rollback;
- route-closed two-phase orchestration with no external I/O inside a database
  transaction, atomic modeled-base plus verification commits, and separate base
  and adapter semantic streams;
- runtime-brand loss under object spread, forged receipt rejection, raw scanner
  signature minimization, provider-before-scanner preflight, and database-level
  repetition of that prerequisite;
- exact retry without a second provider HEAD or scanner call, explicit cross-
  tenant read denial, restart replay, and SQL/TypeScript root parity through the
  production trust-registry methods;
- disabled adapter failure with no in-memory or caller-verified fallback; and
- default `503` for legacy Evidence Network routes, including proof that the
  development flag cannot open them in production mode.

The runtime suite additionally exercises a production-shaped but constructor-
only R2/HTTP boundary with deterministic non-secret fixtures:

- fixed account/bucket virtual-hosted R2 URLs, deterministic SigV4 query
  signing, signed content-type/checksum constraints, and secret-free outputs;
- Workers R2 binding `head()` normalization for exact key, provider version,
  byte length, content type, ETag, upload time, and provider SHA-256;
- wrong-key, missing-checksum, namespace-substitution, and secret-bearing
  provider failure rejection;
- fixed Cloudflare bucket-lock management routing, strictest matching finite
  rule selection, deterministic policy binding, modeled-only fallback, and
  rejection of indefinite, expired, duplicate, compressed, oversized,
  timed-out, cross-object, or unbranded policy observations;
- one fixed public HTTPS scanner endpoint with redirects disabled, no caller-
  supplied URL, minimized object locators, bounded timeout, uncompressed JSON,
  declared/actual byte-length parity, and streamed overflow rejection;
- end-to-end scanner transport, receipt hashing, registered Ed25519 verification,
  and frozen verified-receipt composition; and
- orchestrator evidence that provider outage cannot reach a durable commit.

These remain deterministic provider tests. No real R2 bucket, live bucket-lock
policy observation, scanner deployment, browser upload, production route,
credential, network call, or staffed quarantine operation is claimed.

## Device Attestation Provider Verification

Focused E1a tests use ephemeral Ed25519 keys and deterministic provider
fixtures only. They cover exact receipt and challenge binding, unsupported
provider/type pairs, private-JWK and signature substitution, cross-device
replay, copied runtime brands, rejection facts, strict historical evaluation,
verification/base/consent expiry, consent revocation, risk precedence,
effective projection tampering, exact challenge replay, independent renewal,
SQL/TypeScript root parity, restart replay, forced RLS, append-only mutation,
migration idempotency, and non-empty rollback refusal. The executed PGlite
database gate includes E1a before E2a/E3b/E3d/E4. No live device protocol,
nonce service, provider credential, production route, or activation is used.

## Evidence Metadata Extraction Adapter Verification

Focused tests cover the default-off signed, minimized metadata-extraction
boundary and its additive E3c authority:

- one fixed public HTTPS provider endpoint, immutable object locator, exact
  object/media/consent/device/GPS/privacy bindings, pinned extractor image,
  schema, policy, signer registry, and bounded observation window;
- strict receipt allowlisting that rejects raw EXIF, raw GPS, coordinates,
  credentials, URLs, arbitrary nested fields, unsupported claims, private key
  material, stale or future timestamps, and output-root substitution;
- canonical receipt hashing and allowlisted Ed25519 verification using public
  JWKs only, with private-JWK, cross-key, malformed, and non-canonical
  signature rejection;
- private runtime branding that is lost on spread or serialization, plus
  independently recomputed source projection roots before an E3c fact can be
  built;
- immutable modeled-only E3b facts plus separate E3c verification facts,
  signature minimization to a hash, dedicated adapter-stream semantics, exact
  SQL/TypeScript root parity, forced RLS, append-only enforcement, and
  fail-closed rollback; and
- deterministic effective projection that removes only
  `metadata_provider_verification_pending`; all device, media, accuracy, clock,
  consent, and review issues remain authoritative.

Tests use generated public keys, signed fixture receipts, and injected fetch
responses only. No real media, parser image, storage access, credential,
provider call, route, or production composition root is used. The adapter also
requires effective-media v2 to be `available`, including an E1a `current`
device projection and E2a verified receipts. Fixture orchestration reaches that
gate deterministically; live durable orchestration remains unmounted until the
provider, nonce, privacy, operations, and field-validation gates are approved.

## Managed Signature Verification Runtime

The constructor-only AWS KMS suite uses a deterministic mock transport and no
real credential or provider call. It covers:

- one fixed account, partition, Region, organization, full asymmetric key ARN,
  governance key-version label, protocol algorithm, and purpose;
- SigV4 `GetPublicKey` and `Verify` requests only, with no `Sign` target or
  private-key operation;
- exact `SIGN_VERIFY`, key-spec, signing-algorithm, DER SPKI SHA-256, provider-
  attestation, digest-byte, signature-byte, key, and response binding;
- explicit `ES256 -> ECDSA_SHA_256/DIGEST`,
  `RSA_PSS_SHA256 -> RSASSA_PSS_SHA_256/DIGEST`, and
  `Ed25519 -> ED25519_SHA_512/RAW` mappings;
- deterministic receipt hashes and signing-algorithm ordering;
- organization, key, version, public-key, attestation, key-usage, key-spec,
  algorithm, and cross-key response substitution rejection; and
- redirect denial, timeout, compression, media type, content length, streamed
  response cap, request-ID, negative verification, non-canonical base64url, and
  forged-error-name failure behavior with stable secret-free errors.

This proves local boundary behavior only. No AWS key, IAM policy, CloudTrail
retention, live provider response, key ceremony, route, composition-root
selection, certificate activation, or production deployment is claimed.

## OpenTelemetry Export Boundary Verification

```bash
node --test --import tsx \
  tests/unit/canopyproof-opentelemetry-exporter.test.ts \
  tests/unit/canopyproof-observability-deployment.test.ts
```

The focused suite proves default-off/no-network behavior, fail-closed protocol
and endpoint configuration, private-HTTP host restrictions, rejection of URL
credentials and secret-bearing header config, exact OTLP JSON base64 byte
fields and numeric enums, actor/request-ID minimization, deterministic sampling
and retry jitter, base-endpoint path construction, finite queue pressure,
finite retry, timeout abort, redirect denial, permanent rejection, oversized
payload drop, exporter counters, route-template privacy, and malformed
`traceparent` rejection. It uses mock `fetch` only and no Collector, telemetry
vendor, credential, or production network call.

This does not prove backend acceptance, durable delivery, transport security,
retention, dashboarding, SLOs, alerts, Worker/DB/job traces, or production
activation. Those remain separate gates under
`docs/RFC_OBSERVABILITY_EXPORT_PIPELINE.md`.

## Cloudflare Edge Trace Verification

```bash
node --test --import tsx \
  tests/unit/canopyproof-edge-observability.test.ts \
  tests/unit/dropin-cloudflare-deployment.test.ts
```

The suite proves strict version-00 parsing, all-zero/malformed context denial,
Web Crypto-only identifiers, edge-to-origin parent construction, caller sample
bit override, deterministic bounded sampling from the random edge span ID,
default-off/no-network behavior, strict HTTPS endpoint policy, rejection of
secret-bearing and unsupported OTLP configuration, exact OTLP JSON byte fields
and numeric enums, privacy allowlisting, finite payload and timeout behavior,
transport/rejection containment, and rejection-safe `waitUntil` scheduling.

Proxy integration tests prove the API response does not await the telemetry
transport, malformed or caller-sampled context cannot bypass policy, Access and
authorization fixture values do not enter OTLP, upstream and exporter outages
remain independent, and admin/invalid-config paths perform no upstream or
telemetry I/O. All export transport is mocked; no Cloudflare deployment,
Collector, vendor, credential, or production endpoint is used.

## Coverage Target

Target: greater than 90 percent meaningful coverage across production modules.

The repository now exposes a threshold-free `npm run test:coverage` measurement
and a fail-closed `npm run test:coverage:ratchet` gate. Both use pinned
`c8 --all` and include every TypeScript/TSX file under `apps/*/src`,
`packages/*/src`, and `services/*/src`, including files never loaded by the
unit suite. Declaration files are excluded. A controlled unimported-source run
reports zero percent, preventing test-count inflation from hiding untouched
production modules.

The current local CI-runtime baseline on 2026-07-19 with Node.js 24.14.0, npm
10.9.4, and the 853-test unit suite measured:

- statements/lines: 65.27 percent (109,281 / 167,408);
- branches: 73.83 percent (16,056 / 21,746);
- functions: 71.06 percent (5,951 / 8,374).

An earlier local Node.js 22.22.3 run measured 65.83 percent statements/lines,
73.58 percent branches, and 70.80 percent functions against an older source
denominator. The runtime-specific V8
instrumentation difference is why coverage evidence always records the Node.js
version.

This is a measured shortfall, not a pass against the greater-than-90-percent
target. The bootstrap ratchet enforces 65 percent statements/lines, 72.75
percent branches, and 69.5 percent functions locally. Those values are only
non-regression floors; the first clean reviewed-commit GitHub Actions Node.js 22
run must establish the authoritative remote baseline and tighten them to the
largest stable values. The
workflow preserves both a text log and `coverage/coverage-summary.json` and
fails if either is absent. This report also does not substitute for native
database, browser, external-adapter, or chaos coverage.

Coverage must include:

- unit tests for pure domain logic.
- integration tests against PostgreSQL-backed repositories.
- security tests for authorization, unsafe claims, evidence fraud, and edge
  route boundaries.
- E2E tests for public web, mobile evidence, partner, ESG, funding, certificate,
  and risk workflows.
- chaos tests for database, API, queue, object storage, satellite connector, and
  edge failures.

## Required Attack Scenarios

### Fake Evidence Attack

Test:

- copied media hash.
- synthetic or malformed EXIF.
- unsupported timestamp.
- contributor without settlement-grade identity.
- object-storage media with missing encryption, pending scan, quarantine, or
  duplicate content hash.
- metadata extraction attempted without active consent or active device
  attestation.

Expected result:

- evidence is quarantined or marked pending review.
- a moderation review task is opened for non-final media or metadata artifacts.
- no certificate is issued.
- audit event is written.

### Duplicate Planting Attack

Test:

- same media hash across reports.
- nearby geospatial duplicate.
- same contributor/device repeated across projects.
- same offline evidence ID replayed with conflicting media or GPS hashes.

Expected result:

- duplicate candidate created.
- verification task opened.
- conflicting evidence ID reuse becomes a challenge and does not overwrite the
  original envelope.
- duplicate media object remains non-final and references the original media
  object instead of silently becoming clean proof evidence.
- funding and certificates remain blocked until review.

### GPS Spoofing

Test:

- GPS coordinate conflicts with EXIF, device, or satellite expectation.
- low-accuracy GPS is submitted as precise proof.
- consent is revoked before a later metadata extraction request.
- device attestation includes `location_mocking`, clock skew, or low reputation.

Expected result:

- confidence reduced.
- human review required.
- proof cannot finalize from GPS alone.
- revoked consent blocks future extraction, while risky device extraction
  creates a `needs_review` metadata record.
- revoked consent and elapsed retention windows create append-only retention
  policy decisions rather than silent deletion.

### Satellite Contradiction

Test:

- field report claims restoration while TerraProof scene indicates land-change
  contradiction.

Expected result:

- contradiction event is recorded.
- reviewer must resolve with rationale.
- public record shows disputed or pending state until resolved.

### Unauthorized Admin Access

Test:

- public `/api/admin/*` through Cloudflare route.
- direct API origin admin mutation without authorized identity.

Expected result:

- public edge returns 403.
- origin rejects unauthorized mutation.
- no state change.
- security audit event or alert is emitted where applicable.

### Identity Assertion Spoofing

Test:

- send production requests with only client-controlled
  `x-dropin-actor-id`, `x-dropin-actor-role`, or organization headers.
- submit missing, malformed, expired, future, wrong-issuer, wrong-audience, or
  ambiguous-role Access assertions.
- configure `development_headers` while CanopyProof or Node is in production.
- pass a valid signed subject through telemetry, actor-keyed rate limits, RBAC,
  and ABAC organization scope.
- reuse an otherwise valid token after participant, membership, organization,
  or accreditation suspension/revocation.
- present an organization claim with no exact actor/role membership, or a role
  that differs from the durable membership.
- return a latest accreditation row that disagrees with the organization
  summary, and simulate authorization-registry outage.

Expected result:

- the Cloudflare proxy removes raw actor and organization headers.
- the API origin accepts only an independently verified Access JWT in
  production and never echoes token or JWKS material.
- missing or invalid identity returns 401; durable authority denial returns
  403; registry outage or integrity mismatch returns 503.
- the next PostgreSQL lookup observes membership revocation, while the previous
  active state remains recoverable through the append-only audit stream.
- public status remains anonymous and read-only.
- production development-header mode fails closed before any actor is trusted.

### Database Failure

Test:

- mutation succeeds but audit append fails.
- audit append succeeds but domain mutation fails.
- database connection drops mid-request.

Expected result:

- transaction rolls back or creates a clearly recoverable retry state.
- no partial certificate/funding/evidence state is exposed as final.

### API Outage

Test:

- web available while API is unavailable.
- evidence sync retries after outage.
- exact offline sync retry with the same `Idempotency-Key`.

Expected result:

- public UI degrades read-only.
- offline evidence remains queued.
- no duplicate mutation after retry.

### Verification Queue Backpressure

Test:

- Evidence -> Validation -> AI Analysis -> TerraProof -> Human Review -> Proof
  Issuance pipeline is planned with deterministic dependencies.
- human review is started before advisory AI or TerraProof dependencies
  complete.
- active work reaches configured queue capacity.

Expected result:

- unmet dependencies move work into `blocked` with a dependency reason code.
- backpressure rejects new work without dropping existing evidence.
- AI work remains advisory and cannot complete proof issuance without human
  review.
- completed work reduces active pressure without mutating prior audit history.

Implemented coverage:

- `tests/unit/canopyproof-resilience-chaos.test.ts` records database partial
  write drills, API-origin outage drills, retry/idempotency failures, RBAC
  enforcement, Prometheus metrics, and append-only SQL contracts.
- `tests/unit/canopyproof-verification-queue.test.ts` covers queue pipeline
  planning, dependency blocking, capacity backpressure, transition APIs, and
  RBAC boundaries.

### Community Verification Boundary

Test:

- community support attestation.
- community challenge attestation.
- community actor attempting to finalize proof.

Expected result:

- attestation is appended as audit history.
- challenge returns evidence to human review.
- no community attestation can issue a proof record, release funds, or create a
  public impact claim.

Implemented coverage:

- `tests/unit/canopyproof-evidence-offline-community-authority.test.ts` checks
  contiguous offline lineage, consent/device/evidence substitution denial,
  exact replay, self-attestation denial, role boundaries, hash-only statements,
  non-final projection, and tampered replay rejection.
- `tests/integration/canopyproof-evidence-media-pglite.integration.ts` executes
  the additive E4 migration twice, commits/replays offline and community facts,
  tests conflicting retries, cross-tenant reads, SQL/TypeScript parity,
  unregistered-actor rollback, append-only triggers, restart replay, and
  fail-closed rollback.

### Digital MRV Graph Boundary

- `tests/unit/canopyproof-mrv-graph-authority.test.ts` verifies complete
  historical snapshots, review-required coverage, AI advisory limits,
  substituted-root/cross-tenant/self-edge/duplicate denial, independent review,
  future-edge-safe restart ordering, and semantic payload substitution failure.
- `tests/integration/canopyproof-mrv-graph-pglite.integration.ts` executes the
  additive migration twice, persists edge and snapshot bundles through the real
  repository path, checks exact and conflicting command retries, restarts from
  PostgreSQL, rejects a self-consistent domain fact with a substituted source
  root inside the SQL trigger, proves failed-write atomicity and immutable rows,
  inspects forced RLS policies, and rejects destructive non-empty rollback.
- The native harness applies `mrv-graph.sql`; native dual-connection MRV writer
  behavior is still pending and is not represented as runtime evidence.

### Public Transparency Authority

- Unit replay covers independent privacy review and publication, sensitive and
  restricted withholding, coordinate/identity/signature exclusion, actor and
  tenant substitution, challenge/lifecycle state propagation, deterministic
  roots, and tampered fact/projection/safety rejection.
- The PGlite authority path applies the migration twice, persists review and
  publication through `SERIALIZABLE` repository transactions, proves exact and
  conflicting retries, SQL/TypeScript command/fact/root parity, restart replay,
  failed current-source write atomicity, database audit, update/delete
  rejection, and non-empty rollback denial.
- RLS is exercised under an explicit `NOLOGIN NOBYPASSRLS` reader; PGlite's
  default superuser is not used as cross-tenant evidence. Empty rollback is
  tested in a separate database.
- A disposable native PostgreSQL 17 run exercises dual-connection exact retry,
  SQL/TypeScript root parity, an explicit `NOLOGIN NOBYPASSRLS` reader,
  append-only mutation rejection, transaction-scoped challenged projection,
  and reconnect replay. This local run is not production migration or
  operations approval.

### Funding Accountability Authority

- `tests/unit/canopyproof-funding-accountability-authority.test.ts` covers
  deterministic candidate/review/publication/control roots, safe integer-cent
  conservation, sorted and unique evidence/proof members, three independent
  accredited humans, unsafe-key and unsupported-claim rejection, exact project
  scope, and challenge/withdrawal/expiry without fallback.
- `tests/integration/canopyproof-funding-accountability-pglite.integration.ts`
  applies the migration twice, persists review/publication/control facts through
  the real serializable repository, proves exact and conflicting retries,
  transaction-owned current-authority rejection, restart replay, SQL/TypeScript
  root parity, semantic-event and row-audit cardinality, append-only mutation
  rejection, missing-event denial, forced-RLS catalog state, tenant-scoped reads,
  empty rollback, and non-empty rollback refusal.
- PGlite runs as the database owner and is not accepted as effective RLS or
  concurrency evidence. A confirmed disposable native PostgreSQL database with
  a `NOBYPASSRLS` role and dual writers remains an activation requirement.

### Canonical Project Lifecycle Source Resolver

- `tests/unit/canopyproof-canonical-project-lifecycle-resolver.test.ts` proves
  exact verified-human subject reconstruction, complete active funding roots,
  complete Environmental Proof roots, adverse-proof refusal, all-accepted
  post-verification monitoring composition, policy drift handling, and
  fail-closed closure/restoration behavior.
- `tests/integration/canopyproof-project-lifecycle-pglite.integration.ts`
  applies the source-resolver migration twice, creates a real governed
  `project_lifecycle` policy, proves current membership revocation aborts the
  registration without orphan facts/events/receipts, and commits the same
  command after reactivation. It also proves non-empty rollback refusal once a
  lifecycle policy exists.
- The broader project-lifecycle PGlite suite still covers deterministic replay,
  SQL/TypeScript root parity, exact/conflicting retries, semantic-event
  cardinality, append-only mutation denial, forced-RLS catalog state, and
  atomic current-source rejection. Native PostgreSQL `NOBYPASSRLS`, concurrent
  writers, backup/restore, and activation remain separate required evidence.

### Canonical Early-Warning Authority

- `tests/unit/canopyproof-early-warning-authority.test.ts` verifies deterministic
  sorted source/indicator roots, exact integer-scaled threshold evaluation,
  unsafe and duplicate input rejection, agent preparation without machine final
  authority, three-human separation, rejected-review denial, predecessor
  continuity, and challenge/withdrawal/expiry without fallback.
- `tests/integration/canopyproof-early-warning-pglite.integration.ts` applies
  the additive migration twice, commits two reviews, one publication, and one
  challenge through the real serializable repository, and proves exact and
  conflicting retries, current-authority re-resolution, tenant-scoped restart
  replay, SQL/TypeScript root parity, semantic-event and row-audit cardinality,
  forced-RLS catalog state, missing-event rejection, append-only mutation
  denial, and empty/non-empty rollback behavior.
- The PGlite path caught a PostgreSQL JSON/operator-precedence defect in source
  ordering before any route was mounted. It remains database-owner execution,
  not evidence of effective `NOBYPASSRLS`, dual-writer serialization, live feed
  authenticity, notification delivery, emergency operations, or production
  activation.

## Required Workflow Tests

- `/dashboard/global`: read-only global impact view renders only a strict
  `postgresql_append_only_snapshot` envelope; missing, compatibility, malformed,
  or root-inconsistent sources fail closed without static values.
- `/mobile/report`: offline evidence draft syncs idempotently.
- `/terra`: satellite layer metadata includes provenance and processing version.
- `/reports/esg`: draft report exports JSON/PDF only after lineage validation.
- `/partners`: RBAC gates organization member operations.
- `/funding`: milestone release requires accepted evidence and approval.
- `/risk`: alert acknowledgement and escalation write audit events.

## Release Gate

No production module is complete until:

- unit, integration, security, and E2E tests pass.
- relevant chaos test exists or a tracked exception is approved.
- unsafe claim scans pass.
- `/api/admin/*` remains blocked publicly.
- no mainnet funds, automatic CANOPY distribution, certified carbon-credit
  claim, carbon-tax offset claim, or guaranteed-yield claim is introduced.
