# RFC: Signed Evidence Metadata Extraction Adapter

Status: ACCEPTED; DEFAULT-OFF DOMAIN/SQL BOUNDARY IMPLEMENTED; COMPOSITION CLOSED

Date: 2026-07-17

Production activation: CLOSED. This RFC does not mount a route, configure a
live parser, grant an extractor access to object storage, provision a signer,
or authorize metadata for final proof.

## 1. Problem Statement

The E3b metadata-retention authority records minimized EXIF and GPS
commitments, consent/device bindings, issue bands, retention decisions, and
append-only audit events. Its PostgreSQL contract intentionally permits only
`providerVerificationState = modeled_only`. The domain boundary now rejects a
caller-supplied verified E3b receipt as well; verification must cross a
cryptographically authenticated provider boundary and enter durable history as
a separate additive fact.

Relaxing the E3b table to accept a shape-compatible `verified` object would let
application or database callers promote untrusted extractor output into
accepted evidence. Rewriting the original E3b fact after later verification
would also destroy the historical distinction between receipt arrival and
receipt authentication.

## 2. Decision

Implement a default-off four-part boundary:

1. a strict `CanopyProofMetadataExtractorPort` for one minimized provider
   receipt;
2. a policy adapter that validates object/consent/device lineage, freshness,
   output minimization, receipt hash, approved Ed25519 signer, and signature;
3. an append-only E3c verification fact referencing the unchanged modeled E3b
   extraction fact; and
4. a deterministic projection that combines the base extraction with its
   additive verification fact.

The E3b durable table remains modeled-only. Verification never mutates or
relabels the base extraction. Only the E3c projection may remove
`metadata_provider_verification_pending`, and it may do so only for the exact
receipt, extraction root, object root, policy root, signer key, and signature
hash committed by the verification fact.

## 3. Trust Model

- Account/storage namespace, extractor endpoint, extractor identifier, parser
  image digest, policy root, signer registry, response bounds, clock policy,
  and service credential are operator configuration. Commands cannot override
  them.
- The extractor receives an immutable object locator and hash-only authority
  context. It receives no upload grant, storage credential, raw registered GPS,
  contributor identity, free-form note, final decision, or financial context.
- The provider receipt may contain only minimized commitments, categorical
  quality bands, timestamps, parser identity/version, and an Ed25519 signature.
  Raw EXIF, raw GPS, coordinates, geometry, filenames, device identifiers,
  credentials, and arbitrary findings are forbidden by a strict schema.
- A valid signature authenticates the receipt producer and bytes. It does not
  prove that EXIF is truthful, GPS is genuine, the device was uncompromised, or
  an environmental claim is correct.
- Media must already project as `available`, consent as `active`, and device
  attestation as `current` before the verified adapter can invoke the parser.
  This prevents parsing quarantined, malicious, revoked, or stale media.
- AI and extractor services cannot approve evidence. Effective acceptance still
  depends on canonical custody, quality bands, policy, and human review rules.

## 4. Additive Data Flow

```text
verified media object + active consent + current device
  -> fixed minimized extractor request
  -> signed minimized provider receipt
  -> strict receipt/hash/signature verification
  -> modeled-only E3b extraction fact (immutable)
  -> E3c extraction-verification fact (immutable)
  -> deterministic effective extraction projection
  -> human evidence review
```

The base extraction stores the provider receipt hash and the existing
`metadata_provider_verification_pending` issue. The E3c fact stores no raw
signature. It stores the receipt hash, signer key identifier, signature
algorithm, signature hash, extractor policy root, verifier identity,
verification time, and deterministic verification root.

## 5. Receipt Contract

The signed receipt binds:

- object ID/root, storage provider/namespace, object key/version, and stored-
  object provider receipt hash;
- consent and device projection roots used at extraction time;
- registered GPS hash and privacy mode;
- extractor ID/name/version, pinned image digest, and metadata schema version;
- EXIF hash, GPS hash, minimized metadata output root, permitted location
  disclosure commitment, accuracy band, clock-skew band, observed time, and
  extraction time; and
- signer key ID and signature algorithm.

`receiptHash` is the stable SHA-256 hash of this normalized seed. The Ed25519
signature covers the lowercase hexadecimal receipt hash. Finding lists and
algorithm lists are deduplicated and sorted before hashing.

The adapter verification root binds the receipt hash, exact E3b extraction
root, object root, extractor/verifier ID, signer key ID, extractor policy root,
signature hash, and verification time.

## 6. Runtime Boundary

The optional fixed HTTP transport:

- accepts one public HTTPS endpoint selected at construction;
- rejects credentials in URLs, redirects, non-default ports, IP literals,
  localhost/private suffixes, query strings, fragments, and path traversal;
- posts one strict JSON object containing only immutable locators, hashes,
  categorical privacy state, and a correlation ID;
- disables redirects, credentials, referrers, and caches;
- enforces a bounded timeout, uncompressed JSON, declared/actual byte parity,
  and a streamed response ceiling; and
- returns parsed `unknown` to the policy adapter. It cannot brand or persist a
  receipt by itself.

The implementation does not parse EXIF or access R2. It is an isolated provider
boundary for a later sandboxed parser service.

## 7. Threat Model

The system must reject:

- caller-selected endpoints, object paths, storage namespaces, parser images,
  policy roots, signer keys, or credentials;
- metadata extraction before clean-media, active-consent, and current-device
  authority;
- object, receipt, consent, device, GPS, privacy, parser, schema, timestamp, or
  output-root substitution;
- raw EXIF/GPS/coordinates, precise-location leakage, arbitrary nested fields,
  unsupported public claims, secrets, URLs, or private key material;
- duplicate or unapproved signer keys, invalid/non-canonical Ed25519 signatures,
  stale/future receipts, receipt replay against another extraction, and copied
  private-brand properties;
- redirects, compression, wrong content type, malformed JSON, deceptive content
  length, streamed overflow, timeout, and provider exception leakage; and
- provider outage or malformed output falling back to `verified`.

All runtime failures use stable `CANOPYPROOF_METADATA_EXTRACTOR_*` codes. Error
trust uses module-private symbols, not forgeable public names.

## 8. Database Design

Add one route-closed table:

`evidence.metadata_extraction_verification_facts`

It contains tenant/project/evidence/object/extraction identifiers and roots,
verifier actor, receipt/signer/policy/signature/verification roots, sequence,
command hash, immutable fact JSON, and audit-event root.

Required controls:

- organization RLS with `FORCE ROW LEVEL SECURITY`;
- append-only update/delete trigger;
- exact JSON allowlist and forbidden-key recursion;
- foreign keys to the exact E3b extraction and verifier participant;
- SQL recomputation of verification root and TypeScript fact roots;
- one verification per extraction root;
- separate `evidence-metadata-adapter:<evidenceId>` semantic stream;
- hashed idempotent command receipts; and
- database mutation audit.

No existing E3b fact or table is rewritten. The migration is additive.

## 9. Projection Rules

- No E3c fact: `verificationState = modeled_only`; preserve all E3b issues.
- Current valid E3c fact: `verificationState = verified`; remove only
  `metadata_provider_verification_pending`.
- Any remaining custody, device, accuracy, or clock issue keeps effective state
  `needs_review`.
- Zero remaining issues permits `accepted` as an effective projection only; it
  does not rewrite the base E3b `extractionState`.
- Missing, duplicate, cross-tenant, stale-root, or tampered verification facts
  fail replay rather than degrading silently.

## 10. Migration Strategy

1. Add strict adapter contracts, deterministic mock transport, and private
   runtime brands.
2. Add E3c fact/projection logic and replay tests.
3. Add the append-only SQL/repository contract and PGlite/native PostgreSQL
   execution evidence.
4. Keep existing modeled E3b rows unchanged; do not backfill them as verified.
5. Build a route-closed orchestrator that performs external I/O outside every
   database transaction and commits base plus verification facts separately.
6. Before activation, approve parser image/SBOM, storage capability, signer
   ceremony, receipt retention, privacy policy, egress, resource limits,
   observability, staffed exception review, and incident response.

## 11. Rollback Strategy

- Disable or remove the later composition-root selection and revoke parser
  storage access, service credential, and signer key.
- Preserve E3b and E3c append-only facts and project affected extractions as
  needs-review through the current trust projection.
- Do not delete verification failures, mutate base facts, synthesize a modeled
  success, or re-enable caller-supplied verified state.

Before route activation, rollback is code removal only.

## 12. Acceptance Gates

- No real media, provider, credential, object-store access, or network call is
  used by tests.
- Plain, spread, serialized, cross-object, stale, or forged verified receipts
  cannot create an E3c fact.
- Raw metadata and raw signatures never enter durable facts or SQL.
- Same base fact, receipt, signer, policy, and time produce identical receipt,
  verification, fact, audit, and projection roots.
- SQL and TypeScript recompute the same roots and reject mutation, cross-tenant
  access, duplicate verification, and idempotency conflict.
- Provider calls occur outside transactions and outage creates no durable fact.

## 13. Implementation Checkpoint

Implemented and locally verified on 2026-07-17:

- strict receipt schema, fixed-policy port, private runtime branding, canonical
  receipt hashing, public-key-only Ed25519 verification, and a fixed bounded
  HTTPS transport;
- additive E3c fact and effective-projection logic that preserve immutable
  modeled-only E3b ancestry and remove only the provider-pending issue;
- idempotent append-only SQL, recursive safety allowlists, forced RLS,
  SQL/TypeScript root parity, database audit binding, and non-empty rollback
  refusal; and
- signed-fixture, forgery, substitution, minimization, transport-abuse,
  deterministic replay, and PGlite migration/projection tests.

The governed effective-media projection, append-only pre-I/O request fact,
Prisma repository, and resumable route-closed orchestration are now implemented
under `RFC_EFFECTIVE_MEDIA_PROJECTION_AND_METADATA_ORCHESTRATION.md`. They do
not mutate E1 or E3b and do not claim exactly-once provider execution.

Intentionally not implemented are a production composition root, route, live
parser image, object-store grant, credential, signer operation, queue, or
production external call. Default-off E1a now creates a `current` effective
device projection from independently signed fixture receipts without promoting
the E1 row. Live provider protocols, nonce/replay storage, revocation feeds,
approved key operations, monitoring, and production composition remain absent;
that prerequisite remains fail-closed and must not be weakened or bypassed.
- Existing CI, coverage, audit, PostgreSQL, and OpenNext gates remain green.
- Route and production activation state remain unchanged.
