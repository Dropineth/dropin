# CanopyProof UN / NGO / Institutional Partner Layer

Status: Phase 1 design baseline

Route: `/partners`

Implemented API slice: `/canopyproof/organizations/*` and
`/canopyproof/partners/*`

Purpose: support trusted collaboration between CanopyProof, UN agencies, NGOs,
universities, governments, restoration organizations, climate funds, and impact
investors.

## Organization Profiles

Supported organization classes:

- UN agency.
- NGO.
- University.
- Government.
- Investor.
- Restoration organization.
- Research lab.
- Community organization.

Profile fields:

- legal name.
- public name.
- jurisdiction.
- organization type.
- website.
- public contact.
- accreditation status.
- data-sharing policy.
- verification capabilities.
- regions of operation.

## Permissions

Roles:

- Owner.
- Admin.
- Verifier.
- Researcher.
- Community.
- Observer.

Required controls:

- organization-scoped membership.
- role assignment audit events.
- least privilege defaults.
- explicit dataset access grants.
- revocation without history deletion.

## Partner Workflows

### Onboarding

```text
Application
→ due diligence
→ data-sharing agreement
→ accreditation decision
→ role assignment
→ audit event
```

### Evidence Collaboration

Partners may submit, review, or challenge evidence only according to role,
region, and policy scope.

### Research Access

Researchers receive privacy-filtered, license-compatible datasets with lineage
and export logging.

### Government / UN Access

Government and UN profiles emphasize observability, public accountability,
emergency risk signals, and non-financial environmental records.

## Trust And Suspension

Partner trust state:

- applicant.
- active.
- limited.
- suspended.
- revoked.

Suspension must preserve historical records and publish a bounded rationale when
public accountability requires it.

## Implemented Slice

The current implementation lives in:

- `services/api/src/domain/canopyproof/partner-collaboration.ts`
- `services/api/src/app.ts`

Implemented endpoints:

```text
GET  /canopyproof/partners/status
POST /canopyproof/organizations
GET  /canopyproof/organizations
GET  /canopyproof/organizations/:id
GET  /canopyproof/partners
GET  /canopyproof/partners/:organizationId
POST /canopyproof/organizations/:id/memberships
GET  /canopyproof/organizations/:id/memberships
PATCH /canopyproof/organizations/:id/memberships/:membershipId
POST /canopyproof/organizations/:id/accreditations
GET  /canopyproof/organizations/:id/accreditations
POST /canopyproof/organizations/:id/data-sharing-agreements
GET  /canopyproof/organizations/:id/data-sharing-agreements
POST /canopyproof/data-sharing-agreements/:agreementId/revocations
GET  /canopyproof/data-sharing-agreements/:agreementId/revocations
GET  /canopyproof/data-sharing-agreement-revocations/:revocationId
POST /canopyproof/data-sharing-agreements/:agreementId/supersessions
GET  /canopyproof/data-sharing-agreements/:agreementId/supersessions
GET  /canopyproof/data-sharing-agreement-supersessions/:supersessionId
POST /canopyproof/organizations/:id/data-access-requests
GET  /canopyproof/organizations/:id/data-access-requests
GET  /canopyproof/data-access-requests/:requestId
PATCH /canopyproof/data-access-requests/:requestId
POST /canopyproof/data-access-requests/:requestId/deliveries
GET  /canopyproof/data-access-requests/:requestId/deliveries
GET  /canopyproof/data-access-deliveries/:deliveryId
POST /canopyproof/data-access-deliveries/:deliveryId/use-attestations
GET  /canopyproof/data-access-deliveries/:deliveryId/use-attestations
GET  /canopyproof/data-use-attestations/:attestationId
POST /canopyproof/data-use-attestations/:attestationId/enforcement-cases
GET  /canopyproof/data-use-attestations/:attestationId/enforcement-cases
GET  /canopyproof/data-use-enforcement-cases/:caseId
POST /canopyproof/data-use-enforcement-cases/:caseId/access-restrictions
GET  /canopyproof/data-access-requests/:requestId/restrictions
GET  /canopyproof/data-access-restrictions/:restrictionId
POST /canopyproof/data-access-requests/:requestId/accountability-packets
GET  /canopyproof/data-access-requests/:requestId/accountability-packets
GET  /canopyproof/data-access-accountability-packets/:packetId
POST /canopyproof/data-access-accountability-packets/:packetId/verify
GET  /canopyproof/data-access-accountability-packets/:packetId/verifications
GET  /canopyproof/data-access-accountability-verifications/:verificationId
POST /canopyproof/data-access-accountability-packets/:packetId/disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/status
GET  /canopyproof/public-accountability/data-access-disclosures
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId
POST /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/challenges
GET  /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId
POST /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
GET  /canopyproof/public-accountability/data-access-disclosure-challenges/:challengeId/resolutions
GET  /canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId
POST /canopyproof/public-accountability/data-access-disclosure-resolutions/:resolutionId/notices
GET  /canopyproof/public-accountability/data-access-disclosures/:disclosureId/notices
GET  /canopyproof/public-accountability/data-access-disclosure-notices/:noticeId
```

Current behavior:

- organization profile registration is `owner`/`admin` only.
- partner and organization reads are available to `owner`, `admin`, `verifier`,
  `researcher`, `community`, and `observer`.
- membership grants and status updates are `owner`/`admin` only.
- accreditation decisions are `owner`/`admin` only and update partner status.
- data-sharing agreements record dataset scope, privacy tier, permitted uses,
  expiration, deterministic agreement hash, and audit event.
- data-sharing agreement revocations are a separate owner/admin governance path
  for closing an institutional agreement. Revocation requires evidence event
  roots, records a `data_sharing_agreement_revocation` audit event, preserves
  prior agreement/request/delivery history, and blocks new requests plus future
  delivery receipts under the revoked agreement.
- data-sharing agreement renewals and supersessions create a new immutable
  agreement and a separate owner/admin-approved lineage record. Renewal can
  extend expiry only when scope, permitted uses, and privacy tier are unchanged;
  all other replacements must reduce authority. Once recorded, the predecessor
  cannot authorize new requests or future delivery receipts.
- data-access requests let verified organizations request bounded access under
  an active data-sharing agreement. Requested dataset scopes and permitted uses
  must be agreement subsets, confidential requests require institutional trust,
  and approval requires an independent human reviewer. Requests carry only
  hashes, status, purpose, safety flags, and decision metadata; they are not
  raw-data exports and never create proof, certificate, credit, tax-offset,
  fund, or yield authority.
- data-access delivery receipts bind an approved request to an audit export
  manifest selected server-side. Receipts expose manifest hash, entry root,
  classification, channel, recipient actor ID, and delivery root while
  preserving the same no-raw-data and no-financial/no-carbon claim boundary.
- data-use attestations let recipients and reviewers record within-scope use,
  no-use, misuse challenge, or revocation-request states after delivery. Normal
  use requires output hashes; challenged use requires evidence event roots.
  These are accountability records, not final enforcement decisions.
- data-use enforcement cases provide the independent human-review response path
  for misuse challenges and revocation requests. Cases can notify partners,
  require remediation, suspend access, request revocation, or place material on
  legal hold as append-only governance records. The records preserve history and
  any concrete access mutation still requires a separate approval pathway.
- data-access restrictions are that separate approval pathway. Owner/admin
  approvers can bind an enforcement case to a remediation hold, suspension,
  revocation, or restoration record. Active restrictions block future delivery
  receipts for the request without deleting prior deliveries, attestations, or
  enforcement history.
- accountability packets package the full governed data-access lineage for
  institutional review. They expose counts and hash roots across request,
  agreement-revocation, delivery, attestation, enforcement, and restriction
  records so UN, NGO, university, government, and audit users can verify the
  chain, including agreement revocation and supersession roots, without
  receiving raw evidence or private contact material.
- packet verification lets institutional readers replay whether a packet still
  matches the current append-only ledger. If later attestations, enforcement
  cases, restrictions, agreement revocations, or agreement supersessions were appended, the old packet
  remains preserved but the replay result reports stale lineage instead of
  silently rewriting history.
- public accountability disclosures let UN, government, NGO, university, and
  audit systems discover selected packet and verification roots without
  authentication or access to the underlying governed data. Publication is
  owner/admin only, requires a current valid replay, and enforces distinct
  generator, verifier, and publisher actors. The public index is hash-only,
  bounded to 100 rows per page, and exposes stale lineage instead of silently
  presenting an obsolete packet as current.
- public challenges let authenticated community and institutional actors dispute
  stale lineage, metadata, privacy, governance, or source verification without
  deleting the disclosure. Independent human resolutions and public correction
  or withdrawal notices remain unauthenticated reads. Correction notices link a
  newly generated, independently verified replacement disclosure; withdrawal
  notices clearly remove reliance while preserving the original evidence trail.
- auditor organizations can publish bounded institutional audit attestations
  through `/canopyproof/audit/attestations`; those records bind methodology,
  standards, source event roots, findings, limitations, and claim boundaries
  without granting certificate, carbon-credit, tax-offset, fund, or yield
  authority.
- partner data rooms are represented by `/canopyproof/audit/export-manifests`.
  These manifests are hash-only indexes over evidence, proof, TerraProof,
  governance, funding, reporting, and audit resources; sensitive manifests are
  restricted to institutional reviewer roles and never carry raw media,
  private keys, payment credentials, or unrestricted personal data.
- unsupported certified-carbon-credit, carbon-tax-offset, guaranteed-yield, and
  automatic CANOPY distribution claims are rejected at input boundaries.
