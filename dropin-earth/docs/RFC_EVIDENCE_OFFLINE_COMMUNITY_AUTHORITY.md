# RFC: Durable Offline Evidence And Community Attestation Authority

Status: implementation approved for an internal, route-closed foundation

Date: 2026-07-14

Owners: CanopyProof Evidence Protocol and Trust Kernel

## Problem

CanopyProof must accept field evidence from intermittently connected devices and
must preserve community observations without turning community votes into proof.
The existing Evidence Network compatibility service holds offline batches and
community attestations in process-local maps. It therefore loses state on
restart and cannot independently prove tenant scope, consent, device lineage,
client sequence, exact retry identity, or append-only history.

The compatibility implementation also has unsafe semantics for institutional
use: reusing an idempotency key with a different request returns the first batch
instead of rejecting the conflict; raw community notes are retained; a
contributor may attest to its own evidence; and an attestation mutates the
legacy evidence projection. These behaviors are not production authority.

## Decision

Add an internal E4 authority with three append-only relations:

- `evidence.offline_sync_batch_facts`
- `evidence.offline_sync_item_facts`
- `evidence.community_attestation_facts`

An offline batch is an immutable reconciliation manifest. It is accepted only
after every referenced canonical evidence registration exists. The batch binds
the submitting human, verified organization membership, active consent,
device-attestation fact and current projection, project root, monotonically
increasing device sequence, previous batch root, bounded client-clock interval,
and the ordered Merkle root of its per-item results. A retry returns the prior
bundle only when the request hash is identical. The same idempotency key with a
different request is rejected.

A community attestation is an immutable, hash-only statement attached to the
exact evidence root. It stores no free-text note, precise coordinate, contact
data, or raw device identifier. It cannot update evidence verification state,
confidence, reviewers, final decisions, Environmental Proof records, or
certificates. A challenge produces a `review_required` advisory projection for
a later independent human-verification command.

No public API route is added or opened. Existing process-memory routes remain
blocked by the enforced production persistence guard.

## Trust Model

Trusted authority is limited to committed PostgreSQL records:

- verified human participant, organization, and active membership facts;
- the current project authority root;
- an active evidence-collection and geolocation consent receipt;
- an immutable device-attestation fact and its server-derived projection;
- canonical evidence registrations and their immutable roots;
- the append-only semantic-event stream and command receipts.

Client clocks, connectivity labels, payload hashes, community confidence,
community stance, and all device/provider claims are untrusted observations.
They are committed for lineage only after deterministic validation. A modeled
device provider may create a `needs_review` batch but can never create a
hardware-trusted or final verification result.

Community actors must be verified, active members of the evidence organization
with role `community`, `researcher`, or `verifier`. The evidence contributor
cannot attest to its own registration. Cross-organization attestations remain
closed until a governed data-sharing and conflict-of-interest policy is
implemented.

## Data Flow

```text
Offline client captures evidence
  -> durable consent and device facts already exist
  -> each evidence item is registered idempotently in canonical authority
  -> E4 adapter derives per-item immutable reconciliation facts
  -> repository opens SERIALIZABLE transaction
  -> tenant, actor, command, and device-stream locks are set
  -> prior batches and semantic events are replayed
  -> batch event + batch fact + all item facts + command receipt append atomically
  -> deferred database check proves item count and ordered Merkle root

Community observation
  -> canonical evidence and actor membership are loaded
  -> raw note is reduced to a commitment before the authority boundary
  -> self-attestation, duplicate actor/evidence, time, role, and tenant checks run
  -> semantic event + attestation fact + command receipt append atomically
  -> projection is supporting_context or review_required, never verified
```

Partial offline delivery is recovered by retrying canonical evidence
registrations, then retrying the E4 batch command. No batch fact is visible
without its complete item set, event, and receipt.

## Threat Model

The implementation must reject:

- a conflicting payload under an existing idempotency key;
- skipped, repeated, or reordered per-device batch sequence and predecessor
  root substitution;
- organization, project, subject, consent, device, evidence, contributor, or
  evidence-root substitution;
- revoked or expired consent and expired or consent-revoked devices;
- caller promotion of modeled device attestation to trusted reconciliation;
- item-count, order, item-root, or manifest-root substitution;
- evidence whose offline batch ID, contributor, device commitment, project, or
  organization does not match the batch;
- raw notes, precise coordinates, contacts, bearer material, provider
  credentials, private keys, or unbounded client payloads in fact records;
- community self-attestation, duplicate attestation by the same actor for the
  same evidence, cross-tenant attestation, and future-dated observations;
- treating support count, confidence, or challenge state as final verification;
- semantic-event gaps, command-receipt substitution, direct update/delete,
  cross-tenant reads, and partial fact bundles.

Residual risks remain closed gates: real device-provider signature validation,
offline client key rotation, cross-organization community governance, conflict
appeals and attestation supersession, native PostgreSQL concurrency execution,
field-device threat testing, and privacy review.

## Internal API

The route-closed repository exposes:

```text
commitOfflineBundle(batch, items, idempotencyKey)
commitCommunityAttestation(fact, idempotencyKey)
loadOfflineAuthoritySnapshot(organizationId, deviceAttestationId)
loadCommunityAuthoritySnapshot(organizationId, evidenceId)
getOfflineBundle(organizationId, deviceAttestationId, batchId)
getCommunityAttestation(organizationId, evidenceId, attestationId)
projectCommunitySignal(organizationId, evidenceId)
```

The fact-oriented commit surface is internal. A future HTTP adapter must derive
facts from authenticated principal and durable source records; it may not accept
caller-supplied actor snapshots, organization IDs, roots, verification state,
or fact records.

## Database Changes

The additive migration creates:

- canonical safety, hash, root, and genesis functions;
- exact-key and recursive forbidden-material checks;
- independent source, actor, consent, device, project, evidence, semantic-event,
  sequence, chronology, and projection validation triggers;
- a deferred bundle-completeness trigger for item count and ordered Merkle root;
- no-update/no-delete triggers and database mutation audit triggers;
- forced organization row-level security and tenant indexes.

The legacy `offline_sync_batches`, `offline_sync_items`, and
`community_attestations` tables are not promoted or copied. Their mutable or
under-specified rows remain compatibility data, never institutional authority.

## Migration Strategy

1. Apply `canopyproof-os.sql` and the existing E1 authority first.
2. Apply `evidence-offline-community.sql` twice in a disposable database.
3. Run domain, PGlite replay, hash-parity, tenant, idempotency, bundle-atomicity,
   mutation, self-attestation, and modeled-device tests.
4. Run the native PostgreSQL dual-connection suite against an explicitly
   disposable database before opening any route.
5. Do not backfill process-memory or legacy-table records. Import requires
   independently provable original roots, actor authority, device sequence,
   consent, and event time; ambiguous records remain non-authoritative.
6. Keep the existing production 503 guard until device-provider, privacy,
   operations, abuse, and route-security reviews approve command adapters.

## Rollback Strategy

Rollback is fail-closed:

1. keep or restore the E4 route guard;
2. stop offline reconciliation and community-attestation command handlers;
3. preserve all committed facts, events, receipts, and database audit entries;
4. use the rollback script only for an empty disposable installation;
5. roll application code back while leaving populated additive relations intact.

The rollback script refuses to drop any non-empty E4 fact relation. Rollback
cannot fall back to process memory, rewrite device sequence, delete a community
challenge, or promote a modeled provider receipt.

## Safety Boundary

E4 records transport reconciliation and non-final community context only. It
does not issue final environmental verification, an Environmental Proof record,
a certificate, certified carbon credit, carbon-tax offset, financial asset,
guaranteed yield, mainnet-fund instruction, or automatic CANOPY distribution.
It handles no private key and does not change Cloudflare API/Web Worker routing.
