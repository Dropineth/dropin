# Real-service integration boundary and lifecycle dependencies

Status: actual application crypto, HTTP and PostgreSQL implementations exist;
production child authority and enrollment services have not been established.
Do not convert a reference schema, valid signature or reachable endpoint into
guardian appointment or execution permission.

## Existing explicit interfaces

| Boundary | Existing implementation | Missing production input |
| --- | --- | --- |
| Guardian registration/authentication | `ChildSyntheticWebAuthn` and isolated fixture ceremony router verify actual ES256; `GuardianSessions` consumes recent authentication for an owner-provisioned immutable binding | Approved identity/relationship provider contract, real enrollment/RP/origins, relationship provenance, lifecycle and guardian-change/dispute decisions. Fixture registration does not verify a child or guardian |
| Guardian authorization | Existing `/guardian/sessions`, `/commands`, logout and PostgreSQL authorization checks | Admitted current guardian binding and verifier service; runtime cannot appoint itself or create a binding |
| Scoped execution/revocation | Rights verifier, exact-transition admission, current consent/epoch checks and atomic nonce consumption | Approved AHIN-to-application signing profile/vectors and independently current identity/control registry. A protocol committee role is not a legal guardian role |
| Recovery | `RestoreAnchorProvider`, `ChildRestoreVerifier`, `CurrentAuthority` and `currentAuthorityClient` | Approved external current endpoint, authenticated public-root provenance, registry/revocation semantics, independent operator and actual checkpoint/admission service. Existing wire contract explicitly remains SIMULATION_ONLY |
| Dispute | Existing protected complaint and role-bound rights/adjudication paths | Named independent case owner, jurisdiction-specific referral and appeal rules, approved operator/service and response/retention responsibilities |

No additional registration or recovery wire format is invented here. Real
passkey enrollment routes remain unavailable; backend modes remain disabled or
synthetic-demo. Existing application interfaces are the integration seams once
their actual upstream contracts and authorities are supplied.

## Located sources and applicability

The owner repositories contain cognitive multisig/committee schemas and
in-memory conformance code; separate draft signed/durable Genesis and wire
format candidates must not be promoted to production child authority.
The external-quorum enrollment signing toolkit validates an application but
explicitly does not establish authority. The public Genesis authority intake
status, inspected 2026-11-04, reports `authority_registries_populated:false`.
Its GitHub issue form is authority-application transport, not a guardian registry
or a child enrollment API.

AHIN's existing `src/server/signedEnvelope.ts` authenticates signed evidence
ingest against an allowlist and requires execution/treasury/transfer flags to
remain false. This existing signing implementation is not a child-action or
guardian approval profile. No signing keys, private upstream source or proposed
registry values are copied into this application.

A read-only listing of the inspected Cloudflare account found AHIN console,
router and other existing Workers and `dropin-earth-api-origin`, but no Worker
named for a child, guardian or authority registry service. Names alone neither
prove service absence nor establish what an endpoint authorizes. No unknown
endpoint was supplied child information or probed with an enrollment write.

## Real transport test, synthetic authority

`tests/unit/child-stewardship-authority-transport.test.ts` runs the existing
client against an actual loopback HTTP server, with real Ed25519 signatures,
fresh ephemeral roots and distinct synthetic registry keys. It does not inject
fetch or use a remote identity. The server is a test double for authority, even
though its sockets, streaming and cryptography are real.

The same client rereads the service and denies newly revoked eligibility,
replayed nonces, wrong signing roots, redirects without following them,
oversized bodies and service loss. A recreated client still verifies the pinned
root. Requests have no retries. Production configuration rejects the fixture's
HTTP URL. Keys exist only in memory, no real child data is used, and the server
is closed after testing.

The existing native suites independently cover synthetic registration and
guardian exchange, consent/assent, withdrawal, protected complaints, actual
backup/restore quarantine and rights/admission mechanics. This is not a claim
that real registration through dispute handling has passed a production E2E.

## Required handoff before production integration

Supply approved service specifications and immutable versions, public root and
registry provenance, exact service audience/endpoints, guardian/identity and
case-management authority mappings, revocation/rotation/recovery contracts,
and an accepted regional operator/safeguarding/data-flow plan. Public keys and
references can be reviewed; secrets must be provisioned through the approved
protected environment, never pasted into chat. Then implement the provider's
actual wire adapters, exercise synthetic end-to-end positive/negative cases on
its approved sandbox, obtain independent review and service/operator acceptance,
and release through the existing gates. Until then production admission stays
closed, without fallback to fixture roots, static committees or model decisions.

## Executable synthetic provider seam

`integrations/cai/synthetic-current-authority.ts` now supplies a reusable Web
Request/Response handler for the existing product transport contract. It accepts
only literal loopback HTTP `/current` requests and `SIMULATION_ONLY`, checks the
configured audience and strict request fields, caps input at 4 KiB with a one-second
read deadline, and signs a fresh response with a caller-owned ephemeral Ed25519
fixture key. The synchronous snapshot callback is consulted on every valid
request; it must provide one coherent anchor/registry snapshot. Shutdown rejects
new requests and requests still reading their body. No product route mounts it.

This is an in-memory test service interface, not a guardian registry, an identity
verifier, a production network isolation control, or durable recovery authority.
Its key and fixture role labels establish no real-world independence. The client
continues enforcing signature, freshness, current eligibility and independent-key
checks. A response represents a point-in-time snapshot; downstream execution must
still perform its existing current-authority and revocation checks.

Run the actual local-socket provider/client test and negative cases with:

```sh
node --import tsx --test tests/unit/child-stewardship-authority-provider.test.ts tests/unit/child-stewardship-authority-transport.test.ts tests/unit/child-backend.test.ts
```

The provider fixture covers current revocation, anchor changes, unknown sessions,
wrong audience/environment, malformed or oversized requests, non-loopback URLs,
stalled input and shutdown during an in-flight read. It supplies no production
endpoint, trust-root enrollment, guardian relationship or regional approval.

## Native backend lifecycle verification

`tests/integration/child-backend.integration.ts` now feeds the reusable signed
provider into the actual dedicated backend's transport seam. This test uses Hono
requests and native PostgreSQL, with an explicitly injected local provider handler;
it does not claim deployed HTTPS. Separate socket tests cover real HTTP transport.
The database fixture predates the strict restore gate and is admitted using actual
Ed25519 checkpoint signatures and a distinct restricted verifier database role.

The admitted backend exercises synthetic profile creation, guardian consent, child
assent, unilateral consent withdrawal, protection dispute submission and protector
resolution. A child cannot grant guardian consent and a guardian cannot resolve the
protection dispute. Current registry revocation, authority outage, advanced restore
floor and provider shutdown close access. Hosted demo provisioning and guardian
passkey registration/recovery remain explicitly unavailable (503).

Complementary native suites exercise actual ES256 fixture registration and guardian
session exchange, one-time authentication, revoked credentials, revocation while
waiting on locks, protected complaint visibility, session-generation changes,
one-use synthetic resume and actual pg_dump/pg_restore admission checks. These are
separate fixture suites, not one production registration-to-recovery journey.
Guardian bindings are inserted by the disposable fixture owner; no independently
verified guardian enrollment service is available. Restoring database state or a
synthetic session is not identity recovery and does not establish new consent.

The missing production operations cannot safely be enabled from these fixtures:
verified guardian enrollment/binding and passkey replacement require the approved
identity/guardian service and recovery authority; dispute handling needs an actual
accountable safeguarding operator beyond the synthetic role checks. No new public
registration or recovery endpoint is introduced without those dependencies.

## Guardian exchange final authority check

Guardian session exchange now rereads the current restore authority after the
exchange SQL and before returning from its transaction. The SQL may have waited
on binding, WebAuthn sandbox, credential or authentication locks after the initial
check. If the final read reports revocation, changed restore floor/key material,
an expired signed response or unavailability, the tentative guardian session and
exchange audit roll back and no bearer is released. The one-use authentication
is not spent by that rolled-back exchange. There is no automatic retry; a later
explicit attempt must pass both fresh checks again. Logout retains its separate
negative-authority path and does not require positive restore admission.

`child-stewardship-guardian-exchange.test.ts` exercises the actual adapter, signed
fixture provider, Ed25519 verifier and nonce-bound client with an in-memory SQL
transaction seam. It proves ordering and rollback behavior at the adapter
boundary, not native PostgreSQL lock execution, a live HTTPS service or verified
guardianship. Existing native suites remain required. This final read is not a
distributed lease or atomic external revocation guarantee; a change after that
read still requires an agreed authority/commit protocol before real enrollment.
