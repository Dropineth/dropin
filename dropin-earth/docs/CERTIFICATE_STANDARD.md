# CanopyProof Environmental Proof Record Standard

Status: DRAFT - NON-PRODUCTION

Version: 0.1

Date: 2026-07-13

## 1. Name And Reliance Boundary

The canonical CanopyProof certificate artifact is an **Environmental Proof
Record**.

It is not:

- a certified carbon credit;
- a carbon-tax offset;
- a regulated environmental commodity;
- a financial asset or security;
- a payment receipt;
- an ownership title;
- a guaranteed ecological outcome; or
- a guaranteed RWA yield.

The artifact records that a bounded environmental assertion passed the
specified evidence, methodology, human review and governance process at a point
in time.

## 2. Authority

Only the Certificate Authority domain may issue an Environmental Proof Record.
It consumes immutable current projections from project, evidence,
verification, methodology, MRV, governance, risk and audit authorities.

AI, models, agents, field reviewers, FiftyOne, TerraProof, individual evidence
sources and compatibility certificate services cannot issue the record.

## 3. Required Fields

Each record contains:

```text
record_id
record_version
issuer_organization_id
issuer_accreditation_ref
project_id
project_root
assertion_type
assertion_scope
location_scope
observation_period
evidence_root
mrv_graph_root
verification_method
verification_decision_refs
reviewers
methodology_id
methodology_version
governance_approval_refs
risk_and_challenge_state
issued_at
valid_from
expires_at
status
monitoring_schedule
prior_record_id
record_hash
record_root
signature_key_id
signature
reliance_statement
```

Public projections may generalize location and reviewer details but must remain
cryptographically bound to the same record root.

## 4. Lifecycle

The canonical lifecycle is:

- `ISSUED`
- `ACTIVE`
- `CHALLENGED`
- `SUSPENDED`
- `REVOKED`
- `EXPIRED`
- `SUPERSEDED`

`ISSUED` records become `ACTIVE` only when all publication and effective-date
conditions pass. Status changes are immutable facts. No status is rewritten.

Compatibility status vocabularies require an explicit versioned mapping and
cannot map a weaker state to `ACTIVE`.

## 5. Issuance Preconditions

Issuance requires:

- a current governed project in an eligible lifecycle state;
- a published, applicable methodology and proof policy;
- complete evidence and MRV roots;
- current final human verification decisions;
- required independent reviewers;
- required governance approvals and conflict clearance;
- no unresolved blocking risk or challenge;
- an observation period and explicit uncertainty;
- a monitoring and expiry policy;
- a privacy-safe public projection plan;
- current issuer authority and signing key; and
- atomic record, semantic-event and command-receipt persistence.

Unavailable or stale dependencies fail closed.

## 6. Assertion Scope

Every assertion is bounded by:

- project and organization;
- geography and precision;
- environmental variable or intervention;
- observation and validity periods;
- method and source classes;
- confidence and uncertainty;
- exclusions and known limitations; and
- allowed reliance.

The record must not generalize beyond the evidence and methodology boundary.

## 7. Reviewers And Governance

Reviewer entries bind identity, organization, role, accreditation snapshot,
review root and timestamp. Required reviewers are independent of contributor,
model operator and issuer according to policy.

Governance approval records council, decision type, quorum, votes, conflicts,
policy version and approval root. GitHub release approval is not a substitute
for environmental record governance.

## 8. Monitoring And Expiry

Every active record has a monitoring schedule and expiration. Monitoring facts
can keep the record current, mark it stale, trigger re-verification, or initiate
suspension/challenge.

Expiry is automatic from immutable time policy and cannot be extended by
editing the record. Renewal is a new record version with new evidence,
verification and governance roots.

## 9. Challenge And Revocation

An authorized challenge appends:

- challenge fact;
- advisory risk fact;
- independent review assignments; and
- governance review state.

During a material challenge the public projection is `CHALLENGED` or
`SUSPENDED` according to policy. An upheld resolution can append `REVOKED` and
correction notices. A rejected challenge preserves the active projection while
retaining the complete challenge history.

Revocation never deletes the issued record.

## 10. Transparency Artifact

The public transparency entry contains:

- record ID, version, root and status;
- privacy-safe project and issuer references;
- assertion and time scope;
- methodology and verification references;
- governance, monitoring and challenge summaries;
- prior/superseding record references;
- publication timestamp; and
- bounded reliance statement.

The route-closed transparency authority now implements this as an immutable
privacy-review fact, a separate immutable publication fact, and a current
challenge/lifecycle projection. The projection exposes pseudonymous IDs,
aggregate counts/roots, UTC days, optional region-or-withheld location, area and
confidence bands, limitation roots, and bounded lifecycle/challenge state. It
contains no coordinate, geometry, raw evidence, contributor/reviewer identity,
rationale, credential, or signature bytes. A public API remains unapproved.

## 11. Signatures And Keys

Production signatures require managed KMS/HSM keys with:

- purpose-bound key policy;
- non-exportable private material;
- key identifier and algorithm version;
- issuer binding;
- rotation and revocation;
- timestamp and signature verification; and
- independently auditable key events.

Local hashes, mock signatures and blockchain anchoring do not establish issuer
authority.

## 12. API Requirements

Certificate APIs separate:

- candidate derivation;
- approval submission;
- issuance;
- monitoring;
- challenge;
- suspension/revocation;
- transparency projection; and
- verification.

Every mutation requires authenticated current authority, tenant binding,
idempotency, expected source roots, separation of duties and atomic audit.
Public reads return privacy-safe projections only.

## 13. Required Tests

Conformance tests must prove:

- AI, models and individual reviewers cannot issue records;
- missing methodology, evidence, MRV, verification or governance roots deny
  issuance;
- stale, challenged or revoked dependencies deny active publication;
- reviewer and issuer conflicts are rejected;
- caller-supplied status, hash, timestamp and signature are rejected;
- expiration, challenge, suspension, revocation and supersession preserve
  issuance history;
- transparency projection verifies against the authority root;
- cross-tenant and unauthorized reads/writes are denied;
- concurrent issuance is idempotent; and
- prohibited financial, credit and tax claims are rejected.

## 14. Current Boundary

The repository contains canonical Environmental Proof candidate and record
facts, governed methodology/policy prerequisites, independent approvals,
challenge-driven revocation, reviewed MRV binding, validity/monitoring controls,
managed-key attestation and detached-signature receipts, lifecycle projection,
and a route-closed privacy-reviewed transparency authority. Compatibility
certificate/public-record services remain separate and non-canonical. A public
API, operated KMS/HSM integration, production migration/operations evidence,
privacy/legal approval, and institutional issuer operations remain absent.
The constructor-only AWS KMS verifier is a default-off `GetPublicKey`/`Verify`
engineering boundary tested with fake credentials and mock responses; it is
not an operated key service, signing authority, route, or production approval.
Disposable native PostgreSQL evidence exists for the route-closed transparency
path, but it is not production approval. The system is not
production-conformant.
