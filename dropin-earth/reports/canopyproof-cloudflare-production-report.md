# CanopyProof Cloudflare Production Report

Generated: 2026-07-08T10:59:05.435Z

Status: DEPLOYED

Production URL: https://canopyproof.org
WWW URL: https://www.canopyproof.org
Deploy target SHA: `39173f8e52a03a7796e235477c641d278dc7b73c`
Workflow run URL: https://github.com/Dropineth/dropin/actions/runs/28936163770

## Smoke Results

| Check | Result | Status | URL |
| --- | --- | --- | --- |
| root | PASS | 200 | https://canopyproof.org/ |
| www-root | PASS | 200 | https://www.canopyproof.org/ |
| robots | PASS | 200 | https://canopyproof.org/robots.txt |
| sitemap | PASS | 200 | https://canopyproof.org/sitemap.xml |
| icon | PASS | 200 | https://canopyproof.org/icon.jpg |
| api-ready | PASS | 200 | https://canopyproof.org/api/ready |
| admin-blocked | PASS | 403 | https://canopyproof.org/api/admin/launch/readiness |

## Safety Boundaries

- DROPIN_ALLOW_ADMIN_PROXY=false
- No mainnet funds enabled.
- No automatic CANOPY distribution enabled.
- No certified carbon-credit claim.
- No carbon-tax offset claim.
- No guaranteed RWA yield.
- API and Web Workers remain separated: `canopyproof.org/api/*` is the API proxy, while `canopyproof.org/*` and `www.canopyproof.org/*` are the OpenNext web Worker.
- Official logo remains JPG-only through `/icon.jpg` and `/apple-touch-icon.jpg`; `icon.svg` must not be restored.

## Rollback Instructions

- If homepage root fails after deployment, rollback the web OpenNext Worker to the previous successful deployment.
- If `/api/ready` fails but web root passes, inspect the API proxy Worker, `DROPIN_API_ORIGIN`, and Cloudflare route precedence before rolling back web.
- If `/api/admin/*` returns 200, treat it as a critical incident: force `DROPIN_ALLOW_ADMIN_PROXY=false`, disable any unsafe admin route exposure, and re-run smoke.
- If unsafe carbon-credit, tax-offset, automatic token distribution, mainnet funds, or guaranteed yield language appears, treat it as a content release blocker and rollback or patch immediately.
- Never delete append-only ledger rows.
- Never patch production by bypassing release approval artifacts or GitHub Environment approval.
