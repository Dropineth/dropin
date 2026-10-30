# Guardian sessions: implemented boundary and activation conditions

Status: synthetic vertical implementation, not production enrollment or operating approval.

A recent, genuinely verified WebAuthn authentication can now open a **guardian-only** session in the existing child stewardship API. This uses the existing PostgreSQL learning/rights stores; it creates no wallet or replacement ledger. Successful key verification is not legal identity, guardianship, child assent or a payment signature. `identityVerified` remains false and all real child, financial and carbon execution remains disabled.

## Contract

The migration authority provisions an immutable binding between an existing synthetic tenant, guardian actor/device/epoch, child profile and guardian-link version, session generation, and a pinned WebAuthn credential/sandbox/epoch. There is no HTTP binding creation or recovery endpoint. Binding provenance/approval references must be independently established; a reference string alone is not institutional proof. Runtime SQL cannot provision, edit or reassign these bindings.

`POST /guardian/sessions` accepts exactly `bindingId` and `authenticationToken`. The verifier token must be younger than two minutes, postdate the binding and remain current. The native transaction consumes that authentication exactly once, including concurrent submissions, returning one `cp-guardian` bearer with at most ten minutes lifetime. It returns no child, reviewer, protector or operator tokens. A lost exchange response does not authorize replay; repeat the authentication ceremony. Raw tokens are never audit fields or persisted in plaintext.

`GET /view`, `POST /commands` and privacy receipts use the existing domain rules, but additionally revalidate guardian authority inside the same PostgreSQL transaction as execution/release. Lock order is tenant → binding → WebAuthn sandbox → credential/authentication/session. WebAuthn revocation takes the sandbox lock without requesting a tenant lock. The execution clock is refreshed after waits. A revocation committed first blocks later execution; an already committed operation is not retroactively undone.

Checks include current runtime role, actor/device epoch, guardian-link version, session generation, credential and sandbox revocation/expiry, product-session expiry, and restoration admission. Middleware resolution alone is not authorization. Child assent and per-object upload authority stay separate. Guardian tokens are rejected by the existing all-role synthetic resume protocol and child draft-authorization function. `POST /guardian/logout` revokes that product session only; it does not forfeit rights or revoke unrelated participation.

The existing browser demo still uses its explicitly labelled synthetic fixture flow. Browser authenticator enrollment is not enabled, and this change does not silently turn the demo into real registration. The `app.ts` store automatically exposes the bridge's methods; without the new migration, explicit role grants or prebound accounts the endpoint fails closed. Once the restore mechanism is installed, a missing independent current restore provider also fails closed. The legacy mode with neither restore migration nor provider remains available only for local synthetic testing; it is not a production-readiness exemption.

## Files and migration

- `services/api/prisma/child-stewardship-guardian-sessions.sql`: private bindings, unique authentication consumption, revocable sessions, append-only audit and narrow SECURITY DEFINER functions. No roles, credentials, grants or production approvals are created.
- `services/api/src/domain/child-stewardship/guardian-sessions.ts`: raw-secret lookup, independent restore-anchor check, exchange, authentication and logout.
- `postgres-store.ts`, `store.ts`, `routes/child-stewardship/index.ts`: existing API and transaction integration. The in-memory test store refuses guardian authorization.
- `child-stewardship-restore.sql`: security roots include all bound guardian and WebAuthn state, including each sandbox under FORCE RLS. It rejects incompatible schema ownership rather than signing an incomplete root.
- `tests/integration/child-stewardship-guardian-sessions.integration.ts`: real ES256, Hono and native PostgreSQL with separate temporary non-owner logins. The existing complete native CI command includes it.

Apply after authority, resume and WebAuthn migrations through the existing reviewed migration process. The ordinary runtime may receive schema usage and only `capability_session(text,uuid)`, `exchange(text,uuid)`, `authorize(text,uuid)`, `logout(text,uuid)` execution privileges. Internal functions and tables are not public APIs. This document does not grant permissions or authorize credential creation.

Restore roots change when this schema is installed. Obtain fresh independently signed checkpoints; old roots must not receive an exception. Backups must consistently include `child_stewardship`, `child_stewardship_guardian` and `child_stewardship_webauthn`, their revocation/consumption facts and reviewed role metadata. Restore/migration functions require the reviewed common owner and appropriate privileges; runtime cannot be that owner. The independent, current checkpoint source remains outside the restored database.

Rollback: stop guardian ingress, then use `child-stewardship-guardian-sessions.rollback.sql`. It disables runtime admission and revokes sessions/bindings without deleting replay or audit history. Restoring the forward schema cannot revive those bindings. Do not roll back by dropping tables or restoring pre-revocation state.

## Verification and limits

Native cases cover valid authentication→guardian API→consent→child assent→task, withdrawal rejecting old upload proof, protected complaints, privacy receipt access, no financial/child-role escalation, concurrent one-use exchange, cross-tenant and SQL forgery rejection, current credential/device/link binding, tenant and sandbox lock races, role revocation during waits, restoration isolation, expiry during restore waits, non-bypass multi-sandbox root coverage, and rollback. The SQL restore-expiry fixture tests storage deadline enforcement; it is not a cryptographic checkpoint attestation. The separate restore suite exercises actual independent Ed25519 checkpoints and backup/restore.

Local focused tests are evidence for this implementation, not final-SHA full CI or production acceptance. The full API typecheck requires Prisma generation; a failed dependency download must not be bypassed. System Chromium diagnostics are distinct from the locked Chromium/Firefox/WebKit acceptance matrix. Preserve actual command logs and failures in the candidate handoff; do not reuse a prior main's green checks.

## Still required for production

1. A reviewed guardian identity/relationship onboarding and recovery service contract, allowed production RP/origins, existing verifier-role mapping, safe notification and change-of-guardian procedure. No enrollment or credential-access request is being made implicitly here.
2. The actual API/PostgreSQL deployment target, approved migration/grant runner, current checkpoint endpoint and signer registry, independent operation-verifier wiring, backup/restore and monitoring evidence. `app.ts` still lacks a production restore-anchor provider; the real verifier is not mounted. Missing authority remains 503/disabled.
3. A specific first operating jurisdiction and local safeguarding/data/retention responsibilities for CanopyProof Limited. Global ambition does not enable global child enrollment. Real funds/carbon require separate applicable gates.
4. Independent human review of the final PR head **before merge**, final main CI, maintainer attestation, sealed artifacts, environment approval and a verified rollback/traffic readback. AI review and prior externally merged PRs do not satisfy these requirements.

No production deployment, real-child trial, financial execution, UNICEF certification or contract readiness is claimed by this implementation.
