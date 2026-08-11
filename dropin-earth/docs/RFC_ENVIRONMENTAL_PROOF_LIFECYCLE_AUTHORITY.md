# RFC: Environmental Proof Record Lifecycle Authority

Status: ACCEPTED FOR ROUTE-CLOSED IMPLEMENTATION

Version: 0.1

Date: 2026-07-14

Owners: CanopyProof Trust Kernel and Certificate Authority

## 1. Decision Summary

CanopyProof will extend the existing immutable Environmental Proof Record with
an append-only lifecycle authority. It will not create another certificate or
copy issuance truth into a compatibility service.

The authority binds one existing `environmental_proof_record` to:

- its current governed record projection;
- one complete, independently reviewed Digital MRV graph snapshot;
- an explicit observation and validity period;
- a bounded monitoring schedule and reliance statement;
- the current accredited issuer identity;
- an externally attested managed signing key; and
- an externally verified detached-signature receipt.

The lifecycle projection can report `ISSUED`, `ACTIVE`, `CHALLENGED`,
`SUSPENDED`, `REVOKED`, `EXPIRED`, or `SUPERSEDED`. The immutable source record
always remains `issued`; projected lifecycle state never rewrites it.

This implementation remains route-closed. It does not make records publicly
reliable, certified carbon credits, tax offsets, financial assets, ownership
titles, or guaranteed outcomes. `ACTIVE` is a technical conformance state, not
a regulated certification or financial claim.

## 2. Problem Statement

The repository currently has three relevant systems:

1. The canonical Environmental Proof authority derives a candidate, records
   independent approvals, and appends one immutable Environmental Proof Record.
2. The Environmental Proof challenge authority appends challenge, advisory
   risk, review, and resolution facts and projects the record as `issued`,
   `stale`, `challenged`, or `revoked`.
3. The Digital MRV graph authority records immutable lineage edges and complete
   human-reviewed snapshots. It explicitly does not issue final proof.

Compatibility certificate and transparency services also exist, but they are
not canonical authority.

The missing control is one deterministic lifecycle projection that requires
all three canonical sources, fixed validity, managed-signature evidence, and
append-only governance controls. Without it, a caller could confuse an
immutable historical issuance fact with a currently reliable record, omit MRV
lineage, ignore expiry, or treat a local hash as an institutional signature.

## 3. Goals

The first implementation must:

- preserve the existing Environmental Proof Record as the sole issuance fact;
- bind exact source roots, not caller descriptions;
- require a current governed record projection in `issued` state at binding;
- require the latest MRV snapshot in `reviewed_for_lineage` state;
- prove that the snapshot includes an exact support edge to the record root;
- bind observation, validity, monitoring, uncertainty, and reliance policy;
- require a verified human issuer with current accreditation scope;
- model managed signing keys without reading, storing, or exporting private
  key material;
- accept a signature only after a trusted external verifier returns a
  purpose-, key-, payload-, tenant-, and time-bound receipt;
- append every key, signature, lifecycle, and control action to a semantic
  event stream;
- provide deterministic replay and TypeScript/PostgreSQL hash parity;
- enforce exact idempotent retry, tenant isolation, forced RLS, append-only
  facts, and database mutation audit;
- derive expiry from immutable time policy; and
- keep all HTTP routes disabled until native database, KMS/HSM, privacy,
  institutional, and operational gates pass.

## 4. Non-Goals

This RFC does not:

- mint, tokenize, transfer, settle, or distribute an asset;
- enable mainnet funds or automatic CANOPY distribution;
- claim a certified carbon credit, carbon-tax offset, regulatory approval, or
  guaranteed yield;
- store a private key, seed phrase, signing credential, bearer token, or raw
  provider response;
- make AI, an agent, a model, an MRV snapshot, or an individual reviewer a
  final issuer;
- replace the existing challenge authority;
- expose precise location, raw evidence, reviewer contact data, or restricted
  evidence metadata;
- open an API or public transparency route;
- implement a production KMS/HSM provider adapter in this repository; or
- migrate compatibility certificate rows into canonical authority.

## 5. Canonical Authority Boundaries

### 5.1 Sole issuance truth

`certificates.environmental_proof_record_facts` remains the sole canonical
issuance table. A lifecycle binding references `record_id` and `record_root`.
It cannot alter or reproduce the evidence, methodology, governance, issuer, or
record hashes contained in that source fact.

### 5.2 Current record reliance

The lifecycle consumes
`certificates.environmental_proof_governed_record_projection(record_id)`.
That projection remains authoritative for:

- current source authority;
- unresolved challenge state; and
- challenge-resolution revocation.

The lifecycle cannot reject or erase a challenge. It can only fail closed when
the governed projection is no longer currently eligible.

### 5.3 MRV lineage

The lifecycle consumes the latest complete `mrv.graph_snapshot_facts` row and
its exact member manifest. `reviewed_for_lineage` is necessary but not
sufficient for activation. At least one member edge must target the exact
Environmental Proof Record ID and root with a permitted `SUPPORTS`
relationship. The snapshot methodology, project, organization, and record
methodology must agree.

The MRV graph remains lineage authority only. Lifecycle activation does not
upgrade it into a final proof authority.

### 5.4 Key and signature authority

CanopyProof stores only public commitments and verifier receipts:

- provider and non-secret provider key identifier;
- algorithm and key version;
- public-key hash;
- purpose and organization binding;
- provider-attestation receipt hash;
- key validity and revocation facts;
- detached public signature; and
- signature-verification receipt hash.

Private material must remain inside an approved external KMS/HSM. Test doubles
can exercise the port but are never production evidence.

## 6. Trust Model

### 6.1 Trusted inputs

The lifecycle trusts only durable, replayed source facts and explicit ports:

- the canonical Environmental Proof record repository;
- the governed record projection;
- the MRV graph repository and complete snapshot members;
- the identity, organization, membership, and accreditation authorities;
- the append-only audit authority;
- a production-approved managed-key attestation verifier; and
- a production-approved detached-signature verifier.

### 6.2 Untrusted inputs

All command bodies, timestamps, hashes, claimed states, signatures, key IDs,
provider labels, reason strings, and source-root lists are untrusted until
normalized and re-resolved. A valid shape is not evidence of authority.

### 6.3 Separation of duties

- Agents and AI cannot register keys, bind lifecycle policy, verify signatures,
  suspend, reinstate, supersede, or activate a record.
- The lifecycle issuer must be the human issuer named by the canonical record,
  have current organization membership, and hold approved
  `environmental_proof_lifecycle:issue` accreditation.
- A lifecycle governor must be an independent accredited human with
  `environmental_proof_lifecycle:govern` scope and cannot be the record issuer,
  lifecycle issuer, signature verifier identity, MRV snapshot reviewer, or a
  source contributor.
- The external signature verifier verifies cryptography but cannot decide
  lifecycle or environmental validity.
- No component can approve its own action.

### 6.4 Fail-closed rule

Missing, stale, inconsistent, future-dated, revoked, challenged, expired, or
unverifiable authority prevents `ACTIVE`. Historical facts remain readable to
authorized audit workflows.

## 7. Data Flow

```text
Canonical Environmental Proof Record
                 |
                 v
Current governed record projection ---- challenge/resolution authority
                 |
                 +------------------------+
                                          |
Latest reviewed MRV snapshot -------------+--> lifecycle binding fact
  + complete members                      |       |
  + exact record support edge             |       v
                                          |   canonical payload hash
Identity/accreditation -------------------+       |
Managed key attestation ------------------+       v
                                          |   external KMS/HSM signing
                                          |       |
                                          |       v
                                          +-- verified signature receipt
                                                  |
Lifecycle control facts --------------------------+
                                                  v
                                      deterministic current projection
```

Each command is processed in one serializable database transaction:

1. set organization and actor context;
2. lock command and record or key stream;
3. re-read all source authority under the transaction snapshot;
4. replay the existing lifecycle stream;
5. derive the exact proposed fact;
6. compare the proposed fact byte-for-byte by canonical hash;
7. append the semantic event;
8. append the authority fact;
9. append the exact command receipt; and
10. commit atomically.

## 8. Domain Facts

### 8.1 Managed signing key attestation

`environmental_proof_signing_key_attestation` records:

- key authority ID and root;
- organization ID;
- provider, provider key ID, key version, algorithm, and purpose;
- public-key hash and provider-attestation receipt hash;
- `active_from` and optional `expires_at`;
- independent registrar identity and authority root;
- external verifier name and verification time;
- command, source, fact, event, and audit roots; and
- the mandatory safety boundary.

The provider port must return `verified: true` for the exact normalized
request. Callers cannot submit verification state or a receipt root.

### 8.2 Managed signing key revocation

`environmental_proof_signing_key_revocation` references the exact key root,
records a bounded reason code and rationale hash, and is terminal for that key
version. Revocation never deletes signatures produced while the key was valid.

### 8.3 Lifecycle binding

`environmental_proof_lifecycle_binding` references:

- exact record ID/root and governed projection root;
- exact MRV snapshot ID/root, edge-set root, graph root, and review time;
- methodology ID and publication root;
- observation start/end;
- valid-from and expiry;
- monitoring cadence, next due time, and grace period;
- assertion type and hashed scope, location, uncertainty, and limitations;
- the fixed reliance code `environmental_accountability_only`;
- current issuer identity/accreditation authority;
- exact signing-key authority ID/root;
- canonical signature payload hash; and
- command, source, fact, event, and audit roots.

There is at most one lifecycle binding per canonical record. Renewal requires a
new Environmental Proof Record, not mutation or extension of this binding.

### 8.4 Signature verification receipt

`environmental_proof_signature_receipt` references the binding and key roots,
stores the detached public signature and its hash, and records the external
provider's non-secret receipt ID hash, receipt hash, verifier identity, and
verification time. There is at most one accepted signature receipt per
binding. Exact retry returns the original fact; changed retry conflicts.

### 8.5 Lifecycle control

`environmental_proof_lifecycle_control` appends one of:

- `suspend`;
- `reinstate`; or
- `supersede`.

Every control binds the immediately preceding lifecycle projection root,
source projection roots, independent governor authority, rationale hash,
conflict disclosure hash, and event lineage. `supersede` additionally binds a
distinct later lifecycle binding for the same organization and project.

`reinstate` is accepted only from explicit suspension and only when all current
activation gates would otherwise pass. `supersede` is terminal for the
predecessor. It does not mutate or delete either record.

## 9. Lifecycle Projection

The projection is evaluated at an explicit RFC3339 timestamp. Application code
must not accept arbitrary client evaluation times for authoritative reads; the
repository supplies database time or a governed audit time. Explicit time is
retained in pure domain tests for deterministic replay.

The projection reports a primary state plus all issue codes. Primary state
uses this precedence:

1. `SUPERSEDED` when a valid supersession control exists;
2. `REVOKED` when the governed record projection is revoked;
3. `CHALLENGED` when the governed record projection is challenged;
4. `EXPIRED` when evaluation time is at or after immutable expiry;
5. `SUSPENDED` when an explicit suspension is current or any formerly
   activatable source/key/MRV condition is no longer current;
6. `ISSUED` before `valid_from` or before an accepted signature receipt; and
7. `ACTIVE` only when every activation condition passes.

`ACTIVE` requires all of:

- an accepted signature verification receipt;
- evaluation time within `[valid_from, expires_at)`;
- current non-revoked, non-expired signing-key authority;
- governed record state `issued` and current source authority;
- latest MRV graph state `reviewed_for_lineage` with the exact bound snapshot;
- no current suspension or supersession; and
- matching organization, project, record, methodology, and source roots.

The projection includes boolean gates and machine-readable issue codes so the
primary state never hides concurrent expiry, source staleness, key revocation,
or challenge conditions.

## 10. Threat Model

| Threat | Required control |
| --- | --- |
| A caller invents a record or substitutes its root | Resolve record by ID and compare exact durable root in domain and SQL trigger. |
| A compatibility certificate is passed as canonical | Accept only `environmental_proof_record_facts` authority. |
| A stale or challenged record becomes active | Resolve current governed projection at binding and every projection. |
| An incomplete MRV graph is selected | Require latest reviewed snapshot, complete members, required coverage, and exact record support edge. |
| A later MRV snapshot invalidates the binding silently | Compare latest snapshot/root on every projection and suspend on mismatch. |
| AI or agent self-approves | Human-only issuer/governor checks and accreditation scope; AI remains advisory. |
| Issuer substitutes another organization | Exact organization, membership, accreditation, record issuer, key, project, and RLS binding. |
| Caller claims a key is KMS-managed | Only the managed-key attestation verifier port can produce an accepted key fact. |
| Private key enters CanopyProof | Schemas reject private/secret/credential fields recursively; provider adapter accepts only public commitments. |
| Signature is for another payload or tenant | Verify purpose, audience, organization, record, binding, key, payload hash, and signature algorithm. |
| Caller supplies `verified`, state, hash, or root | Command schemas reject those fields; service and SQL derive them. |
| Key is revoked after signing | Current projection reads append-only key revocation and suspends reliance. |
| Signature or command is replayed | Exact command receipts, one signature per binding, canonical hashes, and stream locks. |
| Concurrent writers create two bindings or controls | Serializable transaction, advisory stream lock, unique constraints, and bounded retry. |
| Backdated control rewrites history | Strict event chronology and previous-event-root validation. |
| Expiry is extended in place | Binding is immutable; renewal requires a new record and supersession fact. |
| Supersession forms a cycle or crosses projects | Later-created distinct successor, same tenant/project, one predecessor, and terminal uniqueness. |
| Database owner bypasses application validation | SQL validation triggers re-resolve source authority and recompute canonical hashes. Database-owner compromise remains an operational threat requiring least-privilege deployment and external checkpoints. |
| Public output leaks restricted data | No public route in this increment; later projection requires privacy review and field allowlist. |
| Record is marketed as a credit or asset | Fixed reliance code, unsafe-claim text rejection, safety flags, docs, and route gate. |

## 11. API Design

No HTTP route is mounted in this increment. The internal service/repository
contract is separated into commands and projections:

```text
registerManagedSigningKey(command, verifierPort)
revokeManagedSigningKey(command)
bindEnvironmentalProofLifecycle(command, resolvedAuthorities)
recordEnvironmentalProofSignature(command, verifierPort)
recordEnvironmentalProofLifecycleControl(command, resolvedAuthorities)
projectEnvironmentalProofLifecycle(recordId, evaluatedAt)
loadEnvironmentalProofLifecycleAuthority(recordId)
```

Future route families, if approved, remain separate:

```text
POST /canopyproof/environmental-proof/keys/attest
POST /canopyproof/environmental-proof/keys/:id/revoke
POST /canopyproof/environmental-proof/records/:id/lifecycle
POST /canopyproof/environmental-proof/records/:id/signature
POST /canopyproof/environmental-proof/records/:id/controls
GET  /canopyproof/environmental-proof/records/:id/lifecycle
```

Opening any route requires origin-bound authentication, organization RLS,
capability checks, rate limits, body limits, idempotency keys, request IDs,
audit correlation, privacy review, and production provider composition.

Public verification will be a separate read-only projection. It must never
expose the mutation surface or raw authority snapshots.

## 12. Database Changes

An additive migration creates:

```text
governance.environmental_proof_signing_key_attestation_facts
governance.environmental_proof_signing_key_revocation_facts
certificates.environmental_proof_lifecycle_binding_facts
certificates.environmental_proof_signature_receipt_facts
governance.environmental_proof_lifecycle_control_facts
```

Each table has:

- immutable primary and unique roots;
- exact foreign keys to canonical source facts;
- strict checks and bounded arrays/text;
- a canonical `fact_record` JSON document;
- an exact semantic `audit_event_root` reference;
- append-only update/delete triggers;
- database row-mutation audit;
- forced organization RLS; and
- indexes for record/key stream ordering and current projection.

Database functions:

- reject forbidden or unexpected JSON keys;
- validate actor, membership, organization, and accreditation state;
- recompute source, command, fact, and root hashes;
- verify semantic event payload equality;
- validate MRV snapshot membership and latest-snapshot binding;
- validate key validity/revocation and signature receipt consistency;
- enforce lifecycle-control transition rules; and
- return the deterministic current lifecycle projection.

The migration depends on `canopyproof-os.sql` and `mrv-graph.sql`. It does not
alter compatibility certificate tables.

## 13. Migration Strategy

1. Apply the migration idempotently in an empty disposable database after the
   base and MRV contracts.
2. Re-apply it to prove idempotent DDL.
3. Run domain and PGlite parity tests with routes closed.
4. Run the opt-in native PostgreSQL test against an explicitly disposable
   database, including concurrent writers and real RLS roles.
5. Deploy schema code without composing a KMS/HSM provider or exposing routes.
6. Complete institutional certificate policy, issuer accreditation, key
   ceremony, retention, privacy, incident, and legal review.
7. Integrate one approved KMS/HSM adapter in a non-production environment and
   verify algorithm, rotation, revocation, outage, replay, and audit behavior.
8. Produce independent conformance evidence before enabling an internal route.
9. Open public read projection only after a separate privacy/security RFC and
   formal approval.

Existing canonical records are not backfilled automatically. They remain valid
historical issuance facts and project as non-active until a reviewed lifecycle
binding and verified signature receipt are appended.

## 14. Rollback Strategy

Rollback is fail-closed:

- if every new lifecycle table is empty, drop new policies, triggers,
  functions, and tables in reverse dependency order;
- if any authority fact exists, abort with
  `CANOPYPROOF_CERTIFICATE_LIFECYCLE_ROLLBACK_REQUIRES_EMPTY_AUTHORITY`;
- never delete, rewrite, or downgrade an existing canonical Environmental
  Proof Record, challenge, MRV, audit, or command-receipt fact;
- disable future route/worker composition before any schema rollback; and
- preserve provider-side key and audit records under the external incident and
  retention policy.

Operational rollback after route opening means disabling new commands and
projecting affected records as unavailable or suspended. It never means
deleting historical lifecycle facts.

## 15. Verification Plan

Unit tests must prove:

- exact source/MRV binding and deterministic replay;
- no activation without verified managed key and signature receipt;
- agent, wrong tenant, inactive membership, missing accreditation, issuer
  substitution, and conflict-of-duty rejection;
- stale record, changed MRV snapshot, revoked key, future validity, expiry,
  challenge, revocation, suspension, reinstatement, and supersession;
- changed idempotent retry rejection;
- malformed signature, unknown provider/algorithm, forbidden key fields, and
  unsafe claim text rejection; and
- event/payload/root tamper rejection.

PGlite tests must prove:

- migration idempotency;
- real repository writes and restart replay;
- source-root and MRV-member substitution rejection in SQL;
- no orphan event after failed fact insertion;
- append-only triggers and exact command receipts;
- forced RLS policy presence;
- deterministic lifecycle projection parity; and
- non-empty rollback refusal.

Native PostgreSQL remains a hard production gate for:

- concurrent key, binding, signature, and control commands;
- least-privilege grants and role-enforced RLS;
- advisory lock behavior;
- serializable retry behavior; and
- provider timeout/failure transaction boundaries.

## 16. Route-Opening Gates

All must pass before an internal lifecycle mutation route can be enabled:

- native PostgreSQL concurrency and RLS evidence;
- approved production KMS/HSM adapter and key ceremony;
- verifier algorithm and provider conformance fixtures;
- issuer and governor accreditation operations;
- external immutable audit checkpointing;
- privacy and retention review;
- incident response for key compromise and false activation;
- institutional/legal approval of reliance language;
- observability, SLO, alert, backup, and disaster-recovery evidence; and
- explicit security review confirming that API and web worker boundaries,
  admin proxy denial, and all financial/claim prohibitions remain intact.

Until then, repository status must report `routeMounted: false` and
`productionActivationEnabled: false`.
