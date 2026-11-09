/* global AbortController, structuredClone */
import {randomBytes} from 'node:crypto';
import {loadPinnedDeepSeek} from './synthetic-router.mjs';
import {runIsolatedWorker} from './docker-worker.mjs';
import {networkDigest} from './synthetic-account-network.ts';

/** One bounded ticket per instance. Host supplies signatures; worker gets hashes
 * only. The fixed explainer has no model, participant key or tool capability. */
export async function runSyntheticNetworkReview(root,network,request,approvals,{delayMs=0,onStarted=()=>{}}={}){
  const value=structuredClone(request),signed=structuredClone(approvals);
  network.check(value,signed);
  if(value.action!=='learning-review')throw new Error('WORKER_ACTION_DENIED');
  const {Engine,MemoryRepositories}=await loadPinnedDeepSeek(root);
  const repo=new MemoryRepositories(),id=`cai-${randomBytes(16).toString('hex')}`,digest=networkDigest(value);
  const trigger={id,source:'synthetic-child-network',threads:[{source:'synthetic-child-network',id}],actor:{source:'synthetic-child-network',id:'synthetic-host'},human:false,
    at:new Date().toISOString(),kind:'message',text:'Synthetic learning review',meta:{operationDigest:digest}};
  const candidates=[],events=[],controller=new AbortController();
  let resolveResult,rejectResult;
  const result=new Promise((resolve,reject)=>{resolveResult=resolve;rejectResult=reject;});
  const engine=new Engine({repo,
    scope:{scope:()=>({listened:true,observed:true})},
    policy:()=>({version:'synthetic-network/1',paused:false,evalTimeoutMs:5000,
      gate:t=>t.id===id?{admissible:true,strength:'inferred',basis:{via:'bot',source:t.source,observation:{mode:'auto'}}}:{admissible:false,reason:'unregistered'},
      revalidate:()=>!network.snapshot().closed,admitsInferred:rules=>rules.length===1&&rules[0]==='synthetic-learning'}),
    assessor:{request:c=>candidates.push(c)},
    executor:{start:(ticket,assignment)=>{void (async()=>{
      try{
        network.check(value,signed);
        engine.assignmentStarted(ticket.id,assignment.id);
        const output=await runIsolatedWorker({workId:id,operationDigest:digest,delayMs},{signal:controller.signal,timeoutMs:3000,started:onStarted});
        if(JSON.stringify(output)!==JSON.stringify({schema:'CanopyProof-CAI-Worker/1',workId:id,operationDigest:digest,proposal:'request-current-synthetic-review',finalAuthority:false}))throw new Error('WORKER_REPORT_INVALID');
        const receipt=network.commit(value,signed);
        engine.report(ticket.id,{state:'ready',summary:'Synthetic learning receipt only.'});
        resolveResult({receipt,events});
      }catch(error){
        if(!repo.tickets.get(ticket.id)?.ended)engine.report(ticket.id,{state:'dropped',summary:'Review denied.'});
        rejectResult(error);
      }
    })();},deliver:()=>{throw new Error('DELIVERY_DISABLED');},stop:()=>controller.abort()},
    outbox:{send:()=>{throw new Error('EXTERNAL_REPLY_DISABLED');},status:()=>undefined,withdraw:()=>{}},emit:event=>events.push(event.type),
  });
  engine.receive(trigger);engine.evaluateDue();
  if(candidates.length!==1)throw new Error('ROUTING_FAILED');
  const candidate=candidates[0];
  const decision=engine.decide(id,{evalId:candidate.evalId,kind:'accept',title:'Synthetic network learning',scope:'learning only',reason:'Local fixture',rules:['synthetic-learning']});
  if(!decision.ticketId)throw new Error('ROUTING_DENIED');
  return result;
}
