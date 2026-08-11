import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofPublicTransparencyAuthorityService,
  type CanopyProofPublicDisclosureReviewFact,
  type CanopyProofPublicTransparencyAuthoritySnapshot,
  type CanopyProofPublicTransparencyPublicationFact,
  type CanopyProofPublicTransparencyProjection,
  type CanopyProofPublicTransparencySourceAuthority,
} from "./public-transparency-authority.js";
import type { CanopyProofAuditEvent } from "./proof-engine.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";

type TransparencyTransaction = Prisma.TransactionClient;
type TransparencyFact =
  | CanopyProofPublicDisclosureReviewFact
  | CanopyProofPublicTransparencyPublicationFact;

export type CanopyProofPublicTransparencySourceQuery = Readonly<{
  organizationId: string;
  projectId: string;
  recordId: string;
  lifecycleBindingId: string;
  signatureReceiptId: string;
  evaluatedAt: string;
}>;

export type CanopyProofPublicTransparencySourceResolver = (
  query: CanopyProofPublicTransparencySourceQuery,
  transaction: TransparencyTransaction,
) => Promise<CanopyProofPublicTransparencySourceAuthority>;

export type CanopyProofPublicTransparencyRepositoryStatus = {
  readonly service: "canopyproof-public-transparency-repository";
  readonly storage: "postgresql";
  readonly routeMounted: false;
  readonly productionActivationEnabled: false;
  readonly publicRelianceAuthorized: false;
  readonly appendOnly: true;
  readonly tenantScoped: true;
  readonly serializableWrites: true;
  readonly exactRetryRequired: true;
  readonly currentSourceReResolved: true;
  readonly independentHumanPrivacyReviewRequired: true;
  readonly accreditedHumanPublisherRequired: true;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const factRowSchema = z.object({ fact_record: z.unknown() });
const receiptRowSchema = z.object({
  request_hash: z.string().regex(HASH_PATTERN),
  result_entity_type: z.enum(["public_disclosure_review", "public_transparency_publication"]),
  result_entity_id: z.string().min(1),
  response_hash: z.string().regex(HASH_PATTERN),
  audit_event_root: z.string().regex(HASH_PATTERN),
});
const baseFactSchema = z.object({
  factType: z.enum(["public_disclosure_review", "public_transparency_publication"]),
  id: z.string().min(1).max(256),
  organizationId: z.string().min(1).max(256),
  projectId: z.string().min(1).max(256),
  recordId: z.string().min(1).max(256),
  commandHash: z.string().regex(HASH_PATTERN),
  projectSequence: z.number().int().positive(),
  previousEventRoot: z.string().regex(HASH_PATTERN),
  sourceRoot: z.string().regex(HASH_PATTERN),
  safety: z.object({
    routeMounted: z.literal(false),
    productionActivationEnabled: z.literal(false),
    publicRelianceAuthorized: z.literal(false),
  }).passthrough(),
  auditEvent: z.object({ eventRoot: z.string().regex(HASH_PATTERN) }).passthrough(),
}).passthrough();
const eventRowSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
  actor_id: z.string().min(1),
  entity_type: z.enum(["public_disclosure_review", "public_transparency_publication"]),
  entity_id: z.string().min(1),
  previous_root: z.string().regex(HASH_PATTERN),
  payload_hash: z.string().regex(HASH_PATTERN),
  event_root: z.string().regex(HASH_PATTERN),
  created_at_value: z.coerce.date(),
  rationale: z.string().min(1),
});

export class PrismaCanopyProofPublicTransparencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofPublicTransparencyRepositoryStatus {
    return {
      service: "canopyproof-public-transparency-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      publicRelianceAuthorized: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentSourceReResolved: true,
      independentHumanPrivacyReviewRequired: true,
      accreditedHumanPublisherRequired: true,
    };
  }

  async commitReview(
    factInput: CanopyProofPublicDisclosureReviewFact,
    idempotencyKey: string,
    resolveCurrentSource: CanopyProofPublicTransparencySourceResolver,
  ) {
    return this.commitFact(parseReview(factInput), idempotencyKey, resolveCurrentSource);
  }

  async commitPublication(
    factInput: CanopyProofPublicTransparencyPublicationFact,
    idempotencyKey: string,
    resolveCurrentSource: CanopyProofPublicTransparencySourceResolver,
  ) {
    return this.commitFact(parsePublication(factInput), idempotencyKey, resolveCurrentSource);
  }

  async getReview(organizationId: string, reviewId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.requireReview(transaction, organizationId, reviewId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getPublication(organizationId: string, publicationId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.requirePublication(transaction, organizationId, publicationId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async listReviews(organizationId: string, projectId?: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        const service = CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot(
          await this.loadSnapshot(transaction, organizationId),
        );
        return service.listReviews({ organizationId, ...(projectId ? { projectId } : {}) });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async listPublications(organizationId: string, projectId?: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        const service = CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot(
          await this.loadSnapshot(transaction, organizationId),
        );
        return service.listPublications({ organizationId, ...(projectId ? { projectId } : {}) });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async loadAuthoritySnapshot(organizationId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.loadSnapshot(transaction, organizationId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async projectPublication(
    organizationId: string,
    publicationId: string,
    evaluatedAt: string,
    resolveCurrentSource: CanopyProofPublicTransparencySourceResolver,
  ): Promise<CanopyProofPublicTransparencyProjection> {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.projectPublicationInTransaction(
          transaction,
          organizationId,
          publicationId,
          evaluatedAt,
          resolveCurrentSource,
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Reuses a caller-owned transaction after its exact tenant context has been established. */
  async projectPublicationInTransaction(
    transaction: Prisma.TransactionClient,
    organizationId: string,
    publicationId: string,
    evaluatedAt: string,
    resolveCurrentSource: CanopyProofPublicTransparencySourceResolver,
  ): Promise<CanopyProofPublicTransparencyProjection> {
    const service = CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot(
      await this.loadSnapshot(transaction, organizationId),
    );
    const publication = service.getPublication(publicationId);
    const source = await resolveCurrentSource(
      {
        organizationId,
        projectId: publication.projectId,
        recordId: publication.recordId,
        lifecycleBindingId: publication.lifecycleBindingId,
        signatureReceiptId: publication.signatureReceiptId,
        evaluatedAt: canonicalDate(evaluatedAt).toISOString(),
      },
      transaction,
    );
    return service.projectPublication(publicationId, source);
  }

  private async commitFact<T extends TransparencyFact>(
    fact: T,
    idempotencyKeyInput: string,
    resolveCurrentSource: CanopyProofPublicTransparencySourceResolver,
  ): Promise<T> {
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = actorFor(fact);
    const operation = operationFor(fact.factType);
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({ kind: `canopyproof-${fact.factType}-commit-v1`, fact });
    const receiptId = `cp_public_transparency_command_${hashJson({
      actorId,
      operation,
      idempotencyKeyHash,
    }).slice(0, 24)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, fact.organizationId, actorId);
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `public-transparency-command:${actorId}:${operation}:${idempotencyKeyHash}`,
            );
            const authorityStream = streamId(fact);
            await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${authorityStream}`);
            const receipt = await readReceipt(transaction, receiptId);
            if (receipt) {
              assertReceipt(receipt, requestHash, fact);
              return this.requireFact(transaction, fact.organizationId, fact) as Promise<T>;
            }

            const snapshot = await this.loadSnapshot(transaction, fact.organizationId);
            const source = await resolveCurrentSource(sourceQuery(fact), transaction);
            assertProposedFact(snapshot, fact, source);
            await insertDomainEvent(transaction, authorityStream, fact.auditEvent);
            await insertFact(transaction, fact);
            await insertReceipt(transaction, {
              id: receiptId,
              actorId,
              operation,
              idempotencyKeyHash,
              requestHash,
              fact,
            });
            return this.requireFact(transaction, fact.organizationId, fact) as Promise<T>;
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_DURABLE_WRITE_UNAVAILABLE");
  }

  private async requireFact(
    transaction: TransparencyTransaction,
    organizationId: string,
    fact: TransparencyFact,
  ) {
    return fact.factType === "public_disclosure_review"
      ? this.requireReview(transaction, organizationId, fact.id)
      : this.requirePublication(transaction, organizationId, fact.id);
  }

  private async requireReview(
    transaction: TransparencyTransaction,
    organizationId: string,
    reviewId: string,
  ) {
    const service = CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot(
      await this.loadSnapshot(transaction, organizationId),
    );
    const fact = service.getReview(reviewId);
    if (fact.organizationId !== organizationId) {
      throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_ORGANIZATION_SCOPE_MISMATCH");
    }
    return fact;
  }

  private async requirePublication(
    transaction: TransparencyTransaction,
    organizationId: string,
    publicationId: string,
  ) {
    const service = CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot(
      await this.loadSnapshot(transaction, organizationId),
    );
    const fact = service.getPublication(publicationId);
    if (fact.organizationId !== organizationId) {
      throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_ORGANIZATION_SCOPE_MISMATCH");
    }
    return fact;
  }

  private async loadSnapshot(
    transaction: TransparencyTransaction,
    organizationId: string,
  ): Promise<CanopyProofPublicTransparencyAuthoritySnapshot> {
    const organizationRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id FROM organizations.organizations WHERE id = ${organizationId} LIMIT 1
    `);
    if (organizationRows.length !== 1) {
      throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_ORGANIZATION_SCOPE_MISMATCH");
    }
    const [reviewRows, publicationRows, eventRows] = await Promise.all([
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record FROM transparency.public_disclosure_review_facts
        WHERE organization_id = ${organizationId}
        ORDER BY project_id, project_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record FROM transparency.public_transparency_publication_facts
        WHERE organization_id = ${organizationId}
        ORDER BY project_id, project_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        WITH authority_events AS (
          SELECT audit_event_root FROM transparency.public_disclosure_review_facts
          WHERE organization_id = ${organizationId}
          UNION ALL
          SELECT audit_event_root FROM transparency.public_transparency_publication_facts
          WHERE organization_id = ${organizationId}
        )
        SELECT event.id, event.action, event.actor_id, event.entity_type, event.entity_id,
          event.previous_root, event.payload_hash, event.event_root,
          event.created_at AS created_at_value, event.rationale
        FROM audit.domain_events event
        JOIN authority_events authority ON authority.audit_event_root = event.event_root
        ORDER BY event.stream_id, event.sequence_no, event.id
      `),
    ]);
    const snapshot: CanopyProofPublicTransparencyAuthoritySnapshot = {
      reviews: reviewRows.map((row) => parseReview(factRowSchema.parse(row).fact_record)),
      publications: publicationRows.map((row) => parsePublication(factRowSchema.parse(row).fact_record)),
      streamEvents: eventRows.map(mapEvent),
    };
    return CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
  }
}

function assertProposedFact(
  snapshot: CanopyProofPublicTransparencyAuthoritySnapshot,
  fact: TransparencyFact,
  source: CanopyProofPublicTransparencySourceAuthority,
) {
  const service = CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot(snapshot);
  if (
    snapshot.reviews.some((candidate) => candidate.id === fact.id || candidate.reviewRoot === responseRoot(fact)) ||
    snapshot.publications.some((candidate) =>
      candidate.id === fact.id || candidate.publicationRoot === responseRoot(fact))
  ) {
    throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_FACT_CONFLICT");
  }
  const proposed = fact.factType === "public_disclosure_review"
    ? service.reviewDisclosure(
      {
        organizationId: fact.organizationId,
        projectId: fact.projectId,
        recordId: fact.recordId,
        expectedRecordRoot: fact.recordRoot,
        expectedLifecycleProjectionRoot: fact.lifecycleProjectionRoot,
        classification: fact.classification,
        locationDisclosure: fact.locationDisclosure,
        areaDisclosure: fact.areaDisclosure,
        reasonCodes: fact.reasonCodes,
        limitationHashes: fact.limitationHashes,
        reviewedAt: fact.reviewedAt,
      },
      { reviewer: fact.reviewer, source },
    )
    : service.publish(
      {
        reviewId: fact.reviewId,
        expectedReviewRoot: fact.reviewRoot,
        expectedLifecycleProjectionRoot: fact.lifecycleProjectionRoot,
        publishedAt: fact.publishedAt,
      },
      { publisher: fact.publisher, source },
    );
  if (hashJson(proposed) !== hashJson(fact)) {
    throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_CURRENT_SOURCE_MISMATCH");
  }
}

async function insertDomainEvent(
  transaction: TransparencyTransaction,
  authorityStream: string,
  event: CanopyProofAuditEvent,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.domain_events (
      id, stream_id, action, actor_id, entity_type, entity_id,
      previous_root, payload_hash, event_root, created_at, rationale
    ) VALUES (
      ${event.id}, ${authorityStream}, ${event.action}, ${event.actor}, ${event.entityType}, ${event.entityId},
      ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot}, ${canonicalDate(event.createdAt)},
      ${event.rationale}
    )
  `));
}

async function insertFact(transaction: TransparencyTransaction, fact: TransparencyFact) {
  return fact.factType === "public_disclosure_review"
    ? insertReview(transaction, fact)
    : insertPublication(transaction, fact);
}

async function insertReview(
  transaction: TransparencyTransaction,
  fact: CanopyProofPublicDisclosureReviewFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO transparency.public_disclosure_review_facts (
      id, organization_id, project_id, record_id, record_root,
      governed_record_projection_root, lifecycle_binding_id, lifecycle_binding_root,
      lifecycle_projection_root, signature_receipt_id, signature_receipt_root,
      classification, location_disclosure, area_disclosure, reason_codes, limitation_hashes,
      reviewer_id, reviewer_snapshot, reviewed_at, command_hash, project_sequence,
      previous_event_root, source_event_roots, source_root, review_hash, review_root,
      fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.recordId}, ${fact.recordRoot},
      ${fact.governedRecordProjectionRoot}, ${fact.lifecycleBindingId}, ${fact.lifecycleBindingRoot},
      ${fact.lifecycleProjectionRoot}, ${fact.signatureReceiptId}, ${fact.signatureReceiptRoot},
      ${fact.classification}, ${fact.locationDisclosure}, ${fact.areaDisclosure},
      ${textArray(fact.reasonCodes)}, ${textArray(fact.limitationHashes)}, ${fact.reviewer.id},
      ${JSON.stringify(fact.reviewer)}::jsonb, ${canonicalDate(fact.reviewedAt)}, ${fact.commandHash},
      ${fact.projectSequence}, ${fact.previousEventRoot}, ${textArray(fact.sourceEventRoots)},
      ${fact.sourceRoot}, ${fact.reviewHash}, ${fact.reviewRoot}, ${JSON.stringify(fact)}::jsonb,
      ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertPublication(
  transaction: TransparencyTransaction,
  fact: CanopyProofPublicTransparencyPublicationFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO transparency.public_transparency_publication_facts (
      id, organization_id, project_id, public_organization_id, public_project_id,
      record_id, record_root, review_id, review_root, lifecycle_binding_id,
      lifecycle_binding_root, lifecycle_projection_root, signature_receipt_id,
      signature_receipt_root, issuer_authority_root, publisher_id, publisher_snapshot,
      published_at, command_hash, project_sequence, previous_event_root,
      source_event_roots, source_root, publication_hash, publication_root,
      fact_record, audit_event_root
    ) VALUES (
      ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.publicOrganizationId},
      ${fact.publicProjectId}, ${fact.recordId}, ${fact.recordRoot}, ${fact.reviewId},
      ${fact.reviewRoot}, ${fact.lifecycleBindingId}, ${fact.lifecycleBindingRoot},
      ${fact.lifecycleProjectionRoot}, ${fact.signatureReceiptId}, ${fact.signatureReceiptRoot},
      ${fact.issuerAuthorityRoot}, ${fact.publisher.id}, ${JSON.stringify(fact.publisher)}::jsonb,
      ${canonicalDate(fact.publishedAt)}, ${fact.commandHash}, ${fact.projectSequence},
      ${fact.previousEventRoot}, ${textArray(fact.sourceEventRoots)}, ${fact.sourceRoot},
      ${fact.publicationHash}, ${fact.publicationRoot}, ${JSON.stringify(fact)}::jsonb,
      ${fact.auditEvent.eventRoot}
    )
  `));
}

async function insertReceipt(
  transaction: TransparencyTransaction,
  input: Readonly<{
    id: string;
    actorId: string;
    operation: string;
    idempotencyKeyHash: string;
    requestHash: string;
    fact: TransparencyFact;
  }>,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.command_receipts (
      id, actor_id, operation, idempotency_key_hash, request_hash,
      result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
    ) VALUES (
      ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash},
      ${input.requestHash}, ${input.fact.factType}, ${input.fact.id}, ${responseRoot(input.fact)},
      ${input.fact.auditEvent.eventRoot}, ${canonicalDate(eventTime(input.fact))}
    )
  `));
}

async function readReceipt(transaction: TransparencyTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId} FOR UPDATE
  `);
  if (rows.length > 1) {
    throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_RECEIPT_CARDINALITY_INVALID");
  }
  return rows[0] ? receiptRowSchema.parse(rows[0]) : undefined;
}

function assertReceipt(
  receipt: z.infer<typeof receiptRowSchema>,
  requestHash: string,
  fact: TransparencyFact,
) {
  if (
    receipt.request_hash !== requestHash ||
    receipt.result_entity_type !== fact.factType ||
    receipt.result_entity_id !== fact.id ||
    receipt.response_hash !== responseRoot(fact) ||
    receipt.audit_event_root !== fact.auditEvent.eventRoot
  ) {
    throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_IDEMPOTENCY_CONFLICT");
  }
}

async function setContext(
  transaction: TransparencyTransaction,
  organizationId: string,
  actorId = "system-read",
) {
  const organization = z.string().min(1).max(256).parse(organizationId);
  const actor = z.string().min(1).max(256).parse(actorId);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organization}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actor}, true)`);
}

function parseBaseFact(input: unknown, expectedType: TransparencyFact["factType"]) {
  const parsed = baseFactSchema.parse(input);
  if (parsed.factType !== expectedType) {
    throw new Error(`CANOPYPROOF_PUBLIC_TRANSPARENCY_FACT_TYPE_INVALID:${expectedType}`);
  }
  return input;
}

function parseReview(input: unknown): CanopyProofPublicDisclosureReviewFact {
  return parseBaseFact(input, "public_disclosure_review") as CanopyProofPublicDisclosureReviewFact;
}

function parsePublication(input: unknown): CanopyProofPublicTransparencyPublicationFact {
  return parseBaseFact(input, "public_transparency_publication") as CanopyProofPublicTransparencyPublicationFact;
}

function mapEvent(input: unknown): CanopyProofAuditEvent {
  const row = eventRowSchema.parse(input);
  return {
    id: row.id,
    action: row.action,
    actor: row.actor_id,
    entityType: row.entity_type,
    entityId: row.entity_id,
    previousRoot: row.previous_root,
    payloadHash: row.payload_hash,
    eventRoot: row.event_root,
    createdAt: row.created_at_value.toISOString(),
    rationale: row.rationale,
  };
}

function actorFor(fact: TransparencyFact) {
  return fact.factType === "public_disclosure_review" ? fact.reviewer.id : fact.publisher.id;
}

function responseRoot(fact: TransparencyFact) {
  return fact.factType === "public_disclosure_review" ? fact.reviewRoot : fact.publicationRoot;
}

function eventTime(fact: TransparencyFact) {
  return fact.factType === "public_disclosure_review" ? fact.reviewedAt : fact.publishedAt;
}

function sourceQuery(fact: TransparencyFact): CanopyProofPublicTransparencySourceQuery {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    lifecycleBindingId: fact.lifecycleBindingId,
    signatureReceiptId: fact.signatureReceiptId,
    evaluatedAt: eventTime(fact),
  };
}

function streamId(fact: TransparencyFact) {
  return `public-transparency:${fact.organizationId}:${fact.projectId}`;
}

function operationFor(factType: TransparencyFact["factType"]) {
  return `public-transparency.${factType}.commit`;
}

function textArray(values: readonly string[]) {
  return values.length > 0 ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]` : Prisma.sql`ARRAY[]::text[]`;
}

function canonicalDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) {
    throw new Error("CANOPYPROOF_PUBLIC_TRANSPARENCY_MUTATION_CARDINALITY_INVALID");
  }
}
