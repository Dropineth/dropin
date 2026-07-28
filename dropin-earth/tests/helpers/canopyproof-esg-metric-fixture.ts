import { hashJson } from "@dropin/crypto";
import type {
  CanopyProofEnvironmentalProofRecord,
  CanopyProofEnvironmentalProofSafetyBoundary,
} from "../../services/api/src/domain/canopyproof/environmental-proof-authority.js";
import type { CanopyProofEnvironmentalProofChallengedRecordProjection } from
  "../../services/api/src/domain/canopyproof/environmental-proof-challenge-authority.js";
import {
  canopyProofEnvironmentalProofLifecycleSafetyBoundary,
  type CanopyProofEnvironmentalProofLifecycleBindingFact,
  type CanopyProofEnvironmentalProofLifecycleProjection,
  type CanopyProofEnvironmentalProofSignatureReceiptFact,
} from "../../services/api/src/domain/canopyproof/environmental-proof-lifecycle-authority.js";
import type {
  CanopyProofCanonicalEsgSourceAuthority,
  CanopyProofReportingOrganizationSnapshot,
} from "../../services/api/src/domain/canopyproof/esg-reporting-authority.js";
import type { CanopyProofVerificationActorSnapshot } from
  "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  CanopyProofMethodologyGovernanceAuthorityService,
} from "../../services/api/src/domain/canopyproof/methodology-governance-authority.js";
import { CanopyProofMethodologyRegistryService } from
  "../../services/api/src/domain/canopyproof/methodology-registry.js";
import {
  appendCanopyProofAuditEvent,
  type CanopyProofAuditEvent,
} from "../../services/api/src/domain/canopyproof/proof-engine.js";

export const esgMetricReviewedAt = "2026-07-14T08:00:00.000Z";

export function createEsgMetricFixture(
  options: Readonly<{ organizationId?: string; projectId?: string; suffix?: string }> = {},
) {
  const suffix = options.suffix ?? "001";
  const organizationId = options.organizationId ?? `cp_esg_metric_org_${suffix}`;
  const projectId = options.projectId ?? `cp_esg_metric_project_${suffix}`;
  const organization: CanopyProofReportingOrganizationSnapshot = {
    id: organizationId,
    name: `CanopyProof Metric Research ${suffix}`,
    verificationStatus: "verified",
    organizationRoot: fixtureHash(`organization:${organizationId}`),
  };
  const methodology = createMethodologyAuthority(organization, suffix);
  const publisher = metricActor(organization, `cp_metric_publisher_${suffix}`, "researcher", ["esg_metric:govern"]);
  const definitionReviewers = [
    metricActor(organization, `cp_metric_definition_reviewer_a_${suffix}`, "verifier", ["esg_metric:govern"]),
    metricActor(organization, `cp_metric_definition_reviewer_b_${suffix}`, "researcher", ["esg_metric:govern"]),
  ];
  const calculator = metricActor(organization, `cp_metric_calculator_${suffix}`, "researcher", ["esg_metric:calculate"]);
  const resultReviewer = metricActor(organization, `cp_metric_result_reviewer_${suffix}`, "verifier", ["esg_metric:review"]);
  const source = createCurrentEnvironmentalSource(organization, projectId, publisher, methodology.bundle, suffix);
  return {
    organization,
    projectId,
    methodology,
    publisher,
    definitionReviewers,
    calculator,
    resultReviewer,
    source,
    definitionInput: {
      organizationId,
      slug: "verified_tree_survival_rate",
      version: "v1.0.0",
      title: "Verified tree survival rate",
      description:
        "Percentage of independently reviewed planted trees that remain alive within the bounded observation period.",
      dimension: "percentage",
      canonicalUnit: "percent",
      allowedUnits: ["percent"],
      precisionScale: 2,
      valueDomain: "non_negative",
      roundingMode: "half_even",
      aggregationMethod: "weighted_mean",
      spatialAggregation: "project",
      temporalAggregation: "period_end",
      sourceRequirements: ["reviewed_mrv", "active_signed_lifecycle", "current_environmental_proof"],
      uncertaintyPolicy: {
        method: "confidence_interval",
        allowNotQuantified: false,
        requiredComponents: ["sampling", "field_measurement"],
      },
      frameworkMappings: [
        {
          framework: "GRI",
          disclosureCode: "GRI-304",
          rationale: "Preparation mapping for evidence-linked biodiversity and restoration condition review.",
          limitations: ["The mapping is preparation-only and is not a framework assurance opinion."],
        },
        {
          framework: "SDG",
          disclosureCode: "SDG-15",
          rationale: "Preparation mapping for restoration monitoring relevant to life-on-land review.",
          limitations: ["The mapping does not assert United Nations endorsement or outcome certification."],
        },
      ],
      methodologyPublicationId: methodology.bundle.publication.id,
      limitations: ["Survival is bounded to sampled evidence, observation dates, and the stated uncertainty interval."],
      effectiveAt: "2026-07-14T07:00:00.000Z",
    },
    resultInput: {
      organizationId,
      projectId,
      definitionId: "assigned-after-publication",
      sourceRecordIds: [source.record.id],
      reportingPeriod: {
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-07-14T07:30:00.000Z",
      },
      observationPeriod: {
        startsAt: "2026-06-15T00:00:00.000Z",
        endsAt: "2026-07-14T07:00:00.000Z",
      },
      valueState: "reported",
      decimalValue: "87.5",
      unit: "percent",
      uncertainty: {
        kind: "interval",
        lower: "84.2",
        upper: "90.8",
        confidenceLevelPct: 95,
        components: ["sampling", "field_measurement"],
      },
      calculationArtifactHash: fixtureHash(`calculation:${suffix}`),
      reviewRationale:
        "Independent human reviewer accepted the exact calculation artifact, source roots, unit, and uncertainty interval.",
      limitations: ["The metric is an accountability observation and not a certified environmental instrument."],
      calculatedAt: "2026-07-14T07:45:00.000Z",
      reviewedAt: esgMetricReviewedAt,
    },
  } as const;
}

export function metricActor(
  organization: CanopyProofReportingOrganizationSnapshot,
  id: string,
  role: "owner" | "admin" | "verifier" | "researcher",
  accreditationScope: readonly string[],
): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId: organization.id,
    organizationVerificationStatus: "verified" as const,
    participantRoot: fixtureHash(`participant:${id}`),
    organizationRoot: organization.organizationRoot,
    membershipId: `cp_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: fixtureHash(`membership:${id}`),
    accreditationId: `cp_accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationRoot: fixtureHash(`accreditation:${id}`),
    accreditationScope: [...accreditationScope].sort(),
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

export function fixtureHash(value: string) {
  return hashJson({ kind: "canopyproof-esg-metric-test-fixture", value });
}

function createMethodologyAuthority(
  organization: CanopyProofReportingOrganizationSnapshot,
  suffix: string,
) {
  const registry = new CanopyProofMethodologyRegistryService();
  const methodology = registry.createMethodology(
    {
      id: `cp_metric_methodology_${suffix}`,
      slug: `verified-tree-survival-${suffix}`,
      version: "v1.0.0",
      title: "Verified Tree Survival Measurement Methodology",
      scope: "ecosystem_restoration",
      status: "draft",
      summary:
        "Bounded methodology for calculating tree survival from current reviewed environmental evidence and monitoring lineage.",
      requiredDataSources: ["field_photo", "gps_trace", "governance_approval"],
      qualityGates: [
        "media_hash_required",
        "gps_hash_required",
        "duplicate_detection_required",
        "human_review_required",
        "governance_approval_required",
        "public_challenge_window_required",
        "monitoring_timeline_required",
      ],
      minimumGpsAccuracyMeters: 25,
      monitoringCadenceDays: 30,
      evidenceRetentionDays: 2_555,
      governanceApprovalIds: [],
      limitations: ["Methodology publication does not create carbon, financial, tax, token, or assurance authority."],
      createdAt: "2026-07-14T05:00:00.000Z",
    },
    `cp_metric_methodology_author_${suffix}`,
  );
  const service = new CanopyProofMethodologyGovernanceAuthorityService([methodology]);
  const policyCreator = metricActor(organization, `cp_metric_policy_creator_${suffix}`, "owner", []);
  const policy = service.createPolicy(
    {
      subject: "methodology_publication",
      title: "Independent ESG metric methodology publication policy",
      requiredApprovals: 2,
      allowedReviewerRoles: ["researcher", "verifier"],
      createdAt: "2026-07-14T05:05:00.000Z",
    },
    policyCreator,
  );
  const verifier = metricActor(
    organization,
    `cp_metric_methodology_verifier_${suffix}`,
    "verifier",
    ["methodology publication review"],
  );
  const verifierApproval = service.approveMethodology(
    methodology.id,
    {
      decision: "approve",
      rationale: "Independent verifier approves the exact metric methodology and publication policy roots.",
      conflictDisclosure: "No financial, authorship, employment, familial, or operational conflict is known or undisclosed.",
      limitations: ["Approval is bounded to this immutable technical methodology."],
      sourceEventRoots: [methodology.auditEvent.eventRoot, policy.auditEvent.eventRoot],
      decidedAt: "2026-07-14T05:15:00.000Z",
    },
    verifier,
  );
  const researcher = metricActor(organization, `cp_metric_methodology_researcher_${suffix}`, "researcher", []);
  const researcherApproval = service.approveMethodology(
    methodology.id,
    {
      decision: "approve",
      rationale: "Independent research reviewer accepts the technical method after the verifier decision.",
      conflictDisclosure: "No financial, authorship, employment, familial, or operational conflict is known or undisclosed.",
      limitations: ["Approval does not authorize external framework conformance or environmental credits."],
      sourceEventRoots: [
        methodology.auditEvent.eventRoot,
        policy.auditEvent.eventRoot,
        verifierApproval.auditEvent.eventRoot,
      ],
      decidedAt: "2026-07-14T05:25:00.000Z",
    },
    researcher,
  );
  const methodologyPublisher = metricActor(organization, `cp_metric_methodology_publisher_${suffix}`, "admin", []);
  service.publishMethodology(
    methodology.id,
    {
      approvalIds: [verifierApproval.id, researcherApproval.id],
      rationale: "Publisher records the complete independent human quorum for the bounded metric methodology.",
      limitations: ["Publication remains subject to supersession and continuing scientific governance."],
      sourceEventRoots: [
        methodology.auditEvent.eventRoot,
        policy.auditEvent.eventRoot,
        verifierApproval.auditEvent.eventRoot,
        researcherApproval.auditEvent.eventRoot,
      ],
      publishedAt: "2026-07-14T05:35:00.000Z",
    },
    methodologyPublisher,
  );
  return {
    service,
    bundle: service.getCurrentPublicationBundle(methodology.id),
    projection: service.getPublicationProjection(methodology.id),
  };
}

function createCurrentEnvironmentalSource(
  organization: CanopyProofReportingOrganizationSnapshot,
  projectId: string,
  issuer: CanopyProofVerificationActorSnapshot,
  methodology: ReturnType<typeof createMethodologyAuthority>["bundle"],
  suffix: string,
): CanopyProofCanonicalEsgSourceAuthority {
  const id = `cp_metric_environmental_proof_${suffix}`;
  const claimBoundary = environmentalProofSafety();
  const recordPayload = {
    factType: "environmental_proof_record" as const,
    id,
    recordType: "environmental_proof_record" as const,
    candidateId: `${id}_candidate`,
    candidateRoot: fixtureHash(`candidate:${id}`),
    authorityRoot: fixtureHash(`record-authority:${id}`),
    organizationId: organization.id,
    projectId,
    projectRoot: fixtureHash(`project:${organization.id}:${projectId}`),
    methodologyId: methodology.methodology.id,
    methodologyHash: methodology.methodology.methodologyHash,
    methodologyPublicationId: methodology.publication.id,
    methodologyPublicationRoot: methodology.publication.publicationRoot,
    policyId: methodology.policy.id,
    policyRoot: methodology.policy.policyRoot,
    evidenceIds: [`cp_metric_evidence_${suffix}`],
    evidenceRoot: fixtureHash(`evidence:${suffix}`),
    evidenceFinalDecisionIds: [`cp_metric_final_decision_${suffix}`],
    evidenceFinalDecisionRoots: [fixtureHash(`final-decision:${suffix}`)],
    monitoringEventIds: [`cp_metric_monitoring_${suffix}`],
    monitoringRoot: fixtureHash(`monitoring:${suffix}`),
    contributorIds: [issuer.id],
    publicLocation: { latitude: 1.2, longitude: 103.8, regionId: "cp_metric_region", areaHectares: 12 },
    confidenceScore: 89,
    governanceApprovalIds: ["cp_metric_record_approval_1", "cp_metric_record_approval_2"],
    governanceApprovalRoots: [fixtureHash("record approval 1"), fixtureHash("record approval 2")].sort(),
    governanceQuorumRoot: fixtureHash("record approval quorum"),
    issuer,
    rationale: "Independent governance approved a bounded environmental accountability record for metric calculation.",
    limitations: ["The record is bounded to its evidence, methodology, monitoring, and observation period."],
    sourceEventRoots: [fixtureHash(`record-source-event:${suffix}`)],
    sourceRoot: fixtureHash(`record-source:${suffix}`),
    issuedAt: "2026-07-14T06:00:00.000Z",
    commandHash: fixtureHash(`record-command:${suffix}`),
    candidateSequence: 4,
    previousEventRoot: fixtureHash(`record-previous-event:${suffix}`),
    recordHash: fixtureHash(`record-hash:${suffix}`),
    recordRoot: fixtureHash(`record-root:${suffix}`),
    status: "issued" as const,
    claimBoundary,
  };
  const record: CanopyProofEnvironmentalProofRecord = {
    ...recordPayload,
    auditEvent: auditEvent("FULFILL", issuer.id, "environmental_proof_record", id, recordPayload),
  };
  const governedRecordProjection = challengedProjection(record);
  const lifecycleBinding = lifecycleBindingFact(record, governedRecordProjection, issuer, suffix);
  const signatureReceipt = signatureReceiptFact(lifecycleBinding, suffix);
  return {
    record,
    governedRecordProjection,
    lifecycleBinding,
    signatureReceipt,
    lifecycleProjection: lifecycleProjection({ record, governedRecordProjection, lifecycleBinding, signatureReceipt }),
  };
}

function challengedProjection(
  record: CanopyProofEnvironmentalProofRecord,
): CanopyProofEnvironmentalProofChallengedRecordProjection {
  const seed = {
    recordId: record.id,
    recordRoot: record.recordRoot,
    state: "issued" as const,
    baseState: "issued" as const,
    sourceAuthorityCurrent: true,
    challengeState: undefined,
    challengeId: undefined,
    challengeRoot: undefined,
    resolutionId: undefined,
    resolutionRoot: undefined,
  };
  return {
    ...seed,
    projectionRoot: hashJson({ kind: "canopyproof-environmental-proof-challenged-record-projection-v1", ...seed }),
    safety: challengeSafety(),
  };
}

function lifecycleBindingFact(
  record: CanopyProofEnvironmentalProofRecord,
  projection: CanopyProofEnvironmentalProofChallengedRecordProjection,
  issuer: CanopyProofVerificationActorSnapshot,
  suffix: string,
): CanopyProofEnvironmentalProofLifecycleBindingFact {
  const id = `cp_metric_lifecycle_${suffix}`;
  const safety = canopyProofEnvironmentalProofLifecycleSafetyBoundary();
  const payload = {
    factType: "environmental_proof_lifecycle_binding" as const,
    id,
    organizationId: record.organizationId,
    projectId: record.projectId,
    recordId: record.id,
    recordRoot: record.recordRoot,
    recordIssuedAt: record.issuedAt,
    governedRecordProjectionRoot: projection.projectionRoot,
    mrvSnapshotId: `cp_metric_mrv_snapshot_${suffix}`,
    mrvSnapshotRoot: fixtureHash(`mrv-snapshot:${suffix}`),
    mrvEdgeSetRoot: fixtureHash(`mrv-edges:${suffix}`),
    mrvGraphRoot: fixtureHash(`mrv-graph:${suffix}`),
    mrvReviewedAt: "2026-07-14T06:20:00.000Z",
    methodologyId: record.methodologyId,
    methodologyPublicationRoot: record.methodologyPublicationRoot,
    observationPeriod: { startsAt: "2026-06-01T00:00:00.000Z", endsAt: "2026-07-14T05:30:00.000Z" },
    validity: { validFrom: "2026-07-14T06:30:00.000Z", expiresAt: "2026-08-14T08:00:00.000Z" },
    monitoringSchedule: { cadenceDays: 7, nextDueAt: "2026-07-21T08:00:00.000Z", graceDays: 2 },
    assertionType: "restoration_activity" as const,
    assertionScopeHash: fixtureHash(`assertion:${suffix}`),
    locationScopeHash: fixtureHash(`location:${suffix}`),
    uncertaintyHash: fixtureHash(`uncertainty:${suffix}`),
    limitationHashes: [fixtureHash(`limitation:${suffix}`)],
    relianceStatement: "environmental_accountability_only" as const,
    issuer,
    signingKeyAuthorityId: `cp_metric_signing_key_${suffix}`,
    signingKeyRoot: fixtureHash(`signing-key:${suffix}`),
    sourceEventRoots: [record.auditEvent.eventRoot],
    sourceRoot: fixtureHash(`lifecycle-source:${suffix}`),
    signaturePayloadHash: fixtureHash(`signature-payload:${suffix}`),
    boundAt: "2026-07-14T06:30:00.000Z",
    commandHash: fixtureHash(`lifecycle-command:${suffix}`),
    recordSequence: 1,
    previousEventRoot: fixtureHash(`lifecycle-previous:${suffix}`),
    bindingHash: fixtureHash(`binding-hash:${suffix}`),
    bindingRoot: fixtureHash(`binding-root:${suffix}`),
    safety,
  };
  return {
    ...payload,
    auditEvent: auditEvent("ASSERT", issuer.id, "environmental_proof_lifecycle_binding", id, payload),
  };
}

function signatureReceiptFact(
  binding: CanopyProofEnvironmentalProofLifecycleBindingFact,
  suffix: string,
): CanopyProofEnvironmentalProofSignatureReceiptFact {
  const id = `cp_metric_signature_${suffix}`;
  const payload = {
    factType: "environmental_proof_signature_receipt" as const,
    id,
    organizationId: binding.organizationId,
    projectId: binding.projectId,
    recordId: binding.recordId,
    recordRoot: binding.recordRoot,
    bindingId: binding.id,
    bindingRoot: binding.bindingRoot,
    signingKeyAuthorityId: binding.signingKeyAuthorityId,
    signingKeyRoot: binding.signingKeyRoot,
    algorithm: "Ed25519" as const,
    signaturePayloadHash: binding.signaturePayloadHash,
    detachedSignature: "ZXh0ZXJuYWxfc2lnbmF0dXJl",
    signatureHash: fixtureHash(`signature:${suffix}`),
    externalVerifierId: "cp_metric_managed_signature_verifier",
    providerReceiptIdHash: fixtureHash(`provider-receipt-id:${suffix}`),
    providerReceiptHash: fixtureHash(`provider-receipt:${suffix}`),
    signedAt: "2026-07-14T06:40:00.000Z",
    verifiedAt: "2026-07-14T06:41:00.000Z",
    commandHash: fixtureHash(`signature-command:${suffix}`),
    recordSequence: 2,
    previousEventRoot: binding.auditEvent.eventRoot,
    sourceRoot: fixtureHash(`signature-source:${suffix}`),
    receiptHash: fixtureHash(`receipt-hash:${suffix}`),
    receiptRoot: fixtureHash(`receipt-root:${suffix}`),
    safety: binding.safety,
  };
  return {
    ...payload,
    auditEvent: auditEvent("ASSERT", binding.issuer.id, "environmental_proof_signature_receipt", id, payload),
  };
}

function lifecycleProjection(source: Readonly<{
  record: CanopyProofEnvironmentalProofRecord;
  governedRecordProjection: CanopyProofEnvironmentalProofChallengedRecordProjection;
  lifecycleBinding: CanopyProofEnvironmentalProofLifecycleBindingFact;
  signatureReceipt: CanopyProofEnvironmentalProofSignatureReceiptFact;
}>): CanopyProofEnvironmentalProofLifecycleProjection {
  const seed = {
    organizationId: source.record.organizationId,
    projectId: source.record.projectId,
    recordId: source.record.id,
    recordRoot: source.record.recordRoot,
    bindingId: source.lifecycleBinding.id,
    bindingRoot: source.lifecycleBinding.bindingRoot,
    state: "active" as const,
    evaluatedAt: esgMetricReviewedAt,
    governedRecordState: "issued" as const,
    sourceAuthorityCurrent: true,
    mrvState: "reviewed_for_lineage" as const,
    boundMrvSnapshotCurrent: true,
    keyState: "active" as const,
    signatureVerified: true,
    validityCurrent: true,
    issueCodes: [] as readonly string[],
  };
  return {
    ...seed,
    projectionRoot: hashJson({ kind: "canopyproof-environmental-proof-lifecycle-projection-v1", ...seed }),
    safety: source.lifecycleBinding.safety,
  };
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

function challengeSafety() {
  return {
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
  } as const;
}

function auditEvent(
  action: CanopyProofAuditEvent["action"],
  actorId: string,
  entityType: CanopyProofAuditEvent["entityType"],
  entityId: string,
  payload: unknown,
): CanopyProofAuditEvent {
  return appendCanopyProofAuditEvent([], {
    action,
    actor: actorId,
    entityType,
    entityId,
    payload,
    createdAt: "2026-07-14T06:50:00.000Z",
    rationale: "Deterministic authority fixture for governed ESG metric tests.",
  }).at(-1)!;
}
