import process from "node:process";
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return {
      // Next hides Flight headers from middleware and restores them afterward.
      // A beforeFiles rule can validate the original flags before HTML rendering.
      beforeFiles: [{
        source: "/((?!_next/|favicon.ico|robots.txt|sitemap.xml|icon.jpg|apple-touch-icon.jpg|og/).*)",
        has: [{ type: "header", key: "next-router-prefetch" }],
        missing: [{ type: "header", key: "rsc", value: "^1$" }],
        destination: "/request-errors/prefetch",
      }],
      afterFiles: [],
      fallback: [],
    };
  },
  async headers() {
    const production = process.env.NEXT_PUBLIC_CANOPYPROOF_MODE === "production"
      && process.env.NEXT_PUBLIC_DROPIN_SITE_URL === "https://canopyproof.org";
    return production ? [] : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  transpilePackages: ["@dropin/schemas", "@dropin/ui", "@dropin/dropin-protocol"],
};

export default nextConfig;
