# CanopyProof Staging Control Plane

Status: NOT DEPLOYED

This document defines the trusted staging promotion plane. It does not approve
Product PR #2, merge product code, configure GitHub, create Cloudflare
resources, add a promotion label, dispatch staging, or alter production.

## Immutable Release Identity

| Role | Identity |
| --- | --- |
| Product PR | `Dropineth/dropin#2` |
| Reviewed RC branch | `canopyproof/industrial-rc1` |
| Deploy target | `a2d48748e49ffb44e9f0b0f45099a30804d7cdd8` |
| Evidence commit | `baf1695239c439a17398c4406b3362e073fbd7a5` |
| R2 release manifest SHA-256 | `f4925d27f4eaa46550cb6aefce5354deab02c088595153d6767976a5feb09698` |
| Trust Gate | run `30373113325`, PASS |

The deploy target and evidence commit are different by design. The target is
an ancestor of the evidence commit. The evidence commit may document the
candidate but may never replace the deploy target.

## Two-Plane Boundary

The control plane lives on protected `main`. It owns
`.github/workflows/deploy-canopyproof-staging.yml`, the immutable release
binding, resource schema, verifier, and deployment sequence. Only this
main-owned workflow may receive the `canopyproof-staging` Environment.

The product plane remains Product PR #2. It contains code, tests, migrations,
and staging Worker configurations, but does not receive secrets until the
main-owned verifier has checked the explicit target, evidence, release digest,
reviewed branch ancestry, evidence-only boundary, resource manifest integrity,
and workflow ref.

## Promotion Contract

An authorized administrator manually dispatches the workflow from `main` with
all four inputs:

- `deploy_target_sha`;
- `evidence_sha`;
- `release_manifest_sha256`;
- `deploy_confirm=canopyproof-staging`.

The workflow rejects `github.sha`, a PR head, or the evidence SHA as an
implicit target. It requires its workflow ref to be:

`Dropineth/dropin/.github/workflows/deploy-canopyproof-staging.yml@refs/heads/main`

The `canopyproof-staging` label is informational only. This control plane has
no `pull_request`, `pull_request_target`, or label-triggered deployment. Adding
the label must produce no secret-bearing execution. An administrator may treat
the label as a promotion request and separately perform the protected manual
dispatch after review.

GitHub Environment reviewer lists use one-of approval semantics. The workflow
therefore adds a separate 2-of-N gate: Product PR #2 must be ready for review,
its head must equal the evidence SHA, and the latest reviews must include at
least two different non-author repository collaborators approving that exact
evidence SHA.

## Verification Order

1. Checkout full history from `main`.
2. Pin Node `22.22.3` and npm `10.9.4`.
3. Preserve the verifier, release binding, and schema from trusted `main`.
4. Fetch the reviewed RC branch and extract the R2 evidence report from the
   explicit evidence SHA.
5. Fetch and verify two independent collaborator approvals on the exact
   evidence SHA.
6. Verify the workflow ref, release digest binding, target/evidence identities,
   ancestry, evidence-only boundary, schema, resource identities, and resource
   manifest HMAC.
7. Checkout the exact deploy target and verify `HEAD`.
8. Install from the lockfile and run supply-chain, CI, native PostgreSQL,
   coverage, critical-module, browser, OpenNext, and workerd gates.
9. Build the API proxy and Web Worker separately.
10. Deploy only `canopyproof-api-staging` and `canopyproof-web-staging` as
   route-free `workers.dev` services.
11. Run staging smoke and emit a non-secret immutable attestation artifact.

The R2 digest is an immutable reviewed release-artifact identity. The staging
resource manifest has a separate integrity boundary: canonical JSON is bound
by SHA-256 and HMAC-SHA256, with the HMAC key stored only in the protected
Environment.

## Safety Boundary

- `CANOPY_PRODUCTION_UNLOCK=false`;
- `DROPIN_ALLOW_ADMIN_PROXY=false`;
- production mobile sync disabled;
- real satellite writes disabled;
- automatic CANOPY distribution disabled;
- mainnet funds disabled;
- `PLANETARY_LAB=false`;
- certified carbon-credit claims disabled;
- carbon-tax offset claims disabled;
- guaranteed RWA yield claims disabled;
- `productionDataAllowed=false`;
- API and Web Workers remain separate;
- no production route, database, object storage, or telemetry identity is
  permitted.

## Failure And Rollback

Any mismatch fails before target execution or deployment. A failed staging
deploy may roll back or delete only the affected staging Worker version.
Production Workers, routes, DNS, data, audit facts, and evidence records must
remain untouched.

The valid next step is independent review and merge of the control-plane PR
only. Product PR #2 remains Draft. Staging remains blocked until the
administrator completes
`docs/CANOPYPROOF_STAGING_ADMIN_CHECKLIST.md`.
