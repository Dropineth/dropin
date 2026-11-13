import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import process from 'node:process';
import test from 'node:test';
import {promisify} from 'node:util';

const run=promisify(execFile),command=['--import','tsx','scripts/guardian-authority-acceptance.mjs'];
test('backend preparation preserves Cloudflare-first and closed real-service gates',async()=>{
  const plan=JSON.parse(await readFile('infra/child-backend/deployment-plan.json','utf8'));
  assert.equal(plan.providerPreference,'Cloudflare');assert.equal(plan.status,'not-approved-for-resource-creation');
  assert.equal(plan.api.automaticDeploy,false);assert.equal(plan.api.automaticPreviewResources,false);assert.equal(plan.api.defaultAccountMode,'disabled');
  assert.equal(plan.externalAuthority.currentEndpoint,null);assert.equal(plan.externalAuthority.guardianIssuer,null);assert.equal(plan.externalAuthority.guardianRootPublicKey,null);
  assert.equal(plan.realChildren,false);assert.equal(plan.realPayments,false);assert.equal(plan.mainnet,false);
});
test('authority acceptance CLI requires explicit synthetic mode, never an arbitrary endpoint',async()=>{
  for(const args of [[],['https://example.invalid/real'],['--synthetic-only','--endpoint=https://example.invalid']]){
    await assert.rejects(run(process.execPath,[...command,...args]),error=>{
      const failure=error as Error&{code:number;stdout:string};assert.equal(failure.code,2);
      const report=JSON.parse(failure.stdout);assert.equal(report.status,'closed');assert.equal(report.network,'none');assert.equal(report.authorizationGranted,false);return true;
    });
  }
});
test('actual TLS acceptance reports source-bound synthetic checks, closes listeners and removes temporary keys',{timeout:30_000},async()=>{
  const {stdout}=await run(process.execPath,[...command,'--synthetic-only'],{timeout:25_000,maxBuffer:64*1024,
    env:{...process.env,CANOPYPROOF_ACCEPTANCE_SECRET_SENTINEL:'synthetic-do-not-propagate',DATABASE_URL:'synthetic-do-not-propagate'}});
  const result=JSON.parse(stdout);assert.equal(result.status,'synthetic-wire-passed');assert.equal(result.node,'v22.23.5');
  assert.equal(result.requestTargets,'loopback-only');assert.equal(result.networkIsolation,'not-asserted');assert.equal(result.securityHooks,'preserved');
  assert.equal(result.credentialSentinelAbsent,true);assert.equal(result.handlerFailures,0);
  assert.equal(result.authorizationGranted,false);assert.equal(result.realAuthorityConnected,false);assert.equal(result.productionReady,false);
  assert.equal(result.temporaryKeysRemoved,true);assert.equal(result.listenerClosed,true);assert.equal(result.redirectCalls,0);
  assert.equal(result.cases.length,15);assert.equal(new Set(result.cases).size,15);assert.equal(result.wireCalls,11);assert.equal(result.uniqueNonces,11);
  const sha=(await run('git',['rev-parse','HEAD'])).stdout.trim();assert.equal(result.sourceSha,sha);
  const paths=['scripts/guardian-authority-acceptance.mjs','services/api/src/child-backend/guardian-authority-provider.ts',
    'services/api/src/domain/child-stewardship/signature.ts','services/api/src/domain/child-stewardship/store.ts','package-lock.json'];
  const hashes=[];for(const path of paths)hashes.push([path,createHash('sha256').update(await readFile(path)).digest('hex')]);
  assert.equal(result.sourceFingerprint,createHash('sha256').update(JSON.stringify(hashes)).digest('hex'));
  for(const sensitive of ['BEGIN PRIVATE KEY','fixture-child','fixture-adult','https://127.0.0.1','guardianSubjectId','sessionId'])assert.equal(stdout.includes(sensitive),false);
});
test('an intentionally broken negative-control handler cannot produce a successful acceptance report',{timeout:30_000},async()=>{
  await assert.rejects(run(process.execPath,[...command,'--synthetic-only','--self-test-handler-failure'],{timeout:25_000,maxBuffer:64*1024}),error=>{
    const failure=error as Error&{code:number;stdout:string};assert.equal(failure.code,1);
    const report=JSON.parse(failure.stdout);assert.equal(report.status,'failed');assert.equal(report.phase,'isolated-wire-matrix');assert.equal(report.productionReady,false);return true;
  });
});
