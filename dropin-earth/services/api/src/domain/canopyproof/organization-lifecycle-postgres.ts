import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofOrganizationLifecycleAuthorityService,
  parseCanopyProofOrganizationAppealDecisionFact,
  parseCanopyProofOrganizationAppealFact,
  parseCanopyProofOrganizationDocumentReviewFact,
  parseCanopyProofOrganizationLifecycleFact,
  type CanopyProofOrganizationAppealDecisionFact,
  type CanopyProofOrganizationAppealFact,
  type CanopyProofOrganizationDocumentReviewFact,
  type CanopyProofOrganizationLifecycleActorSnapshot,
  type CanopyProofOrganizationLifecycleAuthoritySnapshot,
  type CanopyProofOrganizationLifecycleFact,
} from "./organization-lifecycle-authority.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";
import type { CanopyProofAuditEvent } from "./proof-engine.js";

type OrganizationAuthorityTransaction = Prisma.TransactionClient;

export type CanopyProofOrganizationLifecycleCurrentAuthority = Readonly<{
  actor: CanopyProofOrganizationLifecycleActorSnapshot;
  profileRoot: string;
  registrationReferenceRoot: string | null;
  documentRoots: readonly string[];
}>;

export type CanopyProofOrganizationAppealCurrentAuthority = Readonly<{
  submitter: CanopyProofOrganizationLifecycleActorSnapshot;
  profileRoot: string;
}>;

export type CanopyProofOrganizationAppealDecisionCurrentAuthority = Readonly<{
  reviewer: CanopyProofOrganizationLifecycleActorSnapshot;
}>;

export type CanopyProofOrganizationLifecycleAuthorityResolver = (
  query: Readonly<{
    operation: "anchor" | "transition" | "document_review";
    organizationId: string;
    actorId: string;
    actorOrganizationId: string;
    profileRoot: string;
    registrationReferenceRoot: string | null;
    documentRoots: readonly string[];
    effectiveAt: string;
  }>,
  transaction: OrganizationAuthorityTransaction,
) => Promise<CanopyProofOrganizationLifecycleCurrentAuthority>;

export type CanopyProofOrganizationAppealAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    submitterId: string;
    challengedLifecycleRoot: string;
    submittedAt: string;
  }>,
  transaction: OrganizationAuthorityTransaction,
) => Promise<CanopyProofOrganizationAppealCurrentAuthority>;

export type CanopyProofOrganizationAppealDecisionAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    reviewerId: string;
    reviewerOrganizationId: string;
    appealRoot: string;
    decidedAt: string;
  }>,
  transaction: OrganizationAuthorityTransaction,
) => Promise<CanopyProofOrganizationAppealDecisionCurrentAuthority>;

export type CanopyProofOrganizationLifecycleRepositoryStatus = Readonly<{
  service: "canopyproof-organization-lifecycle-authority-repository";
  storage: "postgresql";
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  appendOnly: true;
  forcedRowLevelSecurity: true;
  serializableWrites: true;
  exactRetryRequired: true;
  currentAuthorityReResolved: true;
  independentHumanAuthorityRequired: true;
  compatibilityStatusIsProjectionOnly: true;
  revocationTerminal: true;
}>;

const operations = {
  lifecycle: "organization-lifecycle.commit",
  documentReview: "organization-document-review.commit",
  appeal: "organization-appeal.commit",
  appealDecision: "organization-appeal-decision.commit",
} as const;
const identifierSchema = z.string().trim().min(1).max(240);
const rootSchema = z.string().regex(/^[a-f0-9]{64}$/);
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const resultTypeSchema = z.enum([
  "organization_lifecycle",
  "organization_document_review",
  "organization_appeal",
  "organization_appeal_decision",
]);
type ResultType = z.output<typeof resultTypeSchema>;
const receiptRowSchema = z
  .object({
    request_hash: rootSchema,
    result_entity_type: resultTypeSchema,
    result_entity_id: identifierSchema,
    response_hash: rootSchema,
    audit_event_root: rootSchema,
  })
  .strict();
const factRowSchema = z
  .object({
    id: identifierSchema,
    fact_record: z.unknown(),
    audit_event_root: rootSchema,
  })
  .strict();

export class PrismaCanopyProofOrganizationLifecycleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofOrganizationLifecycleRepositoryStatus {
    return {
      service: "canopyproof-organization-lifecycle-authority-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      independentHumanAuthorityRequired: true,
      compatibilityStatusIsProjectionOnly: true,
      revocationTerminal: true,
    };
  }

  async commitLifecycleFact(
    factInput: CanopyProofOrganizationLifecycleFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofOrganizationLifecycleAuthorityResolver,
  ): Promise<CanopyProofOrganizationLifecycleFact> {
    const fact = parseCanopyProofOrganizationLifecycleFact(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({ kind: "canopyproof-organization-lifecycle-commit-v1", fact });
    const receipt = receiptIdentity(fact.actor.id, operations.lifecycle, idempotencyKey);
    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, fact.organizationId, fact.actor.id);
      await lockCommandAndStream(transaction, receipt, fact.organizationId);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(existing, requestHash, "organization_lifecycle", fact.id, fact.lifecycleRoot, fact.auditEvent.eventRoot);
        return requireLifecycleFact(transaction, fact.id);
      }
      const current = await resolveCurrentAuthority(
        {
          operation: fact.fromStatus === null ? "anchor" : "transition",
          organizationId: fact.organizationId,
          actorId: fact.actor.id,
          actorOrganizationId: fact.actor.organizationId,
          profileRoot: fact.profileRoot,
          registrationReferenceRoot: null,
          documentRoots: fact.documentRoots,
          effectiveAt: fact.decidedAt,
        },
        transaction,
      );
      assertLifecycleAuthority(current, fact.actor, fact.profileRoot, fact.documentRoots);
      const service = await loadAuthorityService(transaction, fact.organizationId);
      const rebuilt =
        fact.fromStatus === null
          ? service.anchorOrganization(
              {
                id: fact.id,
                organizationId: fact.organizationId,
                profileRoot: fact.profileRoot,
                documentRoots: fact.documentRoots,
                rationale: fact.rationale,
                sourceEventRoots: fact.sourceEventRoots,
                anchoredAt: fact.decidedAt,
              },
              current.actor,
            )
          : service.transitionOrganization(
              {
                id: fact.id,
                organizationId: fact.organizationId,
                profileRoot: fact.profileRoot,
                documentRoots: fact.documentRoots,
                toStatus: fact.toStatus,
                trustLevel: fact.trustLevel,
                reasonCode: fact.reasonCode,
                rationale: fact.rationale,
                sourceEventRoots: fact.sourceEventRoots,
                ...(fact.acceptedReviewId ? { acceptedReviewId: fact.acceptedReviewId } : {}),
                ...(fact.appealDecisionId ? { appealDecisionId: fact.appealDecisionId } : {}),
                decidedAt: fact.decidedAt,
              },
              current.actor,
            );
      assertRebuiltFact(rebuilt, fact, "LIFECYCLE");
      await insertDomainEvent(transaction, fact.organizationId, fact.auditEvent);
      await insertLifecycleFact(transaction, fact);
      await insertReceipt(transaction, {
        ...receipt,
        actorId: fact.actor.id,
        operation: operations.lifecycle,
        requestHash,
        resultType: "organization_lifecycle",
        resultId: fact.id,
        responseHash: fact.lifecycleRoot,
        auditEventRoot: fact.auditEvent.eventRoot,
        createdAt: fact.decidedAt,
      });
      return requireLifecycleFact(transaction, fact.id);
    });
  }

  async commitDocumentReview(
    factInput: CanopyProofOrganizationDocumentReviewFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofOrganizationLifecycleAuthorityResolver,
  ): Promise<CanopyProofOrganizationDocumentReviewFact> {
    const fact = parseCanopyProofOrganizationDocumentReviewFact(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({ kind: "canopyproof-organization-document-review-commit-v1", fact });
    const receipt = receiptIdentity(fact.reviewer.id, operations.documentReview, idempotencyKey);
    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, fact.organizationId, fact.reviewer.id);
      await lockCommandAndStream(transaction, receipt, fact.organizationId);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(existing, requestHash, "organization_document_review", fact.id, fact.reviewRoot, fact.auditEvent.eventRoot);
        return requireDocumentReview(transaction, fact.id);
      }
      const current = await resolveCurrentAuthority(
        {
          operation: "document_review",
          organizationId: fact.organizationId,
          actorId: fact.reviewer.id,
          actorOrganizationId: fact.reviewer.organizationId,
          profileRoot: fact.profileRoot,
          registrationReferenceRoot: fact.registrationReferenceRoot,
          documentRoots: fact.documentRoots,
          effectiveAt: fact.reviewedAt,
        },
        transaction,
      );
      assertLifecycleAuthority(
        current,
        fact.reviewer,
        fact.profileRoot,
        fact.documentRoots,
        fact.registrationReferenceRoot,
      );
      const service = await loadAuthorityService(transaction, fact.organizationId);
      const rebuilt = service.reviewDocuments(
        {
          id: fact.id,
          organizationId: fact.organizationId,
          profileRoot: fact.profileRoot,
          registrationReferenceRoot: fact.registrationReferenceRoot,
          documentRoots: fact.documentRoots,
          decision: fact.decision,
          reasonCode: fact.reasonCode,
          rationale: fact.rationale,
          conflictDisclosure: fact.conflictDisclosure,
          sourceEventRoots: fact.sourceEventRoots,
          reviewedAt: fact.reviewedAt,
        },
        current.actor,
      );
      assertRebuiltFact(rebuilt, fact, "DOCUMENT_REVIEW");
      await insertDomainEvent(transaction, fact.organizationId, fact.auditEvent);
      await insertDocumentReview(transaction, fact);
      await insertReceipt(transaction, {
        ...receipt,
        actorId: fact.reviewer.id,
        operation: operations.documentReview,
        requestHash,
        resultType: "organization_document_review",
        resultId: fact.id,
        responseHash: fact.reviewRoot,
        auditEventRoot: fact.auditEvent.eventRoot,
        createdAt: fact.reviewedAt,
      });
      return requireDocumentReview(transaction, fact.id);
    });
  }

  async commitAppeal(
    factInput: CanopyProofOrganizationAppealFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofOrganizationAppealAuthorityResolver,
  ): Promise<CanopyProofOrganizationAppealFact> {
    const fact = parseCanopyProofOrganizationAppealFact(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({ kind: "canopyproof-organization-appeal-commit-v1", fact });
    const receipt = receiptIdentity(fact.submitter.id, operations.appeal, idempotencyKey);
    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, fact.organizationId, fact.submitter.id);
      await lockCommandAndStream(transaction, receipt, fact.organizationId);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(existing, requestHash, "organization_appeal", fact.id, fact.appealRoot, fact.auditEvent.eventRoot);
        return requireAppeal(transaction, fact.id);
      }
      const current = await resolveCurrentAuthority(
        {
          organizationId: fact.organizationId,
          submitterId: fact.submitter.id,
          challengedLifecycleRoot: fact.challengedLifecycleRoot,
          submittedAt: fact.submittedAt,
        },
        transaction,
      );
      if (
        hashJson(current.submitter) !== hashJson(fact.submitter) ||
        current.profileRoot !== fact.profileRoot
      ) {
        throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_CURRENT_AUTHORITY_INVALID");
      }
      const service = await loadAuthorityService(transaction, fact.organizationId);
      const rebuilt = service.openAppeal(
        {
          id: fact.id,
          organizationId: fact.organizationId,
          challengedLifecycleFactId: fact.challengedLifecycleFactId,
          reasonCode: fact.reasonCode,
          requestedRemedy: fact.requestedRemedy,
          grounds: fact.grounds,
          evidenceEventRoots: fact.evidenceEventRoots,
          submittedAt: fact.submittedAt,
        },
        current.submitter,
      );
      assertRebuiltFact(rebuilt, fact, "APPEAL");
      await insertDomainEvent(transaction, fact.organizationId, fact.auditEvent);
      await insertAppeal(transaction, fact);
      await insertReceipt(transaction, {
        ...receipt,
        actorId: fact.submitter.id,
        operation: operations.appeal,
        requestHash,
        resultType: "organization_appeal",
        resultId: fact.id,
        responseHash: fact.appealRoot,
        auditEventRoot: fact.auditEvent.eventRoot,
        createdAt: fact.submittedAt,
      });
      return requireAppeal(transaction, fact.id);
    });
  }

  async commitAppealDecision(
    factInput: CanopyProofOrganizationAppealDecisionFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofOrganizationAppealDecisionAuthorityResolver,
  ): Promise<CanopyProofOrganizationAppealDecisionFact> {
    const fact = parseCanopyProofOrganizationAppealDecisionFact(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({ kind: "canopyproof-organization-appeal-decision-commit-v1", fact });
    const receipt = receiptIdentity(fact.reviewer.id, operations.appealDecision, idempotencyKey);
    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, fact.organizationId, fact.reviewer.id);
      await lockCommandAndStream(transaction, receipt, fact.organizationId);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(existing, requestHash, "organization_appeal_decision", fact.id, fact.decisionRoot, fact.auditEvent.eventRoot);
        return requireAppealDecision(transaction, fact.id);
      }
      const current = await resolveCurrentAuthority(
        {
          organizationId: fact.organizationId,
          reviewerId: fact.reviewer.id,
          reviewerOrganizationId: fact.reviewer.organizationId,
          appealRoot: fact.appealRoot,
          decidedAt: fact.decidedAt,
        },
        transaction,
      );
      if (hashJson(current.reviewer) !== hashJson(fact.reviewer)) {
        throw new Error("CANOPYPROOF_ORGANIZATION_APPEAL_DECISION_CURRENT_AUTHORITY_INVALID");
      }
      const service = await loadAuthorityService(transaction, fact.organizationId);
      const rebuilt = service.decideAppeal(
        {
          id: fact.id,
          organizationId: fact.organizationId,
          appealId: fact.appealId,
          decision: fact.decision,
          remedy: fact.remedy,
          rationale: fact.rationale,
          conflictDisclosure: fact.conflictDisclosure,
          sourceEventRoots: fact.sourceEventRoots,
          decidedAt: fact.decidedAt,
        },
        current.reviewer,
      );
      assertRebuiltFact(rebuilt, fact, "APPEAL_DECISION");
      await insertDomainEvent(transaction, fact.organizationId, fact.auditEvent);
      await insertAppealDecision(transaction, fact);
      await insertReceipt(transaction, {
        ...receipt,
        actorId: fact.reviewer.id,
        operation: operations.appealDecision,
        requestHash,
        resultType: "organization_appeal_decision",
        resultId: fact.id,
        responseHash: fact.decisionRoot,
        auditEventRoot: fact.auditEvent.eventRoot,
        createdAt: fact.decidedAt,
      });
      return requireAppealDecision(transaction, fact.id);
    });
  }

  async getProjection(organizationIdInput: string, actorIdInput: string) {
    const organizationId = identifierSchema.parse(organizationIdInput);
    const actorId = identifierSchema.parse(actorIdInput);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId, actorId);
        return (await loadAuthorityService(transaction, organizationId)).getProjection(organizationId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getAuthoritySnapshot(organizationIdInput: string, actorIdInput: string) {
    const organizationId = identifierSchema.parse(organizationIdInput);
    const actorId = identifierSchema.parse(actorIdInput);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId, actorId);
        return loadAuthoritySnapshot(transaction, organizationId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async withSerializableRetry<T>(
    operation: (transaction: OrganizationAuthorityTransaction) => Promise<T>,
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
    throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_DURABLE_WRITE_UNAVAILABLE");
  }
}

async function loadAuthorityService(transaction: OrganizationAuthorityTransaction, organizationId: string) {
  const snapshot = await loadAuthoritySnapshot(transaction, organizationId);
  if (
    snapshot.lifecycleFacts.length === 0 &&
    snapshot.documentReviewFacts.length === 0 &&
    snapshot.appealFacts.length === 0 &&
    snapshot.appealDecisionFacts.length === 0
  ) {
    return new CanopyProofOrganizationLifecycleAuthorityService();
  }
  return CanopyProofOrganizationLifecycleAuthorityService.fromAuthoritySnapshot(snapshot);
}

async function loadAuthoritySnapshot(
  transaction: OrganizationAuthorityTransaction,
  organizationId: string,
): Promise<CanopyProofOrganizationLifecycleAuthoritySnapshot> {
  const [lifecycleRows, reviewRows, appealRows, decisionRows] = await Promise.all([
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM organizations.organization_lifecycle_facts
      WHERE organization_id = ${organizationId}
      ORDER BY organization_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM organizations.organization_document_review_facts
      WHERE organization_id = ${organizationId}
      ORDER BY organization_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM organizations.organization_appeal_facts
      WHERE organization_id = ${organizationId}
      ORDER BY organization_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM organizations.organization_appeal_decision_facts
      WHERE organization_id = ${organizationId}
      ORDER BY organization_sequence
    `),
  ]);
  if (lifecycleRows.length + reviewRows.length + appealRows.length + decisionRows.length > 4_096) {
    throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_HISTORY_LIMIT_EXCEEDED");
  }
  return {
    lifecycleFacts: lifecycleRows.map((row) => parseFactRow(row, parseCanopyProofOrganizationLifecycleFact)),
    documentReviewFacts: reviewRows.map((row) => parseFactRow(row, parseCanopyProofOrganizationDocumentReviewFact)),
    appealFacts: appealRows.map((row) => parseFactRow(row, parseCanopyProofOrganizationAppealFact)),
    appealDecisionFacts: decisionRows.map((row) => parseFactRow(row, parseCanopyProofOrganizationAppealDecisionFact)),
  };
}

function parseFactRow<T extends { id: string; auditEvent: CanopyProofAuditEvent }>(
  input: unknown,
  parse: (value: unknown) => T,
) {
  const row = factRowSchema.parse(input);
  const fact = parse(row.fact_record);
  if (fact.id !== row.id || fact.auditEvent.eventRoot !== row.audit_event_root) {
    throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_FACT_COLUMNS_INVALID");
  }
  return fact;
}

async function requireLifecycleFact(transaction: OrganizationAuthorityTransaction, factId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, fact_record, audit_event_root
    FROM organizations.organization_lifecycle_facts WHERE id = ${factId}
  `);
  if (rows.length !== 1) throw new Error(`CANOPYPROOF_ORGANIZATION_LIFECYCLE_FACT_NOT_FOUND:${factId}`);
  return parseFactRow(rows[0], parseCanopyProofOrganizationLifecycleFact);
}

async function requireDocumentReview(transaction: OrganizationAuthorityTransaction, factId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, fact_record, audit_event_root
    FROM organizations.organization_document_review_facts WHERE id = ${factId}
  `);
  if (rows.length !== 1) throw new Error(`CANOPYPROOF_ORGANIZATION_DOCUMENT_REVIEW_NOT_FOUND:${factId}`);
  return parseFactRow(rows[0], parseCanopyProofOrganizationDocumentReviewFact);
}

async function requireAppeal(transaction: OrganizationAuthorityTransaction, factId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, fact_record, audit_event_root
    FROM organizations.organization_appeal_facts WHERE id = ${factId}
  `);
  if (rows.length !== 1) throw new Error(`CANOPYPROOF_ORGANIZATION_APPEAL_NOT_FOUND:${factId}`);
  return parseFactRow(rows[0], parseCanopyProofOrganizationAppealFact);
}

async function requireAppealDecision(transaction: OrganizationAuthorityTransaction, factId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, fact_record, audit_event_root
    FROM organizations.organization_appeal_decision_facts WHERE id = ${factId}
  `);
  if (rows.length !== 1) throw new Error(`CANOPYPROOF_ORGANIZATION_APPEAL_DECISION_NOT_FOUND:${factId}`);
  return parseFactRow(rows[0], parseCanopyProofOrganizationAppealDecisionFact);
}

async function insertLifecycleFact(
  transaction: OrganizationAuthorityTransaction,
  fact: CanopyProofOrganizationLifecycleFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.organization_lifecycle_facts (
        id, organization_id, actor_organization_id, previous_lifecycle_fact_id,
        previous_lifecycle_root, profile_root, document_root, from_status, to_status,
        trust_level, reason_code, accepted_review_id, appeal_decision_id, actor_id,
        actor_snapshot, decided_at, organization_sequence, previous_event_root,
        command_hash, lifecycle_hash, lifecycle_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.actor.organizationId},
        ${fact.previousLifecycleFactId ?? null}, ${fact.previousLifecycleRoot ?? null},
        ${fact.profileRoot}, ${fact.documentRoot}, ${fact.fromStatus}, ${fact.toStatus},
        ${fact.trustLevel}, ${fact.reasonCode}, ${fact.acceptedReviewId ?? null},
        ${fact.appealDecisionId ?? null}, ${fact.actor.id},
        ${JSON.stringify(fact.actor)}::jsonb, ${asDate(fact.decidedAt)},
        ${fact.organizationSequence}, ${fact.previousEventRoot}, ${fact.commandHash},
        ${fact.lifecycleHash}, ${fact.lifecycleRoot}, ${fact.auditEvent.eventRoot},
        ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertDocumentReview(
  transaction: OrganizationAuthorityTransaction,
  fact: CanopyProofOrganizationDocumentReviewFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.organization_document_review_facts (
        id, organization_id, lifecycle_fact_id, lifecycle_root, profile_root,
        registration_reference_root, document_root, decision, reason_code, reviewer_organization_id,
        reviewer_id, reviewer_snapshot, reviewed_at, organization_sequence,
        previous_event_root, command_hash, review_hash, review_root,
        audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.lifecycleFactId}, ${fact.lifecycleRoot},
        ${fact.profileRoot}, ${fact.registrationReferenceRoot}, ${fact.documentRoot},
        ${fact.decision}, ${fact.reasonCode},
        ${fact.reviewer.organizationId}, ${fact.reviewer.id},
        ${JSON.stringify(fact.reviewer)}::jsonb, ${asDate(fact.reviewedAt)},
        ${fact.organizationSequence}, ${fact.previousEventRoot}, ${fact.commandHash},
        ${fact.reviewHash}, ${fact.reviewRoot}, ${fact.auditEvent.eventRoot},
        ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertAppeal(transaction: OrganizationAuthorityTransaction, fact: CanopyProofOrganizationAppealFact) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.organization_appeal_facts (
        id, organization_id, challenged_lifecycle_fact_id, challenged_lifecycle_root,
        challenged_status, challenged_actor_id, profile_root, reason_code,
        requested_remedy, submitter_id, submitter_snapshot, submitted_at,
        organization_sequence, previous_event_root, command_hash, appeal_hash,
        appeal_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.challengedLifecycleFactId},
        ${fact.challengedLifecycleRoot}, ${fact.challengedStatus}, ${fact.challengedActorId},
        ${fact.profileRoot}, ${fact.reasonCode}, ${fact.requestedRemedy},
        ${fact.submitter.id}, ${JSON.stringify(fact.submitter)}::jsonb,
        ${asDate(fact.submittedAt)}, ${fact.organizationSequence}, ${fact.previousEventRoot},
        ${fact.commandHash}, ${fact.appealHash}, ${fact.appealRoot},
        ${fact.auditEvent.eventRoot}, ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertAppealDecision(
  transaction: OrganizationAuthorityTransaction,
  fact: CanopyProofOrganizationAppealDecisionFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.organization_appeal_decision_facts (
        id, organization_id, appeal_id, appeal_root, challenged_lifecycle_root,
        challenged_status, prior_decision_id, prior_decision_root,
        appeal_decision_sequence, decision, remedy, reviewer_organization_id,
        reviewer_id, reviewer_snapshot, decided_at, organization_sequence,
        previous_event_root, command_hash, decision_hash, decision_root,
        audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.appealId}, ${fact.appealRoot},
        ${fact.challengedLifecycleRoot}, ${fact.challengedStatus},
        ${fact.priorDecisionId ?? null}, ${fact.priorDecisionRoot ?? null},
        ${fact.appealDecisionSequence}, ${fact.decision}, ${fact.remedy},
        ${fact.reviewer.organizationId}, ${fact.reviewer.id},
        ${JSON.stringify(fact.reviewer)}::jsonb, ${asDate(fact.decidedAt)},
        ${fact.organizationSequence}, ${fact.previousEventRoot}, ${fact.commandHash},
        ${fact.decisionHash}, ${fact.decisionRoot}, ${fact.auditEvent.eventRoot},
        ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertDomainEvent(
  transaction: OrganizationAuthorityTransaction,
  organizationId: string,
  event: CanopyProofAuditEvent,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES (
        ${event.id}, ${`organization-lifecycle:${organizationId}`}, ${event.action},
        ${event.actor}, ${event.entityType}, ${event.entityId}, ${event.previousRoot},
        ${event.payloadHash}, ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
      )
    `),
  );
}

async function lockCommandAndStream(
  transaction: OrganizationAuthorityTransaction,
  receipt: ReturnType<typeof receiptIdentity>,
  organizationId: string,
) {
  await acquireCanopyProofPostgresTransactionLock(
    transaction,
    `organization-authority-command:${receipt.id}`,
  );
  await acquireCanopyProofPostgresTransactionLock(
    transaction,
    `organization-lifecycle:${organizationId}`,
  );
}

async function readReceipt(transaction: OrganizationAuthorityTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId}
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_RECEIPT_DUPLICATE");
  return rows.length === 0 ? undefined : receiptRowSchema.parse(rows[0]);
}

function assertReceipt(
  receipt: z.output<typeof receiptRowSchema>,
  requestHash: string,
  resultType: ResultType,
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
    throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_IDEMPOTENCY_CONFLICT");
  }
}

async function insertReceipt(
  transaction: OrganizationAuthorityTransaction,
  input: Readonly<{
    id: string;
    idempotencyKeyHash: string;
    actorId: string;
    operation: string;
    requestHash: string;
    resultType: ResultType;
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
  const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
  return {
    idempotencyKeyHash,
    id: `cp_org_authority_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`,
  };
}

function assertLifecycleAuthority(
  current: CanopyProofOrganizationLifecycleCurrentAuthority,
  actor: CanopyProofOrganizationLifecycleActorSnapshot,
  profileRoot: string,
  documentRoots: readonly string[],
  expectedRegistrationReferenceRoot?: string | null,
) {
  if (
    hashJson(current.actor) !== hashJson(actor) ||
    current.profileRoot !== profileRoot ||
    hashJson([...current.documentRoots].sort()) !== hashJson([...documentRoots].sort()) ||
    (expectedRegistrationReferenceRoot !== undefined &&
      current.registrationReferenceRoot !== expectedRegistrationReferenceRoot)
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_LIFECYCLE_CURRENT_AUTHORITY_INVALID");
  }
}

function assertRebuiltFact<T>(rebuilt: T, expected: T, label: string) {
  if (hashJson(rebuilt) !== hashJson(expected)) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_${label}_REBUILD_MISMATCH`);
  }
}

async function setContext(
  transaction: OrganizationAuthorityTransaction,
  organizationIdInput: string,
  actorIdInput: string,
) {
  const organizationId = identifierSchema.parse(organizationIdInput);
  const actorId = identifierSchema.parse(actorIdInput);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_ORGANIZATION_AUTHORITY_MUTATION_CARDINALITY_INVALID");
}
