# Exact admissions and current execution time

The verifier and executor may run at different times. Using each call's current timestamp in the approved output made a legitimate later execution differ from the immutable SQL admission. The implementation now separates the admitted decision timestamp from the time used to authorize execution.

`applyRightsOperation` accepts an optional internal `recordedAt`. The native store obtains it only from the immutable audit mutation for the same session, operation, and expected revision. HTTP requests cannot supply this field. The verifier reuses that timestamp for an idempotent admission retry, while repeating current authorization. Exact approved-mutation, revision, registry digest, nonce, and transaction-use checks remain enforced by PostgreSQL.

Current execution time is refreshed after the session lock and state/admission reads. Signatures, current credentials and revocation, epochs, policy validity, operation expiry, notice periods, new keys, delegation validity, and prospective-policy checks use that current time. They do not use the historical decision timestamp. The outer API audit and SQL journal retain application-time evidence; the rights audit's `at` records the admitted decision.

Contribution decisions need an additional bound because their timestamp determines the objection deadline. The deferred-admission path:

- Requires an integer policy objection window of at least seven days.
- Accepts execution only strictly before 60 seconds after the admitted decision.
- Caps the SQL admission expiry at that 60-second deadline or the operation expiry, whichever is earlier.
- Sets the immutable objection deadline to decision time plus the policy window plus 60 seconds. This preserves at least the full policy window after application and may add up to 60 seconds of waiting.

The ordinary pure transition without an explicit deferred timestamp keeps its existing current-time-plus-policy-window deadline. Stale deferred contributions require a fresh signed operation/admission; no expired immutable admission is rewritten to extend its authority.

The separate verifier requires an actual non-owner, non-bypass login with a current `operation-verifier` scope, no other role membership, no privileged role-creation/database-creation attributes, no schema ownership and no conflicting privacy/media/WebAuthn authority. Migration-owner sessions and ordinary runtime identities fail readiness. Checks repeat on the transaction connection after the session lock. When the restore module is installed, the shared helper requires a freshly read outside-backup `ChildRestoreAnchorProvider`; no cached, request-supplied or restored-database fallback is accepted. This is technical separation in a synthetic fixture; it does not establish real institutional independence.

## Evidence

[Native admission-clock tests](../../tests/integration/child-stewardship-admission-clock.integration.ts) report **7/7 passing** (six subtests plus parent). They exercise actual main Hono routes, current wall time, genuine Ed25519 signatures, immutable admissions, and native PostgreSQL:

- Admit, wait, repeat admission, then execute with every stored mutation matching its admission exactly.
- Reject operation and signer expiry at execution without new nonce, receipt, or payment effects.
- Reject a governed registry revocation after admission.
- Reject caller-supplied `recordedAt`.
- Reject owner-role membership and CREATEROLE; RESET ROLE cannot recover migration authority.
- Preserve the seven-day contribution window after actual delayed application; reject a zero-day policy at verifier admission. Pure-kernel assertions inside the suite also cover the last valid 59.999-second boundary, expiry at 60 seconds, negative/subminimum policies, and unchanged input after rejection.

The existing native store suite also passes **2/2**, and rights unit tests pass **34/34**. Receipts are outside the repository at `build/child-admission-clock-native.tap`, `build/child-rights-time-native.tap`, and `build/child-rights-time-unit.tap` under the task audit-report directory. No external request, real payment, production credential, or deployment was used.

```sh
node --import tsx --test --test-reporter=tap tests/integration/child-stewardship-admission-clock.integration.ts
```

These are local synthetic execution and regression results, not provider, institutional, human, or production release acceptance.
