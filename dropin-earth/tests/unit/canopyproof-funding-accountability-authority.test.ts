import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  buildCanopyProofFundingAccountabilityCandidate,
  buildCanopyProofFundingAccountabilityControl,
  buildCanopyProofFundingAccountabilityPublication,
  buildCanopyProofFundingAccountabilityReview,
  canopyProofFundingAccountabilitySafety,
  canopyProofFundingAccountabilityScopes,
  resolveCanopyProofFundingAccountabilityProjection,
  verifyCanopyProofFundingAccountabilityCandidate,
  verifyCanopyProofFundingAccountabilityControl,
  verifyCanopyProofFundingAccountabilityPublication,
  verifyCanopyProofFundingAccountabilityReview,
  type CanopyProofFundingAccountabilityCandidateInput,
} from "../../services/api/src/domain/canopyproof/funding-accountability-authority.js";

const organizationId = "org_funding_accountability_unit_001";
const projectId = "project_funding_accountability_unit_001";

test("funding accountability candidate is deterministic, sorted, conserved, and minimized", () => {
  const first = candidate();
  const second = candidate();
  assert.deepEqual(first, second);
  assert.deepEqual(verifyCanopyProofFundingAccountabilityCandidate(first), first);
  assert.deepEqual(
    first.milestones.map((milestone) => milestone.milestoneId),
    ["milestone_a", "milestone_b"],
  );
  assert.deepEqual(first.totals, {
    committedCents: 100_000,
    allocatedCents: 80_000,
    reconciledCents: 50_000,
    challengedCents: 20_000,
  });
  assert.equal(first.milestones[0]?.evidenceRoots.length, 1);
  assert.equal(first.milestones[0]?.proofRecordRoots.length, 1);
  assert.doesNotMatch(
    JSON.stringify(first),
    /bankAccount|walletAddress|privateKey|latitude|longitude|paymentToken/,
  );
  assert.deepEqual(first.preparer.accreditationScope, [
    canopyProofFundingAccountabilityScopes.prepare,
  ]);
});

test("funding accountability candidate rejects over-allocation, duplicate members, and unsupported reconciliation", () => {
  assert.throws(
    () =>
      buildCanopyProofFundingAccountabilityCandidate(
        { ...candidateInput(), allocatedCents: 100_001 },
        actor("funding_preparer_unit_001", "researcher", canopyProofFundingAccountabilityScopes.prepare),
      ),
    /ALLOCATION_EXCEEDS_COMMITMENT/,
  );
  assert.throws(
    () =>
      buildCanopyProofFundingAccountabilityCandidate(
        {
          ...candidateInput(),
          milestones: [
            {
              ...candidateInput().milestones[0]!,
              evidenceRoots: ["1".repeat(64), "1".repeat(64)],
            },
          ],
        },
        actor("funding_preparer_unit_001", "researcher", canopyProofFundingAccountabilityScopes.prepare),
      ),
    /DUPLICATE_EVIDENCE_ROOT/,
  );
  assert.throws(
    () =>
      buildCanopyProofFundingAccountabilityCandidate(
        {
          ...candidateInput(),
          milestones: [
            {
              ...candidateInput().milestones[1]!,
              evidenceRoots: [],
              proofRecordRoots: [],
            },
          ],
        },
        actor("funding_preparer_unit_001", "researcher", canopyProofFundingAccountabilityScopes.prepare),
      ),
    /RECONCILIATION_AUTHORITY_REQUIRED/,
  );
  assert.throws(
    () =>
      buildCanopyProofFundingAccountabilityCandidate(
        {
          ...candidateInput(),
          milestones: candidateInput().milestones.map((milestone) => ({
            ...milestone,
            amountCents: 50_000,
          })),
        },
        actor("funding_preparer_unit_001", "researcher", canopyProofFundingAccountabilityScopes.prepare),
      ),
    /MILESTONES_EXCEED_ALLOCATION/,
  );
});

test("funding accountability publication requires three independent accredited humans", () => {
  const authority = fixture();
  assert.deepEqual(verifyCanopyProofFundingAccountabilityReview(authority.review), authority.review);
  assert.deepEqual(
    verifyCanopyProofFundingAccountabilityPublication(authority.publication, authority.review),
    authority.publication,
  );
  assert.deepEqual(authority.publication.safety, canopyProofFundingAccountabilitySafety());
  assert.equal(authority.publication.publicProjection.totals.reconciledCents, 50_000);
  assert.equal(authority.publication.publicProjection.evidenceMemberCount, 2);
  assert.equal(authority.publication.publicProjection.proofRecordMemberCount, 1);
  assert.equal(
    resolveCanopyProofFundingAccountabilityProjection({
      organizationId,
      projectId,
      evaluatedAt: "2026-07-10T00:00:00.000Z",
      records: [{ kind: "publication", ...authority }],
    })?.state,
    "active",
  );

  const sameHuman = actor(
    authority.publication.candidate.preparer.id,
    "verifier",
    canopyProofFundingAccountabilityScopes.review,
  );
  assert.throws(
    () =>
      buildCanopyProofFundingAccountabilityReview(
        {
          candidate: authority.publication.candidate,
          decision: "approved",
          reviewedAt: "2026-07-01T02:00:00.000Z",
          rationale: "The exact source and milestone member roots reconcile under the approved policy.",
        },
        sameHuman,
      ),
    /REVIEWER_INDEPENDENCE_REQUIRED/,
  );
  assert.throws(
    () =>
      buildCanopyProofFundingAccountabilityPublication(
        {
          candidate: authority.publication.candidate,
          review: authority.review,
          publishedAt: "2026-07-01T03:00:00.000Z",
        },
        actor(authority.review.reviewer.id, "admin", canopyProofFundingAccountabilityScopes.publish),
      ),
    /PUBLISHER_INDEPENDENCE_REQUIRED/,
  );
});

test("funding challenge, withdrawal, and expiry fail closed without older-version fallback", () => {
  const authority = fixture();
  const challenge = buildCanopyProofFundingAccountabilityControl(
    {
      publication: authority.publication,
      action: "challenge",
      reasonCode: "proof_record_challenged",
      rationale: "A referenced Environmental Proof Record entered a challenged lifecycle state.",
      controlledAt: "2026-07-12T00:00:00.000Z",
    },
    actor("funding_governor_unit_001", "verifier", canopyProofFundingAccountabilityScopes.control),
    [authority.publication.auditEvent],
  );
  assert.deepEqual(
    verifyCanopyProofFundingAccountabilityControl(
      challenge,
      authority.publication,
      [authority.publication.auditEvent],
    ),
    challenge,
  );
  const challenged = resolveCanopyProofFundingAccountabilityProjection({
    organizationId,
    projectId,
    evaluatedAt: "2026-07-13T00:00:00.000Z",
    records: [
      { kind: "publication", ...authority },
      { kind: "control", control: challenge },
    ],
  });
  assert.equal(challenged?.state, "challenged");
  assert.equal(challenged?.operationalTotals.reconciledCents, 0);
  assert.equal(challenged?.operationalTotals.challengedCents, 80_000);

  const withdrawal = buildCanopyProofFundingAccountabilityControl(
    {
      publication: authority.publication,
      action: "withdraw",
      reasonCode: "governance_order",
      rationale: "Governance ordered withdrawal pending an independent institutional reconciliation.",
      controlledAt: "2026-07-12T00:00:00.000Z",
    },
    actor("funding_governor_unit_002", "owner", canopyProofFundingAccountabilityScopes.control),
    [authority.publication.auditEvent],
  );
  const withdrawn = resolveCanopyProofFundingAccountabilityProjection({
    organizationId,
    projectId,
    evaluatedAt: "2026-07-13T00:00:00.000Z",
    records: [
      { kind: "publication", ...authority },
      { kind: "control", control: withdrawal },
    ],
  });
  assert.equal(withdrawn?.state, "withdrawn");
  assert.deepEqual(withdrawn?.operationalTotals, {
    committedCents: 0,
    allocatedCents: 0,
    reconciledCents: 0,
    challengedCents: 0,
  });
  assert.equal(
    resolveCanopyProofFundingAccountabilityProjection({
      organizationId,
      projectId,
      evaluatedAt: "2026-09-01T00:00:00.000Z",
      records: [{ kind: "publication", ...authority }],
    })?.state,
    "expired",
  );
});

test("funding accountability roots, unsafe text, rejection, and project scope are enforced", () => {
  const authority = fixture();
  assert.throws(
    () =>
      verifyCanopyProofFundingAccountabilityCandidate({
        ...authority.publication.candidate,
        candidateRoot: "f".repeat(64),
      }),
    /CANDIDATE_ROOT_INVALID/,
  );
  assert.throws(
    () =>
      verifyCanopyProofFundingAccountabilityPublication(
        { ...authority.publication, publicationRoot: "e".repeat(64) },
        authority.review,
      ),
    /PUBLICATION_ROOT_INVALID/,
  );
  const rejected = buildCanopyProofFundingAccountabilityReview(
    {
      candidate: authority.publication.candidate,
      decision: "rejected",
      reviewedAt: "2026-07-01T02:00:00.000Z",
      rationale: "The submitted member roots do not reconcile to the reviewed source document.",
    },
    actor("funding_reviewer_unit_002", "verifier", canopyProofFundingAccountabilityScopes.review),
  );
  assert.throws(
    () =>
      buildCanopyProofFundingAccountabilityPublication(
        {
          candidate: authority.publication.candidate,
          review: rejected,
          publishedAt: "2026-07-01T03:00:00.000Z",
        },
        actor("funding_publisher_unit_002", "admin", canopyProofFundingAccountabilityScopes.publish),
      ),
    /APPROVED_REVIEW_REQUIRED/,
  );
  assert.throws(
    () =>
      buildCanopyProofFundingAccountabilityReview(
        {
          candidate: authority.publication.candidate,
          decision: "approved",
          reviewedAt: "2026-07-01T02:00:00.000Z",
          rationale: "This package guarantees yield to every participant without qualification.",
        },
        actor("funding_reviewer_unit_003", "verifier", canopyProofFundingAccountabilityScopes.review),
      ),
    /UNSAFE_CLAIM/,
  );
  assert.throws(
    () =>
      resolveCanopyProofFundingAccountabilityProjection({
        organizationId,
        projectId: "another_project",
        evaluatedAt: "2026-07-10T00:00:00.000Z",
        records: [{ kind: "publication", ...authority }],
      }),
    /PROJECT_SCOPE_INVALID/,
  );
});

function fixture() {
  const candidateValue = candidate();
  const review = buildCanopyProofFundingAccountabilityReview(
    {
      candidate: candidateValue,
      decision: "approved",
      reviewedAt: "2026-07-01T02:00:00.000Z",
      rationale: "The exact source and milestone member roots reconcile under the approved policy.",
    },
    actor("funding_reviewer_unit_001", "verifier", canopyProofFundingAccountabilityScopes.review),
  );
  const publication = buildCanopyProofFundingAccountabilityPublication(
    {
      candidate: candidateValue,
      review,
      publishedAt: "2026-07-01T03:00:00.000Z",
    },
    actor("funding_publisher_unit_001", "admin", canopyProofFundingAccountabilityScopes.publish),
  );
  return { publication, review };
}

function candidate() {
  return buildCanopyProofFundingAccountabilityCandidate(
    candidateInput(),
    actor("funding_preparer_unit_001", "researcher", canopyProofFundingAccountabilityScopes.prepare),
  );
}

function candidateInput(): CanopyProofFundingAccountabilityCandidateInput {
  return {
    organizationId,
    projectId,
    projectAuthorityRoot: "a".repeat(64),
    sourcePublicId: "funding_source_public_001",
    sourceType: "grant",
    sourceJurisdictionCode: "UN-MULTI",
    sourceRestriction: "milestone_restricted",
    commitmentCents: 100_000,
    sourceDocumentRoot: "b".repeat(64),
    fundingSourceAuthorityRoot: "c".repeat(64),
    allocationId: "funding_allocation_001",
    purposeCode: "restoration_field_delivery",
    allocatedCents: 80_000,
    allocatedAt: "2026-02-01T00:00:00.000Z",
    milestones: [
      {
        milestoneId: "milestone_b",
        amountCents: 20_000,
        dueAt: "2026-06-15T00:00:00.000Z",
        status: "challenged",
        evidenceRoots: ["3".repeat(64)],
        proofRecordRoots: [],
      },
      {
        milestoneId: "milestone_a",
        amountCents: 50_000,
        dueAt: "2026-05-15T00:00:00.000Z",
        status: "reconciled",
        evidenceRoots: ["1".repeat(64)],
        proofRecordRoots: ["2".repeat(64)],
      },
    ],
    reportingPeriodStart: "2026-01-01T00:00:00.000Z",
    reportingPeriodEnd: "2026-06-30T00:00:00.000Z",
    policyId: "funding_accountability_policy_v1",
    policyRoot: "d".repeat(64),
    validFrom: "2026-07-01T01:00:00.000Z",
    validUntil: "2026-08-01T00:00:00.000Z",
    preparedAt: "2026-07-01T00:00:00.000Z",
  };
}

function actor(
  id: string,
  role: "owner" | "admin" | "verifier" | "researcher",
  scope: string,
): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "funding-unit-participant", id }),
    organizationRoot: hashJson({ kind: "funding-unit-organization", organizationId }),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "funding-unit-membership", id }),
    accreditationId: `accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({ kind: "funding-unit-accreditation", id, scope }),
    accreditationScope: [scope],
  };
  return {
    ...normalized,
    authorityRoot: hashJson({
      kind: "canopyproof-verification-actor-authority-v1",
      ...normalized,
    }),
  };
}
