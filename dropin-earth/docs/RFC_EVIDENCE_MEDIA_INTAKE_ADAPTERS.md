# RFC: Evidence Media Intake Adapters

Status: DEFAULT-OFF LOCAL CONTRACT IMPLEMENTED; PRODUCTION ACTIVATION CLOSED

Date: 2026-07-14

Production activation: CLOSED pending named Security, Data Governance,
Platform Operations, Privacy, and Evidence Operations approval.

## 1. Problem Statement

CanopyProof has a durable evidence-media authority, append-only PostgreSQL
facts, quarantine projections, and a disabled object-storage adapter contract.
It does not yet have an approved runtime bridge from an object store or malware
scanner into those facts.

The legacy in-memory development route can emit an `r2://` placeholder and can
model a clean scan supplied by its caller. Production authorization middleware
currently closes that path, and the durable registry rejects caller-supplied
`verified` provider or scanner state. Those controls must remain. A production
bridge must never turn request JSON into a verified infrastructure fact.

## 2. Decision

Implement two default-off server-side adapters:

1. an object-storage adapter that creates a bounded ephemeral PUT grant and
   independently reads the stored object's provider metadata; and
2. a malware-scanner adapter that verifies a scanner-signed result bound to the
   exact immutable object receipt.

Only adapter-verified receipts may create an additive durable verification
fact. Existing media-object and scan facts remain `modeled_only`; they are
never rewritten to `verified`. The adapters do not decide evidence truth,
proof status, certification, funding, token distribution, or financial
eligibility.

## 3. Trust Model

- The human contributor may request an upload intent but cannot assert storage
  success, encryption, retention, or scan outcome.
- The object adapter runs server-side with a fixed provider and namespace. It
  does not accept an endpoint, bucket, host, object key, or credential from the
  request.
- A presigned URL is a short-lived bearer capability. It is returned once,
  never persisted in an authority fact, never logged, and never placed in an
  audit payload.
- The provider verifier performs an independent HEAD/binding read after upload
  and binds key, version, size, content type, SHA-256, ETag hash, upload time,
  namespace, and the immutable upload-intent root.
- Retention is not inferred from caller input or object metadata. A governed,
  independently checked bucket-lock policy root is required before the media
  projection can become `available`.
- The scanner is a separately registered evidence agent. Its receipt binds the
  object root, provider receipt hash, scanner image digest, signature database
  version, verdict, findings, and scan time.
- A clean scan means only that the scanner found no known malicious payload. It
  is not evidence verification and cannot satisfy human review.

## 4. Data Flow

1. An authenticated, organization-bound contributor creates a durable upload
   intent with content SHA-256, content type, byte length, consent, device, and
   project authority.
2. The server selects its configured adapter and creates a grant for the
   intent's exact content-addressed key.
3. The client uploads once using the bounded PUT capability.
4. The server asks the adapter to read provider metadata. Missing objects,
   checksum mismatch, version ambiguity, key substitution, stale grants, and
   provider errors fail closed.
5. The durable transaction re-loads the immutable intent, verifies the receipt
   binding, appends the media-object fact and semantic audit event, and leaves
   the projection in `pending_scan` or `needs_review`.
6. The scanner processes the immutable object version and returns a signed
   receipt. The server verifies scanner identity and signature before appending
   the scan fact.
7. Projection is derived from current consent/device state, duplicate status,
   provider verification, retention-policy verification, and the latest scan.
   No adapter writes final evidence or proof authority.

### 4.1 Two-Phase Orchestration Boundary

Provider and scanner network calls MUST NOT execute inside a PostgreSQL
transaction. The route-closed orchestration contract is:

1. validate the organization, actor, idempotency key, correlation identifier,
   and immutable intent or object locator;
2. query for an already committed matching verification result so a retry does
   not repeat an external side effect;
3. load a read-only authority snapshot and close the database transaction;
4. call the fixed provider or scanner adapter and validate its untrusted
   response, including signature verification, outside every database
   transaction;
5. reduce transient material to the durable minimum: provider receipt fields,
   provider verification root, scanner receipt hash, signature hash, public
   signer identifier, scanner-policy root, and verification root;
6. begin one serializable commit transaction, set actor and organization
   context, lock the idempotency command, the owning `evidence-media:*` stream,
   the dedicated `evidence-media-adapter:*` verification stream, and media
   identity, then re-read the authoritative intent or object;
7. reject a stale, substituted, cross-tenant, or differently rooted receipt;
8. append the modeled media object or scan fact, its semantic event, the
   independent verification event, deterministic command receipt, and
   verification fact atomically; and
9. return the committed bundle. A same-key retry returns that bundle; a
   different payload under the same key fails as an idempotency conflict.

If the external call fails, no durable write occurs. If the commit fails after
the external call, no partial database bundle is visible and the operation may
be retried. If a modeled historical fact already exists, a later transaction
may append only the matching verification fact; the interval remains
`provider_pending` or `scanner_pending` and never acquires implicit trust.

The orchestration API is not an HTTP API. It remains an internal server-side
port with `routeMounted = false` until the production activation gates pass.
Adapter events use their own stream because the media aggregate cannot replay
events owned by another authority. Cross-stream lineage is explicit through
the immutable intent, object, scan, receipt, and verification roots; neither
stream may silently consume or renumber the other's events.

## 5. Threat Model

The implementation must reject:

- arbitrary or private-network upload endpoints and custom domains;
- replay of a grant against another intent, key, method, content type, length,
  checksum, organization, or expiry window;
- caller-provided authorization, cookie, credential, bucket, namespace, or
  provider-verification fields;
- object-key traversal, alternate encoding, version substitution, overwrite,
  missing SHA-256, ETag substitution, and metadata/content mismatch;
- treating a mutable or unverified retention policy as object lock;
- forged, stale, cross-object, cross-tenant, or self-approved scanner receipts;
- `clean` results with missing image digest, signature database version, or
  cryptographic receipt verification;
- logging bearer URLs, provider credentials, raw media, EXIF, GPS, or scanner
  credentials; and
- adapter outage falling back to the in-memory development service.

## 6. Adapter API

The object adapter accepts only a durable
`CanopyProofEvidenceMediaUploadIntentFact` and server-generated context. It
returns either:

- an ephemeral upload grant validated against a fixed HTTPS host and a maximum
  15-minute TTL; or
- a verified stored-object receipt containing the exact intent and provider
  bindings required by the durable command.

The scanner adapter accepts only a durable media-object fact and server context
and returns a verified immutable scan receipt. Provider-specific response types
remain behind the adapter; routes never deserialize them directly into domain
facts.

The durable port accepts only the normalized output of those adapters. It
recomputes every command, receipt, event, and fact root and rechecks immutable
database roots in the serializable transaction. A TypeScript type is not a
trust boundary; direct construction of an adapter-shaped object cannot bypass
the database validators.

The first grant validator supports SigV4 R2/S3 envelopes only. It verifies the
algorithm, credential scope, signing time, signed-header set, signature shape,
and exact signed-versus-declared expiry. Cloudflare R2 grants must use an
allowlisted `*.r2.cloudflarestorage.com` host. GCS remains explicitly
unsupported and fail-closed until a separate reviewed validator exists.

All adapter errors use stable non-secret error codes. Error bodies and logs may
contain a correlation ID but not URLs, query strings, credentials, object
metadata, or raw provider responses.

## 7. Database Changes

The existing append-only evidence-media tables remain authoritative. The first
implementation does not add a mutable upload-grant table.

Before activation, an additive migration must record:

- provider receipt verification root and verifier identity;
- governed retention-policy root and verification state;
- scanner receipt verification root and signer identity; and
- idempotent command receipts for every adapter-to-authority transition.

The migration appends two new authorities instead of mutating the existing
media object or scan facts:

- `media_provider_receipt_verification_facts` binds one immutable media object
  to the independently verified provider receipt, verifier authority,
  retention-policy root, and provider-verification root; and
- `media_scanner_receipt_verification_facts` binds one immutable scan fact to
  the scanner receipt, public signer-key identifier, scanner-policy root,
  signature hash, and signature-verification root.

Existing `providerVerificationState = modeled_only` values are historical
claims and remain unchanged. A later trust projection may derive effective
provider or scanner trust only from a matching verification fact. This avoids
both an append-only violation and a circular dependency between an adapter
receipt and the media object or scan root it authorizes.

Each verification fact must bind a semantic audit event and an
`audit.command_receipts` row in the same serializable transaction. The
idempotency key and request hash are deterministic; retries return the existing
fact or fail on a conflicting payload. Raw signatures are reduced to a
signature hash before durable storage.

Raw presigned URLs, access keys, secret keys, bearer tokens, raw media, and
scanner credentials are prohibited from PostgreSQL and audit payloads.

Implemented locally in `evidence-media-adapters.sql` with a non-empty-safe
rollback in `evidence-media-adapters.rollback.sql`. The migration and adapter
validators are PGlite tested. No provider port, browser upload, scanner runtime,
HTTP route, or production configuration is enabled by this status change.

## 8. Migration Strategy

1. Add pure receipt validators and disabled adapters with unit tests.
2. Add route-closed adapter orchestration and durable bundle commits; defaults
   remain disabled and no provider implementation is selected by environment.
3. Add PostgreSQL columns/tables through an idempotent additive migration and
   verify SQL/TypeScript hash parity in PGlite and native PostgreSQL.
4. Implement one fixed Cloudflare R2 adapter and one approved scanner adapter
   in non-production. Use R2 S3 presigning only on its S3 API domain, or a
   Workers R2 binding for server-side object verification.
5. Run tamper, replay, concurrency, provider-outage, scanner-outage, retention,
   privacy, and restore tests.
6. Mount durable routes behind an explicit default-off feature flag only after
   named review. The legacy in-memory route never becomes a fallback.

Existing modeled receipts remain quarantined. They are not backfilled as
verified and do not gain availability through migration.

## 9. Rollback Strategy

- Disable the media-intake feature flag and adapter configuration.
- Revoke outstanding provider credentials and wait for bounded grants to
  expire; do not persist a grant revocation list as evidence authority.
- Preserve all committed intents, object facts, scan facts, duplicates,
  command receipts, and audit events.
- Project affected objects as unavailable, quarantined, or stale. Never delete
  or rewrite adverse facts.
- Do not restore the legacy in-memory route, accept caller-supplied verified
  state, weaken retention, or bypass human review.

## 10. Acceptance Gates

- Receipt validators reject every threat in Section 5.
- Durable commands remain atomic and idempotent under concurrent writers.
- Adapter and scanner outage cannot produce a verified fact.
- Logs and audit events contain no bearer capability or provider secret.
- Native PostgreSQL, browser upload, object-store, scanner, and chaos evidence
  passes in an approved non-production environment.
- Named reviewers approve data residency, retention, privacy, incident
  response, provider credentials, and rollback.
- Production routes remain closed until every gate above is met.

## References

- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/):
  temporary single-operation bearer capabilities on the R2 S3 API domain.
- [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/):
  provider-side object key, version, size, upload time, ETag, HTTP metadata,
  custom metadata, and checksum retrieval.
- [Cloudflare R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/):
  provider-enforced prevention of overwrite and deletion for a configured
  retention period or indefinitely.
