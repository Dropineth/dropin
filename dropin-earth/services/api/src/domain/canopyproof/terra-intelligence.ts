import { hashJson } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const terraProofConnectorIds = ["sentinel", "landsat", "nasa", "open_climate"] as const;
export const terraProofLayerTypes = [
  "satellite_base_imagery",
  "ndvi",
  "vegetation",
  "water",
  "drought",
  "wildfire",
  "land_change",
] as const;

export type TerraProofConnectorId = (typeof terraProofConnectorIds)[number];
export type TerraProofLayerType = (typeof terraProofLayerTypes)[number];
export type TerraProofSignal = "supports" | "neutral" | "contradicts" | "insufficient_data";

export type TerraProofBoundingBox = {
  readonly west: number;
  readonly south: number;
  readonly east: number;
  readonly north: number;
};

export type TerraProofLayer = {
  readonly id: string;
  readonly type: TerraProofLayerType;
  readonly title: string;
  readonly providerFamily: TerraProofConnectorId;
  readonly dataset: string;
  readonly source: string;
  readonly spatialResolutionMeters: number;
  readonly temporalCadence: string;
  readonly license: string;
  readonly processingVersion: string;
  readonly supportedSignals: readonly string[];
  readonly confidencePolicy: string;
  readonly missingDataPolicy: string;
  readonly tileTemplate: string;
};

export type TerraProofSceneSignalSummary = {
  readonly vegetationSignal: TerraProofSignal;
  readonly waterSignal: TerraProofSignal;
  readonly droughtSignal: TerraProofSignal;
  readonly wildfireSignal: TerraProofSignal;
  readonly landChangeSignal: TerraProofSignal;
  readonly ndviMean?: number;
  readonly waterIndexMean?: number;
  readonly droughtSeverity?: number;
  readonly wildfireRisk?: number;
  readonly landChangeDeltaPercent?: number;
};

export type TerraProofScene = {
  readonly id: string;
  readonly layerId: string;
  readonly connectorId: TerraProofConnectorId;
  readonly provider: string;
  readonly dataset: string;
  readonly regionId: string;
  readonly acquisitionTimestamp: string;
  readonly processingVersion: string;
  readonly spatialResolutionMeters: number;
  readonly license: string;
  readonly bbox: TerraProofBoundingBox;
  readonly cloudCoverPercent: number;
  readonly missingDataFlags: readonly string[];
  readonly confidenceScore: number;
  readonly signalSummary: TerraProofSceneSignalSummary;
  readonly sceneHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type TerraProofConnectorRun = {
  readonly id: string;
  readonly connectorId: TerraProofConnectorId;
  readonly layerId: string;
  readonly regionId: string;
  readonly status: "accepted" | "needs_review";
  readonly startedAt: string;
  readonly completedAt: string;
  readonly sceneId: string;
  readonly sceneHash: string;
  readonly qualityFlags: readonly string[];
  readonly auditEvent: CanopyProofAuditEvent;
};

const bboxSchema = z
  .object({
    west: z.number().min(-180).max(180),
    south: z.number().min(-90).max(90),
    east: z.number().min(-180).max(180),
    north: z.number().min(-90).max(90),
  })
  .refine((bbox) => bbox.west < bbox.east, "bbox.west must be less than bbox.east")
  .refine((bbox) => bbox.south < bbox.north, "bbox.south must be less than bbox.north");

const connectorRunSchema = z.object({
  layerId: z.string().min(1),
  regionId: z.string().min(1),
  acquisitionTimestamp: z.string().datetime(),
  bbox: bboxSchema,
  cloudCoverPercent: z.number().min(0).max(100).default(0),
  missingDataFlags: z.array(z.string().min(1)).default([]),
  ndviMean: z.number().min(-1).max(1).optional(),
  waterIndexMean: z.number().min(-1).max(1).optional(),
  droughtSeverity: z.number().min(0).max(100).optional(),
  wildfireRisk: z.number().min(0).max(100).optional(),
  landChangeDeltaPercent: z.number().min(-100).max(100).optional(),
  completedAt: z.string().datetime().optional(),
});

export class TerraProofService {
  private readonly layers = new Map<string, TerraProofLayer>();
  private readonly scenes = new Map<string, TerraProofScene>();
  private readonly runs = new Map<string, TerraProofConnectorRun>();

  constructor() {
    for (const layer of defaultTerraProofLayers()) {
      this.layers.set(layer.id, layer);
    }
  }

  listLayers() {
    return [...this.layers.values()].sort((left, right) => left.id.localeCompare(right.id));
  }

  getLayer(layerId: string) {
    const layer = this.layers.get(layerId);
    if (!layer) {
      throw new Error(`TerraProof layer not found: ${layerId}`);
    }
    return layer;
  }

  listScenes() {
    return [...this.scenes.values()].sort((left, right) => right.acquisitionTimestamp.localeCompare(left.acquisitionTimestamp));
  }

  getScene(sceneId: string) {
    const scene = this.scenes.get(sceneId);
    if (!scene) {
      throw new Error(`TerraProof scene not found: ${sceneId}`);
    }
    return scene;
  }

  listConnectorRuns() {
    return [...this.runs.values()].sort((left, right) => right.completedAt.localeCompare(left.completedAt));
  }

  getConnectorRun(runId: string) {
    const run = this.runs.get(runId);
    if (!run) {
      throw new Error(`TerraProof connector run not found: ${runId}`);
    }
    return run;
  }

  runConnector(connectorId: TerraProofConnectorId, input: unknown, actor: string) {
    if (!terraProofConnectorIds.includes(connectorId)) {
      throw new Error(`Unsupported TerraProof connector: ${connectorId}`);
    }
    const parsed = connectorRunSchema.parse(input);
    const layer = this.getLayer(parsed.layerId);
    if (layer.providerFamily !== connectorId) {
      throw new Error(`Layer ${layer.id} belongs to ${layer.providerFamily}, not ${connectorId}.`);
    }
    const completedAt = parsed.completedAt ?? parsed.acquisitionTimestamp;
    const signalSummary = signalSummaryForLayer(layer.type, parsed);
    const qualityFlags = qualityFlagsForScene(parsed);
    const confidenceScore = confidenceForScene(parsed, signalSummary, qualityFlags);
    const sceneSeed = {
      layerId: layer.id,
      connectorId,
      provider: providerName(connectorId),
      dataset: layer.dataset,
      regionId: parsed.regionId,
      acquisitionTimestamp: parsed.acquisitionTimestamp,
      processingVersion: layer.processingVersion,
      spatialResolutionMeters: layer.spatialResolutionMeters,
      license: layer.license,
      bbox: parsed.bbox,
      cloudCoverPercent: parsed.cloudCoverPercent,
      missingDataFlags: parsed.missingDataFlags,
      confidenceScore,
      signalSummary,
    };
    const sceneHash = hashJson({ kind: "canopyproof-terra-scene-v1", ...sceneSeed });
    const sceneId = `terra_scene_${sceneHash.slice(0, 24)}`;
    const runId = `terra_run_${hashJson({ connectorId, sceneId, completedAt, actor }).slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent([], {
      action: qualityFlags.length > 0 ? "CHALLENGE" : "ASSERT",
      actor,
      entityType: "terra_scene",
      entityId: sceneId,
      payload: {
        runId,
        sceneHash,
        qualityFlags,
        confidenceScore,
      },
      createdAt: completedAt,
      rationale:
        qualityFlags.length > 0
          ? "TerraProof connector run completed with visible quality flags; scene is retained for review."
          : "TerraProof connector run produced provenance-rich satellite/climate scene metadata.",
    }).at(-1);

    if (!auditEvent) {
      throw new Error("TerraProof connector run failed to append an audit event.");
    }

    const scene: TerraProofScene = {
      id: sceneId,
      ...sceneSeed,
      sceneHash,
      auditEvent,
    };
    const run: TerraProofConnectorRun = {
      id: runId,
      connectorId,
      layerId: layer.id,
      regionId: parsed.regionId,
      status: qualityFlags.length > 0 ? "needs_review" : "accepted",
      startedAt: parsed.acquisitionTimestamp,
      completedAt,
      sceneId,
      sceneHash,
      qualityFlags,
      auditEvent,
    };

    this.scenes.set(scene.id, scene);
    this.runs.set(run.id, run);
    return { run, scene };
  }

  getStatus() {
    return {
      service: "canopyproof-terraproof-earth-intelligence",
      layerCount: this.layers.size,
      sceneCount: this.scenes.size,
      connectorRunCount: this.runs.size,
      connectors: terraProofConnectorIds,
      layerTypes: terraProofLayerTypes,
    };
  }
}

export function defaultTerraProofLayers(): readonly TerraProofLayer[] {
  return [
    layer("terra_sentinel_base", "satellite_base_imagery", "Sentinel-2 surface reflectance base imagery", "sentinel", "Sentinel-2 L2A", 10, [
      "true_color",
      "false_color",
      "scene_context",
    ]),
    layer("terra_sentinel_ndvi", "ndvi", "Sentinel-2 NDVI vegetation index", "sentinel", "Sentinel-2 L2A NDVI", 10, [
      "ndvi",
      "vegetation_health",
      "canopy_change",
    ]),
    layer("terra_landsat_vegetation", "vegetation", "Landsat vegetation continuity", "landsat", "Landsat Collection 2 Level-2", 30, [
      "vegetation_signal",
      "seasonal_baseline",
    ]),
    layer("terra_nasa_water", "water", "NASA water stress and surface-water signal", "nasa", "NASA open water indicators", 250, [
      "water_index",
      "surface_water",
      "watershed_context",
    ]),
    layer("terra_open_climate_drought", "drought", "Open climate drought severity", "open_climate", "Open climate drought composite", 5000, [
      "drought_severity",
      "soil_moisture_context",
    ]),
    layer("terra_nasa_wildfire", "wildfire", "NASA wildfire risk and burn context", "nasa", "NASA FIRMS and burn-area context", 375, [
      "thermal_anomaly",
      "burn_risk",
      "active_fire_context",
    ]),
    layer("terra_landsat_land_change", "land_change", "Landsat land-change delta", "landsat", "Landsat land-change composite", 30, [
      "land_change_delta",
      "disturbance_signal",
    ]),
  ];
}

function layer(
  id: string,
  type: TerraProofLayerType,
  title: string,
  providerFamily: TerraProofConnectorId,
  dataset: string,
  spatialResolutionMeters: number,
  supportedSignals: readonly string[],
): TerraProofLayer {
  return {
    id,
    type,
    title,
    providerFamily,
    dataset,
    source: providerName(providerFamily),
    spatialResolutionMeters,
    temporalCadence: providerFamily === "open_climate" ? "daily to monthly, dataset dependent" : "scene acquisition cadence",
    license: providerFamily === "sentinel" || providerFamily === "landsat" ? "open public earth-observation data" : "open dataset license, source dependent",
    processingVersion: `terraproof-${type}-v1`,
    supportedSignals,
    confidencePolicy: "Confidence is reduced for cloud cover, missing-data flags, and unsupported layer signals.",
    missingDataPolicy: "Missing-data flags remain visible and prevent silent promotion into final proof.",
    tileTemplate: `/canopyproof/terra/layers/${id}/tiles/{z}/{x}/{y}`,
  };
}

function providerName(connectorId: TerraProofConnectorId) {
  if (connectorId === "sentinel") return "Copernicus Sentinel";
  if (connectorId === "landsat") return "USGS/NASA Landsat";
  if (connectorId === "nasa") return "NASA Earthdata";
  return "Open climate dataset network";
}

function signalSummaryForLayer(
  layerType: TerraProofLayerType,
  input: z.infer<typeof connectorRunSchema>,
): TerraProofSceneSignalSummary {
  const ndviMean = input.ndviMean;
  const waterIndexMean = input.waterIndexMean;
  const droughtSeverity = input.droughtSeverity;
  const wildfireRisk = input.wildfireRisk;
  const landChangeDeltaPercent = input.landChangeDeltaPercent;

  const base = {
    vegetationSignal: signalFromThreshold(ndviMean, 0.35, 0.2),
    waterSignal: signalFromThreshold(waterIndexMean, 0.15, 0.02),
    droughtSignal: inverseSignalFromSeverity(droughtSeverity, 35, 70),
    wildfireSignal: inverseSignalFromSeverity(wildfireRisk, 35, 70),
    landChangeSignal: landChangeSignal(landChangeDeltaPercent),
  };

  return {
    vegetationSignal:
      layerType === "ndvi" || layerType === "vegetation" || layerType === "satellite_base_imagery"
        ? base.vegetationSignal
        : "neutral",
    waterSignal: layerType === "water" ? base.waterSignal : "neutral",
    droughtSignal: layerType === "drought" ? base.droughtSignal : "neutral",
    wildfireSignal: layerType === "wildfire" ? base.wildfireSignal : "neutral",
    landChangeSignal: layerType === "land_change" ? base.landChangeSignal : "neutral",
    ...(ndviMean !== undefined ? { ndviMean } : {}),
    ...(waterIndexMean !== undefined ? { waterIndexMean } : {}),
    ...(droughtSeverity !== undefined ? { droughtSeverity } : {}),
    ...(wildfireRisk !== undefined ? { wildfireRisk } : {}),
    ...(landChangeDeltaPercent !== undefined ? { landChangeDeltaPercent } : {}),
  };
}

function qualityFlagsForScene(input: z.infer<typeof connectorRunSchema>) {
  const flags = [...input.missingDataFlags];
  if (input.cloudCoverPercent > 60) {
    flags.push("cloud_cover_high");
  }
  if (input.ndviMean !== undefined && input.ndviMean < 0.05) {
    flags.push("ndvi_extremely_low");
  }
  if (input.droughtSeverity !== undefined && input.droughtSeverity >= 80) {
    flags.push("drought_extreme");
  }
  if (input.wildfireRisk !== undefined && input.wildfireRisk >= 80) {
    flags.push("wildfire_extreme");
  }
  return [...new Set(flags)].sort();
}

function confidenceForScene(
  input: z.infer<typeof connectorRunSchema>,
  summary: TerraProofSceneSignalSummary,
  qualityFlags: readonly string[],
) {
  const signalPenalty = Object.values(summary).filter((value) => value === "insufficient_data").length * 10;
  const cloudPenalty = Math.round(input.cloudCoverPercent / 3);
  const flagPenalty = qualityFlags.length * 12;
  return Math.max(0, Math.min(100, 96 - cloudPenalty - flagPenalty - signalPenalty));
}

function signalFromThreshold(value: number | undefined, supportsAt: number, contradictsBelow: number): TerraProofSignal {
  if (value === undefined) return "insufficient_data";
  if (value >= supportsAt) return "supports";
  if (value < contradictsBelow) return "contradicts";
  return "neutral";
}

function inverseSignalFromSeverity(value: number | undefined, supportsBelow: number, contradictsAt: number): TerraProofSignal {
  if (value === undefined) return "insufficient_data";
  if (value < supportsBelow) return "supports";
  if (value >= contradictsAt) return "contradicts";
  return "neutral";
}

function landChangeSignal(value: number | undefined): TerraProofSignal {
  if (value === undefined) return "insufficient_data";
  if (value >= 5) return "supports";
  if (value <= -10) return "contradicts";
  return "neutral";
}
