import assert from 'node:assert/strict';
import {Buffer} from 'node:buffer';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import test from 'node:test';

const root=resolve(__dirname,'../../..');
const readSource=()=>readFile(resolve(root,'workers/dropin/worker.mjs'),'utf8');

test('independent legacy Worker has an explicit isolated entry without enabling routes or resources',async()=>{
  const config=JSON.parse(await readFile(resolve(root,'wrangler.jsonc'),'utf8'));
  assert.deepEqual(config,{name:'dropin',account_id:'ff1026248646a5c87b3a664d87683818',main:'workers/dropin/worker.mjs',compatibility_date:'2026-05-13',
    workers_dev:false,preview_urls:false,routes:[],logpush:false});
  assert.equal(await readSource(),'export default {\n  async fetch(request, env) {\n    return new Response("Hello world")\n  }\n}\n');
});

test('legacy template preserves its observed response and does not impersonate a child service',async()=>{
  // Import the actual preserved module, with no network, identity, storage or
  // production binding. Generic 200 is legacy behavior, not API readiness.
  const worker=(await import(`data:text/javascript;base64,${Buffer.from(await readSource()).toString('base64')}`)).default;
  for(const [path,method] of [['/','GET'],['/health/ready','GET'],['/guardian/sessions','POST'],['/commands','POST'],['/recover','DELETE']] as const){
    const response=await worker.fetch(new Request(`https://legacy.invalid${path}`,{method}),Object.freeze({}));
    assert.equal(response.status,200);
    assert.equal(response.headers.get('content-type'),'text/plain;charset=UTF-8');
    assert.equal(await response.text(),'Hello world');
  }
});
