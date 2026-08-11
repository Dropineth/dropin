# CanopyProof R1 Test Manifest Delta

Status: Reconciled

Verification date: 2026-07-28

## Commit Points

| Point | Commit | Unit files | Declared unit tests | Integration files |
| --- | --- | ---: | ---: | ---: |
| R0 base | `41d7e423ac911a412be30c0fb6f481c99ddeefe7` | 21 | 151 | 0 |
| R0 integration | `6a7ec9443bee970779c2a6521e7320dd5de37df1` | 100 | 614 | 20 |
| R0 evidence / R1 base | `7f7729c567016ed0eff92b7db61e41bcc57b2285` | 100 | 614 | 20 |

Declared tests count direct `node:test`/`it` call sites. Runtime totals also
include dynamically generated subtests.

## Runtime Reconciliation

| Suite | R0 base | R0 evidence | R1 audit interpretation |
| --- | --- | --- | --- |
| Root unit | 151 total; 147 pass, 4 fail because the base referenced missing companion files | 647 pass after Prisma generation | 100 files, 614 declared tests and 33 dynamic subtests |
| PGlite | absent | 40 pass across 18 files | self-contained command requires an R1 Prisma pre-hook |
| Native PostgreSQL | absent | 2 pass across 2 files | forced RLS/non-bypass concurrency and generalized spatial disclosure |
| FiftyOne Python | absent | present but not owned by R0 npm CI | 4 pass; R1 adds explicit npm/CI ownership |
| Solana Anchor | 1 spec file | same unchanged spec file | separate `npm run anchor:test`; not part of the CanopyProof trust gate |

A fresh R1 install exposed an ordering dependency: direct unit or PGlite
execution failed before Prisma Client generation, while the R0 `npm run ci`
order generated the client during typecheck. R1 adds explicit lifecycle
pre-hooks so each test command is independently replayable.

## Why The Historical Count Was Higher

Historical development documents reported 853 passing unit tests from the
dirty source tree. A read-only inventory of that tree found 134 unit files
and 826 declared tests. R0 admitted 100 unit files and 614 declared tests.
The 206-test runtime delta is not a committed deletion:

- 34 dirty-only test files belonged to excluded product, deployment, agent,
  payment, protocol, or Phase 16/17 prototype surfaces;
- one dirty modification to `canopyproof-design-spec.test.ts` was excluded,
  while the committed-base version of that test remains;
- R0 added 79 unit files relative to the 21-file base and deleted none;
- dynamic subtests make runtime totals differ from static call-site totals.

No committed unit, integration, Python, or Solana test file was renamed or
deleted between the true R0 base and the R0 evidence commit.

## CI Ownership

- `npm run ci` owns root unit tests, FiftyOne tests after the R1 change, and
  all 18 PGlite files.
- the CanopyProof GitHub workflow owns the two native PostgreSQL files.
- the repository coverage ratchet remains separate from runtime test counts.
- the unchanged Solana spec requires its dedicated Anchor/Solana toolchain.
- R0 contained no Playwright/browser test file; R1 adds that suite separately.
- `canopyproof-test-suite-contract.test.ts` fails if a first-party test file
  falls outside a declared suite family or an integration file loses command
  ownership.

## Committed Test File Manifest

| Path | Suite type | Base | Integration | Evidence | Declared tests | Current status | Replacement | Reason | CI command |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- | --- |
| `contracts/solana/tests/dropin-anchor.spec.ts` | solana-anchor | present | present | present | 9 | not run in initial R1 audit | - | retained | `npm run anchor:test` (separate Solana toolchain) |
| `integrations/fiftyone/tests/test_canopyproof_client.py` | fiftyone-python | - | present | present | 4 | PASS, 4 tests in R1 audit | - | added in R0 | `npm run test:fiftyone` added by R1 |
| `tests/integration/canopyproof-device-attestation-adapter-pglite.integration.ts` | pglite | - | present | present | 2 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-early-warning-pglite.integration.ts` | pglite | - | present | present | 2 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-evidence-custody-pglite.integration.ts` | pglite | - | present | present | 1 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-evidence-media-pglite.integration.ts` | pglite | - | present | present | 1 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-evidence-verification-pglite.integration.ts` | pglite | - | present | present | 2 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-funding-accountability-pglite.integration.ts` | pglite | - | present | present | 2 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-global-command-center-pglite.integration.ts` | pglite | - | present | present | 1 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-global-command-center-spatial-disclosure-native.integration.ts` | native-postgresql | - | present | present | 1 | PASS in R0 2-test aggregate | - | added in R0 | `npm run db:verify:canopyproof:native` in CanopyProof CI |
| `tests/integration/canopyproof-global-command-center-spatial-disclosure-pglite.integration.ts` | pglite | - | present | present | 1 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-mobile-sync-admission-pglite.integration.ts` | pglite | - | present | present | 2 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-mrv-graph-pglite.integration.ts` | pglite | - | present | present | 1 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-nasa-gibs-pglite.integration.ts` | pglite | - | present | present | 2 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-native-postgres.integration.ts` | native-postgresql | - | present | present | 1 | PASS in R0 2-test aggregate | - | added in R0 | `npm run db:verify:canopyproof:native` in CanopyProof CI |
| `tests/integration/canopyproof-organization-accreditation-pglite.integration.ts` | pglite | - | present | present | 4 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-organization-lifecycle-pglite.integration.ts` | pglite | - | present | present | 4 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-postgres-audit.integration.ts` | pglite | - | present | present | 1 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-project-lifecycle-pglite.integration.ts` | pglite | - | present | present | 6 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-root-governance-pglite.integration.ts` | pglite | - | present | present | 4 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-trust-registry-pglite.integration.ts` | pglite | - | present | present | 3 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/integration/canopyproof-visual-evidence-pglite.integration.ts` | pglite | - | present | present | 1 | PASS in R0 40-test aggregate | - | added in R0 | `npm run db:verify:canopyproof` via `npm run ci` |
| `tests/unit/campaign-service.test.ts` | unit | present | present | present | 11 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/canopy-state-machine.test.ts` | unit | - | present | present | 7 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-agent-framework.test.ts` | unit | - | present | present | 3 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-audit-attestations.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-audit-export-manifests.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-authorization-binding.test.ts` | unit | - | present | present | 6 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-aws-kms-managed-signature-verifier.test.ts` | unit | - | present | present | 10 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-canonical-project-lifecycle-resolver.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-certificate-transparency.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-challenge-cases.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-ci-workflow.test.ts` | workflow-contract | - | present | present | 2 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-data-quality.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-database-audit-transparency.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-design-spec.test.ts` | unit | present | present | present | 5 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-device-attestation-adapter.test.ts` | unit | - | present | present | 6 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-early-warning-authority.test.ts` | unit | - | present | present | 6 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-early-warning.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-edge-observability.test.ts` | unit | - | present | present | 12 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-environmental-proof-authority.test.ts` | unit | - | present | present | 7 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-environmental-proof-lifecycle-authority.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-esg-metric-authority.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-esg-reporting-authority.test.ts` | unit | - | present | present | 6 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-esg-reporting.test.ts` | unit | - | present | present | 3 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-custody-authority.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-media-authority.test.ts` | unit | - | present | present | 10 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-media-provider-runtime.test.ts` | unit | - | present | present | 9 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-metadata-extractor-adapter.test.ts` | unit | - | present | present | 11 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-metadata-retention-authority.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-network.test.ts` | unit | - | present | present | 10 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-offline-community-authority.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-registry.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-review-authority.test.ts` | unit | - | present | present | 2 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-evidence-verification-authority.test.ts` | unit | - | present | present | 18 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-fiftyone-adapter.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-funding-accountability-authority.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-funding-transparency.test.ts` | unit | - | present | present | 3 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-global-command-center-publishing-authority.test.ts` | unit | - | present | present | 2 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-global-command-center-spatial-disclosure-authority.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-global-command-center.test.ts` | unit | - | present | present | 8 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-governance.test.ts` | unit | - | present | present | 2 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-identity-authentication.test.ts` | unit | - | present | present | 6 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-identity.test.ts` | unit | - | present | present | 2 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-institutional-reporting.test.ts` | unit | - | present | present | 3 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-memory.test.ts` | unit | - | present | present | 2 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-methodology-governance-authority.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-methodology-registry.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-mobile-evidence-sync.test.ts` | unit | - | present | present | 11 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-mobile-evidence-vault.test.ts` | unit | - | present | present | 8 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-mobile-sync-admission.test.ts` | unit | - | present | present | 3 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-mrv-graph-authority.test.ts` | unit | - | present | present | 6 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-nasa-gibs-api.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-nasa-gibs-ui.test.ts` | unit | - | present | present | 2 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-nasa-gibs.test.ts` | unit | - | present | present | 13 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-observability-deployment.test.ts` | workflow-contract | - | present | present | 6 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-opentelemetry-exporter.test.ts` | unit | - | present | present | 14 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-organization-accreditation-authority.test.ts` | unit | - | present | present | 6 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-organization-lifecycle-authority.test.ts` | unit | - | present | present | 7 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-os-modules.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-partner-collaboration.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-point-cloud-mrv.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-postgres-advisory-lock.test.ts` | unit | - | present | present | 2 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-production-smoke.test.ts` | unit | present | present | present | 9 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-production-workflow.test.ts` | workflow-contract | present | present | present | 1 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-project-lifecycle-authority.test.ts` | unit | - | present | present | 7 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-project-registry.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-proof-api.test.ts` | unit | - | present | present | 7 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-proof-challenges.test.ts` | unit | - | present | present | 2 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-proof-engine.test.ts` | unit | - | present | present | 9 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-public-explorer.test.ts` | unit | - | present | present | 8 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-public-records.test.ts` | unit | - | present | present | 3 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-public-transparency-authority.test.ts` | unit | - | present | present | 8 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-resilience-chaos.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-root-governance-authority.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-satellite-api.test.ts` | unit | - | present | present | 3 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-satellite-proof.test.ts` | unit | - | present | present | 13 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-security-policy.test.ts` | unit | - | present | present | 12 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-site.test.ts` | unit | - | present | present | 6 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-smoke-checker.test.ts` | unit | present | present | present | 2 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-terra-intelligence.test.ts` | unit | - | present | present | 3 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-trust-registry.test.ts` | unit | - | present | present | 12 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-verification-decisions.test.ts` | unit | - | present | present | 4 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-verification-queue.test.ts` | unit | - | present | present | 3 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-visual-api-observability.test.ts` | unit | - | present | present | 5 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/canopyproof-visual-evidence-intelligence.test.ts` | unit | - | present | present | 10 | PASS in R0 647-test aggregate | - | added in R0 | `npm run test` via `npm run ci` |
| `tests/unit/dropin-cloudflare-deployment.test.ts` | workflow-contract | present | present | present | 13 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/fullstack-api-hooks.test.ts` | unit | present | present | present | 3 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/fund-service.test.ts` | unit | present | present | present | 12 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/impact-service.test.ts` | unit | present | present | present | 7 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/launch-pack.test.ts` | unit | present | present | present | 6 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/launch-readiness.test.ts` | unit | present | present | present | 9 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/lottery-service.test.ts` | unit | present | present | present | 6 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/lottery.test.ts` | unit | present | present | present | 5 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/miniapp-linkage.test.ts` | unit | present | present | present | 2 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/operator-dry-run-artifacts.test.ts` | unit | present | present | present | 5 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/payment-service.test.ts` | unit | present | present | present | 21 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/phase15-launch-candidate.test.ts` | unit | present | present | present | 4 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/pocc-ahin-anchor.test.ts` | unit | present | present | present | 2 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/risk-service.test.ts` | unit | present | present | present | 13 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/telegram-service.test.ts` | unit | present | present | present | 6 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |
| `tests/unit/ui-premium.test.ts` | unit | present | present | present | 9 | PASS in R0 647-test aggregate | - | retained | `npm run test` via `npm run ci` |

## Excluded Dirty-Tree Test Changes

| Path | Declared tests | Status | Replacement | Reason | CI command |
| --- | ---: | --- | --- | --- | --- |
| `tests/unit/analytics-insight-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/canopyproof-design-spec.test.ts` | 5 | BASE_VERSION_RETAINED | same path, committed-base content | dirty modification excluded; committed-base test retained | none for excluded change |
| `tests/unit/carbon-accounting-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/community-engagement-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/content-education-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-cognition.test.ts` | 14 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-dashboard.test.ts` | 8 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-growth.test.ts` | 9 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-master-prompt-vnext.test.ts` | 4 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-memory.test.ts` | 9 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-operations-os.test.ts` | 10 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-protocol-infra.test.ts` | 10 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-protocol.test.ts` | 13 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-realtime.test.ts` | 13 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dropin-security.test.ts` | 16 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/dual-deployment-workflow.test.ts` | 2 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/e2e-demo-automation.test.ts` | 5 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/e2e-production-runner.test.ts` | 4 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/external-partner-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/governance-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/growth-referral-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/ops-infrastructure-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/phase16-scaffold.test.ts` | 6 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/phase17-production-implementation.test.ts` | 5 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/phase17-sprint1.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/pocc-ahin-consensus-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/product-vision-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/production-convergence.test.ts` | 18 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/proof-of-planting-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/quickstart-seed-scripts.test.ts` | 2 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/randomness-sybil.test.ts` | 7 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/risk-red-team-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/tree-lotto-agent.test.ts` | 4 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/ux-experience-agent.test.ts` | 3 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |
| `tests/unit/wallet-payment-agent.test.ts` | 4 | EXCLUDED_R0 | - | uncommitted non-R0 product, deployment, or protocol suite excluded | none for excluded change |

## Decision

The R0 test-count delta is fully attributable to explicit scope disposition,
new institutional suites, dynamic subtests, and the historical dirty-tree
aggregate. No test silently disappeared from the committed R0 chain.
