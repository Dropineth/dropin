import assert from "node:assert/strict";
import test from "node:test";
import {
  TerraProofService,
  defaultTerraProofLayers,
  terraProofConnectorIds,
  terraProofLayerTypes,
} from "../../services/api/src/domain/canopyproof/terra-intelligence.js";
import { app } from "../../services/api/src/app.js";

function headers(role: string, actorId = `${role}_terra_actor`) {
  return {
    "content-type": "application/json",
    "x-dropin-actor-id": actorId,
    "x-dropin-actor-role": role,
  };
}

async function json<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

test("TerraProof layer catalog covers satellite imagery, NDVI, vegetation, water, drought, wildfire, and land change", () => {
  const layers = defaultTerraProofLayers();
  const layerTypes = new Set(layers.map((layer) => layer.type));
  const connectorFamilies = new Set(layers.map((layer) => layer.providerFamily));

  for (const layerType of terraProofLayerTypes) {
    assert.equal(layerTypes.has(layerType), true, `${layerType} layer must be present`);
  }
  for (const connectorId of terraProofConnectorIds) {
    assert.equal(connectorFamilies.has(connectorId), true, `${connectorId} connector family must be present`);
  }
  for (const layer of layers) {
    assert.ok(layer.dataset);
    assert.ok(layer.source);
    assert.ok(layer.spatialResolutionMeters > 0);
    assert.ok(layer.license);
    assert.ok(layer.processingVersion.startsWith("terraproof-"));
    assert.match(layer.tileTemplate, /\/canopyproof\/terra\/layers\/.+\/tiles\/\{z\}\/\{x\}\/\{y\}/);
    assert.match(layer.confidencePolicy, /Confidence/);
    assert.match(layer.missingDataPolicy, /Missing-data flags/);
  }
});

test("TerraProof connector run creates provenance-rich scene metadata and deterministic hashes", () => {
  const service = new TerraProofService();
  const accepted = service.runConnector(
    "sentinel",
    {
      layerId: "terra_sentinel_ndvi",
      regionId: "region_ggw_sahel",
      acquisitionTimestamp: "2026-07-08T00:00:00.000Z",
      bbox: { west: -17.6, south: 14.6, east: -17.3, north: 14.9 },
      cloudCoverPercent: 12,
      ndviMean: 0.62,
      waterIndexMean: 0.08,
      completedAt: "2026-07-08T00:10:00.000Z",
    },
    "terra_connector_agent_001",
  );
  const replay = service.runConnector(
    "sentinel",
    {
      layerId: "terra_sentinel_ndvi",
      regionId: "region_ggw_sahel",
      acquisitionTimestamp: "2026-07-08T00:00:00.000Z",
      bbox: { west: -17.6, south: 14.6, east: -17.3, north: 14.9 },
      cloudCoverPercent: 12,
      ndviMean: 0.62,
      waterIndexMean: 0.08,
      completedAt: "2026-07-08T00:10:00.000Z",
    },
    "terra_connector_agent_001",
  );

  assert.equal(accepted.run.status, "accepted");
  assert.equal(accepted.scene.sceneHash, replay.scene.sceneHash);
  assert.equal(accepted.scene.provider, "Copernicus Sentinel");
  assert.equal(accepted.scene.dataset, "Sentinel-2 L2A NDVI");
  assert.equal(accepted.scene.signalSummary.vegetationSignal, "supports");
  assert.equal(accepted.scene.auditEvent.entityType, "terra_scene");
  assert.equal(accepted.scene.auditEvent.actor, "terra_connector_agent_001");
  assert.equal(service.listScenes().length, 1, "same deterministic scene id should upsert replayed scene");

  const challenged = service.runConnector(
    "open_climate",
    {
      layerId: "terra_open_climate_drought",
      regionId: "region_ggw_sahel",
      acquisitionTimestamp: "2026-07-08T00:00:00.000Z",
      bbox: { west: -17.6, south: 14.6, east: -17.3, north: 14.9 },
      cloudCoverPercent: 0,
      missingDataFlags: ["soil_moisture_gap"],
      droughtSeverity: 86,
    },
    "terra_connector_agent_002",
  );

  assert.equal(challenged.run.status, "needs_review");
  assert.ok(challenged.run.qualityFlags.includes("soil_moisture_gap"));
  assert.ok(challenged.run.qualityFlags.includes("drought_extreme"));
  assert.equal(challenged.scene.signalSummary.droughtSignal, "contradicts");
  assert.ok(challenged.scene.confidenceScore < accepted.scene.confidenceScore);
});

test("TerraProof API exposes layer reads, connector runs, scenes, and RBAC boundaries", async () => {
  const layers = await app.request("/canopyproof/terra/layers", {
    headers: headers("observer", "observer_terra_reader"),
  });
  assert.equal(layers.status, 200);
  const layersBody = await json<{ ok: true; data: Array<{ id: string; type: string; providerFamily: string }> }>(layers);
  assert.ok(layersBody.data.some((layer) => layer.type === "ndvi" && layer.providerFamily === "sentinel"));

  const denied = await app.request("/canopyproof/terra/connectors/sentinel/runs", {
    method: "POST",
    headers: headers("observer", "observer_terra_denied"),
    body: JSON.stringify({
      layerId: "terra_sentinel_ndvi",
      regionId: "region_ggw_sahel",
      acquisitionTimestamp: "2026-07-08T00:00:00.000Z",
      bbox: { west: -17.6, south: 14.6, east: -17.3, north: 14.9 },
      ndviMean: 0.55,
    }),
  });
  assert.equal(denied.status, 403);

  const created = await app.request("/canopyproof/terra/connectors/sentinel/runs", {
    method: "POST",
    headers: headers("agent", "terra_connector_agent_api"),
    body: JSON.stringify({
      layerId: "terra_sentinel_ndvi",
      regionId: "region_ggw_sahel",
      acquisitionTimestamp: "2026-07-08T00:00:00.000Z",
      bbox: { west: -17.6, south: 14.6, east: -17.3, north: 14.9 },
      cloudCoverPercent: 14,
      ndviMean: 0.55,
      waterIndexMean: 0.06,
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await json<{
    ok: true;
    data: {
      run: { id: string; connectorId: string; status: string; sceneId: string };
      scene: {
        id: string;
        acquisitionTimestamp: string;
        processingVersion: string;
        spatialResolutionMeters: number;
        license: string;
        missingDataFlags: string[];
        sceneHash: string;
      };
    };
  }>(created);

  assert.equal(createdBody.data.run.connectorId, "sentinel");
  assert.equal(createdBody.data.run.status, "accepted");
  assert.equal(createdBody.data.scene.acquisitionTimestamp, "2026-07-08T00:00:00.000Z");
  assert.ok(createdBody.data.scene.processingVersion);
  assert.ok(createdBody.data.scene.spatialResolutionMeters > 0);
  assert.ok(createdBody.data.scene.license);
  assert.deepEqual(createdBody.data.scene.missingDataFlags, []);
  assert.ok(createdBody.data.scene.sceneHash.length >= 64);

  const scene = await app.request(`/canopyproof/terra/scenes/${createdBody.data.scene.id}`, {
    headers: headers("observer", "observer_terra_reader"),
  });
  assert.equal(scene.status, 200);

  const run = await app.request(`/canopyproof/terra/connectors/sentinel/runs/${createdBody.data.run.id}`, {
    headers: headers("observer", "observer_terra_reader"),
  });
  assert.equal(run.status, 200);
});
