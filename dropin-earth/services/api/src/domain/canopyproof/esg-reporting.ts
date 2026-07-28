import { hashJson, merkleRoot } from "@dropin/crypto";
import {
  appendCanopyProofAuditEvent,
  environmentalProofClaimBoundary,
  type CanopyProofAuditEvent,
  type EnvironmentalProofRecord,
} from "./proof-engine.js";

export const canopyProofEsgFrameworks = ["GRI", "SDG", "TNFD", "BIODIVERSITY", "CLIMATE_IMPACT"] as const;

export type CanopyProofEsgFramework = (typeof canopyProofEsgFrameworks)[number];

export type CanopyProofEsgReportingCompatibilityStatus = {
  readonly service: "canopyproof-esg-reporting-compatibility";
  readonly authority: "process_local";
  readonly canonical: false;
  readonly durable: false;
  readonly currentSourceAuthorityReResolved: false;
  readonly routeMounted: true;
  readonly productionRelianceAuthorized: false;
  readonly replacement: "canopyproof-canonical-esg-reporting-authority";
};

export type CanopyProofReportingPeriod = {
  readonly startsAt: string;
  readonly endsAt: string;
};

export type CanopyProofEsgReportExport = {
  readonly mediaType: "application/json" | "application/pdf";
  readonly href: string;
  readonly contentHash: string;
};

export type CanopyProofFrameworkDisclosure = {
  readonly code: string;
  readonly title: string;
  readonly evidence: readonly string[];
  readonly statement: string;
  readonly limitations: readonly string[];
};

export type CanopyProofSdgMapping = {
  readonly goal: "SDG 6" | "SDG 13" | "SDG 15";
  readonly title: string;
  readonly recordIds: readonly string[];
  readonly evidenceRoot: string;
  readonly statement: string;
};

export type CanopyProofTnfdPreparation = {
  readonly governance: readonly string[];
  readonly strategy: readonly string[];
  readonly riskManagement: readonly string[];
  readonly metricsAndTargets: readonly string[];
  readonly limitations: readonly string[];
};

export type CanopyProofEsgReport = {
  readonly id: string;
  readonly reportType: "environmental_accountability_report";
  readonly projectId: string;
  readonly organizationName: string;
  readonly reportingPeriod: CanopyProofReportingPeriod;
  readonly generatedAt: string;
  readonly generatedBy: string;
  readonly frameworks: readonly CanopyProofEsgFramework[];
  readonly proofRecordIds: readonly string[];
  readonly proofRecordHashes: readonly string[];
  readonly evidenceRoot: string;
  readonly verificationRoot: string;
  readonly confidenceScore: number;
  readonly griDisclosures: readonly CanopyProofFrameworkDisclosure[];
  readonly sdgMapping: readonly CanopyProofSdgMapping[];
  readonly tnfdPreparation: CanopyProofTnfdPreparation;
  readonly biodiversityReport: {
    readonly statement: string;
    readonly indicatorCount: number;
    readonly evidenceRoot: string;
    readonly limitations: readonly string[];
  };
  readonly climateImpactReport: {
    readonly statement: string;
    readonly confidenceScore: number;
    readonly proofRecordCount: number;
    readonly limitations: readonly string[];
  };
  readonly lineageIntegrity: {
    readonly allRecordsIssued: boolean;
    readonly recordCount: number;
    readonly evidenceRoot: string;
    readonly verificationRoot: string;
    readonly reportHash: string;
  };
  readonly claimBoundary: ReturnType<typeof environmentalProofClaimBoundary>;
  readonly exports: {
    readonly json: CanopyProofEsgReportExport;
    readonly pdf: CanopyProofEsgReportExport;
    readonly api: {
      readonly href: string;
      readonly mediaType: "application/json";
    };
  };
  readonly auditEvent: CanopyProofAuditEvent;
};

export type BuildCanopyProofEsgReportInput = {
  readonly projectId: string;
  readonly organizationName: string;
  readonly reportingPeriod: CanopyProofReportingPeriod;
  readonly generatedBy: string;
  readonly generatedAt?: string;
  readonly frameworks?: readonly CanopyProofEsgFramework[];
  readonly materialTopics?: readonly string[];
  readonly proofRecords: readonly EnvironmentalProofRecord[];
};

export function canopyProofEsgReportingCompatibilityStatus(): CanopyProofEsgReportingCompatibilityStatus {
  return {
    service: "canopyproof-esg-reporting-compatibility",
    authority: "process_local",
    canonical: false,
    durable: false,
    currentSourceAuthorityReResolved: false,
    routeMounted: true,
    productionRelianceAuthorized: false,
    replacement: "canopyproof-canonical-esg-reporting-authority",
  };
}

export function buildCanopyProofEsgReport(input: BuildCanopyProofEsgReportInput): CanopyProofEsgReport {
  if (!input.projectId.trim()) {
    throw new Error("ESG report requires projectId.");
  }
  if (!input.organizationName.trim()) {
    throw new Error("ESG report requires organizationName.");
  }
  if (!input.generatedBy.trim()) {
    throw new Error("ESG report requires generatedBy actor.");
  }
  if (!Number.isFinite(Date.parse(input.reportingPeriod.startsAt)) || !Number.isFinite(Date.parse(input.reportingPeriod.endsAt))) {
    throw new Error("ESG report requires valid reporting period dates.");
  }
  if (Date.parse(input.reportingPeriod.startsAt) > Date.parse(input.reportingPeriod.endsAt)) {
    throw new Error("ESG report period startsAt cannot be after endsAt.");
  }
  if (input.proofRecords.length === 0) {
    throw new Error("ESG report requires at least one issued Environmental Proof Record.");
  }

  assertSafeReportText([input.organizationName, ...(input.materialTopics ?? [])]);

  const projectRecords = input.proofRecords.filter((record) => record.projectId === input.projectId);
  if (projectRecords.length !== input.proofRecords.length) {
    throw new Error("ESG report proof records must belong to the requested project.");
  }

  const invalidRecords = projectRecords.filter((record) => record.recordType !== "environmental_proof_record" || record.status !== "issued");
  if (invalidRecords.length > 0) {
    throw new Error(`ESG report can only use issued Environmental Proof Records: ${invalidRecords.map((record) => record.id).join(",")}`);
  }

  const generatedAt = input.generatedAt ?? new Date(0).toISOString();
  const frameworks = [...new Set(input.frameworks?.length ? input.frameworks : canopyProofEsgFrameworks)].sort();
  const proofRecordIds = projectRecords.map((record) => record.id).sort();
  const proofRecordHashes = projectRecords.map((record) => record.recordHash).sort();
  const evidenceRoot = merkleRoot(projectRecords.map((record) => record.evidenceRoot).sort());
  const verificationRoot = merkleRoot(projectRecords.flatMap((record) => record.verificationHistory.map((event) => event.eventRoot)).sort());
  const confidenceScore = Math.min(...projectRecords.map((record) => record.confidence_score));
  const recordHash = hashJson({
    kind: "canopyproof-esg-report-v1",
    projectId: input.projectId,
    organizationName: input.organizationName,
    reportingPeriod: input.reportingPeriod,
    generatedAt,
    frameworks,
    proofRecordIds,
    proofRecordHashes,
    evidenceRoot,
    verificationRoot,
    confidenceScore,
  });
  const id = `cp_esg_${recordHash.slice(0, 24)}`;
  const griDisclosures = buildGriDisclosures(projectRecords, input.materialTopics ?? []);
  const sdgMapping = buildSdgMappings(projectRecords, evidenceRoot);
  const tnfdPreparation = buildTnfdPreparation(projectRecords);
  const claimBoundary = environmentalProofClaimBoundary();
  const reportBase = {
    id,
    reportType: "environmental_accountability_report" as const,
    projectId: input.projectId,
    organizationName: input.organizationName,
    reportingPeriod: input.reportingPeriod,
    generatedAt,
    generatedBy: input.generatedBy,
    frameworks,
    proofRecordIds,
    proofRecordHashes,
    evidenceRoot,
    verificationRoot,
    confidenceScore,
    griDisclosures,
    sdgMapping,
    tnfdPreparation,
    biodiversityReport: {
      statement:
        "Biodiversity observations are reported only where they are linked to issued Environmental Proof Records and remain subject to monitoring limitations.",
      indicatorCount: projectRecords.length,
      evidenceRoot,
      limitations: [
        "Biodiversity indicators are proof-linked observations, not an ecosystem completeness guarantee.",
        "Seasonal, sensor, and field-review gaps must remain visible in downstream reporting.",
      ],
    },
    climateImpactReport: {
      statement:
        "Climate impact is represented as evidence-backed environmental accountability, not as an offset, tax credit, financial asset, or guaranteed yield claim.",
      confidenceScore,
      proofRecordCount: projectRecords.length,
      limitations: [
        "Carbon and climate indicators require continued monitoring and do not constitute certified carbon credits.",
        "Report consumers must retain proof status, confidence, and challenge history with every downstream export.",
      ],
    },
    claimBoundary,
  };
  const reportHash = hashJson(reportBase);
  const jsonHref = `/canopyproof/reports/esg/${id}/export.json`;
  const pdfHref = `/canopyproof/reports/esg/${id}/export.pdf`;
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: input.generatedBy,
    entityType: "esg_report",
    entityId: id,
    payload: {
      projectId: input.projectId,
      reportHash,
      proofRecordIds,
      evidenceRoot,
      verificationRoot,
      frameworks,
    },
    createdAt: generatedAt,
    rationale: "ESG report generated from issued Environmental Proof Records with explicit non-credit claim boundaries.",
  }).at(-1);

  if (!auditEvent) {
    throw new Error("ESG report generation failed to append an audit event.");
  }

  return {
    ...reportBase,
    lineageIntegrity: {
      allRecordsIssued: true,
      recordCount: projectRecords.length,
      evidenceRoot,
      verificationRoot,
      reportHash,
    },
    exports: {
      json: {
        mediaType: "application/json",
        href: jsonHref,
        contentHash: hashJson({ mediaType: "application/json", reportHash }),
      },
      pdf: {
        mediaType: "application/pdf",
        href: pdfHref,
        contentHash: hashJson({ mediaType: "application/pdf", reportHash }),
      },
      api: {
        href: `/canopyproof/reports/esg/${id}`,
        mediaType: "application/json",
      },
    },
    auditEvent,
  };
}

export function renderCanopyProofEsgReportPdf(report: CanopyProofEsgReport): Uint8Array<ArrayBuffer> {
  const lines = [
    "CanopyProof ESG Report",
    `Report ID: ${report.id}`,
    `Project: ${report.projectId}`,
    `Organization: ${report.organizationName}`,
    `Period: ${report.reportingPeriod.startsAt} to ${report.reportingPeriod.endsAt}`,
    `Generated: ${report.generatedAt}`,
    `Evidence root: ${report.evidenceRoot.slice(0, 32)}...`,
    `Verification root: ${report.verificationRoot.slice(0, 32)}...`,
    `Confidence score: ${report.confidenceScore}`,
    "Frameworks: GRI, SDG, TNFD, biodiversity, climate impact",
    "Boundary: Environmental Proof Record only.",
    "Not a certified carbon credit, financial asset, carbon-tax offset, guaranteed yield, or automatic CANOPY distribution claim.",
  ].map((line) => asciiLine(line, 96));

  const content = [
    "BT",
    "/F1 11 Tf",
    "14 TL",
    "50 780 Td",
    ...lines.flatMap((line, index) => [`(${pdfEscape(line)}) Tj`, ...(index === lines.length - 1 ? [] : ["T*"])]),
    "ET",
  ].join("\n");

  return buildMinimalPdf(content);
}

export function serializeCanopyProofEsgReportJson(report: CanopyProofEsgReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

function buildGriDisclosures(
  records: readonly EnvironmentalProofRecord[],
  materialTopics: readonly string[],
): readonly CanopyProofFrameworkDisclosure[] {
  const recordIds = records.map((record) => record.id).sort();
  const topics = materialTopics.length ? materialTopics : ["restoration accountability", "evidence quality", "nature monitoring"];
  return [
    {
      code: "GRI 2-22",
      title: "Statement on sustainable development strategy",
      evidence: recordIds,
      statement: `Report covers ${topics.join(", ")} using issued Environmental Proof Records and visible governance approvals.`,
      limitations: ["Strategic statements are bounded by evidence lineage and do not create offset or yield claims."],
    },
    {
      code: "GRI 3-3",
      title: "Management of material topics",
      evidence: recordIds,
      statement: "Material environmental topics are managed through evidence submission, AI advisory review, human verification, and governance approval.",
      limitations: ["AI is advisory only; human review remains mandatory before public proof issuance."],
    },
    {
      code: "GRI 304",
      title: "Biodiversity",
      evidence: recordIds,
      statement: "Biodiversity reporting is tied to field and monitoring evidence where available, with unresolved uncertainty preserved.",
      limitations: ["Report does not assert complete biodiversity recovery or permanent ecological outcome."],
    },
    {
      code: "GRI 305",
      title: "Climate indicators",
      evidence: recordIds,
      statement: "Climate indicators are proof-linked accountability observations and not certified emissions instruments.",
      limitations: ["No certified carbon-credit, carbon-tax offset, or guaranteed financial-yield claim is made."],
    },
  ];
}

function buildSdgMappings(records: readonly EnvironmentalProofRecord[], evidenceRoot: string): readonly CanopyProofSdgMapping[] {
  const recordIds = records.map((record) => record.id).sort();
  return [
    {
      goal: "SDG 6",
      title: "Clean Water and Sanitation",
      recordIds,
      evidenceRoot,
      statement: "Water-related observations are mapped only when evidence and monitoring timelines support the linkage.",
    },
    {
      goal: "SDG 13",
      title: "Climate Action",
      recordIds,
      evidenceRoot,
      statement: "Climate action reporting is bounded to restoration accountability and explicitly excludes offset issuance.",
    },
    {
      goal: "SDG 15",
      title: "Life on Land",
      recordIds,
      evidenceRoot,
      statement: "Terrestrial ecosystem reporting preserves proof status, contributor lineage, and governance approvals.",
    },
  ];
}

function buildTnfdPreparation(records: readonly EnvironmentalProofRecord[]): CanopyProofTnfdPreparation {
  const regions = [...new Set(records.map((record) => record.location.regionId ?? "unscoped-region"))].sort();
  return {
    governance: ["Verification authority remains human-led.", "Governance approvals are retained with every proof record."],
    strategy: [`Nature-related dependencies are tracked for ${regions.join(", ")}.`, "Evidence gaps remain explicit in exported reports."],
    riskManagement: ["Challenged, rejected, or unresolved evidence cannot silently become proof.", "Satellite contradiction and GPS spoofing findings require review."],
    metricsAndTargets: ["Proof record count, confidence score, evidence root, and verification root are exported as integrity anchors."],
    limitations: ["TNFD preparation material is not a formal assurance opinion.", "Report exports must retain claim-boundary disclosures."],
  };
}

function assertSafeReportText(values: readonly string[]) {
  const unsafePatterns = [
    /\bcertified\s+carbon\s+credit\b/i,
    /\bcarbon[-\s]?tax\s+offset\b/i,
    /\bguaranteed\s+(?:rwa\s+)?yield\b/i,
    /\bautomatic\s+(?:\$?canopy|canopy)\s+distribution\b/i,
  ];
  for (const value of values) {
    for (const pattern of unsafePatterns) {
      if (pattern.test(value) && !/\bnot\b/i.test(value)) {
        throw new Error(`ESG report input contains unsupported public claim: ${value}`);
      }
    }
  }
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
