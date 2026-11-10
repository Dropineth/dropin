import {createLifeppChildBoundary} from './lifepp-child-boundary.js';
import {createSyntheticAccountNetwork,type NetworkParticipant} from './synthetic-account-network.js';

/** Trusted test host receives the observation/appeal port separately from the
 * network passed to existing CAI orchestration. Never expose protocolBoundary to
 * model providers or workers. The legacy sandbox is not a live protocol adapter. */
export function createLifeppSyntheticAccountNetwork(account:string,personaId:string,participants:NetworkParticipant[],now:()=>number=Date.now){
  const protocolBoundary=createLifeppChildBoundary(personaId,now);
  const network=createSyntheticAccountNetwork(account,participants,now,protocolBoundary);
  return Object.freeze({network,protocolBoundary});
}
