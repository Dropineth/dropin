import assert from "node:assert/strict";
import test from "node:test";
import { hashJson } from "@dropin/crypto";
import {
  CanopyProofMrvGraphAuthorityService,
  canopyProofMrvActorAuthorityRoot,
  canopyProofMrvEndpointHash,
  canopyProofMrvMethodologyRoot,
  type CanopyProofMrvActorSnapshot,
  type CanopyProofMrvEdgeAuthority,
  type CanopyProofMrvEndpointSnapshot,
  type CanopyProofMrvEndpointState,
  type CanopyProofMrvEndpointType,
  type CanopyProofMrvMethodologySnapshot,
  type CanopyProofMrvRelationship,
} from "../../services/api/src/domain/canopyproof/mrv-graph-authority.js";
import { appendCanopyProofAuditEvent } from "../../services/api/src/domain/canopyproof/proof-engine.js";

const organizationId = "cp_mrv_org";
const projectId = "cp_mrv_project";
const fieldWorkerId = "cp_mrv_field_worker";
const reviewAuthorId = "cp_mrv_review_author";
const decisionAuthorId = "cp_mrv_decision_author";
const snapshotReviewerId = "cp_mrv_snapshot_reviewer";
const agentId = "cp_mrv_agent";
const baseTime = "2026-07-14T04:00:00.000Z";

test("Digital MRV graph records a complete reviewed lineage snapshot and replays exactly", () => {
  const fixture = graphFixture();
  const service = new CanopyProofMrvGraphAuthorityService();
  const measurement = recordEdge(service, fixture.evidence, "MEASURES", fixture.project, fixture.fieldWorker, 1);
  const review = recordEdge(service, fixture.review, "REVIEWS", fixture.evidence, fixture.reviewAuthor, 2);
  const decision = recordEdge(service, fixture.decision, "DECIDES", fixture.evidence, fixture.decisionAuthor, 3);
  const support = recordEdge(service, fixture.evidence, "SUPPORTS", fixture.proof, fixture.fieldWorker, 4);

  const result = service.recordSnapshot(
    {
      projectId,
      projectRoot: fixture.project.root,
      methodologyId: fixture.methodology.id,
      methodologyPublicationRoot: fixture.methodology.publicationRoot,
      edgeIds: [support.id, decision.id, measurement.id, review.id],
      conflictDisclosureHash: hashJson({ kind: "mrv-test-no-conflict" }),
      limitationHashes: [hashJson({ kind: "mrv-test-limitation" })],
      reviewedAt: instant(5),
    },
    {
      reviewer: fixture.snapshotReviewer,
      organizationId,
      projectId,
      projectRoot: fixture.project.root,
      methodology: fixture.methodology,
    },
  );

  assert.equal(result.snapshot.state, "reviewed_for_lineage");
  assert.equal(result.snapshot.edgeCount, 4);
  assert.deepEqual(result.snapshot.issueCodes, []);
  assert.deepEqual(result.snapshot.coverage.observedRelationshipCounts, {
    DECIDES: 1,
    MEASURES: 1,
    REVIEWS: 1,
    SUPPORTS: 1,
  });
  assert.deepEqual(
    result.members.map((member) => member.memberIndex),
    [0, 1, 2, 3],
  );
  assert.equal(result.snapshot.safety.notFinalProofAuthority, true);
  assert.equal(result.snapshot.safety.routeMounted, false);
  assert.equal(service.projectGraph(organizationId, projectId).finalProofChanged, false);
  recordEdge(service, fixture.aiAnalysis, "ANALYZES", fixture.evidence, fixture.agent, 6);
  const replayed = CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot(service.getAuthoritySnapshot());
  assert.deepEqual(replayed.getSnapshot(result.snapshot.id), result);
  assert.equal(replayed.listEdges().length, 5);
});

test("Digital MRV graph marks incomplete or challenged lineage review-required", () => {
  const fixture = graphFixture("challenged");
  const service = new CanopyProofMrvGraphAuthorityService();
  const edge = recordEdge(service, fixture.evidence, "MEASURES", fixture.project, fixture.fieldWorker, 1);
  assert.equal(edge.edgeState, "review_required");

  const { snapshot } = service.recordSnapshot(
    {
      projectId,
      projectRoot: fixture.project.root,
      methodologyId: fixture.methodology.id,
      methodologyPublicationRoot: fixture.methodology.publicationRoot,
      edgeIds: [edge.id],
      conflictDisclosureHash: hashJson({ kind: "mrv-test-conflict-reviewed" }),
      limitationHashes: [],
      reviewedAt: instant(2),
    },
    {
      reviewer: fixture.snapshotReviewer,
      organizationId,
      projectId,
      projectRoot: fixture.project.root,
      methodology: fixture.methodology,
    },
  );

  assert.equal(snapshot.state, "review_required");
  assert.deepEqual(snapshot.issueCodes, [
    "edge_review_required",
    "missing_decides",
    "missing_reviews",
    "missing_supports",
  ]);
});

test("Digital MRV graph limits agents to their own advisory analysis facts", () => {
  const fixture = graphFixture();
  const service = new CanopyProofMrvGraphAuthorityService();
  const analysis = recordEdge(service, fixture.aiAnalysis, "ANALYZES", fixture.evidence, fixture.agent, 1);
  assert.equal(analysis.actorMode, "advisory_agent");
  assert.equal(analysis.edgeState, "current");

  assert.throws(
    () => recordEdge(service, fixture.aiAnalysis, "SUPPORTS", fixture.proof, fixture.agent, 2),
    /relationship is not enabled|agent authority is limited/,
  );
  assert.throws(
    () =>
      service.recordSnapshot(
        {
          projectId,
          projectRoot: fixture.project.root,
          methodologyId: fixture.methodology.id,
          methodologyPublicationRoot: fixture.methodology.publicationRoot,
          edgeIds: [analysis.id],
          conflictDisclosureHash: hashJson({ kind: "mrv-test-agent-conflict" }),
          limitationHashes: [],
          reviewedAt: instant(2),
        },
        {
          reviewer: fixture.agent,
          organizationId,
          projectId,
          projectRoot: fixture.project.root,
          methodology: fixture.methodology,
        },
      ),
    /accredited independent human reviewer/,
  );
});

test("Digital MRV graph rejects substituted roots, cross-tenant facts, self edges, and duplicate assertions", () => {
  const fixture = graphFixture();
  const service = new CanopyProofMrvGraphAuthorityService();

  assert.throws(
    () =>
      service.recordEdge(
        edgeInput(fixture.evidence, "MEASURES", fixture.project, 1, {
          sourceRoot: hashJson({ kind: "mrv-substituted-source" }),
        }),
        edgeAuthority(fixture.evidence, fixture.project, fixture.fieldWorker, fixture.methodology),
      ),
    /source endpoint binding is invalid/,
  );

  const foreignProject = endpoint(
    "project_registration",
    "cp_mrv_foreign_project",
    [],
    baseTime,
    "current",
    "cp_mrv_foreign_org",
    "cp_mrv_foreign_project",
  );
  assert.throws(
    () => recordEdge(service, fixture.evidence, "MEASURES", foreignProject, fixture.fieldWorker, 1),
    /tenant or project authority mismatch/,
  );
  assert.throws(
    () => recordEdge(service, fixture.evidence, "MEASURES", fixture.evidence, fixture.fieldWorker, 1),
    /self-edges are prohibited/,
  );

  recordEdge(service, fixture.evidence, "MEASURES", fixture.project, fixture.fieldWorker, 1);
  assert.throws(
    () => recordEdge(service, fixture.evidence, "MEASURES", fixture.project, fixture.fieldWorker, 2),
    /canonical edge already exists/,
  );
});

test("Digital MRV graph requires a complete edge manifest and independent reviewer", () => {
  const fixture = graphFixture();
  const service = new CanopyProofMrvGraphAuthorityService();
  const measurement = recordEdge(service, fixture.evidence, "MEASURES", fixture.project, fixture.fieldWorker, 1);
  recordEdge(service, fixture.review, "REVIEWS", fixture.evidence, fixture.reviewAuthor, 2);

  assert.throws(
    () =>
      service.recordSnapshot(
        {
          projectId,
          projectRoot: fixture.project.root,
          methodologyId: fixture.methodology.id,
          methodologyPublicationRoot: fixture.methodology.publicationRoot,
          edgeIds: [measurement.id, measurement.id],
          conflictDisclosureHash: hashJson({ kind: "mrv-test-duplicate-manifest" }),
          limitationHashes: [],
          reviewedAt: instant(3),
        },
        {
          reviewer: fixture.snapshotReviewer,
          organizationId,
          projectId,
          projectRoot: fixture.project.root,
          methodology: fixture.methodology,
        },
      ),
    /identifier set must be duplicate-free/,
  );

  assert.throws(
    () =>
      service.recordSnapshot(
        {
          projectId,
          projectRoot: fixture.project.root,
          methodologyId: fixture.methodology.id,
          methodologyPublicationRoot: fixture.methodology.publicationRoot,
          edgeIds: [measurement.id],
          conflictDisclosureHash: hashJson({ kind: "mrv-test-incomplete-manifest" }),
          limitationHashes: [],
          reviewedAt: instant(3),
        },
        {
          reviewer: fixture.snapshotReviewer,
          organizationId,
          projectId,
          projectRoot: fixture.project.root,
          methodology: fixture.methodology,
        },
      ),
    /complete current edge set/,
  );

  const authorReviewer = humanActor(fieldWorkerId, "verifier", true);
  assert.throws(
    () =>
      service.recordSnapshot(
        {
          projectId,
          projectRoot: fixture.project.root,
          methodologyId: fixture.methodology.id,
          methodologyPublicationRoot: fixture.methodology.publicationRoot,
          edgeIds: service.listEdges().map((edge) => edge.id),
          conflictDisclosureHash: hashJson({ kind: "mrv-test-author-review" }),
          limitationHashes: [],
          reviewedAt: instant(3),
        },
        {
          reviewer: authorReviewer,
          organizationId,
          projectId,
          projectRoot: fixture.project.root,
          methodology: fixture.methodology,
        },
      ),
    /independent from every included edge author/,
  );
});

test("Digital MRV replay rejects a valid audit chain carrying a substituted semantic payload", () => {
  const fixture = graphFixture();
  const service = new CanopyProofMrvGraphAuthorityService();
  const fact = recordEdge(service, fixture.evidence, "MEASURES", fixture.project, fixture.fieldWorker, 1);
  const forgedEvent = appendCanopyProofAuditEvent([], {
    action: fact.auditEvent.action,
    actor: fact.auditEvent.actor,
    entityType: fact.auditEvent.entityType,
    entityId: fact.auditEvent.entityId,
    payload: { forged: true },
    createdAt: fact.auditEvent.createdAt,
    rationale: fact.auditEvent.rationale,
  }).at(-1)!;

  assert.throws(
    () =>
      CanopyProofMrvGraphAuthorityService.fromAuthoritySnapshot({
        streamEvents: [forgedEvent],
        edges: [{ ...fact, auditEvent: forgedEvent }],
        snapshots: [],
        snapshotMembers: [],
      }),
    /semantic event is invalid/,
  );
});

function graphFixture(evidenceState: CanopyProofMrvEndpointState = "current") {
  const project = endpoint("project_registration", projectId, [], baseTime);
  const evidence = endpoint("evidence_object", "cp_mrv_evidence", [fieldWorkerId], baseTime, evidenceState);
  const review = endpoint("human_review", "cp_mrv_review", [reviewAuthorId], baseTime);
  const decision = endpoint("verification_decision", "cp_mrv_decision", [decisionAuthorId], baseTime);
  const aiAnalysis = endpoint("ai_analysis_advisory", "cp_mrv_ai_analysis", [agentId], baseTime);
  const proof = endpoint("environmental_proof_record", "cp_mrv_proof", [decisionAuthorId], baseTime);
  return {
    project,
    evidence,
    review,
    decision,
    aiAnalysis,
    proof,
    methodology: methodology(),
    fieldWorker: humanActor(fieldWorkerId, "owner"),
    reviewAuthor: humanActor(reviewAuthorId, "verifier", true),
    decisionAuthor: humanActor(decisionAuthorId, "verifier", true),
    snapshotReviewer: humanActor(snapshotReviewerId, "researcher", true),
    agent: advisoryAgent(),
  };
}

function recordEdge(
  service: CanopyProofMrvGraphAuthorityService,
  source: CanopyProofMrvEndpointSnapshot,
  relationship: CanopyProofMrvRelationship,
  target: CanopyProofMrvEndpointSnapshot,
  actor: CanopyProofMrvActorSnapshot,
  offsetMinutes: number,
) {
  const authority = edgeAuthority(source, target, actor, methodology());
  return service.recordEdge(edgeInput(source, relationship, target, offsetMinutes), authority);
}

function edgeInput(
  source: CanopyProofMrvEndpointSnapshot,
  relationship: CanopyProofMrvRelationship,
  target: CanopyProofMrvEndpointSnapshot,
  offsetMinutes: number,
  override: Readonly<{ sourceRoot?: string }> = {},
) {
  return {
    source: {
      type: source.type,
      id: source.id,
      root: override.sourceRoot ?? source.root,
      eventRoot: source.eventRoot,
    },
    relationship,
    target: { type: target.type, id: target.id, root: target.root, eventRoot: target.eventRoot },
    reasonHash: hashJson({ kind: "mrv-test-reason", relationship, offsetMinutes }),
    limitationHashes: [],
    createdAt: instant(offsetMinutes),
  };
}

function edgeAuthority(
  source: CanopyProofMrvEndpointSnapshot,
  target: CanopyProofMrvEndpointSnapshot,
  actor: CanopyProofMrvActorSnapshot,
  methodologySnapshot: CanopyProofMrvMethodologySnapshot,
): CanopyProofMrvEdgeAuthority {
  return { source, target, actor, methodology: methodologySnapshot };
}

function endpoint(
  type: CanopyProofMrvEndpointType,
  id: string,
  actorIds: readonly string[],
  occurredAt: string,
  state: CanopyProofMrvEndpointState = "current",
  endpointOrganizationId = organizationId,
  endpointProjectId = projectId,
): CanopyProofMrvEndpointSnapshot {
  const seed = {
    type,
    id,
    root: hashJson({ kind: "mrv-test-endpoint-root", type, id, state }),
    eventRoot: hashJson({ kind: "mrv-test-endpoint-event", type, id, state }),
    organizationId: endpointOrganizationId,
    projectId: endpointProjectId,
    occurredAt,
    state,
    actorIds: [...actorIds].sort(),
  };
  return { ...seed, endpointHash: canopyProofMrvEndpointHash(seed) };
}

function methodology(): CanopyProofMrvMethodologySnapshot {
  const seed = {
    id: "cp_mrv_methodology",
    version: "v1.0.0",
    methodologyHash: hashJson({ kind: "mrv-test-methodology-content" }),
    publicationId: "cp_mrv_methodology_publication",
    publicationRoot: hashJson({ kind: "mrv-test-methodology-publication" }),
    publishedAt: "2026-07-14T03:00:00.000Z",
    status: "published" as const,
  };
  return { ...seed, methodologyRoot: canopyProofMrvMethodologyRoot(seed) };
}

function humanActor(
  id: string,
  role: "owner" | "admin" | "verifier" | "researcher" | "community",
  accredited = false,
): CanopyProofMrvActorSnapshot {
  const seed = {
    id,
    participantType: "human" as const,
    role,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "mrv-test-participant", id }),
    organizationRoot: hashJson({ kind: "mrv-test-organization", organizationId }),
    membershipId: `cp_mrv_membership_${id}`,
    membershipStatus: "active" as const,
    membershipRoot: hashJson({ kind: "mrv-test-membership", id }),
    ...(accredited
      ? {
          accreditationId: `cp_mrv_accreditation_${id}`,
          accreditationStatus: "approved" as const,
          accreditationRoot: hashJson({ kind: "mrv-test-accreditation", id }),
          accreditationScope: ["mrv_graph_review"],
        }
      : { accreditationScope: [] }),
  };
  return { ...seed, authorityRoot: canopyProofMrvActorAuthorityRoot(seed) };
}

function advisoryAgent(): CanopyProofMrvActorSnapshot {
  const seed = {
    id: agentId,
    participantType: "agent" as const,
    role: "agent" as const,
    verificationStatus: "verified" as const,
    organizationId,
    organizationVerificationStatus: "verified" as const,
    participantRoot: hashJson({ kind: "mrv-test-agent", agentId }),
    organizationRoot: hashJson({ kind: "mrv-test-organization", organizationId }),
    accreditationScope: [],
  };
  return { ...seed, authorityRoot: canopyProofMrvActorAuthorityRoot(seed) };
}

function instant(offsetMinutes: number) {
  return new Date(Date.parse(baseTime) + offsetMinutes * 60_000).toISOString();
}
