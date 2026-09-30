# CanopyProof × Life++ release remediation

Status: **REMEDIATION IN VALIDATION — NOT RELEASE APPROVED**. This is the second stage of [PR #4](https://github.com/Dropineth/dropin/pull/4), continuing `codex/canopyproof-lifepp-full-update-20260930` from `8ba02a3e7fe591b115162229510112220b4182b8`. Current results and candidate identity are recorded in [delivery_status.json](delivery_status.json). A prior phase's green subset is not acceptance of a later commit.

## Scope and delivered changes

The existing `dropin-earth/apps/web` remains the application. No page redesign, business module or independent app was added. The ecological homepage, original anchors, explorer, TerraProof, methodology, logos and sample/demo boundaries remain; the 10 Chinese and 10 English Life++ routes and manifest inputs are preserved. Proposed fees remain proposals with no charging; no robot, RWA, training sale, funds movement or certification issuance is enabled.

The latest baseline Trust Gate for `8ba02a3` failed with **19 dependency findings: 5 moderate, 12 high, 2 critical**. The [original remote audit](release-remediation/baseline-remote-audit.json) and [run receipt](release-remediation/baseline-remote-receipt.json) are retained separately from older 17/18-finding observations. The [dependency disposition](release-remediation/DEPENDENCY_DISPOSITION.md) maps every finding to its dependency chain, exposure conditions, runtime/build/development/CI role, maintainer advisory and selected treatment. Minimal compatible patches and necessary supported adapter changes are being verified; no audit threshold, assertion or protection is lowered.

Middleware now establishes language and nonce CSP even on claimed prefetch requests. Caller-provided locale, nonce and CSP cannot be trusted by the request-aware root layout. The static ecology home and static asset promotion remain; matched pages continue request rendering with private/no-store HTML. [Rendering review](release-remediation/RENDERING_REVIEW.md) covers the cache, locale, SEO, RSC, asset and Worker routing implications.

The optional consultation service is implemented behind a fail-closed configuration. It validates consent and inputs server-side, enforces distributed limits and idempotency, confirms persistence by readback, and supports bounded retention/withdrawal. Its handlers use `/life/inquiries`, outside the separate production `/api/*` Worker. No real receiving backend or approved controller/retention configuration was found. Consequently the deployed-by-default UI remains **draft, not sent**. Local synthetic D1 tests are not actual organizational receipt. See [consultation setup and limits](release-remediation/consultation-README.md).

Both real scene embeds remain disabled. The original HTTP URLs and unknown metadata are unchanged. Scene 31's new observation is only HTTP HEAD 200; scene 29 returned ECONNRESET. No body, assets or true engine readiness were established. See [scene and preview inputs](release-remediation/scene-and-preview-inputs.md) and [scene integration report](SCENE_INTEGRATION_REPORT.md).

## Acceptance and evidence rules

Local validation now uses the existing CI versions, **Node 22.22.3 / npm 10.9.4**. The private task npm runtime does not modify the user's global npm. Workflow checkout binds the exact PR head and removes persisted credentials. Every command records UTC start/end, command, actual HEAD, Node/npm, lock and source fingerprints, original exit code and log hash. Source changes during a run fail the gate. Evidence directories are unique; only fresh command-owned reports are uploaded, including failures.

The Trust Gate preserves lint, all workspace types/units/builds, Python checks, PGlite, moderate-threshold audit, native PostgreSQL, coverage thresholds, Chromium/Firefox/WebKit, OpenNext artifact and workerd smoke. Independent checks continue after an audit failure where prerequisites allow; the gate still fails. Life++ acceptance and MapLibre rendering checks add coverage without deleting the original matrix. The new browser suite exercises all 20 routes at desktop/tablet/mobile, forged prefetches, locale/cache/nonce isolation, indexing, preserved ecology and default-disabled consultation endpoints. Viewer fixtures and software GPU fixtures are explicitly distinguished from real third-party scenes and physical GPU qualification.

Preliminary dirty-tree results are diagnostic only. The final acceptance record must identify a committed candidate and its complete CI runs, and later commits require fresh checks. Existing first-stage evidence under `evidence/` remains historical. It must not be relabeled as the result of this stage.

## Preview and remaining inputs

Public isolated preview is **not deployed**. Read-only GitHub inspection confirmed protected environments and independent reviewers, but the staging environment currently permits only `main`, and no verified authorized resource manifest/digest and isolated API/database/storage configuration was available for this candidate. No PR #3 merge, environment change, workflow dispatch, DNS change, paid resource or tunnel was performed. [Detailed administrator inputs](release-remediation/scene-and-preview-inputs.md) separate confirmed metadata from unavailable queries.

A loopback workerd preview will be rebuilt for the current candidate; it is not remotely reviewable. Screenshot capture alone is not manual visual review. The final review record will name the inspected routes, viewports, evidence commit and limitations.

Production remains **unmerged and undeployed**. Release still requires independent review of the exact commit, applicable successful CI, protected environment approval and the actual known-good deployed Worker rollback version. No test or document grants deployment, scene rights, commercial or protocol authority. See [release checklist](RELEASE_CHECKLIST.md).
