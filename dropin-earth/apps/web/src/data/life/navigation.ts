import type { Metadata } from "next";
import manifest from "./site-manifest.json";
import { LIFEPP_PUBLIC_BRAND } from "./public-brand";

export type Locale = "zh" | "en";
export const lifeRoutes = manifest.newRoutes;
export const lifePages: Record<string, string> = {
  "": "home", spaces: "spaces", center: "center", agents: "agents",
  membership: "membership", partners: "partners", trust: "trust",
};
const titles: Record<string, [string, string]> = {
  home: [LIFEPP_PUBLIC_BRAND, `${LIFEPP_PUBLIC_BRAND} — Living with intelligent collaboration`],
  spaces: ["空间测试场景", "Spatial test scenes"], center: ["三铺人机共生中心 · 导入期规划", "Three-unit symbiosis center · Pilot planning"],
  agents: ["数字分身与边缘计算", "Agents & edge computing"], membership: ["拟议会员方案", "Proposed membership"],
  partners: ["申请空间与业务合作", "Explore a partnership"], trust: ["信任、授权与责任", "Trust, permissions & responsibility"],
  company: ["关于 CanopyProof Limited", "About CanopyProof Limited"],
};
export const isProductionSite = process.env.NEXT_PUBLIC_CANOPYPROOF_MODE === "production"
  && process.env.NEXT_PUBLIC_DROPIN_SITE_URL === "https://canopyproof.org";
export function localPath(path: string, locale: Locale) { return locale === "en" ? `/en${path}` : path; }
export function lifeMetadata(path: string, page: string, locale: Locale): Metadata {
  const isScene = path === "/life/spaces/33" || path === "/life/spaces/31" || path === "/life/spaces/29";
  const baseTitle = isScene ? `${locale === "zh" ? "场景" : "Scene "}${path.split("/").pop()}` : (titles[page]?.[locale === "zh" ? 0 : 1] ?? LIFEPP_PUBLIC_BRAND);
  const title = page === "company" || baseTitle.includes(LIFEPP_PUBLIC_BRAND) ? baseTitle : `${baseTitle} · ${LIFEPP_PUBLIC_BRAND}`;
  const description = locale === "zh" ? "从真实空间的数字重建开始，连接人的需求、社区服务与可问责的智能协作。会展湾三铺导入期规划与用户提供的测试输入；本轮不纳入L201。" : "Starting with digital reconstruction of real spaces, connecting people, community services and accountable intelligent collaboration. Three-unit pilot planning at Expo Bay and user-provided test inputs; L201 is excluded from this phase.";
  const canonical = `https://canopyproof.org${localPath(path, locale)}`;
  return { title, description, alternates: { canonical, languages: { "zh-CN": `https://canopyproof.org${path}`, en: `https://canopyproof.org/en${path}`, "x-default": `https://canopyproof.org${path}` } }, openGraph: { title, description, url: canonical, locale: locale === "zh" ? "zh_CN" : "en_US", siteName: `CanopyProof · ${LIFEPP_PUBLIC_BRAND}` }, twitter: { card: "summary_large_image", title, description, images: ["/icon.jpg"] }, robots: { index: isProductionSite, follow: isProductionSite } };
}
