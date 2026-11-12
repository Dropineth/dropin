import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import test from 'node:test';
import {PostgresChildStore,type ChildSqlClient,type ChildSqlConnection} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {PostgresChildResumeStore} from '../../services/api/src/domain/child-stewardship/resume-store.js';
import {childDigest,stableJson} from '../../services/api/src/domain/child-stewardship/store.js';
import {currentAuthorityClient,type CurrentAuthority} from '../../services/api/src/child-backend/current-authority.js';

type Operation='draft'|'suspend'|'resume';
const operations:Operation[]=['draft','suspend','resume'];
// Real adapters and nonce-bound Ed25519 verification; SQL is an explicit
// transactional seam, not a native PostgreSQL/row-lock or live-service claim.
function fixture(operation:Operation) {
  const sessionId=randomUUID(),moment=Date.now(),audience='canopyproof:synthetic:capability-commit';
  const root=generateKeyPairSync('ed25519');
  const authority:CurrentAuthority={anchor:{checkpointId:'fixture-checkpoint',sequence:1,digest:'a'.repeat(64),sessionId,keyRegistryVersion:'fixture-v1'},
    registry:{version:'fixture-v1',keys:(['protection','trustee'] as const).map((role,i)=>({keyId:`key-${i}`,role,controlDomain:`domain-${i}`,
      independentOfOperator:true,revoked:false,publicKey:generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString(),
      validAfter:new Date(moment-1000).toISOString(),expiresAt:new Date(moment+60_000).toISOString()}))}};
  const original=structuredClone(authority),registryDigest=childDigest(authority.registry);
  const events:string[]=[],nonces:string[]=[];
  let state={issued:0,consumed:false,generation:0},commits=0,rollbacks=0,quota=0;
  let offline=false,issuerNow=moment,deny=false,sqlFailure=false,afterWrite=()=>{};
  const read=currentAuthorityClient({url:'https://authority.synthetic.invalid/current',audience,now:()=>moment,
    publicKey:root.publicKey.export({type:'spki',format:'pem'}).toString(),fetch:async(_url,init)=>{
      const request=JSON.parse(String(init?.body));events.push('authority');nonces.push(request.nonce);
      assert.equal(request.sessionId,sessionId);assert.equal(request.audience,audience);assert.equal(request.environment,'SIMULATION_ONLY');
      if(offline)throw new Error('private fixture failure');
      const payload={...request,...authority,issuedAt:new Date(issuerNow).toISOString(),expiresAt:new Date(issuerNow+20_000).toISOString()};
      return Response.json({payload,signature:sign(null,Buffer.from(stableJson(payload)),root.privateKey).toString('base64url')});
    }});
  const rawDemo=`cp-demo.${'a'.repeat(43)}`,rawTicket=`cp-resume.${'b'.repeat(43)}`;
  const result=operation==='draft'?`cp-upload.${'c'.repeat(43)}`:operation==='suspend'
    ?{resumeTicket:rawTicket,sessionId,expiresAt:new Date(moment+60_000).toISOString(),syntheticOnly:true}
    :{sessionId,expiresAt:new Date(moment+60_000).toISOString(),syntheticOnly:true,identityVerified:false,
      tokens:Object.fromEntries(['guardian','child','reviewer','protector','operator'].map(role=>[role,rawDemo]))};
  const db:ChildSqlConnection={async query<T extends Record<string,unknown>>(sql:string,values:unknown[]=[]):Promise<T[]> {
    let rows:Record<string,unknown>[];
    if(sql.includes('to_regprocedure'))rows=[{installed:true,anchor_function:true,lookup:true,restore:true,anchor:true}];
    else if(sql.includes('consume_child_capability_limit')){quota++;rows=[{status:'allowed'}];}
    else if(sql.includes('cancel_synthetic_resume')){state.consumed=true;events.push('cancel');rows=[{result:{cancelled:true,syntheticOnly:true}}];}
    else if(sql.includes('resume_capability_session')||sql.startsWith('SELECT session_id::text FROM child_stewardship.session_tokens'))rows=[{session_id:sessionId}];
    else if(sql.startsWith('SELECT set_config'))rows=[];
    else if(sql.startsWith('SELECT id FROM child_stewardship.sessions'))rows=[{id:sessionId}];
    else if(sql.includes(' AS permitted'))rows=[{permitted:values[0]===sessionId&&values[1]===original.anchor.checkpointId&&values[2]===original.anchor.sequence&&values[3]===original.anchor.digest}];
    else if(sql.includes(' AS current'))rows=[{current:values[0]===sessionId&&values[1]===registryDigest&&Date.parse(String(values[2]))>moment}];
    else if(sql.includes('issue_draft_authorization')||sql.includes('suspend_synthetic_session')||sql.includes('resume_synthetic_session')){
      events.push('write');if(sqlFailure)throw new Error('fixture SQL failure');
      // Match the important SQL distinction: a denied identified resume ticket
      // is consumed without minting; that negative result must still commit.
      if(deny){if(operation==='resume')state.consumed=true;rows=operation==='draft'?[{token:null}]:[{result:{denied:true}}];}
      else{state={issued:state.issued+1,consumed:operation==='resume',generation:state.generation+(operation==='suspend'?1:0)};rows=operation==='draft'?[{token:result}]:[{result}];}
      await Promise.resolve();afterWrite();
    }else throw new Error(`Unexpected fixture SQL: ${sql}`);
    return rows as T[];
  }};
  const client:ChildSqlClient={query:db.query,async transaction<T>(run:(db:ChildSqlConnection)=>Promise<T>):Promise<T>{
    const before=structuredClone(state);
    try{const result=await run(db);commits++;events.push('commit');return result;}
    catch(error){state=before;rollbacks++;events.push('rollback');throw error;}
  }};
  const anchor=async(id:string)=>{const current=await read(id);return {...current.anchor,registryDigest:childDigest(current.registry),authorityExpiresAt:current.expiresAt};};
  const store=new PostgresChildStore(client,anchor),resume=new PostgresChildResumeStore(client,anchor);
  const execute=()=>operation==='draft'?store.issueDraftAuthorization(rawDemo,{syntheticProposal:true}):operation==='suspend'?resume.suspend(rawDemo):resume.resume(rawTicket);
  return {execute,result,events,nonces,authority,get state(){return state;},get commits(){return commits;},get rollbacks(){return rollbacks;},get quota(){return quota;},
    changeAfterWrite(fn:()=>void){afterWrite=fn;},outage(){offline=true;},stale(){issuerNow=moment-30_000;},deny(){deny=true;},failSql(){sqlFailure=true;},
    cancel:()=>resume.cancel(rawTicket),recover(){offline=false;issuerNow=moment;afterWrite=()=>{};Object.assign(authority,structuredClone(original));},
  };
}

for(const operation of operations)test(`${operation}: fresh authority must pass after successful tentative capability writes`,async()=>{
  const f=fixture(operation);assert.deepEqual(await f.execute(),f.result);
  assert.deepEqual(f.events,['authority','write','authority','commit']);assert.equal(new Set(f.nonces).size,2);
  assert.equal(f.state.issued,1);assert.equal(f.commits,1);
});

for(const operation of operations)test(`${operation}: observed late authority changes roll back capability issuance`,async t=>{
  const faults={revocation:(f:ReturnType<typeof fixture>)=>{f.authority.registry.keys[1]!.revoked=true;},outage:(f:ReturnType<typeof fixture>)=>f.outage(),
    'restore floor':(f:ReturnType<typeof fixture>)=>{f.authority.anchor.sequence++;},
    'same-id key rotation':(f:ReturnType<typeof fixture>)=>{f.authority.registry.keys[1]!.publicKey=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString();},
    'expired response':(f:ReturnType<typeof fixture>)=>f.stale()};
  for(const [name,fault] of Object.entries(faults))await t.test(name,async()=>{
    const f=fixture(operation);f.changeAfterWrite(()=>fault(f));
    await assert.rejects(f.execute(),error=>error instanceof Error&&error.message==='RESTORATION_UNVERIFIED');
    assert.deepEqual(f.events,['authority','write','authority','rollback']);assert.equal(new Set(f.nonces).size,2);
    assert.deepEqual(f.state,{issued:0,consumed:false,generation:0});assert.equal(f.commits,0);assert.equal(f.rollbacks,1);
    assert.equal(f.quota,operation==='draft'?0:1,'out-of-transaction abuse quota is not refunded by rollback');
    f.recover();assert.deepEqual(await f.execute(),f.result);assert.equal(f.commits,1);assert.equal(f.state.issued,1);
  });
});

test('SQL-denied resume commits identified-ticket consumption even when positive authority is then unavailable',async()=>{
  const f=fixture('resume');f.deny();f.changeAfterWrite(()=>f.outage());
  await assert.rejects(f.execute(),/UNAUTHORIZED/);
  assert.deepEqual(f.events,['authority','write','commit']);assert.equal(f.commits,1);assert.equal(f.rollbacks,0);
  assert.deepEqual(f.state,{issued:0,consumed:true,generation:0});assert.equal(f.nonces.length,1);
});

test('SQL-denied draft/suspension do not mint a capability; cancellation needs no positive authority',async()=>{
  for(const operation of ['draft','suspend'] as const){
    const f=fixture(operation);f.deny();f.changeAfterWrite(()=>f.outage());
    await assert.rejects(f.execute(),operation==='draft'?/CURRENT_DRAFT_AUTHORIZATION_REQUIRED/:/UNAUTHORIZED/);
    assert.equal(f.state.issued,0);assert.equal(f.nonces.length,1);
    assert.equal(f.commits,operation==='draft'?0:1);
  }
  const f=fixture('resume');f.outage();assert.deepEqual(await f.cancel(),{cancelled:true,syntheticOnly:true});
  assert.deepEqual(f.events,['cancel']);assert.equal(f.nonces.length,0);assert.equal(f.state.consumed,true);
});

test('initial authority and SQL failures release no capability and never retry',async()=>{
  for(const operation of operations){
    const closed=fixture(operation);closed.outage();await assert.rejects(closed.execute(),/RESTORATION_UNVERIFIED/);
    assert.deepEqual(closed.events,['authority','rollback']);assert.equal(closed.state.issued,0);
    const failed=fixture(operation);failed.failSql();await assert.rejects(failed.execute(),/fixture SQL failure/);
    assert.deepEqual(failed.events,['authority','write','rollback']);assert.equal(failed.state.issued,0);
  }
});
