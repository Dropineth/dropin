# CanopyProof — My 2050 protected child-facing guide

Scope: an original bilingual, responsive learning UI for the existing `children.canopyproof.org` protected Worker. This increment does NOT implement or activate real enrollment, persistent learning records, live Gaussian splat ingestion, equipment dispatch, or carbon-credit claims. Do not advertise any of those as delivered.

## Actual implementation

Six Chinese and six English editorial pages: home, learning, account preparation, spatial capture, distributed contributions, and families. Legacy child-guide aliases remain protected. Sources distinguish the UN 2030 SDG Agenda from the 2050 net-zero objective. Learning, footprint estimates and independently reviewed environmental contributions are separate ledgers; missing measurements remain unknown, not zero.

The original `dropin.site` reference describes trees, environmental participation, lotteries and DePIN. This child-facing adaptation carries forward the nature/action theme, not lottery, wallet, yield or investment mechanics. No organizational logos, endorsement claims, copyrighted photographs or source website assets were copied.

The new UI uses native HTML/CSS with no runtime package or third-party resource requests. The design review considered shadcn/ui and Radix accessible composition; they are references, not installed dependencies. React Three Fiber and Spark are candidates for a later authenticated viewer; neither is bundled here. The symbolic globe and capture graphic are explicitly illustrations, not live measurements.

## Access boundary

- Exact HTTPS origin only: `https://children.canopyproof.org`.
- Preserve the existing Cloudflare Access application and its restricted administrator policy. Do not expand access to children/families as part of this increment.
- Native `ctx.access.aud` must match the non-empty 64-hex `CHILD_PREVIEW_ACCESS_AUD` configuration. Browser headers, cookies and query strings cannot substitute for the runtime context.
- HTML, CSS and status/API endpoints are all guarded; workers.dev and version preview URLs remain disabled.
- No scripts, frames, form submissions, remote images, telemetry, camera, microphone, location or payment permissions.
- Access authentication is not verified guardianship. Never remove the gate or add a header-only fallback to make a preview load.

## API contract in this increment

`GET /api/status` requires Access and returns release metadata with `accountOpening: not_connected`, null account ID, null contribution count, and disconnected capture/live-scene status.

`GET/HEAD/POST /api/children/accounts` and `/api/capture-requests` require Access and return 503 `SERVICE_NOT_CONNECTED`. They do not read bodies, persist data or return a fictional success. Unauthenticated requests are denied before these handlers. Other writes return 405. These are closed interface placeholders, NOT backend implementations.

## Real enrollment work still required

Use the established isolated child backend and PostgreSQL authority/RLS contracts; do not replace them with localStorage, D1 or an unverified email checkbox. Identify an accountable operator and region; integrate approved current guardian proof and child-appropriate participation choice; create and read back real durable records; demonstrate cross-account isolation, revocation, recovery, deletion and safe shared-device logout. No real child data should be requested in chat or inserted into a public PR. The existing outbox-delivery hold must remain intact.

## Capture/contribution work still required

Bind request IDs to project/site permission and current guardian/organization authority. Require an authorized adult collector, device identity, capturedAt and receivedAt, source hash, processing version, license, privacy review and independent reviewer. Redact sensitive spatial content before granting a viewer lease. Recheck authority at fetch time, deduplicate evidence and support challenge/revocation. Streaming render time must not be presented as capture time. Rendering, confidence scores or signatures alone do not establish real-world truth, carbon removal, credit issuance, additionality or carbon neutrality. No unsupervised child dispatch, face/iris collection, public child locations, rewards market or monetary leaderboard.

## Tests

Run `node --check workers/children-2050/worker.mjs`, `node --check workers/children-2050/page.mjs`, and `node --test workers/children-2050/worker.test.mjs`. On Node 22.16.0, 36 focused tests passed locally. Authenticated contexts in these tests are synthetic fixtures, not real guardian or Cloudflare login acceptance.

Local Chromium rendered snapshots were inspected at 375, 390 and 1440 pixels across all 12 pages: 36 layout cases had no document-level horizontal overflow. This was local static layout testing, not a real authenticated browser session or a full WCAG audit. Live anonymous denial, existing allowlist preservation, main-site non-interference and authenticated usability still need separate rollout evidence.

## Source links, reviewed 2026-11-15

- UN SDGs / 2030 Agenda: https://sdgs.un.org/goals and https://sdgs.un.org/2030agenda
- UN net zero: https://www.un.org/en/climatechange/net-zero-coalition
- UNICEF climate action: https://www.unicef.org/take-action/campaigns/climate-action
- FAO YUNGA forests: https://www.fao.org/yunga/activities/challenge-badges/forests/en
- FAO climate badge: https://www.fao.org/yunga/activities/challenge-badges/climate-change-challenge-badge/en
- UI references: https://github.com/shadcn-ui/ui and https://github.com/radix-ui/primitives
- Later viewer candidates: https://github.com/pmndrs/react-three-fiber and https://github.com/sparkjsdev/spark
- Native Access context: https://developers.cloudflare.com/workers/configuration/cloudflare-access/

## Rollout / rollback

This source is independent of the main CanopyProof frontend. Do not merge it into main or alter the main-site deployment without its normal checks. User-authorized protected guide replacement must target only the existing child-guide Worker, preserve Access settings, disable workers.dev/version URLs and record both old/new version IDs. If the candidate cannot be validated, keep the previous protected guide. Do not change database, DNS ownership, private backend transport or enrollment flags from this rollout.
