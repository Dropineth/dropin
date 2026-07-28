import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofEsgMetricAuthorityService,
  type CanopyProofEsgMetricAuthoritySnapshot,
  type CanopyProofEsgMetricDefinitionFact,
  type CanopyProofEsgMetricDefinitionProjection,
  type CanopyProofEsgMetricResultBundle,
  type CanopyProofEsgMetricResultFact,
  type CanopyProofEsgMetricResultProjection,
  type CanopyProofEsgMetricResultSourceFact,
} from "./esg-metric-authority.js";
import type { CanopyProofAuditEvent } from "./proof-engine.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";

type MetricTransaction = Prisma.TransactionClient;

export type CanopyProofEsgMetricRepositoryStatus = {
  readonly service: "canopyproof-esg-metric-repository";
  readonly storage: "postgresql";
  readonly routeMounted: false;
  readonly productionActivationEnabled: false;
  readonly appendOnly: true;
  readonly tenantScoped: true;
  readonly serializableWrites: true;
  readonly exactRetryRequired: true;
  readonly currentMethodologyReResolved: true;
  readonly currentEnvironmentalProofReResolved: true;
  readonly independentHumanReviewRequired: true;
  readonly frameworkPreparationOnly: true;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const factRowSchema = z.object({ fact_record: z.unknown() });
const receiptRowSchema = z.object({
  request_hash: z.string().regex(HASH_PATTERN),
  result_entity_type: z.enum(["esg_metric_definition", "esg_metric_result"]),
  result_entity_id: z.string().min(1),
  response_hash: z.string().regex(HASH_PATTERN),
  audit_event_root: z.string().regex(HASH_PATTERN),
});
const definitionSchema = z.object({
  factType: z.literal("esg_metric_definition"),
  id: z.string().min(1).max(256),
  owner: z.object({ id: z.string().min(1), verificationStatus: z.literal("verified") }).passthrough(),
  slug: z.string().min(1),
  publisher: z.object({ id: z.string().min(1), participantType: z.literal("human") }).passthrough(),
  reviewers: z.array(z.object({ id: z.string().min(1), participantType: z.literal("human") }).passthrough()).min(2),
  commandHash: z.string().regex(HASH_PATTERN),
  definitionRoot: z.string().regex(HASH_PATTERN),
  effectiveAt: z.string().datetime(),
  safety: z.object({ routeMounted: z.literal(false), productionActivationEnabled: z.literal(false) }).passthrough(),
  auditEvent: z.object({ eventRoot: z.string().regex(HASH_PATTERN) }).passthrough(),
}).passthrough();
const resultSchema = z.object({
  factType: z.literal("esg_metric_result"),
  id: z.string().min(1).max(256),
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  definitionId: z.string().min(1),
  calculator: z.object({ id: z.string().min(1), participantType: z.literal("human") }).passthrough(),
  reviewer: z.object({ id: z.string().min(1), participantType: z.literal("human") }).passthrough(),
  sourceRecordIds: z.array(z.string().min(1)).min(1).max(128),
  sourceCount: z.number().int().min(1).max(128),
  commandHash: z.string().regex(HASH_PATTERN),
  resultRoot: z.string().regex(HASH_PATTERN),
  reviewedAt: z.string().datetime(),
  safety: z.object({ routeMounted: z.literal(false), productionActivationEnabled: z.literal(false) }).passthrough(),
  auditEvent: z.object({ eventRoot: z.string().regex(HASH_PATTERN) }).passthrough(),
}).passthrough();
const sourceSchema = z.object({
  factType: z.literal("esg_metric_result_source"),
  id: z.string().min(1).max(256),
  resultId: z.string().min(1),
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  memberIndex: z.number().int().nonnegative(),
  recordId: z.string().min(1),
  memberRoot: z.string().regex(HASH_PATTERN),
  safety: z.object({ routeMounted: z.literal(false), productionActivationEnabled: z.literal(false) }).passthrough(),
}).passthrough();
const eventRowSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
  actor_id: z.string().min(1),
  entity_type: z.enum(["esg_metric_definition", "esg_metric_result"]),
  entity_id: z.string().min(1),
  previous_root: z.string().regex(HASH_PATTERN),
  payload_hash: z.string().regex(HASH_PATTERN),
  event_root: z.string().regex(HASH_PATTERN),
  created_at_value: z.coerce.date(),
  rationale: z.string().min(1),
});
const definitionProjectionRowSchema = z.object({
  owner_organization_id: z.string().min(1),
  slug_value: z.string().min(1),
  definition_id: z.string().min(1),
  definition_root: z.string().regex(HASH_PATTERN),
  state: z.enum(["current", "superseded", "methodology_superseded"]),
  methodology_publication_id: z.string().min(1),
  methodology_publication_root: z.string().regex(HASH_PATTERN),
  evaluated_at_value: z.coerce.date(),
  latest_definition_id: z.string().min(1),
  latest_definition_root: z.string().regex(HASH_PATTERN),
  issue_codes: z.array(z.string()),
  projection_root: z.string().regex(HASH_PATTERN),
  safety: z.unknown(),
});
const resultProjectionRowSchema = z.object({
  organization_id: z.string().min(1),
  project_id: z.string().min(1),
  result_id: z.string().min(1),
  result_root: z.string().regex(HASH_PATTERN),
  definition_id: z.string().min(1),
  definition_root: z.string().regex(HASH_PATTERN),
  state: z.enum([
    "current",
    "definition_superseded",
    "methodology_superseded",
    "source_stale",
    "challenged",
    "revoked",
    "expired",
  ]),
  evaluated_at_value: z.coerce.date(),
  source_count: z.number().int().nonnegative(),
  current_source_count: z.number().int().nonnegative(),
  issue_codes: z.array(z.string()),
  current_source_root: z.string().regex(HASH_PATTERN),
  projection_root: z.string().regex(HASH_PATTERN),
  safety: z.unknown(),
});

export class PrismaCanopyProofEsgMetricRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofEsgMetricRepositoryStatus {
    return {
      service: "canopyproof-esg-metric-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentMethodologyReResolved: true,
      currentEnvironmentalProofReResolved: true,
      independentHumanReviewRequired: true,
      frameworkPreparationOnly: true,
    };
  }

  async commitDefinition(
    definitionInput: CanopyProofEsgMetricDefinitionFact,
    idempotencyKeyInput: string,
  ): Promise<CanopyProofEsgMetricDefinitionFact> {
    const definition = parseDefinition(definitionInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = definition.publisher.id;
    const operation = "esg-metric-definition.commit";
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({ kind: "canopyproof-esg-metric-definition-commit-v1", definition });
    const receiptId = commandReceiptId(actorId, operation, idempotencyKeyHash);

    return this.serializableWrite(async (transaction) => {
      await setContext(transaction, definition.owner.id, actorId);
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `esg-metric-command:${actorId}:${operation}:${idempotencyKeyHash}`,
      );
      const authorityStream = definitionStreamId(definition);
      await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${authorityStream}`);
      const receipt = await readReceipt(transaction, receiptId);
      if (receipt) {
        assertReceipt(receipt, requestHash, "esg_metric_definition", definition.id, definition.definitionRoot, definition.auditEvent.eventRoot);
        return this.requireDefinition(transaction, definition.owner.id, definition.id);
      }
      const snapshot = await this.loadSnapshot(transaction, definition.owner.id);
      assertProposedDefinition(snapshot, definition);
      await insertDomainEvent(transaction, authorityStream, definition.auditEvent);
      await insertDefinition(transaction, definition);
      await insertReceipt(transaction, {
        id: receiptId,
        actorId,
        operation,
        idempotencyKeyHash,
        requestHash,
        entityType: "esg_metric_definition",
        entityId: definition.id,
        responseHash: definition.definitionRoot,
        auditEventRoot: definition.auditEvent.eventRoot,
        createdAt: definition.effectiveAt,
      });
      return this.requireDefinition(transaction, definition.owner.id, definition.id);
    });
  }

  async commitResult(
    bundleInput: CanopyProofEsgMetricResultBundle,
    idempotencyKeyInput: string,
  ): Promise<CanopyProofEsgMetricResultBundle> {
    const bundle = parseBundle(bundleInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = bundle.result.reviewer.id;
    const operation = "esg-metric-result.commit";
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({ kind: "canopyproof-esg-metric-result-commit-v1", bundle });
    const receiptId = commandReceiptId(actorId, operation, idempotencyKeyHash);

    return this.serializableWrite(async (transaction) => {
      await setContext(transaction, bundle.result.organizationId, actorId);
      await acquireCanopyProofPostgresTransactionLock(
        transaction,
        `esg-metric-command:${actorId}:${operation}:${idempotencyKeyHash}`,
      );
      const authorityStream = resultStreamId(bundle.result);
      await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${authorityStream}`);
      const receipt = await readReceipt(transaction, receiptId);
      if (receipt) {
        assertReceipt(receipt, requestHash, "esg_metric_result", bundle.result.id, bundle.result.resultRoot, bundle.result.auditEvent.eventRoot);
        return this.requireResult(transaction, bundle.result.organizationId, bundle.result.id);
      }
      const snapshot = await this.loadSnapshot(transaction, bundle.result.organizationId);
      assertProposedResult(snapshot, bundle);
      await insertDomainEvent(transaction, authorityStream, bundle.result.auditEvent);
      await insertResult(transaction, bundle.result);
      for (const source of bundle.sources) await insertSource(transaction, source);
      await insertReceipt(transaction, {
        id: receiptId,
        actorId,
        operation,
        idempotencyKeyHash,
        requestHash,
        entityType: "esg_metric_result",
        entityId: bundle.result.id,
        responseHash: bundle.result.resultRoot,
        auditEventRoot: bundle.result.auditEvent.eventRoot,
        createdAt: bundle.result.reviewedAt,
      });
      return this.requireResult(transaction, bundle.result.organizationId, bundle.result.id);
    });
  }

  async getDefinition(organizationId: string, definitionId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await setContext(transaction, organizationId);
      return this.requireDefinition(transaction, organizationId, definitionId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async getResult(organizationId: string, resultId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await setContext(transaction, organizationId);
      return this.requireResult(transaction, organizationId, resultId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async loadAuthoritySnapshot(organizationId: string) {
    return this.prisma.$transaction(async (transaction) => {
      await setContext(transaction, organizationId);
      return this.loadSnapshot(transaction, organizationId);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async projectDefinition(
    organizationId: string,
    definitionId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEsgMetricDefinitionProjection> {
    return this.prisma.$transaction(async (transaction) => {
      await setContext(transaction, organizationId);
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT * FROM reporting.esg_metric_definition_projection(${definitionId}, ${asDate(evaluatedAt)})
      `);
      if (rows.length !== 1) throw new Error("CANOPYPROOF_ESG_METRIC_DEFINITION_PROJECTION_CARDINALITY_INVALID");
      const projection = mapDefinitionProjection(rows[0]);
      if (projection.ownerOrganizationId !== organizationId) throw new Error("CANOPYPROOF_ESG_METRIC_ORGANIZATION_SCOPE_MISMATCH");
      return projection;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async projectResult(
    organizationId: string,
    resultId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofEsgMetricResultProjection> {
    return this.prisma.$transaction(async (transaction) => {
      await setContext(transaction, organizationId);
      const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT * FROM reporting.esg_metric_result_projection(${resultId}, ${asDate(evaluatedAt)})
      `);
      if (rows.length !== 1) throw new Error("CANOPYPROOF_ESG_METRIC_RESULT_PROJECTION_CARDINALITY_INVALID");
      const projection = mapResultProjection(rows[0]);
      if (projection.organizationId !== organizationId) throw new Error("CANOPYPROOF_ESG_METRIC_ORGANIZATION_SCOPE_MISMATCH");
      return projection;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  private async serializableWrite<T>(operation: (transaction: MetricTransaction) => Promise<T>): Promise<T> {
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
    throw new Error("CANOPYPROOF_ESG_METRIC_DURABLE_WRITE_UNAVAILABLE");
  }

  private async requireDefinition(transaction: MetricTransaction, organizationId: string, definitionId: string) {
    const service = CanopyProofEsgMetricAuthorityService.fromAuthoritySnapshot(
      await this.loadSnapshot(transaction, organizationId),
    );
    const definition = service.getDefinition(definitionId);
    if (definition.owner.id !== organizationId) throw new Error("CANOPYPROOF_ESG_METRIC_ORGANIZATION_SCOPE_MISMATCH");
    return definition;
  }

  private async requireResult(transaction: MetricTransaction, organizationId: string, resultId: string) {
    const service = CanopyProofEsgMetricAuthorityService.fromAuthoritySnapshot(
      await this.loadSnapshot(transaction, organizationId),
    );
    const bundle = service.getResult(resultId);
    if (bundle.result.organizationId !== organizationId) throw new Error("CANOPYPROOF_ESG_METRIC_ORGANIZATION_SCOPE_MISMATCH");
    return bundle;
  }

  private async loadSnapshot(
    transaction: MetricTransaction,
    organizationId: string,
  ): Promise<CanopyProofEsgMetricAuthoritySnapshot> {
    const organizationRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id FROM organizations.organizations WHERE id = ${organizationId} LIMIT 1
    `);
    if (organizationRows.length !== 1) throw new Error("CANOPYPROOF_ESG_METRIC_ORGANIZATION_SCOPE_MISMATCH");
    const [definitionRows, resultRows, sourceRows, eventRows] = await Promise.all([
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record FROM reporting.esg_metric_definition_facts
        WHERE organization_id = ${organizationId} ORDER BY slug, definition_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record FROM reporting.esg_metric_result_facts
        WHERE organization_id = ${organizationId} ORDER BY project_id, project_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record FROM reporting.esg_metric_result_source_facts
        WHERE organization_id = ${organizationId} ORDER BY result_id, member_index, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT event.id, event.action, event.actor_id, event.entity_type, event.entity_id,
          event.previous_root, event.payload_hash, event.event_root,
          event.created_at AS created_at_value, event.rationale
        FROM audit.domain_events event
        WHERE event.event_root IN (
          SELECT audit_event_root FROM reporting.esg_metric_definition_facts WHERE organization_id = ${organizationId}
          UNION ALL
          SELECT audit_event_root FROM reporting.esg_metric_result_facts WHERE organization_id = ${organizationId}
        )
        ORDER BY event.stream_id, event.sequence_no, event.id
      `),
    ]);
    const snapshot: CanopyProofEsgMetricAuthoritySnapshot = {
      definitions: definitionRows.map((row) => parseDefinition(factRowSchema.parse(row).fact_record)),
      results: resultRows.map((row) => parseResult(factRowSchema.parse(row).fact_record)),
      resultSources: sourceRows.map((row) => parseSource(factRowSchema.parse(row).fact_record)),
      streamEvents: eventRows.map(mapEvent),
    };
    return CanopyProofEsgMetricAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
  }
}

function assertProposedDefinition(
  snapshot: CanopyProofEsgMetricAuthoritySnapshot,
  definition: CanopyProofEsgMetricDefinitionFact,
) {
  if (snapshot.definitions.some((fact) => fact.id === definition.id || fact.definitionRoot === definition.definitionRoot)) {
    throw new Error("CANOPYPROOF_ESG_METRIC_DEFINITION_FACT_CONFLICT");
  }
  CanopyProofEsgMetricAuthorityService.fromAuthoritySnapshot({
    ...snapshot,
    streamEvents: [...snapshot.streamEvents, definition.auditEvent],
    definitions: [...snapshot.definitions, definition],
  });
}

function assertProposedResult(
  snapshot: CanopyProofEsgMetricAuthoritySnapshot,
  bundle: CanopyProofEsgMetricResultBundle,
) {
  if (
    snapshot.results.some((fact) => fact.id === bundle.result.id || fact.resultRoot === bundle.result.resultRoot) ||
    snapshot.resultSources.some((fact) => bundle.sources.some((source) => source.id === fact.id || source.memberRoot === fact.memberRoot))
  ) {
    throw new Error("CANOPYPROOF_ESG_METRIC_RESULT_FACT_CONFLICT");
  }
  CanopyProofEsgMetricAuthorityService.fromAuthoritySnapshot({
    streamEvents: [...snapshot.streamEvents, bundle.result.auditEvent],
    definitions: snapshot.definitions,
    results: [...snapshot.results, bundle.result],
    resultSources: [...snapshot.resultSources, ...bundle.sources],
  });
}

async function insertDomainEvent(transaction: MetricTransaction, authorityStream: string, event: CanopyProofAuditEvent) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.domain_events (
      id, stream_id, action, actor_id, entity_type, entity_id,
      previous_root, payload_hash, event_root, created_at, rationale
    ) VALUES (
      ${event.id}, ${authorityStream}, ${event.action}, ${event.actor}, ${event.entityType}, ${event.entityId},
      ${event.previousRoot}, ${event.payloadHash}, ${event.eventRoot}, ${asDate(event.createdAt)}, ${event.rationale}
    )
  `));
}

async function insertDefinition(transaction: MetricTransaction, definition: CanopyProofEsgMetricDefinitionFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO reporting.esg_metric_definition_facts (
      id, organization_id, owner_snapshot, slug, version, title, description,
      dimension, canonical_unit, allowed_units, precision_scale, value_domain,
      rounding_mode, aggregation_method, spatial_aggregation, temporal_aggregation,
      source_requirements, uncertainty_policy, framework_mappings,
      methodology_id, methodology_hash, methodology_publication_id,
      methodology_publication_root, methodology_publication_bundle_root,
      publisher_id, publisher_snapshot, reviewer_ids, reviewer_snapshots, reviewer_root,
      limitations, supersedes_definition_id, supersedes_definition_root, effective_at,
      command_hash, definition_sequence, previous_event_root, definition_hash,
      definition_root, fact_record, audit_event_root
    ) VALUES (
      ${definition.id}, ${definition.owner.id}, ${JSON.stringify(definition.owner)}::jsonb,
      ${definition.slug}, ${definition.version}, ${definition.title}, ${definition.description},
      ${definition.dimension}, ${definition.canonicalUnit}, ${textArray(definition.allowedUnits)},
      ${definition.precisionScale}, ${definition.valueDomain}, ${definition.roundingMode},
      ${definition.aggregationMethod}, ${definition.spatialAggregation}, ${definition.temporalAggregation},
      ${textArray(definition.sourceRequirements)}, ${JSON.stringify(definition.uncertaintyPolicy)}::jsonb,
      ${JSON.stringify(definition.frameworkMappings)}::jsonb, ${definition.methodologyId},
      ${definition.methodologyHash}, ${definition.methodologyPublicationId},
      ${definition.methodologyPublicationRoot}, ${definition.methodologyPublicationBundleRoot},
      ${definition.publisher.id}, ${JSON.stringify(definition.publisher)}::jsonb,
      ${textArray(definition.reviewers.map((reviewer) => reviewer.id))},
      ${JSON.stringify(definition.reviewers)}::jsonb, ${definition.reviewerRoot},
      ${textArray(definition.limitations)}, ${definition.supersedesDefinitionId ?? null},
      ${definition.supersedesDefinitionRoot ?? null}, ${asDate(definition.effectiveAt)},
      ${definition.commandHash}, ${definition.definitionSequence}, ${definition.previousEventRoot},
      ${definition.definitionHash}, ${definition.definitionRoot}, ${JSON.stringify(definition)}::jsonb,
      ${definition.auditEvent.eventRoot}
    )
  `));
}

async function insertResult(transaction: MetricTransaction, result: CanopyProofEsgMetricResultFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO reporting.esg_metric_result_facts (
      id, organization_id, project_id, definition_id, definition_root, definition_version,
      reporting_starts_at, reporting_ends_at, observation_starts_at, observation_ends_at,
      value_state, decimal_value, unit, detection_limit, withheld_reason, unavailable_reason,
      uncertainty, calculation_artifact_hash, calculator_id, calculator_snapshot,
      reviewer_id, reviewer_snapshot, review_rationale, limitations,
      source_record_ids, source_member_roots, source_count, source_set_root,
      evidence_root, verification_root, monitoring_root, confidence_score,
      calculated_at, reviewed_at, command_hash, project_sequence, previous_event_root,
      result_hash, result_root, fact_record, audit_event_root
    ) VALUES (
      ${result.id}, ${result.organizationId}, ${result.projectId}, ${result.definitionId},
      ${result.definitionRoot}, ${result.definitionVersion}, ${asDate(result.reportingPeriod.startsAt)},
      ${asDate(result.reportingPeriod.endsAt)}, ${asDate(result.observationPeriod.startsAt)},
      ${asDate(result.observationPeriod.endsAt)}, ${result.valueState}, ${result.decimalValue ?? null},
      ${result.unit}, ${result.detectionLimit ?? null}, ${result.withheldReason ?? null},
      ${result.unavailableReason ?? null}, ${JSON.stringify(result.uncertainty)}::jsonb,
      ${result.calculationArtifactHash}, ${result.calculator.id}, ${JSON.stringify(result.calculator)}::jsonb,
      ${result.reviewer.id}, ${JSON.stringify(result.reviewer)}::jsonb, ${result.reviewRationale},
      ${textArray(result.limitations)}, ${textArray(result.sourceRecordIds)},
      ${textArray(result.sourceMemberRoots)}, ${result.sourceCount}, ${result.sourceSetRoot},
      ${result.evidenceRoot}, ${result.verificationRoot}, ${result.monitoringRoot},
      ${result.confidenceScore}, ${asDate(result.calculatedAt)}, ${asDate(result.reviewedAt)},
      ${result.commandHash}, ${result.projectSequence}, ${result.previousEventRoot},
      ${result.resultHash}, ${result.resultRoot}, ${JSON.stringify(result)}::jsonb,
      ${result.auditEvent.eventRoot}
    )
  `));
}

async function insertSource(transaction: MetricTransaction, source: CanopyProofEsgMetricResultSourceFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO reporting.esg_metric_result_source_facts (
      id, result_id, organization_id, project_id, member_index, record_id, record_root,
      governed_record_projection_root, lifecycle_binding_id, lifecycle_binding_root,
      lifecycle_projection_root, signing_key_authority_id, signing_key_root,
      signature_receipt_id, signature_receipt_root, mrv_snapshot_id, mrv_snapshot_root,
      evidence_root, verification_root, monitoring_root, confidence_score,
      member_hash, member_root, fact_record
    ) VALUES (
      ${source.id}, ${source.resultId}, ${source.organizationId}, ${source.projectId},
      ${source.memberIndex}, ${source.recordId}, ${source.recordRoot},
      ${source.governedRecordProjectionRoot}, ${source.lifecycleBindingId},
      ${source.lifecycleBindingRoot}, ${source.lifecycleProjectionRoot},
      ${source.signingKeyAuthorityId}, ${source.signingKeyRoot},
      ${source.signatureReceiptId}, ${source.signatureReceiptRoot},
      ${source.mrvSnapshotId}, ${source.mrvSnapshotRoot}, ${source.evidenceRoot},
      ${source.verificationRoot}, ${source.monitoringRoot}, ${source.confidenceScore},
      ${source.memberHash}, ${source.memberRoot}, ${JSON.stringify(source)}::jsonb
    )
  `));
}

type ReceiptInsert = Readonly<{
  id: string;
  actorId: string;
  operation: string;
  idempotencyKeyHash: string;
  requestHash: string;
  entityType: "esg_metric_definition" | "esg_metric_result";
  entityId: string;
  responseHash: string;
  auditEventRoot: string;
  createdAt: string;
}>;

async function insertReceipt(transaction: MetricTransaction, input: ReceiptInsert) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.command_receipts (
      id, actor_id, operation, idempotency_key_hash, request_hash,
      result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
    ) VALUES (
      ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash},
      ${input.requestHash}, ${input.entityType}, ${input.entityId}, ${input.responseHash},
      ${input.auditEventRoot}, ${asDate(input.createdAt)}
    )
  `));
}

async function readReceipt(transaction: MetricTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId} FOR UPDATE
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_ESG_METRIC_RECEIPT_CARDINALITY_INVALID");
  return rows[0] ? receiptRowSchema.parse(rows[0]) : undefined;
}

function assertReceipt(
  receipt: z.infer<typeof receiptRowSchema>,
  requestHash: string,
  entityType: "esg_metric_definition" | "esg_metric_result",
  entityId: string,
  responseHash: string,
  auditEventRoot: string,
) {
  if (
    receipt.request_hash !== requestHash || receipt.result_entity_type !== entityType ||
    receipt.result_entity_id !== entityId || receipt.response_hash !== responseHash ||
    receipt.audit_event_root !== auditEventRoot
  ) throw new Error("CANOPYPROOF_ESG_METRIC_IDEMPOTENCY_CONFLICT");
}

async function setContext(transaction: MetricTransaction, organizationId: string, actorId = "system-read") {
  const organization = z.string().min(1).max(256).parse(organizationId);
  const actor = z.string().min(1).max(256).parse(actorId);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organization}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actor}, true)`);
}

function parseBundle(input: CanopyProofEsgMetricResultBundle): CanopyProofEsgMetricResultBundle {
  const result = parseResult(input.result);
  const sources = input.sources.map(parseSource).sort((left, right) => left.memberIndex - right.memberIndex);
  if (
    sources.length !== result.sourceCount ||
    sources.some((source, index) =>
      source.resultId !== result.id || source.organizationId !== result.organizationId ||
      source.projectId !== result.projectId || source.memberIndex !== index)
  ) throw new Error("CANOPYPROOF_ESG_METRIC_RESULT_BUNDLE_INVALID");
  return { result, sources };
}

function parseDefinition(input: unknown): CanopyProofEsgMetricDefinitionFact {
  definitionSchema.parse(input);
  return input as CanopyProofEsgMetricDefinitionFact;
}

function parseResult(input: unknown): CanopyProofEsgMetricResultFact {
  resultSchema.parse(input);
  return input as CanopyProofEsgMetricResultFact;
}

function parseSource(input: unknown): CanopyProofEsgMetricResultSourceFact {
  sourceSchema.parse(input);
  return input as CanopyProofEsgMetricResultSourceFact;
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

function mapDefinitionProjection(input: unknown): CanopyProofEsgMetricDefinitionProjection {
  const row = definitionProjectionRowSchema.parse(input);
  return {
    ownerOrganizationId: row.owner_organization_id,
    slug: row.slug_value,
    definitionId: row.definition_id,
    definitionRoot: row.definition_root,
    state: row.state,
    methodologyPublicationId: row.methodology_publication_id,
    methodologyPublicationRoot: row.methodology_publication_root,
    evaluatedAt: row.evaluated_at_value.toISOString(),
    latestDefinitionId: row.latest_definition_id,
    latestDefinitionRoot: row.latest_definition_root,
    issueCodes: row.issue_codes,
    projectionRoot: row.projection_root,
    safety: row.safety as CanopyProofEsgMetricDefinitionProjection["safety"],
  };
}

function mapResultProjection(input: unknown): CanopyProofEsgMetricResultProjection {
  const row = resultProjectionRowSchema.parse(input);
  return {
    organizationId: row.organization_id,
    projectId: row.project_id,
    resultId: row.result_id,
    resultRoot: row.result_root,
    definitionId: row.definition_id,
    definitionRoot: row.definition_root,
    state: row.state,
    evaluatedAt: row.evaluated_at_value.toISOString(),
    sourceCount: row.source_count,
    currentSourceCount: row.current_source_count,
    issueCodes: row.issue_codes,
    currentSourceRoot: row.current_source_root,
    projectionRoot: row.projection_root,
    safety: row.safety as CanopyProofEsgMetricResultProjection["safety"],
  };
}

function definitionStreamId(definition: CanopyProofEsgMetricDefinitionFact) {
  return `esg-metric-definition:${definition.owner.id.length}:${definition.owner.id}${definition.slug.length}:${definition.slug}`;
}

function resultStreamId(result: CanopyProofEsgMetricResultFact) {
  return `esg-metric-result:${result.organizationId.length}:${result.organizationId}${result.projectId.length}:${result.projectId}`;
}

function commandReceiptId(actorId: string, operation: string, idempotencyKeyHash: string) {
  return `cp_esg_metric_command_${hashJson({ actorId, operation, idempotencyKeyHash }).slice(0, 24)}`;
}

function textArray(values: readonly string[]) {
  return values.length > 0 ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]` : Prisma.sql`ARRAY[]::text[]`;
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_ESG_METRIC_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_ESG_METRIC_MUTATION_CARDINALITY_INVALID");
}
