# Phase 2 Production Readiness

Date: 2026-07-19

Decision: **NOT READY FOR PRODUCTION ACTIVATION**

Scope: CanopyProof Trust Kernel, evidence custody, verification, audit, MRV,
Environmental Proof lifecycle, canonical ESG reporting authority, and the
canonical public transparency authority, deterministic satellite proof adapter,
the read-only Global Command Center projection, and its route-closed minimized
spatial-disclosure authority.

## Decision Basis

The route-closed authority core is materially stronger than a prototype. The
current tree includes immutable facts, canonical hashing, exact command
receipts, serializable transactions, forced row-level security, replay, and
human authority boundaries. The evidence-to-record, governed metric/report,
Environmental Proof lifecycle, and public-transparency paths have executed
against both PGlite contract tests and a disposable native PostgreSQL 17
instance.

That evidence does not authorize production activation. Provider trust,
privacy, operations, and institutional controls listed below are unresolved.

## Readiness Matrix

| Control | Current evidence | Decision |
| --- | --- | --- |
| Identity and RBAC | Durable participants, organizations, memberships, accreditation, role substitution tests, tenant context, and RLS. | Implemented, gated |
| Evidence custody | Consent, device, media, review, retention, offline bundle, and community-context authorities are append-only and replayable. E2a object/scanner and E3c metadata-extractor verification are separate immutable facts: they authenticate bounded provider receipts without mutating modeled base facts or granting evidence truth. | Implemented, adapters default-off, routes gated |
| Browser offline vault | Strict v2 drafts are AES-256-GCM encrypted in IndexedDB with a non-exportable key, randomized IVs, AAD-bound revisions, quota/CAS controls, and fail-closed migration/tamper states. Real browser execution proved structured-clone persistence and ciphertext-only storage. A default-closed authenticated adapter and injected client coordinator provide deterministic authority binding, E4 reconciliation and exact actor-scoped recovery without raw-note transfer or a mounted production transport. Composite binding uses one serializable transaction plus a non-authoritative revision fence; PGlite and native dual-connection revoke-first tests reject without partial writes. A separate default-closed PostgreSQL admission authority now enforces fixed body caps and serializable actor/organization windows; PGlite and native request-30/31 contention gates pass and denials are immutable root-verified facts. Device-loss recovery, time-based retention, reviewed transport, Cloudflare edge abuse controls, XSS hardening review and field-device validation remain absent. | Local storage, sync, and API-admission foundations implemented; production sync closed |
| Verification | Rules and advisory AI precede independent human review and final human decision. AI cannot finalize its own output. | Implemented, gated |
| Audit | Semantic streams, database mutation streams, command receipts, root parity, append-only triggers, and fail-closed rollback controls exist. | Implemented, gated |
| Digital MRV | Closed relationship matrix, exact source-root resolution, immutable edges, complete human-reviewed snapshots, forced RLS, and exact retry passed PGlite and native PostgreSQL execution. | Implemented, route closed |
| Environmental Proof lifecycle | Current governed record, reviewed MRV snapshot, managed-key attestation receipt, detached-signature receipt, validity policy, challenge downgrade, and deterministic projection are bound without private-key custody. A constructor-only AWS KMS `GetPublicKey`/`Verify` runtime now enforces one fixed key ARN and emits deterministic opaque receipts, but it is not composed or provider-tested. | Implemented, provider runtime default-off, route closed |
| Canonical ESG reporting | Append-only metric-definition, metric-result, source-member, metric-member, and report facts bind current signed proof, MRV authority, exact governed metrics, independent review, and an accredited human publisher. The revised metric-bound path passes TypeScript, PGlite, and disposable native PostgreSQL gates. The existing mounted ESG API remains explicitly non-canonical compatibility behavior. | Implemented, route closed |
| Public transparency | Independent human privacy review and separate accredited publication produce privacy-minimized immutable facts with current challenge projection, exact replay, forced RLS, append-only enforcement, and SQL/TypeScript root parity. Unit, PGlite, and disposable native PostgreSQL gates pass; no Explorer route is mounted. | Implemented, route closed |
| Global operational projection | Strict schema/root replay, repeatable-read latest snapshot selection, append-only/audit enforcement, explicit authority metadata, and a fail-closed authenticated client pass unit, PGlite, native PostgreSQL, and local workerd verification. The governed snapshot writer is route-closed. A separate route-closed spatial authority now appends exact candidate privacy/safeguarding reviews, independent human publication, withdrawal, expiry projection, forced-RLS policies, exact receipts and audit roots. Only an integer-degree centroid bound to current source/project count and a cohort of at least three is representable; raw coordinates and scene bounds are excluded. PGlite root/transaction evidence passes, while the newly added non-bypass native RLS scenario has not run in this environment. The durable source resolver, production authority provisioning, reviews and activation decision remain absent. | Read and route-closed writers implemented; activation closed |
| Satellite proof adapter | Baseline, observation, and audit fixtures replay through the deterministic protocol state machine. High-risk fixtures open challenges and unlock remains governance-gated. No live provider call exists. | Fixture-only, write closed |
| OpenTelemetry API and edge export | Strict W3C edge-to-origin context rebuilding, Web Crypto IDs, client sampling-bit containment, privacy-minimized API/edge server spans, exact OTLP/HTTP JSON, bounded Worker `waitUntil` export, finite API queue/batch/payload/timeout/retry policy, strict endpoint rules, sparse API diagnostics, and self-metrics pass focused tests. Actor identity and raw request identifiers are excluded. | Implemented default-off; checked-in edge ratio zero; Collector debug-only; production activation and backend receipt closed |
| Public API | Lifecycle and MRV status objects explicitly report `routeMounted: false`; no reviewed production route is mounted. | Closed |

## Executed Technical Evidence

- PGlite executes the evidence, verification, MRV, lifecycle, RLS,
  append-only, hash-parity, and rollback contracts.
- Disposable PostgreSQL 17 executed dual-connection exact replay, serializable
  contention, consent-revocation versus mobile-binding fencing with no leaked
  evidence or binding receipt, current source-root re-resolution, lifecycle
  signature facts, governed metric-bound canonical ESG publication/projection,
  canonical public transparency review/publication, explicit non-bypass RLS
  denial, challenge downgrade, and reconnect replay.
- Bounded retry handles PostgreSQL `23505`, `40001`, and `40P01` conflicts by
  opening a fresh transaction; it never changes the command or authority
  checks.
- The satellite fixtures prove deterministic roots only. They are not evidence
  of provider authenticity, geospatial accuracy, or environmental outcomes.
- Node.js 22.22.3 with npm 10.9.4 full local CI passed lint, every workspace
  typecheck, 817 unit
  tests, 18 PGlite contract scenarios, every workspace build, and the moderate
  npm audit with zero reported vulnerabilities.
- The all-source coverage ratchet passed at 65.83 percent statements/lines,
  73.58 percent branches, and 70.80 percent functions. These values remain
  below the greater-than-90-percent institutional target.
- The independent OpenNext Cloudflare build completed and generated
  `apps/web/.open-next/worker.js` plus static assets.
- Local workerd returned `200` for the Global Command Center, the homepage,
  Explorer static/dynamic routes, sampled institutional pages, and required
  metadata assets using OpenNext's supported Node.js compatibility runtime.
- The `/mobile/report` browser path migrated a controlled legacy fixture into an
  IndexedDB ciphertext envelope, removed the plaintext value, restored the
  draft after reload, emitted no browser errors, and removed the fixture after
  verification. Production sync remained closed.
- Desktop and 390-pixel mobile browser checks observed a nonblank, correctly
  framed WebGL globe, one instanced marker draw, stable layout, and interactive
  OrbitControls redraws. Those checks do not substitute for production device,
  accessibility, safeguarding, or load review.

These local results must be reproduced from a clean reviewed commit by the
repository CI before this document can be used as release input.

## Blocking Production Gates

1. Review and provision the default-off AWS KMS attestation and detached-
   signature verifier with an exact-key IAM policy limited to `GetPublicKey`
   and `Verify`, retained CloudTrail evidence, a key ceremony, rotation and
   revocation operations, live compatibility tests, and an independently
   approved composition root. GCP Cloud KMS, Azure Key Vault, and managed-HSM
   ports remain absent. Private keys must never enter CanopyProof application
   memory, logs, fixtures, or storage.
2. Complete privacy, data-residency, retention, precise-location, and data
   subject reviews for every route and export projection.
3. Provision least-privilege PostgreSQL roles and versioned production
   migrations with backup, restore, and rollback rehearsals.
4. Activate reviewed object storage and malware-scanner ports, capture a live
   bucket-lock policy observation, and connect metadata extraction, queues, and
   staffed exception review with signed provider receipts. The governed
   effective-media projection and route-closed durable metadata orchestrator
   are implemented, and E1a now provides a route-closed fixture adapter plus an
   additive effective-device authority without mutating E1. Production
   composition still requires a durable unpredictable nonce store, live
   provider protocol and revocation validation, approved key operations,
   monitoring, and field-device testing. Do not relax the extractor's existing
   `available` media prerequisite or mutate E1/E3b modeled facts.
5. License and review each live Sentinel, Landsat, Planet, ICEYE, Capella,
   Maxar, Airbus, drone, or field-validator adapter before replacing fixtures.
6. Add production telemetry, SLOs, alerts, dead letters, multi-region failure
   tests, incident response, and independent security review.
7. Approve route-specific authorization and public minimization contracts.
   Routes must be opened individually, never by a global compatibility flag.
8. Review and approve canonical ESG metric definitions, framework mappings,
   publisher operations, public projection, and report rendering. The mounted
   process-local compatibility API must not become a parallel authority.
9. Integrate the route-closed Global Command Center spatial-disclosure
   repository with a durable current-source resolver; provision least-privilege
   publisher/reviewer identities and migration roles; rerun the new native
   non-bypass RLS scenario; and complete privacy, protected-species, community
   safeguarding, legal, load, incident and rollback review. The current read
   model must continue to withhold geometry when no valid disclosure fact exists.

## Public Transparency Readiness

The append-only privacy review and publication authority now passes unit,
PGlite, and disposable native PostgreSQL root parity, exact retry,
failed-write atomicity, reconnect replay, forced-RLS, tamper, and challenge
propagation tests; PGlite also proves empty/non-empty rollback behavior. Its
route, production activation, and public reliance flags remain false.
Versioned production migration execution, least-privilege grants,
backup/restore, privacy impact, community safeguarding, legal claims,
edge abuse/rate-limit/DDoS, accessibility, and incident-response evidence remain required
before any Explorer route is activated against a durable production authority.

## Safety Boundaries

- No mainnet funds or automatic CANOPY distribution.
- No private-key handling.
- No certified carbon-credit or carbon-tax-offset claim.
- No guaranteed yield, title, ownership, or financial-asset claim.
- AI and satellite adapters remain advisory inputs; independent human
  authority is required.
- `CANOPY_PRODUCTION_UNLOCK` remains false unless a separate governed
  production decision explicitly enables it.

## Rollback Decision

Route-closed code can be removed only with its documented fail-closed rollback
scripts. Lifecycle rollback refuses to run after any lifecycle authority fact
exists. Production data must never be deleted to make a rollback succeed;
forward remediation and governed supersession are required instead.
