import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import pg from 'pg';
import { createSyntheticRightsFixture, now } from '../fixtures/child-stewardship-rights.js';
import { createSyntheticLearningState, executeLearningCommand } from '../../services/api/src/domain/child-stewardship/learning.js';
import { PostgresChildStore, reconstructChildSnapshot, type ChildSqlClient, type ChildSqlConnection } from '../../services/api/src/domain/child-stewardship/postgres-store.js';
import { createChildStewardshipRoutes } from '../../services/api/src/routes/child-stewardship/index.js';
import { createDemoTokens } from '../../services/api/src/domain/child-stewardship/store.js';
import { ChildRightsVerifier } from '../../services/api/src/domain/child-stewardship/verifier-admission.js';
import { rightsReconciliation } from '../../services/api/src/domain/child-stewardship/rights.js';
import type { RightsOperation, RightsState, RightsDelegation } from '../../services/api/src/domain/child-stewardship/rights-types.js';

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
  const runtimeRole=`child_runtime_${suffix}`,registryRole=`child_registry_${suffix}`,verifierRole=`child_verifier_${suffix}`,expiryRole=`child_expiring_${suffix}`;
  await admin.query(`CREATE DATABASE ${database}`);url.pathname=`/${database}`;
  const owner=new pg.Client({connectionString:url.toString()});await owner.connect();const clients:pg.Client[]=[];const passwords=new Map<string,string>();
  try{
    await owner.query(await readFile('services/api/prisma/child-stewardship.sql','utf8'));
    await owner.query(await readFile('services/api/prisma/child-stewardship-authority.sql','utf8'));
    await owner.query(await readFile('services/api/prisma/child-stewardship-privacy.sql','utf8'));
    await owner.query(await readFile('services/api/prisma/child-stewardship-rate-limit.sql','utf8'));
    await owner.query(await readFile('services/api/prisma/child-stewardship-resume.sql','utf8'));
    await owner.query(await readFile('services/api/prisma/child-stewardship-draft-authorization.sql','utf8'));
    async function scoped(role:string,scopes:string[]){
      const password=randomBytes(32).toString('hex');passwords.set(role,password);await owner.query(`CREATE ROLE ${role} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE`);
      // Deliberately broad local fixture grants exercise the restrictive trigger/RLS boundary.
      await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role}`);
      await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
      await owner.query("INSERT INTO child_stewardship.service_role_scopes SELECT $1,unnest($2::text[]),1,true,'local-disposable-fixture',clock_timestamp()+interval '1 hour'",[role,scopes]);
    }
    await scoped(runtimeRole,['bootstrap','guardian','child','reviewer','protector','operator']);
    await scoped(registryRole,['operator','registry-publisher']);await scoped(verifierRole,['operation-verifier']);
    async function connect(role:string){const login=new URL(url);login.username=role;login.password=passwords.get(role)!;const client=new pg.Client({connectionString:login.toString()});await client.connect();clients.push(client);return client;}
    const a=await connect(runtimeRole),b=await connect(runtimeRole),publisher=await connect(registryRole),verification=await connect(verifierRole);
    const verifier=new ChildRightsVerifier(sql(verification));
    async function seed(f= createSyntheticRightsFixture(),state?:RightsState){
      const session=randomUUID(),rights=state??f.funded(100);
      await new PostgresChildStore(sql(a)).create({id:session,expiresAt:'2027-01-01',snapshot:{version:0,learning:createSyntheticLearningState(now),rights,rightsContext:f.context}},[]);
      return {session,f,state:rights};
    }
    async function count(session:string,table:string){return transaction(a,session,'operator','read','',async()=>Number((await a.query(`SELECT count(*) FROM child_stewardship.${table} WHERE session_id=$1`,[session])).rows[0].count));}
    async function admit(session:string,f:Fixture,op:RightsOperation,ids=['g','r1','t'],moment=now):Promise<Admission>{
      await verifier.admit(session,op,f.approvals(op,ids),moment);
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
    async function readRights(id:string):Promise<RightsState>{const rows=(await owner.query("SELECT domain,collection,record_id,payload,position FROM child_stewardship.state_records WHERE session_id=$1 ORDER BY domain,collection,position,record_id",[id])).rows;return reconstructChildSnapshot(rows,0).rights;}
    async function execute(x:{session:string;f:Fixture},op:RightsOperation,ids=['r1','t'],moment=now){const admitted=await admit(x.session,x.f,op,ids,moment);await persist(a,x.session,op,admitted);return readRights(x.session);}
    async function fingerprint(id:string){const result:Record<string,unknown>={};for(const table of ['sessions','state_records','entitlement_balances','funding_balances','payment_facts','economic_keys','rights_nonces','authority_journal','verification_admissions','verification_uses','receipts']){result[table]=(await owner.query(`SELECT encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]'::jsonb)::text,'UTF8')),'hex') digest FROM child_stewardship.${table} r WHERE ${table==='sessions'?'id':'session_id'}=$1`,[id])).rows[0].digest;}return result;}
    async function unchangedReject(x:{session:string;f:Fixture},op:RightsOperation,ids=['r1','t'],pattern?:RegExp){const before=await fingerprint(x.session);if(pattern)await assert.rejects(()=>admit(x.session,x.f,op,ids),pattern);else await assert.rejects(()=>admit(x.session,x.f,op,ids));assert.deepEqual(await fingerprint(x.session),before);}
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
    await t.test('EX-16 exact unfunded/funded/settled/failed/refunded native ledger buckets and zero-fee policy',async()=>{
      const f=createSyntheticRightsFixture(),x=await seed(f,f.state);
      async function check(expected:number[]){const r=rightsReconciliation(await readRights(x.session));assert.deepEqual([r.assetsMinor,r.unallocatedMinor,r.reservedMinor,r.vestedMinor,r.submittedMinor,r.legalOutstandingMinor,r.unfundedMinor,r.differenceMinor],expected);const rows=(await owner.query('SELECT coalesce(sum(cleared_assets_minor),0)::text assets,coalesce(sum(unallocated_minor),0)::text unallocated,coalesce(sum(reserved_minor+outcome_reserved_minor),0)::text reserved,coalesce(sum(vested_minor),0)::text vested,coalesce(sum(submitted_minor),0)::text submitted FROM child_stewardship.funding_balances WHERE session_id=$1',[x.session])).rows[0];assert.deepEqual(Object.values(rows).map(Number),expected.slice(0,5));assert.equal(Number((await owner.query('SELECT coalesce(sum(amount_minor-paid_minor),0)::text owed FROM child_stewardship.entitlement_balances WHERE session_id=$1',[x.session])).rows[0].owed),expected[5]);}
      await execute(x,f.operation('RECORD_OBLIGATION',{amountMinor:100,entitlementIds:['entitlement-a'],details:{rightKind:'contractual_grant',obligorRef:'obligor-a',dueAt:'2027-01-01T00:00:00Z',contributionRequired:false}}));await execute(x,f.operation('VEST',{amountMinor:100,entitlementIds:['entitlement-a']}));await check([0,0,0,0,0,100,100,0]);
      await execute(x,f.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:'funding-a',clearingReceiptRef:'native-clear'}}));await check([100,100,0,0,0,100,100,0]);
      await execute(x,f.operation('RESERVE_FUNDING',{amountMinor:100,entitlementIds:['entitlement-a'],fundingLotIds:['funding-a']}));await check([100,0,0,100,0,100,0,0]);
      await execute(x,f.payment(40),['g','r1','t']);await check([100,0,0,60,40,100,0,0]);
      await execute(x,f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:'settled',providerOperationRef:'native-provider-a',receiptRef:'native-settled-a'}}),['t']);await check([60,0,0,60,0,60,0,0]);
      await execute(x,f.payment(20,{details:{payoutId:'payout-failed'}}),['g','r1','t']);await check([60,0,0,40,20,60,0,0]);
      await execute(x,f.operation('PAYMENT_RESULT',{amountMinor:20,details:{payoutId:'payout-failed',paymentStatus:'failed',providerOperationRef:'native-provider-failed',receiptRef:'native-failed'}}),['t']);await check([60,0,0,60,0,60,0,0]);
      await execute(x,f.operation('REFUND',{amountMinor:10,recipientBindingRef:'destination-a',recipientBindingVersion:1,recipientDestinationDigest:'a'.repeat(64),details:{payoutId:'payout-a',receiptRef:'native-refund-a'}}));await check([70,0,0,70,0,70,0,0]);
      for(const fee of [1,-1,Number.MAX_SAFE_INTEGER+1])await unchangedReject(x,f.payment(10,{feesMinor:fee,details:{payoutId:`fee-${String(fee).replace('-','negative')}`}}),['g','r1','t']);
      await unchangedReject(x,{...f.payment(10),currency:'USD'} as unknown as RightsOperation,['g','r1','t'],/REAL_VALUE_DISABLED/);
      await unchangedReject(x,f.operation('RECORD_OBLIGATION',{amountMinor:10,entitlementIds:['fake-education-money'],details:{rightKind:'EDU_POINT' as never,obligorRef:'obligor-a',dueAt:'2027-01-01T00:00:00Z',contributionRequired:false}}),['r1','t'],/RIGHT_KIND_INVALID/);
      assert.equal((await readRights(x.session)).entitlements['entitlement-a']!.paidMinor,30);
    });
    await t.test('provider operation and receipt source identities cannot settle or refund two different payouts',async()=>{
      const x=await seed(),f=x.f;for(const id of ['one','two'])await execute(x,f.payment(30,{details:{payoutId:id}}),['g','r1','t']);
      await execute(x,f.operation('PAYMENT_RESULT',{amountMinor:30,details:{payoutId:'one',paymentStatus:'accepted',providerOperationRef:'provider-one',receiptRef:'accepted-one'}}),['t']);
      await unchangedReject(x,f.operation('PAYMENT_RESULT',{amountMinor:30,details:{payoutId:'two',paymentStatus:'settled',providerOperationRef:'provider-one',receiptRef:'forged-second-source'}}),['t'],/PROVIDER_OPERATION_REUSED/);
      await unchangedReject(x,f.operation('PAYMENT_RESULT',{amountMinor:30,details:{payoutId:'two',paymentStatus:'settled',providerOperationRef:'provider-two',receiptRef:'accepted-one'}}),['t'],/PROVIDER_RECEIPT_REUSED/);
      await execute(x,f.operation('PAYMENT_RESULT',{amountMinor:30,details:{payoutId:'one',paymentStatus:'processing',providerOperationRef:'provider-one',receiptRef:'processing-one'}}),['t']);
      for(const id of ['one','two'])await execute(x,f.operation('PAYMENT_RESULT',{amountMinor:30,details:{payoutId:id,paymentStatus:'settled',providerOperationRef:`provider-${id}`,receiptRef:`settled-${id}`}}),['t']);
      const refund=(id:string,receipt:string)=>f.operation('REFUND',{amountMinor:10,recipientBindingRef:'destination-a',recipientBindingVersion:1,recipientDestinationDigest:'a'.repeat(64),details:{payoutId:id,receiptRef:receipt}});
      await execute(x,refund('one','refund-source'));await unchangedReject(x,refund('two','refund-source'),['r1','t'],/PROVIDER_RECEIPT_REUSED/);await unchangedReject(x,refund('two','settled-one'),['r1','t'],/PROVIDER_RECEIPT_REUSED/);await execute(x,refund('two','refund-two'));
      const state=await readRights(x.session);assert.equal(state.entitlements['entitlement-a']!.paidMinor,40);assert.equal(rightsReconciliation(state).assetsMinor,60);assert.equal(new Set(Object.values(state.payments).flatMap(p=>p.receiptRefs)).size,6);
      const bad=structuredClone(state);bad.payments.two!.providerOperationRef='provider-one';await assert.rejects(()=>seed(createSyntheticRightsFixture(),bad),code('23505'));
      const reused=structuredClone(state);reused.payments.two!.receiptRefs.push('accepted-one');await assert.rejects(()=>seed(createSyntheticRightsFixture(),reused),message('CHILD_PROVIDER_RECEIPT_REUSED'));
    });
    await t.test('concurrent use of one provider settlement source has at most one financial effect',async()=>{
      const x=await seed(),f=x.f;for(const id of ['one','two'])await execute(x,f.payment(30,{details:{payoutId:id}}),['g','r1','t']);const ops=['one','two'].map(id=>f.operation('PAYMENT_RESULT',{amountMinor:30,details:{payoutId:id,paymentStatus:'settled',providerOperationRef:'same-provider-operation',receiptRef:'same-provider-receipt'}}));const admissions:Admission[]=[];for(const op of ops)admissions.push(await admit(x.session,f,op,['t']));const result=await Promise.allSettled(ops.map((op,i)=>persist(i?a:b,x.session,op,admissions[i]!)));assert.equal(result.filter(r=>r.status==='fulfilled').length,1);const state=await readRights(x.session);assert.equal(state.entitlements['entitlement-a']!.paidMinor,30);assert.equal(rightsReconciliation(state).assetsMinor,70);assert.equal(rightsReconciliation(state).submittedMinor,30);assert.equal(Object.values(state.payments).filter(p=>p.providerOperationRef==='same-provider-operation').length,1);
    });
    await t.test('EX-29 native financial types and zero-fee constraint reject malformed bootstrap state atomically',async()=>{
      const countBefore=Number((await owner.query('SELECT count(*) n FROM child_stewardship.sessions')).rows[0].n);
      for(const change of ['currency','right-kind','fee','negative-fee','overflow-fee']){const f=createSyntheticRightsFixture(),state=f.funded();if(change==='currency')state.fundingLots['funding-a']!.currency='USD' as never;else if(change==='right-kind')state.entitlements['entitlement-a']!.rightKind='EDU_FEEDBACK' as never;else Object.values(state.approvalRecords)[0]!.operation.feesMinor=change==='fee'?1:change==='negative-fee'?-1:Number.MAX_SAFE_INTEGER+1;await assert.rejects(()=>seed(f,state),code('23514'));}
      assert.equal(Number((await owner.query('SELECT count(*) n FROM child_stewardship.sessions')).rows[0].n),countBefore);
    });
    await t.test('EX-21 current policy and alias changes cannot duplicate a canonical financial contribution',async()=>{
      const f=createSyntheticRightsFixture();let state=f.apply(f.state,f.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:'funding-a',clearingReceiptRef:'policy-replay-clear'}}),['r1','t']);state=f.apply(state,f.operation('RESERVE_OUTCOME',{amountMinor:100,fundingLotIds:['funding-a'],details:{outcomeId:'policy-replay-outcome',fundingPlanId:'policy-replay-plan'}}),['r1','t']);const details={contributionId:'original-contribution',outcomeId:'policy-replay-outcome',fundingPlanId:'policy-replay-plan',participantCanonicalRef:'canonical-a',attributionNumerator:1,attributionDenominator:3,outcomeBudgetMinor:100};state=f.apply(state,f.operation('CONFIRM_CONTRIBUTION',{amountMinor:33,details}),['v1','v3']);state.beneficiaries['beneficiary-alias']={...state.beneficiaries['beneficiary-a']!,ref:'beneficiary-alias'};f.context.entitlementPolicies['policy-v1']=structuredClone(f.context.policy);f.context.policy.version='policy-v2';const x=await seed(f,state);
      for(const beneficiary of ['beneficiary-a','beneficiary-alias'])await unchangedReject(x,f.operation('CONFIRM_CONTRIBUTION',{beneficiaryRef:beneficiary,amountMinor:33,details:{...details,contributionId:`replay-${beneficiary}`}}),['v1','v3'],/ECONOMIC_REPLAY/);assert.equal(Object.keys((await readRights(x.session)).contributions).length,1);
    });
    await t.test('EX-23 thirds round deterministically, remainder stays in funded child pool and independent plans do not duplicate an outcome claim',async()=>{
      const f=createSyntheticRightsFixture();for(const id of ['b','c','d'])f.state.beneficiaries[`beneficiary-${id}`]={...f.state.beneficiaries['beneficiary-a']!,ref:`beneficiary-${id}`,legalSubjectRef:`canonical-${id}`};const x=await seed(f,f.state);
      for(const [plan,lot]of [['plan-one','funding-a'],['plan-two','funding-b']]as const){await execute(x,f.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:lot,clearingReceiptRef:`distinct-sponsor-source-${plan}`}}));await execute(x,f.operation('RESERVE_OUTCOME',{amountMinor:100,fundingLotIds:[lot],details:{outcomeId:'one-real-outcome-reference',fundingPlanId:plan}}));}
      function contribution(id:string,plan='plan-one',numerator=1,denominator=3){return f.operation('CONFIRM_CONTRIBUTION',{beneficiaryRef:`beneficiary-${id}`,amountMinor:Math.floor(100*numerator/denominator),details:{contributionId:`contribution-${plan}-${id}`,outcomeId:'one-real-outcome-reference',fundingPlanId:plan,participantCanonicalRef:`canonical-${id}`,attributionNumerator:numerator,attributionDenominator:denominator,outcomeBudgetMinor:100}});}
      for(const id of ['a','b','c']){await execute(x,contribution(id),['v1','v3']);await execute(x,f.operation('RECORD_OBLIGATION',{beneficiaryRef:`beneficiary-${id}`,amountMinor:33,entitlementIds:[`third-${id}`],details:{rightKind:'contractual_grant',obligorRef:'obligor-a',dueAt:'2027-01-01T00:00:00Z',contributionRequired:true,contributionId:`contribution-plan-one-${id}`}}));await execute(x,f.operation('RESERVE_FUNDING',{beneficiaryRef:`beneficiary-${id}`,amountMinor:33,entitlementIds:[`third-${id}`],fundingLotIds:['funding-a']}));await execute(x,f.operation('VEST',{beneficiaryRef:`beneficiary-${id}`,amountMinor:33,entitlementIds:[`third-${id}`]}),['r1','t'],'2026-11-02T12:00:00Z');}
      const vested=(await readRights(x.session)).entitlements;await unchangedReject(x,contribution('d'),['v1','v3'],/ATTRIBUTION_LIMIT/);assert.deepEqual((await readRights(x.session)).entitlements,vested);
      await execute(x,contribution('a','plan-two',1,1),['v1','v3']);const state=await readRights(x.session);assert.equal(Object.values(state.contributions).filter(c=>c.fundingPlanId==='plan-one').reduce((n,c)=>n+c.amountMinor,0),99);assert.deepEqual(Object.values(state.fundingLots).flatMap(lot=>Object.values(lot.outcomeReserves)).sort((a,b)=>a-b),[1,100]);assert.equal(rightsReconciliation(state).differenceMinor,0);assert.equal(new Set(Object.values(state.contributions).map(c=>c.outcomeId)).size,1);
      const replay=contribution('a','plan-one');replay.details.contributionId='new-id-same-economic-grant';await unchangedReject(x,replay,['v1','v3']);
    });
    await t.test('EX-23 concurrent competing shares cannot exceed a single outcome pool',async()=>{
      const f=createSyntheticRightsFixture();f.state.beneficiaries['beneficiary-b']={...f.state.beneficiaries['beneficiary-a']!,ref:'beneficiary-b',legalSubjectRef:'canonical-b'};const x=await seed(f,f.state);await execute(x,f.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:'funding-a',clearingReceiptRef:'share-race-clear'}}));await execute(x,f.operation('RESERVE_OUTCOME',{amountMinor:100,fundingLotIds:['funding-a'],details:{outcomeId:'share-race',fundingPlanId:'race-plan'}}));
      const ops=['a','b'].map(id=>f.operation('CONFIRM_CONTRIBUTION',{beneficiaryRef:`beneficiary-${id}`,amountMinor:60,details:{contributionId:`share-${id}`,outcomeId:'share-race',fundingPlanId:'race-plan',participantCanonicalRef:`canonical-${id}`,attributionNumerator:3,attributionDenominator:5,outcomeBudgetMinor:100}}));const admissions:Admission[]=[];for(const op of ops)admissions.push(await admit(x.session,f,op,['v1','v3']));const results=await Promise.allSettled(ops.map((op,i)=>persist(i?a:b,x.session,op,admissions[i]!)));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const loser=results.findIndex(r=>r.status==='rejected');await unchangedReject(x,ops[loser]!,['v1','v3']);assert.equal(Object.values((await readRights(x.session)).contributions).reduce((n,c)=>n+c.amountMinor,0),60);
    });
    await t.test('EX-25 whole-entitlement bundle split and merge preserve paid history, debt and original allocations',async()=>{
      const f=createSyntheticRightsFixture();let state=f.funded();for(const id of ['b','c'])state.beneficiaries[`beneficiary-${id}`]={...state.beneficiaries['beneficiary-a']!,ref:`beneficiary-${id}`,legalSubjectRef:`canonical-${id}`};
      for(const [id,beneficiary,amount]of [['entitlement-b','beneficiary-b',80],['entitlement-c','beneficiary-a',60]]as const){state=f.apply(state,f.operation('RECORD_OBLIGATION',{beneficiaryRef:beneficiary,amountMinor:amount,entitlementIds:[id],details:{rightKind:'contractual_grant',obligorRef:'obligor-a',dueAt:'2027-01-01T00:00:00Z',contributionRequired:false}}),['r1','t']);state=f.apply(state,f.operation('VEST',{beneficiaryRef:beneficiary,amountMinor:amount,entitlementIds:[id]}),['r1','t']);}
      const x=await seed(f,state);await execute(x,f.payment(40),['g','r1','t']);await execute(x,f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:'settled',providerOperationRef:'paid-before-correction',receiptRef:'paid-before-correction-receipt'}}),['t']);const before=await readRights(x.session),totals=rightsReconciliation(before),approvers=['a','b','r1','r2','t'];
      const split=f.operation('LEGAL_CORRECTION',{entitlementIds:['entitlement-a'],amountMinor:100,details:{replacesBeneficiaryRef:'beneficiary-b',legalDecisionRef:'decision-synthetic'}});
      await unchangedReject(x,{...split,amountMinor:101},approvers,/CORRECTION_AMOUNT_MISMATCH/);await unchangedReject(x,{...split,entitlementIds:['entitlement-b'],amountMinor:80},approvers,/CORRECTION_SCOPE_INVALID/);await unchangedReject(x,{...split,details:{...split.details,legalDecisionRef:'unregistered-decision'}},approvers,/LEGAL_DECISION_UNVERIFIED/);await unchangedReject(x,split,['b','r1','r2','t'],/ROLE_QUORUM_MISSING/);
      const exactBefore=await fingerprint(x.session);await assert.rejects(()=>verifier.admit(x.session,{...split,details:{...split.details,replacesBeneficiaryRef:'beneficiary-c'}},f.approvals(split,approvers),now),/INVALID_SIGNATURE/);assert.deepEqual(await fingerprint(x.session),exactBefore);
      await execute(x,split,approvers);await unchangedReject(x,split,approvers,/OPERATION_REPLAY|VERIFICATION_ADMISSION_CONFLICT/);
      await execute(x,f.operation('LEGAL_CORRECTION',{authorizationEpoch:1,entitlementIds:['entitlement-c'],amountMinor:60,details:{replacesBeneficiaryRef:'beneficiary-c',legalDecisionRef:'decision-synthetic'}}),approvers);
      await execute(x,f.operation('LEGAL_CORRECTION',{beneficiaryRef:'beneficiary-b',authorizationEpoch:1,entitlementIds:['entitlement-a','entitlement-b'],amountMinor:180,details:{replacesBeneficiaryRef:'beneficiary-c',legalDecisionRef:'decision-synthetic'}}),approvers);
      const after=await readRights(x.session);assert.deepEqual(rightsReconciliation(after),totals);assert.deepEqual(after.payments,before.payments);assert.deepEqual(after.fundingLots,before.fundingLots);assert.equal(Object.keys(after.entitlements).length,3);assert.equal(after.entitlements['entitlement-a']!.paidMinor,40);assert.ok(Object.values(after.entitlements).every(e=>e.beneficiaryRef==='beneficiary-c'));assert.ok(Object.values(after.entitlements).every(e=>e.amountMinor-e.paidMinor>=0));
    });
    await t.test('EX-25 concurrent legal correction and payout cannot both execute from old authority',async()=>{
      const f=createSyntheticRightsFixture(),state=f.funded();state.beneficiaries['beneficiary-b']={...state.beneficiaries['beneficiary-a']!,ref:'beneficiary-b',legalSubjectRef:'canonical-b'};const x=await seed(f,state),correct=f.operation('LEGAL_CORRECTION',{entitlementIds:['entitlement-a'],amountMinor:100,details:{replacesBeneficiaryRef:'beneficiary-b',legalDecisionRef:'decision-synthetic'}}),pay=f.payment(40);const ca=await admit(x.session,f,correct,['a','b','r1','r2','t']),pa=await admit(x.session,f,pay);const results=await Promise.allSettled([persist(a,x.session,correct,ca),persist(b,x.session,pay,pa)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);const final=await readRights(x.session);assert.equal(Object.keys(final.entitlements).length,1);assert.equal(rightsReconciliation(final).legalOutstandingMinor,100);assert.equal(rightsReconciliation(final).assetsMinor,100);assert.equal(Object.keys(final.payments).length,results[1]!.status==='fulfilled'?1:0);await unchangedReject(x,results[0]!.status==='fulfilled'?pay:correct,results[0]!.status==='fulfilled'?['g','r1','t']:['a','b','r1','r2','t']);
    });
    await t.test('RT-03 two independently approved delegations share one authoritative period budget',async()=>{
      const f=createSyntheticRightsFixture();f.context.policy.beneficiaryPeriodLimitMinor=100;f.context.policy.destinationPeriodLimitMinor=100;const x=await seed(f,f.funded(200));
      for(const id of ['one','two']){const delegation:RightsDelegation={id:`delegation-${id}`,parentId:null,issuerActorRef:'actor-g',delegateActorRef:'actor-x',beneficiaryRef:'beneficiary-a',epoch:0,operationTypes:['PAY_PROTECTED'],entitlementIds:['entitlement-a'],destinationRefs:['destination-a'],purposeCodes:['LEARNING_SUPPORT'],currency:'XTS',validAfter:'2026-10-23T12:01:00Z',expiresAt:'2026-11-01T00:00:00Z',perCallLimitMinor:60,cumulativeLimitMinor:100,maximumCalls:2,consumedMinor:0,consumedCalls:0,revoked:false,allowRedelegation:false,approvalDigest:''};await execute(x,f.operation('GRANT_DELEGATION',{details:{delegation}}),['g','r1','t']);}
      const ops=['one','two'].map(id=>f.payment(60,{delegationId:`delegation-${id}`,details:{payoutId:`delegated-${id}`}}));const admissions:Admission[]=[];for(const op of ops)admissions.push(await admit(x.session,f,op,['g','r1','t'],'2026-10-23T12:02:00Z'));const result=await Promise.allSettled(ops.map((op,i)=>persist(i?a:b,x.session,op,admissions[i]!)));assert.equal(result.filter(r=>r.status==='fulfilled').length,1);const state=await readRights(x.session);assert.equal(rightsReconciliation(state).submittedMinor,60);assert.equal(Object.values(state.delegations).reduce((n,d)=>n+d.consumedMinor,0),60);assert.equal(state.outbox.length,1);
    });
    await t.test('RT-05 crash after native outbox writes rolls back all effects and exact retry creates one submission intent',async()=>{
      const x=await seed(),op=x.f.payment(),admission=await admit(x.session,x.f,op),before=await fingerprint(x.session);await assert.rejects(()=>persist(a,x.session,op,admission,{after:async()=>{throw new Error('LOCAL_CRASH_BEFORE_COMMIT');}}),/LOCAL_CRASH_BEFORE_COMMIT/);assert.deepEqual(await fingerprint(x.session),before);await persist(a,x.session,op,admission);const state=await readRights(x.session);assert.equal(state.outbox.length,1);assert.equal(state.payments['payout-a']!.submissionCount,1);await unchangedReject(x,op,['g','r1','t'],/OPERATION_REPLAY|VERIFICATION_ADMISSION_CONFLICT/);
    });
    await t.test('EX-16 actual Hono and PostgreSQL execute the complete accounting sequence and reject reused source receipts without effects',async()=>{
      const f=createSyntheticRightsFixture(),id=randomUUID(),tokens=createDemoTokens(id),store=new PostgresChildStore(sql(a));assert.equal(await store.ready(),true);await store.create({id,expiresAt:'2027-01-01T00:00:00Z',snapshot:{version:0,learning:createSyntheticLearningState(now),rights:f.state,rightsContext:f.context}},tokens.records);const started=performance.now(),clock=()=>new Date(Date.parse(now)+performance.now()-started).toISOString(),app=createChildStewardshipRoutes({mode:'synthetic-demo',store,now:clock});let version=0;
      const external=t.mock.method(globalThis,'fetch',async()=>{throw new Error('UNEXPECTED_REAL_PROVIDER_REQUEST');});
      async function post(op:RightsOperation,ids:string[],key=`http-${op.operationId}`,expected=version){return app.request('/rights/operations',{method:'POST',headers:{authorization:`Bearer ${tokens.publicTokens.operator}`,'content-type':'application/json','idempotency-key':key,'if-match':String(expected)},body:JSON.stringify({operation:op,approvals:f.approvals(Number.isSafeInteger(op.feesMinor)?op:{...op,feesMinor:0},ids)})});}
      async function send(op:RightsOperation,ids=['r1','t']){await verifier.admit(id,op,f.approvals(op,ids),clock());const response=await post(op,ids),body=await response.json();assert.equal(response.status,200,JSON.stringify(body));version=body.version;return op;}
      async function check(assets:number,vested:number,submitted:number,owed:number){const state=await readRights(id),r=rightsReconciliation(state);assert.deepEqual([r.assetsMinor,r.vestedMinor,r.submittedMinor,r.legalOutstandingMinor,r.differenceMinor],[assets,vested,submitted,owed,0]);}
      await send(f.operation('RECORD_OBLIGATION',{amountMinor:100,entitlementIds:['entitlement-a'],details:{rightKind:'contractual_grant',obligorRef:'obligor-a',dueAt:'2027-01-01T00:00:00Z',contributionRequired:false}}));await send(f.operation('VEST',{amountMinor:100,entitlementIds:['entitlement-a']}));await check(0,0,0,100);
      await send(f.operation('RECORD_CLEARED_FUNDING',{amountMinor:100,details:{fundingLotId:'funding-a',clearingReceiptRef:'http-cleared-source'}}));await send(f.operation('RESERVE_FUNDING',{amountMinor:100,entitlementIds:['entitlement-a'],fundingLotIds:['funding-a']}));await check(100,100,0,100);
      await send(f.payment(40),['g','r1','t']);await check(100,60,40,100);const settled=await send(f.operation('PAYMENT_RESULT',{amountMinor:40,details:{payoutId:'payout-a',paymentStatus:'settled',providerOperationRef:'http-provider-one',receiptRef:'http-settled-source'}}),['t']);await check(60,60,0,60);
      await send(f.payment(20,{details:{payoutId:'http-failed'}}),['g','r1','t']);await check(60,40,20,60);
      for(const details of [{payoutId:'http-failed',paymentStatus:'settled' as const,providerOperationRef:'http-provider-one',receiptRef:'http-new-source'},{payoutId:'http-failed',paymentStatus:'settled' as const,providerOperationRef:'http-provider-two',receiptRef:'http-settled-source'}]){const reused=f.operation('PAYMENT_RESULT',{amountMinor:20,details}),before=await fingerprint(id);await assert.rejects(()=>verifier.admit(id,reused,f.approvals(reused,['t']),clock()),/PROVIDER_(OPERATION|RECEIPT)_REUSED/);const denied=await post(reused,['t']);assert.equal(denied.status,403);assert.deepEqual(await fingerprint(id),before);}
      await send(f.operation('PAYMENT_RESULT',{amountMinor:20,details:{payoutId:'http-failed',paymentStatus:'failed',providerOperationRef:'http-provider-two',receiptRef:'http-failed-source'}}),['t']);await check(60,60,0,60);
      await send(f.operation('REFUND',{amountMinor:10,recipientBindingRef:'destination-a',recipientBindingVersion:1,recipientDestinationDigest:'a'.repeat(64),details:{payoutId:'payout-a',receiptRef:'http-refund-source'}}));await check(70,70,0,70);
      const beforeRetry=await fingerprint(id);assert.equal((await post(settled,['t'],`http-${settled.operationId}`,5)).status,200);assert.deepEqual(await fingerprint(id),beforeRetry);
      for(const fee of [1,-1,Number.MAX_SAFE_INTEGER+1]){const op=f.payment(1,{feesMinor:fee}),before=await fingerprint(id);assert.equal((await post(op,['g','r1','t'])).status,Number.isSafeInteger(fee)?403:400);assert.deepEqual(await fingerprint(id),before);}
      assert.equal(external.mock.callCount(),0);external.mock.restore();assert.equal((await count(id,'receipts')),version);assert.equal((await readRights(id)).outbox.length,2);assert.equal((await readRights(id)).entitlements['entitlement-a']!.paidMinor,30);
    });
    await t.test('actual restricted SQL login cannot retain pre-lock authority after its role scope expires',async()=>{
      const f=createSyntheticRightsFixture(),id=randomUUID();let learning=createSyntheticLearningState(now);learning=executeLearningCommand(learning,{type:'create-profile',commandId:'demo-expiry-profile-create',expectedVersion:0,profileId:'demo-expiry-profile',ageBand:'9-12',nickname:'leaf',locale:'en'},{actorId:'demo-guardian',deviceId:'demo-device-guardian',epoch:1},now).state;
      await new PostgresChildStore(sql(a)).create({id,expiresAt:'2027-01-01T00:00:00Z',snapshot:{version:0,learning,rights:f.state,rightsContext:f.context}},[]);await scoped(expiryRole,['child']);const expiring=await connect(expiryRole),pid=Number((await expiring.query('SELECT pg_backend_pid() pid')).rows[0].pid),before=await fingerprint(id);
      await owner.query("INSERT INTO child_stewardship.service_role_scopes VALUES($1,'child',2,true,'local-short-lived-scope',clock_timestamp()+interval '400 milliseconds')",[expiryRole]);await owner.query('BEGIN');await owner.query('SELECT id FROM child_stewardship.sessions WHERE id=$1 FOR UPDATE',[id]);
      const pending=transaction(expiring,id,'child','request-privacy','',async()=>{await expiring.query("SELECT set_config('app.child_actor_id','demo-child',true)");await expiring.query("UPDATE child_stewardship.state_records SET payload=jsonb_set(payload,'{status}','\"paused\"'::jsonb),revision=1 WHERE session_id=$1 AND domain='learning' AND collection='profiles' AND record_id='demo-expiry-profile'",[id]);}).then(()=>({ok:true as const,error:null}),error=>({ok:false as const,error}));
      let waiting=false;for(let attempt=0;attempt<40;attempt++){waiting=(await owner.query("SELECT wait_event_type='Lock' waiting FROM pg_stat_activity WHERE pid=$1",[pid])).rows[0]?.waiting===true;if(waiting)break;await new Promise(resolve=>setTimeout(resolve,10));}await new Promise(resolve=>setTimeout(resolve,600));await owner.query('COMMIT');const result=await pending;assert.equal(waiting,true,'query actually waited for locked current session');assert.equal(result.ok,false);assert.match(String(result.error),/CHILD_DATABASE_ROLE_SCOPE_DENIED/);assert.deepEqual(await fingerprint(id),before);
    });
    await t.test('rollback retains obligations, nonce checkpoints and independent admission history',async()=>{
      const liabilities=await count(session,'entitlement_balances'),nonces=await count(session,'rights_nonces');
      await owner.query(await readFile('services/api/prisma/child-stewardship-authority.rollback.sql','utf8'));
      assert.equal(await count(session,'entitlement_balances'),liabilities);assert.equal(await count(session,'rights_nonces'),nonces);
    });
  }finally{
    await Promise.all(clients.map(client=>client.end()));await owner.end();await admin.query(`DROP DATABASE ${database}`);
    for(const role of [runtimeRole,registryRole,verifierRole,expiryRole])await admin.query(`DROP ROLE IF EXISTS ${role}`);await admin.end();
  }
});
