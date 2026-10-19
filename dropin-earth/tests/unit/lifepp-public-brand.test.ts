import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { LIFEPP_PUBLIC_BRAND, lifeBrandHomeLabel } from '../../apps/web/src/data/life/public-brand';
import { lifeMetadata, lifePages, localPath } from '../../apps/web/src/data/life/navigation';

const expectedPages = ['', 'spaces', 'center', 'agents', 'membership', 'partners', 'trust'];

test('public brand changes without renaming route identities or legal company', () => {
  assert.equal(LIFEPP_PUBLIC_BRAND, 'Life++HERE');
  assert.deepEqual(Object.keys(lifePages), expectedPages);
  assert.equal(lifeBrandHomeLabel('zh'), 'Life++HERE 首页');
  assert.equal(lifeBrandHomeLabel('en'), 'Life++HERE home');
  assert.equal(localPath('/life/partners', 'zh'), '/life/partners');
  assert.equal(localPath('/life/partners', 'en'), '/en/life/partners');
  assert.match(String(lifeMetadata('/company', 'company', 'zh').title), /CanopyProof Limited/);
});

test('home and scene metadata share the public brand while preserving canonical URLs', () => {
  for (const locale of ['zh', 'en'] as const) {
    for (const [path, page] of [['/life', 'home'], ['/life/spaces/33', 'scene'], ['/life/spaces/29', 'scene'], ['/life/spaces/31', 'scene']] as const) {
      const metadata = lifeMetadata(path, page, locale);
      assert.match(String(metadata.title), /Life\+\+HERE/);
      assert.doesNotMatch(String(metadata.title), /生生不息/);
      assert.equal(metadata.alternates?.canonical, `https://canopyproof.org${localPath(path, locale)}`);
      assert.equal(metadata.alternates?.languages?.['zh-CN'], `https://canopyproof.org${path}`);
      assert.equal(metadata.alternates?.languages?.en, `https://canopyproof.org/en${path}`);
    }
  }
});

test('shared shell uses the public brand without opening billing or changing company identity', () => {
  const source = readFileSync(new URL('../../apps/web/src/components/life/LifeShell.tsx', import.meta.url), 'utf8');
  assert.match(source, /aria-label=\{lifeBrandHomeLabel\(locale\)\}/);
  assert.match(source, /CanopyProof Limited/);
  assert.doesNotMatch(source, /生生不息|LIFE, CONNECTED/);
  const manifest = JSON.parse(readFileSync(new URL('../../apps/web/src/data/life/site-manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(manifest.membership.tiers.map((tier: { name: string }) => tier.name), ['Life', 'Life+', 'Life++']);
  assert.ok(Object.values(manifest.featureFlags).every(value => value === false));
});
