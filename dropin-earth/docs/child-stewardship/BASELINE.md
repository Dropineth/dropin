# Child stewardship engineering baseline

Status: **synthetic implementation in progress; no production or pilot acceptance**.
Updated 2026-10-23. See [TRACEABILITY.md](./TRACEABILITY.md) for individual
requirements and [BUILD.md](./BUILD.md) for dependency and build evidence.
This document supersedes the missing-specification statements in the historical
`IMPLEMENTATION.md` receipt; it does not retroactively enlarge that receipt's
nine-test result.

## Authoritative source and scope

The engineering source is *CanopyProof 儿童树木守护产品与技术需求*, version 1.0,
2026-10-23. The ten received chunks were preserved outside the repository.
Three specified HTML-entity corrections were applied to restored copies only;
concatenation added no separators. The restored document has 82,311 characters,
178,288 UTF-8 bytes, and verified SHA-256:

```text
d7bca48c07c7a04ce12efb5a8f33604b6b86cc69d7fffd9abf13f98ef8a8f503
```

The full source includes private correspondence references and is deliberately
not committed. This baseline records only necessary engineering requirements.
It does not reproduce private email links, recipient addresses, credentials,
real children's records, precise locations, or payment destinations.

The product repository baseline is `Dropineth/dropin` at
`5d571e7e2736345d8c76717c66b564b60268ace1`, with development on
`feature/child-stewardship-rights-20261023`. The separate `poccahin/cai`
ontology repository at `463d4bb2bb476fbf9c718e43d48b14e3cca455bc` is not the
product runtime and is not modified by this work.

Development and testing are authorized. Any eventual production release remains
subject to the repository's existing independent review, fixed-SHA CI, sealed
artifact, qualified maintainer, protected-environment, and rollback gates.
This documentation is not one of those approvals.

## Hard product boundaries

1. Synthetic demonstration is explicit in the server runtime, API contracts,
   UI, fixtures, and records. Client-supplied environment or approval fields
   cannot enable real capabilities. Unavailable backing services return errors;
   the runtime does not fall back to `TestChildStore`.
2. No real-child enrollment, free-text disclosures, camera/media upload, exact
   coordinates, biometric templates, wallet creation, financial execution,
   or carbon transfer is enabled. Approved choices and authored synthetic
   references are the only learning input. Passkey setup and real identity
   assurance remain unavailable and visibly labeled.
3. E records observations and their limitations; C records nontransferable,
   correctable learning attribution; R records legal obligations independently
   of funding; F records funding and payment stages. None automatically creates
   the next ledger's authority or outcome.
4. Guardian consent and child assent are separate and purpose-specific.
   Withdrawal stops new corresponding processing and upload attempts. It does
   not erase historical contributions or independently established rights.
5. The physical tree and planting slot have separate identities. Replacement
   creates a new tree. Missing or expired evidence means current knowledge is
   unknown; it does not mean death or child fault.
6. Actual signed bytes, current credential/registry versions, independent
   approving control domains, exact destination bindings, epochs, nonces,
   budgets, and case restrictions are checked for synthetic rights operations.
   Signatures do not prove legal identity, institutional independence, or
   ecological truth.
7. Unknown payments retain their reservation and require reconciliation.
   Disputes and lack of funds do not erase obligations. Recovery, guardian
   change, and legal-capacity transfer preserve beneficiary continuity.
8. Protected reports are excluded from implicated guardians' views, case
   deduplication probes, audit summaries, and ordinary visible revision counts.
   The available report path is a synthetic exercise, not an operating child
   protection or emergency service.
9. AI is explanation/proposal only. The product adapter supports the five
   AHIN verbs through a bounded proposed contract and approved static content.
   Official AHIN interoperability, PoCC, and ChainRank remain unsupported.

## Implementation and authority map

| Boundary | Current implementation | What it does not establish |
| --- | --- | --- |
| M01 identity/consent | `learning-types.ts`, `learning.ts`: fixed synthetic actors, scoped profiles, link/consent versions, separate assent, device/epoch revocation | Real guardianship, age assurance or regional admission; actual ES256 WebAuthn fixture ceremonies exist separately but real enrollment remains unmounted |
| M02 tree directory | Stable tree/slot IDs, replacement history, identity uncertainty, coarse synthetic region | Real tree ownership, globally unique registration, forestry validation |
| M03 tasks | Approved low-risk indoor comparison, age-band policy, expiry/cancellation, remote path | Field risk assessment, real supervision, weather or land-access authorization |
| M04 offline/evidence | AES-GCM IndexedDB drafts, profile isolation, stable intents, consent preflight and abort, closed synthetic references | Real user-media intake and safety acceptance; fixed synthetic images undergo actual decoding, metadata stripping, quarantine and native local deletion |
| M05 agent gateway | Real Ed25519 byte verification, current consent/credential checks, bounded delegation, static answers, no tools or ledger authority | Live model service or official AHIN network; separate native gateway provides signed current-authority verification and durable nonce consumption, with its optional router unmounted |
| M06 review | Synthetic E0 review, explicit unknown survival, append-only review lineage and independent dispute handling | Real E2/E3 field review or E4 standard certification |
| M07 contribution | Canonical activity deduplication, alias continuity, append-only corrections, no transfer/cash value | Verified legal identity across sessions/projects or financial entitlement creation |
| M08 rights/funds | Deterministic signed synthetic rights kernel, separate R/F state, reservations, reconciliation, bounded governance/recovery | Real institutions, legal validity, settled cash, carbon registry verification, or external provider acceptance |
| M09 UI/operations | S01–S35 synthetic screens and selected actual API learning flow; explicit unavailable states | Actual protection staff, case-service response commitments, legal recovery or financial operations |
| M10 storage/release | Hono boundary, normalized PostgreSQL authority, separate cryptographic verifier admission, immutable journal, RLS and native transaction regressions; existing release gates retained | Production Prisma/DB deployment, isolated verifier credentials, institutional acceptance and independent release approval |

Paths above are under `services/api/src/domain/child-stewardship/`, except
offline/UI code under `apps/web/src/` and SQL under `services/api/prisma/`.
Native tests now exercise the normalized adapter and exact verified-transition admission.
Historical snapshot tests are not attributed to that model. PostgreSQL enforces
admission and constraints; the separately scoped TypeScript verifier performs
Ed25519 verification. The shared runtime database login is a trusted service
boundary: API principals authenticate end users, while SQL checks approved
execution scopes. Database-owner compromise is not neutralized by these triggers.

## Scope of synthetic identity and deduplication

A demo session returns all five role tokens to the initiating demo client so
the adult demonstration can exercise the workflow. These tokens are opaque,
short-lived capability tokens; they are not independently verified people,
Passkeys, guardian relationships, or legal/control-domain attestations.

Each session is an isolated sandbox. Learning attribution is deduplicated by
canonical participant, activity instance, and contribution kind inside that
sandbox, independent of policy version, request key, and participant alias.
A fresh session has separate synthetic records. This is not person matching
across sessions, schools, countries, or real projects, and no global child
identifier or biometric matching service exists.

The product UI exposes no arbitrary identity or free-text input. Protocol IDs
are synthetic identifiers, not proof that a string describes a real person.
Server-side closed schemas reject extra fields; privacy tests must include
the complete API and logs, not only browser controls.

## Evidence levels and known gaps

Recorded local tests separately identify the cryptographic primitive, pure
domain transitions, actual Hono routes with a test transaction store, native
SQL contracts, and browser execution. Passing one layer is not a pass for
another layer. Test names carrying AT/RT/EX IDs indicate covered assertions,
not complete fulfillment of every assertion in that acceptance contract.

The current learning/gateway suite has 24 passing tests; its focused strict
TypeScript and ESLint checks pass. Current observed receipts also record 34
rights unit tests and seven Hono API tests passing. These results predate the
final integrated release SHA and must be rerun after relevant changes.

The client v5 receipt records 27 offline tests, seven API tests and two route-privacy tests (36 total) using explicit test stores.
The Chromium v5 diagnostic traversed all 35 Chinese/English screens, encrypted
draft reopen/isolation/cleanup, lost-response replay into one observation, clean
ticket resumption, and both consumed-ticket and unused-ticket restart barriers after failed durable writes.
It records zero third-party requests/page errors, fixture loading at 400 kbps and
400 ms latency, mobile zoom, focus/target checks, and sampled text contrast.
These are fixture diagnostics, not Firefox/WebKit, native database, human WCAG,
or full Next/OpenNext sealed-artifact acceptance.

[Native suspend/resume](./SESSION-RESUME.md) records 15 passing tests with actual
main Hono routes and PostgreSQL; [isolated WebAuthn](./WEBAUTHN.md) records 14
with actual signatures and separate verifier authority. Active demo bearers
are never persisted; only a one-use ticket is saved after explicit suspension.
An already suspended unused ticket can still survive a lost withdrawal if every
local durable write and server cancellation request fails. It restores read-only
access, never draft upload authority. Each restart restores drafts and original
provenance only; a new explicit per-object choice and current online
[draft authorization](./DRAFT_AUTHORIZATION.md) are mandatory before sending.
The v5 diagnostic covers all durable writes failing, offline withdrawal, an unused
ticket surviving restart, and denial of sending the old draft even after login
and a generic permission check. Lost withdrawal events themselves remain
unrecoverable under total communication/storage failure; no durable-withdrawal
guarantee is claimed.

The initial native SQL receipt covered schema/atomicity only. Later normalized
authority and actual adapter/Hono receipts are recorded separately in
[TRACEABILITY.md](./TRACEABILITY.md) and the implementation/build evidence; the
initial receipt must not be used to claim those later checks.

Privacy completion requires the current worker/storage receipt for each target;
local draft cleanup alone is not erasure from every storage system. The native
privacy lifecycle/worker receipt records 12 passing tests: actual local copies
and expired exports are deleted, immutable receipts preserve evidence, retained
rights/protection facts remain, external processors remain waiting, and ordinary
views do not disclose protected retention. A bounded durable-job drain exists,
but no production scheduler or external processor adapter is enabled. Worker
readiness requires a separate actual LOGIN, live latest admission, no ownership,
bypass, role membership or conflicting authority scopes. Installed optional
scope registries must be readable; unavailable separation evidence fails closed.
The separate [privacy authority](./PRIVACY-WORKER.md) receipt records ten native
passes, including preservation of bytes and pending jobs when current restore
evidence is unavailable. Old restored state may omit a newer retention hold;
quarantine blocks deletion as well as exports. Current admitted retention evidence allows expired-session cleanup through a separate gate, while interactive export stays closed. Mixed queues cannot let expired pending exports starve eligible deletion.

The [durable signed static gateway](./AGENT-GATEWAY.md) records 12 native passes
with actual Ed25519 verification, current registry/delegation checks, atomic
nonce/output-digest/audit persistence and real privacy deletion integration.
The optional router is tested with actual Hono/PostgreSQL but unmounted in the
production application; the UI does not claim signed-gateway connectivity.
Restore-sensitive services reread an independent outside-backup anchor provider,
never a cached request or restored-database assertion.
No child co-design study, screen-reader user acceptance, independent full
WCAG 2.2 AA audit, local safeguarding exercise, institutional custody test,
or jurisdiction-specific legal approval has been performed by this work.

Current build/network blockers and supported dependency changes are maintained
in [BUILD.md](./BUILD.md). A previous denied GitHub Actions query is not
retried through alternate routes. Local logs do not replace same-SHA remote CI
artifacts or protected-environment approval.

## Gate status and release conditions

| Gate | Current status | Required evidence before enablement |
| --- | --- | --- |
| G0 baseline | Full source restored and hash verified; implementation active | Maintain requirement/decision traceability and reviewable changes |
| G1 synthetic demonstration | Local implementation and tests exist; final release acceptance pending | All applicable P0 checks, independent review, integrated DB/browser/build evidence, demo isolation, release gates |
| G2 regional child pilot | Closed | Named jurisdiction/partners, lawful guardianship/age policies, privacy/ethics review, data lifecycle, staffed protection routes and child-centered usability evidence |
| G3 expansion | Closed | Region-specific pilot evidence, accessibility improvements, operational and safety capacity |
| G4 real rights execution | Closed | Applicable legal rights/obligor evidence, independent institutions/control domains, protected funded arrangement, provider-side enforcement and reconciliation, audited recovery/exit; carbon-specific evidence only for carbon paths |

Rollback must disable new affected actions and consumers first, preserve audit
and legal obligations, restore safe read-only/local-draft behavior, and reconcile
revocations/executed operations before restoring writes. A worker rollback
does not reverse an external payment or establish database compatibility.

## Public technical references

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) defines the intended accessibility
  baseline; this project does not claim conformance from automated checks alone.
- [WebAuthn](https://www.w3.org/TR/webauthn-3/) guides the isolated
  [synthetic authenticator implementation](./WEBAUTHN.md). Its actual signature
  verification and native persistence tests do not enable real enrollment,
  product sessions, or age/guardianship verification.
- [W3C VC Data Model 2.0](https://www.w3.org/TR/vc-data-model-2.0/) distinguishes
  verifiable statements from trust in their issuer and meaning.
- [RFC 9052](https://www.rfc-editor.org/rfc/rfc9052.html) is an evidence-envelope
  design reference; the current product adapter is explicitly versioned and
  does not claim COSE or official Life++ interoperability.

These links are engineering references from the restored specification, not
fresh legal/provider acceptance or organizational endorsement.
