/**
 * FIXTURE ONLY: browser lifecycle tests for a proposed adapter.
 * A temporary test bundle supplies mock permissions and HTTPS origin; production code,
 * registry and CSP stay disabled. All example.test traffic is fulfilled in Playwright.
 * GPU capability is mocked, so this is not WebGL rendering or real source acceptance.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { build } from "esbuild";
import { chromium, type Browser } from "playwright";

async function main() {
const root = process.cwd();
const fixtureDir = await mkdtemp(join(tmpdir(), "lifepp-viewer-fixture-"));
const mockOrigin = "https://scene-adapter.example.test";
const mockUrl = `${mockOrigin}/scenes/31`;
const approval = {
  sceneId: "31", sourceUrl: "http://kjlying.com:8456/scenes/31", embedUrl: mockUrl,
  displayAndEmbedPermission: "FIXTURE_PERMISSION", httpsAndSubresourcesReview: "FIXTURE_HTTPS",
  redirectReview: "FIXTURE_REDIRECT", sourceFramePolicyReview: "FIXTURE_SOURCE_POLICY",
  siteFrameSrcReview: "FIXTURE_SITE_CSP", browserAcceptanceReview: "FIXTURE_BROWSER",
  handshakeProtocol: "lifepp-scene-v1",
};
let browser: Browser | undefined;
let server: ReturnType<typeof createServer> | undefined;
const results: { name: string; status: "passed" }[] = [];

try {
  await build({
    stdin: {
      contents: `import React from 'react'; import { createRoot } from 'react-dom/client';
        import { SceneViewer } from './apps/web/src/components/life/SceneViewer';
        import { getScene } from './apps/web/src/data/life/scenes';
        const scene = {...getScene('31'), embedUrl: ${JSON.stringify(mockUrl)}, embedStatus: 'approved', rightsStatus: 'display_embed_confirmed', transportStatus: 'https_embed_verified'};
        const root = createRoot(document.getElementById('root'));
        root.render(<SceneViewer scene={scene} locale="en" />);
        window.fixtureUnmount = () => root.unmount();`,
      resolveDir: root, loader: "tsx", sourcefile: "fixture-entry.tsx",
    },
    outfile: join(fixtureDir, "viewer.js"), bundle: true, jsx: "automatic", platform: "browser",
    define: { "process.env.NODE_ENV": JSON.stringify("test") },
    plugins: [{
      name: "fixture-only-approval",
      setup(build) {
        build.onLoad({ filter: /\/data\/life\/scenes\.ts$/ }, async ({ path }) => {
          const source = await readFile(path, "utf8");
          const marker = "export const APPROVED_SCENE_EMBEDS: readonly EmbedApproval[] = Object.freeze([]);";
          assert.equal(source.includes(marker), true, "Fixture injection must match only the explicit production-empty allowlist");
          return { contents: source.replace(marker, `export const APPROVED_SCENE_EMBEDS: readonly EmbedApproval[] = Object.freeze([${JSON.stringify(approval)}]);`), loader: "ts", resolveDir: resolve(root, "apps/web/src/data/life") };
        });
      },
    }],
  });
  const files = { "/viewer.js": await readFile(join(fixtureDir, "viewer.js")), "/viewer.css": await readFile(join(fixtureDir, "viewer.css")) };
  server = createServer((request, response) => {
    if (request.url === "/viewer.js" || request.url === "/viewer.css") {
      response.setHeader("content-type", request.url.endsWith(".js") ? "text/javascript" : "text/css");
      response.end(files[request.url]);
      return;
    }
    response.setHeader("content-type", "text/html");
    // Explicit fixture origin only; this is not the deployed site's frame-src policy.
    response.setHeader("content-security-policy", `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; frame-src ${mockOrigin}`);
    response.end('<!doctype html><html lang="en"><head><link rel="stylesheet" href="/viewer.css"></head><body><div id="root"></div><script src="/viewer.js"></script></body></html>');
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const installedChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executablePath = process.env.CANOPYPROOF_CHROMIUM_EXECUTABLE ?? (existsSync(installedChrome) ? installedChrome : undefined);
  browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let adapterMode: "ready" | "silent" = "ready";
  let adapterRequests = 0;
  const blockedRequests: string[] = [];
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (url === mockUrl) {
      adapterRequests += 1;
      await route.fulfill({ contentType: "text/html", body: `<!doctype html><html><body>FIXTURE ONLY<script>
        window.addEventListener('message', event => {
          if (event.source !== parent || event.data?.type !== 'lifepp:request-ready') return;
          window.fixtureRequest = event.data;
          ${adapterMode === "ready" ? "parent.postMessage({type:'lifepp:scene-ready',protocol:1,sceneId:event.data.sceneId,sessionId:event.data.sessionId},event.origin);" : ""}
        });</script></body></html>` });
    } else if (url.startsWith(`${baseUrl}/`)) await route.continue();
    else { blockedRequests.push(url); await route.abort(); }
  });
  await context.addInitScript(`(() => {
    window.fixtureNoWebGL = false;
    window.fixtureMessageListeners = new Set();
    const add = window.addEventListener.bind(window);
    const remove = window.removeEventListener.bind(window);
    window.addEventListener = (type, listener, options) => {
      if (type === 'message') window.fixtureMessageListeners.add(listener);
      add(type, listener, options);
    };
    window.removeEventListener = (type, listener, options) => {
      if (type === 'message') window.fixtureMessageListeners.delete(listener);
      remove(type, listener, options);
    };
    // Capability branch only: no real GPU rendering is claimed.
    HTMLCanvasElement.prototype.getContext = () => window.fixtureNoWebGL ? null : { getExtension: () => ({ loseContext() {} }) };
  })();`);
  const page = await context.newPage();
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") browserErrors.push(message.text()); });
  const state = () => page.locator("[data-viewer-state]").getAttribute("data-viewer-state");
  const expectState = async (value: string) => {
    try { await page.locator(`[data-viewer-state="${value}"]`).waitFor({ timeout: 15000 }); }
    catch (error) { console.error(JSON.stringify({ expected: value, actual: await state(), browserErrors, frames: page.frames().map(frame => frame.url()), adapterRequests })); throw error; }
    assert.equal(await state(), value);
  };
  const listeners = () => page.evaluate(() => (window as unknown as { fixtureMessageListeners: Set<unknown> }).fixtureMessageListeners.size);
  const reset = async () => { await page.goto(baseUrl); await expectState("idle"); };
  const load = async () => { await page.getByRole("checkbox").check(); await page.getByRole("button", { name: "Load scene on demand", exact: true }).click(); };
  const pass = (name: string) => results.push({ name, status: "passed" });

  await reset();
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(await page.getByRole("button", { name: "Load scene on demand", exact: true }).isDisabled(), true);
  assert.equal(adapterRequests, 0);
  pass("No iframe or third-party request before consent and load");

  await load(); await expectState("ready");
  assert.equal(await page.locator("iframe").count(), 1);
  assert.equal(adapterRequests, 1);
  assert.equal(await listeners(), 0, "Ready handshake releases listener and timer");
  await page.getByRole("button", { name: "Full screen", exact: true }).click();
  await page.waitForFunction(() => document.fullscreenElement !== null);
  assert.equal(await page.evaluate(() => document.fullscreenElement !== null), true);
  await page.getByRole("button", { name: "Exit full screen", exact: true }).click();
  await page.waitForFunction(() => document.fullscreenElement === null);
  assert.equal(await page.evaluate(() => document.fullscreenElement), null);
  await page.getByRole("button", { name: "Exit and destroy viewer", exact: true }).click();
  await expectState("destroyed");
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(await listeners(), 0);
  pass("Mock handshake, full screen, explicit full-screen exit and destroy");

  adapterMode = "silent";
  await reset(); await page.clock.install(); await load(); await expectState("loading");
  const remote = async () => {
    const element = await page.locator("iframe").elementHandle();
    assert.ok(element, "The loading viewer must attach an iframe");
    const frame = await element.contentFrame();
    await element.dispose();
    assert.ok(frame, "The attached iframe must have a browsing context");
    // contentWindow exists for about:blank before the adapter navigation commits.
    await frame.waitForURL(mockUrl, { waitUntil: "load" });
    return frame;
  };
  // Ensure iframe onLoad and its handshake request actually completed before testing the timeout.
  const silentFrame = await remote();
  await silentFrame.waitForFunction(() => Boolean((window as unknown as { fixtureRequest?: unknown }).fixtureRequest));
  assert.equal(await state(), "loading", "Document onLoad cannot establish readiness");
  await silentFrame.evaluate(() => parent.postMessage({ type: "lifepp:scene-ready", protocol: 1, sceneId: "31", sessionId: "incorrect-session" }, "*"));
  assert.equal(await state(), "loading");
  await page.clock.fastForward(12100); await expectState("timeout");
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(await listeners(), 0);
  pass("Document load and malformed handshake cannot establish ready; timeout tears down the frame");
  adapterMode = "ready";
  await page.getByRole("button", { name: "Retry loading", exact: true }).click(); await expectState("ready");
  pass("Retry starts a fresh mock session after timeout");

  await (await remote()).evaluate(() => window.location.reload());
  await expectState("error");
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(await listeners(), 0);
  pass("Unexpected adapter navigation after readiness enters error and tears down the frame");

  await page.setViewportSize({ width: 375, height: 812 });
  await reset(); const beforeMobile = adapterRequests; await load(); await expectState("mobile");
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(adapterRequests, beforeMobile);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  pass("375px mobile fallback makes no adapter request and does not overflow");

  await page.setViewportSize({ width: 1280, height: 900 });
  await reset();
  await page.evaluate(() => { (window as unknown as { fixtureNoWebGL: boolean }).fixtureNoWebGL = true; });
  const beforeUnsupported = adapterRequests; await load(); await expectState("unsupported");
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(adapterRequests, beforeUnsupported);
  pass("Unavailable WebGL capability blocks loading");

  adapterMode = "silent";
  await reset(); await load(); await expectState("loading");
  assert.equal(await listeners(), 1);
  await page.evaluate(() => (window as unknown as { fixtureUnmount: () => void }).fixtureUnmount());
  assert.equal(await page.locator("iframe").count(), 0);
  assert.equal(await listeners(), 0);
  await page.clock.fastForward(12100);
  pass("Component unmount during load removes iframe, readiness listener and timeout");

  assert.deepEqual(blockedRequests, [], "No unapproved request should even be attempted");
  await context.close();
  process.stdout.write(`${JSON.stringify({ fixture_only: true, actual_source_embedded: false, gpu_rendering_tested: false, engine: "Chromium", executable: executablePath ?? "playwright-bundled", browserVersion: browser.version(), passed: results.length, adapterRequests, unexpectedRequests: blockedRequests, results }, null, 2)}\n`);
} finally {
  await browser?.close();
  if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
  await rm(fixtureDir, { recursive: true, force: true });
}

}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
