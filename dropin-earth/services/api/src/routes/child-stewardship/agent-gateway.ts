import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';
import {PostgresChildAgentGateway,type ChildAgentWireApproval} from '../../domain/child-stewardship/agent-gateway-store.js';
import {ChildApiError} from '../../domain/child-stewardship/store.js';
import {ChildLearningError} from '../../domain/child-stewardship/learning.js';
import {getCapabilities} from '../../domain/child-stewardship/agent-gateway.js';

/** Optional synthetic service mount. The application has no production verifier
 * credential and does not claim this signed gateway is connected in the UI. */
export function createChildAgentGatewayRoutes(options:{mode:string|undefined;gateway:PostgresChildAgentGateway|null}){
  const app=new Hono();
  app.onError((error,c)=>c.json({error:{code:error instanceof ChildApiError||error instanceof ChildLearningError?error.code:'AGENT_UNAVAILABLE',retryable:false}},error instanceof ChildApiError?error.status:error instanceof ChildLearningError?403:503));
  app.get('/agent/status',async c=>c.json({data:{...getCapabilities(),connected:options.mode==='synthetic-demo'&&!!options.gateway&&await options.gateway.ready(),realProviderConnected:false}}));
  app.use('/agent/answer',async(c,next)=>{
    c.header('cache-control','private, no-store');c.header('referrer-policy','no-referrer');c.header('x-content-type-options','nosniff');
    if(options.mode!=='synthetic-demo'||!options.gateway||!await options.gateway.ready())throw new ChildApiError('AGENT_UNAVAILABLE',503);
    if(c.req.header('sec-fetch-site')==='cross-site')throw new ChildApiError('ORIGIN_DENIED',403);
    await next();
  });
  app.use('/agent/answer',bodyLimit({maxSize:12_288,onError:c=>c.json({error:{code:'PAYLOAD_TOO_LARGE'}},413)}));
  app.post('/agent/answer',async c=>{
    if(!c.req.header('content-type')?.startsWith('application/json'))throw new ChildApiError('INVALID_INPUT');
    const bearer=c.req.header('authorization')??'';if(!bearer.startsWith('Bearer '))throw new ChildApiError('UNAUTHORIZED',401);
    let body:unknown;try{body=await c.req.json();}catch{throw new ChildApiError('INVALID_INPUT');}
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='approval,envelope')throw new ChildApiError('INVALID_INPUT');
    const data=body as {envelope:unknown;approval:ChildAgentWireApproval};
    return c.json({data:await options.gateway!.answer(bearer.slice(7),data.envelope,data.approval)});
  });
  return app;
}
