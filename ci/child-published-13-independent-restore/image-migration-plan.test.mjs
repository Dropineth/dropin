import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyImagePlan,ownerMigrationEnv} from './image-migration-plan.mjs';
const digest=s=>createHash('sha256').update(s).digest('hex');
function fixture(){
 const names=['','-authority','-privacy','-webauthn','-resume','-draft-authorization','-rate-limit','-media','-agent-gateway','-guardian-sessions','-restore','-restore-registry'];
 const baseline=names.map(s=>({name:'child-stewardship'+s+'.sql',digest:digest(s)}));
 const reviewedSql='fixture only';
 const items=[...baseline,{name:'child-stewardship-outbox-hold.sql',digest:digest(reviewedSql)}];
 return {baseline,reviewedSql,manifest:{mode:'plan-only',createsRoles:false,grantsAuthority:false,migrations:structuredClone(items)},files:Object.fromEntries(items.map(x=>[x.name,x.digest]))};
}
test('exact plan and files accepted',()=>assert.equal(verifyImagePlan(fixture()).priorMigrationDigestsMatch,12));
test('changed older migration, changed new bytes or unexpected file rejected',()=>{
 for(const edit of [f=>f.manifest.migrations[1].digest='0'.repeat(64),f=>f.files['child-stewardship-outbox-hold.sql']='0'.repeat(64),f=>f.files['other.sql']='0'.repeat(64)]){
  const f=fixture();edit(f);assert.throws(()=>verifyImagePlan(f));
 }
});
test('role-granting or uncertain manifest rejected',()=>{
 for(const edit of [f=>f.manifest.grantsAuthority=true,f=>f.manifest.createsRoles=true,f=>f.manifest.mode='apply',f=>f.manifest.migrations.reverse()]){
  const f=fixture();edit(f);assert.throws(()=>verifyImagePlan(f));
 }
});
const owner='oci_owner_'+'a'.repeat(24), pwd='b'.repeat(64);
const dsn='postgresql://'+owner+':'+pwd+'@127.0.0.1:32001/rehearsal_session_test';
test('private database identity and verified TLS only',()=>{
 const env=ownerMigrationEnv(dsn);
 assert.ok(env.includes('@rehearsal-pg:5432/rehearsal_session_test'));
 assert.ok(env.includes('CHILD_DATABASE_TLS=verify-full'));
 assert.ok(!env.includes('CHILD_DATABASE_URL='));
});
test('production-like target, query options, foreign role and port rejected',()=>{
 for(const bad of [dsn.replace('127.0.0.1','db.example.test'),dsn+'?sslmode=disable',dsn.replace('rehearsal_session_test','production'),dsn.replace('oci_owner_','oci_runtime_'),dsn.replace(':32001','')])assert.throws(()=>ownerMigrationEnv(bad));
});
