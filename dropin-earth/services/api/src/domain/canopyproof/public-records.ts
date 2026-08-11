import { hashJson, merkleRoot } from "@dropin/crypto";
import type { CanopyProofProjectProfile, CanopyProofProjectRegistryService } from "./project-registry.js";
import type { CanopyProofLocation, EnvironmentalProofRecord } from "./proof-engine.js";
import type { CanopyProofProofRecordChallenge, CanopyProofService } from "./proof-service.js";

export type CanopyProofPublicRecordStatus = EnvironmentalProofRecord["status"];

export type CanopyProofPublicRecord = {
  readonly id: string;
  readonly recordId: string;
  readonly recordType: "environmental_proof_record";
  readonly status: CanopyProofPublicRecordStatus;
  readonly issuedAt: string;
  readonly project: {
    readonly id: string;
    readonly title: string;
    readonly projectType: string;
    readonly regionId: string;
    readonly organizationId: string;
    readonly status: string;
    readonly areaHectares: number;
    readonly targetTreeCount: number;
  };
  readonly location: {
    readonly regionId: string;
    readonly precision: "region_only";
  };
  readonly evidence: {
    readonly evidenceCount: number;
    readonly evidenceRoot: string;
  };
  readonly monitoring: {
    readonly timeline: readonly string[];
    readonly acceptedMonitoringEventCount: number;
    readonly monitoringEventRoot: string;
  };
  readonly governance: {
    readonly approvalCount: number;
    readonly approvalRoot: string;
  };
  readonly challenges: {
    readonly totalCount: number;
    readonly openCount: number;
    readonly acceptedCount: number;
    readonly rejectedCount: number;
    readonly challengeRoot: string;
    readonly publicSummaries: readonly CanopyProofPublicChallengeSummary[];
  };
  readonly hashes: {
    readonly sourceRecordHash: string;
    readonly publicRecordHash: string;
  };
  readonly claimBoundary: EnvironmentalProofRecord["claimBoundary"];
  readonly disclosure: string;
};

export type CanopyProofPublicChallengeSummary = {
  readonly id: string;
  readonly reason: CanopyProofProofRecordChallenge["reason"];
  readonly severity: CanopyProofProofRecordChallenge["severity"];
  readonly status: CanopyProofProofRecordChallenge["status"];
  readonly submittedAt: string;
  readonly publicOutcome: string;
};

export type CanopyProofPublicRecordIndex = {
  readonly service: "canopyproof-public-record-registry";
  readonly generatedAt: string;
  readonly recordCount: number;
  readonly issuedRecordCount: number;
  readonly challengedRecordCount: number;
  readonly revokedRecordCount: number;
  readonly records: readonly CanopyProofPublicRecord[];
  readonly lineage: {
    readonly publicRecordRoot: string;
    readonly sourceRecordRoot: string;
    readonly challengeRoot: string;
  };
  readonly safety: {
    readonly canonical: false;
    readonly durable: false;
    readonly institutionalRelianceAuthorized: false;
    readonly publicSafeReadModel: true;
    readonly preciseEvidenceLocationsRedacted: true;
    readonly contributorIdentifiersRedacted: true;
    readonly internalReviewRationaleRedacted: true;
    readonly notCertifiedCarbonCredit: true;
    readonly notCarbonTaxOffset: true;
    readonly notFinancialAsset: true;
    readonly notGuaranteedYield: true;
    readonly noAutomaticCanopyDistribution: true;
  };
};

export type CanopyProofPublicRecordFilter = {
  readonly projectId?: string;
  readonly regionId?: string;
  readonly status?: CanopyProofPublicRecordStatus;
};

export function buildCanopyProofPublicRecordIndex(input: Readonly<{
  proof: Pick<CanopyProofService, "listProofRecords" | "listProofRecordChallenges">;
  projectRegistry: Pick<CanopyProofProjectRegistryService, "getProject">;
  filter?: CanopyProofPublicRecordFilter;
  generatedAt?: string;
}>): CanopyProofPublicRecordIndex {
  const filter = input.filter ?? {};
  const records = input.proof
    .listProofRecords()
    .filter((record) => !filter.projectId || record.projectId === filter.projectId)
    .filter((record) => !filter.status || record.status === filter.status)
    .map((record) =>
      buildCanopyProofPublicRecord({
        record,
        project: input.projectRegistry.getProject(record.projectId),
        challenges: input.proof.listProofRecordChallenges(record.id),
      }),
    )
    .filter((record) => !filter.regionId || record.project.regionId === filter.regionId)
    .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt) || left.id.localeCompare(right.id));
  const challengeHashes = records.flatMap((record) => record.challenges.publicSummaries.map((challenge) => challenge.id));
  return {
    service: "canopyproof-public-record-registry",
    generatedAt: input.generatedAt ?? new Date(0).toISOString(),
    recordCount: records.length,
    issuedRecordCount: records.filter((record) => record.status === "issued").length,
    challengedRecordCount: records.filter((record) => record.status === "challenged").length,
    revokedRecordCount: records.filter((record) => record.status === "revoked").length,
    records,
    lineage: {
      publicRecordRoot: hashRoot(records.map((record) => record.hashes.publicRecordHash)),
      sourceRecordRoot: hashRoot(records.map((record) => record.hashes.sourceRecordHash)),
      challengeRoot: hashRoot(challengeHashes),
    },
    safety: publicRecordSafety(),
  };
}

export function buildCanopyProofPublicRecord(input: Readonly<{
  record: EnvironmentalProofRecord;
  project: CanopyProofProjectProfile;
  challenges: readonly CanopyProofProofRecordChallenge[];
}>): CanopyProofPublicRecord {
  const challenges = input.challenges
    .map((challenge) => ({
      id: challenge.id,
      reason: challenge.reason,
      severity: challenge.severity,
      status: challenge.status,
      submittedAt: challenge.submittedAt,
      publicOutcome: challenge.publicOutcome,
    }))
    .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt) || left.id.localeCompare(right.id));
  const base = {
    id: `cp_public_record_${hashJson({ recordId: input.record.id, recordHash: input.record.recordHash }).slice(0, 24)}`,
    recordId: input.record.id,
    recordType: "environmental_proof_record" as const,
    status: input.record.status,
    issuedAt: input.record.issuedAt,
    project: {
      id: input.project.id,
      title: input.project.title,
      projectType: input.project.projectType,
      regionId: input.project.regionId,
      organizationId: input.project.organizationId,
      status: input.project.status,
      areaHectares: input.project.location.areaHectares,
      targetTreeCount: input.project.targetTreeCount,
    },
    location: regionOnlyPublicLocation(input.record.location, input.project.regionId),
    evidence: {
      evidenceCount: input.record.evidenceIds.length,
      evidenceRoot: input.record.evidenceRoot,
    },
    monitoring: {
      timeline: input.record.monitoringTimeline,
      acceptedMonitoringEventCount: input.record.monitoringEventIds.length,
      monitoringEventRoot: hashRoot(input.record.monitoringEventIds),
    },
    governance: {
      approvalCount: input.record.governanceApprovals.length,
      approvalRoot: hashRoot(input.record.governanceApprovals),
    },
    challenges: {
      totalCount: challenges.length,
      openCount: challenges.filter((challenge) => challenge.status === "open").length,
      acceptedCount: challenges.filter((challenge) => challenge.status === "accepted").length,
      rejectedCount: challenges.filter((challenge) => challenge.status === "rejected").length,
      challengeRoot: hashRoot(challenges.map((challenge) => challenge.id)),
      publicSummaries: challenges,
    },
    hashes: {
      sourceRecordHash: input.record.recordHash,
    },
    claimBoundary: input.record.claimBoundary,
    disclosure: input.record.claimBoundary.disclosure,
  };
  const publicRecordHash = hashJson({
    kind: "canopyproof-public-record-v1",
    recordId: base.recordId,
    status: base.status,
    project: base.project,
    location: base.location,
    evidence: base.evidence,
    monitoring: base.monitoring,
    governance: base.governance,
    challengeRoot: base.challenges.challengeRoot,
    sourceRecordHash: base.hashes.sourceRecordHash,
    claimBoundary: base.claimBoundary,
  });
  return {
    ...base,
    hashes: {
      ...base.hashes,
      publicRecordHash,
    },
  };
}

function regionOnlyPublicLocation(
  location: CanopyProofLocation,
  fallbackRegionId: string,
): CanopyProofPublicRecord["location"] {
  return {
    regionId: location.regionId ?? fallbackRegionId,
    precision: "region_only",
  };
}

function publicRecordSafety(): CanopyProofPublicRecordIndex["safety"] {
  return {
    canonical: false,
    durable: false,
    institutionalRelianceAuthorized: false,
    publicSafeReadModel: true,
    preciseEvidenceLocationsRedacted: true,
    contributorIdentifiersRedacted: true,
    internalReviewRationaleRedacted: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noAutomaticCanopyDistribution: true,
  };
}

function hashRoot(values: readonly string[]) {
  return values.length > 0 ? merkleRoot([...values].sort()) : hashJson({ kind: "canopyproof-empty-public-record-root-v1" });
}
