import { isProductionSite } from "../data/life/navigation";
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  if (!isProductionSite) return { rules: [{ userAgent: "*", disallow: "/" }] };
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
      },
    ],
    sitemap: "https://canopyproof.org/sitemap.xml",
    host: "https://canopyproof.org",
  };
}
