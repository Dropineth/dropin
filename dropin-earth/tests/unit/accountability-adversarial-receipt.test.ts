import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { verifyAdversarialReceipt } from "../../scripts/accountability-adversarial-receipt.mjs";

test("adversarial aggregate accepts only independently matched complete successful exact-head runs", () => {
  const now=Date.parse("2026-10-23T07:00:00Z");
  const result={targetSha:"a".repeat(40),runnerId:"trusted-ci-run:123:1",phase:"pull_request",completedAt:"2026-10-23T06:59:00Z",
    conclusion:"success",sourceDirty:false,tests:[{id:"C01",executed:true,status:"passed",assertions:2},{id:"C08",executed:true,status:"passed",assertions:4}]};
  const encode=(value:unknown)=>Buffer.from(JSON.stringify(value));
  const host=(bytes:Buffer)=>({targetSha:"a".repeat(40),runnerId:"trusted-ci-run:123:1",phase:"pull_request",
    status:"completed",conclusion:"success",maxAgeMs:120000,tests:["C01","C08"],receiptSha256:createHash("sha256").update(bytes).digest("hex")});
  const bytes=encode(result);
  assert.deepEqual(verifyAdversarialReceipt(bytes,host(bytes),now),{accepted:true,targetSha:result.targetSha,phase:"pull_request",tests:2,releaseApproval:false});
  assert.throws(()=>verifyAdversarialReceipt(encode({...result,conclusion:"success",targetSha:"b".repeat(40)}),host(bytes),now),/DIGEST_MISMATCH/);
  for(const mutation of [
    {...result,targetSha:"b".repeat(40)}, {...result,phase:"merge_candidate"}, {...result,runnerId:"self-asserted"},
    {...result,completedAt:"2026-10-22T00:00:00Z"}, {...result,sourceDirty:true}, {...result,tests:result.tests.slice(0,1)},
    ...["cancelled","timeout","neutral","skipped","failure"].map(conclusion=>({...result,conclusion})),
    ...["skipped","neutral","failed"].map(status=>({...result,tests:[result.tests[0],{...result.tests[1],status}]})),
    {...result,tests:[result.tests[0],{...result.tests[1],executed:false}]},
    {...result,tests:[{id:"C01\nC08",executed:true,status:"passed",assertions:6}]},
  ]) { const changed=encode(mutation); assert.throws(()=>verifyAdversarialReceipt(changed,host(changed),now)); }
  assert.throws(()=>verifyAdversarialReceipt(bytes,undefined,now),/TRUSTED_RUN_CONTEXT/);
  for(const conclusion of [undefined,"failure","cancelled","neutral","skipped","timed_out"])
    assert.throws(()=>verifyAdversarialReceipt(bytes,{...host(bytes),conclusion},now),/TRUSTED_RUN_NOT_SUCCESSFUL/);
  assert.throws(()=>verifyAdversarialReceipt(bytes,{...host(bytes),status:"in_progress"},now),/TRUSTED_RUN_NOT_SUCCESSFUL/);
});
