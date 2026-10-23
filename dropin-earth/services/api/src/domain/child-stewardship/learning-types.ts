/** Product-side synthetic contract. No real-child enrollment or identity assurance. */
export type LearningRole = "guardian" | "child" | "reviewer" | "protector" | "operator";
export type LearningPurpose = "learning" | "upload" | "sharing";
export type AgeBand = "6-8" | "9-12" | "13-17";
export type LearningPrincipal = { actorId: string; deviceId: string; epoch: number };
export type LearningActor = {
  id: string; role: LearningRole; controlDomain: string; epoch: number;
  revoked: boolean; deviceIds: string[]; expiresAt: string;
};
export type ChildLearningProfile = {
  id: string; participantRef: string; canonicalParticipantRef: string; actorId: string;
  guardianActorId: string; ageBand: AgeBand; locale: "zh-CN" | "en";
  nickname: "leaf" | "acorn" | "sprout"; status: "active" | "paused";
};
export type LearningConsent = {
  id: string; profileId: string; purpose: LearningPurpose; policyVersion: string;
  guardianLinkVersion: number; guardianGranted: boolean; childAssent: boolean;
  version: number; expiresAt: string; withdrawnAt: string | null;
};
export type LearningTree = {
  id: string; slotId: string; sourceRef: string; coarseRegion: "synthetic-learning-garden";
  identity: "confirmed" | "uncertain" | "disputed"; state: "registered" | "alive_observed" | "dead_observed" | "replaced";
  replacesTreeId: string | null; tagVersion: number; archived: boolean;
};
export type LearningTask = {
  id: string; treeId: string; templateVersion: string; activityInstance: string;
  mode: "remote"; risk: "low"; approvedBy: string; method: "synthetic-leaf-comparison-v1";
  opensAt: string; closesAt: string; cancelled: boolean; ageBands: AgeBand[];
};
export type LearningAssignment = {
  id: string; profileId: string; taskId: string; consentVersion: number;
  taskVersion: string; status: "active" | "cancelled";
};
export type LearningObservation = {
  id: string; assignmentId: string; treeId: string; observerRef: string; enteredBy: string;
  sourceType: "synthetic-reference"; sampleId: "demo-leaf-green" | "demo-leaf-yellow";
  answer: "green" | "yellow" | "uncertain"; capturedAtClaimed: string; receivedAt: string;
  captureTimeVerified: false; digest: string; state: "pending_review" | "accepted_for_learning" | "needs_review";
  evidenceLevel: "E0"; duplicateOf: string | null;
};
export type LearningReview = {
  id: string; observationId: string; reviewerId: string; methodVersion: string;
  decision: "insufficient_for_survival" | "learning_observation_accepted" | "needs_more_information";
  reason: "synthetic_source" | "time_unverified" | "identity_uncertain" | "conflicting_observation";
  decidedAt: string; supersedesId: string | null;
};
export type LearningAssessment = {
  id: string; treeId: string; asOf: string; validUntil: string; reviewIds: string[];
  state: "unknown"; evidenceLevel: "E0"; limitations: readonly ["synthetic_source", "not_field_evidence"];
};
export type LearningContribution = {
  id: string; canonicalKey: string; participantRef: string; canonicalParticipantRef: string;
  sourceObservationId: string; reviewId: string; activityInstance: string; kind: "careful_observation";
  policyVersion: string; acceptedScope: "learning_only"; amount: 1 | 0; unit: "EDU_FEEDBACK";
  entryType: "grant" | "correction"; correctionOf: string | null;
  reason: "reviewed_learning" | "record_corrected"; attributedAt: string;
  transferable: false; cashValue: false;
};
export type LearningDispute = {
  id: string; profileId: string; targetId: string; openedBy: string;
  kind: "evidence" | "privacy" | "protection";
  reason: "wrong_tree" | "wrong_time" | "do_not_share" | "not_understood" | "unsafe_adult";
  implicatedActorId: string | null; status: "received" | "under_review" | "resolved";
  reviewerId: string | null; resolution: "corrected" | "maintained" | "unknown" | null;
  openedAt: string; escalationState: "human_review_required";
};
export type LearningAuditEvent = {
  id: string; action: string; resourceId: string; actorId: string; time: string;
  policyVersion: string; previousDigest: string; digest: string;
  audience: "ordinary" | "protection";
};
export type LearningOutbox = {
  id: string; kind: "consent_revoked" | "review_requested" | "protection_review_requested" | "privacy_processing_requested";
  resourceId: string; epoch: number; audience: "ordinary" | "protection";
};
export type LearningState = {
  schemaVersion: 1; mode: "synthetic-demo"; version: number; policyVersion: string;
  agePolicy: { version: string; jurisdiction: "SYNTHETIC"; realRegistrationEnabled: false; ageBands: AgeBand[] };
  actors: Record<string, LearningActor>; profiles: Record<string, ChildLearningProfile>;
  guardianLinks: Record<string, { guardianActorId: string; profileId: string; version: number; expiresAt: string; syntheticOnly: true }>;
  consents: Record<string, LearningConsent>; trees: Record<string, LearningTree>; tasks: Record<string, LearningTask>;
  assignments: Record<string, LearningAssignment>; observations: Record<string, LearningObservation>;
  reviews: Record<string, LearningReview>; assessments: Record<string, LearningAssessment>;
  contributions: LearningContribution[]; disputes: Record<string, LearningDispute>;
  aliases: Record<string, string>; audit: LearningAuditEvent[]; outbox: LearningOutbox[];
  privacyRequests: Record<string, { id: string; profileId: string; kind: "delete_learning" | "export_learning"; status: "pending"; requestedAt: string }>;
  idempotency: Record<string, { digest: string; result: LearningResult }>;
};
type CommandBase = { commandId: string; expectedVersion: number };
export type LearningCommand = CommandBase & (
  | { type: "create-profile"; profileId: string; ageBand: AgeBand; locale: "zh-CN" | "en"; nickname: "leaf" | "acorn" | "sprout" }
  | { type: "grant-consent"; profileId: string; purpose: LearningPurpose; policyVersion: string }
  | { type: "set-assent"; profileId: string; purpose: LearningPurpose; willing: boolean }
  | { type: "withdraw-consent"; profileId: string; purpose: LearningPurpose }
  | { type: "assign-task"; profileId: string; taskId: string }
  | { type: "submit-observation"; assignmentId: string; sampleId: "demo-leaf-green" | "demo-leaf-yellow"; answer: "green" | "yellow" | "uncertain"; capturedAtClaimed: string }
  | { type: "review-observation"; observationId: string; decision: LearningReview["decision"]; reason: LearningReview["reason"] }
  | { type: "grant-contribution"; observationId: string; policyVersion: string }
  | { type: "correct-contribution"; contributionId: string; reason: "record_corrected" }
  | { type: "open-dispute"; profileId: string; targetId: string; reason: LearningDispute["reason"] }
  | { type: "resolve-dispute"; disputeId: string; resolution: "corrected" | "maintained" | "unknown" }
  | { type: "request-privacy"; profileId: string; kind: "delete_learning" | "export_learning" }
  | { type: "rebind-participant"; profileId: string; newParticipantRef: string }
  | { type: "revoke-device"; actorId: string; deviceId: string }
  | { type: "replace-tree"; treeId: string; newTreeId: string }
  | { type: "mark-tree-identity-uncertain"; treeId: string }
);
export type LearningResult = { id: string; status: string; duplicate?: boolean; syntheticOnly: true };
export type LearningTransition = { state: LearningState; result: LearningResult; events: LearningAuditEvent[]; outbox: LearningOutbox[] };
