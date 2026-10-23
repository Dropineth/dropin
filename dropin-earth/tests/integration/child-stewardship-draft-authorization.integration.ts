import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {nativeChildPool,nativeChildSql,scopedNativeChildPool} from '../fixtures/child-stewardship-postgres.js';
import {PostgresChildStore} from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import {PostgresChildResumeStore} from '../../services/api/src/domain/child-stewardship/resume-store.js';
import {createChildStewardshipRoutes} from '../../services/api/src/routes/child-stewardship/index.js';
import {childDigest} from '../../services/api/src/domain/child-stewardship/store.js';

test('native Hono fresh draft authority: restart restores provenance only and each payload requires current one-use approval',async t=>{
  const owner=nativeChildPool();let runtime:Awaited<ReturnType<typeof scopedNativeChildPool>>|undefined;
  try{
    for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-resume.sql','child-stewardship-draft-authorization.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
    runtime=await scopedNativeChildPool(owner);const client=nativeChildSql(runtime.pool);
    let crash=false,storageFailures=0,storageAttempts=0;const signals:unknown[]=[];const store=new PostgresChildStore(nativeChildSql(runtime.pool,text=>{if(storageFailures>0&&text.startsWith('INSERT INTO child_stewardship.receipts')){storageAttempts++;storageFailures--;throw Object.assign(new Error('private payload must never reach operational signals'),{code:'ECONNRESET'});}if(crash&&text.startsWith('INSERT INTO child_stewardship.receipts')){crash=false;throw new Error('injected receipt persistence failure');}}));
    const app=createChildStewardshipRoutes({mode:'synthetic-demo',store,resumeStore:new PostgresChildResumeStore(client),onOperationalSignal:signal=>signals.push(signal)});
    const external=t.mock.method(globalThis,'fetch',async()=>{throw new Error('external request forbidden');});
    await t.test('readiness rejects a runtime without the mandatory upload admission privilege',async()=>{
      const identity=(await runtime!.pool.query('SELECT current_user AS role,session_user AS login')).rows[0];
      assert.equal(identity.role,identity.login);
      await runtime!.pool.query('RESET ROLE');
      assert.equal((await runtime!.pool.query('SELECT current_user AS role')).rows[0].role,identity.role);
      assert.equal(await store.ready(),true);
      const parentRole=`child_privilege_${randomUUID().replaceAll('-','')}`;
      await owner.query(`CREATE ROLE ${parentRole} NOLOGIN`);
      try{
        await owner.query(`GRANT ${parentRole} TO ${identity.role}`);assert.equal(await store.ready(),false);
        await owner.query(`REVOKE ${parentRole} FROM ${identity.role}`);assert.equal(await store.ready(),true);
        await owner.query(`ALTER ROLE ${identity.role} CREATEROLE`);assert.equal(await store.ready(),false);
        await owner.query(`ALTER ROLE ${identity.role} NOCREATEROLE`);assert.equal(await store.ready(),true);
      }finally{await owner.query(`ALTER ROLE ${identity.role} NOCREATEROLE`);await owner.query(`REVOKE ${parentRole} FROM ${identity.role}`);await owner.query(`DROP ROLE ${parentRole}`);}
      await assert.rejects(owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'operation-verifier',1,true,'disposable-readiness-test',clock_timestamp()+interval '1 hour')",[identity.role]),/CHILD_VERIFIER_ROLE_MUST_BE_SEPARATE/);
      assert.equal(await store.ready(),true);
      await owner.query(`REVOKE EXECUTE ON FUNCTION child_stewardship.issue_draft_authorization(text,jsonb) FROM ${identity.role}`);
      try{
        assert.equal(await store.ready(),false);
        assert.equal((await (await app.request('/status')).json()).data.available,false);
        assert.equal((await app.request('/demo-sessions',{method:'POST'})).status,503);
      }finally{await owner.query(`GRANT EXECUTE ON FUNCTION child_stewardship.issue_draft_authorization(text,jsonb) TO ${identity.role}`);}
    });
    async function fixture(){
      const created=await app.request('/demo-sessions',{method:'POST'});assert.equal(created.status,201);const session=(await created.json()).data as {sessionId:string;tokens:Record<string,string>};
      let tokens=session.tokens;
      const view=async(role='child')=>{const r=await app.request('/view',{headers:{authorization:`Bearer ${tokens[role]}`}});assert.equal(r.status,200);return (await r.json()).data;};
      const post=(path:string,body:unknown,role='child',headers:Record<string,string>={})=>app.request(path,{method:'POST',headers:{authorization:`Bearer ${tokens[role]}`,'content-type':'application/json',...headers},body:JSON.stringify(body)});
      const command=async(role:string,fields:Record<string,unknown>)=>{const current=await view(role),packet={commandId:`demo-${randomUUID()}`,expectedVersion:current.version,...fields};const r=await post('/commands',packet,role,{'idempotency-key':packet.commandId,'if-match':String(packet.expectedVersion)});const result=await r.json();assert.equal(r.status,200,JSON.stringify(result));return result.data;};
      await command('guardian',{type:'create-profile',profileId:'demo-profile-a',ageBand:'9-12',locale:'en',nickname:'leaf'});
      for(const purpose of ['learning','upload']){await command('guardian',{type:'grant-consent',profileId:'demo-profile-a',purpose,policyVersion:'child-learning-demo-v1'});await command('child',{type:'set-assent',profileId:'demo-profile-a',purpose,willing:true});}
      const assignment=(await command('child',{type:'assign-task',profileId:'demo-profile-a',taskId:'demo-task-leaf-comparison'})).id;
      const pending=async()=>{const current=await view(),draftId=randomUUID(),packet={type:'submit-observation',commandId:`demo-${draftId}`,expectedVersion:current.version,assignmentId:assignment,sampleId:'demo-leaf-green',answer:'green',capturedAtClaimed:new Date().toISOString()};return{packet,proposal:{draftId,intentDigest:childDigest(packet),assignmentId:assignment,originalSessionId:session.sessionId,originalConsentEpoch:current.uploadEligibility[0].consentEpoch,purpose:'synthetic-learning-upload',schemaVersion:'CanopyProof-SyntheticDraft/2',policyVersion:current.policyVersion,expectedVersion:current.version}};};
      const send=(packet:Record<string,unknown>,proof?:string)=>post('/commands',packet,'child',{'idempotency-key':String(packet.commandId),'if-match':String(packet.expectedVersion),...(proof?{'x-child-upload-authorization':proof}:{})});
      const grant=async(proposal:unknown)=>{const r=await post('/draft-authorizations',proposal);const body=await r.json();assert.equal(r.status,201,JSON.stringify(body));return body.data.authorizationToken as string;};
      const restart=async()=>{const suspended=await post('/suspend',{});assert.equal(suspended.status,200);const ticket=(await suspended.json()).data.resumeTicket;const r=await post('/resume',{resumeTicket:ticket});assert.equal(r.status,200);tokens=(await r.json()).data.tokens;return ticket;};
      const facts=async()=>({observations:(await owner.query("SELECT payload FROM child_stewardship.state_records WHERE session_id=$1 AND domain='learning' AND collection='observations' ORDER BY record_id",[session.sessionId])).rows,receipts:(await owner.query('SELECT * FROM child_stewardship.receipts WHERE session_id=$1 ORDER BY idempotency_key',[session.sessionId])).rows,uses:(await owner.query('SELECT * FROM child_stewardship.draft_authorization_uses WHERE session_id=$1 ORDER BY proof_hash',[session.sessionId])).rows});
      return{...session,view,post,command,pending,send,grant,restart,facts};
    }
    await t.test('generation zero and restarted login alone both reject the unchanged pending body; fresh explicit grant permits exactly one effect',async()=>{
      const f=await fixture(),draft=await f.pending(),before=await f.facts();
      assert.equal((await f.send(draft.packet)).status,403);assert.deepEqual(await f.facts(),before);
      await f.restart();assert.equal((await f.send(draft.packet)).status,403);assert.deepEqual(await f.facts(),before);
      const proof=await f.grant(draft.proposal);assert.match(proof,/^cp-upload\.[A-Za-z0-9_-]{43}$/);
      const row=(await owner.query('SELECT proposal FROM child_stewardship.draft_authorizations WHERE session_id=$1',[f.sessionId])).rows[0].proposal;
      assert.deepEqual(row,draft.proposal);for(const key of ['answer','sampleId','capturedAtClaimed','command'])assert.equal(key in row,false);
      const results=await Promise.all([f.send(draft.packet,proof),f.send(draft.packet,proof)]);assert.deepEqual(results.map(r=>r.status),[200,200]);
      const accepted=await results[0]!.json();assert.deepEqual((await results[1]!.json()).data,accepted.data);
      assert.equal((await f.facts()).observations.length,1);assert.equal((await f.facts()).uses.length,1);
      assert.equal((await f.send(draft.packet)).status,403,'a recorded receipt is not permission to resend draft bytes');
      await f.restart();const replayBefore=await f.facts();
      assert.equal((await f.send(draft.packet,proof)).status,403,'prior generation proof cannot authorize receipt replay');
      assert.deepEqual(await f.facts(),replayBefore);
      const freshProof=await f.grant({...draft.proposal,expectedVersion:(await f.view()).version});
      const replay=await f.send(draft.packet,freshProof);assert.equal(replay.status,200);
      assert.deepEqual((await replay.json()).data,accepted.data);
      assert.equal((await f.facts()).observations.length,1);assert.equal((await f.facts()).uses.length,2);
      await f.command('reviewer',{type:'review-observation',observationId:accepted.data.id,decision:'insufficient_for_survival',reason:'synthetic_source'});
      const uses=(await owner.query('SELECT row_to_json(u) AS value FROM child_stewardship.draft_authorization_uses u WHERE session_id=$1',[f.sessionId])).rows;
      assert.ok(!JSON.stringify(uses).includes('demo-leaf-green'));assert.ok(!JSON.stringify(uses).includes(draft.packet.capturedAtClaimed));
    });
    await t.test('an externally required restore anchor cannot be bypassed by restoring a schema without the restore module',async()=>{
      const f=await fixture(),draft=await f.pending(),before=await f.facts();
      assert.equal((await owner.query("SELECT to_regprocedure('child_stewardship.restore_execution_permitted(uuid)') IS NULL AS missing")).rows[0].missing,true);
      const strictStore=new PostgresChildStore(client,async()=>({checkpointId:'outside-backup-current',sequence:2,digest:'a'.repeat(64)}));
      assert.equal(await strictStore.ready(),false);
      const strictApp=createChildStewardshipRoutes({mode:'synthetic-demo',store:strictStore});
      const headers={authorization:`Bearer ${f.tokens.child}`,'content-type':'application/json','idempotency-key':draft.packet.commandId,'if-match':String(draft.packet.expectedVersion)};
      for(const path of ['/view','/privacy/requests/demo-result'])assert.equal((await strictApp.request(path,{headers})).status,503);
      for(const [path,body] of [['/commands',draft.packet],['/draft-authorizations',draft.proposal]] as const)assert.equal((await strictApp.request(path,{method:'POST',headers,body:JSON.stringify(body)})).status,503);
      await assert.rejects(strictStore.issueDraftAuthorization(f.tokens.child!,draft.proposal),/RESTORATION_UNVERIFIED/);
      assert.deepEqual(await f.facts(),before);
    });
    await t.test('grant digest, actor, session, declared purpose and current versions cannot authorize altered contents',async()=>{
      const f=await fixture(),draft=await f.pending(),proof=await f.grant(draft.proposal),before=await f.facts();
      assert.equal((await f.send({...draft.packet,answer:'yellow'},proof)).status,403);assert.deepEqual(await f.facts(),before);
      for(const patch of [{purpose:'rights-payment'},{originalSessionId:randomUUID()},{originalConsentEpoch:0},{expectedVersion:0},{command:draft.packet}])assert.equal((await f.post('/draft-authorizations',{...draft.proposal,...patch})).status,403);
      const other=await fixture(),otherDraft=await other.pending();assert.equal((await other.send(otherDraft.packet,proof)).status,403);assert.equal((await other.facts()).observations.length,0);
      assert.equal((await f.send(draft.packet,proof)).status,200,'failed attempts do not consume the legitimate proof');
    });
    await t.test('withdrawal and another restart invalidate an unused proof without accepting payload or consuming its grant',async()=>{
      const f=await fixture(),draft=await f.pending(),proof=await f.grant(draft.proposal);await f.restart();
      const before=await f.facts();assert.equal((await f.send(draft.packet,proof)).status,403);assert.deepEqual(await f.facts(),before);
      const current=await f.grant(draft.proposal);await f.command('guardian',{type:'withdraw-consent',profileId:'demo-profile-a',purpose:'upload'});
      const after=await f.facts();assert.ok([403,409].includes((await f.send(draft.packet,current)).status));assert.deepEqual(await f.facts(),after);
      assert.equal((await f.post('/draft-authorizations',{...draft.proposal,expectedVersion:(await f.view()).version})).status,403);
    });
    await t.test('receipt failure rolls back proof consumption and observation atomically; retry succeeds without duplicate work',async()=>{
      const f=await fixture(),draft=await f.pending(),proof=await f.grant(draft.proposal),before=await f.facts();crash=true;
      assert.equal((await f.send(draft.packet,proof)).status,503);assert.deepEqual(await f.facts(),before);
      assert.equal((await f.send(draft.packet,proof)).status,200);assert.equal((await f.facts()).uses.length,1);
    });
    await t.test('separate Hono instances share a durable actor allowance and rejected business work cannot reset it',async()=>{
      const f=await fixture();
      const second=Number((await owner.query('SELECT extract(second FROM clock_timestamp()) AS second')).rows[0].second);
      if(second>55)await new Promise(resolve=>setTimeout(resolve,(60-second)*1000+50));
      await f.view();
      const consumed=Number((await owner.query("SELECT consumed FROM child_stewardship.api_rate_limits WHERE kind='session_request' AND bucket_id=$1",[`${f.sessionId}:demo-child`])).rows[0].consumed);
      for(let count=consumed;count<119;count++)await store.consumeRateLimit('session_request',f.sessionId,'demo-child');
      const otherInstance=createChildStewardshipRoutes({mode:'synthetic-demo',store:new PostgresChildStore(client)});
      const first=await f.post('/commands',{type:'unsupported',commandId:'demo-rejected-work',expectedVersion:6},'child',{'idempotency-key':'demo-rejected-work','if-match':'6'});
      assert.ok([400,403,409].includes(first.status));
      const limited=await otherInstance.request('/view',{headers:{authorization:`Bearer ${f.tokens.child}`}});
      assert.equal(limited.status,429);assert.equal((await limited.json()).error.code,'RATE_LIMITED');
      assert.equal(Number((await owner.query("SELECT consumed FROM child_stewardship.api_rate_limits WHERE kind='session_request' AND bucket_id=$1",[`${f.sessionId}:demo-child`])).rows[0].consumed),120);
    });
    await t.test('storage circuit preserves transaction rollback and emits only fixed metadata without blocking another actor',async()=>{
      const f=await fixture(),draft=await f.pending(),proof=await f.grant(draft.proposal),before=await f.facts();storageFailures=3;
      for(let attempt=0;attempt<3;attempt++)assert.equal((await f.send(draft.packet,proof)).status,503);
      assert.equal(storageAttempts,3);assert.deepEqual(await f.facts(),before);
      assert.equal((await f.send(draft.packet,proof)).status,503);assert.equal(storageAttempts,3);assert.deepEqual(await f.facts(),before);
      await f.command('guardian',{type:'withdraw-consent',profileId:'demo-profile-a',purpose:'upload'});
      assert.equal(signals.length,4);
      for(const value of signals){const signal=value as Record<string,unknown>;assert.deepEqual(Object.keys(signal).sort(),['category','code','count','time']);assert.equal(signal.category,'child_storage');assert.ok(['STORAGE_FAILURE','CIRCUIT_OPEN'].includes(String(signal.code)));}
      const serialized=JSON.stringify(signals);for(const forbidden of [f.sessionId,'demo-child','demo-profile-a',draft.packet.answer,draft.packet.sampleId,proof,'private payload'])assert.ok(!serialized.includes(forbidden));
    });
    await t.test('hidden protection activity does not change guardian allowance or let guardian traffic exhaust reporting',async()=>{
      const second=Number((await owner.query('SELECT extract(second FROM clock_timestamp()) AS second')).rows[0].second);
      if(second>50)await new Promise(resolve=>setTimeout(resolve,(60-second)*1000+50));
      const results=[];
      for(const hidden of [false,true]){
        const f=await fixture();
        const consumed=Number((await owner.query("SELECT consumed FROM child_stewardship.api_rate_limits WHERE kind='session_request' AND bucket_id=$1",[`${f.sessionId}:demo-guardian`])).rows[0].consumed);
        for(let count=consumed;count<119;count++)await store.consumeRateLimit('session_request',f.sessionId,'demo-guardian');
        if(hidden)await f.command('child',{type:'open-dispute',profileId:'demo-profile-a',targetId:'demo-profile-a',reason:'unsafe_adult'});
        const other=createChildStewardshipRoutes({mode:'synthetic-demo',store:new PostgresChildStore(client)});
        const headers={authorization:`Bearer ${f.tokens.guardian}`};
        const first=await other.request('/view',{headers}),last=await other.request('/view',{headers});
        assert.equal(first.status,200);assert.equal(last.status,429);
        results.push({view:(await first.json()).data,error:(await last.json()).error});
        // Exhaust the local guardian bucket too: child/protector still have their own lanes.
        for(let count=0;count<125;count++)await app.request('/view',{headers});
        assert.equal((await app.request('/view',{headers:{authorization:`Bearer ${f.tokens.child}`}})).status,200);
        assert.equal((await app.request('/view',{headers:{authorization:`Bearer ${f.tokens.protector}`}})).status,200);
      }
      // Independent fixtures have distinct audit timestamps/IDs; only observable capacity and
      // protected-data absence are compared, not unrelated randomly generated business IDs.
      assert.deepEqual(results[0]!.error,results[1]!.error);assert.equal(results[0]!.error.code,'RATE_LIMITED');
      for(const value of results)assert.equal(value.view.disputes.length,0);
    });
    assert.equal(external.mock.callCount(),0);
  }finally{await runtime?.close();await owner.end();}
});
