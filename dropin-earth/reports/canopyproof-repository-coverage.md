# CanopyProof Repository Coverage

Status: PASS

Generated: 2026-08-11T11:33:26.875Z

| Metric | Before | After | Delta | Gate | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Statements | 67.36% | 83.83% | +16.47 pp | 70.00% | PASS |
| Branches | 76.50% | 76.81% | +0.31 pp | 72.75% | PASS |
| Functions | 73.06% | 85.51% | +12.45 pp | 70.00% | PASS |
| Lines | 67.36% | 83.83% | +16.47 pp | 70.00% | PASS |

The measurement retains `c8 --all` across every first-party app, package,
and service source path. It adds the existing PGlite authority scenarios
to the unit suite rather than excluding uncovered production code.

## Test Files Added

- `tests/unit/canopyproof-cross-browser-webgl-contract.test.ts`
- `tests/unit/canopyproof-repository-coverage-gate.test.ts`

## Included Integration Suites

- `tests/integration/canopyproof-postgres-audit.integration.ts`
- `tests/integration/*-pglite.integration.ts`
