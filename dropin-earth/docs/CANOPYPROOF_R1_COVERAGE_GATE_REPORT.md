# CanopyProof R1 Critical Coverage Gate Report

Status: PASS

Verification date: 2026-07-28

R1 implementation SHA:
`24eb9e4e29257bf36a76f47d64655831bb147ddd`

## Gate Design

The critical coverage gate is defined by
`config/canopyproof-critical-coverage.json` and enforced by:

- `scripts/canopyproof-critical-coverage-runner.mjs`
- `scripts/canopyproof-critical-coverage-normalizer.mjs`
- `scripts/canopyproof-critical-coverage-gate.mjs`

Each configured module is evaluated independently. Statements, branches,
functions, and lines must each be at least 95 percent. The gate also fails for
missing or stale coverage data, missing configured source files, generated-file
substitution, invalid path ownership, and malformed coverage records.

The existing repository-wide no-regression ratchet remains in place. The
critical gate does not replace or lower it.

## Critical Module Results

| Module | Statements | Branches | Functions | Lines | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| Satellite state machine | 99.92% | 98.18% | 100.00% | 99.92% | PASS |
| Satellite schema and roots | 100.00% | 96.88% | 100.00% | 100.00% | PASS |
| Satellite deterministic adapters | 100.00% | 100.00% | 100.00% | 100.00% | PASS |
| Mobile evidence vault | 98.34% | 96.55% | 100.00% | 98.34% | PASS |
| Mobile sync authority | 99.77% | 95.95% | 100.00% | 99.77% | PASS |
| Security and authorization | 99.46% | 97.51% | 100.00% | 99.46% | PASS |
| KMS verify-only adapter | 98.92% | 97.01% | 100.00% | 98.92% | PASS |
| Metadata extraction | 99.38% | 96.31% | 100.00% | 99.38% | PASS |
| Effective-media orchestration | 100.00% | 97.96% | 100.00% | 100.00% | PASS |
| Audit and challenge invariants | 99.81% | 96.62% | 100.00% | 99.81% | PASS |
| Global spatial disclosure | 99.77% | 96.03% | 100.00% | 99.77% | PASS |

The instrumented critical test set measured 99.56 percent statements and
lines, 95.61 percent branches, and 93.14 percent functions in aggregate.
Aggregate function coverage is not the policy decision: every configured
critical module independently passed all four 95 percent thresholds.

## Repository-Wide Ratchet

The clean all-source ratchet measured:

| Metric | R1 result | Configured floor | Result |
| --- | ---: | ---: | --- |
| Statements | 67.35% | 65.00% | PASS |
| Branches | 76.49% | 72.75% | PASS |
| Functions | 73.06% | 69.50% | PASS |
| Lines | 67.35% | 65.00% | PASS |

This is a no-regression pass and an improvement over the R0 authoritative
statement/line measurement of 67.17 percent. It does not claim that the staged
repository-wide 70 percent Gate 1 or the long-term 90 percent target is
complete.

## Meaningful Edge Coverage

R1 tests cover the requested adverse paths, including:

- simultaneous and tampered satellite challenges;
- wrong baseline, premature certificate, and premature unlock;
- wrong vault key, corrupt envelopes, stale CAS, migration interruption,
  terminal rollback, and quota exhaustion;
- actor and organization quota races, stale authority, forged policy metadata,
  idempotency replay, body limits, and cross-tenant denial;
- wrong KMS ARN, KeySpec, algorithm, malformed public key, provider outage,
  and fail-closed verification;
- expired metadata dispatch, authority drift, duplicate response, timeout, and
  sensitive-field redaction;
- append-only mutation rejection, unauthorized transitions, role escalation,
  absent audit lineage, and JSON NULL constraints;
- raw-coordinate absence, deterministic generalized output, independent
  reviews, withheld regions, and tenant boundaries.

## Commands

The following passed from the clean R1 replay worktree:

```bash
npm run test:critical
npm run coverage:critical
npm run test:coverage:ratchet
```

Generated coverage output remains ignored and is not part of the commit.
