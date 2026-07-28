import assert from "node:assert/strict";
import test from "node:test";
import { CanopyProofAgentFrameworkService } from "../../services/api/src/domain/canopyproof/agents.js";
import { app } from "../../services/api/src/app.js";

function headers(role: string, actorId = `${role}_agent_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function evidenceAgentEvent() {
  return {
    agentId: "canopyproof-evidence-agent",
    action: "ASSERT",
    subjectType: "evidence",
    subjectId: "evidence_agent_event_001",
    payload: {
      mediaHash: "sha256:" + "a".repeat(64),
      gpsHash: "sha256:" + "b".repeat(64),
      offlineSync: true,
    },
    sources: ["mobile-report:evidence_agent_event_001", "device-attestation:field-device-001"],
    confidenceScore: 82,
    createdAt: "2026-07-08T00:00:00.000Z",
    rationale: "Evidence Agent asserted offline field evidence envelope for verifier review.",
  };
}

test("CanopyProof agent framework registers required agents and records AHIN events", () => {
  const service = new CanopyProofAgentFrameworkService();
  const status = service.getStatus();

  assert.equal(status.agentCount, 6);
  assert.equal(status.activeAgentCount, 6);
  assert.equal(status.safety.aiNeverFinalAuthority, true);
  assert.equal(status.safety.humanReviewRequiredForProof, true);
  assert.ok(service.listAgents().some((agent) => agent.name === "Evidence Agent"));
  assert.ok(service.listAgents().some((agent) => agent.name === "Verification Agent"));
  assert.ok(service.listAgents().some((agent) => agent.name === "ESG Agent"));
  assert.ok(service.listAgents().some((agent) => agent.name === "Funding Agent"));
  assert.ok(service.listAgents().some((agent) => agent.name === "Risk Agent"));
  assert.ok(service.listAgents().some((agent) => agent.name === "Community Agent"));

  const event = service.recordEvent(evidenceAgentEvent(), "canopyproof-evidence-agent");
  assert.equal(event.agentId, "canopyproof-evidence-agent");
  assert.equal(event.action, "ASSERT");
  assert.equal(event.finalAuthority, false);
  assert.equal(event.humanReviewRequired, true);
  assert.equal(event.auditEvent.entityType, "agent_event");
  assert.equal(event.auditEvent.action, "ASSERT");
  assert.ok(event.payloadHash.length >= 64);
  assert.ok(event.sourceRoot.length >= 64);
  assert.equal(service.getStatus().eventCount, 1);
});

test("CanopyProof agent framework blocks unsafe claims and invalid autonomous proof fulfillment", () => {
  const service = new CanopyProofAgentFrameworkService();

  assert.throws(
    () =>
      service.recordEvent(
        {
          ...evidenceAgentEvent(),
          rationale: "Evidence Agent is final authority for certified carbon credit issuance.",
        },
        "canopyproof-evidence-agent",
      ),
    /unsupported public claim/,
  );

  assert.throws(
    () =>
      service.recordEvent(
        {
          ...evidenceAgentEvent(),
          action: "FULFILL",
          subjectType: "proof_record",
          subjectId: "proof_record_agent_forbidden",
          rationale: "Evidence Agent attempted to fulfill proof record.",
        },
        "canopyproof-evidence-agent",
      ),
    /cannot emit action FULFILL/,
  );
});

test("CanopyProof agent API enforces RBAC and agent self-submission boundaries", async () => {
  const publicStatus = await app.request("/canopyproof/agents/status");
  assert.equal(publicStatus.status, 200);
  const publicStatusBody = await json<{ ok: true; data: { agentCount: number; safety: { aiNeverFinalAuthority: boolean } } }>(publicStatus);
  assert.equal(publicStatusBody.data.agentCount, 6);
  assert.equal(publicStatusBody.data.safety.aiNeverFinalAuthority, true);

  const deniedRead = await app.request("/canopyproof/agents");
  assert.equal(deniedRead.status, 401);

  const list = await app.request("/canopyproof/agents", {
    headers: headers("observer", "observer_agent_reader"),
  });
  assert.equal(list.status, 200);
  const listBody = await json<{ ok: true; data: Array<{ id: string; finalAuthority: boolean }> }>(list);
  assert.ok(listBody.data.some((agent) => agent.id === "canopyproof-risk-agent" && agent.finalAuthority === false));

  const spoofed = await app.request("/canopyproof/agents/events", {
    method: "POST",
    headers: headers("agent", "canopyproof-risk-agent"),
    body: JSON.stringify(evidenceAgentEvent()),
  });
  assert.equal(spoofed.status, 403);

  const created = await app.request("/canopyproof/agents/events", {
    method: "POST",
    headers: headers("agent", "canopyproof-evidence-agent"),
    body: JSON.stringify(evidenceAgentEvent()),
  });
  assert.equal(created.status, 201);
  const createdBody = await json<{ ok: true; data: { agentId: string; finalAuthority: boolean; auditEvent: { entityType: string } } }>(created);
  assert.equal(createdBody.data.agentId, "canopyproof-evidence-agent");
  assert.equal(createdBody.data.finalAuthority, false);
  assert.equal(createdBody.data.auditEvent.entityType, "agent_event");

  const events = await app.request("/canopyproof/agents/events?agentId=canopyproof-evidence-agent", {
    headers: headers("observer", "observer_agent_reader"),
  });
  assert.equal(events.status, 200);
  const eventsBody = await json<{ ok: true; data: Array<{ agentId: string; action: string }> }>(events);
  assert.ok(eventsBody.data.some((event) => event.agentId === "canopyproof-evidence-agent" && event.action === "ASSERT"));
});
