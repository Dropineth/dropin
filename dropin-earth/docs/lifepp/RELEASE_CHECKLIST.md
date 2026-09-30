# CanopyProof × Life++ release checklist

Status: **REMEDIATION IN VALIDATION — NOT DEPLOYED**. The baseline Trust Gate at `8ba02a3` failed with 19 audit findings. Current remediation must pass every applicable gate on one committed candidate; no earlier checked box below is itself evidence of a new commit passing. Use `delivery_status.json` and fresh candidate-bound CI artifacts for current results.

## Release remediation acceptance

- [ ] Committed candidate uses Node 22.22.3 / npm 10.9.4 and a clean locked install.
- [ ] All 19 baseline findings have reviewed dependency/condition dispositions and the current moderate audit passes with raw JSON retained.
- [ ] Full same-candidate Trust Gate: lint/types/units/PGlite/build/audit/native PostgreSQL/coverage/original browser matrix/OpenNext/workerd; no hidden skipped requirements.
- [ ] Same-candidate Life++ acceptance, supported MapLibre overlay rendering and unavailable-WebGL fallback.
- [ ] All required page screenshots and mobile key flows visually reviewed, with actual scope recorded.
- [x] Scene 31/29 preserve HTTP source URLs, unknown metadata and explicit safe fallback; neither is claimed loaded.
- [x] Consultation defaults to draft/not sent; optional server persistence remains disabled without approved inputs. Local synthetic tests do not establish real receipt.
- [x] Remote staging blockers recorded without changing environments, creating resources, using tunnels or merging PR #3.
- [ ] Public isolated preview is actually accessible through the protected authorized path, with noindex and isolated resources (currently blocked).
- [ ] Real receipt/persistence verified against the approved receiving configuration (currently blocked).
- [ ] Real scene 31 and 29 rights/HTTPS/frame policy/readiness independently accepted (currently blocked).

The remaining checklist describes implementation invariants established in the first stage and the continuing release process; current execution is governed by the candidate-bound results above.

## Candidate identity and preserved boundaries

- [x] Record implementation commit SHA, branch, PR URL and immutable observed CI run links in `delivery_status.json`. Main was reconfirmed at the recorded base; user changes stay in the original checkout. Final release approval must bind the later final PR head, not an older evidence commit.
- [x] Confirm changes are limited to this website and necessary reports/tests; no independent protocol repository, wallet, real robot, token, payment, fund release or DNS change.
- [x] Record actual Node/npm/browser versions and model runtime metadata only when attested. No guessed model/tier.
- [x] Confirm original logo JPGs, ecology page, all original anchors, `#explorer`, `/explorer`, TerraProof, methodology and demo disclaimers remain.
- [x] Confirm four room IDs/areas and proposed annual fees exactly match the user input; retain proposed/not charging and planning-not-lease-verification boundaries.
- [x] No private finance, fabricated scale/partners/certifications, degree-granting claim, unsafe action or hidden training consent.

## Local checks and review evidence

Run in `dropin-earth`, recording exit codes and preserving failures. Use the existing lock; do not relax assertions or coverage to obtain a green result.

```bash
npm ci --include=optional
npm run gate:supply-chain
npm --workspace apps/web run typecheck
npm --workspace apps/web run lint
npm run ci
npm run test:coverage:ratchet
npm run coverage:critical
npm run test:webgl:browser
npm --workspace apps/web run cf:build
npm run test:workerd
```

Native PostgreSQL authority checks require the existing disposable CI database and explicit disposable-database confirmation. Do not point them at production or create infrastructure for this web task. Run them through the existing CI gate if local disposable infrastructure is unavailable. Browser downloads/installations, if needed, must be reported; missing browser engines are not passing tests.

- [x] All new Chinese and English routes return intended content; `/life/spaces/31` and `/life/spaces/29` are reachable within two clicks from home; unknown scene/locale paths return 404.
- [x] Registry runtime validation rejects bad protocols, credentials, non-allowlist origins and unapproved embed state. Original HTTP source URLs and null metadata are preserved.
- [x] No third-party iframe/model request on initial pages or for either unapproved HTTP scene; explicit external link safeguards remain.
- [x] Mock viewer tests cover origin/source/schema handshake rejection, timeout, retry, unsupported WebGL, mobile fallback and unmount cleanup. Report MOCK independently of REAL SOURCE results.
- [x] Lead draft validation, privacy confirmation and copy behavior work without remote submission or false receipt. The optional receiver now additionally requires separate sending consent, server validation, atomic limits, retention cleanup and persistence readback; real configuration and receipt remain unverified.
- [x] Membership has no payment, checkout, wallet, recurring billing or entitlement activation.
- [x] Selected keyboard, focus, headings, labels, errors, reduced motion and no horizontal overflow checks verified at desktop, tablet and 375px. Keep before/after screenshots with route, viewport and commit context.
- [x] English pages have complete localized content and consistent language/canonical/hreflang; no dead language control.
- [x] Record actual resource/bundle/LCP/CLS measurements and the explicit unmeasured field-INP gap with browser/environment limits. Do not invent scores; distinguish lab observations from field performance.

## Worker-runtime and indexing gate

- [x] Build exists: `.open-next/worker.js`, asset directory and expected root/route artifacts. Inspect actual output; Next build alone is insufficient.
- [x] Loopback workerd smoke covers root, original critical paths, every new locale/scene/company path, 404, robots, sitemap, JPG assets and original safety boundaries.
- [x] Real browser exercises client controls against workerd with no CSP hydration failure. Verify deep links and in-app navigation, not status codes alone.
- [x] Preview/staging: robots disallow, no indexable sitemap and noindex headers/metadata actually served on root, Life++ routes and asset-backed HTML. Confirm no duplicate public metadata files shadow the metadata routes; inspect generated Worker metadata assets.
- [x] Production: canonical/hreflang and sitemap use the verified public origin and include intended new pages without duplicate indexes.
- [x] Static homepage promotion and new multi-route handling are inspected; no unapproved frame source, wildcard CSP, arbitrary proxy or disabled mixed-content protection.
- [x] Record the existing `/reports/esg` baseline mismatch separately if it fails; preserve the existing check until the gap is resolved or reviewed.

## Isolated preview approval gate

Local loopback Next/workerd preview is permitted for this implementation. External staging is **not approved by this checklist**.

- [x] Verify current PR #3 control-plane status independently; do not merge, rewrite or borrow its secret-bearing path for this task.
- [ ] Confirm the authorized staging path accepts this exact candidate and has a route-free web/API Worker, distinct HTTPS API origin, isolated PostgreSQL/object storage, no production data, resource manifest and matching digest.
- [x] Verify actual environment reviewers and self-review prevention. Current read-only evidence confirms these controls, not the complete resource configuration.
- [ ] Verify the applicable repository and environment branch rules for the exact candidate; current staging policy was read and permits only main; this candidate is not thereby approved.
- [ ] Obtain the required independent environment review; automation must never approve itself.
- [x] Do not manually dispatch the existing staging workflow for this Life++ branch: source code pins manual candidates to `canopyproof/industrial-rc1`. Do not change that gate as a shortcut.
- [x] If authorized external preview becomes available, record exact commit, workflow, Worker version, actual URL, noindex and external route smoke. Otherwise deliver PR plus local preview and state external preview unavailable.

## Production gate — stop until satisfied

- [ ] Independent review approves the exact final candidate; all applicable CI checks complete without hidden skips or unresolved blocking failures.
- [ ] Release approval artifact binds the final target SHA. Rebase or new commit invalidates previous target binding.
- [ ] Required `canopyproof-production` environment reviewer approves through the existing protected workflow. Preserve all repository protections and no-self-approval behavior.
- [ ] Record current known-good web Worker deployment/version and rollback operator procedure before release. The baseline source commit alone is not a verified deployed rollback version.
- [ ] Confirm `/api/*` route remains on the separate API proxy and public admin proxy stays disabled.
- [ ] Confirm billing, training, robot navigation/live control, live video, mainnet transfers and automatic distribution remain disabled.
- [ ] Record approved commit, CI/build evidence, approval, deployment resource/version, hostname route mapping and exact deployment result. No required approval or configuration means **NOT DEPLOYED**.

## Post-release smoke and rollback

Only after an authorized deployment, perform bounded external checks:

- [ ] `/`, original anchors and all new locale/company/scene pages render and interact correctly.
- [ ] `/robots.txt`, `/sitemap.xml`, canonical/hreflang and expected security headers are correct for production.
- [ ] `/api/ready` returns 200 and `/api/admin/launch/readiness` returns 403; original JPG logo assets return image content.
- [ ] Forms still tell the truth about draft versus actual receipt; unapproved third-party scenes remain disabled.
- [ ] Preserve smoke timestamps and workflow/deployment URLs. A green web route alone is not proof of overall API or scene readiness.

Rollback triggers: broken root/new routes, CSP/client failure, incorrect locale/indexing, private-data disclosure, unsafe claims, accidental live actions or exposed admin route.

For a web regression, the authorized operator rolls back `canopyproof-web` to the recorded prior successful Worker version through Cloudflare deployment history and repeats web/metadata/API/admin smoke. Keep the API proxy independent. If root succeeds but `/api/ready` fails, inspect API route precedence and upstream configuration before reverting the web Worker. Public admin exposure is a critical incident: force the approved disabled-admin policy through the protected operator process, verify 403 and record the incident. Never delete append-only records, rewrite history, alter DNS opportunistically or bypass approval artifacts while rolling back.
