import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  parseCanopyProofGlobalCommandCenterSpatialControlFact,
  parseCanopyProofGlobalCommandCenterSpatialDisclosureFact,
  resolveCanopyProofGlobalCommandCenterSpatialDisclosure,
  verifyCanopyProofGlobalCommandCenterSpatialCandidate,
  verifyCanopyProofGlobalCommandCenterSpatialDisclosureFact,
  verifyCanopyProofGlobalCommandCenterSpatialReview,
  verifyCanopyProofGlobalCommandCenterSpatialWithdrawal,
  type CanopyProofGlobalCommandCenterSpatialAuthorityRecord,
  type CanopyProofGlobalCommandCenterSpatialCandidate,
  type CanopyProofGlobalCommandCenterSpatialControlFact,
  type CanopyProofGlobalCommandCenterSpatialDisclosureFact,
  type CanopyProofGlobalCommandCenterSpatialReviewFact,
} from "./global-command-center-spatial-disclosure-authority.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";
import {
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

type SpatialTransaction = Prisma.TransactionClient;

export type CanopyProofSpatialReviewCurrentAuthority = Readonly<{
  candidate: CanopyProofGlobalCommandCenterSpatialCandidate;
  reviewer: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofSpatialPublicationCurrentAuthority = Readonly<{
  candidate: CanopyProofGlobalCommandCenterSpatialCandidate;
  publisher: CanopyProofVerificationActorSnapshot;
  privacyReviewer: CanopyProofVerificationActorSnapshot;
  safeguardingReviewer: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofSpatialWithdrawalCurrentAuthority = Readonly<{
  governor: CanopyProofVerificationActorSnapshot;
}>;

export type CanopyProofSpatialReviewAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    regionId: string;
    candidateRoot: string;
    reviewerId: string;
    reviewKind: CanopyProofGlobalCommandCenterSpatialReviewFact["reviewKind"];
    reviewedAt: string;
  }>,
  transaction: SpatialTransaction,
) => Promise<CanopyProofSpatialReviewCurrentAuthority>;

export type CanopyProofSpatialPublicationAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    regionId: string;
    candidateRoot: string;
    publisherId: string;
    privacyReviewerId: string;
    safeguardingReviewerId: string;
    publishedAt: string;
  }>,
  transaction: SpatialTransaction,
) => Promise<CanopyProofSpatialPublicationCurrentAuthority>;

export type CanopyProofSpatialWithdrawalAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    regionId: string;
    publicationRoot: string;
    governorId: string;
    controlledAt: string;
  }>,
  transaction: SpatialTransaction,
) => Promise<CanopyProofSpatialWithdrawalCurrentAuthority>;

export type CanopyProofGlobalCommandCenterSpatialDisclosureRepositoryStatus = Readonly<{
  service: "canopyproof-global-command-center-spatial-disclosure-repository";
  storage: "postgresql";
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  appendOnly: true;
  forcedRowLevelSecurity: true;
  serializableWrites: true;
  exactRetryRequired: true;
  currentAuthorityReResolved: true;
  independentHumanReviewsRequired: true;
  withdrawalFailClosed: true;
}>;

const REVIEW_OPERATION = "global-command-center-spatial-review.commit";
const DISCLOSURE_OPERATION = "global-command-center-spatial-disclosure.commit";
const WITHDRAWAL_OPERATION = "global-command-center-spatial-withdrawal.commit";
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identifierSchema = z.string().trim().min(1).max(240);
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const receiptRowSchema = z
  .object({
    request_hash: hashSchema,
    result_entity_type: z.enum([
      "global_command_center_spatial_review",
      "global_command_center_spatial_disclosure",
      "global_command_center_spatial_disclosure_control",
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
    region_id: identifierSchema,
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

export class PrismaCanopyProofGlobalCommandCenterSpatialDisclosureRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofGlobalCommandCenterSpatialDisclosureRepositoryStatus {
    return {
      service: "canopyproof-global-command-center-spatial-disclosure-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      independentHumanReviewsRequired: true,
      withdrawalFailClosed: true,
    };
  }

  async commitReview(
    reviewInput: CanopyProofGlobalCommandCenterSpatialReviewFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofSpatialReviewAuthorityResolver,
  ): Promise<CanopyProofGlobalCommandCenterSpatialReviewFact> {
    const review = verifyCanopyProofGlobalCommandCenterSpatialReview(reviewInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({
      kind: "canopyproof-global-command-center-spatial-review-commit-v1",
      review,
    });
    const receipt = receiptIdentity(
      review.reviewer.id,
      REVIEW_OPERATION,
      idempotencyKey,
    );

    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, review.candidate.organizationId, review.reviewer.id);
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `spatial-review-command:${review.reviewer.id}:${receipt.idempotencyKeyHash}`,
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
          "global_command_center_spatial_review",
          review.id,
          review.reviewRoot,
          review.auditEvent.eventRoot,
        );
        return requireReview(transaction, review.id);
      }
      const current = await resolveCurrentAuthority(
        {
          organizationId: review.candidate.organizationId,
          regionId: review.candidate.regionId,
          candidateRoot: review.candidate.candidateRoot,
          reviewerId: review.reviewer.id,
          reviewKind: review.reviewKind,
          reviewedAt: review.reviewedAt,
        },
        transaction,
      );
      if (
        hashJson(verifyCanopyProofGlobalCommandCenterSpatialCandidate(current.candidate)) !==
          hashJson(review.candidate) ||
        hashJson(current.reviewer) !== hashJson(review.reviewer)
      ) {
        throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CURRENT_REVIEW_AUTHORITY_INVALID");
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
        resultType: "global_command_center_spatial_review",
        resultId: review.id,
        responseHash: review.reviewRoot,
        auditEventRoot: review.auditEvent.eventRoot,
        createdAt: review.reviewedAt,
      });
      return requireReview(transaction, review.id);
    });
  }

  async commitDisclosure(
    disclosureInput: CanopyProofGlobalCommandCenterSpatialDisclosureFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofSpatialPublicationAuthorityResolver,
  ): Promise<CanopyProofGlobalCommandCenterSpatialDisclosureFact> {
    const disclosure = parseCanopyProofGlobalCommandCenterSpatialDisclosureFact(disclosureInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({
      kind: "canopyproof-global-command-center-spatial-disclosure-commit-v1",
      disclosure,
    });
    const receipt = receiptIdentity(
      disclosure.publisher.id,
      DISCLOSURE_OPERATION,
      idempotencyKey,
    );

    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, disclosure.candidate.organizationId, disclosure.publisher.id);
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `spatial-disclosure-command:${disclosure.publisher.id}:${receipt.idempotencyKeyHash}`,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `domain-event:${regionStream(disclosure.candidate.organizationId, disclosure.candidate.regionId)}`,
      );
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          "global_command_center_spatial_disclosure",
          disclosure.id,
          disclosure.publicationRoot,
          disclosure.auditEvent.eventRoot,
        );
        return (await requireDisclosureBundle(transaction, disclosure.id)).disclosure;
      }
      const privacyReview = await requireReview(transaction, disclosure.privacyReviewId);
      const safeguardingReview = await requireReview(transaction, disclosure.safeguardingReviewId);
      const current = await resolveCurrentAuthority(
        {
          organizationId: disclosure.candidate.organizationId,
          regionId: disclosure.candidate.regionId,
          candidateRoot: disclosure.candidate.candidateRoot,
          publisherId: disclosure.publisher.id,
          privacyReviewerId: disclosure.privacyReviewerId,
          safeguardingReviewerId: disclosure.safeguardingReviewerId,
          publishedAt: disclosure.publishedAt,
        },
        transaction,
      );
      if (
        hashJson(verifyCanopyProofGlobalCommandCenterSpatialCandidate(current.candidate)) !==
          hashJson(disclosure.candidate) ||
        hashJson(current.publisher) !== hashJson(disclosure.publisher) ||
        hashJson(current.privacyReviewer) !== hashJson(privacyReview.reviewer) ||
        hashJson(current.safeguardingReviewer) !== hashJson(safeguardingReview.reviewer)
      ) {
        throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CURRENT_PUBLICATION_AUTHORITY_INVALID");
      }
      const history = await loadRegionHistory(
        transaction,
        disclosure.candidate.organizationId,
        disclosure.candidate.regionId,
      );
      verifyCanopyProofGlobalCommandCenterSpatialDisclosureFact(
        disclosure,
        privacyReview,
        safeguardingReview,
        history,
      );
      await assertDisclosureAbsent(transaction, disclosure);
      await insertDomainEvent(
        transaction,
        regionStream(disclosure.candidate.organizationId, disclosure.candidate.regionId),
        disclosure.auditEvent,
      );
      await insertDisclosure(transaction, disclosure);
      await insertReceipt(transaction, {
        id: receipt.id,
        actorId: disclosure.publisher.id,
        operation: DISCLOSURE_OPERATION,
        idempotencyKeyHash: receipt.idempotencyKeyHash,
        requestHash,
        resultType: "global_command_center_spatial_disclosure",
        resultId: disclosure.id,
        responseHash: disclosure.publicationRoot,
        auditEventRoot: disclosure.auditEvent.eventRoot,
        createdAt: disclosure.publishedAt,
      });
      return (await requireDisclosureBundle(transaction, disclosure.id)).disclosure;
    });
  }

  async commitWithdrawal(
    controlInput: CanopyProofGlobalCommandCenterSpatialControlFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofSpatialWithdrawalAuthorityResolver,
  ): Promise<CanopyProofGlobalCommandCenterSpatialControlFact> {
    const control = parseCanopyProofGlobalCommandCenterSpatialControlFact(controlInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({
      kind: "canopyproof-global-command-center-spatial-withdrawal-commit-v1",
      control,
    });
    const receipt = receiptIdentity(
      control.governor.id,
      WITHDRAWAL_OPERATION,
      idempotencyKey,
    );

    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, control.organizationId, control.governor.id);
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `spatial-withdrawal-command:${control.governor.id}:${receipt.idempotencyKeyHash}`,
      );
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `domain-event:${regionStream(control.organizationId, control.regionId)}`,
      );
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          "global_command_center_spatial_disclosure_control",
          control.id,
          control.controlRoot,
          control.auditEvent.eventRoot,
        );
        return requireControl(transaction, control.id);
      }
      const bundle = await requireDisclosureBundle(transaction, control.publicationId);
      const current = await resolveCurrentAuthority(
        {
          organizationId: control.organizationId,
          regionId: control.regionId,
          publicationRoot: control.publicationRoot,
          governorId: control.governor.id,
          controlledAt: control.controlledAt,
        },
        transaction,
      );
      if (hashJson(current.governor) !== hashJson(control.governor)) {
        throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CURRENT_WITHDRAWAL_AUTHORITY_INVALID");
      }
      const history = await loadRegionHistory(transaction, control.organizationId, control.regionId);
      verifyCanopyProofGlobalCommandCenterSpatialWithdrawal(control, bundle.disclosure, history);
      await assertControlAbsent(transaction, control);
      await insertDomainEvent(
        transaction,
        regionStream(control.organizationId, control.regionId),
        control.auditEvent,
      );
      await insertControl(transaction, control);
      await insertReceipt(transaction, {
        id: receipt.id,
        actorId: control.governor.id,
        operation: WITHDRAWAL_OPERATION,
        idempotencyKeyHash: receipt.idempotencyKeyHash,
        requestHash,
        resultType: "global_command_center_spatial_disclosure_control",
        resultId: control.id,
        responseHash: control.controlRoot,
        auditEventRoot: control.auditEvent.eventRoot,
        createdAt: control.controlledAt,
      });
      return requireControl(transaction, control.id);
    });
  }

  async resolveCurrentDisclosure(input: Readonly<{
    organizationId: string;
    actorId: string;
    regionId: string;
    regionSourceRoot: string;
    sourceProjectCount: number;
    at: string;
  }>) {
    const organizationId = identifierSchema.parse(input.organizationId);
    const actorId = identifierSchema.parse(input.actorId);
    const regionId = identifierSchema.parse(input.regionId);
    const regionSourceRoot = hashSchema.parse(input.regionSourceRoot);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId, actorId);
        const records = await loadRegionRecords(transaction, organizationId, regionId);
        return resolveCanopyProofGlobalCommandCenterSpatialDisclosure({
          organizationId,
          regionId,
          regionSourceRoot,
          sourceProjectCount: input.sourceProjectCount,
          at: input.at,
          records,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async withSerializableRetry<T>(operation: (transaction: SpatialTransaction) => Promise<T>) {
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
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_DURABLE_WRITE_UNAVAILABLE");
  }
}

async function loadRegionRecords(
  transaction: SpatialTransaction,
  organizationId: string,
  regionId: string,
): Promise<readonly CanopyProofGlobalCommandCenterSpatialAuthorityRecord[]> {
  const disclosures = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, region_id, fact_record, audit_event_root
    FROM impact.global_command_center_spatial_disclosure_facts
    WHERE organization_id = ${organizationId} AND region_id = ${regionId}
  `);
  const controls = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, region_id, fact_record, audit_event_root
    FROM impact.global_command_center_spatial_control_facts
    WHERE organization_id = ${organizationId} AND region_id = ${regionId}
  `);
  if (disclosures.length + controls.length > 1_024) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REGION_HISTORY_LIMIT_EXCEEDED");
  }
  const records: CanopyProofGlobalCommandCenterSpatialAuthorityRecord[] = [];
  for (const rowInput of disclosures) {
    const row = factRowSchema.parse(rowInput);
    const bundle = await requireDisclosureBundle(transaction, row.id);
    assertFactScopeAndEvent(row, bundle.disclosure.candidate.organizationId, bundle.disclosure.candidate.regionId, bundle.disclosure.auditEvent.eventRoot);
    records.push({ kind: "disclosure", ...bundle });
  }
  for (const rowInput of controls) {
    const row = factRowSchema.parse(rowInput);
    const control = parseCanopyProofGlobalCommandCenterSpatialControlFact(row.fact_record);
    assertFactScopeAndEvent(row, control.organizationId, control.regionId, control.auditEvent.eventRoot);
    records.push({ kind: "control", control });
  }
  return records;
}

async function requireReview(transaction: SpatialTransaction, reviewId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, region_id, fact_record, audit_event_root
    FROM impact.global_command_center_spatial_review_facts
    WHERE id = ${reviewId}
  `);
  if (rows.length !== 1) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REVIEW_NOT_FOUND");
  const row = factRowSchema.parse(rows[0]);
  const review = verifyCanopyProofGlobalCommandCenterSpatialReview(row.fact_record);
  assertFactScopeAndEvent(
    row,
    review.candidate.organizationId,
    review.candidate.regionId,
    review.auditEvent.eventRoot,
  );
  const events = await loadEvents(transaction, reviewStream(review));
  if (events.length !== 1 || hashJson(events[0]) !== hashJson(review.auditEvent)) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REVIEW_AUDIT_INVALID");
  }
  return review;
}

async function requireDisclosureBundle(transaction: SpatialTransaction, disclosureId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, region_id, fact_record, audit_event_root
    FROM impact.global_command_center_spatial_disclosure_facts
    WHERE id = ${disclosureId}
  `);
  if (rows.length !== 1) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_NOT_FOUND");
  const row = factRowSchema.parse(rows[0]);
  const parsed = parseCanopyProofGlobalCommandCenterSpatialDisclosureFact(row.fact_record);
  const privacyReview = await requireReview(transaction, parsed.privacyReviewId);
  const safeguardingReview = await requireReview(transaction, parsed.safeguardingReviewId);
  const history = await loadRegionHistory(
    transaction,
    parsed.candidate.organizationId,
    parsed.candidate.regionId,
  );
  const eventIndex = history.findIndex((event) => event.eventRoot === parsed.auditEvent.eventRoot);
  if (eventIndex < 0) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_AUDIT_NOT_FOUND");
  }
  const priorHistory = history.slice(0, eventIndex);
  const disclosure = verifyCanopyProofGlobalCommandCenterSpatialDisclosureFact(
    parsed,
    privacyReview,
    safeguardingReview,
    priorHistory,
  );
  assertFactScopeAndEvent(
    row,
    disclosure.candidate.organizationId,
    disclosure.candidate.regionId,
    disclosure.auditEvent.eventRoot,
  );
  const storedEvent = await requireEvent(transaction, disclosure.auditEvent.eventRoot);
  if (hashJson(storedEvent) !== hashJson(disclosure.auditEvent)) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_AUDIT_INVALID");
  }
  return { disclosure, privacyReview, safeguardingReview };
}

async function requireControl(transaction: SpatialTransaction, controlId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, organization_id, region_id, fact_record, audit_event_root
    FROM impact.global_command_center_spatial_control_facts
    WHERE id = ${controlId}
  `);
  if (rows.length !== 1) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CONTROL_NOT_FOUND");
  const row = factRowSchema.parse(rows[0]);
  const parsed = parseCanopyProofGlobalCommandCenterSpatialControlFact(row.fact_record);
  const bundle = await requireDisclosureBundle(transaction, parsed.publicationId);
  const allHistory = await loadRegionHistory(transaction, parsed.organizationId, parsed.regionId);
  const eventIndex = allHistory.findIndex((event) => event.eventRoot === parsed.auditEvent.eventRoot);
  if (eventIndex < 0) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CONTROL_AUDIT_NOT_FOUND");
  }
  const history = allHistory.slice(0, eventIndex);
  const control = verifyCanopyProofGlobalCommandCenterSpatialWithdrawal(
    parsed,
    bundle.disclosure,
    history,
  );
  assertFactScopeAndEvent(row, control.organizationId, control.regionId, control.auditEvent.eventRoot);
  const storedEvent = await requireEvent(transaction, control.auditEvent.eventRoot);
  if (hashJson(storedEvent) !== hashJson(control.auditEvent)) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CONTROL_AUDIT_INVALID");
  }
  return control;
}

async function loadRegionHistory(
  transaction: SpatialTransaction,
  organizationId: string,
  regionId: string,
) {
  return loadEvents(transaction, regionStream(organizationId, regionId));
}

async function loadEvents(transaction: SpatialTransaction, streamId: string) {
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
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_AUDIT_HISTORY_INVALID");
  }
  return events;
}

async function requireEvent(transaction: SpatialTransaction, eventRoot: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, action, actor_id, entity_type, entity_id, previous_root,
      payload_hash, event_root, created_at AS created_at_value, rationale
    FROM audit.domain_events WHERE event_root = ${eventRoot}
  `);
  if (rows.length !== 1) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_AUDIT_NOT_FOUND");
  return mapEvent(rows[0]);
}

async function assertReviewAbsent(
  transaction: SpatialTransaction,
  review: CanopyProofGlobalCommandCenterSpatialReviewFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM impact.global_command_center_spatial_review_facts
    WHERE id = ${review.id}
      OR review_root = ${review.reviewRoot}
      OR (candidate_root = ${review.candidate.candidateRoot} AND review_kind = ${review.reviewKind})
    LIMIT 1
  `);
  if (rows.length > 0) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_REVIEW_CONFLICT");
}

async function assertDisclosureAbsent(
  transaction: SpatialTransaction,
  disclosure: CanopyProofGlobalCommandCenterSpatialDisclosureFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM impact.global_command_center_spatial_disclosure_facts
    WHERE id = ${disclosure.id}
      OR disclosure_root = ${disclosure.disclosureRoot}
      OR publication_root = ${disclosure.publicationRoot}
    LIMIT 1
  `);
  if (rows.length > 0) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_PUBLICATION_CONFLICT");
}

async function assertControlAbsent(
  transaction: SpatialTransaction,
  control: CanopyProofGlobalCommandCenterSpatialControlFact,
) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id FROM impact.global_command_center_spatial_control_facts
    WHERE id = ${control.id}
      OR control_root = ${control.controlRoot}
      OR publication_id = ${control.publicationId}
    LIMIT 1
  `);
  if (rows.length > 0) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_CONTROL_CONFLICT");
}

async function insertReview(
  transaction: SpatialTransaction,
  review: CanopyProofGlobalCommandCenterSpatialReviewFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO impact.global_command_center_spatial_review_facts (
      id, organization_id, region_id, candidate_root, region_source_root,
      source_project_count, review_kind, decision, reviewer_id, reviewer_snapshot,
      reviewed_at, review_root, audit_event_root, fact_record
    ) VALUES (
      ${review.id}, ${review.candidate.organizationId}, ${review.candidate.regionId},
      ${review.candidate.candidateRoot}, ${review.candidate.regionSourceRoot},
      ${review.candidate.sourceProjectCount}, ${review.reviewKind}, ${review.decision},
      ${review.reviewer.id}, ${JSON.stringify(review.reviewer)}::jsonb,
      ${asDate(review.reviewedAt)}, ${review.reviewRoot}, ${review.auditEvent.eventRoot},
      ${JSON.stringify(review)}::jsonb
    )
  `));
}

async function insertDisclosure(
  transaction: SpatialTransaction,
  disclosure: CanopyProofGlobalCommandCenterSpatialDisclosureFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO impact.global_command_center_spatial_disclosure_facts (
      id, organization_id, region_id, candidate_root, region_source_root,
      source_project_count, privacy_review_id, safeguarding_review_id,
      publisher_id, publisher_snapshot, published_at, disclosure_root,
      publication_root, audit_event_root, fact_record
    ) VALUES (
      ${disclosure.id}, ${disclosure.candidate.organizationId}, ${disclosure.candidate.regionId},
      ${disclosure.candidate.candidateRoot}, ${disclosure.candidate.regionSourceRoot},
      ${disclosure.candidate.sourceProjectCount}, ${disclosure.privacyReviewId},
      ${disclosure.safeguardingReviewId}, ${disclosure.publisher.id},
      ${JSON.stringify(disclosure.publisher)}::jsonb, ${asDate(disclosure.publishedAt)},
      ${disclosure.disclosureRoot}, ${disclosure.publicationRoot},
      ${disclosure.auditEvent.eventRoot}, ${JSON.stringify(disclosure)}::jsonb
    )
  `));
}

async function insertControl(
  transaction: SpatialTransaction,
  control: CanopyProofGlobalCommandCenterSpatialControlFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO impact.global_command_center_spatial_control_facts (
      id, organization_id, region_id, publication_id, publication_root,
      disclosure_root, action, reason_code, governor_id, governor_snapshot,
      controlled_at, control_root, audit_event_root, fact_record
    ) VALUES (
      ${control.id}, ${control.organizationId}, ${control.regionId}, ${control.publicationId},
      ${control.publicationRoot}, ${control.disclosureRoot}, ${control.action},
      ${control.reasonCode}, ${control.governor.id}, ${JSON.stringify(control.governor)}::jsonb,
      ${asDate(control.controlledAt)}, ${control.controlRoot}, ${control.auditEvent.eventRoot},
      ${JSON.stringify(control)}::jsonb
    )
  `));
}

async function insertDomainEvent(
  transaction: SpatialTransaction,
  streamId: string,
  event: CanopyProofAuditEvent,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.domain_events (
      id, stream_id, action, actor_id, entity_type, entity_id,
      previous_root, payload_hash, event_root, created_at, rationale
    ) VALUES (
      ${event.id}, ${streamId}, ${event.action}, ${event.actor}, ${event.entityType},
      ${event.entityId}, ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot},
      ${asDate(event.createdAt)}, ${event.rationale}
    )
  `));
}

async function readReceipt(transaction: SpatialTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId}
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_RECEIPT_DUPLICATE");
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
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_IDEMPOTENCY_CONFLICT");
  }
}

async function insertReceipt(
  transaction: SpatialTransaction,
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
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.command_receipts (
      id, actor_id, operation, idempotency_key_hash, request_hash,
      result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
    ) VALUES (
      ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash},
      ${input.requestHash}, ${input.resultType}, ${input.resultId}, ${input.responseHash},
      ${input.auditEventRoot}, ${asDate(input.createdAt)}
    )
  `));
}

async function setContext(
  transaction: SpatialTransaction,
  organizationId: string,
  actorId: string,
) {
  await transaction.$executeRaw(Prisma.sql`
    SELECT set_config('app.organization_id', ${organizationId}, true),
      set_config('app.actor_id', ${actorId}, true)
  `);
}

function receiptIdentity(actorId: string, operation: string, idempotencyKey: string) {
  const idempotencyKeyHash = hashJson({
    kind: "canopyproof-idempotency-key-v1",
    value: idempotencyKey,
  });
  return {
    idempotencyKeyHash,
    id: `cp_spatial_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`,
  };
}

function reviewStream(review: CanopyProofGlobalCommandCenterSpatialReviewFact) {
  return `global-command-center:spatial-review:${review.candidate.candidateRoot}:${review.reviewKind}`;
}

function regionStream(organizationId: string, regionId: string) {
  return `global-command-center:spatial:${organizationId}:${regionId}`;
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

function assertFactScopeAndEvent(
  row: z.output<typeof factRowSchema>,
  organizationId: string,
  regionId: string,
  eventRoot: string,
) {
  if (
    row.organization_id !== organizationId ||
    row.region_id !== regionId ||
    row.audit_event_root !== eventRoot
  ) {
    throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_STORED_COLUMNS_INVALID");
  }
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_SPATIAL_DISCLOSURE_MUTATION_COUNT_INVALID");
}

function asDate(value: string) {
  return new Date(value);
}
