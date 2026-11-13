import type { Metadata } from "next";

export type PublicPageLanguage = { lang?: string | string[] };
export function publicPageLocale(language: string | string[] | undefined): "en" | "zh" {
  const first = Array.isArray(language) ? language[0] : language;
  return first === "zh" || first === "zh-CN" ? "zh" : "en";
}
export function publicPageMetadata(path: string, language: string | string[] | undefined, title: readonly [string, string], description: readonly [string, string]): Metadata {
  const zh = publicPageLocale(language) === "zh";
  const url = `https://canopyproof.org${path}${zh ? "?lang=zh" : ""}`;
  return {
    title: title[zh ? 1 : 0], description: description[zh ? 1 : 0],
    alternates: { canonical: url, languages: { en: `https://canopyproof.org${path}`, "zh-CN": `https://canopyproof.org${path}?lang=zh`, "x-default": `https://canopyproof.org${path}` } },
    openGraph: { title: title[zh ? 1 : 0], description: description[zh ? 1 : 0], url, siteName: "CanopyProof", locale: zh ? "zh_CN" : "en_US", type: "website" },
    twitter: { title: title[zh ? 1 : 0], description: description[zh ? 1 : 0] },
  };
}
