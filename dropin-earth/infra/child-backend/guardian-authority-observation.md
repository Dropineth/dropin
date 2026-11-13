# Guardian authority observation boundary (not activated)

`createGuardianAuthorityProvider` is a proposed application-level integration
contract for reading an external issuer's signed guardian-relationship statement.
It is not an AHIN standard, a legally verified registry, a signing service, an
enrollment endpoint or a completed provider integration. No institution, guardian,
child or upstream operator is asserted to participate.

## Current release boundary

- No configuration means unavailable without a network call.
- The reader is **not imported or mounted by the backend app**, and no environment
  variables or deployment bindings activate it. Existing `disabled` and
  `synthetic-demo` modes and the `SIMULATION_ONLY` restore contract are unchanged.
- Even a valid signed statement returns `authorizationGranted: false`. This
  component cannot issue a token, enroll a child, grant consent, admit a restore,
  recover an account or authorize money/asset operations.
- No private key is accepted or created. Roots, endpoint, issuer, key ID and
  audience must be explicitly supplied by a future trusted integration. Signing
  fixtures exist only in unit tests and are never shipped as operational roots.

## Proposed wire contract

A fixed HTTPS endpoint receives one POST, with redirects forbidden, credentials
omitted and no cache/retry. No caller-controlled destination or URL token exists.
Request fields are `protocol: CanopyProof-GuardianAuthorityObservation/1`,
`issuerId`, `audience`, a fresh 32-byte base64url `nonce`, and `request`:

```json
{
  "sessionId": "<UUID>",
  "childSubjectId": "<pseudonymous ID>",
  "guardianSubjectId": "<pseudonymous ID>",
  "operation": "enrollment | session | recovery",
  "minimumSequence": 0
}
```

The response is exactly `{statement, signature}`. The statement contains the
same protocol, issuer, audience, nonce and request, the pinned `keyId`, ISO
millisecond `issuedAt`/`expiresAt`, a safe integer `sequence`, and:

```json
{
  "relationship": {
    "subjectType": "human-guardian",
    "status": "active | revoked | suspended",
    "validFrom": "<ISO timestamp>",
    "validUntil": "<ISO timestamp>"
  }
}
```

`signature` is canonical unpadded base64url Ed25519 over `stableJson(statement)`.
The reader requires exact scope binding, an active unexpired relationship, a
response validity of at most 30 seconds, and `sequence >= minimumSequence`.
Response expiry cannot exceed relationship expiry. Extra fields, unknown keys,
non-human subject types, malformed/oversized responses and any transport or
cryptographic failure produce the same unavailable result. A three-second
deadline covers headers and body; body reads are cancelled on timeout. No request
or response body is logged. A detected in-process wall-clock rollback closes
observations; this is not an independent durable time/finality source.

## Required before any real integration

1. Independently establish the issuer's identity, legal scope, relationship
   provenance and recovery/revocation governance. A valid signature attributes a
   claim to a key; it does not establish legal guardianship or independent control.
2. Agree the protocol with that actual operator. Pin/rotate roots through reviewed
   configuration, not a response-supplied `verified` flag or new key.
3. Implement authenticated, least-privilege caller access and operational limits.
   This reader deliberately has no credential provisioning or ambient cookies.
4. Establish a durable independently authoritative sequence floor and a concrete
   revocation/commit fencing protocol. `minimumSequence` only checks the caller's
   supplied floor. A final HTTPS read does not create cross-service atomicity.
5. Review a separate backend integration that consumes this observation alongside
   human consent, actual guardian authentication, current registry eligibility,
   scoped database authority, replay protection and release gates. This PR does
   not supply that integration or change production eligibility.

Unit tests use ephemeral keys and pseudonymous fixtures only. They test attribution
and refusal behavior, not hosted E2E, verified real people or production readiness.

## Reproducible local transport acceptance

With the locked dependencies, Node 22.23.5 and an existing official OpenSSL CLI:

```sh
node --import tsx scripts/guardian-authority-acceptance.mjs --synthetic-only
```

Without that exact opt-in the command exits closed, without network activity. It
accepts no external endpoint or real subject IDs. It generates a disposable
one-day test CA/server certificate and in-memory Ed25519 fixtures, starts HTTPS
on a random **127.0.0.1-only** port, and runs the actual provider with native
fetch. The test CA is trusted only by its disposable child process through
`NODE_EXTRA_CA_CERTS`; certificate verification is never disabled. Missing-CA and
wrong-hostname controls must fail before reaching the handler.
The child receives only an explicit operational environment allowlist, not
ambient application/database credentials. Existing platform security/preload,
proxy and CA controls are preserved, and TLS-verification disabling is rejected.
The report describes loopback request targets and listener binding, **not OS
egress isolation or independence from a modified/untrusted Node runtime**.

The 15-case matrix covers a positive signed observation (never authorization),
missing configuration, revoked/mismatched/forged/expired/replayed claims,
unavailable/malformed/oversized/redirecting/stalled responses, and shutdown.
It checks one wire request per attempt, unique nonces and no followed redirects.
Handler exceptions are counted and fail acceptance, never counted as successful
negative controls merely because a broken fixture made the client return closed.
The test-only `--self-test-handler-failure` option after `--synthetic-only`
intentionally breaks one refusal handler and must exit with a failed report.
All listeners are closed and temporary TLS keys removed before success is emitted.
Unexpected process termination still requires normal temporary-directory cleanup;
this test is not a persistent service or offsite key-custody mechanism.

The single JSON report contains candidate SHA/tree, actual relevant-source and
lockfile fingerprint, runtime version, dirty-tree state, case names and counts.
It excludes subject IDs, endpoint addresses, response bodies and key material.
Source identity is checked again after execution. `productionReady`,
`realAuthorityConnected` and `authorizationGranted` remain false even on success.
An exit code of zero means only that this local synthetic transport matrix passed.

The deployment preparation now records Cloudflare-first with an existing isolated
Node/PostgreSQL origin candidate, rather than the superseded Render preference.
It does not create resources, select a production jurisdiction or authorize a
connector, public route, Access policy or other security-sensitive network change.
