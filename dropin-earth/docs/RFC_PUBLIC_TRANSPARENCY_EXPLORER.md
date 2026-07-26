# RFC: Canonical Public Transparency Explorer

Status: Accepted; route-closed implementation is locally validated; anonymous
activation not approved

Date: 2026-07-14

Owners: CanopyProof Trust Kernel, Public Transparency, Privacy, Security,
Accessibility, Platform Operations, and Governance

Decision class: Public read authority, privacy, abuse resistance, and
institutional reliance boundary

## 1. Problem Statement

CanopyProof needs a public project view that is useful to communities,
researchers, auditors, governments, and climate institutions without creating a
second source of truth or exposing protected locations and people. The current
landing-page Explorer is sample presentation data. The mounted
`/canopyproof/public-records*` API is an explicitly non-canonical, process-local
compatibility model. Neither may be represented as durable Environmental Proof.

The canonical Public Transparency Authority now records independently reviewed,
privacy-minimized publication facts and derives challenge-aware current
projections. Those facts remain protected by forced organization RLS. An
anonymous query cannot discover the private organization identifier by scanning
tenant tables, and the API must not receive a database role that can bypass all
tenant policies.

This RFC defines a dedicated read path that:

1. resolves a pseudonymous public project ID through an append-only internal
   locator catalog;
2. establishes the exact tenant context before touching private authority
   facts;
3. derives the current projection in one repeatable-read transaction;
4. verifies every root and the public-field allowlist before serialization;
5. exposes no mutation authority, raw evidence, identity, credential, or
   precise location;
6. makes challenge, suspension, revocation, expiry, supersession, and staleness
   visible; and
7. remains unavailable to anonymous production traffic until durable activation
   governance and operational controls are independently approved.

## 2. Scope And Non-Goals

In scope:

- canonical project detail by `publicProjectId`;
- bounded publication history and deterministic verification receipts;
- internal pseudonymous locator catalog;
- transaction-consistent current-source projection;
- strict response schemas and root verification;
- not-found equivalence, rate-limit policy, ETag and cache policy;
- a real `/explorer/project/:publicProjectId` web experience with loading,
  unavailable, active, challenged, suspended, revoked, expired, superseded, and
  stale states;
- removal of sample metrics and sample proof rows from the landing Explorer;
- default-closed route registration and a durable activation-authority port.

Not in scope:

- anonymous mutation, review, publication, challenge, or certificate issuance;
- exposing organization/project source IDs, people, evidence IDs, coordinates,
  geometry, boundary hashes, EXIF, device data, provider credentials, signatures,
  rationale, or internal limitations;
- map points for withheld or region-only records;
- inferring publication approval for legacy records;
- certified carbon-credit, tax-offset, financial-asset, ownership, title, or
  guaranteed-yield claims;
- mainnet funds or automatic CANOPY distribution;
- enabling the route from an environment flag or deployment alone.

## 3. Trust Model

```text
Canonical Environmental Proof / MRV / Lifecycle / Challenge Authority
                              |
                              v
Independent Privacy Review -> Accredited Publication Fact
                              |
                              v
Append-only Internal Locator (public ID -> private tenant + publication)
                              |
                              v
Repeatable-read Current Projection + Root Verification + Field Allowlist
                              |
                              v
Governed Activation Decision + Public Rate/Cache/Abuse Controls
                              |
                              v
Canonical Explorer API -> Edge UI
```

The locator is not public data. It is an internal least-privilege index used
only to establish tenant context. It contains no raw evidence and cannot create
a publication. Every row must correspond exactly to an existing immutable
publication fact and is inserted automatically in the publication transaction.

The projection is authoritative only for its `evaluatedAt` timestamp. It is not
a certification, regulatory opinion, financial instrument, carbon credit, or
tax determination.

## 4. Data Flow

1. An accredited human publishes a canonical transparency fact.
2. A database trigger appends one exact locator row in the same transaction.
3. A reader submits one bounded pseudonymous `publicProjectId`.
4. The query repository reads only the latest locator row for that public ID.
5. The repository sets `app.organization_id` inside one repeatable-read
   transaction.
6. It reloads the immutable publication and current Environmental Proof,
   challenge, lifecycle, MRV, and signature authorities.
7. The canonical transparency service derives a current projection.
8. The query adapter verifies the projection root and rejects any forbidden key
   recursively before returning data.
9. The HTTP adapter applies deterministic ETag, cache, content-type, referrer,
   framing, and permissions headers.
10. The Edge UI verifies response shape and renders current state, provenance
    roots, counts, validity, limitations, and mandatory claim boundaries.

No database transaction spans a network call. No external provider is queried
on the public read path.

## 5. Threat Model

| Threat | Required control |
| --- | --- |
| Public ID enumeration reveals tenants | Locator is internal; API returns equivalent 404 for absent, unpublished, and unauthorized records |
| Forced RLS is bypassed for convenience | No `BYPASSRLS` application role; locator resolves one tenant, then transaction-local tenant context is set |
| Stale publication hides a challenge | Current challenge and lifecycle projections are re-resolved in the same repeatable-read transaction |
| Cache serves active state after challenge | Active responses have a short shared TTL; non-active responses are `no-store`; ETag binds the projection root |
| Conditional request suppresses a changed state | 304 is allowed only when the client ETag equals the newly derived current projection root |
| Response leaks private fields | Strict schema plus recursive forbidden-key and unsafe-text rejection immediately before serialization |
| Compatibility data is mixed with canonical data | Canonical route imports only the durable query adapter; compatibility services are prohibited dependencies |
| Environment flag opens production route | Registration and activation are separate; activation requires a verified, unexpired durable governance decision |
| Approval expires while route stays open | Activation is checked on every request and fail-closes when absent, expired, superseded, or challenged |
| Scraping or denial of service | Dedicated public-read rate tier, bounded identifiers/history limits, no unbounded list endpoint, metrics and abuse events |
| Root is forged in transit or storage | Publication and projection roots are recomputed; SQL constraints and replay reject mutation |
| Explorer implies certification | Mandatory safety object and visible claim-boundary language are always rendered |
| UI hydrates different data than the server | Client-only fetch with schema validation and stable skeleton dimensions; no fabricated fallback metrics |

## 6. API Design

Target routes:

```text
GET /canopyproof/explorer/projects/:publicProjectId
GET /canopyproof/explorer/projects/:publicProjectId/history?limit=20&cursor=...
GET /canopyproof/explorer/publications/:publicationId/verify
```

No anonymous collection/list-all route is allowed. Identifiers are strict and
bounded. History defaults to 20 and cannot exceed 50.

Project detail response:

```json
{
  "apiVersion": "canopyproof.public-explorer.v1",
  "evaluatedAt": "2026-07-14T00:00:00.000Z",
  "project": {
    "publicOrganizationId": "cp_public_org_...",
    "publicProjectId": "cp_public_project_...",
    "publicationId": "cp_public_transparency_...",
    "state": "active",
    "recordIssuedOn": "2026-07-12",
    "observationPeriod": { "startsOn": "2026-01-01", "endsOn": "2026-06-30" },
    "validity": { "validFrom": "...", "expiresAt": "..." },
    "methodology": { "id": "...", "methodologyHash": "...", "publicationRoot": "..." },
    "location": { "disclosure": "region", "sourceRegionIdHash": "...", "regionId": "..." },
    "areaBand": "100_to_1000_ha",
    "evidence": { "count": 10, "root": "..." },
    "verification": { "count": 10, "root": "..." },
    "monitoring": { "count": 3, "root": "..." },
    "governance": { "approvalCount": 2, "quorumRoot": "..." },
    "confidenceBand": "high",
    "challenge": {},
    "issueCodes": [],
    "limitationCount": 1,
    "limitationRoot": "..."
  },
  "lineage": {
    "recordRoot": "...",
    "publicationRoot": "...",
    "currentGovernedRecordProjectionRoot": "...",
    "currentLifecycleProjectionRoot": "...",
    "projectionRoot": "..."
  },
  "safety": {
    "canonical": true,
    "durable": true,
    "anonymousMutationAllowed": false,
    "notCertifiedCarbonCredit": true,
    "notCarbonTaxOffset": true,
    "notFinancialAsset": true,
    "notGuaranteedYield": true,
    "noMainnetFunds": true,
    "notAutomaticCanopyDistribution": true
  }
}
```

The response excludes internal `organizationId`, `projectId`, reviewer,
publisher, issuer, actor authority, command roots, event rationale, and
signature receipt identifiers. It may expose only the public commitments listed
above.

Errors use stable codes and equivalent response shapes:

- `CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND` -> 404;
- `CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED` -> 503;
- `CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID` -> 503;
- `CANOPYPROOF_PUBLIC_EXPLORER_RATE_LIMITED` -> 429.

## 7. Database Changes

Add `transparency.public_transparency_query_catalog`:

- `publication_id` primary key and foreign key to the publication fact;
- `id` as an exact immutable alias required by the shared database audit
  trigger contract;
- `public_project_id`, `public_organization_id`, `publication_root`;
- private `organization_id` locator used only for tenant context;
- `published_at` and the publication audit event root;
- exact-row validation against the immutable publication fact;
- append-only update/delete rejection and database mutation audit;
- indexes on `(public_project_id, published_at DESC, publication_id)` and
  `(publication_id)`.

The catalog has no anonymous grants and no tenant-bypass policy. Direct inserts
cannot invent data because every field must exactly match an existing
publication fact. An `AFTER INSERT` publication trigger creates the locator in
the same transaction. Migration backfill indexes only already-valid canonical
publication facts; it never creates a privacy review or publication decision.

Production roles remain a separate reviewed migration:

- mutation role: no direct catalog write;
- query role: `SELECT` on the locator only plus tenant-scoped reads after context;
- anonymous HTTP caller: no database credential;
- no application role receives `BYPASSRLS`.

## 8. Activation Governance

Route code and public activation are separate facts. The application must use a
`PublicExplorerActivationVerifier` port. Its default implementation always
returns inactive. A production verifier must read a durable, append-only,
unexpired governance decision binding:

- exact route set and API version;
- privacy-impact review root;
- community-safeguarding review root;
- legal/public-claims review root;
- security review root;
- accessibility review root;
- rate/cache/abuse policy root;
- incident, rollback, and data-breach runbook roots;
- independent approvers and conflict disclosures;
- activation start and expiry; and
- supersession/challenge state.

Environment flags, deployment status, a release tag, or an unverified hash are
insufficient. Until the durable activation authority exists, route registration
must remain false in production.

## 9. Migration Strategy

1. Approve this RFC and freeze the v1 public response allowlist.
2. Add schemas and pure projection serializer tests.
3. Add the catalog migration, idempotency, exact-row, append-only, audit, and
   rollback tests.
4. Add the transaction-scoped query repository and current-source resolver.
5. Execute PGlite and dual-connection native PostgreSQL tests.
6. Add a route factory with default-deny activation verifier; do not register it
   in the production app.
7. Replace landing-page sample Explorer metrics with a link to the real
   unavailable/active Explorer shell.
8. Complete privacy, safeguarding, legal, security, accessibility, and
   operations review.
9. Implement and verify the durable activation authority.
10. Register each route independently, canary it, test challenge-cache latency,
    and preserve smoke/rollback evidence.
11. Deprecate compatibility reads only after consumer migration and parity
    evidence.

## 10. Rollback Strategy

Before locator rows exist, rollback may remove the catalog, trigger, indexes,
and functions.

After a locator exists, destructive rollback must fail. Route registration can
be disabled immediately without deleting facts. Data remediation uses forward
migrations and governed supersession. Public publication, challenge, and
revocation history is never deleted to simplify rollback.

The UI must degrade to a truthful unavailable state; it must never fall back to
sample or compatibility records.

## 11. Required Verification

Unit tests:

- strict public schema accepts every canonical state;
- same projection produces the same response and ETag;
- forbidden keys/text at any depth are rejected;
- no internal IDs, actors, credentials, signatures, coordinates, or raw
  evidence survive serialization;
- active, challenged, suspended, revoked, expired, superseded, and stale states
  render without implying certification;
- default activation verifier denies access.

PGlite and native PostgreSQL tests:

- migration is idempotent;
- publication and locator commit atomically;
- catalog rows exactly match canonical publications;
- fabricated insert, update, and delete fail;
- private tenant lookup cannot be returned by the serializer;
- one resolved tenant context cannot read another tenant;
- current challenge/lifecycle state is re-resolved in one transaction;
- restart replay yields the same response and root;
- non-empty rollback fails closed.

HTTP/UI tests:

- absent and unpublished IDs are indistinguishable;
- disabled route never reaches the repository;
- ETag 304 occurs only for the current projection root;
- active cache TTL is bounded and adverse states use `no-store`;
- rate-limit headers and abuse telemetry are present;
- loading state has stable dimensions and no hydration mismatch;
- keyboard, screen-reader, contrast, reduced-motion, and narrow viewport checks
  pass;
- no sample metric or sample proof row appears in the operational Explorer.

## 12. Acceptance And Remaining Gates

Route-closed implementation is accepted when schema, repository, serializer,
PGlite/native tests, and the unavailable/active UI shell pass local CI and
OpenNext.

Anonymous production activation remains prohibited until the durable activation
authority, independent reviews, least-privilege production roles, backup and
restore rehearsal, incident response, load/abuse tests, accessibility review,
and guarded deployment evidence all pass. Engineering completion is not
institutional accreditation.

## 13. Implementation Evidence

The route-closed implementation currently includes:

- frozen public response schemas in
  `packages/schemas/src/canopyproof-public-explorer.schema.ts`;
- strict projection serialization and recursive disclosure checks in
  `services/api/src/domain/canopyproof/public-explorer.ts`;
- an append-only catalog migration and fail-closed rollback in
  `services/api/prisma/public-transparency-explorer.sql` and its rollback file;
- a repeatable-read, one-tenant PostgreSQL query repository in
  `services/api/src/domain/canopyproof/public-explorer-postgres.ts`;
- a default-deny route factory in
  `services/api/src/routes/canopyproof/public-explorer.ts`, intentionally not
  registered in the production application;
- client-only `/explorer` and `/explorer/project/:publicProjectId` views that
  validate the shared schema and provide no fabricated fallback; and
- unit and PGlite coverage for serialization, activation denial, caching,
  rate denial, route closure, locator integrity, challenge re-projection, and
  rollback.

On 2026-07-14, the complete native authority scenario passed against a fresh,
disposable local PostgreSQL 17.10 cluster with two independent Prisma
connections. It covered locator creation and database-audit capture, explicit
non-bypass tenant denial, current challenge re-projection, restart replay, and
the surrounding trust/MRV/lifecycle/ESG authority flow. The cluster was stopped
and removed after the run. This is local engineering evidence, not clean CI or
production database evidence.

The OpenNext build generated separate Explorer edge bundles. A Next production
server returned 200 for `/`, `/explorer`,
`/explorer/project/cp_public_project_000000000000000000000000`, `robots.txt`,
`sitemap.xml`, and `icon.jpg`. The project view hydrated to the intended
fail-closed `CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID` state, and a 390-pixel
viewport had no horizontal document overflow. Anonymous route registration,
load/abuse evidence, accessibility review, and production activation remain
open gates.
