# CanopyProof Coverage Policy

Status: Gate 1 enforced and satisfied by the industrial release candidate
Effective date: 2026-07-26  
Owners: CanopyProof Architecture, Security, and Quality Engineering

## 1. Policy Objective

Coverage is a regression and review signal. It is not proof of correctness,
production readiness, PostgreSQL isolation, provider authenticity, browser
behavior, or institutional approval.

CanopyProof must never describe the repository as having greater than 90 percent
coverage until a clean, committed, all-source measurement proves it. Test-count
growth cannot substitute for source coverage.

## 2. Authoritative Measurement

The repository measurement must:

- run on the repository-pinned Node.js runtime and npm 10.9.4;
- use pinned `c8` with `--all`;
- include every first-party TypeScript and TSX file under `apps/*/src`,
  `packages/*/src`, and `services/*/src`;
- exclude declarations, generated output, dependencies, tests, fixtures, and
  reports only;
- fail when any configured threshold regresses; and
- retain `coverage/coverage-summary.json` as CI evidence without committing it.

The clean industrial release-candidate measurement on 2026-07-28 is:

| Dimension | Measured | Enforced floor |
| --- | ---: | ---: |
| Statements | 83.08% | 70.00% |
| Lines | 83.08% | 70.00% |
| Branches | 76.91% | 72.75% |
| Functions | 83.34% | 70.00% |

The measurement ran with `c8 --all` over every first-party source scope and
included the single-threaded PGlite integration suites that exercise durable
repository behavior. It did not exclude production source to change the
denominator. Generated output remains untracked; CI retains the JSON summary and
the before/after report as run artifacts.

The active floor may rise after a separately reviewed ratchet change. It may not
fall without a reviewed RFC amendment and retained before/after evidence.

## 3. Staged Repository Targets

| Gate | Statements | Lines | Branches | Functions | Meaning |
| --- | ---: | ---: | ---: | ---: | --- |
| Bootstrap | 65.00% | 65.00% | 72.75% | 69.50% | Non-regression only |
| Gate 1 | 70% | 70% | 70% | 70% | First recovery target |
| Gate 2 | 75% | 75% | 75% | 75% | Institutional beta floor |
| Gate 3 | 85% | 85% | 85% | 85% | Release-hardening floor |
| Long term | 90% | 90% | 90% | 90% | Repository objective |

Passing the bootstrap floor is not passing Gate 1. Progression is monotonic.

## 4. Critical Module Policy

New or materially changed authority-bearing modules must reach at least 95
percent statements, lines, branches, and functions before production
activation:

1. satellite state machine, schemas, root builder, and deterministic adapters;
2. mobile sync admission, authorization, and denial paths;
3. verify-only AWS KMS verifier and transport boundary;
4. metadata extraction and effective-media orchestration;
5. audit integrity and authorization-binding paths.

The critical gate must enumerate exact source files and must not use broad
coverage exclusions. PostgreSQL repositories must be measured with their PGlite
integration tests in addition to unit tests. Native PostgreSQL behavior,
two-connection serialization, RLS, append-only mutation denial, JSON NULL
constraints, and replay remain separate mandatory gates even when line coverage
is 95 percent.

The clean candidate satisfies the critical-module gate:

| Critical module | Statements | Branches | Functions | Lines |
| --- | ---: | ---: | ---: | --- |
| Satellite state machine | 99.92% | 98.18% | 100.00% | 99.92% |
| Satellite schemas and root builder | 100.00% | 96.88% | 100.00% | 100.00% |
| Deterministic satellite adapters | 100.00% | 100.00% | 100.00% | 100.00% |
| Mobile evidence vault | 98.34% | 96.58% | 100.00% | 98.34% |
| Mobile sync authority | 99.77% | 96.00% | 100.00% | 99.77% |
| Security authorization | 99.46% | 97.68% | 100.00% | 99.46% |
| KMS verify-only boundary | 98.92% | 97.01% | 100.00% | 98.92% |
| Metadata extraction | 99.38% | 96.71% | 100.00% | 99.38% |
| Effective-media orchestration | 100.00% | 97.96% | 100.00% | 100.00% |
| Audit and challenge invariants | 99.81% | 96.63% | 100.00% | 99.81% |
| Global spatial disclosure | 99.77% | 96.03% | 100.00% | 99.77% |

V8 source-map entries are normalized only when the TypeScript parser proves
that an uncovered entry maps to a non-executable import, closing brace,
out-of-source location, or duplicate export binding. Every removal is recorded
in the critical coverage provenance artifact.

## 5. Required Commands

The clean release-candidate gate must run:

```bash
npm run test:coverage
npm run test:coverage:ratchet
npm run ci:critical
```

`ci:critical` must fail if any allowlisted critical file falls below
95 percent in any dimension or is absent from the report. It must run the exact
unit and PGlite tests needed to exercise those files. A missing report, empty
allowlist, skipped integration suite, or wildcard that silently drops an
unloaded file is a failure.

## 6. Change Control

- Threshold reductions require a reviewed RFC and retained evidence.
- New critical authority modules enter the critical allowlist in the same
  commit as the module.
- Generated coverage output is never committed.
- `continue-on-error`, ignored exit codes, permissive alternate commands, and
  test-only source exclusions are prohibited.
- Coverage failures cannot trigger a deploy or production mutation.

## 7. Non-Coverage Gates

Coverage never replaces:

- typecheck and lint;
- deterministic replay and root parity;
- PGlite and native PostgreSQL migration tests;
- `NOBYPASSRLS` and dual-connection concurrency tests;
- append-only and JSON NULL mutation tests;
- OpenNext/workerd smoke tests;
- desktop/mobile/WebGL browser tests;
- secret scanning, dependency audit, and unsafe-claim scanning; or
- human governance approval.

## 8. Current Decision

Repository Gate 1 is achieved and enforced. Every configured critical module
passes 95 percent in statements, branches, functions, and lines.

Repository-wide 90 percent coverage is **not achieved**. Coverage therefore
supports this release candidate but does not authorize staging or production.
Remote CI, independent review, protected staging, security and load validation,
backup/restore, failure injection, and the 12-hour soak remain separate gates.
