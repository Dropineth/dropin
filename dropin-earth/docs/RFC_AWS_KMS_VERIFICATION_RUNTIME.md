# RFC: AWS KMS Managed Signature Verification Runtime

Status: ACCEPTED FOR DEFAULT-OFF NON-PRODUCTION IMPLEMENTATION

Date: 2026-07-17

Production activation: CLOSED. This RFC does not mount a route, select a
verifier from environment variables, provision credentials, call `Sign`, or
authorize Environmental Proof Record issuance.

## 1. Problem Statement

The Environmental Proof lifecycle authority already requires an external
managed-key attestation and a detached-signature verification receipt before a
record can become valid. Tests currently satisfy that port with deterministic
fakes. Without a concrete provider boundary, the repository cannot prove that a
runtime verifier uses one fixed managed key, validates its public material and
purpose, sends the exact lifecycle digest to the provider, or fails without
leaking credentials and provider responses.

This increment adds an AWS KMS verification-only boundary. It does not create,
rotate, sign with, disable, or delete a key. It also does not change the human
issuer, independent governance, MRV lineage, challenge, monitoring, expiry, or
revocation requirements enforced by the lifecycle authority.

## 2. Decision

Implement a constructor-only `AwsKmsManagedSignatureVerifier` that satisfies
`CanopyProofEnvironmentalProofManagedSignatureVerifier` and is absent from the
API composition root.

The verifier shall:

1. derive one regional AWS KMS endpoint from fixed configuration;
2. accept only one full asymmetric key ARN, one organization, and one local
   governance `keyVersion` label;
3. call `GetPublicKey` for key attestation and before every `Verify` call;
4. require `SIGN_VERIFY`, the protocol-compatible key spec, the expected
   signing algorithm, an exact key ARN, and an exact SHA-256 SPKI hash;
5. call only AWS KMS `Verify`, never `Sign`;
6. send the 32-byte lifecycle `signaturePayloadHash`, not its hexadecimal text;
7. require a positive, key-bound, algorithm-bound provider response; and
8. return only opaque deterministic receipt hashes plus a bounded local
   verification timestamp.

## 3. Trust Model

- AWS account, partition, Region, key ARN, organization, governance key
  version, credentials, request deadline, and clock are operator-selected
  configuration. A command cannot override them.
- The key ARN is immutable input to both provider calls. Aliases and bare key
  identifiers are forbidden because they can be retargeted or are ambiguous.
- `GetPublicKey` is the provider observation for public material, key usage,
  key spec, and supported algorithms. Its DER-encoded SPKI is hashed locally.
- `keyVersion` is a CanopyProof governance label fixed in configuration. AWS
  KMS does not return a separate asymmetric key-version attestation, so the
  value must never be presented as an AWS-native version fact.
- `providerAttestationHash` binds the normalized AWS response and the fixed
  governance key-version label. A caller cannot supply an unrelated provider
  document hash.
- AWS request identifiers are treated as provider correlation evidence. Raw
  identifiers, responses, public-key bytes, credentials, and signatures are
  not stored in lifecycle facts; only domain-separated hashes are returned.
- Local time is not an AWS trusted timestamp. Key attestation returns the
  command timestamp only after a bounded comparison with the injected runtime
  clock. Signature verification returns that runtime clock instant.
- KMS verification proves possession of the private key for one digest and
  algorithm. It does not prove environmental truth, auditor independence,
  certificate eligibility, carbon-credit status, tax treatment, financial
  value, or yield.

## 4. Algorithm Contract

The existing protocol labels map as follows:

| Protocol | AWS key spec | AWS signing algorithm | AWS message type |
| --- | --- | --- | --- |
| `ES256` | `ECC_NIST_P256` | `ECDSA_SHA_256` | `DIGEST` |
| `RSA_PSS_SHA256` | `RSA_2048`, `RSA_3072`, or `RSA_4096` | `RSASSA_PSS_SHA_256` | `DIGEST` |
| `Ed25519` | `ECC_NIST_EDWARDS25519` | `ED25519_SHA_512` | `RAW` |

For `ES256` and RSA-PSS, AWS receives the 32-byte SHA-256 digest with
`MessageType = DIGEST`. For Ed25519, AWS requires `RAW`; the exact same 32-byte
CanopyProof digest is therefore the Ed25519 message. A later signing service
must use the same mapping. ECDSA signatures remain provider-native DER bytes,
encoded as canonical unpadded base64url in the lifecycle command.

## 5. Data Flow

### 5.1 Managed-Key Attestation

1. Parse and normalize the lifecycle request without accepting unknown fields.
2. Match provider, organization, full key ARN, key version, algorithm, and
   purpose against fixed configuration.
3. Require the canonical command timestamp to be within the configured clock
   skew.
4. SigV4-sign and send `TrentService.GetPublicKey` to the derived KMS endpoint.
5. Bound and validate the response and provider request identifier.
6. Require the exact ARN, `SIGN_VERIFY`, compatible key spec, expected signing
   algorithm, and expected SPKI hash.
7. Recompute and compare `providerAttestationHash`.
8. Return deterministic receipt hashes and the command timestamp.

### 5.2 Detached-Signature Verification

1. Parse the request and enforce the same fixed bindings.
2. Reject a signing timestamp beyond the permitted local-clock skew.
3. Repeat `GetPublicKey`; do not trust a process cache or an earlier mutable
   command as proof of current provider state.
4. Decode the digest and canonical unpadded base64url signature into bytes.
5. SigV4-sign and send `TrentService.Verify` with the exact key ARN, message,
   signature, signing algorithm, and message type.
6. Require HTTP 200, exact response key and algorithm, and
   `SignatureValid = true`.
7. Hash both provider request identifiers and the normalized request/response
   evidence into the external receipt.

## 6. Threat Model

The runtime must reject:

- caller-selected endpoint, Region, account, key, alias, version, purpose,
  organization, algorithm, credential, header, or request target;
- malformed, cross-account, cross-Region, wrong-partition, alias, or bare key
  identifiers;
- encryption-only keys, unsupported key specs, algorithm substitution, public
  key substitution, non-canonical base64, malformed digest, oversized
  signature, and negative verification;
- redirects, compressed responses, wrong media type, misleading content
  length, streamed response overflow, timeout, malformed JSON, missing request
  identifier, or unexpected provider fields required by the contract;
- stale or future command timestamps outside the configured skew;
- caught errors that expose authorization headers, access keys, session tokens,
  key identifiers, signatures, provider bodies, endpoint URLs, or exception
  messages; and
- provider outage falling back to a locally asserted successful receipt.

Errors use stable `CANOPYPROOF_AWS_KMS_*` codes branded with a module-private
symbol. A dependency cannot forge the brand by copying the public error name.

## 7. Runtime API

Configuration contains:

- fixed AWS account, partition, Region, full key ARN, governance key version,
  organization, access key, secret, optional session token, timeout, response
  byte bound, clock-skew bound, clock, and optional injected `fetch` transport;
- no signing permission, private key, caller-selected endpoint, retry loop, or
  mutable key registry; and
- zero automatic environment-variable discovery.

The IAM principal for a later deployment must be limited to
`kms:GetPublicKey` and `kms:Verify` on the exact key ARN. The implementation has
no method capable of invoking `Sign`.

## 8. Database Changes

None. Existing append-only signing-key attestation and signature-receipt facts
remain authoritative. Credentials, raw AWS response bodies, raw request IDs,
public-key bytes, and authorization headers are not persisted.

## 9. Migration Strategy

1. Add the constructor-only verifier and deterministic mock-transport tests.
2. Prove fixed destination, key/algorithm/public-key binding, timestamp bounds,
   positive verification, response bounds, and secret-free errors.
3. Run lifecycle authority, PostgreSQL, coverage, audit, and OpenNext gates.
4. Add a separately reviewed non-production composition root and least-
   privilege credential only after Security and Governance approval.
5. Attest a new managed key through the existing append-only authority; never
   rewrite fake or historical key facts as provider-verified.
6. Require operational monitoring and CloudTrail retention before any
   production activation decision.

## 10. Rollback Strategy

- Remove or disable the later composition-root selection and revoke its IAM
  credential.
- Preserve all append-only key, signature, lifecycle, challenge, and audit
  facts.
- Mark affected records unverifiable, suspended, or expired through existing
  governed transitions; do not delete or rewrite receipts.
- Never fall back to a fake verifier, local success assertion, signing-capable
  credential, or caller-supplied key.

Before composition-root activation, rollback is code removal only.

## 11. Acceptance Gates

- Tests perform no real AWS call and use no real credential.
- Only `GetPublicKey` and `Verify` request targets are reachable.
- Same request, clock, provider response, and request identifiers produce the
  same external receipt hashes.
- Key ARN, version, organization, purpose, public-key hash, key usage, key spec,
  signing algorithm, digest, signature, and provider response substitution all
  fail closed.
- Timeout, redirect, compression, malformed or oversized response, missing
  request ID, and forged error name fail with stable secret-free codes.
- Existing lifecycle, CI, coverage, audit, and OpenNext gates remain green.
- Routes and production activation remain unchanged.

## References

- [AWS KMS GetPublicKey API](https://docs.aws.amazon.com/kms/latest/APIReference/API_GetPublicKey.html)
- [AWS KMS Verify API](https://docs.aws.amazon.com/kms/latest/APIReference/API_Verify.html)
- [AWS KMS asymmetric key specifications](https://docs.aws.amazon.com/kms/latest/developerguide/symm-asymm-choose-key-spec.html)
- [AWS KMS endpoints](https://docs.aws.amazon.com/kms/latest/developerguide/accessing-kms.html)
