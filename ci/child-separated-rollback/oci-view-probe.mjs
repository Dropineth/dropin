// Run ONLY with docker exec in the exact isolated backend image. Its input file
// contains only the synthetic child token, never a database URL or authority key.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function expectedStatus(mode){
  assert.ok(['before-admission','valid','revoked','expired','unavailable','advanced-floor'].includes(mode));
  return mode==='valid'?200:503;
}
export function expectedSource(value){
  assert.ok(['0e3d33b36beac4502488b18a0707c17fd34062e5','1d2efaa5258b70ed9f815af0ebf7109443734e59'].includes(value));return value;
}
export async function main(mode,source){
  const expected=expectedStatus(mode);
  expectedSource(source);
  assert.equal(process.version,'v22.23.5');assert.ok(process.getuid()>0);
  const access=JSON.parse(await readFile('/rehearsal/session-access.json','utf8'));
  assert.deepEqual(Object.keys(access).sort(),['childToken','environment','kind']);
  assert.equal(access.kind,'SyntheticOciSessionAccess/1');assert.equal(access.environment,'SIMULATION_ONLY');assert.equal(typeof access.childToken,'string');
  const get=path=>fetch('http://127.0.0.1:10000'+path,{signal:AbortSignal.timeout(5000)});
  const live=await get('/health/live');assert.equal(live.status,200);const identity=await live.json();
  assert.equal(identity.sourceSha,source);assert.equal(identity.realCapabilities,false);assert.equal(identity.syntheticOnly,true);
  const view=await fetch('http://127.0.0.1:10000/canopyproof/child-stewardship/v1/view',{
    headers:{authorization:`Bearer ${access.childToken}`},signal:AbortSignal.timeout(5000)});
  assert.equal(view.status,expected);await view.arrayBuffer();
  for(const route of ['guardian/passkeys/register','guardian/passkeys/recover','demo-sessions']){
    const denied=await fetch('http://127.0.0.1:10000/canopyproof/child-stewardship/v1/'+route,{method:'POST',signal:AbortSignal.timeout(5000)});
    assert.equal(denied.status,503);await denied.arrayBuffer();
  }
  return {kind:'SyntheticOciSessionHttpProbe/1',mode,status:'PASS',viewHttpStatus:expected,enrollmentHttpStatus:503,
    sourceSha:identity.sourceSha,realCapabilities:false,productionReady:false,
    // Independent orchestration must correlate currentRequests before/after.
    authorityCallCountVerified:false,crossServiceWritesRevocationRace:'NOT_RUN',productionFinality:'NOT_RUN'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  main(process.argv[2],process.argv[3]).then(value=>process.stdout.write(JSON.stringify(value)+'\n')).catch(()=>{process.stderr.write('SYNTHETIC_OCI_PROBE_FAILED\n');process.exitCode=1;});
}
