import type { ChildSqlClient, ChildSqlConnection } from './postgres-store.js';
type RawConnection = { $queryRawUnsafe<T=unknown>(query:string,...values:unknown[]):Promise<T> };
type RawClient = RawConnection & { $transaction<T>(run:(connection:RawConnection)=>Promise<T>,options:{timeout:number;isolationLevel:'ReadCommitted'}):Promise<T> };
const connection = (raw:RawConnection):ChildSqlConnection => ({query: <T extends Record<string,unknown>>(text:string,values:unknown[]=[])=>raw.$queryRawUnsafe<T[]>(text,...values)});
/** Values are always PostgreSQL bound parameters. No user input is SQL text. */
export function prismaChildSqlClient(raw:RawClient):ChildSqlClient {
  return {...connection(raw),transaction:run=>raw.$transaction(tx=>run(connection(tx)),{timeout:15_000,isolationLevel:'ReadCommitted'})};
}
