import {Hono} from 'hono';
import {createChildStewardshipRoutes} from '../routes/child-stewardship/index.js';
import {PostgresChildStore,type ChildSqlClient} from '../domain/child-stewardship/postgres-store.js';
import {PostgresChildResumeStore} from '../domain/child-stewardship/resume-store.js';
import type {BackendConfig} from './config.js';
import {backendLog} from './database.js';
import {childMigrationReady,type ChildMigration} from './migrations.js';
import {currentAuthorityClient} from './current-authority.js';

/** Dedicated entry point reuses the existing domain and SQL authority. It does
 * not mount legacy payments, generic uploads, enrollment or fixture ceremonies. */
export function createChildBackend(options:{config:BackendConfig;client?:ChildSqlClient;migrations:readonly ChildMigration[];sourceSha:string;fetch?:typeof fetch}) {
  const {config,client}=options,app=new Hono();
  const authority=config.authorityUrl && config.authorityPublicKey ? currentAuthorityClient({url:config.authorityUrl,publicKey:config.authorityPublicKey,audience:config.authorityAudience,...(options.fetch ? {fetch:options.fetch} : {})}) : null;
  const anchor=authority ? async(session:string)=>(await authority(session)).anchor : null;
  const store=config.mode==='synthetic-demo' && client && anchor ? new PostgresChildStore(client,anchor) : null;
  const resume=store && client && anchor ? new PostgresChildResumeStore(client,anchor) : null;
  let stopping=false;
  const ready=async()=>!stopping && config.mode==='synthetic-demo' && Boolean(store && client && await childMigrationReady(client,options.migrations) && await store.ready());
  app.use('*',async(c,next)=>{
    c.header('cache-control','private, no-store');c.header('x-content-type-options','nosniff');c.header('referrer-policy','no-referrer');
    c.header('content-security-policy',"default-src 'none'; frame-ancestors 'none'");
    const origin=c.req.header('origin');
    if(origin && origin!==config.origin)return c.json({error:{code:'ORIGIN_DENIED'}},403);
    if(origin){c.header('access-control-allow-origin',config.origin);c.header('vary','Origin');}
    if(c.req.method==='OPTIONS'){
      c.header('access-control-allow-methods','GET, POST, OPTIONS');
      c.header('access-control-allow-headers','Authorization, Content-Type, Idempotency-Key, If-Match, X-Child-Upload-Authorization');
      return c.body(null,204);
    }
    await next();
  });
  app.onError((_error,c)=>{backendLog('request_failed');return c.json({error:{code:'SERVICE_UNAVAILABLE',retryable:true}},503);});
  app.get('/health/live',c=>c.json({service:'canopyproof-child-backend',sourceSha:options.sourceSha,alive:true,syntheticOnly:true,realCapabilities:false}));
  app.get('/health/ready',async c=>{
    const available=await ready();
    return c.json({service:'canopyproof-child-backend',available,accountEntry:available?'synthetic-only':'closed',realCapabilities:false,
      perSessionRestoreAdmissionRequired:true},available?200:503);
  });
  app.use('/canopyproof/child-stewardship/v1/*',async(c,next)=>{
    if(!await ready())return c.json({error:{code:'SERVICE_UNAVAILABLE',retryable:true}},503);
    await next();
  });
  // All-role demo provisioning is a local fixture operation, not this hosted API.
  app.all('/canopyproof/child-stewardship/v1/demo-sessions',c=>c.json({error:{code:'SYNTHETIC_PROVISIONING_REQUIRED',retryable:false}},503));
  app.route('/canopyproof/child-stewardship/v1',createChildStewardshipRoutes({mode:config.mode,store,resumeStore:resume,onOperationalSignal:()=>backendLog('database_unavailable')}));
  app.all('*',c=>c.json({error:{code:'CAPABILITY_UNAVAILABLE',retryable:false}},403));
  return {app,ready,stop:()=>{stopping=true;}};
}
