import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import {createSyntheticLearningState} from '../../services/api/src/domain/child-stewardship/learning.js';

test('native distributed synthetic API limits use fixed server quotas, current authority and short-lived minimal buckets', {timeout:120_000}, async t=>{
  assert.equal(process.env.CANOPYPROOF_NATIVE_TEST_CONFIRM,'confirm-disposable-test-database');
  const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL??'');
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  const suffix=randomUUID().replaceAll('-',''), database=`limit_native_${suffix}`,role=`limit_api_${suffix}`,otherRole=`limit_other_${suffix}`,password=randomUUID();
  const admin=new pg.Client({connectionString:url.toString()});await admin.connect();
  await admin.query(`CREATE DATABASE ${database}`);url.pathname=`/${database}`;
  const owner=new pg.Client({connectionString:url.toString()});await owner.connect();
  const clients:pg.Client[]=[];
  try{
    for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-rate-limit.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
    for(const name of [role,otherRole]){
      await owner.query(`CREATE ROLE ${name} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'`);
      await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${name}`);
      await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE ON ALL TABLES IN SCHEMA child_stewardship TO ${name}`);
      await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${name}`);
    }
    await owner.query("INSERT INTO child_stewardship.service_role_scopes SELECT $1,unnest(ARRAY['bootstrap','child','guardian','protector']),1,true,'native-rate-limit',clock_timestamp()+interval '1 hour'",[role]);
    for(let index=0;index<8;index++){
      const local=new URL(url);local.username=role;local.password=password;
      const client=new pg.Client({connectionString:local.toString()});await client.connect();clients.push(client);
    }
    const ownerRole=(await owner.query('SELECT current_user role')).rows[0].role;
    await owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'bootstrap',1,true,'owner-only-native-fixture',clock_timestamp()+interval '1 hour')",[ownerRole]);
    const seed=async(id:string,isExpired=false,actorState:'active'|'expired'|'revoked'='active')=>{
      await owner.query('BEGIN');
      try{
        await owner.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role','bootstrap',true),set_config('app.child_operation','bootstrap',true)",[id]);
        await owner.query("INSERT INTO child_stewardship.sessions(id,mode,expires_at,revision,storage_format) VALUES($1,'synthetic-demo',clock_timestamp()+$2::interval,0,'normalized-v2')",[id,isExpired?'-1 hour':'1 hour']);
        for(const actor of Object.values(createSyntheticLearningState(new Date().toISOString()).actors)){
          if(actor.id==='demo-child' && actorState==='revoked')actor.revoked=true;
          if(actor.id==='demo-child' && actorState==='expired')actor.expiresAt=new Date(Date.now()-60_000).toISOString();
          await owner.query("INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision) VALUES($1,'learning','actors',$2,$3::jsonb,0)",[id,actor.id,JSON.stringify(actor)]);
        }
        await owner.query('COMMIT');
      }catch(error){await owner.query('ROLLBACK');throw error;}
    };
    const session=randomUUID(),second=randomUUID(),expired=randomUUID();
    for(const id of [session,second,expired])await seed(id,id===expired);
    const bucket=(id:string,actor='demo-child')=>`${id}:${actor}`;
    const consume=async(client:pg.Client,kind:string,id:string|null=null,scope=id,actor='demo-child')=>{
      await client.query('BEGIN');
      try{
        await client.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_id',$2,true)",[scope??'',actor]);
        const result=await client.query('SELECT child_stewardship.consume_child_api_limit($1,$2::uuid) permitted',[kind,id]);
        await client.query('COMMIT');return result.rows[0].permitted as boolean;
      }catch(error){await client.query('ROLLBACK');throw error;}
    };
    const counts=async()=> (await owner.query('SELECT kind,bucket_id,window_start,consumed,expires_at FROM child_stewardship.api_rate_limits ORDER BY kind,bucket_id')).rows;
    const freshMinute=async()=>{
      // Avoid a natural boundary during the small parallel-capacity assertion.
      // Every wait is <=1s; window-expiry semantics below use an owner fixture.
      while((await owner.query('SELECT mod(extract(epoch FROM clock_timestamp())::numeric,60) seconds')).rows[0].seconds>54)await new Promise(resolve=>setTimeout(resolve,500));
    };
    await t.test('unscoped, privileged, invalid-kind and wrong-tenant calls cannot create counters',async()=>{
      assert.equal((await owner.query("SELECT child_stewardship.consume_child_api_limit('session_creation',NULL) permitted")).rows[0].permitted,false);
      const local=new URL(url);local.username=otherRole;local.password=password;
      const unscoped=new pg.Client({connectionString:local.toString()});await unscoped.connect();
      try{assert.equal(await consume(unscoped,'session_creation'),false);}finally{await unscoped.end();}
      assert.equal(await consume(clients[0]!,'forged-limit',session),false);
      assert.equal(await consume(clients[0]!,'session_creation',session),false);
      assert.equal(await consume(clients[0]!,'session_request',session,second),false);
      assert.equal(await consume(clients[0]!,'session_request',expired),false);
      assert.equal(await consume(clients[0]!,'session_request',session,session,''),false);
      assert.equal(await consume(clients[0]!,'session_request',session,session,'demo-forged'),false);
      assert.deepEqual(await counts(),[]);
    });
    await t.test('current expired or revoked actor records cannot acquire a request slot',async()=>{
      for(const state of ['expired','revoked'] as const){
        const target=randomUUID();await seed(target,false,state);
        assert.equal(await consume(clients[0]!,'session_request',target),false);
      }
      assert.deepEqual(await counts(),[]);
    });
    await t.test('eight independent PostgreSQL clients share exactly 1200 global creation slots',async()=>{
      await freshMinute();
      const results=(await Promise.all(clients.map(async client=>{
        const accepted:boolean[]=[];for(let index=0;index<151;index++)accepted.push(await consume(client,'session_creation'));return accepted;
      }))).flat();
      assert.equal(results.filter(Boolean).length,1200);assert.equal(results.filter(value=>!value).length,8);
      const rows=await counts();assert.equal(rows.length,1);assert.equal(rows[0].bucket_id,'global');assert.equal(rows[0].consumed,1200);
      assert.equal(rows[0].expires_at.getTime()-rows[0].window_start.getTime(),120_000);
    });
    await t.test('independent clients share 120 per-actor slots while another tenant has its own bucket',async()=>{
      await freshMinute();
      const results=(await Promise.all(clients.map(async client=>{
        const accepted:boolean[]=[];for(let index=0;index<16;index++)accepted.push(await consume(client,'session_request',session));return accepted;
      }))).flat();
      assert.equal(results.filter(Boolean).length,120);assert.equal(results.filter(value=>!value).length,8);
      assert.equal(await consume(clients[0]!,'session_request',second),true);
      assert.equal((await counts()).find(row=>row.bucket_id===bucket(session)).consumed,120);
      assert.equal((await counts()).find(row=>row.bucket_id===bucket(second)).consumed,1);
    });
    await t.test('hidden actor traffic leaves guardian allowance equivalent and guardian exhaustion cannot block child/protector',async()=>{
      await freshMinute();
      const run=async(client:pg.Client,id:string,actor:string,count:number)=>{const values:boolean[]=[];for(let i=0;i<count;i++)values.push(await consume(client,'session_request',id,id,actor));return values;};
      assert.equal((await run(clients[2]!,second,'demo-protector',80)).filter(Boolean).length,80);
      const [withoutHidden,withHidden]=await Promise.all([run(clients[0]!,session,'demo-guardian',121),run(clients[1]!,second,'demo-guardian',121)]);
      assert.deepEqual(withoutHidden,withHidden);assert.equal(withHidden.filter(Boolean).length,120);assert.equal(withHidden[120],false);
      assert.equal(await consume(clients[0]!,'session_request',second,second,'demo-child'),true);
      assert.equal(await consume(clients[1]!,'session_request',second,second,'demo-protector'),true);
    });
    await t.test('broad table grants cannot read/reset/insert/delete/truncate counters or use a client clock',async()=>{
      const client=clients[0]!,before=await counts();
      assert.equal((await client.query('SELECT * FROM child_stewardship.api_rate_limits')).rowCount,0);
      assert.equal((await client.query('UPDATE child_stewardship.api_rate_limits SET consumed=1')).rowCount,0);
      assert.equal((await client.query('DELETE FROM child_stewardship.api_rate_limits')).rowCount,0);
      await assert.rejects(client.query("INSERT INTO child_stewardship.api_rate_limits VALUES('session_creation','global',clock_timestamp(),1,clock_timestamp()+interval '2 minutes')"));
      await assert.rejects(client.query('TRUNCATE child_stewardship.api_rate_limits'),/CHILD_RATE_LIMIT_OWNER_ONLY/);
      await client.query("SELECT set_config('app.child_rate_limit','999999',false),set_config('app.child_clock','2099-01-01',false),set_config('TimeZone','Asia/Kathmandu',false)");
      assert.equal(await consume(client,'session_request',session),false);
      assert.deepEqual(await counts(),before);
      await client.query("SET TIME ZONE 'UTC'");
      const columns=(await owner.query("SELECT column_name FROM information_schema.columns WHERE table_schema='child_stewardship' AND table_name='api_rate_limits' ORDER BY ordinal_position")).rows.map(row=>row.column_name);
      assert.deepEqual(columns,['kind','bucket_id','window_start','consumed','expires_at']);
    });
    await t.test('idempotent migration preserves existing actor counters and SQL capacity constraints',async()=>{
      const before=await counts();
      await owner.query(await readFile('services/api/prisma/child-stewardship-rate-limit.sql','utf8'));
      assert.deepEqual(await counts(),before);
      await assert.rejects(owner.query("UPDATE child_stewardship.api_rate_limits SET consumed=121 WHERE bucket_id=$1",[bucket(session)]),/api_rate_limits_actor_capacity/);
    });
    await t.test('an expired window resets once and opportunistic cleanup removes stale minimal buckets',async()=>{
      const stale=bucket(randomUUID());
      await owner.query("UPDATE child_stewardship.api_rate_limits SET window_start=window_start-interval '5 minutes',expires_at=expires_at-interval '5 minutes' WHERE bucket_id=$1",[bucket(session)]);
      await owner.query("INSERT INTO child_stewardship.api_rate_limits VALUES('session_request',$1,to_timestamp(floor(extract(epoch FROM clock_timestamp())/60)*60)-interval '5 minutes',120,to_timestamp(floor(extract(epoch FROM clock_timestamp())/60)*60)-interval '3 minutes')",[stale]);
      assert.equal(await consume(clients[0]!,'session_request',session),true);
      const rows=await counts();assert.equal(rows.find(row=>row.bucket_id===bucket(session)).consumed,1);assert.equal(rows.some(row=>row.bucket_id===stale),false);
    });
    await t.test('internal purpose helpers remain owner-only despite broad EXECUTE and accept only fixed minimal scopes',async()=>{
      const scoped=`${second}:${'a'.repeat(64)}`;
      for(const name of ['lock_child_scoped_limit','consume_child_scoped_limit']){
        await assert.rejects(clients[0]!.query(`SELECT child_stewardship.${name}('session_resume',$1)`,[scoped]),/CHILD_RATE_LIMIT_OWNER_ONLY/);
      }
      for(const [kind,value] of [['session_cancel',scoped],['session_resume','raw-secret-token'],['session_resume',bucket(second)],['session_suspend',scoped],['session_creation','global']]){
        await assert.rejects(owner.query('SELECT child_stewardship.consume_child_scoped_limit($1,$2)',[kind,value]),/CHILD_RATE_LIMIT_INVALID_SCOPE/);
      }
      assert.equal((await counts()).some(row=>row.bucket_id===scoped),false);
    });
    await t.test('purpose quotas are fixed and independent from request and cancellation lanes',async()=>{
      await freshMinute();
      for(const [kind,value,capacity] of [
        ['session_suspend',bucket(second),12],
        ['session_resume',`${second}:${'b'.repeat(64)}`,12],
        ['agent_request',`${second}:${'c'.repeat(64)}`,120],
      ] as const){
        const results:boolean[]=[];
        for(let index=0;index<=capacity;index++)results.push((await owner.query('SELECT child_stewardship.consume_child_scoped_limit($1,$2) permitted',[kind,value])).rows[0].permitted);
        assert.equal(results.filter(Boolean).length,capacity);assert.equal(results.at(-1),false);
        const row=(await counts()).find(row=>row.kind===kind&&row.bucket_id===value);
        assert.equal(row.consumed,capacity);assert.equal(row.expires_at-row.window_start,120_000);
      }
      assert.equal(await consume(clients[0]!,'session_request',second),true);
      assert.equal((await counts()).some(row=>row.kind==='session_cancel'),false);
    });
    await t.test('current registry revocation and added role membership deny further admission',async()=>{
      await owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'child',2,false,'native-revoked',clock_timestamp()+interval '1 hour')",[role]);
      const before=await counts();assert.equal(await consume(clients[0]!,'session_request',second),false);assert.deepEqual(await counts(),before);
      await owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'child',3,true,'native-restored',clock_timestamp()+interval '1 hour')",[role]);
      await owner.query(`GRANT ${otherRole} TO ${role}`);
      try{assert.equal(await consume(clients[0]!,'session_request',second),false);assert.deepEqual(await counts(),before);}finally{await owner.query(`REVOKE ${otherRole} FROM ${role}`);}
    });
    await t.test('expiry is rechecked after an actual bucket lock wait',async()=>{
      const target=randomUUID();await seed(target);
      const pid=(await clients[0]!.query('SELECT pg_backend_pid() pid')).rows[0].pid;
      await owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'child',4,true,'native-short-lease',clock_timestamp()+interval '650 milliseconds')",[role]);
      await owner.query('BEGIN');await owner.query("SELECT pg_advisory_xact_lock(hashtextextended('child-api-limit:session_request:'||$1,0))",[bucket(target)]);
      const pending=consume(clients[0]!,'session_request',target);
      try{
        let blocked=false;
        for(let attempt=0;attempt<30;attempt++){
          if((await admin.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock'){blocked=true;break;}
          await new Promise(resolve=>setTimeout(resolve,10));
        }
        assert.equal(blocked,true,'independent connection must wait on the actual bucket lock');
        await new Promise(resolve=>setTimeout(resolve,800));
      }finally{await owner.query('COMMIT');}
      assert.equal(await pending,false);assert.equal((await counts()).some(row=>row.bucket_id===bucket(target)),false);
    });
  }finally{
    await Promise.all(clients.map(client=>client.end()));await owner.end();
    await admin.query(`DROP DATABASE ${database}`);await admin.query(`DROP ROLE IF EXISTS ${role}`);await admin.query(`DROP ROLE IF EXISTS ${otherRole}`);await admin.end();
  }
});
