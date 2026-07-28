import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofOrganizationAccreditationAuthorityService,
  canopyProofOrganizationAccreditationScopes,
  organizationAccreditationActorAuthorityRoot,
  organizationAccreditationSafetyBoundary,
  verifyCanopyProofOrganizationAccreditationAuthoritySnapshot,
  type CanopyProofOrganizationAccreditationActorSnapshot,
} from "../../services/api/src/domain/canopyproof/organization-accreditation-authority.js";

const subjectOrganizationId = "org_accreditation_subject_unit";
const governanceOrganizationId = "org_accreditation_governance_unit";
const profileRoot = root("subject-profile");
const policyRoot = root("accreditation-policy-v1");
const scope = ["environmental-proof-review", "mrv-review"].sort();

test("accreditation approval and expiry replay deterministically with explicit as-of time", () => {
  const first = approvedFixture();
  const second = approvedFixture();
  assert.deepEqual(first.snapshot, second.snapshot);
  assert.deepEqual(first.approvedProjection, second.approvedProjection);
  assert.equal(first.approvedProjection.status, "approved");
  assert.equal(first.expiredProjection.status, "expired");
  assert.deepEqual(first.approvedProjection.safety, organizationAccreditationSafetyBoundary());
  assert.equal(first.snapshot.applicationFacts.length, 1);
  assert.equal(first.snapshot.reviewFacts.length, 1);
  assert.equal(first.snapshot.decisionFacts.length, 1);
  assert.equal(first.snapshot.controlFacts.length, 0);
  assert.deepEqual(
    [
      ...first.snapshot.applicationFacts,
      ...first.snapshot.reviewFacts,
      ...first.snapshot.decisionFacts,
      ...first.snapshot.controlFacts,
    ]
      .sort((left, right) => left.organizationAccreditationSequence - right.organizationAccreditationSequence)
      .map((fact) => fact.organizationAccreditationSequence),
    [1, 2, 3],
  );
  const replayed = CanopyProofOrganizationAccreditationAuthorityService.fromAuthoritySnapshot(first.snapshot);
  assert.deepEqual(replayed.getAuthoritySnapshot(), first.snapshot);
  assert.deepEqual(
    replayed.getProjection(subjectOrganizationId, first.application.id, "2026-12-01T00:00:00.000Z"),
    first.approvedProjection,
  );
  assert.deepEqual(verifyCanopyProofOrganizationAccreditationAuthoritySnapshot(first.snapshot), first.snapshot);
});

test("subject, reviewer, and decider authority remain independently separated", () => {
  const service = new CanopyProofOrganizationAccreditationAuthorityService();
  assert.throws(
    () => service.submitApplication(applicationInput(), subjectActor("wrong-role", "researcher")),
    /SUBJECT_AUTHORITY_REQUIRED/,
  );
  assert.throws(
    () =>
      service.submitApplication(
        applicationInput(),
        actorWithAuthoritySource(subjectActor("wrong-source-subject", "owner"), "root_governance_bootstrap"),
      ),
    /AUTHORITY_SOURCE_INVALID/,
  );
  const application = service.submitApplication(applicationInput(), subjectActor("subject-owner", "owner"));
  assert.throws(
    () => service.reviewApplication(reviewInput(application.id), subjectActor("subject-reviewer", "admin")),
    /INDEPENDENT_GOVERNANCE_AUTHORITY_REQUIRED/,
  );
  assert.throws(
    () =>
      service.reviewApplication(
        reviewInput(application.id),
        actorWithAuthoritySource(governanceActor("wrong-source-reviewer", "researcher"), "subject_membership"),
      ),
    /AUTHORITY_SOURCE_INVALID/,
  );
  const reviewer = governanceActor("reviewer", "verifier");
  const review = service.reviewApplication(reviewInput(application.id), reviewer);
  assert.throws(
    () => service.decideApplication(decisionInput(application.id, review.id), reviewer),
    /REVIEWER_DECIDER_SEPARATION_REQUIRED/,
  );
  assert.throws(
    () =>
      service.decideApplication(
        decisionInput(application.id, review.id),
        governanceActor("expired-decider", "admin", {
          accreditationValidUntil: "2026-07-19T01:30:00.000Z",
        }),
      ),
    /INDEPENDENT_GOVERNANCE_AUTHORITY_REQUIRED/,
  );
});

test("scope, policy, review semantics, and bounded validity fail closed", () => {
  const service = new CanopyProofOrganizationAccreditationAuthorityService();
  const application = service.submitApplication(applicationInput(), subjectActor("subject-owner", "owner"));
  assert.throws(
    () =>
      service.reviewApplication(
        { ...reviewInput(application.id), policyRoot: root("substituted-policy") },
        governanceActor("reviewer-stale", "researcher"),
      ),
    /REVIEW_SOURCE_STALE/,
  );
  assert.throws(
    () =>
      service.reviewApplication(
        { ...reviewInput(application.id), decision: "accepted", reasonCode: "scope_unsupported" },
        governanceActor("reviewer-invalid-reason", "researcher"),
      ),
    /REVIEW_REASON_INVALID/,
  );
  const review = service.reviewApplication(
    reviewInput(application.id),
    governanceActor("reviewer", "researcher"),
  );
  assert.throws(
    () =>
      service.decideApplication(
        { ...decisionInput(application.id, review.id), scope: ["widened-scope"] },
        governanceActor("decider-widened", "admin"),
      ),
    /DECISION_SOURCE_STALE/,
  );
  assert.throws(
    () =>
      service.decideApplication(
        {
          ...decisionInput(application.id, review.id),
          validUntil: "2028-07-19T00:00:00.000Z",
        },
        governanceActor("decider-unbounded", "admin"),
      ),
    /DECISION_SEMANTICS_INVALID|VALIDITY_INTERVAL_INVALID/,
  );
});

test("suspension removes authority and a renewal requires a fresh review and decision", () => {
  const approved = approvedFixture();
  const suspension = approved.service.controlDecision(
    controlInput(approved.decision.id, "suspend", "2026-08-01T00:00:00.000Z"),
    governanceActor("suspension-governor", "verifier"),
  );
  assert.equal(
    approved.service.getProjection(subjectOrganizationId, approved.application.id, "2026-08-01T00:00:00.000Z").status,
    "suspended",
  );
  const renewal = approved.service.submitApplication(
    {
      ...applicationInput({
        applicationKind: "renewal",
        priorDecisionId: approved.decision.id,
        submittedAt: "2026-08-02T00:00:00.000Z",
        requestedValidUntil: "2027-08-01T00:00:00.000Z",
      }),
    },
    subjectActor("subject-owner", "owner"),
  );
  assert.throws(
    () =>
      approved.service.decideApplication(
        decisionInput(renewal.id, approved.review.id, {
          decidedAt: "2026-08-04T00:00:00.000Z",
          validUntil: "2027-08-01T00:00:00.000Z",
        }),
        governanceActor("renewal-decider-too-early", "admin"),
      ),
    /ACCEPTED_REVIEW_REQUIRED/,
  );
  const renewalReview = approved.service.reviewApplication(
    reviewInput(renewal.id, {
      reviewedAt: "2026-08-03T00:00:00.000Z",
      sourceEventRoots: [root("renewal-review-source")],
    }),
    governanceActor("renewal-reviewer", "researcher"),
  );
  const renewalDecision = approved.service.decideApplication(
    decisionInput(renewal.id, renewalReview.id, {
      decidedAt: "2026-08-04T00:00:00.000Z",
      validUntil: "2027-08-01T00:00:00.000Z",
      sourceEventRoots: [root("renewal-decision-source")],
    }),
    governanceActor("renewal-decider", "admin"),
  );
  assert.equal(suspension.action, "suspend");
  assert.equal(renewalDecision.decision, "approved");
  assert.equal(
    approved.service.getProjection(subjectOrganizationId, renewal.id, "2026-08-05T00:00:00.000Z").status,
    "approved",
  );
});

test("revocation is terminal for control and renewal", () => {
  const approved = approvedFixture();
  const revoked = approved.service.controlDecision(
    controlInput(approved.decision.id, "revoke", "2026-08-01T00:00:00.000Z"),
    governanceActor("revocation-governor", "admin"),
  );
  assert.equal(
    approved.service.getProjection(subjectOrganizationId, approved.application.id, "2026-08-02T00:00:00.000Z").status,
    "revoked",
  );
  assert.throws(
    () =>
      approved.service.controlDecision(
        controlInput(approved.decision.id, "revoke", "2026-08-03T00:00:00.000Z"),
        governanceActor("second-governor", "admin"),
      ),
    /REVOCATION_TERMINAL/,
  );
  assert.throws(
    () =>
      approved.service.submitApplication(
        applicationInput({
          applicationKind: "renewal",
          priorDecisionId: approved.decision.id,
          submittedAt: "2026-08-04T00:00:00.000Z",
          requestedValidUntil: "2027-08-03T00:00:00.000Z",
        }),
        subjectActor("subject-owner", "owner"),
      ),
    /RENEWAL_TERMINAL/,
  );
  assert.equal(revoked.action, "revoke");
});

test("snapshot replay rejects tampering, noncanonical time, and unsafe authority text", () => {
  const approved = approvedFixture();
  const tampered = structuredClone(approved.snapshot);
  tampered.decisionFacts[0]!.scope = ["substituted-scope"];
  assert.throws(
    () => CanopyProofOrganizationAccreditationAuthorityService.fromAuthoritySnapshot(tampered),
    /REPLAY_MISMATCH|DECISION_SOURCE_STALE/,
  );
  assert.throws(
    () =>
      new CanopyProofOrganizationAccreditationAuthorityService().submitApplication(
        { ...applicationInput(), submittedAt: "2026-07-19T00:00:00Z" },
        subjectActor("subject-owner", "owner"),
      ),
    /SUBMITTED_AT_INVALID/,
  );
  const service = new CanopyProofOrganizationAccreditationAuthorityService();
  const application = service.submitApplication(applicationInput(), subjectActor("subject-owner", "owner"));
  assert.throws(
    () =>
      service.reviewApplication(
        {
          ...reviewInput(application.id),
          rationale: "Issue a certified carbon credit immediately from this accreditation review.",
        },
        governanceActor("unsafe-reviewer", "researcher"),
      ),
    /UNSAFE_TEXT/,
  );
});

function approvedFixture() {
  const service = new CanopyProofOrganizationAccreditationAuthorityService();
  const application = service.submitApplication(applicationInput(), subjectActor("subject-owner", "owner"));
  const review = service.reviewApplication(
    reviewInput(application.id),
    governanceActor("accreditation-reviewer", "researcher"),
  );
  const decision = service.decideApplication(
    decisionInput(application.id, review.id),
    governanceActor("accreditation-decider", "admin"),
  );
  return {
    service,
    application,
    review,
    decision,
    approvedProjection: service.getProjection(
      subjectOrganizationId,
      application.id,
      "2026-12-01T00:00:00.000Z",
    ),
    expiredProjection: service.getProjection(
      subjectOrganizationId,
      application.id,
      "2027-07-19T00:00:00.000Z",
    ),
    snapshot: service.getAuthoritySnapshot(),
  };
}

function applicationInput(
  overrides: Partial<{
    applicationKind: "initial" | "renewal";
    priorDecisionId: string;
    requestedValidUntil: string;
    submittedAt: string;
  }> = {},
) {
  return {
    organizationId: subjectOrganizationId,
    applicationKind: overrides.applicationKind ?? ("initial" as const),
    ...(overrides.priorDecisionId ? { priorDecisionId: overrides.priorDecisionId } : {}),
    profileRoot,
    scope,
    evidenceEventRoots: [root("application-evidence")],
    policyRoot,
    requestedValidUntil: overrides.requestedValidUntil ?? "2027-07-19T00:00:00.000Z",
    submittedAt: overrides.submittedAt ?? "2026-07-19T00:00:00.000Z",
  };
}

function reviewInput(
  applicationId: string,
  overrides: Partial<{ reviewedAt: string; sourceEventRoots: readonly string[] }> = {},
) {
  return {
    organizationId: subjectOrganizationId,
    applicationId,
    profileRoot,
    policyRoot,
    decision: "accepted" as const,
    reasonCode: "evidence_sufficient" as const,
    rationale: "Independent review confirmed the exact policy, scope, and hash-bound evidence package.",
    conflictDisclosure: "The reviewer has no employment, funding, ownership, family, or advisory conflict.",
    sourceEventRoots: overrides.sourceEventRoots ?? [root("review-source")],
    reviewedAt: overrides.reviewedAt ?? "2026-07-19T01:00:00.000Z",
  };
}

function decisionInput(
  applicationId: string,
  acceptedReviewId: string,
  overrides: Partial<{ decidedAt: string; validUntil: string; sourceEventRoots: readonly string[] }> = {},
) {
  return {
    organizationId: subjectOrganizationId,
    applicationId,
    acceptedReviewId,
    profileRoot,
    policyRoot,
    scope,
    decision: "approved" as const,
    reasonCode: "requirements_satisfied" as const,
    rationale: "A separate governance authority approved the exact reviewed scope for a bounded interval.",
    sourceEventRoots: overrides.sourceEventRoots ?? [root("decision-source")],
    validUntil: overrides.validUntil ?? "2027-07-19T00:00:00.000Z",
    decidedAt: overrides.decidedAt ?? "2026-07-19T02:00:00.000Z",
  };
}

function controlInput(decisionId: string, action: "suspend" | "revoke", controlledAt: string) {
  return {
    organizationId: subjectOrganizationId,
    decisionId,
    action,
    reasonCode: action === "suspend" ? ("compliance_concern" as const) : ("governance_breach" as const),
    rationale:
      action === "suspend"
        ? "A material compliance concern requires immediate suspension pending a newly reviewed application."
        : "A documented governance breach requires terminal revocation of this accreditation stream.",
    evidenceEventRoots: [root(`${action}-evidence`)],
    controlledAt,
  };
}

function subjectActor(
  id: string,
  role: CanopyProofOrganizationAccreditationActorSnapshot["role"],
): CanopyProofOrganizationAccreditationActorSnapshot {
  return actor(id, subjectOrganizationId, role, []);
}

function governanceActor(
  id: string,
  role: CanopyProofOrganizationAccreditationActorSnapshot["role"],
  overrides: Partial<{ accreditationValidUntil: string }> = {},
): CanopyProofOrganizationAccreditationActorSnapshot {
  return actor(id, governanceOrganizationId, role, Object.values(canopyProofOrganizationAccreditationScopes), {
    accreditationValidUntil: overrides.accreditationValidUntil,
  });
}

function actor(
  id: string,
  organizationId: string,
  role: CanopyProofOrganizationAccreditationActorSnapshot["role"],
  accreditationScope: readonly string[],
  overrides: Partial<{ accreditationValidUntil: string }> = {},
): CanopyProofOrganizationAccreditationActorSnapshot {
  const governance = organizationId === governanceOrganizationId;
  const seed = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: root(`participant:${id}`),
    organizationRoot: organizationId === subjectOrganizationId ? profileRoot : root(`organization:${organizationId}`),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: root(`membership:${id}:${role}`),
    authoritySource: governance ? ("root_governance_bootstrap" as const) : ("subject_membership" as const),
    ...(governance
      ? {
          accreditationId: "governance-root-accreditation",
          accreditationStatus: "approved" as const,
          accreditationDecisionRoot: root("governance-root-decision"),
          accreditationProjectionRoot: root("governance-root-projection"),
          accreditationValidFrom: "2026-01-01T00:00:00.000Z",
          accreditationValidUntil: overrides.accreditationValidUntil ?? "2028-01-01T00:00:00.000Z",
        }
      : {}),
    accreditationScope: [...accreditationScope].sort(),
  };
  return { ...seed, authorityRoot: organizationAccreditationActorAuthorityRoot(seed) };
}

function root(value: string) {
  return hashJson({ value });
}

function actorWithAuthoritySource(
  actor: CanopyProofOrganizationAccreditationActorSnapshot,
  authoritySource: CanopyProofOrganizationAccreditationActorSnapshot["authoritySource"],
): CanopyProofOrganizationAccreditationActorSnapshot {
  const { authorityRoot, ...seed } = actor;
  assert.match(authorityRoot, /^[a-f0-9]{64}$/);
  const changed = { ...seed, authoritySource };
  return { ...changed, authorityRoot: organizationAccreditationActorAuthorityRoot(changed) };
}
