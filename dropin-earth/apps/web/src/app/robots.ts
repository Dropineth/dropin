import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
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
