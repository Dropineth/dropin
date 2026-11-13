import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildSync } from 'esbuild';
import { assertPlanDrag, installPlanDragProbe, type PointerSample } from '../browser/lifepp-pointer-drag.ts';

test('pointer observation serializes into an isolated page without Node transform helpers', () => {
  const listeners: { type: string; listener: EventListener; options: AddEventListenerOptions }[] = [];
  const element: { __lifeppDragProbe?: { samples: PointerSample[] }; addEventListener: (type: string, listener: EventListener, options: AddEventListenerOptions) => void } = {
    addEventListener(type, listener, options) { listeners.push({ type, listener, options }); },
  };
  runInNewContext(`(${installPlanDragProbe.toString()})(element)`, { element });
  assert.deepEqual(listeners.map(entry => entry.type), ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']);
  for (const entry of listeners) {
    assert.equal(entry.listener, listeners[0]!.listener);
    assert.equal(entry.options.capture, true); assert.equal(entry.options.passive, true);
  }
  listeners[0]!.listener({ type: 'pointerdown', isTrusted: true, pointerId: 7, button: 0, buttons: 1, clientX: 200, clientY: 150 } as unknown as Event);
  const observed = element.__lifeppDragProbe?.samples;
  assert.ok(observed); assert.equal(observed.length, 1);
  assert.equal(observed[0]!.trusted, true); assert.equal(observed[0]!.pointerId, 7);
  assert.equal(observed[0]!.x, 200); assert.equal(observed[0]!.y, 150);
});

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
test('sparse pressed moves accept the full release result and still reject partial displacement', () => {
  const sparse = samples.map((sample, index) => index === 2 ? { ...sample, y: 125 } : sample);
  assert.doesNotThrow(() => assertPlanDrag(before, after, sparse));
  for (const bad of [before, { ...after, y: -1.19 }, { ...after, transform: before.transform }]) {
    assert.throws(() => assertPlanDrag(before, bad, sparse));
  }
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
    change(2, { y: 99 }), change(2, { y: 201 }), change(2, { x: 502 }), change(2, { type: 'pointercancel' }),
    [...samples.slice(0, 3), { ...samples[4]!, type: 'lostpointercapture' }, ...samples.slice(3)]]) {
    assert.throws(() => assertPlanDrag(before, after, bad));
  }
});

type Element = { props: Record<string, unknown> };
type Pointer = { pointerId: number; button: number; clientX: number; clientY: number; target: { closest: () => null }; currentTarget: { setPointerCapture: () => void } };
const loadDependency = createRequire(resolve('package.json'));
const componentCode = buildSync({ entryPoints: ['apps/web/src/components/life/FourShopPlan.tsx'], bundle: true,
  platform: 'node', format: 'cjs', write: false, jsx: 'automatic', external: ['react', 'react/jsx-runtime'],
  loader: { '.module.css': 'empty' }, tsconfig: 'apps/web/tsconfig.json' }).outputFiles[0]!.text;

/** Drives the actual component handlers with deterministic hooks; not a native browser event test. */
function planHarness() {
  const hooks: unknown[] = []; let cursor = 0;
  const react = {
    useId: () => 'drag-test',
    useState(initial: unknown) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], (next: unknown) => { hooks[index] = typeof next === 'function' ? next(hooks[index]) : next; }];
    },
    useRef(initial: unknown) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
  };
  const module = { exports: {} as { FourShopPlan: (props: { locale: 'en' }) => Element } };
  runInNewContext(componentCode, { module, exports: module.exports, require: (name: string) => name === 'react' ? react : loadDependency(name) });
  let elements: Element[] = [];
  function render() {
    cursor = 0; elements = [];
    const visit = (value: unknown) => {
      if (Array.isArray(value)) { value.forEach(visit); return; }
      if (value && typeof value === 'object' && 'props' in value) {
        const element = value as Element; elements.push(element); visit(element.props.children);
      }
    };
    visit(module.exports.FourShopPlan({ locale: 'en' }));
    const ref = viewport().props.ref as { current: unknown };
    ref.current = { getBoundingClientRect: () => ({ width: 1000, height: 500 }) };
  }
  const viewport = () => elements.find(element => 'data-plan-viewport' in element.props)!;
  const handler = (element: Element, name: string) => element.props[name] as (event?: Pointer) => void;
  const point = (y: number, pointerId = 7): Pointer => ({ pointerId, button: 0, clientX: 200, clientY: y,
    target: { closest: () => null }, currentTarget: { setPointerCapture() {} } });
  render();
  handler(elements.find(element => element.props.role === 'tab' && String(element.props.id).endsWith('-2F'))!, 'onClick')(); render();
  handler(elements.find(element => element.props.children === 'Focus selected')!, 'onClick')(); render();
  handler(elements.find(element => element.props['aria-label'] === 'Look left')!, 'onClick')(); render();
  return {
    send(name: string, y: number, pointerId = 7) { handler(viewport(), name)(point(y, pointerId)); render(); },
    state: () => ({ x: Number(viewport().props['data-pan-x']), y: Number(viewport().props['data-pan-y']), zoom: Number(viewport().props['data-zoom']) }),
  };
}

test('actual plan commits final release coordinates after sparse pointer movement', () => {
  const plan = planHarness(), start = plan.state();
  plan.send('onPointerDown', 150);
  plan.send('onPointerMove', 175); // Only the first quarter of the physical drag arrived as a move.
  assert.equal(plan.state().y, Number((start.y + .05).toFixed(3)));
  plan.send('onPointerUp', 250);
  assert.deepEqual(plan.state(), { ...start, y: Number((start.y + .2).toFixed(3)) });
  plan.send('onPointerMove', 300);
  assert.deepEqual(plan.state(), { ...start, y: Number((start.y + .2).toFixed(3)) });
});

test('actual plan cancellation and lost capture do not apply release coordinates', () => {
  for (const stop of ['onPointerCancel', 'onLostPointerCapture']) {
    const plan = planHarness();
    plan.send('onPointerDown', 150); plan.send('onPointerMove', 175);
    const lastMove = plan.state();
    plan.send(stop, 250); plan.send('onPointerUp', 300); plan.send('onPointerMove', 350);
    assert.deepEqual(plan.state(), lastMove);
  }
});

test('another pointer cannot finish or cancel the active plan drag', () => {
  const plan = planHarness(), start = plan.state();
  plan.send('onPointerDown', 150);
  for (const stop of ['onPointerUp', 'onPointerCancel', 'onLostPointerCapture']) plan.send(stop, 300, 99);
  assert.deepEqual(plan.state(), start);
  plan.send('onPointerUp', 250);
  assert.deepEqual(plan.state(), { ...start, y: Number((start.y + .2).toFixed(3)) });
});
