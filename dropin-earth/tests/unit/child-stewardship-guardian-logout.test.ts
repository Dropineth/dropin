import assert from 'node:assert/strict';
import test from 'node:test';
import {PostgresGuardianSessions} from '../../services/api/src/domain/child-stewardship/guardian-sessions.js';
import type {ChildSqlClient} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {ChildApiError,TestChildStore} from '../../services/api/src/domain/child-stewardship/store.js';
import {createChildStewardshipRoutes} from '../../services/api/src/routes/child-stewardship/index.js';

const token=`cp-guardian.${'a'.repeat(43)}`;
const session='00000000-0000-4000-8000-000000000001';
const binding='00000000-0000-4000-8000-000000000002';

// Adapter/HTTP contract test only; native PostgreSQL tests independently cover
// SECURITY DEFINER, runtime role, tenant ownership, row locks and durable audit.
function fixture() {
  const calls:{text:string;values:unknown[]}[]=[];
  let known=true,accepted=true,restoreCalls=0;
  const client:ChildSqlClient={
    async query<T extends Record<string,unknown>>(text:string,values:unknown[]=[]):Promise<T[]> {
      calls.push({text,values});let rows:Record<string,unknown>[];
      if(text.includes('capability_session'))rows=[{id:known?session:null}];
      else if(text.startsWith('SELECT id FROM child_stewardship.sessions'))rows=[{id:session}];
      else if(text.startsWith('SELECT set_config'))rows=[];
      else if(text.includes('to_regprocedure'))rows=[{installed:true,anchor_function:true}];
      else if(text.includes('child_stewardship_guardian.logout'))rows=[{accepted}];
      else throw new Error(`Unexpected synthetic query: ${text}`);
      return rows as T[];
    },
    async transaction<T>(run:(db:ChildSqlClient)=>Promise<T>):Promise<T>{return run(client);}
  };
  const guardianSessions=new PostgresGuardianSessions(client,async()=>{restoreCalls++;throw new Error('synthetic authority unavailable');});
  const store=Object.assign(new TestChildStore(),{guardianSessions});
  return {calls,guardianSessions,store,get restoreCalls(){return restoreCalls;},unknown(){known=false;},known(){known=true;},reject(){accepted=false;}};
}

test('guardian self-revocation does not require positive restore admission; login and resolve still do',async()=>{
  const f=fixture();await f.guardianSessions.logout(token);
  assert.equal(f.restoreCalls,0);
  assert.deepEqual(f.calls.map(c=>c.text.includes('capability_session')?'scope':c.text.includes('set_config')?'context':c.text.includes('FOR UPDATE')?'lock':'logout'),['scope','context','lock','logout']);
  assert.deepEqual(f.calls.at(-1)!.values,[token,session]);
  await assert.rejects(f.guardianSessions.resolve(token),/RESTORATION_UNVERIFIED/);
  await assert.rejects(f.guardianSessions.exchange({bindingId:binding,authenticationToken:'b'.repeat(43)}),/RESTORATION_UNVERIFIED/);
  assert.equal(f.restoreCalls,2);
  assert.equal(f.calls.filter(c=>c.text.includes('child_stewardship_guardian.logout')).length,1);
});

test('self-revocation still requires a valid raw bearer, known capability and SQL acceptance',async()=>{
  const malformed=fixture();await assert.rejects(malformed.guardianSessions.logout('a'.repeat(64)),/UNAUTHORIZED/);assert.equal(malformed.calls.length,0);
  const unknown=fixture();unknown.unknown();await assert.rejects(unknown.guardianSessions.logout(token),/UNAUTHORIZED/);assert.equal(unknown.calls.length,1);
  const denied=fixture();denied.reject();await assert.rejects(denied.guardianSessions.logout(token),/UNAUTHORIZED/);assert.equal(denied.restoreCalls,0);
  const limited=fixture();await assert.rejects(limited.guardianSessions.logout(token,id=>{assert.equal(id,session);throw new ChildApiError('RATE_LIMITED',429);}),/RATE_LIMITED/);
  assert.equal(limited.calls.some(c=>c.text.includes('child_stewardship_guardian.logout')),false);
});

test('only the exact logout endpoint bypasses positive admission and returns no principal or authority',async()=>{
  const f=fixture(),app=createChildStewardshipRoutes({mode:'synthetic-demo',store:f.store});
  const response=await app.request('/guardian/logout',{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'});
  assert.equal(response.status,200);assert.deepEqual((await response.json()).data,{status:'session_revoked',syntheticOnly:true});
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(f.restoreCalls,0);
  for(const path of ['/view','/guardian/logout/','/guardian/logout-extra']){
    const denied=await app.request(path,{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'});assert.equal(denied.status,503);
  }
  assert.equal(f.restoreCalls,3);
});

test('logout retains mode, origin, body-size, exact-body, bearer and bounded local rate guards',async()=>{
  const f=fixture();let now=Date.parse('2026-11-12T00:00:00.000Z');
  const app=createChildStewardshipRoutes({mode:'synthetic-demo',store:f.store,now:()=>new Date(now).toISOString()});
  const request=(body='{}',headers:Record<string,string>={})=>app.request('/guardian/logout',{method:'POST',headers:{authorization:`Bearer ${token}`,...headers},body});
  assert.equal((await request('{}',{origin:'https://untrusted.invalid','sec-fetch-site':'cross-site'})).status,403);
  assert.equal((await request('x'.repeat(131073))).status,413);
  assert.equal((await request('{}',{authorization:'Bearer cp-demo.'+'a'.repeat(43)})).status,401);
  for(const body of ['', '{"sessionId":"other"}', '[]'])assert.equal((await request(body)).status,400);
  assert.equal(f.calls.length,0);
  f.unknown();for(let i=0;i<150;i++)assert.equal((await request()).status,401);
  f.known();for(let i=0;i<120;i++)assert.equal((await request()).status,200);
  assert.equal((await request()).status,429);
  now+=60000;assert.equal((await request()).status,200);
  const disabled=createChildStewardshipRoutes({mode:'disabled',store:f.store});
  assert.equal((await disabled.request('/guardian/logout',{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'})).status,503);
  assert.equal(f.restoreCalls,0);
});

test('logout storage failure never reports successful revocation',async t=>{
  const f=fixture();t.mock.method(f.guardianSessions,'logout',async()=>{throw new ChildApiError('SERVICE_UNAVAILABLE',503);});
  const app=createChildStewardshipRoutes({mode:'synthetic-demo',store:f.store});
  const response=await app.request('/guardian/logout',{method:'POST',headers:{authorization:`Bearer ${token}`},body:'{}'});
  assert.equal(response.status,503);assert.equal((await response.json()).error.code,'SERVICE_UNAVAILABLE');
});
