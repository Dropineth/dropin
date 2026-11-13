import assert from 'node:assert/strict';
import test from 'node:test';
import { assertPlanDrag, type PointerSample } from '../browser/lifepp-pointer-drag.ts';

const before = { x: -.64, y: -1.24, zoom: 3, transform: 'matrix(3, 0, 0, 3, -640, -1240)' };
const after = { ...before, y: -1.04, transform: 'matrix(3, 0, 0, 3, -640, -1040)' };
const samples: PointerSample[] = [
  { type: 'pointermove', trusted: true, pointerId: 1, button: -1, buttons: 0, x: 500, y: 100 },
  { type: 'pointerdown', trusted: true, pointerId: 1, button: 0, buttons: 1, x: 500, y: 100 },
  { type: 'pointermove', trusted: true, pointerId: 1, button: -1, buttons: 1, x: 500, y: 200 },
  { type: 'pointerup', trusted: true, pointerId: 1, button: 0, buttons: 0, x: 500, y: 200 },
  { type: 'lostpointercapture', trusted: true, pointerId: 1, button: 0, buttons: 0, x: 500, y: 200 },
];
test('drag evidence accepts coalesced trusted movement and normal capture loss after release', () => {
  assert.doesNotThrow(() => assertPlanDrag(before, after, samples));
});
test('drag evidence rejects the observed no-movement failure and partial or cosmetic movement', () => {
  for (const bad of [before, { ...after, y: -1.19 }, { ...after, transform: before.transform }, { ...after, x: -.5 }, { ...after, zoom: 4 }, { ...after, y: NaN }]) {
    assert.throws(() => assertPlanDrag(before, bad, samples));
  }
});
test('drag evidence refuses fabricated, unpressed, cancelled, mismatched or missing browser input', () => {
  const change = (index: number, patch: Partial<PointerSample>) => samples.map((sample, at) => at === index ? { ...sample, ...patch } : sample);
  for (const bad of [[], samples.filter(sample => sample.type !== 'pointerdown'), samples.filter(sample => sample.type !== 'pointerup'),
    samples.filter(sample => sample.type !== 'pointermove'), change(1, { trusted: false }), change(2, { trusted: false }),
    change(2, { buttons: 0 }), change(2, { pointerId: 2 }), change(3, { pointerId: 2 }), change(3, { trusted: false }),
    change(2, { y: 125 }), change(2, { type: 'pointercancel' }), [...samples.slice(0, 3), { ...samples[4]!, type: 'lostpointercapture' }, ...samples.slice(3)]]) {
    assert.throws(() => assertPlanDrag(before, after, bad));
  }
});
