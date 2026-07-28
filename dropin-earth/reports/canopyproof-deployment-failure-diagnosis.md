# CanopyProof Deployment Failure Diagnosis

Generated: 2026-07-08 HKT

Status: NOT DEPLOYED

## Failed Run

- Run URL: https://github.com/Dropineth/dropin/actions/runs/28765611499
- Failed job: Build and deploy CanopyProof web
- Failed job ID: 85289180477
- Failed step: Install dependencies
- Previous deploy target SHA: `1557bf27dc68c73b4e91445235c13c215d702a2c`

GitHub Environment approval, release approval verification, approved target checkout, and target SHA verification completed before the install failure. Cloudflare deploy and production smoke did not run.

## Evidence

The failed target was reproduced in a clean worktree at `/tmp/canopyproof-target-1557/dropin-earth`.

With Node `v24.14.0` and npm `11.9.0`:

```text
npm error Invalid Version:
verbose stack TypeError: Invalid Version:
at Node.canDedupe
unfinished npm timer idealTree:node_modules/workerd
```

The npm debug trace showed conflicting `postcss` override sets while Arborist resolved `workerd` optional platform packages.

With npm `10.9.4`, the same clean target did not hit the npm 11 Arborist crash, but still failed strict `npm ci` lock verification:

```text
npm error `npm ci` can only install packages when your package.json and package-lock.json or npm-shrinkwrap.json are in sync.
npm error Missing: postcss@8.5.16 from lock file
```

The package metadata contained a drift between the root PostCSS pin and the web workspace:

```text
root devDependency postcss: 8.5.14
root override postcss: 8.5.14
apps/web devDependency postcss: ^8.5.15
package-lock apps/web postcss: ^8.5.15
package-lock node_modules/postcss: 8.5.14
```

A later clean replay of target `c5f2039449b1953c3cf3206f9a3aa65367f76217` proved that install was fixed but the target was still not self-contained. `npm run ci` in `/tmp/canopyproof-target-c5/dropin-earth` failed before deploy because clean checkout typecheck could not find tracked `@dropin/ui` exports used by the tracked web adapters:

```text
Module '"@dropin/ui"' has no exported member 'GlobalRegionMap'.
Module '"@dropin/ui"' has no exported member 'Leaderboard'.
Module '"@dropin/ui"' has no exported member 'LeafPointsDashboard'.
Module '"@dropin/ui"' has no exported member 'LeafPointsActivity'.
Module '"@dropin/ui"' has no exported member 'PoccAhinActivity'.
```

The same clean replay also showed that deployment safety tests depended on deployment docs, notification, and Wrangler template files that existed only as local untracked files in the primary worktree.

## Root Cause

Classification: `PACKAGE_LOCK_POSTCSS_WORKSPACE_MISMATCH` with a secondary `NPM_11_ARBORIST_WORKERD_OVERRIDE_COMPATIBILITY` failure mode.

The old target SHA is not deployable because strict install from `dropin-earth/` fails before any build or deploy step can run. The intermediate target `c5f2039449b1953c3cf3206f9a3aa65367f76217` is also not deployable because clean checkout CI fails without local untracked files.

## Fix

- Lock `apps/web` PostCSS metadata to the same `8.5.14` version already enforced at the root.
- Regenerate `package-lock.json` with npm `10.9.4` using `npm install --package-lock-only --include=optional`.
- Pin the production workflow install path to npm `10.9.4`.
- Keep `npm ci --include=optional` strict in the production workflow.
- Explicitly run the production npm/OpenNext steps from `dropin-earth`.
- Add regression tests for the npm pin, working directory, JPG logo metadata, and PostCSS lock consistency.
- Add the minimal tracked `@dropin/ui` exports required by the tracked web UI adapters.
- Add the deployment documentation, notification script, and Wrangler templates required by the tracked deployment safety tests.

## Deployment Decision

New deployable target SHA required: YES.

Production remains NOT DEPLOYED until a new approved target workflow completes and production smoke passes.

## Safety Boundaries

- `DROPIN_ALLOW_ADMIN_PROXY=false` remains required.
- `/api/admin/*` must remain blocked.
- API and Web Workers remain separated.
- No mainnet funds are enabled.
- No automatic CANOPY distribution is enabled.
- No certified carbon-credit claim is enabled.
- No carbon-tax offset claim is enabled.
- No guaranteed RWA yield claim is enabled.
- `icon.svg` remains removed; production metadata uses local JPG assets.
