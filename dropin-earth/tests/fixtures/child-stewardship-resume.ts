/** TEST ONLY. In-memory browser/client fixture; never native PostgreSQL acceptance or runtime fallback. */
import { randomBytes } from "node:crypto";
import { ChildApiError, childDigest, createDemoTokens, TestChildStore, tokenDigest, type ChildTransaction } from "../../services/api/src/domain/child-stewardship/store.ts";
import { readChildLearningView } from "../../services/api/src/domain/child-stewardship/learning.ts";
import type { ChildResumeStore, ChildSuspension, ChildResumption } from "../../services/api/src/domain/child-stewardship/resume-store.ts";
export class TestChildResumeStore extends TestChildStore implements ChildResumeStore {
  constructor(private readonly now = () => new Date().toISOString()) { super(); }
  private uploadGrants = new Map<string, { sessionId: string; generation: number; actorId: string; digest: string; draftId: string; consentEpoch: number; profileId: string; expiresAt: number; used: boolean }>();
  private generations = new Map<string, number>();
  private suspended = new Set<string>();
  private tickets = new Map<string, { sessionId: string; authority: string }>();
  private gate: Promise<unknown> = Promise.resolve();
  private locked<T>(run: () => Promise<T>): Promise<T> {
    const work = this.gate.then(run); this.gate = work.catch(() => undefined); return work;
  }
  private authority(sessionId: string): string {
    const session = this.sessions.get(sessionId);
    if (!session || Date.parse(session.expiresAt) <= Date.parse(this.now())) throw new ChildApiError("UNAUTHORIZED", 401);
    const view = readChildLearningView(session.snapshot.learning, { actorId: "demo-child", deviceId: "demo-device-child", epoch: 1 }, this.now());
    if (!view.uploadAllowed) throw new ChildApiError("CONSENT_REQUIRED", 403);
    return JSON.stringify({ uploadEligibility: view.uploadEligibility, assignments: view.assignments });
  }
  override async resolveToken(hash: string, now: string) {
    const result = await super.resolveToken(hash, now);
    return result && !this.suspended.has(result.sessionId) ? { ...result, principal: { ...result.principal, sessionGeneration: this.generations.get(result.sessionId) ?? 0 } } : null;
  }
  override async transact<T>(sessionId: string, now: string, run: (tx: ChildTransaction) => T): Promise<T> {
    return this.locked(async () => {
      if (this.suspended.has(sessionId)) throw new ChildApiError("UNAUTHORIZED", 401);
      return super.transact(sessionId, now, tx => {
        tx.sessionGeneration = this.generations.get(sessionId) ?? 0;
        const before = structuredClone(tx.snapshot.learning); const previousReceipts = structuredClone(tx.receipts); const result = run(tx);
        const admission = (tx as ChildTransaction & { draftAuthorization?: { proof: string; command: unknown; actorId: string } }).draftAuthorization;
        if (admission) {
          const grant = this.uploadGrants.get(tokenDigest(admission.proof));
          const eligibility = readChildLearningView(before, { actorId: admission.actorId, deviceId: "demo-device-child", epoch: 1 }, now).uploadEligibility.find(item => item.profileId === grant?.profileId);
          const exactReplay = previousReceipts.some(receipt => receipt.key === (admission.command as { commandId?: string }).commandId && receipt.actorId === admission.actorId && receipt.digest === childDigest({ path: "/commands", body: admission.command }));
          if (!grant || grant.used && !exactReplay || grant.expiresAt <= Date.parse(now) || grant.sessionId !== sessionId || grant.generation !== tx.sessionGeneration || grant.actorId !== admission.actorId || grant.digest !== childDigest(admission.command) || (admission.command as { commandId?: string }).commandId !== `demo-${grant.draftId}` || !eligibility?.allowed || eligibility.consentEpoch !== grant.consentEpoch) throw new ChildApiError("CURRENT_DRAFT_AUTHORIZATION_REQUIRED", 403);
          grant.used = true;
        }
        return result;
      });
    });
  }
  async issueDraftAuthorization(rawBearer: string, input: unknown): Promise<string> {
    return this.locked(async () => {
      const identity = await this.resolveToken(tokenDigest(rawBearer), this.now());
      if (!identity || identity.principal.actorId !== "demo-child" || !input || typeof input !== "object" || Array.isArray(input)) throw new ChildApiError("UNAUTHORIZED", 401);
      const proposal = input as Record<string, unknown>;
      const session = this.sessions.get(identity.sessionId)!; const view = readChildLearningView(session.snapshot.learning, identity.principal, this.now());
      if (Object.keys(proposal).sort().join(",") !== "assignmentId,draftId,expectedVersion,intentDigest,originalConsentEpoch,originalSessionId,policyVersion,purpose,schemaVersion" || typeof proposal.draftId !== "string" || !/^[a-zA-Z0-9_-]{1,100}$/.test(proposal.draftId) || typeof proposal.intentDigest !== "string" || !/^[a-f0-9]{64}$/.test(proposal.intentDigest) || proposal.originalSessionId !== identity.sessionId || proposal.purpose !== "synthetic-learning-upload" || proposal.schemaVersion !== "CanopyProof-SyntheticDraft/2" || proposal.policyVersion !== view.policyVersion || proposal.expectedVersion !== view.version) throw new ChildApiError("INVALID_INPUT", 400);
      const assignment = view.assignments.find(item => item.id === proposal.assignmentId);
      const eligibility = view.uploadEligibility.find(item => item.profileId === assignment?.profileId);
      if (!assignment || assignment.status !== "active" || !eligibility?.allowed || eligibility.consentEpoch !== proposal.originalConsentEpoch) throw new ChildApiError("CONSENT_REQUIRED", 403);
      const authorizationToken = `cp-upload.${randomBytes(32).toString("base64url")}`;
      this.uploadGrants.set(tokenDigest(authorizationToken), { sessionId: identity.sessionId, generation: this.generations.get(identity.sessionId) ?? 0, actorId: identity.principal.actorId, digest: String(proposal.intentDigest), draftId: String(proposal.draftId), consentEpoch: eligibility.consentEpoch, profileId: eligibility.profileId, expiresAt: Date.parse(this.now()) + 300_000, used: false });
      return authorizationToken;
    });
  }
  async suspend(rawBearer: string): Promise<ChildSuspension> {
    return this.locked(async () => {
      const identity = await this.resolveToken(tokenDigest(rawBearer), this.now());
      if (!identity || identity.principal.actorId !== "demo-child") throw new ChildApiError("UNAUTHORIZED", 401);
      const authority = this.authority(identity.sessionId); const session = this.sessions.get(identity.sessionId)!;
      for (const [key, token] of this.tokens) if (token.sessionId === session.id) this.tokens.delete(key);
      this.suspended.add(session.id); this.generations.set(session.id, (this.generations.get(session.id) ?? 0) + 1);
      const resumeTicket = `cp-resume.${randomBytes(32).toString("base64url")}`;
      this.tickets.set(tokenDigest(resumeTicket), { sessionId: session.id, authority });
      return { resumeTicket, sessionId: session.id, expiresAt: session.expiresAt, syntheticOnly: true };
    });
  }
  async cancel(rawTicket: string): Promise<{ cancelled: true; syntheticOnly: true }> {
    return this.locked(async () => { this.tickets.delete(tokenDigest(rawTicket)); return { cancelled: true, syntheticOnly: true }; });
  }
  async resume(rawTicket: string): Promise<ChildResumption> {
    return this.locked(async () => {
      const hash = tokenDigest(rawTicket); const ticket = this.tickets.get(hash); this.tickets.delete(hash);
      if (!ticket || !this.suspended.has(ticket.sessionId)) throw new ChildApiError("UNAUTHORIZED", 401);
      if (this.authority(ticket.sessionId) !== ticket.authority) throw new ChildApiError("CONSENT_REQUIRED", 403);
      const session = this.sessions.get(ticket.sessionId)!; const tokens = createDemoTokens(session.id);
      for (const record of tokens.records) this.tokens.set(record.hash, record);
      this.suspended.delete(session.id);
      return { sessionId: session.id, expiresAt: session.expiresAt, tokens: tokens.publicTokens, syntheticOnly: true, identityVerified: false };
    });
  }
}
