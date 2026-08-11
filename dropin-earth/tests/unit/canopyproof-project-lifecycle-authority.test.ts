import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  buildCanopyProofProjectLifecycleActorAuthorityRoot,
  buildCanopyProofProjectLifecycleClosureSource,
  buildCanopyProofProjectLifecycleControl,
  buildCanopyProofProjectLifecycleFundingSource,
  buildCanopyProofProjectLifecycleMonitoringSource,
  buildCanopyProofProjectLifecycleProofSource,
  buildCanopyProofProjectLifecycleRegistration,
  buildCanopyProofProjectLifecycleReview,
  buildCanopyProofProjectLifecycleTransition,
  canopyProofProjectLifecycleSafety,
  canopyProofProjectLifecycleScopes,
  replayCanopyProofProjectLifecycle,
  type CanopyProofProjectLifecycleActorSnapshot,
  type CanopyProofProjectLifecycleRecord,
  type CanopyProofProjectLifecycleRegistrationFact,
  type CanopyProofProjectLifecycleRegistrationInput,
} from "../../services/api/src/domain/canopyproof/project-lifecycle-authority.js";

const organizationId = "org_project_lifecycle_unit_001";
const projectId = "project_lifecycle_unit_001";

test("canonical project lifecycle deterministically replays through long-term observation and closure", () => {
  const first = closedFixture();
  const second = closedFixture();

  assert.deepEqual(first.history, second.history);
  assert.deepEqual(first.projection, second.projection);
  assert.equal(first.projection.stage, "CLOSED");
  assert.equal(first.projection.underlyingStage, "CLOSED");
  assert.deepEqual(first.projection.issueCodes, []);
  assert.deepEqual(first.projection.safety, canopyProofProjectLifecycleSafety());
  assert.equal(first.history.length, 6);
  assert.deepEqual(first.history.map(recordSequence), [1, 2, 3, 4, 5, 6]);

  const reversedFunding = buildCanopyProofProjectLifecycleFundingSource({
    projectionRoots: [root("funding-projection-b"), root("funding-projection-a")],
    currentRoots: [root("funding-current-b"), root("funding-current-a")],
    allocatedCents: 25_000,
    resolvedAt: "2026-07-19T03:00:00.000Z",
  });
  assert.deepEqual(reversedFunding, fundingSource());
});

test("registration requires a baseline and observation cannot skip independent review or a canonical stage", () => {
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleRegistration(
        {
          ...registrationInput(),
          baseline: { ...registrationInput().baseline, evidenceRoots: [] },
        },
        proposer(),
      ),
    /Too small|at least 1|greater than or equal to 1/i,
  );

  const { history, registration } = registeredFixture();
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleTransition(
        {
          fromStage: "PROPOSED",
          toStage: "FUNDED",
          source: fundingSource(),
          reasonCode: "funding_confirmed",
          rationale: "Current governed funding authorities justify the bounded stage transition.",
          transitionedAt: "2026-07-19T03:00:00.000Z",
        },
        governor("governor-without-review"),
        history,
      ),
    /approved (registration )?review|source stage is not current/i,
  );

  const approved = approve(history, registration);
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleTransition(
        {
          fromStage: "PROPOSED",
          toStage: "VERIFIED",
          source: proofSource("2026-07-19T03:00:00.000Z"),
          reasonCode: "illegal_stage_skip",
          rationale: "This attempted transition deliberately skips the required funded stage.",
          transitionedAt: "2026-07-19T03:00:00.000Z",
        },
        governor("governor-stage-skip"),
        approved,
      ),
    /not legal/i,
  );
});

test("review is human, scoped, and separate from the proposer", () => {
  const { history, registration } = registeredFixture();
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleReview(
        reviewInput(registration),
        actor({
          id: proposer().id,
          role: "verifier",
          organization: "org_independent_review_001",
          scopes: [canopyProofProjectLifecycleScopes.review],
        }),
        history,
      ),
    /proposer cannot review/i,
  );
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleReview(
        reviewInput(registration),
        {
          ...reviewer(),
          id: "agent-reviewer",
          participantType: "agent",
        } as unknown as CanopyProofProjectLifecycleActorSnapshot,
        history,
      ),
    /Invalid literal value|Invalid input/i,
  );
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleReview(
        reviewInput(registration),
        actor({
          id: "unscoped-reviewer",
          role: "verifier",
          organization: "org_independent_review_001",
          scopes: [canopyProofProjectLifecycleScopes.propose],
        }),
        history,
      ),
    /lacks current projects:lifecycle_review authority/i,
  );
});

test("challenge blocks transitions until a different human restores the exact adverse control", () => {
  const funded = fundedFixture();
  const challenger = governor("challenge-governor");
  const challenge = buildCanopyProofProjectLifecycleControl(
    {
      action: "challenge",
      reasonCode: "source_anomaly",
      reasonRoot: root("challenge-reason"),
      rationale: "A current source anomaly requires a fail-closed institutional challenge.",
      controlledAt: "2026-07-19T04:00:00.000Z",
    },
    challenger,
    funded.history,
  );
  const challenged = [...funded.history, controlRecord(challenge)];
  assert.equal(project(challenged, "2026-07-19T04:00:00.000Z").stage, "CHALLENGED");

  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleTransition(
        {
          fromStage: "FUNDED",
          toStage: "VERIFIED",
          source: proofSource("2026-07-19T04:30:00.000Z"),
          reasonCode: "proof_current",
          rationale: "A proof source cannot override an unresolved project lifecycle challenge.",
          transitionedAt: "2026-07-19T04:30:00.000Z",
        },
        governor("blocked-transition-governor"),
        challenged,
      ),
    /source stage is not current/i,
  );

  const restoreInput = {
    action: "restore" as const,
    reasonCode: "challenge_resolved",
    reasonRoot: root("restoration-reason"),
    rationale: "Independent source re-resolution closed the challenge without rewriting history.",
    restoresControlRoot: challenge.controlRoot,
    restorationAuthorityRoot: root("restoration-authority"),
    controlledAt: "2026-07-19T05:00:00.000Z",
  };
  assert.throws(
    () => buildCanopyProofProjectLifecycleControl(restoreInput, challenger, challenged),
    /independent governor/i,
  );
  const restore = buildCanopyProofProjectLifecycleControl(
    restoreInput,
    governor("restoration-governor"),
    challenged,
  );
  const restored = [...challenged, controlRecord(restore)];
  assert.equal(project(restored, "2026-07-19T05:00:00.000Z").stage, "FUNDED");

  const verified = buildCanopyProofProjectLifecycleTransition(
    {
      fromStage: "FUNDED",
      toStage: "VERIFIED",
      source: proofSource("2026-07-19T05:30:00.000Z"),
      reasonCode: "proof_current",
      rationale: "Current Environmental Proof authorities justify the bounded verified stage.",
      transitionedAt: "2026-07-19T05:30:00.000Z",
    },
    governor("post-restoration-governor"),
    restored,
  );
  assert.equal(
    project([...restored, transitionRecord(verified)], "2026-07-19T05:30:00.000Z").stage,
    "VERIFIED",
  );
});

test("an unresolved adverse state survives expiry and renewal requires governed resolution", () => {
  const { history, registration } = registeredFixture("2026-07-20T00:00:00.000Z");
  const approved = approve(history, registration);
  const funding = buildCanopyProofProjectLifecycleTransition(
    {
      fromStage: "PROPOSED",
      toStage: "FUNDED",
      source: fundingSource(),
      reasonCode: "funding_confirmed",
      rationale: "Current governed funding authorities justify the bounded stage transition.",
      transitionedAt: "2026-07-19T03:00:00.000Z",
    },
    governor("expiry-funding-governor"),
    approved,
  );
  const funded = [...approved, transitionRecord(funding)];
  const challenge = buildCanopyProofProjectLifecycleControl(
    {
      action: "challenge",
      reasonCode: "unresolved_expiry_risk",
      reasonRoot: root("expiry-challenge"),
      rationale: "The unresolved anomaly must remain visible after the registration validity ends.",
      controlledAt: "2026-07-19T04:00:00.000Z",
    },
    governor("expiry-challenge-governor"),
    funded,
  );
  const challenged = [...funded, controlRecord(challenge)];
  assert.equal(project(challenged, "2026-07-21T00:00:00.000Z").stage, "CHALLENGED");
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleRegistration(
        registrationInput({
          registeredAt: "2026-07-21T01:00:00.000Z",
          validFrom: "2026-07-21T00:00:00.000Z",
          validUntil: "2027-07-21T00:00:00.000Z",
        }),
        proposer(),
        challenged,
      ),
    /non-expired canonical generation/i,
  );

  const restored = buildCanopyProofProjectLifecycleControl(
    {
      action: "restore",
      reasonCode: "expiry_challenge_resolved",
      reasonRoot: root("expiry-restoration-reason"),
      rationale: "A separate governor resolved the adverse source after expiry for safe renewal.",
      restoresControlRoot: challenge.controlRoot,
      restorationAuthorityRoot: root("expiry-restoration-authority"),
      controlledAt: "2026-07-21T01:00:00.000Z",
    },
    governor("expiry-restoration-governor"),
    challenged,
  );
  const resolved = [...challenged, controlRecord(restored)];
  assert.equal(project(resolved, "2026-07-21T01:00:00.000Z").stage, "EXPIRED");
  const renewal = buildCanopyProofProjectLifecycleRegistration(
    registrationInput({
      registeredAt: "2026-07-21T02:00:00.000Z",
      validFrom: "2026-07-21T00:00:00.000Z",
      validUntil: "2027-07-21T00:00:00.000Z",
    }),
    proposer(),
    resolved,
  );
  assert.equal(renewal.generation, 2);
  assert.equal(renewal.projectSequence, resolved.length + 1);
  assert.equal(
    project([...resolved, registrationRecord(renewal)], "2026-07-21T02:00:00.000Z").stage,
    "PENDING_REVIEW",
  );
});

test("tampering with facts, actors, audit events, or source order is rejected during replay", () => {
  const fixture = closedFixture();
  const first = fixture.history[0];
  assert.equal(first?.kind, "registration");
  if (!first || first.kind !== "registration") throw new Error("registration fixture missing");
  const factTampered = [
    registrationRecord({ ...first.registration, projectAuthorityRoot: root("substituted-project") }),
    ...fixture.history.slice(1),
  ];
  assert.throws(
    () => project(factTampered, "2026-07-19T07:00:00.000Z"),
    /root is invalid|command identity is invalid/i,
  );

  const auditTampered = [
    registrationRecord({
      ...first.registration,
      auditEvent: { ...first.registration.auditEvent, eventRoot: root("substituted-audit-event") },
    }),
    ...fixture.history.slice(1),
  ];
  assert.throws(
    () => project(auditTampered, "2026-07-19T07:00:00.000Z"),
    /audit chain is invalid|sequence or predecessor is invalid/i,
  );

  const second = fixture.history[1];
  assert.equal(second?.kind, "review");
  if (!second || second.kind !== "review") throw new Error("review fixture missing");
  const actorTampered = [
    first,
    {
      kind: "review" as const,
      review: {
        ...second.review,
        reviewer: { ...second.review.reviewer, id: "substituted-reviewer" },
      },
    },
    ...fixture.history.slice(2),
  ];
  assert.throws(() => project(actorTampered, "2026-07-19T07:00:00.000Z"), /actor authority root/i);

  const nonCanonicalFunding = buildCanopyProofProjectLifecycleFundingSource({
    projectionRoots: [root("funding-projection-a"), root("funding-projection-b")],
    currentRoots: [root("funding-current-a"), root("funding-current-b")],
    allocatedCents: 25_000,
    resolvedAt: "2026-07-19T03:00:00.000Z",
  });
  if (nonCanonicalFunding.kind !== "funding") throw new Error("funding source fixture missing");
  const { history, registration } = registeredFixture();
  const approved = approve(history, registration);
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleTransition(
        {
          fromStage: "PROPOSED",
          toStage: "FUNDED",
          source: {
            ...nonCanonicalFunding,
            projectionRoots: [...nonCanonicalFunding.projectionRoots].reverse(),
          },
          reasonCode: "noncanonical_source",
          rationale: "A non-canonical source ordering must not produce a second transition root.",
          transitionedAt: "2026-07-19T03:00:00.000Z",
        },
        governor("noncanonical-source-governor"),
        approved,
      ),
    /not canonical/i,
  );
});

test("closed and revoked generations are terminal", () => {
  const closed = closedFixture();
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleControl(
        {
          action: "challenge",
          reasonCode: "late_challenge",
          reasonRoot: root("late-challenge"),
          rationale: "A closed lifecycle cannot be reopened by appending an adverse control.",
          controlledAt: "2026-07-19T08:00:00.000Z",
        },
        governor("late-challenge-governor"),
        closed.history,
      ),
    /control is not legal/i,
  );

  const funded = fundedFixture();
  const revoke = buildCanopyProofProjectLifecycleControl(
    {
      action: "revoke",
      reasonCode: "terminal_revocation",
      reasonRoot: root("terminal-revocation"),
      rationale: "A governed terminal defect permanently revokes this lifecycle generation.",
      controlledAt: "2026-07-19T04:00:00.000Z",
    },
    governor("revocation-governor"),
    funded.history,
  );
  const revoked = [...funded.history, controlRecord(revoke)];
  assert.equal(project(revoked, "2026-07-19T04:00:00.000Z").stage, "REVOKED");
  assert.throws(
    () =>
      buildCanopyProofProjectLifecycleRegistration(
        registrationInput({ registeredAt: "2026-07-20T00:00:00.000Z" }),
        proposer(),
        revoked,
      ),
    /non-expired canonical generation/i,
  );
});

function closedFixture() {
  const verified = verifiedFixture();
  const observation = buildCanopyProofProjectLifecycleTransition(
    {
      fromStage: "VERIFIED",
      toStage: "LONG_TERM_OBSERVATION",
      source: buildCanopyProofProjectLifecycleMonitoringSource({
        monitoringEventRoots: [root("monitoring-event-a"), root("monitoring-event-b")],
        latestObservedAt: "2026-07-19T05:00:00.000Z",
        monitoringPlanRoot: verified.registration.monitoringPlan.monitoringPlanRoot,
        resolvedAt: "2026-07-19T05:30:00.000Z",
      }),
      reasonCode: "monitoring_current",
      rationale: "Post-verification monitoring events begin the bounded observation period.",
      transitionedAt: "2026-07-19T05:30:00.000Z",
    },
    governor("observation-governor"),
    verified.history,
  );
  const observing = [...verified.history, transitionRecord(observation)];
  const closure = buildCanopyProofProjectLifecycleTransition(
    {
      fromStage: "LONG_TERM_OBSERVATION",
      toStage: "CLOSED",
      source: buildCanopyProofProjectLifecycleClosureSource({
        closureEvidenceRoots: [root("closure-evidence-a"), root("closure-evidence-b")],
        finalMonitoringRoot: root("final-monitoring"),
        closureReviewRoot: root("closure-review"),
        resolvedAt: "2026-07-19T06:00:00.000Z",
      }),
      reasonCode: "closure_approved",
      rationale: "Independent closure evidence and final monitoring complete the bounded lifecycle.",
      transitionedAt: "2026-07-19T06:00:00.000Z",
    },
    governor("closure-governor"),
    observing,
  );
  const history = [...observing, transitionRecord(closure)];
  return { history, projection: project(history, "2026-07-19T07:00:00.000Z") };
}

function verifiedFixture() {
  const funded = fundedFixture();
  const verification = buildCanopyProofProjectLifecycleTransition(
    {
      fromStage: "FUNDED",
      toStage: "VERIFIED",
      source: proofSource("2026-07-19T04:00:00.000Z"),
      reasonCode: "proof_current",
      rationale: "Current Environmental Proof authorities justify the bounded verified stage.",
      transitionedAt: "2026-07-19T04:00:00.000Z",
    },
    governor("verification-governor"),
    funded.history,
  );
  return {
    registration: funded.registration,
    history: [...funded.history, transitionRecord(verification)],
  };
}

function fundedFixture() {
  const { history, registration } = registeredFixture();
  const approved = approve(history, registration);
  const funding = buildCanopyProofProjectLifecycleTransition(
    {
      fromStage: "PROPOSED",
      toStage: "FUNDED",
      source: fundingSource(),
      reasonCode: "funding_confirmed",
      rationale: "Current governed funding authorities justify the bounded stage transition.",
      transitionedAt: "2026-07-19T03:00:00.000Z",
    },
    governor("funding-governor"),
    approved,
  );
  return { registration, history: [...approved, transitionRecord(funding)] };
}

function registeredFixture(validUntil = "2027-07-19T00:00:00.000Z") {
  const registration = buildCanopyProofProjectLifecycleRegistration(
    registrationInput({ validUntil }),
    proposer(),
  );
  return { registration, history: [registrationRecord(registration)] };
}

function approve(
  history: readonly CanopyProofProjectLifecycleRecord[],
  registration: CanopyProofProjectLifecycleRegistrationFact,
) {
  const review = buildCanopyProofProjectLifecycleReview(reviewInput(registration), reviewer(), history);
  return [...history, reviewRecord(review)];
}

function reviewInput(registration: CanopyProofProjectLifecycleRegistrationFact) {
  return {
    registrationId: registration.id,
    registrationRoot: registration.registrationRoot,
    decision: "approve" as const,
    reasonCode: "independent_review_passed",
    rationale: "An independent accredited human reviewed the complete bounded registration.",
    reviewedAt: "2026-07-19T02:00:00.000Z",
  };
}

function registrationInput(
  overrides: Readonly<{
    registeredAt?: string;
    validFrom?: string;
    validUntil?: string;
  }> = {},
): CanopyProofProjectLifecycleRegistrationInput {
  return {
    organizationId,
    projectId,
    projectAuthorityRoot: root("project-authority"),
    projectStatus: "active",
    baseline: {
      baselineId: "baseline_project_lifecycle_unit_001",
      observedAt: "2026-07-01T00:00:00.000Z",
      evidenceRoots: [root("baseline-evidence-a"), root("baseline-evidence-b")],
      satelliteRoots: [root("baseline-satellite")],
      metricRoots: [root("baseline-metric")],
      limitations: ["This bounded baseline does not constitute an impact certification."],
    },
    intervention: {
      interventionId: "intervention_project_lifecycle_unit_001",
      interventionType: "reforestation",
      startsAt: "2026-08-01T00:00:00.000Z",
      endsAt: "2028-08-01T00:00:00.000Z",
      targetAreaSquareMeters: 500_000,
      targetTreeCount: 12_500,
      methodologyRoot: root("intervention-methodology"),
      evidenceRoots: [root("intervention-evidence")],
    },
    monitoringPlan: {
      monitoringPlanId: "monitoring_plan_project_lifecycle_unit_001",
      startsAt: "2026-07-19T00:00:00.000Z",
      endsAt: "2029-07-19T00:00:00.000Z",
      cadenceDays: 30,
      indicatorCodes: ["canopy_cover", "tree_survival"],
      evidenceRequirementCodes: ["field_observation", "satellite_observation"],
      responsibleOrganizationId: organizationId,
      escalationPolicyRoot: root("monitoring-escalation-policy"),
    },
    policyId: "policy_project_lifecycle_unit_001",
    policyVersion: "v1.0.0",
    policyRoot: root("project-lifecycle-policy"),
    validFrom: overrides.validFrom ?? "2026-07-19T00:00:00.000Z",
    validUntil: overrides.validUntil ?? "2027-07-19T00:00:00.000Z",
    registeredAt: overrides.registeredAt ?? "2026-07-19T01:00:00.000Z",
  };
}

function fundingSource() {
  return buildCanopyProofProjectLifecycleFundingSource({
    projectionRoots: [root("funding-projection-a"), root("funding-projection-b")],
    currentRoots: [root("funding-current-a"), root("funding-current-b")],
    allocatedCents: 25_000,
    resolvedAt: "2026-07-19T03:00:00.000Z",
  });
}

function proofSource(resolvedAt: string) {
  return buildCanopyProofProjectLifecycleProofSource({
    lifecycleProjectionRoots: [root("environmental-proof-projection")],
    currentRoots: [root("environmental-proof-current")],
    resolvedAt,
  });
}

function proposer() {
  return actor({
    id: "project-proposer",
    role: "owner",
    organization: organizationId,
    scopes: [],
    subject: true,
  });
}

function reviewer() {
  return actor({
    id: "project-reviewer",
    role: "researcher",
    organization: "org_project_review_unit_001",
    scopes: [canopyProofProjectLifecycleScopes.review],
  });
}

function governor(id: string) {
  return actor({
    id,
    role: "verifier",
    organization: `org_${id}`,
    scopes: [canopyProofProjectLifecycleScopes.govern],
  });
}

function actor(input: Readonly<{
  id: string;
  role: CanopyProofProjectLifecycleActorSnapshot["role"];
  organization: string;
  scopes: readonly string[];
  subject?: boolean;
}>): CanopyProofProjectLifecycleActorSnapshot {
  const seed = {
    id: input.id,
    participantType: "human" as const,
    role: input.role,
    verificationStatus: "verified" as const,
    organizationId: input.organization,
    organizationVerificationStatus: "verified" as const,
    participantRoot: root(`participant:${input.id}`),
    organizationRoot: root(`organization:${input.organization}`),
    membershipId: `membership_${input.id}`,
    membershipStatus: "active" as const,
    membershipRoot: root(`membership:${input.id}`),
    authoritySource: input.subject ? ("subject_membership" as const) : ("canonical_accreditation" as const),
    ...(!input.subject
      ? {
          accreditationId: `accreditation_${input.id}`,
          accreditationStatus: "approved" as const,
          accreditationDecisionRoot: root(`accreditation-decision:${input.id}`),
          accreditationProjectionRoot: root(`accreditation-projection:${input.id}`),
          accreditationValidFrom: "2026-01-01T00:00:00.000Z",
          accreditationValidUntil: "2030-01-01T00:00:00.000Z",
        }
      : {}),
    accreditationScope: [...input.scopes].sort((left, right) => left.localeCompare(right)),
  };
  return {
    ...seed,
    authorityRoot: buildCanopyProofProjectLifecycleActorAuthorityRoot(seed),
  };
}

function project(history: readonly CanopyProofProjectLifecycleRecord[], evaluatedAt: string) {
  const projection = replayCanopyProofProjectLifecycle(history, evaluatedAt);
  if (!projection) throw new Error("project lifecycle projection missing");
  return projection;
}

function registrationRecord(
  registration: CanopyProofProjectLifecycleRegistrationFact,
): CanopyProofProjectLifecycleRecord {
  return { kind: "registration", registration };
}

function reviewRecord(
  review: ReturnType<typeof buildCanopyProofProjectLifecycleReview>,
): CanopyProofProjectLifecycleRecord {
  return { kind: "review", review };
}

function transitionRecord(
  transition: ReturnType<typeof buildCanopyProofProjectLifecycleTransition>,
): CanopyProofProjectLifecycleRecord {
  return { kind: "transition", transition };
}

function controlRecord(
  control: ReturnType<typeof buildCanopyProofProjectLifecycleControl>,
): CanopyProofProjectLifecycleRecord {
  return { kind: "control", control };
}

function recordSequence(record: CanopyProofProjectLifecycleRecord) {
  if (record.kind === "registration") return record.registration.projectSequence;
  if (record.kind === "review") return record.review.projectSequence;
  if (record.kind === "transition") return record.transition.projectSequence;
  return record.control.projectSequence;
}

function root(label: string) {
  return hashJson({ kind: "canopyproof-project-lifecycle-unit-root-v1", label });
}
