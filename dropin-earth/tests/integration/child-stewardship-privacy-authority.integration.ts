import assert from 'node:assert/strict';
import { generateKeyPairSync, randomBytes, randomUUID, sign } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { PostgresChildStore, type ChildSqlClient, type ChildSqlConnection } from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import { createSyntheticLearningState, executeLearningCommand } from '../../services/api/src/domain/child-stewardship/learning.js';
import { ChildPrivacyWorker } from '../../services/api/src/domain/child-stewardship/privacy.js';
import { ChildRestoreVerifier, type RestoreAnchor, type RestoreCheckpoint, type RestoreCheckpointKey } from '../../services/api/src/domain/child-stewardship/restore-checkpoint.js';
import { childDigest, stableJson } from '../../services/api/src/domain/child-stewardship/store.js';
import { assertChildRestoreReady } from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import { createSyntheticRightsFixture, now } from '../fixtures/child-stewardship-rights.js';

function sql(client:pg.Client):ChildSqlClient {
  const connection:ChildSqlConnection={async query<T extends Record<string,unknown>>(query:string,values:unknown[]=[]):Promise<T[]>{return(await client.query(query,values)).rows as T[];}};
  return {...connection,async transaction<T>(run:(db:ChildSqlConnection)=>Promise<T>){await client.query('BEGIN');try{const value=await run(connection);await client.query('COMMIT');return value;}catch(error){await client.query('ROLLBACK');throw error;}}};
}
const message=(value:string)=>(error:unknown)=>error instanceof Error&&error.message===value;
const denied=(error:unknown)=>error instanceof Error&&'code'in error&&['42501','23514'].includes(String(error.code));

test('native privacy authority: exact erasure, suppression and separate worker privilege',{timeout:120_000},async t=>{
  assert.equal(process.env.CANOPYPROOF_NATIVE_TEST_CONFIRM,'confirm-disposable-test-database');
  const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL??'');assert.ok(['127.0.0.1','localhost'].includes(url.hostname));
  const suffix=randomUUID().replaceAll('-',''),database=`privacy_authority_${suffix}`,runtime=`privacy_runtime_${suffix}`,workerRole=`privacy_worker_${suffix}`;
  const admin=new pg.Client({connectionString:url.toString()});await admin.connect();await admin.query(`CREATE DATABASE ${database}`);url.pathname=`/${database}`;
  const runtimePassword=randomBytes(32).toString('hex'),workerPassword=randomBytes(32).toString('hex');
  const runtimeUrl=new URL(url);runtimeUrl.username=runtime;runtimeUrl.password=runtimePassword;
  const workerUrl=new URL(url);workerUrl.username=workerRole;workerUrl.password=workerPassword;
  const owner=new pg.Client({connectionString:url.toString()}),app=new pg.Client({connectionString:runtimeUrl.toString()}),worker=new pg.Client({connectionString:workerUrl.toString()});await owner.connect();
  try {
    for(const file of ['child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-privacy.sql'])await owner.query(await readFile(`services/api/prisma/${file}`,'utf8'));
    for(const role of [runtime,workerRole]){
      await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD '${role===runtime?runtimePassword:workerPassword}' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB`);
      // Broad grants in this disposable fixture verify that guards still reject escalation.
      await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
    }
    await owner.query("INSERT INTO child_stewardship.service_role_scopes SELECT $1,unnest(ARRAY['bootstrap','guardian','child','reviewer','protector','operator']),1,true,'disposable-privacy-runtime',clock_timestamp()+interval '1 hour'",[runtime]);
    await owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,1,true,'disposable-privacy-worker',clock_timestamp()+interval '1 hour')",[workerRole]);
    await app.connect();await worker.connect();
    assert.deepEqual((await worker.query('SELECT current_user,session_user')).rows[0],{current_user:workerRole,session_user:workerRole});
    async function scope<T>(client:pg.Client,session:string,request:string,run:()=>Promise<T>):Promise<T>{return sql(client).transaction(async()=>{
      await client.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_privacy_request_id',$2,true),set_config('app.child_actor_role','guardian',true),set_config('app.child_actor_id','demo-guardian',true)",[session,request]);return run();
    });}
    async function seed(external=false,issueJob=true,kind='delete_learning',expiresAt='2027-01-01',mixed=false){
      let learning=createSyntheticLearningState(now);const principal={actorId:'demo-guardian',deviceId:'demo-device-guardian',epoch:1};
      learning=executeLearningCommand(learning,{type:'create-profile',commandId:'demo-profile-create',expectedVersion:0,profileId:'demo-profile',ageBand:'9-12',locale:'en',nickname:'leaf'},principal,now).state;
      if(mixed)learning=executeLearningCommand(learning,{type:'request-privacy',kind:'export_learning',profileId:'demo-profile',commandId:'demo-export-before-delete',expectedVersion:learning.version},principal,now).state;
      learning=executeLearningCommand(learning,{type:'request-privacy',kind,profileId:'demo-profile',commandId:'demo-profile-delete',expectedVersion:learning.version},principal,now).state;
      const f=createSyntheticRightsFixture(),session=randomUUID(),request=Object.keys(learning.privacyRequests).at(-1)!;
      await new PostgresChildStore(sql(app)).create({id:session,expiresAt,snapshot:{version:0,learning,rights:f.funded(100),rightsContext:f.context}},[]);
      await scope(app,session,request,async()=>{
        await app.query("INSERT INTO child_stewardship.privacy_objects(session_id,object_id,profile_id,purpose,kind,content,external) VALUES($1,'resource-a','demo-profile','learning',$2,$3,$4)",[session,external?'processor':'source',external?null:Buffer.from('ONLY SYNTHETIC FIXTURE'),external]);
        if(issueJob)for(const item of Object.values(learning.privacyRequests))await app.query("INSERT INTO child_stewardship.privacy_jobs(session_id,request_id,profile_id,requested_by,kind,policy_version) VALUES($1,$2,'demo-profile','demo-guardian',$4,$3)",[session,item.id,learning.policyVersion,item.kind]);
      });return{session,request,learning};
    }
    const first=await seed();const privacy=new ChildPrivacyWorker(sql(worker));
    await t.test('actual worker deletes local stored bytes and linked profile records, preserving rights and replay facts',async()=>{
      assert.deepEqual(await privacy.process(first.session,first.request),{state:'completed'});
      for(const [table,expected]of [['privacy_objects',0],['entitlement_balances',1],['funding_balances',1],['rights_nonces',4],['privacy_suppressions',1]]as const){assert.equal((await owner.query(`SELECT count(*)::int n FROM child_stewardship.${table} WHERE session_id=$1`,[first.session])).rows[0].n,expected);}
      assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.state_records WHERE session_id=$1 AND domain='learning' AND collection='profiles'",[first.session])).rows[0].n,0);
      assert.ok((await owner.query('SELECT count(*)::int n FROM child_stewardship.privacy_receipts WHERE session_id=$1',[first.session])).rows[0].n>=2);
    });
    await t.test('renamed profile with suppressed canonical identity cannot resurrect processing',async()=>{
      const original=first.learning.profiles['demo-profile']!;
      await assert.rejects(()=>scope(app,first.session,first.request,()=>app.query("INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision) VALUES($1,'learning','profiles','demo-renamed',$2::jsonb,2)",[first.session,JSON.stringify({...original,id:'demo-renamed'})])),message('CHILD_PRIVACY_PROFILE_SUPPRESSED'));
      await assert.rejects(()=>scope(app,first.session,first.request,()=>app.query("INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision) VALUES($1,'learning','aliases','demo-new-alias',$2::jsonb,2)",[first.session,JSON.stringify(original.canonicalParticipantRef)])),message('CHILD_PRIVACY_PROFILE_SUPPRESSED'));
    });
    await t.test('worker cannot mint tokens, rewrite financial authority or mix runtime scopes',async()=>{
      await assert.rejects(()=>scope(worker,first.session,first.request,()=>worker.query("INSERT INTO child_stewardship.session_tokens VALUES($1,$2,'demo-guardian','forged-device',1)",['a'.repeat(64),first.session])),message('CHILD_PRIVACY_WORKER_NARROW_SCOPE'));
      await assert.rejects(()=>scope(worker,first.session,first.request,()=>worker.query("DELETE FROM child_stewardship.state_records WHERE session_id=$1 AND domain='rights' AND collection='entitlements'",[first.session])),denied);
      await assert.rejects(()=>owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'operator',1,true,'must-not-mix',clock_timestamp()+interval '1 hour')",[workerRole]),message('CHILD_PRIVACY_WORKER_MUST_BE_SEPARATE'));
      await assert.rejects(()=>owner.query("INSERT INTO child_stewardship.privacy_worker_roles VALUES($1,1,true,'must-not-mix',clock_timestamp()+interval '1 hour')",[runtime]),message('CHILD_PRIVACY_WORKER_MUST_BE_SEPARATE'));
    });
    await t.test('ordinary runtime cannot spoof worker role, deletion plans or completion receipts',async()=>{
      await assert.rejects(()=>scope(app,first.session,first.request,async()=>{await app.query("SELECT set_config('app.child_actor_role','privacy-worker',true)");await app.query("UPDATE child_stewardship.privacy_jobs SET state='processing',completed_at=NULL WHERE session_id=$1",[first.session]);}),denied);
      await assert.rejects(()=>scope(app,first.session,first.request,()=>app.query("INSERT INTO child_stewardship.privacy_plan_items VALUES($1,$2,'learning','profiles','demo-profile',$3,'erase','purpose_ended')",[first.session,first.request,'a'.repeat(64)])),denied);
      await assert.rejects(()=>scope(app,first.session,first.request,()=>app.query("INSERT INTO child_stewardship.privacy_receipts(session_id,request_id,resource_kind,resource_ref,content_digest,outcome) VALUES($1,$2,'object','forged',$3,'deleted')",[first.session,first.request,'a'.repeat(64)])),message('CHILD_PRIVACY_RECEIPT_INTERNAL_ONLY'));
      await assert.rejects(()=>scope(worker,first.session,first.request,()=>worker.query("DELETE FROM child_stewardship.privacy_receipts WHERE session_id=$1",[first.session])),message('CHILD_PRIVACY_HISTORY_IMMUTABLE'));
    });
    await t.test('SECURITY DEFINER retention helpers cannot reveal another tenant or disclose holds to runtime roles',async()=>{
      const other=await seed();await owner.query("INSERT INTO child_stewardship.privacy_legal_holds VALUES($1,'demo-profile','hold-a','synthetic-admitted-hold',clock_timestamp()+interval '1 hour')",[other.session]);
      const query="SELECT child_stewardship.privacy_profile_held($1,'demo-profile') held,child_stewardship.privacy_retention_valid($1,$2,'learning','profiles','demo-profile') valid";
      const ordinary=await scope(app,other.session,other.request,()=>app.query(query,[other.session,other.request]));assert.equal(ordinary.rows[0].held,false);assert.equal(ordinary.rows[0].valid,false);
      const cross=await scope(worker,first.session,first.request,()=>worker.query(query,[other.session,other.request]));assert.equal(cross.rows[0].held,false);assert.equal(cross.rows[0].valid,false);
      const same=await scope(worker,other.session,other.request,()=>worker.query(query,[other.session,other.request]));assert.equal(same.rows[0].held,true);assert.equal(same.rows[0].valid,true);
    });
    await t.test('unconnected external inventory remains waiting and cannot be marked deleted or completed',async()=>{
      const x=await seed(true);assert.deepEqual(await privacy.process(x.session,x.request),{state:'waiting'});
      assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.privacy_receipts WHERE session_id=$1 AND outcome='pending_processor'",[x.session])).rows[0].n,1);
      await assert.rejects(()=>scope(worker,x.session,x.request,async()=>{await worker.query("UPDATE child_stewardship.privacy_jobs SET state='processing' WHERE session_id=$1",[x.session]);await worker.query("DELETE FROM child_stewardship.privacy_objects WHERE session_id=$1",[x.session]);}),message('CHILD_PRIVACY_OBJECT_DELETE_SCOPE'));
      await assert.rejects(()=>scope(worker,x.session,x.request,async()=>{await worker.query("UPDATE child_stewardship.privacy_jobs SET state='processing' WHERE session_id=$1",[x.session]);await worker.query("UPDATE child_stewardship.privacy_jobs SET state='completed',completed_at=clock_timestamp() WHERE session_id=$1",[x.session]);await worker.query("SELECT set_config('app.child_session_id','00000000-0000-0000-0000-000000000000',true)");}),message('CHILD_PRIVACY_PROCESSING_PENDING'));
    });
    await t.test('processing job alone cannot authorize an unplanned tuple or wrong content digest',async()=>{
      const x=await seed();
      await assert.rejects(()=>scope(worker,x.session,x.request,async()=>{await worker.query("UPDATE child_stewardship.privacy_jobs SET state='processing' WHERE session_id=$1",[x.session]);await worker.query("DELETE FROM child_stewardship.state_records WHERE session_id=$1 AND collection='profiles'",[x.session]);}),denied);
      await assert.rejects(()=>scope(worker,x.session,x.request,async()=>{await worker.query("UPDATE child_stewardship.privacy_jobs SET state='processing' WHERE session_id=$1",[x.session]);await worker.query("INSERT INTO child_stewardship.privacy_plan_items VALUES($1,$2,'learning','profiles','demo-profile',$3,'erase','purpose_ended')",[x.session,x.request,'a'.repeat(64)]);}),message('CHILD_PRIVACY_PLAN_SCOPE'));
      assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.state_records WHERE session_id=$1 AND collection='profiles'",[x.session])).rows[0].n,1);
    });
    await t.test('real restore quarantine blocks export and deletion until current outside-backup retention evidence is verified',async()=>{
      const exported=await seed(false,true,'export_learning'),deleted=await seed();
      const expiringAt=new Date(Date.now()+1500).toISOString();
      const expiredDelete=await seed(false,true,'delete_learning',expiringAt,true),staleDelete=await seed(false,true,'delete_learning',expiringAt),expiredExport=await seed(false,true,'export_learning',expiringAt);
      const reapedExport=await seed(false,true,'export_learning',expiringAt);
      await new ChildPrivacyWorker(sql(worker),500).process(reapedExport.session,reapedExport.request);
      await owner.query(await readFile('services/api/prisma/child-stewardship-restore.sql','utf8'));
      await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${workerRole}`);
      assert.equal(await privacy.ready(),false,'restore module requires an independently current provider');
      await assert.rejects(privacy.process(exported.session,exported.request),/RESTORATION_UNVERIFIED/);
      assert.equal((await owner.query('SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1',[exported.session])).rows[0].state,'requested');
      assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.privacy_objects WHERE session_id=$1 AND kind='export'",[exported.session])).rows[0].n,0);
      for(const operation of [()=>privacy.process(deleted.session,deleted.request),()=>privacy.expireExports(deleted.session),()=>privacy.processSession(deleted.session)])await assert.rejects(operation,/RESTORATION_UNVERIFIED/);
      assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.privacy_objects WHERE session_id=$1',[deleted.session])).rows[0].n,1);
      assert.equal((await owner.query('SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1',[deleted.session])).rows[0].state,'requested');
      assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.privacy_receipts WHERE session_id=$1',[deleted.session])).rows[0].n,0);
      const verifierRole=`privacy_restore_${suffix}`,verifierPassword=randomBytes(32).toString('hex');
      await owner.query(`CREATE ROLE ${verifierRole} LOGIN PASSWORD '${verifierPassword}' NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB`);
      await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${verifierRole}`);
      await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${verifierRole}`);
      await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${verifierRole}`);
      await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${verifierRole}`);
      await owner.query("INSERT INTO child_stewardship.restore_verifier_roles VALUES($1,1,true,'disposable-expired-cleanup-checkpoint',clock_timestamp()+interval '1 hour')",[verifierRole]);
      const verifierUrl=new URL(url);verifierUrl.username=verifierRole;verifierUrl.password=verifierPassword;
      const verifierClient=new pg.Client({connectionString:verifierUrl.toString()});await verifierClient.connect();
      try{
        const outside=new Map<string,RestoreAnchor>();
        const provider=async(session:string)=>{const anchor=outside.get(session);assert.ok(anchor);return structuredClone(anchor);};
        const pairs=[generateKeyPairSync('ed25519'),generateKeyPairSync('ed25519')];
        const keys:RestoreCheckpointKey[]=pairs.map((pair,index)=>({keyId:`cleanup-key-${index}`,role:index===0?'protection':'trustee',controlDomain:`independent-${index}`,independentOfOperator:true,publicKey:pair.publicKey.export({type:'spki',format:'pem'}).toString(),revoked:false,validAfter:new Date(Date.now()-10000).toISOString(),expiresAt:new Date(Date.now()+60000).toISOString()}));
        const verifier=new ChildRestoreVerifier(sql(verifierClient),provider,{version:'cleanup-keys-v1',keys});
        const admit=async(session:string,deadline=Date.now()+30000)=>{
          const roots=await scope(owner,session,'',async()=>(await owner.query('SELECT child_stewardship.restore_state_roots($1::uuid) roots',[session])).rows[0].roots as RestoreCheckpoint['roots']);
          const checkpoint:RestoreCheckpoint={protocol:'CanopyProof-RestoreCheckpoint/1',environment:'SIMULATION_ONLY',domainSeparator:'canopyproof:synthetic:restore:v1',checkpointId:`cleanup-${randomUUID()}`,sequence:1,sessionId:session,keyRegistryVersion:'cleanup-keys-v1',issuedAt:new Date().toISOString(),expiresAt:new Date(deadline).toISOString(),roots};
          outside.set(session,{sessionId:session,checkpointId:checkpoint.checkpointId,sequence:1,digest:childDigest(checkpoint),keyRegistryVersion:checkpoint.keyRegistryVersion});
          await verifier.verifyAndAdmit(session,{checkpoint,signatures:pairs.map((pair,index)=>({keyId:keys[index]!.keyId,signature:sign(null,Buffer.from(stableJson(checkpoint)),pair.privateKey).toString('base64url')}))});
        };
        await new Promise(resolve=>setTimeout(resolve,Math.max(0,Date.parse(expiringAt)-Date.now()+25)));
        for(const fixture of [expiredDelete,staleDelete,expiredExport,reapedExport])await admit(fixture.session);
        const admittedWorker=new ChildPrivacyWorker(sql(worker),3600000,provider);
        await assert.rejects(scope(worker,expiredDelete.session,expiredDelete.request,()=>assertChildRestoreReady(sql(worker),expiredDelete.session,provider)),/RESTORATION_UNVERIFIED/,'expired interactive session remains closed');
        const old=outside.get(staleDelete.session)!;outside.set(staleDelete.session,{...old,sequence:2,digest:'f'.repeat(64)});
        for(const action of [()=>admittedWorker.process(staleDelete.session,staleDelete.request),()=>admittedWorker.expireExports(staleDelete.session),()=>admittedWorker.processSession(staleDelete.session)])await assert.rejects(action,/RESTORATION_UNVERIFIED/);
        assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.privacy_objects WHERE session_id=$1',[staleDelete.session])).rows[0].n,1);
        assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.privacy_receipts WHERE session_id=$1',[staleDelete.session])).rows[0].n,0);
        assert.deepEqual(await admittedWorker.processSession(expiredDelete.session),{processed:1,completed:1,waiting:0,exportsExpired:0,more:false},'expired pending export does not starve deletion');
        assert.equal((await owner.query("SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1 AND kind='export_learning'",[expiredDelete.session])).rows[0].state,'requested');
        assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.privacy_objects WHERE session_id=$1',[expiredDelete.session])).rows[0].n,0);
        assert.equal(await admittedWorker.expireExports(reapedExport.session),1);
        await assert.rejects(admittedWorker.process(expiredExport.session,expiredExport.request),/RESTORATION_UNVERIFIED/);
        assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.privacy_objects WHERE session_id=$1 AND kind='export'",[expiredExport.session])).rows[0].n,0);
        // A provider awaited after locking can outlive admission. Recheck the
        // current database clock after its answer, before export creation.
        const deadline=Date.now()+350;await admit(exported.session,deadline);
        const slowProvider=async(session:string)=>{await new Promise(resolve=>setTimeout(resolve,Math.max(0,deadline-Date.now()+25)));return provider(session);};
        await assert.rejects(new ChildPrivacyWorker(sql(worker),3600000,slowProvider).process(exported.session,exported.request),/RESTORATION_UNVERIFIED/);
        assert.equal((await owner.query("SELECT count(*)::int n FROM child_stewardship.privacy_objects WHERE session_id=$1 AND kind='export'",[exported.session])).rows[0].n,0);
        assert.equal((await owner.query('SELECT state FROM child_stewardship.privacy_jobs WHERE session_id=$1',[exported.session])).rows[0].state,'requested');
      }finally{await verifierClient.end();await owner.query(`DROP OWNED BY ${verifierRole}`);await owner.query(`DROP ROLE ${verifierRole}`);}

    });
    await t.test('rollback preserves suppression, minimal receipts and legal holds',async()=>{
      await owner.query(await readFile('services/api/prisma/child-stewardship-privacy.rollback.sql','utf8'));
      assert.equal((await owner.query('SELECT count(*)::int n FROM child_stewardship.privacy_suppressions WHERE session_id=$1',[first.session])).rows[0].n,1);
      assert.ok((await owner.query('SELECT count(*)::int n FROM child_stewardship.privacy_receipts WHERE session_id=$1',[first.session])).rows[0].n>0);
    });
  }finally{
    await app.end();await worker.end();await owner.end();await admin.query(`DROP DATABASE ${database}`);
    await admin.query(`DROP ROLE IF EXISTS ${runtime}`);await admin.query(`DROP ROLE IF EXISTS ${workerRole}`);await admin.end();
  }
});
