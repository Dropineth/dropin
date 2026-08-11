import { hashJson } from "@dropin/crypto";
import { AwsClient } from "aws4fetch";
import { z } from "zod";
import type {
  CanopyProofObjectStorageProviderPort,
} from "./object-storage-adapter.js";
import {
  isCanopyProofR2BucketLockRuntimeError,
  isCanopyProofR2RetentionPolicyVerification,
  type CanopyProofR2RetentionPolicyVerifier,
} from "./r2-bucket-lock-verifier.js";

export type CanopyProofR2ObjectMetadata = {
  readonly key: string;
  readonly version: string;
  readonly size: number;
  readonly etag: string;
  readonly uploaded: Date;
  readonly httpMetadata?: Readonly<{ contentType?: string }>;
  readonly checksums?: Readonly<{ sha256?: ArrayBuffer }>;
};

export interface CanopyProofR2BucketBinding {
  head(key: string): Promise<CanopyProofR2ObjectMetadata | null>;
}

export type CloudflareR2ObjectStorageProviderConfiguration = {
  readonly accountId: string;
  readonly bucketName: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
  readonly bucket: CanopyProofR2BucketBinding;
  readonly retentionPolicyVerifier?: CanopyProofR2RetentionPolicyVerifier;
  readonly clock?: () => Date;
};

const accountIdSchema = z.string().regex(/^[a-f0-9]{32}$/);
const bucketNameSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/);
const accessKeyIdSchema = z.string().regex(/^[A-Za-z0-9]{16,128}$/);
const secretAccessKeySchema = z.string().min(32).max(256).regex(/^[\x21-\x7e]+$/);
const sessionTokenSchema = z.string().min(16).max(4_096).regex(/^[\x21-\x7e]+$/);
const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
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
const contentTypeSchema = z.enum(["image/jpeg", "image/png", "image/webp", "application/json"]);
const createGrantRequestSchema = z
  .object({
    intentId: identifierSchema,
    intentRoot: hashSchema,
    provider: z.literal("cloudflare_r2"),
    providerNamespace: bucketNameSchema,
    objectKey: objectKeySchema,
    contentHash: hashSchema,
    contentType: contentTypeSchema,
    byteLength: z.number().int().positive().max(50 * 1024 * 1024),
    expiresAt: z.string().datetime(),
    correlationId: identifierSchema,
  })
  .strict();
const headRequestSchema = z
  .object({
    provider: z.literal("cloudflare_r2"),
    providerNamespace: bucketNameSchema,
    objectKey: objectKeySchema,
    intentId: identifierSchema,
    intentRoot: hashSchema,
    correlationId: identifierSchema,
  })
  .strict();
const objectVersionSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/);
const etagSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/);

/**
 * Constructor-only provider port. It is deliberately absent from the API
 * composition root, so adding this class cannot activate media intake.
 */
export class CloudflareR2ObjectStorageProviderPort implements CanopyProofObjectStorageProviderPort {
  readonly #accountId: string;
  readonly #bucketName: string;
  readonly #bucket: CanopyProofR2BucketBinding;
  readonly #retentionPolicyVerifier: CanopyProofR2RetentionPolicyVerifier | undefined;
  readonly #signer: AwsClient;
  readonly #clock: () => Date;

  constructor(configuration: CloudflareR2ObjectStorageProviderConfiguration) {
    try {
      this.#accountId = accountIdSchema.parse(configuration.accountId);
      this.#bucketName = bucketNameSchema.parse(configuration.bucketName);
      const accessKeyId = accessKeyIdSchema.parse(configuration.accessKeyId);
      const secretAccessKey = secretAccessKeySchema.parse(configuration.secretAccessKey);
      const sessionToken = configuration.sessionToken
        ? sessionTokenSchema.parse(configuration.sessionToken)
        : undefined;
      this.#bucket = configuration.bucket;
      this.#retentionPolicyVerifier = configuration.retentionPolicyVerifier;
      this.#clock = configuration.clock ?? (() => new Date());
      this.#signer = new AwsClient({
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
        service: "s3",
        region: "auto",
        retries: 0,
      });
    } catch {
      throw runtimeError("CANOPYPROOF_R2_CONFIGURATION_INVALID");
    }
  }

  async createUploadGrant(requestInput: Parameters<CanopyProofObjectStorageProviderPort["createUploadGrant"]>[0]) {
    let request: z.output<typeof createGrantRequestSchema>;
    try {
      request = createGrantRequestSchema.parse(requestInput);
    } catch {
      throw runtimeError("CANOPYPROOF_R2_GRANT_REQUEST_INVALID");
    }
    if (request.providerNamespace !== this.#bucketName) {
      throw runtimeError("CANOPYPROOF_R2_NAMESPACE_MISMATCH");
    }

    const now = canonicalClockInstant(this.#clock, "CANOPYPROOF_R2_CLOCK_INVALID");
    const expiresAtMs = Date.parse(request.expiresAt);
    const ttlMilliseconds = expiresAtMs - now.getTime();
    if (
      ttlMilliseconds < 1_000 ||
      ttlMilliseconds > 15 * 60 * 1_000 ||
      ttlMilliseconds % 1_000 !== 0
    ) {
      throw runtimeError("CANOPYPROOF_R2_GRANT_EXPIRY_INVALID");
    }

    const requiredHeaders = Object.freeze({
      "content-length": String(request.byteLength),
      "content-type": request.contentType,
      "x-amz-checksum-sha256": hexToBase64(request.contentHash),
    });
    const url = new URL(this.#objectUrl(request.objectKey));
    url.searchParams.set("X-Amz-Expires", String(ttlMilliseconds / 1_000));

    let signedRequest: Request;
    try {
      signedRequest = await this.#signer.sign(url, {
        method: "PUT",
        headers: requiredHeaders,
        aws: {
          allHeaders: true,
          datetime: toAmzDate(now),
          signQuery: true,
        },
      });
    } catch {
      throw runtimeError("CANOPYPROOF_R2_GRANT_SIGN_FAILED");
    }

    const signedUrl = signedRequest.url;
    const urlHash = hashJson({ kind: "canopyproof-object-upload-grant-url-v1", url: signedUrl });
    const receiptSeed = {
      intentId: request.intentId,
      intentRoot: request.intentRoot,
      provider: "cloudflare_r2" as const,
      objectKey: request.objectKey,
      method: "PUT" as const,
      urlHash,
      requiredHeaders,
      expiresAt: request.expiresAt,
    };
    return {
      ...receiptSeed,
      url: signedUrl,
      grantReceiptHash: hashJson({
        kind: "canopyproof-object-upload-grant-receipt-v1",
        ...receiptSeed,
      }),
    };
  }

  async headStoredObject(requestInput: Parameters<CanopyProofObjectStorageProviderPort["headStoredObject"]>[0]) {
    let request: z.output<typeof headRequestSchema>;
    try {
      request = headRequestSchema.parse(requestInput);
    } catch {
      throw runtimeError("CANOPYPROOF_R2_HEAD_REQUEST_INVALID");
    }
    if (request.providerNamespace !== this.#bucketName) {
      throw runtimeError("CANOPYPROOF_R2_NAMESPACE_MISMATCH");
    }

    let metadata: CanopyProofR2ObjectMetadata | null;
    try {
      metadata = await this.#bucket.head(request.objectKey);
    } catch {
      throw runtimeError("CANOPYPROOF_R2_HEAD_FAILED");
    }
    if (!metadata) throw runtimeError("CANOPYPROOF_R2_OBJECT_NOT_FOUND");

    const normalized = normalizeR2Metadata(metadata, request.objectKey);
    const verifiedAt = canonicalClockInstant(this.#clock, "CANOPYPROOF_R2_CLOCK_INVALID").toISOString();
    if (Date.parse(normalized.uploadedAt) > Date.parse(verifiedAt)) {
      throw runtimeError("CANOPYPROOF_R2_OBJECT_TIME_INVALID");
    }
    const retention = await this.#verifyRetentionPolicy({
      providerNamespace: this.#bucketName,
      objectKey: request.objectKey,
      objectVersion: normalized.objectVersion,
      uploadedAt: normalized.uploadedAt,
      verifiedAt,
      correlationId: request.correlationId,
    });
    const receiptSeed = {
      intentId: request.intentId,
      intentRoot: request.intentRoot,
      provider: "cloudflare_r2" as const,
      providerNamespace: this.#bucketName,
      objectKey: request.objectKey,
      objectVersion: normalized.objectVersion,
      contentHash: normalized.contentHash,
      contentType: normalized.contentType,
      byteLength: normalized.byteLength,
      etagHash: hashJson({ kind: "canopyproof-r2-object-etag-v1", etag: normalized.etag }),
      uploadedAt: normalized.uploadedAt,
      encryptionMode: "r2_managed" as const,
      ...(retention
        ? {
            objectLockMode: retention.objectLockMode,
            retainUntil: retention.retainUntil,
            retentionPolicyRoot: retention.retentionPolicyRoot,
            retentionVerificationState: retention.retentionVerificationState,
          }
        : {
            objectLockMode: "none" as const,
            retentionVerificationState: "modeled_only" as const,
          }),
      verifiedAt,
    };
    return {
      ...receiptSeed,
      providerReceiptHash: hashJson({
        kind: "canopyproof-stored-object-provider-receipt-v1",
        ...receiptSeed,
      }),
    };
  }

  #objectUrl(objectKey: string) {
    const encodedKey = objectKey.split("/").map((segment) => encodeURIComponent(segment)).join("/");
    return `https://${this.#bucketName}.${this.#accountId}.r2.cloudflarestorage.com/${encodedKey}`;
  }

  async #verifyRetentionPolicy(
    input: Parameters<CanopyProofR2RetentionPolicyVerifier["verifyRetentionPolicy"]>[0],
  ) {
    if (!this.#retentionPolicyVerifier) return undefined;
    let verification: Awaited<ReturnType<CanopyProofR2RetentionPolicyVerifier["verifyRetentionPolicy"]>>;
    try {
      verification = await this.#retentionPolicyVerifier.verifyRetentionPolicy(input);
    } catch (error) {
      if (isCanopyProofR2BucketLockRuntimeError(error)) throw error;
      throw runtimeError("CANOPYPROOF_R2_RETENTION_VERIFICATION_FAILED");
    }
    if (
      !isCanopyProofR2RetentionPolicyVerification(verification) ||
      verification.providerNamespace !== input.providerNamespace ||
      verification.objectKey !== input.objectKey ||
      verification.objectVersion !== input.objectVersion ||
      verification.uploadedAt !== input.uploadedAt ||
      verification.verifiedAt !== input.verifiedAt ||
      verification.objectLockMode !== "governance" ||
      verification.retentionVerificationState !== "verified" ||
      !hashSchema.safeParse(verification.retentionPolicyRoot).success ||
      Date.parse(verification.retainUntil) <= Date.parse(input.verifiedAt)
    ) {
      throw runtimeError("CANOPYPROOF_R2_RETENTION_ATTESTATION_INVALID");
    }
    return verification;
  }
}

function normalizeR2Metadata(metadata: CanopyProofR2ObjectMetadata, expectedKey: string) {
  let objectVersion: string;
  let etag: string;
  let contentType: z.output<typeof contentTypeSchema>;
  try {
    if (metadata.key !== expectedKey) throw new Error("key mismatch");
    objectVersion = objectVersionSchema.parse(metadata.version);
    etag = etagSchema.parse(metadata.etag.replace(/^"|"$/g, ""));
    contentType = contentTypeSchema.parse(metadata.httpMetadata?.contentType);
    if (!Number.isInteger(metadata.size) || metadata.size <= 0 || metadata.size > 50 * 1024 * 1024) {
      throw new Error("size invalid");
    }
    if (!(metadata.uploaded instanceof Date) || !Number.isFinite(metadata.uploaded.getTime())) {
      throw new Error("upload time invalid");
    }
  } catch {
    throw runtimeError("CANOPYPROOF_R2_OBJECT_METADATA_INVALID");
  }
  const checksum = metadata.checksums?.sha256;
  if (!(checksum instanceof ArrayBuffer) || checksum.byteLength !== 32) {
    throw runtimeError("CANOPYPROOF_R2_SHA256_REQUIRED");
  }
  return {
    objectVersion,
    etag,
    contentHash: bytesToHex(new Uint8Array(checksum)),
    contentType,
    byteLength: metadata.size,
    uploadedAt: metadata.uploaded.toISOString(),
  };
}

function canonicalClockInstant(clock: () => Date, code: string) {
  let instant: Date;
  try {
    instant = clock();
  } catch {
    throw runtimeError(code);
  }
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime()) || instant.getMilliseconds() !== 0) {
    throw runtimeError(code);
  }
  return new Date(instant.getTime());
}

function toAmzDate(value: Date) {
  return value.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hexToBase64(value: string) {
  const bytes = Uint8Array.from({ length: value.length / 2 }, (_, index) =>
    Number.parseInt(value.slice(index * 2, index * 2 + 2), 16),
  );
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToHex(value: Uint8Array) {
  return [...value].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function runtimeError(code: string) {
  const error = new Error(code);
  error.name = "CanopyProofProviderRuntimeError";
  return error;
}
