import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofProjectRegistryService } from "../../services/api/src/domain/canopyproof/project-registry.js";

function headers(role: string, actorId = `${role}_project_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function organizationPayload(id: string) {
  return {
    id,
    name: "CanopyProof Sahel Observatory",
    organizationType: "ngo",
    jurisdiction: "Senegal",
    publicContact: "projects@example.org",
    operatingRegions: ["region_ggw_sahel"],
    verificationCapabilities: ["field review", "satellite interpretation"],
    dataSharingPolicy: "restricted",
    createdAt: "2026-07-08T00:00:00.000Z",
  };
}

function projectPayload(organizationId: string, id = "cp_project_registry_api_001") {
  return {
    id,
    organizationId,
    title: "Great Green Wall Community Restoration Block",
    projectType: "reforestation",
    regionId: "region_ggw_sahel",
    location: {
      latitude: 14.7167,
      longitude: -17.4677,
      areaHectares: 125.5,
      boundaryHash: "7".repeat(64),
    },
    targetTreeCount: 50000,
    biodiversityIndicators: ["native species mix", "pollinator corridor"],
    waterIndicators: ["soil moisture recovery", "runoff reduction"],
    climateRiskIndicators: ["drought exposure", "heat stress"],
    monitoringCadenceDays: 60,
    createdAt: "2026-07-08T00:05:00.000Z",
  };
}

test("CanopyProof project registry creates audited bounded project profiles", () => {
  const service = new CanopyProofProjectRegistryService();
  const project = service.registerProject(projectPayload("cp_org_project_domain_001", "cp_project_domain_001"), "verifier_project_domain");

  assert.equal(project.status, "submitted");
  assert.equal(project.claimBoundary.notCertifiedCarbonCredit, true);
  assert.equal(project.claimBoundary.notGuaranteedYield, true);
  assert.equal(project.auditHistory[0]?.entityType, "project");
  assert.equal(project.auditHistory[0]?.action, "ASSERT");
  assert.match(project.projectHash, /^[a-f0-9]{64}$/);
  assert.equal(service.getStatus().projectCount, 1);
  assert.equal(service.getStatus().safety.activeStatusRequiresGovernanceApproval, true);

  assert.throws(
    () =>
      service.registerProject(
        {
          ...projectPayload("cp_org_project_domain_001", "cp_project_domain_unsafe"),
          title: "Certified carbon credit restoration instrument",
        },
        "verifier_project_domain",
      ),
    /unsupported public claim/,
  );

  assert.throws(
    () =>
      service.updateProjectStatus(
        project.id,
        {
          status: "active",
          rationale: "Attempted active transition cannot skip institutional review.",
          updatedAt: "2026-07-08T00:09:00.000Z",
        },
        "verifier_project_domain",
      ),
    /cannot transition from submitted to active/,
  );

  const underReview = service.updateProjectStatus(
    project.id,
    {
      status: "under_review",
      rationale: "Institutional review opened before any project activation decision.",
      updatedAt: "2026-07-08T00:09:00.000Z",
    },
    "verifier_project_domain",
  );
  assert.equal(underReview.status, "under_review");

  assert.throws(
    () =>
      service.updateProjectStatus(
        project.id,
        {
          status: "active",
          rationale: "Attempted active transition without governance approval.",
          updatedAt: "2026-07-08T00:10:00.000Z",
        },
        "verifier_project_domain",
      ),
    /requires governance approval/,
  );

  const active = service.updateProjectStatus(
    project.id,
    {
      status: "active",
      governanceApprovalId: "cp_governance_project_approval_001",
      rationale: "Governance approval received after partner and project review.",
      updatedAt: "2026-07-08T00:10:00.000Z",
    },
    "verifier_project_domain",
  );

  assert.equal(active.status, "active");
  assert.equal(active.governanceApprovalId, "cp_governance_project_approval_001");
  assert.equal(active.auditHistory.at(-1)?.action, "FULFILL");
  assert.equal(service.getStatus().activeProjectCount, 1);
  assert.equal(service.getStatus().statusTransitionCount, 2);

  assert.throws(
    () =>
      service.recordMonitoringEvent(
        project.id,
        {
          eventType: "field_observation",
          observedAt: "2026-07-08T00:20:00.000Z",
          rationale: "Attempted monitoring event without linked evidence or TerraProof scene.",
        },
        "verifier_project_domain",
      ),
    /require evidenceIds or terraSceneIds/,
  );

  const monitoringEvent = service.recordMonitoringEvent(
    project.id,
    {
      eventType: "survival_check",
      observedAt: "2026-07-08T00:20:00.000Z",
      evidenceIds: ["cp_evidence_project_monitoring_001"],
      terraSceneIds: ["cp_terra_scene_project_monitoring_001"],
      biodiversityIndicators: ["seedling survival"],
      waterIndicators: ["soil moisture recovery"],
      climateRiskIndicators: ["drought exposure"],
      metrics: {
        survivalPercent: 88,
        soilMoisturePercent: 31,
      },
      state: "accepted",
      rationale: "Seasonal monitoring linked field evidence and TerraProof scene for registry continuity.",
    },
    "verifier_project_domain",
  );

  assert.equal(monitoringEvent.projectId, project.id);
  assert.equal(monitoringEvent.auditEvent.entityType, "project_monitoring_event");
  assert.equal(monitoringEvent.auditEvent.action, "ASSERT");
  assert.match(monitoringEvent.eventHash, /^[a-f0-9]{64}$/);
  assert.equal(service.getProject(project.id).status, "monitored");
  assert.equal(service.listMonitoringEvents({ projectId: project.id }).length, 1);
  assert.equal(service.getStatus().monitoringEventCount, 1);
  assert.equal(service.getStatus().safety.monitoringEventsAreAudited, true);
});

test("CanopyProof project authority replay rejects missing predecessors and tampered immutable facts", () => {
  const service = new CanopyProofProjectRegistryService();
  const registration = service.registerProject(
    {
      ...projectPayload("cp_org_project_replay_001", "cp_project_replay_001"),
      governancePolicyId: "cp_project_replay_policy_001",
    },
    "owner_project_replay",
    "owner",
  );
  service.updateProjectStatus(
    registration.id,
    {
      status: "under_review",
      rationale: "Independent review opened before replayable project activation.",
      updatedAt: "2026-07-08T00:09:00.000Z",
    },
    "verifier_project_replay",
    "verifier",
  );
  service.updateProjectStatus(
    registration.id,
    {
      status: "active",
      governanceApprovalId: "cp_project_replay_approval_001",
      rationale: "Independent approval completed the replayable activation decision.",
      updatedAt: "2026-07-08T00:10:00.000Z",
    },
    "verifier_project_replay",
    "verifier",
  );
  const monitoring = service.recordMonitoringEvent(
    registration.id,
    {
      eventType: "field_observation",
      observedAt: "2026-07-08T00:20:00.000Z",
      evidenceIds: ["cp_evidence_project_replay_001"],
      metrics: { survivalPercent: 89 },
      state: "accepted",
      rationale: "Accepted field observation extends the immutable project authority chain.",
    },
    "verifier_project_replay",
    "verifier",
  );
  const transitions = service.listProjectStatusTransitions(registration.id);
  const snapshot = {
    projects: [registration],
    statusTransitions: transitions,
    monitoringEvents: [monitoring],
  } as const;

  const replayed = CanopyProofProjectRegistryService.fromAuthoritySnapshot(snapshot);
  assert.equal(replayed.getProject(registration.id).status, "monitored");
  assert.equal(replayed.getProject(registration.id).projectRoot, monitoring.monitoringRoot);

  assert.throws(
    () =>
      CanopyProofProjectRegistryService.fromAuthoritySnapshot({
        ...snapshot,
        statusTransitions: transitions.slice(1),
      }),
    /forked or incomplete event chain/,
  );
  assert.throws(
    () =>
      CanopyProofProjectRegistryService.fromAuthoritySnapshot({
        ...snapshot,
        statusTransitions: [{ ...transitions[0]!, transitionHash: "f".repeat(64) }, ...transitions.slice(1)],
      }),
    /status transition hash lineage is invalid/,
  );
  assert.throws(
    () =>
      CanopyProofProjectRegistryService.fromAuthoritySnapshot({
        ...snapshot,
        monitoringEvents: [{ ...monitoring, metrics: { survivalPercent: 99 } }],
      }),
    /monitoring event id must match|monitoring hash lineage is invalid/,
  );
});

test("CanopyProof project API enforces RBAC, organization ownership, filters, and governance-gated activation", async () => {
  const organizationId = "cp_org_project_api_001";
  const organization = await app.request("/canopyproof/organizations", {
    method: "POST",
    body: JSON.stringify(organizationPayload(organizationId)),
    headers: headers("owner", "owner_project_api"),
  });
  assert.equal(organization.status, 201);

  const denied = await app.request("/canopyproof/projects", {
    method: "POST",
    body: JSON.stringify(projectPayload(organizationId, "cp_project_api_denied")),
    headers: headers("observer", "observer_project_api"),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/canopyproof/projects", {
    method: "POST",
    body: JSON.stringify(projectPayload(organizationId)),
    headers: headers("verifier", "verifier_project_api"),
  });
  const createdBody = await json<{
    ok: true;
    data: { id: string; status: string; organizationId: string; auditHistory: Array<{ entityType: string }>; claimBoundary: { noMainnetFunds: true } };
  }>(created);

  assert.equal(created.status, 201);
  assert.equal(createdBody.data.organizationId, organizationId);
  assert.equal(createdBody.data.status, "submitted");
  assert.equal(createdBody.data.auditHistory[0]?.entityType, "project");
  assert.equal(createdBody.data.claimBoundary.noMainnetFunds, true);

  const listed = await app.request(`/canopyproof/projects?organizationId=${organizationId}&regionId=region_ggw_sahel`, {
    method: "GET",
    headers: headers("observer", "observer_project_api"),
  });
  const listedBody = await json<{ ok: true; data: Array<{ id: string; title: string }> }>(listed);

  assert.equal(listed.status, 200);
  assert.ok(listedBody.data.some((project) => project.id === createdBody.data.id));

  const underReview = await app.request(`/canopyproof/projects/${createdBody.data.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "under_review",
      rationale: "Institutional project review opened before activation.",
      updatedAt: "2026-07-08T00:09:00.000Z",
    }),
    headers: headers("verifier", "verifier_project_api"),
  });
  assert.equal(underReview.status, 200);

  const active = await app.request(`/canopyproof/projects/${createdBody.data.id}/status`, {
    method: "PATCH",
    body: JSON.stringify({
      status: "active",
      governanceApprovalId: "cp_governance_project_approval_api_001",
      rationale: "Governance approval received before project activation.",
      updatedAt: "2026-07-08T00:10:00.000Z",
    }),
    headers: headers("verifier", "verifier_project_api"),
  });
  const activeBody = await json<{ ok: true; data: { status: string; governanceApprovalId: string; auditHistory: Array<{ action: string }> } }>(active);

  assert.equal(active.status, 200);
  assert.equal(activeBody.data.status, "active");
  assert.equal(activeBody.data.governanceApprovalId, "cp_governance_project_approval_api_001");
  assert.equal(activeBody.data.auditHistory.at(-1)?.action, "FULFILL");

  const deniedMonitoring = await app.request(`/canopyproof/projects/${createdBody.data.id}/monitoring-events`, {
    method: "POST",
    body: JSON.stringify({
      eventType: "field_observation",
      observedAt: "2026-07-08T00:15:00.000Z",
      evidenceIds: ["cp_evidence_monitoring_denied_001"],
      rationale: "Observer actors cannot append monitoring evidence to the project registry.",
    }),
    headers: headers("observer", "observer_project_api"),
  });
  assert.equal(deniedMonitoring.status, 403);

  const monitoring = await app.request(`/canopyproof/projects/${createdBody.data.id}/monitoring-events`, {
    method: "POST",
    body: JSON.stringify({
      eventType: "terra_scene_review",
      observedAt: "2026-07-08T00:20:00.000Z",
      evidenceIds: ["cp_evidence_project_api_monitoring_001"],
      terraSceneIds: ["cp_terra_scene_project_api_monitoring_001"],
      biodiversityIndicators: ["canopy closure"],
      waterIndicators: ["runoff reduction"],
      climateRiskIndicators: ["heat stress"],
      metrics: {
        ndviMean: 0.63,
        canopyClosurePercent: 42,
      },
      state: "accepted",
      rationale: "Verifier linked TerraProof scene and field evidence for project monitoring continuity.",
    }),
    headers: headers("verifier", "verifier_project_api"),
  });
  const monitoringBody = await json<{
    ok: true;
    data: {
      id: string;
      projectId: string;
      eventType: string;
      state: string;
      observedBy: string;
      eventHash: string;
      auditEvent: { entityType: string; action: string };
    };
  }>(monitoring);

  assert.equal(monitoring.status, 201);
  assert.equal(monitoringBody.data.projectId, createdBody.data.id);
  assert.equal(monitoringBody.data.eventType, "terra_scene_review");
  assert.equal(monitoringBody.data.state, "accepted");
  assert.equal(monitoringBody.data.observedBy, "verifier_project_api");
  assert.match(monitoringBody.data.eventHash, /^[a-f0-9]{64}$/);
  assert.equal(monitoringBody.data.auditEvent.entityType, "project_monitoring_event");
  assert.equal(monitoringBody.data.auditEvent.action, "ASSERT");

  const listedMonitoring = await app.request(
    `/canopyproof/projects/${createdBody.data.id}/monitoring-events?eventType=terra_scene_review&state=accepted`,
    { method: "GET", headers: headers("observer", "observer_project_api") },
  );
  const listedMonitoringBody = await json<{ ok: true; data: Array<{ id: string }> }>(listedMonitoring);

  assert.equal(listedMonitoring.status, 200);
  assert.ok(listedMonitoringBody.data.some((event) => event.id === monitoringBody.data.id));

  const status = await app.request("/canopyproof/projects/status", {
    method: "GET",
    headers: headers("observer", "observer_project_api"),
  });
  const statusBody = await json<{
    ok: true;
    data: {
      projectCount: number;
      activeProjectCount: number;
      monitoringEventCount: number;
      monitoringRoot: string;
      safety: { projectsAreAudited: true; monitoringEventsAreAudited: true };
    };
  }>(status);

  assert.equal(status.status, 200);
  assert.ok(statusBody.data.projectCount >= 1);
  assert.ok(statusBody.data.activeProjectCount >= 1);
  assert.ok(statusBody.data.monitoringEventCount >= 1);
  assert.match(statusBody.data.monitoringRoot, /^[a-f0-9]{64}$/);
  assert.equal(statusBody.data.safety.projectsAreAudited, true);
  assert.equal(statusBody.data.safety.monitoringEventsAreAudited, true);
});

test("CanopyProof evidence and proof issuance require a registered project backbone", async () => {
  const missingProjectEvidence = await app.request("/canopyproof/evidence", {
    method: "POST",
    body: JSON.stringify({
      id: "cp_evidence_missing_project_001",
      projectId: "cp_project_missing_backbone",
      evidenceType: "tree_planting",
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracyMeters: 10,
        regionId: "region_ggw_sahel",
      },
      timestamp: "2026-07-08T00:05:00.000Z",
      media_hash: "8".repeat(64),
      gps_hash: "9".repeat(64),
      confidence_score: 89,
    }),
    headers: headers("community", "community_missing_project"),
  });
  const evidenceBody = await json<{ ok: false; error: string }>(missingProjectEvidence);

  assert.equal(missingProjectEvidence.status, 400);
  assert.match(evidenceBody.error, /CanopyProof project not found/);

  const missingProjectRecord = await app.request("/canopyproof/proof-records", {
    method: "POST",
    body: JSON.stringify({
      projectId: "cp_project_missing_backbone",
      evidenceIds: ["cp_evidence_missing_project_001"],
      humanReview: {
        reviewer: "body_reviewer_is_overwritten",
        role: "verifier",
        decision: "approve",
        rationale: "Attempted issuance against a missing registered project.",
        reviewedAt: "2026-07-08T01:00:00.000Z",
      },
      governanceApprovals: ["cp_governance_missing_project_approval"],
      monitoringTimeline: ["submitted", "ai_analyzed", "human_reviewed", "public_record_issued"],
      issuedAt: "2026-07-08T02:00:00.000Z",
    }),
    headers: headers("verifier", "verifier_missing_project"),
  });
  const recordBody = await json<{ ok: false; error: string }>(missingProjectRecord);

  assert.equal(missingProjectRecord.status, 400);
  assert.match(recordBody.error, /CanopyProof project not found/);
});
