import { ChildApiError, childDigest, stableJson, type ChildStore, type ChildSnapshot, type ChildReceipt, type ChildTransaction, type DemoSession, type DemoToken } from "./store.js";

export interface ChildSqlConnection {
  query<T extends Record<string, unknown> = Record<string, unknown>>(text: string, values?: unknown[]): Promise<T[]>;
}
export interface ChildSqlClient extends ChildSqlConnection {
  transaction<T>(run: (connection: ChildSqlConnection) => Promise<T>): Promise<T>;
}
type StateRecord = { domain: string; collection: string; record_id: string; payload: unknown; position: number };
const learningCollections = ['actors','profiles','guardianLinks','consents','trees','tasks','assignments','observations','reviews','assessments','contributions','disputes','aliases','audit','outbox','privacyRequests','idempotency'];
export function normalizeChildSnapshot(snapshot: ChildSnapshot): StateRecord[] {
  const records: StateRecord[] = [];
  for (const domain of ['learning','rights'] as const) {
    const state = snapshot[domain] as unknown as Record<string, unknown>;
    const meta: Record<string, unknown> = {};
    const arrays: string[] = [];
    for (const [collection, value] of Object.entries(state)) {
      if (domain === 'learning' && !learningCollections.includes(collection) || domain === 'rights' && ['schemaVersion','mode'].includes(collection)) { meta[collection] = value; continue; }
      if (Array.isArray(value)) {
        arrays.push(collection);
        value.forEach((payload, position) => {
          const identity = typeof payload === 'string' ? payload : payload.id ?? payload.operationId;
          if (typeof identity !== 'string') throw new ChildApiError('INVALID_STATE', 503);
          records.push({ domain, collection, record_id: identity, payload, position });
        });
      } else if (value && typeof value === 'object') {
        for (const [record_id, payload] of Object.entries(value)) records.push({ domain, collection, record_id, payload, position: 0 });
      } else throw new ChildApiError('INVALID_STATE', 503);
    }
    meta.collections = Object.keys(state).filter(key => !(key in meta));
    meta.arrays = arrays;
    records.push({ domain, collection: 'meta', record_id: 'current', payload: meta, position: 0 });
  }
  if (snapshot.rightsContext) records.push({ domain: 'rights', collection: 'securityContext', record_id: 'current', payload: snapshot.rightsContext, position: 0 });
  return records;
}
export function reconstructChildSnapshot(records: StateRecord[], revision: number): ChildSnapshot {
  const snapshot: Record<string, unknown> = { version: revision };
  for (const domain of ['learning','rights']) {
    const meta = records.find(r => r.domain === domain && r.collection === 'meta')?.payload as Record<string, unknown> | undefined;
    if (!meta || !Array.isArray(meta.collections) || !Array.isArray(meta.arrays)) throw new ChildApiError('AUTHORITY_UNAVAILABLE', 503);
    const { collections, arrays, ...state } = meta;
    for (const collection of collections as string[]) {
      const rows = records.filter(r => r.domain === domain && r.collection === collection).sort((a,b) => a.position-b.position);
      state[collection] = arrays.includes(collection) ? rows.map(r => r.payload) : Object.fromEntries(rows.map(r => [r.record_id,r.payload]));
    }
    snapshot[domain] = state;
  }
  const context = records.find(r => r.domain === 'rights' && r.collection === 'securityContext');
  if (context) snapshot.rightsContext = context.payload;
  return snapshot as ChildSnapshot;
}
async function scope(db: ChildSqlConnection, sessionId: string, role: string, operation: string, operationId = '') {
  await db.query("SELECT set_config('app.child_session_id',$1,true),set_config('app.child_actor_role',$2,true),set_config('app.child_operation',$3,true),set_config('app.child_operation_id',$4,true)",[sessionId,role,operation,operationId]);
}
const recordKey = (record: StateRecord) => `${record.domain}/${record.collection}/${record.record_id}`;
async function persist(db: ChildSqlConnection, sessionId: string, revision: number, before: StateRecord[], after: StateRecord[]) {
  const old = new Map(before.map(record => [recordKey(record),record]));
  const next = new Set(after.map(recordKey));
  if (before.some(record => !next.has(recordKey(record)))) throw new ChildApiError('APPEND_CORRECTION_REQUIRED', 409);
  for (const record of after) {
    const previous = old.get(recordKey(record));
    if (previous && stableJson(previous.payload) === stableJson(record.payload) && previous.position === record.position) continue;
    await db.query(`INSERT INTO child_stewardship.state_records(session_id,domain,collection,record_id,payload,revision,position)
      VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6,$7)
      ON CONFLICT (session_id,domain,collection,record_id) DO UPDATE SET payload=EXCLUDED.payload,revision=EXCLUDED.revision,position=EXCLUDED.position`,
      [sessionId,record.domain,record.collection,record.record_id,JSON.stringify(record.payload),revision,record.position]);
  }
}
/** PostgreSQL normalized state + immutable facts. No snapshot or memory fallback.
 * Existing snapshot-only rows are rejected until explicitly migrated and reviewed.
 */
export class PostgresChildStore implements ChildStore {
  constructor(private readonly client: ChildSqlClient) {}
  async ready(): Promise<boolean> {
    try {
      // Schema presence alone is not authority readiness. Never run this adapter as
      // its migration owner or with a login that can bypass tenant policies.
      const rows = await this.client.query<{ready:boolean}>(`WITH effective_role AS (
        SELECT oid,rolname,rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user
      ), latest_scopes AS (
        SELECT DISTINCT ON (actor_role) actor_role,enabled,expires_at
        FROM child_stewardship.service_role_scopes WHERE database_role=current_user
        ORDER BY actor_role,scope_version DESC
      ) SELECT EXISTS(SELECT 1 FROM child_stewardship.storage_version WHERE version=2)
        AND EXISTS(SELECT 1 FROM effective_role WHERE NOT rolsuper AND NOT rolbypassrls)
        AND NOT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          JOIN effective_role r ON r.oid=c.relowner WHERE n.nspname='child_stewardship')
        AND (SELECT count(*) FROM latest_scopes WHERE enabled AND expires_at>clock_timestamp()
          AND actor_role IN ('bootstrap','guardian','child','reviewer','protector','operator'))=6
        AND NOT EXISTS(SELECT 1 FROM latest_scopes WHERE actor_role='registry-publisher' AND enabled AND expires_at>clock_timestamp())
        AS ready`);
      return rows[0]?.ready === true;
    } catch { return false; }
  }
  async create(session: DemoSession, tokens: DemoToken[]): Promise<void> {
    await this.client.transaction(async db => {
      await scope(db,session.id,'bootstrap','create-synthetic-session');
      await db.query("INSERT INTO child_stewardship.sessions(id,mode,expires_at,revision,storage_format) VALUES ($1::uuid,'synthetic-demo',$2::timestamptz,$3,'normalized-v2')",[session.id,session.expiresAt,session.snapshot.version]);
      await persist(db,session.id,session.snapshot.version,[],normalizeChildSnapshot(session.snapshot));
      for (const token of tokens) await db.query("INSERT INTO child_stewardship.session_tokens(token_hash,session_id,actor_id,device_id,epoch) VALUES ($1,$2::uuid,$3,$4,$5)",[token.hash,session.id,token.principal.actorId,token.principal.deviceId,token.principal.epoch]);
    });
  }
  async resolveToken(hash: string, now: string) {
    return this.client.transaction(async db => {
      await db.query("SELECT set_config('app.child_token_hash',$1,true)",[hash]);
      const rows = await db.query<{session_id:string;actor_id:string;device_id:string;epoch:number}>("SELECT session_id::text,actor_id,device_id,epoch FROM child_stewardship.session_tokens WHERE token_hash=$1",[hash]);
      const token = rows[0]; if (!token) return null;
      await scope(db,token.session_id,'child','authenticate');
      const sessions = await db.query("SELECT id FROM child_stewardship.sessions WHERE id=$1::uuid AND expires_at>$2::timestamptz AND mode='synthetic-demo' AND storage_format='normalized-v2'",[token.session_id,now]);
      return sessions.length ? {sessionId:token.session_id,principal:{actorId:token.actor_id,deviceId:token.device_id,epoch:token.epoch}} : null;
    });
  }
  async transact<T>(sessionId: string, now: string, run: (tx: ChildTransaction) => T): Promise<T> {
    return this.client.transaction(async db => {
      await scope(db,sessionId,'child','read');
      const sessions = await db.query<{revision:string}>("SELECT revision::text FROM child_stewardship.sessions WHERE id=$1::uuid AND expires_at>$2::timestamptz AND mode='synthetic-demo' AND storage_format='normalized-v2' FOR UPDATE",[sessionId,now]);
      if (!sessions[0]) throw new ChildApiError('UNAUTHORIZED',401);
      const records = await db.query<StateRecord & Record<string,unknown>>("SELECT domain,collection,record_id,payload,position FROM child_stewardship.state_records WHERE session_id=$1::uuid ORDER BY domain,collection,position,record_id",[sessionId]);
      const revision = Number(sessions[0].revision);
      const snapshot = reconstructChildSnapshot(records,revision);
      const storedReceipts = await db.query<{actor_id:string;idempotency_key:string;request_digest:string;result:unknown;revision:string}>("SELECT actor_id,idempotency_key,request_digest,result,revision::text FROM child_stewardship.receipts WHERE session_id=$1::uuid",[sessionId]);
      const receipts:ChildReceipt[] = storedReceipts.map(r=>({actorId:r.actor_id,key:r.idempotency_key,digest:r.request_digest,result:r.result,version:Number(r.revision)}));
      const oldOperations = new Set(Object.keys(snapshot.rights.executedOperations));
      const tx:ChildTransaction = {snapshot,receipts,audit:[],outbox:[]};
      const result = run(tx);
      const newOperation = Object.keys(tx.snapshot.rights.executedOperations).find(key=>!oldOperations.has(key)) ?? '';
      await scope(db,sessionId,tx.actorRole ?? 'child',tx.operation ?? 'read',newOperation);
      if (tx.snapshot.version !== revision) {
        await persist(db,sessionId,tx.snapshot.version,records,normalizeChildSnapshot(tx.snapshot));
        await db.query("UPDATE child_stewardship.sessions SET revision=$2 WHERE id=$1::uuid",[sessionId,tx.snapshot.version]);
      }
      for (const receipt of tx.receipts.slice(storedReceipts.length)) await db.query("INSERT INTO child_stewardship.receipts(session_id,actor_id,idempotency_key,request_digest,result,revision) VALUES ($1::uuid,$2,$3,$4,$5::jsonb,$6)",[sessionId,receipt.actorId,receipt.key,receipt.digest,JSON.stringify(receipt.result),receipt.version]);
      if (tx.audit.length) {
        const previous = await db.query<{digest:string}>("SELECT digest FROM child_stewardship.audit WHERE session_id=$1::uuid ORDER BY sequence DESC LIMIT 1",[sessionId]);
        let previousDigest = previous[0]?.digest ?? '0'.repeat(64);
        for (const event of tx.audit) {
          const digest=childDigest({previousDigest,event});
          await db.query("INSERT INTO child_stewardship.audit(session_id,event,previous_digest,digest) VALUES ($1::uuid,$2::jsonb,$3,$4)",[sessionId,JSON.stringify(event),previousDigest,digest]); previousDigest=digest;
        }
      }
      for (const event of tx.outbox) await db.query("INSERT INTO child_stewardship.outbox(session_id,event_id,kind,resource_id,audience) VALUES ($1::uuid,$2,$3,$4,$5) ON CONFLICT DO NOTHING",[sessionId,event.id,event.kind,event.resourceId,event.audience]);
      return result;
    });
  }
}
