import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  buildCanopyProofGlobalCommandCenterSpatialCandidate,
  buildCanopyProofGlobalCommandCenterSpatialDisclosureFact,
  buildCanopyProofGlobalCommandCenterSpatialReview,
  buildCanopyProofGlobalCommandCenterSpatialWithdrawal,
  canopyProofGlobalCommandCenterSpatialDisclosureScopes,
  parseCanopyProofGlobalCommandCenterSpatialControlFact,
  parseCanopyProofGlobalCommandCenterSpatialDisclosureFact,
  parseCanopyProofGlobalCommandCenterSpatialReviewFact,
  resolveCanopyProofGlobalCommandCenterSpatialDisclosure,
  verifyCanopyProofGlobalCommandCenterSpatialCandidate,
  verifyCanopyProofGlobalCommandCenterSpatialWithdrawal,
  type CanopyProofGlobalCommandCenterSpatialAuthorityRecord,
  type CanopyProofGlobalCommandCenterSpatialCandidate,
} from "../../services/api/src/domain/canopyproof/global-command-center-spatial-disclosure-authority.js";

const organizationId = "org_spatial_critical_001";
const regionId = "region_spatial_critical_001";
const regionSourceRoot = "1".repeat(64);

type ActorRole = CanopyProofVerificationActorSnapshot["role"];
type ActorOverrides = Readonly<Record<string, unknown>>;

function actor(
  id: string,
  role: ActorRole,
  scopes: readonly string[],
  overrides: ActorOverrides = {},
): CanopyProofVerificationActorSnapshot {
  const values: Record<string, unknown> = {
    id,
    participantType: "human",
    role,
    verificationStatus: "verified",
    organizationId,
    organizationVerificationStatus: "verified",
    participantRoot: hashJson({ kind: "spatial-critical-participant", id }),
    organizationRoot: hashJson({
      kind: "spatial-critical-organization",
      organizationId,
    }),
    membershipId: `membership_${id}`,
    membershipStatus: "active",
    membershipRoot: hashJson({ kind: "spatial-critical-membership", id }),
    accreditationId: `accreditation_${id}`,
    accreditationStatus: "approved",
    accreditationRoot: hashJson({
      kind: "spatial-critical-accreditation",
      id,
      scopes,
    }),
    accreditationScope: [...scopes],
    ...overrides,
  };
  delete values.authorityRoot;
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete values[key];
  }
  return {
    ...values,
    authorityRoot: hashJson({
      kind: "canopyproof-verification-actor-authority-v1",
      ...values,
    }),
  } as CanopyProofVerificationActorSnapshot;
}

function commitment(overrides: ActorOverrides = {}) {
  return {
    schemaVersion:
      "canopyproof.global-command-center.spatial-disclosure.v1" as const,
    organizationId,
    regionId,
    centroid: { latitudeDegrees: 15, longitudeDegrees: -17 },
    precisionDegrees: 1 as const,
    sourceProjectCount: 4,
    minimumCohortSize: 3 as const,
    regionSourceRoot,
    policyId: "cp_spatial_policy_critical_v1",
    policyRoot: "9".repeat(64),
    validFrom: "2026-07-19T10:00:00.000Z",
    validUntil: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

function candidate(overrides: ActorOverrides = {}) {
  return buildCanopyProofGlobalCommandCenterSpatialCandidate(
    commitment(overrides),
  );
}

function review(
  candidateValue: CanopyProofGlobalCommandCenterSpatialCandidate,
  kind: "privacy" | "safeguarding",
  reviewer: CanopyProofVerificationActorSnapshot,
  overrides: ActorOverrides = {},
) {
  return buildCanopyProofGlobalCommandCenterSpatialReview(
    {
      candidate: candidateValue,
      reviewKind: kind,
      decision: "approved",
      reviewedAt:
        kind === "privacy"
          ? "2026-07-19T10:00:00.000Z"
          : "2026-07-19T10:01:00.000Z",
      rationale:
        kind === "privacy"
          ? "Independent privacy review approves only the generalized regional cohort."
          : "Independent safeguarding review approves the bounded regional disclosure.",
      ...overrides,
    },
    reviewer,
  );
}

function fixture(candidateValue = candidate()) {
  const privacyReview = review(
    candidateValue,
    "privacy",
    actor(
      "spatial_privacy_critical_001",
      "verifier",
      [canopyProofGlobalCommandCenterSpatialDisclosureScopes.privacyReview],
    ),
  );
  const safeguardingReview = review(
    candidateValue,
    "safeguarding",
    actor(
      "spatial_safeguarding_critical_001",
      "verifier",
      [
        canopyProofGlobalCommandCenterSpatialDisclosureScopes
          .safeguardingReview,
      ],
    ),
  );
  const publisher = actor(
    "spatial_publisher_critical_001",
    "admin",
    [canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish],
  );
  const disclosure = buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
    {
      candidate: candidateValue,
      privacyReview,
      safeguardingReview,
      publishedAt: "2026-07-19T10:02:00.000Z",
    },
    publisher,
  );
  return {
    candidate: candidateValue,
    privacyReview,
    safeguardingReview,
    publisher,
    disclosure,
  };
}

test("spatial critical candidate and review inputs fail closed on roots, intervals, windows, and canonical time", () => {
  const candidateValue = candidate();
  assert.throws(
    () =>
      verifyCanopyProofGlobalCommandCenterSpatialCandidate({
        ...candidateValue,
        candidateRoot: "f".repeat(64),
      }),
    /CANDIDATE_ROOT_INVALID/,
  );
  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialCandidate(
        commitment({
          validFrom: "2026-07-20T00:00:00.000Z",
          validUntil: "2026-07-20T00:00:00.000Z",
        }),
      ),
    /validity interval is invalid/,
  );
  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialCandidate(
        commitment({ validFrom: "2026-07-19T10:00:00+00:00" }),
      ),
    /TIMESTAMP_NON_CANONICAL:candidate validFrom/,
  );

  const privacyReviewer = actor(
    "spatial_late_privacy_critical",
    "verifier",
    [canopyProofGlobalCommandCenterSpatialDisclosureScopes.privacyReview],
  );
  assert.throws(
    () =>
      review(candidateValue, "privacy", privacyReviewer, {
        reviewedAt: "2026-07-20T00:00:00.001Z",
      }),
    /REVIEW_WINDOW_INVALID/,
  );
  assert.throws(
    () =>
      review(candidateValue, "privacy", privacyReviewer, {
        reviewedAt: "2026-07-19T10:00:00+00:00",
      }),
    /TIMESTAMP_NON_CANONICAL:reviewedAt/,
  );
});

test("spatial critical actor authorization rejects noncanonical authority and every missing credential boundary", () => {
  const candidateValue = candidate();
  const privacyScope =
    canopyProofGlobalCommandCenterSpatialDisclosureScopes.privacyReview;
  const wrongRoot = actor(
    "spatial_wrong_root_critical",
    "verifier",
    [privacyScope],
  );
  assert.throws(
    () =>
      review(candidateValue, "privacy", {
        ...wrongRoot,
        authorityRoot: "f".repeat(64),
      }),
    /REVIEWER_AUTHORITY_ROOT_INVALID/,
  );

  const publishScope =
    canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish;
  const nonCanonicalScope = actor(
    "spatial_noncanonical_scope_critical",
    "verifier",
    [publishScope, privacyScope, privacyScope],
  );
  assert.throws(
    () => review(candidateValue, "privacy", nonCanonicalScope),
    /REVIEWER_SCOPE_NON_CANONICAL/,
  );

  const deniedActors = [
    actor("spatial_agent_critical", "agent", [privacyScope], {
      participantType: "agent",
    }),
    actor("spatial_role_critical", "researcher", [privacyScope]),
    actor("spatial_tenant_critical", "verifier", [privacyScope], {
      organizationId: "org_spatial_foreign_critical",
    }),
    actor("spatial_membership_id_critical", "verifier", [privacyScope], {
      membershipId: undefined,
    }),
    actor("spatial_membership_status_critical", "verifier", [privacyScope], {
      membershipStatus: undefined,
    }),
    actor("spatial_membership_root_critical", "verifier", [privacyScope], {
      membershipRoot: undefined,
    }),
    actor("spatial_accreditation_id_critical", "verifier", [privacyScope], {
      accreditationId: undefined,
    }),
    actor(
      "spatial_accreditation_status_critical",
      "verifier",
      [privacyScope],
      { accreditationStatus: "pending" },
    ),
    actor(
      "spatial_accreditation_root_critical",
      "verifier",
      [privacyScope],
      { accreditationRoot: undefined },
    ),
    actor("spatial_scope_missing_critical", "verifier", []),
  ];
  for (const denied of deniedActors) {
    assert.throws(
      () => review(candidateValue, "privacy", denied),
      /SCOPE_REQUIRED/,
    );
  }
});

test("spatial critical publication enforces candidate identity, both review positions, publisher independence, and each time bound", () => {
  const authority = fixture();
  const publisher = actor(
    "spatial_publisher_checks_critical",
    "admin",
    [canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish],
  );
  const rejectedPrivacy = review(
    authority.candidate,
    "privacy",
    actor(
      "spatial_rejected_privacy_critical",
      "verifier",
      [canopyProofGlobalCommandCenterSpatialDisclosureScopes.privacyReview],
    ),
    { decision: "rejected" },
  );
  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
        {
          candidate: authority.candidate,
          privacyReview: rejectedPrivacy,
          safeguardingReview: authority.safeguardingReview,
          publishedAt: "2026-07-19T10:02:00.000Z",
        },
        publisher,
      ),
    /TWO_APPROVALS_REQUIRED/,
  );

  const otherCandidate = candidate({ regionSourceRoot: "2".repeat(64) });
  const otherPrivacy = review(
    otherCandidate,
    "privacy",
    actor(
      "spatial_other_privacy_critical",
      "verifier",
      [canopyProofGlobalCommandCenterSpatialDisclosureScopes.privacyReview],
    ),
  );
  const otherSafeguarding = review(
    otherCandidate,
    "safeguarding",
    actor(
      "spatial_other_safeguarding_critical",
      "verifier",
      [
        canopyProofGlobalCommandCenterSpatialDisclosureScopes
          .safeguardingReview,
      ],
    ),
  );
  for (const [privacyReview, safeguardingReview] of [
    [otherPrivacy, authority.safeguardingReview],
    [authority.privacyReview, otherSafeguarding],
  ] as const) {
    assert.throws(
      () =>
        buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
          {
            candidate: authority.candidate,
            privacyReview,
            safeguardingReview,
            publishedAt: "2026-07-19T10:02:00.000Z",
          },
          publisher,
        ),
      /REVIEW_CANDIDATE_MISMATCH/,
    );
  }

  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
        {
          candidate: authority.candidate,
          privacyReview: authority.privacyReview,
          safeguardingReview: authority.safeguardingReview,
          publishedAt: "2026-07-19T10:02:00.000Z",
        },
        actor(
          authority.safeguardingReview.reviewer.id,
          "admin",
          [canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish],
        ),
      ),
    /PUBLISHER_INDEPENDENCE_REQUIRED/,
  );

  for (const publishedAt of [
    "2026-07-19T09:59:59.000Z",
    "2026-07-19T10:00:30.000Z",
  ]) {
    assert.throws(
      () =>
        buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
          {
            candidate: authority.candidate,
            privacyReview: authority.privacyReview,
            safeguardingReview: authority.safeguardingReview,
            publishedAt,
          },
          publisher,
        ),
      /PUBLICATION_WINDOW_INVALID/,
    );
  }

  const futureCandidate = candidate({
    validFrom: "2026-07-19T11:00:00.000Z",
  });
  const futurePrivacy = review(
    futureCandidate,
    "privacy",
    actor(
      "spatial_future_privacy_critical",
      "verifier",
      [canopyProofGlobalCommandCenterSpatialDisclosureScopes.privacyReview],
    ),
  );
  const futureSafeguarding = review(
    futureCandidate,
    "safeguarding",
    actor(
      "spatial_future_safeguarding_critical",
      "verifier",
      [
        canopyProofGlobalCommandCenterSpatialDisclosureScopes
          .safeguardingReview,
      ],
    ),
  );
  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
        {
          candidate: futureCandidate,
          privacyReview: futurePrivacy,
          safeguardingReview: futureSafeguarding,
          publishedAt: "2026-07-19T10:30:00.000Z",
        },
        publisher,
      ),
    /PUBLICATION_WINDOW_INVALID/,
  );
});

test("spatial critical append-only publication validates nonempty history and parser contracts", () => {
  const authority = fixture();
  const second = buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
    {
      candidate: authority.candidate,
      privacyReview: authority.privacyReview,
      safeguardingReview: authority.safeguardingReview,
      publishedAt: "2026-07-19T10:03:00.000Z",
    },
    actor(
      "spatial_second_publisher_critical",
      "admin",
      [canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish],
    ),
    [authority.disclosure.auditEvent],
  );
  assert.equal(second.regionSequence, 2);
  assert.equal(
    second.previousEventRoot,
    authority.disclosure.auditEvent.eventRoot,
  );
  assert.deepEqual(
    parseCanopyProofGlobalCommandCenterSpatialReviewFact(
      authority.privacyReview,
    ),
    authority.privacyReview,
  );
  assert.deepEqual(
    parseCanopyProofGlobalCommandCenterSpatialDisclosureFact(second),
    second,
  );

  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialDisclosureFact(
        {
          candidate: authority.candidate,
          privacyReview: authority.privacyReview,
          safeguardingReview: authority.safeguardingReview,
          publishedAt: "2026-07-19T10:03:00.000Z",
        },
        actor(
          "spatial_invalid_history_publisher_critical",
          "admin",
          [canopyProofGlobalCommandCenterSpatialDisclosureScopes.publish],
        ),
        [
          {
            ...authority.disclosure.auditEvent,
            eventRoot: "f".repeat(64),
          },
        ],
      ),
    /AUDIT_HISTORY_INVALID/,
  );
});

test("spatial critical withdrawal rejects stale history, time regression, self-control, and root mutation", () => {
  const authority = fixture();
  const governor = actor(
    "spatial_governor_critical",
    "verifier",
    [canopyProofGlobalCommandCenterSpatialDisclosureScopes.withdraw],
  );
  const withdrawalInput = {
    disclosure: authority.disclosure,
    reasonCode: "privacy_risk" as const,
    rationale:
      "Independent governance review requires immediate withdrawal of generalized geometry.",
    controlledAt: "2026-07-19T10:06:00.000Z",
  };
  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
        withdrawalInput,
        governor,
        [],
      ),
    /WITHDRAWAL_NOT_CURRENT/,
  );
  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
        {
          ...withdrawalInput,
          controlledAt: "2026-07-19T10:01:59.000Z",
        },
        governor,
        [authority.disclosure.auditEvent],
      ),
    /WITHDRAWAL_TIME_INVALID/,
  );
  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
        withdrawalInput,
        actor(
          authority.publisher.id,
          "admin",
          [canopyProofGlobalCommandCenterSpatialDisclosureScopes.withdraw],
        ),
        [authority.disclosure.auditEvent],
      ),
    /WITHDRAWAL_INDEPENDENCE_REQUIRED/,
  );

  const withdrawal =
    buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
      withdrawalInput,
      governor,
      [authority.disclosure.auditEvent],
    );
  assert.deepEqual(
    parseCanopyProofGlobalCommandCenterSpatialControlFact(withdrawal),
    withdrawal,
  );
  assert.throws(
    () =>
      verifyCanopyProofGlobalCommandCenterSpatialWithdrawal(
        { ...withdrawal, controlRoot: "e".repeat(64) },
        authority.disclosure,
        [authority.disclosure.auditEvent],
      ),
    /CONTROL_ROOT_INVALID/,
  );
  assert.throws(
    () =>
      buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
        withdrawalInput,
        governor,
        [
          {
            ...authority.disclosure.auditEvent,
            eventRoot: "e".repeat(64),
          },
        ],
      ),
    /AUDIT_HISTORY_INVALID/,
  );
});

test("spatial critical resolution is bounded, ordered, tenant-scoped, current, and fail closed", () => {
  const authority = fixture();
  const withdrawal = buildCanopyProofGlobalCommandCenterSpatialWithdrawal(
    {
      disclosure: authority.disclosure,
      reasonCode: "governance_order",
      rationale:
        "Independent governance order withdraws the current generalized disclosure.",
      controlledAt: "2026-07-19T10:06:00.000Z",
    },
    actor(
      "spatial_resolution_governor_critical",
      "owner",
      [canopyProofGlobalCommandCenterSpatialDisclosureScopes.withdraw],
    ),
    [authority.disclosure.auditEvent],
  );
  const disclosureRecord = {
    kind: "disclosure" as const,
    disclosure: authority.disclosure,
    privacyReview: authority.privacyReview,
    safeguardingReview: authority.safeguardingReview,
  };
  const controlRecord = {
    kind: "control" as const,
    control: withdrawal,
  };
  const resolve = (
    overrides: ActorOverrides = {},
    records: readonly CanopyProofGlobalCommandCenterSpatialAuthorityRecord[] = [
      disclosureRecord,
    ],
  ) =>
    resolveCanopyProofGlobalCommandCenterSpatialDisclosure({
      organizationId,
      regionId,
      regionSourceRoot,
      sourceProjectCount: 4,
      at: "2026-07-19T10:05:00.000Z",
      records,
      ...overrides,
    });

  assert.equal(resolve({}, []), undefined);
  assert.equal(resolve({ sourceProjectCount: 5 }), undefined);
  assert.equal(resolve({ at: "2026-07-19T09:59:59.000Z" }), undefined);
  assert.equal(resolve({}, [controlRecord, disclosureRecord]), undefined);
  assert.throws(
    () => resolve({ at: "2026-07-19T10:05:00+00:00" }),
    /TIMESTAMP_NON_CANONICAL:projection time/,
  );
  assert.throws(
    () =>
      resolve(
        {},
        Array.from(
          { length: 1_025 },
          () => disclosureRecord,
        ),
      ),
    /REGION_HISTORY_LIMIT_EXCEEDED/,
  );
  assert.throws(
    () =>
      resolve({}, [
        {
          ...disclosureRecord,
          disclosure: {
            ...authority.disclosure,
            regionSequence: 2,
          },
        },
      ]),
    /REGION_SEQUENCE_INVALID/,
  );
  assert.throws(
    () =>
      resolve({}, [
        {
          kind: "control",
          control: { ...withdrawal, regionSequence: 1 },
        } as CanopyProofGlobalCommandCenterSpatialAuthorityRecord,
      ]),
    /CONTROL_WITHOUT_PUBLICATION/,
  );
  assert.throws(
    () => resolve({ organizationId: "org_spatial_foreign_critical" }),
    /REGION_SCOPE_INVALID/,
  );
  assert.throws(
    () => resolve({ regionId: "region_spatial_foreign_critical" }),
    /REGION_SCOPE_INVALID/,
  );
});
