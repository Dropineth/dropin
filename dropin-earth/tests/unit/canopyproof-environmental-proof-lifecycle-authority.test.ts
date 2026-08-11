import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import type {
  CanopyProofEnvironmentalProofRecord,
  CanopyProofEnvironmentalProofSafetyBoundary,
} from "../../services/api/src/domain/canopyproof/environmental-proof-authority.js";
import type { CanopyProofEnvironmentalProofChallengedRecordProjection } from "../../services/api/src/domain/canopyproof/environmental-proof-challenge-authority.js";
import {
  CanopyProofEnvironmentalProofLifecycleAuthorityService,
  type CanopyProofEnvironmentalProofLifecycleBindingFact,
  type CanopyProofEnvironmentalProofLifecycleBindingAuthority,
  type CanopyProofEnvironmentalProofLifecycleProjectionAuthority,
  type CanopyProofEnvironmentalProofManagedSignatureVerifier,
  type CanopyProofExternalVerificationReceipt,
} from "../../services/api/src/domain/canopyproof/environmental-proof-lifecycle-authority.js";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  CanopyProofMrvGraphAuthorityService,
  canopyProofMrvActorAuthorityRoot,
  canopyProofMrvEndpointHash,
  canopyProofMrvMethodologyRoot,
  type CanopyProofMrvActorSnapshot,
  type CanopyProofMrvEndpointSnapshot,
  type CanopyProofMrvMethodologySnapshot,
} from "../../services/api/src/domain/canopyproof/mrv-graph-authority.js";
import { appendCanopyProofAuditEvent } from "../../services/api/src/domain/canopyproof/proof-engine.js";

const organizationId = "cp_lifecycle_org";
const projectId = "cp_lifecycle_project";
const issuer = actor("cp_lifecycle_issuer", "admin", [
  "environmental_proof_lifecycle:issue",
  "environmental_proof_lifecycle:govern",
  "environmental_proof_signing_key:admin",
]);
const governor = actor("cp_lifecycle_governor", "verifier", [
  "environmental_proof_lifecycle:govern",
  "environmental_proof_signing_key:admin",
]);
const mrvReviewer = mrvActor("cp_lifecycle_mrv_reviewer", "researcher", ["mrv_graph_review"]);
const edgeAuthor = mrvActor("cp_lifecycle_edge_author", "owner", []);
const verifier = managedVerifier();

test("Environmental Proof lifecycle stays issued until managed signature verification, then becomes active and replays", async () => {
  const fixture = await createFixture();
  const beforeSignature = fixture.service.projectLifecycle(fixture.binding.id, fixture.projectionAt("2026-07-14T07:00:00.000Z"));
  assert.equal(beforeSignature.state, "issued");
  assert.deepEqual(beforeSignature.issueCodes, ["signature_missing"]);
  assert.equal(beforeSignature.safety.routeMounted, false);
  assert.equal(beforeSignature.safety.productionActivationEnabled, false);

  const signature = await fixture.service.recordSignatureReceipt(
    fixture.binding.id,
    { detachedSignature: "ZXh0ZXJuYWxfa21zX3NpZ25hdHVyZV92MQ", signedAt: "2026-07-14T06:40:00.000Z" },
    verifier,
  );
  const active = fixture.service.projectLifecycle(fixture.binding.id, fixture.projectionAt("2026-07-14T07:00:00.000Z"));
  assert.equal(active.state, "active");
  assert.equal(active.signatureVerified, true);
  assert.deepEqual(active.issueCodes, []);
  assert.equal(signature.signaturePayloadHash, fixture.binding.signaturePayloadHash);

  const replayed = CanopyProofEnvironmentalProofLifecycleAuthorityService.fromAuthoritySnapshot(
    fixture.service.getAuthoritySnapshot(),
  );
  assert.deepEqual(replayed.getSigningKey(fixture.key.id), fixture.key);
  assert.deepEqual(replayed.getBinding(fixture.binding.id), fixture.binding);
  assert.deepEqual(replayed.getSignatureReceipt(signature.id), signature);
  assert.deepEqual(
    replayed.projectLifecycle(fixture.binding.id, fixture.projectionAt("2026-07-14T07:00:00.000Z")),
    active,
  );
});

test("Environmental Proof lifecycle fails closed for revoked keys, challenge, stale MRV, and expiry", async () => {
  const fixture = await createFixture({ withSignature: true });
  const revoked = fixture.service.revokeManagedSigningKey(
    fixture.key.id,
    {
      reasonCode: "provider_key_compromise",
      rationale: "The managed provider reported a key compromise and requires immediate reliance suspension.",
      revokedAt: "2026-07-14T08:00:00.000Z",
    },
    issuer,
  );
  assert.equal(revoked.keyAuthorityId, fixture.key.id);
  const keySuspended = fixture.service.projectLifecycle(
    fixture.binding.id,
    fixture.projectionAt("2026-07-14T08:01:00.000Z"),
  );
  assert.equal(keySuspended.state, "suspended");
  assert.ok(keySuspended.issueCodes.includes("signing_key_revoked"));

  const challengedProjection = governedProjection(fixture.record, {
    state: "challenged",
    challenge: {
      state: "open",
      id: "cp_lifecycle_challenge",
      root: hashJson({ kind: "lifecycle-challenge-root" }),
    },
  });
  const challenged = fixture.service.projectLifecycle(fixture.binding.id, {
    governedRecordProjection: challengedProjection,
    mrvGraphProjection: fixture.graphProjection,
    evaluatedAt: "2026-07-14T07:30:00.000Z",
  });
  assert.equal(challenged.state, "challenged");

  const staleMrv = {
    ...fixture.graphProjection,
    latestSnapshotId: "cp_mrv_snapshot_later",
    latestSnapshotRoot: hashJson({ kind: "later-mrv-snapshot" }),
  };
  const staleMrvProjection = {
    ...staleMrv,
    graphRoot: hashJson({
      kind: "canopyproof-mrv-graph-projection-v1",
      organizationId,
      projectId,
      state: staleMrv.state,
      latestSnapshotId: staleMrv.latestSnapshotId,
      latestSnapshotRoot: staleMrv.latestSnapshotRoot,
      finalProofChanged: false,
    }),
  };
  const stale = fixture.service.projectLifecycle(fixture.binding.id, {
    governedRecordProjection: fixture.recordProjection,
    mrvGraphProjection: staleMrvProjection,
    evaluatedAt: "2026-07-14T07:30:00.000Z",
  });
  assert.equal(stale.state, "suspended");
  assert.ok(stale.issueCodes.includes("mrv_snapshot_not_current"));

  const expired = fixture.service.projectLifecycle(
    fixture.binding.id,
    fixture.projectionAt("2026-08-14T07:00:00.000Z"),
  );
  assert.equal(expired.state, "expired");
  assert.ok(expired.issueCodes.includes("validity_expired"));
});

test("Environmental Proof lifecycle suspension and reinstatement require independent accredited governance", async () => {
  const fixture = await createFixture({ withSignature: true });
  const suspension = fixture.service.recordControl(
    fixture.binding.id,
    {
      action: "suspend",
      rationale: "An institutional review is required while a non-source operational concern is investigated.",
      conflictDisclosure: "The governor has no contribution, issuance, model-operation, or review conflict in this record.",
      decidedAt: "2026-07-14T08:00:00.000Z",
    },
    governor,
    { current: fixture.projectionAt("2026-07-14T08:00:00.000Z") },
  );
  assert.equal(suspension.priorState, "active");
  assert.equal(
    fixture.service.projectLifecycle(fixture.binding.id, fixture.projectionAt("2026-07-14T08:30:00.000Z")).state,
    "suspended",
  );
  await assert.rejects(
    async () => fixture.service.recordControl(
      fixture.binding.id,
      {
        action: "reinstate",
        rationale: "The issuer attempts to restore reliance without an independent governance decision or separation.",
        conflictDisclosure: "The issuer is the original lifecycle issuer and therefore has a direct conflict in this action.",
        decidedAt: "2026-07-14T09:00:00.000Z",
      },
      issuer,
      { current: fixture.projectionAt("2026-07-14T09:00:00.000Z") },
    ),
    /independent human governor/,
  );
  const reinstatement = fixture.service.recordControl(
    fixture.binding.id,
    {
      action: "reinstate",
      rationale: "Independent review closed the operational concern and every technical activation gate remains current.",
      conflictDisclosure: "The governor confirms no contribution, issuance, model-operation, or MRV review conflict.",
      decidedAt: "2026-07-14T09:00:00.000Z",
    },
    governor,
    { current: fixture.projectionAt("2026-07-14T09:00:00.000Z") },
  );
  assert.equal(reinstatement.priorState, "suspended");
  assert.equal(
    fixture.service.projectLifecycle(fixture.binding.id, fixture.projectionAt("2026-07-14T09:01:00.000Z")).state,
    "active",
  );
});

test("Environmental Proof lifecycle rejects agents, unsafe secret material, and substituted source roots", async () => {
  const service = new CanopyProofEnvironmentalProofLifecycleAuthorityService();
  const agent = actor("cp_lifecycle_agent", "agent", ["environmental_proof_signing_key:admin"], "agent");
  await assert.rejects(
    service.attestManagedSigningKey(keyCommand(), agent, verifier),
    /authorized human role/,
  );
  await assert.rejects(
    service.attestManagedSigningKey(
      { ...keyCommand(), providerKeyId: "private_key_material" },
      issuer,
      verifier,
    ),
    /unsafe claim or secret/,
  );

  const fixture = await createFixture();
  const substituted = {
    ...fixture.recordProjection,
    recordRoot: hashJson({ kind: "substituted-record-root" }),
  };
  await assert.rejects(
    async () => fixture.service.bindLifecycle(bindingCommand(fixture.record.id), {
      ...fixture.bindingAuthority,
      governedRecordProjection: substituted,
    }),
    /governed record projection is invalid/,
  );
});

test("Environmental Proof lifecycle replay rejects self-consistent source-root forgery and duplicate IDs", async () => {
  const fixture = await createFixture();
  const snapshot = fixture.service.getAuthoritySnapshot();
  const forgedBinding = forgeBindingSourceRoot(snapshot.bindings[0]!);
  assert.throws(
    () => CanopyProofEnvironmentalProofLifecycleAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      bindings: [forgedBinding],
    }),
    /command authority is invalid/,
  );
  assert.throws(
    () => CanopyProofEnvironmentalProofLifecycleAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      controls: [{
        ...fakeControlFromBinding(snapshot.bindings[0]!),
        id: snapshot.bindings[0]!.id,
      }],
    }),
    /duplicate fact IDs/,
  );
});

type Fixture = Awaited<ReturnType<typeof createFixture>>;

async function createFixture(options: Readonly<{ withSignature?: boolean }> = {}) {
  const record = environmentalProofRecord("cp_environmental_proof_record_lifecycle_v1", issuer, "2026-07-14T06:00:00.000Z");
  const recordProjection = governedProjection(record);
  const mrvService = buildMrvAuthority(record);
  const mrvAuthoritySnapshot = mrvService.getAuthoritySnapshot();
  const graphProjection = mrvService.projectGraph(organizationId, projectId);
  const service = new CanopyProofEnvironmentalProofLifecycleAuthorityService();
  const key = await service.attestManagedSigningKey(keyCommand(), issuer, verifier);
  const bindingAuthority: CanopyProofEnvironmentalProofLifecycleBindingAuthority = {
    record,
    governedRecordProjection: recordProjection,
    mrvAuthoritySnapshot,
    issuer,
    signingKeyAuthorityId: key.id,
  };
  const binding = service.bindLifecycle(bindingCommand(record.id), bindingAuthority);
  const projectionAt = (evaluatedAt: string): CanopyProofEnvironmentalProofLifecycleProjectionAuthority => ({
    governedRecordProjection: recordProjection,
    mrvGraphProjection: graphProjection,
    evaluatedAt,
  });
  if (options.withSignature) {
    await service.recordSignatureReceipt(
      binding.id,
      { detachedSignature: "ZXh0ZXJuYWxfa21zX3NpZ25hdHVyZV92MQ", signedAt: "2026-07-14T06:40:00.000Z" },
      verifier,
    );
  }
  return {
    service,
    key,
    binding,
    record,
    recordProjection,
    graphProjection,
    mrvAuthoritySnapshot,
    bindingAuthority,
    projectionAt,
  };
}

function keyCommand() {
  return {
    organizationId,
    provider: "managed_hsm" as const,
    providerKeyId: "canopyproof-environmental-proof-key",
    keyVersion: "v1",
    algorithm: "Ed25519" as const,
    publicKeyHash: hashJson({ kind: "lifecycle-public-key" }),
    providerAttestationHash: hashJson({ kind: "lifecycle-provider-key-attestation" }),
    activeFrom: "2026-07-14T05:00:00.000Z",
    expiresAt: "2027-07-14T05:00:00.000Z",
    attestedAt: "2026-07-14T05:30:00.000Z",
  };
}

function bindingCommand(recordId: string) {
  return {
    recordId,
    observationStartsAt: "2026-06-01T00:00:00.000Z",
    observationEndsAt: "2026-07-14T05:30:00.000Z",
    validFrom: "2026-07-14T07:00:00.000Z",
    expiresAt: "2026-08-14T07:00:00.000Z",
    monitoringCadenceDays: 7,
    nextMonitoringDueAt: "2026-07-21T07:00:00.000Z",
    monitoringGraceDays: 2,
    assertionType: "restoration_activity" as const,
    assertionScopeHash: hashJson({ kind: "lifecycle-assertion-scope" }),
    locationScopeHash: hashJson({ kind: "lifecycle-location-scope" }),
    uncertaintyHash: hashJson({ kind: "lifecycle-uncertainty" }),
    limitationHashes: [hashJson({ kind: "lifecycle-limitation" })],
    relianceStatement: "environmental_accountability_only" as const,
    boundAt: "2026-07-14T06:30:00.000Z",
  };
}

function managedVerifier(): CanopyProofEnvironmentalProofManagedSignatureVerifier {
  return {
    async verifyManagedKeyAttestation(request) {
      return externalReceipt("key", request.requestedAt, request);
    },
    async verifyDetachedSignature(request) {
      const verifiedAt = new Date(Date.parse(request.signedAt) + 60_000).toISOString();
      return externalReceipt("signature", verifiedAt, request);
    },
  };
}

function externalReceipt(kind: string, verifiedAt: string, request: unknown): CanopyProofExternalVerificationReceipt {
  return {
    verified: true,
    externalVerifierId: "cp_test_managed_signature_verifier",
    providerReceiptIdHash: hashJson({ kind: `${kind}-provider-receipt-id`, request }),
    providerReceiptHash: hashJson({ kind: `${kind}-provider-receipt`, request }),
    verifiedAt,
  };
}

function actor(
  id: string,
  role: CanopyProofVerificationActorSnapshot["role"],
  accreditationScope: readonly string[],
  participantType: CanopyProofVerificationActorSnapshot["participantType"] = "human",
): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id,
    participantType,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "lifecycle-participant", id }),
    organizationRoot: hashJson({ kind: "lifecycle-organization", organizationId }),
    membershipId: `cp_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "lifecycle-membership", id }),
    accreditationId: `cp_accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({ kind: "lifecycle-accreditation", id }),
    accreditationScope: [...accreditationScope].sort(),
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

function mrvActor(
  id: string,
  role: CanopyProofMrvActorSnapshot["role"],
  accreditationScope: readonly string[],
): CanopyProofMrvActorSnapshot {
  const normalized = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "lifecycle-mrv-participant", id }),
    organizationRoot: hashJson({ kind: "lifecycle-organization", organizationId }),
    membershipId: `cp_mrv_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "lifecycle-mrv-membership", id }),
    ...(accreditationScope.length > 0
      ? {
          accreditationId: `cp_mrv_accreditation_${id}`,
          accreditationStatus: "approved" as const,
          accreditationRoot: hashJson({ kind: "lifecycle-mrv-accreditation", id }),
        }
      : {}),
    accreditationScope: [...accreditationScope].sort(),
  };
  return { ...normalized, authorityRoot: canopyProofMrvActorAuthorityRoot(normalized) };
}

function environmentalProofRecord(
  id: string,
  recordIssuer: CanopyProofVerificationActorSnapshot,
  issuedAt: string,
): CanopyProofEnvironmentalProofRecord {
  const claimBoundary = environmentalProofSafety();
  const payload = {
    factType: "environmental_proof_record" as const,
    id,
    recordType: "environmental_proof_record" as const,
    candidateId: `${id}_candidate`,
    candidateRoot: hashJson({ kind: "lifecycle-candidate", id }),
    authorityRoot: hashJson({ kind: "lifecycle-record-authority", id }),
    organizationId,
    projectId,
    projectRoot: hashJson({ kind: "lifecycle-project-root", projectId }),
    methodologyId: "cp_lifecycle_methodology",
    methodologyHash: hashJson({ kind: "lifecycle-methodology-hash" }),
    methodologyPublicationId: "cp_lifecycle_methodology_publication",
    methodologyPublicationRoot: hashJson({ kind: "lifecycle-methodology-publication-root" }),
    policyId: "cp_lifecycle_policy",
    policyRoot: hashJson({ kind: "lifecycle-policy-root" }),
    evidenceIds: ["cp_lifecycle_evidence"],
    evidenceRoot: hashJson({ kind: "lifecycle-evidence-root" }),
    evidenceFinalDecisionIds: ["cp_lifecycle_final_decision"],
    evidenceFinalDecisionRoots: [hashJson({ kind: "lifecycle-final-decision-root" })],
    monitoringEventIds: ["cp_lifecycle_monitoring"],
    monitoringRoot: hashJson({ kind: "lifecycle-monitoring-root" }),
    contributorIds: [edgeAuthor.id],
    publicLocation: { latitude: 1.2, longitude: 103.8, regionId: "cp_lifecycle_region", areaHectares: 12 },
    confidenceScore: 87,
    governanceApprovalIds: ["cp_lifecycle_approval_1", "cp_lifecycle_approval_2"],
    governanceApprovalRoots: [
      hashJson({ kind: "lifecycle-approval-root", index: 1 }),
      hashJson({ kind: "lifecycle-approval-root", index: 2 }),
    ].sort(),
    governanceQuorumRoot: hashJson({ kind: "lifecycle-governance-quorum" }),
    issuer: recordIssuer,
    rationale: "Independent governance approved this bounded environmental accountability record for lifecycle review.",
    limitations: ["The record is bounded to its evidence, methodology, observation period, and stated uncertainty."],
    sourceEventRoots: [hashJson({ kind: "lifecycle-source-event" })],
    sourceRoot: hashJson({ kind: "lifecycle-record-source-root" }),
    issuedAt,
    commandHash: hashJson({ kind: "lifecycle-record-command" }),
    candidateSequence: 4,
    previousEventRoot: hashJson({ kind: "lifecycle-record-previous-event" }),
    recordHash: hashJson({ kind: "lifecycle-record-hash" }),
    recordRoot: hashJson({ kind: "lifecycle-record-root", id }),
    status: "issued" as const,
    claimBoundary,
  };
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: "FULFILL",
    actor: recordIssuer.id,
    entityType: "environmental_proof_record",
    entityId: id,
    payload,
    createdAt: issuedAt,
    rationale: payload.rationale,
  }).at(-1)!;
  return { ...payload, auditEvent };
}

function environmentalProofSafety(): CanopyProofEnvironmentalProofSafetyBoundary {
  return {
    environmentalAccountabilityOnly: true,
    sourceAuthorityReplayed: true,
    currentFinalEvidenceOnly: true,
    governedMethodologyRequired: true,
    acceptedMonitoringRequired: true,
    independentHumanGovernanceRequired: true,
    publicChallengeRequiredBeforePublicReliance: true,
    noRawEvidence: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  };
}

function governedProjection(
  record: CanopyProofEnvironmentalProofRecord,
  options: Readonly<{
    state?: CanopyProofEnvironmentalProofChallengedRecordProjection["state"];
    sourceAuthorityCurrent?: boolean;
    challenge?: Readonly<{ state: "open" | "under_review" | "resolved" | "rejected"; id: string; root: string }>;
  }> = {},
): CanopyProofEnvironmentalProofChallengedRecordProjection {
  const state = options.state ?? "issued";
  const sourceAuthorityCurrent = options.sourceAuthorityCurrent ?? true;
  const seed = {
    recordId: record.id,
    recordRoot: record.recordRoot,
    state,
    baseState: sourceAuthorityCurrent ? "issued" as const : "stale" as const,
    sourceAuthorityCurrent,
    challengeState: options.challenge?.state ?? null,
    challengeId: options.challenge?.id ?? null,
    challengeRoot: options.challenge?.root ?? null,
    resolutionId: null,
    resolutionRoot: null,
  };
  return {
    ...seed,
    projectionRoot: hashJson({ kind: "canopyproof-environmental-proof-challenged-record-projection-v1", ...seed }),
    safety: {
      environmentalAccountabilityOnly: true,
      immutableRecordPreserved: true,
      riskSignalAdvisoryOnly: true,
      independentHumanGovernanceRequired: true,
      crossOrganizationStandingGrantsNoDataAccess: true,
      noRawEvidence: true,
      notCertifiedCarbonCredit: true,
      notCarbonTaxOffset: true,
      notFinancialAsset: true,
      notGuaranteedYield: true,
      noMainnetFunds: true,
      notAutomaticCanopyDistribution: true,
    },
  };
}

function buildMrvAuthority(record: CanopyProofEnvironmentalProofRecord) {
  const service = new CanopyProofMrvGraphAuthorityService();
  const methodology = mrvMethodology(record);
  const project = endpoint(
    "project_registration",
    projectId,
    record.projectRoot,
    hashJson({ kind: "lifecycle-project-event" }),
    "2026-07-14T05:00:00.000Z",
  );
  const evidence = endpoint(
    "evidence_object",
    record.evidenceIds[0]!,
    record.evidenceRoot,
    hashJson({ kind: "lifecycle-evidence-event" }),
    "2026-07-14T05:10:00.000Z",
  );
  const review = endpoint(
    "human_review",
    "cp_lifecycle_human_review",
    hashJson({ kind: "lifecycle-human-review-root" }),
    hashJson({ kind: "lifecycle-human-review-event" }),
    "2026-07-14T05:20:00.000Z",
  );
  const decision = endpoint(
    "verification_decision",
    record.evidenceFinalDecisionIds[0]!,
    record.evidenceFinalDecisionRoots[0]!,
    hashJson({ kind: "lifecycle-final-decision-event" }),
    "2026-07-14T05:30:00.000Z",
  );
  const recordEndpoint = endpoint(
    "environmental_proof_record",
    record.id,
    record.recordRoot,
    record.auditEvent.eventRoot,
    record.issuedAt,
  );
  const edgeInputs = [
    { source: evidence, relationship: "MEASURES" as const, target: project, minute: 10 },
    { source: review, relationship: "REVIEWS" as const, target: evidence, minute: 11 },
    { source: decision, relationship: "DECIDES" as const, target: evidence, minute: 12 },
    { source: evidence, relationship: "SUPPORTS" as const, target: recordEndpoint, minute: 13 },
  ];
  const edges = edgeInputs.map(({ source, relationship, target, minute }) => service.recordEdge(
    {
      source: { type: source.type, id: source.id, root: source.root, eventRoot: source.eventRoot },
      relationship,
      target: { type: target.type, id: target.id, root: target.root, eventRoot: target.eventRoot },
      reasonHash: hashJson({ kind: "lifecycle-mrv-edge-reason", relationship }),
      limitationHashes: [],
      createdAt: `2026-07-14T06:${minute}:00.000Z`,
    },
    { source, target, methodology, actor: edgeAuthor },
  ));
  const snapshot = service.recordSnapshot(
    {
      projectId,
      projectRoot: record.projectRoot,
      methodologyId: methodology.id,
      methodologyPublicationRoot: methodology.publicationRoot,
      edgeIds: edges.map((edge) => edge.id).sort(),
      conflictDisclosureHash: hashJson({ kind: "lifecycle-mrv-review-conflict-disclosure" }),
      limitationHashes: [],
      reviewedAt: "2026-07-14T06:20:00.000Z",
    },
    { reviewer: mrvReviewer, organizationId, projectId, projectRoot: record.projectRoot, methodology },
  );
  assert.equal(snapshot.snapshot.state, "reviewed_for_lineage");
  return service;
}

function endpoint(
  type: CanopyProofMrvEndpointSnapshot["type"],
  id: string,
  root: string,
  eventRoot: string,
  occurredAt: string,
): CanopyProofMrvEndpointSnapshot {
  const seed = {
    type,
    id,
    root,
    eventRoot,
    organizationId,
    projectId,
    occurredAt,
    state: "current" as const,
    actorIds: [edgeAuthor.id],
  };
  return { ...seed, endpointHash: canopyProofMrvEndpointHash(seed) };
}

function mrvMethodology(record: CanopyProofEnvironmentalProofRecord): CanopyProofMrvMethodologySnapshot {
  const seed = {
    id: record.methodologyId,
    version: "v1.0.0",
    methodologyHash: record.methodologyHash,
    publicationId: record.methodologyPublicationId,
    publicationRoot: record.methodologyPublicationRoot,
    publishedAt: "2026-07-01T00:00:00.000Z",
    status: "published" as const,
  };
  return { ...seed, methodologyRoot: canopyProofMrvMethodologyRoot(seed) };
}

function fakeControlFromBinding(binding: Fixture["binding"]) {
  const fakeHash = hashJson({ kind: "fake-control" });
  return {
    factType: "environmental_proof_lifecycle_control" as const,
    id: `cp_fake_${fakeHash.slice(0, 24)}`,
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    recordId: binding.recordId,
    recordRoot: binding.recordRoot,
    bindingId: binding.id,
    bindingRoot: binding.bindingRoot,
    action: "suspend" as const,
    priorState: "active" as const,
    priorProjectionRoot: fakeHash,
    rationale: "This synthetic fact is used only to verify duplicate identifier rejection before replay begins.",
    conflictDisclosure: "This synthetic fact has no authority and exists only inside a negative unit-test fixture.",
    sourceProjectionRoots: [fakeHash],
    sourceRoot: fakeHash,
    governor,
    decidedAt: "2026-07-14T10:00:00.000Z",
    commandHash: fakeHash,
    recordSequence: 3,
    previousEventRoot: fakeHash,
    controlHash: fakeHash,
    controlRoot: fakeHash,
    safety: binding.safety,
    auditEvent: binding.auditEvent,
  };
}

function forgeBindingSourceRoot(
  binding: CanopyProofEnvironmentalProofLifecycleBindingFact,
): CanopyProofEnvironmentalProofLifecycleBindingFact {
  const sourceRoot = hashJson({ kind: "forged-lifecycle-source-root" });
  const authoritySeed = {
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    recordId: binding.recordId,
    recordRoot: binding.recordRoot,
    recordIssuedAt: binding.recordIssuedAt,
    governedRecordProjectionRoot: binding.governedRecordProjectionRoot,
    mrvSnapshotId: binding.mrvSnapshotId,
    mrvSnapshotRoot: binding.mrvSnapshotRoot,
    mrvEdgeSetRoot: binding.mrvEdgeSetRoot,
    mrvGraphRoot: binding.mrvGraphRoot,
    mrvReviewedAt: binding.mrvReviewedAt,
    methodologyId: binding.methodologyId,
    methodologyPublicationRoot: binding.methodologyPublicationRoot,
    observationPeriod: binding.observationPeriod,
    validity: binding.validity,
    monitoringSchedule: binding.monitoringSchedule,
    assertionType: binding.assertionType,
    assertionScopeHash: binding.assertionScopeHash,
    locationScopeHash: binding.locationScopeHash,
    uncertaintyHash: binding.uncertaintyHash,
    limitationHashes: binding.limitationHashes,
    relianceStatement: binding.relianceStatement,
    issuer: binding.issuer,
    signingKeyAuthorityId: binding.signingKeyAuthorityId,
    signingKeyRoot: binding.signingKeyRoot,
    sourceEventRoots: binding.sourceEventRoots,
    sourceRoot,
    boundAt: binding.boundAt,
  };
  const signaturePayloadHash = hashJson({
    kind: "canopyproof-environmental-proof-signature-payload-v1",
    ...authoritySeed,
  });
  const commandHash = hashJson({
    kind: "canopyproof-environmental-proof-lifecycle-binding-command-v1",
    ...authoritySeed,
    signaturePayloadHash,
  });
  const id = `cp_environmental_proof_lifecycle_${commandHash.slice(0, 24)}`;
  const seed = {
    id,
    ...authoritySeed,
    signaturePayloadHash,
    commandHash,
    recordSequence: binding.recordSequence,
    previousEventRoot: binding.previousEventRoot,
  };
  const bindingHash = hashJson({ kind: "canopyproof-environmental-proof-lifecycle-binding-v1", ...seed });
  const bindingRoot = hashJson({
    kind: "canopyproof-environmental-proof-lifecycle-binding-root-v1",
    recordRoot: binding.recordRoot,
    mrvSnapshotRoot: binding.mrvSnapshotRoot,
    signingKeyRoot: binding.signingKeyRoot,
    sourceRoot,
    bindingHash,
    previousEventRoot: binding.previousEventRoot,
    recordSequence: binding.recordSequence,
  });
  const payload = {
    factType: "environmental_proof_lifecycle_binding" as const,
    ...seed,
    bindingHash,
    bindingRoot,
    safety: binding.safety,
  };
  const auditEvent = appendCanopyProofAuditEvent([], {
    action: "ASSERT",
    actor: binding.issuer.id,
    entityType: "environmental_proof_lifecycle_binding",
    entityId: id,
    payload,
    createdAt: binding.boundAt,
    rationale:
      "A canonical Environmental Proof Record was bound to reviewed MRV lineage, fixed validity, and managed-key authority.",
  }).at(-1)!;
  return { ...payload, auditEvent };
}
