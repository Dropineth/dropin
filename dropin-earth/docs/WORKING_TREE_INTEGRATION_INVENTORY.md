# Working Tree Integration Inventory

Status: Phase R0 pre-integration evidence  
Snapshot date: 2026-07-26  
Intended source root: `/Users/lee/Dropin/dropin-earth`

## Repository Identity

| Field | Value |
| --- | --- |
| Git root | `/Users/lee/Dropin` |
| Current branch | `canopyproof/edge-security-hardening` |
| Current HEAD / integration base | `41d7e423ac911a412be30c0fb6f481c99ddeefe7` |
| Local `origin/main` | `a5a55967e856006af1855092ed8532b1314208d0` |
| Remote `main` observed with `git ls-remote` | `15025bc03456d605f1ccbd529a8d66b0f1f8d3f8` |
| Local merge base with local `origin/main` | `41d7e423ac911a412be30c0fb6f481c99ddeefe7` |
| Local HEAD ahead/behind local `origin/main` | `0/4` |

The local remote-tracking ref is stale relative to the directly observed remote
`main`. Phase R0 intentionally uses the user-specified current committed base
`41d7e423ac911a412be30c0fb6f481c99ddeefe7`; it does not fetch, rebase, merge, push, or deploy.

## Immutable Pre-Inventory Snapshot

| Category | Count |
| --- | ---: |
| Tracked modified | 93 |
| Tracked deleted | 0 |
| Tracked added | 0 |
| Untracked status entries | 968 |
| Snapshot paths | 1061 |
| R0 evidence paths reserved in disposition | 6 |
| Ignored generated files | 108530 |
| Tracked additions/deletions | +18964 / -2248 |
| Counted untracked text lines | 338052 |

The exhaustive path-level inventory is
`docs/WORKING_TREE_FILE_DISPOSITION.csv`. Every snapshot path occurs exactly
once and is assigned either one approved subsystem or one explicit exclusion.
The CSV is the authoritative untracked-file, ownership, disposition, target
commit, and validation ledger.

## Tracked Modified Files

```text
.DS_Store
.github/workflows/deploy-canopyproof.yml
dropin-earth/.env.example
dropin-earth/.gitignore
dropin-earth/README.md
dropin-earth/apps/admin/src/app/risk/page.tsx
dropin-earth/apps/admin/src/app/status/page.tsx
dropin-earth/apps/miniapp-ton/next.config.mjs
dropin-earth/apps/miniapp-ton/src/app/campaign/[campaignId]/page.tsx
dropin-earth/apps/miniapp-ton/src/app/globals.css
dropin-earth/apps/miniapp-ton/src/app/layout.tsx
dropin-earth/apps/miniapp-ton/src/app/me/forest/page.tsx
dropin-earth/apps/miniapp-ton/src/app/page.tsx
dropin-earth/apps/miniapp-ton/src/app/round/[roundId]/page.tsx
dropin-earth/apps/miniapp-ton/src/app/share/[ticketId]/share-card-client.tsx
dropin-earth/apps/miniapp-ton/src/components/ui/MiniCTAButton.module.css
dropin-earth/apps/miniapp-ton/src/components/ui/MiniCTAButton.tsx
dropin-earth/apps/miniapp-ton/src/components/ui/MiniHeroEarthOrb.module.css
dropin-earth/apps/miniapp-ton/src/components/ui/MiniHeroEarthOrb.tsx
dropin-earth/apps/miniapp-ton/src/components/ui/MiniMetricsCard.module.css
dropin-earth/apps/miniapp-ton/src/components/ui/MiniMetricsCard.tsx
dropin-earth/apps/miniapp-ton/src/components/ui/MiniRoundEconomicsCard.tsx
dropin-earth/apps/miniapp-ton/src/components/ui/index.ts
dropin-earth/apps/miniapp-ton/src/lib/api.ts
dropin-earth/apps/web/next.config.mjs
dropin-earth/apps/web/open-next.config.ts
dropin-earth/apps/web/package.json
dropin-earth/apps/web/postcss.config.mjs
dropin-earth/apps/web/src/app/about/page.tsx
dropin-earth/apps/web/src/app/campaigns/[campaignId]/page.tsx
dropin-earth/apps/web/src/app/campaigns/page.tsx
dropin-earth/apps/web/src/app/challenges/page.tsx
dropin-earth/apps/web/src/app/draw/page.tsx
dropin-earth/apps/web/src/app/faq/page.tsx
dropin-earth/apps/web/src/app/fund/page.tsx
dropin-earth/apps/web/src/app/globals.css
dropin-earth/apps/web/src/app/lottery/[roundId]/page.tsx
dropin-earth/apps/web/src/app/page.tsx
dropin-earth/apps/web/src/app/payments/[paymentIntentId]/page.tsx
dropin-earth/apps/web/src/app/projects/page.tsx
dropin-earth/apps/web/src/app/red-team/page.tsx
dropin-earth/apps/web/src/app/status/page.tsx
dropin-earth/apps/web/src/components/canopyproof/CanopyProofLanding.tsx
dropin-earth/apps/web/src/data/siteContent.ts
dropin-earth/apps/web/src/lib/api.ts
dropin-earth/contracts/solana/programs/dropin_anchor/src/errors.rs
dropin-earth/contracts/solana/programs/dropin_anchor/src/instructions/mod.rs
dropin-earth/contracts/solana/programs/dropin_anchor/src/lib.rs
dropin-earth/contracts/solana/programs/dropin_anchor/src/state.rs
dropin-earth/docker-compose.yml
dropin-earth/docs/api.md
dropin-earth/docs/architecture.md
dropin-earth/docs/deployment.md
dropin-earth/docs/design/canopyproof-design-tokens.json
dropin-earth/docs/design/canopyproof-figma-document.json
dropin-earth/docs/design/canopyproof-uiux-spec.md
dropin-earth/docs/product.md
dropin-earth/docs/telegram-miniapp.md
dropin-earth/docs/testnet-campaigns.md
dropin-earth/docs/testnet-operator-daily-report.md
dropin-earth/docs/ui-system.md
dropin-earth/infra/cloudflare/canopyproof-api-proxy.ts
dropin-earth/package-lock.json
dropin-earth/package.json
dropin-earth/packages/crypto/src/index.ts
dropin-earth/packages/schemas/package.json
dropin-earth/packages/schemas/src/index.ts
dropin-earth/packages/ui/src/index.tsx
dropin-earth/reports/npm-audit-moderate.json
dropin-earth/scripts/deploy-canopyproof.sh
dropin-earth/services/api/package.json
dropin-earth/services/api/prisma/seed.ts
dropin-earth/services/api/src/app.ts
dropin-earth/services/api/src/domain/fund/fund-service.ts
dropin-earth/services/api/src/domain/impact/evidence-service.ts
dropin-earth/services/api/src/domain/impact/impact-engine.ts
dropin-earth/services/api/src/domain/lottery/lottery-repository.ts
dropin-earth/services/api/src/domain/telegram/telegram-referral.ts
dropin-earth/services/api/src/domain/telegram/telegram-service.ts
dropin-earth/tests/unit/canopyproof-design-spec.test.ts
dropin-earth/tests/unit/canopyproof-production-workflow.test.ts
dropin-earth/tests/unit/dropin-cloudflare-deployment.test.ts
dropin-main/.gitignore
dropin-main/README.md
dropin-main/next.config.mjs
dropin-main/package-lock.json
dropin-main/package.json
dropin-main/src/app/Actions.json/route.ts
dropin-main/src/app/api/supply/route.ts
dropin-main/src/app/globals.css
dropin-main/src/app/layout.tsx
dropin-main/src/app/page.tsx
dropin-main/tsconfig.json
```

## Deleted Files

No tracked deletions were present in the snapshot.

## Untracked Files

All 968 untracked status entries are recorded individually in
`docs/WORKING_TREE_FILE_DISPOSITION.csv` with
`source_status=untracked`. They are not bulk-copied. The integration process
may copy only rows whose `include_or_exclude` value is `include`, one
explicit file at a time or through a manifest-driven exact-path copier.

## Diff Size By Directory

| Directory | Tracked additions | Tracked deletions | Counted untracked text lines |
| --- | ---: | ---: | ---: |
| `.DS_Store` | 0 | 0 | 0 |
| `.github` | 41 | 6 | 774 |
| `dropin-earth/.env.example` | 101 | 0 | 0 |
| `dropin-earth/.github` | 0 | 0 | 392 |
| `dropin-earth/.gitignore` | 4 | 0 | 0 |
| `dropin-earth/PHASE1_REVIEW.md` | 0 | 0 | 182 |
| `dropin-earth/README.md` | 440 | 5 | 0 |
| `dropin-earth/apps` | 973 | 235 | 29749 |
| `dropin-earth/contracts` | 123 | 0 | 430 |
| `dropin-earth/docker-compose.yml` | 61 | 0 | 0 |
| `dropin-earth/docs` | 2870 | 14 | 36495 |
| `dropin-earth/infra` | 2 | 279 | 601 |
| `dropin-earth/integrations` | 0 | 0 | 880 |
| `dropin-earth/package-lock.json` | 1091 | 32 | 0 |
| `dropin-earth/package.json` | 7 | 1 | 0 |
| `dropin-earth/packages` | 2384 | 7 | 17783 |
| `dropin-earth/reports` | 4 | 4 | 0 |
| `dropin-earth/scripts` | 2 | 0 | 4598 |
| `dropin-earth/services` | 5339 | 32 | 151661 |
| `dropin-earth/start-phase16-cron.sh` | 0 | 0 | 8 |
| `dropin-earth/start-phase16-full.sh` | 0 | 0 | 8 |
| `dropin-earth/start-phase16-local-dashboard.sh` | 0 | 0 | 6 |
| `dropin-earth/start-phase16-local.sh` | 0 | 0 | 8 |
| `dropin-earth/tests` | 201 | 3 | 69169 |
| `dropin-main` | 5321 | 1630 | 2327 |
| `gaia-nexus` | 0 | 0 | 22981 |

## Proposed Ownership And Disposition

| Disposition | Subsystem | File count |
| --- | --- | ---: |
| exclude | X chain-contract-surface | 11 |
| exclude | X deployment-or-legacy-workflow | 8 |
| exclude | X duplicate-linked-worktree | 3 |
| exclude | X generated-artifact | 13 |
| exclude | X legacy-api-domain | 19 |
| exclude | X legacy-or-product-documentation | 62 |
| exclude | X legacy-production-automation | 28 |
| exclude | X mixed-legacy-product-entrypoint | 3 |
| exclude | X non-R0-dropin-package | 153 |
| exclude | X non-R0-product-surface | 162 |
| exclude | X non-R0-protocol-surface | 10 |
| exclude | X non-R0-service | 10 |
| exclude | X outside-intended-root | 95 |
| exclude | X production-e2e | 12 |
| exclude | X production-report | 1 |
| exclude | X secret-boundary | 2 |
| exclude | X seed-or-legacy-coordination | 4 |
| exclude | X unapproved-local-infrastructure | 1 |
| exclude | X unapproved-or-unclassified | 4 |
| exclude | X unrelated-test | 35 |
| include | A architecture-RFC | 51 |
| include | B satellite-proof | 19 |
| include | C global-command-center | 29 |
| include | D mobile-evidence-vault | 5 |
| include | E mobile-sync-authority | 19 |
| include | F verify-only-security | 15 |
| include | G evidence-orchestration | 82 |
| include | H trust-kernel-postgres | 116 |
| include | I validation-coverage | 83 |
| include | R0 recovery-evidence | 7 |
| include | S shared-build-plumbing | 6 |

## Duplicate Logical Paths

Duplicate logical repository families exist under:

- `.codex-worktrees/canopyproof-jpg-logo-deploy/dropin-earth`;
- `.codex-worktrees/canopyproof-svg-deploy/dropin-earth`; and
- `canopyproof-spatial-grid-tree/dropin-earth`.

Each contains logical paths such as `apps/web`, `services/api`, and
`packages/schemas` that also exist under the intended source root. Generated
`.next`, `.open-next`, and standalone copies add further duplicates.

**Fail-closed decision:** none of those trees is an integration source. The only
accepted dirty source prefix is `/Users/lee/Dropin/dropin-earth`. The detached
integration worktree will be created directly from Git object
`41d7e423ac911a412be30c0fb6f481c99ddeefe7`, never copied from another worktree.

No nested `dropin-earth/dropin-earth` or root-level `apps/web` source family
was found under the intended source tree.

## Generated And Ignored Artifacts

| Ignored category | File count |
| --- | ---: |
| All ignored files | 108530 |
| `node_modules` descendants | 106728 |
| `.next` descendants | 1248 |
| `.open-next` descendants | 0 |
| `coverage` descendants | 235 |
| `reports` descendants | 283 |
| `artifacts` descendants | 74 |

Unignored generated findings include nested `.wrangler` SQLite state,
`test-results/.last-run.json`, `.DS_Store`, `.mypy_cache`, and
`.ruff_cache`. They are excluded. The clean integration slice may harden
`.gitignore` only for these proven omissions.

## Secret And Artifact Boundary

Filename-only inspection found the following secret-bearing candidates; none
was read and all are excluded:

```text
dropin-earth/.env.example
dropin-earth/.env.phase16.example
dropin-main/.env.example
```

The marker scanner read 932 candidate text files after
excluding `.env*`, private-key extensions, generated outputs, reports, and
binaries. It emitted only path, line, and category:

| Path | Line | Marker category |
| --- | ---: | --- |
| `dropin-earth/docker-compose.yml` | 77 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/integrations/fiftyone/tests/test_canopyproof_client.py` | 93 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/package.json` | 21 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/package.json` | 33 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/package.json` | 34 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/package.json` | 37 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/services/api/package.json` | 10 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/services/api/prisma/seed.ts` | 5 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/tests/unit/canopyproof-aws-kms-managed-signature-verifier.test.ts` | 22 | AWS_ACCESS_KEY_LITERAL |
| `dropin-earth/tests/unit/canopyproof-aws-kms-managed-signature-verifier.test.ts` | 383 | SECRET_ASSIGNMENT |
| `dropin-earth/tests/unit/canopyproof-edge-observability.test.ts` | 159 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/tests/unit/canopyproof-evidence-metadata-extractor-adapter.test.ts` | 1009 | SECRET_ASSIGNMENT |
| `dropin-earth/tests/unit/canopyproof-opentelemetry-exporter.test.ts` | 65 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/tests/unit/canopyproof-security-policy.test.ts` | 153 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/tests/unit/canopyproof-trust-registry.test.ts` | 980 | URI_EMBEDDED_CREDENTIAL |
| `dropin-earth/tests/unit/dropin-cloudflare-deployment.test.ts` | 53 | URI_EMBEDDED_CREDENTIAL |

No private-key header or GitHub/Slack token literal was detected. The one AWS
access-key marker is the published AWS documentation example in a unit test.
URI findings are local/disposable database URLs or negative-test fixtures.
Two generic secret assignments are test fixtures; they must be rewritten to
unambiguous fixture vocabulary in the clean integration tree before commit.
No matched value is recorded in this repository evidence.

## Files Outside The Intended Root

105 snapshot entries are outside `dropin-earth/`.
They are individually excluded in the disposition CSV. Families include root
workflows, linked worktrees, `dropin-main`, Gaia-Nexus, and root OS metadata.
The sole allowlisted outside-root candidate is the non-deploying
`.github/workflows/canopyproof-ci.yml`.

## Mixed Shared-Entry Boundary

Dependency inspection found that several tracked files combine approved
CanopyProof authorities with unrelated Phase 16 product, payment, lottery,
deployment, or protocol prototypes. Phase R0 must not copy those files
wholesale.

- `packages/schemas/src/index.ts`, `apps/web/src/lib/api.ts`, and the
  production-workflow test retain their committed-base versions.
- `services/api/src/app.ts` must be reconstructed from the committed base and
  may mount only approved, fail-closed CanopyProof routes.
- `services/api/src/domain/canopyproof/trust-registry.ts` is a cross-authority
  composition root and is integrated only after H, G, D, E, C, F, and B pass.
- The shared institutional OS page and its route data compose H, G, and D
  surfaces, so they remain in I rather than contaminating a foundational slice.
- Two narrow legacy-domain edits remain in H because they enforce mandatory
  append-only upload auditing and non-financial certificate disclosures.
- Root, web, service, and schema manifests plus the lockfile are shared build
  plumbing.
  Each feature commit may add only its required dependency or export, and the
  lockfile must be regenerated with npm 10.9.4 in the clean tree.
- Device-attestation and metadata-request SQL contracts belong to G because
  downstream E migrations require them; only adapters importing the final
  trust-registry composition root remain in I.
- `packages/ui/src/index.tsx` is reconstructed from the committed base with
  only the five public symbols already required by tracked web wrappers; unrelated
  product components and branding edits remain excluded.
- The untracked `packages/hooks` prototype is excluded because no approved
  projection imports it and it combines payment, lottery, RWA, and PoCC/AHIN
  demo authority.
- The minimal `packages/dropin-cloudflare` package is included in F because
  the tracked API Worker becomes a thin compatibility entrypoint over its
  hardened, default-off edge observability implementation.
- The new `dropin-protocol` package is reduced to the deterministic canopy
  state machine. Unrelated AHIN, settlement, CLI, and security prototypes are
  excluded.

This boundary removes the H/G/E dependency cycle: device attestation and
effective-media authority are one G slice; mobile synchronization E depends on
G and the encrypted vault D; the command center C depends on H and G; mounted
routes and aggregate tests remain in I.

## Integration Rules

1. Never bulk-copy the dirty tree.
2. Resolve source only from the intended dirty root.
3. Copy exact allowlisted paths by subsystem.
4. Never copy generated, ignored, secret-boundary, report, linked-worktree,
   mainnet, testnet, deployment, or production-evidence paths.
5. Run focused tests, affected typecheck/lint, and diff inspection before every
   atomic commit.
6. Replace all `PENDING_*` target-commit values with actual commit SHAs and
   validation evidence in the final recovery report commit.
7. Do not push or deploy without a later explicit user authorization.
