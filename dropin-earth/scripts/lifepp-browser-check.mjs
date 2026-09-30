/* global fetch, AbortSignal */
import { spawn } from 'node:child_process';
import process from 'node:process';
import { setTimeout as delay } from 'node:timers/promises';
const port = '3102';
const env = {...process.env, LIFEPP_BROWSER_BASE_URL:`http://127.0.0.1:${port}`, LIFEPP_BROWSER_SERVER_MODE:'next-production'};
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
 const test=spawn(process.execPath,['--import','tsx','tests/browser/lifepp.spec.ts'],{env,stdio:'inherit'});
 process.exitCode=await new Promise(resolve=>test.once('exit',code=>resolve(code??1)));
} finally {server.kill('SIGTERM');}
