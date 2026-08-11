import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import type {
  CanopyProofEnvironmentalProofRecord,
  CanopyProofEnvironmentalProofSafetyBoundary,
} from "./environmental-proof-authority.js";
import type { CanopyProofEnvironmentalProofChallengedRecordProjection } from "./environmental-proof-challenge-authority.js";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  CanopyProofMrvGraphAuthorityService,
  type CanopyProofMrvGraphAuthoritySnapshot,
  type CanopyProofMrvGraphProjection,
  type CanopyProofMrvGraphSnapshotFact,
} from "./mrv-graph-authority.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofEnvironmentalProofLifecycleStates = [
  "issued",
  "active",
  "challenged",
  "suspended",
  "revoked",
  "expired",
  "superseded",
] as const;
export const canopyProofEnvironmentalProofSigningProviders = [
  "aws_kms",
  "gcp_cloud_kms",
  "azure_key_vault",
  "managed_hsm",
] as const;
export const canopyProofEnvironmentalProofSigningAlgorithms = [
  "ES256",
  "Ed25519",
  "RSA_PSS_SHA256",
] as const;
export const canopyProofEnvironmentalProofAssertionTypes = [
  "restoration_activity",
  "vegetation_condition",
  "biodiversity_condition",
  "water_condition",
  "soil_condition",
  "climate_observation",
] as const;
export const canopyProofEnvironmentalProofLifecycleControlActions = [
  "suspend",
  "reinstate",
  "supersede",
] as const;

export type CanopyProofEnvironmentalProofLifecycleState =
  (typeof canopyProofEnvironmentalProofLifecycleStates)[number];
export type CanopyProofEnvironmentalProofSigningProvider =
  (typeof canopyProofEnvironmentalProofSigningProviders)[number];
export type CanopyProofEnvironmentalProofSigningAlgorithm =
  (typeof canopyProofEnvironmentalProofSigningAlgorithms)[number];
export type CanopyProofEnvironmentalProofAssertionType =
  (typeof canopyProofEnvironmentalProofAssertionTypes)[number];
export type CanopyProofEnvironmentalProofLifecycleControlAction =
  (typeof canopyProofEnvironmentalProofLifecycleControlActions)[number];

export type CanopyProofEnvironmentalProofLifecycleSafetyBoundary = {
  readonly extendsCanonicalEnvironmentalProofRecord: true;
  readonly immutableIssuancePreserved: true;
  readonly governedRecordProjectionRequired: true;
  readonly reviewedMrvLineageRequired: true;
  readonly managedKeyVerificationRequired: true;
  readonly detachedSignatureVerificationRequired: true;
  readonly privateKeyMaterialForbidden: true;
  readonly humanIssuerRequired: true;
  readonly independentHumanGovernanceRequired: true;
  readonly appendOnly: true;
  readonly routeMounted: false;
  readonly productionActivationEnabled: false;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofEnvironmentalProofSigningKeyAttestationFact = {
  readonly factType: "environmental_proof_signing_key_attestation";
  readonly id: string;
  readonly organizationId: string;
  readonly provider: CanopyProofEnvironmentalProofSigningProvider;
  readonly providerKeyId: string;
  readonly keyVersion: string;
  readonly algorithm: CanopyProofEnvironmentalProofSigningAlgorithm;
  readonly purpose: "canopyproof_environmental_proof_record";
  readonly publicKeyHash: string;
  readonly providerAttestationHash: string;
  readonly activeFrom: string;
  readonly expiresAt?: string;
  readonly registrar: CanopyProofVerificationActorSnapshot;
  readonly externalVerifierId: string;
  readonly providerReceiptIdHash: string;
  readonly providerReceiptHash: string;
  readonly verifiedAt: string;
  readonly attestedAt: string;
  readonly commandHash: string;
  readonly organizationSequence: number;
  readonly previousEventRoot: string;
  readonly sourceRoot: string;
  readonly keyHash: string;
  readonly keyRoot: string;
  readonly safety: CanopyProofEnvironmentalProofLifecycleSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofSigningKeyRevocationFact = {
  readonly factType: "environmental_proof_signing_key_revocation";
  readonly id: string;
  readonly organizationId: string;
  readonly keyAuthorityId: string;
  readonly keyRoot: string;
  readonly reasonCode: string;
  readonly rationale: string;
  readonly revoker: CanopyProofVerificationActorSnapshot;
  readonly revokedAt: string;
  readonly commandHash: string;
  readonly organizationSequence: number;
  readonly previousEventRoot: string;
  readonly sourceRoot: string;
  readonly revocationHash: string;
  readonly revocationRoot: string;
  readonly safety: CanopyProofEnvironmentalProofLifecycleSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofLifecycleBindingFact = {
  readonly factType: "environmental_proof_lifecycle_binding";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly recordIssuedAt: string;
  readonly governedRecordProjectionRoot: string;
  readonly mrvSnapshotId: string;
  readonly mrvSnapshotRoot: string;
  readonly mrvEdgeSetRoot: string;
  readonly mrvGraphRoot: string;
  readonly mrvReviewedAt: string;
  readonly methodologyId: string;
  readonly methodologyPublicationRoot: string;
  readonly observationPeriod: {
    readonly startsAt: string;
    readonly endsAt: string;
  };
  readonly validity: {
    readonly validFrom: string;
    readonly expiresAt: string;
  };
  readonly monitoringSchedule: {
    readonly cadenceDays: number;
    readonly nextDueAt: string;
    readonly graceDays: number;
  };
  readonly assertionType: CanopyProofEnvironmentalProofAssertionType;
  readonly assertionScopeHash: string;
  readonly locationScopeHash: string;
  readonly uncertaintyHash: string;
  readonly limitationHashes: readonly string[];
  readonly relianceStatement: "environmental_accountability_only";
  readonly issuer: CanopyProofVerificationActorSnapshot;
  readonly signingKeyAuthorityId: string;
  readonly signingKeyRoot: string;
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly signaturePayloadHash: string;
  readonly boundAt: string;
  readonly commandHash: string;
  readonly recordSequence: number;
  readonly previousEventRoot: string;
  readonly bindingHash: string;
  readonly bindingRoot: string;
  readonly safety: CanopyProofEnvironmentalProofLifecycleSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofSignatureReceiptFact = {
  readonly factType: "environmental_proof_signature_receipt";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly bindingId: string;
  readonly bindingRoot: string;
  readonly signingKeyAuthorityId: string;
  readonly signingKeyRoot: string;
  readonly algorithm: CanopyProofEnvironmentalProofSigningAlgorithm;
  readonly signaturePayloadHash: string;
  readonly detachedSignature: string;
  readonly signatureHash: string;
  readonly externalVerifierId: string;
  readonly providerReceiptIdHash: string;
  readonly providerReceiptHash: string;
  readonly signedAt: string;
  readonly verifiedAt: string;
  readonly commandHash: string;
  readonly recordSequence: number;
  readonly previousEventRoot: string;
  readonly sourceRoot: string;
  readonly receiptHash: string;
  readonly receiptRoot: string;
  readonly safety: CanopyProofEnvironmentalProofLifecycleSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofLifecycleControlFact = {
  readonly factType: "environmental_proof_lifecycle_control";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly bindingId: string;
  readonly bindingRoot: string;
  readonly action: CanopyProofEnvironmentalProofLifecycleControlAction;
  readonly priorState: CanopyProofEnvironmentalProofLifecycleState;
  readonly priorProjectionRoot: string;
  readonly successorBindingId?: string;
  readonly successorBindingRoot?: string;
  readonly successorProjectionRoot?: string;
  readonly rationale: string;
  readonly conflictDisclosure: string;
  readonly sourceProjectionRoots: readonly string[];
  readonly sourceRoot: string;
  readonly governor: CanopyProofVerificationActorSnapshot;
  readonly decidedAt: string;
  readonly commandHash: string;
  readonly recordSequence: number;
  readonly previousEventRoot: string;
  readonly controlHash: string;
  readonly controlRoot: string;
  readonly safety: CanopyProofEnvironmentalProofLifecycleSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofEnvironmentalProofLifecycleProjection = {
  readonly organizationId: string;
  readonly projectId: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly bindingId: string;
  readonly bindingRoot: string;
  readonly state: CanopyProofEnvironmentalProofLifecycleState;
  readonly evaluatedAt: string;
  readonly governedRecordState: CanopyProofEnvironmentalProofChallengedRecordProjection["state"];
  readonly sourceAuthorityCurrent: boolean;
  readonly mrvState: CanopyProofMrvGraphProjection["state"];
  readonly boundMrvSnapshotCurrent: boolean;
  readonly keyState: "not_yet_active" | "active" | "expired" | "revoked";
  readonly signatureVerified: boolean;
  readonly validityCurrent: boolean;
  readonly currentControlAction?: CanopyProofEnvironmentalProofLifecycleControlAction;
  readonly successorBindingId?: string;
  readonly issueCodes: readonly string[];
  readonly projectionRoot: string;
  readonly safety: CanopyProofEnvironmentalProofLifecycleSafetyBoundary;
};

export type CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot = {
  readonly signingKeys: readonly CanopyProofEnvironmentalProofSigningKeyAttestationFact[];
  readonly signingKeyRevocations: readonly CanopyProofEnvironmentalProofSigningKeyRevocationFact[];
  readonly bindings: readonly CanopyProofEnvironmentalProofLifecycleBindingFact[];
  readonly signatureReceipts: readonly CanopyProofEnvironmentalProofSignatureReceiptFact[];
  readonly controls: readonly CanopyProofEnvironmentalProofLifecycleControlFact[];
};

export type CanopyProofManagedKeyAttestationVerificationRequest = {
  readonly organizationId: string;
  readonly provider: CanopyProofEnvironmentalProofSigningProvider;
  readonly providerKeyId: string;
  readonly keyVersion: string;
  readonly algorithm: CanopyProofEnvironmentalProofSigningAlgorithm;
  readonly purpose: "canopyproof_environmental_proof_record";
  readonly publicKeyHash: string;
  readonly providerAttestationHash: string;
  readonly activeFrom: string;
  readonly expiresAt?: string;
  readonly requestedAt: string;
};

export type CanopyProofDetachedSignatureVerificationRequest = {
  readonly organizationId: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly bindingId: string;
  readonly bindingRoot: string;
  readonly provider: CanopyProofEnvironmentalProofSigningProvider;
  readonly providerKeyId: string;
  readonly keyVersion: string;
  readonly algorithm: CanopyProofEnvironmentalProofSigningAlgorithm;
  readonly purpose: "canopyproof_environmental_proof_record";
  readonly publicKeyHash: string;
  readonly signaturePayloadHash: string;
  readonly detachedSignature: string;
  readonly signedAt: string;
};

export type CanopyProofExternalVerificationReceipt = {
  readonly verified: true;
  readonly externalVerifierId: string;
  readonly providerReceiptIdHash: string;
  readonly providerReceiptHash: string;
  readonly verifiedAt: string;
};

export interface CanopyProofEnvironmentalProofManagedSignatureVerifier {
  verifyManagedKeyAttestation(
    request: CanopyProofManagedKeyAttestationVerificationRequest,
  ): Promise<CanopyProofExternalVerificationReceipt>;
  verifyDetachedSignature(
    request: CanopyProofDetachedSignatureVerificationRequest,
  ): Promise<CanopyProofExternalVerificationReceipt>;
}

export type CanopyProofEnvironmentalProofLifecycleBindingAuthority = {
  readonly record: CanopyProofEnvironmentalProofRecord;
  readonly governedRecordProjection: CanopyProofEnvironmentalProofChallengedRecordProjection;
  readonly mrvAuthoritySnapshot: CanopyProofMrvGraphAuthoritySnapshot;
  readonly issuer: CanopyProofVerificationActorSnapshot;
  readonly signingKeyAuthorityId: string;
};

export type CanopyProofEnvironmentalProofLifecycleProjectionAuthority = {
  readonly governedRecordProjection: CanopyProofEnvironmentalProofChallengedRecordProjection;
  readonly mrvGraphProjection: CanopyProofMrvGraphProjection;
  readonly evaluatedAt: string;
};

export type CanopyProofEnvironmentalProofLifecycleControlAuthority = {
  readonly current: CanopyProofEnvironmentalProofLifecycleProjectionAuthority;
  readonly successor?: CanopyProofEnvironmentalProofLifecycleProjectionAuthority;
};

const HASH_PATTERN = /^(sha256:)?[a-f0-9]{64}$/i;
const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const hashSchema = z.string().regex(HASH_PATTERN);
const timestampSchema = z.string().datetime();
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.enum(["human", "agent"]),
    role: z.enum(["agent", "owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema.optional(),
    membershipStatus: z.literal("active").optional(),
    membershipRoot: hashSchema.optional(),
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: hashSchema.optional(),
    accreditationScope: z.array(identifierSchema).max(64).default([]),
    authorityRoot: hashSchema.optional(),
  })
  .strict();
const externalReceiptSchema = z
  .object({
    verified: z.literal(true),
    externalVerifierId: identifierSchema,
    providerReceiptIdHash: hashSchema,
    providerReceiptHash: hashSchema,
    verifiedAt: timestampSchema,
  })
  .strict();
const keyInputSchema = z
  .object({
    organizationId: identifierSchema,
    provider: z.enum(canopyProofEnvironmentalProofSigningProviders),
    providerKeyId: identifierSchema,
    keyVersion: identifierSchema,
    algorithm: z.enum(canopyProofEnvironmentalProofSigningAlgorithms),
    publicKeyHash: hashSchema,
    providerAttestationHash: hashSchema,
    activeFrom: timestampSchema,
    expiresAt: timestampSchema.optional(),
    attestedAt: timestampSchema,
  })
  .strict();
const keyRevocationInputSchema = z
  .object({
    reasonCode: z.string().trim().regex(/^[a-z0-9][a-z0-9_:-]{0,119}$/),
    rationale: z.string().trim().min(24).max(4_000),
    revokedAt: timestampSchema,
  })
  .strict();
const bindingInputSchema = z
  .object({
    recordId: identifierSchema,
    observationStartsAt: timestampSchema,
    observationEndsAt: timestampSchema,
    validFrom: timestampSchema,
    expiresAt: timestampSchema,
    monitoringCadenceDays: z.number().int().min(1).max(365),
    nextMonitoringDueAt: timestampSchema,
    monitoringGraceDays: z.number().int().min(0).max(90),
    assertionType: z.enum(canopyProofEnvironmentalProofAssertionTypes),
    assertionScopeHash: hashSchema,
    locationScopeHash: hashSchema,
    uncertaintyHash: hashSchema,
    limitationHashes: z.array(hashSchema).max(32).default([]),
    relianceStatement: z.literal("environmental_accountability_only"),
    boundAt: timestampSchema,
  })
  .strict();
const signatureInputSchema = z
  .object({
    detachedSignature: z.string().regex(/^[A-Za-z0-9_-]{16,8192}$/),
    signedAt: timestampSchema,
  })
  .strict();
const controlInputSchema = z
  .object({
    action: z.enum(canopyProofEnvironmentalProofLifecycleControlActions),
    successorBindingId: identifierSchema.optional(),
    rationale: z.string().trim().min(24).max(4_000),
    conflictDisclosure: z.string().trim().min(24).max(2_000),
    decidedAt: timestampSchema,
  })
  .strict();

const PURPOSE = "canopyproof_environmental_proof_record" as const;
const KEY_ADMIN_SCOPE = "environmental_proof_signing_key:admin";
const ISSUER_SCOPE = "environmental_proof_lifecycle:issue";
const GOVERNOR_SCOPE = "environmental_proof_lifecycle:govern";
const bindingAuditRationale =
  "A canonical Environmental Proof Record was bound to reviewed MRV lineage, fixed validity, and managed-key authority.";
const signatureAuditRationale =
  "An external managed-signature verifier accepted the detached signature for the exact lifecycle payload.";

export class CanopyProofEnvironmentalProofLifecycleAuthorityService {
  private readonly signingKeysById = new Map<string, CanopyProofEnvironmentalProofSigningKeyAttestationFact>();
  private readonly signingKeyIdByTuple = new Map<string, string>();
  private readonly keyRevocationsById = new Map<string, CanopyProofEnvironmentalProofSigningKeyRevocationFact>();
  private readonly keyRevocationIdByKeyId = new Map<string, string>();
  private readonly keyEventsByOrganizationId = new Map<string, CanopyProofAuditEvent[]>();
  private readonly bindingsById = new Map<string, CanopyProofEnvironmentalProofLifecycleBindingFact>();
  private readonly bindingIdByRecordId = new Map<string, string>();
  private readonly signaturesById = new Map<string, CanopyProofEnvironmentalProofSignatureReceiptFact>();
  private readonly signatureIdByBindingId = new Map<string, string>();
  private readonly controlsById = new Map<string, CanopyProofEnvironmentalProofLifecycleControlFact>();
  private readonly controlIdsByBindingId = new Map<string, string[]>();
  private readonly lifecycleEventsByRecordId = new Map<string, CanopyProofAuditEvent[]>();

  static fromAuthoritySnapshot(snapshot: CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot) {
    const service = new CanopyProofEnvironmentalProofLifecycleAuthorityService();
    assertUniqueFactIds(snapshot);
    const keyFacts = [...snapshot.signingKeys, ...snapshot.signingKeyRevocations].sort(compareOrganizationFacts);
    for (const fact of keyFacts) {
      if (fact.factType === "environmental_proof_signing_key_attestation") service.replaySigningKey(fact);
      else service.replaySigningKeyRevocation(fact);
    }
    for (const binding of [...snapshot.bindings].sort(compareRecordFacts)) service.replayBinding(binding);
    const lifecycleFacts = [...snapshot.signatureReceipts, ...snapshot.controls].sort(compareRecordFacts);
    for (const fact of lifecycleFacts) {
      if (fact.factType === "environmental_proof_signature_receipt") service.replaySignature(fact);
      else service.replayControl(fact);
    }
    return service;
  }

  async attestManagedSigningKey(
    input: unknown,
    registrarInput: unknown,
    verifier: CanopyProofEnvironmentalProofManagedSignatureVerifier,
  ): Promise<CanopyProofEnvironmentalProofSigningKeyAttestationFact> {
    const parsed = keyInputSchema.parse(input);
    const registrar = normalizeActor(registrarInput);
    assertAccreditedHuman(registrar, parsed.organizationId, KEY_ADMIN_SCOPE, ["owner", "admin"]);
    assertSafeText([parsed.providerKeyId, parsed.keyVersion]);
    assertCanonicalTimestamp(parsed.activeFrom, "key activeFrom");
    assertCanonicalTimestamp(parsed.attestedAt, "key attestedAt");
    if (Date.parse(parsed.activeFrom) > Date.parse(parsed.attestedAt)) {
      throw new Error("CanopyProof signing key cannot become active after its attestation time.");
    }
    if (parsed.expiresAt) {
      assertCanonicalTimestamp(parsed.expiresAt, "key expiresAt");
      if (Date.parse(parsed.expiresAt) <= Date.parse(parsed.attestedAt)) {
        throw new Error("CanopyProof signing key expiry must follow attestation.");
      }
      if (Date.parse(parsed.expiresAt) - Date.parse(parsed.activeFrom) > 366 * 5 * 86_400_000) {
        throw new Error("CanopyProof signing key authority cannot exceed five years.");
      }
    }
    const request: CanopyProofManagedKeyAttestationVerificationRequest = {
      organizationId: parsed.organizationId,
      provider: parsed.provider,
      providerKeyId: parsed.providerKeyId,
      keyVersion: parsed.keyVersion,
      algorithm: parsed.algorithm,
      purpose: PURPOSE,
      publicKeyHash: normalizeHash(parsed.publicKeyHash),
      providerAttestationHash: normalizeHash(parsed.providerAttestationHash),
      activeFrom: parsed.activeFrom,
      ...(parsed.expiresAt ? { expiresAt: parsed.expiresAt } : {}),
      requestedAt: parsed.attestedAt,
    };
    const receipt = normalizeExternalReceipt(await verifier.verifyManagedKeyAttestation(request));
    if (receipt.verifiedAt !== parsed.attestedAt) {
      throw new Error("CanopyProof managed-key verifier time must equal the attestation command time.");
    }
    const events = this.keyEventsByOrganizationId.get(parsed.organizationId) ?? [];
    assertMonotonicTime(events, parsed.attestedAt);
    const tuple = signingKeyTuple(request);
    const existingTupleId = this.signingKeyIdByTuple.get(tuple);
    const commandSeed = {
      ...request,
      registrar,
      externalVerifierId: receipt.externalVerifierId,
      providerReceiptIdHash: receipt.providerReceiptIdHash,
      providerReceiptHash: receipt.providerReceiptHash,
      verifiedAt: receipt.verifiedAt,
      attestedAt: parsed.attestedAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-environmental-proof-signing-key-command-v1", ...commandSeed });
    const id = `cp_environmental_proof_key_${commandHash.slice(0, 24)}`;
    if (existingTupleId) {
      const existing = this.getSigningKey(existingTupleId);
      if (existing.id === id && existing.commandHash === commandHash) return existing;
      throw new Error("CanopyProof managed signing key tuple already has conflicting authority.");
    }
    const organizationSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const sourceRoot = merkleRoot(
      [registrar.authorityRoot, request.publicKeyHash, request.providerAttestationHash, receipt.providerReceiptHash].sort(),
    );
    const seed = {
      id,
      organizationId: request.organizationId,
      provider: request.provider,
      providerKeyId: request.providerKeyId,
      keyVersion: request.keyVersion,
      algorithm: request.algorithm,
      purpose: request.purpose,
      publicKeyHash: request.publicKeyHash,
      providerAttestationHash: request.providerAttestationHash,
      activeFrom: request.activeFrom,
      ...(request.expiresAt ? { expiresAt: request.expiresAt } : {}),
      registrar,
      externalVerifierId: receipt.externalVerifierId,
      providerReceiptIdHash: receipt.providerReceiptIdHash,
      providerReceiptHash: receipt.providerReceiptHash,
      verifiedAt: receipt.verifiedAt,
      attestedAt: parsed.attestedAt,
      commandHash,
      organizationSequence,
      previousEventRoot,
      sourceRoot,
    };
    const keyHash = hashJson({ kind: "canopyproof-environmental-proof-signing-key-v1", ...seed });
    const keyRoot = hashJson({
      kind: "canopyproof-environmental-proof-signing-key-root-v1",
      organizationId: request.organizationId,
      sourceRoot,
      keyHash,
      previousEventRoot,
      organizationSequence,
    });
    const safety = lifecycleSafetyBoundary();
    const payload = {
      factType: "environmental_proof_signing_key_attestation" as const,
      ...seed,
      keyHash,
      keyRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "ASSERT",
      actor: registrar.id,
      entityType: "environmental_proof_signing_key_attestation",
      entityId: id,
      payload,
      createdAt: parsed.attestedAt,
      rationale: "A managed signing key public commitment passed external attestation verification.",
    }).at(-1)!;
    const fact: CanopyProofEnvironmentalProofSigningKeyAttestationFact = { ...payload, auditEvent };
    this.storeSigningKey(fact);
    return fact;
  }

  revokeManagedSigningKey(
    keyAuthorityId: string,
    input: unknown,
    revokerInput: unknown,
  ): CanopyProofEnvironmentalProofSigningKeyRevocationFact {
    const key = this.getSigningKey(keyAuthorityId);
    const parsed = keyRevocationInputSchema.parse(input);
    const revoker = normalizeActor(revokerInput);
    assertAccreditedHuman(revoker, key.organizationId, KEY_ADMIN_SCOPE, ["owner", "admin"]);
    assertSafeText([parsed.reasonCode, parsed.rationale]);
    assertCanonicalTimestamp(parsed.revokedAt, "key revokedAt");
    if (Date.parse(parsed.revokedAt) < Date.parse(key.attestedAt)) {
      throw new Error("CanopyProof signing key revocation cannot predate key attestation.");
    }
    const existingId = this.keyRevocationIdByKeyId.get(key.id);
    const events = this.keyEventsByOrganizationId.get(key.organizationId) ?? [];
    assertMonotonicTime(events, parsed.revokedAt);
    const commandSeed = {
      organizationId: key.organizationId,
      keyAuthorityId: key.id,
      keyRoot: key.keyRoot,
      reasonCode: parsed.reasonCode,
      rationale: parsed.rationale,
      revoker,
      revokedAt: parsed.revokedAt,
    };
    const commandHash = hashJson({
      kind: "canopyproof-environmental-proof-signing-key-revocation-command-v1",
      ...commandSeed,
    });
    const id = `cp_environmental_proof_key_revocation_${commandHash.slice(0, 24)}`;
    if (existingId) {
      const existing = this.getSigningKeyRevocation(existingId);
      if (existing.id === id && existing.commandHash === commandHash) return existing;
      throw new Error("CanopyProof managed signing key already has a conflicting revocation.");
    }
    const organizationSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const sourceRoot = merkleRoot([key.keyRoot, revoker.authorityRoot, key.auditEvent.eventRoot].sort());
    const seed = {
      id,
      ...commandSeed,
      commandHash,
      organizationSequence,
      previousEventRoot,
      sourceRoot,
    };
    const revocationHash = hashJson({
      kind: "canopyproof-environmental-proof-signing-key-revocation-v1",
      ...seed,
    });
    const revocationRoot = hashJson({
      kind: "canopyproof-environmental-proof-signing-key-revocation-root-v1",
      keyRoot: key.keyRoot,
      sourceRoot,
      revocationHash,
      previousEventRoot,
      organizationSequence,
    });
    const safety = lifecycleSafetyBoundary();
    const payload = {
      factType: "environmental_proof_signing_key_revocation" as const,
      ...seed,
      revocationHash,
      revocationRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "CHALLENGE",
      actor: revoker.id,
      entityType: "environmental_proof_signing_key_revocation",
      entityId: id,
      payload,
      createdAt: parsed.revokedAt,
      rationale: parsed.rationale,
    }).at(-1)!;
    const fact: CanopyProofEnvironmentalProofSigningKeyRevocationFact = { ...payload, auditEvent };
    this.storeSigningKeyRevocation(fact);
    return fact;
  }

  bindLifecycle(
    input: unknown,
    authority: CanopyProofEnvironmentalProofLifecycleBindingAuthority,
  ): CanopyProofEnvironmentalProofLifecycleBindingFact {
    const parsed = bindingInputSchema.parse(input);
    const issuer = normalizeActor(authority.issuer);
    const record = authority.record;
    if (parsed.recordId !== record.id) throw new Error("CanopyProof lifecycle record authority does not match input.");
    assertRecordPayload(record);
    assertAccreditedHuman(issuer, record.organizationId, ISSUER_SCOPE, ["owner", "admin"]);
    if (issuer.id !== record.issuer.id) {
      throw new Error("CanopyProof lifecycle issuer must be the human issuer named by the canonical record.");
    }
    const key = this.getSigningKey(authority.signingKeyAuthorityId);
    if (key.organizationId !== record.organizationId) {
      throw new Error("CanopyProof lifecycle signing key belongs to another organization.");
    }
    if (this.keyRevocationIdByKeyId.has(key.id)) {
      throw new Error("CanopyProof lifecycle cannot bind a revoked signing key.");
    }
    assertGovernedRecordProjection(authority.governedRecordProjection, record);
    if (
      authority.governedRecordProjection.state !== "issued" ||
      !authority.governedRecordProjection.sourceAuthorityCurrent
    ) {
      throw new Error("CanopyProof lifecycle requires a current unchallenged Environmental Proof Record.");
    }
    const mrv = CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(authority.mrvAuthoritySnapshot);
    const graph = mrv.projectGraph(record.organizationId, record.projectId);
    const latestSnapshot = mrv.listSnapshots({ organizationId: record.organizationId, projectId: record.projectId }).at(-1);
    if (!latestSnapshot || graph.state !== "reviewed_for_lineage") {
      throw new Error("CanopyProof lifecycle requires the latest independently reviewed MRV graph snapshot.");
    }
    assertMrvRecordSupport(authority.mrvAuthoritySnapshot, latestSnapshot, record);
    if (
      latestSnapshot.methodology.id !== record.methodologyId ||
      latestSnapshot.methodology.publicationRoot !== record.methodologyPublicationRoot
    ) {
      throw new Error("CanopyProof lifecycle MRV methodology does not match the canonical record.");
    }
    const limitationHashes = canonicalHashes(parsed.limitationHashes);
    assertCanonicalValues(parsed.limitationHashes, limitationHashes, "limitation hashes");
    for (const [value, label] of [
      [parsed.observationStartsAt, "observationStartsAt"],
      [parsed.observationEndsAt, "observationEndsAt"],
      [parsed.validFrom, "validFrom"],
      [parsed.expiresAt, "expiresAt"],
      [parsed.nextMonitoringDueAt, "nextMonitoringDueAt"],
      [parsed.boundAt, "boundAt"],
    ] as const) {
      assertCanonicalTimestamp(value, `lifecycle ${label}`);
    }
    assertBindingChronology(parsed, record, latestSnapshot, key);
    const existingId = this.bindingIdByRecordId.get(record.id);
    const sourceEventRoots = canonicalHashes([
      record.auditEvent.eventRoot,
      latestSnapshot.auditEvent.eventRoot,
      key.auditEvent.eventRoot,
    ]);
    const sourceRoot = merkleRoot(
      [
        record.recordRoot,
        authority.governedRecordProjection.projectionRoot,
        latestSnapshot.snapshotRoot,
        graph.graphRoot,
        key.keyRoot,
        issuer.authorityRoot,
        ...sourceEventRoots,
      ].sort(),
    );
    const bindingSeed = {
      organizationId: record.organizationId,
      projectId: record.projectId,
      recordId: record.id,
      recordRoot: record.recordRoot,
      recordIssuedAt: record.issuedAt,
      governedRecordProjectionRoot: authority.governedRecordProjection.projectionRoot,
      mrvSnapshotId: latestSnapshot.id,
      mrvSnapshotRoot: latestSnapshot.snapshotRoot,
      mrvEdgeSetRoot: latestSnapshot.edgeSetRoot,
      mrvGraphRoot: graph.graphRoot,
      mrvReviewedAt: latestSnapshot.reviewedAt,
      methodologyId: record.methodologyId,
      methodologyPublicationRoot: record.methodologyPublicationRoot,
      observationPeriod: { startsAt: parsed.observationStartsAt, endsAt: parsed.observationEndsAt },
      validity: { validFrom: parsed.validFrom, expiresAt: parsed.expiresAt },
      monitoringSchedule: {
        cadenceDays: parsed.monitoringCadenceDays,
        nextDueAt: parsed.nextMonitoringDueAt,
        graceDays: parsed.monitoringGraceDays,
      },
      assertionType: parsed.assertionType,
      assertionScopeHash: normalizeHash(parsed.assertionScopeHash),
      locationScopeHash: normalizeHash(parsed.locationScopeHash),
      uncertaintyHash: normalizeHash(parsed.uncertaintyHash),
      limitationHashes,
      relianceStatement: parsed.relianceStatement,
      issuer,
      signingKeyAuthorityId: key.id,
      signingKeyRoot: key.keyRoot,
      sourceEventRoots,
      sourceRoot,
      boundAt: parsed.boundAt,
    };
    const signaturePayloadHash = hashJson({
      kind: "canopyproof-environmental-proof-signature-payload-v1",
      ...bindingSeed,
    });
    const commandHash = hashJson({
      kind: "canopyproof-environmental-proof-lifecycle-binding-command-v1",
      ...bindingSeed,
      signaturePayloadHash,
    });
    const id = `cp_environmental_proof_lifecycle_${commandHash.slice(0, 24)}`;
    if (existingId) {
      const existing = this.getBinding(existingId);
      if (existing.id === id && existing.commandHash === commandHash) return existing;
      throw new Error("CanopyProof Environmental Proof Record already has a conflicting lifecycle binding.");
    }
    const events = this.lifecycleEventsByRecordId.get(record.id) ?? [];
    if (events.length !== 0) throw new Error("CanopyProof lifecycle binding must be the first record lifecycle fact.");
    const recordSequence = 1;
    const previousEventRoot = canopyProofAuditGenesisRoot();
    const seed = { id, ...bindingSeed, signaturePayloadHash, commandHash, recordSequence, previousEventRoot };
    const bindingHash = hashJson({ kind: "canopyproof-environmental-proof-lifecycle-binding-v1", ...seed });
    const bindingRoot = hashJson({
      kind: "canopyproof-environmental-proof-lifecycle-binding-root-v1",
      recordRoot: record.recordRoot,
      mrvSnapshotRoot: latestSnapshot.snapshotRoot,
      signingKeyRoot: key.keyRoot,
      sourceRoot,
      bindingHash,
      previousEventRoot,
      recordSequence,
    });
    const safety = lifecycleSafetyBoundary();
    const payload = {
      factType: "environmental_proof_lifecycle_binding" as const,
      ...seed,
      bindingHash,
      bindingRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "ASSERT",
      actor: issuer.id,
      entityType: "environmental_proof_lifecycle_binding",
      entityId: id,
      payload,
      createdAt: parsed.boundAt,
      rationale: bindingAuditRationale,
    }).at(-1)!;
    const fact: CanopyProofEnvironmentalProofLifecycleBindingFact = { ...payload, auditEvent };
    this.storeBinding(fact);
    return fact;
  }

  async recordSignatureReceipt(
    bindingId: string,
    input: unknown,
    verifier: CanopyProofEnvironmentalProofManagedSignatureVerifier,
  ): Promise<CanopyProofEnvironmentalProofSignatureReceiptFact> {
    const binding = this.getBinding(bindingId);
    const parsed = signatureInputSchema.parse(input);
    const key = this.getSigningKey(binding.signingKeyAuthorityId);
    assertSafeText([parsed.detachedSignature]);
    assertCanonicalTimestamp(parsed.signedAt, "signature signedAt");
    if (Date.parse(parsed.signedAt) < Date.parse(binding.boundAt)) {
      throw new Error("CanopyProof lifecycle signature cannot predate its binding.");
    }
    if (Date.parse(parsed.signedAt) >= Date.parse(binding.validity.expiresAt)) {
      throw new Error("CanopyProof lifecycle signature must precede record expiry.");
    }
    if (Date.parse(parsed.signedAt) < Date.parse(key.activeFrom)) {
      throw new Error("CanopyProof lifecycle signature predates signing-key activation.");
    }
    if (key.expiresAt && Date.parse(parsed.signedAt) >= Date.parse(key.expiresAt)) {
      throw new Error("CanopyProof lifecycle signature uses an expired signing key.");
    }
    const revocation = this.getSigningKeyRevocationForKey(key.id);
    if (revocation && Date.parse(parsed.signedAt) >= Date.parse(revocation.revokedAt)) {
      throw new Error("CanopyProof lifecycle signature uses a revoked signing key.");
    }
    const request: CanopyProofDetachedSignatureVerificationRequest = {
      organizationId: binding.organizationId,
      recordId: binding.recordId,
      recordRoot: binding.recordRoot,
      bindingId: binding.id,
      bindingRoot: binding.bindingRoot,
      provider: key.provider,
      providerKeyId: key.providerKeyId,
      keyVersion: key.keyVersion,
      algorithm: key.algorithm,
      purpose: key.purpose,
      publicKeyHash: key.publicKeyHash,
      signaturePayloadHash: binding.signaturePayloadHash,
      detachedSignature: parsed.detachedSignature,
      signedAt: parsed.signedAt,
    };
    const external = normalizeExternalReceipt(await verifier.verifyDetachedSignature(request));
    if (Date.parse(external.verifiedAt) < Date.parse(parsed.signedAt)) {
      throw new Error("CanopyProof signature verification cannot predate signing.");
    }
    if (Date.parse(external.verifiedAt) >= Date.parse(binding.validity.expiresAt)) {
      throw new Error("CanopyProof signature verification must complete before record expiry.");
    }
    const signatureHash = hashJson({
      kind: "canopyproof-environmental-proof-detached-signature-v1",
      algorithm: key.algorithm,
      detachedSignature: parsed.detachedSignature,
    });
    const commandSeed = {
      organizationId: binding.organizationId,
      projectId: binding.projectId,
      recordId: binding.recordId,
      recordRoot: binding.recordRoot,
      bindingId: binding.id,
      bindingRoot: binding.bindingRoot,
      signingKeyAuthorityId: key.id,
      signingKeyRoot: key.keyRoot,
      algorithm: key.algorithm,
      signaturePayloadHash: binding.signaturePayloadHash,
      detachedSignature: parsed.detachedSignature,
      signatureHash,
      externalVerifierId: external.externalVerifierId,
      providerReceiptIdHash: external.providerReceiptIdHash,
      providerReceiptHash: external.providerReceiptHash,
      signedAt: parsed.signedAt,
      verifiedAt: external.verifiedAt,
    };
    const commandHash = hashJson({
      kind: "canopyproof-environmental-proof-signature-receipt-command-v1",
      ...commandSeed,
    });
    const id = `cp_environmental_proof_signature_${commandHash.slice(0, 24)}`;
    const existingId = this.signatureIdByBindingId.get(binding.id);
    if (existingId) {
      const existing = this.getSignatureReceipt(existingId);
      if (existing.id === id && existing.commandHash === commandHash) return existing;
      throw new Error("CanopyProof lifecycle binding already has a conflicting signature receipt.");
    }
    const events = this.lifecycleEventsByRecordId.get(binding.recordId) ?? [];
    assertMonotonicTime(events, external.verifiedAt);
    const recordSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const sourceRoot = merkleRoot(
      [binding.bindingRoot, key.keyRoot, signatureHash, external.providerReceiptHash].sort(),
    );
    const seed = { id, ...commandSeed, commandHash, recordSequence, previousEventRoot, sourceRoot };
    const receiptHash = hashJson({ kind: "canopyproof-environmental-proof-signature-receipt-v1", ...seed });
    const receiptRoot = hashJson({
      kind: "canopyproof-environmental-proof-signature-receipt-root-v1",
      bindingRoot: binding.bindingRoot,
      signingKeyRoot: key.keyRoot,
      sourceRoot,
      receiptHash,
      previousEventRoot,
      recordSequence,
    });
    const safety = lifecycleSafetyBoundary();
    const payload = {
      factType: "environmental_proof_signature_receipt" as const,
      ...seed,
      receiptHash,
      receiptRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "FULFILL",
      actor: external.externalVerifierId,
      entityType: "environmental_proof_signature_receipt",
      entityId: id,
      payload,
      createdAt: external.verifiedAt,
      rationale: signatureAuditRationale,
    }).at(-1)!;
    const fact: CanopyProofEnvironmentalProofSignatureReceiptFact = { ...payload, auditEvent };
    this.storeSignature(fact);
    return fact;
  }

  recordControl(
    bindingId: string,
    input: unknown,
    governorInput: unknown,
    authority: CanopyProofEnvironmentalProofLifecycleControlAuthority,
  ): CanopyProofEnvironmentalProofLifecycleControlFact {
    const binding = this.getBinding(bindingId);
    const parsed = controlInputSchema.parse(input);
    const governor = normalizeActor(governorInput);
    assertAccreditedHuman(governor, binding.organizationId, GOVERNOR_SCOPE, ["owner", "admin", "verifier"]);
    if (governor.id === binding.issuer.id) {
      throw new Error("CanopyProof lifecycle control requires an independent human governor.");
    }
    assertSafeText([parsed.rationale, parsed.conflictDisclosure, parsed.successorBindingId ?? ""]);
    assertCanonicalTimestamp(parsed.decidedAt, "lifecycle control decidedAt");
    if (authority.current.evaluatedAt !== parsed.decidedAt) {
      throw new Error("CanopyProof lifecycle control must use an authority projection at its decision time.");
    }
    const prior = this.projectLifecycle(binding.id, authority.current);
    const currentControl = this.listControls(binding.id).at(-1);
    let successor: CanopyProofEnvironmentalProofLifecycleBindingFact | undefined;
    let successorProjection: CanopyProofEnvironmentalProofLifecycleProjection | undefined;
    if (parsed.action === "suspend") {
      if (parsed.successorBindingId) throw new Error("CanopyProof suspend control cannot name a successor.");
      if (["revoked", "expired", "superseded", "suspended"].includes(prior.state)) {
        throw new Error(`CanopyProof lifecycle cannot suspend from ${prior.state}.`);
      }
    } else if (parsed.action === "reinstate") {
      if (parsed.successorBindingId) throw new Error("CanopyProof reinstate control cannot name a successor.");
      if (!currentControl || currentControl.action !== "suspend" || prior.state !== "suspended") {
        throw new Error("CanopyProof lifecycle reinstatement requires a current explicit suspension.");
      }
      const withoutControl = this.projectLifecycle(binding.id, authority.current, { ignoreExplicitSuspension: true });
      if (withoutControl.state !== "active") {
        throw new Error("CanopyProof lifecycle cannot reinstate while an activation gate remains closed.");
      }
    } else {
      if (!parsed.successorBindingId || !authority.successor) {
        throw new Error("CanopyProof lifecycle supersession requires successor binding and authority.");
      }
      successor = this.getBinding(parsed.successorBindingId);
      if (
        successor.id === binding.id ||
        successor.organizationId !== binding.organizationId ||
        successor.projectId !== binding.projectId ||
        Date.parse(successor.boundAt) <= Date.parse(binding.boundAt)
      ) {
        throw new Error("CanopyProof lifecycle successor must be a distinct later binding for the same project.");
      }
      if (authority.successor.evaluatedAt !== parsed.decidedAt) {
        throw new Error("CanopyProof lifecycle successor projection must use the decision time.");
      }
      successorProjection = this.projectLifecycle(successor.id, authority.successor);
      if (successorProjection.state !== "active") {
        throw new Error("CanopyProof lifecycle successor must be active before supersession.");
      }
      if (prior.state === "superseded") throw new Error("CanopyProof lifecycle is already superseded.");
    }
    const events = this.lifecycleEventsByRecordId.get(binding.recordId) ?? [];
    assertMonotonicTime(events, parsed.decidedAt);
    const sourceProjectionRoots = canonicalHashes([
      prior.projectionRoot,
      authority.current.governedRecordProjection.projectionRoot,
      authority.current.mrvGraphProjection.graphRoot,
      ...(successorProjection ? [successorProjection.projectionRoot] : []),
    ]);
    const commandSeed = {
      organizationId: binding.organizationId,
      projectId: binding.projectId,
      recordId: binding.recordId,
      recordRoot: binding.recordRoot,
      bindingId: binding.id,
      bindingRoot: binding.bindingRoot,
      action: parsed.action,
      priorState: prior.state,
      priorProjectionRoot: prior.projectionRoot,
      ...(successor
        ? {
            successorBindingId: successor.id,
            successorBindingRoot: successor.bindingRoot,
            successorProjectionRoot: successorProjection!.projectionRoot,
          }
        : {}),
      rationale: parsed.rationale,
      conflictDisclosure: parsed.conflictDisclosure,
      sourceProjectionRoots,
      governor,
      decidedAt: parsed.decidedAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-environmental-proof-lifecycle-control-command-v1", ...commandSeed });
    const id = `cp_environmental_proof_lifecycle_control_${commandHash.slice(0, 24)}`;
    const existing = this.controlsById.get(id);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error(`CanopyProof lifecycle control conflicts with committed authority: ${id}`);
    }
    const recordSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const sourceRoot = merkleRoot(
      [binding.bindingRoot, governor.authorityRoot, ...sourceProjectionRoots, ...(currentControl ? [currentControl.controlRoot] : [])].sort(),
    );
    const seed = { id, ...commandSeed, sourceRoot, commandHash, recordSequence, previousEventRoot };
    const controlHash = hashJson({ kind: "canopyproof-environmental-proof-lifecycle-control-v1", ...seed });
    const controlRoot = hashJson({
      kind: "canopyproof-environmental-proof-lifecycle-control-root-v1",
      bindingRoot: binding.bindingRoot,
      sourceRoot,
      controlHash,
      previousEventRoot,
      recordSequence,
    });
    const safety = lifecycleSafetyBoundary();
    const payload = {
      factType: "environmental_proof_lifecycle_control" as const,
      ...seed,
      controlHash,
      controlRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: parsed.action === "suspend" ? "CHALLENGE" : "FULFILL",
      actor: governor.id,
      entityType: "environmental_proof_lifecycle_control",
      entityId: id,
      payload,
      createdAt: parsed.decidedAt,
      rationale: parsed.rationale,
    }).at(-1)!;
    const fact: CanopyProofEnvironmentalProofLifecycleControlFact = { ...payload, auditEvent };
    this.storeControl(fact);
    return fact;
  }

  projectLifecycle(
    bindingId: string,
    authority: CanopyProofEnvironmentalProofLifecycleProjectionAuthority,
    options: Readonly<{ ignoreExplicitSuspension?: boolean }> = {},
  ): CanopyProofEnvironmentalProofLifecycleProjection {
    const binding = this.getBinding(bindingId);
    assertCanonicalTimestamp(authority.evaluatedAt, "lifecycle evaluatedAt");
    assertGovernedProjectionShape(authority.governedRecordProjection, binding.recordId, binding.recordRoot);
    assertMrvProjectionShape(authority.mrvGraphProjection, binding.organizationId, binding.projectId);
    const evaluationMs = Date.parse(authority.evaluatedAt);
    const key = this.getSigningKey(binding.signingKeyAuthorityId);
    const revocation = this.getSigningKeyRevocationForKey(key.id);
    const signature = this.getSignatureReceiptForBinding(binding.id);
    const controls = this.listControls(binding.id).filter(
      (control) => Date.parse(control.decidedAt) <= evaluationMs,
    );
    const currentControl = controls.at(-1);
    const keyState = deriveKeyState(key, revocation, evaluationMs);
    const boundMrvSnapshotCurrent =
      authority.mrvGraphProjection.state === "reviewed_for_lineage" &&
      authority.mrvGraphProjection.latestSnapshotId === binding.mrvSnapshotId &&
      authority.mrvGraphProjection.latestSnapshotRoot === binding.mrvSnapshotRoot;
    const validityCurrent =
      evaluationMs >= Date.parse(binding.validity.validFrom) &&
      evaluationMs < Date.parse(binding.validity.expiresAt);
    const issueCodes: string[] = [];
    if (authority.governedRecordProjection.state !== "issued") {
      issueCodes.push(`record_${authority.governedRecordProjection.state}`);
    }
    if (!authority.governedRecordProjection.sourceAuthorityCurrent) issueCodes.push("record_source_stale");
    if (!boundMrvSnapshotCurrent) issueCodes.push("mrv_snapshot_not_current");
    if (authority.mrvGraphProjection.state !== "reviewed_for_lineage") issueCodes.push("mrv_review_required");
    if (!signature) issueCodes.push("signature_missing");
    if (keyState !== "active") issueCodes.push(`signing_key_${keyState}`);
    if (evaluationMs < Date.parse(binding.validity.validFrom)) issueCodes.push("not_yet_valid");
    if (evaluationMs >= Date.parse(binding.validity.expiresAt)) issueCodes.push("validity_expired");
    if (currentControl?.action === "suspend" && !options.ignoreExplicitSuspension) issueCodes.push("governance_suspended");
    if (currentControl?.action === "supersede") issueCodes.push("record_superseded");
    const uniqueIssueCodes = [...new Set(issueCodes)].sort();
    let state: CanopyProofEnvironmentalProofLifecycleState;
    if (currentControl?.action === "supersede") state = "superseded";
    else if (authority.governedRecordProjection.state === "revoked") state = "revoked";
    else if (authority.governedRecordProjection.state === "challenged") state = "challenged";
    else if (evaluationMs >= Date.parse(binding.validity.expiresAt)) state = "expired";
    else if (
      (currentControl?.action === "suspend" && !options.ignoreExplicitSuspension) ||
      authority.governedRecordProjection.state !== "issued" ||
      !authority.governedRecordProjection.sourceAuthorityCurrent ||
      !boundMrvSnapshotCurrent ||
      keyState !== "active"
    ) {
      state = "suspended";
    } else if (!signature || evaluationMs < Date.parse(binding.validity.validFrom)) state = "issued";
    else state = "active";
    const seed = {
      organizationId: binding.organizationId,
      projectId: binding.projectId,
      recordId: binding.recordId,
      recordRoot: binding.recordRoot,
      bindingId: binding.id,
      bindingRoot: binding.bindingRoot,
      state,
      evaluatedAt: authority.evaluatedAt,
      governedRecordState: authority.governedRecordProjection.state,
      sourceAuthorityCurrent: authority.governedRecordProjection.sourceAuthorityCurrent,
      mrvState: authority.mrvGraphProjection.state,
      boundMrvSnapshotCurrent,
      keyState,
      signatureVerified: Boolean(signature),
      validityCurrent,
      currentControlAction: currentControl?.action ?? null,
      successorBindingId: currentControl?.successorBindingId ?? null,
      issueCodes: uniqueIssueCodes,
    };
    return {
      organizationId: binding.organizationId,
      projectId: binding.projectId,
      recordId: binding.recordId,
      recordRoot: binding.recordRoot,
      bindingId: binding.id,
      bindingRoot: binding.bindingRoot,
      state,
      evaluatedAt: authority.evaluatedAt,
      governedRecordState: authority.governedRecordProjection.state,
      sourceAuthorityCurrent: authority.governedRecordProjection.sourceAuthorityCurrent,
      mrvState: authority.mrvGraphProjection.state,
      boundMrvSnapshotCurrent,
      keyState,
      signatureVerified: Boolean(signature),
      validityCurrent,
      ...(currentControl ? { currentControlAction: currentControl.action } : {}),
      ...(currentControl?.successorBindingId ? { successorBindingId: currentControl.successorBindingId } : {}),
      issueCodes: uniqueIssueCodes,
      projectionRoot: hashJson({ kind: "canopyproof-environmental-proof-lifecycle-projection-v1", ...seed }),
      safety: lifecycleSafetyBoundary(),
    };
  }

  getSigningKey(id: string) {
    const fact = this.signingKeysById.get(id);
    if (!fact) throw new Error(`CanopyProof managed signing key not found: ${id}`);
    return fact;
  }

  getSigningKeyRevocation(id: string) {
    const fact = this.keyRevocationsById.get(id);
    if (!fact) throw new Error(`CanopyProof managed signing key revocation not found: ${id}`);
    return fact;
  }

  getBinding(id: string) {
    const fact = this.bindingsById.get(id);
    if (!fact) throw new Error(`CanopyProof Environmental Proof lifecycle binding not found: ${id}`);
    return fact;
  }

  getSignatureReceipt(id: string) {
    const fact = this.signaturesById.get(id);
    if (!fact) throw new Error(`CanopyProof Environmental Proof signature receipt not found: ${id}`);
    return fact;
  }

  getControl(id: string) {
    const fact = this.controlsById.get(id);
    if (!fact) throw new Error(`CanopyProof Environmental Proof lifecycle control not found: ${id}`);
    return fact;
  }

  listSigningKeys(organizationId?: string) {
    return [...this.signingKeysById.values()]
      .filter((fact) => !organizationId || fact.organizationId === organizationId)
      .sort(compareOrganizationFacts);
  }

  listSigningKeyRevocations(organizationId?: string) {
    return [...this.keyRevocationsById.values()]
      .filter((fact) => !organizationId || fact.organizationId === organizationId)
      .sort(compareOrganizationFacts);
  }

  listBindings(organizationId?: string) {
    return [...this.bindingsById.values()]
      .filter((fact) => !organizationId || fact.organizationId === organizationId)
      .sort((left, right) => left.boundAt.localeCompare(right.boundAt) || left.id.localeCompare(right.id));
  }

  listSignatureReceipts(organizationId?: string) {
    return [...this.signaturesById.values()]
      .filter((fact) => !organizationId || fact.organizationId === organizationId)
      .sort(compareRecordFacts);
  }

  listControls(bindingId: string) {
    this.getBinding(bindingId);
    return (this.controlIdsByBindingId.get(bindingId) ?? [])
      .map((id) => this.controlsById.get(id)!)
      .sort(compareRecordFacts);
  }

  getAuthoritySnapshot(): CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot {
    return {
      signingKeys: this.listSigningKeys(),
      signingKeyRevocations: this.listSigningKeyRevocations(),
      bindings: this.listBindings(),
      signatureReceipts: this.listSignatureReceipts(),
      controls: [...this.controlsById.values()].sort(compareRecordFacts),
    };
  }

  private getSigningKeyRevocationForKey(keyId: string) {
    const id = this.keyRevocationIdByKeyId.get(keyId);
    return id ? this.getSigningKeyRevocation(id) : undefined;
  }

  private getSignatureReceiptForBinding(bindingId: string) {
    const id = this.signatureIdByBindingId.get(bindingId);
    return id ? this.getSignatureReceipt(id) : undefined;
  }

  private storeSigningKey(fact: CanopyProofEnvironmentalProofSigningKeyAttestationFact) {
    this.signingKeysById.set(fact.id, fact);
    this.signingKeyIdByTuple.set(signingKeyTuple(fact), fact.id);
    this.keyEventsByOrganizationId.set(fact.organizationId, [
      ...(this.keyEventsByOrganizationId.get(fact.organizationId) ?? []),
      fact.auditEvent,
    ]);
  }

  private storeSigningKeyRevocation(fact: CanopyProofEnvironmentalProofSigningKeyRevocationFact) {
    this.keyRevocationsById.set(fact.id, fact);
    this.keyRevocationIdByKeyId.set(fact.keyAuthorityId, fact.id);
    this.keyEventsByOrganizationId.set(fact.organizationId, [
      ...(this.keyEventsByOrganizationId.get(fact.organizationId) ?? []),
      fact.auditEvent,
    ]);
  }

  private storeBinding(fact: CanopyProofEnvironmentalProofLifecycleBindingFact) {
    this.bindingsById.set(fact.id, fact);
    this.bindingIdByRecordId.set(fact.recordId, fact.id);
    this.lifecycleEventsByRecordId.set(fact.recordId, [fact.auditEvent]);
  }

  private storeSignature(fact: CanopyProofEnvironmentalProofSignatureReceiptFact) {
    this.signaturesById.set(fact.id, fact);
    this.signatureIdByBindingId.set(fact.bindingId, fact.id);
    this.lifecycleEventsByRecordId.set(fact.recordId, [
      ...(this.lifecycleEventsByRecordId.get(fact.recordId) ?? []),
      fact.auditEvent,
    ]);
  }

  private storeControl(fact: CanopyProofEnvironmentalProofLifecycleControlFact) {
    this.controlsById.set(fact.id, fact);
    this.controlIdsByBindingId.set(fact.bindingId, [
      ...(this.controlIdsByBindingId.get(fact.bindingId) ?? []),
      fact.id,
    ]);
    this.lifecycleEventsByRecordId.set(fact.recordId, [
      ...(this.lifecycleEventsByRecordId.get(fact.recordId) ?? []),
      fact.auditEvent,
    ]);
  }

  private replaySigningKey(fact: CanopyProofEnvironmentalProofSigningKeyAttestationFact) {
    const registrar = normalizeActor(fact.registrar);
    assertAccreditedHuman(registrar, fact.organizationId, KEY_ADMIN_SCOPE, ["owner", "admin"]);
    const events = this.keyEventsByOrganizationId.get(fact.organizationId) ?? [];
    if (fact.organizationSequence !== events.length + 1) throw new Error("CanopyProof key snapshot sequence is invalid.");
    if (fact.previousEventRoot !== (events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot())) {
      throw new Error("CanopyProof key snapshot previous event root is invalid.");
    }
    assertCanonicalTimestamp(fact.activeFrom, "key snapshot activeFrom");
    assertCanonicalTimestamp(fact.attestedAt, "key snapshot attestedAt");
    assertCanonicalTimestamp(fact.verifiedAt, "key snapshot verifiedAt");
    if (fact.expiresAt) assertCanonicalTimestamp(fact.expiresAt, "key snapshot expiresAt");
    const expectedCommandHash = hashJson({
      kind: "canopyproof-environmental-proof-signing-key-command-v1",
      ...signingKeyCommandSeed(fact, registrar),
    });
    const expectedSourceRoot = merkleRoot(
      [registrar.authorityRoot, fact.publicKeyHash, fact.providerAttestationHash, fact.providerReceiptHash].sort(),
    );
    if (
      fact.commandHash !== expectedCommandHash ||
      fact.id !== `cp_environmental_proof_key_${expectedCommandHash.slice(0, 24)}` ||
      fact.sourceRoot !== expectedSourceRoot
    ) {
      throw new Error("CanopyProof managed signing key snapshot command authority is invalid.");
    }
    const seed = signingKeyFactSeed(fact, registrar);
    const expectedHash = hashJson({ kind: "canopyproof-environmental-proof-signing-key-v1", ...seed });
    const expectedRoot = hashJson({
      kind: "canopyproof-environmental-proof-signing-key-root-v1",
      organizationId: fact.organizationId,
      sourceRoot: fact.sourceRoot,
      keyHash: expectedHash,
      previousEventRoot: fact.previousEventRoot,
      organizationSequence: fact.organizationSequence,
    });
    assertFactIntegrity(fact, expectedHash, fact.keyHash, expectedRoot, fact.keyRoot, events,
      "environmental_proof_signing_key_attestation", "ASSERT",
      "A managed signing key public commitment passed external attestation verification.", fact.attestedAt,
      registrar.id, { ...fact, registrar, auditEvent: undefined });
    if (this.signingKeyIdByTuple.has(signingKeyTuple(fact))) throw new Error("CanopyProof key snapshot duplicates a key tuple.");
    this.storeSigningKey({ ...fact, registrar });
  }

  private replaySigningKeyRevocation(fact: CanopyProofEnvironmentalProofSigningKeyRevocationFact) {
    const key = this.getSigningKey(fact.keyAuthorityId);
    const revoker = normalizeActor(fact.revoker);
    const events = this.keyEventsByOrganizationId.get(fact.organizationId) ?? [];
    if (key.keyRoot !== fact.keyRoot || key.organizationId !== fact.organizationId) {
      throw new Error("CanopyProof key revocation snapshot source is invalid.");
    }
    if (this.keyRevocationIdByKeyId.has(key.id)) throw new Error("CanopyProof key snapshot contains duplicate revocation.");
    assertAccreditedHuman(revoker, fact.organizationId, KEY_ADMIN_SCOPE, ["owner", "admin"]);
    assertCanonicalTimestamp(fact.revokedAt, "key revocation snapshot revokedAt");
    assertMonotonicTime(events, fact.revokedAt);
    const expectedCommandHash = hashJson({
      kind: "canopyproof-environmental-proof-signing-key-revocation-command-v1",
      organizationId: fact.organizationId,
      keyAuthorityId: fact.keyAuthorityId,
      keyRoot: fact.keyRoot,
      reasonCode: fact.reasonCode,
      rationale: fact.rationale,
      revoker,
      revokedAt: fact.revokedAt,
    });
    const expectedSourceRoot = merkleRoot([key.keyRoot, revoker.authorityRoot, key.auditEvent.eventRoot].sort());
    if (
      fact.commandHash !== expectedCommandHash ||
      fact.id !== `cp_environmental_proof_key_revocation_${expectedCommandHash.slice(0, 24)}` ||
      fact.sourceRoot !== expectedSourceRoot
    ) {
      throw new Error("CanopyProof key revocation snapshot command authority is invalid.");
    }
    const seed = keyRevocationFactSeed(fact, revoker);
    const expectedHash = hashJson({ kind: "canopyproof-environmental-proof-signing-key-revocation-v1", ...seed });
    const expectedRoot = hashJson({
      kind: "canopyproof-environmental-proof-signing-key-revocation-root-v1",
      keyRoot: fact.keyRoot,
      sourceRoot: fact.sourceRoot,
      revocationHash: expectedHash,
      previousEventRoot: fact.previousEventRoot,
      organizationSequence: fact.organizationSequence,
    });
    assertFactIntegrity(fact, expectedHash, fact.revocationHash, expectedRoot, fact.revocationRoot, events,
      "environmental_proof_signing_key_revocation", "CHALLENGE", fact.rationale, fact.revokedAt,
      revoker.id, { ...fact, revoker, auditEvent: undefined });
    this.storeSigningKeyRevocation({ ...fact, revoker });
  }

  private replayBinding(fact: CanopyProofEnvironmentalProofLifecycleBindingFact) {
    const issuer = normalizeActor(fact.issuer);
    const key = this.getSigningKey(fact.signingKeyAuthorityId);
    const events = this.lifecycleEventsByRecordId.get(fact.recordId) ?? [];
    if (events.length !== 0 || fact.recordSequence !== 1 || fact.previousEventRoot !== canopyProofAuditGenesisRoot()) {
      throw new Error("CanopyProof lifecycle binding snapshot lineage is invalid.");
    }
    if (key.keyRoot !== fact.signingKeyRoot || key.organizationId !== fact.organizationId) {
      throw new Error("CanopyProof lifecycle binding snapshot key authority is invalid.");
    }
    assertAccreditedHuman(issuer, fact.organizationId, ISSUER_SCOPE, ["owner", "admin"]);
    assertCanonicalTimestamp(fact.boundAt, "lifecycle binding snapshot boundAt");
    const authoritySeed = bindingAuthoritySeed(fact, issuer);
    const expectedSignaturePayloadHash = hashJson({
      kind: "canopyproof-environmental-proof-signature-payload-v1",
      ...authoritySeed,
    });
    const expectedCommandHash = hashJson({
      kind: "canopyproof-environmental-proof-lifecycle-binding-command-v1",
      ...authoritySeed,
      signaturePayloadHash: expectedSignaturePayloadHash,
    });
    const expectedSourceRoot = merkleRoot(
      [
        fact.recordRoot,
        fact.governedRecordProjectionRoot,
        fact.mrvSnapshotRoot,
        fact.mrvGraphRoot,
        fact.signingKeyRoot,
        issuer.authorityRoot,
        ...fact.sourceEventRoots,
      ].sort(),
    );
    if (
      fact.signaturePayloadHash !== expectedSignaturePayloadHash ||
      fact.commandHash !== expectedCommandHash ||
      fact.id !== `cp_environmental_proof_lifecycle_${expectedCommandHash.slice(0, 24)}` ||
      fact.sourceRoot !== expectedSourceRoot
    ) {
      throw new Error("CanopyProof lifecycle binding snapshot command authority is invalid.");
    }
    const seed = bindingFactSeed(fact, issuer);
    const expectedHash = hashJson({ kind: "canopyproof-environmental-proof-lifecycle-binding-v1", ...seed });
    const expectedRoot = hashJson({
      kind: "canopyproof-environmental-proof-lifecycle-binding-root-v1",
      recordRoot: fact.recordRoot,
      mrvSnapshotRoot: fact.mrvSnapshotRoot,
      signingKeyRoot: fact.signingKeyRoot,
      sourceRoot: fact.sourceRoot,
      bindingHash: expectedHash,
      previousEventRoot: fact.previousEventRoot,
      recordSequence: fact.recordSequence,
    });
    assertFactIntegrity(fact, expectedHash, fact.bindingHash, expectedRoot, fact.bindingRoot, events,
      "environmental_proof_lifecycle_binding", "ASSERT", bindingAuditRationale, fact.boundAt,
      issuer.id, { ...fact, issuer, auditEvent: undefined });
    if (this.bindingIdByRecordId.has(fact.recordId)) throw new Error("CanopyProof lifecycle snapshot duplicates a record binding.");
    this.storeBinding({ ...fact, issuer });
  }

  private replaySignature(fact: CanopyProofEnvironmentalProofSignatureReceiptFact) {
    const binding = this.getBinding(fact.bindingId);
    const key = this.getSigningKey(fact.signingKeyAuthorityId);
    const events = this.lifecycleEventsByRecordId.get(fact.recordId) ?? [];
    if (binding.bindingRoot !== fact.bindingRoot || key.keyRoot !== fact.signingKeyRoot) {
      throw new Error("CanopyProof signature receipt snapshot source is invalid.");
    }
    if (this.signatureIdByBindingId.has(binding.id)) throw new Error("CanopyProof lifecycle snapshot duplicates a signature receipt.");
    assertCanonicalTimestamp(fact.signedAt, "signature snapshot signedAt");
    assertCanonicalTimestamp(fact.verifiedAt, "signature snapshot verifiedAt");
    assertMonotonicTime(events, fact.verifiedAt);
    const expectedSignatureHash = hashJson({
      kind: "canopyproof-environmental-proof-detached-signature-v1",
      algorithm: fact.algorithm,
      detachedSignature: fact.detachedSignature,
    });
    const expectedCommandHash = hashJson({
      kind: "canopyproof-environmental-proof-signature-receipt-command-v1",
      ...signatureCommandSeed(fact, expectedSignatureHash),
    });
    const expectedSourceRoot = merkleRoot(
      [fact.bindingRoot, fact.signingKeyRoot, expectedSignatureHash, fact.providerReceiptHash].sort(),
    );
    if (
      fact.signatureHash !== expectedSignatureHash ||
      fact.commandHash !== expectedCommandHash ||
      fact.id !== `cp_environmental_proof_signature_${expectedCommandHash.slice(0, 24)}` ||
      fact.sourceRoot !== expectedSourceRoot
    ) {
      throw new Error("CanopyProof signature receipt snapshot command authority is invalid.");
    }
    const seed = signatureFactSeed(fact);
    const expectedHash = hashJson({ kind: "canopyproof-environmental-proof-signature-receipt-v1", ...seed });
    const expectedRoot = hashJson({
      kind: "canopyproof-environmental-proof-signature-receipt-root-v1",
      bindingRoot: fact.bindingRoot,
      signingKeyRoot: fact.signingKeyRoot,
      sourceRoot: fact.sourceRoot,
      receiptHash: expectedHash,
      previousEventRoot: fact.previousEventRoot,
      recordSequence: fact.recordSequence,
    });
    assertFactIntegrity(fact, expectedHash, fact.receiptHash, expectedRoot, fact.receiptRoot, events,
      "environmental_proof_signature_receipt", "FULFILL", signatureAuditRationale, fact.verifiedAt,
      fact.externalVerifierId, { ...fact, auditEvent: undefined });
    this.storeSignature(fact);
  }

  private replayControl(fact: CanopyProofEnvironmentalProofLifecycleControlFact) {
    const binding = this.getBinding(fact.bindingId);
    const governor = normalizeActor(fact.governor);
    const events = this.lifecycleEventsByRecordId.get(fact.recordId) ?? [];
    if (binding.bindingRoot !== fact.bindingRoot || binding.recordRoot !== fact.recordRoot) {
      throw new Error("CanopyProof lifecycle control snapshot source is invalid.");
    }
    assertAccreditedHuman(governor, fact.organizationId, GOVERNOR_SCOPE, ["owner", "admin", "verifier"]);
    if (governor.id === binding.issuer.id) {
      throw new Error("CanopyProof lifecycle control snapshot violates issuer/governor separation.");
    }
    assertCanonicalTimestamp(fact.decidedAt, "lifecycle control snapshot decidedAt");
    assertMonotonicTime(events, fact.decidedAt);
    assertCanonicalValues(fact.sourceProjectionRoots, canonicalHashes(fact.sourceProjectionRoots), "control source roots");
    const priorControl = this.listControls(binding.id).at(-1);
    const expectedCommandHash = hashJson({
      kind: "canopyproof-environmental-proof-lifecycle-control-command-v1",
      ...controlCommandSeed(fact, governor),
    });
    const expectedSourceRoot = merkleRoot(
      [
        fact.bindingRoot,
        governor.authorityRoot,
        ...fact.sourceProjectionRoots,
        ...(priorControl ? [priorControl.controlRoot] : []),
      ].sort(),
    );
    if (
      fact.commandHash !== expectedCommandHash ||
      fact.id !== `cp_environmental_proof_lifecycle_control_${expectedCommandHash.slice(0, 24)}` ||
      fact.sourceRoot !== expectedSourceRoot
    ) {
      throw new Error("CanopyProof lifecycle control snapshot command authority is invalid.");
    }
    if (fact.action === "supersede") {
      if (!fact.successorBindingId || !fact.successorBindingRoot || !fact.successorProjectionRoot) {
        throw new Error("CanopyProof lifecycle supersession snapshot is incomplete.");
      }
      const successor = this.getBinding(fact.successorBindingId);
      if (
        successor.bindingRoot !== fact.successorBindingRoot ||
        successor.organizationId !== fact.organizationId ||
        successor.projectId !== fact.projectId ||
        Date.parse(successor.boundAt) <= Date.parse(binding.boundAt)
      ) {
        throw new Error("CanopyProof lifecycle supersession snapshot successor is invalid.");
      }
    } else if (fact.successorBindingId || fact.successorBindingRoot || fact.successorProjectionRoot) {
      throw new Error("CanopyProof non-supersession control cannot bind a successor.");
    }
    const seed = controlFactSeed(fact, governor);
    const expectedHash = hashJson({ kind: "canopyproof-environmental-proof-lifecycle-control-v1", ...seed });
    const expectedRoot = hashJson({
      kind: "canopyproof-environmental-proof-lifecycle-control-root-v1",
      bindingRoot: fact.bindingRoot,
      sourceRoot: fact.sourceRoot,
      controlHash: expectedHash,
      previousEventRoot: fact.previousEventRoot,
      recordSequence: fact.recordSequence,
    });
    assertFactIntegrity(fact, expectedHash, fact.controlHash, expectedRoot, fact.controlRoot, events,
      "environmental_proof_lifecycle_control", fact.action === "suspend" ? "CHALLENGE" : "FULFILL",
      fact.rationale, fact.decidedAt, governor.id, { ...fact, governor, auditEvent: undefined });
    this.storeControl({ ...fact, governor });
  }
}

export function canopyProofEnvironmentalProofLifecycleSafetyBoundary(): CanopyProofEnvironmentalProofLifecycleSafetyBoundary {
  return lifecycleSafetyBoundary();
}

export function verifyCanopyProofEnvironmentalProofLifecycleProjection(
  projection: CanopyProofEnvironmentalProofLifecycleProjection,
) {
  const issueCodes = [...projection.issueCodes].sort();
  if (
    new Set(issueCodes).size !== issueCodes.length ||
    hashJson(issueCodes) !== hashJson(projection.issueCodes) ||
    (projection.currentControlAction === "supersede" && !projection.successorBindingId) ||
    (projection.successorBindingId !== undefined && projection.currentControlAction !== "supersede")
  ) {
    return false;
  }
  const seed = {
    organizationId: projection.organizationId,
    projectId: projection.projectId,
    recordId: projection.recordId,
    recordRoot: projection.recordRoot,
    bindingId: projection.bindingId,
    bindingRoot: projection.bindingRoot,
    state: projection.state,
    evaluatedAt: projection.evaluatedAt,
    governedRecordState: projection.governedRecordState,
    sourceAuthorityCurrent: projection.sourceAuthorityCurrent,
    mrvState: projection.mrvState,
    boundMrvSnapshotCurrent: projection.boundMrvSnapshotCurrent,
    keyState: projection.keyState,
    signatureVerified: projection.signatureVerified,
    validityCurrent: projection.validityCurrent,
    currentControlAction: projection.currentControlAction ?? null,
    successorBindingId: projection.successorBindingId ?? null,
    issueCodes: projection.issueCodes,
  };
  return (
    projection.projectionRoot ===
      hashJson({ kind: "canopyproof-environmental-proof-lifecycle-projection-v1", ...seed }) &&
    hashJson(projection.safety) === hashJson(lifecycleSafetyBoundary())
  );
}

function lifecycleSafetyBoundary(): CanopyProofEnvironmentalProofLifecycleSafetyBoundary {
  return {
    extendsCanonicalEnvironmentalProofRecord: true,
    immutableIssuancePreserved: true,
    governedRecordProjectionRequired: true,
    reviewedMrvLineageRequired: true,
    managedKeyVerificationRequired: true,
    detachedSignatureVerificationRequired: true,
    privateKeyMaterialForbidden: true,
    humanIssuerRequired: true,
    independentHumanGovernanceRequired: true,
    appendOnly: true,
    routeMounted: false,
    productionActivationEnabled: false,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

function normalizeActor(input: unknown): CanopyProofVerificationActorSnapshot {
  const parsed = actorSchema.parse(input);
  const accreditationScope = canonicalIdentifiers(parsed.accreditationScope);
  assertCanonicalValues(parsed.accreditationScope, accreditationScope, "actor accreditation scope");
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: normalizeHash(parsed.participantRoot),
    organizationRoot: normalizeHash(parsed.organizationRoot),
    ...(parsed.membershipId ? { membershipId: parsed.membershipId } : {}),
    ...(parsed.membershipStatus ? { membershipStatus: parsed.membershipStatus } : {}),
    ...(parsed.membershipRoot ? { membershipRoot: normalizeHash(parsed.membershipRoot) } : {}),
    ...(parsed.accreditationId ? { accreditationId: parsed.accreditationId } : {}),
    ...(parsed.accreditationStatus ? { accreditationStatus: parsed.accreditationStatus } : {}),
    ...(parsed.accreditationRoot ? { accreditationRoot: normalizeHash(parsed.accreditationRoot) } : {}),
    accreditationScope,
  };
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized });
  if (parsed.authorityRoot && normalizeHash(parsed.authorityRoot) !== authorityRoot) {
    throw new Error("CanopyProof lifecycle actor authority root is invalid.");
  }
  return { ...normalized, authorityRoot };
}

function assertAccreditedHuman(
  actor: CanopyProofVerificationActorSnapshot,
  organizationId: string,
  requiredScope: string,
  allowedRoles: readonly CanopyProofVerificationActorSnapshot["role"][],
) {
  if (actor.participantType !== "human" || !allowedRoles.includes(actor.role)) {
    throw new Error("CanopyProof lifecycle authority requires an authorized human role.");
  }
  if (
    actor.organizationId !== organizationId ||
    actor.membershipStatus !== "active" ||
    !actor.membershipId ||
    !actor.membershipRoot
  ) {
    throw new Error("CanopyProof lifecycle authority requires current organization membership.");
  }
  if (
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationRoot ||
    !actor.accreditationScope.includes(requiredScope)
  ) {
    throw new Error(`CanopyProof lifecycle authority requires approved accreditation scope: ${requiredScope}`);
  }
}

function normalizeExternalReceipt(input: unknown): CanopyProofExternalVerificationReceipt {
  const parsed = externalReceiptSchema.parse(input);
  assertCanonicalTimestamp(parsed.verifiedAt, "external verifier verifiedAt");
  return {
    verified: true,
    externalVerifierId: parsed.externalVerifierId,
    providerReceiptIdHash: normalizeHash(parsed.providerReceiptIdHash),
    providerReceiptHash: normalizeHash(parsed.providerReceiptHash),
    verifiedAt: parsed.verifiedAt,
  };
}

function assertRecordPayload(record: CanopyProofEnvironmentalProofRecord) {
  const { auditEvent, ...payload } = record;
  if (
    record.factType !== "environmental_proof_record" ||
    record.recordType !== "environmental_proof_record" ||
    record.status !== "issued" ||
    auditEvent.entityType !== "environmental_proof_record" ||
    auditEvent.entityId !== record.id ||
    auditEvent.payloadHash !== hashJson(payload) ||
    !isEnvironmentalProofSafetyBoundary(record.claimBoundary)
  ) {
    throw new Error("CanopyProof lifecycle canonical Environmental Proof Record payload is invalid.");
  }
}

function isEnvironmentalProofSafetyBoundary(input: CanopyProofEnvironmentalProofSafetyBoundary) {
  return (
    input.environmentalAccountabilityOnly === true &&
    input.notCertifiedCarbonCredit === true &&
    input.notCarbonTaxOffset === true &&
    input.notFinancialAsset === true &&
    input.notGuaranteedYield === true &&
    input.noMainnetFunds === true &&
    input.notAutomaticCanopyDistribution === true
  );
}

function assertGovernedRecordProjection(
  projection: CanopyProofEnvironmentalProofChallengedRecordProjection,
  record: CanopyProofEnvironmentalProofRecord,
) {
  assertGovernedProjectionShape(projection, record.id, record.recordRoot);
}

function assertGovernedProjectionShape(
  projection: CanopyProofEnvironmentalProofChallengedRecordProjection,
  recordId: string,
  recordRoot: string,
) {
  const seed = {
    recordId,
    recordRoot,
    state: projection.state,
    baseState: projection.baseState,
    sourceAuthorityCurrent: projection.sourceAuthorityCurrent,
    challengeState: projection.challengeState ?? null,
    challengeId: projection.challengeId ?? null,
    challengeRoot: projection.challengeRoot ?? null,
    resolutionId: projection.resolutionId ?? null,
    resolutionRoot: projection.resolutionRoot ?? null,
  };
  const expected = hashJson({ kind: "canopyproof-environmental-proof-challenged-record-projection-v1", ...seed });
  if (
    projection.recordId !== recordId ||
    projection.recordRoot !== recordRoot ||
    projection.projectionRoot !== expected
  ) {
    throw new Error("CanopyProof lifecycle governed record projection is invalid.");
  }
}

function assertMrvProjectionShape(projection: CanopyProofMrvGraphProjection, organizationId: string, projectId: string) {
  const seed = projection.latestSnapshotId
    ? {
        organizationId,
        projectId,
        state: projection.state,
        latestSnapshotId: projection.latestSnapshotId,
        latestSnapshotRoot: projection.latestSnapshotRoot,
        finalProofChanged: false as const,
      }
    : { organizationId, projectId, state: "empty" as const, finalProofChanged: false as const };
  if (
    projection.organizationId !== organizationId ||
    projection.projectId !== projectId ||
    projection.finalProofChanged !== false ||
    projection.graphRoot !== hashJson({ kind: "canopyproof-mrv-graph-projection-v1", ...seed })
  ) {
    throw new Error("CanopyProof lifecycle MRV graph projection is invalid.");
  }
}

function assertMrvRecordSupport(
  snapshot: CanopyProofMrvGraphAuthoritySnapshot,
  latest: CanopyProofMrvGraphSnapshotFact,
  record: CanopyProofEnvironmentalProofRecord,
) {
  const memberEdgeIds = new Set(
    snapshot.snapshotMembers.filter((member) => member.snapshotId === latest.id).map((member) => member.edgeId),
  );
  const supportsRecord = snapshot.edges.some(
    (edge) =>
      memberEdgeIds.has(edge.id) &&
      edge.relationship === "SUPPORTS" &&
      edge.target.type === "environmental_proof_record" &&
      edge.target.id === record.id &&
      edge.target.root === record.recordRoot,
  );
  if (!supportsRecord) throw new Error("CanopyProof lifecycle MRV snapshot does not support the exact record root.");
}

function assertBindingChronology(
  parsed: z.infer<typeof bindingInputSchema>,
  record: CanopyProofEnvironmentalProofRecord,
  snapshot: CanopyProofMrvGraphSnapshotFact,
  key: CanopyProofEnvironmentalProofSigningKeyAttestationFact,
) {
  const observationStart = Date.parse(parsed.observationStartsAt);
  const observationEnd = Date.parse(parsed.observationEndsAt);
  const validFrom = Date.parse(parsed.validFrom);
  const expiresAt = Date.parse(parsed.expiresAt);
  const nextDue = Date.parse(parsed.nextMonitoringDueAt);
  const boundAt = Date.parse(parsed.boundAt);
  if (observationStart >= observationEnd || observationEnd > Date.parse(record.issuedAt)) {
    throw new Error("CanopyProof lifecycle observation period must end no later than record issuance.");
  }
  if (boundAt < Date.parse(record.issuedAt) || boundAt < Date.parse(snapshot.reviewedAt)) {
    throw new Error("CanopyProof lifecycle binding cannot predate its record or MRV review.");
  }
  if (validFrom < boundAt || expiresAt <= validFrom) {
    throw new Error("CanopyProof lifecycle validity must begin at or after binding and end later.");
  }
  if (expiresAt - validFrom > 366 * 86_400_000) {
    throw new Error("CanopyProof lifecycle validity cannot exceed 366 days.");
  }
  if (nextDue <= validFrom || nextDue > expiresAt) {
    throw new Error("CanopyProof lifecycle monitoring due time must fall inside validity.");
  }
  if (boundAt < Date.parse(key.activeFrom) || (key.expiresAt && validFrom >= Date.parse(key.expiresAt))) {
    throw new Error("CanopyProof lifecycle signing key is not valid for binding.");
  }
}

function deriveKeyState(
  key: CanopyProofEnvironmentalProofSigningKeyAttestationFact,
  revocation: CanopyProofEnvironmentalProofSigningKeyRevocationFact | undefined,
  evaluationMs: number,
): CanopyProofEnvironmentalProofLifecycleProjection["keyState"] {
  if (revocation && Date.parse(revocation.revokedAt) <= evaluationMs) return "revoked";
  if (evaluationMs < Date.parse(key.activeFrom)) return "not_yet_active";
  if (key.expiresAt && evaluationMs >= Date.parse(key.expiresAt)) return "expired";
  return "active";
}

function signingKeyTuple(input: Pick<
  CanopyProofEnvironmentalProofSigningKeyAttestationFact,
  "organizationId" | "provider" | "providerKeyId" | "keyVersion" | "purpose"
> | CanopyProofManagedKeyAttestationVerificationRequest) {
  return [input.organizationId, input.provider, input.providerKeyId, input.keyVersion, input.purpose].join("\u0000");
}

function signingKeyFactSeed(
  fact: CanopyProofEnvironmentalProofSigningKeyAttestationFact,
  registrar: CanopyProofVerificationActorSnapshot,
) {
  return {
    id: fact.id,
    organizationId: fact.organizationId,
    provider: fact.provider,
    providerKeyId: fact.providerKeyId,
    keyVersion: fact.keyVersion,
    algorithm: fact.algorithm,
    purpose: fact.purpose,
    publicKeyHash: fact.publicKeyHash,
    providerAttestationHash: fact.providerAttestationHash,
    activeFrom: fact.activeFrom,
    ...(fact.expiresAt ? { expiresAt: fact.expiresAt } : {}),
    registrar,
    externalVerifierId: fact.externalVerifierId,
    providerReceiptIdHash: fact.providerReceiptIdHash,
    providerReceiptHash: fact.providerReceiptHash,
    verifiedAt: fact.verifiedAt,
    attestedAt: fact.attestedAt,
    commandHash: fact.commandHash,
    organizationSequence: fact.organizationSequence,
    previousEventRoot: fact.previousEventRoot,
    sourceRoot: fact.sourceRoot,
  };
}

function signingKeyCommandSeed(
  fact: CanopyProofEnvironmentalProofSigningKeyAttestationFact,
  registrar: CanopyProofVerificationActorSnapshot,
) {
  return {
    organizationId: fact.organizationId,
    provider: fact.provider,
    providerKeyId: fact.providerKeyId,
    keyVersion: fact.keyVersion,
    algorithm: fact.algorithm,
    purpose: fact.purpose,
    publicKeyHash: fact.publicKeyHash,
    providerAttestationHash: fact.providerAttestationHash,
    activeFrom: fact.activeFrom,
    ...(fact.expiresAt ? { expiresAt: fact.expiresAt } : {}),
    requestedAt: fact.attestedAt,
    registrar,
    externalVerifierId: fact.externalVerifierId,
    providerReceiptIdHash: fact.providerReceiptIdHash,
    providerReceiptHash: fact.providerReceiptHash,
    verifiedAt: fact.verifiedAt,
    attestedAt: fact.attestedAt,
  };
}

function keyRevocationFactSeed(
  fact: CanopyProofEnvironmentalProofSigningKeyRevocationFact,
  revoker: CanopyProofVerificationActorSnapshot,
) {
  return {
    id: fact.id,
    organizationId: fact.organizationId,
    keyAuthorityId: fact.keyAuthorityId,
    keyRoot: fact.keyRoot,
    reasonCode: fact.reasonCode,
    rationale: fact.rationale,
    revoker,
    revokedAt: fact.revokedAt,
    commandHash: fact.commandHash,
    organizationSequence: fact.organizationSequence,
    previousEventRoot: fact.previousEventRoot,
    sourceRoot: fact.sourceRoot,
  };
}

function bindingFactSeed(
  fact: CanopyProofEnvironmentalProofLifecycleBindingFact,
  issuer: CanopyProofVerificationActorSnapshot,
) {
  return {
    id: fact.id,
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    recordIssuedAt: fact.recordIssuedAt,
    governedRecordProjectionRoot: fact.governedRecordProjectionRoot,
    mrvSnapshotId: fact.mrvSnapshotId,
    mrvSnapshotRoot: fact.mrvSnapshotRoot,
    mrvEdgeSetRoot: fact.mrvEdgeSetRoot,
    mrvGraphRoot: fact.mrvGraphRoot,
    mrvReviewedAt: fact.mrvReviewedAt,
    methodologyId: fact.methodologyId,
    methodologyPublicationRoot: fact.methodologyPublicationRoot,
    observationPeriod: fact.observationPeriod,
    validity: fact.validity,
    monitoringSchedule: fact.monitoringSchedule,
    assertionType: fact.assertionType,
    assertionScopeHash: fact.assertionScopeHash,
    locationScopeHash: fact.locationScopeHash,
    uncertaintyHash: fact.uncertaintyHash,
    limitationHashes: fact.limitationHashes,
    relianceStatement: fact.relianceStatement,
    issuer,
    signingKeyAuthorityId: fact.signingKeyAuthorityId,
    signingKeyRoot: fact.signingKeyRoot,
    sourceEventRoots: fact.sourceEventRoots,
    sourceRoot: fact.sourceRoot,
    signaturePayloadHash: fact.signaturePayloadHash,
    boundAt: fact.boundAt,
    commandHash: fact.commandHash,
    recordSequence: fact.recordSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function bindingAuthoritySeed(
  fact: CanopyProofEnvironmentalProofLifecycleBindingFact,
  issuer: CanopyProofVerificationActorSnapshot,
) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    recordIssuedAt: fact.recordIssuedAt,
    governedRecordProjectionRoot: fact.governedRecordProjectionRoot,
    mrvSnapshotId: fact.mrvSnapshotId,
    mrvSnapshotRoot: fact.mrvSnapshotRoot,
    mrvEdgeSetRoot: fact.mrvEdgeSetRoot,
    mrvGraphRoot: fact.mrvGraphRoot,
    mrvReviewedAt: fact.mrvReviewedAt,
    methodologyId: fact.methodologyId,
    methodologyPublicationRoot: fact.methodologyPublicationRoot,
    observationPeriod: fact.observationPeriod,
    validity: fact.validity,
    monitoringSchedule: fact.monitoringSchedule,
    assertionType: fact.assertionType,
    assertionScopeHash: fact.assertionScopeHash,
    locationScopeHash: fact.locationScopeHash,
    uncertaintyHash: fact.uncertaintyHash,
    limitationHashes: fact.limitationHashes,
    relianceStatement: fact.relianceStatement,
    issuer,
    signingKeyAuthorityId: fact.signingKeyAuthorityId,
    signingKeyRoot: fact.signingKeyRoot,
    sourceEventRoots: fact.sourceEventRoots,
    sourceRoot: fact.sourceRoot,
    boundAt: fact.boundAt,
  };
}

function signatureFactSeed(fact: CanopyProofEnvironmentalProofSignatureReceiptFact) {
  return {
    id: fact.id,
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    bindingId: fact.bindingId,
    bindingRoot: fact.bindingRoot,
    signingKeyAuthorityId: fact.signingKeyAuthorityId,
    signingKeyRoot: fact.signingKeyRoot,
    algorithm: fact.algorithm,
    signaturePayloadHash: fact.signaturePayloadHash,
    detachedSignature: fact.detachedSignature,
    signatureHash: fact.signatureHash,
    externalVerifierId: fact.externalVerifierId,
    providerReceiptIdHash: fact.providerReceiptIdHash,
    providerReceiptHash: fact.providerReceiptHash,
    signedAt: fact.signedAt,
    verifiedAt: fact.verifiedAt,
    commandHash: fact.commandHash,
    recordSequence: fact.recordSequence,
    previousEventRoot: fact.previousEventRoot,
    sourceRoot: fact.sourceRoot,
  };
}

function signatureCommandSeed(
  fact: CanopyProofEnvironmentalProofSignatureReceiptFact,
  signatureHash: string,
) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    bindingId: fact.bindingId,
    bindingRoot: fact.bindingRoot,
    signingKeyAuthorityId: fact.signingKeyAuthorityId,
    signingKeyRoot: fact.signingKeyRoot,
    algorithm: fact.algorithm,
    signaturePayloadHash: fact.signaturePayloadHash,
    detachedSignature: fact.detachedSignature,
    signatureHash,
    externalVerifierId: fact.externalVerifierId,
    providerReceiptIdHash: fact.providerReceiptIdHash,
    providerReceiptHash: fact.providerReceiptHash,
    signedAt: fact.signedAt,
    verifiedAt: fact.verifiedAt,
  };
}

function controlFactSeed(
  fact: CanopyProofEnvironmentalProofLifecycleControlFact,
  governor: CanopyProofVerificationActorSnapshot,
) {
  return {
    id: fact.id,
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    bindingId: fact.bindingId,
    bindingRoot: fact.bindingRoot,
    action: fact.action,
    priorState: fact.priorState,
    priorProjectionRoot: fact.priorProjectionRoot,
    ...(fact.successorBindingId
      ? {
          successorBindingId: fact.successorBindingId,
          successorBindingRoot: fact.successorBindingRoot,
          successorProjectionRoot: fact.successorProjectionRoot,
        }
      : {}),
    rationale: fact.rationale,
    conflictDisclosure: fact.conflictDisclosure,
    sourceProjectionRoots: fact.sourceProjectionRoots,
    sourceRoot: fact.sourceRoot,
    governor,
    decidedAt: fact.decidedAt,
    commandHash: fact.commandHash,
    recordSequence: fact.recordSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function controlCommandSeed(
  fact: CanopyProofEnvironmentalProofLifecycleControlFact,
  governor: CanopyProofVerificationActorSnapshot,
) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    bindingId: fact.bindingId,
    bindingRoot: fact.bindingRoot,
    action: fact.action,
    priorState: fact.priorState,
    priorProjectionRoot: fact.priorProjectionRoot,
    ...(fact.successorBindingId
      ? {
          successorBindingId: fact.successorBindingId,
          successorBindingRoot: fact.successorBindingRoot,
          successorProjectionRoot: fact.successorProjectionRoot,
        }
      : {}),
    rationale: fact.rationale,
    conflictDisclosure: fact.conflictDisclosure,
    sourceProjectionRoots: fact.sourceProjectionRoots,
    governor,
    decidedAt: fact.decidedAt,
  };
}

function assertFactIntegrity(
  fact: { readonly id: string; readonly auditEvent: CanopyProofAuditEvent; readonly safety: CanopyProofEnvironmentalProofLifecycleSafetyBoundary; readonly recordSequence?: number; readonly organizationSequence?: number; readonly previousEventRoot: string },
  expectedHash: string,
  actualHash: string,
  expectedRoot: string,
  actualRoot: string,
  events: readonly CanopyProofAuditEvent[],
  entityType: CanopyProofAuditEvent["entityType"],
  action: CanopyProofAuditEvent["action"],
  rationale: string,
  createdAt: string,
  actorId: string,
  payloadWithUndefinedAudit: Record<string, unknown>,
) {
  const { auditEvent, ...payload } = payloadWithUndefinedAudit;
  void auditEvent;
  const expectedEvent = appendCanopyProofAuditEvent(events, {
    action,
    actor: actorId,
    entityType,
    entityId: fact.id,
    payload,
    createdAt,
    rationale,
  }).at(-1)!;
  const expectedSequence = events.length + 1;
  if (
    expectedHash !== actualHash ||
    expectedRoot !== actualRoot ||
    fact.previousEventRoot !== (events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot()) ||
    (fact.recordSequence !== undefined && fact.recordSequence !== expectedSequence) ||
    (fact.organizationSequence !== undefined && fact.organizationSequence !== expectedSequence) ||
    hashJson(expectedEvent) !== hashJson(fact.auditEvent) ||
    hashJson(fact.safety) !== hashJson(lifecycleSafetyBoundary())
  ) {
    throw new Error(`CanopyProof lifecycle snapshot fact integrity is invalid: ${fact.id}`);
  }
}

function assertUniqueFactIds(snapshot: CanopyProofEnvironmentalProofLifecycleAuthoritySnapshot) {
  const ids = [
    ...snapshot.signingKeys,
    ...snapshot.signingKeyRevocations,
    ...snapshot.bindings,
    ...snapshot.signatureReceipts,
    ...snapshot.controls,
  ].map((fact) => fact.id);
  if (new Set(ids).size !== ids.length) throw new Error("CanopyProof lifecycle snapshot contains duplicate fact IDs.");
}

function compareOrganizationFacts(
  left: CanopyProofEnvironmentalProofSigningKeyAttestationFact | CanopyProofEnvironmentalProofSigningKeyRevocationFact,
  right: CanopyProofEnvironmentalProofSigningKeyAttestationFact | CanopyProofEnvironmentalProofSigningKeyRevocationFact,
) {
  return (
    left.organizationId.localeCompare(right.organizationId) ||
    left.organizationSequence - right.organizationSequence ||
    left.id.localeCompare(right.id)
  );
}

function compareRecordFacts(
  left: CanopyProofEnvironmentalProofLifecycleBindingFact | CanopyProofEnvironmentalProofSignatureReceiptFact | CanopyProofEnvironmentalProofLifecycleControlFact,
  right: CanopyProofEnvironmentalProofLifecycleBindingFact | CanopyProofEnvironmentalProofSignatureReceiptFact | CanopyProofEnvironmentalProofLifecycleControlFact,
) {
  return left.recordId.localeCompare(right.recordId) || left.recordSequence - right.recordSequence || left.id.localeCompare(right.id);
}

function canonicalIdentifiers(values: readonly string[]) {
  return [...new Set(values.map((value) => identifierSchema.parse(value)))].sort();
}

function canonicalHashes(values: readonly string[]) {
  return [...new Set(values.map(normalizeHash))].sort();
}

function assertCanonicalValues(actual: readonly string[], expected: readonly string[], label: string) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CanopyProof lifecycle ${label} must be sorted, normalized, and unique.`);
  }
}

function normalizeHash(value: string) {
  const parsed = hashSchema.parse(value).toLowerCase();
  return parsed.startsWith("sha256:") ? parsed.slice(7) : parsed;
}

function assertCanonicalTimestamp(value: string, label: string) {
  if (!Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value) {
    throw new Error(`CanopyProof ${label} must be canonical RFC3339 UTC.`);
  }
}

function assertMonotonicTime(events: readonly CanopyProofAuditEvent[], createdAt: string) {
  const prior = events.at(-1);
  if (prior && Date.parse(createdAt) < Date.parse(prior.createdAt)) {
    throw new Error("CanopyProof lifecycle event time must be monotonic within its authority stream.");
  }
}

function assertSafeText(values: readonly string[]) {
  const unsafe = values.find((value) =>
    /certified carbon credit|carbon[- ]?tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution|mainnet funds|(?:begin|end) (?:rsa |ec |openssh |private )?private key|private[_ -]?key|seed phrase|mnemonic|api[_ -]?secret|access[_ -]?secret|client[_ -]?secret|password/i.test(
      value,
    ),
  );
  if (unsafe) throw new Error(`CanopyProof lifecycle input contains an unsafe claim or secret: ${unsafe}`);
}
