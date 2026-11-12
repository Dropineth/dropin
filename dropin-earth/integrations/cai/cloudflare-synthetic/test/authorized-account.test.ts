import {env} from 'cloudflare:workers';
import {runInDurableObject,reset,abortAllDurableObjects} from 'cloudflare:test';
import {afterEach,expect,it,vi} from 'vitest';
import {syntheticCommitBytes,type SignedCommitFields} from '../src/authorization';

// Ephemeral synthetic keys exist only in this test process. No private fixture
// keys, child data or real guardian identities are checked in or sent anywhere.
afterEach(async()=>{vi.restoreAllMocks();await reset();});
const digest='a'.repeat(64),nonce='b'.repeat(32),proposalId='synthetic-proposal',commandId='synthetic-command';
function accepted<T extends {ok:boolean}>(value:T):Exclude<T,{ok:false}>{expect(value.ok).toBe(true);return value as Exclude<T,{ok:false}>;}
async function key(){
 const pair=await crypto.subtle.generateKey({name:'Ed25519'},true,['sign','verify']) as CryptoKeyPair;
 const der=new Uint8Array(await crypto.subtle.exportKey('spki',pair.publicKey));
 const publicKey='-----BEGIN PUBLIC KEY-----\n'+btoa(String.fromCharCode(...der))+'\n-----END PUBLIC KEY-----\n';
 return {privateKey:pair.privateKey,publicKey};
}
async function initialize(scope='synthetic-signed'){
 const stub=env.CHILD_ACCOUNT.getByName(scope),keys=await key();
 accepted(await stub.initializeSyntheticFixture({scope}));
 const challenge=accepted(await stub.fixtureChallenge({scope}));
 accepted(await stub.admitSyntheticFixture({scope,bootNonce:challenge.bootNonce,anchor:challenge.anchor}));
 const reg=accepted(await stub.registerSyntheticGuardian({scope,keyId:'synthetic-guardian-key',publicKey:keys.publicKey,role:'guardian'}));
 return {scope,stub,keys,keyId:'synthetic-guardian-key',keyRevision:reg.revision,objectId:env.CHILD_ACCOUNT.idFromName(scope).toString()};
}
type Fixture=Awaited<ReturnType<typeof initialize>>;
async function propose(c:Fixture,expiresAt=Date.now()+30_000){
 accepted(await c.stub.setSyntheticConsent({scope:c.scope,role:'guardian',granted:true}));
 const consent=accepted(await c.stub.setSyntheticConsent({scope:c.scope,role:'child',granted:true}));
 accepted(await c.stub.issueSyntheticProposal({scope:c.scope,proposalId,digest,nonce,expiresAt}));
 return {scope:c.scope,proposalId,commandId,digest,nonce,expectedEpoch:consent.epoch,expiresAt,keyId:c.keyId,keyRevision:c.keyRevision};
}
async function sign(c:Fixture,v:SignedCommitFields,audience=c.objectId){
 return {...v,signature:new Uint8Array(await crypto.subtle.sign('Ed25519',c.keys.privateKey,syntheticCommitBytes(v,audience)))};
}
function unsigned(v:SignedCommitFields){return {scope:v.scope,proposalId:v.proposalId,commandId:v.commandId,digest:v.digest,nonce:v.nonce,expectedEpoch:v.expectedEpoch};}
async function state(c:Fixture){return runInDurableObject(c.stub,(_instance,s)=>({
 receipts:s.storage.sql.exec<{n:number}>('SELECT count(*) n FROM receipts').one().n,
 evidence:s.storage.sql.exec<{n:number}>('SELECT count(*) n FROM signature_evidence').one().n,
 observations:s.storage.sql.exec<{n:number}>('SELECT count(*) n FROM observations').one().n,
 consumed:s.storage.sql.exec<{n:number}>('SELECT coalesce(sum(consumed),0) n FROM proposals').one().n,
}));}
const empty={receipts:0,evidence:0,observations:0,consumed:0};
const one={receipts:1,evidence:1,observations:1,consumed:1};

it('valid signed concurrent commits produce one atomic effect and exact verifiable evidence',async()=>{
 const c=await initialize(),fields=await propose(c),v=await sign(c,fields);
 const results=await Promise.all(Array.from({length:12},()=>c.stub.commitSignedSyntheticProposal(v)));
 expect(results.every(r=>r.ok)).toBe(true);expect(results.filter(r=>r.ok&&!r.replayed)).toHaveLength(1);
 expect(await state(c)).toEqual(one);
 await runInDurableObject(c.stub,(_i,s)=>{
  const stored=s.storage.sql.exec('SELECT * FROM signature_evidence').one();
  expect(stored.key_id).toBe(c.keyId);expect(stored.public_key).toBe(c.keys.publicKey);
  expect(stored.envelope).toBe(new TextDecoder().decode(syntheticCommitBytes(fields,c.objectId)));
  expect(new Uint8Array(stored.signature as ArrayBuffer)).toEqual(v.signature);
 });
});
it('registered or revoked signed mode can never use unsigned conformance commit',async()=>{
 const c=await initialize(),v=await propose(c);
 expect(await c.stub.commitSyntheticProposal(unsigned(v))).toMatchObject({ok:false,code:'SIGNATURE_REQUIRED'});
 accepted(await c.stub.revokeSyntheticGuardian({scope:c.scope}));
 expect(await c.stub.commitSyntheticProposal(unsigned(v))).toMatchObject({ok:false,code:'SIGNATURE_REQUIRED'});
 // Even losing the registry row does not remove the persisted policy latch.
 await runInDurableObject(c.stub,(_i,s)=>{s.storage.sql.exec('DELETE FROM synthetic_signer');});
 expect(await c.stub.commitSyntheticProposal(unsigned(v))).toMatchObject({ok:false,code:'SIGNATURE_REQUIRED'});
 expect(await state(c)).toEqual(empty);
});
it('AI, child, UN, BEV and facilitator cannot become a synthetic guardian signer',async()=>{
 const c=await initialize();
 for(const role of ['AI','child','UN','BEV','school','operator',['guardian'],null]){
  expect(await c.stub.registerSyntheticGuardian({scope:c.scope,keyId:'synthetic-key',publicKey:c.keys.publicKey,role})).toMatchObject({ok:false,code:'SYNTHETIC_ROLE_INVALID'});
 }
 const v=await sign(c,await propose(c));
 for(const extra of [{role:'AI'},{publicKey:c.keys.publicKey},{algorithm:'Ed25519'}])expect(await c.stub.commitSignedSyntheticProposal({...v,...extra})).toMatchObject({ok:false,code:'SYNTHETIC_INPUT_INVALID'});
 expect(await state(c)).toEqual(empty);
});
it('signed exact field, action and audience bindings reject tampering before consumption',async()=>{
 const c=await initialize(),v=await sign(c,await propose(c));
 for(const change of [{proposalId:'synthetic-other'},{commandId:'synthetic-other'},{digest:'c'.repeat(64)},{nonce:'d'.repeat(32)},{expiresAt:v.expiresAt+1}]){
  expect(await c.stub.commitSignedSyntheticProposal({...v,...change})).toMatchObject({ok:false,code:'SIGNATURE_INVALID'});
 }
 const wrongAudience=await sign(c,v,'not-this-object');
 expect(await c.stub.commitSignedSyntheticProposal(wrongAudience)).toMatchObject({ok:false,code:'SIGNATURE_INVALID'});
 const altered=new TextDecoder().decode(syntheticCommitBytes(v,c.objectId)).replace('commit-synthetic-e0','grant-consent');
 const actionSig=new Uint8Array(await crypto.subtle.sign('Ed25519',c.keys.privateKey,new TextEncoder().encode(altered)));
 expect(await c.stub.commitSignedSyntheticProposal({...v,signature:actionSig})).toMatchObject({ok:false,code:'SIGNATURE_INVALID'});
 for(const change of [{expectedEpoch:v.expectedEpoch+1},{keyRevision:v.keyRevision+1},{keyId:'synthetic-other'}])expect((await c.stub.commitSignedSyntheticProposal({...v,...change})).ok).toBe(false);
 expect(await state(c)).toEqual(empty);expect((await c.stub.commitSignedSyntheticProposal(v)).ok).toBe(true);
});
it('signature must use the registered key; caller-selected key and copied object scope are rejected',async()=>{
 const c=await initialize(),other=await initialize('synthetic-other'),fields=await propose(c),wrong=await sign({...c,keys:other.keys},fields);
 expect(await c.stub.commitSignedSyntheticProposal(wrong)).toMatchObject({ok:false,code:'SIGNATURE_INVALID'});
 expect(await other.stub.commitSignedSyntheticProposal(await sign(c,fields))).toMatchObject({ok:false,code:'SYNTHETIC_SCOPE_MISMATCH'});
 expect(await state(c)).toEqual(empty);expect(await state(other)).toEqual(empty);
});
it('even correctly signed altered expiry cannot replace the issued proposal expiry',async()=>{
 const c=await initialize(),v=await propose(c);
 expect(await c.stub.commitSignedSyntheticProposal(await sign(c,{...v,expiresAt:v.expiresAt+1}))).toMatchObject({ok:false,code:'SIGNED_EXPIRY_MISMATCH'});
 expect(await state(c)).toEqual(empty);
});

// Pause the real async WebCrypto verification, not a fake valid result. Exercise
// the same instance directly so no timing assumption about RPC scheduling is needed.
for(const mutation of ['revoke','rotate','withdraw','admission','restore','clock','expiry'] as const)it('post-crypto current-state recheck denies '+mutation+' in verification window',async()=>{
 const c=await initialize(),fields=await propose(c),v=await sign(c,fields),nextKey=await key();
 await runInDurableObject(c.stub,async(instance,s)=>{
  const realVerify=crypto.subtle.verify.bind(crypto.subtle);
  let entered!:()=>void,resume!:()=>void;
  const reached=new Promise<void>(r=>{entered=r;}),pause=new Promise<void>(r=>{resume=r;});
  let clock:ReturnType<typeof vi.spyOn>|undefined;
  const spy=vi.spyOn(crypto.subtle,'verify').mockImplementation(async(...args)=>{entered();await pause;return realVerify(...args);});
  try{
   const pending=instance.commitSignedSyntheticProposal(v);await reached;
   if(mutation==='revoke')accepted(instance.revokeSyntheticGuardian({scope:c.scope}));
   if(mutation==='rotate')accepted(instance.registerSyntheticGuardian({scope:c.scope,keyId:c.keyId,publicKey:nextKey.publicKey,role:'guardian'}));
   if(mutation==='withdraw')accepted(instance.setSyntheticConsent({scope:c.scope,role:'child',granted:false}));
   if(mutation==='admission')expect(instance.admitSyntheticFixture({scope:c.scope,bootNonce:'stale',anchor:accepted(instance.fixtureChallenge({scope:c.scope})).anchor}).ok).toBe(false);
   if(mutation==='restore')s.storage.sql.exec('UPDATE account SET sequence=sequence-1 WHERE id=1');
   if(mutation==='expiry')clock=vi.spyOn(Date,'now').mockReturnValue(fields.expiresAt+1);
   if(mutation==='clock')s.storage.sql.exec('UPDATE account SET last_time=? WHERE id=1',Date.now()+60_000);
   resume();expect((await pending).ok).toBe(false);
  }finally{resume();spy.mockRestore();clock?.mockRestore();}
 });
 expect(await state(c)).toEqual(empty);
});
it('key renewal resets consent, revision and epoch; old signature and receipt replay stay invalid',async()=>{
 const c=await initialize(),v=await sign(c,await propose(c));accepted(await c.stub.commitSignedSyntheticProposal(v));
 const rotated=accepted(await c.stub.registerSyntheticGuardian({scope:c.scope,keyId:c.keyId,publicKey:c.keys.publicKey,role:'guardian'}));
 expect(rotated.revision).toBeGreaterThan(c.keyRevision);expect(rotated.epoch).toBeGreaterThan(v.expectedEpoch);
 expect((await c.stub.commitSignedSyntheticProposal(v)).ok).toBe(false);
 accepted(await c.stub.setSyntheticConsent({scope:c.scope,role:'guardian',granted:true}));accepted(await c.stub.setSyntheticConsent({scope:c.scope,role:'child',granted:true}));
 expect((await c.stub.commitSignedSyntheticProposal(v)).ok).toBe(false);
 expect(await state(c)).toEqual(one);
});
it('signature evidence/audit failure rolls back every local effect and the exact signature can retry',async()=>{
 const c=await initialize(),v=await sign(c,await propose(c));
 for(const table of ['signature_evidence','audit']){
  await runInDurableObject(c.stub,(_i,s)=>{s.storage.sql.exec(`CREATE TRIGGER injected_failure BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT,'fixture failure'); END;`);});
  expect(await c.stub.commitSignedSyntheticProposal(v)).toMatchObject({ok:false,code:'STORAGE_UNAVAILABLE'});
  expect(await state(c)).toEqual(empty);
  await runInDurableObject(c.stub,(_i,s)=>{s.storage.sql.exec('DROP TRIGGER injected_failure');});
 }
 accepted(await c.stub.commitSignedSyntheticProposal(v));expect(await state(c)).toEqual(one);
});
it('restart preserves key, policy, evidence and nonce but requires fresh outside fixture admission',async()=>{
 const c=await initialize(),v=await sign(c,await propose(c));accepted(await c.stub.commitSignedSyntheticProposal(v));
 const previous=accepted(await c.stub.fixtureChallenge({scope:c.scope}));await abortAllDurableObjects();
 const stub=env.CHILD_ACCOUNT.getByName(c.scope),challenge=accepted(await stub.fixtureChallenge({scope:c.scope}));
 expect(challenge.bootNonce).not.toBe(previous.bootNonce);
 expect(await stub.commitSignedSyntheticProposal(v)).toMatchObject({ok:false,code:'RESTORE_ADMISSION_REQUIRED'});
 accepted(await stub.admitSyntheticFixture({scope:c.scope,bootNonce:challenge.bootNonce,anchor:previous.anchor}));
 expect(await stub.commitSignedSyntheticProposal(v)).toMatchObject({ok:true,replayed:true});
 expect(await stub.commitSyntheticProposal(unsigned(v))).toMatchObject({ok:false,code:'SIGNATURE_REQUIRED'});
 expect(await state({...c,stub})).toEqual(one);
});
it('revocation remains available without admission; cannot use registration to manufacture admission',async()=>{
 const c=await initialize();await propose(c);await abortAllDurableObjects();
 const stub=env.CHILD_ACCOUNT.getByName(c.scope);
 expect(await stub.registerSyntheticGuardian({scope:c.scope,keyId:c.keyId,publicKey:c.keys.publicKey,role:'guardian'})).toMatchObject({ok:false,code:'RESTORE_ADMISSION_REQUIRED'});
 accepted(await stub.revokeSyntheticGuardian({scope:c.scope}));
 expect(accepted(await stub.fixtureChallenge({scope:c.scope})).admitted).toBe(false);
 expect(await state({...c,stub})).toEqual(empty);
});
it('direct caller mutation after verification begins cannot change captured command fields',async()=>{
 const c=await initialize(),v=await sign(c,await propose(c));
 await runInDurableObject(c.stub,async(instance)=>{
  const original={...v,signature:v.signature.slice()},pending=instance.commitSignedSyntheticProposal(original);
  original.commandId='synthetic-injected';original.digest='c'.repeat(64);original.signature.fill(0);
  expect((await pending).ok).toBe(true);
 });
 await runInDurableObject(c.stub,(_i,s)=>{expect(s.storage.sql.exec('SELECT command_id FROM receipts').one().command_id).toBe(commandId);});
});

it('invalid public key encoding cannot mutate registry, policy, consent or epoch',async()=>{
 const c=await initialize(),before=accepted(await c.stub.fixtureChallenge({scope:c.scope}));
 for(const publicKey of ['-----BEGIN PUBLIC KEY-----\ninvalid\n-----END PUBLIC KEY-----',c.keys.publicKey.replace('MCow','MCsw'),c.keys.publicKey+'untrusted trailing text']){
  expect(await c.stub.registerSyntheticGuardian({scope:c.scope,keyId:'synthetic-new',publicKey,role:'guardian'})).toMatchObject({ok:false,code:'SYNTHETIC_INPUT_INVALID'});
 }
 expect(accepted(await c.stub.fixtureChallenge({scope:c.scope})).anchor).toEqual(before.anchor);
});
it('validly signed nonce reuse and command collision cannot create a second effect',async()=>{
 const c=await initialize(),fields=await propose(c);accepted(await c.stub.commitSignedSyntheticProposal(await sign(c,fields)));
 expect(await c.stub.commitSignedSyntheticProposal(await sign(c,{...fields,commandId:'synthetic-other'}))).toMatchObject({ok:false,code:'NONCE_CONSUMED'});
 const other={...fields,proposalId:'synthetic-other',digest:'c'.repeat(64),nonce:'d'.repeat(32)};
 accepted(await c.stub.issueSyntheticProposal({scope:c.scope,proposalId:other.proposalId,digest:other.digest,nonce:other.nonce,expiresAt:other.expiresAt}));
 expect(await c.stub.commitSignedSyntheticProposal(await sign(c,other))).toMatchObject({ok:false,code:'IDEMPOTENCY_CONFLICT'});
 expect(await state(c)).toEqual(one);
});
it('failed key registration rolls back policy, signer revision, consent and epoch with audit',async()=>{
 const c=await initialize();await propose(c);
 const before=await runInDurableObject(c.stub,(_i,s)=>({account:s.storage.sql.exec('SELECT * FROM account').one(),signer:s.storage.sql.exec('SELECT * FROM synthetic_signer').one()}));
 await runInDurableObject(c.stub,(_i,s)=>{s.storage.sql.exec("CREATE TRIGGER injected_failure BEFORE INSERT ON audit BEGIN SELECT RAISE(ABORT,'fixture failure'); END;");});
 expect(await c.stub.registerSyntheticGuardian({scope:c.scope,keyId:'synthetic-new',publicKey:c.keys.publicKey,role:'guardian'})).toMatchObject({ok:false,code:'STORAGE_UNAVAILABLE'});
 const after=await runInDurableObject(c.stub,(_i,s)=>({account:s.storage.sql.exec('SELECT * FROM account').one(),signer:s.storage.sql.exec('SELECT * FROM synthetic_signer').one()}));
 expect(after).toEqual(before);
});

it('workerd verifies independent Node-produced public envelope vector with identical canonical bytes',async()=>{
 const {default:vector}=await import('./authorization-vector.json');
 const {verifyChildSignatureWebCrypto}=await import('../src/signature');
 const expected=syntheticCommitBytes(vector.fields,vector.objectAudience);
 expect(new TextDecoder().decode(expected)).toBe(vector.canonicalUtf8);
 const signature=Uint8Array.from(vector.signatureHex.match(/../g)!,s=>parseInt(s,16));
 expect(await verifyChildSignatureWebCrypto({algorithm:'Ed25519',expectedPayload:expected,signedPayload:new TextEncoder().encode(vector.canonicalUtf8),signature,registeredPublicKey:vector.publicKey})).toEqual({valid:true});
});
