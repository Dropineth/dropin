export interface CanopyproofEdgeObservabilityEnv {
  CANOPYPROOF_EDGE_OTEL_EXPORT_ENABLED?: string;
  CANOPYPROOF_EDGE_OTEL_SAMPLE_RATIO?: string;
  CANOPYPROOF_EDGE_OTEL_TIMEOUT_MS?: string;
  CANOPYPROOF_EDGE_OTEL_MAX_PAYLOAD_BYTES?: string;
  OTEL_EXPORTER_OTLP_TRACES_PROTOCOL?: string;
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_ENDPOINT?: string;
  OTEL_EXPORTER_OTLP_TRACES_HEADERS?: string;
  OTEL_EXPORTER_OTLP_HEADERS?: string;
  OTEL_EXPORTER_OTLP_TRACES_COMPRESSION?: string;
  OTEL_EXPORTER_OTLP_COMPRESSION?: string;
  OTEL_EXPORTER_OTLP_TRACES_CERTIFICATE?: string;
  OTEL_EXPORTER_OTLP_CERTIFICATE?: string;
  OTEL_EXPORTER_OTLP_TRACES_CLIENT_KEY?: string;
  OTEL_EXPORTER_OTLP_CLIENT_KEY?: string;
  OTEL_EXPORTER_OTLP_TRACES_CLIENT_CERTIFICATE?: string;
  OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE?: string;
}

export interface CanopyproofExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

export interface CanopyproofEdgeTraceContext {
  readonly traceId: string;
  readonly parentSpanId?: string;
  readonly spanId: string;
  readonly sampled: boolean;
  readonly generated: boolean;
}

export interface CanopyproofEdgeTraceFactoryOptions {
  readonly crypto?: Pick<Crypto, "getRandomValues" | "randomUUID" | "subtle">;
  readonly traceIdFactory?: () => string;
  readonly spanIdFactory?: () => string;
}

export interface CanopyproofEdgeOtlpConfiguration {
  readonly endpoint: URL;
  readonly sampleRatio: number;
  readonly timeoutMs: number;
  readonly maxPayloadBytes: number;
}

export type CanopyproofEdgeOtlpConfigurationResult =
  | {
      readonly state: "disabled";
      readonly enabled: false;
      readonly ready: false;
      readonly code: "CANOPYPROOF_EDGE_OTEL_DISABLED";
    }
  | {
      readonly state: "invalid";
      readonly enabled: boolean;
      readonly ready: false;
      readonly code: CanopyproofEdgeOtlpConfigurationErrorCode;
    }
  | {
      readonly state: "ready";
      readonly enabled: true;
      readonly ready: true;
      readonly code: "CANOPYPROOF_EDGE_OTEL_READY";
      readonly config: CanopyproofEdgeOtlpConfiguration;
    };

export type CanopyproofEdgeOtlpConfigurationErrorCode =
  | "CANOPYPROOF_EDGE_OTEL_ENABLED_INVALID"
  | "CANOPYPROOF_EDGE_OTEL_PROTOCOL_INVALID"
  | "CANOPYPROOF_EDGE_OTEL_ENDPOINT_REQUIRED"
  | "CANOPYPROOF_EDGE_OTEL_ENDPOINT_INVALID"
  | "CANOPYPROOF_EDGE_OTEL_ENDPOINT_INSECURE"
  | "CANOPYPROOF_EDGE_OTEL_UNSUPPORTED_BASE_ENDPOINT"
  | "CANOPYPROOF_EDGE_OTEL_UNSUPPORTED_HEADERS"
  | "CANOPYPROOF_EDGE_OTEL_UNSUPPORTED_COMPRESSION"
  | "CANOPYPROOF_EDGE_OTEL_UNSUPPORTED_TLS_FILES"
  | "CANOPYPROOF_EDGE_OTEL_SAMPLE_RATIO_INVALID"
  | "CANOPYPROOF_EDGE_OTEL_TIMEOUT_INVALID"
  | "CANOPYPROOF_EDGE_OTEL_PAYLOAD_LIMIT_INVALID";

export interface CanopyproofEdgeSpanInput {
  readonly requestId: string;
  readonly trace: CanopyproofEdgeTraceContext;
  readonly method: string;
  readonly status: number;
  readonly startedAtEpochMs: number;
  readonly endedAtEpochMs: number;
  readonly upstreamOutcome: "completed" | "unavailable";
}

export interface CanopyproofEdgeOtlpSerializedRequest {
  readonly body: CanopyproofEdgeOtlpJsonTraceRequest;
  readonly json: string;
  readonly byteLength: number;
}

export interface CanopyproofEdgeOtlpExportOptions {
  readonly configuration: CanopyproofEdgeOtlpConfiguration;
  readonly span: CanopyproofEdgeSpanInput;
  readonly fetcher?: (request: Request) => Promise<Response>;
  readonly crypto?: Pick<Crypto, "getRandomValues" | "randomUUID" | "subtle">;
}

export type CanopyproofEdgeOtlpExportOutcome =
  | "exported"
  | "sampled_out"
  | "oversized"
  | "rejected"
  | "failed";

type OtlpAttributeValue =
  | { readonly stringValue: string }
  | { readonly intValue: string }
  | { readonly doubleValue: number }
  | { readonly boolValue: boolean };

type OtlpAttribute = {
  readonly key: string;
  readonly value: OtlpAttributeValue;
};

type CanopyproofEdgeOtlpJsonTraceRequest = {
  readonly resourceSpans: readonly [
    {
      readonly resource: {
        readonly attributes: readonly OtlpAttribute[];
      };
      readonly scopeSpans: readonly [
        {
          readonly scope: {
            readonly name: "canopyproof-cloudflare-edge";
            readonly version: "canopyproof-edge-observability-v1";
          };
          readonly spans: readonly [
            {
              readonly traceId: string;
              readonly spanId: string;
              readonly parentSpanId?: string;
              readonly flags: 1;
              readonly name: string;
              readonly kind: 2;
              readonly startTimeUnixNano: string;
              readonly endTimeUnixNano: string;
              readonly attributes: readonly OtlpAttribute[];
              readonly droppedAttributesCount: 0;
              readonly status: { readonly code: 0 | 1 | 2 };
            },
          ];
        },
      ];
    },
  ];
};

const DEFAULT_TIMEOUT_MS = 2_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_PAYLOAD_BYTES = 32_768;
const MIN_MAX_PAYLOAD_BYTES = 4_096;
const MAX_MAX_PAYLOAD_BYTES = 65_536;
const MAX_ENDPOINT_LENGTH = 2_048;
const MAX_REQUEST_ID_LENGTH = 128;
const MAX_DURATION_MS = 86_400_000;
const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/;
const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/;
const TRACEPARENT_PATTERN = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]+$/;

export function parseCanopyproofEdgeTraceparent(value: string | null | undefined): Readonly<{
  traceId: string;
  parentSpanId: string;
  sampled: boolean;
}> | undefined {
  if (!value) return undefined;
  const match = value.match(TRACEPARENT_PATTERN);
  const traceId = match?.[1];
  const parentSpanId = match?.[2];
  const flags = match?.[3];
  if (!traceId || !parentSpanId || !flags) return undefined;
  if (isAllZero(traceId) || isAllZero(parentSpanId)) return undefined;
  return {
    traceId,
    parentSpanId,
    sampled: (Number.parseInt(flags, 16) & 1) === 1,
  };
}

export function formatCanopyproofEdgeTraceparent(trace: CanopyproofEdgeTraceContext): string {
  assertHexIdentifier(trace.traceId, 16, "CANOPYPROOF_EDGE_TRACE_ID_INVALID");
  assertHexIdentifier(trace.spanId, 8, "CANOPYPROOF_EDGE_SPAN_ID_INVALID");
  return `00-${trace.traceId}-${trace.spanId}-${trace.sampled ? "01" : "00"}`;
}

export function shouldSampleCanopyproofEdgeSpan(spanId: string, sampleRatio: number): boolean {
  assertHexIdentifier(spanId, 8, "CANOPYPROOF_EDGE_SPAN_ID_INVALID");
  if (!Number.isFinite(sampleRatio) || sampleRatio < 0 || sampleRatio > 1) {
    throw new Error("CANOPYPROOF_EDGE_SAMPLE_RATIO_INVALID");
  }
  if (sampleRatio === 0) return false;
  if (sampleRatio === 1) return true;

  const score = Number.parseInt(spanId.slice(0, 13), 16) / 0x10_0000_0000_0000;
  return score < sampleRatio;
}

export function createCanopyproofEdgeTraceContext(
  traceparent: string | null | undefined,
  sampleRatio: number,
  options: CanopyproofEdgeTraceFactoryOptions = {},
): CanopyproofEdgeTraceContext {
  const cryptoProvider = options.crypto ?? globalThis.crypto;
  const parsed = parseCanopyproofEdgeTraceparent(traceparent);
  const traceId = parsed?.traceId ?? (options.traceIdFactory?.() ?? secureRandomHex(16, cryptoProvider));
  const spanId = options.spanIdFactory?.() ?? secureRandomHex(8, cryptoProvider);
  assertHexIdentifier(traceId, 16, "CANOPYPROOF_EDGE_TRACE_ID_INVALID");
  assertHexIdentifier(spanId, 8, "CANOPYPROOF_EDGE_SPAN_ID_INVALID");
  const sampled = shouldSampleCanopyproofEdgeSpan(spanId, sampleRatio);

  return {
    traceId,
    ...(parsed ? { parentSpanId: parsed.parentSpanId } : {}),
    spanId,
    sampled,
    generated: !parsed,
  };
}

export function createCanopyproofEdgeRequestId(
  cryptoProvider: Pick<Crypto, "getRandomValues" | "randomUUID"> = globalThis.crypto,
): string {
  const candidate = cryptoProvider.randomUUID?.() ?? `edge-${secureRandomHex(16, cryptoProvider)}`;
  if (!isValidRequestId(candidate)) {
    throw new Error("CANOPYPROOF_EDGE_REQUEST_ID_INVALID");
  }
  return candidate;
}

export function resolveCanopyproofEdgeOtlpConfiguration(
  env: CanopyproofEdgeObservabilityEnv,
): CanopyproofEdgeOtlpConfigurationResult {
  const enabledValue = env.CANOPYPROOF_EDGE_OTEL_EXPORT_ENABLED;
  if (enabledValue !== undefined && enabledValue !== "true" && enabledValue !== "false") {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_ENABLED_INVALID");
  }
  if (enabledValue !== "true") {
    return {
      state: "disabled",
      enabled: false,
      ready: false,
      code: "CANOPYPROOF_EDGE_OTEL_DISABLED",
    };
  }

  if (env.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL !== "http/json") {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_PROTOCOL_INVALID");
  }
  if (hasValue(env.OTEL_EXPORTER_OTLP_ENDPOINT)) {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_UNSUPPORTED_BASE_ENDPOINT");
  }
  if (hasValue(env.OTEL_EXPORTER_OTLP_TRACES_HEADERS) || hasValue(env.OTEL_EXPORTER_OTLP_HEADERS)) {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_UNSUPPORTED_HEADERS");
  }
  if (hasValue(env.OTEL_EXPORTER_OTLP_TRACES_COMPRESSION) || hasValue(env.OTEL_EXPORTER_OTLP_COMPRESSION)) {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_UNSUPPORTED_COMPRESSION");
  }
  if (
    hasValue(env.OTEL_EXPORTER_OTLP_TRACES_CERTIFICATE) ||
    hasValue(env.OTEL_EXPORTER_OTLP_CERTIFICATE) ||
    hasValue(env.OTEL_EXPORTER_OTLP_TRACES_CLIENT_KEY) ||
    hasValue(env.OTEL_EXPORTER_OTLP_CLIENT_KEY) ||
    hasValue(env.OTEL_EXPORTER_OTLP_TRACES_CLIENT_CERTIFICATE) ||
    hasValue(env.OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE)
  ) {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_UNSUPPORTED_TLS_FILES");
  }

  const endpointValue = env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT;
  if (!hasValue(endpointValue)) {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_ENDPOINT_REQUIRED");
  }
  const endpoint = parseSecureEndpoint(endpointValue);
  if (endpoint instanceof Error) {
    return invalidConfiguration(
      true,
      endpoint.message === "CANOPYPROOF_EDGE_OTEL_ENDPOINT_INSECURE"
        ? "CANOPYPROOF_EDGE_OTEL_ENDPOINT_INSECURE"
        : "CANOPYPROOF_EDGE_OTEL_ENDPOINT_INVALID",
    );
  }

  const sampleRatio = parseBoundedNumber(env.CANOPYPROOF_EDGE_OTEL_SAMPLE_RATIO, 0, 1);
  if (sampleRatio === undefined) {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_SAMPLE_RATIO_INVALID");
  }
  const timeoutMs = parseBoundedInteger(
    env.CANOPYPROOF_EDGE_OTEL_TIMEOUT_MS,
    MIN_TIMEOUT_MS,
    MAX_TIMEOUT_MS,
    DEFAULT_TIMEOUT_MS,
  );
  if (timeoutMs === undefined) {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_TIMEOUT_INVALID");
  }
  const maxPayloadBytes = parseBoundedInteger(
    env.CANOPYPROOF_EDGE_OTEL_MAX_PAYLOAD_BYTES,
    MIN_MAX_PAYLOAD_BYTES,
    MAX_MAX_PAYLOAD_BYTES,
    DEFAULT_MAX_PAYLOAD_BYTES,
  );
  if (maxPayloadBytes === undefined) {
    return invalidConfiguration(true, "CANOPYPROOF_EDGE_OTEL_PAYLOAD_LIMIT_INVALID");
  }

  return {
    state: "ready",
    enabled: true,
    ready: true,
    code: "CANOPYPROOF_EDGE_OTEL_READY",
    config: {
      endpoint,
      sampleRatio,
      timeoutMs,
      maxPayloadBytes,
    },
  };
}

export async function buildCanopyproofEdgeOtlpJsonTraceRequest(
  input: CanopyproofEdgeSpanInput,
  cryptoProvider: Pick<Crypto, "subtle"> = globalThis.crypto,
): Promise<CanopyproofEdgeOtlpSerializedRequest> {
  assertEdgeSpanInput(input);
  const method = input.method.toUpperCase();
  const startedAtEpochMs = Math.max(0, Math.trunc(input.startedAtEpochMs));
  const endedAtEpochMs = Math.min(
    startedAtEpochMs + MAX_DURATION_MS,
    Math.max(startedAtEpochMs, Math.trunc(input.endedAtEpochMs)),
  );
  const durationMs = endedAtEpochMs - startedAtEpochMs;
  const requestIdHash = await sha256Hex(
    `canopyproof-edge-request-id-v1\u0000${input.requestId}`,
    cryptoProvider,
  );
  const resourceAttributes = [
    stringAttribute("service.name", "canopyproof-api-edge"),
    stringAttribute("service.namespace", "dropin-earth"),
    stringAttribute("deployment.environment.name", "production-compatible"),
    stringAttribute("telemetry.sdk.name", "canopyproof-edge-otel"),
    stringAttribute("telemetry.sdk.language", "typescript"),
  ] as const;
  const spanAttributes = [
    stringAttribute("http.request.method", method),
    stringAttribute("url.path", "/api/*"),
    intAttribute("http.response.status_code", input.status),
    doubleAttribute("http.server.request.duration", durationMs),
    stringAttribute("canopyproof.upstream_outcome", input.upstreamOutcome),
    stringAttribute("canopyproof.edge_request_id_hash", requestIdHash),
    boolAttribute("canopyproof.generated_trace_context", input.trace.generated),
  ] as const;
  const body: CanopyproofEdgeOtlpJsonTraceRequest = {
    resourceSpans: [
      {
        resource: { attributes: resourceAttributes },
        scopeSpans: [
          {
            scope: {
              name: "canopyproof-cloudflare-edge",
              version: "canopyproof-edge-observability-v1",
            },
            spans: [
              {
                traceId: hexIdentifierToBase64(input.trace.traceId, 16, "CANOPYPROOF_EDGE_TRACE_ID_INVALID"),
                spanId: hexIdentifierToBase64(input.trace.spanId, 8, "CANOPYPROOF_EDGE_SPAN_ID_INVALID"),
                ...(input.trace.parentSpanId
                  ? {
                      parentSpanId: hexIdentifierToBase64(
                        input.trace.parentSpanId,
                        8,
                        "CANOPYPROOF_EDGE_PARENT_SPAN_ID_INVALID",
                      ),
                    }
                  : {}),
                flags: 1,
                name: `${method} /api/*`,
                kind: 2,
                startTimeUnixNano: millisecondsToUnixNano(startedAtEpochMs),
                endTimeUnixNano: millisecondsToUnixNano(endedAtEpochMs),
                attributes: spanAttributes,
                droppedAttributesCount: 0,
                status: { code: otlpStatusCode(input.status) },
              },
            ],
          },
        ],
      },
    ],
  };
  const json = JSON.stringify(body);
  return {
    body,
    json,
    byteLength: new TextEncoder().encode(json).byteLength,
  };
}

export async function exportCanopyproofEdgeOtlpSpan(
  options: CanopyproofEdgeOtlpExportOptions,
): Promise<CanopyproofEdgeOtlpExportOutcome> {
  if (!options.span.trace.sampled) return "sampled_out";

  try {
    const request = await buildCanopyproofEdgeOtlpJsonTraceRequest(options.span, options.crypto ?? globalThis.crypto);
    if (request.byteLength > options.configuration.maxPayloadBytes) return "oversized";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.configuration.timeoutMs);
    try {
      const fetcher = options.fetcher ?? ((outbound: Request) => fetch(outbound));
      const response = await fetcher(
        new Request(options.configuration.endpoint, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
          },
          body: request.json,
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: controller.signal,
        }),
      );
      try {
        await response.body?.cancel();
      } catch {
        // A body cancellation failure cannot change the transport result.
      }
      return response.status >= 200 && response.status < 300 ? "exported" : "rejected";
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return "failed";
  }
}

export function scheduleCanopyproofEdgeOtlpSpan(
  context: CanopyproofExecutionContext | undefined,
  task: () => Promise<CanopyproofEdgeOtlpExportOutcome>,
): boolean {
  if (!context) return false;
  let containedTask: Promise<void>;
  try {
    containedTask = task().then(() => undefined, () => undefined);
  } catch {
    return false;
  }
  try {
    context.waitUntil(containedTask);
    return true;
  } catch {
    // The task is already rejection-contained even if a nonstandard context
    // refuses to extend the Worker lifetime.
    void containedTask;
    return false;
  }
}

function invalidConfiguration(
  enabled: boolean,
  code: CanopyproofEdgeOtlpConfigurationErrorCode,
): CanopyproofEdgeOtlpConfigurationResult {
  return {
    state: "invalid",
    enabled,
    ready: false,
    code,
  };
}

function parseSecureEndpoint(value: string): URL | Error {
  if (value.length === 0 || value.length > MAX_ENDPOINT_LENGTH || value !== value.trim()) {
    return new Error("CANOPYPROOF_EDGE_OTEL_ENDPOINT_INVALID");
  }
  let endpoint: URL;
  try {
    endpoint = new URL(value);
  } catch {
    return new Error("CANOPYPROOF_EDGE_OTEL_ENDPOINT_INVALID");
  }
  if (endpoint.protocol !== "https:") {
    return new Error("CANOPYPROOF_EDGE_OTEL_ENDPOINT_INSECURE");
  }
  if (endpoint.username || endpoint.password || endpoint.search || endpoint.hash) {
    return new Error("CANOPYPROOF_EDGE_OTEL_ENDPOINT_INVALID");
  }
  return endpoint;
}

function parseBoundedNumber(value: string | undefined, minimum: number, maximum: number): number | undefined {
  if (!value || value !== value.trim() || !/^(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value)) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) return undefined;
  return parsed;
}

function parseBoundedInteger(
  value: string | undefined,
  minimum: number,
  maximum: number,
  fallback: number,
): number | undefined {
  if (value === undefined) return fallback;
  if (!/^[1-9][0-9]*$/.test(value)) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return undefined;
  return parsed;
}

function hasValue(value: string | undefined): value is string {
  return value !== undefined && value.length > 0;
}

function secureRandomHex(
  byteLength: number,
  cryptoProvider: Pick<Crypto, "getRandomValues">,
): string {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const bytes = cryptoProvider.getRandomValues(new Uint8Array(byteLength));
    const value = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
    if (!isAllZero(value)) return value;
  }
  throw new Error("CANOPYPROOF_EDGE_SECURE_RANDOM_UNAVAILABLE");
}

function assertEdgeSpanInput(input: CanopyproofEdgeSpanInput): void {
  if (!isValidRequestId(input.requestId)) throw new Error("CANOPYPROOF_EDGE_REQUEST_ID_INVALID");
  assertHexIdentifier(input.trace.traceId, 16, "CANOPYPROOF_EDGE_TRACE_ID_INVALID");
  assertHexIdentifier(input.trace.spanId, 8, "CANOPYPROOF_EDGE_SPAN_ID_INVALID");
  if (input.trace.parentSpanId) {
    assertHexIdentifier(input.trace.parentSpanId, 8, "CANOPYPROOF_EDGE_PARENT_SPAN_ID_INVALID");
  }
  if (!/^[A-Za-z]{1,16}$/.test(input.method)) throw new Error("CANOPYPROOF_EDGE_METHOD_INVALID");
  if (!Number.isInteger(input.status) || input.status < 100 || input.status > 599) {
    throw new Error("CANOPYPROOF_EDGE_STATUS_INVALID");
  }
  if (!Number.isFinite(input.startedAtEpochMs) || !Number.isFinite(input.endedAtEpochMs)) {
    throw new Error("CANOPYPROOF_EDGE_TIME_INVALID");
  }
  if (!input.trace.sampled) throw new Error("CANOPYPROOF_EDGE_UNSAMPLED_SPAN");
}

function isValidRequestId(value: string): boolean {
  return value.length > 0 && value.length <= MAX_REQUEST_ID_LENGTH && REQUEST_ID_PATTERN.test(value);
}

function assertHexIdentifier(value: string, byteLength: number, errorCode: string): void {
  const pattern = byteLength === 16 ? TRACE_ID_PATTERN : SPAN_ID_PATTERN;
  if (!pattern.test(value) || isAllZero(value)) throw new Error(errorCode);
}

function isAllZero(value: string): boolean {
  return /^0+$/.test(value);
}

async function sha256Hex(value: string, cryptoProvider: Pick<Crypto, "subtle">): Promise<string> {
  const digest = await cryptoProvider.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function millisecondsToUnixNano(milliseconds: number): string {
  return (BigInt(milliseconds) * 1_000_000n).toString();
}

function hexIdentifierToBase64(value: string, byteLength: number, errorCode: string): string {
  assertHexIdentifier(value, byteLength, errorCode);
  const bytes = new Uint8Array(byteLength);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes: Uint8Array): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0;
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    const chunk = (first << 16) | ((second ?? 0) << 8) | (third ?? 0);
    output += alphabet[(chunk >> 18) & 63];
    output += alphabet[(chunk >> 12) & 63];
    output += second === undefined ? "=" : alphabet[(chunk >> 6) & 63];
    output += third === undefined ? "=" : alphabet[chunk & 63];
  }
  return output;
}

function stringAttribute(key: string, value: string): OtlpAttribute {
  return { key, value: { stringValue: value } };
}

function intAttribute(key: string, value: number): OtlpAttribute {
  return { key, value: { intValue: String(Math.trunc(value)) } };
}

function doubleAttribute(key: string, value: number): OtlpAttribute {
  return { key, value: { doubleValue: value } };
}

function boolAttribute(key: string, value: boolean): OtlpAttribute {
  return { key, value: { boolValue: value } };
}

function otlpStatusCode(status: number): 0 | 1 | 2 {
  if (status >= 500) return 2;
  if (status >= 400) return 0;
  return 1;
}
