import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { CHILD_POLICY, ChildApiError, newDemoSessionId } from "../../domain/child-stewardship/store.js";
import type { ChildResumeStore } from "../../domain/child-stewardship/resume-store.js";

/** Mount before the main child router's active-bearer middleware. A suspended
 * session deliberately has no active bearer; only its one-use ticket may resume.
 */
export function createChildResumeRoutes(options:{mode:string|undefined;store:ChildResumeStore|null;now?:()=>string}) {
  const app=new Hono();const now=options.now??(()=>new Date().toISOString());
  const envelope=(data:unknown)=>({data,request_id:newDemoSessionId(),server_time:now(),policy_version:CHILD_POLICY});
  app.onError((error,c)=>c.json({error:{code:error instanceof ChildApiError?error.code:"SERVICE_UNAVAILABLE",retryable:false},request_id:newDemoSessionId()},error instanceof ChildApiError?error.status:503));
  for(const path of ["/suspend","/resume","/cancel-resume"]){app.use(path,async(c,next)=>{
    c.header("cache-control","private, no-store");c.header("referrer-policy","no-referrer");c.header("x-content-type-options","nosniff");
    if(options.mode!=="synthetic-demo"||!options.store||!await options.store.ready())throw new ChildApiError("SERVICE_UNAVAILABLE",503);
    if(c.req.header("sec-fetch-site")==="cross-site")throw new ChildApiError("ORIGIN_DENIED",403);
    await next();
  });
  app.use(path,bodyLimit({maxSize:2048,onError:c=>c.json({error:{code:"PAYLOAD_TOO_LARGE",retryable:false}},413)}));}
  app.post("/suspend",async c=>{
    if((await c.req.text())!=="{}")throw new ChildApiError("INVALID_INPUT");
    const authorization=c.req.header("authorization")??"";
    if(!/^Bearer cp-demo\.[A-Za-z0-9_-]{43}$/.test(authorization))throw new ChildApiError("UNAUTHORIZED",401);
    return c.json(envelope(await options.store!.suspend(authorization.slice(7))));
  });
  for(const path of ["/resume","/cancel-resume"]){app.post(path,async c=>{
    if(!c.req.header("content-type")?.startsWith("application/json"))throw new ChildApiError("INVALID_INPUT");
    let body:unknown;try{body=await c.req.json();}catch{throw new ChildApiError("INVALID_INPUT");}
    if(!body||typeof body!=="object"||Array.isArray(body)||Object.keys(body).join(",")!=="resumeTicket"
      ||!("resumeTicket" in body)||typeof body.resumeTicket!=="string")throw new ChildApiError("INVALID_INPUT");
    return c.json(envelope(path==="/resume"?await options.store!.resume(body.resumeTicket):await options.store!.cancel(body.resumeTicket)));
  });}
  return app;
}
