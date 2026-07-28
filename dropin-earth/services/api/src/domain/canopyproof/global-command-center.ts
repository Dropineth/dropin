import { hashJson, merkleRoot } from "@dropin/crypto";
import {
  canopyProofGlobalCommandCenterSafetyDisclosure,
  canopyProofGlobalCommandCenterSpatialDisclosureCommitmentSchema,
  canopyProofGlobalCommandCenterSpatialDisclosureSchema,
  canopyProofGlobalCommandCenterSnapshotSchema,
  type CanopyProofGlobalCommandCenterActivity,
  type CanopyProofGlobalCommandCenterIndicator,
  type CanopyProofGlobalCommandCenterRegion,
  type CanopyProofGlobalCommandCenterSnapshot,
  type CanopyProofGlobalCommandCenterSpatial,
  type CanopyProofGlobalCommandCenterSpatialDisclosureCommitment,
  type CanopyProofGlobalCommandCenterSpatialDisclosure,
} from "@dropin/schemas/canopyproof-global-command-center";
import type { CanopyProofEarlyWarningService } from "./early-warning.js";
import type { CanopyProofFundingTransparencyService } from "./funding-transparency.js";
import type { CanopyProofProjectRegistryService } from "./project-registry.js";
import type { CanopyProofService } from "./proof-service.js";
import type { TerraProofService } from "./terra-intelligence.js";

export type CanopyProofGlobalCommandCenterInput = {
  readonly projectRegistry: Pick<CanopyProofProjectRegistryService, "getStatus" | "listProjects" | "listMonitoringEvents">;
  readonly proof: Pick<CanopyProofService, "getStatus" | "listEvidence" | "listProofRecords" | "listProofRecordChallenges">;
  readonly terra: Pick<TerraProofService, "getStatus" | "listConnectorRuns" | "listScenes">;
  readonly risk: Pick<CanopyProofEarlyWarningService, "getOverview" | "listAlerts" | "listSignals">;
  readonly funding: Pick<CanopyProofFundingTransparencyService, "buildLedger" | "getStatus">;
  readonly spatialDisclosures?: readonly CanopyProofGlobalCommandCenterSpatialDisclosure[];
  readonly generatedAt?: string;
};

export type {
  CanopyProofGlobalCommandCenterActivity,
  CanopyProofGlobalCommandCenterIndicator,
  CanopyProofGlobalCommandCenterRegion,
  CanopyProofGlobalCommandCenterSnapshot,
  CanopyProofGlobalCommandCenterSpatial,
  CanopyProofGlobalCommandCenterSpatialDisclosureCommitment,
  CanopyProofGlobalCommandCenterSpatialDisclosure,
} from "@dropin/schemas/canopyproof-global-command-center";

export function buildCanopyProofGlobalCommandCenter(
  input: CanopyProofGlobalCommandCenterInput,
): CanopyProofGlobalCommandCenterSnapshot {
  const generatedAt = input.generatedAt ?? new Date(0).toISOString();
  const projectStatus = input.projectRegistry.getStatus();
  const proofStatus = input.proof.getStatus();
  const terraStatus = input.terra.getStatus();
  const riskOverview = input.risk.getOverview();
  const fundingLedger = input.funding.buildLedger();

  const projects = input.projectRegistry.listProjects();
  const monitoringEvents = input.projectRegistry.listMonitoringEvents();
  const evidence = input.proof.listEvidence();
  const proofRecords = input.proof.listProofRecords();
  const proofChallenges = input.proof.listProofRecordChallenges();
  const terraScenes = input.terra.listScenes();
  const terraRuns = input.terra.listConnectorRuns();
  const riskAlerts = input.risk.listAlerts();
  const projectById = new Map(projects.map((project) => [project.id, project]));
  const regions = buildRegionalSummaries({
    projects,
    monitoringEvents,
    evidence,
    proofRecords,
    terraScenes,
    riskAlerts,
    funding: input.funding,
    generatedAt,
    spatialDisclosures: input.spatialDisclosures ?? [],
  });
  const regionRoot = hashRoot(regions.map((region) => region.regionRoot));
  const impactIndicators = {
    biodiversity: summarizeIndicators(
      projects.flatMap((project) => project.biodiversityIndicators),
      monitoringEvents.flatMap((event) => event.biodiversityIndicators),
    ),
    water: summarizeIndicators(
      projects.flatMap((project) => project.waterIndicators),
      monitoringEvents.flatMap((event) => event.waterIndicators),
    ),
    climateRisk: summarizeIndicators(
      projects.flatMap((project) => project.climateRiskIndicators),
      monitoringEvents.flatMap((event) => event.climateRiskIndicators),
    ),
  };
  const metrics = {
    projectCount: projects.length,
    activeProjectCount: projectStatus.activeProjectCount,
    monitoredProjectCount: projects.filter((project) => project.status === "monitored").length,
    challengedProjectCount: projectStatus.challengedProjectCount,
    targetTreeCount: sumNumbers(projects.map((project) => project.targetTreeCount)),
    areaHectares: roundSix(sumNumbers(projects.map((project) => project.location.areaHectares))),
    evidenceCount: proofStatus.evidenceCount,
    acceptedEvidenceCount: evidence.filter((item) => item.verification_status === "accepted").length,
    proofRecordCount: proofStatus.proofRecordCount,
    issuedProofRecordCount: proofRecords.filter((record) => record.status === "issued").length,
    challengedProofRecordCount: proofRecords.filter((record) => record.status === "challenged").length,
    terraLayerCount: terraStatus.layerCount,
    terraSceneCount: terraStatus.sceneCount,
    acceptedTerraRunCount: terraRuns.filter((run) => run.status === "accepted").length,
    needsReviewTerraRunCount: terraRuns.filter((run) => run.status === "needs_review").length,
    activeRiskAlertCount: riskOverview.activeAlertCount,
    criticalRiskAlertCount: riskOverview.criticalAlertCount,
    fundingCommittedUsd: fundingLedger.totals.committedUsd,
    fundingAllocatedUsd: fundingLedger.totals.allocatedUsd,
    fundingSettledUsd: fundingLedger.totals.settledUsd,
    fundingChallengedUsd: fundingLedger.totals.challengedUsd,
  };
  const recentActivity = [
    ...monitoringEvents.map((event) =>
      activity({
      id: event.id,
        kind: "project_monitoring",
      projectId: event.projectId,
        regionId: projectById.get(event.projectId)?.regionId,
      happenedAt: event.observedAt,
      state: event.state,
      summary: `${event.eventType} for ${event.projectId}`,
      hash: event.eventHash,
      }),
    ),
    ...proofRecords.map((record) =>
      activity({
      id: record.id,
        kind: "proof_record",
      projectId: record.projectId,
        regionId: projectById.get(record.projectId)?.regionId ?? record.location.regionId,
      happenedAt: record.issuedAt,
      state: record.status,
      summary: `${record.recordType} for ${record.projectId}`,
      hash: record.recordHash,
      }),
    ),
    ...terraScenes.map((scene) =>
      activity({
      id: scene.id,
        kind: "terra_scene",
      regionId: scene.regionId,
      happenedAt: scene.acquisitionTimestamp,
      state: scene.missingDataFlags.length > 0 ? "needs_review" : "accepted",
      summary: `${scene.provider} ${scene.dataset}`,
      hash: scene.sceneHash,
      }),
    ),
    ...riskAlerts.map((alert) =>
      activity({
      id: alert.id,
        kind: "risk_alert",
        projectId: alert.projectId,
      regionId: alert.regionId,
      happenedAt: alert.updatedAt,
      state: alert.status,
      summary: alert.summary,
      hash: alert.alertHash,
      }),
    ),
    ...fundingLedger.milestones.map((milestone) =>
      activity({
      id: milestone.id,
        kind: "funding_milestone",
      projectId: milestone.projectId,
        regionId: projectById.get(milestone.projectId)?.regionId,
      happenedAt: milestone.dueAt,
      state: milestone.status,
      summary: milestone.title,
      hash: milestone.milestoneHash,
      }),
    ),
  ]
    .sort((left, right) => right.happenedAt.localeCompare(left.happenedAt) || left.id.localeCompare(right.id))
    .slice(0, 12);
  const safety = canopyProofGlobalCommandCenterSafety();
  const lineage = {
    projectRoot: projectStatus.projectRoot,
    monitoringRoot: projectStatus.monitoringRoot,
    evidenceRoot: hashRoot(evidence.map((item) => item.audit_history.at(-1)?.eventRoot ?? item.id)),
    proofRecordRoot: hashRoot(proofRecords.map((record) => record.recordHash)),
    proofChallengeRoot: hashRoot(proofChallenges.map((challenge) => challenge.challengeHash)),
    terraSceneRoot: hashRoot(terraScenes.map((scene) => scene.sceneHash)),
    riskSignalRoot: riskOverview.lineage.signalRoot,
    riskAlertRoot: riskOverview.lineage.alertRoot,
    fundingLedgerRoot: fundingLedger.lineage.ledgerRoot,
    regionRoot,
  };
  const dashboardRoot = hashJson({
    kind: "canopyproof-global-command-center-v3",
    generatedAt,
    metrics,
    regionRoot,
    lineage,
    impactIndicators,
    recentActivity,
    safety,
  });

  return verifyCanopyProofGlobalCommandCenterSnapshot({
    service: "canopyproof-global-impact-command-center",
    generatedAt,
    metrics,
    regions,
    impactIndicators,
    recentActivity,
    lineage: {
      ...lineage,
      dashboardRoot,
    },
    safety,
  });
}

function buildRegionalSummaries(input: Readonly<{
  projects: ReturnType<CanopyProofProjectRegistryService["listProjects"]>;
  monitoringEvents: ReturnType<CanopyProofProjectRegistryService["listMonitoringEvents"]>;
  evidence: ReturnType<CanopyProofService["listEvidence"]>;
  proofRecords: ReturnType<CanopyProofService["listProofRecords"]>;
  terraScenes: ReturnType<TerraProofService["listScenes"]>;
  riskAlerts: ReturnType<CanopyProofEarlyWarningService["listAlerts"]>;
  funding: Pick<CanopyProofFundingTransparencyService, "buildLedger">;
  generatedAt: string;
  spatialDisclosures: readonly CanopyProofGlobalCommandCenterSpatialDisclosure[];
}>): readonly CanopyProofGlobalCommandCenterRegion[] {
  const projectById = new Map(input.projects.map((project) => [project.id, project]));
  const regionIds = new Set<string>();
  for (const project of input.projects) regionIds.add(project.regionId);
  for (const scene of input.terraScenes) regionIds.add(scene.regionId);
  for (const alert of input.riskAlerts) regionIds.add(alert.regionId);
  for (const item of input.evidence) {
    const regionId = item.location.regionId ?? projectById.get(item.projectId)?.regionId;
    if (regionId) regionIds.add(regionId);
  }
  if (input.spatialDisclosures.length > 512) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: too many spatial disclosures.");
  }
  const spatialDisclosures = new Map<string, CanopyProofGlobalCommandCenterSpatialDisclosure>();
  for (const candidate of input.spatialDisclosures) {
    const disclosure = canopyProofGlobalCommandCenterSpatialDisclosureSchema.parse(candidate);
    if (spatialDisclosures.has(disclosure.regionId)) {
      throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: duplicate spatial disclosure region.");
    }
    spatialDisclosures.set(disclosure.regionId, disclosure);
  }
  for (const regionId of spatialDisclosures.keys()) {
    if (!regionIds.has(regionId)) {
      throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial disclosure region is absent.");
    }
  }

  return [...regionIds]
    .sort()
    .map((regionId) => {
      const projects = input.projects.filter((project) => project.regionId === regionId);
      const projectIds = new Set(projects.map((project) => project.id));
      const monitoringEvents = input.monitoringEvents.filter((event) => projectIds.has(event.projectId));
      const evidence = input.evidence.filter((item) => (item.location.regionId ?? projectById.get(item.projectId)?.regionId) === regionId);
      const proofRecords = input.proofRecords.filter((record) => (projectById.get(record.projectId)?.regionId ?? record.location.regionId) === regionId);
      const terraScenes = input.terraScenes.filter((scene) => scene.regionId === regionId);
      const activeRiskAlerts = input.riskAlerts.filter((alert) => alert.regionId === regionId && !["resolved", "challenged"].includes(alert.status));
      const fundingLedgers = projects.map((project) => input.funding.buildLedger(project.id));
      const fundingTotals = fundingLedgers.map((ledger) => ledger.totals);
      const fundingAllocatedCents = sumNumbers(fundingTotals.map((total) => usdToCents(total.allocatedUsd)));
      const fundingSettledCents = sumNumbers(fundingTotals.map((total) => usdToCents(total.settledUsd)));
      const sourceRoot = hashJson({
        kind: "canopyproof-global-command-center-region-sources-v2",
        regionId,
        projectRoots: projects.map((project) => project.projectRoot).sort(),
        monitoringEventRoots: monitoringEvents.map((event) => event.monitoringRoot).sort(),
        evidenceRoots: evidence.map((item) => item.audit_history.at(-1)?.eventRoot ?? item.id).sort(),
        proofRecordRoots: proofRecords.map((record) => record.recordHash).sort(),
        terraSceneRoots: terraScenes.map((scene) => scene.sceneHash).sort(),
        activeRiskAlertRoots: activeRiskAlerts.map((alert) => alert.alertHash).sort(),
        fundingLedgerRoots: fundingLedgers.map((ledger) => ledger.lineage.ledgerRoot).sort(),
        fundingAllocatedUsd: centsToUsd(fundingAllocatedCents),
        fundingSettledUsd: centsToUsd(fundingSettledCents),
      });
      const spatial = buildCanopyProofGlobalCommandCenterSpatialProjection({
        regionId,
        regionSourceRoot: sourceRoot,
        sourceProjectCount: projects.length,
        generatedAt: input.generatedAt,
        disclosure: spatialDisclosures.get(regionId),
      });
      const region = {
        regionId,
        projectCount: projects.length,
        activeProjectCount: projects.filter((project) => project.status === "active" || project.status === "monitored").length,
        challengedProjectCount: projects.filter((project) => project.status === "challenged").length,
        targetTreeCount: sumNumbers(projects.map((project) => project.targetTreeCount)),
        areaHectares: roundSix(sumNumbers(projects.map((project) => project.location.areaHectares))),
        evidenceCount: evidence.length,
        proofRecordCount: proofRecords.length,
        issuedProofRecordCount: proofRecords.filter((record) => record.status === "issued").length,
        monitoringEventCount: monitoringEvents.length,
        acceptedMonitoringEventCount: monitoringEvents.filter((event) => event.state === "accepted").length,
        terraSceneCount: terraScenes.length,
        activeRiskAlertCount: activeRiskAlerts.length,
        fundingAllocatedUsd: centsToUsd(fundingAllocatedCents),
        fundingSettledUsd: centsToUsd(fundingSettledCents),
        sourceRoot,
        spatial,
      };
      return {
        ...region,
        regionRoot: hashCanopyProofGlobalCommandCenterRegion(region),
      };
    });
}

function summarizeIndicators(
  projectIndicators: readonly string[],
  monitoringIndicators: readonly string[],
): readonly CanopyProofGlobalCommandCenterIndicator[] {
  const keys = [...new Set([...projectIndicators, ...monitoringIndicators])].sort((left, right) => left.localeCompare(right));
  return keys.map((key) => {
    const projectCount = projectIndicators.filter((indicator) => indicator === key).length;
    const monitoringEventCount = monitoringIndicators.filter((indicator) => indicator === key).length;
    return {
      key,
      projectCount,
      monitoringEventCount,
      totalCount: projectCount + monitoringEventCount,
    };
  });
}

function activity(input: Readonly<{
  id: string;
  kind: CanopyProofGlobalCommandCenterActivity["kind"];
  projectId?: string | undefined;
  regionId?: string | undefined;
  happenedAt: string;
  state: string;
  summary: string;
  hash: string;
}>): CanopyProofGlobalCommandCenterActivity {
  return {
    id: input.id,
    kind: input.kind,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.regionId ? { regionId: input.regionId } : {}),
    happenedAt: input.happenedAt,
    state: input.state,
    summary: input.summary,
    hash: input.hash,
  };
}

type CanopyProofGlobalCommandCenterSpatialWithoutRoot =
  | Omit<Extract<CanopyProofGlobalCommandCenterSpatial, { visibility: "withheld" }>, "spatialRoot">
  | Omit<Extract<CanopyProofGlobalCommandCenterSpatial, { visibility: "generalized" }>, "spatialRoot">;

export function buildCanopyProofGlobalCommandCenterSpatialDisclosure(
  input: CanopyProofGlobalCommandCenterSpatialDisclosureCommitment,
): CanopyProofGlobalCommandCenterSpatialDisclosure {
  const commitment = canopyProofGlobalCommandCenterSpatialDisclosureCommitmentSchema.parse(input);
  assertCanonicalUtc(commitment.validFrom, "spatial disclosure validFrom");
  assertCanonicalUtc(commitment.validUntil, "spatial disclosure validUntil");
  return canopyProofGlobalCommandCenterSpatialDisclosureSchema.parse({
    ...commitment,
    disclosureRoot: hashCanopyProofGlobalCommandCenterSpatialDisclosure(commitment),
  });
}

export function hashCanopyProofGlobalCommandCenterSpatialDisclosure(
  input: CanopyProofGlobalCommandCenterSpatialDisclosureCommitment,
) {
  const commitment = canopyProofGlobalCommandCenterSpatialDisclosureCommitmentSchema.parse(input);
  return hashJson({
    kind: "canopyproof-global-command-center-spatial-disclosure-v1",
    ...commitment,
  });
}

function buildCanopyProofGlobalCommandCenterSpatialProjection(input: Readonly<{
  regionId: string;
  regionSourceRoot: string;
  sourceProjectCount: number;
  generatedAt: string;
  disclosure?: CanopyProofGlobalCommandCenterSpatialDisclosure | undefined;
}>): CanopyProofGlobalCommandCenterSpatial {
  if (!input.disclosure) {
    const withheld = {
      visibility: "withheld" as const,
      reason: "no_approved_disclosure" as const,
      minimumCohortSize: 3 as const,
    };
    return {
      ...withheld,
      spatialRoot: hashCanopyProofGlobalCommandCenterSpatial(withheld),
    };
  }

  const disclosure = verifyCanopyProofGlobalCommandCenterSpatialDisclosure(input.disclosure);
  if (disclosure.regionId !== input.regionId) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial disclosure region mismatch.");
  }
  if (disclosure.regionSourceRoot !== input.regionSourceRoot) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial disclosure source root mismatch.");
  }
  if (disclosure.sourceProjectCount !== input.sourceProjectCount) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial disclosure project count mismatch.");
  }
  const generatedAt = Date.parse(input.generatedAt);
  if (generatedAt < Date.parse(disclosure.validFrom) || generatedAt > Date.parse(disclosure.validUntil)) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial disclosure is outside its validity interval.");
  }

  const generalized = {
    visibility: "generalized" as const,
    basis: "approved_regional_disclosure_v1" as const,
    ...disclosure,
  };
  return {
    ...generalized,
    spatialRoot: hashCanopyProofGlobalCommandCenterSpatial(generalized),
  };
}

function verifyCanopyProofGlobalCommandCenterSpatialDisclosure(
  input: unknown,
): CanopyProofGlobalCommandCenterSpatialDisclosure {
  const disclosure = canopyProofGlobalCommandCenterSpatialDisclosureSchema.parse(input);
  assertCanonicalUtc(disclosure.validFrom, "spatial disclosure validFrom");
  assertCanonicalUtc(disclosure.validUntil, "spatial disclosure validUntil");
  const { disclosureRoot, ...commitment } = disclosure;
  if (hashCanopyProofGlobalCommandCenterSpatialDisclosure(commitment) !== disclosureRoot) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial disclosure root mismatch.");
  }
  return disclosure;
}

function verifyCanopyProofGlobalCommandCenterSpatialProjection(
  spatial: CanopyProofGlobalCommandCenterSpatial,
  region: Pick<CanopyProofGlobalCommandCenterRegion, "regionId" | "sourceRoot" | "projectCount">,
  generatedAt: string,
) {
  const { spatialRoot, ...projection } = spatial;
  if (hashCanopyProofGlobalCommandCenterSpatial(projection) !== spatialRoot) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial root mismatch.");
  }
  if (spatial.visibility === "withheld") return;

  const disclosure = verifyCanopyProofGlobalCommandCenterSpatialDisclosure({
    regionId: spatial.regionId,
    centroid: spatial.centroid,
    precisionDegrees: spatial.precisionDegrees,
    sourceProjectCount: spatial.sourceProjectCount,
    minimumCohortSize: spatial.minimumCohortSize,
    regionSourceRoot: spatial.regionSourceRoot,
    privacyReviewRoot: spatial.privacyReviewRoot,
    safeguardingReviewRoot: spatial.safeguardingReviewRoot,
    validFrom: spatial.validFrom,
    validUntil: spatial.validUntil,
    disclosureRoot: spatial.disclosureRoot,
  });
  if (disclosure.regionId !== region.regionId) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial region mismatch.");
  }
  if (disclosure.regionSourceRoot !== region.sourceRoot) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial source root mismatch.");
  }
  if (disclosure.sourceProjectCount !== region.projectCount) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial project count mismatch.");
  }
  const generatedAtEpoch = Date.parse(generatedAt);
  if (generatedAtEpoch < Date.parse(disclosure.validFrom) || generatedAtEpoch > Date.parse(disclosure.validUntil)) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial projection is outside its validity interval.");
  }
}

function hashCanopyProofGlobalCommandCenterSpatial(
  input: CanopyProofGlobalCommandCenterSpatialWithoutRoot,
) {
  return hashJson({ kind: "canopyproof-global-command-center-spatial-v1", ...input });
}

export function canopyProofGlobalCommandCenterSafety(): CanopyProofGlobalCommandCenterSnapshot["safety"] {
  return {
    readOnly: true,
    humanReviewRequiredForFinalProof: true,
    aiAdvisoryOnly: true,
    noMainnetFunds: true,
    noAutomaticCanopyDistribution: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    disclosure: canopyProofGlobalCommandCenterSafetyDisclosure,
  };
}

export function verifyCanopyProofGlobalCommandCenterSnapshot(
  input: unknown,
): CanopyProofGlobalCommandCenterSnapshot {
  const snapshot = canopyProofGlobalCommandCenterSnapshotSchema.parse(input);
  if (new Date(snapshot.generatedAt).toISOString() !== snapshot.generatedAt) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: generatedAt must be canonical UTC.");
  }

  const regionIds = new Set<string>();
  for (const region of snapshot.regions) {
    if (regionIds.has(region.regionId)) {
      throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: duplicate regionId.");
    }
    regionIds.add(region.regionId);
    verifyCanopyProofGlobalCommandCenterSpatialProjection(region.spatial, region, snapshot.generatedAt);
    const { regionRoot, ...committedRegion } = region;
    if (hashCanopyProofGlobalCommandCenterRegion(committedRegion) !== regionRoot) {
      throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: region root mismatch.");
    }
    if (
      region.activeProjectCount > region.projectCount ||
      region.challengedProjectCount > region.projectCount ||
      region.issuedProofRecordCount > region.proofRecordCount ||
      region.acceptedMonitoringEventCount > region.monitoringEventCount
    ) {
      throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: regional count invariant failed.");
    }
  }
  if (snapshot.regions.some((region, index) => index > 0 && snapshot.regions[index - 1]!.regionId >= region.regionId)) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: regions must be uniquely sorted.");
  }

  for (const indicators of Object.values(snapshot.impactIndicators)) {
    for (const [index, indicator] of indicators.entries()) {
      if (indicator.totalCount !== indicator.projectCount + indicator.monitoringEventCount) {
        throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: indicator total mismatch.");
      }
      if (index > 0 && indicators[index - 1]!.key >= indicator.key) {
        throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: indicators must be uniquely sorted.");
      }
    }
  }

  for (const [index, item] of snapshot.recentActivity.entries()) {
    const previous = index > 0 ? snapshot.recentActivity[index - 1] : undefined;
    if (previous && (previous.happenedAt < item.happenedAt ||
      (previous.happenedAt === item.happenedAt && previous.id > item.id))) {
      throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: activity order mismatch.");
    }
  }

  const regionRoot = hashRoot(snapshot.regions.map((region) => region.regionRoot));
  if (snapshot.lineage.regionRoot !== regionRoot) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: aggregate region root mismatch.");
  }
  const { dashboardRoot, ...lineage } = snapshot.lineage;
  const expectedDashboardRoot = hashJson({
    kind: "canopyproof-global-command-center-v3",
    generatedAt: snapshot.generatedAt,
    metrics: snapshot.metrics,
    regionRoot,
    lineage,
    impactIndicators: snapshot.impactIndicators,
    recentActivity: snapshot.recentActivity,
    safety: snapshot.safety,
  });
  if (dashboardRoot !== expectedDashboardRoot) {
    throw new Error("CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: dashboard root mismatch.");
  }
  return snapshot;
}

function hashCanopyProofGlobalCommandCenterRegion(
  region: Omit<CanopyProofGlobalCommandCenterRegion, "regionRoot">,
) {
  return hashJson({ kind: "canopyproof-global-command-center-region-v3", ...region });
}

function assertCanonicalUtc(value: string, boundary: string) {
  if (new Date(value).toISOString() !== value) {
    throw new Error(`CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: ${boundary} must be canonical UTC.`);
  }
}

function hashRoot(values: readonly string[]) {
  return values.length > 0 ? merkleRoot([...values].sort()) : hashJson({ kind: "canopyproof-empty-global-dashboard-root-v1" });
}

function sumNumbers(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function roundSix(value: number) {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function usdToCents(amount: string) {
  const [dollarsRaw, centsRaw = ""] = amount.split(".");
  if (!dollarsRaw || !/^\d+$/.test(dollarsRaw) || (centsRaw && !/^\d{1,2}$/.test(centsRaw))) {
    throw new Error(`Invalid USD amount in Global Command Center aggregate: ${amount}`);
  }
  return Number.parseInt(dollarsRaw, 10) * 100 + Number.parseInt(centsRaw.padEnd(2, "0"), 10);
}

function centsToUsd(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`Invalid cent amount in Global Command Center aggregate: ${cents}`);
  }
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return remainder === 0 ? String(dollars) : `${dollars}.${String(remainder).padStart(2, "0")}`;
}
