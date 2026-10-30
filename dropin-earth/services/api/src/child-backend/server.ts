import {Server} from 'node:http';
import {serve} from '@hono/node-server';
import {readFile} from 'node:fs/promises';
import {backendConfig} from './config.js';
import {backendPool,backendSql,backendLog} from './database.js';
import {loadChildMigrations} from './migrations.js';
import {createChildBackend} from './app.js';

async function main(){
  const config=backendConfig(process.env);
  const manifest=JSON.parse(await readFile(new URL('./build.json',import.meta.url),'utf8')) as {sourceSha:string};
  if(!/^[a-f0-9]{40}$/.test(manifest.sourceSha))throw new Error('BUILD_PROVENANCE_REQUIRED');
  const migrations=await loadChildMigrations(new URL('./migrations/',import.meta.url));
  const pool=config.mode==='synthetic-demo' && config.databaseUrl ? backendPool(config) : null;
  const backend=createChildBackend({config,migrations,sourceSha:manifest.sourceSha,...(pool?{client:backendSql(pool)}:{})});
  const server=serve({fetch:backend.app.fetch,hostname:'0.0.0.0',port:config.port});
  if(!(server instanceof Server))throw new Error('HTTP_SERVER_REQUIRED');
  server.requestTimeout=15_000;server.headersTimeout=10_000;server.keepAliveTimeout=5000;
  let stopping=false;
  const shutdown=()=>{
    if(stopping)return;stopping=true;backend.stop();
    const deadline=setTimeout(()=>{backendLog('shutdown_failed');process.exit(1);},20_000);deadline.unref();
    server.close(()=>{void (pool?.end()??Promise.resolve()).then(()=>{clearTimeout(deadline);process.exitCode=0;}).catch(()=>{backendLog('shutdown_failed');process.exitCode=1;});});
  };
  process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
}
void main().catch(()=>{backendLog('startup_failed');process.exitCode=1;});
