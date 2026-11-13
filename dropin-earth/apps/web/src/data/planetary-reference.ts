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
  { id: "observation", title: { en: "Observation", zh: "现场观测" }, description: { en: "A record of what was observed, when and by whom.", zh: "记录看到了什么、观察时间及资料来源。" } },
  { id: "estimate", title: { en: "Estimate", zh: "估算" }, description: { en: "A calculation with its method, inputs and uncertainty.", zh: "说明计算方法、输入数据与误差范围。" } },
  { id: "verified", title: { en: "Verified", zh: "独立核证" }, description: { en: "An independent review of a specific claim and version.", zh: "由独立方审核具体声明及对应版本。" } },
  { id: "issued", title: { en: "Issued", zh: "登记签发" }, description: { en: "A registry record showing that credits were issued.", zh: "通过登记记录确认碳信用是否已签发。" } },
  { id: "retired", title: { en: "Retired", zh: "额度注销" }, description: { en: "A registry record showing credits have been retired and cannot be used again.", zh: "通过登记记录确认碳信用已注销，不能再次使用。" } },
] as const;

export const referenceRooms = manifest.spaces.map(room => ({
  id: room.unit,
  title: { en: room.programEn, zh: room.programZh },
  description: { en: "Planned use. Lease arrangements and opening dates are not confirmed.", zh: "规划用途，租赁安排与开放时间尚未确认。" },
}));

export function planetaryPath(path: string, locale: PlanetaryLocale) {
  return locale === "zh" ? `/zh${path}` : path;
}

export function referenceLifePath(path: string, locale: PlanetaryLocale) {
  return locale === "en" ? `/en${path}` : path;
}
