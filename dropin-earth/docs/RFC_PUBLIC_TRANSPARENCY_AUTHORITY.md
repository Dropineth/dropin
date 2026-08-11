# RFC: Canonical Public Transparency Authority

Status: Accepted and implemented route-closed; public activation not approved

Date: 2026-07-14

Owners: CanopyProof Trust Kernel, Environmental Proof, Privacy, and Governance

Decision class: Security, privacy, public accountability, and institutional
reliance boundary

## 1. Problem Statement

CanopyProof must let the public inspect environmental accountability records
without exposing field workers, communities, protected habitats, precise
locations, personal identifiers, internal review material, or private evidence.
The current `/canopyproof/public-records` compatibility route is derived from
process-local proof state. It rounds source coordinates to three decimal places
and labels the result as a regional centroid. At many latitudes that remains
approximately a one-hundred-metre locator and is not a defensible privacy
transformation. The route also lacks a durable, independently reviewed
publication decision and does not re-resolve the canonical Environmental Proof
lifecycle authority.

The requested `/explorer/project/:id` experience therefore has no canonical
query source. Building the page before this authority would create a second,
presentation-owned truth system.

This RFC defines a route-closed append-only authority that:

1. publishes only current, managed-signature-verified Environmental Proof
   lifecycle records;
2. requires an independent human privacy review before publication;
3. stores no raw coordinates, evidence payloads, contributor IDs, reviewer
   rationale, credentials, or private contact data;
4. preserves challenge, suspension, revocation, expiry, and supersession state;
5. produces deterministic, independently replayable public roots; and
6. remains non-production and non-reliance-authorized until separate legal,
   safeguarding, privacy, security, and operations gates pass.

## 2. Scope And Non-Goals

In scope:

- immutable disclosure-review facts;
- immutable public-publication facts;
- deterministic current public projections;
- challenge and lifecycle status propagation;
- privacy-minimized project, evidence, methodology, monitoring, governance,
  signature, and limitation commitments;
- exact retry, tenant isolation, semantic audit, database audit, and rollback;
- a future query contract for `/explorer/project/:publicProjectId`.

Not in scope:

- opening a public or institutional HTTP route;
- a new Explorer UI;
- exposing raw evidence, media, coordinates, boundaries, names, or identities;
- certifying carbon credits, tax offsets, title, ownership, financial assets, or
  guaranteed returns;
- moving mainnet funds or distributing CANOPY;
- allowing AI or an agent to review or publish disclosure;
- replacing the canonical Environmental Proof, MRV, lifecycle, challenge, or
  audit authorities.

## 3. Authority Model

```text
Canonical Environmental Proof Record
        +
Current challenge-aware record projection
        +
Reviewed MRV snapshot
        +
Active lifecycle binding
        +
Verified managed-signature receipt
        |
        v
Independent Human Privacy Review
        |
        v
Accredited Human Publication
        |
        v
Immutable Public Transparency Fact
        |
        v
Current Public Projection
  active | challenged | suspended | revoked | expired | superseded | stale
```

The publication fact records what was approved for disclosure at a point in
time. The current projection never rewrites it. Later source changes produce a
different derived state and issue codes.

### 3.1 Separation Of Duties

The privacy reviewer:

- must be a verified human with an active organization membership;
- must hold approved `public_transparency:privacy_review` accreditation;
- must have role `verifier` or `researcher`; and
- cannot be the Environmental Proof issuer or publication actor.

The publisher:

- must be a verified human with an active organization membership;
- must hold approved `public_transparency:publish` accreditation;
- must have role `owner` or `admin`; and
- cannot be the privacy reviewer, evidence contributor, or record issuer.

AI and Agent identities may identify candidate redactions but have no review,
publication, or reliance authority.

## 4. Public Data Contract

The immutable publication may contain only:

- a pseudonymous `publicProjectId` derived from organization ID, project ID, and
  immutable project root;
- Environmental Proof record ID/root and issuance day;
- lifecycle binding/projection and managed-signature receipt roots;
- assertion type and observation-period day boundaries;
- methodology ID/hash/publication root;
- evidence count and evidence root, never evidence IDs or payloads;
- final-decision count and aggregate verification root, never reviewer IDs;
- monitoring count and monitoring root;
- governance approval count and quorum root, never rationale or actor IDs;
- a confidence band (`limited`, `moderate`, or `high`), never a presentation
  claim of certainty;
- an area band (`withheld`, `under_10_ha`, `10_to_100_ha`,
  `100_to_1000_ha`, or `over_1000_ha`);
- an independently approved location disclosure of either `withheld` or one
  canonical source `regionId`; and
- hashes of normalized public limitations and mandatory claim boundaries.

No latitude, longitude, geometry, boundary hash, EXIF, GPS hash, media hash,
device identifier, contributor identity, reviewer identity, signature bytes,
provider identifier, private organization metadata, or free-form internal
rationale is permitted.

### 4.1 Privacy Classification

Each review assigns one immutable classification:

- `public`: the canonical source region ID may be disclosed;
- `sensitive`: location is always `withheld`; or
- `restricted`: location and area are both `withheld`.

The publication command cannot relax the review. A later less restrictive
decision requires a new review and a new publication fact; history remains.

## 5. Deterministic Roots

All arrays are normalized, sorted, and unique before hashing. All times are
canonical UTC instants; public day values are derived with `YYYY-MM-DD` UTC
semantics.

Required roots:

```text
reviewCommandHash = H(review input + source authority + reviewer authority)
reviewHash        = H(review fact without roots/audit)
reviewRoot        = H(review ID + reviewHash + source root + stream predecessor)

publicationCommandHash = H(public fields + review root + publisher authority)
publicationHash        = H(publication fact without roots/audit)
publicationRoot        = H(publication ID + publicationHash + source root
                           + stream predecessor)

projectionRoot = H(publication root + current lifecycle projection root
                   + current state + issue codes + evaluatedAt + safety)
```

Roots use canonical `hashJson`; set commitments use sorted `merkleRoot`. Empty
sets use domain-separated empty roots, never an ambiguous blank string.

## 6. State Projection

Publication requires lifecycle state `active`, current governed record state
`issued`, current reviewed MRV, a current managed signing key, a verified
detached-signature receipt, and current validity.

Projection state precedence is:

1. `superseded`;
2. `revoked`;
3. `challenged`;
4. `expired`;
5. `suspended`;
6. `stale` for source/projection/root mismatches; and
7. `active` only when every current source remains valid.

Challenges are never hidden. The public projection exposes only bounded state,
challenge root, resolution root when present, and deterministic issue codes.
Challenge descriptions, supporting artifacts, reviewers, and rationale remain
private.

## 7. Command And Query API

Initial implementation is an internal typed boundary only:

```text
CanopyProofPublicTransparencyAuthorityService.reviewDisclosure
CanopyProofPublicTransparencyAuthorityService.publish
CanopyProofPublicTransparencyAuthorityService.projectPublication
CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot
```

Target future HTTP reads, subject to a separate route-opening review:

```text
GET /canopyproof/explorer/projects/:publicProjectId
GET /canopyproof/explorer/projects/:publicProjectId/history
GET /canopyproof/explorer/publications/:publicationId/verify
```

No mutation route is planned for anonymous clients. Publication commands must
remain behind durable origin authentication, exact current authority,
idempotency, tenant binding, and database transactions.

## 8. Database Contract

Use a dedicated `transparency` schema:

### `transparency.public_disclosure_review_facts`

- immutable review identity and source scope;
- classification and allowed disclosure mode;
- source record/lifecycle/signature roots;
- normalized limitation hashes;
- reviewer authority snapshot/root;
- command, source, review, predecessor, and event roots.

### `transparency.public_transparency_publication_facts`

- immutable public-safe fields only;
- review ID/root;
- canonical record/lifecycle/signature commitments;
- pseudonymous public project ID;
- deterministic counts, bands, hashes, and claim boundaries;
- publisher authority snapshot/root;
- command, source, publication, predecessor, and event roots.

Every command transaction must:

1. set the exact organization transaction context;
2. acquire command and project-stream advisory locks in fixed order;
3. re-resolve current Environmental Proof, challenge, MRV, lifecycle,
   signature, identity, membership, and accreditation facts;
4. insert one immutable authority fact;
5. append one semantic `audit.domain_events` fact;
6. append database mutation audit state; and
7. insert an exact `audit.command_receipts` fact.

All authority tables use forced organization RLS and update/delete rejection
triggers. The future anonymous public query must read a separately reviewed
sanitized view or dedicated read model; it must never receive table access or
tenant-bypass credentials.

## 9. Threat Model

| Threat | Required control |
| --- | --- |
| Rounded coordinates re-identify a site | No coordinates or geometry in the canonical public contract |
| Caller substitutes a stale record | Re-resolve current record root and lifecycle projection inside the transaction |
| Challenge is hidden after publication | Derive current state at read time; challenge state has precedence over active |
| Agent self-publishes | Human participant type, role, membership, accreditation, and authority-root checks |
| Publisher approves own disclosure | Reviewer/publisher/issuer/contributor separation checks |
| Free text leaks personal or secret data | No free-form public narrative; normalized code lists and hashes only |
| Cross-tenant publication | Forced RLS plus organization/project/source equality checks |
| Tampered projection appears valid | Recompute publication and projection roots before every consumer use |
| Exact retry forks history | Command hash receipt and fixed advisory-lock order |
| Historical dispute disappears | Append-only facts; no update/delete; history query preserves every state |
| Compatibility route becomes parallel authority | Explicit `canonical: false`, immediate coordinate removal, and no adapter from compatibility state |
| Public root is mistaken for certification | Mandatory non-credit, non-tax, non-financial, non-yield, no-funds, no-token safety object |

## 10. Migration Strategy

1. Add this RFC and approve the public-field allowlist.
2. Remove coordinates from the existing compatibility route immediately; retain
   only source `regionId` and mark it `canonical: false`.
3. Add route-closed TypeScript authority and deterministic replay tests.
4. Add additive SQL migration, repository, PGlite parity, RLS, exact retry,
   append-only, rollback, and restart tests.
5. Run the revised path against disposable native PostgreSQL with two
   connections.
6. Conduct privacy, safeguarding, legal, accessibility, and threat-model review.
7. Build the Explorer against a dedicated sanitized query adapter.
8. Open each public read route independently after production operations and
   abuse controls pass.
9. Deprecate the compatibility route only after parity and consumer migration
   evidence exists.

No backfill may infer privacy approval. Existing records remain unpublished
until an eligible human completes a new disclosure review.

## 11. Rollback Strategy

Before any authority fact exists, rollback may remove the route-closed schema,
functions, policies, and triggers.

After the first review or publication fact, destructive rollback must fail.
Production remediation uses forward migrations, governed supersession, or route
closure. Historical publications, challenges, and revocations are never
deleted to simplify rollback.

The compatibility coordinate-removal fix is not rolled back because restoring
precise public coordinates would reintroduce a known privacy defect.

## 12. Required Verification

Unit tests must prove:

- valid active signed authority can be reviewed and published;
- agents, self-review, weak roles, missing accreditation, and cross-tenant
  actors are rejected;
- sensitive and restricted reviews cannot disclose a region or exact area;
- no output contains coordinates, contributor IDs, reviewer IDs, rationale,
  evidence IDs, provider IDs, or signature bytes;
- same inputs produce identical review, publication, and projection roots;
- tampered publication, review, source root, safety object, or projection fails
  replay;
- challenge, suspension, revocation, expiry, supersession, and stale source
  authority propagate deterministically; and
- unsafe claims or secret material are rejected.

PGlite and native PostgreSQL tests must prove:

- migration idempotency;
- SQL/TypeScript hash parity;
- atomic semantic event and exact receipt binding;
- concurrent exact retry and conflicting retry rejection;
- forced RLS and cross-tenant denial;
- update/delete rejection;
- restart replay;
- current-source re-resolution; and
- empty-only rollback.

## 13. Implementation Evidence

The route-closed implementation now consists of:

- `CanopyProofPublicTransparencyAuthorityService` for deterministic review,
  publication, replay, and current challenge-aware projection;
- `PrismaCanopyProofPublicTransparencyRepository` for serializable writes,
  exact command receipts, transaction advisory locks, and transaction-scoped
  current-source re-resolution;
- `public-transparency-authority.sql` for independent SQL root parity, active
  canonical-source checks, actor separation, privacy minimization, forced RLS,
  append-only enforcement, and database mutation audit; and
- `public-transparency-authority.rollback.sql`, which succeeds only while the
  authority and its semantic events/receipts are empty.

Unit, PGlite, and disposable native PostgreSQL 17 verification cover
deterministic replay, privacy minimization, challenge/lifecycle propagation,
tamper rejection, dual-connection exact retry, failed-write atomicity,
SQL/TypeScript root parity, an explicit `NOBYPASSRLS` reader, update/delete
rejection, transaction-scoped current-source projection, and reconnect replay.
PGlite additionally covers both rollback outcomes. This is local engineering
evidence, not production database, operations, or public-reliance approval.

## 14. Activation Gates

`routeMounted` and `productionActivationEnabled` remain `false` until all of
these are independently evidenced:

- privacy impact and community-safeguarding approval;
- jurisdictional public-record and data-rights review;
- production PostgreSQL migration, roles, backup, restore, and failover tests;
- clean-CI reproduction of native concurrency and replay evidence;
- public query rate limits, abuse monitoring, caching, incident response, and
  accessibility review;
- deterministic UI verification against canonical roots; and
- governance approval with named owners and expiry dates.

Passing implementation tests is engineering evidence only. It is not
institutional accreditation, regulatory approval, certification, or permission
to make carbon, tax, financial, title, ownership, or yield claims.
