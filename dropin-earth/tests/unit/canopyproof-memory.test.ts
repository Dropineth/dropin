import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofMemoryService } from "../../services/api/src/domain/canopyproof/memory.js";

function headers(role: string, actorId = `${role}_memory_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function memoryPayload(id = "cp_memory_domain_001") {
  return {
    id,
    subjectType: "proof_record",
    subjectId: "cp_record_memory_001",
    projectId: "project_v1_ggw_demo",
    organizationId: "cp_org_memory_001",
    scope: "institutional",
    retentionClass: "institutional",
    summary: "Verifier retained a memory of proof-record lineage, governance approval, and monitoring context.",
    tags: ["proof", "governance", "Monitoring"],
    sourceIds: ["evidence:evidence_memory_001", "governance:approval_memory_001"],
    relatedRecordIds: ["cp_agent_event_memory_001"],
    payload: {
      evidenceRoot: "a".repeat(64),
      governanceApprovalId: "cp_governance_memory_001",
    },
    createdAt: "2026-07-08T00:00:00.000Z",
  };
}

test("CanopyProof memory service appends institutional recall records without final authority", () => {
  const service = new CanopyProofMemoryService();
  const record = service.recordMemory(memoryPayload(), "verifier_memory_domain");

  assert.equal(record.id, "cp_memory_domain_001");
  assert.equal(record.finalAuthority, false);
  assert.equal(record.auditEvent.entityType, "memory_record");
  assert.equal(record.auditEvent.action, "ASSERT");
  assert.deepEqual(record.tags, ["governance", "monitoring", "proof"]);
  assert.match(record.memoryHash, /^[a-f0-9]{64}$/);
  assert.match(record.sourceRoot, /^[a-f0-9]{64}$/);

  const replay = service.recordMemory(memoryPayload(), "verifier_memory_domain");
  assert.equal(replay.memoryHash, record.memoryHash);

  const recall = service.recall({ projectId: "project_v1_ggw_demo", tags: ["monitoring"], generatedAt: "2026-07-08T00:05:00.000Z" });
  assert.equal(recall.service, "canopyproof-memory");
  assert.equal(recall.finalAuthority, false);
  assert.deepEqual(recall.resultIds, [record.id]);
  assert.match(recall.recallRoot, /^[a-f0-9]{64}$/);
  assert.equal(service.getStatus().recordCount, 1);

  assert.throws(
    () =>
      service.recordMemory(
        {
          ...memoryPayload("cp_memory_unsafe_001"),
          summary: "This memory declares a certified carbon credit and guaranteed yield.",
        },
        "verifier_memory_domain",
      ),
    /unsupported public claim/,
  );
});

test("CanopyProof memory API enforces RBAC and exposes recall read models", async () => {
  const deniedCreate = await app.request("/canopyproof/memory/records", {
    method: "POST",
    headers: headers("community", "community_memory_denied"),
    body: JSON.stringify(memoryPayload("cp_memory_api_denied_001")),
  });
  assert.equal(deniedCreate.status, 403);

  const created = await app.request("/canopyproof/memory/records", {
    method: "POST",
    headers: headers("verifier", "verifier_memory_api"),
    body: JSON.stringify(memoryPayload("cp_memory_api_001")),
  });
  const createdBody = await json<{ ok: true; data: { id: string; finalAuthority: boolean; auditEvent: { entityType: string } } }>(created);
  assert.equal(created.status, 201);
  assert.equal(createdBody.data.id, "cp_memory_api_001");
  assert.equal(createdBody.data.finalAuthority, false);
  assert.equal(createdBody.data.auditEvent.entityType, "memory_record");

  const list = await app.request("/canopyproof/memory/records?projectId=project_v1_ggw_demo&tag=monitoring", {
    headers: headers("observer", "observer_memory_api"),
  });
  const listBody = await json<{ ok: true; data: Array<{ id: string; tags: string[] }> }>(list);
  assert.equal(list.status, 200);
  assert.ok(listBody.data.some((record) => record.id === "cp_memory_api_001" && record.tags.includes("monitoring")));

  const recall = await app.request("/canopyproof/memory/recall", {
    method: "POST",
    headers: headers("observer", "observer_memory_api"),
    body: JSON.stringify({
      projectId: "project_v1_ggw_demo",
      tags: ["governance"],
      generatedAt: "2026-07-08T00:10:00.000Z",
    }),
  });
  const recallBody = await json<{ ok: true; data: { service: string; finalAuthority: boolean; resultIds: string[]; recallRoot: string } }>(recall);
  assert.equal(recall.status, 200);
  assert.equal(recallBody.data.service, "canopyproof-memory");
  assert.equal(recallBody.data.finalAuthority, false);
  assert.ok(recallBody.data.resultIds.includes("cp_memory_api_001"));
  assert.match(recallBody.data.recallRoot, /^[a-f0-9]{64}$/);

  const status = await app.request("/canopyproof/memory/status", {
    headers: headers("observer", "observer_memory_api"),
  });
  const statusBody = await json<{ ok: true; data: { recordCount: number; memoryRoot: string; safety: { appendOnly: boolean } } }>(status);
  assert.equal(status.status, 200);
  assert.ok(statusBody.data.recordCount >= 1);
  assert.equal(statusBody.data.safety.appendOnly, true);
  assert.match(statusBody.data.memoryRoot, /^[a-f0-9]{64}$/);
});
