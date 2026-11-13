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
  home: [LIFEPP_PUBLIC_BRAND, `${LIFEPP_PUBLIC_BRAND} — Spaces, AI and community`],
  spaces: ["三维空间与来源说明", "3D spaces and source information"], center: ["三铺共生中心 · 空间规划", "Three-unit community center · Planned spaces"],
  agents: ["数字分身与边缘计算", "Agents & edge computing"], membership: ["拟议会员方案", "Proposed membership"],
  partners: ["学校、机构与企业合作", "Partnerships for schools, institutions and businesses"], trust: ["授权、隐私与责任", "Permissions, privacy & responsibility"],
  company: ["关于 CanopyProof Limited", "About CanopyProof Limited"],
};
export const isProductionSite = process.env.NEXT_PUBLIC_CANOPYPROOF_MODE === "production"
  && process.env.NEXT_PUBLIC_DROPIN_SITE_URL === "https://canopyproof.org";
export function localPath(path: string, locale: Locale) { return locale === "en" ? `/en${path}` : path; }
export function lifeMetadata(path: string, page: string, locale: Locale): Metadata {
  const isScene = path === "/life/spaces/33" || path === "/life/spaces/31" || path === "/life/spaces/29";
  const baseTitle = isScene ? `${locale === "zh" ? "场景" : "Scene "}${path.split("/").pop()}` : (titles[page]?.[locale === "zh" ? 0 : 1] ?? LIFEPP_PUBLIC_BRAND);
  const title = page === "company" || baseTitle.includes(LIFEPP_PUBLIC_BRAND) ? baseTitle : `${baseTitle} · ${LIFEPP_PUBLIC_BRAND}`;
  const description = locale === "zh" ? "了解 Life++HERE 的三维空间、个人智能助手与社区学习规划。深圳会展湾 L112、L203、L202 三铺共 380.48㎡；可浏览方案并整理合作需求。场地服务与会员收费尚未开放。" : "Explore Life++HERE plans for 3D spaces, personal AI assistance and community learning. The proposed 380.48 m² center covers L112, L203 and L202 at Expo Bay, Shenzhen. Browse the plans and prepare an enquiry; venue services and paid memberships are not yet open.";
  const canonical = `https://canopyproof.org${localPath(path, locale)}`;
  return { title, description, alternates: { canonical, languages: { "zh-CN": `https://canopyproof.org${path}`, en: `https://canopyproof.org/en${path}`, "x-default": `https://canopyproof.org${path}` } }, openGraph: { title, description, url: canonical, locale: locale === "zh" ? "zh_CN" : "en_US", siteName: `CanopyProof · ${LIFEPP_PUBLIC_BRAND}` }, twitter: { card: "summary_large_image", title, description, images: ["/icon.jpg"] }, robots: { index: isProductionSite, follow: isProductionSite } };
}
