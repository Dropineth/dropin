import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  buildCanopyProofGlobalCommandCenterSourceAuthorityRoot,
  parseCanopyProofGlobalCommandCenterPublicationFact,
  verifyCanopyProofGlobalCommandCenterPublication,
  type CanopyProofGlobalCommandCenterCurrentAuthority,
  type CanopyProofGlobalCommandCenterPublicationFact,
} from "./global-command-center-publishing-authority.js";
import {
  verifyCanopyProofGlobalCommandCenterSnapshot,
  type CanopyProofGlobalCommandCenterSnapshot,
} from "./global-command-center.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";
import { verifyCanopyProofAuditChain, type CanopyProofAuditEvent } from "./proof-engine.js";

type PublishingTransaction = Prisma.TransactionClient;

export type CanopyProofGlobalCommandCenterSourceResolverQuery = Readonly<{
  generatedAt: string;
  dashboardRoot: string;
  sourceAuthorityRoot: string;
  policyId: string;
  policyRoot: string;
  publisherId: string;
  governorId: string;
  organizationId: string;
}>;

export type CanopyProofGlobalCommandCenterSourceResolver = (
  query: CanopyProofGlobalCommandCenterSourceResolverQuery,
  transaction: PublishingTransaction,
) => Promise<CanopyProofGlobalCommandCenterCurrentAuthority>;

export type CanopyProofGlobalCommandCenterPublishedSnapshot = Readonly<{
  snapshot: CanopyProofGlobalCommandCenterSnapshot;
  publication: CanopyProofGlobalCommandCenterPublicationFact;
}>;

export type CanopyProofGlobalCommandCenterPublishingRepositoryStatus = {
  readonly service: "canopyproof-global-command-center-publishing-repository";
  readonly storage: "postgresql";
  readonly routeMounted: false;
  readonly schedulerMounted: false;
  readonly productionActivationEnabled: false;
  readonly appendOnly: true;
  readonly serializableWrites: true;
  readonly exactRetryRequired: true;
  readonly currentAuthorityReResolved: true;
  readonly independentHumanGovernanceRequired: true;
};

const STREAM_ID = "global-command-center:publications";
const OPERATION = "global-command-center-snapshot.commit";
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const hashSchema = z.string().regex(HASH_PATTERN);
const receiptRowSchema = z
  .object({
    request_hash: hashSchema,
    result_entity_type: z.literal("global_command_center_snapshot_publication"),
    result_entity_id: z.string().min(1),
    response_hash: hashSchema,
    audit_event_root: hashSchema,
  })
  .strict();
const publicationRowSchema = z
  .object({
    id: z.string().min(1),
    snapshot_id: z.string().min(1),
    dashboard_root: hashSchema,
    source_authority_root: hashSchema,
    policy_root: hashSchema,
    approval_root: hashSchema,
    publisher_id: z.string().min(1),
    publication_root: hashSchema,
    audit_event_root: hashSchema,
    fact_record: z.unknown(),
  })
  .strict();
const snapshotRowSchema = z
  .object({
    id: z.string().min(1),
    generated_at_value: z.coerce.date(),
    metric_summary: z.unknown(),
    regional_summaries: z.unknown(),
    impact_indicators: z.unknown(),
    recent_activity: z.unknown(),
    lineage: z.unknown(),
    safety_boundary: z.unknown(),
    dashboard_root: hashSchema,
  })
  .strict();
const eventRowSchema = z
  .object({
    id: z.string().min(1),
    action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
    actor_id: z.string().min(1),
    entity_type: z.string().min(1),
    entity_id: z.string().min(1),
    previous_root: hashSchema,
    payload_hash: hashSchema,
    event_root: hashSchema,
    created_at_value: z.coerce.date(),
    rationale: z.string().min(1),
  })
  .strict();

export class PrismaCanopyProofGlobalCommandCenterPublishingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofGlobalCommandCenterPublishingRepositoryStatus {
    return {
      service: "canopyproof-global-command-center-publishing-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      independentHumanGovernanceRequired: true,
    };
  }

  async commitPublication(
    snapshotInput: CanopyProofGlobalCommandCenterSnapshot,
    publicationInput: CanopyProofGlobalCommandCenterPublicationFact,
    idempotencyKeyInput: string,
    resolveCurrentSource: CanopyProofGlobalCommandCenterSourceResolver,
  ): Promise<CanopyProofGlobalCommandCenterPublishedSnapshot> {
    const snapshot = verifyCanopyProofGlobalCommandCenterSnapshot(snapshotInput);
    const publication = parseCanopyProofGlobalCommandCenterPublicationFact(publicationInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = publication.publisher.id;
    const idempotencyKeyHash = hashJson({
      kind: "canopyproof-idempotency-key-v1",
      value: idempotencyKey,
    });
    const requestHash = hashJson({
      kind: "canopyproof-global-command-center-publication-commit-v1",
      snapshot,
      publication,
    });
    const receiptId = `cp_global_command_${hashJson({
      actorId,
      operation: OPERATION,
      idempotencyKeyHash,
    }).slice(0, 24)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, publication.publisher.organizationId, actorId);
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `global-command-center-command:${actorId}:${idempotencyKeyHash}`,
            );
            await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${STREAM_ID}`);

            const receipt = await readReceipt(transaction, receiptId);
            if (receipt) {
              assertReceipt(receipt, requestHash, publication);
              return requirePublishedSnapshot(transaction, publication.id);
            }

            const current = await resolveAndVerifyCurrentSource(
              resolveCurrentSource,
              transaction,
              snapshot,
              publication,
            );
            if (hashJson(current.snapshot) !== hashJson(snapshot)) {
              throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_CURRENT_SOURCE_MISMATCH");
            }

            const history = await loadHistory(transaction);
            verifyCanopyProofGlobalCommandCenterPublication(publication, snapshot, history);
            await assertNoPublicationConflict(transaction, publication);
            await insertDomainEvent(transaction, publication.auditEvent);
            await insertSnapshot(transaction, publication, snapshot);
            await insertPublicationFact(transaction, publication);
            await insertReceipt(transaction, {
              id: receiptId,
              actorId,
              idempotencyKeyHash,
              requestHash,
              publication,
            });
            return requirePublishedSnapshot(transaction, publication.id);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_DURABLE_WRITE_UNAVAILABLE");
  }

  async getPublication(publicationId: string) {
    const id = z.string().min(1).max(256).parse(publicationId);
    return this.prisma.$transaction(
      (transaction) => requirePublishedSnapshot(transaction, id),
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}

async function resolveAndVerifyCurrentSource(
  resolver: CanopyProofGlobalCommandCenterSourceResolver,
  transaction: PublishingTransaction,
  snapshot: CanopyProofGlobalCommandCenterSnapshot,
  publication: CanopyProofGlobalCommandCenterPublicationFact,
) {
  const current = await resolver(
    {
      generatedAt: snapshot.generatedAt,
      dashboardRoot: snapshot.lineage.dashboardRoot,
      sourceAuthorityRoot: publication.sourceAuthorityRoot,
      policyId: publication.policyId,
      policyRoot: publication.policyRoot,
      publisherId: publication.publisher.id,
      governorId: publication.governanceApproval.governor.id,
      organizationId: publication.publisher.organizationId,
    },
    transaction,
  );
  const currentSnapshot = verifyCanopyProofGlobalCommandCenterSnapshot(current.snapshot);
  const currentSourceAuthorityRoot = hashSchema.parse(current.sourceAuthorityRoot);
  if (
    buildCanopyProofGlobalCommandCenterSourceAuthorityRoot(currentSnapshot) !== currentSourceAuthorityRoot ||
    currentSourceAuthorityRoot !== publication.sourceAuthorityRoot ||
    hashJson(current.publisher) !== hashJson(publication.publisher) ||
    hashJson(current.governor) !== hashJson(publication.governanceApproval.governor)
  ) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_CURRENT_SOURCE_AUTHORITY_INVALID");
  }
  return { snapshot: currentSnapshot, sourceAuthorityRoot: currentSourceAuthorityRoot };
}

async function requirePublishedSnapshot(
  transaction: PublishingTransaction,
  publicationId: string,
): Promise<CanopyProofGlobalCommandCenterPublishedSnapshot> {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT publication.id, publication.snapshot_id, publication.dashboard_root,
      publication.source_authority_root, publication.policy_root, publication.approval_root,
      publication.publisher_id, publication.publication_root, publication.audit_event_root,
      publication.fact_record,
      snapshot.generated_at AS generated_at_value, snapshot.metric_summary,
      snapshot.regional_summaries, snapshot.impact_indicators, snapshot.recent_activity,
      snapshot.lineage, snapshot.safety_boundary,
      snapshot.id AS stored_snapshot_id, snapshot.dashboard_root AS stored_dashboard_root
    FROM impact.global_command_center_publication_facts publication
    JOIN impact.global_command_center_snapshots snapshot ON snapshot.id = publication.snapshot_id
    WHERE publication.id = ${publicationId}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_PUBLICATION_NOT_FOUND");
  }
  const joined = z
    .object({
      ...publicationRowSchema.shape,
      generated_at_value: z.coerce.date(),
      metric_summary: z.unknown(),
      regional_summaries: z.unknown(),
      impact_indicators: z.unknown(),
      recent_activity: z.unknown(),
      lineage: z.unknown(),
      safety_boundary: z.unknown(),
      stored_snapshot_id: z.string().min(1),
      stored_dashboard_root: hashSchema,
    })
    .strict()
    .parse(rows[0]);
  if (joined.snapshot_id !== joined.stored_snapshot_id || joined.dashboard_root !== joined.stored_dashboard_root) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_PUBLICATION_BINDING_INVALID");
  }
  const snapshot = snapshotFromRow({
    id: joined.stored_snapshot_id,
    generated_at_value: joined.generated_at_value,
    metric_summary: joined.metric_summary,
    regional_summaries: joined.regional_summaries,
    impact_indicators: joined.impact_indicators,
    recent_activity: joined.recent_activity,
    lineage: joined.lineage,
    safety_boundary: joined.safety_boundary,
    dashboard_root: joined.stored_dashboard_root,
  });
  const publication = parseCanopyProofGlobalCommandCenterPublicationFact(joined.fact_record);
  assertPublicationColumns(joined, publication);
  const events = await loadHistory(transaction);
  const eventIndex = events.findIndex((event) => event.eventRoot === publication.auditEvent.eventRoot);
  if (eventIndex < 0 || hashJson(events[eventIndex]) !== hashJson(publication.auditEvent)) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_PUBLICATION_AUDIT_INVALID");
  }
  verifyCanopyProofGlobalCommandCenterPublication(publication, snapshot, events.slice(0, eventIndex));
  return { snapshot, publication };
}

function snapshotFromRow(input: unknown) {
  const row = snapshotRowSchema.parse(input);
  const snapshot = verifyCanopyProofGlobalCommandCenterSnapshot({
    service: "canopyproof-global-impact-command-center",
    generatedAt: row.generated_at_value.toISOString(),
    metrics: row.metric_summary,
    regions: row.regional_summaries,
    impactIndicators: row.impact_indicators,
    recentActivity: row.recent_activity,
    lineage: row.lineage,
    safety: row.safety_boundary,
  });
  if (snapshot.lineage.dashboardRoot !== row.dashboard_root) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_STORED_SNAPSHOT_ROOT_INVALID");
  }
  return snapshot;
}

function assertPublicationColumns(
  row: z.output<typeof publicationRowSchema>,
  publication: CanopyProofGlobalCommandCenterPublicationFact,
) {
  if (
    row.id !== publication.id ||
    row.snapshot_id !== publication.snapshotId ||
    row.dashboard_root !== publication.dashboardRoot ||
    row.source_authority_root !== publication.sourceAuthorityRoot ||
    row.policy_root !== publication.policyRoot ||
    row.approval_root !== publication.governanceApproval.approvalRoot ||
    row.publisher_id !== publication.publisher.id ||
    row.publication_root !== publication.publicationRoot ||
    row.audit_event_root !== publication.auditEvent.eventRoot
  ) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_PUBLICATION_COLUMNS_INVALID");
  }
}

async function loadHistory(transaction: PublishingTransaction) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, action, actor_id, entity_type, entity_id, previous_root,
      payload_hash, event_root, created_at AS created_at_value, rationale
    FROM audit.domain_events
    WHERE stream_id = ${STREAM_ID}
    ORDER BY sequence_no, id
  `);
  const events = rows.map(mapEvent);
  if (events.length > 0 && !verifyCanopyProofAuditChain(events, events.at(-1)!.createdAt).valid) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_AUDIT_HISTORY_INVALID");
  }
  return events;
}

async function assertNoPublicationConflict(
  transaction: PublishingTransaction,
  publication: CanopyProofGlobalCommandCenterPublicationFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM impact.global_command_center_publication_facts
    WHERE id = ${publication.id}
      OR snapshot_id = ${publication.snapshotId}
      OR dashboard_root = ${publication.dashboardRoot}
      OR publication_root = ${publication.publicationRoot}
    LIMIT 1
  `);
  if (rows.length !== 0) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_PUBLICATION_CONFLICT");
  }
}

async function insertDomainEvent(
  transaction: PublishingTransaction,
  event: CanopyProofAuditEvent,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.domain_events (
      id, stream_id, action, actor_id, entity_type, entity_id,
      previous_root, payload_hash, event_root, created_at, rationale
    ) VALUES (
      ${event.id}, ${STREAM_ID}, ${event.action}, ${event.actor}, ${event.entityType}, ${event.entityId},
      ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
    )
  `));
}

async function insertSnapshot(
  transaction: PublishingTransaction,
  publication: CanopyProofGlobalCommandCenterPublicationFact,
  snapshot: CanopyProofGlobalCommandCenterSnapshot,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO impact.global_command_center_snapshots (
      id, generated_at, metric_summary, regional_summaries, impact_indicators,
      recent_activity, lineage, safety_boundary, dashboard_root, created_by
    ) VALUES (
      ${publication.snapshotId}, ${asDate(snapshot.generatedAt)}, ${JSON.stringify(snapshot.metrics)}::jsonb,
      ${JSON.stringify(snapshot.regions)}::jsonb, ${JSON.stringify(snapshot.impactIndicators)}::jsonb,
      ${JSON.stringify(snapshot.recentActivity)}::jsonb, ${JSON.stringify(snapshot.lineage)}::jsonb,
      ${JSON.stringify(snapshot.safety)}::jsonb, ${snapshot.lineage.dashboardRoot}, ${publication.publisher.id}
    )
  `));
}

async function insertPublicationFact(
  transaction: PublishingTransaction,
  publication: CanopyProofGlobalCommandCenterPublicationFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO impact.global_command_center_publication_facts (
      id, snapshot_id, projection_schema, dashboard_root, snapshot_content_root,
      source_authority_root, policy_id, policy_root, approval_root,
      publisher_id, publisher_snapshot, published_at, publication_root,
      audit_event_root, fact_record
    ) VALUES (
      ${publication.id}, ${publication.snapshotId}, ${publication.projectionSchema},
      ${publication.dashboardRoot}, ${publication.snapshotContentRoot}, ${publication.sourceAuthorityRoot},
      ${publication.policyId}, ${publication.policyRoot}, ${publication.governanceApproval.approvalRoot},
      ${publication.publisher.id}, ${JSON.stringify(publication.publisher)}::jsonb,
      ${asDate(publication.publishedAt)}, ${publication.publicationRoot},
      ${publication.auditEvent.eventRoot}, ${JSON.stringify(publication)}::jsonb
    )
  `));
}

async function insertReceipt(
  transaction: PublishingTransaction,
  input: Readonly<{
    id: string;
    actorId: string;
    idempotencyKeyHash: string;
    requestHash: string;
    publication: CanopyProofGlobalCommandCenterPublicationFact;
  }>,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.command_receipts (
      id, actor_id, operation, idempotency_key_hash, request_hash,
      result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
    ) VALUES (
      ${input.id}, ${input.actorId}, ${OPERATION}, ${input.idempotencyKeyHash}, ${input.requestHash},
      'global_command_center_snapshot_publication', ${input.publication.id},
      ${input.publication.publicationRoot}, ${input.publication.auditEvent.eventRoot},
      ${asDate(input.publication.publishedAt)}
    )
  `));
}

async function readReceipt(transaction: PublishingTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId} FOR UPDATE
  `);
  if (rows.length > 1) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_RECEIPT_CARDINALITY_INVALID");
  }
  return rows[0] ? receiptRowSchema.parse(rows[0]) : undefined;
}

function assertReceipt(
  receipt: z.output<typeof receiptRowSchema>,
  requestHash: string,
  publication: CanopyProofGlobalCommandCenterPublicationFact,
) {
  if (
    receipt.request_hash !== requestHash ||
    receipt.result_entity_id !== publication.id ||
    receipt.response_hash !== publication.publicationRoot ||
    receipt.audit_event_root !== publication.auditEvent.eventRoot
  ) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_IDEMPOTENCY_CONFLICT");
  }
}

async function setContext(
  transaction: PublishingTransaction,
  organizationId: string,
  actorId: string,
) {
  const organization = z.string().min(1).max(256).parse(organizationId);
  const actor = z.string().min(1).max(256).parse(actorId);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organization}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actor}, true)`);
}

function mapEvent(input: unknown): CanopyProofAuditEvent {
  const row = eventRowSchema.parse(input);
  return {
    id: row.id,
    action: row.action,
    actor: row.actor_id,
    entityType: row.entity_type as CanopyProofAuditEvent["entityType"],
    entityId: row.entity_id,
    previousRoot: row.previous_root,
    payloadHash: row.payload_hash,
    eventRoot: row.event_root,
    createdAt: row.created_at_value.toISOString(),
    rationale: row.rationale,
  };
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_MUTATION_CARDINALITY_INVALID");
  }
}
