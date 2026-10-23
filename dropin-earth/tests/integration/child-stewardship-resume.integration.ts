import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { mkdtemp,readFile,rm,writeFile } from "node:fs/promises";
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from "node:test";
import pg from "pg";
import { PostgresChildStore } from "../../services/api/src/domain/child-stewardship/postgres-store.js";
import { PostgresChildResumeStore } from "../../services/api/src/domain/child-stewardship/resume-store.js";
import { childDigest,createDemoTokens,stableJson,tokenDigest } from "../../services/api/src/domain/child-stewardship/store.js";
import {ChildRestoreVerifier,type RestoreCheckpoint,type RestoreCheckpointKey,type RestoreAnchor} from '../../services/api/src/domain/child-stewardship/restore-checkpoint.js';
import { createSyntheticLearningState } from "../../services/api/src/domain/child-stewardship/learning.js";
import { createEmptyRightsState } from "../../services/api/src/domain/child-stewardship/rights.js";
import { createChildStewardshipRoutes } from "../../services/api/src/routes/child-stewardship/index.js";
import { nativeChildPool,nativeChildSql } from "../fixtures/child-stewardship-postgres.js";

async function runtimePool(owner:pg.Pool){
  const role=`resume_test_${randomUUID().replaceAll("-","")}`;const password=randomBytes(32).toString("hex");
  await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS`);
  await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role}`);
  await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);
  await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role}`);
  await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
  if((await owner.query("SELECT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname='child_stewardship_webauthn') AS installed")).rows[0].installed){await owner.query(`GRANT USAGE ON SCHEMA child_stewardship_webauthn TO ${role}`);await owner.query(`GRANT SELECT ON child_stewardship_webauthn.verifier_roles TO ${role}`);}
  await owner.query("INSERT INTO child_stewardship.service_role_scopes(database_role,actor_role,scope_version,enabled,approval_ref,expires_at) SELECT $1,unnest($2::text[]),1,true,'disposable-native-resume-test',clock_timestamp()+interval '1 hour'",[role,["bootstrap","guardian","child","reviewer","protector","operator"]]);
  const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL!);url.username=role;url.password=password;
  const pool=new pg.Pool({connectionString:url.toString(),max:6});
  return {pool,role,async close(){await pool.end();await owner.query(`DROP OWNED BY ${role}`);await owner.query(`DROP ROLE ${role}`);}};
}
test("native one-use synthetic suspend/resume: SQL capability admission, Hono, current revocation and durable failure boundaries",async t=>{
  const owner=nativeChildPool();let runtime:Awaited<ReturnType<typeof runtimePool>>|undefined;
  try{
    for(const path of ["child-stewardship.sql","child-stewardship-authority.sql","child-stewardship-resume.sql","child-stewardship-draft-authorization.sql","child-stewardship-privacy.sql","child-stewardship-rate-limit.sql"])
      await owner.query(await readFile(`services/api/prisma/${path}`,"utf8"));
    runtime=await runtimePool(owner);const client=nativeChildSql(runtime.pool);
    const store=new PostgresChildStore(client);const resume=new PostgresChildResumeStore(client);
    assert.equal(await resume.ready(),true);
    const create=async(lifetime=86_400_000)=>{
      const id=randomUUID();const tokens=createDemoTokens(id);const now=new Date().toISOString();
      await store.create({id,expiresAt:new Date(Date.now()+lifetime).toISOString(),snapshot:{version:0,learning:createSyntheticLearningState(now),rights:createEmptyRightsState()}},tokens.records);
      return {id,tokens:tokens.publicTokens,now};
    };
    const app=createChildStewardshipRoutes({mode:"synthetic-demo",store,resumeStore:resume});
    const post=(path:string,body:unknown,token?:string)=>app.request(path,{method:"POST",headers:{"content-type":"application/json",...(token?{authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
    const view=(token:string)=>app.request("/view",{headers:{authorization:`Bearer ${token}`}});
    const rawCount=async(id:string)=>(await owner.query("SELECT count(*)::int AS n FROM child_stewardship.session_tokens WHERE session_id=$1",[id])).rows[0].n;
    const external=t.mock.method(globalThis,"fetch",async()=>{throw new Error("unexpected external request");});

    await t.test("actual Hono suspend invalidates all five role tokens; one-use resume preserves profile assignment consent and issues memory-only tokens",async()=>{
      const f=await create();let version=0;let i=0;
      const command=async(role:keyof typeof f.tokens,fields:Record<string,unknown>)=>{
        const id=`demo-resume-flow-${++i}`;
        const response=await app.request("/commands",{method:"POST",headers:{authorization:`Bearer ${f.tokens[role]}`,"content-type":"application/json","if-match":String(version),"idempotency-key":id},body:JSON.stringify({commandId:id,expectedVersion:version,...fields})});
        const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));version=body.version;return body.data;
      };
      await command("guardian",{type:"create-profile",profileId:"demo-resume-profile",ageBand:"9-12",locale:"en",nickname:"leaf"});
      for(const purpose of ["learning","upload"]){await command("guardian",{type:"grant-consent",profileId:"demo-resume-profile",purpose,policyVersion:"child-learning-demo-v1"});await command("child",{type:"set-assent",profileId:"demo-resume-profile",purpose,willing:true});}
      const assignment=await command("child",{type:"assign-task",profileId:"demo-resume-profile",taskId:"demo-task-leaf-comparison"});
      const before=(await (await view(f.tokens.child)).json()).data;
      const suspended=await post("/suspend",{},f.tokens.child);assert.equal(suspended.status,200);
      const ticket=(await suspended.json()).data;assert.equal(ticket.sessionId,f.id);assert.match(ticket.resumeTicket,/^cp-resume\.[A-Za-z0-9_-]{43}$/);
      assert.equal("tokens" in ticket,false);
      for(const token of Object.values(f.tokens))assert.equal((await view(token)).status,401);
      assert.equal((await post("/suspend",{},f.tokens.child)).status,401);
      const response=await post("/resume",{resumeTicket:ticket.resumeTicket});assert.equal(response.status,200);
      const fresh=(await response.json()).data;assert.equal(fresh.sessionId,f.id);assert.equal("resumeTicket" in fresh,false);assert.equal(Object.keys(fresh.tokens).length,5);
      assert.equal((await post("/resume",{resumeTicket:ticket.resumeTicket})).status,401);
      for(const token of Object.values(f.tokens))assert.equal((await view(token)).status,401);
      const after=(await (await view(fresh.tokens.child)).json()).data;
      assert.deepEqual(after.uploadEligibility,before.uploadEligibility);assert.deepEqual(after.profiles,before.profiles);
      assert.ok(after.assignments.some((item:{id:string})=>item.id===assignment.id));
      assert.equal(after.version,before.version);assert.equal(await rawCount(f.id),10);
      const currentQuotaBefore=(await owner.query("SELECT consumed FROM child_stewardship.api_rate_limits WHERE kind='session_suspend' AND bucket_id=$1",[`${f.id}:demo-child`])).rows[0].consumed;
      assert.equal((await runtime!.pool.query("SELECT child_stewardship.consume_child_capability_limit('session_suspend',$1) status",[f.tokens.child])).rows[0].status,'unauthorized');
      assert.equal((await owner.query("SELECT consumed FROM child_stewardship.api_rate_limits WHERE kind='session_suspend' AND bucket_id=$1",[`${f.id}:demo-child`])).rows[0].consumed,currentQuotaBefore,'stale bearer cannot spend the current actor quota');
      const next=await resume.suspend(fresh.tokens.child);assert.notEqual(next.resumeTicket,ticket.resumeTicket);
      assert.equal((await view(fresh.tokens.child)).status,401);
    });

    await t.test("concurrent suspend and resume each admit exactly one winner and one fresh token generation",async()=>{
      const f=await create();const suspends=await Promise.allSettled([resume.suspend(f.tokens.child),resume.suspend(f.tokens.guardian)]);
      assert.equal(suspends.filter(x=>x.status==="fulfilled").length,1);
      const ticket=suspends.find(x=>x.status==="fulfilled");assert.ok(ticket?.status==="fulfilled");
      const results=await Promise.allSettled([resume.resume(ticket.value.resumeTicket),resume.resume(ticket.value.resumeTicket)]);
      assert.equal(results.filter(x=>x.status==="fulfilled").length,1);assert.equal(await rawCount(f.id),10);
      assert.equal((await owner.query("SELECT generation,state FROM child_stewardship.session_resumption WHERE session_id=$1",[f.id])).rows[0].generation,"1");
    });

    await t.test("two failed local storage writes or lost response cannot reuse a consumed ticket after restart",async()=>{
      const f=await create();const ticket=await resume.suspend(f.tokens.child);const durableOldTicket=ticket.resumeTicket;
      // Server committed a resume. The client loses both its deletion write and
      // replacement write, and loses all fresh in-memory bearer tokens on restart.
      await resume.resume(durableOldTicket);
      const reconnected=new PostgresChildResumeStore(nativeChildSql(runtime!.pool));
      await assert.rejects(reconnected.resume(durableOldTicket),/UNAUTHORIZED/);
      await assert.rejects(reconnected.resume(durableOldTicket),/UNAUTHORIZED/);
      for(const token of Object.values(f.tokens))assert.equal(await store.resolveToken(tokenDigest(token),new Date().toISOString()),null);
      assert.equal(await rawCount(f.id),10);
    });

    await t.test("current device revocation burns a suspended ticket without minting credentials or reviving the prior epoch",async()=>{
      const f=await create();const ticket=await resume.suspend(f.tokens.child);
      await client.transaction(async db=>{
        await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','guardian',true),set_config('app.child_operation','revoke-device',true)",[f.id]);
        await db.query("SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE",[f.id]);
        await db.query("UPDATE child_stewardship.state_records SET payload=jsonb_set(jsonb_set(payload,'{epoch}','2'),'{deviceIds}','[]'),revision=1 WHERE session_id=$1 AND domain='learning' AND collection='actors' AND record_id='demo-child'",[f.id]);
        await db.query("UPDATE child_stewardship.sessions SET revision=1 WHERE id=$1",[f.id]);
      });
      await assert.rejects(resume.resume(ticket.resumeTicket),/UNAUTHORIZED/);
      await assert.rejects(resume.resume(ticket.resumeTicket),/UNAUTHORIZED/);
      assert.equal(await rawCount(f.id),5);
      const stored=(await owner.query("SELECT consumed_at,outcome FROM child_stewardship.resume_tickets WHERE session_id=$1",[f.id])).rows[0];assert.ok(stored.consumed_at);assert.equal(stored.outcome,"denied");
    });

    await t.test("expired session/ticket cannot mint a generation and the known ticket remains consumed",async()=>{
      const f=await create(200);const ticket=await resume.suspend(f.tokens.child);
      await new Promise(resolve=>setTimeout(resolve,230));
      await assert.rejects(resume.resume(ticket.resumeTicket),/UNAUTHORIZED/);assert.equal(await rawCount(f.id),5);
      assert.equal((await owner.query("SELECT outcome FROM child_stewardship.resume_tickets WHERE session_id=$1",[f.id])).rows[0].outcome,"denied");
    });

    await t.test("ordinary SQL writer cannot mint tickets/token admissions or use known hashes and spoofed flags",async()=>{
      const f=await create();const ticket=await resume.suspend(f.tokens.child);const digest=createHash("sha256").update(ticket.resumeTicket).digest("hex");
      const inScope=(statement:string,parameters:unknown[])=>client.transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true)",[f.id]);return db.query(statement,parameters);});
      await assert.rejects(inScope("UPDATE child_stewardship.session_resumption SET state='active' WHERE session_id=$1",[f.id]),/CHILD_RESUME_FUNCTION_REQUIRED/);
      await assert.rejects(inScope("INSERT INTO child_stewardship.resume_tickets SELECT * FROM child_stewardship.resume_tickets WHERE session_id=$1",[f.id]),/CHILD_RESUME_FUNCTION_REQUIRED/);
      await assert.rejects(inScope("UPDATE child_stewardship.resume_tickets SET consumed_at=clock_timestamp(),outcome='resumed',transaction_id=pg_current_xact_id()::text WHERE session_id=$1",[f.id]),/CHILD_RESUME_FUNCTION_REQUIRED/);
      await assert.rejects(inScope("INSERT INTO child_stewardship.resume_mints VALUES($1,$2,$3,1,'demo-child','demo-device-child',1,pg_current_xact_id()::text)",["a".repeat(64),digest,f.id]),/CHILD_RESUME_FUNCTION_REQUIRED/);
      await assert.rejects(inScope("INSERT INTO child_stewardship.resume_token_lookup VALUES($1,$2,1)",["a".repeat(64),f.id]),/CHILD_RESUME_FUNCTION_REQUIRED/);
      await assert.rejects(client.transaction(async db=>{
        await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_resume_approved','true',true),set_config('app.child_actor_role','bootstrap',true),set_config('app.child_operation','create-synthetic-session',true)",[f.id]);
        await db.query("INSERT INTO child_stewardship.session_tokens(token_hash,session_id,actor_id,device_id,epoch,generation) VALUES($1,$2,'demo-child','demo-device-child',1,1)",["b".repeat(64),f.id]);
      }),/CHILD_TOKEN_RESUME_ADMISSION_REQUIRED/);
      assert.deepEqual((await client.query<{result:unknown}>("SELECT child_stewardship.resume_synthetic_session($1) AS result",[digest]))[0]?.result,{denied:true});
      assert.deepEqual((await client.query<{result:unknown}>("SELECT child_stewardship.suspend_synthetic_session($1) AS result",[tokenDigest(f.tokens.child)]))[0]?.result,{denied:true});
      assert.equal(await rawCount(f.id),5);assert.ok((await resume.resume(ticket.resumeTicket)).tokens.child);
    });

    await t.test("resume metadata is tenant-isolated, including bindings and consumed token admission history",async()=>{
      const f=await create();const other=await create();const ticket=await resume.suspend(other.tokens.child);await resume.resume(ticket.resumeTicket);
      for(const relation of ["session_resumption","resume_tickets","resume_mints","resume_token_lookup"]){
        assert.equal((await client.query<{n:number}>(`SELECT count(*)::int AS n FROM child_stewardship.${relation}`))[0]?.n,0);
        await client.transaction(async db=>{await db.query("SELECT set_config('app.child_session_id',$1,true)",[f.id]);assert.equal((await db.query<{n:number}>(`SELECT count(*)::int AS n FROM child_stewardship.${relation} WHERE session_id=$1`,[other.id]))[0]?.n,0);});
      }
      for(const generation of [0,1,2]){
        assert.equal((await client.query<{active:boolean}>("SELECT child_stewardship.token_generation_active($1,$2) AS active",[other.id,generation]))[0]?.active,false);
        await client.transaction(async db=>{
          await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_token_hash',$2,true)",[f.id,tokenDigest(f.tokens.child)]);
          assert.equal((await db.query<{active:boolean}>("SELECT child_stewardship.token_generation_active($1,$2) AS active",[other.id,generation]))[0]?.active,false);
        });
      }
    });

    await t.test("expiry is rechecked after waiting for the session lock, for both suspend and resume",async()=>{
      for(const operation of ["suspend","resume"] as const){
        const f=await create(350);const ticket=operation==="resume"?await resume.suspend(f.tokens.child):undefined;
        const lock=await owner.connect();await lock.query("BEGIN");await lock.query("SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE",[f.id]);
        const pending=(operation==="resume"?resume.resume(ticket!.resumeTicket):resume.suspend(f.tokens.child)).then(()=>"accepted",()=>"denied");
        await new Promise(resolve=>setTimeout(resolve,400));await lock.query("COMMIT");lock.release();
        assert.equal(await pending,"denied");assert.equal(await rawCount(f.id),5);
      }
    });

    await t.test("old resolved principal cannot commit view, command, rights or privacy after suspension or resumption",async()=>{
      for(const reactivate of [false,true])for(const path of ["/view","/commands","/rights/operations","/privacy/requests/demo-request"]){
        const f=await create();let captured!:()=>void;let release!:()=>void;
        const resolved=new Promise<void>(resolve=>{captured=resolve;});const wait=new Promise<void>(resolve=>{release=resolve;});
        const delayed={ready:()=>store.ready(),create:store.create.bind(store),transact:store.transact.bind(store),privacyResult:store.privacyResult.bind(store),
          async resolveToken(hash:string,now:string){const identity=await store.resolveToken(hash,now);captured();await wait;return identity;}};
        const delayedApp=createChildStewardshipRoutes({mode:"synthetic-demo",store:delayed,resumeStore:resume});
        const mutation=path==="/commands"||path==="/rights/operations";
        const pending=delayedApp.request(path,{method:mutation?"POST":"GET",headers:{authorization:`Bearer ${f.tokens.operator}`,"content-type":"application/json","if-match":"0","idempotency-key":"demo-delayed-old-principal"},...(mutation?{body:JSON.stringify({})}:{})});
        await resolved;const ticket=await resume.suspend(f.tokens.child);if(reactivate)await resume.resume(ticket.resumeTicket);release();
        assert.equal((await pending).status,401,`${path} after ${reactivate?"resume":"suspend"}`);
        assert.equal((await owner.query("SELECT revision FROM child_stewardship.sessions WHERE id=$1",[f.id])).rows[0].revision,"0");
      }
    });

    await t.test("cancel-resume atomically consumes pending tickets with identical idempotent unknown/used acknowledgements",async()=>{
      const f=await create();const ticket=await resume.suspend(f.tokens.child);
      const ack={cancelled:true,syntheticOnly:true};
      for(const value of [ticket.resumeTicket,ticket.resumeTicket,`cp-resume.${randomBytes(32).toString("base64url")}`,"unknown"]){
        const response=await post("/cancel-resume",{resumeTicket:value});assert.equal(response.status,200);assert.deepEqual((await response.json()).data,ack);
      }
      await assert.rejects(resume.resume(ticket.resumeTicket),/UNAUTHORIZED/);assert.equal(await rawCount(f.id),5);
      assert.equal((await owner.query("SELECT state FROM child_stewardship.session_resumption WHERE session_id=$1",[f.id])).rows[0].state,"suspended");
      const other=await create();const live=await resume.suspend(other.tokens.child);
      assert.deepEqual(await resume.cancel(createHash("sha256").update(live.resumeTicket).digest("hex")),ack);
      const resumed=await resume.resume(live.resumeTicket);assert.ok(resumed.tokens.child);
      assert.deepEqual(await resume.cancel(live.resumeTicket),ack);
      assert.equal((await view(resumed.tokens.child)).status,200,"a spent ticket cannot cancel a later active generation");
      const race=await create();const racing=await resume.suspend(race.tokens.child);
      const outcomes=await Promise.allSettled([resume.cancel(racing.resumeTicket),resume.resume(racing.resumeTicket)]);
      assert.equal(outcomes[0]?.status,"fulfilled");
      assert.equal(await rawCount(race.id),outcomes[1]?.status==="fulfilled"?10:5);
      await assert.rejects(resume.resume(racing.resumeTicket),/UNAUTHORIZED/);
    });

    await t.test("mid-mint database failure rolls ticket, tokens and active state back together; retry remains single-use",async()=>{
      const f=await create();const ticket=await resume.suspend(f.tokens.child);
      const name=`resume_crash_${randomUUID().replaceAll("-","")}`;
      await owner.query(`CREATE FUNCTION child_stewardship.${name}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.session_id='${f.id}'::uuid AND NEW.generation>0 AND NEW.actor_id='demo-reviewer' THEN RAISE EXCEPTION 'injected_resume_mint_failure'; END IF;RETURN NEW;END $$`);
      await owner.query(`CREATE TRIGGER ${name} AFTER INSERT ON child_stewardship.session_tokens FOR EACH ROW EXECUTE FUNCTION child_stewardship.${name}()`);
      try{await assert.rejects(resume.resume(ticket.resumeTicket),/injected_resume_mint_failure/);}
      finally{await owner.query(`DROP TRIGGER ${name} ON child_stewardship.session_tokens`);await owner.query(`DROP FUNCTION child_stewardship.${name}()`);}
      assert.equal(await rawCount(f.id),5);
      assert.equal((await owner.query("SELECT consumed_at FROM child_stewardship.resume_tickets WHERE session_id=$1",[f.id])).rows[0].consumed_at,null);
      assert.equal((await owner.query("SELECT state FROM child_stewardship.session_resumption WHERE session_id=$1",[f.id])).rows[0].state,"suspended");
      assert.ok((await resume.resume(ticket.resumeTicket)).tokens.child);await assert.rejects(resume.resume(ticket.resumeTicket),/UNAUTHORIZED/);
    });
    await t.test('durable purpose quotas bind raw capabilities, isolate actors, and never block cancellation',async()=>{
      const f=await create();
      const consume=(kind:string,raw:string)=>runtime!.pool.query('SELECT child_stewardship.consume_child_capability_limit($1,$2) status',[kind,raw]);
      assert.equal((await consume('session_suspend',tokenDigest(f.tokens.child))).rows[0].status,'unauthorized');
      const results=await Promise.all(Array.from({length:12},()=>consume('session_suspend',f.tokens.child)));
      assert.ok(results.every(result=>result.rows[0].status==='allowed'));
      assert.equal((await post('/suspend',{},f.tokens.child)).status,429);
      assert.equal(await rawCount(f.id),5);
      assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.resume_tickets WHERE session_id=$1',[f.id])).rows[0].n,0);
      const guardian=await post('/suspend',{},f.tokens.guardian);assert.equal(guardian.status,200);const ticket=(await guardian.json()).data.resumeTicket as string;
      const ticketResults=await Promise.all(Array.from({length:12},()=>consume('session_resume',ticket)));assert.ok(ticketResults.every(result=>result.rows[0].status==='allowed'));
      assert.equal((await post('/resume',{resumeTicket:ticket})).status,429);assert.equal(await rawCount(f.id),5);
      assert.equal((await post('/cancel-resume',{resumeTicket:ticket})).status,200);
      assert.equal((await owner.query('SELECT outcome FROM child_stewardship.resume_tickets WHERE session_id=$1',[f.id])).rows[0].outcome,'denied');
      assert.equal((await post('/cancel-resume',{resumeTicket:ticket})).status,200,'idempotent cancellation has a separate uncharged revocation lane');
      const other=await create();assert.equal((await post('/suspend',{},other.tokens.child)).status,200);
      const expiring=await create(300),blocker=await owner.connect();
      await blocker.query('BEGIN');await blocker.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))",[`child-api-limit:session_suspend:${expiring.id}:demo-child`]);
      const pending=post('/suspend',{},expiring.tokens.child);
      try{
        let waiting=false;for(let i=0;i<100;i++){if((await owner.query("SELECT 1 FROM pg_stat_activity WHERE usename=$1 AND wait_event_type='Lock'",[runtime!.role])).rows.length){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,5));}
        assert.equal(waiting,true);await new Promise(resolve=>setTimeout(resolve,350));
      }finally{await blocker.query('ROLLBACK');blocker.release();}
      assert.equal((await pending).status,401,'post-quota-lock clock rejects the expired session');
      assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.resume_tickets WHERE session_id=$1',[expiring.id])).rows[0].n,0);
      assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.api_rate_limits WHERE bucket_id=$1",[`${expiring.id}:demo-child`])).rows[0].n,0);

    });

    await t.test("rollback body preserves history and generation barriers while disabling new redemption",async()=>{
      const f=await create();const ticket=await resume.suspend(f.tokens.child);const active=await resume.resume(ticket.resumeTicket);
      const pending=await create();const pendingTicket=await resume.suspend(pending.tokens.child);
      const connection=await owner.connect();
      await connection.query("BEGIN");
      try{
        const body=(await readFile("services/api/prisma/child-stewardship-resume.rollback.sql","utf8")).replace(/^BEGIN;$/gm,"").replace(/^COMMIT;$/gm,"");
        await connection.query(body);
        assert.equal((await connection.query("SELECT count(*)::int AS n FROM child_stewardship.session_tokens WHERE session_id=$1",[f.id])).rows[0].n,10);
        assert.ok((await connection.query("SELECT consumed_at FROM child_stewardship.resume_tickets WHERE session_id=$1",[pending.id])).rows[0].consumed_at);
        await connection.query(`SET LOCAL ROLE ${runtime!.role}`);
        await connection.query("SELECT set_config('app.child_token_hash',$1,true)",[tokenDigest(active.tokens.child)]);
        assert.equal((await connection.query("SELECT count(*)::int AS n FROM child_stewardship.session_tokens WHERE token_hash=$1",[tokenDigest(active.tokens.child)])).rows[0].n,0);
        assert.deepEqual((await connection.query("SELECT child_stewardship.resume_synthetic_session($1) AS result",[pendingTicket.resumeTicket])).rows[0].result,{denied:true});
        assert.deepEqual((await connection.query("SELECT child_stewardship.suspend_synthetic_session($1) AS result",[active.tokens.child])).rows[0].result,{denied:true});
      }finally{await connection.query("ROLLBACK");connection.release();}
    });
    assert.equal(external.mock.callCount(),0);
  }finally{await runtime?.close();await owner.end();}
});

test('resume restore gate rereads an independent anchor before credential mutation and rejects stale or missing evidence',async()=>{
  const admin=nativeChildPool(),database=`resume_restore_test_${randomUUID().replaceAll('-','')}`,verifierRole=`resume_restore_v_${randomUUID().replaceAll('-','')}`,password=randomBytes(32).toString('hex');
  await admin.query(`CREATE DATABASE ${database}`);const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL!);url.pathname=`/${database}`;
  const owner=new pg.Pool({connectionString:url.toString(),max:4});let runtime:Awaited<ReturnType<typeof runtimePool>>|undefined,verifierPool:pg.Pool|undefined;
  const directory=await mkdtemp(join(tmpdir(),'canopyproof-resume-anchor-')),anchorFile=join(directory,'current.json');
  try{
    for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-resume.sql','child-stewardship-draft-authorization.sql','child-stewardship-privacy.sql','child-stewardship-rate-limit.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
    const previous=process.env.CANOPYPROOF_NATIVE_DATABASE_URL;process.env.CANOPYPROOF_NATIVE_DATABASE_URL=url.toString();try{runtime=await runtimePool(owner);}finally{process.env.CANOPYPROOF_NATIVE_DATABASE_URL=previous;}
    const db=nativeChildSql(runtime.pool),store=new PostgresChildStore(db),oldResume=new PostgresChildResumeStore(db),session=randomUUID(),tokens=createDemoTokens(session),now=new Date().toISOString();
    await store.create({id:session,expiresAt:new Date(Date.now()+3_600_000).toISOString(),snapshot:{version:0,learning:createSyntheticLearningState(now),rights:createEmptyRightsState()}},tokens.records);
    const ticket=await oldResume.suspend(tokens.publicTokens.child);
    assert.equal((await runtime.pool.query('SELECT child_stewardship.resume_capability_session($1) tenant',[ticket.resumeTicket])).rows[0].tenant,session);
    for(const value of [tokenDigest(ticket.resumeTicket),`cp-resume.${tokenDigest(ticket.resumeTicket).slice(0,43)}`])assert.equal((await runtime.pool.query('SELECT child_stewardship.resume_capability_session($1) tenant',[value])).rows[0].tenant,null);
    const outside:Record<string,RestoreAnchor>={[session]:{sessionId:session,checkpointId:'unadmitted',sequence:1,digest:'a'.repeat(64),keyRegistryVersion:'native-restore-keys-v1'}};
    await writeFile(anchorFile,JSON.stringify(outside));let reads=0;
    const provider=async(id:string)=>{reads++;const anchors=JSON.parse(await readFile(anchorFile,'utf8')) as Record<string,RestoreAnchor>;const anchor=anchors[id];assert.ok(anchor);return anchor;};
    const resumed=new PostgresChildResumeStore(db,provider);
    await assert.rejects(resumed.resume(ticket.resumeTicket),/RESTORATION_UNVERIFIED/);assert.equal(reads,0,'configured provider cannot downgrade to a schema without the restore gate');
    await owner.query(await readFile('services/api/prisma/child-stewardship-restore.sql','utf8'));
    await owner.query(`GRANT SELECT ON ALL TABLES IN SCHEMA child_stewardship TO ${runtime.role}`);await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${runtime.role}`);
    await assert.rejects(oldResume.resume(ticket.resumeTicket),/RESTORATION_UNVERIFIED/);await assert.rejects(resumed.resume(ticket.resumeTicket),/RESTORATION_UNVERIFIED/);
    assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.session_tokens WHERE session_id=$1',[session])).rows[0].n,5);
    assert.equal((await owner.query('SELECT consumed_at FROM child_stewardship.resume_tickets WHERE session_id=$1',[session])).rows[0].consumed_at,null);
    await owner.query(`CREATE ROLE ${verifierRole} LOGIN PASSWORD '${password}' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB`);await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${verifierRole}`);await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${verifierRole}`);await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${verifierRole}`);await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${verifierRole}`);await owner.query("INSERT INTO child_stewardship.restore_verifier_roles VALUES($1,1,true,'local-independent-synthetic-restore',clock_timestamp()+interval '1 hour')",[verifierRole]);
    const verifierUrl=new URL(url);verifierUrl.username=verifierRole;verifierUrl.password=password;verifierPool=new pg.Pool({connectionString:verifierUrl.toString()});
    const pairs=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')];
    const keys:RestoreCheckpointKey[]=pairs.map((pair,index)=>({keyId:`restore-key-${index}`,role:index===0?'protection':'trustee',controlDomain:`independent-fixture-${index}`,independentOfOperator:true,publicKey:pair.publicKey.export({type:'spki',format:'pem'}).toString(),revoked:false,validAfter:new Date(Date.now()-10000).toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()}));
    const roots=await nativeChildSql(owner).transaction(async connection=>{await connection.query("SELECT set_config('app.child_session_id',$1,true)",[session]);return(await connection.query<{roots:RestoreCheckpoint['roots']}>('SELECT child_stewardship.restore_state_roots($1::uuid) roots',[session]))[0]!.roots;});
    const checkpoint:RestoreCheckpoint={protocol:'CanopyProof-RestoreCheckpoint/1',environment:'SIMULATION_ONLY',domainSeparator:'canopyproof:synthetic:restore:v1',checkpointId:'admitted-resume',sequence:2,sessionId:session,keyRegistryVersion:'native-restore-keys-v1',issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),roots};
    outside[session]={sessionId:session,checkpointId:checkpoint.checkpointId,sequence:checkpoint.sequence,digest:childDigest(checkpoint),keyRegistryVersion:checkpoint.keyRegistryVersion};await writeFile(anchorFile,JSON.stringify(outside));
    const verifier=new ChildRestoreVerifier(nativeChildSql(verifierPool),provider,{version:checkpoint.keyRegistryVersion,keys});
    await verifier.verifyAndAdmit(session,{checkpoint,signatures:pairs.map((pair,index)=>({keyId:keys[index]!.keyId,signature:sign(null,Buffer.from(stableJson(checkpoint)),pair.privateKey).toString('base64url')}))});
    const fresh=await resumed.resume(ticket.resumeTicket);assert.ok(fresh.tokens.child);
    assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.session_tokens WHERE session_id=$1',[session])).rows[0].n,10);
    const beforeReads=reads;outside[session]={...outside[session]!,checkpointId:'newer-outside-anchor',sequence:3,digest:'b'.repeat(64)};await writeFile(anchorFile,JSON.stringify(outside));
    await assert.rejects(resumed.suspend(fresh.tokens.child),/RESTORATION_UNVERIFIED/);assert.ok(reads>beforeReads,'same long-lived adapter rereads current outside-backup evidence');
    assert.equal((await owner.query('SELECT state FROM child_stewardship.session_resumption WHERE session_id=$1',[session])).rows[0].state,'active');
    assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.resume_tickets WHERE session_id=$1',[session])).rows[0].n,1);
    await rm(anchorFile);await assert.rejects(resumed.suspend(fresh.tokens.child),/RESTORATION_UNVERIFIED/);
    await owner.query('DROP FUNCTION child_stewardship.resume_capability_session(text)');await assert.rejects(resumed.suspend(fresh.tokens.child),/RESTORATION_UNVERIFIED/);
  }finally{await verifierPool?.end();await runtime?.close();await owner.query(`DROP OWNED BY ${verifierRole}`).catch(()=>{});await owner.end();await admin.query(`DROP DATABASE ${database}`);await admin.query(`DROP ROLE IF EXISTS ${verifierRole}`);await admin.end();await rm(directory,{recursive:true,force:true});}
});
