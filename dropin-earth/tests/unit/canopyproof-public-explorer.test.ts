import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import { Hono } from "hono";
import {
  CanopyProofPublicTransparencyAuthorityService,
  type CanopyProofPublicTransparencyProjection,
} from "../../services/api/src/domain/canopyproof/public-transparency-authority.js";
import {
  CanopyProofPublicExplorerError,
  assertCanopyProofPublicExplorerResponseIsSanitized,
  canopyProofPublicExplorerProjectEtag,
  serializeCanopyProofPublicExplorerProject,
} from "../../services/api/src/domain/canopyproof/public-explorer.js";
import {
  createCanopyProofPublicExplorerRoutes,
  type CanopyProofPublicExplorerActivationDecision,
  type CanopyProofPublicExplorerRepositoryPort,
} from "../../services/api/src/routes/canopyproof/public-explorer.js";
import { app as mountedApi } from "../../services/api/src/app.js";
import {
  createPublicTransparencyFixture,
  evaluatePublicTransparencySource,
  publicTransparencyPublishedAt,
} from "../helpers/canopyproof-public-transparency-fixture.js";

const evaluatedAt = "2026-07-14T08:20:00.000Z";

function projectionFixture(suffix = "explorer") {
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
  return {
    fixture,
    service,
    publication,
    projection: service.projectPublication(publication.id, fixture.publicationSource),
  };
}

function activeDecision(): CanopyProofPublicExplorerActivationDecision {
  const root = (label: string) => hashJson({ kind: "public-explorer-test-review", label });
  return {
    active: true,
    apiVersion: "canopyproof.public-explorer.v1",
    decisionRoot: root("decision"),
    startsAt: "2026-07-14T00:00:00.000Z",
    expiresAt: "2026-07-15T00:00:00.000Z",
    routes: ["project", "history", "verify"],
    reviewRoots: {
      privacyImpact: root("privacy"),
      communitySafeguarding: root("community"),
      legalClaims: root("legal"),
      security: root("security"),
      accessibility: root("accessibility"),
      rateCacheAbuse: root("rate"),
      incidentRollback: root("incident"),
    },
  };
}

function repositoryFor(
  projection: CanopyProofPublicTransparencyProjection,
  calls: { count: number },
): CanopyProofPublicExplorerRepositoryPort {
  return {
    async getProject() {
      calls.count += 1;
      return projection;
    },
    async getProjectHistory() {
      calls.count += 1;
      return { projections: [projection], nextCursor: null };
    },
    async verifyPublication() {
      calls.count += 1;
      return projection;
    },
  };
}

function activeRouteApp(repository: CanopyProofPublicExplorerRepositoryPort) {
  const routes = createCanopyProofPublicExplorerRoutes({
    repository,
    activationVerifier: { async verify() { return activeDecision(); } },
    rateLimiter: {
      async consume() {
        return {
          allowed: true,
          limit: 60,
          remaining: 59,
          resetAt: "2026-07-14T08:21:00.000Z",
        };
      },
    },
    now: () => new Date(evaluatedAt),
  });
  const app = new Hono();
  app.route("/canopyproof/explorer", routes);
  return app;
}

test("public Explorer serializer exposes only the frozen public allowlist and stable ETag", () => {
  const { fixture, projection } = projectionFixture("serializer");
  const first = serializeCanopyProofPublicExplorerProject(projection);
  const second = serializeCanopyProofPublicExplorerProject(projection);
  const serialized = JSON.stringify(first);

  assert.deepEqual(first, second);
  assert.equal(canopyProofPublicExplorerProjectEtag(first), canopyProofPublicExplorerProjectEtag(second));
  assert.equal(first.safety.canonical, true);
  assert.equal(first.safety.anonymousMutationAllowed, false);
  assert.equal(first.project.publicProjectId, projection.publicProjectId);
  assert.equal(first.lineage.projectionRoot, projection.projectionRoot);
  for (const forbidden of [
    projection.recordId,
    projection.issuerAuthorityRoot,
    fixture.reviewer.id,
    fixture.publisher.id,
    fixture.canonicalSource.signatureReceipt.detachedSignature,
    fixture.canonicalSource.record.evidenceIds[0]!,
  ]) {
    assert.equal(serialized.includes(forbidden), false, `Explorer response leaked ${forbidden}`);
  }
  assert.equal(serialized.includes("organizationId"), false);
  assert.equal(serialized.includes("projectId"), false);
  assert.equal(serialized.includes("recordId"), false);
});

test("public Explorer serializer accepts all canonical adverse states without implying certification", () => {
  const { fixture, service, publication } = projectionFixture("states");
  const states = [
    evaluatePublicTransparencySource(fixture.canonicalSource, {
      evaluatedAt,
      governedRecordState: "challenged",
      challengeState: "open",
      challengeId: "cp_explorer_challenge",
      challengeRoot: hashJson({ kind: "explorer challenge" }),
      lifecycleState: "challenged",
      issueCodes: ["record_challenged"],
    }),
    evaluatePublicTransparencySource(fixture.canonicalSource, {
      evaluatedAt,
      lifecycleState: "suspended",
      currentControlAction: "suspend",
    }),
    evaluatePublicTransparencySource(fixture.canonicalSource, { evaluatedAt, lifecycleState: "revoked" }),
    evaluatePublicTransparencySource(fixture.canonicalSource, {
      evaluatedAt,
      lifecycleState: "expired",
      validityCurrent: false,
    }),
    evaluatePublicTransparencySource(fixture.canonicalSource, {
      evaluatedAt,
      lifecycleState: "superseded",
      currentControlAction: "supersede",
      successorBindingId: "cp_successor_binding",
    }),
    evaluatePublicTransparencySource(fixture.canonicalSource, {
      evaluatedAt,
      governedRecordState: "stale",
      governedSourceAuthorityCurrent: false,
      lifecycleSourceAuthorityCurrent: false,
    }),
  ];
  assert.deepEqual(
    states.map((source) => serializeCanopyProofPublicExplorerProject(
      service.projectPublication(publication.id, source),
    ).project.state),
    ["challenged", "suspended", "revoked", "expired", "superseded", "stale"],
  );
});

test("public Explorer rejects tampered roots, forbidden keys, unsafe claims, and cycles", () => {
  const { projection } = projectionFixture("tamper");
  assert.throws(
    () => serializeCanopyProofPublicExplorerProject({ ...projection, projectionRoot: "0".repeat(64) }),
    /CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID/,
  );
  assert.throws(
    () => assertCanopyProofPublicExplorerResponseIsSanitized({ recordId: "private-record" }),
    /CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID/,
  );
  assert.throws(
    () => assertCanopyProofPublicExplorerResponseIsSanitized({ label: "certified carbon credit" }),
    /CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID/,
  );
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(
    () => assertCanopyProofPublicExplorerResponseIsSanitized(cyclic),
    /CANOPYPROOF_PUBLIC_EXPLORER_SOURCE_INVALID/,
  );
});

test("default Explorer activation verifier denies before repository access", async () => {
  const { projection } = projectionFixture("closed");
  const calls = { count: 0 };
  const routes = createCanopyProofPublicExplorerRoutes({ repository: repositoryFor(projection, calls) });
  const app = new Hono();
  app.route("/canopyproof/explorer", routes);
  const response = await app.request(`/canopyproof/explorer/projects/${projection.publicProjectId}`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    ok: false,
    error: "CANOPYPROOF_PUBLIC_EXPLORER_NOT_ACTIVATED",
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(calls.count, 0);
});

test("active Explorer project, history, and verify routes enforce current ETag and cache policy", async () => {
  const { projection } = projectionFixture("routes");
  const calls = { count: 0 };
  const app = activeRouteApp(repositoryFor(projection, calls));
  const projectUrl = `/canopyproof/explorer/projects/${projection.publicProjectId}`;
  const first = await app.request(projectUrl);
  const etag = first.headers.get("etag");

  assert.equal(first.status, 200);
  assert.ok(etag);
  assert.equal(first.headers.get("cache-control"), "public, max-age=0, s-maxage=15, must-revalidate");
  assert.equal(first.headers.get("ratelimit-limit"), "60");
  assert.equal(first.headers.get("x-content-type-options"), "nosniff");
  const conditional = await app.request(projectUrl, { headers: { "if-none-match": etag! } });
  assert.equal(conditional.status, 304);
  assert.equal(await conditional.text(), "");

  const history = await app.request(`${projectUrl}/history?limit=20`);
  assert.equal(history.status, 200);
  assert.equal((await history.json() as { items: unknown[] }).items.length, 1);
  const verified = await app.request(
    `/canopyproof/explorer/publications/${projection.publicationId}/verify`,
  );
  assert.equal(verified.status, 200);
  assert.equal((await verified.json() as { verified: boolean }).verified, true);
  assert.equal(calls.count, 4, "304 must follow a newly derived current projection");
});

test("adverse Explorer state is never shared-cacheable and durable rate denial records headers", async () => {
  const { fixture, service, publication } = projectionFixture("adverse-route");
  const challenged = service.projectPublication(publication.id, evaluatePublicTransparencySource(
    fixture.canonicalSource,
    {
      evaluatedAt,
      governedRecordState: "challenged",
      challengeState: "open",
      challengeId: "cp_adverse_route_challenge",
      challengeRoot: hashJson({ kind: "route challenge" }),
      lifecycleState: "challenged",
    },
  ));
  const calls = { count: 0 };
  const challengedApp = activeRouteApp(repositoryFor(challenged, calls));
  const challengedResponse = await challengedApp.request(
    `/canopyproof/explorer/projects/${challenged.publicProjectId}`,
  );
  assert.equal(challengedResponse.status, 200);
  assert.equal(challengedResponse.headers.get("cache-control"), "no-store");

  const rateLimitedRoutes = createCanopyProofPublicExplorerRoutes({
    repository: repositoryFor(challenged, calls),
    activationVerifier: { async verify() { return activeDecision(); } },
    rateLimiter: {
      async consume() {
        return {
          allowed: false,
          limit: 10,
          remaining: 0,
          resetAt: "2026-07-14T08:21:00.000Z",
          abuseEventRoot: hashJson({ kind: "durable abuse event" }),
        };
      },
    },
    now: () => new Date(evaluatedAt),
  });
  const rateLimitedApp = new Hono();
  rateLimitedApp.route("/canopyproof/explorer", rateLimitedRoutes);
  const denied = await rateLimitedApp.request(
    `/canopyproof/explorer/projects/${challenged.publicProjectId}`,
  );
  assert.equal(denied.status, 429);
  assert.equal(denied.headers.get("ratelimit-limit"), "10");
  assert.equal(denied.headers.get("cache-control"), "no-store");
});

test("production API does not mount the route-closed canonical Explorer", async () => {
  const { projection } = projectionFixture("unmounted");
  const response = await mountedApi.request(
    `/canopyproof/explorer/projects/${projection.publicProjectId}`,
  );
  assert.equal(response.status, 404);
});

test("Explorer domain errors retain stable non-sensitive error codes", () => {
  const error = new CanopyProofPublicExplorerError("CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND", {
    cause: new Error("private database detail"),
  });
  assert.equal(error.message, "CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND");
  assert.equal(error.code, "CANOPYPROOF_PUBLIC_EXPLORER_NOT_FOUND");
});
