import { hashJson } from "@dropin/crypto";
import type {
  CanopyProofOpenTelemetryAttribute,
  CanopyProofOpenTelemetrySpan,
  CanopyProofRequestTelemetry,
} from "./observability.js";

const DEFAULT_TIMEOUT_MS = 3_000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 10_000;
const DEFAULT_QUEUE_CAPACITY = 256;
const MAX_QUEUE_CAPACITY = 4_096;
const DEFAULT_BATCH_SIZE = 32;
const MAX_BATCH_SIZE = 128;
const DEFAULT_MAX_PAYLOAD_BYTES = 256 * 1_024;
const MIN_MAX_PAYLOAD_BYTES = 1_024;
const MAX_MAX_PAYLOAD_BYTES = 1_048_576;
const DEFAULT_MAX_ATTEMPTS = 3;
const MAX_ATTEMPTS = 5;
const DEFAULT_SAMPLE_RATIO = 1;
const MAX_RETRY_DELAY_MS = 5_000;
const EXPORTER_USER_AGENT = "CanopyProof-OTLP-HTTP-JSON/1.0";

const allowedResourceAttributeKeys = new Set([
  "service.name",
  "service.namespace",
  "deployment.environment.name",
  "telemetry.sdk.name",
  "telemetry.sdk.language",
]);

const allowedSpanAttributeKeys = new Set([
  "http.request.method",
  "url.path",
  "http.response.status_code",
  "http.server.request.duration",
  "canopyproof.domain",
  "canopyproof.request_id_hash",
  "canopyproof.telemetry_event_hash",
  "canopyproof.generated_trace_context",
  "canopyproof.edge_request_id_hash",
]);

const retryableHttpStatuses = new Set([408, 429, 502, 503, 504]);

export type CanopyProofOtlpExporterMode = "disabled" | "ready" | "invalid";

export type CanopyProofOtlpExporterConfigurationError =
  | "CANOPYPROOF_OTEL_ENABLED_INVALID"
  | "CANOPYPROOF_OTEL_PROTOCOL_REQUIRED"
  | "CANOPYPROOF_OTEL_PROTOCOL_UNSUPPORTED"
  | "CANOPYPROOF_OTEL_ENDPOINT_REQUIRED"
  | "CANOPYPROOF_OTEL_ENDPOINT_INVALID"
  | "CANOPYPROOF_OTEL_ENDPOINT_CREDENTIALS_FORBIDDEN"
  | "CANOPYPROOF_OTEL_ENDPOINT_QUERY_FORBIDDEN"
  | "CANOPYPROOF_OTEL_ENDPOINT_FRAGMENT_FORBIDDEN"
  | "CANOPYPROOF_OTEL_ENDPOINT_INSECURE"
  | "CANOPYPROOF_OTEL_PRIVATE_HTTP_HOST_FORBIDDEN"
  | "CANOPYPROOF_OTEL_HEADERS_UNSUPPORTED"
  | "CANOPYPROOF_OTEL_COMPRESSION_UNSUPPORTED"
  | "CANOPYPROOF_OTEL_TLS_FILE_CONFIGURATION_UNSUPPORTED"
  | "CANOPYPROOF_OTEL_TIMEOUT_INVALID"
  | "CANOPYPROOF_OTEL_QUEUE_CAPACITY_INVALID"
  | "CANOPYPROOF_OTEL_BATCH_SIZE_INVALID"
  | "CANOPYPROOF_OTEL_PAYLOAD_LIMIT_INVALID"
  | "CANOPYPROOF_OTEL_ATTEMPTS_INVALID"
  | "CANOPYPROOF_OTEL_SAMPLE_RATIO_INVALID";

export type CanopyProofOtlpExporterConfigurationStatus = {
  readonly service: "canopyproof-otlp-http-exporter";
  readonly mode: CanopyProofOtlpExporterMode;
  readonly enabled: boolean;
  readonly ready: boolean;
  readonly protocol: "http/json";
  readonly endpointConfigured: boolean;
  readonly endpointRoot?: string;
  readonly transportSecurity: "not_configured" | "https" | "private_http" | "invalid";
  readonly timeoutMs: number;
  readonly queueCapacity: number;
  readonly batchSize: number;
  readonly maxPayloadBytes: number;
  readonly maxAttempts: number;
  readonly sampleRatio: number;
  readonly configurationError?: CanopyProofOtlpExporterConfigurationError;
  readonly configurationRoot: string;
};

export type CanopyProofOtlpExporterStatus = CanopyProofOtlpExporterConfigurationStatus & {
  readonly queueDepth: number;
  readonly inFlightSpanCount: number;
  readonly acceptedTotal: number;
  readonly exportedTotal: number;
  readonly sampledOutTotal: number;
  readonly disabledDropTotal: number;
  readonly invalidConfigurationDropTotal: number;
  readonly queueFullDropTotal: number;
  readonly oversizedDropTotal: number;
  readonly failedDropTotal: number;
  readonly retryTotal: number;
};

export type CanopyProofOtlpEnqueueOutcome =
  | "accepted"
  | "disabled"
  | "invalid_configuration"
  | "sampled_out"
  | "queue_full";

export type CanopyProofOtlpEnqueueReceipt = {
  readonly outcome: CanopyProofOtlpEnqueueOutcome;
  readonly spanHash: string;
};

export type CanopyProofOtlpExporterDiagnostic = {
  readonly code:
    | "CANOPYPROOF_OTEL_QUEUE_FULL"
    | "CANOPYPROOF_OTEL_SPAN_INVALID"
    | "CANOPYPROOF_OTEL_PAYLOAD_OVERSIZED"
    | "CANOPYPROOF_OTEL_RETRY"
    | "CANOPYPROOF_OTEL_EXPORT_REJECTED"
    | "CANOPYPROOF_OTEL_EXPORT_FAILED";
  readonly spanCount: number;
  readonly occurrence: number;
  readonly attempt?: number;
  readonly httpStatus?: number;
};

export type CanopyProofOtlpJsonTraceRequest = {
  readonly resourceSpans: readonly {
    readonly resource: {
      readonly attributes: readonly CanopyProofOpenTelemetryAttribute[];
    };
    readonly scopeSpans: readonly {
      readonly scope: {
        readonly name: string;
        readonly version: string;
      };
      readonly spans: readonly {
        readonly traceId: string;
        readonly spanId: string;
        readonly parentSpanId?: string;
        readonly flags: number;
        readonly name: string;
        readonly kind: 2;
        readonly startTimeUnixNano: string;
        readonly endTimeUnixNano: string;
        readonly attributes: readonly CanopyProofOpenTelemetryAttribute[];
        readonly droppedAttributesCount: 0;
        readonly status: {
          readonly code: 0 | 1 | 2;
        };
      }[];
    }[];
  }[];
};

export type CanopyProofOtlpSerializedRequest = {
  readonly body: CanopyProofOtlpJsonTraceRequest;
  readonly json: string;
  readonly byteLength: number;
  readonly payloadRoot: string;
};

type Environment = Readonly<Record<string, string | undefined>>;

type ResolvedConfiguration = {
  readonly status: CanopyProofOtlpExporterConfigurationStatus;
  readonly endpoint?: string;
};

type QueuedSpan = {
  readonly telemetry: CanopyProofRequestTelemetry;
  readonly span: CanopyProofOpenTelemetrySpan;
  readonly sampled: boolean;
};

type PreparedBatch = {
  readonly entries: readonly QueuedSpan[];
  readonly request: CanopyProofOtlpSerializedRequest;
};

type ExporterDependencies = {
  readonly fetch?: typeof fetch;
  readonly sleep?: (milliseconds: number) => Promise<void>;
  readonly schedule?: (task: () => void) => void;
  readonly now?: () => number;
  readonly diagnostic?: (diagnostic: CanopyProofOtlpExporterDiagnostic) => void;
};

type MutableExporterCounters = {
  acceptedTotal: number;
  exportedTotal: number;
  sampledOutTotal: number;
  disabledDropTotal: number;
  invalidConfigurationDropTotal: number;
  queueFullDropTotal: number;
  oversizedDropTotal: number;
  failedDropTotal: number;
  retryTotal: number;
};

export function canopyProofOtlpExporterConfigurationStatus(
  environment: Environment,
): CanopyProofOtlpExporterConfigurationStatus {
  return resolveConfiguration(environment).status;
}

export function createCanopyProofOtlpHttpJsonExporter(
  environment: Environment,
  dependencies: ExporterDependencies = {},
): CanopyProofOtlpHttpJsonExporter {
  return new CanopyProofOtlpHttpJsonExporter(resolveConfiguration(environment), dependencies);
}

export class CanopyProofOtlpHttpJsonExporter {
  private readonly queue: QueuedSpan[] = [];
  private readonly fetcher: typeof fetch;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly schedule: (task: () => void) => void;
  private readonly now: () => number;
  private readonly diagnostic: (diagnostic: CanopyProofOtlpExporterDiagnostic) => void;
  private readonly counters: MutableExporterCounters = {
    acceptedTotal: 0,
    exportedTotal: 0,
    sampledOutTotal: 0,
    disabledDropTotal: 0,
    invalidConfigurationDropTotal: 0,
    queueFullDropTotal: 0,
    oversizedDropTotal: 0,
    failedDropTotal: 0,
    retryTotal: 0,
  };
  private readonly diagnosticOccurrences = new Map<CanopyProofOtlpExporterDiagnostic["code"], number>();
  private drainPromise: Promise<void> | undefined;
  private inFlightSpanCount = 0;

  constructor(
    private readonly configuration: ResolvedConfiguration,
    dependencies: ExporterDependencies = {},
  ) {
    this.fetcher = dependencies.fetch ?? globalThis.fetch.bind(globalThis);
    this.sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
    this.schedule = dependencies.schedule ?? ((task) => setTimeout(task, 0));
    this.now = dependencies.now ?? Date.now;
    this.diagnostic = dependencies.diagnostic ?? (() => undefined);
  }

  getStatus(): CanopyProofOtlpExporterStatus {
    return {
      ...this.configuration.status,
      queueDepth: this.queue.length,
      inFlightSpanCount: this.inFlightSpanCount,
      ...this.counters,
    };
  }

  enqueue(
    telemetry: CanopyProofRequestTelemetry,
    span: CanopyProofOpenTelemetrySpan,
  ): CanopyProofOtlpEnqueueReceipt {
    if (this.configuration.status.mode === "disabled") {
      this.counters.disabledDropTotal += 1;
      return { outcome: "disabled", spanHash: span.spanHash };
    }
    if (this.configuration.status.mode !== "ready" || !this.configuration.endpoint) {
      this.counters.invalidConfigurationDropTotal += 1;
      return { outcome: "invalid_configuration", spanHash: span.spanHash };
    }

    const sampled = shouldSampleSpan(telemetry, span.spanHash, this.configuration.status.sampleRatio);
    if (!sampled) {
      this.counters.sampledOutTotal += 1;
      return { outcome: "sampled_out", spanHash: span.spanHash };
    }
    if (this.queue.length >= this.configuration.status.queueCapacity) {
      this.counters.queueFullDropTotal += 1;
      this.emitDiagnostic({ code: "CANOPYPROOF_OTEL_QUEUE_FULL", spanCount: 1 });
      return { outcome: "queue_full", spanHash: span.spanHash };
    }

    this.queue.push({ telemetry, span, sampled });
    this.counters.acceptedTotal += 1;
    this.scheduleDrain();
    return { outcome: "accepted", spanHash: span.spanHash };
  }

  async flush(): Promise<void> {
    while (this.drainPromise || this.queue.length > 0) {
      if (!this.drainPromise) this.scheduleDrain();
      const activeDrain = this.drainPromise;
      if (activeDrain) await activeDrain;
      await Promise.resolve();
    }
  }

  private scheduleDrain() {
    if (this.drainPromise || this.configuration.status.mode !== "ready") return;
    const activeDrain = new Promise<void>((resolve) => this.schedule(resolve)).then(() => this.drain());
    this.drainPromise = activeDrain;
    void activeDrain.then(
      () => this.completeDrain(activeDrain),
      () => {
        const failedSpanCount = this.inFlightSpanCount;
        this.counters.failedDropTotal += failedSpanCount;
        this.inFlightSpanCount = 0;
        this.emitDiagnostic({ code: "CANOPYPROOF_OTEL_EXPORT_FAILED", spanCount: failedSpanCount });
        this.completeDrain(activeDrain);
      },
    );
  }

  private completeDrain(completed: Promise<void>) {
    if (this.drainPromise === completed) this.drainPromise = undefined;
    if (this.queue.length > 0) this.scheduleDrain();
  }

  private async drain() {
    while (this.queue.length > 0) {
      const batch = this.prepareNextBatch();
      if (!batch) continue;
      this.inFlightSpanCount = batch.entries.length;
      const exported = await this.exportBatch(batch);
      this.inFlightSpanCount = 0;
      if (exported) {
        this.counters.exportedTotal += batch.entries.length;
      } else {
        this.counters.failedDropTotal += batch.entries.length;
      }
    }
  }

  private prepareNextBatch(): PreparedBatch | undefined {
    const entries = this.queue.splice(0, this.configuration.status.batchSize);
    if (entries.length === 0) return undefined;

    let request: CanopyProofOtlpSerializedRequest;
    try {
      request = buildCanopyProofOtlpJsonTraceRequest(entries);
    } catch {
      this.counters.failedDropTotal += entries.length;
      this.emitDiagnostic({ code: "CANOPYPROOF_OTEL_SPAN_INVALID", spanCount: entries.length });
      return undefined;
    }

    while (request.byteLength > this.configuration.status.maxPayloadBytes && entries.length > 1) {
      const deferred = entries.pop();
      if (deferred) this.queue.unshift(deferred);
      try {
        request = buildCanopyProofOtlpJsonTraceRequest(entries);
      } catch {
        this.counters.failedDropTotal += entries.length;
        this.emitDiagnostic({ code: "CANOPYPROOF_OTEL_SPAN_INVALID", spanCount: entries.length });
        return undefined;
      }
    }

    if (request.byteLength > this.configuration.status.maxPayloadBytes) {
      this.counters.oversizedDropTotal += entries.length;
      this.emitDiagnostic({ code: "CANOPYPROOF_OTEL_PAYLOAD_OVERSIZED", spanCount: entries.length });
      return undefined;
    }

    return { entries, request };
  }

  private async exportBatch(batch: PreparedBatch): Promise<boolean> {
    const endpoint = this.configuration.endpoint;
    if (!endpoint) return false;

    for (let attempt = 1; attempt <= this.configuration.status.maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.configuration.status.timeoutMs);
      let retryAfter: string | null = null;
      let status: number | undefined;
      try {
        const response = await this.fetcher(endpoint, {
          method: "POST",
          headers: {
            accept: "application/json",
            "content-type": "application/json",
            "user-agent": EXPORTER_USER_AGENT,
            "x-canopyproof-otel-payload-root": batch.request.payloadRoot,
          },
          body: batch.request.json,
          cache: "no-store",
          credentials: "omit",
          redirect: "error",
          referrerPolicy: "no-referrer",
          signal: controller.signal,
        });
        status = response.status;
        retryAfter = response.headers.get("retry-after");
        const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
        await response.body?.cancel().catch(() => undefined);
        if (status === 200 && contentType === "application/json") return true;
        if (!retryableHttpStatuses.has(status)) {
          this.emitDiagnostic({
            code: "CANOPYPROOF_OTEL_EXPORT_REJECTED",
            spanCount: batch.entries.length,
            httpStatus: status,
          });
          return false;
        }
      } catch {
        status = undefined;
      } finally {
        clearTimeout(timeout);
      }

      if (attempt >= this.configuration.status.maxAttempts) {
        this.emitDiagnostic({
          code: "CANOPYPROOF_OTEL_EXPORT_FAILED",
          spanCount: batch.entries.length,
          ...(status === undefined ? {} : { httpStatus: status }),
        });
        return false;
      }

      this.counters.retryTotal += 1;
      this.emitDiagnostic({
        code: "CANOPYPROOF_OTEL_RETRY",
        spanCount: batch.entries.length,
        attempt,
        ...(status === undefined ? {} : { httpStatus: status }),
      });
      try {
        await this.sleep(retryDelayMilliseconds(batch.request.payloadRoot, attempt, retryAfter, this.now()));
      } catch {
        this.emitDiagnostic({ code: "CANOPYPROOF_OTEL_EXPORT_FAILED", spanCount: batch.entries.length });
        return false;
      }
    }

    return false;
  }

  private emitDiagnostic(diagnostic: Omit<CanopyProofOtlpExporterDiagnostic, "occurrence">) {
    const occurrence = (this.diagnosticOccurrences.get(diagnostic.code) ?? 0) + 1;
    this.diagnosticOccurrences.set(diagnostic.code, occurrence);
    if (occurrence !== 1 && (occurrence & (occurrence - 1)) !== 0) return;
    try {
      this.diagnostic({ ...diagnostic, occurrence });
    } catch {
      // Diagnostics cannot interrupt request handling or the exporter drain.
    }
  }
}

export function buildCanopyProofOtlpJsonTraceRequest(
  entries: readonly Readonly<{
    telemetry: CanopyProofRequestTelemetry;
    span: CanopyProofOpenTelemetrySpan;
    sampled: boolean;
  }>[],
): CanopyProofOtlpSerializedRequest {
  if (entries.length === 0) throw new Error("CANOPYPROOF_OTEL_EMPTY_BATCH");
  const first = entries[0];
  if (!first) throw new Error("CANOPYPROOF_OTEL_EMPTY_BATCH");

  const resourceAttributes = sanitizeAttributes(first.span.resource.attributes, allowedResourceAttributeKeys);
  assertCanonicalResourceAndScope(first.span);
  validateResourceAttributes(resourceAttributes);
  const spans = entries.map(({ span, sampled }) => {
    assertSameResourceAndScope(first.span, span);
    assertSpanHash(span);
    const sanitizedSpanAttributes = sanitizeAttributes(span.attributes, allowedSpanAttributeKeys);
    validateSpanAttributes(sanitizedSpanAttributes);
    const attributes = [
      ...sanitizedSpanAttributes,
      {
        key: "canopyproof.span_hash",
        value: { stringValue: requireBoundedString(span.spanHash, 64, "CANOPYPROOF_OTEL_SPAN_HASH_INVALID") },
      } satisfies CanopyProofOpenTelemetryAttribute,
    ];
    assertUniqueAttributeKeys(attributes);
    const startTimeUnixNano = requireUnsignedDecimal(span.startTimeUnixNano, "CANOPYPROOF_OTEL_START_TIME_INVALID");
    const endTimeUnixNano = requireUnsignedDecimal(span.endTimeUnixNano, "CANOPYPROOF_OTEL_END_TIME_INVALID");
    if (BigInt(endTimeUnixNano) < BigInt(startTimeUnixNano)) {
      throw new Error("CANOPYPROOF_OTEL_TIME_ORDER_INVALID");
    }
    return {
      traceId: hexIdentifierToBase64(span.traceId, 16, "CANOPYPROOF_OTEL_TRACE_ID_INVALID"),
      spanId: hexIdentifierToBase64(span.spanId, 8, "CANOPYPROOF_OTEL_SPAN_ID_INVALID"),
      ...(span.parentSpanId
        ? { parentSpanId: hexIdentifierToBase64(span.parentSpanId, 8, "CANOPYPROOF_OTEL_PARENT_SPAN_ID_INVALID") }
        : {}),
      flags: sampled ? 1 : 0,
      name: requireBoundedString(span.name, 640, "CANOPYPROOF_OTEL_SPAN_NAME_INVALID"),
      kind: 2 as const,
      startTimeUnixNano,
      endTimeUnixNano,
      attributes,
      droppedAttributesCount: 0 as const,
      status: {
        code: statusCode(span.status.code),
      },
    };
  });

  const body: CanopyProofOtlpJsonTraceRequest = {
    resourceSpans: [
      {
        resource: { attributes: resourceAttributes },
        scopeSpans: [
          {
            scope: {
              name: requireBoundedString(first.span.scope.name, 128, "CANOPYPROOF_OTEL_SCOPE_NAME_INVALID"),
              version: requireBoundedString(first.span.scope.version, 128, "CANOPYPROOF_OTEL_SCOPE_VERSION_INVALID"),
            },
            spans,
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
    payloadRoot: hashJson({ kind: "canopyproof-otlp-json-export-request-v1", body }),
  };
}

export function shouldSampleCanopyProofOtlpSpan(
  telemetry: CanopyProofRequestTelemetry,
  spanHash: string,
  sampleRatio: number,
): boolean {
  return shouldSampleSpan(telemetry, spanHash, sampleRatio);
}

function resolveConfiguration(environment: Environment): ResolvedConfiguration {
  const enabledValue = environment.CANOPYPROOF_OTEL_EXPORT_ENABLED?.trim();
  const endpointConfigured = Boolean(
    environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim() || environment.OTEL_EXPORTER_OTLP_ENDPOINT?.trim(),
  );
  if (enabledValue && enabledValue !== "true" && enabledValue !== "false") {
    return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_ENABLED_INVALID");
  }
  if (enabledValue !== "true") {
    return {
      status: buildConfigurationStatus({
        mode: "disabled",
        endpointConfigured,
        transportSecurity: "not_configured",
        timeoutMs: DEFAULT_TIMEOUT_MS,
        queueCapacity: DEFAULT_QUEUE_CAPACITY,
        batchSize: DEFAULT_BATCH_SIZE,
        maxPayloadBytes: DEFAULT_MAX_PAYLOAD_BYTES,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
        sampleRatio: DEFAULT_SAMPLE_RATIO,
      }),
    };
  }

  const protocol = (
    environment.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL?.trim() || environment.OTEL_EXPORTER_OTLP_PROTOCOL?.trim()
  )?.toLowerCase();
  if (!protocol) return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_PROTOCOL_REQUIRED");
  if (protocol !== "http/json") {
    return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_PROTOCOL_UNSUPPORTED");
  }
  if (hasValue(environment.OTEL_EXPORTER_OTLP_TRACES_HEADERS) || hasValue(environment.OTEL_EXPORTER_OTLP_HEADERS)) {
    return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_HEADERS_UNSUPPORTED");
  }
  const compression = (
    environment.OTEL_EXPORTER_OTLP_TRACES_COMPRESSION?.trim() || environment.OTEL_EXPORTER_OTLP_COMPRESSION?.trim()
  )?.toLowerCase();
  if (compression && compression !== "none") {
    return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_COMPRESSION_UNSUPPORTED");
  }
  if (
    hasValue(environment.OTEL_EXPORTER_OTLP_TRACES_CERTIFICATE) ||
    hasValue(environment.OTEL_EXPORTER_OTLP_CERTIFICATE) ||
    hasValue(environment.OTEL_EXPORTER_OTLP_TRACES_CLIENT_KEY) ||
    hasValue(environment.OTEL_EXPORTER_OTLP_CLIENT_KEY) ||
    hasValue(environment.OTEL_EXPORTER_OTLP_TRACES_CLIENT_CERTIFICATE) ||
    hasValue(environment.OTEL_EXPORTER_OTLP_CLIENT_CERTIFICATE)
  ) {
    return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_TLS_FILE_CONFIGURATION_UNSUPPORTED");
  }

  const timeout = parseBoundedInteger(
    environment.OTEL_EXPORTER_OTLP_TRACES_TIMEOUT ?? environment.OTEL_EXPORTER_OTLP_TIMEOUT,
    DEFAULT_TIMEOUT_MS,
    MIN_TIMEOUT_MS,
    MAX_TIMEOUT_MS,
  );
  if (!timeout.valid) return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_TIMEOUT_INVALID");
  const queueCapacity = parseBoundedInteger(
    environment.CANOPYPROOF_OTEL_QUEUE_CAPACITY,
    DEFAULT_QUEUE_CAPACITY,
    1,
    MAX_QUEUE_CAPACITY,
  );
  if (!queueCapacity.valid) {
    return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_QUEUE_CAPACITY_INVALID");
  }
  const batchSize = parseBoundedInteger(
    environment.CANOPYPROOF_OTEL_BATCH_SIZE,
    DEFAULT_BATCH_SIZE,
    1,
    MAX_BATCH_SIZE,
  );
  if (!batchSize.valid || batchSize.value > queueCapacity.value) {
    return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_BATCH_SIZE_INVALID");
  }
  const maxPayloadBytes = parseBoundedInteger(
    environment.CANOPYPROOF_OTEL_MAX_PAYLOAD_BYTES,
    DEFAULT_MAX_PAYLOAD_BYTES,
    MIN_MAX_PAYLOAD_BYTES,
    MAX_MAX_PAYLOAD_BYTES,
  );
  if (!maxPayloadBytes.valid) {
    return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_PAYLOAD_LIMIT_INVALID");
  }
  const maxAttempts = parseBoundedInteger(
    environment.CANOPYPROOF_OTEL_MAX_ATTEMPTS,
    DEFAULT_MAX_ATTEMPTS,
    1,
    MAX_ATTEMPTS,
  );
  if (!maxAttempts.valid) return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_ATTEMPTS_INVALID");
  const sampleRatio = parseSampleRatio(environment.CANOPYPROOF_OTEL_SAMPLE_RATIO);
  if (sampleRatio === undefined) {
    return invalidConfiguration(endpointConfigured, "CANOPYPROOF_OTEL_SAMPLE_RATIO_INVALID");
  }

  const endpointResolution = resolveEndpoint(environment);
  if ("error" in endpointResolution) {
    return invalidConfiguration(endpointConfigured, endpointResolution.error);
  }
  const endpointRoot = hashJson({
    kind: "canopyproof-otlp-endpoint-v1",
    endpoint: endpointResolution.endpoint,
  });
  return {
    status: buildConfigurationStatus({
      mode: "ready",
      endpointConfigured: true,
      endpointRoot,
      transportSecurity: endpointResolution.transportSecurity,
      timeoutMs: timeout.value,
      queueCapacity: queueCapacity.value,
      batchSize: batchSize.value,
      maxPayloadBytes: maxPayloadBytes.value,
      maxAttempts: maxAttempts.value,
      sampleRatio,
    }),
    endpoint: endpointResolution.endpoint,
  };
}

function resolveEndpoint(environment: Environment):
  | { readonly endpoint: string; readonly transportSecurity: "https" | "private_http" }
  | { readonly error: CanopyProofOtlpExporterConfigurationError } {
  const tracesEndpoint = environment.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim();
  const baseEndpoint = environment.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (!tracesEndpoint && !baseEndpoint) return { error: "CANOPYPROOF_OTEL_ENDPOINT_REQUIRED" };

  let endpoint: URL;
  try {
    endpoint = new URL(tracesEndpoint || baseEndpoint || "");
    if (!tracesEndpoint) {
      endpoint.pathname = `${endpoint.pathname.endsWith("/") ? endpoint.pathname : `${endpoint.pathname}/`}v1/traces`;
    }
  } catch {
    return { error: "CANOPYPROOF_OTEL_ENDPOINT_INVALID" };
  }
  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    return { error: "CANOPYPROOF_OTEL_ENDPOINT_INVALID" };
  }
  if (endpoint.username || endpoint.password) {
    return { error: "CANOPYPROOF_OTEL_ENDPOINT_CREDENTIALS_FORBIDDEN" };
  }
  if (endpoint.search) return { error: "CANOPYPROOF_OTEL_ENDPOINT_QUERY_FORBIDDEN" };
  if (endpoint.hash) return { error: "CANOPYPROOF_OTEL_ENDPOINT_FRAGMENT_FORBIDDEN" };
  if (endpoint.protocol === "https:") {
    return { endpoint: endpoint.toString(), transportSecurity: "https" };
  }
  if (environment.CANOPYPROOF_OTEL_ALLOW_PRIVATE_HTTP?.trim() !== "true") {
    return { error: "CANOPYPROOF_OTEL_ENDPOINT_INSECURE" };
  }
  const host = endpoint.hostname.toLowerCase();
  if (!isPrivateHttpCollectorHost(host)) {
    return { error: "CANOPYPROOF_OTEL_PRIVATE_HTTP_HOST_FORBIDDEN" };
  }
  return { endpoint: endpoint.toString(), transportSecurity: "private_http" };
}

function invalidConfiguration(
  endpointConfigured: boolean,
  configurationError: CanopyProofOtlpExporterConfigurationError,
): ResolvedConfiguration {
  return {
    status: buildConfigurationStatus({
      mode: "invalid",
      endpointConfigured,
      transportSecurity: "invalid",
      timeoutMs: DEFAULT_TIMEOUT_MS,
      queueCapacity: DEFAULT_QUEUE_CAPACITY,
      batchSize: DEFAULT_BATCH_SIZE,
      maxPayloadBytes: DEFAULT_MAX_PAYLOAD_BYTES,
      maxAttempts: DEFAULT_MAX_ATTEMPTS,
      sampleRatio: DEFAULT_SAMPLE_RATIO,
      configurationError,
    }),
  };
}

function buildConfigurationStatus(input: Omit<CanopyProofOtlpExporterConfigurationStatus, "service" | "enabled" | "ready" | "protocol" | "configurationRoot">): CanopyProofOtlpExporterConfigurationStatus {
  const base = {
    service: "canopyproof-otlp-http-exporter" as const,
    mode: input.mode,
    enabled: input.mode !== "disabled",
    ready: input.mode === "ready",
    protocol: "http/json" as const,
    endpointConfigured: input.endpointConfigured,
    ...(input.endpointRoot ? { endpointRoot: input.endpointRoot } : {}),
    transportSecurity: input.transportSecurity,
    timeoutMs: input.timeoutMs,
    queueCapacity: input.queueCapacity,
    batchSize: input.batchSize,
    maxPayloadBytes: input.maxPayloadBytes,
    maxAttempts: input.maxAttempts,
    sampleRatio: input.sampleRatio,
    ...(input.configurationError ? { configurationError: input.configurationError } : {}),
  };
  return {
    ...base,
    configurationRoot: hashJson({ kind: "canopyproof-otlp-exporter-configuration-v1", ...base }),
  };
}

function shouldSampleSpan(
  telemetry: CanopyProofRequestTelemetry,
  spanHash: string,
  sampleRatio: number,
) {
  if (!telemetry.generatedTraceContext) return telemetry.sampled;
  if (sampleRatio <= 0) return false;
  if (sampleRatio >= 1) return true;
  if (!/^[a-f0-9]{64}$/.test(spanHash)) return false;
  const bucket = Number.parseInt(spanHash.slice(0, 13), 16) / 0x10_0000_0000_0000;
  return bucket < sampleRatio;
}

function assertSameResourceAndScope(
  expected: CanopyProofOpenTelemetrySpan,
  actual: CanopyProofOpenTelemetrySpan,
) {
  if (
    hashJson(expected.resource) !== hashJson(actual.resource) ||
    hashJson(expected.scope) !== hashJson(actual.scope)
  ) {
    throw new Error("CANOPYPROOF_OTEL_BATCH_RESOURCE_MISMATCH");
  }
}

function assertCanonicalResourceAndScope(span: CanopyProofOpenTelemetrySpan) {
  const expectedResource = {
    attributes: [
      { key: "service.name", value: { stringValue: "canopyproof-api" } },
      { key: "service.namespace", value: { stringValue: "dropin-earth" } },
      { key: "deployment.environment.name", value: { stringValue: "production-compatible" } },
      { key: "telemetry.sdk.name", value: { stringValue: "canopyproof-edge-otel" } },
      { key: "telemetry.sdk.language", value: { stringValue: "typescript" } },
    ],
  };
  const expectedScope = {
    name: "canopyproof-api",
    version: "canopyproof-observability-v1",
  };
  if (hashJson(span.resource) !== hashJson(expectedResource) || hashJson(span.scope) !== hashJson(expectedScope)) {
    throw new Error("CANOPYPROOF_OTEL_RESOURCE_OR_SCOPE_INVALID");
  }
}

function assertSpanHash(span: CanopyProofOpenTelemetrySpan) {
  const { spanHash, ...spanBase } = span;
  const expected = hashJson({ hashKind: "canopyproof-opentelemetry-span-v1", ...spanBase });
  if (spanHash !== expected) throw new Error("CANOPYPROOF_OTEL_SPAN_HASH_MISMATCH");
}

function validateResourceAttributes(attributes: readonly CanopyProofOpenTelemetryAttribute[]) {
  if (attributes.length !== allowedResourceAttributeKeys.size) {
    throw new Error("CANOPYPROOF_OTEL_RESOURCE_ATTRIBUTES_INVALID");
  }
  for (const attribute of attributes) {
    if (!("stringValue" in attribute.value)) {
      throw new Error("CANOPYPROOF_OTEL_RESOURCE_ATTRIBUTES_INVALID");
    }
  }
}

function validateSpanAttributes(attributes: readonly CanopyProofOpenTelemetryAttribute[]) {
  const byKey = new Map(attributes.map((attribute) => [attribute.key, attribute]));
  for (const required of [
    "http.request.method",
    "url.path",
    "http.response.status_code",
    "http.server.request.duration",
    "canopyproof.domain",
    "canopyproof.request_id_hash",
    "canopyproof.telemetry_event_hash",
    "canopyproof.generated_trace_context",
  ]) {
    if (!byKey.has(required)) throw new Error("CANOPYPROOF_OTEL_SPAN_ATTRIBUTES_INVALID");
  }
  const method = stringAttributeValue(byKey.get("http.request.method"));
  const path = stringAttributeValue(byKey.get("url.path"));
  const domain = stringAttributeValue(byKey.get("canopyproof.domain"));
  if (!/^[A-Z]{1,16}$/.test(method) || !path.startsWith("/") || path.includes("?") || path.includes("#")) {
    throw new Error("CANOPYPROOF_OTEL_HTTP_ATTRIBUTES_INVALID");
  }
  if (!/^[a-z0-9-]{1,64}$/.test(domain)) throw new Error("CANOPYPROOF_OTEL_DOMAIN_ATTRIBUTE_INVALID");

  const status = integerAttributeValue(byKey.get("http.response.status_code"));
  if (status < 100 || status > 599) throw new Error("CANOPYPROOF_OTEL_HTTP_STATUS_INVALID");
  const duration = doubleAttributeValue(byKey.get("http.server.request.duration"));
  if (duration < 0 || duration > 86_400_000) throw new Error("CANOPYPROOF_OTEL_DURATION_INVALID");
  booleanAttributeValue(byKey.get("canopyproof.generated_trace_context"));

  for (const key of [
    "canopyproof.request_id_hash",
    "canopyproof.telemetry_event_hash",
    "canopyproof.edge_request_id_hash",
  ]) {
    const attribute = byKey.get(key);
    if (attribute && !/^[a-f0-9]{64}$/.test(stringAttributeValue(attribute))) {
      throw new Error("CANOPYPROOF_OTEL_HASH_ATTRIBUTE_INVALID");
    }
  }
}

function stringAttributeValue(attribute: CanopyProofOpenTelemetryAttribute | undefined) {
  if (!attribute || !("stringValue" in attribute.value)) {
    throw new Error("CANOPYPROOF_OTEL_ATTRIBUTE_TYPE_INVALID");
  }
  return attribute.value.stringValue;
}

function integerAttributeValue(attribute: CanopyProofOpenTelemetryAttribute | undefined) {
  if (!attribute || !("intValue" in attribute.value)) {
    throw new Error("CANOPYPROOF_OTEL_ATTRIBUTE_TYPE_INVALID");
  }
  const value = Number(attribute.value.intValue);
  if (!Number.isSafeInteger(value)) throw new Error("CANOPYPROOF_OTEL_ATTRIBUTE_TYPE_INVALID");
  return value;
}

function doubleAttributeValue(attribute: CanopyProofOpenTelemetryAttribute | undefined) {
  if (!attribute || !("doubleValue" in attribute.value) || !Number.isFinite(attribute.value.doubleValue)) {
    throw new Error("CANOPYPROOF_OTEL_ATTRIBUTE_TYPE_INVALID");
  }
  return attribute.value.doubleValue;
}

function booleanAttributeValue(attribute: CanopyProofOpenTelemetryAttribute | undefined) {
  if (!attribute || !("boolValue" in attribute.value)) {
    throw new Error("CANOPYPROOF_OTEL_ATTRIBUTE_TYPE_INVALID");
  }
  return attribute.value.boolValue;
}

function sanitizeAttributes(
  attributes: readonly CanopyProofOpenTelemetryAttribute[],
  allowlist: ReadonlySet<string>,
) {
  const sanitized = attributes.filter((attribute) => allowlist.has(attribute.key)).map((attribute) => {
    if ("stringValue" in attribute.value) {
      return {
        key: attribute.key,
        value: {
          stringValue: requireBoundedString(
            attribute.value.stringValue,
            512,
            "CANOPYPROOF_OTEL_ATTRIBUTE_VALUE_INVALID",
          ),
        },
      } satisfies CanopyProofOpenTelemetryAttribute;
    }
    if ("intValue" in attribute.value) {
      return {
        key: attribute.key,
        value: {
          intValue: requireSignedDecimal(attribute.value.intValue, "CANOPYPROOF_OTEL_ATTRIBUTE_VALUE_INVALID"),
        },
      } satisfies CanopyProofOpenTelemetryAttribute;
    }
    if ("doubleValue" in attribute.value) {
      if (!Number.isFinite(attribute.value.doubleValue)) throw new Error("CANOPYPROOF_OTEL_ATTRIBUTE_VALUE_INVALID");
      return attribute;
    }
    return attribute;
  });
  assertUniqueAttributeKeys(sanitized);
  return sanitized;
}

function assertUniqueAttributeKeys(attributes: readonly CanopyProofOpenTelemetryAttribute[]) {
  const keys = new Set<string>();
  for (const attribute of attributes) {
    if (!attribute.key || attribute.key.length > 128 || keys.has(attribute.key)) {
      throw new Error("CANOPYPROOF_OTEL_ATTRIBUTE_KEY_INVALID");
    }
    keys.add(attribute.key);
  }
}

function statusCode(code: CanopyProofOpenTelemetrySpan["status"]["code"]): 0 | 1 | 2 {
  if (code === "STATUS_CODE_OK") return 1;
  if (code === "STATUS_CODE_ERROR") return 2;
  return 0;
}

function hexIdentifierToBase64(value: string, byteLength: number, errorCode: string) {
  if (!new RegExp(`^[a-f0-9]{${byteLength * 2}}$`).test(value) || /^0+$/.test(value)) {
    throw new Error(errorCode);
  }
  const bytes = new Uint8Array(byteLength);
  for (let index = 0; index < value.length; index += 2) {
    bytes[index / 2] = Number.parseInt(value.slice(index, index + 2), 16);
  }
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes: Uint8Array) {
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

function requireUnsignedDecimal(value: string, errorCode: string) {
  if (!/^(0|[1-9][0-9]*)$/.test(value)) throw new Error(errorCode);
  return value;
}

function requireSignedDecimal(value: string, errorCode: string) {
  if (!/^-?(0|[1-9][0-9]*)$/.test(value)) throw new Error(errorCode);
  return value;
}

function requireBoundedString(value: string, maxLength: number, errorCode: string) {
  if (!value || value.length > maxLength || [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  })) throw new Error(errorCode);
  return value;
}

function retryDelayMilliseconds(payloadRoot: string, attempt: number, retryAfter: string | null, nowMs: number) {
  const retryAfterMs = parseRetryAfter(retryAfter, nowMs);
  if (retryAfterMs !== undefined) return retryAfterMs;
  const base = Math.min(100 * 2 ** Math.max(0, attempt - 1), 2_000);
  const jitterUnit = Number.parseInt(
    hashJson({ kind: "canopyproof-otlp-retry-jitter-v1", payloadRoot, attempt }).slice(0, 8),
    16,
  ) / 0xffff_ffff;
  return Math.max(1, Math.min(MAX_RETRY_DELAY_MS, Math.round(base * (0.5 + jitterUnit))));
}

function parseRetryAfter(value: string | null, nowMs: number) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^[0-9]+$/.test(trimmed)) {
    return Math.min(MAX_RETRY_DELAY_MS, Number.parseInt(trimmed, 10) * 1_000);
  }
  const timestamp = Date.parse(trimmed);
  if (!Number.isFinite(timestamp)) return undefined;
  return Math.max(0, Math.min(MAX_RETRY_DELAY_MS, timestamp - nowMs));
}

function parseBoundedInteger(
  raw: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  if (raw === undefined || raw.trim() === "") return { valid: true as const, value: fallback };
  const normalized = raw.trim();
  if (!/^[0-9]+$/.test(normalized)) return { valid: false as const, value: fallback };
  const value = Number.parseInt(normalized, 10);
  return {
    valid: Number.isSafeInteger(value) && value >= minimum && value <= maximum,
    value,
  };
}

function parseSampleRatio(raw: string | undefined) {
  if (raw === undefined || raw.trim() === "") return DEFAULT_SAMPLE_RATIO;
  const value = Number(raw.trim());
  return Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined;
}

function isPrivateHttpCollectorHost(host: string) {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".svc.cluster.local");
}

function hasValue(value: string | undefined) {
  return Boolean(value?.trim());
}
