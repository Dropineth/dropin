import type { Metadata } from "next";
import { isProductionSite } from "./life/navigation";

export type PlanetaryLocale = "en" | "zh";
export const planetaryViews = ["home", "earth", "evidence", "participation", "trust"] as const;
export type PlanetaryView = typeof planetaryViews[number];
export const planetaryTitles = {
  en: { home: "Home", earth: "Explore Earth", evidence: "Evidence", participation: "Get involved", trust: "Trust & transparency" },
  zh: { home: "首页", earth: "探索地球", evidence: "环境记录", participation: "如何参与", trust: "透明说明" },
} as const;

export function planetaryHref(locale: PlanetaryLocale, view: PlanetaryView = "home") {
  const prefix = locale === "zh" ? "/zh" : "";
  return `${prefix}${view === "home" ? "" : `/${view}`}` || "/";
}

export function planetaryMetadata(locale: PlanetaryLocale, view: PlanetaryView): Metadata {
  const path = planetaryHref(locale, view);
  const title = view === "home"
    ? (locale === "zh" ? "CanopyProof｜环境记录与自然学习" : "CanopyProof | Environmental Evidence & Learning")
    : `${planetaryTitles[locale][view]} · CanopyProof`;
  const description = locale === "zh"
    ? "了解环境记录，和孩子体验自然观察学习，并为机构或学校咨询试点合作。示例与真实成果明确区分。"
    : "Explore environmental evidence, try nature-learning activities with children and discuss a pilot for your organisation or school. Sample records are clearly labelled.";
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
