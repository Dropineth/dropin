import assert from 'node:assert/strict';
import {mkdtemp,lstat,readFile,rm,unlink,writeFile} from 'node:fs/promises';
import {createConnection} from 'node:net';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {startControl,parseCommand} from './authority-control.mjs';
function exchange(path,input,{end=true}={}){return new Promise((resolve,reject)=>{
  const socket=createConnection({path});const chunks=[];const timer=setTimeout(()=>{socket.destroy();reject(new Error('TEST_TIMEOUT'));},3000);
  socket.on('connect',()=>{if(end)socket.end(input);else socket.write(input);});socket.on('data',b=>chunks.push(b));
  socket.on('error',error=>{clearTimeout(timer);reject(error);});socket.on('end',()=>{clearTimeout(timer);resolve(JSON.parse(Buffer.concat(chunks).toString()));});
});}
async function fixture(t,overrides={}){
  const directory=await mkdtemp(join(tmpdir(),'authority-control-')),path=join(directory,'control.sock');let mode='healthy',advances=0;
  let bridge;t.after(async()=>{await bridge?.stop();await rm(directory,{recursive:true,force:true});});
  const authority={setMode:value=>{mode=value;},advanceFloor:()=>{advances++;return 2;},metrics:()=>({currentRequests:0,signedResponses:0,refusedResponses:0,handlerErrors:0,uniqueNonces:0}),...overrides};
  bridge=await startControl({path,authority});
  return {path,directory,bridge,authority,get mode(){return mode;},get advances(){return advances;}};
}
test('actual private Unix socket accepts modes/metrics/one floor advance and cleans its own path',async t=>{
  const f=await fixture(t);assert.equal((await lstat(f.path)).mode&0o777,0o600);
  for(const mode of ['revoked','expired','unavailable','healthy']){assert.deepEqual(await exchange(f.path,JSON.stringify({command:mode})),{ok:true});assert.equal(f.mode,mode);}
  assert.deepEqual(await exchange(f.path,'{"command":"metrics"}'),{ok:true,metrics:f.authority.metrics()});
  assert.deepEqual(await exchange(f.path,'{"command":"advance-floor"}'),{ok:true,sequence:2});
  assert.deepEqual(await exchange(f.path,'{"command":"advance-floor"}'),{ok:false});assert.equal(f.advances,1);
  await f.bridge.stop();await assert.rejects(lstat(f.path),{code:'ENOENT'});
});
test('extra fields, unknown command, malformed/oversized/invalid-UTF8 and multiple frames never invoke mode',async t=>{
  const f=await fixture(t);
  for(const input of ['{"command":"revoked","url":"SECRET"}','{"command":"stop"}','[]','null','{',
    '{"command":"revoked"}\n{"command":"healthy"}',Buffer.alloc(1025,32),Buffer.from([0xff])]){
    assert.deepEqual(await exchange(f.path,input),{ok:false});assert.equal(f.mode,'healthy');
  }
});
test('incomplete frame expires within one-second deadline',async t=>{
  const f=await fixture(t),start=Date.now();assert.deepEqual(await exchange(f.path,'{"command":',{end:false}),{ok:false});assert.ok(Date.now()-start<2500);
});
test('authority method errors and unsafe metrics are sanitized, and failed advance is not retried',async t=>{
  let calls=0;const f=await fixture(t,{setMode(){throw new Error('SECRET');},metrics(){return {token:'SECRET'};},advanceFloor(){calls++;throw new Error('SECRET');}});
  for(const command of ['healthy','metrics','advance-floor','advance-floor'])assert.deepEqual(await exchange(f.path,JSON.stringify({command})),{ok:false});
  assert.equal(calls,1);
});
test('existing path is never replaced and replacement file survives bridge cleanup',async t=>{
  const f=await fixture(t);await assert.rejects(startControl({path:f.path,authority:f.authority}),/AUTHORITY_CONTROL_REJECTED/);
  await unlink(f.path);await writeFile(f.path,'KEEP');await f.bridge.stop();assert.equal(await readFile(f.path,'utf8'),'KEEP');
});
test('parser and fixed-path CLI reject arguments without raw errors',()=>{
  assert.throws(()=>parseCommand(Buffer.from('{"command":"metrics","extra":true}')));
  const result=spawnSync(process.execPath,[new URL('./authority-control-client.mjs',import.meta.url).pathname,'SECRET'],{encoding:'utf8',env:{PATH:process.env.PATH},timeout:3000});
  assert.equal(result.status,1);assert.equal(result.stdout,'{"ok":false}\n');assert.equal(result.stderr,'');
});
