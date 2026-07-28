import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import {
  buildCanopyProofProofRecordSubjectId,
  CanopyProofGovernanceService,
} from "../../services/api/src/domain/canopyproof/governance.js";

function headers(role: string, actorId = `${role}_governance_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test("CanopyProof governance API exposes policies and records role-bound approvals", async () => {
  const subjectId = buildCanopyProofProofRecordSubjectId({
    projectId: "project_governance_api_001",
    evidenceIds: ["evidence_governance_api_001"],
  });

  const status = await app.request("/canopyproof/governance/status", {
    headers: headers("observer", "observer_governance_status"),
  });
  const statusBody = await json<{
    ok: true;
    data: {
      service: string;
      policyCount: number;
      safety: { humanAuthorityRequired: true; publicClaimsBounded: true };
      governanceRoot: string;
    };
  }>(status);

  assert.equal(status.status, 200);
  assert.equal(statusBody.data.service, "canopyproof-governance");
  assert.ok(statusBody.data.policyCount >= 5);
  assert.equal(statusBody.data.safety.humanAuthorityRequired, true);
  assert.equal(statusBody.data.safety.publicClaimsBounded, true);
  assert.ok(statusBody.data.governanceRoot.length > 20);

  const policies = await app.request("/canopyproof/governance/policies?subjectType=proof_record", {
    headers: headers("researcher", "researcher_governance_policy_reader"),
  });
  const policyBody = await json<{
    ok: true;
    data: Array<{ id: string; appliesTo: string[]; allowedReviewerRoles: string[]; requiredApprovals: number }>;
  }>(policies);

  assert.equal(policies.status, 200);
  assert.ok(policyBody.data.some((policy) => policy.id === "canopyproof_policy_proof_record_issuance_v1"));
  assert.ok(policyBody.data.every((policy) => policy.appliesTo.includes("proof_record")));

  const riskPlaybookPolicies = await app.request("/canopyproof/governance/policies?subjectType=risk_response_playbook", {
    headers: headers("researcher", "researcher_governance_policy_reader"),
  });
  const riskPlaybookPolicyBody = await json<{ ok: true; data: Array<{ id: string; appliesTo: string[]; allowedReviewerRoles: string[] }> }>(
    riskPlaybookPolicies,
  );
  assert.equal(riskPlaybookPolicies.status, 200);
  assert.ok(riskPlaybookPolicyBody.data.some((policy) => policy.id === "canopyproof_policy_risk_response_playbook_v1"));
  assert.ok(riskPlaybookPolicyBody.data.every((policy) => policy.appliesTo.includes("risk_response_playbook")));

  const deniedApproval = await app.request("/canopyproof/governance/approvals", {
    method: "POST",
    body: JSON.stringify({
      subjectType: "proof_record",
      subjectId,
      policyId: "canopyproof_policy_proof_record_issuance_v1",
      decision: "approve",
      rationale: "Community actors cannot approve public proof issuance.",
      conflictDisclosure: "No known conflict disclosed.",
    }),
    headers: headers("community", "community_governance_denied"),
  });
  assert.equal(deniedApproval.status, 403);

  const approval = await app.request("/canopyproof/governance/approvals", {
    method: "POST",
    body: JSON.stringify({
      subjectType: "proof_record",
      subjectId,
      policyId: "canopyproof_policy_proof_record_issuance_v1",
      decision: "approve",
      rationale: "Verifier approved the exact proof issuance subject after evidence and review gates.",
      conflictDisclosure: "No known conflict disclosed.",
      decidedAt: "2026-07-08T04:00:00.000Z",
    }),
    headers: headers("verifier", "verifier_governance_approval_api"),
  });
  const approvalBody = await json<{
    ok: true;
    data: { id: string; subjectId: string; reviewer: string; reviewerRole: string; auditEvent: { entityType: string } };
  }>(approval);

  assert.equal(approval.status, 201);
  assert.equal(approvalBody.data.subjectId, subjectId);
  assert.equal(approvalBody.data.reviewer, "verifier_governance_approval_api");
  assert.equal(approvalBody.data.reviewerRole, "verifier");
  assert.equal(approvalBody.data.auditEvent.entityType, "governance_approval");

  const listed = await app.request(`/canopyproof/governance/approvals?subjectId=${encodeURIComponent(subjectId)}`, {
    headers: headers("observer", "observer_governance_approval_reader"),
  });
  const listedBody = await json<{ ok: true; data: Array<{ id: string }> }>(listed);

  assert.equal(listed.status, 200);
  assert.ok(listedBody.data.some((item) => item.id === approvalBody.data.id));

  const playbookApproval = await app.request("/canopyproof/governance/approvals", {
    method: "POST",
    body: JSON.stringify({
      subjectType: "risk_response_playbook",
      subjectId: "cp_risk_playbook_drought_field_response_v1",
      policyId: "canopyproof_policy_risk_response_playbook_v1",
      decision: "approve",
      rationale: "Research reviewer approved the bounded response playbook without emergency, carbon-credit, or financial claims.",
      conflictDisclosure: "No known conflict disclosed.",
      decidedAt: "2026-07-08T04:15:00.000Z",
    }),
    headers: headers("researcher", "researcher_governance_playbook_approval"),
  });
  const playbookApprovalBody = await json<{ ok: true; data: { subjectType: string; subjectId: string; auditEvent: { entityType: string } } }>(
    playbookApproval,
  );
  assert.equal(playbookApproval.status, 201);
  assert.equal(playbookApprovalBody.data.subjectType, "risk_response_playbook");
  assert.equal(playbookApprovalBody.data.subjectId, "cp_risk_playbook_drought_field_response_v1");
  assert.equal(playbookApprovalBody.data.auditEvent.entityType, "governance_approval");
});

test("CanopyProof governance validation rejects unresolved conflict disclosures", () => {
  const service = new CanopyProofGovernanceService();
  const subjectId = buildCanopyProofProofRecordSubjectId({
    projectId: "project_governance_conflict_001",
    evidenceIds: ["evidence_governance_conflict_001"],
  });

  const disclosure = service.recordConflictDisclosure(
    {
      subjectType: "proof_record",
      subjectId,
      severity: "high",
      status: "open",
      disclosure: "Reviewer has a direct operating relationship with the field organization.",
      recordedAt: "2026-07-08T04:05:00.000Z",
    },
    "verifier_governance_conflicted",
  );
  const approval = service.createApproval(
    {
      subjectType: "proof_record",
      subjectId,
      policyId: "canopyproof_policy_proof_record_issuance_v1",
      decision: "approve",
      rationale: "Approval cannot pass while a conflict disclosure is unresolved.",
      conflictDisclosure: "Potential conflict disclosed separately.",
      decidedAt: "2026-07-08T04:10:00.000Z",
    },
    "verifier_governance_conflicted",
    "verifier",
  );

  assert.equal(disclosure.status, "open");
  assert.throws(
    () =>
      service.validateApprovalReferences({
        subjectType: "proof_record",
        subjectId,
        approvalIds: [approval.id],
      }),
    /unresolved conflict disclosures/,
  );
});
