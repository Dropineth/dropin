import assert from 'node:assert/strict';
import {generateKeyPairSync,randomUUID,sign} from 'node:crypto';
import test from 'node:test';
import {PostgresGuardianSessions} from '../../services/api/src/domain/child-stewardship/guardian-sessions.js';
import type {ChildSqlClient,ChildSqlConnection} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {childDigest,stableJson} from '../../services/api/src/domain/child-stewardship/store.js';
import {currentAuthorityClient,type CurrentAuthority} from '../../services/api/src/child-backend/current-authority.js';

// Actual adapter, transport codec and Ed25519; in-memory transactional SQL seam.
// This proves ordering/rollback contract, not native PostgreSQL locks or real
// guardian identity. Private fixture keys are ephemeral and never persisted.
function fixture() {
  const sessionId=randomUUID(),bindingId=randomUUID(),root=generateKeyPairSync('ed25519');
  const audience='canopyproof:synthetic:guardian-exchange',moment=Date.now();
  const authority:CurrentAuthority={
    anchor:{checkpointId:'fixture-checkpoint',sequence:1,digest:'a'.repeat(64),sessionId,keyRegistryVersion:'fixture-v1'},
    registry:{version:'fixture-v1',keys:(['protection','trustee'] as const).map((role,i)=>({
      keyId:`key-${i}`,role,controlDomain:`fixture-domain-${i}`,independentOfOperator:true,revoked:false,
      publicKey:generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString(),
      validAfter:new Date(moment-1000).toISOString(),expiresAt:new Date(moment+60_000).toISOString(),
    }))},
  };
  const original=structuredClone(authority),registryDigest=childDigest(authority.registry);
  let state={sessions:0,audit:0,consumed:false},offline=false,issuerNow=moment;
  let afterExchange=()=>{},rejectExchange=false,commits=0,rollbacks=0;
  const events:string[]=[],nonces:string[]=[];
  const read=currentAuthorityClient({url:'https://authority.synthetic.invalid/current',audience,now:()=>moment,
    publicKey:root.publicKey.export({type:'spki',format:'pem'}).toString(),fetch:async(_url,init)=>{
      const request=JSON.parse(String(init?.body));
      events.push('authority');nonces.push(request.nonce);
      if(offline)throw new Error('private upstream failure must not escape');
      assert.equal(request.sessionId,sessionId);assert.equal(request.audience,audience);
      assert.equal(request.environment,'SIMULATION_ONLY');
      const payload={...request,issuedAt:new Date(issuerNow).toISOString(),expiresAt:new Date(issuerNow+20_000).toISOString(),...authority};
      return Response.json({payload,signature:sign(null,Buffer.from(stableJson(payload)),root.privateKey).toString('base64url')});
    }});
  const identity={sessionId,principal:{actorId:'demo-guardian',deviceId:'demo-device-guardian',epoch:1,sessionGeneration:0}};
  const result={...identity,sessionToken:`cp-guardian.${'a'.repeat(43)}`,expiresAt:new Date(moment+60_000).toISOString(),syntheticOnly:true as const,identityVerified:false as const};
  const db:ChildSqlConnection={async query<T extends Record<string,unknown>>(sql:string,values:unknown[]=[]):Promise<T[]> {
    let rows:Record<string,unknown>[];
    if(sql.includes('capability_session'))rows=[{id:sessionId}];
    else if(sql.startsWith('SELECT set_config'))rows=[];
    else if(sql.startsWith('SELECT id FROM child_stewardship.sessions'))rows=[{id:sessionId}];
    else if(sql.includes('to_regprocedure'))rows=[{installed:true,anchor_function:true}];
    else if(sql.includes(' AS permitted'))rows=[{permitted:values[0]===sessionId&&values[1]===original.anchor.checkpointId&&values[2]===original.anchor.sequence&&values[3]===original.anchor.digest}];
    else if(sql.includes(' AS current'))rows=[{current:values[0]===sessionId&&values[1]===registryDigest&&Date.parse(String(values[2]))>moment}];
    else if(sql.includes('child_stewardship_guardian.exchange')){
      events.push('exchange');
      if(rejectExchange||state.consumed)rows=[{result:null}];
      else{state={sessions:state.sessions+1,audit:state.audit+1,consumed:true};await Promise.resolve();afterExchange();rows=[{result}];}
    }else throw new Error(`Unexpected fixture SQL: ${sql}`);
    return rows as T[];
  }};
  const client:ChildSqlClient={query:db.query,async transaction<T>(run:(connection:ChildSqlConnection)=>Promise<T>):Promise<T>{
    const before=structuredClone(state);
    try{const value=await run(db);events.push('commit');commits++;return value;}
    catch(error){events.push('rollback');state=before;rollbacks++;throw error;}
  }};
  const sessions=new PostgresGuardianSessions(client,async id=>{
    const current=await read(id);return {...current.anchor,registryDigest:childDigest(current.registry),authorityExpiresAt:current.expiresAt};
  });
  return {events,nonces,result,authority,get state(){return state;},get commits(){return commits;},get rollbacks(){return rollbacks;},
    exchange:()=>sessions.exchange({bindingId,authenticationToken:'b'.repeat(43)}),
    afterWrite(fn:()=>void){afterExchange=fn;},outage(){offline=true;},reject(){rejectExchange=true;},stale(){issuerNow=moment-30_000;},
    recover(){offline=false;issuerNow=moment;Object.assign(authority,structuredClone(original));afterExchange=()=>{};},
  };
}

test('guardian exchange rereads signed current authority after tentative writes and before releasing a capability',async()=>{
  const f=fixture();assert.deepEqual(await f.exchange(),f.result);
  assert.deepEqual(f.events,['authority','exchange','authority','commit']);
  assert.equal(new Set(f.nonces).size,2,'the final check cannot reuse the earlier signed response');
  assert.deepEqual(f.state,{sessions:1,audit:1,consumed:true});assert.equal(f.commits,1);
  await assert.rejects(f.exchange(),/UNAUTHORIZED/);
  assert.deepEqual(f.state,{sessions:1,audit:1,consumed:true});
});

test('authority changes after exchange SQL roll back session, one-use authentication and audit',async t=>{
  const faults={
    revocation:(f:ReturnType<typeof fixture>)=>{f.authority.registry.keys[1]!.revoked=true;},
    outage:(f:ReturnType<typeof fixture>)=>f.outage(),
    'advanced restore floor':(f:ReturnType<typeof fixture>)=>{f.authority.anchor.sequence++;},
    'same-id key replacement':(f:ReturnType<typeof fixture>)=>{f.authority.registry.keys[1]!.publicKey=generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}).toString();},
    'expired signed response':(f:ReturnType<typeof fixture>)=>f.stale(),
  };
  for(const [name,change] of Object.entries(faults))await t.test(name,async()=>{
    const f=fixture();f.afterWrite(()=>change(f));
    await assert.rejects(f.exchange(),error=>error instanceof Error&&error.message==='RESTORATION_UNVERIFIED');
    assert.deepEqual(f.events,['authority','exchange','authority','rollback']);
    assert.deepEqual(f.state,{sessions:0,audit:0,consumed:false});assert.equal(f.commits,0);assert.equal(f.rollbacks,1);
    assert.equal(new Set(f.nonces).size,2);
    // Rollback does not spend authentication. A separate explicit retry must
    // pass both fresh checks; the adapter itself never retries a failed request.
    f.recover();assert.deepEqual(await f.exchange(),f.result);
    assert.deepEqual(f.state,{sessions:1,audit:1,consumed:true});assert.equal(f.commits,1);
  });
});

test('unavailable initial authority or rejected SQL never releases a guardian session',async()=>{
  const unavailable=fixture();unavailable.outage();
  await assert.rejects(unavailable.exchange(),/RESTORATION_UNVERIFIED/);
  assert.deepEqual(unavailable.events,['authority','rollback']);
  assert.deepEqual(unavailable.state,{sessions:0,audit:0,consumed:false});
  const rejected=fixture();rejected.reject();await assert.rejects(rejected.exchange(),/UNAUTHORIZED/);
  assert.deepEqual(rejected.events,['authority','exchange','rollback']);
  assert.deepEqual(rejected.state,{sessions:0,audit:0,consumed:false});
});
