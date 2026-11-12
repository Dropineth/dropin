# Node 22.23.5 security baseline, 2026-11-12

This candidate upgrades Node tooling and the prepared Node backend/isolated CAI
container pins. It does not deploy, create resources, change UI, enable child
entry, modify Cloudflare authority, or upgrade Cloudflare's workerd runtime.
It inherits the tested PR39 implementation/lint fix and targets main directly;
PR39 must land first, followed by exact-head CI/release review for this candidate.

## Applicability

[The official Node release](https://nodejs.org/en/blog/release/v22.23.5/), dated
2026-11-11, identifies a security release with HTTP/2, HTTP/TLS, HTTPS, permission
and zlib fixes. The repository's active build/release/container pins used 22.23.4.
Upgrading those baselines is appropriate; this assessment does not demonstrate
that each individual CVE is reachable in the disabled backend. The synthetic
container remains networkless. Cloudflare Workers execute workerd, not the
Docker Node runtime. Updating these pins does not prove production is patched.

## Verified immutable sources

- Official Linux x64 archive: `https://nodejs.org/dist/v22.23.5/node-v22.23.5-linux-x64.tar.xz`.
  Published/downloaded SHA256: `cdeb8670a0c81f51b4dc4ac61919f9b1ad917b304bf8221eb939570663d240f8`.
  Checksum matched before extraction/execution; executable reports `v22.23.5`.
  This was a checksum comparison against the official HTTPS release page, not
  a separate local PGP signature verification.
- Backend: `node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee`.
  [Official Docker Library record](https://github.com/docker-library/repo-info/blob/ae557458f99a849ecb105a77200b4d1dcc306413/repos/node/remote/22.23.5-bookworm-slim.md).
  Preserves linux/amd64, arm/v7, arm64/v8 and ppc64le from the old index.
- Isolated CAI worker: `node:22.23.5-alpine3.24@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a`.
  [Official Docker Library record](https://github.com/docker-library/repo-info/blob/ae557458f99a849ecb105a77200b4d1dcc306413/repos/node/remote/22.23.5-alpine3.24.md).
  Preserves linux/amd64, arm/v6, arm/v7, arm64/v8 and s390x. Alpine patch level
  advances 3.24.3 to 3.24.4. Do not use the earlier incomplete index lacking arm64.
- Both container indexes were checked against immutable official repository
  records, not a local image pull. Multiarch selection remains enabled. Existing
  digest pinning, no implicit worker pull, non-root/read-only/networkless limits
  and cleanup behavior are unchanged. A record is not an executed container test.

## Candidate checks

- 24 release/workflow/runtime-pin tests pass under the verified Node 22.23.5 binary.
  A new negative test rejects consistent old-runtime receipts as well as mixed
  runtime evidence. Eleven setup-node instances across ten workflows agree.
- 67 Node signature/envelope tests and 105 workerd tests from the inherited PR39
  candidate pass on 22.23.5; strict TypeScript and Wrangler dry-run pass.
- Targeted changed-source ESLint passes with the unchanged repository rules.
- npm 10.9.4 remains the release-policy pin. No package or lockfile dependencies
  were changed. Historical release evidence is preserved, not rewritten to claim
  it ran on the new runtime.

The local environment has no Docker CLI/daemon. Full backend container tests,
Docker worker isolation tests, full monorepo CI, native PostgreSQL and browser
release checks must pass on the published exact head before any release.
Local test results are not an independent human approval or hosted preview
acceptance. Existing protected release, current-main, rollback and authority
checks are unchanged; no workflow dispatch or live cutover occurred.

The pre-existing deployment preparation JSON remains non-approved and does not
revive the paused Render hosting plan. Cloudflare-first remains the current
project direction.
