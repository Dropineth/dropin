import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {join} from 'node:path';
import {readFile} from 'node:fs/promises';
import {localUrl} from './prepare-session.mjs';
const [app,patchRoot,fixturePath]=process.argv.slice(2);
const confirmation=process.env.REHEARSAL_CONFIRM;
const fixture=JSON.parse(await readFile(fixturePath,'utf8'));
assert.equal(fixture.kind,'SyntheticOciSessionFixture/1');
const url=localUrl(fixture.ownerDatabaseUrl,confirmation);
const admin=localUrl(process.env.REHEARSAL_DATABASE_URL,confirmation);
assert.equal(url.port,admin.port);
assert.equal(url.pathname,'/rehearsal_session_test');
assert.match(url.username,/^oci_owner_[a-f0-9]{24}$/);
const {Pool}=createRequire(join(app,'services/api/package.json'))('pg');
const {loadChildMigrations,migrateChildBackend}=await import(pathToFileURL(join(patchRoot,'src/child-backend/migrations.ts')));
const original=await import(pathToFileURL(join(app,'services/api/src/child-backend/migrations.ts')));
const migrations=await loadChildMigrations(pathToFileURL(join(patchRoot,'prisma')+'/'));
const prior=await original.loadChildMigrations(pathToFileURL(join(app,'services/api/prisma')+'/'));
assert.deepEqual(migrations.slice(0,-1),prior);
const pool=new Pool({connectionString:url.href,ssl:false});
try{
 const result=await migrateChildBackend(pool,migrations,{database:'rehearsal_session_test',role:url.username});
 assert.deepEqual(result.applied,['child-stewardship-outbox-hold.sql']);
 console.log(JSON.stringify({applied:result.applied,priorMigrationsUnchanged:result.unchanged.length}));
}finally{await pool.end();}
