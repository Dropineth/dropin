import { hashJson } from "@dropin/crypto";
import {
  canopyProofOtlpExporterConfigurationStatus,
  type CanopyProofOtlpExporterStatus,
} from "./opentelemetry-exporter.js";

const defaultOtlpExporterStatus: CanopyProofOtlpExporterStatus = {
  ...canopyProofOtlpExporterConfigurationStatus({}),
  queueDepth: 0,
  inFlightSpanCount: 0,
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

export type CanopyProofServiceHealth = {
  readonly service: string;
  readonly ok: boolean;
  readonly indicators: Readonly<Record<string, number | string | boolean>>;
};

export type CanopyProofObservabilityStatus = {
  readonly service: "canopyproof-observability";
  readonly openTelemetry: {
    readonly spanModelEnabled: true;
    readonly serviceName: "canopyproof-api";
    readonly namespace: "dropin-earth";
    readonly traceHeader: "traceparent";
    readonly edgeRequestHeader: "x-dropin-edge-request-id";
    readonly spanHashHeader: "x-dropin-otel-span-hash";
    readonly protocol: "otlp-http";
    readonly semanticConvention: "opentelemetry-semconv-http-server";
    readonly exporter: CanopyProofOtlpExporterStatus;
  };
  readonly logs: {
    readonly format: "json";
    readonly requiredFields: readonly string[];
  };
  readonly metrics: {
    readonly format: "prometheus-text";
    readonly endpoint: "/metrics";
    readonly canopyProofPrefix: "canopyproof_";
  };
  readonly alerts: {
    readonly criticalRoutes: readonly string[];
    readonly policy: readonly string[];
  };
  readonly dependencies: {
    readonly postgresql: "required";
    readonly objectStorage: "required";
    readonly cloudflareWorkers: "required";
  };
  readonly serviceHealth: readonly CanopyProofServiceHealth[];
  readonly telemetryRoot: string;
};

export type CanopyProofTraceContext = {
  readonly traceId: string;
  readonly parentSpanId?: string;
  readonly sampled: boolean;
  readonly generated: boolean;
};

export type CanopyProofRequestTelemetry = {
  readonly service: "canopyproof-api";
  readonly requestId: string;
  readonly edgeRequestId?: string;
  readonly traceId: string;
  readonly parentSpanId?: string;
  readonly spanId: string;
  readonly sampled: boolean;
  readonly generatedTraceContext: boolean;
  readonly route: string;
  readonly method: string;
  readonly status: number;
  readonly durationMs: number;
  readonly domain: string;
  readonly actorId?: string;
  readonly actorRole?: string;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly eventHash: string;
};

export type CanopyProofOpenTelemetryAttributeValue =
  | { readonly stringValue: string }
  | { readonly intValue: string }
  | { readonly doubleValue: number }
  | { readonly boolValue: boolean };

export type CanopyProofOpenTelemetryAttribute = {
  readonly key: string;
  readonly value: CanopyProofOpenTelemetryAttributeValue;
};

export type CanopyProofOpenTelemetrySpan = {
  readonly resource: {
    readonly attributes: readonly CanopyProofOpenTelemetryAttribute[];
  };
  readonly scope: {
    readonly name: "canopyproof-api";
    readonly version: "canopyproof-observability-v1";
  };
  readonly traceId: string;
  readonly spanId: string;
  readonly parentSpanId?: string;
  readonly name: string;
  readonly kind: "SPAN_KIND_SERVER";
  readonly startTimeUnixNano: string;
  readonly endTimeUnixNano: string;
  readonly status: {
    readonly code: "STATUS_CODE_OK" | "STATUS_CODE_ERROR" | "STATUS_CODE_UNSET";
  };
  readonly attributes: readonly CanopyProofOpenTelemetryAttribute[];
  readonly droppedAttributesCount: 0;
  readonly spanHash: string;
};

export function buildCanopyProofObservabilityStatus(
  serviceHealth: readonly CanopyProofServiceHealth[],
  exporter: CanopyProofOtlpExporterStatus = defaultOtlpExporterStatus,
): CanopyProofObservabilityStatus {
  const normalizedHealth = [...serviceHealth].sort((left, right) => left.service.localeCompare(right.service));
  const base = {
    service: "canopyproof-observability" as const,
    openTelemetry: {
      spanModelEnabled: true as const,
      serviceName: "canopyproof-api" as const,
      namespace: "dropin-earth" as const,
      traceHeader: "traceparent" as const,
      edgeRequestHeader: "x-dropin-edge-request-id" as const,
      spanHashHeader: "x-dropin-otel-span-hash" as const,
      protocol: "otlp-http" as const,
      semanticConvention: "opentelemetry-semconv-http-server" as const,
      exporter,
    },
    logs: {
      format: "json" as const,
      requiredFields: ["request_id", "trace_id", "actor_id", "route", "status", "duration_ms", "domain"] as const,
    },
    metrics: {
      format: "prometheus-text" as const,
      endpoint: "/metrics" as const,
      canopyProofPrefix: "canopyproof_" as const,
    },
    alerts: {
      criticalRoutes: [
        "/canopyproof/status",
        "/canopyproof/evidence-network/status",
        "/canopyproof/agents/status",
        "/canopyproof/memory/status",
        "/canopyproof/security/status",
        "/canopyproof/resilience/status",
        "/canopyproof/governance/status",
        "/canopyproof/evidence",
        "/canopyproof/proof-records",
        "/canopyproof/proof-records/:recordId/challenges",
        "/canopyproof/audit/database-streams/verify",
        "/canopyproof/reports/esg",
        "/canopyproof/funding/ledger",
        "/canopyproof/risk/alerts",
      ] as const,
      policy: [
        "page on API readiness failure",
        "page on admin proxy exposure",
        "page on evidence queue write failures",
        "page on offline evidence sync conflict spike",
        "page on proof issuance error rate",
        "page on security abuse-signal spike",
        "page on unresolved governance conflict disclosures",
        "page on proof-record public challenge backlog",
        "page on database audit stream replay failure",
        "page on failed resilience drill",
        "page on critical environmental risk alert backlog",
      ] as const,
    },
    dependencies: {
      postgresql: "required" as const,
      objectStorage: "required" as const,
      cloudflareWorkers: "required" as const,
    },
    serviceHealth: normalizedHealth,
  };
  return {
    ...base,
    telemetryRoot: hashJson({
      kind: "canopyproof-observability-status-v1",
      serviceHealth: normalizedHealth,
      openTelemetry: base.openTelemetry,
      alerts: base.alerts,
    }),
  };
}

export function parseCanopyProofTraceparent(traceparent: string | undefined): CanopyProofTraceContext | undefined {
  if (!traceparent) return undefined;
  const match = traceparent.trim().toLowerCase().match(/^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
  if (!match) return undefined;
  const version = match[1];
  const traceId = match[2];
  const parentSpanId = match[3];
  const flags = match[4];
  if (!version || !traceId || !parentSpanId || !flags) return undefined;
  if (version === "ff" || traceId === "00000000000000000000000000000000" || parentSpanId === "0000000000000000") {
    return undefined;
  }
  return {
    traceId,
    parentSpanId,
    sampled: (Number.parseInt(flags, 16) & 1) === 1,
    generated: false,
  };
}

export function buildCanopyProofRequestTelemetry(input: Readonly<{
  requestId: string;
  edgeRequestId?: string;
  traceparent?: string;
  route: string;
  method: string;
  status: number;
  durationMs: number;
  actorId?: string;
  actorRole?: string;
  startedAt: string;
  endedAt: string;
}>): CanopyProofRequestTelemetry {
  const parsedTrace = parseCanopyProofTraceparent(input.traceparent);
  const requestId = boundedTelemetryValue(input.requestId, 128, "request_id");
  const edgeRequestId = input.edgeRequestId
    ? boundedTelemetryValue(input.edgeRequestId, 128, "edge_request_id")
    : undefined;
  const route = boundedTelemetryValue(input.route, 512, "route");
  const method = boundedTelemetryValue(input.method.toUpperCase(), 16, "method");
  const actorId = input.actorId ? boundedTelemetryValue(input.actorId, 128, "actor_id") : undefined;
  const actorRole = input.actorRole ? boundedTelemetryValue(input.actorRole, 64, "actor_role") : undefined;
  const generatedTraceId = hashJson({
    kind: "canopyproof-generated-trace-id-v1",
    requestId,
    edgeRequestId,
    route,
    method,
    startedAt: input.startedAt,
  }).slice(0, 32);
  const traceId = parsedTrace?.traceId ?? generatedTraceId;
  const spanId = hashJson({
    kind: "canopyproof-request-span-id-v1",
    traceId,
    requestId,
    route,
    method,
    startedAt: input.startedAt,
  }).slice(0, 16);
  const domain = inferCanopyProofTelemetryDomain(route);
  const telemetrySeed = {
    service: "canopyproof-api" as const,
    requestId,
    edgeRequestId,
    traceId,
    parentSpanId: parsedTrace?.parentSpanId,
    spanId,
    sampled: parsedTrace?.sampled ?? false,
    generatedTraceContext: !parsedTrace,
    route,
    method,
    status: input.status,
    durationMs: Number.isFinite(input.durationMs)
      ? Math.min(86_400_000, Math.max(0, Math.round(input.durationMs)))
      : 0,
    domain,
    actorId,
    actorRole,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
  };
  const eventHash = hashJson({ kind: "canopyproof-request-telemetry-v1", ...telemetrySeed });
  return {
    service: telemetrySeed.service,
    requestId: telemetrySeed.requestId,
    ...(telemetrySeed.edgeRequestId ? { edgeRequestId: telemetrySeed.edgeRequestId } : {}),
    traceId: telemetrySeed.traceId,
    ...(telemetrySeed.parentSpanId ? { parentSpanId: telemetrySeed.parentSpanId } : {}),
    spanId: telemetrySeed.spanId,
    sampled: telemetrySeed.sampled,
    generatedTraceContext: telemetrySeed.generatedTraceContext,
    route: telemetrySeed.route,
    method: telemetrySeed.method,
    status: telemetrySeed.status,
    durationMs: telemetrySeed.durationMs,
    domain: telemetrySeed.domain,
    ...(telemetrySeed.actorId ? { actorId: telemetrySeed.actorId } : {}),
    ...(telemetrySeed.actorRole ? { actorRole: telemetrySeed.actorRole } : {}),
    startedAt: telemetrySeed.startedAt,
    endedAt: telemetrySeed.endedAt,
    eventHash,
  };
}

export function buildCanopyProofOpenTelemetrySpan(telemetry: CanopyProofRequestTelemetry): CanopyProofOpenTelemetrySpan {
  const resourceAttributes = [
    stringAttribute("service.name", "canopyproof-api"),
    stringAttribute("service.namespace", "dropin-earth"),
    stringAttribute("deployment.environment.name", "production-compatible"),
    stringAttribute("telemetry.sdk.name", "canopyproof-edge-otel"),
    stringAttribute("telemetry.sdk.language", "typescript"),
  ] as const;
  const spanAttributes = [
    stringAttribute("http.request.method", telemetry.method),
    stringAttribute("url.path", telemetry.route),
    intAttribute("http.response.status_code", telemetry.status),
    doubleAttribute("http.server.request.duration", telemetry.durationMs),
    stringAttribute("canopyproof.domain", telemetry.domain),
    stringAttribute(
      "canopyproof.request_id_hash",
      hashJson({ kind: "canopyproof-telemetry-request-id-v1", requestId: telemetry.requestId }),
    ),
    stringAttribute("canopyproof.telemetry_event_hash", telemetry.eventHash),
    boolAttribute("canopyproof.generated_trace_context", telemetry.generatedTraceContext),
    ...(telemetry.edgeRequestId
      ? [
          stringAttribute(
            "canopyproof.edge_request_id_hash",
            hashJson({ kind: "canopyproof-telemetry-edge-request-id-v1", edgeRequestId: telemetry.edgeRequestId }),
          ),
        ]
      : []),
  ] as const;
  const spanBase = {
    resource: {
      attributes: resourceAttributes,
    },
    scope: {
      name: "canopyproof-api" as const,
      version: "canopyproof-observability-v1" as const,
    },
    traceId: telemetry.traceId,
    spanId: telemetry.spanId,
    ...(telemetry.parentSpanId ? { parentSpanId: telemetry.parentSpanId } : {}),
    name: `${telemetry.method} ${telemetry.route}`,
    kind: "SPAN_KIND_SERVER" as const,
    startTimeUnixNano: isoToUnixNano(telemetry.startedAt),
    endTimeUnixNano: isoToUnixNano(telemetry.endedAt),
    status: {
      code: telemetry.status >= 500 ? ("STATUS_CODE_ERROR" as const) : telemetry.status >= 400 ? ("STATUS_CODE_UNSET" as const) : ("STATUS_CODE_OK" as const),
    },
    attributes: spanAttributes,
    droppedAttributesCount: 0 as const,
  };
  return {
    ...spanBase,
    spanHash: hashJson({ hashKind: "canopyproof-opentelemetry-span-v1", ...spanBase }),
  };
}

export function renderCanopyProofMetrics(status: CanopyProofObservabilityStatus): string {
  const exporter = status.openTelemetry.exporter;
  const lines = [
    "# HELP canopyproof_observability_service_up CanopyProof observability contract is loaded.",
    "# TYPE canopyproof_observability_service_up gauge",
    "canopyproof_observability_service_up 1",
    "# HELP canopyproof_service_health Service health by CanopyProof bounded context.",
    "# TYPE canopyproof_service_health gauge",
  ];

  for (const health of status.serviceHealth) {
    lines.push(`canopyproof_service_health{service="${escapeLabel(health.service)}"} ${health.ok ? 1 : 0}`);
  }

  lines.push("# HELP canopyproof_critical_routes_total Critical routes covered by production alert policy.");
  lines.push("# TYPE canopyproof_critical_routes_total gauge");
  lines.push(`canopyproof_critical_routes_total ${status.alerts.criticalRoutes.length}`);
  lines.push("# HELP canopyproof_otel_exporter_enabled Whether OTLP export activation was requested.");
  lines.push("# TYPE canopyproof_otel_exporter_enabled gauge");
  lines.push(`canopyproof_otel_exporter_enabled ${exporter.enabled ? 1 : 0}`);
  lines.push("# HELP canopyproof_otel_exporter_ready Whether strict OTLP exporter configuration is ready.");
  lines.push("# TYPE canopyproof_otel_exporter_ready gauge");
  lines.push(`canopyproof_otel_exporter_ready ${exporter.ready ? 1 : 0}`);
  lines.push("# HELP canopyproof_otel_exporter_queue_depth API spans currently waiting in the bounded exporter queue.");
  lines.push("# TYPE canopyproof_otel_exporter_queue_depth gauge");
  lines.push(`canopyproof_otel_exporter_queue_depth ${exporter.queueDepth}`);
  lines.push("# HELP canopyproof_otel_exporter_in_flight_spans API spans in the current OTLP batch.");
  lines.push("# TYPE canopyproof_otel_exporter_in_flight_spans gauge");
  lines.push(`canopyproof_otel_exporter_in_flight_spans ${exporter.inFlightSpanCount}`);
  lines.push("# HELP canopyproof_otel_exporter_accepted_total API spans accepted by the process-local exporter.");
  lines.push("# TYPE canopyproof_otel_exporter_accepted_total counter");
  lines.push(`canopyproof_otel_exporter_accepted_total ${exporter.acceptedTotal}`);
  lines.push("# HELP canopyproof_otel_exporter_exported_total API spans accepted by the OTLP transport endpoint.");
  lines.push("# TYPE canopyproof_otel_exporter_exported_total counter");
  lines.push(`canopyproof_otel_exporter_exported_total ${exporter.exportedTotal}`);
  lines.push("# HELP canopyproof_otel_exporter_sampled_out_total API spans excluded by deterministic sampling.");
  lines.push("# TYPE canopyproof_otel_exporter_sampled_out_total counter");
  lines.push(`canopyproof_otel_exporter_sampled_out_total ${exporter.sampledOutTotal}`);
  lines.push("# HELP canopyproof_otel_exporter_dropped_total API spans dropped by disabled, invalid, bounded, or failed export paths.");
  lines.push("# TYPE canopyproof_otel_exporter_dropped_total counter");
  lines.push(
    `canopyproof_otel_exporter_dropped_total ${
      exporter.disabledDropTotal +
      exporter.invalidConfigurationDropTotal +
      exporter.queueFullDropTotal +
      exporter.oversizedDropTotal +
      exporter.failedDropTotal
    }`,
  );
  lines.push("# HELP canopyproof_otel_exporter_disabled_drop_total API spans not exported while activation is disabled.");
  lines.push("# TYPE canopyproof_otel_exporter_disabled_drop_total counter");
  lines.push(`canopyproof_otel_exporter_disabled_drop_total ${exporter.disabledDropTotal}`);
  lines.push("# HELP canopyproof_otel_exporter_invalid_configuration_drop_total API spans rejected by invalid exporter configuration.");
  lines.push("# TYPE canopyproof_otel_exporter_invalid_configuration_drop_total counter");
  lines.push(`canopyproof_otel_exporter_invalid_configuration_drop_total ${exporter.invalidConfigurationDropTotal}`);
  lines.push("# HELP canopyproof_otel_exporter_queue_full_drop_total API spans dropped by the finite queue limit.");
  lines.push("# TYPE canopyproof_otel_exporter_queue_full_drop_total counter");
  lines.push(`canopyproof_otel_exporter_queue_full_drop_total ${exporter.queueFullDropTotal}`);
  lines.push("# HELP canopyproof_otel_exporter_oversized_drop_total API spans dropped by the finite payload limit.");
  lines.push("# TYPE canopyproof_otel_exporter_oversized_drop_total counter");
  lines.push(`canopyproof_otel_exporter_oversized_drop_total ${exporter.oversizedDropTotal}`);
  lines.push("# HELP canopyproof_otel_exporter_failed_drop_total API spans dropped after permanent or exhausted transport failure.");
  lines.push("# TYPE canopyproof_otel_exporter_failed_drop_total counter");
  lines.push(`canopyproof_otel_exporter_failed_drop_total ${exporter.failedDropTotal}`);
  lines.push("# HELP canopyproof_otel_exporter_retry_total Bounded OTLP transport retry attempts.");
  lines.push("# TYPE canopyproof_otel_exporter_retry_total counter");
  lines.push(`canopyproof_otel_exporter_retry_total ${exporter.retryTotal}`);
  const criticalRiskAlerts = status.serviceHealth.find((health) => health.service === "canopyproof-early-warning")?.indicators.criticalAlertCount;
  const riskAlertDispatchReceipts = status.serviceHealth.find((health) => health.service === "canopyproof-early-warning")?.indicators.dispatchReceiptCount;
  const riskResponseActivations = status.serviceHealth.find((health) => health.service === "canopyproof-early-warning")?.indicators.responseActivationCount;
  const riskResponseClosures = status.serviceHealth.find((health) => health.service === "canopyproof-early-warning")?.indicators.responseClosureCount;
  const riskAfterActionReviews = status.serviceHealth.find((health) => health.service === "canopyproof-early-warning")?.indicators.afterActionReviewCount;
  const openProofChallenges = status.serviceHealth.find((health) => health.service === "canopyproof-os-proof-engine")?.indicators.openProofRecordChallengeCount;
  const abuseSignals = status.serviceHealth.find((health) => health.service === "canopyproof-security-policy")?.indicators.abuseSignalCount;
  const failedResilienceDrills = status.serviceHealth.find((health) => health.service === "canopyproof-resilience")?.indicators.failedDrillCount;
  const recoveryResilienceDrills = status.serviceHealth.find((health) => health.service === "canopyproof-resilience")?.indicators.recoveryDrillCount;
  const governanceConflicts = status.serviceHealth.find((health) => health.service === "canopyproof-governance")?.indicators.unresolvedConflictCount;
  const mediaObjects = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.mediaObjectCount;
  const quarantinedMediaObjects = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.quarantinedMediaObjectCount;
  const pendingScanMediaObjects = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.pendingScanMediaObjectCount;
  const revokedConsentReceipts = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.revokedConsentReceiptCount;
  const riskyDeviceAttestations = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.riskyDeviceAttestationCount;
  const metadataExtractionsNeedingReview = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.metadataExtractionNeedsReviewCount;
  const openEvidenceReviewTasks = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.openEvidenceReviewTaskCount;
  const escalatedEvidenceReviewTasks = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.escalatedEvidenceReviewTaskCount;
  const retentionMinimizationDecisions = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.retentionMinimizationDecisionCount;
  const verificationQueueDepth = status.serviceHealth.find((health) => health.service === "canopyproof-verification-queue")?.indicators.queuedWorkItemCount;
  const verificationQueueBlocked = status.serviceHealth.find((health) => health.service === "canopyproof-verification-queue")?.indicators.blockedWorkItemCount;
  const verificationQueueEscalated = status.serviceHealth.find((health) => health.service === "canopyproof-verification-queue")?.indicators.escalatedWorkItemCount;
  const verificationQueueBackpressure = status.serviceHealth.find((health) => health.service === "canopyproof-verification-queue")?.indicators.backpressureActive;
  const verificationQueueUtilization = status.serviceHealth.find((health) => health.service === "canopyproof-verification-queue")?.indicators.queueUtilizationPercent;
  const offlineSyncBatches = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.offlineSyncBatchCount;
  const offlineSyncConflicts = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.offlineSyncConflictCount;
  const custodyEvents = status.serviceHealth.find((health) => health.service === "canopyproof-evidence-network")?.indicators.custodyEventCount;
  const revokedDataSharingAgreements = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.revokedDataSharingAgreementCount;
  const dataSharingAgreementRevocations = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataSharingAgreementRevocationCount;
  const supersededDataSharingAgreements = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.supersededDataSharingAgreementCount;
  const dataSharingAgreementSupersessions = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataSharingAgreementSupersessionCount;
  const dataAccessRequests = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataAccessRequestCount;
  const pendingDataAccessRequests = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.pendingDataAccessRequestCount;
  const approvedDataAccessRequests = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.approvedDataAccessRequestCount;
  const dataAccessDeliveryReceipts = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataAccessDeliveryReceiptCount;
  const dataUseAttestations = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataUseAttestationCount;
  const challengedDataUseAttestations = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.challengedDataUseAttestationCount;
  const dataUseEnforcementCases = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataUseEnforcementCaseCount;
  const openDataUseEnforcementCases = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.openDataUseEnforcementCaseCount;
  const dataAccessRestrictions = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataAccessRestrictionCount;
  const activeDataAccessRestrictions = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.activeDataAccessRestrictionCount;
  const dataAccessAccountabilityPackets = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataAccessAccountabilityPacketCount;
  const dataAccessAccountabilityVerifications = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataAccessAccountabilityVerificationCount;
  const failedDataAccessAccountabilityVerifications = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.failedDataAccessAccountabilityVerificationCount;
  const dataAccessAccountabilityDisclosures = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataAccessAccountabilityDisclosureCount;
  const staleDataAccessAccountabilityDisclosures = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.staleDataAccessAccountabilityDisclosureCount;
  const dataAccessAccountabilityDisclosureChallenges = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataAccessAccountabilityDisclosureChallengeCount;
  const openDataAccessAccountabilityDisclosureChallenges = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.openDataAccessAccountabilityDisclosureChallengeCount;
  const dataAccessAccountabilityDisclosureResolutions = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataAccessAccountabilityDisclosureResolutionCount;
  const dataAccessAccountabilityDisclosureNotices = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.dataAccessAccountabilityDisclosureNoticeCount;
  const withdrawnDataAccessAccountabilityDisclosures = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.withdrawnDataAccessAccountabilityDisclosureCount;
  const correctedDataAccessAccountabilityDisclosures = status.serviceHealth.find((health) => health.service === "canopyproof-partner-collaboration")?.indicators.correctedDataAccessAccountabilityDisclosureCount;
  const databaseAuditMaxEvents = status.serviceHealth.find((health) => health.service === "canopyproof-database-audit-transparency")?.indicators.maxEventsPerVerification;
  const databaseAuditHashOnly = status.serviceHealth.find((health) => health.service === "canopyproof-database-audit-transparency")?.indicators.hashOnlyInput;
  lines.push("# HELP canopyproof_early_warning_critical_alerts Critical CanopyProof environmental risk alerts awaiting response.");
  lines.push("# TYPE canopyproof_early_warning_critical_alerts gauge");
  lines.push(`canopyproof_early_warning_critical_alerts ${typeof criticalRiskAlerts === "number" ? criticalRiskAlerts : 0}`);
  lines.push("# HELP canopyproof_early_warning_dispatch_receipts Audience-scoped early-warning alert delivery receipts.");
  lines.push("# TYPE canopyproof_early_warning_dispatch_receipts gauge");
  lines.push(`canopyproof_early_warning_dispatch_receipts ${typeof riskAlertDispatchReceipts === "number" ? riskAlertDispatchReceipts : 0}`);
  lines.push("# HELP canopyproof_early_warning_response_activations Audited early-warning response playbook activations.");
  lines.push("# TYPE canopyproof_early_warning_response_activations gauge");
  lines.push(`canopyproof_early_warning_response_activations ${typeof riskResponseActivations === "number" ? riskResponseActivations : 0}`);
  lines.push("# HELP canopyproof_early_warning_response_closures Human-reviewed early-warning response closure or challenge records.");
  lines.push("# TYPE canopyproof_early_warning_response_closures gauge");
  lines.push(`canopyproof_early_warning_response_closures ${typeof riskResponseClosures === "number" ? riskResponseClosures : 0}`);
  lines.push("# HELP canopyproof_early_warning_after_action_reviews Evidence-bound post-incident early-warning after-action reviews.");
  lines.push("# TYPE canopyproof_early_warning_after_action_reviews gauge");
  lines.push(`canopyproof_early_warning_after_action_reviews ${typeof riskAfterActionReviews === "number" ? riskAfterActionReviews : 0}`);
  lines.push("# HELP canopyproof_proof_record_open_challenges Public challenges opened against Environmental Proof Records.");
  lines.push("# TYPE canopyproof_proof_record_open_challenges gauge");
  lines.push(`canopyproof_proof_record_open_challenges ${typeof openProofChallenges === "number" ? openProofChallenges : 0}`);
  lines.push("# HELP canopyproof_security_abuse_signals Security policy abuse signals awaiting review.");
  lines.push("# TYPE canopyproof_security_abuse_signals gauge");
  lines.push(`canopyproof_security_abuse_signals ${typeof abuseSignals === "number" ? abuseSignals : 0}`);
  lines.push("# HELP canopyproof_resilience_failed_drills CanopyProof resilience drills that exposed an unsafe fail-closed violation.");
  lines.push("# TYPE canopyproof_resilience_failed_drills gauge");
  lines.push(`canopyproof_resilience_failed_drills ${typeof failedResilienceDrills === "number" ? failedResilienceDrills : 0}`);
  lines.push("# HELP canopyproof_resilience_recovery_drills CanopyProof resilience drills that require recovery work before promotion.");
  lines.push("# TYPE canopyproof_resilience_recovery_drills gauge");
  lines.push(`canopyproof_resilience_recovery_drills ${typeof recoveryResilienceDrills === "number" ? recoveryResilienceDrills : 0}`);
  lines.push("# HELP canopyproof_governance_unresolved_conflicts Governance conflict disclosures not yet cleared or waived.");
  lines.push("# TYPE canopyproof_governance_unresolved_conflicts gauge");
  lines.push(`canopyproof_governance_unresolved_conflicts ${typeof governanceConflicts === "number" ? governanceConflicts : 0}`);
  lines.push("# HELP canopyproof_evidence_media_objects Content-addressed evidence media objects confirmed in object storage.");
  lines.push("# TYPE canopyproof_evidence_media_objects gauge");
  lines.push(`canopyproof_evidence_media_objects ${typeof mediaObjects === "number" ? mediaObjects : 0}`);
  lines.push("# HELP canopyproof_evidence_quarantined_media_objects Evidence media objects blocked by malware or integrity review.");
  lines.push("# TYPE canopyproof_evidence_quarantined_media_objects gauge");
  lines.push(`canopyproof_evidence_quarantined_media_objects ${typeof quarantinedMediaObjects === "number" ? quarantinedMediaObjects : 0}`);
  lines.push("# HELP canopyproof_evidence_pending_scan_media_objects Evidence media objects awaiting malware scan completion.");
  lines.push("# TYPE canopyproof_evidence_pending_scan_media_objects gauge");
  lines.push(`canopyproof_evidence_pending_scan_media_objects ${typeof pendingScanMediaObjects === "number" ? pendingScanMediaObjects : 0}`);
  lines.push("# HELP canopyproof_evidence_revoked_consent_receipts Consent receipts revoked for field evidence collection.");
  lines.push("# TYPE canopyproof_evidence_revoked_consent_receipts gauge");
  lines.push(`canopyproof_evidence_revoked_consent_receipts ${typeof revokedConsentReceipts === "number" ? revokedConsentReceipts : 0}`);
  lines.push("# HELP canopyproof_evidence_risky_device_attestations Device attestations with risk flags requiring review.");
  lines.push("# TYPE canopyproof_evidence_risky_device_attestations gauge");
  lines.push(`canopyproof_evidence_risky_device_attestations ${typeof riskyDeviceAttestations === "number" ? riskyDeviceAttestations : 0}`);
  lines.push("# HELP canopyproof_evidence_metadata_extractions_needing_review EXIF/GPS metadata extractions that cannot support clean proof without review.");
  lines.push("# TYPE canopyproof_evidence_metadata_extractions_needing_review gauge");
  lines.push(`canopyproof_evidence_metadata_extractions_needing_review ${typeof metadataExtractionsNeedingReview === "number" ? metadataExtractionsNeedingReview : 0}`);
  lines.push("# HELP canopyproof_evidence_open_review_tasks Evidence Network moderation review tasks awaiting human decision.");
  lines.push("# TYPE canopyproof_evidence_open_review_tasks gauge");
  lines.push(`canopyproof_evidence_open_review_tasks ${typeof openEvidenceReviewTasks === "number" ? openEvidenceReviewTasks : 0}`);
  lines.push("# HELP canopyproof_evidence_escalated_review_tasks Evidence Network moderation review tasks escalated to governance or senior verification.");
  lines.push("# TYPE canopyproof_evidence_escalated_review_tasks gauge");
  lines.push(`canopyproof_evidence_escalated_review_tasks ${typeof escalatedEvidenceReviewTasks === "number" ? escalatedEvidenceReviewTasks : 0}`);
  lines.push("# HELP canopyproof_evidence_retention_minimization_decisions Consent-bound evidence artifacts marked for minimization.");
  lines.push("# TYPE canopyproof_evidence_retention_minimization_decisions gauge");
  lines.push(`canopyproof_evidence_retention_minimization_decisions ${typeof retentionMinimizationDecisions === "number" ? retentionMinimizationDecisions : 0}`);
  lines.push("# HELP canopyproof_verification_queue_depth Verification work items queued for validation, AI, TerraProof, human review, or proof issuance.");
  lines.push("# TYPE canopyproof_verification_queue_depth gauge");
  lines.push(`canopyproof_verification_queue_depth ${typeof verificationQueueDepth === "number" ? verificationQueueDepth : 0}`);
  lines.push("# HELP canopyproof_verification_queue_blocked_work_items Verification work items blocked by unmet dependencies or policy checks.");
  lines.push("# TYPE canopyproof_verification_queue_blocked_work_items gauge");
  lines.push(`canopyproof_verification_queue_blocked_work_items ${typeof verificationQueueBlocked === "number" ? verificationQueueBlocked : 0}`);
  lines.push("# HELP canopyproof_verification_queue_escalated_work_items Verification work items escalated to human or governance review.");
  lines.push("# TYPE canopyproof_verification_queue_escalated_work_items gauge");
  lines.push(`canopyproof_verification_queue_escalated_work_items ${typeof verificationQueueEscalated === "number" ? verificationQueueEscalated : 0}`);
  lines.push("# HELP canopyproof_verification_queue_backpressure_active Verification queue is rejecting new work due to active-capacity pressure.");
  lines.push("# TYPE canopyproof_verification_queue_backpressure_active gauge");
  lines.push(`canopyproof_verification_queue_backpressure_active ${verificationQueueBackpressure === true || verificationQueueBackpressure === 1 ? 1 : 0}`);
  lines.push("# HELP canopyproof_verification_queue_utilization_percent Verification queue active utilization percentage.");
  lines.push("# TYPE canopyproof_verification_queue_utilization_percent gauge");
  lines.push(`canopyproof_verification_queue_utilization_percent ${typeof verificationQueueUtilization === "number" ? verificationQueueUtilization : 0}`);
  lines.push("# HELP canopyproof_evidence_offline_sync_batches Offline evidence sync batches accepted by the Evidence Collection Network.");
  lines.push("# TYPE canopyproof_evidence_offline_sync_batches gauge");
  lines.push(`canopyproof_evidence_offline_sync_batches ${typeof offlineSyncBatches === "number" ? offlineSyncBatches : 0}`);
  lines.push("# HELP canopyproof_evidence_offline_sync_conflicts Offline evidence sync items that conflicted with existing evidence IDs.");
  lines.push("# TYPE canopyproof_evidence_offline_sync_conflicts gauge");
  lines.push(`canopyproof_evidence_offline_sync_conflicts ${typeof offlineSyncConflicts === "number" ? offlineSyncConflicts : 0}`);
  lines.push("# HELP canopyproof_evidence_custody_events Append-only Evidence Network chain-of-custody events.");
  lines.push("# TYPE canopyproof_evidence_custody_events gauge");
  lines.push(`canopyproof_evidence_custody_events ${typeof custodyEvents === "number" ? custodyEvents : 0}`);
  lines.push("# HELP canopyproof_partner_revoked_data_sharing_agreements Data-sharing agreements currently revoked through append-only governance records.");
  lines.push("# TYPE canopyproof_partner_revoked_data_sharing_agreements gauge");
  lines.push(`canopyproof_partner_revoked_data_sharing_agreements ${typeof revokedDataSharingAgreements === "number" ? revokedDataSharingAgreements : 0}`);
  lines.push("# HELP canopyproof_partner_data_sharing_agreement_revocations Append-only partner data-sharing agreement revocation records.");
  lines.push("# TYPE canopyproof_partner_data_sharing_agreement_revocations gauge");
  lines.push(`canopyproof_partner_data_sharing_agreement_revocations ${typeof dataSharingAgreementRevocations === "number" ? dataSharingAgreementRevocations : 0}`);
  lines.push("# HELP canopyproof_partner_superseded_data_sharing_agreements Data-sharing agreements replaced by constrained successor agreements.");
  lines.push("# TYPE canopyproof_partner_superseded_data_sharing_agreements gauge");
  lines.push(`canopyproof_partner_superseded_data_sharing_agreements ${typeof supersededDataSharingAgreements === "number" ? supersededDataSharingAgreements : 0}`);
  lines.push("# HELP canopyproof_partner_data_sharing_agreement_supersessions Append-only partner data-sharing agreement renewal and supersession records.");
  lines.push("# TYPE canopyproof_partner_data_sharing_agreement_supersessions gauge");
  lines.push(`canopyproof_partner_data_sharing_agreement_supersessions ${typeof dataSharingAgreementSupersessions === "number" ? dataSharingAgreementSupersessions : 0}`);
  lines.push("# HELP canopyproof_partner_data_access_requests Governed organization data access requests bound to sharing agreements.");
  lines.push("# TYPE canopyproof_partner_data_access_requests gauge");
  lines.push(`canopyproof_partner_data_access_requests ${typeof dataAccessRequests === "number" ? dataAccessRequests : 0}`);
  lines.push("# HELP canopyproof_partner_pending_data_access_requests Governed organization data access requests awaiting human decision.");
  lines.push("# TYPE canopyproof_partner_pending_data_access_requests gauge");
  lines.push(`canopyproof_partner_pending_data_access_requests ${typeof pendingDataAccessRequests === "number" ? pendingDataAccessRequests : 0}`);
  lines.push("# HELP canopyproof_partner_approved_data_access_requests Governed organization data access requests approved by independent human reviewers.");
  lines.push("# TYPE canopyproof_partner_approved_data_access_requests gauge");
  lines.push(`canopyproof_partner_approved_data_access_requests ${typeof approvedDataAccessRequests === "number" ? approvedDataAccessRequests : 0}`);
  lines.push("# HELP canopyproof_partner_data_access_delivery_receipts Hash-only delivery receipts for approved partner data access.");
  lines.push("# TYPE canopyproof_partner_data_access_delivery_receipts gauge");
  lines.push(`canopyproof_partner_data_access_delivery_receipts ${typeof dataAccessDeliveryReceipts === "number" ? dataAccessDeliveryReceipts : 0}`);
  lines.push("# HELP canopyproof_partner_data_use_attestations Partner attestations over delivered data use and misuse challenges.");
  lines.push("# TYPE canopyproof_partner_data_use_attestations gauge");
  lines.push(`canopyproof_partner_data_use_attestations ${typeof dataUseAttestations === "number" ? dataUseAttestations : 0}`);
  lines.push("# HELP canopyproof_partner_challenged_data_use_attestations Partner data-use attestations that challenge misuse or request revocation.");
  lines.push("# TYPE canopyproof_partner_challenged_data_use_attestations gauge");
  lines.push(`canopyproof_partner_challenged_data_use_attestations ${typeof challengedDataUseAttestations === "number" ? challengedDataUseAttestations : 0}`);
  lines.push("# HELP canopyproof_partner_data_use_enforcement_cases Independent human-reviewed response cases opened from partner data-use challenges.");
  lines.push("# TYPE canopyproof_partner_data_use_enforcement_cases gauge");
  lines.push(`canopyproof_partner_data_use_enforcement_cases ${typeof dataUseEnforcementCases === "number" ? dataUseEnforcementCases : 0}`);
  lines.push("# HELP canopyproof_partner_open_data_use_enforcement_cases Data-use enforcement cases not yet resolved or rejected.");
  lines.push("# TYPE canopyproof_partner_open_data_use_enforcement_cases gauge");
  lines.push(`canopyproof_partner_open_data_use_enforcement_cases ${typeof openDataUseEnforcementCases === "number" ? openDataUseEnforcementCases : 0}`);
  lines.push("# HELP canopyproof_partner_data_access_restrictions Separate-approval data access restriction records bound to enforcement cases.");
  lines.push("# TYPE canopyproof_partner_data_access_restrictions gauge");
  lines.push(`canopyproof_partner_data_access_restrictions ${typeof dataAccessRestrictions === "number" ? dataAccessRestrictions : 0}`);
  lines.push("# HELP canopyproof_partner_active_data_access_restrictions Currently active partner data access restrictions blocking future deliveries.");
  lines.push("# TYPE canopyproof_partner_active_data_access_restrictions gauge");
  lines.push(`canopyproof_partner_active_data_access_restrictions ${typeof activeDataAccessRestrictions === "number" ? activeDataAccessRestrictions : 0}`);
  lines.push("# HELP canopyproof_partner_data_access_accountability_packets Hash-rooted partner data access accountability packets generated for institutional review.");
  lines.push("# TYPE canopyproof_partner_data_access_accountability_packets gauge");
  lines.push(`canopyproof_partner_data_access_accountability_packets ${typeof dataAccessAccountabilityPackets === "number" ? dataAccessAccountabilityPackets : 0}`);
  lines.push("# HELP canopyproof_partner_data_access_accountability_verifications Replay verification attempts for partner accountability packets.");
  lines.push("# TYPE canopyproof_partner_data_access_accountability_verifications gauge");
  lines.push(`canopyproof_partner_data_access_accountability_verifications ${typeof dataAccessAccountabilityVerifications === "number" ? dataAccessAccountabilityVerifications : 0}`);
  lines.push("# HELP canopyproof_partner_failed_data_access_accountability_verifications Accountability packet replay verifications with stale or mismatched lineage.");
  lines.push("# TYPE canopyproof_partner_failed_data_access_accountability_verifications gauge");
  lines.push(
    `canopyproof_partner_failed_data_access_accountability_verifications ${typeof failedDataAccessAccountabilityVerifications === "number" ? failedDataAccessAccountabilityVerifications : 0}`,
  );
  lines.push("# HELP canopyproof_partner_data_access_accountability_disclosures Public hash-only partner accountability packet disclosures.");
  lines.push("# TYPE canopyproof_partner_data_access_accountability_disclosures gauge");
  lines.push(`canopyproof_partner_data_access_accountability_disclosures ${typeof dataAccessAccountabilityDisclosures === "number" ? dataAccessAccountabilityDisclosures : 0}`);
  lines.push("# HELP canopyproof_partner_stale_data_access_accountability_disclosures Published accountability disclosures whose source packet lineage has changed.");
  lines.push("# TYPE canopyproof_partner_stale_data_access_accountability_disclosures gauge");
  lines.push(`canopyproof_partner_stale_data_access_accountability_disclosures ${typeof staleDataAccessAccountabilityDisclosures === "number" ? staleDataAccessAccountabilityDisclosures : 0}`);
  lines.push("# HELP canopyproof_partner_data_access_accountability_disclosure_challenges Append-only public challenges against partner accountability disclosures.");
  lines.push("# TYPE canopyproof_partner_data_access_accountability_disclosure_challenges gauge");
  lines.push(`canopyproof_partner_data_access_accountability_disclosure_challenges ${typeof dataAccessAccountabilityDisclosureChallenges === "number" ? dataAccessAccountabilityDisclosureChallenges : 0}`);
  lines.push("# HELP canopyproof_partner_open_data_access_accountability_disclosure_challenges Disclosure challenges awaiting final independent human resolution.");
  lines.push("# TYPE canopyproof_partner_open_data_access_accountability_disclosure_challenges gauge");
  lines.push(`canopyproof_partner_open_data_access_accountability_disclosure_challenges ${typeof openDataAccessAccountabilityDisclosureChallenges === "number" ? openDataAccessAccountabilityDisclosureChallenges : 0}`);
  lines.push("# HELP canopyproof_partner_data_access_accountability_disclosure_resolutions Independent human review records for public disclosure challenges.");
  lines.push("# TYPE canopyproof_partner_data_access_accountability_disclosure_resolutions gauge");
  lines.push(`canopyproof_partner_data_access_accountability_disclosure_resolutions ${typeof dataAccessAccountabilityDisclosureResolutions === "number" ? dataAccessAccountabilityDisclosureResolutions : 0}`);
  lines.push("# HELP canopyproof_partner_data_access_accountability_disclosure_notices Public correction and withdrawal notices preserving original disclosure history.");
  lines.push("# TYPE canopyproof_partner_data_access_accountability_disclosure_notices gauge");
  lines.push(`canopyproof_partner_data_access_accountability_disclosure_notices ${typeof dataAccessAccountabilityDisclosureNotices === "number" ? dataAccessAccountabilityDisclosureNotices : 0}`);
  lines.push("# HELP canopyproof_partner_withdrawn_data_access_accountability_disclosures Public accountability disclosures with appended withdrawal notices.");
  lines.push("# TYPE canopyproof_partner_withdrawn_data_access_accountability_disclosures gauge");
  lines.push(`canopyproof_partner_withdrawn_data_access_accountability_disclosures ${typeof withdrawnDataAccessAccountabilityDisclosures === "number" ? withdrawnDataAccessAccountabilityDisclosures : 0}`);
  lines.push("# HELP canopyproof_partner_corrected_data_access_accountability_disclosures Public accountability disclosures linked to current replacement disclosures.");
  lines.push("# TYPE canopyproof_partner_corrected_data_access_accountability_disclosures gauge");
  lines.push(`canopyproof_partner_corrected_data_access_accountability_disclosures ${typeof correctedDataAccessAccountabilityDisclosures === "number" ? correctedDataAccessAccountabilityDisclosures : 0}`);
  lines.push("# HELP canopyproof_database_audit_transparency_enabled Database mutation streams use hash-only, independently replayable v2 audit events.");
  lines.push("# TYPE canopyproof_database_audit_transparency_enabled gauge");
  lines.push(`canopyproof_database_audit_transparency_enabled ${databaseAuditHashOnly === true || databaseAuditHashOnly === 1 ? 1 : 0}`);
  lines.push("# HELP canopyproof_database_audit_verification_max_events Maximum events accepted by one bounded independent database audit replay.");
  lines.push("# TYPE canopyproof_database_audit_verification_max_events gauge");
  lines.push(`canopyproof_database_audit_verification_max_events ${typeof databaseAuditMaxEvents === "number" ? databaseAuditMaxEvents : 0}`);
  lines.push("# HELP canopyproof_telemetry_root_info Hash root for the observability contract snapshot.");
  lines.push("# TYPE canopyproof_telemetry_root_info gauge");
  lines.push(`canopyproof_telemetry_root_info{telemetry_root="${status.telemetryRoot}"} 1`);

  return lines.join("\n");
}

function stringAttribute(key: string, value: string): CanopyProofOpenTelemetryAttribute {
  return { key, value: { stringValue: value } };
}

function intAttribute(key: string, value: number): CanopyProofOpenTelemetryAttribute {
  return { key, value: { intValue: String(Math.trunc(value)) } };
}

function doubleAttribute(key: string, value: number): CanopyProofOpenTelemetryAttribute {
  return { key, value: { doubleValue: value } };
}

function boolAttribute(key: string, value: boolean): CanopyProofOpenTelemetryAttribute {
  return { key, value: { boolValue: value } };
}

function isoToUnixNano(iso: string) {
  const milliseconds = Date.parse(iso);
  if (!Number.isFinite(milliseconds)) {
    return "0";
  }
  return (BigInt(milliseconds) * 1_000_000n).toString();
}

export function serviceHealth(service: string, indicators: Readonly<Record<string, number | string | boolean>>): CanopyProofServiceHealth {
  return {
    service,
    ok: Object.values(indicators).every((value) => {
      if (typeof value === "number") return Number.isFinite(value) && value >= 0;
      if (typeof value === "string") return value.length > 0;
      return value;
    }),
    indicators,
  };
}

function escapeLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function inferCanopyProofTelemetryDomain(route: string) {
  if (route.startsWith("/canopyproof/evidence")) return "evidence";
  if (route.startsWith("/canopyproof/verification")) return "verification";
  if (route.startsWith("/canopyproof/governance")) return "governance";
  if (route.startsWith("/canopyproof/reports")) return "reporting";
  if (route.startsWith("/canopyproof/terra")) return "terra";
  if (route.startsWith("/canopyproof/funding")) return "funding";
  if (route.startsWith("/canopyproof/risk")) return "risk";
  if (route.startsWith("/canopyproof/organizations") || route.startsWith("/canopyproof/partners")) return "partners";
  if (route.startsWith("/canopyproof/security")) return "security";
  if (route.startsWith("/canopyproof/resilience")) return "resilience";
  if (route.startsWith("/canopyproof/observability") || route === "/metrics") return "observability";
  if (route.startsWith("/canopyproof/")) return "canopyproof";
  return "dropin-api";
}

export function canopyProofTelemetryRouteTemplate(requestPath: string, matchedRoutePath?: string) {
  if (matchedRoutePath && matchedRoutePath !== "*" && matchedRoutePath.length <= 512) {
    return matchedRoutePath;
  }
  if (["/health", "/ready", "/metrics"].includes(requestPath)) return requestPath;
  const segments = requestPath.split("/").filter(Boolean);
  if (segments[0] === "canopyproof") {
    const boundedContext = segments[1];
    if (boundedContext && /^[a-z0-9-]{1,64}$/.test(boundedContext)) {
      return `/canopyproof/${boundedContext}/*`;
    }
    return "/canopyproof/*";
  }
  return "/*";
}

function boundedTelemetryValue(value: string, maxLength: number, label: string) {
  const normalized = [...value]
    .map((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127 ? "?" : character;
    })
    .join("");
  if (normalized.length <= maxLength) return normalized;
  const suffix = hashJson({ kind: "canopyproof-bounded-telemetry-value-v1", label, value: normalized }).slice(0, 16);
  return `${normalized.slice(0, Math.max(0, maxLength - suffix.length - 1))}~${suffix}`;
}
