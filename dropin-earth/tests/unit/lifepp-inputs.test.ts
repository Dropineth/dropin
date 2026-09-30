import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import manifest from "../../apps/web/src/data/life/site-manifest.json";
import { renderedMetadata } from "../helpers/lifepp-metadata";

test("business input preserves final rooms, cent-square-metre totals and proposed annual prices", () => {
 assert.deepEqual(manifest.spaces.map(room=>[room.unit,Math.round(room.areaSqm*100)]),[["L112",5869],["L203",13580],["L202",18599],["L201",29078]]);
 assert.equal(manifest.spaces.reduce((sum,room)=>sum+Math.round(room.areaSqm*100),0),67126);
 assert.equal(manifest.spaces.filter(room=>room.unit!=="L112").reduce((sum,room)=>sum+Math.round(room.areaSqm*100),0),61257);
 assert.equal(manifest.membership.status,"proposal_not_on_sale");
 assert.equal(manifest.membership.billingInterval,"year");
 assert.deepEqual(manifest.membership.tiers.map(tier=>[tier.name,tier.price]),[["Life",299],["Life+",599],["Life++",1000]]);
 assert.ok(Object.values(manifest.featureFlags).every(value=>value===false));
});
test("production metadata covers every bilingual route with language alternates and safe preview defaults",()=>{
 const production=renderedMetadata(true);
 for(const route of manifest.newRoutes)for(const prefix of ["","/en"]){
   const page=production.sitemap.find(item=>item.url===`https://canopyproof.org${prefix}${route}`);
   assert.ok(page);assert.deepEqual(page.alternates,{languages:{"zh-CN":`https://canopyproof.org${route}`,en:`https://canopyproof.org/en${route}`}});
 }
 const preview=renderedMetadata(false);assert.deepEqual(preview.sitemap,[]);assert.equal(preview.robots.rules[0]?.disallow,"/");
});
test("ecology anchor identities and disabled frame policy survive integration",()=>{
 const landing=readFileSync("apps/web/src/components/canopyproof/CanopyProofLanding.tsx","utf8");
 for(const anchor of manifest.preserveAnchors)assert.ok(landing.includes(`id="${anchor.slice(1)}"`));
 const middleware=readFileSync("apps/web/src/middleware.ts","utf8");
 assert.match(middleware,/frame-src 'none'/);assert.match(middleware,/frame-ancestors 'none'/);
 const viewer=readFileSync("apps/web/src/components/life/SceneViewer.tsx","utf8");
 assert.doesNotMatch(viewer,/dangerouslySetInnerHTML|window\.location\.search/);
});

test("local Worker preview cannot inherit production routes or live API settings",()=>{
 const config=JSON.parse(readFileSync("apps/web/wrangler.local.jsonc","utf8"));
 assert.equal(config.workers_dev,false);assert.equal(config.preview_urls,false);
 assert.equal(config.routes,undefined);assert.equal(config.account_id,undefined);
 assert.equal(config.vars.NEXT_PUBLIC_CANOPYPROOF_MODE,"staging");
 assert.match(config.vars.NEXT_PUBLIC_DROPIN_API_URL,/\.invalid\/api$/);
 assert.equal(config.vars.DROPIN_ALLOW_ADMIN_PROXY,"false");
 assert.equal(config.vars.DROPIN_MAINNET_TRANSFERS_ENABLED,"false");
 assert.ok(config.services.every((binding:{service:string;remote?:boolean})=>binding.service===config.name&&!binding.remote));
});
