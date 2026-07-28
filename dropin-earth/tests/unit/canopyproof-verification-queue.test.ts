import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofService } from "../../services/api/src/domain/canopyproof/proof-service.js";
import { CanopyProofVerificationQueueService } from "../../services/api/src/domain/canopyproof/verification-queue.js";

const timestamp = "2026-07-09T00:00:00.000Z";

function headers(role: string, actorId = `${role}_verification_queue_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

function evidencePayload(id: string, mediaHash: string) {
  return {
    id,
    projectId: "project_v1_ggw_demo",
    evidenceType: "tree_planting",
    location: {
      latitude: 14.7167,
      longitude: -17.4677,
      accuracyMeters: 9,
      regionId: "region_ggw_sahel",
    },
    timestamp,
    contributor: `community_${id}`,
    media_hash: mediaHash,
    gps_hash: "2".repeat(64),
    confidence_score: 91,
    device_fingerprint_hash: "3".repeat(64),
    exif_hash: "4".repeat(64),
  };
}

test("CanopyProof Verification Queue plans Evidence -> AI -> TerraProof -> Human Review -> Proof with dependencies", () => {
  const proof = new CanopyProofService();
  const queue = new CanopyProofVerificationQueueService(proof);
  const evidence = proof.submitEvidence(evidencePayload("evidence_queue_domain_001", "5".repeat(64))).evidence;

  const pipeline = queue.planEvidencePipeline(
    {
      evidenceId: evidence.id,
      requestedAt: timestamp,
      includeTerraCrosscheck: true,
      priority: "high",
    },
    "verification_queue_agent",
  );

  assert.equal(pipeline.workItems.length, 5);
  assert.match(pipeline.pipelineRoot, /^[a-f0-9]{64}$/);
  assert.deepEqual(
    pipeline.workItems.map((item) => item.stage),
    ["validation", "ai_analysis", "terra_crosscheck", "human_review", "proof_issuance"],
  );
  assert.equal(pipeline.workItems.at(-1)?.dependencyIds.length, 1);
  assert.equal(pipeline.workItems.at(-1)?.stage, "proof_issuance");
  assert.equal(queue.getStatus().queuedWorkItemCount, 5);
  assert.equal(queue.getStatus().safety.aiNeverFinalAuthority, true);
  assert.equal(queue.getStatus().safety.proofIssuanceRequiresHumanReview, true);
});

test("CanopyProof Verification Queue blocks unmet dependencies and enforces backpressure", () => {
  const proof = new CanopyProofService();
  const queue = new CanopyProofVerificationQueueService(proof, 5);
  const evidence = proof.submitEvidence(evidencePayload("evidence_queue_domain_002", "6".repeat(64))).evidence;
  const pipeline = queue.planEvidencePipeline({ evidenceId: evidence.id, requestedAt: timestamp }, "verification_queue_agent");
  const validation = pipeline.workItems.find((item) => item.stage === "validation");
  const humanReview = pipeline.workItems.find((item) => item.stage === "human_review");
  assert.ok(validation);
  assert.ok(humanReview);

  const blocked = queue.startWorkItem(
    humanReview.id,
    {
      transitionedAt: "2026-07-09T00:01:00.000Z",
      rationale: "Human review cannot start until advisory AI and TerraProof dependencies are completed.",
    },
    "verifier_queue_actor",
  );
  assert.equal(blocked.status, "blocked");
  assert.ok(blocked.reasonCodes.some((reason) => reason.startsWith("dependency_not_completed:")));

  const running = queue.startWorkItem(
    validation.id,
    {
      transitionedAt: "2026-07-09T00:02:00.000Z",
      rationale: "Schema validation can start because it has no upstream dependencies.",
    },
    "verification_queue_agent",
  );
  assert.equal(running.status, "running");
  const completed = queue.completeWorkItem(
    validation.id,
    {
      transitionedAt: "2026-07-09T00:03:00.000Z",
      rationale: "Validation completed and remains audit-rooted before advisory AI.",
    },
    "verification_queue_agent",
  );
  assert.equal(completed.status, "completed");

  queue.enqueueWorkItem(
    {
      evidenceId: evidence.id,
      stage: "validation",
      priority: "critical",
      reasonCodes: ["manual_replay_check"],
      queuedAt: "2026-07-09T00:04:00.000Z",
    },
    "verification_queue_agent",
  );
  assert.equal(queue.getStatus().backpressureActive, true);
  assert.throws(
    () =>
      queue.enqueueWorkItem(
        {
          evidenceId: evidence.id,
          stage: "validation",
          priority: "normal",
          reasonCodes: ["overflow_check"],
          queuedAt: "2026-07-09T00:05:00.000Z",
        },
        "verification_queue_agent",
      ),
    /verification queue backpressure is active/,
  );
});

test("CanopyProof Verification Queue API exposes pipeline planning, transitions, and RBAC", async () => {
  const evidenceId = "evidence_queue_api_001";
  const evidenceResponse = await app.request("/canopyproof/evidence", {
    method: "POST",
    headers: headers("community", "community_queue_api"),
    body: JSON.stringify(evidencePayload(evidenceId, "7".repeat(64))),
  });
  assert.equal(evidenceResponse.status, 201);

  const denied = await app.request("/canopyproof/verification/queue/pipelines", {
    method: "POST",
    headers: headers("community", "community_queue_denied"),
    body: JSON.stringify({ evidenceId, requestedAt: timestamp }),
  });
  assert.equal(denied.status, 403);

  const pipelineResponse = await app.request("/canopyproof/verification/queue/pipelines", {
    method: "POST",
    headers: headers("agent", "canopy_verification_agent"),
    body: JSON.stringify({
      evidenceId,
      requestedAt: timestamp,
      includeTerraCrosscheck: true,
      priority: "high",
    }),
  });
  const pipelineBody = (await pipelineResponse.json()) as {
    ok: true;
    data: {
      pipelineRoot: string;
      workItems: Array<{ id: string; stage: string; status: string; dependencyIds: string[] }>;
    };
  };
  assert.equal(pipelineResponse.status, 201);
  assert.match(pipelineBody.data.pipelineRoot, /^[a-f0-9]{64}$/);
  assert.equal(pipelineBody.data.workItems.length, 5);

  const validation = pipelineBody.data.workItems.find((item) => item.stage === "validation");
  const humanReview = pipelineBody.data.workItems.find((item) => item.stage === "human_review");
  assert.ok(validation);
  assert.ok(humanReview);

  const blockedHumanReview = await app.request(`/canopyproof/verification/queue/work-items/${humanReview.id}/start`, {
    method: "POST",
    headers: headers("verifier", "verifier_queue_api"),
    body: JSON.stringify({
      transitionedAt: "2026-07-09T00:01:00.000Z",
      rationale: "Human review is blocked until AI and TerraProof dependencies complete.",
    }),
  });
  const blockedHumanReviewBody = (await blockedHumanReview.json()) as { ok: true; data: { status: string; reasonCodes: string[] } };
  assert.equal(blockedHumanReview.status, 202);
  assert.equal(blockedHumanReviewBody.data.status, "blocked");
  assert.ok(blockedHumanReviewBody.data.reasonCodes.some((reason) => reason.startsWith("dependency_not_completed:")));

  const startValidation = await app.request(`/canopyproof/verification/queue/work-items/${validation.id}/start`, {
    method: "POST",
    headers: headers("agent", "canopy_verification_agent"),
    body: JSON.stringify({
      transitionedAt: "2026-07-09T00:02:00.000Z",
      rationale: "Validation starts before advisory AI or human review.",
    }),
  });
  assert.equal(startValidation.status, 200);

  const completeValidation = await app.request(`/canopyproof/verification/queue/work-items/${validation.id}/complete`, {
    method: "POST",
    headers: headers("agent", "canopy_verification_agent"),
    body: JSON.stringify({
      transitionedAt: "2026-07-09T00:03:00.000Z",
      rationale: "Validation finished and remains audit-rooted.",
    }),
  });
  assert.equal(completeValidation.status, 200);

  const listResponse = await app.request(`/canopyproof/verification/queue/work-items?evidenceId=${evidenceId}`, {
    headers: headers("observer", "observer_queue_api"),
  });
  const listBody = (await listResponse.json()) as { ok: true; data: Array<{ evidenceId: string; stage: string }> };
  assert.equal(listResponse.status, 200);
  assert.equal(listBody.data.length, 5);
  assert.ok(listBody.data.every((item) => item.evidenceId === evidenceId));
});
