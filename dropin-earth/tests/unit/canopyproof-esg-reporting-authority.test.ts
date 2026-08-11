import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofCanonicalEsgReportingAuthorityService,
  type CanopyProofCanonicalEsgSourceAuthority,
  type CanopyProofCanonicalEsgPublicationAuthority,
  type CanopyProofReportingOrganizationSnapshot,
} from "../../services/api/src/domain/canopyproof/esg-reporting-authority.js";
import { CanopyProofEsgMetricAuthorityService } from
  "../../services/api/src/domain/canopyproof/esg-metric-authority.js";
import { resolveCanonicalEsgInstitutionalSource } from
  "../../services/api/src/domain/canopyproof/institutional-reporting.js";
import type { CanopyProofVerificationActorSnapshot } from
  "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  createEsgMetricFixture,
  esgMetricReviewedAt,
  metricActor,
} from "../helpers/canopyproof-esg-metric-fixture.js";

const generatedAt = esgMetricReviewedAt;

test("canonical ESG reporting publishes only current signed authority and replays deterministically", () => {
  const fixture = reportingFixture();
  const service = new CanopyProofCanonicalEsgReportingAuthorityService();
  const first = service.publishReport(fixture.input, fixture.authority);
  const projection = service.projectReport(
    first.report.id,
    fixture.authority.sources,
    fixture.metricProjections,
    generatedAt,
  );

  assert.equal(first.report.organization.id, fixture.organization.id);
  assert.equal(first.report.sourceCount, 1);
  assert.equal(first.report.metricCount, 1);
  assert.equal(first.metricMembers.length, 1);
  assert.equal(first.report.safety.routeMounted, false);
  assert.equal(first.report.safety.productionActivationEnabled, false);
  assert.equal(projection.state, "current");
  assert.deepEqual(projection.issueCodes, []);

  const replayed = CanopyProofCanonicalEsgReportingAuthorityService.fromAuthoritySnapshot(
    service.getAuthoritySnapshot(),
  );
  assert.deepEqual(replayed.getReport(first.report.id), first);
  assert.deepEqual(
    replayed.projectReport(
      first.report.id,
      fixture.authority.sources,
      fixture.metricProjections,
      generatedAt,
    ),
    projection,
  );

  const independent = new CanopyProofCanonicalEsgReportingAuthorityService().publishReport(
    fixture.input,
    fixture.authority,
  );
  assert.equal(independent.report.reportRoot, first.report.reportRoot);
  assert.equal(independent.report.auditEvent.eventRoot, first.report.auditEvent.eventRoot);
  assert.equal(independent.members[0]?.memberRoot, first.members[0]?.memberRoot);
  assert.equal(independent.metricMembers[0]?.memberRoot, first.metricMembers[0]?.memberRoot);
});

test("institutional reporting consumes only an internally consistent current canonical ESG projection", () => {
  const fixture = reportingFixture();
  const service = new CanopyProofCanonicalEsgReportingAuthorityService();
  const bundle = service.publishReport(fixture.input, fixture.authority);
  const projection = service.projectReport(
    bundle.report.id,
    fixture.authority.sources,
    fixture.metricProjections,
    generatedAt,
  );
  const source = resolveCanonicalEsgInstitutionalSource(bundle, projection);
  const replayed = resolveCanonicalEsgInstitutionalSource(bundle, projection);

  assert.equal(source.authority, "canopyproof-canonical-esg-reporting-authority");
  assert.equal(source.projectionState, "current");
  assert.equal(source.reportRoot, bundle.report.reportRoot);
  assert.equal(source.sourceRoot, replayed.sourceRoot);
  assert.deepEqual(source.metricResultIds, bundle.report.metricResultIds);
  assert.equal(source.metricSetRoot, bundle.report.metricSetRoot);
  assert.equal(source.institutionalRelianceAuthorized, false);
  assert.equal(source.safety.routeMounted, false);

  assert.throws(
    () => resolveCanonicalEsgInstitutionalSource(bundle, { ...projection, state: "challenged" }),
    /requires a current canonical ESG projection/,
  );
  assert.throws(
    () => resolveCanonicalEsgInstitutionalSource(
      { ...bundle, members: [{ ...bundle.members[0]!, evidenceRoot: hash("tampered evidence") }] },
      projection,
    ),
    /source lineage is invalid/,
  );
  assert.throws(
    () => resolveCanonicalEsgInstitutionalSource(
      {
        ...bundle,
        metricMembers: [{ ...bundle.metricMembers[0]!, resultRoot: hash("tampered metric") }],
      },
      projection,
    ),
    /metric lineage is invalid/,
  );
});

test("canonical ESG reporting rejects agents, missing accreditation, stale proofs, and unsigned lifecycles", () => {
  const fixture = reportingFixture();
  const service = new CanopyProofCanonicalEsgReportingAuthorityService();
  const agent = actor(
    fixture.organization,
    "cp_esg_agent",
    "agent",
    "agent",
    ["esg_reporting:publish"],
  );
  assert.throws(
    () => service.publishReport(fixture.input, { ...fixture.authority, publisher: agent }),
    /publisher authority is invalid/,
  );

  const unaccredited = actor(fixture.organization, "cp_esg_unaccredited", "human", "researcher", []);
  assert.throws(
    () => service.publishReport(fixture.input, { ...fixture.authority, publisher: unaccredited }),
    /publisher authority is invalid/,
  );

  const source = fixture.authority.sources[0]!;
  const staleSource = {
    ...source,
    governedRecordProjection: challengedProjection(source.record, "stale", false),
  };
  assert.throws(
    () => service.publishReport(fixture.input, { ...fixture.authority, sources: [staleSource] }),
    /source is not current and signed/,
  );

  const unsignedSource = {
    ...source,
    lifecycleProjection: lifecycleProjection(source, { state: "issued", signatureVerified: false }),
  };
  assert.throws(
    () => service.publishReport(fixture.input, { ...fixture.authority, sources: [unsignedSource] }),
    /source is not current and signed/,
  );

  const metric = fixture.authority.metrics[0]!;
  assert.throws(
    () => service.publishReport(fixture.input, {
      ...fixture.authority,
      metrics: [{
        ...metric,
        projection: { ...metric.projection, projectionRoot: hash("forged metric projection") },
      }],
    }),
    /metric result is not current/,
  );
});

test("canonical ESG report projections fail closed for challenges, revocation, expiry, and duplicate sources", () => {
  const fixture = reportingFixture();
  const service = new CanopyProofCanonicalEsgReportingAuthorityService();
  const { report } = service.publishReport(fixture.input, fixture.authority);
  const source = fixture.authority.sources[0]!;

  const challengedSource = {
    ...source,
    governedRecordProjection: challengedProjection(source.record, "challenged", true),
  };
  assert.equal(
    service.projectReport(report.id, [challengedSource], fixture.metricProjections, generatedAt).state,
    "challenged",
  );

  const revokedSource = {
    ...source,
    governedRecordProjection: challengedProjection(source.record, "revoked", true),
  };
  assert.equal(
    service.projectReport(report.id, [revokedSource], fixture.metricProjections, generatedAt).state,
    "revoked",
  );

  const expiredSource = {
    ...source,
    lifecycleProjection: lifecycleProjection(source, {
      state: "expired",
      validityCurrent: false,
      evaluatedAt: "2026-08-15T07:00:00.000Z",
    }),
  };
  assert.equal(
    service.projectReport(
      report.id,
      [expiredSource],
      fixture.metricProjections,
      "2026-08-15T07:00:00.000Z",
    ).state,
    "expired",
  );

  const duplicateProjection = service.projectReport(
    report.id,
    [source, source],
    fixture.metricProjections,
    generatedAt,
  );
  assert.equal(duplicateProjection.state, "stale");
  assert.ok(duplicateProjection.issueCodes.includes("source_set_contains_duplicates"));

  const metric = fixture.metricProjections[0]!;
  const forgedMetricProjection = service.projectReport(
    report.id,
    [source],
    [{ ...metric, projectionRoot: hash("forged current metric projection") }],
    generatedAt,
  );
  assert.equal(forgedMetricProjection.state, "stale");
  assert.ok(
    forgedMetricProjection.issueCodes.includes(`metric_projection_invalid:${metric.resultId}`),
  );
});

test("canonical ESG reporting rejects unsupported institutional and financial claims", () => {
  const fixture = reportingFixture();
  const service = new CanopyProofCanonicalEsgReportingAuthorityService();
  assert.throws(
    () => service.publishReport(
      { ...fixture.input, materialTopics: ["Guaranteed RWA yield"] },
      fixture.authority,
    ),
    /unsupported claim/,
  );
  assert.throws(
    () => service.publishReport(fixture.input, {
      ...fixture.authority,
      organization: { ...fixture.organization, name: "Certified carbon credit issuer" },
    }),
    /unsupported claim/,
  );
});

test("canonical ESG reporting replay rejects tampering and isolates same-named projects by tenant", () => {
  const firstFixture = reportingFixture({ organizationId: "cp_esg_org_a", projectId: "shared_project" });
  const secondFixture = reportingFixture({ organizationId: "cp_esg_org_b", projectId: "shared_project" });
  const service = new CanopyProofCanonicalEsgReportingAuthorityService();
  const first = service.publishReport(firstFixture.input, firstFixture.authority);
  const second = service.publishReport(secondFixture.input, secondFixture.authority);
  assert.equal(first.report.projectSequence, 1);
  assert.equal(second.report.projectSequence, 1);

  const snapshot = service.getAuthoritySnapshot();
  const replayed = CanopyProofCanonicalEsgReportingAuthorityService.fromAuthoritySnapshot(snapshot);
  assert.equal(replayed.listReports({ organizationId: firstFixture.organization.id }).length, 1);
  assert.equal(replayed.listReports({ organizationId: secondFixture.organization.id }).length, 1);

  const tamperedReport = {
    ...snapshot.reports[0]!,
    materialTopics: ["Altered after publication"],
  };
  assert.throws(
    () => CanopyProofCanonicalEsgReportingAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      reports: [tamperedReport, ...snapshot.reports.slice(1)],
    }),
    /report lineage is invalid/,
  );

  const tamperedMember = {
    ...snapshot.members[0]!,
    recordRoot: hash("substituted record root"),
  };
  assert.throws(
    () => CanopyProofCanonicalEsgReportingAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      members: [tamperedMember, ...snapshot.members.slice(1)],
    }),
    /member lineage is invalid/,
  );

  const tamperedMetricMember = {
    ...snapshot.metricMembers[0]!,
    decimalValue: "99.99",
  };
  assert.throws(
    () => CanopyProofCanonicalEsgReportingAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      metricMembers: [tamperedMetricMember, ...snapshot.metricMembers.slice(1)],
    }),
    /metric member lineage is invalid/,
  );
});

function reportingFixture(
  options: Readonly<{ organizationId?: string; projectId?: string }> = {},
) {
  const organizationId = options.organizationId ?? "cp_esg_org";
  const projectId = options.projectId ?? "cp_esg_project";
  const suffix = hashJson({ kind: "canonical-esg-reporting-fixture-suffix", organizationId, projectId }).slice(0, 12);
  const metricFixture = createEsgMetricFixture({ organizationId, projectId, suffix });
  const metricService = new CanopyProofEsgMetricAuthorityService();
  const definition = metricService.publishDefinition(metricFixture.definitionInput, {
    organization: metricFixture.organization,
    publisher: metricFixture.publisher,
    reviewers: metricFixture.definitionReviewers,
    methodology: metricFixture.methodology.bundle,
    methodologyProjection: metricFixture.methodology.projection,
  });
  const definitionProjection = metricService.projectDefinition(
    definition.id,
    metricFixture.methodology.projection,
    generatedAt,
  );
  const resultBundle = metricService.recordResult(
    { ...metricFixture.resultInput, definitionId: definition.id },
    {
      definition,
      definitionProjection,
      calculator: metricFixture.calculator,
      reviewer: metricFixture.resultReviewer,
      sources: [metricFixture.source],
    },
  );
  const resultProjection = metricService.projectResult(
    resultBundle.result.id,
    definitionProjection,
    [metricFixture.source],
    generatedAt,
  );
  const publisher = metricActor(
    metricFixture.organization,
    `cp_esg_report_publisher_${suffix}`,
    "researcher",
    ["esg_reporting:publish"],
  );
  const authority: CanopyProofCanonicalEsgPublicationAuthority = {
    organization: metricFixture.organization,
    publisher,
    sources: [metricFixture.source],
    metrics: [{ result: resultBundle.result, projection: resultProjection }],
  };
  return {
    organization: metricFixture.organization,
    authority,
    metricService,
    metricProjections: [resultProjection],
    input: {
      organizationId,
      projectId,
      sourceRecordIds: [metricFixture.source.record.id],
      metricResultIds: [resultBundle.result.id],
      reportingPeriod: {
        startsAt: "2026-06-01T00:00:00.000Z",
        endsAt: "2026-07-14T06:30:00.000Z",
      },
      frameworks: ["TNFD", "GRI", "SDG"],
      materialTopics: ["Biodiversity condition", "Restoration monitoring"],
      generatedAt,
    },
  } as const;
}

function actor(
  organization: CanopyProofReportingOrganizationSnapshot,
  id: string,
  participantType: CanopyProofVerificationActorSnapshot["participantType"],
  role: CanopyProofVerificationActorSnapshot["role"],
  accreditationScope: readonly string[],
): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id,
    participantType,
    role,
    verificationStatus: "verified" as const,
    organizationId: organization.id,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hash(`participant:${id}`),
    organizationRoot: organization.organizationRoot,
    membershipId: `cp_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hash(`membership:${id}`),
    accreditationId: `cp_accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationRoot: hash(`accreditation:${id}`),
    accreditationScope: [...accreditationScope].sort(),
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

function challengedProjection(
  record: CanopyProofCanonicalEsgSourceAuthority["record"],
  state: CanopyProofCanonicalEsgSourceAuthority["governedRecordProjection"]["state"],
  sourceAuthorityCurrent: boolean,
): CanopyProofCanonicalEsgSourceAuthority["governedRecordProjection"] {
  const seed = {
    recordId: record.id,
    recordRoot: record.recordRoot,
    state,
    baseState: sourceAuthorityCurrent ? "issued" as const : "stale" as const,
    sourceAuthorityCurrent,
    challengeState: state === "challenged" ? "open" as const : undefined,
    challengeId: state === "challenged" ? `cp_challenge_${record.id}` : undefined,
    challengeRoot: state === "challenged" ? hash(`challenge:${record.id}`) : undefined,
    resolutionId: undefined,
    resolutionRoot: undefined,
  };
  return {
    ...seed,
    projectionRoot: hashJson({
      kind: "canopyproof-environmental-proof-challenged-record-projection-v1",
      ...seed,
    }),
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

function lifecycleProjection(
  source: CanopyProofCanonicalEsgSourceAuthority,
  overrides: Partial<CanopyProofCanonicalEsgSourceAuthority["lifecycleProjection"]> = {},
): CanopyProofCanonicalEsgSourceAuthority["lifecycleProjection"] {
  const current = source.lifecycleProjection;
  const seed = {
    organizationId: current.organizationId,
    projectId: current.projectId,
    recordId: current.recordId,
    recordRoot: current.recordRoot,
    bindingId: current.bindingId,
    bindingRoot: current.bindingRoot,
    state: current.state,
    evaluatedAt: current.evaluatedAt,
    governedRecordState: current.governedRecordState,
    sourceAuthorityCurrent: current.sourceAuthorityCurrent,
    mrvState: current.mrvState,
    boundMrvSnapshotCurrent: current.boundMrvSnapshotCurrent,
    keyState: current.keyState,
    signatureVerified: current.signatureVerified,
    validityCurrent: current.validityCurrent,
    issueCodes: current.issueCodes,
    ...overrides,
  };
  return {
    ...seed,
    projectionRoot: hashJson({ kind: "canopyproof-environmental-proof-lifecycle-projection-v1", ...seed }),
    safety: current.safety,
  };
}

function hash(value: string) {
  return hashJson({ kind: "canonical-esg-test-fixture", value });
}
