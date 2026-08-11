import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  buildCanopyProofGlobalCommandCenterSpatialCandidate,
  buildCanopyProofGlobalCommandCenterSpatialDisclosureFact,
  buildCanopyProofGlobalCommandCenterSpatialReview,
  buildCanopyProofGlobalCommandCenterSpatialWithdrawal,
  canopyProofGlobalCommandCenterSpatialDisclosureAuthoritySafety,
  canopyProofGlobalCommandCenterSpatialDisclosureScopes,
  resolveCanopyProofGlobalCommandCenterSpatialDisclosure,
  verifyCanopyProofGlobalCommandCenterSpatialCandidate,
  verifyCanopyProofGlobalCommandCenterSpatialDisclosureFact,
  verifyCanopyProofGlobalCommandCenterSpatialReview,
  verifyCanopyProofGlobalCommandCenterSpatialWithdrawal,
} from "../../services/api/src/domain/canopyproof/global-command-center-spatial-disclosure-authority.js";

const organizationId = "org_spatial_authority_unit_001";
const regionId = "region_spatial_authority_unit_001";
const regionSourceRoot = "1".repeat(64);

test("CanopyProof spatial candidate is deterministic, minimized, and cohort bound", () => {
  const first = candidate();
  const second = candidate();
  assert.deepEqual(first, second);
  assert.deepEqual(verifyCanopyProofGlobalCommandCenterSpatialCandidate(first), first);
  assert.equal(first.centroid.latitudeDegrees, 15);
  assert.equal(first.centroid.longitudeDegrees, -17);
  assert.equal(first.minimumCohortSize, 3);
  assert.doesNotMatch(JSON.stringify(first), /accuracyMeters|coordinates|geometry|projectId|deviceId/);
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterSpatialCandidate({ ...candidateCommitment(), sourceProjectCount: 2 }),
    />=3/i,
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterSpatialCandidate({
      ...candidateCommitment(),
      centroid: { latitudeDegrees: 14.5, longitudeDegrees: -17 },
    }),
    /expected int/i,
  );
});

test("CanopyProof spatial publication requires independent approved humans and replays exact roots", () => {
  const authority = fixture();
  const replay = fixture();
  assert.deepEqual(authority, replay);
  assert.deepEqual(
    verifyCanopyProofGlobalCommandCenterSpatialReview(authority.privacyReview),
    authority.privacyReview,
  );
  assert.deepEqual(
    verifyCanopyProofGlobalCommandCenterSpatialDisclosureFact(
      authority.disclosure,
      authority.privacyReview,
      authority.safeguardingReview,
    ),
    authority.disclosure,
  );
  assert.equal(
    authority.disclosure.disclosure.privacyReviewRoot,
    authority.privacyReview.reviewRoot,
  );
  assert.equal(
    authority.disclosure.disclosure.safeguardingReviewRoot,
    authority.safeguardingReview.reviewRoot,
  );
  assert.deepEqual(authority.disclosure.safety, canopyProofGlobalCommandCenterSpatialDisclosureAuthoritySafety());
  assert.deepEqual(
    resolveCanopyProofGlobalCommandCenterSpatialDisclosure({
      organizationId,
      regionId,
      regionSourceRoot,
      sourceProjectCount: 4,
      at: "2026-07-19T10:05:00.000Z",
      records: [{ kind: "disclosure", ...authority }],
    }),
    authority.disclosure.disclosure,
  );
});

test("CanopyProof spatial authority rejects self-review, rejection, self-publication, and stale publication", () => {
  const candidateValue = candidate();
  const privacyReviewer = actor(
    "spatial_privacy_unit_001",
    "verifier",
    canopyProofGlobalCommandCenterSpatialDisclosureScopes.privacyReview,
  );
  const privacyReview = review(candidateValue, "privacy", privacyReviewer);
  const sameHumanSafeguarding = review(
    candidateValue,
    "safeguarding",
    actor(
      privacyReviewer.id,
      "verifier",
      canopyProofGlobalCommandCenterSpatialDisclosureScopes.safeguardingReview,
    ),
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
      {
        candidate: candidateValue,
        privacyReview,
        safeguardingReview: sameHumanSafeguarding,
        publishedAt: "2026-07-19T10:02:00.000Z",
      },
      actor("spatial_publisher_unit_001", "admin", canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish),
    ),
    /REVIEWER_INDEPENDENCE_REQUIRED/,
  );
  const safeguardingReviewer = actor(
    "spatial_safeguarding_unit_001",
    "verifier",
    canopyProofGlobalCommandCenterSpatialDisclosureScopes.safeguardingReview,
  );
  const rejected = review(candidateValue, "safeguarding", safeguardingReviewer, "rejected");
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
      {
        candidate: candidateValue,
        privacyReview,
        safeguardingReview: rejected,
        publishedAt: "2026-07-19T10:02:00.000Z",
      },
      actor("spatial_publisher_unit_002", "owner", canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish),
    ),
    /TWO_APPROVALS_REQUIRED/,
  );
  const safeguardingReview = review(candidateValue, "safeguarding", safeguardingReviewer);
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
      {
        candidate: candidateValue,
        privacyReview,
        safeguardingReview,
        publishedAt: "2026-07-19T10:02:00.000Z",
      },
      actor(privacyReviewer.id, "owner", canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish),
    ),
    /PUBLISHER_INDEPENDENCE_REQUIRED/,
  );
  assert.throws(
    () => buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
      {
        candidate: candidateValue,
        privacyReview,
        safeguardingReview,
        publishedAt: "2026-07-20T00:00:00.001Z",
      },
      actor("spatial_publisher_unit_003", "admin", canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish),
    ),
    /PUBLICATION_WINDOW_INVALID/,
  );
});

test("CanopyProof spatial withdrawal and expiry withhold without falling back", () => {
  const authority = fixture();
  const governor = actor(
    "spatial_governor_unit_001",
    "verifier",
    canopyProofGlobalCommandCenterSpatialDisclosureScopes.withdraw,
  );
  const withdrawal = buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
    {
      disclosure: authority.disclosure,
      reasonCode: "safeguarding_risk",
      rationale: "A protected habitat concern requires immediate public geometry withdrawal.",
      controlledAt: "2026-07-19T10:06:00.000Z",
    },
    governor,
    [authority.disclosure.auditEvent],
  );
  assert.deepEqual(
    verifyCanopyProofGlobalCommandCenterSpatialWithdrawal(
      withdrawal,
      authority.disclosure,
      [authority.disclosure.auditEvent],
    ),
    withdrawal,
  );
  assert.equal(
    resolveCanopyProofGlobalCommandCenterSpatialDisclosure({
      organizationId,
      regionId,
      regionSourceRoot,
      sourceProjectCount: 4,
      at: "2026-07-19T10:07:00.000Z",
      records: [
        { kind: "disclosure", ...authority },
        { kind: "control", control: withdrawal },
      ],
    }),
    undefined,
  );
  assert.equal(
    resolveCanopyProofGlobalCommandCenterSpatialDisclosure({
      organizationId,
      regionId,
      regionSourceRoot,
      sourceProjectCount: 4,
      at: "2026-07-21T00:00:00.000Z",
      records: [{ kind: "disclosure", ...authority }],
    }),
    undefined,
  );
  assert.equal(
    resolveCanopyProofGlobalCommandCenterSpatialDisclosure({
      organizationId,
      regionId,
      regionSourceRoot: "2".repeat(64),
      sourceProjectCount: 4,
      at: "2026-07-19T10:05:00.000Z",
      records: [{ kind: "disclosure", ...authority }],
    }),
    undefined,
  );
});

test("CanopyProof spatial root tampering is rejected", () => {
  const authority = fixture();
  assert.throws(
    () => verifyCanopyProofGlobalCommandCenterSpatialReview({
      ...authority.privacyReview,
      reviewRoot: "f".repeat(64),
    }),
    /REVIEW_ROOT_INVALID/,
  );
  assert.throws(
    () => verifyCanopyProofGlobalCommandCenterSpatialDisclosureFact(
      { ...authority.disclosure, publicationRoot: "e".repeat(64) },
      authority.privacyReview,
      authority.safeguardingReview,
    ),
    /PUBLICATION_ROOT_INVALID/,
  );
});

function fixture() {
  const candidateValue = candidate();
  const privacyReview = review(
    candidateValue,
    "privacy",
    actor("spatial_privacy_unit_001", "verifier", canopyProofGlobalCommandCenterSpatialDisclosureScopes.privacyReview),
  );
  const safeguardingReview = review(
    candidateValue,
    "safeguarding",
    actor(
      "spatial_safeguarding_unit_001",
      "verifier",
      canopyProofGlobalCommandCenterSpatialDisclosureScopes.safeguardingReview,
    ),
  );
  const disclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
    {
      candidate: candidateValue,
      privacyReview,
      safeguardingReview,
      publishedAt: "2026-07-19T10:02:00.000Z",
    },
    actor("spatial_publisher_unit_001", "admin", canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish),
  );
  return { disclosure, privacyReview, safeguardingReview };
}

function candidate() {
  return buildCanopyProofGlobalCommandCenterSpatialCandidate(candidateCommitment());
}

function candidateCommitment() {
  return {
    schemaVersion: "canopyproof.global-command-center.spatial-disclosure.v1" as const,
    organizationId,
    regionId,
    centroid: { latitudeDegrees: 15, longitudeDegrees: -17 },
    precisionDegrees: 1 as const,
    sourceProjectCount: 4,
    minimumCohortSize: 3 as const,
    regionSourceRoot,
    policyId: "cp_spatial_policy_unit_v1",
    policyRoot: "9".repeat(64),
    validFrom: "2026-07-19T10:00:00.000Z",
    validUntil: "2026-07-20T00:00:00.000Z",
  };
}

function review(
  candidateValue: ReturnType<typeof candidate>,
  reviewKind: "privacy" | "safeguarding",
  reviewer: CanopyProofVerificationActorSnapshot,
  decision: "approved" | "rejected" = "approved",
) {
  return buildCanopyProofGlobalCommandCenterSpatialReview(
    {
      candidate: candidateValue,
      reviewKind,
      decision,
      reviewedAt: reviewKind === "privacy" ? "2026-07-19T10:00:00.000Z" : "2026-07-19T10:01:00.000Z",
      rationale:
        reviewKind === "privacy"
          ? "The one-degree centroid and cohort satisfy the reviewed privacy policy."
          : "The generalized location passes protected habitat and community safeguards.",
    },
    reviewer,
  );
}

function actor(
  id: string,
  role: "owner" | "admin" | "verifier",
  scope: string,
): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "spatial-unit-participant", id }),
    organizationRoot: hashJson({ kind: "spatial-unit-organization", organizationId }),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "spatial-unit-membership", id }),
    accreditationId: `accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({ kind: "spatial-unit-accreditation", id, scope }),
    accreditationScope: [scope],
  };
  return {
    ...normalized,
    authorityRoot: hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized }),
  };
}
