import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  verifyCanopyProofAuditChain,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofMrvEndpointTypes = [
  "project_registration",
  "project_monitoring_event",
  "evidence_object",
  "evidence_validation",
  "ai_analysis_advisory",
  "human_review",
  "verification_decision",
  "community_attestation",
  "environmental_proof_record",
] as const;

export const canopyProofMrvRelationships = [
  "MEASURES",
  "CORROBORATES",
  "CONTRADICTS",
  "ANALYZES",
  "REVIEWS",
  "DECIDES",
  "SUPPORTS",
] as const;

export const canopyProofMrvEndpointStates = [
  "current",
  "review_required",
  "challenged",
  "revoked",
  "stale",
] as const;

export type CanopyProofMrvEndpointType = (typeof canopyProofMrvEndpointTypes)[number];
export type CanopyProofMrvRelationship = (typeof canopyProofMrvRelationships)[number];
export type CanopyProofMrvEndpointState = (typeof canopyProofMrvEndpointStates)[number];
export type CanopyProofMrvEdgeState = "current" | "review_required";
export type CanopyProofMrvSnapshotState = "reviewed_for_lineage" | "review_required";

export type CanopyProofMrvGraphSafetyBoundary = {
  readonly lineageIndexOnly: true;
  readonly sourceDomainsAuthoritative: true;
  readonly appendOnly: true;
  readonly organizationBound: true;
  readonly projectBound: true;
  readonly exactEndpointRootsRequired: true;
  readonly closedRelationshipMatrix: true;
  readonly semanticEventBound: true;
  readonly exactRetryRequired: true;
  readonly humanSnapshotReviewRequired: true;
  readonly aiAdvisoryOnly: true;
  readonly rawEvidenceExcluded: true;
  readonly preciseLocationExcluded: true;
  readonly rawContactDataExcluded: true;
  readonly credentialsAndSecretsExcluded: true;
  readonly notFinalProofAuthority: true;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
  readonly routeMounted: false;
};

export type CanopyProofMrvEndpointSnapshot = {
  readonly type: CanopyProofMrvEndpointType;
  readonly id: string;
  readonly root: string;
  readonly eventRoot: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly occurredAt: string;
  readonly state: CanopyProofMrvEndpointState;
  readonly actorIds: readonly string[];
  readonly endpointHash: string;
};

export type CanopyProofMrvMethodologySnapshot = {
  readonly id: string;
  readonly version: string;
  readonly methodologyHash: string;
  readonly publicationId: string;
  readonly publicationRoot: string;
  readonly publishedAt: string;
  readonly status: "published";
  readonly methodologyRoot: string;
};

export type CanopyProofMrvActorSnapshot = {
  readonly id: string;
  readonly participantType: "human" | "agent";
  readonly role: "agent" | "owner" | "admin" | "verifier" | "researcher" | "community";
  readonly verificationStatus: "verified";
  readonly organizationId: string;
  readonly organizationVerificationStatus: "verified";
  readonly participantRoot: string;
  readonly organizationRoot: string;
  readonly membershipId?: string;
  readonly membershipStatus?: "active";
  readonly membershipRoot?: string;
  readonly accreditationId?: string;
  readonly accreditationStatus?: "approved";
  readonly accreditationRoot?: string;
  readonly accreditationScope: readonly string[];
  readonly authorityRoot: string;
};

export type CanopyProofMrvGraphEdgeFact = {
  readonly factType: "mrv_graph_edge";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly source: CanopyProofMrvEndpointSnapshot;
  readonly relationship: CanopyProofMrvRelationship;
  readonly target: CanopyProofMrvEndpointSnapshot;
  readonly methodology: CanopyProofMrvMethodologySnapshot;
  readonly actor: CanopyProofMrvActorSnapshot;
  readonly actorMode: "human" | "advisory_agent";
  readonly reasonHash: string;
  readonly limitationHashes: readonly string[];
  readonly edgeState: CanopyProofMrvEdgeState;
  readonly commandHash: string;
  readonly projectSequence: number;
  readonly previousEventRoot: string;
  readonly createdAt: string;
  readonly edgeHash: string;
  readonly edgeRoot: string;
  readonly safety: CanopyProofMrvGraphSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofMrvGraphSnapshotMemberFact = {
  readonly factType: "mrv_graph_snapshot_member";
  readonly id: string;
  readonly snapshotId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly memberIndex: number;
  readonly edgeId: string;
  readonly edgeRoot: string;
  readonly memberHash: string;
  readonly memberRoot: string;
  readonly safety: CanopyProofMrvGraphSafetyBoundary;
};

export type CanopyProofMrvCoverage = {
  readonly requiredRelationships: readonly CanopyProofMrvRelationship[];
  readonly observedRelationshipCounts: Readonly<Partial<Record<CanopyProofMrvRelationship, number>>>;
  readonly coverageRoot: string;
};

export type CanopyProofMrvGraphSnapshotFact = {
  readonly factType: "mrv_graph_snapshot";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly projectRoot: string;
  readonly methodology: CanopyProofMrvMethodologySnapshot;
  readonly edgeIds: readonly string[];
  readonly edgeRoots: readonly string[];
  readonly edgeSetRoot: string;
  readonly edgeCount: number;
  readonly coverage: CanopyProofMrvCoverage;
  readonly state: CanopyProofMrvSnapshotState;
  readonly issueCodes: readonly string[];
  readonly reviewer: CanopyProofMrvActorSnapshot;
  readonly conflictDisclosureHash: string;
  readonly limitationHashes: readonly string[];
  readonly snapshotSequence: number;
  readonly previousSnapshotRoot: string;
  readonly commandHash: string;
  readonly projectSequence: number;
  readonly previousEventRoot: string;
  readonly reviewedAt: string;
  readonly snapshotHash: string;
  readonly snapshotRoot: string;
  readonly safety: CanopyProofMrvGraphSafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofMrvGraphAuthoritySnapshot = {
  readonly streamEvents: readonly CanopyProofAuditEvent[];
  readonly edges: readonly CanopyProofMrvGraphEdgeFact[];
  readonly snapshots: readonly CanopyProofMrvGraphSnapshotFact[];
  readonly snapshotMembers: readonly CanopyProofMrvGraphSnapshotMemberFact[];
};

export type CanopyProofMrvGraphProjection = {
  readonly organizationId: string;
  readonly projectId: string;
  readonly state: "empty" | CanopyProofMrvSnapshotState;
  readonly latestSnapshotId?: string;
  readonly latestSnapshotRoot?: string;
  readonly graphRoot: string;
  readonly finalProofChanged: false;
  readonly safety: CanopyProofMrvGraphSafetyBoundary;
};

export type CanopyProofMrvEdgeAuthority = {
  readonly actor: CanopyProofMrvActorSnapshot;
  readonly source: CanopyProofMrvEndpointSnapshot;
  readonly target: CanopyProofMrvEndpointSnapshot;
  readonly methodology: CanopyProofMrvMethodologySnapshot;
};

export type CanopyProofMrvSnapshotAuthority = {
  readonly reviewer: CanopyProofMrvActorSnapshot;
  readonly organizationId: string;
  readonly projectId: string;
  readonly projectRoot: string;
  readonly methodology: CanopyProofMrvMethodologySnapshot;
};

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,239}$/);
const hashSchema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);
const reasonCodeSchema = z.string().regex(/^[a-z0-9][a-z0-9_:-]{0,119}$/);
const endpointBindingSchema = z
  .object({
    type: z.enum(canopyProofMrvEndpointTypes),
    id: identifierSchema,
    root: hashSchema,
    eventRoot: hashSchema,
  })
  .strict();
const edgeInputSchema = z
  .object({
    source: endpointBindingSchema,
    relationship: z.enum(canopyProofMrvRelationships),
    target: endpointBindingSchema,
    reasonHash: hashSchema,
    limitationHashes: z.array(hashSchema).max(32).default([]),
    createdAt: z.string().datetime(),
  })
  .strict();
const snapshotInputSchema = z
  .object({
    projectId: identifierSchema,
    projectRoot: hashSchema,
    methodologyId: identifierSchema,
    methodologyPublicationRoot: hashSchema,
    edgeIds: z.array(identifierSchema).min(1).max(512),
    conflictDisclosureHash: hashSchema,
    limitationHashes: z.array(hashSchema).max(32).default([]),
    reviewedAt: z.string().datetime(),
  })
  .strict();

const requiredSnapshotRelationships = ["MEASURES", "REVIEWS", "DECIDES", "SUPPORTS"] as const;

const relationshipMatrix = new Set<string>([
  matrixKey("evidence_object", "MEASURES", "project_registration"),
  matrixKey("project_monitoring_event", "MEASURES", "project_registration"),
  matrixKey("community_attestation", "CORROBORATES", "evidence_object"),
  matrixKey("community_attestation", "CONTRADICTS", "evidence_object"),
  matrixKey("evidence_validation", "ANALYZES", "evidence_object"),
  matrixKey("ai_analysis_advisory", "ANALYZES", "evidence_object"),
  matrixKey("human_review", "REVIEWS", "evidence_object"),
  matrixKey("verification_decision", "DECIDES", "evidence_object"),
  matrixKey("evidence_object", "SUPPORTS", "environmental_proof_record"),
  matrixKey("verification_decision", "SUPPORTS", "environmental_proof_record"),
  matrixKey("project_monitoring_event", "SUPPORTS", "environmental_proof_record"),
]);

const edgeRationale = "A bounded MRV lineage edge was appended without changing source-domain authority.";
const snapshotRationale =
  "An independent human reviewed an immutable MRV edge manifest for lineage only, without issuing proof.";

export class CanopyProofMrvGraphAuthorityService {
  private readonly edgesById = new Map<string, CanopyProofMrvGraphEdgeFact>();
  private readonly edgeIdByCanonicalTuple = new Map<string, string>();
  private readonly snapshotsById = new Map<string, CanopyProofMrvGraphSnapshotFact>();
  private readonly membersBySnapshotId = new Map<string, CanopyProofMrvGraphSnapshotMemberFact[]>();
  private streamEvents: CanopyProofAuditEvent[];

  constructor(streamEvents: readonly CanopyProofAuditEvent[] = []) {
    this.streamEvents = validateEventStream(streamEvents);
  }

  static fromAuthoritySnapshot(snapshot: CanopyProofMrvGraphAuthoritySnapshot) {
    const service = new CanopyProofMrvGraphAuthorityService(snapshot.streamEvents);
    const membersBySnapshot = new Map<string, CanopyProofMrvGraphSnapshotMemberFact[]>();
    for (const member of snapshot.snapshotMembers) {
      membersBySnapshot.set(member.snapshotId, [...(membersBySnapshot.get(member.snapshotId) ?? []), member]);
    }
    const facts = [
      ...snapshot.edges.map((fact) => ({ kind: "edge" as const, fact })),
      ...snapshot.snapshots.map((fact) => ({ kind: "snapshot" as const, fact })),
    ].sort((left, right) => compareProjectFacts(left.fact, right.fact));
    for (const entry of facts) {
      if (entry.kind === "edge") {
        service.replayEdge(entry.fact);
      } else {
        service.replaySnapshot(entry.fact, membersBySnapshot.get(entry.fact.id) ?? []);
        membersBySnapshot.delete(entry.fact.id);
      }
    }
    if (membersBySnapshot.size > 0) throw new Error("CanopyProof MRV snapshot contains orphan members.");
    if (snapshot.streamEvents.length !== facts.length) {
      throw new Error("CanopyProof MRV semantic event stream contains orphan events.");
    }
    return service;
  }

  recordEdge(input: unknown, authority: CanopyProofMrvEdgeAuthority): CanopyProofMrvGraphEdgeFact {
    const parsed = edgeInputSchema.parse(input);
    assertCanonicalTimestamp(parsed.createdAt, "edge createdAt");
    const actor = normalizeActor(authority.actor);
    const source = normalizeEndpoint(authority.source);
    const target = normalizeEndpoint(authority.target);
    const methodology = normalizeMethodology(authority.methodology);
    assertEndpointBinding(parsed.source, source, "source");
    assertEndpointBinding(parsed.target, target, "target");
    assertEdgeAuthority(parsed.relationship, parsed.createdAt, actor, source, target, methodology);
    const limitationHashes = canonicalHashes(parsed.limitationHashes);
    const reasonHash = normalizeHash(parsed.reasonHash);
    const tuple = edgeTuple(source, parsed.relationship, target, methodology);
    if (this.edgeIdByCanonicalTuple.has(tuple)) {
      throw new Error("CanopyProof MRV canonical edge already exists.");
    }
    const edgeState: CanopyProofMrvEdgeState =
      source.state === "current" && target.state === "current" && parsed.relationship !== "CONTRADICTS"
        ? "current"
        : "review_required";
    const commandSeed = {
      organizationId: source.organizationId,
      projectId: source.projectId,
      source,
      relationship: parsed.relationship,
      target,
      methodology,
      actor,
      actorMode: actor.participantType === "agent" ? ("advisory_agent" as const) : ("human" as const),
      reasonHash,
      limitationHashes,
      edgeState,
      createdAt: parsed.createdAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-mrv-graph-edge-command-v1", ...commandSeed });
    const id = `cp_mrv_edge_${commandHash.slice(0, 24)}`;
    const lineage = this.nextLineage();
    const seed = { id, ...commandSeed, commandHash, ...lineage };
    const edgeHash = hashJson({ kind: "canopyproof-mrv-graph-edge-v1", ...seed });
    const edgeRoot = canopyProofMrvEdgeRoot({ ...seed, edgeHash });
    const safety = canopyProofMrvGraphSafetyBoundary();
    const payload = { factType: "mrv_graph_edge" as const, ...seed, edgeHash, edgeRoot, safety };
    const auditEvent = this.appendEvent({
      action: relationshipAction(parsed.relationship),
      actor: actor.id,
      entityType: "mrv_graph_edge",
      entityId: id,
      payload,
      createdAt: parsed.createdAt,
      rationale: edgeRationale,
    });
    const fact: CanopyProofMrvGraphEdgeFact = { ...payload, auditEvent };
    this.storeEdge(fact);
    return fact;
  }

  recordSnapshot(
    input: unknown,
    authority: CanopyProofMrvSnapshotAuthority,
  ): { readonly snapshot: CanopyProofMrvGraphSnapshotFact; readonly members: readonly CanopyProofMrvGraphSnapshotMemberFact[] } {
    const parsed = snapshotInputSchema.parse(input);
    assertCanonicalTimestamp(parsed.reviewedAt, "snapshot reviewedAt");
    const reviewer = normalizeActor(authority.reviewer);
    const methodology = normalizeMethodology(authority.methodology);
    const organizationId = identifierSchema.parse(authority.organizationId);
    const projectId = identifierSchema.parse(authority.projectId);
    const projectRoot = normalizeHash(authority.projectRoot);
    if (
      parsed.projectId !== projectId ||
      normalizeHash(parsed.projectRoot) !== projectRoot ||
      parsed.methodologyId !== methodology.id ||
      normalizeHash(parsed.methodologyPublicationRoot) !== methodology.publicationRoot
    ) {
      throw new Error("CanopyProof MRV snapshot authority binding is invalid.");
    }
    assertSnapshotReviewer(reviewer, organizationId);
    const edgeIds = canonicalIdentifiers(parsed.edgeIds);
    const eligibleEdges = this.listEdges({ organizationId, projectId, methodologyPublicationRoot: methodology.publicationRoot });
    if (hashJson(edgeIds) !== hashJson(eligibleEdges.map((edge) => edge.id).sort())) {
      throw new Error("CanopyProof MRV snapshot must bind the complete current edge set.");
    }
    if (eligibleEdges.some((edge) => edge.actor.id === reviewer.id)) {
      throw new Error("CanopyProof MRV snapshot reviewer must be independent from every included edge author.");
    }
    if (eligibleEdges.some((edge) => Date.parse(edge.createdAt) > Date.parse(parsed.reviewedAt))) {
      throw new Error("CanopyProof MRV snapshot cannot predate an included edge.");
    }
    const orderedEdges = [...eligibleEdges].sort((left, right) => left.edgeRoot.localeCompare(right.edgeRoot));
    const edgeRoots = orderedEdges.map((edge) => edge.edgeRoot);
    const orderedEdgeIds = orderedEdges.map((edge) => edge.id);
    const edgeSetRoot = merkleRoot(edgeRoots);
    const coverage = deriveCoverage(eligibleEdges);
    const issueCodes = snapshotIssues(eligibleEdges, coverage);
    const state: CanopyProofMrvSnapshotState = issueCodes.length === 0 ? "reviewed_for_lineage" : "review_required";
    const previous = this.listSnapshots({ organizationId, projectId }).at(-1);
    const snapshotSequence = (previous?.snapshotSequence ?? 0) + 1;
    const previousSnapshotRoot = previous?.snapshotRoot ?? canopyProofMrvSnapshotGenesis(projectId, projectRoot);
    const limitationHashes = canonicalHashes(parsed.limitationHashes);
    const conflictDisclosureHash = normalizeHash(parsed.conflictDisclosureHash);
    const commandSeed = {
      organizationId,
      projectId,
      projectRoot,
      methodology,
      edgeIds: orderedEdgeIds,
      edgeRoots,
      edgeSetRoot,
      edgeCount: orderedEdges.length,
      coverage,
      state,
      issueCodes,
      reviewer,
      conflictDisclosureHash,
      limitationHashes,
      snapshotSequence,
      previousSnapshotRoot,
      reviewedAt: parsed.reviewedAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-mrv-graph-snapshot-command-v1", ...commandSeed });
    const id = `cp_mrv_snapshot_${commandHash.slice(0, 24)}`;
    const lineage = this.nextLineage();
    const seed = { id, ...commandSeed, commandHash, ...lineage };
    const snapshotHash = hashJson({ kind: "canopyproof-mrv-graph-snapshot-v1", ...seed });
    const snapshotRoot = canopyProofMrvSnapshotRoot({ ...seed, snapshotHash });
    const safety = canopyProofMrvGraphSafetyBoundary();
    const members = orderedEdges.map((edge, memberIndex) =>
      createSnapshotMember(id, organizationId, projectId, memberIndex, edge, safety),
    );
    const payload = { factType: "mrv_graph_snapshot" as const, ...seed, snapshotHash, snapshotRoot, safety };
    const auditEvent = this.appendEvent({
      action: state === "reviewed_for_lineage" ? "ASSERT" : "CHALLENGE",
      actor: reviewer.id,
      entityType: "mrv_graph_snapshot",
      entityId: id,
      payload,
      createdAt: parsed.reviewedAt,
      rationale: snapshotRationale,
    });
    const snapshot: CanopyProofMrvGraphSnapshotFact = { ...payload, auditEvent };
    this.storeSnapshot(snapshot, members);
    return { snapshot, members };
  }

  listEdges(filter: Readonly<{ organizationId?: string; projectId?: string; methodologyPublicationRoot?: string }> = {}) {
    return [...this.edgesById.values()]
      .filter((edge) => !filter.organizationId || edge.organizationId === filter.organizationId)
      .filter((edge) => !filter.projectId || edge.projectId === filter.projectId)
      .filter(
        (edge) =>
          !filter.methodologyPublicationRoot ||
          edge.methodology.publicationRoot === filter.methodologyPublicationRoot,
      )
      .sort(compareProjectFacts);
  }

  getEdge(id: string) {
    const edge = this.edgesById.get(id);
    if (!edge) throw new Error(`CanopyProof MRV edge not found: ${id}`);
    return edge;
  }

  listSnapshots(filter: Readonly<{ organizationId?: string; projectId?: string }> = {}) {
    return [...this.snapshotsById.values()]
      .filter((fact) => !filter.organizationId || fact.organizationId === filter.organizationId)
      .filter((fact) => !filter.projectId || fact.projectId === filter.projectId)
      .sort((left, right) => left.snapshotSequence - right.snapshotSequence || left.id.localeCompare(right.id));
  }

  getSnapshot(id: string) {
    const snapshot = this.snapshotsById.get(id);
    if (!snapshot) throw new Error(`CanopyProof MRV snapshot not found: ${id}`);
    return { snapshot, members: [...(this.membersBySnapshotId.get(id) ?? [])] } as const;
  }

  projectGraph(organizationId: string, projectId: string): CanopyProofMrvGraphProjection {
    const latest = this.listSnapshots({ organizationId, projectId }).at(-1);
    const safety = canopyProofMrvGraphSafetyBoundary();
    const seed = latest
      ? {
          organizationId,
          projectId,
          state: latest.state,
          latestSnapshotId: latest.id,
          latestSnapshotRoot: latest.snapshotRoot,
          finalProofChanged: false as const,
        }
      : { organizationId, projectId, state: "empty" as const, finalProofChanged: false as const };
    return {
      ...seed,
      graphRoot: hashJson({ kind: "canopyproof-mrv-graph-projection-v1", ...seed }),
      safety,
    };
  }

  getAuthoritySnapshot(): CanopyProofMrvGraphAuthoritySnapshot {
    return {
      streamEvents: [...this.streamEvents],
      edges: this.listEdges(),
      snapshots: this.listSnapshots(),
      snapshotMembers: this.listSnapshots().flatMap((snapshot) => this.membersBySnapshotId.get(snapshot.id) ?? []),
    };
  }

  private replayEdge(fact: CanopyProofMrvGraphEdgeFact) {
    const actor = normalizeActor(fact.actor);
    const source = normalizeEndpoint(fact.source);
    const target = normalizeEndpoint(fact.target);
    const methodology = normalizeMethodology(fact.methodology);
    assertEdgeAuthority(fact.relationship, fact.createdAt, actor, source, target, methodology);
    const commandSeed = edgeCommandSeed(fact);
    const commandHash = hashJson({ kind: "canopyproof-mrv-graph-edge-command-v1", ...commandSeed });
    const seed = edgeFactSeed(fact);
    const edgeHash = hashJson({ kind: "canopyproof-mrv-graph-edge-v1", ...seed });
    const edgeRoot = canopyProofMrvEdgeRoot({ ...seed, edgeHash });
    const safety = canopyProofMrvGraphSafetyBoundary();
    const payload = { factType: "mrv_graph_edge" as const, ...seed, edgeHash, edgeRoot, safety };
    if (
      hashJson(fact.actor) !== hashJson(actor) ||
      hashJson(fact.source) !== hashJson(source) ||
      hashJson(fact.target) !== hashJson(target) ||
      hashJson(fact.methodology) !== hashJson(methodology) ||
      fact.actorMode !== (actor.participantType === "agent" ? "advisory_agent" : "human") ||
      fact.id !== `cp_mrv_edge_${commandHash.slice(0, 24)}` ||
      fact.commandHash !== commandHash ||
      fact.edgeHash !== edgeHash ||
      fact.edgeRoot !== edgeRoot
    ) {
      throw new Error(`CanopyProof MRV edge lineage is invalid: ${fact.id}`);
    }
    assertSafety(fact.safety, fact.id);
    this.assertReplayEvent({
      event: fact.auditEvent,
      projectSequence: fact.projectSequence,
      previousEventRoot: fact.previousEventRoot,
      action: relationshipAction(fact.relationship),
      actor: actor.id,
      entityType: "mrv_graph_edge",
      entityId: fact.id,
      payload,
      createdAt: fact.createdAt,
      rationale: edgeRationale,
    });
    this.storeEdge(fact);
  }

  private replaySnapshot(
    fact: CanopyProofMrvGraphSnapshotFact,
    members: readonly CanopyProofMrvGraphSnapshotMemberFact[],
  ) {
    const reviewer = normalizeActor(fact.reviewer);
    assertSnapshotReviewer(reviewer, fact.organizationId);
    const methodology = normalizeMethodology(fact.methodology);
    const previous = this.listSnapshots({ organizationId: fact.organizationId, projectId: fact.projectId }).at(-1);
    const eligibleEdges = this.listEdges({
      organizationId: fact.organizationId,
      projectId: fact.projectId,
      methodologyPublicationRoot: methodology.publicationRoot,
    });
    const orderedEdges = [...eligibleEdges].sort((left, right) => left.edgeRoot.localeCompare(right.edgeRoot));
    const edgeIds = orderedEdges.map((edge) => edge.id);
    const edgeRoots = orderedEdges.map((edge) => edge.edgeRoot);
    const coverage = deriveCoverage(eligibleEdges);
    const issueCodes = snapshotIssues(eligibleEdges, coverage);
    const commandSeed = snapshotCommandSeed(fact);
    const commandHash = hashJson({ kind: "canopyproof-mrv-graph-snapshot-command-v1", ...commandSeed });
    const seed = snapshotFactSeed(fact);
    const snapshotHash = hashJson({ kind: "canopyproof-mrv-graph-snapshot-v1", ...seed });
    const snapshotRoot = canopyProofMrvSnapshotRoot({ ...seed, snapshotHash });
    const expectedMembers = orderedEdges.map((edge, memberIndex) =>
      createSnapshotMember(fact.id, fact.organizationId, fact.projectId, memberIndex, edge, fact.safety),
    );
    const safety = canopyProofMrvGraphSafetyBoundary();
    const payload = { factType: "mrv_graph_snapshot" as const, ...seed, snapshotHash, snapshotRoot, safety };
    if (
      hashJson(fact.reviewer) !== hashJson(reviewer) ||
      hashJson(fact.methodology) !== hashJson(methodology) ||
      eligibleEdges.some((edge) => edge.actor.id === reviewer.id) ||
      eligibleEdges.some((edge) => Date.parse(edge.createdAt) > Date.parse(fact.reviewedAt)) ||
      fact.snapshotSequence !== (previous?.snapshotSequence ?? 0) + 1 ||
      fact.previousSnapshotRoot !==
        (previous?.snapshotRoot ?? canopyProofMrvSnapshotGenesis(fact.projectId, fact.projectRoot)) ||
      hashJson(fact.edgeIds) !== hashJson(edgeIds) ||
      hashJson(fact.edgeRoots) !== hashJson(edgeRoots) ||
      fact.edgeCount !== orderedEdges.length ||
      fact.edgeSetRoot !== merkleRoot(edgeRoots) ||
      hashJson(fact.coverage) !== hashJson(coverage) ||
      hashJson(fact.issueCodes) !== hashJson(issueCodes) ||
      fact.state !== (issueCodes.length === 0 ? "reviewed_for_lineage" : "review_required") ||
      fact.id !== `cp_mrv_snapshot_${commandHash.slice(0, 24)}` ||
      fact.commandHash !== commandHash ||
      fact.snapshotHash !== snapshotHash ||
      fact.snapshotRoot !== snapshotRoot ||
      hashJson(members) !== hashJson(expectedMembers)
    ) {
      throw new Error(`CanopyProof MRV snapshot lineage is invalid: ${fact.id}`);
    }
    assertSafety(fact.safety, fact.id);
    this.assertReplayEvent({
      event: fact.auditEvent,
      projectSequence: fact.projectSequence,
      previousEventRoot: fact.previousEventRoot,
      action: fact.state === "reviewed_for_lineage" ? "ASSERT" : "CHALLENGE",
      actor: reviewer.id,
      entityType: "mrv_graph_snapshot",
      entityId: fact.id,
      payload,
      createdAt: fact.reviewedAt,
      rationale: snapshotRationale,
    });
    this.storeSnapshot(fact, members);
  }

  private assertReplayEvent(input: Readonly<{
    event: CanopyProofAuditEvent;
    projectSequence: number;
    previousEventRoot: string;
    action: CanopyProofAuditEvent["action"];
    actor: string;
    entityType: "mrv_graph_edge" | "mrv_graph_snapshot";
    entityId: string;
    payload: unknown;
    createdAt: string;
    rationale: string;
  }>) {
    const history = this.streamEvents.slice(0, input.projectSequence - 1);
    const eventAtPosition = this.streamEvents[input.projectSequence - 1];
    const expectedPreviousRoot = history.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    if (
      input.projectSequence < 1 ||
      !eventAtPosition ||
      input.previousEventRoot !== expectedPreviousRoot ||
      hashJson(eventAtPosition) !== hashJson(input.event)
    ) {
      throw new Error(`CanopyProof MRV semantic event position is invalid: ${input.entityId}`);
    }
    const replayed = appendCanopyProofAuditEvent(history, {
      action: input.action,
      actor: input.actor,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
      createdAt: input.createdAt,
      rationale: input.rationale,
    }).at(-1)!;
    if (hashJson(replayed) !== hashJson(input.event)) {
      throw new Error(`CanopyProof MRV semantic event is invalid: ${input.entityId}`);
    }
  }

  private storeEdge(fact: CanopyProofMrvGraphEdgeFact) {
    const tuple = edgeTuple(fact.source, fact.relationship, fact.target, fact.methodology);
    if (this.edgesById.has(fact.id) || this.edgeIdByCanonicalTuple.has(tuple)) {
      throw new Error(`CanopyProof MRV edge is duplicated: ${fact.id}`);
    }
    this.edgesById.set(fact.id, fact);
    this.edgeIdByCanonicalTuple.set(tuple, fact.id);
  }

  private storeSnapshot(
    fact: CanopyProofMrvGraphSnapshotFact,
    members: readonly CanopyProofMrvGraphSnapshotMemberFact[],
  ) {
    if (this.snapshotsById.has(fact.id)) throw new Error(`CanopyProof MRV snapshot is duplicated: ${fact.id}`);
    this.snapshotsById.set(fact.id, fact);
    this.membersBySnapshotId.set(fact.id, [...members]);
  }

  private appendEvent(input: Parameters<typeof appendCanopyProofAuditEvent>[1]) {
    const event = appendCanopyProofAuditEvent(this.streamEvents, input).at(-1)!;
    this.streamEvents = [...this.streamEvents, event];
    return event;
  }

  private nextLineage() {
    return {
      projectSequence: this.streamEvents.length + 1,
      previousEventRoot: this.streamEvents.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot(),
    };
  }
}

export function canopyProofMrvGraphSafetyBoundary(): CanopyProofMrvGraphSafetyBoundary {
  return {
    lineageIndexOnly: true,
    sourceDomainsAuthoritative: true,
    appendOnly: true,
    organizationBound: true,
    projectBound: true,
    exactEndpointRootsRequired: true,
    closedRelationshipMatrix: true,
    semanticEventBound: true,
    exactRetryRequired: true,
    humanSnapshotReviewRequired: true,
    aiAdvisoryOnly: true,
    rawEvidenceExcluded: true,
    preciseLocationExcluded: true,
    rawContactDataExcluded: true,
    credentialsAndSecretsExcluded: true,
    notFinalProofAuthority: true,
    notCertifiedCarbonCredit: true,
    notCarbonTaxOffset: true,
    notFinancialAsset: true,
    notGuaranteedYield: true,
    noMainnetFunds: true,
    notAutomaticCanopyDistribution: true,
    routeMounted: false,
  };
}

export function canopyProofMrvActorAuthorityRoot(
  actor: Omit<CanopyProofMrvActorSnapshot, "authorityRoot">,
) {
  return hashJson({ kind: "canopyproof-mrv-actor-authority-v1", ...actor });
}

export function canopyProofMrvEndpointHash(
  endpoint: Omit<CanopyProofMrvEndpointSnapshot, "endpointHash">,
) {
  return hashJson({ kind: "canopyproof-mrv-endpoint-v1", ...endpoint });
}

export function canopyProofMrvMethodologyRoot(
  methodology: Omit<CanopyProofMrvMethodologySnapshot, "methodologyRoot">,
) {
  return hashJson({ kind: "canopyproof-mrv-methodology-authority-v1", ...methodology });
}

export function canopyProofMrvSnapshotGenesis(projectId: string, projectRoot: string) {
  return hashJson({
    kind: "canopyproof-mrv-graph-snapshot-genesis-v1",
    projectId,
    projectRoot: normalizeHash(projectRoot),
  });
}

export function canopyProofMrvEdgeRoot(
  input: ReturnType<typeof edgeFactSeed> & { readonly edgeHash: string },
) {
  return hashJson({
    kind: "canopyproof-mrv-graph-edge-root-v1",
    sourceRoot: input.source.root,
    targetRoot: input.target.root,
    methodologyPublicationRoot: input.methodology.publicationRoot,
    relationship: input.relationship,
    commandHash: input.commandHash,
    edgeHash: input.edgeHash,
    projectSequence: input.projectSequence,
    previousEventRoot: input.previousEventRoot,
  });
}

export function canopyProofMrvSnapshotRoot(
  input: ReturnType<typeof snapshotFactSeed> & { readonly snapshotHash: string },
) {
  return hashJson({
    kind: "canopyproof-mrv-graph-snapshot-root-v1",
    projectRoot: input.projectRoot,
    methodologyPublicationRoot: input.methodology.publicationRoot,
    edgeSetRoot: input.edgeSetRoot,
    coverageRoot: input.coverage.coverageRoot,
    snapshotSequence: input.snapshotSequence,
    previousSnapshotRoot: input.previousSnapshotRoot,
    commandHash: input.commandHash,
    snapshotHash: input.snapshotHash,
    projectSequence: input.projectSequence,
    previousEventRoot: input.previousEventRoot,
  });
}

function normalizeEndpoint(input: CanopyProofMrvEndpointSnapshot): CanopyProofMrvEndpointSnapshot {
  const seed = {
    type: z.enum(canopyProofMrvEndpointTypes).parse(input.type),
    id: identifierSchema.parse(input.id),
    root: normalizeHash(input.root),
    eventRoot: normalizeHash(input.eventRoot),
    organizationId: identifierSchema.parse(input.organizationId),
    projectId: identifierSchema.parse(input.projectId),
    occurredAt: z.string().datetime().parse(input.occurredAt),
    state: z.enum(canopyProofMrvEndpointStates).parse(input.state),
    actorIds: canonicalIdentifiers(input.actorIds),
  };
  assertCanonicalTimestamp(seed.occurredAt, "endpoint occurredAt");
  const endpointHash = canopyProofMrvEndpointHash(seed);
  if (endpointHash !== normalizeHash(input.endpointHash)) {
    throw new Error(`CanopyProof MRV endpoint authority is invalid: ${seed.id}`);
  }
  return { ...seed, endpointHash };
}

function normalizeMethodology(input: CanopyProofMrvMethodologySnapshot): CanopyProofMrvMethodologySnapshot {
  const seed = {
    id: identifierSchema.parse(input.id),
    version: z.string().regex(/^v[0-9]+\.[0-9]+\.[0-9]+$/).parse(input.version),
    methodologyHash: normalizeHash(input.methodologyHash),
    publicationId: identifierSchema.parse(input.publicationId),
    publicationRoot: normalizeHash(input.publicationRoot),
    publishedAt: z.string().datetime().parse(input.publishedAt),
    status: z.literal("published").parse(input.status),
  };
  assertCanonicalTimestamp(seed.publishedAt, "methodology publishedAt");
  const methodologyRoot = canopyProofMrvMethodologyRoot(seed);
  if (methodologyRoot !== normalizeHash(input.methodologyRoot)) {
    throw new Error(`CanopyProof MRV methodology authority is invalid: ${seed.id}`);
  }
  return { ...seed, methodologyRoot };
}

function normalizeActor(input: CanopyProofMrvActorSnapshot): CanopyProofMrvActorSnapshot {
  const base = {
    id: identifierSchema.parse(input.id),
    participantType: z.enum(["human", "agent"]).parse(input.participantType),
    role: z.enum(["agent", "owner", "admin", "verifier", "researcher", "community"]).parse(input.role),
    verificationStatus: z.literal("verified").parse(input.verificationStatus),
    organizationId: identifierSchema.parse(input.organizationId),
    organizationVerificationStatus: z.literal("verified").parse(input.organizationVerificationStatus),
    participantRoot: normalizeHash(input.participantRoot),
    organizationRoot: normalizeHash(input.organizationRoot),
    ...(input.membershipId ? { membershipId: identifierSchema.parse(input.membershipId) } : {}),
    ...(input.membershipStatus ? { membershipStatus: z.literal("active").parse(input.membershipStatus) } : {}),
    ...(input.membershipRoot ? { membershipRoot: normalizeHash(input.membershipRoot) } : {}),
    ...(input.accreditationId ? { accreditationId: identifierSchema.parse(input.accreditationId) } : {}),
    ...(input.accreditationStatus
      ? { accreditationStatus: z.literal("approved").parse(input.accreditationStatus) }
      : {}),
    ...(input.accreditationRoot ? { accreditationRoot: normalizeHash(input.accreditationRoot) } : {}),
    accreditationScope: canonicalIdentifiers(input.accreditationScope),
  };
  const accreditationFieldsPresent = [
    Boolean(base.accreditationId),
    Boolean(base.accreditationStatus),
    Boolean(base.accreditationRoot),
    base.accreditationScope.length > 0,
  ];
  const hasPartialAccreditation =
    accreditationFieldsPresent.some(Boolean) && !accreditationFieldsPresent.every(Boolean);
  if (
    (base.participantType === "agent" && base.role !== "agent") ||
    (base.participantType === "agent" && accreditationFieldsPresent.some(Boolean)) ||
    (base.participantType === "human" &&
      (base.role === "agent" ||
        !base.membershipId ||
        base.membershipStatus !== "active" ||
        !base.membershipRoot ||
        hasPartialAccreditation))
  ) {
    throw new Error("CanopyProof MRV actor authority is structurally invalid.");
  }
  const authorityRoot = canopyProofMrvActorAuthorityRoot(base);
  if (authorityRoot !== normalizeHash(input.authorityRoot)) {
    throw new Error("CanopyProof MRV actor authority root is invalid.");
  }
  return { ...base, authorityRoot };
}

function assertEndpointBinding(
  binding: z.infer<typeof endpointBindingSchema>,
  endpoint: CanopyProofMrvEndpointSnapshot,
  label: string,
) {
  if (
    binding.type !== endpoint.type ||
    binding.id !== endpoint.id ||
    normalizeHash(binding.root) !== endpoint.root ||
    normalizeHash(binding.eventRoot) !== endpoint.eventRoot
  ) {
    throw new Error(`CanopyProof MRV ${label} endpoint binding is invalid.`);
  }
}

function assertEdgeAuthority(
  relationship: CanopyProofMrvRelationship,
  createdAt: string,
  actor: CanopyProofMrvActorSnapshot,
  source: CanopyProofMrvEndpointSnapshot,
  target: CanopyProofMrvEndpointSnapshot,
  methodology: CanopyProofMrvMethodologySnapshot,
) {
  if (source.id === target.id && source.type === target.type) {
    throw new Error("CanopyProof MRV self-edges are prohibited.");
  }
  if (
    source.organizationId !== target.organizationId ||
    source.projectId !== target.projectId ||
    actor.organizationId !== source.organizationId
  ) {
    throw new Error("CanopyProof MRV edge tenant or project authority mismatch.");
  }
  if (!relationshipMatrix.has(matrixKey(source.type, relationship, target.type))) {
    throw new Error("CanopyProof MRV endpoint relationship is not enabled.");
  }
  if (!source.actorIds.includes(actor.id)) {
    throw new Error("CanopyProof MRV edge author must be bound to the authoritative source fact.");
  }
  if (actor.participantType === "agent" && (relationship !== "ANALYZES" || source.type !== "ai_analysis_advisory")) {
    throw new Error("CanopyProof MRV agent authority is limited to its own advisory analysis edge.");
  }
  if (
    Date.parse(source.occurredAt) > Date.parse(createdAt) ||
    Date.parse(target.occurredAt) > Date.parse(createdAt) ||
    Date.parse(methodology.publishedAt) > Date.parse(createdAt)
  ) {
    throw new Error("CanopyProof MRV edge chronology is invalid.");
  }
}

function assertSnapshotReviewer(actor: CanopyProofMrvActorSnapshot, organizationId: string) {
  if (
    actor.participantType !== "human" ||
    !["verifier", "researcher"].includes(actor.role) ||
    actor.organizationId !== organizationId ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationId ||
    !actor.accreditationRoot ||
    !actor.accreditationScope.includes("mrv_graph_review")
  ) {
    throw new Error("CanopyProof MRV snapshot requires an accredited independent human reviewer.");
  }
}

function deriveCoverage(edges: readonly CanopyProofMrvGraphEdgeFact[]): CanopyProofMrvCoverage {
  const observedRelationshipCounts: Partial<Record<CanopyProofMrvRelationship, number>> = {};
  for (const edge of edges) {
    observedRelationshipCounts[edge.relationship] = (observedRelationshipCounts[edge.relationship] ?? 0) + 1;
  }
  const orderedCounts = Object.fromEntries(
    Object.entries(observedRelationshipCounts).sort(([left], [right]) => left.localeCompare(right)),
  ) as Partial<Record<CanopyProofMrvRelationship, number>>;
  const requiredRelationships = [...requiredSnapshotRelationships];
  return {
    requiredRelationships,
    observedRelationshipCounts: orderedCounts,
    coverageRoot: hashJson({
      kind: "canopyproof-mrv-graph-coverage-v1",
      requiredRelationships,
      observedRelationshipCounts: orderedCounts,
    }),
  };
}

function snapshotIssues(edges: readonly CanopyProofMrvGraphEdgeFact[], coverage: CanopyProofMrvCoverage) {
  const issues: string[] = [];
  for (const relationship of coverage.requiredRelationships) {
    if (!coverage.observedRelationshipCounts[relationship]) issues.push(`missing_${relationship.toLowerCase()}`);
  }
  if (edges.some((edge) => edge.edgeState !== "current")) issues.push("edge_review_required");
  return [...new Set(issues.map((value) => reasonCodeSchema.parse(value)))].sort();
}

function createSnapshotMember(
  snapshotId: string,
  organizationId: string,
  projectId: string,
  memberIndex: number,
  edge: CanopyProofMrvGraphEdgeFact,
  safety: CanopyProofMrvGraphSafetyBoundary,
): CanopyProofMrvGraphSnapshotMemberFact {
  const seed = { snapshotId, organizationId, projectId, memberIndex, edgeId: edge.id, edgeRoot: edge.edgeRoot };
  const memberHash = hashJson({ kind: "canopyproof-mrv-graph-snapshot-member-v1", ...seed });
  const id = `cp_mrv_snapshot_member_${memberHash.slice(0, 24)}`;
  const memberRoot = hashJson({ kind: "canopyproof-mrv-graph-snapshot-member-root-v1", id, ...seed, memberHash });
  return { factType: "mrv_graph_snapshot_member", id, ...seed, memberHash, memberRoot, safety };
}

function edgeCommandSeed(fact: CanopyProofMrvGraphEdgeFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    source: fact.source,
    relationship: fact.relationship,
    target: fact.target,
    methodology: fact.methodology,
    actor: fact.actor,
    actorMode: fact.actorMode,
    reasonHash: fact.reasonHash,
    limitationHashes: fact.limitationHashes,
    edgeState: fact.edgeState,
    createdAt: fact.createdAt,
  };
}

function edgeFactSeed(fact: CanopyProofMrvGraphEdgeFact) {
  return {
    id: fact.id,
    ...edgeCommandSeed(fact),
    commandHash: fact.commandHash,
    projectSequence: fact.projectSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function snapshotCommandSeed(fact: CanopyProofMrvGraphSnapshotFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    projectRoot: fact.projectRoot,
    methodology: fact.methodology,
    edgeIds: fact.edgeIds,
    edgeRoots: fact.edgeRoots,
    edgeSetRoot: fact.edgeSetRoot,
    edgeCount: fact.edgeCount,
    coverage: fact.coverage,
    state: fact.state,
    issueCodes: fact.issueCodes,
    reviewer: fact.reviewer,
    conflictDisclosureHash: fact.conflictDisclosureHash,
    limitationHashes: fact.limitationHashes,
    snapshotSequence: fact.snapshotSequence,
    previousSnapshotRoot: fact.previousSnapshotRoot,
    reviewedAt: fact.reviewedAt,
  };
}

function snapshotFactSeed(fact: CanopyProofMrvGraphSnapshotFact) {
  return {
    id: fact.id,
    ...snapshotCommandSeed(fact),
    commandHash: fact.commandHash,
    projectSequence: fact.projectSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function edgeTuple(
  source: CanopyProofMrvEndpointSnapshot,
  relationship: CanopyProofMrvRelationship,
  target: CanopyProofMrvEndpointSnapshot,
  methodology: CanopyProofMrvMethodologySnapshot,
) {
  return hashJson({
    kind: "canopyproof-mrv-canonical-edge-tuple-v1",
    sourceType: source.type,
    sourceId: source.id,
    sourceRoot: source.root,
    relationship,
    targetType: target.type,
    targetId: target.id,
    targetRoot: target.root,
    methodologyPublicationRoot: methodology.publicationRoot,
  });
}

function matrixKey(
  source: CanopyProofMrvEndpointType,
  relationship: CanopyProofMrvRelationship,
  target: CanopyProofMrvEndpointType,
) {
  return `${source}:${relationship}:${target}`;
}

function relationshipAction(relationship: CanopyProofMrvRelationship): CanopyProofAuditEvent["action"] {
  if (relationship === "CONTRADICTS") return "CHALLENGE";
  if (relationship === "DECIDES") return "FULFILL";
  if (relationship === "ANALYZES" || relationship === "REVIEWS") return "REASON";
  return "ASSERT";
}

function canonicalHashes(values: readonly string[]) {
  const normalized = values.map(normalizeHash);
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("CanopyProof MRV hash set must be duplicate-free.");
  }
  return normalized.sort();
}

function canonicalIdentifiers(values: readonly string[]) {
  const normalized = values.map((value) => identifierSchema.parse(value));
  if (new Set(normalized).size !== normalized.length) {
    throw new Error("CanopyProof MRV identifier set must be duplicate-free.");
  }
  return normalized.sort();
}

function normalizeHash(value: string) {
  return hashSchema.parse(value).toLowerCase().replace(/^sha256:/, "");
}

function assertCanonicalTimestamp(value: string, label: string) {
  if (new Date(value).toISOString() !== value) throw new Error(`CanopyProof MRV ${label} must use canonical UTC milliseconds.`);
}

function validateEventStream(events: readonly CanopyProofAuditEvent[]) {
  const normalized = [...events];
  const terminal = normalized.at(-1);
  if (terminal && !verifyCanopyProofAuditChain(normalized, terminal.createdAt).valid) {
    throw new Error("CanopyProof MRV semantic event stream is invalid.");
  }
  return normalized;
}

function assertSafety(safety: CanopyProofMrvGraphSafetyBoundary, id: string) {
  if (hashJson(safety) !== hashJson(canopyProofMrvGraphSafetyBoundary())) {
    throw new Error(`CanopyProof MRV safety boundary is invalid: ${id}`);
  }
}

function compareProjectFacts(
  left: { readonly projectSequence: number; readonly id: string },
  right: { readonly projectSequence: number; readonly id: string },
) {
  return left.projectSequence - right.projectSequence || left.id.localeCompare(right.id);
}
