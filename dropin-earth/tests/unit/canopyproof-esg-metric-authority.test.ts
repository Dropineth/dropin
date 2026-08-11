import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofEsgMetricAuthorityService,
  canonicalizeCanopyProofMetricDecimal,
  compareCanopyProofMetricDecimals,
} from "../../services/api/src/domain/canopyproof/esg-metric-authority.js";
import {
  createEsgMetricFixture,
  esgMetricReviewedAt,
  fixtureHash,
  metricActor,
} from "../helpers/canopyproof-esg-metric-fixture.js";

test("governed ESG metric definition and reviewed result replay with deterministic exact roots", () => {
  const fixture = createEsgMetricFixture();
  const service = new CanopyProofEsgMetricAuthorityService();
  const definition = service.publishDefinition(fixture.definitionInput, {
    organization: fixture.organization,
    publisher: fixture.publisher,
    reviewers: fixture.definitionReviewers,
    methodology: fixture.methodology.bundle,
    methodologyProjection: fixture.methodology.projection,
  });
  const definitionProjection = service.projectDefinition(
    definition.id,
    fixture.methodology.projection,
    esgMetricReviewedAt,
  );
  const bundle = service.recordResult(
    { ...fixture.resultInput, definitionId: definition.id },
    {
      definition,
      definitionProjection,
      calculator: fixture.calculator,
      reviewer: fixture.resultReviewer,
      sources: [fixture.source],
    },
  );
  const projection = service.projectResult(
    bundle.result.id,
    definitionProjection,
    [fixture.source],
    esgMetricReviewedAt,
  );

  assert.equal(definitionProjection.state, "current");
  assert.equal(bundle.result.decimalValue, "87.5");
  assert.equal(bundle.result.sourceCount, 1);
  assert.equal(bundle.result.safety.routeMounted, false);
  assert.equal(bundle.result.safety.productionActivationEnabled, false);
  assert.equal(projection.state, "current");
  assert.deepEqual(projection.issueCodes, []);

  const replayed = CanopyProofEsgMetricAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot());
  assert.deepEqual(replayed.getDefinition(definition.id), definition);
  assert.deepEqual(replayed.getResult(bundle.result.id), bundle);
  assert.deepEqual(
    replayed.projectResult(bundle.result.id, definitionProjection, [fixture.source], esgMetricReviewedAt),
    projection,
  );

  const independent = new CanopyProofEsgMetricAuthorityService();
  const independentDefinition = independent.publishDefinition(fixture.definitionInput, {
    organization: fixture.organization,
    publisher: fixture.publisher,
    reviewers: fixture.definitionReviewers,
    methodology: fixture.methodology.bundle,
    methodologyProjection: fixture.methodology.projection,
  });
  const independentProjection = independent.projectDefinition(
    independentDefinition.id,
    fixture.methodology.projection,
    esgMetricReviewedAt,
  );
  const independentResult = independent.recordResult(
    { ...fixture.resultInput, definitionId: independentDefinition.id },
    {
      definition: independentDefinition,
      definitionProjection: independentProjection,
      calculator: fixture.calculator,
      reviewer: fixture.resultReviewer,
      sources: [fixture.source],
    },
  );
  assert.equal(independentDefinition.definitionRoot, definition.definitionRoot);
  assert.equal(independentResult.result.resultRoot, bundle.result.resultRoot);
  assert.equal(independentResult.sources[0]?.memberRoot, bundle.sources[0]?.memberRoot);
});

test("ESG metric exact decimals reject floating ambiguity, false precision, missing-as-zero, and inverted uncertainty", () => {
  assert.equal(canonicalizeCanopyProofMetricDecimal("87.50", 2), "87.5");
  assert.equal(compareCanopyProofMetricDecimals("-1.25", "-1.2"), -1);
  assert.equal(compareCanopyProofMetricDecimals("87.5", "87.50"), 0);
  assert.throws(() => canonicalizeCanopyProofMetricDecimal("1e2", 2), /exact decimal/);
  assert.throws(() => canonicalizeCanopyProofMetricDecimal("-0.0", 2), /negative zero/);
  assert.throws(() => canonicalizeCanopyProofMetricDecimal("1.234", 2), /exceeds definition precision/);

  const fixture = createEsgMetricFixture({ suffix: "decimal" });
  const service = new CanopyProofEsgMetricAuthorityService();
  const definition = publishFixtureDefinition(service, fixture);
  const definitionProjection = service.projectDefinition(definition.id, fixture.methodology.projection, esgMetricReviewedAt);
  const authority = {
    definition,
    definitionProjection,
    calculator: fixture.calculator,
    reviewer: fixture.resultReviewer,
    sources: [fixture.source],
  };
  assert.throws(
    () => service.recordResult(
      { ...fixture.resultInput, definitionId: definition.id, decimalValue: "87.501" },
      authority,
    ),
    /exceeds definition precision/,
  );
  assert.throws(
    () => service.recordResult(
      {
        ...fixture.resultInput,
        definitionId: definition.id,
        valueState: "not_applicable",
        decimalValue: "0",
      },
      authority,
    ),
    /not-applicable metric cannot carry/,
  );
  assert.throws(
    () => service.recordResult(
      {
        ...fixture.resultInput,
        definitionId: definition.id,
        uncertainty: { ...fixture.resultInput.uncertainty, lower: "91", upper: "90" },
      },
      authority,
    ),
    /interval is inverted/,
  );
});

test("ESG metric authority rejects agents, self-review, weak quorum, unit substitution, and unsafe claims", () => {
  const fixture = createEsgMetricFixture({ suffix: "denials" });
  const service = new CanopyProofEsgMetricAuthorityService();
  const agentSeed = {
    ...fixture.publisher,
    id: "cp_metric_agent_denied",
    participantType: "agent" as const,
    role: "agent" as const,
  };
  const agent = {
    ...agentSeed,
    authorityRoot: hashJson({
      kind: "canopyproof-verification-actor-authority-v1",
      ...Object.fromEntries(Object.entries(agentSeed).filter(([key]) => key !== "authorityRoot")),
    }),
  };
  assert.throws(
    () => service.publishDefinition(fixture.definitionInput, {
      organization: fixture.organization,
      publisher: agent,
      reviewers: fixture.definitionReviewers,
      methodology: fixture.methodology.bundle,
      methodologyProjection: fixture.methodology.projection,
    }),
    /lacks esg_metric:govern authority/,
  );
  assert.throws(
    () => service.publishDefinition(fixture.definitionInput, {
      organization: fixture.organization,
      publisher: fixture.publisher,
      reviewers: [fixture.definitionReviewers[0]!, fixture.definitionReviewers[0]!],
      methodology: fixture.methodology.bundle,
      methodologyProjection: fixture.methodology.projection,
    }),
    /two independent accredited human reviewers/,
  );
  assert.throws(
    () => service.publishDefinition(
      { ...fixture.definitionInput, title: "Guaranteed RWA yield metric" },
      {
        organization: fixture.organization,
        publisher: fixture.publisher,
        reviewers: fixture.definitionReviewers,
        methodology: fixture.methodology.bundle,
        methodologyProjection: fixture.methodology.projection,
      },
    ),
    /unsupported claim/,
  );

  const definition = publishFixtureDefinition(service, fixture);
  const definitionProjection = service.projectDefinition(definition.id, fixture.methodology.projection, esgMetricReviewedAt);
  assert.throws(
    () => service.recordResult(
      { ...fixture.resultInput, definitionId: definition.id, unit: "tCO2e" },
      {
        definition,
        definitionProjection,
        calculator: fixture.calculator,
        reviewer: fixture.resultReviewer,
        sources: [fixture.source],
      },
    ),
    /unit is not allowed/,
  );
  const selfReviewer = metricActor(
    fixture.organization,
    fixture.calculator.id,
    "researcher",
    ["esg_metric:calculate", "esg_metric:review"],
  );
  const calculatorWithBothScopes = metricActor(
    fixture.organization,
    fixture.calculator.id,
    "researcher",
    ["esg_metric:calculate", "esg_metric:review"],
  );
  assert.throws(
    () => service.recordResult(
      { ...fixture.resultInput, definitionId: definition.id },
      {
        definition,
        definitionProjection,
        calculator: calculatorWithBothScopes,
        reviewer: selfReviewer,
        sources: [fixture.source],
      },
    ),
    /cannot review the same result/,
  );
});

test("definition supersession and source challenge, revocation, expiry, and staleness propagate into result projections", () => {
  const fixture = createEsgMetricFixture({ suffix: "projection" });
  const service = new CanopyProofEsgMetricAuthorityService();
  const first = publishFixtureDefinition(service, fixture);
  const firstProjection = service.projectDefinition(first.id, fixture.methodology.projection, esgMetricReviewedAt);
  const bundle = service.recordResult(
    { ...fixture.resultInput, definitionId: first.id },
    {
      definition: first,
      definitionProjection: firstProjection,
      calculator: fixture.calculator,
      reviewer: fixture.resultReviewer,
      sources: [fixture.source],
    },
  );
  const second = service.publishDefinition(
    {
      ...fixture.definitionInput,
      version: "v1.1.0",
      supersedesDefinitionId: first.id,
      description:
        "Updated independently governed tree survival percentage definition with the same bounded source requirements.",
      effectiveAt: "2026-07-14T08:10:00.000Z",
    },
    {
      organization: fixture.organization,
      publisher: fixture.publisher,
      reviewers: fixture.definitionReviewers,
      methodology: fixture.methodology.bundle,
      methodologyProjection: fixture.methodology.projection,
    },
  );
  assert.equal(
    service.projectDefinition(first.id, fixture.methodology.projection, "2026-07-14T08:15:00.000Z").state,
    "superseded",
  );
  assert.equal(
    service.projectDefinition(second.id, fixture.methodology.projection, "2026-07-14T08:15:00.000Z").state,
    "current",
  );
  const supersededProjection = service.projectDefinition(first.id, fixture.methodology.projection, "2026-07-14T08:15:00.000Z");
  assert.equal(
    service.projectResult(bundle.result.id, supersededProjection, [fixture.source], esgMetricReviewedAt).state,
    "definition_superseded",
  );

  const challengedSource = withGovernedState(fixture.source, "challenged");
  assert.equal(
    service.projectResult(bundle.result.id, firstProjection, [challengedSource], esgMetricReviewedAt).state,
    "challenged",
  );
  const revokedSource = withGovernedState(fixture.source, "revoked");
  assert.equal(
    service.projectResult(bundle.result.id, firstProjection, [revokedSource], esgMetricReviewedAt).state,
    "revoked",
  );
  const expiredSource = withLifecycleState(fixture.source, "expired");
  assert.equal(
    service.projectResult(bundle.result.id, firstProjection, [expiredSource], esgMetricReviewedAt).state,
    "expired",
  );
  const duplicateProjection = service.projectResult(
    bundle.result.id,
    firstProjection,
    [fixture.source, fixture.source],
    esgMetricReviewedAt,
  );
  assert.equal(duplicateProjection.state, "source_stale");
  assert.ok(duplicateProjection.issueCodes.includes("source_set_contains_duplicates"));
});

test("ESG metric replay rejects definition, actor, uncertainty, result, and source-member tampering", () => {
  const fixture = createEsgMetricFixture({ suffix: "tamper" });
  const service = new CanopyProofEsgMetricAuthorityService();
  const definition = publishFixtureDefinition(service, fixture);
  const definitionProjection = service.projectDefinition(definition.id, fixture.methodology.projection, esgMetricReviewedAt);
  const bundle = service.recordResult(
    { ...fixture.resultInput, definitionId: definition.id },
    {
      definition,
      definitionProjection,
      calculator: fixture.calculator,
      reviewer: fixture.resultReviewer,
      sources: [fixture.source],
    },
  );
  const snapshot = service.getAuthoritySnapshot();
  assert.throws(
    () => CanopyProofEsgMetricAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      definitions: [{ ...definition, reviewerRoot: fixtureHash("forged reviewer root") }],
    }),
    /definition derived lineage is invalid|definition lineage is invalid/,
  );
  assert.throws(
    () => CanopyProofEsgMetricAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      results: [{ ...bundle.result, decimalValue: "99" }],
    }),
    /result (?:interval )?lineage is invalid/,
  );
  assert.throws(
    () => CanopyProofEsgMetricAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      resultSources: [{ ...bundle.sources[0]!, recordRoot: fixtureHash("substituted record") }],
    }),
    /source member lineage is invalid/,
  );
});

function publishFixtureDefinition(
  service: CanopyProofEsgMetricAuthorityService,
  fixture: ReturnType<typeof createEsgMetricFixture>,
) {
  return service.publishDefinition(fixture.definitionInput, {
    organization: fixture.organization,
    publisher: fixture.publisher,
    reviewers: fixture.definitionReviewers,
    methodology: fixture.methodology.bundle,
    methodologyProjection: fixture.methodology.projection,
  });
}

function withGovernedState(
  source: ReturnType<typeof createEsgMetricFixture>["source"],
  state: "challenged" | "revoked",
) {
  const projectionSeed = {
    ...source.governedRecordProjection,
    state,
    challengeState: "open" as const,
    challengeId: `cp_metric_${state}_challenge`,
    challengeRoot: fixtureHash(`${state}:challenge`),
    sourceAuthorityCurrent: true,
  };
  return {
    ...source,
    governedRecordProjection: {
      ...projectionSeed,
      projectionRoot: hashJson({
        kind: "canopyproof-environmental-proof-challenged-record-projection-v1",
        ...Object.fromEntries(Object.entries(projectionSeed).filter(([key]) => key !== "projectionRoot" && key !== "safety")),
      }),
    },
  };
}

function withLifecycleState(
  source: ReturnType<typeof createEsgMetricFixture>["source"],
  state: "expired",
) {
  const projectionSeed = {
    ...source.lifecycleProjection,
    state,
    validityCurrent: false,
    issueCodes: ["validity_expired"],
  };
  return {
    ...source,
    lifecycleProjection: {
      ...projectionSeed,
      projectionRoot: hashJson({
        kind: "canopyproof-environmental-proof-lifecycle-projection-v1",
        ...Object.fromEntries(Object.entries(projectionSeed).filter(([key]) => key !== "projectionRoot" && key !== "safety")),
      }),
    },
  };
}
