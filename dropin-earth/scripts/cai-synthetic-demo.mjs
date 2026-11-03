import process from 'node:process';
import console from 'node:console';
import { createSyntheticRouter } from '../integrations/cai/synthetic-router.mjs';
import { createSyntheticRightsFixture } from '../tests/fixtures/child-stewardship-rights.ts';
async function main() {
  if(!process.env.CAI_DEEPSEEK_ROOT)throw new Error('CAI_DEEPSEEK_ROOT_REQUIRED');
  const router=await createSyntheticRouter(process.env.CAI_DEEPSEEK_ROOT);
  const stop=()=>{router.shutdown().catch(()=>{process.exitCode=1;});};
  process.once('SIGTERM',stop);process.once('SIGINT',stop);
  try {
    const f=createSyntheticRightsFixture(),state=f.funded(),operation=f.payment();
    const job=router.submit(operation,f.approvals(operation,['g','r1','t']),()=>({state,context:f.context}));
    const result=await job.done;
    console.log(JSON.stringify({mode:'LOCAL_SYNTHETIC',engine:'DeepSeek pinned core',worker:'isolated fixed explainer',...result,events:router.snapshot().events}));
    if(result.status!=='ready')process.exitCode=1;
  } finally {await router.shutdown();process.off('SIGTERM',stop);process.off('SIGINT',stop);}
}
main().catch(()=>{console.error('Synthetic CAI demo unavailable; no execution occurred.');process.exitCode=1;});
