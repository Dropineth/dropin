import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofOrganizationLifecycleAuthorityService,
  canopyProofOrganizationLifecycleScopes,
  organizationLifecycleSafetyBoundary,
  organizationRegistrationReferenceRoot,
  verifyCanopyProofOrganizationLifecycleAuthoritySnapshot,
  type CanopyProofOrganizationLifecycleActorSnapshot,
} from "../../services/api/src/domain/canopyproof/organization-lifecycle-authority.js";

const subjectOrganizationId = "org_lifecycle_subject_unit_001";
const governanceOrganizationId = "org_lifecycle_governance_unit_001";
const profileRoot = organizationRoot(subjectOrganizationId);
const registrationNumber = "CP-ORG-UNIT-001";
const registrationReferenceRoot = organizationRegistrationReferenceRoot(
  subjectOrganizationId,
  registrationNumber,
);
const documentRoots = [root("registration-document"), root("mandate-document")].sort();

test("organization lifecycle requires independent review and deterministically replays through reinstatement", () => {
  const first = reinstatedFixture();
  const second = reinstatedFixture();

  assert.deepEqual(first.snapshot, second.snapshot);
  assert.deepEqual(first.projection, second.projection);
  assert.equal(first.projection.currentStatus, "verified");
  assert.equal(first.projection.currentTrustLevel, "institutional");
  assert.equal(first.projection.openAppealIds.length, 0);
  assert.equal(first.projection.terminalRevocation, false);
  assert.deepEqual(first.projection.safety, organizationLifecycleSafetyBoundary());

  const replayed = CanopyProofOrganizationLifecycleAuthorityService.fromAuthoritySnapshot(first.snapshot);
  assert.deepEqual(replayed.getAuthoritySnapshot(), first.snapshot);
  assert.deepEqual(replayed.getProjection(subjectOrganizationId), first.projection);
  assert.deepEqual(verifyCanopyProofOrganizationLifecycleAuthoritySnapshot(first.snapshot), first.snapshot);

  assert.equal(first.snapshot.lifecycleFacts.length, 5);
  assert.equal(first.snapshot.documentReviewFacts.length, 1);
  assert.equal(first.snapshot.appealFacts.length, 1);
  assert.equal(first.snapshot.appealDecisionFacts.length, 1);
  assert.deepEqual(
    [
      ...first.snapshot.lifecycleFacts,
      ...first.snapshot.documentReviewFacts,
      ...first.snapshot.appealFacts,
      ...first.snapshot.appealDecisionFacts,
    ]
      .sort((left, right) => left.organizationSequence - right.organizationSequence)
      .map((fact) => fact.organizationSequence),
    [1, 2, 3, 4, 5, 6, 7, 8],
  );
});

test("verification rejects missing review, self decision, stale documents, and machine-like actor snapshots", () => {
  const authority = onboardingFixture();
  const review = authority.review;
  assert.throws(
    () =>
      authority.service.transitionOrganization(
        verificationTransition({ acceptedReviewId: undefined }),
        governanceActor("verification-decider-missing-review", "admin", [
          canopyProofOrganizationLifecycleScopes.verificationDecision,
        ]),
      ),
    /ACCEPTED_DOCUMENT_REVIEW_REQUIRED/,
  );
  assert.throws(
    () =>
      authority.service.transitionOrganization(
        verificationTransition({ acceptedReviewId: review.id }),
        governanceActor(review.reviewer.id, "verifier", [
          canopyProofOrganizationLifecycleScopes.verificationDecision,
        ]),
      ),
    /REVIEWER_DECIDER_SEPARATION_REQUIRED/,
  );
  assert.throws(
    () =>
      authority.service.transitionOrganization(
        verificationTransition({
          acceptedReviewId: review.id,
          documentRoots: [root("substituted-document")],
        }),
        governanceActor("verification-decider-stale", "admin", [
          canopyProofOrganizationLifecycleScopes.verificationDecision,
        ]),
      ),
    /VERIFICATION_INPUT_INVALID/,
  );
  assert.throws(
    () =>
      authority.service.reviewDocuments(
        { ...documentReviewInput(), registrationReferenceRoot: null },
        governanceActor("registration-unbound-reviewer", "researcher", [
          canopyProofOrganizationLifecycleScopes.documentReview,
        ]),
      ),
    /DOCUMENT_REVIEW_REGISTRATION_INVALID/,
  );
  assert.throws(
    () =>
      authority.service.reviewDocuments(
        documentReviewInput(),
        {
          ...governanceActor("machine-reviewer", "researcher", [
            canopyProofOrganizationLifecycleScopes.documentReview,
          ]),
          participantType: "agent",
        },
      ),
    /Invalid literal value|Invalid input/,
  );
});

test("high-authority transitions require cross-organization current accreditation", () => {
  const authority = verifiedFixture();
  assert.throws(
    () =>
      authority.service.transitionOrganization(
        suspensionTransition(),
        subjectActor("subject-governor", "verified", "admin"),
      ),
    /INDEPENDENT_GOVERNANCE_AUTHORITY_REQUIRED/,
  );
  assert.throws(
    () =>
      authority.service.transitionOrganization(
        suspensionTransition(),
        governanceActor("unaccredited-governor", "admin", []),
      ),
    /INDEPENDENT_GOVERNANCE_AUTHORITY_REQUIRED/,
  );
  assert.throws(
    () =>
      authority.service.transitionOrganization(
        suspensionTransition(),
        {
          ...governanceActor("stale-governor", "admin", [
            canopyProofOrganizationLifecycleScopes.governanceControl,
          ]),
          accreditationStatus: "suspended",
          authorityRoot: root("intentionally-invalid-authority-root"),
        },
      ),
    /ACTOR_AUTHORITY_ROOT_INVALID/,
  );
});

test("appeal cannot be reviewed by submitter or original governor and blocks unreviewed reinstatement", () => {
  const authority = suspendedFixture();
  const appeal = authority.service.openAppeal(
    appealInput(authority.suspension.id),
    subjectActor("subject-owner", "suspended", "owner"),
  );
  assert.throws(
    () =>
      authority.service.decideAppeal(
        appealDecisionInput(appeal.id),
        governanceActor(authority.suspension.actor.id, "verifier", [
          canopyProofOrganizationLifecycleScopes.appealResolution,
        ]),
      ),
    /SEPARATION_OF_DUTIES_REQUIRED/,
  );
  assert.throws(
    () =>
      authority.service.transitionOrganization(
        reinstatementTransition({ appealDecisionId: undefined }),
        governanceActor("reinstater-without-decision", "admin", [
          canopyProofOrganizationLifecycleScopes.appealResolution,
        ]),
      ),
    /UPHELD_APPEAL_REQUIRED/,
  );
  assert.deepEqual(authority.service.getProjection(subjectOrganizationId).openAppealIds, [appeal.id]);
});

test("needs-more-evidence keeps appeal open and requires a different final resolver", () => {
  const authority = suspendedFixture();
  const appeal = authority.service.openAppeal(
    appealInput(authority.suspension.id),
    subjectActor("subject-owner", "suspended", "owner"),
  );
  const firstReviewer = governanceActor("appeal-initial-reviewer", "researcher", [
    canopyProofOrganizationLifecycleScopes.appealReview,
  ]);
  authority.service.decideAppeal(
    {
      ...appealDecisionInput(appeal.id),
      decision: "needs_more_evidence",
      remedy: "none",
      decidedAt: "2026-07-19T07:00:00.000Z",
    },
    firstReviewer,
  );
  assert.deepEqual(authority.service.getProjection(subjectOrganizationId).openAppealIds, [appeal.id]);
  assert.throws(
    () =>
      authority.service.decideAppeal(
        {
          ...appealDecisionInput(appeal.id),
          decidedAt: "2026-07-19T08:00:00.000Z",
        },
        governanceActor(firstReviewer.id, "researcher", [
          canopyProofOrganizationLifecycleScopes.appealResolution,
        ]),
      ),
    /SEPARATION_OF_DUTIES_REQUIRED/,
  );
  authority.service.decideAppeal(
    {
      ...appealDecisionInput(appeal.id),
      decidedAt: "2026-07-19T08:00:00.000Z",
    },
    governanceActor("appeal-final-resolver", "verifier", [
      canopyProofOrganizationLifecycleScopes.appealResolution,
    ]),
  );
  assert.deepEqual(authority.service.getProjection(subjectOrganizationId).openAppealIds, []);
});

test("revocation is terminal and an upheld appeal requires a new identity rather than reactivation", () => {
  const authority = verifiedFixture();
  const revocation = authority.service.transitionOrganization(
    {
      ...suspensionTransition(),
      toStatus: "revoked",
      reasonCode: "legal_revocation",
      rationale: "A final legal order invalidated authority for this organization identity.",
      decidedAt: "2026-07-19T05:00:00.000Z",
    },
    governanceActor("revocation-governor", "admin", [canopyProofOrganizationLifecycleScopes.governanceControl]),
  );
  const appeal = authority.service.openAppeal(
    {
      ...appealInput(revocation.id),
      requestedRemedy: "procedural_remedy",
      submittedAt: "2026-07-19T06:00:00.000Z",
    },
    subjectActor("subject-owner", "revoked", "owner"),
  );
  const decision = authority.service.decideAppeal(
    {
      ...appealDecisionInput(appeal.id),
      remedy: "new_identity_required",
      decidedAt: "2026-07-19T07:00:00.000Z",
    },
    governanceActor("revocation-appeal-resolver", "verifier", [
      canopyProofOrganizationLifecycleScopes.appealResolution,
    ]),
  );
  assert.equal(decision.decision, "upheld");
  assert.equal(decision.remedy, "new_identity_required");
  assert.equal(authority.service.getProjection(subjectOrganizationId).terminalRevocation, true);
  assert.throws(
    () =>
      authority.service.transitionOrganization(
        reinstatementTransition({ appealDecisionId: decision.id, decidedAt: "2026-07-19T08:00:00.000Z" }),
        governanceActor("revoked-reinstater", "admin", [
          canopyProofOrganizationLifecycleScopes.appealResolution,
        ]),
      ),
    /REVOKED_IDENTITY_TERMINAL/,
  );
});

test("snapshot replay rejects tampering, stream forks, unsafe claims, and noncanonical time", () => {
  const fixture = reinstatedFixture();
  const tampered = structuredClone(fixture.snapshot);
  tampered.lifecycleFacts[2] = {
    ...tampered.lifecycleFacts[2]!,
    lifecycleRoot: root("forged-lifecycle-root"),
  };
  assert.throws(
    () => CanopyProofOrganizationLifecycleAuthorityService.fromAuthoritySnapshot(tampered),
    /REPLAY_MISMATCH|STREAM_POSITION_INVALID|EVENT_CHAIN_INVALID/,
  );
  const forked = structuredClone(fixture.snapshot);
  forked.appealFacts[0] = {
    ...forked.appealFacts[0]!,
    organizationSequence: forked.appealFacts[0]!.organizationSequence - 1,
  };
  assert.throws(
    () => CanopyProofOrganizationLifecycleAuthorityService.fromAuthoritySnapshot(forked),
    /STREAM_POSITION_INVALID|REPLAY_MISMATCH|LATEST_ADVERSE_FACT_REQUIRED/,
  );
  const fresh = new CanopyProofOrganizationLifecycleAuthorityService();
  assert.throws(
    () =>
      fresh.anchorOrganization(
        {
          ...anchorInput(),
          rationale: "Issue a certified carbon credit immediately from this organization anchor.",
        },
        subjectActor("subject-owner", "pending", "owner"),
      ),
    /UNSUPPORTED_CLAIM/,
  );
  assert.throws(
    () =>
      fresh.anchorOrganization(
        { ...anchorInput(), anchoredAt: "2026-07-19T00:00:00Z" },
        subjectActor("subject-owner", "pending", "owner"),
      ),
    /NOT_CANONICAL_UTC/,
  );
});

function reinstatedFixture() {
  const authority = suspendedFixture();
  const appeal = authority.service.openAppeal(
    appealInput(authority.suspension.id),
    subjectActor("subject-owner", "suspended", "owner"),
  );
  const appealDecision = authority.service.decideAppeal(
    appealDecisionInput(appeal.id),
    governanceActor("appeal-resolver", "verifier", [canopyProofOrganizationLifecycleScopes.appealResolution]),
  );
  authority.service.transitionOrganization(
    reinstatementTransition({ appealDecisionId: appealDecision.id }),
    governanceActor("reinstatement-authorizer", "admin", [
      canopyProofOrganizationLifecycleScopes.appealResolution,
    ]),
  );
  return {
    ...authority,
    appeal,
    appealDecision,
    snapshot: authority.service.getAuthoritySnapshot(),
    projection: authority.service.getProjection(subjectOrganizationId),
  };
}

function suspendedFixture() {
  const authority = verifiedFixture();
  const suspension = authority.service.transitionOrganization(
    suspensionTransition(),
    governanceActor("suspension-governor", "admin", [canopyProofOrganizationLifecycleScopes.governanceControl]),
  );
  return { ...authority, suspension };
}

function verifiedFixture() {
  const authority = onboardingFixture();
  const verified = authority.service.transitionOrganization(
    verificationTransition({ acceptedReviewId: authority.review.id }),
    governanceActor("verification-decider", "admin", [
      canopyProofOrganizationLifecycleScopes.verificationDecision,
    ]),
  );
  return { ...authority, verified };
}

function onboardingFixture() {
  const service = new CanopyProofOrganizationLifecycleAuthorityService();
  const anchor = service.anchorOrganization(
    anchorInput(),
    subjectActor("subject-owner", "pending", "owner"),
  );
  const documentReview = service.transitionOrganization(
    {
      organizationId: subjectOrganizationId,
      profileRoot,
      documentRoots,
      toStatus: "document_review",
      reasonCode: "documents_submitted",
      rationale: "The subject organization submitted exact registration and mandate commitments for review.",
      sourceEventRoots: [root("document-submission-event")],
      decidedAt: "2026-07-19T01:00:00.000Z",
    },
    subjectActor("subject-owner", "pending", "owner"),
  );
  const review = service.reviewDocuments(
    documentReviewInput(),
    governanceActor("document-reviewer", "researcher", [
      canopyProofOrganizationLifecycleScopes.documentReview,
    ]),
  );
  return { service, anchor, documentReview, review };
}

function anchorInput() {
  return {
    organizationId: subjectOrganizationId,
    profileRoot,
    documentRoots: [],
    rationale: "The registered organization profile was anchored for governed identity review.",
    sourceEventRoots: [root("organization-registration-event")],
    anchoredAt: "2026-07-19T00:00:00.000Z",
  };
}

function documentReviewInput() {
  return {
    organizationId: subjectOrganizationId,
    profileRoot,
    registrationReferenceRoot,
    documentRoots,
    decision: "accepted" as const,
    reasonCode: "identity_documents_valid" as const,
    rationale: "Independent review confirmed the hash-bound registration and institutional mandate documents.",
    conflictDisclosure: "The reviewer has no employment, funding, ownership, or family conflict with the subject.",
    sourceEventRoots: [root("independent-document-review-source")],
    reviewedAt: "2026-07-19T02:00:00.000Z",
  };
}

function verificationTransition(
  overrides: Partial<{
    acceptedReviewId: string | undefined;
    documentRoots: readonly string[];
    decidedAt: string;
  }> = {},
) {
  return {
    organizationId: subjectOrganizationId,
    profileRoot,
    documentRoots: overrides.documentRoots ?? documentRoots,
    toStatus: "verified" as const,
    trustLevel: "institutional" as const,
    reasonCode: "verification_approved" as const,
    rationale: "An independent authority approved the organization after a separate accepted document review.",
    sourceEventRoots: [root("verification-decision-source")],
    ...(overrides.acceptedReviewId ? { acceptedReviewId: overrides.acceptedReviewId } : {}),
    decidedAt: overrides.decidedAt ?? "2026-07-19T03:00:00.000Z",
  };
}

function suspensionTransition() {
  return {
    organizationId: subjectOrganizationId,
    profileRoot,
    documentRoots,
    toStatus: "suspended" as const,
    reasonCode: "compliance_suspension" as const,
    rationale: "A documented compliance concern requires temporary suspension pending independent resolution.",
    sourceEventRoots: [root("suspension-evidence-source")],
    decidedAt: "2026-07-19T04:00:00.000Z",
  };
}

function appealInput(challengedLifecycleFactId: string) {
  return {
    organizationId: subjectOrganizationId,
    challengedLifecycleFactId,
    reasonCode: "material_new_evidence" as const,
    requestedRemedy: "reinstatement" as const,
    grounds: "New independently produced evidence materially changes the basis of the suspension decision.",
    evidenceEventRoots: [root("appeal-new-evidence")],
    submittedAt: "2026-07-19T05:00:00.000Z",
  };
}

function appealDecisionInput(appealId: string) {
  return {
    organizationId: subjectOrganizationId,
    appealId,
    decision: "upheld" as const,
    remedy: "reinstate" as const,
    rationale: "Independent appeal review confirmed that the new evidence removes the suspension basis.",
    conflictDisclosure: "The appeal reviewer did not participate in the original action and has no subject relationship.",
    sourceEventRoots: [root("appeal-resolution-source")],
    decidedAt: "2026-07-19T06:00:00.000Z",
  };
}

function reinstatementTransition(
  overrides: Partial<{ appealDecisionId: string | undefined; decidedAt: string }> = {},
) {
  return {
    organizationId: subjectOrganizationId,
    profileRoot,
    documentRoots,
    toStatus: "verified" as const,
    trustLevel: "institutional" as const,
    reasonCode: "appeal_reinstatement" as const,
    rationale: "A separate human authority reinstated the organization after an upheld independent appeal.",
    sourceEventRoots: [root("reinstatement-governance-source")],
    ...(overrides.appealDecisionId ? { appealDecisionId: overrides.appealDecisionId } : {}),
    decidedAt: overrides.decidedAt ?? "2026-07-19T07:00:00.000Z",
  };
}

function subjectActor(
  id: string,
  status: "pending" | "document_review" | "verified" | "suspended" | "revoked",
  role: "owner" | "admin",
): CanopyProofOrganizationLifecycleActorSnapshot {
  return actor(id, subjectOrganizationId, status, role, []);
}

function governanceActor(
  id: string,
  role: "owner" | "admin" | "verifier" | "researcher",
  accreditationScope: readonly string[],
): CanopyProofOrganizationLifecycleActorSnapshot {
  return actor(id, governanceOrganizationId, "verified", role, accreditationScope);
}

function actor(
  id: string,
  organizationId: string,
  organizationVerificationStatus: "pending" | "document_review" | "verified" | "suspended" | "revoked",
  role: "owner" | "admin" | "verifier" | "researcher",
  accreditationScopeInput: readonly string[],
): CanopyProofOrganizationLifecycleActorSnapshot {
  const accreditationScope = [...accreditationScopeInput].sort();
  const normalized = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus,
    participantRoot: hashJson({ kind: "organization-lifecycle-unit-participant", id }),
    organizationRoot: organizationRoot(organizationId),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "organization-lifecycle-unit-membership", id, organizationId, role }),
    ...(accreditationScope.length > 0
      ? {
          accreditationId: `accreditation_${id}`,
          accreditationStatus: "approved" as const,
          accreditationRoot: hashJson({
            kind: "organization-lifecycle-unit-accreditation",
            id,
            accreditationScope,
          }),
        }
      : {}),
    accreditationScope,
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}

function organizationRoot(organizationId: string) {
  return hashJson({ kind: "organization-lifecycle-unit-organization", organizationId });
}

function root(label: string) {
  return hashJson({ kind: "organization-lifecycle-unit-root", label });
}
