# RFC: Durable Evidence Metadata And Retention Authority

Status: implementation approved for an internal, route-closed foundation

Date: 2026-07-14

Owners: CanopyProof Evidence Protocol and Trust Kernel

## Problem

The Evidence Protocol E3b domain already derives deterministic metadata
extraction, retention-decision, and retention-execution facts. Its current
authority snapshot is process memory. A restart therefore loses the facts, and
the database cannot independently reject a forged source root, substituted
actor, broken event sequence, or mutation of historical retention state.

This gap blocks offline synchronization, Digital MRV lineage, institutional
audit export, and any privacy-safe public projection. Persisting a loose JSON
object is not sufficient: the database must bind every fact to the durable E1
consent/device records, E2 media object and projection, evidence registration,
human or agent authority, semantic event, and idempotency receipt.

## Decision

Add an internal PostgreSQL fact repository with three append-only relations:

- `evidence.media_metadata_extraction_facts`
- `evidence.retention_decision_facts`
- `evidence.retention_execution_facts`

Each relation stores indexed authority columns and the complete canonical fact
record. PostgreSQL validation functions recompute command, fact, and root
hashes; validate source and actor snapshots against current durable records;
bind the exact `audit.domain_events` entry; enforce per-source sequence roots;
and reject update or delete.

The TypeScript repository replays the complete shared `evidence-media:<id>`
semantic stream through `CanopyProofEvidenceMetadataRetentionAuthorityService`
before and after writes. Writes use serializable transactions and hashed,
bounded idempotency keys. Database constraints are the final write boundary;
the caller-supplied fact is never trusted on shape or lineage alone.

No API route is added. No background retention operation is scheduled by this
RFC. The repository is an internal persistence boundary for later approved
command handlers.

## Trust Model

Trusted inputs are limited to committed PostgreSQL authority:

- a registered evidence object and project/organization binding;
- an immutable media object and upload intent;
- consent and device projections at the fact's authority time;
- a media projection at extraction time;
- verified participant, membership, accreditation, or agent profile facts;
- the shared append-only semantic-event stream.

The application process, caller-provided snapshots, provider claims, metadata
extractor output, and storage-operation receipts are untrusted until checked.
AI or an agent may record advisory extraction or execution receipts. Only a
currently authorized human with `evidence_retention_governance` accreditation
may create a retention decision.

Provider integrations are intentionally fail-closed. Until an approved adapter
verifies signed provider receipts, durable commands accept only
`providerVerificationState = modeled_only`. Consequently an execution with a
`completed` provider claim still projects as pending, never as minimized,
disposed, retained, or under legal hold.

## Data Flow

```text
Durable E1 consent/device + E2 media + evidence registration
  -> caller derives a canonical E3b fact
  -> repository opens SERIALIZABLE transaction
  -> tenant and actor context are set locally
  -> idempotency and semantic-stream advisory locks are acquired
  -> committed stream and E3b facts are replayed
  -> proposed event and fact are replay-verified
  -> semantic event is appended
  -> PostgreSQL trigger revalidates source, actor, hash, sequence, and privacy
  -> fact is appended
  -> command receipt is appended
  -> transaction commits atomically
```

Reads require organization scope, rebuild the shared stream, and replay all E3b
facts before returning a fact or retention projection.

## Threat Model

The implementation must reject:

- raw EXIF, raw GPS coordinates, precise location, provider credentials, or
  unbounded free text embedded anywhere in a fact record;
- organization, project, evidence, subject, object, consent, or device
  substitution;
- metadata extraction from unavailable, quarantined, duplicate, expired, or
  consent-revoked media;
- a GPS commitment different from the registered evidence commitment;
- forged agent capabilities, stale memberships, missing retention accreditation,
  or cross-organization actors;
- sequence gaps, predecessor-root substitution, event-root substitution, and
  command-receipt replay with a different request;
- retention beyond consent, premature disposal before retention/object-lock
  barriers, and disposal while a legal hold governs the source;
- direct update/delete and cross-tenant reads;
- partial writes where the event, fact, or command receipt is absent.

Residual risks remain closed production gates: provider signature validation,
KMS-backed receipt verification, object-store lifecycle execution, legal-hold
operations, native PostgreSQL concurrency execution, and staffed privacy review.

## Internal API

The repository exposes only internal operations:

```text
commitFact(fact, idempotencyKey)
getFact(organizationId, evidenceId, factId)
loadAuthoritySnapshot(organizationId, evidenceId)
projectRetention(organizationId, evidenceId, sourceType, sourceId, evaluatedAt)
```

`commitFact` is intentionally fact-oriented because the command adapters for
metadata extraction and object-store lifecycle providers are not approved. A
future handler must derive the fact from durable sources and then use this
boundary; it may not expose the fact payload as a public write contract.

## Database Changes

The additive migration creates the three fact relations, canonical hash and
projection functions, source/actor/event validation triggers, append-only
triggers, indexes, and forced organization row-level security. The migration
requires `canopyproof-os.sql` first.

The fact record is retained for deterministic TypeScript replay. Indexed columns
are duplicated only where needed for foreign keys, tenant filtering, sequence
uniqueness, time ordering, and integrity checks. Constraints require those
columns to equal the canonical JSON fields.

## Migration Strategy

1. Apply the existing CanopyProof OS schema.
2. Apply `evidence-metadata-retention.sql` twice in a disposable environment to
   prove idempotency.
3. Run PGlite replay, tamper, tenant, idempotency, and atomicity tests.
4. Run the native PostgreSQL concurrency suite against an explicitly disposable
   database before opening a command handler.
5. Do not backfill process-memory facts. Historical records may be imported only
   when every source root and original event boundary can be independently
   proven; ambiguous records remain quarantined outside authority.
6. Keep all E3b HTTP routes disabled until provider, privacy, and operations
   reviews approve a command-specific adapter.

## Rollback Strategy

Rollback is operationally fail-closed:

1. disable future E3b command handlers and workers;
2. preserve committed facts and semantic events for audit;
3. use the rollback script only for an unpopulated disposable installation;
4. never delete production authority to perform an application rollback.

The rollback script refuses to drop non-empty fact relations. Application code
can be rolled back while the additive relations remain. A rollback cannot
promote modeled provider receipts, fabricate source roots, rewrite audit history,
or relax the CanopyProof claim boundaries.

## Safety Boundary

This authority does not issue final environmental proof, a certificate,
certified carbon credit, carbon-tax offset, financial asset, guaranteed yield,
mainnet-fund instruction, or automatic CANOPY distribution. It handles no
private key and does not change the separated Cloudflare API/Web Worker routes.
