import {z} from 'zod';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {networkDigest,type NetworkRequest,type NetworkSignature,createSyntheticAccountNetwork} from './synthetic-account-network.js';

const inferenceResult=z.object({kind:z.literal('learning-review-proposal'),evidenceDigest:z.string().regex(/^[a-f0-9]{64}$/),tools:z.tuple([])}).strict();
export type ScopedInferenceProvider={
  // No identity, keys, approvals or tools; provider must implement cancellation.
  propose(input:Readonly<{evidenceDigest:string;tools:readonly []}>,signal:AbortSignal):Promise<unknown>;
};
type Network=ReturnType<typeof createSyntheticAccountNetwork>;
type State='idle'|'inferring'|'awaiting-human-consent'|'authorized'|'executing'|'receipted'|'denied'|'aborted';
/** Local sandbox orchestration. Supplying a provider is not approval for data
 * transfer or production inference. The production provider remains absent. */
export function createChildTwinOrchestration(network:Network,provider?:ScopedInferenceProvider){
  let state:State='idle',request:NetworkRequest|undefined,approvals:NetworkSignature[]|undefined;
  let controller:AbortController|undefined;
  function discard(){request=undefined;approvals=undefined;}
  function fail(){if(state!=='aborted')state='denied';}
  return {
    async propose(value:NetworkRequest,timeoutMs=1000){
      if(state!=='idle')throw new Error('STATE_INVALID');
      if(!provider){state='denied';throw new Error('INFERENCE_NOT_CONFIGURED');}
      if(!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>3000)throw new Error('TIMEOUT_INVALID');
      // Strict profile validation without accepting authority from the model.
      networkDigest(value);
      if(value.action!=='learning-review'||network.snapshot().closed)throw new Error('PROPOSAL_DENIED');
      request=structuredClone(value);state='inferring';controller=new AbortController();
      const active=controller,proposal=request,expected=proposal.evidenceDigest;
      let timer:ReturnType<typeof setTimeout>|undefined;
      try{
        network.assertProposalAllowed(proposal);
        const aborted=new Promise<never>((_,reject)=>{
          active.signal.addEventListener('abort',()=>reject(new Error('INFERENCE_ABORTED')),{once:true});
          timer=setTimeout(()=>active.abort(),timeoutMs);
        });
        const result=inferenceResult.parse(await Promise.race([
          Promise.resolve().then(()=>{if(active.signal.aborted)throw new Error('INFERENCE_ABORTED');network.assertProposalAllowed(proposal);return provider.propose(Object.freeze({evidenceDigest:expected,tools:Object.freeze([]) as readonly []}),active.signal);}),aborted,
        ]));
        if(state!=='inferring'||active.signal.aborted||network.snapshot().closed||result.evidenceDigest!==expected)throw new Error('PROPOSAL_DENIED');
        network.assertProposalAllowed(proposal);
        state='awaiting-human-consent';return structuredClone(request);
      }catch(error){fail();discard();throw error;}
      finally{clearTimeout(timer);controller=undefined;}
    },
    authorize(externalApprovals:NetworkSignature[]){
      if(state!=='awaiting-human-consent'||!request)throw new Error('STATE_INVALID');
      try{network.check(request,externalApprovals);approvals=structuredClone(externalApprovals);state='authorized';}
      catch(error){state='denied';discard();throw error;}
    },
    async execute(pinnedSourceRoot:string){
      if(state!=='authorized'||!request||!approvals)throw new Error('STATE_INVALID');
      try{
        network.check(request,approvals);state='executing';
        const {runSyntheticNetworkReview}=await import(pathToFileURL(resolve(__dirname,'synthetic-network-router.mjs')).href);
        const result=await runSyntheticNetworkReview(pinnedSourceRoot,network,structuredClone(request),structuredClone(approvals));
        if(state!=='executing'||network.snapshot().closed)throw new Error('EXECUTION_ABORTED');
        state='receipted';return result;
      }catch(error){fail();throw error;}
      finally{discard();}
    },
    deny(){if(state==='receipted')throw new Error('STATE_INVALID');state='denied';controller?.abort();network.withdrawChild();discard();},
    abort(){state='aborted';controller?.abort();network.shutdown();discard();},
    withdraw(){state='aborted';controller?.abort();network.withdrawChild();discard();},
    shutdown(){state='aborted';controller?.abort();network.shutdown();discard();},
    snapshot:()=>({state,syntheticOnly:true,signer:false,toolsEnabled:false,productionInferenceConfigured:false,zkVerifierConfigured:false,smartContractConfigured:false}),
  };
}
