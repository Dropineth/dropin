import { z } from "zod";
import type {
  CanopyProofMetadataExtractorPort,
  CanopyProofMetadataExtractorRequest,
} from "./metadata-extractor-adapter.js";

const runtimeErrorBrand: unique symbol = Symbol("CanopyProofMetadataExtractorRuntimeError");

export type FixedEndpointMetadataExtractorConfiguration = Readonly<{
  endpoint: string;
  authorizationHeader?: string;
  timeoutMilliseconds?: number;
  maximumResponseBytes?: number;
  fetcher?: typeof fetch;
}>;

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const canonicalTimestampSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => new Date(value).toISOString() === value);
const objectKeySchema = z
  .string()
  .min(1)
  .max(1_024)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/)
  .refine(
    (value) =>
      !value.includes("//") &&
      !value.split("/").some((segment) => segment === "." || segment === ".."),
  );
const requestSchema = z
  .object({
    objectId: identifierSchema,
    objectRoot: hashSchema,
    storageProvider: z.enum(["cloudflare_r2", "s3", "gcs"]),
    providerNamespace: identifierSchema,
    objectKey: objectKeySchema,
    objectVersion: identifierSchema,
    storedObjectProviderReceiptHash: hashSchema,
    contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
    mediaProjectionRoot: hashSchema,
    consentReceiptId: identifierSchema,
    consentReceiptRoot: hashSchema,
    consentProjectionRoot: hashSchema,
    deviceAttestationId: identifierSchema,
    deviceAttestationRoot: hashSchema,
    deviceProjectionRoot: hashSchema,
    registeredGpsHash: hashSchema,
    privacyMode: z.enum(["precise", "masked", "restricted"]),
    requestedAt: canonicalTimestampSchema,
    correlationId: identifierSchema,
  })
  .strict();

/**
 * A route-agnostic, fixed-destination transport. It returns untrusted JSON;
 * receipt authority belongs exclusively to the policy adapter.
 */
export class FixedEndpointCanopyProofMetadataExtractorPort
  implements CanopyProofMetadataExtractorPort
{
  readonly #endpoint: URL;
  readonly #authorizationHeader?: string;
  readonly #timeoutMilliseconds: number;
  readonly #maximumResponseBytes: number;
  readonly #fetcher: typeof fetch;

  constructor(configuration: FixedEndpointMetadataExtractorConfiguration) {
    try {
      this.#endpoint = validateFixedEndpoint(configuration.endpoint);
      if (configuration.authorizationHeader !== undefined) {
        const authorization = configuration.authorizationHeader.trim();
        if (
          authorization.length < 16 ||
          authorization.length > 4_096 ||
          /[\r\n\0]/.test(authorization)
        ) {
          throw new Error("invalid authorization");
        }
        this.#authorizationHeader = authorization;
      }
      this.#timeoutMilliseconds = configuration.timeoutMilliseconds ?? 5_000;
      this.#maximumResponseBytes = configuration.maximumResponseBytes ?? 32 * 1_024;
      if (
        !Number.isInteger(this.#timeoutMilliseconds) ||
        this.#timeoutMilliseconds < 100 ||
        this.#timeoutMilliseconds > 30_000 ||
        !Number.isInteger(this.#maximumResponseBytes) ||
        this.#maximumResponseBytes < 1_024 ||
        this.#maximumResponseBytes > 128 * 1_024
      ) {
        throw new Error("invalid bounds");
      }
      this.#fetcher = configuration.fetcher ?? fetch;
    } catch {
      throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_CONFIGURATION_INVALID");
    }
  }

  async extractMetadata(requestInput: CanopyProofMetadataExtractorRequest): Promise<unknown> {
    let request: z.output<typeof requestSchema>;
    try {
      request = requestSchema.parse(requestInput);
    } catch {
      throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_REQUEST_INVALID");
    }
    const body = JSON.stringify({
      protocolVersion: "canopyproof-metadata-extraction-v1",
      ...request,
    });
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.#timeoutMilliseconds);
    try {
      const headers = new Headers({
        accept: "application/json",
        "content-type": "application/json",
        "x-canopyproof-correlation-id": request.correlationId,
      });
      if (this.#authorizationHeader) {
        headers.set("authorization", this.#authorizationHeader);
      }
      const response = await this.#fetcher(this.#endpoint, {
        method: "POST",
        body,
        cache: "no-store",
        credentials: "omit",
        headers,
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: controller.signal,
      });
      if (response.status !== 200) {
        throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_RESPONSE_REJECTED");
      }
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (contentType !== "application/json") {
        throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_CONTENT_TYPE_INVALID");
      }
      const contentEncoding = response.headers.get("content-encoding")?.trim().toLowerCase();
      if (contentEncoding && contentEncoding !== "identity") {
        throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_CONTENT_ENCODING_FORBIDDEN");
      }
      const declaredLength = response.headers.get("content-length");
      let declaredLengthBytes: number | undefined;
      if (declaredLength !== null) {
        const length = Number(declaredLength);
        if (!Number.isInteger(length) || length < 1 || length > this.#maximumResponseBytes) {
          throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_RESPONSE_TOO_LARGE");
        }
        declaredLengthBytes = length;
      }
      const responseBytes = await readBoundedResponse(response, this.#maximumResponseBytes);
      if (declaredLengthBytes !== undefined && declaredLengthBytes !== responseBytes.byteLength) {
        throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_CONTENT_LENGTH_MISMATCH");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(responseBytes));
      } catch {
        throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_RESPONSE_JSON_INVALID");
      }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_RESPONSE_JSON_INVALID");
      }
      return parsed;
    } catch (error) {
      if (timedOut) throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_TIMEOUT");
      if (isRuntimeError(error)) throw error;
      throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_REQUEST_FAILED");
    } finally {
      clearTimeout(timeout);
    }
  }
}

function validateFixedEndpoint(value: string) {
  const endpoint = new URL(value);
  const hostname = endpoint.hostname.toLowerCase();
  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(endpoint.pathname);
  } catch {
    throw new Error("invalid path encoding");
  }
  if (
    endpoint.protocol !== "https:" ||
    (endpoint.port !== "" && endpoint.port !== "443") ||
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    hostname.includes(":") ||
    /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
    !/^[a-z0-9.-]+$/.test(hostname) ||
    !hostname.includes(".") ||
    hostname.includes("..") ||
    decodedPath === "/" ||
    decodedPath.includes("//") ||
    decodedPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new Error("unsafe endpoint");
  }
  return new URL(endpoint.toString());
}

async function readBoundedResponse(response: Response, maximumBytes: number) {
  if (!response.body) {
    throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_RESPONSE_EMPTY");
  }
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
        throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_RESPONSE_TOO_LARGE");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (totalBytes === 0) {
    throw runtimeError("CANOPYPROOF_METADATA_EXTRACTOR_RESPONSE_EMPTY");
  }
  const joined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

function runtimeError(code: string) {
  const error = new Error(code);
  Object.defineProperty(error, runtimeErrorBrand, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
  return error;
}

function isRuntimeError(value: unknown) {
  if (!(value instanceof Error)) return false;
  const descriptor = Object.getOwnPropertyDescriptor(value, runtimeErrorBrand);
  return descriptor?.value === true && descriptor.enumerable === false;
}
