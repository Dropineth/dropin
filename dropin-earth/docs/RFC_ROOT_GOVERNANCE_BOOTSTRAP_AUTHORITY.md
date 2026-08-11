# RFC: Root Governance Bootstrap And Canonical Accreditation Resolver

Status: implemented route-closed; native PostgreSQL and production ceremony gates remain open

Date: 2026-07-19

## 1. Problem Statement

CanopyProof has a canonical organization accreditation authority, but its first
governance reviewers cannot be authorized by that same authority without a
circular dependency. The current integration fixture resolves the circle by
constructing an in-memory actor snapshot named `root-governance-accreditation`.
That fixture is useful test scaffolding, but it is not institutional authority:

- no immutable charter defines the root council or exact delegated scopes;
- no external signatures prove that independent organizations accepted it;
- no bounded validity interval removes bootstrap power automatically;
- no successor, suspension, or terminal revocation stream exists;
- no PostgreSQL resolver proves whether authority came from an active charter
  or a canonical organization accreditation decision;
- the accreditation insert validator checks identity and membership state but
  cannot independently prove the claimed authority source.

This gap blocks production composition of organization accreditation and every
downstream authority that depends on accredited human reviewers. Root authority
must be explicit, narrow, time-bounded, independently signed, append-only, and
observable. It must never become a hidden super-admin role.

## 2. Scope And Non-Goals

This increment will:

- define one global root-governance proposal, attestation, decision, and
  projection protocol;
- require an Ed25519-signed quorum of at least three verified humans from at
  least three distinct verified organizations;
- delegate only the three organization-accreditation scopes;
- bind exact participants, organizations, memberships, public verification
  keys, policy, source evidence, validity, and predecessor roots;
- support an initial charter, governed succession, suspension, and terminal
  revocation without rewriting history;
- require an old-council quorum as well as a new-council quorum for succession;
- expose a transaction-bound canonical resolver that can derive governance
  authority from either the current root charter or a current canonical
  organization accreditation;
- recheck authority from current PostgreSQL facts inside the same accreditation
  writer transaction before facts are inserted;
- remain route-closed, scheduler-free, migration-governed, and default-off.

This increment will not:

- create a public bootstrap, break-glass, or super-admin endpoint;
- provision participants, organizations, memberships, keys, or secrets;
- generate, import, transmit, escrow, or persist private keys;
- trust compatibility accreditation rows or signed role headers;
- activate existing HTTP routes or invalidate existing sessions;
- send notices, run a staffed council workflow, or replace legal review;
- move funds, distribute CANOPY, issue certified carbon credits or tax offsets,
  create a financial asset, or promise impact or yield.

## 3. Trust Model

### 3.1 Root Of Trust

The initial charter is an offline, migration-governed ceremony artifact. Each
proposed council member must already have a reviewed participant,
organization, and membership record. Those records are commitments, not enough
authority on their own. Authority begins only after the charter receives a
valid cryptographic quorum and an immutable decision fact is committed.

The ceremony is a narrow constitutional exception used only to bootstrap
organization accreditation. It is not an alternative identity system and does
not authorize proof issuance, evidence verification, funding, reporting,
public risk release, deployment, or administration.

### 3.2 Council Independence

An active council has between three and nine members. Every member is:

- a verified human;
- an owner, admin, verifier, or researcher;
- bound to one verified organization and one active membership;
- bound to one Ed25519 public verification JWK with no private `d` member;
- identified by deterministic participant, organization, membership, key, and
  member roots.

Council members, organizations, memberships, and public keys are unique. The
required approval threshold is at least three and cannot exceed council size.
Every counted approval must come from a different organization. An Agent, AI
output, compatibility role, or process-local object cannot count toward quorum.

### 3.3 Delegated Scope

The constitutional scope set is fixed and exact:

```text
organization:accreditation:review
organization:accreditation:decide
organization:accreditation:govern
```

A charter cannot add, rename, wildcard, or silently remove one of these scopes.
No root-governance projection is valid for any other operation.

### 3.4 Policy And Time

Every charter binds one 64-character lowercase SHA-256 policy root and one
hash-bound public charter document. The effective interval begins at the
decision timestamp and is positive but no longer than 366 days. All projection
and resolver calls require an explicit canonical `asOf` timestamp.

Expiry is deterministic and fail-closed. No older charter revives after a
successor expires, is suspended, or is revoked.

## 4. Immutable Fact Model

All facts share one global sequence and one semantic-event predecessor chain on
the stream `root-governance:organization-accreditation`.

### 4.1 Proposal Fact

```text
proposalId
action: activate_initial | supersede | suspend | revoke
authorityDomain: organization_accreditation
charterVersion
charterDocumentRoot
policyRoot
delegatedScopes[]
councilMembers[]
requiredApprovals
requestedValidUntil
targetDecisionId/root (control only)
predecessorDecisionId/root (supersession only)
reasonCode
rationale
evidenceEventRoots[]
evidenceRoot
proposer identity commitment
proposedAt
commandHash
proposalHash/root
auditEvent
```

`activate_initial` is valid only when no charter decision exists.
`supersede` must bind the latest charter decision. `suspend` and `revoke` must
target the latest active charter decision. Proposal creation grants no
authority.

For initial and successor proposals, charter, policy, council, threshold, and
validity fields are required. For control proposals they are inherited from the
target decision and cannot be caller-substituted.

### 4.2 Council Member Commitment

```text
participantId
participantRoot
role
organizationId
organizationRoot
membershipId
membershipRoot
keyId
publicKeyJwk: { kty: OKP, crv: Ed25519, x, key_ops: [verify], ext: true }
publicKeyFingerprint
memberRoot
```

Only public verification material is accepted. Unknown JWK members, private
material, signing operations, certificates, secrets, tokens, raw credentials,
or unbounded metadata are rejected recursively.

### 4.3 Attestation Fact

```text
attestationId
proposalId/root
decision: approve | reject
signer member commitment
rationale
conflictDisclosure
signedPayloadRoot
signatureAlgorithm: ed25519
signatureBase64Url
signatureHash
verifiedAt
verifierVersion
verificationReceiptRoot
attestedAt
commandHash
attestationHash/root
auditEvent
```

The signed payload is a domain-separated canonical envelope containing the
proposal root, decision, signer member root, and attestation timestamp. Web
Crypto verifies the signature against the exact public JWK committed by the
applicable council. The raw signature is public evidence and may be retained;
private key material may not enter the process.

An attestation is immutable. Changed retries conflict. A rejection cannot count
toward approval and cannot be overwritten by a later approval with the same
signer and proposal.

### 4.4 Decision Fact

```text
decisionId
proposalId/root
action
approvalAttestationIds[]/roots[]
approvalQuorumRoot
priorDecisionId/root
effectiveFrom
effectiveUntil (charter decisions)
decisionAt
commandHash
decisionHash/root
auditEvent
```

The decision is a deterministic materialization of a valid signed quorum. Its
audit event identifies the proposal's accountable human materializer, but that
person cannot alter or replace the quorum and gains no discretionary decision
authority.

Quorum rules:

- initial activation requires the proposed charter threshold from proposed
  council members, with every counted member in a distinct organization;
- succession requires the proposed charter threshold from the new council and
  the predecessor threshold from the old council;
- suspension and revocation require the active predecessor threshold from the
  active council;
- every signature, member root, organization, identity, membership, proposal,
  key, timestamp, and receipt root must replay exactly;
- decision time cannot precede the proposal or any counted attestation;
- revocation is terminal for the root-governance stream.

## 5. Deterministic Projection

Projection input is `asOf`.

```text
no charter decision                  -> uninitialized
latest decision revoked              -> revoked
latest decision suspended            -> suspended
asOf < effectiveFrom                 -> pending
asOf >= effectiveUntil               -> expired
otherwise                            -> active
```

The current projection is derived from the newest valid global sequence and
never falls back to an older decision. It exposes exact policy, council,
quorum, validity, predecessor, event, and projection roots.

## 6. Canonical Resolver

The resolver runs inside the caller's serializable PostgreSQL transaction.
Input is:

```text
operation: review | decision | control
subjectOrganizationId
actorId
actorOrganizationId
actorRole
profileRoot
policyRoot
requiredScope
effectiveAt
```

Resolution order is explicit and non-fallback:

1. Resolve the current root-governance projection at `effectiveAt`.
2. Require its policy root to equal the command policy root.
3. Recheck the actor participant, organization, membership, role, and committed
   roots against current PostgreSQL rows.
4. If the actor is an active root council member, return a snapshot with
   `authoritySource = root_governance_bootstrap` and exact decision/projection
   roots and interval.
5. Otherwise resolve the actor organization's latest canonical accreditation
   stream at `effectiveAt`; require `approved`, exact scope, policy lineage, and
   no newer denial, expiry, suspension, or revocation.
6. Return a snapshot with `authoritySource = canonical_accreditation` and exact
   application/decision/projection roots.
7. If either source is malformed or ambiguous, fail unavailable. If neither
   source authorizes the actor, fail denied.

The mutable `organizations.accreditations` table is never queried. Resolver
failure cannot be converted into root authority, compatibility authority, or a
development fallback in production.

The repository compares the resolver result byte-for-byte with the actor
snapshot committed by the command. Its SQL insert validator independently
rechecks current participant, organization, membership, source label, interval,
scope, and actor-root commitments. The root/canonical source projection itself
is replayed by the canonical resolver from immutable PostgreSQL facts in the
same transaction; it is not inferred from the actor snapshot or compatibility
tables.

The current migration does not yet give a standalone SQL function enough logic
to replay both source projections without the TypeScript resolver. Therefore
direct INSERT privilege is not an accepted production interface. A dedicated
`NOBYPASSRLS` writer role, native PostgreSQL source-replay parity test, and
revocation drill remain mandatory before any route is mounted.

## 7. Data Flow

```text
reviewed offline charter + pre-provisioned public identities
  -> independent Ed25519 council attestations
  -> deterministic quorum decision
  -> active bounded root-governance projection
  -> first canonical organization accreditation reviews and decisions
  -> canonical accredited organizations become normal governance authority
  -> successor charter or expiry removes old bootstrap projection
```

Signature verification occurs when an attestation is created and again when the
durable writer replays the complete snapshot inside its database transaction.
The writer commits the fact, semantic event, receipt, and database audit row
atomically. Verification uses only the public JWK already committed in the
proposal; no network, private-key, or key-provider I/O occurs while locks are
held.

## 8. Threat Model

| Threat | Required control |
| --- | --- |
| Synthetic root admin | No role/header/env override; only signed canonical facts |
| Single-organization capture | At least three approvals from distinct organizations |
| AI or Agent authority | Human literal and SQL predicates; AI never counts |
| Private key ingestion | Public-JWK allowlist; recursive `d`/secret rejection |
| Signature substitution | Domain-separated payload, exact member/key/proposal binding |
| Key substitution | JWK fingerprint and member root fixed by charter |
| Scope escalation | Exact constitutional three-scope set |
| Permanent bootstrap | Maximum 366-day interval and explicit as-of projection |
| Old-charter fallback | Latest-decision projection with no adverse fallback |
| Hostile council replacement | Old and new council quorums required for succession |
| Stale identity or membership | Transaction-bound re-resolution plus SQL predicates |
| Compatibility-row promotion | Canonical tables only |
| Concurrent fork | Serializable transaction, global advisory lock, unique predecessor |
| Replay mutation | Actor/operation/idempotency receipt binds exact request and response |
| Direct SQL forgery | SQL recomputes signature commitments, hashes, roots, quorum, events; direct writer grants remain blocked pending native role hardening |
| Cross-tenant disclosure | Forced RLS and minimized public projection |
| Database owner compromise | External signature replay and checkpointing remain required |

Residual risks include coercion or compromise of a quorum, maliciously
pre-provisioned identity records, unavailable old-council members, Web Crypto or
database implementation defects, and legal disputes over institutional
representation. Independent ceremony records, external checkpoints, key
revocation operations, and human governance remain mandatory production work.

## 9. API And Service Design

No HTTP route is mounted by this RFC. The route-closed domain API is:

```text
propose(input, proposerCommitment)
attest(proposalId, input, verifiedSignature)
decide(proposalId, attestationIds, decidedAt)
getProjection(asOf)
getAuthoritySnapshot()
verifyAuthoritySnapshot(snapshot)
```

The PostgreSQL repository exposes one commit method per fact family and exact
read/projection methods. A separate resolver adapter implements the existing
organization-accreditation governance resolver contract.

Status must report:

```text
routeMounted: false
schedulerMounted: false
productionActivationEnabled: false
publicBootstrapEndpoint: false
privateKeyHandling: false
compatibilityAuthorityFallback: false
```

## 10. Database Changes

The additive migration creates:

- `governance.root_governance_proposal_facts`;
- `governance.root_governance_attestation_facts`;
- `governance.root_governance_decision_facts`.

The migration also adds:

- deterministic hash, Merkle, event, quorum, and JWK commitment functions;
- one global no-fork sequence and semantic-event predecessor chain;
- unique proposal/signer and decision/predecessor constraints;
- append-only update/delete rejection and database audit triggers;
- forced RLS for a fixed root-governance reader context;
- exact command receipts and serializable advisory locking;
- source-labelled accreditation actor validation, with factual source replay in
  the transaction-bound canonical resolver;
- an empty-only rollback that refuses to delete any constitutional history.

Signature cryptography remains in the Web Crypto boundary. PostgreSQL verifies
the exact signed-payload, signature hash, key fingerprint, member, receipt, and
quorum commitments and refuses any fact that does not match them.

Implemented files:

- `services/api/src/domain/canopyproof/root-governance-authority.ts`;
- `services/api/src/domain/canopyproof/root-governance-postgres.ts`;
- `services/api/src/domain/canopyproof/canonical-organization-accreditation-resolver.ts`;
- `services/api/prisma/root-governance-authority.sql`;
- `services/api/prisma/root-governance-authority.rollback.sql`;
- focused unit and PGlite integration tests under `tests/`.

## 11. Migration Strategy

1. Implement and test pure deterministic facts and Web Crypto verification while
   all routes and production composition remain closed.
2. Apply the additive SQL twice in disposable PGlite and PostgreSQL gates.
3. Provision no production identities automatically. Prepare a reviewed offline
   inventory of council humans, organizations, memberships, and public keys.
4. Reconcile every committed root to current canonical participant,
   organization, and membership records. Ambiguity is denial, not backfill.
5. Execute a signed ceremony in a disposable staging database and independently
   replay every signature, hash, event, and projection.
6. Run native PostgreSQL dual-writer, `NOBYPASSRLS`, restart, backup/restore, and
   adverse-control gates.
7. Shadow the canonical resolver without allowing it to grant access. Compare
   decisions and investigate every divergence.
8. Activate one organization-accreditation writer only after security, legal,
   governance, operations, and release-council approval.
9. Remove synthetic fixture authority from production composition. Test fixtures
   remain explicitly test-only.

No existing compatibility accreditation is promoted automatically.

## 12. Rollback Strategy

Before any root-governance fact exists and while no consumer is mounted, the
rollback may remove only the new tables, functions, policies, indexes, and
triggers.

After any fact exists, rollback fails closed. Recovery closes consumers,
preserves all constitutional facts and signatures, restores validators, replays
the latest projection, and requires a new governed successor or control fact.
History is never deleted to restore access.

If the resolver or database is unavailable, accreditation writes remain
unavailable. Rollback cannot trust headers, environment variables, compatibility
rows, cached approval, old charters, or development isolation.

## 13. Testing And Acceptance

Required deterministic scenarios:

1. three independent organizations sign an initial charter and activate it;
2. one or two approvals cannot activate;
3. duplicate participant, organization, membership, or key cannot count twice;
4. Agent, unverified actor, wrong role, unknown member, private JWK, wrong key,
   altered payload, malformed signature, and stale identity fail closed;
5. the same proposal, signatures, and decision inputs always produce the same
   proposal, attestation, quorum, decision, event, and projection roots;
6. successor activation requires both old-council and new-council quorums;
7. suspension, revocation, and expiry remove authority immediately and never
   revive an older charter;
8. revocation is terminal;
9. exact retry returns the original fact and changed retry conflicts;
10. concurrent decisions cannot fork;
11. SQL and TypeScript fact roots match and TypeScript projections replay from
    durable SQL facts;
12. canonical resolver accepts an active root member and an independently
    accredited organization, but rejects compatibility-only accreditation;
13. missing authority keys, stale membership, policy mismatch, scope mismatch,
    cross-tenant reads, direct mutation, missing event, and partial write fail;
14. migration replay and empty/non-empty rollback behave as specified.

Acceptance proves only a route-closed foundation. It does not authorize a
bootstrap ceremony, route activation, production migration, or deployment.

Focused evidence as of 2026-07-19:

- five deterministic domain scenarios pass;
- four root-governance PGlite scenarios pass, including durable old/new council
  succession;
- organization-accreditation resolver tests accept current root and canonical
  sources, reject policy substitution, and ignore compatibility approval after
  canonical suspension;
- empty rollback succeeds and non-empty rollback refuses;
- no HTTP route, scheduler, production activation, private-key path, fund path,
  token distribution, or environmental/financial claim path was added.
