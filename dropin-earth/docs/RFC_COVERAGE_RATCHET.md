# RFC: CanopyProof Source Coverage Ratchet

Status: Implemented and verified locally; remote CI execution pending

Date: 2026-07-14

Owners: CanopyProof Architecture, Security, and Quality Engineering

## 1. Problem

CanopyProof had a Node.js native coverage command, but the repository pull-
request workflow recorded coverage without enforcing a minimum. More
importantly, `--test-coverage-include` filtered modules observed by V8 but did
not place a completely unloaded source file into the denominator. A controlled
run over an unimported production file returned an empty 100 percent report.
The earlier 82.16 percent line result was therefore loaded-module coverage, not
all-source coverage, and is superseded.

The corrected local baseline uses `c8 --all` across all first-party
TypeScript/TSX source. The latest Node.js 22.22.3 with npm 10.9.4 run measures
65.83 percent statements/lines, 73.58 percent branches, and 70.80 percent
functions with 817 unit tests over the current source denominator. An earlier pre-E3c Node.js
24.14.0 run measured 65.71 percent statements/lines, 73.41 percent branches,
and 69.99 percent functions; it has not been rerun against the current source
denominator. The institutional target remains greater than 90 percent meaningful
coverage.

The system must prevent silent regression without misrepresenting the current
shortfall as attainment of the 90 percent target. The authoritative CI runtime
is Node.js 22. The local Node.js 22 result proves runtime compatibility, but it
does not substitute for a clean reviewed commit and retained GitHub Actions
artifact.

## 2. Decision

Use a pinned direct `c8` development dependency with `--all` so files never
loaded by the unit suite enter the denominator at zero. Add a separate
`test:coverage:ratchet` command with `--check-coverage`. Keep `test:coverage` as
a threshold-free measurement command so engineers can inspect the complete
report without changing policy. Both commands write a per-file JSON summary and
print a concise text summary.

The bootstrap policy is:

| Dimension | Bootstrap minimum | Node.js 22 local baseline | Institutional target |
| --- | ---: | ---: | ---: |
| Statements | 65.00% | 65.83% | >90% |
| Lines | 65.00% | 65.83% | >90% |
| Branches | 72.75% | 73.58% | >90% |
| Functions | 69.50% | 70.80% | >90% |

The bootstrap values are below both current local runtime measurements. They
are a regression floor, not a quality pass. The first successful, committed
Node.js 22 pull-request run must be reviewed and used to raise these values to
the largest stable non-regression floor no more than 0.25 percentage points
below that measured remote baseline. Threshold reductions require a reviewed
RFC amendment with named rationale; ordinary feature pull requests may only
hold or increase them.

## 3. Scope

Both measurement and ratchet commands include every TypeScript and TSX source
file under:

- `apps/*/src/**`;
- `packages/*/src/**`;
- `services/*/src/**`.

Declaration files are excluded. Generated build output, dependencies, tests,
fixtures, reports, and infrastructure files are not counted as production
source. The ratchet does not replace PostgreSQL integration, browser E2E,
external-adapter, chaos, load, restore, or security testing.

## 4. CI Data Flow

1. The read-only repository workflow installs the locked dependency graph on
   Node.js 22 and npm 10.9.4.
2. Unit, PGlite, native PostgreSQL, workspace build, audit, and OpenNext gates
   execute independently.
3. `npm run test:coverage:ratchet` executes the same all-source unit suite
   with `c8 --all --check-coverage` and statement, line, branch, and function
   thresholds.
4. The complete report is streamed to the job log and written to
   `reports/ci/canopyproof-coverage.txt`.
5. The text report and per-file `coverage/coverage-summary.json` are uploaded
   even when the gate fails, preserving diagnostic evidence for 30 days.
6. The workflow contains no deployment command, production environment,
   Cloudflare credential, or write permission.

## 5. Failure Semantics

- A test failure fails the ratchet.
- Falling below any one threshold fails the ratchet.
- A missing or empty report artifact is a workflow failure, not a warning.
- Coverage cannot be bypassed with `continue-on-error`, shell error suppression,
  or an alternate permissive audit level.
- A failed ratchet does not trigger deployment and does not alter production.

## 6. Threat Model

| Threat | Control |
| --- | --- |
| Test-count inflation hides untested code | Pinned `c8 --all` includes unloaded first-party files at zero. |
| Workflow runs only the measurement command | Contract test requires `--check-coverage` and all four thresholds. |
| Threshold silently reduced | Contract test pins bootstrap values; future changes require an explicit reviewed policy update. |
| Report is lost after failure | Artifact upload runs under `if: always()` and requires a file. |
| Coverage is presented as 90% compliant | Documentation records both the measured value and unmet target. |
| Coverage job gains deployment power | Workflow remains read-only and contains no production secrets or deploy commands. |
| Runtime mismatch creates false evidence | Node.js 22 is the CI authority; local Node.js 22 and Node.js 24 results are recorded separately, and only a retained remote artifact is release evidence. |

## 7. Testing

Required local evidence:

- `npm run test:coverage:ratchet` exits zero at the bootstrap floor;
- a controlled unimported-source test reports zero and exits non-zero under a
  one-percent threshold;
- the workflow contract test confirms Node.js 22, npm 10.9.4, exact ratchet
  command, all four threshold flags, fail-closed shell behavior, and required
  artifact preservation;
- `npm run ci` and OpenNext continue to pass.

Required repository evidence before calling the gate operational:

- a committed root workflow;
- a successful GitHub Actions run on Node.js 22;
- retained coverage report artifact;
- reviewed adjustment from bootstrap values to the first stable Node.js 22
  baseline.

## 8. Migration

1. Replace loaded-module measurement with pinned `c8 --all` and add the
   separate ratchet command.
2. Update the root workflow to execute and retain the ratchet report.
3. Expand the workflow contract test.
4. Validate locally on Node.js 22 and record secondary-runtime differences
   honestly.
5. Commit and run the root workflow through normal pull-request review.
6. Review the Node.js 22 artifact and raise the floor within 0.25 percentage
   points of the stable baseline.
7. Increase thresholds monotonically as missing production-module tests land.

## 9. Rollback

If the ratchet itself is defective, revert the script/workflow/test change as a
single unit while preserving the last coverage artifact and opening a quality
incident. Do not lower thresholds ad hoc, disable source inclusion, remove npm
audit, or add `continue-on-error`. Runtime production behavior and deployment
configuration are unaffected by this change.

## 10. Non-Goals

- claiming the greater-than-90-percent target is met;
- treating unit coverage as proof of database, browser, provider, or regional
  resilience;
- modifying production routes, Cloudflare Workers, funding, token, certificate,
  or claim behavior;
- activating any currently gated adapter or authority route.
