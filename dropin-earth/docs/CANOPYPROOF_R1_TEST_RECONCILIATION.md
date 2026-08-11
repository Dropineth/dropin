# CanopyProof R1 Test Reconciliation

Status: PASS

Verification date: 2026-07-28

## Suite Inventory

| Suite | Files | Clean replay result | Owning command |
| --- | ---: | ---: | --- |
| Root TypeScript unit/workflow contracts | 109 | 809/809 | `npm run test` |
| PGlite integration | 18 | 40/40 | `npm run db:verify:canopyproof` |
| Native PostgreSQL 17.10 | 2 | 2/2 | `npm run db:verify:canopyproof:native` |
| FiftyOne Python adapter | 1 | 4/4 | `npm run test:fiftyone` |
| Playwright WebGL browser | 1 | 7/7 scenarios | `npm run test:webgl:browser` |
| Solana Anchor | 1 | retained, separate toolchain | `npm run anchor:test` |

The Node test summary reports 697 top-level tests and 809 total tests after
nested deterministic subtests. Both values are expected; 809 is the
clean-replay pass count.

## R0 To R1 Delta

R0 contained 100 root unit files and passed 647 runtime tests. R1 contains 109
root unit files and passes 809 runtime tests. Nine files were added:

- seven critical-path behavior and coverage-gate suites;
- one WebGL lifecycle/fallback suite;
- one first-party test ownership contract.

Existing test files were expanded for KMS, metadata, challenge, audit,
environmental proof, mobile vault, and sync admission edge cases. No committed
unit, integration, Python, browser, Solana, or workflow-contract test was
deleted in R1.

`docs/R1_TEST_MANIFEST_DELTA.md` reconciles the earlier dirty-tree count, the
R0 base, R0 integration, and R0 evidence commits. The R1 suite ownership test
now fails when:

- a first-party test file is outside a declared suite family;
- an integration file is not assigned exactly once to PGlite or native
  PostgreSQL;
- FiftyOne, Solana, browser, coverage, native PostgreSQL, or CI ownership is
  removed.

## Database Replay

PGlite passed all 40 tests, including contract application, rollback of empty
authorities, append-only constraints, tenant isolation, authority replay,
challenge adversity, and serialized project transitions.

A loopback-only disposable PostgreSQL 17.10 cluster passed both native files:

- forced RLS was verified under a non-bypass role;
- two independent Prisma connections verified atomic and idempotent writes;
- the complete native contract list was replayed in dependency order;
- append-only mutation attempts were rejected.

The initial harness URL omitted the disposable cluster's local superuser and
Prisma correctly failed with `P1010`. The harness was corrected to name that
ephemeral local user; no source change or production credential was involved.
The server, temporary data directory, and temporary Homebrew keg-only links
were removed after the passing run.

## Clean Replay Commands

The R1 candidate was replayed from:

`/tmp/canopyproof-r1-final-replay/dropin-earth`

at detached implementation SHA:

`24eb9e4e29257bf36a76f47d64655831bb147ddd`

Using Node.js `v22.23.1` and npm `10.9.4`, the following passed:

```bash
npx -p npm@10.9.4 npm ci --include=optional
npm run lint
npm run typecheck
npm run test
npm run build
npm run audit
npm run ci
npm run test:coverage:ratchet
npm run coverage:critical
npm --workspace apps/web run cf:build
npm run test:webgl:browser
```

`npm run ci` independently repeated lint, typecheck, 809 unit tests, 4
FiftyOne tests, 40 PGlite tests, all workspace builds, and audit. Its audit
transport retried once and then returned zero moderate-or-higher
vulnerabilities.
