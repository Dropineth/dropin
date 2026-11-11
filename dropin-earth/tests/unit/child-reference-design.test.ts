import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {childPublicPage, childPublicHeaders} from '../../apps/web/src/components/child-public/public-page.mjs';

test('pearl and orbital guide design preserves fixed, accessible non-signer content', () => {
  for (const zh of [false, true]) {
    const html = childPublicPage('canopy', zh);
    assert.match(html, /color-scheme:light/);
    assert.match(html, /class="constellation" aria-hidden="true"/);
    assert.match(html, /class="brand-mark mark-life"/);
    assert.match(html, /class="brand-mark mark-dropin"/);
    assert.match(html, /prefers-reduced-motion:reduce/);
    assert.match(html, /forced-colors:active/);
    assert.match(html, /@media\(max-width:380px\)/);
    assert.doesNotMatch(html, /<script\b|<img\b|<iframe\b|<form\b|<input\b|<button\b/i);
    assert.match(html, zh ? /真实注册未开放/ : /REAL ENROLLMENT CLOSED/);
    assert.match(html, zh ? /CAI 提出建议，不签署授权/ : /CAI proposes\. It never signs/);
    assert.match(childPublicHeaders['content-security-policy'], /default-src 'none'/);
  }
});

test('stewardship visual layer retains visible disabled, focus and mobile safety states', async () => {
  const css = await readFile(new URL('../../apps/web/src/components/child-stewardship/Stewardship.module.css', import.meta.url), 'utf8');
  assert.match(css, /:focus-visible/);
  assert.match(css, /\.quiet:disabled/);
  assert.match(css, /min-height: 48px/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /forced-colors: active/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /\.art \.treeMeta \{ display: grid/);
  assert.match(css, /\.large \{ --text-scale: 1\.25; \}/);
  assert.doesNotMatch(css, /font-size:\s*\d+(?:\.\d+)?px/);
  for (const size of css.matchAll(/font-size:\s*calc\(([\d.]+)rem \* var\(--text-scale\)\)/g)) {
    assert.ok(Number(size[1]) >= .875, 'supporting text stays at least 14px and scales in large mode');
  }
  for (const selector of ['.status', '.card dl', '.ledger div', '.nav button']) {
    const rule = css.slice(css.indexOf(`${selector} {`)).split('}')[0];
    assert.match(rule, /font-size: calc\([\d.]+rem \* var\(--text-scale\)\)/);
  }
  assert.doesNotMatch(css, /@import|url\(\s*["']?https?:/i);
});
