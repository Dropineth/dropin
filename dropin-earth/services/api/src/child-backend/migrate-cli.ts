import pg from 'pg';
import {loadChildMigrations,migrateChildBackend} from './migrations.js';
import {backendLog} from './database.js';
async function main(){
  const migrations=await loadChildMigrations(new URL('./migrations/',import.meta.url));
  if(process.argv.length===2 || process.argv[2]==='--plan'){
    console.log(JSON.stringify({mode:'plan-only',migrations:migrations.map(({name,digest})=>({name,digest})),createsRoles:false,grantsAuthority:false}));return;
  }
  if(process.argv.length!==3 || process.argv[2]!=='--apply-synthetic' || process.env.CHILD_MIGRATION_CONFIRM!=='apply-reviewed-synthetic-schema'
    || process.env.CHILD_DATABASE_CLASSIFICATION!=='synthetic-only' || process.env.CHILD_DATABASE_URL || process.env.CHILD_VERIFIER_DATABASE_URL)throw new Error('MIGRATION_CONFIRMATION_REQUIRED');
  const value=process.env.CHILD_MIGRATION_DATABASE_URL,role=process.env.CHILD_MIGRATION_EXPECTED_ROLE,database=process.env.CHILD_MIGRATION_EXPECTED_DATABASE;
  if(!value || !role || !database)throw new Error('MIGRATION_TARGET_REQUIRED');
  const url=new URL(value);
  if(!['postgres:','postgresql:'].includes(url.protocol) || url.search || url.hash || decodeURIComponent(url.username)!==role || decodeURIComponent(url.pathname.slice(1))!==database)throw new Error('MIGRATION_TARGET_MISMATCH');
  const local=process.env.CHILD_DATABASE_TLS==='local-test';
  if(local && (!['127.0.0.1','localhost','[::1]'].includes(url.hostname) || !database.includes('test')))throw new Error('MIGRATION_TEST_TARGET_REQUIRED');
  const pool=new pg.Pool({connectionString:value,max:1,connectionTimeoutMillis:2000,ssl:local?false:{rejectUnauthorized:true}});
  try{console.log(JSON.stringify(await migrateChildBackend(pool,migrations,{database,role})));}finally{await pool.end();}
}
void main().catch(()=>{backendLog('startup_failed');process.exitCode=1;});
