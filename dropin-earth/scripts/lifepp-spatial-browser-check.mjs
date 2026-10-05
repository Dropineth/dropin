/* global document, HTMLCanvasElement, localStorage, requestAnimationFrame, sessionStorage, window */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';

const rootSelector = '.ls-app[data-mode="review"]';
const rooms = ['L112', 'L203', 'L202', 'L201'];
const actions = ['ASSERT', 'REASON', 'DELEGATE', 'FULFILL', 'CHALLENGE'];

/** Observe actual context requests without simulating a WebGL failure. */
export async function prepareSpatialChecks(page) {
  await page.addInitScript(() => {
    window.__LIFEPP_SPATIAL_WEBGL_REQUESTS__ = [];
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      if (['webgl', 'webgl2', 'experimental-webgl'].includes(kind)) {
        window.__LIFEPP_SPATIAL_WEBGL_REQUESTS__.push(kind);
      }
      return Reflect.apply(original, this, [kind, ...args]);
    };
  });
}

async function attribute(page, selector, name, value) {
  await page.waitForFunction(({ selector, name, value }) =>
    document.querySelector(selector)?.getAttribute(name) === value, { selector, name, value });
}

async function ready(page) {
  await page.locator(rootSelector).waitFor({ state: 'visible' });
  await attribute(page, `${rootSelector} [data-scene-state]`, 'data-scene-state', 'ready-software');
  const root = page.locator(rootSelector);
  assert.equal(await root.count(), 1, 'Exactly one integrated spatial workbench');
  assert.equal(await root.getAttribute('data-external-actions'), '0');
  assert.equal(await root.locator('canvas').count(), 1, 'Software schematic has one actual canvas');
  assert.match(await root.locator('.ls-stage-sub').innerText(), /WebGL.*(?:未验收|not (?:accepted|validated|verified))/i,
    'Software mode explicitly leaves WebGL unaccepted');
  assert.doesNotMatch(await root.locator('.ls-stage-sub').innerText(), /WebGL\s*(?:不可用|unavailable)/i,
    'A deliberately disabled renderer is not reported as a hardware failure');
  assert.deepEqual(await page.evaluate(() => window.__LIFEPP_SPATIAL_WEBGL_REQUESTS__), [],
    'The original application must not attempt a WebGL context');
  return root;
}

async function selectedTab(page, id) {
  await attribute(page, rootSelector, 'data-active-tab', id);
  const tab = page.locator(`${rootSelector} [data-tab="${id}"]`);
  assert.equal(await tab.getAttribute('aria-selected'), 'true');
  assert.equal(await tab.getAttribute('tabindex'), '0');
  assert.equal(await tab.evaluate(element => element === document.activeElement), true, 'Arrow-key tabs retain focus');
  const panel = page.locator(`#${await tab.getAttribute('aria-controls')}`);
  assert.equal(await panel.isVisible(), true);
  assert.equal(await panel.getAttribute('aria-labelledby'), await tab.getAttribute('id'));
}

async function visibleIds(root, attributeName) {
  return root.locator(`[${attributeName}]`).evaluateAll((elements, attributeName) =>
    elements.map(element => element.getAttribute(attributeName)), attributeName);
}

async function spatialFraming(page) {
  // Observe two real frames after controls invalidate the canvas; do not move
  // labels or simulate an engine layout to make the assertions pass.
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  // Keep the browser-only callback literal: tsx otherwise inserts a Node-side
  // __name helper for the nested rectangle function when this runs via the spec.
  const framing = await page.evaluate(String.raw`(() => {
    const root = document.querySelector(${JSON.stringify(rootSelector)});
    const stage = root.querySelector('.ls-stage').getBoundingClientRect();
    const relative = rect => ({ x: rect.left - stage.left, y: rect.top - stage.top, width: rect.width, height: rect.height });
    const reserved = ['.ls-stage-tag', '.ls-stage-controls'].map(selector => ({
      selector, ...relative(root.querySelector(selector).getBoundingClientRect()),
    }));
    const labels = [...root.querySelectorAll('.ls-label[data-pick]')].filter(element => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== 'hidden';
    }).map(element => ({ id: element.getAttribute('data-pick'), ...relative(element.getBoundingClientRect()) }));
    return { width: stage.width, height: stage.height, labels, reserved };
  })()`);
  assert.deepEqual(framing.labels.map(label => label.id).sort(), [...rooms].sort(), 'ALL exposes all four actual canvas room labels');
  for (const label of framing.labels) {
    assert.ok(label.x >= -0.5 && label.y >= -0.5 && label.x + label.width <= framing.width + 0.5
      && label.y + label.height <= framing.height + 0.5, `${label.id} label must fit inside the stage: ${JSON.stringify(framing)}`);
    for (const reserved of framing.reserved) {
      const overlap = Math.min(label.x + label.width, reserved.x + reserved.width) - Math.max(label.x, reserved.x) > 0.5
        && Math.min(label.y + label.height, reserved.y + reserved.height) - Math.max(label.y, reserved.y) > 0.5;
      assert.equal(overlap, false, `${label.id} label must not cover ${reserved.selector}`);
    }
  }
  return framing;
}

async function readDemoDownload(download) {
  assert.equal(download.suggestedFilename(), 'LifePP_DEMO_replay_NOT_PRODUCTION.json');
  assert.equal(await download.failure(), null, 'The local JSON download completes');
  const stream = await download.createReadStream();
  assert.ok(stream, 'The actual browser download is readable');
  const chunks = [];
  let bytes = 0;
  for await (const chunk of stream) {
    bytes += chunk.length;
    assert.ok(bytes <= 128 * 1024, 'Synthetic export stays bounded');
    chunks.push(chunk);
  }
  const record = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  assert.equal(record.schema, 'lifepp.spatial.local-replay.v1');
  assert.equal(record.isDemo, true);
  assert.equal(record.signed, false);
  assert.equal(record.finalAuthority, false);
  assert.equal(record.executedExternalActions, 0);
  assert.match(record.claim, /Unsigned local demonstration/);
  assert.match(record.claim, /Not a delivery receipt/);
  assert.ok(Number.isFinite(Date.parse(record.createdAt)));
  assert.equal(record.facts.totalArea, 671.26);
  assert.equal(record.facts.secondFloorArea, 612.57);
  assert.deepEqual(record.facts.units, [
    { id: 'L112', floor: '1F', area: 58.69, sourcePage: 2 },
    { id: 'L203', floor: '2F', area: 135.8, sourcePage: 3 },
    { id: 'L202', floor: '2F', area: 185.99, sourcePage: 3 },
    { id: 'L201', floor: '2F', area: 290.78, sourcePage: 3 },
  ]);
  assert.equal(record.facts.leaseVerified, false);
  assert.equal(record.facts.navigationApproved, false);
  assert.equal(record.snapshot.enquiry, 'DRAFT_NOT_SENT');
  for (const flag of ['robotCommands', 'billing', 'telemetry']) assert.equal(record.snapshot[flag], false);
  assert.equal(record.events.length, 5);
  let previousHash = '0'.repeat(64);
  for (const [index, event] of record.events.entries()) {
    assert.equal(event.sequence, index + 1);
    assert.equal(event.action, actions[index]);
    assert.equal(event.taskId, 'DEMO-001');
    assert.equal(event.scope, 'local_replay_only');
    assert.equal(event.isDemo, true);
    assert.equal(event.signed, false);
    assert.equal(event.finalAuthority, false);
    assert.equal(event.executedExternalAction, false);
    assert.equal(event.previousHash, previousHash);
    const { hash, ...payload } = event;
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(hash, createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
      'Independently recompute the downloaded event chain');
    previousHash = hash;
  }
  await download.delete();
  return { bytes, events: record.events.length, isDemo: true, signed: false, finalAuthority: false,
    realReceipt: false, executedExternalActions: 0, hashChainVerified: true };
}

/** Runs only within the real Center route of the existing Next/workerd matrix. */
export async function assertSpatialOperations(page, { locale, base }) {
  assert.ok(locale === 'zh' || locale === 'en');
  const route = locale === 'en' ? '/en/life/center' : '/life/center';
  const otherRoute = locale === 'en' ? '/life/center' : '/en/life/center';
  assert.equal(new URL(page.url()).pathname, route);
  const root = await ready(page);
  assert.equal(await root.getAttribute('lang'), locale === 'en' ? 'en' : 'zh-CN');
  const initialFraming = await spatialFraming(page);
  const stage = root.locator('[data-scene-state]');
  const initialCameraDistance = Number(await stage.getAttribute('data-camera-distance'));
  assert.ok(Number.isFinite(initialCameraDistance) && initialCameraDistance > 0, 'The rendered frame exposes its actual camera distance');
  await root.locator('[data-action="zoom-out"]').click();
  await page.waitForFunction(({ selector, previous }) =>
    Number(document.querySelector(selector)?.getAttribute('data-camera-distance')) > previous,
  { selector: `${rootSelector} [data-scene-state]`, previous: initialCameraDistance });
  const zoomedOutCameraDistance = Number(await stage.getAttribute('data-camera-distance'));
  assert.ok(zoomedOutCameraDistance > initialCameraDistance, 'Zoom out increases distance even when the default fit exceeds the old fixed limit');
  await root.locator('[data-action="reset"]').click();
  await page.waitForFunction(selector => {
    const stage = document.querySelector(selector);
    return Math.abs(Number(stage?.getAttribute('data-camera-distance')) - Number(stage?.getAttribute('data-camera-fit-distance'))) < 0.001;
  }, `${rootSelector} [data-scene-state]`);
  const resetFraming = await spatialFraming(page);
  const storageBefore = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  assert.deepEqual(await visibleIds(root, 'data-room'), rooms);
  for (const id of rooms) {
    await root.locator(`[data-room="${id}"]`).click();
    await attribute(page, rootSelector, 'data-selected', id);
    assert.equal(await root.locator(`[data-room="${id}"]`).getAttribute('aria-pressed'), 'true');
    assert.match(await root.locator('.ls-inspector').innerText(), new RegExp(id));
  }
  await root.locator('[data-room="L112"]').focus();
  await page.keyboard.press('Tab');
  assert.equal(await root.locator('[data-room="L203"]').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Enter');
  await attribute(page, rootSelector, 'data-selected', 'L203');
  assert.equal(await root.locator('[data-room="L203"]').evaluate(element => element === document.activeElement), true,
    'Keyboard room selection preserves focus after updating the list');
  for (const [floor, expected] of [['1F', ['L112']], ['2F', ['L203', 'L202', 'L201']], ['ALL', rooms]]) {
    await root.locator(`[data-floor="${floor}"]`).focus();
    await page.keyboard.press('Enter');
    assert.equal(await root.locator(`[data-floor="${floor}"]`).getAttribute('aria-pressed'), 'true');
    assert.deepEqual(await visibleIds(root, 'data-room'), expected, `${floor} room filter`);
    assert.ok(expected.includes(await root.getAttribute('data-selected')), 'Selection stays in the visible floor');
    assert.equal(await root.locator(`[data-floor="${floor}"]`).evaluate(element => element === document.activeElement), true,
      'Filtering rooms does not steal focus from the floor button');
  }

  const imageSources = () => page.locator('main img').evaluateAll(elements => elements.map(element => element.getAttribute('src')));
  const imagesBefore = await imageSources();
  assert.ok(imagesBefore.some(src => src?.includes('floorplan-')), 'Original four-unit source plan remains in Center');
  assert.equal(await root.locator('img').count(), 0, 'Schematic does not publish additional attachment images');
  await root.locator('[data-action="plan"]').click();
  const dialog = root.locator('dialog');
  assert.equal(await dialog.isVisible(), true);
  assert.equal(await dialog.locator('img, iframe, object, embed').count(), 0, 'Plan reference is text, not a second asset viewer');
  assert.match(await dialog.innerText(), /第2、3页|pages 2 and 3/);
  assert.match(await dialog.innerText(), /不另行复制或发布|does not copy or publish/);
  assert.deepEqual(await imageSources(), imagesBefore, 'Reference dialog adds no images to the original page');
  await root.locator('[data-action="close-plan"]').click();
  assert.equal(await dialog.isVisible(), false);

  await root.locator('[data-tab="space"]').focus();
  await page.keyboard.press('ArrowRight');
  await selectedTab(page, 'network');
  assert.deepEqual(await visibleIds(root, 'data-node'), ['human', 'cai', 'L112', 'L203', 'L202', 'L201', 'evidence']);
  await root.locator('[data-node="cai"]').focus();
  await page.keyboard.press('Shift+Tab');
  assert.equal(await root.locator('[data-node="human"]').evaluate(element => element === document.activeElement), true);
  await page.keyboard.press('Enter');
  await attribute(page, rootSelector, 'data-selected', 'human');
  assert.equal(await root.locator('[data-node="human"]').evaluate(element => element === document.activeElement), true,
    'Keyboard node selection preserves focus after updating the list');
  assert.match(await root.locator('.ls-inspector').innerText(), /未配置|Not configured/);
  await root.locator('[data-tab="network"]').focus();
  await page.keyboard.press('ArrowRight');
  await selectedTab(page, 'ops');
  assert.equal(await root.locator('.ls-locked button').isDisabled(), true, 'Production dispatch remains disabled');
  for (const [filter, expected] of [
    ['DRAFT', ['DEMO-001', 'DEMO-004']], ['REVIEW', ['DEMO-002']], ['BLOCKED', ['DEMO-003']],
    ['ALL', ['DEMO-001', 'DEMO-002', 'DEMO-003', 'DEMO-004']],
  ]) {
    await root.locator('select').selectOption(filter);
    assert.deepEqual(await visibleIds(root, 'data-task'), expected, `${filter} synthetic-task filter`);
  }
  await root.locator('[data-task="DEMO-002"]').click();
  assert.equal(await root.locator('[data-task="DEMO-002"]').getAttribute('aria-pressed'), 'true');
  await root.locator('[data-action="step"]').click();
  await attribute(page, rootSelector, 'data-replay-step', '0');
  await root.locator('[data-task="DEMO-001"]').click();
  await attribute(page, rootSelector, 'data-replay-step', '-1');
  await root.locator('[data-action="play"]').click();
  await page.waitForFunction(selector => Number(document.querySelector(selector)?.getAttribute('data-replay-step')) >= 1, rootSelector);
  assert.ok(Number(await root.getAttribute('data-replay-step')) < 4, 'Observe autoplay before completion');
  await root.locator('[data-action="play"]').click();
  const pausedStep = await root.getAttribute('data-replay-step');
  // Cross an actual 1500ms replay interval to distinguish pause from a label-only change.
  await page.waitForTimeout(1700);
  assert.equal(await root.getAttribute('data-replay-step'), pausedStep, 'Paused replay does not advance across its interval');
  for (let step = Number(pausedStep); step < 4; step++) {
    await root.locator('[data-action="step"]').click();
    await attribute(page, rootSelector, 'data-replay-step', String(step + 1));
  }
  assert.equal(await root.locator('[data-action="step"]').isDisabled(), true);
  assert.equal(await root.locator('[data-step].is-played').count(), 5);
  const [download] = await Promise.all([
    page.waitForEvent('download'), root.locator('[data-action="export"]').click(),
  ]);
  const exported = await readDemoDownload(download);
  assert.match(await root.locator('.ls-toast').innerText(), /未发送至任何外部接收端|Nothing sent to an external recipient/);
  assert.equal(await root.getAttribute('data-external-actions'), '0');
  assert.deepEqual(await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } })), storageBefore,
    'Local replay/export does not persist browser storage');
  await root.locator('[data-action="clear"]').click();
  await attribute(page, rootSelector, 'data-replay-step', '-1');
  assert.equal(await root.locator('[data-step].is-played').count(), 0);
  await root.locator('[data-tab="ops"]').focus();
  await page.keyboard.press('Home');
  await selectedTab(page, 'space');
  await ready(page);

  await page.locator(`a[hreflang="${locale === 'en' ? 'zh-CN' : 'en'}"]`).click();
  await page.waitForURL(url => url.pathname === otherRoute);
  assert.equal(await page.locator('html').getAttribute('lang'), locale === 'en' ? 'zh-CN' : 'en');
  await ready(page);
  await page.locator('a[href="/"]').first().click();
  await page.waitForURL(new URL('/', base).href);
  assert.equal(await page.locator('html').getAttribute('lang'), 'en');
  assert.equal(await page.locator('h1').count(), 1, 'Original ecology homepage remains reachable');
  assert.match(await page.locator('body').innerText(), /CanopyProof/);
  await page.goto(new URL(route, base).href, { waitUntil: 'networkidle' });
  await ready(page);
  await attribute(page, rootSelector, 'data-replay-step', '-1');
  assert.equal(await page.locator(`${rootSelector} [data-floor="ALL"]`).getAttribute('aria-pressed'), 'true');
  return { mode: 'original-center-application', syntheticFixture: true, renderer: 'software', webglAttempted: false,
    webglAccepted: false, floors: ['1F', '2F', 'ALL'], selectedRooms: rooms, keyboardTabs: ['network', 'ops', 'space'],
    keyboardSelectionFocusPreserved: ['room', 'node', 'floor'],
    initialFraming, resetFraming, initialCameraDistance, zoomedOutCameraDistance,
    taskFilters: ['DRAFT', 'REVIEW', 'BLOCKED', 'ALL'], replayPauseObservedMs: 1700, exported,
    planReferenceAddsImages: false, languageSwitch: true, ecologyHomePreserved: true,
    realReceipt: false, productionDispatch: false };
}
