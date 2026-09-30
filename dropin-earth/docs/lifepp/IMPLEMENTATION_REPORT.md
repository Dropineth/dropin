# CanopyProof × Life++ implementation report

Status: **IMPLEMENTED FOR REVIEW — NOT PRODUCTION DEPLOYED**. The working site is part of the original `dropin-earth/apps/web`, on branch `codex/canopyproof-lifepp-full-update-20260930`, based on `b398e5772c6ff9f1e7c63bbd240214171cd0ac42`. See [delivery_status.json](delivery_status.json) for current commit/PR and item-level evidence. This report does not confer deployment, factual, commercial, scene-rights or protocol authority.

## Implemented

- Preserved the CanopyProof ecological homepage, its original anchors (including `#explorer`), `/explorer`, TerraProof, methodology, JPG logo assets and sample/demo boundaries. Added a visible Life++/scene/company entry and return links without replacing the ecological business.
- Added all 10 requested Chinese routes and 10 complete English counterparts: `/life`, `/life/spaces`, `/life/spaces/31`, `/life/spaces/29`, `/life/center`, `/life/agents`, `/life/membership`, `/life/partners`, `/life/trust`, `/company`; each also exists under `/en`. Unknown routes/scenes return 404. Both scenes can be reached within two clicks from the existing homepage.
- Implemented shared design tokens, warm neutral/purple Life++ UI, restrained inline concept illustrations explicitly labeled as concepts/placeholders, responsive navigation, four business modules, introductory space, agent/edge consultation, club/learning/arena/garage sections, proposed subscriptions, partnership intent and trust/permission/withdrawal explanations.
- Exact room inputs: L112 58.69 m², L203 135.80 m², L202 185.99 m², L201 290.78 m²; total 671.26 m² and upper-floor total 612.57 m². These are user-confirmed plans, not newly verified leases. Proposed annual CNY 299/599/1000 tiers have no checkout or active entitlement. No invented scale, revenue, training consent, certification or navigation promise.
- A single typed, runtime-validated scene registry preserves original source URLs and null unknown metadata. Both scene pages render the safe fallback with source copy and explicit HTTP third-party external link safeguards. See [scene report](SCENE_INTEGRATION_REPORT.md).
- The minimal enquiry form validates contact choice, optional organization, cooperation type, brief and consent; it generates/copies/clears text in memory and explicitly says not sent. No request, persistence, logging, model call or fake receipt is added. `/feedback` remains the original website channel with receipt unverified; no email address was invented.
- Locale-aware `html lang`, title, description, Open Graph/Twitter metadata, canonical and hreflang. Explicit production mode plus the exact public origin is required for indexing. Preview has noindex headers/metadata, robots disallow and an empty sitemap. Duplicate public metadata files were removed after reproducing a Next 500; generated metadata routes are now the single source of truth.
- Added a route-free, disabled-live-feature local Wrangler configuration and OpenNext metadata asset promotion. The page keeps strict existing `frame-src 'none'`; no proxy, mixed-content bypass or remote scene acquisition was introduced. Existing API/admin route boundaries remain.
- Added a read-only PR acceptance workflow, unit tests, actual-browser route/form/locale checks, isolated viewer fixture tests and bounded HEAD inspection script. Existing checks were extended to validate actual metadata outputs; no coverage threshold or security assertion was removed.

## Conditional or unavailable

| Item | Actual state | Remaining gate |
| --- | --- | --- |
| Scene 31 / 29 | Real assets **not loaded**; fallback works | Confirmed HTTPS endpoint, separate display/embed rights, safe redirects/subresources, both frame policies, trusted readiness adapter and real-source browser acceptance |
| Enquiry receipt | **Not sent / not received**; draft/copy works | Verified recipient or persisted backend, retention and delivery validation |
| Subscription / robot / training / transfer | Disabled | Separate authorization and service/safety/payment requirements |
| Public staging preview | **Not deployed** | Isolated resources and exact-candidate approval through the existing protected path; PR #3 remains independent |
| Production | **Not merged / not deployed** | Clean applicable CI, dependency risk resolution, exact-SHA independent release review and environment approval |
| Native PostgreSQL locally | **Not run** | Existing Homebrew binary cannot find compiled timezone/share paths; no Docker daemon. No global installation/configuration was altered; native CI still required |
| Field INP / real scene performance | Unmeasured | Actual traffic and an authorized working scene |

## Test evidence

Results are actual local observations on macOS arm64, Node 24.14.0 / npm 11.9.0. CI is pinned to Node 22.22.3 / npm 10.9.4 and must be evaluated independently. Root task runtime metadata records `gpt-6-astra` with `ultra`; no account-level model configuration was changed.

| Check | Observed result | Evidence |
| --- | --- | --- |
| Locked dependency install | PASS; lock SHA-256 unchanged | [install](evidence/command-npm-ci.txt), [input provenance](INPUT_PROVENANCE.json) |
| Full repository lint / workspace typecheck / workspace builds | PASS | [lint](evidence/command-final-lint.txt), [types](evidence/command-all-typecheck.txt), [builds](evidence/command-all-build.txt) |
| Supply-chain gate | PASS 709 components, 0 secret findings, 0 tracked generated artifacts | [report](evidence/supply-chain-gate.json) |
| Unit suite | PASS 852/852, zero skipped | [unit output](evidence/command-final-tests.txt) |
| PGlite integration | PASS 40/40 | [output](evidence/command-db.txt) |
| FiftyOne Python tests | PASS 4/4 | [output](evidence/command-fiftyone.txt) |
| Repository coverage ratchet | PASS: statements/lines 82.82%, branches 77.01%, functions 83.31% | [report](evidence/canopyproof-repository-coverage.json) |
| Critical coverage gate | PASS against existing 95% thresholds | [report](evidence/canopyproof-critical-coverage.json) |
| Original cross-browser matrix | PASS 19 scenarios, 0 skips; Chromium 9 / Firefox 4 / WebKit 6 | [report](evidence/canopyproof-cross-browser-webgl.json) |
| New route/interaction checks on Next | PASS 70 checks, 21 screenshots | [report](evidence/next/browser-report.json) |
| New route/interaction checks on workerd | PASS 70 checks, 21 screenshots | [report](evidence/workerd/browser-report.json) |
| Viewer fixture scenarios | PASS 8/8; fixture only, GPU mocked, actual source not embedded | [report](evidence/viewer-fixture-report.json) |
| OpenNext build and existing Worker smoke | PASS artifact build and 15 checks | [build](evidence/command-cf-build.txt), [smoke](evidence/canopyproof-workerd-smoke.json) |
| npm dependency audit | **FAIL: 17 vulnerabilities (4 moderate, 11 high, 2 critical)** in the unchanged lock | [raw audit](evidence/npm-audit-moderate.json), [command](evidence/command-audit.txt) |
| Native PostgreSQL | **NOT RUN** after disposable initdb failed | [exact failure](evidence/command-native-db.txt) |

The `npm run ci` constituents were executed separately to preserve independent results despite the audit failure. This is **not** a claim that the complete CI gate passed. Locked dependencies were not broadly upgraded to mask inherited findings. Coverage observations were taken before the final metadata-only/indexing-workflow fixes; their scope and source hashes remain in their reports. Final unit, browser, lint and build observations cover those fixes as recorded in delivery status.

The new browser suite covers 20 locale routes at 1440×1000, 768×1024 and 375×812, raw and hydrated language, localized metadata, canonical/hreflang, selected informational text contrast, no overflow, no third-party initial requests, CSP/client errors, original anchors, two-click scene access, language transitions, keyboard form validation/copy/clear, no form writes/storage, unknown routes and indexing. It is not a full WCAG certification or a physical-device test. Google Chrome was 154.0.8037.58. Firefox/WebKit runtimes were installed solely to execute the existing suite.

Initial failures are retained in [iteration evidence](evidence/iterations/): a browser harness serialization problem, the original fixed navbar covering the new entry, a case-sensitive test label, and production runtime vars leaking indexing into local preview. These were corrected and the affected checks rerun. A later lint run discovered generated `.wrangler/tmp` bundles were being linted; only that generated directory was added to ignore lists, with all source rules retained. Independent review also corrected inherited ecological Twitter metadata and production build-variable wiring.

## Preview, screenshots and measured performance

Local Worker preview: **http://127.0.0.1:8788/life**. It is bound to loopback, has no public hostname or deployment, and is available while the task's preview process runs. Reproduce with `npm --workspace apps/web run cf:build` then `npm --workspace apps/web run cf:preview:lifepp` from `dropin-earth`, without production indexing variables. No paid infrastructure was created.

Before: [ecology desktop](screenshots/before-ecology-desktop.png), [ecology mobile](screenshots/before-ecology-mobile.png). After: [Life++ desktop](evidence/workerd/after-desktop-life.png), [Life++ mobile](evidence/workerd/after-mobile-life.png), [scene safety fallback](evidence/workerd/after-desktop-life-spaces-31.png), [enquiry form](evidence/workerd/after-desktop-life-partners.png), [English](evidence/workerd/after-desktop-en-life.png), [preserved ecology](evidence/workerd/after-desktop-ecology.png). All 42 after screenshots have route/viewport context in the two browser reports. Root visually inspected the Life++ homepage and scene fallback, including mobile; the UI reviewer inspected desktop home and mobile center. This is not a claim of manual visual review of every screenshot.

Browser reports record per-route local PerformanceObserver LCP, bounded accumulated CLS, script transfer/encoded/decoded bytes and selected text contrast. [performance-summary.json](evidence/performance-summary.json) extracts homepage observations from the final run. These are unthrottled local lab measurements, not Lighthouse scores or field percentiles. Field INP was not measured; the recorded event-duration field is not a substitute. Initial Life++ pages issue zero third-party scene/model requests.

## Review and release procedure

The original dirty checkout was not edited or reset; all changes are in the independent worktree. Input hashes and source-file hashes bind the provided manifest and reviewed implementation. The application lockfile remains byte-identical to the base. Generated baseline reports were copied into task evidence and restored at their original paths to avoid unrelated report churn.

The root layout now obtains language from a middleware-owned header. The ecology home stays `force-static`; routes inheriting the request-aware layout render per request, preserving nonce CSP hydration. This broad rendering-path effect was checked through existing Worker routes and browser tests but needs normal production review. New site code adds no storage/backend schema change.

Production public build variables are explicitly wired through the existing deployment workflows; their approval, exact-target, secret and trigger controls are preserved. No production or staging workflow was dispatched. No PR was merged. [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md) retains exact-candidate approval, environment review, external smoke and rollback requirements. Known-good deployed Worker version must be recorded by the authorized release operator before any release; the Git base is not assumed to be a deployed rollback version.
