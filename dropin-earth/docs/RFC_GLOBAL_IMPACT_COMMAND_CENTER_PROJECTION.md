# RFC: Durable Global Impact Command Center Projection

Status: Read path plus route-closed governed snapshot and spatial-disclosure
writers implemented and locally verified; public-safe Earth-view amendment
accepted; durable source resolver composition, scheduler, and production
activation remain closed

Date: 2026-07-14

Owners: CanopyProof Impact, Trust Kernel, Data Governance, Security, Platform
Operations, Accessibility, and Institutional Reporting

Decision class: Cross-organization operational read model and institutional
reliance boundary

## 1. Problem Statement

At RFC adoption, `/dashboard/global` rendered fixed presentation values from
`apps/web/src/data/canopyproof-os.ts`, while its authenticated API counterpart
aggregated seeded process-local services. The implemented read path now uses a
strict shared schema, verifies every deterministic root, and selects the
append-only PostgreSQL snapshot repository whenever the principal is bound to
durable authorization. It fails closed instead of falling back to compatibility
data. The route-closed governed publishing core is implemented; durable source
resolver composition, scheduling, and activation remain closed.

An institutional command surface must never blur sample content, process-local
state, and governed records. This RFC replaces that ambiguity with a strict
projection boundary:

1. deterministic domain code may build a candidate snapshot from bounded
   source authorities;
2. the separately governed publishing repository may append a verified
   snapshot only with current authority and independent approval;
3. production HTTP reads use only the latest valid PostgreSQL snapshot;
4. missing, malformed, or root-inconsistent snapshots fail closed;
5. the OpenNext Worker UI renders only a strictly parsed durable response and otherwise
   displays an explicit unavailable state; and
6. the dashboard remains read-only and cannot issue proof, certificates,
   credits, funding instructions, or emergency declarations.

## 2. Scope And Non-Goals

In scope:

- a shared strict Zod contract for the dashboard snapshot and API envelope;
- deterministic verification of regional and dashboard roots;
- a PostgreSQL repository that reads append-only snapshots in a repeatable-read
  transaction;
- production fail-closed behavior with stable error codes;
- explicit response authority metadata distinguishing durable PostgreSQL from
  development compatibility data;
- an authenticated client view with stable loading, unavailable, empty, and
  ready states;
- bounded regional, indicator, activity, and lineage rendering;
- tests for root tampering, missing snapshots, RBAC, restart-safe reads, and
  response-shape rejection.

Not in scope:

- enabling a production snapshot writer;
- treating a snapshot as an Environmental Proof Record or certificate;
- anonymous dashboard access;
- exposing raw evidence, identities, exact protected locations, signatures,
  credentials, or private organization identifiers;
- moving funds, distributing CANOPY, or creating financial settlement;
- certified carbon-credit, carbon-tax-offset, ownership, title, regulatory,
  emergency, or guaranteed-yield claims;
- replacing source authorities with dashboard rows;
- live satellite-provider calls or fabricated map points.

## 3. Trust Model

```text
Durable project / evidence / proof / risk / funding source authorities
                                |
                                v
Governed projection job (independent service identity and reviewed policy)
                                |
                                v
Deterministic snapshot builder + source-root verification
                                |
                                v
Append-only impact.global_command_center_snapshots
                                |
                                v
Repeatable-read repository + strict schema + root replay
                                |
                                v
Authenticated API envelope with explicit authority metadata
                                |
                                v
Worker-compatible client validation -> loading / unavailable / empty / ready state
```

The snapshot is a materialized operational projection. Source authorities
remain authoritative for their own facts. A snapshot can summarize only source
records that were valid at its `generatedAt` boundary. It cannot create or
upgrade a source record, and its existence cannot satisfy proof, certificate,
governance, funding, or emergency requirements.

Production trust is fail-closed:

- PostgreSQL mode never falls back to process-local aggregation;
- a malformed JSON column, invalid timestamp, unexpected field, unsafe safety
  boundary, or mismatched root makes the source unavailable;
- compatibility mode is labeled `process_local_compatibility` and cannot be
  accepted by the production web view as durable data;
- actor authentication and durable authorization binding are required before
  the repository is selected.

## 4. Data Flow

### 4.1 Projection write path (implemented core, activation closed)

1. A scheduler authenticates as a dedicated projection service identity.
2. A durable governance decision authorizes an exact projection policy,
   source set, schema version, and validity interval.
3. The writer opens one repeatable-read transaction and resolves current
   project, monitoring, evidence, proof, TerraProof, risk, and funding source
   projections.
4. The deterministic builder calculates regional roots, source lineage roots,
   and `dashboardRoot`.
5. The writer replays all roots and safety constraints.
6. One immutable snapshot row is inserted with the service identity in
   `created_by`; database audit captures the insert.
7. An existing `dashboard_root` is treated as an idempotent replay only after
   byte-equivalent canonical content is verified.

No writer route or scheduler is mounted. The route-closed repository now uses
a serializable transaction, current source/actor re-resolution, independent
human governance, semantic audit, exact command receipts, and a deferred
database provenance constraint. Until durable source and spatial-review
resolvers are composed and activated, production may correctly return
unavailable. See `RFC_GLOBAL_COMMAND_CENTER_PUBLISHING_AUTHORITY.md`.

### 4.2 Read path

1. Cloudflare Access or another approved authenticator establishes the actor.
2. CanopyProof binds the principal to a current durable membership and role.
3. `GET /canopyproof/dashboard/global` selects the PostgreSQL repository only
   when the authorization binding source is PostgreSQL.
4. The repository reads the newest snapshot using `generated_at DESC, id DESC`
   in a repeatable-read transaction.
5. Every JSON column is parsed with the strict shared schema.
6. Regional roots, aggregate `regionRoot`, safety constants, and
   `dashboardRoot` are replayed.
7. The API returns an explicit `postgresql_append_only_snapshot` authority
   envelope with `Cache-Control: private, no-store`.
8. The client validates the full envelope before rendering any metric.

Development isolation may return a compatibility envelope so existing unit
fixtures remain useful. It is visually rejected as non-durable by the new
command-center client.

## 5. Threat Model

| Threat | Required control |
| --- | --- |
| Static metrics are mistaken for live impact | Remove fixed metrics and illustrative points from `/dashboard/global`; render only validated response data |
| Production silently uses seeded memory after database failure | Durable authorization binding selects PostgreSQL; missing repository data returns 503 with no fallback |
| A database operator edits one JSON field | Append-only triggers reject update/delete; read-time strict parsing and root replay reject inconsistent rows |
| A self-consistent forged snapshot replaces source authority | Writer remains governance-closed; future writer must resolve approved source authorities and persist their roots |
| Cross-tenant data leaks through a global view | Snapshot contains aggregate/public-safe fields only; no raw evidence, identities, coordinates, signatures, or private organization IDs |
| Unsafe impact language enters UI strings | Response fields are bounded; fixed safety constants are required; UI uses neutral operational labels and no certification language |
| Stale snapshot is presented as current | `generatedAt` is visible; future activation policy defines maximum age; no hidden fallback data |
| Client receives a schema-confused response | Strict Zod envelope and `.strict()` nested schemas; failure renders unavailable state |
| Dashboard route becomes a mutation channel | GET-only route, no writer API, same-origin credentials, and API proxy admin block remain intact |
| Snapshot author is forged | `created_by` remains a participant foreign key; future writer requires exact durable service membership and audit event |
| Large rows exhaust Worker runtime resources | Bounded arrays and string lengths in the shared schema; repository reads exactly one row |
| Snapshot implies regulatory or financial authority | Mandatory safety object and visible boundary copy reject credit, offset, asset, fund, token, and yield claims |

## 6. API Design

Route:

```text
GET /canopyproof/dashboard/global
```

Authentication: required.

Allowed roles: owner, admin, verifier, researcher, community, observer, and
agent, subject to the existing durable principal-binding policy. The endpoint
has no mutation authority.

Success envelope:

```json
{
  "ok": true,
  "apiVersion": "canopyproof.global-command-center.v2",
  "authority": "postgresql_append_only_snapshot",
  "data": {
    "service": "canopyproof-global-impact-command-center",
    "generatedAt": "2026-07-14T00:00:00.000Z",
    "metrics": {},
    "regions": [],
    "impactIndicators": {
      "biodiversity": [],
      "water": [],
      "climateRisk": []
    },
    "recentActivity": [],
    "lineage": {
      "dashboardRoot": "..."
    },
    "safety": {
      "readOnly": true,
      "humanReviewRequiredForFinalProof": true,
      "aiAdvisoryOnly": true,
      "noMainnetFunds": true,
      "noAutomaticCanopyDistribution": true,
      "notCertifiedCarbonCredit": true,
      "notCarbonTaxOffset": true,
      "notFinancialAsset": true,
      "notGuaranteedYield": true,
      "disclosure": "..."
    }
  }
}
```

Compatibility responses use `authority: "process_local_compatibility"`.
Production UI code must not render such a response as durable operational data.

Errors:

- `CANOPYPROOF_AUTH_REQUIRED` -> 401;
- `CANOPYPROOF_RBAC_DENIED` -> 403;
- `CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE` -> 503 when no durable
  snapshot exists;
- `CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID` -> 503 when schema or root
  verification fails;
- existing rate-limit errors -> 429.

Successful and failed responses use `Cache-Control: private, no-store` because
the route is authenticated and snapshot authorization may change.

## 7. Database Changes

The existing `impact.global_command_center_snapshots` table remains the storage
contract. It already contains:

- immutable ID and generation time;
- metric, regional, indicator, activity, lineage, and safety JSON documents;
- unique `dashboard_root`;
- `created_by` participant foreign key;
- fixed safety checks;
- update/delete denial triggers; and
- database audit capture.

This phase adds no destructive migration. Read code treats all existing rows as
untrusted input and validates the complete shape. Before writer activation, a
follow-up migration must add explicit projection schema/policy roots and any
required freshness policy only through additive nullable columns, backfill,
validation, and then `NOT NULL` enforcement.

The table is a global read model and must not receive organization RLS that
would produce a partial aggregate under one tenant context. Least privilege is
provided with a dedicated read-only projection role that can select only this
table. The general API role must not gain cross-tenant source-table access.

## 8. Migration Strategy

1. Ship the shared schema, verifier, repository, and tests with the writer and
   production activation closed.
2. Change the authenticated API route to select the repository only for a
   durable PostgreSQL binding; keep compatibility mode explicitly labeled.
3. Replace the static web page with a strict authenticated client projection.
4. Validate schema and root replay against PGlite and a fresh disposable native
   PostgreSQL cluster.
5. Define and review the dedicated projection identity, source resolvers,
   freshness SLO, privacy field allowlist, and governance activation record.
6. Backfill snapshots only from replayed durable source authorities. Never
   transform static module data into production snapshots.
7. Run shadow comparison between independently recomputed source projections
   and stored snapshot roots.
8. Activate the writer and then the read path through separate reviewed
   decisions. Web route availability does not authorize the writer.

## 9. Rollback Strategy

Rollback is non-destructive:

1. disable the projection writer identity and scheduler;
2. close the command-center read activation or remove repository selection;
3. return `CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE` from production;
4. preserve all snapshots and database audit events for investigation;
5. do not restore static metrics or process-local fallback in production;
6. invalidate any private response caches;
7. replay affected source roots and append a corrected snapshot only after
   incident review and governance approval.

Application rollback may deploy the previous binary, but it must not delete,
update, or reinterpret existing snapshot rows. Schema rollback is unnecessary
for this additive phase.

## 10. Verification Plan

Required unit tests:

- same inputs produce the same regional and dashboard roots;
- one changed metric, lineage root, region field, or safety flag is rejected;
- strict schemas reject additional fields and unbounded collections;
- API compatibility and durable authority metadata cannot be confused;
- client response parsing fails closed.

Required integration tests:

- append a valid fixture row and read it after repository reconstruction;
- newest valid row is selected deterministically;
- missing row returns the stable unavailable error;
- malformed JSON and mismatched roots return source-invalid;
- update and delete remain rejected;
- anonymous and unauthorized requests cannot read the route;
- PostgreSQL-bound requests do not call process-local services.

Required UI checks:

- stable loading geometry and no hydration mismatch;
- explicit unavailable and empty states;
- no static metric or illustrative map fallback;
- keyboard and screen-reader readable regions, activities, roots, and safety
  boundary;
- no horizontal overflow at 390px and 1440px;
- OpenNext Cloudflare build and local workerd smoke.

The 2026-07-14 local workerd gate returned `200` for `/dashboard/global`, `/`,
`/explorer`, a dynamic Explorer project path, every institutional page sampled,
and the required metadata assets. Next.js pages intentionally use OpenNext's
supported Cloudflare Node.js compatibility runtime. The unsupported split Edge
page configuration was removed after workerd reproduced a dynamic-require
failure. This runtime evidence does not activate the API route or projection
writer.

Production activation additionally requires freshness/error SLOs, projection
lag and root-failure alerts, incident and rollback drills, privacy and legal
review, and independent governance approval.

## 11. Public-Safe Earth Visualization Amendment

### 11.1 Decision

The command center may render a geographic marker only from a separately
reviewed regional spatial disclosure. It must never derive public or
observer-visible coordinates directly from project, evidence, device,
TerraProof-scene, or contributor records. A decorative or illustrative marker
is equally prohibited because it can be mistaken for an operational fact.

Every region therefore carries one root-bound `spatial` projection:

- `withheld`: no current approved disclosure exists; the response exposes only
  a fixed reason code, minimum cohort size, and deterministic `spatialRoot`;
- `generalized`: an approved disclosure supplies an integer-degree centroid,
  one-degree precision, cohort size, validity interval, independent privacy and
  safeguarding review roots, authority disclosure root, and deterministic
  public `spatialRoot`.

The minimum cohort size is three projects. A generalized disclosure must bind
the exact current region source root, have `sourceProjectCount` equal to the
current region project count, remain valid at the snapshot `generatedAt`, and
carry two distinct non-zero review roots. The projection builder rejects
duplicate, stale, future, under-cohort, wrong-region, wrong-source, or
self-inconsistent disclosures. It does not silently downgrade an invalid
disclosure to `withheld`; invalid governed input fails the snapshot build.

### 11.2 Deterministic contract

The authority input is canonicalized as:

```text
regionId
centroidLatitudeDegrees     integer [-90, 90]
centroidLongitudeDegrees    integer [-180, 179]
precisionDegrees            exactly 1
sourceProjectCount          integer >= 3
minimumCohortSize           exactly 3
regionSourceRoot            current regional source root
privacyReviewRoot           SHA-256
safeguardingReviewRoot       distinct SHA-256
validFrom / validUntil       canonical UTC interval
disclosureRoot              authority commitment over all fields above
```

`spatialRoot` commits the complete observer-visible projection. `regionRoot`
commits `spatial`, and `dashboardRoot` commits the aggregate region root. The
shared API version advances to `canopyproof.global-command-center.v2`; older
snapshot rows fail closed rather than being interpreted with the new meaning.

### 11.3 Renderer boundary

The Earth view is a client-only Three.js/React Three Fiber component loaded
with `next/dynamic` and `ssr: false`. Generalized regions are rendered through
one `THREE.InstancedMesh`; creating one mesh per region is forbidden. The
renderer is bounded to the schema maximum, uses no third-party tile or texture
request, exposes a textual equivalent through the existing regional table, and
maintains fixed layout geometry while WebGL compiles. If WebGL is unavailable
or every location is withheld, the command center remains usable and states
that no approved public geometry is available.

Marker color represents only current operational state already present in the
same root-bound region summary: critical/challenged, active risk, monitored, or
neutral. It does not represent certification, carbon value, ownership, title,
emergency declaration, or financial performance.

### 11.4 Threat controls

| Threat | Control |
| --- | --- |
| Exact project coordinates leak through the map | Spatial disclosure is a separate allowlisted object; raw coordinates are absent from the API schema and renderer props |
| A one-project region is re-identified through map geometry | Fixed cohort minimum of three; low-cohort regions expose no coordinates and remain `withheld` |
| Stale approval remains visible | `generatedAt` must fall inside the disclosure validity interval |
| Disclosure is replayed against another region snapshot | `regionSourceRoot`, region ID, current project count, and disclosure root are verified before projection |
| Privacy reviewer also supplies safeguarding approval | Review roots must be present and distinct; production authority later binds them to independent human decisions |
| Client fabricates a marker | Strict response parsing plus `spatialRoot`, `regionRoot`, and `dashboardRoot` replay precede rendering |
| Huge scene exhausts the browser | Schema remains capped at 512 regions and markers use one instanced draw call |
| WebGL failure hides institutional data | Fixed-size fallback and the accessible regional table remain authoritative |

### 11.5 Migration and activation

1. Ship the v2 schema, verifier, renderer, and deterministic tests while the
   writer remains closed.
2. Existing rows without `spatial` are rejected as source-invalid. Do not
   backfill them from raw coordinates.
3. The separate append-only spatial-disclosure authority now implements
   independent human privacy and safeguarding decisions, independent human
   publication, withdrawal, expiry, forced RLS, and database audit while its
   routes remain closed.
4. Permit the future source composition root to resolve only current approved disclosures from
   that authority in the same snapshot transaction.
5. Run join-risk, protected-species, community-safeguarding, accessibility,
   WebGL fallback, load, and abuse review before activation.

### 11.6 Rollback

Disable disclosure resolution and append a new snapshot whose regions are all
`withheld`. Preserve historical snapshots, disclosure decisions, and audit
events. Never edit or delete prior geometry, restore illustrative markers, or
fall back to raw project coordinates. A renderer rollback may remove the
canvas, but it must continue to enforce the v2 strict schema and fail-closed
source behavior.
