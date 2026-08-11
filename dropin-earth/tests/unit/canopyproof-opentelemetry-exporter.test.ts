import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanopyProofOpenTelemetrySpan,
  buildCanopyProofRequestTelemetry,
} from "../../services/api/src/domain/canopyproof/observability.js";
import {
  buildCanopyProofOtlpJsonTraceRequest,
  canopyProofOtlpExporterConfigurationStatus,
  createCanopyProofOtlpHttpJsonExporter,
  shouldSampleCanopyProofOtlpSpan,
  type CanopyProofOtlpExporterDiagnostic,
} from "../../services/api/src/domain/canopyproof/opentelemetry-exporter.js";

const sampledTraceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
const unsampledTraceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00";

function requestTelemetry(traceparent: string | null = sampledTraceparent) {
  return buildCanopyProofRequestTelemetry({
    requestId: "edge-request-001",
    edgeRequestId: "edge-request-001",
    ...(traceparent ? { traceparent } : {}),
    route: "/canopyproof/evidence/:evidenceId",
    method: "GET",
    status: 200,
    durationMs: 12,
    actorId: "private-field-worker-id",
    actorRole: "field_worker",
    startedAt: "2026-07-18T00:00:00.000Z",
    endedAt: "2026-07-18T00:00:00.012Z",
  });
}

function readyEnvironment(overrides: Readonly<Record<string, string>> = {}) {
  return {
    CANOPYPROOF_OTEL_EXPORT_ENABLED: "true",
    OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "http/json",
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example.test/v1/traces",
    ...overrides,
  };
}

test("CanopyProof OTLP exporter is default-off and rejects unsafe activation configuration", () => {
  const disabled = canopyProofOtlpExporterConfigurationStatus({});
  assert.equal(disabled.mode, "disabled");
  assert.equal(disabled.enabled, false);
  assert.equal(disabled.ready, false);
  assert.equal(disabled.endpointConfigured, false);
  assert.equal(disabled.endpointRoot, undefined);

  const malformedActivation = canopyProofOtlpExporterConfigurationStatus({
    CANOPYPROOF_OTEL_EXPORT_ENABLED: "TRUE",
  });
  assert.equal(malformedActivation.mode, "invalid");
  assert.equal(malformedActivation.configurationError, "CANOPYPROOF_OTEL_ENABLED_INVALID");

  const missingProtocol = canopyProofOtlpExporterConfigurationStatus({
    CANOPYPROOF_OTEL_EXPORT_ENABLED: "true",
    OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example.test/v1/traces",
  });
  assert.equal(missingProtocol.mode, "invalid");
  assert.equal(missingProtocol.configurationError, "CANOPYPROOF_OTEL_PROTOCOL_REQUIRED");

  const credentials = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://identity" + ":credential@collector.example.test/v1/traces",
    }),
  );
  assert.equal(credentials.mode, "invalid");
  assert.equal(credentials.configurationError, "CANOPYPROOF_OTEL_ENDPOINT_CREDENTIALS_FORBIDDEN");
  assert.equal(JSON.stringify(credentials).includes("secret"), false);

  const unsafeHttp = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://collector.example.test/v1/traces" }),
  );
  assert.equal(unsafeHttp.configurationError, "CANOPYPROOF_OTEL_ENDPOINT_INSECURE");

  const arbitraryPrivateHttp = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://10.0.0.8:4318/v1/traces",
      CANOPYPROOF_OTEL_ALLOW_PRIVATE_HTTP: "true",
    }),
  );
  assert.equal(arbitraryPrivateHttp.configurationError, "CANOPYPROOF_OTEL_PRIVATE_HTTP_HOST_FORBIDDEN");

  const secretHeader = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({ OTEL_EXPORTER_OTLP_TRACES_HEADERS: "authorization=secret" }),
  );
  assert.equal(secretHeader.configurationError, "CANOPYPROOF_OTEL_HEADERS_UNSUPPORTED");

  const query = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example.test/v1/traces?token=secret" }),
  );
  assert.equal(query.configurationError, "CANOPYPROOF_OTEL_ENDPOINT_QUERY_FORBIDDEN");
  assert.equal(JSON.stringify(query).includes("secret"), false);

  const fragment = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example.test/v1/traces#private" }),
  );
  assert.equal(fragment.configurationError, "CANOPYPROOF_OTEL_ENDPOINT_FRAGMENT_FORBIDDEN");

  const compression = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({ OTEL_EXPORTER_OTLP_TRACES_COMPRESSION: "gzip" }),
  );
  assert.equal(compression.configurationError, "CANOPYPROOF_OTEL_COMPRESSION_UNSUPPORTED");

  const privateKeyPath = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({ OTEL_EXPORTER_OTLP_TRACES_CLIENT_KEY: "/secret/client.key" }),
  );
  assert.equal(privateKeyPath.configurationError, "CANOPYPROOF_OTEL_TLS_FILE_CONFIGURATION_UNSUPPORTED");
  assert.equal(JSON.stringify(privateKeyPath).includes("client.key"), false);

  const excessiveQueue = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({ CANOPYPROOF_OTEL_QUEUE_CAPACITY: "999999" }),
  );
  assert.equal(excessiveQueue.configurationError, "CANOPYPROOF_OTEL_QUEUE_CAPACITY_INVALID");
});

test("CanopyProof OTLP exporter accepts only explicit HTTPS or approved private collector transport", () => {
  const https = canopyProofOtlpExporterConfigurationStatus(readyEnvironment());
  assert.equal(https.mode, "ready");
  assert.equal(https.transportSecurity, "https");
  assert.match(https.endpointRoot ?? "", /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(https).includes("collector.example.test"), false);

  const privateCollector = canopyProofOtlpExporterConfigurationStatus(
    readyEnvironment({
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT:
        "http://opentelemetry-collector.observability.svc.cluster.local:4318/v1/traces",
      CANOPYPROOF_OTEL_ALLOW_PRIVATE_HTTP: "true",
    }),
  );
  assert.equal(privateCollector.mode, "ready");
  assert.equal(privateCollector.transportSecurity, "private_http");
});

test("CanopyProof OTLP JSON uses protobuf-compatible byte and enum encodings without actor identity", () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);
  const first = buildCanopyProofOtlpJsonTraceRequest([{ telemetry, span, sampled: true }]);
  const second = buildCanopyProofOtlpJsonTraceRequest([{ telemetry, span, sampled: true }]);
  const exportedSpan = first.body.resourceSpans[0]?.scopeSpans[0]?.spans[0];

  assert.ok(exportedSpan);
  assert.equal(exportedSpan.traceId, Buffer.from(telemetry.traceId, "hex").toString("base64"));
  assert.equal(exportedSpan.spanId, Buffer.from(telemetry.spanId, "hex").toString("base64"));
  assert.equal(exportedSpan.parentSpanId, Buffer.from(telemetry.parentSpanId ?? "", "hex").toString("base64"));
  assert.equal(exportedSpan.flags, 1);
  assert.equal(exportedSpan.kind, 2);
  assert.equal(exportedSpan.status.code, 1);
  assert.equal(first.json.includes("SPAN_KIND_SERVER"), false);
  assert.equal(first.json.includes("STATUS_CODE_OK"), false);
  assert.equal(first.json.includes("private-field-worker-id"), false);
  assert.equal(first.json.includes("field_worker"), false);
  assert.equal(first.json.includes("edge-request-001"), false);
  assert.equal(first.json.includes("enduser.id"), false);
  assert.equal(first.json.includes("canopyproof.actor_role"), false);
  assert.equal(first.json.includes("canopyproof.request_id_hash"), true);
  assert.equal(first.json.includes("canopyproof.edge_request_id_hash"), true);
  assert.equal(
    exportedSpan.attributes.some(
      (attribute) => attribute.key === "canopyproof.span_hash" && "stringValue" in attribute.value,
    ),
    true,
  );
  assert.equal(first.json, second.json);
  assert.equal(first.payloadRoot, second.payloadRoot);
  assert.equal(first.byteLength, new TextEncoder().encode(first.json).byteLength);
});

test("CanopyProof OTLP serialization rejects a span changed after deterministic hashing", () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);

  assert.throws(
    () =>
      buildCanopyProofOtlpJsonTraceRequest([
        {
          telemetry,
          span: { ...span, name: "GET /tampered/private-path" },
          sampled: true,
        },
      ]),
    /CANOPYPROOF_OTEL_SPAN_HASH_MISMATCH/,
  );
});

test("CanopyProof OTLP sampling respects upstream flags and deterministically samples generated traces", () => {
  const upstreamSampled = requestTelemetry(sampledTraceparent);
  const upstreamUnsampled = requestTelemetry(unsampledTraceparent);
  const generated = requestTelemetry(null);
  const sampledSpan = buildCanopyProofOpenTelemetrySpan(upstreamSampled);
  const generatedSpan = buildCanopyProofOpenTelemetrySpan(generated);

  assert.equal(shouldSampleCanopyProofOtlpSpan(upstreamSampled, sampledSpan.spanHash, 0), true);
  assert.equal(shouldSampleCanopyProofOtlpSpan(upstreamUnsampled, sampledSpan.spanHash, 1), false);
  assert.equal(shouldSampleCanopyProofOtlpSpan(generated, generatedSpan.spanHash, 0), false);
  assert.equal(shouldSampleCanopyProofOtlpSpan(generated, generatedSpan.spanHash, 1), true);
  assert.equal(
    shouldSampleCanopyProofOtlpSpan(generated, generatedSpan.spanHash, 0.5),
    shouldSampleCanopyProofOtlpSpan(generated, generatedSpan.spanHash, 0.5),
  );
});

test("CanopyProof OTLP exporter appends the trace path, posts one bounded JSON batch, and records acceptance", async () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);
  const calls: Array<{ endpoint: string; init: RequestInit | undefined }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ endpoint: String(input), init });
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  const exporter = createCanopyProofOtlpHttpJsonExporter(
    {
      CANOPYPROOF_OTEL_EXPORT_ENABLED: "true",
      OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.example.test/tenant",
    },
    { fetch: fetcher },
  );

  assert.equal(exporter.enqueue(telemetry, span).outcome, "accepted");
  await exporter.flush();

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.endpoint, "https://collector.example.test/tenant/v1/traces");
  assert.equal(calls[0]?.init?.method, "POST");
  assert.equal(calls[0]?.init?.redirect, "error");
  assert.equal(calls[0]?.init?.credentials, "omit");
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.match(headers.get("x-canopyproof-otel-payload-root") ?? "", /^[a-f0-9]{64}$/);
  const body = String(calls[0]?.init?.body);
  assert.equal(body.includes("private-field-worker-id"), false);
  assert.equal(body.includes("field_worker"), false);
  assert.deepEqual(exporter.getStatus(), {
    ...exporter.getStatus(),
    queueDepth: 0,
    inFlightSpanCount: 0,
    acceptedTotal: 1,
    exportedTotal: 1,
    failedDropTotal: 0,
    retryTotal: 0,
  });
});

test("CanopyProof OTLP enqueue performs no synchronous transport work", async () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);
  let calls = 0;
  let scheduled: (() => void) | undefined;
  const exporter = createCanopyProofOtlpHttpJsonExporter(readyEnvironment(), {
    fetch: async () => {
      calls += 1;
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    },
    schedule: (task) => {
      scheduled = task;
    },
  });

  assert.equal(exporter.enqueue(telemetry, span).outcome, "accepted");
  assert.equal(calls, 0);
  assert.ok(scheduled);
  scheduled();
  await exporter.flush();
  assert.equal(calls, 1);
});

test("CanopyProof OTLP exporter retries bounded transient failures with deterministic delay", async () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);
  const delays: number[] = [];
  const diagnostics: CanopyProofOtlpExporterDiagnostic[] = [];
  let attempts = 0;
  const fetcher: typeof fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return new Response("{}", { status: 503, headers: { "content-type": "application/json" } });
    }
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  const exporter = createCanopyProofOtlpHttpJsonExporter(
    readyEnvironment({ CANOPYPROOF_OTEL_MAX_ATTEMPTS: "2" }),
    {
      fetch: fetcher,
      sleep: async (milliseconds) => {
        delays.push(milliseconds);
      },
      diagnostic: (diagnostic) => diagnostics.push(diagnostic),
    },
  );

  exporter.enqueue(telemetry, span);
  await exporter.flush();

  assert.equal(attempts, 2);
  assert.equal(delays.length, 1);
  assert.ok((delays[0] ?? 0) >= 50 && (delays[0] ?? 0) <= 150);
  assert.equal(exporter.getStatus().retryTotal, 1);
  assert.equal(exporter.getStatus().exportedTotal, 1);
  assert.equal(diagnostics.filter((entry) => entry.code === "CANOPYPROOF_OTEL_RETRY").length, 1);
});

test("CanopyProof OTLP retry jitter is stable for the same payload and policy", async () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);
  const run = async () => {
    const delays: number[] = [];
    let attempts = 0;
    const fetcher: typeof fetch = async () => {
      attempts += 1;
      return new Response("{}", {
        status: attempts === 1 ? 503 : 200,
        headers: { "content-type": "application/json" },
      });
    };
    const exporter = createCanopyProofOtlpHttpJsonExporter(
      readyEnvironment({ CANOPYPROOF_OTEL_MAX_ATTEMPTS: "2" }),
      {
        fetch: fetcher,
        sleep: async (milliseconds) => {
          delays.push(milliseconds);
        },
      },
    );
    exporter.enqueue(telemetry, span);
    await exporter.flush();
    return delays;
  };

  assert.deepEqual(await run(), await run());
});

test("CanopyProof OTLP exporter bounds queue pressure and permanent transport rejection", async () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);
  const diagnostics: CanopyProofOtlpExporterDiagnostic[] = [];
  const fetcher: typeof fetch = async () =>
    new Response("{}", { status: 400, headers: { "content-type": "application/json" } });
  const exporter = createCanopyProofOtlpHttpJsonExporter(
    readyEnvironment({
      CANOPYPROOF_OTEL_QUEUE_CAPACITY: "1",
      CANOPYPROOF_OTEL_BATCH_SIZE: "1",
    }),
    { fetch: fetcher, diagnostic: (diagnostic) => diagnostics.push(diagnostic) },
  );

  assert.equal(exporter.enqueue(telemetry, span).outcome, "accepted");
  assert.equal(exporter.enqueue(telemetry, span).outcome, "queue_full");
  await exporter.flush();

  const status = exporter.getStatus();
  assert.equal(status.queueFullDropTotal, 1);
  assert.equal(status.failedDropTotal, 1);
  assert.equal(status.retryTotal, 0);
  assert.equal(diagnostics.some((entry) => entry.code === "CANOPYPROOF_OTEL_QUEUE_FULL"), true);
  assert.equal(diagnostics.some((entry) => entry.code === "CANOPYPROOF_OTEL_EXPORT_REJECTED"), true);
});

test("CanopyProof OTLP exporter drops a single oversized span without a network call", async () => {
  const telemetry = requestTelemetry();
  const oversized = buildCanopyProofOpenTelemetrySpan(telemetry);
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  };
  const exporter = createCanopyProofOtlpHttpJsonExporter(
    readyEnvironment({ CANOPYPROOF_OTEL_MAX_PAYLOAD_BYTES: "1024" }),
    { fetch: fetcher },
  );

  assert.equal(exporter.enqueue(telemetry, oversized).outcome, "accepted");
  await exporter.flush();

  assert.equal(calls, 0);
  assert.equal(exporter.getStatus().oversizedDropTotal, 1);
  assert.equal(exporter.getStatus().failedDropTotal, 0);
});

test("CanopyProof OTLP exporter aborts a timed-out request and never retries past policy", async () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);
  let calls = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    calls += 1;
    return new Promise<Response>((_resolve, reject) => {
      const rejectAbort = () => reject(new DOMException("aborted", "AbortError"));
      if (init?.signal?.aborted) {
        rejectAbort();
        return;
      }
      init?.signal?.addEventListener("abort", rejectAbort, { once: true });
    });
  };
  const exporter = createCanopyProofOtlpHttpJsonExporter(
    readyEnvironment({
      OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: "100",
      CANOPYPROOF_OTEL_MAX_ATTEMPTS: "1",
    }),
    { fetch: fetcher },
  );

  exporter.enqueue(telemetry, span);
  await exporter.flush();

  assert.equal(calls, 1);
  assert.equal(exporter.getStatus().failedDropTotal, 1);
  assert.equal(exporter.getStatus().retryTotal, 0);
});

test("CanopyProof OTLP exporter rejects redirect responses without following them", async () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);
  let calls = 0;
  const fetcher: typeof fetch = async (_input, init) => {
    calls += 1;
    assert.equal(init?.redirect, "error");
    return new Response(null, {
      status: 302,
      headers: { location: "https://untrusted.example.test/collect", "content-type": "application/json" },
    });
  };
  const exporter = createCanopyProofOtlpHttpJsonExporter(
    readyEnvironment({ CANOPYPROOF_OTEL_MAX_ATTEMPTS: "1" }),
    { fetch: fetcher },
  );

  exporter.enqueue(telemetry, span);
  await exporter.flush();

  assert.equal(calls, 1);
  assert.equal(exporter.getStatus().failedDropTotal, 1);
});

test("CanopyProof OTLP disabled and invalid exporters never invoke transport", async () => {
  const telemetry = requestTelemetry();
  const span = buildCanopyProofOpenTelemetrySpan(telemetry);
  let calls = 0;
  const fetcher: typeof fetch = async () => {
    calls += 1;
    throw new Error("transport must remain closed");
  };
  const disabled = createCanopyProofOtlpHttpJsonExporter({}, { fetch: fetcher });
  const invalid = createCanopyProofOtlpHttpJsonExporter(
    {
      CANOPYPROOF_OTEL_EXPORT_ENABLED: "true",
      OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "grpc",
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example.test/v1/traces",
    },
    { fetch: fetcher },
  );

  assert.equal(disabled.enqueue(telemetry, span).outcome, "disabled");
  assert.equal(invalid.enqueue(telemetry, span).outcome, "invalid_configuration");
  await Promise.all([disabled.flush(), invalid.flush()]);
  assert.equal(calls, 0);
  assert.equal(disabled.getStatus().disabledDropTotal, 1);
  assert.equal(invalid.getStatus().invalidConfigurationDropTotal, 1);
});
