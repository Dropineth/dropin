import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import type { CanopyProofVerificationActorSnapshot } from "../../services/api/src/domain/canopyproof/evidence-verification-authority.js";
import {
  buildCanopyProofEarlyWarningCandidate,
  buildCanopyProofEarlyWarningControl,
  buildCanopyProofEarlyWarningPublication,
  buildCanopyProofEarlyWarningReview,
  canopyProofEarlyWarningSafety,
  canopyProofEarlyWarningScopes,
  resolveCanopyProofEarlyWarningProjection,
  verifyCanopyProofEarlyWarningCandidate,
  verifyCanopyProofEarlyWarningControl,
  verifyCanopyProofEarlyWarningPublication,
  verifyCanopyProofEarlyWarningReview,
  type CanopyProofEarlyWarningCandidateInput,
} from "../../services/api/src/domain/canopyproof/early-warning-authority.js";

const organizationId = "org_early_warning_unit_001";
const scopeId = "project_early_warning_unit_001";

test("early-warning candidate is deterministic, integer-scaled, sorted, and minimized", () => {
  const first = candidate();
  const second = candidate();
  assert.deepEqual(first, second);
  assert.deepEqual(verifyCanopyProofEarlyWarningCandidate(first), first);
  assert.deepEqual(
    first.sources.map((source) => source.sourceType),
    ["field_evidence", "satellite_observation"],
  );
  assert.deepEqual(
    first.indicators.map((indicator) => indicator.indicatorKey),
    ["rainfall_deficit_index", "soil_moisture_pct"],
  );
  assert.equal(first.indicators.every((indicator) => indicator.breached), true);
  assert.equal(first.confidenceBps, 8_200);
  assert.doesNotMatch(
    JSON.stringify(first),
    /latitude|longitude|coordinates|email|phone|privateKey|accessToken/,
  );
  assert.deepEqual(first.safety, canopyProofEarlyWarningSafety());
});

test("early-warning candidate rejects duplicate, non-breached, floating, and unsafe inputs", () => {
  const input = candidateInput();
  assert.throws(
    () =>
      buildCanopyProofEarlyWarningCandidate(
        { ...input, sources: [input.sources[0]!, input.sources[0]!] },
        human("risk_preparer_unit_001", "researcher", canopyProofEarlyWarningScopes.prepare),
      ),
    /SOURCE_DUPLICATE/,
  );
  assert.throws(
    () =>
      buildCanopyProofEarlyWarningCandidate(
        {
          ...input,
          indicators: [
            {
              indicatorKey: "soil_moisture_pct",
              valueScaled: 2_000,
              scale: 100,
              unit: "percent",
              thresholdScaled: 1_800,
              thresholdScale: 100,
              comparison: "lte",
            },
          ],
        },
        human("risk_preparer_unit_001", "researcher", canopyProofEarlyWarningScopes.prepare),
      ),
    /THRESHOLD_BREACH_REQUIRED/,
  );
  assert.throws(
    () =>
      buildCanopyProofEarlyWarningCandidate(
        {
          ...input,
          indicators: [{ ...input.indicators[0]!, valueScaled: 71.5 }],
        },
        human("risk_preparer_unit_001", "researcher", canopyProofEarlyWarningScopes.prepare),
      ),
    /expected int/i,
  );
  assert.throws(
    () =>
      buildCanopyProofEarlyWarningCandidate(
        {
          ...input,
          summary: "Official emergency declaration: evacuate now from the affected region.",
        },
        human("risk_preparer_unit_001", "researcher", canopyProofEarlyWarningScopes.prepare),
      ),
    /UNSAFE_DOCUMENT/,
  );
});

test("early-warning publication requires independent scientific, operational, and publishing humans", () => {
  const authority = fixture();
  assert.deepEqual(
    verifyCanopyProofEarlyWarningReview(authority.scientificReview),
    authority.scientificReview,
  );
  assert.deepEqual(
    verifyCanopyProofEarlyWarningReview(authority.operationalReview),
    authority.operationalReview,
  );
  assert.deepEqual(
    verifyCanopyProofEarlyWarningPublication(
      authority.publication,
      authority.scientificReview,
      authority.operationalReview,
    ),
    authority.publication,
  );
  assert.equal(authority.publication.publicProjection.confidenceBand, "very_high");
  assert.equal(
    authority.publication.publicProjection.safetyDisclosure,
    "Environmental risk advisory only; not an emergency declaration or guarantee.",
  );

  assert.throws(
    () =>
      buildCanopyProofEarlyWarningReview(
        {
          candidate: authority.publication.candidate,
          reviewKind: "scientific",
          decision: "accepted",
          reasonCode: "source_consistent",
          rationale: "The source and indicator roots are internally consistent.",
          reviewedAt: "2026-07-19T02:00:00.000Z",
        },
        agent("risk_model_agent_unit_002"),
      ),
    /HUMAN_AUTHORITY_REQUIRED/,
  );
  assert.throws(
    () =>
      buildCanopyProofEarlyWarningPublication(
        {
          candidate: authority.publication.candidate,
          scientificReview: authority.scientificReview,
          operationalReview: authority.operationalReview,
          predecessorPublicationRoot: null,
          publishedAt: "2026-07-19T05:00:00.000Z",
        },
        human(
          authority.scientificReview.reviewer.id,
          "admin",
          canopyProofEarlyWarningScopes.publish,
        ),
      ),
    /PUBLISHER_INDEPENDENCE_REQUIRED/,
  );
});

test("agent can prepare a bounded candidate but cannot become final authority", () => {
  const preparedByAgent = buildCanopyProofEarlyWarningCandidate(
    candidateInput(),
    agent("risk_model_agent_unit_001"),
  );
  assert.equal(preparedByAgent.preparer.participantType, "agent");
  assert.deepEqual(preparedByAgent.preparer.accreditationScope, []);
  const scientificReview = buildCanopyProofEarlyWarningReview(
    {
      candidate: preparedByAgent,
      reviewKind: "scientific",
      decision: "accepted",
      reasonCode: "source_consistent",
      rationale: "Independent scientific review confirms the bounded source lineage.",
      reviewedAt: "2026-07-19T02:00:00.000Z",
    },
    human(
      "risk_scientific_unit_agent_path",
      "researcher",
      canopyProofEarlyWarningScopes.scientificReview,
    ),
  );
  assert.equal(scientificReview.reviewer.participantType, "human");
  assert.throws(
    () =>
      buildCanopyProofEarlyWarningReview(
        {
          candidate: preparedByAgent,
          reviewKind: "operational",
          decision: "accepted",
          reasonCode: "operations_ready",
          rationale: "Operational review confirms the bounded audience and validity window.",
          reviewedAt: "2026-07-19T03:00:00.000Z",
        },
        agent("risk_model_agent_unit_003"),
      ),
    /HUMAN_AUTHORITY_REQUIRED/,
  );
});

test("challenge, withdrawal, and expiry fail closed without an older-version fallback", () => {
  const first = fixture();
  const challenge = buildCanopyProofEarlyWarningControl(
    {
      publication: first.publication,
      action: "challenge",
      reasonCode: "scientific_dispute",
      rationale: "A qualified independent reviewer disputed the current source interpretation.",
      controlledAt: "2026-07-19T06:00:00.000Z",
    },
    human("risk_governor_unit_001", "verifier", canopyProofEarlyWarningScopes.govern),
    [first.publication.auditEvent],
  );
  assert.deepEqual(
    verifyCanopyProofEarlyWarningControl(
      challenge,
      first.publication,
      [first.publication.auditEvent],
    ),
    challenge,
  );
  const challenged = resolveCanopyProofEarlyWarningProjection(
    [
      { kind: "publication", ...first },
      { kind: "control", control: challenge },
    ],
    "2026-07-19T07:00:00.000Z",
  );
  assert.equal(challenged?.state, "challenged");
  assert.equal(challenged?.publicationRoot, first.publication.publicationRoot);

  const withdrawal = buildCanopyProofEarlyWarningControl(
    {
      publication: first.publication,
      action: "withdraw",
      reasonCode: "governance_order",
      rationale: "Institutional governance ordered withdrawal pending a corrected source review.",
      controlledAt: "2026-07-19T06:00:00.000Z",
    },
    human("risk_governor_unit_002", "admin", canopyProofEarlyWarningScopes.govern),
    [first.publication.auditEvent],
  );
  assert.equal(
    resolveCanopyProofEarlyWarningProjection(
      [
        { kind: "publication", ...first },
        { kind: "control", control: withdrawal },
      ],
      "2026-07-19T07:00:00.000Z",
    )?.state,
    "withdrawn",
  );
  assert.equal(
    resolveCanopyProofEarlyWarningProjection(
      [{ kind: "publication", ...first }],
      "2026-08-02T00:00:00.000Z",
    )?.state,
    "expired",
  );
});

test("early-warning roots, rejected reviews, stream scope, and predecessor continuity are enforced", () => {
  const authority = fixture();
  assert.throws(
    () =>
      verifyCanopyProofEarlyWarningCandidate({
        ...authority.publication.candidate,
        candidateRoot: "f".repeat(64),
      }),
    /CANDIDATE_ROOT_INVALID/,
  );
  assert.throws(
    () =>
      verifyCanopyProofEarlyWarningPublication(
        { ...authority.publication, publicationRoot: "e".repeat(64) },
        authority.scientificReview,
        authority.operationalReview,
      ),
    /PUBLICATION_ROOT_INVALID/,
  );
  const rejected = buildCanopyProofEarlyWarningReview(
    {
      candidate: authority.publication.candidate,
      reviewKind: "scientific",
      decision: "rejected",
      reasonCode: "source_conflict",
      rationale: "The submitted source lineage conflicts with the reviewed observation interval.",
      reviewedAt: "2026-07-19T02:00:00.000Z",
    },
    human(
      "risk_scientific_reject_unit_001",
      "researcher",
      canopyProofEarlyWarningScopes.scientificReview,
    ),
  );
  assert.throws(
    () =>
      buildCanopyProofEarlyWarningPublication(
        {
          candidate: authority.publication.candidate,
          scientificReview: rejected,
          operationalReview: authority.operationalReview,
          predecessorPublicationRoot: null,
          publishedAt: "2026-07-19T05:00:00.000Z",
        },
        human("risk_publisher_reject_unit_001", "owner", canopyProofEarlyWarningScopes.publish),
      ),
    /SCIENTIFIC_REVIEW_REQUIRED/,
  );

  const second = fixture({
    advisoryCode: "drought_watch_v2",
    summary: "Updated moisture deficit remains above the governed drought advisory threshold.",
    preparedAt: "2026-07-19T06:00:00.000Z",
    validFrom: "2026-07-19T09:00:00.000Z",
    validUntil: "2026-08-10T00:00:00.000Z",
    observationEnd: "2026-07-19T05:00:00.000Z",
    sourceObservedAt: "2026-07-19T05:00:00.000Z",
    sourceReceivedAt: "2026-07-19T05:30:00.000Z",
    scientificReviewedAt: "2026-07-19T07:00:00.000Z",
    operationalReviewedAt: "2026-07-19T08:00:00.000Z",
    publishedAt: "2026-07-19T09:00:00.000Z",
    predecessorPublicationRoot: authority.publication.publicationRoot,
    streamHistory: [authority.publication.auditEvent],
  });
  const wrongPredecessor = {
    ...second.publication,
    predecessorPublicationRoot: null,
  };
  assert.throws(
    () =>
      resolveCanopyProofEarlyWarningProjection(
        [
          { kind: "publication", ...authority },
          {
            kind: "publication",
            publication: wrongPredecessor,
            scientificReview: second.scientificReview,
            operationalReview: second.operationalReview,
          },
        ],
        "2026-07-19T10:00:00.000Z",
      ),
    /PUBLICATION_ROOT_INVALID|PREDECESSOR_INVALID/,
  );
});

function fixture(
  options: Partial<{
    advisoryCode: string;
    summary: string;
    preparedAt: string;
    validFrom: string;
    validUntil: string;
    observationEnd: string;
    sourceObservedAt: string;
    sourceReceivedAt: string;
    scientificReviewedAt: string;
    operationalReviewedAt: string;
    publishedAt: string;
    predecessorPublicationRoot: string;
    streamHistory: readonly import("../../services/api/src/domain/canopyproof/proof-engine.js").CanopyProofAuditEvent[];
  }> = {},
) {
  const input = candidateInput();
  const sources = input.sources.map((source) => ({
    ...source,
    observedAt: options.sourceObservedAt ?? source.observedAt,
    receivedAt: options.sourceReceivedAt ?? source.receivedAt,
  }));
  const candidateValue = buildCanopyProofEarlyWarningCandidate(
    {
      ...input,
      advisoryCode: options.advisoryCode ?? input.advisoryCode,
      summary: options.summary ?? input.summary,
      observationEnd: options.observationEnd ?? input.observationEnd,
      preparedAt: options.preparedAt ?? input.preparedAt,
      validFrom: options.validFrom ?? input.validFrom,
      validUntil: options.validUntil ?? input.validUntil,
      sources,
    },
    human("risk_preparer_unit_001", "researcher", canopyProofEarlyWarningScopes.prepare),
  );
  const scientificReview = buildCanopyProofEarlyWarningReview(
    {
      candidate: candidateValue,
      reviewKind: "scientific",
      decision: "accepted",
      reasonCode: "source_consistent",
      rationale: "Independent scientific review confirms the bounded source and indicator roots.",
      reviewedAt: options.scientificReviewedAt ?? "2026-07-19T02:00:00.000Z",
    },
    human(
      `risk_scientific_${options.advisoryCode ?? "v1"}`,
      "researcher",
      canopyProofEarlyWarningScopes.scientificReview,
    ),
  );
  const operationalReview = buildCanopyProofEarlyWarningReview(
    {
      candidate: candidateValue,
      reviewKind: "operational",
      decision: "accepted",
      reasonCode: "audience_and_window_appropriate",
      rationale: "Independent operational review confirms the audience and bounded validity window.",
      reviewedAt: options.operationalReviewedAt ?? "2026-07-19T03:00:00.000Z",
    },
    human(
      `risk_operational_${options.advisoryCode ?? "v1"}`,
      "verifier",
      canopyProofEarlyWarningScopes.operationalReview,
    ),
  );
  const publication = buildCanopyProofEarlyWarningPublication(
    {
      candidate: candidateValue,
      scientificReview,
      operationalReview,
      predecessorPublicationRoot: options.predecessorPublicationRoot ?? null,
      publishedAt: options.publishedAt ?? "2026-07-19T05:00:00.000Z",
    },
    human(
      `risk_publisher_${options.advisoryCode ?? "v1"}`,
      "admin",
      canopyProofEarlyWarningScopes.publish,
    ),
    options.streamHistory ?? [],
  );
  return { publication, scientificReview, operationalReview };
}

function candidate() {
  return buildCanopyProofEarlyWarningCandidate(
    candidateInput(),
    human("risk_preparer_unit_001", "researcher", canopyProofEarlyWarningScopes.prepare),
  );
}

function candidateInput(): CanopyProofEarlyWarningCandidateInput {
  return {
    organizationId,
    organizationPublicId: "org_public_early_warning_001",
    scopeType: "project",
    scopeId,
    scopePublicId: "project_public_early_warning_001",
    scopeAuthorityRoot: "a".repeat(64),
    riskClass: "drought",
    severity: "high",
    confidenceBps: 8_200,
    advisoryCode: "drought_watch_v1",
    summary: "Observed moisture deficit exceeds the governed drought advisory threshold.",
    intendedAudiences: ["operator", "community", "government"],
    sources: [
      {
        sourceType: "satellite_observation",
        sourceId: "satellite_observation_001",
        sourceRoot: "b".repeat(64),
        observedAt: "2026-07-19T00:20:00.000Z",
        receivedAt: "2026-07-19T00:40:00.000Z",
        provenancePolicyRoot: "c".repeat(64),
      },
      {
        sourceType: "field_evidence",
        sourceId: "field_evidence_001",
        sourceRoot: "d".repeat(64),
        observedAt: "2026-07-19T00:10:00.000Z",
        receivedAt: "2026-07-19T00:30:00.000Z",
        provenancePolicyRoot: "e".repeat(64),
      },
    ],
    indicators: [
      {
        indicatorKey: "soil_moisture_pct",
        valueScaled: 1_200,
        scale: 100,
        unit: "percent",
        thresholdScaled: 1_800,
        thresholdScale: 100,
        comparison: "lte",
      },
      {
        indicatorKey: "rainfall_deficit_index",
        valueScaled: 7_100,
        scale: 100,
        unit: "index_points",
        thresholdScaled: 6_500,
        thresholdScale: 100,
        comparison: "gte",
      },
    ],
    observationStart: "2026-07-19T00:00:00.000Z",
    observationEnd: "2026-07-19T00:30:00.000Z",
    policyId: "early_warning_policy_001",
    policyVersion: "1.0.0",
    policyRoot: "f".repeat(64),
    validFrom: "2026-07-19T04:00:00.000Z",
    validUntil: "2026-08-01T00:00:00.000Z",
    preparedAt: "2026-07-19T01:00:00.000Z",
  };
}

function human(
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
    participantRoot: hashJson({ kind: "early-warning-unit-participant", id }),
    organizationRoot: hashJson({ kind: "early-warning-unit-organization", organizationId }),
    membershipId: `membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "early-warning-unit-membership", id }),
    accreditationId: `accreditation_${id}`,
    accreditationStatus: "approved" as const,
    accreditationRoot: hashJson({ kind: "early-warning-unit-accreditation", id, scope }),
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

function agent(id: string): CanopyProofVerificationActorSnapshot {
  const normalized = {
    id,
    participantType: "agent" as const,
    role: "agent" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "early-warning-unit-agent", id }),
    organizationRoot: hashJson({ kind: "early-warning-unit-organization", organizationId }),
    accreditationScope: [],
  };
  return {
    ...normalized,
    authorityRoot: hashJson({
      kind: "canopyproof-verification-actor-authority-v1",
      ...normalized,
    }),
  };
}
