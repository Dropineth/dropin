/** Actual built Next/OpenNext browser privacy probe. Never a standalone React fixture. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

async function main() {
const base = process.env.CHILD_NEXT_BASE_URL;
if (!base || !["127.0.0.1", "localhost", "[::1]"].includes(new URL(base).hostname)) throw new Error("An explicit localhost artifact URL is required; this probe never targets production");
const artifactState = process.env.CHILD_NEXT_ARTIFACT_STATE ?? "existing-mixed-source-diagnostic";
const requireGuard = process.env.CHILD_NEXT_PRIVACY_REQUIRE_GUARD === "1";
const browser = await chromium.launch({ headless: true, executablePath: process.env.CANOPYPROOF_CHROMIUM_EXECUTABLE });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const outbound: string[] = []; const posts: string[] = []; const pageErrors: string[] = [];
  await context.route("**/*", async route => { const url = new URL(route.request().url()); if (url.origin !== new URL(base).origin) { outbound.push(url.origin + url.pathname); await route.abort(); } else await route.continue(); });
  const page = await context.newPage(); page.setDefaultTimeout(15_000);
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("request", request => { if (request.method() !== "GET" && request.method() !== "HEAD") posts.push(new URL(request.url()).pathname); });
  const response = await page.goto(`${base}/stewardship`, { waitUntil: "networkidle" }); assert.equal(response?.status(), 200);
  const responseHeaders = response!.headers(); const csp = responseHeaders["content-security-policy"] ?? "";
  assert.equal(await page.locator("[data-synthetic-only]").count(), 1);
  assert.equal(await page.locator('input[type="file"],input[type="text"],textarea').count(), 0);
  const scripts = await page.locator("script[src]").evaluateAll(elements => elements.map(element => (element as HTMLScriptElement).src));
  assert.ok(scripts.every(url => new URL(url).origin === new URL(base).origin));
  const navigate = async (screen: string) => { const details = page.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await page.getByText("家长与老师导览 · 查看全部主题", { exact: true }).click(); await page.locator(`button[data-screen-id="${screen}"]`).click(); };
  await navigate("S04"); await page.getByRole("checkbox", { name: /我愿意做这次练习/ }).check(); await page.getByRole("checkbox", { name: /如果演示服务可用/ }).check(); await page.getByRole("button", { name: "确认这次选择", exact: true }).click();
  await navigate("S14"); await page.getByRole("button", { name: "加密保存到这个浏览器", exact: true }).click(); await page.getByRole("heading", { name: "1 份本机草稿", exact: true }).waitFor();
  await navigate("S16"); assert.equal(await page.getByRole("button", { name: "发送这份练习草稿", exact: true }).isDisabled(), true);
  await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); window.dispatchEvent(new Event("scroll")); window.dispatchEvent(new Event("pagehide")); });
  await page.waitForTimeout(100);
  const storage = await page.evaluate(async () => ({ localStorageKeys: Object.keys(localStorage), sessionStorageKeys: Object.keys(sessionStorage), databases: (await indexedDB.databases()).map(database => database.name), resources: performance.getEntriesByType("resource").map(entry => ({ name: new URL(entry.name).pathname, encodedBodySize: (entry as PerformanceResourceTiming).encodedBodySize })) }));
  const cookies = await context.cookies();
  assert.deepEqual(outbound, []); assert.deepEqual(posts, []); assert.deepEqual(pageErrors, []); assert.deepEqual(cookies, []);
  assert.ok(storage.localStorageKeys.every(key => key.startsWith("cp-synthetic-epoch:"))); assert.deepEqual(storage.sessionStorageKeys, []);
  assert.ok(storage.databases.every(name => name === "canopyproof-child-synthetic-v1"));
  const guards = { noReferrer: responseHeaders["referrer-policy"] === "no-referrer", noStore: /no-store/.test(responseHeaders["cache-control"] ?? ""), noBroadHttpsConnect: !/connect-src[^;]*\shttps:(?:\s|;|$)/.test(csp), noBroadHttpsImages: !/img-src[^;]*\shttps:(?:\s|;|$)/.test(csp), noWorkers: /worker-src 'none'/.test(csp), noForms: /form-action 'none'/.test(csp) };
  if (requireGuard) assert.ok(Object.values(guards).every(Boolean), JSON.stringify(guards));
  const workerHash = createHash("sha256").update(await readFile("apps/web/.open-next/worker.js")).digest("hex");
  const result = { artifactState, artifactEntrypointSha256: workerHash, guardRequired: requireGuard, result: requireGuard ? "PASS" : "DIAGNOSTIC_ONLY", actualNextArtifact: true, route: "/stewardship", navigationScope: "fresh document navigation; existing document CSP is not replaced by client-side RSC navigation", thirdPartyRequests: outbound, unexpectedPosts: posts, cookies: cookies.length, pageErrors, guards, scripts, storage, encodedResourceBytes: storage.resources.reduce((sum, entry) => sum + entry.encodedBodySize, 0), notes: "Closed synthetic choices and encrypted local save only. No backend calls, real identities or external requests. Platform-side logging/injection settings require separate deployment inspection. Entrypoint hash alone is not a sealed artifact digest." };
  if (process.env.CHILD_NEXT_PRIVACY_OUTPUT) await writeFile(process.env.CHILD_NEXT_PRIVACY_OUTPUT, JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result)); await context.close();
} finally { await browser.close(); }

}
void main().catch(error => { console.error(error); process.exitCode = 1; });
