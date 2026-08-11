# RFC: Trusted Device Attestation Provider Boundary

Status: IMPLEMENTED AND VERIFIED DEFAULT-OFF

Date: 2026-07-18

Production activation: CLOSED. This RFC does not mount an HTTP route, enroll a
real Apple, Android, WebAuthn, field-kit, or sensor provider, provision a
credential, trust a device, authorize evidence, or relax any downstream
review, proof, certificate, funding, token, or claims gate.

## 1. Problem Statement

CanopyProof E1 records a subject-, organization-, and consent-bound device
attestation fact. The production PostgreSQL service correctly permits callers
to record only `providerVerificationState = modeled_only`. That fact preserves
the submitted provider namespace, key commitment, receipt commitment, device
fingerprint commitment, public-key commitment, attestation commitment, risk
flags, validity interval, semantic event, and audit lineage.

The current device projection can become `current` only when the base row says
`verified`. No trusted provider adapter exists that is allowed to create such
a row. Letting an application caller set `verified`, mutating the modeled row
after a later provider check, or inserting a test-only verified row in
production would erase the trust boundary and permit self-asserted hardware
trust. It would also make the otherwise implemented E2a/E3d evidence pipeline
unreachable without bypassing its `current` device prerequisite.

## 2. Decision

Implement an additive E1a authority with four parts:

1. a strict provider-neutral signed receipt contract for a minimized device
   attestation verification result;
2. a fixed-policy adapter that validates the exact modeled E1 fact, provider,
   key, attestation, subject, consent, validity interval, nonce commitment,
   receipt hash, signer allowlist, and Ed25519 signature;
3. an immutable provider-verification fact that references the unchanged E1
   attestation root and stores no raw attestation, device identifier, nonce,
   signature, credential, certificate chain, or provider response; and
4. an effective device projection that composes E1 consent/risk/expiry state
   with the latest visible E1a verification fact at `evaluatedAt`.

The base E1 row remains `modeled_only`. Only the effective projection may
become `current`, and only when the base fact is otherwise safe and an exact,
unexpired, non-revoked E1a verification fact is visible.

## 3. Trust Model

- E1 remains authoritative for subject, organization, consent, device and key
  commitments, provider selection, risk flags, reputation, and the submitted
  validity interval.
- E1a authenticates only that a configured provider verifier accepted the
  exact committed attestation under one pinned policy and signer set.
- A provider signature authenticates receipt provenance and bytes. It does not
  prove the human's identity, physical location, sensor truth, environmental
  outcome, or freedom from compromise after verification.
- The application owns no provider private key. Tests use ephemeral fixture
  keys; production configuration may contain public verification keys only.
- Provider endpoints, signer IDs, policy roots, maximum receipt age, and
  supported provider/attestation pairs are constructor configuration, never
  command input.
- AI, device providers, and adapters cannot finalize evidence, issue an
  Environmental Proof, issue a certificate, unlock value, distribute CANOPY,
  move mainnet funds, or create a certified-credit, tax-offset, ownership, or
  guaranteed-yield claim.

## 4. Receipt Contract

The signed minimized receipt binds:

- provider, provider key ID, verifier ID/version, policy root, signer key ID,
  and signature algorithm;
- exact E1 attestation ID/root, subject ID/root, organization ID, consent
  receipt ID/root, device fingerprint hash, public-key hash, attestation hash,
  and submitted provider-receipt hash;
- a one-time challenge commitment supplied by CanopyProof, never the raw
  challenge;
- provider result `verified` or `rejected`, canonical bounded reason codes,
  verification time, and verification expiry; and
- a stable receipt hash over the normalized seed.

The Ed25519 signature covers the lowercase hexadecimal receipt hash. The
adapter rejects unknown fields and canonicalizes no untrusted value before
schema validation. Reason codes must already be sorted and unique.

The adapter returns a module-private branded value only after schema, policy,
binding, time, hash, signer, and signature verification. Copying, spreading,
serializing, or fabricating a lookalike removes the brand and cannot cross the
durable boundary.

## 5. Additive Authority Model

`identity.device_attestation_verification_facts` stores:

- organization, subject, consent, and base-attestation identifiers and roots;
- provider/verifier/signer/policy identifiers;
- challenge, provider-receipt, signed-receipt, signature, adapter-verification,
  verification-expiry, and deterministic verification roots;
- result and canonical reason codes;
- a provider-verifier agent authority snapshot;
- semantic stream sequence, previous root, command hash, command receipt, fact
  root, safety boundary, and audit root.

The fact does not store the raw signature or provider payload. It lives on the
separate stream `evidence-device-adapter:<attestationId>` and cannot modify the
base `evidence-custody:<subjectId>` stream.

The command identity binds the base attestation root, signed receipt hash,
verifier authority, and verification time. Exact `attestationId + challengeHash`
replay returns the existing fact, while a distinct challenge appends a new
historical fact. A durable unpredictable online nonce and command-idempotency
store remains an activation prerequisite.

## 6. Effective Device Projection

`effective_device_attestation_projection(attestation_id, evaluated_at)` is a
strict as-of projection. It must ignore E1a facts whose `verifiedAt` is after
`evaluatedAt` and select the latest visible fact deterministically by
verification time, stream sequence, and ID.

State precedence is:

1. consent revoked -> `consent_revoked`;
2. consent expired -> `consent_expired`;
3. base attestation expired -> `expired`;
4. any base risk flag -> `needs_review`;
5. no visible E1a fact -> `needs_review`;
6. latest E1a result rejected -> `rejected`;
7. E1a verification expired -> `verification_expired`;
8. exact visible verified E1a fact -> `current`.

The projection binds the unchanged base attestation root, consent projection
root, optional verification fact/root, state, issue codes, evaluation time,
and safety boundary. A future provider fact must never alter an older
projection root.

Downstream code must migrate to this effective projection. The legacy base
projection remains available for historical replay but cannot grant hardware
trust in production.

## 7. Data Flow

```text
modeled E1 fact + active consent
  -> generate hash-only challenge commitment
  -> invoke fixed provider verifier outside every database transaction
  -> strict minimized receipt validation
  -> receipt hash and Ed25519 verification
  -> minimize and remove raw signature
  -> append E1a verification fact in SERIALIZABLE transaction
  -> derive effective device projection
  -> E2 upload/effective-media prerequisite
```

No provider call may occur inside a database transaction. Before commit, the
repository reloads the current base attestation, consent projection, actor,
provider-verifier agent authority, and existing command receipt. SQL triggers
independently recompute all roots and bindings.

## 8. API Design

The route-closed domain boundary exposes:

- `verifyAttestation(attestation, context)` on the fixed adapter;
- `commitVerification(receipt, organizationId, verifierAgentId)` on the durable
  repository;
- `findVerification(attestationId, organizationId, challengeHash)` for exact
  challenge replay; and
- `getEffectiveDeviceAttestationProjection(attestationId, organizationId,
  evaluatedAt)` for downstream authority.

An internal orchestrator may load E1, call the provider outside a transaction,
minimize the verified receipt, and commit E1a. It reports
`routeMounted: false` and `productionActivated: false`. No public route or
composition-root selection is added by this RFC.

## 9. Threat Model

The implementation must reject:

- caller-asserted `verified`, copied private brands, fabricated receipts, or a
  base-row update;
- wrong subject, organization, consent, attestation, fingerprint, public key,
  provider receipt, provider, key, verifier, policy, signer, or challenge;
- unsupported provider/attestation-type combinations;
- receipt replay against another device or tenant;
- stale, future, non-canonical, inverted, or excessively long verification
  intervals;
- signature substitution, malleable encoding, private JWK material, duplicate
  signer IDs, empty signer policy, and key-ID aliasing;
- future-fact leakage into historical projections;
- consent revocation, base expiry, verification expiry, rejection, or risk
  flags being projected as current;
- cross-tenant reads/writes, RLS bypass by the application role, update/delete,
  missing semantic events, missing command receipts, and SQL/TypeScript root
  disagreement;
- provider outage or malformed output being represented as success; and
- raw device identifiers, attestation objects, certificates, signatures,
  challenges, credentials, secrets, URLs, or arbitrary provider messages in
  durable facts, audit events, logs, or errors.

## 10. Database Changes

The additive migration must provide:

- `identity.device_attestation_verification_facts` with exact checks and
  foreign keys to the modeled E1 fact and verifier participant;
- one immutable semantic stream and hashed command receipt per fact;
- deterministic SQL helpers for receipt binding, verification root, command
  hash, fact root, and effective projection root;
- recursive forbidden-key checks and exact JSON allowlists;
- append-only update/delete triggers and database mutation audit;
- organization-scoped row-level security with `FORCE ROW LEVEL SECURITY`;
- idempotent migration execution; and
- a rollback that succeeds only when the new authority is empty.

Existing E1 rows are never backfilled, promoted, or rewritten.

## 11. Migration Strategy

1. Ship this RFC and strict adapter contract with deterministic fixture tests.
2. Ship E1a fact/projection logic and replay tests.
3. Ship the additive SQL migration, Prisma repository, PGlite/native parity,
   RLS, append-only, concurrency, and rollback tests.
4. Migrate E2/effective-media consumers to the effective device projection,
   retaining historical base-projection replay tests.
5. Keep the orchestrator and all provider adapters absent from the production
   composition root.
6. Before activation, approve one provider's protocol validation, public-key
   ceremony, attestation challenge issuance, nonce replay store, revocation
   feeds, privacy/data-residency policy, outage behavior, monitoring, support,
   incident response, and field-device compatibility.

## 12. Rollback Strategy

- Disable the future composition-root selection and revoke provider network
  access.
- Preserve all E1 and E1a append-only facts and project affected devices as
  `needs_review`, `verification_expired`, or `rejected`.
- Never delete verification failures or mutate E1 to manufacture a result.
- The migration rollback may remove schema objects only when no E1a fact
  exists. Once facts exist, rollback must fail closed and remediation must be a
  forward migration or governed supersession.

## 13. Acceptance Gates

- Deterministic fixture receipts only; no live provider API or production
  credential.
- Same normalized inputs produce identical receipt, adapter, verification,
  event, command, fact, projection, and audit roots.
- Signature, binding, expiry, rejection, future-fact, revocation, risk,
  replay, RLS, append-only, and rollback attacks fail closed.
- Provider I/O occurs outside transactions and outage commits no verification
  fact.
- E1 remains modeled-only and E1a remains non-final authority.
- Route, composition root, and production activation remain closed.

## 14. Implementation Checkpoint

Implemented and locally verified on 2026-07-18:

- strict fixture-only Apple App Attest, WebAuthn, Android key-attestation,
  manual field-kit, and sensor-gateway provider/type policy boundaries;
- Ed25519 public-key verification, private-JWK rejection, runtime branding,
  raw-signature minimization, exact binding, canonical time, and bounded
  receipt-lifetime checks;
- an additive E1a fact authority with deterministic adapter, verification,
  command, fact, event, and projection roots while every base E1 row remains
  `modeled_only`;
- exact challenge replay, separately appendable renewal challenges, serializable
  writes, advisory locks, unique challenge enforcement, forced organization
  RLS, mutation audit, append-only triggers, and non-empty rollback refusal;
- strict as-of effective device projections covering pending, rejection,
  consent revocation/expiry, base expiry, verification expiry, and device-risk
  states;
- E1a integration into media intent, effective media v2, E3b, E3c, E3d, E4,
  and mobile authority reads, with historical base projection retained only for
  replay; and
- deterministic/adversarial unit coverage plus an executed 17-test PGlite
  database gate covering SQL/TypeScript root parity, restart replay, tenant
  isolation, append-only enforcement, migration idempotency, and rollback.

The native PostgreSQL migration list now includes E1a, but this checkpoint does
not claim that the opt-in disposable native gate was executed. Production
activation remains closed because there is no durable unpredictable online
nonce store, live Apple/WebAuthn/Android protocol validator, provider
revocation feed, approved public-key ceremony, provider endpoint or credential,
production composition root, mounted route, monitoring, incident runbook, or
field-device validation. No trust, proof, certificate, claim, token, funding,
or mainnet gate was opened.
