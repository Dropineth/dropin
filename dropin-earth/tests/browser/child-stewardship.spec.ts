/** Local synthetic browser integration using actual Hono/domain code and TestChildStore.
 * This is not native PostgreSQL, production, human accessibility or provider acceptance.
 * Use CHILD_BROWSER=chromium|firefox|webkit; no automatic browser downloads.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { build } from "esbuild";
import { chromium, firefox, webkit, type Browser } from "playwright";
import { createChildStewardshipRoutes } from "../../services/api/src/routes/child-stewardship/index.ts";
import { TestChildStore } from "../../services/api/src/domain/child-stewardship/store.ts";

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "child-stewardship-browser-"));
  const store = new TestChildStore();
  const app = createChildStewardshipRoutes({ mode: "synthetic-demo", store, now: () => new Date().toISOString() });
  const outbound: string[] = []; const observations: string[] = [];
  let browser: Browser | undefined; let server: ReturnType<typeof createServer> | undefined;
  try {
    await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {StewardshipExperience} from './apps/web/src/components/child-stewardship/StewardshipExperience'; createRoot(document.getElementById('root')).render(<StewardshipExperience apiBase="" />);`, resolveDir: process.cwd(), loader: "tsx" }, outfile: join(directory, "fixture.js"), bundle: true, jsx: "automatic", platform: "browser", tsconfig: join(process.cwd(), "apps/web/tsconfig.json"), define: { "process.env.NODE_ENV": '"test"' } });
    const javascript = await readFile(join(directory, "fixture.js")); const css = await readFile(join(directory, "fixture.css"));
    server = createServer(async (request, response) => {
      if (request.url?.startsWith("/canopyproof/child-stewardship/v1/")) {
        const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks).toString();
        if (body.includes('"type":"submit-observation"')) observations.push(body);
        const headers = new Headers(); for (const [key, value] of Object.entries(request.headers)) if (typeof value === "string") headers.set(key, value);
        const result = await app.request(`http://localhost${request.url.slice("/canopyproof/child-stewardship/v1".length)}`, { method: request.method ?? "GET", headers, ...(body ? { body } : {}) });
        if (result.status >= 400) console.log("synthetic-api-error", request.url, result.status, await result.clone().text());
        response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(Buffer.from(await result.arrayBuffer())); return;
      }
      if (request.url === "/fixture.js") { response.setHeader("content-type", "text/javascript"); response.end(javascript); return; }
      if (request.url === "/fixture.css") { response.setHeader("content-type", "text/css"); response.end(css); return; }
      response.setHeader("content-type", "text/html"); response.setHeader("content-security-policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self'");
      response.end('<!doctype html><html lang="zh-CN"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><title>Synthetic stewardship test</title></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>');
    });
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address(); assert.ok(address && typeof address === "object"); const base = `http://127.0.0.1:${address.port}`;
    const engine = process.env.CHILD_BROWSER ?? "chromium";
    const browserType = engine === "firefox" ? firefox : engine === "webkit" ? webkit : chromium;
    const executablePath = engine === "chromium" ? process.env.CANOPYPROOF_CHROMIUM_EXECUTABLE : undefined;
    browser = await browserType.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
    const context = await browser.newContext({ viewport: { width: 1280, height: 960 }, reducedMotion: "reduce" });
    await context.route("**/*", async route => { if (new URL(route.request().url()).origin !== base) { outbound.push(route.request().url()); await route.abort(); } else await route.continue(); });
    const page = await context.newPage(); page.setDefaultTimeout(12_000); const errors: string[] = []; page.on("pageerror", error => errors.push(error.message)); page.on("requestfailed", request => console.log("request-failed", request.url(), request.failure())); page.on("console", message => { if (message.type() === "error") console.log("browser-error", message.text()); });
    await page.goto(base, { waitUntil: "networkidle" });
    const choose = async (name: string) => { await page.getByRole("button", { name, exact: true }).click(); };
    const navigate = async (screen: string) => { const details = page.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await page.getByText("成人演示导览 · 全部 35 个屏幕与状态", { exact: true }).click(); await page.getByRole("button", { name: new RegExp(`^${screen} ·`) }).click(); };
    assert.equal(await page.locator('input[type="file"],input[type="text"],textarea').count(), 0);
    await page.keyboard.press("Tab"); assert.match(await page.locator(":focus").innerText(), /跳到主要内容/);
    await page.keyboard.press("Enter");
    await choose("和大人一起开始"); await choose("使用合成演示档案"); await choose("看看权限说明");
    await page.getByRole("checkbox", { name: /愿意进行这次合成学习/ }).check();
    await page.getByRole("checkbox", { name: /愿意在明确点击发送后/ }).check();
    await choose("保存我的选择"); await choose("打开树的观察页"); await choose("认识讲解员");
    await choose("能"); await page.getByText(/还不能。讲解只能依据/).waitFor(); await choose("不能，只能看已有记录");
    await choose("看材料的来源"); await choose("用这些材料做观察"); await choose("看看安全约定"); await choose("开始室内比较");
    await page.getByRole("radio", { name: "我看到了绿色的叶片" }).check(); await choose("预览我的记录"); await choose("继续保存"); await choose("加密保存到本机");
    await page.getByRole("heading", { name: "1 份本机草稿" }).waitFor();
    await choose("查看发送状态"); await choose("检查并连接合成服务"); await page.getByRole("heading", { name: "合成服务已连接" }).waitFor().catch(async error => { console.log("connection-state", await page.getByRole("status").allTextContents(), errors); throw error; });
    await choose("发送这份合成草稿"); await page.getByText(/合成服务已收到。接收编号/).waitFor(); assert.equal(observations.length, 1);
    await choose("核对同一请求回执"); await page.waitForTimeout(150); assert.equal(observations.length, 2); assert.equal(observations[0], observations[1]);
    assert.equal(Object.keys([...store.sessions.values()][0]!.snapshot.learning.observations).length, 1);
    await choose("看看审核步骤"); await choose("演示审阅角色：核对合成记录"); await page.getByText(/合成服务记录了演示审核与学习反馈/).waitFor();
    await choose("看看任务回执"); await choose("放进我的观察册"); await choose("看看学习记录的范围"); await choose("这里可能不对"); await choose("提交合成异议练习");
    await page.getByRole("heading", { name: /合成服务接收编号/ }).waitFor();
    await choose("停一停"); await page.getByText(/本机与合成服务端均已确认暂停/).waitFor();
    await navigate("S16"); assert.equal(await page.getByRole("button", { name: "核对同一请求回执" }).isDisabled(), true); assert.equal(observations.length, 2);
    await page.reload({ waitUntil: "networkidle" }); await navigate("S15"); await page.getByRole("heading", { name: "1 份本机草稿" }).waitFor();
    await navigate("S03"); await page.getByLabel("合成观察者").selectOption("synthetic-b"); await navigate("S15"); await page.getByRole("heading", { name: "还没有本机草稿" }).waitFor();
    await navigate("S03"); await page.getByLabel("合成观察者").selectOption("synthetic-a"); await navigate("S15"); await page.getByRole("heading", { name: "1 份本机草稿" }).waitFor();
    for (let index = 1; index <= 35; index++) { await navigate(`S${String(index).padStart(2, "0")}`); assert.equal(await page.locator("h1").count(), 1); assert.equal(await page.locator("h1").evaluate(element => element === document.activeElement), true); }
    await navigate("S06"); await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.locator("details").evaluate(element => element.removeAttribute("open"));
    const screenshotDirectory = process.env.CHILD_SCREENSHOT_DIR;
    if (screenshotDirectory) { await mkdir(screenshotDirectory, { recursive: true }); await page.screenshot({ path: join(screenshotDirectory, `stewardship-${engine}-mobile.png`), fullPage: true }); }
    await navigate("S27"); await choose("清除当前档案的本机草稿"); await page.getByText(/本机草稿与加密密钥已清除/).waitFor(); await navigate("S15"); await page.getByRole("heading", { name: "还没有本机草稿" }).waitFor();
    // Storage failures must not revive an old unbound draft on reload, even when IDB still works.
    const failedStorageContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await failedStorageContext.addInitScript(() => {
      const originalGet = Storage.prototype.getItem; const originalSet = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key: string) { if (key.startsWith("cp-synthetic-epoch:")) throw new Error("SYNTHETIC_STORAGE_READ_FAILURE"); return originalGet.call(this, key); };
      Storage.prototype.setItem = function (key: string, value: string) { if (key.startsWith("cp-synthetic-epoch:")) throw new Error("SYNTHETIC_STORAGE_WRITE_FAILURE"); return originalSet.call(this, key, value); };
    });
    const failedPage = await failedStorageContext.newPage(); failedPage.setDefaultTimeout(12_000);
    await failedPage.goto(base, { waitUntil: "networkidle" });
    const failedNavigate = async (screen: string) => { const details = failedPage.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await failedPage.getByText("成人演示导览 · 全部 35 个屏幕与状态", { exact: true }).click(); await failedPage.getByRole("button", { name: new RegExp(`^${screen} ·`) }).click(); };
    const grant = async () => { await failedNavigate("S04"); await failedPage.getByRole("checkbox", { name: /愿意进行这次合成学习/ }).check(); await failedPage.getByRole("checkbox", { name: /愿意在明确点击发送后/ }).check(); await failedPage.getByRole("button", { name: "保存我的选择", exact: true }).click(); };
    await grant(); await failedNavigate("S14"); await failedPage.getByRole("button", { name: "加密保存到本机", exact: true }).click(); await failedPage.getByRole("heading", { name: "1 份本机草稿" }).waitFor();
    await failedPage.getByRole("button", { name: "停一停", exact: true }).click(); await failedPage.reload({ waitUntil: "networkidle" });
    await grant(); await failedNavigate("S16"); await failedPage.getByRole("button", { name: "检查并连接合成服务", exact: true }).click(); await failedPage.getByRole("heading", { name: "合成服务已连接" }).waitFor();
    const beforeFailureRetry = observations.length;
    await failedPage.getByRole("button", { name: "发送这份合成草稿", exact: true }).click(); await failedPage.getByText(/这份未绑定草稿来自较早的页面会话/).waitFor();
    assert.equal(observations.length, beforeFailureRetry, "Failed epoch persistence + reload + regrant sends zero old draft bytes");
    await failedStorageContext.close();
    assert.equal(errors.length, 0, errors.join("\n")); assert.equal(outbound.length, 0, "No third-party requests, telemetry or media");
    console.log(JSON.stringify({ engine, result: "PASS", screens: 35, actualHonoDomain: true, store: "TestChildStore only", encryptedIndexedDB: true, localStorageFailureReloadDenied: true, duplicateObservationPosts: 2, persistedObservations: 1, unauthorizedPostWithdrawalPosts: 0, thirdPartyRequests: outbound.length, pageErrors: errors.length, browserExecutable: executablePath ?? "playwright-installed" }));
    await context.close();
  } finally { await browser?.close(); if (server) await new Promise<void>(resolve => server!.close(() => resolve())); await rm(directory, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
