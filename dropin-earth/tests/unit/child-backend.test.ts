import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import test from 'node:test';
import {backendConfig} from '../../services/api/src/child-backend/config.js';
import {backendLog} from '../../services/api/src/child-backend/database.js';
import {createChildBackend} from '../../services/api/src/child-backend/app.js';
import {currentAuthorityClient} from '../../services/api/src/child-backend/current-authority.js';
import {stableJson} from '../../services/api/src/domain/child-stewardship/store.js';

const pair=generateKeyPairSync('ed25519'),publicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString();
const session=randomUUID(),moment=Date.now(),audience='canopyproof:synthetic:child-backend';
function response(request:Record<string,unknown>){return {
 protocol:'CanopyProof-CurrentRestoreAuthority/1',environment:'SIMULATION_ONLY',audience,nonce:request.nonce,sessionId:request.sessionId,
 issuedAt:new Date(moment).toISOString(),expiresAt:new Date(moment+10_000).toISOString(),
 anchor:{sessionId:request.sessionId,checkpointId:'synthetic-checkpoint-1',sequence:1,digest:'a'.repeat(64),keyRegistryVersion:'fixture-v1'},
 registry:{version:'fixture-v1',keys:['protection','trustee'].map((role,i)=>({keyId:`test-${i}`,role,controlDomain:`fixture-${i}`,independentOfOperator:true,publicKey,revoked:false,validAfter:new Date(moment-1000).toISOString(),expiresAt:new Date(moment+60_000).toISOString()}))},
};}
function transport(mutate:(payload:ReturnType<typeof response>)=>void=()=>{},badSignature=false):typeof fetch{return async(_input,init)=>{
 const payload=response(JSON.parse(String(init?.body)));mutate(payload);
 return Response.json({payload,signature:(badSignature?Buffer.alloc(64):sign(null,Buffer.from(stableJson(payload)),pair.privateKey)).toString('base64url')});
};}
const client=(fetcher:typeof fetch)=>currentAuthorityClient({url:'https://authority.synthetic.invalid/current',publicKey,audience,now:()=>moment,fetch:fetcher});
test('backend configuration defaults closed, rejects privileged ambient injection, TLS overrides and unsupported real modes',()=>{
 const config=backendConfig({DATABASE_URL:'postgresql://owner:secret@unsafe/real'});assert.equal(config.mode,'disabled');assert.equal(config.databaseUrl,undefined);
 for(const env of [{CHILD_BACKEND_MODE:'child-pilot'},{CHILD_MIGRATION_DATABASE_URL:'private'},{CHILD_VERIFIER_DATABASE_URL:'private'},{PORT:'NaN'},{CHILD_WEB_ORIGIN:'https://safe.invalid/path'},
 {CHILD_DATABASE_URL:'postgresql://user:secret@db/real?sslmode=disable'},{CHILD_DATABASE_URL:'postgresql://user:secret@db/test',CHILD_DATABASE_TLS:'local-test'},
 {CHILD_CURRENT_AUTHORITY_URL:'http://unsafe.invalid'},{CHILD_CURRENT_AUTHORITY_PUBLIC_KEY:'not-a-public-key'}])assert.throws(()=>backendConfig(env),/CONFIGURATION_INVALID/);
 assert.equal(backendConfig({CHILD_DATABASE_URL:'postgresql://user:secret@localhost/local_test',CHILD_DATABASE_TLS:'local-test'}).databaseTls,'local-test');
});
test('isolated HTTP entry has no memory fallback, enrollment, payment, generic media, or body logging',async()=>{
 let calls=0;
 for(const mode of ['disabled','synthetic-demo']){
  const backend=createChildBackend({config:backendConfig({CHILD_BACKEND_MODE:mode}),sourceSha:'a'.repeat(40),migrations:[],fetch:async()=>{calls++;throw new Error('must not fetch');}});
  assert.equal((await backend.app.request('/health/live')).status,200);
  assert.equal((await backend.app.request('/health/ready')).status,503);
  for(const path of ['/canopyproof/child-stewardship/v1/demo-sessions','/canopyproof/child-stewardship/v1/guardian/sessions','/payments','/uploads']){
   const r=await backend.app.request(path,{method:'POST',body:JSON.stringify({name:'sensitive-input',verified:true})});assert.ok([403,503].includes(r.status));assert.equal((await r.text()).includes('sensitive-input'),false);
  }
  assert.equal((await backend.app.request('/health/live',{headers:{origin:'https://unapproved.invalid'}})).status,403);
  const preflight=await backend.app.request('/canopyproof/child-stewardship/v1/commands',{method:'OPTIONS',headers:{origin:'https://synthetic.invalid'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://synthetic.invalid');
  backend.stop();assert.equal(await backend.ready(),false);
 }
 assert.equal(calls,0);
 const lines:string[]=[];backendLog('database_unavailable',line=>lines.push(line));backendLog('postgresql://secret' as 'request_failed',line=>lines.push(line));assert.equal(lines.join('').includes('secret'),false);
});
test('current authority positive control verifies actual Ed25519 bytes and never reuses a response nonce',async()=>{
 const requests:string[]=[];const base=transport();const fetcher:typeof fetch=async(url,init)=>{requests.push(String(init?.body));assert.equal(init?.redirect,'error');assert.equal(init?.credentials,'omit');return base(url,init);};
 const read=client(fetcher);assert.equal((await read(session)).anchor.sequence,1);assert.equal((await read(session)).registry.keys.length,2);assert.notEqual(requests[0],requests[1]);
});
test('current authority rejects forged/replayed/stale/wrong-scope/extra-field/registry/quorum responses',async()=>{
 const mutations:((p:ReturnType<typeof response>)=>void)[]=[p=>{p.nonce='a'.repeat(43);},p=>{p.sessionId=randomUUID();},p=>{p.anchor.sessionId=randomUUID();},p=>{p.audience='another-service';},
 p=>{p.expiresAt=new Date(moment).toISOString();},p=>{p.issuedAt=new Date(moment+1).toISOString();},p=>{p.expiresAt=new Date(moment+31_000).toISOString();},p=>{p.registry.version='replaced';},
 p=>{p.anchor.sequence=0;},p=>{p.registry.keys[1]!.keyId=p.registry.keys[0]!.keyId;},p=>{p.registry.keys[1]!.controlDomain=p.registry.keys[0]!.controlDomain;},
 p=>{p.registry.keys[1]!.revoked=true;},p=>{p.registry.keys[1]!.independentOfOperator=false;},p=>{Object.assign(p,{verified:true});},p=>{p.environment='PRODUCTION';}];
 for(const mutation of mutations)await assert.rejects(client(transport(mutation))(session),/AUTHORITY_UNAVAILABLE/);
 await assert.rejects(client(transport(()=>{},true))(session),/AUTHORITY_UNAVAILABLE/);
 let saved:Response|undefined;const replay:typeof fetch=async(url,init)=>{saved??=await transport()(url,init);return saved.clone();};const reader=client(replay);await reader(session);await assert.rejects(reader(session),/AUTHORITY_UNAVAILABLE/);
});
test('transport rejects oversized, malformed, unavailable responses without retry or exposing provider error',async()=>{
 for(const result of [new Response('x'.repeat(65_537),{headers:{'content-type':'application/json'}}),Response.json({},{status:503}),new Response('not json',{headers:{'content-type':'application/json'}}),new Response('secret-body')]){
  let calls=0;await assert.rejects(client(async()=>{calls++;return result;})(session),/AUTHORITY_UNAVAILABLE/);assert.equal(calls,1);
 }
 await assert.rejects(client(async()=>{throw new Error('secret-url');})(session),error=>error instanceof Error && error.message==='CURRENT_RESTORE_AUTHORITY_UNAVAILABLE');
});
test('transport aborts a stalled response within the fixed three-second budget',{timeout:5000},async()=>{
 let aborted=false;const read=client(async(_url,init)=>new Promise<Response>((_,reject)=>{init!.signal!.addEventListener('abort',()=>{aborted=true;reject(new Error('aborted'));});}));
 await assert.rejects(read(session),/AUTHORITY_UNAVAILABLE/);assert.equal(aborted,true);
});
test('real bundled producer starts closed, serves safe health, plans migrations without DB and drains on SIGTERM',{timeout:20_000},async()=>{
 const {execFile,spawn}=await import('node:child_process');const {promisify}=await import('node:util');const {createServer}=await import('node:net');
 const run=promisify(execFile);
 await run(process.execPath,['--import','tsx','scripts/build-child-backend.mjs'],{timeout:10_000});
 const plan=await run(process.execPath,['dist/child-backend/migrate.mjs','--plan'],{env:{PATH:process.env.PATH},timeout:5000});
 assert.equal(JSON.parse(plan.stdout).migrations.length,11);assert.equal(JSON.parse(plan.stdout).createsRoles,false);
 await assert.rejects(run(process.execPath,['dist/child-backend/migrate.mjs','--apply-synthetic'],{env:{PATH:process.env.PATH},timeout:5000}));
 const reservation=createServer();await new Promise<void>(resolve=>reservation.listen(0,'127.0.0.1',resolve));const address=reservation.address();assert.ok(address&&typeof address==='object');const port=address.port;await new Promise<void>(resolve=>reservation.close(()=>resolve()));
 const child=spawn(process.execPath,['dist/child-backend/server.mjs'],{env:{PATH:process.env.PATH,PORT:String(port)},stdio:['ignore','pipe','pipe']});
 const exited=new Promise<number|null>((resolve,reject)=>{child.once('exit',resolve);child.once('error',reject);});let logs='';child.stdout.on('data',chunk=>{logs+=String(chunk);});child.stderr.on('data',chunk=>{logs+=String(chunk);});
 try{
  let live:Response|undefined;const deadline=Date.now()+5000;
  while(Date.now()<deadline){try{live=await fetch(`http://127.0.0.1:${port}/health/live`);break;}catch{await new Promise(resolve=>setTimeout(resolve,25));}}
  assert.equal(live?.status,200,logs);assert.equal((await live!.json()).realCapabilities,false);
  const ready=await fetch(`http://127.0.0.1:${port}/health/ready`);assert.equal(ready.status,503);
  const denied=await fetch(`http://127.0.0.1:${port}/canopyproof/child-stewardship/v1/guardian/sessions`,{method:'POST',body:'sensitive-request'});assert.equal(denied.status,503);assert.equal(logs.includes('sensitive-request'),false);
 }finally{child.kill('SIGTERM');}
 assert.equal(await exited,0);
});
