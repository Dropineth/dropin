# Child stewardship build validation

This records local engineering evidence, not production approval. The authoritative
private specification stays outside the repository. Its restored SHA-256 is
`d7bca48c07c7a04ce12efb5a8f33604b6b86cc69d7fffd9abf13f98ef8a8f503`.

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
