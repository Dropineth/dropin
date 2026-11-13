import assert from 'node:assert/strict';
import type { Locator, Page } from 'playwright';

export type PlanView = { x: number; y: number; zoom: number; transform: string };
export type PointerSample = { type: string; trusted: boolean; pointerId: number; button: number; buttons: number; x: number; y: number };
type Probe = { samples: PointerSample[]; listener: EventListener };
type ProbedElement = HTMLElement & { __lifeppDragProbe?: Probe };

export function installPlanDragProbe(element: HTMLElement) {
  const node = element as ProbedElement;
  const samples: PointerSample[] = [];
  // Method syntax avoids a module-scoped keepNames helper in the serialized callback.
  const probe: Probe = { samples, listener(event) {
    const pointer = event as PointerEvent;
    if (samples.length < 32) samples.push({ type: pointer.type, trusted: pointer.isTrusted, pointerId: pointer.pointerId,
      button: pointer.button, buttons: pointer.buttons, x: pointer.clientX, y: pointer.clientY });
  } };
  node.__lifeppDragProbe = probe;
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) node.addEventListener(type, probe.listener, { capture: true, passive: true });
}

export function assertPlanDrag(before: PlanView, after: PlanView, samples: PointerSample[]) {
  const downIndex = samples.findIndex(sample => sample.type === 'pointerdown');
  assert.ok(downIndex >= 0, 'The gesture must deliver pointerdown');
  const down = samples[downIndex]!;
  assert.ok(down.trusted && down.button === 0 && down.buttons === 1, 'Primary pointerdown must be real browser input');
  const upIndex = samples.findIndex((sample, index) => index > downIndex && sample.type === 'pointerup');
  assert.ok(upIndex > downIndex, 'The gesture must deliver pointerup');
  const up = samples[upIndex]!;
  assert.ok(up.trusted && up.pointerId === down.pointerId && up.button === 0 && up.buttons === 0, 'Pointerup must belong to the same trusted gesture');
  const held = samples.slice(downIndex + 1, upIndex);
  assert.ok(!held.some(sample => sample.type === 'pointercancel' || sample.type === 'lostpointercapture'), 'The drag may not cancel or lose capture before release');
  const moves = held.filter(sample => sample.type === 'pointermove');
  assert.ok(moves.length > 0, 'At least one pressed pointermove must arrive');
  assert.ok(moves.every(sample => sample.trusted && sample.pointerId === down.pointerId && sample.buttons === 1), 'Moves must remain trusted and pressed');
  assert.ok(up.y > down.y && Math.abs(up.x - down.x) <= 1, 'The real gesture must move downward without horizontal movement');
  assert.ok(moves.every(sample => sample.y >= down.y && sample.y <= up.y && Math.abs(sample.x - down.x) <= 1),
    'Pressed moves must stay within the vertical gesture path; release may complete coalesced movement');
  for (const value of [before.x, before.y, before.zoom, after.x, after.y, after.zoom]) assert.ok(Number.isFinite(value));
  assert.ok(before.y + .2 < 0 && before.y > 1 - before.zoom, 'Fixture drag must not be hidden by clamping');
  assert.ok(Math.abs(after.y - (before.y + .2)) <= .002, 'A 20%-height drag must produce the full normalized pan delta');
  assert.equal(after.x, before.x, 'Vertical drag must preserve horizontal pan');
  assert.equal(after.zoom, before.zoom, 'Drag must preserve zoom');
  assert.notEqual(after.transform, before.transform, 'The rendered drawing transform must change');
}

/** Real, rapid mouse gesture. Observation never dispatches or modifies an event. */
export async function verifyPlanPointerDrag(page: Page, view: Locator) {
  await view.scrollIntoViewIfNeeded();
  const box = await view.boundingBox(); assert.ok(box);
  // After focusing L203 and panning left, L202 occupies the 80% column.
  // Keep the same rapid 20%-height gesture in the clear left-hand drawing area.
  const points = [{ x: box.x + box.width * .2, y: box.y + box.height * .3 }, { x: box.x + box.width * .2, y: box.y + box.height * .5 }];
  const hits = await view.evaluate((element, positions) => positions.map(point => {
    const target = document.elementFromPoint(point.x, point.y);
    return { visible: point.x >= 0 && point.y >= 0 && point.x < innerWidth && point.y < innerHeight,
      inView: Boolean(target && element.contains(target)), button: Boolean(target?.closest('button')), tag: target?.tagName ?? null };
  }), points);
  assert.ok(hits.every(hit => hit.visible && hit.inView && !hit.button), `Drag coordinates must hit visible non-button drawing content: ${JSON.stringify({ box, points, hits })}`);
  const snapshot = () => view.evaluate(element => ({ x: Number(element.getAttribute('data-pan-x')), y: Number(element.getAttribute('data-pan-y')),
    zoom: Number(element.getAttribute('data-zoom')), transform: getComputedStyle(element.firstElementChild!).transform }));
  const before = await snapshot();
  await view.evaluate(installPlanDragProbe);
  let held = false;
  try {
    await page.mouse.move(points[0]!.x, points[0]!.y);
    await page.mouse.down(); held = true;
    await page.mouse.move(points[1]!.x, points[1]!.y, { steps: 4 });
    // Preserve the original rapid move-to-release sequence. Do not hold the
    // pointer until React commits, which could conceal a rapid-gesture defect.
    await page.mouse.up(); held = false;
    await page.waitForFunction(expected => {
      const element = document.querySelector('[data-plan-viewport]');
      return element !== null && Math.abs(Number(element.getAttribute('data-pan-y')) - expected) <= .002;
    }, before.y + .2, { timeout: 10_000 });
    const samples = await view.evaluate(element => (element as ProbedElement).__lifeppDragProbe!.samples);
    assertPlanDrag(before, await snapshot(), samples);
  } catch (error) {
    const diagnostic = await view.evaluate(element => ({ samples: (element as ProbedElement).__lifeppDragProbe?.samples,
      scroll: { x: scrollX, y: scrollY }, pan: { x: element.getAttribute('data-pan-x'), y: element.getAttribute('data-pan-y') } }));
    throw new Error(`Plan pointer drag failed: ${JSON.stringify({ box, points, hits, before, ...diagnostic })}`, { cause: error });
  } finally {
    try {
      if (held) await page.mouse.up();
    } finally {
      await view.evaluate(element => {
        const node = element as ProbedElement, probe = node.__lifeppDragProbe;
        if (probe) for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) node.removeEventListener(type, probe.listener, true);
        delete node.__lifeppDragProbe;
      });
    }
  }
}
