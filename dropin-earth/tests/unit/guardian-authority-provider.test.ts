import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {createGuardianAuthorityProvider,type GuardianAuthorityScope} from '../../services/api/src/child-backend/guardian-authority-provider.js';
import {stableJson} from '../../services/api/src/domain/child-stewardship/store.js';
import {backendConfig} from '../../services/api/src/child-backend/config.js';

const pair=generateKeyPairSync('ed25519'),publicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString();
const config={endpoint:'https://authority.synthetic.invalid/guardian-observation',issuerId:'fixture-issuer-not-real',keyId:'fixture-root',publicKey,audience:'fixture-child-backend'};
const moment=Date.now();
const scope:GuardianAuthorityScope={sessionId:randomUUID(),childSubjectId:'fixture-child',guardianSubjectId:'fixture-adult',operation:'session',minimumSequence:7};
function statement(body:string){const request=JSON.parse(body);return {protocol:'CanopyProof-GuardianAuthorityObservation/1',issuerId:config.issuerId,keyId:config.keyId,
  audience:config.audience,nonce:request.nonce,request:request.request,issuedAt:new Date(moment).toISOString(),expiresAt:new Date(moment+20_000).toISOString(),sequence:7,
  relationship:{subjectType:'human-guardian',status:'active',validFrom:new Date(moment-1000).toISOString(),validUntil:new Date(moment+60_000).toISOString()}};}
type Statement=ReturnType<typeof statement>;
function transport(mutate:(value:Statement)=>void=()=>{},badSignature=false):typeof fetch{return async(_url,init)=>{
  const value=statement(String(init?.body));mutate(value);
  return Response.json({statement:value,signature:(badSignature?Buffer.alloc(64):sign(null,Buffer.from(stableJson(value)),pair.privateKey)).toString('base64url')});
};}
const reader=(fetcher:typeof fetch)=>createGuardianAuthorityProvider({configuration:config,fetch:fetcher,now:()=>moment});
const denied={kind:'unavailable',authorizationGranted:false};

test('guardian provider is closed without explicit trust configuration and has no production route wiring',async()=>{
  let calls=0;assert.deepEqual(await createGuardianAuthorityProvider({fetch:async()=>{calls++;throw new Error('must not call');}}).observe(scope),denied);assert.equal(calls,0);
  for(const mode of ['production','real','child-pilot'])assert.throws(()=>backendConfig({CHILD_BACKEND_MODE:mode}),/CONFIGURATION_INVALID/);
  const app=await readFile('services/api/src/child-backend/app.ts','utf8');assert.equal(app.includes('createGuardianAuthorityProvider'),false);
});
test('guardian provider rejects invalid URL, private/non-Ed25519 keys and extra configuration',()=>{
  for(const endpoint of ['http://unsafe.invalid','https://user:secret@unsafe.invalid','https://safe.invalid/?token=secret','https://safe.invalid/#fragment'])
    assert.throws(()=>createGuardianAuthorityProvider({configuration:{...config,endpoint}}),/CONFIGURATION_INVALID/);
  for(const key of ['invalid',pair.privateKey.export({type:'pkcs8',format:'pem'}).toString(),generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({type:'spki',format:'pem'}).toString()])
    assert.throws(()=>createGuardianAuthorityProvider({configuration:{...config,publicKey:key}}),/CONFIGURATION_INVALID/);
  assert.throws(()=>createGuardianAuthorityProvider({configuration:{...config,...{verified:true}}}),/CONFIGURATION_INVALID/);
});
test('actual signature yields observation only, exact scoped input and fresh nonces, never an authorization grant',async()=>{
  const nonces:string[]=[],base=transport();let calls=0;
  const provider=reader(async(url,init)=>{calls++;assert.equal(url,config.endpoint);assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');assert.equal(init?.cache,'no-store');
    const packet=JSON.parse(String(init?.body));nonces.push(packet.nonce);assert.deepEqual(packet.request,scope);assert.equal(packet.issuerId,config.issuerId);return base(url,init);});
  for(let i=0;i<2;i++){const result=await provider.observe(scope);assert.equal(result.kind,'signed-attestation');assert.equal(result.authorizationGranted,false);}
  assert.equal(calls,2);assert.notEqual(nonces[0],nonces[1]);
});
test('guardian attestation rejects identity/action/issuer/revocation/freshness/sequence mismatches even with valid root signature',async()=>{
  const mutations:((value:Statement)=>void)[]=[p=>{p.issuerId='wrong';},p=>{p.keyId='wrong';},p=>{p.audience='wrong';},p=>{p.nonce='a'.repeat(43);},
    p=>{p.request.sessionId=randomUUID();},p=>{p.request.childSubjectId='different';},p=>{p.request.guardianSubjectId='different';},p=>{p.request.operation='recovery';},
    p=>{p.request.minimumSequence=0;},p=>{p.sequence=6;},p=>{p.relationship.status='revoked';},p=>{p.relationship.status='suspended';},
    p=>{p.relationship.validFrom=new Date(moment+1).toISOString();},p=>{p.relationship.validUntil=new Date(moment).toISOString();},
    p=>{p.issuedAt=new Date(moment+1).toISOString();},p=>{p.expiresAt=new Date(moment).toISOString();},p=>{p.expiresAt=new Date(moment+30_001).toISOString();},
    p=>{p.relationship.validUntil=new Date(moment+10_000).toISOString();},p=>{Object.assign(p,{verified:true});},p=>{p.protocol='CanopyProof-CurrentRestoreAuthority/1';}];
  for(const mutate of mutations)assert.deepEqual(await reader(transport(mutate)).observe(scope),denied);
  assert.deepEqual(await reader(transport(()=>{},true)).observe(scope),denied);
});
test('AI, child twins and institutional names cannot become guardian signer subjects',async()=>{
  for(const subjectType of ['AI','child-cai','child','UN','BEV','institution','operator'])
    assert.deepEqual(await reader(transport(p=>{p.relationship.subjectType=subjectType;})).observe(scope),denied);
});
test('pinned root, no response replay, no scope mutation and no issuer-selected replacement keys',async()=>{
  const other=generateKeyPairSync('ed25519');
  assert.deepEqual(await reader(async(_url,init)=>{const value=statement(String(init?.body));return Response.json({statement:value,signature:sign(null,Buffer.from(stableJson(value)),other.privateKey).toString('base64url')});}).observe(scope),denied);
  let saved:Response|undefined;const base=transport();const provider=reader(async(url,init)=>{saved??=await base(url,init);return saved.clone();});
  assert.equal((await provider.observe(scope)).kind,'signed-attestation');assert.deepEqual(await provider.observe(scope),denied);
  const mutable={...scope};const copied=reader(async(url,init)=>{mutable.operation='recovery';return base(url,init);});
  const result=await copied.observe(mutable);assert.equal(result.kind,'signed-attestation');if(result.kind==='signed-attestation')assert.equal(result.statement.request.operation,'session');
});
test('invalid input fails before transport; all failures are bounded uniform closed results with no retry',async()=>{
  let calls=0;const provider=reader(async()=>{calls++;throw new Error('private-provider-detail');});
  for(const invalid of [{...scope,operation:'payment'},{...scope,sessionId:'bad'},{...scope,minimumSequence:-1},{...scope,...{verified:true}}])
    assert.deepEqual(await provider.observe(invalid as GuardianAuthorityScope),denied);
  assert.equal(calls,0);assert.deepEqual(await provider.observe(scope),denied);assert.equal(calls,1);
  for(const response of [new Response('x'.repeat(16_385),{headers:{'content-type':'application/json'}}),Response.json({},{status:503}),new Response('secret-not-json',{headers:{'content-type':'application/json'}}),new Response('{}',{headers:{'content-type':'application/json-invalid'}})]){
    let count=0;assert.deepEqual(await reader(async()=>{count++;return response;}).observe(scope),denied);assert.equal(count,1);
  }
});
test('expiry during transport and local clock rollback cannot release an attestation',async()=>{
  let clock=moment;const base=transport();
  const expiring=createGuardianAuthorityProvider({configuration:config,now:()=>clock,fetch:async(url,init)=>{clock+=20_000;return base(url,init);}});
  assert.deepEqual(await expiring.observe(scope),denied);
  clock=moment;let calls=0;
  const readerWithClock=createGuardianAuthorityProvider({configuration:config,now:()=>clock,fetch:async(url,init)=>{calls++;return base(url,init);}});
  assert.equal((await readerWithClock.observe(scope)).kind,'signed-attestation');clock--;
  assert.deepEqual(await readerWithClock.observe(scope),denied);assert.equal(calls,1);
});
test('rejected headers cancel an unconsumed body',async()=>{
  let cancelled=false;
  assert.deepEqual(await reader(async()=>new Response(new ReadableStream({cancel(){cancelled=true;}}),{status:503})).observe(scope),denied);
  assert.equal(cancelled,true);
});
test('provider deadline also closes an uncooperative stalled body, without retry',{timeout:5000},async()=>{
  let calls=0,aborted=false,cancelled=false;
  const provider=reader(async(_url,init)=>{calls++;init?.signal?.addEventListener('abort',()=>{aborted=true;});
    return new Response(new ReadableStream({cancel(){cancelled=true;}}),{headers:{'content-type':'application/json'}});});
  assert.deepEqual(await provider.observe(scope),denied);assert.equal(calls,1);assert.equal(aborted,true);
  assert.equal(cancelled,true);
});
test('late fetch completion after deadline is cancelled rather than leaving a body reader pending',{timeout:5000},async()=>{
  await Promise.all([{status:200,type:'application/json'},{status:503,type:'application/json'},{status:200,type:'text/plain'}].map(async({status,type})=>{
    let deliver:((response:Response)=>void)|undefined,cancelled=false;
    const provider=reader(async()=>new Promise<Response>(resolve=>{deliver=resolve;}));
    assert.deepEqual(await provider.observe(scope),denied);assert.ok(deliver);
    deliver(new Response(new ReadableStream({cancel(){cancelled=true;}}),{status,headers:{'content-type':type}}));
    await Promise.resolve();await Promise.resolve();assert.equal(cancelled,true);
  }));
});
