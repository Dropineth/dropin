# Offline closed-candidate evidence check

This is a preparation check, **not production enrollment or a deployment gate**.
It creates no resource and changes no runtime, route, mode, binding or permission.
It does not call Docker, cloud APIs, a database or an authority service. It does
not import or execute the candidate's bundles. The existing deployment runbook,
independent approvals and all production blockers remain in force.

## Input and command

For each of two independently retained local artifacts, place these files in a
directory outside the repository: `build.json`, `server.mjs`, `migrate.mjs` from
`scripts/build-child-backend.mjs`, and the corresponding `image-check.json` from
`scripts/child-backend-image-check.mjs`. The latter is a local container test
report, not a signed execution receipt. Do not run builds, tests or deployments
implicitly to fill missing evidence; missing evidence is a failure.

Use trusted local directory paths on Linux. Bounded reads reject non-regular
files and final-component symlinks, and do not block opening FIFOs. Parent
directory components are operator-controlled, not an untrusted filesystem sandbox.

Supply a separate sanitized JSON selection with exactly this shape. Replace the
markers with full lowercase immutable IDs; markers deliberately fail validation.
Do not add account IDs, hostnames, tokens, connection strings or personal data.

```json
{
  "kind": "CanopyProofClosedCandidate/1",
  "candidate": {
    "sourceSha": "<40 lowercase hex>",
    "imageId": "sha256:<64 lowercase hex>",
    "buildManifestSha256": "<SHA-256 of exact build.json bytes>"
  },
  "rollback": {
    "sourceSha": "<different 40 lowercase hex>",
    "imageId": "sha256:<different 64 lowercase hex>",
    "buildManifestSha256": "<different build.json SHA-256>"
  },
  "boundary": {
    "backendMode": "disabled",
    "proxyMode": "disabled",
    "gatewayMode": "disabled",
    "workersDev": false,
    "previewUrls": false,
    "publicRoutes": [],
    "realEnrollment": false
  }
}
```

From `dropin-earth`, using the repository-pinned Node 22.23.5:

```sh
node scripts/child-closed-candidate.mjs /local/selection.json /local/candidate /local/rollback
node --test --import tsx tests/unit/child-closed-candidate.test.ts
```

The checker reuses the current `deployment-plan.json` runtime/base-image pin and
requires default-closed/no-auto-deploy preparation. It checks full source SHA,
Docker image ID, raw manifest hash, both bundle hashes, matching embedded build
metadata, non-root closed probe, successful shutdown, synthetic-only build and
no production deployment claim. Moving refs, equality between the selected
candidate and rollback, missing/extra fields, dirty source, enabled/demo modes
and public route claims fail. Errors contain one fixed code, not supplied data.
The selection's boundary is a local declaration, **not observed live config**.

## What success does not prove

Output is explicitly `scope: offline-evidence-consistency`. `productionReady`,
`liveReceiptVerified`, `releaseApproval`, `authorizationGranted`,
`productionDeployed`, `cleanSourceAttested`, `boundaryObserved` and
`rollbackAvailabilityVerified` always remain false. A clean-source
flag is not independently verified; Docker's `workingTreeDirty: null` remains
unknown. `sourceFingerprint` is checked for consistency, not recomputed from a
trusted checkout. Docker `imageId` is a **configuration digest**, not a registry
manifest digest, a guarantee of image availability or an observed running image.

This check does not validate image layers, migrations, database rollback
compatibility, CI origin, real guardianship or the truth of caller-supplied
reports. The rollback entry is only a distinct offline candidate, not a proven
executable/known-good live rollback. No health/admin path becomes public. The
Cloudflare no-binding Worker rollback version UUID is a separate deployment
identity, not this origin image ID. This checker does not establish that either
rollback currently exists or is available. The existing probe does not prove
denial of every route. Separate runtime and native
database tests remain mandatory; neither `SIMULATION_ONLY` fixtures nor this
report can establish a real account, consent or rights.

Before activation, follow `../cloudflare/child-private-gateway.md`, including
actual private transport/TLS/PostgreSQL acceptance, independently verified
authority, exact-head CI, budget, protected approval and observed target/rollback
identity. An uploaded Worker version is not proof of its serving deployment;
this tool neither reads nor alters either. Keep these evidence files private and
retain independent receipts outside the repository. No deployment workflow is
added or changed by this checker; existing unit discovery picks up its tests.
