import {env} from 'cloudflare:workers';
import {runInDurableObject,reset,abortAllDurableObjects} from 'cloudflare:test';
import {afterEach,expect,it} from 'vitest';
import worker,{SyntheticChildAccount} from '../src/index';

afterEach(async()=>{await reset();});
const digest='a'.repeat(64),nonce='b'.repeat(32);
function accepted<T extends {ok:boolean}>(value:T):Exclude<T,{ok:false}>{if(!value.ok)throw new Error('fixture setup denied');return value as Exclude<T,{ok:false}>;}
function make(scope='synthetic-account'){return {scope,stub:env.CHILD_ACCOUNT.getByName(scope)};}
async function initialize(scope='synthetic-account'){
 const c=make(scope);expect((await c.stub.initializeSyntheticFixture({scope})).ok).toBe(true);
 const challenge=accepted(await c.stub.fixtureChallenge({scope}));
 expect((await c.stub.admitSyntheticFixture({scope,bootNonce:challenge.bootNonce,anchor:challenge.anchor})).ok).toBe(true);
 return c;
}
async function consent(c:ReturnType<typeof make>){
 expect((await c.stub.setSyntheticConsent({scope:c.scope,role:'guardian',granted:true})).ok).toBe(true);
 const r=await c.stub.setSyntheticConsent({scope:c.scope,role:'child',granted:true});expect(r.ok).toBe(true);
 return accepted(await c.stub.fixtureChallenge({scope:c.scope})).anchor!.epoch;
}
async function proposal(c:ReturnType<typeof make>,expiresAt=Date.now()+30_000){
 const epoch=await consent(c);
 expect((await c.stub.issueSyntheticProposal({scope:c.scope,proposalId:'synthetic-proposal',digest,nonce,expiresAt})).ok).toBe(true);
 return {scope:c.scope,proposalId:'synthetic-proposal',commandId:'synthetic-command',digest,nonce,expectedEpoch:epoch};
}
async function counts(c:ReturnType<typeof make>){return runInDurableObject(c.stub,(_i,state)=>{
 const sql=state.storage.sql;
 return {receipts:sql.exec<{n:number}>('SELECT count(*) n FROM receipts').one().n,
  observations:sql.exec<{n:number}>('SELECT count(*) n FROM observations').one().n,
  commits:sql.exec<{n:number}>("SELECT count(*) n FROM audit WHERE kind='proposal-committed'").one().n,
  consumed:sql.exec<{n:number}>('SELECT coalesce(sum(consumed),0) n FROM proposals').one().n};
});}

it('HTTP exposes only closed health, no fixture, child, guardian, signing or payment route',async()=>{
 const r=worker.fetch(new Request('https://local.test/health/live'));expect(r.status).toBe(200);
 expect(await r.json()).toMatchObject({accountEntry:'closed',realCapabilities:false,syntheticOnly:true});
 for(const path of ['/health/ready','/initializeSyntheticFixture','/children','/guardian','/sign','/payments','/canopyproof/child-stewardship/v1/commands']){
  expect(worker.fetch(new Request('https://local.test'+path,{method:'POST',body:'not-real-child-data'})).status).toBe(503);
 }
});

it('binding fixture mode, object scope and fresh per-instance restore admission are mandatory',async()=>{
 const c=make();
 expect(await c.stub.initializeSyntheticFixture({scope:'synthetic-other'})).toMatchObject({ok:false,code:'SYNTHETIC_SCOPE_MISMATCH'});
 await runInDurableObject(c.stub,(_i,state)=>{
  const closed=new SyntheticChildAccount(state,{...env,CHILD_DO_MODE:'disabled'});
  expect(closed.initializeSyntheticFixture({scope:c.scope})).toMatchObject({ok:false,code:'SYNTHETIC_FIXTURE_DISABLED'});
 });
 expect((await c.stub.initializeSyntheticFixture({scope:c.scope})).ok).toBe(true);
 expect(await c.stub.setSyntheticConsent({scope:c.scope,role:'guardian',granted:true})).toMatchObject({ok:false,code:'RESTORE_ADMISSION_REQUIRED'});
 expect(await c.stub.admitSyntheticFixture({scope:c.scope,bootNonce:'not-current',anchor:accepted(await c.stub.fixtureChallenge({scope:c.scope})).anchor})).toMatchObject({ok:false});
});

it('AI, UN and BEV labels, extra fields and cross-object copies cannot grant synthetic consent',async()=>{
 const a=await initialize(),b=await initialize('synthetic-other');
 for(const role of ['AI','UN','BEV','operator','school',['guardian'],['child'],null,1,{role:'child'}])expect(await a.stub.setSyntheticConsent({scope:a.scope,role,granted:true})).toMatchObject({ok:false,code:'SYNTHETIC_ROLE_INVALID'});
 expect(await a.stub.setSyntheticConsent({scope:a.scope,role:'guardian',granted:true,signature:'pretend'})).toMatchObject({ok:false,code:'SYNTHETIC_INPUT_INVALID'});
 const request=await proposal(a);
 expect(await b.stub.commitSyntheticProposal(request)).toMatchObject({ok:false,code:'SYNTHETIC_SCOPE_MISMATCH'});
 expect(await counts(b)).toEqual({receipts:0,observations:0,commits:0,consumed:0});
});

it('concurrent identical commands yield one effect, one nonce consumption and one receipt',async()=>{
 const c=await initialize(),request=await proposal(c);
 const results=await Promise.all(Array.from({length:12},()=>c.stub.commitSyntheticProposal(request)));
 expect(results.every(r=>r.ok)).toBe(true);expect(results.filter(r=>r.ok&&r.replayed===false)).toHaveLength(1);
 expect(await counts(c)).toEqual({receipts:1,observations:1,commits:1,consumed:1});
});

it('different command ID, changed supplied digest or reused nonce cannot create a second effect',async()=>{
 const c=await initialize(),request=await proposal(c);expect((await c.stub.commitSyntheticProposal(request)).ok).toBe(true);
 expect(await c.stub.commitSyntheticProposal({...request,commandId:'synthetic-other'})).toMatchObject({ok:false,code:'NONCE_CONSUMED'});
 expect(await c.stub.commitSyntheticProposal({...request,digest:'c'.repeat(64)})).toMatchObject({ok:false,code:'PROPOSAL_MISMATCH'});
 expect(await c.stub.issueSyntheticProposal({scope:c.scope,proposalId:'synthetic-new',digest,nonce,expiresAt:Date.now()+1000})).toMatchObject({ok:false,code:'PROPOSAL_CONFLICT'});
 expect(await counts(c)).toEqual({receipts:1,observations:1,commits:1,consumed:1});
});

it('withdrawal before commit blocks it; regrant and renewed assent cannot revive old proposal',async()=>{
 const c=await initialize(),request=await proposal(c);
 expect((await c.stub.setSyntheticConsent({scope:c.scope,role:'child',granted:false})).ok).toBe(true);
 expect(await c.stub.commitSyntheticProposal(request)).toMatchObject({ok:false,code:'CONSENT_STALE'});
 const newEpoch=await consent(c);expect(newEpoch).toBeGreaterThan(request.expectedEpoch);
 expect(await c.stub.commitSyntheticProposal({...request,expectedEpoch:newEpoch})).toMatchObject({ok:false,code:'PROPOSAL_MISMATCH'});
 expect(await counts(c)).toEqual({receipts:0,observations:0,commits:0,consumed:0});
});

it('guardian grant renewal clears prior child assent before a new proposal is issued',async()=>{
 const c=await initialize();await consent(c);
 expect((await c.stub.setSyntheticConsent({scope:c.scope,role:'guardian',granted:true})).ok).toBe(true);
 const value={scope:c.scope,proposalId:'synthetic-renewal',digest,nonce,expiresAt:Date.now()+1000};
 expect(await c.stub.issueSyntheticProposal(value)).toMatchObject({ok:false,code:'CONSENT_REQUIRED'});
 expect((await c.stub.setSyntheticConsent({scope:c.scope,role:'child',granted:true})).ok).toBe(true);
 expect((await c.stub.issueSyntheticProposal(value)).ok).toBe(true);
});

it('child assent before guardian grant cannot be carried into the new guardian grant',async()=>{
 const c=await initialize();expect((await c.stub.setSyntheticConsent({scope:c.scope,role:'child',granted:true})).ok).toBe(true);
 expect((await c.stub.setSyntheticConsent({scope:c.scope,role:'guardian',granted:true})).ok).toBe(true);
 expect(await c.stub.issueSyntheticProposal({scope:c.scope,proposalId:'synthetic-ordering',digest,nonce,expiresAt:Date.now()+1000})).toMatchObject({ok:false,code:'CONSENT_REQUIRED'});
});

it('same command ID with another valid proposal conflicts without consuming its nonce',async()=>{
 const c=await initialize(),request=await proposal(c);expect((await c.stub.commitSyntheticProposal(request)).ok).toBe(true);
 const value={scope:c.scope,proposalId:'synthetic-other',digest:'c'.repeat(64),nonce:'d'.repeat(32),expiresAt:Date.now()+1000};
 expect((await c.stub.issueSyntheticProposal(value)).ok).toBe(true);
 expect(await c.stub.commitSyntheticProposal({...request,proposalId:value.proposalId,digest:value.digest,nonce:value.nonce})).toMatchObject({ok:false,code:'IDEMPOTENCY_CONFLICT'});
 expect(await counts(c)).toEqual({receipts:1,observations:1,commits:1,consumed:1});
 expect((await c.stub.commitSyntheticProposal({...request,proposalId:value.proposalId,commandId:'synthetic-new-command',digest:value.digest,nonce:value.nonce})).ok).toBe(true);
});

it('competing revoke and commit have only serial local outcomes, and replay after revoke is denied',async()=>{
 const c=await initialize(),request=await proposal(c);
 const [commit,revoke]=await Promise.all([c.stub.commitSyntheticProposal(request),c.stub.setSyntheticConsent({scope:c.scope,role:'guardian',granted:false})]);
 expect(revoke.ok).toBe(true);const n=commit.ok?1:0;
 expect(await counts(c)).toEqual({receipts:n,observations:n,commits:n,consumed:n});
 expect(await c.stub.commitSyntheticProposal(request)).toMatchObject({ok:false,code:'CONSENT_STALE'});
});

it('exact receipt replay still rejects expired original proposal',async()=>{
 const c=await initialize(),request=await proposal(c,Date.now()+300);
 expect((await c.stub.commitSyntheticProposal(request)).ok).toBe(true);
 await new Promise(resolve=>setTimeout(resolve,320));
 expect(await c.stub.commitSyntheticProposal(request)).toMatchObject({ok:false,code:'PROPOSAL_EXPIRED'});
 expect(await counts(c)).toEqual({receipts:1,observations:1,commits:1,consumed:1});
});

it('audit failure rolls back consumed nonce, observation and receipt; exact retry succeeds',async()=>{
 const c=await initialize(),request=await proposal(c);
 await runInDurableObject(c.stub,(_i,state)=>{state.storage.sql.exec("CREATE TRIGGER fail_commit BEFORE INSERT ON audit WHEN NEW.kind='proposal-committed' BEGIN SELECT RAISE(ABORT,'fixture audit failure'); END;");});
 expect(await c.stub.commitSyntheticProposal(request)).toMatchObject({ok:false,code:'STORAGE_UNAVAILABLE'});
 expect(await counts(c)).toEqual({receipts:0,observations:0,commits:0,consumed:0});
 await runInDurableObject(c.stub,(_i,state)=>{state.storage.sql.exec('DROP TRIGGER fail_commit');});
 expect((await c.stub.commitSyntheticProposal(request)).ok).toBe(true);
 expect(await counts(c)).toEqual({receipts:1,observations:1,commits:1,consumed:1});
});

it('restart keeps persisted receipt/nonce but discards admission; fresh outside fixture reference is required',async()=>{
 const c=await initialize(),request=await proposal(c);expect((await c.stub.commitSyntheticProposal(request)).ok).toBe(true);
 const old=accepted(await c.stub.fixtureChallenge({scope:c.scope}));await abortAllDurableObjects();
 const fresh=make(c.scope),challenge=accepted(await fresh.stub.fixtureChallenge({scope:c.scope}));expect(challenge.admitted).toBe(false);expect(challenge.bootNonce).not.toBe(old.bootNonce);
 expect(await fresh.stub.commitSyntheticProposal(request)).toMatchObject({ok:false,code:'RESTORE_ADMISSION_REQUIRED'});
 expect(await fresh.stub.admitSyntheticFixture({scope:c.scope,bootNonce:old.bootNonce,anchor:old.anchor})).toMatchObject({ok:false});
 expect((await fresh.stub.admitSyntheticFixture({scope:c.scope,bootNonce:challenge.bootNonce,anchor:old.anchor})).ok).toBe(true);
 expect(await fresh.stub.commitSyntheticProposal(request)).toMatchObject({ok:true,replayed:true});
 expect(await counts(fresh)).toEqual({receipts:1,observations:1,commits:1,consumed:1});
});

it('simulated old SQLite copy cannot use old admission or match an advanced outside fixture anchor',async()=>{
 const c=await initialize(),request=await proposal(c);
 const old=await runInDurableObject(c.stub,(_i,state)=>({account:state.storage.sql.exec('SELECT * FROM account').one(),proposals:state.storage.sql.exec('SELECT * FROM proposals').toArray(),audit:state.storage.sql.exec('SELECT * FROM audit').toArray()}));
 expect((await c.stub.commitSyntheticProposal(request)).ok).toBe(true);
 const advanced=accepted(await c.stub.fixtureChallenge({scope:c.scope}));
 await runInDurableObject(c.stub,(_i,state)=>{
  state.storage.transactionSync(()=>{
   state.storage.sql.exec('DELETE FROM receipts; DELETE FROM observations; DELETE FROM proposals; DELETE FROM audit; DELETE FROM account;');
   const r=old.account;state.storage.sql.exec('INSERT INTO account VALUES(?,?,?,?,?,?,?,?,?)',r.id,r.scope,r.epoch,r.sequence,r.head,r.guardian,r.child,r.blocked,r.last_time);
   for(const p of old.proposals)state.storage.sql.exec('INSERT INTO proposals VALUES(?,?,?,?,?,?)',p.id,p.digest,p.nonce,p.epoch,p.expires,p.consumed);
   for(const a of old.audit)state.storage.sql.exec('INSERT INTO audit VALUES(?,?,?)',a.sequence,a.kind,a.head);
  });
 });
 expect(await c.stub.commitSyntheticProposal(request)).toMatchObject({ok:false,code:'RESTORE_ANCHOR_MISMATCH'});
 // A negative safety action remains available, but may not manufacture admission.
 expect((await c.stub.setSyntheticConsent({scope:c.scope,role:'child',granted:false})).ok).toBe(true);
 expect(await c.stub.setSyntheticConsent({scope:c.scope,role:'guardian',granted:true})).toMatchObject({ok:false,code:'RESTORE_ADMISSION_REQUIRED'});
 await abortAllDurableObjects();const fresh=make(c.scope),challenge=accepted(await fresh.stub.fixtureChallenge({scope:c.scope}));
 expect(await fresh.stub.admitSyntheticFixture({scope:c.scope,bootNonce:challenge.bootNonce,anchor:advanced.anchor})).toMatchObject({ok:false,code:'RESTORE_ANCHOR_MISMATCH'});
 expect(await counts(fresh)).toEqual({receipts:0,observations:0,commits:0,consumed:0});
});

it('observed clock rollback latches durable quarantine and clears consent',async()=>{
 const c=await initialize(),request=await proposal(c);
 await runInDurableObject(c.stub,(_i,state)=>{state.storage.sql.exec('UPDATE account SET last_time=? WHERE id=1',Date.now()+60_000);});
 expect(await c.stub.commitSyntheticProposal(request)).toMatchObject({ok:false,code:'CLOCK_QUARANTINED'});
 const row=await runInDurableObject(c.stub,(_i,state)=>state.storage.sql.exec('SELECT * FROM account').one());
 expect(row.blocked).toBe(1);expect(row.child).toBe(0);expect(row.guardian).toBe(0);
 await abortAllDurableObjects();const fresh=make(c.scope),challenge=accepted(await fresh.stub.fixtureChallenge({scope:c.scope}));
 expect(await fresh.stub.admitSyntheticFixture({scope:c.scope,bootNonce:challenge.bootNonce,anchor:challenge.anchor})).toMatchObject({ok:false});
});

it('withdrawal directly after altered stored state cannot silently refresh positive admission',async()=>{
 const c=await initialize();await proposal(c);
 await runInDurableObject(c.stub,(_i,state)=>{state.storage.sql.exec('UPDATE account SET sequence=sequence-1 WHERE id=1; DELETE FROM audit WHERE sequence>(SELECT sequence FROM account WHERE id=1);');});
 expect((await c.stub.setSyntheticConsent({scope:c.scope,role:'child',granted:false})).ok).toBe(true);
 expect(await c.stub.setSyntheticConsent({scope:c.scope,role:'guardian',granted:true})).toMatchObject({ok:false,code:'RESTORE_ADMISSION_REQUIRED'});
 expect(accepted(await c.stub.fixtureChallenge({scope:c.scope})).admitted).toBe(false);
});
