import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  assertCanopyProofEffectiveMediaObjectProjection,
} from "./evidence-media-adapter-authority.js";
import { isCanopyProofEffectiveDeviceAttestationProjection } from
  "./evidence-device-attestation-adapter-authority.js";
import type {
  CanopyProofEvidenceMetadataExtractionAuthority,
} from "./evidence-metadata-retention-authority.js";
import {
  canopyProofEvidenceMediaAgentAuthorityRoot,
  type CanopyProofEvidenceMediaAgentSnapshot,
} from "./evidence-media-authority.js";
import type { CanopyProofMetadataExtractorPolicyDescriptor } from
  "./metadata-extractor-adapter.js";
import {
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export type CanopyProofMetadataExtractionRequestSafetyBoundary = {
  readonly appendOnly: true;
  readonly organizationBound: true;
  readonly objectBound: true;
  readonly effectiveMediaProjectionBound: true;
  readonly consentProjectionBound: true;
  readonly deviceProjectionBound: true;
  readonly extractorPolicyBound: true;
  readonly signerSetBound: true;
  readonly semanticEventBound: true;
  readonly commandReceiptBound: true;
  readonly externalIoAfterCommitOnly: true;
  readonly dispatchExpiryBound: true;
  readonly noRawExif: true;
  readonly noRawGps: true;
  readonly noPreciseLocation: true;
  readonly noRawSignature: true;
  readonly noProviderCredential: true;
  readonly notExtractionSuccess: true;
  readonly notFinalProofAuthority: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofMetadataExtractionRequestFact = {
  readonly factType: "evidence_metadata_extraction_request";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly evidenceId: string;
  readonly objectId: string;
  readonly objectRoot: string;
  readonly baseMediaProjectionRoot: string;
  readonly mediaAdapterTrustProjectionRoot: string;
  readonly mediaProjectionRoot: string;
  readonly consentReceiptId: string;
  readonly consentReceiptRoot: string;
  readonly consentProjectionRoot: string;
  readonly deviceAttestationId: string;
  readonly deviceAttestationRoot: string;
  readonly deviceProjectionRoot: string;
  readonly registeredGpsHash: string;
  readonly privacyMode: "precise" | "masked" | "restricted";
  readonly extractorId: string;
  readonly extractorName: string;
  readonly extractorVersion: string;
  readonly extractorImageDigest: string;
  readonly metadataSchemaVersion: string;
  readonly extractorPolicyRoot: string;
  readonly signerSetRoot: string;
  readonly maximumObservationAgeSeconds: number;
  readonly requestedBy: string;
  readonly requester: CanopyProofEvidenceMediaAgentSnapshot;
  readonly requestedAt: string;
  readonly dispatchExpiresAt: string;
  readonly idempotencyKeyHash: string;
  readonly requestHash: string;
  readonly commandHash: string;
  readonly evidenceSequence: number;
  readonly previousEventRoot: string;
  readonly commandReceiptId: string;
  readonly requestRoot: string;
  readonly safety: CanopyProofMetadataExtractionRequestSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const boundedTextSchema = z.string().trim().min(1).max(100);
const canonicalTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).toISOString() === value);
const policySchema = z
  .object({
    extractorId: identifierSchema,
    extractorName: boundedTextSchema,
    extractorVersion: boundedTextSchema,
    extractorImageDigest: hashSchema,
    metadataSchemaVersion: boundedTextSchema,
    extractorPolicyRoot: hashSchema,
    signerSetRoot: hashSchema,
    maximumObservationAgeSeconds: z.number().int().min(86_400).max(366 * 86_400),
  })
  .strict();

export const canopyProofMetadataExtractionDispatchWindowMilliseconds = 5 * 60 * 1_000;

export function canopyProofMetadataExtractionRequestSafetyBoundary():
CanopyProofMetadataExtractionRequestSafetyBoundary {
  return {
    appendOnly: true,
    organizationBound: true,
    objectBound: true,
    effectiveMediaProjectionBound: true,
    consentProjectionBound: true,
    deviceProjectionBound: true,
    extractorPolicyBound: true,
    signerSetBound: true,
    semanticEventBound: true,
    commandReceiptBound: true,
    externalIoAfterCommitOnly: true,
    dispatchExpiryBound: true,
    noRawExif: true,
    noRawGps: true,
    noPreciseLocation: true,
    noRawSignature: true,
    noProviderCredential: true,
    notExtractionSuccess: true,
    notFinalProofAuthority: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

export function buildCanopyProofMetadataExtractionRequestFact(
  input: Readonly<{
    authority: CanopyProofEvidenceMetadataExtractionAuthority;
    policy: CanopyProofMetadataExtractorPolicyDescriptor;
    idempotencyKeyHash: string;
    streamEvents: readonly CanopyProofAuditEvent[];
    requestedAt: string;
  }>,
): CanopyProofMetadataExtractionRequestFact {
  const requestedAt = canonicalTimestampSchema.parse(input.requestedAt);
  const policy = policySchema.parse(input.policy);
  const idempotencyKeyHash = hashSchema.parse(input.idempotencyKeyHash);
  const dispatchExpiresAt = new Date(
    Date.parse(requestedAt) + canopyProofMetadataExtractionDispatchWindowMilliseconds,
  ).toISOString();
  assertRequestAuthority(input.authority, requestedAt);
  assertRequestStream(input.streamEvents, requestedAt);
  const authority = input.authority;
  const requester = normalizeRequester(authority.agent, authority.object.organizationId);
  const requestSeed = {
    organizationId: authority.object.organizationId,
    projectId: authority.object.projectId,
    evidenceId: authority.object.evidenceId,
    objectId: authority.object.id,
    objectRoot: authority.object.objectRoot,
    baseMediaProjectionRoot: authority.baseMediaProjection.projectionRoot,
    mediaAdapterTrustProjectionRoot: authority.mediaAdapterTrustProjection.projectionRoot,
    mediaProjectionRoot: authority.mediaProjection.projectionRoot,
    consentReceiptId: authority.consent.id,
    consentReceiptRoot: authority.consent.receiptRoot,
    consentProjectionRoot: authority.consentProjection.projectionRoot,
    deviceAttestationId: authority.device.id,
    deviceAttestationRoot: authority.device.attestationRoot,
    deviceProjectionRoot: authority.deviceProjection.projectionRoot,
    registeredGpsHash: hashSchema.parse(authority.registeredGpsHash),
    privacyMode: authority.consent.privacyMode,
    ...policy,
    requestedBy: requester.id,
    requester,
    requestedAt,
    dispatchExpiresAt,
  } as const;
  const requestHash = hashJson({
    kind: "canopyproof-metadata-extraction-request-v1",
    ...requestSeed,
  });
  const commandHash = hashJson({
    kind: "canopyproof-metadata-extraction-request-command-v1",
    requestHash,
    idempotencyKeyHash,
    requestedBy: requester.id,
    requesterAuthorityRoot: requester.authorityRoot,
  });
  const id = `cp_metadata_request_${commandHash.slice(0, 24)}`;
  const previousEventRoot = input.streamEvents.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
  const eventSeed = {
    action: "REASON" as const,
    actor: requester.id,
    entityType: "metadata_extraction_request" as const,
    entityId: id,
    previousRoot: previousEventRoot,
    payloadHash: requestHash,
    createdAt: requestedAt,
    rationale: "A minimized metadata-extraction request was durably authorized before provider I/O.",
  };
  const eventRoot = hashJson({ kind: "canopyproof-audit-event-v1", ...eventSeed });
  const auditEvent = {
    id: `cp_audit_${eventRoot.slice(0, 24)}`,
    ...eventSeed,
    eventRoot,
  } satisfies CanopyProofAuditEvent;
  const commandReceiptId = `cp_e3d_request_command_${hashJson({
    requestedBy: requester.id,
    idempotencyKeyHash,
  }).slice(0, 24)}`;
  const safety = canopyProofMetadataExtractionRequestSafetyBoundary();
  const requestRoot = hashJson({
    kind: "canopyproof-metadata-extraction-request-root-v1",
    requestHash,
    commandHash,
    auditEventRoot: auditEvent.eventRoot,
    commandReceiptId,
    safety,
  });
  return {
    factType: "evidence_metadata_extraction_request",
    id,
    ...requestSeed,
    idempotencyKeyHash,
    requestHash,
    commandHash,
    evidenceSequence: input.streamEvents.length + 1,
    previousEventRoot,
    commandReceiptId,
    requestRoot,
    safety,
    auditEvent,
  };
}

export function assertCanopyProofMetadataExtractionRequestFact(
  input: Readonly<{
    authority: CanopyProofEvidenceMetadataExtractionAuthority;
    policy: CanopyProofMetadataExtractorPolicyDescriptor;
    fact: CanopyProofMetadataExtractionRequestFact;
    streamEventsBefore: readonly CanopyProofAuditEvent[];
  }>,
) {
  const expected = buildCanopyProofMetadataExtractionRequestFact({
    authority: input.authority,
    policy: input.policy,
    idempotencyKeyHash: input.fact.idempotencyKeyHash,
    streamEvents: input.streamEventsBefore,
    requestedAt: input.fact.requestedAt,
  });
  if (hashJson(expected) !== hashJson(input.fact)) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTION_REQUEST_FACT_INVALID");
  }
  return input.fact;
}

function assertRequestAuthority(
  authority: CanopyProofEvidenceMetadataExtractionAuthority,
  requestedAt: string,
) {
  assertCanopyProofEffectiveMediaObjectProjection({
    baseProjection: authority.baseMediaProjection,
    adapterTrustProjection: authority.mediaAdapterTrustProjection,
    ...(isCanopyProofEffectiveDeviceAttestationProjection(authority.deviceProjection)
      ? { deviceTrustProjection: authority.deviceProjection }
      : {}),
    effectiveProjection: authority.mediaProjection,
  });
  if (
    authority.object.intentId !== authority.intent.id ||
    authority.object.intentRoot !== authority.intent.intentRoot ||
    authority.object.organizationId !== authority.intent.organizationId ||
    authority.object.projectId !== authority.intent.projectId ||
    authority.object.evidenceId !== authority.intent.evidenceId ||
    authority.mediaProjection.objectId !== authority.object.id ||
    authority.mediaProjection.objectRoot !== authority.object.objectRoot ||
    authority.mediaProjection.evaluatedAt !== requestedAt ||
    authority.mediaProjection.state !== "available" ||
    authority.consent.id !== authority.intent.consentReceiptId ||
    authority.consent.receiptRoot !== authority.intent.consentReceiptRoot ||
    authority.consent.subjectId !== authority.intent.subjectId ||
    authority.consentProjection.receiptId !== authority.consent.id ||
    authority.consentProjection.receiptRoot !== authority.consent.receiptRoot ||
    authority.consentProjection.evaluatedAt !== requestedAt ||
    authority.consentProjection.state !== "active" ||
    authority.device.id !== authority.intent.deviceAttestationId ||
    authority.device.attestationRoot !== authority.intent.deviceAttestationRoot ||
    authority.device.subjectId !== authority.intent.subjectId ||
    authority.device.consentReceiptId !== authority.consent.id ||
    authority.deviceProjection.attestationId !== authority.device.id ||
    authority.deviceProjection.attestationRoot !== authority.device.attestationRoot ||
    authority.deviceProjection.evaluatedAt !== requestedAt ||
    authority.deviceProjection.state !== "current" ||
    !authority.consent.purposes.includes("media_upload") ||
    !authority.consent.purposes.includes("geolocation")
  ) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTION_REQUEST_AUTHORITY_INELIGIBLE");
  }
}

function normalizeRequester(
  requester: CanopyProofEvidenceMediaAgentSnapshot,
  organizationId: string,
) {
  const seed = {
    id: identifierSchema.parse(requester.id),
    participantType: requester.participantType,
    role: requester.role,
    verificationStatus: requester.verificationStatus,
    organizationId: requester.organizationId,
    organizationVerificationStatus: requester.organizationVerificationStatus,
    participantRoot: hashSchema.parse(requester.participantRoot),
    organizationRoot: hashSchema.parse(requester.organizationRoot),
    agentType: requester.agentType,
    agentStatus: requester.agentStatus,
    capability: requester.capability,
    agentRegistryHash: hashSchema.parse(requester.agentRegistryHash),
  };
  if (
    requester.organizationId !== organizationId ||
    requester.participantType !== "agent" ||
    requester.role !== "agent" ||
    requester.verificationStatus !== "verified" ||
    requester.organizationVerificationStatus !== "verified" ||
    requester.agentType !== "evidence" ||
    requester.agentStatus !== "active" ||
    requester.capability !== "metadata_extraction_receipt" ||
    requester.authorityRoot !== canopyProofEvidenceMediaAgentAuthorityRoot(seed)
  ) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTION_REQUEST_ACTOR_INVALID");
  }
  return requester;
}

function assertRequestStream(events: readonly CanopyProofAuditEvent[], requestedAt: string) {
  const terminal = events.at(-1);
  if (terminal && !verifyCanopyProofAuditChain(events, requestedAt).valid) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTION_REQUEST_STREAM_INVALID");
  }
  if (terminal && Date.parse(terminal.createdAt) > Date.parse(requestedAt)) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTION_REQUEST_TIME_REGRESSION");
  }
}
