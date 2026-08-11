# RFC: Evidence Media Provider Runtime

Status: ACCEPTED FOR DEFAULT-OFF NON-PRODUCTION IMPLEMENTATION

Date: 2026-07-17

Production activation: CLOSED. This RFC does not mount a route, select a
provider from environment variables, provision credentials, or authorize
production evidence ingestion.

## 1. Problem Statement

The evidence-media authority already validates immutable upload intents,
provider receipts, retention assertions, scanner signatures, append-only
facts, and serializable commits. Its provider ports are intentionally abstract.
Without a concrete runtime boundary, integration tests can prove domain
invariants but cannot prove that a Cloudflare R2 binding, its bucket-lock
management API, or an external scanner is called with a fixed destination,
bounded payload, deterministic request, and non-secret failure behavior.

This increment implements those runtime boundaries without changing evidence
truth, certification, financial, or deployment authority.

## 2. Decision

Implement three constructor-only runtime boundaries:

1. `CloudflareR2ObjectStorageProviderPort` creates a short-lived SigV4 PUT
   grant for one content-addressed key and verifies the stored object through a
   structurally typed Cloudflare Workers R2 bucket binding.
2. `FixedEndpointMalwareScannerPort` sends an immutable object locator to one
   configured HTTPS endpoint and returns a size-bounded JSON receipt to the
   existing signed-receipt validator.
3. `CloudflareR2BucketLockVerifier` reads the lock policy for the same fixed
   account and bucket and binds the currently effective finite policy to the
   exact object version as a point-in-time governance attestation.

None is wired into the application container. Existing disabled adapters remain
the only default. The boundaries may be instantiated only by a later reviewed
composition root.

## 3. Trust Model

- Account identifier, bucket name, scanner endpoint, scanner credentials, and
  signing credentials are server-selected configuration. No request may supply
  or override them.
- A PUT grant is a bearer capability. It is returned to the caller but never
  persisted, logged, placed in an audit event, or included in an error.
- The R2 port accepts only the object key and immutable intent bindings already
  selected by the domain adapter. It does not accept an arbitrary URL.
- The R2 `head()` result is untrusted provider data. Exact key, version, byte
  length, content type, SHA-256 checksum, ETag, and upload time are required.
- R2 bucket-lock state is never inferred from ordinary object metadata. Without
  the optional verifier, runtime receipts remain `modeled_only` with
  `objectLockMode = none`; this cannot unlock availability. With the verifier,
  only a current finite `Age` or `Date` policy can produce a runtime-branded
  `governance` attestation. `Indefinite` is rejected because the durable model
  has no truthful infinite-retention representation.
- The scanner receives no media bytes, upload capability, provider credential,
  GPS coordinate, EXIF record, identity token, or final evidence decision.
- A scanner response is untrusted until the existing adapter validates its
  object binding, freshness, signer registration, receipt hash, and Ed25519
  signature.
- Provider or scanner success is infrastructure evidence only. It cannot issue
  a certificate, move funds, distribute CANOPY, or assert a certified carbon
  credit, tax offset, or guaranteed yield.

## 4. Data Flow

### 4.1 Upload Grant

1. The existing policy adapter validates the durable upload intent.
2. The R2 port derives one virtual-hosted S3 API URL from fixed account and
   bucket configuration plus the content-addressed object key.
3. The signer binds `PUT`, content type, content length, SHA-256 checksum,
   signing time, and expiry into a SigV4 query signature.
4. The existing grant validator independently recomputes URL and receipt hashes
   and rejects host, path, method, header, checksum, or expiry substitution.

### 4.2 Stored Object Verification

1. The orchestrator loads the immutable intent and closes its read transaction.
2. The R2 port calls `bucket.head(objectKey)` outside every database
   transaction.
3. The port requires a provider-generated version and SHA-256 checksum and
   normalizes the exact provider metadata into an untrusted receipt.
4. When configured, the bucket-lock verifier reads the fixed management API,
   selects the strictest applicable finite rule, and binds its observation to
   the exact namespace, object key, provider version, and upload time.
5. The existing policy adapter revalidates every binding and brands the receipt
   only after successful validation.
6. The durable adapter authority re-loads the intent in a serializable commit
   and appends provider facts atomically.

### 4.3 Malware Scan

1. The orchestrator requires a committed provider-verification bundle and
   closes its read transaction.
2. The scanner port posts a canonical, minimized object locator to one fixed
   HTTPS endpoint with redirects disabled and a bounded deadline.
3. The response must be uncompressed JSON, have a bounded declared and actual
   byte length, and parse to one JSON object.
4. The existing scanner adapter validates the receipt and verifies its Ed25519
   signature before any durable commit.

## 5. Threat Model

The runtime must reject:

- caller-selected account, bucket, endpoint, URL, path, credential, or header;
- localhost, IP-literal, private suffix, non-HTTPS, credential-bearing, query,
  fragment, redirecting, or non-default-port scanner endpoints;
- alternate object paths, missing R2 object versions, missing SHA-256,
  malformed ETags, unsupported content types, impossible timestamps, and
  oversized objects;
- bucket-lock redirects, compression, malformed envelopes, oversized or
  duplicated rules, prefix/object substitution, expired policy, unsupported
  indefinite retention, and cross-object or unbranded attestations;
- stale or overlong grants and signatures that do not bind content type and
  checksum;
- scanner response compression, wrong media type, misleading content length,
  streamed response overflow, invalid JSON, redirects, timeout, and non-2xx
  responses;
- errors containing presigned URLs, query strings, tokens, raw responses,
  object metadata, or credentials; and
- provider outage falling back to caller-supplied `verified` state.

## 6. Runtime API

The R2 port depends on a minimal structural `head(key)` binding and a SigV4
presigner. The production composition root may use a Workers R2 binding and a
secret-backed signer, but the signer is injected and never exposed by a public
method. Tests use deterministic, non-secret credentials and an in-memory
binding; no real Cloudflare call is made.

The scanner port depends on an injected `fetch` implementation and an optional
fixed authorization value. It returns parsed `unknown`; only the existing
policy adapter can convert that value into a verified receipt.

The bucket-lock verifier depends on an injected `fetch` implementation and a
private API token. Its account, bucket, jurisdiction, API host, method, and path
are fixed at construction. It returns only a runtime-branded, deterministic
policy observation; the R2 port rejects copied or cross-object values.

Every thrown runtime failure uses a stable `CANOPYPROOF_*` code. Provider
response bodies and caught exception messages are never forwarded.

## 7. Database Changes

None. Provider calls remain outside transactions and existing append-only
provider/scanner verification tables remain authoritative. Presigned URLs,
authorization values, raw signatures, and raw scanner responses remain
prohibited from PostgreSQL.

## 8. Activation and Migration Strategy

1. Add the constructor-only ports, optional bucket-lock verifier, and
   deterministic mock tests.
2. Prove host/path/expiry/checksum binding, R2 metadata normalization, timeout,
   bounded-response, lock-rule selection, redirect, and outage behavior.
3. Run the existing provider/scanner authority and PostgreSQL suites unchanged.
4. Do not backfill existing receipts as retention-verified.
5. Add a non-production composition root with managed secrets and redacted
   observability.
6. Complete Security, Privacy, Data Governance, Evidence Operations, and
   Platform Operations review before mounting any route.

There is no automatic environment-variable activation in this increment.

## 9. Rollback Strategy

- Remove the later composition-root selection or disable its feature flag.
- Revoke R2 and scanner credentials and wait for bounded grants to expire.
- Preserve all append-only facts and project affected objects as unavailable or
  quarantined.
- Do not rewrite historical provider/scanner facts, restore the legacy
  caller-modeled route, or infer successful retention or scanning.

Because this increment adds no route, migration, or default provider, rollback
before activation is code removal only.

## 10. Acceptance Gates

- No live network or Cloudflare credential is used by tests.
- Same inputs and clock produce the same grant and provider receipt roots.
- R2 key/version/checksum substitution fails closed.
- Bucket-lock prefix selection, finite retention calculation, response bounds,
  and runtime-brand binding fail closed; no verifier remains modeled-only.
- Scanner endpoint and response bounds cannot be bypassed by redirects,
  compression, chunked overflow, or malformed content length.
- Provider/scanner outage causes no durable commit.
- Existing CI, PGlite, native PostgreSQL where available, audit, and OpenNext
  gates remain green.
- Production activation remains false after implementation.

## 11. Bucket-Lock Verification Addendum

This default-off increment can attach an independent
`CloudflareR2BucketLockVerifier` to the R2 provider port. It reads only the
fixed Cloudflare management endpoint:

`GET /client/v4/accounts/{accountId}/r2/buckets/{bucketName}/lock`

The account, bucket, jurisdiction, API host, method, and path are constructor
configuration. The object key and immutable provider version are used only to
select and bind the effective rule; they cannot alter the destination.

The verifier must:

- accept only an API token held in a private runtime field and never include it,
  the authorization header, provider body, or endpoint in errors or facts;
- disable redirects and caches and enforce a bounded deadline, uncompressed
  JSON media type, declared/actual length parity, and streamed byte cap;
- validate the Cloudflare response envelope and no more than 1,000 rules;
- select enabled rules whose empty or explicit prefix matches the exact object
  key, then apply Cloudflare's strictest-retention rule semantics;
- derive `retainUntil` as `uploadedAt + maxAgeSeconds` for `Age`, or the
  canonical provider date for `Date`;
- reject expired rules and reject `Indefinite` until the durable receipt model
  can represent it without inventing a finite timestamp;
- map a currently enforced, administratively changeable bucket rule to
  `objectLockMode = governance`, never `compliance`;
- hash the normalized applicable rule set, jurisdiction, bucket, object key,
  provider version, upload time, observation time, and resulting retention
  boundary into a deterministic policy root; and
- return a runtime-branded attestation. The R2 port must reject plain objects,
  cross-object attestations, or any attestation observed after its own provider
  verification timestamp.

If no verifier is injected, behavior remains `modeled_only`. A verified
attestation is a point-in-time provider-policy observation; a later monitoring
authority must append policy changes or expiry. It is not evidence truth or a
legal retention certification.

## References

- [Cloudflare R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Cloudflare R2 Workers API](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/)
- [Cloudflare R2 bucket locks](https://developers.cloudflare.com/r2/buckets/bucket-locks/)
