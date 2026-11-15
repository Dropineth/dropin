# Global network, converging on the existing child account

## Scope and integration point

This increment updates **the existing private `/network` route**, including `/en/network` and `/zh/network`, in `workers/children-2050/worker.mjs`. It reuses the existing CSS, links, origin check and native Cloudflare Access audience guard. It does not create a second site. `/child-accounts` in the main Next application continues to redirect to the configured private portal.

New dependency-free `network.mjs` supplies a bounded, whitelist-only child-home projection, composed with the existing care-continuity-v2 `childView` and `STAGES`. The pure projection is tested with synthetic trusted-server fixtures; it is **not an identity provider, grant issuer, multisig, real database adapter, or institution dispatcher**. Its consumer must reload current authenticated actor/subject/tenant authority and current object versions from the established private backend. Never pass browser-submitted principal/grant/snapshot JSON to it.

The only newly reachable API is Access-protected `GET/HEAD /api/network/status`, returning truthful disconnected readiness. `GET/HEAD /api/network/home` returns 503 even after Access: a successful Access login only authorizes editorial content, not a real child account. All new writes return 405, and the existing enrollment/capture 503 responses remain unchanged. No personal data or 3D asset URL is exposed.

## Child-facing product

Four paths: explore nature; care with partners; get help; see progress and records. Tree planting is not the only contribution: care for existing vegetation, learning, asking questions and authorized observation all matter. Water, air, hygiene, health and protection remain basic-needs contexts, not prerequisites or scoring opportunities. Help does not require a school, personal device, wristband or ecological contribution. Health/protection case details never enter the ecological home projection.

This route is an explanatory integration surface, not a real 3D viewer. It explicitly says that accounts, live operators, capture and viewer are disconnected. It does not reinterpret a terrain surface as full reconstruction or an illustration as an observed plant. Actual 3D remains a required future integration, not counted complete by the existence of this page.

## Network topology (target, not deployed)

1. **Global environmental registry**: spatial indexes, licensed data catalogs, approved public project metadata and reconstruction-coverage manifests; no global child identity/health table.
2. **Regional operating domains**: verified organizations, data residence, authority/guardianship, roster, complaints, local ecological/permit review. Federation is governed data exchange, not automatic cross-border replication or shared credentials.
3. **Physical projects and assets**: project/site/object IDs, actual boundaries, current permissions, source observations, quality-checked meshes/point clouds/Gaussian scenes, action and review records.
4. **Children's private accounts**: project associations, minimum necessary feedback, learning and participation; rendered from current object-scoped permissions. The same project can serve children through assisted/offline channels without requiring a personal account.

H3 remains a proposed global discovery index, **not activated or silently substituted**. Existing assessment geometry is still **3 km flat-to-flat**, nominal 7.79423 km². The later 5 km sizing questions were calculations, not a migration authorization. Grid, data raster, 3D tile, institution service area and project boundary remain distinct. A grid is neither a land title nor a planting permit.

## Projection and state contracts

- Principal: server-authenticated `actorId`, `subjectId`, `tenantId`, explicit preferred locale. An assisting adult is not automatically a guardian; grants must explicitly bind actor to subject and purpose.
- Snapshot: same tenant/subject, generatedAt/validUntil, at most 200 items per collection, explicit projectRefs. No global child directory query.
- Read grant: exact actor, subject, tenant, resource type/id/version, action, valid interval and `revoked:false`. Scope must be rechecked for every asset fetch, not merely when drawing a card.
- Project: current version, current non-revoked state, approved participation and privacy review, child-safe titles. Spatial relations stay server-side in this child projection.
- Evidence: source ID/version, license label AND explicit reuse approval, digest, observation/review time, validity, source kind and native resolution. `modelled` is never field verification. Hashes are integrity metadata, not proof of truth.
- 3D asset: extra asset-level grant, privacy review, release, expiry, actual kind, capture time, source/digest, CRS and vertical datum. DSM is `2.5d_surface`; illustration is `illustration`. Geometry accuracy remains null when unmeasured. Output is a descriptor with no raw URL; gateway access is not implemented.
- Institution: project service scope, verification, safeguarding, current duty/capacity and validity. A matching institution does **not** imply delivered, accepted or completed help. No child-to-stranger contact or proximity broadcast.
- Care: current object grant plus exact subject and core-state revision binding. Uses existing core projection; no fabricated delivery state or negative child score. Issue text, clinical data, internal actor/evidence IDs are omitted.
- Ledgers: learning, participation, footprint and verified removals remain separate null/disconnected records. No automatic points, tCO2e, carbon credit, wallet or title grant.
- Language: explicit preference. This increment supplies zh/en editorial text only. Other requested language codes are retained but use the declared English fallback; no claim of Arabic or community translation completion.

## Incremental release sequence

**A — this PR:** private route convergence + closed API + bounded read-model policy + focused tests. No live activation.

**B — current-authority backend binding:** connect the established isolated Node/PostgreSQL service via a private authenticated binding. Derive the account subject from the authenticated session, not the URL. Retrieve current grants and versions atomically; implement errors, tenant RLS tests, revocation and no shared caching. Keep Child Account Backend recovery/guardian/outbox policies intact.

**C — real 3D gateway:** bind approved actual terrain/reconstruction assets; current permission on manifests and subordinate assets, short access leases, no publicly replayable URLs, correct height/axis transforms, quality and license manifests, revocation/caching tests. Reuse the existing Three.js/Cesium asset direction; do not add a decorative globe as a substitute. Rendering quality tests do not establish survey accuracy.

**D — local action and feedback:** independently confirmed operator, service area, safeguarding and roster; link ecology/capture tasks to existing authority/receipts and care transitions. Persistence and institution acceptance must occur before any user-visible delivery/acceptance claim. No unattended child field dispatch.

**E — federated rollout:** jurisdiction-specific hosting/retention/transfer agreements and local-language/community review; public aggregate disclosure review; production load/accessibility/real device tests. Global registry coverage, real 3D coverage, ecology coverage and institutional response coverage are different metrics.

## Verification

From repository root:

```sh
node --test workers/children-2050/network.test.mjs
node --test workers/children-2050/worker.test.mjs workers/children-2050/network.test.mjs workers/children-2050/network-worker.test.mjs dropin-earth/integrations/care-continuity-v2/tests/contract.test.mjs
```

Local development executed 51 new dependency-free tests against the current core domain blob `d8aecb562aae83badcacfbed3817d0aaf1ca5eaa`. Full Worker tests require the existing `page.mjs` and are included in CI; do not claim local browser or production authentication acceptance. This is a repository integration candidate, not a new standalone preview.

## Non-mutations

No database schema/migration, main-site route, DNS, Cloudflare policy, deployed version, dependency lockfile or user record changes. No live network enrollment, authoritative health decision, notification, device dispatch, real ChainRank update, legal planting permission or credit issuance. No claim of UN/UNICEF/FAO/BEV partnership or endorsement.
