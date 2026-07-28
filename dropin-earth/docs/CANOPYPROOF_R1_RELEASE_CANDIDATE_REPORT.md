# CanopyProof R1 Release Candidate Report

Status: PUSH_READY

Report date: 2026-07-28

This status means the isolated local candidate passed the R1 engineering
gates. It does not mean pushed, remotely reviewed, approved, deployed, or
production-unlocked.

## Commit Chain

| Role | Commit |
| --- | --- |
| R0 integration | `6a7ec9443bee970779c2a6521e7320dd5de37df1` |
| R0 evidence | `7f7729c567016ed0eff92b7db61e41bcc57b2285` |
| R1 critical coverage | `b172fe00b64c064b46337d53515d96f1e9c78d7b` |
| R1 WebGL fallback | `24eb9e4e29257bf36a76f47d64655831bb147ddd` |
| R1 evidence | `FINAL_R1_EVIDENCE_COMMIT` |

`FINAL_R1_EVIDENCE_COMMIT` is the documentation-only commit containing this
report. A commit cannot contain its own Git object ID. The actual evidence SHA
is reported by Git after the commit is created.

## Gate Results

| Gate | Result | Evidence |
| --- | --- | --- |
| R0 commit chain | PASS | integration is an ancestor of evidence |
| Deleted-file reconciliation | PASS | zero R0 or R1 deletions; no unresolved entry |
| Test-count reconciliation | PASS | no committed suite silently disappeared |
| Exact clean install | PASS | Node 22.23.1, npm 10.9.4, 726 packages |
| Lint | PASS | no lint errors |
| Typecheck | PASS | all participating workspaces |
| Unit tests | PASS | 809/809 |
| FiftyOne | PASS | 4/4 |
| PGlite | PASS | 40/40 |
| Native PostgreSQL 17.10 | PASS | 2/2, RLS and two-connection concurrency |
| Workspace build | PASS | all workspaces |
| Moderate audit | PASS | 0 vulnerabilities |
| Combined CI | PASS | complete local command |
| Repository coverage ratchet | PASS | 67.35/76.49/73.06/67.35 |
| Critical module coverage | PASS | every module >=95% in all four metrics |
| OpenNext Cloudflare | PASS | Worker and assets generated |
| Workerd smoke | PASS | 9/9 required routes |
| Desktop Chromium WebGL | PASS | nonblank, one InstancedMesh, interactive |
| Mobile Chromium WebGL | PASS | no overflow, controls operable |
| No-WebGL fallback | PASS | deterministic static projection |
| Cold chunk fallback | PASS | deadline bounded; no late duplicate renderer |
| Context loss | PASS | static fallback and one controlled recovery |
| Reduced motion | PASS | readable nonanimated fallback |
| Spatial privacy | PASS | generalized only; withheld remains withheld |
| R1 secret marker scan | PASS | `SECRET_MARKER_FINDINGS=0` |
| Generated artifact boundary | PASS | no generated path in R1 commit diff |

## Artifact Verification

- `apps/web/.open-next/worker.js`: present
- `apps/web/.open-next/assets`: present
- `apps/web/public/icon.jpg`: present and served as JPEG
- `apps/web/public/apple-touch-icon.jpg`: present
- `apps/web/public/sitemap.xml`: present
- `apps/web/public/icon.svg`: absent

Generated OpenNext, Next.js, Wrangler, coverage, and audit outputs are not part
of the R1 commits.

## Safety Boundaries

- `CANOPY_PRODUCTION_UNLOCK` remains disabled.
- Production mobile sync remains disabled.
- Satellite providers remain deterministic mock/fixture adapters.
- No real AWS/KMS request was made; KMS remains verify-only.
- API and Web Workers remain separated.
- Admin proxying remains blocked.
- Agents remain advisory and cannot become final authority.
- Mainnet funds remain disabled.
- Automatic CANOPY distribution remains disabled.
- Certified carbon-credit claims remain disabled.
- Carbon-tax offset claims remain disabled.
- Guaranteed-yield claims remain disabled.

## Documented Limitations

1. Repository-wide statements and lines are 67.35 percent. The no-regression
   ratchet passes, but the staged 70 percent Gate 1 is not yet complete.
2. Firefox and WebKit binaries were unavailable. Their browser fallback matrix
   is unverified; Chromium desktop and mobile passed the required R1 gate.
3. Next.js prints a flat-config plugin-detection warning during build.
   Independent strict lint passes, and no lint or CSP rule was weakened.
4. The candidate has not been reconciled with the current authoritative remote
   branch and has not received independent human review.

## Release Boundary

The local branch is suitable for the next controlled step: remote
reconciliation and human code review without force push. No push, workflow
dispatch, production deployment, production report update, tag change, or
production write occurred during R1.

The release state is:

`PUSH_READY`

The production state is:

`NOT_DEPLOYED_BY_R1`
