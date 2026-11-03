// Fixed synthetic explainer. No model, tools, credentials, network or ledger API.
import process from 'node:process';
import { setTimeout } from 'node:timers/promises';
let text = '';
for await (const chunk of process.stdin) {
  text += chunk;
  if (text.length > 2048) throw new Error('WORKER_INPUT_LIMIT');
}
const input = JSON.parse(text);
if (Object.keys(input).sort().join(',') !== 'delayMs,operationDigest,workId'
  || !/^cai-[a-f0-9]{32}$/.test(input.workId)
  || !/^[a-f0-9]{64}$/.test(input.operationDigest)
  || !Number.isInteger(input.delayMs) || input.delayMs < 0 || input.delayMs > 1000) throw new Error('WORKER_INPUT_INVALID');
await setTimeout(input.delayMs);
process.stdout.write(JSON.stringify({schema:'CanopyProof-CAI-Worker/1',workId:input.workId,
  operationDigest:input.operationDigest,proposal:'request-current-synthetic-review',finalAuthority:false}));
