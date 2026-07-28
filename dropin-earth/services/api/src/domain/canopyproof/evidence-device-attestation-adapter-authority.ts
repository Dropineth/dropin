import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  isCanopyProofVerifiedDeviceAttestationReceipt,
  type CanopyProofDeviceAttestationVerificationResult,
  type CanopyProofVerifiedDeviceAttestationReceipt,
} from "./device-attestation-adapter.js";
import type {
  CanopyProofEvidenceConsentProjection,
  CanopyProofEvidenceDeviceAttestationFact,
} from "./evidence-custody-authority.js";
import {
  canopyProofEvidenceMediaAgentAuthorityRoot,
  type CanopyProofEvidenceMediaAgentSnapshot,
} from "./evidence-media-authority.js";
import {
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export type CanopyProofDeviceAttestationAdapterSafetyBoundary = Readonly<{
  appendOnly: true;
  organizationBound: true;
  subjectBound: true;
  consentBound: true;
  baseAttestationBound: true;
  semanticEventBound: true;
  commandReceiptBound: true;
  providerSignatureVerifiedIndependently: true;
  baseAttestationRemainsModeledOnly: true;
  strictAsOfProjection: true;
  noRawDeviceIdentifier: true;
  noRawAttestation: true;
  noRawChallenge: true;
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

const durableReceiptBrand: unique symbol = Symbol("CanopyProofDurableDeviceAttestationReceipt");

export type CanopyProofDurableDeviceAttestationReceipt = Omit<
  CanopyProofVerifiedDeviceAttestationReceipt,
  "signature"
> & Readonly<{ [durableReceiptBrand]: true }>;

export type CanopyProofDeviceAttestationVerificationFact = Readonly<{
  factType: "evidence_device_attestation_receipt_verification";
  id: string;
  organizationId: string;
  subjectId: string;
  subjectRoot: string;
  consentReceiptId: string;
  consentReceiptRoot: string;
  attestationId: string;
  attestationRoot: string;
  provider: CanopyProofEvidenceDeviceAttestationFact["provider"];
  attestationType: CanopyProofEvidenceDeviceAttestationFact["attestationType"];
  providerKeyId: string;
  providerReceiptHash: string;
  verifierId: string;
  verifier: CanopyProofEvidenceMediaAgentSnapshot;
  providerVerifierId: string;
  providerVerifierVersion: string;
  signerKeyId: string;
  signerSetRoot: string;
  providerPolicyRoot: string;
  challengeHash: string;
  signedReceiptHash: string;
  signatureAlgorithm: "ed25519";
  signatureHash: string;
  adapterVerificationRoot: string;
  result: CanopyProofDeviceAttestationVerificationResult;
  reasonCodes: readonly string[];
  verifiedAt: string;
  expiresAt: string;
  verificationRoot: string;
  commandHash: string;
  attestationSequence: number;
  previousEventRoot: string;
  commandReceiptId: string;
  factRoot: string;
  safety: CanopyProofDeviceAttestationAdapterSafetyBoundary;
  auditEvent: CanopyProofAuditEvent;
}>;

export type CanopyProofEffectiveDeviceAttestationProjection = Readonly<{
  attestationId: string;
  attestationRoot: string;
  organizationId: string;
  subjectId: string;
  consentReceiptId: string;
  state:
    | "current"
    | "expired"
    | "consent_revoked"
    | "consent_expired"
    | "needs_review"
    | "rejected"
    | "verification_expired";
  issueCodes: readonly string[];
  evaluatedAt: string;
  consentProjectionRoot: string;
  verificationFactId?: string;
  verificationRoot?: string;
  projectionRoot: string;
  safety: CanopyProofDeviceAttestationAdapterSafetyBoundary;
}>;

const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const canonicalTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).toISOString() === value);

export function canopyProofDeviceAttestationAdapterSafetyBoundary():
CanopyProofDeviceAttestationAdapterSafetyBoundary {
  return {
    appendOnly: true,
    organizationBound: true,
    subjectBound: true,
    consentBound: true,
    baseAttestationBound: true,
    semanticEventBound: true,
    commandReceiptBound: true,
    providerSignatureVerifiedIndependently: true,
    baseAttestationRemainsModeledOnly: true,
    strictAsOfProjection: true,
    noRawDeviceIdentifier: true,
    noRawAttestation: true,
    noRawChallenge: true,
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

export function minimizeCanopyProofDeviceAttestationReceipt(
  receipt: CanopyProofVerifiedDeviceAttestationReceipt,
): CanopyProofDurableDeviceAttestationReceipt {
  if (!isCanopyProofVerifiedDeviceAttestationReceipt(receipt)) {
    throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_RECEIPT_NOT_ADAPTER_VERIFIED");
  }
  const { signature, ...minimized } = receipt;
  void signature;
  Object.defineProperty(minimized, durableReceiptBrand, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
  return Object.freeze(minimized) as CanopyProofDurableDeviceAttestationReceipt;
}

export function isCanopyProofDurableDeviceAttestationReceipt(
  value: unknown,
): value is CanopyProofDurableDeviceAttestationReceipt {
  if (!value || typeof value !== "object") return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, durableReceiptBrand);
  return descriptor?.value === true && descriptor.enumerable === false &&
    descriptor.configurable === false && descriptor.writable === false && Object.isFrozen(value);
}

export function buildCanopyProofDeviceAttestationVerificationFact(input: Readonly<{
  attestation: CanopyProofEvidenceDeviceAttestationFact;
  receipt: CanopyProofDurableDeviceAttestationReceipt;
  verifier: CanopyProofEvidenceMediaAgentSnapshot;
  streamEvents: readonly CanopyProofAuditEvent[];
}>): CanopyProofDeviceAttestationVerificationFact {
  assertVerifier(input.verifier, input.attestation.organizationId);
  assertReceiptBinding(input.attestation, input.receipt);
  assertStream(input.streamEvents, input.receipt.verifiedAt);
  const verificationRoot = hashJson({
    kind: "canopyproof-device-attestation-receipt-verification-v1",
    attestationId: input.attestation.id,
    attestationRoot: input.attestation.attestationRoot,
    signedReceiptHash: input.receipt.receiptHash,
    provider: input.receipt.provider,
    providerVerifierId: input.receipt.verifierId,
    verifierId: input.verifier.id,
    signerKeyId: input.receipt.signerKeyId,
    signerSetRoot: input.receipt.signerSetRoot,
    providerPolicyRoot: input.receipt.providerPolicyRoot,
    challengeHash: input.receipt.challengeHash,
    signatureHash: input.receipt.signatureHash,
    adapterVerificationRoot: input.receipt.adapterVerificationRoot,
    result: input.receipt.result,
    reasonCodes: input.receipt.reasonCodes,
    verifiedAt: input.receipt.verifiedAt,
    expiresAt: input.receipt.expiresAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-device-attestation-verification-command-v1",
    organizationId: input.attestation.organizationId,
    attestationId: input.attestation.id,
    attestationRoot: input.attestation.attestationRoot,
    signedReceiptHash: input.receipt.receiptHash,
    verificationRoot,
    verifierId: input.verifier.id,
    verifierAuthorityRoot: input.verifier.authorityRoot,
    verifiedAt: input.receipt.verifiedAt,
  });
  const id = `cp_device_verify_${commandHash.slice(0, 24)}`;
  const commandReceiptId = `cp_e1a_command_${commandHash.slice(0, 24)}`;
  const action = input.receipt.result === "verified" ? "FULFILL" : "CHALLENGE";
  const rationale = input.receipt.result === "verified"
    ? "An independently signed device-attestation provider receipt was verified."
    : "A signed device-attestation provider rejection was retained for review.";
  const auditEvent = appendRootBoundEvent(input.streamEvents, {
    action,
    actor: input.verifier.id,
    entityId: id,
    payloadHash: verificationRoot,
    createdAt: input.receipt.verifiedAt,
    rationale,
  });
  const safety = canopyProofDeviceAttestationAdapterSafetyBoundary();
  const factRoot = hashJson({
    kind: "canopyproof-device-attestation-verification-fact-root-v1",
    commandHash,
    verificationRoot,
    auditEventRoot: auditEvent.eventRoot,
    commandReceiptId,
    safety,
  });
  return {
    factType: "evidence_device_attestation_receipt_verification",
    id,
    organizationId: input.attestation.organizationId,
    subjectId: input.attestation.subjectId,
    subjectRoot: input.attestation.subjectRoot,
    consentReceiptId: input.attestation.consentReceiptId,
    consentReceiptRoot: input.attestation.consentReceiptRoot,
    attestationId: input.attestation.id,
    attestationRoot: input.attestation.attestationRoot,
    provider: input.attestation.provider,
    attestationType: input.attestation.attestationType,
    providerKeyId: input.attestation.providerKeyId,
    providerReceiptHash: input.attestation.providerReceiptHash,
    verifierId: input.verifier.id,
    verifier: input.verifier,
    providerVerifierId: input.receipt.verifierId,
    providerVerifierVersion: input.receipt.verifierVersion,
    signerKeyId: input.receipt.signerKeyId,
    signerSetRoot: input.receipt.signerSetRoot,
    providerPolicyRoot: input.receipt.providerPolicyRoot,
    challengeHash: input.receipt.challengeHash,
    signedReceiptHash: input.receipt.receiptHash,
    signatureAlgorithm: input.receipt.signatureAlgorithm,
    signatureHash: input.receipt.signatureHash,
    adapterVerificationRoot: input.receipt.adapterVerificationRoot,
    result: input.receipt.result,
    reasonCodes: input.receipt.reasonCodes,
    verifiedAt: input.receipt.verifiedAt,
    expiresAt: input.receipt.expiresAt,
    verificationRoot,
    commandHash,
    attestationSequence: input.streamEvents.length + 1,
    previousEventRoot: auditEvent.previousRoot,
    commandReceiptId,
    factRoot,
    safety,
    auditEvent,
  };
}

export function projectCanopyProofEffectiveDeviceAttestation(input: Readonly<{
  attestation: CanopyProofEvidenceDeviceAttestationFact;
  consentProjection: CanopyProofEvidenceConsentProjection;
  verifications: readonly CanopyProofDeviceAttestationVerificationFact[];
  evaluatedAt: string;
}>): CanopyProofEffectiveDeviceAttestationProjection {
  const evaluatedAt = canonicalTimestampSchema.parse(input.evaluatedAt);
  assertConsentBinding(input.attestation, input.consentProjection, evaluatedAt);
  const visible = input.verifications
    .filter((fact) => Date.parse(fact.verifiedAt) <= Date.parse(evaluatedAt))
    .map((fact) => assertCanopyProofDeviceAttestationVerificationFact(input.attestation, fact))
    .sort((left, right) =>
      right.verifiedAt.localeCompare(left.verifiedAt) ||
      right.attestationSequence - left.attestationSequence ||
      right.id.localeCompare(left.id),
    );
  const verification = visible[0];
  const issueCodes: string[] = [];
  let state: CanopyProofEffectiveDeviceAttestationProjection["state"];
  if (input.consentProjection.state === "revoked") {
    state = "consent_revoked";
    issueCodes.push("device_consent_revoked");
  } else if (input.consentProjection.state === "expired") {
    state = "consent_expired";
    issueCodes.push("device_consent_expired");
  } else if (Date.parse(input.attestation.expiresAt) <= Date.parse(evaluatedAt)) {
    state = "expired";
    issueCodes.push("device_attestation_expired");
  } else if (input.attestation.riskFlags.length > 0) {
    state = "needs_review";
    issueCodes.push(...input.attestation.riskFlags.map((flag) => `device_risk_${flag}`));
  } else if (!verification) {
    state = "needs_review";
    issueCodes.push("device_provider_verification_pending");
  } else if (verification.result === "rejected") {
    state = "rejected";
    issueCodes.push(...verification.reasonCodes.map((reason) => `device_provider_${reason}`));
  } else if (Date.parse(verification.expiresAt) <= Date.parse(evaluatedAt)) {
    state = "verification_expired";
    issueCodes.push("device_provider_verification_expired");
  } else {
    state = "current";
  }
  const safety = canopyProofDeviceAttestationAdapterSafetyBoundary();
  const seed = {
    attestationId: input.attestation.id,
    attestationRoot: input.attestation.attestationRoot,
    organizationId: input.attestation.organizationId,
    subjectId: input.attestation.subjectId,
    consentReceiptId: input.attestation.consentReceiptId,
    state,
    issueCodes: [...new Set(issueCodes)].sort(),
    evaluatedAt,
    consentProjectionRoot: input.consentProjection.projectionRoot,
    ...(verification ? { verificationFactId: verification.id } : {}),
    ...(verification ? { verificationRoot: verification.verificationRoot } : {}),
    safety,
  } as const;
  return {
    ...seed,
    projectionRoot: hashJson({ kind: "canopyproof-effective-device-attestation-projection-v1", ...seed }),
  };
}

export function isCanopyProofEffectiveDeviceAttestationProjection(
  projection:
    | CanopyProofEffectiveDeviceAttestationProjection
    | Readonly<{ safety: Readonly<Record<string, unknown>> }>,
): projection is CanopyProofEffectiveDeviceAttestationProjection {
  return "issueCodes" in projection &&
    projection.safety.baseAttestationRemainsModeledOnly === true;
}

export function assertCanopyProofEffectiveDeviceAttestationProjection(
  projection: CanopyProofEffectiveDeviceAttestationProjection,
) {
  const evaluatedAt = canonicalTimestampSchema.parse(projection.evaluatedAt);
  const safety = canopyProofDeviceAttestationAdapterSafetyBoundary();
  const seed = {
    attestationId: projection.attestationId,
    attestationRoot: hashSchema.parse(projection.attestationRoot),
    organizationId: projection.organizationId,
    subjectId: projection.subjectId,
    consentReceiptId: projection.consentReceiptId,
    state: projection.state,
    issueCodes: projection.issueCodes,
    evaluatedAt,
    consentProjectionRoot: hashSchema.parse(projection.consentProjectionRoot),
    ...(projection.verificationFactId
      ? { verificationFactId: projection.verificationFactId }
      : {}),
    ...(projection.verificationRoot
      ? { verificationRoot: hashSchema.parse(projection.verificationRoot) }
      : {}),
    safety,
  } as const;
  const expectedRoot = hashJson({
    kind: "canopyproof-effective-device-attestation-projection-v1",
    ...seed,
  });
  if (
    projection.projectionRoot !== expectedRoot ||
    hashJson(projection.safety) !== hashJson(safety) ||
    !isSortedUnique(projection.issueCodes) ||
    (projection.verificationFactId === undefined) !==
      (projection.verificationRoot === undefined) ||
    (projection.state === "current" &&
      (projection.issueCodes.length !== 0 || projection.verificationRoot === undefined))
  ) {
    throw new Error("CANOPYPROOF_EFFECTIVE_DEVICE_ATTESTATION_PROJECTION_INVALID");
  }
  return projection;
}

export function assertCanopyProofDeviceAttestationVerificationFact(
  attestation: CanopyProofEvidenceDeviceAttestationFact,
  fact: CanopyProofDeviceAttestationVerificationFact,
) {
  assertVerifier(fact.verifier, attestation.organizationId);
  const verificationRoot = hashJson({
    kind: "canopyproof-device-attestation-receipt-verification-v1",
    attestationId: attestation.id,
    attestationRoot: attestation.attestationRoot,
    signedReceiptHash: fact.signedReceiptHash,
    provider: fact.provider,
    providerVerifierId: fact.providerVerifierId,
    verifierId: fact.verifierId,
    signerKeyId: fact.signerKeyId,
    signerSetRoot: fact.signerSetRoot,
    providerPolicyRoot: fact.providerPolicyRoot,
    challengeHash: fact.challengeHash,
    signatureHash: fact.signatureHash,
    adapterVerificationRoot: fact.adapterVerificationRoot,
    result: fact.result,
    reasonCodes: fact.reasonCodes,
    verifiedAt: fact.verifiedAt,
    expiresAt: fact.expiresAt,
  });
  const commandHash = hashJson({
    kind: "canopyproof-device-attestation-verification-command-v1",
    organizationId: attestation.organizationId,
    attestationId: attestation.id,
    attestationRoot: attestation.attestationRoot,
    signedReceiptHash: fact.signedReceiptHash,
    verificationRoot,
    verifierId: fact.verifierId,
    verifierAuthorityRoot: fact.verifier.authorityRoot,
    verifiedAt: fact.verifiedAt,
  });
  const expectedSafety = canopyProofDeviceAttestationAdapterSafetyBoundary();
  const factRoot = hashJson({
    kind: "canopyproof-device-attestation-verification-fact-root-v1",
    commandHash,
    verificationRoot,
    auditEventRoot: fact.auditEvent.eventRoot,
    commandReceiptId: fact.commandReceiptId,
    safety: expectedSafety,
  });
  if (
    fact.factType !== "evidence_device_attestation_receipt_verification" ||
    fact.organizationId !== attestation.organizationId ||
    fact.subjectId !== attestation.subjectId ||
    fact.subjectRoot !== attestation.subjectRoot ||
    fact.consentReceiptId !== attestation.consentReceiptId ||
    fact.consentReceiptRoot !== attestation.consentReceiptRoot ||
    fact.attestationId !== attestation.id ||
    fact.attestationRoot !== attestation.attestationRoot ||
    fact.provider !== attestation.provider ||
    fact.attestationType !== attestation.attestationType ||
    fact.providerKeyId !== attestation.providerKeyId ||
    fact.providerReceiptHash !== attestation.providerReceiptHash ||
    fact.verifierId !== fact.verifier.id ||
    verificationRoot !== fact.verificationRoot ||
    commandHash !== fact.commandHash ||
    fact.id !== `cp_device_verify_${commandHash.slice(0, 24)}` ||
    fact.commandReceiptId !== `cp_e1a_command_${commandHash.slice(0, 24)}` ||
    factRoot !== fact.factRoot ||
    hashJson(fact.safety) !== hashJson(expectedSafety) ||
    fact.auditEvent.entityId !== fact.id ||
    fact.auditEvent.actor !== fact.verifierId ||
    fact.auditEvent.createdAt !== fact.verifiedAt ||
    fact.auditEvent.action !== (fact.result === "verified" ? "FULFILL" : "CHALLENGE") ||
    fact.auditEvent.entityType !== "device_attestation" ||
    fact.auditEvent.payloadHash !== fact.verificationRoot ||
    fact.auditEvent.previousRoot !== fact.previousEventRoot ||
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
    !isSortedUnique(fact.reasonCodes) ||
    (fact.result === "verified" ? fact.reasonCodes.length !== 0 : fact.reasonCodes.length === 0)
  ) {
    throw new Error("CANOPYPROOF_E1A_VERIFICATION_FACT_INVALID");
  }
  return fact;
}

function assertReceiptBinding(
  attestation: CanopyProofEvidenceDeviceAttestationFact,
  receipt: CanopyProofDurableDeviceAttestationReceipt,
) {
  if (!isCanopyProofDurableDeviceAttestationReceipt(receipt)) {
    throw new Error("CANOPYPROOF_E1A_RECEIPT_NOT_MINIMIZED_BY_AUTHORITY");
  }
  if (
    attestation.providerVerificationState !== "modeled_only" ||
    receipt.attestationId !== attestation.id ||
    receipt.attestationRoot !== attestation.attestationRoot ||
    receipt.organizationId !== attestation.organizationId ||
    receipt.subjectId !== attestation.subjectId ||
    receipt.subjectRoot !== attestation.subjectRoot ||
    receipt.consentReceiptId !== attestation.consentReceiptId ||
    receipt.consentReceiptRoot !== attestation.consentReceiptRoot ||
    receipt.deviceFingerprintHash !== attestation.deviceFingerprintHash ||
    receipt.attestationType !== attestation.attestationType ||
    receipt.provider !== attestation.provider ||
    receipt.providerKeyId !== attestation.providerKeyId ||
    receipt.providerReceiptHash !== attestation.providerReceiptHash ||
    receipt.publicKeyHash !== attestation.publicKeyHash ||
    receipt.attestationHash !== attestation.attestationHash
  ) {
    throw new Error("CANOPYPROOF_E1A_RECEIPT_BINDING_INVALID");
  }
}

function assertConsentBinding(
  attestation: CanopyProofEvidenceDeviceAttestationFact,
  consent: CanopyProofEvidenceConsentProjection,
  evaluatedAt: string,
) {
  if (
    consent.receiptId !== attestation.consentReceiptId ||
    consent.receiptRoot !== attestation.consentReceiptRoot ||
    consent.organizationId !== attestation.organizationId ||
    consent.subjectId !== attestation.subjectId ||
    consent.evaluatedAt !== evaluatedAt
  ) {
    throw new Error("CANOPYPROOF_E1A_CONSENT_PROJECTION_MISMATCH");
  }
}

function assertVerifier(verifier: CanopyProofEvidenceMediaAgentSnapshot, organizationId: string) {
  const { authorityRoot, ...normalized } = verifier;
  if (
    verifier.organizationId !== organizationId ||
    verifier.capability !== "device_attestation_receipt" ||
    verifier.participantType !== "agent" ||
    verifier.agentType !== "evidence" ||
    verifier.agentStatus !== "active" ||
    verifier.verificationStatus !== "verified" ||
    canopyProofEvidenceMediaAgentAuthorityRoot(normalized) !== authorityRoot
  ) {
    throw new Error("CANOPYPROOF_E1A_VERIFIER_AUTHORITY_INVALID");
  }
}

function assertStream(events: readonly CanopyProofAuditEvent[], verifiedAt: string) {
  if (events.length > 0 && !verifyCanopyProofAuditChain(events, verifiedAt).valid) {
    throw new Error("CANOPYPROOF_E1A_AUDIT_STREAM_INVALID");
  }
  if (events.some((event) => Date.parse(event.createdAt) > Date.parse(verifiedAt))) {
    throw new Error("CANOPYPROOF_E1A_AUDIT_TIME_REGRESSION");
  }
  if ((events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot()).length !== 64) {
    throw new Error("CANOPYPROOF_E1A_AUDIT_ROOT_INVALID");
  }
}

function appendRootBoundEvent(
  history: readonly CanopyProofAuditEvent[],
  input: Readonly<{
    action: "FULFILL" | "CHALLENGE";
    actor: string;
    entityId: string;
    payloadHash: string;
    createdAt: string;
    rationale: string;
  }>,
) {
  const seed = {
    action: input.action,
    actor: input.actor,
    entityType: "device_attestation" as const,
    entityId: input.entityId,
    previousRoot: history.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    payloadHash: hashSchema.parse(input.payloadHash),
    createdAt: canonicalTimestampSchema.parse(input.createdAt),
    rationale: input.rationale,
  };
  const eventRoot = hashJson({ kind: "canopyproof-audit-event-v1", ...seed });
  return {
    id: `cp_audit_${eventRoot.slice(0, 24)}`,
    ...seed,
    eventRoot,
  } satisfies CanopyProofAuditEvent;
}

function isSortedUnique(values: readonly string[]) {
  return values.every((value, index) => index === 0 || values[index - 1]! < value) &&
    values.every((value) => /^[a-z][a-z0-9_]{1,63}$/.test(value));
}

export function parseCanopyProofDeviceAttestationHash(value: string) {
  return hashSchema.parse(value);
}
