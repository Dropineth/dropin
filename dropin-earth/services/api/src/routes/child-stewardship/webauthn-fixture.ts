import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { ChildSyntheticWebAuthn, ChildWebAuthnError, SYNTHETIC_WEBAUTHN_ORIGIN,
  type SyntheticWebAuthnScope } from "../../domain/child-stewardship/webauthn.js";

/** Isolated local test harness only. Deliberately not mounted by app.ts or the
 * production child router. Fixture/key/scope are server injected, never HTTP inputs.
 */
export function createChildWebAuthnFixtureRoutes(service: ChildSyntheticWebAuthn, scope: SyntheticWebAuthnScope,
  now: () => string = () => new Date().toISOString()) {
  const app = new Hono();
  app.onError((error,c) => {
    const known=error instanceof ChildWebAuthnError;
    return c.json({ error: { code: known?error.code:"WEBAUTHN_UNAVAILABLE", retryable: false }, syntheticOnly: true },known?error.status:503);
  });
  app.use("*",async(c,next)=> {
    c.header("cache-control","private, no-store");
    c.header("referrer-policy","no-referrer");
    c.header("x-content-type-options","nosniff");
    if(c.req.header("origin")!==SYNTHETIC_WEBAUTHN_ORIGIN || c.req.header("sec-fetch-site")==="cross-site") throw new ChildWebAuthnError("WEBAUTHN_ORIGIN_MISMATCH");
    if(c.req.header("authorization")!==`Bearer ${scope.capability}`) throw new ChildWebAuthnError("WEBAUTHN_UNAUTHORIZED",401);
    if(!await service.ready()) throw new ChildWebAuthnError("WEBAUTHN_UNAVAILABLE",503);
    await next();
  });
  app.use("*",bodyLimit({maxSize:32_768,onError:c=>c.json({error:{code:"WEBAUTHN_INPUT_TOO_LARGE"}},413)}));
  async function body(request: { json(): Promise<unknown>; header(name:string):string|undefined }, expected:string[]) {
    if(request.header("content-type")!=="application/json") throw new ChildWebAuthnError("WEBAUTHN_INVALID_INPUT",400);
    const value=await request.json();
    if(!value||typeof value!=="object"||Array.isArray(value)||Object.keys(value).sort().join(",")!==expected.sort().join(",")) throw new ChildWebAuthnError("WEBAUTHN_INVALID_INPUT",400);
    return value as Record<string,unknown>;
  }
  app.post("/options",async c=>{
    const value=await body(c.req,["kind"]);
    if(value.kind!=="registration"&&value.kind!=="authentication") throw new ChildWebAuthnError("WEBAUTHN_INVALID_INPUT",400);
    return c.json(await service.begin(scope,value.kind,now()));
  });
  app.post("/verify",async c=>{
    const value=await body(c.req,["ceremonyId","response"]);
    if(typeof value.ceremonyId!=="string") throw new ChildWebAuthnError("WEBAUTHN_INVALID_INPUT",400);
    return c.json(await service.finish(scope,value.ceremonyId,value.response,now()));
  });
  app.post("/session",async c=>{
    const value=await body(c.req,["sessionToken"]);
    if(typeof value.sessionToken!=="string") throw new ChildWebAuthnError("WEBAUTHN_INVALID_INPUT",400);
    return c.json(await service.authenticateSession(scope,value.sessionToken,now()));
  });
  app.post("/revoke",async c=>{await body(c.req,[]);return c.json(await service.revoke(scope,now()));});
  app.all("*",c=>c.json({error:{code:"WEBAUTHN_CAPABILITY_UNAVAILABLE"}},503));
  return app;
}
