# RFC: Canonical ESG Reporting Authority

Status: ACCEPTED FOR ROUTE-CLOSED IMPLEMENTATION

Version: 0.1

Date: 2026-07-14

Owners: CanopyProof Trust Kernel, Environmental Proof, and Institutional Reporting

## 1. Decision Summary

CanopyProof will add one append-only ESG reporting authority that consumes only
current canonical Environmental Proof lifecycle projections. It will not make
the existing in-memory `CanopyProofService` report map, framework packages, or
PDF renderer production authority.

One report fact binds:

- a verified organization and an accredited human publisher;
- one project and one bounded reporting period;
- a deterministic set of current Environmental Proof records;
- each record's immutable record root and governed projection root;
- each record's active lifecycle binding, managed signature receipt, and
  reviewed MRV snapshot roots;
- normalized framework and material-topic inputs;
- a deterministic report artifact hash and report root; and
- one semantic audit event and exact command receipt.

Reports are immutable historical statements. A deterministic projection marks
them `current`, `stale`, `challenged`, `revoked`, or `expired` as source
authority changes. Projection never rewrites the report fact.

The first implementation remains route closed. It is not a formal assurance
opinion, certified carbon credit, carbon-tax offset, regulated filing,
financial asset, title, or guaranteed outcome.

## 2. Problem Statement

The current ESG implementation provides useful compatibility behavior:

- deterministic GRI, SDG, TNFD, biodiversity, and climate-impact sections;
- explicit claim boundaries;
- JSON and minimal PDF-shaped exports; and
- authenticated role checks on HTTP routes.

It is not institutional authority:

- reports live in a process-local `Map` and disappear on restart;
- exact retries and concurrent writers are not reconciled;
- caller-provided organization names are not resolved from organization
  authority;
- source records are checked only for an `issued` field in memory;
- governed challenge, lifecycle, signature, expiry, and MRV state are not
  re-resolved transactionally;
- the report audit event starts an isolated in-memory chain;
- SQL framework and investor package rows can reference a non-durable report
  ID; and
- there is no canonical current/stale report projection.

An institutional consumer therefore cannot prove which authority was current
when a report was created or whether it remains reliable now.

## 3. Goals

The authority must:

1. accept only a verified human publisher bound to the report organization;
2. require current `esg_reporting:publish` accreditation;
3. reject agents, AI, observers, community actors, and substituted identities;
4. re-resolve every Environmental Proof record inside the write transaction;
5. require the governed record projection to be `issued` with no unresolved
   challenge;
6. require an `active` lifecycle projection with a verified managed signature,
   current MRV snapshot, and current source authority;
7. require all records to belong to one organization and project;
8. canonicalize record IDs, frameworks, topics, and timestamps;
9. append one semantic event, report fact, complete member manifest, and exact
   command receipt atomically;
10. enforce serializable writes, bounded retry, forced RLS, append-only facts,
    and database mutation audit;
11. reproduce TypeScript and PostgreSQL roots exactly;
12. project later challenge, revocation, expiry, and source changes without
    mutating history; and
13. keep HTTP publication and production export routes closed until separate
    privacy, framework, legal, PDF, and operations gates pass.

## 4. Non-Goals

This RFC does not:

- assert conformance with GRI, TNFD, ISSB, TCFD, UNFCCC, or another framework;
- create an audit opinion, assurance engagement, regulatory filing, or
  institutional endorsement;
- issue or transfer carbon credits, offsets, tokens, securities, or funds;
- enable mainnet funds or automatic CANOPY distribution;
- store private keys, provider credentials, raw evidence, precise locations,
  or reviewer contact data;
- let AI publish, approve, sign, or make a report current;
- make the existing minimal PDF renderer production grade;
- migrate compatibility report objects automatically; or
- open a public route.

## 5. Canonical Authority Boundaries

### 5.1 Source record authority

`certificates.environmental_proof_record_facts` remains the sole issuance
truth. The reporting authority stores only an exact source binding. It does not
copy or reinterpret evidence, verification, methodology, or governance facts.

### 5.2 Current reliance

At report generation, every source must satisfy both:

- `certificates.environmental_proof_governed_record_projection(record_id)` is
  `issued`; and
- `certificates.environmental_proof_lifecycle_projection(binding_id,
  generated_at)` is `active`, signature verified, MRV current, and source
  authority current.

Missing lifecycle authority fails closed. A historical report cannot be
generated from a merely issued but unsigned or expired record.

### 5.3 Report artifact versus projection

The immutable report artifact records what was supportable at generation time.
The current projection re-resolves sources at an explicit `as_of` time:

- `current`: every exact source remains eligible and active;
- `challenged`: at least one governed source has an unresolved challenge;
- `revoked`: at least one governed source is revoked;
- `expired`: source lifecycle authority is expired and no stronger adverse
  state applies; or
- `stale`: another source root, lifecycle binding, MRV snapshot, signature, or
  authority mismatch exists.

These states are technical reliance labels, not certifications.

### 5.4 Compatibility services

Existing memory report and institutional package APIs remain compatibility
surfaces. They must not advertise durable or canonical status. A future route
migration must consume this authority and cannot dual-write silently.

## 6. Trust Model

### Trusted inputs

- canonical participant, organization, membership, and accreditation facts;
- canonical Environmental Proof records and governed projections;
- canonical lifecycle bindings, signature receipts, and projections;
- canonical MRV snapshots;
- semantic audit streams and database audit triggers; and
- an explicit server clock supplied to projection functions.

### Untrusted inputs

- organization names, source states, roots, framework labels, topics,
  timestamps, confidence, PDF bytes, and caller-generated report IDs;
- all HTTP identity headers until bound by the origin authentication layer; and
- every AI or satellite interpretation.

Shape validation is not authority validation. All roots and states are
re-resolved from durable sources.

### Separation of duties

- The publisher must be human, verified, active in the organization, and
  accredited for `esg_reporting:publish`.
- A publisher cannot replace the Environmental Proof issuer, challenge
  authority, MRV reviewer, or managed signature verifier.
- AI may draft narrative outside the authority boundary, but only canonical
  normalized text accepted by an accredited human can enter a report fact.
- Framework conformance and external assurance require independent future
  review and are not inferred from publication.

## 7. Data Flow

```text
Authenticated human publisher
           |
           v
Organization membership + accreditation
           |
           v
Canonical record IDs -----------------------------+
           |                                       |
           +--> governed record projections -------+
           |                                       |
           +--> lifecycle active projections -------+--> deterministic report fact
           |                                       |      + member manifest
           +--> MRV/signature roots ----------------+      + semantic event
                                                          + command receipt
                                                                  |
                                                                  v
                                                    current report projection
```

The write transaction:

1. sets actor and organization context;
2. takes command and project-report advisory locks;
3. reads any exact command receipt;
4. resolves publisher authority;
5. resolves and locks all source report, lifecycle, and MRV facts in sorted
   order;
6. derives the normalized report and member facts;
7. compares caller-independent deterministic roots;
8. appends the semantic event;
9. appends report and member facts;
10. appends the command receipt; and
11. commits atomically.

Retry opens a fresh serializable transaction and never changes input or source
selection.

## 8. Threat Model

| Threat | Required control |
| --- | --- |
| Caller submits an old or challenged record | Re-resolve governed projection inside the transaction and require `issued`. |
| Caller substitutes roots or source organization | Ignore supplied roots; derive exact source bindings and enforce one organization/project. |
| AI or agent self-publishes | Human participant, membership, role, and accreditation validation in TypeScript and SQL. |
| Same idempotency key carries different content | Exact request-hash comparison returns conflict. |
| Concurrent exact publication creates duplicates | Transaction advisory locks, unique facts, serializable retry, exact receipt replay. |
| Report remains presented after challenge or expiry | Current projection re-resolves every member and fails closed. |
| Report text introduces carbon/financial claims | Closed claim-boundary scanner and normalized bounded topic vocabulary. |
| Cross-tenant report enumeration | Forced RLS and explicit organization checks in repository and projection. |
| Fact or member mutation | Append-only triggers plus database audit stream. |
| Rollback erases institutional history | Rollback refuses when any reporting authority fact exists. |
| Export hash differs from durable report | Export derives only from stored fact; content hash is bound in report root. |

## 9. API Design

Initial route-closed repository contract:

- `getStatus()` reports storage, route, activation, RLS, append-only, and source
  re-resolution posture;
- `commitReport(command, idempotencyKey)` appends one exact authority fact;
- `getReport(organizationId, reportId)` returns the immutable authorized fact;
- `listReports(organizationId, projectId?)` is tenant scoped; and
- `projectReport(organizationId, reportId, asOf)` returns current reliance.

Future reviewed HTTP contract:

- `POST /canopyproof/reporting-authority/esg-reports`
- `GET /canopyproof/reporting-authority/esg-reports/:id`
- `GET /canopyproof/reporting-authority/esg-reports/:id/status?as_of=...`
- `GET /canopyproof/reporting-authority/projects/:projectId/esg-reports`

HTTP routes remain unmounted in this RFC implementation. Existing
`/canopyproof/reports/esg/*` routes are compatibility-only and must not be
relabeled as canonical.

## 10. Database Changes

Add a dedicated idempotent SQL contract:

### `reporting.esg_report_facts`

- immutable report identity, organization, project, period, publisher, and
  normalized framework/topic fields;
- complete report artifact JSON;
- artifact hash and report root;
- source count and source-set root;
- semantic event root; and
- unique canonical command hash.

### `reporting.esg_report_member_facts`

- immutable ordered membership in one report;
- record ID/root and governed projection root;
- lifecycle binding/root and active projection root at generation;
- signing key and signature receipt roots;
- MRV snapshot ID/root; and
- member hash/root.

### Existing shared tables

- `audit.domain_events` stores the report semantic event;
- `audit.command_receipts` stores exact idempotency replay; and
- `audit.event_log` captures database mutations.

Both reporting tables use forced RLS by `organization_id`, immutable triggers,
strict JSON key validation, canonical SQL hash functions, and foreign keys to
canonical source facts.

## 11. Migration Strategy

1. Apply the idempotent reporting SQL after the base CanopyProof, MRV, and
   lifecycle contracts.
2. Run it twice in PGlite to prove idempotency.
3. Keep all routes closed and write no production rows.
4. Execute unit, PGlite, and disposable native PostgreSQL conformance.
5. Compare TypeScript and SQL roots for report and every member.
6. Verify forced RLS, append-only behavior, exact retry, restart replay,
   cross-tenant denial, challenge downgrade, and expiry projection.
7. Add versioned deployment migration and least-privilege grants only after
   independent database/security review.
8. Do not migrate process-memory reports; they lack durable source authority.

## 12. Rollback Strategy

The rollback script may remove only an empty authority:

1. obtain an exclusive transaction lock;
2. fail if any report, member, report semantic event, report command receipt,
   or report database-audit row exists;
3. drop reporting-specific triggers, policies, functions, and tables; and
4. leave Environmental Proof, lifecycle, MRV, identity, and shared audit data
   untouched.

If facts exist, rollback is prohibited. Use forward repair, challenge,
supersession, or route disablement instead of deleting history.

## 13. Activation Gates

Production activation requires all of the following independently approved:

- real KMS/HSM and lifecycle operations;
- privacy and precise-location minimization review;
- external framework mapping and claims counsel review;
- institution-grade PDF/JSON renderer and accessibility verification;
- least-privilege database roles and migration/restore rehearsal;
- public projection and challenge disclosure policy;
- rate limits, SLOs, telemetry, incident response, and disaster recovery;
- independent security and institutional governance approval; and
- a guarded deployment decision separate from this implementation.
