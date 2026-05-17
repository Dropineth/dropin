# CanopyProof Cloudflare Deployment

This runbook deploys the public CanopyProof Web / Proof Explorer interface for
`canopyproof.org` and `www.canopyproof.org`. It does not enable protocol writes,
mainnet payment rails, RWA allocation, Impact Certificate production writes, or
automatic CANOPY distribution.

## Prerequisites

- A Cloudflare account with the `canopyproof.org` zone added.
- Cloudflare DNS is authoritative for `canopyproof.org`.
- A Cloudflare Worker named `canopyproof-web`.
- GitHub Actions secrets:
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `DROPIN_API_ORIGIN`
- The API proxy remains a separate Worker on `canopyproof.org/api/*`.
- Public `/api/admin/*` access must return `403`; admin surfaces belong behind
  Cloudflare Access on `admin.canopyproof.org`.

## Existing Build Settings

This repository uses the existing dynamic Next.js on Cloudflare/OpenNext path.
Do not deploy `.next` directly as a static artifact.

```bash
npm --workspace apps/web run build
npm --workspace apps/web run cf:build
```

OpenNext output is deployed by:

```bash
npm run deploy:web:cloudflare
```

Local Worker-runtime preview is available through the same OpenNext path:

```bash
npm --workspace apps/web run cf:preview
```

The checked-in Worker config is:

```text
apps/web/wrangler.jsonc
```

It routes:

```text
canopyproof.org/*      -> canopyproof-web
www.canopyproof.org/*  -> canopyproof-web
```

## Production Operator Command

The release-council controlled path remains:

```bash
DROPIN_CLOUDFLARE_DEPLOY_CONFIRM=canopyproof.org \
DROPIN_PHASE16_DEPLOY_CONFIRM=mainnet-production \
DROPIN_OPENNEXT_DEPLOY_COMMAND="npm run deploy:web:cloudflare" \
npm run deploy:phase16-production -- --live
```

If `gate:phase16-production` is not `go`, this command must stop. No manual
override is allowed in this runbook.

## Local Verification

```bash
npm --workspace apps/web run typecheck
npm --workspace apps/web run build
npm --workspace apps/web run cf:build
npm run deploy:phase16-production -- --output reports/phase16-production-deploy-plan.json
```

## Direct Wrangler Verification

Only use this for an operator-approved web deploy after gates pass:

```bash
npm run deploy:web:cloudflare
curl -I https://canopyproof.org
curl -I https://www.canopyproof.org
curl -i https://canopyproof.org/api/admin/launch/readiness
```

Expected public admin response:

```text
HTTP/2 403
```

## Custom Domains

In Cloudflare, bind both hostnames to the deployed web Worker routes:

- `canopyproof.org`
- `www.canopyproof.org`

Use SSL/TLS `Full (strict)`, Always Use HTTPS, and staged HSTS. Do not delete or
replace existing production DNS records until the new route is verified.

## Rollback

Use Cloudflare Workers deployment history to roll back `canopyproof-web`. Keep
the API proxy deployment separate so a frontend rollback cannot accidentally
change admin or write-protected API behavior.

## Safety Rules

- Do not commit API tokens or Cloudflare credentials.
- Do not change DNS records blindly.
- Do not remove the existing production deployment until the new deployment is verified.
- Do not add public mutation routes for this UI / Proof Explorer launch.
- Impact Certificates remain proof records, not certified carbon credits.
