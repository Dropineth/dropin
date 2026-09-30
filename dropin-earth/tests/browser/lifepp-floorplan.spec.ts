/** Local component interaction fixture; not a building survey or navigation acceptance. */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { chromium, firefox, webkit, type Browser } from 'playwright';

async function main() {
  const directory = await mkdtemp(join(tmpdir(), 'lifepp-floorplan-ui-'));
  let browser: Browser | undefined;
  let server: ReturnType<typeof createServer> | undefined;
  const checks: string[] = [];
  const engine = process.env.LIFEPP_BROWSER_ENGINE ?? 'chromium';
  assert.ok(engine === 'chromium' || engine === 'firefox' || engine === 'webkit', 'Choose chromium, firefox or webkit');
  const viewportWidths = [375, 390, 768, 1440, 1920];
  try {
    await build({ stdin: { contents: `import React from 'react'; import { createRoot } from 'react-dom/client'; import { FourShopPlan } from './apps/web/src/components/life/FourShopPlan'; const locale=new URLSearchParams(location.search).get('locale')==='zh'?'zh':'en'; document.documentElement.lang=locale; createRoot(document.getElementById('root')).render(<FourShopPlan locale={locale}/>);`, resolveDir: process.cwd(), loader: 'tsx' }, outfile: join(directory, 'fixture.js'), bundle: true, jsx: 'automatic', platform: 'browser', tsconfig: join(process.cwd(), 'apps/web/tsconfig.json'), define: { 'process.env.NODE_ENV': '"test"' } });
    const javascript = await readFile(join(directory, 'fixture.js'));
    const css = await readFile(join(directory, 'fixture.css'));
    const images = { '/life/floorplan-1f-reference.webp': await readFile('apps/web/public/life/floorplan-1f-reference.webp'), '/life/floorplan-2f-reference.webp': await readFile('apps/web/public/life/floorplan-2f-reference.webp') };
    server = createServer((request, response) => {
      if (request.url === '/fixture.js') { response.setHeader('content-type', 'text/javascript'); response.end(javascript); return; }
      if (request.url === '/fixture.css') { response.setHeader('content-type', 'text/css'); response.end(css); return; }
      if (request.url && request.url in images) { response.setHeader('content-type', 'image/webp'); response.end(images[request.url as keyof typeof images]); return; }
      response.setHeader('content-type', 'text/html');
      response.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self'");
      response.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/fixture.css"><style>body{margin:0;background:#f7f8fc}main{max-width:1240px;margin:auto;padding:24px 20px}</style></head><body><main id="root"></main><script src="/fixture.js"></script></body></html>');
    });
    await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
    const address = server.address(); assert.ok(address && typeof address === 'object');
    const base = `http://127.0.0.1:${address.port}`;
    const installedChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    const executablePath = process.env.CANOPYPROOF_CHROMIUM_EXECUTABLE ?? (existsSync(installedChrome) ? installedChrome : undefined);
    browser = await ({ chromium, firefox, webkit }[engine]).launch({ headless: true, ...(engine === 'chromium' && executablePath ? { executablePath } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', async route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(10_000);
    const expected = [
      { unit: 'L112', area: '58.69', floor: '1f', page: 2, number: '1', x: 17, y: 63.3 },
      { unit: 'L203', area: '135.80', floor: '2f', page: 3, number: '2', x: 43, y: 58 },
      { unit: 'L202', area: '185.99', floor: '2f', page: 3, number: '3', x: 48, y: 58 },
      { unit: 'L201', area: '290.78', floor: '2f', page: 3, number: '4', x: 55, y: 63 },
    ];
    for (const locale of ['en', 'zh'] as const) {
      await page.goto(`${base}/?locale=${locale}`, { waitUntil: 'networkidle' });
      const tabs = page.getByRole('tab');
      assert.equal(await tabs.count(), 2);
      await tabs.nth(0).focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
      assert.equal(await tabs.nth(1).evaluate(element => element === document.activeElement), true);
      await page.keyboard.press('Home');
      assert.equal(await tabs.nth(0).getAttribute('aria-selected'), 'true');
      await page.keyboard.press('End');
      assert.equal(await tabs.nth(1).getAttribute('aria-selected'), 'true');
      const roomGroup = page.getByRole('group', { name: locale === 'en' ? 'Select a room to update the diagram marker' : '选择房间以同步图纸标记' });
      assert.equal(await roomGroup.getByRole('button').count(), 4);
      for (const room of expected) {
        const card = roomGroup.getByRole('button', { name: new RegExp(room.unit) });
        await card.click();
        assert.equal(await card.getAttribute('aria-pressed'), 'true');
        assert.match(await card.innerText(), new RegExp(room.area.replace('.', '\\.')));
        assert.match(await page.locator('img').getAttribute('src') ?? '', new RegExp(`floorplan-${room.floor}`));
        assert.match(await page.locator('figcaption').innerText(), new RegExp(locale === 'en' ? `p\\. ${room.page}` : `第 ${room.page} 页`));
        const marker = page.getByRole('button', { name: new RegExp(`^(Select|选择) ${room.unit},?，?`) });
        assert.equal(await marker.getAttribute('aria-pressed'), 'true');
        const anchor = await marker.evaluate(element => { const node = element.parentElement!.parentElement as HTMLElement; return { x: parseFloat(node.style.left), y: parseFloat(node.style.top) }; });
        assert.ok(Math.abs(anchor.x - room.x) < .0001 && Math.abs(anchor.y - room.y) < .0001, 'Location point matches normalized manifest position');
        assert.equal(await marker.innerText(), room.number);
      }
      await page.getByRole('button', { name: locale === 'en' ? 'Select L203, 135.80 square metres' : '选择 L203，135.80 平方米', exact: true }).click();
      assert.equal(await roomGroup.getByRole('button', { name: /L203/ }).getAttribute('aria-pressed'), 'true');
      const view = page.locator('[data-plan-viewport]');
      await page.getByRole('button', { name: locale === 'en' ? 'Focus selected' : '聚焦所选', exact: true }).click();
      assert.equal(await view.getAttribute('data-zoom'), '3');
      const beforePan = await view.getAttribute('data-pan-x');
      await page.getByRole('button', { name: locale === 'en' ? 'Look left' : '向左查看', exact: true }).click();
      assert.notEqual(await view.getAttribute('data-pan-x'), beforePan);
      const box = await view.boundingBox(); assert.ok(box);
      const dragBefore = await view.getAttribute('data-pan-y');
      await page.mouse.move(box.x + box.width * .8, box.y + box.height * .3);
      await page.mouse.down(); await page.mouse.move(box.x + box.width * .8, box.y + box.height * .5, { steps: 4 }); await page.mouse.up();
      assert.notEqual(await view.getAttribute('data-pan-y'), dragBefore, 'Pointer drag changes the visible drawing');
      await page.getByRole('button', { name: locale === 'en' ? 'Zoom in' : '放大图纸', exact: true }).click();
      assert.equal(await view.getAttribute('data-zoom'), '3.5');
      await page.getByRole('button', { name: locale === 'en' ? 'Zoom in' : '放大图纸', exact: true }).click();
      assert.equal(await view.getAttribute('data-zoom'), '4');
      assert.equal(await page.getByRole('button', { name: locale === 'en' ? 'Zoom in' : '放大图纸', exact: true }).isDisabled(), true, 'Maximum zoom stops at 400%');
      await page.getByRole('button', { name: locale === 'en' ? 'Full drawing' : '查看全图', exact: true }).click();
      assert.equal(await view.getAttribute('data-zoom'), '1');
      assert.equal(await view.getAttribute('data-pan-x'), '0.000');
      assert.equal(await page.getByRole('button', { name: locale === 'en' ? 'Zoom out' : '缩小图纸', exact: true }).isDisabled(), true, 'Full drawing cannot zoom below 100%');
      await page.locator('summary').click();
      const alternative = await page.locator('details').innerText();
      for (const room of expected) assert.ok(alternative.includes(room.unit) && alternative.includes(room.area));
      assert.ok(!alternative.includes('L113'));
      if (locale === 'en') assert.ok(!/[\u3400-\u9fff]/.test(await page.locator('body').innerText()), 'English controls and text alternative are fully English');
      checks.push(`${locale}: floor keyboard navigation; four card/marker selections; exact area, normalized point and source page; focus, pan, drag, zoom and reset; text alternative`);
      for (const width of viewportWidths) {
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${width}px page has no horizontal overflow`);
      const markers = page.locator('[data-plan-viewport] button');
      const markerBoxes = await markers.evaluateAll(elements => elements.map(element => { const box = element.getBoundingClientRect(); return { x: box.x, y: box.y, width: box.width, height: box.height }; }));
      const mobileView = await view.boundingBox(); assert.ok(mobileView);
      for (const [index, markerBox] of markerBoxes.entries()) {
        assert.ok(markerBox.width >= 43.9 && markerBox.height >= 43.9, 'Markers retain 44px targets');
        assert.ok(markerBox.x >= mobileView.x && markerBox.x + markerBox.width <= mobileView.x + mobileView.width && markerBox.y >= mobileView.y && markerBox.y + markerBox.height <= mobileView.y + mobileView.height, 'Overview markers stay within the drawing');
        for (const other of markerBoxes.slice(index + 1)) assert.ok(markerBox.x + markerBox.width <= other.x || other.x + other.width <= markerBox.x || markerBox.y + markerBox.height <= other.y || other.y + other.height <= markerBox.y, 'Mobile marker targets do not overlap');
      }
      assert.equal(await roomGroup.getByRole('button').count(), 4, 'All room cards remain available below mobile diagram');
      checks.push(`${locale}: ${width}px no overflow; visible non-overlapping 44px markers; all four cards`);
      if (process.env.LIFEPP_FLOORPLAN_SCREENSHOT_PREFIX) await page.screenshot({ path: `${process.env.LIFEPP_FLOORPLAN_SCREENSHOT_PREFIX}-${engine}-${locale}-${width}.png`, fullPage: true });
      }
      await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await context.route('**/life/floorplan-*.webp', route => route.abort());
    await page.goto(`${base}/?locale=en`, { waitUntil: 'networkidle' });
    await page.getByText('The diagram could not load. The room cards and text alternative remain available below.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Focus selected', exact: true }).isDisabled(), true);
    await page.locator('summary').click(); assert.match(await page.locator('details').innerText(), /L112.*58\.69/);
    checks.push('Image failure keeps four cards and text alternative; image controls disable');
    const report = { evidenceClass: 'LOCAL_COMPONENT_INTERACTION', status: 'PASS', engine, browserVersion: browser.version(), viewportWidths, realDeviceTest: false, surveyOrNavigationValidation: false, checks };
    if (process.env.LIFEPP_FLOORPLAN_BROWSER_REPORT) await writeFile(process.env.LIFEPP_FLOORPLAN_BROWSER_REPORT, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser?.close();
    if (server) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
    await rm(directory, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
