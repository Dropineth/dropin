import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import sharp from "sharp";
import {
  chromium,
  type Browser,
  type Page,
} from "playwright";

const root = process.cwd();
const dashboardFixture = JSON.parse(
  readFileSync(
    join(
      root,
      "tests/fixtures/canopyproof-global-impact-browser.json",
    ),
    "utf8",
  ),
) as unknown;
const rawCoordinates = ["14.7167", "-17.4677"];

type ScenarioResult = Readonly<{
  name: string;
  profile: "desktop-chromium" | "mobile-chromium";
  status: "PASS";
}>;

async function main() {
  const externalBaseUrl = process.env.CANOPYPROOF_BROWSER_BASE_URL;
  const server = externalBaseUrl ? undefined : await startWebServer();
  const baseUrl = externalBaseUrl ?? server?.baseUrl;
  assert.ok(baseUrl, "CanopyProof browser base URL is required.");
  const browser = await launchChromium();
  const results: ScenarioResult[] = [];

  try {
    results.push(await normalWebgl(browser, baseUrl));
    results.push(await noWebgl(browser, baseUrl));
    results.push(await dynamicImportFailure(browser, baseUrl));
    results.push(await coldChunkTimeout(browser, baseUrl));
    results.push(await contextLoss(browser, baseUrl));
    results.push(await reducedMotion(browser, baseUrl));
    results.push(await mobileWebgl(browser, baseUrl));
  } finally {
    await browser.close();
    await stopWebServer(server?.process);
  }

  for (const result of results) {
    console.log(
      `PASS\t${result.profile}\t${result.name}`,
    );
  }
  console.log(`PASS\twebgl-browser-scenarios\t${results.length}`);
}

async function normalWebgl(
  browser: Browser,
  baseUrl: string,
): Promise<ScenarioResult> {
  const context = await browser.newContext({
    colorScheme: "dark",
    reducedMotion: "no-preference",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  const hydrationErrors = captureHydrationErrors(page);
  const networkMaterial: string[] = [];
  page.on("request", (request) => {
    networkMaterial.push(request.url(), request.postData() ?? "");
  });
  await installTelemetryCapture(page);
  await routeDashboard(page);
  await page.goto(`${baseUrl}/dashboard/global`, {
    waitUntil: "domcontentloaded",
  });

  const boundary = page.getByTestId("global-impact-earth-boundary");
  await boundary.waitFor({ state: "visible" });
  await waitForWebglState(boundary, "WEBGL_READY");
  const earth = page.getByTestId("global-impact-earth-webgl");
  await earth.waitFor({ state: "visible" });
  assert.equal(await earth.getAttribute("data-instanced-marker-mesh-count"), "1");
  const canvas = earth.locator("canvas");
  await canvas.waitFor({ state: "visible" });
  const screenshot = await canvas.screenshot();
  const decoded = await sharp(screenshot)
    .resize({ width: 48, height: 24, fit: "fill" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colors = new Set<string>();
  for (let index = 0; index < decoded.data.length; index += decoded.info.channels) {
    colors.add(
      Array.from(
        decoded.data.subarray(index, index + decoded.info.channels),
      ).join(","),
    );
  }
  assert.ok(decoded.info.width > 0 && decoded.info.height > 0);
  assert.ok(
    colors.size > 4,
    "Rendered WebGL canvas must contain visible pixel-color variance.",
  );

  const redrawBefore = Number(
    (await earth.getAttribute("data-orbit-redraw-count")) ?? "0",
  );
  const box = await canvas.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width * 0.45, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5, {
    steps: 8,
  });
  await page.mouse.up();
  const redrawDeadline = Date.now() + 5_000;
  while (Date.now() < redrawDeadline) {
    const current = Number(
      (await earth.getAttribute("data-orbit-redraw-count")) ?? "0",
    );
    if (current > redrawBefore) break;
    await delay(50);
  }
  assert.ok(
    Number((await earth.getAttribute("data-orbit-redraw-count")) ?? "0") >
      redrawBefore,
    "OrbitControls interaction must request a redraw.",
  );

  const body = await page.locator("body").innerText();
  assert.match(body, /15° generalized/);
  assert.match(body, /-17° generalized/);
  for (const coordinate of rawCoordinates) {
    assert.doesNotMatch(body, new RegExp(escapeRegExp(coordinate)));
    assert.doesNotMatch(
      networkMaterial.join("\n"),
      new RegExp(escapeRegExp(coordinate)),
    );
  }
  assert.equal(
    await page
      .getByText("region_withheld_cohort_002", { exact: true })
      .count(),
    1,
  );
  const telemetry = await readTelemetry(page);
  assert.ok(
    telemetry.some(
      (entry) => entry.metric === "global_impact_webgl_ready_total",
    ),
  );
  assert.ok(
    telemetry.some(
      (entry) => entry.metric === "global_impact_webgl_cold_start_ms",
    ),
  );
  assert.deepEqual(hydrationErrors, []);
  await context.close();
  return {
    name: "normal WebGL, InstancedMesh, pixels, controls, and privacy",
    profile: "desktop-chromium",
    status: "PASS",
  };
}

async function noWebgl(
  browser: Browser,
  baseUrl: string,
): Promise<ScenarioResult> {
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      type: string,
      options?: unknown,
    ) {
      if (type === "webgl" || type === "webgl2") return null;
      return original.call(this, type, options as never);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  const page = await context.newPage();
  const hydrationErrors = captureHydrationErrors(page);
  await routeDashboard(page);
  await page.goto(`${baseUrl}/dashboard/global`, {
    waitUntil: "domcontentloaded",
  });
  await waitForFallback(page, "CANVAS_CONTEXT_UNAVAILABLE");
  assert.equal(await page.locator("canvas").count(), 0);
  assert.equal(
    await page.getByRole("heading", { name: "Current governed regional summaries" }).count(),
    1,
  );
  assert.deepEqual(hydrationErrors, []);
  await context.close();
  return {
    name: "no WebGL renders deterministic usable fallback",
    profile: "desktop-chromium",
    status: "PASS",
  };
}

async function dynamicImportFailure(
  browser: Browser,
  baseUrl: string,
): Promise<ScenarioResult> {
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await routeDashboard(page);
  await page.route(/canopyproof-global-impact-earth.*\.js/, (route) =>
    route.abort("failed"),
  );
  await page.goto(`${baseUrl}/dashboard/global`, {
    waitUntil: "domcontentloaded",
  });
  await waitForFallback(page, "DYNAMIC_IMPORT_FAILED");
  assert.equal(await page.locator("canvas").count(), 0);
  await context.close();
  return {
    name: "dynamic Three.js chunk failure falls back",
    profile: "desktop-chromium",
    status: "PASS",
  };
}

async function coldChunkTimeout(
  browser: Browser,
  baseUrl: string,
): Promise<ScenarioResult> {
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await routeDashboard(page);
  await page.route(/canopyproof-global-impact-earth.*\.js/, async (route) => {
    await delay(4_500);
    await route.continue();
  });
  await page.goto(`${baseUrl}/dashboard/global`, {
    waitUntil: "domcontentloaded",
  });
  await waitForFallback(page, "THREE_CHUNK_TIMEOUT");
  await delay(2_000);
  assert.equal(await page.locator("canvas").count(), 0);
  assert.equal(
    await page.getByTestId("global-impact-earth-fallback").count(),
    1,
  );
  await context.close();
  return {
    name: "cold chunk deadline falls back without a late duplicate renderer",
    profile: "desktop-chromium",
    status: "PASS",
  };
}

async function contextLoss(
  browser: Browser,
  baseUrl: string,
): Promise<ScenarioResult> {
  const context = await browser.newContext({
    reducedMotion: "no-preference",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await routeDashboard(page);
  await page.goto(`${baseUrl}/dashboard/global`, {
    waitUntil: "domcontentloaded",
  });
  const boundary = page.getByTestId("global-impact-earth-boundary");
  await waitForWebglState(boundary, "WEBGL_READY");
  await page.locator("canvas").dispatchEvent("webglcontextlost");
  await waitForFallback(page, "WEBGL_CONTEXT_LOST");
  await page
    .getByRole("button", { name: "Retry interactive view" })
    .click();
  await page.waitForFunction(() => {
    const boundary = document.querySelector(
      '[data-testid="global-impact-earth-boundary"]',
    );
    const state = boundary?.getAttribute("data-webgl-state");
    return state === "WEBGL_READY" || state === "TERMINAL_FALLBACK";
  });
  assert.ok(
    Number(await boundary.getAttribute("data-webgl-attempt")) <= 1,
    "WebGL recovery must not enter an unbounded retry loop.",
  );
  await context.close();
  return {
    name: "context loss exposes controlled bounded recovery",
    profile: "desktop-chromium",
    status: "PASS",
  };
}

async function reducedMotion(
  browser: Browser,
  baseUrl: string,
): Promise<ScenarioResult> {
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  await routeDashboard(page);
  await page.goto(`${baseUrl}/dashboard/global`, {
    waitUntil: "domcontentloaded",
  });
  await waitForFallback(page, "REDUCED_MOTION_POLICY");
  assert.equal(await page.locator("canvas").count(), 0);
  assert.match(
    await page.getByTestId("global-impact-earth-fallback").innerText(),
    /static snapshot, not a live operational claim/i,
  );
  await context.close();
  return {
    name: "reduced-motion policy remains readable and nonanimated",
    profile: "desktop-chromium",
    status: "PASS",
  };
}

async function mobileWebgl(
  browser: Browser,
  baseUrl: string,
): Promise<ScenarioResult> {
  const context = await browser.newContext({
    deviceScaleFactor: 2,
    hasTouch: true,
    isMobile: true,
    reducedMotion: "no-preference",
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  await routeDashboard(page);
  await page.goto(`${baseUrl}/dashboard/global`, {
    waitUntil: "domcontentloaded",
  });
  const boundary = page.getByTestId("global-impact-earth-boundary");
  await waitForWebglState(boundary, "WEBGL_READY");
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    true,
  );
  assert.equal(
    await page.getByLabel("Reviewed region").isVisible(),
    true,
  );
  await context.close();
  return {
    name: "mobile WebGL has no viewport overflow and keeps controls operable",
    profile: "mobile-chromium",
    status: "PASS",
  };
}

async function routeDashboard(page: Page) {
  await page.route("**/api/canopyproof/dashboard/global", (route) =>
    route.fulfill({
      body: JSON.stringify(dashboardFixture),
      contentType: "application/json",
      status: 200,
    }),
  );
}

async function waitForWebglState(
  boundary: ReturnType<Page["getByTestId"]>,
  state: string,
) {
  await boundary.waitFor({ state: "attached" });
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if ((await boundary.getAttribute("data-webgl-state")) === state) return;
    await delay(50);
  }
  throw new Error(`Timed out waiting for WebGL state ${state}.`);
}

async function waitForFallback(page: Page, failureCode: string) {
  const fallback = page.getByTestId("global-impact-earth-fallback");
  await fallback.waitFor({ state: "visible", timeout: 10_000 });
  assert.equal(
    await fallback.getAttribute("data-webgl-failure-code"),
    failureCode,
  );
}

function captureHydrationErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /hydration|did not match|server rendered/i.test(message.text())
    ) {
      errors.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    if (/hydration|did not match|server rendered/i.test(error.message)) {
      errors.push(error.message);
    }
  });
  return errors;
}

async function installTelemetryCapture(page: Page) {
  await page.addInitScript(() => {
    const telemetry: unknown[] = [];
    Object.defineProperty(window, "__CANOPYPROOF_WEBGL_TEST_TELEMETRY__", {
      configurable: false,
      value: telemetry,
      writable: false,
    });
    window.addEventListener(
      "canopyproof:global-impact-webgl",
      (event) => telemetry.push((event as CustomEvent<unknown>).detail),
    );
  });
}

async function readTelemetry(
  page: Page,
): Promise<Array<{ readonly metric?: string }>> {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __CANOPYPROOF_WEBGL_TEST_TELEMETRY__?: Array<{
            readonly metric?: string;
          }>;
        }
      ).__CANOPYPROOF_WEBGL_TEST_TELEMETRY__ ?? [],
  );
}

async function launchChromium() {
  const configured = process.env.CANOPYPROOF_CHROMIUM_EXECUTABLE;
  const macChrome =
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executablePath =
    configured ?? (existsSync(macChrome) ? macChrome : undefined);
  return chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: [
      "--enable-unsafe-swiftshader",
      "--use-angle=swiftshader",
    ],
    headless: true,
  });
}

async function startWebServer() {
  const port = await availablePort();
  const nextBin = join(root, "node_modules/next/dist/bin/next");
  const child = spawn(
    process.execPath,
    [nextBin, "start", "apps/web", "--port", String(port)],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  let output = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-20_000);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    output = `${output}${chunk.toString()}`.slice(-20_000);
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Next.js browser server exited early.\n${output}`);
    }
    try {
      const response = await fetch(`${baseUrl}/dashboard/global`);
      if (response.status < 500) return { baseUrl, process: child };
    } catch {
      // The socket is not accepting connections yet.
    }
    await delay(250);
  }
  child.kill("SIGTERM");
  throw new Error(`Timed out starting Next.js browser server.\n${output}`);
}

async function stopWebServer(child: ChildProcess | undefined) {
  if (!child || child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => child.once("exit", () => resolve())),
    delay(5_000).then(() => undefined),
  ]);
}

async function availablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const port = address.port;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  return port;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
