# RFC: Encrypted Mobile Evidence Offline Client

Date: 2026-07-17

Status: local implementation complete and verified; production sync activation denied

Owners: CanopyProof Evidence Network, Trust Kernel, Security, Field Operations

## Decision

The `/mobile/report` client will replace its plaintext `localStorage` queue with
an encrypted IndexedDB vault. Draft payloads will be encrypted with AES-256-GCM
through Web Crypto using a non-extractable, origin-bound key stored as a
structured-clone `CryptoKey` in IndexedDB. The browser will preserve stable
record identifiers and idempotency keys across retries, but it will not hold a
private signing key, provider credential, or final verification authority.

The client and its storage migration may ship while the production sync route
remains closed. A route may open only after the server can derive and revalidate
the authenticated actor, organization, membership, project, consent, device,
and evidence-registration authority inside the same serializable transaction as
the append-only E4 bundle commit.

## Implementation Conformance

The local implementation now includes the shared strict schema, WebCrypto vault,
IndexedDB adapter, fail-closed UI states, atomic legacy migration, deterministic
security tests, and real OpenNext/browser persistence verification described by
this RFC. Production synchronization, server authority binding, field-device
recovery, time-based retention, and route activation remain deliberately absent.
The local implementation does not issue proof, move funds, or create a public
claim.

## Problem

At RFC approval time, the browser prototype stored precise coordinates, field notes, device
fingerprint hashes, EXIF hashes, media hashes, and idempotency keys as plaintext
JSON in `localStorage`. It has no bounded lease/retry state, no authenticated
sync, no tamper-detecting envelope, and no explicit recovery behavior. This is
not an acceptable offline-first boundary for community or institutional field
evidence.

The durable E1-E4 server authorities already model consent, device attestation,
media custody, human review, minimized metadata, atomic offline batches, and
non-final community context. The client must consume those authorities without
creating a parallel proof path or accepting authority facts from the browser.

## Scope

This RFC covers:

- encrypted browser persistence for bounded evidence drafts;
- deterministic draft payload normalization and hashing;
- queue, lease, retry, acknowledgement, rejection, and recovery states;
- migration away from the legacy plaintext queue;
- the authenticated sync command boundary required by E4;
- client and server failure behavior;
- security, privacy, testing, and production activation gates.

This RFC does not:

- call a real media, satellite, device-attestation, or scanner provider;
- upload media bytes before an E2 object-storage grant exists;
- make community context final verification;
- issue an Environmental Proof Record or certificate;
- handle a wallet, private key, fund movement, or automatic CANOPY distribution;
- authorize a certified carbon-credit, tax-offset, or guaranteed-yield claim.

## Trust Model

### Browser

The browser is an untrusted capture and transport client. It may propose raw
observations and preserve retry identity. It cannot assert organization status,
membership, consent validity, device validity, project authority, evidence
roots, reviewer status, verification state, or audit facts.

AES-GCM protects data at rest from casual disk/profile inspection and detects
envelope tampering. It does not defend against active same-origin JavaScript,
browser compromise, malicious extensions, screen capture, or an already
unlocked operating-system account. Content Security Policy, dependency control,
session security, and device operations remain independent controls.

### API

The API authenticates a verified principal and binds it to an active durable
membership. It treats all client fields as untrusted input, accepts only
reference identifiers and bounded capture values, and resolves current source
authority itself. It never accepts an actor snapshot, organization root,
membership root, consent projection, device projection, project root, evidence
root, verification state, audit event, or E4 fact record from the client.

### PostgreSQL

PostgreSQL is the final authority for accepted offline-bundle facts. The write
uses one `SERIALIZABLE` transaction, tenant context, transaction advisory locks,
exact idempotency receipts, immutable fact tables, forced RLS, semantic event
lineage, and database mutation audit. Process memory is not a fallback.

## Client Architecture

```text
Field form
  -> strict normalization
  -> payloadHash (SHA-256)
  -> AES-256-GCM envelope
  -> IndexedDB vault
  -> eligible outbox projection
  -> authenticated sync transport
  -> durable E4 receipt
  -> encrypted acknowledgement update
```

The implementation separates:

1. a pure draft schema and canonical serializer;
2. an encrypted vault service;
3. an IndexedDB storage adapter;
4. an injected sync transport;
5. a React presentation component.

The React component does not call IndexedDB or Web Crypto directly. This keeps
cryptographic and queue invariants testable without rendering and keeps storage
failures explicit in the UI.

## Cryptographic Envelope

### Key

- Algorithm: AES-GCM, 256-bit.
- Generation: `crypto.subtle.generateKey` with `extractable: false`.
- Usage: `encrypt`, `decrypt` only.
- Storage: IndexedDB structured clone in a dedicated key store.
- Key identifier: deterministic local metadata for version selection, not a
  secret and not an authority identity.
- Export: prohibited. No raw key bytes, mnemonic, private key, or recovery
  secret are written to storage or logs.

### Record encryption

- A fresh 96-bit IV is generated for every encryption.
- Additional authenticated data binds the envelope version, record ID, key ID,
  and payload schema version.
- Ciphertext contains the complete normalized draft, queue state, attempt
  metadata, stable idempotency key, and server acknowledgement if present.
- The outer IndexedDB record contains only the record ID, envelope/key versions,
  IV, ciphertext, and bounded non-sensitive storage metadata required to select
  the key.
- Decryption revalidates the payload schema and verifies that the decrypted ID
  matches the outer record ID.

The implementation must never reuse an IV with the same key. `Math.random`,
timestamps, counters, and device fingerprints are forbidden as IV entropy.

## Draft Data Model

The normalized encrypted payload contains:

```text
id
schemaVersion
evidenceType
projectId
observedAt
latitude
longitude
gpsAccuracyMeters
mediaHash
deviceFingerprintHash
exifHash | null
notes | null
payloadHash
idempotencyKey
state
attemptCount
createdAt
updatedAt
nextAttemptAt | null
leaseExpiresAt | null
serverBinding | null
acknowledgement | null
lastErrorCode | null
```

Coordinates and accuracy are capture claims, not verified location. They remain
encrypted locally and may be sent only to the authenticated evidence intake
path. Public projections must use the separate privacy-minimization authority.

`payloadHash` binds normalized capture content and never includes mutable queue
state. `idempotencyKey` is created once and remains unchanged across retries.

## Queue State Machine

```text
draft_queued
  -> blocked_prerequisites
  -> ready_to_sync
  -> sync_leased
  -> acknowledged
  -> rejected
```

- `draft_queued`: locally valid capture, not yet authority-bound.
- `blocked_prerequisites`: missing authenticated session, E1 consent/device, E2
  media registration, or project/evidence binding.
- `ready_to_sync`: all server-issued references exist.
- `sync_leased`: bounded local lease prevents duplicate concurrent sends.
- `acknowledged`: exact durable command receipt was verified and stored.
- `rejected`: terminal server validation outcome; the local record is retained
  for operator review until an explicit deletion decision.

Network errors and 5xx responses return a lease to `ready_to_sync` with bounded
exponential backoff and jitter from `crypto.getRandomValues`. Authentication,
authorization, source-authority, idempotency-conflict, and validation failures
do not retry blindly.

The hot path does not allocate unbounded arrays. Batch size is at most 100, and
the local vault enforces an explicit record and byte quota. Quota exhaustion is
reported; records are never silently evicted.

## Sync Command Boundary

The proposed route is route-closed until all activation gates pass:

```text
POST /canopyproof/evidence/offline-bundles
Authorization: authenticated CanopyProof principal
Idempotency-Key: stable client key
```

Permitted client fields are limited to:

- device-attestation reference ID;
- client batch ID, device sequence, previous batch root;
- capture interval and connectivity classification;
- ordered client record IDs and evidence-registration reference IDs;
- client payload hashes.

The route derives all tenant and authority facts. Within the same serializable
transaction it must:

1. bind the authenticated principal to a current active membership;
2. resolve the organization and project;
3. resolve current consent and device projections at `receivedAt`;
4. resolve every evidence registration and current root;
5. reject cross-tenant, cross-project, contributor, device, consent, sequence,
   chronology, or payload-hash substitution;
6. derive E4 facts through the domain service;
7. commit batch, items, semantic event, and exact command receipt atomically;
8. return a bounded receipt projection without raw coordinates, notes, media,
   actor snapshots, or internal roots not required by the client.

The existing compatibility `/canopyproof/evidence/sync-batches` handler is not
this route and cannot be enabled as a production fallback.

## Threat Model

| Threat | Required control |
| --- | --- |
| Plaintext profile theft | AES-GCM encrypted payload; non-extractable key |
| Ciphertext/IV/AAD mutation | GCM authentication failure; record rejected |
| Same-origin XSS | CSP, dependency integrity, no claim that local encryption stops active XSS |
| Malicious extension or compromised OS | Explicit residual risk; field-device operational controls |
| IV reuse | 96-bit CSPRNG IV for every write; no deterministic IV |
| Replay or duplicate send | Stable idempotency key, device sequence, previous batch root, exact receipt |
| Concurrent tabs | IndexedDB transaction plus bounded sync lease; server remains authoritative |
| Clock manipulation | Server-provided `receivedAt`; bounded chronology checks; client time never final |
| GPS spoofing | Capture claim only; device/EXIF/provider checks and human review |
| Payload substitution | Canonical payload hash, GCM AAD, evidence registration and server source re-resolution |
| Cross-tenant substitution | Authenticated binding, transaction tenant context, forced RLS |
| Quota/storage eviction | Explicit quota error and persistence-status warning; no silent success |
| Key loss/corruption | Fail closed; user-authorized local reset; no hidden escrow |
| Service worker compromise | Same-origin threat; version pinning, CSP and deployment integrity review |
| Offline brute-force guessing | High-entropy generated key; no user-derived weak passphrase |
| Secret leakage | No provider credentials, bearer tokens, private keys, raw key export, or secret logs |

## Legacy Migration

The legacy key is `canopyproof.mobileEvidenceDrafts.v1`.

1. Detect but do not render legacy plaintext values in diagnostics.
2. Strictly validate each bounded legacy draft.
3. Normalize and encrypt valid records before opening an IndexedDB write
   transaction.
4. Atomically write all valid encrypted envelopes and a migration marker.
5. Re-read and decrypt the committed records.
6. Delete the plaintext key only after verification succeeds.
7. If any record is invalid or storage fails, leave the original key untouched,
   write no partial migration marker, and show an explicit recovery state.

Migration is idempotent. It never uploads records and never treats migrated
drafts as verified. A later release removes migration code only after telemetry
shows the migration window is closed and governance approves deletion.

## Recovery and Deletion

If the key cannot be loaded or a record cannot be authenticated, the vault
enters `recovery_required`; it does not return an empty queue that could be
mistaken for successful deletion. Recovery options are:

- retry after transient storage availability returns;
- export only an encrypted diagnostic manifest containing IDs and error codes;
- explicitly erase the local vault after a human confirmation.

There is no server or operator key escrow in this phase. Deletion is local and
does not delete durable server facts or audit history.

## Migration and Rollback Strategy

The change is additive and client-side:

1. ship the vault schema and read-only migration detection;
2. validate encryption, tamper, quota, multi-tab and legacy migration tests;
3. switch `/mobile/report` writes to IndexedDB;
4. preserve the production sync route as closed;
5. remove plaintext only after encrypted re-read succeeds.

Rollback must not restore plaintext writes. A rollback may disable capture and
show a maintenance/recovery state while retaining the encrypted IndexedDB data.
It may not copy decrypted payloads back to `localStorage`, log them, silently
discard them, or route them through the process-memory compatibility service.

## Observability and Privacy

Allowed telemetry is limited to counts, bounded latency histograms, state/error
codes, envelope version, and storage availability. Logs and metrics must not
contain coordinates, notes, media hashes, device fingerprints, EXIF hashes,
idempotency keys, ciphertext, IVs, actor identifiers, or project identifiers.

Required signals include queue depth buckets, encryption/decryption failures,
migration outcome, quota errors, lease expiry, sync retry class, and durable
acknowledgement latency. Raw field values are never analytics events.

## Verification Plan

Unit tests must prove:

- canonical payload and hash determinism;
- ciphertext does not contain plaintext fields;
- repeated writes use different IVs;
- AAD, IV, ciphertext, ID and payload tampering fail closed;
- exact idempotency key preservation across retry;
- state transition, lease and backoff invariants;
- bounded quota behavior without silent eviction;
- valid legacy migration and failed atomic migration behavior;
- key loss produces `recovery_required`, not an empty queue.

Browser tests must prove:

- IndexedDB persists across reload;
- no legacy or new plaintext evidence key remains in `localStorage` after a
  successful migration;
- offline capture works with network disabled;
- mobile layout exposes loading, unavailable, queued, blocked, retrying,
  acknowledged and recovery states without hydration mismatch;
- two tabs cannot concurrently claim the same lease;
- storage denial/quota failure is visible and preserves existing records.

Server integration and security tests must prove authenticated RBAC, source
re-resolution, cross-tenant denial, exact/conflicting retries, sequence and
lineage checks, partial-write rollback, restart replay, forced RLS, immutable
facts, and database audit on a disposable native PostgreSQL instance.

## Production Activation Gates

The sync route remains denied until all of the following have independent
evidence and approvals:

- live device-attestation protocol verification, unpredictable nonce/replay
  storage, revocation feeds, and approved key rotation;
- object storage and malware scanner receipts;
- privacy and community safeguarding review;
- staffed human review and incident ownership;
- same-transaction authority re-resolution in the E4 writer;
- rate limiting, abuse controls, load and multi-region failure tests;
- CSP/dependency and field-device security review;
- recovery, key-loss, browser-eviction and quota drills;
- OpenTelemetry traces and privacy-safe alerts;
- clean CI, native PostgreSQL, OpenNext and mobile browser evidence;
- explicit governance activation with a documented rollback owner.

Until then, the UI must say that drafts are encrypted local records and that
sync/verification is unavailable. It must not imply that capture constitutes
proof, certification, a carbon credit, a financial asset, a tax offset, or a
guaranteed return.
