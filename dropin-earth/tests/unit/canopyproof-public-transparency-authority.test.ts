import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofPublicTransparencyAuthorityService,
  canopyProofPublicTransparencySafetyBoundary,
  verifyCanopyProofPublicTransparencyProjection,
} from "../../services/api/src/domain/canopyproof/public-transparency-authority.js";
import {
  createPublicTransparencyFixture,
  evaluatePublicTransparencySource,
  publicTransparencyPublishedAt,
} from "../helpers/canopyproof-public-transparency-fixture.js";
import { metricActor } from "../helpers/canopyproof-esg-metric-fixture.js";

function publishFixture(suffix = "001") {
  const fixture = createPublicTransparencyFixture({ suffix });
  const service = new CanopyProofPublicTransparencyAuthorityService();
  const review = service.reviewDisclosure(fixture.reviewInput, {
    reviewer: fixture.reviewer,
    source: fixture.reviewSource,
  });
  const publication = service.publish(
    {
      reviewId: review.id,
      expectedReviewRoot: review.reviewRoot,
      expectedLifecycleProjectionRoot: fixture.publicationSource.lifecycleProjection.projectionRoot,
      publishedAt: publicTransparencyPublishedAt,
    },
    { publisher: fixture.publisher, source: fixture.publicationSource },
  );
  return { fixture, service, review, publication };
}

test("canonical public transparency review, publication, projection, and snapshot replay are deterministic", () => {
  const first = publishFixture("deterministic");
  const projection = first.service.projectPublication(first.publication.id, first.fixture.publicationSource);
  const replayed = CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot(
    first.service.getAuthoritySnapshot(),
  );
  const second = publishFixture("deterministic");

  assert.equal(projection.state, "active");
  assert.equal(verifyCanopyProofPublicTransparencyProjection(projection), true);
  assert.deepEqual(replayed.getReview(first.review.id), first.review);
  assert.deepEqual(replayed.getPublication(first.publication.id), first.publication);
  assert.equal(first.review.reviewRoot, second.review.reviewRoot);
  assert.equal(first.publication.publicationRoot, second.publication.publicationRoot);
  assert.equal(projection.projectionRoot, second.service.projectPublication(
    second.publication.id,
    second.fixture.publicationSource,
  ).projectionRoot);
});

test("public projection excludes coordinates, identities, raw evidence, rationale, and signature bytes", () => {
  const { fixture, service, publication } = publishFixture("privacy");
  const projection = service.projectPublication(publication.id, fixture.publicationSource);
  const serialized = JSON.stringify(projection);

  assert.equal(projection.location.disclosure, "region");
  assert.equal(projection.location.regionId, fixture.canonicalSource.record.publicLocation.regionId);
  assert.equal(projection.areaBand, "10_to_100_ha");
  for (const forbidden of [
    "latitude",
    "longitude",
    "coordinates",
    "geometry",
    fixture.reviewer.id,
    fixture.publisher.id,
    fixture.canonicalSource.record.contributorIds[0]!,
    fixture.canonicalSource.record.evidenceIds[0]!,
    fixture.canonicalSource.signatureReceipt.detachedSignature,
    fixture.canonicalSource.signatureReceipt.externalVerifierId,
    fixture.canonicalSource.record.rationale,
  ]) {
    assert.equal(serialized.includes(forbidden), false, `public projection leaked ${forbidden}`);
  }
});

test("sensitive and restricted reviews fail closed for location and area disclosure", () => {
  const sensitive = createPublicTransparencyFixture({ suffix: "sensitive" });
  const service = new CanopyProofPublicTransparencyAuthorityService();
  assert.throws(
    () => service.reviewDisclosure({
      ...sensitive.reviewInput,
      classification: "sensitive",
      locationDisclosure: "region",
    }, { reviewer: sensitive.reviewer, source: sensitive.reviewSource }),
    /cannot expose a region identifier/,
  );
  assert.throws(
    () => service.reviewDisclosure({
      ...sensitive.reviewInput,
      classification: "restricted",
      locationDisclosure: "withheld",
      areaDisclosure: "band",
    }, { reviewer: sensitive.reviewer, source: sensitive.reviewSource }),
    /cannot expose an area band/,
  );

  const review = service.reviewDisclosure({
    ...sensitive.reviewInput,
    classification: "restricted",
    locationDisclosure: "withheld",
    areaDisclosure: "withheld",
  }, { reviewer: sensitive.reviewer, source: sensitive.reviewSource });
  const publication = service.publish({
    reviewId: review.id,
    expectedReviewRoot: review.reviewRoot,
    expectedLifecycleProjectionRoot: sensitive.publicationSource.lifecycleProjection.projectionRoot,
    publishedAt: publicTransparencyPublishedAt,
  }, { publisher: sensitive.publisher, source: sensitive.publicationSource });
  const projection = service.projectPublication(publication.id, sensitive.publicationSource);
  assert.deepEqual(projection.location, {
    disclosure: "withheld",
    sourceRegionIdHash: publication.location.sourceRegionIdHash,
  });
  assert.equal(projection.areaBand, "withheld");
});

test("agents, weak authority, self-approval, contributor review, and cross-tenant actors are rejected", () => {
  const fixture = createPublicTransparencyFixture({ suffix: "authority" });
  const service = new CanopyProofPublicTransparencyAuthorityService();
  const agent = {
    ...fixture.reviewer,
    participantType: "agent" as const,
    role: "agent" as const,
  };
  const agentAuthority = {
    ...agent,
    authorityRoot: hashJson({
      kind: "canopyproof-verification-actor-authority-v1",
      ...Object.fromEntries(Object.entries(agent).filter(([key]) => key !== "authorityRoot")),
    }),
  };
  assert.throws(
    () => service.reviewDisclosure(fixture.reviewInput, {
      reviewer: agentAuthority,
      source: fixture.reviewSource,
    }),
    /eligible accredited human/,
  );
  assert.throws(
    () => service.reviewDisclosure(fixture.reviewInput, {
      reviewer: { ...fixture.reviewer, accreditationStatus: "suspended" },
      source: fixture.reviewSource,
    }),
    /authority root is invalid|eligible accredited human/,
  );
  assert.throws(
    () => service.reviewDisclosure(fixture.reviewInput, {
      reviewer: fixture.canonicalSource.record.issuer,
      source: fixture.reviewSource,
    }),
    /eligible accredited human|independent from issuer/,
  );
  const otherOrganization = { ...fixture.organization, id: "cp_other_public_org" };
  const crossTenant = metricActor(
    otherOrganization,
    "cp_cross_tenant_privacy_reviewer",
    "verifier",
    ["public_transparency:privacy_review"],
  );
  assert.throws(
    () => service.reviewDisclosure(fixture.reviewInput, {
      reviewer: crossTenant,
      source: fixture.reviewSource,
    }),
    /eligible accredited human/,
  );

  const review = service.reviewDisclosure(fixture.reviewInput, {
    reviewer: fixture.reviewer,
    source: fixture.reviewSource,
  });
  const selfPublisher = metricActor(
    fixture.organization,
    fixture.reviewer.id,
    "admin",
    ["public_transparency:publish"],
  );
  assert.throws(
    () => service.publish({
      reviewId: review.id,
      expectedReviewRoot: review.reviewRoot,
      expectedLifecycleProjectionRoot: fixture.publicationSource.lifecycleProjection.projectionRoot,
      publishedAt: publicTransparencyPublishedAt,
    }, { publisher: selfPublisher, source: fixture.publicationSource }),
    /cannot approve its own privacy review/,
  );
});

test("a current high-risk challenge is visible and deterministically blocks active public state", () => {
  const { fixture, service, publication } = publishFixture("challenge");
  const challengeRoot = hashJson({ kind: "public transparency test challenge" });
  const challenged = evaluatePublicTransparencySource(fixture.canonicalSource, {
    evaluatedAt: "2026-07-15T08:20:00.000Z",
    governedRecordState: "challenged",
    challengeState: "open",
    challengeId: "cp_public_challenge_001",
    challengeRoot,
    lifecycleState: "challenged",
    issueCodes: ["record_challenged"],
  });
  const projection = service.projectPublication(publication.id, challenged);

  assert.equal(projection.state, "challenged");
  assert.deepEqual(projection.challenge, { state: "open", root: challengeRoot });
  assert.deepEqual(projection.issueCodes, ["record_challenged"]);
  assert.equal(verifyCanopyProofPublicTransparencyProjection(projection), true);
});

test("revocation, expiry, suspension, supersession, and stale authority propagate without rewriting publication", () => {
  const { fixture, service, publication } = publishFixture("states");
  const cases = [
    { expected: "revoked", options: { lifecycleState: "revoked" as const } },
    { expected: "expired", options: { lifecycleState: "expired" as const, validityCurrent: false } },
    {
      expected: "suspended",
      options: { lifecycleState: "suspended" as const, currentControlAction: "suspend" as const },
    },
    {
      expected: "superseded",
      options: {
        lifecycleState: "superseded" as const,
        currentControlAction: "supersede" as const,
        successorBindingId: "cp_successor_binding_001",
      },
    },
    {
      expected: "stale",
      options: {
        governedRecordState: "stale" as const,
        governedSourceAuthorityCurrent: false,
        lifecycleSourceAuthorityCurrent: false,
      },
    },
  ] as const;
  for (const entry of cases) {
    const source = evaluatePublicTransparencySource(fixture.canonicalSource, {
      evaluatedAt: "2026-07-16T08:20:00.000Z",
      ...entry.options,
    });
    const projection = service.projectPublication(publication.id, source);
    assert.equal(projection.state, entry.expected);
    assert.equal(projection.publicationRoot, publication.publicationRoot);
    assert.equal(verifyCanopyProofPublicTransparencyProjection(projection), true);
  }
});

test("snapshot and projection tampering are rejected", () => {
  const { fixture, service, review, publication } = publishFixture("tamper");
  const snapshot = service.getAuthoritySnapshot();
  const projection = service.projectPublication(publication.id, fixture.publicationSource);

  assert.throws(
    () => CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      reviews: [{ ...review, reviewRoot: hashJson({ forged: "review" }) }],
    }),
    /snapshot lineage is invalid/,
  );
  assert.throws(
    () => CanopyProofPublicTransparencyAuthorityService.fromAuthoritySnapshot({
      ...snapshot,
      publications: [{
        ...publication,
        location: { ...publication.location, regionId: "forged_region" },
      }],
    }),
    /publication snapshot lineage is invalid/,
  );
  assert.equal(verifyCanopyProofPublicTransparencyProjection({
    ...projection,
    evidence: { ...projection.evidence, count: projection.evidence.count + 1 },
  }), false);
  assert.equal(verifyCanopyProofPublicTransparencyProjection({
    ...projection,
    safety: { ...projection.safety, routeMounted: true } as never,
  }), false);
});

test("public transparency safety remains route-closed and non-financial", () => {
  assert.deepEqual(canopyProofPublicTransparencySafetyBoundary(), {
    currentCanonicalRecordRequired: true,
    activeSignedLifecycleAtPublicationRequired: true,
    independentHumanPrivacyReviewRequired: true,
    accreditedHumanPublisherRequired: true,
    preciseLocationForbidden: true,
    rawEvidenceForbidden: true,
    personalDataForbidden: true,
    challengeVisibilityRequired: true,
    appendOnly: true,
    exactRetryRequired: true,
    tenantBound: true,
    routeMounted: false,
    productionActivationEnabled: false,
    publicRelianceAuthorized: false,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
  });
});
