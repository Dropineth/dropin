# Durable signed static Agent gateway

The optional gateway verifies actual Ed25519 signatures against a current,
owner-published synthetic key/delegation registry. It returns only three approved
static explanations through the five product-adapter verbs. It invokes no model,
tool, wallet or provider and does not implement official AHIN, PoCC or ChainRank.
The ordinary UI's static questions do not claim to be connected to this service.

[PostgresChildAgentGateway](../../services/api/src/domain/child-stewardship/agent-gateway-store.ts)
uses a dedicated actual LOGIN, with no schema/table ownership, privileged role
attributes, other role memberships or conflicting runtime/privacy/media/WebAuthn
scopes. A versioned owner-controlled role admission is required. The separately
credentialed service is the trusted cryptographic verifier: PostgreSQL does not
pretend that a caller-supplied `verified` boolean proves a signature.

Each answer resolves the raw synthetic bearer, locks the original session, then
rechecks token generation, actor/device epoch, consent/assent, policy, current
credential and every delegation ancestor. Registry publication takes the same
session lock. Time is refreshed after lock waits and before persistence. Actual
signature verification covers the exact canonical envelope and its environment.
Malformed credential expiry is rejected.

The transaction writes an immutable admission with a unique actor/nonce and
event ID, an exact digest receipt, and a minimal audit entry. Deferred validation
requires all three. Ordinary SQL writers cannot publish keys or insert/alter
these records. A failed output write rolls back nonce consumption as well;
concurrent identical requests have one winner. Responses lost after commit cannot
replay that nonce to obtain another response.

Rich evidence references and timestamps are returned transiently and are never
copied into durable gateway output. The persisted receipt has exactly five
fields: schema, output digest, approved static source, `finalAuthority=false`
and `syntheticOnly=true`. Admission/audit records retain replay and verification
digests, not the signed evidence payload or raw signature. This avoids creating an
immutable second copy of learning evidence outside the privacy inventory.

If the restore module is installed, the constructor must receive a trusted
`ChildRestoreAnchorProvider`. The shared helper rereads that independently current
outside-backup source under the session lock, before reading/responding and again
before admission. No request or restored database value supplies the anchor.
Missing, stale, unavailable, or downgraded restore evidence fails closed. The SQL
trigger also enforces the database restore gate. Deployment must supply the
independent current source; none is configured by this work.

The [router factory](../../services/api/src/routes/child-stewardship/agent-gateway.ts)
exposes `/agent/status` and `/agent/answer`. It accepts only the closed envelope
and approval schema, bounded JSON, an actual bearer and canonical base64url bytes.
Real mode or an unconfigured verifier is unavailable. The factory is exercised
with actual Hono and PostgreSQL but is not mounted in the production application.

## Evidence and rollback

[Native gateway tests](../../tests/integration/child-stewardship-agent-gateway.integration.ts)
record 12/12 passing tests, including actual signatures, concurrent replay,
foreign-environment signature rejection, changed signatures/bearers, current key
and ancestor revocation, malformed expiry, consent/device withdrawal, real
lock-wait expiry, rollback/retry, direct-SQL forgery and tenant isolation, actual
observation-to-explanation-to-privacy-deletion, restore quarantine, and actor-specific durable capacity limits. All
assert zero external model/provider requests. The pure learning/gateway suite
separately records 24/24. These are distinct from deployment/provider acceptance.

Receipts are outside the repository at `build/child-agent-gateway-native.tap` and
`build/child-agent-learning-unit.tap` in the audit-report directory. Focused strict
TypeScript and ESLint are recorded separately; final same-SHA integration remains
part of release validation.

A separate committed security transaction allows at most 120 requests per verified bearer actor/minute. Its bucket is derived from the raw bearer inside a constrained SQL wrapper, so changing a key ID, nonce or event ID cannot reset the budget. Invalid signatures consume capacity but leave nonce/output/business audit unchanged. Other actors and tenants remain isolated. Cancellation uses a separate uncharged lane in the resume adapter. Native tests exercise 120 invalid signed requests followed by a 429 and an unaffected other actor/tenant.

Apply [the additive migration](../../services/api/prisma/child-stewardship-agent-gateway.sql)
after base, authority, resume and rate-limit migrations, with approved migration authority. It creates
no production role or credential. The [rollback](../../services/api/prisma/child-stewardship-agent-gateway.rollback.sql)
automatically denies new verifier admissions, including explicitly granted roles,
while retaining registries, nonce history and minimal receipts. Disable the
optional router before application rollback. Do not erase consumed nonces to
restore service.
