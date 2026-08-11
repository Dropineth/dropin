# CanopyProof Observability

Status: implemented default-off API and API-edge request export slices; production activation closed

CanopyProof observability binds Cloudflare edge requests, API service health,
environmental proof operations, funding transparency, and early-warning alerts
into one telemetry contract. The same contract also surfaces CanopyProof
security-policy, resilience, and governance health, including rate-limit abuse
signals, failed chaos drills, unresolved conflict disclosures, and proof-record
challenges that require human review.

Service health includes `canopyproof-identity-authentication`. Its indicators
report only mode, configuration validity, environment-mode safety, and the raw
header rejection invariant. Team domain, audience, assertions, tokens, and JWKS
contents are excluded from telemetry.

Service health also includes `canopyproof-authorization-binding`. It reports
only enforced/development-isolation mode, configuration and database presence,
and the participant/membership/accreditation safety invariants. It never emits a
database URL, participant ID, membership ID, role claim, token, or registry row.
Authorization denial and registry-unavailable events are distinct security
signals; both retain only the already verified actor ID and bounded route/method.

Service health includes `canopyproof-trust-registry-configuration`. It exposes
only PostgreSQL/development mode, configuration presence, durable-authority and
data-sharing agreement and data-access request/decision capabilities,
hash-only audit export manifest capability, append-only/idempotency invariants,
and the explicit fact that downstream delivery/use/accountability adapters
remain pending.
Database URLs, raw idempotency keys, request payloads, command receipts, and
actor records are excluded.

## API Surface

```text
GET /canopyproof/observability/status
GET /metrics
```

`/canopyproof/observability/status` requires a verified CanopyProof principal.
In production the API derives it from:

```text
Cf-Access-Jwt-Assertion
```

Allowed roles are `owner`, `admin`, `verifier`, `researcher`, `observer`, and
`agent`. Local tests may opt into `development_headers`; production rejects that
mode.

## Request Identity

The Cloudflare API proxy forwards:

```text
x-dropin-edge-request-id
traceparent
cf-access-jwt-assertion
```

The proxy removes client-supplied Dropin actor, role, organization,
`traceparent`, `tracestate`, and `baggage` headers. It then writes a canonical
`traceparent` whose span ID belongs to the edge span; malformed context receives
a secure replacement. The Access assertion is forwarded unchanged for origin
verification and is never copied into telemetry.
The API validates the Access JWT again at the origin, then uses only that
request-scoped principal for actor telemetry and actor-keyed rate limits. Before
a protected handler runs, production resolves that principal against the
durable participant, membership, organization, and latest accreditation state.
Token contents, database errors, registry rows, and identity-provider
configuration values are never emitted.

The API echoes `x-dropin-request-id` on responses. If the edge request ID is
present, it becomes the API request ID. This gives operators one spine from
Cloudflare Worker logs to API logs and audit-event investigations.

Every API response also carries a bounded CanopyProof request telemetry envelope
as headers:

```text
x-dropin-trace-id
x-dropin-span-id
x-dropin-telemetry-event-hash
x-dropin-otel-span-hash
server-timing
```

If an inbound W3C `traceparent` header is valid, `x-dropin-trace-id` is the
incoming trace ID and the parent span is retained inside the telemetry envelope.
If `traceparent` is absent or invalid, the API derives a deterministic
32-character trace ID from the request ID, route, method, and start timestamp.
The 16-character span ID and 64-character telemetry event hash are derived from
the same bounded request metadata. This keeps failed RBAC/rate-limit responses
observable without introducing a new runtime dependency or storing secrets in
headers.

The API also builds an OTLP-compatible server span from the same envelope and
returns `x-dropin-otel-span-hash`. The span uses `service.name=canopyproof-api`,
`service.namespace=dropin-earth`, `SPAN_KIND_SERVER`,
`http.request.method`, `url.path`, `http.response.status_code`,
`http.server.request.duration`, `canopyproof.domain`,
`canopyproof.request_id_hash`, and `canopyproof.telemetry_event_hash`. Edge and
API request identifiers are hashed before OTLP serialization. Actor ID and role
remain available to the bounded in-process request envelope but are excluded
from the exported span. The span hash lets operators correlate API logs,
Cloudflare Worker logs, and future Collector evidence without emitting private
keys, user secrets, or actor identity in the OTLP payload.

The request telemetry envelope records:

```text
request_id
edge_request_id
trace_id
parent_span_id
span_id
actor_id
actor_role
route
method
status
duration_ms
domain
started_at
ended_at
event_hash
```

## OTLP Export Boundary

`services/api/src/domain/canopyproof/opentelemetry-exporter.ts` implements a
strict OTLP/HTTP JSON boundary for the API server span. It is disabled unless
all activation inputs are valid:

```text
CANOPYPROOF_OTEL_EXPORT_ENABLED=true
OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/json
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=<approved exact endpoint>
```

The implementation follows the signal-specific endpoint precedence rules. If
only `OTEL_EXPORTER_OTLP_ENDPOINT` is configured, it appends `v1/traces` to the
base path. A signal-specific endpoint is used without path rewriting.

The wire request is a JSON `ExportTraceServiceRequest`. Protobuf byte fields are
base64 encoded, span/status enums are integers, nanosecond timestamps are
decimal strings, and field names are lower camel case. The exporter adds no
custom top-level fields. The payload contains no actor ID/role, JWT data, IP,
user agent, query string, request or response body, database value, evidence,
media, coordinates, or provider payload.

The hot request path only offers a span to a finite process-local queue. One
drain loop sends finite batches with an exact payload cap, finite timeout, no
redirect following, response-body cancellation, and finite exponential retry
with deterministic jitter. Queue saturation, oversized spans, transport
failure, unsupported response, or invalid configuration drop telemetry without
changing the API response or any domain/audit state. Diagnostic logs contain
only a fixed code, span count, attempt, HTTP status, and exponentially sparse
occurrence count.

Configuration status is one of `disabled`, `ready`, or `invalid`. It exposes an
endpoint hash but never the endpoint or environment value. Plain HTTP requires
an explicit opt-in and is limited to loopback or a Kubernetes
`.svc.cluster.local` collector. Arbitrary headers, compression, certificate
paths, client-key paths, URL credentials, queries, and fragments fail closed.
Authentication and transport security need an independently reviewed service
mesh or Collector boundary before activation.

This is not durable delivery and not end-to-end tracing. Process termination
may discard queued spans. OpenNext, PostgreSQL, object storage, provider, queue,
satellite-ingestor, and job spans are not implemented by this slice. The
Collector still uses a debug trace exporter, and no backend, retention policy,
dashboard, SLO, alert destination, or on-call ownership has been proven.

## Cloudflare Edge Trace Boundary

`packages/dropin-cloudflare/src/canopyproof-edge-observability.ts` adds a
separate default-off server-span boundary to the existing API proxy Worker. It
does not change or merge the OpenNext web Worker route.

The proxy accepts only strict W3C version-00 `traceparent`. It removes inbound
`traceparent`, `tracestate`, and `baggage`, creates a cryptographically random
edge span ID with Web Crypto, and forwards a canonical replacement whose parent
is the edge span. Missing or malformed context receives a cryptographically
random trace ID. There is no timestamp or `Math.random()` identifier fallback.

The public caller's sampled bit is not authoritative. A finite local ratio maps
the random edge span ID into a sampling decision, so a caller cannot force
export by sending `-01`. The default ratio is zero. Checked-in Wrangler
configuration and the deployment script both explicitly retain:

```text
CANOPYPROOF_EDGE_OTEL_EXPORT_ENABLED=false
CANOPYPROOF_EDGE_OTEL_SAMPLE_RATIO=0
```

Activation additionally requires an exact HTTPS trace endpoint and
`OTEL_EXPORTER_OTLP_TRACES_PROTOCOL=http/json`. Generic endpoints, plaintext
transport, URL credentials, queries, fragments, arbitrary OTLP headers,
compression, certificate paths, and private-key paths are rejected.

One eligible request creates at most one OTLP JSON edge span. The span contains
only fixed service/scope fields, method, `/api/*`, status, bounded duration,
upstream outcome, a SHA-256 request-ID hash, and a generated-context boolean.
Actor identity, Access assertions, authorization, cookies, IP, user agent,
query, bodies, database values, evidence, coordinates, and provider data are
excluded. The export has a finite payload and timeout, rejects redirects, has
no retry, and never reads the response body.

Export is created only when the Worker has an `ExecutionContext` and is
registered with `ctx.waitUntil()`. Disabled, invalid, or unsampled requests
start no telemetry network task. Export rejection, timeout, and transport
failure cannot change the proxied response or any domain record. Admin,
untrusted-origin, preflight, invalid-config, and non-API requests return before
upstream or export I/O.

This establishes a tested edge-to-origin propagation shape, not observed
end-to-end production traces. Backend receipt, authentication, retention,
residency, deletion, dashboards, SLOs, alert ownership, and operator canary
evidence remain open. See `docs/RFC_EDGE_TRACE_CONTINUITY.md`.

## Metrics

Prometheus text metrics include:

```text
canopyproof_observability_service_up
canopyproof_service_health{service="..."}
canopyproof_critical_routes_total
canopyproof_otel_exporter_enabled
canopyproof_otel_exporter_ready
canopyproof_otel_exporter_queue_depth
canopyproof_otel_exporter_in_flight_spans
canopyproof_otel_exporter_accepted_total
canopyproof_otel_exporter_exported_total
canopyproof_otel_exporter_sampled_out_total
canopyproof_otel_exporter_dropped_total
canopyproof_otel_exporter_disabled_drop_total
canopyproof_otel_exporter_invalid_configuration_drop_total
canopyproof_otel_exporter_queue_full_drop_total
canopyproof_otel_exporter_oversized_drop_total
canopyproof_otel_exporter_failed_drop_total
canopyproof_otel_exporter_retry_total
canopyproof_early_warning_critical_alerts
canopyproof_early_warning_dispatch_receipts
canopyproof_early_warning_response_activations
canopyproof_early_warning_response_closures
canopyproof_early_warning_after_action_reviews
canopyproof_proof_record_open_challenges
canopyproof_security_abuse_signals
canopyproof_resilience_failed_drills
canopyproof_resilience_recovery_drills
canopyproof_governance_unresolved_conflicts
canopyproof_evidence_media_objects
canopyproof_evidence_quarantined_media_objects
canopyproof_evidence_pending_scan_media_objects
canopyproof_evidence_revoked_consent_receipts
canopyproof_evidence_risky_device_attestations
canopyproof_evidence_metadata_extractions_needing_review
canopyproof_evidence_open_review_tasks
canopyproof_evidence_escalated_review_tasks
canopyproof_evidence_retention_minimization_decisions
canopyproof_verification_queue_depth
canopyproof_verification_queue_blocked_work_items
canopyproof_verification_queue_escalated_work_items
canopyproof_verification_queue_backpressure_active
canopyproof_verification_queue_utilization_percent
canopyproof_evidence_offline_sync_batches
canopyproof_evidence_offline_sync_conflicts
canopyproof_evidence_custody_events
canopyproof_partner_revoked_data_sharing_agreements
canopyproof_partner_data_sharing_agreement_revocations
canopyproof_partner_superseded_data_sharing_agreements
canopyproof_partner_data_sharing_agreement_supersessions
canopyproof_partner_data_access_requests
canopyproof_partner_pending_data_access_requests
canopyproof_partner_approved_data_access_requests
canopyproof_partner_data_access_delivery_receipts
canopyproof_partner_data_use_attestations
canopyproof_partner_challenged_data_use_attestations
canopyproof_partner_data_use_enforcement_cases
canopyproof_partner_open_data_use_enforcement_cases
canopyproof_partner_data_access_restrictions
canopyproof_partner_active_data_access_restrictions
canopyproof_partner_data_access_accountability_packets
canopyproof_partner_data_access_accountability_verifications
canopyproof_partner_failed_data_access_accountability_verifications
canopyproof_partner_data_access_accountability_disclosures
canopyproof_partner_stale_data_access_accountability_disclosures
canopyproof_partner_data_access_accountability_disclosure_challenges
canopyproof_partner_open_data_access_accountability_disclosure_challenges
canopyproof_partner_data_access_accountability_disclosure_resolutions
canopyproof_partner_data_access_accountability_disclosure_notices
canopyproof_partner_withdrawn_data_access_accountability_disclosures
canopyproof_partner_corrected_data_access_accountability_disclosures
canopyproof_database_audit_transparency_enabled
canopyproof_database_audit_verification_max_events
canopyproof_telemetry_root_info{telemetry_root="..."}
```

Database audit transparency is a critical route. Operators page on failed
independent replay, sequence discontinuity, or checkpoint mismatch. The enabled
gauge confirms that the hash-only v2 contract is loaded; the max-events gauge
exposes the bounded request limit and is not a count of verified production
events.

The telemetry root is a deterministic hash of the service-health snapshot and
alert policy. It is not a secret and can be logged or stored with deployment
evidence.

## Infrastructure Files

```text
infra/canopyproof/kubernetes/api-deployment.yaml
infra/canopyproof/kubernetes/postgres-backup-cronjob.yaml
infra/observability/opentelemetry-collector.yaml
infra/observability/prometheus-rules-canopyproof.yaml
infra/cloudflare/canopyproof-terraform.tf.example
```

The manifests are production contracts, not an instruction to bypass the
existing GitHub Environment approval or Cloudflare workflow.

The API deployment manifest keeps `CANOPYPROOF_OTEL_EXPORT_ENABLED=false` and
private HTTP disabled. Its internal HTTP Collector URL is therefore not an
active transport. Enabling it requires either approved TLS/service-mesh
transport or a reviewed private-HTTP exception plus all RFC acceptance gates.
The Pod does not opt into OpenTelemetry Operator auto-instrumentation; an
unreviewed injected SDK could bypass the minimized attribute policy or duplicate
the manual API server span.

## Runbooks

### CanopyProofApiDown

1. Check `https://canopyproof.org/api/ready`.
2. Check the API proxy Worker route remains `canopyproof.org/api/*`.
3. Confirm `DROPIN_API_ORIGIN` is HTTPS and not localhost.
4. Tail the API proxy Worker and API origin logs with the request ID.
5. Do not mark production deployed until smoke passes.

### CanopyProofServiceHealthFailed

1. Query `/canopyproof/observability/status`.
2. Identify the failing bounded context.
3. Compare `/metrics` with the service-specific endpoint.
4. Inspect recent audit-event errors and failed writes.

### CanopyProofOtlpExporterNotReady

1. Query `/canopyproof/observability/status` and inspect only the exporter mode
   and bounded `configurationError`; do not print environment values.
2. If mode is `invalid`, keep export disabled and correct protocol, endpoint,
   or bounds through the reviewed deployment configuration.
3. If queue-full, failed-drop, or retry counters rise, verify Collector health
   and network policy without relaxing queue, timeout, redirect, privacy, or
   domain safety gates.
4. Collector failure must not be remediated by logging payloads, enabling raw
   actor attributes, or copying telemetry into audit/domain tables.
5. Production activation remains closed until backend receipt, retention,
   residency, access, dashboard, SLO, alert, and on-call evidence is approved.

### CanopyProofAdminProxyExposure

1. Treat as critical.
2. Confirm `DROPIN_ALLOW_ADMIN_PROXY=false`.
3. Confirm `/api/admin/launch/readiness` returns `403`.
4. Disable unsafe proxy exposure before any further deploy.

### CanopyProofSecurityAbuseSignalSpike

1. Query `/canopyproof/security/status` with an authorized observer or operator
   actor.
2. Review recent abuse-signal reasons: `anonymous_mutation`,
   `rate_limit_exceeded`, and `unsafe_claim`.
3. Correlate the API request ID, route, actor ID, and source edge context.
4. Do not relax RBAC or rate-limit policy to clear the alert; resolve the
   abusive traffic or unsafe claim path.

### CanopyProofResilienceDrillFailed

1. Query `/canopyproof/resilience/status` with an authorized observer or
   operator actor.
2. List `/canopyproof/resilience/drills` and identify the latest
   `fail_closed_violation`.
3. If `finalStateExposed` is true, hide affected proof, funding, or evidence
   state until audit recovery completes.
4. If retry paths lack an `Idempotency-Key`, block the outage retry path before
   accepting more offline evidence sync.
5. Do not mark production deployed while `canopyproof_resilience_failed_drills`
   is above zero.

### CanopyProofDeviceAttestationRiskBacklog

1. Query `/canopyproof/evidence-network/status` and confirm
   `riskyDeviceAttestationCount`.
2. List `/canopyproof/evidence/devices/attestations` with an authorized
   observer or operator actor.
3. Correlate each risk flag with evidence metadata extractions and human review
   queues; do not clear the alert by suppressing device risk flags.

### CanopyProofMetadataExtractionReviewBacklog

1. Query `/canopyproof/evidence/media/metadata-extractions` and filter
   `extractionState=needs_review` client-side until the repository layer adds a
   first-class query.
2. Review GPS accuracy, privacy mode, device risk flags, reputation, and clock
   skew issues.
3. Keep affected metadata non-final until accredited human review records a
   decision.

### CanopyProofEvidenceReviewTaskBacklog

1. Query `/canopyproof/evidence/review-tasks?status=open` with an authorized
   observer or operator actor.
2. Triage by severity and source type. Quarantined media and device-risk
   metadata should be handled before ordinary pending-scan tasks.
3. Resolve with `/canopyproof/evidence/review-tasks/:taskId/resolve`; do not
   issue proof records from artifacts whose task remains open, assigned, or
   escalated.

### CanopyProofRetentionMinimizationBacklog

1. Query `/canopyproof/evidence/retention/decisions?disposition=minimize`.
2. Confirm each decision traces to a revoked consent receipt or elapsed
   retention window.
3. Apply downstream storage minimization or tombstone handling through the
   approved object-storage workflow. Do not delete local evidence lineage
   outside the audited retention process.

### CanopyProofVerificationQueueBackpressure

1. Query `/canopyproof/verification/queue/status` with authorized operator
   headers and confirm `backpressureActive`, `capacity`, and
   `queueUtilizationPercent`.
2. List `/canopyproof/verification/queue/work-items` and separate queued,
   running, blocked, escalated, and completed work.
3. Drain completed work through the normal worker runtime or scale authorized
   verification workers. Do not bypass human review or proof issuance gates to
   clear capacity.
4. Keep new evidence in offline/idempotent retry state while backpressure is
   active.

### CanopyProofVerificationQueueBlockedWork

1. Query `/canopyproof/verification/queue/work-items?status=blocked` and
   inspect dependency reason codes.
2. Resolve upstream validation, advisory AI, TerraProof, or human-review work
   in dependency order.
3. Escalated work must be handled by verifier or governance roles with
   rationale; it cannot be auto-completed by an AI agent.
4. Do not issue Environmental Proof Records while required queue dependencies
   remain blocked or escalated.

### CanopyProofGovernanceConflictBacklog

1. Query `/canopyproof/governance/status`.
2. List unresolved records with `/canopyproof/governance/conflict-disclosures`
   using a verified institutional principal.
3. Treat unresolved proof-record conflicts as release blockers for public
   Environmental Proof Record issuance.
4. Clear or waive conflicts only through accountable governance review; never
   bypass approval validation in the proof route.

### CanopyProofProofRecordChallengeBacklog

1. Query `/canopyproof/status` and confirm `openProofRecordChallengeCount`.
2. List challenges with `/canopyproof/proof-records/:recordId/challenges` using
   a verified institutional principal.
3. Treat challenged records as disputed public lineage; ESG reports must not use
   them as clean issued records.
4. Resolve through the challenge endpoint with accountable reviewer rationale.
   Accepting revokes the proof record; rejecting restores issued status only if
   no other blocking challenge remains.

### Offline Evidence Sync Conflict Spike

1. Query `/canopyproof/evidence-network/status`.
2. Inspect recent `/canopyproof/evidence/sync-batches` records by request ID and
   idempotency key.
3. Treat conflicting evidence ID reuse as a potential duplicate planting,
   GPS-spoofing, or compromised-device signal.
4. Keep affected evidence in challenged or human-review state until accredited
   review resolves it.

### CanopyProofMediaObjectQuarantineBacklog

1. Query `/canopyproof/evidence-network/status`.
2. List `/canopyproof/evidence/media/objects` with authorized observer headers.
3. Treat quarantined media as blocked proof lineage; do not issue proof records
   from it.
4. Re-scan, replace, or challenge the field evidence through accountable review.
5. Confirm no storage secret or private key material appears in media object
   metadata.

## Safety Boundaries

- No private keys in observability config.
- OTLP export is default-off and does not establish production readiness.
- API request spans are not evidence, audit events, verification decisions, or
  proof authority.
- No mainnet funds are enabled by observability.
- No automatic CANOPY distribution is enabled.
- No certified carbon-credit, tax-offset, or guaranteed-yield claim is created.
- Production reports remain `NOT DEPLOYED` until smoke passes.
