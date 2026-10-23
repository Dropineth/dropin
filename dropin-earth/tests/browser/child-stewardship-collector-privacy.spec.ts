/** Deliberately mounts the shared collector on the child path to test its exclusion guard.
 * This is a focused component test, not the actual Next artifact audit. */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "esbuild";
import { chromium } from "playwright";
async function main() {
  const directory = await mkdtemp(join(tmpdir(), "child-collector-privacy-"));
  const events: unknown[] = []; const external: string[] = [];
  const server = createServer(async (request, response) => {
    if (request.url === "/collector.js") { response.setHeader("content-type", "text/javascript"); response.end(await readFile(join(directory, "collector.js"))); return; }
    if (request.url === "/ux-experience/events") { const chunks = []; for await (const chunk of request) chunks.push(Buffer.from(chunk)); events.push(JSON.parse(Buffer.concat(chunks).toString())); response.end("{}"); return; }
    response.setHeader("content-type", "text/html"); response.end('<!doctype html><html><body style="min-height:3000px"><div id="root"></div><button data-ux-track="synthetic-only">Synthetic test action</button><script src="/collector.js"></script></body></html>');
  });
  let browser;
  try {
    await build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{UxInteractionCollector}from'./apps/web/src/components/ui/UxInteractionCollector';createRoot(document.getElementById('root')).render(<UxInteractionCollector/>);`, resolveDir: process.cwd(), loader: "tsx" }, outfile: join(directory, "collector.js"), bundle: true, minify: true, jsx: "automatic", platform: "browser", tsconfig: join(process.cwd(), "apps/web/tsconfig.json"), define: { "process.env": "{}", "process.env.NODE_ENV": '"production"', "process.env.NEXT_PUBLIC_DROPIN_API_URL": '""' } });
    await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve)); const address = server.address(); assert.ok(address && typeof address === "object"); const base = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true, executablePath: process.env.CANOPYPROOF_CHROMIUM_EXECUTABLE });
    for (const path of ["/stewardship", "/stewardship/nested"]) {
      const context = await browser.newContext(); await context.route("**/*", async route => { if (new URL(route.request().url()).origin !== base) { external.push(route.request().url()); await route.abort(); } else await route.continue(); });
      const page = await context.newPage(); await page.goto(base + path, { waitUntil: "networkidle" }); await page.getByRole("button").click();
      await page.evaluate(() => { window.scrollTo(0, 2500); window.dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("pagehide")); }); await page.waitForTimeout(100);
      assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []); assert.equal(events.length, 0); await context.close();
    }
    const control = await browser.newContext(); const page = await control.newPage(); await page.goto(base + "/draw", { waitUntil: "networkidle" }); await page.getByRole("button").click(); await page.waitForTimeout(100);
    assert.ok(events.length >= 2, "Positive control must create actual page/click events"); assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), ["dropin_web_ux_session"]);
    const beforeChildNavigation = events.length;
    await page.evaluate(() => { history.pushState({}, "", "/stewardship"); window.dispatchEvent(new Event("pagehide")); window.dispatchEvent(new Event("scroll")); }); await page.getByRole("button").click(); await page.waitForTimeout(100);
    assert.equal(events.length, beforeChildNavigation, "Old route handlers cannot emit after entering the child route"); assert.deepEqual(external, []);
    console.log(JSON.stringify({ result: "PASS", mountedChildCollectorCreatedPersistentIds: 0, mountedChildCollectorEvents: 0, childSubpathExcluded: true, previousRouteCleanupBlocked: true, positiveControlEvents: beforeChildNavigation, fixtureOnly: true })); await control.close();
  } finally { await browser?.close(); await new Promise<void>(resolve => server.close(() => resolve())); await rm(directory, { recursive: true, force: true }); }
}
void main().catch(error => { console.error(error); process.exitCode = 1; });
