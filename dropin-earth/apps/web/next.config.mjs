import process from "node:process";
/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    const production = process.env.NEXT_PUBLIC_CANOPYPROOF_MODE === "production"
      && process.env.NEXT_PUBLIC_DROPIN_SITE_URL === "https://canopyproof.org";
    return production ? [] : [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }];
  },
  transpilePackages: ["@dropin/schemas", "@dropin/ui", "@dropin/dropin-protocol"],
};

export default nextConfig;
