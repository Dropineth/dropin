import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import type {
  CanopyProofEvidenceMediaStorageProvider,
  CanopyProofEvidenceMediaUploadIntentFact,
} from "./evidence-media-authority.js";

export type CanopyProofObjectUploadGrant = {
  readonly intentId: string;
  readonly intentRoot: string;
  readonly provider: CanopyProofEvidenceMediaStorageProvider;
  readonly objectKey: string;
  readonly method: "PUT";
  readonly url: string;
  readonly requiredHeaders: Readonly<Record<string, string>>;
  readonly expiresAt: string;
  readonly urlHash: string;
  readonly grantReceiptHash: string;
};

export type CanopyProofStoredObjectReceipt = {
  readonly intentId: string;
  readonly intentRoot: string;
  readonly provider: CanopyProofEvidenceMediaStorageProvider;
  readonly providerNamespace: string;
  readonly objectKey: string;
  readonly objectVersion: string;
  readonly contentHash: string;
  readonly contentType: CanopyProofEvidenceMediaUploadIntentFact["contentType"];
  readonly byteLength: number;
  readonly etagHash: string;
  readonly uploadedAt: string;
  readonly encryptionMode: "r2_managed" | "sse_kms" | "client_side";
  readonly encryptionKeyRef?: string;
  readonly objectLockMode: "none" | "governance" | "compliance";
  readonly retainUntil?: string;
  readonly retentionPolicyRoot?: string;
  readonly retentionVerificationState: "modeled_only" | "verified";
  readonly providerReceiptHash: string;
  readonly verifiedAt: string;
  readonly providerVerificationRoot: string;
};

const adapterVerifiedStoredObjectReceiptBrand: unique symbol = Symbol(
  "CanopyProofAdapterVerifiedStoredObjectReceipt",
);

export type CanopyProofAdapterVerifiedStoredObjectReceipt = CanopyProofStoredObjectReceipt & {
  readonly [adapterVerifiedStoredObjectReceiptBrand]: true;
};

export type CanopyProofObjectStorageAdapterConfiguration = {
  readonly provider: CanopyProofEvidenceMediaStorageProvider;
  readonly providerNamespace: string;
  readonly allowedUploadHosts: readonly string[];
  readonly maximumGrantTtlSeconds?: number;
};

export interface CanopyProofObjectStorageProviderPort {
  createUploadGrant(
    request: Readonly<{
      intentId: string;
      intentRoot: string;
      provider: CanopyProofEvidenceMediaStorageProvider;
      providerNamespace: string;
      objectKey: string;
      contentHash: string;
      contentType: CanopyProofEvidenceMediaUploadIntentFact["contentType"];
      byteLength: number;
      expiresAt: string;
      correlationId: string;
    }>,
  ): Promise<unknown>;

  headStoredObject(
    request: Readonly<{
      provider: CanopyProofEvidenceMediaStorageProvider;
      providerNamespace: string;
      objectKey: string;
      intentId: string;
      intentRoot: string;
      correlationId: string;
    }>,
  ): Promise<unknown>;
}

export interface CanopyProofObjectStorageAdapter {
  readonly provider: CanopyProofEvidenceMediaStorageProvider;

  createUploadGrant(
    intent: CanopyProofEvidenceMediaUploadIntentFact,
    context: Readonly<{ now: string; correlationId: string }>,
  ): Promise<CanopyProofObjectUploadGrant>;

  verifyStoredObject(
    intent: CanopyProofEvidenceMediaUploadIntentFact,
    context: Readonly<{ now: string; correlationId: string }>,
  ): Promise<CanopyProofAdapterVerifiedStoredObjectReceipt>;
}

const allowedUploadHeaders = new Set([
  "content-length",
  "content-type",
  "x-amz-checksum-sha256",
  "x-amz-content-sha256",
]);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const providerNamespaceSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const objectKeySchema = z
  .string()
  .min(1)
  .max(1_024)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/)
  .refine(
    (value) =>
      !value.includes("//") &&
      !value.split("/").some((segment) => segment === "." || segment === "..") &&
      !/(?:credential|password|secret|private[_-]?key)/i.test(value),
    "CanopyProof object key is unsafe.",
  );
const grantSchema = z
  .object({
    intentId: z.string().min(1),
    intentRoot: z.string().regex(/^[a-f0-9]{64}$/),
    provider: z.enum(["cloudflare_r2", "s3", "gcs"]),
    objectKey: objectKeySchema,
    method: z.literal("PUT"),
    url: z.string().url(),
    requiredHeaders: z.record(z.string(), z.string()),
    expiresAt: z.string().datetime(),
    urlHash: z.string().regex(/^[a-f0-9]{64}$/),
    grantReceiptHash: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();
const storedObjectReceiptSchema = z
  .object({
    intentId: z.string().min(1),
    intentRoot: hashSchema,
    provider: z.enum(["cloudflare_r2", "s3", "gcs"]),
    providerNamespace: providerNamespaceSchema,
    objectKey: objectKeySchema,
    objectVersion: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/),
    contentHash: hashSchema,
    contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/json"]),
    byteLength: z.number().int().positive().max(50 * 1024 * 1024),
    etagHash: hashSchema,
    uploadedAt: z.string().datetime(),
    encryptionMode: z.enum(["r2_managed", "sse_kms", "client_side"]),
    encryptionKeyRef: providerNamespaceSchema.optional(),
    objectLockMode: z.enum(["none", "governance", "compliance"]),
    retainUntil: z.string().datetime().optional(),
    retentionPolicyRoot: hashSchema.optional(),
    retentionVerificationState: z.enum(["modeled_only", "verified"]),
    providerReceiptHash: hashSchema,
    verifiedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.encryptionMode === "sse_kms" && !value.encryptionKeyRef) {
      context.addIssue({ code: "custom", path: ["encryptionKeyRef"], message: "SSE-KMS requires a key reference." });
    }
    if (value.objectLockMode === "none" && (value.retainUntil || value.retentionPolicyRoot)) {
      context.addIssue({
        code: "custom",
        path: ["objectLockMode"],
        message: "Unlocked receipts cannot assert a retention policy.",
      });
    }
    if (value.objectLockMode !== "none" && (!value.retainUntil || !value.retentionPolicyRoot)) {
      context.addIssue({
        code: "custom",
        path: ["retentionPolicyRoot"],
        message: "Locked receipts require a bounded retention policy.",
      });
    }
    if (value.retentionVerificationState === "verified" && value.objectLockMode === "none") {
      context.addIssue({
        code: "custom",
        path: ["retentionVerificationState"],
        message: "Verified retention requires an object lock policy.",
      });
    }
  });

export function validateCanopyProofObjectUploadGrant(
  intent: CanopyProofEvidenceMediaUploadIntentFact,
  grantInput: unknown,
  policy: Readonly<{
    now: string;
    allowedHosts: readonly string[];
    provider?: CanopyProofEvidenceMediaStorageProvider;
    maximumTtlSeconds?: number;
  }>,
): CanopyProofObjectUploadGrant {
  const grant = grantSchema.parse(grantInput);
  const now = z.string().datetime().parse(policy.now);
  const maximumTtlSeconds = policy.maximumTtlSeconds ?? 15 * 60;
  if (!Number.isInteger(maximumTtlSeconds) || maximumTtlSeconds < 30 || maximumTtlSeconds > 15 * 60) {
    throw new Error("CanopyProof object upload grant maximum TTL must be between 30 and 900 seconds.");
  }
  const url = new URL(grant.url);
  const allowedHosts = new Set(normalizeAllowedHosts(policy.allowedHosts));
  if (
    url.protocol !== "https:" ||
    (url.port !== "" && url.port !== "443") ||
    url.username ||
    url.password ||
    url.hash ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new Error("CanopyProof object upload grant endpoint is not allowlisted HTTPS.");
  }
  if (grant.intentId !== intent.id || grant.intentRoot !== intent.intentRoot) {
    throw new Error("CanopyProof object upload grant intent binding is invalid.");
  }
  if (policy.provider && grant.provider !== policy.provider) {
    throw new Error("CanopyProof object upload grant provider binding is invalid.");
  }
  if (grant.objectKey !== intent.objectKey) {
    throw new Error("CanopyProof object upload grant key binding is invalid.");
  }
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
  } catch {
    throw new Error("CanopyProof object upload grant path encoding is invalid.");
  }
  if (decodedPath !== intent.objectKey && !decodedPath.endsWith(`/${intent.objectKey}`)) {
    throw new Error("CanopyProof object upload grant URL does not bind the intended object key.");
  }
  const nowMs = Date.parse(now);
  const expiryMs = Date.parse(grant.expiresAt);
  if (
    expiryMs <= nowMs ||
    expiryMs - nowMs > maximumTtlSeconds * 1_000 ||
    expiryMs > Date.parse(intent.expiresAt)
  ) {
    throw new Error("CanopyProof object upload grant expiry exceeds the bounded intent window.");
  }
  const normalizedHeaderEntries = Object.entries(grant.requiredHeaders)
    .map(([name, value]) => [name.trim().toLowerCase(), value.trim()] as const)
    .sort(([left], [right]) => left.localeCompare(right));
  if (new Set(normalizedHeaderEntries.map(([name]) => name)).size !== normalizedHeaderEntries.length) {
    throw new Error("CanopyProof object upload grant contains duplicate request headers.");
  }
  const normalizedHeaders = Object.fromEntries(normalizedHeaderEntries);
  if (
    Object.keys(normalizedHeaders).some((name) => !allowedUploadHeaders.has(name)) ||
    normalizedHeaders.authorization ||
    normalizedHeaders.cookie ||
    normalizedHeaders["set-cookie"]
  ) {
    throw new Error("CanopyProof object upload grant contains a forbidden request header.");
  }
  if (
    normalizedHeaders["content-type"] !== intent.contentType ||
    normalizedHeaders["content-length"] !== String(intent.byteLength)
  ) {
    throw new Error("CanopyProof object upload grant content constraints do not match the intent.");
  }
  const contentHash = normalizeHash(intent.contentHash);
  if (
    normalizedHeaders["x-amz-content-sha256"] !== contentHash &&
    normalizedHeaders["x-amz-checksum-sha256"] !== sha256HexToBase64(contentHash)
  ) {
    throw new Error("CanopyProof object upload grant checksum does not match the intent.");
  }
  validatePresignedUrlEnvelope(grant.provider, url, nowMs, expiryMs, normalizedHeaders);
  const urlHash = hashJson({ kind: "canopyproof-object-upload-grant-url-v1", url: grant.url });
  const receiptSeed = {
    intentId: intent.id,
    intentRoot: intent.intentRoot,
    provider: grant.provider,
    objectKey: intent.objectKey,
    method: grant.method,
    urlHash,
    requiredHeaders: normalizedHeaders,
    expiresAt: grant.expiresAt,
  } as const;
  const grantReceiptHash = hashJson({ kind: "canopyproof-object-upload-grant-receipt-v1", ...receiptSeed });
  if (grant.urlHash !== urlHash || grant.grantReceiptHash !== grantReceiptHash) {
    throw new Error("CanopyProof object upload grant receipt hash is invalid.");
  }
  return { ...receiptSeed, url: grant.url, urlHash, grantReceiptHash };
}

export function validateCanopyProofStoredObjectReceipt(
  intent: CanopyProofEvidenceMediaUploadIntentFact,
  receiptInput: unknown,
  policy: Readonly<{
    now: string;
    provider: CanopyProofEvidenceMediaStorageProvider;
    providerNamespace: string;
    maximumClockSkewSeconds?: number;
  }>,
): CanopyProofStoredObjectReceipt {
  const receipt = storedObjectReceiptSchema.parse(receiptInput);
  const now = z.string().datetime().parse(policy.now);
  const providerNamespace = providerNamespaceSchema.parse(policy.providerNamespace);
  const maximumClockSkewSeconds = policy.maximumClockSkewSeconds ?? 60;
  if (!Number.isInteger(maximumClockSkewSeconds) || maximumClockSkewSeconds < 0 || maximumClockSkewSeconds > 300) {
    throw new Error("CanopyProof object receipt clock skew must be between 0 and 300 seconds.");
  }
  if (
    receipt.intentId !== intent.id ||
    receipt.intentRoot !== intent.intentRoot ||
    receipt.provider !== policy.provider ||
    receipt.providerNamespace !== providerNamespace ||
    receipt.objectKey !== intent.objectKey
  ) {
    throw new Error("CanopyProof stored object receipt authority binding is invalid.");
  }
  assertSafeProviderMetadata([
    receipt.providerNamespace,
    receipt.objectVersion,
    receipt.encryptionKeyRef ?? "",
  ]);
  if (
    receipt.contentHash !== normalizeHash(intent.contentHash) ||
    receipt.contentType !== intent.contentType ||
    receipt.byteLength !== intent.byteLength
  ) {
    throw new Error("CanopyProof stored object receipt content binding is invalid.");
  }
  const capturedAtMs = Date.parse(intent.capturedAt);
  const intentExpiryMs = Date.parse(intent.expiresAt);
  const uploadedAtMs = Date.parse(receipt.uploadedAt);
  const verifiedAtMs = Date.parse(receipt.verifiedAt);
  const nowMs = Date.parse(now);
  if (uploadedAtMs < capturedAtMs || uploadedAtMs > intentExpiryMs) {
    throw new Error("CanopyProof stored object upload time is outside the intent window.");
  }
  if (verifiedAtMs < uploadedAtMs || verifiedAtMs > nowMs + maximumClockSkewSeconds * 1_000) {
    throw new Error("CanopyProof stored object verification time is invalid.");
  }
  if (receipt.retainUntil && Date.parse(receipt.retainUntil) <= uploadedAtMs) {
    throw new Error("CanopyProof stored object retention must extend beyond upload time.");
  }
  const seed = {
    intentId: intent.id,
    intentRoot: intent.intentRoot,
    provider: receipt.provider,
    providerNamespace,
    objectKey: intent.objectKey,
    objectVersion: receipt.objectVersion,
    contentHash: normalizeHash(receipt.contentHash),
    contentType: receipt.contentType,
    byteLength: receipt.byteLength,
    etagHash: normalizeHash(receipt.etagHash),
    uploadedAt: receipt.uploadedAt,
    encryptionMode: receipt.encryptionMode,
    ...(receipt.encryptionKeyRef ? { encryptionKeyRef: receipt.encryptionKeyRef } : {}),
    objectLockMode: receipt.objectLockMode,
    ...(receipt.retainUntil ? { retainUntil: receipt.retainUntil } : {}),
    ...(receipt.retentionPolicyRoot ? { retentionPolicyRoot: receipt.retentionPolicyRoot } : {}),
    retentionVerificationState: receipt.retentionVerificationState,
    verifiedAt: receipt.verifiedAt,
  } as const;
  const providerReceiptHash = hashJson({ kind: "canopyproof-stored-object-provider-receipt-v1", ...seed });
  if (receipt.providerReceiptHash !== providerReceiptHash) {
    throw new Error("CanopyProof stored object receipt hash is invalid.");
  }
  const providerVerificationRoot = hashJson({
    kind: "canopyproof-stored-object-provider-verification-v1",
    intentId: intent.id,
    intentRoot: intent.intentRoot,
    provider: receipt.provider,
    providerNamespace,
    providerReceiptHash,
    verifiedAt: receipt.verifiedAt,
  });
  return { ...seed, providerReceiptHash, providerVerificationRoot };
}

export class PolicyEnforcedCanopyProofObjectStorageAdapter implements CanopyProofObjectStorageAdapter {
  readonly provider: CanopyProofEvidenceMediaStorageProvider;
  private readonly providerNamespace: string;
  private readonly allowedUploadHosts: readonly string[];
  private readonly maximumGrantTtlSeconds: number;

  constructor(
    configuration: CanopyProofObjectStorageAdapterConfiguration,
    private readonly port: CanopyProofObjectStorageProviderPort,
  ) {
    this.provider = z.enum(["cloudflare_r2", "s3", "gcs"]).parse(configuration.provider);
    if (this.provider === "gcs") {
      throw new Error("CanopyProof GCS grant validation is not implemented; the adapter remains disabled.");
    }
    this.providerNamespace = providerNamespaceSchema.parse(configuration.providerNamespace);
    assertSafeProviderMetadata([this.providerNamespace]);
    this.allowedUploadHosts = normalizeAllowedHosts(configuration.allowedUploadHosts);
    this.maximumGrantTtlSeconds = configuration.maximumGrantTtlSeconds ?? 15 * 60;
    if (
      !Number.isInteger(this.maximumGrantTtlSeconds) ||
      this.maximumGrantTtlSeconds < 30 ||
      this.maximumGrantTtlSeconds > 15 * 60
    ) {
      throw new Error("CanopyProof object storage adapter grant TTL must be between 30 and 900 seconds.");
    }
  }

  async createUploadGrant(
    intent: CanopyProofEvidenceMediaUploadIntentFact,
    context: Readonly<{ now: string; correlationId: string }>,
  ): Promise<CanopyProofObjectUploadGrant> {
    const now = z.string().datetime().parse(context.now);
    const correlationId = correlationIdSchema.parse(context.correlationId);
    const expiresAt = new Date(
      Math.min(Date.parse(intent.expiresAt), Date.parse(now) + this.maximumGrantTtlSeconds * 1_000),
    ).toISOString();
    const grant = await this.port.createUploadGrant({
      intentId: intent.id,
      intentRoot: intent.intentRoot,
      provider: this.provider,
      providerNamespace: this.providerNamespace,
      objectKey: intent.objectKey,
      contentHash: normalizeHash(intent.contentHash),
      contentType: intent.contentType,
      byteLength: intent.byteLength,
      expiresAt,
      correlationId,
    });
    return validateCanopyProofObjectUploadGrant(intent, grant, {
      now,
      allowedHosts: this.allowedUploadHosts,
      provider: this.provider,
      maximumTtlSeconds: this.maximumGrantTtlSeconds,
    });
  }

  async verifyStoredObject(
    intent: CanopyProofEvidenceMediaUploadIntentFact,
    context: Readonly<{ now: string; correlationId: string }>,
  ): Promise<CanopyProofAdapterVerifiedStoredObjectReceipt> {
    const now = z.string().datetime().parse(context.now);
    const correlationId = correlationIdSchema.parse(context.correlationId);
    const receipt = await this.port.headStoredObject({
      provider: this.provider,
      providerNamespace: this.providerNamespace,
      objectKey: intent.objectKey,
      intentId: intent.id,
      intentRoot: intent.intentRoot,
      correlationId,
    });
    const verifiedReceipt = validateCanopyProofStoredObjectReceipt(intent, receipt, {
      now,
      provider: this.provider,
      providerNamespace: this.providerNamespace,
    });
    Object.defineProperty(verifiedReceipt, adapterVerifiedStoredObjectReceiptBrand, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    });
    return Object.freeze(verifiedReceipt) as CanopyProofAdapterVerifiedStoredObjectReceipt;
  }
}

export class DisabledCanopyProofObjectStorageAdapter implements CanopyProofObjectStorageAdapter {
  readonly provider = "cloudflare_r2" as const;

  async createUploadGrant(): Promise<CanopyProofObjectUploadGrant> {
    throw new Error(
      "CANOPYPROOF_OBJECT_STORAGE_ADAPTER_UNAVAILABLE: no approved object-storage grant signer is configured.",
    );
  }

  async verifyStoredObject(): Promise<CanopyProofAdapterVerifiedStoredObjectReceipt> {
    throw new Error(
      "CANOPYPROOF_OBJECT_STORAGE_ADAPTER_UNAVAILABLE: no approved object-storage receipt verifier is configured.",
    );
  }
}

export function isCanopyProofAdapterVerifiedStoredObjectReceipt(
  value: unknown,
): value is CanopyProofAdapterVerifiedStoredObjectReceipt {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Readonly<Record<PropertyKey, unknown>>)[adapterVerifiedStoredObjectReceiptBrand] === true,
  );
}

const correlationIdSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);

function normalizeHash(value: string) {
  return value.toLowerCase().replace(/^sha256:/, "");
}

function sha256HexToBase64(value: string) {
  const normalized = hashSchema.parse(normalizeHash(value));
  const bytes = Uint8Array.from({ length: normalized.length / 2 }, (_, index) =>
    Number.parseInt(normalized.slice(index * 2, index * 2 + 2), 16),
  );
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function normalizeAllowedHosts(hosts: readonly string[]) {
  const normalized = [...new Set(hosts.map((host) => host.trim().toLowerCase()).filter(Boolean))].sort();
  if (normalized.length === 0) {
    throw new Error("CanopyProof object storage adapter requires an upload host allowlist.");
  }
  for (const host of normalized) {
    if (
      !/^[a-z0-9.-]+$/.test(host) ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      !host.includes(".") ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) ||
      host.includes("..")
    ) {
      throw new Error("CanopyProof object storage adapter upload host is invalid.");
    }
  }
  return normalized;
}

function validatePresignedUrlEnvelope(
  provider: CanopyProofEvidenceMediaStorageProvider,
  url: URL,
  nowMs: number,
  declaredExpiryMs: number,
  requiredHeaders: Readonly<Record<string, string>>,
) {
  if (provider === "gcs") {
    throw new Error("CanopyProof GCS grant validation is not implemented; the adapter remains disabled.");
  }
  if (provider === "cloudflare_r2" && !url.hostname.toLowerCase().endsWith(".r2.cloudflarestorage.com")) {
    throw new Error("CanopyProof R2 presigned grants must use the R2 S3 API domain.");
  }
  const algorithm = requireSingleQueryParameter(url, "X-Amz-Algorithm");
  const credential = requireSingleQueryParameter(url, "X-Amz-Credential");
  const signedAt = requireSingleQueryParameter(url, "X-Amz-Date");
  const expires = requireSingleQueryParameter(url, "X-Amz-Expires");
  const signature = requireSingleQueryParameter(url, "X-Amz-Signature");
  const signedHeadersValue = requireSingleQueryParameter(url, "X-Amz-SignedHeaders");
  if (algorithm !== "AWS4-HMAC-SHA256" || !/^[a-f0-9]{64}$/.test(signature)) {
    throw new Error("CanopyProof object upload grant SigV4 envelope is invalid.");
  }
  const issuedAtMs = parseAmzDate(signedAt);
  const expiresSeconds = Number(expires);
  if (!Number.isInteger(expiresSeconds) || expiresSeconds < 1 || expiresSeconds > 15 * 60) {
    throw new Error("CanopyProof object upload grant SigV4 expiry is invalid.");
  }
  const actualExpiryMs = issuedAtMs + expiresSeconds * 1_000;
  if (
    issuedAtMs > nowMs + 5 * 60 * 1_000 ||
    actualExpiryMs <= nowMs ||
    actualExpiryMs !== declaredExpiryMs
  ) {
    throw new Error("CanopyProof object upload grant declared and signed expiry do not match.");
  }
  const credentialParts = credential.split("/");
  if (
    credentialParts.length !== 5 ||
    !credentialParts[0] ||
    credentialParts[1] !== signedAt.slice(0, 8) ||
    (provider === "cloudflare_r2" && credentialParts[2] !== "auto") ||
    credentialParts[3] !== "s3" ||
    credentialParts[4] !== "aws4_request"
  ) {
    throw new Error("CanopyProof object upload grant credential scope is invalid.");
  }
  const signedHeaders = signedHeadersValue.split(";").map((header) => header.trim().toLowerCase());
  const signedHeaderSet = new Set(signedHeaders);
  if (
    signedHeaders.length !== signedHeaderSet.size ||
    signedHeaders.join(";") !== [...signedHeaders].sort().join(";") ||
    !signedHeaderSet.has("host") ||
    [...signedHeaderSet].some((header) => header !== "host" && !allowedUploadHeaders.has(header))
  ) {
    throw new Error("CanopyProof object upload grant signed-header scope is invalid.");
  }
  const integrityHeader = requiredHeaders["x-amz-content-sha256"]
    ? "x-amz-content-sha256"
    : "x-amz-checksum-sha256";
  if (!signedHeaderSet.has("content-type") || !signedHeaderSet.has(integrityHeader)) {
    throw new Error("CanopyProof object upload grant does not sign its content constraints.");
  }
}

function requireSingleQueryParameter(url: URL, name: string) {
  const values = url.searchParams.getAll(name);
  if (values.length !== 1 || !values[0]) {
    throw new Error(`CanopyProof object upload grant requires one ${name} parameter.`);
  }
  return values[0];
}

function parseAmzDate(value: string) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value);
  if (!match) throw new Error("CanopyProof object upload grant X-Amz-Date is invalid.");
  const [, year, month, day, hour, minute, second] = match;
  const result = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  const roundTrip = new Date(result).toISOString().replace(/[-:]/g, "").replace(".000", "");
  if (roundTrip !== value) throw new Error("CanopyProof object upload grant X-Amz-Date is invalid.");
  return result;
}

function assertSafeProviderMetadata(values: readonly string[]) {
  for (const value of values) {
    if (
      /(?:bearer\s+|password|secret|private[_ -]?key|BEGIN [A-Z ]*PRIVATE KEY|https?:\/\/|[?&](?:token|signature|credential)=)/i.test(
        value,
      )
    ) {
      throw new Error("CanopyProof object storage metadata contains credential or endpoint material.");
    }
    if (/(?:certified carbon credit|carbon tax offset|guaranteed (?:rwa )?yield|automatic \$?canopy distribution)/i.test(value)) {
      throw new Error("CanopyProof object storage metadata contains an unsupported public claim.");
    }
  }
}
