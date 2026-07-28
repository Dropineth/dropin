import { hashJson } from "@dropin/crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  CanopyProofCanonicalEsgReportingAuthorityService,
  type CanopyProofCanonicalEsgReportAuthoritySnapshot,
  type CanopyProofCanonicalEsgReportBundle,
  type CanopyProofCanonicalEsgReportFact,
  type CanopyProofCanonicalEsgReportMemberFact,
  type CanopyProofCanonicalEsgMetricMemberFact,
  type CanopyProofCanonicalEsgReportProjection,
} from "./esg-reporting-authority.js";
import type { CanopyProofAuditEvent } from "./proof-engine.js";
import {
  acquireCanopyProofPostgresTransactionLock,
  isCanopyProofPostgresRetryableWriteConflict,
} from "./postgres-advisory-lock.js";

type ReportingTransaction = Prisma.TransactionClient;

export type CanopyProofCanonicalEsgReportingRepositoryStatus = {
  readonly service: "canopyproof-canonical-esg-reporting-repository";
  readonly storage: "postgresql";
  readonly routeMounted: false;
  readonly productionActivationEnabled: false;
  readonly appendOnly: true;
  readonly tenantScoped: true;
  readonly serializableWrites: true;
  readonly exactRetryRequired: true;
  readonly currentEnvironmentalProofReResolved: true;
  readonly activeSignedLifecycleRequired: true;
  readonly accreditedHumanPublisherRequired: true;
  readonly currentGovernedMetricRequired: true;
  readonly frameworkPreparationOnly: true;
};

const HASH_PATTERN = /^[a-f0-9]{64}$/;
const idempotencyKeySchema = z.string().trim().min(8).max(200);
const factRowSchema = z.object({ fact_record: z.unknown() });
const receiptRowSchema = z.object({
  request_hash: z.string().regex(HASH_PATTERN),
  result_entity_type: z.literal("canonical_esg_report"),
  result_entity_id: z.string().min(1),
  response_hash: z.string().regex(HASH_PATTERN),
  audit_event_root: z.string().regex(HASH_PATTERN),
});
const reportSchema = z.object({
  factType: z.literal("canonical_esg_report"),
  id: z.string().min(1).max(256),
  organization: z.object({ id: z.string().min(1), verificationStatus: z.literal("verified") }).passthrough(),
  projectId: z.string().min(1),
  publisher: z.object({ id: z.string().min(1), participantType: z.literal("human") }).passthrough(),
  sourceRecordIds: z.array(z.string().min(1)).min(1).max(128),
  sourceCount: z.number().int().min(1).max(128),
  metricResultIds: z.array(z.string().min(1)).min(1).max(128),
  metricCount: z.number().int().min(1).max(128),
  commandHash: z.string().regex(HASH_PATTERN),
  reportRoot: z.string().regex(HASH_PATTERN),
  generatedAt: z.string().datetime(),
  safety: z.object({ routeMounted: z.literal(false), productionActivationEnabled: z.literal(false) }).passthrough(),
  auditEvent: z.object({ eventRoot: z.string().regex(HASH_PATTERN) }).passthrough(),
}).passthrough();
const memberSchema = z.object({
  factType: z.literal("canonical_esg_report_member"),
  id: z.string().min(1).max(256),
  reportId: z.string().min(1),
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  memberIndex: z.number().int().nonnegative(),
  recordId: z.string().min(1),
  memberRoot: z.string().regex(HASH_PATTERN),
  safety: z.object({ routeMounted: z.literal(false), productionActivationEnabled: z.literal(false) }).passthrough(),
}).passthrough();
const metricMemberSchema = z.object({
  factType: z.literal("canonical_esg_report_metric_member"),
  id: z.string().min(1).max(256),
  reportId: z.string().min(1),
  organizationId: z.string().min(1),
  projectId: z.string().min(1),
  memberIndex: z.number().int().nonnegative(),
  resultId: z.string().min(1),
  resultRoot: z.string().regex(HASH_PATTERN),
  memberRoot: z.string().regex(HASH_PATTERN),
  safety: z.object({ routeMounted: z.literal(false), productionActivationEnabled: z.literal(false) }).passthrough(),
}).passthrough();
const eventRowSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"]),
  actor_id: z.string().min(1),
  entity_type: z.literal("esg_report"),
  entity_id: z.string().min(1),
  previous_root: z.string().regex(HASH_PATTERN),
  payload_hash: z.string().regex(HASH_PATTERN),
  event_root: z.string().regex(HASH_PATTERN),
  created_at_value: z.coerce.date(),
  rationale: z.string().min(1),
});
const projectionRowSchema = z.object({
  organization_id: z.string().min(1),
  project_id: z.string().min(1),
  report_id: z.string().min(1),
  report_root: z.string().regex(HASH_PATTERN),
  state: z.enum(["current", "stale", "challenged", "revoked", "expired"]),
  evaluated_at_value: z.coerce.date(),
  source_count: z.number().int().nonnegative(),
  current_source_count: z.number().int().nonnegative(),
  issue_codes: z.array(z.string()),
  current_source_root: z.string().regex(HASH_PATTERN),
  metric_count: z.number().int().nonnegative(),
  current_metric_count: z.number().int().nonnegative(),
  current_metric_root: z.string().regex(HASH_PATTERN),
  projection_root: z.string().regex(HASH_PATTERN),
  safety: z.unknown(),
});

export class PrismaCanopyProofCanonicalEsgReportingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getStatus(): CanopyProofCanonicalEsgReportingRepositoryStatus {
    return {
      service: "canopyproof-canonical-esg-reporting-repository",
      storage: "postgresql",
      routeMounted: false,
      productionActivationEnabled: false,
      appendOnly: true,
      tenantScoped: true,
      serializableWrites: true,
      exactRetryRequired: true,
      currentEnvironmentalProofReResolved: true,
      activeSignedLifecycleRequired: true,
      accreditedHumanPublisherRequired: true,
      currentGovernedMetricRequired: true,
      frameworkPreparationOnly: true,
    };
  }

  async commitReport(
    bundleInput: CanopyProofCanonicalEsgReportBundle,
    idempotencyKeyInput: string,
  ): Promise<CanopyProofCanonicalEsgReportBundle> {
    const bundle = parseBundle(bundleInput);
    const idempotencyKey = idempotencyKeySchema.parse(idempotencyKeyInput);
    const actorId = bundle.report.publisher.id;
    const operation = "canonical-esg-report.commit";
    const idempotencyKeyHash = hashJson({ kind: "canopyproof-idempotency-key-v1", value: idempotencyKey });
    const requestHash = hashJson({ kind: "canopyproof-canonical-esg-report-commit-v1", bundle });
    const receiptId = `cp_canonical_esg_command_${hashJson({
      actorId,
      operation,
      idempotencyKeyHash,
    }).slice(0, 24)}`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (transaction) => {
            await setContext(transaction, bundle.report.organization.id, actorId);
            await acquireCanopyProofPostgresTransactionLock(
              transaction,
              `canonical-esg-command:${actorId}:${operation}:${idempotencyKeyHash}`,
            );
            const authorityStream = streamId(bundle.report);
            await acquireCanopyProofPostgresTransactionLock(transaction, `domain-event:${authorityStream}`);
            const receipt = await readReceipt(transaction, receiptId);
            if (receipt) {
              assertReceipt(receipt, requestHash, bundle.report);
              return this.requireReport(transaction, bundle.report.organization.id, bundle.report.id);
            }

            const snapshot = await this.loadSnapshot(transaction, bundle.report.organization.id);
            assertProposedBundle(snapshot, bundle);
            await insertDomainEvent(transaction, authorityStream, bundle.report.auditEvent);
            await insertReport(transaction, bundle.report);
            for (const member of bundle.members) await insertMember(transaction, member);
            for (const member of bundle.metricMembers) await insertMetricMember(transaction, member);
            await insertReceipt(transaction, {
              id: receiptId,
              actorId,
              operation,
              idempotencyKeyHash,
              requestHash,
              report: bundle.report,
            });
            return this.requireReport(transaction, bundle.report.organization.id, bundle.report.id);
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (isCanopyProofPostgresRetryableWriteConflict(error) && attempt < 2) continue;
        throw error;
      }
    }
    throw new Error("CANOPYPROOF_CANONICAL_ESG_DURABLE_WRITE_UNAVAILABLE");
  }

  async getReport(organizationId: string, reportId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        return this.requireReport(transaction, organizationId, reportId);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async listReports(organizationId: string, projectId?: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        const service = CanopyProofCanonicalEsgReportingAuthorityService.fromAuthoritySnapshot(
          await this.loadSnapshot(transaction, organizationId),
        );
        return service.listReports({ organizationId, ...(projectId ? { projectId } : {}) });
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

  async projectReport(
    organizationId: string,
    reportId: string,
    evaluatedAt: string,
  ): Promise<CanopyProofCanonicalEsgReportProjection> {
    return this.prisma.$transaction(
      async (transaction) => {
        await setContext(transaction, organizationId);
        const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
          SELECT * FROM reporting.canonical_esg_report_projection(${reportId}, ${asDate(evaluatedAt)})
        `);
        if (rows.length !== 1) throw new Error("CANOPYPROOF_CANONICAL_ESG_PROJECTION_CARDINALITY_INVALID");
        const projection = mapProjection(rows[0]);
        if (projection.organizationId !== organizationId) {
          throw new Error("CANOPYPROOF_CANONICAL_ESG_ORGANIZATION_SCOPE_MISMATCH");
        }
        return projection;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  private async requireReport(
    transaction: ReportingTransaction,
    organizationId: string,
    reportId: string,
  ) {
    const service = CanopyProofCanonicalEsgReportingAuthorityService.fromAuthoritySnapshot(
      await this.loadSnapshot(transaction, organizationId),
    );
    const bundle = service.getReport(reportId);
    if (bundle.report.organization.id !== organizationId) {
      throw new Error("CANOPYPROOF_CANONICAL_ESG_ORGANIZATION_SCOPE_MISMATCH");
    }
    return bundle;
  }

  private async loadSnapshot(
    transaction: ReportingTransaction,
    organizationId: string,
  ): Promise<CanopyProofCanonicalEsgReportAuthoritySnapshot> {
    const organizationRows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
      SELECT id FROM organizations.organizations WHERE id = ${organizationId} LIMIT 1
    `);
    if (organizationRows.length !== 1) {
      throw new Error("CANOPYPROOF_CANONICAL_ESG_ORGANIZATION_SCOPE_MISMATCH");
    }
    const [reportRows, memberRows, metricMemberRows, eventRows] = await Promise.all([
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record FROM reporting.canonical_esg_report_facts
        WHERE organization_id = ${organizationId}
        ORDER BY project_id, project_sequence, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record FROM reporting.canonical_esg_report_member_facts
        WHERE organization_id = ${organizationId}
        ORDER BY report_id, member_index, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT fact_record FROM reporting.canonical_esg_report_metric_member_facts
        WHERE organization_id = ${organizationId}
        ORDER BY report_id, member_index, id
      `),
      transaction.$queryRaw<unknown[]>(Prisma.sql`
        SELECT event.id, event.action, event.actor_id, event.entity_type, event.entity_id,
          event.previous_root, event.payload_hash, event.event_root,
          event.created_at AS created_at_value, event.rationale
        FROM audit.domain_events event
        JOIN reporting.canonical_esg_report_facts report
          ON report.audit_event_root = event.event_root
        WHERE report.organization_id = ${organizationId}
        ORDER BY event.stream_id, event.sequence_no, event.id
      `),
    ]);
    const snapshot: CanopyProofCanonicalEsgReportAuthoritySnapshot = {
      reports: reportRows.map((row) => parseReport(factRowSchema.parse(row).fact_record)),
      members: memberRows.map((row) => parseMember(factRowSchema.parse(row).fact_record)),
      metricMembers: metricMemberRows.map((row) => parseMetricMember(factRowSchema.parse(row).fact_record)),
      streamEvents: eventRows.map(mapEvent),
    };
    return CanopyProofCanonicalEsgReportingAuthorityService.fromAuthoritySnapshot(snapshot).getAuthoritySnapshot();
  }
}

function assertProposedBundle(
  snapshot: CanopyProofCanonicalEsgReportAuthoritySnapshot,
  bundle: CanopyProofCanonicalEsgReportBundle,
) {
  if (
    snapshot.reports.some((report) => report.id === bundle.report.id || report.reportRoot === bundle.report.reportRoot) ||
    snapshot.members.some((member) => bundle.members.some((candidate) =>
      candidate.id === member.id || candidate.memberRoot === member.memberRoot)) ||
    snapshot.metricMembers.some((member) => bundle.metricMembers.some((candidate) =>
      candidate.id === member.id || candidate.memberRoot === member.memberRoot))
  ) {
    throw new Error("CANOPYPROOF_CANONICAL_ESG_FACT_CONFLICT");
  }
  CanopyProofCanonicalEsgReportingAuthorityService.fromAuthoritySnapshot({
    streamEvents: [...snapshot.streamEvents, bundle.report.auditEvent],
    reports: [...snapshot.reports, bundle.report],
    members: [...snapshot.members, ...bundle.members],
    metricMembers: [...snapshot.metricMembers, ...bundle.metricMembers],
  });
}

async function insertDomainEvent(
  transaction: ReportingTransaction,
  authorityStream: string,
  event: CanopyProofAuditEvent,
) {
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

async function insertReport(transaction: ReportingTransaction, report: CanopyProofCanonicalEsgReportFact) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO reporting.canonical_esg_report_facts (
      id, organization_id, project_id, organization_snapshot,
      reporting_starts_at, reporting_ends_at, frameworks, material_topics,
      publisher_id, publisher_snapshot, source_record_ids, source_member_roots,
      source_count, source_set_root, evidence_root, verification_root, monitoring_root,
      confidence_score, metric_result_ids, metric_member_roots, metric_count, metric_set_root,
      disclosures, generated_at, command_hash, project_sequence,
      previous_event_root, artifact_hash, report_hash, report_root, fact_record, audit_event_root
    ) VALUES (
      ${report.id}, ${report.organization.id}, ${report.projectId}, ${JSON.stringify(report.organization)}::jsonb,
      ${asDate(report.reportingPeriod.startsAt)}, ${asDate(report.reportingPeriod.endsAt)},
      ${textArray(report.frameworks)}, ${textArray(report.materialTopics)},
      ${report.publisher.id}, ${JSON.stringify(report.publisher)}::jsonb,
      ${textArray(report.sourceRecordIds)}, ${textArray(report.sourceMemberRoots)},
      ${report.sourceCount}, ${report.sourceSetRoot}, ${report.evidenceRoot}, ${report.verificationRoot},
      ${report.monitoringRoot}, ${report.confidenceScore},
      ${textArray(report.metricResultIds)}, ${textArray(report.metricMemberRoots)},
      ${report.metricCount}, ${report.metricSetRoot},
      ${JSON.stringify(report.disclosures)}::jsonb,
      ${asDate(report.generatedAt)}, ${report.commandHash}, ${report.projectSequence},
      ${report.previousEventRoot}, ${report.artifactHash}, ${report.reportHash}, ${report.reportRoot},
      ${JSON.stringify(report)}::jsonb, ${report.auditEvent.eventRoot}
    )
  `));
}

async function insertMember(
  transaction: ReportingTransaction,
  member: CanopyProofCanonicalEsgReportMemberFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO reporting.canonical_esg_report_member_facts (
      id, report_id, organization_id, project_id, member_index, record_id, record_root,
      governed_record_projection_root, lifecycle_binding_id, lifecycle_binding_root,
      lifecycle_projection_root, signing_key_authority_id, signing_key_root,
      signature_receipt_id, signature_receipt_root, mrv_snapshot_id, mrv_snapshot_root,
      evidence_root, verification_root, monitoring_root, confidence_score,
      member_hash, member_root, fact_record
    ) VALUES (
      ${member.id}, ${member.reportId}, ${member.organizationId}, ${member.projectId},
      ${member.memberIndex}, ${member.recordId}, ${member.recordRoot},
      ${member.governedRecordProjectionRoot}, ${member.lifecycleBindingId},
      ${member.lifecycleBindingRoot}, ${member.lifecycleProjectionRoot},
      ${member.signingKeyAuthorityId}, ${member.signingKeyRoot},
      ${member.signatureReceiptId}, ${member.signatureReceiptRoot},
      ${member.mrvSnapshotId}, ${member.mrvSnapshotRoot}, ${member.evidenceRoot},
      ${member.verificationRoot}, ${member.monitoringRoot}, ${member.confidenceScore},
      ${member.memberHash}, ${member.memberRoot}, ${JSON.stringify(member)}::jsonb
    )
  `));
}

async function insertMetricMember(
  transaction: ReportingTransaction,
  member: CanopyProofCanonicalEsgMetricMemberFact,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO reporting.canonical_esg_report_metric_member_facts (
      id, report_id, organization_id, project_id, member_index,
      result_id, result_root, result_projection_root, definition_id,
      definition_root, definition_version, value_state, decimal_value,
      unit, detection_limit, uncertainty_root, reviewed_at,
      member_hash, member_root, fact_record
    ) VALUES (
      ${member.id}, ${member.reportId}, ${member.organizationId}, ${member.projectId},
      ${member.memberIndex}, ${member.resultId}, ${member.resultRoot},
      ${member.resultProjectionRoot}, ${member.definitionId}, ${member.definitionRoot},
      ${member.definitionVersion}, ${member.valueState}, ${member.decimalValue ?? null},
      ${member.unit}, ${member.detectionLimit ?? null}, ${member.uncertaintyRoot},
      ${asDate(member.reviewedAt)}, ${member.memberHash}, ${member.memberRoot},
      ${JSON.stringify(member)}::jsonb
    )
  `));
}

async function insertReceipt(
  transaction: ReportingTransaction,
  input: Readonly<{
    id: string;
    actorId: string;
    operation: string;
    idempotencyKeyHash: string;
    requestHash: string;
    report: CanopyProofCanonicalEsgReportFact;
  }>,
) {
  requireSingleMutation(await transaction.$executeRaw(Prisma.sql`
    INSERT INTO audit.command_receipts (
      id, actor_id, operation, idempotency_key_hash, request_hash,
      result_entity_type, result_entity_id, response_hash, audit_event_root, created_at
    ) VALUES (
      ${input.id}, ${input.actorId}, ${input.operation}, ${input.idempotencyKeyHash}, ${input.requestHash},
      'canonical_esg_report', ${input.report.id}, ${input.report.reportRoot},
      ${input.report.auditEvent.eventRoot}, ${asDate(input.report.generatedAt)}
    )
  `));
}

async function readReceipt(transaction: ReportingTransaction, receiptId: string) {
  const rows = await transaction.$queryRaw<unknown[]>(Prisma.sql`
    SELECT request_hash, result_entity_type, result_entity_id, response_hash, audit_event_root
    FROM audit.command_receipts WHERE id = ${receiptId} FOR UPDATE
  `);
  if (rows.length > 1) throw new Error("CANOPYPROOF_CANONICAL_ESG_RECEIPT_CARDINALITY_INVALID");
  return rows[0] ? receiptRowSchema.parse(rows[0]) : undefined;
}

function assertReceipt(
  receipt: z.infer<typeof receiptRowSchema>,
  requestHash: string,
  report: CanopyProofCanonicalEsgReportFact,
) {
  if (
    receipt.request_hash !== requestHash ||
    receipt.result_entity_id !== report.id ||
    receipt.response_hash !== report.reportRoot ||
    receipt.audit_event_root !== report.auditEvent.eventRoot
  ) {
    throw new Error("CANOPYPROOF_CANONICAL_ESG_IDEMPOTENCY_CONFLICT");
  }
}

async function setContext(
  transaction: ReportingTransaction,
  organizationId: string,
  actorId = "system-read",
) {
  const organization = z.string().min(1).max(256).parse(organizationId);
  const actor = z.string().min(1).max(256).parse(actorId);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.organization_id', ${organization}, true)`);
  await transaction.$queryRaw(Prisma.sql`SELECT set_config('app.actor_id', ${actor}, true)`);
}

function parseBundle(input: CanopyProofCanonicalEsgReportBundle): CanopyProofCanonicalEsgReportBundle {
  const report = parseReport(input.report);
  const members = input.members.map(parseMember).sort((left, right) => left.memberIndex - right.memberIndex);
  const metricMembers = input.metricMembers.map(parseMetricMember).sort((left, right) => left.memberIndex - right.memberIndex);
  if (
    members.length !== report.sourceCount ||
    members.some((member, index) =>
      member.reportId !== report.id ||
      member.organizationId !== report.organization.id ||
      member.projectId !== report.projectId ||
      member.memberIndex !== index) ||
    metricMembers.length !== report.metricCount ||
    metricMembers.some((member, index) =>
      member.reportId !== report.id ||
      member.organizationId !== report.organization.id ||
      member.projectId !== report.projectId ||
      member.memberIndex !== index)
  ) {
    throw new Error("CANOPYPROOF_CANONICAL_ESG_BUNDLE_INVALID");
  }
  return { report, members, metricMembers };
}

function parseReport(input: unknown): CanopyProofCanonicalEsgReportFact {
  reportSchema.parse(input);
  return input as CanopyProofCanonicalEsgReportFact;
}

function parseMember(input: unknown): CanopyProofCanonicalEsgReportMemberFact {
  memberSchema.parse(input);
  return input as CanopyProofCanonicalEsgReportMemberFact;
}

function parseMetricMember(input: unknown): CanopyProofCanonicalEsgMetricMemberFact {
  metricMemberSchema.parse(input);
  return input as CanopyProofCanonicalEsgMetricMemberFact;
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

function mapProjection(input: unknown): CanopyProofCanonicalEsgReportProjection {
  const row = projectionRowSchema.parse(input);
  return {
    organizationId: row.organization_id,
    projectId: row.project_id,
    reportId: row.report_id,
    reportRoot: row.report_root,
    state: row.state,
    evaluatedAt: row.evaluated_at_value.toISOString(),
    sourceCount: row.source_count,
    currentSourceCount: row.current_source_count,
    issueCodes: row.issue_codes,
    currentSourceRoot: row.current_source_root,
    metricCount: row.metric_count,
    currentMetricCount: row.current_metric_count,
    currentMetricRoot: row.current_metric_root,
    projectionRoot: row.projection_root,
    safety: row.safety as CanopyProofCanonicalEsgReportProjection["safety"],
  };
}

function streamId(report: CanopyProofCanonicalEsgReportFact) {
  return `canonical-esg-report:${report.organization.id.length}:${report.organization.id}${report.projectId.length}:${report.projectId}`;
}

function textArray(values: readonly string[]) {
  return values.length > 0 ? Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]` : Prisma.sql`ARRAY[]::text[]`;
}

function asDate(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== value) {
    throw new Error("CANOPYPROOF_CANONICAL_ESG_TIMESTAMP_INVALID");
  }
  return date;
}

function requireSingleMutation(count: number) {
  if (count !== 1) throw new Error("CANOPYPROOF_CANONICAL_ESG_MUTATION_CARDINALITY_INVALID");
}
