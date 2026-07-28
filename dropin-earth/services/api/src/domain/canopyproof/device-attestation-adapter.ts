import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import {
  canopyProofEvidenceDeviceAttestationProviders,
  canopyProofEvidenceDeviceAttestationTypes,
  type CanopyProofEvidenceDeviceAttestationFact,
  type CanopyProofEvidenceDeviceAttestationProvider,
  type CanopyProofEvidenceDeviceAttestationType,
} from "./evidence-custody-authority.js";

export const canopyProofDeviceAttestationVerificationResults = ["verified", "rejected"] as const;

export type CanopyProofDeviceAttestationVerificationResult =
  (typeof canopyProofDeviceAttestationVerificationResults)[number];

export type CanopyProofDeviceAttestationProviderReceipt = Readonly<{
  attestationId: string;
  attestationRoot: string;
  organizationId: string;
  subjectId: string;
  subjectRoot: string;
  consentReceiptId: string;
  consentReceiptRoot: string;
  deviceFingerprintHash: string;
  attestationType: CanopyProofEvidenceDeviceAttestationType;
  provider: CanopyProofEvidenceDeviceAttestationProvider;
  providerKeyId: string;
  providerReceiptHash: string;
  publicKeyHash: string;
  attestationHash: string;
  challengeHash: string;
  verifierId: string;
  verifierVersion: string;
  providerPolicyRoot: string;
  result: CanopyProofDeviceAttestationVerificationResult;
  reasonCodes: readonly string[];
  verifiedAt: string;
  expiresAt: string;
  signerKeyId: string;
  signatureAlgorithm: "ed25519";
  signature: string;
  receiptHash: string;
}>;

const verifiedReceiptBrand: unique symbol = Symbol("CanopyProofVerifiedDeviceAttestationReceipt");

export type CanopyProofVerifiedDeviceAttestationReceipt =
  CanopyProofDeviceAttestationProviderReceipt & Readonly<{
    signerSetRoot: string;
    signatureHash: string;
    adapterVerificationRoot: string;
    [verifiedReceiptBrand]: true;
  }>;

export type CanopyProofDeviceAttestationProviderRequest = Readonly<{
  attestationId: string;
  attestationRoot: string;
  organizationId: string;
  subjectId: string;
  subjectRoot: string;
  consentReceiptId: string;
  consentReceiptRoot: string;
  deviceFingerprintHash: string;
  attestationType: CanopyProofEvidenceDeviceAttestationType;
  provider: CanopyProofEvidenceDeviceAttestationProvider;
  providerKeyId: string;
  providerReceiptHash: string;
  publicKeyHash: string;
  attestationHash: string;
  challengeHash: string;
  requestedAt: string;
  correlationId: string;
}>;

export interface CanopyProofDeviceAttestationProviderPort {
  verifyAttestation(request: CanopyProofDeviceAttestationProviderRequest): Promise<unknown>;
}

export interface CanopyProofDeviceAttestationSignatureVerifier {
  verify(input: Readonly<{
    signerKeyId: string;
    signatureAlgorithm: "ed25519";
    receiptHash: string;
    signature: string;
  }>): Promise<boolean>;
}

export type CanopyProofDeviceAttestationAdapterPolicy = Readonly<{
  provider: CanopyProofEvidenceDeviceAttestationProvider;
  attestationType: CanopyProofEvidenceDeviceAttestationType;
  verifierId: string;
  verifierVersion: string;
  providerPolicyRoot: string;
  allowedSignerKeyIds: readonly string[];
  maximumVerificationLifetimeSeconds?: number;
}>;

export type CanopyProofDeviceAttestationAdapterPolicyDescriptor = Readonly<{
  provider: CanopyProofEvidenceDeviceAttestationProvider;
  attestationType: CanopyProofEvidenceDeviceAttestationType;
  verifierId: string;
  verifierVersion: string;
  providerPolicyRoot: string;
  signerSetRoot: string;
  maximumVerificationLifetimeSeconds: number;
}>;

export interface CanopyProofDeviceAttestationAdapter {
  getPolicyDescriptor(): CanopyProofDeviceAttestationAdapterPolicyDescriptor;

  verifyAttestation(
    attestation: CanopyProofEvidenceDeviceAttestationFact,
    context: Readonly<{ now: string; correlationId: string; challengeHash: string }>,
  ): Promise<CanopyProofVerifiedDeviceAttestationReceipt>;
}

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const versionSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:+-]{0,99}$/);
const reasonCodeSchema = z.string().regex(/^[a-z][a-z0-9_]{1,63}$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const signatureSchema = z.string().regex(/^[A-Za-z0-9_-]{86}$/);
const canonicalTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).toISOString() === value, "timestamp must be canonical UTC milliseconds");

const receiptSchema = z
  .object({
    attestationId: identifierSchema,
    attestationRoot: hashSchema,
    organizationId: identifierSchema,
    subjectId: identifierSchema,
    subjectRoot: hashSchema,
    consentReceiptId: identifierSchema,
    consentReceiptRoot: hashSchema,
    deviceFingerprintHash: hashSchema,
    attestationType: z.enum(canopyProofEvidenceDeviceAttestationTypes),
    provider: z.enum(canopyProofEvidenceDeviceAttestationProviders),
    providerKeyId: identifierSchema,
    providerReceiptHash: hashSchema,
    publicKeyHash: hashSchema,
    attestationHash: hashSchema,
    challengeHash: hashSchema,
    verifierId: identifierSchema,
    verifierVersion: versionSchema,
    providerPolicyRoot: hashSchema,
    result: z.enum(canopyProofDeviceAttestationVerificationResults),
    reasonCodes: z.array(reasonCodeSchema).max(32),
    verifiedAt: canonicalTimestampSchema,
    expiresAt: canonicalTimestampSchema,
    signerKeyId: identifierSchema,
    signatureAlgorithm: z.literal("ed25519"),
    signature: signatureSchema,
    receiptHash: hashSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.result === "verified" && value.reasonCodes.length !== 0) {
      context.addIssue({ code: "custom", path: ["reasonCodes"], message: "verified receipt must have no reasons" });
    }
    if (value.result === "rejected" && value.reasonCodes.length === 0) {
      context.addIssue({ code: "custom", path: ["reasonCodes"], message: "rejected receipt requires a reason" });
    }
    if (!isSortedUnique(value.reasonCodes)) {
      context.addIssue({ code: "custom", path: ["reasonCodes"], message: "reason codes must be sorted and unique" });
    }
  });

export function canopyProofDeviceAttestationReceiptSeed(
  receipt: Omit<CanopyProofDeviceAttestationProviderReceipt, "signature" | "receiptHash">,
) {
  return {
    attestationId: receipt.attestationId,
    attestationRoot: receipt.attestationRoot,
    organizationId: receipt.organizationId,
    subjectId: receipt.subjectId,
    subjectRoot: receipt.subjectRoot,
    consentReceiptId: receipt.consentReceiptId,
    consentReceiptRoot: receipt.consentReceiptRoot,
    deviceFingerprintHash: receipt.deviceFingerprintHash,
    attestationType: receipt.attestationType,
    provider: receipt.provider,
    providerKeyId: receipt.providerKeyId,
    providerReceiptHash: receipt.providerReceiptHash,
    publicKeyHash: receipt.publicKeyHash,
    attestationHash: receipt.attestationHash,
    challengeHash: receipt.challengeHash,
    verifierId: receipt.verifierId,
    verifierVersion: receipt.verifierVersion,
    providerPolicyRoot: receipt.providerPolicyRoot,
    result: receipt.result,
    reasonCodes: receipt.reasonCodes,
    verifiedAt: receipt.verifiedAt,
    expiresAt: receipt.expiresAt,
    signerKeyId: receipt.signerKeyId,
    signatureAlgorithm: receipt.signatureAlgorithm,
  } as const;
}

export function validateCanopyProofDeviceAttestationProviderReceipt(
  attestation: CanopyProofEvidenceDeviceAttestationFact,
  receiptInput: unknown,
  policy: CanopyProofDeviceAttestationAdapterPolicyDescriptor & Readonly<{
    now: string;
    challengeHash: string;
    allowedSignerKeyIds: readonly string[];
  }>,
): CanopyProofDeviceAttestationProviderReceipt {
  const receipt = receiptSchema.parse(receiptInput);
  const now = canonicalTimestampSchema.parse(policy.now);
  const challengeHash = hashSchema.parse(policy.challengeHash);
  const allowedSignerKeyIds = new Set(
    policy.allowedSignerKeyIds.map((keyId) => identifierSchema.parse(keyId)),
  );
  if (allowedSignerKeyIds.size === 0) {
    throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_SIGNER_POLICY_EMPTY");
  }
  if (attestation.providerVerificationState !== "modeled_only") {
    throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_BASE_MUST_REMAIN_MODELED_ONLY");
  }
  if (
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
    receipt.attestationHash !== attestation.attestationHash ||
    receipt.challengeHash !== challengeHash
  ) {
    throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_RECEIPT_AUTHORITY_MISMATCH");
  }
  if (
    receipt.provider !== policy.provider ||
    receipt.attestationType !== policy.attestationType ||
    receipt.verifierId !== policy.verifierId ||
    receipt.verifierVersion !== policy.verifierVersion ||
    receipt.providerPolicyRoot !== policy.providerPolicyRoot ||
    !allowedSignerKeyIds.has(receipt.signerKeyId)
  ) {
    throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_RECEIPT_POLICY_MISMATCH");
  }
  const nowMs = Date.parse(now);
  const expiresAtMs = Date.parse(receipt.expiresAt);
  if (
    receipt.verifiedAt !== now ||
    nowMs < Date.parse(attestation.issuedAt) ||
    nowMs >= Date.parse(attestation.expiresAt) ||
    expiresAtMs <= nowMs ||
    expiresAtMs > Date.parse(attestation.expiresAt) ||
    expiresAtMs - nowMs > policy.maximumVerificationLifetimeSeconds * 1_000
  ) {
    throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_RECEIPT_TIME_INVALID");
  }
  const seed = canopyProofDeviceAttestationReceiptSeed(receipt);
  const receiptHash = hashJson({ kind: "canopyproof-device-attestation-provider-receipt-v1", ...seed });
  if (receipt.receiptHash !== receiptHash) {
    throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_RECEIPT_HASH_INVALID");
  }
  return Object.freeze({ ...seed, signature: receipt.signature, receiptHash });
}

export class PolicyEnforcedCanopyProofDeviceAttestationAdapter
  implements CanopyProofDeviceAttestationAdapter
{
  readonly #provider: CanopyProofEvidenceDeviceAttestationProvider;
  readonly #attestationType: CanopyProofEvidenceDeviceAttestationType;
  readonly #verifierId: string;
  readonly #verifierVersion: string;
  readonly #providerPolicyRoot: string;
  readonly #allowedSignerKeyIds: readonly string[];
  readonly #maximumVerificationLifetimeSeconds: number;

  constructor(
    configuration: CanopyProofDeviceAttestationAdapterPolicy,
    private readonly port: CanopyProofDeviceAttestationProviderPort,
    private readonly signatureVerifier: CanopyProofDeviceAttestationSignatureVerifier,
  ) {
    this.#provider = z.enum(canopyProofEvidenceDeviceAttestationProviders).parse(configuration.provider);
    this.#attestationType = z.enum(canopyProofEvidenceDeviceAttestationTypes).parse(configuration.attestationType);
    assertProviderTypePair(this.#provider, this.#attestationType);
    this.#verifierId = identifierSchema.parse(configuration.verifierId);
    this.#verifierVersion = versionSchema.parse(configuration.verifierVersion);
    this.#providerPolicyRoot = hashSchema.parse(configuration.providerPolicyRoot);
    this.#allowedSignerKeyIds = Object.freeze(
      [...new Set(configuration.allowedSignerKeyIds.map((keyId) => identifierSchema.parse(keyId)))].sort(),
    );
    if (this.#allowedSignerKeyIds.length === 0) {
      throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_SIGNER_POLICY_EMPTY");
    }
    this.#maximumVerificationLifetimeSeconds = configuration.maximumVerificationLifetimeSeconds ?? 86_400;
    if (
      !Number.isInteger(this.#maximumVerificationLifetimeSeconds) ||
      this.#maximumVerificationLifetimeSeconds < 60 ||
      this.#maximumVerificationLifetimeSeconds > 30 * 86_400
    ) {
      throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_VERIFICATION_WINDOW_INVALID");
    }
  }

  getPolicyDescriptor(): CanopyProofDeviceAttestationAdapterPolicyDescriptor {
    return Object.freeze({
      provider: this.#provider,
      attestationType: this.#attestationType,
      verifierId: this.#verifierId,
      verifierVersion: this.#verifierVersion,
      providerPolicyRoot: this.#providerPolicyRoot,
      signerSetRoot: hashJson({
        kind: "canopyproof-device-attestation-signer-set-v1",
        signerKeyIds: this.#allowedSignerKeyIds,
      }),
      maximumVerificationLifetimeSeconds: this.#maximumVerificationLifetimeSeconds,
    });
  }

  async verifyAttestation(
    attestation: CanopyProofEvidenceDeviceAttestationFact,
    context: Readonly<{ now: string; correlationId: string; challengeHash: string }>,
  ): Promise<CanopyProofVerifiedDeviceAttestationReceipt> {
    const now = canonicalTimestampSchema.parse(context.now);
    const correlationId = identifierSchema.parse(context.correlationId);
    const challengeHash = hashSchema.parse(context.challengeHash);
    if (attestation.provider !== this.#provider || attestation.attestationType !== this.#attestationType) {
      throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_ADAPTER_PROVIDER_MISMATCH");
    }
    const untrusted = await this.port.verifyAttestation({
      attestationId: attestation.id,
      attestationRoot: attestation.attestationRoot,
      organizationId: attestation.organizationId,
      subjectId: attestation.subjectId,
      subjectRoot: attestation.subjectRoot,
      consentReceiptId: attestation.consentReceiptId,
      consentReceiptRoot: attestation.consentReceiptRoot,
      deviceFingerprintHash: attestation.deviceFingerprintHash,
      attestationType: attestation.attestationType,
      provider: attestation.provider,
      providerKeyId: attestation.providerKeyId,
      providerReceiptHash: attestation.providerReceiptHash,
      publicKeyHash: attestation.publicKeyHash,
      attestationHash: attestation.attestationHash,
      challengeHash,
      requestedAt: now,
      correlationId,
    });
    const descriptor = this.getPolicyDescriptor();
    const receipt = validateCanopyProofDeviceAttestationProviderReceipt(attestation, untrusted, {
      ...descriptor,
      now,
      challengeHash,
      allowedSignerKeyIds: this.#allowedSignerKeyIds,
    });
    const signatureValid = await this.signatureVerifier.verify({
      signerKeyId: receipt.signerKeyId,
      signatureAlgorithm: receipt.signatureAlgorithm,
      receiptHash: receipt.receiptHash,
      signature: receipt.signature,
    });
    if (!signatureValid) {
      throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_SIGNATURE_INVALID");
    }
    const signatureHash = hashJson({
      kind: "canopyproof-device-attestation-signature-v1",
      signatureAlgorithm: receipt.signatureAlgorithm,
      signature: receipt.signature,
    });
    const adapterVerificationRoot = hashJson({
      kind: "canopyproof-device-attestation-adapter-verification-v1",
      attestationRoot: receipt.attestationRoot,
      receiptHash: receipt.receiptHash,
      provider: receipt.provider,
      verifierId: receipt.verifierId,
      signerKeyId: receipt.signerKeyId,
      providerPolicyRoot: receipt.providerPolicyRoot,
      signerSetRoot: descriptor.signerSetRoot,
      signatureHash,
      verifiedAt: receipt.verifiedAt,
    });
    const verified = {
      ...receipt,
      signerSetRoot: descriptor.signerSetRoot,
      signatureHash,
      adapterVerificationRoot,
    };
    Object.defineProperty(verified, verifiedReceiptBrand, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    });
    return Object.freeze(verified) as CanopyProofVerifiedDeviceAttestationReceipt;
  }
}

export class DisabledCanopyProofDeviceAttestationAdapter
  implements CanopyProofDeviceAttestationAdapter
{
  getPolicyDescriptor(): CanopyProofDeviceAttestationAdapterPolicyDescriptor {
    throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_PROVIDER_UNAVAILABLE");
  }

  async verifyAttestation(): Promise<CanopyProofVerifiedDeviceAttestationReceipt> {
    throw new Error(
      "CANOPYPROOF_DEVICE_ATTESTATION_PROVIDER_UNAVAILABLE: no approved provider is configured.",
    );
  }
}

export class WebCryptoEd25519DeviceAttestationSignatureVerifier
  implements CanopyProofDeviceAttestationSignatureVerifier
{
  readonly #publicKeys: Readonly<Record<string, JsonWebKey>>;

  constructor(publicKeys: Readonly<Record<string, JsonWebKey>>) {
    const entries = Object.entries(publicKeys);
    if (entries.length === 0) throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_PUBLIC_KEY_REQUIRED");
    this.#publicKeys = Object.freeze(Object.fromEntries(entries.map(([keyIdInput, keyInput]) => {
      const keyId = identifierSchema.parse(keyIdInput);
      const key = Object.freeze({ ...keyInput });
      if (
        key.kty !== "OKP" ||
        key.crv !== "Ed25519" ||
        typeof key.x !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(key.x) ||
        typeof key.d === "string" ||
        key.key_ops?.includes("sign") ||
        (key.use !== undefined && key.use !== "sig")
      ) {
        throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_PUBLIC_KEY_INVALID");
      }
      return [keyId, key];
    })));
  }

  async verify(input: Readonly<{
    signerKeyId: string;
    signatureAlgorithm: "ed25519";
    receiptHash: string;
    signature: string;
  }>): Promise<boolean> {
    const key = this.#publicKeys[input.signerKeyId];
    if (
      !key ||
      input.signatureAlgorithm !== "ed25519" ||
      !hashSchema.safeParse(input.receiptHash).success ||
      !signatureSchema.safeParse(input.signature).success
    ) return false;
    try {
      const signature = decodeCanonicalBase64Url(input.signature);
      if (signature.byteLength !== 64) return false;
      const cryptoKey = await crypto.subtle.importKey("jwk", key, { name: "Ed25519" }, false, ["verify"]);
      return crypto.subtle.verify(
        { name: "Ed25519" },
        cryptoKey,
        signature,
        new TextEncoder().encode(input.receiptHash),
      );
    } catch {
      return false;
    }
  }
}

export function isCanopyProofVerifiedDeviceAttestationReceipt(
  value: unknown,
): value is CanopyProofVerifiedDeviceAttestationReceipt {
  if (!value || typeof value !== "object") return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, verifiedReceiptBrand);
  return descriptor?.value === true && descriptor.enumerable === false &&
    descriptor.configurable === false && descriptor.writable === false && Object.isFrozen(value);
}

function assertProviderTypePair(
  provider: CanopyProofEvidenceDeviceAttestationProvider,
  attestationType: CanopyProofEvidenceDeviceAttestationType,
) {
  const expected: Record<CanopyProofEvidenceDeviceAttestationProvider, CanopyProofEvidenceDeviceAttestationType> = {
    apple_app_attest: "secure_enclave",
    webauthn: "webauthn",
    android_key_attestation: "platform_key",
    manual_field_kit_registry: "manual_field_kit",
    sensor_gateway_registry: "sensor_gateway",
  };
  if (expected[provider] !== attestationType) {
    throw new Error("CANOPYPROOF_DEVICE_ATTESTATION_PROVIDER_TYPE_UNSUPPORTED");
  }
}

function decodeCanonicalBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  const canonical = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  if (canonical !== value) throw new Error("non-canonical base64url");
  return bytes;
}

function isSortedUnique(values: readonly string[]) {
  return values.every((value, index) => index === 0 || values[index - 1]! < value);
}
