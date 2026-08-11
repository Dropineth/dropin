import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// OpenNext's Cloudflare adapter runs Next.js pages in the Worker Node.js
// compatibility runtime. The Edge runtime is reserved for middleware and must
// not be configured as a split page function in a single-Worker deployment.
export default defineCloudflareConfig({
  cachePurge: "dummy",
  enableCacheInterception: false,
  incrementalCache: "dummy",
  queue: "dummy",
  routePreloadingBehavior: "none",
  tagCache: "dummy",
});
