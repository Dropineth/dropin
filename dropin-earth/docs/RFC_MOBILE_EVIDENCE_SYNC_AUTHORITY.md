# RFC: Authenticated Mobile Evidence Sync And Recovery Authority

Status: approved for implementation as a default-closed foundation

Date: 2026-07-17

Owners: CanopyProof Evidence Protocol, Trust Kernel, and Field Operations

## Problem Statement

The encrypted `/mobile/report` vault can preserve field drafts across an
offline browser session, but it deliberately has no network transport or server
authority. The durable Evidence Registry and E4 Offline Evidence Authority
already provide immutable PostgreSQL facts, tenant row-level security,
idempotent command receipts, device sequencing, and audit roots. There is no
authenticated command adapter that safely joins those authorities to a mobile
draft.

Opening the legacy `/canopyproof/evidence/sync-batches` handler would be unsafe.
It writes process-local compatibility objects, trusts caller-shaped records,
and is intentionally disabled in production. A replacement must not let the
browser provide organization roots, actor snapshots, project roots, consent
state, device trust, evidence roots, server time, sequence numbers, or audit
facts.

The sync boundary also cannot pretend that evidence registration and offline
batch reconciliation are one database transaction: they currently belong to
separate append-only authorities. The protocol therefore needs explicit,
recoverable two-phase semantics rather than a false atomicity claim.

## Decision

Add a mobile command authority that composes, but does not replace:

- `PrismaCanopyProofTrustRegistryService` for authenticated actor, project,
  consent, device, and canonical evidence authority;
- `CanopyProofEvidenceOfflineSyncAuthorityService` for deterministic batch and
  item facts;
- `PrismaCanopyProofEvidenceOfflineCommunityRepository` for serializable,
  append-only E4 commits.

The protocol has three commands:

1. **Bind draft**: validate a minimized mobile projection, derive all trusted
   authority from PostgreSQL, and idempotently append a canonical evidence
   registration. Return an evidence/server binding.
2. **Commit batch**: reload every authority, verify each binding, derive the
   next device sequence and predecessor root, and atomically append the E4 batch,
   items, semantic event, and command receipt.
3. **Recover batch**: locate a committed batch by organization, device, actor,
   and client batch ID and return the same acknowledgements without writing.

The client may mark a draft `acknowledged` only after an acknowledgement binds
the client record, evidence root, E4 item root, batch root, and audit event root.

## Trust Model

Trusted inputs are loaded server-side from PostgreSQL:

- a Cloudflare Access JWT principal bound to a verified participant;
- an active organization membership and matching role;
- a current project authority owned by that organization;
- an active consent receipt covering evidence collection, geolocation, and
  media upload;
- a current or explicitly `needs_review` device projection whose subject,
  consent, organization, and fingerprint match;
- canonical evidence registrations and their immutable roots;
- E4 device stream history and command receipts.

Untrusted inputs include browser clocks, connectivity labels, coordinates,
accuracy, media commitments, EXIF commitments, note commitments, local record
IDs, minimized sync-projection hashes, and all retry metadata. They are structurally
validated and committed for lineage, not promoted to verified ecological fact.

The browser never sends raw notes through the sync authority. It sends a
domain-separated note hash or `null`. The canonical evidence registration also
stores no note text.

## Data Flow

```text
Encrypted local draft
  -> derive minimized sync projection (raw note excluded)
  -> POST binding command with exact idempotency key
  -> authenticate Access JWT and bind PostgreSQL membership
  -> lock custody subject and project authority in one SERIALIZABLE command
  -> reload project, consent, device, and actor authority in that transaction
  -> recompute sync projection hash
  -> append/replay canonical evidence registration before transaction commit
  -> return evidence/server binding
  -> encrypt binding into local vault

Bound local drafts for one project/device
  -> acquire local sync lease
  -> POST batch command with exact idempotency key
  -> reload and compare every server binding
  -> load E4 device history
  -> derive next sequence and predecessor root
  -> append E4 event + batch + items + receipt in SERIALIZABLE transaction
  -> return per-item acknowledgements
  -> verify acknowledgement against encrypted binding
  -> mark local draft acknowledged

Ambiguous timeout
  -> retry exact command, or submit recovery query
  -> command receipt/clientBatchId resolves prior E4 bundle
  -> return identical acknowledgement roots
```

Evidence registration can exist without an E4 batch if the client disappears
between phases. This is not hidden partial success: the evidence registration
is independently valid, immutable, and audit logged. Repeating the bind command
returns it. The client remains unacknowledged until phase two commits.

## Threat Model

The authority must reject:

- missing or non-Access authentication in an enabled environment;
- unverified participants, inactive memberships, wrong roles, or tenant
  substitution;
- production use without every activation gate;
- caller-supplied organization, actor, project, consent, device, evidence,
  sequence, predecessor, item, batch, or audit roots;
- a sync projection hash that does not match the minimized request;
- a local payload hash presented as server-verified content;
- consent that is expired/revoked or lacks required purposes;
- device subject, consent, fingerprint, organization, or projection mismatch;
- archived projects, project-organization mismatch, or evidence substitution;
- raw notes, contact data, credentials, bearer tokens, private keys, or
  unsupported climate/financial claims;
- multiple projects, devices, or consent receipts in one E4 batch;
- skipped device sequence or predecessor substitution under concurrency;
- a changed payload under an existing idempotency key;
- acknowledgement substitution across client records or evidence roots;
- recovery queries by another actor, organization, or device;
- treating `validated`, `reconciled`, community context, or an acknowledgement
  as final verification or certification.

Residual risks remain explicit: browser-origin XSS can operate an unlocked
origin-bound key; device provider receipts are still modeled; native mobile
hardware-backed keys and remote recovery do not exist; PostgreSQL dual-process
load/chaos testing and field privacy review remain gates.

The bind command now closes its former read-to-registration TOCTOU interval.
`evidence.mobile-binding.create` takes the evidence-custody subject lock before
the project authority shared lock, resolves actor, organization membership,
project, consent, device, and deterministic projections inside one serializable
Trust Registry transaction, and appends the evidence registration before that
transaction commits. Consent revocation and device-attestation commands use the
same subject lock. A non-authoritative `audit.authority_fences` revision closes
the PostgreSQL pre-lock snapshot hazard: custody writers and binders touch the
same subject fence, project writers advance a project fence, and binding reads
the project fence under `FOR SHARE`. A waiter with a stale serializable snapshot
receives a retryable conflict and reopens on current authority. Exact retries
replay the original command receipt and immutable facts; a new command after
revocation is rejected without adding a receipt or evidence row.

Evidence registration and E4 batch reconciliation intentionally remain two
phases. A client disappearance after binding can therefore leave one valid,
audited registration without an E4 batch. This is recoverable partial lineage,
not a hidden atomicity claim. A disposable PostgreSQL 17 dual-connection gate
now proves revoke-first contention rejects the waiting bind with no evidence or
receipt. Production activation remains blocked pending reviewed transport,
Cloudflare edge abuse controls, privacy review, device recovery, and field
testing. A separate durable API admission foundation now exists, but remains
default closed and is not a substitute for edge DDoS/WAF controls.

## API Design

All routes live below `/canopyproof/evidence/mobile-sync` and require an
authenticated organization member.

```text
GET  /status
POST /bindings
POST /batches
POST /recoveries
```

`GET /status` reports only activation posture and safety boundaries. Command
routes require all of:

```text
DROPIN_REPOSITORY=prisma
DATABASE_URL configured
DROPIN_CANOPYPROOF_AUTH_MODE=cloudflare_access_jwt
CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED=true
CANOPYPROOF_MOBILE_SYNC_ADMISSION_ENABLED=true
CANOPY_PRODUCTION_UNLOCK=true
```

The default for all three gates is false. Development-header principals and
in-memory repositories are never accepted by the command routes, even when a
test injects a service.

Every write requires an `Idempotency-Key` header. Request and response bodies
use strict shared Zod schemas. Before parsing, the route applies fixed
command-specific body limits and consumes actor and organization budgets from a
serializable PostgreSQL admission authority. The API never accepts durable fact
records.

Error classes distinguish permanent prerequisite/rejection errors from
retryable availability and concurrency errors. No response tells the client an
evidence submission is verified, certified, credit-bearing, tax-offsetting, or
financial.

## Database Changes

No new relation is required for this increment. The command authority uses the
already additive and append-only relations:

- `evidence.evidence_objects`
- `evidence.offline_sync_batch_facts`
- `evidence.offline_sync_item_facts`
- `audit.domain_events`
- `audit.command_receipts`

The Trust Registry receives one read-only method that returns a replay-verified
custody actor snapshot. It does not expose a mutation or bypass row-level
security.

The separately reviewed admission extension adds
`audit.mobile_sync_admission_buckets` as mutable operational coordination and
`audit.mobile_sync_admission_denial_facts` as append-only, root-verified security
history. Neither relation is evidence or verification authority.

## Migration Strategy

1. Add shared protocol schemas and deterministic mobile/server hash parity tests.
2. Add the command authority and route with both activation flags default off.
3. Keep the legacy Evidence Network route disabled.
4. Prove bind, exact retry, batch, ambiguous-timeout recovery, cross-tenant
   denial, stale consent, device mismatch, root substitution, and concurrent
   sequence conflict behavior with unit and PGlite tests.
5. Run the native PostgreSQL dual-connection suite before any activation review.
6. Add a client coordinator behind an injected transport; do not mount an
   automatic sync loop or production fetch path.
7. Apply and verify `mobile-sync-admission.sql`; preserve its PGlite and native
   dual-connection boundary tests.
8. Perform field privacy, Access policy, provider-attestation, edge WAF/rate,
   retention, and operations reviews before changing any gate.

Existing encrypted `draft_queued` records remain readable. No migration marks a
draft as bound or acknowledged. Any older weak binding is rejected and remains
recoverable as a local draft.

## Rollback Strategy

Rollback is fail-closed:

1. set `CANOPYPROOF_MOBILE_EVIDENCE_SYNC_ENABLED=false`;
2. leave `CANOPY_PRODUCTION_UNLOCK=false`;
3. remove command routing while preserving all committed evidence, E4 facts,
   events, and receipts;
4. keep local encrypted drafts and acknowledgements intact;
5. retry or recover only after the reviewed implementation returns;
6. never fall back to the legacy process-memory route or rewrite/delete facts.

## Safety Boundary

This protocol transports structurally validated evidence commitments and
offline reconciliation lineage. It does not create final verification,
Environmental Proof certification, a certified carbon credit, a carbon-tax
offset, a financial asset, guaranteed yield, mainnet fund movement, automatic
CANOPY distribution, or any private-key operation. API and Web Workers remain
separate, and `/api/admin/*` remains blocked.
