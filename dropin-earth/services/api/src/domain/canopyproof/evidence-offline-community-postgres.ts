import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofCommunityAttestationAuthorityService,
  CanopyProofEvidenceOfflineSyncAuthorityService,
  type CanopyProofCommunityAttestationAuthoritySnapshot,
  type CanopyProofCommunityAttestationFact,
  type CanopyProofOfflineSyncAuthoritySnapshot,
  type CanopyProofOfflineSyncBatchFact,
  type CanopyProofOfflineSyncItemFact,
} from "./evidence-offline-community-authority.js";
import {
  canopyProofAuditEntityTypes,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import { acquireCanopyProofPostgresTransactionLock } from "./postgres-advisory-lock.js";

type E4Transaction = Prisma.TransactionClient;

export type CanopyProofEvidenceOfflineCommunityRepositoryStatus = {
  readonly service: "canopyproof-evidence-offline-community-repository";
  readonly storage: "postgresql";
  readonly routeMounted: false;
  readonly appendOnly: true;
  readonly tenantScoped: true;
  readonly serializableWrites: true;
  readonly idempotencyRequired: true;
  readonly atomicOfflineBundles: true;
  readonly communityStatementsFinalAuthority: false;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const batchEnvelopeSchema = z
  .object({
    factType: z.literal("evidence_offline_sync_batch"),
    id: z.string().min(1).max(256),
    organizationId: z.string().min(1).max(256),
    projectId: z.string().min(1).max(256),
    subjectId: z.string().min(1).max(256),
    deviceAttestationId: z.string().min(1).max(256),
    actor: z.object({ id: z.string().min(1).max(256) }).passthrough(),
    commandHash: z.string().regex(HASH_PATTERN),
    streamSequence: z.number().int().positive(),
    batchRoot: z.string().regex(HASH_PATTERN),
    auditEvent: z.unknown(),
  })
  .passthrough();
const itemEnvelopeSchema = z
  .object({
    factType: z.literal("evidence_offline_sync_item"),
    id: z.string().min(1).max(256),
    batchId: z.string().min(1).max(256),
    organizationId: z.string().min(1).max(256),
    projectId: z.string().min(1).max(256),
    subjectId: z.string().min(1).max(256),
    deviceAttestationId: z.string().min(1).max(256),
    itemIndex: z.number().int().nonnegative().max(99),
    evidenceId: z.string().min(1).max(256),
    itemRoot: z.string().regex(HASH_PATTERN),
  })
  .passthrough();
const communityEnvelopeSchema = z
  .object({
    factType: z.literal("evidence_community_attestation"),
    id: z.string().min(1).max(256),
    organizationId: z.string().min(1).max(256),
    projectId: z.string().min(1).max(256),
    evidenceId: z.string().min(1).max(256),
    attesterId: z.string().min(1).max(256),
    commandHash: z.string().regex(HASH_PATTERN),
    streamSequence: z.number().int().positive(),
    attestationRoot: z.string().regex(HASH_PATTERN),
    auditEvent: z.unknown(),
  })
  .passthrough();
const auditEventRowSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
  actor_id: z.string().min(1),
  entity_type: z.enum(canopyProofAuditEntityTypes),
  entity_id: z.string().min(1),
  previous_root: z.string().regex(HASH_PATTERN),
  payload_hash: z.string().regex(HASH_PATTERN),
  event_root: z.string().regex(HASH_PATTERN),
  created_at: z.coerce.date(),
  rationale: z.string().min(1),
});
const factRowSchema = z.object({ fact_record: z.unknown() });
const receiptRowSchema = z.object({
  request_hash: z.string().regex(HASH_PATTERN),
  result_entity_type: z.string().min(1),
  result_entity_id: z.string().min(1),
  response_hash: z.string().regex(HASH_PATTERN),
  audit_event_root: z.string().regex(HASH_PATTERN),
});

export class PrismaCanopyProofEvidenceOfflineCommunityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofEvidenceOfflineCommunityRepositoryStatus {
    return {
      service: "canopyproof-evidence-offline-community-repository",
      storage: "postgresql",
      routeMounted: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      idempotencyRequired: true,
      atomicOfflineBundles: true,
      communityStatementsFinalAuthority: false,
    };
  }

  async commitOfflineBundle(
    batchInput: CanopyProofOfflineSyncBatchFact,
    itemInputs: readonly CanopyProofOfflineSyncItemFact[],
    idempotencyKeyInput: string,
  ) {
    const batch = parseBatch(batchInput);
    const items = itemInputs.map(parseItem);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = batch.actor.id;
    const operation = "evidence.offline-sync-bundle.commit";
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({ kind: "canopyproof-e4-offline-bundle-commit-v1", batch, items });
    const receiptId = `cp_e4_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, batch.organizationId, actorId);
            await lockCommand(transaction, actorId, operation, idempotencyKeyHash);
            await lockStream(transaction, `evidence-offline-device:${batch.deviceAttestationId}`);
            const snapshot = await this.loadOfflineSnapshot(
              transaction,
              batch.organizationId,
              batch.deviceAttestationId,
            );
            const receipt = await readReceipt(transaction, receiptId);
            if (receipt) {
              assertReceipt(
                receipt,
                requestHash,
                "evidence_offline_sync_batch",
                batch.id,
                batch.batchRoot,
                batch.auditEvent.eventRoot,
                "CANOPYPROOF_E4_OFFLINE_IDEMPOTENCY_CONFLICT",
              );
              return CanopyProofEvidenceOfflineSyncAuthorityService.fromAuthoritySnapshot(
                snapshot,
              ).getBundle(batch.id);
            }

            assertProposedOfflineBundle(snapshot, batch, items);
            await insertDomainEvent(
              transaction,
              `evidence-offline-device:${batch.deviceAttestationId}`,
              batch.auditEvent,
            );
            await insertOfflineBatch(transaction, batch);
            for (const item of items) await insertOfflineItem(transaction, item);
            await insertReceipt(transaction, {
              id: receiptId,
              actorId,
              operation,
              idempotencyKeyHash,
              requestHash,
              resultEntityType: "evidence_offline_sync_batch",
              resultEntityId: batch.id,
              responseHash: batch.batchRoot,
              auditEventRoot: batch.auditEvent.eventRoot,
              createdAt: batch.auditEvent.createdAt,
            });
            return this.requireOfflineBundle(
              transaction,
              batch.organizationId,
              batch.deviceAttestationId,
              batch.id,
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_E4_OFFLINE_DURABLE_WRITE_UNAVAILABLE");
  }

  async commitCommunityAttestation(
    factInput: CanopyProofCommunityAttestationFact,
    idempotencyKeyInput: string,
  ) {
    const fact = parseCommunity(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = fact.attesterId;
    const operation = "evidence.community-attestation.commit";
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({ kind: "canopyproof-e4-community-commit-v1", fact });
    const receiptId = `cp_e4_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, fact.organizationId, actorId);
            await lockCommand(transaction, actorId, operation, idempotencyKeyHash);
            await lockStream(transaction, `evidence-community:${fact.evidenceId}`);
            const snapshot = await this.loadCommunitySnapshot(
              transaction,
              fact.organizationId,
              fact.evidenceId,
            );
            const receipt = await readReceipt(transaction, receiptId);
            if (receipt) {
              assertReceipt(
                receipt,
                requestHash,
                "evidence_community_attestation",
                fact.id,
                fact.attestationRoot,
                fact.auditEvent.eventRoot,
                "CANOPYPROOF_E4_COMMUNITY_IDEMPOTENCY_CONFLICT",
              );
              return CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot(
                snapshot,
              ).getAttestation(fact.id);
            }

            assertProposedCommunityAttestation(snapshot, fact);
            await insertDomainEvent(transaction, `evidence-community:${fact.evidenceId}`, fact.auditEvent);
            await insertCommunityAttestation(transaction, fact);
            await insertReceipt(transaction, {
              id: receiptId,
              actorId,
              operation,
              idempotencyKeyHash,
              requestHash,
              resultEntityType: "evidence_community_attestation",
              resultEntityId: fact.id,
              responseHash: fact.attestationRoot,
              auditEventRoot: fact.auditEvent.eventRoot,
              createdAt: fact.auditEvent.createdAt,
            });
            return this.requireCommunityAttestation(
              transaction,
              fact.organizationId,
              fact.evidenceId,
              fact.id,
            );
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_E4_COMMUNITY_DURABLE_WRITE_UNAVAILABLE");
  }

  async loadOfflineAuthoritySnapshot(organizationId: string, deviceAttestationId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.loadOfflineSnapshot(transaction, organizationId, deviceAttestationId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async loadCommunityAuthoritySnapshot(organizationId: string, evidenceId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.loadCommunitySnapshot(transaction, organizationId, evidenceId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getOfflineBundle(organizationId: string, deviceAttestationId: string, batchId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.requireOfflineBundle(transaction, organizationId, deviceAttestationId, batchId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getCommunityAttestation(organizationId: string, evidenceId: string, attestationId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.requireCommunityAttestation(transaction, organizationId, evidenceId, attestationId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async projectCommunitySignal(organizationId: string, evidenceId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        const evidenceRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT evidence_root
          FROM evidence.evidence_objects
          WHERE id = ${evidenceId} AND organization_id = ${organizationId}
          LIMIT 1
        `);
        const evidence = z.object({ evidence_root: z.string().regex(HASH_PATTERN) }).parse(evidenceRows[0]);
        const snapshot = await this.loadCommunitySnapshot(transaction, organizationId, evidenceId);
        return CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot(snapshot).projectSignal(
          organizationId,
          evidenceId,
          evidence.evidence_root,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async requireOfflineBundle(
    transaction: E4Transaction,
    organizationId: string,
    deviceAttestationId: string,
    batchId: string,
  ) {
    const snapshot = await this.loadOfflineSnapshot(transaction, organizationId, deviceAttestationId);
    return CanopyProofEvidenceOfflineSyncAuthorityService.fromAuthoritySnapshot(snapshot).getBundle(batchId);
  }

  private async requireCommunityAttestation(
    transaction: E4Transaction,
    organizationId: string,
    evidenceId: string,
    attestationId: string,
  ) {
    const snapshot = await this.loadCommunitySnapshot(transaction, organizationId, evidenceId);
    return CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot(snapshot).getAttestation(attestationId);
  }

  private async loadOfflineSnapshot(
    transaction: E4Transaction,
    organizationId: string,
    deviceAttestationId: string,
  ): Promise<CanopyProofOfflineSyncAuthoritySnapshot> {
    const deviceScope = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id
      FROM identity.device_attestations
      WHERE id = ${deviceAttestationId} AND organization_id = ${organizationId}
      LIMIT 1
    `);
    if (deviceScope.length !== 1) throw new Error("CANOPYPROOF_E4_ORGANIZATION_SCOPE_MISMATCH");
    const [eventRows, batchRows, itemRows] = await Promise.all([
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT id, action, actor_id, entity_type, entity_id, previous_root,
               payload_hash, event_root, created_at, rationale
        FROM audit.domain_events
        WHERE stream_id = ${`evidence-offline-device:${deviceAttestationId}`}
        ORDER BY sequence_no
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM evidence.offline_sync_batch_facts
        WHERE organization_id = ${organizationId} AND device_attestation_id = ${deviceAttestationId}
        ORDER BY device_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT item.fact_record
        FROM evidence.offline_sync_item_facts item
        JOIN evidence.offline_sync_batch_facts batch ON batch.id = item.batch_id
        WHERE item.organization_id = ${organizationId}
          AND batch.device_attestation_id = ${deviceAttestationId}
        ORDER BY batch.device_sequence, item.item_index, item.id
      `),
    ]);
    const streamEvents = eventRows.map(mapAuditEvent);
    assertEventChain(streamEvents, "CANOPYPROOF_E4_OFFLINE_EVENT_STREAM_INVALID");
    const snapshot: CanopyProofOfflineSyncAuthoritySnapshot = {
      streamEvents,
      batches: batchRows.map((row) => parseBatch(factRowSchema.parse(row).fact_record)),
      items: itemRows.map((row) => parseItem(factRowSchema.parse(row).fact_record)),
    };
    return CanopyProofEvidenceOfflineSyncAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
  }

  private async loadCommunitySnapshot(
    transaction: E4Transaction,
    organizationId: string,
    evidenceId: string,
  ): Promise<CanopyProofCommunityAttestationAuthoritySnapshot> {
    const evidenceScope = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id
      FROM evidence.evidence_objects
      WHERE id = ${evidenceId} AND organization_id = ${organizationId}
      LIMIT 1
    `);
    if (evidenceScope.length !== 1) throw new Error("CANOPYPROOF_E4_ORGANIZATION_SCOPE_MISMATCH");
    const [eventRows, factRows] = await Promise.all([
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT id, action, actor_id, entity_type, entity_id, previous_root,
               payload_hash, event_root, created_at, rationale
        FROM audit.domain_events
        WHERE stream_id = ${`evidence-community:${evidenceId}`}
        ORDER BY sequence_no
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM evidence.community_attestation_facts
        WHERE organization_id = ${organizationId} AND evidence_id = ${evidenceId}
        ORDER BY attestation_sequence, id
      `),
    ]);
    const streamEvents = eventRows.map(mapAuditEvent);
    assertEventChain(streamEvents, "CANOPYPROOF_E4_COMMUNITY_EVENT_STREAM_INVALID");
    const snapshot: CanopyProofCommunityAttestationAuthoritySnapshot = {
      streamEvents,
      attestations: factRows.map((row) => parseCommunity(factRowSchema.parse(row).fact_record)),
    };
    return CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
  }
}

function assertProposedOfflineBundle(
  snapshot: CanopyProofOfflineSyncAuthoritySnapshot,
  batch: CanopyProofOfflineSyncBatchFact,
  items: readonly CanopyProofOfflineSyncItemFact[],
) {
  if (
    snapshot.streamEvents.some((event) => event.id === batch.auditEvent.id || event.eventRoot === batch.auditEvent.eventRoot) ||
    snapshot.batches.some((candidate) => candidate.id === batch.id || candidate.clientBatchId === batch.clientBatchId) ||
    items.some((item) => snapshot.items.some((candidate) => candidate.id === item.id))
  ) {
    throw new Error("CANOPYPROOF_E4_OFFLINE_FACT_CONFLICT");
  }
  const proposed: CanopyProofOfflineSyncAuthoritySnapshot = {
    streamEvents: [...snapshot.streamEvents, batch.auditEvent],
    batches: [...snapshot.batches, batch],
    items: [...snapshot.items, ...items],
  };
  CanopyProofEvidenceOfflineSyncAuthorityService.fromAuthoritySnapshot(proposed);
}

function assertProposedCommunityAttestation(
  snapshot: CanopyProofCommunityAttestationAuthoritySnapshot,
  fact: CanopyProofCommunityAttestationFact,
) {
  if (
    snapshot.streamEvents.some((event) => event.id === fact.auditEvent.id || event.eventRoot === fact.auditEvent.eventRoot) ||
    snapshot.attestations.some((candidate) => candidate.id === fact.id || candidate.attesterId === fact.attesterId)
  ) {
    throw new Error("CANOPYPROOF_E4_COMMUNITY_FACT_CONFLICT");
  }
  CanopyProofCommunityAttestationAuthorityService.fromAuthoritySnapshot({
    streamEvents: [...snapshot.streamEvents, fact.auditEvent],
    attestations: [...snapshot.attestations, fact],
  });
}

async function insertDomainEvent(transaction: E4Transaction, streamId: string, event: CanopyProofAuditEvent) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.domain_events (
      id, stream_id, action, actor_id, entity_type, entity_id,
      previous_root, payload_hash, event_root, created_at, rationale
    ) VALUES (
      ${event.id}, ${streamId}, ${event.action}, ${event.actor}, ${event.entityType}, ${event.entityId},
      ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
    )
  `));
}

async function insertOfflineBatch(transaction: E4Transaction, fact: CanopyProofOfflineSyncBatchFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO evidence.offline_sync_batch_facts (
      id, organization_id, project_id, subject_id, device_attestation_id,
      actor_id, client_batch_id, device_sequence, stream_sequence, item_count,
      batch_state, command_hash, manifest_root, batch_hash, batch_root,
      received_at, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.subjectId},
      ${fact.deviceAttestationId}, ${fact.actor.id}, ${fact.clientBatchId},
      ${fact.deviceSequence}, ${fact.streamSequence}, ${fact.itemCount}, ${fact.batchState},
      ${fact.commandHash}, ${fact.manifestRoot}, ${fact.batchHash}, ${fact.batchRoot},
      ${asDate(fact.receivedAt)}, ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertOfflineItem(transaction: E4Transaction, fact: CanopyProofOfflineSyncItemFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO evidence.offline_sync_item_facts (
      id, batch_id, organization_id, project_id, subject_id, device_attestation_id,
      item_index, client_record_id, evidence_id, result_state, item_hash,
      item_root, fact_record
    ) VALUES (
      ${fact.id}, ${fact.batchId}, ${fact.organizationId}, ${fact.projectId}, ${fact.subjectId},
      ${fact.deviceAttestationId}, ${fact.itemIndex}, ${fact.clientRecordId}, ${fact.evidenceId},
      ${fact.result}, ${fact.itemHash}, ${fact.itemRoot}, ${JSON.stringify(fact)}::jsonb
    )
  `));
}

async function insertCommunityAttestation(transaction: E4Transaction, fact: CanopyProofCommunityAttestationFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO evidence.community_attestation_facts (
      id, organization_id, project_id, evidence_id, actor_id,
      attestation_sequence, stream_sequence, stance, attestation_state,
      command_hash, attestation_hash, attestation_root, created_at,
      fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.evidenceId}, ${fact.attesterId},
      ${fact.attestationSequence}, ${fact.streamSequence}, ${fact.stance}, ${fact.attestationState},
      ${fact.commandHash}, ${fact.attestationHash}, ${fact.attestationRoot}, ${asDate(fact.createdAt)},
      ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertReceipt(
  transaction: E4Transaction,
  input: {
    readonly id: string;
    readonly actorId: string;
    readonly operation: string;
    readonly idempotencyKeyHash: string;
    readonly requestHash: string;
    readonly resultEntityType: string;
    readonly resultEntityId: string;
    readonly responseHash: string;
    readonly auditEventRoot: string;
    readonly createdAt: string;
  },
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.command_receipts (
      id, actor_id, operation, idempotency_key_hash, request_hash,
      result_entity_type, result_entity_id, response_hash,
      audit_event_root, created_at
    ) VALUES (
      ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash},
      ${input.requestHash}, ${input.resultEntityType}, ${input.resultEntityId},
      ${input.responseHash}, ${input.auditEventRoot}, ${asDate(input.createdAt)}
    )
  `));
}

async function readReceipt(transaction: E4Transaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id,
           response_hash, audit_event_root
    FROM audit.command_receipts
    WHERE id = ${receiptId}
    FOR UPDATE
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_E4_RECEIPT_CARDINALITY_INVALID");
  return rows[0] ? receiptRowSchema.parse(rows[0]) : undefined;
}

function assertReceipt(
  receipt: z.infer<typeof receiptRowSchema>,
  requestHash: string,
  entityType: string,
  entityId: string,
  responseHash: string,
  auditEventRoot: string,
  errorCode: string,
) {
  if (
    receipt.request_hash !== requestHash ||
    receipt.result_entity_type !== entityType ||
    receipt.result_entity_id !== entityId ||
    receipt.response_hash !== responseHash ||
    receipt.audit_event_root !== auditEventRoot
  ) {
    throw new Error(errorCode);
  }
}

async function lockCommand(transaction: E4Transaction, actorId: string, operation: string, idempotencyKeyHash: string) {
  await acquireCanopyProofPostgresTransactionLock(
    transaction,
    `e4-command:${actorId}:${operation}:${idempotencyKeyHash}`,
  );
}

async function lockStream(transaction: E4Transaction, streamId: string) {
  await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${streamId}`);
}

async function setContext(transaction: E4Transaction, organizationId: string, actorId = "system-read") {
  const organization = z.string().min(1).max(256).parse(organizationId);
  const actor = z.string().min(1).max(256).parse(actorId);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organization}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actor}, true)`);
}

function parseBatch(input: unknown): CanopyProofOfflineSyncBatchFact {
  batchEnvelopeSchema.parse(input);
  return input as CanopyProofOfflineSyncBatchFact;
}

function parseItem(input: unknown): CanopyProofOfflineSyncItemFact {
  itemEnvelopeSchema.parse(input);
  return input as CanopyProofOfflineSyncItemFact;
}

function parseCommunity(input: unknown): CanopyProofCommunityAttestationFact {
  communityEnvelopeSchema.parse(input);
  return input as CanopyProofCommunityAttestationFact;
}

function mapAuditEvent(input: unknown): CanopyProofAuditEvent {
  const row = auditEventRowSchema.parse(input);
  return {
    id: row.id,
    action: row.action,
    actor: row.actor_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    previousRoot: row.previous_root,
    payloadHash: row.payload_hash,
    eventRoot: row.event_root,
    createdAt: row.created_at.toISOString(),
    rationale: row.rationale,
  };
}

function assertEventChain(events: readonly CanopyProofAuditEvent[], errorCode: string) {
  const terminal = events.at(-1);
  if (terminal && !verifyCanopyProofAuditChain(events, terminal.createdAt).valid) throw new Error(errorCode);
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_E4_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_E4_MUTATION_CARDINALITY_INVALID");
}

function isRetryable(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  const databaseCode = prismaDatabaseCode(error);
  return error.code === "P2034" ||
    databaseCode === "40001" ||
    databaseCode === "40P01" ||
    databaseCode === "23505";
}

function prismaDatabaseCode(error: Prisma.PrismaClientKnownRequestError) {
  if (!error.meta || typeof error.meta !== "object") return undefined;
  const code = Reflect.get(error.meta, "code");
  return typeof code === "string" ? code : undefined;
}
