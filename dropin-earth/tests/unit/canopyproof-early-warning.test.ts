import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { CanopyProofEarlyWarningService } from "../../services/api/src/domain/canopyproof/early-warning.js";
import { app } from "../../services/api/src/app.js";

function headers(role: string, actorId = `${role}_risk_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function droughtSignalPayload() {
  return {
    riskClass: "drought",
    regionId: "region_ggw_sahel",
    projectId: "project_canopyproof_risk_001",
    sourceType: "terra_scene",
    sourceId: "terra_scene_drought_001",
    observedAt: "2026-07-08T00:00:00.000Z",
    indicators: {
      soilMoistureDeficit: 96,
      rainfallDeficit: 91,
      vegetationStress: 88,
    },
    confidenceScore: 95,
    summary: "Severe drought stress detected across monitored restoration corridor.",
    recommendedAudience: ["community", "ngo", "operator", "verifier"],
  };
}

test("CanopyProof early warning service converts bounded environmental signals into audited alerts", () => {
  const service = new CanopyProofEarlyWarningService();
  const { signal, alert } = service.ingestSignal(droughtSignalPayload(), "agent_risk_domain");

  assert.equal(signal.severity, "critical");
  assert.equal(signal.auditEvent.entityType, "risk_signal");
  assert.equal(alert.status, "review_required");
  assert.equal(alert.severity, "critical");
  assert.equal(alert.publicRelease.allowed, false);
  assert.equal(alert.auditHistory[0]?.entityType, "risk_alert");

  const acknowledgement = service.acknowledgeAlert(
    alert.id,
    {
      audience: ["community", "ngo"],
      note: "Community response team and NGO verifier acknowledged drought watch escalation.",
      acknowledgedAt: "2026-07-08T00:05:00.000Z",
    },
    "community_risk_domain",
  );
  assert.equal(acknowledgement.responseType, "acknowledge");
  assert.equal(acknowledgement.auditEvent.entityType, "risk_response");
  assert.equal(service.getAlert(alert.id).status, "acknowledged");

  assert.throws(
    () =>
      service.escalateAlert(
        alert.id,
        {
          targetAudience: ["government"],
          rationale: "Escalate for government operational coordination.",
          publicMessage: "Severe drought risk under review.",
          escalatedAt: "2026-07-08T00:10:00.000Z",
        },
        "verifier_risk_domain",
      ),
    /requires governancePolicyId and reviewedBy/,
  );

  const escalation = service.escalateAlert(
    alert.id,
    {
      targetAudience: ["government"],
      rationale: "Escalate for government operational coordination after verifier review.",
      publicMessage: "Severe drought risk under reviewed operational watch for region_ggw_sahel.",
      governancePolicyId: "governance_policy_risk_public_release_v1",
      reviewedBy: "verifier_risk_domain",
      escalatedAt: "2026-07-08T00:15:00.000Z",
    },
    "verifier_risk_domain",
  );
  assert.equal(escalation.responseType, "escalate");

  const escalatedAlert = service.getAlert(alert.id);
  assert.equal(escalatedAlert.status, "escalated");
  assert.equal(escalatedAlert.publicRelease.allowed, true);
  assert.equal(escalatedAlert.publicRelease.governancePolicyId, "governance_policy_risk_public_release_v1");
  assert.ok(escalatedAlert.audience.includes("government"));

  const dispatch = service.dispatchAlert(
    alert.id,
    {
      messageSummary: "Reviewed drought watch delivery for community, NGO, and government operational responders.",
      policyId: "governance_policy_risk_public_release_v1",
      dispatchedAt: "2026-07-08T00:20:00.000Z",
      recipients: [
        {
          audience: "community",
          recipientId: "participant_community_response_team",
          organizationId: "org_community_response_team",
          regionScope: "region_ggw_sahel",
          channel: "dashboard",
          deliveryStatus: "delivered",
        },
        {
          audience: "ngo",
          recipientId: "participant_ngo_verifier",
          organizationId: "org_ngo_verifier",
          regionScope: "region_ggw_sahel",
          channel: "partner_api",
          deliveryStatus: "delivered",
        },
        {
          audience: "government",
          recipientId: "participant_government_resilience_officer",
          organizationId: "org_government_resilience",
          regionScope: "region_ggw_sahel",
          channel: "email",
          deliveryStatus: "acknowledged",
        },
      ],
    },
    "verifier_risk_domain",
  );
  assert.equal(dispatch.receipts.length, 3);
  assert.ok(dispatch.dispatchRoot.length >= 64);
  assert.deepEqual(
    dispatch.receipts.map((receipt) => receipt.recipientAudience).sort(),
    ["community", "government", "ngo"],
  );
  assert.ok(dispatch.receipts.every((receipt) => receipt.auditEvent.entityType === "risk_alert_dispatch"));
  assert.ok(dispatch.receipts.every((receipt) => receipt.safety.noPrivateContactData));
  assert.ok(dispatch.receipts.every((receipt) => !receipt.recipientId.includes("@")));

  const playbook = service.getResponsePlaybook("cp_risk_playbook_drought_field_response_v1");
  assert.equal(playbook.riskClass, "drought");
  assert.deepEqual(playbook.requiredDispatchAudience, ["community", "ngo", "government"]);
  assert.equal(playbook.safety.notEmergencyDeclaration, true);

  const activation = service.activateResponsePlaybook(
    alert.id,
    {
      playbookId: playbook.id,
      dispatchReceiptIds: dispatch.receipts.map((receipt) => receipt.id),
      assignedAudience: ["community", "ngo", "government"],
      assignedOrganizationIds: ["org_community_response_team", "org_ngo_verifier", "org_government_resilience"],
      evidenceIds: ["evidence_drought_field_assessment_001"],
      note: "Activate drought field response coordination after verified delivery receipts.",
      activatedAt: "2026-07-08T00:25:00.000Z",
    },
    "verifier_risk_domain",
  );
  assert.equal(activation.activation.playbookId, playbook.id);
  assert.equal(activation.activation.auditEvent.entityType, "risk_response_activation");
  assert.equal(activation.activation.safety.aiCannotClosePlaybook, true);
  assert.ok(activation.activation.activationRoot.length >= 64);

  assert.throws(
    () =>
      service.closeResponseActivation(
        activation.activation.id,
        {
          decision: "complete",
          reviewerRole: "verifier",
          evidenceIds: ["evidence_drought_field_assessment_001"],
          completionSummary: "Agent cannot masquerade as the verifier reviewer for closure.",
          reviewedAt: "2026-07-08T00:30:00.000Z",
        },
        "agent_risk_domain",
        "community",
      ),
    /reviewer role must match/,
  );

  const closure = service.closeResponseActivation(
    activation.activation.id,
    {
      decision: "complete",
      reviewerRole: "verifier",
      evidenceIds: ["evidence_drought_field_assessment_001", "evidence_drought_government_receipt_001"],
      governanceApprovalIds: ["governance_approval_risk_response_playbook_001"],
      completionSummary: "Verifier reviewed drought response evidence and confirmed operational follow-up actions are complete.",
      reviewedAt: "2026-07-08T00:35:00.000Z",
    },
    "verifier_risk_domain",
    "verifier",
  );
  assert.equal(closure.decision, "complete");
  assert.equal(closure.auditEvent.entityType, "risk_response_closure");
  assert.equal(closure.safety.humanReviewRequired, true);
  assert.equal(closure.safety.aiIsNeverFinalAuthority, true);
  assert.ok(closure.evidenceRoot.length >= 64);

  const afterActionReview = service.reviewClosedResponse(
    closure.id,
    {
      outcome: "accepted",
      reviewerRole: "researcher",
      evidenceIds: ["evidence_drought_field_assessment_001", "evidence_drought_government_receipt_001"],
      lessonsLearned: ["Delivered government receipts reduced ambiguity before response closure."],
      governanceApprovalIds: ["governance_approval_risk_response_after_action_001"],
      reviewedAt: "2026-07-08T00:45:00.000Z",
    },
    "researcher_risk_after_action",
    "researcher",
  );
  assert.equal(afterActionReview.outcome, "accepted");
  assert.equal(afterActionReview.auditEvent.entityType, "risk_after_action_review");
  assert.equal(afterActionReview.safety.postIncidentOnly, true);
  assert.equal(afterActionReview.safety.aiIsNeverFinalAuthority, true);
  assert.equal(afterActionReview.closureRoot, closure.closureRoot);
  assert.ok(afterActionReview.reviewRoot.length >= 64);

  const overview = service.getOverview();
  assert.equal(overview.activeAlertCount, 1);
  assert.equal(overview.criticalAlertCount, 1);
  assert.equal(overview.dispatchReceiptCount, 3);
  assert.equal(overview.responseActivationCount, 1);
  assert.equal(overview.responseClosureCount, 1);
  assert.equal(overview.afterActionReviewCount, 1);
  assert.ok(overview.responsePlaybookCount >= 4);
  assert.equal(overview.byRiskClass.drought, 1);
  assert.equal(overview.publicClaimBoundary.noAutomatedEmergencyClaim, true);
  assert.ok(overview.lineage.dispatchRoot.length >= 64);
  assert.ok(overview.lineage.playbookRoot.length >= 64);
  assert.ok(overview.lineage.activationRoot.length >= 64);
  assert.ok(overview.lineage.closureRoot.length >= 64);
  assert.ok(overview.lineage.afterActionReviewRoot.length >= 64);
  assert.ok(overview.lineage.auditRoot.length >= 64);
});

test("CanopyProof early warning service refuses unsafe public risk claims", () => {
  const service = new CanopyProofEarlyWarningService();
  assert.throws(
    () =>
      service.ingestSignal(
        {
          ...droughtSignalPayload(),
          summary: "Official emergency declaration and guaranteed safety claim.",
        },
        "agent_risk_unsafe",
    ),
    /unsupported public claim/,
  );

  const { alert } = service.ingestSignal(droughtSignalPayload(), "agent_risk_safe_dispatch");
  service.escalateAlert(
    alert.id,
    {
      targetAudience: ["government"],
      rationale: "Escalate for government operational coordination before response testing.",
      escalatedAt: "2026-07-08T00:10:00.000Z",
    },
    "verifier_risk_safe_dispatch",
  );
  assert.throws(
    () =>
      service.dispatchAlert(
        alert.id,
        {
          messageSummary: "Official emergency declaration for private contact dispatch.",
          recipients: [
            {
              audience: "community",
              recipientId: "participant_community_response_team",
              channel: "dashboard",
            },
          ],
        },
        "agent_risk_safe_dispatch",
      ),
    /unsupported public claim/,
  );
  assert.throws(
    () =>
      service.dispatchAlert(
        alert.id,
        {
          messageSummary: "Reviewed drought watch delivery for operational responders.",
          recipients: [
            {
              audience: "community",
              recipientId: "ops@example.org",
              channel: "email",
            },
          ],
        },
        "agent_risk_safe_dispatch",
      ),
    /raw private contact data/,
  );

  const dispatch = service.dispatchAlert(
    alert.id,
    {
      messageSummary: "Reviewed drought watch delivery for operational responders.",
      recipients: [
        {
          audience: "community",
          recipientId: "participant_community_response_team",
          channel: "dashboard",
          deliveryStatus: "delivered",
        },
        {
          audience: "ngo",
          recipientId: "participant_ngo_response_team",
          channel: "partner_api",
          deliveryStatus: "delivered",
        },
        {
          audience: "government",
          recipientId: "participant_government_response_team",
          channel: "dashboard",
          deliveryStatus: "delivered",
        },
      ],
    },
    "agent_risk_safe_dispatch",
  );
  const activation = service.activateResponsePlaybook(
    alert.id,
    {
      playbookId: "cp_risk_playbook_drought_field_response_v1",
      dispatchReceiptIds: dispatch.receipts.map((receipt) => receipt.id),
      assignedAudience: ["community", "ngo", "government"],
      evidenceIds: ["evidence_drought_field_assessment_unsafe_001"],
      note: "Activate drought response for closure safety tests.",
    },
    "agent_risk_safe_dispatch",
  );
  assert.throws(
    () =>
      service.closeResponseActivation(
        activation.activation.id,
        {
          decision: "complete",
          reviewerRole: "verifier",
          evidenceIds: ["evidence_drought_field_assessment_unsafe_001"],
          completionSummary: "Official emergency declaration and guaranteed safety closure.",
        },
        "verifier_risk_unsafe",
        "verifier",
      ),
    /unsupported public claim/,
  );
  assert.throws(
    () =>
      service.closeResponseActivation(
        activation.activation.id,
        {
          decision: "challenge",
          reviewerRole: "verifier",
          evidenceIds: ["evidence_drought_field_assessment_unsafe_001"],
          completionSummary: "Challenge response closure because one field action remains disputed.",
        },
        "verifier_risk_unsafe",
        "verifier",
      ),
    /requires challengedReason/,
  );

  const challengedClosure = service.closeResponseActivation(
    activation.activation.id,
    {
      decision: "challenge",
      reviewerRole: "verifier",
      evidenceIds: ["evidence_drought_field_assessment_unsafe_001", "evidence_drought_disputed_action_001"],
      completionSummary: "Challenge response closure because one field action remains disputed.",
      unresolvedActions: ["Resolve disputed community water-stress observation."],
      challengedReason: "Community observation and verifier note disagree on field action completion.",
    },
    "verifier_risk_unsafe",
    "verifier",
  );
  assert.equal(challengedClosure.decision, "challenge");
  assert.throws(
    () =>
      service.reviewClosedResponse(
        challengedClosure.id,
        {
          outcome: "accepted",
          reviewerRole: "researcher",
          evidenceIds: challengedClosure.evidenceIds,
          lessonsLearned: ["Challenged closure cannot be accepted without follow-up."],
        },
        "researcher_risk_unsafe",
        "researcher",
      ),
    /challenged response closures require follow-up/,
  );
  assert.throws(
    () =>
      service.reviewClosedResponse(
        challengedClosure.id,
        {
          outcome: "escalated_to_governance",
          reviewerRole: "researcher",
          evidenceIds: challengedClosure.evidenceIds,
          lessonsLearned: ["Governance escalation must be linked to policy recommendation IDs."],
          correctiveActions: ["Open policy review for disputed closure protocol."],
        },
        "researcher_risk_unsafe",
        "researcher",
      ),
    /requires at least one policyRecommendationId/,
  );
  assert.throws(
    () =>
      service.reviewClosedResponse(
        challengedClosure.id,
        {
          outcome: "needs_follow_up",
          reviewerRole: "researcher",
          evidenceIds: ["evidence_drought_disputed_action_001"],
          lessonsLearned: ["All closure evidence must remain bound to the after-action review."],
          correctiveActions: ["Collect an additional field observation."],
        },
        "researcher_risk_unsafe",
        "researcher",
      ),
    /must preserve closure evidence reference/,
  );
});

test("CanopyProof early warning API enforces RBAC and public release guardrails", async () => {
  const denied = await app.request("/canopyproof/risk/signals", {
    method: "POST",
    headers: headers("observer", "observer_risk_denied"),
    body: JSON.stringify(droughtSignalPayload()),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/canopyproof/risk/signals", {
    method: "POST",
    headers: headers("agent", "agent_risk_api"),
    body: JSON.stringify({
      ...droughtSignalPayload(),
      sourceId: "terra_scene_drought_api_001",
    }),
  });
  assert.equal(created.status, 202);
  const createdBody = await json<{
    ok: true;
    data: {
      signal: { severity: string; auditEvent: { entityType: string } };
      alert: { id: string; status: string; publicRelease: { allowed: boolean } };
    };
  }>(created);
  assert.equal(createdBody.data.signal.severity, "critical");
  assert.equal(createdBody.data.alert.status, "review_required");
  assert.equal(createdBody.data.alert.publicRelease.allowed, false);

  const alerts = await app.request("/canopyproof/risk/alerts?riskClass=drought", {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(alerts.status, 200);
  const alertsBody = await json<{ ok: true; data: Array<{ id: string; severity: string }> }>(alerts);
  assert.ok(alertsBody.data.some((alert) => alert.id === createdBody.data.alert.id && alert.severity === "critical"));

  const acknowledgement = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/acknowledge`, {
    method: "POST",
    headers: headers("community", "community_risk_api"),
    body: JSON.stringify({
      audience: ["community", "ngo"],
      note: "Community observers acknowledged and opened field check.",
      acknowledgedAt: "2026-07-08T00:05:00.000Z",
    }),
  });
  assert.equal(acknowledgement.status, 201);

  const escalationDenied = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/escalate`, {
    method: "POST",
    headers: headers("observer", "observer_risk_denied"),
    body: JSON.stringify({
      targetAudience: ["government"],
      rationale: "Observer cannot escalate.",
    }),
  });
  assert.equal(escalationDenied.status, 403);

  const escalationGuard = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/escalate`, {
    method: "POST",
    headers: headers("verifier", "verifier_risk_api"),
    body: JSON.stringify({
      targetAudience: ["government"],
      rationale: "Escalation requires public release review.",
      publicMessage: "Reviewed drought watch pending field confirmation.",
      escalatedAt: "2026-07-08T00:10:00.000Z",
    }),
  });
  assert.equal(escalationGuard.status, 400);

  const escalated = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/escalate`, {
    method: "POST",
    headers: headers("verifier", "verifier_risk_api"),
    body: JSON.stringify({
      targetAudience: ["government"],
      rationale: "Escalate after verifier review and policy check.",
      publicMessage: "Reviewed drought risk watch for region_ggw_sahel; operational coordination requested.",
      governancePolicyId: "governance_policy_risk_public_release_v1",
      reviewedBy: "verifier_risk_api",
      escalatedAt: "2026-07-08T00:15:00.000Z",
    }),
  });
  assert.equal(escalated.status, 201);

  const dispatchDenied = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/dispatches`, {
    method: "POST",
    headers: headers("observer", "observer_risk_denied"),
    body: JSON.stringify({
      messageSummary: "Observer cannot dispatch operational alert receipts.",
      recipients: [
        {
          audience: "community",
          recipientId: "participant_community_api",
          channel: "dashboard",
        },
      ],
    }),
  });
  assert.equal(dispatchDenied.status, 403);

  const dispatch = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/dispatches`, {
    method: "POST",
    headers: headers("agent", "agent_risk_dispatcher"),
    body: JSON.stringify({
      messageSummary: "Reviewed drought watch delivery for community, NGO, and government operational responders.",
      policyId: "governance_policy_risk_public_release_v1",
      dispatchedAt: "2026-07-08T00:20:00.000Z",
      recipients: [
        {
          audience: "community",
          recipientId: "participant_community_api",
          organizationId: "org_community_api",
          regionScope: "region_ggw_sahel",
          channel: "dashboard",
          deliveryStatus: "delivered",
        },
        {
          audience: "ngo",
          recipientId: "participant_ngo_api",
          organizationId: "org_ngo_api",
          regionScope: "region_ggw_sahel",
          channel: "partner_api",
          deliveryStatus: "delivered",
        },
        {
          audience: "government",
          recipientId: "participant_government_api",
          organizationId: "org_government_api",
          regionScope: "region_ggw_sahel",
          channel: "email",
          deliveryStatus: "acknowledged",
        },
      ],
    }),
  });
  assert.equal(dispatch.status, 201);
  const dispatchBody = await json<{
    ok: true;
    data: {
      dispatchRoot: string;
      receipts: Array<{
        id: string;
        recipientAudience: string;
        channel: string;
        deliveryStatus: string;
        auditEvent: { entityType: string };
        safety: { noPrivateContactData: boolean; noAutomatedEmergencyClaim: boolean };
      }>;
    };
  }>(dispatch);
  assert.equal(dispatchBody.data.receipts.length, 3);
  assert.ok(dispatchBody.data.dispatchRoot.length >= 64);
  assert.ok(dispatchBody.data.receipts.some((receipt) => receipt.recipientAudience === "government" && receipt.channel === "email"));
  assert.ok(dispatchBody.data.receipts.every((receipt) => receipt.auditEvent.entityType === "risk_alert_dispatch"));
  assert.ok(dispatchBody.data.receipts.every((receipt) => receipt.safety.noPrivateContactData));
  assert.ok(dispatchBody.data.receipts.every((receipt) => receipt.safety.noAutomatedEmergencyClaim));

  const playbooks = await app.request("/canopyproof/risk/playbooks?riskClass=drought&audience=government", {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(playbooks.status, 200);
  const playbooksBody = await json<{ ok: true; data: Array<{ id: string; safety: { notEmergencyDeclaration: boolean } }> }>(playbooks);
  assert.ok(playbooksBody.data.some((playbook) => playbook.id === "cp_risk_playbook_drought_field_response_v1"));
  assert.ok(playbooksBody.data.every((playbook) => playbook.safety.notEmergencyDeclaration));

  const activationDenied = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/playbook-activations`, {
    method: "POST",
    headers: headers("observer", "observer_risk_denied"),
    body: JSON.stringify({
      playbookId: "cp_risk_playbook_drought_field_response_v1",
      dispatchReceiptIds: dispatchBody.data.receipts.map((receipt) => receipt.id),
      assignedAudience: ["community", "ngo", "government"],
      note: "Observer cannot activate a response playbook.",
    }),
  });
  assert.equal(activationDenied.status, 403);

  const activation = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/playbook-activations`, {
    method: "POST",
    headers: headers("community", "community_risk_responder"),
    body: JSON.stringify({
      playbookId: "cp_risk_playbook_drought_field_response_v1",
      dispatchReceiptIds: dispatchBody.data.receipts.map((receipt) => receipt.id),
      assignedAudience: ["community", "ngo", "government"],
      assignedOrganizationIds: ["org_community_api", "org_ngo_api", "org_government_api"],
      evidenceIds: ["evidence_drought_field_assessment_api_001"],
      note: "Activate drought field response coordination after verified delivery receipts.",
      activatedAt: "2026-07-08T00:25:00.000Z",
    }),
  });
  assert.equal(activation.status, 201);
  const activationBody = await json<{
    ok: true;
    data: {
      playbook: { id: string; safety: { operationalOnly: boolean } };
      activation: { id: string; status: string; auditEvent: { entityType: string }; safety: { aiCannotClosePlaybook: boolean } };
    };
  }>(activation);
  assert.equal(activationBody.data.playbook.id, "cp_risk_playbook_drought_field_response_v1");
  assert.equal(activationBody.data.playbook.safety.operationalOnly, true);
  assert.equal(activationBody.data.activation.status, "opened");
  assert.equal(activationBody.data.activation.auditEvent.entityType, "risk_response_activation");
  assert.equal(activationBody.data.activation.safety.aiCannotClosePlaybook, true);

  const closureAgentDenied = await app.request(`/canopyproof/risk/playbook-activations/${activationBody.data.activation.id}/closures`, {
    method: "POST",
    headers: headers("agent", "agent_risk_closure_denied"),
    body: JSON.stringify({
      decision: "complete",
      reviewerRole: "verifier",
      evidenceIds: ["evidence_drought_field_assessment_api_001"],
      completionSummary: "Agent cannot close a response playbook as final authority.",
    }),
  });
  assert.equal(closureAgentDenied.status, 403);

  const closureMismatch = await app.request(`/canopyproof/risk/playbook-activations/${activationBody.data.activation.id}/closures`, {
    method: "POST",
    headers: headers("community", "community_risk_responder"),
    body: JSON.stringify({
      decision: "complete",
      reviewerRole: "verifier",
      evidenceIds: ["evidence_drought_field_assessment_api_001"],
      completionSummary: "Reviewer role must match authenticated actor role.",
    }),
  });
  assert.equal(closureMismatch.status, 403);

  const closure = await app.request(`/canopyproof/risk/playbook-activations/${activationBody.data.activation.id}/closures`, {
    method: "POST",
    headers: headers("verifier", "verifier_risk_closure"),
    body: JSON.stringify({
      decision: "complete",
      reviewerRole: "verifier",
      evidenceIds: ["evidence_drought_field_assessment_api_001", "evidence_drought_government_receipt_api_001"],
      governanceApprovalIds: ["governance_approval_risk_response_playbook_api_001"],
      completionSummary: "Verifier reviewed drought response evidence and confirmed operational follow-up actions are complete.",
      reviewedAt: "2026-07-08T00:35:00.000Z",
    }),
  });
  assert.equal(closure.status, 201);
  const closureBody = await json<{
    ok: true;
    data: {
      id: string;
      decision: string;
      reviewerRole: string;
      evidenceRoot: string;
      auditEvent: { entityType: string };
      safety: { humanReviewRequired: boolean; aiIsNeverFinalAuthority: boolean };
    };
  }>(closure);
  assert.equal(closureBody.data.decision, "complete");
  assert.equal(closureBody.data.reviewerRole, "verifier");
  assert.ok(closureBody.data.evidenceRoot.length >= 64);
  assert.equal(closureBody.data.auditEvent.entityType, "risk_response_closure");
  assert.equal(closureBody.data.safety.humanReviewRequired, true);
  assert.equal(closureBody.data.safety.aiIsNeverFinalAuthority, true);

  const closures = await app.request(`/canopyproof/risk/playbook-activations/${activationBody.data.activation.id}/closures`, {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(closures.status, 200);
  const closuresBody = await json<{ ok: true; data: Array<{ id: string; decision: string }> }>(closures);
  assert.ok(closuresBody.data.some((item) => item.id === closureBody.data.id && item.decision === "complete"));

  const closureRead = await app.request(`/canopyproof/risk/response-closures/${closureBody.data.id}`, {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(closureRead.status, 200);

  const afterActionDenied = await app.request(`/canopyproof/risk/response-closures/${closureBody.data.id}/after-action-reviews`, {
    method: "POST",
    headers: headers("community", "community_risk_after_action_denied"),
    body: JSON.stringify({
      outcome: "accepted",
      reviewerRole: "researcher",
      evidenceIds: ["evidence_drought_field_assessment_api_001", "evidence_drought_government_receipt_api_001"],
      lessonsLearned: ["Community actors cannot submit institutional after-action review decisions."],
    }),
  });
  assert.equal(afterActionDenied.status, 403);

  const afterActionReview = await app.request(`/canopyproof/risk/response-closures/${closureBody.data.id}/after-action-reviews`, {
    method: "POST",
    headers: headers("researcher", "researcher_risk_after_action"),
    body: JSON.stringify({
      outcome: "accepted",
      reviewerRole: "researcher",
      evidenceIds: ["evidence_drought_field_assessment_api_001", "evidence_drought_government_receipt_api_001"],
      lessonsLearned: ["Delivered government receipts reduced ambiguity before response closure."],
      governanceApprovalIds: ["governance_approval_risk_response_after_action_api_001"],
      reviewedAt: "2026-07-08T00:45:00.000Z",
    }),
  });
  assert.equal(afterActionReview.status, 201);
  const afterActionReviewBody = await json<{
    ok: true;
    data: {
      id: string;
      outcome: string;
      closureRoot: string;
      reviewRoot: string;
      auditEvent: { entityType: string };
      safety: { postIncidentOnly: boolean; aiIsNeverFinalAuthority: boolean };
    };
  }>(afterActionReview);
  assert.equal(afterActionReviewBody.data.outcome, "accepted");
  assert.equal(afterActionReviewBody.data.auditEvent.entityType, "risk_after_action_review");
  assert.equal(afterActionReviewBody.data.safety.postIncidentOnly, true);
  assert.equal(afterActionReviewBody.data.safety.aiIsNeverFinalAuthority, true);
  assert.ok(afterActionReviewBody.data.reviewRoot.length >= 64);

  const afterActionReviews = await app.request(`/canopyproof/risk/response-closures/${closureBody.data.id}/after-action-reviews`, {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(afterActionReviews.status, 200);
  const afterActionReviewsBody = await json<{ ok: true; data: Array<{ id: string; outcome: string }> }>(afterActionReviews);
  assert.ok(afterActionReviewsBody.data.some((item) => item.id === afterActionReviewBody.data.id && item.outcome === "accepted"));

  const afterActionRead = await app.request(`/canopyproof/risk/after-action-reviews/${afterActionReviewBody.data.id}`, {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(afterActionRead.status, 200);

  const activations = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/playbook-activations`, {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(activations.status, 200);
  const activationsBody = await json<{ ok: true; data: Array<{ id: string; playbookId: string }> }>(activations);
  assert.ok(activationsBody.data.some((item) => item.id === activationBody.data.activation.id));

  const activationRead = await app.request(`/canopyproof/risk/playbook-activations/${activationBody.data.activation.id}`, {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(activationRead.status, 200);

  const dispatches = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}/dispatches`, {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(dispatches.status, 200);
  const dispatchesBody = await json<{ ok: true; data: Array<{ id: string; recipientAudience: string }> }>(dispatches);
  assert.ok(dispatchesBody.data.some((receipt) => receipt.recipientAudience === "government"));

  const receipt = await app.request(`/canopyproof/risk/dispatches/${dispatchBody.data.receipts[0]?.id}`, {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(receipt.status, 200);

  const alert = await app.request(`/canopyproof/risk/alerts/${createdBody.data.alert.id}`, {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(alert.status, 200);
  const alertBody = await json<{ ok: true; data: { status: string; publicRelease: { allowed: boolean }; audience: string[] } }>(alert);
  assert.equal(alertBody.data.status, "escalated");
  assert.equal(alertBody.data.publicRelease.allowed, true);
  assert.ok(alertBody.data.audience.includes("government"));

  const overview = await app.request("/canopyproof/risk/overview", {
    headers: headers("observer", "observer_risk_reader"),
  });
  assert.equal(overview.status, 200);
  const overviewBody = await json<{
    ok: true;
    data: {
      activeAlertCount: number;
      responseActivationCount: number;
      responseClosureCount: number;
      afterActionReviewCount: number;
      publicClaimBoundary: { noAutomatedEmergencyClaim: boolean };
    };
  }>(overview);
  assert.ok(overviewBody.data.activeAlertCount >= 1);
  assert.ok(overviewBody.data.responseActivationCount >= 1);
  assert.ok(overviewBody.data.responseClosureCount >= 1);
  assert.ok(overviewBody.data.afterActionReviewCount >= 1);
  assert.equal(overviewBody.data.publicClaimBoundary.noAutomatedEmergencyClaim, true);
});

test("CanopyProof early warning SQL declares alert dispatch receipts as append-only audited records", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS impact\.risk_alert_dispatch_receipts/);
  assert.match(sql, /recipient_audience text NOT NULL CHECK \(recipient_audience IN \('community', 'ngo', 'government', 'operator', 'verifier'\)\)/);
  assert.match(sql, /channel text NOT NULL CHECK \(channel IN \('dashboard', 'email', 'sms', 'webhook', 'field_ops', 'partner_api'\)\)/);
  assert.match(sql, /delivery_status text NOT NULL CHECK \(delivery_status IN \('queued', 'delivered', 'failed', 'acknowledged'\)\)/);
  assert.match(sql, /CHECK \(\(safety->>'noPrivateContactData'\)::boolean IS TRUE\)/);
  assert.match(sql, /DROP TRIGGER IF EXISTS impact_risk_alert_dispatch_receipts_no_update ON impact\.risk_alert_dispatch_receipts/);
  assert.match(sql, /DROP TRIGGER IF EXISTS impact_risk_alert_dispatch_receipts_no_delete ON impact\.risk_alert_dispatch_receipts/);
  assert.match(sql, /CREATE TRIGGER impact_risk_alert_dispatch_receipts_audit AFTER INSERT OR UPDATE OR DELETE ON impact\.risk_alert_dispatch_receipts/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS impact\.risk_response_playbooks/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS impact\.risk_response_activations/);
  assert.match(sql, /CHECK \(\(safety->>'notEmergencyDeclaration'\)::boolean IS TRUE\)/);
  assert.match(sql, /CHECK \(\(safety->>'aiCannotClosePlaybook'\)::boolean IS TRUE\)/);
  assert.match(sql, /DROP TRIGGER IF EXISTS impact_risk_response_playbooks_no_update ON impact\.risk_response_playbooks/);
  assert.match(sql, /DROP TRIGGER IF EXISTS impact_risk_response_activations_no_delete ON impact\.risk_response_activations/);
  assert.match(sql, /CREATE TRIGGER impact_risk_response_activations_audit AFTER INSERT OR UPDATE OR DELETE ON impact\.risk_response_activations/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS impact\.risk_response_closures/);
  assert.match(sql, /reviewer_role text NOT NULL CHECK \(reviewer_role IN \('owner', 'admin', 'verifier', 'researcher', 'community'\)\)/);
  assert.match(sql, /CHECK \(\(safety->>'humanReviewRequired'\)::boolean IS TRUE\)/);
  assert.match(sql, /CHECK \(\(safety->>'aiIsNeverFinalAuthority'\)::boolean IS TRUE\)/);
  assert.match(sql, /DROP TRIGGER IF EXISTS impact_risk_response_closures_no_update ON impact\.risk_response_closures/);
  assert.match(sql, /DROP TRIGGER IF EXISTS impact_risk_response_closures_no_delete ON impact\.risk_response_closures/);
  assert.match(sql, /CREATE TRIGGER impact_risk_response_closures_audit AFTER INSERT OR UPDATE OR DELETE ON impact\.risk_response_closures/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS impact\.risk_after_action_reviews/);
  assert.match(sql, /outcome text NOT NULL CHECK \(outcome IN \('accepted', 'needs_follow_up', 'escalated_to_governance'\)\)/);
  assert.match(sql, /reviewer_role text NOT NULL CHECK \(reviewer_role IN \('owner', 'admin', 'verifier', 'researcher'\)\)/);
  assert.match(sql, /CHECK \(outcome <> 'escalated_to_governance' OR array_length\(policy_recommendation_ids, 1\) > 0\)/);
  assert.match(sql, /CHECK \(\(safety->>'postIncidentOnly'\)::boolean IS TRUE\)/);
  assert.match(sql, /DROP TRIGGER IF EXISTS impact_risk_after_action_reviews_no_update ON impact\.risk_after_action_reviews/);
  assert.match(sql, /DROP TRIGGER IF EXISTS impact_risk_after_action_reviews_no_delete ON impact\.risk_after_action_reviews/);
  assert.match(sql, /CREATE TRIGGER impact_risk_after_action_reviews_audit AFTER INSERT OR UPDATE OR DELETE ON impact\.risk_after_action_reviews/);
});
