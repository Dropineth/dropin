import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { BUSINESS_ROUTES, businessHref, type BusinessArea } from "../../apps/web/src/data/life/business-entrypoints";

const areas = Object.keys(BUSINESS_ROUTES) as BusinessArea[];

test("business navigation targets existing read surfaces, not transactional endpoints", () => {
  assert.deepEqual(BUSINESS_ROUTES, {
    overview: "/", earth: "/earth", evidence: "/evidence", ecology: "/ecology",
    life: "/life", spaces: "/life/spaces", company: "/company",
  });
  assert.equal(Object.isFrozen(BUSINESS_ROUTES), true);
  for (const area of areas) for (const locale of ["zh", "en"] as const) {
    const path = businessHref(area, locale);
    const url = new URL(path, "https://canopyproof.org");
    assert.equal(url.origin, "https://canopyproof.org");
    assert.equal(url.search, "");
    assert.equal(url.hash, "");
    assert.doesNotMatch(path, /api|inquiries|payments|admin|commands/);
  }
});

test("verified bilingual Life routes remain unchanged without inventing translated ecology URLs", () => {
  assert.equal(businessHref("life", "zh"), "/life");
  assert.equal(businessHref("life", "en"), "/en/life");
  assert.equal(businessHref("spaces", "en"), "/en/life/spaces");
  assert.equal(businessHref("company", "en"), "/en/company");
  assert.equal(businessHref("ecology", "en"), "/ecology");
  const manifest = JSON.parse(readFileSync(new URL('../../apps/web/src/data/life/site-manifest.json', import.meta.url), 'utf8'));
  for (const area of ["life", "spaces", "company"] as const) assert.ok(manifest.newRoutes.includes(businessHref(area, "zh")));
  assert.ok(Object.values(manifest.featureFlags).every(value => value === false));
});

test("unknown or inherited business keys cannot become navigation URLs", () => {
  for (const value of ["__proto__", "constructor", "toString", "https://untrusted.example/", "missing"]) {
    assert.throws(() => businessHref(value as BusinessArea), /Unknown business area/);
  }
});

test("ecology switcher uses the explicit ecology route instead of incorrectly marking root as ecology", () => {
  const source = readFileSync(new URL('../../apps/web/src/components/life/BrandSwitcher.tsx', import.meta.url), 'utf8');
  assert.match(source, /businessHref\(area, locale\)/);
  assert.match(source, /activeArea = "ecology"/);
  assert.match(source, /LIFEPP_PUBLIC_BRAND/);
  assert.doesNotMatch(source, /href="\/#top"|fetch\(|useEffect\(/);
});
