import assert from 'node:assert/strict';
import pg from 'pg';
import type { ChildSqlClient, ChildSqlConnection } from '../../services/api/src/domain/child-stewardship/postgres-store.js';
export function nativeChildPool() {
  assert.equal(process.env.CANOPYPROOF_NATIVE_TEST_CONFIRM,'confirm-disposable-test-database');
  const value=process.env.CANOPYPROOF_NATIVE_DATABASE_URL;
  assert.ok(value,'Native disposable database URL is required');
  const url=new URL(value);
  assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
  assert.match(url.pathname,/test/);
  return new pg.Pool({connectionString:value,max:6});
}
export function nativeChildSql(pool:pg.Pool, onQuery?:(text:string)=>void):ChildSqlClient {
  const connection=(client:pg.Pool|pg.PoolClient):ChildSqlConnection=>({
    async query<T extends Record<string,unknown>>(text:string,values:unknown[]=[]):Promise<T[]> {onQuery?.(text);return (await client.query(text,values)).rows as T[];},
  });
  return {...connection(pool),async transaction<T>(run:(db:ChildSqlConnection)=>Promise<T>) {
    const client=await pool.connect();
    try {await client.query('BEGIN');const result=await run(connection(client));await client.query('COMMIT');return result;}
    catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
  }};
}

/** Ephemeral non-owner application role in the explicitly disposable local test DB only. */
export async function scopedNativeChildPool(owner:pg.Pool, verifier=false) {
  const {randomUUID}=await import('node:crypto');
  const role=`child_store_${randomUUID().replaceAll('-','')}`;
  await owner.query(`CREATE ROLE ${role} NOLOGIN NOSUPERUSER NOBYPASSRLS`);
  await owner.query(`GRANT USAGE ON SCHEMA child_stewardship TO ${role}`);
  await owner.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA child_stewardship TO ${role}`);
  await owner.query(`GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA child_stewardship TO ${role}`);
  await owner.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA child_stewardship TO ${role}`);
  await owner.query("INSERT INTO child_stewardship.service_role_scopes(database_role,actor_role,scope_version,enabled,approval_ref,expires_at) SELECT $1,unnest($2::text[]),1,true,'disposable-native-store-test',clock_timestamp()+interval '1 hour'",[role,verifier?['operation-verifier']:['bootstrap','guardian','child','reviewer','protector','operator']]);
  const pool=new pg.Pool({connectionString:process.env.CANOPYPROOF_NATIVE_DATABASE_URL,max:6,options:`-c role=${role}`});
  return {pool,async close(){await pool.end();await owner.query(`DROP OWNED BY ${role}`);await owner.query(`DROP ROLE ${role}`);}};
}
