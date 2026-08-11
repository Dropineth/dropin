import {
  auditAttestationInputSchema,
  auditAttestationSchema,
  baselineSnapshotInputSchema,
  baselineSnapshotSchema,
  observationEventInputSchema,
  observationEventSchema,
  type AuditAttestation,
  type AuditAttestationInput,
  type BaselineSnapshot,
  type BaselineSnapshotInput,
  type ObservationEvent,
  type ObservationEventInput,
} from "@dropin/schemas/satellite-proof";
import {
  computeCanopyAuditRoot,
  computeCanopyBaselineRoot,
  computeCanopyObservationRoot,
  type CanopyAuditAttestedEvent,
  type CanopyBaselineAnchoredEvent,
  type CanopyObservationEvent,
  type CanopyVegetationGrowthDetectedEvent,
} from "@dropin/dropin-protocol";

const idFromRoot = (prefix: string, root: string): string => `${prefix}_${root.slice(0, 24)}`;

export function buildBaselineSnapshot(input: BaselineSnapshotInput): BaselineSnapshot {
  const parsed = baselineSnapshotInputSchema.parse(input);
  const baselineRoot = computeCanopyBaselineRoot({
    gridId: parsed.gridId,
    timestamp: parsed.timestamp,
    source: parsed.source,
    canopyCoverPct: parsed.canopyCoverPct,
    ndvi: parsed.ndvi,
    sarBackscatterDb: parsed.sarBackscatterDb,
  });
  return baselineSnapshotSchema.parse({
    ...parsed,
    baselineId: idFromRoot("baseline", baselineRoot),
    baselineRoot,
  });
}

export function buildObservationEvent(input: ObservationEventInput): ObservationEvent {
  const parsed = observationEventInputSchema.parse(input);
  const observationRoot = computeCanopyObservationRoot({
    gridId: parsed.gridId,
    timestamp: parsed.timestamp,
    source: parsed.source,
    observationType: parsed.eventType,
    canopyCoverPct: parsed.canopyCoverPct,
    ndvi: parsed.ndvi,
    sarBackscatterDb: parsed.sarBackscatterDb,
    treeSurvivalRate: parsed.treeSurvivalRate,
    waterStressIndex: parsed.waterStressIndex,
    anomalyConfidence: parsed.anomalyConfidence,
    anomalyThreshold: parsed.anomalyThreshold,
  });
  return observationEventSchema.parse({
    ...parsed,
    observationId: idFromRoot("observation", observationRoot),
    observationRoot,
  });
}

export function buildAuditAttestation(input: AuditAttestationInput): AuditAttestation {
  const parsed = auditAttestationInputSchema.parse(input);
  const auditRoot = computeCanopyAuditRoot({
    gridId: parsed.gridId,
    timestamp: parsed.timestamp,
    source: parsed.source,
    auditorId: parsed.auditorId,
    baselineRoot: parsed.baselineRoot,
    observationRoot: parsed.observationRoot,
    verifiedCanopyCoverPct: parsed.verifiedCanopyCoverPct,
    verifiedTreeSurvivalRate: parsed.verifiedTreeSurvivalRate,
    verifiedTco2eDelta: parsed.verifiedTco2eDelta,
    auditorSignature: parsed.auditorSignature,
  });
  return auditAttestationSchema.parse({
    ...parsed,
    auditAttestationId: idFromRoot("audit", auditRoot),
    auditRoot,
  });
}

export function baselineSnapshotToCanopyEvent(snapshot: BaselineSnapshot): CanopyBaselineAnchoredEvent {
  return {
    id: idFromRoot("evt_baseline_anchored", snapshot.baselineRoot),
    type: "BaselineAnchored",
    cellId: snapshot.gridId,
    timestamp: snapshot.timestamp,
    baselineId: snapshot.baselineId,
    baselineRoot: snapshot.baselineRoot,
    source: snapshot.source,
    canopyCoverPct: snapshot.canopyCoverPct,
    ndvi: snapshot.ndvi,
    sarBackscatterDb: snapshot.sarBackscatterDb,
  };
}

export function observationToCanopyEvent(
  observation: ObservationEvent,
  baselineRoot: string,
): CanopyObservationEvent {
  return {
    id: idFromRoot("evt_observation", observation.observationRoot),
    type: "ObservationEvent",
    cellId: observation.gridId,
    timestamp: observation.timestamp,
    observationId: observation.observationId,
    observationRoot: observation.observationRoot,
    baselineRoot,
    source: observation.source,
    observationType: observation.eventType,
    canopyCoverPct: observation.canopyCoverPct,
    ndvi: observation.ndvi,
    sarBackscatterDb: observation.sarBackscatterDb,
    treeSurvivalRate: observation.treeSurvivalRate,
    waterStressIndex: observation.waterStressIndex,
    anomalyConfidence: observation.anomalyConfidence,
    anomalyThreshold: observation.anomalyThreshold,
  };
}

export function vegetationGrowthToCanopyEvent(
  observation: ObservationEvent,
  baselineRoot: string,
): CanopyVegetationGrowthDetectedEvent | undefined {
  if (observation.eventType !== "growth") return undefined;
  return {
    id: idFromRoot("evt_vegetation_growth", observation.observationRoot),
    type: "VegetationGrowthDetected",
    cellId: observation.gridId,
    timestamp: observation.timestamp,
    baselineRoot,
    observationRoot: observation.observationRoot,
  };
}

export function auditAttestationToCanopyEvent(attestation: AuditAttestation): CanopyAuditAttestedEvent {
  return {
    id: idFromRoot("evt_audit_attested", attestation.auditRoot),
    type: "AuditAttested",
    cellId: attestation.gridId,
    timestamp: attestation.timestamp,
    auditAttestationId: attestation.auditAttestationId,
    auditRoot: attestation.auditRoot,
    baselineRoot: attestation.baselineRoot,
    observationRoot: attestation.observationRoot,
    source: attestation.source,
    auditorId: attestation.auditorId,
    verifiedCanopyCoverPct: attestation.verifiedCanopyCoverPct,
    verifiedTreeSurvivalRate: attestation.verifiedTreeSurvivalRate,
    verifiedTco2eDelta: attestation.verifiedTco2eDelta,
    auditorSignature: attestation.auditorSignature,
  };
}
