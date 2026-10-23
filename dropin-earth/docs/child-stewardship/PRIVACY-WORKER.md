# Synthetic privacy worker and stored-copy evidence

[ChildPrivacyWorker](../../services/api/src/domain/child-stewardship/privacy.ts)
processes durable export/deletion requests against the native inventory. It
actually deletes authorized local stored bytes and derived learning rows, creates
purpose-limited ordinary-learning exports, expires those exports, and appends
immutable deletion/retention receipts. Protected cases, rights and replay facts
remain under their separate purposes. External processor copies remain waiting
without an actual provider acknowledgement; local success is not global erasure.

The worker requires a separately admitted actual LOGIN. Readiness rejects
owner/privileged connections, SET ROLE impersonation, any other role membership,
expired/revoked admission, and conflicting authority scopes. Optional installed
registries must be readable to establish separation; missing evidence fails
closed. Checks use the actual transaction connection and repeat after waiting
for the session lock. No production role or permission is provisioned here.

`processSession(sessionId, limit)` drains a bounded batch of durable pending jobs
and expired exports; the limit is 1–100. Requested work precedes waiting external
processors. `more` is a conservative indication that another batch may be needed.
The method supplies no production scheduler or external provider. Operational
fairness, scheduling, retries and real inventory completeness require deployment
acceptance; calling the method is not evidence that every external copy is gone.

When restoration is quarantined, exports and deletion both stop. An older backup
may be missing a newer legal/protection hold, so local cleanup cannot proceed
until the current retained-state checkpoint is verified. Every processing path
requires the shared external-anchor check under the session lock. With a current admitted retention checkpoint, expired interactive sessions may still undergo deletion and export expiry through the separate cleanup gate; they cannot create or read new exports. An expired pending export is excluded from the bounded job drain so it cannot starve eligible deletion.
`ChildRestoreAnchorProvider` must reread independently current evidence outside
the restored database; no cached or browser-supplied anchor is accepted. Ordinary
views/results continue to hide physical worker state and protected-retention
existence.

The lifecycle/worker suite records 12/12 native passes, including genuine LOGIN,
RESET ROLE/SET ROLE denial, owner/runtime membership rejection, latest expiry and
revocation, expiry during a real lock wait, bounded draining, actual erasure,
export expiry, immutable receipts and complete ordinary-view non-disclosure.
The separate SQL-authority suite records 10/10, now also using genuine LOGIN; it
preserves its forgery/retention tests and verifies that actual restore quarantine
blocks export creation and all deletion/drain paths without changing stored bytes,
job state or receipts. It also exercises current-checkpoint cleanup of expired sessions, stale-anchor rejection, mixed expired export/deletion queues, and a delayed provider crossing the checkpoint deadline before export creation.
Receipts: `build/child-privacy-worker-native.tap` and
`build/child-privacy-authority-login.tap`, outside the repository.

The existing privacy rollback template requires workers/public processing to be
paused **before** running it. Its `REVOKE ... FROM PUBLIC` does not remove explicit
worker grants and does not itself stop those workers. Suppressions, deletion
receipts, holds and pending backup expiry must survive rollback. No automated
production pause, provider deletion, human approval or deployment is claimed.
