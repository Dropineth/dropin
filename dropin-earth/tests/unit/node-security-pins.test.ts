import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import {parse} from 'yaml';

const workflows=[
 '../.github/workflows/cai-synthetic-boundary.yml','../.github/workflows/canopyproof-ci.yml',
 '../.github/workflows/child-do-synthetic.yml','../.github/workflows/deploy-canopyproof-staging.yml',
 '../.github/workflows/deploy-canopyproof.yml','../.github/workflows/deploy-cloudflare-worker.yml',
 '../.github/workflows/lifepp-web.yml','../.github/workflows/phase16-6-opennext-build-only.yml',
 '.github/workflows/ci.yml','.github/workflows/deploy-cloudflare-worker.yml',
];
const backend='node:22.23.5-bookworm-slim@sha256:e9f565d32859f0cbfb52125eafe8be39390f24dac302dc3cdf566e8ba3ab21ee';
const worker='node:22.23.5-alpine3.24@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a';
const source=(path:string)=>readFileSync(path,'utf8');
test('every existing setup-node pin selects the exact patched Node release',()=>{
 let count=0;
 for(const path of workflows){
  const doc=parse(source(path)) as {jobs:Record<string,{steps:Array<{uses?:string;with?:Record<string,string>}>}>};
  for(const job of Object.values(doc.jobs))for(const step of job.steps){
   if(step.uses?.startsWith('actions/setup-node@')){count++;assert.equal(step.with?.['node-version'],'22.23.5',path);}
  }
 }
 assert.equal(count,11,'workflow setup-node inventory changed; review the new runtime pin');
});
test('backend builder, runtime guard and non-deploy preparation agree on the immutable patch image',()=>{
 const docker=source('infra/child-backend/Dockerfile');
 assert.ok(docker.includes('ARG NODE_IMAGE='+backend));
 assert.ok(docker.includes('RUN test "$(node --version)" = v22.23.5'));
 const plan=JSON.parse(source('infra/child-backend/deployment-plan.json'));
 assert.equal(plan.api.nodeImageDigest,'docker.io/library/'+backend);
 assert.equal(plan.api.runtime,'Docker / Node 22.23.5');
 assert.equal(plan.api.automaticDeploy,false);assert.equal(plan.api.defaultAccountMode,'disabled');
 assert.match(source('scripts/build-child-backend.mjs'),/process\.version!==\x27v22\.23\.5\x27/);
 assert.match(source('scripts/child-backend-image-check.mjs'),/probeResult\.node!==\x27v22\.23\.5\x27/);
});
test('synthetic worker pull and execution share the patched Alpine digest without reducing isolation',()=>{
 const adapter=source('integrations/cai/docker-worker.mjs'),workflow=source('../.github/workflows/cai-synthetic-boundary.yml');
 assert.ok(adapter.includes("WORKER_IMAGE = '"+worker+"'"));assert.ok(workflow.includes('docker pull '+worker));
 for(const flag of ['--pull=never','--network=none','--read-only','--cap-drop=ALL','--security-opt=no-new-privileges','--user=65534:65534'])assert.ok(adapter.includes(flag),flag);
});
