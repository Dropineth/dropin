import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { hashHex } from "@dropin/crypto";
import { app } from "../../services/api/src/app.js";
import {
  buildCanopyProofDatabaseAuditCheckpoint,
  buildCanopyProofDatabaseAuditEvent,
  CANOPYPROOF_DATABASE_AUDIT_GENESIS_HASH,
  CANOPYPROOF_DATABASE_AUDIT_NULL_STATE_HASH,
  canopyProofDatabaseAuditTransparencyStatus,
  verifyCanopyProofDatabaseAuditStream,
  type CanopyProofDatabaseAuditEvent,
} from "../../services/api/src/domain/canopyproof/database-audit-transparency.js";

const rowPkHash = hashHex("cp_org_database_audit_001");
const stateOneHash = hashHex('{"id":"cp_org_database_audit_001","status":"pending"}');
const stateTwoHash = hashHex('{"id":"cp_org_database_audit_001","status":"verified"}');

function databaseAuditStream() {
  const first = buildCanopyProofDatabaseAuditEvent({
    schemaName: "organizations",
    tableName: "organizations",
    rowPkHash,
    sequenceNo: 1,
    action: "INSERT",
    actorId: "admin_database_audit",
    recordedAtUnixMicros: "1783644000000000",
    previousEventHash: CANOPYPROOF_DATABASE_AUDIT_GENESIS_HASH,
    beforeStateHash: CANOPYPROOF_DATABASE_AUDIT_NULL_STATE_HASH,
    afterStateHash: stateOneHash,
  });
  const second = buildCanopyProofDatabaseAuditEvent({
    schemaName: "organizations",
    tableName: "organizations",
    rowPkHash,
    sequenceNo: 2,
    action: "UPDATE",
    actorId: "verifier_database_audit",
    recordedAtUnixMicros: "1783644000000001",
    previousEventHash: first.eventHash,
    beforeStateHash: stateOneHash,
    afterStateHash: stateTwoHash,
  });
  return [first, second] as const;
}

function headers(role: string, actorId = `${role}_database_audit_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test("CanopyProof database audit transparency replays a full stream and checkpoint independently", () => {
  const entries = databaseAuditStream();
  const checkpoint = buildCanopyProofDatabaseAuditCheckpoint(entries, "auditor_database_audit", "1783644000000002");
  const verification = verifyCanopyProofDatabaseAuditStream({
    entries,
    checkpoint,
    verifiedAt: "2026-07-10T00:00:00.000Z",
  });

  assert.equal(verification.valid, true);
  assert.equal(verification.eventCount, 2);
  assert.equal(verification.firstSequenceNo, "1");
  assert.equal(verification.lastSequenceNo, "2");
  assert.equal(verification.terminalEventHash, entries[1].eventHash);
  assert.equal(verification.checkpointSupplied, true);
  assert.equal(verification.checkpointValid, true);
  assert.equal(verification.issues.length, 0);
  assert.match(verification.eventRoot, /^[a-f0-9]{64}$/);
  assert.match(verification.verificationRoot, /^[a-f0-9]{64}$/);
  assert.equal(verification.safety.rawRowsExcluded, true);
  assert.equal(verification.safety.noAutomatedFinalAuthority, true);
  assert.equal(entries[0].eventHash, "7dd79240d591a17d4cb4d9f1d7ba84a5d001c1f9847cdf9a85794d326fcfee9b");
  assert.equal(entries[1].eventHash, "aee7f5eff3a4f5a84e7542456dfc5599fefa81b36cc887102ee00465e428ef90");
  assert.equal(checkpoint.eventRoot, "d56e2068ee43d1ba24f5f894d616d0e4a8c9a8245c5e3fbd4afdeec4c1241578");
  assert.equal(checkpoint.checkpointHash, "1c17cfd271fc767bc940e6b101665783b55635df6e536f01d3f53a88ec5b4edb");
});

test("CanopyProof database audit transparency detects mutation, gaps, duplicates, mixed streams, and checkpoint forgery", () => {
  const entries = databaseAuditStream();
  const checkpoint = buildCanopyProofDatabaseAuditCheckpoint(entries, "auditor_database_audit", "1783644000000002");
  const tampered = verifyCanopyProofDatabaseAuditStream({
    entries: [{ ...entries[0], actorId: "attacker" }, entries[1]],
  });
  const gap = verifyCanopyProofDatabaseAuditStream({ entries: [entries[1]] });
  const duplicate = verifyCanopyProofDatabaseAuditStream({ entries: [entries[0], entries[0]] });
  const otherStreamEvent = buildCanopyProofDatabaseAuditEvent({
    schemaName: "organizations",
    tableName: "organizations",
    rowPkHash: hashHex("cp_org_database_audit_other"),
    sequenceNo: 2,
    action: "UPDATE",
    actorId: "verifier_database_audit",
    recordedAtUnixMicros: "1783644000000001",
    previousEventHash: entries[0].eventHash,
    beforeStateHash: stateOneHash,
    afterStateHash: stateTwoHash,
  });
  const mixed = verifyCanopyProofDatabaseAuditStream({ entries: [entries[0], otherStreamEvent] });
  const invalidStreamKeyEntries = [
    {
      ...entries[0],
      streamKey: `organizations.organizations:${"f".repeat(64)}`,
    },
    entries[1],
  ] as const;
  const invalidStreamKey = verifyCanopyProofDatabaseAuditStream({
    entries: invalidStreamKeyEntries,
  });
  const forgedCheckpoint = verifyCanopyProofDatabaseAuditStream({
    entries,
    checkpoint: { ...checkpoint, eventRoot: "f".repeat(64) },
  });

  assert.equal(tampered.valid, false);
  assert.ok(tampered.issues.some((issue) => issue.code === "invalid_event_hash"));
  assert.equal(gap.valid, false);
  assert.ok(gap.issues.some((issue) => issue.code === "sequence_gap"));
  assert.ok(gap.issues.some((issue) => issue.code === "invalid_genesis_link"));
  assert.equal(duplicate.valid, false);
  assert.ok(duplicate.issues.some((issue) => issue.code === "duplicate_sequence"));
  assert.ok(duplicate.issues.some((issue) => issue.code === "duplicate_event_hash"));
  assert.equal(mixed.valid, false);
  assert.ok(mixed.issues.some((issue) => issue.code === "mixed_stream"));
  assert.equal(invalidStreamKey.valid, false);
  assert.ok(
    invalidStreamKey.issues.some((issue) => issue.code === "invalid_stream_key"),
  );
  assert.throws(
    () =>
      buildCanopyProofDatabaseAuditCheckpoint(
        invalidStreamKeyEntries,
        "auditor_invalid_stream",
        "1783644000000002",
      ),
    /requires a valid full stream/,
  );
  assert.equal(forgedCheckpoint.valid, false);
  assert.equal(forgedCheckpoint.checkpointValid, false);
  assert.ok(forgedCheckpoint.issues.some((issue) => issue.code === "checkpoint_event_root_mismatch"));
  assert.ok(forgedCheckpoint.issues.some((issue) => issue.code === "invalid_checkpoint_hash"));
});

test("CanopyProof database audit transparency API is human-RBAC protected and returns replay findings", async () => {
  const entries = databaseAuditStream();
  const checkpoint = buildCanopyProofDatabaseAuditCheckpoint(entries, "auditor_database_audit", "1783644000000002");

  const anonymous = await app.request("/canopyproof/audit/database-streams/status");
  const agent = await app.request("/canopyproof/audit/database-streams/status", { headers: headers("agent") });
  const statusResponse = await app.request("/canopyproof/audit/database-streams/status", { headers: headers("observer") });
  const statusBody = await json<{ ok: true; data: ReturnType<typeof canopyProofDatabaseAuditTransparencyStatus> }>(statusResponse);
  const verified = await app.request("/canopyproof/audit/database-streams/verify", {
    method: "POST",
    headers: headers("observer"),
    body: JSON.stringify({ entries, checkpoint, verifiedAt: "2026-07-10T00:00:00.000Z" }),
  });
  const verifiedBody = await json<{ ok: true; data: { valid: boolean; checkpointValid: boolean } }>(verified);
  const tamperedEntries: readonly CanopyProofDatabaseAuditEvent[] = [{ ...entries[0], afterStateHash: "e".repeat(64) }, entries[1]];
  const rejected = await app.request("/canopyproof/audit/database-streams/verify", {
    method: "POST",
    headers: headers("verifier"),
    body: JSON.stringify({ entries: tamperedEntries }),
  });
  const rejectedBody = await json<{ ok: true; data: { valid: boolean; issues: Array<{ code: string }> } }>(rejected);

  assert.equal(anonymous.status, 401);
  assert.equal(agent.status, 403);
  assert.equal(statusResponse.status, 200);
  assert.equal(statusBody.data.eventVersion, "canopyproof_db_audit_v2");
  assert.equal(statusBody.data.safety.hashOnlyInput, true);
  assert.equal(verified.status, 200);
  assert.equal(verifiedBody.data.valid, true);
  assert.equal(verifiedBody.data.checkpointValid, true);
  assert.equal(rejected.status, 422);
  assert.equal(rejectedBody.data.valid, false);
  assert.ok(rejectedBody.data.issues.some((issue) => issue.code === "invalid_event_hash"));
});

test("CanopyProof SQL contract serializes hash-only database audit streams and preserves checkpoints", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit\.event_log \(/);
  assert.match(sql, /event_version text NOT NULL DEFAULT 'canopyproof_db_audit_v2'/);
  assert.match(sql, /stream_key text NOT NULL/);
  assert.match(sql, /row_pk_hash text NOT NULL/);
  assert.match(sql, /sequence_no bigint NOT NULL/);
  assert.match(sql, /recorded_at_unix_micros bigint NOT NULL/);
  assert.match(sql, /before_state_hash text NOT NULL/);
  assert.match(sql, /after_state_hash text NOT NULL/);
  assert.match(sql, /extract\(epoch FROM created_at\)[\s\S]*recorded_at_unix_micros/);
  assert.match(sql, /UNIQUE \(stream_key, sequence_no\)/);
  assert.match(sql, /UNIQUE \(stream_key, event_hash\)/);
  assert.doesNotMatch(sql, /before_state jsonb/);
  assert.doesNotMatch(sql, /after_state jsonb/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION audit\.length_prefix/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION audit\.compute_event_log_hash/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION audit\.validate_event_log_insert/);
  assert.match(sql, /audit_event_log_validate_insert/);
  assert.match(sql, /audit event insert requires matching app\.actor_id transaction context/);
  assert.match(sql, /audited mutation requires app\.actor_id transaction context/);
  assert.match(sql, /audited mutation requires a non-empty id primary key/);
  assert.match(sql, /pg_advisory_xact_lock\(hashtextextended\(target_stream_key, 0\)\)/);
  assert.match(sql, /ORDER BY sequence_no DESC[\s\S]+LIMIT 1[\s\S]+FOR UPDATE/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit\.event_log_checkpoints/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION audit\.create_event_log_checkpoint/);
  assert.match(sql, /CREATE OR REPLACE FUNCTION audit\.validate_event_log_checkpoint_insert/);
  assert.match(sql, /audit_event_log_checkpoints_validate_insert/);
  assert.match(sql, /audit_event_log_checkpoints_no_update/);
  assert.match(sql, /audit_event_log_checkpoints_no_delete/);
});
