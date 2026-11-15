# Care Continuity v2 — first independently reviewable core slice

Base: `0761a84b94bbc0521e294efba1e6907fd776d6d2`.

This PR implements the new basic-needs-first application rules, not a live child service. CanopyProof remains the environmental evidence/accountability platform; child support is one module. Existing site routes, Life++HERE, dependencies, child-backend configuration, SQL migration journal, outbox hold, secrets and production deployment are unchanged.

## Implemented here

- Strict water/hygiene intake without a child name, school, phone, device, guardian identifier, free text or coordinates.
- Explicit RECEIVE/ASSIGN/ACCEPT/BLOCK/ACTION/REVIEW/FEEDBACK/REOPEN and pending-versus-accepted handoff semantics.
- Current scoped authority, action-role checks, grant versions, command expiry, optimistic revisions and source evidence version binding.
- Independent review requires another actor/organization and another source; review observations cannot predate the action.
- Water supply restoration never implies water quality certification. Unknown remains unknown.
- All basic requests and access/supply barriers have zero ChainRank delta. Health/protection are not silently routed into the water workflow.
- Minimal child-facing view; public aggregates withheld until disclosure review.
- Ed25519 application receipts mapped to existing AHIN verbs, with explicit synthetic audience and no external side effects. Positive feedback is ASSERT; still-needed is CHALLENGE.
- Twelve dependency-free contract tests.

Run from repository root: `node --test dropin-earth/integrations/care-continuity-v2/tests/contract.test.mjs` (Node 22.16.0 used locally).

## What this PR deliberately does not claim

The complete separately delivered candidate package contains a local-only SQLite/HTTP rehearsal, three-language UI, a default-closed portal gateway, PostgreSQL adapter/SQL candidates and additional tests. **Those additional files are not included or deployed by this first core PR.** Integrate them in separately reviewed changes; do not describe this PR as the entire system or a production rollout.

A local synthetic capability is not identity or guardianship. A server signature is not institution-controlled multisig, PoCC, proof of physical truth or an independent anti-rollback anchor. The transition function assumes callers have retrieved current trusted state/grants and wrap its result atomically with a receipt; it is not an HTTP authentication boundary or a persistence implementation. No environment flag can activate a real service through `readiness()`.

Native PostgreSQL RLS, concurrency, database recovery, actual institutional rosters, public-host authentication, real help delivery, child enrollment and Arabic human review remain release gates. Do not remove existing safeguards or bypass them because a synthetic test passes. Do not collect real child information to test this slice.

## Next integration sequence

1. Review these rules and fit the adapter to the existing isolated Node/PostgreSQL authority boundary.
2. Port the child four-entry navigation and institution workbench without replacing the main site. Preserve private portal/assets authentication; public information is separately scoped.
3. Run real PostgreSQL restricted-LOGIN/RLS/locking/revocation/recovery tests before applying a new schema.
4. Establish an accountable local operator, service roster, region, consent/participation arrangements, safeguarding, retention/deletion and response/complaint procedure.
5. Complete exact-SHA CI, actual authenticated browser/device tests and protected preview; then a separately authorized rollout/rollback.

This PR contains no deployment workflow and makes no clinical, water-safety, UNICEF/FAO partnership or carbon-credit claim.
