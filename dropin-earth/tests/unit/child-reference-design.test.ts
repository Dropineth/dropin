import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {childPublicPage, childPublicHeaders} from '../../apps/web/src/components/child-public/public-page.mjs';

test('sculptural editorial guide preserves fixed, accessible non-signer content', () => {
  for (const zh of [false, true]) {
    const html = childPublicPage('canopy', zh);
    assert.match(html, /color-scheme:light/);
    assert.match(html, /class="hero-scene" aria-hidden="true"/);
    assert.match(html, /url\('\/child-experience\/hero-v2\.webp'\)/);
    assert.match(html, /background-size:100% auto/);
    assert.match(html, /class="hero-copy"/);
    assert.match(html, /<svg class="arrow-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">/);
    assert.doesNotMatch(html, /↗/);
    assert.match(html, /class="hero-foot"/);
    assert.match(html, /class="journey-layout"/);
    assert.match(html, /class="family-layout"/);
    assert.match(html, /class="role-head"/);
    const foreground = html.match(/\.num\{color:(#[\da-f]{6});/)![1];
    const background = html.match(/--bg:(#[\da-f]{6});/)![1];
    const luminance = (hex: string) => {
      const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
      const linear = rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
      return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
    };
    assert.ok((luminance(background) + .05) / (luminance(foreground) + .05) >= 5, '12px editorial numbers retain comfortable text contrast');
    assert.doesNotMatch(html, /class="diagram"|class="permission-seal"/);
    assert.match(html, /class="brand-mark mark-life"/);
    assert.match(html, /class="brand-mark mark-dropin"/);
    assert.match(html, /prefers-reduced-motion:reduce/);
    assert.match(html, /forced-colors:active/);
    assert.match(html, /@media\(max-width:380px\)/);
    assert.doesNotMatch(html, /\.nav[^{}]*\{[^}]*display:\s*none/);
    assert.match(html, /\.nav a:first-child\{display:inline-flex\}/);
    assert.doesNotMatch(html, /<script\b|<img\b|<iframe\b|<form\b|<input\b|<button\b/i);
    assert.match(html, zh ? /真实注册未开放/ : /REAL ENROLLMENT CLOSED/);
    assert.match(html, zh ? /CAI 提出建议，不签署授权/ : /CAI proposes\. It never signs/);
    assert.match(childPublicHeaders['content-security-policy'], /default-src 'none'/);
    assert.match(childPublicHeaders['content-security-policy'], /img-src 'self'/);
    assert.match(childPublicHeaders['content-security-policy'], /form-action 'none'/);
    assert.doesNotMatch(html, /url\(\s*["']?https?:|@import/i);
    assert.equal((html.match(/<h1>/g) ?? []).length, 1);
    assert.equal((html.match(/class="primary"/g) ?? []).length, 1);
    assert.equal((html.match(/class="entry-card"/g) ?? []).length, 3);
    assert.equal((html.match(/class="family-note"/g) ?? []).length, 2);
    assert.equal((html.match(/<details /g) ?? []).length, 4);
    for (const [, size] of html.matchAll(/font-size:([\d.]+)rem/g)) {
      assert.ok(Number(size) >= .75, 'no type is smaller than 12px');
    }
    if (zh) {
      const headline = html.match(/<h1>(.*?)<\/h1>/)![1];
      for (const line of headline.split('<br>')) {
        assert.ok(line.replace(/<[^>]*>/g, '').length <= 15, 'Chinese headline stays concise');
      }
    }
  }
});

test('edge middleware uses the same bounded image policy as the static guide', async () => {
  const source = await readFile(new URL('../../apps/web/src/middleware.ts', import.meta.url), 'utf8');
  assert.match(source, /import \{ childPublicHeaders \} from "\.\/components\/child-public\/public-page\.mjs"/);
  assert.match(source, /childGuide \? childPublicHeaders\["content-security-policy"\]/);
  assert.match(childPublicHeaders['content-security-policy'], /default-src 'none'; img-src 'self';/);
  assert.doesNotMatch(childPublicHeaders['content-security-policy'], /img-src[^;]*(?:https:|data:|blob:|\*)/);
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
