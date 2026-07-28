#!/usr/bin/env node
/* global console, fetch, process */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export const WORKERD_ROUTE_CHECKS = Object.freeze([
  ["/", 200],
  ["/dashboard/global", 200],
  ["/explorer", 200],
  ["/governance", 200],
  ["/terra", 200],
  ["/mobile/report", 200],
  ["/partners", 200],
  ["/funding", 200],
  ["/risk", 200],
  ["/reports/esg", 200],
  ["/robots.txt", 200],
  ["/sitemap.xml", 200],
  ["/icon.jpg", 200],
  ["/apple-touch-icon.jpg", 200],
  ["/icon.svg", 404],
]);

const rawCoordinatePatterns = Object.freeze([
  /\b14\.7167\b/u,
  /\b-17\.4677\b/u,
]);

export async function validateWorkerdResponse(path, response) {
  const expected = WORKERD_ROUTE_CHECKS.find(
    ([candidate]) => candidate === path,
  )?.[1];
  if (expected === undefined) {
    throw new Error(`Unexpected workerd smoke path: ${path}`);
  }
  if (response.status !== expected) {
    throw new Error(
      `Workerd route ${path} returned ${response.status}; expected ${expected}.`,
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (path === "/icon.jpg" || path === "/apple-touch-icon.jpg") {
    if (!/^image\/jpeg(?:;|$)/iu.test(contentType)) {
      throw new Error(`${path} must return image/jpeg.`);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (
      bytes.length <= 1_024 ||
      bytes[0] !== 0xff ||
      bytes[1] !== 0xd8 ||
      bytes[2] !== 0xff
    ) {
      throw new Error(`${path} must return the production JPEG logo.`);
    }
    return Object.freeze({ path, status: response.status, contentType });
  }
  if (path === "/icon.svg") {
    return Object.freeze({ path, status: response.status, contentType });
  }

  const body = await response.text();
  if (path === "/" && !/CanopyProof/iu.test(body)) {
    throw new Error("Workerd homepage does not contain CanopyProof HTML.");
  }
  if (path === "/sitemap.xml") {
    for (const requiredPath of [
      "/",
      "/dashboard/global",
      "/explorer",
      "/governance",
      "/terra",
      "/mobile/report",
      "/partners",
      "/funding",
      "/risk",
      "/reports/esg",
    ]) {
      const expectedLocation =
        requiredPath === "/"
          ? "<loc>https://canopyproof.org/</loc>"
          : `<loc>https://canopyproof.org${requiredPath}</loc>`;
      if (!body.includes(expectedLocation)) {
        throw new Error(
          `Workerd sitemap is missing the public route ${requiredPath}.`,
        );
      }
    }
  }
  for (const pattern of rawCoordinatePatterns) {
    if (pattern.test(body)) {
      throw new Error(`Workerd route ${path} disclosed a raw coordinate.`);
    }
  }
  return Object.freeze({ path, status: response.status, contentType });
}

export async function runLocalWorkerdSmoke({
  projectRoot = process.cwd(),
  startupTimeoutMs = 120_000,
} = {}) {
  const webRoot = join(projectRoot, "apps", "web");
  for (const outputPath of [
    join(webRoot, ".open-next", "worker.js"),
    join(webRoot, ".open-next", "assets"),
  ]) {
    if (!existsSync(outputPath)) {
      throw new Error(`Missing OpenNext output: ${outputPath}`);
    }
  }

  const port = await availablePort();
  const wranglerBin = join(
    projectRoot,
    "node_modules",
    "wrangler",
    "bin",
    "wrangler.js",
  );
  const child = spawn(
    process.execPath,
    [
      wranglerBin,
      "dev",
      "--config",
      "wrangler.jsonc",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: webRoot,
      env: {
        ...process.env,
        CANOPY_PRODUCTION_UNLOCK: "false",
        DROPIN_ALLOW_ADMIN_PROXY: "false",
        DROPIN_AUTOMATIC_CANOPY_DISTRIBUTION_ENABLED: "false",
        DROPIN_MAINNET_TRANSFERS_ENABLED: "false",
        DROPIN_PHASE16_PROTOCOL_WRITES_ENABLED: "false",
        NEXT_PUBLIC_DROPIN_ENABLE_MAINNET_PAYMENTS: "false",
        NO_COLOR: "1",
        PLANETARY_LAB: "false",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  const capture = (chunk) => {
    output = `${output}${chunk.toString()}`.slice(-30_000);
  };
  child.stdout?.on("data", capture);
  child.stderr?.on("data", capture);

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await waitForWorkerd(child, baseUrl, startupTimeoutMs, () => output);
    const checks = [];
    for (const [path] of WORKERD_ROUTE_CHECKS) {
      const response = await fetch(`${baseUrl}${path}`, {
        redirect: "manual",
      });
      checks.push(await validateWorkerdResponse(path, response));
    }
    const report = Object.freeze({
      schemaVersion: 1,
      status: "PASS",
      generatedAt: new Date().toISOString(),
      routeCount: checks.length,
      failed: 0,
      checks,
      safetyBoundaries: Object.freeze({
        CANOPY_PRODUCTION_UNLOCK: false,
        DROPIN_ALLOW_ADMIN_PROXY: false,
        automaticCanopyDistribution: false,
        mainnetFunds: false,
        PLANETARY_LAB: false,
        iconSvgPresent: false,
      }),
    });
    const reportDirectory = join(projectRoot, "reports");
    mkdirSync(reportDirectory, { recursive: true });
    writeFileSync(
      join(reportDirectory, "canopyproof-workerd-smoke.json"),
      `${JSON.stringify(report, null, 2)}\n`,
      "utf8",
    );
    return report;
  } finally {
    await stopChild(child);
  }
}

async function waitForWorkerd(child, baseUrl, timeoutMs, readOutput) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `Wrangler exited before workerd became ready.\n${readOutput()}`,
      );
    }
    try {
      const response = await fetch(baseUrl);
      if (response.status < 500) {
        await response.body?.cancel();
        return;
      }
    } catch {
      // Workerd has not opened the local socket yet.
    }
    await delay(250);
  }
  throw new Error(`Timed out waiting for local workerd.\n${readOutput()}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  const exited = await Promise.race([
    new Promise((resolve) => child.once("exit", () => resolve(true))),
    delay(5_000).then(() => false),
  ]);
  if (!exited && child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    server.close();
    throw new Error("Unable to allocate a local workerd port.");
  }
  const port = address.port;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  runLocalWorkerdSmoke({ projectRoot })
    .then((report) => {
      console.log(
        `PASS\tworkerd-routes\t${report.routeCount}\tfailed=${report.failed}`,
      );
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
