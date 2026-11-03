import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type pg from 'pg';
import type {ChildSqlClient} from '../domain/child-stewardship/postgres-store.js';

export const childMigrationFiles = [
  'child-stewardship.sql','child-stewardship-authority.sql','child-stewardship-privacy.sql',
  'child-stewardship-webauthn.sql','child-stewardship-resume.sql','child-stewardship-draft-authorization.sql',
  'child-stewardship-rate-limit.sql','child-stewardship-media.sql','child-stewardship-agent-gateway.sql',
  'child-stewardship-guardian-sessions.sql','child-stewardship-restore.sql',
] as const;
export type ChildMigration = {name:string;digest:string;sql:string};
export async function loadChildMigrations(directory:URL):Promise<ChildMigration[]> {
  return Promise.all(childMigrationFiles.map(async name=>{
    const sql=await readFile(new URL(name,directory),'utf8');
    return {name,sql,digest:createHash('sha256').update(sql).digest('hex')};
  }));
}
export async function childMigrationReady(client:ChildSqlClient,migrations:readonly ChildMigration[]):Promise<boolean> {
  try {
    const rows=await client.query<{name:string;digest:string}>('SELECT name,digest FROM child_backend_migrations.entries ORDER BY ordinal');
    return rows.length===migrations.length && rows.every((row,index)=>row.name===migrations[index]!.name && row.digest===migrations[index]!.digest);
  }catch{return false;}
}
/** Invoked separately by the migration owner, never HTTP/startup/preDeploy.
 * Existing SQL bytes are journaled without edits. Their explicit top-level
 * transaction delimiters are subsumed by this one atomic, advisory-locked batch.
 * No roles, passwords, service scopes or verification admissions are created. */
export async function migrateChildBackend(pool:pg.Pool,migrations:readonly ChildMigration[],expected:{database:string;role:string}):Promise<{applied:string[];unchanged:string[]}> {
  if(migrations.length!==childMigrationFiles.length || migrations.some((m,i)=>m.name!==childMigrationFiles[i] || createHash('sha256').update(m.sql).digest('hex')!==m.digest)) throw new Error('CHILD_MIGRATION_MANIFEST_INVALID');
  const client=await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s'");
    const identity=(await client.query('SELECT current_database() db,current_user role,session_user login')).rows[0];
    if(identity.db!==expected.database || identity.role!==expected.role || identity.login!==expected.role) throw new Error('CHILD_MIGRATION_IDENTITY_MISMATCH');
    await client.query("SELECT pg_advisory_xact_lock(741193,20261030)");
    const foreign=(await client.query(`SELECT 1 FROM pg_namespace WHERE nspname IN('child_stewardship','child_stewardship_webauthn','child_stewardship_guardian','child_backend_migrations') AND pg_get_userbyid(nspowner)<>current_user
      UNION ALL SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN('child_stewardship','child_stewardship_webauthn','child_stewardship_guardian','child_backend_migrations') AND pg_get_userbyid(c.relowner)<>current_user LIMIT 1`)).rows;
    if(foreign.length)throw new Error('CHILD_MIGRATION_OWNER_REQUIRED');
    await client.query(`CREATE SCHEMA IF NOT EXISTS child_backend_migrations;
      REVOKE ALL ON SCHEMA child_backend_migrations FROM PUBLIC;
      CREATE TABLE IF NOT EXISTS child_backend_migrations.entries(ordinal integer PRIMARY KEY,name text UNIQUE NOT NULL,digest text NOT NULL CHECK(digest ~ '^[a-f0-9]{64}$'),applied_at timestamptz NOT NULL DEFAULT clock_timestamp());
      REVOKE ALL ON child_backend_migrations.entries FROM PUBLIC;`);
    const prior=(await client.query('SELECT ordinal,name,digest FROM child_backend_migrations.entries ORDER BY ordinal')).rows;
    if(prior.length>migrations.length || prior.some((row,i)=>row.ordinal!==i+1 || row.name!==migrations[i]!.name || row.digest!==migrations[i]!.digest))throw new Error('CHILD_MIGRATION_HISTORY_MISMATCH');
    const applied:string[]=[],unchanged:string[]=[];
    for(const [index,migration] of migrations.entries()){
      if(prior[index]){unchanged.push(migration.name);continue;}
      // Only standalone top-level tokens in the checked-in migrations match.
      await client.query(migration.sql.replace(/^(?:BEGIN|COMMIT);\r?$/gm,''));
      await client.query('INSERT INTO child_backend_migrations.entries(ordinal,name,digest) VALUES($1,$2,$3)',[index+1,migration.name,migration.digest]);
      applied.push(migration.name);
    }
    await client.query('COMMIT');return{applied,unchanged};
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
  finally{client.release();}
}
