# CanopyProof Phase R1 Release Candidate Matrix

Status: PUSH_READY; not pushed, approved, or deployed

R1 implementation SHA:
`24eb9e4e29257bf36a76f47d64655831bb147ddd`

## Gate Matrix

| Gate | Status | Evidence or next boundary |
| --- | --- | --- |
| R0 commit chain | PASS | integration and evidence objects verified |
| Deleted-file disposition | PASS | zero deletions; no unresolved entry |
| Historical test delta | PASS | explicit manifest and suite ownership contract |
| Generated-artifact boundary | PASS | generated output absent from commit diff |
| Candidate secret scan | PASS | `SECRET_MARKER_FINDINGS=0` |
| Atomic R1 implementation commits | PASS | coverage and WebGL concerns separated |
| Exact clean install | PASS | Node 22.23.1, npm 10.9.4 |
| Lint | PASS | strict command completed |
| Typecheck | PASS | all participating workspaces |
| Unit tests | PASS | 809/809 |
| FiftyOne | PASS | 4/4 |
| PGlite integration | PASS | 40/40 |
| Native PostgreSQL 17.10 | PASS | 2/2, forced RLS and concurrency |
| Workspace build | PASS | all workspaces |
| Moderate dependency audit | PASS | 0 vulnerabilities |
| Combined CI | PASS | complete local CI command |
| Repository no-regression coverage | PASS | 67.35/76.49/73.06/67.35 |
| Repository Gate 1 coverage | OPEN TARGET | statements/lines below staged 70% target |
| Critical-module 95% coverage | PASS | every module passes all four metrics |
| OpenNext Cloudflare build | PASS | Worker and static assets present |
| Workerd routes | PASS | 9/9 routes returned 200 |
| Desktop WebGL | PASS | nonblank, one InstancedMesh, interactive |
| Mobile WebGL | PASS | no overflow, controls operable |
| Generalized-coordinate privacy | PASS | no raw coordinates; withheld remains withheld |
| WebGL unavailable cold start | PASS | static fallback visible, no blank canvas |
| Dynamic import failure | PASS | bounded fallback |
| Cold chunk timeout | PASS | late module cannot duplicate renderer |
| WebGL context-loss recovery | PASS | fallback plus one controlled retry |
| Reduced motion | PASS | readable nonanimated fallback |
| Firefox/WebKit compatibility | NOT RUN | pinned browser binaries unavailable |
| Remote branch reconciliation | NOT RUN | next controlled step |
| Independent human review | NOT REQUESTED | required before remote promotion |
| Push, workflow, deploy | NOT RUN | expressly prohibited in R1 |

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

## Decision

R1 closes the two R0 release-candidate blockers: every critical module now has
an enforced independent 95 percent coverage gate, and deterministic browser
tests prove WebGL cold-start, chunk-failure, context-loss, reduced-motion, and
mobile fallback behavior.

The isolated local candidate is:

`PUSH_READY`

This authorizes neither production nor an automatic push. Remote
reconciliation, independent human review, guarded workflow approval, and any
deployment remain separate future steps.
