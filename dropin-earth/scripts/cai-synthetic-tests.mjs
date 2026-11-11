import process from 'node:process';
import console from 'node:console';
import {spawn} from 'node:child_process';
if(!process.env.CAI_DEEPSEEK_ROOT) {
  console.error('Set CAI_DEEPSEEK_ROOT to the pinned DeepSeek checkout; this integration gate cannot skip.');
  process.exitCode=1;
} else {
  const tests=[
    'cai-runtime','cai-network','cai-proposal','cai-request-scope',
    'twin-orchestration','lifepp-boundary','lifepp-network',
  ].map(name=>`tests/unit/child-stewardship-${name}.test.ts`);
  const child=spawn(process.execPath,['--test','--test-concurrency=1','--import','tsx',...tests],{stdio:'inherit'});
  child.on('error',()=>{process.exitCode=1;});child.on('close',code=>{process.exitCode=code??1;});
}
