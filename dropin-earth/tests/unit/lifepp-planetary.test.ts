import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { planetaryHref, planetaryViews } from "../../apps/web/src/data/planetary";

test("planetary reference routes keep paired languages separate from existing Life routes", () => {
  for (const view of planetaryViews) {
    assert.equal(planetaryHref("en", view), view === "home" ? "/" : `/${view}`);
    assert.equal(planetaryHref("zh", view), view === "home" ? "/zh" : `/zh/${view}`);
  }
});

for (const production of [false, true]) test(`planetary metadata keeps bilingual canonical and indexing boundaries (${production})`, () => {
  const code = 'import {planetaryMetadata,planetaryViews} from "./apps/web/src/data/planetary.ts"; console.log(JSON.stringify(planetaryViews.flatMap(view => ["en","zh"].map(locale => ({locale,view,metadata:planetaryMetadata(locale,view)})))));';
  const items = JSON.parse(execFileSync(process.execPath, ["--import", "tsx", "--input-type=module", "-e", code], {
    encoding: "utf8", env: { ...process.env, NEXT_PUBLIC_CANOPYPROOF_MODE: production ? "production" : "staging", NEXT_PUBLIC_DROPIN_SITE_URL: production ? "https://canopyproof.org" : "https://preview.example.invalid" },
  }));
  assert.equal(items.length, 10);
  for (const { locale, view, metadata } of items) {
    assert.deepEqual(metadata.robots, { index: production, follow: production });
    assert.equal(metadata.alternates.canonical, `https://canopyproof.org${planetaryHref(locale, view)}`);
    assert.deepEqual(metadata.alternates.languages, {
      en: `https://canopyproof.org${planetaryHref("en", view)}`,
      "zh-CN": `https://canopyproof.org${planetaryHref("zh", view)}`,
      "x-default": `https://canopyproof.org${planetaryHref("en", view)}`,
    });
    assert.equal(metadata.openGraph.locale, locale === "zh" ? "zh_CN" : "en_US");
    assert.equal(metadata.openGraph.siteName, "CanopyProof");
    assert.equal(metadata.openGraph.images[0].url, "/icon.jpg");
    assert.equal(metadata.twitter.title, metadata.title);
    assert.equal(metadata.twitter.description, metadata.description);
    assert.deepEqual(metadata.twitter.images, ["/icon.jpg"]);
  }
});
