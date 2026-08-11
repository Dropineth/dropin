import { hashJson } from "@dropin/crypto";
import { AwsClient } from "aws4fetch";
import { z } from "zod";
import {
  canopyProofEnvironmentalProofSigningAlgorithms,
  type CanopyProofDetachedSignatureVerificationRequest,
  type CanopyProofEnvironmentalProofManagedSignatureVerifier,
  type CanopyProofEnvironmentalProofSigningAlgorithm,
  type CanopyProofExternalVerificationReceipt,
  type CanopyProofManagedKeyAttestationVerificationRequest,
} from "./environmental-proof-lifecycle-authority.js";

const providerRuntimeErrorBrand: unique symbol = Symbol("CanopyProofAwsKmsRuntimeError");

const EXTERNAL_VERIFIER_ID = "canopyproof_aws_kms_verify_v1";
const PURPOSE = "canopyproof_environmental_proof_record" as const;

const awsPartitions = ["aws", "aws-us-gov"] as const;
const awsKeySpecs = [
  "ECC_NIST_P256",
  "ECC_NIST_EDWARDS25519",
  "RSA_2048",
  "RSA_3072",
  "RSA_4096",
] as const;
const awsSigningAlgorithms = [
  "RSASSA_PSS_SHA_256",
  "RSASSA_PSS_SHA_384",
  "RSASSA_PSS_SHA_512",
  "RSASSA_PKCS1_V1_5_SHA_256",
  "RSASSA_PKCS1_V1_5_SHA_384",
  "RSASSA_PKCS1_V1_5_SHA_512",
  "ECDSA_SHA_256",
  "ECDSA_SHA_384",
  "ECDSA_SHA_512",
  "SM2DSA",
  "ML_DSA_SHAKE_256",
  "ED25519_SHA_512",
  "ED25519_PH_SHA_512",
] as const;

type AwsPartition = (typeof awsPartitions)[number];
type AwsKeySpec = (typeof awsKeySpecs)[number];
type AwsSigningAlgorithm = (typeof awsSigningAlgorithms)[number];
type AwsMessageType = "DIGEST" | "RAW";

export type AwsKmsManagedSignatureVerifierConfiguration = {
  readonly accountId: string;
  readonly partition: AwsPartition;
  readonly region: string;
  readonly keyArn: string;
  readonly keyVersion: string;
  readonly organizationId: string;
  readonly algorithm: CanopyProofEnvironmentalProofSigningAlgorithm;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
  readonly timeoutMilliseconds?: number;
  readonly maximumResponseBytes?: number;
  readonly maximumClockSkewMilliseconds?: number;
  readonly clock?: () => Date;
  readonly fetcher?: typeof fetch;
};

export type AwsKmsPublicKeyAttestation = {
  readonly organizationId: string;
  readonly partition: AwsPartition;
  readonly region: string;
  readonly providerKeyId: string;
  readonly keyVersion: string;
  readonly protocolAlgorithm: CanopyProofEnvironmentalProofSigningAlgorithm;
  readonly keySpec: AwsKeySpec;
  readonly keyUsage: "SIGN_VERIFY";
  readonly signingAlgorithms: readonly AwsSigningAlgorithm[];
  readonly publicKeyHash: string;
};

type AwsKmsOperation = "GET_PUBLIC_KEY" | "VERIFY";

const accountIdSchema = z.string().regex(/^\d{12}$/);
const partitionSchema = z.enum(awsPartitions);
const regionSchema = z.string().regex(/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/);
const keyVersionSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/);
const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const accessKeyIdSchema = z.string().regex(/^[A-Z0-9]{16,128}$/);
const secretAccessKeySchema = z.string().min(32).max(256).regex(/^[\x21-\x7e]+$/);
const sessionTokenSchema = z.string().min(16).max(4_096).regex(/^[\x21-\x7e]+$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const keyArnSchema = z.string().min(40).max(256).regex(/^arn:[a-z0-9-]+:kms:[a-z0-9-]+:\d{12}:key\/[A-Za-z0-9-]+$/);
const protocolAlgorithmSchema = z.enum(canopyProofEnvironmentalProofSigningAlgorithms);
const canonicalTimestampSchema = z.string().datetime();
const base64UrlSchema = z.string().min(2).max(8_192).regex(/^[A-Za-z0-9_-]+$/);
const awsKeySpecSchema = z.enum(awsKeySpecs);
const awsSigningAlgorithmSchema = z.enum(awsSigningAlgorithms);
const awsRequestIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9-]{15,127}$/);

const signingAlgorithmsSchema = z
  .array(awsSigningAlgorithmSchema)
  .min(1)
  .max(16)
  .refine((values) => new Set(values).size === values.length, "duplicate signing algorithm");

const managedKeyRequestSchema = z
  .object({
    organizationId: identifierSchema,
    provider: z.literal("aws_kms"),
    providerKeyId: keyArnSchema,
    keyVersion: keyVersionSchema,
    algorithm: protocolAlgorithmSchema,
    purpose: z.literal(PURPOSE),
    publicKeyHash: hashSchema,
    providerAttestationHash: hashSchema,
    activeFrom: canonicalTimestampSchema,
    expiresAt: canonicalTimestampSchema.optional(),
    requestedAt: canonicalTimestampSchema,
  })
  .strict();

const detachedSignatureRequestSchema = z
  .object({
    organizationId: identifierSchema,
    recordId: identifierSchema,
    recordRoot: hashSchema,
    bindingId: identifierSchema,
    bindingRoot: hashSchema,
    provider: z.literal("aws_kms"),
    providerKeyId: keyArnSchema,
    keyVersion: keyVersionSchema,
    algorithm: protocolAlgorithmSchema,
    purpose: z.literal(PURPOSE),
    publicKeyHash: hashSchema,
    signaturePayloadHash: hashSchema,
    detachedSignature: base64UrlSchema,
    signedAt: canonicalTimestampSchema,
  })
  .strict();

const publicKeyResponseSchema = z.object({
  CustomerMasterKeySpec: awsKeySpecSchema.optional(),
  KeyId: keyArnSchema,
  KeySpec: awsKeySpecSchema,
  KeyUsage: z.literal("SIGN_VERIFY"),
  PublicKey: z.string().min(4).max(12_000).regex(/^[A-Za-z0-9+/]+={0,2}$/),
  SigningAlgorithms: signingAlgorithmsSchema,
});

const verifyResponseSchema = z.object({
  KeyId: keyArnSchema,
  SignatureValid: z.literal(true),
  SigningAlgorithm: awsSigningAlgorithmSchema,
});

const publicKeyAttestationSchema = z
  .object({
    organizationId: identifierSchema,
    partition: partitionSchema,
    region: regionSchema,
    providerKeyId: keyArnSchema,
    keyVersion: keyVersionSchema,
    protocolAlgorithm: protocolAlgorithmSchema,
    keySpec: awsKeySpecSchema,
    keyUsage: z.literal("SIGN_VERIFY"),
    signingAlgorithms: signingAlgorithmsSchema,
    publicKeyHash: hashSchema,
  })
  .strict();

/**
 * Computes the provisioning-time hash expected by the lifecycle command. The
 * key-version value is a CanopyProof governance label, not an AWS-native fact.
 */
export function computeAwsKmsProviderAttestationHash(input: AwsKmsPublicKeyAttestation): string {
  const parsed = publicKeyAttestationSchema.parse({
    ...input,
    signingAlgorithms: [...input.signingAlgorithms].sort(),
  });
  return hashJson({
    kind: "canopyproof-aws-kms-public-key-attestation-v1",
    ...parsed,
  });
}

/**
 * Verification-only provider boundary. It is deliberately absent from the API
 * composition root and exposes no signing operation.
 */
export class AwsKmsManagedSignatureVerifier
  implements CanopyProofEnvironmentalProofManagedSignatureVerifier
{
  readonly #accountId: string;
  readonly #partition: AwsPartition;
  readonly #region: string;
  readonly #keyArn: string;
  readonly #keyVersion: string;
  readonly #organizationId: string;
  readonly #algorithm: CanopyProofEnvironmentalProofSigningAlgorithm;
  readonly #algorithmContract: Readonly<{
    keySpecs: readonly AwsKeySpec[];
    signingAlgorithm: AwsSigningAlgorithm;
    messageType: AwsMessageType;
  }>;
  readonly #endpoint: URL;
  readonly #signer: AwsClient;
  readonly #timeoutMilliseconds: number;
  readonly #maximumResponseBytes: number;
  readonly #maximumClockSkewMilliseconds: number;
  readonly #clock: () => Date;
  readonly #fetcher: typeof fetch;

  constructor(configuration: AwsKmsManagedSignatureVerifierConfiguration) {
    try {
      this.#accountId = accountIdSchema.parse(configuration.accountId);
      this.#partition = partitionSchema.parse(configuration.partition);
      this.#region = validateRegionForPartition(configuration.region, this.#partition);
      this.#keyArn = validateFixedKeyArn(
        configuration.keyArn,
        this.#partition,
        this.#region,
        this.#accountId,
      );
      this.#keyVersion = keyVersionSchema.parse(configuration.keyVersion);
      this.#organizationId = identifierSchema.parse(configuration.organizationId);
      this.#algorithm = protocolAlgorithmSchema.parse(configuration.algorithm);
      this.#algorithmContract = algorithmContract(this.#algorithm);
      const accessKeyId = accessKeyIdSchema.parse(configuration.accessKeyId);
      const secretAccessKey = secretAccessKeySchema.parse(configuration.secretAccessKey);
      const sessionToken = configuration.sessionToken
        ? sessionTokenSchema.parse(configuration.sessionToken)
        : undefined;
      this.#timeoutMilliseconds = configuration.timeoutMilliseconds ?? 5_000;
      this.#maximumResponseBytes = configuration.maximumResponseBytes ?? 64 * 1_024;
      this.#maximumClockSkewMilliseconds = configuration.maximumClockSkewMilliseconds ?? 5 * 60 * 1_000;
      if (
        !Number.isInteger(this.#timeoutMilliseconds) ||
        this.#timeoutMilliseconds < 100 ||
        this.#timeoutMilliseconds > 30_000 ||
        !Number.isInteger(this.#maximumResponseBytes) ||
        this.#maximumResponseBytes < 1_024 ||
        this.#maximumResponseBytes > 256 * 1_024 ||
        !Number.isInteger(this.#maximumClockSkewMilliseconds) ||
        this.#maximumClockSkewMilliseconds < 0 ||
        this.#maximumClockSkewMilliseconds > 15 * 60 * 1_000 ||
        (configuration.clock !== undefined && typeof configuration.clock !== "function") ||
        (configuration.fetcher !== undefined && typeof configuration.fetcher !== "function")
      ) {
        throw new Error("invalid runtime bounds");
      }
      this.#clock = configuration.clock ?? (() => new Date());
      this.#fetcher = configuration.fetcher ?? fetch;
      this.#endpoint = new URL(`https://kms.${this.#region}.amazonaws.com/`);
      this.#signer = new AwsClient({
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
        service: "kms",
        region: this.#region,
        retries: 0,
      });
    } catch {
      throw runtimeError("CANOPYPROOF_AWS_KMS_CONFIGURATION_INVALID");
    }
  }

  async verifyManagedKeyAttestation(
    requestInput: CanopyProofManagedKeyAttestationVerificationRequest,
  ): Promise<CanopyProofExternalVerificationReceipt> {
    const request = parseRequest(
      managedKeyRequestSchema,
      requestInput,
      "CANOPYPROOF_AWS_KMS_KEY_ATTESTATION_REQUEST_INVALID",
    );
    this.#assertFixedBindings(request);
    const startedAt = canonicalClockInstant(this.#clock);
    assertWithinClockSkew(request.requestedAt, startedAt, this.#maximumClockSkewMilliseconds);

    const publicKeyObservation = await this.#getAndValidatePublicKey(
      request.publicKeyHash,
      startedAt,
    );
    if (publicKeyObservation.providerAttestationHash !== request.providerAttestationHash) {
      throw runtimeError("CANOPYPROOF_AWS_KMS_PROVIDER_ATTESTATION_MISMATCH");
    }
    const completedAt = canonicalClockInstant(this.#clock);
    assertMonotonicClock(startedAt, completedAt);
    const providerReceiptIdHash = hashJson({
      kind: "canopyproof-aws-kms-key-attestation-provider-receipt-id-v1",
      requestId: publicKeyObservation.requestId,
    });
    const providerReceiptHash = hashJson({
      kind: "canopyproof-aws-kms-key-attestation-provider-receipt-v1",
      request,
      publicKeyAttestation: publicKeyObservation.attestation,
      providerReceiptIdHash,
      providerObservedAt: completedAt.toISOString(),
    });
    return {
      verified: true,
      externalVerifierId: EXTERNAL_VERIFIER_ID,
      providerReceiptIdHash,
      providerReceiptHash,
      verifiedAt: request.requestedAt,
    };
  }

  async verifyDetachedSignature(
    requestInput: CanopyProofDetachedSignatureVerificationRequest,
  ): Promise<CanopyProofExternalVerificationReceipt> {
    const request = parseRequest(
      detachedSignatureRequestSchema,
      requestInput,
      "CANOPYPROOF_AWS_KMS_SIGNATURE_REQUEST_INVALID",
    );
    this.#assertFixedBindings(request);
    const startedAt = canonicalClockInstant(this.#clock);
    assertNotBeyondClockSkew(request.signedAt, startedAt, this.#maximumClockSkewMilliseconds);
    const message = hexToBytes(request.signaturePayloadHash);
    const signature = decodeCanonicalBase64Url(request.detachedSignature);
    if (signature.byteLength < 1 || signature.byteLength > 6_144) {
      throw runtimeError("CANOPYPROOF_AWS_KMS_SIGNATURE_ENCODING_INVALID");
    }

    const publicKeyObservation = await this.#getAndValidatePublicKey(
      request.publicKeyHash,
      startedAt,
    );
    const verification = await this.#invoke(
      "VERIFY",
      {
        KeyId: this.#keyArn,
        Message: bytesToBase64(message),
        MessageType: this.#algorithmContract.messageType,
        Signature: bytesToBase64(signature),
        SigningAlgorithm: this.#algorithmContract.signingAlgorithm,
      },
      startedAt,
    );
    const verifyResponse = parseProviderResponse(
      verifyResponseSchema,
      verification.body,
      "CANOPYPROOF_AWS_KMS_VERIFY_RESPONSE_INVALID",
    );
    if (
      verifyResponse.KeyId !== this.#keyArn ||
      verifyResponse.SigningAlgorithm !== this.#algorithmContract.signingAlgorithm
    ) {
      throw runtimeError("CANOPYPROOF_AWS_KMS_VERIFY_BINDING_MISMATCH");
    }

    const completedAt = canonicalClockInstant(this.#clock);
    assertMonotonicClock(startedAt, completedAt);
    const providerReceiptIdHash = hashJson({
      kind: "canopyproof-aws-kms-signature-provider-receipt-id-v1",
      getPublicKeyRequestId: publicKeyObservation.requestId,
      verifyRequestId: verification.requestId,
    });
    const providerReceiptHash = hashJson({
      kind: "canopyproof-aws-kms-signature-provider-receipt-v1",
      request,
      publicKeyAttestation: publicKeyObservation.attestation,
      verification: {
        keyId: verifyResponse.KeyId,
        signatureValid: verifyResponse.SignatureValid,
        signingAlgorithm: verifyResponse.SigningAlgorithm,
      },
      providerReceiptIdHash,
      verifiedAt: completedAt.toISOString(),
    });
    return {
      verified: true,
      externalVerifierId: EXTERNAL_VERIFIER_ID,
      providerReceiptIdHash,
      providerReceiptHash,
      verifiedAt: completedAt.toISOString(),
    };
  }

  #assertFixedBindings(request: {
    readonly organizationId: string;
    readonly provider: "aws_kms";
    readonly providerKeyId: string;
    readonly keyVersion: string;
    readonly algorithm: CanopyProofEnvironmentalProofSigningAlgorithm;
    readonly purpose: typeof PURPOSE;
  }): void {
    if (
      request.organizationId !== this.#organizationId ||
      request.providerKeyId !== this.#keyArn ||
      request.keyVersion !== this.#keyVersion ||
      request.algorithm !== this.#algorithm
    ) {
      throw runtimeError("CANOPYPROOF_AWS_KMS_FIXED_BINDING_MISMATCH");
    }
  }

  async #getAndValidatePublicKey(expectedPublicKeyHash: string, signingTime: Date) {
    const response = await this.#invoke(
      "GET_PUBLIC_KEY",
      { KeyId: this.#keyArn },
      signingTime,
    );
    const parsed = parseProviderResponse(
      publicKeyResponseSchema,
      response.body,
      "CANOPYPROOF_AWS_KMS_GET_PUBLIC_KEY_RESPONSE_INVALID",
    );
    if (
      parsed.KeyId !== this.#keyArn ||
      (parsed.CustomerMasterKeySpec !== undefined && parsed.CustomerMasterKeySpec !== parsed.KeySpec) ||
      !this.#algorithmContract.keySpecs.includes(parsed.KeySpec) ||
      !parsed.SigningAlgorithms.includes(this.#algorithmContract.signingAlgorithm)
    ) {
      throw runtimeError("CANOPYPROOF_AWS_KMS_PUBLIC_KEY_BINDING_MISMATCH");
    }
    const publicKey = decodeCanonicalBase64(parsed.PublicKey);
    if (publicKey.byteLength < 1 || publicKey.byteLength > 8_192) {
      throw runtimeError("CANOPYPROOF_AWS_KMS_PUBLIC_KEY_ENCODING_INVALID");
    }
    const publicKeyHash = await sha256Hex(publicKey);
    if (publicKeyHash !== expectedPublicKeyHash) {
      throw runtimeError("CANOPYPROOF_AWS_KMS_PUBLIC_KEY_HASH_MISMATCH");
    }
    const attestation: AwsKmsPublicKeyAttestation = {
      organizationId: this.#organizationId,
      partition: this.#partition,
      region: this.#region,
      providerKeyId: parsed.KeyId,
      keyVersion: this.#keyVersion,
      protocolAlgorithm: this.#algorithm,
      keySpec: parsed.KeySpec,
      keyUsage: parsed.KeyUsage,
      signingAlgorithms: [...parsed.SigningAlgorithms].sort(),
      publicKeyHash,
    };
    return {
      attestation,
      providerAttestationHash: computeAwsKmsProviderAttestationHash(attestation),
      requestId: response.requestId,
    };
  }

  async #invoke(operation: AwsKmsOperation, body: Readonly<Record<string, unknown>>, signingTime: Date) {
    const target = operation === "GET_PUBLIC_KEY" ? "TrentService.GetPublicKey" : "TrentService.Verify";
    let signedRequest: Request;
    try {
      signedRequest = await this.#signer.sign(this.#endpoint, {
        method: "POST",
        body: JSON.stringify(body),
        headers: {
          accept: "application/x-amz-json-1.1",
          "content-type": "application/x-amz-json-1.1",
          "x-amz-target": target,
        },
        aws: {
          allHeaders: true,
          datetime: toAmzDate(signingTime),
        },
      });
    } catch {
      throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_SIGNING_FAILED`);
    }

    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMilliseconds);
    try {
      const response = await this.#fetcher(signedRequest, {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (response.status !== 200) {
        throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_REJECTED`);
      }
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (contentType !== "application/x-amz-json-1.1" && contentType !== "application/json") {
        throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_CONTENT_TYPE_INVALID`);
      }
      const contentEncoding = response.headers.get("content-encoding")?.trim().toLowerCase();
      if (contentEncoding && contentEncoding !== "identity") {
        throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_CONTENT_ENCODING_FORBIDDEN`);
      }
      const declaredLength = response.headers.get("content-length");
      let declaredLengthBytes: number | undefined;
      if (declaredLength !== null) {
        const length = Number(declaredLength);
        if (!Number.isInteger(length) || length < 1 || length > this.#maximumResponseBytes) {
          throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_RESPONSE_TOO_LARGE`);
        }
        declaredLengthBytes = length;
      }
      const responseBytes = await readBoundedResponse(
        response,
        this.#maximumResponseBytes,
        operation,
      );
      if (declaredLengthBytes !== undefined && declaredLengthBytes !== responseBytes.byteLength) {
        throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_CONTENT_LENGTH_MISMATCH`);
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(responseBytes));
      } catch {
        throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_RESPONSE_JSON_INVALID`);
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_RESPONSE_JSON_INVALID`);
      }
      const requestId = awsRequestIdSchema.safeParse(response.headers.get("x-amzn-requestid"));
      if (!requestId.success) {
        throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_REQUEST_ID_INVALID`);
      }
      return { body: parsed, requestId: requestId.data };
    } catch (error) {
      if (timedOut) throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_TIMEOUT`);
      if (isAwsKmsRuntimeError(error)) throw error;
      throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_REQUEST_FAILED`);
    } finally {
      clearTimeout(timeout);
    }
  }
}

function validateRegionForPartition(value: string, partition: AwsPartition): string {
  const region = regionSchema.parse(value);
  if (
    (partition === "aws" && (region.startsWith("cn-") || region.startsWith("us-gov-"))) ||
    (partition === "aws-us-gov" && !region.startsWith("us-gov-"))
  ) {
    throw new Error("partition and region mismatch");
  }
  return region;
}

function validateFixedKeyArn(
  value: string,
  partition: AwsPartition,
  region: string,
  accountId: string,
): string {
  const keyArn = keyArnSchema.parse(value);
  const prefix = `arn:${partition}:kms:${region}:${accountId}:key/`;
  if (!keyArn.startsWith(prefix)) throw new Error("key ARN scope mismatch");
  const keyId = keyArn.slice(prefix.length);
  if (
    !/^(?:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}|mrk-[a-f0-9]{32})$/.test(keyId)
  ) {
    throw new Error("unsupported key ARN");
  }
  return keyArn;
}

function algorithmContract(algorithm: CanopyProofEnvironmentalProofSigningAlgorithm) {
  switch (algorithm) {
    case "ES256":
      return {
        keySpecs: ["ECC_NIST_P256"] as const,
        signingAlgorithm: "ECDSA_SHA_256" as const,
        messageType: "DIGEST" as const,
      };
    case "Ed25519":
      return {
        keySpecs: ["ECC_NIST_EDWARDS25519"] as const,
        signingAlgorithm: "ED25519_SHA_512" as const,
        messageType: "RAW" as const,
      };
    case "RSA_PSS_SHA256":
      return {
        keySpecs: ["RSA_2048", "RSA_3072", "RSA_4096"] as const,
        signingAlgorithm: "RSASSA_PSS_SHA_256" as const,
        messageType: "DIGEST" as const,
      };
  }
}

function parseRequest<TSchema extends z.ZodTypeAny>(schema: TSchema, input: unknown, code: string): z.output<TSchema> {
  try {
    return schema.parse(input);
  } catch {
    throw runtimeError(code);
  }
}

function parseProviderResponse<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  code: string,
): z.output<TSchema> {
  try {
    return schema.parse(input);
  } catch {
    throw runtimeError(code);
  }
}

function canonicalClockInstant(clock: () => Date): Date {
  let instant: Date;
  try {
    instant = clock();
  } catch {
    throw runtimeError("CANOPYPROOF_AWS_KMS_CLOCK_INVALID");
  }
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) {
    throw runtimeError("CANOPYPROOF_AWS_KMS_CLOCK_INVALID");
  }
  return new Date(Math.floor(instant.getTime() / 1_000) * 1_000);
}

function assertWithinClockSkew(value: string, now: Date, maximumClockSkewMilliseconds: number): void {
  if (Math.abs(Date.parse(value) - now.getTime()) > maximumClockSkewMilliseconds) {
    throw runtimeError("CANOPYPROOF_AWS_KMS_ATTESTATION_TIME_OUT_OF_BOUNDS");
  }
}

function assertNotBeyondClockSkew(value: string, now: Date, maximumClockSkewMilliseconds: number): void {
  if (Date.parse(value) - now.getTime() > maximumClockSkewMilliseconds) {
    throw runtimeError("CANOPYPROOF_AWS_KMS_SIGNATURE_TIME_OUT_OF_BOUNDS");
  }
}

function assertMonotonicClock(startedAt: Date, completedAt: Date): void {
  if (completedAt.getTime() < startedAt.getTime()) {
    throw runtimeError("CANOPYPROOF_AWS_KMS_CLOCK_INVALID");
  }
}

function toAmzDate(value: Date): string {
  return value.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function hexToBytes(value: string): Uint8Array {
  return Uint8Array.from({ length: value.length / 2 }, (_, index) =>
    Number.parseInt(value.slice(index * 2, index * 2 + 2), 16),
  );
}

function decodeCanonicalBase64(value: string): Uint8Array {
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    throw runtimeError("CANOPYPROOF_AWS_KMS_PUBLIC_KEY_ENCODING_INVALID");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytesToBase64(bytes) !== value) {
    throw runtimeError("CANOPYPROOF_AWS_KMS_PUBLIC_KEY_ENCODING_INVALID");
  }
  return bytes;
}

function decodeCanonicalBase64Url(value: string): Uint8Array {
  const standard = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  let binary: string;
  try {
    binary = atob(standard);
  } catch {
    throw runtimeError("CANOPYPROOF_AWS_KMS_SIGNATURE_ENCODING_INVALID");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytesToBase64Url(bytes) !== value) {
    throw runtimeError("CANOPYPROOF_AWS_KMS_SIGNATURE_ENCODING_INVALID");
  }
  return bytes;
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  for (const byte of value) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function bytesToBase64Url(value: Uint8Array): string {
  return bytesToBase64(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function sha256Hex(value: Uint8Array): Promise<string> {
  let digest: ArrayBuffer;
  try {
    digest = await globalThis.crypto.subtle.digest("SHA-256", Uint8Array.from(value).buffer);
  } catch {
    throw runtimeError("CANOPYPROOF_AWS_KMS_PUBLIC_KEY_HASH_FAILED");
  }
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readBoundedResponse(
  response: Response,
  maximumBytes: number,
  operation: AwsKmsOperation,
): Promise<Uint8Array> {
  if (!response.body) throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_RESPONSE_EMPTY`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > maximumBytes) {
        await reader.cancel();
        throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_RESPONSE_TOO_LARGE`);
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (totalBytes === 0) throw runtimeError(`CANOPYPROOF_AWS_KMS_${operation}_RESPONSE_EMPTY`);
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function runtimeError(code: string): Error {
  const error = new Error(code);
  error.name = "CanopyProofProviderRuntimeError";
  Object.defineProperty(error, providerRuntimeErrorBrand, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
  return error;
}

function isAwsKmsRuntimeError(value: unknown): value is Error {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Readonly<Record<PropertyKey, unknown>>)[providerRuntimeErrorBrand] === true,
  );
}
