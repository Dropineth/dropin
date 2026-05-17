import { createServer } from "node:http";
import { Readable } from "node:stream";
import canopyproofApiProxy from "../infra/cloudflare/canopyproof-api-proxy.js";

const port = Number(process.env.API_PROXY_PREVIEW_PORT ?? "8789");

const env = {
  DROPIN_API_ORIGIN: process.env.DROPIN_API_ORIGIN ?? "http://127.0.0.1:8787",
  DROPIN_ALLOWED_ORIGINS:
    process.env.DROPIN_ALLOWED_ORIGINS ??
    "http://127.0.0.1:8790,http://127.0.0.1:8788,https://canopyproof.org,https://www.canopyproof.org",
  DROPIN_ALLOW_ADMIN_PROXY: process.env.DROPIN_ALLOW_ADMIN_PROXY ?? "false",
  DROPIN_CANONICAL_HOST: process.env.DROPIN_CANONICAL_HOST ?? "canopyproof.org",
  DROPIN_CANOPYPROOF_MODE: process.env.DROPIN_CANOPYPROOF_MODE ?? "testnet",
};

function requestBody(method: string | undefined, request: import("node:http").IncomingMessage): BodyInit | undefined {
  if (!method || method === "GET" || method === "HEAD") {
    return undefined;
  }

  return Readable.toWeb(request) as BodyInit;
}

function responseHeaders(headers: Headers): Record<string, string | string[]> {
  const output: Record<string, string | string[]> = {};
  headers.forEach((value, key) => {
    output[key] = value;
  });
  return output;
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host ?? `127.0.0.1:${port}`;
    const url = new URL(incoming.url ?? "/", `http://${host}`);
    const headers = new Headers();

    for (const [key, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) {
        headers.set(key, value.join(", "));
      } else if (value !== undefined) {
        headers.set(key, value);
      }
    }

    const request = new Request(url, {
      method: incoming.method,
      headers,
      body: requestBody(incoming.method, incoming),
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    const response = await canopyproofApiProxy.fetch(request, env);
    outgoing.writeHead(response.status, responseHeaders(response.headers));

    if (!response.body) {
      outgoing.end();
      return;
    }

    Readable.fromWeb(response.body as import("node:stream/web").ReadableStream).pipe(outgoing);
  } catch (error) {
    console.error("phase16-8-api-proxy-preview error", error);
    outgoing.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    outgoing.end(JSON.stringify({ error: "phase16_8_api_proxy_preview_failed" }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Phase 16.8 API proxy preview listening on http://127.0.0.1:${port}`);
  console.log(
    JSON.stringify(
      {
        source: "infra/cloudflare/canopyproof-api-proxy.ts",
        testHarnessOnly: true,
        productionDeployExecuted: false,
        env: {
          DROPIN_API_ORIGIN: env.DROPIN_API_ORIGIN,
          DROPIN_ALLOW_ADMIN_PROXY: env.DROPIN_ALLOW_ADMIN_PROXY,
          DROPIN_CANOPYPROOF_MODE: env.DROPIN_CANOPYPROOF_MODE,
        },
      },
      null,
      2,
    ),
  );
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});

