/** Presentation-only records. No item grants survey, registry, or financial authority. */
import manifest from "./life/site-manifest.json";
export type PlanetaryLocale = "en" | "zh";
export type PlanetaryView = "earth" | "evidence" | "participation" | "trust";
export type ReferenceText = Readonly<Record<PlanetaryLocale, string>>;

export const referenceEvidence = Object.freeze({
  id: "fixture:forest-structure-01",
  scope: "fixture",
  templateVersion: "UI_REFERENCE_V1",
  sourceVersion: null,
  source: null,
  sourceHash: null,
  captureDate: null,
  captureProvider: null,
  rightsScope: null,
  sourceCRS: null,
  metricScale: null,
  registrationError: null,
  fieldMeasurements: null,
  methodology: null,
  independentReview: null,
  registryReference: null,
  retirementReference: null,
  productionAuthority: false,
} as const);

export const evidenceStages = [
  { id: "observation", title: { en: "Observation", zh: "现场观测" }, description: { en: "A sourced capture, its time and permissions.", zh: "有来源的采集、时间与许可。" } },
  { id: "estimate", title: { en: "Estimate", zh: "独立估算" }, description: { en: "Measurements, a method and stated uncertainty.", zh: "测量、方法与明确的不确定性。" } },
  { id: "verified", title: { en: "Verified", zh: "独立核证" }, description: { en: "A review tied to the exact claim and version.", zh: "对应精确声明与版本的核证记录。" } },
  { id: "issued", title: { en: "Issued", zh: "登记签发" }, description: { en: "An attributable registry issuance record.", zh: "可追溯的登记签发记录。" } },
  { id: "retired", title: { en: "Retired", zh: "额度注销" }, description: { en: "A separate, attributable retirement record.", zh: "独立、可追溯的注销记录。" } },
] as const;

export const referenceRooms = manifest.spaces.map(room => ({
  id: room.unit,
  title: { en: room.programEn, zh: room.programZh },
  description: { en: "Proposed use; lease, opening and operational acceptance remain unverified.", zh: "拟议用途；租约、开放与运营验收仍未核实。" },
}));

export function planetaryPath(path: string, locale: PlanetaryLocale) {
  return locale === "zh" ? `/zh${path}` : path;
}

export function referenceLifePath(path: string, locale: PlanetaryLocale) {
  return locale === "en" ? `/en${path}` : path;
}
