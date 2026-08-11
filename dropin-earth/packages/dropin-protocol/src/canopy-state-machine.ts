import { createHash } from "node:crypto";

export type CanopySatelliteBaselineSource = "sentinel-1" | "sentinel-2" | "landsat";
export type CanopySatelliteObservationSource = "planet" | "iceye" | "capella";
export type CanopySatelliteAuditSource = "maxar" | "airbus" | "drone" | "field_validator";
export type CanopySatelliteObservationType =
  | "growth"
  | "fire_risk"
  | "deforestation"
  | "water_stress"
  | "survival_drop";

export type CanopyEventType =
  | "CellObserved"
  | "SequestrationVerified"
  | "WaterConstraintUpdated"
  | "FireRiskRaised"
  | "BaselineAnchored"
  | "ObservationEvent"
  | "VegetationGrowthDetected"
  | "AuditAttested"
  | "CertificateIssued"
  | "UnlockAuthorized"
  | "ChallengeOpened"
  | "ChallengeResolved";

export type CanopyChallengeTargetType = "cell" | "certificate" | "unlock";
export type CanopyChallengeResolution = "accepted" | "rejected";

export type CanopyBaseEvent = {
  readonly id: string;
  readonly type: CanopyEventType;
  readonly cellId: string;
  readonly timestamp: string;
};

export type CanopyCellObservedEvent = CanopyBaseEvent & {
  readonly type: "CellObserved";
  readonly treeCount: number;
  readonly observedBiomassTonnes: number;
  readonly carryingCapacityTonnes: number;
};

export type CanopySequestrationVerifiedEvent = CanopyBaseEvent & {
  readonly type: "SequestrationVerified";
  readonly verifiedTco2e: number;
  readonly evidenceRoot: string;
  readonly verifierId: string;
};

export type CanopyWaterConstraintUpdatedEvent = CanopyBaseEvent & {
  readonly type: "WaterConstraintUpdated";
  readonly waterIndex: number;
  readonly sourceId: string;
};

export type CanopyFireRiskRaisedEvent = CanopyBaseEvent & {
  readonly type: "FireRiskRaised";
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly sourceId: string;
};

export type CanopyBaselineAnchoredEvent = CanopyBaseEvent & {
  readonly type: "BaselineAnchored";
  readonly baselineId: string;
  readonly baselineRoot: string;
  readonly source: CanopySatelliteBaselineSource;
  readonly canopyCoverPct: number;
  readonly ndvi: number | null;
  readonly sarBackscatterDb: number | null;
};

export type CanopyObservationEvent = CanopyBaseEvent & {
  readonly type: "ObservationEvent";
  readonly observationId: string;
  readonly observationRoot: string;
  readonly baselineRoot: string;
  readonly source: CanopySatelliteObservationSource;
  readonly observationType: CanopySatelliteObservationType;
  readonly canopyCoverPct: number | null;
  readonly ndvi: number | null;
  readonly sarBackscatterDb: number | null;
  readonly treeSurvivalRate: number | null;
  readonly waterStressIndex: number | null;
  readonly anomalyConfidence: number;
  readonly anomalyThreshold: number;
};

export type CanopyVegetationGrowthDetectedEvent = CanopyBaseEvent & {
  readonly type: "VegetationGrowthDetected";
  readonly baselineRoot: string;
  readonly observationRoot: string;
};

export type CanopyAuditAttestedEvent = CanopyBaseEvent & {
  readonly type: "AuditAttested";
  readonly auditAttestationId: string;
  readonly auditRoot: string;
  readonly baselineRoot: string;
  readonly observationRoot: string;
  readonly source: CanopySatelliteAuditSource;
  readonly auditorId: string;
  readonly verifiedCanopyCoverPct: number;
  readonly verifiedTreeSurvivalRate: number;
  readonly verifiedTco2eDelta: number;
  readonly auditorSignature: string;
};

export type CanopyCertificateIssuedEvent = CanopyBaseEvent & {
  readonly type: "CertificateIssued";
  readonly certificateId: string;
  readonly verifiedTco2e: number;
  readonly methodologyVersion: string;
  readonly auditRoot: string;
};

export type CanopyUnlockAuthorizedEvent = CanopyBaseEvent & {
  readonly type: "UnlockAuthorized";
  readonly unlockId: string;
  readonly certificateId: string;
  readonly token: "CANOPY";
  readonly amount: string;
};

export type CanopyChallengeOpenedEvent = CanopyBaseEvent & {
  readonly type: "ChallengeOpened";
  readonly challengeId: string;
  readonly targetType: CanopyChallengeTargetType;
  readonly targetId: string;
  readonly reason: string;
  readonly sourceObservationRoot?: string | undefined;
  readonly automaticallyOpened?: boolean | undefined;
};

export type CanopyChallengeResolvedEvent = CanopyBaseEvent & {
  readonly type: "ChallengeResolved";
  readonly challengeId: string;
  readonly resolution: CanopyChallengeResolution;
};

export type CanopyEvent =
  | CanopyCellObservedEvent
  | CanopySequestrationVerifiedEvent
  | CanopyWaterConstraintUpdatedEvent
  | CanopyFireRiskRaisedEvent
  | CanopyBaselineAnchoredEvent
  | CanopyObservationEvent
  | CanopyVegetationGrowthDetectedEvent
  | CanopyAuditAttestedEvent
  | CanopyCertificateIssuedEvent
  | CanopyUnlockAuthorizedEvent
  | CanopyChallengeOpenedEvent
  | CanopyChallengeResolvedEvent;

export type CanopyCertificateStatus = "issued" | "frozen" | "rolled_back";
export type CanopyUnlockStatus = "authorized" | "frozen" | "rolled_back";
export type CanopyChallengeStatus = "open" | "accepted" | "rejected";

export type CanopyBaselineState = {
  readonly baselineId: string;
  readonly baselineRoot: string;
  readonly cellId: string;
  readonly timestamp: string;
  readonly source: CanopySatelliteBaselineSource;
  readonly canopyCoverPct: number;
  readonly ndvi: number | null;
  readonly sarBackscatterDb: number | null;
  readonly anchoredByEventId: string;
};

export type CanopyObservationState = {
  readonly observationId: string;
  readonly observationRoot: string;
  readonly baselineRoot: string;
  readonly cellId: string;
  readonly timestamp: string;
  readonly source: CanopySatelliteObservationSource;
  readonly observationType: CanopySatelliteObservationType;
  readonly canopyCoverPct: number | null;
  readonly ndvi: number | null;
  readonly sarBackscatterDb: number | null;
  readonly treeSurvivalRate: number | null;
  readonly waterStressIndex: number | null;
  readonly anomalyConfidence: number;
  readonly anomalyThreshold: number;
  readonly recordedByEventId: string;
};

export type CanopyAuditState = {
  readonly auditAttestationId: string;
  readonly auditRoot: string;
  readonly baselineRoot: string;
  readonly observationRoot: string;
  readonly cellId: string;
  readonly timestamp: string;
  readonly source: CanopySatelliteAuditSource;
  readonly auditorId: string;
  readonly verifiedCanopyCoverPct: number;
  readonly verifiedTreeSurvivalRate: number;
  readonly verifiedTco2eDelta: number;
  readonly auditorSignature: string;
  readonly attestedByEventId: string;
};

export type CanopyCellState = {
  readonly cellId: string;
  readonly observed: boolean;
  readonly treeCount: number;
  readonly observedBiomassTonnes: number;
  readonly carryingCapacityTonnes: number;
  readonly verifiedTco2e: number;
  readonly waterIndex: number | null;
  readonly fireRiskLevel: "low" | "medium" | "high" | "critical" | null;
  readonly baselineRoots: readonly string[];
  readonly observationRoots: readonly string[];
  readonly auditRoots: readonly string[];
  readonly vegetationGrowthDetected: boolean;
  readonly certificateIds: readonly string[];
  readonly unlockIds: readonly string[];
  readonly openChallengeIds: readonly string[];
};

export type CanopyCertificateState = {
  readonly certificateId: string;
  readonly cellId: string;
  readonly verifiedTco2e: number;
  readonly methodologyVersion: string;
  readonly baselineRoot: string;
  readonly observationRoot: string;
  readonly auditRoot: string;
  readonly status: CanopyCertificateStatus;
  readonly issuedByEventId: string;
};

export type CanopyUnlockState = {
  readonly unlockId: string;
  readonly certificateId: string;
  readonly cellId: string;
  readonly token: "CANOPY";
  readonly amount: string;
  readonly status: CanopyUnlockStatus;
  readonly authorizedByEventId: string;
};

export type CanopyChallengeState = {
  readonly challengeId: string;
  readonly cellId: string;
  readonly targetType: CanopyChallengeTargetType;
  readonly targetId: string;
  readonly reason: string;
  readonly status: CanopyChallengeStatus;
  readonly openedByEventId: string;
  readonly sourceObservationRoot?: string | undefined;
  readonly automaticallyOpened?: boolean | undefined;
  readonly resolvedByEventId?: string | undefined;
};

export type CanopyState = {
  readonly cells: Readonly<Record<string, CanopyCellState>>;
  readonly baselines: Readonly<Record<string, CanopyBaselineState>>;
  readonly observations: Readonly<Record<string, CanopyObservationState>>;
  readonly audits: Readonly<Record<string, CanopyAuditState>>;
  readonly certificates: Readonly<Record<string, CanopyCertificateState>>;
  readonly unlocks: Readonly<Record<string, CanopyUnlockState>>;
  readonly challenges: Readonly<Record<string, CanopyChallengeState>>;
  readonly appliedEventIds: readonly string[];
  readonly stateRoot: string;
  readonly certificateRoot: string;
  readonly unlockRoot: string;
  readonly challengeRoot: string;
};

export type CanopyStateMachineGovernance = {
  readonly CANOPY_PRODUCTION_UNLOCK?: boolean | undefined;
};

export type CanopyReplayReport = {
  readonly latestReplayReportId: string;
  readonly state: CanopyState;
  readonly eventCount: number;
  readonly canonicalEventTypes: readonly CanopyEventType[];
  readonly emittedChallengeIds: readonly string[];
  readonly emittedEvents: readonly CanopyChallengeOpenedEvent[];
};

type RootlessCanopyState = Omit<CanopyState, "stateRoot" | "certificateRoot" | "unlockRoot" | "challengeRoot">;

const canonicalEventTypes: readonly CanopyEventType[] = [
  "CellObserved",
  "SequestrationVerified",
  "WaterConstraintUpdated",
  "FireRiskRaised",
  "BaselineAnchored",
  "ObservationEvent",
  "VegetationGrowthDetected",
  "AuditAttested",
  "CertificateIssued",
  "UnlockAuthorized",
  "ChallengeOpened",
  "ChallengeResolved",
];

const highRiskObservationTypes = new Set<CanopySatelliteObservationType>([
  "deforestation",
  "fire_risk",
  "survival_drop",
]);

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(object[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

export function computeCanopyBaselineRoot(input: Readonly<{
  gridId: string;
  timestamp: string;
  source: CanopySatelliteBaselineSource;
  canopyCoverPct: number;
  ndvi: number | null;
  sarBackscatterDb: number | null;
}>): string {
  return hashJson({
    domain: "canopyproof/satellite/baseline/v1",
    gridId: input.gridId,
    timestamp: input.timestamp,
    source: input.source,
    canopyCoverPct: input.canopyCoverPct,
    ndvi: input.ndvi,
    sarBackscatterDb: input.sarBackscatterDb,
  });
}

export function computeCanopyObservationRoot(input: Readonly<{
  gridId: string;
  timestamp: string;
  source: CanopySatelliteObservationSource;
  observationType: CanopySatelliteObservationType;
  canopyCoverPct: number | null;
  ndvi: number | null;
  sarBackscatterDb: number | null;
  treeSurvivalRate: number | null;
  waterStressIndex: number | null;
  anomalyConfidence: number;
  anomalyThreshold: number;
}>): string {
  return hashJson({
    domain: "canopyproof/satellite/observation/v1",
    gridId: input.gridId,
    timestamp: input.timestamp,
    source: input.source,
    observationType: input.observationType,
    canopyCoverPct: input.canopyCoverPct,
    ndvi: input.ndvi,
    sarBackscatterDb: input.sarBackscatterDb,
    treeSurvivalRate: input.treeSurvivalRate,
    waterStressIndex: input.waterStressIndex,
    anomalyConfidence: input.anomalyConfidence,
    anomalyThreshold: input.anomalyThreshold,
  });
}

export function computeCanopyAuditRoot(input: Readonly<{
  gridId: string;
  timestamp: string;
  source: CanopySatelliteAuditSource;
  auditorId: string;
  baselineRoot: string;
  observationRoot: string;
  verifiedCanopyCoverPct: number;
  verifiedTreeSurvivalRate: number;
  verifiedTco2eDelta: number;
  auditorSignature: string;
}>): string {
  return hashJson({
    domain: "canopyproof/satellite/audit/v1",
    gridId: input.gridId,
    timestamp: input.timestamp,
    source: input.source,
    auditorId: input.auditorId,
    baselineRoot: input.baselineRoot,
    observationRoot: input.observationRoot,
    verifiedCanopyCoverPct: input.verifiedCanopyCoverPct,
    verifiedTreeSurvivalRate: input.verifiedTreeSurvivalRate,
    verifiedTco2eDelta: input.verifiedTco2eDelta,
    auditorSignature: input.auditorSignature,
  });
}

export function canopyChallengeIdForObservation(observationRoot: string): string {
  return `challenge_satellite_${hashJson({ domain: "canopyproof/satellite/challenge/v1", observationRoot }).slice(0, 24)}`;
}

export function satelliteChallengeOpenedForObservation(
  event: CanopyObservationEvent,
): CanopyChallengeOpenedEvent | undefined {
  if (
    !highRiskObservationTypes.has(event.observationType) ||
    event.anomalyConfidence <= event.anomalyThreshold
  ) {
    return undefined;
  }
  return {
    id: `evt_challenge_opened_${event.observationRoot.slice(0, 24)}`,
    type: "ChallengeOpened",
    cellId: event.cellId,
    timestamp: event.timestamp,
    challengeId: canopyChallengeIdForObservation(event.observationRoot),
    targetType: "cell",
    targetId: event.cellId,
    reason: `satellite_${event.observationType}_confidence_${event.anomalyConfidence.toFixed(6)}`,
    sourceObservationRoot: event.observationRoot,
    automaticallyOpened: true,
  };
}

function unique(items: readonly string[]): readonly string[] {
  return [...new Set(items)].sort();
}

function emptyCell(cellId: string): CanopyCellState {
  return {
    cellId,
    observed: false,
    treeCount: 0,
    observedBiomassTonnes: 0,
    carryingCapacityTonnes: 0,
    verifiedTco2e: 0,
    waterIndex: null,
    fireRiskLevel: null,
    baselineRoots: [],
    observationRoots: [],
    auditRoots: [],
    vegetationGrowthDetected: false,
    certificateIds: [],
    unlockIds: [],
    openChallengeIds: [],
  };
}

function createInitialState(): CanopyState {
  return refreshRoots({
    cells: {},
    baselines: {},
    observations: {},
    audits: {},
    certificates: {},
    unlocks: {},
    challenges: {},
    appliedEventIds: [],
  });
}

function refreshRoots(state: RootlessCanopyState): CanopyState {
  const certificateRoot = hashJson(state.certificates);
  const unlockRoot = hashJson(state.unlocks);
  const challengeRoot = hashJson(state.challenges);
  return {
    ...state,
    certificateRoot,
    unlockRoot,
    challengeRoot,
    stateRoot: hashJson({
      cells: state.cells,
      baselines: state.baselines,
      observations: state.observations,
      audits: state.audits,
      certificates: certificateRoot,
      unlocks: unlockRoot,
      challenges: challengeRoot,
      appliedEventIds: state.appliedEventIds,
    }),
  };
}

function cellOrThrow(state: CanopyState, cellId: string): CanopyCellState {
  const cell = state.cells[cellId];
  if (!cell) {
    throw new Error(`Canopy state transition rejected: cell ${cellId} has not been observed or baseline-anchored.`);
  }
  return cell;
}

function rejectIfCellFrozen(cell: CanopyCellState): void {
  if (cell.openChallengeIds.length > 0) {
    throw new Error(`Canopy state transition rejected: cell ${cell.cellId} is frozen by an unresolved ChallengeOpened.`);
  }
}

function assertTimestampOrder(earlier: string, later: string, context: string): void {
  const earlierEpoch = Date.parse(earlier);
  const laterEpoch = Date.parse(later);
  if (!Number.isFinite(earlierEpoch) || !Number.isFinite(laterEpoch) || laterEpoch < earlierEpoch) {
    throw new Error(`Canopy state transition rejected: ${context} timestamps are invalid or out of order.`);
  }
}

function assertRoot(actual: string, expected: string, label: string): void {
  if (actual !== expected) {
    throw new Error(`Canopy state transition rejected: ${label} does not match its canonical payload.`);
  }
}

function assertRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Canopy state transition rejected: ${label} is outside its valid range.`);
  }
}

function assertNullableRange(
  value: number | null,
  minimum: number,
  maximum: number,
  label: string,
): void {
  if (value !== null) assertRange(value, minimum, maximum, label);
}

function targetExists(state: CanopyState, event: CanopyChallengeOpenedEvent): boolean {
  if (event.targetType === "cell") {
    return event.targetId === event.cellId && Boolean(state.cells[event.cellId]);
  }
  if (event.targetType === "certificate") {
    return state.certificates[event.targetId]?.cellId === event.cellId;
  }
  return state.unlocks[event.targetId]?.cellId === event.cellId;
}

function freezeTarget(
  state: CanopyState,
  challenge: CanopyChallengeState,
): Pick<CanopyState, "cells" | "certificates" | "unlocks"> {
  const cells = { ...state.cells };
  const certificates = { ...state.certificates };
  const unlocks = { ...state.unlocks };
  const cell = cells[challenge.cellId];
  if (cell) {
    cells[challenge.cellId] = {
      ...cell,
      openChallengeIds: unique([...cell.openChallengeIds, challenge.challengeId]),
    };
  }

  if (challenge.targetType === "cell") {
    for (const certificateId of Object.keys(certificates)) {
      const certificate = certificates[certificateId];
      if (certificate?.cellId === challenge.cellId && certificate.status === "issued") {
        certificates[certificateId] = { ...certificate, status: "frozen" };
      }
    }
    for (const unlockId of Object.keys(unlocks)) {
      const unlock = unlocks[unlockId];
      if (unlock?.cellId === challenge.cellId && unlock.status === "authorized") {
        unlocks[unlockId] = { ...unlock, status: "frozen" };
      }
    }
  }

  if (challenge.targetType === "certificate") {
    const certificate = certificates[challenge.targetId];
    if (certificate?.status === "issued") {
      certificates[challenge.targetId] = { ...certificate, status: "frozen" };
    }
    for (const unlockId of Object.keys(unlocks)) {
      const unlock = unlocks[unlockId];
      if (unlock?.certificateId === challenge.targetId && unlock.status === "authorized") {
        unlocks[unlockId] = { ...unlock, status: "frozen" };
      }
    }
  }

  if (challenge.targetType === "unlock") {
    const unlock = unlocks[challenge.targetId];
    if (unlock?.status === "authorized") {
      unlocks[challenge.targetId] = { ...unlock, status: "frozen" };
    }
  }

  return { cells, certificates, unlocks };
}

function resolveTarget(state: CanopyState, challenge: CanopyChallengeState, resolution: CanopyChallengeResolution) {
  const cells = { ...state.cells };
  const certificates = { ...state.certificates };
  const unlocks = { ...state.unlocks };
  const cell = cells[challenge.cellId];
  if (cell) {
    cells[challenge.cellId] = {
      ...cell,
      openChallengeIds: cell.openChallengeIds.filter((id) => id !== challenge.challengeId),
    };
  }

  const remainingChallenges = Object.values(state.challenges).filter(
    (candidate) => candidate.challengeId !== challenge.challengeId && candidate.status === "open",
  );
  for (const certificateId of Object.keys(certificates)) {
    const certificate = certificates[certificateId];
    if (!certificate || !challengeAffectsCertificate(challenge, certificate)) continue;
    if (resolution === "accepted") {
      certificates[certificateId] = { ...certificate, status: "rolled_back" };
    } else if (certificate.status === "frozen") {
      certificates[certificateId] = {
        ...certificate,
        status: remainingChallenges.some((candidate) => challengeAffectsCertificate(candidate, certificate))
          ? "frozen"
          : "issued",
      };
    }
  }
  for (const unlockId of Object.keys(unlocks)) {
    const unlock = unlocks[unlockId];
    if (!unlock || !challengeAffectsUnlock(challenge, unlock)) continue;
    if (resolution === "accepted") {
      unlocks[unlockId] = { ...unlock, status: "rolled_back" };
    } else if (unlock.status === "frozen") {
      unlocks[unlockId] = {
        ...unlock,
        status: remainingChallenges.some((candidate) => challengeAffectsUnlock(candidate, unlock))
          ? "frozen"
          : "authorized",
      };
    }
  }

  return { cells, certificates, unlocks };
}

function challengeAffectsCertificate(
  challenge: CanopyChallengeState,
  certificate: CanopyCertificateState,
): boolean {
  return challenge.targetType === "cell"
    ? challenge.cellId === certificate.cellId
    : challenge.targetType === "certificate" && challenge.targetId === certificate.certificateId;
}

function challengeAffectsUnlock(challenge: CanopyChallengeState, unlock: CanopyUnlockState): boolean {
  if (challenge.targetType === "cell") return challenge.cellId === unlock.cellId;
  if (challenge.targetType === "certificate") return challenge.targetId === unlock.certificateId;
  return challenge.targetId === unlock.unlockId;
}

function applyBaselineAnchored(state: CanopyState, event: CanopyBaselineAnchoredEvent, next: RootlessCanopyState) {
  assertRange(event.canopyCoverPct, 0, 100, "baseline canopyCoverPct");
  assertNullableRange(event.ndvi, -1, 1, "baseline NDVI");
  assertNullableRange(event.sarBackscatterDb, -100, 100, "baseline SAR backscatter");
  if (event.ndvi === null && event.sarBackscatterDb === null) {
    throw new Error("Canopy state transition rejected: baseline requires an NDVI or SAR measurement.");
  }
  if (event.source === "sentinel-1" && event.sarBackscatterDb === null) {
    throw new Error("Canopy state transition rejected: Sentinel-1 baseline requires SAR backscatter.");
  }
  if ((event.source === "sentinel-2" || event.source === "landsat") && event.ndvi === null) {
    throw new Error("Canopy state transition rejected: optical baseline requires NDVI.");
  }
  const expectedRoot = computeCanopyBaselineRoot({
    gridId: event.cellId,
    timestamp: event.timestamp,
    source: event.source,
    canopyCoverPct: event.canopyCoverPct,
    ndvi: event.ndvi,
    sarBackscatterDb: event.sarBackscatterDb,
  });
  assertRoot(event.baselineRoot, expectedRoot, "baselineRoot");
  if (state.baselines[event.baselineRoot]) {
    throw new Error("Canopy state transition rejected: baselineRoot is already anchored by another event.");
  }
  const cell = state.cells[event.cellId] ?? emptyCell(event.cellId);
  return {
    ...next,
    cells: {
      ...state.cells,
      [event.cellId]: {
        ...cell,
        observed: true,
        baselineRoots: unique([...cell.baselineRoots, event.baselineRoot]),
      },
    },
    baselines: {
      ...state.baselines,
      [event.baselineRoot]: {
        baselineId: event.baselineId,
        baselineRoot: event.baselineRoot,
        cellId: event.cellId,
        timestamp: event.timestamp,
        source: event.source,
        canopyCoverPct: event.canopyCoverPct,
        ndvi: event.ndvi,
        sarBackscatterDb: event.sarBackscatterDb,
        anchoredByEventId: event.id,
      },
    },
  };
}

function applyObservation(state: CanopyState, event: CanopyObservationEvent, next: RootlessCanopyState) {
  assertNullableRange(event.canopyCoverPct, 0, 100, "observation canopyCoverPct");
  assertNullableRange(event.ndvi, -1, 1, "observation NDVI");
  assertNullableRange(event.sarBackscatterDb, -100, 100, "observation SAR backscatter");
  assertNullableRange(event.treeSurvivalRate, 0, 100, "observation treeSurvivalRate");
  assertNullableRange(event.waterStressIndex, 0, 1, "observation waterStressIndex");
  assertRange(event.anomalyConfidence, 0, 1, "observation anomalyConfidence");
  assertRange(event.anomalyThreshold, 0, 1, "observation anomalyThreshold");
  if (
    event.canopyCoverPct === null &&
    event.ndvi === null &&
    event.sarBackscatterDb === null &&
    event.treeSurvivalRate === null &&
    event.waterStressIndex === null
  ) {
    throw new Error("Canopy state transition rejected: ObservationEvent requires a physical measurement.");
  }
  if ((event.source === "iceye" || event.source === "capella") && event.sarBackscatterDb === null) {
    throw new Error("Canopy state transition rejected: commercial SAR observation requires backscatter data.");
  }
  const cell = cellOrThrow(state, event.cellId);
  const baseline = state.baselines[event.baselineRoot];
  if (!baseline || baseline.cellId !== event.cellId) {
    throw new Error("Canopy state transition rejected: ObservationEvent requires a matching BaselineAnchored record.");
  }
  assertTimestampOrder(baseline.timestamp, event.timestamp, "baseline and observation");
  const expectedRoot = computeCanopyObservationRoot({
    gridId: event.cellId,
    timestamp: event.timestamp,
    source: event.source,
    observationType: event.observationType,
    canopyCoverPct: event.canopyCoverPct,
    ndvi: event.ndvi,
    sarBackscatterDb: event.sarBackscatterDb,
    treeSurvivalRate: event.treeSurvivalRate,
    waterStressIndex: event.waterStressIndex,
    anomalyConfidence: event.anomalyConfidence,
    anomalyThreshold: event.anomalyThreshold,
  });
  assertRoot(event.observationRoot, expectedRoot, "observationRoot");
  if (state.observations[event.observationRoot]) {
    throw new Error("Canopy state transition rejected: observationRoot is already recorded by another event.");
  }

  const observations = {
    ...state.observations,
    [event.observationRoot]: {
      observationId: event.observationId,
      observationRoot: event.observationRoot,
      baselineRoot: event.baselineRoot,
      cellId: event.cellId,
      timestamp: event.timestamp,
      source: event.source,
      observationType: event.observationType,
      canopyCoverPct: event.canopyCoverPct,
      ndvi: event.ndvi,
      sarBackscatterDb: event.sarBackscatterDb,
      treeSurvivalRate: event.treeSurvivalRate,
      waterStressIndex: event.waterStressIndex,
      anomalyConfidence: event.anomalyConfidence,
      anomalyThreshold: event.anomalyThreshold,
      recordedByEventId: event.id,
    },
  } satisfies Readonly<Record<string, CanopyObservationState>>;
  const updatedCell: CanopyCellState = {
    ...cell,
    observationRoots: unique([...cell.observationRoots, event.observationRoot]),
  };
  return {
    ...next,
    cells: { ...state.cells, [event.cellId]: updatedCell },
    observations,
  };
}

function applyAuditAttested(state: CanopyState, event: CanopyAuditAttestedEvent, next: RootlessCanopyState) {
  assertRange(event.verifiedCanopyCoverPct, 0, 100, "audit verifiedCanopyCoverPct");
  assertRange(event.verifiedTreeSurvivalRate, 0, 100, "audit verifiedTreeSurvivalRate");
  assertRange(event.verifiedTco2eDelta, -1_000_000_000_000, 1_000_000_000_000, "audit verifiedTco2eDelta");
  if (event.auditorSignature.trim().length < 16 || event.auditorSignature.length > 4096) {
    throw new Error("Canopy state transition rejected: AuditAttested requires a bounded auditorSignature.");
  }
  const cell = cellOrThrow(state, event.cellId);
  const baseline = state.baselines[event.baselineRoot];
  const observation = state.observations[event.observationRoot];
  if (!baseline || baseline.cellId !== event.cellId) {
    throw new Error("Canopy state transition rejected: AuditAttested requires a matching BaselineAnchored record.");
  }
  if (
    !observation ||
    observation.cellId !== event.cellId ||
    observation.baselineRoot !== event.baselineRoot
  ) {
    throw new Error("Canopy state transition rejected: AuditAttested requires a matching ObservationEvent record.");
  }
  assertTimestampOrder(observation.timestamp, event.timestamp, "observation and audit");
  const expectedRoot = computeCanopyAuditRoot({
    gridId: event.cellId,
    timestamp: event.timestamp,
    source: event.source,
    auditorId: event.auditorId,
    baselineRoot: event.baselineRoot,
    observationRoot: event.observationRoot,
    verifiedCanopyCoverPct: event.verifiedCanopyCoverPct,
    verifiedTreeSurvivalRate: event.verifiedTreeSurvivalRate,
    verifiedTco2eDelta: event.verifiedTco2eDelta,
    auditorSignature: event.auditorSignature,
  });
  assertRoot(event.auditRoot, expectedRoot, "auditRoot");
  if (state.audits[event.auditRoot]) {
    throw new Error("Canopy state transition rejected: auditRoot is already attested by another event.");
  }
  return {
    ...next,
    cells: {
      ...state.cells,
      [event.cellId]: {
        ...cell,
        auditRoots: unique([...cell.auditRoots, event.auditRoot]),
        verifiedTco2e: cell.verifiedTco2e + Math.max(0, event.verifiedTco2eDelta),
      },
    },
    audits: {
      ...state.audits,
      [event.auditRoot]: {
        auditAttestationId: event.auditAttestationId,
        auditRoot: event.auditRoot,
        baselineRoot: event.baselineRoot,
        observationRoot: event.observationRoot,
        cellId: event.cellId,
        timestamp: event.timestamp,
        source: event.source,
        auditorId: event.auditorId,
        verifiedCanopyCoverPct: event.verifiedCanopyCoverPct,
        verifiedTreeSurvivalRate: event.verifiedTreeSurvivalRate,
        verifiedTco2eDelta: event.verifiedTco2eDelta,
        auditorSignature: event.auditorSignature,
        attestedByEventId: event.id,
      },
    },
  };
}

function applyCanopyEventCore(
  state: CanopyState,
  event: CanopyEvent,
  governance: CanopyStateMachineGovernance = {},
): CanopyState {
  if (state.appliedEventIds.includes(event.id)) {
    return state;
  }

  let next: RootlessCanopyState = {
    cells: state.cells,
    baselines: state.baselines,
    observations: state.observations,
    audits: state.audits,
    certificates: state.certificates,
    unlocks: state.unlocks,
    challenges: state.challenges,
    appliedEventIds: [...state.appliedEventIds, event.id],
  };

  if (event.type === "CellObserved") {
    const cell = state.cells[event.cellId] ?? emptyCell(event.cellId);
    next = {
      ...next,
      cells: {
        ...state.cells,
        [event.cellId]: {
          ...cell,
          observed: true,
          treeCount: event.treeCount,
          observedBiomassTonnes: event.observedBiomassTonnes,
          carryingCapacityTonnes: event.carryingCapacityTonnes,
        },
      },
    };
  }

  if (event.type === "SequestrationVerified") {
    const cell = cellOrThrow(state, event.cellId);
    rejectIfCellFrozen(cell);
    next = {
      ...next,
      cells: {
        ...state.cells,
        [event.cellId]: { ...cell, verifiedTco2e: cell.verifiedTco2e + event.verifiedTco2e },
      },
    };
  }

  if (event.type === "WaterConstraintUpdated") {
    const cell = cellOrThrow(state, event.cellId);
    next = {
      ...next,
      cells: { ...state.cells, [event.cellId]: { ...cell, waterIndex: event.waterIndex } },
    };
  }

  if (event.type === "FireRiskRaised") {
    const cell = cellOrThrow(state, event.cellId);
    next = {
      ...next,
      cells: { ...state.cells, [event.cellId]: { ...cell, fireRiskLevel: event.riskLevel } },
    };
  }

  if (event.type === "BaselineAnchored") {
    next = applyBaselineAnchored(state, event, next);
  }

  if (event.type === "ObservationEvent") {
    next = applyObservation(state, event, next);
  }

  if (event.type === "VegetationGrowthDetected") {
    const cell = cellOrThrow(state, event.cellId);
    const baseline = state.baselines[event.baselineRoot];
    const observation = state.observations[event.observationRoot];
    if (!baseline || baseline.cellId !== event.cellId) {
      throw new Error(
        "Canopy state transition rejected: BaselineAnchored must exist before VegetationGrowthDetected.",
      );
    }
    if (
      !observation ||
      observation.cellId !== event.cellId ||
      observation.baselineRoot !== event.baselineRoot ||
      observation.observationType !== "growth"
    ) {
      throw new Error(
        "Canopy state transition rejected: VegetationGrowthDetected requires a matching growth ObservationEvent.",
      );
    }
    assertTimestampOrder(observation.timestamp, event.timestamp, "observation and vegetation growth detection");
    next = {
      ...next,
      cells: {
        ...state.cells,
        [event.cellId]: { ...cell, vegetationGrowthDetected: true },
      },
    };
  }

  if (event.type === "AuditAttested") {
    next = applyAuditAttested(state, event, next);
  }

  if (event.type === "CertificateIssued") {
    const cell = cellOrThrow(state, event.cellId);
    rejectIfCellFrozen(cell);
    const audit = state.audits[event.auditRoot];
    if (!audit || audit.cellId !== event.cellId) {
      throw new Error("Canopy state transition rejected: CertificateIssued requires AuditAttested.");
    }
    if (!state.baselines[audit.baselineRoot] || !state.observations[audit.observationRoot]) {
      throw new Error(
        "Canopy state transition rejected: CertificateIssued requires BaselineAnchored and ObservationEvent.",
      );
    }
    assertTimestampOrder(audit.timestamp, event.timestamp, "audit and certificate");
    if (event.verifiedTco2e <= 0 || event.verifiedTco2e > Math.max(0, audit.verifiedTco2eDelta)) {
      throw new Error(
        "Canopy state transition rejected: certificate quantity exceeds the matching AuditAttested value.",
      );
    }
    if (state.certificates[event.certificateId]) {
      throw new Error("Canopy state transition rejected: certificateId already exists.");
    }
    if (Object.values(state.certificates).some((certificate) => certificate.auditRoot === event.auditRoot)) {
      throw new Error(
        "Canopy state transition rejected: AuditAttested root has already been consumed by CertificateIssued.",
      );
    }
    next = {
      ...next,
      cells: {
        ...state.cells,
        [event.cellId]: {
          ...cell,
          certificateIds: unique([...cell.certificateIds, event.certificateId]),
        },
      },
      certificates: {
        ...state.certificates,
        [event.certificateId]: {
          certificateId: event.certificateId,
          cellId: event.cellId,
          verifiedTco2e: event.verifiedTco2e,
          methodologyVersion: event.methodologyVersion,
          baselineRoot: audit.baselineRoot,
          observationRoot: audit.observationRoot,
          auditRoot: audit.auditRoot,
          status: "issued",
          issuedByEventId: event.id,
        },
      },
    };
  }

  if (event.type === "UnlockAuthorized") {
    if (governance.CANOPY_PRODUCTION_UNLOCK !== true) {
      throw new Error(
        "Canopy state transition rejected: protocol write path requires CANOPY_PRODUCTION_UNLOCK=true.",
      );
    }
    const cell = cellOrThrow(state, event.cellId);
    rejectIfCellFrozen(cell);
    const certificate = state.certificates[event.certificateId];
    if (!certificate || certificate.cellId !== event.cellId || certificate.status !== "issued") {
      throw new Error("Canopy state transition rejected: UnlockAuthorized requires CertificateIssued.");
    }
    const unlockAmount = Number(event.amount);
    if (
      !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(event.amount) ||
      !Number.isFinite(unlockAmount) ||
      unlockAmount <= 0
    ) {
      throw new Error("Canopy state transition rejected: unlock amount must be a positive decimal value.");
    }
    if (state.unlocks[event.unlockId]) {
      throw new Error("Canopy state transition rejected: unlockId already exists.");
    }
    next = {
      ...next,
      cells: {
        ...state.cells,
        [event.cellId]: { ...cell, unlockIds: unique([...cell.unlockIds, event.unlockId]) },
      },
      unlocks: {
        ...state.unlocks,
        [event.unlockId]: {
          unlockId: event.unlockId,
          certificateId: event.certificateId,
          cellId: event.cellId,
          token: event.token,
          amount: event.amount,
          status: "authorized",
          authorizedByEventId: event.id,
        },
      },
    };
  }

  if (event.type === "ChallengeOpened") {
    if (!targetExists(state, event)) {
      throw new Error("Canopy state transition rejected: challenge target does not exist.");
    }
    if (state.challenges[event.challengeId]) {
      throw new Error("Canopy state transition rejected: challengeId already exists.");
    }
    if (event.automaticallyOpened === true) {
      const observation = event.sourceObservationRoot
        ? state.observations[event.sourceObservationRoot]
        : undefined;
      if (!observation) {
        throw new Error(
          "Canopy state transition rejected: automatic ChallengeOpened requires its source ObservationEvent.",
        );
      }
      const expected = satelliteChallengeOpenedForObservation({
        id: observation.recordedByEventId,
        type: "ObservationEvent",
        cellId: observation.cellId,
        timestamp: observation.timestamp,
        observationId: observation.observationId,
        observationRoot: observation.observationRoot,
        baselineRoot: observation.baselineRoot,
        source: observation.source,
        observationType: observation.observationType,
        canopyCoverPct: observation.canopyCoverPct,
        ndvi: observation.ndvi,
        sarBackscatterDb: observation.sarBackscatterDb,
        treeSurvivalRate: observation.treeSurvivalRate,
        waterStressIndex: observation.waterStressIndex,
        anomalyConfidence: observation.anomalyConfidence,
        anomalyThreshold: observation.anomalyThreshold,
      });
      if (!expected || stableStringify(expected) !== stableStringify(event)) {
        throw new Error(
          "Canopy state transition rejected: automatic ChallengeOpened does not match its source observation.",
        );
      }
    } else if (event.sourceObservationRoot !== undefined || event.automaticallyOpened !== undefined) {
      throw new Error(
        "Canopy state transition rejected: manual ChallengeOpened cannot claim automatic observation lineage.",
      );
    }
    const challenge: CanopyChallengeState = {
      challengeId: event.challengeId,
      cellId: event.cellId,
      targetType: event.targetType,
      targetId: event.targetId,
      reason: event.reason,
      status: "open",
      openedByEventId: event.id,
      ...(event.automaticallyOpened === true
        ? {
            sourceObservationRoot: event.sourceObservationRoot,
            automaticallyOpened: true,
          }
        : {}),
    };
    const frozen = freezeTarget(state, challenge);
    next = {
      ...next,
      ...frozen,
      challenges: { ...state.challenges, [event.challengeId]: challenge },
    };
  }

  if (event.type === "ChallengeResolved") {
    const challenge = state.challenges[event.challengeId];
    if (!challenge || challenge.status !== "open") {
      throw new Error("Canopy state transition rejected: challenge is not open.");
    }
    if (challenge.cellId !== event.cellId) {
      throw new Error("Canopy state transition rejected: challenge resolution cell does not match.");
    }
    const resolved = resolveTarget(state, challenge, event.resolution);
    next = {
      ...next,
      ...resolved,
      challenges: {
        ...state.challenges,
        [event.challengeId]: {
          ...challenge,
          status: event.resolution,
          resolvedByEventId: event.id,
        },
      },
    };
  }

  return refreshRoots(next);
}

export function applyCanopyEvent(
  state: CanopyState,
  event: CanopyEvent,
  governance: CanopyStateMachineGovernance = {},
): CanopyState {
  const next = applyCanopyEventCore(state, event, governance);
  if (event.type !== "ObservationEvent") return next;
  const challenge = satelliteChallengeOpenedForObservation(event);
  return challenge ? applyCanopyEventCore(next, challenge, governance) : next;
}

export function replayCanopyEvents(
  events: readonly CanopyEvent[],
  governance: CanopyStateMachineGovernance = {},
): CanopyReplayReport {
  const emittedEvents: CanopyChallengeOpenedEvent[] = [];
  const replayEvents: CanopyEvent[] = [];
  let state = createInitialState();
  for (const event of events) {
    state = applyCanopyEventCore(state, event, governance);
    replayEvents.push(event);
    if (event.type !== "ObservationEvent") continue;
    const challenge = satelliteChallengeOpenedForObservation(event);
    if (!challenge) continue;
    state = applyCanopyEventCore(state, challenge, governance);
    emittedEvents.push(challenge);
    replayEvents.push(challenge);
  }
  const emittedChallengeIds = emittedEvents.map((event) => event.challengeId);
  return {
    latestReplayReportId: `canopy_replay_${hashJson({ events: replayEvents, stateRoot: state.stateRoot }).slice(0, 16)}`,
    state,
    eventCount: state.appliedEventIds.length,
    canonicalEventTypes,
    emittedChallengeIds,
    emittedEvents,
  };
}
