import type { Metadata } from "next";
import { isProductionSite } from "./life/navigation";

export type PlanetaryLocale = "en" | "zh";
export const planetaryViews = ["home", "earth", "evidence", "participation", "trust"] as const;
export type PlanetaryView = typeof planetaryViews[number];
export const planetaryTitles = {
  en: { home: "Overview", earth: "Earth reference", evidence: "Evidence", participation: "Participation status", trust: "Trust center" },
  zh: { home: "概览", earth: "地球参考视图", evidence: "证据工作台", participation: "参与状态", trust: "信任中心" },
} as const;

export function planetaryHref(locale: PlanetaryLocale, view: PlanetaryView = "home") {
  const prefix = locale === "zh" ? "/zh" : "";
  return `${prefix}${view === "home" ? "" : `/${view}`}` || "/";
}

export function planetaryMetadata(locale: PlanetaryLocale, view: PlanetaryView): Metadata {
  const path = planetaryHref(locale, view);
  const title = `${planetaryTitles[locale][view]} · CanopyProof`;
  const description = locale === "zh"
    ? "连接空间证据、生态修复与可信协作。地理与项目示意分别标注，观测、估算与核证状态保持清晰。"
    : "Connect spatial evidence, restoration and accountable collaboration. Reference geography, illustrative projects and evidence status stay distinct.";
  return {
    title, description,
    alternates: { canonical: `https://canopyproof.org${path}`, languages: {
      en: `https://canopyproof.org${planetaryHref("en", view)}`,
      "zh-CN": `https://canopyproof.org${planetaryHref("zh", view)}`,
      "x-default": `https://canopyproof.org${planetaryHref("en", view)}`,
    } },
    openGraph: {
      title, description, url: `https://canopyproof.org${path}`, siteName: "CanopyProof",
      locale: locale === "zh" ? "zh_CN" : "en_US", type: "website",
      images: [{ url: "/icon.jpg", width: 400, height: 400, alt: "CanopyProof by Dropin logo" }],
    },
    twitter: { card: "summary_large_image", title, description, images: ["/icon.jpg"] },
    robots: { index: isProductionSite, follow: isProductionSite },
  };
}
