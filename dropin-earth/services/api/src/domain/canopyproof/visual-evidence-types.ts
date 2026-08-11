import type { CanopyProofAuditEvent } from "./proof-engine.js";

export const visualClassifications = ["PUBLIC", "INTERNAL", "RESTRICTED", "HIGHLY_RESTRICTED"] as const;
export const visualAssetRoles = [
  "RAW_AUTHORITATIVE",
  "NORMALIZED_AUTHORITATIVE",
  "REVIEW_DERIVATIVE",
] as const;
export const visualPointCloudFormats = ["LAZ", "COPC", "PCD"] as const;
export const visualSensorModalities = [
  "RGB",
  "THERMAL",
  "MULTISPECTRAL",
  "HYPERSPECTRAL",
  "LIDAR",
  "VIDEO",
] as const;
export const visualCoordinateFrameTypes = [
  "ABSOLUTE_CRS",
  "LOCAL_REGISTERED",
  "LOCAL_UNREGISTERED",
  "UNKNOWN_FRAME",
] as const;
export const visualCandidateStatuses = [
  "CANDIDATE",
  "UNDER_REVIEW",
  "HUMAN_ACCEPTED",
  "HUMAN_REJECTED",
  "FIELD_CHECK_REQUIRED",
  "CHALLENGED",
  "SUPERSEDED",
] as const;
export const visualReviewDecisions = [
  "ACCEPT_FOR_BOUNDED_FINDING",
  "REJECT_FALSE_POSITIVE",
  "REQUEST_SECOND_REVIEW",
  "REQUEST_FIELD_CHECK",
  "INCONCLUSIVE",
  "CHALLENGE",
] as const;
export const visualFieldVerificationResults = [
  "CONFIRMED",
  "REJECTED_FALSE_POSITIVE",
  "NOT_FOUND",
  "INACCESSIBLE",
  "INCONCLUSIVE",
] as const;
export const visualKnownDecoyTypes = [
  "FALSE_POSITIVE",
  "KNOWN_DECOY",
  "SHADOW",
  "VEGETATION_CONFUSER",
  "ROCK_CONFUSER",
  "CLOUD_CONFUSER",
  "THERMAL_ARTIFACT",
  "SENSOR_NOISE",
  "SEASONAL_CONFOUNDER",
] as const;
export const visualFindingStatuses = [
  "PROPOSED",
  "HUMAN_REVIEWED",
  "FIELD_CHECKED",
  "CHALLENGED",
  "SUPERSEDED",
  "WITHDRAWN",
] as const;
export const visualActorTypes = ["human", "agent", "device", "service"] as const;
export const visualReviewerRoles = ["verifier", "auditor", "researcher", "government", "un_partner"] as const;
export const visualQualityStates = ["PASS", "WARN", "FAIL", "UNKNOWN", "NOT_APPLICABLE"] as const;

export type VisualClassification = (typeof visualClassifications)[number];
export type VisualAssetRole = (typeof visualAssetRoles)[number];
export type VisualPointCloudFormat = (typeof visualPointCloudFormats)[number];
export type VisualSensorModality = (typeof visualSensorModalities)[number];
export type VisualCoordinateFrameType = (typeof visualCoordinateFrameTypes)[number];
export type VisualCandidateStatus = (typeof visualCandidateStatuses)[number];
export type VisualReviewDecisionKind = (typeof visualReviewDecisions)[number];
export type VisualFieldVerificationResultKind = (typeof visualFieldVerificationResults)[number];
export type VisualKnownDecoyType = (typeof visualKnownDecoyTypes)[number];
export type VisualFindingStatus = (typeof visualFindingStatuses)[number];
export type VisualActorType = (typeof visualActorTypes)[number];
export type VisualReviewerRole = (typeof visualReviewerRoles)[number];
export type VisualQualityState = (typeof visualQualityStates)[number];

export type VisualSafetyBoundary = {
  readonly appendOnly: true;
  readonly tenantBound: true;
  readonly licenseBound: true;
  readonly sensorDomainBound: true;
  readonly humanReviewRequired: true;
  readonly governanceStillRequiredForProof: true;
  readonly fiftyOneNotAuthority: true;
  readonly modelCandidateNotEvidence: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type VisualRecordEnvelope = {
  readonly id: string;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly projectId?: string;
  readonly classification: VisualClassification;
  readonly licensePolicyId: string;
  readonly createdBy: string;
  readonly createdByActorType: VisualActorType;
  readonly actorAuthorityRoot: string;
  readonly actorSnapshot: VisualAuthorityActor;
  readonly createdAt: string;
  readonly sourceRoots: readonly string[];
  readonly factHash: string;
  readonly factRoot: string;
  readonly auditEvent: CanopyProofAuditEvent;
  readonly version: number;
  readonly safety: VisualSafetyBoundary;
};

export type VisualAuthorityActor = {
  readonly id: string;
  readonly actorType: VisualActorType;
  readonly tenantId: string;
  readonly organizationId: string;
  readonly role: string;
  readonly verificationStatus: "verified";
  readonly authorityRoot: string;
};

export type VisualHumanReviewer = VisualAuthorityActor & {
  readonly actorType: "human";
  readonly role: VisualReviewerRole;
  readonly accreditationId: string;
  readonly accreditationRoot: string;
  readonly conflictFree: boolean;
};

export type VisualServiceActor = VisualAuthorityActor & {
  readonly actorType: "agent" | "service";
  readonly capability:
    | "visual_dataset_registration"
    | "visual_model_execution"
    | "visual_candidate_import"
    | "visual_manifest_issuance"
    | "visual_field_task_assignment";
};

export type AcquisitionMission = VisualRecordEnvelope & {
  readonly recordType: "acquisition_mission";
  readonly missionName: string;
  readonly platformType: string;
  readonly purpose: string;
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly geometryRef: string;
  readonly permitRoots: readonly string[];
  readonly sensorStreamIds: readonly string[];
};

export type SensorDomain = {
  readonly sensor: VisualSensorModality;
  readonly resolution: number;
  readonly resolutionUnit: "meters_per_pixel" | "centimeters_per_pixel" | "points_per_square_meter";
  readonly altitudeMeters?: number;
  readonly season: string;
  readonly ecosystem: string;
  readonly geography: string;
  readonly calibrationState: "calibrated" | "uncalibrated" | "unknown";
};

export type SensorStream = VisualRecordEnvelope & {
  readonly recordType: "sensor_stream";
  readonly acquisitionMissionId: string;
  readonly modality: VisualSensorModality;
  readonly make: string;
  readonly model: string;
  readonly serialCommitment: string;
  readonly nativeResolution: number;
  readonly resolutionUnit: SensorDomain["resolutionUnit"];
  readonly altitudeRangeMeters?: readonly [number, number];
  readonly calibrationRecordId?: string;
  readonly calibrationState: SensorDomain["calibrationState"];
  readonly clockQuality: "verified" | "bounded" | "unknown";
  readonly coordinateFrame: VisualCoordinateFrameType;
  readonly knownLimitations: readonly string[];
};

export type MultimodalDataset = VisualRecordEnvelope & {
  readonly recordType: "multimodal_dataset";
  readonly name: string;
  readonly purpose: "LAB_BENCHMARK" | "INTERNAL_REVIEW" | "PRODUCTION_EVIDENCE_INPUT";
  readonly sensorStreamIds: readonly string[];
  readonly currentSnapshotId: string;
  readonly pairingPolicyVersion: string;
};

export type DatasetSnapshotMember = {
  readonly sampleId: string;
  readonly assetId: string;
  readonly assetVersion: number;
  readonly assetRoot: string;
  readonly contentHash: string;
  readonly sensorStreamId: string;
  readonly pairedSampleIds: readonly string[];
  readonly licensePolicyId: string;
};

export type DatasetSnapshot = VisualRecordEnvelope & {
  readonly recordType: "dataset_snapshot";
  readonly datasetId: string;
  readonly datasetManifestHash: string;
  readonly members: readonly DatasetSnapshotMember[];
  readonly pairingEdgeRoots: readonly string[];
  readonly schemaVersion: "canopyproof.visual-dataset-snapshot.v1";
};

export type MediaAsset = VisualRecordEnvelope & {
  readonly recordType: "media_asset";
  readonly terraProofAssetId: string;
  readonly objectVersion: string;
  readonly contentHash: string;
  readonly contentType: string;
  readonly byteLength: number;
  readonly width?: number;
  readonly height?: number;
  readonly durationMs?: number;
  readonly sensorStreamId: string;
  readonly capturedAt: string;
  readonly locationPolicy: "PRECISE_RESTRICTED" | "GENERALIZED" | "WITHHELD";
  readonly validationState: "QUARANTINED" | "AVAILABLE" | "REJECTED";
};

export type RegistrationRecord = {
  readonly id: string;
  readonly sourceAssetRoot: string;
  readonly targetFrameRoot: string;
  readonly transformMatrix: readonly number[];
  readonly method: string;
  readonly horizontalResidualMeters: number;
  readonly verticalResidualMeters: number;
  readonly overlapRatio: number;
  readonly uncertaintyRoot: string;
  readonly reviewedBy: string;
  readonly reviewedAt: string;
  readonly registrationRoot: string;
};

export type PointCloudAsset = VisualRecordEnvelope & {
  readonly recordType: "point_cloud_asset";
  readonly terraProofAssetId: string;
  readonly format: VisualPointCloudFormat;
  readonly assetRole: VisualAssetRole;
  readonly objectVersion: string;
  readonly contentHash: string;
  readonly byteLength: number;
  readonly pointCount: number;
  readonly dimensions: readonly string[];
  readonly crs?: string;
  readonly crsWkt?: string;
  readonly verticalDatum?: string;
  readonly horizontalUnit: string;
  readonly verticalUnit: string;
  readonly coordinateFrame: VisualCoordinateFrameType;
  readonly bounds: readonly [number, number, number, number, number, number];
  readonly scale: readonly [number, number, number];
  readonly offset: readonly [number, number, number];
  readonly registration?: RegistrationRecord;
  readonly sourcePointCloudRoots: readonly string[];
  readonly qualityAssessmentRoot: string;
  readonly uncertaintyRoot: string;
};

export type DerivedVisualAsset = VisualRecordEnvelope & {
  readonly recordType: "derived_visual_asset";
  readonly derivedType:
    | "ORTHOGRAPHIC_PREVIEW"
    | "POINT_CLOUD_PREVIEW"
    | "DTM"
    | "DSM"
    | "CHM"
    | "DENSITY"
    | "CONTINUITY"
    | "PMTILES"
    | "THREE_D_TILES"
    | "CROP"
    | "HEATMAP";
  readonly processingRecipeId: string;
  readonly processingRunId: string;
  readonly objectVersion: string;
  readonly contentHash: string;
  readonly byteLength: number;
  readonly sourceAssetRoots: readonly string[];
  readonly qualityAssessmentRoot: string;
  readonly uncertaintyRoot: string;
  readonly authoritative: false;
};

export type ModelDomainPolicy = {
  readonly supportedSensors: readonly VisualSensorModality[];
  readonly supportedResolutionRange: readonly [number, number];
  readonly supportedResolutionUnit: SensorDomain["resolutionUnit"];
  readonly supportedAltitudeRange?: readonly [number, number];
  readonly supportedSeasons: readonly string[];
  readonly supportedEcosystems: readonly string[];
  readonly supportedGeographies: readonly string[];
  readonly requiresCalibration: boolean;
  readonly knownLimitations: readonly string[];
  readonly calibrationDatasetRefs: readonly string[];
};

export type ModelDefinition = VisualRecordEnvelope & {
  readonly recordType: "model_definition";
  readonly name: string;
  readonly modelFamily: string;
  readonly artifactHash: string;
  readonly containerDigest: string;
  readonly sbomHash: string;
  readonly preprocessingContractHash: string;
  readonly outputSchemaVersion: string;
  readonly domainPolicy: ModelDomainPolicy;
  readonly advisoryOnly: true;
  readonly prohibitedUses: readonly [
    "VERIFY_EVIDENCE",
    "ISSUE_CERTIFICATE",
    "PUBLISH_ESG_METRIC",
    "RELEASE_FUNDING",
  ];
};

export type SensorDomainGapDimension =
  | "SENSOR"
  | "RESOLUTION"
  | "ALTITUDE"
  | "SEASON"
  | "ECOSYSTEM"
  | "GEOGRAPHY"
  | "CALIBRATION";

export type SensorDomainGap = VisualRecordEnvelope & {
  readonly recordType: "sensor_domain_gap";
  readonly modelDefinitionId: string;
  readonly sourceDomain: SensorDomain;
  readonly gapDimensions: readonly SensorDomainGapDimension[];
  readonly disposition: "BLOCKED" | "APPROVED_EXCEPTION";
  readonly approvalId?: string;
  readonly expiresAt?: string;
};

export type ModelRun = VisualRecordEnvelope & {
  readonly recordType: "model_run";
  readonly modelDefinitionId: string;
  readonly datasetSnapshotId: string;
  readonly canonicalParametersHash: string;
  readonly deterministicSeed?: string;
  readonly runtimeDigest: string;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly outputRoot: string;
  readonly status: "COMPLETED" | "FAILED" | "BLOCKED_DOMAIN_MISMATCH";
  readonly sensorDomainGapId?: string;
};

export type EmbeddingIndex = VisualRecordEnvelope & {
  readonly recordType: "embedding_index";
  readonly datasetSnapshotId: string;
  readonly modelRunId: string;
  readonly dimension: number;
  readonly normalization: "L2" | "NONE";
  readonly distanceMetric: "COSINE" | "EUCLIDEAN" | "DOT_PRODUCT";
  readonly implementation: string;
  readonly implementationVersion: string;
  readonly membershipHash: string;
  readonly objectRef: string;
  readonly authoritative: false;
};

export type CandidateFinding = VisualRecordEnvelope & {
  readonly recordType: "candidate_finding";
  readonly datasetSnapshotId: string;
  readonly sampleId: string;
  readonly assetRoot: string;
  readonly modelRunId: string;
  readonly geometry: Readonly<Record<string, unknown>>;
  readonly modelScore: number;
  readonly geometryScore?: number;
  readonly noveltyScore?: number;
  readonly uncertaintyScore?: number;
  readonly crossSensorAgreement?: number;
  readonly temporalChangeScore?: number;
  readonly sensorDomain: SensorDomain;
  readonly status: VisualCandidateStatus;
  readonly advisoryOnly: true;
  readonly evidenceAuthority: "NONE";
};

export type ReviewQueue = VisualRecordEnvelope & {
  readonly recordType: "review_queue";
  readonly purpose: string;
  readonly methodologyId: string;
  readonly requiredReviewerRoles: readonly VisualReviewerRole[];
  readonly secondReviewRequired: boolean;
  readonly fieldCheckPolicy: "NEVER" | "ON_REQUEST" | "REQUIRED_FOR_ACCEPTANCE";
  readonly currentSnapshotId: string;
};

export type ReviewQueueSnapshot = VisualRecordEnvelope & {
  readonly recordType: "review_queue_snapshot";
  readonly reviewQueueId: string;
  readonly datasetSnapshotId: string;
  readonly datasetManifestHash: string;
  readonly sampleIds: readonly string[];
  readonly candidateIds: readonly string[];
  readonly filterExpression: string;
  readonly sortExpression: string;
  readonly modelRunIds: readonly string[];
  readonly randomQaSeed?: string;
  readonly priorQueueSnapshotId?: string;
  readonly reviewQueueHash: string;
};

export type ReviewDecision = VisualRecordEnvelope & {
  readonly recordType: "review_decision";
  readonly candidateId: string;
  readonly reviewQueueSnapshotId: string;
  readonly reviewerId: string;
  readonly reviewerAccreditationRoot: string;
  readonly decision: VisualReviewDecisionKind;
  readonly rationaleCode: string;
  readonly notesHash?: string;
  readonly adjustedGeometry?: Readonly<Record<string, unknown>>;
  readonly reviewerConfidence: number;
  readonly supersedesDecisionId?: string;
};

export type FieldVerificationTask = VisualRecordEnvelope & {
  readonly recordType: "field_verification_task";
  readonly candidateId: string;
  readonly generalizedGeometry: Readonly<Record<string, unknown>>;
  readonly reason: string;
  readonly requiredObservations: readonly string[];
  readonly assignedOrganizationId: string;
  readonly assignedReviewerId: string;
  readonly expiresAt: string;
  readonly deviceBindingRequired: true;
  readonly status: "OPEN" | "COMPLETED" | "EXPIRED" | "CANCELLED";
};

export type FieldVerificationResult = VisualRecordEnvelope & {
  readonly recordType: "field_verification_result";
  readonly fieldTaskId: string;
  readonly reviewerId: string;
  readonly gpsHash: string;
  readonly gpsAccuracyMeters: number;
  readonly observedAt: string;
  readonly mediaRoots: readonly string[];
  readonly notesHash: string;
  readonly deviceAttestationRoot: string;
  readonly result: VisualFieldVerificationResultKind;
};

export type HardNegative = VisualRecordEnvelope & {
  readonly recordType: "hard_negative";
  readonly candidateId: string;
  readonly reviewDecisionId: string;
  readonly decoyType: VisualKnownDecoyType;
  readonly modelRunId: string;
  readonly evaluationUseAllowed: boolean;
  readonly trainingUseAllowed: boolean;
};

export type KnownDecoy = VisualRecordEnvelope & {
  readonly recordType: "known_decoy";
  readonly name: string;
  readonly decoyType: VisualKnownDecoyType;
  readonly assetRoot: string;
  readonly expectedDisposition: "REJECT_FALSE_POSITIVE";
  readonly confirmationRoot: string;
  readonly evaluationUseAllowed: boolean;
  readonly trainingUseAllowed: boolean;
};

export type VisualFinding = VisualRecordEnvelope & {
  readonly recordType: "visual_finding";
  readonly candidateId: string;
  readonly reviewDecisionIds: readonly string[];
  readonly fieldVerificationResultId?: string;
  readonly geometry: Readonly<Record<string, unknown>>;
  readonly observedAt: string;
  readonly qualityAssessmentRoot: string;
  readonly uncertaintyRoot: string;
  readonly status: VisualFindingStatus;
  readonly boundedObservation: true;
  readonly evidenceVerificationState: "NOT_EVIDENCE";
  readonly governanceApprovalRequired: true;
};

export type VisualProvenanceEdge = VisualRecordEnvelope & {
  readonly recordType: "visual_provenance_edge";
  readonly sourceId: string;
  readonly sourceRoot: string;
  readonly targetId: string;
  readonly targetRoot: string;
  readonly relation:
    | "WAS_DERIVED_FROM"
    | "WAS_GENERATED_BY"
    | "WAS_REVIEWED_IN"
    | "WAS_CONFIRMED_BY"
    | "WAS_REJECTED_AS"
    | "SUPERSEDES";
};

export type VisualQualityCheck = {
  readonly code: string;
  readonly state: VisualQualityState;
  readonly value?: number | string;
  readonly thresholdSource?: string;
  readonly evidenceRoot: string;
};

export type VisualQualityAssessment = VisualRecordEnvelope & {
  readonly recordType: "visual_quality_assessment";
  readonly subjectId: string;
  readonly checks: readonly VisualQualityCheck[];
  readonly criticalFailure: boolean;
  readonly institutionallyEligible: boolean;
};

export type VisualUncertaintyComponent = {
  readonly code: string;
  readonly state: "KNOWN" | "UNKNOWN" | "NOT_APPLICABLE";
  readonly value?: number;
  readonly unit?: string;
  readonly method?: string;
  readonly evidenceRoot?: string;
};

export type VisualUncertaintyBudget = VisualRecordEnvelope & {
  readonly recordType: "visual_uncertainty_budget";
  readonly subjectId: string;
  readonly components: readonly VisualUncertaintyComponent[];
  readonly unknownRequiredComponent: boolean;
  readonly methodologyFit: boolean;
};
