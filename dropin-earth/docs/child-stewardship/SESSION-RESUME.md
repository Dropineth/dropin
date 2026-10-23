# Synthetic session suspension and one-use resumption

The demo may persist an encrypted, single-use resume ticket after an explicit clean suspension. Active role bearer tokens remain in page memory. This preserves the same sandbox, profile, assignment, and consent history; it is not real identity recovery, guardian verification, or a passkey session.

| Operation | Authoritative behavior |
| --- | --- |
| `POST /suspend`, current bearer, `{}` | Lock the original session, recheck actor/device/epoch/expiry, advance its generation and suspend it. All previous role bearers become invalid. Return one opaque ticket, session ID and expiry; no active tokens. |
| `POST /resume`, `{resumeTicket}` | Hash the raw ticket inside SQL, lock session and ticket, refresh the clock, check current bindings/expiry, consume the ticket and mint fresh role tokens atomically. Return the original session ID/expiry and tokens, without another ticket. |
| `POST /cancel-resume`, `{resumeTicket}` | Consume an unused ticket without minting tokens. Unknown, expired, used, and cancelled tickets receive the same acknowledgement. A spent ticket cannot revoke a later active generation. |
| Later clean suspension | A fresh active bearer is required to create another ticket. A stale or consumed ticket cannot obtain a replacement. |

SQL stores hashes, immutable token mappings, monotonic generations, consumed ticket history, and exact mint admissions. Each mint binds one token hash, actor, device, epoch, generation, consumed ticket, and current transaction. Only bounded `SECURITY DEFINER` capability functions can create admissions. Ordinary SQL writers cannot create tickets/admissions, alter token mappings, or substitute known hashes, actor claims, or approval flags for raw bearer/ticket possession.

Added tables have forced tenant RLS. Authentication uses a narrow immutable token lookup before tenant selection without exposing foreign generations. Authorization is checked again under the domain transaction's session lock: requests resolved before suspension cannot commit after suspension or a later resume. This covers views, learning commands, rights operations, and privacy results. Draft upload additionally requires a new explicit per-object choice and [fresh online capability](./DRAFT_AUTHORIZATION.md); session recovery and generic permission checks cannot authorize a restored draft.

## Files and validation

- [Forward migration](../../services/api/prisma/child-stewardship-resume.sql) and [rollback](../../services/api/prisma/child-stewardship-resume.rollback.sql).
- [Native adapter](../../services/api/src/domain/child-stewardship/resume-store.ts) and [Hono routes](../../services/api/src/routes/child-stewardship/resume.ts), mounted before active-bearer authentication.
- [Native tests](../../tests/integration/child-stewardship-resume.integration.ts): **15/15 reported tests passed**, using actual main Hono routes and PostgreSQL under temporary restricted logins. Coverage includes clean preservation, concurrency, stale tokens, consumed-ticket restart after two failed local writes, revocation, lock-wait expiry, foreign table/helper isolation, direct SQL forgery, cancellation/replay/races, mid-mint rollback, four queued-request generation races, and external restore-anchor enforcement with actual signed admission.
- [Test-only adapter](../../tests/fixtures/child-stewardship-resume.ts) supports client/browser diagnostics; it is not production or native-database evidence.

```sh
node --import tsx --test --test-reporter=tap tests/integration/child-stewardship-resume.integration.ts
```

The receipt is outside the repository at `/workspace/canopyproof-audit-report/build/child-resume-native.tap`. Focused strict TypeScript and ESLint passed. The suite asserts zero external requests. No production database change, role grant, credential provisioning, or deployment occurred.

## Storage-failure boundary

After an active page has consumed its ticket, a later offline withdrawal followed by failed IndexedDB deletion and failed localStorage writing cannot make that stale ticket reusable after restart. The server rejects the old bearer generation and consumed ticket. Lost resume responses likewise cannot be replayed to obtain fresh tokens; availability may be lost safely.

An already suspended page may retain an **unused** ticket when the user withdraws and every local durable write and server cancellation/withdrawal request fails. The server cannot infer the lost event, and the ticket may remain redeemable until expiry. The independent restart barrier now prevents this from restoring upload authority: only drafts and original provenance are restored, and recovered credentials remain read-only for those drafts until a new explicit object/purpose/version disclosure and current online authorization. The v5 client/Chromium diagnostics exercise this full-failure case and deny sending the old draft after a successful ticket login and generic permission check. This supersedes the v3 upload-risk boundary, without claiming reconstruction or durable delivery of a lost withdrawal event.

The native API also applies durable purpose-specific quotas: 12 suspension attempts per authenticated actor/minute and 12 resume attempts per raw-ticket-derived bucket/minute. The database derives the bucket from actual capability possession and checks the current service identity; raw credentials are never stored in counters. A separate committed security transaction means a rejected business request does not refund capacity. Other actors/tenants have separate buckets. Cancellation remains an uncharged revocation-only lane, so unrelated traffic cannot prevent cancellation. These quotas protect API admission; they do not replace SQL privilege isolation or external infrastructure limits.

## Deployment and rollback conditions

Apply after the base and authority migrations using approved migration authority. Verify historical token-lookup backfill completeness before activation; missing mappings fail closed. Keep runtime identities non-owner/non-bypass and grant only reviewed access through existing release gates. Function owners and migration authority remain trusted. No production permissions are created automatically.

When the restore module is installed, the adapter resolves only a raw-capability-bound session through `resume_capability_session`, locks that session, and rereads a trusted outside-backup `ChildRestoreAnchorProvider` before calling the existing atomic credential mutation. Missing/stale/unavailable evidence and a missing/downgraded lookup or restore module deny mutation. The native test uses actual Ed25519 checkpoint signatures, a separate restore-verifier LOGIN and an independently updated JSON anchor outside the database; the same long-lived adapter rejects a newer anchor and source failure without minting tokens or consuming the pending ticket. A returned SQL denial still commits an identified ticket's consumption before the adapter reports it. Cancellation does not mint credentials, but an unavailable/quarantined route may still deny cancellation; do not promise offline delivery or bypass restoration gates.

Disable the suspend/resume client surface before rollback. Rollback consumes pending tickets, suspends resumed generations, and replaces suspend/resume functions with denial responses while retaining generations, token lookup, ticket/mint history, and RLS. **Do not drop generation guards or restore old bearers.** The native test executes the rollback body and checks denial/history inside a disposable transaction, then rolls that transaction back to avoid disabling other local tests. Fresh activation requires the reviewed forward migration; old consumed tickets remain consumed.

Real recovery, cross-device identity, institutional approval, three-engine browser acceptance, human accessibility, and production release remain separate gates.
