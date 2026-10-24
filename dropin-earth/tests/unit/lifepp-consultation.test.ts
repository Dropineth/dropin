import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { fetch as transportFetch } from 'undici';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { cleanupInquiries, inquiryStatus, maintainInquiries, parseInquiryConfig, parseSubmittedInquiry, submitInquiry, withdrawInquiry, INQUIRY_RECEIPT_LOOKUP_SQL, type InquiryConfig, type InquiryDatabase, type InquiryRuntime, type InquiryStatement } from '../../apps/web/src/lib/life/inquiry-service';
import { miniflareReceiptReadback, MINIFLARE_RECEIPT_READ_BUDGET_MS, type MiniflareReadbackMetrics } from '../helpers/lifepp-miniflare-readback';

const config: InquiryConfig = { enabled:true, origin:'https://inquiry.example.test', retentionDays:2, policyVersion:'fixture-v1', acceptanceRef:'LOCAL_SYNTHETIC-acceptance', controller:'LOCAL_SYNTHETIC recipient', backupNoticeZh:'本地合成测试，无生产备份声明。', backupNoticeEn:'Local synthetic test; no production backup claim.', hmacKey:'LOCAL_SYNTHETIC-hmac-key-not-a-secret-0000', maintenanceToken:'LOCAL_SYNTHETIC-maintenance-token-0000' };
const inquiry = { name:'LOCAL_SYNTHETIC visitor',organization:'',channel:'email',contact:'test@example.invalid',type:'space',message:'LOCAL_SYNTHETIC consultation test. No real user or recipient.',consent:true };
const makeBody=(overrides:Record<string,unknown>={})=>({inquiry,idempotencyKey:crypto.randomUUID(),policyVersion:config.policyVersion,sendConsent:true,website:'',...overrides});
const request=(data:unknown,headers:Record<string,string>={},method='POST')=>new Request(`${config.origin}/life/inquiries`,{method,headers:{'content-type':'application/json','origin':config.origin,'sec-fetch-site':'same-origin','x-lifepp-inquiry':'1',...headers},body:JSON.stringify(data)});


function describeSyntheticFailure(value:unknown):{name:string;message?:string}{
 if(!(value instanceof Error))return{name:typeof value};
 const redact=(text:string,max:number)=>{
  for(const secret of [config.hmacKey,config.maintenanceToken,...Object.values(inquiry).filter((item):item is string=>typeof item==='string'&&item.length>3)])text=text.split(secret).join('[redacted-fixture-value]');
  return text.replace(/[a-f0-9]{64}/gi,'[redacted-token]').replace(/[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}/gi,'[redacted-id]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[redacted-contact]').replace(/\b(?:SELECT|INSERT|UPDATE|DELETE)\b[\s\S]*/gi,'[redacted-sql]').slice(0,max);
 };
 return{name:redact(value.name,100),message:redact(value.message,1200)};
}

test('consultation defaults closed and rejects incomplete configuration / untrusted schema',async()=>{
 assert.equal(await (await inquiryStatus(null)).text(),'{"mode":"draft"}');
 assert.equal((await submitInquiry(request(makeBody()),null,'192.0.2.1')).status,503);
 assert.equal(parseInquiryConfig({}),null);
 const environment={LIFEPP_INQUIRY_ENABLED:'true',LIFEPP_INQUIRY_SITE_ORIGIN:config.origin,LIFEPP_INQUIRY_RETENTION_DAYS:String(config.retentionDays),LIFEPP_INQUIRY_POLICY_VERSION:config.policyVersion,LIFEPP_INQUIRY_ACCEPTANCE_REF:config.acceptanceRef,LIFEPP_INQUIRY_CONTROLLER:config.controller,LIFEPP_INQUIRY_BACKUP_NOTICE_ZH:config.backupNoticeZh,LIFEPP_INQUIRY_BACKUP_NOTICE_EN:config.backupNoticeEn,LIFEPP_INQUIRY_HMAC_KEY:config.hmacKey,LIFEPP_INQUIRY_MAINTENANCE_TOKEN:config.maintenanceToken};
 assert.deepEqual(parseInquiryConfig(environment),config);
 assert.equal(parseInquiryConfig({...environment,LIFEPP_INQUIRY_ENABLED:undefined})?.enabled,false,'Configuration never enables collection without an explicit server flag');
 for(const overrides of [{LIFEPP_INQUIRY_SITE_ORIGIN:'http://inquiry.example.test'},{LIFEPP_INQUIRY_SITE_ORIGIN:`${config.origin}/path`},{LIFEPP_INQUIRY_RETENTION_DAYS:'0'},{LIFEPP_INQUIRY_RETENTION_DAYS:'31'},{LIFEPP_INQUIRY_CONTROLLER:''},{LIFEPP_INQUIRY_BACKUP_NOTICE_EN:undefined},{LIFEPP_INQUIRY_HMAC_KEY:'short'},{LIFEPP_INQUIRY_MAINTENANCE_TOKEN:config.hmacKey}])assert.equal(parseInquiryConfig({...environment,...overrides}),null);
 for(const value of [null,{},[],makeBody({sendConsent:false}),makeBody({sendConsent:undefined}),makeBody({website:'spam'}),makeBody({inquiry:{...inquiry,consent:false}}),makeBody({inquiry:{...inquiry,message:17}}),makeBody({inquiry:{...inquiry,extra:'smuggled'}}),makeBody({idempotencyKey:'bad'}),makeBody({extra:true})])assert.equal(parseSubmittedInquiry(value),null);
 assert.ok(parseSubmittedInquiry(makeBody()));
});

test('LOCAL_SYNTHETIC D1 persistence, admission, withdrawal and cleanup stay fail-closed',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'lifepp-consultation-'));
 const storageFailures:unknown[]=[];
 let storageFailureCount=0;
 const proxyRecovery:MiniflareReadbackMetrics={retries:0};
 // Synthetic fixture only: capture the original exception without wrapping D1
 // methods or changing their promises, SQL, admission order or concurrency.
 const observeFailure:NonNullable<InquiryRuntime['observeFailure']>=(failure,error)=>{

  storageFailureCount++;
  if(storageFailures.length<32)storageFailures.push({...failure,...describeSyntheticFailure(error),cause:error instanceof Error?describeSyntheticFailure(error.cause):undefined});
 };
 let mf:Miniflare|undefined;
 const open=async()=>{mf=new Miniflare({...convertV4MiniflareOptions({modules:true,script:'export default { fetch() { return new Response("LOCAL_SYNTHETIC"); } };',compatibilityDate:'2026-06-17',d1Databases:{LIFEPP_INQUIRY_DB:'local-synthetic-inquiries'}}),resourcePersistencePath:directory,cf:false,telemetry:{enabled:false}});return await mf.getD1Database('LIFEPP_INQUIRY_DB');};
 const now=Date.now();
 try{
  let db=await open();
  await db.exec((await readFile('apps/web/migrations/life-inquiry/0001_inquiry.sql','utf8')).replace(/--[^\n]*/g,'').replace(/\s+/g,' '));
  let runtime:InquiryRuntime={db:miniflareReceiptReadback(db,proxyRecovery),config,observeFailure};
  assert.equal((await (await inquiryStatus(runtime,now)).json()).mode,'draft','Schema alone cannot activate collection');
  await db.batch([db.prepare("INSERT INTO lifepp_inquiry_control(key,value) VALUES ('acceptance_ref',?)").bind(config.acceptanceRef),db.prepare("INSERT INTO lifepp_inquiry_control(key,value) VALUES ('policy_version',?)").bind(config.policyVersion)]);
  assert.equal((await (await inquiryStatus(runtime,now)).json()).mode,'draft','Missing cleanup heartbeat cannot activate collection');
  assert.equal((await maintainInquiries(new Request(config.origin,{method:'POST'}),runtime,now)).status,401);
  assert.equal((await maintainInquiries(new Request(config.origin,{method:'POST',headers:{authorization:`Bearer ${config.maintenanceToken}`}}),runtime,now)).status,200);
  assert.equal((await (await inquiryStatus(runtime,now)).json()).mode,'receive');
  assert.equal((await (await inquiryStatus({...runtime,config:{...config,enabled:false}},now)).json()).mode,'draft');
  for(const headers of [{origin:'https://attacker.example'},{'sec-fetch-site':'cross-site'},{'x-lifepp-inquiry':'bad'}])assert.equal((await submitInquiry(request(makeBody(),headers),runtime,'192.0.2.1',now)).status,403);
  assert.equal((await submitInquiry(request(makeBody()),runtime,null,now)).status,503);
  assert.equal((await submitInquiry(request(makeBody(),{'content-type':'text/plain'}),runtime,'192.0.2.1',now)).status,400);
  assert.equal((await submitInquiry(request({x:'a'.repeat(9000)}),runtime,'192.0.2.1',now)).status,400);
  assert.equal((await submitInquiry(request(makeBody({policyVersion:'old'})),runtime,'192.0.2.1',now)).status,409);
  assert.equal((await submitInquiry(request(makeBody({sendConsent:false})),runtime,'192.0.2.1',now)).status,400);
  assert.equal((await submitInquiry(request(makeBody({sendConsent:undefined})),runtime,'192.0.2.1',now)).status,400);
  const payload=makeBody();
  const first=await submitInquiry(request(payload),runtime,'192.0.2.1',now);assert.equal(first.status,201);
  const receipt=await first.json();assert.equal(receipt.status,'stored');assert.equal(receipt.duplicate,false);
  const duplicate=await submitInquiry(request(payload),runtime,'192.0.2.1',now);assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).receiptId,receipt.receiptId);
  assert.equal((await submitInquiry(request({...payload,inquiry:{...inquiry,message:'Different LOCAL_SYNTHETIC payload.'}}),runtime,'192.0.2.1',now)).status,409);
  const updatedPolicy='fixture-v2';
  await db.prepare("UPDATE lifepp_inquiry_control SET value=? WHERE key='policy_version'").bind(updatedPolicy).run();
  assert.equal((await submitInquiry(request({...payload,policyVersion:updatedPolicy}),{db,config:{...config,policyVersion:updatedPolicy}},'192.0.2.1',now)).status,409,'A different consent policy cannot silently reuse an old-policy receipt');
  await db.prepare("UPDATE lifepp_inquiry_control SET value=? WHERE key='policy_version'").bind(config.policyVersion).run();
  assert.equal((await submitInquiry(request(makeBody()),runtime,'192.0.2.1',now)).status,201);
  assert.equal((await submitInquiry(request(makeBody()),runtime,'192.0.2.1',now)).status,201);
  for(let i=0;i<6;i++)assert.equal((await submitInquiry(request(makeBody()),runtime,'192.0.2.1',now)).status,429);
  assert.equal((await db.prepare('SELECT count FROM lifepp_inquiry_limits WHERE bucket=?').bind(`global:${Math.floor(now/3_600_000)}`).first())?.count,3,'Rejected client requests and duplicate retries cannot consume the global budget');
  const row=await db.prepare('SELECT * FROM lifepp_inquiries WHERE id=?').bind(receipt.receiptId).first();assert.ok(row);assert.match(String(row.body),/LOCAL_SYNTHETIC/);assert.equal('ip' in row,false);assert.equal(row.send_consent,1);assert.equal(String(row.withdrawal_hash).includes(receipt.withdrawalToken),false);
  await mf!.dispose();db=await open();runtime={db:miniflareReceiptReadback(db,proxyRecovery),config,observeFailure};
  const reopened=await db.prepare('SELECT body FROM lifepp_inquiries WHERE id=?').bind(receipt.receiptId).first();assert.equal(reopened?.body,row.body,'Actual local D1 persists after runtime restart');
  assert.equal((await withdrawInquiry(request({receiptId:receipt.receiptId,withdrawalToken:'0'.repeat(64)},{},'DELETE'),runtime)).status,403);
  assert.equal((await withdrawInquiry(request({receiptId:receipt.receiptId,withdrawalToken:receipt.withdrawalToken},{},'DELETE'),runtime)).status,200);
  assert.equal(await db.prepare('SELECT id FROM lifepp_inquiries WHERE id=?').bind(receipt.receiptId).first(),null);
  const withdrawnRetry=await submitInquiry(request(payload),runtime,'192.0.2.1',now);assert.equal(withdrawnRetry.status,409);assert.equal((await withdrawnRetry.json()).error,'withdrawn','Old retries cannot recreate withdrawn personal data');
  const withdrawalMarker=await db.prepare('SELECT * FROM lifepp_inquiry_withdrawals').first();assert.ok(withdrawalMarker);assert.deepEqual(Object.keys(withdrawalMarker).sort(),['expires_at','idempotency_key']);assert.equal(withdrawalMarker.expires_at,row.expires_at);
  const second=await submitInquiry(request(makeBody()),runtime,'192.0.2.2',now);assert.equal(second.status,201);
  const concurrent=await Promise.all(Array.from({length:8},()=>submitInquiry(request(makeBody()),runtime,'192.0.2.9',now)));
  assert.equal(concurrent.filter(response=>response.status===201).length,3,'Atomic distributed budget admits at most three concurrent new submissions');
  assert.equal(concurrent.filter(response=>response.status===429).length,5);
  const repeatedPayload=makeBody();
  const repeated=await Promise.all(Array.from({length:8},()=>submitInquiry(request(repeatedPayload),runtime,'192.0.2.10',now)));
  assert.equal(repeated.filter(response=>response.status===201).length,1,'Concurrent identical requests create one stored record');
  assert.equal(repeated.filter(response=>response.status===200).length,7);
  const repeatedReceipts=await Promise.all(repeated.map(response=>response.json()));
  assert.equal(new Set(repeatedReceipts.map(receipt=>receipt.receiptId)).size,1);
  const admitted=Number((await db.prepare('SELECT count FROM lifepp_inquiry_limits WHERE bucket=?').bind(`global:${Math.floor(now/3_600_000)}`).first())?.count);
  const remaining=100-admitted;
  const globalAdmission=await Promise.all(Array.from({length:remaining+5},(_,index)=>submitInquiry(request(makeBody()),runtime,`192.0.3.${index+1}`,now)));
  const statuses:Record<string,number>={},errors:Record<string,number>={};
  for(const response of globalAdmission){statuses[response.status]=(statuses[response.status]??0)+1;const result=await response.clone().json();if(result.error)errors[result.error]=(errors[result.error]??0)+1;}
  t.diagnostic(JSON.stringify({case:'global-concurrent-admission',admittedBefore:admitted,expectedNew:remaining,statuses,errors,proxyReceiptReadRetries:proxyRecovery.retries,proxyReceiptReadExhaustions:proxyRecovery.exhausted??0,proxyReceiptReadDeadlines:proxyRecovery.deadlines??0,storageFailures,storageFailureCount,storageFailuresTruncated:storageFailureCount>storageFailures.length,globalCounter:(await db.prepare('SELECT count FROM lifepp_inquiry_limits WHERE bucket=?').bind(`global:${Math.floor(now/3_600_000)}`).first())?.count,storedCount:(await db.prepare('SELECT COUNT(*) AS count FROM lifepp_inquiries').first())?.count}));
  assert.equal(globalAdmission.filter(response=>response.status===201).length,remaining,'Concurrent distinct clients cannot exceed the global hourly budget');
  assert.equal(globalAdmission.filter(response=>response.status===429).length,5);
  assert.equal((await submitInquiry(request(repeatedPayload),runtime,'192.0.2.10',now)).status,200,'Existing receipt retries remain available after the global budget is exhausted');
  assert.equal((await (await inquiryStatus(runtime,now+3_600_001)).json()).mode,'draft','Stale cleanup stops new collection');
  assert.equal((await submitInquiry(request(makeBody()),runtime,'192.0.2.3',now+3_600_001)).status,503);
  await cleanupInquiries(runtime,now+3*86_400_000);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM lifepp_inquiries').first<{count:number}>())?.count,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM lifepp_inquiry_limits').first<{count:number}>())?.count,0);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM lifepp_inquiry_withdrawals').first<{count:number}>())?.count,0,'Minimal withdrawal markers expire with the original retention period');
  await db.exec('DROP TABLE lifepp_inquiries');
  assert.equal((await (await inquiryStatus(runtime,now+3*86_400_000)).json()).mode,'draft','Missing storage cannot advertise receiving');
  assert.equal((await submitInquiry(request(makeBody()),runtime,'192.0.2.3',now+3*86_400_000)).status,503,'Failed persistence never returns success');
 }finally{await mf?.dispose();await rm(directory,{recursive:true,force:true});}
});

test('LOCAL_SYNTHETIC inquiry failure observation cannot manufacture receipts or repeat effects',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'lifepp-consultation-faults-'));
 const mf=new Miniflare({...convertV4MiniflareOptions({modules:true,script:'export default { fetch() { return new Response("LOCAL_SYNTHETIC"); } };',compatibilityDate:'2026-06-17',d1Databases:{LIFEPP_INQUIRY_DB:'local-synthetic-faults'}}),resourcePersistencePath:directory,cf:false,telemetry:{enabled:false}});
 const now=Date.now();
 try{
  const db=await mf.getD1Database('LIFEPP_INQUIRY_DB');
  await db.exec((await readFile('apps/web/migrations/life-inquiry/0001_inquiry.sql','utf8')).replace(/--[^\n]*/g,'').replace(/\s+/g,' '));
  await db.batch([db.prepare("INSERT INTO lifepp_inquiry_control(key,value) VALUES ('acceptance_ref',?)").bind(config.acceptanceRef),db.prepare("INSERT INTO lifepp_inquiry_control(key,value) VALUES ('policy_version',?)").bind(config.policyVersion)]);
  const healthy:InquiryRuntime={db,config};
  await cleanupInquiries(healthy,now);
  const counts=async()=>({rows:Number((await db.prepare('SELECT COUNT(*) AS count FROM lifepp_inquiries').first())?.count),global:Number((await db.prepare('SELECT count FROM lifepp_inquiry_limits WHERE bucket=?').bind(`global:${Math.floor(now/3_600_000)}`).first())?.count??0)});
  const unavailable=async(response:Response)=>{assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'unavailable'});};
  const failure=new Error('LOCAL_SYNTHETIC provider detail must never reach the HTTP response');
  const observed:{stage:string;error:unknown;code:string}[]=[];
  const observeFailure:NonNullable<InquiryRuntime['observeFailure']>=(metadata,error)=>{observed.push({...metadata,error});};

  await t.test('pre-commit failure leaves no rows or quota and preserves the original error',async()=>{
   const payload=makeBody();
   const faultDb:InquiryDatabase={prepare:sql=>db.prepare(sql),batch:()=>{throw failure;}};
   await unavailable(await submitInquiry(request(payload),{db:faultDb,config,observeFailure},'192.0.4.1',now));
   assert.deepEqual(await counts(),{rows:0,global:0});
   assert.deepEqual(observed.at(-1),{code:'INQUIRY_UNAVAILABLE',stage:'admission',error:failure});
   assert.equal((await submitInquiry(request(payload),healthy,'192.0.4.1',now)).status,201);
   assert.deepEqual(await counts(),{rows:1,global:1});
  });

  await t.test('post-commit readback failure returns503 and a same-key retry reads one durable receipt',async()=>{
   const payload=makeBody();
   const faultDb:InquiryDatabase={prepare:sql=>{if(sql.startsWith('SELECT id,fingerprint,expires_at'))throw failure;return db.prepare(sql);},batch:statements=>db.batch(statements)};
   await unavailable(await submitInquiry(request(payload),{db:faultDb,config,observeFailure},'192.0.4.2',now));
   assert.deepEqual(await counts(),{rows:2,global:2});
   assert.deepEqual(observed.at(-1),{code:'INQUIRY_UNAVAILABLE',stage:'receipt-readback',error:failure});
   const retry=await submitInquiry(request(payload),healthy,'192.0.4.2',now);
   assert.equal(retry.status,200);const receipt=await retry.json();assert.equal(receipt.duplicate,true);
   assert.ok(await db.prepare('SELECT id FROM lifepp_inquiries WHERE id=?').bind(receipt.receiptId).first());
   assert.deepEqual(await counts(),{rows:2,global:2},'Uncertain completion cannot consume the budget twice');
  });

  await t.test('a lost batch response does not imply rollback or permit another insertion',async()=>{
   const payload=makeBody();
   const faultDb:InquiryDatabase={prepare:sql=>db.prepare(sql),batch:async statements=>{await db.batch(statements);throw failure;}};
   await unavailable(await submitInquiry(request(payload),{db:faultDb,config,observeFailure},'192.0.4.3',now));
   assert.deepEqual(await counts(),{rows:3,global:3});
   assert.equal(observed.at(-1)?.stage,'admission');
   assert.equal((await submitInquiry(request(payload),healthy,'192.0.4.3',now)).status,200);
   assert.deepEqual(await counts(),{rows:3,global:3});
  });

  await t.test('throwing and rejecting observers cannot change503 or storage',async()=>{
   const faultDb:InquiryDatabase={prepare:sql=>db.prepare(sql),batch:()=>{throw failure;}};
   for(const observer of [()=>{throw new Error('LOCAL_SYNTHETIC observer failure');},()=>Promise.reject(new Error('LOCAL_SYNTHETIC async observer failure'))]){
    await unavailable(await submitInquiry(request(makeBody()),{db:faultDb,config,observeFailure:observer},'192.0.4.4',now));
   }
   await new Promise(resolve=>setImmediate(resolve));
   assert.deepEqual(await counts(),{rows:3,global:3});
  });

  await t.test('successful receipt creation does not invoke the observer',async()=>{
   let calls=0;
   assert.equal((await submitInquiry(request(makeBody()),{db,config,observeFailure:()=>{calls++;}},'192.0.4.5',now)).status,201);
   assert.equal(calls,0);assert.deepEqual(await counts(),{rows:4,global:4});
  });
 }finally{await mf.dispose();await rm(directory,{recursive:true,force:true});}
});

test('synthetic failure diagnostics redact capabilities, payload and nested provider details',()=>{
 const token='ab'.repeat(32),id=crypto.randomUUID(),otherContact='another@example.invalid';
 const values=[config.hmacKey,config.maintenanceToken,inquiry.name,inquiry.contact,inquiry.message,token,id,otherContact];
 const provider=new Error(`D1_ERROR SQLITE_BUSY ${values.join(' | ')}`);
 provider.name=`ProviderError ${token}`;
 const cause=new Error(`SQLITE_BUSY ${values.join(' | ')}`);
 const output=JSON.stringify({error:describeSyntheticFailure(provider),cause:describeSyntheticFailure(cause)});
 for(const value of values)assert.equal(output.includes(value),false);
 assert.match(output,/SQLITE_BUSY/);
 assert.ok((describeSyntheticFailure(new Error('x'.repeat(2000))).message??'').length<=1200);
 assert.equal(describeSyntheticFailure(new Error("D1_ERROR SELECT body FROM private_table WHERE contact='privatevalue'" )).message,'D1_ERROR [redacted-sql]');
 assert.deepEqual(describeSyntheticFailure({payload:'never stringify unknown objects'}),{name:'object'});
});

test('Node D1 proxy retries only one closed-peer receipt read, never admission writes',async t=>{
 const directory=await mkdtemp(join(tmpdir(),'lifepp-proxy-transport-'));
 const peer=createServer(req=>req.socket.destroy());
 await new Promise<void>((resolve,reject)=>{peer.once('error',reject);peer.listen(0,'127.0.0.1',resolve);});
 const address=peer.address();assert.ok(address&&typeof address!=='string');
 const closePeer=async():Promise<never>=>{
  try{await transportFetch(`http://127.0.0.1:${address.port}`,{method:'POST',body:'LOCAL_SYNTHETIC'});}
  catch(error){
   assert.ok(error instanceof TypeError);assert.equal(error.message,'fetch failed');
   assert.ok(error.cause instanceof Error);assert.equal(error.cause.name,'SocketError');
   assert.equal(error.cause.message,'other side closed');assert.equal((error.cause as Error&{code?:string}).code,'UND_ERR_SOCKET');
   throw error;
  }
  throw new Error('LOCAL_SYNTHETIC peer must actually close the transport');
 };
 const mf=new Miniflare({...convertV4MiniflareOptions({modules:true,script:'export default { fetch() { return new Response("LOCAL_SYNTHETIC"); } };',compatibilityDate:'2026-06-17',d1Databases:{LIFEPP_INQUIRY_DB:'local-synthetic-proxy-recovery'}}),resourcePersistencePath:directory,cf:false,telemetry:{enabled:false}});
 const now=Date.now();
 try{
  const db=await mf.getD1Database('LIFEPP_INQUIRY_DB');
  await db.exec((await readFile('apps/web/migrations/life-inquiry/0001_inquiry.sql','utf8')).replace(/--[^\n]*/g,'').replace(/\s+/g,' '));
  await db.batch([db.prepare("INSERT INTO lifepp_inquiry_control(key,value) VALUES ('acceptance_ref',?)").bind(config.acceptanceRef),db.prepare("INSERT INTO lifepp_inquiry_control(key,value) VALUES ('policy_version',?)").bind(config.policyVersion)]);
  const healthy:InquiryRuntime={db,config};await cleanupInquiries(healthy,now);
  const counts=async()=>({rows:Number((await db.prepare('SELECT COUNT(*) AS count FROM lifepp_inquiries').first())?.count),global:Number((await db.prepare('SELECT count FROM lifepp_inquiry_limits WHERE bucket=?').bind(`global:${Math.floor(now/3_600_000)}`).first())?.count??0)});
  const faultPort=(options:{failures?:number;permanent?:Error;batch?:boolean;prepare?:Error;bind?:Error;query?:string;afterRead?:(attempt:number)=>void;beforePrepare?:(attempt:number)=>void;holdRead?:()=>Promise<void>})=>{
   let remaining=options.failures??0,prepares=0;const calls={reads:0,batches:0};
   const wrap=(statement:InquiryStatement):InquiryStatement=>({
    bind:(...values)=>{if(options.bind)throw options.bind;return wrap(statement.bind(...values));},
    async first<T>(){calls.reads++;try{if(options.permanent)throw options.permanent;if(remaining-->0)return await closePeer();const result=await statement.first<T>();await options.holdRead?.();return result;}finally{options.afterRead?.(calls.reads);}},
    all:<T>()=>statement.all<T>(),run:()=>statement.run(),
   });
   const port:InquiryDatabase={
    prepare(sql){if(sql!==(options.query??INQUIRY_RECEIPT_LOOKUP_SQL))return db.prepare(sql);options.beforePrepare?.(++prepares);if(options.prepare)throw options.prepare;return wrap(db.prepare(sql));},
    batch(statements){calls.batches++;return options.batch?closePeer():db.batch(statements);},
   };
   return{port,calls};
  };
  const unavailable=async(response:Response)=>{assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'unavailable'});};

  await t.test('an actual closed socket is recovered by one read of the persisted receipt',async()=>{
   const payload=makeBody(),fault=faultPort({failures:1}),metrics={retries:0};
   const response=await submitInquiry(request(payload),{db:miniflareReceiptReadback(fault.port,metrics),config},'192.0.5.1',now);
   assert.equal(response.status,201);const receipt=await response.json();
   assert.ok(await db.prepare('SELECT id FROM lifepp_inquiries WHERE id=?').bind(receipt.receiptId).first());
   assert.deepEqual(fault.calls,{reads:2,batches:1});assert.equal(metrics.retries,1);assert.deepEqual(await counts(),{rows:1,global:1});
   const retry=await submitInquiry(request(payload),healthy,'192.0.5.1',now);assert.equal(retry.status,200);assert.equal((await retry.json()).receiptId,receipt.receiptId);
   assert.deepEqual(await counts(),{rows:1,global:1});
  });
  await t.test('two real socket failures exhaust the budget and preserve503 plus one committed row',async()=>{
   const payload=makeBody(),fault=faultPort({failures:2}),metrics={retries:0};
   await unavailable(await submitInquiry(request(payload),{db:miniflareReceiptReadback(fault.port,metrics),config},'192.0.5.2',now));
   assert.deepEqual(fault.calls,{reads:2,batches:1});assert.equal(metrics.retries,1);assert.deepEqual(await counts(),{rows:2,global:2});
   assert.equal((await submitInquiry(request(payload),healthy,'192.0.5.2',now)).status,200);assert.deepEqual(await counts(),{rows:2,global:2});
  });
  await t.test('the unwrapped port still returns503 for the same real socket failure',async()=>{
   const payload=makeBody(),fault=faultPort({failures:1});
   await unavailable(await submitInquiry(request(payload),{db:fault.port,config},'192.0.5.3',now));
   assert.deepEqual(fault.calls,{reads:1,batches:1});assert.deepEqual(await counts(),{rows:3,global:3});
   assert.equal((await submitInquiry(request(payload),healthy,'192.0.5.3',now)).status,200);assert.deepEqual(await counts(),{rows:3,global:3});
  });
  await t.test('permanent SQL errors and mismatched transport errors are not retried',async()=>{
   const errors=[new Error('D1_ERROR SQLITE_ERROR'),new TypeError('fetch failed'),new TypeError('fetch failed',{cause:Object.assign(new Error('other side closed'),{name:'SocketError',code:'OTHER_CODE'})})];
   for(let index=0;index<errors.length;index++){
    const fault=faultPort({permanent:errors[index]}),metrics={retries:0};
    await unavailable(await submitInquiry(request(makeBody()),{db:miniflareReceiptReadback(fault.port,metrics),config},`192.0.5.${4+index}`,now));
    assert.deepEqual(fault.calls,{reads:1,batches:1});assert.equal(metrics.retries,0);
   }
   assert.deepEqual(await counts(),{rows:6,global:6});
  });
  await t.test('a batch socket failure is never replayed by the read adapter',async()=>{
   const fault=faultPort({batch:true}),metrics={retries:0};
   await unavailable(await submitInquiry(request(makeBody()),{db:miniflareReceiptReadback(fault.port,metrics),config},'192.0.5.7',now));
   assert.deepEqual(fault.calls,{reads:0,batches:1});assert.equal(metrics.retries,0);assert.deepEqual(await counts(),{rows:6,global:6});
  });
  await t.test('other SELECTs and receipt prepare/bind errors remain fail-closed without recovery',async()=>{
   const fault=faultPort({failures:1,query:'SELECT id FROM lifepp_inquiries LIMIT 1'}),metrics={retries:0};
   await assert.rejects(miniflareReceiptReadback(fault.port,metrics).prepare('SELECT id FROM lifepp_inquiries LIMIT 1').first(),{name:'TypeError',message:'fetch failed'});
   assert.deepEqual(fault.calls,{reads:1,batches:0});assert.equal(metrics.retries,0);
   const socketError=await closePeer().catch((error:Error)=>error);
   for(const option of [{prepare:socketError},{bind:socketError}]){
    const failed=faultPort(option),recovery={retries:0};
    await unavailable(await submitInquiry(request(makeBody()),{db:miniflareReceiptReadback(failed.port,recovery),config},'192.0.5.8',now));
    assert.deepEqual(failed.calls,{reads:0,batches:1});assert.equal(recovery.retries,0);
   }
   assert.deepEqual(await counts(),{rows:8,global:8});
  });
  await t.test('expired monotonic budgets never start another read or accept a late positive row',async()=>{
   for(const [index,scenario] of ['before-first','closed-peer','first-positive','retry-positive','retry-prepare'].entries()){
    let elapsed=0,clockCalls=0;
    const fault=faultPort({failures:['closed-peer','retry-positive','retry-prepare'].includes(scenario)?1:0,beforePrepare:attempt=>{if(scenario==='retry-prepare'&&attempt===2)elapsed=MINIFLARE_RECEIPT_READ_BUDGET_MS;},afterRead:attempt=>{
     if(scenario==='closed-peer'||scenario==='first-positive'||(scenario==='retry-positive'&&attempt===2))elapsed=MINIFLARE_RECEIPT_READ_BUDGET_MS;
    }}),metrics={retries:0},payload=makeBody();
    const clock=()=>{clockCalls++;return scenario==='before-first'&&clockCalls>1?MINIFLARE_RECEIPT_READ_BUDGET_MS:elapsed;};
    const seen:string[]=[];
    await unavailable(await submitInquiry(request(payload),{db:miniflareReceiptReadback(fault.port,metrics,clock),config,observeFailure:(_metadata,error)=>{seen.push((error as Error).message);}},`192.0.6.${index+1}`,now));
    assert.deepEqual(seen,['MINIFLARE_RECEIPT_READ_DEADLINE']);
    assert.equal(fault.calls.batches,1);
    assert.equal(fault.calls.reads,scenario==='before-first'?0:scenario==='retry-positive'?2:1);
    assert.equal(metrics.retries,scenario==='retry-positive'||scenario==='retry-prepare'?1:0);
    assert.deepEqual(await counts(),{rows:9+index,global:9+index});
    assert.equal((await submitInquiry(request(payload),healthy,`192.0.6.${index+1}`,now)).status,200);
    assert.deepEqual(await counts(),{rows:9+index,global:9+index},'Late read rejection cannot repeat the committed admission');
   }
  });
  await t.test('a pending async read times out without an overlapping retry or late success',{timeout:15_000},async()=>{
   const socketError=await closePeer().catch((error:Error)=>error);
   const pending=['never-during-budget','late-resolve','late-reject'].map((scenario,index)=>{
    let resolve!:()=>void,reject!:(error:Error)=>void;
    const gate=new Promise<void>((yes,no)=>{resolve=yes;reject=no;});
    const fault=faultPort({holdRead:()=>gate}),metrics={retries:0},payload=makeBody(),ip=`192.0.7.${index+1}`;
    return{scenario,resolve,reject,fault,metrics,payload,ip,response:submitInquiry(request(payload),{db:miniflareReceiptReadback(fault.port,metrics),config},ip,now)};
   });
   const started=performance.now();
   try{
    const responses=await Promise.all(pending.map(item=>item.response));
    assert.ok(performance.now()-started>=MINIFLARE_RECEIPT_READ_BUDGET_MS-50,'The actual timer budget elapsed; this is not an immediate all-deny stub');
    for(const response of responses)await unavailable(response);
    for(const item of pending){assert.deepEqual(item.fault.calls,{reads:1,batches:1});assert.equal(item.metrics.retries,0);}
    assert.deepEqual(await counts(),{rows:16,global:16});
    pending[0].resolve();pending[1].resolve();pending[2].reject(socketError);
    await new Promise(resolve=>setImmediate(resolve));
    for(const item of pending){assert.equal(item.fault.calls.reads,1);assert.equal(item.metrics.retries,0);}
    for(const item of pending)assert.equal((await submitInquiry(request(item.payload),healthy,item.ip,now)).status,200);
    assert.deepEqual(await counts(),{rows:16,global:16},'Late outcomes cannot duplicate committed admissions');
   }finally{for(const item of pending)item.resolve();await new Promise(resolve=>setImmediate(resolve));}
  });
 }finally{
  await mf.dispose();peer.closeAllConnections();await new Promise<void>(resolve=>peer.close(()=>resolve()));await rm(directory,{recursive:true,force:true});
 }
});
