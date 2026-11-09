# Public child CAI experience — release candidate

Based on main 83cdde7 (PR24 merged externally). This change adds bilingual,
read-only `/child-accounts` and `/zh/child-accounts` guides to the existing site.
The requested `/children` and `/zh/children` entries return the same public guide
directly with HTTP200, not a redirect. Canonical URLs remain /child-accounts.
Ivory/forest CanopyProof introduces learning and choice; the paired dark AHIN
guide explains human authority. Reciprocal links are informational: no JWT,
PoCC credential, identity assertion, cookie or token crosses domains.

The guides return fixed HTML with native keyboard-operable disclosures, no
script, form, analytics or personal-data input. Middleware preserves their
default-src 'none' CSP and no-referrer policy. Home navigation exposes the guide;
the existing /stewardship synthetic learning experience remains a separate route.
Nothing mounts the CAI adapter/backend or opens real enrollment and money flows.

Stewardship Back now follows visited browser entries, not screen-array order.
Per-mount navigation IDs reject stale indices after reload; stale entries return
to S01. Only navigation IDs/indices enter history, never drafts or authorization.
Going back cannot restore withdrawn consent. Mobile source/time metadata remains
visible. Existing stop/help controls and the 35-screen flow remain.

Validation: 173 child/public unit tests passed with the pinned upstream runtime
enabled; full lint and web TypeScript passed; Next and OpenNext builds passed.
Eight production-build browser cases cover both brands, both languages and
390/1440px widths: direct loading, refresh, disclosures, focus, Back/Forward,
no overflow, no request-marker reflection and reciprocal hrefs. Independent
review also verified history remount isolation and mobile provenance.

Local visual evidence: /workspace/child-public-qa/*.png and results.json. These
are local artifacts, not published production screenshots. Browser checks used
the installed Chromium/Playwright runtime; no alternate browser was installed.
The initial dev-mode stewardship interaction could not hydrate because its strict
CSP correctly blocks unsafe-eval; production-build interaction tests passed
without relaxing CSP. Initial history review found a stale-index bug, fixed and
independently retested before completion.

The reported production /stewardship 404 is not reproduced locally (HTTP200).
The built route exists. No production revision has been verified and no DNS or
middleware rewrite is justified as the cause. A deployed revision mismatch is
possible, not proven. Verify this deep link after the authorized release.

Production remains pending. The existing deploy-canopyproof.yml requires an
independent human final-head review, same-SHA CI, maintainer attestation and
current 100%-traffic rollback version/deployment IDs. These are not supplied by
local tests or a preview. Prior denied Cloudflare reads and Actions reads were
not retried. Resolve access through the existing owner and use the established
release/rollback workflow; do not replace it with a direct upload. Current
rollback readiness is unverified, so no rollback execution is claimed.

User sequencing requires a genuine platform preview before any merge or live
cutover. Verify preview GET/HEAD /children with direct HTTP checks, both languages,
refresh and page assets. Localhost evidence does not satisfy this condition.
Use the existing branch-preview mechanism; do not create a new custom domain,
credential or alternative hosting deployment to bypass an access restriction.
Direct curl to https://canopyproof.org/children on 2026-11-09 was rejected by
the environment proxy: HTTP403 CONNECT tunnel failed. This is not an origin
response or evidence of a route 404. No alternate route was used to bypass it.

Release both public guides together or verify the peer URL before switching
traffic. Check GET/HEAD for both locales, POST rejection, reciprocal links,
/stewardship direct load/refresh, original home/services and exact platform
revision. Retain the independently verified pre-release version for rollback.
This public release does not establish a live child-account service, live
inference, real guardian authority, distributed atomic revocation, WebAuthn in
the CAI adapter, smart contracts, ZK or institutional endorsement.
