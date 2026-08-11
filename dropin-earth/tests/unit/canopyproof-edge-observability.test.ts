import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCanopyproofEdgeOtlpJsonTraceRequest,
  createCanopyproofEdgeRequestId,
  createCanopyproofEdgeTraceContext,
  exportCanopyproofEdgeOtlpSpan,
  formatCanopyproofEdgeTraceparent,
  parseCanopyproofEdgeTraceparent,
  resolveCanopyproofEdgeOtlpConfiguration,
  scheduleCanopyproofEdgeOtlpSpan,
  shouldSampleCanopyproofEdgeSpan,
  type CanopyproofEdgeOtlpConfiguration,
  type CanopyproofEdgeSpanInput,
} from "../../packages/dropin-cloudflare/src/canopyproof-edge-observability.ts";
import { createCanopyproofApiProxy } from "../../infra/cloudflare/canopyproof-api-proxy.ts";
import { buildCanopyProofRequestTelemetry } from "../../services/api/src/domain/canopyproof/observability.ts";

const TRACE_ID = "00112233445566778899aabbccddeeff";
const PARENT_SPAN_ID = "1122334455667788";
const EDGE_SPAN_ID = "aabbccddeeff0011";

const proxyEnv = {
  DROPIN_API_ORIGIN: "https://api.dropin.example",
  DROPIN_ALLOWED_ORIGINS: "https://canopyproof.org,https://www.canopyproof.org",
  DROPIN_CANOPYPROOF_MODE: "production",
  DROPIN_CANONICAL_HOST: "canopyproof.org",
  DROPIN_ALLOW_ADMIN_PROXY: "false",
};

const readyOtlpEnv = {
  CANOPYPROOF_EDGE_OTEL_EXPORT_ENABLED: "true",
  CANOPYPROOF_EDGE_OTEL_SAMPLE_RATIO: "1",
  CANOPYPROOF_EDGE_OTEL_TIMEOUT_MS: "500",
  CANOPYPROOF_EDGE_OTEL_MAX_PAYLOAD_BYTES: "8192",
  OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "http/json",
  OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://collector.example.test/v1/traces",
};

function readyConfiguration(overrides: Partial<CanopyproofEdgeOtlpConfiguration> = {}): CanopyproofEdgeOtlpConfiguration {
  return {
    endpoint: new URL("https://collector.example.test/v1/traces"),
    sampleRatio: 1,
    timeoutMs: 500,
    maxPayloadBytes: 8_192,
    ...overrides,
  };
}

function edgeSpanInput(overrides: Partial<CanopyproofEdgeSpanInput> = {}): CanopyproofEdgeSpanInput {
  return {
    requestId: "private-actor-token",
    trace: {
      traceId: TRACE_ID,
      parentSpanId: PARENT_SPAN_ID,
      spanId: EDGE_SPAN_ID,
      sampled: true,
      generated: false,
    },
    method: "POST",
    status: 201,
    startedAtEpochMs: 1_720_000_000_000,
    endedAtEpochMs: 1_720_000_000_025,
    upstreamOutcome: "completed",
    ...overrides,
  };
}

test("edge traceparent parser accepts only the bounded W3C version-00 shape", () => {
  assert.deepEqual(parseCanopyproofEdgeTraceparent(`00-${TRACE_ID}-${PARENT_SPAN_ID}-01`), {
    traceId: TRACE_ID,
    parentSpanId: PARENT_SPAN_ID,
    sampled: true,
  });
  assert.equal(parseCanopyproofEdgeTraceparent(`00-${TRACE_ID}-${PARENT_SPAN_ID}-00`)?.sampled, false);

  for (const invalid of [
    undefined,
    "",
    ` 00-${TRACE_ID}-${PARENT_SPAN_ID}-01`,
    `00-${TRACE_ID.toUpperCase()}-${PARENT_SPAN_ID}-01`,
    `ff-${TRACE_ID}-${PARENT_SPAN_ID}-01`,
    `01-${TRACE_ID}-${PARENT_SPAN_ID}-01-extra`,
    `00-${"0".repeat(32)}-${PARENT_SPAN_ID}-01`,
    `00-${TRACE_ID}-${"0".repeat(16)}-01`,
    `00-${TRACE_ID}-short-01`,
  ]) {
    assert.equal(parseCanopyproofEdgeTraceparent(invalid), undefined, `must reject ${String(invalid)}`);
  }
});

test("edge trace construction creates the direct API parent and ignores a caller sampling bit", () => {
  const accepted = createCanopyproofEdgeTraceContext(`00-${TRACE_ID}-${PARENT_SPAN_ID}-00`, 1, {
    spanIdFactory: () => EDGE_SPAN_ID,
  });
  assert.deepEqual(accepted, {
    traceId: TRACE_ID,
    parentSpanId: PARENT_SPAN_ID,
    spanId: EDGE_SPAN_ID,
    sampled: true,
    generated: false,
  });
  assert.equal(formatCanopyproofEdgeTraceparent(accepted), `00-${TRACE_ID}-${EDGE_SPAN_ID}-01`);

  const callerRequestedSampling = createCanopyproofEdgeTraceContext(`00-${TRACE_ID}-${PARENT_SPAN_ID}-01`, 0, {
    spanIdFactory: () => EDGE_SPAN_ID,
  });
  assert.equal(callerRequestedSampling.sampled, false);
  assert.equal(formatCanopyproofEdgeTraceparent(callerRequestedSampling), `00-${TRACE_ID}-${EDGE_SPAN_ID}-00`);

  const generated = createCanopyproofEdgeTraceContext("malformed", 1, {
    traceIdFactory: () => "ffeeddccbbaa99887766554433221100",
    spanIdFactory: () => EDGE_SPAN_ID,
  });
  assert.equal(generated.generated, true);
  assert.equal(generated.parentSpanId, undefined);
  assert.equal(generated.traceId, "ffeeddccbbaa99887766554433221100");
});

test("edge sampling is deterministic for a secure edge span ID and bounded ratio", () => {
  assert.equal(shouldSampleCanopyproofEdgeSpan("0000000000000001", 0.5), true);
  assert.equal(shouldSampleCanopyproofEdgeSpan("ffffffffffffffff", 0.5), false);
  assert.equal(shouldSampleCanopyproofEdgeSpan(EDGE_SPAN_ID, 0.7), shouldSampleCanopyproofEdgeSpan(EDGE_SPAN_ID, 0.7));
  assert.equal(shouldSampleCanopyproofEdgeSpan(EDGE_SPAN_ID, 0), false);
  assert.equal(shouldSampleCanopyproofEdgeSpan(EDGE_SPAN_ID, 1), true);
  assert.throws(() => shouldSampleCanopyproofEdgeSpan(EDGE_SPAN_ID, Number.NaN), /SAMPLE_RATIO_INVALID/);
  assert.throws(() => shouldSampleCanopyproofEdgeSpan("0000000000000000", 1), /SPAN_ID_INVALID/);
});

test("edge request IDs require Web Crypto and never fall back to a timestamp", () => {
  const bytes = Uint8Array.from({ length: 16 }, (_, index) => index + 1);
  const fakeCrypto = {
    getRandomValues<T extends ArrayBufferView | null>(array: T): T {
      assert.ok(array instanceof Uint8Array);
      array.set(bytes);
      return array as T;
    },
    randomUUID: undefined,
  };
  const requestId = createCanopyproofEdgeRequestId(fakeCrypto as Pick<Crypto, "getRandomValues" | "randomUUID">);

  assert.equal(requestId, "edge-0102030405060708090a0b0c0d0e0f10");
  assert.doesNotMatch(requestId, /edge-[a-z0-9]{8}$/);
});

test("edge OTLP configuration is default-off and rejects unsafe activation", () => {
  assert.deepEqual(resolveCanopyproofEdgeOtlpConfiguration({}), {
    state: "disabled",
    enabled: false,
    ready: false,
    code: "CANOPYPROOF_EDGE_OTEL_DISABLED",
  });

  const cases = [
    [{ ...readyOtlpEnv, CANOPYPROOF_EDGE_OTEL_EXPORT_ENABLED: "yes" }, "ENABLED_INVALID"],
    [{ ...readyOtlpEnv, OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "grpc" }, "PROTOCOL_INVALID"],
    [{ ...readyOtlpEnv, OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "" }, "ENDPOINT_REQUIRED"],
    [{ ...readyOtlpEnv, OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "http://collector.example.test/v1/traces" }, "ENDPOINT_INSECURE"],
    [{
      ...readyOtlpEnv,
      OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://identity" + ":credential@collector.example.test/v1/traces",
    }, "ENDPOINT_INVALID"],
    [{ ...readyOtlpEnv, OTEL_EXPORTER_OTLP_ENDPOINT: "https://collector.example.test" }, "UNSUPPORTED_BASE_ENDPOINT"],
    [{ ...readyOtlpEnv, OTEL_EXPORTER_OTLP_TRACES_HEADERS: "authorization=secret" }, "UNSUPPORTED_HEADERS"],
    [{ ...readyOtlpEnv, OTEL_EXPORTER_OTLP_TRACES_COMPRESSION: "gzip" }, "UNSUPPORTED_COMPRESSION"],
    [{ ...readyOtlpEnv, OTEL_EXPORTER_OTLP_TRACES_CLIENT_KEY: "/secret/key.pem" }, "UNSUPPORTED_TLS_FILES"],
    [{ ...readyOtlpEnv, CANOPYPROOF_EDGE_OTEL_SAMPLE_RATIO: "1.1" }, "SAMPLE_RATIO_INVALID"],
    [{ ...readyOtlpEnv, CANOPYPROOF_EDGE_OTEL_SAMPLE_RATIO: "1e0" }, "SAMPLE_RATIO_INVALID"],
    [{ ...readyOtlpEnv, CANOPYPROOF_EDGE_OTEL_TIMEOUT_MS: "6000" }, "TIMEOUT_INVALID"],
    [{ ...readyOtlpEnv, CANOPYPROOF_EDGE_OTEL_MAX_PAYLOAD_BYTES: "999999" }, "PAYLOAD_LIMIT_INVALID"],
  ] as const;

  for (const [environment, code] of cases) {
    const result = resolveCanopyproofEdgeOtlpConfiguration(environment);
    assert.equal(result.state, "invalid");
    assert.match(result.code, new RegExp(code));
  }

  const ready = resolveCanopyproofEdgeOtlpConfiguration(readyOtlpEnv);
  assert.equal(ready.state, "ready");
  if (ready.state === "ready") {
    assert.equal(ready.config.endpoint.toString(), "https://collector.example.test/v1/traces");
    assert.equal(ready.config.sampleRatio, 1);
    assert.equal(ready.config.timeoutMs, 500);
    assert.equal(ready.config.maxPayloadBytes, 8_192);
  }
});

test("edge OTLP JSON uses the exact protobuf JSON shape and privacy allowlist", async () => {
  const serialized = await buildCanopyproofEdgeOtlpJsonTraceRequest(edgeSpanInput());
  const resourceSpan = serialized.body.resourceSpans[0];
  const scopeSpan = resourceSpan.scopeSpans[0];
  const span = scopeSpan.spans[0];

  assert.deepEqual(Object.keys(serialized.body), ["resourceSpans"]);
  assert.equal(span.traceId, Buffer.from(TRACE_ID, "hex").toString("base64"));
  assert.equal(span.spanId, Buffer.from(EDGE_SPAN_ID, "hex").toString("base64"));
  assert.equal(span.parentSpanId, Buffer.from(PARENT_SPAN_ID, "hex").toString("base64"));
  assert.equal(span.kind, 2);
  assert.equal(span.flags, 1);
  assert.equal(span.status.code, 1);
  assert.equal(span.startTimeUnixNano, "1720000000000000000");
  assert.equal(span.endTimeUnixNano, "1720000000025000000");
  assert.equal(scopeSpan.scope.name, "canopyproof-cloudflare-edge");
  assert.equal(resourceSpan.resource.attributes.find((attribute) => attribute.key === "service.name")?.value.stringValue, "canopyproof-api-edge");
  assert.match(serialized.json, /canopyproof\.edge_request_id_hash/);
  assert.doesNotMatch(serialized.json, /private-actor-token/);
  assert.doesNotMatch(serialized.json, /authorization|cookie|jwt|latitude|longitude|query/i);
  assert.equal(serialized.byteLength, new TextEncoder().encode(serialized.json).byteLength);
});

test("edge exporter is bounded, exact, and contains transport failures", async () => {
  let outbound: Request | undefined;
  const exported = await exportCanopyproofEdgeOtlpSpan({
    configuration: readyConfiguration(),
    span: edgeSpanInput(),
    fetcher: async (request) => {
      outbound = request;
      return new Response("ignored", { status: 202 });
    },
  });

  assert.equal(exported, "exported");
  assert.ok(outbound);
  assert.equal(outbound.url, "https://collector.example.test/v1/traces");
  assert.equal(outbound.method, "POST");
  assert.equal(outbound.headers.get("content-type"), "application/json");
  assert.equal(outbound.redirect, "error");
  assert.equal(outbound.credentials, "omit");
  assert.equal(outbound.referrerPolicy, "no-referrer");

  let calls = 0;
  const sampledOut = await exportCanopyproofEdgeOtlpSpan({
    configuration: readyConfiguration(),
    span: edgeSpanInput({ trace: { ...edgeSpanInput().trace, sampled: false } }),
    fetcher: async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    },
  });
  const oversized = await exportCanopyproofEdgeOtlpSpan({
    configuration: readyConfiguration({ maxPayloadBytes: 1 }),
    span: edgeSpanInput(),
    fetcher: async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    },
  });
  const rejected = await exportCanopyproofEdgeOtlpSpan({
    configuration: readyConfiguration(),
    span: edgeSpanInput(),
    fetcher: async () => new Response(null, { status: 503 }),
  });
  const failed = await exportCanopyproofEdgeOtlpSpan({
    configuration: readyConfiguration(),
    span: edgeSpanInput(),
    fetcher: async () => {
      throw new Error("fixture endpoint outage with secret body");
    },
  });

  assert.equal(sampledOut, "sampled_out");
  assert.equal(oversized, "oversized");
  assert.equal(rejected, "rejected");
  assert.equal(failed, "failed");
  assert.equal(calls, 0);
});

test("edge exporter aborts at the configured deadline without rejection leakage", async () => {
  const outcome = await exportCanopyproofEdgeOtlpSpan({
    configuration: readyConfiguration({ timeoutMs: 100 }),
    span: edgeSpanInput(),
    fetcher: async (request) =>
      new Promise<Response>((_resolve, reject) => {
        const rejectAbort = () => reject(new DOMException("aborted", "AbortError"));
        if (request.signal.aborted) {
          rejectAbort();
          return;
        }
        request.signal.addEventListener("abort", rejectAbort, { once: true });
      }),
  });

  assert.equal(outcome, "failed");
});

test("waitUntil scheduling absorbs exporter resolution and rejection", async () => {
  const scheduled: Promise<unknown>[] = [];
  const context = {
    waitUntil(promise: Promise<unknown>) {
      scheduled.push(promise);
    },
  };

  assert.equal(scheduleCanopyproofEdgeOtlpSpan(context, () => Promise.resolve("exported")), true);
  assert.equal(scheduleCanopyproofEdgeOtlpSpan(context, () => Promise.reject(new Error("fixture"))), true);
  let absentContextCalls = 0;
  assert.equal(
    scheduleCanopyproofEdgeOtlpSpan(undefined, () => {
      absentContextCalls += 1;
      return Promise.resolve("exported");
    }),
    false,
  );
  assert.equal(absentContextCalls, 0);
  await Promise.all(scheduled);
});

test("API proxy forwards an edge-parent trace and does not await OTLP transport", async () => {
  let forwardedTraceparent: string | null = null;
  let telemetryRequest: Request | undefined;
  let resolveTelemetry: ((response: Response) => void) | undefined;
  const telemetryResponse = new Promise<Response>((resolve) => {
    resolveTelemetry = resolve;
  });
  const scheduled: Promise<unknown>[] = [];
  const clock = [1_720_000_000_000, 1_720_000_000_010];
  const handler = createCanopyproofApiProxy({
    requestIdFactory: () => "edge-request-1",
    spanIdFactory: () => EDGE_SPAN_ID,
    now: () => clock.shift() ?? 1_720_000_000_010,
    fetcher: async (request) => {
      forwardedTraceparent = request.headers.get("traceparent");
      return Response.json({ forwardedTraceparent });
    },
    telemetryFetcher: async (request) => {
      telemetryRequest = request;
      return telemetryResponse;
    },
  });

  const response = await handler.fetch(
    new Request("https://canopyproof.org/api/ready?credential=must-not-export", {
      headers: {
        authorization: "Bearer must-not-export",
        "cf-access-jwt-assertion": "access-assertion-must-not-export",
        traceparent: `00-${TRACE_ID}-${PARENT_SPAN_ID}-00`,
      },
    }),
    { ...proxyEnv, ...readyOtlpEnv },
    {
      waitUntil(promise) {
        scheduled.push(promise);
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(forwardedTraceparent, `00-${TRACE_ID}-${EDGE_SPAN_ID}-01`);
  const apiTelemetry = buildCanopyProofRequestTelemetry({
    requestId: "api-request-1",
    edgeRequestId: "edge-request-1",
    traceparent: forwardedTraceparent,
    route: "/ready",
    method: "GET",
    status: 200,
    durationMs: 5,
    startedAt: "2026-07-18T00:00:00.000Z",
    endedAt: "2026-07-18T00:00:00.005Z",
  });
  assert.equal(apiTelemetry.traceId, TRACE_ID);
  assert.equal(apiTelemetry.parentSpanId, EDGE_SPAN_ID);
  assert.equal(scheduled.length, 1);
  await waitFor(() => telemetryRequest !== undefined);
  assert.ok(telemetryRequest);
  const telemetryBody = await telemetryRequest.text();
  assert.doesNotMatch(telemetryBody, /must-not-export|access-assertion|credential/);

  resolveTelemetry?.(new Response(null, { status: 200 }));
  await Promise.all(scheduled);
});

test("API proxy keeps telemetry default-off and contains exporter or upstream outage", async () => {
  let telemetryCalls = 0;
  const disabledHandler = createCanopyproofApiProxy({
    requestIdFactory: () => "edge-disabled",
    traceIdFactory: () => TRACE_ID,
    spanIdFactory: () => EDGE_SPAN_ID,
    fetcher: async (request) => Response.json({ traceparent: request.headers.get("traceparent") }),
    telemetryFetcher: async () => {
      telemetryCalls += 1;
      return new Response(null, { status: 200 });
    },
  });
  const disabled = await disabledHandler.fetch(new Request("https://canopyproof.org/api/ready"), proxyEnv, {
    waitUntil() {
      assert.fail("disabled telemetry must not schedule background work");
    },
  });
  const disabledBody = (await disabled.json()) as { traceparent: string };
  assert.equal(disabled.status, 200);
  assert.equal(disabledBody.traceparent, `00-${TRACE_ID}-${EDGE_SPAN_ID}-00`);
  assert.equal(telemetryCalls, 0);

  const invalidTelemetry = await disabledHandler.fetch(
    new Request("https://canopyproof.org/api/ready"),
    {
      ...proxyEnv,
      ...readyOtlpEnv,
      OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "grpc",
    },
    {
      waitUntil() {
        assert.fail("invalid telemetry configuration must not schedule background work");
      },
    },
  );
  const invalidTelemetryBody = (await invalidTelemetry.json()) as { traceparent: string };
  assert.equal(invalidTelemetry.status, 200);
  assert.equal(invalidTelemetryBody.traceparent, `00-${TRACE_ID}-${EDGE_SPAN_ID}-00`);
  assert.equal(telemetryCalls, 0);

  const scheduled: Promise<unknown>[] = [];
  const outageHandler = createCanopyproofApiProxy({
    requestIdFactory: () => "edge-outage",
    traceIdFactory: () => TRACE_ID,
    spanIdFactory: () => EDGE_SPAN_ID,
    fetcher: async () => {
      throw new Error("origin unavailable");
    },
    telemetryFetcher: async () => {
      throw new Error("collector unavailable");
    },
  });
  const outage = await outageHandler.fetch(
    new Request("https://canopyproof.org/api/ready"),
    { ...proxyEnv, ...readyOtlpEnv },
    { waitUntil: (promise) => scheduled.push(promise) },
  );
  assert.equal(outage.status, 502);
  assert.equal((await outage.json() as { error: string }).error, "upstream_unavailable");
  assert.equal(scheduled.length, 1);
  await Promise.all(scheduled);
});

test("blocked admin and invalid edge configuration perform no upstream or telemetry I/O", async () => {
  let upstreamCalls = 0;
  let telemetryCalls = 0;
  const handler = createCanopyproofApiProxy({
    fetcher: async () => {
      upstreamCalls += 1;
      return new Response(null, { status: 200 });
    },
    telemetryFetcher: async () => {
      telemetryCalls += 1;
      return new Response(null, { status: 200 });
    },
  });
  const admin = await handler.fetch(
    new Request("https://canopyproof.org/api/admin/launch/readiness"),
    { ...proxyEnv, ...readyOtlpEnv },
    { waitUntil: () => assert.fail("blocked admin must not schedule export") },
  );
  const invalidProxy = await handler.fetch(
    new Request("https://canopyproof.org/api/ready"),
    { ...proxyEnv, DROPIN_API_ORIGIN: undefined, ...readyOtlpEnv },
    { waitUntil: () => assert.fail("invalid proxy config must not schedule export") },
  );

  assert.equal(admin.status, 403);
  assert.equal(invalidProxy.status, 503);
  assert.equal(upstreamCalls, 0);
  assert.equal(telemetryCalls, 0);
});

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  assert.fail("condition was not reached");
}
