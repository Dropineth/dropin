# CanopyProof Production Smoke

Status: PASS

- Run id: 28936163770
- Run URL: https://github.com/Dropineth/dropin/actions/runs/28936163770
- Target SHA: 39173f8e52a03a7796e235477c641d278dc7b73c
- Generated at: 2026-07-08T10:58:12.167Z

| Check | Status | Result | Final URL |
| --- | ---: | --- | --- |
| root | 200 | PASS | https://canopyproof.org/ |
| www-root | 200 | PASS | https://www.canopyproof.org/ |
| robots | 200 | PASS | https://canopyproof.org/robots.txt |
| sitemap | 200 | PASS | https://canopyproof.org/sitemap.xml |
| icon | 200 | PASS | https://canopyproof.org/icon.jpg |
| api-ready | 200 | PASS | https://canopyproof.org/api/ready |
| admin-blocked | 403 | PASS | https://canopyproof.org/api/admin/launch/readiness |

## Safety Boundaries

- DROPIN_ALLOW_ADMIN_PROXY=false
- /api/admin/* returns 403
- no mainnet funds
- no automatic CANOPY distribution
- no certified carbon-credit claim
- no tax-offset claim
- no guaranteed-yield claim
- API/Web Workers remain separated
