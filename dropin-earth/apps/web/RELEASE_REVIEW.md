# Bilingual web release: complete-candidate independent review

This is a new release review of the complete application candidate. It is not
retroactive approval of PR #5 and does not authorize production deployment.

## Required review scope

Review every source change from the independently reviewed PR #4 merge
`118b94db828387ad418c08827b890876ddae09d8` through the final head of this follow-up
PR, including all PR #5 changes. Reviewing only this document is insufficient.

- [Full merged source delta](https://github.com/Dropineth/dropin/compare/118b94db828387ad418c08827b890876ddae09d8...ef249b617e38611807df6c3f4d50784339992633)
- [PR #5 code and dependency disposition](https://github.com/Dropineth/dropin/pull/5/files)
- [Dependency compatibility and residual maintenance conditions](../../docs/lifepp/DEPENDENCY_RELEASE_20261006.md)
- [Protected production release requirements](../../docs/lifepp/R3_RELEASE_AUDIT.md)

The scope includes dependency behavior and lockfile integrity, the ESLint
compatibility bridge, unchanged browser assertions and error diagnostics,
release-PR/commit binding, language and CSP/cache boundaries, and the inherited
bilingual Center integration. Existing Home, FourShopPlan and ecosystem entries
must remain intact. Scenes 33/29, unaccepted WebGL, real consultation delivery,
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

Cloudflare uploaded candidate version `d21c4ef9-70fc-4ad6-9c77-b125ad442373`;
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
