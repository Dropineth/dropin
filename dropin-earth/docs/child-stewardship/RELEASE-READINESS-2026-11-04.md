# Child-account release readiness: 4 November 2026

Decision: **production blocked**. The merged main has verified CI evidence, but
has not completed independent approval, production authority integration, hosted
backend acceptance, real identity/recovery operations or regional safeguarding.
This is an engineering audit and proposed release path, not a human approval,
legal opinion, UNICEF acceptance or permission to deploy.

## Pinned source and evidence

Audit source: main `23d4c4a0bb0df381808f90f889344f9c39765679`.
Tree: `a35b09c3a188f665381bc60b5985be366c6a9b6c`.
The tree equals candidate `a9bfe3fce82138d64fd2d8bd3ede102eab454eb9`.
The source commit preceding the three stacked increments is
`fba35ecdaa18cd9ebbded8c4f5c50285c2938b65` (37 changed files across the increments).
Tree equality does not substitute for SHA-specific checks.

| PR | Actual final head | Merge result | Merge time, UTC | Formal reviews at audit |
| --- | --- | --- | --- | --- |
| [21](https://github.com/Dropineth/dropin/pull/21) | `a9bfe3fce82138d64fd2d8bd3ede102eab454eb9` | `86195c5f88f442354f4c59685c10c7648ff6ab85` into PR20 | 2026-11-03 11:21:27 | 0 |
| [20](https://github.com/Dropineth/dropin/pull/20) | `86195c5f88f442354f4c59685c10c7648ff6ab85` | `e8da783235db41b945e190f960c4ce2cbaf024f2` into PR19 | 2026-11-03 11:21:51 | 0 |
| [19](https://github.com/Dropineth/dropin/pull/19) | `e8da783235db41b945e190f960c4ce2cbaf024f2` | `23d4c4a0bb0df381808f90f889344f9c39765679` into main | 2026-11-03 11:22:39 | 0 |

PR19/20 descriptions retain earlier candidate SHAs; the API final-head and merge
records above are authoritative for this audit. The earlier PR tests must not be
relabeled as tests of these later heads.

| Main workflow | Authenticated GitHub result | Independently downloaded archive |
| --- | --- | --- |
| [Trust 41627024686](https://github.com/Dropineth/dropin/actions/runs/41627024686) | push/main, attempt 1, completed/success; job 125886820209 and every step success | artifact 13228276816; 79,245,962 bytes; SHA-256 `fdd9fbfe129e39c7c6554dbebc10b01795b39dc0f06a1ff37b8707c150ea1630` |
| [Life++ 41627024702](https://github.com/Dropineth/dropin/actions/runs/41627024702) | push/main, attempt 1, completed/success; job 125886820237 and every step success | artifact 13227556002; 229,451,248 bytes; SHA-256 `8cb8014bc7d585e2786aa71aeb4df1c6c7ee8f8fa98fc3872b064aa441b13718` |

At 2026-11-04 07:10:23 UTC, the repository's unchanged
`validateCiArtifactEvidence` accepted both downloaded archives against the
authenticated workflow/job metadata and checked-out main lockfile. It checked
all 13 Trust and 15 Life++ command records, their log/artifact hashes, source
snapshots, audit and the 17-case accountability receipt. Both archives record
source fingerprint `6a342d67c2acc60817d6a4ee0d81da532f6303f25e11cd8e557535cd45a6f62a`
and lockfile SHA-256 `33ea9ae138193b560624bb46f8874ccd1fab0a1e6bc93024c49a662f97c03c0d`.
The 24-hour accountability freshness check passed at audit time; release must
recheck freshness and run new checks on a new candidate and its final main merge.

Main logs report workspace unit 1160/1160, accountability 17/17, database 40/40,
native PostgreSQL 183/183, and Life++ unit 161/161. Browser and workerd steps also
passed. Counts overlap and must not be added into one unique-test total. Browser
fixtures do not establish real guardian enrollment or hosted recovery acceptance.
The child image probe used Node 22.23.4, UID 1000 and closed account entry, with
`productionDeployed:false` and `releaseApproval:false`. Its CI-local image ID was
`sha256:70ede7894141f37453b9993fb268953223189adf90f6b6843f0a434ca688c597`;
this is not a published deployment-image attestation.

## Governance findings

1. PR19/20/21 formal reviews are empty. The unchanged release policy rejects PR19
   with `Require an actual independent approval of the final PR head before merge`.
   PR20/21 also target stacked branches, not main, so neither is a standalone
   release PR. A new comment, backdated claim or post-merge APPROVED review cannot
   repair the missing historical condition.
2. The branch API reports `main.protected=false`, protection disabled and required
   checks enforcement off; the ruleset collection is empty. The administration
   protection-detail endpoint was inaccessible to the integration. No protection
   setting was changed. This is a gap between the written process and merge control.
3. A public GitHub environment read during the audit returned production
   `prevent_self_review=true`, eligible accounts `poccahin` and `Dropineth`,
   `can_admins_bypass=true`, and no deployment branch policy. Staging returned
   self-review prevention, admin bypass disabled, and a custom branch policy.
   A subsequent unauthenticated read returned 403; recheck using authorized admin
   access before any change. A GitHub `User` type and different account names do
   not demonstrate different human control. Do not approve through another account
   operated by the same contributor.
4. PR4 remains the required reviewed baseline. Its actual pre-merge final-head
   approval passes the existing policy, and its merge is an ancestor of main. It
   does not approve the child increments. Existing staging PR3 is still open and
   `mergeable=false`; resolve it under its own pinned evidence and approval process.

Proposed administrative remediation, **not executed**: require PR approvals and
both named CI checks on main, dismiss stale approvals, require approval of the
last push, prevent force pushes/deletion and routine admin bypass; appoint actual
independent reviewers. Production should disallow admin bypass and restrict the
deployment branch. Review every publishing path, including the older council
workflow, Cloudflare Git integration, direct API credentials and emergency access.
Present the exact settings diff, access impact and approved rollback before making
these protected-environment changes. An absent reviewer should block a release.

## Security and operational boundary

| Area | Implemented and tested | Still required before real operation |
| --- | --- | --- |
| Guardian sessions | One-use recent WebAuthn exchange, guardian-only bearer, immutable prebinding, transaction-time role/device/link/epoch/expiry checks, withdrawal and lock-race tests | Real identity and guardian appointment verification, approved RP/origins, enrollment, notification and contested guardian-change service |
| Operation authorization | Exact signed operation bytes, role quorum, canonical key reuse rejection, policy/registry versions, nonce, epoch, beneficiary and destination binding; child payment signatures and agent votes rejected | Approved formal AHIN child-operation profile and vectors, authoritative enrolled registry/control mapping, independent verifier, transaction-coupled consume/revocation protocol |
| Revocation | Current consent/assent, credential/device/link/generation checks; stale upload/proposal/session rejection; application transaction and SQL admission controls | Operational revocation feed, bounded outage behavior, cross-service lock/commit semantics and proof that no remote preapproval survives revocation or recovery |
| Separate backend | Dedicated Hono/Node entry, direct PostgreSQL nonowner role, no ambient DB/memory fallback, checksummed migration journal, no startup migration | Selected approved host/region/cost, exact image digest, restricted credentials and TLS/private connectivity, reviewed grants, verifier deployments, synthetic provisioning and hosted acceptance |
| Recovery | Signed checkpoint verification, quarantine, canonical/security/privacy roots, current external floor, replay/epoch protection and native dump/restore tests | Independent current checkpoint/registry service outside backups, real signer custody and independence, issuer/verifier operations, provider PITR drill, measured RPO/RTO and incident ownership |
| Real value | Real funds, carbon transfers and external entitlement verification explicitly throw unavailable; real modes rejected | Separate licensed/contractual/payment/carbon and safeguarding gates; no runtime flag can replace these integrations |
| Child/data governance | Technical privacy, assent/withdrawal, protected-report and retention controls exist in the synthetic application | First jurisdiction, accountable operator/processor roles, local child protection/data review, retention/deletion/cross-border decisions, complaint/escalation duty and guardian recovery procedures |

`CHILD_BACKEND_MODE` accepts only `disabled` or `synthetic-demo`; readiness 200
means synthetic configuration/storage readiness, not real service approval or
current per-session restore admission. `identityVerified` remains false. The
current-authority transport is explicitly `SIMULATION_ONLY`, not an official
AHIN contract. Signed `independentOfOperator` flags are claims requiring external
evidence. Legal guardian/protector/trustee roles cannot be inferred from a cognitive
committee or from successful signature verification.

The backend preparation worksheet still names a historical Render preference;
the later AHIN status explicitly discontinues that selection. No host is selected
or provisioned by this audit. The separate proposal adapter and public framework
patches inspected outside main do not establish deployed authority or fill these
gaps and were not applied here.

## Newly identified code defect and correction

Before this correction, the restore-current registry accepted the same public key
under distinct key IDs, roles and declared domains. `ChildRestoreVerifier` likewise
counted key IDs/domains without comparing actual key material. A misconfigured or
malicious authoritative registry could therefore collapse the intended two-key
restore quorum to one key. This requires control of, or error in, trusted registry
data; it is not evidence of an unauthenticated production compromise.

The new negative transport regression failed against the original main code with
`Missing expected rejection`. The fix compares canonical Ed25519 SPKI identities
in both boundaries, including PEM line-ending aliases; malformed, private and
non-Ed25519 keys cannot become eligible transport seats. The transport checks all
eligible seats; the checkpoint verifier checks every actual signer independently
of transport. Distinct actual keys still do not prove institutional independence.

Local Node 22.23.4 checks: focused security 24/24 and all child unit tests 136/136,
zero failures/skips; full API typecheck including Prisma generation, changed-file
lint, dependency audit (zero vulnerabilities), supply-chain gate and diff check
passed. A native PostgreSQL regression was added to the existing backend CI suite:
duplicate/aliased signing keys must create no admission, keep the session closed,
and leave its revision unchanged; the distinct-key SQL/HTTP positive control remains.
Local native execution was unavailable (no Docker/PostgreSQL; package setup failed
under host privilege restrictions). Remote candidate CI must validate it. No test
or release gate is removed or weakened. Candidate results belong to the PR's final
head, not to the already-verified main.

## New independent review and release candidate

1. Preserve the historical review gap and all failed/passed evidence. Keep the fix
   and this audit on a separate draft PR based on the pinned main. Do not merge or
   enable auto-merge through this engineering task.
2. Appoint independent human security/backend reviewers and a responsible child
   protection/data reviewer. Review the complete cumulative change from
   `fba35ecdaa18cd9ebbded8c4f5c50285c2938b65` to the new PR head, plus its existing
   authorization/restore dependencies. The ordinary new PR diff only shows the
   fix; approving that diff alone must not be represented as reviewing PR19–21.
3. Record the full candidate SHA/tree, cumulative diff/file inventory, issue
   dispositions, scope and residual limitations in the independent review report.
   Obtain a real APPROVED review of the final candidate head before its new merge.
   Any code change invalidates the candidate binding and requires fresh review.
   This is prospective release requalification, not retroactive PR19–21 approval.
4. Merge only through the human-approved process, then require new Trust and Life++
   success on the actual resulting main SHA. Recheck artifacts, hashes, dependency
   audit and freshness. Do not substitute an earlier tree's or PR's green result.
5. Keep initial acceptance synthetic and isolated. Close backend, authority,
   identity/recovery and regional operating gaps before any real-child pilot. A
   web-only release is a distinct scope and does not deliver the independent backend.
6. After real operator checks, a maintainer supplies the existing v2 declaration;
   do not manufacture its rollback, publishing-path or visual-review evidence.
   Prepare and seal the exact artifact through the unchanged release process,
   then present SHA, manifest hash, target resource IDs, commands, impact,
   acceptance criteria and rollback for the owner's explicit approval. Independent
   protected-environment approval remains additionally required.

If governance requires the original child changes themselves to appear in a new
reviewable merge rather than cumulative requalification, prepare reviewed revert
and reintroduction PRs on isolated branches. Do not rewrite main history or execute
those reversions without a reviewed migration/operational impact assessment.

## Current production and proposed change boundaries

Fresh Cloudflare readbacks on 2026-11-04 07:02–07:06 UTC (15:02–15:06 Singapore):

| Surface | Active deployment | Version and allocation |
| --- | --- | --- |
| canopyproof-web | `7abd0c14-20a1-41aa-aa74-6829e06dad26` | `9962893f-eb75-40e7-a42d-d3395aa4eef7`, 100% |
| canopyproof-api-proxy | `86543b4d-5346-483d-aa76-e0beb53c22b1` | `7be4ae5d-c698-40ff-bf38-44d04aadba67`, 100% |
| dropin-earth-api-origin | `0489edca-cb41-49be-9b85-c6c2992397c2` | `b5473e9d-6dd3-4591-81d5-61d945ea85af`, 100% |

The proxy still targets `https://dropin-earth-api-origin.doovvvai.workers.dev`.
Web routes remain `canopyproof.org/*` and `www.canopyproof.org/*`, with the API's
more specific `canopyproof.org/api/*` route. This is control-plane traffic
allocation evidence, not an end-to-end HTTP probe, health certification or proof
that no separate backend exists outside the inspected account. The active web
version predates the child merges; no inspected public route connects the new
independent child backend. The Worker modification timestamp alone is not a
deployment or traffic-switch record.

Before any future operation, provide a separate concrete approval packet:

| Proposed operation | Impact that must be approved | Rollback and acceptance |
| --- | --- | --- |
| Main/environment protection changes | Named reviewer access, blocked merges/deploys, admin emergency behavior | Preserve exact prior settings; any rollback separately approved; never use rollback to approve the unreviewed candidate |
| Backend provision/migration | Named account, region, cost, image digest, DB and scopes; synthetic ingress only | Separate owner migration; backup and compatibility drill; close ingress and revoke runtime admission while retaining audit/replay/revocation history |
| Web promotion | Only exact sealed canopyproof-web artifact; explicit traffic steps and route scope | Re-read the active deployment and binding compatibility; candidate fallback is the current `9962893f-...` version, subject to actual health verification; restore it to 100% if approved acceptance fails |
| Child-origin routing/real pilot | Explicit narrow child path, origin, RP/CORS, population, legal basis and incident owner | Close child ingress first; route/image rollback must not restore stale consent, nonces, deleted data or guardian credentials; external current floor remains authoritative |

No backend origin, image digest, migration execution plan or owner-approved
release manifest exists in this audit for production dispatch. No production
deployment, protected-environment modification, traffic switch, role grant,
credential creation, real-child enrollment or external message was performed.

Primary guidance: [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
and [UNICEF personal data policy](https://www.unicef.org/documents/policy-personal-data-protection).
The UNICEF policy governs processing by/on behalf of UNICEF; it is not evidence
of a contract with CanopyProof or a substitute for applicable regional review.
