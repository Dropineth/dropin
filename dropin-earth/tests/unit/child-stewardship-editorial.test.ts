import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const component = new URL('../../apps/web/src/components/child-stewardship/StewardshipExperience.tsx', import.meta.url);
const stylesheet = new URL('../../apps/web/src/components/child-stewardship/Stewardship.module.css', import.meta.url);

test('stewardship uses a ruled, near-white reading surface and grounded navigation', async () => {
  const css = await readFile(stylesheet, 'utf8');
  assert.match(css, /background: #fcfcfa/);
  assert.match(css, /\.card \{[^}]*border-top: 1px solid var\(--line\);[^}]*border-radius: 0;[^}]*background: transparent/);
  assert.match(css, /\.nav \{[^}]*position: fixed;[^}]*bottom: 0;[^}]*width: 100%;[^}]*border-radius: 0/);
  assert.doesNotMatch(css, /backdrop-filter/);
  assert.match(css, /padding-bottom: calc\(11rem \* var\(--text-scale\) \+ env\(safe-area-inset-bottom\)\)/);
  assert.match(css, /\.header \{[^}]*position: sticky;[^}]*top: 0/);
  assert.match(css, /@media \(max-width: 380px\)/);
  assert.match(css, /\.large \{ --text-scale: 1\.25; \}/);
});

test('supporting metadata has comfortable contrast against the reading surface', async () => {
  const css = await readFile(stylesheet, 'utf8');
  const ink = css.match(/--muted:\s*(#[\da-f]{6})/i)?.[1];
  const background = css.match(/background:\s*(#[\da-f]{6})/i)?.[1];
  assert.ok(ink && background);
  const luminance = (hex: string) => {
    const rgb = [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16) / 255);
    const linear = rgb.map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4);
    return linear[0]! * .2126 + linear[1]! * .7152 + linear[2]! * .0722;
  };
  assert.ok((luminance(background) + .05) / (luminance(ink) + .05) >= 5);
  assert.match(css, /\.treeMeta dt \{ color: var\(--muted\)/);
});

test('botanical scene and ring remain decorative, clearly synthetic, and self-contained', async () => {
  const source = await readFile(component, 'utf8');
  assert.match(source, /aria-label="合成树木插画，不表示实时健康"/);
  assert.match(source, /id="cp-brand-ring"/);
  assert.match(source, /id="cp-leaf-surface"/);
  assert.match(source, /data-synthetic-only="true"/);
  assert.match(source, /合成插画 · 不是实时画面/);
  assert.match(source, /onClick=\{stop\}>停一停/);
  assert.match(source, /onClick=\{\(\) => go\("S30"\)\}>找帮助/);
  assert.doesNotMatch(source, /<image\b|<img\b|<iframe\b/);
});
