import type { CanopyProofGlobalCommandCenterRegion } from "@dropin/schemas/canopyproof-global-command-center";

export const globalCommandCenterMarkerStates = [
  "challenged",
  "active_risk",
  "monitored",
  "registered",
] as const;

export type GlobalCommandCenterMarkerState = (typeof globalCommandCenterMarkerStates)[number];

export type GlobalCommandCenterEarthMarker = {
  readonly regionId: string;
  readonly latitudeDegrees: number;
  readonly longitudeDegrees: number;
  readonly position: readonly [number, number, number];
  readonly radius: number;
  readonly color: string;
  readonly state: GlobalCommandCenterMarkerState;
  readonly projectCount: number;
  readonly activeRiskAlertCount: number;
  readonly sourceProjectCount: number;
  readonly precisionDegrees: 1;
  readonly disclosureRoot: string;
};

const markerColors: Readonly<Record<GlobalCommandCenterMarkerState, string>> = {
  challenged: "#f87171",
  active_risk: "#fbbf24",
  monitored: "#34d399",
  registered: "#60a5fa",
};

export function buildGlobalCommandCenterEarthMarkers(
  regions: readonly CanopyProofGlobalCommandCenterRegion[],
): readonly GlobalCommandCenterEarthMarker[] {
  return regions.flatMap((region) => {
    if (region.spatial.visibility !== "generalized") return [];
    const state = classifyGlobalCommandCenterMarkerState(region);
    return [{
      regionId: region.regionId,
      latitudeDegrees: region.spatial.centroid.latitudeDegrees,
      longitudeDegrees: region.spatial.centroid.longitudeDegrees,
      position: latitudeLongitudeToCartesian(
        region.spatial.centroid.latitudeDegrees,
        region.spatial.centroid.longitudeDegrees,
        1.035,
      ),
      radius: Math.min(0.065, 0.022 + Math.log2(region.projectCount + 1) * 0.008),
      color: markerColors[state],
      state,
      projectCount: region.projectCount,
      activeRiskAlertCount: region.activeRiskAlertCount,
      sourceProjectCount: region.spatial.sourceProjectCount,
      precisionDegrees: region.spatial.precisionDegrees,
      disclosureRoot: region.spatial.disclosureRoot,
    }];
  });
}

export function latitudeLongitudeToCartesian(
  latitudeDegrees: number,
  longitudeDegrees: number,
  radius: number,
): readonly [number, number, number] {
  if (!Number.isFinite(latitudeDegrees) || latitudeDegrees < -90 || latitudeDegrees > 90) {
    throw new Error("CanopyProof Earth marker latitude is outside the supported range.");
  }
  if (!Number.isFinite(longitudeDegrees) || longitudeDegrees < -180 || longitudeDegrees >= 180) {
    throw new Error("CanopyProof Earth marker longitude is outside the supported range.");
  }
  if (!Number.isFinite(radius) || radius <= 0) {
    throw new Error("CanopyProof Earth marker radius must be positive and finite.");
  }

  const latitude = latitudeDegrees * Math.PI / 180;
  const longitude = longitudeDegrees * Math.PI / 180;
  const horizontal = Math.cos(latitude) * radius;
  return [
    horizontal * Math.cos(longitude),
    Math.sin(latitude) * radius,
    -horizontal * Math.sin(longitude),
  ];
}

function classifyGlobalCommandCenterMarkerState(
  region: CanopyProofGlobalCommandCenterRegion,
): GlobalCommandCenterMarkerState {
  if (region.challengedProjectCount > 0) return "challenged";
  if (region.activeRiskAlertCount > 0) return "active_risk";
  if (region.acceptedMonitoringEventCount > 0) return "monitored";
  return "registered";
}
