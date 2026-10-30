import pg from 'pg';
import type {ChildSqlClient, ChildSqlConnection} from '../domain/child-stewardship/postgres-store.js';
import type {BackendConfig} from './config.js';

export type BackendSignal = 'database_unavailable' | 'request_failed' | 'startup_failed' | 'shutdown_failed';
/** Fixed signal vocabulary: no SQL, URL, request path/body, identity or Error.message. */
export function backendLog(signal: BackendSignal, write: (line: string) => void = line => console.error(line)): void {
  const allowed: readonly string[] = ['database_unavailable','request_failed','startup_failed','shutdown_failed'];
  write(JSON.stringify({service:'canopyproof-child-backend',signal:allowed.includes(signal) ? signal : 'request_failed'}));
}
export function backendPool(config: BackendConfig): pg.Pool {
  if(!config.databaseUrl) throw new Error('CHILD_DATABASE_UNAVAILABLE');
  const pool = new pg.Pool({connectionString:config.databaseUrl,max:4,min:0,
    connectionTimeoutMillis:2000,idleTimeoutMillis:30_000,
    statement_timeout:5000,lock_timeout:2000,idle_in_transaction_session_timeout:5000,
    application_name:'canopyproof-child-backend',
    ssl:config.databaseTls === 'local-test' ? false : {rejectUnauthorized:true},
  });
  pool.on('error', () => backendLog('database_unavailable'));
  return pool;
}
/** Direct database login, never SET ROLE or a pooler that substitutes session_user.
 * Each checkout is cleaned before reuse. No write or transaction retry exists. */
export function backendSql(pool: pg.Pool): ChildSqlClient {
  const connection = (client: pg.PoolClient): ChildSqlConnection => ({
    async query<T extends Record<string,unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
      return (await client.query(text,values)).rows as T[];
    },
  });
  async function checkout<T>(run: (client: pg.PoolClient) => Promise<T>): Promise<T> {
    const client = await pool.connect(); let destroy = false;
    try { return await run(client); }
    catch(error){ destroy = true; throw error; }
    finally {
      if(!destroy) { try { await client.query('DISCARD ALL'); } catch { destroy = true; } }
      client.release(destroy);
    }
  }
  return {
    query: <T extends Record<string,unknown>>(text: string,values:unknown[]=[]) => checkout(client => connection(client).query<T>(text,values)),
    transaction: <T>(run:(db:ChildSqlConnection)=>Promise<T>) => checkout(async client => {
      const started = performance.now();
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      try {
        const result = await run(connection(client));
        if(performance.now()-started > 15_000) throw new Error('CHILD_TRANSACTION_DEADLINE');
        await client.query('COMMIT'); return result;
      } catch(error) { await client.query('ROLLBACK').catch(()=>{}); throw error; }
    }),
  };
}
