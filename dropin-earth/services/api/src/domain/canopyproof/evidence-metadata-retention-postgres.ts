import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofEvidenceMetadataRetentionAuthorityService,
  type CanopyProofEvidenceMetadataExtractionFact,
  type CanopyProofEvidenceMetadataRetentionAuthoritySnapshot,
  type CanopyProofEvidenceRetentionExecutionFact,
  type CanopyProofEvidenceRetentionDecisionFact,
  type CanopyProofEvidenceRetentionSourceType,
} from "./evidence-metadata-retention-authority.js";
import {
  canopyProofAuditEntityTypes,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import { acquireCanopyProofPostgresTransactionLock } from "./postgres-advisory-lock.js";

type E3bTransaction = Prisma.TransactionClient;

export type CanopyProofEvidenceMetadataRetentionFact =
  | CanopyProofEvidenceMetadataExtractionFact
  | CanopyProofEvidenceRetentionDecisionFact
  | CanopyProofEvidenceRetentionExecutionFact;

export type CanopyProofEvidenceMetadataRetentionRepositoryStatus = {
  readonly service: "canopyproof-evidence-metadata-retention-repository";
  readonly storage: "postgresql";
  readonly routeMounted: false;
  readonly appendOnly: true;
  readonly tenantScoped: true;
  readonly serializableWrites: true;
  readonly idempotencyRequired: true;
  readonly providerReceipts: "modeled_only";
  readonly finalProofAuthority: false;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const factEnvelopeSchema = z
  .object({
    factType: z.enum([
      "evidence_media_metadata_extraction",
      "evidence_retention_decision",
      "evidence_retention_execution",
    ]),
    id: z.string().min(1).max(256),
    organizationId: z.string().min(1).max(256),
    projectId: z.string().min(1).max(256),
    evidenceId: z.string().min(1).max(256),
    commandHash: z.string().regex(HASH_PATTERN),
    evidenceSequence: z.number().int().positive(),
    previousEventRoot: z.string().regex(HASH_PATTERN),
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

export class PrismaCanopyProofEvidenceMetadataRetentionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofEvidenceMetadataRetentionRepositoryStatus {
    return {
      service: "canopyproof-evidence-metadata-retention-repository",
      storage: "postgresql",
      routeMounted: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      idempotencyRequired: true,
      providerReceipts: "modeled_only",
      finalProofAuthority: false,
    };
  }

  async commitFact(factInput: CanopyProofEvidenceMetadataRetentionFact, idempotencyKeyInput: string) {
    const fact = parseFact(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    assertModeledProviderBoundary(fact);
    const actorId = fact.auditEvent.actor;
    const operation = operationForFact(fact);
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({
      kind: "canopyproof-e3b-fact-commit-v1",
      actorId,
      operation,
      fact,
    });
    const receiptId = `cp_e3b_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, fact.organizationId, actorId);
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `e3b-command:${actorId}:${operation}:${idempotencyKeyHash}`,
            );
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `domain-event:evidence-media:${fact.evidenceId}`,
            );

            const receipts = await transaction.$queryRaw<unknown[]>(Prisma.sql`
              SELECT request_hash, result_entity_type, result_entity_id,
                     response_hash, audit_event_root
              FROM audit.command_receipts
              WHERE id = ${receiptId}
              FOR UPDATE
            `);
            if (receipts.length > 1) throw new Error("CANOPYPROOF_E3B_RECEIPT_CARDINALITY_INVALID");
            if (receipts[0]) {
              const receipt = receiptRowSchema.parse(receipts[0]);
              if (
                receipt.request_hash !== requestHash ||
                receipt.result_entity_type !== resultEntityType(fact) ||
                receipt.result_entity_id !== fact.id ||
                receipt.response_hash !== factRoot(fact) ||
                receipt.audit_event_root !== fact.auditEvent.eventRoot
              ) {
                throw new Error("CANOPYPROOF_E3B_IDEMPOTENCY_CONFLICT");
              }
              return this.requireFact(transaction, fact.organizationId, fact.evidenceId, fact.id);
            }

            const snapshot = await this.loadSnapshot(transaction, fact.organizationId, fact.evidenceId);
            assertProposedFact(snapshot, fact);
            await insertDomainEvent(transaction, `evidence-media:${fact.evidenceId}`, fact.auditEvent);
            await insertFact(transaction, fact);
            requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
              INSERT INTO audit.command_receipts (
                id, actor_id, operation, idempotency_key_hash, request_hash,
                result_entity_type, result_entity_id, response_hash,
                audit_event_root, created_at
              ) VALUES (
                ${receiptId}, ${actorId}, ${operation}, ${idempotencyKeyHash}, ${requestHash},
                ${resultEntityType(fact)}, ${fact.id}, ${factRoot(fact)},
                ${fact.auditEvent.eventRoot}, ${asDate(fact.auditEvent.createdAt)}
              )
            `));
            return this.requireFact(transaction, fact.organizationId, fact.evidenceId, fact.id);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isRetryable(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_E3B_DURABLE_WRITE_UNAVAILABLE");
  }

  async loadAuthoritySnapshot(organizationId: string, evidenceId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.loadSnapshot(transaction, organizationId, evidenceId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getFact(organizationId: string, evidenceId: string, factId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.requireFact(transaction, organizationId, evidenceId, factId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async projectRetention(
    organizationId: string,
    evidenceId: string,
    sourceType: CanopyProofEvidenceRetentionSourceType,
    sourceId: string,
    evaluatedAt: string,
  ) {
    const evaluation = z.string().datetime().parse(evaluatedAt);
    const snapshot = await this.loadAuthoritySnapshot(organizationId, evidenceId);
    return CanopyProofEvidenceMetadataRetentionAuthorityService.fromAuthoritySnapshot(snapshot).projectRetention(
      sourceType,
      sourceId,
      evaluation,
    );
  }

  private async requireFact(
    transaction: E3bTransaction,
    organizationId: string,
    evidenceId: string,
    factId: string,
  ) {
    const snapshot = await this.loadSnapshot(transaction, organizationId, evidenceId);
    const fact = [
      ...snapshot.metadataExtractions,
      ...snapshot.retentionDecisions,
      ...snapshot.retentionExecutions,
    ].find((candidate) => candidate.id === factId);
    if (!fact) throw new Error(`CANOPYPROOF_E3B_FACT_NOT_FOUND: ${factId}`);
    return fact;
  }

  private async loadSnapshot(
    transaction: E3bTransaction,
    organizationId: string,
    evidenceId: string,
  ): Promise<CanopyProofEvidenceMetadataRetentionAuthoritySnapshot> {
    const evidenceScope = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id
      FROM evidence.evidence_objects
      WHERE id = ${evidenceId} AND organization_id = ${organizationId}
      LIMIT 1
    `);
    if (evidenceScope.length !== 1) throw new Error("CANOPYPROOF_E3B_ORGANIZATION_SCOPE_MISMATCH");
    const [eventRows, extractionRows, decisionRows, executionRows] = await Promise.all([
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT id, action, actor_id, entity_type, entity_id, previous_root,
               payload_hash, event_root, created_at, rationale
        FROM audit.domain_events
        WHERE stream_id = ${`evidence-media:${evidenceId}`}
        ORDER BY sequence_no
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM evidence.media_metadata_extraction_facts
        WHERE organization_id = ${organizationId} AND evidence_id = ${evidenceId}
        ORDER BY evidence_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM evidence.retention_decision_facts
        WHERE organization_id = ${organizationId} AND evidence_id = ${evidenceId}
        ORDER BY evidence_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM evidence.retention_execution_facts
        WHERE organization_id = ${organizationId} AND evidence_id = ${evidenceId}
        ORDER BY evidence_sequence, id
      `),
    ]);
    const streamEvents = eventRows.map(mapAuditEvent);
    const terminal = streamEvents.at(-1);
    if (terminal && !verifyCanopyProofAuditChain(streamEvents, terminal.createdAt).valid) {
      throw new Error("CANOPYPROOF_E3B_EVENT_STREAM_INVALID");
    }
    const snapshot: CanopyProofEvidenceMetadataRetentionAuthoritySnapshot = {
      streamEvents,
      metadataExtractions: extractionRows.map((row) => parseMetadataFact(factRowSchema.parse(row).fact_record)),
      retentionDecisions: decisionRows.map((row) => parseDecisionFact(factRowSchema.parse(row).fact_record)),
      retentionExecutions: executionRows.map((row) => parseExecutionFact(factRowSchema.parse(row).fact_record)),
    };
    return CanopyProofEvidenceMetadataRetentionAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
  }
}

function assertProposedFact(
  snapshot: CanopyProofEvidenceMetadataRetentionAuthoritySnapshot,
  fact: CanopyProofEvidenceMetadataRetentionFact,
) {
  if (
    snapshot.streamEvents.some((event) => event.id === fact.auditEvent.id || event.eventRoot === fact.auditEvent.eventRoot) ||
    [...snapshot.metadataExtractions, ...snapshot.retentionDecisions, ...snapshot.retentionExecutions].some(
      (candidate) => candidate.id === fact.id,
    )
  ) {
    throw new Error("CANOPYPROOF_E3B_FACT_CONFLICT");
  }
  const proposed: CanopyProofEvidenceMetadataRetentionAuthoritySnapshot = {
    streamEvents: [...snapshot.streamEvents, fact.auditEvent],
    metadataExtractions: [
      ...snapshot.metadataExtractions,
      ...(fact.factType === "evidence_media_metadata_extraction" ? [fact] : []),
    ],
    retentionDecisions: [
      ...snapshot.retentionDecisions,
      ...(fact.factType === "evidence_retention_decision" ? [fact] : []),
    ],
    retentionExecutions: [
      ...snapshot.retentionExecutions,
      ...(fact.factType === "evidence_retention_execution" ? [fact] : []),
    ],
  };
  CanopyProofEvidenceMetadataRetentionAuthorityService.fromAuthoritySnapshot(proposed);
}

async function insertDomainEvent(
  transaction: E3bTransaction,
  streamId: string,
  event: CanopyProofAuditEvent,
) {
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

async function insertFact(transaction: E3bTransaction, fact: CanopyProofEvidenceMetadataRetentionFact) {
  const record = JSON.stringify(fact);
  if (fact.factType === "evidence_media_metadata_extraction") {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.media_metadata_extraction_facts (
        id, organization_id, project_id, evidence_id, object_id, actor_id,
        extraction_sequence, evidence_sequence, command_hash, extraction_hash,
        extraction_root, extracted_at, fact_record, audit_event_root
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.evidenceId}, ${fact.objectId},
        ${fact.agent.id}, ${fact.extractionSequence}, ${fact.evidenceSequence}, ${fact.commandHash},
        ${fact.extractionHash}, ${fact.extractionRoot}, ${asDate(fact.extractedAt)},
        ${record}::jsonb, ${fact.auditEvent.eventRoot}
      )
    `));
    return;
  }
  if (fact.factType === "evidence_retention_decision") {
    requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
      INSERT INTO evidence.retention_decision_facts (
        id, organization_id, project_id, evidence_id, subject_id, source_type,
        source_id, source_root, actor_id, decision_sequence, evidence_sequence,
        command_hash, decision_hash, decision_root, evaluated_at, fact_record, audit_event_root
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.evidenceId}, ${fact.subjectId},
        ${fact.sourceType}, ${fact.sourceId}, ${fact.sourceRoot}, ${fact.decidedBy},
        ${fact.decisionSequence}, ${fact.evidenceSequence}, ${fact.commandHash}, ${fact.decisionHash},
        ${fact.decisionRoot}, ${asDate(fact.evaluatedAt)}, ${record}::jsonb, ${fact.auditEvent.eventRoot}
      )
    `));
    return;
  }
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO evidence.retention_execution_facts (
      id, organization_id, project_id, evidence_id, subject_id, source_type,
      source_id, source_root, decision_id, actor_id, execution_sequence,
      evidence_sequence, command_hash, execution_hash, execution_root,
      executed_at, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.evidenceId}, ${fact.subjectId},
      ${fact.sourceType}, ${fact.sourceId}, ${fact.sourceRoot}, ${fact.decisionId}, ${fact.agent.id},
      ${fact.executionSequence}, ${fact.evidenceSequence}, ${fact.commandHash}, ${fact.executionHash},
      ${fact.executionRoot}, ${asDate(fact.executedAt)}, ${record}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function setContext(transaction: E3bTransaction, organizationId: string, actorId = "system-read") {
  const organization = z.string().min(1).max(256).parse(organizationId);
  const actor = z.string().min(1).max(256).parse(actorId);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organization}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actor}, true)`);
}

function parseFact(input: unknown): CanopyProofEvidenceMetadataRetentionFact {
  const envelope = factEnvelopeSchema.parse(input);
  if (envelope.factType === "evidence_media_metadata_extraction") return parseMetadataFact(input);
  if (envelope.factType === "evidence_retention_decision") return parseDecisionFact(input);
  return parseExecutionFact(input);
}

function parseMetadataFact(input: unknown) {
  const envelope = factEnvelopeSchema.parse(input);
  if (envelope.factType !== "evidence_media_metadata_extraction") throw new Error("CANOPYPROOF_E3B_FACT_TYPE_INVALID");
  return input as CanopyProofEvidenceMetadataExtractionFact;
}

function parseDecisionFact(input: unknown) {
  const envelope = factEnvelopeSchema.parse(input);
  if (envelope.factType !== "evidence_retention_decision") throw new Error("CANOPYPROOF_E3B_FACT_TYPE_INVALID");
  return input as CanopyProofEvidenceRetentionDecisionFact;
}

function parseExecutionFact(input: unknown) {
  const envelope = factEnvelopeSchema.parse(input);
  if (envelope.factType !== "evidence_retention_execution") throw new Error("CANOPYPROOF_E3B_FACT_TYPE_INVALID");
  return input as CanopyProofEvidenceRetentionExecutionFact;
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

function operationForFact(fact: CanopyProofEvidenceMetadataRetentionFact) {
  if (fact.factType === "evidence_media_metadata_extraction") return "evidence.metadata-extraction.commit";
  if (fact.factType === "evidence_retention_decision") return "evidence.retention-decision.commit";
  return "evidence.retention-execution.commit";
}

function resultEntityType(fact: CanopyProofEvidenceMetadataRetentionFact) {
  if (fact.factType === "evidence_media_metadata_extraction") return "evidence_media_metadata_extraction";
  if (fact.factType === "evidence_retention_decision") return "evidence_retention_decision";
  return "evidence_retention_execution";
}

function factRoot(fact: CanopyProofEvidenceMetadataRetentionFact) {
  if (fact.factType === "evidence_media_metadata_extraction") return fact.extractionRoot;
  if (fact.factType === "evidence_retention_decision") return fact.decisionRoot;
  return fact.executionRoot;
}

function assertModeledProviderBoundary(fact: CanopyProofEvidenceMetadataRetentionFact) {
  if (
    fact.factType !== "evidence_retention_decision" &&
    fact.providerVerificationState !== "modeled_only"
  ) {
    throw new Error("CANOPYPROOF_E3B_PROVIDER_ADAPTER_NOT_APPROVED");
  }
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_E3B_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_E3B_MUTATION_CARDINALITY_INVALID");
}

function isRetryable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown };
  return candidate.code === "P2034" ||
    (typeof candidate.message === "string" && /serialization|deadlock/i.test(candidate.message));
}
