import {createPublicKey} from 'node:crypto';

export type BackendConfig = {
  mode: 'disabled' | 'synthetic-demo'; port: number; origin: string;
  databaseUrl: string | undefined; databaseTls: 'verify-full' | 'local-test';
  authorityUrl: string | undefined; authorityPublicKey: string | undefined;
  authorityAudience: string;
};
const invalid = (): never => { throw new Error('CHILD_BACKEND_CONFIGURATION_INVALID'); };
function https(value: string): URL {
  let url: URL; try { url = new URL(value); } catch { return invalid(); }
  if(url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) return invalid();
  return url;
}
/** No ambient DATABASE_URL, migration credential or permissive memory fallback. */
export function backendConfig(env: NodeJS.ProcessEnv): BackendConfig {
  const mode = env.CHILD_BACKEND_MODE ?? 'disabled';
  if(mode !== 'disabled' && mode !== 'synthetic-demo') return invalid();
  const port = Number(env.PORT ?? '10000');
  if(!Number.isInteger(port) || port < 1 || port > 65535) return invalid();
  if(env.CHILD_MIGRATION_DATABASE_URL || env.CHILD_VERIFIER_DATABASE_URL) return invalid();
  const origin = env.CHILD_WEB_ORIGIN ?? 'https://synthetic.invalid';
  if(https(origin).origin !== origin) return invalid();
  const databaseTls = env.CHILD_DATABASE_TLS ?? 'verify-full';
  if(databaseTls !== 'verify-full' && databaseTls !== 'local-test') return invalid();
  const databaseUrl = env.CHILD_DATABASE_URL;
  if(databaseUrl){
    let db: URL; try { db = new URL(databaseUrl); } catch { return invalid(); }
    // URL options cannot replace TLS verification or inject session configuration.
    if(!['postgres:', 'postgresql:'].includes(db.protocol) || !db.username || !db.password || db.search || db.hash || db.pathname.length < 2) return invalid();
    if(databaseTls === 'local-test' && (!['localhost','127.0.0.1','[::1]'].includes(db.hostname) || !db.pathname.includes('test'))) return invalid();
  }
  const authorityUrl = env.CHILD_CURRENT_AUTHORITY_URL;
  if(authorityUrl) https(authorityUrl);
  const authorityPublicKey = env.CHILD_CURRENT_AUTHORITY_PUBLIC_KEY;
  if(authorityPublicKey){
    try {
      if(!authorityPublicKey.startsWith('-----BEGIN PUBLIC KEY-----') || createPublicKey(authorityPublicKey).asymmetricKeyType !== 'ed25519') return invalid();
    } catch { return invalid(); }
  }
  const authorityAudience = env.CHILD_CURRENT_AUTHORITY_AUDIENCE ?? 'canopyproof:synthetic:child-backend';
  if(!/^[a-zA-Z0-9:_-]{8,160}$/.test(authorityAudience)) return invalid();
  // Incomplete wiring may boot CLOSED for readiness inspection; never invent a root.
  return {mode,port,origin,databaseUrl,databaseTls,authorityUrl,authorityPublicKey,authorityAudience};
}
