/** Actual production /terra component; NASA responses/tiles are LOCAL SYNTHETIC FIXTURES. */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import sharp from "sharp";

async function main() {
const baseUrl = process.env.LIFEPP_BROWSER_BASE_URL;
assert.ok(baseUrl, "LIFEPP_BROWSER_BASE_URL must point to the built Next or workerd server");
const target = new URL(baseUrl);
assert.equal(target.protocol, "http:", "the fixture server must use local HTTP");
assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "the fixture server must be loopback");
assert.equal(target.username + target.password + target.search + target.hash, "", "unexpected fixture server URL credentials or suffix");
const baseOrigin = target.origin;
const output = process.env.LIFEPP_MAPLIBRE_OUTPUT_DIR ?? process.env.LIFEPP_BROWSER_OUTPUT_DIR ?? "docs/lifepp/release-remediation";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({
  ...(process.platform === "darwin" ? { channel: "chrome" } : {}),
  // Match the existing repository WebGL suite's reproducible software renderer.
  args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader"], headless: true,
});
const png = await sharp({ create: { width: 256, height: 256, channels: 4, background: "#334155" } }).png().toBuffer();
const results: { scenario: string; status: string; nasaTileRequestsIntercepted: number; cyanOverlayPixels: number; refreshedCyanOverlayPixels: number; animatedCyanOverlayPixels: number }[] = [];
try {
  for (const supported of [true, false]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors: string[] = [];
    const unexpectedExternal: string[] = [];
    let tiles = 0;
    let tileFailures = 0;
    let cyanOverlayPixels = 0;
    let refreshedCyanOverlayPixels = 0;
    let animatedCyanOverlayPixels = 0;
    page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
    if (!supported) {
      await page.addInitScript(() => {
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (type: string, ...args: unknown[]) {
          if (type === "webgl2") return null;
          return Reflect.apply(original, this, [type, ...args]);
        } as typeof original;
      });
    }
    await page.route("**/*", async (route) => {
      const url = new URL(route.request().url());
      if (url.hostname === "gibs.earthdata.nasa.gov") {
        tiles += 1;
        await route.fulfill({ contentType: "image/png", body: png });
        return;
      }
      if (url.origin !== baseOrigin) {
        unexpectedExternal.push(url.origin);
        await route.abort();
        return;
      }
      if (!url.pathname.includes("/canopyproof/terra/connectors/nasa-gibs")) {
        await route.continue();
        return;
      }
      let data: unknown;
      if (url.pathname.endsWith("/status")) {
        data = { enabled: true, sourceState: "ready", productCount: 1, staleProductCount: 0 };
      } else if (url.pathname.endsWith("/products")) {
        data = [{
          id: "fixture-nasa", nasaLayerId: "FIXTURE_LAYER", title: "Synthetic NASA fixture", description: "LOCAL SYNTHETIC FIXTURE; not observed imagery.",
          serviceType: "WMTS", projection: "EPSG:3857", tileMatrixSet: "GoogleMapsCompatible_Level9", formats: ["image/png"],
          temporalExtent: [], availableDates: ["2026-09-01", "2026-09-30"], defaultDate: "2026-09-30",
          sourceEndpointId: "nasa-gibs-wmts-epsg3857-best", sourceCapabilitiesHash: "fixture", freshness: "current", freshnessReason: "fixture", synchronizedAt: "2026-09-30T00:00:00Z",
        }];
      } else if (url.pathname.endsWith("/manifests")) {
        const input = route.request().postDataJSON();
        data = { productId: "fixture-nasa", nasaLayerId: "FIXTURE_LAYER", date: input.date, projection: "EPSG:3857", serviceType: "WMTS", endpointId: "nasa-gibs-wmts-epsg3857-best", templateId: "gibs-wmts-rest-v1", tileMatrixSet: "GoogleMapsCompatible_Level9", format: "image/png", signature: "FIXTURE_NOT_A_REAL_SIGNATURE" };
      } else {
        if (url.pathname.endsWith("/tile-failures")) tileFailures += 1;
        data = {};
      }
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, data }) });
    });
    await page.goto(`${baseUrl}/terra`, { waitUntil: "networkidle" });
    const firstTile = supported ? page.waitForResponse((response) => new URL(response.url()).hostname === "gibs.earthdata.nasa.gov", { timeout: 10_000 }) : undefined;
    await page.getByRole("button", { name: "Load signed comparison" }).click();
    if (supported) {
      try { await firstTile; } catch (error) {
        console.error(JSON.stringify({ errors, unexpectedExternal, tileFailures, visibleText: (await page.locator("body").innerText()).slice(-9000) }));
        throw error;
      }
      await page.locator("canvas.maplibregl-canvas").first().waitFor({ state: "visible" });
      await page.waitForFunction(() => [...document.querySelectorAll("canvas.maplibregl-canvas")].every((canvas) => (canvas as HTMLCanvasElement).width > 0));
      assert.ok(tiles > 0, "raster loading must exercise the actual MapLibre 6 map");
      assert.equal(await page.getByText("This browser cannot initialize WebGL2.", { exact: false }).count(), 0);
      const captureBoundary = async (filename: string) => {
        let count = 0;
        for (let attempt = 0; attempt < 40 && count < 20; attempt += 1) {
          const capture = await page.locator("canvas.maplibregl-canvas").first().screenshot();
          const pixels = await sharp(capture).removeAlpha().raw().toBuffer();
          count = 0;
          for (let pixel = 0; pixel < pixels.length; pixel += 3) {
            if (pixels[pixel]! < 150 && pixels[pixel + 1]! > 150 && pixels[pixel + 2]! > 150) count += 1;
          }
          await writeFile(join(output, filename), capture);
          if (count < 20) await delay(100);
        }
        assert.ok(count >= 20, `${filename}: the cyan project boundary must actually render above the synthetic raster`);
        return count;
      };
      cyanOverlayPixels = await captureBoundary("maplibre-interleaved-bounds.png");
      await page.getByLabel("After", { exact: true }).fill("2026-09-29");
      const changedTile = page.waitForResponse((response) => new URL(response.url()).hostname === "gibs.earthdata.nasa.gov" && response.url().includes("2026-09-29"));
      await page.getByRole("button", { name: "Load signed comparison" }).click();
      await changedTile;
      refreshedCyanOverlayPixels = await captureBoundary("maplibre-refreshed-bounds.png");
      // Animation changes tiles on an existing MapPane, exercising setTiles
      // instead of only the map recreation caused by a new manifest request.
      await page.getByRole("button", { name: "ANIMATION", exact: true }).click();
      await page.locator('div[role="img"][aria-label="before observation"]').waitFor();
      await page.locator('div[role="img"][aria-label="after observation"]').waitFor();
      animatedCyanOverlayPixels = await captureBoundary("maplibre-animated-bounds.png");
    } else {
      await page.getByRole("status").filter({ hasText: "This browser cannot initialize WebGL2." }).first().waitFor({ state: "visible" });
      assert.equal(await page.locator("canvas.maplibregl-canvas").count(), 0);
      assert.equal(tiles, 0, "unsupported browsers must not request tiles");
      await page.locator('section[aria-labelledby="nasa-gibs-heading"]').screenshot({ path: join(output, "maplibre-webgl2-fallback.png") });
    }
    assert.ok(await page.getByText("LOCAL SYNTHETIC FIXTURE; not observed imagery.", { exact: true }).isVisible());
    assert.ok(await page.getByText("NASA does not endorse", { exact: false }).isVisible());
    assert.deepEqual(errors, []);
    assert.deepEqual(unexpectedExternal, []);
    assert.equal(tileFailures, 0, "MapLibre must not report a raster/renderer failure");
    results.push({ scenario: supported ? "maplibre6-webgl2-raster-and-overlay" : "maplibre6-webgl2-unavailable-preserves-metadata", status: "PASS", nasaTileRequestsIntercepted: tiles, cyanOverlayPixels, refreshedCyanOverlayPixels, animatedCyanOverlayPixels });
    await page.close();
  }
} finally {
  await browser.close();
}
const receipt = {
  fixtureOnly: true, evidenceStage: process.env.CI ? "ci" : "development-preliminary",
  sourceRevisionHead: execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
  sourceDirtyScope: execFileSync("git", ["status", "--porcelain", "--", "apps", "packages", "services", "tests", "scripts", "package.json", "package-lock.json"], { encoding: "utf8" }).trim().split("\n").filter(Boolean),
  renderer: "WebGL2 via SwiftShader, matching repository browser suite", physicalGpuSupportClaimed: false,
  externalNasaNetworkUsed: false, observedAt: new Date().toISOString(), serverMode: process.env.LIFEPP_BROWSER_SERVER_MODE ?? "unspecified", results,
};
await writeFile(join(output, "maplibre-browser.json"), JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify(receipt, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
