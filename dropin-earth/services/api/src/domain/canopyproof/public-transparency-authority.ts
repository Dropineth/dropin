import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import {
  canopyProofEnvironmentalProofSafetyBoundary,
  type CanopyProofEnvironmentalProofRecord,
} from "./environmental-proof-authority.js";
import {
  verifyCanopyProofEnvironmentalProofChallengedRecordProjection,
  type CanopyProofEnvironmentalProofChallengedRecordProjection,
} from "./environmental-proof-challenge-authority.js";
import {
  canopyProofEnvironmentalProofLifecycleSafetyBoundary,
  verifyCanopyProofEnvironmentalProofLifecycleProjection,
  type CanopyProofEnvironmentalProofLifecycleBindingFact,
  type CanopyProofEnvironmentalProofLifecycleProjection,
  type CanopyProofEnvironmentalProofSignatureReceiptFact,
} from "./environmental-proof-lifecycle-authority.js";
import type { CanopyProofVerificationActorSnapshot } from "./evidence-verification-authority.js";
import {
  appendCanopyProofAuditEvent,
  canopyProofAuditGenesisRoot,
  type CanopyProofAuditEvent,
} from "./proof-engine.js";

export const canopyProofPublicDisclosureClassifications = ["public", "sensitive", "restricted"] as const;
export const canopyProofPublicLocationDisclosures = ["region", "withheld"] as const;
export const canopyProofPublicAreaDisclosures = ["band", "withheld"] as const;
export const canopyProofPublicAreaBands = [
  "withheld",
  "under_10_ha",
  "10_to_100_ha",
  "100_to_1000_ha",
  "over_1000_ha",
] as const;
export const canopyProofPublicConfidenceBands = ["limited", "moderate", "high"] as const;
export const canopyProofPublicTransparencyStates = [
  "active",
  "challenged",
  "suspended",
  "revoked",
  "expired",
  "superseded",
  "stale",
] as const;
export const canopyProofPublicDisclosureReasonCodes = [
  "community_safety_reviewed",
  "data_rights_reviewed",
  "habitat_sensitivity_reviewed",
  "location_minimized",
  "personal_data_excluded",
] as const;

export type CanopyProofPublicDisclosureClassification =
  (typeof canopyProofPublicDisclosureClassifications)[number];
export type CanopyProofPublicLocationDisclosure = (typeof canopyProofPublicLocationDisclosures)[number];
export type CanopyProofPublicAreaDisclosure = (typeof canopyProofPublicAreaDisclosures)[number];
export type CanopyProofPublicAreaBand = (typeof canopyProofPublicAreaBands)[number];
export type CanopyProofPublicConfidenceBand = (typeof canopyProofPublicConfidenceBands)[number];
export type CanopyProofPublicTransparencyState = (typeof canopyProofPublicTransparencyStates)[number];
export type CanopyProofPublicDisclosureReasonCode = (typeof canopyProofPublicDisclosureReasonCodes)[number];

export type CanopyProofPublicTransparencySafetyBoundary = {
  readonly currentCanonicalRecordRequired: true;
  readonly activeSignedLifecycleAtPublicationRequired: true;
  readonly independentHumanPrivacyReviewRequired: true;
  readonly accreditedHumanPublisherRequired: true;
  readonly preciseLocationForbidden: true;
  readonly rawEvidenceForbidden: true;
  readonly personalDataForbidden: true;
  readonly challengeVisibilityRequired: true;
  readonly appendOnly: true;
  readonly exactRetryRequired: true;
  readonly tenantBound: true;
  readonly routeMounted: false;
  readonly productionActivationEnabled: false;
  readonly publicRelianceAuthorized: false;
  readonly notCertifiedCarbonCredit: true;
  readonly notCarbonTaxOffset: true;
  readonly notFinancialAsset: true;
  readonly notGuaranteedYield: true;
  readonly noMainnetFunds: true;
  readonly notAutomaticCanopyDistribution: true;
};

export type CanopyProofPublicTransparencySourceAuthority = {
  readonly record: CanopyProofEnvironmentalProofRecord;
  readonly governedRecordProjection: CanopyProofEnvironmentalProofChallengedRecordProjection;
  readonly lifecycleBinding: CanopyProofEnvironmentalProofLifecycleBindingFact;
  readonly lifecycleProjection: CanopyProofEnvironmentalProofLifecycleProjection;
  readonly signatureReceipt: CanopyProofEnvironmentalProofSignatureReceiptFact;
};

export type CanopyProofPublicDisclosureReviewFact = {
  readonly factType: "public_disclosure_review";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly governedRecordProjectionRoot: string;
  readonly lifecycleBindingId: string;
  readonly lifecycleBindingRoot: string;
  readonly lifecycleProjectionRoot: string;
  readonly signatureReceiptId: string;
  readonly signatureReceiptRoot: string;
  readonly classification: CanopyProofPublicDisclosureClassification;
  readonly locationDisclosure: CanopyProofPublicLocationDisclosure;
  readonly areaDisclosure: CanopyProofPublicAreaDisclosure;
  readonly reasonCodes: readonly CanopyProofPublicDisclosureReasonCode[];
  readonly limitationHashes: readonly string[];
  readonly reviewer: CanopyProofVerificationActorSnapshot;
  readonly reviewedAt: string;
  readonly commandHash: string;
  readonly projectSequence: number;
  readonly previousEventRoot: string;
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly reviewHash: string;
  readonly reviewRoot: string;
  readonly safety: CanopyProofPublicTransparencySafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofPublicTransparencyPublicationFact = {
  readonly factType: "public_transparency_publication";
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly publicOrganizationId: string;
  readonly publicProjectId: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly recordIssuedOn: string;
  readonly reviewId: string;
  readonly reviewRoot: string;
  readonly lifecycleBindingId: string;
  readonly lifecycleBindingRoot: string;
  readonly lifecycleProjectionRoot: string;
  readonly signatureReceiptId: string;
  readonly signatureReceiptRoot: string;
  readonly issuerAuthorityRoot: string;
  readonly assertionType: CanopyProofEnvironmentalProofLifecycleBindingFact["assertionType"];
  readonly observationPeriod: {
    readonly startsOn: string;
    readonly endsOn: string;
  };
  readonly validity: {
    readonly validFrom: string;
    readonly expiresAt: string;
  };
  readonly methodology: {
    readonly id: string;
    readonly methodologyHash: string;
    readonly publicationRoot: string;
  };
  readonly location: {
    readonly disclosure: CanopyProofPublicLocationDisclosure;
    readonly sourceRegionIdHash: string;
    readonly regionId?: string;
  };
  readonly areaBand: CanopyProofPublicAreaBand;
  readonly evidence: {
    readonly count: number;
    readonly root: string;
  };
  readonly verification: {
    readonly count: number;
    readonly root: string;
  };
  readonly monitoring: {
    readonly count: number;
    readonly root: string;
  };
  readonly governance: {
    readonly approvalCount: number;
    readonly quorumRoot: string;
  };
  readonly confidenceBand: CanopyProofPublicConfidenceBand;
  readonly limitationCount: number;
  readonly limitationRoot: string;
  readonly claimBoundary: CanopyProofPublicTransparencySafetyBoundary;
  readonly publisher: CanopyProofVerificationActorSnapshot;
  readonly publishedAt: string;
  readonly commandHash: string;
  readonly projectSequence: number;
  readonly previousEventRoot: string;
  readonly sourceEventRoots: readonly string[];
  readonly sourceRoot: string;
  readonly publicationHash: string;
  readonly publicationRoot: string;
  readonly safety: CanopyProofPublicTransparencySafetyBoundary;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofPublicTransparencyProjection = {
  readonly publicOrganizationId: string;
  readonly publicProjectId: string;
  readonly publicationId: string;
  readonly publicationRoot: string;
  readonly recordId: string;
  readonly recordRoot: string;
  readonly state: CanopyProofPublicTransparencyState;
  readonly evaluatedAt: string;
  readonly issueCodes: readonly string[];
  readonly currentGovernedRecordProjectionRoot: string;
  readonly currentLifecycleProjectionRoot: string;
  readonly challenge: {
    readonly state?: CanopyProofEnvironmentalProofChallengedRecordProjection["challengeState"];
    readonly root?: string;
    readonly resolutionRoot?: string;
  };
  readonly recordIssuedOn: string;
  readonly assertionType: CanopyProofPublicTransparencyPublicationFact["assertionType"];
  readonly observationPeriod: CanopyProofPublicTransparencyPublicationFact["observationPeriod"];
  readonly validity: CanopyProofPublicTransparencyPublicationFact["validity"];
  readonly methodology: CanopyProofPublicTransparencyPublicationFact["methodology"];
  readonly location: CanopyProofPublicTransparencyPublicationFact["location"];
  readonly areaBand: CanopyProofPublicAreaBand;
  readonly evidence: CanopyProofPublicTransparencyPublicationFact["evidence"];
  readonly verification: CanopyProofPublicTransparencyPublicationFact["verification"];
  readonly monitoring: CanopyProofPublicTransparencyPublicationFact["monitoring"];
  readonly governance: CanopyProofPublicTransparencyPublicationFact["governance"];
  readonly confidenceBand: CanopyProofPublicConfidenceBand;
  readonly limitationCount: number;
  readonly limitationRoot: string;
  readonly issuerAuthorityRoot: string;
  readonly claimBoundary: CanopyProofPublicTransparencySafetyBoundary;
  readonly projectionRoot: string;
  readonly safety: CanopyProofPublicTransparencySafetyBoundary;
};

export type CanopyProofPublicTransparencyAuthoritySnapshot = {
  readonly streamEvents: readonly CanopyProofAuditEvent[];
  readonly reviews: readonly CanopyProofPublicDisclosureReviewFact[];
  readonly publications: readonly CanopyProofPublicTransparencyPublicationFact[];
};

const identifierSchema = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,239}$/);
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime();
const reviewInputSchema = z
  .object({
    organizationId: identifierSchema,
    projectId: identifierSchema,
    recordId: identifierSchema,
    expectedRecordRoot: hashSchema,
    expectedLifecycleProjectionRoot: hashSchema,
    classification: z.enum(canopyProofPublicDisclosureClassifications),
    locationDisclosure: z.enum(canopyProofPublicLocationDisclosures),
    areaDisclosure: z.enum(canopyProofPublicAreaDisclosures),
    reasonCodes: z.array(z.enum(canopyProofPublicDisclosureReasonCodes)).min(3).max(5),
    limitationHashes: z.array(hashSchema).max(64).default([]),
    reviewedAt: timestampSchema,
  })
  .strict();
const publicationInputSchema = z
  .object({
    reviewId: identifierSchema,
    expectedReviewRoot: hashSchema,
    expectedLifecycleProjectionRoot: hashSchema,
    publishedAt: timestampSchema,
  })
  .strict();
const actorSchema = z
  .object({
    id: identifierSchema,
    participantType: z.enum(["human", "agent"]),
    role: z.enum(["agent", "owner", "admin", "verifier", "researcher"]),
    verificationStatus: z.literal("verified"),
    organizationId: identifierSchema,
    organizationVerificationStatus: z.literal("verified"),
    participantRoot: hashSchema,
    organizationRoot: hashSchema,
    membershipId: identifierSchema.optional(),
    membershipStatus: z.literal("active").optional(),
    membershipRoot: hashSchema.optional(),
    accreditationId: identifierSchema.optional(),
    accreditationStatus: z.enum(["approved", "pending", "suspended", "revoked"]).optional(),
    accreditationRoot: hashSchema.optional(),
    accreditationScope: z.array(identifierSchema).max(64),
    authorityRoot: hashSchema,
  })
  .strict();

const REQUIRED_REASON_CODES = [
  "community_safety_reviewed",
  "data_rights_reviewed",
  "location_minimized",
  "personal_data_excluded",
] as const satisfies readonly CanopyProofPublicDisclosureReasonCode[];
const PRIVACY_REVIEW_SCOPE = "public_transparency:privacy_review";
const PUBLICATION_SCOPE = "public_transparency:publish";
const reviewAuditRationale =
  "An independent human reviewed the exact public disclosure allowlist and privacy classification.";
const publicationAuditRationale =
  "An accredited human published a privacy-minimized transparency fact from current signed authority.";

export class CanopyProofPublicTransparencyAuthorityService {
  private readonly reviewsById = new Map<string, CanopyProofPublicDisclosureReviewFact>();
  private readonly publicationsById = new Map<string, CanopyProofPublicTransparencyPublicationFact>();
  private readonly publicationIdByReviewId = new Map<string, string>();
  private readonly eventsByProject = new Map<string, CanopyProofAuditEvent[]>();

  static fromAuthoritySnapshot(snapshot: CanopyProofPublicTransparencyAuthoritySnapshot) {
    const service = new CanopyProofPublicTransparencyAuthorityService();
    const facts = [
      ...snapshot.reviews.map((fact) => ({ kind: "review" as const, fact })),
      ...snapshot.publications.map((fact) => ({ kind: "publication" as const, fact })),
    ].sort((left, right) => compareProjectFacts(left.fact, right.fact));
    const ids = new Set<string>();
    for (const entry of facts) {
      if (ids.has(entry.fact.id)) {
        throw new Error(`CanopyProof public transparency snapshot contains duplicate fact id: ${entry.fact.id}`);
      }
      ids.add(entry.fact.id);
      if (entry.kind === "review") service.replayReview(entry.fact);
      else service.replayPublication(entry.fact);
    }
    const replayedRoots = new Set(
      [...service.eventsByProject.values()].flat().map((event) => event.eventRoot),
    );
    if (
      replayedRoots.size !== snapshot.streamEvents.length ||
      snapshot.streamEvents.some((event) => !replayedRoots.has(event.eventRoot))
    ) {
      throw new Error("CanopyProof public transparency snapshot contains unbound semantic events.");
    }
    return service;
  }

  reviewDisclosure(
    input: unknown,
    authority: Readonly<{
      reviewer: CanopyProofVerificationActorSnapshot;
      source: CanopyProofPublicTransparencySourceAuthority;
    }>,
  ): CanopyProofPublicDisclosureReviewFact {
    const parsed = reviewInputSchema.parse(input);
    const reviewer = normalizeActor(authority.reviewer);
    assertAccreditedHuman(reviewer, parsed.organizationId, PRIVACY_REVIEW_SCOPE, ["verifier", "researcher"]);
    const source = resolveSource(authority.source, {
      organizationId: parsed.organizationId,
      projectId: parsed.projectId,
      recordId: parsed.recordId,
      evaluatedAt: parsed.reviewedAt,
      requireActive: true,
    });
    if (
      parsed.expectedRecordRoot !== source.record.recordRoot ||
      parsed.expectedLifecycleProjectionRoot !== source.lifecycleProjection.projectionRoot
    ) {
      throw new Error("CanopyProof public disclosure review expected source roots are stale.");
    }
    if (reviewer.id === source.record.issuer.id || source.record.contributorIds.includes(reviewer.id)) {
      throw new Error("CanopyProof public disclosure reviewer must be independent from issuer and contributors.");
    }
    const reasonCodes = canonicalStrings(parsed.reasonCodes) as CanopyProofPublicDisclosureReasonCode[];
    if (REQUIRED_REASON_CODES.some((reason) => !reasonCodes.includes(reason))) {
      throw new Error("CanopyProof public disclosure review omits a required privacy or safeguarding decision.");
    }
    const limitationHashes = canonicalHashes(parsed.limitationHashes);
    assertCanonicalInput(parsed.reasonCodes, reasonCodes, "reason codes");
    assertCanonicalInput(parsed.limitationHashes, limitationHashes, "limitation hashes");
    assertDisclosurePolicy(parsed.classification, parsed.locationDisclosure, parsed.areaDisclosure, reasonCodes);
    const commandSeed = {
      organizationId: parsed.organizationId,
      projectId: parsed.projectId,
      recordId: source.record.id,
      recordRoot: source.record.recordRoot,
      governedRecordProjectionRoot: source.governedRecordProjection.projectionRoot,
      lifecycleBindingId: source.lifecycleBinding.id,
      lifecycleBindingRoot: source.lifecycleBinding.bindingRoot,
      lifecycleProjectionRoot: source.lifecycleProjection.projectionRoot,
      signatureReceiptId: source.signatureReceipt.id,
      signatureReceiptRoot: source.signatureReceipt.receiptRoot,
      classification: parsed.classification,
      locationDisclosure: parsed.locationDisclosure,
      areaDisclosure: parsed.areaDisclosure,
      reasonCodes,
      limitationHashes,
      reviewer,
      reviewedAt: parsed.reviewedAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-public-disclosure-review-command-v1", ...commandSeed });
    const id = `cp_public_disclosure_review_${commandHash.slice(0, 24)}`;
    const existing = this.reviewsById.get(id);
    if (existing) {
      if (existing.commandHash === commandHash) return existing;
      throw new Error("CanopyProof public disclosure review exact retry is inconsistent.");
    }
    const events = this.eventsForProject(parsed.organizationId, parsed.projectId);
    assertMonotonicTime(events, parsed.reviewedAt);
    const projectSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const sourceEventRoots = canonicalHashes([
      source.record.auditEvent.eventRoot,
      source.lifecycleBinding.auditEvent.eventRoot,
      source.signatureReceipt.auditEvent.eventRoot,
    ]);
    const sourceRoot = merkleRoot([
      source.record.recordRoot,
      source.governedRecordProjection.projectionRoot,
      source.lifecycleBinding.bindingRoot,
      source.lifecycleProjection.projectionRoot,
      source.signatureReceipt.receiptRoot,
      reviewer.authorityRoot,
      ...sourceEventRoots,
    ].sort());
    const seed = {
      id,
      ...commandSeed,
      commandHash,
      projectSequence,
      previousEventRoot,
      sourceEventRoots,
      sourceRoot,
    };
    const reviewHash = hashJson({ kind: "canopyproof-public-disclosure-review-v1", ...seed });
    const reviewRoot = hashJson({
      kind: "canopyproof-public-disclosure-review-root-v1",
      recordRoot: source.record.recordRoot,
      lifecycleProjectionRoot: source.lifecycleProjection.projectionRoot,
      sourceRoot,
      reviewHash,
      previousEventRoot,
      projectSequence,
    });
    const safety = publicTransparencySafetyBoundary();
    const payload = {
      factType: "public_disclosure_review" as const,
      ...seed,
      reviewHash,
      reviewRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "ASSERT",
      actor: reviewer.id,
      entityType: "public_disclosure_review",
      entityId: id,
      payload,
      createdAt: parsed.reviewedAt,
      rationale: reviewAuditRationale,
    }).at(-1)!;
    const fact: CanopyProofPublicDisclosureReviewFact = { ...payload, auditEvent };
    this.storeReview(fact);
    return fact;
  }

  publish(
    input: unknown,
    authority: Readonly<{
      publisher: CanopyProofVerificationActorSnapshot;
      source: CanopyProofPublicTransparencySourceAuthority;
    }>,
  ): CanopyProofPublicTransparencyPublicationFact {
    const parsed = publicationInputSchema.parse(input);
    const review = this.getReview(parsed.reviewId);
    if (review.reviewRoot !== parsed.expectedReviewRoot) {
      throw new Error("CanopyProof public transparency publication expected review root is stale.");
    }
    const publisher = normalizeActor(authority.publisher);
    assertAccreditedHuman(publisher, review.organizationId, PUBLICATION_SCOPE, ["owner", "admin"]);
    if (publisher.id === review.reviewer.id) {
      throw new Error("CanopyProof public transparency publisher cannot approve its own privacy review.");
    }
    const source = resolveSource(authority.source, {
      organizationId: review.organizationId,
      projectId: review.projectId,
      recordId: review.recordId,
      evaluatedAt: parsed.publishedAt,
      requireActive: true,
    });
    if (
      parsed.expectedLifecycleProjectionRoot !== source.lifecycleProjection.projectionRoot ||
      source.record.recordRoot !== review.recordRoot ||
      source.lifecycleBinding.id !== review.lifecycleBindingId ||
      source.lifecycleBinding.bindingRoot !== review.lifecycleBindingRoot ||
      source.signatureReceipt.id !== review.signatureReceiptId ||
      source.signatureReceipt.receiptRoot !== review.signatureReceiptRoot
    ) {
      throw new Error("CanopyProof public transparency publication source no longer matches the reviewed authority.");
    }
    if (publisher.id === source.record.issuer.id || source.record.contributorIds.includes(publisher.id)) {
      throw new Error("CanopyProof public transparency publisher must be independent from issuer and contributors.");
    }
    if (Date.parse(parsed.publishedAt) < Date.parse(review.reviewedAt)) {
      throw new Error("CanopyProof public transparency publication cannot predate its privacy review.");
    }
    if (Date.parse(parsed.publishedAt) - Date.parse(review.reviewedAt) > 30 * 86_400_000) {
      throw new Error("CanopyProof public transparency privacy review is older than the publication window.");
    }
    const publicFields = derivePublicFields(source, review);
    const commandSeed = {
      organizationId: review.organizationId,
      projectId: review.projectId,
      ...publicFields,
      reviewId: review.id,
      reviewRoot: review.reviewRoot,
      publisher,
      publishedAt: parsed.publishedAt,
    };
    const commandHash = hashJson({ kind: "canopyproof-public-transparency-publication-command-v1", ...commandSeed });
    const id = `cp_public_transparency_${commandHash.slice(0, 24)}`;
    const priorPublicationId = this.publicationIdByReviewId.get(review.id);
    if (priorPublicationId) {
      const existing = this.getPublication(priorPublicationId);
      if (existing.id === id && existing.commandHash === commandHash) return existing;
      throw new Error("CanopyProof public disclosure review already has a conflicting publication.");
    }
    const events = this.eventsForProject(review.organizationId, review.projectId);
    assertMonotonicTime(events, parsed.publishedAt);
    const projectSequence = events.length + 1;
    const previousEventRoot = events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot();
    const sourceEventRoots = canonicalHashes([
      review.auditEvent.eventRoot,
      source.record.auditEvent.eventRoot,
      source.lifecycleBinding.auditEvent.eventRoot,
      source.signatureReceipt.auditEvent.eventRoot,
    ]);
    const sourceRoot = merkleRoot([
      review.reviewRoot,
      source.record.recordRoot,
      source.governedRecordProjection.projectionRoot,
      source.lifecycleBinding.bindingRoot,
      source.lifecycleProjection.projectionRoot,
      source.signatureReceipt.receiptRoot,
      publisher.authorityRoot,
      ...sourceEventRoots,
    ].sort());
    const seed = {
      id,
      ...commandSeed,
      commandHash,
      projectSequence,
      previousEventRoot,
      sourceEventRoots,
      sourceRoot,
    };
    const publicationHash = hashJson({ kind: "canopyproof-public-transparency-publication-v1", ...seed });
    const publicationRoot = hashJson({
      kind: "canopyproof-public-transparency-publication-root-v1",
      recordRoot: source.record.recordRoot,
      reviewRoot: review.reviewRoot,
      lifecycleProjectionRoot: source.lifecycleProjection.projectionRoot,
      sourceRoot,
      publicationHash,
      previousEventRoot,
      projectSequence,
    });
    const safety = publicTransparencySafetyBoundary();
    const payload = {
      factType: "public_transparency_publication" as const,
      ...seed,
      publicationHash,
      publicationRoot,
      safety,
    };
    const auditEvent = appendCanopyProofAuditEvent(events, {
      action: "FULFILL",
      actor: publisher.id,
      entityType: "public_transparency_publication",
      entityId: id,
      payload,
      createdAt: parsed.publishedAt,
      rationale: publicationAuditRationale,
    }).at(-1)!;
    const fact: CanopyProofPublicTransparencyPublicationFact = { ...payload, auditEvent };
    this.storePublication(fact);
    return fact;
  }

  projectPublication(
    publicationId: string,
    source: CanopyProofPublicTransparencySourceAuthority,
  ): CanopyProofPublicTransparencyProjection {
    const publication = this.getPublication(publicationId);
    const current = resolveSource(source, {
      organizationId: publication.organizationId,
      projectId: publication.projectId,
      recordId: publication.recordId,
      evaluatedAt: source.lifecycleProjection.evaluatedAt,
      requireActive: false,
    });
    const issueCodes = new Set<string>(current.lifecycleProjection.issueCodes);
    if (current.record.recordRoot !== publication.recordRoot) issueCodes.add("record_root_changed");
    if (current.lifecycleBinding.id !== publication.lifecycleBindingId) issueCodes.add("lifecycle_binding_changed");
    if (current.signatureReceipt.id !== publication.signatureReceiptId) issueCodes.add("signature_receipt_changed");
    const state = projectPublicState(current, issueCodes);
    const sortedIssueCodes = [...issueCodes].sort();
    const challenge = {
      ...(current.governedRecordProjection.challengeState
        ? { state: current.governedRecordProjection.challengeState }
        : {}),
      ...(current.governedRecordProjection.challengeRoot
        ? { root: current.governedRecordProjection.challengeRoot }
        : {}),
      ...(current.governedRecordProjection.resolutionRoot
        ? { resolutionRoot: current.governedRecordProjection.resolutionRoot }
        : {}),
    };
    const seed = publicProjectionSeed({
      publication,
      state,
      evaluatedAt: current.lifecycleProjection.evaluatedAt,
      issueCodes: sortedIssueCodes,
      currentGovernedRecordProjectionRoot: current.governedRecordProjection.projectionRoot,
      currentLifecycleProjectionRoot: current.lifecycleProjection.projectionRoot,
      challenge,
    });
    return {
      ...seed,
      projectionRoot: hashJson({ kind: "canopyproof-public-transparency-projection-v1", ...seed }),
      safety: publicTransparencySafetyBoundary(),
    };
  }

  getReview(id: string) {
    const fact = this.reviewsById.get(id);
    if (!fact) throw new Error(`CanopyProof public disclosure review not found: ${id}`);
    return fact;
  }

  getPublication(id: string) {
    const fact = this.publicationsById.get(id);
    if (!fact) throw new Error(`CanopyProof public transparency publication not found: ${id}`);
    return fact;
  }

  listReviews(filter: Readonly<{ organizationId?: string; projectId?: string; recordId?: string }> = {}) {
    return [...this.reviewsById.values()]
      .filter((fact) => !filter.organizationId || fact.organizationId === filter.organizationId)
      .filter((fact) => !filter.projectId || fact.projectId === filter.projectId)
      .filter((fact) => !filter.recordId || fact.recordId === filter.recordId)
      .sort(compareProjectFacts);
  }

  listPublications(filter: Readonly<{ organizationId?: string; projectId?: string; recordId?: string }> = {}) {
    return [...this.publicationsById.values()]
      .filter((fact) => !filter.organizationId || fact.organizationId === filter.organizationId)
      .filter((fact) => !filter.projectId || fact.projectId === filter.projectId)
      .filter((fact) => !filter.recordId || fact.recordId === filter.recordId)
      .sort(compareProjectFacts);
  }

  getAuthoritySnapshot(): CanopyProofPublicTransparencyAuthoritySnapshot {
    return {
      streamEvents: [...this.eventsByProject.values()].flat().sort(compareAuditEvents),
      reviews: this.listReviews(),
      publications: this.listPublications(),
    };
  }

  private replayReview(fact: CanopyProofPublicDisclosureReviewFact) {
    const reviewer = normalizeActor(fact.reviewer);
    assertAccreditedHuman(reviewer, fact.organizationId, PRIVACY_REVIEW_SCOPE, ["verifier", "researcher"]);
    const events = this.eventsForProject(fact.organizationId, fact.projectId);
    assertReplayStreamPosition(fact, events);
    const reasonCodes = canonicalStrings(fact.reasonCodes) as CanopyProofPublicDisclosureReasonCode[];
    const limitationHashes = canonicalHashes(fact.limitationHashes);
    assertCanonicalInput(fact.reasonCodes, reasonCodes, "snapshot reason codes");
    assertCanonicalInput(fact.limitationHashes, limitationHashes, "snapshot limitation hashes");
    assertDisclosurePolicy(fact.classification, fact.locationDisclosure, fact.areaDisclosure, reasonCodes);
    const commandSeed = reviewCommandSeed(fact, reviewer);
    const commandHash = hashJson({ kind: "canopyproof-public-disclosure-review-command-v1", ...commandSeed });
    const id = `cp_public_disclosure_review_${commandHash.slice(0, 24)}`;
    const seed = reviewFactSeed(fact, reviewer);
    const reviewHash = hashJson({ kind: "canopyproof-public-disclosure-review-v1", ...seed });
    const reviewRoot = hashJson({
      kind: "canopyproof-public-disclosure-review-root-v1",
      recordRoot: fact.recordRoot,
      lifecycleProjectionRoot: fact.lifecycleProjectionRoot,
      sourceRoot: fact.sourceRoot,
      reviewHash,
      previousEventRoot: fact.previousEventRoot,
      projectSequence: fact.projectSequence,
    });
    if (
      fact.id !== id ||
      fact.commandHash !== commandHash ||
      fact.reviewHash !== reviewHash ||
      fact.reviewRoot !== reviewRoot ||
      hashJson(fact.safety) !== hashJson(publicTransparencySafetyBoundary()) ||
      !verifyAuditEvent(fact.auditEvent, factWithoutAuditEvent({ ...fact, reviewer }), {
        action: "ASSERT",
        actor: reviewer.id,
        entityType: "public_disclosure_review",
        entityId: fact.id,
        createdAt: fact.reviewedAt,
        rationale: reviewAuditRationale,
      })
    ) {
      throw new Error(`CanopyProof public disclosure review snapshot lineage is invalid: ${fact.id}`);
    }
    this.storeReview({ ...fact, reviewer });
  }

  private replayPublication(fact: CanopyProofPublicTransparencyPublicationFact) {
    const review = this.getReview(fact.reviewId);
    const publisher = normalizeActor(fact.publisher);
    assertAccreditedHuman(publisher, fact.organizationId, PUBLICATION_SCOPE, ["owner", "admin"]);
    if (publisher.id === review.reviewer.id) {
      throw new Error("CanopyProof public transparency snapshot violates reviewer/publisher separation.");
    }
    if (
      review.reviewRoot !== fact.reviewRoot ||
      review.recordId !== fact.recordId ||
      review.recordRoot !== fact.recordRoot ||
      review.organizationId !== fact.organizationId ||
      review.projectId !== fact.projectId ||
      review.lifecycleBindingId !== fact.lifecycleBindingId ||
      review.lifecycleBindingRoot !== fact.lifecycleBindingRoot ||
      review.signatureReceiptId !== fact.signatureReceiptId ||
      review.signatureReceiptRoot !== fact.signatureReceiptRoot
    ) {
      throw new Error("CanopyProof public transparency snapshot publication does not match its disclosure review.");
    }
    const events = this.eventsForProject(fact.organizationId, fact.projectId);
    assertReplayStreamPosition(fact, events);
    const commandSeed = publicationCommandSeed(fact, publisher);
    const commandHash = hashJson({ kind: "canopyproof-public-transparency-publication-command-v1", ...commandSeed });
    const id = `cp_public_transparency_${commandHash.slice(0, 24)}`;
    const seed = publicationFactSeed(fact, publisher);
    const publicationHash = hashJson({ kind: "canopyproof-public-transparency-publication-v1", ...seed });
    const publicationRoot = hashJson({
      kind: "canopyproof-public-transparency-publication-root-v1",
      recordRoot: fact.recordRoot,
      reviewRoot: fact.reviewRoot,
      lifecycleProjectionRoot: fact.lifecycleProjectionRoot,
      sourceRoot: fact.sourceRoot,
      publicationHash,
      previousEventRoot: fact.previousEventRoot,
      projectSequence: fact.projectSequence,
    });
    if (
      fact.id !== id ||
      fact.commandHash !== commandHash ||
      fact.publicationHash !== publicationHash ||
      fact.publicationRoot !== publicationRoot ||
      hashJson(fact.claimBoundary) !== hashJson(publicTransparencySafetyBoundary()) ||
      hashJson(fact.safety) !== hashJson(publicTransparencySafetyBoundary()) ||
      !assertPublicFactHasNoCoordinates(fact) ||
      !verifyAuditEvent(fact.auditEvent, factWithoutAuditEvent({ ...fact, publisher }), {
        action: "FULFILL",
        actor: publisher.id,
        entityType: "public_transparency_publication",
        entityId: fact.id,
        createdAt: fact.publishedAt,
        rationale: publicationAuditRationale,
      })
    ) {
      throw new Error(`CanopyProof public transparency publication snapshot lineage is invalid: ${fact.id}`);
    }
    this.storePublication({ ...fact, publisher });
  }

  private eventsForProject(organizationId: string, projectId: string) {
    return this.eventsByProject.get(projectStreamKey(organizationId, projectId)) ?? [];
  }

  private storeReview(fact: CanopyProofPublicDisclosureReviewFact) {
    this.reviewsById.set(fact.id, fact);
    this.eventsByProject.set(projectStreamKey(fact.organizationId, fact.projectId), [
      ...this.eventsForProject(fact.organizationId, fact.projectId),
      fact.auditEvent,
    ]);
  }

  private storePublication(fact: CanopyProofPublicTransparencyPublicationFact) {
    if (this.publicationIdByReviewId.has(fact.reviewId)) {
      throw new Error("CanopyProof public transparency snapshot duplicates a disclosure review publication.");
    }
    this.publicationsById.set(fact.id, fact);
    this.publicationIdByReviewId.set(fact.reviewId, fact.id);
    this.eventsByProject.set(projectStreamKey(fact.organizationId, fact.projectId), [
      ...this.eventsForProject(fact.organizationId, fact.projectId),
      fact.auditEvent,
    ]);
  }
}

export function canopyProofPublicTransparencySafetyBoundary(): CanopyProofPublicTransparencySafetyBoundary {
  return publicTransparencySafetyBoundary();
}

export function verifyCanopyProofPublicTransparencyProjection(
  projection: CanopyProofPublicTransparencyProjection,
) {
  const issueCodes = canonicalStrings(projection.issueCodes);
  if (hashJson(issueCodes) !== hashJson(projection.issueCodes)) return false;
  const seed = {
    publicOrganizationId: projection.publicOrganizationId,
    publicProjectId: projection.publicProjectId,
    publicationId: projection.publicationId,
    publicationRoot: projection.publicationRoot,
    recordId: projection.recordId,
    recordRoot: projection.recordRoot,
    state: projection.state,
    evaluatedAt: projection.evaluatedAt,
    issueCodes: projection.issueCodes,
    currentGovernedRecordProjectionRoot: projection.currentGovernedRecordProjectionRoot,
    currentLifecycleProjectionRoot: projection.currentLifecycleProjectionRoot,
    challenge: projection.challenge,
    recordIssuedOn: projection.recordIssuedOn,
    assertionType: projection.assertionType,
    observationPeriod: projection.observationPeriod,
    validity: projection.validity,
    methodology: projection.methodology,
    location: projection.location,
    areaBand: projection.areaBand,
    evidence: projection.evidence,
    verification: projection.verification,
    monitoring: projection.monitoring,
    governance: projection.governance,
    confidenceBand: projection.confidenceBand,
    limitationCount: projection.limitationCount,
    limitationRoot: projection.limitationRoot,
    issuerAuthorityRoot: projection.issuerAuthorityRoot,
    claimBoundary: projection.claimBoundary,
  };
  return (
    projection.projectionRoot === hashJson({ kind: "canopyproof-public-transparency-projection-v1", ...seed }) &&
    hashJson(projection.safety) === hashJson(publicTransparencySafetyBoundary()) &&
    hashJson(projection.claimBoundary) === hashJson(publicTransparencySafetyBoundary()) &&
    assertPublicProjectionHasNoCoordinates(projection)
  );
}

function resolveSource(
  source: CanopyProofPublicTransparencySourceAuthority,
  scope: Readonly<{
    organizationId: string;
    projectId: string;
    recordId: string;
    evaluatedAt: string;
    requireActive: boolean;
  }>,
) {
  assertCanonicalTimestamp(scope.evaluatedAt, "public transparency evaluatedAt");
  const { record, governedRecordProjection, lifecycleBinding, lifecycleProjection, signatureReceipt } = source;
  const commitmentChecks = {
    environmental_record: verifyEnvironmentalProofRecordCommitment(record),
    governed_record_projection: verifyCanopyProofEnvironmentalProofChallengedRecordProjection(
      governedRecordProjection,
    ),
    lifecycle_projection: verifyCanopyProofEnvironmentalProofLifecycleProjection(lifecycleProjection),
    lifecycle_binding: verifyLifecycleBindingCommitment(lifecycleBinding),
    signature_receipt: verifySignatureReceiptCommitment(signatureReceipt),
  };
  const invalidCommitments = Object.entries(commitmentChecks)
    .filter(([, valid]) => !valid)
    .map(([name]) => name);
  if (invalidCommitments.length > 0) {
    throw new Error(
      `CanopyProof public transparency source contains invalid canonical commitments: ${invalidCommitments.join(", ")}.`,
    );
  }
  if (
    record.organizationId !== scope.organizationId ||
    record.projectId !== scope.projectId ||
    record.id !== scope.recordId ||
    governedRecordProjection.recordId !== record.id ||
    governedRecordProjection.recordRoot !== record.recordRoot ||
    lifecycleBinding.organizationId !== scope.organizationId ||
    lifecycleBinding.projectId !== scope.projectId ||
    lifecycleBinding.recordId !== record.id ||
    lifecycleBinding.recordRoot !== record.recordRoot ||
    (scope.requireActive &&
      lifecycleBinding.governedRecordProjectionRoot !== governedRecordProjection.projectionRoot) ||
    lifecycleProjection.organizationId !== scope.organizationId ||
    lifecycleProjection.projectId !== scope.projectId ||
    lifecycleProjection.recordId !== record.id ||
    lifecycleProjection.recordRoot !== record.recordRoot ||
    lifecycleProjection.bindingId !== lifecycleBinding.id ||
    lifecycleProjection.bindingRoot !== lifecycleBinding.bindingRoot ||
    lifecycleProjection.evaluatedAt !== scope.evaluatedAt ||
    signatureReceipt.organizationId !== scope.organizationId ||
    signatureReceipt.projectId !== scope.projectId ||
    signatureReceipt.recordId !== record.id ||
    signatureReceipt.recordRoot !== record.recordRoot ||
    signatureReceipt.bindingId !== lifecycleBinding.id ||
    signatureReceipt.bindingRoot !== lifecycleBinding.bindingRoot ||
    signatureReceipt.signingKeyAuthorityId !== lifecycleBinding.signingKeyAuthorityId ||
    signatureReceipt.signingKeyRoot !== lifecycleBinding.signingKeyRoot ||
    Date.parse(record.issuedAt) > Date.parse(scope.evaluatedAt) ||
    Date.parse(signatureReceipt.verifiedAt) > Date.parse(scope.evaluatedAt)
  ) {
    throw new Error("CanopyProof public transparency source authority scope or lineage is invalid.");
  }
  if (
    scope.requireActive &&
    (governedRecordProjection.state !== "issued" ||
      !governedRecordProjection.sourceAuthorityCurrent ||
      lifecycleProjection.state !== "active" ||
      lifecycleProjection.governedRecordState !== "issued" ||
      !lifecycleProjection.sourceAuthorityCurrent ||
      lifecycleProjection.mrvState !== "reviewed_for_lineage" ||
      !lifecycleProjection.boundMrvSnapshotCurrent ||
      lifecycleProjection.keyState !== "active" ||
      !lifecycleProjection.signatureVerified ||
      !lifecycleProjection.validityCurrent)
  ) {
    throw new Error("CanopyProof public transparency publication requires current active signed authority.");
  }
  return source;
}

function derivePublicFields(
  source: CanopyProofPublicTransparencySourceAuthority,
  review: CanopyProofPublicDisclosureReviewFact,
) {
  const { record, lifecycleBinding, lifecycleProjection, signatureReceipt } = source;
  const sourceRegionId = record.publicLocation.regionId;
  const location = {
    disclosure: review.locationDisclosure,
    sourceRegionIdHash: hashJson({ kind: "canopyproof-public-source-region-v1", regionId: sourceRegionId }),
    ...(review.locationDisclosure === "region" ? { regionId: sourceRegionId } : {}),
  };
  const areaBand = review.areaDisclosure === "withheld" ? "withheld" : areaBandFor(record.publicLocation.areaHectares);
  const verificationRoot = rootFor(record.evidenceFinalDecisionRoots, "verification");
  const limitationRoot = rootFor(review.limitationHashes, "limitation");
  const publicOrganizationId = `cp_public_org_${hashJson({
    kind: "canopyproof-public-organization-id-v1",
    organizationId: record.organizationId,
    organizationRoot: record.issuer.organizationRoot,
  }).slice(0, 24)}`;
  const publicProjectId = `cp_public_project_${hashJson({
    kind: "canopyproof-public-project-id-v1",
    organizationId: record.organizationId,
    projectId: record.projectId,
    projectRoot: record.projectRoot,
  }).slice(0, 24)}`;
  return {
    publicOrganizationId,
    publicProjectId,
    recordId: record.id,
    recordRoot: record.recordRoot,
    recordIssuedOn: utcDay(record.issuedAt),
    lifecycleBindingId: lifecycleBinding.id,
    lifecycleBindingRoot: lifecycleBinding.bindingRoot,
    lifecycleProjectionRoot: lifecycleProjection.projectionRoot,
    signatureReceiptId: signatureReceipt.id,
    signatureReceiptRoot: signatureReceipt.receiptRoot,
    issuerAuthorityRoot: record.issuer.authorityRoot,
    assertionType: lifecycleBinding.assertionType,
    observationPeriod: {
      startsOn: utcDay(lifecycleBinding.observationPeriod.startsAt),
      endsOn: utcDay(lifecycleBinding.observationPeriod.endsAt),
    },
    validity: lifecycleBinding.validity,
    methodology: {
      id: record.methodologyId,
      methodologyHash: record.methodologyHash,
      publicationRoot: record.methodologyPublicationRoot,
    },
    location,
    areaBand,
    evidence: { count: record.evidenceIds.length, root: record.evidenceRoot },
    verification: { count: record.evidenceFinalDecisionIds.length, root: verificationRoot },
    monitoring: { count: record.monitoringEventIds.length, root: record.monitoringRoot },
    governance: { approvalCount: record.governanceApprovalIds.length, quorumRoot: record.governanceQuorumRoot },
    confidenceBand: confidenceBandFor(record.confidenceScore),
    limitationCount: review.limitationHashes.length,
    limitationRoot,
    claimBoundary: publicTransparencySafetyBoundary(),
  } as const;
}

function projectPublicState(
  source: CanopyProofPublicTransparencySourceAuthority,
  issueCodes: Set<string>,
): CanopyProofPublicTransparencyState {
  const lifecycleState = source.lifecycleProjection.state;
  if (lifecycleState === "superseded") return "superseded";
  if (lifecycleState === "revoked" || source.governedRecordProjection.state === "revoked") return "revoked";
  if (lifecycleState === "challenged" || source.governedRecordProjection.state === "challenged") return "challenged";
  if (lifecycleState === "expired") return "expired";
  if (lifecycleState === "suspended") return "suspended";
  if (
    source.governedRecordProjection.state === "stale" ||
    !source.governedRecordProjection.sourceAuthorityCurrent ||
    !source.lifecycleProjection.sourceAuthorityCurrent
  ) {
    issueCodes.add("source_authority_stale");
    return "stale";
  }
  if (lifecycleState !== "active") {
    issueCodes.add(`lifecycle_${lifecycleState}`);
    return "suspended";
  }
  return "active";
}

function publicProjectionSeed(input: Readonly<{
  publication: CanopyProofPublicTransparencyPublicationFact;
  state: CanopyProofPublicTransparencyState;
  evaluatedAt: string;
  issueCodes: readonly string[];
  currentGovernedRecordProjectionRoot: string;
  currentLifecycleProjectionRoot: string;
  challenge: CanopyProofPublicTransparencyProjection["challenge"];
}>): Omit<CanopyProofPublicTransparencyProjection, "projectionRoot" | "safety"> {
  const { publication } = input;
  return {
    publicOrganizationId: publication.publicOrganizationId,
    publicProjectId: publication.publicProjectId,
    publicationId: publication.id,
    publicationRoot: publication.publicationRoot,
    recordId: publication.recordId,
    recordRoot: publication.recordRoot,
    state: input.state,
    evaluatedAt: input.evaluatedAt,
    issueCodes: input.issueCodes,
    currentGovernedRecordProjectionRoot: input.currentGovernedRecordProjectionRoot,
    currentLifecycleProjectionRoot: input.currentLifecycleProjectionRoot,
    challenge: input.challenge,
    recordIssuedOn: publication.recordIssuedOn,
    assertionType: publication.assertionType,
    observationPeriod: publication.observationPeriod,
    validity: publication.validity,
    methodology: publication.methodology,
    location: publication.location,
    areaBand: publication.areaBand,
    evidence: publication.evidence,
    verification: publication.verification,
    monitoring: publication.monitoring,
    governance: publication.governance,
    confidenceBand: publication.confidenceBand,
    limitationCount: publication.limitationCount,
    limitationRoot: publication.limitationRoot,
    issuerAuthorityRoot: publication.issuerAuthorityRoot,
    claimBoundary: publication.claimBoundary,
  };
}

function verifyEnvironmentalProofRecordCommitment(record: CanopyProofEnvironmentalProofRecord) {
  const seed = environmentalRecordSeed(record);
  const recordHash = hashJson({ kind: "canopyproof-environmental-proof-record-v2", ...seed });
  const recordRoot = hashJson({
    kind: "canopyproof-environmental-proof-record-root-v1",
    candidateRoot: record.candidateRoot,
    governanceQuorumRoot: record.governanceQuorumRoot,
    sourceRoot: record.sourceRoot,
    recordHash,
    previousEventRoot: record.previousEventRoot,
    candidateSequence: record.candidateSequence,
  });
  const payload = {
    factType: "environmental_proof_record" as const,
    id: record.id,
    ...seed,
    recordHash,
    recordRoot,
    status: "issued" as const,
    claimBoundary: canopyProofEnvironmentalProofSafetyBoundary(),
  };
  return (
    record.id === `cp_environmental_proof_record_${record.commandHash.slice(0, 24)}` &&
    record.recordHash === recordHash &&
    record.recordRoot === recordRoot &&
    hashJson(record.claimBoundary) === hashJson(canopyProofEnvironmentalProofSafetyBoundary()) &&
    verifyAuditEvent(record.auditEvent, payload, {
      action: "FULFILL",
      actor: record.issuer.id,
      entityType: "environmental_proof_record",
      entityId: record.id,
      createdAt: record.issuedAt,
      rationale: record.rationale,
    })
  );
}

function environmentalRecordSeed(record: CanopyProofEnvironmentalProofRecord) {
  return {
    recordType: record.recordType,
    candidateId: record.candidateId,
    candidateRoot: record.candidateRoot,
    authorityRoot: record.authorityRoot,
    organizationId: record.organizationId,
    projectId: record.projectId,
    projectRoot: record.projectRoot,
    methodologyId: record.methodologyId,
    methodologyHash: record.methodologyHash,
    methodologyPublicationId: record.methodologyPublicationId,
    methodologyPublicationRoot: record.methodologyPublicationRoot,
    policyId: record.policyId,
    policyRoot: record.policyRoot,
    evidenceIds: record.evidenceIds,
    evidenceRoot: record.evidenceRoot,
    evidenceFinalDecisionIds: record.evidenceFinalDecisionIds,
    evidenceFinalDecisionRoots: record.evidenceFinalDecisionRoots,
    monitoringEventIds: record.monitoringEventIds,
    monitoringRoot: record.monitoringRoot,
    contributorIds: record.contributorIds,
    publicLocation: record.publicLocation,
    confidenceScore: record.confidenceScore,
    governanceApprovalIds: record.governanceApprovalIds,
    governanceApprovalRoots: record.governanceApprovalRoots,
    governanceQuorumRoot: record.governanceQuorumRoot,
    issuer: record.issuer,
    rationale: record.rationale,
    limitations: record.limitations,
    sourceEventRoots: record.sourceEventRoots,
    sourceRoot: record.sourceRoot,
    issuedAt: record.issuedAt,
    commandHash: record.commandHash,
    candidateSequence: record.candidateSequence,
    previousEventRoot: record.previousEventRoot,
  };
}

function verifyLifecycleBindingCommitment(fact: CanopyProofEnvironmentalProofLifecycleBindingFact) {
  const authoritySeed = bindingAuthoritySeed(fact);
  const signaturePayloadHash = hashJson({
    kind: "canopyproof-environmental-proof-signature-payload-v1",
    ...authoritySeed,
  });
  const commandHash = hashJson({
    kind: "canopyproof-environmental-proof-lifecycle-binding-command-v1",
    ...authoritySeed,
    signaturePayloadHash,
  });
  const seed = bindingFactSeed(fact);
  const bindingHash = hashJson({ kind: "canopyproof-environmental-proof-lifecycle-binding-v1", ...seed });
  const bindingRoot = hashJson({
    kind: "canopyproof-environmental-proof-lifecycle-binding-root-v1",
    recordRoot: fact.recordRoot,
    mrvSnapshotRoot: fact.mrvSnapshotRoot,
    signingKeyRoot: fact.signingKeyRoot,
    sourceRoot: fact.sourceRoot,
    bindingHash,
    previousEventRoot: fact.previousEventRoot,
    recordSequence: fact.recordSequence,
  });
  const payload = {
    factType: "environmental_proof_lifecycle_binding" as const,
    ...seed,
    bindingHash,
    bindingRoot,
    safety: canopyProofEnvironmentalProofLifecycleSafetyBoundary(),
  };
  return (
    fact.id === `cp_environmental_proof_lifecycle_${commandHash.slice(0, 24)}` &&
    fact.signaturePayloadHash === signaturePayloadHash &&
    fact.commandHash === commandHash &&
    fact.bindingHash === bindingHash &&
    fact.bindingRoot === bindingRoot &&
    hashJson(fact.safety) === hashJson(canopyProofEnvironmentalProofLifecycleSafetyBoundary()) &&
    verifyAuditEvent(fact.auditEvent, payload, {
      action: "ASSERT",
      actor: fact.issuer.id,
      entityType: "environmental_proof_lifecycle_binding",
      entityId: fact.id,
      createdAt: fact.boundAt,
      rationale:
        "A canonical Environmental Proof Record was bound to reviewed MRV lineage, fixed validity, and managed-key authority.",
    })
  );
}

function bindingAuthoritySeed(fact: CanopyProofEnvironmentalProofLifecycleBindingFact) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    recordIssuedAt: fact.recordIssuedAt,
    governedRecordProjectionRoot: fact.governedRecordProjectionRoot,
    mrvSnapshotId: fact.mrvSnapshotId,
    mrvSnapshotRoot: fact.mrvSnapshotRoot,
    mrvEdgeSetRoot: fact.mrvEdgeSetRoot,
    mrvGraphRoot: fact.mrvGraphRoot,
    mrvReviewedAt: fact.mrvReviewedAt,
    methodologyId: fact.methodologyId,
    methodologyPublicationRoot: fact.methodologyPublicationRoot,
    observationPeriod: fact.observationPeriod,
    validity: fact.validity,
    monitoringSchedule: fact.monitoringSchedule,
    assertionType: fact.assertionType,
    assertionScopeHash: fact.assertionScopeHash,
    locationScopeHash: fact.locationScopeHash,
    uncertaintyHash: fact.uncertaintyHash,
    limitationHashes: fact.limitationHashes,
    relianceStatement: fact.relianceStatement,
    issuer: fact.issuer,
    signingKeyAuthorityId: fact.signingKeyAuthorityId,
    signingKeyRoot: fact.signingKeyRoot,
    sourceEventRoots: fact.sourceEventRoots,
    sourceRoot: fact.sourceRoot,
    boundAt: fact.boundAt,
  };
}

function bindingFactSeed(fact: CanopyProofEnvironmentalProofLifecycleBindingFact) {
  return {
    id: fact.id,
    ...bindingAuthoritySeed(fact),
    signaturePayloadHash: fact.signaturePayloadHash,
    commandHash: fact.commandHash,
    recordSequence: fact.recordSequence,
    previousEventRoot: fact.previousEventRoot,
  };
}

function verifySignatureReceiptCommitment(fact: CanopyProofEnvironmentalProofSignatureReceiptFact) {
  const signatureHash = hashJson({
    kind: "canopyproof-environmental-proof-detached-signature-v1",
    algorithm: fact.algorithm,
    detachedSignature: fact.detachedSignature,
  });
  const commandSeed = signatureCommandSeed(fact, signatureHash);
  const commandHash = hashJson({
    kind: "canopyproof-environmental-proof-signature-receipt-command-v1",
    ...commandSeed,
  });
  const seed = signatureFactSeed(fact);
  const receiptHash = hashJson({ kind: "canopyproof-environmental-proof-signature-receipt-v1", ...seed });
  const receiptRoot = hashJson({
    kind: "canopyproof-environmental-proof-signature-receipt-root-v1",
    bindingRoot: fact.bindingRoot,
    signingKeyRoot: fact.signingKeyRoot,
    sourceRoot: fact.sourceRoot,
    receiptHash,
    previousEventRoot: fact.previousEventRoot,
    recordSequence: fact.recordSequence,
  });
  const payload = {
    factType: "environmental_proof_signature_receipt" as const,
    ...seed,
    receiptHash,
    receiptRoot,
    safety: canopyProofEnvironmentalProofLifecycleSafetyBoundary(),
  };
  return (
    fact.signatureHash === signatureHash &&
    fact.commandHash === commandHash &&
    fact.id === `cp_environmental_proof_signature_${commandHash.slice(0, 24)}` &&
    fact.receiptHash === receiptHash &&
    fact.receiptRoot === receiptRoot &&
    hashJson(fact.safety) === hashJson(canopyProofEnvironmentalProofLifecycleSafetyBoundary()) &&
    verifyAuditEvent(fact.auditEvent, payload, {
      action: "FULFILL",
      actor: fact.externalVerifierId,
      entityType: "environmental_proof_signature_receipt",
      entityId: fact.id,
      createdAt: fact.verifiedAt,
      rationale:
        "An external managed-signature verifier accepted the detached signature for the exact lifecycle payload.",
    })
  );
}

function signatureCommandSeed(fact: CanopyProofEnvironmentalProofSignatureReceiptFact, signatureHash: string) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    bindingId: fact.bindingId,
    bindingRoot: fact.bindingRoot,
    signingKeyAuthorityId: fact.signingKeyAuthorityId,
    signingKeyRoot: fact.signingKeyRoot,
    algorithm: fact.algorithm,
    signaturePayloadHash: fact.signaturePayloadHash,
    detachedSignature: fact.detachedSignature,
    signatureHash,
    externalVerifierId: fact.externalVerifierId,
    providerReceiptIdHash: fact.providerReceiptIdHash,
    providerReceiptHash: fact.providerReceiptHash,
    signedAt: fact.signedAt,
    verifiedAt: fact.verifiedAt,
  };
}

function signatureFactSeed(fact: CanopyProofEnvironmentalProofSignatureReceiptFact) {
  return {
    id: fact.id,
    ...signatureCommandSeed(fact, fact.signatureHash),
    commandHash: fact.commandHash,
    recordSequence: fact.recordSequence,
    previousEventRoot: fact.previousEventRoot,
    sourceRoot: fact.sourceRoot,
  };
}

function reviewCommandSeed(
  fact: CanopyProofPublicDisclosureReviewFact,
  reviewer: CanopyProofVerificationActorSnapshot,
) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    governedRecordProjectionRoot: fact.governedRecordProjectionRoot,
    lifecycleBindingId: fact.lifecycleBindingId,
    lifecycleBindingRoot: fact.lifecycleBindingRoot,
    lifecycleProjectionRoot: fact.lifecycleProjectionRoot,
    signatureReceiptId: fact.signatureReceiptId,
    signatureReceiptRoot: fact.signatureReceiptRoot,
    classification: fact.classification,
    locationDisclosure: fact.locationDisclosure,
    areaDisclosure: fact.areaDisclosure,
    reasonCodes: fact.reasonCodes,
    limitationHashes: fact.limitationHashes,
    reviewer,
    reviewedAt: fact.reviewedAt,
  };
}

function reviewFactSeed(
  fact: CanopyProofPublicDisclosureReviewFact,
  reviewer: CanopyProofVerificationActorSnapshot,
) {
  return {
    id: fact.id,
    ...reviewCommandSeed(fact, reviewer),
    commandHash: fact.commandHash,
    projectSequence: fact.projectSequence,
    previousEventRoot: fact.previousEventRoot,
    sourceEventRoots: fact.sourceEventRoots,
    sourceRoot: fact.sourceRoot,
  };
}

function publicationCommandSeed(
  fact: CanopyProofPublicTransparencyPublicationFact,
  publisher: CanopyProofVerificationActorSnapshot,
) {
  return {
    organizationId: fact.organizationId,
    projectId: fact.projectId,
    publicOrganizationId: fact.publicOrganizationId,
    publicProjectId: fact.publicProjectId,
    recordId: fact.recordId,
    recordRoot: fact.recordRoot,
    recordIssuedOn: fact.recordIssuedOn,
    lifecycleBindingId: fact.lifecycleBindingId,
    lifecycleBindingRoot: fact.lifecycleBindingRoot,
    lifecycleProjectionRoot: fact.lifecycleProjectionRoot,
    signatureReceiptId: fact.signatureReceiptId,
    signatureReceiptRoot: fact.signatureReceiptRoot,
    issuerAuthorityRoot: fact.issuerAuthorityRoot,
    assertionType: fact.assertionType,
    observationPeriod: fact.observationPeriod,
    validity: fact.validity,
    methodology: fact.methodology,
    location: fact.location,
    areaBand: fact.areaBand,
    evidence: fact.evidence,
    verification: fact.verification,
    monitoring: fact.monitoring,
    governance: fact.governance,
    confidenceBand: fact.confidenceBand,
    limitationCount: fact.limitationCount,
    limitationRoot: fact.limitationRoot,
    claimBoundary: fact.claimBoundary,
    reviewId: fact.reviewId,
    reviewRoot: fact.reviewRoot,
    publisher,
    publishedAt: fact.publishedAt,
  };
}

function publicationFactSeed(
  fact: CanopyProofPublicTransparencyPublicationFact,
  publisher: CanopyProofVerificationActorSnapshot,
) {
  return {
    id: fact.id,
    ...publicationCommandSeed(fact, publisher),
    commandHash: fact.commandHash,
    projectSequence: fact.projectSequence,
    previousEventRoot: fact.previousEventRoot,
    sourceEventRoots: fact.sourceEventRoots,
    sourceRoot: fact.sourceRoot,
  };
}

function normalizeActor(input: CanopyProofVerificationActorSnapshot) {
  const parsed = actorSchema.parse(input);
  const accreditationScope = canonicalStrings(parsed.accreditationScope);
  if (hashJson(accreditationScope) !== hashJson(parsed.accreditationScope)) {
    throw new Error("CanopyProof public transparency actor accreditation scope is non-canonical.");
  }
  const normalized = {
    id: parsed.id,
    participantType: parsed.participantType,
    role: parsed.role,
    verificationStatus: parsed.verificationStatus,
    organizationId: parsed.organizationId,
    organizationVerificationStatus: parsed.organizationVerificationStatus,
    participantRoot: parsed.participantRoot,
    organizationRoot: parsed.organizationRoot,
    ...(parsed.membershipId ? { membershipId: parsed.membershipId } : {}),
    ...(parsed.membershipStatus ? { membershipStatus: parsed.membershipStatus } : {}),
    ...(parsed.membershipRoot ? { membershipRoot: parsed.membershipRoot } : {}),
    ...(parsed.accreditationId ? { accreditationId: parsed.accreditationId } : {}),
    ...(parsed.accreditationStatus ? { accreditationStatus: parsed.accreditationStatus } : {}),
    ...(parsed.accreditationRoot ? { accreditationRoot: parsed.accreditationRoot } : {}),
    accreditationScope,
  };
  const authorityRoot = hashJson({ kind: "canopyproof-verification-actor-authority-v1", ...normalized });
  if (authorityRoot !== parsed.authorityRoot) {
    throw new Error("CanopyProof public transparency actor authority root is invalid.");
  }
  return { ...normalized, authorityRoot } as CanopyProofVerificationActorSnapshot;
}

function assertAccreditedHuman(
  actor: CanopyProofVerificationActorSnapshot,
  organizationId: string,
  scope: string,
  roles: readonly CanopyProofVerificationActorSnapshot["role"][],
) {
  if (
    actor.participantType !== "human" ||
    !roles.includes(actor.role) ||
    actor.organizationId !== organizationId ||
    actor.organizationVerificationStatus !== "verified" ||
    !actor.membershipId ||
    actor.membershipStatus !== "active" ||
    !actor.membershipRoot ||
    !actor.accreditationId ||
    actor.accreditationStatus !== "approved" ||
    !actor.accreditationRoot ||
    !actor.accreditationScope.includes(scope)
  ) {
    throw new Error("CanopyProof public transparency action requires an eligible accredited human.");
  }
}

function assertDisclosurePolicy(
  classification: CanopyProofPublicDisclosureClassification,
  locationDisclosure: CanopyProofPublicLocationDisclosure,
  areaDisclosure: CanopyProofPublicAreaDisclosure,
  reasonCodes: readonly CanopyProofPublicDisclosureReasonCode[],
) {
  if (classification !== "public" && locationDisclosure !== "withheld") {
    throw new Error("CanopyProof sensitive or restricted disclosure cannot expose a region identifier.");
  }
  if (classification === "restricted" && areaDisclosure !== "withheld") {
    throw new Error("CanopyProof restricted disclosure cannot expose an area band.");
  }
  if (locationDisclosure === "region" && !reasonCodes.includes("habitat_sensitivity_reviewed")) {
    throw new Error("CanopyProof region disclosure requires an explicit habitat-sensitivity review.");
  }
}

function publicTransparencySafetyBoundary(): CanopyProofPublicTransparencySafetyBoundary {
  return {
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
  };
}

function verifyAuditEvent(
  event: CanopyProofAuditEvent,
  payload: unknown,
  expected: Readonly<{
    action: CanopyProofAuditEvent["action"];
    actor: string;
    entityType: CanopyProofAuditEvent["entityType"];
    entityId: string;
    createdAt: string;
    rationale: string;
  }>,
) {
  const payloadHash = hashJson(payload);
  const eventSeed = {
    action: expected.action,
    actor: expected.actor,
    entityType: expected.entityType,
    entityId: expected.entityId,
    previousRoot: event.previousRoot,
    payloadHash,
    createdAt: expected.createdAt,
    rationale: expected.rationale,
  };
  const eventRoot = hashJson({ kind: "canopyproof-audit-event-v1", ...eventSeed });
  return (
    event.action === expected.action &&
    event.actor === expected.actor &&
    event.entityType === expected.entityType &&
    event.entityId === expected.entityId &&
    event.createdAt === expected.createdAt &&
    event.rationale === expected.rationale &&
    event.payloadHash === payloadHash &&
    event.eventRoot === eventRoot &&
    event.id === `cp_audit_${eventRoot.slice(0, 24)}`
  );
}

function factWithoutAuditEvent<T extends object>(fact: T) {
  const payload = { ...fact } as T & { auditEvent?: unknown };
  delete payload.auditEvent;
  return payload;
}

function assertReplayStreamPosition(
  fact: Pick<CanopyProofPublicDisclosureReviewFact, "projectSequence" | "previousEventRoot" | "auditEvent" | "reviewedAt"> |
    Pick<CanopyProofPublicTransparencyPublicationFact, "projectSequence" | "previousEventRoot" | "auditEvent" | "publishedAt">,
  events: readonly CanopyProofAuditEvent[],
) {
  const occurredAt = "reviewedAt" in fact ? fact.reviewedAt : fact.publishedAt;
  if (
    fact.projectSequence !== events.length + 1 ||
    fact.previousEventRoot !== (events.at(-1)?.eventRoot ?? canopyProofAuditGenesisRoot()) ||
    fact.auditEvent.previousRoot !== fact.previousEventRoot
  ) {
    throw new Error("CanopyProof public transparency snapshot stream lineage is invalid.");
  }
  assertMonotonicTime(events, occurredAt);
}

function assertPublicFactHasNoCoordinates(fact: CanopyProofPublicTransparencyPublicationFact) {
  const value = JSON.stringify({
    publicOrganizationId: fact.publicOrganizationId,
    publicProjectId: fact.publicProjectId,
    recordIssuedOn: fact.recordIssuedOn,
    assertionType: fact.assertionType,
    observationPeriod: fact.observationPeriod,
    methodology: fact.methodology,
    location: fact.location,
    areaBand: fact.areaBand,
    evidence: fact.evidence,
    verification: fact.verification,
    monitoring: fact.monitoring,
    governance: fact.governance,
    confidenceBand: fact.confidenceBand,
    limitationCount: fact.limitationCount,
    limitationRoot: fact.limitationRoot,
  });
  return !/latitude|longitude|coordinates|geometry|boundaryHash|accuracyMeters|contributorIds|evidenceIds|reviewer|rationale|detachedSignature|providerKeyId/i.test(value);
}

function assertPublicProjectionHasNoCoordinates(projection: CanopyProofPublicTransparencyProjection) {
  return !/latitude|longitude|coordinates|geometry|boundaryHash|accuracyMeters|contributorIds|evidenceIds|reviewer|rationale|detachedSignature|providerKeyId/i.test(
    JSON.stringify(projection),
  );
}

function areaBandFor(areaHectares: number): CanopyProofPublicAreaBand {
  if (!Number.isFinite(areaHectares) || areaHectares <= 0) {
    throw new Error("CanopyProof public transparency source area is invalid.");
  }
  if (areaHectares < 10) return "under_10_ha";
  if (areaHectares < 100) return "10_to_100_ha";
  if (areaHectares < 1_000) return "100_to_1000_ha";
  return "over_1000_ha";
}

function confidenceBandFor(score: number): CanopyProofPublicConfidenceBand {
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    throw new Error("CanopyProof public transparency source confidence score is invalid.");
  }
  if (score >= 85) return "high";
  if (score >= 65) return "moderate";
  return "limited";
}

function utcDay(value: string) {
  assertCanonicalTimestamp(value, "public transparency source timestamp");
  return value.slice(0, 10);
}

function rootFor(values: readonly string[], domain: string) {
  const normalized = canonicalHashes(values);
  return normalized.length > 0
    ? merkleRoot(normalized)
    : hashJson({ kind: `canopyproof-empty-public-${domain}-root-v1` });
}

function canonicalStrings(values: readonly string[]) {
  const normalized = values.map((value) => value.trim()).sort();
  if (normalized.some((value) => !value) || new Set(normalized).size !== normalized.length) {
    throw new Error("CanopyProof public transparency values must be non-empty and unique.");
  }
  return normalized;
}

function canonicalHashes(values: readonly string[]) {
  return canonicalStrings(values).map((value) => hashSchema.parse(value.toLowerCase()));
}

function assertCanonicalInput(actual: readonly string[], expected: readonly string[], label: string) {
  if (hashJson(actual) !== hashJson(expected)) {
    throw new Error(`CanopyProof public transparency ${label} must be sorted, normalized, and unique.`);
  }
}

function assertCanonicalTimestamp(value: string, label: string) {
  const parsed = timestampSchema.parse(value);
  if (new Date(parsed).toISOString() !== parsed) {
    throw new Error(`CanopyProof ${label} must be a canonical UTC timestamp.`);
  }
}

function assertMonotonicTime(events: readonly CanopyProofAuditEvent[], value: string) {
  assertCanonicalTimestamp(value, "public transparency event time");
  if (events.some((event) => Date.parse(event.createdAt) > Date.parse(value))) {
    throw new Error("CanopyProof public transparency event time cannot precede the project stream.");
  }
}

function projectStreamKey(organizationId: string, projectId: string) {
  return `${organizationId}\u0000${projectId}`;
}

function compareProjectFacts(
  left: Pick<CanopyProofPublicDisclosureReviewFact, "organizationId" | "projectId" | "projectSequence" | "id">,
  right: Pick<CanopyProofPublicDisclosureReviewFact, "organizationId" | "projectId" | "projectSequence" | "id">,
) {
  return (
    left.organizationId.localeCompare(right.organizationId) ||
    left.projectId.localeCompare(right.projectId) ||
    left.projectSequence - right.projectSequence ||
    left.id.localeCompare(right.id)
  );
}

function compareAuditEvents(left: CanopyProofAuditEvent, right: CanopyProofAuditEvent) {
  return left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id);
}
