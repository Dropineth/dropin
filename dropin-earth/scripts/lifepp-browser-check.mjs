/* global fetch, AbortSignal */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import console from 'node:console';
import { join } from 'node:path';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
const port = '3102';
const engine = process.env.LIFEPP_BROWSER_ENGINE ?? 'chromium';
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine), `Unsupported LIFEPP_BROWSER_ENGINE: ${engine}`);
const env = {...process.env, LIFEPP_BROWSER_BASE_URL:`http://127.0.0.1:${port}`, LIFEPP_BROWSER_SERVER_MODE:'next-production', LIFEPP_BROWSER_ENGINE:engine, LIFEPP_BROWSER_OUTPUT_DIR:process.env.LIFEPP_BROWSER_OUTPUT_DIR ?? join(process.cwd(), 'reports/lifepp-validation/browser/next', engine)};
console.log(JSON.stringify({ lifeppEngine: engine, lifeppViewportWidths: [375, 390, 768, 1440, 1920], spatialAcceptance: { routes: ['/life/center', '/en/life/center'], coverage: 'subchecks within existing Center route results', renderer: 'software; WebGL unaccepted', syntheticExportNotReceipt: true }, maplibreEngine: 'chromium', output: env.LIFEPP_BROWSER_OUTPUT_DIR }));
const server = spawn(process.execPath,['node_modules/next/dist/bin/next','start','apps/web','--hostname','127.0.0.1','--port',port],{env,stdio:['ignore','pipe','pipe']});
let serverOutput='';
server.stdout.on('data',data=>{serverOutput+=data;});
server.stderr.on('data',data=>{serverOutput+=data;});
try {
 let ready=false;
 for(let attempt=0;attempt<60;attempt++){
  if(server.exitCode!==null)throw new Error(`Preview server exited: ${serverOutput}`);
  // Never accept an unrelated listener on this port as the child we started.
  if(serverOutput.includes('Ready in')) {
   try {const response=await fetch(env.LIFEPP_BROWSER_BASE_URL,{signal:AbortSignal.timeout(1000)});if(response.status===200){ready=true;break;}}catch{ /* Retry while the local server starts. */ }
  }
  await delay(500);
 }
 if(!ready)throw new Error(`Preview server was not ready: ${serverOutput}`);
 for (const spec of ['tests/browser/lifepp.spec.ts', 'tests/browser/maplibre-remediation.spec.ts']) {
  const test=spawn(process.execPath,['--import','tsx',spec],{env,stdio:'inherit'});
  const code=await new Promise(resolve=>{test.once('error',()=>resolve(1));test.once('exit',result=>resolve(result??1));});
  if(code!==0)process.exitCode=code;
 }
} finally {server.kill('SIGTERM');}
