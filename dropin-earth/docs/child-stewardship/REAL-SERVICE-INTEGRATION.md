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
