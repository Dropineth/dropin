# RFC: Effective Media Projection and Durable Metadata Orchestration

Status: ACCEPTED FOR DEFAULT-OFF IMPLEMENTATION

Date: 2026-07-17

Production activation: CLOSED. This RFC does not mount an API route, provision
an extractor, grant object-store access, select a signer, or authorize evidence
for proof, certification, finance, or public claims.

## 1. Problem Statement

CanopyProof currently retains three intentionally separate histories:

1. E1 media facts describe the upload intent, stored object, duplicate
   relation, and malware scan. Provider and scanner trust in these base facts
   may remain `modeled_only`.
2. E2a adapter facts independently verify the storage-provider receipt,
   retention policy, and scanner signature without rewriting E1.
3. E3b/E3c facts retain a minimized metadata extraction and its independent
   signed-receipt verification without rewriting the base extraction.

This separation is correct, but the current E3c runtime prerequisite consumes
only the E1 media projection. An E1 object that truthfully remains
`needs_review` cannot become `available` merely because E2a verification facts
exist. Weakening E3c to accept `needs_review`, or mutating E1 to say `verified`,
would erase provenance and allow caller-modeled trust to cross the provider
boundary.

The existing projections also have an as-of replay defect: some queries select
the latest scan, duplicate relation, or adapter verification regardless of
whether the fact occurred after `evaluatedAt`. A historical projection can
therefore depend on future facts.

Finally, E3c derives its command hash from the provider receipt. That value is
unknown before external I/O, so it cannot be the durable idempotency identity
for an extraction attempt. A timeout followed by retry can invoke the provider
again without a durable request record.

## 2. Decision

Implement two additive authorities and one default-off workflow:

1. Correct E1 and E2a projections to be strict, deterministic as-of
   projections.
2. Add `effective_media_object_projection`, a derived authority that combines
   the unchanged E1 base projection with the unchanged E2a receipt-trust
   projection.
3. Add an append-only metadata extraction request fact before external I/O.
   The request root is known before dispatch and is the provider correlation
   and idempotency identity.
4. Add a route-closed orchestrator that persists or replays the request,
   invokes the extractor outside every database transaction, then appends the
   modeled E3b extraction and E3c verification facts.

No base fact is promoted or rewritten. The effective projection is eligibility
for a narrow metadata-extraction operation, not final evidence truth.

## 3. Trust Model

- E1 is authoritative for object identity, consent/device lineage, duplicate
  relations, scan verdicts, and immutable content bindings.
- E2a is authoritative only for independent verification of provider,
  retention, and scanner receipts. Its own safety boundary continues to state
  `notAvailabilityDecision = true`.
- The effective projection is authoritative only for combining E1 hard state
  with E2a verified receipt state under a fixed policy.
- E3b remains authoritative for the minimized extraction payload and remains
  `modeled_only` by construction.
- E3c remains authoritative for the independent signature-verification fact.
- The extractor is untrusted until strict schema, hash, signer, signature,
  object, consent, device, GPS, privacy, policy, and timestamp checks pass.
- AI, scanners, storage providers, and metadata extractors cannot approve
  evidence, issue a certificate, authorize an unlock, move funds, or make a
  carbon or yield claim.

## 4. As-Of Projection Rules

Every projection must be a pure function of facts visible at `evaluatedAt`.

- Reject an evaluation before the object `storedAt`.
- Ignore duplicate relations where `detectedAt > evaluatedAt`.
- Ignore scans where `scannedAt > evaluatedAt`; among visible scans, select by
  descending evidence sequence and ID.
- Ignore provider or scanner verification facts where
  `verifiedAt > evaluatedAt`.
- Require an E2a scanner verification to bind the exact visible latest scan.
- Emit optional fields only when the source fact exists. SQL must use
  `jsonb_strip_nulls` so SQL and TypeScript roots are byte-for-byte equivalent.
- Reject a supplied projection whose root, source roots, identity scope, or
  evaluation timestamp cannot be recomputed.

Future facts must never alter an older projection root.

## 5. Effective Media State Machine

The combined projection binds the E1 projection root and E2a projection root.
It preserves every E1 hard state:

| E1 state | Effective state | Reason |
| --- | --- | --- |
| `duplicate` | `duplicate` | Duplicate content is never extractable. |
| `pending_scan` | `pending_scan` | No clean scan exists at the evaluation time. |
| `quarantined` | `quarantined` | Scan, consent, or device state is unsafe. |
| `needs_review` or `available` | `needs_review` | E2a state is not `verified_receipts`. |
| `needs_review` or `available` | `available` | E2a provider, retention, and exact latest scanner receipts are verified, consent is active, device is current, object lock is effective, and the latest scan is clean. |

The final row cannot promote a hard E1 state. It only replaces caller-modeled
provider/scanner trust with immutable E2a verification. The projection includes
canonical issue codes explaining every unmet prerequisite.

The effective projection root is:

```text
SHA-256(stable-json({
  kind: "canopyproof-effective-media-object-projection-v1",
  objectId,
  objectRoot,
  organizationId,
  projectId,
  evidenceId,
  baseProjectionRoot,
  adapterTrustProjectionRoot,
  state,
  issueCodes,
  evaluatedAt,
  safety
}))
```

## 6. Durable Request Model

`evidence.metadata_extraction_request_facts` is append-only and contains only
minimized authority material known before I/O:

- tenant, project, evidence, object, and object roots;
- effective media, consent, and device projection roots;
- registered GPS hash and privacy mode;
- fixed extractor ID, version, image digest, schema version, policy root, and
  approved signer-set root;
- requester-agent authority snapshot;
- requested timestamp, deterministic request hash/root, semantic-event root,
  and hashed command idempotency receipt.

It contains no raw EXIF, GPS, coordinate, signature, provider credential,
presigned URL, media bytes, or free-form provider output.

Each request binds a deterministic five-minute dispatch expiry. Immediately
before external I/O, the repository opens a coherent repeatable-read snapshot
and rechecks current effective media, consent, device, object, GPS/privacy, and
requester-agent authority. A pending request is not dispatchable after expiry,
consent revocation, device expiry, media quarantine/duplication, or agent
deactivation. Completed facts remain historically replayable.

The caller supplies an idempotency key. The repository stores only its
organization/object/requester/operation-scoped hash.
The canonical request hash excludes the raw key and is derived before I/O. The
request ID is deterministic from actor, operation, idempotency-key hash, and
request hash. Reusing a key with different authority or policy is a conflict.

## 7. Workflow and Failure Semantics

```text
load as-of authorities
  -> append/replay extraction request in SERIALIZABLE transaction
  -> close transaction
  -> recheck current authority and dispatch expiry in REPEATABLE READ
  -> close transaction
  -> invoke fixed extractor with request ID as correlation identity
  -> verify and minimize signed receipt in memory
  -> construct modeled E3b fact from the exact request and receipt
  -> commit/replay E3b fact in SERIALIZABLE transaction
  -> construct E3c verification fact from the exact E3b fact and receipt
  -> commit/replay E3c fact in SERIALIZABLE transaction
  -> return effective E3c projection
```

The workflow is a safe append-only saga, not a distributed transaction:

- Failure before request commit leaves no fact.
- Expired or currently unauthorized requests leave the pending request intact
  and perform no external I/O.
- Provider outage after request commit leaves one auditable pending request and
  no extraction or verification success.
- Failure after E3b commit leaves a truthful `needs_review` modeled extraction.
- Failure after E3c commit is replayed from durable facts.
- Exact retries reuse the request identity and must not create another request,
  E3b fact, or E3c fact.
- A provider may still receive a retry after an ambiguous network timeout. The
  fixed request ID is mandatory so the provider can return the same result.
  Exactly-once external execution is not claimed; durable at-most-one logical
  result is enforced locally.

External calls are forbidden inside database transactions. Repository methods
must lock command identity first, then semantic streams in lexical order, then
object/extraction rows. No method may acquire the same resources in a different
order.

## 8. API Design

Domain interfaces are route-closed:

- `prepareMetadataExtractionRequest(command)` appends or replays the request
  fact and returns the exact authority snapshot used by the request.
- `findMetadataExtractionResult(prepared)` returns an already completed E3b +
  E3c result when present.
- `assertMetadataExtractionDispatchAuthorized(prepared, dispatchedAt)` rejects
  expired or currently revoked authority in a coherent database snapshot.
- `commitMetadataExtractionResult(prepared, receipt)` appends deterministic
  E3b and E3c descendants through their existing authorities. SQL insert
  triggers recompute current authority at the committed timestamp and reject
  drift.
- `extractMetadata(command)` orchestrates those calls and the fixed adapter.

No public HTTP route is added by this RFC. A future route requires separate
security, privacy, governance, evidence-operations, and platform approval.

## 9. Database Changes

The additive migration must:

- correct E1 and E2a as-of projection functions;
- add `evidence.effective_media_object_projection(object_id, evaluated_at)`;
- add immutable metadata extraction request facts, forced organization RLS,
  recursive forbidden-key checks, exact JSON allowlists, deterministic SQL root
  recomputation, semantic-event binding, and mutation audit;
- update E3b validation to bind the effective media projection root rather than
  the E1 base root; and
- preserve all existing E1, E2a, E3b, and E3c rows.

The request stream is `evidence-metadata-request:<evidenceId>`. E3b remains on
`evidence-media:<evidenceId>` and E3c remains on
`evidence-metadata-adapter:<evidenceId>`.

## 10. Threat Model

The implementation must reject:

- future-fact leakage into historical replay;
- caller-supplied `available`, copied projection objects, root substitution,
  cross-tenant object/projection reuse, or mismatched evaluation timestamps;
- a scanner verification for a non-latest or different scan;
- duplicate, quarantined, revoked-consent, stale-device, unlocked-retention, or
  unverified media;
- idempotency-key reuse with changed object, authority, extractor, signer set,
  policy, timestamp, or privacy mode;
- stale pending requests, post-request consent revocation, media quarantine,
  device expiry, or requester deactivation causing another external dispatch;
- concurrent requests that create multiple logical extraction attempts;
- provider timeout, malformed response, invalid signature, or process crash
  being represented as success;
- replaying a receipt against another request, object, extraction, policy,
  signer, or time;
- raw metadata, raw location, raw signatures, media bytes, secrets, URLs, or
  credentials in request, event, receipt, error, or audit material; and
- any automatic proof, certificate, fund, token, tax, credit, or yield action.

## 11. Migration Strategy

1. Ship corrected projections and deterministic parity tests.
2. Ship the effective projection and update E3b/E3c authority types while
   keeping the route closed.
3. Add request facts, repository, and in-memory deterministic orchestration
   tests.
4. Run migrations twice in PGlite and native PostgreSQL, prove replay/root
   parity, RLS, append-only triggers, and rollback refusal.
5. Keep all adapters disabled in the application composition root.
6. Before any activation, approve extractor sandboxing, object-store
   capability, signer ceremony, privacy retention, egress, observability,
   staffed exception handling, and incident response.

Existing facts are not backfilled or promoted. Operators may recompute derived
projections at a requested time, but must not manufacture E2a or E3c facts.

## 12. Rollback Strategy

- Disable the future composition-root selection and revoke extractor access.
- Preserve request, E3b, and E3c append-only facts.
- Project incomplete or affected attempts as pending or needs-review.
- A destructive rollback is allowed only for an unpopulated disposable
  installation and must refuse when request facts exist.
- Never restore future-leaking projection definitions. A rollback must retain
  the corrected as-of semantics even if the effective workflow is disabled.

## 13. Acceptance Gates

- TypeScript and SQL roots match for E1, E2a, effective media, E3b, and E3c.
- Historical replay is unchanged by facts appended after `evaluatedAt`.
- Concurrent same-key requests produce one logical request; changed payloads
  conflict.
- Provider outage leaves a pending request and no E3b/E3c success.
- Current-authority revocation or dispatch expiry prevents provider I/O while
  preserving the pending request for audit.
- Invalid or forged receipts leave no E3b/E3c success.
- A crash between E3b and E3c is safely resumable without rewriting E3b.
- Raw metadata, location, signatures, and secrets are absent from durable
  records and errors.
- PGlite/native PostgreSQL tests prove RLS, trigger, idempotency, temporal, and
  mutation controls.
- Existing CI, audit, coverage ratchet, API build, and OpenNext build remain
  green.
- Route mounting and production activation remain false.

## 14. Implementation Checkpoint

Implemented and locally verified on 2026-07-17:

- strict E1/E2a as-of filtering and SQL/TypeScript replay parity;
- derived effective-media authority that preserves duplicate, pending-scan,
  quarantine, consent, and device hard states;
- append-only E3d request facts with forced RLS, exact JSON allowlists,
  recursive secret rejection, deterministic SQL roots, semantic-event and
  command-receipt binding, and non-empty rollback refusal;
- a Prisma repository with serializable request and verification writes,
  advisory locking, contextual idempotency hashing, a five-minute dispatch
  expiry, coherent current-authority revalidation, and no provider I/O inside
  a database transaction;
- a route-closed orchestrator that persists the request before I/O, minimizes
  the signed response, commits E3b and E3c separately, and resumes safely after
  provider failure; and
- adversarial unit tests plus an executed PGlite chain covering exact replay,
  changed-key conflict, expiry, post-request consent revocation,
  raw-signature/idempotency exclusion, root parity, RLS, append-only mutation
  rejection, and rollback refusal. The native PostgreSQL
  migration list includes E3d; its opt-in gate still requires a disposable
  native database and is not claimed as executed by this checkpoint.

Production activation remains blocked. The public trust-registry write path
still refuses caller-asserted `verified` device attestations. A default-off E1a
adapter now verifies signed fixture receipts into a separate append-only fact,
and effective-media v2 binds its effective device projection while the E1 row
remains `modeled_only`. This closes the deterministic local reachability gap;
it does not supply a durable unpredictable online nonce store, live provider
protocol validator, revocation feed, approved key ceremony, endpoint,
credential, composition root, route, parser service, queue, monitoring, or
field validation. None of those production capabilities or flags was enabled.
