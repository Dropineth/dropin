import test from 'node:test';
import assert from 'node:assert/strict';
import worker, {authenticatedContext, ORIGIN} from './worker.mjs';
const aud='a'.repeat(64), env={CHILD_PREVIEW_ACCESS_AUD:aud}, ctx={access:{aud}};
const req=(path='/',method='GET',headers={})=>new Request(ORIGIN+path,{method,headers});
for(const path of ['/','/learn','/account','/capture','/network','/family','/en','/en/learn','/assets/children2050.css','/api/status','/api/children/accounts','/api/capture-requests']) {
 test(`anonymous cannot read ${path}`,async()=>{const r=worker.fetch(req(path),env,{});assert.equal(r.status,403);assert.equal(await r.text(),'Access required');assert.match(r.headers.get('cache-control'),/private, no-store/);});
}
test('forged identity headers and cookies never grant access',()=>{const r=worker.fetch(req('/','GET',{'Cf-Access-Jwt-Assertion':'forged','Cf-Access-Authenticated-User-Email':'parent@example.test','Cookie':'CF_Authorization=forged'}),env,{});assert.equal(r.status,403);});
test('missing, wrong, array or malformed audience fails closed',()=>{for(const [e,c]of [[{},ctx],[env,{}],[env,{access:{aud:'b'.repeat(64)}}],[env,{access:{aud:[aud]}}],[{CHILD_PREVIEW_ACCESS_AUD:''},{access:{aud:''}}]])assert.equal(authenticatedContext(e,c),false);});
test('alternate hostname and HTTP origin fail despite authenticated context',()=>{for(const url of ['https://children-preview.workers.dev/','http://children.canopyproof.org/','https://canopyproof.org/'])assert.equal(worker.fetch(new Request(url),env,ctx).status,404);});
for(const lang of ['','/en'])for(const path of ['/','/learn','/account','/capture','/network','/family']){
 test(`authorized editorial route ${lang}${path}`,async()=>{const url=lang+path;const r=worker.fetch(req(url),env,ctx);assert.equal(r.status,200);const html=await r.text();assert.match(html,/CanopyProof/);assert.match(html,/2030|2050/);assert.match(html,/<html lang="/);assert.doesNotMatch(html,/<script|<iframe|<form|<input/);assert.equal(r.headers.get('x-frame-options'),'DENY');assert.match(r.headers.get('content-security-policy'),/connect-src 'none'/);});
}
test('assets are same-origin and require authentication',()=>{const r=worker.fetch(req('/assets/children2050.css'),env,ctx);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/css/);});
test('HEAD returns no body',async()=>{const r=worker.fetch(req('/account','HEAD'),env,ctx);assert.equal(r.status,200);assert.equal(await r.text(),'');});
test('unsupported methods cannot write editorial state',()=>{for(const method of ['POST','PUT','DELETE','PATCH']){const r=worker.fetch(req('/account',method),env,ctx);assert.equal(r.status,405);assert.equal(r.headers.get('allow'),'GET, HEAD');}});
test('sensitive operations fail rather than creating a fake account or request',async()=>{for(const path of ['/api/children/accounts','/api/capture-requests']){const r=worker.fetch(new Request(ORIGIN+path,{method:'POST',body:'invalid JSON with private input'}),env,ctx);assert.equal(r.status,503);assert.deepEqual(await r.json(),{error:'SERVICE_NOT_CONNECTED',accepted:false,persisted:false,accountCreated:false});}});
test('status discloses no child records, balances or implied enrollment',async()=>{const data=await worker.fetch(req('/api/status'),env,ctx).json();assert.equal(data.accountId,null);assert.equal(data.verifiedContributionCount,null);assert.equal(data.accountOpening,'not_connected');});
test('query parameters are never reflected',async()=>{const html=await worker.fetch(req('/?child=<script>secret-name</script>&account=pretend'),env,ctx).text();assert.doesNotMatch(html,/secret-name|pretend|<script>/);});
test('legacy child guide paths stay protected and render the new guide',()=>{for(const path of ['/children','/child-accounts','/zh','/zh/child-accounts','/stewardship'])assert.equal(worker.fetch(req(path),env,ctx).status,200);});
test('unknown assets and traversal paths do not serve a fallback document',()=>{for(const path of ['/assets/other.css','/account/private','/.env','/%2e%2e/secrets'])assert.equal(worker.fetch(req(path),env,ctx).status,404);});
test('references and child-specific exclusions are explicit',async()=>{const html=await worker.fetch(req('/learn'),env,ctx).text();for(const site of ['sdgs.un.org','unicef.org','fao.org'])assert.ok(html.includes(site));assert.ok(html.includes('不是这些机构'));assert.ok(html.includes('不等于')||html.includes('不能'));});
