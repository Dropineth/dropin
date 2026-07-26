# CanopyProof Coverage Policy

Status: Enforced ratchet designed; institutional target not yet met  
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

The Phase R0 dirty-tree measurement on 2026-07-26 is:

| Dimension | Measured | Existing bootstrap floor |
| --- | ---: | ---: |
| Statements | 65.58% | 65.00% |
| Lines | 65.58% | 65.00% |
| Branches | 73.87% | 72.75% |
| Functions | 70.40% | 69.50% |

This run completed the unit suite but is not release-candidate evidence because
it was measured in the dirty source tree. The clean integration worktree must
establish the committed baseline. The floor may rise after that measurement; it
may not fall without a separately reviewed RFC amendment and retained before/
after evidence.

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

The dirty-tree measurement does not yet satisfy this policy. Examples:

| Critical source | Statements | Branches | Functions | Result |
| --- | ---: | ---: | ---: | --- |
| `packages/dropin-protocol/src/canopy-state-machine.ts` | 91.13% | 77.41% | 92.50% | Blocked |
| `packages/schemas/src/satellite-proof.schema.ts` | 85.50% | 75.00% | 55.00% | Blocked |
| Satellite optical/SAR adapters | 84.21-93.33% | 75.00-81.81% | 100% | Blocked |
| `mobile-evidence-sync-admission.ts` | 96.69% | 80.00% | 73.68% | Blocked |
| `aws-kms-managed-signature-verifier.ts` | 95.00% | 80.40% | 100% | Blocked |
| Metadata orchestration authority | 97.45% | 62.96% | 86.66% | Blocked |
| `authorization-binding.ts` | 84.43% | 89.52% | 80.64% | Blocked |

Percentages above are diagnostic dirty-tree evidence, not a committed baseline.

## 5. Required Commands

The clean release-candidate gate must run:

```bash
npm run test:coverage
npm run test:coverage:ratchet
npm run test:coverage:critical
```

`test:coverage:critical` must fail if any allowlisted critical file falls below
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

Repository-wide 90 percent coverage is **not achieved**. Critical-module 95
percent coverage is **not achieved**. Phase R0 may construct the atomic commit
chain, but the release-candidate matrix must remain blocked until the clean
worktree measurements and critical gate pass.
