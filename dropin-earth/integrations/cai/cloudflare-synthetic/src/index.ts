import {DurableObject} from 'cloudflare:workers';

type Row={scope:string;epoch:number;sequence:number;head:string;guardian:number;child:number;blocked:number;last_time:number};
type Proposal={id:string;digest:string;nonce:string;epoch:number;expires:number;consumed:number};
type Receipt={command_id:string;proposal_id:string;digest:string;nonce:string;epoch:number;sequence:number};
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
 #call<T>(body:()=>T):T|Denial{
  try{return body();}catch(error){
   const code=error instanceof Error?error.message:'';
   return denied(['SYNTHETIC_INPUT_INVALID','SYNTHETIC_FIXTURE_DISABLED','SYNTHETIC_SCOPE_MISMATCH','SYNTHETIC_ROLE_INVALID','SYNTHETIC_LIMIT'].includes(code)?code:'STORAGE_UNAVAILABLE');
  }
 }
 initializeSyntheticFixture(input:unknown){return this.#call(()=>this.#initialize(input));}
 fixtureChallenge(input:unknown){return this.#call(()=>this.#challenge(input));}
 admitSyntheticFixture(input:unknown){return this.#call(()=>this.#admit(input));}
 setSyntheticConsent(input:unknown){return this.#call(()=>this.#consent(input));}
 issueSyntheticProposal(input:unknown){return this.#call(()=>this.#issue(input));}
 commitSyntheticProposal(input:unknown){return this.#call(()=>this.#commit(input));}
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
    CREATE TABLE IF NOT EXISTS audit(sequence INTEGER PRIMARY KEY,kind TEXT NOT NULL,head TEXT NOT NULL);`);
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
 #commit(input:unknown){
  const v=shape(input,['scope','proposalId','commandId','digest','nonce','expectedEpoch']);this.#fixture(v.scope);
  if(!ident(v.proposalId)||!ident(v.commandId)||!hex(v.digest,64)||!hex(v.nonce,32)||!integer(v.expectedEpoch))throw new Error('SYNTHETIC_INPUT_INVALID');
  const {proposalId,commandId,digest,nonce,expectedEpoch}=v;
  return this.#run(v.scope,true,(row,now)=>{
   if(!row.guardian||!row.child||row.epoch!==expectedEpoch)return denied('CONSENT_STALE');
   const proposal=this.ctx.storage.sql.exec<Proposal>('SELECT * FROM proposals WHERE id=?',proposalId).toArray()[0];
   if(!proposal||proposal.digest!==digest||proposal.nonce!==nonce||proposal.epoch!==row.epoch)return denied('PROPOSAL_MISMATCH');
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
