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

## Production Operator Path

Production deployment must use the protected GitHub Actions workflow:

```text
.github/workflows/deploy-cloudflare-worker.yml
```

Manual workflow inputs:

```text
deploy_confirm=canopyproof.org
phase_confirm=mainnet-production
target_sha=<approved-deploy-commit-sha>
```

For the Phase 16.9 approval freeze, the recommended target is:

```text
83d3dd17de875fb97681e716b79dbe23e11a4a4e
```

Required human approval statement:

```text
I approve Phase 16.9 production deployment of the CanopyProof web Worker to canopyproof.org using the protected GitHub Actions workflow with target_sha 83d3dd17de875fb97681e716b79dbe23e11a4a4e. Preserve the existing canopyproof-api-proxy /api/* route. Do not modify API proxy routes. Do not deploy from the broken local macOS runtime.
```

The legacy `.github/workflows/deploy-canopyproof.yml` workflow is dry-run only.
Its live production path is intentionally disabled so it cannot bypass
`target_sha`, release-council approval evidence, or the protected
`canopyproof-production` environment.

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
