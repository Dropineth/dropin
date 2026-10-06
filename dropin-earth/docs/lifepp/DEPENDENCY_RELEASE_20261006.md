# R3.2.1 dependency and release follow-up — HOLD

Observation: 2026-10-06 UTC. PR #4 was merged externally as `118b94db828387ad418c08827b890876ddae09d8`; its implementation head was `ecae69b690e0e00dd1c2bb2b8f4bc50e1abd6851`. This follow-up starts from that actual main SHA in the existing isolated worktree. Its owning commit and PR checks must be resolved from GitHub; earlier green results do not transfer to it. PR #3 remains outside scope. Home, Center, FourShopPlan, all application routes and business activation flags are unchanged by this follow-up.

## Verified input and minimal change

All 13 files in the supplied progress ZIP passed SHA-256 and ZIP CRC verification. The standalone patch and ZIP patch match (`8abbf0e220215ec4c0592c1fc3d5bc54583b0986e3eee9ba61f61255ffec201e`). Only two package nodes change: proxy-addr 2.0.7 → 2.0.8 and source-map-js 1.2.1 → 1.2.2. The package manifest and audit threshold remain unchanged. The lock SHA-256 changes from `48cee2863747559d77587c8aae8f552ed946ec797fa1ebdbd1c71dd85328344f` to `0f9dd0ff565303ba1ac5c9efb1b8f2f471f168a4b0d00bf181bb09bbd32d3a5b`.

The source-map-js registry tarball was downloaded and its SHA-512 matched the lock. proxy-addr registry requests returned 503; the local content-addressed tarball matched the lock SHA-512, and its entrypoint/package manifest matched the maintainer's tagged source byte for byte. This is not a claim of a successful fresh proxy-addr download. Both versions satisfy existing parent constraints without a new dependency or Node engine change.

## Complete finding disposition

| Finding | Dependency path and execution context | Impact condition | Disposition |
| --- | --- | --- | --- |
| proxy-addr, critical | OpenNext Cloudflare → AWS adapter → Express → proxy-addr; dev/build dependency graph, Express dev wrapper | Incorrect IPv4-mapped IPv6 trust prefix can trust arbitrary IPv4 clients and accept spoofed forwarded IPs. Public Worker reachability was not established. | Upgrade to maintainer's 2.0.8; retain normal IPv4 and correctly mapped subnet behavior in regression tests. No exemption based on dev classification. |
| source-map-js, high | Next/PostCSS and admin/miniapp production dependency graph; web Tailwind/PostCSS build processing | An attacker-controlled indexed source-map section offset can block the synchronous event loop. Public request reachability was not established. | Upgrade to 1.2.2; test invalid offsets in a bounded subprocess and normal map round-tripping. |
| braces, high | root Next ESLint plugin → fast-glob → micromatch → braces 3.0.3; local lint and CI | Deeply nested glob input can exhaust the stack. Current authored rootDir is apps/web; this does not waive the complete dependency audit. | OPEN: no verified published fixed version. |
| micromatch, high | fast-glob → micromatch 4.0.8 → vulnerable braces | Propagated dependency finding under the same input condition | OPEN with braces; not a separate patched root vulnerability. |
| fast-glob, high | Next ESLint plugin → fast-glob 3.3.1 → micromatch | Propagated dependency finding under the same input condition | OPEN with braces. |
| @next/eslint-plugin-next, high | direct development dependency 15.5.26 → fast-glob | Propagated dependency finding; CI lint includes this chain | OPEN with braces; rules and tests retained. |

Primary sources: [proxy-addr advisory](https://github.com/advisories/GHSA-jqcg-44mw-7w3h), [proxy-addr 2.0.8 release](https://github.com/jshttp/proxy-addr/releases/tag/v2.0.8), [source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q), [source-map-js 1.2.2 release](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2), [braces advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), [braces PR #77](https://github.com/micromatch/braces/pull/77).

At the 07:12–07:18 UTC upstream check, braces latest remains 3.0.3; PR #77 is open, draft and unmerged. Its proposed maxDepth is opt-in, so it does not protect this caller by default. Latest micromatch/fast-glob/Next ESLint still retain the chain. The audit suggestion to downgrade Next ESLint to 14.2.35 has not been accepted as a compatible remedy. A reviewed upstream default fix, or an independently reviewed compatible replacement covering every affected caller, is still needed. An unpublished PR, package renaming, omit-dev audit, deleted lint rules or weakened severity threshold is not a solution used here.

## Actual evidence and limits

- Cloudflare build `30b4cad3-e5da-4e37-af79-2c22f91d99df` ran original main `118b94d` with Node 22.22.3/npm 10.9.4: installation completed; audit returned **5 high / 1 critical**, stopping before application build/upload.
- Cloudflare diagnostic `4b6cd907-6df4-422b-94d1-e7ea215de91c` used that main checkout with the two temporary lock changes: frozen installation completed; audit still **failed with 4 high / 0 critical**. Its always-failing diagnostic wrapper separately prevented application build/upload. It is neither a source commit nor full CI acceptance.
- Both full log responses were retrieved independently at 07:18 UTC with `truncated=false`; their extracted audit JSON is retained under `release-remediation/dependency-release-20261006/` with hashes. Parsed tool/log evidence is not raw HTTP byte attestation.
- The new local lock-only diagnostic at 07:18:48–07:19:00 UTC returned an audit endpoint TLS error. It produced **no valid vulnerability result**; the stored error is not replaced by an older successful scan. A full clean installation/build was not attempted on the Mac with approximately 422 MiB available. Candidate acceptance must come from fresh pinned remote CI.
- Targeted tests at 07:22 UTC used the actual patched package tar bytes in an isolated fixture: **8/8 PASS**; the two added tests both failed against the old package bytes as expected. Scoped ESLint passed. Shared node_modules remained unchanged; these are bounded regressions, not clean whole-repository installation or CI. Commands, module paths and hashes are preserved in `REGRESSION_RESULT.md` and `regression-results.json` below the evidence directory.
- Release policy/workflow/indexing/evidence checks passed **35/35** at the recorded precommit source state. The log and post-run file-hash snapshot are retained; these are local agent checks, not independent human approval or final CI.
- Local workspace typecheck passed. Plain local `eslint .` failed with 3,372 errors, all in 26 preserved ignored historical report scripts; no tracked source path had a finding. A subsequent tracked-source diagnostic passed for 526 JS/TS files. The original CI lint command/configuration is unchanged; clean remote CI remains authoritative.
- The original checkout's 529-entry dirty status was preserved with SHA-256 `e86859fd8cc2ca284cf0064e9cba2375b95a7a0bf59ebfc8afc81ca8730cf2d7`. Existing source, screenshots and logs were retained.

## Publishing path

Live Cloudflare GET at 07:18:18 UTC, followed by current non-secret build-variable GET at 07:24:18 UTC, confirms both production triggers now use **versions upload**, rather than deployment. web uses root `dropin-earth`, pinned Node/npm, clean installation and the unchanged audit before application build. The old web-root and direct-deploy command blockers are closed. Nonproduction triggers still retain their earlier root/build configuration; their success and public preview are not claimed. Token capability and other release paths still require the maintainer's actual declaration; command text alone is not that declaration.

The original protected workflow bound every future release to PR #4's merge SHA, which prevents a dependency follow-up from passing prepare. The companion policy change explicitly binds the selected release PR, its final independently reviewed head and its actual merge result to main, while retaining PR #4 as an independently reviewed merged ancestor. Maintainer attestation, full same-main-SHA CI, sealed production artifact, independent protected-environment approval and active rollback checks remain required. Agent review does not satisfy the human approval requirement.

The active production deployment is still `5213c84d-4822-4479-8b1d-3ced2d82a378`, version `84a01fed-6be3-4975-892d-85c9b7f4ade7` at 100%, created 2026-07-08. These identify existing production, not this release. Known-good rollback and binding compatibility need operator evidence. No new preview, deployment or production manifest was created in this follow-up precommit phase.

## Remaining release inputs

1. A compatible resolution of the braces chain, followed by complete green CI on the final candidate and actual resulting main SHA. No waiver was issued.
2. Real independent final-head review in the follow-up PR. PR #4's approval cannot approve its later changes.
3. A maintainer declaration on the selected release PR linking visual review, absence of unapproved automatic publishing, and verified known-good active rollback compatibility.
4. Review the actual production prepare artifact, then approve the existing `canopyproof-production` environment with the exact SHA/manifest/rollback phrase required by the workflow.

33/29 remain disabled with the original safe fallback, 31 remains historical compatibility, and the local spatial UI remains a labelled software schematic. Consultation remains draft-only with no real delivery/persistence. Billing, RWA, robot control, training-data sales and certification remain disabled. Blender and unaccepted WebGL are not used to claim website acceptance.
