# Child backend preparation: separate runtime and migration authority

This increment is stacked on PR19 (`4da90ec58bbe4b174fe53cf2696dadd61d3c2ef3`). It reuses its guardian session bridge and the existing child stewardship tables, transactions, RLS, revocation, and restore verifier. It does not replace that candidate's CI history, create a new ledger, or enable real accounts. No Render workspace, service, database, credential, permission, Cloudflare origin or production traffic has been changed by this increment.

The operating goal is CanopyProof Limited. The intended future hosting account is the existing Bill account. Neither that label nor global aspirations establish corporate control, institutional independence, regional child-data approval, or procurement/contract readiness. No email or third-party contact is part of this work.

## Prepared code and limits

- `services/api/src/child-backend/server.ts`: isolated Hono Node entry, port binding, shutdown/drain, build identity. It imports the existing child routes, not the broad legacy API application or its payment/upload/telemetry surfaces.
- `config.ts`, `database.ts`: no ambient `DATABASE_URL` or memory fallback. Default mode is `disabled`. Direct PostgreSQL login, maximum four connections per process, two-second acquisition/lock bounds, five-second statement/idle-transaction bounds. Callback transactions have a fifteen-second commit deadline; arbitrary hung JavaScript callbacks are not preempted. Failed transactions are never retried; each reused connection is reset. Logs contain only fixed service/signal fields, not database error messages, SQL, URLs, request paths, bodies, names or bearer tokens.
- `app.ts`: liveness and readiness are separate. Disabled/missing wiring/unready schema or runtime role returns readiness 503. Readiness 200 means the synthetic storage/configuration boundary is ready; **each session still needs independently current restore admission**. The existing authorization and revocation checks run again at execution. Real enrollment and fixture ceremony routes are absent. The hosted API denies public all-role demo provisioning; its initial accounts must come from an approved, isolated synthetic provisioning process, not HTTP user input. That provisioner and real enrollment are not delivered by this increment.
- `current-authority.ts`: fresh, nonce-bound, exact-audience Ed25519 verification of an external current anchor and signer registry. Missing/expired/unavailable/wrong-scope roots fail closed. See the contract below. The API has no signing or admission credential and cannot mint a checkpoint or current registry.
- `migrations.ts`: ordered checksummed journal for eleven existing migrations, one atomic advisory-locked batch, expected owner/login/database checks, replay without reapplying completed files, and rejection of changed history. No automatic grants, service scopes, verifier admission or roles. The strict restore module is mandatory in this deployment manifest, not optional as in older local fixtures.
- `infra/child-backend/Dockerfile`: provider-neutral multi-stage build with a required reviewed immutable Node image, Node 22.23.4, npm 10.9.4, locked dependencies, non-root runtime and no migration on startup. `build.json` records the claimed source SHA, actual Node version, source fingerprint and artifact hashes; it is **not an independent release attestation**. Existing final-SHA/sealed-artifact gates remain necessary.

The API uses the existing pinned `pg` 8.23.1 as an explicit runtime dependency, avoiding a new database framework. No existing Prisma generation or full-workspace verification gate is removed. Production PostgreSQL, credentials, TLS/private networking, provider backup/PITR, issuer identity, signer independence and reviewer appointment remain unverified.

## Non-secret runtime contract

| Setting | Required behavior |
| --- | --- |
| `CHILD_BACKEND_MODE` | Default `disabled`; only `synthetic-demo` is additionally supported. `child-pilot` and real-value modes rejected. |
| `PORT` | Default 10000, listen on 0.0.0.0. |
| `CHILD_WEB_ORIGIN` | One exact approved HTTPS origin; default reserved `https://synthetic.invalid`. No wildcard. |
| `CHILD_DATABASE_URL` | Restricted direct runtime login, separately supplied after approval. Never the provider primary/migration URL. Do not put it in source, build args, chat or CI artifacts. URL query overrides rejected. |
| `CHILD_DATABASE_TLS` | Default `verify-full`; `local-test` only for loopback databases whose names contain `test`. |
| `CHILD_CURRENT_AUTHORITY_URL` | Fixed reviewed HTTPS endpoint, no credentials/query/fragment or redirects. Not supplied by the browser. |
| `CHILD_CURRENT_AUTHORITY_PUBLIC_KEY` | Reviewed Ed25519 public transport root, no private material; absent means closed. |
| `CHILD_CURRENT_AUTHORITY_AUDIENCE` | Exact intended service scope; default `canopyproof:synthetic:child-backend`. |

The runtime refuses `CHILD_MIGRATION_DATABASE_URL` or `CHILD_VERIFIER_DATABASE_URL` in its environment. It still needs independently reviewed expiring database service scopes. The restore/operation/WebAuthn verifier identities are separate from the runtime and from each other under existing SQL rules. Runtime must not own any domain schema/table, bypass RLS, create roles/databases, or be a member of another role. Do not attach the provider's `fromDatabase.connectionString` directly to this runtime if it is the primary owner credential. Managed transaction pooling requires separate tests of `session_user`, GUC cleanup and role identity before adoption.

Readiness also needs read-only access to `child_backend_migrations.entries`; the migration owner owns the journal. Existing domain grants and expiring service scopes must be reviewed explicitly—there is no script that approves them automatically. Native test roles are disposable local fixtures, not proposed production grants.

## External current-authority contract

`CanopyProof-CurrentRestoreAuthority/1` is an application transport proposal, **not an official AHIN/Life++ contract or new checkpoint format**. POST a closed JSON object containing `protocol`, `environment=SIMULATION_ONLY`, exact `audience`, random 32-byte base64url `nonce`, and private project-scoped `sessionId`. The endpoint must return JSON `{payload, signature}`. The payload contains those same five fields plus UTC millisecond `issuedAt`, `expiresAt` (at most 30 seconds after issue), `anchor`, and `registry`.

`anchor` is the existing `{sessionId, checkpointId, sequence, digest, keyRegistryVersion}`. `registry` is `{version, keys}` with existing restore key fields: `keyId`, role `protection|trustee`, `controlDomain`, `independentOfOperator`, Ed25519 `publicKey`, `revoked`, `validAfter`, `expiresAt`. Duplicate key IDs are rejected; at least two currently eligible different control domains covering both roles are needed. The registry version must equal the anchor's signed version. The raw signature is Ed25519 over the existing `stableJson(payload)` UTF-8 bytes, canonical base64url, verified by the separately pinned transport root. Response size is at most 65536 bytes, total transport deadline three seconds, no redirects/cache/retries. Old or mismatched responses are rejected; an outage never falls back to a database checkpoint.

The endpoint's actual authority, current revocation source, legal operator and independence from the restored database require external evidence. **Signing an `independentOfOperator` field does not prove independence.** A service in the same Bill account does not automatically qualify. The endpoint also needs an approved workload-access/private-network policy before real use; this increment does not provision one or ship credentials. Responses contain restricted references and must not be publicly logged. No public directory or personal identity is requested.

The separate existing `ChildRestoreVerifier` verifies the exact checkpoint signatures, roots and current floor before a database admission. A verifier integration must obtain the current registry from this authenticated read, retain its version, and recheck the current anchor during admission (already enforced by that class). A version change requires fresh verification, not accepting a new key under an old approval. This increment wires the **runtime reader**; it does not deploy an external issuer, signer registry, independent verifier or trusted backup checkpoint service. Fixture tests generate ephemeral roots in memory, never as deployable configuration.

## Build, migration, restore and rollback

From `dropin-earth`, use `npm run build:child-backend`. The result is `dist/child-backend/{server.mjs,migrate.mjs,build.json,migrations/}`. `node dist/child-backend/migrate.mjs --plan` lists hashes without opening a database. `--apply-synthetic` additionally requires all of: `CHILD_MIGRATION_CONFIRM=apply-reviewed-synthetic-schema`, `CHILD_DATABASE_CLASSIFICATION=synthetic-only`, exact `CHILD_MIGRATION_EXPECTED_ROLE`, exact `CHILD_MIGRATION_EXPECTED_DATABASE`, and a separately supplied `CHILD_MIGRATION_DATABASE_URL`. No production apply mode exists. Apply is a manual approved owner process, never a service pre-deploy command that exposes owner credentials to the API.

Do not modify an already recorded SQL file to deploy a correction. Add a separately reviewed migration and update the manifest. A failed batch rolls back its journal and DDL together. Concurrent runners serialize on the same advisory lock. Startup checks the journal but never migrates. Existing SQL rollback files disable capabilities without deleting history; they are not an automated production rollback or an inverse of every schema change.

For a future provider drill: restore into an isolated approved target with runtime ingress closed, recover the independently current external revocation/checkpoint floor, verify actual roots through a separately scoped verifier, and prove old session/upload capabilities fail before admitting traffic. Native backup/restore tests do not establish Render PITR or RPO/RTO. Database rollback must never resurrect nonce consumption, withdrawn consent, deletion suppression or settled payments. Roll back application image only after schema compatibility review; keep ingress/account mode closed if independent current authority is unavailable. No deploy/PITR/production rollback command was run here.

## Render preparation and minimal approvals before resource creation

`infra/child-backend/deployment-plan.json` is a non-secret approval worksheet, **not an applyable Render Blueprint**. Current official Markdown retrieval failed (web reader unsupported content type; executor proxy `CONNECT 403`). No alternate route was used after the denial. Live Blueprint schema, current plan identifiers and account-specific networking have therefore not been verified; bundled skill guidance was used only for stable port/private-network/separation constraints. No workspace was selected and no remote resource operation attempted.

Before provisioning, supply or approve only:

1. Exact existing Bill workspace ID and evidence it is the authorized hosting workspace for the company; do not send a password.
2. Synthetic validation region and reviewed API/PostgreSQL plans with explicit cost ceiling. Singapore is only a suggestion. Confirm same-region private connectivity, external DB ingress policy and TLS behavior from current provider documentation.
3. Reviewed immutable Node image digest and artifact provenance; automatic deployments/previews remain off. Confirm existing Git integration cannot bypass release approval.
4. Separate owner, runtime and verifier provisioning plan, exact grants/expiring admission reviewers, credential delivery/rotation owner. Creation/configuration requires its own approval; no credentials requested in chat.
5. External current endpoint, public root provenance, audience, operator/control-domain and revocation evidence, workload-access policy, checkpoint/registry interface conformance. A self-hosted service in the same account is not independence evidence.
6. Backup retention, restore/PITR drill and rollback responsibilities, monitoring destination without sensitive content, on-call and incident/child-protection owner. RPO/RTO remain unset until measured and approved.

Then obtain the repository's final-head independent human review **before merge**, exact-main CI and sealed artifact, maintainer statement, environment approval and approved deployment target. PR19 and this dependent PR have separate review histories. A CI success or health endpoint is not evidence of production account operation. Real children require the first jurisdiction's guardian/identity/data/safeguarding approvals; real funds and carbon execution remain OFF independently.
