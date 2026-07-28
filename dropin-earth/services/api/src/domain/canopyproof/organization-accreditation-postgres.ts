import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofOrganizationAccreditationAuthorityService,
  parseCanopyProofOrganizationAccreditationApplicationFact,
  parseCanopyProofOrganizationAccreditationControlFact,
  parseCanopyProofOrganizationAccreditationDecisionFact,
  parseCanopyProofOrganizationAccreditationReviewFact,
  type CanopyProofOrganizationAccreditationActorSnapshot,
  type CanopyProofOrganizationAccreditationApplicationFact,
  type CanopyProofOrganizationAccreditationAuthoritySnapshot,
  type CanopyProofOrganizationAccreditationControlFact,
  type CanopyProofOrganizationAccreditationDecisionFact,
  type CanopyProofOrganizationAccreditationReviewFact,
} from "./organization-accreditation-authority.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";
import type { CanopyProofAuditEvent } from "./proof-engine.js";

type AccreditationTransaction = Prisma.TransactionClient;

export type CanopyProofOrganizationAccreditationSubjectAuthority = Readonly<{
  actor: CanopyProofOrganizationAccreditationActorSnapshot;
  profileRoot: string;
}>;

export type CanopyProofOrganizationAccreditationGovernanceAuthority = Readonly<{
  actor: CanopyProofOrganizationAccreditationActorSnapshot;
  profileRoot: string;
  policyRoot: string;
}>;

export type CanopyProofOrganizationAccreditationSubjectAuthorityResolver = (
  query: Readonly<{
    organizationId: string;
    actorId: string;
    profileRoot: string;
    scope: readonly string[];
    effectiveAt: string;
  }>,
  transaction: AccreditationTransaction,
) => Promise<CanopyProofOrganizationAccreditationSubjectAuthority>;

export type CanopyProofOrganizationAccreditationGovernanceAuthorityResolver = (
  query: Readonly<{
    operation: "review" | "decision" | "control";
    organizationId: string;
    actorId: string;
    actorOrganizationId: string;
    actorRole: CanopyProofOrganizationAccreditationActorSnapshot["role"];
    profileRoot: string;
    policyRoot: string;
    requiredScope: string;
    effectiveAt: string;
  }>,
  transaction: AccreditationTransaction,
) => Promise<CanopyProofOrganizationAccreditationGovernanceAuthority>;

export type CanopyProofOrganizationAccreditationRepositoryStatus = Readonly<{
  service: "canopyproof-organization-accreditation-authority-repository";
  storage: "postgresql";
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  appendOnly: true;
  forcedRowLevelSecurity: true;
  serializableWrites: true;
  exactRetryRequired: true;
  currentAuthorityReResolved: true;
  independentHumanReviewRequired: true;
  reviewerDeciderSeparationRequired: true;
  explicitAsOfRequired: true;
  compatibilityAccreditationIsNotCanonical: true;
  revocationTerminal: true;
}>;

const operations = {
  application: "organization-accreditation-application.commit",
  review: "organization-accreditation-review.commit",
  decision: "organization-accreditation-decision.commit",
  control: "organization-accreditation-control.commit",
} as const;

const resultTypes = {
  application: "organization_accreditation_application",
  review: "organization_accreditation_review",
  decision: "organization_accreditation_decision",
  control: "organization_accreditation_control",
} as const;

const requiredScopes = {
  review: "organization:accreditation:review",
  decision: "organization:accreditation:decide",
  control: "organization:accreditation:govern",
} as const;

const identifierSchema = z.string().trim().min(1).max(240);
const rootSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const resultTypeSchema = z.enum([
  resultTypes.application,
  resultTypes.review,
  resultTypes.decision,
  resultTypes.control,
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

export class PrismaCanopyProofOrganizationAccreditationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofOrganizationAccreditationRepositoryStatus {
    return {
      service: "canopyproof-organization-accreditation-authority-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      independentHumanReviewRequired: true,
      reviewerDeciderSeparationRequired: true,
      explicitAsOfRequired: true,
      compatibilityAccreditationIsNotCanonical: true,
      revocationTerminal: true,
    };
  }

  async commitApplication(
    factInput: CanopyProofOrganizationAccreditationApplicationFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofOrganizationAccreditationSubjectAuthorityResolver,
  ): Promise<CanopyProofOrganizationAccreditationApplicationFact> {
    const fact = parseCanopyProofOrganizationAccreditationApplicationFact(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({ kind: "canopyproof-organization-accreditation-application-commit-v1", fact });
    const receipt = receiptIdentity(fact.submitter.id, operations.application, idempotencyKey);
    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, fact.organizationId, fact.submitter.id);
      await lockCommandAndStream(transaction, receipt, fact.organizationId);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          resultTypes.application,
          fact.id,
          fact.applicationRoot,
          fact.auditEvent.eventRoot,
        );
        return requireApplicationFact(transaction, fact.id);
      }
      const current = await resolveCurrentAuthority(
        {
          organizationId: fact.organizationId,
          actorId: fact.submitter.id,
          profileRoot: fact.profileRoot,
          scope: fact.scope,
          effectiveAt: fact.submittedAt,
        },
        transaction,
      );
      assertSubjectAuthority(current, fact.submitter, fact.profileRoot);
      const service = await loadAuthorityService(transaction, fact.organizationId);
      const rebuilt = service.submitApplication(
        {
          id: fact.id,
          organizationId: fact.organizationId,
          applicationKind: fact.applicationKind,
          ...(fact.priorDecisionId ? { priorDecisionId: fact.priorDecisionId } : {}),
          profileRoot: fact.profileRoot,
          scope: fact.scope,
          evidenceEventRoots: fact.evidenceEventRoots,
          policyRoot: fact.policyRoot,
          requestedValidUntil: fact.requestedValidUntil,
          submittedAt: fact.submittedAt,
        },
        current.actor,
      );
      assertRebuiltFact(rebuilt, fact, "APPLICATION");
      await insertDomainEvent(transaction, fact.organizationId, fact.auditEvent);
      await insertApplicationFact(transaction, fact);
      await insertReceipt(transaction, {
        ...receipt,
        actorId: fact.submitter.id,
        operation: operations.application,
        requestHash,
        resultType: resultTypes.application,
        resultId: fact.id,
        responseHash: fact.applicationRoot,
        auditEventRoot: fact.auditEvent.eventRoot,
        createdAt: fact.submittedAt,
      });
      return requireApplicationFact(transaction, fact.id);
    });
  }

  async commitReview(
    factInput: CanopyProofOrganizationAccreditationReviewFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofOrganizationAccreditationGovernanceAuthorityResolver,
  ): Promise<CanopyProofOrganizationAccreditationReviewFact> {
    const fact = parseCanopyProofOrganizationAccreditationReviewFact(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({ kind: "canopyproof-organization-accreditation-review-commit-v1", fact });
    const receipt = receiptIdentity(fact.reviewer.id, operations.review, idempotencyKey);
    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, fact.organizationId, fact.reviewer.id);
      await lockCommandAndStream(transaction, receipt, fact.organizationId);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(existing, requestHash, resultTypes.review, fact.id, fact.reviewRoot, fact.auditEvent.eventRoot);
        return requireReviewFact(transaction, fact.id);
      }
      const current = await resolveCurrentAuthority(
        {
          operation: "review",
          organizationId: fact.organizationId,
          actorId: fact.reviewer.id,
          actorOrganizationId: fact.reviewer.organizationId,
          actorRole: fact.reviewer.role,
          profileRoot: fact.profileRoot,
          policyRoot: fact.policyRoot,
          requiredScope: requiredScopes.review,
          effectiveAt: fact.reviewedAt,
        },
        transaction,
      );
      assertGovernanceAuthority(current, fact.reviewer, fact.profileRoot, fact.policyRoot, requiredScopes.review);
      const service = await loadAuthorityService(transaction, fact.organizationId);
      const rebuilt = service.reviewApplication(
        {
          id: fact.id,
          organizationId: fact.organizationId,
          applicationId: fact.applicationId,
          profileRoot: fact.profileRoot,
          policyRoot: fact.policyRoot,
          decision: fact.decision,
          reasonCode: fact.reasonCode,
          rationale: fact.rationale,
          conflictDisclosure: fact.conflictDisclosure,
          sourceEventRoots: fact.sourceEventRoots,
          reviewedAt: fact.reviewedAt,
        },
        current.actor,
      );
      assertRebuiltFact(rebuilt, fact, "REVIEW");
      await insertDomainEvent(transaction, fact.organizationId, fact.auditEvent);
      await insertReviewFact(transaction, fact);
      await insertReceipt(transaction, {
        ...receipt,
        actorId: fact.reviewer.id,
        operation: operations.review,
        requestHash,
        resultType: resultTypes.review,
        resultId: fact.id,
        responseHash: fact.reviewRoot,
        auditEventRoot: fact.auditEvent.eventRoot,
        createdAt: fact.reviewedAt,
      });
      return requireReviewFact(transaction, fact.id);
    });
  }

  async commitDecision(
    factInput: CanopyProofOrganizationAccreditationDecisionFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofOrganizationAccreditationGovernanceAuthorityResolver,
  ): Promise<CanopyProofOrganizationAccreditationDecisionFact> {
    const fact = parseCanopyProofOrganizationAccreditationDecisionFact(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({ kind: "canopyproof-organization-accreditation-decision-commit-v1", fact });
    const receipt = receiptIdentity(fact.decider.id, operations.decision, idempotencyKey);
    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, fact.organizationId, fact.decider.id);
      await lockCommandAndStream(transaction, receipt, fact.organizationId);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          resultTypes.decision,
          fact.id,
          fact.decisionRoot,
          fact.auditEvent.eventRoot,
        );
        return requireDecisionFact(transaction, fact.id);
      }
      const current = await resolveCurrentAuthority(
        {
          operation: "decision",
          organizationId: fact.organizationId,
          actorId: fact.decider.id,
          actorOrganizationId: fact.decider.organizationId,
          actorRole: fact.decider.role,
          profileRoot: fact.profileRoot,
          policyRoot: fact.policyRoot,
          requiredScope: requiredScopes.decision,
          effectiveAt: fact.decidedAt,
        },
        transaction,
      );
      assertGovernanceAuthority(current, fact.decider, fact.profileRoot, fact.policyRoot, requiredScopes.decision);
      const service = await loadAuthorityService(transaction, fact.organizationId);
      const rebuilt = service.decideApplication(
        {
          id: fact.id,
          organizationId: fact.organizationId,
          applicationId: fact.applicationId,
          acceptedReviewId: fact.acceptedReviewId,
          profileRoot: fact.profileRoot,
          policyRoot: fact.policyRoot,
          scope: fact.scope,
          decision: fact.decision,
          reasonCode: fact.reasonCode,
          rationale: fact.rationale,
          sourceEventRoots: fact.sourceEventRoots,
          validUntil: fact.validUntil,
          decidedAt: fact.decidedAt,
        },
        current.actor,
      );
      assertRebuiltFact(rebuilt, fact, "DECISION");
      await insertDomainEvent(transaction, fact.organizationId, fact.auditEvent);
      await insertDecisionFact(transaction, fact);
      await insertReceipt(transaction, {
        ...receipt,
        actorId: fact.decider.id,
        operation: operations.decision,
        requestHash,
        resultType: resultTypes.decision,
        resultId: fact.id,
        responseHash: fact.decisionRoot,
        auditEventRoot: fact.auditEvent.eventRoot,
        createdAt: fact.decidedAt,
      });
      return requireDecisionFact(transaction, fact.id);
    });
  }

  async commitControl(
    factInput: CanopyProofOrganizationAccreditationControlFact,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofOrganizationAccreditationGovernanceAuthorityResolver,
  ): Promise<CanopyProofOrganizationAccreditationControlFact> {
    const fact = parseCanopyProofOrganizationAccreditationControlFact(factInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const requestHash = hashJson({ kind: "canopyproof-organization-accreditation-control-commit-v1", fact });
    const receipt = receiptIdentity(fact.governor.id, operations.control, idempotencyKey);
    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, fact.organizationId, fact.governor.id);
      await lockCommandAndStream(transaction, receipt, fact.organizationId);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(existing, requestHash, resultTypes.control, fact.id, fact.controlRoot, fact.auditEvent.eventRoot);
        return requireControlFact(transaction, fact.id);
      }
      const application = await requireApplicationForDecision(transaction, fact.decisionId);
      const current = await resolveCurrentAuthority(
        {
          operation: "control",
          organizationId: fact.organizationId,
          actorId: fact.governor.id,
          actorOrganizationId: fact.governor.organizationId,
          actorRole: fact.governor.role,
          profileRoot: application.profileRoot,
          policyRoot: application.policyRoot,
          requiredScope: requiredScopes.control,
          effectiveAt: fact.controlledAt,
        },
        transaction,
      );
      assertGovernanceAuthority(
        current,
        fact.governor,
        application.profileRoot,
        application.policyRoot,
        requiredScopes.control,
      );
      const service = await loadAuthorityService(transaction, fact.organizationId);
      const rebuilt = service.controlDecision(
        {
          id: fact.id,
          organizationId: fact.organizationId,
          decisionId: fact.decisionId,
          action: fact.action,
          reasonCode: fact.reasonCode,
          rationale: fact.rationale,
          evidenceEventRoots: fact.evidenceEventRoots,
          controlledAt: fact.controlledAt,
        },
        current.actor,
      );
      assertRebuiltFact(rebuilt, fact, "CONTROL");
      await insertDomainEvent(transaction, fact.organizationId, fact.auditEvent);
      await insertControlFact(transaction, fact);
      await insertReceipt(transaction, {
        ...receipt,
        actorId: fact.governor.id,
        operation: operations.control,
        requestHash,
        resultType: resultTypes.control,
        resultId: fact.id,
        responseHash: fact.controlRoot,
        auditEventRoot: fact.auditEvent.eventRoot,
        createdAt: fact.controlledAt,
      });
      return requireControlFact(transaction, fact.id);
    });
  }

  async getProjection(
    organizationIdInput: string,
    applicationIdInput: string,
    asOfInput: string,
    actorIdInput: string,
  ) {
    const organizationId = identifierSchema.parse(organizationIdInput);
    const applicationId = identifierSchema.parse(applicationIdInput);
    const asOf = timestampSchema.parse(asOfInput);
    const actorId = identifierSchema.parse(actorIdInput);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId, actorId);
        return (await loadAuthorityService(transaction, organizationId)).getProjection(
          organizationId,
          applicationId,
          asOf,
        );
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

  private async withSerializableRetry<T>(operation: (transaction: AccreditationTransaction) => Promise<T>) {
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
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_DURABLE_WRITE_UNAVAILABLE");
  }
}

async function loadAuthorityService(transaction: AccreditationTransaction, organizationId: string) {
  const snapshot = await loadAuthoritySnapshot(transaction, organizationId);
  if (
    snapshot.applicationFacts.length === 0 &&
    snapshot.reviewFacts.length === 0 &&
    snapshot.decisionFacts.length === 0 &&
    snapshot.controlFacts.length === 0
  ) {
    return new CanopyProofOrganizationAccreditationAuthorityService();
  }
  return CanopyProofOrganizationAccreditationAuthorityService.fromAuthoritySnapshot(snapshot);
}

async function loadAuthoritySnapshot(
  transaction: AccreditationTransaction,
  organizationId: string,
): Promise<CanopyProofOrganizationAccreditationAuthoritySnapshot> {
  const [applicationRows, reviewRows, decisionRows, controlRows] = await Promise.all([
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM organizations.organization_accreditation_application_facts
      WHERE organization_id = ${organizationId}
      ORDER BY organization_accreditation_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM organizations.organization_accreditation_review_facts
      WHERE organization_id = ${organizationId}
      ORDER BY organization_accreditation_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM organizations.organization_accreditation_decision_facts
      WHERE organization_id = ${organizationId}
      ORDER BY organization_accreditation_sequence
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, fact_record, audit_event_root
      FROM organizations.organization_accreditation_control_facts
      WHERE organization_id = ${organizationId}
      ORDER BY organization_accreditation_sequence
    `),
  ]);
  if (applicationRows.length + reviewRows.length + decisionRows.length + controlRows.length > 4_096) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_HISTORY_LIMIT_EXCEEDED");
  }
  return {
    applicationFacts: applicationRows.map((row) =>
      parseFactRow(row, parseCanopyProofOrganizationAccreditationApplicationFact),
    ),
    reviewFacts: reviewRows.map((row) => parseFactRow(row, parseCanopyProofOrganizationAccreditationReviewFact)),
    decisionFacts: decisionRows.map((row) =>
      parseFactRow(row, parseCanopyProofOrganizationAccreditationDecisionFact),
    ),
    controlFacts: controlRows.map((row) =>
      parseFactRow(row, parseCanopyProofOrganizationAccreditationControlFact),
    ),
  };
}

function parseFactRow<T extends { id: string; auditEvent: CanopyProofAuditEvent }>(
  input: unknown,
  parse: (value: unknown) => T,
) {
  const row = factRowSchema.parse(input);
  const fact = parse(row.fact_record);
  if (fact.id !== row.id || fact.auditEvent.eventRoot !== row.audit_event_root) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_FACT_COLUMNS_INVALID");
  }
  return fact;
}

async function requireApplicationFact(transaction: AccreditationTransaction, factId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, fact_record, audit_event_root
    FROM organizations.organization_accreditation_application_facts WHERE id = ${factId}
  `);
  if (rows.length !== 1) throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_APPLICATION_NOT_FOUND:${factId}`);
  return parseFactRow(rows[0], parseCanopyProofOrganizationAccreditationApplicationFact);
}

async function requireReviewFact(transaction: AccreditationTransaction, factId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, fact_record, audit_event_root
    FROM organizations.organization_accreditation_review_facts WHERE id = ${factId}
  `);
  if (rows.length !== 1) throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_REVIEW_NOT_FOUND:${factId}`);
  return parseFactRow(rows[0], parseCanopyProofOrganizationAccreditationReviewFact);
}

async function requireDecisionFact(transaction: AccreditationTransaction, factId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, fact_record, audit_event_root
    FROM organizations.organization_accreditation_decision_facts WHERE id = ${factId}
  `);
  if (rows.length !== 1) throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_DECISION_NOT_FOUND:${factId}`);
  return parseFactRow(rows[0], parseCanopyProofOrganizationAccreditationDecisionFact);
}

async function requireControlFact(transaction: AccreditationTransaction, factId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, fact_record, audit_event_root
    FROM organizations.organization_accreditation_control_facts WHERE id = ${factId}
  `);
  if (rows.length !== 1) throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_CONTROL_NOT_FOUND:${factId}`);
  return parseFactRow(rows[0], parseCanopyProofOrganizationAccreditationControlFact);
}

async function requireApplicationForDecision(transaction: AccreditationTransaction, decisionId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT application.id, application.fact_record, application.audit_event_root
    FROM organizations.organization_accreditation_decision_facts decision
    JOIN organizations.organization_accreditation_application_facts application
      ON application.id = decision.application_id
    WHERE decision.id = ${decisionId}
  `);
  if (rows.length !== 1) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_DECISION_APPLICATION_NOT_FOUND:${decisionId}`);
  }
  return parseFactRow(rows[0], parseCanopyProofOrganizationAccreditationApplicationFact);
}

async function insertApplicationFact(
  transaction: AccreditationTransaction,
  fact: CanopyProofOrganizationAccreditationApplicationFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.organization_accreditation_application_facts (
        id, organization_id, application_kind, prior_decision_id, prior_decision_root,
        profile_root, scope, scope_root, policy_root, requested_valid_until,
        submitter_organization_id, submitter_id, submitter_snapshot, submitted_at,
        organization_accreditation_sequence, previous_event_root, command_hash,
        application_hash, application_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.applicationKind}, ${fact.priorDecisionId ?? null},
        ${fact.priorDecisionRoot ?? null}, ${fact.profileRoot}, ${[...fact.scope]}, ${fact.scopeRoot},
        ${fact.policyRoot}, ${asDate(fact.requestedValidUntil)}, ${fact.submitter.organizationId},
        ${fact.submitter.id}, ${JSON.stringify(fact.submitter)}::jsonb, ${asDate(fact.submittedAt)},
        ${fact.organizationAccreditationSequence}, ${fact.previousEventRoot}, ${fact.commandHash},
        ${fact.applicationHash}, ${fact.applicationRoot}, ${fact.auditEvent.eventRoot},
        ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertReviewFact(
  transaction: AccreditationTransaction,
  fact: CanopyProofOrganizationAccreditationReviewFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.organization_accreditation_review_facts (
        id, organization_id, application_id, application_root, profile_root, policy_root,
        scope_root, decision, reason_code, reviewer_organization_id, reviewer_id,
        reviewer_snapshot, reviewed_at, organization_accreditation_sequence,
        previous_event_root, command_hash, review_hash, review_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.applicationId}, ${fact.applicationRoot},
        ${fact.profileRoot}, ${fact.policyRoot}, ${fact.scopeRoot}, ${fact.decision}, ${fact.reasonCode},
        ${fact.reviewer.organizationId}, ${fact.reviewer.id}, ${JSON.stringify(fact.reviewer)}::jsonb,
        ${asDate(fact.reviewedAt)}, ${fact.organizationAccreditationSequence}, ${fact.previousEventRoot},
        ${fact.commandHash}, ${fact.reviewHash}, ${fact.reviewRoot}, ${fact.auditEvent.eventRoot},
        ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertDecisionFact(
  transaction: AccreditationTransaction,
  fact: CanopyProofOrganizationAccreditationDecisionFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.organization_accreditation_decision_facts (
        id, organization_id, application_id, application_root, accepted_review_id,
        accepted_review_root, profile_root, policy_root, scope, scope_root, decision,
        reason_code, valid_from, valid_until, decider_organization_id, decider_id,
        decider_snapshot, decided_at, organization_accreditation_sequence,
        previous_event_root, command_hash, decision_hash, decision_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.applicationId}, ${fact.applicationRoot},
        ${fact.acceptedReviewId}, ${fact.acceptedReviewRoot}, ${fact.profileRoot}, ${fact.policyRoot},
        ${[...fact.scope]}, ${fact.scopeRoot}, ${fact.decision}, ${fact.reasonCode},
        ${fact.validFrom ? asDate(fact.validFrom) : null}, ${fact.validUntil ? asDate(fact.validUntil) : null},
        ${fact.decider.organizationId}, ${fact.decider.id}, ${JSON.stringify(fact.decider)}::jsonb,
        ${asDate(fact.decidedAt)}, ${fact.organizationAccreditationSequence}, ${fact.previousEventRoot},
        ${fact.commandHash}, ${fact.decisionHash}, ${fact.decisionRoot}, ${fact.auditEvent.eventRoot},
        ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertControlFact(
  transaction: AccreditationTransaction,
  fact: CanopyProofOrganizationAccreditationControlFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO organizations.organization_accreditation_control_facts (
        id, organization_id, decision_id, decision_root, previous_control_id,
        previous_control_root, action, reason_code, governor_organization_id, governor_id,
        governor_snapshot, controlled_at, organization_accreditation_sequence,
        previous_event_root, command_hash, control_hash, control_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.decisionId}, ${fact.decisionRoot},
        ${fact.previousControlId ?? null}, ${fact.previousControlRoot ?? null}, ${fact.action},
        ${fact.reasonCode}, ${fact.governor.organizationId}, ${fact.governor.id},
        ${JSON.stringify(fact.governor)}::jsonb, ${asDate(fact.controlledAt)},
        ${fact.organizationAccreditationSequence}, ${fact.previousEventRoot}, ${fact.commandHash},
        ${fact.controlHash}, ${fact.controlRoot}, ${fact.auditEvent.eventRoot}, ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertDomainEvent(
  transaction: AccreditationTransaction,
  organizationId: string,
  event: CanopyProofAuditEvent,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES (
        ${event.id}, ${`organization-accreditation:${organizationId}`}, ${event.action},
        ${event.actor}, ${event.entityType}, ${event.entityId}, ${event.previousRoot},
        ${event.payloadHash}, ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
      )
    `),
  );
}

async function lockCommandAndStream(
  transaction: AccreditationTransaction,
  receipt: ReturnType<typeof receiptIdentity>,
  organizationId: string,
) {
  await acquireCanopyProofPostgresTransactionLock(
    transaction,
    `organization-accreditation-command:${receipt.id}`,
  );
  await acquireCanopyProofPostgresTransactionLock(
    transaction,
    `organization-accreditation:${organizationId}`,
  );
}

async function readReceipt(transaction: AccreditationTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId}
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_RECEIPT_DUPLICATE");
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
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_IDEMPOTENCY_CONFLICT");
  }
}

async function insertReceipt(
  transaction: AccreditationTransaction,
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
    id: `cp_org_accreditation_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`,
  };
}

function assertSubjectAuthority(
  current: CanopyProofOrganizationAccreditationSubjectAuthority,
  expectedActor: CanopyProofOrganizationAccreditationActorSnapshot,
  expectedProfileRoot: string,
) {
  if (hashJson(current.actor) !== hashJson(expectedActor) || current.profileRoot !== expectedProfileRoot) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_SUBJECT_CURRENT_AUTHORITY_INVALID");
  }
}

function assertGovernanceAuthority(
  current: CanopyProofOrganizationAccreditationGovernanceAuthority,
  expectedActor: CanopyProofOrganizationAccreditationActorSnapshot,
  expectedProfileRoot: string,
  expectedPolicyRoot: string,
  requiredScope: string,
) {
  if (
    hashJson(current.actor) !== hashJson(expectedActor) ||
    current.profileRoot !== expectedProfileRoot ||
    current.policyRoot !== expectedPolicyRoot ||
    !current.actor.accreditationScope.includes(requiredScope)
  ) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_GOVERNANCE_CURRENT_AUTHORITY_INVALID");
  }
}

function assertRebuiltFact<T>(rebuilt: T, expected: T, label: string) {
  if (hashJson(rebuilt) !== hashJson(expected)) {
    throw new Error(`CANOPYPROOF_ORGANIZATION_ACCREDITATION_${label}_REBUILD_MISMATCH`);
  }
}

async function setContext(
  transaction: AccreditationTransaction,
  organizationIdInput: string,
  actorIdInput: string,
) {
  const organizationId = identifierSchema.parse(organizationIdInput);
  const actorId = identifierSchema.parse(actorIdInput);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
}

function asDate(value: string) {
  const parsed = timestampSchema.parse(value);
  const date = new Date(parsed);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== parsed) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) {
    throw new Error("CANOPYPROOF_ORGANIZATION_ACCREDITATION_MUTATION_CARDINALITY_INVALID");
  }
}
