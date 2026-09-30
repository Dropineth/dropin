# R3 release audit — observed baseline, production HOLD

Live metadata collected **2026-09-30**; audit reconciliation timestamp **2026-09-30 09:41:50 UTC**. Queries are sequential snapshots, not an atomic repository snapshot. Repository: `Dropineth/dropin`; PR: [#4](https://github.com/Dropineth/dropin/pull/4). Audited source baseline: **`7613ee6b2b7e32560b49ecb5947b18aa5dc25b71`** on `codex/canopyproof-lifepp-full-update-20260930`. Subsequent R3 edits and commits are outside this baseline's validation. The initial audit was read-only except for this report. A later explicitly authorized implementation phase added the narrow workflow changes described in the final section; neither phase approved, merged, or deployed a release.

Inputs: R3 `CODEX_EXECUTE.md`, `SITE_MANIFEST.json`, `DESIGN_SPEC.md`, `SOURCE_LEDGER.md`; applicable `docs/AGENTS.md`; actual repository workflows, deploy scripts, web package/configuration, and `RELEASE_CHECKLIST.md`. No credential values, authorization headers, cookies, Cloudflare account identifiers, or private runtime metadata are included. Secret **names** below came from GitHub metadata, not secret retrieval.

## Live repository and environment evidence

| Surface | Observed result | Release implication |
| --- | --- | --- |
| PR #4 | Open, **draft**, head `7613ee6b2b7e32560b49ecb5947b18aa5dc25b71`; `mergeable=true`, `mergeable_state=unstable`; reviews endpoint returned `[]` | No independent PR approval was established. “Mergeable” is not release approval. |
| `main` | `b398e5772c6ff9f1e7c63bbd240214171cd0ac42`; branch `protected=false`; repository rulesets `[]` | User-mandated main-only and independent review gates still apply; absent platform branch protection is not permission to bypass them. |
| `canopyproof-production` | Exists; eligible required reviewers `poccahin`, `Dropineth`; `prevent_self_review=true`; `deployment_branch_policy=null` | Existing human approval gate is available, but does not itself enforce main-only. This is **one required approval from the listed reviewers**, not two approvals. |
| Production environment secrets | `total_count=0` | Does not mean deployment credentials are absent: repository secrets can be inherited. |
| Repository deployment secret metadata | Seven names: `CF_ACCOUNT_ID_PROD`, `CF_API_TOKEN_PROD`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `DROPIN_API_ORIGIN`, `DROPIN_OPENNEXT_DEPLOY_COMMAND`, `WORKER_ZONE_ID_PROD` | Names exist. Values, validity, token scope, origin, and hidden command content were **not read or verified**. |
| `canopyproof-staging` | Reviewers `Dropineth`, `xiruier`; no self-review; custom deployment branch policy allows only `main` | The current feature branch is not an eligible staging deployment branch. No preview was dispatched. |
| PR #3 | Open, not merged; head `2dfc98d4af18d33bcd3e91403aa2777d61aea2f6`; separate staging control-plane work | Do not merge PR #3, change staging approval/branch rules, or borrow its authority to unblock R3. |

The checks returned for the exact baseline SHA were:

| Check | Result | Immutable observed run |
| --- | --- | --- |
| Trust Gate | SUCCESS; completed `2026-09-30T06:58:14Z` | [36679451381 / job 109771615061](https://github.com/Dropineth/dropin/actions/runs/36679451381/job/109771615061) |
| Life++ web acceptance | SUCCESS; completed `2026-09-30T06:44:20Z` | [36679451369 / job 109771495617](https://github.com/Dropineth/dropin/actions/runs/36679451369/job/109771495617) |
| Workers Builds: canopyproof-web | **FAILURE**; completed `2026-09-30T06:41:06Z` | [check 109771675290](https://github.com/Dropineth/dropin/runs/109771675290) |
| Workers Builds: dropin | **FAILURE**; completed `2026-09-30T06:40:49Z` | [check 109771600841](https://github.com/Dropineth/dropin/runs/109771600841) |

Both Workers check outputs exposed build links but no diagnostic text or annotations. Their causes, production branch settings, and actual active deployments remain **unverified**. A quota problem was not demonstrated. These checks prove a Cloudflare Git integration exists; they do not prove PR builds publish production or that the integration obeys the GitHub environment gate. The R3 candidate must obtain fresh, complete evidence; none of these baseline results certify a later SHA.

The latest five production-workflow runs returned by GitHub were one failure and four cancellations. The latest was [31490980598](https://github.com/Dropineth/dropin/actions/runs/31490980598), a push at current main SHA; its sole job reported failure and an empty steps list. This limited listing is not evidence of a successful deployment or a known-good rollback version. No reason for that failure is inferred from empty steps.

## Actual deployment source differs from the task-pack description

At the audited baseline, `.github/workflows/deploy-canopyproof.yml` has `push: main` and manual dispatch inputs for mode and frontend strategy. It **does not** have the task pack's described `expected_commit_sha`, exact-SHA independent approval verification, known deployed rollback version validation, or complete same-SHA Trust Gate / Life++ workflow lookup. Remote main contained the same material gate omissions. R3's explicit requirements remain binding even though the supplied description of the old workflow was inaccurate.

Concrete gaps:

1. A main push defaults to **live** deployment with frontend **skip**. Manual dispatch has no main-only assertion. `canopyproof-production` itself has no branch restriction. Do not merge expecting a harmless build-only event.
2. `actions/checkout` does not pin a required, independently reviewed candidate input. The existing job runs `npm run ci`, but that command is not the complete Trust Gate plus Life++ acceptance matrix; separate native PostgreSQL, coverage, browser, and workerd evidence cannot be inferred from it.
3. `lifepp-web.yml` currently triggers only on pull requests. A newly created main merge SHA has no push/manual entry point for that workflow. PR-head green cannot substitute for a different merge SHA.
4. The workflow installs an unpinned global Wrangler. The lockfile already supplies Wrangler `4.120.1`; the CI runtime elsewhere is Node `22.22.3` and npm `10.9.4`. Release tooling should use the checked-in dependency graph and the same runtime.
5. The OpenNext deploy script executes the secret `DROPIN_OPENNEXT_DEPLOY_COMMAND` through `bash -lc`. Its value was deliberately not retrieved. The visible `deploy:web:cloudflare` / `cf:deploy` commands **deploy only**. `cf:build` separately produces `.open-next/worker.js` and assets. Ordinary `next build` is insufficient evidence that the deployable OpenNext output was built for the candidate.
6. The existing wrapper always reaches API-proxy deployment after the selected frontend path. It is not a web-only deployment command. The user requires keeping the independent API proxy unchanged; a website release must not silently redeploy it.
7. The phase16.9 release-approval JSON verifier is not called by this workflow and concerns another protocol release scope. It is not evidence of approval for this website. A hand-authored reviewer name or timestamp is not authenticated approval.
8. `apps/web/wrangler.jsonc` intends the existing `canopyproof-web` Worker and `canopyproof.org/*` / `www.canopyproof.org/*`. Source configuration does not verify deployed routes, current Worker version, Cloudflare Git build settings, or a usable rollback target.

## Minimum safe remediation using the existing protected environment

This is a proposed implementation sequence for the parent task, **not implemented or approved by this audit**. It strengthens workflow logic without changing environment reviewers, self-review protection, branch rules, credentials, resources, DNS, or account permissions.

1. **Make live release explicit and bind immutable inputs.** Live deployment should be manual from `refs/heads/main`, with required full 40-character `expected_commit_sha`, known deployed `rollback_version_id` and `rollback_deployment_id`. Do not retain automatic live deployment on a merge push. A preflight must verify event/ref, API-resolved main tip, workflow run SHA, and checked-out `git rev-parse HEAD` all equal the expected SHA. Reject missing inputs and branch drift. Use a fixed production concurrency group, and repeat main/SHA checks immediately before mutation.
2. **Provide both complete checks for the actual release SHA.** Preserve PR coverage and add `push: main` and/or guarded main-only manual dispatch to the existing Life++ acceptance workflow. Trust Gate already has a main push trigger. Keep every required command, audit threshold, native PostgreSQL test, coverage gate, cross-browser fixture, and actual workerd test. Resolve workflow identity by repository and workflow path/ID, require `completed/success` and the exact target SHA, and verify expected jobs/steps and SHA-bound artifacts; missing, skipped required gates, expired/unavailable evidence, or API failures must block. A merge-created SHA must run again. Do not accept a status label alone or a result from an older commit.
3. **Show a reviewable manifest before the existing human gate.** A non-deploying preflight should publish target SHA, candidate/merge comparison, code and visual review evidence links, both complete CI runs, supplied rollback IDs, existing Worker/domain, and the planned web-only commands. Mark any rollback cloud verification still pending. Give the run/job a visible target-SHA name and bind the manifest hash to the deployment job. Do not expose deployment credentials to this pre-approval manifest job merely to fetch rollback data.
4. **Obtain real independent approval through `canopyproof-production`.** The live job retains that exact environment. Have the human reviewer inspect the exact target and manifest, then approve that run with a comment explicitly naming the SHA and rollback version. After the gate opens and **before any cloud mutation**, use the read-only workflow review-history API to verify an actual `approved` record for the production environment and record the reviewer identity/comment. Require an eligible human reviewer distinct from the original and rerun initiators; for independent code/visual review, also exclude the PR author and retain their actual review evidence. Reject bypass/no-review cases. Use fresh dispatches for release retries, or explicitly prove approval belongs to the current attempt; rejecting `run_attempt != 1` avoids reusing an older attempt's approval. The manifest and API record form the approval receipt; do not manufacture an approval artifact from user authorization.
5. **Verify real rollback state after approval but before deployment.** Using existing credentials only inside the protected job, read deployment history and version details for **`canopyproof-web`**. Validate that the supplied version exists, the supplied deployment actually used it, and the expected prior active deployment/version still matches. A version upload alone is not a deployed rollback target. Require a healthy pre-release smoke receipt and operator-confirmed known-good scope; fail on resource/binding incompatibility, unknown state, drift, or unavailable API. Record sanitized IDs, timestamps, relevant configuration hashes, and the rollback operator/procedure. Do not create or test a rollback by mutating production during preflight.
6. **Make build and deploy commands visible in source.** Do not assume or retrieve the hidden `DROPIN_OPENNEXT_DEPLOY_COMMAND`. In a prepare job before human approval, without Cloudflare credentials, clean-install the frozen lockfile under the pinned Node/npm runtime, then explicitly run `npm --workspace apps/web run cf:build` with `NEXT_PUBLIC_CANOPYPROOF_MODE=production`, `NEXT_PUBLIC_DROPIN_SITE_URL=https://canopyproof.org` and the approved existing configuration. Verify the generated worker/assets and indexing output; bind artifact hashes to the exact SHA, publish them with the review manifest, and record build provenance. The protected job downloads that run's exact artifact, verifies the recorded hashes and deploys it with the repository's pinned OpenNext/Wrangler command against the existing web Worker only. Do not silently rebuild after approval, execute an opaque secret shell command, create resources, change DNS, or route through the wrapper that also deploys the API proxy. If retaining a deploy adapter, its command must be a checked-in, reviewable implementation with the same narrow behavior.
7. **Keep the independent publishing path in scope.** Confirm the existing Cloudflare Git integration's actual production branch, root/build/deploy commands, and whether it can publish outside this gate. Its failed checks do not establish safety. If it can automatically publish an unapproved SHA, the workflow-only change is insufficient; obtain the owner's configuration evidence and authorized resolution rather than claiming protected publication. Do not disable or reconfigure it opportunistically.
8. **Record deployment and external verification.** Capture the real new deployment/version IDs and UTC, target SHA/artifact hashes, approval and prior version. Smoke external HTTPS for the new/legacy/Chinese/English routes, assets, headers, canonical/hreflang, robots/sitemap, truthful consultation state, scene 33/29 fallback or verified embed, and scene 31 compatibility. Verify `/api/ready` and disabled public admin behavior while preserving the API Worker. If external smoke fails, follow the approved web-only rollback procedure and record its actual result. No success statement before these results exist.

The existing environment allows one of its required reviewers to release a job; self-review prevention blocks the person who initiated the deployment. It does not independently prove code/visual review or disqualify every possible author relationship. See [GitHub environment semantics](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments). The authenticated review-history endpoint exposes approval state, reviewer, comment and environment for the run; use it read-only, not the approval POST endpoint. See [workflow review-history API](https://docs.github.com/en/rest/actions/workflow-runs#get-the-review-history-for-a-workflow-run). Add only the necessary GitHub read permissions for these verifications, not a new credential or an approval bot.

Cloudflare rollback creates a new deployment of a previously deployed version and does not restore attached resource contents; compatibility must be established before calling it. A Git commit is not a Worker version. See [Cloudflare rollback documentation](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/).

## Available execution path and current external blockers

- **Available now:** source changes, clean local builds, loopback Next/workerd validation, read-only GitHub metadata, and fresh candidate CI. Local or synthetic success is bounded evidence, not public deployment.
- **Conditional existing production path:** complete the above source-controlled guard checks; finish independent code/visual review; obtain full final-main-SHA CI; supply and validate actual rollback evidence; obtain the existing environment's independent human approval; deploy only the existing web Worker; perform external smoke and record the receipt. No environment-protection changes or alternate hosting path are needed for the proposed workflow logic.
- **Cloudflare access observed:** a single normal pinned local Wrangler `whoami --json` call exited 1 because the Cloudflare API returned **HTTP 403 HTML / bot challenge**, not JSON. The request was stopped. No challenge bypass, alternate browser, proxy, TLS change, new login, token extraction, or follow-up cloud probing was attempted. Authentication validity, token permissions, active Worker version, route state and rollback eligibility remain unverified; a GitHub runner or authorized operator may have different access, but that is untested.
- **No quota conclusion:** no quota-denial response was observed. Workers build failures cannot be relabeled as quota failure without logs.
- **No authorized isolated public preview proved:** the current branch fails the existing staging branch policy; the staging workflow also requires its exact target/resource-manifest conditions. No approval, resource allocation, label, policy, or PR #3 merge was changed. Continue with noindex local preview and report a public preview as unavailable until its actual gates are met.

Current outcome: **R3 PRODUCTION HOLD — NOT MERGED / NOT DEPLOYED by this task.** The old green checks, stored secret names, user deployment intent, and proposed remediation do not close the remaining review, exact-SHA, rollback, Cloudflare-access, and publishing-path gaps.

## Reproducible read-only evidence scope

Normal authenticated `gh api` / existing GitHub connector GETs inspected PR #4 and its reviews, `branches/main`, repository rulesets, both environments and deployment-branch policy metadata, environment/repository secret **names only**, exact-SHA check runs, PR #3, and the latest five `deploy-canopyproof.yml` workflow runs plus the latest job status. Intermittent EOF responses were retried normally; no network configuration changed. The production workflow's latest completed job had no reported steps, so no deployment command result was inferred. Official platform documentation was consulted only to interpret approval and rollback semantics.

## Authorized R3 implementation addendum — still not release approval

The R3 working tree now implements the narrow path in `deploy-canopyproof.yml`, `lifepp-web.yml`, `scripts/lifepp-release-policy.mjs` and `scripts/lifepp-release-run.mjs`. The code is **pending final candidate CI and independent review**, not live production configuration. No workflow was dispatched, no maintainer statement was posted, no review was submitted, and no cloud probe was retried while implementing it.

Implemented behavior:

- Production has only `workflow_dispatch`; both jobs require main and first run attempt. Before any checked-out script executes, inline workflow checks bind the requested full SHA to the workflow's own main SHA. The policy additionally checks the API main tip, actual checkout, real workflow identity, and PR #4's actual merge-result SHA.
- The final PR head must have a real, still-effective independent human `APPROVED` review submitted before merge, with current repository write/maintain/admin permission. Stale-head, self, bot, dismissed, unresolved-change-request and post-merge substitute approvals are rejected. The final merge SHA separately receives the production-environment review.
- The latest matching main run of each required workflow must be successful, with the expected job and no skipped required steps. Optional `Post ...` cleanup skips alone are allowed; all 13 Trust command receipts and all 15 Life++ command receipts must be present, successful and bound to exact SHA/run/attempt, source fingerprint, lockfile and pinned final runtime. Downloaded artifact digest, command log hashes and captured evidence hashes are checked. Raw audit must contain zero moderate/high/critical findings. API failure or unavailable evidence blocks release.
- Life++ acceptance retains the existing scene/consultation Chromium fixtures and adds formal Next acceptance plus the floorplan fixture independently for Chromium, Firefox and WebKit. Each engine has its own command result and output path; a failed engine is preserved and the remaining engines still run. The job timeout is 60 minutes. Main push and guarded main-only manual dispatch now produce final-main-SHA evidence.
- Prepare has no Cloudflare secret. It explicitly installs the locked graph with Node `22.22.3` / npm `10.9.4`, runs the existing `cf:build`, validates production indexing and source configuration, and seals the full `.open-next` archive plus file hashes in a manifest. The protected job installs the same tools without cloud credentials, restores that exact archive and verifies it; it does not rebuild.
- Existing credentials are exposed only to the final protected step. The run's real environment approval is read with GET, checked against the current required reviewer list and no-self-review setting, and must name the exact SHA, manifest digest and rollback version. The approver cannot be the PR author or either run initiator. A missing actual approval, bypassed review, changed maintainer statement, main drift, or rerun blocks deployment.
- Cloudflare GETs validate the actual current deployment, one approved rollback version serving 100%, actual version content identity, and pre-existing web / www / independent API routes. Main and active deployment are read again immediately before the sole mutation command: the existing `npm --workspace apps/web run cf:deploy`. Source configuration disallows new bindings/resources and verifies the command has no added lifecycle hooks. The secret shell command, combined API-proxy wrapper, and Slack/Telegram notifications are not used.
- Basic external smoke checks root, www, API readiness and disabled admin; the receipt explicitly remains `DEPLOYED_BASIC_SMOKE_ONLY_FULL_R3_EXTERNAL_ACCEPTANCE_PENDING` until the parent task performs the full R3 public route/content/headers/scene/form acceptance. Failures preserve whether a deploy command was attempted and require operator review; the runner does not fabricate success or automatically mutate rollback state.

The old production workflow test now tests these stronger web-only boundaries. Assertions requiring the old combined API redeploy, latest global Wrangler and external notification behavior were replaced because those responsibilities are outside this website release. Existing production indexing tests now inherit workflow-level or job-level public build variables; their production/preview robots, sitemap and missing-artifact checks remain intact. The existing validation-run test still rejects secrets, `continue-on-error` and `pull_request_target`, while allowing the new guarded read-only main dispatch.

### Required human inputs — never populated by the agent

**Before merging**, obtain administrator confirmation that the existing Cloudflare Git integration cannot independently publish the merge push outside the protected environment approval. This workflow cannot control a separate Cloudflare publishing path. If that confirmation is absent, do not merge as an experiment. The sibling `deploy-cloudflare-worker.yml` remains an existing manual protected-environment/phase16-approval path; it was not changed or invoked and must not be used as a shortcut around the R3 gate.

After merge, a real repository maintainer (`admin` or `maintain`) must post a new **plain JSON** comment on PR #4 describing the final main SHA and actual evidence. Supply its exact `https://github.com/Dropineth/dropin/pull/4#issuecomment-N` URL as `maintainer_attestation_url`. GitHub authorship, repository permission, issue identity, post-merge creation time, content hash and continued unchanged content are checked. The declaration documents human verification; it is not an automated inspection of Cloudflare Git settings or a structural guarantee of rollback compatibility.

This deliberately invalid template shows the schema only. `null` and placeholder values **fail** the gate; only a maintainer who actually checked the evidence may replace them:

```json
{
  "kind": "lifepp-production-attestation-v1",
  "expected_commit_sha": "REPLACE_WITH_FINAL_MAIN_SHA",
  "worker": "canopyproof-web",
  "rollback_version_id": "REPLACE_WITH_ACTUAL_ACTIVE_VERSION_UUID",
  "rollback_deployment_id": "REPLACE_WITH_ACTUAL_ACTIVE_DEPLOYMENT_UUID",
  "git_integration": {
    "production_branch": "main",
    "can_publish_without_environment_approval": null,
    "evidence_url": "REPLACE_WITH_SANITIZED_SAME_REPOSITORY_EVIDENCE"
  },
  "rollback": {
    "known_good": null,
    "bindings_compatible": null,
    "operator_login": "REPLACE_WITH_ACCOUNTABLE_OPERATOR",
    "evidence_url": "REPLACE_WITH_REAL_ROLLBACK_AND_HEALTH_EVIDENCE"
  },
  "visual_review": {
    "reviewed": null,
    "evidence_url": "REPLACE_WITH_ACTUAL_INDEPENDENT_VISUAL_REVIEW"
  }
}
```

Accepted evidence URLs refer to a PR #4 comment/review, a repository Actions run, or an immutable `blob/<40-character-SHA>/...` file. Do not put token values, signed download URLs, full source PDFs, or private data into the statement. The documented required values are: no independent Git publishing without approval, known-good rollback, compatible bindings, and an actually completed visual review. The JSON statement is not sufficient on its own: the protected environment still requires its independent reviewer, and the live cloud state must agree.

After prepare succeeds, the reviewer must inspect the manifest and its artifact, then use this exact environment approval comment shown in the run summary:

```text
APPROVE <expected SHA> MANIFEST <manifest SHA-256> ROLLBACK <actual version UUID>
```

A new run, changed SHA, changed manifest, changed statement or changed active deployment requires fresh validation/approval. A rerun is rejected; use a new explicit dispatch. No values have been supplied or approvals obtained by this implementation task.

### Local validation scope

At **2026-09-30 10:13:45 UTC**, the working-tree validation results were:

| Command / check | Actual result |
| --- | --- |
| Node `22.22.3`, npm `10.9.4`: `node --test --import tsx tests/unit/lifepp-release-policy.test.ts tests/unit/canopyproof-production-workflow.test.ts tests/unit/lifepp-production-indexing.test.ts tests/unit/lifepp-validation-run.test.ts` | **28/28 PASS**, no skipped tests; local log `/tmp/lifepp-r3-release-unit.txt` is temporary, not a remote CI artifact |
| Final provider-specific Accept-header change: release-policy + production-workflow focused suite | **11/11 PASS**, including mocked GitHub/Cloudflare media types and rejection of 403 HTML, redirect, invalid JSON and network failure |
| Scoped ESLint on both release scripts and all four affected unit files | **PASS** |
| YAML parsing and `bash -n` for both edited workflows | **PASS**; 9 production and 13 Life++ shell steps checked; no commands were executed by the syntax check |
| `git diff --check` | **PASS** |

`actionlint` was not installed and was not run or installed by this task. Tests use clearly labeled synthetic identities/deployments and mock API responses; no fixture is a real approval or cloud validation. The initial test attempt failed because a direct `js-yaml` import was unavailable; the test now uses the already installed `yaml` parser without dependency changes. Full same-candidate remote CI, actual end-to-end execution of the production prepare/deploy runner, actual Cloudflare API access, human approvals, real rollback proof, and full external post-release acceptance remain outstanding. Neither a 403 fixture nor successful policy tests establish that the production runner has worked against live services.
