import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";
import type {
  CanopyProofEvidenceConsentProjection,
  CanopyProofEvidenceConsentReceiptFact,
  CanopyProofEvidenceDeviceAttestationFact,
  CanopyProofEvidenceDeviceAttestationProjection,
} from "./evidence-custody-authority.js";
import {
  isCanopyProofEffectiveDeviceAttestationProjection,
  type CanopyProofEffectiveDeviceAttestationProjection,
} from "./evidence-device-attestation-adapter-authority.js";
import {
  canopyProofEvidenceMediaAgentAuthorityRoot,
  canopyProofEvidenceMediaStorageProviders,
  type CanopyProofEvidenceMediaAgentCapability,
  type CanopyProofEvidenceMediaAgentSnapshot,
  type CanopyProofEvidenceMediaObjectFact,
  type CanopyProofEvidenceMediaUploadIntentFact,
} from "./evidence-media-authority.js";
import {
  assertCanopyProofEffectiveMediaObjectProjection,
  type CanopyProofEffectiveMediaObjectProjection,
  type CanopyProofEvidenceMediaAdapterTrustProjection,
} from "./evidence-media-adapter-authority.js";
import type { CanopyProofEvidenceMediaObjectProjection } from "./evidence-media-authority.js";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";

export const canopyProofEvidenceMetadataLocationDisclosures = [
  "none",
  "region_hash",
  "coarse_cell_hash",
] as const;
export const canopyProofEvidenceMetadataAccuracyBands = [
  "under_10m",
  "10_to_50m",
  "over_50m",
  "unknown",
] as const;
export const canopyProofEvidenceMetadataClockSkewBands = [
  "under_1m",
  "1_to_5m",
  "over_5m",
  "unknown",
] as const;
export const canopyProofEvidenceMetadataExtractionStates = ["accepted", "needs_review"] as const;
export const canopyProofEvidenceRetentionSourceTypes = ["media_object", "metadata_extraction"] as const;
export const canopyProofEvidenceRetentionBases = [
  "consent_retention",
  "expired_consent",
  "revoked_consent",
  "data_minimization",
  "safety_review",
  "legal_hold",
] as const;
export const canopyProofEvidenceRetentionDispositions = [
  "retain",
  "minimize",
  "tombstone_after_retention",
  "legal_hold",
] as const;
export const canopyProofEvidenceRetentionOperations = [
  "retain",
  "minimize",
  "tombstone",
  "apply_legal_hold",
] as const;
export const canopyProofEvidenceRetentionExecutionResults = ["completed", "blocked", "failed"] as const;
export const canopyProofEvidenceRetentionProjectionStates = [
  "no_decision",
  "retention_pending",
  "retained",
  "minimization_pending",
  "minimized",
  "disposal_pending",
  "disposed",
  "legal_hold_pending",
  "legal_hold",
  "execution_blocked",
  "execution_failed",
] as const;

export type CanopyProofEvidenceMetadataLocationDisclosure =
  (typeof canopyProofEvidenceMetadataLocationDisclosures)[number];
export type CanopyProofEvidenceMetadataAccuracyBand =
  (typeof canopyProofEvidenceMetadataAccuracyBands)[number];
export type CanopyProofEvidenceMetadataClockSkewBand =
  (typeof canopyProofEvidenceMetadataClockSkewBands)[number];
export type CanopyProofEvidenceMetadataExtractionState =
  (typeof canopyProofEvidenceMetadataExtractionStates)[number];
export type CanopyProofEvidenceRetentionSourceType =
  (typeof canopyProofEvidenceRetentionSourceTypes)[number];
export type CanopyProofEvidenceRetentionBasis = (typeof canopyProofEvidenceRetentionBases)[number];
export type CanopyProofEvidenceRetentionDisposition =
  (typeof canopyProofEvidenceRetentionDispositions)[number];
export type CanopyProofEvidenceRetentionOperation =
  (typeof canopyProofEvidenceRetentionOperations)[number];
export type CanopyProofEvidenceRetentionExecutionResult =
  (typeof canopyProofEvidenceRetentionExecutionResults)[number];
export type CanopyProofEvidenceRetentionProjectionState =
  (typeof canopyProofEvidenceRetentionProjectionStates)[number];

export type CanopyProofEvidenceMetadataRetentionSafetyBoundary = {
  readonly appendOnly: true;
  readonly organizationBound: true;
  readonly projectBound: true;
  readonly evidenceBound: true;
  readonly subjectBound: true;
  readonly mediaObjectBound: true;
  readonly mediaProjectionBound: true;
  readonly consentBound: true;
  readonly deviceBound: true;
  readonly semanticEventBound: true;
  readonly metadataMinimizedByDefault: true;
  readonly noRawExif: true;
  readonly noRawGps: true;
  readonly noPreciseLocation: true;
  readonly noProviderCredential: true;
  readonly humanRetentionAuthorityRequired: true;
  readonly providerVerificationRequiredForCompletedExecution: true;
  readonly legalHoldBlocksDisposal: true;
  readonly notFinalProofAuthority: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEvidenceMetadataExtractionFact = {
  readonly factType: "evidence_media_metadata_extraction";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly objectRoot: string;
  readonly mediaProjectionState: "available" | "needs_review";
  readonly mediaProjectionRoot: string;
  readonly subjectId: string;
  readonly consentReceiptId: string;
  readonly consentReceiptRoot: string;
  readonly consentProjectionRoot: string;
  readonly deviceAttestationId: string;
  readonly deviceAttestationRoot: string;
  readonly deviceProjectionRoot: string;
  readonly privacyMode: CanopyProofEvidenceConsentReceiptFact["privacyMode"];
  readonly extractorName: string;
  readonly extractorVersion: string;
  readonly extractorImageDigest: string;
  readonly metadataSchemaVersion: string;
  readonly exifHash: string;
  readonly gpsHash: string;
  readonly metadataOutputRoot: string;
  readonly locationDisclosure: CanopyProofEvidenceMetadataLocationDisclosure;
  readonly generalizedLocationHash?: string;
  readonly accuracyBand: CanopyProofEvidenceMetadataAccuracyBand;
  readonly clockSkewBand: CanopyProofEvidenceMetadataClockSkewBand;
  readonly issueCodes: readonly string[];
  readonly extractionState: CanopyProofEvidenceMetadataExtractionState;
  readonly providerReceiptHash: string;
  readonly providerVerificationState: "modeled_only";
  readonly observedAt: string;
  readonly extractedAt: string;
  readonly agent: CanopyProofEvidenceMediaAgentSnapshot;
  readonly extractionSequence: number;
  readonly previousExtractionRoot: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly extractionHash: string;
  readonly extractionRoot: string;
  readonly safety: CanopyProofEvidenceMetadataRetentionSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceRetentionSource =
  | CanopyProofEvidenceMediaObjectFact
  | CanopyProofEvidenceMetadataExtractionFact;

export type CanopyProofEvidenceRetentionDecisionFact = {
  readonly factType: "evidence_retention_decision";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly subjectId: string;
  readonly sourceType: CanopyProofEvidenceRetentionSourceType;
  readonly sourceId: string;
  readonly sourceRoot: string;
  readonly consentReceiptId: string;
  readonly consentReceiptRoot: string;
  readonly consentProjectionState: CanopyProofEvidenceConsentProjection["state"];
  readonly consentProjectionRoot: string;
  readonly retentionDeadline: string;
  readonly basis: CanopyProofEvidenceRetentionBasis;
  readonly disposition: CanopyProofEvidenceRetentionDisposition;
  readonly retainUntil?: string;
  readonly legalHoldRoot?: string;
  readonly policyId: string;
  readonly rationaleHash: string;
  readonly decidedBy: string;
  readonly decider: CanopyProofVerificationActorSnapshot;
  readonly evaluatedAt: string;
  readonly decisionSequence: number;
  readonly previousDecisionRoot: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly decisionHash: string;
  readonly decisionRoot: string;
  readonly safety: CanopyProofEvidenceMetadataRetentionSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceRetentionExecutionFact = {
  readonly factType: "evidence_retention_execution";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly subjectId: string;
  readonly sourceType: CanopyProofEvidenceRetentionSourceType;
  readonly sourceId: string;
  readonly sourceRoot: string;
  readonly decisionId: string;
  readonly decisionRoot: string;
  readonly operation: CanopyProofEvidenceRetentionOperation;
  readonly result: CanopyProofEvidenceRetentionExecutionResult;
  readonly storageProvider: (typeof canopyProofEvidenceMediaStorageProviders)[number];
  readonly providerNamespace: string;
  readonly providerReceiptHash: string;
  readonly providerVerificationState: "modeled_only" | "verified";
  readonly resultingRoot: string;
  readonly reasonHashes: readonly string[];
  readonly executedAt: string;
  readonly agent: CanopyProofEvidenceMediaAgentSnapshot;
  readonly executionSequence: number;
  readonly previousExecutionRoot: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly executionHash: string;
  readonly executionRoot: string;
  readonly safety: CanopyProofEvidenceMetadataRetentionSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceRetentionProjection = {
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly sourceType: CanopyProofEvidenceRetentionSourceType;
  readonly sourceId: string;
  readonly sourceRoot: string;
  readonly state: CanopyProofEvidenceRetentionProjectionState;
  readonly evaluatedAt: string;
  readonly decisionId?: string;
  readonly decisionRoot?: string;
  readonly executionId?: string;
  readonly executionRoot?: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEvidenceMetadataRetentionSafetyBoundary;
};

export type CanopyProofEvidenceMetadataRetentionAuthoritySnapshot = {
  readonly streamEvents: readonly CanopyProofAuditEvent[];
  readonly metadataExtractions: readonly CanopyProofEvidenceMetadataExtractionFact[];
  readonly retentionDecisions: readonly CanopyProofEvidenceRetentionDecisionFact[];
  readonly retentionExecutions: readonly CanopyProofEvidenceRetentionExecutionFact[];
};

export type CanopyProofEvidenceMetadataExtractionAuthority = {
  readonly intent: CanopyProofEvidenceMediaUploadIntentFact;
  readonly object: CanopyProofEvidenceMediaObjectFact;
  readonly baseMediaProjection: CanopyProofEvidenceMediaObjectProjection;
  readonly mediaAdapterTrustProjection: CanopyProofEvidenceMediaAdapterTrustProjection;
  readonly mediaProjection: CanopyProofEffectiveMediaObjectProjection;
  readonly consent: CanopyProofEvidenceConsentReceiptFact;
  readonly consentProjection: CanopyProofEvidenceConsentProjection;
  readonly device: CanopyProofEvidenceDeviceAttestationFact;
  readonly deviceProjection:
    | CanopyProofEvidenceDeviceAttestationProjection
    | CanopyProofEffectiveDeviceAttestationProjection;
  readonly registeredGpsHash: string;
  readonly agent: CanopyProofEvidenceMediaAgentSnapshot;
};

export type CanopyProofEvidenceRetentionDecisionAuthority = {
  readonly source: CanopyProofEvidenceRetentionSource;
  readonly intent: CanopyProofEvidenceMediaUploadIntentFact;
  readonly consent: CanopyProofEvidenceConsentReceiptFact;
  readonly consentProjection: CanopyProofEvidenceConsentProjection;
  readonly decider: CanopyProofVerificationActorSnapshot;
};

export type CanopyProofEvidenceRetentionExecutionAuthority = {
  readonly source: CanopyProofEvidenceRetentionSource;
  readonly decision: CanopyProofEvidenceRetentionDecisionFact;
  readonly object: CanopyProofEvidenceMediaObjectFact;
  readonly agent: CanopyProofEvidenceMediaAgentSnapshot;
};

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const boundedTextSchema = z.string().trim().min(1).max(240);
const hashSchema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);
const agentSchema = z
  .object({
    id: identifierSchema,
    participantType: z.literal("agent"),
    role: z.literal("agent"),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    agentType: z.literal("evidence"),
    agentStatus: z.literal("active"),
    capability: z.string().min(1),
    agentRegistryHash: hashSchema,
    authorityRoot: hashSchema,
  })
  .strict();
const deciderSchema = z
  .object({
    id: identifierSchema,
    participantType: z.literal("human"),
    role: z.enum(["owner", "admin"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema,
    membershipStatus: z.literal("active"),
    membershipRoot: hashSchema,
    accreditationId: identifierSchema,
    accreditationStatus: z.literal("approved"),
    accreditationRoot: hashSchema,
    accreditationScope: z.array(z.string().min(1)).min(1).max(32),
    authorityRoot: hashSchema,
  })
  .strict();

const metadataExtractionInputSchema = z
  .object({
    objectId: identifierSchema,
    extractorName: boundedTextSchema,
    extractorVersion: boundedTextSchema,
    extractorImageDigest: hashSchema,
    metadataSchemaVersion: boundedTextSchema,
    exifHash: hashSchema,
    gpsHash: hashSchema,
    metadataOutputRoot: hashSchema,
    locationDisclosure: z.enum(canopyProofEvidenceMetadataLocationDisclosures),
    generalizedLocationHash: hashSchema.optional(),
    accuracyBand: z.enum(canopyProofEvidenceMetadataAccuracyBands),
    clockSkewBand: z.enum(canopyProofEvidenceMetadataClockSkewBands),
    providerReceiptHash: hashSchema,
    providerVerificationState: z.literal("modeled_only"),
    observedAt: z.string().datetime(),
    extractedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.locationDisclosure === "none" && value.generalizedLocationHash) {
      context.addIssue({
        code: "custom",
        path: ["generalizedLocationHash"],
        message: "No location disclosure cannot include a generalized location commitment.",
      });
    }
    if (value.locationDisclosure !== "none" && !value.generalizedLocationHash) {
      context.addIssue({
        code: "custom",
        path: ["generalizedLocationHash"],
        message: "Generalized location disclosure requires a hash commitment.",
      });
    }
    if (Date.parse(value.observedAt) > Date.parse(value.extractedAt)) {
      context.addIssue({ code: "custom", path: ["observedAt"], message: "Observation cannot follow extraction." });
    }
  });

const retentionDecisionInputSchema = z
  .object({
    sourceType: z.enum(canopyProofEvidenceRetentionSourceTypes),
    sourceId: identifierSchema,
    basis: z.enum(canopyProofEvidenceRetentionBases),
    disposition: z.enum(canopyProofEvidenceRetentionDispositions),
    retainUntil: z.string().datetime().optional(),
    legalHoldRoot: hashSchema.optional(),
    policyId: identifierSchema,
    rationale: z.string().trim().min(20).max(4_000),
    evaluatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.disposition === "legal_hold" && !value.legalHoldRoot) {
      context.addIssue({ code: "custom", path: ["legalHoldRoot"], message: "Legal hold requires a root." });
    }
    if (value.disposition !== "legal_hold" && value.legalHoldRoot) {
      context.addIssue({ code: "custom", path: ["legalHoldRoot"], message: "Only legal hold may bind a hold root." });
    }
    if (value.disposition !== "legal_hold" && !value.retainUntil) {
      context.addIssue({ code: "custom", path: ["retainUntil"], message: "Retention action requires a deadline." });
    }
  });

const retentionExecutionInputSchema = z
  .object({
    decisionId: identifierSchema,
    operation: z.enum(canopyProofEvidenceRetentionOperations),
    result: z.enum(canopyProofEvidenceRetentionExecutionResults),
    storageProvider: z.enum(canopyProofEvidenceMediaStorageProviders),
    providerNamespace: identifierSchema,
    providerReceiptHash: hashSchema,
    providerVerificationState: z.enum(["modeled_only", "verified"]),
    resultingRoot: hashSchema,
    reasonHashes: z.array(hashSchema).max(32).default([]),
    executedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.result === "completed" && value.reasonHashes.length > 0) {
      context.addIssue({ code: "custom", path: ["reasonHashes"], message: "Completed execution has no failure reasons." });
    }
    if (value.result !== "completed" && value.reasonHashes.length === 0) {
      context.addIssue({ code: "custom", path: ["reasonHashes"], message: "Blocked or failed execution requires reasons." });
    }
  });

export class CanopyProofEvidenceMetadataRetentionAuthorityService {
  private readonly extractionsById = new Map<string, CanopyProofEvidenceMetadataExtractionFact>();
  private readonly extractionIdsByObjectId = new Map<string, string[]>();
  private readonly decisionsById = new Map<string, CanopyProofEvidenceRetentionDecisionFact>();
  private readonly decisionIdsBySource = new Map<string, string[]>();
  private readonly executionsById = new Map<string, CanopyProofEvidenceRetentionExecutionFact>();
  private readonly executionIdsBySource = new Map<string, string[]>();
  private streamEvents: CanopyProofAuditEvent[];

  constructor(streamEvents: readonly CanopyProofAuditEvent[] = []) {
    this.streamEvents = validateStreamEvents(streamEvents);
  }

  static fromAuthoritySnapshot(snapshot: CanopyProofEvidenceMetadataRetentionAuthoritySnapshot) {
    const service = new CanopyProofEvidenceMetadataRetentionAuthorityService(snapshot.streamEvents);
    const ids = new Set<string>();
    const facts = [
      ...snapshot.metadataExtractions,
      ...snapshot.retentionDecisions,
      ...snapshot.retentionExecutions,
    ].sort((left, right) => left.evidenceSequence - right.evidenceSequence || left.id.localeCompare(right.id));
    for (const fact of facts) {
      if (ids.has(fact.id)) throw new Error(`CanopyProof E3b snapshot contains duplicate fact id: ${fact.id}`);
      ids.add(fact.id);
      if (fact.factType === "evidence_media_metadata_extraction") service.replayExtraction(fact);
      else if (fact.factType === "evidence_retention_decision") service.replayDecision(fact);
      else service.replayExecution(fact);
    }
    return service;
  }

  recordMetadataExtraction(input: unknown, authority: CanopyProofEvidenceMetadataExtractionAuthority) {
    const parsed = metadataExtractionInputSchema.parse(input);
    assertMillisecondTimestamp(parsed.observedAt, "metadata observedAt");
    assertMillisecondTimestamp(parsed.extractedAt, "metadata extractedAt");
    assertMetadataAuthority(parsed.objectId, parsed.extractedAt, authority);
    assertSafeTextMaterial(parsed.extractorName, "metadata extractor name");
    assertSafeTextMaterial(parsed.extractorVersion, "metadata extractor version");
    assertSafeTextMaterial(parsed.metadataSchemaVersion, "metadata schema version");
    const mediaProjectionState = authority.mediaProjection.state;
    if (mediaProjectionState !== "available" && mediaProjectionState !== "needs_review") {
      throw new Error("CanopyProof metadata extraction media projection is not eligible.");
    }
    const capability = metadataCapability();
    const agent = normalizeAgent(authority.agent, capability);
    assertAgentOrganization(agent, authority.object.organizationId);
    if (normalizeHash(parsed.gpsHash) !== normalizeHash(authority.registeredGpsHash)) {
      throw new Error("CanopyProof metadata GPS commitment must match registered evidence authority.");
    }
    assertLocationDisclosure(authority.consent.privacyMode, parsed.locationDisclosure);

    const previous = this.extractionsForObject(authority.object.id).at(-1);
    const issueCodes = metadataIssueCodes(
      parsed,
      mediaProjectionState,
      authority.deviceProjection.state,
    );
    const extractionState: CanopyProofEvidenceMetadataExtractionState = "needs_review";
    const normalized = {
      organizationId: authority.object.organizationId,
      projectId: authority.object.projectId,
      evidenceId: authority.object.evidenceId,
      objectId: authority.object.id,
      objectRoot: authority.object.objectRoot,
      mediaProjectionState,
      mediaProjectionRoot: authority.mediaProjection.projectionRoot,
      subjectId: authority.intent.subjectId,
      consentReceiptId: authority.consent.id,
      consentReceiptRoot: authority.consent.receiptRoot,
      consentProjectionRoot: authority.consentProjection.projectionRoot,
      deviceAttestationId: authority.device.id,
      deviceAttestationRoot: authority.device.attestationRoot,
      deviceProjectionRoot: authority.deviceProjection.projectionRoot,
      privacyMode: authority.consent.privacyMode,
      extractorName: parsed.extractorName,
      extractorVersion: parsed.extractorVersion,
      extractorImageDigest: normalizeHash(parsed.extractorImageDigest),
      metadataSchemaVersion: parsed.metadataSchemaVersion,
      exifHash: normalizeHash(parsed.exifHash),
      gpsHash: normalizeHash(parsed.gpsHash),
      metadataOutputRoot: normalizeHash(parsed.metadataOutputRoot),
      locationDisclosure: parsed.locationDisclosure,
      ...(parsed.generalizedLocationHash
        ? { generalizedLocationHash: normalizeHash(parsed.generalizedLocationHash) }
        : {}),
      accuracyBand: parsed.accuracyBand,
      clockSkewBand: parsed.clockSkewBand,
      issueCodes,
      extractionState,
      providerReceiptHash: normalizeHash(parsed.providerReceiptHash),
      providerVerificationState: parsed.providerVerificationState,
      observedAt: parsed.observedAt,
      extractedAt: parsed.extractedAt,
      agent,
      extractionSequence: (previous?.extractionSequence ?? 0) + 1,
      previousExtractionRoot:
        previous?.extractionRoot ?? metadataExtractionGenesis(authority.object.id),
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-metadata-extraction-command-v1", ...normalized });
    const id = `cp_media_metadata_${commandHash.slice(0, 24)}`;
    const existing = this.extractionsById.get(id);
    if (existing) return existing;
    const lineage = this.nextLineage();
    const seed = { id, ...normalized, commandHash, ...lineage };
    const extractionHash = hashJson({ kind: "canopyproof-evidence-metadata-extraction-v1", ...seed });
    const extractionRoot = metadataExtractionRoot({ ...seed, extractionHash });
    const safety = canopyProofEvidenceMetadataRetentionSafetyBoundary();
    const payload = {
      factType: "evidence_media_metadata_extraction",
      ...seed,
      extractionHash,
      extractionRoot,
      safety,
    };
    const auditEvent = this.appendEvent({
      action: metadataExtractionAction(),
      actor: agent.id,
      entityType: "media_metadata_extraction",
      entityId: id,
      payload,
      createdAt: parsed.extractedAt,
      rationale: "A minimized metadata extraction receipt was appended without raw EXIF, GPS, or location data.",
    });
    const fact: CanopyProofEvidenceMetadataExtractionFact = {
      factType: "evidence_media_metadata_extraction",
      ...seed,
      extractionHash,
      extractionRoot,
      safety,
      auditEvent,
    };
    this.extractionsById.set(id, fact);
    this.extractionIdsByObjectId.set(authority.object.id, [
      ...(this.extractionIdsByObjectId.get(authority.object.id) ?? []),
      id,
    ]);
    return fact;
  }

  recordRetentionDecision(input: unknown, authority: CanopyProofEvidenceRetentionDecisionAuthority) {
    const parsed = retentionDecisionInputSchema.parse(input);
    assertMillisecondTimestamp(parsed.evaluatedAt, "retention evaluatedAt");
    const source = authority.source;
    const sourceDescriptor = describeSource(source);
    if (parsed.sourceType !== sourceDescriptor.sourceType || parsed.sourceId !== sourceDescriptor.sourceId) {
      throw new Error("CanopyProof retention decision source authority mismatch.");
    }
    assertRetentionAuthority(sourceDescriptor, authority, parsed.evaluatedAt);
    const decider = normalizeRetentionDecider(authority.decider);
    if (decider.organizationId !== sourceDescriptor.organizationId) {
      throw new Error("CanopyProof retention decision organization authority mismatch.");
    }
    assertRetentionPolicy(parsed, authority, sourceDescriptor);
    const sourceKey = retentionSourceKey(sourceDescriptor.sourceType, sourceDescriptor.sourceId);
    const previous = this.decisionsForSource(sourceKey).at(-1);
    if (previous?.disposition === "legal_hold" && parsed.disposition !== "legal_hold") {
      throw new Error("CanopyProof legal hold is terminal until a governed release authority is implemented.");
    }
    const retentionDeadline = consentRetentionDeadline(authority.consent);
    const normalized = {
      organizationId: sourceDescriptor.organizationId,
      projectId: sourceDescriptor.projectId,
      evidenceId: sourceDescriptor.evidenceId,
      subjectId: authority.intent.subjectId,
      sourceType: sourceDescriptor.sourceType,
      sourceId: sourceDescriptor.sourceId,
      sourceRoot: sourceDescriptor.sourceRoot,
      consentReceiptId: authority.consent.id,
      consentReceiptRoot: authority.consent.receiptRoot,
      consentProjectionState: authority.consentProjection.state,
      consentProjectionRoot: authority.consentProjection.projectionRoot,
      retentionDeadline,
      basis: parsed.basis,
      disposition: parsed.disposition,
      ...(parsed.retainUntil ? { retainUntil: parsed.retainUntil } : {}),
      ...(parsed.legalHoldRoot ? { legalHoldRoot: normalizeHash(parsed.legalHoldRoot) } : {}),
      policyId: parsed.policyId,
      rationaleHash: hashJson({ kind: "canopyproof-evidence-retention-rationale-v1", value: parsed.rationale }),
      decidedBy: decider.id,
      decider,
      evaluatedAt: parsed.evaluatedAt,
      decisionSequence: (previous?.decisionSequence ?? 0) + 1,
      previousDecisionRoot: previous?.decisionRoot ?? retentionDecisionGenesis(sourceDescriptor),
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-retention-decision-command-v1", ...normalized });
    const id = `cp_retention_decision_${commandHash.slice(0, 24)}`;
    const existing = this.decisionsById.get(id);
    if (existing) return existing;
    const lineage = this.nextLineage();
    const seed = { id, ...normalized, commandHash, ...lineage };
    const decisionHash = hashJson({ kind: "canopyproof-evidence-retention-decision-v1", ...seed });
    const decisionRoot = retentionDecisionRoot({ ...seed, decisionHash });
    const safety = canopyProofEvidenceMetadataRetentionSafetyBoundary();
    const payload = {
      factType: "evidence_retention_decision",
      ...seed,
      decisionHash,
      decisionRoot,
      safety,
    };
    const auditEvent = this.appendEvent({
      action: retentionDecisionAction(parsed.disposition),
      actor: decider.id,
      entityType: "retention_policy_decision",
      entityId: id,
      payload,
      createdAt: parsed.evaluatedAt,
      rationale: "A human-authorized retention decision was appended without mutating source evidence.",
    });
    const fact: CanopyProofEvidenceRetentionDecisionFact = {
      factType: "evidence_retention_decision",
      ...seed,
      decisionHash,
      decisionRoot,
      safety,
      auditEvent,
    };
    this.decisionsById.set(id, fact);
    this.decisionIdsBySource.set(sourceKey, [...(this.decisionIdsBySource.get(sourceKey) ?? []), id]);
    return fact;
  }

  recordRetentionExecution(input: unknown, authority: CanopyProofEvidenceRetentionExecutionAuthority) {
    const parsed = retentionExecutionInputSchema.parse(input);
    assertMillisecondTimestamp(parsed.executedAt, "retention executedAt");
    const decision = this.getRetentionDecision(parsed.decisionId);
    if (decision.decisionRoot !== authority.decision.decisionRoot) {
      throw new Error("CanopyProof retention execution decision authority mismatch.");
    }
    const source = describeSource(authority.source);
    const latestDecision = this.decisionsForSource(retentionSourceKey(source.sourceType, source.sourceId)).at(-1);
    if (latestDecision?.id !== decision.id) {
      throw new Error("CanopyProof retention execution must target the latest governed decision.");
    }
    if (
      source.sourceType !== decision.sourceType ||
      source.sourceId !== decision.sourceId ||
      source.sourceRoot !== decision.sourceRoot ||
      source.organizationId !== decision.organizationId ||
      source.evidenceId !== decision.evidenceId ||
      authority.object.evidenceId !== decision.evidenceId ||
      authority.object.organizationId !== decision.organizationId
    ) {
      throw new Error("CanopyProof retention execution source authority mismatch.");
    }
    if (parsed.operation !== operationForDisposition(decision.disposition)) {
      throw new Error("CanopyProof retention execution operation does not match the governed decision.");
    }
    if (Date.parse(parsed.executedAt) < Date.parse(decision.evaluatedAt)) {
      throw new Error("CanopyProof retention execution predates its decision.");
    }
    assertExecutionTiming(parsed, decision, authority.object);
    assertSafeTextMaterial(parsed.providerNamespace, "retention provider namespace");
    const capability = retentionExecutionCapability(parsed.providerVerificationState);
    const agent = normalizeAgent(authority.agent, capability);
    assertAgentOrganization(agent, decision.organizationId);
    const sourceKey = retentionSourceKey(decision.sourceType, decision.sourceId);
    const previous = this.executionsForSource(sourceKey).at(-1);
    const normalized = {
      organizationId: decision.organizationId,
      projectId: decision.projectId,
      evidenceId: decision.evidenceId,
      subjectId: decision.subjectId,
      sourceType: decision.sourceType,
      sourceId: decision.sourceId,
      sourceRoot: decision.sourceRoot,
      decisionId: decision.id,
      decisionRoot: decision.decisionRoot,
      operation: parsed.operation,
      result: parsed.result,
      storageProvider: parsed.storageProvider,
      providerNamespace: parsed.providerNamespace,
      providerReceiptHash: normalizeHash(parsed.providerReceiptHash),
      providerVerificationState: parsed.providerVerificationState,
      resultingRoot: normalizeHash(parsed.resultingRoot),
      reasonHashes: canonicalHashes(parsed.reasonHashes),
      executedAt: parsed.executedAt,
      agent,
      executionSequence: (previous?.executionSequence ?? 0) + 1,
      previousExecutionRoot: previous?.executionRoot ?? retentionExecutionGenesis(source),
    } as const;
    const commandHash = hashJson({ kind: "canopyproof-evidence-retention-execution-command-v1", ...normalized });
    const id = `cp_retention_execution_${commandHash.slice(0, 24)}`;
    const existing = this.executionsById.get(id);
    if (existing) return existing;
    const lineage = this.nextLineage();
    const seed = { id, ...normalized, commandHash, ...lineage };
    const executionHash = hashJson({ kind: "canopyproof-evidence-retention-execution-v1", ...seed });
    const executionRoot = retentionExecutionRoot({ ...seed, executionHash });
    const safety = canopyProofEvidenceMetadataRetentionSafetyBoundary();
    const payload = {
      factType: "evidence_retention_execution",
      ...seed,
      executionHash,
      executionRoot,
      safety,
    };
    const auditEvent = this.appendEvent({
      action: retentionExecutionAction(parsed.result, parsed.providerVerificationState),
      actor: agent.id,
      entityType: "evidence_media_retention_execution",
      entityId: id,
      payload,
      createdAt: parsed.executedAt,
      rationale: "A provider execution receipt was appended; source evidence history remains immutable.",
    });
    const fact: CanopyProofEvidenceRetentionExecutionFact = {
      factType: "evidence_retention_execution",
      ...seed,
      executionHash,
      executionRoot,
      safety,
      auditEvent,
    };
    this.executionsById.set(id, fact);
    this.executionIdsBySource.set(sourceKey, [...(this.executionIdsBySource.get(sourceKey) ?? []), id]);
    return fact;
  }

  projectRetention(
    sourceType: CanopyProofEvidenceRetentionSourceType,
    sourceId: string,
    evaluatedAt: string,
  ): CanopyProofEvidenceRetentionProjection {
    const evaluation = z.string().datetime().parse(evaluatedAt);
    const sourceKey = retentionSourceKey(sourceType, sourceId);
    const decisions = this.decisionsForSource(sourceKey).filter(
      (decision) => Date.parse(decision.evaluatedAt) <= Date.parse(evaluation),
    );
    const decision = decisions.at(-1);
    const descriptor = decision
      ? {
          organizationId: decision.organizationId,
          projectId: decision.projectId,
          evidenceId: decision.evidenceId,
          sourceType: decision.sourceType,
          sourceId: decision.sourceId,
          sourceRoot: decision.sourceRoot,
        }
      : this.describeKnownSource(sourceType, sourceId);
    const executions = this.executionsForSource(sourceKey).filter(
      (execution) => Date.parse(execution.executedAt) <= Date.parse(evaluation),
    );
    const execution = decision
      ? executions.filter((candidate) => candidate.decisionId === decision.id).at(-1)
      : undefined;
    const state = retentionProjectionState(decision, execution);
    const safety = canopyProofEvidenceMetadataRetentionSafetyBoundary();
    const seed = {
      ...descriptor,
      state,
      evaluatedAt: evaluation,
      ...(decision ? { decisionId: decision.id, decisionRoot: decision.decisionRoot } : {}),
      ...(execution ? { executionId: execution.id, executionRoot: execution.executionRoot } : {}),
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-evidence-retention-projection-v1", ...seed, safety }),
      safety,
    };
  }

  getMetadataExtraction(id: string) {
    const fact = this.extractionsById.get(id);
    if (!fact) throw new Error(`CanopyProof metadata extraction not found: ${id}`);
    return fact;
  }

  getRetentionDecision(id: string) {
    const fact = this.decisionsById.get(id);
    if (!fact) throw new Error(`CanopyProof retention decision not found: ${id}`);
    return fact;
  }

  getRetentionExecution(id: string) {
    const fact = this.executionsById.get(id);
    if (!fact) throw new Error(`CanopyProof retention execution not found: ${id}`);
    return fact;
  }

  getAuthoritySnapshot(): CanopyProofEvidenceMetadataRetentionAuthoritySnapshot {
    return {
      streamEvents: [...this.streamEvents],
      metadataExtractions: sortedFacts(this.extractionsById.values()),
      retentionDecisions: sortedFacts(this.decisionsById.values()),
      retentionExecutions: sortedFacts(this.executionsById.values()),
    };
  }

  private replayExtraction(expected: CanopyProofEvidenceMetadataExtractionFact) {
    const agent = normalizeAgent(expected.agent, metadataCapability());
    const previous = this.extractionsForObject(expected.objectId).at(-1);
    const seed = metadataExtractionFactSeed(expected);
    const commandHash = hashJson({
      kind: "canopyproof-evidence-metadata-extraction-command-v1",
      ...metadataExtractionCommandSeed(expected),
    });
    const extractionHash = hashJson({ kind: "canopyproof-evidence-metadata-extraction-v1", ...seed });
    const extractionRoot = metadataExtractionRoot({ ...seed, extractionHash });
    if (
      agent.id !== expected.agent.id ||
      expected.extractionSequence !== (previous?.extractionSequence ?? 0) + 1 ||
      expected.previousExtractionRoot !== (previous?.extractionRoot ?? metadataExtractionGenesis(expected.objectId)) ||
      expected.providerVerificationState !== "modeled_only" ||
      expected.extractionState !== "needs_review" ||
      commandHash !== expected.commandHash ||
      expected.id !== `cp_media_metadata_${commandHash.slice(0, 24)}` ||
      extractionHash !== expected.extractionHash ||
      extractionRoot !== expected.extractionRoot
    ) {
      throw new Error(`CanopyProof metadata extraction lineage is invalid: ${expected.id}`);
    }
    this.assertReplayEvent(
      expected,
      metadataExtractionAction(),
      "media_metadata_extraction",
      {
        factType: expected.factType,
        ...seed,
        extractionHash,
        extractionRoot,
        safety: expected.safety,
      },
      "A minimized metadata extraction receipt was appended without raw EXIF, GPS, or location data.",
    );
    this.extractionsById.set(expected.id, expected);
    this.extractionIdsByObjectId.set(expected.objectId, [
      ...(this.extractionIdsByObjectId.get(expected.objectId) ?? []),
      expected.id,
    ]);
  }

  private replayDecision(expected: CanopyProofEvidenceRetentionDecisionFact) {
    const decider = normalizeRetentionDecider(expected.decider);
    const sourceKey = retentionSourceKey(expected.sourceType, expected.sourceId);
    const previous = this.decisionsForSource(sourceKey).at(-1);
    const seed = retentionDecisionFactSeed(expected);
    const commandHash = hashJson({
      kind: "canopyproof-evidence-retention-decision-command-v1",
      ...retentionDecisionCommandSeed(expected),
    });
    const decisionHash = hashJson({ kind: "canopyproof-evidence-retention-decision-v1", ...seed });
    const decisionRoot = retentionDecisionRoot({ ...seed, decisionHash });
    if (
      decider.id !== expected.decidedBy ||
      (previous?.disposition === "legal_hold" && expected.disposition !== "legal_hold") ||
      expected.decisionSequence !== (previous?.decisionSequence ?? 0) + 1 ||
      expected.previousDecisionRoot !==
        (previous?.decisionRoot ??
          retentionDecisionGenesis({
            sourceType: expected.sourceType,
            sourceId: expected.sourceId,
            sourceRoot: expected.sourceRoot,
            organizationId: expected.organizationId,
            projectId: expected.projectId,
            evidenceId: expected.evidenceId,
          })) ||
      commandHash !== expected.commandHash ||
      expected.id !== `cp_retention_decision_${commandHash.slice(0, 24)}` ||
      decisionHash !== expected.decisionHash ||
      decisionRoot !== expected.decisionRoot
    ) {
      throw new Error(`CanopyProof retention decision lineage is invalid: ${expected.id}`);
    }
    this.assertReplayEvent(
      expected,
      retentionDecisionAction(expected.disposition),
      "retention_policy_decision",
      {
        factType: expected.factType,
        ...seed,
        decisionHash,
        decisionRoot,
        safety: expected.safety,
      },
      "A human-authorized retention decision was appended without mutating source evidence.",
    );
    this.decisionsById.set(expected.id, expected);
    this.decisionIdsBySource.set(sourceKey, [...(this.decisionIdsBySource.get(sourceKey) ?? []), expected.id]);
  }

  private replayExecution(expected: CanopyProofEvidenceRetentionExecutionFact) {
    const decision = this.getRetentionDecision(expected.decisionId);
    const agent = normalizeAgent(expected.agent, retentionExecutionCapability(expected.providerVerificationState));
    const sourceKey = retentionSourceKey(expected.sourceType, expected.sourceId);
    const latestDecision = this.decisionsForSource(sourceKey).at(-1);
    const previous = this.executionsForSource(sourceKey).at(-1);
    const seed = retentionExecutionFactSeed(expected);
    const commandHash = hashJson({
      kind: "canopyproof-evidence-retention-execution-command-v1",
      ...retentionExecutionCommandSeed(expected),
    });
    const executionHash = hashJson({ kind: "canopyproof-evidence-retention-execution-v1", ...seed });
    const executionRoot = retentionExecutionRoot({ ...seed, executionHash });
    if (
      decision.decisionRoot !== expected.decisionRoot ||
      latestDecision?.id !== decision.id ||
      decision.sourceRoot !== expected.sourceRoot ||
      expected.operation !== operationForDisposition(decision.disposition) ||
      agent.id !== expected.agent.id ||
      expected.executionSequence !== (previous?.executionSequence ?? 0) + 1 ||
      expected.previousExecutionRoot !==
        (previous?.executionRoot ??
          retentionExecutionGenesis({
            sourceType: expected.sourceType,
            sourceId: expected.sourceId,
            sourceRoot: expected.sourceRoot,
            organizationId: expected.organizationId,
            projectId: expected.projectId,
            evidenceId: expected.evidenceId,
          })) ||
      commandHash !== expected.commandHash ||
      expected.id !== `cp_retention_execution_${commandHash.slice(0, 24)}` ||
      executionHash !== expected.executionHash ||
      executionRoot !== expected.executionRoot
    ) {
      throw new Error(`CanopyProof retention execution lineage is invalid: ${expected.id}`);
    }
    this.assertReplayEvent(
      expected,
      retentionExecutionAction(expected.result, expected.providerVerificationState),
      "evidence_media_retention_execution",
      {
        factType: expected.factType,
        ...seed,
        executionHash,
        executionRoot,
        safety: expected.safety,
      },
      "A provider execution receipt was appended; source evidence history remains immutable.",
    );
    this.executionsById.set(expected.id, expected);
    this.executionIdsBySource.set(sourceKey, [...(this.executionIdsBySource.get(sourceKey) ?? []), expected.id]);
  }

  private assertReplayEvent(
    fact:
      | CanopyProofEvidenceMetadataExtractionFact
      | CanopyProofEvidenceRetentionDecisionFact
      | CanopyProofEvidenceRetentionExecutionFact,
    action: CanopyProofAuditEvent["action"],
    entityType: CanopyProofAuditEvent["entityType"],
    payload: unknown,
    rationale: string,
  ) {
    if (hashJson(fact.safety) !== hashJson(canopyProofEvidenceMetadataRetentionSafetyBoundary())) {
      throw new Error(`CanopyProof E3b safety boundary is invalid: ${fact.id}`);
    }
    const index = fact.evidenceSequence - 1;
    const streamEvent = this.streamEvents[index];
    if (!streamEvent || hashJson(streamEvent) !== hashJson(fact.auditEvent)) {
      throw new Error(`CanopyProof E3b event position is invalid: ${fact.id}`);
    }
    const replayed = appendCanopyProofAuditEvent(this.streamEvents.slice(0, index), {
      action,
      actor: fact.auditEvent.actor,
      entityType,
      entityId: fact.id,
      payload,
      createdAt: fact.auditEvent.createdAt,
      rationale,
    }).at(-1)!;
    if (hashJson(replayed) !== hashJson(fact.auditEvent)) {
      throw new Error(`CanopyProof E3b semantic event is invalid: ${fact.id}`);
    }
  }

  private appendEvent(input: Parameters<typeof appendCanopyProofAuditEvent>[1]) {
    const event = appendCanopyProofAuditEvent(this.streamEvents, input).at(-1)!;
    this.streamEvents = [...this.streamEvents, event];
    return event;
  }

  private nextLineage() {
    return {
      evidenceSequence: this.streamEvents.length + 1,
      previousEventRoot: this.streamEvents.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    };
  }

  private extractionsForObject(objectId: string) {
    return (this.extractionIdsByObjectId.get(objectId) ?? [])
      .map((id) => this.getMetadataExtraction(id))
      .sort((left, right) => left.extractionSequence - right.extractionSequence || left.id.localeCompare(right.id));
  }

  private decisionsForSource(sourceKey: string) {
    return (this.decisionIdsBySource.get(sourceKey) ?? [])
      .map((id) => this.getRetentionDecision(id))
      .sort((left, right) => left.decisionSequence - right.decisionSequence || left.id.localeCompare(right.id));
  }

  private executionsForSource(sourceKey: string) {
    return (this.executionIdsBySource.get(sourceKey) ?? [])
      .map((id) => this.getRetentionExecution(id))
      .sort((left, right) => left.executionSequence - right.executionSequence || left.id.localeCompare(right.id));
  }

  private describeKnownSource(sourceType: CanopyProofEvidenceRetentionSourceType, sourceId: string) {
    if (sourceType === "metadata_extraction") return describeSource(this.getMetadataExtraction(sourceId));
    const decision = this.decisionsForSource(retentionSourceKey(sourceType, sourceId)).at(-1);
    if (!decision) throw new Error(`CanopyProof retention source is not known: ${sourceType}:${sourceId}`);
    return {
      organizationId: decision.organizationId,
      projectId: decision.projectId,
      evidenceId: decision.evidenceId,
      sourceType: decision.sourceType,
      sourceId: decision.sourceId,
      sourceRoot: decision.sourceRoot,
    };
  }
}

export function canopyProofEvidenceMetadataRetentionSafetyBoundary():
CanopyProofEvidenceMetadataRetentionSafetyBoundary {
  return {
    appendOnly: true,
    organizationBound: true,
    projectBound: true,
    evidenceBound: true,
    subjectBound: true,
    mediaObjectBound: true,
    mediaProjectionBound: true,
    consentBound: true,
    deviceBound: true,
    semanticEventBound: true,
    metadataMinimizedByDefault: true,
    noRawExif: true,
    noRawGps: true,
    noPreciseLocation: true,
    noProviderCredential: true,
    humanRetentionAuthorityRequired: true,
    providerVerificationRequiredForCompletedExecution: true,
    legalHoldBlocksDisposal: true,
    notFinalProofAuthority: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

function assertMetadataAuthority(
  objectId: string,
  extractedAt: string,
  authority: CanopyProofEvidenceMetadataExtractionAuthority,
) {
  const { intent, object, mediaProjection, consent, consentProjection, device, deviceProjection } = authority;
  assertCanopyProofEffectiveMediaObjectProjection({
    baseProjection: authority.baseMediaProjection,
    adapterTrustProjection: authority.mediaAdapterTrustProjection,
    ...(isCanopyProofEffectiveDeviceAttestationProjection(deviceProjection)
      ? { deviceTrustProjection: deviceProjection }
      : {}),
    effectiveProjection: mediaProjection,
  });
  if (
    object.id !== objectId ||
    object.intentId !== intent.id ||
    object.evidenceId !== intent.evidenceId ||
    object.organizationId !== intent.organizationId ||
    mediaProjection.objectId !== object.id ||
    mediaProjection.objectRoot !== object.objectRoot ||
    mediaProjection.organizationId !== object.organizationId ||
    mediaProjection.projectId !== object.projectId ||
    mediaProjection.evidenceId !== object.evidenceId ||
    mediaProjection.evaluatedAt !== extractedAt ||
    !["available", "needs_review"].includes(mediaProjection.state) ||
    consent.id !== intent.consentReceiptId ||
    consent.receiptRoot !== intent.consentReceiptRoot ||
    consent.subjectId !== intent.subjectId ||
    consentProjection.receiptId !== consent.id ||
    consentProjection.receiptRoot !== consent.receiptRoot ||
    consentProjection.evaluatedAt !== extractedAt ||
    consentProjection.state !== "active" ||
    device.id !== intent.deviceAttestationId ||
    device.attestationRoot !== intent.deviceAttestationRoot ||
    device.subjectId !== intent.subjectId ||
    device.consentReceiptId !== consent.id ||
    deviceProjection.attestationId !== device.id ||
    deviceProjection.attestationRoot !== device.attestationRoot ||
    deviceProjection.evaluatedAt !== extractedAt ||
    !["current", "needs_review"].includes(deviceProjection.state) ||
    !consent.purposes.includes("media_upload") ||
    !consent.purposes.includes("geolocation")
  ) {
    throw new Error("CanopyProof metadata extraction requires exact available media, consent, and device authority.");
  }
}

function assertRetentionAuthority(
  source: ReturnType<typeof describeSource>,
  authority: CanopyProofEvidenceRetentionDecisionAuthority,
  evaluatedAt: string,
) {
  if (
    authority.intent.evidenceId !== source.evidenceId ||
    authority.intent.organizationId !== source.organizationId ||
    authority.intent.projectId !== source.projectId ||
    authority.consent.id !== authority.intent.consentReceiptId ||
    authority.consent.receiptRoot !== authority.intent.consentReceiptRoot ||
    authority.consent.subjectId !== authority.intent.subjectId ||
    authority.consentProjection.receiptId !== authority.consent.id ||
    authority.consentProjection.receiptRoot !== authority.consent.receiptRoot ||
    authority.consentProjection.organizationId !== source.organizationId ||
    authority.consentProjection.subjectId !== authority.intent.subjectId ||
    authority.consentProjection.evaluatedAt !== evaluatedAt
  ) {
    throw new Error("CanopyProof retention decision consent or source authority mismatch.");
  }
}

function assertRetentionPolicy(
  input: z.infer<typeof retentionDecisionInputSchema>,
  authority: CanopyProofEvidenceRetentionDecisionAuthority,
  source: ReturnType<typeof describeSource>,
) {
  const deadline = consentRetentionDeadline(authority.consent);
  const state = authority.consentProjection.state;
  if (input.basis === "revoked_consent" && state !== "revoked") {
    throw new Error("CanopyProof revoked-consent retention basis requires a revoked consent projection.");
  }
  if (input.basis === "expired_consent" && state !== "expired") {
    throw new Error("CanopyProof expired-consent retention basis requires an expired consent projection.");
  }
  if (input.basis === "legal_hold" && input.disposition !== "legal_hold") {
    throw new Error("CanopyProof legal-hold basis requires legal-hold disposition.");
  }
  if (input.disposition === "legal_hold" && input.basis !== "legal_hold") {
    throw new Error("CanopyProof legal-hold disposition requires legal-hold basis.");
  }
  if (input.disposition === "retain" && state !== "active") {
    throw new Error("CanopyProof retention cannot continue after consent expires or is revoked without legal hold.");
  }
  if (input.disposition === "retain" && input.retainUntil && Date.parse(input.retainUntil) > Date.parse(deadline)) {
    throw new Error("CanopyProof retention deadline cannot exceed the consent retention window.");
  }
  if (
    input.basis === "consent_retention" &&
    input.disposition === "tombstone_after_retention" &&
    Date.parse(input.evaluatedAt) < Date.parse(deadline)
  ) {
    throw new Error("CanopyProof retention-window disposal cannot be authorized before the deadline.");
  }
  if (source.sourceType === "metadata_extraction" && input.disposition === "retain" && state !== "active") {
    throw new Error("CanopyProof extracted metadata cannot outlive active consent without legal hold.");
  }
}

function assertExecutionTiming(
  input: z.infer<typeof retentionExecutionInputSchema>,
  decision: CanopyProofEvidenceRetentionDecisionFact,
  object: CanopyProofEvidenceMediaObjectFact,
) {
  if (input.result !== "completed" || input.operation !== "tombstone") return;
  const barriers = [decision.retainUntil, object.retainUntil].filter((value): value is string => Boolean(value));
  if (barriers.some((barrier) => Date.parse(input.executedAt) < Date.parse(barrier))) {
    throw new Error("CanopyProof disposal cannot complete before retention or object-lock barriers expire.");
  }
}

function normalizeAgent(input: CanopyProofEvidenceMediaAgentSnapshot, capability: CanopyProofEvidenceMediaAgentCapability) {
  const parsed = agentSchema.parse(input);
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: normalizeHash(parsed.participantRoot),
    organizationRoot: normalizeHash(parsed.organizationRoot),
    agentType: parsed.agentType,
    agentStatus: parsed.agentStatus,
    capability: parsed.capability as CanopyProofEvidenceMediaAgentCapability,
    agentRegistryHash: normalizeHash(parsed.agentRegistryHash),
  };
  if (normalized.capability !== capability) {
    throw new Error(`CanopyProof E3b agent lacks ${capability} capability.`);
  }
  const authorityRoot = canopyProofEvidenceMediaAgentAuthorityRoot(normalized);
  if (authorityRoot !== normalizeHash(parsed.authorityRoot)) {
    throw new Error("CanopyProof E3b agent authority root is invalid.");
  }
  return { ...normalized, authorityRoot } satisfies CanopyProofEvidenceMediaAgentSnapshot;
}

function normalizeRetentionDecider(input: CanopyProofVerificationActorSnapshot) {
  const parsed = deciderSchema.parse(input);
  const accreditationScope = canonicalStrings(parsed.accreditationScope);
  if (!accreditationScope.includes("evidence_retention_governance")) {
    throw new Error("CanopyProof retention decision requires evidence_retention_governance accreditation.");
  }
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: normalizeHash(parsed.participantRoot),
    organizationRoot: normalizeHash(parsed.organizationRoot),
    membershipId: parsed.membershipId,
    membershipStatus: parsed.membershipStatus,
    membershipRoot: normalizeHash(parsed.membershipRoot),
    accreditationId: parsed.accreditationId,
    accreditationStatus: parsed.accreditationStatus,
    accreditationRoot: normalizeHash(parsed.accreditationRoot),
    accreditationScope,
  } as const;
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized });
  if (authorityRoot !== normalizeHash(parsed.authorityRoot)) {
    throw new Error("CanopyProof retention decider authority root is invalid.");
  }
  return { ...normalized, authorityRoot } satisfies CanopyProofVerificationActorSnapshot;
}

function assertAgentOrganization(agent: CanopyProofEvidenceMediaAgentSnapshot, organizationId: string) {
  if (agent.organizationId !== organizationId) throw new Error("CanopyProof E3b agent organization mismatch.");
}

function assertLocationDisclosure(
  privacyMode: CanopyProofEvidenceConsentReceiptFact["privacyMode"],
  disclosure: CanopyProofEvidenceMetadataLocationDisclosure,
) {
  if (privacyMode === "restricted" && disclosure !== "none") {
    throw new Error("CanopyProof restricted consent forbids location disclosure.");
  }
  if (privacyMode === "masked" && disclosure === "coarse_cell_hash") {
    throw new Error("CanopyProof masked consent permits only a region commitment.");
  }
}

function metadataIssueCodes(
  input: z.infer<typeof metadataExtractionInputSchema>,
  mediaProjectionState: CanopyProofEffectiveMediaObjectProjection["state"],
  deviceProjectionState:
    | CanopyProofEvidenceDeviceAttestationProjection["state"]
    | CanopyProofEffectiveDeviceAttestationProjection["state"],
) {
  const issues: string[] = [];
  issues.push("metadata_provider_verification_pending");
  if (mediaProjectionState !== "available") issues.push("media_custody_verification_pending");
  if (deviceProjectionState !== "current") issues.push("device_attestation_verification_pending");
  if (input.accuracyBand === "over_50m" || input.accuracyBand === "unknown") {
    issues.push("gps_accuracy_needs_review");
  }
  if (input.clockSkewBand === "over_5m") issues.push("device_clock_skew_needs_review");
  return issues.sort();
}

function metadataCapability(): CanopyProofEvidenceMediaAgentCapability {
  return "metadata_extraction_receipt";
}

function retentionExecutionCapability(state: "modeled_only" | "verified"):
CanopyProofEvidenceMediaAgentCapability {
  return state === "verified" ? "verified_retention_execution_receipt" : "retention_execution_receipt";
}

function metadataExtractionAction(): CanopyProofAuditEvent["action"] {
  return "REASON";
}

function retentionDecisionAction(disposition: CanopyProofEvidenceRetentionDisposition): CanopyProofAuditEvent["action"] {
  return disposition === "retain" ? "REASON" : "CHALLENGE";
}

function retentionExecutionAction(
  result: CanopyProofEvidenceRetentionExecutionResult,
  verification: "modeled_only" | "verified",
): CanopyProofAuditEvent["action"] {
  if (result !== "completed") return "CHALLENGE";
  return verification === "verified" ? "FULFILL" : "REASON";
}

function operationForDisposition(
  disposition: CanopyProofEvidenceRetentionDisposition,
): CanopyProofEvidenceRetentionOperation {
  if (disposition === "tombstone_after_retention") return "tombstone";
  if (disposition === "legal_hold") return "apply_legal_hold";
  return disposition;
}

function retentionProjectionState(
  decision: CanopyProofEvidenceRetentionDecisionFact | undefined,
  execution: CanopyProofEvidenceRetentionExecutionFact | undefined,
): CanopyProofEvidenceRetentionProjectionState {
  if (!decision) return "no_decision";
  if (execution?.result === "blocked") return "execution_blocked";
  if (execution?.result === "failed") return "execution_failed";
  const verified = execution?.result === "completed" && execution.providerVerificationState === "verified";
  if (decision.disposition === "retain") return verified ? "retained" : "retention_pending";
  if (decision.disposition === "minimize") return verified ? "minimized" : "minimization_pending";
  if (decision.disposition === "tombstone_after_retention") return verified ? "disposed" : "disposal_pending";
  return verified ? "legal_hold" : "legal_hold_pending";
}

function describeSource(source: CanopyProofEvidenceRetentionSource) {
  if (source.factType === "evidence_media_object") {
    return {
      sourceType: "media_object" as const,
      sourceId: source.id,
      sourceRoot: source.objectRoot,
      organizationId: source.organizationId,
      projectId: source.projectId,
      evidenceId: source.evidenceId,
    };
  }
  return {
    sourceType: "metadata_extraction" as const,
    sourceId: source.id,
    sourceRoot: source.extractionRoot,
    organizationId: source.organizationId,
    projectId: source.projectId,
    evidenceId: source.evidenceId,
  };
}

function retentionSourceKey(sourceType: CanopyProofEvidenceRetentionSourceType, sourceId: string) {
  return `${sourceType}:${sourceId}`;
}

function consentRetentionDeadline(consent: CanopyProofEvidenceConsentReceiptFact) {
  return new Date(Date.parse(consent.grantedAt) + consent.retentionDays * 86_400_000).toISOString();
}

function metadataExtractionGenesis(objectId: string) {
  return hashJson({ kind: "canopyproof-evidence-metadata-extraction-genesis-v1", objectId });
}

function retentionDecisionGenesis(source: ReturnType<typeof describeSource>) {
  return hashJson({
    kind: "canopyproof-evidence-retention-decision-genesis-v1",
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceRoot: source.sourceRoot,
  });
}

function retentionExecutionGenesis(source: ReturnType<typeof describeSource>) {
  return hashJson({
    kind: "canopyproof-evidence-retention-execution-genesis-v1",
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceRoot: source.sourceRoot,
  });
}

function metadataExtractionCommandSeed(fact: CanopyProofEvidenceMetadataExtractionFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    evidenceId: fact.evidenceId,
    objectId: fact.objectId,
    objectRoot: fact.objectRoot,
    mediaProjectionState: fact.mediaProjectionState,
    mediaProjectionRoot: fact.mediaProjectionRoot,
    subjectId: fact.subjectId,
    consentReceiptId: fact.consentReceiptId,
    consentReceiptRoot: fact.consentReceiptRoot,
    consentProjectionRoot: fact.consentProjectionRoot,
    deviceAttestationId: fact.deviceAttestationId,
    deviceAttestationRoot: fact.deviceAttestationRoot,
    deviceProjectionRoot: fact.deviceProjectionRoot,
    privacyMode: fact.privacyMode,
    extractorName: fact.extractorName,
    extractorVersion: fact.extractorVersion,
    extractorImageDigest: fact.extractorImageDigest,
    metadataSchemaVersion: fact.metadataSchemaVersion,
    exifHash: fact.exifHash,
    gpsHash: fact.gpsHash,
    metadataOutputRoot: fact.metadataOutputRoot,
    locationDisclosure: fact.locationDisclosure,
    ...(fact.generalizedLocationHash ? { generalizedLocationHash: fact.generalizedLocationHash } : {}),
    accuracyBand: fact.accuracyBand,
    clockSkewBand: fact.clockSkewBand,
    issueCodes: fact.issueCodes,
    extractionState: fact.extractionState,
    providerReceiptHash: fact.providerReceiptHash,
    providerVerificationState: fact.providerVerificationState,
    observedAt: fact.observedAt,
    extractedAt: fact.extractedAt,
    agent: fact.agent,
    extractionSequence: fact.extractionSequence,
    previousExtractionRoot: fact.previousExtractionRoot,
  };
}

function metadataExtractionFactSeed(fact: CanopyProofEvidenceMetadataExtractionFact) {
  return {
    id: fact.id,
    ...metadataExtractionCommandSeed(fact),
    commandHash: fact.commandHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function metadataExtractionRoot(
  fact: ReturnType<typeof metadataExtractionFactSeed> & { readonly extractionHash: string },
) {
  return hashJson({
    kind: "canopyproof-evidence-metadata-extraction-root-v1",
    objectRoot: fact.objectRoot,
    mediaProjectionRoot: fact.mediaProjectionRoot,
    consentReceiptRoot: fact.consentReceiptRoot,
    deviceAttestationRoot: fact.deviceAttestationRoot,
    metadataOutputRoot: fact.metadataOutputRoot,
    extractionSequence: fact.extractionSequence,
    previousExtractionRoot: fact.previousExtractionRoot,
    commandHash: fact.commandHash,
    extractionHash: fact.extractionHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  });
}

function retentionDecisionCommandSeed(fact: CanopyProofEvidenceRetentionDecisionFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    evidenceId: fact.evidenceId,
    subjectId: fact.subjectId,
    sourceType: fact.sourceType,
    sourceId: fact.sourceId,
    sourceRoot: fact.sourceRoot,
    consentReceiptId: fact.consentReceiptId,
    consentReceiptRoot: fact.consentReceiptRoot,
    consentProjectionState: fact.consentProjectionState,
    consentProjectionRoot: fact.consentProjectionRoot,
    retentionDeadline: fact.retentionDeadline,
    basis: fact.basis,
    disposition: fact.disposition,
    ...(fact.retainUntil ? { retainUntil: fact.retainUntil } : {}),
    ...(fact.legalHoldRoot ? { legalHoldRoot: fact.legalHoldRoot } : {}),
    policyId: fact.policyId,
    rationaleHash: fact.rationaleHash,
    decidedBy: fact.decidedBy,
    decider: fact.decider,
    evaluatedAt: fact.evaluatedAt,
    decisionSequence: fact.decisionSequence,
    previousDecisionRoot: fact.previousDecisionRoot,
  };
}

function retentionDecisionFactSeed(fact: CanopyProofEvidenceRetentionDecisionFact) {
  return {
    id: fact.id,
    ...retentionDecisionCommandSeed(fact),
    commandHash: fact.commandHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function retentionDecisionRoot(
  fact: ReturnType<typeof retentionDecisionFactSeed> & { readonly decisionHash: string },
) {
  return hashJson({
    kind: "canopyproof-evidence-retention-decision-root-v1",
    sourceType: fact.sourceType,
    sourceRoot: fact.sourceRoot,
    consentReceiptRoot: fact.consentReceiptRoot,
    consentProjectionRoot: fact.consentProjectionRoot,
    disposition: fact.disposition,
    decisionSequence: fact.decisionSequence,
    previousDecisionRoot: fact.previousDecisionRoot,
    deciderAuthorityRoot: fact.decider.authorityRoot,
    commandHash: fact.commandHash,
    decisionHash: fact.decisionHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  });
}

function retentionExecutionCommandSeed(fact: CanopyProofEvidenceRetentionExecutionFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    evidenceId: fact.evidenceId,
    subjectId: fact.subjectId,
    sourceType: fact.sourceType,
    sourceId: fact.sourceId,
    sourceRoot: fact.sourceRoot,
    decisionId: fact.decisionId,
    decisionRoot: fact.decisionRoot,
    operation: fact.operation,
    result: fact.result,
    storageProvider: fact.storageProvider,
    providerNamespace: fact.providerNamespace,
    providerReceiptHash: fact.providerReceiptHash,
    providerVerificationState: fact.providerVerificationState,
    resultingRoot: fact.resultingRoot,
    reasonHashes: fact.reasonHashes,
    executedAt: fact.executedAt,
    agent: fact.agent,
    executionSequence: fact.executionSequence,
    previousExecutionRoot: fact.previousExecutionRoot,
  };
}

function retentionExecutionFactSeed(fact: CanopyProofEvidenceRetentionExecutionFact) {
  return {
    id: fact.id,
    ...retentionExecutionCommandSeed(fact),
    commandHash: fact.commandHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function retentionExecutionRoot(
  fact: ReturnType<typeof retentionExecutionFactSeed> & { readonly executionHash: string },
) {
  return hashJson({
    kind: "canopyproof-evidence-retention-execution-root-v1",
    sourceType: fact.sourceType,
    sourceRoot: fact.sourceRoot,
    decisionRoot: fact.decisionRoot,
    operation: fact.operation,
    result: fact.result,
    providerVerificationState: fact.providerVerificationState,
    resultingRoot: fact.resultingRoot,
    executionSequence: fact.executionSequence,
    previousExecutionRoot: fact.previousExecutionRoot,
    commandHash: fact.commandHash,
    executionHash: fact.executionHash,
    evidenceSequence: fact.evidenceSequence,
    previousEventRoot: fact.previousEventRoot,
  });
}

function validateStreamEvents(events: readonly CanopyProofAuditEvent[]) {
  const copy = [...events];
  const terminal = copy.at(-1);
  if (terminal && !verifyCanopyProofAuditChain(copy, terminal.createdAt).valid) {
    throw new Error("CanopyProof E3b semantic event stream is invalid.");
  }
  return copy;
}

function canonicalHashes(values: readonly string[]) {
  const normalized = values.map(normalizeHash);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("CanopyProof E3b hash set must be unique.");
  }
  return normalized.sort();
}

function canonicalStrings(values: readonly string[]) {
  const normalized = values.map((value) => value.trim());
  if (new Set(normalized).size !== normalized.length || normalized.some((value) => !value)) {
    throw new Error("CanopyProof E3b string set must be unique and non-empty.");
  }
  return normalized.sort();
}

function normalizeHash(value: string) {
  return value.toLowerCase().replace(/^sha256:/, "");
}

function sortedFacts<T extends { readonly evidenceSequence: number; readonly id: string }>(values: Iterable<T>) {
  return [...values].sort(
    (left, right) => left.evidenceSequence - right.evidenceSequence || left.id.localeCompare(right.id),
  );
}

function assertSafeTextMaterial(value: string, label: string) {
  if (
    /(bearer\s+|password|secret|private[_ -]?key|BEGIN [A-Z ]*PRIVATE KEY|https?:\/\/|[?&](token|signature|credential)=)/i.test(
      value,
    ) ||
    /(certified carbon credit|carbon tax offset|guaranteed (rwa )?yield|automatic \$?canopy distribution)/i.test(
      value,
    )
  ) {
    throw new Error(`CanopyProof ${label} contains forbidden credential, endpoint, or claim material.`);
  }
}

function assertMillisecondTimestamp(value: string, label: string) {
  if (new Date(value).toISOString() !== value) {
    throw new Error(`CanopyProof ${label} must be canonical millisecond UTC.`);
  }
}
