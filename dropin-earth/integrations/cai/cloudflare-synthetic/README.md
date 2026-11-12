# Child account SQLite Durable Object conformance slice

**Synthetic local experiment, not a PostgreSQL replacement or a production child service.** No UI change, model inference, human authentication, cryptographic signing, real minors' information, money or climate-credit issuance. No deployment is performed by this package or its CI.

## Run

From this directory with Node22.23.4 or a supported newer Node:

```sh
npm ci
npm run types
npm run typecheck
npm test
npx wrangler deploy --dry-run --outdir dist
```

The final command is local build validation only. Do not omit `--dry-run`. Runtime types are generated from this package's Wrangler config, not copied from the production frontend. The separate package/lockfile leaves the existing app, Node API and root dependencies unchanged.

`wrangler.jsonc` sets `CHILD_DO_MODE=disabled`, disables workers.dev and preview URLs and defines no routes, remote bindings, credentials or deployment scripts. Tests alone override the mode to `local-fixture-only`. All public HTTP account routes return503; `/health/live` reports accountEntry closed and realCapabilities false. A caller setting the fixture flag is **not** guardian authorization. Do not expose fixture RPCs or bind this namespace into a live child flow.

## Implemented

- One deterministic object per synthetic scope; copied cross-object scopes fail before mutation.
- Guardian grant renewal clears child assent. Every consent transition advances the epoch; withdrawal clears both. AI/UN/BEV/operator labels and non-string role coercions are rejected.
- Proposals bind an opaque synthetic digest, original consent epoch, one-use nonce and server-checked expiry. No arbitrary payload or upload is stored.
- A synchronous `storage.transactionSync` rereads local consent/epoch/expiry and writes nonce consumption, one synthetic E0 observation, receipt and audit together. There is no await/external I/O in that transaction.
- Concurrent exact retries create one effect. Receipt replay still rechecks original expiry/current consent/epoch. A changed command ID or supplied digest, reused nonce or old proposal after regrant cannot become a new effect.
- SQL failure rolls the whole local mutation back; exact retry can succeed. RPC failures return fixed denial codes rather than SQL details.
- Per-instance admission is discarded on runtime restart. A fresh instance nonce and matching **outside test-fixture reference** are required. Mismatched restored state cannot refresh admission through a negative withdrawal. Clock rollback latches persisted quarantine and clears consent.
- No alarms, queues, polling loops, WebSockets, containers, DB hosts or model calls are introduced. Proposal count is capped128 per fixture object. This is not an account spending cap or a guarantee of free hosting.

## Comparison with current PostgreSQL semantics

Reference source: Dropin main `0ee036e536a1c15b8c2d386c9303761a8fec93a7`.

| Existing contract | This experiment |
| --- | --- |
| [learning.ts grant/assent/withdraw](https://github.com/Dropineth/dropin/blob/0ee036e536a1c15b8c2d386c9303761a8fec93a7/dropin-earth/services/api/src/domain/child-stewardship/learning.ts) | Epoch invalidation, guardian renewal clears assent, renewed child assent required |
| [draft authorization SQL](https://github.com/Dropineth/dropin/blob/0ee036e536a1c15b8c2d386c9303761a8fec93a7/dropin-earth/services/api/prisma/child-stewardship-draft-authorization.sql) | One local effect and atomic consumption, expiry/current-consent checks even on receipt retry |
| [postgres-store transaction](https://github.com/Dropineth/dropin/blob/0ee036e536a1c15b8c2d386c9303761a8fec93a7/dropin-earth/services/api/src/domain/child-stewardship/postgres-store.ts) | Synchronous single-object transaction only; no claim of external authority atomicity |
| [restore SQL](https://github.com/Dropineth/dropin/blob/0ee036e536a1c15b8c2d386c9303761a8fec93a7/dropin-earth/services/api/prisma/child-stewardship-restore.sql) | Restart quarantine and mismatch behavior against a separately retained fixture reference, not real independent checkpoint verification |

**Intentionally not implemented:** PostgreSQL FORCE RLS; runtime-login/owner/verifier separation; actor/device/generation/policy assignment authorization; unpredictable bearer proof hashing and possession checks; canonical command-body verification; signed rights nonces; real registry or guardian verification; fresh-proof receipt-only replay; authoritative external fencing/leases; independent durable restore authority; network service authentication. The synthetic nonce is not a bearer credential. The supplied digest is opaque test input, not verified payload integrity. The random `head` is a local state marker, not a cryptographic audit chain.

A compromised Worker with access to its DO storage is outside this experiment's security model. Same-object serialization does not atomically cover a revocation stored by another object or external authority. Adding a final fetch/recheck would still leave an external race. No such fetch or invented authority is added.

## Verified local tests

16 account tests run inside actual workerd/SQLite through the official Cloudflare Vitest integration, with no skips. They cover concurrent identical submissions, replay/mismatch/nonce reuse, consent withdrawal and regrant, guardian renewal and assent ordering, exact-object scope, strict non-signer roles, expiry on receipt replay, injected audit failure rollback/retry, real runtime restart with persisted storage, stale snapshot mismatch and negative-withdrawal admission handling, and persistent clock quarantine. Typecheck and local Wrangler dry-run build also pass.

The stale-snapshot test deliberately replaces SQL rows through **test-only internal access**. It is not a Cloudflare PITR trial. Official docs state PITR is unavailable locally and can restore the entire SQLite database. DO backups, a local epoch, a bookmark or an audit head cannot serve as an independent anti-rollback anchor. The test harness reference can be fabricated by its trusted caller; production admission remains absent.

This is behavioral porting of selected PostgreSQL invariants, not a fresh side-by-side PostgreSQL execution or full security-equivalence proof. Existing PostgreSQL suites were read as references; they were not rerun as part of this package.

### Signature interoperability, still not guardian authorization

`src/signature.ts` provides an unwired Web Crypto Ed25519 verification primitive. It takes the exact expected bytes and registered public key from its caller. It never selects a registry, grants consent, signs, or changes DO state. Byte arrays are copied before the first await to prevent caller mutation while key import/verification is pending. Only canonical RFC8410 Ed25519 public SPKI PEM (including CRLF line endings) is accepted; this deliberately supports a narrower key-input interface than Node KeyObject. It exports no private-key or signing operation.

The same60 positive/negative cases run against **the existing API's actual, unmodified `verifyChildSignatureBytes`** in Node and this primitive inside workerd. They cover valid signatures, wrong exact envelope, tampered/truncated/oversized/detached signature, wrong key, public PEM aliases, invalid/private-key headers, size limits and unsupported algorithms. Test material consists only of three public vectors from the current AHIN signer contract and one public vector generated with a discarded ephemeral synthetic guardian test key. A Node test checks those three vectors against the actual checked-in contract. No real guardian identity or private credential is included. Additional workerd tests check input mutation across the asynchronous boundary and six deliberately strict public-key encoding rejections.

Total current local results: **61/61 Node checks and83/83 workerd checks** (16 account +67 signature/encoding), zero skipped; strict TypeScript and local dry-run pass. This shows agreement on the60 shared cases, not universal parser equivalence: Node also accepts KeyObject and some PEM encodings such as spaces in the body or trailing text that this intentionally narrow parser rejects. This is not a PostgreSQL server comparison and does not prove a full current-registry/guardian authorization protocol. WebAuthn/ES256 is explicitly rejected rather than misinterpreted as raw Ed25519: authenticatorData, clientDataJSON, challenge, RP ID, origin, flags and protocol-specific signature format still need the existing WebAuthn verifier. The Worker primitive is not connected to the fixture consent bypass or any production endpoint. Signature verification alone must never become authority.

## Official documentation used

Retrieved through Cloudflare's documentation connector, not blocked deployment access:

- [SQLite storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/): synchronous transaction rollback, no raw BEGIN/SAVEPOINT, PITR scope/local limitation.
- [Rules of Durable Objects](https://developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/): input/output gates, per-entity boundaries, external await interleaving.
- [Testing Durable Objects](https://developers.cloudflare.com/durable-objects/examples/testing-with-durable-objects/): actual workerd SQLite tests and runInDurableObject.
- [Vitest configuration](https://developers.cloudflare.com/workers/testing/vitest-integration/configuration/) and [test APIs](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/): current cloudflareTest plugin, reset and abortAllDurableObjects.
- [DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/): compute and storage are metered; SQLite DOs can be used on Free or Paid. The current account plan/quotas were not accessed or changed. There is no quoted bill, purchase or promise of zero cost.
- [Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/): standard Ed25519 SPKI import and verify; no dependency on the legacy NODE-ED25519 API.

## Before any hosted integration

Keep HTTP and production enrollment closed. Decide an independently reviewed human-authority protocol, exact supported consent/capability semantics, durable independent restore admission and actual external revocation consistency. Verify current account/plan/cost controls and least-privilege namespace access without bypassing existing access denials. Run authorized hosted preview and rollback acceptance, and preserve existing release gates. Do not remove PostgreSQL protections until a replacement is actually implemented and reviewed. This package does not authorize a namespace migration, deployment, subscription or resource purchase.
