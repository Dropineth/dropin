import assert from 'node:assert/strict';
import {createHash,createPublicKey,verify} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import test from 'node:test';
import {localUrl,authorityUrl,signedFixture,main,SOURCE_TREE} from './prepare-session.mjs';
const stableJson=value=>JSON.stringify(canonical(value));
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
const childDigest=value=>createHash('sha256').update(stableJson(value)).digest('hex');

test('only explicit disposable loopback PG and fixed local HTTPS current endpoints are accepted',()=>{
  assert.equal(localUrl('postgres://fixture:temporary@127.0.0.1/native_test','disposable-local-synthetic').hostname,'127.0.0.1');
  for(const url of ['postgres://fixture:temporary@remote.invalid/test','postgres://fixture:temporary@localhost/live',
    'postgres://fixture:temporary@localhost/test?sslmode=disable','postgres://localhost/test'])assert.throws(()=>localUrl(url,'disposable-local-synthetic'));
  assert.throws(()=>localUrl('postgres://fixture:temporary@localhost/test',''));
  assert.equal(authorityUrl('https://localhost:8443/current'),'https://localhost:8443/current');
  for(const url of ['http://localhost/current','https://remote.invalid/current','https://localhost/other','https://localhost/current?token=x','https://user:pass@localhost/current'])assert.throws(()=>authorityUrl(url));
});
test('fixture uses two actual different Ed25519 keys and authentic exact checkpoint signatures, never true identity',()=>{
  const now=Date.now(),sessionId='b88ec309-1236-4b40-9b8a-ad08c4a1829e';
  const value=signedFixture({sessionId,roots:{canonical:'a'.repeat(64),privacy:'b'.repeat(64),security:'c'.repeat(64)},stableJson,childDigest,now});
  const {checkpoint,signatures}=value.checkpointSigned,keys=value.current.registry.keys;
  assert.equal(checkpoint.environment,'SIMULATION_ONLY');assert.equal(checkpoint.sessionId,sessionId);
  assert.equal(value.current.anchor.digest,childDigest(checkpoint));assert.equal(checkpoint.keyRegistryVersion,value.current.registry.version);
  assert.ok(Date.parse(checkpoint.expiresAt)-now<3600000);
  assert.notEqual(keys[0].publicKey,keys[1].publicKey);
  assert.deepEqual(keys.map(k=>k.role),['protection','trustee']);
  for(const [index,signature] of signatures.entries()){
    assert.equal(verify(null,Buffer.from(stableJson(checkpoint)),keys[index].publicKey,Buffer.from(signature.signature,'base64url')),true);
    assert.equal(verify(null,Buffer.from(stableJson({...checkpoint,sequence:2})),keys[index].publicKey,Buffer.from(signature.signature,'base64url')),false);
    assert.equal(createPublicKey(value.quorumPrivateKeys[index].privateKey).export({type:'spki',format:'pem'}),keys[index].publicKey);
  }
  assert.equal(createPublicKey(value.transportPrivateKey).export({type:'spki',format:'pem'}),value.transportPublicKey);
  assert.match(SOURCE_TREE,/^[a-f0-9]{40}$/);
});
test('invalid commands and insecure TLS fail without any source import or PG connection',async()=>{
  for(const args of [[],['deploy','/missing','/out'],['admit','/missing','/fixture']])await assert.rejects(main(args,{}));
  await assert.rejects(main(['prepare','/missing','/out'],{REHEARSAL_CONFIRM:'disposable-local-synthetic',NODE_TLS_REJECT_UNAUTHORIZED:'0'}));
});
test('CLI never prints private inputs or underlying exceptions on refusal',()=>{
  const result=spawnSync(process.execPath,[new URL('./prepare-session.mjs',import.meta.url).pathname,'prepare','/SECRET_PATH','/SECRET_OUTPUT'],{encoding:'utf8',env:{PATH:process.env.PATH},timeout:5000});
  assert.equal(result.status,1);assert.equal(result.stdout,'');assert.equal(result.stderr,'SYNTHETIC_SESSION_FIXTURE_FAILED\n');
});
