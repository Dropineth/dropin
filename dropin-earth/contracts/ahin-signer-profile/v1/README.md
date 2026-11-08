# AHIN Signer Profile v1 — CanopyProof integration contract

Version: 1.0.0, product-local SIMULATION_ONLY contract candidate. This name does
not assert adoption or approval by AHIN, Life++, an IdP or a safeguarding operator.
Production authority, guardian enrollment and an operational endpoint are absent.
No deployment or permission change is authorized by this document.

`openapi.json` (OpenAPI 3.1 / JSON Schema 2020-12) is the sole machine-readable
wire contract in this package. No Proto3 representation is defined: protobuf,
CBOR/COSE and AHIN evidence-ingest newline signing bytes are NOT interchangeable
with this profile. `fixtures.json` contains a synthetic public-key signing vector
and negative mutations, with no private keys or personal data.

## Scope and authority

`POST /current` describes the unmounted local fixture provider. The server URL
is a local example, not a published deployment. Production backend configuration
requires HTTPS; the fixture itself accepts literal loopback HTTP only. The API
reads the current checkpoint anchor and registry; it cannot grant guardianship,
enroll identities, perform payments, resolve disputes or recover an identity.

The `Registry` component is the full embedded registry including `revoked` flags.
There is NO standalone revocation list, delta list, revocation write API, ETag,
CRL, cursor, poll schedule or global guardian lookup. Do not invent one from this
schema. A false revoked flag asserts only the signed fixture's current state.

`SignedRestoreCheckpoint` is an existing internal verifier argument, not a recovery
HTTP endpoint. `ResumeRequest` describes the existing synthetic resume/cancel body;
it is not IdP recovery. `/guardian/passkeys/*` remains unavailable (503). Real
registration/recovery schemas require separately approved service specifications.

## Signing bytes (normative)

For a snapshot, sign exactly UTF-8 bytes of `stableJson(response.payload)` using
Ed25519 (not Ed25519ph), without a prefix, BOM, trailing newline, wrapper or prior
hash. Output the 64-byte signature as canonical unpadded base64url (86 characters).
The signature property itself is not signed. Do not sign the transport JSON text.

`stableJson` accepts JSON null, booleans, strings, safe integral numbers, arrays
and plain objects only. It recursively sorts object keys by JavaScript UTF-16
code-unit order, preserves array order, emits JSON.stringify string escaping,
no whitespace, and decimal JavaScript String(number). Negative zero becomes 0;
fractions, unsafe integers, NaN, Infinity and undefined are rejected. It performs
no Unicode normalization. This is the existing product algorithm, not a claim of
RFC 8785 conformance. Preserve PEM string bytes (including escaped newlines) in
signing input. Trust/signature verification parses Ed25519 SPKI PEM; key identity
comparison uses canonical SPKI DER so PEM formatting aliases cannot create two
independent signers. The public-key PEM is capped at 1024 characters.

For a restore checkpoint, sign UTF-8 `stableJson(checkpoint)` with each registered
Ed25519 key. The anchor digest is lower-case hex SHA-256 of those same bytes.
Restore checkpoint protocol/domainSeparator fields differ from the snapshot
protocol; signatures cannot be swapped between them. No signature authenticates
a mere reference or model assertion.

## Validation beyond JSON Schema (mandatory)

All snapshot objects are strict. IDs, UUIDs, exact timestamps, integer bounds,
array sizes and signature/nonce lexical forms are enumerated in OpenAPI. A schema
pass alone is never authorization. The request audience is a string compared to
configured audience; the signed response additionally restricts it to the ID
pattern. Operators must configure a compatible audience.

Each call creates a cryptographically random 32-byte nonce (unpadded base64url,
43 characters). Client requires exact nonce, audience and requested session match;
anchor session must also match; registry version equals anchor registry version.
No caching or retry is allowed. No server nonce ledger is implemented for this
read-only interface. A captured response cannot satisfy a fresh client nonce.

At verification time issuedAt <= now < expiresAt, and expiresAt - issuedAt <=
30 seconds, with no clock-skew allowance. Snapshot timestamps have exactly three
fractional digits and UTC Z. The fixture emits 20 seconds. Client imposes a
three-second total deadline, 65536-byte streamed response limit, status 200 and
application/json; redirects, parsing failures, unavailable service and invalid
signatures all become CURRENT_RESTORE_AUTHORITY_UNAVAILABLE, not partial success.

Registry key IDs must be unique. Eligible keys must be unrevoked, independentOfOperator
true, validAfter <= now < expiresAt. All eligible keys must parse as distinct
actual Ed25519 keys. There must be protection and trustee keys in different
control domains. These fixture role/independence labels do not prove legal
independence or verified guardian relationships.

## Durable revocation invariant

The dedicated backend commits SHA-256(stableJson({version, keys})) of the complete
registry into each new restore admission. On every gated operation, it compares
that commitment with the freshly verified current registry, as well as checking
checkpoint identity/sequence/digest. ANY registry change invalidates the existing
admission, including revocation when an alternative eligible pair still exists,
key replacement under the same ID, reordering or metadata changes. A transport
quorum alone cannot preserve an old admission. Existing rows with no commitment
remain closed until newly verified; migration does not backfill guessed authority.

This enforces the existing operational requirement to advance the external
checkpoint/registry after relevant revocation and obtain a fresh admission. The
provider must not resurrect obsolete registry snapshots under new nonces. This
interface cannot detect a dishonest current authority or establish its legitimacy.
Freshness is point-in-time, not a globally atomic lock on the external provider.
Legacy isolated anchor-only fixture integrations are not covered by the dedicated
backend's registry commitment and must not be used as production adapters.

## Restore and rotation semantics

The internal restore verifier first commits quarantine. Failed verification leaves
access closed. It checks current anchor before/after lock and before admission,
checkpoint digest, canonical/security/privacy roots, registry version, restricted
verifier DB identity and actual participating signatures. There must be 2–8
signatures, no duplicated signer IDs, actual keys or control domains, with both
protection and trustee roles. Each signing key must be current and independent.
The checkpoint timestamp parser allows whole seconds or three fractional digits;
issuedAt <= now < expiresAt and expiry is no more than one hour from verification
time (NOT a maximum total checkpoint lifetime). Admission expiry is bounded by
checkpoint expiry and participating signer expiry.

The exported checkpoint outer envelope/signature entries deliberately forbid extra
fields; the existing internal verifier tolerates extras there. This is an explicit
profile restriction, not claimed exact runtime parser parity. Checkpoint and roots
fields themselves are strict at runtime. No HTTP admission request or recovery
token format is invented. Synthetic resume uses a one-use cp-resume ticket;
recovery of login never proves fresh guardian consent or signing authority.

Transport root is an out-of-band pinned public key, never accepted from a response.
No automated root rollover, key-discovery URL, root quorum or overlap procedure is
implemented. An approved operator must provision a replacement root through the
protected deployment process and verify the corresponding service; a changed
root fails until that happens. A registry change requires fresh verifier state
and admission; it cannot silently reuse the constructor's prior registry copy.

## Errors, versions and compatibility

Fixture errors are JSON `{error: ...}`: 400 INVALID_REQUEST, 404 NOT_FOUND,
405 METHOD_NOT_ALLOWED, 503 UNAVAILABLE. Malformed JSON, oversized/stalled input,
invalid snapshots and shutdown also yield 503. No sensitive details are returned.
Input is capped at 4096 bytes and one second. These are fixture transport semantics,
not a public IdP availability or authentication policy.

The canonical source for snapshot fields is the exported Zod schemas in
`current-authority.ts` and `synthetic-current-authority.ts`; regenerate with
`node --import tsx scripts/export-child-authority-contract.ts`. Signing source is
`domain/child-stewardship/store.ts`; recovery source is `restore-checkpoint.ts`.
A drift test compares the checked-in export to those schemas. This README supplies
semantic rules that JSON Schema cannot express. Changed signing bytes, scope,
field acceptance, quorum or wire semantics require a new major contract/profile
and explicit review; documentation clarifications use patch versions. Changes
must never silently reinterpret CanopyProof-CurrentRestoreAuthority/1. Production
activation requires a separately accepted profile; this candidate cannot be
promoted by changing SIMULATION_ONLY to another value.

## Remaining integration limits

No authenticated caller protocol, mTLS/client credentials, independently enrolled
trust root, automated rotation or monotonic external rollback service is supplied.
The fixture is not safe to expose publicly. Registry freshness depends on the
pinned authority reporting honest current state. Database state roots are computed
by `restore_state_roots` using SHA-256 of UTF-8 PostgreSQL `jsonb::text` aggregates
with the SQL-defined ordering, NOT JavaScript stableJson. An IdP must not
recompute those roots by substituting another JSON encoder.

The client now carries the signed expiresAt internally to the dedicated backend's
registry admission check; database clock_timestamp enforces it after earlier DB
waits. Session locking precedes the transport read in the transaction path.
The command transaction additionally fetches fresh authority after all tentative
SQL writes and before returning to the database commit wrapper. Revocation or
expiry detected there rolls back the transaction. This is not a distributed atomic
authorization lease: a change between the final read and actual COMMIT is still
possible, and this final check does not cover every other transaction method.
Production execution requires an accepted side-effect/commit-time authority policy
and its race tests. Passing these conformance fixtures is not operational acceptance.
