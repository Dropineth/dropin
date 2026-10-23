# Child stewardship implementation and validation receipt

Updated 2026-10-23. This is reviewable engineering work, not product acceptance,
institutional authorization, a production deployment, or permission to collect
real child data. See [BASELINE.md](./BASELINE.md), the complete 178-row
[TRACEABILITY.md](./TRACEABILITY.md), and [BUILD.md](./BUILD.md).

## Source and scope

The restored authoritative specification was verified as 82,311 characters with
SHA-256 `d7bca48c07c7a04ce12efb5a8f33604b6b86cc69d7fffd9abf13f98ef8a8f503`.
Its private source and original received chunks remain outside this repository.
This sanitized receipt replaces the earlier incomplete-specification status.
The baseline is Dropineth/dropin `5d571e7e2736345d8c76717c66b564b60268ace1`,
branch `feature/child-stewardship-rights-20261023`.

Full development, tests and a reviewable draft PR are authorized. Merge and
production deployment still require the repository's actual independent human
review, final-head CI, maintainer attestation, sealed artifact, protected
environment approval and rollback checks. No such approval is manufactured.

## Implemented boundaries

- `learning.ts` implements closed synthetic identity, guardian consent and child
  assent, scoped task assignments, E0 observations, conservative freshness,
  policy-independent contribution keys, append-only corrections, protected
  complaints and independent appeal recusal. Every input is a fixed synthetic
  option or bounded reference. There are no name, birthdate, school, location,
  photo, biometric or free-chat fields. Pending privacy requests are never
  described as completed deletion.
- `authorization.ts`, `rights.ts` and `signature.ts` verify exact Ed25519 bytes,
  authoritative current credentials, actual operation-specific quorum and
  control-domain independence, versions, revocation, epochs, nonce, destination,
  purpose, amount, currency and time. They implement separate R/F obligations,
  reservations, conserved funding, synthetic payment outcomes, delegation,
  recovery, capacity transitions and special legal correction. Original vested
  terms survive policy changes; waiting notices bind the exact proposal.
- Hono routes authenticate opaque scoped tokens, recheck current authority,
  serialize optimistic revisions and idempotency, and atomically persist state,
  receipts, audit and outbox. Protected report revisions and deduplication do not
  disclose complaint existence to an implicated guardian. Demo tokens cannot
  invoke legacy routes; dedicated synthetic mode blocks legacy payment/wallet
  surfaces. Real provider adapters always reject.
- `PostgresChildStore` persists normalized records and reconstructs projections;
  it never falls back to snapshots or memory. Additive PostgreSQL migrations
  enforce tenant RLS, role scopes, immutable identity tuples, append-only facts,
  economic/nonce uniqueness, journal lineage and relational conservation checks.
  A separately scoped `ChildRightsVerifier` verifies real Ed25519 signatures and
  the full deterministic transition against locked current state; PostgreSQL
  admits only that exact mutation set. SQL does not itself verify Ed25519.
  The verifier has no runtime production credentials or mount. Token mappings
  are minted only in the session creation transaction and remain immutable.
  Missing schema, privileged database identity, missing/expired/revoked runtime
  role scopes, or unavailable authority produce unavailable status and HTTP 503.
  Migrations create no production roles or grants. Database-owner control and
  institutionally independent evidence remain external trust boundaries.
- `/stewardship` provides 35 Chinese/English synthetic screens, camera-free tasks,
  visible unavailable capabilities, stop/help, AES-GCM IndexedDB drafts and
  current scoped consent checks before the first POST byte. Withdraw/regrant
  cannot revive old draft authority. Restored drafts remain readable but cannot
  automatically acquire new upload authority across sessions. One-use suspend
  tickets invalidate active generations; resuming restores context only. Every
  observation, including an exact receipt retry, requires a current per-object
  upload capability. Its issuance sends only disclosed metadata and a digest;
  the payload is checked against that digest in the atomic submission transaction.
- The isolated WebAuthn fixture verifies actual ES256 registration/assertion
  signatures, RP/origin, UV, challenge, counters and current revocation with a
  separate verifier LOGIN. It does not establish real guardianship or expose
  production enrollment. See [WEBAUTHN.md](./WEBAUTHN.md).
- The privacy worker uses a separate restricted LOGIN and a bounded durable job
  drain. It removes actual local source/derived/index/cache/export/mirror copies,
  expires export bytes and backup copies, preserves C/R/F and minimal immutable
  receipts, and reprocesses expired holds. External processor copies remain
  waiting. Ordinary views and status do not reveal confidential holds. See the
  privacy SQL and native lifecycle tests; no production scheduler is enabled.
- The media fixture decodes real server-owned synthetic images with Sharp,
  applies orientation and strips metadata, limits dimensions/bytes, quarantines
  results, flags conservative pixel/perceptual duplicates, and requires a
  separate reviewer role before sanitized reads. An immutable complete fixture
  manifest prevents a SQL caller substituting arbitrary derived bytes. Raw or
  real user uploads remain unavailable. See [MEDIA.md](./MEDIA.md).
- The separate agent gateway verifies actual Ed25519 signatures and current
  ancestor delegation, consent and revocation before atomic durable nonce/output
  receipts. It returns bounded static, proposal-only product responses and retains
  minimal hashes rather than duplicate evidence content. Its optional router is
  unmounted. It does not claim live-model, official AHIN, PoCC or ChainRank
  interoperability. The CAI ontology is not product authorization.
- Restore admission verifies signed canonical checkpoint roots against a freshly
  read independent external checkpoint. Native tests actually dump and restore
  both a different database and the same database OID; stale admitted backups,
  old schema, revoked authority and stale deletion/hold evidence are rejected.
  Controlled restoration withholds runtime access until quarantine is committed.
  The external checkpoint cannot be supplied by the restored database itself;
  absent production evidence keeps this optional integration unavailable.
- Main API capacity is stored in PostgreSQL and isolated per authenticated actor.
  Two Hono instances share that actor's allowance; a hidden protection complaint
  neither changes the guardian's allowance nor lets guardian exhaustion block
  child/protector access. Rejected business operations do not refund capacity.
  Purpose-bound suspend/resume and gateway quotas commit independently of failed
  business work; cancellation remains a separate revocation lane. A bounded
  process-local storage circuit isolates actors and uses no cached authority or
  data fallback. Its fixed metadata-only signals use the existing global logger;
  actual alert routing and staffed response are not configured or claimed.

## Validation and reproducibility

Use the repository-pinned Node 22.22.3/npm 10.9.4. Focused tests do not replace
normal repository gates:

```sh
node --import tsx --test tests/unit/child-stewardship-*.test.ts
node --import tsx --test --test-concurrency=1 \
  tests/integration/child-stewardship-*.integration.ts
npm run lint
npm --workspace apps/web run cf:build
```

Native tests require `CANOPYPROOF_NATIVE_DATABASE_URL` pointing at a disposable
loopback test database and `CANOPYPROOF_NATIVE_TEST_CONFIRM` equal to
`confirm-disposable-test-database`. They create ephemeral local test roles and
exercise actual PostgreSQL, production store code and Hono. They do not use a
production connection, generated Prisma client, or an in-memory SQL emulator.
The existing `db:verify:native` gate retains its normal Prisma prerequisite.

The first committed checkpoint (`0ef47103`) passed 94/94 focused tests. Native normalized SQL,
actual adapter/Hono, concurrent budget/idempotency, rollback, tenant and direct
mutation tests passed 23/23 after independent-review fixes (20 authority,
two adapter/Hono, one SQL contract). Isolated strict TypeScript and scoped
ESLint passed. This includes true verifier signature rejection, ordinary-writer
self-admission denial, exact economic delta/omission checks, immutable token
mappings and closed late token minting, session revision rollback rejection,
and HTTP 503 after runtime database scope revocation.
Independent review found and prompted regressions for complaint probes,
appeal recusal, old-policy obligations, notice replay, pre-byte withdrawal,
database identity rewrites, registry publication and deferred role changes.

That checkpoint's web validation passed root lint, web TypeScript, production Next/OpenNext
and 16 local workerd routes. The artifact is a local dirty-source diagnostic,
not a release seal. The complete direct unit checkpoint was 1,061 tests:
1,044 passed, 17 failed, zero skipped. Missing generated Prisma symbols and
downstream API initialization explain those failures; no failures are waived.
The direct command avoids repeating the denied Prisma download and does not
satisfy the ordinary `npm test` gate. See BUILD.md for commands and artifacts.

System Chromium separately exercised all 35 screens against actual Hono/domain
code with an explicit `TestChildStore`: duplicate requests stored one observation,
withdrawal sent zero unauthorized observations, failed storage/reload did not
rebind old drafts, and there were zero third-party requests or page errors.
The later v5 fixture records Chinese/English screens, 400 kbps/400 ms network
diagnostics, mobile text zoom, contrast/focus samples, and all persistent writes
failing during offline withdrawal followed by restart. It requires fresh
object-specific approval even when an unused old resume ticket still works.
These checks are not the pinned three-browser suite, native-DB browser coverage,
actual Next artifact verification or human accessibility acceptance. The original
nine-test `VALIDATION.tap` is historical primitive-only evidence.

Audit receipts are outside the repository in
`/workspace/canopyproof-audit-report/`: `build/child-focused-final.tap`,
`build/child-native-final-combined.tap`, `build/unit-suite-final-summary.json`,
`build/final-opennext-inventory.json`, `child-ui/offline-tests.tap`, and
`child-ui/chromium-diagnostic.jsonl`. Failed test/fixture attempts remain in
external logs; subsequent focused passes do not rewrite them.

## Unified current validation

All 14 child native integration files passed **161/161** in one serial run;
all child unit files passed **118/118** using the normal root invocation.
These totals replace overlapping module counts as the current aggregate receipt.
Root lint, web TypeScript and 18 runner contracts passed. The full direct unit
suite remains **1,068/1,085 passing**, with the same 17 prior failures; API
TypeScript diagnostics likewise have no new normalized messages. These failures
remain release blockers. [BUILD.md](./BUILD.md) records exact receipts, first-run
fixture failures and the distinction from normal generated-Prisma gates.

The settled implementation includes native and actual Hono accounting, distinct
sponsor pools, deterministic retained rounding, whole-entitlement legal split/merge,
receipt/provider uniqueness and current post-lock scope checks. Synthetic policy
supports XTS and zero fees only; positive fees, other currencies and fractional
subdivision of a single entitlement remain unsupported. Real provider execution
is unavailable. [RIGHTS-ACCOUNTING.md](./RIGHTS-ACCOUNTING.md) defines the coverage.

## Remaining acceptance and release blockers

The normal Prisma generation/native/typecheck gate is blocked by denied engine
checksum downloads. The pinned browser installation is blocked by a denied
Chromium archive. Neither denial is retried through mirrors or bypass flags.
The prior denied GitHub Actions query and denied production configuration
reads are not retried. BUILD.md records exact targets and outcomes.

Real enrollment and verified guardianship/age/jurisdiction admission, independently
verified institutions, real-media safety and human review acceptance, live-model
evaluation, external processor/backup deletion receipts, staffed protection operations,
external funding/payment/carbon verification, human accessibility research and
real pilot acceptance remain unavailable or unverified. The traceability matrix
marks each boundary; synthetic fixtures do not satisfy these requirements.

WebAuthn cryptography, local media processing, native deletion and explicit
per-draft resumed-upload authorization are implemented and locally exercised;
they must not be described as missing code or as real-world acceptance. The
separate module documents record the newer checks. Final combined validation
has completed as recorded above; the clean fixed-HEAD build and new remote CI receipt are the next candidate checks.
The privacy/media rollback templates require an operator to stop the dedicated
workers and disable their scopes first; revoking PUBLIC grants alone does not
stop an explicitly granted service role. Draft and resume rollback functions
actively deny issuance/redemption while preserving histories.

Production durable storage, isolated service/verifier scopes and registry
provenance have not been demonstrated. The web Worker and API origin are
separate deployments; publishing web assets cannot publish the Hono backend.
No database migration, role grant, provider configuration, merge or production
deployment is performed by this receipt. Rollback preserves nonces, obligations,
audit and receipts; it cannot restore revoked authority or erase history.
