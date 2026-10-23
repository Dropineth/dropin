import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { createSyntheticRightsFixture, now } from '../fixtures/child-stewardship-rights.js';
import { createSyntheticLearningState } from '../../services/api/src/domain/child-stewardship/learning.js';
import { PostgresChildStore, type ChildSqlClient, type ChildSqlConnection } from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import { ChildRightsVerifier } from '../../services/api/src/domain/child-stewardship/verifier-admission.js';
import type { RightsOperation, RightsState } from '../../services/api/src/domain/child-stewardship/rights-types.js';

type Fixture = ReturnType<typeof createSyntheticRightsFixture>;
type Mutation = {collection:string;record_id:string;payload:unknown};
type Admission = {approved_mutations:Mutation[];expected_revision:string};
function disposableUrl():URL {
  assert.equal(process.env.CANOPYPROOF_NATIVE_TEST_CONFIRM,'confirm-disposable-test-database');
  const url=new URL(process.env.CANOPYPROOF_NATIVE_DATABASE_URL??'');
  assert.ok(['127.0.0.1','localhost'].includes(url.hostname));return url;
}
function sql(client:pg.Client):ChildSqlClient {
  const connection:ChildSqlConnection={async query<T extends Record<string,unknown>>(query:string,values:unknown[]=[]):Promise<T[]>{return (await client.query(query,values)).rows as T[];}};
  return {...connection,async transaction<T>(run:(db:ChildSqlConnection)=>Promise<T>){await client.query('BEGIN');try{const result=await run(connection);await client.query('COMMIT');return result;}catch(error){await client.query('ROLLBACK');throw error;}}};
}
async function transaction<T>(client:pg.Client,session:string,role:string,operation:string,opid:string,run:()=>Promise<T>):Promise<T>{
  await client.query('BEGIN');try{
    await client.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role',$2,true),set_config('app.child_operation',$3,true),set_config('app.child_operation_id',$4,true)",[session,role,operation,opid]);
    const value=await run();await client.query('COMMIT');return value;
  }catch(error){await client.query('ROLLBACK');throw error;}
}
async function insert(client:pg.Client,session:string,domain:string,collection:string,id:string,payload:unknown,revision=1){
  await client.query('INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision) VALUES($1,$2,$3,$4,$5::jsonb,$6)',[session,domain,collection,id,JSON.stringify(payload),revision]);
}
async function update(client:pg.Client,session:string,domain:string,collection:string,id:string,payload:unknown,revision=1){
  await client.query('UPDATE child_stewardship.state_records SET payload=$5::jsonb,revision=$6 WHERE session_id=$1 AND domain=$2 AND collection=$3 AND record_id=$4',[session,domain,collection,id,JSON.stringify(payload),revision]);
}
const code=(expected:string)=>(error:unknown)=>error instanceof Error&&'code' in error&&error.code===expected;
const message=(expected:string)=>(error:unknown)=>error instanceof Error&&error.message===expected;

test('native PostgreSQL independently admitted canonical authority and isolation',{timeout:120_000},async t=>{
  const url=disposableUrl(),admin=new pg.Client({connectionString:url.toString()});await admin.connect();
  const suffix=randomUUID().replaceAll('-',''),database=`child_authority_${suffix}`;
  const runtimeRole=`child_runtime_${suffix}`,registryRole=`child_registry_${suffix}`,verifierRole=`child_verifier_${suffix}`;
  await admin.query(`CREATE DATABASE ${database}`);url.pathname=`/${database}`;
  const owner=new pg.Client({connectionString:url.toString()});await owner.connect();const clients:pg.Client[]=[];
  try{
    await owner.query(await readFile('services/api/prisma/child-stewardship.sql','utf8'));
    await owner.query(await readFile('services/api/prisma/child-stewardship-authority.sql','utf8'));
    async function scoped(role:string,scopes:string[]){
      await owner.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
      // Deliberately broad local fixture grants exercise the restrictive trigger/RLS boundary.
      await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
      await owner.query("INSERT INTO child_stewardship.service_role_scopes SELECT $1,unnest($2::text[]),1,true,'local-disposable-fixture',clock_timestamp()+interval '1 hour'",[role,scopes]);
    }
    await scoped(runtimeRole,['bootstrap','guardian','child','reviewer','protector','operator']);
    await scoped(registryRole,['operator','registry-publisher']);await scoped(verifierRole,['operation-verifier']);
    async function connect(role:string){const client=new pg.Client({connectionString:url.toString()});await client.connect();await client.query(`SET ROLE ${role}`);clients.push(client);return client;}
    const a=await connect(runtimeRole),b=await connect(runtimeRole),publisher=await connect(registryRole),verification=await connect(verifierRole);
    const verifier=new ChildRightsVerifier(sql(verification));
    async function seed(f= createSyntheticRightsFixture(),state?:RightsState){
      const session=randomUUID(),rights=state??f.funded(100);
      await new PostgresChildStore(sql(a)).create({id:session,expiresAt:'2027-01-01',snapshot:{version:0,learning:createSyntheticLearningState(now),rights,rightsContext:f.context}},[]);
      return {session,f,state:rights};
    }
    async function count(session:string,table:string){return transaction(a,session,'operator','read','',async()=>Number((await a.query(`SELECT count(*) FROM child_stewardship.${table} WHERE session_id=$1`,[session])).rows[0].count));}
    async function admit(session:string,f:Fixture,op:RightsOperation,ids=['g','r1','t']):Promise<Admission>{
      await verifier.admit(session,op,f.approvals(op,ids),now);
      return transaction(a,session,'operator','read','',async()=>(await a.query('SELECT approved_mutations,expected_revision::text FROM child_stewardship.verification_admissions WHERE session_id=$1 AND operation_id=$2',[session,op.operationId])).rows[0] as Admission);
    }
    async function persist(client:pg.Client,session:string,op:RightsOperation,admission:Admission,options:{mutations?:Mutation[];after?:()=>Promise<unknown>}={}){
      return transaction(client,session,'operator',op.operationType,op.operationId,async()=>{
        for(const m of options.mutations??admission.approved_mutations){
          await client.query(`INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision,position)
            VALUES($1,'rights',$2,$3,$4::jsonb,$5,coalesce((SELECT position FROM child_stewardship.state_records WHERE session_id=$1 AND domain='rights' AND collection=$2 AND record_id=$3),(SELECT coalesce(max(position)+1,0) FROM child_stewardship.state_records WHERE session_id=$1 AND domain='rights' AND collection=$2)))
            ON CONFLICT(session_id,domain,collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,revision=EXCLUDED.revision`,[session,m.collection,m.record_id,JSON.stringify(m.payload),Number(admission.expected_revision)+1]);
        }
        await client.query('UPDATE child_stewardship.sessions SET revision=$2 WHERE id=$1',[session,Number(admission.expected_revision)+1]);
        await options.after?.();
      });
    }
    const initial=await seed(),session=initial.session,other=(await seed()).session;
    await t.test('normalized obligations, funding and bootstrap signatures persist without aggregate authority',async()=>{
      assert.equal(await count(session,'entitlement_balances'),1);assert.equal(await count(session,'funding_balances'),1);assert.equal(await count(session,'signed_approvals'),4);
      assert.equal((await owner.query('SELECT snapshot FROM child_stewardship.sessions WHERE id=$1',[session])).rows[0].snapshot,null);
    });
    await t.test('FORCE RLS isolates canonical balances, registry admissions and verification proofs',async()=>{
      await transaction(a,session,'operator','read','',async()=>{for(const table of ['entitlement_balances','funding_balances','state_records','registry_decisions','verification_admissions'])assert.equal((await a.query(`SELECT count(*) FROM child_stewardship.${table} WHERE session_id=$1`,[other])).rows[0].count,'0');});
      await assert.rejects(()=>transaction(a,session,'operator','read','',()=>insert(a,other,'rights','economicKeys','cross-tenant','cross-tenant')),code('42501'));
      const forced=await owner.query("SELECT bool_and(relrowsecurity AND relforcerowsecurity) forced FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='child_stewardship' AND c.relname IN ('state_records','verification_admissions','verification_uses','session_births','authority_journal')");assert.equal(forced.rows[0].forced,true);
    });
    await t.test('runtime cannot directly alter balances, immutable history, parent facts or role scopes',async()=>{
      await assert.rejects(()=>transaction(a,session,'operator','PAY_PROTECTED','fake',()=>a.query('UPDATE child_stewardship.entitlement_balances SET amount_minor=1 WHERE session_id=$1',[session])),code('42501'));
      await assert.rejects(()=>transaction(a,session,'operator','read','',()=>a.query('DELETE FROM child_stewardship.authority_journal WHERE session_id=$1',[session])),code('23514'));
      await assert.rejects(()=>transaction(a,session,'operator','read','',()=>a.query('DELETE FROM child_stewardship.sessions WHERE id=$1',[session])));
      await assert.rejects(()=>a.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'operator',2,true,'self-approved',clock_timestamp()+interval '1 hour')",[runtimeRole]),code('42501'));
      await assert.rejects(()=>owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'operation-verifier',1,true,'mixed',clock_timestamp()+interval '1 hour')",[runtimeRole]),code('23514'));
    });
    await t.test('guardian and ordinary operator cannot self-admit financial signature JSON',async()=>{
      await assert.rejects(()=>transaction(a,session,'guardian','PAY_PROTECTED','fake',()=>insert(a,session,'rights','economicKeys','fake','fake')),code('42501'));
      await assert.rejects(()=>transaction(a,session,'operator','PAUSE','fake',()=>insert(a,session,'rights','approvalRecords','fake',{operation:{operationId:'fake',environment:'SIMULATION_ONLY',currency:'XTS'},approvals:[{}],approvalDigest:'a'.repeat(64)})),message('CHILD_VERIFIED_ADMISSION_REQUIRED'));
      await assert.rejects(()=>transaction(a,session,'operator','PAUSE','fake',()=>a.query("INSERT INTO child_stewardship.verification_admissions VALUES($1,'fake',$2,$2,$2,$2,0,$3::jsonb,clock_timestamp()+interval '1 hour','self-admitted')",[session,'a'.repeat(64),JSON.stringify([{collection:'economicKeys',record_id:'fake',payload:'fake'}])])),code('42501'));
    });
    await t.test('actual separate verifier rejects invalid Ed25519 before any admission exists',async()=>{
      const x=await seed(),op=x.f.payment(),approvals=x.f.approvals(op,['g','r1','t']);approvals[0]!.signatureBase64=Buffer.alloc(64).toString('base64');
      await assert.rejects(()=>verifier.admit(x.session,op,approvals,now),/INVALID_SIGNATURE/);assert.equal(await count(x.session,'verification_admissions'),0);
    });
    await t.test('exact cryptographically verified payment commits all canonical records once',async()=>{
      const x=await seed(),op=x.f.payment(40),admission=await admit(x.session,x.f,op);await persist(a,x.session,op,admission);
      assert.equal(await count(x.session,'payment_facts'),1);assert.equal(await count(x.session,'verification_uses'),1);
      await assert.rejects(()=>persist(a,x.session,op,admission));
      assert.equal((await owner.query('SELECT submitted_minor,vested_minor FROM child_stewardship.funding_balances WHERE session_id=$1',[x.session])).rows[0].submitted_minor,'40');
    });
    await t.test('valid signatures cannot authorize changed amount, destination or funding bucket',async()=>{
      const x=await seed(),op=x.f.payment(40),admission=await admit(x.session,x.f,op);
      for(const mutate of [(p:Record<string,unknown>)=>({...p,amountMinor:41}),(p:Record<string,unknown>)=>({...p,recipientDestinationDigest:'b'.repeat(64)})]){
        const changes=structuredClone(admission.approved_mutations),payment=changes.find(m=>m.collection==='payments')!;payment.payload=mutate(payment.payload as Record<string,unknown>);
        await assert.rejects(()=>persist(a,x.session,op,admission,{mutations:changes}),message('CHILD_UNAPPROVED_STATE_MUTATION'));
      }
      const changes=structuredClone(admission.approved_mutations),lot=changes.find(m=>m.collection==='fundingLots')!;const value=lot.payload as {allocations:Record<string,{submittedMinor:number;vestedMinor:number}>};value.allocations['entitlement-a']!.submittedMinor=100;value.allocations['entitlement-a']!.vestedMinor=0;
      await assert.rejects(()=>persist(a,x.session,op,admission,{mutations:changes}),message('CHILD_UNAPPROVED_STATE_MUTATION'));
      assert.equal(await count(x.session,'payment_facts'),0);assert.equal(await count(x.session,'verification_uses'),0);
    });
    await t.test('omitting nonce or cumulative budget writes cannot commit an approved subset',async()=>{
      const x=await seed(),op=x.f.payment(40),admission=await admit(x.session,x.f,op);
      for(const omitted of ['consumedNonces','cumulativeAmounts']){
        assert.ok(admission.approved_mutations.some(m=>m.collection===omitted));
        await assert.rejects(()=>persist(a,x.session,op,admission,{mutations:admission.approved_mutations.filter(m=>m.collection!==omitted)}),message('CHILD_VERIFIED_TRANSITION_INCOMPLETE'));
      }
      assert.equal(await count(x.session,'verification_uses'),0);
    });
    await t.test('changing role, operation or tenant GUC before COMMIT cannot bypass immutable deferred checks',async()=>{
      const x=await seed(),op=x.f.payment(40),admission=await admit(x.session,x.f,op);
      for(const query of ["SELECT set_config('app.child_actor_role','bootstrap',true)","SELECT set_config('app.child_operation_id','another',true)","SELECT set_config('app.child_session_id','00000000-0000-0000-0000-000000000000',true)"]){
        await assert.rejects(()=>persist(a,x.session,op,admission,{mutations:admission.approved_mutations.filter(m=>m.collection!=='consumedNonces'),after:()=>a.query(query)}),message('CHILD_VERIFIED_TRANSITION_INCOMPLETE'));
      }
      assert.equal(await count(x.session,'verification_uses'),0);
    });
    await t.test('touching session metadata never reopens bootstrap after the insertion transaction',async()=>{
      const x=await seed();
      await assert.rejects(()=>transaction(a,x.session,'bootstrap','bootstrap','',async()=>{await a.query('UPDATE child_stewardship.sessions SET revision=revision WHERE id=$1',[x.session]);await insert(a,x.session,'rights','economicKeys','reopened','reopened',0);}),message('CHILD_SESSION_REVISION_INVALID'));
      await assert.rejects(()=>transaction(a,x.session,'bootstrap','bootstrap','',()=>insert(a,x.session,'rights','economicKeys','reopened','reopened',0)),message('CHILD_BOOTSTRAP_CLOSED'));
      await assert.rejects(()=>transaction(a,x.session,'bootstrap','bootstrap','',()=>a.query('UPDATE child_stewardship.session_births SET transaction_id=pg_current_xact_id()::text WHERE session_id=$1',[x.session])),code('23514'));
    });
    await t.test('nonce, executed operation and collection identity cannot be renamed or erased',async()=>{
      for(const assignment of ["record_id='renamed'","collection='hiddenNonces'","domain='learning'"]){
        await assert.rejects(()=>transaction(a,session,'operator','rights-op','rename',()=>a.query(`UPDATE child_stewardship.state_records SET ${assignment},revision=10 WHERE session_id=$1 AND domain='rights' AND collection='consumedNonces'`,[session])),message('CHILD_RECORD_IDENTITY_IMMUTABLE'));
      }
      await assert.rejects(()=>transaction(a,session,'operator','rights-op','rename',()=>a.query("UPDATE child_stewardship.state_records SET record_id='renamed',revision=10 WHERE session_id=$1 AND collection='executedOperations'",[session])),message('CHILD_RECORD_IDENTITY_IMMUTABLE'));
      await assert.rejects(()=>transaction(a,session,'operator','rights-op','delete',()=>a.query('DELETE FROM child_stewardship.rights_nonces WHERE session_id=$1',[session])),code('23514'));
    });
    await t.test('native per-lot conservation and cross-lot reservation checks reject malformed initial fixtures',async()=>{
      const f=createSyntheticRightsFixture(),bad=f.funded(100);bad.fundingLots['funding-a']!.unallocatedMinor=1;
      await assert.rejects(()=>seed(f,bad),code('23514'));
      const g=createSyntheticRightsFixture(),over=g.funded(100),lot=over.fundingLots['funding-a']!;over.fundingLots['funding-b']={...structuredClone(lot),id:'funding-b',clearingReceiptRef:'clearing-b'};
      await assert.rejects(()=>seed(g,over),message('CHILD_OVERRESERVATION'));
    });
    await t.test('two real connections serialize competing verified payments without overspending',async()=>{
      const x=await seed(),first=x.f.payment(60,{details:{payoutId:'first'}}),second=x.f.payment(60,{details:{payoutId:'second'}});
      const one=await admit(x.session,x.f,first),two=await admit(x.session,x.f,second);
      const results=await Promise.allSettled([persist(a,x.session,first,one),persist(b,x.session,second,two)]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
      assert.equal(await count(x.session,'payment_facts'),1);assert.equal((await owner.query('SELECT submitted_minor FROM child_stewardship.funding_balances WHERE session_id=$1',[x.session])).rows[0].submitted_minor,'60');
    });
    await t.test('policy-independent canonical learning grants dedupe and corrections append',async()=>{
      const grant={id:'grant-a',canonicalParticipantRef:'subject-a',participantRef:'alias-one',sourceObservationId:'observation-a',activityInstance:'activity-a',kind:'careful_observation',policyVersion:'v1',acceptedScope:'learning_only',amount:1,unit:'EDU_FEEDBACK',entryType:'grant',correctionOf:null,transferable:false,cashValue:false};
      await transaction(a,session,'reviewer','grant-contribution','',()=>insert(a,session,'learning','contributions','grant-a',grant));
      await assert.rejects(()=>transaction(a,session,'reviewer','grant-contribution','',()=>insert(a,session,'learning','contributions','grant-b',{...grant,id:'grant-b',participantRef:'alias-two',policyVersion:'v2'})),code('23505'));
      await transaction(a,session,'reviewer','correct-contribution','',()=>insert(a,session,'learning','contributions','correction-a',{...grant,id:'correction-a',entryType:'correction',amount:0,correctionOf:'grant-a'},2));
      assert.equal(await count(session,'contribution_keys'),1);
    });
    await t.test('learning actor role, domain, expiry and device membership cannot be promoted by SQL',async()=>{
      const actor=createSyntheticLearningState(now).actors['demo-child']!;
      for(const payload of [{...actor,role:'operator'},{...actor,controlDomain:'self-domain'},{...actor,expiresAt:'2030-01-01'},{...actor,deviceIds:[...actor.deviceIds,'new-device']}]){
        await assert.rejects(()=>transaction(a,session,'protector','revoke-device','',()=>update(a,session,'learning','actors',actor.id,{...payload,epoch:2})),code('42501'));
      }
      await transaction(a,session,'protector','revoke-device','',()=>update(a,session,'learning','actors',actor.id,{...actor,epoch:2,deviceIds:[]}));
      await assert.rejects(()=>transaction(a,session,'protector','revoke-device','',()=>update(a,session,'learning','actors',actor.id,{...actor,epoch:1},2)),code('42501'));
    });
    await t.test('guardian grant and child assent have separate database field authority',async()=>{
      const consent={id:'consent-a',profileId:'profile-a',purpose:'learning',policyVersion:'synthetic-learning-v1',guardianLinkVersion:1,guardianGranted:true,childAssent:false,version:1,expiresAt:'2027-01-01',withdrawnAt:null};
      await assert.rejects(()=>transaction(a,session,'child','grant-consent','',()=>insert(a,session,'learning','consents','profile-a:learning',{...consent,childAssent:true})),code('42501'));
      await transaction(a,session,'guardian','grant-consent','',()=>insert(a,session,'learning','consents','profile-a:learning',consent));
      await assert.rejects(()=>transaction(a,session,'guardian','set-assent','',()=>update(a,session,'learning','consents','profile-a:learning',{...consent,childAssent:true,version:2},2)),code('42501'));
      await assert.rejects(()=>transaction(a,session,'child','set-assent','',()=>update(a,session,'learning','consents','profile-a:learning',{...consent,childAssent:true,expiresAt:'2030-01-01',version:2},2)),code('42501'));
      await transaction(a,session,'child','set-assent','',()=>update(a,session,'learning','consents','profile-a:learning',{...consent,childAssent:true,version:2},2));
    });
    await t.test('ordinary operator cannot publish registry keys with self-declared version changes',async()=>{
      const malicious=structuredClone(initial.f.context);malicious.signerRegistryVersion='self-v2';malicious.controlDomainRegistryVersion='self-v2';malicious.conflictCheckVersion='self-v2';malicious.credentials[0]!.publicKeyPem='operator-key';
      await assert.rejects(()=>transaction(a,session,'operator','rights-registry-update','',()=>update(a,session,'rights','securityContext','current',malicious)),code('42501'));
      await assert.rejects(()=>owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'registry-publisher',1,true,'mixed-role',clock_timestamp()+interval '1 hour')",[runtimeRole]),code('23514'));
    });
    await t.test('separate governed publisher appends revocation but cannot resurrect keys or pay',async()=>{
      const x=await seed(),previous=x.f.context,next=structuredClone(previous);next.signerRegistryVersion='v2';next.controlDomainRegistryVersion='v2';next.conflictCheckVersion='v2';next.credentials[0]!.revoked=true;
      async function decision(id:string,old:unknown,value:unknown){await owner.query("INSERT INTO child_stewardship.registry_decisions SELECT $1,$2,encode(sha256(convert_to($3::jsonb::text,'UTF8')),'hex'),encode(sha256(convert_to($4::jsonb::text,'UTF8')),'hex'),'synthetic-governance-fixture',$5,clock_timestamp()+interval '1 hour'",[x.session,id,JSON.stringify(old),JSON.stringify(value),'a'.repeat(64)]);}
      await decision('decision-v2',previous,next);
      await transaction(publisher,x.session,'operator','rights-registry-update','',async()=>{await publisher.query("SELECT set_config('app.child_registry_decision_id','decision-v2',true)");await update(publisher,x.session,'rights','securityContext','current',next);});
      const back=structuredClone(next);back.signerRegistryVersion='v3';back.controlDomainRegistryVersion='v3';back.conflictCheckVersion='v3';back.credentials[0]!.revoked=false;await decision('decision-v3',next,back);
      await assert.rejects(()=>transaction(publisher,x.session,'operator','rights-registry-update','',async()=>{await publisher.query("SELECT set_config('app.child_registry_decision_id','decision-v3',true)");await update(publisher,x.session,'rights','securityContext','current',back,2);}),code('23514'));
      await assert.rejects(()=>transaction(publisher,x.session,'operator','PAY_PROTECTED','fake',()=>insert(publisher,x.session,'rights','economicKeys','fake','fake')),code('42501'));
      assert.equal(await count(x.session,'credential_revocations'),1);
    });
    await t.test('rollback retains obligations, nonce checkpoints and independent admission history',async()=>{
      const liabilities=await count(session,'entitlement_balances'),nonces=await count(session,'rights_nonces');
      await owner.query(await readFile('services/api/prisma/child-stewardship-authority.rollback.sql','utf8'));
      assert.equal(await count(session,'entitlement_balances'),liabilities);assert.equal(await count(session,'rights_nonces'),nonces);
    });
  }finally{
    await Promise.all(clients.map(client=>client.end()));await owner.end();await admin.query(`DROP DATABASE ${database}`);
    for(const role of [runtimeRole,registryRole,verifierRole])await admin.query(`DROP ROLE IF EXISTS ${role}`);await admin.end();
  }
});
