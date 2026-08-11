import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import type {
  CanopyProofEvidenceMetadataAccuracyBand,
  CanopyProofEvidenceMetadataClockSkewBand,
  CanopyProofEvidenceMetadataExtractionAuthority,
  CanopyProofEvidenceMetadataLocationDisclosure,
} from "./evidence-metadata-retention-authority.js";
import { assertCanopyProofEffectiveMediaObjectProjection } from
  "./evidence-media-adapter-authority.js";
import {
  assertCanopyProofEffectiveDeviceAttestationProjection,
  isCanopyProofEffectiveDeviceAttestationProjection,
} from "./evidence-device-attestation-adapter-authority.js";

export type CanopyProofMetadataExtractionReceipt = {
  readonly objectId: string;
  readonly objectRoot: string;
  readonly storageProvider: "cloudflare_r2" | "s3" | "gcs";
  readonly providerNamespace: string;
  readonly objectKey: string;
  readonly objectVersion: string;
  readonly storedObjectProviderReceiptHash: string;
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
  readonly exifHash: string;
  readonly gpsHash: string;
  readonly metadataOutputRoot: string;
  readonly locationDisclosure: CanopyProofEvidenceMetadataLocationDisclosure;
  readonly generalizedLocationHash?: string;
  readonly accuracyBand: CanopyProofEvidenceMetadataAccuracyBand;
  readonly clockSkewBand: CanopyProofEvidenceMetadataClockSkewBand;
  readonly observedAt: string;
  readonly extractedAt: string;
  readonly signerKeyId: string;
  readonly signatureAlgorithm: "ed25519";
  readonly signature: string;
  readonly receiptHash: string;
};

const verifiedMetadataExtractionReceiptBrand: unique symbol = Symbol(
  "CanopyProofVerifiedMetadataExtractionReceipt",
);

export type CanopyProofVerifiedMetadataExtractionReceipt =
  CanopyProofMetadataExtractionReceipt & {
    readonly extractorPolicyRoot: string;
    readonly verifiedAt: string;
    readonly signatureHash: string;
    readonly adapterVerificationRoot: string;
    readonly [verifiedMetadataExtractionReceiptBrand]: true;
  };

export type CanopyProofMetadataExtractorRequest = Readonly<{
  objectId: string;
  objectRoot: string;
  storageProvider: "cloudflare_r2" | "s3" | "gcs";
  providerNamespace: string;
  objectKey: string;
  objectVersion: string;
  storedObjectProviderReceiptHash: string;
  contentType: "image/jpeg" | "image/png" | "image/webp";
  mediaProjectionRoot: string;
  consentReceiptId: string;
  consentReceiptRoot: string;
  consentProjectionRoot: string;
  deviceAttestationId: string;
  deviceAttestationRoot: string;
  deviceProjectionRoot: string;
  registeredGpsHash: string;
  privacyMode: "precise" | "masked" | "restricted";
  requestedAt: string;
  correlationId: string;
}>;

export interface CanopyProofMetadataExtractorPort {
  extractMetadata(request: CanopyProofMetadataExtractorRequest): Promise<unknown>;
}

export interface CanopyProofMetadataExtractorSignatureVerifier {
  verify(
    input: Readonly<{
      signerKeyId: string;
      signatureAlgorithm: "ed25519";
      receiptHash: string;
      signature: string;
    }>,
  ): Promise<boolean>;
}

export interface CanopyProofMetadataExtractorAdapter {
  getPolicyDescriptor(): CanopyProofMetadataExtractorPolicyDescriptor;

  extractMetadata(
    authority: CanopyProofEvidenceMetadataExtractionAuthority,
    context: Readonly<{ now: string; correlationId: string }>,
  ): Promise<CanopyProofVerifiedMetadataExtractionReceipt>;
}

export type CanopyProofMetadataExtractorPolicyDescriptor = Readonly<{
  extractorId: string;
  extractorName: string;
  extractorVersion: string;
  extractorImageDigest: string;
  metadataSchemaVersion: string;
  extractorPolicyRoot: string;
  signerSetRoot: string;
  maximumObservationAgeSeconds: number;
}>;

export type CanopyProofMetadataExtractorAdapterConfiguration = Readonly<{
  extractorId: string;
  extractorName: string;
  extractorVersion: string;
  extractorImageDigest: string;
  metadataSchemaVersion: string;
  extractorPolicyRoot: string;
  allowedSignerKeyIds: readonly string[];
  maximumObservationAgeSeconds?: number;
}>;

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const boundedTextSchema = z.string().trim().min(1).max(100);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const signatureSchema = z.string().regex(/^[A-Za-z0-9_-]{86}$/);
const canonicalTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).toISOString() === value, "timestamp must be canonical UTC milliseconds");
const objectKeySchema = z
  .string()
  .min(1)
  .max(1_024)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/)
  .refine(
    (value) =>
      !value.includes("//") &&
      !value.split("/").some((segment) => segment === "." || segment === ".."),
    "unsafe object key",
  );

const receiptSchema = z
  .object({
    objectId: identifierSchema,
    objectRoot: hashSchema,
    storageProvider: z.enum(["cloudflare_r2", "s3", "gcs"]),
    providerNamespace: identifierSchema,
    objectKey: objectKeySchema,
    objectVersion: identifierSchema,
    storedObjectProviderReceiptHash: hashSchema,
    mediaProjectionRoot: hashSchema,
    consentReceiptId: identifierSchema,
    consentReceiptRoot: hashSchema,
    consentProjectionRoot: hashSchema,
    deviceAttestationId: identifierSchema,
    deviceAttestationRoot: hashSchema,
    deviceProjectionRoot: hashSchema,
    registeredGpsHash: hashSchema,
    privacyMode: z.enum(["precise", "masked", "restricted"]),
    extractorId: identifierSchema,
    extractorName: boundedTextSchema,
    extractorVersion: boundedTextSchema,
    extractorImageDigest: hashSchema,
    metadataSchemaVersion: boundedTextSchema,
    exifHash: hashSchema,
    gpsHash: hashSchema,
    metadataOutputRoot: hashSchema,
    locationDisclosure: z.enum(["none", "region_hash", "coarse_cell_hash"]),
    generalizedLocationHash: hashSchema.optional(),
    accuracyBand: z.enum(["under_10m", "10_to_50m", "over_50m", "unknown"]),
    clockSkewBand: z.enum(["under_1m", "1_to_5m", "over_5m", "unknown"]),
    observedAt: canonicalTimestampSchema,
    extractedAt: canonicalTimestampSchema,
    signerKeyId: identifierSchema,
    signatureAlgorithm: z.literal("ed25519"),
    signature: signatureSchema,
    receiptHash: hashSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const hasLocationHash = value.generalizedLocationHash !== undefined;
    if ((value.locationDisclosure === "none") === hasLocationHash) {
      context.addIssue({
        code: "custom",
        path: ["generalizedLocationHash"],
        message: "location disclosure and commitment are inconsistent",
      });
    }
    if (value.privacyMode === "restricted" && value.locationDisclosure !== "none") {
      context.addIssue({
        code: "custom",
        path: ["locationDisclosure"],
        message: "restricted privacy forbids location disclosure",
      });
    }
    if (value.privacyMode === "masked" && value.locationDisclosure === "coarse_cell_hash") {
      context.addIssue({
        code: "custom",
        path: ["locationDisclosure"],
        message: "masked privacy permits only a region commitment",
      });
    }
  });

export function canopyProofMetadataExtractionReceiptSeed(
  receipt: Omit<
    CanopyProofMetadataExtractionReceipt,
    "signature" | "receiptHash" | "generalizedLocationHash"
  > & { readonly generalizedLocationHash?: string | undefined },
) {
  return {
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
  } as const;
}

export function validateCanopyProofMetadataExtractionReceipt(
  authority: CanopyProofEvidenceMetadataExtractionAuthority,
  receiptInput: unknown,
  policy: Readonly<{
    now: string;
    extractorId: string;
    extractorName: string;
    extractorVersion: string;
    extractorImageDigest: string;
    metadataSchemaVersion: string;
    allowedSignerKeyIds: readonly string[];
    maximumObservationAgeSeconds?: number;
  }>,
): CanopyProofMetadataExtractionReceipt {
  const receipt = receiptSchema.parse(receiptInput);
  const now = canonicalTimestampSchema.parse(policy.now);
  const allowedSignerKeyIds = new Set(
    policy.allowedSignerKeyIds.map((keyId) => identifierSchema.parse(keyId)),
  );
  if (allowedSignerKeyIds.size === 0) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_SIGNER_POLICY_EMPTY");
  }
  const maximumObservationAgeSeconds = policy.maximumObservationAgeSeconds ?? 365 * 86_400;
  if (
    !Number.isInteger(maximumObservationAgeSeconds) ||
    maximumObservationAgeSeconds < 86_400 ||
    maximumObservationAgeSeconds > 366 * 86_400
  ) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_OBSERVATION_WINDOW_INVALID");
  }
  assertEligibleAuthority(authority, now);
  assertSafeMetadataMaterial([
    receipt.providerNamespace,
    receipt.objectVersion,
    receipt.extractorId,
    receipt.extractorName,
    receipt.extractorVersion,
    receipt.metadataSchemaVersion,
    receipt.signerKeyId,
  ]);
  if (
    receipt.objectId !== authority.object.id ||
    receipt.objectRoot !== authority.object.objectRoot ||
    receipt.storageProvider !== authority.object.storageProvider ||
    receipt.providerNamespace !== authority.object.providerNamespace ||
    receipt.objectKey !== authority.object.objectKey ||
    receipt.objectVersion !== authority.object.objectVersion ||
    receipt.storedObjectProviderReceiptHash !== authority.object.providerReceiptHash ||
    receipt.mediaProjectionRoot !== authority.mediaProjection.projectionRoot ||
    receipt.consentReceiptId !== authority.consent.id ||
    receipt.consentReceiptRoot !== authority.consent.receiptRoot ||
    receipt.consentProjectionRoot !== authority.consentProjection.projectionRoot ||
    receipt.deviceAttestationId !== authority.device.id ||
    receipt.deviceAttestationRoot !== authority.device.attestationRoot ||
    receipt.deviceProjectionRoot !== authority.deviceProjection.projectionRoot ||
    receipt.registeredGpsHash !== authority.registeredGpsHash ||
    receipt.gpsHash !== authority.registeredGpsHash ||
    receipt.privacyMode !== authority.consent.privacyMode
  ) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_RECEIPT_AUTHORITY_MISMATCH");
  }
  if (
    receipt.extractorId !== identifierSchema.parse(policy.extractorId) ||
    receipt.extractorName !== boundedTextSchema.parse(policy.extractorName) ||
    receipt.extractorVersion !== boundedTextSchema.parse(policy.extractorVersion) ||
    receipt.extractorImageDigest !== hashSchema.parse(policy.extractorImageDigest) ||
    receipt.metadataSchemaVersion !== boundedTextSchema.parse(policy.metadataSchemaVersion) ||
    !allowedSignerKeyIds.has(receipt.signerKeyId)
  ) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_RECEIPT_POLICY_MISMATCH");
  }
  const observedAtMs = Date.parse(receipt.observedAt);
  const extractedAtMs = Date.parse(receipt.extractedAt);
  if (
    receipt.extractedAt !== now ||
    observedAtMs > extractedAtMs ||
    extractedAtMs < Date.parse(authority.object.storedAt) ||
    extractedAtMs - observedAtMs > maximumObservationAgeSeconds * 1_000
  ) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_RECEIPT_TIME_INVALID");
  }
  const seed = canopyProofMetadataExtractionReceiptSeed(receipt);
  const receiptHash = hashJson({
    kind: "canopyproof-metadata-extraction-receipt-v1",
    ...seed,
  });
  if (receipt.receiptHash !== receiptHash) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_RECEIPT_HASH_INVALID");
  }
  return { ...seed, signature: receipt.signature, receiptHash };
}

export class PolicyEnforcedCanopyProofMetadataExtractorAdapter
  implements CanopyProofMetadataExtractorAdapter
{
  readonly #extractorId: string;
  readonly #extractorName: string;
  readonly #extractorVersion: string;
  readonly #extractorImageDigest: string;
  readonly #metadataSchemaVersion: string;
  readonly #extractorPolicyRoot: string;
  readonly #allowedSignerKeyIds: readonly string[];
  readonly #maximumObservationAgeSeconds: number;

  constructor(
    configuration: CanopyProofMetadataExtractorAdapterConfiguration,
    private readonly port: CanopyProofMetadataExtractorPort,
    private readonly signatureVerifier: CanopyProofMetadataExtractorSignatureVerifier,
  ) {
    this.#extractorId = identifierSchema.parse(configuration.extractorId);
    this.#extractorName = boundedTextSchema.parse(configuration.extractorName);
    this.#extractorVersion = boundedTextSchema.parse(configuration.extractorVersion);
    this.#extractorImageDigest = hashSchema.parse(configuration.extractorImageDigest);
    this.#metadataSchemaVersion = boundedTextSchema.parse(configuration.metadataSchemaVersion);
    this.#extractorPolicyRoot = hashSchema.parse(configuration.extractorPolicyRoot);
    this.#allowedSignerKeyIds = Object.freeze(
      [...new Set(configuration.allowedSignerKeyIds.map((keyId) => identifierSchema.parse(keyId)))].sort(),
    );
    if (this.#allowedSignerKeyIds.length === 0) {
      throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_SIGNER_POLICY_EMPTY");
    }
    this.#maximumObservationAgeSeconds =
      configuration.maximumObservationAgeSeconds ?? 365 * 86_400;
    if (
      !Number.isInteger(this.#maximumObservationAgeSeconds) ||
      this.#maximumObservationAgeSeconds < 86_400 ||
      this.#maximumObservationAgeSeconds > 366 * 86_400
    ) {
      throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_OBSERVATION_WINDOW_INVALID");
    }
  }

  getPolicyDescriptor(): CanopyProofMetadataExtractorPolicyDescriptor {
    return Object.freeze({
      extractorId: this.#extractorId,
      extractorName: this.#extractorName,
      extractorVersion: this.#extractorVersion,
      extractorImageDigest: this.#extractorImageDigest,
      metadataSchemaVersion: this.#metadataSchemaVersion,
      extractorPolicyRoot: this.#extractorPolicyRoot,
      signerSetRoot: hashJson({
        kind: "canopyproof-metadata-extractor-signer-set-v1",
        signerKeyIds: this.#allowedSignerKeyIds,
      }),
      maximumObservationAgeSeconds: this.#maximumObservationAgeSeconds,
    });
  }

  async extractMetadata(
    authority: CanopyProofEvidenceMetadataExtractionAuthority,
    context: Readonly<{ now: string; correlationId: string }>,
  ): Promise<CanopyProofVerifiedMetadataExtractionReceipt> {
    const now = canonicalTimestampSchema.parse(context.now);
    const correlationId = identifierSchema.parse(context.correlationId);
    assertEligibleAuthority(authority, now);
    if (!isImageContentType(authority.object.contentType)) {
      throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_MEDIA_TYPE_UNSUPPORTED");
    }
    const untrustedReceipt = await this.port.extractMetadata({
      objectId: authority.object.id,
      objectRoot: authority.object.objectRoot,
      storageProvider: authority.object.storageProvider,
      providerNamespace: authority.object.providerNamespace,
      objectKey: authority.object.objectKey,
      objectVersion: authority.object.objectVersion,
      storedObjectProviderReceiptHash: authority.object.providerReceiptHash,
      contentType: authority.object.contentType,
      mediaProjectionRoot: authority.mediaProjection.projectionRoot,
      consentReceiptId: authority.consent.id,
      consentReceiptRoot: authority.consent.receiptRoot,
      consentProjectionRoot: authority.consentProjection.projectionRoot,
      deviceAttestationId: authority.device.id,
      deviceAttestationRoot: authority.device.attestationRoot,
      deviceProjectionRoot: authority.deviceProjection.projectionRoot,
      registeredGpsHash: hashSchema.parse(authority.registeredGpsHash),
      privacyMode: authority.consent.privacyMode,
      requestedAt: now,
      correlationId,
    });
    const receipt = validateCanopyProofMetadataExtractionReceipt(authority, untrustedReceipt, {
      now,
      extractorId: this.#extractorId,
      extractorName: this.#extractorName,
      extractorVersion: this.#extractorVersion,
      extractorImageDigest: this.#extractorImageDigest,
      metadataSchemaVersion: this.#metadataSchemaVersion,
      allowedSignerKeyIds: this.#allowedSignerKeyIds,
      maximumObservationAgeSeconds: this.#maximumObservationAgeSeconds,
    });
    const signatureValid = await this.signatureVerifier.verify({
      signerKeyId: receipt.signerKeyId,
      signatureAlgorithm: receipt.signatureAlgorithm,
      receiptHash: receipt.receiptHash,
      signature: receipt.signature,
    });
    if (!signatureValid) {
      throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_SIGNATURE_INVALID");
    }
    const signatureHash = hashJson({
      kind: "canopyproof-metadata-extraction-signature-v1",
      signatureAlgorithm: receipt.signatureAlgorithm,
      signature: receipt.signature,
    });
    const adapterVerificationRoot = hashJson({
      kind: "canopyproof-metadata-extraction-adapter-verification-v1",
      receiptHash: receipt.receiptHash,
      extractorId: receipt.extractorId,
      signerKeyId: receipt.signerKeyId,
      extractorPolicyRoot: this.#extractorPolicyRoot,
      signatureHash,
      verifiedAt: now,
    });
    const verifiedReceipt = {
      ...receipt,
      extractorPolicyRoot: this.#extractorPolicyRoot,
      verifiedAt: now,
      signatureHash,
      adapterVerificationRoot,
    };
    Object.defineProperty(verifiedReceipt, verifiedMetadataExtractionReceiptBrand, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    });
    return Object.freeze(verifiedReceipt) as CanopyProofVerifiedMetadataExtractionReceipt;
  }
}

export class DisabledCanopyProofMetadataExtractorAdapter
  implements CanopyProofMetadataExtractorAdapter
{
  getPolicyDescriptor(): CanopyProofMetadataExtractorPolicyDescriptor {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_UNAVAILABLE");
  }

  async extractMetadata(): Promise<CanopyProofVerifiedMetadataExtractionReceipt> {
    throw new Error(
      "CANOPYPROOF_METADATA_EXTRACTOR_UNAVAILABLE: no approved metadata extractor is configured.",
    );
  }
}

export class WebCryptoEd25519MetadataExtractorSignatureVerifier
  implements CanopyProofMetadataExtractorSignatureVerifier
{
  readonly #publicKeys: Readonly<Record<string, JsonWebKey>>;

  constructor(publicKeys: Readonly<Record<string, JsonWebKey>>) {
    const entries = Object.entries(publicKeys);
    if (entries.length === 0) {
      throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_PUBLIC_KEY_REQUIRED");
    }
    this.#publicKeys = Object.freeze(
      Object.fromEntries(
        entries.map(([keyIdInput, keyInput]) => {
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
            throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_PUBLIC_KEY_INVALID");
          }
          return [keyId, key];
        }),
      ),
    );
  }

  async verify(
    input: Readonly<{
      signerKeyId: string;
      signatureAlgorithm: "ed25519";
      receiptHash: string;
      signature: string;
    }>,
  ): Promise<boolean> {
    const key = this.#publicKeys[input.signerKeyId];
    if (
      !key ||
      input.signatureAlgorithm !== "ed25519" ||
      !hashSchema.safeParse(input.receiptHash).success ||
      !signatureSchema.safeParse(input.signature).success
    ) {
      return false;
    }
    try {
      const signature = decodeCanonicalBase64Url(input.signature);
      if (signature.byteLength !== 64) return false;
      const cryptoKey = await crypto.subtle.importKey(
        "jwk",
        key,
        { name: "Ed25519" },
        false,
        ["verify"],
      );
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

export function isCanopyProofVerifiedMetadataExtractionReceipt(
  value: unknown,
): value is CanopyProofVerifiedMetadataExtractionReceipt {
  if (!value || typeof value !== "object") return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, verifiedMetadataExtractionReceiptBrand);
  return (
    descriptor?.value === true &&
    descriptor.enumerable === false &&
    descriptor.configurable === false &&
    descriptor.writable === false &&
    Object.isFrozen(value)
  );
}

function assertEligibleAuthority(
  authority: CanopyProofEvidenceMetadataExtractionAuthority,
  evaluatedAt: string,
) {
  assertCanopyProofEffectiveMediaObjectProjection({
    baseProjection: authority.baseMediaProjection,
    adapterTrustProjection: authority.mediaAdapterTrustProjection,
    ...(isCanopyProofEffectiveDeviceAttestationProjection(authority.deviceProjection)
      ? { deviceTrustProjection: authority.deviceProjection }
      : {}),
    effectiveProjection: authority.mediaProjection,
  });
  const consentProjectionRoot = hashJson({
    kind: "canopyproof-evidence-consent-projection-v2",
    receiptId: authority.consentProjection.receiptId,
    receiptRoot: authority.consentProjection.receiptRoot,
    organizationId: authority.consentProjection.organizationId,
    subjectId: authority.consentProjection.subjectId,
    state: authority.consentProjection.state,
    evaluatedAt: authority.consentProjection.evaluatedAt,
    ...(authority.consentProjection.revocationId
      ? { revocationId: authority.consentProjection.revocationId }
      : {}),
    ...(authority.consentProjection.revocationRoot
      ? { revocationRoot: authority.consentProjection.revocationRoot }
      : {}),
    safety: authority.consentProjection.safety,
  });
  const deviceProjectionRoot = isCanopyProofEffectiveDeviceAttestationProjection(
    authority.deviceProjection,
  )
    ? assertCanopyProofEffectiveDeviceAttestationProjection(authority.deviceProjection).projectionRoot
    : hashJson({
        kind: "canopyproof-evidence-device-projection-v2",
        attestationId: authority.deviceProjection.attestationId,
        attestationRoot: authority.deviceProjection.attestationRoot,
        organizationId: authority.deviceProjection.organizationId,
        subjectId: authority.deviceProjection.subjectId,
        consentReceiptId: authority.deviceProjection.consentReceiptId,
        state: authority.deviceProjection.state,
        evaluatedAt: authority.deviceProjection.evaluatedAt,
        consentProjectionRoot: authority.deviceProjection.consentProjectionRoot,
        safety: authority.deviceProjection.safety,
      });
  if (
    authority.object.intentId !== authority.intent.id ||
    authority.object.intentRoot !== authority.intent.intentRoot ||
    authority.object.organizationId !== authority.intent.organizationId ||
    authority.object.projectId !== authority.intent.projectId ||
    authority.object.evidenceId !== authority.intent.evidenceId ||
    authority.mediaProjection.objectId !== authority.object.id ||
    authority.mediaProjection.objectRoot !== authority.object.objectRoot ||
    authority.mediaProjection.organizationId !== authority.object.organizationId ||
    authority.mediaProjection.projectId !== authority.object.projectId ||
    authority.mediaProjection.evidenceId !== authority.object.evidenceId ||
    authority.mediaProjection.evaluatedAt !== evaluatedAt ||
    authority.mediaProjection.state !== "available" ||
    authority.consent.id !== authority.intent.consentReceiptId ||
    authority.consent.receiptRoot !== authority.intent.consentReceiptRoot ||
    authority.consent.subjectId !== authority.intent.subjectId ||
    authority.consentProjection.receiptId !== authority.consent.id ||
    authority.consentProjection.receiptRoot !== authority.consent.receiptRoot ||
    authority.consentProjection.organizationId !== authority.object.organizationId ||
    authority.consentProjection.subjectId !== authority.intent.subjectId ||
    authority.consentProjection.evaluatedAt !== evaluatedAt ||
    authority.consentProjection.state !== "active" ||
    authority.consentProjection.projectionRoot !== consentProjectionRoot ||
    authority.device.id !== authority.intent.deviceAttestationId ||
    authority.device.attestationRoot !== authority.intent.deviceAttestationRoot ||
    authority.device.subjectId !== authority.intent.subjectId ||
    authority.device.consentReceiptId !== authority.consent.id ||
    authority.deviceProjection.attestationId !== authority.device.id ||
    authority.deviceProjection.attestationRoot !== authority.device.attestationRoot ||
    authority.deviceProjection.evaluatedAt !== evaluatedAt ||
    authority.deviceProjection.state !== "current" ||
    authority.deviceProjection.projectionRoot !== deviceProjectionRoot ||
    !authority.consent.purposes.includes("media_upload") ||
    !authority.consent.purposes.includes("geolocation")
  ) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_AUTHORITY_INELIGIBLE");
  }
  hashSchema.parse(authority.registeredGpsHash);
}

function isImageContentType(
  value: string,
): value is "image/jpeg" | "image/png" | "image/webp" {
  return value === "image/jpeg" || value === "image/png" || value === "image/webp";
}

function assertSafeMetadataMaterial(values: readonly string[]) {
  const unsafe =
    /(?:https?:\/\/|-----BEGIN|private[_ -]?key|access[_ -]?key|secret|credential|authorization|bearer\s)/i;
  const unsupportedClaim =
    /(?:certified carbon credit|carbon tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution)/i;
  if (
    values.some(
      (value) => unsafe.test(value) || unsupportedClaim.test(value) || /[\r\n\0]/.test(value),
    )
  ) {
    throw new Error("CANOPYPROOF_METADATA_EXTRACTOR_RECEIPT_MATERIAL_UNSAFE");
  }
}

function decodeCanonicalBase64Url(value: string) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(88, "=");
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const canonical = btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  if (canonical !== value) {
    throw new Error("non-canonical base64url");
  }
  return bytes;
}
