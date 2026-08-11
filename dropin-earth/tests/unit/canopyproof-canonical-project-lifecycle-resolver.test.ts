import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import type { Prisma } from "@prisma/client";
import {
  CanopyProofCanonicalProjectLifecycleAuthorityResolver,
} from "../../services/api/src/domain/canopyproof/canonical-project-lifecycle-resolver.js";
import type { CanopyProofEnvironmentalProofLifecycleCurrentProjectProjection } from "../../services/api/src/domain/canopyproof/environmental-proof-lifecycle-postgres.js";
import type { CanopyProofFundingAccountabilityCurrentProjection } from "../../services/api/src/domain/canopyproof/funding-accountability-authority.js";
import {
  buildCanopyProofProjectLifecycleActorAuthorityRoot,
  buildCanopyProofProjectLifecycleFundingSource,
  buildCanopyProofProjectLifecycleMonitoringSource,
  buildCanopyProofProjectLifecycleProofSource,
  canopyProofProjectLifecycleScopes,
  type CanopyProofProjectLifecycleActorSnapshot,
} from "../../services/api/src/domain/canopyproof/project-lifecycle-authority.js";
import type { CanopyProofProjectLifecycleAuthorityQuery } from "../../services/api/src/domain/canopyproof/project-lifecycle-postgres.js";

const organizationId = "org_project_source_resolver";
const projectId = "project_source_resolver";
const projectRoot = root("registered-project");
const policyRoot = root("project-lifecycle-policy");
const monitoringPlanRoot = root("monitoring-plan");
const effectiveAt = "2026-07-19T08:00:00.000Z";
const governor = accreditedActor("project-source-governor", "org_project_source_governance");

test("canonical project lifecycle resolver reconstructs current subject authority", async () => {
  const subject = subjectActor("project-source-owner");
  const transaction = transactionWithRows([
    [projectAuthorityRow()],
    [{ is_current: true }],
    [
      {
        participant_id: subject.id,
        participant_root: subject.participantRoot,
        organization_id: subject.organizationId,
        organization_root: subject.organizationRoot,
        membership_id: subject.membershipId,
        membership_role: subject.role,
        membership_root: subject.membershipRoot,
      },
    ],
  ]);
  const resolver = createResolver();

  assert.deepEqual(resolver.getStatus(), {
    service: "canopyproof-canonical-project-lifecycle-source-resolver",
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    callerTransactionRequired: true,
    currentHumanAuthorityRequired: true,
    completeSourceSetRequired: true,
    closureAuthorityAvailable: false,
    restorationAuthorityAvailable: false,
  });
  assert.deepEqual(
    await resolver.resolve(
      authorityQuery({
        operation: "register",
        actorId: subject.id,
        actorOrganizationId: organizationId,
        actorRole: "owner",
        requiredScope: canopyProofProjectLifecycleScopes.propose,
        transitionFromStage: null,
        transitionToStage: null,
        sourceKind: null,
        sourceAuthorityRoot: null,
      }),
      transaction,
    ),
    {
      actor: subject,
      projectAuthorityRoot: projectRoot,
      projectStatus: "submitted",
      policyRoot,
      sourceAuthorityRoot: null,
      restorationAuthorityRoot: null,
    },
  );
});

test("canonical project lifecycle resolver derives the complete funding source", async () => {
  const funding = fundingProjection();
  const currentProjectRoot = root("current-project-funded");
  const resolver = createResolver({ funding });
  const expected = buildCanopyProofProjectLifecycleFundingSource({
    projectionRoots: [funding.publicProjection.projectionRoot],
    currentRoots: [funding.currentRoot, currentProjectRoot].sort(),
    allocatedCents: funding.operationalTotals.allocatedCents,
    resolvedAt: effectiveAt,
  });
  const resolved = await resolver.resolve(
    authorityQuery({ sourceAuthorityRoot: expected.sourceAuthorityRoot }),
    transactionWithRows([
      [projectAuthorityRow({ current_project_root: currentProjectRoot, current_project_status: "active" })],
      [{ is_current: true }],
    ]),
  );
  assert.equal(resolved.sourceAuthorityRoot, expected.sourceAuthorityRoot);
  assert.equal(resolved.actor.authorityRoot, governor.authorityRoot);
});

test("canonical project lifecycle resolver derives active proof roots and rejects adverse proof", async () => {
  const currentProjectRoot = root("current-project-proof");
  const active = proofProjection("active-record", "active");
  const expected = buildCanopyProofProjectLifecycleProofSource({
    lifecycleProjectionRoots: [active.projection.projectionRoot],
    currentRoots: [
      currentProjectRoot,
      active.governedRecordProjectionRoot,
      active.mrvGraphRoot,
    ].sort(),
    resolvedAt: effectiveAt,
  });
  const resolved = await createResolver({ proof: [active] }).resolve(
    authorityQuery({
      transitionFromStage: "FUNDED",
      transitionToStage: "VERIFIED",
      sourceKind: "proof",
      sourceAuthorityRoot: expected.sourceAuthorityRoot,
    }),
    transactionWithRows([
      [projectAuthorityRow({ current_project_root: currentProjectRoot, current_project_status: "active" })],
      [{ is_current: true }],
    ]),
  );
  assert.equal(resolved.sourceAuthorityRoot, expected.sourceAuthorityRoot);

  await assert.rejects(
    createResolver({
      proof: [active, proofProjection("challenged-record", "challenged")],
    }).resolve(
      authorityQuery({
        transitionFromStage: "FUNDED",
        transitionToStage: "VERIFIED",
        sourceKind: "proof",
      }),
      transactionWithRows([
        [projectAuthorityRow({ current_project_root: currentProjectRoot, current_project_status: "active" })],
        [{ is_current: true }],
      ]),
    ),
    /ADVERSE_PROOF_AUTHORITY_PRESENT/,
  );
});

test("canonical project lifecycle resolver binds every accepted post-verification monitoring root", async () => {
  const firstRoot = root("monitoring-one");
  const latestRoot = root("monitoring-two");
  const expected = buildCanopyProofProjectLifecycleMonitoringSource({
    monitoringEventRoots: [firstRoot, latestRoot].sort(),
    latestObservedAt: "2026-07-19T07:00:00.000Z",
    monitoringPlanRoot,
    resolvedAt: effectiveAt,
  });
  const query = authorityQuery({
    transitionFromStage: "VERIFIED",
    transitionToStage: "LONG_TERM_OBSERVATION",
    sourceKind: "monitoring",
    sourceAuthorityRoot: expected.sourceAuthorityRoot,
  });
  const rows = [
    [projectAuthorityRow({ current_project_root: latestRoot, current_project_status: "monitored" })],
    [{ is_current: true }],
    [{ transitioned_at: new Date("2026-07-19T05:00:00.000Z") }],
    [
      { state: "accepted", observed_at: new Date("2026-07-19T06:00:00.000Z"), monitoring_root: firstRoot },
      { state: "accepted", observed_at: new Date("2026-07-19T07:00:00.000Z"), monitoring_root: latestRoot },
    ],
  ];
  const resolved = await createResolver().resolve(query, transactionWithRows(rows));
  assert.equal(resolved.sourceAuthorityRoot, expected.sourceAuthorityRoot);

  const unresolvedRows = [
    [projectAuthorityRow({ current_project_root: latestRoot, current_project_status: "monitored" })],
    [{ is_current: true }],
    [{ transitioned_at: new Date("2026-07-19T05:00:00.000Z") }],
    [
      { state: "accepted", observed_at: new Date("2026-07-19T06:00:00.000Z"), monitoring_root: firstRoot },
      { state: "needs_review", observed_at: new Date("2026-07-19T07:00:00.000Z"), monitoring_root: latestRoot },
    ],
  ];
  await assert.rejects(
    createResolver().resolve(query, transactionWithRows(unresolvedRows)),
    /ACCEPTED_MONITORING_REQUIRED/,
  );
});

test("canonical project lifecycle resolver fails closed for policy drift, closure, and restoration", async () => {
  await assert.rejects(
    createResolver().resolve(
      authorityQuery({}),
      transactionWithRows([[projectAuthorityRow()], [{ is_current: false }]]),
    ),
    /POLICY_AUTHORITY_SUPERSEDED/,
  );

  await assert.rejects(
    createResolver().resolve(
      authorityQuery({
        transitionFromStage: "LONG_TERM_OBSERVATION",
        transitionToStage: "CLOSED",
        sourceKind: "closure",
      }),
      transactionWithRows([[projectAuthorityRow()], [{ is_current: true }]]),
    ),
    /CLOSURE_AUTHORITY_UNAVAILABLE/,
  );

  await assert.rejects(
    createResolver().resolve(
      authorityQuery({
        operation: "control",
        transitionFromStage: null,
        transitionToStage: null,
        controlAction: "restore",
        sourceKind: null,
        sourceAuthorityRoot: null,
        restorationAuthorityRoot: root("opaque-restoration-root"),
      }),
      transactionWithRows([[projectAuthorityRow()], [{ is_current: true }]]),
    ),
    /RESTORATION_AUTHORITY_UNAVAILABLE/,
  );
});

function createResolver(input: Readonly<{
  funding?: CanopyProofFundingAccountabilityCurrentProjection;
  proof?: readonly CanopyProofEnvironmentalProofLifecycleCurrentProjectProjection[];
}> = {}) {
  return CanopyProofCanonicalProjectLifecycleAuthorityResolver.fromDependencies({
    fundingRepository: {
      resolveCurrentProjectionInTransaction: async () => input.funding,
    },
    proofLifecycleRepository: {
      listProjectLifecyclesInTransaction: async () => input.proof ?? [],
    },
    accreditationResolver: {
      resolveAccreditedActor: async () => governor,
    },
  });
}

function authorityQuery(
  overrides: Partial<CanopyProofProjectLifecycleAuthorityQuery>,
): CanopyProofProjectLifecycleAuthorityQuery {
  return {
    operation: "transition",
    organizationId,
    projectId,
    generation: 1,
    actorId: governor.id,
    actorOrganizationId: governor.organizationId,
    actorRole: governor.role,
    requiredScope: canopyProofProjectLifecycleScopes.govern,
    projectAuthorityRoot: projectRoot,
    projectStatus: "submitted",
    policyId: "policy_project_lifecycle_v1",
    policyRoot,
    transitionFromStage: "PROPOSED",
    transitionToStage: "FUNDED",
    controlAction: null,
    monitoringPlanRoot,
    sourceKind: "funding",
    sourceAuthorityRoot: root("candidate-source-root"),
    restorationAuthorityRoot: null,
    effectiveAt,
    ...overrides,
  };
}

function projectAuthorityRow(
  overrides: Partial<{
    current_project_root: string;
    current_project_status:
      | "submitted"
      | "under_review"
      | "active"
      | "monitored"
      | "challenged"
      | "suspended"
      | "archived";
  }> = {},
) {
  return {
    organization_id: organizationId,
    registered_project_root: projectRoot,
    registered_project_status: "submitted",
    current_project_root: overrides.current_project_root ?? projectRoot,
    current_project_status: overrides.current_project_status ?? "submitted",
  };
}

function transactionWithRows(responses: readonly (readonly unknown[])[]) {
  let index = 0;
  return {
    $queryRaw: async () => responses[index++] ?? [],
  } as unknown as Prisma.TransactionClient;
}

function subjectActor(id: string): CanopyProofProjectLifecycleActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role: "owner" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: root(`participant:${id}`),
    organizationRoot: root(`organization:${organizationId}`),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: root(`membership:${id}`),
    authoritySource: "subject_membership" as const,
    accreditationScope: [] as const,
  };
  return { ...seed, authorityRoot: buildCanopyProofProjectLifecycleActorAuthorityRoot(seed) };
}

function accreditedActor(
  id: string,
  actorOrganizationId: string,
): CanopyProofProjectLifecycleActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role: "verifier" as const,
    verificationStatus: "verified" as const,
    organizationId: actorOrganizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: root(`participant:${id}`),
    organizationRoot: root(`organization:${actorOrganizationId}`),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: root(`membership:${id}`),
    authoritySource: "canonical_accreditation" as const,
    accreditationId: `accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationDecisionRoot: root(`accreditation-decision:${id}`),
    accreditationProjectionRoot: root(`accreditation-projection:${id}`),
    accreditationValidFrom: "2026-01-01T00:00:00.000Z",
    accreditationValidUntil: "2030-01-01T00:00:00.000Z",
    accreditationScope: [canopyProofProjectLifecycleScopes.govern],
  };
  return { ...seed, authorityRoot: buildCanopyProofProjectLifecycleActorAuthorityRoot(seed) };
}

function fundingProjection(): CanopyProofFundingAccountabilityCurrentProjection {
  return {
    organizationId,
    projectId,
    publicationId: "funding_publication_v1",
    publicationRoot: root("funding-publication"),
    projectionRoot: root("funding-projection"),
    state: "active",
    evaluatedAt: effectiveAt,
    operationalTotals: {
      committedCents: 2_000_000,
      allocatedCents: 1_250_000,
      reconciledCents: 500_000,
      challengedCents: 0,
    },
    publicProjection: {
      schemaVersion: "canopyproof.funding-accountability.v1",
      publicationId: "funding_publication_v1",
      organizationId,
      projectId,
      sourcePublicId: "fund_public_source_v1",
      sourceType: "grant",
      sourceJurisdictionCode: "GH",
      sourceRestriction: "project_restricted",
      purposeCode: "restoration_operations",
      candidateRoot: root("funding-candidate"),
      sourceAuthorityRoot: root("funding-source-authority"),
      totals: {
        committedCents: 2_000_000,
        allocatedCents: 1_250_000,
        reconciledCents: 500_000,
        challengedCents: 0,
      },
      milestoneCount: 1,
      reconciledMilestoneCount: 1,
      challengedMilestoneCount: 0,
      evidenceMemberCount: 1,
      proofRecordMemberCount: 1,
      evidenceRoot: root("funding-evidence"),
      proofRecordRoot: root("funding-proof-record"),
      policyId: "funding_policy_v1",
      policyRoot: root("funding-policy"),
      reportingPeriodStart: "2026-01-01T00:00:00.000Z",
      reportingPeriodEnd: "2026-06-30T00:00:00.000Z",
      validFrom: "2026-07-01T00:00:00.000Z",
      validUntil: "2027-07-01T00:00:00.000Z",
      projectionRoot: root("funding-public-projection"),
    },
    controlRoot: null,
    currentRoot: root("funding-current"),
    safety: fundingSafety(),
  };
}

function proofProjection(
  label: string,
  state: "active" | "challenged",
): CanopyProofEnvironmentalProofLifecycleCurrentProjectProjection {
  return {
    projection: {
      organizationId,
      projectId,
      recordId: `record_${label}`,
      recordRoot: root(`record:${label}`),
      bindingId: `binding_${label}`,
      bindingRoot: root(`binding:${label}`),
      state,
      evaluatedAt: effectiveAt,
      governedRecordState: state === "challenged" ? "challenged" : "issued",
      sourceAuthorityCurrent: true,
      mrvState: "reviewed_for_lineage",
      boundMrvSnapshotCurrent: true,
      keyState: "active",
      signatureVerified: true,
      validityCurrent: true,
      issueCodes: state === "challenged" ? ["record_challenged"] : [],
      projectionRoot: root(`lifecycle-projection:${label}`),
      safety: lifecycleSafety(),
    },
    governedRecordProjectionRoot: root(`governed-record-projection:${label}`),
    mrvGraphRoot: root(`mrv-graph:${label}`),
  };
}

function fundingSafety() {
  return {
    routeMounted: false,
    schedulerMounted: false,
    productionActivationEnabled: false,
    transparencyOnly: true,
    appendOnly: true,
    exactRetryRequired: true,
    currentSourceReResolutionRequired: true,
    threeIndependentAccreditedHumansRequired: true,
    integerCentsOnly: true,
    privateAndPaymentDataForbidden: true,
    challengeAndWithdrawalFailClosed: true,
    noMainnetFunds: true,
    noAutomaticCanopyDistribution: true,
    notPaymentRail: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notOwnershipRight: true,
    notGuaranteedYield: true,
  } as const;
}

function lifecycleSafety() {
  return {
    extendsCanonicalEnvironmentalProofRecord: true,
    immutableIssuancePreserved: true,
    governedRecordProjectionRequired: true,
    reviewedMrvLineageRequired: true,
    managedKeyVerificationRequired: true,
    detachedSignatureVerificationRequired: true,
    privateKeyMaterialForbidden: true,
    humanIssuerRequired: true,
    independentHumanGovernanceRequired: true,
    appendOnly: true,
    routeMounted: false,
    productionActivationEnabled: false,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  } as const;
}

function root(label: string) {
  return hashJson({ kind: "canopyproof-project-lifecycle-source-resolver-test-v1", label });
}
