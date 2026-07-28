# CanopyProof Isolated Staging Runbook

Status: NOT DEPLOYED

This runbook provisions the release candidate on route-free Cloudflare
`workers.dev` services. It does not alter `canopyproof.org`, production DNS,
the production API Worker, or production data.

## Required GitHub Environment

Create `canopyproof-staging` with:

- the same independent reviewer set as `canopyproof-production`;
- self-review prevention enabled;
- repository administrators unable to bypass the review in normal operation;
- no deployment branch that can skip the exact-SHA checks.

The active automation identity must not approve its own deployment.

Configure these secrets in the protected environment:

- `CLOUDFLARE_API_TOKEN`;
- `CLOUDFLARE_ACCOUNT_ID`;
- `CANOPYPROOF_STAGING_API_ORIGIN`;
- `CANOPYPROOF_STAGING_RESOURCE_MANIFEST_JSON`.

Keep `DROPIN_API_ORIGIN` configured as the production comparison value. The
preflight rejects a staging origin that equals it. The staging API origin must
be a distinct HTTPS origin backed by isolated PostgreSQL and object storage.

Configure this environment variable:

- `CANOPYPROOF_STAGING_RESOURCE_MANIFEST_SHA256`.

## Resource Manifest

The manifest contains identifiers, not credentials:

```json
{
  "schemaVersion": 1,
  "environment": "canopyproof-staging",
  "apiOrigin": "https://staging-api.example.org",
  "productionData": false,
  "database": {
    "kind": "postgresql",
    "identifier": "canopyproof-staging-postgresql",
    "productionData": false
  },
  "objectStorage": {
    "identifier": "canopyproof-staging-evidence",
    "productionData": false
  }
}
```

Hash the exact UTF-8 secret value with SHA-256 and set the environment variable
to that lowercase digest. The preflight rejects a hash mismatch, production
data, a non-PostgreSQL database, identifiers without `staging`, or keys that
could contain credentials.

## Review-Triggered Deployment

1. Confirm the pull request head is the intended immutable release candidate.
2. Add the `canopyproof-staging` label.
3. Review the pending `canopyproof-staging` environment deployment.
4. An authorized reviewer other than the triggering identity approves it.

The pull-request trigger accepts only a same-repository head SHA. Manual
dispatch is allowed only when `target_sha` equals the current
`canopyproof/industrial-rc1` branch tip.

The workflow then:

1. validates the isolated resource manifest before checking out the candidate;
2. checks out and verifies the exact candidate SHA;
3. runs CI, native PostgreSQL, repository coverage, and critical coverage;
4. deploys `canopyproof-api-staging` without production routes;
5. builds and deploys `canopyproof-web-staging` without production routes;
6. runs the staging route, metadata, claim, coordinate, secret, API, and admin
   smoke checks;
7. preserves staging deployment and smoke evidence as a GitHub artifact.

## Safety Boundaries

- `CANOPY_PRODUCTION_UNLOCK=false`;
- `DROPIN_ALLOW_ADMIN_PROXY=false`;
- real satellite writes disabled;
- production mobile sync disabled;
- automatic CANOPY distribution disabled;
- mainnet funds disabled;
- `PLANETARY_LAB=false`;
- carbon-credit issuance disabled;
- tax-offset claims disabled;
- guaranteed-yield claims disabled;
- API and Web Workers remain separate.

The staging workflow never assigns `canopyproof.org/*` or
`www.canopyproof.org/*` routes.

## Failure Handling

Do not proceed to the 12-hour soak when any workflow or smoke check fails.
Retain the GitHub artifact, inspect the failing staging Worker, and roll back or
delete only the staging Worker version. Never alter production Workers, DNS,
append-only audit facts, or evidence records while handling a staging failure.
