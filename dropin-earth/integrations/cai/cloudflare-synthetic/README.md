# Child account SQLite Durable Object conformance slice

**Synthetic local experiment, not a PostgreSQL replacement or a production child service.** No UI change, model inference, human authentication, cryptographic signing, real minors' information, money or climate-credit issuance. No deployment is performed by this package or its CI.

## Run

From this directory with Node22.23.5 or a supported newer Node:

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

`src/signature.ts` provides a Web Crypto Ed25519 verification primitive, now used only by the explicitly synthetic signed-commit path described below. It takes the exact expected bytes and registered public key from its caller. It never selects a registry, grants consent, signs, or changes DO state. Byte arrays are copied before the first await to prevent caller mutation while key import/verification is pending. Only canonical RFC8410 Ed25519 public SPKI PEM (including CRLF line endings) is accepted; this deliberately supports a narrower key-input interface than Node KeyObject. It exports no private-key or signing operation.

The same60 positive/negative cases run against **the existing API's actual, unmodified `verifyChildSignatureBytes`** in Node and this primitive inside workerd. They cover valid signatures, wrong exact envelope, tampered/truncated/oversized/detached signature, wrong key, public PEM aliases, invalid/private-key headers, size limits and unsupported algorithms. Test material consists only of three public vectors from the current AHIN signer contract and one public vector generated with a discarded ephemeral synthetic guardian test key. A Node test checks those three vectors against the actual checked-in contract. No real guardian identity or private credential is included. Additional workerd tests check input mutation across the asynchronous boundary and six deliberately strict public-key encoding rejections.

The original interoperability slice retains its61 Node checks and83 workerd checks. Current combined results are **67/67 Node checks and105/105 workerd checks** (16 baseline account +67 signature/encoding +22 signed-account/envelope), zero skipped; strict TypeScript and local dry-run pass. This shows agreement on the60 shared cases, not universal parser equivalence: Node also accepts KeyObject and some PEM encodings such as spaces in the body or trailing text that this intentionally narrow parser rejects. This is not a PostgreSQL server comparison and does not prove a full current-registry/guardian authorization protocol. WebAuthn/ES256 is explicitly rejected rather than misinterpreted as raw Ed25519: authenticatorData, clientDataJSON, challenge, RP ID, origin, flags and protocol-specific signature format still need the existing WebAuthn verifier. The Worker primitive is connected only to the local-fixture signed-commit method, not any production endpoint. Fixture administration and consent remain unsigned test-harness actions. Signature verification alone must never become authority.

## Synthetic signed-commit integration

`registerSyntheticGuardian`, `revokeSyntheticGuardian` and `commitSignedSyntheticProposal` are local-fixture RPCs only. They do **not** establish a real person, legal guardian, external registry or consent. No HTTP ingress, UI signing control, production enrollment, external network call, secret storage or deployment is added. The Worker has no signing operation. Only tests create ephemeral private keys in memory and discard them; checked-in vectors contain public keys and signatures only.

- The harness registers one Ed25519 public key with canonical RFC8410 encoding under the strict `guardian` fixture role. AI, child, UN, BEV, school and operator roles cannot be registered. Registration is not proof of key possession or human identity. There is no multisignature/quorum claim.
- A separately persisted signature-required policy is set with the first registration. Neither revocation nor a missing registry row enables the unsigned conformance commit RPC. There is no supported policy removal operation. This persistence guarantee is scoped to supported operations on the current database, **not** whole-database rollback resistance.
- Registering or rotating a fixture key advances key revision and consent epoch and clears both consent flags in the same local transaction. Revocation does likewise and remains available without positive restore admission. Neither operation creates admission. Positive registration still requires current admission.
- `canopyproof.synthetic-do.commit.v1` is a deliberately new **test profile**, not the production AHIN signer contract or WebAuthn. The server constructs exact canonical bytes containing fixed action/role, actual DO identity as audience, scope, proposal/command IDs, digest, nonce, consent epoch, original proposal expiry, key ID and revision. The signer cannot supply a replacement key, role, algorithm or audience. The synthetic digest remains an opaque label, not verified original evidence.
- All fields and signature bytes are captured before asynchronous verification. The public key comes from the same object's current fixture registry. After verification the synchronous transaction rereads that exact active key/revision, admission, consent/epoch, clock, proposal/expiry and nonce before either a new effect **or receipt replay**. There is no await inside this final check/write unit. Same-object serial outcomes do not establish atomicity with an external authority or another DO.
- The first effect stores the exact public envelope, public key/revision and signature as bounded synthetic evidence, atomically with nonce consumption, observation, receipt and audit. Failure in evidence or audit insertion rolls all of these back; exact retry can succeed. This is not an immutable audit claim or authorization to retain real child data.

22 new workerd tests cover signed concurrent idempotency, field/action/audience/key substitution, unsigned fallback denial, non-signer roles, originally issued expiry, signature evidence, rollback/retry, signed nonce reuse/command collision, renewal, restart and unsigned negative safety actions. Seven deterministic tests pause the **real** Web Crypto verify call, change key/revocation/child consent/admission/restore state/clock/expiry, then resume and verify zero effects. A captured-input mutation test checks that callers cannot substitute command fields across await.

An independent literal envelope signed by an ephemeral **Node** key is checked against the codec and the existing backend's actual Node verifier, then against workerd Web Crypto. Role/audience/scope/expiry substitutions are rejected. This extends byte/signature interoperability evidence; it is still **not** a fresh PostgreSQL server execution or a real authority protocol. Real guardian authentication, policy assignment, multiple human signer quorum, current external revocation fencing and independent restore anchors remain absent. The fixture caller can still fabricate consent/admission and install its own key, so this adapter must not be exposed to untrusted clients.

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
