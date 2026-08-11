import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofMemorySubjectTypes = [
  "project",
  "evidence",
  "ai_analysis",
  "human_review",
  "proof_record",
  "certificate",
  "terra_scene",
  "esg_report",
  "organization",
  "funding_allocation",
  "funding_milestone",
  "risk_alert",
  "agent_event",
  "governance_approval",
  "system",
] as const;

export const canopyProofMemoryScopes = ["public", "institutional", "restricted"] as const;
export const canopyProofMemoryRetentionClasses = ["operational", "institutional", "research", "legal_hold"] as const;

export type CanopyProofMemorySubjectType = (typeof canopyProofMemorySubjectTypes)[number];
export type CanopyProofMemoryScope = (typeof canopyProofMemoryScopes)[number];
export type CanopyProofMemoryRetentionClass = (typeof canopyProofMemoryRetentionClasses)[number];

export type CanopyProofMemoryRecord = {
  readonly id: string;
  readonly subjectType: CanopyProofMemorySubjectType;
  readonly subjectId: string;
  readonly projectId?: string;
  readonly organizationId?: string;
  readonly scope: CanopyProofMemoryScope;
  readonly retentionClass: CanopyProofMemoryRetentionClass;
  readonly summary: string;
  readonly tags: readonly string[];
  readonly sourceIds: readonly string[];
  readonly relatedRecordIds: readonly string[];
  readonly payloadHash: string;
  readonly sourceRoot: string;
  readonly memoryHash: string;
  readonly createdBy: string;
  readonly createdAt: string;
  readonly finalAuthority: false;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofMemoryRecall = {
  readonly service: "canopyproof-memory";
  readonly queryHash: string;
  readonly resultIds: readonly string[];
  readonly recallRoot: string;
  readonly generatedAt: string;
  readonly finalAuthority: false;
  readonly records: readonly CanopyProofMemoryRecord[];
};

export type CanopyProofMemoryStatus = {
  readonly service: "canopyproof-memory";
  readonly recordCount: number;
  readonly publicRecordCount: number;
  readonly restrictedRecordCount: number;
  readonly legalHoldRecordCount: number;
  readonly subjectTypes: readonly CanopyProofMemorySubjectType[];
  readonly scopes: readonly CanopyProofMemoryScope[];
  readonly retentionClasses: readonly CanopyProofMemoryRetentionClass[];
  readonly memoryRoot: string;
  readonly safety: {
    readonly appendOnly: true;
    readonly readModelOnly: true;
    readonly noAutonomousProofAuthority: true;
    readonly noUnsafeClimateClaims: true;
  };
};

const memoryRecordSchema = z
  .object({
    id: z.string().min(1).optional(),
    subjectType: z.enum(canopyProofMemorySubjectTypes),
    subjectId: z.string().min(1),
    projectId: z.string().min(1).optional(),
    organizationId: z.string().min(1).optional(),
    scope: z.enum(canopyProofMemoryScopes).default("institutional"),
    retentionClass: z.enum(canopyProofMemoryRetentionClasses).default("institutional"),
    summary: z.string().min(12).max(2_000),
    tags: z.array(z.string().min(1).max(64)).default([]),
    sourceIds: z.array(z.string().min(1)).min(1),
    relatedRecordIds: z.array(z.string().min(1)).default([]),
    payload: z.unknown().default({}),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

const memoryRecallSchema = z
  .object({
    subjectType: z.enum(canopyProofMemorySubjectTypes).optional(),
    subjectId: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    organizationId: z.string().min(1).optional(),
    scope: z.enum(canopyProofMemoryScopes).optional(),
    tags: z.array(z.string().min(1).max(64)).default([]),
    limit: z.number().int().min(1).max(100).default(25),
    generatedAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofMemoryService {
  private readonly recordsById = new Map<string, CanopyProofMemoryRecord>();

  recordMemory(input: unknown, actorId: string) {
    if (!actorId.trim()) {
      throw new Error("CanopyProof memory record requires an accountable actor.");
    }
    const parsed = memoryRecordSchema.parse(input);
    assertSafeMemoryText([parsed.subjectId, parsed.projectId, parsed.organizationId, parsed.summary, ...parsed.tags, ...parsed.sourceIds]);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const tags = [...new Set(parsed.tags.map((tag) => tag.trim().toLowerCase()))].sort();
    const sourceIds = [...new Set(parsed.sourceIds)].sort();
    const relatedRecordIds = [...new Set(parsed.relatedRecordIds)].sort();
    const payloadHash = hashJson(parsed.payload);
    const sourceRoot = merkleRoot([
      ...sourceIds.map((sourceId) => hashJson({ kind: "canopyproof-memory-source-v1", sourceId })),
      ...relatedRecordIds.map((recordId) => hashJson({ kind: "canopyproof-memory-related-record-v1", recordId })),
    ]);
    const memorySeed = {
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      projectId: parsed.projectId,
      organizationId: parsed.organizationId,
      scope: parsed.scope,
      retentionClass: parsed.retentionClass,
      summary: parsed.summary,
      tags,
      sourceIds,
      relatedRecordIds,
      payloadHash,
      sourceRoot,
      createdBy: actorId,
      createdAt,
      finalAuthority: false,
    };
    const memoryHash = hashJson({ kind: "canopyproof-memory-record-v1", ...memorySeed });
    const id = parsed.id ?? `cp_memory_${memoryHash.slice(0, 24)}`;
    const existing = this.recordsById.get(id);
    if (existing) {
      if (existing.memoryHash === memoryHash) {
        return existing;
      }
      throw new Error(`CanopyProof memory record already exists with conflicting payload: ${id}`);
    }
    const auditEvent = appendCanopyProofAuditEvent(
      this.listRecords({ subjectType: parsed.subjectType, subjectId: parsed.subjectId }).map((record) => record.auditEvent),
      {
        action: "ASSERT",
        actor: actorId,
        entityType: "memory_record",
        entityId: id,
        payload: memorySeed,
        createdAt,
        rationale: "CanopyProof memory record appended as a read-model trace for institutional recall.",
      },
    ).at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof memory record failed to append audit event.");
    }
    const record: CanopyProofMemoryRecord = {
      id,
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
      ...(parsed.organizationId ? { organizationId: parsed.organizationId } : {}),
      scope: parsed.scope,
      retentionClass: parsed.retentionClass,
      summary: parsed.summary,
      tags,
      sourceIds,
      relatedRecordIds,
      payloadHash,
      sourceRoot,
      memoryHash,
      createdBy: actorId,
      createdAt,
      finalAuthority: false,
      auditEvent,
    };
    this.recordsById.set(record.id, record);
    return record;
  }

  listRecords(filter: Readonly<{
    subjectType?: string;
    subjectId?: string;
    projectId?: string;
    organizationId?: string;
    scope?: string;
    tag?: string;
  }> = {}) {
    return [...this.recordsById.values()]
      .filter((record) => !filter.subjectType || record.subjectType === filter.subjectType)
      .filter((record) => !filter.subjectId || record.subjectId === filter.subjectId)
      .filter((record) => !filter.projectId || record.projectId === filter.projectId)
      .filter((record) => !filter.organizationId || record.organizationId === filter.organizationId)
      .filter((record) => !filter.scope || record.scope === filter.scope)
      .filter((record) => !filter.tag || record.tags.includes(filter.tag.trim().toLowerCase()))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.id.localeCompare(right.id));
  }

  getRecord(recordId: string) {
    const record = this.recordsById.get(recordId);
    if (!record) {
      throw new Error(`CanopyProof memory record not found: ${recordId}`);
    }
    return record;
  }

  recall(input: unknown): CanopyProofMemoryRecall {
    const parsed = memoryRecallSchema.parse(input);
    const tagSet = new Set(parsed.tags.map((tag) => tag.trim().toLowerCase()));
    const records = this.listRecords({
      ...(parsed.subjectType ? { subjectType: parsed.subjectType } : {}),
      ...(parsed.subjectId ? { subjectId: parsed.subjectId } : {}),
      ...(parsed.projectId ? { projectId: parsed.projectId } : {}),
      ...(parsed.organizationId ? { organizationId: parsed.organizationId } : {}),
      ...(parsed.scope ? { scope: parsed.scope } : {}),
    })
      .filter((record) => tagSet.size === 0 || record.tags.some((tag) => tagSet.has(tag)))
      .slice(0, parsed.limit);
    const query = {
      subjectType: parsed.subjectType,
      subjectId: parsed.subjectId,
      projectId: parsed.projectId,
      organizationId: parsed.organizationId,
      scope: parsed.scope,
      tags: [...tagSet].sort(),
      limit: parsed.limit,
    };
    const resultIds = records.map((record) => record.id);
    return {
      service: "canopyproof-memory",
      queryHash: hashJson({ kind: "canopyproof-memory-query-v1", ...query }),
      resultIds,
      recallRoot: resultIds.length > 0 ? merkleRoot(records.map((record) => record.memoryHash).sort()) : emptyMemoryRoot(),
      generatedAt: parsed.generatedAt ?? new Date(0).toISOString(),
      finalAuthority: false,
      records,
    };
  }

  getStatus(): CanopyProofMemoryStatus {
    const records = this.listRecords();
    return {
      service: "canopyproof-memory",
      recordCount: records.length,
      publicRecordCount: records.filter((record) => record.scope === "public").length,
      restrictedRecordCount: records.filter((record) => record.scope === "restricted").length,
      legalHoldRecordCount: records.filter((record) => record.retentionClass === "legal_hold").length,
      subjectTypes: canopyProofMemorySubjectTypes,
      scopes: canopyProofMemoryScopes,
      retentionClasses: canopyProofMemoryRetentionClasses,
      memoryRoot: records.length > 0 ? merkleRoot(records.map((record) => record.memoryHash).sort()) : emptyMemoryRoot(),
      safety: {
        appendOnly: true,
        readModelOnly: true,
        noAutonomousProofAuthority: true,
        noUnsafeClimateClaims: true,
      },
    };
  }
}

function emptyMemoryRoot() {
  return hashJson({ kind: "canopyproof-empty-memory-root-v1" });
}

function assertSafeMemoryText(values: readonly (string | undefined)[]) {
  const unsafe = /(certified carbon credit|carbon[- ]?tax offset|guaranteed yield|automatic canopy distribution|mainnet funds|private key)/i;
  for (const value of values) {
    if (value && unsafe.test(value)) {
      throw new Error("CanopyProof memory text contains an unsupported public claim.");
    }
  }
}
