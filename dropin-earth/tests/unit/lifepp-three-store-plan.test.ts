import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import manifest from '../../apps/web/src/data/life/site-manifest.json';
import { LIFEPP_PUBLIC_BRAND } from '../../apps/web/src/data/life/public-brand';
import { lifeMetadata, lifePages } from '../../apps/web/src/data/life/navigation';
import { rooms, pageMeta } from '../../apps/web/src/data/life/content';
import { ROOMS, AREA_TOTAL, AREA_SECOND_FLOOR, NODES, EDGES, TASKS } from '../../apps/web/src/components/life/spatial/spatial-data.mjs';

const root = new URL('../../apps/web/src/', import.meta.url);
const source = (path: string) => readFileSync(new URL(path, root), 'utf8');

test('manifest, service cards and existing spatial demo agree on the three-store scope', () => {
  const ids = ['L112', 'L203', 'L202'];
  assert.deepEqual(manifest.spaces.map(room => room.unit), ids);
  assert.deepEqual(rooms.map(room => room.unit), ids);
  assert.deepEqual(ROOMS.map(room => room.id), ids);
  assert.deepEqual(manifest.currentPlan.units, ids);
  assert.deepEqual(manifest.currentPlan.excludedUnits, ['L201']);
  assert.equal(manifest.currentPlan.totalAreaSqm, 380.48);
  assert.equal(manifest.currentPlan.secondFloorAreaSqm, 321.79);
  assert.equal(AREA_TOTAL, 380.48);
  assert.equal(AREA_SECOND_FLOOR, 321.79);
  assert.equal(manifest.spaces.reduce((sum, room) => sum + Math.round(room.areaSqm * 100), 0), 38048);
  assert.equal(manifest.spaces.filter(room => room.floor === '2F').reduce((sum, room) => sum + Math.round(room.areaSqm * 100), 0), 32179);
  assert.ok(!NODES.some(node => node.id === 'L201'));
  assert.ok(!EDGES.flat().includes('L201'));
  assert.ok(TASKS.every(task => ids.includes(task.room)));
});

test('all public Life titles and business brand labels use Life++HERE without renaming membership IDs', () => {
  assert.equal(manifest.brand, LIFEPP_PUBLIC_BRAND);
  for (const [path, page] of Object.entries(lifePages)) {
    for (const locale of ['zh', 'en'] as const) {
      assert.match(String(lifeMetadata(`/life${path ? '/' + path : ''}`, page, locale).title), /Life\+\+HERE/);
    }
  }
  assert.equal(pageMeta.home.title.zh, LIFEPP_PUBLIC_BRAND);
  assert.equal(pageMeta.home.title.en, LIFEPP_PUBLIC_BRAND);
  for (const path of ['components/life/LifePages.tsx', 'components/life/LifeShell.tsx', 'components/life/BrandSwitcher.tsx', 'data/life/content.ts', 'data/life/navigation.ts', 'components/planetary/PlanetarySite.tsx', 'components/planetary/ReferenceGlobe.tsx', 'app/layout.tsx']) {
    assert.doesNotMatch(source(path), /生生不息|LIFE, CONNECTED|Life\+\+ symbiosis/, path);
  }
  assert.deepEqual(manifest.membership.tiers.map(tier => tier.name), ['Life', 'Life+', 'Life++']);
  assert.equal(manifest.companyName, 'CanopyProof Limited');
});

test('current copy does not publish obsolete four-store areas as the active plan', () => {
  for (const path of ['components/life/LifePages.tsx', 'components/life/FourShopPlan.tsx', 'data/life/content.ts', 'components/life/spatial/spatial-data.mjs', 'components/life/spatial/spatial-engine.mjs', 'components/planetary/ReferenceGlobe.tsx']) {
    assert.doesNotMatch(source(path), /671\.26|612\.57|四铺|four-unit/i, path);
  }
  assert.match(source('components/life/FourShopPlan.tsx'), /data-four-shop-plan/);
  assert.match(source('components/life/FourShopPlan.tsx'), /data-plan-units/);
  assert.equal(manifest.currentPlan.sourceFloorplansUnchanged, true);
  assert.equal(manifest.currentPlan.status, 'proposal_not_accepted');
});

test('the original 3D renderer and geometry authoring code remain byte-identical', () => {
  const originals = {
    'components/life/spatial/spatial-scene.mjs': 'fce0e4c4daa3df62112635830425ef9a5a0028e4',
    'components/life/spatial/scene-spec.mjs': '6fe50fb58539807c461c3b4fe53ecce695573c24',
  };
  for (const [path, expected] of Object.entries(originals)) {
    const bytes = readFileSync(new URL(path, root));
    const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(actual, expected, path);
  }
});

test('source inputs, links and safety defaults are not promoted by a planning update', () => {
  assert.deepEqual(manifest.scenes.map(scene => scene.id), ['33', '29', '31']);
  for (const scene of manifest.scenes) {
    assert.equal(scene.embedStatus, 'disabled');
    assert.equal(scene.embedUrl, null);
    assert.equal(scene.thirdPartyRightsVerified, false);
    assert.equal(scene.roomBinding, null);
    assert.equal(scene.navigationStatus, 'not_validated');
  }
  assert.ok(Object.values(manifest.featureFlags).every(value => value === false));
  assert.equal(manifest.membership.status, 'proposal_not_on_sale');
  assert.equal(manifest.inputProvenance.asOf, '2026-09-30');
  assert.equal(manifest.currentPlan.asOf, '2026-10-19');
  assert.deepEqual(manifest.preserveAnchors, ['#top', '#protocol', '#how-it-works', '#explorer', '#methodology', '#stack', '#contact']);
  assert.match(source('components/life/BrandSwitcher.tsx'), /href="\/#top"/);
  assert.doesNotMatch(source('components/life/BrandSwitcher.tsx'), /business-entrypoints|businessHref/);
});
