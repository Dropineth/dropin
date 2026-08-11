import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofResilienceService } from "../../services/api/src/domain/canopyproof/resilience.js";

const timestamp = "2026-07-09T04:00:00.000Z";

function headers(role: string, actorId = `${role}_resilience_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test("CanopyProof resilience drills classify database partial writes as recoverable only when no final state leaks", () => {
  const service = new CanopyProofResilienceService();
  const recoverable = service.recordDrill(
    {
      dependency: "postgresql",
      scenario: "audit_append_failed",
      route: "/canopyproof/proof-records",
      startedAt: timestamp,
      idempotencyKey: "db-drill-retry-001",
      description: "Simulate a proof-record mutation where audit append fails and the request enters retry recovery.",
      simulation: {
        domainMutationCommitted: true,
        auditAppendCommitted: false,
        retryQueued: true,
        readOnlyFallbackServed: false,
        duplicateMutationCreated: false,
        finalStateExposed: false,
        upstreamAvailable: true,
      },
    },
    "verifier_resilience_unit",
  );

  assert.equal(recoverable.decision, "pass");
  assert.equal(recoverable.safetyAssertions.transactionAtomicOrRecoverable, true);
  assert.equal(recoverable.safetyAssertions.noFinalStateExposed, true);
  assert.equal(recoverable.auditEvent.entityType, "resilience_drill");

  const unsafe = service.recordDrill(
    {
      dependency: "postgresql",
      scenario: "audit_append_failed",
      route: "/canopyproof/proof-records",
      startedAt: "2026-07-09T04:05:00.000Z",
      idempotencyKey: "db-drill-retry-002",
      description: "Simulate a proof-record mutation that leaks a final public state without an audit append.",
      simulation: {
        domainMutationCommitted: true,
        auditAppendCommitted: false,
        retryQueued: false,
        readOnlyFallbackServed: false,
        duplicateMutationCreated: false,
        finalStateExposed: true,
        upstreamAvailable: true,
      },
    },
    "verifier_resilience_unit",
  );

  assert.equal(unsafe.decision, "fail_closed_violation");
  assert.equal(unsafe.safetyAssertions.noFinalStateExposed, false);
  assert.ok(unsafe.recommendedActions.some((action) => action.includes("Block public promotion")));
  assert.equal(service.getStatus().failedDrillCount, 1);
});

test("CanopyProof resilience drills require read-only fallback and idempotent retries during API outages", () => {
  const service = new CanopyProofResilienceService();
  const outage = service.recordDrill(
    {
      dependency: "api_origin",
      scenario: "api_origin_unavailable",
      route: "/canopyproof/evidence/sync-batches",
      startedAt: timestamp,
      idempotencyKey: "offline-api-outage-001",
      description: "Simulate public UI availability while API-origin mutations are retried from the offline evidence queue.",
      simulation: {
        domainMutationCommitted: false,
        auditAppendCommitted: false,
        retryQueued: true,
        readOnlyFallbackServed: true,
        duplicateMutationCreated: false,
        finalStateExposed: false,
        upstreamAvailable: false,
      },
    },
    "agent_resilience_unit",
  );

  assert.equal(outage.decision, "pass");
  assert.equal(outage.safetyAssertions.readOnlyOrRetryFallback, true);
  assert.equal(outage.safetyAssertions.idempotencyKeyPreserved, true);

  const missingKey = service.recordDrill(
    {
      dependency: "api_origin",
      scenario: "api_origin_unavailable",
      route: "/canopyproof/evidence/sync-batches",
      startedAt: "2026-07-09T04:10:00.000Z",
      description: "Simulate retrying an offline evidence mutation without persisting an Idempotency-Key.",
      simulation: {
        domainMutationCommitted: false,
        auditAppendCommitted: false,
        retryQueued: true,
        readOnlyFallbackServed: true,
        duplicateMutationCreated: false,
        finalStateExposed: false,
        upstreamAvailable: false,
      },
    },
    "agent_resilience_unit",
  );

  assert.equal(missingKey.decision, "fail_closed_violation");
  assert.equal(missingKey.safetyAssertions.idempotencyKeyPreserved, false);
  assert.ok(missingKey.recommendedActions.some((action) => action.includes("Idempotency-Key")));
});

test("CanopyProof resilience API is RBAC-protected and exposes outage drill evidence", async () => {
  const denied = await app.request("/canopyproof/resilience/drills", {
    method: "POST",
    headers: headers("community", "community_resilience_denied"),
    body: JSON.stringify({
      dependency: "postgresql",
      scenario: "database_connection_drop",
      route: "/canopyproof/evidence",
      startedAt: timestamp,
      idempotencyKey: "denied-resilience-key",
      description: "Community actors cannot write resilience drill evidence.",
      simulation: {
        retryQueued: true,
        finalStateExposed: false,
      },
    }),
  });
  assert.equal(denied.status, 403);

  const response = await app.request("/canopyproof/resilience/drills", {
    method: "POST",
    headers: headers("verifier", "verifier_resilience_api"),
    body: JSON.stringify({
      dependency: "api_origin",
      scenario: "api_origin_unavailable",
      route: "/canopyproof/evidence/sync-batches",
      startedAt: "2026-07-09T04:15:00.000Z",
      idempotencyKey: "api-outage-idempotency-001",
      description: "API origin unavailable while the public UI stays read-only and evidence sync waits for retry.",
      simulation: {
        domainMutationCommitted: false,
        auditAppendCommitted: false,
        retryQueued: true,
        readOnlyFallbackServed: true,
        duplicateMutationCreated: false,
        finalStateExposed: false,
        upstreamAvailable: false,
      },
    }),
  });
  const body = await json<{ ok: true; data: { id: string; decision: string; auditEvent: { entityType: string } } }>(response);
  assert.equal(response.status, 201);
  assert.equal(body.data.decision, "pass");
  assert.equal(body.data.auditEvent.entityType, "resilience_drill");

  const read = await app.request(`/canopyproof/resilience/drills/${body.data.id}`, {
    headers: headers("observer", "observer_resilience_api"),
  });
  const readBody = await json<{ ok: true; data: { id: string; scenario: string } }>(read);
  assert.equal(read.status, 200);
  assert.equal(readBody.data.id, body.data.id);
  assert.equal(readBody.data.scenario, "api_origin_unavailable");

  const status = await app.request("/canopyproof/resilience/status", {
    headers: headers("observer", "observer_resilience_status"),
  });
  const statusBody = await json<{ ok: true; data: { service: string; apiOutageDrillCount: number; resilienceRoot: string } }>(status);
  assert.equal(status.status, 200);
  assert.equal(statusBody.data.service, "canopyproof-resilience");
  assert.ok(statusBody.data.apiOutageDrillCount >= 1);
  assert.match(statusBody.data.resilienceRoot, /^[a-f0-9]{64}$/);
});

test("CanopyProof metrics and SQL contracts include resilience chaos coverage", async () => {
  const metricsResponse = await app.request("/metrics");
  assert.equal(metricsResponse.status, 200);
  const metrics = await metricsResponse.text();

  assert.match(metrics, /canopyproof_resilience_failed_drills/);
  assert.match(metrics, /canopyproof_resilience_recovery_drills/);

  const rules = readFileSync(join(process.cwd(), "infra/observability/prometheus-rules-canopyproof.yaml"), "utf8");
  assert.match(rules, /CanopyProofResilienceDrillFailed/);
  assert.match(rules, /canopyproof_resilience_failed_drills > 0/);

  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS audit\.resilience_drills/);
  assert.match(sql, /decision text NOT NULL CHECK \(decision IN \('pass', 'needs_recovery', 'fail_closed_violation'\)\)/);
  assert.match(sql, /audit_resilience_drills_no_update/);
  assert.match(sql, /audit_resilience_drills_no_delete/);
  assert.match(sql, /audit_resilience_drills_audit/);
});
