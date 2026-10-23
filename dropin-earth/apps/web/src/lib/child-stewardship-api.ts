import { parseChildDemoSession, type ChildDemoSession, type ChildDraft, type ChildSyncTransport } from "./child-stewardship-offline";
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
export interface DraftAuthorizationProposal { draftId: string; purpose: "synthetic-learning-upload"; schemaVersion: string; policyVersion: string; currentVersion: number }
export interface DemoResult { id: string; status: string; syntheticOnly: true }
/** Explicit user-started synthetic session. Tokens are never identity or guardianship proof. */
export class ChildDemoApi {
  private tokens: Partial<Record<DemoRole, string>> = {};
  private assignmentId: string | undefined;
  private sessionId: string | undefined;
  private consentEpoch: number | undefined;
  private expiresAt: string | undefined;
  private packets = new Map<string, Record<string, unknown>>();
  private uploadAuthorizations = new Map<string, { token: string; digest: string }>();
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
    const data = response.data as { sessionId?: string; expiresAt?: string; tokens?: Partial<Record<DemoRole, string>> } | undefined;
    if (!data?.tokens || ["guardian", "child", "reviewer", "protector", "operator"].some(role => typeof data.tokens?.[role as DemoRole] !== "string")) throw new Error("SERVICE_UNAVAILABLE");
    if (typeof data.sessionId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.sessionId)) throw new Error("SERVICE_UNAVAILABLE");
    if (typeof data.expiresAt !== "string" || !Number.isFinite(Date.parse(data.expiresAt))) throw new Error("SESSION_INVALID");
    this.tokens = data.tokens; this.sessionId = data.sessionId; this.expiresAt = data.expiresAt;
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
  async suspend(localEpoch: number): Promise<ChildDemoSession> {
    if (!this.sessionId || !this.assignmentId || this.consentEpoch === undefined) throw new Error("SESSION_INVALID");
    const metadata = { schema: "CanopyProof-SyntheticResumeTicket/1", serverOrigin: this.baseUrl, sessionId: this.sessionId,
      profileId: this.profileId, assignmentId: this.assignmentId, consentEpoch: this.consentEpoch, localEpoch };
    try {
      const response = await this.request("/suspend", { method: "POST", headers: { ...this.headers("child"), "Content-Type": "application/json" }, body: "{}" });
      const data = response.data as { resumeTicket?: string; sessionId?: string; expiresAt?: string };
      if (data?.sessionId !== this.sessionId) throw new Error("SESSION_INVALID");
      return parseChildDemoSession({ ...metadata, resumeTicket: data.resumeTicket, expiresAt: data.expiresAt });
    } finally { this.close(); }
  }
  async cancelResume(input: ChildDemoSession): Promise<void> {
    const session = parseChildDemoSession(input);
    if (session.serverOrigin !== this.baseUrl || session.profileId !== this.profileId) throw new Error("SESSION_EXPIRED_OR_MISMATCHED");
    const response = await this.request("/cancel-resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeTicket: session.resumeTicket }) });
    const data = response.data as { cancelled?: boolean; syntheticOnly?: boolean };
    if (data?.cancelled !== true || data.syntheticOnly !== true) throw new Error("RECEIPT_INVALID");
  }
  async resume(input: ChildDemoSession, signal?: AbortSignal): Promise<void> {
    const session = parseChildDemoSession(input);
    if (session.serverOrigin !== this.baseUrl || session.profileId !== this.profileId || Date.parse(session.expiresAt) <= Date.now()) throw new Error("SESSION_EXPIRED_OR_MISMATCHED");
    const response = await this.request("/resume", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ resumeTicket: session.resumeTicket }) });
    const data = response.data as { sessionId?: string; expiresAt?: string; tokens?: Partial<Record<DemoRole, string>> };
    if (data?.sessionId !== session.sessionId || !data.tokens || ["guardian", "child", "reviewer", "protector", "operator"].some(role => typeof data.tokens?.[role as DemoRole] !== "string")) throw new Error("SESSION_INVALID");
    this.tokens = { ...data.tokens }; this.sessionId = session.sessionId; this.assignmentId = session.assignmentId;
    this.consentEpoch = session.consentEpoch; this.expiresAt = session.expiresAt;
    try {
      const view = await this.view("child", signal);
      const eligibility = view.uploadEligibility?.find(item => item.profileId === this.profileId);
      const assignment = view.assignments?.find(item => item.id === this.assignmentId && item.profileId === this.profileId);
      if (signal?.aborted || eligibility?.allowed !== true || eligibility.consentEpoch !== session.consentEpoch || assignment?.status !== "active") throw new Error("CONSENT_WITHDRAWN");
    } catch (error) { this.close(); throw error; }
  }
  async prepareDraft(input: ChildDraft, createdInCurrentPage = false, signal?: AbortSignal): Promise<ChildDraft> {
    const draft = this.bindDraft(input, createdInCurrentPage);
    if (draft.submissionVersion !== null) return draft;
    if (!input.serverBinding && !createdInCurrentPage) throw new Error("DRAFT_REAUTHORIZATION_REQUIRED");
    const view = await this.view("child", signal);
    this.assertDraftAuthority(draft, view, signal ?? new AbortController().signal);
    return { ...draft, submissionVersion: view.version };
  }
  bindDraft(draft: ChildDraft, createdInCurrentPage = false): ChildDraft {
    if ((draft.profile === "synthetic-a" ? "demo-profile-a" : "demo-profile-b") !== this.profileId) throw new Error("DRAFT_SCOPE_MISMATCH");
    if (draft.serverBinding) return draft;
    if (!createdInCurrentPage) throw new Error("DRAFT_REAUTHORIZATION_REQUIRED");
    if (!this.sessionId || !this.assignmentId || this.consentEpoch === undefined) throw new Error("SERVICE_UNAVAILABLE");
    return { ...draft, serverBinding: { sessionId: this.sessionId, profileId: this.profileId, consentEpoch: this.consentEpoch, assignmentId: this.assignmentId } };
  }
  private assertDraftAuthority(draft: ChildDraft, view: DemoLearningView, signal: AbortSignal): void {
    const binding = draft.serverBinding;
    const eligibility = view.uploadEligibility?.find(item => item.profileId === this.profileId);
    const assignment = view.assignments?.find(item => item.id === binding?.assignmentId && item.profileId === this.profileId);
    if ((draft.profile === "synthetic-a" ? "demo-profile-a" : "demo-profile-b") !== this.profileId || signal.aborted || !binding || binding.sessionId !== this.sessionId || binding.profileId !== this.profileId || binding.assignmentId !== this.assignmentId ||
      binding.consentEpoch !== this.consentEpoch || eligibility?.allowed !== true || eligibility.consentEpoch !== binding.consentEpoch || assignment?.status !== "active") throw new Error("CONSENT_WITHDRAWN");
  }
  private observationPacket(draft: ChildDraft): Record<string, unknown> {
    if (draft.submissionVersion === null || !draft.serverBinding) throw new Error("PERSISTED_INTENT_REQUIRED");
    return { type: "submit-observation", commandId: `demo-${draft.id}`, expectedVersion: draft.submissionVersion, assignmentId: draft.serverBinding.assignmentId,
      sampleId: draft.answer === "yellow_leaves" ? "demo-leaf-yellow" : "demo-leaf-green",
      answer: draft.answer === "green_leaves" ? "green" : draft.answer === "yellow_leaves" ? "yellow" : "uncertain", capturedAtClaimed: draft.createdAt };
  }
  private async intentDigest(draft: ChildDraft): Promise<string> {
    const packet = this.observationPacket(draft);
    const canonical = JSON.stringify(Object.fromEntries(Object.keys(packet).sort().map(key => [key, packet[key]])));
    return [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical)))].map(value => value.toString(16).padStart(2, "0")).join("");
  }
  async inspectDraftAuthorization(draft: ChildDraft): Promise<DraftAuthorizationProposal> {
    const view = await this.view(); this.assertDraftAuthority(draft, view, new AbortController().signal);
    return { draftId: draft.id, purpose: "synthetic-learning-upload", schemaVersion: draft.schema, policyVersion: view.policyVersion, currentVersion: view.version };
  }
  async authorizeDraft(draft: ChildDraft, proposal: DraftAuthorizationProposal, signal?: AbortSignal): Promise<void> {
    if (proposal.draftId !== draft.id || proposal.purpose !== "synthetic-learning-upload" || proposal.schemaVersion !== draft.schema) throw new Error("DRAFT_SCOPE_MISMATCH");
    const view = await this.view("child", signal); this.assertDraftAuthority(draft, view, signal ?? new AbortController().signal);
    if (view.version !== proposal.currentVersion || view.policyVersion !== proposal.policyVersion) throw new Error("VERSION_CONFLICT");
    const digest = await this.intentDigest(draft);
    if (signal?.aborted) throw new Error("CONSENT_WITHDRAWN");
    const response = await this.request("/draft-authorizations", { method: "POST", headers: { ...this.headers("child"), "Content-Type": "application/json" },
      body: JSON.stringify({ draftId: draft.id, intentDigest: digest, assignmentId: draft.serverBinding!.assignmentId,
        originalSessionId: draft.serverBinding!.sessionId, originalConsentEpoch: draft.serverBinding!.consentEpoch,
        purpose: proposal.purpose, schemaVersion: proposal.schemaVersion, policyVersion: proposal.policyVersion, expectedVersion: proposal.currentVersion }), ...(signal ? { signal } : {}) });
    const data = response.data as { authorizationToken?: string; syntheticOnly?: boolean };
    if (data?.syntheticOnly !== true || typeof data.authorizationToken !== "string" || !/^cp-upload\.[A-Za-z0-9_-]{43}$/.test(data.authorizationToken)) throw new Error("RECEIPT_INVALID");
    if (signal?.aborted) throw new Error("CONSENT_WITHDRAWN");
    this.uploadAuthorizations.set(draft.id, { token: data.authorizationToken, digest });
  }
  clearUploadAuthorizations(): void { this.uploadAuthorizations.clear(); }
  transport(boundDraft: ChildDraft): ChildSyncTransport {
    return {
      prepare: async signal => {
        if (!this.uploadAuthorizations.has(boundDraft.id)) throw new Error("CURRENT_DRAFT_AUTHORIZATION_REQUIRED");
        const view = await this.view("child", signal);
        this.assertDraftAuthority(boundDraft, view, signal);
        return { synthetic: true, allowed: true };
      },
      send: async (draft: ChildDraft, signal: AbortSignal) => {
        // Refresh after any pending request, then enforce the exact scope and epoch before POST.
        const view = await this.view("child", signal);
        this.assertDraftAuthority(draft, view, signal);
        const authorization = this.uploadAuthorizations.get(draft.id);
        if (!authorization || authorization.digest !== await this.intentDigest(draft)) throw new Error("CURRENT_DRAFT_AUTHORIZATION_REQUIRED");
        const fresh = await this.view("child", signal); this.assertDraftAuthority(draft, fresh, signal);
        const packet = this.observationPacket(draft); const commandId = `demo-${draft.id}`;
        // No awaited work between the current-state check and the first draft byte.
        const response = await this.request("/commands", { method: "POST", headers: { ...this.headers("child"), "X-Child-Upload-Authorization": authorization.token, "Content-Type": "application/json", "Idempotency-Key": commandId, "If-Match": String(packet.expectedVersion) }, body: JSON.stringify(packet), signal });
        const result = response.data as DemoResult | undefined;
        if (!result || result.syntheticOnly !== true || typeof result.id !== "string" || typeof result.status !== "string") throw new Error("RECEIPT_INVALID");
        return { draftId: draft.id, receiptId: result.id, status: "received", synthetic: true };
      },
    };
  }
  async privacyStatus(id: string): Promise<{ kind: string; state: string; retentionNotice: string; export?: unknown }> {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new Error("REQUEST_INVALID");
    const response = await this.request(`/privacy/requests/${id}`, { headers: this.headers("guardian") });
    const data = response.data as { kind: string; state: string; retentionNotice: string; export?: unknown };
    if (!data || typeof data.state !== "string" || typeof data.retentionNotice !== "string") throw new Error("RECEIPT_INVALID");
    return data;
  }
  async withdraw(): Promise<void> {
    for (const purpose of ["upload", "learning"]) await this.command("child", { type: "set-assent", profileId: this.profileId, purpose, willing: false });
  }
  close(): void { this.tokens = {}; this.assignmentId = undefined; this.sessionId = undefined; this.consentEpoch = undefined; this.expiresAt = undefined; this.packets.clear(); this.uploadAuthorizations.clear(); }
}
