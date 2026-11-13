/** Local synthetic browser integration using actual Hono/domain code and TestChildStore.
 * This is not native PostgreSQL, production, human accessibility or provider acceptance.
 * Use CHILD_BROWSER=chromium|firefox|webkit; no automatic browser downloads.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { gzipSync } from "node:zlib";
import { executeLearningCommand } from "../../services/api/src/domain/child-stewardship/learning.ts";
import { build } from "esbuild";
import { chromium, firefox, webkit, type Browser, type Page } from "playwright";
import { createChildStewardshipRoutes } from "../../services/api/src/routes/child-stewardship/index.ts";
import { TestChildResumeStore } from "../fixtures/child-stewardship-resume.ts";

async function main() {
  const directory = await mkdtemp(join(tmpdir(), "child-stewardship-browser-"));
  const store = new TestChildResumeStore();
  const app = createChildStewardshipRoutes({ mode: "synthetic-demo", store, resumeStore: store, now: () => new Date().toISOString() });
  const outbound: string[] = []; const observations: string[] = []; const contentRequests: string[] = []; const grantRequests: string[] = [];
  let dropNextObservationResponse = false;
  let browser: Browser | undefined; let server: ReturnType<typeof createServer> | undefined;
  try {
    await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import {StewardshipExperience} from './apps/web/src/components/child-stewardship/StewardshipExperience'; createRoot(document.getElementById('root')).render(<StewardshipExperience apiBase="" />);`, resolveDir: process.cwd(), loader: "tsx" }, outfile: join(directory, "fixture.js"), bundle: true, minify: true, jsx: "automatic", platform: "browser", tsconfig: join(process.cwd(), "apps/web/tsconfig.json"), define: { "process.env.NODE_ENV": '"production"' } });
    const javascript = gzipSync(await readFile(join(directory, "fixture.js"))); const css = gzipSync(await readFile(join(directory, "fixture.css")));
    server = createServer(async (request, response) => {
      if (request.url?.startsWith("/canopyproof/child-stewardship/v1/")) {
        const chunks: Buffer[] = []; for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const body = Buffer.concat(chunks).toString();
        if (/"(?:answer|sampleId|capturedAtClaimed)"\s*:/.test(body)) contentRequests.push(body);
        if (request.url.endsWith("/draft-authorizations")) { const grant = JSON.parse(body); assert.equal("command" in grant, false); assert.equal(/"(?:answer|sampleId|capturedAtClaimed)"\s*:/.test(body), false); grantRequests.push(body); }
        if (body.includes('"type":"submit-observation"')) observations.push(body);
        const headers = new Headers(); for (const [key, value] of Object.entries(request.headers)) if (typeof value === "string") headers.set(key, value);
        const result = await app.request(`http://localhost${request.url.slice("/canopyproof/child-stewardship/v1".length)}`, { method: request.method ?? "GET", headers, ...(body ? { body } : {}) });
        if (body.includes('"type":"submit-observation"') && dropNextObservationResponse) { dropNextObservationResponse = false; response.writeHead(503, { "content-type": "application/json" }); response.end(JSON.stringify({ error: { code: "SYNTHETIC_RESPONSE_LOST_AFTER_COMMIT" } })); return; }
        if (result.status >= 400) console.log("synthetic-api-error", request.url, result.status, await result.clone().text());
        response.writeHead(result.status, Object.fromEntries(result.headers)); response.end(Buffer.from(await result.arrayBuffer())); return;
      }
      if (request.url === "/fixture.js") { response.setHeader("content-type", "text/javascript"); response.setHeader("content-encoding", "gzip"); response.end(javascript); return; }
      if (request.url === "/fixture.css") { response.setHeader("content-type", "text/css"); response.setHeader("content-encoding", "gzip"); response.end(css); return; }
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
    const approve = async (target: Page) => {
      const beforeContent = contentRequests.length;
      await target.getByRole("button", { name: "核对这份草稿的发送内容与用途", exact: true }).click();
      await target.getByRole("heading", { name: "这次准备发送哪一份、用来做什么？", exact: true }).waitFor();
      assert.equal(await target.getByRole("button", { name: "发送这份练习草稿", exact: true }).isDisabled(), true);
      await target.getByRole("checkbox", { name: /我已经看过上面的内容/ }).check();
      await target.getByRole("button", { name: "确认这一份草稿的发送许可", exact: true }).click();
      await target.getByText(/已确认这份草稿本次可以发送/).waitFor();
      assert.equal(contentRequests.length, beforeContent, "Online verification and explicit authorization send metadata/digest only, never observation contents");
    };
    const choose = async (name: string) => { await page.getByRole("button", { name, exact: true }).click(); };
    const navigate = async (screen: string) => { const details = page.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await page.getByText("家长与老师导览 · 查看全部主题", { exact: true }).click(); await page.locator(`button[data-screen-id="${screen}"]`).click(); };
    assert.equal(await page.locator('input[type="file"],input[type="text"],textarea').count(), 0);
    await page.keyboard.press("Tab"); assert.match(await page.locator(":focus").innerText(), /跳到主要内容/);
    await page.keyboard.press("Enter");
    await choose("和大人一起开始"); await choose("选择一个练习角色"); await choose("看看有哪些选择");
    await page.getByRole("checkbox", { name: /我愿意做这次练习/ }).check();
    await page.getByRole("checkbox", { name: /如果演示服务可用/ }).check();
    await choose("确认这次选择"); await choose("看看这棵示例树"); await choose("认识 AI 学习助手");
    await choose("我觉得能"); await page.getByText(/还不能。助手只能根据/).waitFor(); await choose("不能，要看材料有没有依据");
    await choose("看看材料来源"); await choose("用这两幅图做练习"); await choose("先看安全提醒"); await choose("开始比较叶片");
    await page.getByRole("radio", { name: "我看到了绿色叶片" }).check(); await choose("先看看记录内容"); await choose("继续到保存说明"); await choose("加密保存到这个浏览器");
    await page.getByRole("heading", { name: "1 份本机草稿" }).waitFor();
    await choose("了解发送与接收"); await choose("检查演示服务是否可用"); await page.getByRole("heading", { name: "演示服务已连接" }).waitFor().catch(async error => { console.log("connection-state", await page.getByRole("status").allTextContents(), errors); throw error; });
    await approve(page); await choose("发送这份练习草稿"); await page.getByText(/演示服务已收到，接收编号/).waitFor(); assert.equal(observations.length, 1);
    await choose("再次核对这次发送"); await page.waitForTimeout(150); assert.equal(observations.length, 2); assert.equal(observations[0], observations[1]);
    assert.equal(Object.keys([...store.sessions.values()][0]!.snapshot.learning.observations).length, 1);
    await choose("了解怎样看待反馈"); await choose("查看这份记录的演示反馈"); await page.getByText(/演示服务记录了练习反馈/).waitFor();
    await choose("回顾活动说明"); await choose("查看学习小结"); await choose("看看练习记录有什么用"); await choose("我对记录有疑问"); await choose("继续这个问题练习");
    await page.getByRole("heading", { name: /演示服务接收编号/ }).waitFor();
    await navigate("S26"); await choose("申请导出演示学习记录"); await page.getByText(/演示服务已收到这次资料请求/).waitFor();
    await choose("查询资料请求状态"); await page.getByText(/暂时无法查询资料请求/).waitFor(); assert.equal(await page.getByRole("button", { name: "下载演示学习记录", exact: true }).count(), 0);
    await choose("停一停"); await page.getByText(/已确认撤回学习与发送选择/).waitFor();
    await navigate("S16"); assert.equal(await page.getByRole("button", { name: "再次核对这次发送" }).isDisabled(), true); assert.equal(observations.length, 2);
    await page.reload({ waitUntil: "networkidle" }); await navigate("S15"); await page.getByRole("heading", { name: "1 份本机草稿" }).waitFor();
    await navigate("S03"); await page.getByLabel("虚构的练习角色").selectOption("synthetic-b"); await navigate("S15"); await page.getByRole("heading", { name: "这里还没有草稿" }).waitFor();
    await navigate("S03"); await page.getByLabel("虚构的练习角色").selectOption("synthetic-a"); await navigate("S15"); await page.getByRole("heading", { name: "1 份本机草稿" }).waitFor();
    for (let index = 1; index <= 35; index++) { await navigate(`S${String(index).padStart(2, "0")}`); assert.equal(await page.locator("h1").count(), 1); assert.equal(await page.locator("h1").evaluate(element => element === document.activeElement), true); }
    await page.getByRole("combobox", { name: "语言", exact: true }).selectOption("en");
    await page.waitForURL(url => url.searchParams.get("lang") === "en");
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.equal(await page.title(), "Look, ask and learn together · CanopyProof learning demo");
    for (let index = 1; index <= 35; index++) {
      const details = page.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await page.getByText("For parents and teachers · Browse all topics", { exact: true }).click();
      await page.locator(`button[data-screen-id="S${String(index).padStart(2, "0")}"]`).click();
      assert.equal(await page.locator("[data-synthetic-only]").getAttribute("lang"), "en");
      assert.equal(await page.locator("main").evaluate(element => /[\u3400-\u9fff]/.test(element.textContent ?? "")), false, `English screen ${index} has no untranslated Chinese body text: ${await page.locator("main").innerText()}`);
    }
    await page.getByRole("combobox", { name: "Language", exact: true }).selectOption("zh-CN");
    await page.waitForURL(url => url.searchParams.get("lang") === "zh-CN");
    assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
    assert.equal(await page.title(), "一起观察，一起提问 · CanopyProof 学习演示");
    await navigate("S06"); await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await page.locator("details").evaluate(element => element.removeAttribute("open"));
    const screenshotDirectory = process.env.CHILD_SCREENSHOT_DIR;
    if (screenshotDirectory) { await mkdir(screenshotDirectory, { recursive: true }); await page.screenshot({ path: join(screenshotDirectory, `stewardship-${engine}-mobile.png`), fullPage: true }); }
    await navigate("S27"); await choose("清除当前角色的本机草稿"); await page.getByText(/草稿和加密密钥已清除/).waitFor(); await navigate("S15"); await page.getByRole("heading", { name: "这里还没有草稿" }).waitFor();
    // Storage failures must not revive an old unbound draft on reload, even when IDB still works.
    const failedStorageContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await failedStorageContext.addInitScript(() => {
      const originalGet = Storage.prototype.getItem; const originalSet = Storage.prototype.setItem;
      Storage.prototype.getItem = function (key: string) { if (key.startsWith("cp-synthetic-epoch:")) throw new Error("SYNTHETIC_STORAGE_READ_FAILURE"); return originalGet.call(this, key); };
      Storage.prototype.setItem = function (key: string, value: string) { if (key.startsWith("cp-synthetic-epoch:")) throw new Error("SYNTHETIC_STORAGE_WRITE_FAILURE"); return originalSet.call(this, key, value); };
    });
    const failedPage = await failedStorageContext.newPage(); failedPage.setDefaultTimeout(12_000);
    await failedPage.goto(base, { waitUntil: "networkidle" });
    const failedNavigate = async (screen: string) => { const details = failedPage.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await failedPage.getByText("家长与老师导览 · 查看全部主题", { exact: true }).click(); await failedPage.locator(`button[data-screen-id="${screen}"]`).click(); };
    const grant = async () => { await failedNavigate("S04"); await failedPage.getByRole("checkbox", { name: /我愿意做这次练习/ }).check(); await failedPage.getByRole("checkbox", { name: /如果演示服务可用/ }).check(); await failedPage.getByRole("button", { name: "确认这次选择", exact: true }).click(); };
    await grant(); await failedNavigate("S14"); await failedPage.getByRole("button", { name: "加密保存到这个浏览器", exact: true }).click(); await failedPage.getByRole("heading", { name: "1 份本机草稿" }).waitFor();
    await failedPage.getByRole("button", { name: "停一停", exact: true }).click(); await failedPage.reload({ waitUntil: "networkidle" });
    await grant(); await failedNavigate("S16"); await failedPage.getByRole("button", { name: "检查演示服务是否可用", exact: true }).click(); await failedPage.getByRole("heading", { name: "演示服务已连接" }).waitFor();
    const beforeFailureRetry = observations.length;
    assert.equal(await failedPage.getByRole("button", { name: "发送这份练习草稿", exact: true }).isDisabled(), true); await failedPage.getByRole("button", { name: "核对这份草稿的发送内容与用途", exact: true }).click(); await failedPage.getByText(/这份草稿来自较早打开的页面/).waitFor();
    assert.equal(observations.length, beforeFailureRetry, "Failed epoch persistence + reload + regrant sends zero old draft bytes");
    await failedStorageContext.close();
    // Retain a consumed ticket deliberately: both local durable withdrawal writes fail,
    // and the server cannot receive withdrawal while offline. It must still be unusable after reload.
    const doubleFailure = await browser.newContext({ viewport: { width: 390, height: 844 } });
    await doubleFailure.addInitScript(() => {
      const write = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key: string, value: string) { if (key.startsWith("cp-synthetic-epoch:")) throw new Error("SYNTHETIC_EPOCH_WRITE_FAILURE"); return write.call(this, key, value); };
      const remove = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function (key: IDBValidKey | IDBKeyRange) { if (this.name === "sessions") throw new Error("SYNTHETIC_TICKET_DELETE_FAILURE"); return remove.call(this, key); };
    });
    const doublePage = await doubleFailure.newPage(); doublePage.setDefaultTimeout(15_000); await doublePage.goto(base, { waitUntil: "networkidle" });
    const doubleNavigate = async (screen: string) => { const details = doublePage.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await doublePage.getByText("家长与老师导览 · 查看全部主题", { exact: true }).click(); await doublePage.locator(`button[data-screen-id="${screen}"]`).click(); };
    await doubleNavigate("S04"); await doublePage.getByRole("checkbox", { name: /我愿意做这次练习/ }).check(); await doublePage.getByRole("checkbox", { name: /如果演示服务可用/ }).check(); await doublePage.getByRole("button", { name: "确认这次选择", exact: true }).click();
    await doubleNavigate("S16"); await doublePage.getByRole("button", { name: "检查演示服务是否可用", exact: true }).click(); await doublePage.getByRole("heading", { name: "演示服务已连接", exact: true }).waitFor();
    await doubleNavigate("S14"); await doublePage.getByRole("button", { name: "加密保存到这个浏览器", exact: true }).click(); await doublePage.getByRole("heading", { name: "1 份本机草稿", exact: true }).waitFor();
    await doubleNavigate("S16"); await doublePage.getByRole("button", { name: "暂停连接，并准备下次恢复", exact: true }).click(); await doublePage.getByText(/演示连接已暂停/).waitFor();
    await doublePage.reload({ waitUntil: "networkidle" }); await doubleNavigate("S16"); await doublePage.getByRole("button", { name: "尝试恢复原来的演示连接", exact: true }).click(); await doublePage.getByText(/原来的演示连接已恢复，只能读取原有资料/).waitFor();
    const beforeDoubleFailure = observations.length;
    await doubleFailure.setOffline(true); await doublePage.getByRole("button", { name: "停一停", exact: true }).click();
    await doublePage.getByText("还没有确认，请联网后重试", { exact: true }).waitFor();
    await doubleNavigate("S16"); assert.equal(await doublePage.getByRole("button", { name: "发送这份练习草稿", exact: true }).isDisabled(), true);
    await doubleFailure.setOffline(false); await doublePage.reload({ waitUntil: "networkidle" }); await doubleNavigate("S16");
    await doublePage.getByRole("button", { name: "尝试恢复原来的演示连接", exact: true }).click(); await doublePage.getByText(/暂时无法恢复原来的演示连接/).waitFor();
    assert.equal(observations.length, beforeDoubleFailure, "Consumed retained ticket cannot revive authority after double storage failure and offline stop");
    await doubleFailure.close();
    // Stronger restart barrier: an UNUSED ticket and old draft survive every failed
    // local write while withdrawal/cancellation cannot reach the server. Recovery is read-only.
    const lostWithdrawal = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const lostPage = await lostWithdrawal.newPage(); lostPage.setDefaultTimeout(15_000); await lostPage.goto(base, { waitUntil: "networkidle" });
    const lostNavigate = async (screen: string) => { const details = lostPage.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await lostPage.getByText("家长与老师导览 · 查看全部主题", { exact: true }).click(); await lostPage.locator(`button[data-screen-id="${screen}"]`).click(); };
    await lostNavigate("S04"); await lostPage.getByRole("checkbox", { name: /我愿意做这次练习/ }).check(); await lostPage.getByRole("checkbox", { name: /如果演示服务可用/ }).check(); await lostPage.getByRole("button", { name: "确认这次选择", exact: true }).click();
    await lostNavigate("S16"); await lostPage.getByRole("button", { name: "检查演示服务是否可用", exact: true }).click(); await lostPage.getByRole("heading", { name: "演示服务已连接", exact: true }).waitFor();
    await lostNavigate("S14"); await lostPage.getByRole("button", { name: "加密保存到这个浏览器", exact: true }).click(); await lostPage.getByRole("heading", { name: "1 份本机草稿", exact: true }).waitFor();
    await lostNavigate("S16"); await approve(lostPage);
    await lostPage.getByRole("button", { name: "暂停连接，并准备下次恢复", exact: true }).click(); await lostPage.getByText(/演示连接已暂停/).waitFor();
    const failAllWrites = `for (const method of ['setItem','removeItem','clear']) Storage.prototype[method] = function(){throw new Error('SYNTHETIC_ALL_LOCAL_WRITES_FAILED')}; for (const method of ['put','add','delete','clear']) IDBObjectStore.prototype[method] = function(){throw new Error('SYNTHETIC_ALL_LOCAL_WRITES_FAILED')}; for (const method of ['update','delete']) IDBCursor.prototype[method] = function(){throw new Error('SYNTHETIC_ALL_LOCAL_WRITES_FAILED')}; IDBFactory.prototype.deleteDatabase = function(){throw new Error('SYNTHETIC_ALL_LOCAL_WRITES_FAILED')};`;
    await lostWithdrawal.addInitScript(failAllWrites); await lostPage.evaluate(failAllWrites);
    const beforeLostWithdrawal = contentRequests.length; await lostWithdrawal.setOffline(true);
    await lostPage.getByRole("button", { name: "停一停", exact: true }).click(); await lostPage.getByText("还没有确认，请联网后重试", { exact: true }).waitFor(); await lostPage.getByText("还没有确认清除，请重试并保留设备", { exact: true }).waitFor();
    await lostWithdrawal.setOffline(false); await lostPage.reload({ waitUntil: "networkidle" });
    await lostNavigate("S15"); await lostPage.getByRole("heading", { name: "1 份本机草稿", exact: true }).waitFor(); await lostNavigate("S16");
    assert.equal(await lostPage.getByRole("button", { name: "发送这份练习草稿", exact: true }).isDisabled(), true);
    await lostPage.getByRole("button", { name: "尝试恢复原来的演示连接", exact: true }).click(); await lostPage.getByText(/原来的演示连接已恢复，只能读取原有资料/).waitFor();
    assert.equal(await lostPage.getByRole("button", { name: "发送这份练习草稿", exact: true }).isDisabled(), true, "A valid unused old ticket restores no upload authority");
    await lostNavigate("S04"); await lostPage.getByRole("checkbox", { name: /我愿意做这次练习/ }).check(); await lostPage.getByRole("checkbox", { name: /如果演示服务可用/ }).check(); await lostPage.getByRole("button", { name: "确认这次选择", exact: true }).click();
    await lostNavigate("S16"); assert.equal(await lostPage.getByRole("button", { name: "发送这份练习草稿", exact: true }).isDisabled(), true, "General permissions cannot substitute for explicit current object authorization");
    assert.equal(contentRequests.length, beforeLostWithdrawal, "All local writes failed + offline withdrawal + restart + old draft/ticket still present transmits zero observation contents");
    await lostWithdrawal.close();
    const cancellation = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const cancelPage = await cancellation.newPage(); cancelPage.setDefaultTimeout(15_000); await cancelPage.goto(base, { waitUntil: "networkidle" });
    const cancelNavigate = async (screen: string) => { const details = cancelPage.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await cancelPage.getByText("家长与老师导览 · 查看全部主题", { exact: true }).click(); await cancelPage.locator(`button[data-screen-id="${screen}"]`).click(); };
    await cancelNavigate("S04"); await cancelPage.getByRole("checkbox", { name: /我愿意做这次练习/ }).check(); await cancelPage.getByRole("checkbox", { name: /如果演示服务可用/ }).check(); await cancelPage.getByRole("button", { name: "确认这次选择", exact: true }).click();
    await cancelNavigate("S16"); await cancelPage.getByRole("button", { name: "检查演示服务是否可用", exact: true }).click(); await cancelPage.getByRole("heading", { name: "演示服务已连接", exact: true }).waitFor();
    await cancelPage.getByRole("button", { name: "暂停连接，并准备下次恢复", exact: true }).click(); await cancelPage.getByText(/演示连接已暂停/).waitFor();
    await cancellation.setOffline(true); await cancelPage.getByRole("button", { name: "停一停", exact: true }).click(); await cancelPage.getByText("还没有确认，请联网后重试", { exact: true }).waitFor(); await cancelPage.getByText("已确认清除本机恢复凭据", { exact: true }).waitFor();
    await cancellation.setOffline(false); await cancelPage.getByRole("button", { name: "立即暂停学习与发送", exact: true }).click(); await cancelPage.getByText("已确认取消下次恢复", { exact: true }).waitFor(); await cancelPage.getByText("已确认清除本机恢复凭据", { exact: true }).waitFor();
    await cancellation.close();
    let networkDiagnostic: Record<string, unknown> = { status: "not-run", reason: "Chromium CDP only" };
    if (engine === "chromium") {
      const weakContext = await browser.newContext({ viewport: { width: 1280, height: 960 }, reducedMotion: "reduce" });
      await weakContext.addInitScript("globalThis.__name = value => value");
      const weakPage = await weakContext.newPage(); weakPage.setDefaultTimeout(30_000);
      const cdp = await weakContext.newCDPSession(weakPage); await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 400_000 / 8, uploadThroughput: 400_000 / 8 });
      const started = Date.now(); await weakPage.goto(base, { waitUntil: "networkidle", timeout: 60_000 }); const firstLoadMs = Date.now() - started;
      const weakNavigate = async (screen: string) => { const details = weakPage.locator("details"); if (!await details.evaluate(element => element.hasAttribute("open"))) await weakPage.getByText("家长与老师导览 · 查看全部主题", { exact: true }).click(); await weakPage.locator(`button[data-screen-id="${screen}"]`).click(); };
      await weakNavigate("S04"); await weakPage.getByRole("checkbox", { name: /我愿意做这次练习/ }).check(); await weakPage.getByRole("checkbox", { name: /如果演示服务可用/ }).check(); await weakPage.getByRole("button", { name: "确认这次选择", exact: true }).click();
      await weakNavigate("S16"); await weakPage.getByRole("button", { name: "检查演示服务是否可用", exact: true }).click(); await weakPage.getByRole("heading", { name: "演示服务已连接", exact: true }).waitFor();
      const sessionCount = store.sessions.size;
      await cdp.send("Network.emulateNetworkConditions", { offline: true, latency: 400, downloadThroughput: 50_000, uploadThroughput: 50_000 });
      await weakNavigate("S14"); const saveStarted = Date.now(); await weakPage.getByRole("button", { name: "加密保存到这个浏览器", exact: true }).click(); await weakPage.getByRole("heading", { name: "1 份本机草稿", exact: true }).waitFor(); const offlineSaveMs = Date.now() - saveStarted;
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 50_000, uploadThroughput: 50_000 });
      await weakNavigate("S16"); await weakPage.getByRole("button", { name: "暂停连接，并准备下次恢复", exact: true }).click(); await weakPage.getByText(/演示连接已暂停/).waitFor();
      await weakPage.reload({ waitUntil: "networkidle", timeout: 60_000 }); await weakNavigate("S16");
      await weakPage.getByRole("button", { name: "尝试恢复原来的演示连接", exact: true }).click(); await weakPage.getByText(/原来的演示连接已恢复，只能读取原有资料/).waitFor(); assert.equal(store.sessions.size, sessionCount, "Resume does not create a new server session");
      assert.equal(await weakPage.getByRole("button", { name: "发送这份练习草稿", exact: true }).isDisabled(), true); await approve(weakPage);
      const beforeLostResponse = observations.length; dropNextObservationResponse = true;
      await weakPage.getByRole("button", { name: "发送这份练习草稿", exact: true }).click(); await weakPage.getByText(/没有收到有效的接收确认，结果还不确定/).waitFor().catch(async error => { console.log("weak-send-status", await weakPage.getByRole("status").allTextContents()); throw error; }); assert.equal(observations.length, beforeLostResponse + 1);
      await weakNavigate("S16"); await weakPage.getByRole("button", { name: "暂停连接，并准备下次恢复", exact: true }).click(); await weakPage.getByText(/演示连接已暂停/).waitFor();
      await weakPage.reload({ waitUntil: "networkidle", timeout: 60_000 }); await weakNavigate("S16"); await weakPage.getByRole("button", { name: "尝试恢复原来的演示连接", exact: true }).click(); await weakPage.getByText(/原来的演示连接已恢复，只能读取原有资料/).waitFor();
      assert.equal(await weakPage.getByRole("button", { name: "发送这份练习草稿", exact: true }).isDisabled(), true); await approve(weakPage);
      await weakPage.getByRole("button", { name: "发送这份练习草稿", exact: true }).click(); await weakPage.getByText(/演示服务已收到，接收编号/).waitFor();
      assert.equal(observations[beforeLostResponse], observations[beforeLostResponse + 1], "Original immutable intent survives response loss and reload");
      const originalSession = [...store.sessions.values()].at(-1)!; assert.equal(Object.keys(originalSession.snapshot.learning.observations).length, 1);
      // Remote withdrawal and regrant must reject the original persisted consent epoch on resume.
      for (const command of [{ type: "set-assent", purpose: "upload", willing: false }, { type: "grant-consent", purpose: "upload", policyVersion: "child-learning-demo-v1" }, { type: "set-assent", purpose: "upload", willing: true }]) {
        const role = command.type === "grant-consent" ? "guardian" : "child";
        const next = executeLearningCommand(originalSession.snapshot.learning, { ...command, commandId: `demo-${crypto.randomUUID()}`, expectedVersion: originalSession.snapshot.learning.version, profileId: "demo-profile-a" }, { actorId: `demo-${role}`, deviceId: `demo-device-${role}`, epoch: 1 }, new Date().toISOString()); originalSession.snapshot.learning = next.state;
      }
      await weakNavigate("S16"); await weakPage.getByRole("button", { name: "暂停连接，并准备下次恢复", exact: true }).click(); await weakPage.getByText(/演示连接已暂停/).waitFor();
      await weakPage.reload({ waitUntil: "networkidle", timeout: 60_000 }); await weakNavigate("S16"); const beforeDeniedResume = observations.length;
      await weakPage.getByRole("button", { name: "尝试恢复原来的演示连接", exact: true }).click(); await weakPage.getByText(/暂时无法恢复原来的演示连接/).waitFor(); assert.equal(observations.length, beforeDeniedResume);
      await weakNavigate("S06"); await weakPage.getByRole("combobox", { name: "语言", exact: true }).selectOption("en");
      await weakPage.locator("details").evaluate(element => element.removeAttribute("open"));
      await weakPage.setViewportSize({ width: 320, height: 900 });
      const accessibility = await weakPage.evaluate(() => {
        const controls = [...document.querySelectorAll<HTMLElement>("button, select, input")].filter(element => element.getClientRects().length && !element.closest("details:not([open])"));
        const tooSmall = controls.filter(element => !element.matches("input") && (element.getBoundingClientRect().width < 43.5 || element.getBoundingClientRect().height < 43.5)).map(element => element.textContent?.trim());
        const unnamed = controls.filter(element => !element.getAttribute("aria-label") && !element.textContent?.trim() && !(element as HTMLInputElement).labels?.length).map(element => element.tagName);
        return { mainLandmarks: document.querySelectorAll("main").length, h1: document.querySelectorAll("h1").length, language: document.querySelector("[data-synthetic-only]")?.getAttribute("lang"), overflow: document.documentElement.scrollWidth > innerWidth + 1, tooSmall, unnamed };
      });
      assert.deepEqual(accessibility.tooSmall, []); assert.deepEqual(accessibility.unnamed, []); assert.equal(accessibility.overflow, false); assert.equal(accessibility.mainLandmarks, 1); assert.equal(accessibility.h1, 1); assert.equal(accessibility.language, "en");
      const contrast = await weakPage.evaluate(() => {
        const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).map(Number);
        const luminance = (color: number[]) => { const channels = color.slice(0, 3).map(value => { const channel = value / 255; return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4; }); return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!; };
        const failures: { text: string; ratio: number; minimum: number }[] = []; let checked = 0; let minimumRatio = Infinity;
        const walker = document.createTreeWalker(document.querySelector("[data-synthetic-only]")!, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          const node = walker.currentNode; const element = node.parentElement;
          if (!element || !node.textContent?.trim() || !element.getClientRects().length || element.closest("svg,option,details:not([open]),[disabled]")) continue;
          const style = getComputedStyle(element); let parent: Element | null = element; let background: number[] = [255, 255, 255];
          while (parent) { const candidate = rgb(getComputedStyle(parent).backgroundColor); if (candidate.length >= 3 && (candidate.length < 4 || candidate[3]! >= 1)) { background = candidate; break; } parent = parent.parentElement; }
          const foreground = rgb(style.color); if (foreground.length < 3) continue;
          const first = luminance(foreground); const second = luminance(background); const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
          const large = parseFloat(style.fontSize) >= 24 || parseFloat(style.fontSize) >= 18.66 && parseInt(style.fontWeight) >= 700; const minimum = large ? 3 : 4.5;
          checked++; minimumRatio = Math.min(minimumRatio, ratio); if (ratio < minimum) failures.push({ text: node.textContent.trim().slice(0, 50), ratio, minimum });
        }
        return { checked, minimumRatio, failures, scope: "rendered solid-color text on S06 only; not a full WCAG audit" };
      });
      assert.deepEqual(contrast.failures, []);
      await weakPage.keyboard.press("Tab");
      const keyboardFocus = await weakPage.locator(":focus").evaluate(element => ({ outline: getComputedStyle(element).outlineStyle, width: parseFloat(getComputedStyle(element).outlineWidth) }));
      assert.ok(keyboardFocus.outline !== "none" && keyboardFocus.width >= 2, "Keyboard focus remains visible");
      await weakPage.evaluate(() => { for (const element of document.querySelectorAll<HTMLElement>("h1,h2,h3,p,button,label,select,summary,dt,dd")) element.style.fontSize = `${parseFloat(getComputedStyle(element).fontSize) * 2}px`; });
      const textResizeOverflow = await weakPage.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      assert.equal(textResizeOverflow, false, "200% text resizing at 320px should retain reflow");
      if (screenshotDirectory) await weakPage.screenshot({ path: join(screenshotDirectory, "stewardship-english-200percent-320px.png"), fullPage: true });
      assert.ok(javascript.length + css.length < 200_000, "Standalone fixture compressed JS+CSS budget; not the complete Next deployment budget");
      networkDiagnostic = { bandwidthKbps: 400, latencyMs: 400, firstLoadMs, offlineSaveMs, originalSessionResume: "PASS", responseLossStableIntentReplay: "PASS", revokedRegrantedSessionRejected: "PASS", compressedFixtureAssetBytes: javascript.length + css.length, accessibility, contrast, keyboardFocus, textResize200Percent320px: "PASS", humanAccessibilityAcceptance: "not-run", productionNextTransferBudget: "not-measured" };
      await weakContext.close();
    }
    assert.equal(contentRequests.length, observations.length, "No draft-content bytes sent to authorization, recovery or other endpoints"); assert.ok(grantRequests.length > 0);
    assert.equal(errors.length, 0, errors.join("\n")); assert.equal(outbound.length, 0, "No third-party requests, telemetry or media");
    console.log(JSON.stringify({ engine, result: "PASS", screens: 35, locales: ["zh-CN", "en"], networkDiagnostic, actualHonoDomain: true, store: "TestChildStore only", encryptedIndexedDB: true, localStorageFailureReloadDenied: true, consumedTicketDoubleStorageFailureOfflineStopReloadDenied: true, restartReadOnlyUntilExplicitPerObjectGrant: true, allLocalWritesFailedOfflineWithdrawalRestartOldDraftStillPresentDenied: true, authorizationMetadataOnly: true, suspendedCancellationRetryAfterLocalCleanup: true, duplicateObservationPosts: 2, persistedObservations: 1, unauthorizedPostWithdrawalPosts: 0, thirdPartyRequests: outbound.length, pageErrors: errors.length, browserExecutable: executablePath ?? "playwright-installed" }));
    await context.close();
  } finally { await browser?.close(); if (server) await new Promise<void>(resolve => server!.close(() => resolve())); await rm(directory, { recursive: true, force: true }); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
