import { hashHex, hashJson } from "@dropin/crypto";
import { z } from "zod";

export const CANOPYPROOF_DATABASE_AUDIT_EVENT_VERSION = "canopyproof_db_audit_v2" as const;
export const CANOPYPROOF_DATABASE_AUDIT_CHECKPOINT_VERSION = "canopyproof_db_audit_checkpoint_v1" as const;
export const CANOPYPROOF_DATABASE_AUDIT_MAX_EVENTS = 1_000;
export const CANOPYPROOF_DATABASE_AUDIT_GENESIS_HASH = hashHex("canopyproof-db-audit-genesis-v2");
export const CANOPYPROOF_DATABASE_AUDIT_NULL_STATE_HASH = hashHex("canopyproof-db-audit-null-state-v2");

export const canopyProofDatabaseAuditActions = ["INSERT", "UPDATE", "DELETE"] as const;
export type CanopyProofDatabaseAuditAction = (typeof canopyProofDatabaseAuditActions)[number];

export type CanopyProofDatabaseAuditEvent = {
  readonly eventVersion: typeof CANOPYPROOF_DATABASE_AUDIT_EVENT_VERSION;
  readonly streamKey: string;
  readonly schemaName: string;
  readonly tableName: string;
  readonly rowPkHash: string;
  readonly sequenceNo: string;
  readonly action: CanopyProofDatabaseAuditAction;
  readonly actorId: string;
  readonly recordedAtUnixMicros: string;
  readonly previousEventHash: string;
  readonly beforeStateHash: string;
  readonly afterStateHash: string;
  readonly eventHash: string;
};

export type CanopyProofDatabaseAuditCheckpoint = {
  readonly checkpointVersion: typeof CANOPYPROOF_DATABASE_AUDIT_CHECKPOINT_VERSION;
  readonly streamKey: string;
  readonly firstSequenceNo: "1";
  readonly lastSequenceNo: string;
  readonly eventCount: number;
  readonly firstEventHash: string;
  readonly terminalEventHash: string;
  readonly eventRoot: string;
  readonly createdBy: string;
  readonly createdAtUnixMicros: string;
  readonly checkpointHash: string;
};

export const canopyProofDatabaseAuditVerificationIssueCodes = [
  "mixed_stream",
  "invalid_stream_key",
  "sequence_gap",
  "duplicate_sequence",
  "duplicate_event_hash",
  "invalid_genesis_link",
  "invalid_previous_event_hash",
  "non_monotonic_recorded_at",
  "invalid_event_hash",
  "checkpoint_stream_mismatch",
  "checkpoint_range_mismatch",
  "checkpoint_event_count_mismatch",
  "checkpoint_first_hash_mismatch",
  "checkpoint_terminal_hash_mismatch",
  "checkpoint_event_root_mismatch",
  "invalid_checkpoint_hash",
] as const;

export type CanopyProofDatabaseAuditVerificationIssueCode =
  (typeof canopyProofDatabaseAuditVerificationIssueCodes)[number];

export type CanopyProofDatabaseAuditVerificationIssue = {
  readonly code: CanopyProofDatabaseAuditVerificationIssueCode;
  readonly index?: number;
  readonly expected?: string;
  readonly actual?: string;
};

export type CanopyProofDatabaseAuditVerification = {
  readonly valid: boolean;
  readonly eventCount: number;
  readonly streamKey: string;
  readonly firstSequenceNo: "1";
  readonly lastSequenceNo: string;
  readonly firstEventHash: string;
  readonly terminalEventHash: string;
  readonly eventRoot: string;
  readonly checkpointSupplied: boolean;
  readonly checkpointValid: boolean;
  readonly verifiedAt: string;
  readonly issues: readonly CanopyProofDatabaseAuditVerificationIssue[];
  readonly verificationRoot: string;
  readonly safety: {
    readonly hashOnlyInput: true;
    readonly rawRowsExcluded: true;
    readonly actorAndTimestampBound: true;
    readonly sequenceContinuityChecked: true;
    readonly previousHashesLinked: true;
    readonly checkpointRecomputedWhenProvided: true;
    readonly independentReplayRequired: true;
    readonly noAutomatedFinalAuthority: true;
    readonly notCarbonCredit: true;
    readonly notFinancialAsset: true;
    readonly notTaxOffset: true;
    readonly notGuaranteedYield: true;
  };
};

const identifierSchema = z.string().trim().regex(/^[a-z_][a-z0-9_]{0,62}$/);
const sha256Schema = z.string().trim().regex(/^[a-f0-9]{64}$/i).transform((value) => value.toLowerCase());
const positiveIntegerTextSchema = z
  .union([z.string().trim().regex(/^[1-9][0-9]{0,18}$/), z.number().int().positive().safe()])
  .transform((value) => String(value))
  .refine((value) => BigInt(value) <= 9_223_372_036_854_775_807n, "Value exceeds signed PostgreSQL bigint range.");
const streamKeySchema = z
  .string()
  .trim()
  .regex(/^[a-z_][a-z0-9_]{0,62}\.[a-z_][a-z0-9_]{0,62}:[a-f0-9]{64}$/i)
  .transform((value) => value.toLowerCase());

const databaseAuditEventSchema = z
  .object({
    eventVersion: z.literal(CANOPYPROOF_DATABASE_AUDIT_EVENT_VERSION),
    streamKey: streamKeySchema,
    schemaName: identifierSchema,
    tableName: identifierSchema,
    rowPkHash: sha256Schema,
    sequenceNo: positiveIntegerTextSchema,
    action: z.enum(canopyProofDatabaseAuditActions),
    actorId: z.string().trim().min(1).max(256),
    recordedAtUnixMicros: positiveIntegerTextSchema,
    previousEventHash: sha256Schema,
    beforeStateHash: sha256Schema,
    afterStateHash: sha256Schema,
    eventHash: sha256Schema,
  })
  .strict();

const databaseAuditCheckpointSchema = z
  .object({
    checkpointVersion: z.literal(CANOPYPROOF_DATABASE_AUDIT_CHECKPOINT_VERSION),
    streamKey: streamKeySchema,
    firstSequenceNo: z.literal("1"),
    lastSequenceNo: positiveIntegerTextSchema,
    eventCount: z.number().int().positive().max(CANOPYPROOF_DATABASE_AUDIT_MAX_EVENTS),
    firstEventHash: sha256Schema,
    terminalEventHash: sha256Schema,
    eventRoot: sha256Schema,
    createdBy: z.string().trim().min(1).max(256),
    createdAtUnixMicros: positiveIntegerTextSchema,
    checkpointHash: sha256Schema,
  })
  .strict();

const databaseAuditVerificationRequestSchema = z
  .object({
    entries: z.array(databaseAuditEventSchema).min(1).max(CANOPYPROOF_DATABASE_AUDIT_MAX_EVENTS),
    checkpoint: databaseAuditCheckpointSchema.optional(),
    verifiedAt: z.string().datetime().optional(),
  })
  .strict();

export function canopyProofDatabaseAuditTransparencyStatus() {
  return {
    service: "canopyproof-database-audit-transparency" as const,
    eventVersion: CANOPYPROOF_DATABASE_AUDIT_EVENT_VERSION,
    checkpointVersion: CANOPYPROOF_DATABASE_AUDIT_CHECKPOINT_VERSION,
    maxEventsPerVerification: CANOPYPROOF_DATABASE_AUDIT_MAX_EVENTS,
    genesisHash: CANOPYPROOF_DATABASE_AUDIT_GENESIS_HASH,
    nullStateHash: CANOPYPROOF_DATABASE_AUDIT_NULL_STATE_HASH,
    actions: canopyProofDatabaseAuditActions,
    safety: databaseAuditSafetyBoundary(),
  };
}

export function buildCanopyProofDatabaseAuditStreamKey(schemaName: string, tableName: string, rowPkHash: string) {
  const parsed = z
    .object({ schemaName: identifierSchema, tableName: identifierSchema, rowPkHash: sha256Schema })
    .strict()
    .parse({ schemaName, tableName, rowPkHash });
  return `${parsed.schemaName}.${parsed.tableName}:${parsed.rowPkHash}`;
}

export function buildCanopyProofDatabaseAuditEvent(
  input: Readonly<{
    schemaName: string;
    tableName: string;
    rowPkHash: string;
    sequenceNo: string | number;
    action: CanopyProofDatabaseAuditAction;
    actorId: string;
    recordedAtUnixMicros: string | number;
    previousEventHash: string;
    beforeStateHash: string;
    afterStateHash: string;
  }>,
): CanopyProofDatabaseAuditEvent {
  const seed = databaseAuditEventSchema
    .omit({ eventHash: true, streamKey: true, eventVersion: true })
    .parse(input);
  const streamKey = buildCanopyProofDatabaseAuditStreamKey(seed.schemaName, seed.tableName, seed.rowPkHash);
  const eventWithoutHash = {
    eventVersion: CANOPYPROOF_DATABASE_AUDIT_EVENT_VERSION,
    streamKey,
    ...seed,
  };
  return {
    ...eventWithoutHash,
    eventHash: hashHex(databaseAuditEventHashMaterial(eventWithoutHash)),
  };
}

export function buildCanopyProofDatabaseAuditCheckpoint(
  entries: readonly CanopyProofDatabaseAuditEvent[],
  createdBy: string,
  createdAtUnixMicros: string | number,
): CanopyProofDatabaseAuditCheckpoint {
  const replay = verifyCanopyProofDatabaseAuditStream({ entries });
  if (!replay.valid) {
    throw new Error(`CanopyProof database audit checkpoint requires a valid full stream: ${replay.issues.map((issue) => issue.code).join(",")}`);
  }
  const seed = databaseAuditCheckpointSchema
    .omit({ checkpointHash: true })
    .parse({
      checkpointVersion: CANOPYPROOF_DATABASE_AUDIT_CHECKPOINT_VERSION,
      streamKey: replay.streamKey,
      firstSequenceNo: "1",
      lastSequenceNo: replay.lastSequenceNo,
      eventCount: replay.eventCount,
      firstEventHash: replay.firstEventHash,
      terminalEventHash: replay.terminalEventHash,
      eventRoot: replay.eventRoot,
      createdBy,
      createdAtUnixMicros,
    });
  return {
    ...seed,
    checkpointHash: hashHex(databaseAuditCheckpointHashMaterial(seed)),
  };
}

export function verifyCanopyProofDatabaseAuditStream(input: unknown): CanopyProofDatabaseAuditVerification {
  const parsed = databaseAuditVerificationRequestSchema.parse(input);
  const entries = parsed.entries;
  const firstEntry = entries[0]!;
  const streamKey = firstEntry.streamKey;
  const issues: CanopyProofDatabaseAuditVerificationIssue[] = [];
  const sequenceNumbers = new Set<string>();
  const eventHashes = new Set<string>();
  let previousTimestamp = 0n;
  let previousEventHash = CANOPYPROOF_DATABASE_AUDIT_GENESIS_HASH;

  for (const [index, entry] of entries.entries()) {
    const expectedStreamKey = buildCanopyProofDatabaseAuditStreamKey(entry.schemaName, entry.tableName, entry.rowPkHash);
    if (entry.streamKey !== streamKey) {
      issues.push({ code: "mixed_stream", index, expected: streamKey, actual: entry.streamKey });
    }
    if (entry.streamKey !== expectedStreamKey) {
      issues.push({ code: "invalid_stream_key", index, expected: expectedStreamKey, actual: entry.streamKey });
    }

    const expectedSequenceNo = String(index + 1);
    if (entry.sequenceNo !== expectedSequenceNo) {
      issues.push({ code: "sequence_gap", index, expected: expectedSequenceNo, actual: entry.sequenceNo });
    }
    if (sequenceNumbers.has(entry.sequenceNo)) {
      issues.push({ code: "duplicate_sequence", index, actual: entry.sequenceNo });
    }
    sequenceNumbers.add(entry.sequenceNo);
    if (eventHashes.has(entry.eventHash)) {
      issues.push({ code: "duplicate_event_hash", index, actual: entry.eventHash });
    }
    eventHashes.add(entry.eventHash);

    if (entry.previousEventHash !== previousEventHash) {
      issues.push({
        code: index === 0 ? "invalid_genesis_link" : "invalid_previous_event_hash",
        index,
        expected: previousEventHash,
        actual: entry.previousEventHash,
      });
    }

    const timestamp = BigInt(entry.recordedAtUnixMicros);
    if (index > 0 && timestamp <= previousTimestamp) {
      issues.push({
        code: "non_monotonic_recorded_at",
        index,
        expected: `>${previousTimestamp}`,
        actual: entry.recordedAtUnixMicros,
      });
    }
    previousTimestamp = timestamp;

    const expectedEventHash = hashHex(databaseAuditEventHashMaterial(entry));
    if (entry.eventHash !== expectedEventHash) {
      issues.push({ code: "invalid_event_hash", index, expected: expectedEventHash, actual: entry.eventHash });
    }
    previousEventHash = entry.eventHash;
  }

  const firstEventHash = firstEntry.eventHash;
  const terminalEventHash = entries.at(-1)!.eventHash;
  const eventRoot = hashHex(entries.map((entry) => entry.eventHash).join(""));
  const checkpointValid = parsed.checkpoint
    ? verifyCheckpoint(parsed.checkpoint, {
        streamKey,
        eventCount: entries.length,
        firstEventHash,
        terminalEventHash,
        eventRoot,
        issues,
      })
    : true;
  const verifiedAt = parsed.verifiedAt ?? new Date(0).toISOString();
  const valid = issues.length === 0;
  const verificationSeed = {
    eventVersion: CANOPYPROOF_DATABASE_AUDIT_EVENT_VERSION,
    checkpointVersion: parsed.checkpoint?.checkpointVersion ?? null,
    streamKey,
    eventCount: entries.length,
    firstSequenceNo: "1" as const,
    lastSequenceNo: String(entries.length),
    firstEventHash,
    terminalEventHash,
    eventRoot,
    checkpointHash: parsed.checkpoint?.checkpointHash ?? null,
    checkpointValid,
    valid,
    issueCodes: issues.map((issue) => issue.code),
    verifiedAt,
  };

  return {
    valid,
    eventCount: entries.length,
    streamKey,
    firstSequenceNo: "1",
    lastSequenceNo: String(entries.length),
    firstEventHash,
    terminalEventHash,
    eventRoot,
    checkpointSupplied: Boolean(parsed.checkpoint),
    checkpointValid,
    verifiedAt,
    issues,
    verificationRoot: hashJson({ kind: "canopyproof-database-audit-verification-v1", ...verificationSeed }),
    safety: databaseAuditSafetyBoundary(),
  };
}

function verifyCheckpoint(
  checkpoint: z.infer<typeof databaseAuditCheckpointSchema>,
  expected: Readonly<{
    streamKey: string;
    eventCount: number;
    firstEventHash: string;
    terminalEventHash: string;
    eventRoot: string;
    issues: CanopyProofDatabaseAuditVerificationIssue[];
  }>,
) {
  const issueCount = expected.issues.length;
  const checks: readonly [boolean, CanopyProofDatabaseAuditVerificationIssue][] = [
    [checkpoint.streamKey === expected.streamKey, { code: "checkpoint_stream_mismatch", expected: expected.streamKey, actual: checkpoint.streamKey }],
    [
      checkpoint.firstSequenceNo === "1" && checkpoint.lastSequenceNo === String(expected.eventCount),
      { code: "checkpoint_range_mismatch", expected: `1-${expected.eventCount}`, actual: `${checkpoint.firstSequenceNo}-${checkpoint.lastSequenceNo}` },
    ],
    [
      checkpoint.eventCount === expected.eventCount,
      { code: "checkpoint_event_count_mismatch", expected: String(expected.eventCount), actual: String(checkpoint.eventCount) },
    ],
    [
      checkpoint.firstEventHash === expected.firstEventHash,
      { code: "checkpoint_first_hash_mismatch", expected: expected.firstEventHash, actual: checkpoint.firstEventHash },
    ],
    [
      checkpoint.terminalEventHash === expected.terminalEventHash,
      { code: "checkpoint_terminal_hash_mismatch", expected: expected.terminalEventHash, actual: checkpoint.terminalEventHash },
    ],
    [
      checkpoint.eventRoot === expected.eventRoot,
      { code: "checkpoint_event_root_mismatch", expected: expected.eventRoot, actual: checkpoint.eventRoot },
    ],
  ];
  for (const [passes, issue] of checks) {
    if (!passes) expected.issues.push(issue);
  }
  const expectedCheckpointHash = hashHex(databaseAuditCheckpointHashMaterial(checkpoint));
  if (checkpoint.checkpointHash !== expectedCheckpointHash) {
    expected.issues.push({
      code: "invalid_checkpoint_hash",
      expected: expectedCheckpointHash,
      actual: checkpoint.checkpointHash,
    });
  }
  return expected.issues.length === issueCount;
}

function databaseAuditEventHashMaterial(
  event: Omit<CanopyProofDatabaseAuditEvent, "eventHash"> | CanopyProofDatabaseAuditEvent,
) {
  return lengthPrefixedMaterial([
    event.eventVersion,
    event.streamKey,
    event.schemaName,
    event.tableName,
    event.rowPkHash,
    event.sequenceNo,
    event.action,
    event.actorId,
    event.recordedAtUnixMicros,
    event.previousEventHash,
    event.beforeStateHash,
    event.afterStateHash,
  ]);
}

function databaseAuditCheckpointHashMaterial(
  checkpoint: Omit<CanopyProofDatabaseAuditCheckpoint, "checkpointHash"> | CanopyProofDatabaseAuditCheckpoint,
) {
  return lengthPrefixedMaterial([
    checkpoint.checkpointVersion,
    checkpoint.streamKey,
    checkpoint.firstSequenceNo,
    checkpoint.lastSequenceNo,
    String(checkpoint.eventCount),
    checkpoint.firstEventHash,
    checkpoint.terminalEventHash,
    checkpoint.eventRoot,
    checkpoint.createdBy,
    checkpoint.createdAtUnixMicros,
  ]);
}

function lengthPrefixedMaterial(parts: readonly string[]) {
  const encoder = new TextEncoder();
  return parts.map((part) => `${encoder.encode(part).byteLength}:${part}`).join("");
}

function databaseAuditSafetyBoundary() {
  return {
    hashOnlyInput: true as const,
    rawRowsExcluded: true as const,
    actorAndTimestampBound: true as const,
    sequenceContinuityChecked: true as const,
    previousHashesLinked: true as const,
    checkpointRecomputedWhenProvided: true as const,
    independentReplayRequired: true as const,
    noAutomatedFinalAuthority: true as const,
    notCarbonCredit: true as const,
    notFinancialAsset: true as const,
    notTaxOffset: true as const,
    notGuaranteedYield: true as const,
  };
}
