import type { MetadataRoute } from "next";

const routes = [
  "",
  "/about",
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
  return routes.map((route) => ({
    url: `https://canopyproof.org${route}`,
    lastModified: new Date("2026-05-17T00:00:00.000Z"),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.7,
  }));
}
