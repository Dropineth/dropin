# RFC: Cloudflare Edge Trace Continuity

Status: IMPLEMENTED AND VERIFIED DEFAULT-OFF

Date: 2026-07-18

Production activation: CLOSED. This RFC does not merge the API and web
Workers, enable an observability backend, configure a secret, change a domain
authorization decision, or make a production-readiness claim.

## 1. Problem Statement

The CanopyProof API constructs privacy-minimized OpenTelemetry server spans and
accepts valid W3C `traceparent` input. The separate Cloudflare API proxy does
not currently validate that header, create an edge span, or replace the
forwarded parent with an edge span ID. A public caller can therefore forward an
arbitrary malformed trace header, and a valid request has no verifiable
edge-to-origin parent-child relationship.

The Worker also has no explicit post-response lifecycle boundary. Adding a
blocking exporter would make every public API response dependent on a telemetry
endpoint. Adding request-scoped mutable global state would risk cross-request
leakage in a reused isolate.

## 2. Decision

Add a Worker-safe trace boundary that:

1. strictly parses W3C version `00` trace context and rejects malformed,
   forbidden-version, all-zero, or oversized input;
2. creates cryptographically random trace and span identifiers with Web Crypto;
3. makes the edge server span the direct parent of the API server span by
   replacing the upstream `traceparent` span ID;
4. applies a bounded locally random sampling policy even when a public
   caller requests sampling, preventing telemetry-amplification abuse;
5. exports at most one privacy-minimized edge span through an exact,
   default-off OTLP/HTTP JSON endpoint;
6. schedules export only through `ExecutionContext.waitUntil()` after the
   upstream response is available;
7. uses no request body, query string, actor, token, IP, user agent, coordinate,
   evidence content, provider payload, or raw request identifier as a span
   attribute; and
8. leaves admin blocking, API route precedence, streaming request/response
   bodies, and API/web Worker separation unchanged.

No process-local queue is introduced. A Worker invocation offers only its own
span, and the finite `waitUntil` task owns one bounded request. Durable delivery
belongs in a separately reviewed Cloudflare Queue or telemetry export product,
not in module-level mutable state.

## 3. Trust Model

- Public `traceparent` is untrusted correlation input. A valid trace ID may be
  retained, but its sampling bit is advisory and cannot override the Worker's
  local policy.
- The Worker is the authority for the edge span ID and forwarded parent ID.
- Deployment configuration is the only authority for the exporter endpoint.
  Request headers, URL fields, and request bodies cannot select an endpoint.
- A successful OTLP response means transport acceptance only. It is not proof
  of retention, indexing, alert delivery, audit integrity, or domain validity.
- Telemetry cannot authorize an unlock, certify an impact claim, move funds,
  distribute CANOPY, or mutate evidence, verification, governance, or audit
  state.

## 4. Data Flow

```text
public request
  -> validate or replace traceparent
  -> create random edge span ID
  -> apply local deterministic sample ratio
  -> forward traceparent(trace ID, edge span ID, local sample flag)
  -> stream request to the existing API origin
  -> receive or synthesize bounded HTTP response status
  -> return response immediately
  -> ctx.waitUntil(export one minimized edge span when enabled)
  -> API parses forwarded context and creates child server span
```

The Worker never consumes the upstream response body. The returned response
continues to stream it directly.

## 5. Trace Contract

Accepted inbound format:

```text
00-<32 lowercase hexadecimal trace ID>-<16 lowercase hexadecimal parent ID>-<2 hexadecimal flags>
```

The parser rejects version `ff`, versions other than `00` in this first slice,
all-zero IDs, whitespace-surrounded values, extra fields, and values over the
fixed W3C shape. Unknown flag bits are cleared. The Worker forwards only the
locally computed sampled bit:

```text
00-<accepted or generated trace ID>-<new edge span ID>-<00 or 01>
```

Missing or invalid context receives a new 16-byte trace ID. Every request
receives a new 8-byte edge span ID. Random generation uses
`crypto.getRandomValues`; there is no timestamp or `Math.random()` fallback.

The local sampling decision maps the first 52 bits of the cryptographically
random edge span ID into `[0, 1)`. It is deterministic for a fixed edge span ID
and ratio, but a caller cannot preselect the result through its trace ID or
sampled flag. A ratio of zero exports nothing and forwards `00`; a ratio of one
exports all eligible requests and forwards `01`.

## 6. Export Configuration

Export remains disabled unless every activation field is valid:

```text
CANOPYPROOF_EDGE_OTEL_EXPORT_ENABLED=true
CANOPYPROOF_EDGE_OTEL_SAMPLE_RATIO=<0..1>
OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=<exact HTTPS trace endpoint>
```

Optional bounded controls:

```text
CANOPYPROOF_EDGE_OTEL_TIMEOUT_MS=<100..5000>
CANOPYPROOF_EDGE_OTEL_MAX_PAYLOAD_BYTES=<4096..65536>
```

The endpoint must be HTTPS and contain no username, password, query, or
fragment. This slice rejects generic/signal-specific OTLP header, compression,
certificate, and client-key variables rather than silently accepting a secret
or unsupported transport behavior. It performs one POST with redirect mode
`error`, omitted credentials, no referrer, and a finite abort timeout. It does
not retry inside a Worker invocation.

Authentication and private transport require a separately reviewed service
binding, collector boundary, or Cloudflare-native telemetry export. No secret
header is accepted by this implementation.

## 7. OTLP Span Shape

The exporter emits one OTLP JSON `ExportTraceServiceRequest` with:

- `service.name=canopyproof-api-edge`;
- `service.namespace=dropin-earth`;
- scope `canopyproof-cloudflare-edge`;
- span kind `SPAN_KIND_SERVER` encoded as numeric `2`;
- byte IDs encoded as base64;
- nanosecond times encoded as decimal strings;
- `http.request.method`;
- a fixed route template `/api/*` or `/api/admin/*`;
- `http.response.status_code`;
- bounded duration;
- `canopyproof.upstream_outcome=completed|unavailable`;
- a SHA-256 hash of the edge request ID; and
- whether the trace ID was generated at the edge.

The upstream URL, host, query, response body, error message, Cloudflare
metadata, actor identity, Access assertion, authorization header, cookies, and
all other request headers are excluded.

## 8. API And Worker Interface Changes

The Worker handler accepts the normal third `ExecutionContext` parameter. For
unit tests, a narrow structural interface with `waitUntil(Promise)` is used so
the package does not depend on a global ambient Workers type package.

`createCanopyproofApiProxy` accepts injectable Web Crypto, clock, and fetch
functions only at construction time. The production default uses the Worker
runtime globals. Injected functions exist for deterministic tests and do not
come from request input.

The API route surface and upstream path mapping do not change. `/api/admin/*`
remains blocked before trace export or upstream I/O whenever
`DROPIN_ALLOW_ADMIN_PROXY=false`.

## 9. Threat Model

The implementation must contain or reject:

- malformed or oversized trace context and all-zero IDs;
- public callers forcing sampled traces;
- predictable trace/span IDs;
- SSRF through request-selected endpoints;
- URL credentials, query secrets, fragments, custom exporter headers, client
  keys, certificate paths, or plaintext transport;
- redirects, unbounded response ingestion, hanging export, oversized payloads,
  and unhandled `waitUntil` rejection;
- raw actor identity, credentials, Access assertions, cookies, IP addresses,
  user agents, URLs, queries, request/response bodies, evidence, coordinates,
  or provider data in telemetry;
- mutable request state in module scope;
- telemetry failure changing API status, body, CORS, admin blocking, or domain
  writes; and
- accidental route coalescing between the API proxy and OpenNext web Worker.

## 10. Database Changes

None. Edge spans and export outcomes are operational telemetry, not append-only
CanopyProof audit evidence. No D1, PostgreSQL, object-storage, evidence,
verification, certificate, governance, or unlock record is written.

## 11. Migration Strategy

1. Land this RFC.
2. Add pure trace parsing, secure ID generation, deterministic sampling, span
   construction, and exact OTLP serialization tests.
3. Integrate forwarding into the existing API proxy without changing routes.
4. Add `waitUntil` tests proving the response does not await telemetry.
5. Add default-off, invalid-config, privacy, timeout, redirect, and outage
   tests using mock transport only.
6. Keep every checked-in Wrangler environment explicitly disabled.
7. Independently review backend, authentication, residency, retention,
   deletion, access, dashboards, SLOs, and operator ownership before any
   activation.
8. Canary with an operator-approved environment and prove parent-child receipt
   before claiming end-to-end trace continuity.

## 12. Rollback Strategy

Set `CANOPYPROOF_EDGE_OTEL_EXPORT_ENABLED=false` and deploy the same Worker code.
Trace validation, secure ID generation, and edge-to-origin context propagation
remain useful without export. If propagation itself causes an incompatibility,
revert only the trace boundary while preserving API/web route separation,
admin blocking, CORS, streaming, and all production safety gates.

No domain record requires deletion or rewrite during rollback.

## 13. Acceptance Gates

- Missing configuration causes zero telemetry network calls.
- Invalid activation fails closed without changing the proxied response.
- Valid inbound context becomes a parent-child edge/API chain.
- Invalid context is not forwarded and receives a secure replacement.
- Public sampled flags cannot bypass the local sample ratio.
- Same edge span ID and ratio produce the same sampling decision.
- IDs use Web Crypto and contain no timestamp fallback.
- OTLP JSON uses base64 byte IDs, numeric enums, decimal-string nanos, and no
  custom top-level fields.
- Privacy-forbidden fixture values do not appear in serialized payloads.
- Admin, origin, preflight, and invalid-config responses do not call upstream
  or export transport.
- Export is scheduled through `ctx.waitUntil` and never awaited by the response.
- Timeout, redirect, and transport failure are contained without unhandled
  rejection or API behavior change.
- Focused tests, all-workspace typecheck/lint/test/build/audit, and OpenNext
  Cloudflare build pass.

## 14. Normative References

- W3C Trace Context Recommendation:
  `https://www.w3.org/TR/trace-context/`
- OpenTelemetry Protocol:
  `https://opentelemetry.io/docs/specs/otlp/`
- Cloudflare Workers context and `waitUntil`:
  `https://developers.cloudflare.com/workers/runtime-apis/context/`
- Cloudflare Workers Web Crypto:
  `https://developers.cloudflare.com/workers/runtime-apis/web-crypto/`
- Cloudflare Workers best practices:
  `https://developers.cloudflare.com/workers/best-practices/workers-best-practices/`

## 15. Implementation Checkpoint

The default-off slice now includes strict trace parsing/rebuilding, Web
Crypto-only IDs, local sample-bit authority, privacy-minimized OTLP JSON, fixed
HTTPS endpoint validation, finite payload/timeout handling, lazy
`ExecutionContext.waitUntil()` scheduling, and API proxy integration. The
Worker strips `traceparent`, `tracestate`, and `baggage` before writing its own
context. Checked-in Wrangler and deployment-script configuration keeps export
false and ratio zero.

Local Node.js 22.22.3/npm 10.9.4 verification on 2026-07-18 passed:

- 52 focused API/edge observability and Cloudflare deployment tests;
- full lint and every workspace typecheck;
- 810 unit tests and 17 PGlite/PostgreSQL integration scenarios;
- every workspace build and moderate npm audit with zero vulnerabilities;
- the all-source coverage ratchet at 66.15% statements/lines, 73.54% branches,
  and 70.76% functions;
- Wrangler 4.107.0 dry bundling with no Node built-in, `Buffer`, or
  `Math.random()` reference in the API Worker bundle;
- local workerd proxy execution returning `200` for `/api/ready`, replacing a
  malformed public trace header with a canonical unsampled edge-parent context,
  and returning `403` for `/api/admin/launch/readiness`; and
- OpenNext Cloudflare build with `.open-next/worker.js` and assets present.

The workerd exercise used a local HTTP fixture origin in testnet mode and
default-off telemetry. No production Worker, Collector, telemetry vendor,
credential, external API origin, or domain state was contacted or changed.
Backend authentication, receipt, retention, residency, deletion, dashboards,
SLOs, alerts, on-call ownership, canary evidence, and production activation
remain closed.
