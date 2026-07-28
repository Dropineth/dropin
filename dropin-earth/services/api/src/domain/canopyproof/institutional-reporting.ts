import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import type { CanopyProofOrganizationProfile, CanopyProofPartnerService } from "./partner-collaboration.js";
import {
  verifyCanopyProofCanonicalEsgMetricMember,
  verifyCanopyProofCanonicalEsgReportMember,
  type CanopyProofCanonicalEsgReportBundle,
  type CanopyProofCanonicalEsgReportProjection,
  type CanopyProofCanonicalEsgReportingSafetyBoundary,
} from "./esg-reporting-authority.js";
import { canopyProofEsgReportingCompatibilityStatus } from "./esg-reporting.js";
import {
  appendCanopyProofAuditEvent,
  environmentalProofClaimBoundary,
  type CanopyProofAuditEvent,
  type EnvironmentalProofRecord,
} from "./proof-engine.js";
import type { CanopyProofService } from "./proof-service.js";

export const canopyProofInstitutionalFrameworks = ["UN_SDG", "UNFCCC", "GRI", "ISSB", "TCFD"] as const;

export type CanopyProofInstitutionalFramework = (typeof canopyProofInstitutionalFrameworks)[number];

export type CanopyProofInstitutionalReportingPeriod = {
  readonly startsAt: string;
  readonly endsAt: string;
};

export type CanopyProofCanonicalInstitutionalReportSource = {
  readonly sourceType: "canonical_esg_report";
  readonly authority: "canopyproof-canonical-esg-reporting-authority";
  readonly canonical: true;
  readonly organizationId: string;
  readonly projectId: string;
  readonly reportId: string;
  readonly reportRoot: string;
  readonly projectionRoot: string;
  readonly projectionState: "current";
  readonly frameworks: readonly string[];
  readonly sourceRecordIds: readonly string[];
  readonly sourceMemberRoots: readonly string[];
  readonly metricResultIds: readonly string[];
  readonly metricMemberRoots: readonly string[];
  readonly metricSetRoot: string;
  readonly currentMetricRoot: string;
  readonly evidenceRoot: string;
  readonly verificationRoot: string;
  readonly monitoringRoot: string;
  readonly confidenceScore: number;
  readonly limitations: readonly string[];
  readonly sourceRoot: string;
  readonly institutionalRelianceAuthorized: false;
  readonly safety: CanopyProofCanonicalEsgReportingSafetyBoundary;
};

export function resolveCanonicalEsgInstitutionalSource(
  bundle: CanopyProofCanonicalEsgReportBundle,
  projection: CanopyProofCanonicalEsgReportProjection,
): CanopyProofCanonicalInstitutionalReportSource {
  const { report } = bundle;
  const members = [...bundle.members].sort((left, right) => left.memberIndex - right.memberIndex);
  const memberIds = new Set(members.map((member) => member.id));
  const memberRecordIds = members.map((member) => member.recordId);
  const memberRoots = members.map((member) => member.memberRoot);
  const metricMembers = [...bundle.metricMembers].sort((left, right) => left.memberIndex - right.memberIndex);
  const metricMemberIds = new Set(metricMembers.map((member) => member.id));
  const metricResultIds = metricMembers.map((member) => member.resultId);
  const metricMemberRoots = metricMembers.map((member) => member.memberRoot);
  const projectionSeed = {
    organizationId: projection.organizationId,
    projectId: projection.projectId,
    reportId: projection.reportId,
    reportRoot: projection.reportRoot,
    state: projection.state,
    evaluatedAt: projection.evaluatedAt,
    sourceCount: projection.sourceCount,
    currentSourceCount: projection.currentSourceCount,
    issueCodes: projection.issueCodes,
    currentSourceRoot: projection.currentSourceRoot,
    metricCount: projection.metricCount,
    currentMetricCount: projection.currentMetricCount,
    currentMetricRoot: projection.currentMetricRoot,
  };

  if (
    projection.projectionRoot !==
      hashJson({ kind: "canopyproof-canonical-esg-report-projection-v1", ...projectionSeed }) ||
    hashJson(projection.safety) !== hashJson(report.safety) ||
    projection.state !== "current" ||
    projection.issueCodes.length > 0 ||
    projection.reportId !== report.id ||
    projection.reportRoot !== report.reportRoot ||
    projection.organizationId !== report.organization.id ||
    projection.projectId !== report.projectId ||
    projection.sourceCount !== report.sourceCount ||
    projection.currentSourceCount !== report.sourceCount ||
    projection.metricCount !== report.metricCount ||
    projection.currentMetricCount !== report.metricCount
  ) {
    throw new Error(`CanopyProof institutional reporting requires a current canonical ESG projection: ${report.id}`);
  }
  if (
    members.length === 0 ||
    memberIds.size !== members.length ||
    members.some(
      (member, index) =>
        !verifyCanopyProofCanonicalEsgReportMember(member, report.id, index) ||
        member.memberIndex !== index ||
        member.reportId !== report.id ||
        member.organizationId !== report.organization.id ||
        member.projectId !== report.projectId,
    ) ||
    hashJson(memberRecordIds) !== hashJson(report.sourceRecordIds) ||
    hashJson(memberRoots) !== hashJson(report.sourceMemberRoots) ||
    merkleRoot(memberRoots) !== report.sourceSetRoot ||
    merkleRoot(members.map((member) => member.evidenceRoot)) !== report.evidenceRoot ||
    merkleRoot(members.map((member) => member.verificationRoot)) !== report.verificationRoot ||
    merkleRoot(members.map((member) => member.monitoringRoot)) !== report.monitoringRoot ||
    Math.min(...members.map((member) => member.confidenceScore)) !== report.confidenceScore
  ) {
    throw new Error(`CanopyProof canonical ESG institutional source lineage is invalid: ${report.id}`);
  }
  if (
    metricMembers.length === 0 ||
    metricMemberIds.size !== metricMembers.length ||
    metricMembers.some(
      (member, index) =>
        !verifyCanopyProofCanonicalEsgMetricMember(member, report.id, index) ||
        member.memberIndex !== index ||
        member.reportId !== report.id ||
        member.organizationId !== report.organization.id ||
        member.projectId !== report.projectId,
    ) ||
    hashJson(metricResultIds) !== hashJson(report.metricResultIds) ||
    hashJson(metricMemberRoots) !== hashJson(report.metricMemberRoots) ||
    merkleRoot(metricMemberRoots) !== report.metricSetRoot ||
    report.disclosures.some(
      (disclosure) =>
        hashJson(disclosure.sourceRecordIds) !== hashJson(report.sourceRecordIds) ||
        disclosure.sourceRoot !== report.sourceSetRoot ||
        hashJson(disclosure.metricResultIds) !== hashJson(report.metricResultIds) ||
        disclosure.metricRoot !== report.metricSetRoot,
    )
  ) {
    throw new Error(`CanopyProof canonical ESG institutional metric lineage is invalid: ${report.id}`);
  }

  const limitations = [
    ...new Set(report.disclosures.flatMap((disclosure) => disclosure.limitations)),
    "Canonical ESG reports are framework-preparation artifacts, not assurance opinions or institutional accreditation.",
  ].sort();
  const sourceSeed = {
    sourceType: "canonical_esg_report" as const,
    authority: "canopyproof-canonical-esg-reporting-authority" as const,
    canonical: true as const,
    organizationId: report.organization.id,
    projectId: report.projectId,
    reportId: report.id,
    reportRoot: report.reportRoot,
    projectionRoot: projection.projectionRoot,
    projectionState: "current" as const,
    frameworks: report.frameworks,
    sourceRecordIds: report.sourceRecordIds,
    sourceMemberRoots: report.sourceMemberRoots,
    metricResultIds: report.metricResultIds,
    metricMemberRoots: report.metricMemberRoots,
    metricSetRoot: report.metricSetRoot,
    currentMetricRoot: projection.currentMetricRoot,
    evidenceRoot: report.evidenceRoot,
    verificationRoot: report.verificationRoot,
    monitoringRoot: report.monitoringRoot,
    confidenceScore: report.confidenceScore,
    limitations,
  };
  return {
    ...sourceSeed,
    sourceRoot: hashJson({ kind: "canopyproof-canonical-institutional-report-source-v1", ...sourceSeed }),
    institutionalRelianceAuthorized: false,
    safety: report.safety,
  };
}

export type CanopyProofInstitutionalMetric = {
  readonly id: string;
  readonly name: string;
  readonly value: number | string;
  readonly unit?: string;
  readonly source: {
    readonly proofRecordId: string;
    readonly proofRecordHash: string;
    readonly evidenceRoot: string;
  };
  readonly methodology: string;
  readonly confidence: number;
  readonly verificationReference: string;
  readonly auditReference: string;
  readonly limitations: readonly string[];
};

export type CanopyProofFrameworkSection = {
  readonly code: string;
  readonly title: string;
  readonly sourceMetricIds: readonly string[];
  readonly statement: string;
  readonly limitations: readonly string[];
};

export type CanopyProofInstitutionalExport = {
  readonly mediaType: "application/json" | "application/pdf";
  readonly href: string;
  readonly contentHash: string;
};

export type CanopyProofFrameworkReportPackage = {
  readonly id: string;
  readonly packageType: "institutional_framework_report_package";
  readonly framework: CanopyProofInstitutionalFramework;
  readonly organization: Pick<
    CanopyProofOrganizationProfile,
    "id" | "legalName" | "organizationType" | "jurisdiction" | "verificationStatus" | "trustLevel"
  >;
  readonly reportingPeriod: CanopyProofInstitutionalReportingPeriod;
  readonly generatedAt: string;
  readonly generatedBy: string;
  readonly proofRecordIds: readonly string[];
  readonly esgReportIds: readonly string[];
  readonly proofRecordHashes: readonly string[];
  readonly evidenceRoot: string;
  readonly verificationRoot: string;
  readonly metrics: readonly CanopyProofInstitutionalMetric[];
  readonly sections: readonly CanopyProofFrameworkSection[];
  readonly methodology: string;
  readonly confidence: number;
  readonly verificationReferences: readonly string[];
  readonly auditReferences: readonly string[];
  readonly limitations: readonly string[];
  readonly claimBoundary: ReturnType<typeof environmentalProofClaimBoundary>;
  readonly packageRoot: string;
  readonly exports: {
    readonly json: CanopyProofInstitutionalExport;
    readonly pdf: CanopyProofInstitutionalExport;
    readonly api: {
      readonly href: string;
      readonly mediaType: "application/json";
    };
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofInvestorReviewPackage = {
  readonly id: string;
  readonly packageType: "investor_due_diligence_review_package";
  readonly organization: Pick<
    CanopyProofOrganizationProfile,
    | "id"
    | "legalName"
    | "organizationType"
    | "jurisdiction"
    | "registrationNumber"
    | "verificationStatus"
    | "trustLevel"
    | "accreditationStatus"
  >;
  readonly reportingPeriod: CanopyProofInstitutionalReportingPeriod;
  readonly generatedAt: string;
  readonly generatedBy: string;
  readonly projectPortfolio: readonly CanopyProofInvestorProjectPortfolioItem[];
  readonly evidenceCoverage: {
    readonly proofRecordCount: number;
    readonly evidenceIdCount: number;
    readonly regionCount: number;
    readonly evidenceRoot: string;
    readonly statement: string;
  };
  readonly verificationStatistics: {
    readonly issuedRecordCount: number;
    readonly challengedRecordCount: number;
    readonly revokedRecordCount: number;
    readonly minimumConfidence: number;
    readonly verificationRoot: string;
    readonly humanReviewRequired: true;
  };
  readonly riskProfile: readonly CanopyProofInvestorRiskProfileItem[];
  readonly auditHistory: {
    readonly organizationAuditRoots: readonly string[];
    readonly proofAuditRoots: readonly string[];
    readonly esgAuditRoots: readonly string[];
  };
  readonly esgReports: readonly {
    readonly id: string;
    readonly projectId: string;
    readonly evidenceRoot: string;
    readonly verificationRoot: string;
    readonly confidenceScore: number;
  }[];
  readonly proofRecordIds: readonly string[];
  readonly esgReportIds: readonly string[];
  readonly claimBoundary: ReturnType<typeof environmentalProofClaimBoundary>;
  readonly packageRoot: string;
  readonly exports: {
    readonly json: CanopyProofInstitutionalExport;
    readonly pdf: CanopyProofInstitutionalExport;
    readonly api: {
      readonly href: string;
      readonly mediaType: "application/json";
    };
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofInvestorProjectPortfolioItem = {
  readonly projectId: string;
  readonly title: string;
  readonly regionId?: string;
  readonly status: "active" | "monitoring" | "paused" | "completed";
  readonly proofRecordIds: readonly string[];
};

export type CanopyProofInvestorRiskProfileItem = {
  readonly riskId: string;
  readonly severity: "low" | "medium" | "high" | "critical";
  readonly category: string;
  readonly summary: string;
  readonly mitigation: string;
  readonly sourceReference: string;
};

const reportingPeriodSchema = z.object({
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

const institutionalMetricSchema = z
  .object({
    id: z.string().min(1).optional(),
    name: z.string().min(2),
    value: z.union([z.number().finite(), z.string().min(1)]),
    unit: z.string().min(1).optional(),
    sourceRecordId: z.string().min(1),
    methodology: z.string().min(12),
    confidence: z.number().min(0).max(100),
    verificationReference: z.string().min(1),
    auditReference: z.string().min(1),
    limitations: z.array(z.string().min(1)).min(1),
  })
  .strict();

const frameworkPackageSchema = z
  .object({
    organizationId: z.string().min(1),
    framework: z.enum(canopyProofInstitutionalFrameworks),
    reportingPeriod: reportingPeriodSchema,
    generatedAt: z.string().datetime().optional(),
    proofRecordIds: z.array(z.string().min(1)).min(1),
    esgReportIds: z.array(z.string().min(1)).default([]),
    metrics: z.array(institutionalMetricSchema).min(1),
    methodology: z.string().min(20),
    limitations: z.array(z.string().min(1)).default([
      "Institutional report packages are evidence-linked accountability packages, not assurance opinions.",
      "No certified carbon-credit, carbon-tax offset, financial-asset, automatic-CANOPY, or guaranteed-yield claim is made.",
    ]),
  })
  .strict();

const investorProjectPortfolioSchema = z
  .object({
    projectId: z.string().min(1),
    title: z.string().min(2),
    regionId: z.string().min(1).optional(),
    status: z.enum(["active", "monitoring", "paused", "completed"]),
    proofRecordIds: z.array(z.string().min(1)).default([]),
  })
  .strict();

const investorRiskProfileSchema = z
  .object({
    riskId: z.string().min(1).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]),
    category: z.string().min(2),
    summary: z.string().min(12),
    mitigation: z.string().min(12),
    sourceReference: z.string().min(1),
  })
  .strict();

const investorReviewPackageSchema = z
  .object({
    organizationId: z.string().min(1),
    reportingPeriod: reportingPeriodSchema,
    generatedAt: z.string().datetime().optional(),
    proofRecordIds: z.array(z.string().min(1)).min(1),
    esgReportIds: z.array(z.string().min(1)).min(1),
    projectPortfolio: z.array(investorProjectPortfolioSchema).optional(),
    riskProfile: z.array(investorRiskProfileSchema).default([]),
  })
  .strict();

export class CanopyProofInstitutionalReportingService {
  private readonly frameworkPackagesById = new Map<string, CanopyProofFrameworkReportPackage>();
  private readonly investorPackagesById = new Map<string, CanopyProofInvestorReviewPackage>();

  constructor(
    private readonly proofService: CanopyProofService,
    private readonly partnerService: CanopyProofPartnerService,
  ) {}

  generateFrameworkPackage(input: unknown, actorId: string): CanopyProofFrameworkReportPackage {
    const parsed = frameworkPackageSchema.parse(input);
    assertReportingPeriod(parsed.reportingPeriod);
    const generatedAt = parsed.generatedAt ?? new Date(0).toISOString();
    const organization = this.verifiedOrganization(parsed.organizationId);
    const proofRecords = this.issuedProofRecords(parsed.proofRecordIds);
    const esgReports = parsed.esgReportIds.map((reportId) => this.proofService.getEsgReport(reportId));
    assertSafeInstitutionalText([
      organization.legalName,
      parsed.methodology,
      ...parsed.limitations,
      ...parsed.metrics.flatMap((metric) => [
        metric.name,
        String(metric.value),
        metric.unit ?? "unitless",
        metric.methodology,
        metric.verificationReference,
        metric.auditReference,
        ...metric.limitations,
      ]),
    ]);

    const normalizedMetrics = normalizeMetrics(parsed.metrics, proofRecords);
    const proofRecordIds = proofRecords.map((record) => record.id).sort();
    const proofRecordHashes = proofRecords.map((record) => record.recordHash).sort();
    const esgReportIds = esgReports.map((report) => report.id).sort();
    const evidenceRoot = merkleRoot(proofRecords.map((record) => record.evidenceRoot).sort());
    const verificationRoot = merkleRoot(proofRecords.flatMap((record) => record.verificationHistory.map((event) => event.eventRoot)).sort());
    const confidence = Math.min(...normalizedMetrics.map((metric) => metric.confidence), ...proofRecords.map((record) => record.confidence_score));
    const verificationReferences = [...new Set(normalizedMetrics.map((metric) => metric.verificationReference))].sort();
    const auditReferences = [
      ...new Set([
        ...normalizedMetrics.map((metric) => metric.auditReference),
        ...proofRecords.flatMap((record) => record.verificationHistory.map((event) => event.eventRoot)),
        ...esgReports.map((report) => report.auditEvent.eventRoot),
      ]),
    ].sort();
    const sections = buildFrameworkSections(parsed.framework, normalizedMetrics, proofRecords);
    const packageSeed = {
      kind: "canopyproof-institutional-framework-package-v1",
      framework: parsed.framework,
      organizationId: organization.id,
      reportingPeriod: parsed.reportingPeriod,
      generatedAt,
      proofRecordIds,
      esgReportIds,
      proofRecordHashes,
      evidenceRoot,
      verificationRoot,
      metrics: normalizedMetrics,
      sections,
      methodology: parsed.methodology,
      confidence,
      limitations: parsed.limitations,
    };
    const packageRoot = hashJson(packageSeed);
    const id = `cp_framework_pkg_${packageRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: actorId,
      entityType: "institutional_report_package",
      entityId: id,
      payload: {
        framework: parsed.framework,
        organizationId: organization.id,
        proofRecordIds,
        esgReportIds,
        packageRoot,
        evidenceRoot,
        verificationRoot,
      },
      createdAt: generatedAt,
      rationale: "Institutional framework report package generated from issued Environmental Proof Records and audited metric references.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof institutional framework package failed to append audit event.");
    }

    const packageRecord: CanopyProofFrameworkReportPackage = {
      id,
      packageType: "institutional_framework_report_package",
      framework: parsed.framework,
      organization: publicOrganizationSnapshot(organization),
      reportingPeriod: parsed.reportingPeriod,
      generatedAt,
      generatedBy: actorId,
      proofRecordIds,
      esgReportIds,
      proofRecordHashes,
      evidenceRoot,
      verificationRoot,
      metrics: normalizedMetrics,
      sections,
      methodology: parsed.methodology,
      confidence,
      verificationReferences,
      auditReferences,
      limitations: parsed.limitations,
      claimBoundary: environmentalProofClaimBoundary(),
      packageRoot,
      exports: packageExports("framework-packages", id, packageRoot),
      auditEvent,
    };
    this.frameworkPackagesById.set(packageRecord.id, packageRecord);
    return packageRecord;
  }

  listFrameworkPackages(framework?: string): readonly CanopyProofFrameworkReportPackage[] {
    const packages = [...this.frameworkPackagesById.values()];
    return (framework ? packages.filter((item) => item.framework === framework) : packages).sort((left, right) =>
      right.generatedAt.localeCompare(left.generatedAt),
    );
  }

  getFrameworkPackage(packageId: string): CanopyProofFrameworkReportPackage {
    const packageRecord = this.frameworkPackagesById.get(packageId);
    if (!packageRecord) {
      throw new Error(`CanopyProof institutional framework package not found: ${packageId}`);
    }
    return packageRecord;
  }

  exportFrameworkPackageJson(packageId: string): string {
    return `${JSON.stringify(this.getFrameworkPackage(packageId), null, 2)}\n`;
  }

  exportFrameworkPackagePdf(packageId: string): Uint8Array<ArrayBuffer> {
    return renderInstitutionalPackagePdf(this.getFrameworkPackage(packageId));
  }

  generateInvestorReviewPackage(input: unknown, actorId: string): CanopyProofInvestorReviewPackage {
    const parsed = investorReviewPackageSchema.parse(input);
    assertReportingPeriod(parsed.reportingPeriod);
    const generatedAt = parsed.generatedAt ?? new Date(0).toISOString();
    const organization = this.verifiedOrganization(parsed.organizationId);
    const proofRecords = this.issuedProofRecords(parsed.proofRecordIds);
    const esgReports = parsed.esgReportIds.map((reportId) => this.proofService.getEsgReport(reportId));
    const riskProfile = parsed.riskProfile.map((risk) => normalizeRiskProfileItem(risk));
    assertSafeInstitutionalText([
      organization.legalName,
      ...riskProfile.flatMap((risk) => [risk.category, risk.summary, risk.mitigation, risk.sourceReference]),
      ...(parsed.projectPortfolio ?? []).flatMap((project) => [project.title, project.regionId ?? "unscoped"]),
    ]);
    const proofRecordIds = proofRecords.map((record) => record.id).sort();
    const esgReportIds = esgReports.map((report) => report.id).sort();
    const evidenceIds = [...new Set(proofRecords.flatMap((record) => record.evidenceIds))].sort();
    const regions = [...new Set(proofRecords.map((record) => record.location.regionId ?? "unscoped-region"))].sort();
    const evidenceRoot = merkleRoot(proofRecords.map((record) => record.evidenceRoot).sort());
    const verificationRoot = merkleRoot(proofRecords.flatMap((record) => record.verificationHistory.map((event) => event.eventRoot)).sort());
    const projectPortfolio = normalizeProjectPortfolio(parsed.projectPortfolio, proofRecords);
    const issuedRecordCount = proofRecords.filter((record) => record.status === "issued").length;
    const challengedRecordCount = proofRecords.filter((record) => record.status === "challenged").length;
    const revokedRecordCount = proofRecords.filter((record) => record.status === "revoked").length;
    const minimumConfidence = Math.min(...proofRecords.map((record) => record.confidence_score));
    const packageSeed = {
      kind: "canopyproof-investor-due-diligence-package-v1",
      organizationId: organization.id,
      reportingPeriod: parsed.reportingPeriod,
      generatedAt,
      proofRecordIds,
      esgReportIds,
      evidenceRoot,
      verificationRoot,
      projectPortfolio,
      riskProfile,
      issuedRecordCount,
      challengedRecordCount,
      revokedRecordCount,
      minimumConfidence,
    };
    const packageRoot = hashJson(packageSeed);
    const id = `cp_investor_pkg_${packageRoot.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: actorId,
      entityType: "investor_review_package",
      entityId: id,
      payload: {
        organizationId: organization.id,
        proofRecordIds,
        esgReportIds,
        packageRoot,
        evidenceRoot,
        verificationRoot,
      },
      createdAt: generatedAt,
      rationale: "Investor due-diligence package generated from institutional identity, ESG reports, proof records, and audit lineage.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof investor due-diligence package failed to append audit event.");
    }

    const packageRecord: CanopyProofInvestorReviewPackage = {
      id,
      packageType: "investor_due_diligence_review_package",
      organization: investorOrganizationSnapshot(organization),
      reportingPeriod: parsed.reportingPeriod,
      generatedAt,
      generatedBy: actorId,
      projectPortfolio,
      evidenceCoverage: {
        proofRecordCount: proofRecords.length,
        evidenceIdCount: evidenceIds.length,
        regionCount: regions.length,
        evidenceRoot,
        statement: "Coverage is computed only from issued Environmental Proof Records and does not imply certified offset issuance.",
      },
      verificationStatistics: {
        issuedRecordCount,
        challengedRecordCount,
        revokedRecordCount,
        minimumConfidence,
        verificationRoot,
        humanReviewRequired: true,
      },
      riskProfile,
      auditHistory: {
        organizationAuditRoots: organization.auditHistory.map((event) => event.eventRoot).sort(),
        proofAuditRoots: proofRecords.flatMap((record) => record.verificationHistory.map((event) => event.eventRoot)).sort(),
        esgAuditRoots: esgReports.map((report) => report.auditEvent.eventRoot).sort(),
      },
      esgReports: esgReports
        .map((report) => ({
          id: report.id,
          projectId: report.projectId,
          evidenceRoot: report.evidenceRoot,
          verificationRoot: report.verificationRoot,
          confidenceScore: report.confidenceScore,
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      proofRecordIds,
      esgReportIds,
      claimBoundary: environmentalProofClaimBoundary(),
      packageRoot,
      exports: packageExports("investor-review-packages", id, packageRoot),
      auditEvent,
    };
    this.investorPackagesById.set(packageRecord.id, packageRecord);
    return packageRecord;
  }

  listInvestorReviewPackages(organizationId?: string): readonly CanopyProofInvestorReviewPackage[] {
    const packages = [...this.investorPackagesById.values()];
    return (organizationId ? packages.filter((item) => item.organization.id === organizationId) : packages).sort((left, right) =>
      right.generatedAt.localeCompare(left.generatedAt),
    );
  }

  getInvestorReviewPackage(packageId: string): CanopyProofInvestorReviewPackage {
    const packageRecord = this.investorPackagesById.get(packageId);
    if (!packageRecord) {
      throw new Error(`CanopyProof investor due-diligence package not found: ${packageId}`);
    }
    return packageRecord;
  }

  exportInvestorReviewPackageJson(packageId: string): string {
    return `${JSON.stringify(this.getInvestorReviewPackage(packageId), null, 2)}\n`;
  }

  exportInvestorReviewPackagePdf(packageId: string): Uint8Array<ArrayBuffer> {
    return renderInstitutionalPackagePdf(this.getInvestorReviewPackage(packageId));
  }

  getStatus() {
    return {
      service: "canopyproof-institutional-reporting",
      supportedFrameworks: canopyProofInstitutionalFrameworks,
      frameworkPackageCount: this.frameworkPackagesById.size,
      investorReviewPackageCount: this.investorPackagesById.size,
      compatibilityEsgSource: canopyProofEsgReportingCompatibilityStatus(),
      canonicalEsgSource: {
        authority: "canopyproof-canonical-esg-reporting-authority",
        adapterImplemented: true,
        routeMounted: false,
        productionRelianceAuthorized: false,
        requiredProjectionState: "current",
      },
      claimBoundary: environmentalProofClaimBoundary(),
    };
  }

  private verifiedOrganization(organizationId: string): CanopyProofOrganizationProfile {
    const organization = this.partnerService.getOrganization(organizationId);
    if (organization.verificationStatus !== "verified") {
      throw new Error(`CanopyProof institutional reporting requires a verified organization: ${organizationId}`);
    }
    if (organization.trustLevel === "suspended") {
      throw new Error(`CanopyProof institutional reporting cannot use a suspended organization: ${organizationId}`);
    }
    return organization;
  }

  private issuedProofRecords(proofRecordIds: readonly string[]): readonly EnvironmentalProofRecord[] {
    const records = proofRecordIds.map((recordId) => this.proofService.getProofRecord(recordId));
    const invalidRecords = records.filter((record) => record.status !== "issued");
    if (invalidRecords.length > 0) {
      throw new Error(`CanopyProof institutional reporting can only use issued proof records: ${invalidRecords.map((record) => record.id).join(",")}`);
    }
    return records;
  }
}

function normalizeMetrics(
  metrics: readonly z.infer<typeof institutionalMetricSchema>[],
  proofRecords: readonly EnvironmentalProofRecord[],
): readonly CanopyProofInstitutionalMetric[] {
  const recordsById = new Map(proofRecords.map((record) => [record.id, record]));
  return metrics
    .map((metric) => {
      const sourceRecord = recordsById.get(metric.sourceRecordId);
      if (!sourceRecord) {
        throw new Error(`CanopyProof institutional metric sourceRecordId is not part of the package proof records: ${metric.sourceRecordId}`);
      }
      const metricHash = hashJson({
        name: metric.name,
        value: metric.value,
        sourceRecordId: metric.sourceRecordId,
        methodology: metric.methodology,
        confidence: metric.confidence,
        verificationReference: metric.verificationReference,
        auditReference: metric.auditReference,
      });
      return {
        id: metric.id ?? `cp_metric_${metricHash.slice(0, 24)}`,
        name: metric.name,
        value: metric.value,
        ...(metric.unit ? { unit: metric.unit } : {}),
        source: {
          proofRecordId: sourceRecord.id,
          proofRecordHash: sourceRecord.recordHash,
          evidenceRoot: sourceRecord.evidenceRoot,
        },
        methodology: metric.methodology,
        confidence: metric.confidence,
        verificationReference: metric.verificationReference,
        auditReference: metric.auditReference,
        limitations: [...metric.limitations].sort(),
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function buildFrameworkSections(
  framework: CanopyProofInstitutionalFramework,
  metrics: readonly CanopyProofInstitutionalMetric[],
  proofRecords: readonly EnvironmentalProofRecord[],
): readonly CanopyProofFrameworkSection[] {
  const metricIds = metrics.map((metric) => metric.id).sort();
  const proofRecordIds = proofRecords.map((record) => record.id).sort();
  const commonLimitations = [
    "Framework sections are compatibility mappings over CanopyProof evidence lineage, not third-party assurance opinions.",
    "Carbon, climate, and nature metrics do not constitute certified carbon credits, tax offsets, financial assets, or guaranteed yield.",
  ];
  if (framework === "UN_SDG") {
    return [
      {
        code: "SDG-6/13/15",
        title: "UN Sustainable Development Goal compatibility mapping",
        sourceMetricIds: metricIds,
        statement: `Metrics are mapped to SDG 6, SDG 13, and SDG 15 using proof records ${proofRecordIds.join(", ")}.`,
        limitations: commonLimitations,
      },
    ];
  }
  if (framework === "UNFCCC") {
    return [
      {
        code: "UNFCCC-ACCOUNTABILITY",
        title: "UNFCCC climate action evidence package",
        sourceMetricIds: metricIds,
        statement: "The package preserves evidence, methodology, confidence, verification, and audit references for climate accountability review.",
        limitations: commonLimitations,
      },
    ];
  }
  if (framework === "GRI") {
    return [
      {
        code: "GRI-304/305",
        title: "GRI nature and climate disclosures",
        sourceMetricIds: metricIds,
        statement: "The package maps proof-linked metrics to biodiversity and climate disclosure inputs with unresolved limitations retained.",
        limitations: commonLimitations,
      },
    ];
  }
  if (framework === "ISSB") {
    return [
      {
        code: "ISSB-S1/S2",
        title: "ISSB governance, risk, and climate disclosure preparation",
        sourceMetricIds: metricIds,
        statement: "The package preserves investor-grade lineage for governance, strategy, risk, and metrics-and-targets review.",
        limitations: commonLimitations,
      },
    ];
  }
  return [
    {
      code: "TCFD-G/S/R/M",
      title: "TCFD governance, strategy, risk management, metrics and targets",
      sourceMetricIds: metricIds,
      statement: "The package organizes proof-linked metrics for TCFD-style climate risk disclosure review.",
      limitations: commonLimitations,
    },
  ];
}

function normalizeProjectPortfolio(
  providedPortfolio: readonly z.infer<typeof investorProjectPortfolioSchema>[] | undefined,
  proofRecords: readonly EnvironmentalProofRecord[],
): readonly CanopyProofInvestorProjectPortfolioItem[] {
  if (providedPortfolio && providedPortfolio.length > 0) {
    const proofRecordIdSet = new Set(proofRecords.map((record) => record.id));
    return providedPortfolio
      .map((project) => ({
        projectId: project.projectId,
        title: project.title,
        ...(project.regionId ? { regionId: project.regionId } : {}),
        status: project.status,
        proofRecordIds: project.proofRecordIds.filter((recordId) => proofRecordIdSet.has(recordId)).sort(),
      }))
      .sort((left, right) => left.projectId.localeCompare(right.projectId));
  }

  const recordsByProject = new Map<string, EnvironmentalProofRecord[]>();
  for (const record of proofRecords) {
    recordsByProject.set(record.projectId, [...(recordsByProject.get(record.projectId) ?? []), record]);
  }
  return [...recordsByProject.entries()]
    .map(([projectId, records]) => {
      const firstRecord = records[0];
      if (!firstRecord) {
        throw new Error(`CanopyProof investor portfolio derivation failed for project: ${projectId}`);
      }
      return {
        projectId,
        title: projectId,
        ...(firstRecord.location.regionId ? { regionId: firstRecord.location.regionId } : {}),
        status: "monitoring" as const,
        proofRecordIds: records.map((record) => record.id).sort(),
      };
    })
    .sort((left, right) => left.projectId.localeCompare(right.projectId));
}

function normalizeRiskProfileItem(input: z.infer<typeof investorRiskProfileSchema>): CanopyProofInvestorRiskProfileItem {
  const riskHash = hashJson({
    severity: input.severity,
    category: input.category,
    summary: input.summary,
    mitigation: input.mitigation,
    sourceReference: input.sourceReference,
  });
  return {
    riskId: input.riskId ?? `cp_risk_profile_${riskHash.slice(0, 24)}`,
    severity: input.severity,
    category: input.category,
    summary: input.summary,
    mitigation: input.mitigation,
    sourceReference: input.sourceReference,
  };
}

function publicOrganizationSnapshot(
  organization: CanopyProofOrganizationProfile,
): Pick<CanopyProofOrganizationProfile, "id" | "legalName" | "organizationType" | "jurisdiction" | "verificationStatus" | "trustLevel"> {
  return {
    id: organization.id,
    legalName: organization.legalName,
    organizationType: organization.organizationType,
    jurisdiction: organization.jurisdiction,
    verificationStatus: organization.verificationStatus,
    trustLevel: organization.trustLevel,
  };
}

function investorOrganizationSnapshot(
  organization: CanopyProofOrganizationProfile,
): Pick<
  CanopyProofOrganizationProfile,
  "id" | "legalName" | "organizationType" | "jurisdiction" | "registrationNumber" | "verificationStatus" | "trustLevel" | "accreditationStatus"
> {
  return {
    id: organization.id,
    legalName: organization.legalName,
    organizationType: organization.organizationType,
    jurisdiction: organization.jurisdiction,
    ...(organization.registrationNumber ? { registrationNumber: organization.registrationNumber } : {}),
    verificationStatus: organization.verificationStatus,
    trustLevel: organization.trustLevel,
    accreditationStatus: organization.accreditationStatus,
  };
}

function packageExports(
  segment: "framework-packages" | "investor-review-packages",
  id: string,
  packageRoot: string,
): CanopyProofFrameworkReportPackage["exports"] {
  return {
    json: {
      mediaType: "application/json",
      href: `/canopyproof/reports/${segment}/${id}/export.json`,
      contentHash: hashJson({ mediaType: "application/json", packageRoot }),
    },
    pdf: {
      mediaType: "application/pdf",
      href: `/canopyproof/reports/${segment}/${id}/export.pdf`,
      contentHash: hashJson({ mediaType: "application/pdf", packageRoot }),
    },
    api: {
      href: `/canopyproof/reports/${segment}/${id}`,
      mediaType: "application/json",
    },
  };
}

function assertReportingPeriod(period: CanopyProofInstitutionalReportingPeriod) {
  if (Date.parse(period.startsAt) > Date.parse(period.endsAt)) {
    throw new Error("CanopyProof institutional reporting period startsAt cannot be after endsAt.");
  }
}

function assertSafeInstitutionalText(values: readonly string[]) {
  const unsafePatterns = [
    /\bcertified[-\s]+carbon[-\s]+credit\b/i,
    /\bcarbon[-\s]?tax[-\s]+offset\b/i,
    /\bguaranteed(?:[-\s]+rwa)?[-\s]+yield\b/i,
    /\bautomatic[-\s]+(?:\$?canopy|canopy)[-\s]+distribution\b/i,
    /\bmainnet\s+funds?\b/i,
  ];
  for (const value of values) {
    for (const pattern of unsafePatterns) {
      if (pattern.test(value) && !/\bnot\b/i.test(value)) {
        throw new Error(`CanopyProof institutional reporting input contains unsupported public claim: ${value}`);
      }
    }
  }
}

function renderInstitutionalPackagePdf(
  packageRecord: CanopyProofFrameworkReportPackage | CanopyProofInvestorReviewPackage,
): Uint8Array<ArrayBuffer> {
  const lines = [
    "CanopyProof Institutional Package",
    `Package ID: ${packageRecord.id}`,
    `Package type: ${packageRecord.packageType}`,
    `Organization: ${packageRecord.organization.legalName}`,
    `Period: ${packageRecord.reportingPeriod.startsAt} to ${packageRecord.reportingPeriod.endsAt}`,
    `Generated: ${packageRecord.generatedAt}`,
    `Package root: ${packageRecord.packageRoot.slice(0, 32)}...`,
    "Boundary: Environmental Proof Record lineage only.",
    "Not a certified carbon credit, financial asset, carbon-tax offset, guaranteed yield, mainnet-funds, or automatic CANOPY distribution claim.",
  ].map((line) => asciiLine(line, 110));

  const content = [
    "BT",
    "/F1 10 Tf",
    "14 TL",
    "50 780 Td",
    ...lines.flatMap((line, index) => [`(${pdfEscape(line)}) Tj`, ...(index === lines.length - 1 ? [] : ["T*"])]),
    "ET",
  ].join("\n");

  return buildMinimalPdf(content);
}

function asciiLine(value: string, maxLength: number) {
  return value.replace(/[^\x20-\x7e]/g, "?").slice(0, maxLength);
}

function pdfEscape(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildMinimalPdf(content: string): Uint8Array<ArrayBuffer> {
  const contentLength = new TextEncoder().encode(content).length;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${contentLength} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const [index, object] of objects.entries()) {
    offsets.push(new TextEncoder().encode(pdf).length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = new TextEncoder().encode(pdf).length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  const encoded = new TextEncoder().encode(pdf);
  return new Uint8Array(encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength));
}
