import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofFundingSourceTypes = ["donor", "grant", "public_budget", "philanthropic_fund", "climate_fund"] as const;
export const canopyProofFundingAllocationStatuses = ["pledged", "allocated", "approved", "released", "reconciled", "challenged"] as const;
export const canopyProofFundingMilestoneStatuses = [
  "planned",
  "evidence_required",
  "ready_for_review",
  "settled",
  "challenged",
] as const;

export type CanopyProofFundingSourceType = (typeof canopyProofFundingSourceTypes)[number];
export type CanopyProofFundingAllocationStatus = (typeof canopyProofFundingAllocationStatuses)[number];
export type CanopyProofFundingMilestoneStatus = (typeof canopyProofFundingMilestoneStatuses)[number];

export type CanopyProofFundingClaimBoundary = {
  readonly transparencyOnly: true;
  readonly noMainnetFunds: true;
  readonly notPaymentRail: true;
  readonly notCarbonCredit: true;
  readonly notTaxOffset: true;
  readonly notGuaranteedYield: true;
  readonly notAutomaticCanopyDistribution: true;
  readonly disclosure: string;
};

export type CanopyProofFundingSource = {
  readonly id: string;
  readonly sourceType: CanopyProofFundingSourceType;
  readonly displayName: string;
  readonly jurisdiction: string;
  readonly commitmentUsd: string;
  readonly commitmentCents: number;
  readonly restriction: "unrestricted" | "project_restricted" | "milestone_restricted";
  readonly publicMemo: string;
  readonly pledgedAt: string;
  readonly createdBy: string;
  readonly sourceHash: string;
  readonly auditHistory: readonly CanopyProofAuditEvent[];
};

export type CanopyProofFundingAllocation = {
  readonly id: string;
  readonly sourceId: string;
  readonly projectId: string;
  readonly purpose: string;
  readonly amountUsd: string;
  readonly amountCents: number;
  readonly status: CanopyProofFundingAllocationStatus;
  readonly dropinAllocationId?: string;
  readonly externalReference?: string;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly allocationHash: string;
  readonly auditHistory: readonly CanopyProofAuditEvent[];
};

export type CanopyProofFundingEvidenceLink = {
  readonly id: string;
  readonly milestoneId: string;
  readonly evidenceId: string;
  readonly evidenceRoot: string;
  readonly reviewDecisionId?: string;
  readonly proofRecordId?: string;
  readonly note: string;
  readonly linkedAt: string;
  readonly linkedBy: string;
  readonly linkHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofFundingMilestone = {
  readonly id: string;
  readonly allocationId: string;
  readonly projectId: string;
  readonly title: string;
  readonly amountUsd: string;
  readonly amountCents: number;
  readonly dueAt: string;
  readonly evidenceRequirements: readonly string[];
  readonly status: CanopyProofFundingMilestoneStatus;
  readonly createdAt: string;
  readonly createdBy: string;
  readonly evidenceLinks: readonly CanopyProofFundingEvidenceLink[];
  readonly milestoneHash: string;
  readonly auditHistory: readonly CanopyProofAuditEvent[];
};

export type CanopyProofFundingLedger = {
  readonly projectId?: string;
  readonly generatedAt: string;
  readonly sources: readonly CanopyProofFundingSource[];
  readonly allocations: readonly CanopyProofFundingAllocation[];
  readonly milestones: readonly CanopyProofFundingMilestone[];
  readonly totals: {
    readonly committedUsd: string;
    readonly allocatedUsd: string;
    readonly settledUsd: string;
    readonly challengedUsd: string;
  };
  readonly lineage: {
    readonly sourceRoot: string;
    readonly allocationRoot: string;
    readonly milestoneRoot: string;
    readonly evidenceRoot: string;
    readonly auditRoot: string;
    readonly ledgerRoot: string;
  };
  readonly claimBoundary: CanopyProofFundingClaimBoundary;
};

const usdDecimalSchema = z
  .string()
  .regex(/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/, "USD amount must be a non-negative decimal string with at most two decimals.");

const fundingSourceSchema = z
  .object({
    id: z.string().min(1).optional(),
    sourceType: z.enum(canopyProofFundingSourceTypes),
    displayName: z.string().min(2),
    jurisdiction: z.string().min(1),
    commitmentUsd: usdDecimalSchema,
    restriction: z.enum(["unrestricted", "project_restricted", "milestone_restricted"]).default("project_restricted"),
    publicMemo: z.string().min(1).default("Environmental funding transparency record only."),
    pledgedAt: z.string().datetime().optional(),
  })
  .strict();

const fundingAllocationSchema = z
  .object({
    id: z.string().min(1).optional(),
    sourceId: z.string().min(1),
    projectId: z.string().min(1),
    purpose: z.string().min(3),
    amountUsd: usdDecimalSchema,
    status: z.enum(canopyProofFundingAllocationStatuses).default("pledged"),
    dropinAllocationId: z.string().min(1).optional(),
    externalReference: z.string().min(1).optional(),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

const fundingMilestoneSchema = z
  .object({
    id: z.string().min(1).optional(),
    allocationId: z.string().min(1),
    projectId: z.string().min(1),
    title: z.string().min(3),
    amountUsd: usdDecimalSchema,
    dueAt: z.string().datetime(),
    evidenceRequirements: z.array(z.string().min(1)).min(1),
    status: z.enum(canopyProofFundingMilestoneStatuses).default("evidence_required"),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

const fundingEvidenceLinkSchema = z
  .object({
    evidenceId: z.string().min(1),
    evidenceRoot: z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i),
    reviewDecisionId: z.string().min(1).optional(),
    proofRecordId: z.string().min(1).optional(),
    note: z.string().min(1).default("Evidence linked for funding transparency review."),
    linkedAt: z.string().datetime().optional(),
  })
  .strict();

const fundingMilestoneStatusSchema = z
  .object({
    status: z.enum(canopyProofFundingMilestoneStatuses),
    rationale: z.string().min(1),
    changedAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofFundingTransparencyService {
  private readonly sourcesById = new Map<string, CanopyProofFundingSource>();
  private readonly allocationsById = new Map<string, CanopyProofFundingAllocation>();
  private readonly milestonesById = new Map<string, CanopyProofFundingMilestone>();
  private readonly evidenceLinksById = new Map<string, CanopyProofFundingEvidenceLink>();

  registerFundingSource(input: unknown, actorId: string) {
    const parsed = fundingSourceSchema.parse(input);
    assertSafeFundingText([parsed.displayName, parsed.jurisdiction, parsed.publicMemo]);
    const pledgedAt = parsed.pledgedAt ?? new Date(0).toISOString();
    const commitmentCents = usdToCents(parsed.commitmentUsd);
    const sourceSeed = {
      sourceType: parsed.sourceType,
      displayName: parsed.displayName,
      jurisdiction: parsed.jurisdiction,
      commitmentUsd: centsToUsd(commitmentCents),
      restriction: parsed.restriction,
      publicMemo: parsed.publicMemo,
      pledgedAt,
    };
    const sourceHash = hashJson({ kind: "canopyproof-funding-source-v1", ...sourceSeed });
    const sourceId = parsed.id ?? `cp_funding_source_${sourceHash.slice(0, 24)}`;
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: actorId,
      entityType: "funding_source",
      entityId: sourceId,
      payload: sourceSeed,
      createdAt: pledgedAt,
      rationale: "Funding source registered for transparency-only environmental accountability.",
    });
    const source: CanopyProofFundingSource = {
      id: sourceId,
      ...sourceSeed,
      commitmentCents,
      createdBy: actorId,
      sourceHash,
      auditHistory,
    };
    this.sourcesById.set(source.id, source);
    return source;
  }

  createAllocation(input: unknown, actorId: string) {
    const parsed = fundingAllocationSchema.parse(input);
    const source = this.getFundingSource(parsed.sourceId);
    assertSafeFundingText([parsed.projectId, parsed.purpose, parsed.dropinAllocationId ?? "", parsed.externalReference ?? ""]);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const amountCents = usdToCents(parsed.amountUsd);
    const alreadyAllocated = sumCents(this.listAllocations().filter((allocation) => allocation.sourceId === source.id).map((allocation) => allocation.amountCents));
    if (alreadyAllocated + amountCents > source.commitmentCents) {
      throw new Error(`CanopyProof funding allocation exceeds source commitment: ${source.id}`);
    }
    const allocationSeed = {
      sourceId: source.id,
      projectId: parsed.projectId,
      purpose: parsed.purpose,
      amountUsd: centsToUsd(amountCents),
      status: parsed.status,
      dropinAllocationId: parsed.dropinAllocationId ?? null,
      externalReference: parsed.externalReference ?? null,
      createdAt,
      mode: "transparency_only",
    };
    const allocationHash = hashJson({ kind: "canopyproof-funding-allocation-v1", ...allocationSeed });
    const allocationId = parsed.id ?? `cp_funding_allocation_${allocationHash.slice(0, 24)}`;
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: parsed.status === "challenged" ? "CHALLENGE" : "DELEGATE",
      actor: actorId,
      entityType: "funding_allocation",
      entityId: allocationId,
      payload: allocationSeed,
      createdAt,
      rationale:
        "Funding allocation recorded as a transparency entry linked to project intent and optional existing Dropin fund allocation.",
    });
    const allocation: CanopyProofFundingAllocation = {
      id: allocationId,
      sourceId: source.id,
      projectId: parsed.projectId,
      purpose: parsed.purpose,
      amountUsd: centsToUsd(amountCents),
      amountCents,
      status: parsed.status,
      ...(parsed.dropinAllocationId ? { dropinAllocationId: parsed.dropinAllocationId } : {}),
      ...(parsed.externalReference ? { externalReference: parsed.externalReference } : {}),
      createdAt,
      createdBy: actorId,
      allocationHash,
      auditHistory,
    };
    this.allocationsById.set(allocation.id, allocation);
    return allocation;
  }

  recordMilestone(input: unknown, actorId: string) {
    const parsed = fundingMilestoneSchema.parse(input);
    const allocation = this.getAllocation(parsed.allocationId);
    if (allocation.projectId !== parsed.projectId) {
      throw new Error(`Funding milestone project ${parsed.projectId} does not match allocation project ${allocation.projectId}.`);
    }
    assertSafeFundingText([parsed.projectId, parsed.title, ...parsed.evidenceRequirements]);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const amountCents = usdToCents(parsed.amountUsd);
    const milestoneTotal = sumCents(
      this
        .listMilestones(allocation.projectId)
        .filter((milestone) => milestone.allocationId === allocation.id)
        .map((milestone) => milestone.amountCents),
    );
    if (milestoneTotal + amountCents > allocation.amountCents) {
      throw new Error(`CanopyProof funding milestones exceed allocation amount: ${allocation.id}`);
    }
    const milestoneSeed = {
      allocationId: allocation.id,
      projectId: parsed.projectId,
      title: parsed.title,
      amountUsd: centsToUsd(amountCents),
      dueAt: parsed.dueAt,
      evidenceRequirements: [...parsed.evidenceRequirements].sort(),
      status: parsed.status,
      createdAt,
    };
    const milestoneHash = hashJson({ kind: "canopyproof-funding-milestone-v1", ...milestoneSeed });
    const milestoneId = parsed.id ?? `cp_funding_milestone_${milestoneHash.slice(0, 24)}`;
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: "DELEGATE",
      actor: actorId,
      entityType: "funding_milestone",
      entityId: milestoneId,
      payload: milestoneSeed,
      createdAt,
      rationale: "Funding milestone recorded with explicit evidence requirements before public reconciliation.",
    });
    const milestone: CanopyProofFundingMilestone = {
      id: milestoneId,
      allocationId: allocation.id,
      projectId: parsed.projectId,
      title: parsed.title,
      amountUsd: centsToUsd(amountCents),
      amountCents,
      dueAt: parsed.dueAt,
      evidenceRequirements: milestoneSeed.evidenceRequirements,
      status: parsed.status,
      createdAt,
      createdBy: actorId,
      evidenceLinks: [],
      milestoneHash,
      auditHistory,
    };
    this.milestonesById.set(milestone.id, milestone);
    return milestone;
  }

  linkEvidenceToMilestone(milestoneId: string, input: unknown, actorId: string) {
    const milestone = this.getMilestone(milestoneId);
    const parsed = fundingEvidenceLinkSchema.parse(input);
    assertSafeFundingText([parsed.evidenceId, parsed.reviewDecisionId ?? "", parsed.proofRecordId ?? "", parsed.note]);
    const linkedAt = parsed.linkedAt ?? new Date(0).toISOString();
    const evidenceSeed = {
      milestoneId,
      evidenceId: parsed.evidenceId,
      evidenceRoot: parsed.evidenceRoot.toLowerCase(),
      reviewDecisionId: parsed.reviewDecisionId ?? null,
      proofRecordId: parsed.proofRecordId ?? null,
      note: parsed.note,
      linkedAt,
    };
    const linkHash = hashJson({ kind: "canopyproof-funding-evidence-link-v1", ...evidenceSeed });
    const linkId = `cp_funding_evidence_${linkHash.slice(0, 24)}`;
    const auditEvent = appendCanopyProofAuditEvent(milestone.auditHistory, {
      action: "ASSERT",
      actor: actorId,
      entityType: "funding_evidence_link",
      entityId: linkId,
      payload: evidenceSeed,
      createdAt: linkedAt,
      rationale: "Evidence linked to funding milestone for public reconciliation without issuing any financial or carbon-credit claim.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof funding evidence link failed to append audit event.");
    }
    const link: CanopyProofFundingEvidenceLink = {
      id: linkId,
      milestoneId,
      evidenceId: parsed.evidenceId,
      evidenceRoot: parsed.evidenceRoot.toLowerCase(),
      ...(parsed.reviewDecisionId ? { reviewDecisionId: parsed.reviewDecisionId } : {}),
      ...(parsed.proofRecordId ? { proofRecordId: parsed.proofRecordId } : {}),
      note: parsed.note,
      linkedAt,
      linkedBy: actorId,
      linkHash,
      auditEvent,
    };
    const updatedMilestone: CanopyProofFundingMilestone = {
      ...milestone,
      status: milestone.status === "planned" || milestone.status === "evidence_required" ? "ready_for_review" : milestone.status,
      evidenceLinks: [...milestone.evidenceLinks, link],
      auditHistory: [...milestone.auditHistory, auditEvent],
    };
    this.evidenceLinksById.set(link.id, link);
    this.milestonesById.set(updatedMilestone.id, updatedMilestone);
    return link;
  }

  updateMilestoneStatus(milestoneId: string, input: unknown, actorId: string) {
    const milestone = this.getMilestone(milestoneId);
    const parsed = fundingMilestoneStatusSchema.parse(input);
    if (
      parsed.status === "settled" &&
      !milestone.evidenceLinks.some((link) => Boolean(link.reviewDecisionId || link.proofRecordId))
    ) {
      throw new Error("CanopyProof funding milestone settlement requires accepted evidence linked to a review decision or proof record.");
    }
    assertSafeFundingText([parsed.rationale]);
    const changedAt = parsed.changedAt ?? new Date(0).toISOString();
    const auditEvent = appendCanopyProofAuditEvent(milestone.auditHistory, {
      action: parsed.status === "challenged" ? "CHALLENGE" : "FULFILL",
      actor: actorId,
      entityType: "funding_milestone",
      entityId: milestone.id,
      payload: {
        previousStatus: milestone.status,
        status: parsed.status,
        rationale: parsed.rationale,
      },
      createdAt: changedAt,
      rationale: "Funding milestone status changed under transparency ledger controls.",
    }).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof funding milestone update failed to append audit event.");
    }
    const updatedMilestone: CanopyProofFundingMilestone = {
      ...milestone,
      status: parsed.status,
      auditHistory: [...milestone.auditHistory, auditEvent],
    };
    this.milestonesById.set(updatedMilestone.id, updatedMilestone);
    this.reconcileAllocationAfterMilestoneChange(updatedMilestone.allocationId);
    return updatedMilestone;
  }

  listSources() {
    return [...this.sourcesById.values()].sort((left, right) => left.displayName.localeCompare(right.displayName));
  }

  listAllocations(projectId?: string) {
    const allocations = [...this.allocationsById.values()];
    return (projectId ? allocations.filter((allocation) => allocation.projectId === projectId) : allocations).sort((left, right) =>
      right.createdAt.localeCompare(left.createdAt),
    );
  }

  listMilestones(projectId?: string) {
    const milestones = [...this.milestonesById.values()];
    return (projectId ? milestones.filter((milestone) => milestone.projectId === projectId) : milestones).sort((left, right) =>
      left.dueAt.localeCompare(right.dueAt),
    );
  }

  getFundingSource(sourceId: string) {
    const source = this.sourcesById.get(sourceId);
    if (!source) {
      throw new Error(`CanopyProof funding source not found: ${sourceId}`);
    }
    return source;
  }

  getAllocation(allocationId: string) {
    const allocation = this.allocationsById.get(allocationId);
    if (!allocation) {
      throw new Error(`CanopyProof funding allocation not found: ${allocationId}`);
    }
    return allocation;
  }

  getMilestone(milestoneId: string) {
    const milestone = this.milestonesById.get(milestoneId);
    if (!milestone) {
      throw new Error(`CanopyProof funding milestone not found: ${milestoneId}`);
    }
    return milestone;
  }

  buildLedger(projectId?: string): CanopyProofFundingLedger {
    const allocations = this.listAllocations(projectId);
    const sourceIds = new Set(allocations.map((allocation) => allocation.sourceId));
    const milestones = this.listMilestones(projectId).filter((milestone) =>
      allocations.some((allocation) => allocation.id === milestone.allocationId),
    );
    const sources = this.listSources().filter((source) => !projectId || sourceIds.has(source.id));
    const evidenceLinks = milestones.flatMap((milestone) => milestone.evidenceLinks);
    const auditRoots = [
      ...sources.flatMap((source) => source.auditHistory.map((event) => event.eventRoot)),
      ...allocations.flatMap((allocation) => allocation.auditHistory.map((event) => event.eventRoot)),
      ...milestones.flatMap((milestone) => milestone.auditHistory.map((event) => event.eventRoot)),
    ];
    return {
      ...(projectId ? { projectId } : {}),
      generatedAt: new Date(0).toISOString(),
      sources,
      allocations,
      milestones,
      totals: {
        committedUsd: centsToUsd(sumCents(sources.map((source) => source.commitmentCents))),
        allocatedUsd: centsToUsd(sumCents(allocations.map((allocation) => allocation.amountCents))),
        settledUsd: centsToUsd(sumCents(milestones.filter((milestone) => milestone.status === "settled").map((milestone) => milestone.amountCents))),
        challengedUsd: centsToUsd(
          sumCents([
            ...allocations.filter((allocation) => allocation.status === "challenged").map((allocation) => allocation.amountCents),
            ...milestones.filter((milestone) => milestone.status === "challenged").map((milestone) => milestone.amountCents),
          ]),
        ),
      },
      lineage: {
        sourceRoot: hashRoot(sources.map((source) => source.sourceHash)),
        allocationRoot: hashRoot(allocations.map((allocation) => allocation.allocationHash)),
        milestoneRoot: hashRoot(milestones.map((milestone) => milestone.milestoneHash)),
        evidenceRoot: hashRoot(evidenceLinks.map((link) => link.evidenceRoot)),
        auditRoot: hashRoot(auditRoots),
        ledgerRoot: hashJson({
          kind: "canopyproof-funding-ledger-v1",
          projectId: projectId ?? null,
          sourceIds: sources.map((source) => source.id),
          allocationIds: allocations.map((allocation) => allocation.id),
          milestoneIds: milestones.map((milestone) => milestone.id),
          evidenceLinkIds: evidenceLinks.map((link) => link.id),
          auditRoots,
        }),
      },
      claimBoundary: canopyProofFundingClaimBoundary(),
    };
  }

  getStatus() {
    const ledger = this.buildLedger();
    return {
      service: "canopyproof-funding-transparency",
      mode: "transparency_only",
      sourceCount: this.sourcesById.size,
      allocationCount: this.allocationsById.size,
      milestoneCount: this.milestonesById.size,
      evidenceLinkCount: this.evidenceLinksById.size,
      totals: ledger.totals,
      sourceTypes: canopyProofFundingSourceTypes,
      allocationStatuses: canopyProofFundingAllocationStatuses,
      milestoneStatuses: canopyProofFundingMilestoneStatuses,
      claimBoundary: ledger.claimBoundary,
    };
  }

  private reconcileAllocationAfterMilestoneChange(allocationId: string) {
    const allocation = this.getAllocation(allocationId);
    const milestones = this.listMilestones(allocation.projectId).filter((milestone) => milestone.allocationId === allocationId);
    if (milestones.length === 0) {
      return;
    }
    const status: CanopyProofFundingAllocationStatus = milestones.some((milestone) => milestone.status === "challenged")
      ? "challenged"
      : milestones.every((milestone) => milestone.status === "settled")
        ? "reconciled"
        : allocation.status;
    if (status === allocation.status) {
      return;
    }
    const auditHistory = appendCanopyProofAuditEvent(allocation.auditHistory, {
      action: status === "challenged" ? "CHALLENGE" : "FULFILL",
      actor: "canopyproof-funding-ledger",
      entityType: "funding_allocation",
      entityId: allocation.id,
      payload: {
        previousStatus: allocation.status,
        status,
        milestoneIds: milestones.map((milestone) => milestone.id).sort(),
      },
      rationale: "Funding allocation status reconciled from milestone states.",
    });
    this.allocationsById.set(allocation.id, {
      ...allocation,
      status,
      auditHistory,
    });
  }
}

export function canopyProofFundingClaimBoundary(): CanopyProofFundingClaimBoundary {
  return {
    transparencyOnly: true,
    noMainnetFunds: true,
    notPaymentRail: true,
    notCarbonCredit: true,
    notTaxOffset: true,
    notGuaranteedYield: true,
    notAutomaticCanopyDistribution: true,
    disclosure:
      "CanopyProof funding records are transparency-only accountability entries. They do not move mainnet funds, distribute CANOPY, create carbon credits, offset taxes, or guarantee yield.",
  };
}

function usdToCents(amount: string) {
  const [dollarsRaw, centsRaw = ""] = amount.split(".");
  if (dollarsRaw === undefined) {
    throw new Error(`Invalid USD amount: ${amount}`);
  }
  const dollars = Number.parseInt(dollarsRaw, 10);
  const cents = Number.parseInt(centsRaw.padEnd(2, "0"), 10) || 0;
  if (!Number.isSafeInteger(dollars) || !Number.isSafeInteger(cents)) {
    throw new Error(`Invalid USD amount: ${amount}`);
  }
  return dollars * 100 + cents;
}

function centsToUsd(cents: number) {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new Error(`Invalid cent amount: ${cents}`);
  }
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return remainder === 0 ? String(dollars) : `${dollars}.${String(remainder).padStart(2, "0")}`;
}

function sumCents(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function hashRoot(values: readonly string[]) {
  return values.length > 0 ? merkleRoot([...values].sort()) : hashJson({ kind: "canopyproof-empty-root-v1" });
}

function assertSafeFundingText(values: readonly string[]) {
  const unsafePatterns = [
    /\bcertified\s+carbon\s+credit\b/i,
    /\bcarbon[-\s]?tax\s+offset\b/i,
    /\bguaranteed\s+(?:rwa\s+)?yield\b/i,
    /\bautomatic\s+(?:\$?canopy|canopy)\s+distribution\b/i,
    /\bmainnet\s+funds?\b/i,
    /\bprivate\s+key\b/i,
  ];
  for (const value of values) {
    if (!value) continue;
    for (const pattern of unsafePatterns) {
      if (pattern.test(value) && !/\b(no|not|never|without)\b/i.test(value)) {
        throw new Error(`CanopyProof funding input contains unsupported public claim: ${value}`);
      }
    }
  }
}
