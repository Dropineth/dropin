/* global AbortController, structuredClone */
import { readFile } from 'node:fs/promises';
import { resolve, posix } from 'node:path';
import { URL } from 'node:url';
import { Buffer } from 'node:buffer';
import { build } from 'esbuild';
import { createHash, randomBytes } from 'node:crypto';
import { createCaiChildTrigger, reviewCaiChildProposal } from '../../services/api/src/domain/child-stewardship/cai-proposal.ts';
import { canonicalRightsJson } from '../../services/api/src/domain/child-stewardship/authorization.ts';
import { runIsolatedWorker } from './docker-worker.mjs';

export async function loadPinnedDeepSeek(root) {
  const pin = JSON.parse(await readFile(new URL('./deepseek-source-pin.json',import.meta.url),'utf8'));
  const verified = new Map();
  for(const [file,digest] of Object.entries(pin.files)) {
    const bytes = await readFile(resolve(root,file));
    if(createHash('sha256').update(bytes).digest('hex')!==digest)throw new Error('DEEPSEEK_SOURCE_PIN_MISMATCH');
    verified.set(file,bytes.toString('utf8'));
  }
  // Never import the mutable checkout after checking it. Resolve every module
  // from the exact verified bytes; local tsconfig and extra files cannot enter.
  const bundle=await build({entryPoints:['src/core/index.ts'],bundle:true,write:false,
    platform:'node',format:'esm',target:'node22',tsconfigRaw:'{}',
    plugins:[{name:'verified-deepseek-core',setup(builder){
      builder.onResolve({filter:/.*/},args=>{
        if(args.path==='node:crypto')return {path:args.path,external:true};
        const path=args.kind==='entry-point'?args.path:posix.normalize(posix.join(posix.dirname(args.importer),args.path));
        if(!path.endsWith('.ts')||!verified.has(path))throw new Error('DEEPSEEK_IMPORT_NOT_PINNED');
        return {path,namespace:'verified-core'};
      });
      builder.onLoad({filter:/.*/,namespace:'verified-core'},args=>({contents:verified.get(args.path),loader:'ts'}));
    }}]});
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString('base64')}`);
}

/** Local synthetic composition of the real upstream Engine/Policy/Assessor/
 * Executor ports. No public ingress, persistent store, signing or execution API.
 * The trusted fixture host owns readCurrent; workers cannot provide authority.
 */
export async function createSyntheticRouter(root, {maxJobs=8,timeoutMs=3000}={}) {
  if(!Number.isInteger(maxJobs)||maxJobs<1||maxJobs>32||!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000)throw new Error('RUNTIME_LIMIT_INVALID');
  const {Engine, MemoryRepositories} = await loadPinnedDeepSeek(root);
  const repo = new MemoryRepositories(), jobs = new Map(), assessments = [], launches = [], events = [];
  let closed = false, running = 0;
  const same = (a,b) => canonicalRightsJson(a) === canonicalRightsJson(b);
  const allowed = trigger => !closed && jobs.has(trigger.id) && same(trigger,jobs.get(trigger.id).trigger);
  const engine = new Engine({repo,
    scope:{scope: input => input.source==='canopyproof-child-proposal' ? {listened:true,observed:true} : {listened:false,reason:'source denied'}},
    policy:()=>({version:'cai-synthetic-router/1',paused:closed,evalTimeoutMs:5000,
      gate:trigger=>allowed(trigger) ? {admissible:true,strength:'inferred',basis:{via:'bot',source:trigger.source,observation:{mode:'auto'}}} : {admissible:false,reason:'unregistered proposal'},
      revalidate:()=>!closed,admitsInferred:rules=>!closed&&rules.length===1&&rules[0]==='synthetic-review'}),
    assessor:{request:candidate=>assessments.push(candidate)},
    executor:{
      start:(ticket,assignment)=>{launches.push({ticket,assignment});Promise.resolve().then(pump);},
      deliver:(ticket,assignment)=>{Promise.resolve().then(()=>{
        if(!repo.tickets.get(ticket.id)?.ended)engine.inputsDelivered(ticket.id,assignment.id,ticket.undelivered);
      });},
      stop:ticket=>jobs.get(ticket.origin.triggerId)?.controller.abort(),
    },
    // External communications are not configured. Treat any attempt as a bug.
    outbox:{send:()=>{throw new Error('EXTERNAL_REPLY_DISABLED');},status:()=>undefined,withdraw:()=>{}},
    emit:event=>events.push(event.type),
  });
  function review(job) {
    if(closed||job.controller.signal.aborted)throw new Error('WORK_CANCELLED');
    const current=job.readCurrent();
    return reviewCaiChildProposal({mode:'synthetic-review',trigger:job.trigger,operation:job.operation,approvals:job.approvals},
      {expectedTrigger:job.trigger,state:current.state,context:current.context});
  }
  async function work({ticket,assignment},job) {
    try {
      review(job); // Revocation/role checks before launch, without sharing them.
      engine.assignmentStarted(ticket.id,assignment.id);
      const output=await runIsolatedWorker({workId:job.trigger.id,operationDigest:job.trigger.meta.operationDigest,delayMs:job.delayMs},
        {signal:job.controller.signal,timeoutMs,started:name=>{job.status='running';job.started(name);}});
      if(!same(output,{schema:'CanopyProof-CAI-Worker/1',workId:job.trigger.id,operationDigest:job.trigger.meta.operationDigest,
        proposal:'request-current-synthetic-review',finalAuthority:false}))throw new Error('WORKER_REPORT_INVALID');
      const result=review(job); // Fresh authority after asynchronous work.
      job.result=result;
      engine.report(ticket.id,{state:'ready',summary:'Synthetic review completed; execution disabled.'});
      job.status='ready';
    } catch(error) {
      job.cleanupFailed=error.code==='WORKER_CLEANUP_FAILED';
      job.status=job.controller.signal.aborted||closed ? 'cancelled' : 'rejected';
      job.result={finalAuthority:false,executionEnabled:false,syntheticOnly:true,
        error:typeof error.code==='string'&&/^[A-Z_]+$/.test(error.code)?error.code:'WORK_UNAVAILABLE'};
      if(!repo.tickets.get(ticket.id)?.ended)engine.report(ticket.id,{state:'dropped',summary:'Synthetic work stopped without execution.'});
    } finally {
      job.started(null);running--;job.finish(structuredClone({status:job.status,result:job.result}));pump();
    }
  }
  function pump() {
    while(!closed&&running<2&&launches.length) {
      const launch=launches.shift(),job=jobs.get(launch.ticket.origin.triggerId);
      if(job.controller.signal.aborted)continue;
      running++;job.task=work(launch,job);
    }
  }
  function cancel(id) {
    const job=jobs.get(id);if(!job)throw new Error('UNKNOWN_WORK');
    if(['ready','rejected','cancelled'].includes(job.status))return;
    job.controller.abort();
    if(job.ticketId&&!repo.tickets.get(job.ticketId)?.ended)engine.stopTicket(job.ticketId,'Local synthetic host stopped work.');
    if(!job.task){job.started(null);job.status='cancelled';job.finish({status:'cancelled',result:{finalAuthority:false,executionEnabled:false}});}
  }
  return {
    submit(operation,approvals,readCurrent,{delayMs=0}={}) {
      if(closed)throw new Error('RUNTIME_CLOSED');
      if(jobs.size>=maxJobs)throw new Error('WORK_LIMIT');
      if(!Number.isInteger(delayMs)||delayMs<0||delayMs>1000)throw new Error('WORKER_DELAY_INVALID');
      const current=readCurrent(),id=`cai-${randomBytes(16).toString('hex')}`;
      const trigger=createCaiChildTrigger(id,new Date(current.context.now).toISOString(),operation);
      let finish,started;
      const done=new Promise(resolve=>{finish=resolve;}),began=new Promise(resolve=>{started=resolve;});
      const job={trigger,operation:structuredClone(operation),approvals:structuredClone(approvals),readCurrent,delayMs,
        status:'queued',controller:new AbortController(),done,began,finish,started};
      jobs.set(id,job);
      engine.receive(trigger);engine.evaluateDue();
      while(assessments.length) {
        const candidate=assessments.shift();
        const decision=engine.decide(candidate.triggers[0].id,{evalId:candidate.evalId,kind:'accept',title:'Synthetic child proposal',
          scope:'advisory review only',reason:'Registered local synthetic proposal',rules:['synthetic-review']});
        jobs.get(candidate.triggers[0].id).ticketId=decision.ticketId;
      }
      return {id,done,began};
    },
    cancel,
    snapshot:()=>({closed,running,events:[...events],jobs:[...jobs].map(([id,job])=>({id,status:job.status,ticketId:job.ticketId}))}),
    async shutdown(){closed=true;for(const id of jobs.keys())cancel(id);await Promise.all([...jobs.values()].map(job=>job.task).filter(Boolean));if([...jobs.values()].some(job=>job.cleanupFailed))throw new Error('WORKER_CLEANUP_FAILED');},
  };
}
