// Keep this config dependency-free so the local OpenNext Cloudflare CLI can
// compile it without pulling application-only runtime state into the adapter.
export default {
  default: {
    override: {
      wrapper: "cloudflare-node",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
      cdnInvalidation: "dummy",
    },
    routePreloadingBehavior: "none",
  },
  functions: {
    canopyproofHome: {
      runtime: "edge",
      placement: "global",
      routes: ["app/page"],
      patterns: ["/"],
      override: {
        wrapper: "cloudflare-edge",
        converter: "edge",
        proxyExternalRequest: "fetch",
        incrementalCache: "dummy",
        tagCache: "dummy",
        queue: "dummy",
      },
      routePreloadingBehavior: "none",
    },
    canopyproofDraw: {
      runtime: "edge",
      placement: "global",
      routes: ["app/draw/page"],
      patterns: ["/draw"],
      override: {
        wrapper: "cloudflare-edge",
        converter: "edge",
        proxyExternalRequest: "fetch",
        incrementalCache: "dummy",
        tagCache: "dummy",
        queue: "dummy",
      },
      routePreloadingBehavior: "none",
    },
  },
  edgeExternals: ["node:crypto"],
  cloudflare: {
    useWorkerdCondition: true,
  },
  dangerous: {
    enableCacheInterception: false,
  },
  middleware: {
    external: true,
    override: {
      wrapper: "cloudflare-edge",
      converter: "edge",
      proxyExternalRequest: "fetch",
      incrementalCache: "dummy",
      tagCache: "dummy",
      queue: "dummy",
    },
  },
};
