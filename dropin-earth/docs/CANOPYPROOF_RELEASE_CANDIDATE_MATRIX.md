# CanopyProof Phase R0 Release Candidate Matrix

Status: R0 baseline PASS; production release BLOCKED
Integration content SHA:
`6a7ec9443bee970779c2a6521e7320dd5de37df1`

## Gate Matrix

| Gate | Status | Evidence or blocker |
| --- | --- | --- |
| Inventory before integration | PASS | 1,061 snapshot paths classified |
| Path disposition | PASS | 436 include, 636 exclude |
| Actual diff reconciliation | PASS | 435 changed paths plus one baseline-identical reviewed path |
| Duplicate-path isolation | PASS | three duplicate families excluded |
| Generated-artifact boundary | PASS | generated output not committed |
| Candidate secret scan | PASS | `SECRET_MARKER_FINDINGS=0` |
| Atomic subsystem commits | PASS | 21 commits after the base |
| Exact clean install | PASS | Node 22.23.1, npm 10.9.4 |
| Lint | PASS | strict command completed |
| Typecheck | PASS | all participating workspaces |
| Unit tests | PASS | 647/647 |
| PGlite integration | PASS | 40/40 |
| Native PostgreSQL 17.10 | PASS | 2/2 files, RLS and concurrency included |
| Workspace build | PASS | all workspaces |
| Moderate dependency audit | PASS | 0 vulnerabilities |
| Combined CI | PASS | complete local CI command |
| OpenNext Cloudflare build | PASS | Worker and static assets present |
| Workerd routes | PASS | 9/9 routes returned 200 |
| Desktop WebGL | PASS | nonblank, one instanced batch, interactive |
| Mobile WebGL | PASS | nonblank, no overflow |
| Generalized-coordinate privacy | PASS | strict fixture payload; no raw coordinates |
| Reduced motion | PASS | demand-render loop remained idle |
| WebGL unavailable cold start | BLOCKED | browser controller could not inject before document load |
| WebGL context-loss recovery | BLOCKED | live context loss did not display static fallback |
| Repository Gate 1 coverage | BLOCKED | statements/lines remain 67.17% |
| Critical-module 95% coverage | BLOCKED | required script is absent |
| Remote branch reconciliation | NOT RUN | outside R0 and requires fresh review |
| Human release approval | NOT REQUESTED | R0 does not authorize release |
| Push, workflow, deploy | NOT RUN | expressly prohibited |

## Production Boundary Matrix

| Boundary | State |
| --- | --- |
| `CANOPY_PRODUCTION_UNLOCK` | disabled |
| Production mobile sync | disabled |
| Real satellite provider writes | disabled |
| Real AWS signing or mutation | disabled |
| KMS capability | verify-only |
| API and Web Worker topology | separated |
| Admin proxy | blocked |
| Mainnet funds | disabled |
| Automatic CANOPY distribution | disabled |
| Certified carbon-credit claims | not enabled |
| Carbon-tax offset claims | not enabled |
| Guaranteed-yield claims | not enabled |
| Agent final authority | prohibited |

## Release Decision

The atomic chain is suitable for architectural and security review as a
reproducible Phase R0 baseline. It is not suitable for production release or
deployment.

Promotion requires all of the following:

1. implement `test:coverage:critical` with an explicit first-party file
   allowlist and 95 percent thresholds in every dimension;
2. raise or formally gate repository coverage according to
   `docs/COVERAGE_POLICY.md`;
3. add deterministic browser coverage for WebGL-unavailable cold start and
   context-loss recovery;
4. reconcile the detached chain with the current authoritative remote without
   force push;
5. obtain independent human review and a separately approved release process.

Until those conditions pass, the correct state is:

`R0_BASELINE_READY_FOR_REVIEW`

and not:

`PRODUCTION_READY`
