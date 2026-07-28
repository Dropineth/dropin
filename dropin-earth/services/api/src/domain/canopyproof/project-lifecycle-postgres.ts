import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  buildCanopyProofProjectLifecycleControl,
  buildCanopyProofProjectLifecycleRegistration,
  buildCanopyProofProjectLifecycleReview,
  buildCanopyProofProjectLifecycleTransition,
  canopyProofProjectLifecycleScopes,
  parseCanopyProofProjectLifecycleControl,
  parseCanopyProofProjectLifecycleRegistration,
  parseCanopyProofProjectLifecycleReview,
  parseCanopyProofProjectLifecycleTransition,
  replayCanopyProofProjectLifecycle,
  type CanopyProofProjectLifecycleActorSnapshot,
  type CanopyProofProjectLifecycleCanonicalStage,
  type CanopyProofProjectLifecycleControlAction,
  type CanopyProofProjectLifecycleControlFact,
  type CanopyProofProjectLifecycleProjection,
  type CanopyProofProjectLifecycleRecord,
  type CanopyProofProjectLifecycleRegistrationFact,
  type CanopyProofProjectLifecycleReviewFact,
  type CanopyProofProjectLifecycleTransitionFact,
} from "./project-lifecycle-authority.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";
import type { CanopyProofAuditEvent } from "./proof-engine.js";

type ProjectLifecycleTransaction = Prisma.TransactionClient;
type ProjectStatus = CanopyProofProjectLifecycleRegistrationFact["projectStatus"];
type RecordKind = CanopyProofProjectLifecycleRecord["kind"];

export type CanopyProofProjectLifecycleAuthorityQuery = Readonly<{
  operation: "register" | "review" | "transition" | "control";
  organizationId: string;
  projectId: string;
  generation: number;
  actorId: string;
  actorOrganizationId: string;
  actorRole: CanopyProofProjectLifecycleActorSnapshot["role"];
  requiredScope: string;
  projectAuthorityRoot: string;
  projectStatus: ProjectStatus;
  policyId: string;
  policyRoot: string;
  transitionFromStage: CanopyProofProjectLifecycleCanonicalStage | null;
  transitionToStage: CanopyProofProjectLifecycleCanonicalStage | null;
  controlAction: CanopyProofProjectLifecycleControlAction | null;
  monitoringPlanRoot: string;
  sourceKind: "funding" | "proof" | "monitoring" | "closure" | null;
  sourceAuthorityRoot: string | null;
  restorationAuthorityRoot: string | null;
  effectiveAt: string;
}>;

export type CanopyProofProjectLifecycleCurrentAuthority = Readonly<{
  actor: CanopyProofProjectLifecycleActorSnapshot;
  projectAuthorityRoot: string;
  projectStatus: ProjectStatus;
  policyRoot: string;
  sourceAuthorityRoot: string | null;
  restorationAuthorityRoot: string | null;
}>;

export type CanopyProofProjectLifecycleAuthorityResolver = (
  query: CanopyProofProjectLifecycleAuthorityQuery,
  transaction: ProjectLifecycleTransaction,
) => Promise<CanopyProofProjectLifecycleCurrentAuthority>;

export type CanopyProofProjectLifecycleRepositoryStatus = Readonly<{
  service: "canopyproof-project-lifecycle-authority-repository";
  storage: "postgresql";
  routeMounted: false;
  schedulerMounted: false;
  productionActivationEnabled: false;
  appendOnly: true;
  forcedRowLevelSecurity: true;
  serializableWrites: true;
  exactRetryRequired: true;
  currentAuthorityReResolved: true;
  canonicalAccreditationRequired: true;
  compatibilityProjectStatusIsInputOnly: true;
  adverseStateNeverFallsBack: true;
}>;

const operations = {
  registration: "project-lifecycle-registration.commit",
  review: "project-lifecycle-review.commit",
  transition: "project-lifecycle-transition.commit",
  control: "project-lifecycle-control.commit",
} as const;
const resultTypes = {
  registration: "project_lifecycle_registration",
  review: "project_lifecycle_review",
  transition: "project_lifecycle_transition",
  control: "project_lifecycle_control",
} as const;

const identifierSchema = z.string().trim().min(1).max(240);
const rootSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const resultTypeSchema = z.enum([
  resultTypes.registration,
  resultTypes.review,
  resultTypes.transition,
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
    project_sequence: z.coerce.number().int().positive(),
    fact_record: z.unknown(),
    fact_root: rootSchema,
    audit_event_root: rootSchema,
  })
  .strict();

export class PrismaCanopyProofProjectLifecycleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofProjectLifecycleRepositoryStatus {
    return {
      service: "canopyproof-project-lifecycle-authority-repository",
      storage: "postgresql",
      routeMounted: false,
      schedulerMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      forcedRowLevelSecurity: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentAuthorityReResolved: true,
      canonicalAccreditationRequired: true,
      compatibilityProjectStatusIsInputOnly: true,
      adverseStateNeverFallsBack: true,
    };
  }

  async commitRegistration(
    factInput: CanopyProofProjectLifecycleRegistrationFact,
    idempotencyKey: string,
    resolveCurrentAuthority: CanopyProofProjectLifecycleAuthorityResolver,
  ) {
    return this.commitRecord(
      { kind: "registration", registration: parseCanopyProofProjectLifecycleRegistration(factInput) },
      idempotencyKey,
      resolveCurrentAuthority,
    ).then((record) => {
      if (record.kind !== "registration") throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_RESULT_KIND_INVALID");
      return record.registration;
    });
  }

  async commitReview(
    factInput: CanopyProofProjectLifecycleReviewFact,
    idempotencyKey: string,
    resolveCurrentAuthority: CanopyProofProjectLifecycleAuthorityResolver,
  ) {
    return this.commitRecord(
      { kind: "review", review: parseCanopyProofProjectLifecycleReview(factInput) },
      idempotencyKey,
      resolveCurrentAuthority,
    ).then((record) => {
      if (record.kind !== "review") throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_RESULT_KIND_INVALID");
      return record.review;
    });
  }

  async commitTransition(
    factInput: CanopyProofProjectLifecycleTransitionFact,
    idempotencyKey: string,
    resolveCurrentAuthority: CanopyProofProjectLifecycleAuthorityResolver,
  ) {
    return this.commitRecord(
      { kind: "transition", transition: parseCanopyProofProjectLifecycleTransition(factInput) },
      idempotencyKey,
      resolveCurrentAuthority,
    ).then((record) => {
      if (record.kind !== "transition") throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_RESULT_KIND_INVALID");
      return record.transition;
    });
  }

  async commitControl(
    factInput: CanopyProofProjectLifecycleControlFact,
    idempotencyKey: string,
    resolveCurrentAuthority: CanopyProofProjectLifecycleAuthorityResolver,
  ) {
    return this.commitRecord(
      { kind: "control", control: parseCanopyProofProjectLifecycleControl(factInput) },
      idempotencyKey,
      resolveCurrentAuthority,
    ).then((record) => {
      if (record.kind !== "control") throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_RESULT_KIND_INVALID");
      return record.control;
    });
  }

  async getProjection(
    organizationIdInput: string,
    projectIdInput: string,
    evaluatedAtInput: string,
    actorIdInput: string,
  ): Promise<CanopyProofProjectLifecycleProjection | undefined> {
    const organizationId = identifierSchema.parse(organizationIdInput);
    const projectId = identifierSchema.parse(projectIdInput);
    const evaluatedAt = canonicalTimestamp(evaluatedAtInput);
    const actorId = identifierSchema.parse(actorIdInput);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId, actorId);
        const history = await loadHistory(transaction, organizationId, projectId);
        return replayCanopyProofProjectLifecycle(history, evaluatedAt, true);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async getHistory(organizationIdInput: string, projectIdInput: string, actorIdInput: string) {
    const organizationId = identifierSchema.parse(organizationIdInput);
    const projectId = identifierSchema.parse(projectIdInput);
    const actorId = identifierSchema.parse(actorIdInput);
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId, actorId);
        return loadHistory(transaction, organizationId, projectId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async commitRecord(
    record: CanopyProofProjectLifecycleRecord,
    idempotencyKeyInput: string,
    resolveCurrentAuthority: CanopyProofProjectLifecycleAuthorityResolver,
  ): Promise<CanopyProofProjectLifecycleRecord> {
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const kind = record.kind;
    const actor = recordActor(record);
    const organizationId = recordOrganizationId(record);
    const projectId = recordProjectId(record);
    const operation = operations[kind];
    const resultType = resultTypes[kind];
    const responseHash = recordRoot(record);
    const requestHash = hashJson({ kind: `canopyproof-${operation}-v1`, record });
    const receipt = receiptIdentity(actor.id, operation, idempotencyKey);

    return this.withSerializableRetry(async (transaction) => {
      await setContext(transaction, organizationId, actor.id);
      await lockCommandAndStream(transaction, receipt.id, organizationId, projectId);
      const existing = await readReceipt(transaction, receipt.id);
      if (existing) {
        assertReceipt(
          existing,
          requestHash,
          resultType,
          recordId(record),
          responseHash,
          recordAuditEvent(record).eventRoot,
        );
        return requireRecord(transaction, recordId(record), kind);
      }

      const history = await loadHistory(transaction, organizationId, projectId);
      const registration = currentRegistration(record, history);
      const query = authorityQuery(record, registration);
      const current = await resolveCurrentAuthority(query, transaction);
      assertCurrentAuthority(current, query, actor);
      const rebuilt = rebuildRecord(record, history, current.actor);
      if (hashJson(rebuilt) !== hashJson(record)) {
        throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_REBUILD_MISMATCH");
      }

      await insertDomainEvent(transaction, organizationId, projectId, recordAuditEvent(record));
      await insertRecord(transaction, record);
      await insertReceipt(transaction, {
        ...receipt,
        actorId: actor.id,
        operation,
        requestHash,
        resultType,
        resultId: recordId(record),
        responseHash,
        auditEventRoot: recordAuditEvent(record).eventRoot,
        createdAt: recordTimestamp(record),
      });

      const stored = await requireRecord(transaction, recordId(record), kind);
      const storedHistory = await loadHistory(transaction, organizationId, projectId);
      replayCanopyProofProjectLifecycle(storedHistory, recordTimestamp(record));
      return stored;
    });
  }

  private async withSerializableRetry<T>(operation: (transaction: ProjectLifecycleTransaction) => Promise<T>) {
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
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_DURABLE_WRITE_UNAVAILABLE");
  }
}

function authorityQuery(
  record: CanopyProofProjectLifecycleRecord,
  registration: CanopyProofProjectLifecycleRegistrationFact,
): CanopyProofProjectLifecycleAuthorityQuery {
  const actor = recordActor(record);
  const source = record.kind === "transition" ? record.transition.source : undefined;
  const restorationAuthorityRoot =
    record.kind === "control" && record.control.action === "restore"
      ? record.control.restorationAuthorityRoot ?? null
      : null;
  return {
    operation:
      record.kind === "registration"
        ? "register"
        : record.kind === "review"
          ? "review"
          : record.kind === "transition"
            ? "transition"
            : "control",
    organizationId: registration.organizationId,
    projectId: registration.projectId,
    generation: registration.generation,
    actorId: actor.id,
    actorOrganizationId: actor.organizationId,
    actorRole: actor.role,
    requiredScope:
      record.kind === "registration"
        ? canopyProofProjectLifecycleScopes.propose
        : record.kind === "review"
          ? canopyProofProjectLifecycleScopes.review
          : canopyProofProjectLifecycleScopes.govern,
    projectAuthorityRoot: registration.projectAuthorityRoot,
    projectStatus: registration.projectStatus,
    policyId: registration.policyId,
    policyRoot: registration.policyRoot,
    transitionFromStage:
      record.kind === "transition" ? record.transition.fromStage : null,
    transitionToStage:
      record.kind === "transition" ? record.transition.toStage : null,
    controlAction: record.kind === "control" ? record.control.action : null,
    monitoringPlanRoot: registration.monitoringPlan.monitoringPlanRoot,
    sourceKind: source?.kind ?? null,
    sourceAuthorityRoot: source?.sourceAuthorityRoot ?? null,
    restorationAuthorityRoot,
    effectiveAt: recordTimestamp(record),
  };
}

function assertCurrentAuthority(
  current: CanopyProofProjectLifecycleCurrentAuthority,
  query: CanopyProofProjectLifecycleAuthorityQuery,
  expectedActor: unknown,
) {
  if (
    hashJson(current.actor) !== hashJson(expectedActor) ||
    current.projectAuthorityRoot !== query.projectAuthorityRoot ||
    current.projectStatus !== query.projectStatus ||
    current.policyRoot !== query.policyRoot ||
    current.sourceAuthorityRoot !== query.sourceAuthorityRoot ||
    current.restorationAuthorityRoot !== query.restorationAuthorityRoot
  ) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_CURRENT_AUTHORITY_STALE");
  }
}

function rebuildRecord(
  record: CanopyProofProjectLifecycleRecord,
  history: readonly CanopyProofProjectLifecycleRecord[],
  actor: CanopyProofProjectLifecycleActorSnapshot,
): CanopyProofProjectLifecycleRecord {
  if (record.kind === "registration") {
    const fact = record.registration;
    return {
      kind: "registration",
      registration: buildCanopyProofProjectLifecycleRegistration(
        registrationInput(fact),
        actor,
        history,
      ),
    };
  }
  if (record.kind === "review") {
    const fact = record.review;
    return {
      kind: "review",
      review: buildCanopyProofProjectLifecycleReview(
        {
          registrationId: fact.registrationId,
          registrationRoot: fact.registrationRoot,
          decision: fact.decision,
          reasonCode: fact.reasonCode,
          rationale: fact.rationale,
          reviewedAt: fact.reviewedAt,
        },
        actor,
        history,
      ),
    };
  }
  if (record.kind === "transition") {
    const fact = record.transition;
    return {
      kind: "transition",
      transition: buildCanopyProofProjectLifecycleTransition(
        {
          fromStage: fact.fromStage,
          toStage: fact.toStage,
          source: fact.source,
          reasonCode: fact.reasonCode,
          rationale: fact.rationale,
          transitionedAt: fact.transitionedAt,
        },
        actor,
        history,
      ),
    };
  }
  const fact = record.control;
  return {
    kind: "control",
    control: buildCanopyProofProjectLifecycleControl(
      {
        action: fact.action,
        reasonCode: fact.reasonCode,
        reasonRoot: fact.reasonRoot,
        rationale: fact.rationale,
        ...(fact.restoresControlRoot ? { restoresControlRoot: fact.restoresControlRoot } : {}),
        ...(fact.restorationAuthorityRoot
          ? { restorationAuthorityRoot: fact.restorationAuthorityRoot }
          : {}),
        controlledAt: fact.controlledAt,
      },
      actor,
      history,
    ),
  };
}

function registrationInput(fact: CanopyProofProjectLifecycleRegistrationFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    projectAuthorityRoot: fact.projectAuthorityRoot,
    projectStatus: fact.projectStatus,
    baseline: {
      baselineId: fact.baseline.baselineId,
      observedAt: fact.baseline.observedAt,
      evidenceRoots: fact.baseline.evidenceRoots,
      satelliteRoots: fact.baseline.satelliteRoots,
      metricRoots: fact.baseline.metricRoots,
      limitations: fact.baseline.limitations,
    },
    intervention: {
      interventionId: fact.intervention.interventionId,
      interventionType: fact.intervention.interventionType,
      startsAt: fact.intervention.startsAt,
      ...(fact.intervention.endsAt ? { endsAt: fact.intervention.endsAt } : {}),
      targetAreaSquareMeters: fact.intervention.targetAreaSquareMeters,
      targetTreeCount: fact.intervention.targetTreeCount,
      methodologyRoot: fact.intervention.methodologyRoot,
      evidenceRoots: fact.intervention.evidenceRoots,
    },
    monitoringPlan: {
      monitoringPlanId: fact.monitoringPlan.monitoringPlanId,
      startsAt: fact.monitoringPlan.startsAt,
      endsAt: fact.monitoringPlan.endsAt,
      cadenceDays: fact.monitoringPlan.cadenceDays,
      indicatorCodes: fact.monitoringPlan.indicatorCodes,
      evidenceRequirementCodes: fact.monitoringPlan.evidenceRequirementCodes,
      responsibleOrganizationId: fact.monitoringPlan.responsibleOrganizationId,
      escalationPolicyRoot: fact.monitoringPlan.escalationPolicyRoot,
    },
    policyId: fact.policyId,
    policyVersion: fact.policyVersion,
    policyRoot: fact.policyRoot,
    validFrom: fact.validFrom,
    validUntil: fact.validUntil,
    registeredAt: fact.registeredAt,
  };
}

async function loadHistory(
  transaction: ProjectLifecycleTransaction,
  organizationId: string,
  projectId: string,
): Promise<CanopyProofProjectLifecycleRecord[]> {
  const [registrationRows, reviewRows, transitionRows, controlRows] = await Promise.all([
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, project_sequence, fact_record, registration_root AS fact_root, audit_event_root
      FROM projects.project_lifecycle_registration_facts
      WHERE organization_id = ${organizationId} AND project_id = ${projectId}
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, project_sequence, fact_record, review_root AS fact_root, audit_event_root
      FROM projects.project_lifecycle_review_facts
      WHERE organization_id = ${organizationId} AND project_id = ${projectId}
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, project_sequence, fact_record, transition_root AS fact_root, audit_event_root
      FROM projects.project_lifecycle_transition_facts
      WHERE organization_id = ${organizationId} AND project_id = ${projectId}
    `),
    transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id, project_sequence, fact_record, control_root AS fact_root, audit_event_root
      FROM projects.project_lifecycle_control_facts
      WHERE organization_id = ${organizationId} AND project_id = ${projectId}
    `),
  ]);
  if (registrationRows.length + reviewRows.length + transitionRows.length + controlRows.length > 4_096) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_HISTORY_LIMIT_EXCEEDED");
  }
  return [
    ...registrationRows.map((row) => parseFactRow(row, "registration")),
    ...reviewRows.map((row) => parseFactRow(row, "review")),
    ...transitionRows.map((row) => parseFactRow(row, "transition")),
    ...controlRows.map((row) => parseFactRow(row, "control")),
  ].sort((left, right) => recordSequence(left) - recordSequence(right));
}

function parseFactRow(input: unknown, kind: RecordKind): CanopyProofProjectLifecycleRecord {
  const row = factRowSchema.parse(input);
  const record = parseRecord(kind, row.fact_record);
  if (
    recordId(record) !== row.id ||
    recordSequence(record) !== row.project_sequence ||
    recordRoot(record) !== row.fact_root ||
    recordAuditEvent(record).eventRoot !== row.audit_event_root
  ) {
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_FACT_COLUMNS_INVALID");
  }
  return record;
}

function parseRecord(kind: RecordKind, input: unknown): CanopyProofProjectLifecycleRecord {
  if (kind === "registration") {
    return { kind, registration: parseCanopyProofProjectLifecycleRegistration(input) };
  }
  if (kind === "review") return { kind, review: parseCanopyProofProjectLifecycleReview(input) };
  if (kind === "transition") {
    return { kind, transition: parseCanopyProofProjectLifecycleTransition(input) };
  }
  return { kind, control: parseCanopyProofProjectLifecycleControl(input) };
}

async function requireRecord(transaction: ProjectLifecycleTransaction, id: string, kind: RecordKind) {
  const relation = {
    registration: Prisma.raw("projects.project_lifecycle_registration_facts"),
    review: Prisma.raw("projects.project_lifecycle_review_facts"),
    transition: Prisma.raw("projects.project_lifecycle_transition_facts"),
    control: Prisma.raw("projects.project_lifecycle_control_facts"),
  }[kind];
  const rootColumn = {
    registration: Prisma.raw("registration_root"),
    review: Prisma.raw("review_root"),
    transition: Prisma.raw("transition_root"),
    control: Prisma.raw("control_root"),
  }[kind];
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT id, project_sequence, fact_record, ${rootColumn} AS fact_root, audit_event_root
    FROM ${relation} WHERE id = ${id}
  `);
  if (rows.length !== 1) throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_FACT_NOT_FOUND");
  return parseFactRow(rows[0], kind);
}

async function insertRecord(transaction: ProjectLifecycleTransaction, record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return insertRegistration(transaction, record.registration);
  if (record.kind === "review") return insertReview(transaction, record.review);
  if (record.kind === "transition") return insertTransition(transaction, record.transition);
  return insertControl(transaction, record.control);
}

async function insertRegistration(
  transaction: ProjectLifecycleTransaction,
  fact: CanopyProofProjectLifecycleRegistrationFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO projects.project_lifecycle_registration_facts (
        id, organization_id, project_id, generation, project_sequence,
        project_authority_root, project_status, policy_root, proposer_id,
        proposer_organization_id, proposer_authority_root, registered_at, valid_until,
        previous_event_root, command_hash, registration_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.generation},
        ${fact.projectSequence}, ${fact.projectAuthorityRoot}, ${fact.projectStatus},
        ${fact.policyRoot}, ${fact.proposer.id}, ${fact.proposer.organizationId},
        ${fact.proposer.authorityRoot}, ${asDate(fact.registeredAt)}, ${asDate(fact.validUntil)},
        ${fact.previousEventRoot}, ${fact.commandHash}, ${fact.registrationRoot},
        ${fact.auditEvent.eventRoot}, ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertReview(
  transaction: ProjectLifecycleTransaction,
  fact: CanopyProofProjectLifecycleReviewFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO projects.project_lifecycle_review_facts (
        id, organization_id, project_id, generation, project_sequence,
        registration_root, decision, reviewer_id, reviewer_organization_id,
        reviewer_authority_root, reviewed_at, previous_event_root, command_hash,
        review_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.generation},
        ${fact.projectSequence}, ${fact.registrationRoot}, ${fact.decision},
        ${fact.reviewer.id}, ${fact.reviewer.organizationId}, ${fact.reviewer.authorityRoot},
        ${asDate(fact.reviewedAt)}, ${fact.previousEventRoot}, ${fact.commandHash},
        ${fact.reviewRoot}, ${fact.auditEvent.eventRoot}, ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertTransition(
  transaction: ProjectLifecycleTransaction,
  fact: CanopyProofProjectLifecycleTransitionFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO projects.project_lifecycle_transition_facts (
        id, organization_id, project_id, generation, project_sequence,
        registration_root, review_root, from_stage, to_stage, source_kind,
        source_authority_root, governor_id, governor_organization_id,
        governor_authority_root, transitioned_at, previous_event_root, command_hash,
        transition_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.generation},
        ${fact.projectSequence}, ${fact.registrationRoot}, ${fact.reviewRoot},
        ${fact.fromStage}, ${fact.toStage}, ${fact.source.kind}, ${fact.source.sourceAuthorityRoot},
        ${fact.governor.id}, ${fact.governor.organizationId}, ${fact.governor.authorityRoot},
        ${asDate(fact.transitionedAt)}, ${fact.previousEventRoot}, ${fact.commandHash},
        ${fact.transitionRoot}, ${fact.auditEvent.eventRoot}, ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertControl(
  transaction: ProjectLifecycleTransaction,
  fact: CanopyProofProjectLifecycleControlFact,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO projects.project_lifecycle_control_facts (
        id, organization_id, project_id, generation, project_sequence,
        registration_root, action, underlying_stage, reason_root,
        restores_control_root, restoration_authority_root, governor_id,
        governor_organization_id, governor_authority_root, controlled_at,
        previous_event_root, command_hash, control_root, audit_event_root, fact_record
      ) VALUES (
        ${fact.id}, ${fact.organizationId}, ${fact.projectId}, ${fact.generation},
        ${fact.projectSequence}, ${fact.registrationRoot}, ${fact.action},
        ${fact.underlyingStage}, ${fact.reasonRoot}, ${fact.restoresControlRoot ?? null},
        ${fact.restorationAuthorityRoot ?? null}, ${fact.governor.id},
        ${fact.governor.organizationId}, ${fact.governor.authorityRoot},
        ${asDate(fact.controlledAt)}, ${fact.previousEventRoot}, ${fact.commandHash},
        ${fact.controlRoot}, ${fact.auditEvent.eventRoot}, ${JSON.stringify(fact)}::jsonb
      )
    `),
  );
}

async function insertDomainEvent(
  transaction: ProjectLifecycleTransaction,
  organizationId: string,
  projectId: string,
  event: CanopyProofAuditEvent,
) {
  requireSingleMutation(
    await transaction.$executeRaw(Prisma.sql`
      INSERT INTO audit.domain_events (
        id, stream_id, action, actor_id, entity_type, entity_id,
        previous_root, payload_hash, event_root, created_at, rationale
      ) VALUES (
        ${event.id}, ${streamId(organizationId, projectId)}, ${event.action}, ${event.actor},
        ${event.entityType}, ${event.entityId}, ${event.previousRoot}, ${event.payloadHash},
        ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
      )
    `),
  );
}

async function lockCommandAndStream(
  transaction: ProjectLifecycleTransaction,
  receiptId: string,
  organizationId: string,
  projectId: string,
) {
  await acquireCanopyProofPostgresTransactionLock(transaction, `project-lifecycle-command:${receiptId}`);
  await acquireCanopyProofPostgresTransactionLock(
    transaction,
    `project-lifecycle:${organizationId}:${projectId}`,
  );
}

async function setContext(
  transaction: ProjectLifecycleTransaction,
  organizationId: string,
  actorId: string,
) {
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organizationId}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actorId}, true)`);
}

async function readReceipt(transaction: ProjectLifecycleTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId}
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_RECEIPT_DUPLICATE");
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
    throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_IDEMPOTENCY_CONFLICT");
  }
}

async function insertReceipt(
  transaction: ProjectLifecycleTransaction,
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
  const idempotencyKeyHash = hashJson({
    kind: "canopyproof-idempotency-key-v1",
    value: idempotencyKey,
  });
  return {
    idempotencyKeyHash,
    id: `cp_project_lifecycle_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`,
  };
}

function currentRegistration(
  record: CanopyProofProjectLifecycleRecord,
  history: readonly CanopyProofProjectLifecycleRecord[],
) {
  if (record.kind === "registration") return record.registration;
  const registration = [...history]
    .reverse()
    .find(
      (candidate): candidate is Extract<CanopyProofProjectLifecycleRecord, { kind: "registration" }> =>
        candidate.kind === "registration" && candidate.registration.generation === recordGeneration(record),
    )?.registration;
  if (!registration) throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_REGISTRATION_NOT_FOUND");
  return registration;
}

function recordActor(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.proposer;
  if (record.kind === "review") return record.review.reviewer;
  if (record.kind === "transition") return record.transition.governor;
  return record.control.governor;
}

function recordOrganizationId(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.organizationId;
  if (record.kind === "review") return record.review.organizationId;
  if (record.kind === "transition") return record.transition.organizationId;
  return record.control.organizationId;
}

function recordProjectId(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.projectId;
  if (record.kind === "review") return record.review.projectId;
  if (record.kind === "transition") return record.transition.projectId;
  return record.control.projectId;
}

function recordGeneration(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.generation;
  if (record.kind === "review") return record.review.generation;
  if (record.kind === "transition") return record.transition.generation;
  return record.control.generation;
}

function recordSequence(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.projectSequence;
  if (record.kind === "review") return record.review.projectSequence;
  if (record.kind === "transition") return record.transition.projectSequence;
  return record.control.projectSequence;
}

function recordTimestamp(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.registeredAt;
  if (record.kind === "review") return record.review.reviewedAt;
  if (record.kind === "transition") return record.transition.transitionedAt;
  return record.control.controlledAt;
}

function recordId(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.id;
  if (record.kind === "review") return record.review.id;
  if (record.kind === "transition") return record.transition.id;
  return record.control.id;
}

function recordRoot(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.registrationRoot;
  if (record.kind === "review") return record.review.reviewRoot;
  if (record.kind === "transition") return record.transition.transitionRoot;
  return record.control.controlRoot;
}

function recordAuditEvent(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.auditEvent;
  if (record.kind === "review") return record.review.auditEvent;
  if (record.kind === "transition") return record.transition.auditEvent;
  return record.control.auditEvent;
}

function streamId(organizationId: string, projectId: string) {
  return `project-lifecycle:${organizationId}:${projectId}`;
}

function canonicalTimestamp(value: string) {
  const parsed = timestampSchema.parse(value);
  const canonical = new Date(parsed).toISOString();
  if (canonical !== parsed) throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_TIMESTAMP_INVALID");
  return canonical;
}

function asDate(value: string) {
  return new Date(canonicalTimestamp(value));
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_PROJECT_LIFECYCLE_MUTATION_CARDINALITY_INVALID");
}
