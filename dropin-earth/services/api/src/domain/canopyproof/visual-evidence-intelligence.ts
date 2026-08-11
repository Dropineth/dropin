import { hashJson } from "@dropin/crypto";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
  type CanopyProofAuditEntityType,
} from "./proof-engine.js";
import {
  evaluateVisualLicenseAction,
  type VisualLicenseAction,
  type VisualLicensePolicy,
} from "./visual-license-policy.js";
import type {
  AcquisitionMission,
  CandidateFinding,
  DatasetSnapshot,
  DatasetSnapshotMember,
  DerivedVisualAsset,
  EmbeddingIndex,
  FieldVerificationResult,
  FieldVerificationTask,
  HardNegative,
  KnownDecoy,
  MediaAsset,
  ModelDefinition,
  ModelRun,
  MultimodalDataset,
  PointCloudAsset,
  ReviewDecision,
  ReviewQueue,
  ReviewQueueSnapshot,
  SensorDomain,
  SensorDomainGap,
  SensorDomainGapDimension,
  SensorStream,
  VisualAuthorityActor,
  VisualCandidateStatus,
  VisualClassification,
  VisualFinding,
  VisualHumanReviewer,
  VisualProvenanceEdge,
  VisualRecordEnvelope,
  VisualReviewDecisionKind,
  VisualSafetyBoundary,
  VisualServiceActor,
} from "./visual-evidence-types.js";
import { validatePointCloudAssetContract } from "./point-cloud-mrv.js";

export const visualEvidenceErrorCodes = [
  "VISUAL_RECORD_NOT_FOUND",
  "VISUAL_AUTHORITY_MISMATCH",
  "VISUAL_ACTOR_NOT_AUTHORIZED",
  "VISUAL_LICENSE_DENIED",
  "VISUAL_SENSOR_DOMAIN_MISMATCH",
  "VISUAL_DATASET_MEMBER_MISMATCH",
  "VISUAL_QUEUE_MEMBERSHIP_MISMATCH",
  "VISUAL_QUEUE_HASH_MISMATCH",
  "VISUAL_HUMAN_REVIEW_REQUIRED",
  "VISUAL_REVIEWER_CONFLICT",
  "VISUAL_FIELD_CHECK_REQUIRED",
  "VISUAL_FIELD_ATTESTATION_REQUIRED",
  "VISUAL_HARD_NEGATIVE_REQUIRES_REJECTION",
  "VISUAL_MACHINE_PROOF_FORBIDDEN",
  "VISUAL_IMMUTABILITY_VIOLATION",
  "VISUAL_INVALID_INPUT",
] as const;

export type VisualEvidenceErrorCode = (typeof visualEvidenceErrorCodes)[number];

export class VisualEvidenceError extends Error {
  constructor(
    readonly code: VisualEvidenceErrorCode,
    message: string,
  ) {
    super(`${code}: ${message}`);
    this.name = "VisualEvidenceError";
  }
}

export const visualEvidenceSafetyBoundary: VisualSafetyBoundary = Object.freeze({
  appendOnly: true,
  tenantBound: true,
  licenseBound: true,
  sensorDomainBound: true,
  humanReviewRequired: true,
  governanceStillRequiredForProof: true,
  fiftyOneNotAuthority: true,
  modelCandidateNotEvidence: true,
  notCertifiedCarbonCredit: true,
  notCarbonTaxOffset: true,
  notFinancialAsset: true,
  notGuaranteedYield: true,
  noMainnetFunds: true,
  notAutomaticCanopyDistribution: true,
});

function nonEmpty(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new VisualEvidenceError("VISUAL_INVALID_INPUT", `${field} is required.`);
  return normalized;
}

function parseTimestamp(value: string, field: string) {
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    throw new VisualEvidenceError("VISUAL_INVALID_INPUT", `${field} must be an RFC3339 timestamp.`);
  }
  return new Date(milliseconds).toISOString();
}

function boundedScore(value: number, field: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new VisualEvidenceError("VISUAL_INVALID_INPUT", `${field} must be between 0 and 1.`);
  }
  return value;
}

function positiveInteger(value: number, field: string) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new VisualEvidenceError("VISUAL_INVALID_INPUT", `${field} must be a positive safe integer.`);
  }
  return value;
}

function canonicalStrings(values: readonly string[], field: string, allowEmpty = false) {
  const normalized = [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
  if (!allowEmpty && normalized.length === 0) {
    throw new VisualEvidenceError("VISUAL_INVALID_INPUT", `${field} requires at least one value.`);
  }
  return normalized;
}

type VisualActorRootInput = Omit<VisualAuthorityActor, "authorityRoot"> &
  Partial<
    Pick<VisualServiceActor, "capability"> &
      Pick<VisualHumanReviewer, "accreditationId" | "accreditationRoot" | "conflictFree">
  >;

export function visualAuthorityActorRoot(actor: VisualActorRootInput) {
  return hashJson({
    kind: "canopyproof-visual-authority-actor-v1",
    id: actor.id,
    actorType: actor.actorType,
    tenantId: actor.tenantId,
    organizationId: actor.organizationId,
    role: actor.role,
    verificationStatus: actor.verificationStatus,
    ...(actor.capability ? { capability: actor.capability } : {}),
    ...(actor.accreditationId ? { accreditationId: actor.accreditationId } : {}),
    ...(actor.accreditationRoot ? { accreditationRoot: actor.accreditationRoot } : {}),
    ...(actor.conflictFree !== undefined ? { conflictFree: actor.conflictFree } : {}),
  });
}

export function createVisualAuthorityActor(
  input: Omit<VisualAuthorityActor, "authorityRoot" | "verificationStatus">,
): VisualAuthorityActor {
  const seed = {
    id: nonEmpty(input.id, "actor.id"),
    actorType: input.actorType,
    tenantId: nonEmpty(input.tenantId, "actor.tenantId"),
    organizationId: nonEmpty(input.organizationId, "actor.organizationId"),
    role: nonEmpty(input.role, "actor.role"),
    verificationStatus: "verified" as const,
  };
  return { ...seed, authorityRoot: visualAuthorityActorRoot(seed) };
}

export function createVisualServiceActor(
  input: Omit<VisualServiceActor, "authorityRoot" | "verificationStatus" | "role"> & { readonly role?: string },
): VisualServiceActor {
  if (input.actorType !== "agent" && input.actorType !== "service") {
    throw new VisualEvidenceError("VISUAL_ACTOR_NOT_AUTHORIZED", "visual service actor must be an agent or service.");
  }
  const seed = {
    id: nonEmpty(input.id, "actor.id"),
    actorType: input.actorType,
    tenantId: nonEmpty(input.tenantId, "actor.tenantId"),
    organizationId: nonEmpty(input.organizationId, "actor.organizationId"),
    role: input.role?.trim() || "visual_service",
    verificationStatus: "verified" as const,
    capability: input.capability,
  };
  return { ...seed, authorityRoot: visualAuthorityActorRoot(seed) };
}

export function createVisualHumanReviewer(
  input: Omit<VisualHumanReviewer, "authorityRoot" | "verificationStatus" | "actorType">,
): VisualHumanReviewer {
  const seed = {
    id: nonEmpty(input.id, "reviewer.id"),
    actorType: "human" as const,
    tenantId: nonEmpty(input.tenantId, "reviewer.tenantId"),
    organizationId: nonEmpty(input.organizationId, "reviewer.organizationId"),
    role: input.role,
    verificationStatus: "verified" as const,
    accreditationId: nonEmpty(input.accreditationId, "reviewer.accreditationId"),
    accreditationRoot: nonEmpty(input.accreditationRoot, "reviewer.accreditationRoot"),
    conflictFree: input.conflictFree,
  };
  return { ...seed, authorityRoot: visualAuthorityActorRoot(seed) };
}

function verifyActor(actor: VisualAuthorityActor) {
  const expected = visualAuthorityActorRoot(actor as VisualActorRootInput);
  if (actor.authorityRoot !== expected || actor.verificationStatus !== "verified") {
    throw new VisualEvidenceError("VISUAL_ACTOR_NOT_AUTHORIZED", "actor authority root is invalid.");
  }
  return actor;
}

function assertServiceCapability(
  actor: VisualServiceActor,
  capability: VisualServiceActor["capability"],
) {
  verifyActor(actor);
  if (actor.capability !== capability) {
    throw new VisualEvidenceError(
      "VISUAL_ACTOR_NOT_AUTHORIZED",
      `actor requires ${capability}, received ${actor.capability}.`,
    );
  }
}

function assertHumanReviewer(actor: VisualHumanReviewer) {
  verifyActor(actor);
  if (actor.actorType !== "human" || !actor.accreditationId.trim() || !actor.accreditationRoot.trim()) {
    throw new VisualEvidenceError("VISUAL_HUMAN_REVIEW_REQUIRED", "a verified accredited human reviewer is required.");
  }
  if (!actor.conflictFree) {
    throw new VisualEvidenceError("VISUAL_REVIEWER_CONFLICT", "reviewer has an unresolved conflict.");
  }
}

function assertAuthorityScope(
  actor: VisualAuthorityActor,
  scope: Readonly<{ tenantId: string; organizationId: string }>,
) {
  verifyActor(actor);
  if (actor.tenantId !== scope.tenantId || actor.organizationId !== scope.organizationId) {
    throw new VisualEvidenceError(
      "VISUAL_AUTHORITY_MISMATCH",
      "actor tenant or organization does not match the governed resource.",
    );
  }
}

type VisualRecordPayload = Readonly<Record<string, unknown>>;

type BuildRecordInput<TPayload extends VisualRecordPayload> = {
  readonly recordType: string;
  readonly entityType: CanopyProofAuditEntityType;
  readonly idPrefix: string;
  readonly id?: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly projectId?: string;
  readonly classification: VisualClassification;
  readonly licensePolicyId: string;
  readonly actor: VisualAuthorityActor;
  readonly createdAt: string;
  readonly sourceRoots: readonly string[];
  readonly version?: number;
  readonly payload: TPayload;
  readonly rationale: string;
};

function buildRecord<TPayload extends VisualRecordPayload>(
  history: readonly CanopyProofAuditEvent[],
  input: BuildRecordInput<TPayload>,
): { readonly record: VisualRecordEnvelope & TPayload; readonly history: readonly CanopyProofAuditEvent[] } {
  assertAuthorityScope(input.actor, input);
  const createdAt = parseTimestamp(input.createdAt, "createdAt");
  const sourceRoots = canonicalStrings(input.sourceRoots, "sourceRoots", true);
  const idSeed = hashJson({
    kind: `canopyproof-${input.recordType}-id-v1`,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    projectId: input.projectId ?? null,
    payload: input.payload,
    sourceRoots,
    version: input.version ?? 1,
  });
  const id = input.id?.trim() || `${input.idPrefix}_${idSeed.slice(0, 24)}`;
  const factSeed = {
    id,
    recordType: input.recordType,
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    classification: input.classification,
    licensePolicyId: input.licensePolicyId,
    createdBy: input.actor.id,
    createdByActorType: input.actor.actorType,
    actorAuthorityRoot: input.actor.authorityRoot,
    actorSnapshot: input.actor,
    createdAt,
    sourceRoots,
    version: input.version ?? 1,
    ...input.payload,
  };
  const factHash = hashJson({ kind: `canopyproof-${input.recordType}-fact-v1`, ...factSeed });
  const nextHistory = appendCanopyProofAuditEvent(history, {
    action: "ASSERT",
    actor: input.actor.id,
    entityType: input.entityType,
    entityId: id,
    payload: { factHash, sourceRoots, recordType: input.recordType },
    createdAt,
    rationale: input.rationale,
  });
  const auditEvent = nextHistory.at(-1);
  if (!auditEvent) throw new VisualEvidenceError("VISUAL_IMMUTABILITY_VIOLATION", "audit append failed.");
  const factRoot = hashJson({
    kind: `canopyproof-${input.recordType}-root-v1`,
    factHash,
    sourceRoots,
    auditEventRoot: auditEvent.eventRoot,
  });
  const record = {
    ...factSeed,
    factHash,
    factRoot,
    auditEvent,
    safety: visualEvidenceSafetyBoundary,
  } as VisualRecordEnvelope & TPayload;
  return { record, history: nextHistory };
}

function compareRecordScope(left: VisualRecordEnvelope, right: VisualRecordEnvelope) {
  if (
    left.tenantId !== right.tenantId ||
    left.organizationId !== right.organizationId ||
    left.projectId !== right.projectId
  ) {
    throw new VisualEvidenceError(
      "VISUAL_AUTHORITY_MISMATCH",
      "records from different tenant, organization, or project scopes cannot be combined.",
    );
  }
}

function requireFromMap<T>(map: ReadonlyMap<string, T>, id: string, label: string): T {
  const value = map.get(id);
  if (!value) throw new VisualEvidenceError("VISUAL_RECORD_NOT_FOUND", `${label} ${id} was not found.`);
  return value;
}

export type ModelDomainAssessment = {
  readonly compatible: boolean;
  readonly gaps: readonly SensorDomainGapDimension[];
  readonly assessmentRoot: string;
};

export function assessModelSensorDomain(
  model: ModelDefinition,
  source: SensorDomain,
): ModelDomainAssessment {
  const policy = model.domainPolicy;
  const gaps: SensorDomainGapDimension[] = [];
  if (!policy.supportedSensors.includes(source.sensor)) gaps.push("SENSOR");
  if (
    source.resolutionUnit !== policy.supportedResolutionUnit ||
    source.resolution < policy.supportedResolutionRange[0] ||
    source.resolution > policy.supportedResolutionRange[1]
  ) {
    gaps.push("RESOLUTION");
  }
  if (
    policy.supportedAltitudeRange &&
    (source.altitudeMeters === undefined ||
      source.altitudeMeters < policy.supportedAltitudeRange[0] ||
      source.altitudeMeters > policy.supportedAltitudeRange[1])
  ) {
    gaps.push("ALTITUDE");
  }
  if (!policy.supportedSeasons.includes(source.season)) gaps.push("SEASON");
  if (!policy.supportedEcosystems.includes(source.ecosystem)) gaps.push("ECOSYSTEM");
  if (!policy.supportedGeographies.includes(source.geography)) gaps.push("GEOGRAPHY");
  if (policy.requiresCalibration && source.calibrationState !== "calibrated") gaps.push("CALIBRATION");
  const normalized = [...new Set(gaps)].sort() as readonly SensorDomainGapDimension[];
  return {
    compatible: normalized.length === 0,
    gaps: normalized,
    assessmentRoot: hashJson({
      kind: "canopyproof-visual-sensor-domain-assessment-v1",
      modelDefinitionRoot: model.factRoot,
      source,
      gaps: normalized,
    }),
  };
}

export type CanopyProofVisualEvidenceAuthoritySnapshot = {
  readonly schemaVersion: "canopyproof.visual-authority-snapshot.v1";
  readonly acquisitionMissions: readonly AcquisitionMission[];
  readonly sensorStreams: readonly SensorStream[];
  readonly datasets: readonly MultimodalDataset[];
  readonly datasetSnapshots: readonly DatasetSnapshot[];
  readonly mediaAssets: readonly MediaAsset[];
  readonly pointCloudAssets: readonly PointCloudAsset[];
  readonly derivedAssets: readonly DerivedVisualAsset[];
  readonly modelDefinitions: readonly ModelDefinition[];
  readonly modelRuns: readonly ModelRun[];
  readonly embeddingIndexes: readonly EmbeddingIndex[];
  readonly candidates: readonly CandidateFinding[];
  readonly reviewQueues: readonly ReviewQueue[];
  readonly reviewQueueSnapshots: readonly ReviewQueueSnapshot[];
  readonly reviewDecisions: readonly ReviewDecision[];
  readonly fieldTasks: readonly FieldVerificationTask[];
  readonly fieldResults: readonly FieldVerificationResult[];
  readonly hardNegatives: readonly HardNegative[];
  readonly knownDecoys: readonly KnownDecoy[];
  readonly sensorDomainGaps: readonly SensorDomainGap[];
  readonly visualFindings: readonly VisualFinding[];
  readonly provenanceEdges: readonly VisualProvenanceEdge[];
  readonly auditHistory: readonly CanopyProofAuditEvent[];
  readonly snapshotRoot: string;
  readonly safety: VisualSafetyBoundary;
};

type DatasetRegistrationInput = {
  readonly datasetId?: string;
  readonly datasetName: string;
  readonly purpose: MultimodalDataset["purpose"];
  readonly tenantId: string;
  readonly organizationId: string;
  readonly projectId?: string;
  readonly classification: VisualClassification;
  readonly pairingPolicyVersion: string;
  readonly sensorStreamIds: readonly string[];
  readonly members: readonly DatasetSnapshotMember[];
  readonly pairingEdgeRoots: readonly string[];
  readonly createdAt: string;
  readonly licensePolicy: VisualLicensePolicy;
};

export class CanopyProofVisualEvidenceAuthorityService {
  private readonly acquisitionMissions = new Map<string, AcquisitionMission>();
  private readonly sensorStreams = new Map<string, SensorStream>();
  private readonly datasets = new Map<string, MultimodalDataset>();
  private readonly datasetSnapshots = new Map<string, DatasetSnapshot>();
  private readonly mediaAssets = new Map<string, MediaAsset>();
  private readonly pointCloudAssets = new Map<string, PointCloudAsset>();
  private readonly pointCloudObjectIdentity = new Map<string, string>();
  private readonly derivedAssets = new Map<string, DerivedVisualAsset>();
  private readonly modelDefinitions = new Map<string, ModelDefinition>();
  private readonly modelRuns = new Map<string, ModelRun>();
  private readonly embeddingIndexes = new Map<string, EmbeddingIndex>();
  private readonly candidates = new Map<string, CandidateFinding>();
  private readonly reviewQueues = new Map<string, ReviewQueue>();
  private readonly reviewQueueVersions = new Map<string, ReviewQueue>();
  private readonly reviewQueueSnapshots = new Map<string, ReviewQueueSnapshot>();
  private readonly reviewDecisions = new Map<string, ReviewDecision>();
  private readonly fieldTasks = new Map<string, FieldVerificationTask>();
  private readonly fieldResults = new Map<string, FieldVerificationResult>();
  private readonly hardNegatives = new Map<string, HardNegative>();
  private readonly knownDecoys = new Map<string, KnownDecoy>();
  private readonly sensorDomainGaps = new Map<string, SensorDomainGap>();
  private readonly visualFindings = new Map<string, VisualFinding>();
  private readonly provenanceEdges = new Map<string, VisualProvenanceEdge>();
  private auditHistory: readonly CanopyProofAuditEvent[] = [];

  static fromAuthoritySnapshot(snapshot: CanopyProofVisualEvidenceAuthoritySnapshot) {
    const verification = verifyVisualEvidenceAuthoritySnapshot(snapshot);
    if (!verification.valid) {
      throw new VisualEvidenceError(
        "VISUAL_IMMUTABILITY_VIOLATION",
        `visual authority snapshot cannot be replayed: ${verification.issues.join(", ")}`,
      );
    }

    const service = new CanopyProofVisualEvidenceAuthorityService();
    hydrateRecordMap(service.acquisitionMissions, snapshot.acquisitionMissions);
    hydrateRecordMap(service.sensorStreams, snapshot.sensorStreams);
    hydrateRecordMap(service.datasets, snapshot.datasets);
    hydrateRecordMap(service.datasetSnapshots, snapshot.datasetSnapshots);
    hydrateRecordMap(service.mediaAssets, snapshot.mediaAssets);
    hydrateRecordMap(service.pointCloudAssets, snapshot.pointCloudAssets);
    hydrateRecordMap(service.derivedAssets, snapshot.derivedAssets);
    hydrateRecordMap(service.modelDefinitions, snapshot.modelDefinitions);
    hydrateRecordMap(service.modelRuns, snapshot.modelRuns);
    hydrateRecordMap(service.embeddingIndexes, snapshot.embeddingIndexes);
    hydrateRecordMap(service.candidates, snapshot.candidates);
    hydrateRecordMap(service.reviewQueueSnapshots, snapshot.reviewQueueSnapshots);
    hydrateRecordMap(service.reviewDecisions, snapshot.reviewDecisions);
    hydrateRecordMap(service.fieldTasks, snapshot.fieldTasks);
    hydrateRecordMap(service.fieldResults, snapshot.fieldResults);
    hydrateRecordMap(service.hardNegatives, snapshot.hardNegatives);
    hydrateRecordMap(service.knownDecoys, snapshot.knownDecoys);
    hydrateRecordMap(service.sensorDomainGaps, snapshot.sensorDomainGaps);
    hydrateRecordMap(service.visualFindings, snapshot.visualFindings);
    hydrateRecordMap(service.provenanceEdges, snapshot.provenanceEdges);

    for (const asset of snapshot.pointCloudAssets) {
      service.pointCloudObjectIdentity.set(`${asset.terraProofAssetId}\u0000${asset.objectVersion}`, asset.id);
    }
    for (const queue of snapshot.reviewQueues) {
      service.reviewQueueVersions.set(`${queue.id}:${queue.version}`, queue);
      const current = service.reviewQueues.get(queue.id);
      if (!current || queue.version > current.version) service.reviewQueues.set(queue.id, queue);
    }
    service.auditHistory = [...snapshot.auditHistory];
    return service;
  }

  registerAcquisitionMission(
    input: Omit<
      AcquisitionMission,
      keyof VisualRecordEnvelope | "recordType" | "sensorStreamIds"
    > &
      Readonly<{
        tenantId: string;
        organizationId: string;
        projectId?: string;
        classification: VisualClassification;
        licensePolicyId: string;
        sensorStreamIds?: readonly string[];
      }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_dataset_registration");
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-acquisition-mission",
      entityType: "visual_acquisition_mission",
      idPrefix: "cp_visual_mission",
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      classification: input.classification,
      licensePolicyId: input.licensePolicyId,
      actor,
      createdAt: input.startedAt,
      sourceRoots: input.permitRoots,
      payload: {
        recordType: "acquisition_mission",
        missionName: nonEmpty(input.missionName, "missionName"),
        platformType: nonEmpty(input.platformType, "platformType"),
        purpose: nonEmpty(input.purpose, "purpose"),
        startedAt: parseTimestamp(input.startedAt, "startedAt"),
        ...(input.completedAt ? { completedAt: parseTimestamp(input.completedAt, "completedAt") } : {}),
        geometryRef: nonEmpty(input.geometryRef, "geometryRef"),
        permitRoots: canonicalStrings(input.permitRoots, "permitRoots", true),
        sensorStreamIds: canonicalStrings(input.sensorStreamIds ?? [], "sensorStreamIds", true),
      },
      rationale: "Register immutable visual acquisition mission.",
    });
    const mission = result.record as AcquisitionMission;
    this.acquisitionMissions.set(mission.id, mission);
    this.auditHistory = result.history;
    return mission;
  }

  registerSensorStream(
    input: Omit<SensorStream, keyof VisualRecordEnvelope | "recordType"> &
      Readonly<{
        tenantId: string;
        organizationId: string;
        projectId?: string;
        classification: VisualClassification;
        licensePolicyId: string;
        createdAt: string;
      }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_dataset_registration");
    const mission = requireFromMap(this.acquisitionMissions, input.acquisitionMissionId, "acquisition mission");
    assertAuthorityScope(actor, mission);
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-sensor-stream",
      entityType: "visual_sensor_stream",
      idPrefix: "cp_visual_sensor",
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      classification: input.classification,
      licensePolicyId: input.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [mission.factRoot, input.serialCommitment, input.calibrationRecordId ?? ""],
      payload: {
        recordType: "sensor_stream",
        acquisitionMissionId: mission.id,
        modality: input.modality,
        make: nonEmpty(input.make, "sensor make"),
        model: nonEmpty(input.model, "sensor model"),
        serialCommitment: nonEmpty(input.serialCommitment, "serialCommitment"),
        nativeResolution: boundedPositive(input.nativeResolution, "nativeResolution"),
        resolutionUnit: input.resolutionUnit,
        ...(input.altitudeRangeMeters ? { altitudeRangeMeters: validateRange(input.altitudeRangeMeters, "altitudeRangeMeters") } : {}),
        ...(input.calibrationRecordId ? { calibrationRecordId: input.calibrationRecordId } : {}),
        calibrationState: input.calibrationState,
        clockQuality: input.clockQuality,
        coordinateFrame: input.coordinateFrame,
        knownLimitations: canonicalStrings(input.knownLimitations, "knownLimitations", true),
      },
      rationale: "Register immutable visual sensor stream.",
    });
    const stream = result.record as SensorStream;
    this.sensorStreams.set(stream.id, stream);
    this.auditHistory = result.history;
    return stream;
  }

  registerDataset(input: DatasetRegistrationInput, actor: VisualServiceActor) {
    assertServiceCapability(actor, "visual_dataset_registration");
    assertAuthorityScope(actor, input);
    const licenseAction: VisualLicenseAction = input.purpose === "LAB_BENCHMARK" ? "LAB_BENCHMARK" : "INTERNAL_REVIEW";
    const licenseDecision = evaluateVisualLicenseAction(input.licensePolicy, licenseAction, input.createdAt, {
      attributionIncluded: input.licensePolicy.modifiers.includes("ATTRIBUTION_REQUIRED"),
    });
    if (!licenseDecision.allowed) {
      throw new VisualEvidenceError("VISUAL_LICENSE_DENIED", licenseDecision.reason);
    }
    const members = normalizeDatasetMembers(input.members);
    for (const member of members) {
      const stream = requireFromMap(this.sensorStreams, member.sensorStreamId, "sensor stream");
      assertAuthorityScope(actor, stream);
      if (member.licensePolicyId !== input.licensePolicy.id) {
        throw new VisualEvidenceError(
          "VISUAL_LICENSE_DENIED",
          `dataset member ${member.sampleId} does not bind the evaluated license policy.`,
        );
      }
    }
    const datasetId = input.datasetId?.trim() || `cp_visual_dataset_${hashJson({
      kind: "canopyproof-visual-dataset-stable-id-v1",
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      projectId: input.projectId ?? null,
      name: input.datasetName,
    }).slice(0, 24)}`;
    const datasetManifestHash = hashJson({
      kind: "canopyproof-visual-dataset-manifest-v1",
      datasetId,
      members,
      pairingEdgeRoots: canonicalStrings(input.pairingEdgeRoots, "pairingEdgeRoots", true),
      licenseDecisionRoot: licenseDecision.decisionRoot,
    });
    const snapshotResult = buildRecord(this.auditHistory, {
      recordType: "visual-dataset-snapshot",
      entityType: "visual_dataset_snapshot",
      idPrefix: "cp_visual_dataset_snapshot",
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      classification: input.classification,
      licensePolicyId: input.licensePolicy.id,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [
        ...members.map((member) => member.assetRoot),
        input.licensePolicy.policyRoot,
        licenseDecision.decisionRoot,
        ...input.pairingEdgeRoots,
      ],
      payload: {
        recordType: "dataset_snapshot",
        datasetId,
        datasetManifestHash,
        members,
        pairingEdgeRoots: canonicalStrings(input.pairingEdgeRoots, "pairingEdgeRoots", true),
        schemaVersion: "canopyproof.visual-dataset-snapshot.v1",
      },
      rationale: "Freeze visual dataset membership and evaluated rights.",
    });
    const snapshot = snapshotResult.record as DatasetSnapshot;
    const datasetResult = buildRecord(snapshotResult.history, {
      recordType: "visual-dataset",
      entityType: "visual_dataset",
      idPrefix: "cp_visual_dataset",
      id: datasetId,
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      classification: input.classification,
      licensePolicyId: input.licensePolicy.id,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [snapshot.factRoot, licenseDecision.decisionRoot],
      payload: {
        recordType: "multimodal_dataset",
        name: nonEmpty(input.datasetName, "datasetName"),
        purpose: input.purpose,
        sensorStreamIds: canonicalStrings(input.sensorStreamIds, "sensorStreamIds"),
        currentSnapshotId: snapshot.id,
        pairingPolicyVersion: nonEmpty(input.pairingPolicyVersion, "pairingPolicyVersion"),
      },
      rationale: "Register governed visual dataset and current immutable snapshot.",
    });
    const dataset = datasetResult.record as MultimodalDataset;
    this.datasetSnapshots.set(snapshot.id, snapshot);
    this.datasets.set(dataset.id, dataset);
    this.auditHistory = datasetResult.history;
    return { dataset, snapshot, licenseDecision };
  }

  registerMediaAsset(
    input: Omit<MediaAsset, keyof VisualRecordEnvelope | "recordType"> &
      Readonly<{
        tenantId: string;
        organizationId: string;
        projectId?: string;
        classification: VisualClassification;
        licensePolicyId: string;
        createdAt: string;
      }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_dataset_registration");
    requireFromMap(this.sensorStreams, input.sensorStreamId, "sensor stream");
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-media-asset",
      entityType: "visual_media_asset",
      idPrefix: "cp_visual_media",
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      classification: input.classification,
      licensePolicyId: input.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [input.terraProofAssetId, input.contentHash, input.objectVersion],
      payload: {
        recordType: "media_asset",
        terraProofAssetId: nonEmpty(input.terraProofAssetId, "terraProofAssetId"),
        objectVersion: nonEmpty(input.objectVersion, "objectVersion"),
        contentHash: nonEmpty(input.contentHash, "contentHash"),
        contentType: nonEmpty(input.contentType, "contentType"),
        byteLength: positiveInteger(input.byteLength, "byteLength"),
        ...(input.width !== undefined ? { width: positiveInteger(input.width, "width") } : {}),
        ...(input.height !== undefined ? { height: positiveInteger(input.height, "height") } : {}),
        ...(input.durationMs !== undefined ? { durationMs: positiveInteger(input.durationMs, "durationMs") } : {}),
        sensorStreamId: input.sensorStreamId,
        capturedAt: parseTimestamp(input.capturedAt, "capturedAt"),
        locationPolicy: input.locationPolicy,
        validationState: input.validationState,
      },
      rationale: "Register immutable visual media reference.",
    });
    const asset = result.record as MediaAsset;
    this.mediaAssets.set(asset.id, asset);
    this.auditHistory = result.history;
    return asset;
  }

  registerPointCloudAsset(
    input: Omit<PointCloudAsset, keyof VisualRecordEnvelope | "recordType"> &
      Readonly<{
        tenantId: string;
        organizationId: string;
        projectId?: string;
        classification: VisualClassification;
        licensePolicyId: string;
        createdAt: string;
      }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_dataset_registration");
    const objectIdentity = `${input.terraProofAssetId.trim()}\u0000${input.objectVersion.trim()}`;
    const priorAssetId = this.pointCloudObjectIdentity.get(objectIdentity);
    if (priorAssetId) {
      const prior = requireFromMap(this.pointCloudAssets, priorAssetId, "point-cloud asset");
      if (prior.contentHash !== input.contentHash || prior.byteLength !== input.byteLength) {
        throw new VisualEvidenceError(
          "VISUAL_IMMUTABILITY_VIOLATION",
          "a TerraProof point-cloud object version cannot be rebound to different bytes.",
        );
      }
      return prior;
    }
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-point-cloud-asset",
      entityType: "visual_point_cloud_asset",
      idPrefix: "cp_visual_point_cloud",
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      classification: input.classification,
      licensePolicyId: input.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [input.terraProofAssetId, input.contentHash, input.objectVersion, ...input.sourcePointCloudRoots],
      payload: {
        recordType: "point_cloud_asset",
        terraProofAssetId: nonEmpty(input.terraProofAssetId, "terraProofAssetId"),
        format: input.format,
        assetRole: input.assetRole,
        objectVersion: nonEmpty(input.objectVersion, "objectVersion"),
        contentHash: nonEmpty(input.contentHash, "contentHash"),
        byteLength: positiveInteger(input.byteLength, "byteLength"),
        pointCount: positiveInteger(input.pointCount, "pointCount"),
        dimensions: canonicalStrings(input.dimensions, "dimensions"),
        ...(input.crs ? { crs: input.crs } : {}),
        ...(input.crsWkt ? { crsWkt: input.crsWkt } : {}),
        ...(input.verticalDatum ? { verticalDatum: input.verticalDatum } : {}),
        horizontalUnit: nonEmpty(input.horizontalUnit, "horizontalUnit"),
        verticalUnit: nonEmpty(input.verticalUnit, "verticalUnit"),
        coordinateFrame: input.coordinateFrame,
        bounds: input.bounds,
        scale: input.scale,
        offset: input.offset,
        ...(input.registration ? { registration: input.registration } : {}),
        sourcePointCloudRoots: canonicalStrings(input.sourcePointCloudRoots, "sourcePointCloudRoots", input.format === "LAZ"),
        qualityAssessmentRoot: nonEmpty(input.qualityAssessmentRoot, "qualityAssessmentRoot"),
        uncertaintyRoot: nonEmpty(input.uncertaintyRoot, "uncertaintyRoot"),
      },
      rationale: "Register immutable point-cloud asset role and lineage.",
    });
    const asset = result.record as PointCloudAsset;
    validatePointCloudAssetContract(asset);
    this.pointCloudAssets.set(asset.id, asset);
    this.pointCloudObjectIdentity.set(objectIdentity, asset.id);
    this.auditHistory = result.history;
    return asset;
  }

  registerDerivedVisualAsset(
    input: Omit<DerivedVisualAsset, keyof VisualRecordEnvelope | "recordType" | "authoritative"> &
      Readonly<{
        tenantId: string;
        organizationId: string;
        projectId?: string;
        classification: VisualClassification;
        licensePolicyId: string;
        createdAt: string;
      }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_dataset_registration");
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-derived-asset",
      entityType: "visual_derived_asset",
      idPrefix: "cp_visual_derived",
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      classification: input.classification,
      licensePolicyId: input.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: input.sourceAssetRoots,
      payload: {
        recordType: "derived_visual_asset",
        derivedType: input.derivedType,
        processingRecipeId: nonEmpty(input.processingRecipeId, "processingRecipeId"),
        processingRunId: nonEmpty(input.processingRunId, "processingRunId"),
        objectVersion: nonEmpty(input.objectVersion, "objectVersion"),
        contentHash: nonEmpty(input.contentHash, "contentHash"),
        byteLength: positiveInteger(input.byteLength, "byteLength"),
        sourceAssetRoots: canonicalStrings(input.sourceAssetRoots, "sourceAssetRoots"),
        qualityAssessmentRoot: nonEmpty(input.qualityAssessmentRoot, "qualityAssessmentRoot"),
        uncertaintyRoot: nonEmpty(input.uncertaintyRoot, "uncertaintyRoot"),
        authoritative: false,
      },
      rationale: "Register non-authoritative visual derivative with complete lineage.",
    });
    const asset = result.record as DerivedVisualAsset;
    this.derivedAssets.set(asset.id, asset);
    this.auditHistory = result.history;
    return asset;
  }

  registerModelDefinition(
    input: Omit<ModelDefinition, keyof VisualRecordEnvelope | "recordType" | "advisoryOnly" | "prohibitedUses"> &
      Readonly<{
        tenantId: string;
        organizationId: string;
        projectId?: string;
        classification: VisualClassification;
        licensePolicyId: string;
        createdAt: string;
      }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_model_execution");
    validateModelDomainPolicy(input.domainPolicy);
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-model-definition",
      entityType: "visual_model_definition",
      idPrefix: "cp_visual_model",
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      classification: input.classification,
      licensePolicyId: input.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [input.artifactHash, input.containerDigest, input.sbomHash, input.preprocessingContractHash],
      payload: {
        recordType: "model_definition",
        name: nonEmpty(input.name, "model name"),
        modelFamily: nonEmpty(input.modelFamily, "modelFamily"),
        artifactHash: nonEmpty(input.artifactHash, "artifactHash"),
        containerDigest: nonEmpty(input.containerDigest, "containerDigest"),
        sbomHash: nonEmpty(input.sbomHash, "sbomHash"),
        preprocessingContractHash: nonEmpty(input.preprocessingContractHash, "preprocessingContractHash"),
        outputSchemaVersion: nonEmpty(input.outputSchemaVersion, "outputSchemaVersion"),
        domainPolicy: input.domainPolicy,
        advisoryOnly: true,
        prohibitedUses: [
          "VERIFY_EVIDENCE",
          "ISSUE_CERTIFICATE",
          "PUBLISH_ESG_METRIC",
          "RELEASE_FUNDING",
        ] as const,
      },
      rationale: "Register immutable advisory visual model definition.",
    });
    const model = result.record as ModelDefinition;
    this.modelDefinitions.set(model.id, model);
    this.auditHistory = result.history;
    return model;
  }

  recordModelRun(
    input: Readonly<{
      modelDefinitionId: string;
      datasetSnapshotId: string;
      sourceDomain: SensorDomain;
      canonicalParametersHash: string;
      deterministicSeed?: string;
      runtimeDigest: string;
      startedAt: string;
      completedAt: string;
      outputRoot: string;
      approvedDomainException?: Readonly<{
        approvalId: string;
        approvedGapDimensions: readonly SensorDomainGapDimension[];
        expiresAt: string;
      }>;
      licensePolicy: VisualLicensePolicy;
    }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_model_execution");
    const model = requireFromMap(this.modelDefinitions, input.modelDefinitionId, "model definition");
    const snapshot = requireFromMap(this.datasetSnapshots, input.datasetSnapshotId, "dataset snapshot");
    compareRecordScope(model, snapshot);
    assertAuthorityScope(actor, model);
    const license = evaluateVisualLicenseAction(input.licensePolicy, "MODEL_EVALUATION", input.startedAt, {
      attributionIncluded: input.licensePolicy.modifiers.includes("ATTRIBUTION_REQUIRED"),
    });
    if (!license.allowed) throw new VisualEvidenceError("VISUAL_LICENSE_DENIED", license.reason);
    const assessment = assessModelSensorDomain(model, input.sourceDomain);
    let gap: SensorDomainGap | undefined;
    if (!assessment.compatible) {
      const exception = input.approvedDomainException;
      const approvedDimensions = exception ? [...new Set(exception.approvedGapDimensions)].sort() : [];
      const exactGapMatch = JSON.stringify(approvedDimensions) === JSON.stringify(assessment.gaps);
      const exceptionCurrent = exception ? Date.parse(exception.expiresAt) > Date.parse(input.startedAt) : false;
      if (!exception || !exactGapMatch || !exceptionCurrent) {
        gap = this.recordSensorDomainGap(
          {
            model,
            sourceDomain: input.sourceDomain,
            gaps: assessment.gaps,
            disposition: "BLOCKED",
            createdAt: input.startedAt,
          },
          actor,
        );
        throw new VisualEvidenceError(
          "VISUAL_SENSOR_DOMAIN_MISMATCH",
          `model run blocked by ${assessment.gaps.join(", ")} domain gap; record ${gap.id}.`,
        );
      }
      gap = this.recordSensorDomainGap(
        {
          model,
          sourceDomain: input.sourceDomain,
          gaps: assessment.gaps,
          disposition: "APPROVED_EXCEPTION",
          approvalId: exception.approvalId,
          expiresAt: exception.expiresAt,
          createdAt: input.startedAt,
        },
        actor,
      );
    }
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-model-run",
      entityType: "visual_model_run",
      idPrefix: "cp_visual_model_run",
      tenantId: model.tenantId,
      organizationId: model.organizationId,
      ...(model.projectId ? { projectId: model.projectId } : {}),
      classification: model.classification,
      licensePolicyId: input.licensePolicy.id,
      actor,
      createdAt: input.completedAt,
      sourceRoots: [model.factRoot, snapshot.factRoot, license.decisionRoot, assessment.assessmentRoot, gap?.factRoot ?? ""],
      payload: {
        recordType: "model_run",
        modelDefinitionId: model.id,
        datasetSnapshotId: snapshot.id,
        canonicalParametersHash: nonEmpty(input.canonicalParametersHash, "canonicalParametersHash"),
        ...(input.deterministicSeed ? { deterministicSeed: input.deterministicSeed } : {}),
        runtimeDigest: nonEmpty(input.runtimeDigest, "runtimeDigest"),
        startedAt: parseTimestamp(input.startedAt, "startedAt"),
        completedAt: parseTimestamp(input.completedAt, "completedAt"),
        outputRoot: nonEmpty(input.outputRoot, "outputRoot"),
        status: "COMPLETED",
        ...(gap ? { sensorDomainGapId: gap.id } : {}),
      },
      rationale: "Record advisory visual model execution.",
    });
    const run = result.record as ModelRun;
    this.modelRuns.set(run.id, run);
    this.auditHistory = result.history;
    return run;
  }

  recordCandidate(
    input: Readonly<{
      modelRunId: string;
      sampleId: string;
      geometry: Readonly<Record<string, unknown>>;
      modelScore: number;
      geometryScore?: number;
      noveltyScore?: number;
      uncertaintyScore?: number;
      crossSensorAgreement?: number;
      temporalChangeScore?: number;
      sensorDomain: SensorDomain;
      createdAt: string;
    }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_candidate_import");
    const run = requireFromMap(this.modelRuns, input.modelRunId, "model run");
    const snapshot = requireFromMap(this.datasetSnapshots, run.datasetSnapshotId, "dataset snapshot");
    assertAuthorityScope(actor, run);
    const member = snapshot.members.find((candidate) => candidate.sampleId === input.sampleId);
    if (!member) {
      throw new VisualEvidenceError(
        "VISUAL_DATASET_MEMBER_MISMATCH",
        `sample ${input.sampleId} is not in immutable snapshot ${snapshot.id}.`,
      );
    }
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-candidate",
      entityType: "visual_candidate",
      idPrefix: "cp_visual_candidate",
      tenantId: run.tenantId,
      organizationId: run.organizationId,
      ...(run.projectId ? { projectId: run.projectId } : {}),
      classification: run.classification,
      licensePolicyId: run.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [run.factRoot, snapshot.factRoot, member.assetRoot],
      payload: {
        recordType: "candidate_finding",
        datasetSnapshotId: snapshot.id,
        sampleId: member.sampleId,
        assetRoot: member.assetRoot,
        modelRunId: run.id,
        geometry: input.geometry,
        modelScore: boundedScore(input.modelScore, "modelScore"),
        ...(input.geometryScore !== undefined ? { geometryScore: boundedScore(input.geometryScore, "geometryScore") } : {}),
        ...(input.noveltyScore !== undefined ? { noveltyScore: boundedScore(input.noveltyScore, "noveltyScore") } : {}),
        ...(input.uncertaintyScore !== undefined
          ? { uncertaintyScore: boundedScore(input.uncertaintyScore, "uncertaintyScore") }
          : {}),
        ...(input.crossSensorAgreement !== undefined
          ? { crossSensorAgreement: boundedScore(input.crossSensorAgreement, "crossSensorAgreement") }
          : {}),
        ...(input.temporalChangeScore !== undefined
          ? { temporalChangeScore: boundedScore(input.temporalChangeScore, "temporalChangeScore") }
          : {}),
        sensorDomain: input.sensorDomain,
        status: "CANDIDATE",
        advisoryOnly: true,
        evidenceAuthority: "NONE",
      },
      rationale: "Append advisory visual candidate hypothesis.",
    });
    const candidate = result.record as CandidateFinding;
    this.candidates.set(candidate.id, candidate);
    this.auditHistory = result.history;
    this.appendProvenanceEdge(
      {
        sourceId: run.id,
        sourceRoot: run.factRoot,
        targetId: candidate.id,
        targetRoot: candidate.factRoot,
        relation: "WAS_GENERATED_BY",
        createdAt: input.createdAt,
      },
      actor,
      candidate,
    );
    return candidate;
  }

  createReviewQueue(
    input: Readonly<{
      queueId?: string;
      datasetSnapshotId: string;
      candidateIds: readonly string[];
      sampleIds: readonly string[];
      purpose: string;
      methodologyId: string;
      requiredReviewerRoles: ReviewQueue["requiredReviewerRoles"];
      secondReviewRequired: boolean;
      fieldCheckPolicy: ReviewQueue["fieldCheckPolicy"];
      filterExpression: string;
      sortExpression: string;
      modelRunIds: readonly string[];
      randomQaSeed?: string;
      priorQueueSnapshotId?: string;
      createdAt: string;
    }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_manifest_issuance");
    const datasetSnapshot = requireFromMap(this.datasetSnapshots, input.datasetSnapshotId, "dataset snapshot");
    assertAuthorityScope(actor, datasetSnapshot);
    const candidateIds = uniqueOrdered(input.candidateIds, "candidateIds");
    const sampleIds = uniqueOrdered(input.sampleIds, "sampleIds");
    const modelRunIds = uniqueOrdered(input.modelRunIds, "modelRunIds");
    for (const candidateId of candidateIds) {
      const candidate = requireFromMap(this.candidates, candidateId, "candidate");
      compareRecordScope(datasetSnapshot, candidate);
      if (candidate.datasetSnapshotId !== datasetSnapshot.id || !sampleIds.includes(candidate.sampleId)) {
        throw new VisualEvidenceError(
          "VISUAL_QUEUE_MEMBERSHIP_MISMATCH",
          `candidate ${candidate.id} is not a member of the frozen dataset/sample selection.`,
        );
      }
      if (!modelRunIds.includes(candidate.modelRunId)) {
        throw new VisualEvidenceError(
          "VISUAL_QUEUE_MEMBERSHIP_MISMATCH",
          `candidate ${candidate.id} model run is missing from queue selection.`,
        );
      }
    }
    for (const sampleId of sampleIds) {
      if (!datasetSnapshot.members.some((member) => member.sampleId === sampleId)) {
        throw new VisualEvidenceError(
          "VISUAL_QUEUE_MEMBERSHIP_MISMATCH",
          `sample ${sampleId} is not in dataset snapshot ${datasetSnapshot.id}.`,
        );
      }
    }
    let priorSnapshot: ReviewQueueSnapshot | undefined;
    if (input.priorQueueSnapshotId) {
      priorSnapshot = requireFromMap(this.reviewQueueSnapshots, input.priorQueueSnapshotId, "prior queue snapshot");
      compareRecordScope(priorSnapshot, datasetSnapshot);
    }
    const queueId =
      input.queueId?.trim() ||
      priorSnapshot?.reviewQueueId ||
      `cp_visual_review_queue_${hashJson({
        kind: "canopyproof-visual-review-queue-stable-id-v1",
        tenantId: datasetSnapshot.tenantId,
        organizationId: datasetSnapshot.organizationId,
        projectId: datasetSnapshot.projectId ?? null,
        purpose: input.purpose,
        methodologyId: input.methodologyId,
      }).slice(0, 24)}`;
    if (priorSnapshot && priorSnapshot.reviewQueueId !== queueId) {
      throw new VisualEvidenceError("VISUAL_QUEUE_MEMBERSHIP_MISMATCH", "prior snapshot belongs to a different queue.");
    }
    const reviewQueueHash = hashJson({
      kind: "canopyproof-visual-review-queue-snapshot-v1",
      reviewQueueId: queueId,
      datasetSnapshotId: datasetSnapshot.id,
      datasetManifestHash: datasetSnapshot.datasetManifestHash,
      sampleIds,
      candidateIds,
      filterExpression: input.filterExpression,
      sortExpression: input.sortExpression,
      modelRunIds,
      randomQaSeed: input.randomQaSeed ?? null,
    });
    if (priorSnapshot && reviewQueueHash === priorSnapshot.reviewQueueHash) {
      return {
        queue: requireFromMap(this.reviewQueues, queueId, "review queue"),
        snapshot: priorSnapshot,
        createdNewVersion: false as const,
      };
    }
    const version = (priorSnapshot?.version ?? 0) + 1;
    const snapshotResult = buildRecord(this.auditHistory, {
      recordType: "visual-review-queue-snapshot",
      entityType: "visual_review_queue_snapshot",
      idPrefix: "cp_visual_review_queue_snapshot",
      tenantId: datasetSnapshot.tenantId,
      organizationId: datasetSnapshot.organizationId,
      ...(datasetSnapshot.projectId ? { projectId: datasetSnapshot.projectId } : {}),
      classification: datasetSnapshot.classification,
      licensePolicyId: datasetSnapshot.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [
        datasetSnapshot.factRoot,
        ...candidateIds.map((id) => requireFromMap(this.candidates, id, "candidate").factRoot),
        ...(priorSnapshot ? [priorSnapshot.factRoot] : []),
      ],
      version,
      payload: {
        recordType: "review_queue_snapshot",
        reviewQueueId: queueId,
        datasetSnapshotId: datasetSnapshot.id,
        datasetManifestHash: datasetSnapshot.datasetManifestHash,
        sampleIds,
        candidateIds,
        filterExpression: nonEmpty(input.filterExpression, "filterExpression"),
        sortExpression: nonEmpty(input.sortExpression, "sortExpression"),
        modelRunIds,
        ...(input.randomQaSeed ? { randomQaSeed: input.randomQaSeed } : {}),
        ...(priorSnapshot ? { priorQueueSnapshotId: priorSnapshot.id } : {}),
        reviewQueueHash,
      },
      rationale: priorSnapshot
        ? "Append new immutable review queue version after selection drift."
        : "Freeze immutable visual review queue membership.",
    });
    const snapshot = snapshotResult.record as ReviewQueueSnapshot;
    const queueResult = buildRecord(snapshotResult.history, {
      recordType: "visual-review-queue",
      entityType: "visual_review_queue",
      idPrefix: "cp_visual_review_queue",
      id: queueId,
      tenantId: datasetSnapshot.tenantId,
      organizationId: datasetSnapshot.organizationId,
      ...(datasetSnapshot.projectId ? { projectId: datasetSnapshot.projectId } : {}),
      classification: datasetSnapshot.classification,
      licensePolicyId: datasetSnapshot.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [snapshot.factRoot, ...(priorSnapshot ? [priorSnapshot.factRoot] : [])],
      version,
      payload: {
        recordType: "review_queue",
        purpose: nonEmpty(input.purpose, "purpose"),
        methodologyId: nonEmpty(input.methodologyId, "methodologyId"),
        requiredReviewerRoles: canonicalStrings(input.requiredReviewerRoles, "requiredReviewerRoles") as ReviewQueue["requiredReviewerRoles"],
        secondReviewRequired: input.secondReviewRequired,
        fieldCheckPolicy: input.fieldCheckPolicy,
        currentSnapshotId: snapshot.id,
      },
      rationale: "Record current immutable visual review queue version.",
    });
    const queue = queueResult.record as ReviewQueue;
    this.reviewQueueSnapshots.set(snapshot.id, snapshot);
    this.reviewQueues.set(queue.id, queue);
    this.reviewQueueVersions.set(`${queue.id}:${queue.version}`, queue);
    this.auditHistory = queueResult.history;
    return { queue, snapshot, createdNewVersion: true as const };
  }

  recordReviewDecision(
    input: Readonly<{
      candidateId: string;
      reviewQueueSnapshotId: string;
      decision: VisualReviewDecisionKind;
      rationaleCode: string;
      notesHash?: string;
      adjustedGeometry?: Readonly<Record<string, unknown>>;
      reviewerConfidence: number;
      supersedesDecisionId?: string;
      reviewedAt: string;
    }>,
    reviewer: VisualHumanReviewer,
  ) {
    assertHumanReviewer(reviewer);
    const candidate = requireFromMap(this.candidates, input.candidateId, "candidate");
    const snapshot = requireFromMap(this.reviewQueueSnapshots, input.reviewQueueSnapshotId, "review queue snapshot");
    const queue = requireFromMap(this.reviewQueues, snapshot.reviewQueueId, "review queue");
    assertAuthorityScope(reviewer, candidate);
    compareRecordScope(candidate, snapshot);
    if (!snapshot.candidateIds.includes(candidate.id)) {
      throw new VisualEvidenceError(
        "VISUAL_QUEUE_MEMBERSHIP_MISMATCH",
        `candidate ${candidate.id} is not in queue snapshot ${snapshot.id}.`,
      );
    }
    if (!queue.requiredReviewerRoles.includes(reviewer.role)) {
      throw new VisualEvidenceError(
        "VISUAL_ACTOR_NOT_AUTHORIZED",
        `reviewer role ${reviewer.role} is not assigned to queue ${queue.id}.`,
      );
    }
    let superseded: ReviewDecision | undefined;
    if (input.supersedesDecisionId) {
      superseded = requireFromMap(this.reviewDecisions, input.supersedesDecisionId, "review decision");
      if (superseded.candidateId !== candidate.id) {
        throw new VisualEvidenceError("VISUAL_IMMUTABILITY_VIOLATION", "decision can supersede only the same candidate.");
      }
    }
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-review-decision",
      entityType: "visual_review_decision",
      idPrefix: "cp_visual_review",
      tenantId: candidate.tenantId,
      organizationId: candidate.organizationId,
      ...(candidate.projectId ? { projectId: candidate.projectId } : {}),
      classification: candidate.classification,
      licensePolicyId: candidate.licensePolicyId,
      actor: reviewer,
      createdAt: input.reviewedAt,
      sourceRoots: [candidate.factRoot, snapshot.factRoot, reviewer.accreditationRoot, superseded?.factRoot ?? ""],
      payload: {
        recordType: "review_decision",
        candidateId: candidate.id,
        reviewQueueSnapshotId: snapshot.id,
        reviewerId: reviewer.id,
        reviewerAccreditationRoot: reviewer.accreditationRoot,
        decision: input.decision,
        rationaleCode: nonEmpty(input.rationaleCode, "rationaleCode"),
        ...(input.notesHash ? { notesHash: input.notesHash } : {}),
        ...(input.adjustedGeometry ? { adjustedGeometry: input.adjustedGeometry } : {}),
        reviewerConfidence: boundedScore(input.reviewerConfidence, "reviewerConfidence"),
        ...(superseded ? { supersedesDecisionId: superseded.id } : {}),
      },
      rationale: "Append independent human visual review decision.",
    });
    const decision = result.record as ReviewDecision;
    this.reviewDecisions.set(decision.id, decision);
    this.auditHistory = result.history;
    return decision;
  }

  createFieldVerificationTask(
    input: Readonly<{
      candidateId: string;
      generalizedGeometry: Readonly<Record<string, unknown>>;
      reason: string;
      requiredObservations: readonly string[];
      assignedOrganizationId: string;
      assignedReviewerId: string;
      expiresAt: string;
      createdAt: string;
    }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_field_task_assignment");
    const candidate = requireFromMap(this.candidates, input.candidateId, "candidate");
    assertAuthorityScope(actor, candidate);
    if (input.assignedOrganizationId !== candidate.organizationId) {
      throw new VisualEvidenceError("VISUAL_AUTHORITY_MISMATCH", "field task organization must match candidate authority.");
    }
    if (Date.parse(input.expiresAt) <= Date.parse(input.createdAt)) {
      throw new VisualEvidenceError("VISUAL_INVALID_INPUT", "field task expiry must follow creation.");
    }
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-field-task",
      entityType: "visual_field_verification_task",
      idPrefix: "cp_visual_field_task",
      tenantId: candidate.tenantId,
      organizationId: candidate.organizationId,
      ...(candidate.projectId ? { projectId: candidate.projectId } : {}),
      classification: candidate.classification,
      licensePolicyId: candidate.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [candidate.factRoot],
      payload: {
        recordType: "field_verification_task",
        candidateId: candidate.id,
        generalizedGeometry: input.generalizedGeometry,
        reason: nonEmpty(input.reason, "field task reason"),
        requiredObservations: canonicalStrings(input.requiredObservations, "requiredObservations"),
        assignedOrganizationId: input.assignedOrganizationId,
        assignedReviewerId: nonEmpty(input.assignedReviewerId, "assignedReviewerId"),
        expiresAt: parseTimestamp(input.expiresAt, "expiresAt"),
        deviceBindingRequired: true,
        status: "OPEN",
      },
      rationale: "Append bounded field-verification assignment.",
    });
    const task = result.record as FieldVerificationTask;
    this.fieldTasks.set(task.id, task);
    this.auditHistory = result.history;
    return task;
  }

  recordFieldVerificationResult(
    input: Readonly<{
      fieldTaskId: string;
      gpsHash: string;
      gpsAccuracyMeters: number;
      observedAt: string;
      mediaRoots: readonly string[];
      notesHash: string;
      deviceAttestationRoot: string;
      deviceAttestationCurrent: boolean;
      result: FieldVerificationResult["result"];
    }>,
    reviewer: VisualHumanReviewer,
  ) {
    assertHumanReviewer(reviewer);
    const task = requireFromMap(this.fieldTasks, input.fieldTaskId, "field task");
    assertAuthorityScope(reviewer, task);
    if (task.assignedReviewerId !== reviewer.id || task.assignedOrganizationId !== reviewer.organizationId) {
      throw new VisualEvidenceError("VISUAL_ACTOR_NOT_AUTHORIZED", "field task is assigned to another reviewer.");
    }
    const observedAt = parseTimestamp(input.observedAt, "observedAt");
    if (Date.parse(observedAt) > Date.parse(task.expiresAt)) {
      throw new VisualEvidenceError("VISUAL_FIELD_CHECK_REQUIRED", "field result was observed after task expiry.");
    }
    if (!input.deviceAttestationCurrent || !input.deviceAttestationRoot.trim()) {
      throw new VisualEvidenceError(
        "VISUAL_FIELD_ATTESTATION_REQUIRED",
        "field-confirmed result requires a current device attestation.",
      );
    }
    if (!Number.isFinite(input.gpsAccuracyMeters) || input.gpsAccuracyMeters <= 0) {
      throw new VisualEvidenceError("VISUAL_INVALID_INPUT", "GPS accuracy must be positive and finite.");
    }
    const existing = [...this.fieldResults.values()].find((result) => result.fieldTaskId === task.id);
    if (existing) {
      throw new VisualEvidenceError(
        "VISUAL_IMMUTABILITY_VIOLATION",
        `field task ${task.id} already has immutable result ${existing.id}.`,
      );
    }
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-field-result",
      entityType: "visual_field_verification_result",
      idPrefix: "cp_visual_field_result",
      tenantId: task.tenantId,
      organizationId: task.organizationId,
      ...(task.projectId ? { projectId: task.projectId } : {}),
      classification: task.classification,
      licensePolicyId: task.licensePolicyId,
      actor: reviewer,
      createdAt: observedAt,
      sourceRoots: [task.factRoot, input.deviceAttestationRoot, ...input.mediaRoots],
      payload: {
        recordType: "field_verification_result",
        fieldTaskId: task.id,
        reviewerId: reviewer.id,
        gpsHash: nonEmpty(input.gpsHash, "gpsHash"),
        gpsAccuracyMeters: input.gpsAccuracyMeters,
        observedAt,
        mediaRoots: canonicalStrings(input.mediaRoots, "mediaRoots"),
        notesHash: nonEmpty(input.notesHash, "notesHash"),
        deviceAttestationRoot: input.deviceAttestationRoot,
        result: input.result,
      },
      rationale: "Append device-bound field-verification result.",
    });
    const fieldResult = result.record as FieldVerificationResult;
    this.fieldResults.set(fieldResult.id, fieldResult);
    this.auditHistory = result.history;
    return fieldResult;
  }

  registerHardNegative(
    input: Readonly<{
      candidateId: string;
      reviewDecisionId: string;
      decoyType: HardNegative["decoyType"];
      licensePolicy: VisualLicensePolicy;
      createdAt: string;
    }>,
    reviewer: VisualHumanReviewer,
  ) {
    assertHumanReviewer(reviewer);
    const candidate = requireFromMap(this.candidates, input.candidateId, "candidate");
    const decision = requireFromMap(this.reviewDecisions, input.reviewDecisionId, "review decision");
    assertAuthorityScope(reviewer, candidate);
    if (decision.candidateId !== candidate.id || decision.decision !== "REJECT_FALSE_POSITIVE") {
      throw new VisualEvidenceError(
        "VISUAL_HARD_NEGATIVE_REQUIRES_REJECTION",
        "hard negative requires an immutable human false-positive rejection.",
      );
    }
    const evaluationDecision = evaluateVisualLicenseAction(input.licensePolicy, "MODEL_EVALUATION", input.createdAt, {
      attributionIncluded: input.licensePolicy.modifiers.includes("ATTRIBUTION_REQUIRED"),
    });
    const trainingDecision = evaluateVisualLicenseAction(input.licensePolicy, "MODEL_TRAINING", input.createdAt, {
      attributionIncluded: input.licensePolicy.modifiers.includes("ATTRIBUTION_REQUIRED"),
    });
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-hard-negative",
      entityType: "visual_hard_negative",
      idPrefix: "cp_visual_hard_negative",
      tenantId: candidate.tenantId,
      organizationId: candidate.organizationId,
      ...(candidate.projectId ? { projectId: candidate.projectId } : {}),
      classification: candidate.classification,
      licensePolicyId: input.licensePolicy.id,
      actor: reviewer,
      createdAt: input.createdAt,
      sourceRoots: [candidate.factRoot, decision.factRoot, evaluationDecision.decisionRoot, trainingDecision.decisionRoot],
      payload: {
        recordType: "hard_negative",
        candidateId: candidate.id,
        reviewDecisionId: decision.id,
        decoyType: input.decoyType,
        modelRunId: candidate.modelRunId,
        evaluationUseAllowed: evaluationDecision.allowed,
        trainingUseAllowed: trainingDecision.allowed,
      },
      rationale: "Preserve rejected candidate as an append-only hard negative.",
    });
    const hardNegative = result.record as HardNegative;
    this.hardNegatives.set(hardNegative.id, hardNegative);
    this.auditHistory = result.history;
    return hardNegative;
  }

  registerKnownDecoy(
    input: Readonly<{
      name: string;
      decoyType: KnownDecoy["decoyType"];
      assetRoot: string;
      confirmationRoot: string;
      evaluationUseAllowed: boolean;
      trainingUseAllowed: boolean;
      tenantId: string;
      organizationId: string;
      projectId?: string;
      classification: VisualClassification;
      licensePolicyId: string;
      createdAt: string;
    }>,
    reviewer: VisualHumanReviewer,
  ) {
    assertHumanReviewer(reviewer);
    assertAuthorityScope(reviewer, input);
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-known-decoy",
      entityType: "visual_known_decoy",
      idPrefix: "cp_visual_known_decoy",
      tenantId: input.tenantId,
      organizationId: input.organizationId,
      ...(input.projectId ? { projectId: input.projectId } : {}),
      classification: input.classification,
      licensePolicyId: input.licensePolicyId,
      actor: reviewer,
      createdAt: input.createdAt,
      sourceRoots: [input.assetRoot, input.confirmationRoot],
      payload: {
        recordType: "known_decoy",
        name: nonEmpty(input.name, "decoy name"),
        decoyType: input.decoyType,
        assetRoot: nonEmpty(input.assetRoot, "assetRoot"),
        expectedDisposition: "REJECT_FALSE_POSITIVE",
        confirmationRoot: nonEmpty(input.confirmationRoot, "confirmationRoot"),
        evaluationUseAllowed: input.evaluationUseAllowed,
        trainingUseAllowed: input.trainingUseAllowed,
      },
      rationale: "Register reviewed known decoy without deleting the source candidate.",
    });
    const decoy = result.record as KnownDecoy;
    this.knownDecoys.set(decoy.id, decoy);
    this.auditHistory = result.history;
    return decoy;
  }

  createVisualFinding(
    input: Readonly<{
      candidateId: string;
      reviewDecisionIds: readonly string[];
      fieldVerificationResultId?: string;
      geometry: Readonly<Record<string, unknown>>;
      observedAt: string;
      qualityAssessmentRoot: string;
      uncertaintyRoot: string;
      createdAt: string;
    }>,
    reviewer: VisualHumanReviewer,
  ) {
    assertHumanReviewer(reviewer);
    const candidate = requireFromMap(this.candidates, input.candidateId, "candidate");
    assertAuthorityScope(reviewer, candidate);
    const decisionIds = uniqueOrdered(input.reviewDecisionIds, "reviewDecisionIds");
    const decisions = decisionIds.map((id) => requireFromMap(this.reviewDecisions, id, "review decision"));
    if (
      decisions.length === 0 ||
      decisions.some((decision) => decision.candidateId !== candidate.id) ||
      !decisions.some((decision) => decision.decision === "ACCEPT_FOR_BOUNDED_FINDING")
    ) {
      throw new VisualEvidenceError(
        "VISUAL_HUMAN_REVIEW_REQUIRED",
        "bounded visual finding requires an accepting human decision for the candidate.",
      );
    }
    const queueSnapshots = decisions.map((decision) =>
      requireFromMap(this.reviewQueueSnapshots, decision.reviewQueueSnapshotId, "review queue snapshot"),
    );
    const queues = queueSnapshots.map((snapshot) => requireFromMap(this.reviewQueues, snapshot.reviewQueueId, "review queue"));
    if (queues.some((queue) => queue.secondReviewRequired)) {
      const distinctReviewers = new Set(decisions.map((decision) => decision.reviewerId));
      if (distinctReviewers.size < 2) {
        throw new VisualEvidenceError("VISUAL_HUMAN_REVIEW_REQUIRED", "queue requires two distinct human reviewers.");
      }
    }
    let fieldResult: FieldVerificationResult | undefined;
    if (input.fieldVerificationResultId) {
      fieldResult = requireFromMap(this.fieldResults, input.fieldVerificationResultId, "field result");
      const task = requireFromMap(this.fieldTasks, fieldResult.fieldTaskId, "field task");
      if (task.candidateId !== candidate.id || fieldResult.result !== "CONFIRMED") {
        throw new VisualEvidenceError("VISUAL_FIELD_CHECK_REQUIRED", "field result does not confirm this candidate.");
      }
    }
    if (queues.some((queue) => queue.fieldCheckPolicy === "REQUIRED_FOR_ACCEPTANCE") && !fieldResult) {
      throw new VisualEvidenceError("VISUAL_FIELD_CHECK_REQUIRED", "queue requires a confirmed field result.");
    }
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-finding",
      entityType: "visual_finding",
      idPrefix: "cp_visual_finding",
      tenantId: candidate.tenantId,
      organizationId: candidate.organizationId,
      ...(candidate.projectId ? { projectId: candidate.projectId } : {}),
      classification: candidate.classification,
      licensePolicyId: candidate.licensePolicyId,
      actor: reviewer,
      createdAt: input.createdAt,
      sourceRoots: [candidate.factRoot, ...decisions.map((decision) => decision.factRoot), fieldResult?.factRoot ?? ""],
      payload: {
        recordType: "visual_finding",
        candidateId: candidate.id,
        reviewDecisionIds: decisionIds,
        ...(fieldResult ? { fieldVerificationResultId: fieldResult.id } : {}),
        geometry: input.geometry,
        observedAt: parseTimestamp(input.observedAt, "observedAt"),
        qualityAssessmentRoot: nonEmpty(input.qualityAssessmentRoot, "qualityAssessmentRoot"),
        uncertaintyRoot: nonEmpty(input.uncertaintyRoot, "uncertaintyRoot"),
        status: fieldResult ? "FIELD_CHECKED" : "HUMAN_REVIEWED",
        boundedObservation: true,
        evidenceVerificationState: "NOT_EVIDENCE",
        governanceApprovalRequired: true,
      },
      rationale: "Create bounded human-reviewed visual finding without proof authority.",
    });
    const finding = result.record as VisualFinding;
    this.visualFindings.set(finding.id, finding);
    this.auditHistory = result.history;
    return finding;
  }

  registerEmbeddingIndex(
    input: Omit<EmbeddingIndex, keyof VisualRecordEnvelope | "recordType" | "authoritative"> &
      Readonly<{ createdAt: string }>,
    actor: VisualServiceActor,
  ) {
    assertServiceCapability(actor, "visual_model_execution");
    const snapshot = requireFromMap(this.datasetSnapshots, input.datasetSnapshotId, "dataset snapshot");
    const run = requireFromMap(this.modelRuns, input.modelRunId, "model run");
    compareRecordScope(snapshot, run);
    assertAuthorityScope(actor, snapshot);
    const expectedMembershipHash = hashJson({
      kind: "canopyproof-visual-embedding-membership-v1",
      datasetSnapshotId: snapshot.id,
      sampleIds: snapshot.members.map((member) => member.sampleId),
    });
    if (input.membershipHash !== expectedMembershipHash) {
      throw new VisualEvidenceError("VISUAL_DATASET_MEMBER_MISMATCH", "embedding membership hash does not match snapshot.");
    }
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-embedding-index",
      entityType: "visual_embedding_index",
      idPrefix: "cp_visual_embedding",
      tenantId: snapshot.tenantId,
      organizationId: snapshot.organizationId,
      ...(snapshot.projectId ? { projectId: snapshot.projectId } : {}),
      classification: snapshot.classification,
      licensePolicyId: snapshot.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [snapshot.factRoot, run.factRoot, input.objectRef],
      payload: {
        recordType: "embedding_index",
        datasetSnapshotId: snapshot.id,
        modelRunId: run.id,
        dimension: positiveInteger(input.dimension, "dimension"),
        normalization: input.normalization,
        distanceMetric: input.distanceMetric,
        implementation: nonEmpty(input.implementation, "implementation"),
        implementationVersion: nonEmpty(input.implementationVersion, "implementationVersion"),
        membershipHash: input.membershipHash,
        objectRef: nonEmpty(input.objectRef, "objectRef"),
        authoritative: false,
      },
      rationale: "Register disposable reproducible embedding index.",
    });
    const index = result.record as EmbeddingIndex;
    this.embeddingIndexes.set(index.id, index);
    this.auditHistory = result.history;
    return index;
  }

  candidateStatus(candidateId: string): VisualCandidateStatus {
    requireFromMap(this.candidates, candidateId, "candidate");
    const decisions = [...this.reviewDecisions.values()].filter((decision) => decision.candidateId === candidateId);
    const fieldTasks = [...this.fieldTasks.values()].filter((task) => task.candidateId === candidateId);
    if (decisions.some((decision) => decision.decision === "CHALLENGE")) return "CHALLENGED";
    if (decisions.some((decision) => decision.decision === "REJECT_FALSE_POSITIVE")) return "HUMAN_REJECTED";
    if (fieldTasks.length > 0 || decisions.some((decision) => decision.decision === "REQUEST_FIELD_CHECK")) {
      return "FIELD_CHECK_REQUIRED";
    }
    if (decisions.some((decision) => decision.decision === "ACCEPT_FOR_BOUNDED_FINDING")) return "HUMAN_ACCEPTED";
    if (decisions.length > 0) return "UNDER_REVIEW";
    return "CANDIDATE";
  }

  assertMachineCannotIssueProof(actor: VisualAuthorityActor): never {
    verifyActor(actor);
    throw new VisualEvidenceError(
      "VISUAL_MACHINE_PROOF_FORBIDDEN",
      "visual candidates, AI, devices, services, and workbench actions have no proof issuance capability.",
    );
  }

  getDataset(id: string) {
    return requireFromMap(this.datasets, id, "dataset");
  }

  getDatasetSnapshot(id: string) {
    return requireFromMap(this.datasetSnapshots, id, "dataset snapshot");
  }

  getCandidate(id: string) {
    return requireFromMap(this.candidates, id, "candidate");
  }

  getReviewQueueSnapshot(id: string) {
    return requireFromMap(this.reviewQueueSnapshots, id, "review queue snapshot");
  }

  getReviewDecision(id: string) {
    return requireFromMap(this.reviewDecisions, id, "review decision");
  }

  getFieldTask(id: string) {
    return requireFromMap(this.fieldTasks, id, "field task");
  }

  getVisualFinding(id: string) {
    return requireFromMap(this.visualFindings, id, "visual finding");
  }

  listSensorDomainGaps() {
    return [...this.sensorDomainGaps.values()];
  }

  listHardNegatives() {
    return [...this.hardNegatives.values()];
  }

  listKnownDecoys() {
    return [...this.knownDecoys.values()];
  }

  getAuditHistory() {
    return [...this.auditHistory];
  }

  getAuthoritySnapshot(): CanopyProofVisualEvidenceAuthoritySnapshot {
    const content = {
      schemaVersion: "canopyproof.visual-authority-snapshot.v1" as const,
      acquisitionMissions: sortRecords(this.acquisitionMissions.values()),
      sensorStreams: sortRecords(this.sensorStreams.values()),
      datasets: sortRecords(this.datasets.values()),
      datasetSnapshots: sortRecords(this.datasetSnapshots.values()),
      mediaAssets: sortRecords(this.mediaAssets.values()),
      pointCloudAssets: sortRecords(this.pointCloudAssets.values()),
      derivedAssets: sortRecords(this.derivedAssets.values()),
      modelDefinitions: sortRecords(this.modelDefinitions.values()),
      modelRuns: sortRecords(this.modelRuns.values()),
      embeddingIndexes: sortRecords(this.embeddingIndexes.values()),
      candidates: sortRecords(this.candidates.values()),
      reviewQueues: sortRecords(this.reviewQueueVersions.values()),
      reviewQueueSnapshots: sortRecords(this.reviewQueueSnapshots.values()),
      reviewDecisions: sortRecords(this.reviewDecisions.values()),
      fieldTasks: sortRecords(this.fieldTasks.values()),
      fieldResults: sortRecords(this.fieldResults.values()),
      hardNegatives: sortRecords(this.hardNegatives.values()),
      knownDecoys: sortRecords(this.knownDecoys.values()),
      sensorDomainGaps: sortRecords(this.sensorDomainGaps.values()),
      visualFindings: sortRecords(this.visualFindings.values()),
      provenanceEdges: sortRecords(this.provenanceEdges.values()),
      auditHistory: [...this.auditHistory],
      safety: visualEvidenceSafetyBoundary,
    };
    return {
      ...content,
      snapshotRoot: hashJson({
        kind: "canopyproof-visual-authority-snapshot-v1",
        recordRoots: allSnapshotRecords(content).map((record) => record.factRoot),
        auditRoots: content.auditHistory.map((event) => event.eventRoot),
        safety: content.safety,
      }),
    };
  }

  private recordSensorDomainGap(
    input: Readonly<{
      model: ModelDefinition;
      sourceDomain: SensorDomain;
      gaps: readonly SensorDomainGapDimension[];
      disposition: SensorDomainGap["disposition"];
      approvalId?: string;
      expiresAt?: string;
      createdAt: string;
    }>,
    actor: VisualServiceActor,
  ) {
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-sensor-domain-gap",
      entityType: "visual_sensor_domain_gap",
      idPrefix: "cp_visual_domain_gap",
      tenantId: input.model.tenantId,
      organizationId: input.model.organizationId,
      ...(input.model.projectId ? { projectId: input.model.projectId } : {}),
      classification: input.model.classification,
      licensePolicyId: input.model.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [input.model.factRoot, input.approvalId ?? ""],
      payload: {
        recordType: "sensor_domain_gap",
        modelDefinitionId: input.model.id,
        sourceDomain: input.sourceDomain,
        gapDimensions: [...input.gaps].sort(),
        disposition: input.disposition,
        ...(input.approvalId ? { approvalId: input.approvalId } : {}),
        ...(input.expiresAt ? { expiresAt: parseTimestamp(input.expiresAt, "domain exception expiresAt") } : {}),
      },
      rationale:
        input.disposition === "BLOCKED"
          ? "Record blocked sensor-domain mismatch."
          : "Record narrowly approved sensor-domain exception.",
    });
    const gap = result.record as SensorDomainGap;
    this.sensorDomainGaps.set(gap.id, gap);
    this.auditHistory = result.history;
    return gap;
  }

  private appendProvenanceEdge(
    input: Readonly<{
      sourceId: string;
      sourceRoot: string;
      targetId: string;
      targetRoot: string;
      relation: VisualProvenanceEdge["relation"];
      createdAt: string;
    }>,
    actor: VisualAuthorityActor,
    target: VisualRecordEnvelope,
  ) {
    const result = buildRecord(this.auditHistory, {
      recordType: "visual-provenance-edge",
      entityType: "visual_provenance_edge",
      idPrefix: "cp_visual_provenance",
      tenantId: target.tenantId,
      organizationId: target.organizationId,
      ...(target.projectId ? { projectId: target.projectId } : {}),
      classification: target.classification,
      licensePolicyId: target.licensePolicyId,
      actor,
      createdAt: input.createdAt,
      sourceRoots: [input.sourceRoot, input.targetRoot],
      payload: {
        recordType: "visual_provenance_edge",
        sourceId: input.sourceId,
        sourceRoot: input.sourceRoot,
        targetId: input.targetId,
        targetRoot: input.targetRoot,
        relation: input.relation,
      },
      rationale: "Append visual provenance edge.",
    });
    const edge = result.record as VisualProvenanceEdge;
    this.provenanceEdges.set(edge.id, edge);
    this.auditHistory = result.history;
    return edge;
  }
}

function boundedPositive(value: number, field: string) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new VisualEvidenceError("VISUAL_INVALID_INPUT", `${field} must be positive and finite.`);
  }
  return value;
}

function validateRange(range: readonly [number, number], field: string): readonly [number, number] {
  if (!Number.isFinite(range[0]) || !Number.isFinite(range[1]) || range[0] < 0 || range[1] < range[0]) {
    throw new VisualEvidenceError("VISUAL_INVALID_INPUT", `${field} must be a finite ascending range.`);
  }
  return [range[0], range[1]];
}

function validateModelDomainPolicy(policy: ModelDefinition["domainPolicy"]) {
  canonicalStrings(policy.supportedSensors, "supportedSensors");
  validateRange(policy.supportedResolutionRange, "supportedResolutionRange");
  if (policy.supportedAltitudeRange) validateRange(policy.supportedAltitudeRange, "supportedAltitudeRange");
  canonicalStrings(policy.supportedSeasons, "supportedSeasons");
  canonicalStrings(policy.supportedEcosystems, "supportedEcosystems");
  canonicalStrings(policy.supportedGeographies, "supportedGeographies");
  canonicalStrings(policy.knownLimitations, "knownLimitations", true);
  canonicalStrings(policy.calibrationDatasetRefs, "calibrationDatasetRefs", true);
}

function normalizeDatasetMembers(members: readonly DatasetSnapshotMember[]) {
  const sampleIds = new Set<string>();
  return [...members]
    .map((member) => {
      const sampleId = nonEmpty(member.sampleId, "member.sampleId");
      if (sampleIds.has(sampleId)) {
        throw new VisualEvidenceError("VISUAL_DATASET_MEMBER_MISMATCH", `duplicate sample ${sampleId}.`);
      }
      sampleIds.add(sampleId);
      return {
        sampleId,
        assetId: nonEmpty(member.assetId, "member.assetId"),
        assetVersion: positiveInteger(member.assetVersion, "member.assetVersion"),
        assetRoot: nonEmpty(member.assetRoot, "member.assetRoot"),
        contentHash: nonEmpty(member.contentHash, "member.contentHash"),
        sensorStreamId: nonEmpty(member.sensorStreamId, "member.sensorStreamId"),
        pairedSampleIds: canonicalStrings(member.pairedSampleIds, "member.pairedSampleIds", true),
        licensePolicyId: nonEmpty(member.licensePolicyId, "member.licensePolicyId"),
      };
    })
    .sort((left, right) => left.sampleId.localeCompare(right.sampleId));
}

function uniqueOrdered(values: readonly string[], field: string) {
  const normalized = values.map((value) => nonEmpty(value, field));
  if (new Set(normalized).size !== normalized.length || normalized.length === 0) {
    throw new VisualEvidenceError("VISUAL_INVALID_INPUT", `${field} must be non-empty and unique.`);
  }
  return normalized;
}

function sortRecords<T extends VisualRecordEnvelope>(records: Iterable<T>) {
  return [...records].sort((left, right) => left.id.localeCompare(right.id));
}

function hydrateRecordMap<T extends VisualRecordEnvelope>(target: Map<string, T>, records: readonly T[]) {
  for (const record of records) {
    if (target.has(record.id)) {
      throw new VisualEvidenceError(
        "VISUAL_IMMUTABILITY_VIOLATION",
        `visual authority snapshot contains duplicate record id ${record.id}.`,
      );
    }
    target.set(record.id, record);
  }
}

function allSnapshotRecords(content: Omit<CanopyProofVisualEvidenceAuthoritySnapshot, "snapshotRoot">) {
  return [
    ...content.acquisitionMissions,
    ...content.sensorStreams,
    ...content.datasets,
    ...content.datasetSnapshots,
    ...content.mediaAssets,
    ...content.pointCloudAssets,
    ...content.derivedAssets,
    ...content.modelDefinitions,
    ...content.modelRuns,
    ...content.embeddingIndexes,
    ...content.candidates,
    ...content.reviewQueues,
    ...content.reviewQueueSnapshots,
    ...content.reviewDecisions,
    ...content.fieldTasks,
    ...content.fieldResults,
    ...content.hardNegatives,
    ...content.knownDecoys,
    ...content.sensorDomainGaps,
    ...content.visualFindings,
    ...content.provenanceEdges,
  ];
}

export function visualAuthorityRecords(
  snapshot: CanopyProofVisualEvidenceAuthoritySnapshot,
): readonly VisualRecordEnvelope[] {
  return allSnapshotRecords(snapshot);
}

export function rebuildVisualEvidenceAuthoritySnapshot(
  records: readonly VisualRecordEnvelope[],
  auditHistory: readonly CanopyProofAuditEvent[],
): CanopyProofVisualEvidenceAuthoritySnapshot {
  const acquisitionMissions: AcquisitionMission[] = [];
  const sensorStreams: SensorStream[] = [];
  const datasets: MultimodalDataset[] = [];
  const datasetSnapshots: DatasetSnapshot[] = [];
  const mediaAssets: MediaAsset[] = [];
  const pointCloudAssets: PointCloudAsset[] = [];
  const derivedAssets: DerivedVisualAsset[] = [];
  const modelDefinitions: ModelDefinition[] = [];
  const modelRuns: ModelRun[] = [];
  const embeddingIndexes: EmbeddingIndex[] = [];
  const candidates: CandidateFinding[] = [];
  const reviewQueues: ReviewQueue[] = [];
  const reviewQueueSnapshots: ReviewQueueSnapshot[] = [];
  const reviewDecisions: ReviewDecision[] = [];
  const fieldTasks: FieldVerificationTask[] = [];
  const fieldResults: FieldVerificationResult[] = [];
  const hardNegatives: HardNegative[] = [];
  const knownDecoys: KnownDecoy[] = [];
  const sensorDomainGaps: SensorDomainGap[] = [];
  const visualFindings: VisualFinding[] = [];
  const provenanceEdges: VisualProvenanceEdge[] = [];

  for (const record of records) {
    const recordType = (record as VisualRecordEnvelope & { readonly recordType?: unknown }).recordType;
    switch (recordType) {
      case "acquisition_mission":
        acquisitionMissions.push(record as AcquisitionMission);
        break;
      case "sensor_stream":
        sensorStreams.push(record as SensorStream);
        break;
      case "multimodal_dataset":
        datasets.push(record as MultimodalDataset);
        break;
      case "dataset_snapshot":
        datasetSnapshots.push(record as DatasetSnapshot);
        break;
      case "media_asset":
        mediaAssets.push(record as MediaAsset);
        break;
      case "point_cloud_asset":
        pointCloudAssets.push(record as PointCloudAsset);
        break;
      case "derived_visual_asset":
        derivedAssets.push(record as DerivedVisualAsset);
        break;
      case "model_definition":
        modelDefinitions.push(record as ModelDefinition);
        break;
      case "model_run":
        modelRuns.push(record as ModelRun);
        break;
      case "embedding_index":
        embeddingIndexes.push(record as EmbeddingIndex);
        break;
      case "candidate_finding":
        candidates.push(record as CandidateFinding);
        break;
      case "review_queue":
        reviewQueues.push(record as ReviewQueue);
        break;
      case "review_queue_snapshot":
        reviewQueueSnapshots.push(record as ReviewQueueSnapshot);
        break;
      case "review_decision":
        reviewDecisions.push(record as ReviewDecision);
        break;
      case "field_verification_task":
        fieldTasks.push(record as FieldVerificationTask);
        break;
      case "field_verification_result":
        fieldResults.push(record as FieldVerificationResult);
        break;
      case "hard_negative":
        hardNegatives.push(record as HardNegative);
        break;
      case "known_decoy":
        knownDecoys.push(record as KnownDecoy);
        break;
      case "sensor_domain_gap":
        sensorDomainGaps.push(record as SensorDomainGap);
        break;
      case "visual_finding":
        visualFindings.push(record as VisualFinding);
        break;
      case "visual_provenance_edge":
        provenanceEdges.push(record as VisualProvenanceEdge);
        break;
      default:
        throw new VisualEvidenceError(
          "VISUAL_IMMUTABILITY_VIOLATION",
          `unsupported durable visual record type for ${record.id}.`,
        );
    }
  }

  const content = {
    schemaVersion: "canopyproof.visual-authority-snapshot.v1" as const,
    acquisitionMissions: sortRecords(acquisitionMissions),
    sensorStreams: sortRecords(sensorStreams),
    datasets: sortRecords(datasets),
    datasetSnapshots: sortRecords(datasetSnapshots),
    mediaAssets: sortRecords(mediaAssets),
    pointCloudAssets: sortRecords(pointCloudAssets),
    derivedAssets: sortRecords(derivedAssets),
    modelDefinitions: sortRecords(modelDefinitions),
    modelRuns: sortRecords(modelRuns),
    embeddingIndexes: sortRecords(embeddingIndexes),
    candidates: sortRecords(candidates),
    reviewQueues: sortRecords(reviewQueues),
    reviewQueueSnapshots: sortRecords(reviewQueueSnapshots),
    reviewDecisions: sortRecords(reviewDecisions),
    fieldTasks: sortRecords(fieldTasks),
    fieldResults: sortRecords(fieldResults),
    hardNegatives: sortRecords(hardNegatives),
    knownDecoys: sortRecords(knownDecoys),
    sensorDomainGaps: sortRecords(sensorDomainGaps),
    visualFindings: sortRecords(visualFindings),
    provenanceEdges: sortRecords(provenanceEdges),
    auditHistory: [...auditHistory],
    safety: visualEvidenceSafetyBoundary,
  };
  const snapshot: CanopyProofVisualEvidenceAuthoritySnapshot = {
    ...content,
    snapshotRoot: hashJson({
      kind: "canopyproof-visual-authority-snapshot-v1",
      recordRoots: allSnapshotRecords(content).map((record) => record.factRoot),
      auditRoots: content.auditHistory.map((event) => event.eventRoot),
      safety: content.safety,
    }),
  };
  const verification = verifyVisualEvidenceAuthoritySnapshot(snapshot);
  if (!verification.valid) {
    throw new VisualEvidenceError(
      "VISUAL_IMMUTABILITY_VIOLATION",
      `durable visual authority replay failed: ${verification.issues.join(", ")}`,
    );
  }
  return snapshot;
}

export function visualEvidenceAuthorityStatus() {
  return {
    service: "canopyproof-visual-evidence-intelligence",
    status: "non-production-foundation" as const,
    rfc: "docs/RFC_VISUAL_EVIDENCE_INTELLIGENCE.md",
    fiftyOneAuthority: false as const,
    modelCandidatesAreEvidence: false as const,
    durableTrustRegistryAdapterImplemented: true as const,
    durableProductionPersistenceRequired: true as const,
    nativePostgresApprovalComplete: false as const,
    externallyReachableRoutesEnabled: false as const,
    terraProofSpatialGateRequired: true as const,
    deploymentAuthorized: false as const,
    safety: visualEvidenceSafetyBoundary,
  };
}

export function visualEvidenceAuditGenesisRoot() {
  return canopyProofAuditGenesisRoot();
}

const visualFactKindByAuditEntity: Partial<Record<CanopyProofAuditEntityType, string>> = {
  visual_acquisition_mission: "visual-acquisition-mission",
  visual_sensor_stream: "visual-sensor-stream",
  visual_dataset: "visual-dataset",
  visual_dataset_snapshot: "visual-dataset-snapshot",
  visual_media_asset: "visual-media-asset",
  visual_point_cloud_asset: "visual-point-cloud-asset",
  visual_derived_asset: "visual-derived-asset",
  visual_model_definition: "visual-model-definition",
  visual_model_run: "visual-model-run",
  visual_embedding_index: "visual-embedding-index",
  visual_candidate: "visual-candidate",
  visual_review_queue: "visual-review-queue",
  visual_review_queue_snapshot: "visual-review-queue-snapshot",
  visual_review_decision: "visual-review-decision",
  visual_field_verification_task: "visual-field-task",
  visual_field_verification_result: "visual-field-result",
  visual_hard_negative: "visual-hard-negative",
  visual_known_decoy: "visual-known-decoy",
  visual_sensor_domain_gap: "visual-sensor-domain-gap",
  visual_finding: "visual-finding",
  visual_provenance_edge: "visual-provenance-edge",
};

const visualAuditBindingByRecordType: Readonly<
  Record<string, Readonly<{ entityType: CanopyProofAuditEntityType; factKind: string }>>
> = {
  acquisition_mission: { entityType: "visual_acquisition_mission", factKind: "visual-acquisition-mission" },
  sensor_stream: { entityType: "visual_sensor_stream", factKind: "visual-sensor-stream" },
  multimodal_dataset: { entityType: "visual_dataset", factKind: "visual-dataset" },
  dataset_snapshot: { entityType: "visual_dataset_snapshot", factKind: "visual-dataset-snapshot" },
  media_asset: { entityType: "visual_media_asset", factKind: "visual-media-asset" },
  point_cloud_asset: { entityType: "visual_point_cloud_asset", factKind: "visual-point-cloud-asset" },
  derived_visual_asset: { entityType: "visual_derived_asset", factKind: "visual-derived-asset" },
  model_definition: { entityType: "visual_model_definition", factKind: "visual-model-definition" },
  model_run: { entityType: "visual_model_run", factKind: "visual-model-run" },
  embedding_index: { entityType: "visual_embedding_index", factKind: "visual-embedding-index" },
  candidate_finding: { entityType: "visual_candidate", factKind: "visual-candidate" },
  review_queue: { entityType: "visual_review_queue", factKind: "visual-review-queue" },
  review_queue_snapshot: {
    entityType: "visual_review_queue_snapshot",
    factKind: "visual-review-queue-snapshot",
  },
  review_decision: { entityType: "visual_review_decision", factKind: "visual-review-decision" },
  field_verification_task: {
    entityType: "visual_field_verification_task",
    factKind: "visual-field-task",
  },
  field_verification_result: {
    entityType: "visual_field_verification_result",
    factKind: "visual-field-result",
  },
  hard_negative: { entityType: "visual_hard_negative", factKind: "visual-hard-negative" },
  known_decoy: { entityType: "visual_known_decoy", factKind: "visual-known-decoy" },
  sensor_domain_gap: { entityType: "visual_sensor_domain_gap", factKind: "visual-sensor-domain-gap" },
  visual_finding: { entityType: "visual_finding", factKind: "visual-finding" },
  visual_provenance_edge: { entityType: "visual_provenance_edge", factKind: "visual-provenance-edge" },
};

export type VisualEvidenceAuthorityVerification = {
  readonly valid: boolean;
  readonly recordCount: number;
  readonly auditEventCount: number;
  readonly issues: readonly string[];
  readonly recomputedSnapshotRoot: string;
};

const visualServiceCapabilityByRecordType: Readonly<
  Partial<Record<string, VisualServiceActor["capability"]>>
> = {
  acquisition_mission: "visual_dataset_registration",
  sensor_stream: "visual_dataset_registration",
  multimodal_dataset: "visual_dataset_registration",
  dataset_snapshot: "visual_dataset_registration",
  media_asset: "visual_dataset_registration",
  point_cloud_asset: "visual_dataset_registration",
  derived_visual_asset: "visual_dataset_registration",
  model_definition: "visual_model_execution",
  model_run: "visual_model_execution",
  embedding_index: "visual_model_execution",
  sensor_domain_gap: "visual_model_execution",
  candidate_finding: "visual_candidate_import",
  review_queue: "visual_manifest_issuance",
  review_queue_snapshot: "visual_manifest_issuance",
  field_verification_task: "visual_field_task_assignment",
};

function validateVisualRecordSafety(
  record: VisualRecordEnvelope,
  recordType: string,
  issues: string[],
) {
  if (
    record.createdBy !== record.actorSnapshot.id ||
    record.createdByActorType !== record.actorSnapshot.actorType ||
    record.actorAuthorityRoot !== record.actorSnapshot.authorityRoot ||
    record.tenantId !== record.actorSnapshot.tenantId ||
    record.organizationId !== record.actorSnapshot.organizationId
  ) {
    issues.push(`invalid_actor_binding:${record.id}`);
  }
  try {
    verifyActor(record.actorSnapshot);
  } catch {
    issues.push(`invalid_actor_authority:${record.id}`);
  }
  const requiredCapability = visualServiceCapabilityByRecordType[recordType];
  if (requiredCapability) {
    try {
      assertServiceCapability(record.actorSnapshot as VisualServiceActor, requiredCapability);
    } catch {
      issues.push(`invalid_service_actor_capability:${record.id}`);
    }
  }
  if (
    [
      "review_decision",
      "field_verification_result",
      "hard_negative",
      "known_decoy",
      "visual_finding",
    ].includes(recordType)
  ) {
    try {
      assertHumanReviewer(record.actorSnapshot as VisualHumanReviewer);
    } catch {
      issues.push(`invalid_human_reviewer_authority:${record.id}`);
    }
  }
  if (recordType === "candidate_finding") {
    const candidate = record as CandidateFinding;
    if (candidate.status !== "CANDIDATE" || !candidate.advisoryOnly || candidate.evidenceAuthority !== "NONE") {
      issues.push(`invalid_candidate_boundary:${record.id}`);
    }
  } else if (recordType === "model_definition") {
    const model = record as ModelDefinition;
    if (
      !model.advisoryOnly ||
      hashJson(model.prohibitedUses) !==
        hashJson(["VERIFY_EVIDENCE", "ISSUE_CERTIFICATE", "PUBLISH_ESG_METRIC", "RELEASE_FUNDING"])
    ) {
      issues.push(`invalid_model_boundary:${record.id}`);
    }
  } else if (recordType === "point_cloud_asset") {
    try {
      validatePointCloudAssetContract(record as PointCloudAsset);
    } catch {
      issues.push(`invalid_point_cloud_contract:${record.id}`);
    }
  } else if (recordType === "derived_visual_asset") {
    if ((record as DerivedVisualAsset).authoritative !== false) {
      issues.push(`invalid_derived_asset_boundary:${record.id}`);
    }
  } else if (recordType === "embedding_index") {
    if ((record as EmbeddingIndex).authoritative !== false) {
      issues.push(`invalid_embedding_boundary:${record.id}`);
    }
  } else if (recordType === "field_verification_result") {
    if (!/^[a-f0-9]{64}$/.test((record as FieldVerificationResult).deviceAttestationRoot)) {
      issues.push(`invalid_field_device_binding:${record.id}`);
    }
  } else if (recordType === "visual_finding") {
    const finding = record as VisualFinding;
    if (
      !finding.boundedObservation ||
      finding.evidenceVerificationState !== "NOT_EVIDENCE" ||
      !finding.governanceApprovalRequired
    ) {
      issues.push(`invalid_visual_finding_boundary:${record.id}`);
    }
  }
}

function validateVisualSnapshotReferences(
  snapshot: CanopyProofVisualEvidenceAuthoritySnapshot,
  issues: string[],
) {
  const makeMap = <T extends VisualRecordEnvelope>(records: readonly T[], label: string) => {
    const result = new Map<string, T>();
    for (const record of records) {
      if (result.has(record.id)) issues.push(`duplicate_${label}_id:${record.id}`);
      result.set(record.id, record);
    }
    return result;
  };
  const sameScope = (left: VisualRecordEnvelope, right: VisualRecordEnvelope) =>
    left.tenantId === right.tenantId &&
    left.organizationId === right.organizationId &&
    left.projectId === right.projectId;
  const requireScoped = <T extends VisualRecordEnvelope>(
    owner: VisualRecordEnvelope,
    target: T | undefined,
    relation: string,
  ) => {
    if (!target) {
      issues.push(`missing_${relation}:${owner.id}`);
      return undefined;
    }
    if (!sameScope(owner, target)) issues.push(`cross_scope_${relation}:${owner.id}`);
    return target;
  };

  const missions = makeMap(snapshot.acquisitionMissions, "acquisition_mission");
  const streams = makeMap(snapshot.sensorStreams, "sensor_stream");
  makeMap(snapshot.datasets, "dataset");
  const datasetSnapshots = makeMap(snapshot.datasetSnapshots, "dataset_snapshot");
  makeMap(snapshot.mediaAssets, "media_asset");
  const models = makeMap(snapshot.modelDefinitions, "model_definition");
  const runs = makeMap(snapshot.modelRuns, "model_run");
  makeMap(snapshot.embeddingIndexes, "embedding_index");
  const candidates = makeMap(snapshot.candidates, "candidate");
  const queueSnapshots = makeMap(snapshot.reviewQueueSnapshots, "review_queue_snapshot");
  const decisions = makeMap(snapshot.reviewDecisions, "review_decision");
  const fieldTasks = makeMap(snapshot.fieldTasks, "field_task");
  const fieldResults = makeMap(snapshot.fieldResults, "field_result");
  makeMap(snapshot.hardNegatives, "hard_negative");
  const gaps = makeMap(snapshot.sensorDomainGaps, "sensor_domain_gap");
  makeMap(snapshot.visualFindings, "visual_finding");

  const queueVersions = new Map<string, ReviewQueue>();
  for (const queue of snapshot.reviewQueues) {
    const key = `${queue.id}:${queue.version}`;
    if (queueVersions.has(key)) issues.push(`duplicate_review_queue_version:${key}`);
    queueVersions.set(key, queue);
  }

  for (const stream of snapshot.sensorStreams) {
    requireScoped(stream, missions.get(stream.acquisitionMissionId), "sensor_mission");
  }
  for (const dataset of snapshot.datasets) {
    const current = requireScoped(dataset, datasetSnapshots.get(dataset.currentSnapshotId), "dataset_snapshot");
    if (current && current.datasetId !== dataset.id) issues.push(`invalid_dataset_snapshot_owner:${dataset.id}`);
    for (const streamId of dataset.sensorStreamIds) {
      requireScoped(dataset, streams.get(streamId), "dataset_sensor_stream");
    }
  }
  for (const datasetSnapshot of snapshot.datasetSnapshots) {
    for (const member of datasetSnapshot.members) {
      requireScoped(datasetSnapshot, streams.get(member.sensorStreamId), "snapshot_sensor_stream");
    }
  }
  for (const media of snapshot.mediaAssets) {
    requireScoped(media, streams.get(media.sensorStreamId), "media_sensor_stream");
  }
  for (const run of snapshot.modelRuns) {
    requireScoped(run, models.get(run.modelDefinitionId), "run_model");
    requireScoped(run, datasetSnapshots.get(run.datasetSnapshotId), "run_dataset_snapshot");
    if (run.sensorDomainGapId) requireScoped(run, gaps.get(run.sensorDomainGapId), "run_sensor_domain_gap");
  }
  for (const embedding of snapshot.embeddingIndexes) {
    requireScoped(embedding, datasetSnapshots.get(embedding.datasetSnapshotId), "embedding_dataset_snapshot");
    requireScoped(embedding, runs.get(embedding.modelRunId), "embedding_model_run");
  }
  for (const candidate of snapshot.candidates) {
    const run = requireScoped(candidate, runs.get(candidate.modelRunId), "candidate_model_run");
    const datasetSnapshot = requireScoped(
      candidate,
      datasetSnapshots.get(candidate.datasetSnapshotId),
      "candidate_dataset_snapshot",
    );
    if (run && run.datasetSnapshotId !== candidate.datasetSnapshotId) {
      issues.push(`candidate_run_snapshot_mismatch:${candidate.id}`);
    }
    if (datasetSnapshot && !datasetSnapshot.members.some((member) => member.sampleId === candidate.sampleId)) {
      issues.push(`candidate_sample_not_frozen:${candidate.id}`);
    }
  }
  for (const queue of snapshot.reviewQueues) {
    const current = requireScoped(queue, queueSnapshots.get(queue.currentSnapshotId), "queue_snapshot");
    if (
      current &&
      (current.reviewQueueId !== queue.id || current.version !== queue.version)
    ) {
      issues.push(`invalid_queue_snapshot_version:${queue.id}:${queue.version}`);
    }
  }
  for (const queueSnapshot of snapshot.reviewQueueSnapshots) {
    requireScoped(
      queueSnapshot,
      queueVersions.get(`${queueSnapshot.reviewQueueId}:${queueSnapshot.version}`),
      "queue_version",
    );
    requireScoped(
      queueSnapshot,
      datasetSnapshots.get(queueSnapshot.datasetSnapshotId),
      "queue_dataset_snapshot",
    );
    if (queueSnapshot.priorQueueSnapshotId) {
      const prior = requireScoped(
        queueSnapshot,
        queueSnapshots.get(queueSnapshot.priorQueueSnapshotId),
        "prior_queue_snapshot",
      );
      if (
        prior &&
        (prior.reviewQueueId !== queueSnapshot.reviewQueueId || prior.version + 1 !== queueSnapshot.version)
      ) {
        issues.push(`invalid_prior_queue_version:${queueSnapshot.id}`);
      }
    } else if (queueSnapshot.version !== 1) {
      issues.push(`missing_prior_queue_snapshot:${queueSnapshot.id}`);
    }
    for (const candidateId of queueSnapshot.candidateIds) {
      const candidate = requireScoped(queueSnapshot, candidates.get(candidateId), "queue_candidate");
      if (
        candidate &&
        (candidate.datasetSnapshotId !== queueSnapshot.datasetSnapshotId ||
          !queueSnapshot.sampleIds.includes(candidate.sampleId) ||
          !queueSnapshot.modelRunIds.includes(candidate.modelRunId))
      ) {
        issues.push(`invalid_queue_candidate_membership:${queueSnapshot.id}:${candidate.id}`);
      }
    }
  }
  for (const decision of snapshot.reviewDecisions) {
    const candidate = requireScoped(decision, candidates.get(decision.candidateId), "decision_candidate");
    const queueSnapshot = requireScoped(
      decision,
      queueSnapshots.get(decision.reviewQueueSnapshotId),
      "decision_queue_snapshot",
    );
    if (queueSnapshot && !queueSnapshot.candidateIds.includes(decision.candidateId)) {
      issues.push(`decision_candidate_not_queued:${decision.id}`);
    }
    if (candidate && decision.createdBy !== decision.reviewerId) {
      issues.push(`decision_reviewer_binding_invalid:${decision.id}`);
    }
    if (decision.supersedesDecisionId) {
      const prior = requireScoped(
        decision,
        decisions.get(decision.supersedesDecisionId),
        "superseded_decision",
      );
      if (prior && prior.candidateId !== decision.candidateId) {
        issues.push(`superseded_decision_candidate_mismatch:${decision.id}`);
      }
    }
  }
  for (const task of snapshot.fieldTasks) {
    requireScoped(task, candidates.get(task.candidateId), "field_task_candidate");
  }
  const fieldResultByTask = new Set<string>();
  for (const result of snapshot.fieldResults) {
    const task = requireScoped(result, fieldTasks.get(result.fieldTaskId), "field_result_task");
    if (fieldResultByTask.has(result.fieldTaskId)) issues.push(`duplicate_field_result:${result.fieldTaskId}`);
    fieldResultByTask.add(result.fieldTaskId);
    if (task && (task.assignedReviewerId !== result.reviewerId || result.createdBy !== result.reviewerId)) {
      issues.push(`field_result_reviewer_binding_invalid:${result.id}`);
    }
  }
  for (const hardNegative of snapshot.hardNegatives) {
    const candidate = requireScoped(
      hardNegative,
      candidates.get(hardNegative.candidateId),
      "hard_negative_candidate",
    );
    const decision = requireScoped(
      hardNegative,
      decisions.get(hardNegative.reviewDecisionId),
      "hard_negative_decision",
    );
    if (
      candidate &&
      decision &&
      (decision.candidateId !== candidate.id || decision.decision !== "REJECT_FALSE_POSITIVE")
    ) {
      issues.push(`invalid_hard_negative_source:${hardNegative.id}`);
    }
  }
  for (const gap of snapshot.sensorDomainGaps) {
    requireScoped(gap, models.get(gap.modelDefinitionId), "sensor_gap_model");
  }
  for (const finding of snapshot.visualFindings) {
    requireScoped(finding, candidates.get(finding.candidateId), "finding_candidate");
    for (const decisionId of finding.reviewDecisionIds) {
      const decision = requireScoped(finding, decisions.get(decisionId), "finding_decision");
      if (decision && decision.candidateId !== finding.candidateId) {
        issues.push(`finding_decision_candidate_mismatch:${finding.id}:${decision.id}`);
      }
    }
    if (finding.fieldVerificationResultId) {
      requireScoped(
        finding,
        fieldResults.get(finding.fieldVerificationResultId),
        "finding_field_result",
      );
    }
  }

  const recordByRoot = new Map(allSnapshotRecords(snapshot).map((record) => [record.factRoot, record]));
  for (const edge of snapshot.provenanceEdges) {
    const source = recordByRoot.get(edge.sourceRoot);
    const target = recordByRoot.get(edge.targetRoot);
    if (!source || source.id !== edge.sourceId) issues.push(`invalid_provenance_source:${edge.id}`);
    if (!target || target.id !== edge.targetId) issues.push(`invalid_provenance_target:${edge.id}`);
    if (source && !sameScope(edge, source)) issues.push(`cross_scope_provenance_source:${edge.id}`);
    if (target && !sameScope(edge, target)) issues.push(`cross_scope_provenance_target:${edge.id}`);
  }
}

export function verifyVisualEvidenceAuthoritySnapshot(
  snapshot: CanopyProofVisualEvidenceAuthoritySnapshot,
): VisualEvidenceAuthorityVerification {
  const issues: string[] = [];
  if (snapshot.schemaVersion !== "canopyproof.visual-authority-snapshot.v1") {
    issues.push("unsupported_schema_version");
  }
  if (hashJson(snapshot.safety) !== hashJson(visualEvidenceSafetyBoundary)) {
    issues.push("invalid_safety_boundary");
  }
  const records = allSnapshotRecords(snapshot);
  const seenFactRoots = new Set<string>();
  const recordByAuditId = new Map<string, VisualRecordEnvelope>();
  const auditById = new Map<string, CanopyProofAuditEvent>();
  for (const event of snapshot.auditHistory) {
    if (auditById.has(event.id)) issues.push(`duplicate_audit_event:${event.id}`);
    auditById.set(event.id, event);
  }
  for (const record of records) {
    if (seenFactRoots.has(record.factRoot)) issues.push(`duplicate_fact_root:${record.factRoot}`);
    seenFactRoots.add(record.factRoot);
    if (recordByAuditId.has(record.auditEvent.id)) issues.push(`duplicate_audit_binding:${record.auditEvent.id}`);
    recordByAuditId.set(record.auditEvent.id, record);
    const recordType = (record as VisualRecordEnvelope & { readonly recordType?: unknown }).recordType;
    if (typeof recordType !== "string") {
      issues.push(`unsupported_record_entity:${record.id}`);
      continue;
    }
    const binding = visualAuditBindingByRecordType[recordType];
    if (!binding) {
      issues.push(`unsupported_record_entity:${record.id}`);
      continue;
    }
    const canonicalAuditEvent = auditById.get(record.auditEvent.id);
    if (!canonicalAuditEvent || hashJson(canonicalAuditEvent) !== hashJson(record.auditEvent)) {
      issues.push(`invalid_embedded_audit_event:${record.id}`);
    }
    if (
      record.auditEvent.action !== "ASSERT" ||
      record.auditEvent.actor !== record.createdBy ||
      record.auditEvent.entityType !== binding.entityType ||
      record.auditEvent.entityId !== record.id ||
      record.auditEvent.createdAt !== record.createdAt
    ) {
      issues.push(`invalid_audit_binding:${record.id}`);
    }
    const reverseFactKind = visualFactKindByAuditEntity[record.auditEvent.entityType];
    if (reverseFactKind !== binding.factKind) issues.push(`invalid_record_entity:${record.id}`);
    const canonicalSourceRoots = canonicalStrings(record.sourceRoots, "snapshot source roots", true);
    if (hashJson(canonicalSourceRoots) !== hashJson(record.sourceRoots)) {
      issues.push(`noncanonical_source_roots:${record.id}`);
    }
    if (!Number.isSafeInteger(record.version) || record.version <= 0) {
      issues.push(`invalid_record_version:${record.id}`);
    }
    const factSeed: Record<string, unknown> = { ...record };
    delete factSeed.factHash;
    delete factSeed.factRoot;
    delete factSeed.auditEvent;
    delete factSeed.safety;
    const expectedFactHash = hashJson({ kind: `canopyproof-${binding.factKind}-fact-v1`, ...factSeed });
    if (record.factHash !== expectedFactHash) issues.push(`invalid_fact_hash:${record.id}`);
    const expectedFactRoot = hashJson({
      kind: `canopyproof-${binding.factKind}-root-v1`,
      factHash: record.factHash,
      sourceRoots: record.sourceRoots,
      auditEventRoot: record.auditEvent.eventRoot,
    });
    if (record.factRoot !== expectedFactRoot) issues.push(`invalid_fact_root:${record.id}`);
    if (hashJson(record.safety) !== hashJson(visualEvidenceSafetyBoundary)) {
      issues.push(`invalid_record_safety:${record.id}`);
    }
    validateVisualRecordSafety(record, recordType, issues);
  }

  if (records.length !== snapshot.auditHistory.length) issues.push("record_audit_count_mismatch");
  validateVisualSnapshotReferences(snapshot, issues);

  const auditEntries = snapshot.auditHistory.map((event) => {
    const record = recordByAuditId.get(event.id);
    if (!record) issues.push(`audit_event_without_record:${event.id}`);
    return {
      event,
      payload: record
        ? {
            factHash: record.factHash,
            sourceRoots: record.sourceRoots,
            recordType: visualFactKindByAuditEntity[event.entityType],
          }
        : undefined,
    };
  });
  for (const record of records) {
    if (!snapshot.auditHistory.some((event) => event.id === record.auditEvent.id)) {
      issues.push(`record_without_audit_event:${record.id}`);
    }
  }
  const auditVerification = verifyCanopyProofAuditChain(
    auditEntries,
    snapshot.auditHistory.at(-1)?.createdAt ?? new Date(0).toISOString(),
  );
  for (const issue of auditVerification.issues) issues.push(`audit:${issue.code}:${issue.eventId ?? issue.index ?? ""}`);

  for (const queue of snapshot.reviewQueueSnapshots) {
    const expectedQueueHash = hashJson({
      kind: "canopyproof-visual-review-queue-snapshot-v1",
      reviewQueueId: queue.reviewQueueId,
      datasetSnapshotId: queue.datasetSnapshotId,
      datasetManifestHash: queue.datasetManifestHash,
      sampleIds: queue.sampleIds,
      candidateIds: queue.candidateIds,
      filterExpression: queue.filterExpression,
      sortExpression: queue.sortExpression,
      modelRunIds: queue.modelRunIds,
      randomQaSeed: queue.randomQaSeed ?? null,
    });
    if (queue.reviewQueueHash !== expectedQueueHash) issues.push(`invalid_review_queue_hash:${queue.id}`);
  }

  const recomputedSnapshotRoot = hashJson({
    kind: "canopyproof-visual-authority-snapshot-v1",
    recordRoots: records.map((record) => record.factRoot),
    auditRoots: snapshot.auditHistory.map((event) => event.eventRoot),
    safety: snapshot.safety,
  });
  if (snapshot.snapshotRoot !== recomputedSnapshotRoot) issues.push("invalid_snapshot_root");
  return {
    valid: issues.length === 0,
    recordCount: records.length,
    auditEventCount: snapshot.auditHistory.length,
    issues,
    recomputedSnapshotRoot,
  };
}
