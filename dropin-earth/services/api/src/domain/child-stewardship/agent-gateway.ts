import { createHash } from "node:crypto";
import type { KeyObject } from "node:crypto";
import { verifyChildSignatureBytes } from "./signature.js";
import { authorizeLearningInteraction, ChildLearningError } from "./learning.js";
import type { LearningPrincipal, LearningState } from "./learning-types.js";

/** This is a product adapter, NOT an official AHIN wire format or live model. */
export const CHILD_AGENT_PROTOCOL = "CanopyProof-Child-Agent/0.1-proposal";
export const CHILD_AGENT_VERBS = ["ASSERT", "REASON", "DELEGATE", "FULFILL", "CHALLENGE"] as const;
type AgentVerb = typeof CHILD_AGENT_VERBS[number];
export type ChildAgentEnvelope = {
  protocol: typeof CHILD_AGENT_PROTOCOL; environment: "synthetic-demo";
  eventId: string; verb: AgentVerb; actorId: string; deviceId: string; epoch: number;
  taskId: string; consentVersion: number; evidenceIds: string[]; delegationId: string | null;
  policyVersion: string; issuedAt: string; expiresAt: string; nonce: string;
  question: "last_record" | "what_is_unknown" | "safe_next_step";
};
export type ChildAgentCredential = {
  keyId: string; actorId: string; epoch: number; publicKey: KeyObject | string;
  revoked: boolean; expiresAt: string;
};
export type ChildAgentDelegation = {
  id: string; parentId: string | null; issuerActorId: string; delegateActorId: string;
  verbs: AgentVerb[]; taskIds: string[]; expiresAt: string; revoked: boolean;
  epoch: number; allowRedelegation: boolean;
};
export type ChildAgentApproval = { keyId: string; algorithm: string; signature: Uint8Array; signedPayload: Uint8Array };
const required = ["protocol", "environment", "eventId", "verb", "actorId", "deviceId", "epoch", "taskId", "consentVersion",
  "evidenceIds", "delegationId", "policyVersion", "issuedAt", "expiresAt", "nonce", "question"].sort();
const id = (value: unknown): value is string => typeof value === "string" && /^demo-[a-z0-9-]{1,72}$/.test(value);
function reject(code: string): never { throw new ChildLearningError(code); }
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map(key => `${JSON.stringify(key)}:${canonical(object[key])}`).join(",")}}`;
}
export function canonicalChildAgentEnvelope(envelope: ChildAgentEnvelope): Uint8Array {
  return Buffer.from(canonical(envelope), "utf8");
}
export function validateEnvelope(value: unknown, now: string): ChildAgentEnvelope {
  if (!value || typeof value !== "object" || Array.isArray(value)) reject("PROTOCOL_UNSUPPORTED");
  const raw = value as Record<string, unknown>;
  if (JSON.stringify(Object.keys(raw).sort()) !== JSON.stringify(required)
    || raw.protocol !== CHILD_AGENT_PROTOCOL || raw.environment !== "synthetic-demo"
    || !CHILD_AGENT_VERBS.includes(raw.verb as AgentVerb)
    || !["last_record", "what_is_unknown", "safe_next_step"].includes(raw.question as string)) reject("PROTOCOL_UNSUPPORTED");
  for (const name of ["eventId", "actorId", "deviceId", "taskId", "nonce"]) if (!id(raw[name])) reject("INVALID_REFERENCE");
  if (!Array.isArray(raw.evidenceIds) || raw.evidenceIds.length > 10 || !raw.evidenceIds.every(id)
    || new Set(raw.evidenceIds).size !== raw.evidenceIds.length
    || raw.delegationId !== null && !id(raw.delegationId)
    || !Number.isSafeInteger(raw.epoch) || !Number.isSafeInteger(raw.consentVersion)
    || typeof raw.policyVersion !== "string") reject("INVALID_ENVELOPE");
  const issued = typeof raw.issuedAt === "string" ? Date.parse(raw.issuedAt) : NaN;
  const expiry = typeof raw.expiresAt === "string" ? Date.parse(raw.expiresAt) : NaN;
  const current = Date.parse(now);
  if (![issued, expiry, current].every(Number.isFinite) || issued > current || expiry <= current
    || expiry <= issued || expiry - issued > 300_000) reject("ENVELOPE_EXPIRED");
  return raw as ChildAgentEnvelope;
}
export function verifyProvenance(envelope: ChildAgentEnvelope, approval: ChildAgentApproval,
  credentials: Readonly<Record<string, ChildAgentCredential>>, state: LearningState, now: string): void {
  const credential = credentials[approval.keyId];
  const actor = state.actors[envelope.actorId];
  if (!credential || credential.revoked || credential.actorId !== envelope.actorId || credential.epoch !== envelope.epoch
    || !actor || actor.revoked || actor.epoch !== envelope.epoch || !Number.isFinite(Date.parse(credential.expiresAt)) || Date.parse(credential.expiresAt) <= Date.parse(now)) reject("SIGNER_REVOKED");
  const verification = verifyChildSignatureBytes({ algorithm: approval.algorithm,
    expectedPayload: canonicalChildAgentEnvelope(envelope), signedPayload: approval.signedPayload,
    signature: approval.signature, registeredPublicKey: credential.publicKey });
  if (!verification.valid) reject("INVALID_SIGNATURE");
}
export function verifyDelegation(envelope: ChildAgentEnvelope, registry: Readonly<Record<string, ChildAgentDelegation>>, now: string, state: LearningState): void {
  if (envelope.delegationId === null) return;
  const seen = new Set<string>();
  let child: ChildAgentDelegation | undefined;
  let current: string | null = envelope.delegationId;
  while (current !== null) {
    if (seen.has(current) || seen.size >= 8) reject("DELEGATION_REVOKED");
    seen.add(current);
    const entry: ChildAgentDelegation | undefined = registry[current];
    if (!entry || entry.revoked || !Number.isFinite(Date.parse(entry.expiresAt)) || Date.parse(entry.expiresAt) <= Date.parse(now)
      || !entry.verbs.includes(envelope.verb) || !entry.taskIds.includes(envelope.taskId)) reject("DELEGATION_REVOKED");
    const issuer = state.actors[entry.issuerActorId];
    if (!issuer || issuer.revoked || issuer.epoch !== entry.epoch || !["guardian", "child"].includes(issuer.role)
      || !Number.isFinite(Date.parse(issuer.expiresAt)) || Date.parse(issuer.expiresAt) <= Date.parse(now)) reject("DELEGATION_REVOKED");
    if (!child && entry.delegateActorId !== envelope.actorId) reject("DELEGATION_SCOPE_REJECTED");
    if (child && (!entry.allowRedelegation || child.issuerActorId !== entry.delegateActorId
      || Date.parse(child.expiresAt) > Date.parse(entry.expiresAt)
      || child.verbs.some(verb => !entry.verbs.includes(verb))
      || child.taskIds.some(taskId => !entry.taskIds.includes(taskId)))) reject("DELEGATION_SCOPE_REJECTED");
    child = entry;
    current = entry.parentId;
  }
}
export function revokeDelegation(registry: Readonly<Record<string, ChildAgentDelegation>>, delegationId: string,
  actorId: string): Record<string, ChildAgentDelegation> {
  const entry = registry[delegationId];
  if (!entry || entry.issuerActorId !== actorId) reject("NOT_AUTHORIZED");
  return { ...registry, [delegationId]: { ...entry, revoked: true } };
}
export function resolveEvidence(envelope: ChildAgentEnvelope, state: LearningState) {
  return envelope.evidenceIds.map(evidenceId => {
    const observation = state.observations[evidenceId];
    const assignment = observation ? state.assignments[observation.assignmentId] : undefined;
    const profile = assignment ? state.profiles[assignment.profileId] : undefined;
    if (!observation || !assignment || assignment.taskId !== envelope.taskId || !profile
      || ![profile.actorId, profile.guardianActorId].includes(envelope.actorId)) reject("NOT_AUTHORIZED");
    return { id: observation.id, observedAtClaimed: observation.capturedAtClaimed, receivedAt: observation.receivedAt,
      evidenceLevel: observation.evidenceLevel, sourceType: observation.sourceType, captureTimeVerified: false };
  });
}
export function getCapabilities() {
  return { protocol: CHILD_AGENT_PROTOCOL, mode: "approved_static_content" as const, verbs: CHILD_AGENT_VERBS,
    pocc: "unsupported", chainRank: "unsupported", modelInference: false, finalAuthority: false,
    ledgerWrites: false, walletCalls: false, arbitraryTools: false };
}
export function mapToDomainEvent(envelope: ChildAgentEnvelope) {
  return { id: envelope.eventId, action: envelope.verb, taskId: envelope.taskId,
    payloadDigest: createHash("sha256").update(canonicalChildAgentEnvelope(envelope)).digest("hex"),
    proposedOnly: true, finalAuthority: false, policyVersion: envelope.policyVersion };
}
/** Nonces must be checked and persisted in the same transaction by the server caller. */
export function answerChildAgent(input: unknown, approval: ChildAgentApproval, context: {
  state: LearningState; credentials: Readonly<Record<string, ChildAgentCredential>>;
  delegations: Readonly<Record<string, ChildAgentDelegation>>; usedNonces: readonly string[]; now: string;
}) {
  const envelope = validateEnvelope(input, context.now);
  if (context.usedNonces.includes(`${envelope.actorId}:${envelope.nonce}`)) reject("NONCE_REPLAY");
  const principal: LearningPrincipal = { actorId: envelope.actorId, deviceId: envelope.deviceId, epoch: envelope.epoch };
  authorizeLearningInteraction(context.state, principal, envelope.taskId, context.now);
  if (context.state.policyVersion !== envelope.policyVersion) reject("POLICY_CHANGED");
  const profile = Object.values(context.state.profiles).find(item => item.actorId === envelope.actorId || item.guardianActorId === envelope.actorId);
  const consent = profile ? context.state.consents[`${profile.id}:learning`] : undefined;
  if (!consent || consent.version !== envelope.consentVersion) reject("CONSENT_CHANGED");
  verifyProvenance(envelope, approval, context.credentials, context.state, context.now);
  verifyDelegation(envelope, context.delegations, context.now, context.state);
  const evidence = resolveEvidence(envelope, context.state);
  const answers = {
    last_record: "These are synthetic learning records. They cannot tell us whether a real tree is alive now.",
    what_is_unknown: "We do not have current field evidence. Not knowing is an honest answer, and it is not your fault.",
    safe_next_step: "You can compare the sample leaves indoors, ask a trusted adult, or stop here today.",
  };
  return { event: mapToDomainEvent(envelope), consumeNonce: `${envelope.actorId}:${envelope.nonce}`,
    answer: answers[envelope.question], source: "approved-static-learning-v1", evidence,
    identity: "AI explainer — static demonstration", finalAuthority: false, syntheticOnly: true,
    limitations: ["not_live_model", "not_field_evidence", "not_carbon_verification"] };
}
