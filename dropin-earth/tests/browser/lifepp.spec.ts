import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { chromium, type Browser, type Page } from "playwright";

// Run against a built Next or local workerd server. Never starts a deploy or API.
const base = new URL(process.env.LIFEPP_BROWSER_BASE_URL ?? "http://127.0.0.1:3101");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(base.hostname), "Browser suite is loopback-only.");
const output = process.env.LIFEPP_BROWSER_OUTPUT_DIR
  ? resolve(process.env.LIFEPP_BROWSER_OUTPUT_DIR)
  : join(process.cwd(), "docs/lifepp/evidence", process.env.LIFEPP_BROWSER_SERVER_MODE === "workerd" ? "workerd" : "next");
const manifest = JSON.parse(readFileSync(join(process.cwd(), "apps/web/src/data/life/site-manifest.json"), "utf8")) as { newRoutes: string[] };
const paths = manifest.newRoutes.flatMap((path) => [path, `/en${path}`]);
const profiles = [
  { name: "desktop", width: 1440, height: 1000 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 375, height: 812 },
] as const;
const screenshotRoutes = new Set(["/", "/life", "/life/spaces", "/life/spaces/31", "/life/center", "/life/partners", "/en/life"]);
const results: { name: string; status: "PASS" | "FAIL"; details?: unknown; error?: string }[] = [];
const measurements: unknown[] = [];
const screenshots: string[] = [];
let browser: Browser;

async function check(name: string, task: () => Promise<unknown>) {
  try { const details = await task(); results.push({ name, status: "PASS", details }); }
  catch (error) { results.push({ name, status: "FAIL", error: error instanceof Error ? error.message : String(error) }); }
}

async function setupMetrics(page: Page) {
  await page.addInitScript(() => {
    const metrics = { lcpMs: null as number | null, cls: 0, maxObservedInteractionDurationMs: null as number | null };
    Object.assign(window, { __LIFEPP_LAB_METRICS__: metrics });
    try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) metrics.lcpMs = entry.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); } catch { /* unsupported browser metric stays null */ }
    try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) { const shift = entry as PerformanceEntry & { hadRecentInput: boolean; value: number }; if (!shift.hadRecentInput) metrics.cls += shift.value; } }).observe({ type: "layout-shift", buffered: true }); } catch { /* unsupported browser metric stays null */ }
    try { new PerformanceObserver((list) => { for (const entry of list.getEntries()) { const event = entry as PerformanceEntry & { interactionId?: number }; if (event.interactionId) metrics.maxObservedInteractionDurationMs = Math.max(metrics.maxObservedInteractionDurationMs ?? 0, event.duration); } }).observe({ type: "event", buffered: true, durationThreshold: 16 } as PerformanceObserverInit); } catch { /* no field INP claim */ }
  });
}

async function informationalContrast(page: Page) {
  return page.evaluate(String.raw`(() => {
    const selected = '[class*="caption"], [class*="footerBottom"], [class*="sceneDescription"], [class*="mobileNav"] a, [class*="heroNote"], [class*="areaPanel"] small, [class*="placeholderLabel"], [class*="ctaBand"] p';
    const rgb = (value) => { const parts = value.match(/[\d.]+/g)?.map(Number); return parts && parts.length >= 3 ? parts : null; };
    const luminance = (values) => values.slice(0, 3).map((part) => { const v = part / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((sum, value, index) => sum + value * ([0.2126, 0.7152, 0.0722][index] ?? 0), 0);
    return Array.from(document.querySelectorAll(selected)).filter((element) => element.getBoundingClientRect().width > 0).flatMap((element) => {
      const foreground = rgb(getComputedStyle(element).color);
      let ancestor = element;
      let background = null;
      while (ancestor) { const candidate = rgb(getComputedStyle(ancestor).backgroundColor); if (candidate && (candidate[3] ?? 1) === 1) { background = candidate; break; } ancestor = ancestor.parentElement; }
      if (!foreground || !background || (foreground[3] ?? 1) !== 1) return [];
      const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
      return [{ text: element.innerText.slice(0, 80), foreground, background, ratio: Number((((values[1] ?? 0) + 0.05) / ((values[0] ?? 0) + 0.05)).toFixed(3)) }];
    });
  })()` ) as Promise<{ text: string; foreground: number[]; background: number[]; ratio: number }[]>;
}

async function routeMatrix(profile: typeof profiles[number]) {
  const context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, reducedMotion: "reduce" });
  // Tests neither submit leads nor follow third-party scene URLs. Block unexpected external requests and record them.
  const external: string[] = [];
  const mutations: string[] = [];
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method())) mutations.push(`${request.method()} ${request.url()}`);
    if (new URL(request.url()).origin !== base.origin) { external.push(request.url()); await route.abort(); }
    else await route.continue();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  await setupMetrics(page);
  try {
    for (const path of paths) {
      await check(`${profile.name} ${path}`, async () => {
        const externalStart = external.length;
        const errors: string[] = [];
        const onError = (error: Error) => errors.push(error.message);
        const onConsole = (message: { type(): string; text(): string }) => { if (message.type() === "error" && /Content Security Policy|Refused to execute|hydration|Hydration/.test(message.text())) errors.push(message.text()); };
        page.on("pageerror", onError); page.on("console", onConsole);
        try {
          const response = await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
          assert.equal(response?.status(), 200, `${path} status`);
          const raw = await response!.text();
          const locale = path.startsWith("/en/") ? "en" : "zh-CN";
          assert.match(raw, new RegExp(`<html[^>]*lang=["']${locale}["']`), `${path} server-rendered document language`);
          assert.equal(await page.locator("html").getAttribute("lang"), locale);
          assert.equal(await page.locator("h1").count(), 1, "Exactly one page heading");
          assert.equal(await page.locator('meta[name="twitter:title"]').getAttribute("content"), await page.locator('meta[property="og:title"]').getAttribute("content"), "Localized social titles agree");
          assert.equal(await page.locator('meta[name="twitter:description"]').getAttribute("content"), await page.locator('meta[name="description"]').getAttribute("content"), "Localized social descriptions agree");
          assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), `https://canopyproof.org${path}`);
          const unlocalized = path.startsWith("/en/") ? path.slice(3) : path;
          for (const [lang, href] of [["zh-CN", unlocalized], ["en", `/en${unlocalized}`], ["x-default", unlocalized]]) {
            assert.equal(await page.locator(`link[rel="alternate"][hreflang="${lang}"]`).getAttribute("href"), `https://canopyproof.org${href}`);
          }
          assert.match(await page.locator('meta[name="robots"]').getAttribute("content") ?? "", /noindex/, "Loopback preview is not indexable");
          assert.match(response!.headers()["x-robots-tag"] ?? "", /noindex/, "Preview response header");
          assert.equal(await page.locator("iframe").count(), 0, "No enabled third-party scene iframe");
          const overflow = await page.evaluate(() => ({ viewport: innerWidth, width: document.documentElement.scrollWidth }));
          assert.ok(overflow.width <= overflow.viewport + 1, `Horizontal overflow: ${JSON.stringify(overflow)}`);
          const contrast = await informationalContrast(page);
          assert.deepEqual(contrast.filter((entry) => entry.ratio < 4.5), [], "Selected informational normal text meets 4.5:1 contrast");
          assert.equal(await page.getByRole("link", { name: /生态与地球观测|Ecology.*Earth|Ecology.*observation/i }).count() > 0, true, "Return to ecology link");
          if (path.endsWith("/31") || path.endsWith("/29")) {
            const id = path.split("/").pop();
            assert.equal(await page.locator(`[data-scene-id="${id}"]`).getAttribute("data-viewer-state"), "blocked");
            const link = page.locator(`a[href="http://kjlying.com:8456/scenes/${id}"]`);
            assert.equal(await link.count(), 1);
            assert.equal(await link.getAttribute("target"), "_blank");
            assert.match(await link.getAttribute("rel") ?? "", /noopener/);
            assert.match(await link.getAttribute("rel") ?? "", /noreferrer/);
            assert.equal(await link.getAttribute("referrerpolicy"), "no-referrer");
            assert.ok((await page.locator("dd").allTextContents()).filter((value) => /待确认|To be confirmed/.test(value)).length >= 7);
          }
          if (locale === "en") assert.doesNotMatch(await page.locator("main").innerText(), /待确认|拟议方案|申请空间合作|合作询问草稿|尚未发送|导入期空间/, "English content is localized");
          if (screenshotRoutes.has(path)) {
            const name = `after-${profile.name}-${path.slice(1).replaceAll("/", "-") || "ecology"}.png`;
            await page.screenshot({ path: join(output, name), fullPage: true }); screenshots.push(name);
          }
          const metrics = await page.evaluate(() => {
            const entries = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
            return { ...((window as unknown as { __LIFEPP_LAB_METRICS__: object }).__LIFEPP_LAB_METRICS__), scripts: entries.filter((entry) => entry.initiatorType === "script").map((entry) => ({ url: entry.name, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize })), resources: entries.length };
          });
          measurements.push({ profile: profile.name, path, informationalContrast: contrast, ...metrics });
          assert.deepEqual(external.slice(externalStart), [], "Life++ must not auto-load third-party resources");
          assert.deepEqual(errors, [], "No runtime or CSP hydration errors");
          return { status: response!.status(), htmlLang: locale, overflow, externalRequests: 0 };
        } catch (error) {
          const name = `failure-${profile.name}-${path.slice(1).replaceAll("/", "-")}.png`;
          await page.screenshot({ path: join(output, name), fullPage: true }).then(() => screenshots.push(name)).catch(() => undefined);
          throw error;
        } finally { page.off("pageerror", onError); page.off("console", onConsole); }
      });
    }
    await check(`${profile.name} no form mutations`, async () => assert.deepEqual(mutations, []));
  } finally { await context.close(); }
}

async function interactions() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce", permissions: ["clipboard-read", "clipboard-write"] });
  const page = await context.newPage();
  page.setDefaultTimeout(10_000);
  const writes: string[] = [];
  page.on("request", (request) => { if (!['GET', 'HEAD'].includes(request.method())) writes.push(request.url()); });
  await context.route("**/*", async (route) => {
    const request = route.request();
    if (!['GET', 'HEAD'].includes(request.method()) || new URL(request.url()).origin !== base.origin) await route.abort();
    else await route.continue();
  });
  try {
    await check("Original ecology anchors and content", async () => {
      const response = await page.goto(base.href, { waitUntil: "networkidle" }); assert.equal(response?.status(), 200);
      for (const id of ["top", "protocol", "how-it-works", "explorer", "methodology", "telemetry", "stack", "contact"]) assert.equal(await page.locator(`#${id}`).count(), 1, `Preserved #${id}`);
      const body = await page.locator("body").innerText();
      for (const copy of [/Proof Explorer/, /TerraProof/i, /Methodology/, /Open Stack/, /sample/, /not certified carbon credits|nothing here is a certified carbon credit/]) assert.match(body, copy);
      assert.ok(await page.locator('a[href="#explorer"]').count() > 0);
      for (const profile of profiles) { await page.setViewportSize({ width: profile.width, height: profile.height }); const name = `after-${profile.name}-ecology.png`; await page.screenshot({ path: join(output, name), fullPage: true }); screenshots.push(name); }
    });
    await check("Scene 31 and 29 reachable within two homepage clicks", async () => {
      for (const id of ["31", "29"]) {
        await page.goto(base.href, { waitUntil: "networkidle" });
        await page.locator('a[href="/life"]').first().click(); await page.waitForURL("**/life");
        await page.locator(`a[href="/life/spaces/${id}"]`).first().click(); await page.waitForURL(`**/life/spaces/${id}`);
        assert.equal(await page.locator(`[data-scene-id="${id}"]`).getAttribute("data-viewer-state"), "blocked");
      }
    });
    await check("Language switch and ecology return update document language", async () => {
      await page.goto(new URL("/life/spaces/31", base).href, { waitUntil: "networkidle" });
      await page.locator('a[hreflang="en"]').click(); await page.waitForURL("**/en/life/spaces/31");
      assert.equal(await page.locator("html").getAttribute("lang"), "en");
      await page.locator('a[hreflang="zh-CN"]').click(); await page.waitForURL("**/life/spaces/31");
      assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
      await page.locator('a[href="/"]').first().click(); await page.waitForURL(base.href);
      assert.equal(await page.locator("html").getAttribute("lang"), "en");
    });
    for (const locale of ["zh", "en"]) await check(`${locale} keyboard draft and no false receipt`, async () => {
      await page.goto(new URL(locale === "en" ? "/en/life/partners" : "/life/partners", base).href, { waitUntil: "networkidle" });
      const form = page.locator("form");
      const submit = form.locator('button[type="submit"]');
      await submit.focus(); await page.keyboard.press("Enter");
      await page.waitForFunction(() => document.activeElement?.id === "inquiry-name");
      assert.equal(await page.locator("#inquiry-name").getAttribute("aria-invalid"), "true");
      await page.locator("#inquiry-name").fill("Browser test fixture");
      await page.keyboard.press("Tab"); assert.equal(await page.locator("#inquiry-organization").evaluate((element) => element === document.activeElement), true);
      await page.locator("#inquiry-organization").fill("Synthetic browser test");
      await page.locator("#inquiry-contact").fill("browser-test@example.invalid");
      await page.locator("#inquiry-message").fill("Synthetic local inquiry draft for browser verification. No request is sent.");
      await form.locator('input[type="checkbox"]').focus(); await page.keyboard.press("Space");
      await submit.focus(); await page.keyboard.press("Enter");
      await page.locator("#inquiry-draft").waitFor({ state: "visible" });
      assert.match(await form.locator('[role="status"]').innerText(), /尚未发送|not sent/i);
      assert.doesNotMatch(await form.innerText(), /已提交|已收到|successfully submitted|successfully received/i);
      assert.match(await page.locator("#inquiry-draft").inputValue(), /browser-test@example.invalid/);
      await form.getByRole("button", { name: /复制草稿|Copy draft/ }).click();
      assert.match(await form.locator('[role="status"]').innerText(), /尚未发送|not sent/i);
      assert.equal(await page.evaluate(() => localStorage.length), 0);
      assert.equal(await page.evaluate(() => sessionStorage.length), 0);
      await form.getByRole("button", { name: /清除本页信息|Clear this page/ }).click();
      assert.equal(await page.locator("#inquiry-draft").count(), 0);
      assert.equal(await page.locator("#inquiry-name").inputValue(), "");
      assert.deepEqual(writes, [], "Draft and copy must not send HTTP writes");
    });
    await check("Unknown scene and page routes are 404", async () => {
      for (const path of ["/life/spaces/unknown", "/life/spaces/30", "/en/life/spaces/unknown", "/life/unknown", "/en/life/unknown"]) {
        const response = await page.goto(new URL(path, base).href, { waitUntil: "domcontentloaded" });
        assert.equal(response?.status(), 404, path);
      }
    });
    await check("Preview robots disallow and sitemap does not advertise pages", async () => {
      const robots = await page.request.get(new URL("/robots.txt", base).href); assert.equal(robots.status(), 200); assert.match(await robots.text(), /Disallow:\s*\//);
      const sitemap = await page.request.get(new URL("/sitemap.xml", base).href); assert.equal(sitemap.status(), 200); assert.doesNotMatch(await sitemap.text(), /<loc>/);
    });
  } finally { await context.close(); }
}

async function main() {
  mkdirSync(output, { recursive: true });
  const chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  browser = await chromium.launch({ ...(existsSync(chrome) ? { executablePath: chrome } : {}), headless: true });
  const browserVersion = browser.version();
  try { for (const profile of profiles) await routeMatrix(profile); await interactions(); }
  finally { await browser.close(); }
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), status: results.some((item) => item.status === "FAIL") ? "FAIL" : "PASS", baseUrl: base.href, runtime: { node: process.version, platform: process.platform, arch: process.arch, browser: browserVersion, serverMode: process.env.LIFEPP_BROWSER_SERVER_MODE ?? "unspecified" }, candidateSha: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(), workingTreeUnderTest: true, results, screenshots, measurements, limitations: ["Lab observations from one local Chromium browser; not Lighthouse or field performance.", "maxObservedInteractionDurationMs is not field INP. INP was not measured; real traffic measurement remains open.", "CLS records accumulated observed layout shifts during this bounded page load, not a full-session field percentile.", "All real third-party scene embeds remain disabled. This browser suite does not validate scene assets, navigation, rights or provider readiness."] };
  writeFileSync(join(output, "browser-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, passed: results.filter((item) => item.status === "PASS").length, failed: results.filter((item) => item.status === "FAIL"), screenshots: screenshots.length }, null, 2));
  if (report.status !== "PASS") process.exitCode = 1;
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
