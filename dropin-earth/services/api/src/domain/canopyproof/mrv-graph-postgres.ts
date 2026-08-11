import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofMrvGraphAuthorityService,
  type CanopyProofMrvGraphAuthoritySnapshot,
  type CanopyProofMrvGraphEdgeFact,
  type CanopyProofMrvGraphSnapshotFact,
  type CanopyProofMrvGraphSnapshotMemberFact,
} from "./mrv-graph-authority.js";
import {
  canopyProofAuditEntityTypes,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";

type MrvTransaction = Prisma.TransactionClient;

export type CanopyProofMrvGraphRepositoryStatus = {
  readonly service: "canopyproof-mrv-graph-repository";
  readonly storage: "postgresql";
  readonly routeMounted: false;
  readonly appendOnly: true;
  readonly tenantScoped: true;
  readonly projectScopedStreams: true;
  readonly serializableWrites: true;
  readonly idempotencyRequired: true;
  readonly sourceRootsReResolved: true;
  readonly snapshotsHumanReviewed: true;
  readonly finalProofAuthority: false;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const edgeEnvelopeSchema = z
  .object({
    factType: z.literal("mrv_graph_edge"),
    id: z.string().min(1).max(256),
    organizationId: z.string().min(1).max(256),
    projectId: z.string().min(1).max(256),
    source: z.object({ type: z.string(), id: z.string(), root: z.string().regex(HASH_PATTERN) }).passthrough(),
    relationship: z.string().min(1),
    target: z.object({ type: z.string(), id: z.string(), root: z.string().regex(HASH_PATTERN) }).passthrough(),
    methodology: z.object({ id: z.string(), publicationRoot: z.string().regex(HASH_PATTERN) }).passthrough(),
    actor: z.object({ id: z.string().min(1) }).passthrough(),
    actorMode: z.enum(["human", "advisory_agent"]),
    edgeState: z.enum(["current", "review_required"]),
    commandHash: z.string().regex(HASH_PATTERN),
    projectSequence: z.number().int().positive(),
    edgeRoot: z.string().regex(HASH_PATTERN),
    auditEvent: z.unknown(),
  })
  .passthrough();
const snapshotEnvelopeSchema = z
  .object({
    factType: z.literal("mrv_graph_snapshot"),
    id: z.string().min(1).max(256),
    organizationId: z.string().min(1).max(256),
    projectId: z.string().min(1).max(256),
    projectRoot: z.string().regex(HASH_PATTERN),
    methodology: z.object({ id: z.string(), publicationRoot: z.string().regex(HASH_PATTERN) }).passthrough(),
    edgeCount: z.number().int().positive().max(512),
    edgeSetRoot: z.string().regex(HASH_PATTERN),
    coverage: z.object({ coverageRoot: z.string().regex(HASH_PATTERN) }).passthrough(),
    state: z.enum(["reviewed_for_lineage", "review_required"]),
    reviewer: z.object({ id: z.string().min(1) }).passthrough(),
    snapshotSequence: z.number().int().positive(),
    commandHash: z.string().regex(HASH_PATTERN),
    projectSequence: z.number().int().positive(),
    snapshotRoot: z.string().regex(HASH_PATTERN),
    auditEvent: z.unknown(),
  })
  .passthrough();
const memberEnvelopeSchema = z
  .object({
    factType: z.literal("mrv_graph_snapshot_member"),
    id: z.string().min(1).max(256),
    snapshotId: z.string().min(1).max(256),
    organizationId: z.string().min(1).max(256),
    projectId: z.string().min(1).max(256),
    memberIndex: z.number().int().nonnegative().max(511),
    edgeId: z.string().min(1).max(256),
    edgeRoot: z.string().regex(HASH_PATTERN),
    memberRoot: z.string().regex(HASH_PATTERN),
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

export class PrismaCanopyProofMrvGraphRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofMrvGraphRepositoryStatus {
    return {
      service: "canopyproof-mrv-graph-repository",
      storage: "postgresql",
      routeMounted: false,
      appendOnly: true,
      tenantScoped: true,
      projectScopedStreams: true,
      serializableWrites: true,
      idempotencyRequired: true,
      sourceRootsReResolved: true,
      snapshotsHumanReviewed: true,
      finalProofAuthority: false,
    };
  }

  async commitEdge(factInput: CanopyProofMrvGraphEdgeFact, idempotencyKeyInput: string) {
    const fact = parseEdge(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = fact.actor.id;
    const operation = "mrv.graph-edge.commit";
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({ kind: "canopyproof-mrv-edge-commit-v1", fact });
    const receiptId = `cp_mrv_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, fact.organizationId, actorId);
            await lockCommand(transaction, actorId, operation, idempotencyKeyHash);
            await lockProjectStream(transaction, fact.projectId);
            const snapshot = await this.loadSnapshot(transaction, fact.organizationId, fact.projectId);
            const receipt = await readReceipt(transaction, receiptId);
            if (receipt) {
              assertReceipt(
                receipt,
                requestHash,
                "mrv_graph_edge",
                fact.id,
                fact.edgeRoot,
                fact.auditEvent.eventRoot,
                "CANOPYPROOF_MRV_EDGE_IDEMPOTENCY_CONFLICT",
              );
              return CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(snapshot).getEdge(fact.id);
            }
            assertProposedEdge(snapshot, fact);
            await insertDomainEvent(transaction, projectStream(fact.projectId), fact.auditEvent);
            await insertEdge(transaction, fact);
            await insertReceipt(transaction, {
              id: receiptId,
              actorId,
              operation,
              idempotencyKeyHash,
              requestHash,
              resultEntityType: "mrv_graph_edge",
              resultEntityId: fact.id,
              responseHash: fact.edgeRoot,
              auditEventRoot: fact.auditEvent.eventRoot,
              createdAt: fact.createdAt,
            });
            return this.requireEdge(transaction, fact.organizationId, fact.projectId, fact.id);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_MRV_EDGE_DURABLE_WRITE_UNAVAILABLE");
  }

  async commitSnapshot(
    snapshotInput: CanopyProofMrvGraphSnapshotFact,
    memberInputs: readonly CanopyProofMrvGraphSnapshotMemberFact[],
    idempotencyKeyInput: string,
  ) {
    const fact = parseSnapshot(snapshotInput);
    const members = memberInputs.map(parseMember);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = fact.reviewer.id;
    const operation = "mrv.graph-snapshot.commit";
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({ kind: "canopyproof-mrv-snapshot-commit-v1", fact, members });
    const receiptId = `cp_mrv_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, fact.organizationId, actorId);
            await lockCommand(transaction, actorId, operation, idempotencyKeyHash);
            await lockProjectStream(transaction, fact.projectId);
            const snapshot = await this.loadSnapshot(transaction, fact.organizationId, fact.projectId);
            const receipt = await readReceipt(transaction, receiptId);
            if (receipt) {
              assertReceipt(
                receipt,
                requestHash,
                "mrv_graph_snapshot",
                fact.id,
                fact.snapshotRoot,
                fact.auditEvent.eventRoot,
                "CANOPYPROOF_MRV_SNAPSHOT_IDEMPOTENCY_CONFLICT",
              );
              return CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(snapshot).getSnapshot(fact.id);
            }
            assertProposedSnapshot(snapshot, fact, members);
            await insertDomainEvent(transaction, projectStream(fact.projectId), fact.auditEvent);
            await insertSnapshot(transaction, fact);
            for (const member of members) await insertSnapshotMember(transaction, member);
            await insertReceipt(transaction, {
              id: receiptId,
              actorId,
              operation,
              idempotencyKeyHash,
              requestHash,
              resultEntityType: "mrv_graph_snapshot",
              resultEntityId: fact.id,
              responseHash: fact.snapshotRoot,
              auditEventRoot: fact.auditEvent.eventRoot,
              createdAt: fact.reviewedAt,
            });
            return this.requireSnapshot(transaction, fact.organizationId, fact.projectId, fact.id);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_MRV_SNAPSHOT_DURABLE_WRITE_UNAVAILABLE");
  }

  async loadAuthoritySnapshot(organizationId: string, projectId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.loadSnapshot(transaction, organizationId, projectId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getEdge(organizationId: string, projectId: string, edgeId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.requireEdge(transaction, organizationId, projectId, edgeId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getSnapshot(organizationId: string, projectId: string, snapshotId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.requireSnapshot(transaction, organizationId, projectId, snapshotId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async projectGraph(organizationId: string, projectId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        const snapshot = await this.loadSnapshot(transaction, organizationId, projectId);
        return CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(snapshot).projectGraph(
          organizationId,
          projectId,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async requireEdge(
    transaction: MrvTransaction,
    organizationId: string,
    projectId: string,
    edgeId: string,
  ) {
    const snapshot = await this.loadSnapshot(transaction, organizationId, projectId);
    return CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(snapshot).getEdge(edgeId);
  }

  private async requireSnapshot(
    transaction: MrvTransaction,
    organizationId: string,
    projectId: string,
    snapshotId: string,
  ) {
    const snapshot = await this.loadSnapshot(transaction, organizationId, projectId);
    return CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(snapshot).getSnapshot(snapshotId);
  }

  private async loadSnapshot(
    transaction: MrvTransaction,
    organizationId: string,
    projectId: string,
  ): Promise<CanopyProofMrvGraphAuthoritySnapshot> {
    const projectScope = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id
      FROM projects.projects
      WHERE id = ${projectId} AND organization_id = ${organizationId}
      LIMIT 1
    `);
    if (projectScope.length !== 1) throw new Error("CANOPYPROOF_MRV_ORGANIZATION_SCOPE_MISMATCH");
    const [eventRows, edgeRows, snapshotRows, memberRows] = await Promise.all([
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT id, action, actor_id, entity_type, entity_id, previous_root,
               payload_hash, event_root, created_at, rationale
        FROM audit.domain_events
        WHERE stream_id = ${projectStream(projectId)}
        ORDER BY sequence_no
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM mrv.graph_edge_facts
        WHERE organization_id = ${organizationId} AND project_id = ${projectId}
        ORDER BY project_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record
        FROM mrv.graph_snapshot_facts
        WHERE organization_id = ${organizationId} AND project_id = ${projectId}
        ORDER BY project_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT member.fact_record
        FROM mrv.graph_snapshot_member_facts member
        JOIN mrv.graph_snapshot_facts snapshot ON snapshot.id = member.snapshot_id
        WHERE member.organization_id = ${organizationId} AND member.project_id = ${projectId}
        ORDER BY snapshot.project_sequence, member.member_index, member.id
      `),
    ]);
    const streamEvents = eventRows.map(mapAuditEvent);
    assertEventChain(streamEvents);
    const snapshot: CanopyProofMrvGraphAuthoritySnapshot = {
      streamEvents,
      edges: edgeRows.map((row) => parseEdge(factRowSchema.parse(row).fact_record)),
      snapshots: snapshotRows.map((row) => parseSnapshot(factRowSchema.parse(row).fact_record)),
      snapshotMembers: memberRows.map((row) => parseMember(factRowSchema.parse(row).fact_record)),
    };
    return CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
  }
}

function assertProposedEdge(snapshot: CanopyProofMrvGraphAuthoritySnapshot, fact: CanopyProofMrvGraphEdgeFact) {
  if (
    snapshot.streamEvents.some((event) => event.id === fact.auditEvent.id || event.eventRoot === fact.auditEvent.eventRoot) ||
    snapshot.edges.some((candidate) => candidate.id === fact.id || candidate.edgeRoot === fact.edgeRoot)
  ) {
    throw new Error("CANOPYPROOF_MRV_EDGE_FACT_CONFLICT");
  }
  CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot({
    ...snapshot,
    streamEvents: [...snapshot.streamEvents, fact.auditEvent],
    edges: [...snapshot.edges, fact],
  });
}

function assertProposedSnapshot(
  snapshot: CanopyProofMrvGraphAuthoritySnapshot,
  fact: CanopyProofMrvGraphSnapshotFact,
  members: readonly CanopyProofMrvGraphSnapshotMemberFact[],
) {
  if (
    snapshot.streamEvents.some((event) => event.id === fact.auditEvent.id || event.eventRoot === fact.auditEvent.eventRoot) ||
    snapshot.snapshots.some((candidate) => candidate.id === fact.id || candidate.snapshotRoot === fact.snapshotRoot) ||
    members.some((member) => snapshot.snapshotMembers.some((candidate) => candidate.id === member.id))
  ) {
    throw new Error("CANOPYPROOF_MRV_SNAPSHOT_FACT_CONFLICT");
  }
  CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot({
    streamEvents: [...snapshot.streamEvents, fact.auditEvent],
    edges: snapshot.edges,
    snapshots: [...snapshot.snapshots, fact],
    snapshotMembers: [...snapshot.snapshotMembers, ...members],
  });
}

async function insertDomainEvent(transaction: MrvTransaction, streamId: string, event: CanopyProofAuditEvent) {
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

async function insertEdge(transaction: MrvTransaction, fact: CanopyProofMrvGraphEdgeFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO mrv.graph_edge_facts (
      id, organization_id, project_id, source_type, source_id, source_root,
      relationship, target_type, target_id, target_root, methodology_id,
      methodology_publication_root, actor_id, actor_mode, edge_state,
      command_hash, project_sequence, previous_event_root, created_at,
      edge_hash, edge_root, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.source.type}, ${fact.source.id},
      ${fact.source.root}, ${fact.relationship}, ${fact.target.type}, ${fact.target.id}, ${fact.target.root},
      ${fact.methodology.id}, ${fact.methodology.publicationRoot}, ${fact.actor.id}, ${fact.actorMode},
      ${fact.edgeState}, ${fact.commandHash}, ${fact.projectSequence}, ${fact.previousEventRoot},
      ${asDate(fact.createdAt)}, ${fact.edgeHash}, ${fact.edgeRoot}, ${JSON.stringify(fact)}::jsonb,
      ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertSnapshot(transaction: MrvTransaction, fact: CanopyProofMrvGraphSnapshotFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO mrv.graph_snapshot_facts (
      id, organization_id, project_id, project_root, methodology_id,
      methodology_publication_root, edge_count, edge_set_root, coverage_root,
      snapshot_state, reviewer_id, snapshot_sequence, previous_snapshot_root,
      command_hash, project_sequence, previous_event_root, reviewed_at,
      snapshot_hash, snapshot_root, fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.projectRoot}, ${fact.methodology.id},
      ${fact.methodology.publicationRoot}, ${fact.edgeCount}, ${fact.edgeSetRoot}, ${fact.coverage.coverageRoot},
      ${fact.state}, ${fact.reviewer.id}, ${fact.snapshotSequence}, ${fact.previousSnapshotRoot},
      ${fact.commandHash}, ${fact.projectSequence}, ${fact.previousEventRoot}, ${asDate(fact.reviewedAt)},
      ${fact.snapshotHash}, ${fact.snapshotRoot}, ${JSON.stringify(fact)}::jsonb, ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertSnapshotMember(transaction: MrvTransaction, fact: CanopyProofMrvGraphSnapshotMemberFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO mrv.graph_snapshot_member_facts (
      id, snapshot_id, organization_id, project_id, member_index,
      edge_id, edge_root, member_hash, member_root, fact_record
    ) VALUES (
      ${fact.id}, ${fact.snapshotId}, ${fact.organizationId}, ${fact.projectId}, ${fact.memberIndex},
      ${fact.edgeId}, ${fact.edgeRoot}, ${fact.memberHash}, ${fact.memberRoot}, ${JSON.stringify(fact)}::jsonb
    )
  `));
}

async function insertReceipt(
  transaction: MrvTransaction,
  input: Readonly<{
    id: string;
    actorId: string;
    operation: string;
    idempotencyKeyHash: string;
    requestHash: string;
    resultEntityType: string;
    resultEntityId: string;
    responseHash: string;
    auditEventRoot: string;
    createdAt: string;
  }>,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.command_receipts (
      id, actor_id, operation, idempotency_key_hash, request_hash,
      result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
    ) VALUES (
      ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash}, ${input.requestHash},
      ${input.resultEntityType}, ${input.resultEntityId}, ${input.responseHash}, ${input.auditEventRoot},
      ${asDate(input.createdAt)}
    )
  `));
}

async function readReceipt(transaction: MrvTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts
    WHERE id = ${receiptId}
    FOR UPDATE
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_MRV_RECEIPT_CARDINALITY_INVALID");
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

async function lockCommand(
  transaction: MrvTransaction,
  actorId: string,
  operation: string,
  idempotencyKeyHash: string,
) {
  await acquireCanopyProofPostgresTransactionLock(
    transaction,
    `mrv-command:${actorId}:${operation}:${idempotencyKeyHash}`,
  );
}

async function lockProjectStream(transaction: MrvTransaction, projectId: string) {
  await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${projectStream(projectId)}`);
}

async function setContext(transaction: MrvTransaction, organizationId: string, actorId = "system-read") {
  const organization = z.string().min(1).max(256).parse(organizationId);
  const actor = z.string().min(1).max(256).parse(actorId);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organization}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actor}, true)`);
}

function parseEdge(input: unknown): CanopyProofMrvGraphEdgeFact {
  edgeEnvelopeSchema.parse(input);
  return input as CanopyProofMrvGraphEdgeFact;
}

function parseSnapshot(input: unknown): CanopyProofMrvGraphSnapshotFact {
  snapshotEnvelopeSchema.parse(input);
  return input as CanopyProofMrvGraphSnapshotFact;
}

function parseMember(input: unknown): CanopyProofMrvGraphSnapshotMemberFact {
  memberEnvelopeSchema.parse(input);
  return input as CanopyProofMrvGraphSnapshotMemberFact;
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

function assertEventChain(events: readonly CanopyProofAuditEvent[]) {
  const terminal = events.at(-1);
  if (terminal && !verifyCanopyProofAuditChain(events, terminal.createdAt).valid) {
    throw new Error("CANOPYPROOF_MRV_EVENT_STREAM_INVALID");
  }
}

function projectStream(projectId: string) {
  return `mrv-project:${z.string().min(1).max(256).parse(projectId)}`;
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_MRV_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_MRV_MUTATION_CARDINALITY_INVALID");
}
