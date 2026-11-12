import {DurableObject} from 'cloudflare:workers';
import {verifyChildSignatureWebCrypto,decodeEd25519PublicKey} from './signature';
import {syntheticCommitBytes,type SignedCommitFields} from './authorization';

type Row={scope:string;epoch:number;sequence:number;head:string;guardian:number;child:number;blocked:number;last_time:number};
type Proposal={id:string;digest:string;nonce:string;epoch:number;expires:number;consumed:number};
type Receipt={command_id:string;proposal_id:string;digest:string;nonce:string;epoch:number;sequence:number};
type Signer={key_id:string;revision:number;public_key:string;active:number};
type VerifiedCommit={signer:Signer;payload:Uint8Array<ArrayBuffer>;signature:Uint8Array<ArrayBuffer>;expiresAt:number};
type Anchor=Pick<Row,'scope'|'epoch'|'sequence'|'head'>;
type Denial={ok:false;code:string;syntheticOnly:true};
const denied=(code:string):Denial=>({ok:false,code,syntheticOnly:true});
const ident=(s:unknown):s is string=>typeof s==='string'&&/^synthetic-[a-z0-9-]{1,48}$/.test(s);
const hex=(s:unknown,n:number):s is string=>typeof s==='string'&&new RegExp(`^[a-f0-9]{${n}}$`).test(s);
function shape(value:unknown,keys:string[]):Record<string,unknown>{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype
  ||Object.keys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw new Error('SYNTHETIC_INPUT_INVALID');
 return value as Record<string,unknown>;
}
function integer(v:unknown):v is number{return Number.isSafeInteger(v)&&Number(v)>=0;}
function anchor(row:Row):Anchor{return {scope:row.scope,epoch:row.epoch,sequence:row.sequence,head:row.head};}
function sameAnchor(a:Anchor,b:Record<string,unknown>|Anchor){return a.scope===b.scope&&a.epoch===b.epoch&&a.sequence===b.sequence&&a.head===b.head;}

/** Local conformance experiment only. All mutation RPCs require an explicit
 * test-only mode; there is no HTTP mutation ingress or real authorization path.
 * Fixture role labels are NOT signatures, guardian verification or trust roots.
 */
export class SyntheticChildAccount extends DurableObject<Env>{
 #bootNonce=crypto.randomUUID();
 #admitted:Anchor|undefined;
 #failure(error:unknown):Denial{
  const code=error instanceof Error?error.message:'';
  return denied(['SYNTHETIC_INPUT_INVALID','SYNTHETIC_FIXTURE_DISABLED','SYNTHETIC_SCOPE_MISMATCH','SYNTHETIC_ROLE_INVALID','SYNTHETIC_LIMIT'].includes(code)?code:'STORAGE_UNAVAILABLE');
 }
 #call<T>(body:()=>T):T|Denial{try{return body();}catch(error){return this.#failure(error);}}
 initializeSyntheticFixture(input:unknown){return this.#call(()=>this.#initialize(input));}
 fixtureChallenge(input:unknown){return this.#call(()=>this.#challenge(input));}
 admitSyntheticFixture(input:unknown){return this.#call(()=>this.#admit(input));}
 setSyntheticConsent(input:unknown){return this.#call(()=>this.#consent(input));}
 issueSyntheticProposal(input:unknown){return this.#call(()=>this.#issue(input));}
 commitSyntheticProposal(input:unknown){return this.#call(()=>this.#commit(input));}
 registerSyntheticGuardian(input:unknown){return this.#call(()=>this.#register(input));}
 revokeSyntheticGuardian(input:unknown){return this.#call(()=>this.#revoke(input));}
 async commitSignedSyntheticProposal(input:unknown){
  try{return await this.#signedCommit(input);}catch(error){return this.#failure(error);}
 }
 constructor(ctx:DurableObjectState,env:Env){
  super(ctx,env);
  ctx.blockConcurrencyWhile(async()=>{
   ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS account(
    id INTEGER PRIMARY KEY CHECK(id=1),scope TEXT NOT NULL,epoch INTEGER NOT NULL,
    sequence INTEGER NOT NULL,head TEXT NOT NULL,guardian INTEGER NOT NULL,child INTEGER NOT NULL,
    blocked INTEGER NOT NULL,last_time INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS proposals(id TEXT PRIMARY KEY,digest TEXT NOT NULL,nonce TEXT UNIQUE NOT NULL,
    epoch INTEGER NOT NULL,expires INTEGER NOT NULL,consumed INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS receipts(command_id TEXT PRIMARY KEY,proposal_id TEXT UNIQUE NOT NULL,
    digest TEXT NOT NULL,nonce TEXT UNIQUE NOT NULL,epoch INTEGER NOT NULL,sequence INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS observations(proposal_id TEXT PRIMARY KEY,command_id TEXT UNIQUE NOT NULL,
    digest TEXT NOT NULL,level TEXT NOT NULL CHECK(level='SYNTHETIC_E0'));
    CREATE TABLE IF NOT EXISTS audit(sequence INTEGER PRIMARY KEY,kind TEXT NOT NULL,head TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS signature_policy(id INTEGER PRIMARY KEY CHECK(id=1),required INTEGER NOT NULL CHECK(required=1));
    CREATE TABLE IF NOT EXISTS synthetic_signer(id INTEGER PRIMARY KEY CHECK(id=1),key_id TEXT NOT NULL,
    revision INTEGER NOT NULL,public_key TEXT NOT NULL,active INTEGER NOT NULL CHECK(active IN (0,1)));
    CREATE TABLE IF NOT EXISTS signature_evidence(command_id TEXT PRIMARY KEY,key_id TEXT NOT NULL,
    revision INTEGER NOT NULL,public_key TEXT NOT NULL,envelope TEXT NOT NULL,signature BLOB NOT NULL);`);
  });
 }
 #fixture(scope:unknown):asserts scope is string{
  if(String(this.env.CHILD_DO_MODE)!=='local-fixture-only')throw new Error('SYNTHETIC_FIXTURE_DISABLED');
  if(!ident(scope)||this.env.CHILD_ACCOUNT.idFromName(scope).toString()!==this.ctx.id.toString())throw new Error('SYNTHETIC_SCOPE_MISMATCH');
 }
 #row():Row|undefined{return this.ctx.storage.sql.exec<Row>('SELECT * FROM account WHERE id=1').toArray()[0];}
 #advance(row:Row,kind:string){
  if(row.sequence>=Number.MAX_SAFE_INTEGER-1||row.epoch>=Number.MAX_SAFE_INTEGER-1)throw new Error('SYNTHETIC_LIMIT');
  row.sequence++;row.head=crypto.randomUUID();
  this.ctx.storage.sql.exec('UPDATE account SET epoch=?,sequence=?,head=?,guardian=?,child=?,blocked=?,last_time=? WHERE id=1',
   row.epoch,row.sequence,row.head,row.guardian,row.child,row.blocked,row.last_time);
  this.ctx.storage.sql.exec('INSERT INTO audit VALUES(?,?,?)',row.sequence,kind,row.head);
 }
 #run<T>(scope:string,positive:boolean,body:(row:Row,now:number)=>T):T|Denial{
  this.#fixture(scope);
  // No await or external I/O within this entire local check/consume/write unit.
  let aligned=false;
  const result=this.ctx.storage.transactionSync(()=>{
   const row=this.#row();if(!row||row.scope!==scope)return denied('NOT_INITIALIZED');
   aligned=Boolean(this.#admitted&&sameAnchor(anchor(row),this.#admitted));
   if(positive){
    if(!this.#admitted)return denied('RESTORE_ADMISSION_REQUIRED');
    if(!aligned)return denied('RESTORE_ANCHOR_MISMATCH');
    if(row.blocked)return denied('CLOCK_QUARANTINED');
   }
   const now=Date.now();
   if(positive&&(!integer(now)||now<row.last_time)){
    row.guardian=0;row.child=0;row.blocked=1;row.epoch++;this.#advance(row,'clock-quarantine');
    return denied('CLOCK_QUARANTINED'); // Return, not throw: persist the revocation latch.
   }
   if(integer(now)&&now>=row.last_time){row.last_time=now;this.ctx.storage.sql.exec('UPDATE account SET last_time=? WHERE id=1',now);}
   return body(row,now);
  });
  // Persist first. Unexpected SQL exceptions roll back without advancing this cache.
  // Never adopt a mismatched disk state just because a denial was returned.
  if(this.#admitted&&aligned){
   const current=this.#row();if(current)this.#admitted=anchor(current);
  }else this.#admitted=undefined;
  return result;
 }
 #signer():Signer|undefined{return this.ctx.storage.sql.exec<Signer>('SELECT * FROM synthetic_signer WHERE id=1').toArray()[0];}
 /** Trusted local fixture administration ONLY: no human identity or real registry. */
 #register(input:unknown){
  const v=shape(input,['scope','keyId','publicKey','role']);this.#fixture(v.scope);
  if(v.role!=='guardian')throw new Error('SYNTHETIC_ROLE_INVALID');
  if(!ident(v.keyId)||typeof v.publicKey!=='string'||!decodeEd25519PublicKey(v.publicKey))throw new Error('SYNTHETIC_INPUT_INVALID');
  return this.#run(v.scope,true,row=>{
   const previous=this.#signer();if(previous&&previous.revision>=Number.MAX_SAFE_INTEGER-1)throw new Error('SYNTHETIC_LIMIT');
   const revision=(previous?.revision??0)+1;
   this.ctx.storage.sql.exec('INSERT OR IGNORE INTO signature_policy VALUES(1,1)');
   this.ctx.storage.sql.exec('INSERT INTO synthetic_signer VALUES(1,?,?,?,1) ON CONFLICT(id) DO UPDATE SET key_id=excluded.key_id,revision=excluded.revision,public_key=excluded.public_key,active=1',v.keyId,revision,v.publicKey);
   row.epoch++;row.guardian=0;row.child=0;this.#advance(row,'fixture-signer-registered');
   return {ok:true,revision,epoch:row.epoch,syntheticOnly:true};
  });
 }
 #revoke(input:unknown){
  const v=shape(input,['scope']);this.#fixture(v.scope);
  return this.#run(v.scope,false,row=>{
   const previous=this.#signer();if(!previous)return denied('SIGNER_REQUIRED');
   if(previous.revision>=Number.MAX_SAFE_INTEGER-1)throw new Error('SYNTHETIC_LIMIT');
   this.ctx.storage.sql.exec('UPDATE synthetic_signer SET active=0,revision=revision+1 WHERE id=1');
   row.epoch++;row.guardian=0;row.child=0;this.#advance(row,'fixture-signer-revoked');
   return {ok:true,epoch:row.epoch,syntheticOnly:true};
  });
 }
 async #signedCommit(input:unknown){
  const v=shape(input,['scope','proposalId','commandId','digest','nonce','expectedEpoch','expiresAt','keyId','keyRevision','signature']);this.#fixture(v.scope);
  if(!ident(v.proposalId)||!ident(v.commandId)||!ident(v.keyId)||!hex(v.digest,64)||!hex(v.nonce,32)
   ||!integer(v.expectedEpoch)||!integer(v.expiresAt)||!integer(v.keyRevision)||v.keyRevision===0
   ||!(v.signature instanceof Uint8Array)||v.signature.byteLength!==64)throw new Error('SYNTHETIC_INPUT_INVALID');
  // Own immutable primitive fields and signature bytes before the first await.
  const fields:SignedCommitFields={scope:v.scope,proposalId:v.proposalId,commandId:v.commandId,digest:v.digest,nonce:v.nonce,
   expectedEpoch:v.expectedEpoch,expiresAt:v.expiresAt,keyId:v.keyId,keyRevision:v.keyRevision};
  const signature=new Uint8Array(v.signature),payload=syntheticCommitBytes(fields,this.ctx.id.toString());
  const snapshot=this.#run(fields.scope,true,row=>{
   if(!row.guardian||!row.child||row.epoch!==fields.expectedEpoch)return denied('CONSENT_STALE');
   const signer=this.#signer();
   if(!signer||!signer.active||signer.key_id!==fields.keyId||signer.revision!==fields.keyRevision)return denied('SIGNER_STALE');
   return {ok:true as const,signer};
  });
  if(!snapshot.ok)return snapshot;
  const verified=await verifyChildSignatureWebCrypto({algorithm:'Ed25519',expectedPayload:payload,signedPayload:payload,signature,registeredPublicKey:snapshot.signer.public_key});
  if(!verified.valid)return denied('SIGNATURE_INVALID');
  // Async crypto may interleave with revoke/rotation/consent. No earlier check
  // authorizes the write: all local authority is reread in the sync transaction.
  return this.#commit({scope:fields.scope,proposalId:fields.proposalId,commandId:fields.commandId,digest:fields.digest,nonce:fields.nonce,expectedEpoch:fields.expectedEpoch},
   {signer:snapshot.signer,payload,signature,expiresAt:fields.expiresAt});
 }
 #initialize(input:unknown){
  const v=shape(input,['scope']);this.#fixture(v.scope);
  return this.ctx.storage.transactionSync(()=>{
   if(this.#row())return denied('ALREADY_INITIALIZED');
   const now=Date.now();if(!integer(now))return denied('CLOCK_INVALID');
   this.ctx.storage.sql.exec('INSERT INTO account VALUES(1,?,0,0,?,0,0,0,?)',v.scope,crypto.randomUUID(),now);
   return {ok:true,syntheticOnly:true};
  });
 }
 #challenge(input:unknown){
  const v=shape(input,['scope']);this.#fixture(v.scope);const row=this.#row();
  return {ok:true as const,syntheticOnly:true,bootNonce:this.#bootNonce,anchor:row?anchor(row):null,admitted:Boolean(this.#admitted),
   independentRestoreAnchor:false,productionReady:false};
 }
 /** Trusted test harness supplies an OUTSIDE reference. This is not a signed
  * authority protocol. Shipping the test mode would not make it authorization. */
 #admit(input:unknown){
  const v=shape(input,['scope','bootNonce','anchor']);this.#fixture(v.scope);
  const expected=shape(v.anchor,['scope','epoch','sequence','head']);
  this.#admitted=undefined;
  if(v.bootNonce!==this.#bootNonce||expected.scope!==v.scope||!integer(expected.epoch)||!integer(expected.sequence)
   ||typeof expected.head!=='string')return denied('RESTORE_ADMISSION_INVALID');
  const row=this.#row();if(!row||row.blocked||!sameAnchor(anchor(row),expected))return denied('RESTORE_ANCHOR_MISMATCH');
  this.#admitted=anchor(row);return {ok:true,syntheticOnly:true};
 }
 #consent(input:unknown){
  const v=shape(input,['scope','role','granted']);this.#fixture(v.scope);
  if(typeof v.role!=='string'||!['child','guardian'].includes(v.role)||typeof v.granted!=='boolean')throw new Error('SYNTHETIC_ROLE_INVALID');
  return this.#run(v.scope,v.granted,(row)=>{
   row.epoch++; // Even regrant/renewal invalidates every older proposal.
   if(!v.granted){row.guardian=0;row.child=0;}
   else if(v.role==='guardian'){row.guardian=1;row.child=0;}else row.child=1;
   this.#advance(row,v.granted?'fixture-consent':'consent-withdrawal');
   return {ok:true,epoch:row.epoch,syntheticOnly:true};
  });
 }
 #issue(input:unknown){
  const v=shape(input,['scope','proposalId','digest','nonce','expiresAt']);this.#fixture(v.scope);
  if(!ident(v.proposalId)||!hex(v.digest,64)||!hex(v.nonce,32)||!integer(v.expiresAt))throw new Error('SYNTHETIC_INPUT_INVALID');
  const {proposalId,digest,nonce,expiresAt}=v;
  return this.#run(v.scope,true,(row,now)=>{
   if(!row.guardian||!row.child)return denied('CONSENT_REQUIRED');
   if(expiresAt<=now||expiresAt-now>30_000)return denied('PROPOSAL_EXPIRED');
   if(this.ctx.storage.sql.exec('SELECT 1 FROM proposals WHERE id=? OR nonce=?',proposalId,nonce).toArray().length)return denied('PROPOSAL_CONFLICT');
   if(this.ctx.storage.sql.exec<{n:number}>('SELECT count(*) n FROM proposals').one().n>=128)return denied('FIXTURE_LIMIT');
   this.ctx.storage.sql.exec('INSERT INTO proposals(id,digest,nonce,epoch,expires) VALUES(?,?,?,?,?)',proposalId,digest,nonce,row.epoch,expiresAt);
   this.#advance(row,'proposal-issued');return {ok:true,epoch:row.epoch,syntheticOnly:true};
  });
 }
 #commit(input:unknown,verified?:VerifiedCommit){
  const v=shape(input,['scope','proposalId','commandId','digest','nonce','expectedEpoch']);this.#fixture(v.scope);
  if(!ident(v.proposalId)||!ident(v.commandId)||!hex(v.digest,64)||!hex(v.nonce,32)||!integer(v.expectedEpoch))throw new Error('SYNTHETIC_INPUT_INVALID');
  const {proposalId,commandId,digest,nonce,expectedEpoch}=v;
  return this.#run(v.scope,true,(row,now)=>{
   const currentSigner=this.#signer();
   // Once enrolled in this synthetic signed mode, even revocation cannot fall
   // back to the unsigned conformance RPC. There is no unenroll/delete RPC.
   if(!verified&&(currentSigner||this.ctx.storage.sql.exec('SELECT 1 FROM signature_policy WHERE id=1').toArray().length))return denied('SIGNATURE_REQUIRED');
   if(verified&&(!currentSigner||!currentSigner.active||currentSigner.key_id!==verified.signer.key_id
    ||currentSigner.revision!==verified.signer.revision||currentSigner.public_key!==verified.signer.public_key))return denied('SIGNER_STALE');
   if(!row.guardian||!row.child||row.epoch!==expectedEpoch)return denied('CONSENT_STALE');
   const proposal=this.ctx.storage.sql.exec<Proposal>('SELECT * FROM proposals WHERE id=?',proposalId).toArray()[0];
   if(!proposal||proposal.digest!==digest||proposal.nonce!==nonce||proposal.epoch!==row.epoch)return denied('PROPOSAL_MISMATCH');
   if(verified&&proposal.expires!==verified.expiresAt)return denied('SIGNED_EXPIRY_MISMATCH');
   if(proposal.expires<=now)return denied('PROPOSAL_EXPIRED');
   // Exact retries still require current consent, epoch and original expiry.
   const previous=this.ctx.storage.sql.exec<Receipt>('SELECT * FROM receipts WHERE command_id=?',commandId).toArray()[0];
   if(previous){
    if(previous.proposal_id!==proposalId||previous.digest!==digest||previous.nonce!==nonce||previous.epoch!==row.epoch)return denied('IDEMPOTENCY_CONFLICT');
    return {ok:true,replayed:true,receipt:previous,syntheticOnly:true};
   }
   if(proposal.consumed)return denied('NONCE_CONSUMED');
   this.ctx.storage.sql.exec('UPDATE proposals SET consumed=1 WHERE id=?',proposalId);
   this.ctx.storage.sql.exec("INSERT INTO observations VALUES(?,?,?,'SYNTHETIC_E0')",proposalId,commandId,digest);
   const receipt={command_id:commandId,proposal_id:proposalId,digest,nonce,epoch:row.epoch,sequence:row.sequence+1};
   this.ctx.storage.sql.exec('INSERT INTO receipts VALUES(?,?,?,?,?,?)',commandId,proposalId,digest,nonce,row.epoch,receipt.sequence);
   if(verified)this.ctx.storage.sql.exec('INSERT INTO signature_evidence VALUES(?,?,?,?,?,?)',commandId,verified.signer.key_id,verified.signer.revision,
    verified.signer.public_key,new TextDecoder().decode(verified.payload),verified.signature);
   this.#advance(row,'proposal-committed');return {ok:true,replayed:false,receipt,syntheticOnly:true};
  });
 }
}

export default {
 fetch(request:Request):Response{
  const url=new URL(request.url);
  const headers={'cache-control':'no-store','x-content-type-options':'nosniff'};
  if(request.method==='GET'&&url.pathname==='/health/live'&&!url.search)return Response.json({alive:true,syntheticOnly:true,accountEntry:'closed',realCapabilities:false},{headers});
  return Response.json({error:'CAPABILITY_UNAVAILABLE',syntheticOnly:true,realCapabilities:false},{status:503,headers});
 }
} satisfies ExportedHandler<Env>;
