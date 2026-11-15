import type pg from 'pg';
import type {ChildMigration} from './migrations.js';

const metadataSql = `SELECT current_database() AS db, current_user AS actor, session_user AS login,
  current_setting('transaction_read_only')='on' AS read_only,
  coalesce((SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid=pg_backend_pid()),false) AS tls,
  (NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreaterole
    AND NOT r.rolcreatedb AND NOT r.rolreplication) AS restricted,
  NOT pg_has_role(r.oid,d.datdba,'MEMBER') AS separate_owner
  FROM pg_catalog.pg_roles r JOIN pg_catalog.pg_database d ON d.datname=current_database()
  WHERE r.rolname=current_user`;
const privilegesSql = `SELECT
  has_table_privilege(current_user,c.oid,'SELECT') AS can_read,
  NOT (has_table_privilege(current_user,c.oid,'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER')
    OR has_schema_privilege(current_user,n.oid,'CREATE')
    OR pg_has_role(current_user,'pg_write_all_data','MEMBER')
    OR pg_has_role(current_user,c.relowner,'MEMBER')
    OR pg_has_role(current_user,n.nspowner,'MEMBER')) AS journal_read_only
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='child_backend_migrations' AND c.relname='entries' AND c.relkind='r'`;
const historySql='SELECT ordinal,name,digest FROM child_backend_migrations.entries ORDER BY ordinal LIMIT 14';
const reject=()=>new Error('CLOSED_STARTUP_DB_UNVERIFIED');

/** Read-only startup check. No app query client, authorization result, or
 * request handler is returned. Inputs are pinned config, never user data. */
export async function attestClosedStartup(pool:Pick<pg.Pool,'connect'>, expected:{database:string;role:string}, migrations:readonly ChildMigration[]):Promise<void> {
  if(migrations.length!==13) throw reject();
  const db=await pool.connect();
  try{
    await db.query('BEGIN READ ONLY');
    const {rows:[s]}=await db.query(metadataSql);
    if(s?.db!==expected.database || s.actor!==expected.role || s.login!==expected.role ||
      [s.read_only,s.tls,s.restricted,s.separate_owner].some(value=>value!==true)) throw reject();
    const {rows:[privileges]}=await db.query(privilegesSql);
    if(privileges?.can_read!==true || privileges.journal_read_only!==true) throw reject();
    const {rows}=await db.query<{ordinal:number;name:string;digest:string}>(historySql);
    if(rows.length!==migrations.length || !rows.every((row,i)=>row.ordinal===i+1 && row.name===migrations[i]?.name &&
      row.digest===migrations[i]?.digest)) throw reject();
  }finally{
    try {await db.query('ROLLBACK');}finally{db.release(true);}
  }
}
