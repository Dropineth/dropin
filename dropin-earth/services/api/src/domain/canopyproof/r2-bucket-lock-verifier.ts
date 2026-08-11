import { hashJson } from "@dropin/crypto";
import { z } from "zod";

const verifiedRetentionPolicyBrand: unique symbol = Symbol("CanopyProofR2VerifiedRetentionPolicy");
const providerRuntimeErrorBrand: unique symbol = Symbol("CanopyProofR2BucketLockRuntimeError");

export type CanopyProofR2RetentionPolicyVerification = {
  readonly providerNamespace: string;
  readonly objectKey: string;
  readonly objectVersion: string;
  readonly uploadedAt: string;
  readonly verifiedAt: string;
  readonly objectLockMode: "governance";
  readonly retainUntil: string;
  readonly retentionPolicyRoot: string;
  readonly retentionVerificationState: "verified";
  readonly [verifiedRetentionPolicyBrand]: true;
};

export interface CanopyProofR2RetentionPolicyVerifier {
  verifyRetentionPolicy(input: Readonly<{
    providerNamespace: string;
    objectKey: string;
    objectVersion: string;
    uploadedAt: string;
    verifiedAt: string;
    correlationId: string;
  }>): Promise<CanopyProofR2RetentionPolicyVerification>;
}

export type CloudflareR2BucketLockVerifierConfiguration = {
  readonly accountId: string;
  readonly bucketName: string;
  readonly jurisdiction?: "default" | "eu" | "fedramp";
  readonly apiToken: string;
  readonly timeoutMilliseconds?: number;
  readonly maximumResponseBytes?: number;
  readonly fetcher?: typeof fetch;
};

const accountIdSchema = z.string().regex(/^[a-f0-9]{32}$/);
const bucketNameSchema = z
  .string()
  .min(3)
  .max(63)
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/);
const apiTokenSchema = z.string().min(20).max(2_048).regex(/^[A-Za-z0-9._-]+$/);
const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/);
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
const requestSchema = z
  .object({
    providerNamespace: bucketNameSchema,
    objectKey: objectKeySchema,
    objectVersion: identifierSchema,
    uploadedAt: z.string().datetime(),
    verifiedAt: z.string().datetime(),
    correlationId: identifierSchema,
  })
  .strict();
const prefixSchema = z.string().max(1_024).regex(/^[A-Za-z0-9._:/-]*$/);
const lockConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Age"), maxAgeSeconds: z.number().int().positive().max(3_155_760_000) }).strict(),
  z.object({ type: z.literal("Date"), date: z.string().datetime() }).strict(),
  z.object({ type: z.literal("Indefinite") }).strict(),
]);
const lockRuleSchema = z
  .object({
    id: z.string().trim().min(1).max(1_024),
    enabled: z.boolean(),
    prefix: prefixSchema.optional(),
    condition: lockConditionSchema,
  })
  .strict();
const lockResponseSchema = z
  .object({
    success: z.literal(true),
    errors: z.array(z.unknown()).max(32).optional(),
    messages: z.array(z.unknown()).max(32).optional(),
    result: z.object({ rules: z.array(lockRuleSchema).max(1_000).optional() }).strict(),
  })
  .strict();

export class CloudflareR2BucketLockVerifier implements CanopyProofR2RetentionPolicyVerifier {
  readonly #accountId: string;
  readonly #bucketName: string;
  readonly #jurisdiction: "default" | "eu" | "fedramp";
  readonly #apiToken: string;
  readonly #timeoutMilliseconds: number;
  readonly #maximumResponseBytes: number;
  readonly #fetcher: typeof fetch;

  constructor(configuration: CloudflareR2BucketLockVerifierConfiguration) {
    try {
      this.#accountId = accountIdSchema.parse(configuration.accountId);
      this.#bucketName = bucketNameSchema.parse(configuration.bucketName);
      this.#jurisdiction = z.enum(["default", "eu", "fedramp"]).parse(configuration.jurisdiction ?? "default");
      this.#apiToken = apiTokenSchema.parse(configuration.apiToken);
      this.#timeoutMilliseconds = configuration.timeoutMilliseconds ?? 5_000;
      this.#maximumResponseBytes = configuration.maximumResponseBytes ?? 128 * 1_024;
      if (
        !Number.isInteger(this.#timeoutMilliseconds) ||
        this.#timeoutMilliseconds < 100 ||
        this.#timeoutMilliseconds > 30_000 ||
        !Number.isInteger(this.#maximumResponseBytes) ||
        this.#maximumResponseBytes < 1_024 ||
        this.#maximumResponseBytes > 512 * 1_024
      ) {
        throw new Error("invalid bounds");
      }
      this.#fetcher = configuration.fetcher ?? fetch;
    } catch {
      throw runtimeError("CANOPYPROOF_R2_LOCK_CONFIGURATION_INVALID");
    }
  }

  async verifyRetentionPolicy(inputValue: Parameters<CanopyProofR2RetentionPolicyVerifier["verifyRetentionPolicy"]>[0]) {
    let input: z.output<typeof requestSchema>;
    try {
      input = requestSchema.parse(inputValue);
    } catch {
      throw runtimeError("CANOPYPROOF_R2_LOCK_REQUEST_INVALID");
    }
    if (input.providerNamespace !== this.#bucketName) {
      throw runtimeError("CANOPYPROOF_R2_LOCK_NAMESPACE_MISMATCH");
    }
    const uploadedAt = canonicalInstant(input.uploadedAt, "CANOPYPROOF_R2_LOCK_UPLOAD_TIME_INVALID");
    const verifiedAt = canonicalInstant(input.verifiedAt, "CANOPYPROOF_R2_LOCK_VERIFICATION_TIME_INVALID");
    if (Date.parse(uploadedAt) > Date.parse(verifiedAt)) {
      throw runtimeError("CANOPYPROOF_R2_LOCK_VERIFICATION_TIME_INVALID");
    }

    const endpoint = new URL(
      `https://api.cloudflare.com/client/v4/accounts/${this.#accountId}/r2/buckets/${this.#bucketName}/lock`,
    );
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMilliseconds);

    try {
      const response = await this.#fetcher(endpoint, {
        method: "GET",
        cache: "no-store",
        credentials: "omit",
        headers: {
          accept: "application/json",
          authorization: `Bearer ${this.#apiToken}`,
          "cf-r2-jurisdiction": this.#jurisdiction,
          "x-canopyproof-correlation-id": input.correlationId,
        },
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (response.status !== 200) throw runtimeError("CANOPYPROOF_R2_LOCK_RESPONSE_REJECTED");
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (contentType !== "application/json") {
        throw runtimeError("CANOPYPROOF_R2_LOCK_CONTENT_TYPE_INVALID");
      }
      const contentEncoding = response.headers.get("content-encoding")?.trim().toLowerCase();
      if (contentEncoding && contentEncoding !== "identity") {
        throw runtimeError("CANOPYPROOF_R2_LOCK_CONTENT_ENCODING_FORBIDDEN");
      }
      const declaredLength = parseDeclaredLength(response, this.#maximumResponseBytes);
      const bytes = await readBoundedResponse(response, this.#maximumResponseBytes);
      if (declaredLength !== undefined && declaredLength !== bytes.byteLength) {
        throw runtimeError("CANOPYPROOF_R2_LOCK_CONTENT_LENGTH_MISMATCH");
      }
      let envelope: z.output<typeof lockResponseSchema>;
      try {
        const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
        envelope = lockResponseSchema.parse(parsed);
      } catch {
        throw runtimeError("CANOPYPROOF_R2_LOCK_RESPONSE_JSON_INVALID");
      }
      const rules = normalizeApplicableRules(envelope.result.rules ?? [], input.objectKey, uploadedAt);
      const ruleIds = new Set(rules.map((rule) => rule.id));
      if (ruleIds.size !== rules.length) {
        throw runtimeError("CANOPYPROOF_R2_LOCK_RULE_SET_INVALID");
      }
      if (rules.some((rule) => rule.condition.type === "Indefinite")) {
        throw runtimeError("CANOPYPROOF_R2_LOCK_INDEFINITE_UNSUPPORTED");
      }
      const retainUntil = strictestRetainUntil(rules, uploadedAt, verifiedAt);
      const retentionPolicyRoot = hashJson({
        kind: "canopyproof-r2-bucket-lock-policy-v1",
        accountIdHash: hashJson({ kind: "canopyproof-r2-account-id-v1", accountId: this.#accountId }),
        providerNamespace: this.#bucketName,
        jurisdiction: this.#jurisdiction,
        objectKey: input.objectKey,
        objectVersion: input.objectVersion,
        uploadedAt,
        verifiedAt,
        applicableRules: rules,
        objectLockMode: "governance",
        retainUntil,
      });
      const result = {
        providerNamespace: this.#bucketName,
        objectKey: input.objectKey,
        objectVersion: input.objectVersion,
        uploadedAt,
        verifiedAt,
        objectLockMode: "governance" as const,
        retainUntil,
        retentionPolicyRoot,
        retentionVerificationState: "verified" as const,
      };
      Object.defineProperty(result, verifiedRetentionPolicyBrand, {
        configurable: false,
        enumerable: false,
        value: true,
        writable: false,
      });
      return Object.freeze(result) as CanopyProofR2RetentionPolicyVerification;
    } catch (error) {
      if (timedOut) throw runtimeError("CANOPYPROOF_R2_LOCK_TIMEOUT");
      if (isCanopyProofR2BucketLockRuntimeError(error)) throw error;
      throw runtimeError("CANOPYPROOF_R2_LOCK_REQUEST_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function isCanopyProofR2RetentionPolicyVerification(
  value: unknown,
): value is CanopyProofR2RetentionPolicyVerification {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Readonly<Record<PropertyKey, unknown>>)[verifiedRetentionPolicyBrand] === true,
  );
}

export function isCanopyProofR2BucketLockRuntimeError(value: unknown): value is Error {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as Readonly<Record<PropertyKey, unknown>>)[providerRuntimeErrorBrand] === true,
  );
}

function normalizeApplicableRules(
  rules: readonly z.output<typeof lockRuleSchema>[],
  objectKey: string,
  uploadedAt: string,
) {
  return rules
    .filter((rule) => rule.enabled && objectKey.startsWith(rule.prefix ?? ""))
    .map((rule) => ({
      id: rule.id,
      prefix: rule.prefix ?? "",
      condition:
        rule.condition.type === "Date"
          ? { type: "Date" as const, date: canonicalInstant(rule.condition.date, "CANOPYPROOF_R2_LOCK_RULE_SET_INVALID") }
          : rule.condition.type === "Age"
            ? { type: "Age" as const, maxAgeSeconds: rule.condition.maxAgeSeconds }
            : { type: "Indefinite" as const },
      effectiveFrom: uploadedAt,
    }))
    .sort((left, right) =>
      left.id.localeCompare(right.id) ||
      left.prefix.localeCompare(right.prefix) ||
      JSON.stringify(left.condition).localeCompare(JSON.stringify(right.condition)),
    );
}

function strictestRetainUntil(
  rules: readonly ReturnType<typeof normalizeApplicableRules>[number][],
  uploadedAt: string,
  verifiedAt: string,
) {
  const uploadedAtMs = Date.parse(uploadedAt);
  const verifiedAtMs = Date.parse(verifiedAt);
  const candidates = rules.flatMap((rule) => {
    if (rule.condition.type === "Indefinite") return [];
    const retainedUntilMs = rule.condition.type === "Age"
      ? uploadedAtMs + rule.condition.maxAgeSeconds * 1_000
      : Date.parse(rule.condition.date);
    if (!Number.isSafeInteger(retainedUntilMs) || retainedUntilMs <= verifiedAtMs) return [];
    return [new Date(retainedUntilMs).toISOString()];
  });
  if (candidates.length === 0) throw runtimeError("CANOPYPROOF_R2_LOCK_RETENTION_NOT_ENFORCED");
  return candidates.sort().at(-1)!;
}

function canonicalInstant(value: string, code: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw runtimeError(code);
  return new Date(parsed).toISOString();
}

function parseDeclaredLength(response: Response, maximumBytes: number) {
  const value = response.headers.get("content-length");
  if (value === null) return undefined;
  const length = Number(value);
  if (!Number.isInteger(length) || length < 1 || length > maximumBytes) {
    throw runtimeError("CANOPYPROOF_R2_LOCK_RESPONSE_TOO_LARGE");
  }
  return length;
}

async function readBoundedResponse(response: Response, maximumBytes: number) {
  if (!response.body) throw runtimeError("CANOPYPROOF_R2_LOCK_RESPONSE_EMPTY");
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
        throw runtimeError("CANOPYPROOF_R2_LOCK_RESPONSE_TOO_LARGE");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (totalBytes === 0) throw runtimeError("CANOPYPROOF_R2_LOCK_RESPONSE_EMPTY");
  const result = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
}

function runtimeError(code: string) {
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
