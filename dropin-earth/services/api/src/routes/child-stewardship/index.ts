import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { createSyntheticLearningState, executeLearningCommand, readChildLearningView } from "../../domain/child-stewardship/learning.js";
import { applyRightsOperation, createEmptyRightsState } from "../../domain/child-stewardship/rights.js";
import type { RightsApproval, RightsOperation } from "../../domain/child-stewardship/rights-types.js";
import { CHILD_POLICY, CHILD_PROTOCOL, ChildApiError, childDigest, createDemoTokens, newDemoSessionId, tokenDigest, type ChildStore, type ChildTransaction } from "../../domain/child-stewardship/store.js";
import type { LearningPrincipal } from "../../domain/child-stewardship/learning-types.js";

type Options = {
  mode: string | undefined;
  store: ChildStore | null;
  now?: () => string;
};
type ApiEnv = { Variables: { sessionId: string; principal: LearningPrincipal } };
const CODE = /^[A-Z][A-Z0-9_]{1,70}$/;
function safeError(error: unknown): { code: string; status: 400 | 401 | 403 | 409 | 413 | 429 | 503 } {
  if (error instanceof ChildApiError) return { code: error.code, status: error.status };
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string" && CODE.test(error.code)) {
    return { code: error.code, status: error.code === "VERSION_CONFLICT" ? 409 : 403 };
  }
  return { code: "SERVICE_UNAVAILABLE", status: 503 };
}
function assertPrincipal(tx: ChildTransaction, principal: LearningPrincipal, now: string) {
  const actor = tx.snapshot.learning.actors[principal.actorId];
  if (!actor || actor.revoked || actor.epoch !== principal.epoch || !actor.deviceIds.includes(principal.deviceId) || Date.parse(actor.expiresAt) <= Date.parse(now)) {
    throw new ChildApiError("UNAUTHORIZED", 401);
  }
  tx.actorRole = actor.role;
}
/** The mode is server-owned and no real provider, media, wallet, or biometric path is installed. */
export function createChildStewardshipRoutes(options: Options) {
  const app = new Hono<ApiEnv>();
  const now = options.now ?? (() => new Date().toISOString());
  const buckets = new Map<string, { start: number; count: number }>();
  const limited = (key: string, max: number) => {
    const current = Date.parse(now());
    for (const [id, value] of buckets) if (current - value.start >= 60_000) buckets.delete(id);
    const value = buckets.get(key) ?? { start: current, count: 0 };
    value.count++;
    buckets.set(key, value);
    if (value.count > max || buckets.size > 2000) throw new ChildApiError("RATE_LIMITED", 429);
  };
  const envelope = (data: unknown, version?: number) => ({ data, request_id: newDemoSessionId(), server_time: now(), policy_version: CHILD_POLICY, ...(version === undefined ? {} : { version }) });
  app.use("*", async (c, next) => {
    c.header("cache-control", "private, no-store");
    c.header("x-content-type-options", "nosniff");
    c.header("referrer-policy", "no-referrer");
    await next();
  });
  app.onError((error, c) => { const e = safeError(error); return c.json({ error: { code: e.code, safe_message: "This synthetic action is unavailable. Your draft has not been accepted.", retryable: e.status === 503 || e.status === 429 }, request_id: newDemoSessionId(), server_time: now() }, e.status); });
  app.get("/status", async c => c.json(envelope({ protocol: CHILD_PROTOCOL, mode: options.mode === "synthetic-demo" ? "synthetic-demo" : "disabled", available: options.mode === "synthetic-demo" && Boolean(options.store) && await options.store!.ready(), syntheticOnly: true, realCapabilities: false, passkeyEnrollment: "unavailable", mediaUpload: "unavailable", pocc: "unsupported", chainRank: "unsupported" })));
  app.use("*", async (c, next) => {
    if (options.mode !== "synthetic-demo" || !options.store) throw new ChildApiError("SERVICE_UNAVAILABLE", 503);
    if (c.req.header("origin") && c.req.header("sec-fetch-site") === "cross-site") throw new ChildApiError("ORIGIN_DENIED", 403);
    await next();
  });
  app.use("*", bodyLimit({ maxSize: 131_072, onError: c => c.json({ error: { code: "PAYLOAD_TOO_LARGE", retryable: false } }, 413) }));
  app.post("/demo-sessions", async c => {
    limited("session-creation", 12);
    const body = await c.req.text();
    if (body && body !== "{}") throw new ChildApiError("INVALID_INPUT");
    if (!await options.store!.ready()) throw new ChildApiError("SERVICE_UNAVAILABLE", 503);
    const sessionId = newDemoSessionId();
    const time = now();
    const expiresAt = new Date(Date.parse(time) + 24 * 60 * 60_000).toISOString();
    const tokens = createDemoTokens(sessionId);
    const learning = createSyntheticLearningState(time);
    await options.store!.create({ id: sessionId, expiresAt, snapshot: { version: 0, learning, rights: createEmptyRightsState() } }, tokens.records);
    return c.json(envelope({ sessionId, expiresAt, tokens: tokens.publicTokens, syntheticOnly: true, identityVerified: false }, 0), 201);
  });
  app.use("*", async (c, next) => {
    const value = c.req.header("authorization") ?? "";
    if (!/^Bearer cp-demo\.[A-Za-z0-9_-]{43}$/.test(value)) throw new ChildApiError("UNAUTHORIZED", 401);
    const identity = await options.store!.resolveToken(tokenDigest(value.slice(7)), now());
    if (!identity) throw new ChildApiError("UNAUTHORIZED", 401);
    limited(identity.sessionId, 120);
    c.set("sessionId", identity.sessionId); c.set("principal", identity.principal);
    await next();
  });
  app.get("/view", async c => {
    const result = await options.store!.transact(c.get("sessionId"), now(), tx => {
      assertPrincipal(tx, c.get("principal"), now());
      return envelope(readChildLearningView(tx.snapshot.learning, c.get("principal"), now()), tx.snapshot.learning.version);
    });
    return c.json(result);
  });
  for (const path of ["/commands", "/rights/operations"] as const) {
    app.post(path, async c => {
      if (!c.req.header("content-type")?.startsWith("application/json")) throw new ChildApiError("INVALID_INPUT");
      const key = c.req.header("idempotency-key") ?? "";
      const match = c.req.header("if-match") ?? "";
      if (!/^[A-Za-z0-9_-]{8,100}$/.test(key) || !/^\d{1,10}$/.test(match)) throw new ChildApiError("PRECONDITION_REQUIRED", 409);
      let body: unknown;
      try { body = await c.req.json(); } catch { throw new ChildApiError("INVALID_INPUT"); }
      const digest = childDigest({ path, body });
      const principal = c.get("principal");
      const time = now();
      const outcome = await options.store!.transact(c.get("sessionId"), time, tx => {
        try {
          assertPrincipal(tx, principal, time);
          if (path === "/rights/operations" && principal.actorId !== "demo-operator") throw new ChildApiError("FORBIDDEN", 403);
          const receipt = tx.receipts.find(r => r.key === key && r.actorId === principal.actorId);
          if (receipt) {
            if (receipt.digest !== digest) throw new ChildApiError("IDEMPOTENCY_CONFLICT", 409);
            return { ok: true as const, data: receipt.result, version: receipt.version };
          }
          if (Number(match) !== (path === "/commands" ? tx.snapshot.learning.version : tx.snapshot.version)) throw new ChildApiError("VERSION_CONFLICT", 409);
          let result: unknown;
          if (path === "/commands") {
            tx.operation = body && typeof body === "object" && "type" in body && typeof body.type === "string" ? body.type : "invalid";
            const transition = executeLearningCommand(tx.snapshot.learning, body, principal, time);
            tx.snapshot.learning = transition.state;
            tx.outbox.push(...transition.outbox);
            result = transition.result;
          } else {
            if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).sort().join(",") !== "approvals,operation") throw new ChildApiError("INVALID_INPUT");
            const input = body as { operation: RightsOperation; approvals: RightsApproval[] };
            if (!Array.isArray(input.approvals) || input.approvals.length > 16) throw new ChildApiError("INVALID_INPUT");
            const storedContext = tx.snapshot.rightsContext;
            const context = storedContext ? { ...storedContext, now: time } : null;
            if (!context) throw new ChildApiError("RIGHTS_UNVERIFIED", 503);
            tx.operation = input.operation.operationType;
            tx.snapshot.rights = applyRightsOperation(tx.snapshot.rights, input.operation, input.approvals, context);
            result = { id: input.operation.operationId, status: "simulation_recorded", syntheticOnly: true, externalExecution: false };
          }
          tx.snapshot.version++;
          const visibleVersion = path === "/commands" ? tx.snapshot.learning.version : tx.snapshot.version;
          tx.receipts.push({ key, digest, actorId: principal.actorId, result, version: visibleVersion });
          tx.audit.push({ action: path === "/commands" ? "learning-command" : "rights-operation", outcome: "accepted", reason: "SYNTHETIC_ONLY", actorId: principal.actorId, time });
          return { ok: true as const, data: result, version: visibleVersion };
        } catch (error) {
          const rejection = safeError(error);
          tx.audit.push({ action: path === "/commands" ? "learning-command" : "rights-operation", outcome: "rejected", reason: rejection.code, actorId: principal.actorId, time });
          return { ok: false as const, error: rejection };
        }
      });
      if (!outcome.ok) throw new ChildApiError(outcome.error.code, outcome.error.status);
      return c.json(envelope(outcome.data, outcome.version));
    });
  }
  // No permissive generic mutation route: unknown capabilities fail closed.
  app.all("*", c => c.json({ error: { code: "CAPABILITY_UNAVAILABLE", retryable: false } }, 403));
  return app;
}
