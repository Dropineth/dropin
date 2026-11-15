import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import test from 'node:test';
import {attestClosedStartup} from '../../services/api/src/child-backend/closed-startup-attestation.js';
import {backendConfig} from '../../services/api/src/child-backend/config.js';
import {backendLog} from '../../services/api/src/child-backend/database.js';
import {createChildBackend} from '../../services/api/src/child-backend/app.js';
import {currentAuthorityClient} from '../../services/api/src/child-backend/current-authority.js';
import {stableJson} from '../../services/api/src/domain/child-stewardship/store.js';

const pair=generateKeyPairSync('ed25519'),publicKey=pair.publicKey.export({type:'spki',format:'pem'}).toString();
const checkpointKeys=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')].map(key=>key.publicKey.export({type:'spki',format:'pem'}).toString());
const session=randomUUID(),moment=Date.now(),audience='canopyproof:synthetic:child-backend';
function response(request:Record<string,unknown>){return {
 protocol:'CanopyProof-CurrentRestoreAuthority/1',environment:'SIMULATION_ONLY',audience,nonce:request.nonce,sessionId:request.sessionId,
 issuedAt:new Date(moment).toISOString(),expiresAt:new Date(moment+10_000).toISOString(),
 anchor:{sessionId:request.sessionId,checkpointId:'synthetic-checkpoint-1',sequence:1,digest:'a'.repeat(64),keyRegistryVersion:'fixture-v1'},
 registry:{version:'fixture-v1',keys:['protection','trustee'].map((role,i)=>({keyId:`test-${i}`,role,controlDomain:`fixture-${i}`,independentOfOperator:true,publicKey:checkpointKeys[i]!,revoked:false,validAfter:new Date(moment-1000).toISOString(),expiresAt:new Date(moment+60_000).toISOString()}))},
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
test('signed restore registry cannot turn one key into independent roles or admit unusable keys',async()=>{
 for(const alias of [checkpointKeys[0]!,checkpointKeys[0]!.replaceAll('\n','\r\n')]){
  await assert.rejects(client(transport(p=>{p.registry.keys[1]!.publicKey=alias;}))(session),/AUTHORITY_UNAVAILABLE/);
 }
 for(const invalid of ['not-a-public-key',generateKeyPairSync('ec',{namedCurve:'prime256v1'}).publicKey.export({type:'spki',format:'pem'}).toString(),pair.privateKey.export({type:'pkcs8',format:'pem'}).toString()]){
  await assert.rejects(client(transport(p=>{p.registry.keys[1]!.publicKey=invalid;}))(session),/AUTHORITY_UNAVAILABLE/);
 }
 await assert.rejects(client(transport(p=>{p.registry.keys.push({...p.registry.keys[0]!,keyId:'extra-seat',controlDomain:'extra-domain'});}))(session),/AUTHORITY_UNAVAILABLE/);
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
 const parsed=JSON.parse(plan.stdout);
 // Pin the original migration journal names and bytes, and the exact append-only hold.
 assert.deepEqual(parsed.migrations,[
  {name:'child-stewardship.sql',digest:'0de3410ef9b3a944ab793dd27607f170c284cbb30877a511a55408a894d682a0'},
  {name:'child-stewardship-authority.sql',digest:'c993db69a00463bd7b41526e94fc1c17461ade3bafd8317ce88008964e9c1d29'},
  {name:'child-stewardship-privacy.sql',digest:'76e2c827a13f44c293ccf626b62bbadfdb5fb05f046685822d6b19915ab461ea'},
  {name:'child-stewardship-webauthn.sql',digest:'0591d72866ff6361e1f998515f73a616497f7cfd8cc45f30f2592676ea1617ed'},
  {name:'child-stewardship-resume.sql',digest:'7d1fce33c6c1da05344711fea4e643923701a39ffcebfdbcb3d738e8e9469c8a'},
  {name:'child-stewardship-draft-authorization.sql',digest:'f973add7187a9f39a77358a69a03ba2a875ef19127442ae983cc049d2af741eb'},
  {name:'child-stewardship-rate-limit.sql',digest:'e486540a7d002b2e1cf84454af39cc5c06c30bd382b77174cda470a354bece61'},
  {name:'child-stewardship-media.sql',digest:'29e74a9353767df6be27cad2684de03fe0092453264ef6e51f69fb88489af46a'},
  {name:'child-stewardship-agent-gateway.sql',digest:'446105719297ff21a8092d91a0320420ce1a850868a8e1568021402456e51b1b'},
  {name:'child-stewardship-guardian-sessions.sql',digest:'eff163c6c36174e99407a328fae8c295ee556a370125266967d99ef026812496'},
  {name:'child-stewardship-restore.sql',digest:'a34bfd03bf1cdcd9a380eef1ca2410083d43c58bdb433e0c0b883db73ca32ffd'},
  {name:'child-stewardship-restore-registry.sql',digest:'601d7689bd4dbf70facecc0a9edef87251dd0571b11866baa4173adc946e6599'},
  {name:'child-stewardship-outbox-hold.sql',digest:'62fae28bdd5d0f7ad95f8839c94f492dbd6266473b417cfef76b466aeccf611b'},
 ]);
 assert.equal(parsed.createsRoles,false);
 await assert.rejects(run(process.execPath,['dist/child-backend/migrate.mjs','--apply-synthetic'],{env:{PATH:process.env.PATH},timeout:5000}));
 const reservation=createServer();await new Promise<void>(resolve=>reservation.listen(0,'127.0.0.1',resolve));const address=reservation.address();assert.ok(address&&typeof address==='object');const port=address.port;await new Promise<void>(resolve=>reservation.close(()=>resolve()));
 await assert.rejects(run(process.execPath,['dist/child-backend/server.mjs'],{timeout:7000,env:{
  PATH:process.env.PATH,PORT:String(port),CHILD_CLOSED_DB_ATTESTATION:'1',
  CHILD_DATABASE_URL:`postgresql://attestor:fixture@127.0.0.1:${port}/test_db`,
  CHILD_CLOSED_DB_EXPECTED_DATABASE:'test_db',CHILD_CLOSED_DB_EXPECTED_ROLE:'attestor',
 }}),error=>typeof error==='object' && error!==null && 'code' in error && error.code===1 &&
  'stderr' in error && typeof error.stderr==='string' && error.stderr.trim()==='{"service":"canopyproof-child-backend","signal":"startup_failed"}');
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

test('closed startup attestation checks effective journal privileges before reading migration rows',async()=>{
 const migrations=Array.from({length:13},(_,i)=>({name:`fixture-${i}`,digest:String(i).padStart(64,'0'),sql:'fixture'}));
 const meta={db:'test_db',actor:'attestor',login:'attestor',tls:true,read_only:true,restricted:true,separate_owner:true};
 for(const journalReadOnly of [true,false]){
  const calls:string[]=[];
  const pool={connect:async()=>({
   query:async(sql:string)=>{
    calls.push(sql);
    if(sql.includes('pg_stat_ssl'))return{rows:[meta]};
    if(sql.includes('has_table_privilege'))return{rows:[{can_read:true,journal_read_only:journalReadOnly}]};
    if(sql.includes('ORDER BY ordinal'))return{rows:migrations.map((m,i)=>({...m,ordinal:i+1}))};
    return{rows:[]};
   },
   release:(destroy:boolean)=>{assert.equal(destroy,true);calls.push('release');},
  })} as unknown as Parameters<typeof attestClosedStartup>[0];
  const checked=attestClosedStartup(pool,{database:'test_db',role:'attestor'},migrations);
  if(journalReadOnly)await checked;else await assert.rejects(checked,/CLOSED_STARTUP_DB_UNVERIFIED/);
  assert.equal(calls.some(sql=>sql.includes('ORDER BY ordinal')),journalReadOnly);
  assert.deepEqual(calls.slice(-2),['ROLLBACK','release']);
 }
});
