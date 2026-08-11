# CanopyProof Partner Trust Portal Standard

Status: DRAFT - NON-PRODUCTION

Version: 0.1

Date: 2026-07-13

## 1. Purpose

The Partner Trust Portal is the institutional control plane for organizations
that contribute, review, govern, fund, research or observe CanopyProof records.
It is not a marketing directory and must not expose static demo data as live
institutional state.

## 2. Organization Types

Supported types are:

- UN agency;
- government;
- NGO;
- research institution or university;
- corporate sustainability organization;
- community organization;
- environmental auditor or verifier; and
- impact investor or climate fund.

Organization type does not grant authority by itself.

## 3. Organization Record

The authoritative record contains:

```text
organization_id
legal_name
display_name
organization_type
jurisdiction
registration_number
verification_status
trust_level
document_refs
authorized_membership_refs
accreditation_refs
agreement_refs
created_at
latest_projection_root
```

Sensitive documents remain in access-controlled object storage and are
referenced by commitments. Public profiles expose only approved fields.

## 4. Verification Lifecycle

The organization lifecycle is:

- `PENDING`
- `DOCUMENT_REVIEW`
- `VERIFIED`
- `SUSPENDED`
- `REVOKED`

Every transition is an immutable fact with actor, rationale, source roots,
reviewer eligibility, conflict disclosure, timestamp and audit event.

The route-closed canonical implementation stores lifecycle, independent
document review, appeal submission, and appeal decision facts in one ordered
organization stream. `VERIFIED` requires an accepted review and a different
human decider from a verified governance organization. The accepted review
binds a hash-only registration reference that PostgreSQL recomputes from the
current organization record; the raw registration number is not duplicated in
the fact. Suspension/revocation requires a scoped governance actor. A suspension appeal may authorize
reinstatement only after a different appeal resolver and a third reinstatement
authority act. Revocation remains terminal and an upheld procedural appeal can
only require a new identity.

Suspension and revocation immediately override signed sessions and unexpired
membership claims for protected actions.

Runtime session invalidation and the mounted compatibility verification route
have not yet been migrated to this authority. Until that separately reviewed
integration is complete, the canonical repository remains route-closed and the
compatibility profile row must not be used for institutional reliance.

Accreditation has its own route-closed canonical lifecycle:

```text
APPLICATION -> EXTERNAL REVIEW -> SEPARATE DECISION
                                      |
                                      +-> EXPIRED (explicit as-of projection)
                                      +-> SUSPENDED -> NEW RENEWAL
                                      +-> REVOKED (terminal)
```

Applications bind one exact scope, policy, evidence set, profile root, and
requested expiry. Approval requires two different verified humans outside the
subject organization and lasts no more than 366 days. Suspension and revocation
are new immutable control facts; renewal repeats review and decision and cannot
silently widen scope. No older approval can be selected after an adverse state.

The PostgreSQL foundation and deterministic tests exist, but the production
authority resolver, root-governance bootstrap, notices, staffed review queue,
session invalidation, compatibility backfill, and HTTP route migration do not.
Until those separately approved gates close, the portal must not present the
compatibility accreditation row as canonical institutional authority.

## 5. Membership And Roles

Portal roles are:

- `ORGANIZATION_OWNER`
- `ORGANIZATION_ADMIN`
- `VERIFIER`
- `RESEARCHER`
- `AUDITOR`
- `FIELD_WORKER`
- `VIEWER`

Compatibility roles map through a deny-by-default matrix. Membership includes
status, organization, role, capabilities, effective time, expiry, inviter,
acceptance, and revocation history.

Invitation does not create active authority. It creates a short-lived,
single-use invitation that must be accepted by an authenticated identity.

## 6. Capabilities

The portal supports governed workflows for:

- organization onboarding and document review;
- member invitation, role change, suspension and removal;
- accreditation request, review, expiry and revocation;
- data-sharing agreement negotiation and versioning;
- purpose-bound evidence and report access requests;
- bounded data delivery receipts;
- use attestations and enforcement reviews;
- audit access and hash-only export manifests;
- partner challenge, correction and remedy notices; and
- privacy-safe organization profile publication.

No portal action can directly verify evidence, issue an Environmental Proof
Record, publish an ESG report or release funding without the corresponding
domain and governance authority.

## 7. Data Sharing

Every sharing decision binds:

- provider and recipient organizations;
- agreement and version;
- approved purpose;
- data classes and subject scope;
- geography and time scope;
- retention and onward-sharing rules;
- privacy and location restrictions;
- expiry and revocation;
- approving identities; and
- manifest, delivery and audit roots.

Downloads and media URLs use short-lived capabilities. Credentials and storage
keys are never shared with portal clients.

Revocation prevents new access and creates an enforcement/restriction fact. It
does not pretend already delivered data was never disclosed.

## 8. Evidence And Report Sharing

Evidence sharing exposes the minimum approved representation:

- public summary;
- redacted metadata;
- generalized location;
- bounded preview;
- hash-only manifest; or
- controlled original asset.

Report sharing preserves report version, status, source root, reliance boundary
and expiry. Draft, challenged, withdrawn or unauthorized reports cannot be
presented as approved institutional output.

## 9. Audit Access

Auditors receive purpose-bound, time-limited, organization-scoped access. Audit
access is itself an audited command and may require independent approval.

Hash-only manifests are the default. Raw personal, device, location and media
data requires an explicit policy and agreement basis.

## 10. Authentication And Authorization

Protected requests require:

- origin-verified authentication;
- durable identity binding;
- current organization, membership and accreditation state;
- exact tenant match;
- capability and purpose check;
- agreement and classification check;
- rate and abuse controls; and
- atomic audit.

Actor, role and organization headers supplied by clients or the public proxy
are not authority.

## 11. Separation Of Duties

Policy must prevent an identity from unilaterally:

- submitting and finally verifying its own evidence;
- approving its own organization verification;
- granting itself accreditation;
- approving and consuming a restricted data request;
- resolving a challenge against its own decision; or
- issuing and independently auditing the same record.

Conflicts are immutable disclosures and cannot be removed after a decision.

## 12. API Boundary

The API separates organization, membership, accreditation, agreement, access,
delivery, use, enforcement, audit and public-accountability resources.

Every mutation uses an idempotency key and expected source root. List endpoints
are tenant-filtered, cursor-paginated and bounded. Public endpoints use a
separate privacy-safe projection and never reuse internal serializers.

## 13. Operational Controls

Production requires:

- invitation delivery with anti-phishing controls;
- document malware scanning and restricted rendering;
- expiry and suspension jobs;
- reviewer queues and service levels;
- support, appeal and incident workflows;
- privacy request and legal-hold handling;
- access anomaly detection;
- notification delivery receipts; and
- backup, restore and replay drills.

## 14. Required Tests

Conformance tests must prove:

- fake and duplicate organizations are rejected or held for review;
- organization state transitions are valid and audited;
- invitations are single-use, expiring and identity-bound;
- role escalation and cross-tenant access are rejected;
- suspension and revocation override active sessions;
- accreditation expiry removes high-assurance capability;
- data access is purpose-, agreement-, class- and time-bound;
- revoked access blocks future delivery;
- unauthorized report and audit access is rejected;
- conflicts and separation-of-duty violations are rejected;
- public profiles contain no personal or restricted fields; and
- replay reconstructs organization and access state after restart.

## 15. Current Boundary

Durable organization, membership, accreditation, agreement and substantial
purpose-bound data-accountability authorities exist with tests. Invitations,
document review operations, several compatibility sharing paths, production
notifications, privacy-safe portal projections and institutional runbooks are
incomplete. The `/partners` frontend remains a static workbench surface. This
standard is not production-conformant.
