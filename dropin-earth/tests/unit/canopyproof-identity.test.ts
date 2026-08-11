import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofIdentityService } from "../../services/api/src/domain/canopyproof/identity.js";

function headers(role: string, actorId = `${role}_identity_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test("CanopyProof identity service registers participants with audit history and reputation snapshots", () => {
  const service = new CanopyProofIdentityService();
  const participant = service.registerParticipant(
    {
      id: "cp_identity_domain_human_001",
      participantType: "human",
      displayName: "Sahel Field Verifier",
      organizationId: "cp_org_sahel_research_001",
      roles: ["community", "verifier"],
      verificationStatus: "pending",
      reputationScore: 64,
      credentialCommitments: ["a".repeat(64), "sha256:" + "b".repeat(64)],
      publicKeyHash: "c".repeat(64),
      createdAt: "2026-07-08T00:00:00.000Z",
    },
    "owner_identity_domain",
  );

  assert.equal(participant.id, "cp_identity_domain_human_001");
  assert.equal(participant.participantType, "human");
  assert.equal(participant.ownerId, "owner_identity_domain");
  assert.deepEqual(participant.roles, ["community", "verifier"]);
  assert.equal(participant.verificationStatus, "pending");
  assert.equal(participant.reputationScore, 64);
  assert.match(participant.subjectHash, /^[a-f0-9]{64}$/);
  assert.equal(participant.auditHistory.at(-1)?.entityType, "identity_participant");

  const snapshot = service.recordReputationSnapshot(
    participant.id,
    {
      newScore: 82,
      source: "evidence_contribution",
      reason: "Verified evidence batches matched GPS, EXIF, and community review requirements.",
      recordedAt: "2026-07-08T01:00:00.000Z",
    },
    "verifier_identity_domain",
  );

  assert.equal(snapshot.previousScore, 64);
  assert.equal(snapshot.newScore, 82);
  assert.match(snapshot.snapshotHash, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.auditEvent.entityType, "identity_reputation_snapshot");
  assert.equal(service.getParticipant(participant.id).reputationScore, 82);
  assert.equal(service.listReputationSnapshots(participant.id).length, 1);
  assert.equal(service.getStatus().participantCount, 1);
  assert.equal(service.getStatus().reputationSnapshotCount, 1);
  assert.equal(service.getStatus().safety.reputationIsNonAuthoritative, true);
});

test("CanopyProof identity API enforces RBAC and exposes participant reputation history", async () => {
  const deniedOrganization = await app.request("/canopyproof/identity/participants", {
    method: "POST",
    headers: headers("community", "community_identity_api_denied"),
    body: JSON.stringify({
      id: "cp_identity_api_org_denied_001",
      participantType: "organization",
      displayName: "Denied Organization",
      roles: ["observer"],
      credentialCommitments: ["d".repeat(64)],
    }),
  });
  const deniedOrganizationBody = await json<{ ok: false; error: string }>(deniedOrganization);

  assert.equal(deniedOrganization.status, 403);
  assert.equal(deniedOrganizationBody.ok, false);
  assert.match(deniedOrganizationBody.error, /community actors can only register human or device/);

  const participantResponse = await app.request("/canopyproof/identity/participants", {
    method: "POST",
    headers: headers("community", "community_identity_api_001"),
    body: JSON.stringify({
      id: "cp_identity_api_human_001",
      participantType: "human",
      displayName: "Community Evidence Contributor",
      organizationId: "cp_org_api_community_001",
      roles: ["community"],
      verificationStatus: "pending",
      reputationScore: 50,
      credentialCommitments: ["e".repeat(64)],
      createdAt: "2026-07-08T00:00:00.000Z",
    }),
  });
  const participantBody = await json<{
    ok: true;
    data: {
      id: string;
      ownerId: string;
      participantType: string;
      reputationScore: number;
      subjectHash: string;
      auditHistory: Array<{ entityType: string; eventRoot: string }>;
    };
  }>(participantResponse);

  assert.equal(participantResponse.status, 201);
  assert.equal(participantBody.data.ownerId, "community_identity_api_001");
  assert.equal(participantBody.data.participantType, "human");
  assert.equal(participantBody.data.reputationScore, 50);
  assert.match(participantBody.data.subjectHash, /^[a-f0-9]{64}$/);
  assert.equal(participantBody.data.auditHistory.at(-1)?.entityType, "identity_participant");

  const deniedSnapshot = await app.request(`/canopyproof/identity/participants/${participantBody.data.id}/reputation-snapshots`, {
    method: "POST",
    headers: headers("community", "community_identity_api_001"),
    body: JSON.stringify({
      newScore: 95,
      source: "manual_adjustment",
      reason: "Community actors cannot self-adjust institutional reputation.",
    }),
  });
  assert.equal(deniedSnapshot.status, 403);

  const snapshotResponse = await app.request(`/canopyproof/identity/participants/${participantBody.data.id}/reputation-snapshots`, {
    method: "POST",
    headers: headers("verifier", "verifier_identity_api_001"),
    body: JSON.stringify({
      newScore: 78,
      source: "human_review",
      reason: "Human reviewer confirmed repeated clean evidence submissions and no open challenge outcomes.",
      recordedAt: "2026-07-08T01:00:00.000Z",
    }),
  });
  const snapshotBody = await json<{
    ok: true;
    data: { previousScore: number; newScore: number; recordedBy: string; snapshotHash: string; auditEvent: { entityType: string; eventRoot: string } };
  }>(snapshotResponse);

  assert.equal(snapshotResponse.status, 201);
  assert.equal(snapshotBody.data.previousScore, 50);
  assert.equal(snapshotBody.data.newScore, 78);
  assert.equal(snapshotBody.data.recordedBy, "verifier_identity_api_001");
  assert.match(snapshotBody.data.snapshotHash, /^[a-f0-9]{64}$/);
  assert.equal(snapshotBody.data.auditEvent.entityType, "identity_reputation_snapshot");

  const historyResponse = await app.request(`/canopyproof/identity/participants/${participantBody.data.id}/reputation-snapshots`, {
    headers: headers("observer", "observer_identity_api_001"),
  });
  const historyBody = await json<{ ok: true; data: Array<{ id: string; newScore: number }> }>(historyResponse);

  assert.equal(historyResponse.status, 200);
  assert.equal(historyBody.data.length, 1);
  assert.equal(historyBody.data[0]?.newScore, 78);

  const statusResponse = await app.request("/canopyproof/identity/status", {
    headers: headers("observer", "observer_identity_api_001"),
  });
  const statusBody = await json<{ ok: true; data: { participantCount: number; reputationSnapshotCount: number; identityRoot: string } }>(statusResponse);

  assert.equal(statusResponse.status, 200);
  assert.ok(statusBody.data.participantCount >= 1);
  assert.ok(statusBody.data.reputationSnapshotCount >= 1);
  assert.match(statusBody.data.identityRoot, /^[a-f0-9]{64}$/);
});
