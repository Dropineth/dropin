# Child stewardship build validation

This records local engineering evidence, not production approval. The authoritative
private specification stays outside the repository. Its restored SHA-256 is
`d7bca48c07c7a04ce12efb5a8f33604b6b86cc69d7fffd9abf13f98ef8a8f503`.

## Remote checkpoint status

The parent coordinator independently read the existing connected GitHub source
for draft PR 16 at `0ef47103d447feb5c9677c72f021bad66f345baf`:
[Life++ web run 39891681950](https://github.com/Dropineth/dropin/actions/runs/39891681950)
and [Trust Gate run 39891681989](https://github.com/Dropineth/dropin/actions/runs/39891681989)
both completed with **failure**. The parent inspected their logs: checkout,
dependency installation, build, database and coverage prerequisites passed.
The Life++ browser runs and Trust workerd run each reported 149 passed and
24 failed checks: 22 English LifeShell mobile-width checks (375/390 px viewport,
394 px document width) and two English partners-page reflow-width checks.
The latter failed on width, not on typing or Tab behavior. These remote failures
are distinct from this container's denied Prisma binary download. The true
overflow element was measured and the UI owner applied a wrapping correction.
The old-artifact CSS-injection diagnostic is not final artifact acceptance; no test is waived.
These are not passes, nor results for later uncommitted source. No rerun was
requested here and the earlier denied Actions query was not repeated.

## Current suite ownership checkpoint

The native script now registers all 14 currently existing child-stewardship
integration files, including both distinct `draft-authority` (direct SQL) and
`draft-authorization` (Hono) suites, admission-clock, media, agent-gateway,
rate-limit and restore. A filesystem reconciliation found no unregistered file
and no registered nonexistent path. Recheck this inventory at the final source
freeze.

The actual built Next/OpenNext privacy probe now runs against the existing
workerd browser runner's owned loopback server after Life++ and MapLibre.
`CHILD_NEXT_PRIVACY_REQUIRE_GUARD=1` makes privacy headers mandatory, and the
JSON report is retained inside candidate-bound `browser-workerd` evidence.
The acceptance runner rejects a system-Chromium override. The collector
positive-control probe is included in the existing synthetic browser matrix as
a clearly labelled component fixture; it is not a substitute for the artifact
probe. No existing browser route or release gate is removed.

Runner and suite ownership contracts pass 18/18, including propagation of a
failure from each of the three workerd browser children and shutdown cleanup;
scoped lint passes. Evidence: `privacy-runner-contracts.log` and
`privacy-runner-lint.log` outside the repository. These are runner checks while
application writers remain active, not final application acceptance. Full
current-source tests/build still await the explicit write freeze.

## Supported dependency update

On 2026-10-23, the installed baseline OpenNext AWS 4.1.0 helper returned `false`
for `isNextVersionSupported("15.5.27")`. This is an executed support check, not a
claim that a complete baseline build ran.

The official [AWS 4.1.12 release](https://github.com/opennextjs/opennextjs-aws/releases/tag/v4.1.12)
corrects the support check to retain a major version until its second successor
is released. The [Next support table](https://nextjs.org/support-policy) lists
Next 15 as Maintenance LTS. The current
[Cloudflare adapter package](https://www.npmjs.com/package/@opennextjs/cloudflare/v/1.20.13)
explicitly requires Next `>=15.5.28 <16 || >=16.4.1` and Wrangler `^4.148.0`.
Its exact AWS dependency is 4.1.12. Published package metadata dates Cloudflare
1.20.13 to 2026-10-21T13:23:57.069Z.

The isolated update is Next 15.5.27 → 15.5.28 in the root and three existing
application manifests, Cloudflare adapter 1.20.2 → 1.20.13, and Wrangler
4.120.1 → 4.148.0. Existing dependency overrides remain in force. The lockfile
also captures the adapter/CLI transitive changes; no unsupported-version flag,
clock modification, or package-manager switch is used.

| Lock | SHA-256 |
| --- | --- |
| Baseline | `fcc2893c2b973f3258ea14d091f34dfd8dd47cca21d31ac131856cee094d9586` |
| Updated | `d72b4764118e51400d9dc33f1af5cd25c350969c2b94c8fe60e4fd8e59251ce3` |

The update changes 171 package-path records, including added/removed
transitive paths. Detailed machine-readable evidence is kept outside the
repository at `/workspace/canopyproof-audit-report/build/lock-delta.json`.

The current audit also required Hono 4.13.7 → 4.13.13 and the existing Anchor
TOML override 4.2.0 → 5.0.1. The [Hono advisory](https://github.com/honojs/hono/security/advisories/GHSA-5r4p-p66f-jhc7)
identifies a static-path authorization bypass fixed in 4.13.11. The
[TOML 5.0.1 release](https://github.com/BinaryMuse/toml-node/releases/tag/v5.0.1)
fixes resource-consumption advisories affecting versions through 5.0.0. Existing
Anchor config and prototype-pollution tests pass, plus new bounded-process
large-table/integer tests and an actual Hono static-route rejection test. The
security update was installed with scripts disabled to avoid repeating the
denied Prisma engine download.

Native adapter tests use exact development dependencies `pg@8.23.1` and
`@types/pg@8.23.1`. The production adapter retains the existing Prisma client.
The driver installation used `--ignore-scripts`; it does not repair or bypass the
blocked Prisma generator. The official node-postgres guidance requires
[parameterized values](https://node-postgres.com/features/queries) and a
[single checked-out client per transaction](https://node-postgres.com/features/transactions).

## Post-checkpoint WebAuthn dependency

After checkpoint `0ef47103d447feb5c9677c72f021bad66f345baf`, the API adds exact
`@simplewebauthn/server@14.0.3`. The [official release](https://github.com/MasterKale/SimpleWebAuthn/releases/tag/v14.0.3)
was published to npm on 2026-09-25T17:10:28.463Z. The
[server documentation](https://simplewebauthn.dev/docs/packages/server) supports
Node 22 and higher; package metadata requires Node >=20, so pinned Node 22.22.3
satisfies both. The package has no lifecycle scripts; none of the 25 added or
changed lock records declares an install script. Installation used
`npm install --workspace services/api --save-exact --ignore-scripts --no-audit
--no-fund @simplewebauthn/server@14.0.3`. Runtime import confirms all four
registration/authentication option and verification functions are available.

The new lock SHA-256 is
`f476496fc4f332c997f83e7dc949feb0d02a5b3860268bbc17afd808eb8670df`.
The new audit passes with zero vulnerabilities and supply-chain gate passes
with 759 SBOM components. Evidence files are `simplewebauthn-metadata.json`,
`simplewebauthn-install.log`, `simplewebauthn-import.log`,
`webauthn-lock-delta.json`, `audit-webauthn.log`, and
`supply-chain-webauthn.log` in the external build report directory.

The prior build results below predate this lock and the subsequent modules;
they do not validate these new changes. A build started at the checkpoint was
subsequently classified by its owner as mixed-source because UI source changed
before its end fingerprint. No fixed-SHA seal was asserted. Final module tests
and a build with all source writes frozen remain pending.

## Native media dependency and suite registration

The synthetic media module uses `sharp@0.35.5`, already present in the locked
Next dependency tree. It is now an exact direct API runtime dependency so API
production installation does not rely on a web transitive dependency. The
[official installation guidance](https://sharp.pixelplumbing.com/install/) and
[0.35.5 release](https://github.com/lovell/sharp/releases/tag/v0.35.5) support the
pinned Node environment. Installation used `--ignore-scripts` and added no
packages. An actual 8×8 synthetic PNG encode/decode passed with Sharp 0.35.5 and
libvips 8.18.7 (`sharp-runtime-smoke.json`); this is a dependency smoke test, not
media-pipeline or real-upload acceptance.

The current lock SHA-256 is
`91a6fb5be842a5aab07a0a2e5ba1b100412c7f6760e7017b4950ceeb95f24e5b`.
The WebAuthn, privacy, privacy-authority and resume native suites are registered
under the existing native gate. Suite ownership contracts pass 6/6. The normal
Prisma prerequisite is unchanged and blocked: no private generator,
`skipDownload`, preflight modification, fabricated client, checksum suppression,
alternate engine download, or experimental engine migration is used.

## Reproduction environment

Validation uses Node 22.22.3 and npm 10.9.4, matching the acceptance workflows.
The official Node Linux x64 archive was checked against its SHA256SUMS entry:
`2e5d13569282d016861fae7c8f935e741693c269101a5bebcf761a5376d1f99f`.
Toolchain binaries and caches are isolated outside the repository. The root's
existing `packageManager` declaration is pnpm; the actual checked release
workflows use npm, which this validation follows without changing that policy.

Disposable native PostgreSQL runs only on loopback port 55432, using the
official PostgreSQL 17 Alpine image pinned to digest
`sha256:eee6c6e1b0894fa4fe0075eb054af9fd1cf39a35321c2d4110626cfe506411fb`.
No production database is involved. Native PostgreSQL tests and PGlite tests
are reported separately.

## Results

All following local commands used Node 22.22.3/npm 10.9.4. Logs and JSON evidence
are preserved under `/workspace/canopyproof-audit-report/build/`.

| Check | Result | Evidence file |
| --- | --- | --- |
| Baseline `npm ci --include=optional` | PASS; 730 packages | `baseline-install.log` |
| Updated support helper | PASS; Next 15.5.28 supported | `upgraded-support-check.json` |
| `npm run gate:supply-chain` | PASS; 735 SBOM components; final staged scan includes all new source/test/docs files | `supply-chain-with-pg.log` |
| `npm run audit` | PASS; 0 vulnerabilities | `audit-with-pg.log` |
| Dependency/deployment/release focused tests | PASS; 43/43 | `dependency-focused-tests.log` |
| Existing Life++ unit suite | PASS; 124/124 | `lifepp-unit.log` |
| `npm run lint` | PASS | `lint-final.log` |
| API/suite/workerd focused contracts | PASS; 18/18 | `final-contract-api-tests.log` |
| WebGL workflow contract | PASS; 2/2 | `final-webgl-contract.log` |
| Web TypeScript | PASS; also checked in final Next build | `web-typecheck-final.log` |
| API direct `tsc --noEmit` | FAIL; 1,289 diagnostic lines, missing generated Prisma symbols and downstream errors; no child-stewardship paths | `api-typecheck-final-diagnostic.log` |
| Full direct unit suite | 1,061 tests: 1,044 PASS, 17 FAIL | `unit-suite-final-complete.log`, `unit-suite-final-summary.json` |
| Production Next/OpenNext build | PASS; `.open-next/worker.js` emitted | `opennext-final.log` |
| Local production workerd smoke | PASS; 16 routes, 0 failures, including `/stewardship` | `workerd-final.log`, `workerd-final.json` |
| Prisma generation and normal Prisma-backed gate | BLOCKED; engine checksum download returned HTTP 403 | `prisma-generate.log` |
| Playwright three-engine install | BLOCKED; Chromium archive download returned HTTP 403 | `browser-install.log` |

The final unit command was `node --test --test-concurrency=2 --import tsx
tests/unit/*.test.ts`, with the existing CI network/provider/funds flags disabled.
It avoided `pretest`, because that hook would repeat the denied engine download;
this diagnostic does not satisfy the normal `npm test` gate. Compilation and the
final unit run were sequential. The 17 failures are seven missing `Prisma.sql`
authority/locking cases, one missing Prisma error constructor case, two wrapped
Global Command Center reader cases, and seven API/metrics status cases. The exact
test names and errors are in `unit-suite-final-summary.json`. A direct `/metrics`
diagnostic confirmed its 400 response contains `@prisma/client did not initialize
yet`, recorded in `metrics-failure-diagnostic.log`. No failure was skipped or
converted into a pass. New child-stewardship tests and runner contracts pass.
Native pg tests are separately recorded by their module owners; a pg run does
not establish generated Prisma-wrapper acceptance.

The production build command was `npm --workspace apps/web run cf:build` with
`NEXT_PUBLIC_CANOPYPROOF_MODE=production` and
`NEXT_PUBLIC_DROPIN_SITE_URL=https://canopyproof.org`, telemetry disabled, and the
pinned toolchain. It reported `/stewardship` at 17.9 kB and 121 kB first-load
JavaScript. `npm run test:workerd` then checked the actual Worker response for
synthetic disclosure, no-real-identity text and route-specific noindex metadata.
The existing production homepage metadata does not acquire a global noindex.

The local output has 1,560 inventoried files. `final-opennext-inventory.json` has
SHA-256 `c192a88d6423759864896fe4beb060e11e796be2ba6dae9fc0b57a4d9921566a`;
`worker.js` has SHA-256
`d05223bf4d44c84108a102ab62aa3bc9c5568f0c3ac2064c37be5cc65c64bc45`.
These are **local dirty-source diagnostics, not a release seal**.
`final-source-checkpoint.json` records individual source hashes at the build
checkpoint, based on HEAD `5d571e7e2736345d8c76717c66b564b60268ace1` plus
uncommitted changes. Later database-review or documentation edits are not
retroactively covered by this checkpoint. A final fixed-SHA release build and
all candidate-bound CI evidence remain required.

The new browser matrix runs the synthetic fixture for Chromium, Firefox and
WebKit inside the existing `webgl` CI gate, after the existing WebGL test. It
rejects a system-Chromium override. The three new native integration files are
assigned to the existing native PostgreSQL gate. Existing gate identities,
coverage thresholds, prerequisite generation and release approval policy remain
in force. The system-Chromium fixture diagnostic is separately labelled and
does not establish three-engine acceptance.

An earlier full-unit run overlapped compilation and exposed Miniflare D1
read-back `UND_ERR_SOCKET` errors in the existing consultation budget fixture.
The unchanged fixture passed after compilation, including the final full suite.
Instrumentation was removed; neither the budget threshold nor production
behavior was weakened. Earlier failures remain preserved in external logs.

An unexecuted check is not a pass. Local results are not same-SHA GitHub CI
artifacts and cannot satisfy the production release workflow alone.

## Release gates remain intact

The production workflow requires an actual independent review of the final PR
head, the merged main SHA, same-SHA trust and web CI artifacts, a qualified
maintainer attestation, a sealed artifact, and independent protected-environment
approval. The deployment job rechecks the exact manifest, rollback, route and
binding compatibility. These approvals cannot be authored on behalf of other
people or replaced with this document.

No deployment, resource purchase, credential replacement or production
configuration read is performed by this build task. The previously denied
GitHub Actions query is not retried.

The denied Prisma action was downloading
`https://binaries.prisma.sh/all_commits/c2990dca591cba766e3b7ef5d9e8a84796e47ab7/debian-openssl-3.0.x/schema-engine.gz.sha256`.
The proxy returned HTTP 403 Forbidden; generation did not complete. No
checksum-ignore option or alternate engine source was used. Playwright denied
`https://cdn.playwright.dev/builds/cft/147.0.7727.15/linux64/chrome-linux64.zip`
with HTTP 403 Domain forbidden; installation did not complete. Its CLI performed internal
retries before returning the failure. No subsequent download retry or alternate
mirror was attempted. Existing `/usr/bin/chromium` may support a separately
labelled local diagnostic, but cannot replace three-engine acceptance.

Final staging validation scanned all 55 changed/new files as tracked inputs: zero
secret findings or generated artifacts; 735 SBOM components. Its report records
the pre-commit base SHA, so it is a staging diagnostic, not candidate-bound CI.

## Durable synthetic API quota evidence

The additive `child-stewardship-rate-limit.sql` migration stores only fixed
quota kind, minimal bucket identifier, minute window, count and expiry. Global
creation capacity is 1,200/minute; authenticated requests have 120/minute per
actor within a session. The previous shared-session design was corrected after
independent review identified a guardian-visible quota oracle and denial risk.
Guardian, child and protector counters are separate. SQL validates current
connection identity, registered role, tenant, actor status and expiry after
actual bucket lock waits. Broad ordinary table grants cannot reset counters.

Owner-only, invoker-rights internal helpers support fixed suspend/resume
capacities of 12/minute and agent capacity of 120/minute. They reject arbitrary
quota kinds, raw capability values and direct runtime calls even with broad
function grants. Capability wrappers must derive their bucket from verified
authority, lock it, recheck authority using the returned database clock and
commit the security counter independently of business rejection. Cancellation
has no quota kind, preserving its separate revocation lane. Wrapper integration
is owned and tested separately; owner-fixture helper tests alone do not prove it.

Counters expire logically after two minutes; eligible admissions reclaim at most
256 expired rows. Idle expired rows may remain until subsequent traffic or
trusted cleanup. This is synthetic capacity protection, not provider acceptance.

Direct native command:
`node --test --test-concurrency=1 --import tsx tests/integration/child-stewardship-rate-limit.integration.ts`
passed **13/13**, with eight real PostgreSQL client connections, fixed capacity,
actor isolation, forbidden writes, current revocation and post-lock expiry.
Scoped strict TypeScript and ESLint passed with zero diagnostics. Evidence is
`child-rate-limit-native-purpose.tap`, `child-rate-limit-typecheck.log` and
`child-rate-limit-lint.log` outside the repository. An earlier test-fixture run
failed on PostgreSQL's invalid timezone spelling `UTC+00:00:30`; the fixture now
uses valid `Asia/Kathmandu`. No capacity or clock validation was relaxed.

These results precede the final writer freeze. No final fixed-source build,
release seal or production approval is claimed.

## Process-local storage circuit evidence

`dependency-guard.ts` supplies a bounded, per-authenticated-actor dependency
circuit around the main database transaction. Three explicit transport or
database-unavailable failures open that actor's circuit for 15 seconds, followed
by one concurrent recovery probe. Domain denials, including authority-related
503 responses, never trip it. A rejected recovery probe releases its slot;
stale concurrent completions cannot close a newer circuit. Other actors and
sessions have independent state, and cancellation remains a separate route.

The helper signal payload contains only fixed category/code/count/time fields,
never exceptions, paths, tokens, session IDs, actor IDs or protection details.
The application uses its existing global service logger, whose standard envelope
adds service/process metadata; no request logger or request context is used.
Sink failure does
not alter transaction outcomes. Its bounded tracking map neither evicts another
actor's active circuit nor substitutes cached authority or data: when tracking
is full, new actors still execute the normal database path. This is local load
protection, not distributed authorization or readiness. No external alert
recipient is configured or claimed to have received a notification.

The direct root command `node --test --import tsx
tests/unit/child-stewardship-dependency-guard.test.ts` passed **7/7**, including
paired guardian/protected-actor isolation, real concurrent half-open probes,
logging sanitization and failure, stale completion, and bounded-map exhaustion.
Scoped strict TypeScript and ESLint passed with zero diagnostics. Logs are
`child-dependency-guard-unit.tap`, `child-dependency-guard-typecheck.log` and
`child-dependency-guard-lint.log` outside the repository. Actual route/logger
wiring and native storage-fault evidence are recorded separately by their owner;
these helper tests alone do not establish integration or delivered alerts.

## Unified local candidate validation (2026-10-23)

The settled-source direct run of all 14 registered child native integration
files passed **161/161**, zero skipped. The normal root command for all child
unit files passed **118/118**. These are the unified totals; the smaller module
receipts above overlap and must not be added together. Runner/service ownership
contracts passed **18/18**. Native restoration uses the existing PostgreSQL 17
GitHub service container ID supplied by the native job step, not a local container
name or newly provisioned infrastructure.

The first combined native attempt was 151/161: the isolated draft test database
omitted the newly required rate migration, so nine cases plus their parent failed
on the missing quota function. Only that fixture migration list changed; the
complete failed receipt remains `phase2-native-all-final.tap`, and the successful
rerun is `phase2-native-all-candidate-2.tap`. Focused units and runner receipts are
`phase2-focused-all-final.tap` and `phase2-final-runner-service-contracts.tap`.

The complete direct unit diagnostic was **1,085 tests: 1,068 passed, 17 failed,
zero skipped**. All 17 failure names match the previous generated-Prisma-blocked
checkpoint; no new failure names appeared. This is not a passing normal workspace
gate. `phase2-unit-summary.json` preserves every failure. Direct API TypeScript
has 1,278 diagnostics, exactly matching the previous diagnostic after normalizing
line/column positions, with no child module paths and no new messages; see
`phase2-api-typecheck-delta.json`. Root lint and web TypeScript passed; focused
changed-module strict TypeScript and ESLint also passed.

All receipts are outside the repository under
`/workspace/canopyproof-audit-report/build/`. Earlier accounting fixture attempts
included an unsafe-number signing error and a malformed-input 400 versus 403
expectation. The latter full TAP is preserved. The earlier full accounting TAP
was overwritten by its owner; the failure-history note identifies that loss and
does not fabricate a recovered log.

These checks precede the new local candidate commit. The subsequent clean fixed-HEAD
build, complete artifact inventory, actual Next privacy/mobile diagnostics and
new-head remote CI receipt must be attached to the draft PR. No old dirty-source
build or old-head CI result is accepted for this candidate. Independent AI review
closed the reported code findings, including cross-payout receipt reuse and
post-lock role expiry; human final-head release approval remains outstanding.
