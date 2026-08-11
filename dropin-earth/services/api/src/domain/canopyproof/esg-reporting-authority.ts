import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import type { CanopyProofEnvironmentalProofRecord } from "./environmental-proof-authority.js";
import type { CanopyProofEnvironmentalProofChallengedRecordProjection } from "./environmental-proof-challenge-authority.js";
import type {
  CanopyProofEnvironmentalProofLifecycleBindingFact,
  CanopyProofEnvironmentalProofLifecycleProjection,
  CanopyProofEnvironmentalProofSignatureReceiptFact,
} from "./environmental-proof-lifecycle-authority.js";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  canopyProofEsgMetricSafetyBoundary,
  type CanopyProofEsgMetricResultFact,
  type CanopyProofEsgMetricResultProjection,
} from "./esg-metric-authority.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofCanonicalEsgFrameworks = [
  "GRI",
  "SDG",
  "TNFD",
  "BIODIVERSITY",
  "CLIMATE_IMPACT",
] as const;
export const canopyProofCanonicalEsgReportStates = [
  "current",
  "stale",
  "challenged",
  "revoked",
  "expired",
] as const;

export type CanopyProofCanonicalEsgFramework = (typeof canopyProofCanonicalEsgFrameworks)[number];
export type CanopyProofCanonicalEsgReportState = (typeof canopyProofCanonicalEsgReportStates)[number];

export type CanopyProofCanonicalEsgReportingSafetyBoundary = {
  readonly currentEnvironmentalProofRequired: true;
  readonly activeSignedLifecycleRequired: true;
  readonly reviewedMrvRequired: true;
  readonly accreditedHumanPublisherRequired: true;
  readonly currentGovernedMetricRequired: true;
  readonly independentMetricReviewRequired: true;
  readonly appendOnly: true;
  readonly exactRetryRequired: true;
  readonly tenantBound: true;
  readonly routeMounted: false;
  readonly productionActivationEnabled: false;
  readonly frameworkPreparationOnly: true;
  readonly notAssuranceOpinion: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofReportingOrganizationSnapshot = {
  readonly id: string;
  readonly name: string;
  readonly verificationStatus: "verified";
  readonly organizationRoot: string;
};

export type CanopyProofCanonicalEsgFrameworkDisclosure = {
  readonly framework: CanopyProofCanonicalEsgFramework;
  readonly status: "preparation_only";
  readonly title: string;
  readonly statement: string;
  readonly sourceRecordIds: readonly string[];
  readonly sourceRoot: string;
  readonly metricResultIds: readonly string[];
  readonly metricRoot: string;
  readonly limitations: readonly string[];
};

export type CanopyProofCanonicalEsgMetricMemberFact = {
  readonly factType: "canonical_esg_report_metric_member";
  readonly id: string;
  readonly reportId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly memberIndex: number;
  readonly resultId: string;
  readonly resultRoot: string;
  readonly resultProjectionRoot: string;
  readonly definitionId: string;
  readonly definitionRoot: string;
  readonly definitionVersion: string;
  readonly valueState: CanopyProofEsgMetricResultFact["valueState"];
  readonly decimalValue?: string;
  readonly unit: CanopyProofEsgMetricResultFact["unit"];
  readonly detectionLimit?: string;
  readonly uncertaintyRoot: string;
  readonly reviewedAt: string;
  readonly memberHash: string;
  readonly memberRoot: string;
  readonly safety: CanopyProofCanonicalEsgReportingSafetyBoundary;
};

export type CanopyProofCanonicalEsgReportMemberFact = {
  readonly factType: "canonical_esg_report_member";
  readonly id: string;
  readonly reportId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly memberIndex: number;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly governedRecordProjectionRoot: string;
  readonly lifecycleBindingId: string;
  readonly lifecycleBindingRoot: string;
  readonly lifecycleProjectionRoot: string;
  readonly signingKeyAuthorityId: string;
  readonly signingKeyRoot: string;
  readonly signatureReceiptId: string;
  readonly signatureReceiptRoot: string;
  readonly mrvSnapshotId: string;
  readonly mrvSnapshotRoot: string;
  readonly evidenceRoot: string;
  readonly verificationRoot: string;
  readonly monitoringRoot: string;
  readonly confidenceScore: number;
  readonly memberHash: string;
  readonly memberRoot: string;
  readonly safety: CanopyProofCanonicalEsgReportingSafetyBoundary;
};

export type CanopyProofCanonicalEsgReportFact = {
  readonly factType: "canonical_esg_report";
  readonly id: string;
  readonly organization: CanopyProofReportingOrganizationSnapshot;
  readonly projectId: string;
  readonly reportingPeriod: {
    readonly startsAt: string;
    readonly endsAt: string;
  };
  readonly frameworks: readonly CanopyProofCanonicalEsgFramework[];
  readonly materialTopics: readonly string[];
  readonly publisher: CanopyProofVerificationActorSnapshot;
  readonly sourceRecordIds: readonly string[];
  readonly sourceMemberRoots: readonly string[];
  readonly sourceCount: number;
  readonly sourceSetRoot: string;
  readonly evidenceRoot: string;
  readonly verificationRoot: string;
  readonly monitoringRoot: string;
  readonly confidenceScore: number;
  readonly metricResultIds: readonly string[];
  readonly metricMemberRoots: readonly string[];
  readonly metricCount: number;
  readonly metricSetRoot: string;
  readonly disclosures: readonly CanopyProofCanonicalEsgFrameworkDisclosure[];
  readonly generatedAt: string;
  readonly commandHash: string;
  readonly projectSequence: number;
  readonly previousEventRoot: string;
  readonly artifactHash: string;
  readonly reportHash: string;
  readonly reportRoot: string;
  readonly safety: CanopyProofCanonicalEsgReportingSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofCanonicalEsgReportProjection = {
  readonly organizationId: string;
  readonly projectId: string;
  readonly reportId: string;
  readonly reportRoot: string;
  readonly state: CanopyProofCanonicalEsgReportState;
  readonly evaluatedAt: string;
  readonly sourceCount: number;
  readonly currentSourceCount: number;
  readonly issueCodes: readonly string[];
  readonly currentSourceRoot: string;
  readonly metricCount: number;
  readonly currentMetricCount: number;
  readonly currentMetricRoot: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofCanonicalEsgReportingSafetyBoundary;
};

export type CanopyProofCanonicalEsgSourceAuthority = {
  readonly record: CanopyProofEnvironmentalProofRecord;
  readonly governedRecordProjection: CanopyProofEnvironmentalProofChallengedRecordProjection;
  readonly lifecycleBinding: CanopyProofEnvironmentalProofLifecycleBindingFact;
  readonly lifecycleProjection: CanopyProofEnvironmentalProofLifecycleProjection;
  readonly signatureReceipt: CanopyProofEnvironmentalProofSignatureReceiptFact;
};

export type CanopyProofCanonicalEsgPublicationAuthority = {
  readonly organization: CanopyProofReportingOrganizationSnapshot;
  readonly publisher: CanopyProofVerificationActorSnapshot;
  readonly sources: readonly CanopyProofCanonicalEsgSourceAuthority[];
  readonly metrics: readonly CanopyProofCanonicalEsgMetricAuthority[];
};

export type CanopyProofCanonicalEsgMetricAuthority = {
  readonly result: CanopyProofEsgMetricResultFact;
  readonly projection: CanopyProofEsgMetricResultProjection;
};

export type CanopyProofCanonicalEsgReportAuthoritySnapshot = {
  readonly streamEvents: readonly CanopyProofAuditEvent[];
  readonly reports: readonly CanopyProofCanonicalEsgReportFact[];
  readonly members: readonly CanopyProofCanonicalEsgReportMemberFact[];
  readonly metricMembers: readonly CanopyProofCanonicalEsgMetricMemberFact[];
};

export type CanopyProofCanonicalEsgReportBundle = {
  readonly report: CanopyProofCanonicalEsgReportFact;
  readonly members: readonly CanopyProofCanonicalEsgReportMemberFact[];
  readonly metricMembers: readonly CanopyProofCanonicalEsgMetricMemberFact[];
};

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime();
const materialTopicSchema = z.string().trim().min(2).max(160);
const publicationInputSchema = z
  .object({
    organizationId: identifierSchema,
    projectId: identifierSchema,
    sourceRecordIds: z.array(identifierSchema).min(1).max(128),
    metricResultIds: z.array(identifierSchema).min(1).max(128),
    reportingPeriod: z
      .object({ startsAt: timestampSchema, endsAt: timestampSchema })
      .strict(),
    frameworks: z.array(z.enum(canopyProofCanonicalEsgFrameworks)).min(1).max(5),
    materialTopics: z.array(materialTopicSchema).max(32).default([]),
    generatedAt: timestampSchema,
  })
  .strict();
const organizationSchema = z
  .object({
    id: identifierSchema,
    name: z.string().trim().min(2).max(240),
    verificationStatus: z.literal("verified"),
    organizationRoot: hashSchema,
  })
  .strict();
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.enum(["human", "agent"]),
    role: z.enum(["agent", "owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema.optional(),
    membershipStatus: z.literal("active").optional(),
    membershipRoot: hashSchema.optional(),
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: hashSchema.optional(),
    accreditationScope: z.array(identifierSchema).max(32),
    authorityRoot: hashSchema,
  })
  .strict();

const unsafeReportingPatterns = [
  /\bcertified\s+carbon\s+credit\b/i,
  /\bcarbon[-\s]?tax\s+offset\b/i,
  /\bguaranteed\s+(?:rwa\s+)?yield\b/i,
  /\bautomatic\s+(?:\$?canopy|canopy)\s+distribution\b/i,
  /\bregulatory\s+approval\b/i,
  /\bassurance\s+opinion\b/i,
];

export class CanopyProofCanonicalEsgReportingAuthorityService {
  private readonly eventsByProject = new Map<string, CanopyProofAuditEvent[]>();
  private readonly reportsById = new Map<string, CanopyProofCanonicalEsgReportFact>();
  private readonly membersByReportId = new Map<string, CanopyProofCanonicalEsgReportMemberFact[]>();
  private readonly metricMembersByReportId = new Map<string, CanopyProofCanonicalEsgMetricMemberFact[]>();

  static fromAuthoritySnapshot(snapshot: CanopyProofCanonicalEsgReportAuthoritySnapshot) {
    const service = new CanopyProofCanonicalEsgReportingAuthorityService();
    const membersByReport = new Map<string, CanopyProofCanonicalEsgReportMemberFact[]>();
    for (const member of snapshot.members) {
      membersByReport.set(member.reportId, [...(membersByReport.get(member.reportId) ?? []), member]);
    }
    const metricMembersByReport = new Map<string, CanopyProofCanonicalEsgMetricMemberFact[]>();
    for (const member of snapshot.metricMembers) {
      metricMembersByReport.set(member.reportId, [...(metricMembersByReport.get(member.reportId) ?? []), member]);
    }
    const reports = [...snapshot.reports].sort(
      (left, right) =>
        left.organization.id.localeCompare(right.organization.id) ||
        left.projectId.localeCompare(right.projectId) ||
        left.projectSequence - right.projectSequence,
    );
    for (const report of reports) {
      const members = membersByReport.get(report.id) ?? [];
      const metricMembers = metricMembersByReport.get(report.id) ?? [];
      service.replayReport(report, members, metricMembers, snapshot.streamEvents);
    }
    const knownEventRoots = new Set(
      [...service.eventsByProject.values()].flat().map((event) => event.eventRoot),
    );
    if (
      snapshot.streamEvents.length !== knownEventRoots.size ||
      snapshot.streamEvents.some((event) => !knownEventRoots.has(event.eventRoot))
    ) {
      throw new Error("CanopyProof canonical ESG snapshot contains unbound semantic events.");
    }
    return service;
  }

  publishReport(
    input: unknown,
    authority: CanopyProofCanonicalEsgPublicationAuthority,
  ): CanopyProofCanonicalEsgReportBundle {
    const parsed = publicationInputSchema.parse(input);
    const organization = normalizeOrganization(authority.organization);
    const publisher = normalizePublisher(authority.publisher, organization);
    const frameworks = canonicalFrameworks(parsed.frameworks);
    const materialTopics = canonicalTopics(parsed.materialTopics);
    const generatedAt = canonicalTimestamp(parsed.generatedAt, "generatedAt");
    const reportingPeriod = {
      startsAt: canonicalTimestamp(parsed.reportingPeriod.startsAt, "reportingPeriod.startsAt"),
      endsAt: canonicalTimestamp(parsed.reportingPeriod.endsAt, "reportingPeriod.endsAt"),
    };
    if (Date.parse(reportingPeriod.startsAt) > Date.parse(reportingPeriod.endsAt)) {
      throw new Error("CanopyProof canonical ESG reporting period is inverted.");
    }
    if (Date.parse(reportingPeriod.endsAt) > Date.parse(generatedAt)) {
      throw new Error("CanopyProof canonical ESG reporting period cannot end after publication.");
    }
    if (parsed.organizationId !== organization.id || parsed.projectId.trim() !== parsed.projectId) {
      throw new Error("CanopyProof canonical ESG publication authority scope is invalid.");
    }
    assertSafeText([organization.name, ...materialTopics]);

    const expectedRecordIds = canonicalIdentifiers(parsed.sourceRecordIds, "sourceRecordIds");
    if (authority.sources.length !== expectedRecordIds.length) {
      throw new Error("CanopyProof canonical ESG publication requires the complete declared source set.");
    }
    const sourceByRecordId = new Map(authority.sources.map((source) => [source.record.id, source] as const));
    if (sourceByRecordId.size !== authority.sources.length) {
      throw new Error("CanopyProof canonical ESG publication contains duplicate source records.");
    }
    if (hashJson([...sourceByRecordId.keys()].sort()) !== hashJson(expectedRecordIds)) {
      throw new Error("CanopyProof canonical ESG source record IDs do not match resolved authority.");
    }

    const sourceSeeds = expectedRecordIds.map((recordId) =>
      resolveCanopyProofCanonicalEnvironmentalSource(sourceByRecordId.get(recordId), {
        organizationId: organization.id,
        projectId: parsed.projectId,
        evaluatedAt: generatedAt,
      }),
    );
    const expectedMetricResultIds = canonicalIdentifiers(parsed.metricResultIds, "metricResultIds");
    if (authority.metrics.length !== expectedMetricResultIds.length) {
      throw new Error("CanopyProof canonical ESG publication requires the complete declared metric result set.");
    }
    const metricByResultId = new Map(authority.metrics.map((metric) => [metric.result.id, metric] as const));
    if (
      metricByResultId.size !== authority.metrics.length ||
      hashJson([...metricByResultId.keys()].sort()) !== hashJson(expectedMetricResultIds)
    ) {
      throw new Error("CanopyProof canonical ESG metric result IDs do not match resolved authority.");
    }
    const sourceIdSet = new Set(expectedRecordIds);
    const metricSeeds = expectedMetricResultIds.map((resultId) =>
      resolveCurrentMetricResult(metricByResultId.get(resultId), {
        organizationId: organization.id,
        projectId: parsed.projectId,
        evaluatedAt: generatedAt,
        sourceRecordIds: sourceIdSet,
      }),
    );
    const commandSeed = {
      organization,
      projectId: parsed.projectId,
      reportingPeriod,
      frameworks,
      materialTopics,
      publisher,
      sources: sourceSeeds,
      metrics: metricSeeds,
      generatedAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-canonical-esg-report-command-v1", ...commandSeed });
    const id = `cp_canonical_esg_${commandHash.slice(0, 24)}`;
    const safety = canopyProofCanonicalEsgReportingSafetyBoundary();
    const members = sourceSeeds.map((source, memberIndex) => createMember(id, memberIndex, source, safety));
    const metricMembers = metricSeeds.map((metric, memberIndex) =>
      createMetricMember(id, memberIndex, metric, safety));
    const sourceRecordIds = members.map((member) => member.recordId);
    const sourceMemberRoots = members.map((member) => member.memberRoot);
    const sourceSetRoot = merkleRoot(sourceMemberRoots);
    const evidenceRoot = merkleRoot(members.map((member) => member.evidenceRoot));
    const verificationRoot = merkleRoot(members.map((member) => member.verificationRoot));
    const monitoringRoot = merkleRoot(members.map((member) => member.monitoringRoot));
    const confidenceScore = Math.min(...members.map((member) => member.confidenceScore));
    const metricResultIds = metricMembers.map((member) => member.resultId);
    const metricMemberRoots = metricMembers.map((member) => member.memberRoot);
    const metricSetRoot = merkleRoot(metricMemberRoots);
    const disclosures = buildDisclosures(
      frameworks,
      sourceRecordIds,
      sourceSetRoot,
      metricResultIds,
      metricSetRoot,
    );
    const artifactSeed = {
      organization,
      projectId: parsed.projectId,
      reportingPeriod,
      frameworks,
      materialTopics,
      sourceRecordIds,
      sourceMemberRoots,
      sourceCount: members.length,
      sourceSetRoot,
      evidenceRoot,
      verificationRoot,
      monitoringRoot,
      confidenceScore,
      metricResultIds,
      metricMemberRoots,
      metricCount: metricMembers.length,
      metricSetRoot,
      disclosures,
      generatedAt,
    };
    const artifactHash = hashJson({ kind: "canopyproof-canonical-esg-report-artifact-v1", ...artifactSeed });
    const streamKey = reportStreamKey(organization.id, parsed.projectId);
    const events = this.eventsByProject.get(streamKey) ?? [];
    const projectSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const reportSeed = {
      id,
      ...artifactSeed,
      publisher,
      commandHash,
      projectSequence,
      previousEventRoot,
      artifactHash,
    };
    const reportHash = hashJson({ kind: "canopyproof-canonical-esg-report-v1", ...reportSeed });
    const reportRoot = canonicalEsgReportRoot({ ...reportSeed, reportHash });
    const payload = {
      factType: "canonical_esg_report" as const,
      ...reportSeed,
      reportHash,
      reportRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "ASSERT",
      actor: publisher.id,
      entityType: "esg_report",
      entityId: id,
      payload,
      createdAt: generatedAt,
      rationale:
        "An accredited human published a route-closed ESG preparation report from current signed Environmental Proof authority.",
    }).at(-1);
    if (!auditEvent) throw new Error("CanopyProof canonical ESG semantic event was not created.");
    const report: CanopyProofCanonicalEsgReportFact = { ...payload, auditEvent };
    this.storeReport(report, members, metricMembers);
    this.eventsByProject.set(streamKey, [...events, auditEvent]);
    return { report, members, metricMembers };
  }

  getReport(reportId: string): CanopyProofCanonicalEsgReportBundle {
    const report = this.reportsById.get(reportId);
    if (!report) throw new Error(`CanopyProof canonical ESG report not found: ${reportId}`);
    return {
      report,
      members: [...(this.membersByReportId.get(reportId) ?? [])],
      metricMembers: [...(this.metricMembersByReportId.get(reportId) ?? [])],
    };
  }

  listReports(input: Readonly<{ organizationId: string; projectId?: string }>) {
    return [...this.reportsById.values()]
      .filter(
        (report) =>
          report.organization.id === input.organizationId &&
          (!input.projectId || report.projectId === input.projectId),
      )
      .sort((left, right) => right.generatedAt.localeCompare(left.generatedAt) || left.id.localeCompare(right.id));
  }

  projectReport(
    reportId: string,
    currentSources: readonly CanopyProofCanonicalEsgSourceAuthority[],
    currentMetricProjections: readonly CanopyProofEsgMetricResultProjection[],
    evaluatedAtInput: string,
  ): CanopyProofCanonicalEsgReportProjection {
    const { report, members, metricMembers } = this.getReport(reportId);
    const evaluatedAt = canonicalTimestamp(evaluatedAtInput, "evaluatedAt");
    const sourceByRecordId = new Map(currentSources.map((source) => [source.record.id, source] as const));
    const issueCodes: string[] = [];
    const currentRoots: string[] = [];
    let currentSourceCount = 0;
    let challenged = false;
    let revoked = false;
    let expired = false;

    for (const member of members) {
      const source = sourceByRecordId.get(member.recordId);
      if (!source) {
        issueCodes.push(`source_missing:${member.recordId}`);
        continue;
      }
      if (
        source.record.organizationId !== report.organization.id ||
        source.record.projectId !== report.projectId
      ) {
        issueCodes.push(`source_scope_mismatch:${member.recordId}`);
        continue;
      }
      if (source.governedRecordProjection.state === "revoked") revoked = true;
      else if (source.governedRecordProjection.state === "challenged") challenged = true;
      if (source.lifecycleProjection.state === "expired") expired = true;
      const root = hashJson({
        kind: "canopyproof-canonical-esg-current-source-v1",
        recordId: source.record.id,
        recordRoot: source.record.recordRoot,
        governedRecordProjectionRoot: source.governedRecordProjection.projectionRoot,
        lifecycleBindingId: source.lifecycleBinding.id,
        lifecycleBindingRoot: source.lifecycleBinding.bindingRoot,
        lifecycleProjectionRoot: source.lifecycleProjection.projectionRoot,
        signatureReceiptId: source.signatureReceipt.id,
        signatureReceiptRoot: source.signatureReceipt.receiptRoot,
      });
      currentRoots.push(root);
      const exactHistoricalBinding =
        member.recordRoot === source.record.recordRoot &&
        member.lifecycleBindingId === source.lifecycleBinding.id &&
        member.lifecycleBindingRoot === source.lifecycleBinding.bindingRoot &&
        member.signatureReceiptId === source.signatureReceipt.id &&
        member.signatureReceiptRoot === source.signatureReceipt.receiptRoot &&
        member.mrvSnapshotId === source.lifecycleBinding.mrvSnapshotId &&
        member.mrvSnapshotRoot === source.lifecycleBinding.mrvSnapshotRoot;
      const currentlyEligible =
        source.governedRecordProjection.state === "issued" &&
        source.governedRecordProjection.sourceAuthorityCurrent &&
        source.lifecycleProjection.state === "active" &&
        source.lifecycleProjection.sourceAuthorityCurrent &&
        source.lifecycleProjection.boundMrvSnapshotCurrent &&
        source.lifecycleProjection.signatureVerified &&
        source.lifecycleProjection.validityCurrent;
      if (!exactHistoricalBinding) issueCodes.push(`source_binding_changed:${member.recordId}`);
      if (!currentlyEligible) issueCodes.push(`source_not_current:${member.recordId}`);
      if (exactHistoricalBinding && currentlyEligible) currentSourceCount += 1;
    }
    if (sourceByRecordId.size !== currentSources.length) issueCodes.push("source_set_contains_duplicates");
    if (sourceByRecordId.size !== members.length) issueCodes.push("source_set_cardinality_mismatch");
    const metricProjectionByResultId = new Map(
      currentMetricProjections.map((projection) => [projection.resultId, projection] as const),
    );
    const currentMetricRoots: string[] = [];
    let currentMetricCount = 0;
    for (const member of metricMembers) {
      const projection = metricProjectionByResultId.get(member.resultId);
      if (!projection) {
        issueCodes.push(`metric_missing:${member.resultId}`);
        continue;
      }
      if (!verifyCanopyProofEsgMetricResultProjection(projection)) {
        issueCodes.push(`metric_projection_invalid:${member.resultId}`);
        continue;
      }
      if (
        projection.organizationId !== report.organization.id ||
        projection.projectId !== report.projectId ||
        projection.resultRoot !== member.resultRoot
      ) {
        issueCodes.push(`metric_binding_changed:${member.resultId}`);
        continue;
      }
      currentMetricRoots.push(projection.projectionRoot);
      if (projection.state === "revoked") revoked = true;
      else if (projection.state === "challenged") challenged = true;
      else if (projection.state === "expired") expired = true;
      if (projection.evaluatedAt !== evaluatedAt || projection.state !== "current") {
        issueCodes.push(`metric_not_current:${member.resultId}`);
      } else {
        currentMetricCount += 1;
      }
    }
    if (metricProjectionByResultId.size !== currentMetricProjections.length) {
      issueCodes.push("metric_set_contains_duplicates");
    }
    if (metricProjectionByResultId.size !== metricMembers.length) {
      issueCodes.push("metric_set_cardinality_mismatch");
    }
    const normalizedIssues = [...new Set(issueCodes)].sort();
    const state: CanopyProofCanonicalEsgReportState = revoked
      ? "revoked"
      : challenged
        ? "challenged"
        : expired
          ? "expired"
          : normalizedIssues.length > 0
            ? "stale"
            : "current";
    const currentSourceRoot = merkleRoot(currentRoots.sort());
    const seed = {
      organizationId: report.organization.id,
      projectId: report.projectId,
      reportId: report.id,
      reportRoot: report.reportRoot,
      state,
      evaluatedAt,
      sourceCount: members.length,
      currentSourceCount,
      issueCodes: normalizedIssues,
      currentSourceRoot,
      metricCount: metricMembers.length,
      currentMetricCount,
      currentMetricRoot: merkleRoot(currentMetricRoots.sort()),
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-canonical-esg-report-projection-v1", ...seed }),
      safety: canopyProofCanonicalEsgReportingSafetyBoundary(),
    };
  }

  getAuthoritySnapshot(): CanopyProofCanonicalEsgReportAuthoritySnapshot {
    return {
      streamEvents: [...this.eventsByProject.values()].flatMap((events) => events),
      reports: [...this.reportsById.values()],
      members: [...this.membersByReportId.values()].flatMap((members) => members),
      metricMembers: [...this.metricMembersByReportId.values()].flatMap((members) => members),
    };
  }

  private replayReport(
    report: CanopyProofCanonicalEsgReportFact,
    membersInput: readonly CanopyProofCanonicalEsgReportMemberFact[],
    metricMembersInput: readonly CanopyProofCanonicalEsgMetricMemberFact[],
    allEvents: readonly CanopyProofAuditEvent[],
  ) {
    const organization = normalizeOrganization(report.organization);
    const publisher = normalizePublisher(report.publisher, organization);
    const frameworks = canonicalFrameworks(report.frameworks);
    const materialTopics = canonicalTopics(report.materialTopics);
    const generatedAt = canonicalTimestamp(report.generatedAt, "generatedAt");
    const reportingPeriod = {
      startsAt: canonicalTimestamp(report.reportingPeriod.startsAt, "reportingPeriod.startsAt"),
      endsAt: canonicalTimestamp(report.reportingPeriod.endsAt, "reportingPeriod.endsAt"),
    };
    const members = [...membersInput].sort((left, right) => left.memberIndex - right.memberIndex);
    if (
      members.length === 0 ||
      members.some((member, index) => !verifyCanopyProofCanonicalEsgReportMember(member, report.id, index))
    ) {
      throw new Error(`CanopyProof canonical ESG report member lineage is invalid: ${report.id}`);
    }
    const metricMembers = [...metricMembersInput].sort((left, right) => left.memberIndex - right.memberIndex);
    if (
      metricMembers.length === 0 ||
      metricMembers.some(
        (member, index) => !verifyCanopyProofCanonicalEsgMetricMember(member, report.id, index),
      )
    ) {
      throw new Error(`CanopyProof canonical ESG metric member lineage is invalid: ${report.id}`);
    }
    const sourceRecordIds = members.map((member) => member.recordId);
    const sourceMemberRoots = members.map((member) => member.memberRoot);
    const sourceSetRoot = merkleRoot(sourceMemberRoots);
    const evidenceRoot = merkleRoot(members.map((member) => member.evidenceRoot));
    const verificationRoot = merkleRoot(members.map((member) => member.verificationRoot));
    const monitoringRoot = merkleRoot(members.map((member) => member.monitoringRoot));
    const confidenceScore = Math.min(...members.map((member) => member.confidenceScore));
    const metricResultIds = metricMembers.map((member) => member.resultId);
    const metricMemberRoots = metricMembers.map((member) => member.memberRoot);
    const metricSetRoot = merkleRoot(metricMemberRoots);
    const disclosures = buildDisclosures(
      frameworks,
      sourceRecordIds,
      sourceSetRoot,
      metricResultIds,
      metricSetRoot,
    );
    const sourceSeeds = members.map(memberToSourceSeed);
    const metricSeeds = metricMembers.map(metricMemberToSeed);
    const commandSeed = {
      organization,
      projectId: report.projectId,
      reportingPeriod,
      frameworks,
      materialTopics,
      publisher,
      sources: sourceSeeds,
      metrics: metricSeeds,
      generatedAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-canonical-esg-report-command-v1", ...commandSeed });
    const artifactSeed = {
      organization,
      projectId: report.projectId,
      reportingPeriod,
      frameworks,
      materialTopics,
      sourceRecordIds,
      sourceMemberRoots,
      sourceCount: members.length,
      sourceSetRoot,
      evidenceRoot,
      verificationRoot,
      monitoringRoot,
      confidenceScore,
      metricResultIds,
      metricMemberRoots,
      metricCount: metricMembers.length,
      metricSetRoot,
      disclosures,
      generatedAt,
    };
    const artifactHash = hashJson({ kind: "canopyproof-canonical-esg-report-artifact-v1", ...artifactSeed });
    const streamKey = reportStreamKey(organization.id, report.projectId);
    const events = this.eventsByProject.get(streamKey) ?? [];
    const event = allEvents.find((candidate) => candidate.eventRoot === report.auditEvent.eventRoot);
    const reportSeed = {
      id: report.id,
      ...artifactSeed,
      publisher,
      commandHash,
      projectSequence: events.length + 1,
      previousEventRoot: events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
      artifactHash,
    };
    const reportHash = hashJson({ kind: "canopyproof-canonical-esg-report-v1", ...reportSeed });
    const reportRoot = canonicalEsgReportRoot({ ...reportSeed, reportHash });
    const safety = canopyProofCanonicalEsgReportingSafetyBoundary();
    const payload = {
      factType: "canonical_esg_report" as const,
      ...reportSeed,
      reportHash,
      reportRoot,
      safety,
    };
    const replayedEvent = appendCanopyProofAuditEvent(events, {
      action: "ASSERT",
      actor: publisher.id,
      entityType: "esg_report",
      entityId: report.id,
      payload,
      createdAt: generatedAt,
      rationale:
        "An accredited human published a route-closed ESG preparation report from current signed Environmental Proof authority.",
    }).at(-1);
    if (
      !event ||
      !replayedEvent ||
      hashJson(event) !== hashJson(replayedEvent) ||
      hashJson(report.auditEvent) !== hashJson(event) ||
      report.id !== `cp_canonical_esg_${report.commandHash.slice(0, 24)}` ||
      report.commandHash !== commandHash ||
      report.projectSequence !== reportSeed.projectSequence ||
      report.previousEventRoot !== reportSeed.previousEventRoot ||
      report.artifactHash !== artifactHash ||
      report.reportHash !== reportHash ||
      report.reportRoot !== reportRoot ||
      hashJson(report.organization) !== hashJson(organization) ||
      hashJson(report.publisher) !== hashJson(publisher) ||
      hashJson(report.frameworks) !== hashJson(frameworks) ||
      hashJson(report.materialTopics) !== hashJson(materialTopics) ||
      hashJson(report.sourceRecordIds) !== hashJson(sourceRecordIds) ||
      hashJson(report.sourceMemberRoots) !== hashJson(sourceMemberRoots) ||
      report.sourceCount !== members.length ||
      report.sourceSetRoot !== sourceSetRoot ||
      report.evidenceRoot !== evidenceRoot ||
      report.verificationRoot !== verificationRoot ||
      report.monitoringRoot !== monitoringRoot ||
      report.confidenceScore !== confidenceScore ||
      hashJson(report.metricResultIds) !== hashJson(metricResultIds) ||
      hashJson(report.metricMemberRoots) !== hashJson(metricMemberRoots) ||
      report.metricCount !== metricMembers.length ||
      report.metricSetRoot !== metricSetRoot ||
      hashJson(report.disclosures) !== hashJson(disclosures) ||
      hashJson(report.safety) !== hashJson(safety)
    ) {
      throw new Error(`CanopyProof canonical ESG report lineage is invalid: ${report.id}`);
    }
    this.storeReport(report, members, metricMembers);
    this.eventsByProject.set(streamKey, [...events, event]);
  }

  private storeReport(
    report: CanopyProofCanonicalEsgReportFact,
    members: readonly CanopyProofCanonicalEsgReportMemberFact[],
    metricMembers: readonly CanopyProofCanonicalEsgMetricMemberFact[],
  ) {
    if (this.reportsById.has(report.id)) throw new Error(`CanopyProof canonical ESG report is duplicated: ${report.id}`);
    const memberIds = new Set<string>();
    for (const member of members) {
      if (memberIds.has(member.id)) throw new Error(`CanopyProof canonical ESG member is duplicated: ${member.id}`);
      memberIds.add(member.id);
    }
    this.reportsById.set(report.id, report);
    this.membersByReportId.set(report.id, [...members]);
    this.metricMembersByReportId.set(report.id, [...metricMembers]);
  }
}

export function canopyProofCanonicalEsgReportingSafetyBoundary(): CanopyProofCanonicalEsgReportingSafetyBoundary {
  return {
    currentEnvironmentalProofRequired: true,
    activeSignedLifecycleRequired: true,
    reviewedMrvRequired: true,
    accreditedHumanPublisherRequired: true,
    currentGovernedMetricRequired: true,
    independentMetricReviewRequired: true,
    appendOnly: true,
    exactRetryRequired: true,
    tenantBound: true,
    routeMounted: false,
    productionActivationEnabled: false,
    frameworkPreparationOnly: true,
    notAssuranceOpinion: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

export function canonicalEsgReportRoot(input: unknown) {
  return hashJson({ kind: "canopyproof-canonical-esg-report-root-v1", report: input });
}

function normalizeOrganization(input: unknown): CanopyProofReportingOrganizationSnapshot {
  return organizationSchema.parse(input);
}

function normalizePublisher(
  input: unknown,
  organization: CanopyProofReportingOrganizationSnapshot,
): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const accreditationScope = canonicalIdentifiers(parsed.accreditationScope, "publisher accreditation scope");
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: parsed.participantRoot,
    organizationRoot: parsed.organizationRoot,
    ...(parsed.membershipId ? { membershipId: parsed.membershipId } : {}),
    ...(parsed.membershipStatus ? { membershipStatus: parsed.membershipStatus } : {}),
    ...(parsed.membershipRoot ? { membershipRoot: parsed.membershipRoot } : {}),
    ...(parsed.accreditationId ? { accreditationId: parsed.accreditationId } : {}),
    ...(parsed.accreditationStatus ? { accreditationStatus: parsed.accreditationStatus } : {}),
    ...(parsed.accreditationRoot ? { accreditationRoot: parsed.accreditationRoot } : {}),
    accreditationScope,
  };
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized });
  if (
    parsed.authorityRoot !== authorityRoot ||
    parsed.participantType !== "human" ||
    !["owner", "admin", "verifier", "researcher"].includes(parsed.role) ||
    parsed.organizationId !== organization.id ||
    parsed.organizationRoot !== organization.organizationRoot ||
    !parsed.membershipId ||
    parsed.membershipStatus !== "active" ||
    !parsed.membershipRoot ||
    !parsed.accreditationId ||
    parsed.accreditationStatus !== "approved" ||
    !parsed.accreditationRoot ||
    !accreditationScope.includes("esg_reporting:publish")
  ) {
    throw new Error("CanopyProof canonical ESG publisher authority is invalid.");
  }
  return { ...normalized, authorityRoot };
}

export type CanopyProofCanonicalEnvironmentalSourceSeed = ReturnType<
  typeof resolveCanopyProofCanonicalEnvironmentalSource
>;
export type CanopyProofCanonicalMetricResultSeed = ReturnType<typeof resolveCurrentMetricResult>;

function reportStreamKey(organizationId: string, projectId: string) {
  return `${organizationId.length}:${organizationId}${projectId.length}:${projectId}`;
}

function memberToSourceSeed(
  member: CanopyProofCanonicalEsgReportMemberFact,
): CanopyProofCanonicalEnvironmentalSourceSeed {
  return {
    organizationId: member.organizationId,
    projectId: member.projectId,
    recordId: member.recordId,
    recordRoot: member.recordRoot,
    governedRecordProjectionRoot: member.governedRecordProjectionRoot,
    lifecycleBindingId: member.lifecycleBindingId,
    lifecycleBindingRoot: member.lifecycleBindingRoot,
    lifecycleProjectionRoot: member.lifecycleProjectionRoot,
    signingKeyAuthorityId: member.signingKeyAuthorityId,
    signingKeyRoot: member.signingKeyRoot,
    signatureReceiptId: member.signatureReceiptId,
    signatureReceiptRoot: member.signatureReceiptRoot,
    mrvSnapshotId: member.mrvSnapshotId,
    mrvSnapshotRoot: member.mrvSnapshotRoot,
    evidenceRoot: member.evidenceRoot,
    verificationRoot: member.verificationRoot,
    monitoringRoot: member.monitoringRoot,
    confidenceScore: member.confidenceScore,
  };
}

export function resolveCanopyProofCanonicalEnvironmentalSource(
  source: CanopyProofCanonicalEsgSourceAuthority | undefined,
  scope: Readonly<{ organizationId: string; projectId: string; evaluatedAt: string }>,
) {
  if (!source) throw new Error("CanopyProof canonical ESG source authority is missing.");
  const { record, governedRecordProjection, lifecycleBinding, lifecycleProjection, signatureReceipt } = source;
  if (
    record.factType !== "environmental_proof_record" ||
    record.status !== "issued" ||
    record.organizationId !== scope.organizationId ||
    record.projectId !== scope.projectId ||
    governedRecordProjection.recordId !== record.id ||
    governedRecordProjection.recordRoot !== record.recordRoot ||
    governedRecordProjection.state !== "issued" ||
    !governedRecordProjection.sourceAuthorityCurrent ||
    lifecycleBinding.organizationId !== scope.organizationId ||
    lifecycleBinding.projectId !== scope.projectId ||
    lifecycleBinding.recordId !== record.id ||
    lifecycleBinding.recordRoot !== record.recordRoot ||
    lifecycleProjection.organizationId !== scope.organizationId ||
    lifecycleProjection.projectId !== scope.projectId ||
    lifecycleProjection.recordId !== record.id ||
    lifecycleProjection.recordRoot !== record.recordRoot ||
    lifecycleProjection.bindingId !== lifecycleBinding.id ||
    lifecycleProjection.bindingRoot !== lifecycleBinding.bindingRoot ||
    lifecycleProjection.evaluatedAt !== scope.evaluatedAt ||
    lifecycleProjection.state !== "active" ||
    lifecycleProjection.governedRecordState !== "issued" ||
    !lifecycleProjection.sourceAuthorityCurrent ||
    lifecycleProjection.mrvState !== "reviewed_for_lineage" ||
    !lifecycleProjection.boundMrvSnapshotCurrent ||
    lifecycleProjection.keyState !== "active" ||
    !lifecycleProjection.signatureVerified ||
    !lifecycleProjection.validityCurrent ||
    signatureReceipt.organizationId !== scope.organizationId ||
    signatureReceipt.projectId !== scope.projectId ||
    signatureReceipt.recordId !== record.id ||
    signatureReceipt.recordRoot !== record.recordRoot ||
    signatureReceipt.bindingId !== lifecycleBinding.id ||
    signatureReceipt.bindingRoot !== lifecycleBinding.bindingRoot ||
    signatureReceipt.signingKeyAuthorityId !== lifecycleBinding.signingKeyAuthorityId ||
    signatureReceipt.signingKeyRoot !== lifecycleBinding.signingKeyRoot ||
    Date.parse(record.issuedAt) > Date.parse(scope.evaluatedAt) ||
    Date.parse(signatureReceipt.verifiedAt) > Date.parse(scope.evaluatedAt)
  ) {
    throw new Error(`CanopyProof canonical ESG source is not current and signed: ${record.id}`);
  }
  const verificationRoot = merkleRoot([...record.evidenceFinalDecisionRoots].sort());
  return {
    organizationId: scope.organizationId,
    projectId: scope.projectId,
    recordId: record.id,
    recordRoot: record.recordRoot,
    governedRecordProjectionRoot: governedRecordProjection.projectionRoot,
    lifecycleBindingId: lifecycleBinding.id,
    lifecycleBindingRoot: lifecycleBinding.bindingRoot,
    lifecycleProjectionRoot: lifecycleProjection.projectionRoot,
    signingKeyAuthorityId: lifecycleBinding.signingKeyAuthorityId,
    signingKeyRoot: lifecycleBinding.signingKeyRoot,
    signatureReceiptId: signatureReceipt.id,
    signatureReceiptRoot: signatureReceipt.receiptRoot,
    mrvSnapshotId: lifecycleBinding.mrvSnapshotId,
    mrvSnapshotRoot: lifecycleBinding.mrvSnapshotRoot,
    evidenceRoot: record.evidenceRoot,
    verificationRoot,
    monitoringRoot: record.monitoringRoot,
    confidenceScore: record.confidenceScore,
  };
}

export function resolveCurrentMetricResult(
  metric: CanopyProofCanonicalEsgMetricAuthority | undefined,
  scope: Readonly<{
    organizationId: string;
    projectId: string;
    evaluatedAt: string;
    sourceRecordIds: ReadonlySet<string>;
  }>,
) {
  if (!metric) throw new Error("CanopyProof canonical ESG metric authority is missing.");
  const { result, projection } = metric;
  if (
    !verifyCanopyProofEsgMetricResultProjection(projection) ||
    result.factType !== "esg_metric_result" ||
    result.organizationId !== scope.organizationId ||
    result.projectId !== scope.projectId ||
    projection.organizationId !== scope.organizationId ||
    projection.projectId !== scope.projectId ||
    projection.resultId !== result.id ||
    projection.resultRoot !== result.resultRoot ||
    projection.definitionId !== result.definitionId ||
    projection.definitionRoot !== result.definitionRoot ||
    projection.evaluatedAt !== scope.evaluatedAt ||
    projection.state !== "current" ||
    Date.parse(result.reviewedAt) > Date.parse(scope.evaluatedAt) ||
    result.sourceRecordIds.some((recordId) => !scope.sourceRecordIds.has(recordId))
  ) {
    throw new Error(`CanopyProof canonical ESG metric result is not current: ${result.id}`);
  }
  return {
    organizationId: result.organizationId,
    projectId: result.projectId,
    resultId: result.id,
    resultRoot: result.resultRoot,
    resultProjectionRoot: projection.projectionRoot,
    definitionId: result.definitionId,
    definitionRoot: result.definitionRoot,
    definitionVersion: result.definitionVersion,
    valueState: result.valueState,
    ...(result.decimalValue !== undefined ? { decimalValue: result.decimalValue } : {}),
    unit: result.unit,
    ...(result.detectionLimit !== undefined ? { detectionLimit: result.detectionLimit } : {}),
    uncertaintyRoot: result.uncertainty.uncertaintyRoot,
    reviewedAt: result.reviewedAt,
  };
}

export function verifyCanopyProofEsgMetricResultProjection(
  projection: CanopyProofEsgMetricResultProjection,
) {
  const seed = {
    organizationId: projection.organizationId,
    projectId: projection.projectId,
    resultId: projection.resultId,
    resultRoot: projection.resultRoot,
    definitionId: projection.definitionId,
    definitionRoot: projection.definitionRoot,
    state: projection.state,
    evaluatedAt: projection.evaluatedAt,
    sourceCount: projection.sourceCount,
    currentSourceCount: projection.currentSourceCount,
    issueCodes: projection.issueCodes,
    currentSourceRoot: projection.currentSourceRoot,
  };
  return (
    projection.projectionRoot ===
      hashJson({ kind: "canopyproof-esg-metric-result-projection-v1", ...seed }) &&
    hashJson(projection.safety) === hashJson(canopyProofEsgMetricSafetyBoundary())
  );
}

function createMetricMember(
  reportId: string,
  memberIndex: number,
  metric: CanopyProofCanonicalMetricResultSeed,
  safety: CanopyProofCanonicalEsgReportingSafetyBoundary,
): CanopyProofCanonicalEsgMetricMemberFact {
  const seed = { reportId, memberIndex, ...metric };
  const memberHash = hashJson({ kind: "canopyproof-canonical-esg-metric-member-v1", ...seed });
  const id = `cp_canonical_esg_metric_${memberHash.slice(0, 24)}`;
  const memberRoot = hashJson({
    kind: "canopyproof-canonical-esg-metric-member-root-v1",
    id,
    ...seed,
    memberHash,
  });
  return { factType: "canonical_esg_report_metric_member", id, ...seed, memberHash, memberRoot, safety };
}

export function verifyCanopyProofCanonicalEsgMetricMember(
  member: CanopyProofCanonicalEsgMetricMemberFact,
  reportId: string,
  memberIndex: number,
) {
  if (
    member.factType !== "canonical_esg_report_metric_member" ||
    member.reportId !== reportId ||
    member.memberIndex !== memberIndex ||
    hashJson(member.safety) !== hashJson(canopyProofCanonicalEsgReportingSafetyBoundary())
  ) return false;
  const seed = metricMemberToSeed(member);
  const memberHash = hashJson({ kind: "canopyproof-canonical-esg-metric-member-v1", reportId, memberIndex, ...seed });
  const id = `cp_canonical_esg_metric_${memberHash.slice(0, 24)}`;
  return member.id === id && member.memberHash === memberHash && member.memberRoot === hashJson({
    kind: "canopyproof-canonical-esg-metric-member-root-v1",
    id,
    reportId,
    memberIndex,
    ...seed,
    memberHash,
  });
}

function metricMemberToSeed(member: CanopyProofCanonicalEsgMetricMemberFact): CanopyProofCanonicalMetricResultSeed {
  return {
    organizationId: member.organizationId,
    projectId: member.projectId,
    resultId: member.resultId,
    resultRoot: member.resultRoot,
    resultProjectionRoot: member.resultProjectionRoot,
    definitionId: member.definitionId,
    definitionRoot: member.definitionRoot,
    definitionVersion: member.definitionVersion,
    valueState: member.valueState,
    ...(member.decimalValue !== undefined ? { decimalValue: member.decimalValue } : {}),
    unit: member.unit,
    ...(member.detectionLimit !== undefined ? { detectionLimit: member.detectionLimit } : {}),
    uncertaintyRoot: member.uncertaintyRoot,
    reviewedAt: member.reviewedAt,
  };
}

function createMember(
  reportId: string,
  memberIndex: number,
  source: CanopyProofCanonicalEnvironmentalSourceSeed,
  safety: CanopyProofCanonicalEsgReportingSafetyBoundary,
): CanopyProofCanonicalEsgReportMemberFact {
  const seed = {
    reportId,
    organizationId: source.organizationId,
    projectId: source.projectId,
    memberIndex,
    recordId: source.recordId,
    recordRoot: source.recordRoot,
    governedRecordProjectionRoot: source.governedRecordProjectionRoot,
    lifecycleBindingId: source.lifecycleBindingId,
    lifecycleBindingRoot: source.lifecycleBindingRoot,
    lifecycleProjectionRoot: source.lifecycleProjectionRoot,
    signingKeyAuthorityId: source.signingKeyAuthorityId,
    signingKeyRoot: source.signingKeyRoot,
    signatureReceiptId: source.signatureReceiptId,
    signatureReceiptRoot: source.signatureReceiptRoot,
    mrvSnapshotId: source.mrvSnapshotId,
    mrvSnapshotRoot: source.mrvSnapshotRoot,
    evidenceRoot: source.evidenceRoot,
    verificationRoot: source.verificationRoot,
    monitoringRoot: source.monitoringRoot,
    confidenceScore: source.confidenceScore,
  };
  const memberHash = hashJson({ kind: "canopyproof-canonical-esg-report-member-v1", ...seed });
  const id = `cp_canonical_esg_member_${memberHash.slice(0, 24)}`;
  const memberRoot = hashJson({ kind: "canopyproof-canonical-esg-report-member-root-v1", id, ...seed, memberHash });
  return { factType: "canonical_esg_report_member", id, ...seed, memberHash, memberRoot, safety };
}

export function verifyCanopyProofCanonicalEsgReportMember(
  member: CanopyProofCanonicalEsgReportMemberFact,
  reportId: string,
  memberIndex: number,
) {
  if (
    member.factType !== "canonical_esg_report_member" ||
    member.reportId !== reportId ||
    member.memberIndex !== memberIndex ||
    hashJson(member.safety) !== hashJson(canopyProofCanonicalEsgReportingSafetyBoundary())
  ) {
    return false;
  }
  const seed = {
    reportId: member.reportId,
    organizationId: member.organizationId,
    projectId: member.projectId,
    memberIndex: member.memberIndex,
    recordId: member.recordId,
    recordRoot: member.recordRoot,
    governedRecordProjectionRoot: member.governedRecordProjectionRoot,
    lifecycleBindingId: member.lifecycleBindingId,
    lifecycleBindingRoot: member.lifecycleBindingRoot,
    lifecycleProjectionRoot: member.lifecycleProjectionRoot,
    signingKeyAuthorityId: member.signingKeyAuthorityId,
    signingKeyRoot: member.signingKeyRoot,
    signatureReceiptId: member.signatureReceiptId,
    signatureReceiptRoot: member.signatureReceiptRoot,
    mrvSnapshotId: member.mrvSnapshotId,
    mrvSnapshotRoot: member.mrvSnapshotRoot,
    evidenceRoot: member.evidenceRoot,
    verificationRoot: member.verificationRoot,
    monitoringRoot: member.monitoringRoot,
    confidenceScore: member.confidenceScore,
  };
  const memberHash = hashJson({ kind: "canopyproof-canonical-esg-report-member-v1", ...seed });
  const id = `cp_canonical_esg_member_${memberHash.slice(0, 24)}`;
  return (
    member.id === id &&
    member.memberHash === memberHash &&
    member.memberRoot ===
      hashJson({ kind: "canopyproof-canonical-esg-report-member-root-v1", id, ...seed, memberHash })
  );
}

function buildDisclosures(
  frameworks: readonly CanopyProofCanonicalEsgFramework[],
  sourceRecordIds: readonly string[],
  sourceRoot: string,
  metricResultIds: readonly string[],
  metricRoot: string,
): readonly CanopyProofCanonicalEsgFrameworkDisclosure[] {
  const templates: Record<CanopyProofCanonicalEsgFramework, Omit<CanopyProofCanonicalEsgFrameworkDisclosure, "framework" | "sourceRecordIds" | "sourceRoot" | "metricResultIds" | "metricRoot">> = {
    GRI: {
      status: "preparation_only",
      title: "GRI environmental disclosure preparation",
      statement: "Source-linked environmental accountability facts are organized for independent GRI mapping review.",
      limitations: ["No GRI conformance or external assurance is asserted."],
    },
    SDG: {
      status: "preparation_only",
      title: "UN Sustainable Development Goal mapping preparation",
      statement: "Current Environmental Proof sources are linked for independent SDG 6, 13, and 15 mapping review.",
      limitations: ["No United Nations endorsement or SDG achievement claim is asserted."],
    },
    TNFD: {
      status: "preparation_only",
      title: "TNFD nature-related disclosure preparation",
      statement: "Governance, strategy, risk, metric, and limitation anchors are prepared for independent TNFD review.",
      limitations: ["This is not a TNFD filing or assurance opinion."],
    },
    BIODIVERSITY: {
      status: "preparation_only",
      title: "Biodiversity accountability preparation",
      statement: "Biodiversity observations remain bounded to signed, monitored Environmental Proof sources.",
      limitations: ["No ecosystem completeness, permanence, or recovery guarantee is asserted."],
    },
    CLIMATE_IMPACT: {
      status: "preparation_only",
      title: "Climate impact accountability preparation",
      statement: "Climate observations remain evidence-linked and challenge-aware for independent review.",
      limitations: ["No certified credit, tax offset, financial asset, or guaranteed yield is created."],
    },
  };
  return frameworks.map((framework) => ({
    framework,
    ...templates[framework],
    sourceRecordIds,
    sourceRoot,
    metricResultIds,
    metricRoot,
  }));
}

function canonicalFrameworks(values: readonly CanopyProofCanonicalEsgFramework[]) {
  return [...new Set(values)].sort() as CanopyProofCanonicalEsgFramework[];
}

function canonicalTopics(values: readonly string[]) {
  const topics = [...new Set(values.map((value) => value.trim()))].sort();
  assertSafeText(topics);
  return topics;
}

function canonicalIdentifiers(values: readonly string[], label: string) {
  const parsed = values.map((value) => identifierSchema.parse(value));
  const normalized = [...new Set(parsed)].sort();
  if (normalized.length !== parsed.length) throw new Error(`CanopyProof canonical ESG ${label} must be unique.`);
  return normalized;
}

function canonicalTimestamp(value: string, label: string) {
  const parsed = timestampSchema.parse(value);
  const date = new Date(parsed);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== parsed) {
    throw new Error(`CanopyProof canonical ESG ${label} must be millisecond-normalized UTC.`);
  }
  return parsed;
}

function assertSafeText(values: readonly string[]) {
  for (const value of values) {
    if (unsafeReportingPatterns.some((pattern) => pattern.test(value) && !/\bnot\b/i.test(value))) {
      throw new Error(`CanopyProof canonical ESG text contains an unsupported claim: ${value}`);
    }
  }
}
