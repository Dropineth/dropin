import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  isCanopyProofVerifiedMetadataExtractionReceipt,
  type CanopyProofMetadataExtractionReceipt,
  type CanopyProofVerifiedMetadataExtractionReceipt,
} from "./metadata-extractor-adapter.js";
import {
  canopyProofEvidenceMediaAgentAuthorityRoot,
  type CanopyProofEvidenceMediaAgentSnapshot,
  type CanopyProofEvidenceMediaObjectFact,
} from "./evidence-media-authority.js";
import type { CanopyProofEvidenceMetadataExtractionFact } from
  "./evidence-metadata-retention-authority.js";
import {
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export type CanopyProofEvidenceMetadataAdapterSafetyBoundary = Readonly<{
  appendOnly: true;
  organizationBound: true;
  projectBound: true;
  evidenceBound: true;
  objectBound: true;
  extractionBound: true;
  semanticEventBound: true;
  commandReceiptBound: true;
  extractorSignatureVerifiedIndependently: true;
  baseExtractionRemainsModeledOnly: true;
  noRawExif: true;
  noRawGps: true;
  noPreciseLocation: true;
  noRawSignature: true;
  noProviderCredential: true;
  notFinalProofAuthority: true;
  notCertifiedCarbonCredit: true;
  notCarbonTaxOffset: true;
  notFinancialAsset: true;
  notGuaranteedYield: true;
  noMainnetFunds: true;
  notAutomaticCanopyDistribution: true;
}>;

const durableMetadataExtractionReceiptBrand: unique symbol = Symbol(
  "CanopyProofDurableMetadataExtractionReceipt",
);

export type CanopyProofDurableMetadataExtractionReceipt = Omit<
  CanopyProofMetadataExtractionReceipt,
  "signature"
> & {
  readonly extractorPolicyRoot: string;
  readonly verifiedAt: string;
  readonly signatureHash: string;
  readonly adapterVerificationRoot: string;
  readonly [durableMetadataExtractionReceiptBrand]: true;
};

export type CanopyProofEvidenceMetadataExtractionVerificationFact = Readonly<{
  factType: "evidence_metadata_extraction_receipt_verification";
  id: string;
  organizationId: string;
  projectId: string;
  evidenceId: string;
  objectId: string;
  objectRoot: string;
  extractionId: string;
  extractionRoot: string;
  verifierId: string;
  verifier: CanopyProofEvidenceMediaAgentSnapshot;
  extractorId: string;
  signerKeyId: string;
  signatureAlgorithm: "ed25519";
  signatureHash: string;
  extractorPolicyRoot: string;
  metadataReceiptHash: string;
  adapterVerificationRoot: string;
  verifiedAt: string;
  verificationRoot: string;
  commandHash: string;
  evidenceSequence: number;
  previousEventRoot: string;
  commandReceiptId: string;
  factRoot: string;
  safety: CanopyProofEvidenceMetadataAdapterSafetyBoundary;
  auditEvent: CanopyProofAuditEvent;
}>;

export type CanopyProofEffectiveMetadataExtractionProjection = Readonly<{
  organizationId: string;
  projectId: string;
  evidenceId: string;
  objectId: string;
  objectRoot: string;
  extractionId: string;
  extractionRoot: string;
  verificationFactId?: string;
  verificationRoot?: string;
  verificationState: "modeled_only" | "verified";
  state: "needs_review" | "accepted";
  issueCodes: readonly string[];
  evaluatedAt: string;
  projectionRoot: string;
  safety: CanopyProofEvidenceMetadataAdapterSafetyBoundary;
}>;

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const canonicalTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).toISOString() === value);

export function canopyProofEvidenceMetadataAdapterSafetyBoundary():
CanopyProofEvidenceMetadataAdapterSafetyBoundary {
  return {
    appendOnly: true,
    organizationBound: true,
    projectBound: true,
    evidenceBound: true,
    objectBound: true,
    extractionBound: true,
    semanticEventBound: true,
    commandReceiptBound: true,
    extractorSignatureVerifiedIndependently: true,
    baseExtractionRemainsModeledOnly: true,
    noRawExif: true,
    noRawGps: true,
    noPreciseLocation: true,
    noRawSignature: true,
    noProviderCredential: true,
    notFinalProofAuthority: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

export function minimizeCanopyProofMetadataExtractionReceipt(
  receipt: CanopyProofVerifiedMetadataExtractionReceipt,
): CanopyProofDurableMetadataExtractionReceipt {
  if (!isCanopyProofVerifiedMetadataExtractionReceipt(receipt)) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_RECEIPT_NOT_ADAPTER_VERIFIED");
  }
  const durable = {
    objectId: receipt.objectId,
    objectRoot: receipt.objectRoot,
    storageProvider: receipt.storageProvider,
    providerNamespace: receipt.providerNamespace,
    objectKey: receipt.objectKey,
    objectVersion: receipt.objectVersion,
    storedObjectProviderReceiptHash: receipt.storedObjectProviderReceiptHash,
    mediaProjectionRoot: receipt.mediaProjectionRoot,
    consentReceiptId: receipt.consentReceiptId,
    consentReceiptRoot: receipt.consentReceiptRoot,
    consentProjectionRoot: receipt.consentProjectionRoot,
    deviceAttestationId: receipt.deviceAttestationId,
    deviceAttestationRoot: receipt.deviceAttestationRoot,
    deviceProjectionRoot: receipt.deviceProjectionRoot,
    registeredGpsHash: receipt.registeredGpsHash,
    privacyMode: receipt.privacyMode,
    extractorId: receipt.extractorId,
    extractorName: receipt.extractorName,
    extractorVersion: receipt.extractorVersion,
    extractorImageDigest: receipt.extractorImageDigest,
    metadataSchemaVersion: receipt.metadataSchemaVersion,
    exifHash: receipt.exifHash,
    gpsHash: receipt.gpsHash,
    metadataOutputRoot: receipt.metadataOutputRoot,
    locationDisclosure: receipt.locationDisclosure,
    ...(receipt.generalizedLocationHash
      ? { generalizedLocationHash: receipt.generalizedLocationHash }
      : {}),
    accuracyBand: receipt.accuracyBand,
    clockSkewBand: receipt.clockSkewBand,
    observedAt: receipt.observedAt,
    extractedAt: receipt.extractedAt,
    signerKeyId: receipt.signerKeyId,
    signatureAlgorithm: receipt.signatureAlgorithm,
    receiptHash: receipt.receiptHash,
    extractorPolicyRoot: receipt.extractorPolicyRoot,
    verifiedAt: receipt.verifiedAt,
    signatureHash: receipt.signatureHash,
    adapterVerificationRoot: receipt.adapterVerificationRoot,
  };
  Object.defineProperty(durable, durableMetadataExtractionReceiptBrand, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
  return Object.freeze(durable) as CanopyProofDurableMetadataExtractionReceipt;
}

export function isCanopyProofDurableMetadataExtractionReceipt(
  value: unknown,
): value is CanopyProofDurableMetadataExtractionReceipt {
  if (!value || typeof value !== "object") return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, durableMetadataExtractionReceiptBrand);
  return (
    descriptor?.value === true &&
    descriptor.enumerable === false &&
    descriptor.configurable === false &&
    descriptor.writable === false &&
    Object.isFrozen(value)
  );
}

export function buildCanopyProofEvidenceMetadataExtractionVerificationFact(
  input: Readonly<{
    object: CanopyProofEvidenceMediaObjectFact;
    extraction: CanopyProofEvidenceMetadataExtractionFact;
    receipt: CanopyProofDurableMetadataExtractionReceipt;
    verifier: CanopyProofEvidenceMediaAgentSnapshot;
    streamEvents: readonly CanopyProofAuditEvent[];
  }>,
): CanopyProofEvidenceMetadataExtractionVerificationFact {
  const verifiedAt = canonicalTimestampSchema.parse(input.receipt.verifiedAt);
  assertVerifier(input.verifier, input.object.organizationId);
  assertStream(input.streamEvents, verifiedAt);
  assertReceiptBinding(input.object, input.extraction, input.receipt);
  const adapterVerificationRoot = hashJson({
    kind: "canopyproof-metadata-extraction-adapter-verification-v1",
    receiptHash: input.receipt.receiptHash,
    extractorId: input.receipt.extractorId,
    signerKeyId: input.receipt.signerKeyId,
    extractorPolicyRoot: input.receipt.extractorPolicyRoot,
    signatureHash: input.receipt.signatureHash,
    verifiedAt,
  });
  if (adapterVerificationRoot !== input.receipt.adapterVerificationRoot) {
    throw new Error("CANOPYPROOF_E3C_ADAPTER_VERIFICATION_ROOT_INVALID");
  }
  const verificationRoot = hashJson({
    kind: "canopyproof-metadata-extraction-receipt-verification-v1",
    metadataReceiptHash: input.receipt.receiptHash,
    extractionRoot: input.extraction.extractionRoot,
    objectRoot: input.object.objectRoot,
    extractorId: input.receipt.extractorId,
    verifierId: input.verifier.id,
    signerKeyId: input.receipt.signerKeyId,
    extractorPolicyRoot: input.receipt.extractorPolicyRoot,
    signatureHash: input.receipt.signatureHash,
    adapterVerificationRoot,
    verifiedAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-metadata-extraction-verification-command-v1",
    extractionId: input.extraction.id,
    extractionRoot: input.extraction.extractionRoot,
    objectId: input.object.id,
    objectRoot: input.object.objectRoot,
    metadataReceiptHash: input.receipt.receiptHash,
    verificationRoot,
    verifierId: input.verifier.id,
    verifierAuthorityRoot: input.verifier.authorityRoot,
    verifiedAt,
  });
  const id = `cp_metadata_verify_${commandHash.slice(0, 24)}`;
  const auditEvent = appendRootBoundEvent(input.streamEvents, {
    actor: input.verifier.id,
    entityId: id,
    payloadHash: verificationRoot,
    createdAt: verifiedAt,
  });
  const commandReceiptId = `cp_e3c_command_${commandHash.slice(0, 24)}`;
  const safety = canopyProofEvidenceMetadataAdapterSafetyBoundary();
  const factRoot = hashJson({
    kind: "canopyproof-metadata-extraction-verification-fact-root-v1",
    commandHash,
    verificationRoot,
    auditEventRoot: auditEvent.eventRoot,
    commandReceiptId,
    safety,
  });
  return {
    factType: "evidence_metadata_extraction_receipt_verification",
    id,
    organizationId: input.extraction.organizationId,
    projectId: input.extraction.projectId,
    evidenceId: input.extraction.evidenceId,
    objectId: input.object.id,
    objectRoot: input.object.objectRoot,
    extractionId: input.extraction.id,
    extractionRoot: input.extraction.extractionRoot,
    verifierId: input.verifier.id,
    verifier: input.verifier,
    extractorId: input.receipt.extractorId,
    signerKeyId: input.receipt.signerKeyId,
    signatureAlgorithm: input.receipt.signatureAlgorithm,
    signatureHash: input.receipt.signatureHash,
    extractorPolicyRoot: input.receipt.extractorPolicyRoot,
    metadataReceiptHash: input.receipt.receiptHash,
    adapterVerificationRoot,
    verifiedAt,
    verificationRoot,
    commandHash,
    evidenceSequence: input.streamEvents.length + 1,
    previousEventRoot: auditEvent.previousRoot,
    commandReceiptId,
    factRoot,
    safety,
    auditEvent,
  };
}

export function projectCanopyProofEvidenceMetadataExtraction(
  input: Readonly<{
    object: CanopyProofEvidenceMediaObjectFact;
    extraction: CanopyProofEvidenceMetadataExtractionFact;
    verification?: CanopyProofEvidenceMetadataExtractionVerificationFact;
    evaluatedAt: string;
  }>,
): CanopyProofEffectiveMetadataExtractionProjection {
  const evaluatedAt = canonicalTimestampSchema.parse(input.evaluatedAt);
  assertBaseBinding(input.object, input.extraction);
  const verification =
    input.verification && Date.parse(input.verification.verifiedAt) <= Date.parse(evaluatedAt)
      ? assertVerificationFact(input.object, input.extraction, input.verification)
      : undefined;
  const issueCodes = canonicalStrings(
    input.extraction.issueCodes.filter(
      (code) => !verification || code !== "metadata_provider_verification_pending",
    ),
  );
  const verificationState = verification ? "verified" : "modeled_only";
  const state = verification && issueCodes.length === 0 ? "accepted" : "needs_review";
  const safety = canopyProofEvidenceMetadataAdapterSafetyBoundary();
  const seed = {
    organizationId: input.extraction.organizationId,
    projectId: input.extraction.projectId,
    evidenceId: input.extraction.evidenceId,
    objectId: input.object.id,
    objectRoot: input.object.objectRoot,
    extractionId: input.extraction.id,
    extractionRoot: input.extraction.extractionRoot,
    ...(verification ? { verificationFactId: verification.id } : {}),
    ...(verification ? { verificationRoot: verification.verificationRoot } : {}),
    verificationState,
    state,
    issueCodes,
    evaluatedAt,
    safety,
  } as const;
  return {
    ...seed,
    projectionRoot: hashJson({
      kind: "canopyproof-effective-metadata-extraction-projection-v1",
      ...seed,
    }),
  };
}

export function assertCanopyProofEvidenceMetadataExtractionVerificationFact(
  object: CanopyProofEvidenceMediaObjectFact,
  extraction: CanopyProofEvidenceMetadataExtractionFact,
  fact: CanopyProofEvidenceMetadataExtractionVerificationFact,
) {
  return assertVerificationFact(object, extraction, fact);
}

function assertReceiptBinding(
  object: CanopyProofEvidenceMediaObjectFact,
  extraction: CanopyProofEvidenceMetadataExtractionFact,
  receipt: CanopyProofDurableMetadataExtractionReceipt,
) {
  if (!isCanopyProofDurableMetadataExtractionReceipt(receipt)) {
    throw new Error("CANOPYPROOF_E3C_RECEIPT_NOT_MINIMIZED_BY_AUTHORITY");
  }
  assertBaseBinding(object, extraction);
  if (
    receipt.objectId !== object.id ||
    receipt.objectRoot !== object.objectRoot ||
    receipt.storageProvider !== object.storageProvider ||
    receipt.providerNamespace !== object.providerNamespace ||
    receipt.objectKey !== object.objectKey ||
    receipt.objectVersion !== object.objectVersion ||
    receipt.storedObjectProviderReceiptHash !== object.providerReceiptHash ||
    receipt.mediaProjectionRoot !== extraction.mediaProjectionRoot ||
    receipt.consentReceiptId !== extraction.consentReceiptId ||
    receipt.consentReceiptRoot !== extraction.consentReceiptRoot ||
    receipt.consentProjectionRoot !== extraction.consentProjectionRoot ||
    receipt.deviceAttestationId !== extraction.deviceAttestationId ||
    receipt.deviceAttestationRoot !== extraction.deviceAttestationRoot ||
    receipt.deviceProjectionRoot !== extraction.deviceProjectionRoot ||
    receipt.registeredGpsHash !== extraction.gpsHash ||
    receipt.privacyMode !== extraction.privacyMode ||
    receipt.extractorName !== extraction.extractorName ||
    receipt.extractorVersion !== extraction.extractorVersion ||
    receipt.extractorImageDigest !== extraction.extractorImageDigest ||
    receipt.metadataSchemaVersion !== extraction.metadataSchemaVersion ||
    receipt.exifHash !== extraction.exifHash ||
    receipt.gpsHash !== extraction.gpsHash ||
    receipt.metadataOutputRoot !== extraction.metadataOutputRoot ||
    receipt.locationDisclosure !== extraction.locationDisclosure ||
    receipt.generalizedLocationHash !== extraction.generalizedLocationHash ||
    receipt.accuracyBand !== extraction.accuracyBand ||
    receipt.clockSkewBand !== extraction.clockSkewBand ||
    receipt.observedAt !== extraction.observedAt ||
    receipt.extractedAt !== extraction.extractedAt ||
    receipt.receiptHash !== extraction.providerReceiptHash ||
    receipt.verifiedAt !== extraction.extractedAt
  ) {
    throw new Error("CANOPYPROOF_E3C_RECEIPT_BINDING_INVALID");
  }
  hashSchema.parse(receipt.extractorPolicyRoot);
  hashSchema.parse(receipt.signatureHash);
  hashSchema.parse(receipt.adapterVerificationRoot);
}

function assertBaseBinding(
  object: CanopyProofEvidenceMediaObjectFact,
  extraction: CanopyProofEvidenceMetadataExtractionFact,
) {
  if (
    extraction.objectId !== object.id ||
    extraction.objectRoot !== object.objectRoot ||
    extraction.organizationId !== object.organizationId ||
    extraction.projectId !== object.projectId ||
    extraction.evidenceId !== object.evidenceId ||
    extraction.providerVerificationState !== "modeled_only" ||
    extraction.extractionState !== "needs_review" ||
    !extraction.issueCodes.includes("metadata_provider_verification_pending")
  ) {
    throw new Error("CANOPYPROOF_E3C_BASE_EXTRACTION_INVALID");
  }
}

function assertVerificationFact(
  object: CanopyProofEvidenceMediaObjectFact,
  extraction: CanopyProofEvidenceMetadataExtractionFact,
  fact: CanopyProofEvidenceMetadataExtractionVerificationFact,
) {
  assertBaseBinding(object, extraction);
  const verifiedAt = canonicalTimestampSchema.parse(fact.verifiedAt);
  assertVerifier(fact.verifier, object.organizationId);
  const verificationRoot = hashJson({
    kind: "canopyproof-metadata-extraction-receipt-verification-v1",
    metadataReceiptHash: fact.metadataReceiptHash,
    extractionRoot: extraction.extractionRoot,
    objectRoot: object.objectRoot,
    extractorId: fact.extractorId,
    verifierId: fact.verifierId,
    signerKeyId: fact.signerKeyId,
    extractorPolicyRoot: fact.extractorPolicyRoot,
    signatureHash: fact.signatureHash,
    adapterVerificationRoot: fact.adapterVerificationRoot,
    verifiedAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-metadata-extraction-verification-command-v1",
    extractionId: extraction.id,
    extractionRoot: extraction.extractionRoot,
    objectId: object.id,
    objectRoot: object.objectRoot,
    metadataReceiptHash: fact.metadataReceiptHash,
    verificationRoot,
    verifierId: fact.verifierId,
    verifierAuthorityRoot: fact.verifier.authorityRoot,
    verifiedAt,
  });
  const factRoot = hashJson({
    kind: "canopyproof-metadata-extraction-verification-fact-root-v1",
    commandHash,
    verificationRoot,
    auditEventRoot: fact.auditEvent.eventRoot,
    commandReceiptId: fact.commandReceiptId,
    safety: fact.safety,
  });
  if (
    fact.factType !== "evidence_metadata_extraction_receipt_verification" ||
    fact.organizationId !== extraction.organizationId ||
    fact.projectId !== extraction.projectId ||
    fact.evidenceId !== extraction.evidenceId ||
    fact.objectId !== object.id ||
    fact.objectRoot !== object.objectRoot ||
    fact.extractionId !== extraction.id ||
    fact.extractionRoot !== extraction.extractionRoot ||
    fact.verifierId !== fact.verifier.id ||
    fact.signatureAlgorithm !== "ed25519" ||
    fact.metadataReceiptHash !== extraction.providerReceiptHash ||
    fact.verifiedAt !== extraction.extractedAt ||
    verificationRoot !== fact.verificationRoot ||
    commandHash !== fact.commandHash ||
    fact.id !== `cp_metadata_verify_${commandHash.slice(0, 24)}` ||
    fact.commandReceiptId !== `cp_e3c_command_${commandHash.slice(0, 24)}` ||
    fact.previousEventRoot !== fact.auditEvent.previousRoot ||
    !Number.isInteger(fact.evidenceSequence) ||
    fact.evidenceSequence < 1 ||
    fact.auditEvent.action !== "FULFILL" ||
    fact.auditEvent.actor !== fact.verifierId ||
    fact.auditEvent.entityType !== "metadata_extraction_receipt_verification" ||
    fact.auditEvent.entityId !== fact.id ||
    fact.auditEvent.payloadHash !== fact.verificationRoot ||
    fact.auditEvent.createdAt !== fact.verifiedAt ||
    fact.auditEvent.rationale !==
      "An independently signed metadata-extraction receipt verification fact was appended." ||
    hashJson({
      kind: "canopyproof-audit-event-v1",
      action: fact.auditEvent.action,
      actor: fact.auditEvent.actor,
      entityType: fact.auditEvent.entityType,
      entityId: fact.auditEvent.entityId,
      previousRoot: fact.auditEvent.previousRoot,
      payloadHash: fact.auditEvent.payloadHash,
      createdAt: fact.auditEvent.createdAt,
      rationale: fact.auditEvent.rationale,
    }) !== fact.auditEvent.eventRoot ||
    factRoot !== fact.factRoot ||
    hashJson(fact.safety) !== hashJson(canopyProofEvidenceMetadataAdapterSafetyBoundary())
  ) {
    throw new Error("CANOPYPROOF_E3C_VERIFICATION_FACT_INVALID");
  }
  return fact;
}

function assertVerifier(agent: CanopyProofEvidenceMediaAgentSnapshot, organizationId: string) {
  identifierSchema.parse(agent.id);
  if (
    agent.organizationId !== organizationId ||
    agent.capability !== "verified_metadata_extraction_receipt" ||
    agent.participantType !== "agent" ||
    agent.role !== "agent" ||
    agent.verificationStatus !== "verified" ||
    agent.organizationVerificationStatus !== "verified" ||
    agent.agentType !== "evidence" ||
    agent.agentStatus !== "active"
  ) {
    throw new Error("CANOPYPROOF_E3C_VERIFIER_AUTHORITY_INVALID");
  }
  const seed = {
    id: agent.id,
    participantType: agent.participantType,
    role: agent.role,
    verificationStatus: agent.verificationStatus,
    organizationId: agent.organizationId,
    organizationVerificationStatus: agent.organizationVerificationStatus,
    participantRoot: agent.participantRoot,
    organizationRoot: agent.organizationRoot,
    agentType: agent.agentType,
    agentStatus: agent.agentStatus,
    capability: agent.capability,
    agentRegistryHash: agent.agentRegistryHash,
  };
  if (canopyProofEvidenceMediaAgentAuthorityRoot(seed) !== agent.authorityRoot) {
    throw new Error("CANOPYPROOF_E3C_VERIFIER_ROOT_INVALID");
  }
}

function assertStream(events: readonly CanopyProofAuditEvent[], createdAt: string) {
  const terminal = events.at(-1);
  if (terminal && !verifyCanopyProofAuditChain(events, createdAt).valid) {
    throw new Error("CANOPYPROOF_E3C_EVENT_STREAM_INVALID");
  }
  if (terminal && Date.parse(createdAt) < Date.parse(terminal.createdAt)) {
    throw new Error("CANOPYPROOF_E3C_EVENT_TIME_REGRESSION");
  }
}

function appendRootBoundEvent(
  history: readonly CanopyProofAuditEvent[],
  input: Readonly<{
    actor: string;
    entityId: string;
    payloadHash: string;
    createdAt: string;
  }>,
) {
  const previousRoot = history.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
  const seed = {
    action: "FULFILL" as const,
    actor: input.actor,
    entityType: "metadata_extraction_receipt_verification" as const,
    entityId: input.entityId,
    previousRoot,
    payloadHash: hashSchema.parse(input.payloadHash),
    createdAt: canonicalTimestampSchema.parse(input.createdAt),
    rationale:
      "An independently signed metadata-extraction receipt verification fact was appended.",
  };
  const eventRoot = hashJson({ kind: "canopyproof-audit-event-v1", ...seed });
  return {
    id: `cp_audit_${eventRoot.slice(0, 24)}`,
    ...seed,
    eventRoot,
  } satisfies CanopyProofAuditEvent;
}

function canonicalStrings(values: readonly string[]) {
  return Object.freeze([...new Set(values)].sort());
}
