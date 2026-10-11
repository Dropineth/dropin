import { lifeRoutes, isProductionSite } from "../data/life/navigation";
import type { MetadataRoute } from "next";
import { planetaryHref, planetaryViews } from "../data/planetary";

const routes = [
  "",
  "/about",
  "/ecology",
  "/earth",
  "/evidence",
  "/participation",
  "/trust",
  "/zh",
  "/zh/earth",
  "/zh/evidence",
  "/zh/participation",
  "/zh/trust",
  "/dashboard/global",
  "/explorer",
  "/faq",
  "/feedback",
  "/funding",
  "/governance",
  "/mobile/report",
  "/partners",
  "/reports/esg",
  "/risk",
  "/status",
  "/terra",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isProductionSite) return [];
  const planetaryAlternates = new Map(planetaryViews.flatMap(view => {
    const languages = { en: `https://canopyproof.org${planetaryHref("en", view)}`, "zh-CN": `https://canopyproof.org${planetaryHref("zh", view)}` };
    return ["en", "zh"].map(locale => [planetaryHref(locale as "en" | "zh", view), { languages }] as const);
  }));
  return [...routes, ...lifeRoutes, ...lifeRoutes.map(route => `/en${route}`)].map((route) => ({
    url: `https://canopyproof.org${route || "/"}`,
    ...(lifeRoutes.includes(route.replace(/^\/en/, "")) ? { alternates: { languages: { "zh-CN": `https://canopyproof.org${route.replace(/^\/en/, "")}`, en: `https://canopyproof.org/en${route.replace(/^\/en/, "")}` } } } : { lastModified: new Date("2026-05-17T00:00:00.000Z") }),
    ...(planetaryAlternates.has(route || "/") ? { alternates: planetaryAlternates.get(route || "/"), lastModified: new Date("2026-10-11T00:00:00.000Z") } : {}),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
