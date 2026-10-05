# R3.2.1 Center integration — 2026-10-06

Status: **PRECOMMIT / IN_PROGRESS — AUDIT BLOCKED — NOT RELEASE APPROVED**. This phase continues [PR #4](https://github.com/Dropineth/dropin/pull/4) from `a9c83284cf41179e2ef9935436912ba0f4f5d5d0`. The new integration is in the working tree; its final commit, push and remote CI are not yet established by this document. No merge, production deployment, new Worker version or human approval is claimed.

## What changed

The existing Chinese and English Center pages (`/life/center`, `/en/life/center`) mount `SpatialOperations` **below the retained `FourShopPlan`**. The new workbench contains four-unit selection and floor filters, a logical collaboration network, synthetic task filters, local AHIN replay, and a downloadable unsigned demonstration record. The original source-plan component remains the source-image reference.

Ten source files live in `apps/web/src/components/life/spatial/`: `SpatialOperations.tsx`, `spatial-engine.mjs`, `spatial-engine.d.mts`, `spatial-data.mjs`, `scene-spec.mjs`, `spatial-scene.mjs`, `render-driver.mjs`, `software-renderer.mjs`, `sha256.mjs`, and `spatial.module.css`. These are ten module files, not ten independently deployed applications.

[The recorded byte-level change check](release-remediation/r3-2-1-20261006/change-boundary.json) confirms LifePages differs only by the import and one Center mount, FourShopPlan/lock diffs are empty, and the original checkout retains529status entries and its original status hash.

This integration adds no dependency, route, lockfile change or public image. It does not change the ecology homepage, Life Home implementation or `FourShopPlan`. Existing images, source rights, 33/29 unavailable-source boundaries, separate scene31 status, draft-only consultation, disabled robot commands, billing and telemetry remain applicable.

## Rendering and authority boundaries

- The live application deliberately sets `primaryEnabled:false`. It uses existing Three.js geometry with a Canvas2D software schematic; it does **not request a WebGL context**. WebGL is unaccepted and disabled, not reported as unsupported hardware. Future WebGL activation requires separate acceptance.
- Geometry, elevations, furniture and devices are authored schematics, not captured third-party assets, surveying, lease boundaries, navigation/collision permission or evidence of an operating venue. Areas remain L112 58.69, L203 135.80, L202 185.99, L201 290.78 m²; total 671.26 and second floor 612.57 m².
- Four `DEMO-*` tasks and five AHIN action labels are local fixtures. Exports are `LifePP_DEMO_replay_NOT_PRODUCTION.json`, unsigned, `isDemo:true`, `finalAuthority:false`, and zero external actions. Recomputable SHA-256 links attest only to consistency of these demo records; they do not prove permission, facts, delivery or real institutional receipt.
- The visible `SNAPSHOT` intentionally names the **2026-10-05 / a9c83284… historical state**, including Trust failure and 4 high findings. It is not a live CI status or acceptance of this new integration.
- Mount/unmount, renderer ownership, bounded fallback, first completed frame, context-loss lifecycle, event/listener disposal, timer/RAF cleanup and zero external calls have new test coverage. Mock lifecycle checks do not qualify the real GPU renderer.

## Validation state before commit

The existing `test:lifepp` wildcard includes **23 contract, 17 mocked renderer-lifecycle and 20 camera cases**, without replacing legacy tests. The first local Life suite was85/85 before the camera cases; the original full unit command later passed **943/943, zero failed/skipped** (883 previous +60 new) after the camera correction. Mock lifecycle and software-camera checks do not qualify the real GPU renderer.

`lifepp-spatial-browser-check.mjs` runs inside the ten Center locale/width results of the existing `tests/browser/lifepp.spec.ts` **150-result matrix**. Both Next and workerd registrations remain. Checks cover five widths, both locales, room/node/floor focus, Tab keys, synthetic task filtering, replay pause/reset, real local JSON download and independent chain recomputation, no storage/external action, language changes and return to the ecology home. The latest local Chromium run actually passed all150 results, including those ten Center results; its separate existing MapLibre fixture passed2/2. This is not all-engine or workerd acceptance.

Every run below used Node22.22.3 / npm10.9.4 over dirty source based on a9c83284…. All original command log hashes below were independently matched. Full fingerprints, UTC times, commands, exits and hashes are in [the compact validation receipt](release-remediation/r3-2-1-20261006/local-validation-in-progress.json); no union of these rows is a green committed candidate.

| Run / UTC on2026-10-05 | Source fingerprint prefix | Actual result and scope |
| --- | --- | --- |
| Initial log-only diagnostics (individual logs) | Individual log-only scope; no uniform fingerprint claim | Life85, full units923, web types and525tracked/nonignored source lint PASS. Original lint FAIL3322; supply-chain PASS716components/0secret findings/0tracked generated artifacts |
| Browser attempt1 /19:00:56–19:04:19 | `940cf590…` | Build PASS; Life150PASS, then MapLibre response timeout: combined command FAIL. Extra local API build setting absent from CI |
| Browser attempt2 /19:05:26–19:14:04 | `940cf590…` | Build PASS. Chromium150/150 and Firefox150/150 PASS; macOS WebKit128/150 with22FAIL. Each wrapper's MapLibre Chromium fixture passed2/2 |
| Local DB /19:06:20–19:07:24 | `940cf590…` | PGlite40/40 and Python4 PASS |
| Camera-corrected local-final /19:24:50–19:26:47 | `37957b51…` | Original full units943/943,0failed/skipped and web types PASS; source/lock stable across commands |
| Browser attempt3 /19:24:14–19:26:44 | `37957b51…` | Build PASS; Chromium140/150, ten Center failures caused by test-helper `ReferenceError: __name is not defined` |
| Browser attempt4 /19:28:00–19:30:29 | `29080550…` | Build PASS; Chromium140/150, ten Center failures caused by test-helper undefined `labels` result |
| Final original-source lint /19:34:16–19:34:22 | Log/command receipt; no uniform fingerprint claim | All526tracked and nonignored new JS/TS source files PASS; original whole-workspace lint failure stays recorded |
| Browser attempt5 /19:34:14–19:37:23 | `d81a9932…` | Chromium150/150 + MapLibre2/2 PASS;117 full-page screenshots. Reuses the unchanged compiled app from build4 after a helper-only correction; no new build result is fabricated |

The actual375px software-canvas/label clipping defect was corrected in the component and covered by20camera cases. After that fix, only the browser helper changed between attempts3–5. For the final reuse, [the build-binding record](release-remediation/r3-2-1-20261006/reuse-build.json) reconstructs build4's exact whole-source fingerprint by reversing only the three-line helper correction. All243compiled files (`BUILD_ID`, `.next/server`, `.next/static`) retain aggregate SHA256 `e40c09094bceedc0440bc99d406bfc266b4ed773a977ebad167a424d7155ab0f` before and after attempt5. Build4 retains its original fingerprint; attempt5 does not relabel it as a fresh build.

Local lint remains split: the original `npm run lint` scanned ignored restored attachment/review packages and failed with3322 errors; the original log is retained. An initial diagnostic linted525Git-tracked/nonignored JS/TS source files; the final diagnostic reran over all526such files and passed. Both exact commands and hashes are recorded separately. No ESLint ignore rule was broadened and no restored data was deleted. A fresh clean-checkout CI **must run the original lint command**; the diagnostic does not replace that gate. The final committed source still requires the complete original CI checks.

Attempt1's actual MapLibre failure remains recorded after the extra local API build setting was removed to match CI for attempt2. Attempt2's22WebKit failures comprise10newCenter and12existing skip-link/reflow keyboard checks. Focus diagnostics observed Tab leave a focused button for BODY, consistent with the macOS keyboard-navigation preference behavior reported in [Playwright issue41808](https://github.com/microsoft/playwright/issues/41808). No global/app preference or failed assertion was changed. Local WebKit remains **FAIL**; earlier Firefox results are not acceptance of the later source. Final Ubuntu three-engine CI must actually run and pass.

| Remaining gate | Current state |
| --- | --- |
| Fresh dependency audit | **FAIL**: valid scan,4high/0moderate/0critical |
| Final-source clean lint/types/units/build and all engine acceptance | Fresh committed CI required; local rows above are bounded diagnostics |
| Final-source OpenNext / workerd / native PostgreSQL / coverage | Current integration results pending; historical head evidence does not transfer |
| Candidate commit / push / both complete remote workflows | NOT ESTABLISHED in this precommit report |
| Independent external human code/visual review | NOT RECEIVED; agent review is not human approval |
| Production prepare / environment approval / deployment | NOT PERFORMED by this integration phase |

## Representative compiled-app visual evidence

Four byte-preserved **actual DOM element screenshots** from attempt5 are stored only in documentation, not public assets. [Their capture/source/hash receipt](release-remediation/r3-2-1-20261006/visual-evidence.json) binds the unchanged build4 app and final helper fingerprint. These are representative Center views, not an assertion that every screenshot was visually reviewed.

| Locale |375px workbench |1440px workbench |
| --- | --- | --- |
| Chinese | [Actual capture](release-remediation/r3-2-1-20261006/screenshots/zh-center-375-workbench-element.png) | [Actual capture](release-remediation/r3-2-1-20261006/screenshots/zh-center-1440-workbench-element.png) |
| English | [Actual capture](release-remediation/r3-2-1-20261006/screenshots/en-center-375-workbench-element.png) | [Actual capture](release-remediation/r3-2-1-20261006/screenshots/en-center-1440-workbench-element.png) |

The parent agent actually viewed three earlier attempt4 viewport captures of the same app: Chinese Center375, English Center1440 and the ecology footer375. In that bounded observation, four markers were inside the canvas without covering its caption, mobile2Fgeometry remained visible, software/WebGL-disabled wording was clear, and the actual ecology footer was correct. The viewport capture resolved a very-long full-page raster artifact. The scene-safety subagent also viewed all four copied Chinese/English375/1440workbench captures: labels, geometry and the software-disabled boundary were visible. Sticky navigation covers the screenshot top, so this does not assert that the entire component is wholly unobscured. These are limited agent visual observations, not a physical phone, real WebGL qualification, complete route review, independent human approval or production observation.

## Fresh dependency disposition

The local diagnostic scan ran **2026-10-05 18:46:20–18:46:24 UTC (2026-10-06 02:46 Hong Kong)** with Node 22.22.3 / npm 10.9.4 at source HEAD a9c83284… and unchanged lock SHA256 `48cee2863747559d77587c8aae8f552ed946ec797fa1ebdbd1c71dd85328344f`. Its command used `npm audit --json --audit-level=high --fetch-timeout=30000 --fetch-retries=1`; the repository's existing moderate-threshold gate is unchanged. This is a successful scan with exit **1**, not an audit-service error or an exemption.

The four high package entries represent one root advisory, [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), propagated through the development/CI lint chain `@next/eslint-plugin-next@15.5.26 → fast-glob@3.3.1 → micromatch@4.0.8 → braces@3.0.3`. No four independent application exploit paths are claimed. Developer-controlled root patterns limit observed application exposure but do not satisfy the unchanged security gate.

The bounded official-source investigation found **NO_VERIFIED_PUBLISHED_COMPATIBLE_FIX**: observed braces latest 3.0.3 remains affected, micromatch 4.0.8 and fast-glob 3.3.3 retain the chain, and Next ESLint 15.5.27 / 16.3.8 still pin fast-glob 3.3.1. The advisory's first patched version remains null in that dated evidence. The maintainer disputes the advisory; this does not withdraw it. Braces PR75 was closed without merge and the author withdrew the proposal; it is not an approved fix. Canary package metadata was unavailable after two 503 responses, so the canary dependency contents remain **NOT VERIFIED**.

No `audit fix --force`, plugin 14.2.35 downgrade, withdrawn PR75, rejected tinyglobby adapter, package rename, test/rule deletion or audit waiver was adopted. The old adapter lost a genuine Next rule diagnostic. A maintained compatible release or separately validated dependency engineering is still required; a scanner-only green result is insufficient.

Small original evidence files are preserved without overwriting history: [raw audit](release-remediation/r3-2-1-20261006/fresh-audit.json), [actual command metadata](release-remediation/r3-2-1-20261006/fresh-audit.meta.json), [disposition snapshot](release-remediation/r3-2-1-20261006/decision.json), and [hash manifest](release-remediation/r3-2-1-20261006/manifest.json). Raw audit SHA256 is `9cebcc284f98f2e6ac60fa72824bab97bbffe432b16f87e1788f45ecb99bc432`. Identical audit bytes to 10/5's remote result do not make this a reused scan; the new command/time receipt distinguishes it. Full upstream fetch evidence remains in the ignored `reports/lifepp-validation/r3-2-1-integration-20261006/dependencies/` archive.

## Real release gates and human entry points

[The compact permission observation](release-remediation/r3-2-1-20261006/release-permissions-observed.json) records a read-only GitHub snapshot at approximately **2026-10-06 02:51–02:52 Hong Kong**: PR4 OPEN/DRAFT with head a9c83284…, main/base b398e577…, and no submitted reviews. `Dropineth` currently has admin permission; `poccahin` and `xiruier` have write. Production environment `canopyproof-production` lists poccahin/Dropineth, prevents self review, has no branch filter and allows administrator bypass at the platform level. The R3 runner independently requires a real eligible approval record and rejects bypass/no-record cases. Rulesets returned `[]`; fresh classic branch-protection reads failed, so their current state is **NOT VERIFIED**.

Account eligibility does not itself establish an independent person: an agent, the PR author using a second account, or a delegated rubber-stamp cannot supply the required external human code/visual review.

A feasible unchanged-protection combination is: poccahin or xiruier initiates the fresh release run; Dropineth actually reviews the final PR head, supplies the post-merge maintainer statement and approves the sealed production manifest. xiruier can independently review code but cannot supply an admin/maintain statement or replace the production reviewer. Dropineth must not initiate that run: the actor exclusion would remove the only eligible independent environment approver, since poccahin is the PR author.

Minimum real human actions, in order:

1. Cloudflare administrator: before merge, recheck `canopyproof-web` and `dropin` → Settings → Builds / Git integration and establish that independent main-triggered publishing cannot bypass approval. The **10/5** dashboard observations showed main + `npx wrangler deploy` outside GitHub's gate, alongside failing roots; these are dated evidence, not a 10/6 configuration confirmation. Build failure is not a safety control. Do not merely fix the root and merge as an experiment.
2. Independent human reviewer: read the final candidate diff, visual and test evidence, then submit a real APPROVED review on [PR4 Files changed](https://github.com/Dropineth/dropin/pull/4/files) for the final head before merge. Agent and fixture reports are supporting materials only.
3. Resolve the high audit gate; obtain complete final-head validation and then complete Trust/Life CI for the actual main merge SHA. The current main still has the older production workflow; do not dispatch it as if it contained the candidate's no-credentials prepare.
4. Cloudflare operator / admin: provide the actual active 100%-traffic known-good web version UUID and deployment UUID, binding compatibility, rollback operator/procedure and current Git-integration evidence. The previously observed `84a01fed` prefix is not a usable UUID. The parent task additionally [read the October6 production overview](release-remediation/r3-2-1-20261006/cloudflare-overview-read.json) and still saw that prefix at100% with no task deployment; it did not establish full UUIDs or reread complete live build configuration. Separate pre-release Chinese/English curl HEAD attempts exited35 (`SSL_ERROR_SYSCALL`), which diagnoses that local access attempt only and does not prove every public channel is unavailable.
5. After merge, Dropineth must author the real plain-JSON maintainer statement on PR4 using the exact final main SHA and evidence, as specified in [R3_RELEASE_AUDIT.md](R3_RELEASE_AUDIT.md). Do not manufacture this statement from user authorization.
6. Only then use a fresh main dispatch of the candidate's manual production workflow. After credential-free production build/sealing, Dropineth inspects the artifact and enters the exact environment approval comment `APPROVE <SHA> MANIFEST <SHA256> ROLLBACK <version UUID>`. The protected job revalidates live state; reruns cannot inherit approval. Full public acceptance remains required after any actual deployment.

Integration, candidate commits, local tests/builds, ordinary candidate CI and review materials can proceed while these release gates remain open. No alternate workflow, PR3, DNS, resource creation, secret-command execution or self-approval is authorized by this report.

## Candidate identity without a self-referential SHA

This source-controlled report cannot truthfully contain the SHA of the commit that will first contain itself. Therefore `candidateCommit` remains null while precommit work is in progress. `phaseStartCommit` is only the known a9c83284… parent. Once the source/docs freeze is committed, resolve the owning PR head/commit externally; CI receipts bind that exact SHA, source fingerprint, lock hash, command, UTC time and log/artifact hashes. A later docs-only receipt commit is still a new head and must not inherit previous same-head acceptance. The authoritative public release target is the actual PR4 merge result at main tip with its own complete CI, not this document's parent SHA.

Historical R3.1 tracked status was preserved as [previous-delivery-status-r3-1.json](release-remediation/r3-2-1-20261006/previous-delivery-status-r3-1.json). The earlier implementation sections and checklists remain historical; they do not assert current integration acceptance.
