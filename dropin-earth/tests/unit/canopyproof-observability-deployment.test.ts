import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  buildCanopyProofObservabilityStatus,
  buildCanopyProofOpenTelemetrySpan,
  buildCanopyProofRequestTelemetry,
  canopyProofTelemetryRouteTemplate,
  parseCanopyProofTraceparent,
  renderCanopyProofMetrics,
  serviceHealth,
} from "../../services/api/src/domain/canopyproof/observability.js";
import { app } from "../../services/api/src/app.js";

function headers(role: string, actorId = `${role}_observability_actor`) {
  return {
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test("CanopyProof observability status is hash-rooted and renders Prometheus metrics", () => {
  const status = buildCanopyProofObservabilityStatus([
    serviceHealth("canopyproof-os-proof-engine", {
      evidenceCount: 2,
      proofRecordCount: 1,
      openProofRecordChallengeCount: 1,
    }),
    serviceHealth("canopyproof-early-warning", {
      activeAlertCount: 3,
      criticalAlertCount: 1,
      dispatchReceiptCount: 2,
      responseActivationCount: 1,
      responseClosureCount: 1,
      afterActionReviewCount: 1,
    }),
    serviceHealth("canopyproof-security-policy", {
      abuseSignalCount: 2,
      policyCount: 4,
    }),
    serviceHealth("canopyproof-resilience", {
      drillCount: 2,
      failedDrillCount: 1,
      recoveryDrillCount: 1,
      databaseFailureDrillCount: 1,
      apiOutageDrillCount: 1,
      failClosedSafe: false,
    }),
    serviceHealth("canopyproof-governance", {
      policyCount: 5,
      approvalCount: 1,
      conflictDisclosureCount: 1,
      unresolvedConflictCount: 1,
    }),
    serviceHealth("canopyproof-database-audit-transparency", {
      maxEventsPerVerification: 1000,
      hashOnlyInput: true,
      rawRowsExcluded: true,
      sequenceContinuityChecked: true,
      independentReplayRequired: true,
    }),
    serviceHealth("canopyproof-partner-collaboration", {
      organizationCount: 2,
      activePartnerCount: 1,
      membershipCount: 3,
      accreditationCount: 1,
      dataSharingAgreementCount: 1,
      revokedDataSharingAgreementCount: 1,
      dataSharingAgreementRevocationCount: 1,
      supersededDataSharingAgreementCount: 1,
      dataSharingAgreementSupersessionCount: 1,
      dataAccessRequestCount: 4,
      pendingDataAccessRequestCount: 2,
      approvedDataAccessRequestCount: 1,
      dataAccessDeliveryReceiptCount: 3,
      dataUseAttestationCount: 5,
      challengedDataUseAttestationCount: 2,
      dataUseEnforcementCaseCount: 3,
      openDataUseEnforcementCaseCount: 2,
      revokedDataUseEnforcementCaseCount: 1,
      dataAccessRestrictionCount: 2,
      activeDataAccessRestrictionCount: 1,
      revokedDataAccessRestrictionCount: 1,
      dataAccessAccountabilityPacketCount: 4,
      dataAccessAccountabilityVerificationCount: 6,
      failedDataAccessAccountabilityVerificationCount: 2,
      dataAccessAccountabilityDisclosureCount: 2,
      staleDataAccessAccountabilityDisclosureCount: 1,
      dataAccessAccountabilityDisclosureChallengeCount: 3,
      openDataAccessAccountabilityDisclosureChallengeCount: 1,
      dataAccessAccountabilityDisclosureResolutionCount: 2,
      dataAccessAccountabilityDisclosureNoticeCount: 1,
      withdrawnDataAccessAccountabilityDisclosureCount: 1,
      correctedDataAccessAccountabilityDisclosureCount: 0,
    }),
    serviceHealth("canopyproof-evidence-network", {
      mediaObjectCount: 5,
      quarantinedMediaObjectCount: 1,
      pendingScanMediaObjectCount: 2,
      duplicateMediaObjectCount: 1,
      consentReceiptCount: 6,
      revokedConsentReceiptCount: 1,
      deviceAttestationCount: 4,
      riskyDeviceAttestationCount: 2,
      mediaMetadataExtractionCount: 7,
      metadataExtractionNeedsReviewCount: 3,
      evidenceReviewTaskCount: 8,
      openEvidenceReviewTaskCount: 4,
      escalatedEvidenceReviewTaskCount: 1,
      retentionPolicyDecisionCount: 5,
      retentionMinimizationDecisionCount: 2,
      offlineSyncBatchCount: 3,
      offlineSyncConflictCount: 1,
      communityAttestationCount: 4,
      custodyEventCount: 3,
    }),
    serviceHealth("canopyproof-verification-queue", {
      capacity: 10,
      totalWorkItemCount: 8,
      queuedWorkItemCount: 3,
      runningWorkItemCount: 1,
      blockedWorkItemCount: 2,
      escalatedWorkItemCount: 1,
      completedWorkItemCount: 1,
      criticalWorkItemCount: 1,
      backpressureActive: 1,
      queueUtilizationPercent: 70,
    }),
  ]);

  assert.equal(status.openTelemetry.serviceName, "canopyproof-api");
  assert.equal(status.openTelemetry.spanModelEnabled, true);
  assert.equal(status.openTelemetry.traceHeader, "traceparent");
  assert.equal(status.openTelemetry.edgeRequestHeader, "x-dropin-edge-request-id");
  assert.equal(status.openTelemetry.spanHashHeader, "x-dropin-otel-span-hash");
  assert.equal(status.openTelemetry.protocol, "otlp-http");
  assert.equal(status.openTelemetry.semanticConvention, "opentelemetry-semconv-http-server");
  assert.equal(status.openTelemetry.exporter.mode, "disabled");
  assert.equal(status.openTelemetry.exporter.ready, false);
  assert.equal(status.dependencies.postgresql, "required");
  assert.equal(status.dependencies.objectStorage, "required");
  assert.ok(status.telemetryRoot.length >= 64);

  const metrics = renderCanopyProofMetrics(status);
  assert.match(metrics, /canopyproof_observability_service_up 1/);
  assert.match(metrics, /canopyproof_otel_exporter_enabled 0/);
  assert.match(metrics, /canopyproof_otel_exporter_ready 0/);
  assert.match(metrics, /canopyproof_otel_exporter_queue_depth 0/);
  assert.match(metrics, /canopyproof_otel_exporter_in_flight_spans 0/);
  assert.match(metrics, /canopyproof_otel_exporter_accepted_total 0/);
  assert.match(metrics, /canopyproof_otel_exporter_exported_total 0/);
  assert.match(metrics, /canopyproof_otel_exporter_sampled_out_total 0/);
  assert.match(metrics, /canopyproof_otel_exporter_dropped_total 0/);
  assert.match(metrics, /canopyproof_otel_exporter_disabled_drop_total 0/);
  assert.match(metrics, /canopyproof_otel_exporter_invalid_configuration_drop_total 0/);
  assert.match(metrics, /canopyproof_otel_exporter_queue_full_drop_total 0/);
  assert.match(metrics, /canopyproof_otel_exporter_oversized_drop_total 0/);
  assert.match(metrics, /canopyproof_otel_exporter_failed_drop_total 0/);
  assert.match(metrics, /canopyproof_otel_exporter_retry_total 0/);
  assert.match(metrics, /canopyproof_service_health\{service="canopyproof-os-proof-engine"\} 1/);
  assert.match(metrics, /canopyproof_early_warning_critical_alerts 1/);
  assert.match(metrics, /canopyproof_early_warning_after_action_reviews 1/);
  assert.match(metrics, /canopyproof_proof_record_open_challenges 1/);
  assert.match(metrics, /canopyproof_security_abuse_signals 2/);
  assert.match(metrics, /canopyproof_resilience_failed_drills 1/);
  assert.match(metrics, /canopyproof_resilience_recovery_drills 1/);
  assert.match(metrics, /canopyproof_governance_unresolved_conflicts 1/);
  assert.match(metrics, /canopyproof_evidence_media_objects 5/);
  assert.match(metrics, /canopyproof_evidence_quarantined_media_objects 1/);
  assert.match(metrics, /canopyproof_evidence_pending_scan_media_objects 2/);
  assert.match(metrics, /canopyproof_evidence_revoked_consent_receipts 1/);
  assert.match(metrics, /canopyproof_evidence_risky_device_attestations 2/);
  assert.match(metrics, /canopyproof_evidence_metadata_extractions_needing_review 3/);
  assert.match(metrics, /canopyproof_evidence_open_review_tasks 4/);
  assert.match(metrics, /canopyproof_evidence_escalated_review_tasks 1/);
  assert.match(metrics, /canopyproof_evidence_retention_minimization_decisions 2/);
  assert.match(metrics, /canopyproof_verification_queue_depth 3/);
  assert.match(metrics, /canopyproof_verification_queue_blocked_work_items 2/);
  assert.match(metrics, /canopyproof_verification_queue_escalated_work_items 1/);
  assert.match(metrics, /canopyproof_verification_queue_backpressure_active 1/);
  assert.match(metrics, /canopyproof_verification_queue_utilization_percent 70/);
  assert.match(metrics, /canopyproof_evidence_offline_sync_batches 3/);
  assert.match(metrics, /canopyproof_evidence_offline_sync_conflicts 1/);
  assert.match(metrics, /canopyproof_evidence_custody_events 3/);
  assert.match(metrics, /canopyproof_partner_revoked_data_sharing_agreements 1/);
  assert.match(metrics, /canopyproof_partner_data_sharing_agreement_revocations 1/);
  assert.match(metrics, /canopyproof_partner_superseded_data_sharing_agreements 1/);
  assert.match(metrics, /canopyproof_partner_data_sharing_agreement_supersessions 1/);
  assert.match(metrics, /canopyproof_partner_data_access_requests 4/);
  assert.match(metrics, /canopyproof_partner_pending_data_access_requests 2/);
  assert.match(metrics, /canopyproof_partner_approved_data_access_requests 1/);
  assert.match(metrics, /canopyproof_partner_data_access_delivery_receipts 3/);
  assert.match(metrics, /canopyproof_partner_data_use_attestations 5/);
  assert.match(metrics, /canopyproof_partner_challenged_data_use_attestations 2/);
  assert.match(metrics, /canopyproof_partner_data_use_enforcement_cases 3/);
  assert.match(metrics, /canopyproof_partner_open_data_use_enforcement_cases 2/);
  assert.match(metrics, /canopyproof_partner_data_access_restrictions 2/);
  assert.match(metrics, /canopyproof_partner_active_data_access_restrictions 1/);
  assert.match(metrics, /canopyproof_partner_data_access_accountability_packets 4/);
  assert.match(metrics, /canopyproof_partner_data_access_accountability_verifications 6/);
  assert.match(metrics, /canopyproof_partner_failed_data_access_accountability_verifications 2/);
  assert.match(metrics, /canopyproof_partner_data_access_accountability_disclosures 2/);
  assert.match(metrics, /canopyproof_partner_stale_data_access_accountability_disclosures 1/);
  assert.match(metrics, /canopyproof_partner_data_access_accountability_disclosure_challenges 3/);
  assert.match(metrics, /canopyproof_partner_open_data_access_accountability_disclosure_challenges 1/);
  assert.match(metrics, /canopyproof_partner_data_access_accountability_disclosure_resolutions 2/);
  assert.match(metrics, /canopyproof_partner_data_access_accountability_disclosure_notices 1/);
  assert.match(metrics, /canopyproof_partner_withdrawn_data_access_accountability_disclosures 1/);
  assert.match(metrics, /canopyproof_partner_corrected_data_access_accountability_disclosures 0/);
  assert.match(metrics, /canopyproof_database_audit_transparency_enabled 1/);
  assert.match(metrics, /canopyproof_database_audit_verification_max_events 1000/);
  assert.match(metrics, /canopyproof_telemetry_root_info\{telemetry_root="[a-f0-9]{64}"/);
});

test("CanopyProof request telemetry parses W3C trace context and produces bounded span hashes", () => {
  const traceparent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
  const parsed = parseCanopyProofTraceparent(traceparent);

  assert.deepEqual(parsed, {
    traceId: "4bf92f3577b34da6a3ce929d0e0e4736",
    parentSpanId: "00f067aa0ba902b7",
    sampled: true,
    generated: false,
  });
  assert.equal(parseCanopyProofTraceparent("00-00000000000000000000000000000000-00f067aa0ba902b7-01"), undefined);
  assert.equal(parseCanopyProofTraceparent("invalid-traceparent"), undefined);

  const telemetry = buildCanopyProofRequestTelemetry({
    requestId: "edge-observability-test",
    edgeRequestId: "edge-observability-test",
    traceparent,
    route: "/canopyproof/evidence",
    method: "post",
    status: 202,
    durationMs: 12.4,
    actorId: "field_worker_001",
    actorRole: "community",
    startedAt: "2026-07-09T00:00:00.000Z",
    endedAt: "2026-07-09T00:00:00.012Z",
  });

  assert.equal(telemetry.service, "canopyproof-api");
  assert.equal(telemetry.requestId, "edge-observability-test");
  assert.equal(telemetry.traceId, "4bf92f3577b34da6a3ce929d0e0e4736");
  assert.equal(telemetry.parentSpanId, "00f067aa0ba902b7");
  assert.match(telemetry.spanId, /^[a-f0-9]{16}$/);
  assert.equal(telemetry.sampled, true);
  assert.equal(telemetry.generatedTraceContext, false);
  assert.equal(telemetry.method, "POST");
  assert.equal(telemetry.durationMs, 12);
  assert.equal(telemetry.domain, "evidence");
  assert.match(telemetry.eventHash, /^[a-f0-9]{64}$/);

  const otelSpan = buildCanopyProofOpenTelemetrySpan(telemetry);

  assert.equal(otelSpan.traceId, telemetry.traceId);
  assert.equal(otelSpan.spanId, telemetry.spanId);
  assert.equal(otelSpan.parentSpanId, telemetry.parentSpanId);
  assert.equal(otelSpan.name, "POST /canopyproof/evidence");
  assert.equal(otelSpan.kind, "SPAN_KIND_SERVER");
  assert.equal(otelSpan.status.code, "STATUS_CODE_OK");
  assert.equal(otelSpan.startTimeUnixNano, "1783555200000000000");
  assert.equal(otelSpan.endTimeUnixNano, "1783555200012000000");
  assert.match(otelSpan.spanHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(otelSpan.resource.attributes.find((attribute) => attribute.key === "service.name")?.value, { stringValue: "canopyproof-api" });
  assert.deepEqual(otelSpan.resource.attributes.find((attribute) => attribute.key === "service.namespace")?.value, { stringValue: "dropin-earth" });
  assert.deepEqual(otelSpan.attributes.find((attribute) => attribute.key === "http.request.method")?.value, { stringValue: "POST" });
  assert.deepEqual(otelSpan.attributes.find((attribute) => attribute.key === "http.response.status_code")?.value, { intValue: "202" });
  assert.deepEqual(otelSpan.attributes.find((attribute) => attribute.key === "canopyproof.domain")?.value, { stringValue: "evidence" });

  const generated = buildCanopyProofRequestTelemetry({
    requestId: "api-local-request",
    route: "/metrics",
    method: "GET",
    status: 200,
    durationMs: 2,
    startedAt: "2026-07-09T00:00:00.000Z",
    endedAt: "2026-07-09T00:00:00.002Z",
  });

  assert.match(generated.traceId, /^[a-f0-9]{32}$/);
  assert.equal(generated.generatedTraceContext, true);
  assert.equal(generated.domain, "observability");

  assert.equal(
    canopyProofTelemetryRouteTemplate("/canopyproof/evidence/private-subject-id", "*"),
    "/canopyproof/evidence/*",
  );
  assert.equal(
    canopyProofTelemetryRouteTemplate(
      "/canopyproof/evidence/private-subject-id",
      "/canopyproof/evidence/:evidenceId",
    ),
    "/canopyproof/evidence/:evidenceId",
  );
  assert.equal(canopyProofTelemetryRouteTemplate("/unexpected/private-value", "*"), "/*");
});

test("CanopyProof observability API requires RBAC and propagates edge request IDs", async () => {
  const denied = await app.request("/canopyproof/observability/status");
  assert.equal(denied.status, 401);
  assert.match(denied.headers.get("x-dropin-trace-id") ?? "", /^[a-f0-9]{32}$/);
  assert.match(denied.headers.get("x-dropin-span-id") ?? "", /^[a-f0-9]{16}$/);
  assert.match(denied.headers.get("x-dropin-telemetry-event-hash") ?? "", /^[a-f0-9]{64}$/);
  assert.match(denied.headers.get("x-dropin-otel-span-hash") ?? "", /^[a-f0-9]{64}$/);

  const response = await app.request("/canopyproof/observability/status", {
    headers: {
      ...headers("observer", "observer_observability_api"),
      "x-dropin-edge-request-id": "edge-observability-test",
      traceparent: "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-dropin-edge-request-id"), "edge-observability-test");
  assert.equal(response.headers.get("x-dropin-request-id"), "edge-observability-test");
  assert.equal(response.headers.get("traceparent"), "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
  assert.equal(response.headers.get("x-dropin-trace-id"), "4bf92f3577b34da6a3ce929d0e0e4736");
  assert.match(response.headers.get("x-dropin-span-id") ?? "", /^[a-f0-9]{16}$/);
  assert.match(response.headers.get("x-dropin-telemetry-event-hash") ?? "", /^[a-f0-9]{64}$/);
  assert.match(response.headers.get("x-dropin-otel-span-hash") ?? "", /^[a-f0-9]{64}$/);
  assert.match(response.headers.get("server-timing") ?? "", /^canopyproof;dur=\d+$/);

  const body = await json<{
    ok: true;
    data: {
      service: string;
      openTelemetry: {
        serviceName: string;
        edgeRequestHeader: string;
        spanHashHeader: string;
        exporter: { mode: string; ready: boolean };
      };
      serviceHealth: Array<{ service: string; ok: boolean }>;
      telemetryRoot: string;
    };
  }>(response);

  assert.equal(body.data.service, "canopyproof-observability");
  assert.equal(body.data.openTelemetry.serviceName, "canopyproof-api");
  assert.equal(body.data.openTelemetry.edgeRequestHeader, "x-dropin-edge-request-id");
  assert.equal(body.data.openTelemetry.spanHashHeader, "x-dropin-otel-span-hash");
  assert.equal(body.data.openTelemetry.exporter.mode, "disabled");
  assert.equal(body.data.openTelemetry.exporter.ready, false);
  assert.ok(body.data.serviceHealth.some((health) => health.service === "canopyproof-os-proof-engine" && health.ok));
  assert.ok(body.data.serviceHealth.some((health) => health.service === "canopyproof-identity-authentication" && health.ok));
  assert.ok(body.data.telemetryRoot.length >= 64);
});

test("CanopyProof API rejects malformed trace context from response propagation", async () => {
  const response = await app.request("/metrics", {
    headers: {
      traceparent: "malformed-private-trace-value",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("traceparent"), null);
  assert.match(response.headers.get("x-dropin-trace-id") ?? "", /^[a-f0-9]{32}$/);
  assert.match(response.headers.get("x-dropin-span-id") ?? "", /^[a-f0-9]{16}$/);
});

test("CanopyProof /metrics includes OS observability and early-warning metrics", async () => {
  const response = await app.request("/metrics", {
    headers: {
      "x-dropin-edge-request-id": "edge-metrics-test",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-dropin-request-id"), "edge-metrics-test");
  assert.match(response.headers.get("x-dropin-trace-id") ?? "", /^[a-f0-9]{32}$/);
  assert.match(response.headers.get("x-dropin-span-id") ?? "", /^[a-f0-9]{16}$/);
  assert.match(response.headers.get("x-dropin-otel-span-hash") ?? "", /^[a-f0-9]{64}$/);
  const text = await response.text();

  assert.match(text, /canopyproof_observability_service_up 1/);
  assert.match(text, /canopyproof_otel_exporter_enabled 0/);
  assert.match(text, /canopyproof_otel_exporter_ready 0/);
  assert.match(text, /canopyproof_otel_exporter_queue_depth 0/);
  assert.match(text, /canopyproof_service_health\{service="canopyproof-os-proof-engine"\} 1/);
  assert.match(text, /canopyproof_critical_routes_total/);
  assert.match(text, /canopyproof_early_warning_critical_alerts/);
  assert.match(text, /canopyproof_early_warning_dispatch_receipts/);
  assert.match(text, /canopyproof_early_warning_response_activations/);
  assert.match(text, /canopyproof_early_warning_response_closures/);
  assert.match(text, /canopyproof_early_warning_after_action_reviews/);
  assert.match(text, /canopyproof_proof_record_open_challenges/);
  assert.match(text, /canopyproof_database_audit_transparency_enabled 1/);
  assert.match(text, /canopyproof_database_audit_verification_max_events 1000/);
  assert.match(text, /canopyproof_security_abuse_signals/);
  assert.match(text, /canopyproof_resilience_failed_drills/);
  assert.match(text, /canopyproof_resilience_recovery_drills/);
  assert.match(text, /canopyproof_governance_unresolved_conflicts/);
  assert.match(text, /canopyproof_evidence_media_objects/);
  assert.match(text, /canopyproof_evidence_quarantined_media_objects/);
  assert.match(text, /canopyproof_evidence_pending_scan_media_objects/);
  assert.match(text, /canopyproof_evidence_revoked_consent_receipts/);
  assert.match(text, /canopyproof_evidence_risky_device_attestations/);
  assert.match(text, /canopyproof_evidence_metadata_extractions_needing_review/);
  assert.match(text, /canopyproof_evidence_open_review_tasks/);
  assert.match(text, /canopyproof_evidence_escalated_review_tasks/);
  assert.match(text, /canopyproof_evidence_retention_minimization_decisions/);
  assert.match(text, /canopyproof_verification_queue_depth/);
  assert.match(text, /canopyproof_verification_queue_blocked_work_items/);
  assert.match(text, /canopyproof_verification_queue_escalated_work_items/);
  assert.match(text, /canopyproof_verification_queue_backpressure_active/);
  assert.match(text, /canopyproof_verification_queue_utilization_percent/);
  assert.match(text, /canopyproof_evidence_offline_sync_batches/);
  assert.match(text, /canopyproof_evidence_offline_sync_conflicts/);
  assert.match(text, /canopyproof_evidence_custody_events/);
  assert.match(text, /canopyproof_partner_revoked_data_sharing_agreements/);
  assert.match(text, /canopyproof_partner_data_sharing_agreement_revocations/);
  assert.match(text, /canopyproof_partner_superseded_data_sharing_agreements/);
  assert.match(text, /canopyproof_partner_data_sharing_agreement_supersessions/);
  assert.match(text, /canopyproof_partner_data_access_requests/);
  assert.match(text, /canopyproof_partner_pending_data_access_requests/);
  assert.match(text, /canopyproof_partner_approved_data_access_requests/);
  assert.match(text, /canopyproof_partner_data_access_delivery_receipts/);
  assert.match(text, /canopyproof_partner_data_use_attestations/);
  assert.match(text, /canopyproof_partner_challenged_data_use_attestations/);
  assert.match(text, /canopyproof_partner_data_use_enforcement_cases/);
  assert.match(text, /canopyproof_partner_open_data_use_enforcement_cases/);
  assert.match(text, /canopyproof_partner_data_access_restrictions/);
  assert.match(text, /canopyproof_partner_active_data_access_restrictions/);
  assert.match(text, /canopyproof_partner_data_access_accountability_packets/);
  assert.match(text, /canopyproof_partner_data_access_accountability_verifications/);
  assert.match(text, /canopyproof_partner_failed_data_access_accountability_verifications/);
  assert.match(text, /canopyproof_partner_data_access_accountability_disclosures/);
  assert.match(text, /canopyproof_partner_stale_data_access_accountability_disclosures/);
  assert.match(text, /canopyproof_partner_data_access_accountability_disclosure_challenges/);
  assert.match(text, /canopyproof_partner_open_data_access_accountability_disclosure_challenges/);
  assert.match(text, /canopyproof_partner_data_access_accountability_disclosure_resolutions/);
  assert.match(text, /canopyproof_partner_data_access_accountability_disclosure_notices/);
  assert.match(text, /canopyproof_partner_withdrawn_data_access_accountability_disclosures/);
  assert.match(text, /canopyproof_partner_corrected_data_access_accountability_disclosures/);
});

test("CanopyProof production infrastructure manifests cover Kubernetes, PostgreSQL, object storage, and OpenTelemetry", () => {
  const apiDeployment = readFileSync(join(process.cwd(), "infra/canopyproof/kubernetes/api-deployment.yaml"), "utf8");
  const backupCron = readFileSync(join(process.cwd(), "infra/canopyproof/kubernetes/postgres-backup-cronjob.yaml"), "utf8");
  const otel = readFileSync(join(process.cwd(), "infra/observability/opentelemetry-collector.yaml"), "utf8");
  const rules = readFileSync(join(process.cwd(), "infra/observability/prometheus-rules-canopyproof.yaml"), "utf8");
  const cloudflareTerraform = readFileSync(join(process.cwd(), "infra/cloudflare/canopyproof-terraform.tf.example"), "utf8");

  assert.match(apiDeployment, /kind: Deployment/);
  assert.match(apiDeployment, /DROPIN_ALLOW_ADMIN_PROXY: "false"/);
  assert.match(apiDeployment, /OTEL_SERVICE_NAME: "canopyproof-api"/);
  assert.match(apiDeployment, /CANOPYPROOF_OTEL_EXPORT_ENABLED: "false"/);
  assert.match(apiDeployment, /OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "http\/json"/);
  assert.match(apiDeployment, /CANOPYPROOF_OTEL_ALLOW_PRIVATE_HTTP: "false"/);
  assert.doesNotMatch(apiDeployment, /instrumentation\.opentelemetry\.io\/inject-nodejs:\s*"true"/);
  assert.match(apiDeployment, /CANOPYPROOF_OBJECT_STORAGE_URL/);
  assert.match(apiDeployment, /readOnlyRootFilesystem: true/);
  assert.match(apiDeployment, /automountServiceAccountToken: false/);
  assert.match(apiDeployment, /kind: PodDisruptionBudget/);

  assert.match(backupCron, /kind: CronJob/);
  assert.match(backupCron, /pg_dump/);
  assert.match(backupCron, /object-storage:\/\/canopyproof-postgres-backups/);

  assert.match(otel, /kind: Deployment/);
  assert.match(otel, /opentelemetry-collector/);
  assert.match(otel, /endpoint: 0\.0\.0\.0:4318/);
  assert.match(otel, /service.namespace/);
  assert.match(otel, /canopyproof.safety.admin_proxy/);
  assert.match(otel, /traces:\n\s+receivers: \[otlp\][\s\S]+exporters: \[debug\]/);
  assert.doesNotMatch(otel, /exporters:\n\s+otlphttp\//);

  assert.match(rules, /CanopyProofApiDown/);
  assert.match(rules, /CanopyProofOtlpExporterInvalidConfiguration/);
  assert.match(rules, /CanopyProofOtlpExporterDrop/);
  assert.match(rules, /CanopyProofAdminProxyExposure/);
  assert.match(rules, /CanopyProofCriticalRiskBacklog/);
  assert.match(rules, /CanopyProofSecurityAbuseSignalSpike/);
  assert.match(rules, /CanopyProofResilienceDrillFailed/);
  assert.match(rules, /CanopyProofMediaObjectQuarantineBacklog/);
  assert.match(rules, /CanopyProofDeviceAttestationRiskBacklog/);
  assert.match(rules, /CanopyProofMetadataExtractionReviewBacklog/);
  assert.match(rules, /CanopyProofEvidenceReviewTaskBacklog/);
  assert.match(rules, /CanopyProofRetentionMinimizationBacklog/);
  assert.match(rules, /CanopyProofVerificationQueueBackpressure/);
  assert.match(rules, /CanopyProofVerificationQueueBlockedWork/);
  assert.match(rules, /CanopyProofGovernanceConflictBacklog/);
  assert.match(rules, /CanopyProofProofRecordChallengeBacklog/);
  assert.match(rules, /CanopyProofOfflineEvidenceSyncConflictSpike/);

  assert.match(cloudflareTerraform, /canopyproof\.org\/api\/\*/);
  assert.match(cloudflareTerraform, /canopyproof\.org\/\*/);
  assert.match(cloudflareTerraform, /www\.canopyproof\.org\/\*/);
  assert.match(cloudflareTerraform, /content_file\s*=\s*var\.canopyproof_api_proxy_bundle_path/);
  assert.match(cloudflareTerraform, /content_sha256\s*=\s*filesha256\(var\.canopyproof_api_proxy_bundle_path\)/);
  assert.match(cloudflareTerraform, /main_module\s*=\s*"canopyproof-api-proxy\.js"/);
  assert.doesNotMatch(cloudflareTerraform, /content\s*=\s*file\([^\n]*canopyproof-api-proxy\.ts/);
  assert.doesNotMatch(cloudflareTerraform, /DROPIN_API_ORIGIN\s*=/);

  for (const path of [
    "infra/canopyproof/kubernetes/api-deployment.yaml",
    "infra/canopyproof/kubernetes/postgres-backup-cronjob.yaml",
    "infra/observability/opentelemetry-collector.yaml",
    "infra/observability/prometheus-rules-canopyproof.yaml",
    "infra/cloudflare/canopyproof-terraform.tf.example",
  ]) {
    assert.equal(statSync(join(process.cwd(), path)).isFile(), true);
  }
});
