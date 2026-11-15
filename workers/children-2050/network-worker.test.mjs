import test from 'node:test';
import assert from 'node:assert/strict';
import worker,{ORIGIN} from './worker.mjs';
const aud='a'.repeat(64),env={CHILD_PREVIEW_ACCESS_AUD:aud},ctx={access:{aud}};
for(const path of ['/network','/en/network','/zh/network','/api/network/status','/api/network/home']){
 test('network anonymous denial '+path,async()=>{
  const r=await worker.fetch(new Request(ORIGIN+path),env,{});assert.equal(r.status,403);assert.equal(await r.text(),'Access required');assert.match(r.headers.get('cache-control'),/private, no-store/);
 });
}
for(const path of ['/network','/en/network','/zh/network'])test('network protected editorial route '+path,async()=>{
 const r=await worker.fetch(new Request(ORIGIN+path),env,ctx);assert.equal(r.status,200);assert.match(await r.text(),/GLOBAL NETWORK/);assert.match(r.headers.get('content-security-policy'),/script-src 'none'/);
});
test('network readiness stays closed even with user activation parameters',async()=>{
 const r=await worker.fetch(new Request(ORIGIN+'/api/network/status?enabled=true&childId=other'),{...env,ENABLE_REAL_ACCOUNTS:'true'},ctx);const body=await r.json();assert.equal(body.personalizedHome,'not_connected');assert.equal(body.spatial.assessmentGrid.metres,3000);assert.equal(body.childCount,null);assert.equal(body.threeD.assetCount,null);assert.equal(JSON.stringify(body).includes('other'),false);
});
test('account-specific endpoint remains closed after Access authentication',async()=>{
 const r=await worker.fetch(new Request(ORIGIN+'/api/network/home?tenant=other&subject=other'),env,ctx);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'ACCOUNT_AUTHORITY_NOT_CONNECTED',accepted:false});
});
test('network writes are not accepted',async()=>{
 for(const path of ['/network','/api/network/status','/api/network/home']){const r=await worker.fetch(new Request(ORIGIN+path,{method:'POST',body:'child private input'}),env,ctx);assert.equal(r.status,405);assert.equal((await r.text()).includes('private input'),false);}
});
test('network forged headers do not replace native Access context',async()=>{
 const r=await worker.fetch(new Request(ORIGIN+'/api/network/home',{headers:{'Cf-Access-Jwt-Assertion':'forged','Cookie':'CF_Authorization=forged'}}),env,{});assert.equal(r.status,403);
});
test('network HEAD has no body',async()=>{
 for(const path of ['/network','/api/network/status','/api/network/home']){const r=await worker.fetch(new Request(ORIGIN+path,{method:'HEAD'}),env,ctx);assert.equal(await r.text(),'');}
});
test('private asset URLs and alternate hosts are not activated',async()=>{
 assert.equal((await worker.fetch(new Request(ORIGIN+'/api/network/assets/asset:test'),env,ctx)).status,404);
 assert.equal((await worker.fetch(new Request('https://preview.workers.dev/network'),env,ctx)).status,404);
});
