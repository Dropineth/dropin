import assert from "node:assert/strict";
import test from "node:test";
import { CanopyProofFundingTransparencyService } from "../../services/api/src/domain/canopyproof/funding-transparency.js";
import { app } from "../../services/api/src/app.js";

function headers(role: string, actorId = `${role}_funding_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function fundingSourcePayload(id: string) {
  return {
    id,
    sourceType: "grant",
    displayName: "Sahel Watershed Restoration Grant",
    jurisdiction: "Senegal",
    commitmentUsd: "250000.00",
    restriction: "project_restricted",
    publicMemo: "Transparency-only restoration funding record for watershed and planting milestones.",
    pledgedAt: "2026-07-08T00:00:00.000Z",
  };
}

function allocationPayload(sourceId: string, id: string) {
  return {
    id,
    sourceId,
    projectId: "project_canopyproof_funding_001",
    purpose: "Native tree survival monitoring and community water evidence review.",
    amountUsd: "125000.50",
    status: "approved",
    dropinAllocationId: "fund_allocation_existing_dropin_001",
    externalReference: "grant-memo-2026-001",
    createdAt: "2026-07-08T00:05:00.000Z",
  };
}

function milestonePayload(allocationId: string, id: string) {
  return {
    id,
    allocationId,
    projectId: "project_canopyproof_funding_001",
    title: "First survival audit and water-point field review",
    amountUsd: "25000.25",
    dueAt: "2026-10-08T00:00:00.000Z",
    evidenceRequirements: ["accepted field evidence", "review decision", "public reconciliation memo"],
    status: "evidence_required",
    createdAt: "2026-07-08T00:10:00.000Z",
  };
}

test("CanopyProof funding transparency service creates a hash-linked ledger without fund movement", () => {
  const service = new CanopyProofFundingTransparencyService();
  const source = service.registerFundingSource(fundingSourcePayload("cp_funding_source_domain_001"), "owner_funding_domain");

  assert.equal(source.commitmentUsd, "250000");
  assert.equal(source.auditHistory[0]?.entityType, "funding_source");
  assert.equal(service.getStatus().claimBoundary.noMainnetFunds, true);

  const allocation = service.createAllocation(allocationPayload(source.id, "cp_funding_allocation_domain_001"), "admin_funding_domain");
  assert.equal(allocation.status, "approved");
  assert.equal(allocation.amountUsd, "125000.50");
  assert.equal(allocation.dropinAllocationId, "fund_allocation_existing_dropin_001");
  assert.equal(allocation.auditHistory[0]?.entityType, "funding_allocation");

  const milestone = service.recordMilestone(milestonePayload(allocation.id, "cp_funding_milestone_domain_001"), "admin_funding_domain");
  assert.equal(milestone.status, "evidence_required");
  assert.equal(milestone.auditHistory[0]?.entityType, "funding_milestone");

  assert.throws(
    () =>
      service.updateMilestoneStatus(
        milestone.id,
        {
          status: "settled",
          rationale: "Attempted settlement before accepted evidence is linked.",
          changedAt: "2026-07-08T00:15:00.000Z",
        },
        "verifier_funding_domain",
      ),
    /requires accepted evidence/,
  );

  const evidenceLink = service.linkEvidenceToMilestone(
    milestone.id,
    {
      evidenceId: "evidence_canopyproof_funding_001",
      evidenceRoot: "a".repeat(64),
      reviewDecisionId: "review_canopyproof_funding_001",
      note: "Accepted field evidence and review decision linked to funding milestone.",
      linkedAt: "2026-07-08T00:20:00.000Z",
    },
    "community_funding_domain",
  );
  assert.equal(evidenceLink.auditEvent.entityType, "funding_evidence_link");

  const settled = service.updateMilestoneStatus(
    milestone.id,
    {
      status: "settled",
      rationale: "Evidence-backed milestone reconciliation; transparency only, no payment execution.",
      changedAt: "2026-07-08T00:25:00.000Z",
    },
    "verifier_funding_domain",
  );
  assert.equal(settled.status, "settled");
  assert.equal(service.getAllocation(allocation.id).status, "reconciled");

  const ledger = service.buildLedger("project_canopyproof_funding_001");
  assert.equal(ledger.totals.committedUsd, "250000");
  assert.equal(ledger.totals.allocatedUsd, "125000.50");
  assert.equal(ledger.totals.settledUsd, "25000.25");
  assert.ok(ledger.lineage.ledgerRoot.length >= 64);
  assert.equal(ledger.claimBoundary.notCarbonCredit, true);
  assert.equal(ledger.claimBoundary.notGuaranteedYield, true);
});

test("CanopyProof funding transparency refuses over-allocation and unsupported public claims", () => {
  const service = new CanopyProofFundingTransparencyService();
  const source = service.registerFundingSource(
    {
      ...fundingSourcePayload("cp_funding_source_guard_001"),
      commitmentUsd: "100.00",
    },
    "owner_funding_guard",
  );

  assert.throws(
    () =>
      service.createAllocation(
        {
          ...allocationPayload(source.id, "cp_funding_allocation_guard_001"),
          amountUsd: "100.01",
        },
        "admin_funding_guard",
      ),
    /exceeds source commitment/,
  );

  assert.throws(
    () =>
      service.registerFundingSource(
        {
          ...fundingSourcePayload("cp_funding_source_unsafe_001"),
          displayName: "Guaranteed RWA Yield Fund",
          publicMemo: "Guaranteed RWA yield for certified carbon credit buyers.",
        },
        "owner_funding_guard",
      ),
    /unsupported public claim/,
  );
});

test("CanopyProof funding API enforces RBAC and exposes observer-readable transparency ledger", async () => {
  const denied = await app.request("/canopyproof/funding/sources", {
    method: "POST",
    headers: headers("observer", "observer_funding_denied"),
    body: JSON.stringify(fundingSourcePayload("cp_funding_source_api_denied")),
  });
  assert.equal(denied.status, 403);

  const sourceResponse = await app.request("/canopyproof/funding/sources", {
    method: "POST",
    headers: headers("admin", "admin_funding_api"),
    body: JSON.stringify(fundingSourcePayload("cp_funding_source_api_001")),
  });
  assert.equal(sourceResponse.status, 201);
  const sourceBody = await json<{ ok: true; data: { id: string; commitmentUsd: string; auditHistory: Array<{ entityType: string }> } }>(
    sourceResponse,
  );
  assert.equal(sourceBody.data.id, "cp_funding_source_api_001");
  assert.equal(sourceBody.data.auditHistory[0]?.entityType, "funding_source");

  const allocationResponse = await app.request("/canopyproof/funding/allocations", {
    method: "POST",
    headers: headers("admin", "admin_funding_api"),
    body: JSON.stringify(allocationPayload(sourceBody.data.id, "cp_funding_allocation_api_001")),
  });
  assert.equal(allocationResponse.status, 201);
  const allocationBody = await json<{ ok: true; data: { id: string; status: string; dropinAllocationId: string } }>(allocationResponse);
  assert.equal(allocationBody.data.status, "approved");
  assert.equal(allocationBody.data.dropinAllocationId, "fund_allocation_existing_dropin_001");

  const milestoneResponse = await app.request("/canopyproof/funding/milestones", {
    method: "POST",
    headers: headers("owner", "owner_funding_api"),
    body: JSON.stringify(milestonePayload(allocationBody.data.id, "cp_funding_milestone_api_001")),
  });
  assert.equal(milestoneResponse.status, 201);
  const milestoneBody = await json<{ ok: true; data: { id: string; status: string } }>(milestoneResponse);
  assert.equal(milestoneBody.data.status, "evidence_required");

  const evidenceResponse = await app.request(`/canopyproof/funding/milestones/${milestoneBody.data.id}/evidence`, {
    method: "POST",
    headers: headers("community", "community_funding_api"),
    body: JSON.stringify({
      evidenceId: "evidence_canopyproof_funding_api_001",
      evidenceRoot: "b".repeat(64),
      proofRecordId: "proof_record_canopyproof_funding_api_001",
      note: "Accepted proof record linked to transparent funding milestone.",
      linkedAt: "2026-07-08T00:20:00.000Z",
    }),
  });
  assert.equal(evidenceResponse.status, 201);

  const settledResponse = await app.request(`/canopyproof/funding/milestones/${milestoneBody.data.id}`, {
    method: "PATCH",
    headers: headers("verifier", "verifier_funding_api"),
    body: JSON.stringify({
      status: "settled",
      rationale: "Evidence-linked reconciliation only; no mainnet funds moved.",
      changedAt: "2026-07-08T00:25:00.000Z",
    }),
  });
  assert.equal(settledResponse.status, 200);
  const settledBody = await json<{ ok: true; data: { status: string } }>(settledResponse);
  assert.equal(settledBody.data.status, "settled");

  const ledgerResponse = await app.request("/canopyproof/funding/ledger/project_canopyproof_funding_001", {
    headers: headers("observer", "observer_funding_reader"),
  });
  assert.equal(ledgerResponse.status, 200);
  const ledgerBody = await json<{
    ok: true;
    data: {
      projectId: string;
      totals: { allocatedUsd: string; settledUsd: string };
      claimBoundary: { noMainnetFunds: boolean; notPaymentRail: boolean };
      lineage: { ledgerRoot: string };
    };
  }>(ledgerResponse);
  assert.equal(ledgerBody.data.projectId, "project_canopyproof_funding_001");
  assert.equal(ledgerBody.data.totals.allocatedUsd, "125000.50");
  assert.equal(ledgerBody.data.totals.settledUsd, "25000.25");
  assert.equal(ledgerBody.data.claimBoundary.noMainnetFunds, true);
  assert.equal(ledgerBody.data.claimBoundary.notPaymentRail, true);
  assert.ok(ledgerBody.data.lineage.ledgerRoot.length >= 64);
});
