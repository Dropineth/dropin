import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { LearningPrincipal, LearningRole, LearningState } from "./learning-types.js";
import type { RightsState, RightsContext } from "./rights-types.js";

export const CHILD_PROTOCOL = "canopyproof.child-stewardship.v1";
export const CHILD_POLICY = "synthetic-child-policy-2026-10-23";
export type ChildSnapshot = { version: number; learning: LearningState; rights: RightsState; rightsContext?: RightsContext };
export type DemoSession = { id: string; expiresAt: string; snapshot: ChildSnapshot };
export type DemoToken = { hash: string; sessionId: string; principal: LearningPrincipal };
export type ChildReceipt = { key: string; digest: string; actorId: string; result: unknown; version: number };
export type ChildTransaction = {
  draftAuthorization?: {proof:string;command:unknown;actorId:string};
  actorRole?: LearningRole;
  actorId?: string;
  sessionGeneration?:number;
  executionTime?:string;
  rightsRecordedAt?:Record<string,string>;
  operation?: string;
  snapshot: ChildSnapshot;
  receipts: ChildReceipt[];
  audit: { action: string; outcome: "accepted" | "rejected"; reason: string; actorId: string; time: string }[];
  outbox: { id: string; kind: string; resourceId: string; audience: string }[];
};
export type ChildStore = {
  consumeRateLimit?(kind:'session_creation'|'session_request',sessionId?:string,actorId?:string):Promise<void>;
  issueDraftAuthorization?(rawBearer:string,proposal:unknown):Promise<string>;
  ready(): Promise<boolean>;
  create(session: DemoSession, tokens: DemoToken[]): Promise<void>;
  resolveToken(hash: string, now: string): Promise<{ sessionId: string; principal: LearningPrincipal } | null>;
  privacyResult?(sessionId: string, principal: LearningPrincipal, requestId: string, now:string): Promise<unknown>;
  transact<T>(sessionId: string, now: string, run: (tx: ChildTransaction) => T): Promise<T>;
};
export class ChildApiError extends Error {
  constructor(public readonly code: string, public readonly status: 400 | 401 | 403 | 409 | 413 | 429 | 503 = 400) { super(code); }
}
export function stableJson(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  throw new ChildApiError("INVALID_INPUT");
}
export function childDigest(value: unknown): string { return createHash("sha256").update(stableJson(value)).digest("hex"); }
export function tokenDigest(token: string): string { return createHash("sha256").update(token).digest("hex"); }
export function createDemoTokens(sessionId: string): { publicTokens: Record<LearningRole, string>; records: DemoToken[] } {
  const publicTokens = {} as Record<LearningRole, string>;
  const records: DemoToken[] = [];
  for (const role of ["guardian", "child", "reviewer", "protector", "operator"] as const) {
    const token = `cp-demo.${randomBytes(32).toString("base64url")}`;
    publicTokens[role] = token;
    records.push({ hash: tokenDigest(token), sessionId, principal: { actorId: `demo-${role}`, deviceId: `demo-device-${role}`, epoch: 1 } });
  }
  return { publicTokens, records };
}
export const newDemoSessionId = () => randomUUID();

/** Explicit test-only transaction double. Runtime never falls back to this store. */
export class TestChildStore implements ChildStore {
  readonly sessions = new Map<string, DemoSession>();
  readonly tokens = new Map<string, DemoToken>();
  readonly receipts = new Map<string, ChildReceipt[]>();
  readonly audit = new Map<string, ChildTransaction["audit"]>();
  readonly outbox = new Map<string, ChildTransaction["outbox"]>();
  private tail: Promise<unknown> = Promise.resolve();
  async ready() { return true; }
  async create(session: DemoSession, tokens: DemoToken[]) {
    this.sessions.set(session.id, structuredClone(session));
    for (const token of tokens) this.tokens.set(token.hash, structuredClone(token));
  }
  async resolveToken(hash: string, now: string) {
    const token = this.tokens.get(hash);
    const session = token ? this.sessions.get(token.sessionId) : undefined;
    return token && session && Date.parse(session.expiresAt) > Date.parse(now) ? structuredClone(token) : null;
  }
  async transact<T>(sessionId: string, now: string, run: (tx: ChildTransaction) => T): Promise<T> {
    const work = this.tail.then(() => {
      const session = this.sessions.get(sessionId);
      if (!session || Date.parse(session.expiresAt) <= Date.parse(now)) throw new ChildApiError("UNAUTHORIZED", 401);
      const tx: ChildTransaction = { snapshot: structuredClone(session.snapshot), receipts: structuredClone(this.receipts.get(sessionId) ?? []), audit: [], outbox: [] };
      const result = run(tx);
      session.snapshot = tx.snapshot;
      this.receipts.set(sessionId, tx.receipts);
      this.audit.set(sessionId, [...this.audit.get(sessionId) ?? [], ...tx.audit]);
      this.outbox.set(sessionId, [...this.outbox.get(sessionId) ?? [], ...tx.outbox]);
      return result;
    });
    this.tail = work.catch(() => undefined);
    return work;
  }
}
