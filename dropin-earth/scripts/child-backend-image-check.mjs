import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import console from 'node:console';
const exec=promisify(execFile);
const run=async(args,timeout=30_000)=>(await exec('docker',args,{timeout,maxBuffer:32*1024*1024})).stdout.trim();
const sha=(await exec('git',['rev-parse','HEAD'])).stdout.trim();
const plan=JSON.parse(await readFile('infra/child-backend/deployment-plan.json','utf8'));
const base=plan.api.nodeImageDigest;
if(!/^[a-f0-9]{40}$/.test(sha)||!/^docker\.io\/library\/node:22\.23\.4-bookworm-slim@sha256:[a-f0-9]{64}$/.test(base))throw new Error('PINNED_IMAGE_REQUIRED');
const tag=`canopyproof-child-backend:test-${sha}`,name=`child-backend-test-${randomUUID()}`;
try{
 await run(['build','--pull=false','--build-arg',`NODE_IMAGE=${base}`,'--build-arg',`CHILD_BUILD_SHA=${sha}`,'-f','infra/child-backend/Dockerfile','-t',tag,'.'],600_000);
 const image=JSON.parse(await run(['image','inspect',tag]))[0];
 if(image.Config.User!=='node')throw new Error('NON_ROOT_RUNTIME_REQUIRED');
 await run(['run','--detach','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges',tag]);
 // In-container loopback only: no public port, database or production endpoint.
 const probe=`const assert=require('node:assert/strict');(async()=>{let live;for(let i=0;i<40;i++){try{live=await fetch('http://127.0.0.1:10000/health/live');break;}catch{await new Promise(r=>setTimeout(r,50));}}assert.equal(live?.status,200);const body=await live.json();assert.equal(body.sourceSha,process.argv[1]);assert.equal(body.realCapabilities,false);assert.equal((await fetch('http://127.0.0.1:10000/health/ready')).status,503);assert.equal((await fetch('http://127.0.0.1:10000/canopyproof/child-stewardship/v1/guardian/sessions',{method:'POST',body:'fixed synthetic input'})).status,503);console.log(JSON.stringify({node:process.version,sourceSha:body.sourceSha,uid:process.getuid(),accountEntry:'closed'}));})().catch(()=>process.exit(1));`;
 const probeResult=JSON.parse(await run(['exec',name,'node','-e',probe,sha]));
 if(probeResult.node!=='v22.23.4'||probeResult.uid===0)throw new Error('RUNTIME_IDENTITY_MISMATCH');
 const manifest=JSON.parse(await run(['exec',name,'node','-e',"console.log(require('node:fs').readFileSync('/app/build.json','utf8'))"]));
 await run(['stop','--time','25',name]);const exited=JSON.parse(await run(['inspect',name]))[0];
 if(exited.State.ExitCode!==0)throw new Error('GRACEFUL_SHUTDOWN_FAILED');
 const result={sourceSha:sha,baseImage:base,imageId:image.Id,manifest,probe:probeResult,exitCode:exited.State.ExitCode,productionDeployed:false};
 await mkdir('reports/child-backend',{recursive:true});await writeFile('reports/child-backend/image-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}catch(error){
 // No credentials are passed into Docker; retain bounded compiler/install output
 // for CI diagnostics, never inspect unrelated runtime configuration.
 if(error&&typeof error==='object'&&'stderr'in error)console.error(String(error.stderr).slice(-16_000));
 throw error;
}finally{await run(['rm','--force',name]).catch(()=>{});}
