import {createSyntheticLearningState,executeLearningCommand} from '../../services/api/src/domain/child-stewardship/learning.js';
import {createEmptyRightsState} from '../../services/api/src/domain/child-stewardship/rights.js';
import type {LearningRole} from '../../services/api/src/domain/child-stewardship/learning-types.js';
/** Test-only records produced through real learning transitions; no real claims. */
export function syntheticLedgerSnapshot(now=new Date().toISOString()){
 let learning=createSyntheticLearningState(now),sequence=0;
 const run=(role:LearningRole,fields:Record<string,unknown>)=>{
  const result=executeLearningCommand(learning,{commandId:`demo-ledger-${++sequence}`,expectedVersion:learning.version,...fields},
   {actorId:`demo-${role}`,deviceId:`demo-device-${role}`,epoch:1},now);learning=result.state;return result.result.id;
 };
 run('guardian',{type:'create-profile',profileId:'demo-ledger-profile',ageBand:'9-12',locale:'en',nickname:'leaf'});
 for(const purpose of ['learning','upload']){
  run('guardian',{type:'grant-consent',profileId:'demo-ledger-profile',purpose,policyVersion:learning.policyVersion});
  run('child',{type:'set-assent',profileId:'demo-ledger-profile',purpose,willing:true});
 }
 const assignmentId=run('child',{type:'assign-task',profileId:'demo-ledger-profile',taskId:'demo-task-leaf-comparison'});
 const observationId=run('child',{type:'submit-observation',assignmentId,sampleId:'demo-leaf-green',answer:'green',capturedAtClaimed:now});
 run('reviewer',{type:'review-observation',observationId,decision:'insufficient_for_survival',reason:'synthetic_source'});
 run('reviewer',{type:'grant-contribution',observationId,policyVersion:learning.policyVersion});
 return {version:0,learning,rights:createEmptyRightsState()};
}
