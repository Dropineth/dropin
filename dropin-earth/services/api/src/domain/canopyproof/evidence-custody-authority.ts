import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofEvidenceCustodyRoles = ["owner", "admin", "verifier", "researcher", "community"] as const;
export const canopyProofEvidenceConsentPurposes = [
  "evidence_collection",
  "geolocation",
  "media_upload",
  "community_verification",
  "research_sharing",
] as const;
export const canopyProofEvidenceConsentLawfulBases = ["consent", "public_interest", "legitimate_interest"] as const;
export const canopyProofEvidenceConsentPrivacyModes = ["precise", "masked", "restricted"] as const;
export const canopyProofEvidenceDeviceAttestationTypes = [
  "secure_enclave",
  "webauthn",
  "platform_key",
  "manual_field_kit",
  "sensor_gateway",
] as const;
export const canopyProofEvidenceDeviceAttestationProviders = [
  "apple_app_attest",
  "webauthn",
  "android_key_attestation",
  "manual_field_kit_registry",
  "sensor_gateway_registry",
] as const;
export const canopyProofEvidenceDeviceRiskFlags = [
  "jailbreak_detected",
  "clock_skew",
  "location_mocking",
  "sensor_gap",
  "shared_device_cluster",
] as const;

export type CanopyProofEvidenceCustodyRole = (typeof canopyProofEvidenceCustodyRoles)[number];
export type CanopyProofEvidenceConsentPurpose = (typeof canopyProofEvidenceConsentPurposes)[number];
export type CanopyProofEvidenceConsentLawfulBasis = (typeof canopyProofEvidenceConsentLawfulBases)[number];
export type CanopyProofEvidenceConsentPrivacyMode = (typeof canopyProofEvidenceConsentPrivacyModes)[number];
export type CanopyProofEvidenceDeviceAttestationType =
  (typeof canopyProofEvidenceDeviceAttestationTypes)[number];
export type CanopyProofEvidenceDeviceAttestationProvider =
  (typeof canopyProofEvidenceDeviceAttestationProviders)[number];
export type CanopyProofEvidenceDeviceRiskFlag = (typeof canopyProofEvidenceDeviceRiskFlags)[number];

export type CanopyProofEvidenceCustodyActorSnapshot = {
  readonly id: string;
  readonly participantType: "human";
  readonly role: CanopyProofEvidenceCustodyRole;
  readonly verificationStatus: "verified";
  readonly organizationId: string;
  readonly organizationVerificationStatus: "verified";
  readonly participantRoot: string;
  readonly organizationRoot: string;
  readonly membershipId: string;
  readonly membershipStatus: "active";
  readonly membershipRoot: string;
  readonly authorityRoot: string;
};

export type CanopyProofEvidenceCustodySafetyBoundary = {
  readonly appendOnly: true;
  readonly subjectBound: true;
  readonly organizationBound: true;
  readonly semanticEventBound: true;
  readonly noRawDeviceIdentifier: true;
  readonly noRawProviderCredential: true;
  readonly providerVerificationRequiredForHardwareTrust: true;
  readonly notFinalProofAuthority: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEvidenceConsentReceiptFact = {
  readonly factType: "evidence_consent_receipt";
  readonly id: string;
  readonly organizationId: string;
  readonly subjectId: string;
  readonly subjectRoot: string;
  readonly subjectAuthorityRoot: string;
  readonly deviceFingerprintHash?: string;
  readonly purposes: readonly CanopyProofEvidenceConsentPurpose[];
  readonly lawfulBasis: CanopyProofEvidenceConsentLawfulBasis;
  readonly privacyMode: CanopyProofEvidenceConsentPrivacyMode;
  readonly policyVersion: string;
  readonly evidenceHash: string;
  readonly grantedAt: string;
  readonly expiresAt?: string;
  readonly retentionDays: number;
  readonly actor: CanopyProofEvidenceCustodyActorSnapshot;
  readonly commandHash: string;
  readonly subjectSequence: number;
  readonly previousEventRoot: string;
  readonly receiptHash: string;
  readonly receiptRoot: string;
  readonly safety: CanopyProofEvidenceCustodySafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceConsentRevocationFact = {
  readonly factType: "evidence_consent_revocation";
  readonly id: string;
  readonly receiptId: string;
  readonly receiptRoot: string;
  readonly organizationId: string;
  readonly subjectId: string;
  readonly subjectRoot: string;
  readonly reasonHash: string;
  readonly revokedAt: string;
  readonly actor: CanopyProofEvidenceCustodyActorSnapshot;
  readonly commandHash: string;
  readonly subjectSequence: number;
  readonly previousEventRoot: string;
  readonly revocationHash: string;
  readonly revocationRoot: string;
  readonly safety: CanopyProofEvidenceCustodySafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceDeviceAttestationFact = {
  readonly factType: "evidence_device_attestation";
  readonly id: string;
  readonly organizationId: string;
  readonly subjectId: string;
  readonly subjectRoot: string;
  readonly subjectAuthorityRoot: string;
  readonly consentReceiptId: string;
  readonly consentReceiptRoot: string;
  readonly deviceFingerprintHash: string;
  readonly attestationType: CanopyProofEvidenceDeviceAttestationType;
  readonly provider: CanopyProofEvidenceDeviceAttestationProvider;
  readonly providerKeyId: string;
  readonly providerReceiptHash: string;
  readonly providerVerificationState: "modeled_only" | "verified";
  readonly publicKeyHash: string;
  readonly attestationHash: string;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly reputationScore: number;
  readonly riskFlags: readonly CanopyProofEvidenceDeviceRiskFlag[];
  readonly actor: CanopyProofEvidenceCustodyActorSnapshot;
  readonly commandHash: string;
  readonly subjectSequence: number;
  readonly previousEventRoot: string;
  readonly deviceHash: string;
  readonly attestationRoot: string;
  readonly safety: CanopyProofEvidenceCustodySafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEvidenceConsentProjection = {
  readonly receiptId: string;
  readonly receiptRoot: string;
  readonly organizationId: string;
  readonly subjectId: string;
  readonly state: "active" | "expired" | "revoked";
  readonly evaluatedAt: string;
  readonly revocationId?: string;
  readonly revocationRoot?: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEvidenceCustodySafetyBoundary;
};

export type CanopyProofEvidenceDeviceAttestationProjection = {
  readonly attestationId: string;
  readonly attestationRoot: string;
  readonly organizationId: string;
  readonly subjectId: string;
  readonly consentReceiptId: string;
  readonly state: "current" | "expired" | "consent_revoked" | "consent_expired" | "needs_review";
  readonly evaluatedAt: string;
  readonly consentProjectionRoot: string;
  readonly projectionRoot: string;
  readonly safety: CanopyProofEvidenceCustodySafetyBoundary;
};

export type CanopyProofEvidenceCustodyAuthoritySnapshot = {
  readonly consentReceipts: readonly CanopyProofEvidenceConsentReceiptFact[];
  readonly consentRevocations: readonly CanopyProofEvidenceConsentRevocationFact[];
  readonly deviceAttestations: readonly CanopyProofEvidenceDeviceAttestationFact[];
};

const identifierSchema = z.string().trim().min(1).max(240);
const hashSchema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.literal("human"),
    role: z.enum(canopyProofEvidenceCustodyRoles),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema,
    membershipStatus: z.literal("active"),
    membershipRoot: hashSchema,
    authorityRoot: hashSchema,
  })
  .strict();

const consentReceiptInputSchema = z
  .object({
    subjectId: identifierSchema,
    deviceFingerprintHash: hashSchema.optional(),
    purposes: z.array(z.enum(canopyProofEvidenceConsentPurposes)).min(1).max(16),
    lawfulBasis: z.enum(canopyProofEvidenceConsentLawfulBases),
    privacyMode: z.enum(canopyProofEvidenceConsentPrivacyModes),
    policyVersion: z.string().trim().min(1).max(100),
    evidenceHash: hashSchema,
    grantedAt: z.string().datetime(),
    expiresAt: z.string().datetime().optional(),
    retentionDays: z.number().int().positive().max(3_650),
  })
  .strict()
  .refine((value) => !value.expiresAt || Date.parse(value.grantedAt) < Date.parse(value.expiresAt), {
    message: "CanopyProof evidence consent expiresAt must be after grantedAt.",
  });

const consentRevocationInputSchema = z
  .object({
    revokedAt: z.string().datetime(),
    reason: z.string().trim().min(12).max(1_000),
  })
  .strict();

const deviceAttestationInputSchema = z
  .object({
    subjectId: identifierSchema,
    consentReceiptId: identifierSchema,
    deviceFingerprintHash: hashSchema,
    attestationType: z.enum(canopyProofEvidenceDeviceAttestationTypes),
    provider: z.enum(canopyProofEvidenceDeviceAttestationProviders),
    providerKeyId: z.string().trim().min(3).max(200),
    providerReceiptHash: hashSchema,
    providerVerificationState: z.enum(["modeled_only", "verified"]),
    publicKeyHash: hashSchema,
    attestationHash: hashSchema,
    issuedAt: z.string().datetime(),
    expiresAt: z.string().datetime(),
    reputationScore: z.number().int().min(0).max(100),
    riskFlags: z.array(z.enum(canopyProofEvidenceDeviceRiskFlags)).max(16).default([]),
  })
  .strict()
  .refine((value) => Date.parse(value.issuedAt) < Date.parse(value.expiresAt), {
    message: "CanopyProof evidence device attestation expiresAt must be after issuedAt.",
  });

export class CanopyProofEvidenceCustodyAuthorityService {
  private readonly consentReceiptsById = new Map<string, CanopyProofEvidenceConsentReceiptFact>();
  private readonly consentRevocationsById = new Map<string, CanopyProofEvidenceConsentRevocationFact>();
  private readonly consentRevocationIdByReceiptId = new Map<string, string>();
  private readonly deviceAttestationsById = new Map<string, CanopyProofEvidenceDeviceAttestationFact>();
  private readonly eventsBySubjectId = new Map<string, CanopyProofAuditEvent[]>();

  static fromAuthoritySnapshot(snapshot: CanopyProofEvidenceCustodyAuthoritySnapshot) {
    const service = new CanopyProofEvidenceCustodyAuthorityService();
    const facts = [...snapshot.consentReceipts, ...snapshot.consentRevocations, ...snapshot.deviceAttestations].sort(
      (left, right) =>
        left.subjectSequence - right.subjectSequence ||
        left.auditEvent.createdAt.localeCompare(right.auditEvent.createdAt) ||
        left.id.localeCompare(right.id),
    );
    const ids = new Set<string>();
    for (const fact of facts) {
      if (ids.has(fact.id)) throw new Error(`CanopyProof evidence custody snapshot contains duplicate fact id: ${fact.id}`);
      ids.add(fact.id);
      if (fact.factType === "evidence_consent_receipt") service.replayConsentReceipt(fact);
      else if (fact.factType === "evidence_consent_revocation") service.replayConsentRevocation(fact);
      else service.replayDeviceAttestation(fact);
    }
    return service;
  }

  recordConsentReceipt(
    input: unknown,
    actorInput: CanopyProofEvidenceCustodyActorSnapshot,
  ): CanopyProofEvidenceConsentReceiptFact {
    const parsed = consentReceiptInputSchema.parse(input);
    const actor = normalizeActor(actorInput);
    assertSelfAuthority(actor, parsed.subjectId);
    assertSafeIdentifierMaterial(parsed.policyVersion, "consent policy version");
    const normalized = {
      subjectId: parsed.subjectId,
      ...(parsed.deviceFingerprintHash
        ? { deviceFingerprintHash: normalizeHash(parsed.deviceFingerprintHash) }
        : {}),
      purposes: canonicalStringSet(parsed.purposes) as readonly CanopyProofEvidenceConsentPurpose[],
      lawfulBasis: parsed.lawfulBasis,
      privacyMode: parsed.privacyMode,
      policyVersion: parsed.policyVersion,
      evidenceHash: normalizeHash(parsed.evidenceHash),
      grantedAt: parsed.grantedAt,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
      retentionDays: parsed.retentionDays,
    };
    const commandHash = consentReceiptCommandHash(normalized, actor);
    const id = `cp_evidence_consent_${commandHash.slice(0, 24)}`;
    const existing = this.consentReceiptsById.get(id);
    if (existing) return existing;

    const events = this.eventsForSubject(actor.id);
    const subjectSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const seed = {
      id,
      organizationId: actor.organizationId,
      subjectRoot: actor.participantRoot,
      subjectAuthorityRoot: actor.authorityRoot,
      ...normalized,
      actor,
      commandHash,
      subjectSequence,
      previousEventRoot,
    };
    const receiptHash = hashJson({ kind: "canopyproof-evidence-consent-receipt-v2", ...seed });
    const receiptRoot = hashJson({
      kind: "canopyproof-evidence-consent-receipt-root-v2",
      organizationId: actor.organizationId,
      subjectId: actor.id,
      subjectRoot: actor.participantRoot,
      commandHash,
      receiptHash,
      subjectSequence,
      previousEventRoot,
    });
    const safety = custodySafetyBoundary();
    const payload = { factType: "evidence_consent_receipt", ...seed, receiptHash, receiptRoot, safety };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "ASSERT",
      actor: actor.id,
      entityType: "consent_receipt",
      entityId: id,
      payload,
      createdAt: parsed.grantedAt,
      rationale: "An immutable, subject-bound evidence consent and lawful-basis fact was recorded.",
    }).at(-1)!;
    const receipt: CanopyProofEvidenceConsentReceiptFact = {
      factType: "evidence_consent_receipt",
      ...seed,
      receiptHash,
      receiptRoot,
      safety,
      auditEvent,
    };
    this.consentReceiptsById.set(id, receipt);
    this.eventsBySubjectId.set(actor.id, [...events, auditEvent]);
    return receipt;
  }

  revokeConsentReceipt(
    receiptId: string,
    input: unknown,
    actorInput: CanopyProofEvidenceCustodyActorSnapshot,
  ): CanopyProofEvidenceConsentRevocationFact {
    const parsed = consentRevocationInputSchema.parse(input);
    assertSafeReason(parsed.reason, "consent revocation reason");
    return this.appendConsentRevocation(
      receiptId,
      { revokedAt: parsed.revokedAt, reasonHash: hashJson({ kind: "canopyproof-consent-revocation-reason-v2", reason: parsed.reason }) },
      actorInput,
    );
  }

  recordDeviceAttestation(
    input: unknown,
    actorInput: CanopyProofEvidenceCustodyActorSnapshot,
  ): CanopyProofEvidenceDeviceAttestationFact {
    const parsed = deviceAttestationInputSchema.parse(input);
    const actor = normalizeActor(actorInput);
    assertSelfAuthority(actor, parsed.subjectId);
    assertSafeIdentifierMaterial(parsed.providerKeyId, "device attestation provider key id");
    const consent = this.getConsentReceipt(parsed.consentReceiptId);
    if (consent.organizationId !== actor.organizationId || consent.subjectId !== actor.id) {
      throw new Error("CanopyProof evidence device attestation consent authority does not match the subject.");
    }
    const consentProjection = this.projectConsentReceipt(consent.id, parsed.issuedAt);
    if (consentProjection.state !== "active") {
      throw new Error(`CanopyProof evidence device attestation requires active consent: ${consentProjection.state}`);
    }
    if (!consent.purposes.includes("evidence_collection")) {
      throw new Error("CanopyProof evidence device attestation requires evidence_collection purpose.");
    }
    const deviceFingerprintHash = normalizeHash(parsed.deviceFingerprintHash);
    if (consent.deviceFingerprintHash && consent.deviceFingerprintHash !== deviceFingerprintHash) {
      throw new Error("CanopyProof evidence device fingerprint does not match the consent commitment.");
    }
    const normalized = {
      subjectId: actor.id,
      consentReceiptId: consent.id,
      deviceFingerprintHash,
      attestationType: parsed.attestationType,
      provider: parsed.provider,
      providerKeyId: parsed.providerKeyId,
      providerReceiptHash: normalizeHash(parsed.providerReceiptHash),
      providerVerificationState: parsed.providerVerificationState,
      publicKeyHash: normalizeHash(parsed.publicKeyHash),
      attestationHash: normalizeHash(parsed.attestationHash),
      issuedAt: parsed.issuedAt,
      expiresAt: parsed.expiresAt,
      reputationScore: parsed.reputationScore,
      riskFlags: canonicalStringSet(parsed.riskFlags) as readonly CanopyProofEvidenceDeviceRiskFlag[],
    };
    const commandHash = deviceAttestationCommandHash(normalized, actor, consent.receiptRoot);
    const id = `cp_evidence_device_${commandHash.slice(0, 24)}`;
    const existing = this.deviceAttestationsById.get(id);
    if (existing) return existing;

    const events = this.eventsForSubject(actor.id);
    const subjectSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const seed = {
      id,
      organizationId: actor.organizationId,
      subjectRoot: actor.participantRoot,
      subjectAuthorityRoot: actor.authorityRoot,
      consentReceiptRoot: consent.receiptRoot,
      ...normalized,
      actor,
      commandHash,
      subjectSequence,
      previousEventRoot,
    };
    const deviceHash = hashJson({ kind: "canopyproof-evidence-device-attestation-v2", ...seed });
    const attestationRoot = hashJson({
      kind: "canopyproof-evidence-device-attestation-root-v2",
      organizationId: actor.organizationId,
      subjectId: actor.id,
      subjectRoot: actor.participantRoot,
      consentReceiptRoot: consent.receiptRoot,
      providerReceiptHash: normalized.providerReceiptHash,
      commandHash,
      deviceHash,
      subjectSequence,
      previousEventRoot,
    });
    const safety = custodySafetyBoundary();
    const payload = { factType: "evidence_device_attestation", ...seed, deviceHash, attestationRoot, safety };
    const needsReview = normalized.providerVerificationState !== "verified" || normalized.riskFlags.length > 0;
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: needsReview ? "CHALLENGE" : "ASSERT",
      actor: actor.id,
      entityType: "device_attestation",
      entityId: id,
      payload,
      createdAt: parsed.issuedAt,
      rationale: needsReview
        ? "An immutable device attestation fact was retained for provider or human review."
        : "An immutable provider-verified device attestation fact was recorded.",
    }).at(-1)!;
    const attestation: CanopyProofEvidenceDeviceAttestationFact = {
      factType: "evidence_device_attestation",
      ...seed,
      deviceHash,
      attestationRoot,
      safety,
      auditEvent,
    };
    this.deviceAttestationsById.set(id, attestation);
    this.eventsBySubjectId.set(actor.id, [...events, auditEvent]);
    return attestation;
  }

  getConsentReceipt(receiptId: string) {
    const receipt = this.consentReceiptsById.get(receiptId);
    if (!receipt) throw new Error(`CanopyProof evidence consent receipt not found: ${receiptId}`);
    return receipt;
  }

  getConsentRevocation(revocationId: string) {
    const revocation = this.consentRevocationsById.get(revocationId);
    if (!revocation) throw new Error(`CanopyProof evidence consent revocation not found: ${revocationId}`);
    return revocation;
  }

  getDeviceAttestation(attestationId: string) {
    const attestation = this.deviceAttestationsById.get(attestationId);
    if (!attestation) throw new Error(`CanopyProof evidence device attestation not found: ${attestationId}`);
    return attestation;
  }

  listConsentReceipts(subjectId?: string) {
    return [...this.consentReceiptsById.values()]
      .filter((receipt) => !subjectId || receipt.subjectId === subjectId)
      .sort((left, right) => left.subjectSequence - right.subjectSequence || left.id.localeCompare(right.id));
  }

  listConsentRevocations(subjectId?: string) {
    return [...this.consentRevocationsById.values()]
      .filter((revocation) => !subjectId || revocation.subjectId === subjectId)
      .sort((left, right) => left.subjectSequence - right.subjectSequence || left.id.localeCompare(right.id));
  }

  listDeviceAttestations(subjectId?: string) {
    return [...this.deviceAttestationsById.values()]
      .filter((attestation) => !subjectId || attestation.subjectId === subjectId)
      .sort((left, right) => left.subjectSequence - right.subjectSequence || left.id.localeCompare(right.id));
  }

  projectConsentReceipt(receiptId: string, evaluatedAt: string): CanopyProofEvidenceConsentProjection {
    const receipt = this.getConsentReceipt(receiptId);
    const evaluation = z.string().datetime().parse(evaluatedAt);
    const revocationId = this.consentRevocationIdByReceiptId.get(receipt.id);
    const revocation = revocationId ? this.getConsentRevocation(revocationId) : undefined;
    const state: CanopyProofEvidenceConsentProjection["state"] = revocation
      ? "revoked"
      : receipt.expiresAt && Date.parse(receipt.expiresAt) <= Date.parse(evaluation)
        ? "expired"
        : "active";
    const safety = custodySafetyBoundary();
    const seed = {
      receiptId: receipt.id,
      receiptRoot: receipt.receiptRoot,
      organizationId: receipt.organizationId,
      subjectId: receipt.subjectId,
      state,
      evaluatedAt: evaluation,
      ...(revocation ? { revocationId: revocation.id, revocationRoot: revocation.revocationRoot } : {}),
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-evidence-consent-projection-v2", ...seed, safety }),
      safety,
    };
  }

  projectDeviceAttestation(
    attestationId: string,
    evaluatedAt: string,
  ): CanopyProofEvidenceDeviceAttestationProjection {
    const attestation = this.getDeviceAttestation(attestationId);
    const evaluation = z.string().datetime().parse(evaluatedAt);
    const consent = this.projectConsentReceipt(attestation.consentReceiptId, evaluation);
    const state: CanopyProofEvidenceDeviceAttestationProjection["state"] =
      consent.state === "revoked"
        ? "consent_revoked"
        : consent.state === "expired"
          ? "consent_expired"
          : Date.parse(attestation.expiresAt) <= Date.parse(evaluation)
            ? "expired"
            : attestation.providerVerificationState !== "verified" || attestation.riskFlags.length > 0
              ? "needs_review"
              : "current";
    const safety = custodySafetyBoundary();
    const seed = {
      attestationId: attestation.id,
      attestationRoot: attestation.attestationRoot,
      organizationId: attestation.organizationId,
      subjectId: attestation.subjectId,
      consentReceiptId: attestation.consentReceiptId,
      state,
      evaluatedAt: evaluation,
      consentProjectionRoot: consent.projectionRoot,
    };
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-evidence-device-projection-v2", ...seed, safety }),
      safety,
    };
  }

  getAuthoritySnapshot(): CanopyProofEvidenceCustodyAuthoritySnapshot {
    return {
      consentReceipts: this.listConsentReceipts(),
      consentRevocations: this.listConsentRevocations(),
      deviceAttestations: this.listDeviceAttestations(),
    };
  }

  private appendConsentRevocation(
    receiptId: string,
    input: Readonly<{ revokedAt: string; reasonHash: string }>,
    actorInput: CanopyProofEvidenceCustodyActorSnapshot,
  ) {
    const actor = normalizeActor(actorInput);
    const receipt = this.getConsentReceipt(receiptId);
    assertSelfAuthority(actor, receipt.subjectId);
    if (receipt.organizationId !== actor.organizationId) {
      throw new Error("CanopyProof evidence consent revocation organization scope mismatch.");
    }
    if (Date.parse(input.revokedAt) < Date.parse(receipt.grantedAt)) {
      throw new Error("CanopyProof evidence consent revocation predates the receipt.");
    }
    const existingRevocationId = this.consentRevocationIdByReceiptId.get(receipt.id);
    const commandHash = consentRevocationCommandHash(receipt, input, actor);
    const id = `cp_evidence_consent_revocation_${commandHash.slice(0, 24)}`;
    if (existingRevocationId) {
      const existing = this.getConsentRevocation(existingRevocationId);
      if (existing.id === id) return existing;
      throw new Error("CanopyProof evidence consent receipt is already revoked by a different command.");
    }

    const events = this.eventsForSubject(actor.id);
    const subjectSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const seed = {
      id,
      receiptId: receipt.id,
      receiptRoot: receipt.receiptRoot,
      organizationId: actor.organizationId,
      subjectId: actor.id,
      subjectRoot: actor.participantRoot,
      reasonHash: normalizeHash(input.reasonHash),
      revokedAt: input.revokedAt,
      actor,
      commandHash,
      subjectSequence,
      previousEventRoot,
    };
    const revocationHash = hashJson({ kind: "canopyproof-evidence-consent-revocation-v2", ...seed });
    const revocationRoot = hashJson({
      kind: "canopyproof-evidence-consent-revocation-root-v2",
      receiptRoot: receipt.receiptRoot,
      subjectRoot: actor.participantRoot,
      reasonHash: seed.reasonHash,
      commandHash,
      revocationHash,
      subjectSequence,
      previousEventRoot,
    });
    const safety = custodySafetyBoundary();
    const payload = {
      factType: "evidence_consent_revocation",
      ...seed,
      revocationHash,
      revocationRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "CHALLENGE",
      actor: actor.id,
      entityType: "consent_revocation",
      entityId: id,
      payload,
      createdAt: input.revokedAt,
      rationale: "A subject-bound consent revocation was appended without mutating the original receipt.",
    }).at(-1)!;
    const revocation: CanopyProofEvidenceConsentRevocationFact = {
      factType: "evidence_consent_revocation",
      ...seed,
      revocationHash,
      revocationRoot,
      safety,
      auditEvent,
    };
    this.consentRevocationsById.set(id, revocation);
    this.consentRevocationIdByReceiptId.set(receipt.id, id);
    this.eventsBySubjectId.set(actor.id, [...events, auditEvent]);
    return revocation;
  }

  private replayConsentReceipt(expected: CanopyProofEvidenceConsentReceiptFact) {
    const replayed = this.recordConsentReceipt(
      {
        subjectId: expected.subjectId,
        ...(expected.deviceFingerprintHash ? { deviceFingerprintHash: expected.deviceFingerprintHash } : {}),
        purposes: expected.purposes,
        lawfulBasis: expected.lawfulBasis,
        privacyMode: expected.privacyMode,
        policyVersion: expected.policyVersion,
        evidenceHash: expected.evidenceHash,
        grantedAt: expected.grantedAt,
        ...(expected.expiresAt ? { expiresAt: expected.expiresAt } : {}),
        retentionDays: expected.retentionDays,
      },
      expected.actor,
    );
    assertReplay(replayed, expected, `consent receipt ${expected.id}`);
  }

  private replayConsentRevocation(expected: CanopyProofEvidenceConsentRevocationFact) {
    const replayed = this.appendConsentRevocation(
      expected.receiptId,
      { revokedAt: expected.revokedAt, reasonHash: expected.reasonHash },
      expected.actor,
    );
    assertReplay(replayed, expected, `consent revocation ${expected.id}`);
  }

  private replayDeviceAttestation(expected: CanopyProofEvidenceDeviceAttestationFact) {
    const replayed = this.recordDeviceAttestation(
      {
        subjectId: expected.subjectId,
        consentReceiptId: expected.consentReceiptId,
        deviceFingerprintHash: expected.deviceFingerprintHash,
        attestationType: expected.attestationType,
        provider: expected.provider,
        providerKeyId: expected.providerKeyId,
        providerReceiptHash: expected.providerReceiptHash,
        providerVerificationState: expected.providerVerificationState,
        publicKeyHash: expected.publicKeyHash,
        attestationHash: expected.attestationHash,
        issuedAt: expected.issuedAt,
        expiresAt: expected.expiresAt,
        reputationScore: expected.reputationScore,
        riskFlags: expected.riskFlags,
      },
      expected.actor,
    );
    assertReplay(replayed, expected, `device attestation ${expected.id}`);
  }

  private eventsForSubject(subjectId: string) {
    return this.eventsBySubjectId.get(subjectId) ?? [];
  }
}

export function canopyProofEvidenceCustodyActorAuthorityRoot(
  actor: Omit<CanopyProofEvidenceCustodyActorSnapshot, "authorityRoot">,
) {
  return hashJson({ kind: "canopyproof-evidence-custody-actor-authority-v2", ...actor });
}

function normalizeActor(input: CanopyProofEvidenceCustodyActorSnapshot): CanopyProofEvidenceCustodyActorSnapshot {
  const parsed = actorSchema.parse(input);
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
  } as const;
  const authorityRoot = canopyProofEvidenceCustodyActorAuthorityRoot(normalized);
  if (authorityRoot !== normalizeHash(parsed.authorityRoot)) {
    throw new Error("CanopyProof evidence custody actor authority root is invalid.");
  }
  return { ...normalized, authorityRoot };
}

function assertSelfAuthority(actor: CanopyProofEvidenceCustodyActorSnapshot, subjectId: string) {
  if (actor.id !== subjectId) {
    throw new Error("CanopyProof evidence custody E1 requires the verified human subject to act for itself.");
  }
}

function consentReceiptCommandHash(
  input: Readonly<{
    subjectId: string;
    deviceFingerprintHash?: string;
    purposes: readonly CanopyProofEvidenceConsentPurpose[];
    lawfulBasis: CanopyProofEvidenceConsentLawfulBasis;
    privacyMode: CanopyProofEvidenceConsentPrivacyMode;
    policyVersion: string;
    evidenceHash: string;
    grantedAt: string;
    expiresAt?: string;
    retentionDays: number;
  }>,
  actor: CanopyProofEvidenceCustodyActorSnapshot,
) {
  return hashJson({
    kind: "canopyproof-evidence-consent-receipt-command-v2",
    organizationId: actor.organizationId,
    subjectRoot: actor.participantRoot,
    subjectAuthorityRoot: actor.authorityRoot,
    ...input,
  });
}

function consentRevocationCommandHash(
  receipt: CanopyProofEvidenceConsentReceiptFact,
  input: Readonly<{ revokedAt: string; reasonHash: string }>,
  actor: CanopyProofEvidenceCustodyActorSnapshot,
) {
  return hashJson({
    kind: "canopyproof-evidence-consent-revocation-command-v2",
    receiptId: receipt.id,
    receiptRoot: receipt.receiptRoot,
    organizationId: actor.organizationId,
    subjectId: actor.id,
    subjectRoot: actor.participantRoot,
    subjectAuthorityRoot: actor.authorityRoot,
    reasonHash: normalizeHash(input.reasonHash),
    revokedAt: input.revokedAt,
  });
}

function deviceAttestationCommandHash(
  input: Readonly<{
    subjectId: string;
    consentReceiptId: string;
    deviceFingerprintHash: string;
    attestationType: CanopyProofEvidenceDeviceAttestationType;
    provider: CanopyProofEvidenceDeviceAttestationProvider;
    providerKeyId: string;
    providerReceiptHash: string;
    providerVerificationState: "modeled_only" | "verified";
    publicKeyHash: string;
    attestationHash: string;
    issuedAt: string;
    expiresAt: string;
    reputationScore: number;
    riskFlags: readonly CanopyProofEvidenceDeviceRiskFlag[];
  }>,
  actor: CanopyProofEvidenceCustodyActorSnapshot,
  consentReceiptRoot: string,
) {
  return hashJson({
    kind: "canopyproof-evidence-device-attestation-command-v2",
    organizationId: actor.organizationId,
    subjectRoot: actor.participantRoot,
    subjectAuthorityRoot: actor.authorityRoot,
    consentReceiptRoot,
    ...input,
  });
}

function custodySafetyBoundary(): CanopyProofEvidenceCustodySafetyBoundary {
  return {
    appendOnly: true,
    subjectBound: true,
    organizationBound: true,
    semanticEventBound: true,
    noRawDeviceIdentifier: true,
    noRawProviderCredential: true,
    providerVerificationRequiredForHardwareTrust: true,
    notFinalProofAuthority: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

function canonicalStringSet(values: readonly string[]) {
  return [...new Set(values.map((value) => value.trim()))].sort();
}

function normalizeHash(value: string) {
  return value.toLowerCase().replace(/^sha256:/, "");
}

function assertSafeIdentifierMaterial(value: string, label: string) {
  if (/(?:bearer\s+|password|secret|private[_ -]?key|BEGIN [A-Z ]*PRIVATE KEY|(?:sk|pk)_[a-z0-9_-]{12,})/i.test(value)) {
    throw new Error(`CanopyProof ${label} contains secret-like material.`);
  }
}

function assertSafeReason(value: string, label: string) {
  assertSafeIdentifierMaterial(value, label);
  if (/(?:certified carbon credit|carbon tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution)/i.test(value)) {
    throw new Error(`CanopyProof ${label} contains an unsupported public claim.`);
  }
}

function assertReplay(actual: unknown, expected: unknown, label: string) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CanopyProof evidence custody ${label} replay is invalid.`);
  }
}
