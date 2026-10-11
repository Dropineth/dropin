/** Presentation-only records. No item grants survey, registry, or financial authority. */
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

export const referenceRooms = [
  { id: "L112", title: { en: "Robot fleet garage", zh: "机器人机库" }, description: { en: "A proposed space for equipment care.", zh: "拟议的设备维护空间。" } },
  { id: "L203", title: { en: "Agent & edge lab", zh: "数字分身与边缘实验室" }, description: { en: "A concept for local tools and computing.", zh: "本地工具与算力的空间构想。" } },
  { id: "L202", title: { en: "Life++ club", zh: "Life++ 生生俱乐部" }, description: { en: "A proposed place for shared learning.", zh: "拟议的交流与共学空间。" } },
  { id: "L201", title: { en: "Learning & spatial arena", zh: "共学与空间竞技" }, description: { en: "A concept for workshops and co-creation.", zh: "工作坊与空间共创构想。" } },
] as const;

export function planetaryPath(path: string, locale: PlanetaryLocale) {
  return locale === "zh" ? `/zh${path}` : path;
}

export function referenceLifePath(path: string, locale: PlanetaryLocale) {
  return locale === "en" ? `/en${path}` : path;
}
