import type { ChildDraft, ChildSyncTransport } from "./child-stewardship-offline";
export type DemoRole = "guardian" | "child" | "reviewer" | "protector" | "operator";
export interface DemoLearningView {
  version: number;
  policyVersion: string;
  uploadAllowed: boolean;
  uploadEligibility: { profileId: string; allowed: boolean; consentEpoch: number }[];
  assignments: { id: string; profileId: string; status: string }[];
  profiles?: unknown[];
  observations?: unknown[];
  contributions?: unknown[];
  disputes?: unknown[];
}
export interface DemoResult { id: string; status: string; syntheticOnly: true }
/** Explicit user-started synthetic session. Tokens are never identity or guardianship proof. */
export class ChildDemoApi {
  private tokens: Partial<Record<DemoRole, string>> = {};
  private assignmentId: string | undefined;
  private sessionId: string | undefined;
  private consentEpoch: number | undefined;
  private packets = new Map<string, Record<string, unknown>>();
  constructor(private readonly baseUrl: string, private readonly fetcher: typeof fetch = fetch, readonly profileId = "demo-profile-a") {}
  private async request(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
    const fetcher = this.fetcher;
    const response = await fetcher(`${this.baseUrl}/canopyproof/child-stewardship/v1${path}`, { ...init, cache: "no-store", credentials: "omit", redirect: "error" });
    if (!response.ok) throw new Error(response.status === 409 ? "VERSION_CONFLICT" : response.status === 403 ? "CONSENT_REQUIRED" : "SERVICE_UNAVAILABLE");
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("SERVICE_UNAVAILABLE");
    return body as Record<string, unknown>;
  }
  async start(): Promise<void> {
    const status = await this.request("/status");
    const current = (status.data ?? status) as Record<string, unknown>;
    if (current.available !== true || current.syntheticOnly !== true || current.realCapabilities !== false) throw new Error("SERVICE_UNAVAILABLE");
    const response = await this.request("/demo-sessions", { method: "POST" });
    const data = response.data as { sessionId?: string; tokens?: Partial<Record<DemoRole, string>> } | undefined;
    if (!data?.tokens || ["guardian", "child", "reviewer", "protector", "operator"].some(role => typeof data.tokens?.[role as DemoRole] !== "string")) throw new Error("SERVICE_UNAVAILABLE");
    if (typeof data.sessionId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.sessionId)) throw new Error("SERVICE_UNAVAILABLE");
    this.tokens = data.tokens; this.sessionId = data.sessionId;
  }
  private headers(role: DemoRole): Record<string, string> {
    const token = this.tokens[role];
    if (!token) throw new Error("SERVICE_UNAVAILABLE");
    return { Authorization: `Bearer ${token}` };
  }
  async view(role: DemoRole = "child", signal?: AbortSignal): Promise<DemoLearningView> {
    const response = await this.request("/view", { headers: this.headers(role), ...(signal ? { signal } : {}) });
    const view = response.data as DemoLearningView | undefined;
    if (!view || !Number.isSafeInteger(view.version) || typeof view.policyVersion !== "string") throw new Error("SERVICE_UNAVAILABLE");
    return view;
  }
  async command(role: DemoRole, command: Record<string, unknown>, stableId?: string, signal?: AbortSignal): Promise<DemoResult> {
    const commandId = stableId ?? `demo-${crypto.randomUUID()}`;
    let packet = this.packets.get(commandId);
    if (!packet) {
      const view = await this.view(role, signal);
      packet = { ...command, commandId, expectedVersion: view.version };
      this.packets.set(commandId, packet);
    }
    if (signal?.aborted) throw new Error("CONSENT_WITHDRAWN");
    const response = await this.request("/commands", { method: "POST", headers: { ...this.headers(role), "Content-Type": "application/json", "Idempotency-Key": commandId, "If-Match": String(packet.expectedVersion) }, body: JSON.stringify(packet), ...(signal ? { signal } : {}) });
    const result = response.data as DemoResult | undefined;
    if (!result || result.syntheticOnly !== true || typeof result.id !== "string" || typeof result.status !== "string") throw new Error("RECEIPT_INVALID");
    return result;
  }
  async setup(ageBand: "6-8" | "9-12" | "13-17", upload: boolean): Promise<void> {
    await this.command("guardian", { type: "create-profile", profileId: this.profileId, ageBand, locale: "zh-CN", nickname: "leaf" });
    for (const purpose of upload ? ["learning", "upload"] : ["learning"]) {
      await this.command("guardian", { type: "grant-consent", profileId: this.profileId, purpose, policyVersion: "child-learning-demo-v1" });
      await this.command("child", { type: "set-assent", profileId: this.profileId, purpose, willing: true });
    }
    const assignment = await this.command("child", { type: "assign-task", profileId: this.profileId, taskId: "demo-task-leaf-comparison" });
    this.assignmentId = assignment.id;
    const current = await this.view();
    const eligibility = current.uploadEligibility.find(item => item.profileId === this.profileId);
    if (!eligibility?.allowed) throw new Error("CONSENT_REQUIRED");
    this.consentEpoch = eligibility.consentEpoch;
  }
  bindDraft(draft: ChildDraft, createdInCurrentPage = false): ChildDraft {
    if (draft.serverBinding) return draft;
    if (!createdInCurrentPage) throw new Error("DRAFT_REAUTHORIZATION_REQUIRED");
    if (!this.sessionId || !this.assignmentId || this.consentEpoch === undefined) throw new Error("SERVICE_UNAVAILABLE");
    return { ...draft, serverBinding: { sessionId: this.sessionId, profileId: this.profileId, consentEpoch: this.consentEpoch, assignmentId: this.assignmentId } };
  }
  private assertDraftAuthority(draft: ChildDraft, view: DemoLearningView, signal: AbortSignal): void {
    const binding = draft.serverBinding;
    const eligibility = view.uploadEligibility?.find(item => item.profileId === this.profileId);
    const assignment = view.assignments?.find(item => item.id === binding?.assignmentId && item.profileId === this.profileId);
    if (signal.aborted || !binding || binding.sessionId !== this.sessionId || binding.profileId !== this.profileId || binding.assignmentId !== this.assignmentId ||
      binding.consentEpoch !== this.consentEpoch || eligibility?.allowed !== true || eligibility.consentEpoch !== binding.consentEpoch || assignment?.status !== "active") throw new Error("CONSENT_WITHDRAWN");
  }
  transport(boundDraft: ChildDraft): ChildSyncTransport {
    return {
      prepare: async signal => {
        const view = await this.view("child", signal);
        this.assertDraftAuthority(boundDraft, view, signal);
        return { synthetic: true, allowed: true };
      },
      send: async (draft: ChildDraft, signal: AbortSignal) => {
        // Refresh after any pending request, then enforce the exact scope and epoch before POST.
        const view = await this.view("child", signal);
        this.assertDraftAuthority(draft, view, signal);
        const commandId = `demo-${draft.id}`;
        let packet = this.packets.get(commandId);
        if (!packet) {
          packet = { type: "submit-observation", commandId, expectedVersion: view.version, assignmentId: draft.serverBinding!.assignmentId,
            sampleId: draft.answer === "yellow_leaves" ? "demo-leaf-yellow" : "demo-leaf-green",
            answer: draft.answer === "green_leaves" ? "green" : draft.answer === "yellow_leaves" ? "yellow" : "uncertain", capturedAtClaimed: draft.createdAt };
          this.packets.set(commandId, packet);
        }
        // No awaited work between the current-state check and the first draft byte.
        const response = await this.request("/commands", { method: "POST", headers: { ...this.headers("child"), "Content-Type": "application/json", "Idempotency-Key": commandId, "If-Match": String(packet.expectedVersion) }, body: JSON.stringify(packet), signal });
        const result = response.data as DemoResult | undefined;
        if (!result || result.syntheticOnly !== true || typeof result.id !== "string" || typeof result.status !== "string") throw new Error("RECEIPT_INVALID");
        return { draftId: draft.id, receiptId: result.id, status: "received", synthetic: true };
      },
    };
  }
  async withdraw(): Promise<void> {
    for (const purpose of ["upload", "learning"]) await this.command("child", { type: "set-assent", profileId: this.profileId, purpose, willing: false });
  }
  close(): void { this.tokens = {}; this.assignmentId = undefined; this.sessionId = undefined; this.consentEpoch = undefined; this.packets.clear(); }
}
