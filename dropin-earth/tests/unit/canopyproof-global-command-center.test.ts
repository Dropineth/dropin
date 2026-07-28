import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { CanopyProofEarlyWarningService } from "../../services/api/src/domain/canopyproof/early-warning.js";
import { CanopyProofFundingTransparencyService } from "../../services/api/src/domain/canopyproof/funding-transparency.js";
import {
  buildCanopyProofGlobalCommandCenter,
  buildCanopyProofGlobalCommandCenterSpatialDisclosure,
  verifyCanopyProofGlobalCommandCenterSnapshot,
  type CanopyProofGlobalCommandCenterSnapshot,
} from "../../services/api/src/domain/canopyproof/global-command-center.js";
import {
  CanopyProofGlobalCommandCenterError,
  PrismaCanopyProofGlobalCommandCenterRepository,
} from "../../services/api/src/domain/canopyproof/global-command-center-postgres.js";
import { CanopyProofProjectRegistryService } from "../../services/api/src/domain/canopyproof/project-registry.js";
import { CanopyProofService } from "../../services/api/src/domain/canopyproof/proof-service.js";
import { TerraProofService } from "../../services/api/src/domain/canopyproof/terra-intelligence.js";
import { app } from "../../services/api/src/app.js";
import { classifyGlobalCommandCenterResponse } from "../../apps/web/src/lib/canopyproof-global-command-center.js";
import {
  buildGlobalCommandCenterEarthMarkers,
  latitudeLongitudeToCartesian,
} from "../../apps/web/src/lib/canopyproof-global-command-center-earth.js";

const timestamp = "2026-07-08T00:00:00.000Z";

function headers(role: string, actorId = `${role}_global_dashboard_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test("CanopyProof Global Impact Command Center aggregates projects, risk, TerraProof, funding, and proof lineage", () => {
  const projectRegistry = new CanopyProofProjectRegistryService();
  const proof = new CanopyProofService();
  const terra = new TerraProofService();
  const risk = new CanopyProofEarlyWarningService();
  const funding = new CanopyProofFundingTransparencyService();

  const project = projectRegistry.registerProject(
    {
      id: "cp_global_dashboard_project_001",
      organizationId: "org_global_dashboard_001",
      title: "Sahel watershed proof corridor",
      projectType: "reforestation",
      regionId: "region_ggw_sahel",
      location: {
        latitude: 14.7167,
        longitude: -17.4677,
        areaHectares: 42.5,
        boundaryHash: "a".repeat(64),
      },
      targetTreeCount: 12500,
      biodiversityIndicators: ["native species survivorship", "pollinator return"],
      waterIndicators: ["soil moisture recovery"],
      climateRiskIndicators: ["drought exposure"],
      monitoringCadenceDays: 60,
      governancePolicyId: "governance_policy_global_dashboard_v1",
      governanceApprovalId: "governance_approval_global_dashboard_v1",
      status: "active",
      createdAt: timestamp,
    },
    "owner_global_dashboard",
  );

  const terraRun = terra.runConnector(
    "sentinel",
    {
      layerId: "terra_sentinel_ndvi",
      regionId: project.regionId,
      acquisitionTimestamp: "2026-07-08T00:10:00.000Z",
      bbox: { west: -17.6, south: 14.6, east: -17.3, north: 14.9 },
      cloudCoverPercent: 10,
      ndviMean: 0.64,
      waterIndexMean: 0.08,
      completedAt: "2026-07-08T00:12:00.000Z",
    },
    "terra_agent_global_dashboard",
  );

  const evidence = proof.submitEvidence({
    id: "evidence_global_dashboard_001",
    projectId: project.id,
    evidenceType: "tree_planting",
    location: {
      latitude: project.location.latitude,
      longitude: project.location.longitude,
      accuracyMeters: 8,
      regionId: project.regionId,
    },
    timestamp: "2026-07-08T00:15:00.000Z",
    contributor: "community_global_dashboard",
    media_hash: "b".repeat(64),
    gps_hash: "c".repeat(64),
    confidence_score: 92,
    offline_sync_id: "offline_global_dashboard_001",
    device_fingerprint_hash: "d".repeat(64),
    exif_hash: "e".repeat(64),
  });
  assert.equal(evidence.valid, true);
  proof.analyzeEvidence(evidence.evidence.id, { observedAt: "2026-07-08T00:20:00.000Z" });

  const monitoringEvent = projectRegistry.recordMonitoringEvent(
    project.id,
    {
      eventType: "terra_scene_review",
      observedAt: "2026-07-08T00:25:00.000Z",
      evidenceIds: [evidence.evidence.id],
      terraSceneIds: [terraRun.scene.id],
      biodiversityIndicators: ["native species survivorship"],
      waterIndicators: ["soil moisture recovery"],
      climateRiskIndicators: ["drought exposure"],
      metrics: {
        ndviMean: 0.64,
        survivalPercent: 91,
      },
      state: "accepted",
      rationale: "Verifier accepted TerraProof scene and field evidence for global dashboard lineage.",
    },
    "verifier_global_dashboard",
  );

  const proofRecord = proof.issueProofRecord({
    projectId: project.id,
    evidenceIds: [evidence.evidence.id],
    humanReview: {
      reviewer: "verifier_global_dashboard",
      role: "verifier",
      decision: "approve",
      rationale: "Approved for read-only global dashboard proof lineage after human review.",
      reviewedAt: "2026-07-08T00:30:00.000Z",
    },
    governanceApprovals: ["governance_approval_global_dashboard_v1"],
    monitoringTimeline: ["submitted", "terra_scene_review", "human_reviewed", "public_record_issued"],
    monitoringEventIds: [monitoringEvent.id],
    issuedAt: "2026-07-08T00:35:00.000Z",
  });

  risk.ingestSignal(
    {
      riskClass: "drought",
      regionId: project.regionId,
      projectId: project.id,
      sourceType: "terra_scene",
      sourceId: terraRun.scene.id,
      observedAt: "2026-07-08T00:40:00.000Z",
      indicators: {
        soilMoistureDeficit: 92,
        vegetationStress: 84,
      },
      confidenceScore: 90,
      summary: "Drought stress under operational review for monitored restoration corridor.",
      recommendedAudience: ["community", "ngo", "operator", "verifier"],
    },
    "risk_agent_global_dashboard",
  );

  const source = funding.registerFundingSource(
    {
      id: "cp_global_dashboard_funding_source_001",
      sourceType: "grant",
      displayName: "Global dashboard restoration grant",
      jurisdiction: "Senegal",
      commitmentUsd: "50000.00",
      restriction: "project_restricted",
      publicMemo: "Transparency-only funding for monitored restoration evidence.",
      pledgedAt: timestamp,
    },
    "owner_global_dashboard",
  );
  const allocation = funding.createAllocation(
    {
      id: "cp_global_dashboard_funding_allocation_001",
      sourceId: source.id,
      projectId: project.id,
      purpose: "Evidence-backed monitoring and field verification.",
      amountUsd: "12000.50",
      status: "approved",
      createdAt: "2026-07-08T00:45:00.000Z",
    },
    "admin_global_dashboard",
  );
  const milestone = funding.recordMilestone(
    {
      id: "cp_global_dashboard_funding_milestone_001",
      allocationId: allocation.id,
      projectId: project.id,
      title: "First monitored survival review",
      amountUsd: "2500.25",
      dueAt: "2026-09-08T00:00:00.000Z",
      evidenceRequirements: ["accepted evidence", "issued proof record"],
      createdAt: "2026-07-08T00:50:00.000Z",
    },
    "admin_global_dashboard",
  );
  funding.linkEvidenceToMilestone(
    milestone.id,
    {
      evidenceId: evidence.evidence.id,
      evidenceRoot: proofRecord.evidenceRoot,
      proofRecordId: proofRecord.id,
      note: "Issued Environmental Proof Record linked for transparency-only reconciliation.",
      linkedAt: "2026-07-08T00:55:00.000Z",
    },
    "verifier_global_dashboard",
  );
  funding.updateMilestoneStatus(
    milestone.id,
    {
      status: "settled",
      rationale: "Evidence-backed reconciliation only; no fund movement executed.",
      changedAt: "2026-07-08T01:00:00.000Z",
    },
    "verifier_global_dashboard",
  );

  const snapshot = buildCanopyProofGlobalCommandCenter({
    projectRegistry,
    proof,
    terra,
    risk,
    funding,
    generatedAt: "2026-07-08T01:05:00.000Z",
  });

  assert.equal(snapshot.service, "canopyproof-global-impact-command-center");
  assert.equal(snapshot.metrics.projectCount, 1);
  assert.equal(snapshot.metrics.activeProjectCount, 1);
  assert.equal(snapshot.metrics.monitoredProjectCount, 1);
  assert.equal(snapshot.metrics.targetTreeCount, 12500);
  assert.equal(snapshot.metrics.areaHectares, 42.5);
  assert.equal(snapshot.metrics.evidenceCount, 1);
  assert.equal(snapshot.metrics.acceptedEvidenceCount, 1);
  assert.equal(snapshot.metrics.issuedProofRecordCount, 1);
  assert.equal(snapshot.metrics.terraSceneCount, 1);
  assert.equal(snapshot.metrics.acceptedTerraRunCount, 1);
  assert.equal(snapshot.metrics.activeRiskAlertCount, 1);
  assert.equal(snapshot.metrics.criticalRiskAlertCount, 0);
  assert.equal(snapshot.metrics.fundingAllocatedUsd, "12000.50");
  assert.equal(snapshot.metrics.fundingSettledUsd, "2500.25");

  const region = snapshot.regions.find((item) => item.regionId === project.regionId);
  assert.ok(region);
  assert.equal(region.projectCount, 1);
  assert.equal(region.acceptedMonitoringEventCount, 1);
  assert.equal(region.proofRecordCount, 1);
  assert.equal(region.terraSceneCount, 1);
  assert.equal(region.activeRiskAlertCount, 1);
  assert.equal(region.fundingSettledUsd, "2500.25");
  assert.match(region.sourceRoot, /^[a-f0-9]{64}$/);
  assert.equal(region.spatial.visibility, "withheld");
  assert.match(region.spatial.spatialRoot, /^[a-f0-9]{64}$/);
  assert.match(region.regionRoot, /^[a-f0-9]{64}$/);

  assert.ok(snapshot.impactIndicators.biodiversity.some((indicator) => indicator.key === "native species survivorship"));
  assert.ok(snapshot.impactIndicators.water.some((indicator) => indicator.key === "soil moisture recovery"));
  assert.ok(snapshot.impactIndicators.climateRisk.some((indicator) => indicator.key === "drought exposure"));
  assert.ok(snapshot.recentActivity.some((activity) => activity.kind === "proof_record" && activity.id === proofRecord.id));
  assert.ok(snapshot.recentActivity.some((activity) => activity.kind === "risk_alert"));
  assert.match(snapshot.lineage.dashboardRoot, /^[a-f0-9]{64}$/);
  assert.equal(snapshot.safety.readOnly, true);
  assert.equal(snapshot.safety.aiAdvisoryOnly, true);
  assert.equal(snapshot.safety.notCertifiedCarbonCredit, true);
  assert.equal(snapshot.safety.notGuaranteedYield, true);
  assert.deepEqual(verifyCanopyProofGlobalCommandCenterSnapshot(snapshot), snapshot);

  assert.throws(
    () => verifyCanopyProofGlobalCommandCenterSnapshot({
      ...snapshot,
      regions: [{ ...region, projectCount: region.projectCount + 1 }],
    }),
    /CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: region root mismatch/,
  );
  const activity = snapshot.recentActivity[0];
  assert.ok(activity);
  assert.throws(
    () => verifyCanopyProofGlobalCommandCenterSnapshot({
      ...snapshot,
      recentActivity: [{ ...activity, summary: `${activity.summary} tampered` }, ...snapshot.recentActivity.slice(1)],
    }),
    /CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: dashboard root mismatch/,
  );
});

test("CanopyProof Earth projection renders only current dual-reviewed generalized disclosures", () => {
  const projectRegistry = new CanopyProofProjectRegistryService();
  for (const [index, latitude, longitude] of [
    [1, 14.6, -17.5],
    [2, 14.8, -17.3],
    [3, 14.7, -17.4],
  ] as const) {
    projectRegistry.registerProject(
      {
        id: `cp_global_spatial_project_00${index}`,
        organizationId: "org_global_spatial_001",
        title: `Reviewed regional project ${index}`,
        projectType: "ecosystem_restoration",
        regionId: "region_global_spatial_001",
        location: { latitude, longitude, areaHectares: 10 + index },
        targetTreeCount: 1_000 * index,
        status: "submitted",
        createdAt: timestamp,
      },
      "owner_global_spatial",
    );
  }

  const services = {
    projectRegistry,
    proof: new CanopyProofService(),
    terra: new TerraProofService(),
    risk: new CanopyProofEarlyWarningService(),
    funding: new CanopyProofFundingTransparencyService(),
    generatedAt: "2026-07-08T12:00:00.000Z",
  } as const;
  const withheld = buildCanopyProofGlobalCommandCenter(services);
  const sourceRegion = withheld.regions[0];
  assert.ok(sourceRegion);
  assert.equal(sourceRegion.spatial.visibility, "withheld");

  const disclosureCommitment = {
    regionId: sourceRegion.regionId,
    centroid: { latitudeDegrees: 15, longitudeDegrees: -17 },
    precisionDegrees: 1 as const,
    sourceProjectCount: 3,
    minimumCohortSize: 3 as const,
    regionSourceRoot: sourceRegion.sourceRoot,
    privacyReviewRoot: "1".repeat(64),
    safeguardingReviewRoot: "2".repeat(64),
    validFrom: "2026-07-08T00:00:00.000Z",
    validUntil: "2026-08-08T00:00:00.000Z",
  };
  const disclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosure(disclosureCommitment);
  const snapshot = buildCanopyProofGlobalCommandCenter({
    ...services,
    spatialDisclosures: [disclosure],
  });
  const region = snapshot.regions[0];
  assert.ok(region);
  assert.equal(region.spatial.visibility, "generalized");
  if (region.spatial.visibility !== "generalized") assert.fail("expected generalized spatial disclosure");
  assert.deepEqual(region.spatial.centroid, { latitudeDegrees: 15, longitudeDegrees: -17 });
  assert.equal(region.spatial.regionSourceRoot, region.sourceRoot);
  assert.equal(region.spatial.sourceProjectCount, region.projectCount);
  assert.notEqual(region.spatial.privacyReviewRoot, region.spatial.safeguardingReviewRoot);
  assert.deepEqual(
    buildCanopyProofGlobalCommandCenter({ ...services, spatialDisclosures: [disclosure] }),
    snapshot,
  );

  const markers = buildGlobalCommandCenterEarthMarkers(snapshot.regions);
  assert.equal(markers.length, 1);
  assert.equal(markers[0]?.regionId, region.regionId);
  assert.deepEqual(markers[0]?.position, latitudeLongitudeToCartesian(15, -17, 1.035));
  assert.equal(buildGlobalCommandCenterEarthMarkers(withheld.regions).length, 0);
  const serializedSnapshot = JSON.stringify(snapshot);
  assert.doesNotMatch(serializedSnapshot, /"latitude":|"longitude":|"accuracyMeters":|"bbox":/);
  assert.equal(
    buildGlobalCommandCenterEarthMarkers([{ ...region, challengedProjectCount: 1 }])[0]?.state,
    "challenged",
  );
  assert.equal(
    buildGlobalCommandCenterEarthMarkers([{ ...region, activeRiskAlertCount: 1 }])[0]?.state,
    "active_risk",
  );
  assert.equal(
    buildGlobalCommandCenterEarthMarkers([{ ...region, acceptedMonitoringEventCount: 1 }])[0]?.state,
    "monitored",
  );
  assert.equal(buildGlobalCommandCenterEarthMarkers([region])[0]?.state, "registered");
  assert.throws(() => latitudeLongitudeToCartesian(91, 0, 1), /latitude is outside/);
  assert.throws(() => latitudeLongitudeToCartesian(0, 180, 1), /longitude is outside/);
  assert.throws(() => latitudeLongitudeToCartesian(0, 0, 0), /radius must be positive/);

  assert.throws(
    () => verifyCanopyProofGlobalCommandCenterSnapshot({
      ...snapshot,
      regions: [{
        ...region,
        spatial: { ...region.spatial, centroid: { latitudeDegrees: 16, longitudeDegrees: -17 } },
      }],
    }),
    /CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID: spatial root mismatch/,
  );
  const wrongSourceDisclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosure({
    ...disclosureCommitment,
    regionSourceRoot: "3".repeat(64),
  });
  assert.throws(
    () => buildCanopyProofGlobalCommandCenter({ ...services, spatialDisclosures: [wrongSourceDisclosure] }),
    /spatial disclosure source root mismatch/,
  );
  const staleDisclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosure({
    ...disclosureCommitment,
    validFrom: "2026-07-01T00:00:00.000Z",
    validUntil: "2026-07-08T11:59:59.999Z",
  });
  assert.throws(
    () => buildCanopyProofGlobalCommandCenter({ ...services, spatialDisclosures: [staleDisclosure] }),
    /outside its validity interval/,
  );
  const futureDisclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosure({
    ...disclosureCommitment,
    validFrom: "2026-07-08T12:00:00.001Z",
    validUntil: "2026-08-08T00:00:00.000Z",
  });
  assert.throws(
    () => buildCanopyProofGlobalCommandCenter({ ...services, spatialDisclosures: [futureDisclosure] }),
    /outside its validity interval/,
  );
  const wrongCountDisclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosure({
    ...disclosureCommitment,
    sourceProjectCount: 4,
  });
  assert.throws(
    () => buildCanopyProofGlobalCommandCenter({ ...services, spatialDisclosures: [wrongCountDisclosure] }),
    /spatial disclosure project count mismatch/,
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenter({ ...services, spatialDisclosures: [disclosure, disclosure] }),
    /duplicate spatial disclosure region/,
  );
  const absentRegionDisclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosure({
    ...disclosureCommitment,
    regionId: "region_global_spatial_absent",
  });
  assert.throws(
    () => buildCanopyProofGlobalCommandCenter({ ...services, spatialDisclosures: [absentRegionDisclosure] }),
    /spatial disclosure region is absent/,
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterSpatialDisclosure({
      ...disclosureCommitment,
      sourceProjectCount: 2,
    }),
    /too_small|greater than or equal to 3/i,
  );
  const disclosureWithRawCoordinate = { ...disclosureCommitment, latitude: 14.7 };
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterSpatialDisclosure(
      disclosureWithRawCoordinate as typeof disclosureCommitment,
    ),
    /unrecognized_keys|Unrecognized key/i,
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterSpatialDisclosure({
      ...disclosureCommitment,
      privacyReviewRoot: "4".repeat(64),
      safeguardingReviewRoot: "4".repeat(64),
    }),
    /Spatial privacy and safeguarding reviews must be independent/,
  );
});

test("CanopyProof global dashboard API is observer-readable and RBAC-protected", async () => {
  const denied = await app.request("/canopyproof/dashboard/global");
  assert.equal(denied.status, 401);

  const response = await app.request("/canopyproof/dashboard/global", {
    headers: headers("observer", "observer_global_dashboard_api"),
  });
  assert.equal(response.status, 200);
  const body = await json<{
    ok: true;
    apiVersion: string;
    authority: string;
    data: {
      service: string;
      metrics: { projectCount: number; terraLayerCount: number };
      lineage: { dashboardRoot: string; projectRoot: string };
      safety: {
        readOnly: boolean;
        notCertifiedCarbonCredit: boolean;
        noMainnetFunds: boolean;
        noAutomaticCanopyDistribution: boolean;
      };
    };
  }>(response);

  assert.equal(body.apiVersion, "canopyproof.global-command-center.v2");
  assert.equal(body.authority, "process_local_compatibility");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(body.data.service, "canopyproof-global-impact-command-center");
  assert.ok(body.data.metrics.projectCount >= 2, "seeded project registry should back the global dashboard API");
  assert.ok(body.data.metrics.terraLayerCount >= 7);
  assert.match(body.data.lineage.dashboardRoot, /^[a-f0-9]{64}$/);
  assert.match(body.data.lineage.projectRoot, /^[a-f0-9]{64}$/);
  assert.equal(body.data.safety.readOnly, true);
  assert.equal(body.data.safety.notCertifiedCarbonCredit, true);
  assert.equal(body.data.safety.noMainnetFunds, true);
  assert.equal(body.data.safety.noAutomaticCanopyDistribution, true);
});

test("CanopyProof SQL contract stores append-only Global Command Center snapshots", () => {
  const sql = readFileSync(join(process.cwd(), "services/api/prisma/canopyproof-os.sql"), "utf8");

  assert.match(sql, /CREATE TABLE IF NOT EXISTS impact\.global_command_center_snapshots/);
  assert.match(sql, /dashboard_root text NOT NULL UNIQUE/);
  assert.match(sql, /impact_global_command_center_snapshots_no_update/);
  assert.match(sql, /impact_global_command_center_snapshots_no_delete/);
  assert.match(sql, /impact_global_command_center_snapshots_audit/);
  assert.match(sql, /impact_global_command_center_snapshot_json_shape/);
  assert.match(sql, /impact_global_command_center_snapshot_root_binding/);
  assert.match(sql, /impact_global_command_center_snapshot_safety_boundary/);
  assert.match(sql, /impact_global_command_center_snapshot_spatial_shape/);
  assert.match(sql, /global_command_center_regions_have_spatial/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS impact\.global_command_center_publication_facts/);
  assert.match(sql, /impact_global_command_center_snapshot_requires_publication/);
  assert.match(sql, /impact_global_command_center_publication_facts_validate/);
  assert.match(sql, /global command center publication semantic event binding is invalid/);
  assert.match(sql, /DEFERRABLE INITIALLY DEFERRED/);
  assert.match(sql, /global command center snapshot requires exactly one governed publication fact/);
  assert.match(sql, /impact_global_command_center_publication_facts_no_update/);
  assert.match(sql, /impact_global_command_center_publication_facts_no_delete/);
  assert.match(sql, /impact_global_command_center_publication_facts_audit/);
  assert.match(sql, /global_command_center_snapshot_publication/);
  assert.match(sql, /notCertifiedCarbonCredit/);
  assert.match(sql, /notGuaranteedYield/);

  const rollback = readFileSync(
    join(process.cwd(), "services/api/prisma/global-command-center-publishing-authority.rollback.sql"),
    "utf8",
  );
  assert.match(rollback, /rollback refused: global command center publication facts exist/);
  assert.match(rollback, /DROP TABLE IF EXISTS impact\.global_command_center_publication_facts/);
});

test("CanopyProof Global Command Center PostgreSQL reader replays one append-only snapshot after restart", async () => {
  const snapshot = emptySnapshot();
  const row = snapshotRow(snapshot);
  const first = new PrismaCanopyProofGlobalCommandCenterRepository(prismaForRows([row]));
  assert.deepEqual(first.getStatus(), {
    service: "canopyproof-global-command-center-repository",
    storage: "postgresql",
    readOnly: true,
    appendOnlySnapshots: true,
    writerMounted: false,
    processLocalFallbackAllowed: false,
    rootReplayRequired: true,
  });
  assert.deepEqual(await first.getLatestSnapshot(), snapshot);

  const restarted = new PrismaCanopyProofGlobalCommandCenterRepository(prismaForRows([row]));
  assert.deepEqual(await restarted.getLatestSnapshot(), snapshot);
});

test("CanopyProof Global Command Center PostgreSQL reader fails closed for missing and tampered snapshots", async () => {
  await assert.rejects(
    new PrismaCanopyProofGlobalCommandCenterRepository(prismaForRows([])).getLatestSnapshot(),
    (error: unknown) => error instanceof CanopyProofGlobalCommandCenterError &&
      error.code === "CANOPYPROOF_GLOBAL_COMMAND_CENTER_NOT_AVAILABLE" && error.httpStatus === 503,
  );

  const snapshot = emptySnapshot();
  const row = snapshotRow(snapshot);
  await assert.rejects(
    new PrismaCanopyProofGlobalCommandCenterRepository(prismaForRows([{
      ...row,
      metric_summary: { ...snapshot.metrics, projectCount: 1 },
    }])).getLatestSnapshot(),
    (error: unknown) => error instanceof CanopyProofGlobalCommandCenterError &&
      error.code === "CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID" && error.httpStatus === 503,
  );
  await assert.rejects(
    new PrismaCanopyProofGlobalCommandCenterRepository(prismaForRows([{
      ...row,
      dashboard_root: "0".repeat(64),
    }])).getLatestSnapshot(),
    /CANOPYPROOF_GLOBAL_COMMAND_CENTER_SOURCE_INVALID/,
  );
});

test("CanopyProof Global Command Center web route consumes only the strict durable projection", () => {
  const page = readFileSync(join(process.cwd(), "apps/web/src/app/dashboard/global/page.tsx"), "utf8");
  const component = readFileSync(
    join(process.cwd(), "apps/web/src/components/canopyproof-os/GlobalImpactCommandCenter.tsx"),
    "utf8",
  );
  const clientState = readFileSync(
    join(process.cwd(), "apps/web/src/lib/canopyproof-global-command-center.ts"),
    "utf8",
  );
  const earthLoader = readFileSync(
    join(process.cwd(), "apps/web/src/components/canopyproof-os/GlobalImpactEarthLoader.tsx"),
    "utf8",
  );
  const earth = readFileSync(
    join(process.cwd(), "apps/web/src/components/canopyproof-os/GlobalImpactEarth.tsx"),
    "utf8",
  );

  assert.doesNotMatch(page, /globalImpactCommandCenter/);
  assert.match(page, /<GlobalImpactCommandCenter \/>/);
  assert.match(clientState, /canopyProofGlobalCommandCenterResponseSchema\.safeParse/);
  assert.match(clientState, /postgresql_append_only_snapshot/);
  assert.match(clientState, /CANOPYPROOF_GLOBAL_COMMAND_CENTER_DURABLE_SOURCE_REQUIRED/);
  assert.match(component, /GlobalImpactEarthLoader/);
  assert.match(earthLoader, /ssr: false/);
  assert.match(earthLoader, /h-80/);
  assert.match(earth, /THREE\.InstancedMesh/);
  assert.match(earth, /<instancedMesh/);
  assert.match(earth, /h-80/);
  assert.doesNotMatch(earth, /<meshBasicMaterial\s+vertexColors/);
  assert.doesNotMatch(earth, /new THREE\.Mesh\(/);
  assert.doesNotMatch(earth, /project\.location|evidence\.location|scene\.bbox/);
  assert.doesNotMatch(component, /Sahel restoration corridor|Projects in review|Restoration regions/);
});

test("CanopyProof Global Command Center client rejects compatibility, malformed, and RBAC responses", () => {
  const snapshot = emptySnapshot();
  const envelope = {
    ok: true as const,
    apiVersion: "canopyproof.global-command-center.v2" as const,
    authority: "postgresql_append_only_snapshot" as const,
    data: snapshot,
  };
  assert.deepEqual(classifyGlobalCommandCenterResponse(true, envelope), {
    kind: "empty",
    response: envelope,
  });
  assert.deepEqual(classifyGlobalCommandCenterResponse(true, {
    ...envelope,
    authority: "process_local_compatibility",
  }), {
    kind: "unavailable",
    code: "CANOPYPROOF_GLOBAL_COMMAND_CENTER_DURABLE_SOURCE_REQUIRED",
  });
  assert.deepEqual(classifyGlobalCommandCenterResponse(true, { ...envelope, extra: true }), {
    kind: "unavailable",
    code: "CANOPYPROOF_GLOBAL_COMMAND_CENTER_RESPONSE_INVALID",
  });
  assert.deepEqual(classifyGlobalCommandCenterResponse(false, {
    ok: false,
    error: "CANOPYPROOF_RBAC_DENIED: durable role is not permitted",
  }), {
    kind: "unavailable",
    code: "CANOPYPROOF_RBAC_DENIED",
  });
});

function emptySnapshot() {
  return buildCanopyProofGlobalCommandCenter({
    projectRegistry: new CanopyProofProjectRegistryService(),
    proof: new CanopyProofService(),
    terra: new TerraProofService(),
    risk: new CanopyProofEarlyWarningService(),
    funding: new CanopyProofFundingTransparencyService(),
    generatedAt: timestamp,
  });
}

function snapshotRow(snapshot: CanopyProofGlobalCommandCenterSnapshot) {
  return {
    generated_at_value: new Date(snapshot.generatedAt),
    metric_summary: snapshot.metrics,
    regional_summaries: snapshot.regions,
    impact_indicators: snapshot.impactIndicators,
    recent_activity: snapshot.recentActivity,
    lineage: snapshot.lineage,
    safety_boundary: snapshot.safety,
    dashboard_root: snapshot.lineage.dashboardRoot,
  };
}

function prismaForRows(rows: readonly unknown[]) {
  const transaction = {
    async $queryRaw() {
      return [...rows];
    },
  };
  const client = {
    async $transaction<T>(operation: (value: typeof transaction) => Promise<T>) {
      return operation(transaction);
    },
  };
  return client as unknown as PrismaClient;
}
