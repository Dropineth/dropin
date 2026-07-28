import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { app } from "../../services/api/src/app.js";
import { CanopyProofMethodologyRegistryService } from "../../services/api/src/domain/canopyproof/methodology-registry.js";

function headers(role: string, actorId = `${role}_methodology_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

function methodologyPayload(id: string, status: "draft" | "published" | "deprecated" | "challenged" = "draft") {
  return {
    id,
    slug: "restoration-proof-field-satellite",
    version: id.endsWith("_v2") ? "v1.1.0" : "v1.0.0",
    title: "Restoration Proof Field And Satellite Methodology",
    scope: "ecosystem_restoration",
    status,
    summary:
      "Versioned CanopyProof methodology for combining field media, GPS traces, device attestations, satellite scenes, human review, and governance approvals.",
    requiredDataSources: ["field_photo", "gps_trace", "device_attestation", "satellite_scene", "governance_approval"],
    qualityGates: [
      "media_hash_required",
      "gps_hash_required",
      "gps_accuracy_threshold",
      "device_attestation_required",
      "satellite_cross_check_required",
      "duplicate_detection_required",
      "human_review_required",
      "governance_approval_required",
      "public_challenge_window_required",
      "monitoring_timeline_required",
    ],
    minimumGpsAccuracyMeters: 35,
    monitoringCadenceDays: 90,
    evidenceRetentionDays: 2555,
    governanceApprovalIds: status === "published" ? ["cp_governance_methodology_approval_001"] : [],
    limitations: [
      "This methodology establishes environmental accountability evidence thresholds and does not create a carbon credit or financial asset.",
      "Seasonal monitoring remains required before stronger ecological claims can be made.",
    ],
    createdAt: "2026-07-09T00:00:00.000Z",
    ...(status === "published" ? { publishedAt: "2026-07-09T00:05:00.000Z" } : {}),
  };
}

test("CanopyProof methodology registry creates versioned governed methodology records", () => {
  const service = new CanopyProofMethodologyRegistryService();
  const draft = service.createMethodology(methodologyPayload("cp_methodology_domain_draft_001"), "researcher_methodology_domain");

  assert.equal(draft.status, "draft");
  assert.equal(draft.scope, "ecosystem_restoration");
  assert.deepEqual(draft.requiredDataSources, ["device_attestation", "field_photo", "governance_approval", "gps_trace", "satellite_scene"]);
  assert.ok(draft.qualityGates.includes("human_review_required"));
  assert.ok(draft.qualityGates.includes("public_challenge_window_required"));
  assert.match(draft.qualityGateRoot, /^[a-f0-9]{64}$/);
  assert.match(draft.methodologyHash, /^[a-f0-9]{64}$/);
  assert.equal(draft.claimBoundary.environmentalAccountabilityOnly, true);
  assert.equal(draft.claimBoundary.notCarbonCredit, true);
  assert.equal(draft.auditEvent.entityType, "methodology");
  assert.equal(draft.auditEvent.action, "ASSERT");

  assert.throws(
    () =>
      service.createMethodology(
        {
          ...methodologyPayload("cp_methodology_domain_published_missing_approval_001", "published"),
          governanceApprovalIds: [],
        },
        "verifier_methodology_domain",
      ),
    /published methodologies require/,
  );

  const published = service.createMethodology(
    {
      ...methodologyPayload("cp_methodology_domain_published_001", "published"),
      version: "v1.0.1",
    },
    "verifier_methodology_domain",
  );
  assert.equal(published.status, "published");
  assert.equal(published.auditEvent.action, "FULFILL");
  assert.equal(published.governanceApprovalIds.length, 1);
  assert.equal(service.getStatus().publishedCount, 1);
});

test("CanopyProof methodology registry rejects duplicate versions, unsafe claims, and invalid publication gates", () => {
  const service = new CanopyProofMethodologyRegistryService();
  service.createMethodology(methodologyPayload("cp_methodology_duplicate_seed_001"), "researcher_methodology_domain");

  assert.throws(
    () => service.createMethodology(methodologyPayload("cp_methodology_duplicate_target_001"), "researcher_methodology_domain"),
    /version already exists/,
  );

  assert.throws(
    () =>
      service.createMethodology(
        {
          ...methodologyPayload("cp_methodology_unsafe_001"),
          slug: "unsafe-yield-methodology",
          version: "v2.0.0",
          summary: "This methodology promises guaranteed RWA yield from proof records.",
        },
        "researcher_methodology_domain",
      ),
    /unsupported public claim/,
  );

  assert.throws(
    () =>
      service.createMethodology(
        {
          ...methodologyPayload("cp_methodology_missing_gate_001", "published"),
          slug: "missing-gate-methodology",
          version: "v3.0.0",
          qualityGates: ["media_hash_required", "gps_hash_required", "human_review_required", "governance_approval_required"],
        },
        "verifier_methodology_domain",
      ),
    /public_challenge_window_required/,
  );
});

test("CanopyProof methodology API enforces RBAC and draft visibility boundaries", async () => {
  const denied = await app.request("/canopyproof/methodologies", {
    method: "POST",
    headers: headers("community", "community_methodology_denied"),
    body: JSON.stringify(methodologyPayload("cp_methodology_api_denied_001")),
  });
  assert.equal(denied.status, 403);

  const draft = await app.request("/canopyproof/methodologies", {
    method: "POST",
    headers: headers("researcher", "researcher_methodology_api"),
    body: JSON.stringify({
      ...methodologyPayload("cp_methodology_api_draft_001"),
      slug: "api-draft-restoration-methodology",
      version: "v1.0.0",
    }),
  });
  assert.equal(draft.status, 202);
  const draftBody = await json<{ ok: true; data: { id: string; status: string; auditEvent: { entityType: string } } }>(draft);
  assert.equal(draftBody.data.status, "draft");
  assert.equal(draftBody.data.auditEvent.entityType, "methodology");

  const observerDetail = await app.request(`/canopyproof/methodologies/${draftBody.data.id}`, {
    headers: headers("observer", "observer_methodology_detail"),
  });
  assert.equal(observerDetail.status, 403);

  const reviewerDetail = await app.request(`/canopyproof/methodologies/${draftBody.data.id}`, {
    headers: headers("verifier", "verifier_methodology_detail"),
  });
  assert.equal(reviewerDetail.status, 200);

  const published = await app.request("/canopyproof/methodologies", {
    method: "POST",
    headers: headers("verifier", "verifier_methodology_api"),
    body: JSON.stringify({
      ...methodologyPayload("cp_methodology_api_published_001", "published"),
      slug: "api-published-restoration-methodology",
      version: "v1.0.0",
      governanceApprovalIds: ["cp_governance_methodology_api_approval_001"],
    }),
  });
  assert.equal(published.status, 201);

  const observerList = await app.request("/canopyproof/methodologies?scope=ecosystem_restoration", {
    headers: headers("observer", "observer_methodology_list"),
  });
  assert.equal(observerList.status, 200);
  const observerListBody = await json<{ ok: true; data: Array<{ id: string; status: string }> }>(observerList);
  assert.equal(observerListBody.data.some((item) => item.id === draftBody.data.id), false);
  assert.ok(observerListBody.data.some((item) => item.id === "cp_methodology_api_published_001" && item.status === "published"));

  const invalidStatus = await app.request("/canopyproof/methodologies?status=approved", {
    headers: headers("observer", "observer_methodology_invalid"),
  });
  assert.equal(invalidStatus.status, 400);
});

test("CanopyProof SQL contract stores append-only governed methodology versions", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS governance\.methodologies/);
  assert.match(sql, /version text NOT NULL CHECK \(version ~ '\^v\[0-9\]\+\\\.\[0-9\]\+\\\.\[0-9\]\+\$'\)/);
  assert.match(sql, /scope text NOT NULL CHECK \(scope IN \('tree_planting', 'ecosystem_restoration', 'biodiversity', 'water_project', 'soil_regeneration', 'climate_observation', 'multi_scope'\)\)/);
  assert.match(sql, /status text NOT NULL CHECK \(status IN \('draft', 'published', 'deprecated', 'challenged'\)\)/);
  assert.match(sql, /UNIQUE \(slug, version\)/);
  assert.match(sql, /CHECK \(status <> 'published' OR array_length\(governance_approval_ids, 1\) > 0\)/);
  assert.match(sql, /governance_methodologies_no_update/);
  assert.match(sql, /governance_methodologies_no_delete/);
  assert.match(sql, /AFTER INSERT OR UPDATE OR DELETE ON governance\.methodologies/);
});
