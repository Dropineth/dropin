# Cloudflare Deployment Runbook For canopyproof.org

This runbook deploys the public CanopyProof experience for the Dropin Earth / Canopy Model ecosystem on Cloudflare without adding mainnet payment rails, private keys, or uncontrolled fund movement.

## Deployment Model

```text
canopyproof.org
  -> Cloudflare Pages or OpenNext Cloudflare Worker for the public web frontend

canopyproof.org/api/*
  -> Cloudflare Worker API proxy
  -> controlled Dropin API origin

mini.canopyproof.org
  -> optional Telegram Mini App build

admin.canopyproof.org
  -> optional protected admin surface behind Cloudflare Access
```

The API proxy intentionally strips the `/api` prefix before forwarding. For example:

```text
https://canopyproof.org/api/ready
  -> DROPIN_API_ORIGIN/ready
```

## Cloudflare Documentation References

- Cloudflare Pages custom domains: https://developers.cloudflare.com/pages/configuration/custom-domains/
- Cloudflare Workers routes: https://developers.cloudflare.com/workers/configuration/routing/routes/
- Cloudflare Next.js deployment guidance: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
- Wrangler configuration: https://developers.cloudflare.com/workers/wrangler/configuration/

## DNS And TLS

1. Add `canopyproof.org` as a Cloudflare zone.
2. Ensure authoritative nameservers point to Cloudflare.
3. Add the Pages custom domain through the Pages dashboard before relying on manual CNAME records.
4. Use proxied Cloudflare DNS records for public hostnames.
5. Set SSL/TLS mode to `Full (strict)`.
6. Enable Always Use HTTPS and Automatic HTTPS Rewrites.
7. Stage HSTS carefully:
   - first enable without preload
   - confirm all subdomains serve HTTPS
   - only then consider preload

## Web Frontend

The current Next.js apps contain dynamic routes. Do not treat `.next` as a static Pages output directory unless the Cloudflare build adapter owns that output.

Use one of these deployment modes:

### Option A: Static Export Pages

Use this only after the app is explicitly configured for static export and verified locally.

```bash
npm run build
```

Publish the static export directory that the app actually produces.

### Option B: Next.js On Cloudflare Workers

For dynamic Next.js behavior, use the current Cloudflare/OpenNext deployment path. Configure the Cloudflare project according to Cloudflare's Next.js guide, then set:

```text
NEXT_PUBLIC_DROPIN_API_URL=https://canopyproof.org/api
NEXT_PUBLIC_CANOPYPROOF_MODE=testnet
NEXT_PUBLIC_TON_TESTNET=true
```

## API Proxy Worker

The repository includes a tested API proxy in:

```text
packages/dropin-cloudflare/src/canopyproof-api-proxy.ts
```

Wrangler template:

```text
infra/cloudflare/canopyproof-api-proxy.wrangler.toml.example
```

Deploy flow:

```bash
cp infra/cloudflare/canopyproof-api-proxy.wrangler.toml.example \
  infra/cloudflare/canopyproof-api-proxy.wrangler.toml

# Edit DROPIN_API_ORIGIN before deploy.
npx wrangler deploy --config infra/cloudflare/canopyproof-api-proxy.wrangler.toml
```

Worker environment:

```text
DROPIN_API_ORIGIN=https://your-controlled-api-origin.example.com
DROPIN_ALLOWED_ORIGINS=https://canopyproof.org,https://www.canopyproof.org
DROPIN_CANONICAL_HOST=canopyproof.org
DROPIN_CANOPYPROOF_MODE=testnet
DROPIN_ALLOW_ADMIN_PROXY=false
```

Security behavior:

- `/api/*` forwards to the configured origin.
- `/api/admin/*` is blocked unless `DROPIN_ALLOW_ADMIN_PROXY=true`.
- production mode rejects non-HTTPS API origins.
- production mode rejects localhost API origins.
- API responses receive no-store cache and strict security headers.
- CORS is limited to configured origins.
- upstream failure returns a closed `502` response.

## Dynamic Next.js Worker Template

Dynamic frontend deployment is intentionally separate from the API proxy. Use:

```text
infra/cloudflare/canopyproof-web-opennext.wrangler.toml.example
```

That template is for `@opennextjs/cloudflare` output:

```text
main = ".open-next/worker.js"
assets = { directory = ".open-next/assets", binding = "ASSETS" }
compatibility_flags = ["nodejs_compat"]
```

Do not use deprecated Worker fields such as `type`, `upload_format`, `[site] bucket = ".next"`,
or `[experimental] services = true`. Do not route the public web Worker and the API proxy
Worker from the same template.

## One-Command Deployment Script

The repository includes a safe deployment wrapper:

```bash
npm run deploy:canopyproof
```

Automatic frontend detection is available:

```bash
export DROPIN_FRONTEND_DEPLOY_MODE=auto
npm run deploy:canopyproof
```

Auto mode checks the configured Next app directory, defaulting to `apps/web`:

```text
apps/web/out/index.html
  -> Cloudflare Pages static deploy

apps/web/.next/server/app, apps/web/.next/server/pages, or apps/web/.next/BUILD_ID
  -> dynamic Next.js detected; require DROPIN_OPENNEXT_DEPLOY_COMMAND
```

Auto mode never publishes `.next` directly to Pages and never uses deprecated
`wrangler pages publish` or an unsafe raw `.next --experimental-worker` path.

The script defaults to dry-run mode. A live deployment requires explicit confirmation:

```bash
export CLOUDFLARE_API_TOKEN=...
export DROPIN_API_ORIGIN=https://your-controlled-api-origin.example.com
export DROPIN_DEPLOY_MODE=live
export DROPIN_CLOUDFLARE_DEPLOY_CONFIRM=canopyproof.org
export DROPIN_FRONTEND_DEPLOY_MODE=auto
export DROPIN_OPENNEXT_DEPLOY_COMMAND="npm run deploy:web:cloudflare"

npm run deploy:canopyproof
```

For a static Pages deployment, use only a verified static export directory:

```bash
export DROPIN_FRONTEND_DEPLOY_MODE=pages-static
export DROPIN_PAGES_OUTPUT_DIR=/absolute/path/to/static/export
npm run deploy:canopyproof
```

The script refuses to publish `.next` as a static Pages artifact. Dynamic Next.js routes must
use the Cloudflare/OpenNext deployment path or Cloudflare Git integration. The script also
generates a local Wrangler config from environment variables without editing the checked-in
template.

## Phase 16 Production Orchestrator

Phase 16 operators should use the dry-run orchestrator before any live deploy:

```bash
npm run deploy:phase16-production
```

It writes `reports/phase16-production-deploy-plan.json`, runs the Phase16 production readiness
gate, and performs no production mutation by default. For full mainnet launch, operators must
also satisfy `docs/production-mainnet-runbook.md`, including the release council evidence pack,
Canopy Protocol replay roots, counsel allowlist, and claim-gated CANOPY rewards controls. A
live deploy requires:

```bash
DROPIN_API_ORIGIN=https://your-controlled-api-origin.example.com \
DROPIN_CLOUDFLARE_DEPLOY_CONFIRM=canopyproof.org \
DROPIN_PHASE16_DEPLOY_CONFIRM=mainnet-production \
DROPIN_FRONTEND_DEPLOY_MODE=auto \
DROPIN_OPENNEXT_DEPLOY_COMMAND="npm run deploy:web:cloudflare" \
npm run deploy:phase16-production -- --live
```

The live path still refuses to proceed unless `gate:phase16-production` returns `go`, the
Cloudflare production environment is present, and the explicit confirmations match exactly.
It then delegates to `npm run deploy:canopyproof`; it does not handle private keys, mainnet
payment signing, RWA issuance, or Impact Certificate writes.

The repo-owned OpenNext command is:

```bash
npm run deploy:web:cloudflare
```

That command builds `apps/web` through `@opennextjs/cloudflare` and deploys
`apps/web/wrangler.jsonc` to the `canopyproof.org/*` route. The API proxy remains a separate
Worker on `canopyproof.org/api/*`.

## Production Compatibility Entrypoint

For operators who want a root-level command, use:

```bash
./deploy-canopyproof-auto.sh
```

This entrypoint is production-only. It pins:

```text
Domain: canopyproof.org
Worker route: canopyproof.org/api/*
Mode: production
Admin proxy: disabled
```

Then it delegates to `scripts/deploy-canopyproof.sh`. The delegation keeps the same
fail-closed Worker config, admin-route block, `.next` safety check, HTTPS origin validation,
and smoke-test behavior centralized. Testnet can remain a separately configured validation
environment, but it is no longer part of the primary production deployment path.

The entrypoint never uses `wrangler pages publish`, never passes `--experimental-worker`, and
never stores private keys or API tokens in checked-in files.

## GitHub Actions Production Deployment

CI/CD workflow:

```text
.github/workflows/deploy-canopyproof.yml
```

The workflow runs `npm run ci` for every trigger. Pushes to `main` and production tags deploy
the production Cloudflare target through `./deploy-canopyproof-auto.sh`. Manual
`workflow_dispatch` can be used for dry-run validation or an explicit live production deploy.

Required GitHub Secrets:

```text
CLOUDFLARE_API_TOKEN
CF_ACCOUNT_ID_PROD
WORKER_ZONE_ID_PROD
DROPIN_API_ORIGIN
DROPIN_PAYMENT_MODE / DROPIN_PRODUCTION_ASSETS_JSON when enabling live payment rails
DROPIN_REAL_MONEY_* compliance values when enabling real-money lottery flows
DROPIN_TREASURY_* multisig and timelock readiness values
DROPIN_PHASE16_* readiness values required by gate:phase16-production
```

Optional notification secrets:

```text
SLACK_WEBHOOK_URL
TELEGRAM_BOT_TOKEN
TELEGRAM_CHAT_ID
```

When notification secrets are configured, live deployments call
`scripts/deploy-notify.py` and send a non-blocking success/failure summary with the
domain, environment, commit, production URLs, and GitHub Actions run URL. Dry-runs do not
call Slack or Telegram by default; set `DROPIN_NOTIFY_DRY_RUN=true` only when
intentionally testing notification delivery. Notification failures are warnings, not
deployment failures, because Cloudflare deploy state and smoke-test results remain the
source of truth.

### Dual-Lane Testnet / Production Workflow

The repository-root `.github/workflows/dual-deployment.yml` workflow runs a matrix over
`testnet` and `production`. It maps each lane to its own Cloudflare account/token, Worker
zone id, API origin, domain, Worker route, and Pages project. Scheduled runs default to
`dry-run`; manual dispatch can target `testnet`, `production`, or both.

The testnet lane generates deterministic Leaf Points and RWA fragment fixture data through
`npm --workspace services/api run seed:testdata`. The production lane explicitly skips this
step. Both lanes write PoCC/AHIN status artifacts with `scripts/record-pocc-ahin.py`, and
deployment notifications can include smoke, consensus, and fixture summaries when reports
are present.

Recommended GitHub Environments:

```text
canopyproof-dry-run
canopyproof-testnet
canopyproof-production
```

Protect `canopyproof-production` with required reviewers. The deploy wrapper still enforces
`DROPIN_CLOUDFLARE_DEPLOY_CONFIRM=canopyproof.org`, HTTPS API origins, no localhost origins,
`WORKER_ZONE_NAME=canopyproof.org`, `DROPIN_CANOPYPROOF_MODE=production`, and
`DROPIN_ALLOW_ADMIN_PROXY=false`.

## Cloudflare Security Controls

Enable:

- WAF managed rules
- DDoS protection
- bot protection or Turnstile where useful
- rate limiting for `/api/payments/*`, `/api/telegram/*`, `/api/feedback`, and `/api/challenges`
- Cloudflare Access for admin hostnames
- Web Analytics for public pages

Do not expose admin mutation routes through the public API proxy during the testnet campaign.

## Environment Variables

Frontend:

```text
NEXT_PUBLIC_DROPIN_API_URL=https://canopyproof.org/api
NEXT_PUBLIC_CANOPYPROOF_MODE=testnet
NEXT_PUBLIC_TON_TESTNET=true
NEXT_PUBLIC_DROPIN_SITE_URL=https://canopyproof.org
```

API origin:

```text
DROPIN_REPOSITORY=prisma
DROPIN_PAYMENT_MODE=mock
DROPIN_TON_TESTNET_ENABLED=true
WEB_ORIGIN=https://canopyproof.org
```

Never store private keys in Cloudflare Pages or Worker variables. Testnet verification should use submitted transaction hashes and controlled API verification only.

## Launch Verification

Before DNS cutover:

```bash
npm run ci
npm run anchor:test
npm run dry-run:operator
npm run dry-run:failure
```

After deployment:

```bash
curl -i https://canopyproof.org/api/ready
curl -i https://canopyproof.org/api/status/system
curl -i https://canopyproof.org/api/metrics
curl -i https://canopyproof.org/api/campaigns/campaign_v1_ggw_testnet
```

Manual page checks:

```text
https://canopyproof.org
https://canopyproof.org/campaigns/campaign_v1_ggw_testnet
https://canopyproof.org/lottery/round_v1_ggw_demo
https://canopyproof.org/status
https://canopyproof.org/feedback
https://canopyproof.org/faq
https://canopyproof.org/red-team
```

Required public copy must remain visible:

```text
Testnet only.
No mainnet funds.
Leaf Points are non-transferable.
Impact Certificate is not a certified carbon credit.
RWA Fragment is not guaranteed yield.
$CANOPY does not offset carbon tax.
```

## Rollback

Use rollback in this order:

1. Pause public tester invite links.
2. Disable or roll back the Pages deployment.
3. Remove or disable the Worker route for `canopyproof.org/api/*`.
4. Confirm `/api/ready` is no longer reachable from the public domain.
5. Preserve logs, feedback, challenge cases, and reconciliation reports.
6. Update `docs/testnet-operator-daily-report.md`.

Do not delete disputed evidence, challenge history, or payment anomaly records during rollback.
