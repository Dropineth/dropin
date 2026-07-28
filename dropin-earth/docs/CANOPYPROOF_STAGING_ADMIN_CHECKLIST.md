# CanopyProof Staging Administration Checklist

Status: ADMIN_CONFIGURATION_REQUIRED

This checklist is for a repository and Cloudflare administrator. A read-only
GitHub API inspection on 2026-07-29 confirmed that the Environment exists, but
it is not ready for dispatch. This file does not prove that any Cloudflare
resource exists.

## Protected Environment

| Setting | Required value | Current state |
| --- | --- | --- |
| Environment name | `canopyproof-staging` | PRESENT |
| Deployment branch policy | selected branch `main` only | MISCONFIGURED: custom policy currently allows `canopyproof/industrial-rc1` |
| Required reviewers | `xiruier` and `Dropineth` | PRESENT |
| Reviewer count | two independent reviewers | PRESENT |
| Prevent self-review | enabled | ENABLED |
| Administrator bypass | disabled for normal promotion | UNVERIFIED |

The workflow must first be independently reviewed and merged to `main`.
Replace the current `canopyproof/industrial-rc1` deployment branch policy with
an exact `main` policy before dispatch. Configure the Environment only for the
main-owned workflow. Do not authorize Product PR #2,
`canopyproof/industrial-rc1`, a tag, or a fork as an allowed deployment ref.

## Reviewer Eligibility

The PR author is `poccahin` and is ineligible to satisfy either independent
review slot.

| Account | GitHub type | Repository relationship | Independent from author | Use |
| --- | --- | --- | --- | --- |
| `xiruier` | User | collaborator, write | yes | Environment and PR reviewer candidate |
| `Dropineth` | User, not an organization account | repository owner/admin | yes | Environment and PR reviewer candidate |
| `poccahin` | User | collaborator and Product PR author | no | excluded from required approval |

The administrator must confirm both candidate accounts remain active
collaborators when creating the Environment and must configure their numeric
GitHub user IDs through the Environment API or UI. Do not substitute the PR
author. If either candidate is unavailable or GitHub rejects the reviewer,
add another independent repository collaborator before promotion.

GitHub Environment required-reviewer lists require one approval from the
configured list, not two. The main-owned verifier therefore independently
requires two unique collaborator `APPROVED` reviews on Product PR #2, both
bound to the exact evidence SHA. The Product PR must no longer be Draft before
dispatch. The Environment approval remains an additional deployment gate with
self-review prevention.

## Environment Secrets

The Environment exists, but a name-only inspection confirmed that all four
required secrets are absent. Record presence only; never paste values into
issues, PRs, logs, artifacts, or this file. No Environment variables are
present or required.

| Name | Secret or variable | Format | Purpose | Required | Present or absent |
| --- | --- | --- | --- | --- | --- |
| `CLOUDFLARE_API_TOKEN` | secret | scoped Cloudflare API token with Workers Scripts write and account read; no global key | deploy the two staging Workers and read the workers.dev subdomain | yes | absent |
| `CLOUDFLARE_ACCOUNT_ID` | secret | Cloudflare account identifier | bind deployment to the intended account | yes | absent |
| `CANOPYPROOF_STAGING_RESOURCE_MANIFEST_JSON` | secret | UTF-8 JSON conforming to `config/canopyproof-staging-resource-manifest.schema.json` | bind isolated origin, database, storage, telemetry, Workers, target, and evidence | yes | absent |
| `CANOPYPROOF_STAGING_RESOURCE_MANIFEST_HMAC_KEY_B64` | secret | canonical base64 encoding of at least 32 random bytes | verify resource-manifest authenticity without storing a key in Git | yes | absent |

The workflow consumes no GitHub Environment variables. Do not reuse
production-only secrets, database credentials, object-storage credentials,
connection strings, or production API origins.

## Resource Manifest Preparation

The manifest must include the exact release values from
`config/canopyproof-staging-release-binding.json`, plus:

- a real isolated HTTPS `apiOrigin` with no credentials or query string;
- a staging-only `databaseIdentifier`;
- a staging-only `objectStorageIdentifier`;
- a staging-only `objectStoragePrefix`;
- `telemetryEnvironment=canopyproof-staging`;
- an `integrity` object with `algorithm=HMAC-SHA256`, canonical payload
  SHA-256, and HMAC signature.

The manifest must not contain a token, password, secret, private key,
connection string, session, cookie, authorization value, production hostname,
production database, or production storage prefix.

Generate the key and signed manifest on an administrator-controlled machine
with `umask 077`. The verifier exports
`calculateResourceManifestIntegrity()` for this offline preparation. Keep the
unsigned payload and key outside Git. Store only the completed JSON and base64
key in the protected Environment. Verify the manifest locally with the same
verifier before dispatch.

## Manual Dispatch

Do not add the `canopyproof-staging` label and do not dispatch until:

1. the control-plane PR is independently reviewed and merged to `main`;
2. the Environment allows only `main`;
3. both independent reviewers are configured;
4. every required secret is present;
5. isolated staging resources exist;
6. Product PR #2 is ready for review and has two independent collaborator
   approvals on `baf1695239c439a17398c4406b3362e073fbd7a5`;
7. Cloudflare check reconciliation is complete or explicitly waived by an
   administrator without weakening the CanopyProof Trust Gate.

Dispatch from `main` with:

| Input | Exact value |
| --- | --- |
| `deploy_target_sha` | `a2d48748e49ffb44e9f0b0f45099a30804d7cdd8` |
| `evidence_sha` | `baf1695239c439a17398c4406b3362e073fbd7a5` |
| `release_manifest_sha256` | `f4925d27f4eaa46550cb6aefce5354deab02c088595153d6767976a5feb09698` |
| `deploy_confirm` | `canopyproof-staging` |

An independent Environment reviewer must approve the pending deployment.
Automation, the PR author, and the dispatching identity must not self-approve.
