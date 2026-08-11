# CanopyProof Institutional Trust Layer

Status: Phase 3 implementation slice

CanopyProof institutional trust is the backend foundation for UN agencies,
governments, NGOs, auditors, research institutions, ESG investors, and corporate
sustainability teams. It is not a marketing layer. It is a governed registry,
evidence access model, reporting model, and audit model.

## Institution Registry

Supported organization classes:

- UN agency.
- Government.
- NGO.
- Research institution.
- Corporate.
- Community organization.
- Auditor.
- Investor.
- Restoration operator.
- Climate fund.

Canonical registry fields:

- organization ID.
- public name.
- legal name.
- organization type.
- jurisdiction.
- registration number.
- public contact.
- operating regions.
- verification capabilities.
- verification status.
- hash-bound documents.
- authorized users.
- trust level.
- accreditation status.
- data-sharing policy.
- audit history.

Verification states:

```text
pending -> document_review -> verified
verified -> suspended
verified -> revoked
suspended -> revoked
suspended -> verified (upheld appeal plus separate reinstatement)
pending/document_review -> revoked (governed invalid-registration action)
```

Rules:

- `document_review` requires at least one hash-bound document.
- `verified` requires a registration number and at least one hash-bound
  document.
- the accepted review stores only a deterministic registration-reference root;
  PostgreSQL recomputes it from the current registration number at review and
  verification-decision time.
- verification requires an independent accredited human reviewer and a
  different independent accredited human decider outside the subject
  organization.
- suspension and revocation preserve their source roots and can be appealed;
  the original governor cannot review the appeal.
- reinstatement after suspension requires an upheld appeal and a third human
  authority distinct from the submitter, governor, and appeal reviewer.
- `revoked` cannot be reactivated without a new institutional identity.
- canonical lifecycle, document review, appeal, and decision facts share one
  deterministic append-only organization audit sequence.

The canonical implementation is additive and route-closed. The mounted
verification endpoint below remains a compatibility API and is not an
institutional reliance surface until a separate guarded route migration.

Accreditation is also implemented as a separate route-closed authority. It
uses immutable application, external-human review, different-human decision,
and control facts. Approved decisions bind exact scope and policy roots and a
maximum 366-day interval; callers must project at an explicit `asOf`. Expiry,
suspension, denial, and terminal revocation cannot fall back to an older
approval. Renewal creates a fresh application, review, and decision.

PostgreSQL validates current identity/membership/organization state, actor
separation, bounded authority snapshots, roots, event lineage, RLS, and
append-only behavior. A production canonical-authority resolver and root
governance bootstrap have not been composed, and the existing mutable
`organizations.accreditations` table is not a canonical fallback.

## Partner Portal Backend

The current compatibility API exposes:

```text
POST /canopyproof/organizations
GET  /canopyproof/organizations
GET  /canopyproof/organizations/:id
POST /canopyproof/organizations/:id/verification
POST /canopyproof/organizations/:id/memberships
GET  /canopyproof/organizations/:id/memberships
PATCH /canopyproof/organizations/:id/memberships/:membershipId
POST /canopyproof/organizations/:id/accreditations
GET  /canopyproof/organizations/:id/accreditations
POST /canopyproof/organizations/:id/data-sharing-agreements
GET  /canopyproof/organizations/:id/data-sharing-agreements
GET  /canopyproof/partners
GET  /canopyproof/partners/:organizationId
```

Access rules:

- organization registration: owner/admin.
- verification transition: owner/admin/verifier.
- membership mutation: owner/admin.
- accreditation mutation: owner/admin.
- data-sharing mutation: owner/admin.
- reads: authorized institutional roles, including observer.

Persistence contract:

- `organizations.roles` and `organizations.permissions` define the canonical
  institutional RBAC catalog.
- `organizations.memberships` binds actor IDs to organization-scoped roles and
  conflict disclosures.
- `organizations.verification_documents` stores normalized hash-bound document
  references used in `document_review` and `verified` transitions.
- `organizations.accreditations` stores partner capability decisions and
  evidence hashes.
- `organizations.organization_lifecycle_facts`,
  `organization_document_review_facts`, `organization_appeal_facts`, and
  `organization_appeal_decision_facts` are the canonical immutable lifecycle
  and appeal authority. The mutable organization status is a compatibility
  projection only after the additive migration.
- `organization_accreditation_application_facts`,
  `organization_accreditation_review_facts`,
  `organization_accreditation_decision_facts`, and
  `organization_accreditation_control_facts` are the canonical accreditation
  history. They remain route-closed and do not update the compatibility row.
- `organizations.data_sharing_agreements` stores dataset scopes, privacy tier,
  permitted uses, expiry, and agreement hash.
- these tables are audit-triggered in PostgreSQL; documents, accreditations,
  data-sharing agreements, roles, and permissions are append-only.

## Durable Project Lifecycle Authority

In PostgreSQL mode, `/canopyproof/projects*` is backed by three immutable fact
families:

- project registration with exact organization, human creator role, canonical
  claim boundary, project root, and semantic event;
- predecessor-bound status transitions with finite-state validation and
  independent governance approval for activation/monitoring;
- monitoring assertions with prior same-project evidence/satellite references,
  observer role, previous/resulting status, and canonical monitoring root.

Every mutation requires a bounded `Idempotency-Key`, serializes on the project
event stream, and commits its fact, semantic event, command receipt, and database
audit event atomically. Reads reconstruct current state after restart. Production
does not substitute the compatibility memory registry for this authority.

The implemented v1 status vocabulary is intentionally narrower than the Phase 3
target. `active` is not `FUNDED`, and `monitored` is not `VERIFIED` or
`LONG_TERM_OBSERVATION`. Those target states require distinct durable funding,
MRV decision, and observation-window records.

## Durable Evidence Registration Authority

In PostgreSQL mode, evidence registration is an immutable fact rather than a
mutable proof-service snapshot. The record binds the exact current project root,
status, region, authority time, and owning organization; a verified human contributor and exact
active role; normalized observation commitments; deterministic structural
issues; a canonical evidence hash/root; and one contributor-authored semantic
event. A single-use media commitment and hashed command receipt make concurrent
and retried registration deterministic.

Initial `validated` means only that the submitted envelope passed bounded
structural checks. `challenged` retains weak-GPS or cross-region envelopes for
accountable review. Neither state is final verification, certification, a
certified carbon credit, tax offset, financial asset, guaranteed yield,
mainnet-fund movement, or automatic CANOPY distribution. AI and human review
must become separate append-only authorities before institutions rely on them.

## Reporting Compatibility

Institutional reports must not rely on unsupported claims. Every metric in a
UN, GRI, ISSB, TCFD, or investor package must carry:

- source record.
- methodology.
- confidence.
- verification reference.
- audit reference.
- limitations.

Environmental Proof Records are accountability records. They are not certified
carbon credits, carbon-tax offsets, financial assets, automatic CANOPY
distributions, or guaranteed-yield instruments.

The CanopyProof identity compatibility layer exposes
`/canopyproof/identity/*` for accountable human, organization, agent, and device
participants. Participant records carry owner identity, organization scope,
roles, verification status, credential commitments, reputation score, subject
hash, and append-only audit history. Reputation snapshots provide institutional
context for reviewer assignment and risk review, but they remain
non-authoritative and never replace governance approval or human review.

The CanopyProof memory compatibility layer exposes `/canopyproof/memory/*` as
an institutional recall surface over source IDs, payload hashes, retention
classes, scopes, tags, and audit roots. Memory records are append-only read
models. They help auditors and agents recover context, but they never issue
proof, certify evidence, move funds, or override governance decisions.

Canopy AI observations are advisory institutional risk signals. The current
proof engine accepts satellite, ecological, and survival-estimation envelopes;
ecological contradiction lowers confidence and opens review context, while
survival contradiction or survival below the institutional threshold becomes a
critical finding. Critical AI findings cannot issue, certify, or revoke proof
by themselves, and proof issuance remains blocked until an accountable human
reviewer explicitly resolves them.

Institutional consumers verify issued records through the deterministic
CanopyProof Certificate Artifact exposed at
`GET /canopyproof/proof-records/:recordId/certificate`. The artifact packages
the source record hash, evidence root, verification history, monitoring
timeline, contributors, governance approval summaries, challenge summaries, and
mandatory claim boundary without creating a new financial or carbon-credit
claim. Governance summaries carry policy ID, reviewer, reviewer role, decision,
conflict disclosure, approval hash, and audit event root so institutional
reviewers can inspect authority and conflicts from the artifact itself.

Certificate artifacts can be published into the certificate transparency ledger
with `POST /canopyproof/proof-records/:recordId/certificate/transparency`.
Institutions can then inspect
`GET /canopyproof/certificates/transparency/entries` and replay submitted
artifacts through `POST /canopyproof/certificates/transparency/verify`.
Verification recomputes certificate and entry hashes and emits
`certificate_verification` audit events; failures remain tamper evidence rather
than being hidden or rewritten.

Implemented compatibility API:

```text
GET  /canopyproof/reports/institutional/status
POST /canopyproof/reports/framework-packages
GET  /canopyproof/reports/framework-packages
GET  /canopyproof/reports/framework-packages/:id
GET  /canopyproof/reports/framework-packages/:id/export.json
GET  /canopyproof/reports/framework-packages/:id/export.pdf
POST /canopyproof/reports/investor-review-packages
GET  /canopyproof/reports/investor-review-packages
GET  /canopyproof/reports/investor-review-packages/:id
GET  /canopyproof/reports/investor-review-packages/:id/export.json
GET  /canopyproof/reports/investor-review-packages/:id/export.pdf
```

Framework package adapters:

- UN SDG.
- UNFCCC.
- GRI.
- ISSB.
- TCFD.

Rules:

- packages require a verified organization.
- packages can only use issued Environmental Proof Records.
- framework packages produce a deterministic `packageRoot`, JSON export, PDF
  export, and `institutional_report_package` audit event.
- investor review packages include organization profile, project portfolio,
  evidence coverage, verification statistics, risk profile, audit roots, ESG
  report references, JSON export, PDF export, and `investor_review_package`
  audit event.
- observers can read and export packages but cannot create them.

## MRV Graph

The institutional MRV graph links:

```text
Organization
  -> Project
  -> Evidence
  -> Verification Work
  -> Human Review
  -> Governance Approval
  -> Environmental Proof Record
  -> Report Package
```

All graph edges must be reproducible from immutable IDs and audit roots. A
route-closed first slice now persists a strict endpoint/relationship subset as
immutable PostgreSQL edge and reviewed-snapshot facts. It remains lineage-only:
the `/mrv` API, challenge/current-reliance projection, reporting edges, native
concurrency evidence, and public projection are not implemented. Process-memory
evidence, certificate, or report objects must never be wrapped as institutional
authority. The normative boundary is documented in `docs/MRV_STANDARD.md` and
`docs/RFC_DIGITAL_MRV_GRAPH_AUTHORITY.md`.

## Security Expectations

Tests must cover:

- fake organization onboarding.
- unauthorized verification transitions.
- missing registration documents.
- certificate/report manipulation.
- evidence deletion or tampering.
- audit tampering.
- unsafe public claims.

Production implementation still requires external evidence media/custody
providers, certificate, reporting and funding adapters, plus native and
route-open MRV gates; organization-scoped
access policies; document storage governance; data-room exports; and cross-
organization evidence-sharing approvals.
