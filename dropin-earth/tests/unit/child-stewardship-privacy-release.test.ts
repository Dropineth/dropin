import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import test from 'node:test';
import {PostgresChildStore,type ChildSqlClient,type ChildSqlConnection,type ChildRestoreAnchorProvider} from '../../services/api/src/domain/child-stewardship/postgres-store.js';

const session='00000000-0000-4000-8000-000000000001';
const principal={actorId:'demo-guardian',deviceId:'demo-device-guardian',epoch:1};
const authorization={guardianToken:'cp-guardian.'+'a'.repeat(43)};
type Stage='job'|'guardian'|'object';
type Fault='outage'|'anchor'|'registry'|'malformed';
/** In-memory SQL seam: exercises the actual adapter and authority gates, not PostgreSQL isolation. */
function fixture(options:{stage?:Stage;fault?:Fault;expires?:'session'|'actor'|'export';finalWait?:()=>void;kind?:string;suppressed?:boolean;missing?:boolean}={}){
  const base=Date.now(),now=new Date(base).toISOString(),events:string[]=[];
  let invalid=false,reads=0,committed=false;
  const expiry=(which:string)=>new Date(base+(options.expires===which?5_000:3_600_000));
  const hit=(stage:Stage)=>{events.push(stage);if(options.stage===stage)invalid=true;};
  const db:ChildSqlConnection={async query<T extends Record<string,unknown>>(q:string):Promise<T[]>{
    let rows:unknown[];
    if(q.includes('set_config'))rows=[];
    else if(q.includes('SELECT expires_at FROM child_stewardship.sessions'))rows=[{expires_at:expiry('session')}];
    else if(q.includes("to_regprocedure('child_stewardship.restore_execution_permitted"))rows=[{installed:true,anchor_function:true}];
    else if(q.includes('AS permitted'))rows=[{permitted:!(invalid&&options.fault==='anchor')}];
    else if(q.includes('AS current'))rows=[{current:!(invalid&&options.fault==='registry')}];
    else if(q.includes("to_regclass('child_stewardship.session_resumption'"))rows=[{installed:false}];
    else if(q.includes("collection='actors'"))rows=[{payload:{...principal,deviceIds:[principal.deviceId],revoked:false,expiresAt:expiry('actor').toISOString()}}];
    else if(q.includes('SELECT kind,state,profile_id')){hit('job');rows=[{kind:options.kind??'export_learning',state:'completed',profile_id:'demo-profile'}];}
    else if(q.includes('child_stewardship_guardian.authorize')){hit('guardian');rows=[{identity:{sessionId:session,principal}}];}
    else if(q.includes('privacy_suppressions'))rows=options.suppressed?[{suppressed:true}]:[];
    else if(q.includes('SELECT content,expires_at')){hit('object');rows=options.missing?[]:[{content:Buffer.from('{"only":"synthetic"}'),expires_at:expiry('export')}];}
    else throw new Error('Unexpected SQL: '+q);
    return rows as T[];
  }};
  const client:ChildSqlClient={...db,async transaction<T>(run:(connection:ChildSqlConnection)=>Promise<T>){const value=await run(db);committed=true;return value;}};
  const provider:ChildRestoreAnchorProvider=async()=>{
    reads++;events.push('authority');
    if(reads===2)options.finalWait?.();
    if(invalid&&options.fault==='outage')throw new Error('unavailable');
    return {checkpointId:'checkpoint',sequence:1,digest:invalid&&options.fault==='malformed'?'invalid':'a'.repeat(64),registryDigest:'b'.repeat(64),authorityExpiresAt:new Date(base+3_600_000).toISOString()};
  };
  return {run:()=>new PostgresChildStore(client,provider).privacyResult(session,principal,'request',now,authorization),events,get reads(){return reads;},get committed(){return committed;},base};
}
for(const stage of ['job','guardian','object']as const)for(const fault of ['outage','anchor','registry','malformed']as const){
  test(`privacy export refuses ${fault} after ${stage} read`,async()=>{
    const f=fixture({stage,fault});await assert.rejects(f.run(),/RESTORATION_UNVERIFIED/);
    assert.equal(f.reads,2);assert.equal(f.committed,false);
  });
}
test('privacy export releases authorized bytes only after the final current-authority read',async()=>{
  const f=fixture();assert.deepEqual((await f.run() as {export:unknown}).export,{only:'synthetic'});
  assert.deepEqual(f.events,['authority','job','guardian','object','authority']);assert.equal(f.committed,true);
});
for(const expires of ['session','actor','export']as const)test(`privacy export rechecks ${expires} expiry after the final authority await`,async t=>{
  let clock=Date.now();t.mock.method(Date,'now',()=>clock);
  const f=fixture({expires,finalWait:()=>{clock+=10_000;}});
  await assert.rejects(f.run(),expires==='export'?/EXPORT_UNAVAILABLE/:/UNAUTHORIZED/);assert.equal(f.committed,false);assert.equal(f.reads,2);
});
test('suppressed and missing exports still deny without releasing bytes',async()=>{
  for(const options of [{suppressed:true},{missing:true}]){const f=fixture(options);await assert.rejects(f.run(),options.suppressed?/PRIVACY_SUPPRESSED/:/EXPORT_UNAVAILABLE/);assert.equal(f.committed,false);}
});
test('deletion receipt does not claim erasure or release an export',async()=>{
  const f=fixture({kind:'delete_learning'}),result=await f.run() as {state:string;export?:unknown};
  assert.equal(result.state,'learning_access_withdrawn');assert.equal(result.export,undefined);
});
