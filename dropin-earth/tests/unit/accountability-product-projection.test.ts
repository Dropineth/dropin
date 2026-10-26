import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalProjectionJson, type CurrentProjectionKey } from "@dropin/crypto";
import { projectAccountabilityEvidence, authorizeLedgerMutationFromProjection } from "../../services/api/src/domain/canopyproof/accountability-projection.js";

test("authenticated decision projection grants none of the four product ledger mutations", async () => {
  const pair = generateKeyPairSync("ed25519");
  const key: CurrentProjectionKey = { publicKeyPem: pair.publicKey.export({type:"spki",format:"pem"}).toString(),
    protocolVersion:"synthetic-projection-test",schemaHash:`sha256:${"a".repeat(64)}`,keyEpoch:1,revoked:false,
    validFrom:"2026-01-01T00:00:00Z",validUntil:"2027-01-01T00:00:00Z" };
  const recordBytes=Buffer.from(canonicalProjectionJson({protocol_version:key.protocolVersion,schema_hash:key.schemaHash,
    verdict:"PASS",membership_state:"ACTIVE",paid:true}));
  const request={recordBytes,signature:sign(null,recordBytes,pair.privateKey).toString("base64url"),keyId:"synthetic",keyEpoch:1};
  const projection=await projectAccountabilityEvidence(request,{current:async()=>key},()=>Date.parse("2026-10-23T00:00:00Z"));
  assert.equal(projection.transportSignatureVerified,true);
  assert.deepEqual([projection.observation,projection.contribution,projection.entitlement,projection.funding],
    ["unassessed","not-awarded","not-conferred","not-authorized"]);
  for(const op of ["E","C","R","F"]) assert.throws(()=>authorizeLedgerMutationFromProjection(projection,op),/PROJECTION_CANNOT_AUTHORIZE/);
  await assert.rejects(projectAccountabilityEvidence(request,undefined),/AUTHORITY_UNAVAILABLE/);
});

test("synthetic process projection requires a separate host registry and refuses all four ledger writes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "projection-process-"));
  try {
    const pair=generateKeyPairSync("ed25519"),now=Date.now();
    const key:CurrentProjectionKey={publicKeyPem:pair.publicKey.export({type:"spki",format:"pem"}).toString(),protocolVersion:"synthetic-process",
      schemaHash:`sha256:${"b".repeat(64)}`,keyEpoch:1,revoked:false,validFrom:new Date(now-60000).toISOString(),validUntil:new Date(now+60000).toISOString()};
    const path=join(directory,"keys.json");await writeFile(path,JSON.stringify({test:key}),{mode:0o600});
    const bytes=Buffer.from(canonicalProjectionJson({protocol_version:key.protocolVersion,schema_hash:key.schemaHash,paid:true}));
    const input=JSON.stringify({recordBase64:bytes.toString("base64"),keyId:"test",keyEpoch:1,signature:sign(null,bytes,pair.privateKey).toString("base64url")});
    const run=(host:boolean)=>spawnSync(process.execPath,["--import","tsx","scripts/accountability-projection-fixture.ts"],{encoding:"utf8",input,timeout:10000,
      env:{PATH:process.env.PATH,LIFEPP_SYNTHETIC_CONFIRM:"confirm-disposable-test-database",...(host?{CANOPY_SYNTHETIC_PROJECTION_KEYS:path}:{})}});
    const good=run(true);assert.equal(good.status,0,good.stderr);const result=JSON.parse(good.stdout);
    assert.equal(result.ok,true);assert.equal(result.ledgerMutationsRefused.length,4);
    const denied=run(false);assert.equal(denied.status,1);assert.match(denied.stderr,/SYNTHETIC_HOST_AUTHORITY_REQUIRED/);
  } finally {await rm(directory,{recursive:true,force:true});}
});
