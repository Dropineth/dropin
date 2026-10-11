# Static homepage security: complete-candidate independent release review

The promoted English homepage bypasses Next middleware and currently lacks CSP
and the other security response headers present on dynamic pages. This release
generates exact inline-script hashes and security headers for the static root
and its file alias. Production sealing and workerd response checks reject stale
or missing headers. UI, dependencies and Cloudflare configuration are unchanged.

This is a review of the complete website candidate, including PR #4 through #6.
It is not retroactive approval of PR #5 or #6, nor production approval.

Main `b72dc29ad0da2555958b62a7ec6e0a957d5252a0` passed attempt-1
[Trust 38141539492](https://github.com/Dropineth/dropin/actions/runs/38141539492)
and [Life++ 38141539498](https://github.com/Dropineth/dropin/actions/runs/38141539498).
These results belong only to that SHA, not this correction. PR #6 reviews were
empty after merge. A genuine independent review of this final head must occur
before this new release PR is merged. The prior evidence below remains historical.

## Required review scope

Review the complete change from the parent of PR #4,
`b398e5772c6ff9f1e7c63bbd240214171cd0ac42`, through this PR's final head.
The existing reviewed PR #4 baseline remains required by policy. Reviewing only
this document or the new security fix is insufficient.

- [Complete source delta through this release branch](https://github.com/Dropineth/dropin/compare/b398e5772c6ff9f1e7c63bbd240214171cd0ac42...codex/canopyproof-static-security-release-20261011) (the PR description freezes this link to its final head)
- [PR #4 Life++ source scope](https://github.com/Dropineth/dropin/pull/4/files)
- [PR #5 code and dependency disposition](https://github.com/Dropineth/dropin/pull/5/files)
- [PR #6 Planetary source scope](https://github.com/Dropineth/dropin/pull/6/files)
- [Dependency compatibility and residual maintenance conditions](../../docs/lifepp/DEPENDENCY_RELEASE_20261006.md)
- [Protected production release requirements](../../docs/lifepp/R3_RELEASE_AUDIT.md)
- [Planetary UI scope, asset provenance and validation](./PLANETARY_INTEGRATION.md)

The scope includes dependency behavior and lockfile integrity, the ESLint
compatibility bridge, unchanged browser assertions and error diagnostics,
release-PR/commit binding, static hash and dynamic nonce CSP/cache boundaries, and the inherited
bilingual Center integration. The user subsequently authorized the new bilingual
homepage and read-only reference views. The previous landing component remains
unchanged at `/ecology`; original homepage anchors and ecosystem entry links,
Life++ Center and FourShopPlan remain available. Scenes 33/29, unaccepted WebGL, real consultation delivery,
billing and robot control remain disabled; software schematics are not captured
3DGS scenes or real operations.

## Existing evidence and its limits

PR #5 head `9a4fb8e60ed2d353f5cdd0b3114307f40a7145bd` has successful
[Trust 38128756704](https://github.com/Dropineth/dropin/actions/runs/38128756704)
and [Life++ 38128756673](https://github.com/Dropineth/dropin/actions/runs/38128756673)
attempt-1 runs. The original audit reports zero vulnerabilities. The original
Life++ logs report 150 passing checks for each of Chromium, Firefox and WebKit;
workerd reports 150 Life++ checks and 15 route smoke checks. These runs belong
only to that head, not this follow-up head or a later main SHA.

GitHub records PR #5 merged by the Dropineth account at 2026-10-11 09:56:01 UTC,
producing `ef249b617e38611807df6c3f4d50784339992633`. The reviews endpoint read
afterward returned an empty array. That merge therefore does not supply the
required independent approval before merge. The agent issued no merge command.
The merged source tree and locally verified `9a4fb8e` source tree both equal
`6ad337cd04f193256ede60d740962add3847e096`.

The actual main `ef249b6` also has successful attempt-1
[Trust 38130129303](https://github.com/Dropineth/dropin/actions/runs/38130129303)
and [Life++ 38130129289](https://github.com/Dropineth/dropin/actions/runs/38130129289)
evidence. These older runs do not cover the planetary UI in this PR.

Cloudflare uploaded main candidate version `7d875eee-f76c-4d03-bc1f-a441cf701729`;
this is not an approved production artifact or an active deployment. CI review
packages are noindex. The actual production prepare artifact must be reviewed
after the following gates; no existing upload is substituted for that artifact.

## Required sequence for this new release decision

1. Freeze this PR's final head and obtain its original complete CI evidence.
2. A real independent authorized human reviews the complete scope above and
   submits APPROVED for that exact head before merge. Agent checks do not count.
   Confirm the Git integration cannot publish without environment approval.
3. Merge normally only after those conditions. Run both complete original
   workflows on the actual resulting main SHA; previous green runs cannot stand
   in for it. Do not weaken any audit, test, review or approval requirement.
4. An accountable maintainer posts the existing post-merge v2 declaration on
   this actual release PR, with actual rollback identity, compatibility and
   independent visual-review evidence. Do not fabricate that declaration.
5. Use the existing protected web workflow to prepare and seal the production
   artifact. Review that exact manifest and artifact, obtain the existing
   independent environment approval, and deploy only canopyproof-web.
6. Complete the existing full R3 external acceptance, including /life/center,
   /en/life/center, all required bilingual routes, original Home/ecology, assets,
   indexing/CSP/API boundaries and consultation state. Record the actual active
   version/deployment and public content/interaction evidence.

Record subsequent SHA, CI, review, manifest and deployment results in this PR
and Actions evidence; do not create repeated status-only source commits.
