# RFC: Bounded OpenTelemetry Export Pipeline

Status: IMPLEMENTED AND VERIFIED DEFAULT-OFF

Date: 2026-07-18

Production activation: CLOSED. This RFC does not provision a telemetry vendor,
collector, credential, dashboard, retention policy, alert destination, service
mesh, or production route. It does not claim end-to-end tracing across the
Cloudflare Worker, API, PostgreSQL, object storage, queues, or background jobs.

## 1. Problem Statement

CanopyProof currently parses W3C `traceparent`, derives deterministic request
telemetry, builds an OpenTelemetry-shaped server span, returns correlation
hashes, exposes Prometheus text metrics, and ships reviewable Collector and
alert-rule manifests. No application path exports those spans. The Collector
uses a debug trace sink only. The status document therefore describes a
compatible model, not an operational telemetry pipeline.

Treating span construction as successful export would hide request failures
from operators and overstate production readiness. Adding an unbounded,
blocking, or secret-bearing exporter would instead create a new availability
and data-exfiltration risk on every governed API request.

## 2. Decision

Implement a route-neutral, default-off OTLP/HTTP JSON export boundary for API
server spans with:

1. strict environment configuration and a fail-closed readiness state;
2. exact OTLP JSON serialization, including base64 byte identifiers and numeric
   enum values;
3. deterministic head sampling for locally generated trace contexts while
   respecting the sampled flag on accepted upstream trace contexts;
4. a bounded in-memory queue, bounded batches, one drain loop, bounded payloads,
   finite timeouts, and finite retries with deterministic jitter;
5. no redirect following, no response-body ingestion, no URL credentials, and
   no arbitrary request headers;
6. privacy-minimized resource/span attributes with no actor identifier, actor
   role, token, database value, request body, query string, user agent, IP
   address, evidence content, coordinates, or provider payload; and
7. self-observability counters that distinguish accepted, exported, sampled
   out, queue-full, oversized, and failed spans.

The request response path only enqueues. Export outage, timeout, rejection, or
queue saturation must never change the governed API response or mutate domain
state.

## 3. Scope And Non-Goals

This slice covers only the API's top-level HTTP server span. It does not add:

- Cloudflare proxy or OpenNext spans;
- PostgreSQL query or transaction spans;
- object-storage, provider, queue, job, or satellite-ingestor spans;
- baggage or tracestate propagation;
- log or metric OTLP export;
- automatic instrumentation or monkey-patching;
- a telemetry backend, durable queue, dashboard, SLO, retention policy, or
  on-call ownership; or
- a production activation decision.

Those omissions remain visible in the completion matrix and readiness docs.
The Kubernetes Pod must not carry an auto-instrumentation opt-in while this
manual minimized boundary is authoritative.

## 4. Trust Model

- Deployment configuration may select one collector endpoint. Request input
  may never select or alter it.
- The exporter trusts a successful HTTP response only as transport acceptance,
  not as proof that a backend retained, indexed, or alerted on a span.
- A span hash binds the minimized server-span model. It is not a signature,
  audit event, evidence root, or domain authorization.
- The exporter cannot authorize, verify, certify, unlock, fund, distribute
  CANOPY, move mainnet funds, or create a carbon-credit, tax-offset,
  ownership, or guaranteed-yield claim.
- Telemetry failure is operationally observable but never domain-authoritative.

## 5. Configuration Contract

The exporter is disabled unless all activation inputs are valid:

```text
CANOPYPROOF_OTEL_EXPORT_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=<exact trace endpoint>
```

If the signal-specific endpoint is absent, `OTEL_EXPORTER_OTLP_ENDPOINT` is a
base URL and `v1/traces` is appended according to the OTLP exporter contract.
The signal-specific endpoint is used exactly as supplied.

Optional bounded controls are:

```text
OTEL_EXPORTER_OTLP_TRACES_TIMEOUT=<milliseconds>
CANOPYPROOF_OTEL_QUEUE_CAPACITY=<integer>
CANOPYPROOF_OTEL_BATCH_SIZE=<integer>
CANOPYPROOF_OTEL_MAX_PAYLOAD_BYTES=<integer>
CANOPYPROOF_OTEL_MAX_ATTEMPTS=<integer>
CANOPYPROOF_OTEL_SAMPLE_RATIO=<0..1>
CANOPYPROOF_OTEL_ALLOW_PRIVATE_HTTP=true
```

Plain HTTP is accepted only when explicitly enabled and the host is loopback or
a Kubernetes `.svc.cluster.local` service. HTTPS remains the normal external
boundary. URLs containing credentials, query strings, or fragments are
invalid. Header, compression, certificate-file, and client-private-key
environment variables are rejected by this slice rather than silently ignored.
Production authentication must be supplied by an independently reviewed
service-mesh or collector boundary, never by embedding a secret in this
exporter's config or status.

Configuration status exposes booleans, bounded numeric policy, protocol, and a
hash of the normalized endpoint. It never returns the endpoint or an
environment value.

## 6. OTLP Wire Contract

The request is an OTLP `ExportTraceServiceRequest` encoded as JSON:

```text
POST <fixed endpoint>
content-type: application/json
accept: application/json
```

It contains one `resourceSpans` entry, one `scopeSpans` entry, and a bounded
array of server spans. Trace ID, span ID, and parent span ID are converted from
lowercase hexadecimal to base64 because the protobuf fields are bytes. Span
kind is numeric `2` and status is numeric `0`, `1`, or `2`. Nanosecond times
remain decimal strings. Unknown custom top-level fields are not emitted.

The exported span adds only its deterministic span hash as a correlation
attribute. The payload root binds the canonical request body and is used only
for diagnostics and tests.

## 7. Sampling

- A valid inbound trace context with the sampled flag set is exported.
- A valid inbound trace context without the sampled flag is not exported.
- A locally generated trace context is sampled by mapping its stable span hash
  into `[0, 1)` and comparing it with the configured ratio.
- Ratios are finite and bounded to `[0, 1]`.
- Sampling uses no request-controlled randomness and produces the same decision
  for the same span hash and policy.

Sampling decisions affect telemetry only. They cannot change response status,
authorization, audit, evidence, verification, or proof state.

## 8. Queue, Retry, And Failure Semantics

- Queue capacity, batch size, payload size, timeout, and attempts have hard
  implementation maxima.
- One exporter instance owns one queue and one drain loop.
- At most one batch is in flight; memory is bounded by the queue plus that
  batch.
- Queue-full and single-span-oversize conditions drop telemetry with a bounded
  diagnostic code.
- Retry is limited to transport failures and OTLP-retryable HTTP statuses.
- Backoff is exponential and uses deterministic span-root jitter.
- Redirects are rejected. Response bodies are cancelled without parsing or
  logging.
- Permanent rejection and exhausted retry drop the batch and increment failure
  and dropped counters.
- No error string, response body, endpoint, header, or payload is logged.

The in-memory queue is intentionally lossy during process termination. A
durable telemetry queue is outside this slice and remains a production gap.

## 9. API Integration

The existing all-route middleware continues to create the request telemetry
envelope after the final response status is known, including early
authentication, authorization, rate-limit, and durable-write failures. It then:

1. creates the privacy-minimized server span;
2. writes the existing correlation headers;
3. offers the span to the exporter without awaiting network I/O; and
4. leaves the response unchanged regardless of the offer result.

Dynamic path values must not be exported as route names. The middleware uses
the matched route template when available and a bounded coarse fallback for
requests rejected before routing.

## 10. Threat Model

The implementation must reject or contain:

- SSRF through request-controlled or malformed endpoint selection;
- plaintext export to arbitrary hosts;
- URL credentials, query secrets, fragments, arbitrary exporter headers,
  private-key paths, or compression modes not implemented by the boundary;
- redirects, response-body amplification, compressed response bombs, long
  timeouts, infinite retries, and retry storms;
- unbounded queues, batches, payloads, attributes, route names, or diagnostic
  messages;
- raw actor identifiers, roles, tokens, JWT claims, IPs, user agents, query
  strings, request/response bodies, database values, evidence, media,
  coordinates, or provider data in OTLP payloads;
- hexadecimal byte identifiers or string enums that violate OTLP JSON;
- duplicate drains, request-path blocking, unhandled promise rejection, and
  exporter failure changing domain state; and
- status that reports export enabled when configuration is absent or invalid.

## 11. Data And Database Changes

No database migration is introduced. Export counters are process-local and
reset on restart. They are operational hints, not append-only audit evidence.
No telemetry payload is written to the CanopyProof trust registry.

## 12. Migration Strategy

1. Ship this RFC and pure configuration, serialization, sampling, and exporter
   tests.
2. Integrate the default-off exporter into API request middleware.
3. Add exporter readiness and counters to observability status/metrics without
   exposing configuration values.
4. Validate the Collector manifest with a local strict configuration parser or
   pinned Collector image before any environment activation.
5. Independently approve transport security, backend, retention, access,
   residency, deletion, dashboards, SLOs, alerts, and on-call ownership.
6. Activate only through reviewed deployment configuration and a canary, then
   prove accepted spans at the backend with request-to-span correlation.
7. Add Worker, database, object-storage, queue, and job spans in separate RFCs.

## 13. Rollback Strategy

- Set `CANOPYPROOF_OTEL_EXPORT_ENABLED=false` and restart the API.
- Preserve request handling, deterministic response correlation hashes,
  Prometheus metrics, domain audit events, and every production safety gate.
- Do not delete or rewrite domain records because telemetry export failed.
- Remove collector network access only after the exporter is disabled.
- If a privacy incident is suspected, preserve bounded configuration and
  counter evidence, revoke backend access, and follow the approved incident and
  retention procedure. Do not copy payloads into ad hoc reports.

## 14. Acceptance Gates

- Default configuration performs no network call.
- Invalid protocol, endpoint, bounds, or unsupported secret-bearing config is
  fail-closed and visible as `invalid`, not `ready`.
- OTLP JSON uses base64 byte fields, numeric enums, lowerCamelCase names, and
  the exact trace endpoint rules.
- Same span and policy produce the same sample decision, payload, payload root,
  and retry schedule.
- Actor identity and all forbidden values are absent from the payload.
- Queue saturation, oversize, timeout, redirect, transport failure, retryable
  rejection, and permanent rejection are bounded and tested.
- Export failure never changes API status/body or creates a domain write.
- Focused tests, full CI, audit, and OpenNext build pass.
- Documentation continues to say API-request export only and production
  activation closed.

## 15. Normative References

- OpenTelemetry Protocol 1.10.0:
  `https://opentelemetry.io/docs/specs/otlp/`
- OpenTelemetry Protocol Exporter configuration and retry contract:
  `https://opentelemetry.io/docs/specs/otel/protocol/exporter/`
- Stable OTLP protobuf definitions:
  `https://github.com/open-telemetry/opentelemetry-proto`

## 16. Implementation Checkpoint

The default-off slice now includes strict configuration status, exact OTLP JSON
serialization, span-integrity replay, privacy allowlists, deterministic
sampling, finite queue/batch/payload/timeout/retry behavior, sparse diagnostic
emission, API middleware integration, exporter status/metrics, Prometheus alert
rules, and a Kubernetes manifest that explicitly disables export and does not
opt into automatic Node.js instrumentation.

Local Node.js 22.22.3/npm 10.9.4 verification on 2026-07-18 passed:

- 20 focused observability/exporter tests;
- full lint and all-workspace typecheck;
- 810 unit tests and 17 PGlite/PostgreSQL integration scenarios;
- every workspace build and moderate npm audit with zero vulnerabilities;
- the all-source coverage ratchet at 66.15% statements/lines, 73.54% branches,
  and 70.76% functions; and
- OpenNext Cloudflare build with `worker.js` and assets present.

Collector, Prometheus-rule, and API deployment YAML parse offline. A client-side
`kubectl` dry run could not perform API discovery because no local Kubernetes
server was available. No Collector binary, applied cluster, telemetry backend,
service mesh, credential, retention system, dashboard, alert delivery, or
production trace receipt was tested. Production activation and end-to-end
observability remain closed.
