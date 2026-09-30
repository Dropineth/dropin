# CanopyProof × Life++ repository audit

Audit date: 2026-09-30. Baseline: `b398e5772c6ff9f1e7c63bbd240214171cd0ac42`.
This is a read-only baseline audit, not deployment, operational, scene-rights, or legal verification. Final implementation/test outcomes belong in `IMPLEMENTATION_REPORT.md` and `delivery_status.json`.

## Scope and evidence

- Repository: `Dropineth/dropin`; implementation branch: `codex/canopyproof-lifepp-full-update-20260930`; app: `dropin-earth/apps/web` (`@dropin/web`).
- Read: root and monorepo README, `docs/AGENTS.md`, workspace/app manifests, lockfile, web configuration, middleware, metadata, homepage/feedback source, root CI/workflows, deployment and staging runbooks.
- `docs/AGENTS.md` requires accountable evidence, permission-bounded agent events, and no final authority from memory recall. No root or app-specific AGENTS file was found.
- GitHub REST confirmed remote main at the baseline SHA with `protected:false`. This field is not evidence that repository rulesets are absent; the ruleset request returned EOF.
- Worktree dependencies and user checkout dependencies are separate directories. Existing user changes must stay in the original checkout; generated build output must stay untracked.

## Runtime and dependencies

Observed shell runtime: Node `v24.14.0`, npm `11.9.0`, macOS. Trust Gate CI specifies Node `22.22.3` and npm `10.9.4`. Report the runtime actually used for every test; do not equate a local Node 24 run with the pinned CI run.

The application uses Next `15.5.22`, React 19, TypeScript, Tailwind, and OpenNext Cloudflare `1.20.2`. Playwright `1.59.1` is already locked. `package-lock.json` is lockfile version 3 with baseline SHA-256 `54dbdbc9fa938fbf5287e335c5ff0d93a0232332c7792854e9cee596d7e1b4de`.

Use the existing CI install `npm ci --include=optional` from `dropin-earth` in this isolated worktree. Do not regenerate the lock or switch package managers because the root manifest still carries `pnpm@9.15.0` metadata. Do not install infrastructure or run seed/deploy/notification commands as part of dependency setup. Verify the lock hash after install.

Google Chrome exists at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`; the existing browser suite supports this executable. No standard local Playwright Firefox/WebKit browser cache was found during audit. Browser availability is not a completed browser test. The root task runtime `turn_context` records model `gpt-6-astra` and reasoning effort `ultra`; only those two fields were inspected. This attests the root task configuration, not a claim inferred from the user request or this subtask. The root task reported a successful locked install with no lockfile change and 16 npm audit vulnerabilities in the current dependency set; consult final test logs for severity and resolution status.

## Existing route and link inventory

Baseline pages:

```text
/
/about
/campaigns
/campaigns/[campaignId]
/certificates/[certificateId]
/challenges
/challenges/[challengeId]
/dashboard/global
/draw
/explorer
/explorer/project/[publicProjectId]
/faq
/feedback
/fund
/fund/allocations/[allocationId]
/funding
/governance
/lottery/[roundId]
/mobile/report
/partners
/payments/[paymentIntentId]
/projects
/projects/[projectId]
/red-team
/risk
/status
/terra
```

Existing homepage IDs: `top`, `protocol`, `how-it-works`, `methodology`, `explorer`, `telemetry`, `stack`, `contact`. `/explorer` also exists, but it does not replace the homepage `#explorer` link. Preserve Proof Explorer, TerraProof / Earth Observation, Methodology, Open Stack, original logo JPGs and prototype/sample/carbon-credit boundaries.

Baseline inconsistency: `/reports/esg` is linked from existing OS navigation, listed in both sitemaps and required by the workerd smoke, but no matching page or rewrite was found in the baseline source. A failure here must be reported as a pre-existing route gap; do not delete the test expectation to hide it.

No established multilingual route layer was found in the baseline. New English Life++ pages need their own coherent path, language, canonical and hreflang mapping while preserving the English ecology homepage.

## Contact and receipt boundary

The production homepage and local source expose “Partner With Us” as `/feedback`. No verified public email was found in the inspected homepage/contact source. Do not invent an email or telephone.

`/feedback` is an existing testnet queue, not a verified Life++ lead recipient. Its form posts to `${apiBaseUrl}/feedback`, where the fallback API URL is localhost. The API selects in-memory storage when `DROPIN_REPOSITORY=memory` or `DATABASE_URL` is absent, otherwise Prisma. A source-level POST route and a 2xx response do not establish the configured production retention, actual receipt, or appropriate consent for Life++ enquiries. No audit request submitted a form or test message. The safe current Life++ path is explicit local draft/copy with “not sent”; the existing feedback link may be described as the original website channel with receipt unverified.

## Headers and indexing baseline

`src/middleware.ts` applies a per-request nonce CSP to non-root app routes. It sets `frame-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, strict nonce script policy, HSTS, nosniff, X-Frame-Options DENY, referrer policy, COOP/CORP and restricted permissions. It skips `/`, `_next/static`, `_next/image`, robots/sitemap and logo metadata assets. It does not allow scene embedding.

The baseline includes both `public/robots.txt` / `public/sitemap.xml` and `app/robots.ts` / `app/sitemap.ts`. All baseline robot variants allow indexing, and sitemap origins are hardcoded to production. Metadata exclusions and asset-first routing can bypass middleware. Verify the actual served files and headers for preview mode rather than assuming a new middleware noindex header will cover root/metadata assets.

Bounded unauthenticated GET observations at approximately `2026-09-30T01:11Z`:

| URL | Observed result | Limit |
| --- | --- | --- |
| `https://canopyproof.org/` | 200, CanopyProof/sample content | No CSP, HSTS, X-Frame-Options, nosniff, referrer-policy or X-Robots-Tag observed in this response |
| `https://canopyproof.org/robots.txt` | 200; `User-agent: *`, `Allow: /` | Production baseline, not preview evidence |
| `https://canopyproof.org/api/ready` | 200 JSON | Restrictive API CSP, HSTS, DENY, nosniff and referrer policy observed; body not used to assert whole-system readiness |
| `https://canopyproof.org/api/admin/launch/readiness` | 403 | Confirms this observed public path was blocked |
| `https://canopyproof.org/feedback` | UNVERIFIED | `<urlopen error Tunnel connection failed: 503 Service Unavailable>` |
| `https://canopyproof.org/sitemap.xml` | UNVERIFIED | `<urlopen error Tunnel connection failed: 503 Service Unavailable>` |

A network/tool failure does not prove the origin is down. No proxy change, TLS bypass, alternate credential, or restricted acquisition workaround was used.

## OpenNext multi-route risk

`open-next.config.ts` uses the Cloudflare adapter with dummy incremental/tag caches and no route preloading. `cf:build` first deletes only generated `.next`/`.open-next`, rebuilds OpenNext, then runs `promote-static-homepage.mjs`. The baseline promotion script copies only `index.html` and optional `index.rsc` into the Worker asset directory. New Life++ routes are not automatically proved by that root promotion.

A static page protected by a fresh nonce CSP can render HTML while its prebuilt client scripts are rejected; forcing a Next build to pass will not prove hydration. Verify route status, client controls, console CSP violations, direct deep links and RSC navigation against the built local workerd artifact. If static promotion is extended, prove that every promoted locale/scene path has correct headers, indexing rules, metadata and unknown-route 404 behavior.

The checked-in runtime is Cloudflare Workers + OpenNext, not a new Pages/Vite project. Web Worker: `canopyproof-web`, routes `canopyproof.org/*` and `www.canopyproof.org/*`; API proxy remains separate on the more specific `/api/*` route. `npm run test:workerd` is a local `wrangler dev --local` smoke and does not deploy.

## CI and deployment controls

Root `.github/workflows/canopyproof-ci.yml` runs locked install, supply-chain scan/SBOM, `npm run ci`, native disposable PostgreSQL tests, repository and critical coverage, three-engine browser tests, OpenNext build and local workerd smoke. `npm run ci` expands to lint, workspace typecheck, unit tests, FiftyOne tests, PGlite integrations, workspace builds and audit. Nested `dropin-earth/.github/workflows` files are not root GitHub Actions workflows.

Root `deploy-cloudflare-worker.yml` requires full target SHA, exact release approval artifact binding and protected `canopyproof-production` environment. Root `deploy-canopyproof.yml` also has a main-push live path; therefore merging is a production-sensitive action even if no manual deploy command is run. No workflow was modified or dispatched in this audit.

Read-only GitHub environment response:

- `canopyproof-production`: required reviewers `poccahin` / `Dropineth`; `prevent_self_review=true`.
- `canopyproof-staging`: required reviewers `Dropineth` / `xiruier`; `prevent_self_review=true`; custom branch policies enabled.
- Exact staging branch-policy names, repository rulesets, workflow listing and PR #3 state remained unverified due `EOF` responses. This does not establish missing permissions or absent configuration.

The staging runbook says NOT DEPLOYED; it requires an isolated PostgreSQL/object-store manifest, matching digest, distinct HTTPS API origin and protected secrets before candidate checkout. The source workflow can be label-triggered for same-repository PRs; manual dispatch additionally pins the candidate to `canopyproof/industrial-rc1`. The present Life++ branch is not that branch. Actual resource readiness was not verified and no secret values were read. User scope forbids borrowing PR #3’s secret-bearing path; leave external preview gated and use a loopback local preview until separately authorized configuration is established.

## Implementation decision recorded during audit

The root implementation chose dynamic Life++/company rendering, with root-layout language derived server-side from a middleware-owned locale header. The static ecology homepage remains `force-static`. This avoids promoting new pages with prebuilt nonce-less scripts under a fresh per-request CSP, but it changes the rendering path of other routes that inherit the request-aware root layout. Inspect the final build route classification and run both existing and new workerd routes. This decision is not a test result.

The planned indexing defense combines nonproduction response headers, metadata routes for robots/sitemap, and build-generated OpenNext asset headers/metadata. Both explicit production mode and the exact production site URL are required to allow indexing. The release gate remains actual served-response verification, including root and metadata assets that can bypass the Worker.

The root reproduced an actual Next 500 caused by duplicate `public/robots.txt` / `public/sitemap.xml` and metadata routes. The implementation removes the duplicate public files, keeps metadata routes as the source of truth, and promotes the generated metadata `.body` files into OpenNext assets. The two existing source tests are being migrated to production-mode metadata function assertions while preserving their original required-route expectations. This corrects a baseline conflict; final Next and workerd output must still be tested. Language/ecology boundary links use document navigation so root-layout language updates across those boundaries.

## Final audit follow-up

On 2026-09-30 the ordinary authenticated GitHub REST request confirmed PR #3 is OPEN, head `canopyproof/staging-control-plane`, at https://github.com/Dropineth/dropin/pull/3. It was not modified, labeled, merged or dispatched. `git ls-remote` reconfirmed main at the baseline SHA. The final existing workerd smoke returned 200 for `/reports/esg`; this supersedes the source-inventory uncertainty above for route reachability only, not ESG report validity. Firefox and WebKit were subsequently installed and the original three-engine suite completed 19 scenarios with zero skips.
