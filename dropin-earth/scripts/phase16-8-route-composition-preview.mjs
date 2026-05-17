import { createServer, request as upstreamRequest } from "node:http";
import { pipeline } from "node:stream";

const port = Number(process.env.ROUTE_COMPOSITION_PREVIEW_PORT ?? "8790");
const webOrigin = new URL(process.env.WEB_PREVIEW_ORIGIN ?? "http://127.0.0.1:8788");
const apiOrigin = new URL(process.env.API_PROXY_PREVIEW_ORIGIN ?? "http://127.0.0.1:8789");

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]);

function filteredHeaders(headers) {
  const output = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!hopByHopHeaders.has(key.toLowerCase()) && value !== undefined) {
      output[key] = value;
    }
  }
  return output;
}

function targetFor(url) {
  const target = url.pathname === "/api" || url.pathname.startsWith("/api/") ? apiOrigin : webOrigin;
  const composed = new URL(`${url.pathname}${url.search}`, target);
  return { owner: target === apiOrigin ? "api-proxy" : "web", url: composed };
}

const server = createServer((incoming, outgoing) => {
  const host = incoming.headers.host ?? `127.0.0.1:${port}`;
  const incomingUrl = new URL(incoming.url ?? "/", `http://${host}`);
  const target = targetFor(incomingUrl);

  const proxy = upstreamRequest(
    target.url,
    {
      method: incoming.method,
      headers: {
        ...filteredHeaders(incoming.headers),
        host: target.url.host,
        "x-canopyproof-preview-router": "phase16-8-r1",
        "x-canopyproof-preview-route-owner": target.owner,
      },
    },
    (response) => {
      const headers = {
        ...filteredHeaders(response.headers),
        "x-canopyproof-preview-router": "phase16-8-r1",
        "x-canopyproof-preview-route-owner": target.owner,
      };
      outgoing.writeHead(response.statusCode ?? 502, response.statusMessage, headers);
      pipeline(response, outgoing, (error) => {
        if (error) {
          console.error("phase16-8-route-composition response pipeline error", error);
        }
      });
    },
  );

  proxy.on("error", (error) => {
    console.error("phase16-8-route-composition upstream error", {
      owner: target.owner,
      target: target.url.toString(),
      error: error instanceof Error ? error.message : String(error),
    });
    if (!outgoing.headersSent) {
      outgoing.writeHead(502, {
        "content-type": "application/json; charset=utf-8",
        "x-canopyproof-preview-router": "phase16-8-r1",
        "x-canopyproof-preview-route-owner": target.owner,
      });
    }
    outgoing.end(JSON.stringify({ error: "phase16_8_route_composition_upstream_unavailable", owner: target.owner }));
  });

  pipeline(incoming, proxy, (error) => {
    if (error) {
      proxy.destroy(error);
    }
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Phase 16.8 route composition preview listening on http://127.0.0.1:${port}`);
  console.log(
    JSON.stringify(
      {
        testHarnessOnly: true,
        productionDeployExecuted: false,
        webOrigin: webOrigin.toString(),
        apiProxyOrigin: apiOrigin.toString(),
        routeRule: "/api/* -> api-proxy; all other paths -> web",
      },
      null,
      2,
    ),
  );
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
