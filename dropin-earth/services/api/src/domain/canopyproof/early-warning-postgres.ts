import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  parseCanopyProofEarlyWarningControlFact,
  parseCanopyProofEarlyWarningPublicationFact,
  resolveCanopyProofEarlyWarningProjection,
  verifyCanopyProofEarlyWarningCandidate,
  verifyCanopyProofEarlyWarningControl,
  verifyCanopyProofEarlyWarningPublication,
  verifyCanopyProofEarlyWarningReview,
  type CanopyProofEarlyWarningCandidate,
  type CanopyProofEarlyWarningControlFact,
  type CanopyProofEarlyWarningCurrentProjection,
  type CanopyProofEarlyWarningPublicationFact,
  type CanopyProofEarlyWarningRecord,
  type CanopyProofEarlyWarningReviewFact,
} from "./early-warning-authority.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";
import {
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

type EarlyWarningTransaction = Prisma.TransactionClient;

export type CanopyProofEarlyWarningReviewCurrentAuthority = Readonly<{
  candidate: CanopyProofEarlyWarningCandidate;
  reviewer: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofEarlyWarningPublicationCurrentAuthority = Readonly<{
  candidate: CanopyProofEarlyWarningCandidate;
  scientificReviewer: CanopyProofVerificationActorSnapshot;
  operationalReviewer: CanopyProofVerificationActorSnapshot;
  publisher: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofEarlyWarningControlCurrentAuthority = Readonly<{
  governor: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofEarlyWarningReviewAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    scopeId: string;
    riskClass: string;
    candidateRoot: string;
    sourceAuthorityRoot: string;
    preparerId: string;
    reviewerId: string;
    reviewKind: "scientific" | "operational";
    reviewedAt: string;
  }>,
  transaction: EarlyWarningTransaction,
) => Promise<CanopyProofEarlyWarningReviewCurrentAuthority>;

export type CanopyProofEarlyWarningPublicationAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    scopeId: string;
    riskClass: string;
    candidateRoot: string;
    sourceAuthorityRoot: string;
    preparerId: string;
    scientificReviewerId: string;
    operationalReviewerId: string;
    publisherId: string;
    publishedAt: string;
  }>,
  transaction: EarlyWarningTransaction,
) => Promise<CanopyProofEarlyWarningPublicationCurrentAuthority>;

export type CanopyProofEarlyWarningControlAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    scopeId: string;
    riskClass: string;
    publicationRoot: string;
    governorId: string;
    controlledAt: string;
  }>,
  transaction: EarlyWarningTransaction,
) => Promise<CanopyProofEarlyWarningControlCurrentAuthority>;

export type CanopyProofEarlyWarningRepositoryStatus = Readonly<{
  service: "canopyproof-early-warning-authority-repository";
  storage: "postgresql";
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  liveFeedEnabled: false;
  notificationDeliveryEnabled: false;
  emergencyDeclarationEnabled: false;
  appendOnly: true;
  forcedRowLevelSecurity: true;
  serializableWrites: true;
  exactRetryRequired: true;
  currentAuthorityReResolved: true;
  threeIndependentAccreditedHumansRequired: true;
  adverseStateNeverFallsBack: true;
}>;

const REVIEW_OPERATION = "early-warning-review.commit";
const PUBLICATION_OPERATION = "early-warning-publication.commit";
const CONTROL_OPERATION = "early-warning-control.commit";
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identifierSchema = z.string().trim().min(1).max(240);
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const riskClassSchema = z.enum([
  "drought",
  "wildfire",
  "flooding",
  "ecosystem_degradation",
]);
const receiptRowSchema = z
  .object({
    request_hash: hashSchema,
    result_entity_type: z.enum([
      "early_warning_review",
      "early_warning_publication",
      "early_warning_control",
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
    scope_id: identifierSchema,
    risk_class: riskClassSchema,
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

export class PrismaCanopyProofEarlyWarningRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofEarlyWarningRepositoryStatus {
    return {
      service: "canopyproof-early-warning-authority-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      liveFeedEnabled: false,
      notificationDeliveryEnabled: false,
      emergencyDeclarationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      threeIndependentAccreditedHumansRequired: true,
      adverseStateNeverFallsBack: true,
    };
  }

  async commitReview(
    reviewInput: CanopyProofEarlyWarningReviewFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofEarlyWarningReviewAuthorityResolver,
  ): Promise<CanopyProofEarlyWarningReviewFact> {
    const review = verifyCanopyProofEarlyWarningReview(reviewInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({
      kind: "canopyproof-early-warning-review-commit-v1",
      review,
    });
    const receipt = receiptIdentity(
      review.reviewer.id,
      REVIEW_OPERATION,
      idempotencyKey,
    );

    return this.withSerializableRetry(async (transaction) => {
      await setContext(
        transaction,
        review.candidate.organizationId,
        review.reviewer.id,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `early-warning-review-command:${review.reviewer.id}:${receipt.idempotencyKeyHash}`,
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
          "early_warning_review",
          review.id,
          review.reviewRoot,
          review.auditEvent.eventRoot,
        );
        return requireReview(transaction, review.id);
      }
      const current = await resolveCurrentAuthority(
        {
          organizationId: review.candidate.organizationId,
          scopeId: review.candidate.scopeId,
          riskClass: review.candidate.riskClass,
          candidateRoot: review.candidate.candidateRoot,
          sourceAuthorityRoot: review.candidate.sourceAuthorityRoot,
          preparerId: review.candidate.preparer.id,
          reviewerId: review.reviewer.id,
          reviewKind: review.reviewKind,
          reviewedAt: review.reviewedAt,
        },
        transaction,
      );
      if (
        hashJson(verifyCanopyProofEarlyWarningCandidate(current.candidate)) !==
          hashJson(review.candidate) ||
        hashJson(current.reviewer) !== hashJson(review.reviewer)
      ) {
        throw new Error("CANOPYPROOF_EARLY_WARNING_CURRENT_REVIEW_AUTHORITY_INVALID");
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
        resultType: "early_warning_review",
        resultId: review.id,
        responseHash: review.reviewRoot,
        auditEventRoot: review.auditEvent.eventRoot,
        createdAt: review.reviewedAt,
      });
      return requireReview(transaction, review.id);
    });
  }

  async commitPublication(
    publicationInput: CanopyProofEarlyWarningPublicationFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofEarlyWarningPublicationAuthorityResolver,
  ): Promise<CanopyProofEarlyWarningPublicationFact> {
    const publication = parseCanopyProofEarlyWarningPublicationFact(publicationInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({
      kind: "canopyproof-early-warning-publication-commit-v1",
      publication,
    });
    const receipt = receiptIdentity(
      publication.publisher.id,
      PUBLICATION_OPERATION,
      idempotencyKey,
    );
    const streamId = publicationStream(
      publication.candidate.organizationId,
      publication.candidate.scopeId,
      publication.candidate.riskClass,
    );

    return this.withSerializableRetry(async (transaction) => {
      await setContext(
        transaction,
        publication.candidate.organizationId,
        publication.publisher.id,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `early-warning-publication-command:${publication.publisher.id}:${receipt.idempotencyKeyHash}`,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `domain-event:${streamId}`,
      );
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          "early_warning_publication",
          publication.id,
          publication.publicationRoot,
          publication.auditEvent.eventRoot,
        );
        return (await requirePublicationBundle(transaction, publication.id)).publication;
      }
      const scientificReview = await requireReview(
        transaction,
        publication.scientificReviewId,
      );
      const operationalReview = await requireReview(
        transaction,
        publication.operationalReviewId,
      );
      const current = await resolveCurrentAuthority(
        {
          organizationId: publication.candidate.organizationId,
          scopeId: publication.candidate.scopeId,
          riskClass: publication.candidate.riskClass,
          candidateRoot: publication.candidate.candidateRoot,
          sourceAuthorityRoot: publication.candidate.sourceAuthorityRoot,
          preparerId: publication.candidate.preparer.id,
          scientificReviewerId: scientificReview.reviewer.id,
          operationalReviewerId: operationalReview.reviewer.id,
          publisherId: publication.publisher.id,
          publishedAt: publication.publishedAt,
        },
        transaction,
      );
      if (
        hashJson(verifyCanopyProofEarlyWarningCandidate(current.candidate)) !==
          hashJson(publication.candidate) ||
        hashJson(current.scientificReviewer) !== hashJson(scientificReview.reviewer) ||
        hashJson(current.operationalReviewer) !== hashJson(operationalReview.reviewer) ||
        hashJson(current.publisher) !== hashJson(publication.publisher)
      ) {
        throw new Error(
          "CANOPYPROOF_EARLY_WARNING_CURRENT_PUBLICATION_AUTHORITY_INVALID",
        );
      }
      const latestPublicationRoot = await readLatestPublicationRoot(
        transaction,
        publication.candidate.organizationId,
        publication.candidate.scopeId,
        publication.candidate.riskClass,
      );
      if (latestPublicationRoot !== publication.predecessorPublicationRoot) {
        throw new Error("CANOPYPROOF_EARLY_WARNING_PREDECESSOR_NOT_CURRENT");
      }
      const history = await loadPublicationHistory(
        transaction,
        publication.candidate.organizationId,
        publication.candidate.scopeId,
        publication.candidate.riskClass,
      );
      verifyCanopyProofEarlyWarningPublication(
        publication,
        scientificReview,
        operationalReview,
        history,
      );
      await assertPublicationAbsent(transaction, publication);
      await insertDomainEvent(transaction, streamId, publication.auditEvent);
      await insertPublication(transaction, publication);
      await insertReceipt(transaction, {
        id: receipt.id,
        actorId: publication.publisher.id,
        operation: PUBLICATION_OPERATION,
        idempotencyKeyHash: receipt.idempotencyKeyHash,
        requestHash,
        resultType: "early_warning_publication",
        resultId: publication.id,
        responseHash: publication.publicationRoot,
        auditEventRoot: publication.auditEvent.eventRoot,
        createdAt: publication.publishedAt,
      });
      return (await requirePublicationBundle(transaction, publication.id)).publication;
    });
  }

  async commitControl(
    controlInput: CanopyProofEarlyWarningControlFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofEarlyWarningControlAuthorityResolver,
  ): Promise<CanopyProofEarlyWarningControlFact> {
    const control = parseCanopyProofEarlyWarningControlFact(controlInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({
      kind: "canopyproof-early-warning-control-commit-v1",
      control,
    });
    const receipt = receiptIdentity(
      control.governor.id,
      CONTROL_OPERATION,
      idempotencyKey,
    );
    const streamId = publicationStream(
      control.organizationId,
      control.scopeId,
      control.riskClass,
    );

    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, control.organizationId, control.governor.id);
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `early-warning-control-command:${control.governor.id}:${receipt.idempotencyKeyHash}`,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `domain-event:${streamId}`,
      );
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          "early_warning_control",
          control.id,
          control.controlRoot,
          control.auditEvent.eventRoot,
        );
        return requireControl(transaction, control.id);
      }
      const bundle = await requirePublicationBundle(
        transaction,
        control.publicationId,
      );
      const current = await resolveCurrentAuthority(
        {
          organizationId: control.organizationId,
          scopeId: control.scopeId,
          riskClass: control.riskClass,
          publicationRoot: control.publicationRoot,
          governorId: control.governor.id,
          controlledAt: control.controlledAt,
        },
        transaction,
      );
      if (hashJson(current.governor) !== hashJson(control.governor)) {
        throw new Error("CANOPYPROOF_EARLY_WARNING_CURRENT_CONTROL_AUTHORITY_INVALID");
      }
      const history = await loadPublicationHistory(
        transaction,
        control.organizationId,
        control.scopeId,
        control.riskClass,
      );
      verifyCanopyProofEarlyWarningControl(
        control,
        bundle.publication,
        history,
      );
      await assertControlAbsent(transaction, control);
      await insertDomainEvent(transaction, streamId, control.auditEvent);
      await insertControl(transaction, control);
      await insertReceipt(transaction, {
        id: receipt.id,
        actorId: control.governor.id,
        operation: CONTROL_OPERATION,
        idempotencyKeyHash: receipt.idempotencyKeyHash,
        requestHash,
        resultType: "early_warning_control",
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
    scopeId: string;
    riskClass: string;
    evaluatedAt: string;
  }>): Promise<CanopyProofEarlyWarningCurrentProjection | undefined> {
    const organizationId = identifierSchema.parse(input.organizationId);
    const actorId = identifierSchema.parse(input.actorId);
    const scopeId = identifierSchema.parse(input.scopeId);
    const riskClass = riskClassSchema.parse(input.riskClass);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId, actorId);
        const records = await loadStreamRecords(
          transaction,
          organizationId,
          scopeId,
          riskClass,
        );
        return (
          resolveCanopyProofEarlyWarningProjection(records, input.evaluatedAt) ??
          undefined
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async withSerializableRetry<T>(
    operation: (transaction: EarlyWarningTransaction) => Promise<T>,
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) {
          continue;
        }
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_EARLY_WARNING_DURABLE_WRITE_UNAVAILABLE");
  }
}

async function loadStreamRecords(
  transaction: EarlyWarningTransaction,
  organizationId: string,
  scopeId: string,
  riskClass: z.output<typeof riskClassSchema>,
): Promise<readonly CanopyProofEarlyWarningRecord[]> {
  const publications = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, scope_id, risk_class, fact_record, audit_event_root
    FROM impact.early_warning_publication_facts
    WHERE organization_id = ${organizationId}
      AND scope_id = ${scopeId} AND risk_class = ${riskClass}
  `);
  const controls = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, scope_id, risk_class, fact_record, audit_event_root
    FROM impact.early_warning_control_facts
    WHERE organization_id = ${organizationId}
      AND scope_id = ${scopeId} AND risk_class = ${riskClass}
  `);
  if (publications.length + controls.length > 2_048) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_HISTORY_LIMIT_EXCEEDED");
  }
  const records: CanopyProofEarlyWarningRecord[] = [];
  for (const rowInput of publications) {
    const row = factRowSchema.parse(rowInput);
    const bundle = await requirePublicationBundle(transaction, row.id);
    assertFactScopeAndEvent(
      row,
      bundle.publication.candidate.organizationId,
      bundle.publication.candidate.scopeId,
      bundle.publication.candidate.riskClass,
      bundle.publication.auditEvent.eventRoot,
    );
    records.push({ kind: "publication", ...bundle });
  }
  for (const rowInput of controls) {
    const row = factRowSchema.parse(rowInput);
    const control = parseCanopyProofEarlyWarningControlFact(row.fact_record);
    assertFactScopeAndEvent(
      row,
      control.organizationId,
      control.scopeId,
      control.riskClass,
      control.auditEvent.eventRoot,
    );
    records.push({ kind: "control", control });
  }
  return records;
}

async function requireReview(
  transaction: EarlyWarningTransaction,
  reviewId: string,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, scope_id, risk_class, fact_record, audit_event_root
    FROM impact.early_warning_review_facts WHERE id = ${reviewId}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_REVIEW_NOT_FOUND");
  }
  const row = factRowSchema.parse(rows[0]);
  const review = verifyCanopyProofEarlyWarningReview(row.fact_record);
  assertFactScopeAndEvent(
    row,
    review.candidate.organizationId,
    review.candidate.scopeId,
    review.candidate.riskClass,
    review.auditEvent.eventRoot,
  );
  const events = await loadEvents(transaction, reviewStream(review));
  if (events.length !== 1 || hashJson(events[0]) !== hashJson(review.auditEvent)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_REVIEW_AUDIT_INVALID");
  }
  return review;
}

async function requirePublicationBundle(
  transaction: EarlyWarningTransaction,
  publicationId: string,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, scope_id, risk_class, fact_record, audit_event_root
    FROM impact.early_warning_publication_facts WHERE id = ${publicationId}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_PUBLICATION_NOT_FOUND");
  }
  const row = factRowSchema.parse(rows[0]);
  const parsed = parseCanopyProofEarlyWarningPublicationFact(row.fact_record);
  const scientificReview = await requireReview(
    transaction,
    parsed.scientificReviewId,
  );
  const operationalReview = await requireReview(
    transaction,
    parsed.operationalReviewId,
  );
  const history = await loadPublicationHistory(
    transaction,
    parsed.candidate.organizationId,
    parsed.candidate.scopeId,
    parsed.candidate.riskClass,
  );
  const eventIndex = history.findIndex(
    (event) => event.eventRoot === parsed.auditEvent.eventRoot,
  );
  if (eventIndex < 0) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_PUBLICATION_AUDIT_NOT_FOUND");
  }
  const publication = verifyCanopyProofEarlyWarningPublication(
    parsed,
    scientificReview,
    operationalReview,
    history.slice(0, eventIndex),
  );
  assertFactScopeAndEvent(
    row,
    publication.candidate.organizationId,
    publication.candidate.scopeId,
    publication.candidate.riskClass,
    publication.auditEvent.eventRoot,
  );
  const storedEvent = await requireEvent(
    transaction,
    publication.auditEvent.eventRoot,
  );
  if (hashJson(storedEvent) !== hashJson(publication.auditEvent)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_PUBLICATION_AUDIT_INVALID");
  }
  return { publication, scientificReview, operationalReview };
}

async function requireControl(
  transaction: EarlyWarningTransaction,
  controlId: string,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, scope_id, risk_class, fact_record, audit_event_root
    FROM impact.early_warning_control_facts WHERE id = ${controlId}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_NOT_FOUND");
  }
  const row = factRowSchema.parse(rows[0]);
  const parsed = parseCanopyProofEarlyWarningControlFact(row.fact_record);
  const bundle = await requirePublicationBundle(
    transaction,
    parsed.publicationId,
  );
  const history = await loadPublicationHistory(
    transaction,
    parsed.organizationId,
    parsed.scopeId,
    parsed.riskClass,
  );
  const eventIndex = history.findIndex(
    (event) => event.eventRoot === parsed.auditEvent.eventRoot,
  );
  if (eventIndex < 0) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_AUDIT_NOT_FOUND");
  }
  const control = verifyCanopyProofEarlyWarningControl(
    parsed,
    bundle.publication,
    history.slice(0, eventIndex),
  );
  assertFactScopeAndEvent(
    row,
    control.organizationId,
    control.scopeId,
    control.riskClass,
    control.auditEvent.eventRoot,
  );
  const storedEvent = await requireEvent(transaction, control.auditEvent.eventRoot);
  if (hashJson(storedEvent) !== hashJson(control.auditEvent)) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_AUDIT_INVALID");
  }
  return control;
}

async function loadPublicationHistory(
  transaction: EarlyWarningTransaction,
  organizationId: string,
  scopeId: string,
  riskClass: string,
) {
  return loadEvents(
    transaction,
    publicationStream(organizationId, scopeId, riskClass),
  );
}

async function loadEvents(transaction: EarlyWarningTransaction, streamId: string) {
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
    throw new Error("CANOPYPROOF_EARLY_WARNING_AUDIT_HISTORY_INVALID");
  }
  return events;
}

async function requireEvent(
  transaction: EarlyWarningTransaction,
  eventRoot: string,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, action, actor_id, entity_type, entity_id, previous_root,
      payload_hash, event_root, created_at AS created_at_value, rationale
    FROM audit.domain_events WHERE event_root = ${eventRoot}
  `);
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_AUDIT_NOT_FOUND");
  }
  return mapEvent(rows[0]);
}

async function readLatestPublicationRoot(
  transaction: EarlyWarningTransaction,
  organizationId: string,
  scopeId: string,
  riskClass: string,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT publication_root
    FROM impact.early_warning_publication_facts
    WHERE organization_id = ${organizationId}
      AND scope_id = ${scopeId} AND risk_class = ${riskClass}
    ORDER BY event_sequence DESC LIMIT 1
  `);
  if (rows.length === 0) return null;
  if (rows.length !== 1) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_PUBLICATION_HEAD_INVALID");
  }
  return z.object({ publication_root: hashSchema }).parse(rows[0]).publication_root;
}

async function assertReviewAbsent(
  transaction: EarlyWarningTransaction,
  review: CanopyProofEarlyWarningReviewFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM impact.early_warning_review_facts
    WHERE id = ${review.id}
      OR review_root = ${review.reviewRoot}
      OR (
        candidate_root = ${review.candidate.candidateRoot}
        AND review_kind = ${review.reviewKind}
      )
    LIMIT 1
  `);
  if (rows.length > 0) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_REVIEW_CONFLICT");
  }
}

async function assertPublicationAbsent(
  transaction: EarlyWarningTransaction,
  publication: CanopyProofEarlyWarningPublicationFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM impact.early_warning_publication_facts
    WHERE id = ${publication.id}
      OR publication_root = ${publication.publicationRoot}
      OR projection_root = ${publication.publicProjection.projectionRoot}
      OR candidate_root = ${publication.candidate.candidateRoot}
    LIMIT 1
  `);
  if (rows.length > 0) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_PUBLICATION_CONFLICT");
  }
}

async function assertControlAbsent(
  transaction: EarlyWarningTransaction,
  control: CanopyProofEarlyWarningControlFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM impact.early_warning_control_facts
    WHERE id = ${control.id}
      OR control_root = ${control.controlRoot}
      OR publication_id = ${control.publicationId}
    LIMIT 1
  `);
  if (rows.length > 0) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_CONTROL_CONFLICT");
  }
}

async function insertReview(
  transaction: EarlyWarningTransaction,
  review: CanopyProofEarlyWarningReviewFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO impact.early_warning_review_facts (
        id, organization_id, scope_id, scope_type, risk_class, candidate_root,
        source_authority_root, review_kind, decision, reviewer_id,
        reviewer_snapshot, reviewed_at, review_root, audit_event_root, fact_record
      ) VALUES (
        ${review.id}, ${review.candidate.organizationId}, ${review.candidate.scopeId},
        ${review.candidate.scopeType}, ${review.candidate.riskClass},
        ${review.candidate.candidateRoot}, ${review.candidate.sourceAuthorityRoot},
        ${review.reviewKind}, ${review.decision}, ${review.reviewer.id},
        ${JSON.stringify(review.reviewer)}::jsonb, ${asDate(review.reviewedAt)},
        ${review.reviewRoot}, ${review.auditEvent.eventRoot},
        ${JSON.stringify(review)}::jsonb
      )
    `),
  );
}

async function insertPublication(
  transaction: EarlyWarningTransaction,
  publication: CanopyProofEarlyWarningPublicationFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO impact.early_warning_publication_facts (
        id, organization_id, scope_id, scope_type, risk_class, candidate_root,
        source_authority_root, scientific_review_id, operational_review_id,
        publisher_id, publisher_snapshot, predecessor_publication_root,
        published_at, valid_until, event_sequence, projection_root,
        publication_root, audit_event_root, fact_record
      ) VALUES (
        ${publication.id}, ${publication.candidate.organizationId},
        ${publication.candidate.scopeId}, ${publication.candidate.scopeType},
        ${publication.candidate.riskClass}, ${publication.candidate.candidateRoot},
        ${publication.candidate.sourceAuthorityRoot}, ${publication.scientificReviewId},
        ${publication.operationalReviewId}, ${publication.publisher.id},
        ${JSON.stringify(publication.publisher)}::jsonb,
        ${publication.predecessorPublicationRoot}, ${asDate(publication.publishedAt)},
        ${asDate(publication.candidate.validUntil)}, ${publication.eventSequence},
        ${publication.publicProjection.projectionRoot}, ${publication.publicationRoot},
        ${publication.auditEvent.eventRoot}, ${JSON.stringify(publication)}::jsonb
      )
    `),
  );
}

async function insertControl(
  transaction: EarlyWarningTransaction,
  control: CanopyProofEarlyWarningControlFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO impact.early_warning_control_facts (
        id, organization_id, scope_id, risk_class, publication_id,
        publication_root, projection_root, action, reason_code, governor_id,
        governor_snapshot, controlled_at, event_sequence, control_root,
        audit_event_root, fact_record
      ) VALUES (
        ${control.id}, ${control.organizationId}, ${control.scopeId},
        ${control.riskClass}, ${control.publicationId}, ${control.publicationRoot},
        ${control.projectionRoot}, ${control.action}, ${control.reasonCode},
        ${control.governor.id}, ${JSON.stringify(control.governor)}::jsonb,
        ${asDate(control.controlledAt)}, ${control.eventSequence}, ${control.controlRoot},
        ${control.auditEvent.eventRoot}, ${JSON.stringify(control)}::jsonb
      )
    `),
  );
}

async function insertDomainEvent(
  transaction: EarlyWarningTransaction,
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

async function readReceipt(
  transaction: EarlyWarningTransaction,
  receiptId: string,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash,
      audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId}
  `);
  if (rows.length > 1) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_RECEIPT_DUPLICATE");
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
    throw new Error("CANOPYPROOF_EARLY_WARNING_IDEMPOTENCY_CONFLICT");
  }
}

async function insertReceipt(
  transaction: EarlyWarningTransaction,
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
        result_entity_type, result_entity_id, response_hash, audit_event_root,
        created_at
      ) VALUES (
        ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash},
        ${input.requestHash}, ${input.resultType}, ${input.resultId},
        ${input.responseHash}, ${input.auditEventRoot}, ${asDate(input.createdAt)}
      )
    `),
  );
}

function receiptIdentity(
  actorId: string,
  operation: string,
  idempotencyKey: string,
) {
  const idempotencyKeyHash = hashJson({
    kind: "canopyproof-idempotency-key-v1",
    value: idempotencyKey,
  });
  return {
    idempotencyKeyHash,
    id: `cp_risk_command_${hashJson({
      actorId,
      operation,
      idempotencyKeyHash,
    }).slice(0, 24)}`,
  };
}

function reviewStream(review: CanopyProofEarlyWarningReviewFact) {
  return `early-warning:review:${review.candidate.candidateRoot}:${review.reviewKind}`;
}

function publicationStream(
  organizationId: string,
  scopeId: string,
  riskClass: string,
) {
  return `early-warning:${organizationId}:${scopeId}:${riskClass}`;
}

function assertFactScopeAndEvent(
  row: z.output<typeof factRowSchema>,
  organizationId: string,
  scopeId: string,
  riskClass: z.output<typeof riskClassSchema>,
  auditEventRoot: string,
) {
  if (
    row.organization_id !== organizationId ||
    row.scope_id !== scopeId ||
    row.risk_class !== riskClass ||
    row.audit_event_root !== auditEventRoot
  ) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_FACT_COLUMNS_INVALID");
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
  transaction: EarlyWarningTransaction,
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
    throw new Error("CANOPYPROOF_EARLY_WARNING_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) {
    throw new Error("CANOPYPROOF_EARLY_WARNING_MUTATION_CARDINALITY_INVALID");
  }
}
