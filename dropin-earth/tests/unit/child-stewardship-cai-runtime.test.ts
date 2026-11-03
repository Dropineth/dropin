import assert from 'node:assert/strict';
import test from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createSyntheticRightsFixture} from '../fixtures/child-stewardship-rights.js';
const exec=promisify(execFile);
const source=process.env.CAI_DEEPSEEK_ROOT;
const options={skip:source ? false : 'Explicit CAI_DEEPSEEK_ROOT and pinned Docker image required; no synthetic replacement engine is used.'};
const adapter=()=>import(pathToFileURL(resolve(__dirname,'../../integrations/cai/synthetic-router.mjs')).href);
function fixture(){const f=createSyntheticRightsFixture(),state=f.funded(),operation=f.payment();return {f,state,operation,read:()=>({state,context:f.context})};}

test('actual DeepSeek Engine routes to isolated worker and current synthetic multisig review',options,async()=>{
  const {createSyntheticRouter}=await adapter(),router=await createSyntheticRouter(source);
  const {f,state,operation,read}=fixture(),before=structuredClone(state);
  try {
    const job=router.submit(operation,f.approvals(operation,['g','r1','t']),read,{delayMs:1000});
    const name=await job.began;
    const inspected=JSON.parse((await exec('docker',['inspect',name])).stdout)[0];
    assert.equal(inspected.HostConfig.NetworkMode,'none');
    assert.equal(inspected.HostConfig.ReadonlyRootfs,true);
    assert.equal(inspected.Config.User,'65534:65534');
    assert.deepEqual(inspected.Mounts,[]);
    assert.equal(inspected.Config.Env.some((v:string)=>/DATABASE_URL|PRIVATE_KEY|TOKEN/.test(v)),false);
    const result=await job.done;
    assert.equal(result.status,'ready');assert.equal(result.result.executionEnabled,false);
    assert.equal(result.result.finalAuthority,false);assert.deepEqual(state,before);
    for(const event of ['trigger.received','eval.started','decision.recorded','ticket.created','assignment.started','ticket.ended'])
      assert.ok(router.snapshot().events.includes(event),event);
    await assert.rejects(exec('docker',['inspect',name]));
  }finally{await router.shutdown();}
});

test('current revocation after dispatch defeats a successful worker report',options,async()=>{
  const {createSyntheticRouter}=await adapter(),router=await createSyntheticRouter(source);
  const {f,state,operation,read}=fixture(),before=structuredClone(state);
  try{
    const job=router.submit(operation,f.approvals(operation,['g','r1','t']),read,{delayMs:1000});
    await job.began;f.context.credentials.find(c=>c.keyId==='g')!.revoked=true;
    const result=await job.done;assert.equal(result.status,'rejected');assert.equal(result.result.error,'CREDENTIAL_UNAVAILABLE');assert.deepEqual(state,before);
  }finally{await router.shutdown();}
});

test('child-only payment fails before worker launch; action tampering and Tree Lotto cannot enter',options,async()=>{
  const {createSyntheticRouter}=await adapter(),router=await createSyntheticRouter(source);
  const {f,operation,read}=fixture();
  try{
    const job=router.submit(operation,f.approvals(operation,['c']),read);
    assert.equal((await job.done).result.error,'CHILD_PAYMENT_SIGNATURE_FORBIDDEN');
    assert.equal(await job.began,null);
    assert.equal(router.snapshot().events.includes('assignment.started'),false);
    const signed=f.approvals(operation,['g','r1','t']);operation.amountMinor++;
    assert.equal((await router.submit(operation,signed,read).done).result.error,'INVALID_SIGNATURE');
    assert.throws(()=>router.submit({...operation,operationType:'TREE_LOTTO'},signed,read),/PROTOCOL_UNSUPPORTED/);
  }finally{await router.shutdown();}
});

test('shutdown cancels active and queued jobs, deletes containers and refuses new work',options,async()=>{
  const {createSyntheticRouter}=await adapter(),router=await createSyntheticRouter(source,{maxJobs:3});
  const {f,operation,read}=fixture(),signed=f.approvals(operation,['g','r1','t']);
  try{
    const jobs=[0,1,2].map(()=>router.submit(operation,signed,read,{delayMs:1000}));
    assert.throws(()=>router.submit(operation,signed,read),/WORK_LIMIT/);
    const names=await Promise.all(jobs.slice(0,2).map(j=>j.began));
    await router.shutdown();
    for(const job of jobs)assert.equal((await job.done).status,'cancelled');
    for(const name of names)await assert.rejects(exec('docker',['inspect',name]));
    assert.equal(router.snapshot().running,0);
    assert.throws(()=>router.submit(operation,signed,read),/RUNTIME_CLOSED/);
  }finally{await router.shutdown();}
});

test('bounded worker timeout rejects without a ledger effect or live container',options,async()=>{
  const {createSyntheticRouter}=await adapter(),router=await createSyntheticRouter(source,{timeoutMs:100});
  const {f,state,operation,read}=fixture(),before=structuredClone(state);
  try{
    const job=router.submit(operation,f.approvals(operation,['g','r1','t']),read,{delayMs:1000});
    const name=await job.began,result=await job.done;assert.equal(result.status,'rejected');assert.deepEqual(state,before);
    await assert.rejects(exec('docker',['inspect',name]));
  }finally{await router.shutdown();}
});

test('upstream source bytes must match the pinned MIT source before loading',options,async()=>{
  const {loadPinnedDeepSeek}=await adapter(),root=await mkdtemp(join(tmpdir(),'cai-source-pin-'));
  try{
    await cp(join(source!,'src/core'),join(root,'src/core'),{recursive:true});await cp(join(source!,'LICENSE'),join(root,'LICENSE'));
    for(const file of ['package.json','tsconfig.json'])await cp(join(source!,file),join(root,file));
    const file=join(root,'src/core/engine.ts');await writeFile(file,(await readFile(file,'utf8'))+'\n// tampered\n');
    await assert.rejects(loadPinnedDeepSeek(root),/DEEPSEEK_SOURCE_PIN_MISMATCH/);
  }finally{await rm(root,{recursive:true,force:true});}
});


test('concurrent upstream tickets preserve separate work and operation bindings',options,async()=>{
  const {createSyntheticRouter}=await adapter(),router=await createSyntheticRouter(source);
  const first=fixture(),second=fixture();second.operation.amountMinor=23;
  try{
    const a=router.submit(first.operation,first.f.approvals(first.operation,['g','r1','t']),first.read);
    const b=router.submit(second.operation,second.f.approvals(second.operation,['g','r1','t']),second.read);
    const [ra,rb]=await Promise.all([a.done,b.done]);
    assert.equal(ra.status,'ready');assert.equal(rb.status,'ready');
    assert.equal(ra.result.workId,a.id);assert.equal(rb.result.workId,b.id);
    assert.notEqual(ra.result.operationDigest,rb.result.operationDigest);
    const tickets=router.snapshot().jobs.map((job:{ticketId:string})=>job.ticketId);
    assert.equal(new Set(tickets).size,2);
  }finally{await router.shutdown();}
});

test('actual sandbox rejects unrecognized input instead of treating it as instructions',options,async()=>{
  const {runIsolatedWorker}=await import(pathToFileURL(resolve(__dirname,'../../integrations/cai/docker-worker.mjs')).href);
  await assert.rejects(runIsolatedWorker({workId:`cai-${'a'.repeat(32)}`,operationDigest:'b'.repeat(64),delayMs:0,execute:'PAY_NOW'}));
});
