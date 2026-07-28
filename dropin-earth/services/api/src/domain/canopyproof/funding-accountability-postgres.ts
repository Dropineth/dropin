import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  parseCanopyProofFundingAccountabilityControlFact,
  parseCanopyProofFundingAccountabilityPublicationFact,
  resolveCanopyProofFundingAccountabilityProjection,
  verifyCanopyProofFundingAccountabilityCandidate,
  verifyCanopyProofFundingAccountabilityControl,
  verifyCanopyProofFundingAccountabilityPublication,
  verifyCanopyProofFundingAccountabilityReview,
  type CanopyProofFundingAccountabilityCandidate,
  type CanopyProofFundingAccountabilityControlFact,
  type CanopyProofFundingAccountabilityCurrentProjection,
  type CanopyProofFundingAccountabilityPublicationFact,
  type CanopyProofFundingAccountabilityRecord,
  type CanopyProofFundingAccountabilityReviewFact,
} from "./funding-accountability-authority.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";
import {
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

type FundingTransaction = Prisma.TransactionClient;

export type CanopyProofFundingReviewCurrentAuthority = Readonly<{
  candidate: CanopyProofFundingAccountabilityCandidate;
  reviewer: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofFundingPublicationCurrentAuthority = Readonly<{
  candidate: CanopyProofFundingAccountabilityCandidate;
  reviewer: CanopyProofVerificationActorSnapshot;
  publisher: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofFundingControlCurrentAuthority = Readonly<{
  governor: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofFundingReviewAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    projectId: string;
    candidateRoot: string;
    sourceAuthorityRoot: string;
    preparerId: string;
    reviewerId: string;
    reviewedAt: string;
  }>,
  transaction: FundingTransaction,
) => Promise<CanopyProofFundingReviewCurrentAuthority>;

export type CanopyProofFundingPublicationAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    projectId: string;
    candidateRoot: string;
    sourceAuthorityRoot: string;
    preparerId: string;
    reviewerId: string;
    publisherId: string;
    publishedAt: string;
  }>,
  transaction: FundingTransaction,
) => Promise<CanopyProofFundingPublicationCurrentAuthority>;

export type CanopyProofFundingControlAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    projectId: string;
    publicationRoot: string;
    governorId: string;
    controlledAt: string;
  }>,
  transaction: FundingTransaction,
) => Promise<CanopyProofFundingControlCurrentAuthority>;

export type CanopyProofFundingAccountabilityRepositoryStatus = Readonly<{
  service: "canopyproof-funding-accountability-repository";
  storage: "postgresql";
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  appendOnly: true;
  forcedRowLevelSecurity: true;
  serializableWrites: true;
  exactRetryRequired: true;
  currentAuthorityReResolved: true;
  threeIndependentAccreditedHumansRequired: true;
  challengeAndWithdrawalFailClosed: true;
}>;

const REVIEW_OPERATION = "funding-accountability-review.commit";
const PUBLICATION_OPERATION = "funding-accountability-publication.commit";
const CONTROL_OPERATION = "funding-accountability-control.commit";
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identifierSchema = z.string().trim().min(1).max(240);
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const receiptRowSchema = z
  .object({
    request_hash: hashSchema,
    result_entity_type: z.enum([
      "funding_accountability_review",
      "funding_accountability_publication",
      "funding_accountability_control",
    ]),
    result_entity_id: identifierSchema,
    response_hash: hashSchema,
    audit_event_root: hashSchema,
  })
  .strict();
const factRowSchema = z
  .object({
    id: identifierSchema,
    organization_id: identifierSchema,
    project_id: identifierSchema,
    fact_record: z.unknown(),
    audit_event_root: hashSchema,
  })
  .strict();
const eventRowSchema = z
  .object({
    id: identifierSchema,
    action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
    actor_id: identifierSchema,
    entity_type: identifierSchema,
    entity_id: identifierSchema,
    previous_root: hashSchema,
    payload_hash: hashSchema,
    event_root: hashSchema,
    created_at_value: z.coerce.date(),
    rationale: z.string().min(1),
  })
  .strict();

export class PrismaCanopyProofFundingAccountabilityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofFundingAccountabilityRepositoryStatus {
    return {
      service: "canopyproof-funding-accountability-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      threeIndependentAccreditedHumansRequired: true,
      challengeAndWithdrawalFailClosed: true,
    };
  }

  async commitReview(
    reviewInput: CanopyProofFundingAccountabilityReviewFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofFundingReviewAuthorityResolver,
  ): Promise<CanopyProofFundingAccountabilityReviewFact> {
    const review = verifyCanopyProofFundingAccountabilityReview(reviewInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({
      kind: "canopyproof-funding-accountability-review-commit-v1",
      review,
    });
    const receipt = receiptIdentity(review.reviewer.id, REVIEW_OPERATION, idempotencyKey);

    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, review.candidate.organizationId, review.reviewer.id);
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `funding-review-command:${review.reviewer.id}:${receipt.idempotencyKeyHash}`,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `domain-event:${reviewStream(review)}`,
      );
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          "funding_accountability_review",
          review.id,
          review.reviewRoot,
          review.auditEvent.eventRoot,
        );
        return requireReview(transaction, review.id);
      }
      const current = await resolveCurrentAuthority(
        {
          organizationId: review.candidate.organizationId,
          projectId: review.candidate.projectId,
          candidateRoot: review.candidate.candidateRoot,
          sourceAuthorityRoot: review.candidate.sourceAuthorityRoot,
          preparerId: review.candidate.preparer.id,
          reviewerId: review.reviewer.id,
          reviewedAt: review.reviewedAt,
        },
        transaction,
      );
      if (
        hashJson(verifyCanopyProofFundingAccountabilityCandidate(current.candidate)) !==
          hashJson(review.candidate) ||
        hashJson(current.reviewer) !== hashJson(review.reviewer)
      ) {
        throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CURRENT_REVIEW_AUTHORITY_INVALID");
      }
      await assertReviewAbsent(transaction, review);
      await insertDomainEvent(transaction, reviewStream(review), review.auditEvent);
      await insertReview(transaction, review);
      await insertReceipt(transaction, {
        id: receipt.id,
        actorId: review.reviewer.id,
        operation: REVIEW_OPERATION,
        idempotencyKeyHash: receipt.idempotencyKeyHash,
        requestHash,
        resultType: "funding_accountability_review",
        resultId: review.id,
        responseHash: review.reviewRoot,
        auditEventRoot: review.auditEvent.eventRoot,
        createdAt: review.reviewedAt,
      });
      return requireReview(transaction, review.id);
    });
  }

  async commitPublication(
    publicationInput: CanopyProofFundingAccountabilityPublicationFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofFundingPublicationAuthorityResolver,
  ): Promise<CanopyProofFundingAccountabilityPublicationFact> {
    const publication = parseCanopyProofFundingAccountabilityPublicationFact(publicationInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({
      kind: "canopyproof-funding-accountability-publication-commit-v1",
      publication,
    });
    const receipt = receiptIdentity(
      publication.publisher.id,
      PUBLICATION_OPERATION,
      idempotencyKey,
    );

    return this.withSerializableRetry(async (transaction) => {
      await setContext(
        transaction,
        publication.candidate.organizationId,
        publication.publisher.id,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `funding-publication-command:${publication.publisher.id}:${receipt.idempotencyKeyHash}`,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `domain-event:${projectStream(
          publication.candidate.organizationId,
          publication.candidate.projectId,
        )}`,
      );
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          "funding_accountability_publication",
          publication.id,
          publication.publicationRoot,
          publication.auditEvent.eventRoot,
        );
        return (await requirePublicationBundle(transaction, publication.id)).publication;
      }
      const review = await requireReview(transaction, publication.reviewId);
      const current = await resolveCurrentAuthority(
        {
          organizationId: publication.candidate.organizationId,
          projectId: publication.candidate.projectId,
          candidateRoot: publication.candidate.candidateRoot,
          sourceAuthorityRoot: publication.candidate.sourceAuthorityRoot,
          preparerId: publication.candidate.preparer.id,
          reviewerId: review.reviewer.id,
          publisherId: publication.publisher.id,
          publishedAt: publication.publishedAt,
        },
        transaction,
      );
      if (
        hashJson(verifyCanopyProofFundingAccountabilityCandidate(current.candidate)) !==
          hashJson(publication.candidate) ||
        hashJson(current.reviewer) !== hashJson(review.reviewer) ||
        hashJson(current.publisher) !== hashJson(publication.publisher)
      ) {
        throw new Error(
          "CANOPYPROOF_FUNDING_ACCOUNTABILITY_CURRENT_PUBLICATION_AUTHORITY_INVALID",
        );
      }
      const history = await loadProjectHistory(
        transaction,
        publication.candidate.organizationId,
        publication.candidate.projectId,
      );
      verifyCanopyProofFundingAccountabilityPublication(publication, review, history);
      await assertPublicationAbsent(transaction, publication);
      await insertDomainEvent(
        transaction,
        projectStream(
          publication.candidate.organizationId,
          publication.candidate.projectId,
        ),
        publication.auditEvent,
      );
      await insertPublication(transaction, publication);
      await insertReceipt(transaction, {
        id: receipt.id,
        actorId: publication.publisher.id,
        operation: PUBLICATION_OPERATION,
        idempotencyKeyHash: receipt.idempotencyKeyHash,
        requestHash,
        resultType: "funding_accountability_publication",
        resultId: publication.id,
        responseHash: publication.publicationRoot,
        auditEventRoot: publication.auditEvent.eventRoot,
        createdAt: publication.publishedAt,
      });
      return (await requirePublicationBundle(transaction, publication.id)).publication;
    });
  }

  async commitControl(
    controlInput: CanopyProofFundingAccountabilityControlFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofFundingControlAuthorityResolver,
  ): Promise<CanopyProofFundingAccountabilityControlFact> {
    const control = parseCanopyProofFundingAccountabilityControlFact(controlInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({
      kind: "canopyproof-funding-accountability-control-commit-v1",
      control,
    });
    const receipt = receiptIdentity(control.governor.id, CONTROL_OPERATION, idempotencyKey);

    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, control.organizationId, control.governor.id);
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `funding-control-command:${control.governor.id}:${receipt.idempotencyKeyHash}`,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `domain-event:${projectStream(control.organizationId, control.projectId)}`,
      );
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          "funding_accountability_control",
          control.id,
          control.controlRoot,
          control.auditEvent.eventRoot,
        );
        return requireControl(transaction, control.id);
      }
      const bundle = await requirePublicationBundle(transaction, control.publicationId);
      const current = await resolveCurrentAuthority(
        {
          organizationId: control.organizationId,
          projectId: control.projectId,
          publicationRoot: control.publicationRoot,
          governorId: control.governor.id,
          controlledAt: control.controlledAt,
        },
        transaction,
      );
      if (hashJson(current.governor) !== hashJson(control.governor)) {
        throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CURRENT_CONTROL_AUTHORITY_INVALID");
      }
      const history = await loadProjectHistory(
        transaction,
        control.organizationId,
        control.projectId,
      );
      verifyCanopyProofFundingAccountabilityControl(control, bundle.publication, history);
      await assertControlAbsent(transaction, control);
      await insertDomainEvent(
        transaction,
        projectStream(control.organizationId, control.projectId),
        control.auditEvent,
      );
      await insertControl(transaction, control);
      await insertReceipt(transaction, {
        id: receipt.id,
        actorId: control.governor.id,
        operation: CONTROL_OPERATION,
        idempotencyKeyHash: receipt.idempotencyKeyHash,
        requestHash,
        resultType: "funding_accountability_control",
        resultId: control.id,
        responseHash: control.controlRoot,
        auditEventRoot: control.auditEvent.eventRoot,
        createdAt: control.controlledAt,
      });
      return requireControl(transaction, control.id);
    });
  }

  async resolveCurrentProjection(input: Readonly<{
    organizationId: string;
    actorId: string;
    projectId: string;
    evaluatedAt: string;
  }>): Promise<CanopyProofFundingAccountabilityCurrentProjection | undefined> {
    const organizationId = identifierSchema.parse(input.organizationId);
    const actorId = identifierSchema.parse(input.actorId);
    const projectId = identifierSchema.parse(input.projectId);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId, actorId);
        return this.resolveCurrentProjectionInTransaction(transaction, {
          organizationId,
          projectId,
          evaluatedAt: input.evaluatedAt,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  /** Reuses a caller-owned transaction after that caller has set tenant context. */
  async resolveCurrentProjectionInTransaction(
    transaction: Prisma.TransactionClient,
    input: Readonly<{
      organizationId: string;
      projectId: string;
      evaluatedAt: string;
    }>,
  ): Promise<CanopyProofFundingAccountabilityCurrentProjection | undefined> {
    const organizationId = identifierSchema.parse(input.organizationId);
    const projectId = identifierSchema.parse(input.projectId);
    const records = await loadProjectRecords(transaction, organizationId, projectId);
    return resolveCanopyProofFundingAccountabilityProjection({
      organizationId,
      projectId,
      evaluatedAt: input.evaluatedAt,
      records,
    });
  }

  private async withSerializableRetry<T>(
    operation: (transaction: FundingTransaction) => Promise<T>,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_DURABLE_WRITE_UNAVAILABLE");
  }
}

async function loadProjectRecords(
  transaction: FundingTransaction,
  organizationId: string,
  projectId: string,
): Promise<readonly CanopyProofFundingAccountabilityRecord[]> {
  const publications = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, project_id, fact_record, audit_event_root
    FROM funding.accountability_publication_facts
    WHERE organization_id = ${organizationId} AND project_id = ${projectId}
  `);
  const controls = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, project_id, fact_record, audit_event_root
    FROM funding.accountability_control_facts
    WHERE organization_id = ${organizationId} AND project_id = ${projectId}
  `);
  if (publications.length + controls.length > 2_048) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_HISTORY_LIMIT_EXCEEDED");
  }
  const records: CanopyProofFundingAccountabilityRecord[] = [];
  for (const rowInput of publications) {
    const row = factRowSchema.parse(rowInput);
    const bundle = await requirePublicationBundle(transaction, row.id);
    assertFactScopeAndEvent(
      row,
      bundle.publication.candidate.organizationId,
      bundle.publication.candidate.projectId,
      bundle.publication.auditEvent.eventRoot,
    );
    records.push({ kind: "publication", ...bundle });
  }
  for (const rowInput of controls) {
    const row = factRowSchema.parse(rowInput);
    const control = parseCanopyProofFundingAccountabilityControlFact(row.fact_record);
    assertFactScopeAndEvent(
      row,
      control.organizationId,
      control.projectId,
      control.auditEvent.eventRoot,
    );
    records.push({ kind: "control", control });
  }
  return records;
}

async function requireReview(transaction: FundingTransaction, reviewId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, project_id, fact_record, audit_event_root
    FROM funding.accountability_review_facts WHERE id = ${reviewId}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_REVIEW_NOT_FOUND");
  }
  const row = factRowSchema.parse(rows[0]);
  const review = verifyCanopyProofFundingAccountabilityReview(row.fact_record);
  assertFactScopeAndEvent(
    row,
    review.candidate.organizationId,
    review.candidate.projectId,
    review.auditEvent.eventRoot,
  );
  const events = await loadEvents(transaction, reviewStream(review));
  if (events.length !== 1 || hashJson(events[0]) !== hashJson(review.auditEvent)) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_REVIEW_AUDIT_INVALID");
  }
  return review;
}

async function requirePublicationBundle(
  transaction: FundingTransaction,
  publicationId: string,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, project_id, fact_record, audit_event_root
    FROM funding.accountability_publication_facts WHERE id = ${publicationId}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLICATION_NOT_FOUND");
  }
  const row = factRowSchema.parse(rows[0]);
  const parsed = parseCanopyProofFundingAccountabilityPublicationFact(row.fact_record);
  const review = await requireReview(transaction, parsed.reviewId);
  const history = await loadProjectHistory(
    transaction,
    parsed.candidate.organizationId,
    parsed.candidate.projectId,
  );
  const eventIndex = history.findIndex(
    (event) => event.eventRoot === parsed.auditEvent.eventRoot,
  );
  if (eventIndex < 0) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLICATION_AUDIT_NOT_FOUND");
  }
  const publication = verifyCanopyProofFundingAccountabilityPublication(
    parsed,
    review,
    history.slice(0, eventIndex),
  );
  assertFactScopeAndEvent(
    row,
    publication.candidate.organizationId,
    publication.candidate.projectId,
    publication.auditEvent.eventRoot,
  );
  const storedEvent = await requireEvent(transaction, publication.auditEvent.eventRoot);
  if (hashJson(storedEvent) !== hashJson(publication.auditEvent)) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLICATION_AUDIT_INVALID");
  }
  return { publication, review };
}

async function requireControl(transaction: FundingTransaction, controlId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, project_id, fact_record, audit_event_root
    FROM funding.accountability_control_facts WHERE id = ${controlId}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_NOT_FOUND");
  }
  const row = factRowSchema.parse(rows[0]);
  const parsed = parseCanopyProofFundingAccountabilityControlFact(row.fact_record);
  const bundle = await requirePublicationBundle(transaction, parsed.publicationId);
  const history = await loadProjectHistory(
    transaction,
    parsed.organizationId,
    parsed.projectId,
  );
  const eventIndex = history.findIndex(
    (event) => event.eventRoot === parsed.auditEvent.eventRoot,
  );
  if (eventIndex < 0) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_AUDIT_NOT_FOUND");
  }
  const control = verifyCanopyProofFundingAccountabilityControl(
    parsed,
    bundle.publication,
    history.slice(0, eventIndex),
  );
  assertFactScopeAndEvent(
    row,
    control.organizationId,
    control.projectId,
    control.auditEvent.eventRoot,
  );
  const storedEvent = await requireEvent(transaction, control.auditEvent.eventRoot);
  if (hashJson(storedEvent) !== hashJson(control.auditEvent)) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_AUDIT_INVALID");
  }
  return control;
}

async function loadProjectHistory(
  transaction: FundingTransaction,
  organizationId: string,
  projectId: string,
) {
  return loadEvents(transaction, projectStream(organizationId, projectId));
}

async function loadEvents(transaction: FundingTransaction, streamId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, action, actor_id, entity_type, entity_id, previous_root,
      payload_hash, event_root, created_at AS created_at_value, rationale
    FROM audit.domain_events
    WHERE stream_id = ${streamId}
    ORDER BY sequence_no, id
  `);
  const events = rows.map(mapEvent);
  if (
    events.length > 0 &&
    !verifyCanopyProofAuditChain(events, events.at(-1)!.createdAt).valid
  ) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_AUDIT_HISTORY_INVALID");
  }
  return events;
}

async function requireEvent(transaction: FundingTransaction, eventRoot: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, action, actor_id, entity_type, entity_id, previous_root,
      payload_hash, event_root, created_at AS created_at_value, rationale
    FROM audit.domain_events WHERE event_root = ${eventRoot}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_AUDIT_NOT_FOUND");
  }
  return mapEvent(rows[0]);
}

async function assertReviewAbsent(
  transaction: FundingTransaction,
  review: CanopyProofFundingAccountabilityReviewFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM funding.accountability_review_facts
    WHERE id = ${review.id}
      OR review_root = ${review.reviewRoot}
      OR candidate_root = ${review.candidate.candidateRoot}
    LIMIT 1
  `);
  if (rows.length > 0) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_REVIEW_CONFLICT");
  }
}

async function assertPublicationAbsent(
  transaction: FundingTransaction,
  publication: CanopyProofFundingAccountabilityPublicationFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM funding.accountability_publication_facts
    WHERE id = ${publication.id}
      OR publication_root = ${publication.publicationRoot}
      OR projection_root = ${publication.publicProjection.projectionRoot}
    LIMIT 1
  `);
  if (rows.length > 0) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_PUBLICATION_CONFLICT");
  }
}

async function assertControlAbsent(
  transaction: FundingTransaction,
  control: CanopyProofFundingAccountabilityControlFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM funding.accountability_control_facts
    WHERE id = ${control.id}
      OR control_root = ${control.controlRoot}
      OR publication_id = ${control.publicationId}
    LIMIT 1
  `);
  if (rows.length > 0) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_CONTROL_CONFLICT");
  }
}

async function insertReview(
  transaction: FundingTransaction,
  review: CanopyProofFundingAccountabilityReviewFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO funding.accountability_review_facts (
        id, organization_id, project_id, candidate_root, source_authority_root,
        decision, reviewer_id, reviewer_snapshot, reviewed_at, review_root,
        audit_event_root, fact_record
      ) VALUES (
        ${review.id}, ${review.candidate.organizationId}, ${review.candidate.projectId},
        ${review.candidate.candidateRoot}, ${review.candidate.sourceAuthorityRoot},
        ${review.decision}, ${review.reviewer.id}, ${JSON.stringify(review.reviewer)}::jsonb,
        ${asDate(review.reviewedAt)}, ${review.reviewRoot}, ${review.auditEvent.eventRoot},
        ${JSON.stringify(review)}::jsonb
      )
    `),
  );
}

async function insertPublication(
  transaction: FundingTransaction,
  publication: CanopyProofFundingAccountabilityPublicationFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO funding.accountability_publication_facts (
        id, organization_id, project_id, candidate_root, source_authority_root,
        review_id, publisher_id, publisher_snapshot, published_at, projection_root,
        publication_root, audit_event_root, fact_record
      ) VALUES (
        ${publication.id}, ${publication.candidate.organizationId},
        ${publication.candidate.projectId}, ${publication.candidate.candidateRoot},
        ${publication.candidate.sourceAuthorityRoot}, ${publication.reviewId},
        ${publication.publisher.id}, ${JSON.stringify(publication.publisher)}::jsonb,
        ${asDate(publication.publishedAt)}, ${publication.publicProjection.projectionRoot},
        ${publication.publicationRoot}, ${publication.auditEvent.eventRoot},
        ${JSON.stringify(publication)}::jsonb
      )
    `),
  );
}

async function insertControl(
  transaction: FundingTransaction,
  control: CanopyProofFundingAccountabilityControlFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO funding.accountability_control_facts (
        id, organization_id, project_id, publication_id, publication_root,
        projection_root, action, reason_code, governor_id, governor_snapshot,
        controlled_at, control_root, audit_event_root, fact_record
      ) VALUES (
        ${control.id}, ${control.organizationId}, ${control.projectId},
        ${control.publicationId}, ${control.publicationRoot}, ${control.projectionRoot},
        ${control.action}, ${control.reasonCode}, ${control.governor.id},
        ${JSON.stringify(control.governor)}::jsonb, ${asDate(control.controlledAt)},
        ${control.controlRoot}, ${control.auditEvent.eventRoot}, ${JSON.stringify(control)}::jsonb
      )
    `),
  );
}

async function insertDomainEvent(
  transaction: FundingTransaction,
  streamId: string,
  event: CanopyProofAuditEvent,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES (
        ${event.id}, ${streamId}, ${event.action}, ${event.actor}, ${event.entityType},
        ${event.entityId}, ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot},
        ${asDate(event.createdAt)}, ${event.rationale}
      )
    `),
  );
}

async function readReceipt(transaction: FundingTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId}
  `);
  if (rows.length > 1) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_RECEIPT_DUPLICATE");
  }
  return rows.length === 0 ? undefined : receiptRowSchema.parse(rows[0]);
}

function assertReceipt(
  receipt: z.output<typeof receiptRowSchema>,
  requestHash: string,
  resultType: z.output<typeof receiptRowSchema>["result_entity_type"],
  resultId: string,
  responseHash: string,
  auditEventRoot: string,
) {
  if (
    receipt.request_hash !== requestHash ||
    receipt.result_entity_type !== resultType ||
    receipt.result_entity_id !== resultId ||
    receipt.response_hash !== responseHash ||
    receipt.audit_event_root !== auditEventRoot
  ) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_IDEMPOTENCY_CONFLICT");
  }
}

async function insertReceipt(
  transaction: FundingTransaction,
  input: Readonly<{
    id: string;
    actorId: string;
    operation: string;
    idempotencyKeyHash: string;
    requestHash: string;
    resultType: z.output<typeof receiptRowSchema>["result_entity_type"];
    resultId: string;
    responseHash: string;
    auditEventRoot: string;
    createdAt: string;
  }>,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.command_receipts (
        id, actor_id, operation, idempotency_key_hash, request_hash,
        result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
      ) VALUES (
        ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash},
        ${input.requestHash}, ${input.resultType}, ${input.resultId}, ${input.responseHash},
        ${input.auditEventRoot}, ${asDate(input.createdAt)}
      )
    `),
  );
}

function receiptIdentity(actorId: string, operation: string, idempotencyKey: string) {
  const idempotencyKeyHash = hashJson({
    kind: "canopyproof-idempotency-key-v1",
    value: idempotencyKey,
  });
  return {
    idempotencyKeyHash,
    id: `cp_funding_command_${hashJson({
      actorId,
      operation,
      idempotencyKeyHash,
    }).slice(0, 24)}`,
  };
}

function reviewStream(review: CanopyProofFundingAccountabilityReviewFact) {
  return `funding-accountability:review:${review.candidate.candidateRoot}`;
}

function projectStream(organizationId: string, projectId: string) {
  return `funding-accountability:${organizationId}:${projectId}`;
}

function assertFactScopeAndEvent(
  row: z.output<typeof factRowSchema>,
  organizationId: string,
  projectId: string,
  auditEventRoot: string,
) {
  if (
    row.organization_id !== organizationId ||
    row.project_id !== projectId ||
    row.audit_event_root !== auditEventRoot
  ) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_FACT_COLUMNS_INVALID");
  }
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

async function setContext(
  transaction: FundingTransaction,
  organizationIdInput: string,
  actorIdInput: string,
) {
  const organizationId = identifierSchema.parse(organizationIdInput);
  const actorId = identifierSchema.parse(actorIdInput);
  await transaction.$queryRaw(
    Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`,
  );
  await transaction.$queryRaw(
    Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`,
  );
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) {
    throw new Error("CANOPYPROOF_FUNDING_ACCOUNTABILITY_MUTATION_CARDINALITY_INVALID");
  }
}
