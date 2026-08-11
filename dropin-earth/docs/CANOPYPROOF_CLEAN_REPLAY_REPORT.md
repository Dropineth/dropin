# CanopyProof Phase R0 Clean Replay Report

Status: Clean replay passed with explicit release blockers
Replay date: 2026-07-28
Integration content SHA:
`6a7ec9443bee970779c2a6521e7320dd5de37df1`

## Reproduction Environment

The final replay ran from the detached clean worktree:

`/tmp/canopyproof-final-replay/dropin-earth`

| Tool | Version |
| --- | --- |
| Node.js | `v22.23.1` |
| npm | `10.9.4` |
| PostgreSQL | `17.10` |
| OpenNext Cloudflare | `1.20.2` |
| OpenNext AWS core | `4.1.0` |
| Wrangler | `4.114.0` |

The Node/npm binaries came from the cached npm 10.9.4 toolchain used for the
production workflow contract. The clean install used optional dependencies and
did not reuse another worktree's `node_modules`.

## Command Results

| Gate | Result | Evidence |
| --- | --- | --- |
| `npm ci --include=optional` | PASS | 723 packages installed |
| `npm run lint` | PASS | no lint errors |
| `npm run typecheck` | PASS | all participating workspaces |
| `npm run test` | PASS | 647 passed, 0 failed |
| `npm run db:verify:canopyproof` | PASS | 40 passed, 0 failed |
| `npm run build` | PASS | all workspace builds completed |
| `npm run audit` | PASS | 0 moderate-or-higher vulnerabilities |
| `npm run ci` | PASS | lint, typecheck, unit, PGlite, build, audit |
| `npm --workspace apps/web run cf:build` | PASS | OpenNext Worker and assets generated |
| `npm run test:coverage` | PASS | clean all-source measurement emitted |
| `npm run test:coverage:ratchet` | PASS | configured bootstrap floors enforced |
| `npm run test:coverage:critical` | BLOCKED | script is not implemented |

The build prints the existing Next.js message that its ESLint plugin is not
detected in the app configuration. Independent strict lint passes. The warning
is retained as a nonblocking baseline warning; no lint rule was weakened.

The audit step experienced two transient registry transport retries during the
combined CI run, then completed successfully. The tracked audit report was
restored after each run and generated output was not staged.

## Database Gates

### PGlite

The 18-file CanopyProof integration command passed 40 of 40 tests. It covers
append-only audit behavior, evidence custody and verification, device and media
authority, NASA/GIBS fixture handling, MRV graph behavior, global disclosure,
mobile admission, funding accountability, early warning, organization
lifecycle/accreditation, root governance, and project lifecycle.

### Native PostgreSQL

A disposable loopback-only PostgreSQL 17.10 cluster was created at
`/tmp/canopyproof-pg17-r0-final` on port `55439`. It used a disposable database
and a non-bypass role. No production credential or database was used.

`npm run db:verify:canopyproof:native` passed 2 of 2 test files:

- forced RLS under a native non-bypass role;
- atomic and idempotent trust-registry behavior across native connections;
- native global-command-center spatial disclosure constraints.

The server was stopped, its temporary cluster and log were removed, and
temporary Homebrew compatibility symlinks were removed after the run.

## Coverage Evidence

Two clean all-source executions produced the following measurements:

| Run | Statements/lines | Branches | Functions | Result |
| --- | ---: | ---: | ---: | --- |
| Measurement | 67.15% | 74.03% | 72.42% | recorded |
| Authoritative ratchet | 67.17% | 74.04% | 72.42% | PASS |

The slight denominator difference comes from source loading order between the
plain measurement and thresholded run. The thresholded ratchet is the
authoritative R0 gate.

These numbers do not establish repository-wide 70 or 90 percent coverage.
Critical modules have not established 95 percent in every dimension.
`test:coverage:critical` is absent, so the policy's critical gate remains
fail-closed.

## OpenNext Artifacts

`cf:build` generated:

| Artifact | Verification |
| --- | --- |
| `apps/web/.open-next/worker.js` | present, 2,278 bytes |
| `apps/web/.open-next/assets/` | present |
| `apps/web/public/icon.jpg` | present, 18,136 bytes |
| `apps/web/public/apple-touch-icon.jpg` | present, 18,136 bytes |
| `apps/web/public/sitemap.xml` | present, 359 bytes |
| `apps/web/public/icon.svg` | absent as required |

No `.open-next`, `.wrangler`, or other generated output is committed.

## Workerd Smoke

Wrangler preview served the following local Web Worker routes:

| Route | Status |
| --- | ---: |
| `/` | 200 |
| `/dashboard/global` | 200 |
| `/explorer` | 200 |
| `/governance` | 200 |
| `/terra` | 200 |
| `/mobile/report` | 200 |
| `/robots.txt` | 200 |
| `/sitemap.xml` | 200 |
| `/icon.jpg` | 200 |

Miniflare could not enrich `Request.cf` after one TLS disconnect and one
timeout, then used its documented local placeholder. This did not affect route
results.

The local Web Worker returned 404 for
`/api/canopyproof/dashboard/global`. This is expected in the web-only preview:
API and Web Workers remain separated, and the command center fails closed when
the API worker is unavailable.

## Browser Gate

The interactive visualization was tested with a same-origin browser-only
intercept for the dashboard snapshot endpoint. The synthetic response conformed
to the strict generalized-only schema and contained no raw location, bounding
box, project, evidence, or geometry payload.

| Check | Result |
| --- | --- |
| Desktop 1440 x 900 | PASS |
| Mobile 390 x 844 | PASS |
| Horizontal overflow | none |
| Canvas engine | `three.js r181` |
| Desktop non-background pixels | 176,570 / 646,912 (27.294%) |
| Mobile non-background pixels | 61,213 / 112,000 (54.654%) |
| OrbitControls redraw | 127,320 changed pixels (19.681%) |
| Marker batching | one `THREE.InstancedMesh` source batch |
| Instrumented instanced draw | vertex count 540, instance count 1 |
| Reduced-motion idle redraw | 0 instanced redraws in 600 ms |
| Browser console warnings/errors | none |

The intercept was test instrumentation only and did not modify source or
runtime configuration. Source and unit checks confirm one instanced marker
mesh and prohibit per-marker `new THREE.Mesh` allocation.

### Open Browser Gap

The component supplies an explicit `Canvas` fallback and uses
`frameloop="demand"`. The available browser controller did not permit
pre-document WebGL API injection, so a cold start with WebGL unavailable could
not be tested. Losing the live WebGL context did not replace the canvas with the
static fallback. This gate remains unverified and blocks release promotion.

## Final Safety Check

The final candidate-source secret scan returned
`SECRET_MARKER_FINDINGS=0`. Generated directories remain ignored, and
`git status --short` was empty before final documentation edits.

No push, workflow dispatch, Cloudflare deployment, production mutation, or
production evidence update was performed.
