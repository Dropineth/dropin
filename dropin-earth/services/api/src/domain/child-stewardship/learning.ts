import { createHash } from "node:crypto";
import type {
  AgeBand, ChildLearningProfile, LearningActor, LearningAuditEvent, LearningCommand,
  LearningConsent, LearningPrincipal, LearningPurpose, LearningResult, LearningRole,
  LearningState, LearningTransition,
} from "./learning-types.js";

export class ChildLearningError extends Error {
  readonly code: string;
  readonly status: number;
  readonly safeMessage: string;
  constructor(code: string, status = 403) {
    super(code);
    this.name = "ChildLearningError";
    this.code = code;
    this.status = status;
    this.safeMessage = "This action is unavailable. Your existing learning records are unchanged.";
  }
}
function fail(code: string, status = 403): never { throw new ChildLearningError(code, status); }
const epochTime = (value: string): number => {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) fail("INVALID_TIME", 400);
  return parsed;
};
const digest = (value: unknown): string => createHash("sha256").update(canonical(value)).digest("hex");
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(",")}}`;
}
const syntheticId = (value: unknown): value is string => typeof value === "string" && /^demo-[a-z0-9-]{1,72}$/.test(value);
const purposes: readonly LearningPurpose[] = ["learning", "upload", "sharing"];
const roles: readonly LearningRole[] = ["guardian", "child", "reviewer", "protector", "operator"];
const fields: Record<LearningCommand["type"], readonly string[]> = {
  "create-profile": ["profileId", "ageBand", "locale", "nickname"],
  "grant-consent": ["profileId", "purpose", "policyVersion"],
  "set-assent": ["profileId", "purpose", "willing"],
  "withdraw-consent": ["profileId", "purpose"],
  "assign-task": ["profileId", "taskId"],
  "submit-observation": ["assignmentId", "sampleId", "answer", "capturedAtClaimed"],
  "review-observation": ["observationId", "decision", "reason"],
  "grant-contribution": ["observationId", "policyVersion"],
  "correct-contribution": ["contributionId", "reason"],
  "open-dispute": ["profileId", "targetId", "reason"],
  "resolve-dispute": ["disputeId", "resolution"],
  "request-privacy": ["profileId", "kind"],
  "rebind-participant": ["profileId", "newParticipantRef"],
  "revoke-device": ["actorId", "deviceId"],
  "replace-tree": ["treeId", "newTreeId"],
  "mark-tree-identity-uncertain": ["treeId"],
};
const enumFields: Record<string, readonly unknown[]> = {
  ageBand: ["6-8", "9-12", "13-17"], locale: ["zh-CN", "en"], nickname: ["leaf", "acorn", "sprout"],
  purpose: purposes, willing: [true, false], sampleId: ["demo-leaf-green", "demo-leaf-yellow"],
  answer: ["green", "yellow", "uncertain"],
  decision: ["insufficient_for_survival", "learning_observation_accepted", "needs_more_information"],
  resolution: ["corrected", "maintained", "unknown"], kind: ["delete_learning", "export_learning"],
};
function parseCommand(input: unknown): LearningCommand {
  if (!input || typeof input !== "object" || Array.isArray(input)) fail("INVALID_COMMAND", 400);
  const candidate = input as Record<string, unknown>;
  if (typeof candidate.type !== "string" || !Object.hasOwn(fields, candidate.type)) fail("UNSUPPORTED_COMMAND", 400);
  const allowed = ["type", "commandId", "expectedVersion", ...fields[candidate.type as LearningCommand["type"]]];
  if (Object.keys(candidate).length !== allowed.length || Object.keys(candidate).some(key => !allowed.includes(key))) fail("UNEXPECTED_FIELD", 400);
  if (!syntheticId(candidate.commandId) || !Number.isSafeInteger(candidate.expectedVersion) || Number(candidate.expectedVersion) < 0) fail("INVALID_COMMAND", 400);
  for (const name of fields[candidate.type as LearningCommand["type"]]) {
    const value = candidate[name];
    if (enumFields[name]) {
      if (!enumFields[name].includes(value)) fail("INVALID_FIELD", 400);
    } else if (name.endsWith("Id") || name.endsWith("Ref")) {
      if (!syntheticId(value)) fail("INVALID_REFERENCE", 400);
    } else if (name === "capturedAtClaimed") {
      if (typeof value !== "string") fail("INVALID_TIME", 400);
      epochTime(value as string);
    } else if (name === "policyVersion") {
      if (typeof value !== "string" || !/^child-learning-demo-v[1-9][0-9]{0,3}$/.test(value)) fail("INVALID_POLICY", 400);
    } else if (name === "reason") {
      const reasons = candidate.type === "open-dispute"
        ? ["wrong_tree", "wrong_time", "do_not_share", "not_understood", "unsafe_adult"]
        : candidate.type === "correct-contribution" ? ["record_corrected"]
          : ["synthetic_source", "time_unverified", "identity_uncertain", "conflicting_observation"];
      if (!reasons.includes(value as string)) fail("INVALID_REASON", 400);
    }
  }
  return candidate as LearningCommand;
}

export function createSyntheticLearningState(now = "2026-10-23T00:00:00Z"): LearningState {
  epochTime(now);
  const expiresAt = new Date(epochTime(now) + 30 * 86_400_000).toISOString();
  const actors = Object.fromEntries(roles.map(role => [`demo-${role}`, {
    id: `demo-${role}`, role, controlDomain: `demo-domain-${role}`, epoch: 1, revoked: false,
    deviceIds: [`demo-device-${role}`], expiresAt,
  }]));
  return {
    schemaVersion: 1, mode: "synthetic-demo", version: 0, policyVersion: "child-learning-demo-v1",
    agePolicy: { version: "demo-age-policy-v1", jurisdiction: "SYNTHETIC", realRegistrationEnabled: false, ageBands: ["6-8", "9-12", "13-17"] },
    actors, profiles: {}, guardianLinks: {}, consents: {},
    trees: { "demo-tree-oak": { id: "demo-tree-oak", slotId: "demo-slot-one", sourceRef: "demo-authored-reference",
      coarseRegion: "synthetic-learning-garden", identity: "confirmed", state: "registered", replacesTreeId: null, tagVersion: 1, archived: false } },
    tasks: { "demo-task-leaf-comparison": { id: "demo-task-leaf-comparison", treeId: "demo-tree-oak", templateVersion: "demo-task-v1",
      activityInstance: "demo-activity-leaf-comparison", mode: "remote", risk: "low", approvedBy: "demo-operator",
      method: "synthetic-leaf-comparison-v1", opensAt: now, closesAt: expiresAt, cancelled: false, ageBands: ["6-8", "9-12", "13-17"] } },
    assignments: {}, observations: {}, reviews: {}, assessments: {}, contributions: [], disputes: {}, aliases: {},
    audit: [], outbox: [], privacyRequests: {}, idempotency: {},
  };
}

function authenticate(state: LearningState, principal: LearningPrincipal, now: string): LearningActor {
  if (state.mode !== "synthetic-demo" || state.agePolicy.realRegistrationEnabled !== false) fail("MODE_DISABLED", 503);
  if (!principal || !syntheticId(principal.actorId) || !syntheticId(principal.deviceId) || !Number.isSafeInteger(principal.epoch)) fail("AUTH_REQUIRED", 401);
  const actor = state.actors[principal.actorId];
  if (!actor || actor.revoked || actor.epoch !== principal.epoch || !actor.deviceIds.includes(principal.deviceId)
    || epochTime(actor.expiresAt) <= epochTime(now)) fail("AUTH_REVOKED", 401);
  return actor;
}
function requireRole(actor: LearningActor, permitted: readonly LearningRole[]): void {
  if (!permitted.includes(actor.role)) fail("NOT_AUTHORIZED");
}
function scopedProfile(state: LearningState, id: string, actor: LearningActor): ChildLearningProfile {
  const profile = state.profiles[id];
  if (!profile || ![profile.guardianActorId, profile.actorId].includes(actor.id)) fail("NOT_AUTHORIZED");
  return profile;
}
const consentKey = (profileId: string, purpose: LearningPurpose): string => `${profileId}:${purpose}`;
function activeConsent(state: LearningState, profile: ChildLearningProfile, purpose: LearningPurpose, now: string): LearningConsent {
  const link = state.guardianLinks[profile.id];
  const consent = state.consents[consentKey(profile.id, purpose)];
  const guardian = state.actors[profile.guardianActorId];
  if (!link || !guardian || guardian.revoked || epochTime(guardian.expiresAt) <= epochTime(now)
    || epochTime(link.expiresAt) <= epochTime(now)) fail("GUARDIAN_LINK_REQUIRED");
  if (!consent || !consent.guardianGranted || !consent.childAssent) fail("CONSENT_REQUIRED");
  if (consent.withdrawnAt) fail("CONSENT_WITHDRAWN");
  if (consent.policyVersion !== state.policyVersion || consent.guardianLinkVersion !== link.version) fail("POLICY_CHANGED", 409);
  if (epochTime(consent.expiresAt) <= epochTime(now)) fail("CONSENT_EXPIRED");
  if (profile.status !== "active") fail("PARTICIPATION_PAUSED");
  return consent;
}
function applicableAssignment(state: LearningState, assignmentId: string, actor: LearningActor, now: string) {
  const assignment = state.assignments[assignmentId];
  if (!assignment) fail("NOT_AUTHORIZED");
  const profile = scopedProfile(state, assignment.profileId, actor);
  const task = state.tasks[assignment.taskId];
  if (!task || task.cancelled || assignment.status !== "active" || epochTime(task.closesAt) <= epochTime(now)) fail("TASK_EXPIRED");
  if (epochTime(task.opensAt) > epochTime(now) || task.templateVersion !== assignment.taskVersion) fail("TASK_CHANGED", 409);
  if (!state.agePolicy.ageBands.includes(profile.ageBand) || !task.ageBands.includes(profile.ageBand)) fail("AGE_POLICY_REJECTED");
  activeConsent(state, profile, "learning", now);
  const consent = activeConsent(state, profile, "upload", now);
  if (consent.version !== assignment.consentVersion) fail("CONSENT_CHANGED", 409);
  return { assignment, profile, task };
}

export function authorizeLearningInteraction(state: LearningState, principal: LearningPrincipal, taskId: string, now: string): void {
  const actor = authenticate(state, principal, now);
  requireRole(actor, ["child", "guardian"]);
  const profile = Object.values(state.profiles).find(item => item.actorId === actor.id || item.guardianActorId === actor.id);
  const task = state.tasks[taskId];
  if (!profile || !task || task.cancelled || !task.ageBands.includes(profile.ageBand)
    || epochTime(task.opensAt) > epochTime(now) || epochTime(task.closesAt) <= epochTime(now)) fail("TASK_UNAVAILABLE");
  activeConsent(state, profile, "learning", now);
}

/** No I/O. A caller must commit the returned state, audit, and outbox in one transaction. */
export function executeLearningCommand(original: LearningState, input: unknown, principal: LearningPrincipal, now: string): LearningTransition {
  epochTime(now);
  const actor = authenticate(original, principal, now);
  const command = parseCommand(input);
  const commandDigest = digest(command);
  const idempotencyKey = `${actor.id}:${command.commandId}`;
  const previous = original.idempotency[idempotencyKey];
  if (previous) {
    if (previous.digest !== commandDigest) fail("IDEMPOTENCY_CONFLICT", 409);
    return { state: original, result: { ...previous.result, duplicate: true }, events: [], outbox: [] };
  }
  if (command.expectedVersion !== original.version) fail("VERSION_CONFLICT", 409);
  const state = structuredClone(original);
  const outboxStart = state.outbox.length;
  const id = `demo-${command.type}-${command.commandId.slice(5)}`;
  let result: LearningResult = { id, status: "recorded", syntheticOnly: true };
  let audience: LearningAuditEvent["audience"] = "ordinary";

  switch (command.type) {
    case "create-profile": {
      requireRole(actor, ["guardian"]);
      if (!state.agePolicy.ageBands.includes(command.ageBand as AgeBand)) fail("AGE_POLICY_REJECTED");
      if (state.profiles[command.profileId] || Object.keys(state.profiles).length !== 0) fail("PROFILE_ALREADY_EXISTS", 409);
      state.profiles[command.profileId] = { id: command.profileId, participantRef: `demo-participant-${command.profileId.slice(5)}`,
        canonicalParticipantRef: `demo-canonical-${command.profileId.slice(5)}`, actorId: "demo-child", guardianActorId: actor.id,
        ageBand: command.ageBand, locale: command.locale, nickname: command.nickname, status: "active" };
      state.aliases[`demo-participant-${command.profileId.slice(5)}`] = `demo-canonical-${command.profileId.slice(5)}`;
      state.guardianLinks[command.profileId] = { guardianActorId: actor.id, profileId: command.profileId, version: 1,
        expiresAt: actor.expiresAt, syntheticOnly: true };
      result = { id: command.profileId, status: "synthetic_profile_created", syntheticOnly: true };
      break;
    }
    case "grant-consent": {
      requireRole(actor, ["guardian"]);
      const profile = scopedProfile(state, command.profileId, actor);
      const link = state.guardianLinks[profile.id];
      if (!link || epochTime(link.expiresAt) <= epochTime(now)) fail("GUARDIAN_LINK_REQUIRED");
      if (command.policyVersion !== state.policyVersion) fail("POLICY_CHANGED", 409);
      const key = consentKey(profile.id, command.purpose);
      const old = state.consents[key];
      state.consents[key] = { id, profileId: profile.id, purpose: command.purpose, policyVersion: state.policyVersion,
        guardianLinkVersion: link.version, guardianGranted: true, childAssent: false, version: (old?.version ?? 0) + 1,
        expiresAt: link.expiresAt, withdrawnAt: null };
      result.status = "awaiting_child_assent";
      break;
    }
    case "set-assent": {
      requireRole(actor, ["child"]);
      const profile = scopedProfile(state, command.profileId, actor);
      const consent = state.consents[consentKey(profile.id, command.purpose)];
      if (!consent || consent.withdrawnAt || consent.policyVersion !== state.policyVersion) fail("CONSENT_REQUIRED");
      consent.childAssent = command.willing;
      consent.version += 1;
      if (!command.willing) {
        consent.withdrawnAt = now;
        state.outbox.push({ id, kind: "consent_revoked", resourceId: profile.id, epoch: consent.version, audience });
      }
      result.status = command.willing ? "assent_recorded" : "participation_stopped";
      break;
    }
    case "withdraw-consent": {
      requireRole(actor, ["guardian", "child"]);
      const profile = scopedProfile(state, command.profileId, actor);
      const consent = state.consents[consentKey(profile.id, command.purpose)];
      if (!consent) fail("CONSENT_REQUIRED");
      consent.withdrawnAt = now;
      consent.guardianGranted = false;
      consent.childAssent = false;
      consent.version += 1;
      state.outbox.push({ id, kind: "consent_revoked", resourceId: profile.id, epoch: consent.version, audience });
      result.status = "future_processing_stopped";
      break;
    }
    case "assign-task": {
      requireRole(actor, ["guardian", "child"]);
      const profile = scopedProfile(state, command.profileId, actor);
      activeConsent(state, profile, "learning", now);
      const upload = activeConsent(state, profile, "upload", now);
      const task = state.tasks[command.taskId];
      if (!task || task.mode !== "remote" || task.risk !== "low" || !task.approvedBy || task.cancelled
        || !task.ageBands.includes(profile.ageBand) || !state.agePolicy.ageBands.includes(profile.ageBand)) fail("TASK_UNAVAILABLE");
      if (epochTime(task.opensAt) > epochTime(now) || epochTime(task.closesAt) <= epochTime(now)) fail("TASK_EXPIRED");
      const existing = Object.values(state.assignments).find(item => item.profileId === profile.id && item.taskId === task.id
        && item.consentVersion === upload.version && item.status === "active");
      if (existing) result = { id: existing.id, status: "assigned", duplicate: true, syntheticOnly: true };
      else {
        state.assignments[id] = { id, profileId: profile.id, taskId: task.id, consentVersion: upload.version, taskVersion: task.templateVersion, status: "active" };
        result.status = "assigned";
      }
      break;
    }
    case "submit-observation": {
      requireRole(actor, ["guardian", "child"]);
      const { assignment, profile, task } = applicableAssignment(state, command.assignmentId, actor, now);
      const mediaDigest = digest({ sampleId: command.sampleId });
      const duplicate = Object.values(state.observations).find(item => item.assignmentId === assignment.id && item.digest === mediaDigest);
      state.observations[id] = { id, assignmentId: assignment.id, treeId: task.treeId, observerRef: profile.participantRef,
        enteredBy: actor.id, sourceType: "synthetic-reference", sampleId: command.sampleId, answer: command.answer,
        capturedAtClaimed: command.capturedAtClaimed, receivedAt: now, captureTimeVerified: false, digest: mediaDigest,
        state: duplicate ? "needs_review" : "pending_review", evidenceLevel: "E0", duplicateOf: duplicate?.id ?? null };
      state.outbox.push({ id, kind: "review_requested", resourceId: id, epoch: actor.epoch, audience });
      result.status = duplicate ? "duplicate_needs_review" : "received_pending_review";
      break;
    }
    case "review-observation": {
      requireRole(actor, ["reviewer"]);
      const observation = state.observations[command.observationId];
      if (!observation || observation.enteredBy === actor.id) fail("REVIEW_CONFLICT");
      const sourceActor = state.actors[observation.enteredBy];
      const assignment = state.assignments[observation.assignmentId];
      const profile = assignment ? state.profiles[assignment.profileId] : undefined;
      const guardian = profile ? state.actors[profile.guardianActorId] : undefined;
      if (!sourceActor || !guardian || actor.controlDomain === sourceActor.controlDomain || actor.controlDomain === guardian.controlDomain) fail("REVIEW_CONFLICT");
      if (!profile) fail("NOT_AUTHORIZED");
      activeConsent(state, profile, "learning", now);
      const priorReview = Object.values(state.reviews).filter(item => item.observationId === observation.id).at(-1);
      state.reviews[id] = { id, observationId: observation.id, reviewerId: actor.id, methodVersion: "synthetic-review-v1",
        decision: command.decision, reason: command.reason, decidedAt: now, supersedesId: priorReview?.id ?? null };
      observation.state = command.decision === "needs_more_information" ? "needs_review" : "accepted_for_learning";
      state.assessments[id] = { id, treeId: observation.treeId, asOf: observation.capturedAtClaimed,
        validUntil: now, reviewIds: [id], state: "unknown", evidenceLevel: "E0", limitations: ["synthetic_source", "not_field_evidence"] };
      result.status = "reviewed_survival_unknown";
      break;
    }
    case "grant-contribution": {
      requireRole(actor, ["reviewer"]);
      if (command.policyVersion !== state.policyVersion) fail("POLICY_CHANGED", 409);
      const observation = state.observations[command.observationId];
      const assignment = observation ? state.assignments[observation.assignmentId] : undefined;
      const profile = assignment ? state.profiles[assignment.profileId] : undefined;
      const task = assignment ? state.tasks[assignment.taskId] : undefined;
      const review = Object.values(state.reviews).filter(item => item.observationId === observation?.id).at(-1);
      if (!observation || !profile || !task || !review || observation.state !== "accepted_for_learning") fail("REVIEW_REQUIRED");
      if (Object.values(state.disputes).some(item => item.targetId === observation.id && item.status !== "resolved" && item.kind === "evidence")) fail("DISPUTE_PENDING");
      const canonicalRef = state.aliases[profile.participantRef];
      if (!canonicalRef || canonicalRef !== profile.canonicalParticipantRef) fail("IDENTITY_BINDING_REQUIRED");
      const key = digest(["synthetic-tenant", canonicalRef, task.activityInstance, "careful_observation"]);
      const existing = state.contributions.find(item => item.canonicalKey === key && item.entryType === "grant");
      if (existing) result = { id: existing.id, status: "learning_feedback_recorded", duplicate: true, syntheticOnly: true };
      else {
        activeConsent(state, profile, "learning", now);
        const sourceActor = state.actors[observation.enteredBy];
        const guardian = state.actors[profile.guardianActorId];
        if (!sourceActor || !guardian || actor.controlDomain === sourceActor.controlDomain
          || actor.controlDomain === guardian.controlDomain) fail("REVIEW_CONFLICT");
        state.contributions.push({ id, canonicalKey: key, participantRef: observation.observerRef, canonicalParticipantRef: canonicalRef,
          sourceObservationId: observation.id, reviewId: review.id, activityInstance: task.activityInstance, kind: "careful_observation",
          policyVersion: command.policyVersion, acceptedScope: "learning_only", amount: 1, unit: "EDU_FEEDBACK", entryType: "grant",
          correctionOf: null, reason: "reviewed_learning", attributedAt: now, transferable: false, cashValue: false });
        result.status = "learning_feedback_recorded";
      }
      break;
    }
    case "correct-contribution": {
      requireRole(actor, ["reviewer"]);
      const entry = state.contributions.find(item => item.id === command.contributionId && item.entryType === "grant");
      if (!entry) fail("NOT_AUTHORIZED");
      if (state.contributions.some(item => item.correctionOf === entry.id)) fail("ALREADY_CORRECTED", 409);
      state.contributions.push({ ...entry, id, amount: 0, entryType: "correction", correctionOf: entry.id,
        reason: "record_corrected", attributedAt: now });
      result.status = "correction_appended_no_debt";
      break;
    }
    case "open-dispute": {
      requireRole(actor, ["child", "guardian"]);
      const profile = scopedProfile(state, command.profileId, actor);
      const observation = state.observations[command.targetId];
      const contribution = state.contributions.find(item => item.id === command.targetId);
      if (command.targetId !== profile.id && (!observation || state.assignments[observation.assignmentId]?.profileId !== profile.id)
        && (!contribution || contribution.canonicalParticipantRef !== profile.canonicalParticipantRef)) fail("NOT_AUTHORIZED");
      const kind = command.reason === "unsafe_adult" ? "protection" : command.reason === "do_not_share" ? "privacy" : "evidence";
      // This synthetic scenario is specifically a child reporting the seeded guardian.
      // The implicated guardian cannot probe case deduplication to learn its existence.
      if (kind === "protection" && actor.role !== "child") fail("NOT_AUTHORIZED");
      if (kind === "protection") audience = "protection";
      const existing = Object.values(state.disputes).find(item => item.profileId === profile.id && item.targetId === command.targetId
        && item.openedBy === actor.id && item.kind === kind && item.reason === command.reason && item.status !== "resolved");
      if (existing) result = { id: existing.id, status: "received", duplicate: true, syntheticOnly: true };
      else {
        state.disputes[id] = { id, profileId: profile.id, targetId: command.targetId, openedBy: actor.id, kind, reason: command.reason,
          implicatedActorId: kind === "protection" ? profile.guardianActorId : null, status: "received", reviewerId: null,
          resolution: null, openedAt: now, escalationState: "human_review_required" };
        state.outbox.push({ id, kind: kind === "protection" ? "protection_review_requested" : "review_requested", resourceId: id, epoch: actor.epoch, audience });
        result.status = "received_human_review_required";
      }
      break;
    }
    case "resolve-dispute": {
      const dispute = state.disputes[command.disputeId];
      if (!dispute) fail("NOT_AUTHORIZED");
      requireRole(actor, dispute.kind === "protection" ? ["protector"] : ["reviewer", "protector"]);
      if (actor.id === dispute.implicatedActorId || actor.id === dispute.openedBy) fail("REVIEW_CONFLICT");
      const sourceObservations = new Set<string>([dispute.targetId]);
      const sourceReviews = new Set<string>();
      const visitedContributions = new Set<string>();
      let contribution = state.contributions.find(item => item.id === dispute.targetId);
      while (contribution) {
        if (visitedContributions.has(contribution.id)) fail("REVIEW_CONFLICT");
        visitedContributions.add(contribution.id);
        sourceObservations.add(contribution.sourceObservationId);
        sourceReviews.add(contribution.reviewId);
        if (contribution.correctionOf === null) break;
        const originalEntry = state.contributions.find(item => item.id === contribution?.correctionOf);
        if (!originalEntry) fail("REVIEW_CONFLICT");
        contribution = originalEntry;
      }
      const originalReviewers = Object.values(state.reviews)
        .filter(item => sourceObservations.has(item.observationId) || sourceReviews.has(item.id))
        .map(item => state.actors[item.reviewerId]);
      if (originalReviewers.some(reviewer => !reviewer || reviewer.id === actor.id || reviewer.controlDomain === actor.controlDomain)) fail("REVIEW_CONFLICT");
      if (dispute.status === "resolved") fail("ALREADY_RESOLVED", 409);
      dispute.status = "resolved";
      dispute.reviewerId = actor.id;
      dispute.resolution = command.resolution;
      audience = dispute.kind === "protection" ? "protection" : "ordinary";
      result.status = "human_decision_recorded";
      break;
    }
    case "request-privacy": {
      requireRole(actor, ["child", "guardian"]);
      const profile = scopedProfile(state, command.profileId, actor);
      state.privacyRequests[id] = { id, profileId: profile.id, kind: command.kind, status: "pending", requestedAt: now };
      if (command.kind === "delete_learning") {
        profile.status = "paused";
        for (const consent of Object.values(state.consents).filter(item => item.profileId === profile.id)) {
          consent.withdrawnAt = now;
          consent.guardianGranted = false;
          consent.childAssent = false;
          consent.version += 1;
          state.outbox.push({ id: `${id}-${consent.purpose}`, kind: "consent_revoked", resourceId: profile.id, epoch: consent.version, audience });
        }
      }
      state.outbox.push({ id, kind: "privacy_processing_requested", resourceId: id, epoch: actor.epoch, audience });
      result.status = "pending_not_deleted";
      break;
    }
    case "rebind-participant": {
      requireRole(actor, ["protector"]);
      const profile = state.profiles[command.profileId];
      if (!profile || state.aliases[command.newParticipantRef]) fail("IDENTITY_CONFLICT", 409);
      state.aliases[command.newParticipantRef] = profile.canonicalParticipantRef;
      profile.participantRef = command.newParticipantRef;
      result.status = "synthetic_alias_rebound_same_subject";
      break;
    }
    case "revoke-device": {
      requireRole(actor, ["guardian", "protector"]);
      if (actor.role === "guardian" && actor.id !== command.actorId) fail("NOT_AUTHORIZED");
      const target = state.actors[command.actorId];
      if (!target || !target.deviceIds.includes(command.deviceId)) fail("NOT_AUTHORIZED");
      target.deviceIds = target.deviceIds.filter(deviceId => deviceId !== command.deviceId);
      target.epoch += 1;
      result.status = "device_revoked";
      break;
    }
    case "replace-tree": {
      requireRole(actor, ["operator"]);
      const tree = state.trees[command.treeId];
      if (!tree || tree.archived || state.trees[command.newTreeId]) fail("TREE_CONFLICT", 409);
      state.trees[command.newTreeId] = { ...tree, id: command.newTreeId, replacesTreeId: tree.id, state: "registered", tagVersion: 1 };
      tree.state = "replaced";
      tree.archived = true;
      for (const task of Object.values(state.tasks)) if (task.treeId === tree.id) task.cancelled = true;
      result = { id: command.newTreeId, status: "new_tree_identity_created", syntheticOnly: true };
      break;
    }
    case "mark-tree-identity-uncertain": {
      requireRole(actor, ["operator", "reviewer"]);
      const tree = state.trees[command.treeId];
      if (!tree) fail("NOT_AUTHORIZED");
      tree.identity = "uncertain";
      result.status = "current_state_unknown";
      break;
    }
  }
  // Protection events have a separate chain and do not change ordinary view versions.
  // This prevents family export/audit/version polling from exposing a protected report.
  const prior = state.audit.filter(event => event.audience === audience).at(-1)?.digest ?? "0".repeat(64);
  const eventFields = { id, action: command.type, resourceId: result.id, actorId: actor.id, time: now,
    policyVersion: state.policyVersion, previousDigest: prior, audience };
  const event: LearningAuditEvent = { ...eventFields, digest: digest(eventFields) };
  state.audit.push(event);
  if (audience === "ordinary") state.version += 1;
  state.idempotency[idempotencyKey] = { digest: commandDigest, result };
  return { state, result, events: [event], outbox: state.outbox.slice(outboxStart) };
}

/** Returns no precise locations, canonical aliases, private case metadata, or financial balances. */
export function readChildLearningView(state: LearningState, principal: LearningPrincipal, now: string) {
  const actor = authenticate(state, principal, now);
  const ownProfiles = Object.values(state.profiles).filter(profile => actor.id === profile.actorId || actor.id === profile.guardianActorId);
  const profileIds = new Set(ownProfiles.map(profile => profile.id));
  const reviewAccess = actor.role === "reviewer" || actor.role === "protector";
  const assignments = Object.values(state.assignments).filter(item => profileIds.has(item.profileId));
  const assignmentIds = new Set(assignments.map(item => item.id));
  const observations = Object.values(state.observations).filter(item => reviewAccess || assignmentIds.has(item.assignmentId));
  const observationIds = new Set(observations.map(item => item.id));
  const disputes = Object.values(state.disputes).filter(item => item.kind === "protection"
    ? actor.role === "protector" || item.openedBy === actor.id && item.implicatedActorId !== actor.id
    : reviewAccess || profileIds.has(item.profileId));
  const visibleResources = new Set([...profileIds, ...assignmentIds, ...observationIds,
    ...disputes.map(item => item.id)]);
  const consents = Object.values(state.consents).filter(item => profileIds.has(item.profileId));
  const uploadEligibility = ownProfiles.map(profile => {
    try {
      activeConsent(state, profile, "learning", now);
      const consent = activeConsent(state, profile, "upload", now);
      return { profileId: profile.id, allowed: true, consentEpoch: consent.version, reason: null };
    } catch (error) {
      if (!(error instanceof ChildLearningError)) throw error;
      return { profileId: profile.id, allowed: false, consentEpoch: state.consents[consentKey(profile.id, "upload")]?.version ?? 0, reason: error.code };
    }
  });
  return {
    mode: "synthetic-demo" as const, syntheticOnly: true as const, version: state.version, policyVersion: state.policyVersion,
    role: actor.role, actorEpoch: actor.epoch, uploadAllowed: uploadEligibility.some(item => item.allowed), uploadEligibility,
    capabilities: { realRegistration: false, realMediaUpload: false, passkeyIdentityAssurance: false,
      funds: false, carbonExecution: false, pocc: "unsupported", chainRank: "unsupported", agent: "approved_static_content" },
    profiles: ownProfiles.map(({ id, ageBand, locale, nickname, status }) => ({ id, ageBand, locale, nickname, status })),
    consents, trees: Object.values(state.trees).map(tree => ({ id: tree.id, slotId: tree.slotId, sourceRef: tree.sourceRef,
      coarseRegion: tree.coarseRegion, identity: tree.identity, state: tree.state, replacesTreeId: tree.replacesTreeId,
      currentKnowledge: "unknown", syntheticOnly: true })),
    tasks: Object.values(state.tasks), assignments,
    observations: observations.map(item => ({ id: item.id, assignmentId: item.assignmentId, treeId: item.treeId,
      sourceType: item.sourceType, sampleId: item.sampleId, answer: item.answer, capturedAtClaimed: item.capturedAtClaimed,
      receivedAt: item.receivedAt, captureTimeVerified: item.captureTimeVerified, state: item.state,
      evidenceLevel: item.evidenceLevel, duplicateOf: item.duplicateOf })),
    reviews: Object.values(state.reviews).filter(item => observationIds.has(item.observationId)),
    assessments: Object.values(state.assessments).map(item => ({ ...item, currentState: "unknown",
      freshness: epochTime(item.validUntil) <= epochTime(now) ? "expired_for_current_claim" : "current" })),
    contributions: state.contributions.filter(item => ownProfiles.some(profile => profile.canonicalParticipantRef === item.canonicalParticipantRef))
      .map(entry => ({ id: entry.id, sourceObservationId: entry.sourceObservationId, reviewId: entry.reviewId,
        activityInstance: entry.activityInstance, kind: entry.kind, policyVersion: entry.policyVersion,
        acceptedScope: entry.acceptedScope, amount: entry.amount, unit: entry.unit, entryType: entry.entryType,
        correctionOf: entry.correctionOf, reason: entry.reason, attributedAt: entry.attributedAt,
        transferable: entry.transferable, cashValue: entry.cashValue })),
    disputes, privacyRequests: Object.values(state.privacyRequests).filter(item => profileIds.has(item.profileId)),
    audit: state.audit.filter(event => event.audience === "protection" ? actor.role === "protector"
      : (reviewAccess || visibleResources.has(event.resourceId) || event.actorId === actor.id))
      .map(event => ({ id: event.id, action: event.action, resourceId: event.resourceId, actorId: event.actorId,
        time: event.time, policyVersion: event.policyVersion, audience: event.audience })),
  };
}
