import { hashJson, merkleRoot } from "@dropin/crypto";
import { z } from "zod";
import { appendCanopyProofAuditEvent, type CanopyProofAuditEvent } from "./proof-engine.js";

export const canopyProofIdentityParticipantTypes = ["human", "agent", "organization", "device"] as const;
export const canopyProofIdentityVerificationStatuses = ["unverified", "pending", "verified", "suspended", "revoked"] as const;
export const canopyProofIdentityRoles = ["owner", "admin", "verifier", "researcher", "community", "observer", "agent"] as const;
export const canopyProofIdentityReputationSources = [
  "evidence_contribution",
  "human_review",
  "governance_review",
  "device_attestation",
  "challenge_outcome",
  "manual_adjustment",
] as const;

export type CanopyProofIdentityParticipantType = (typeof canopyProofIdentityParticipantTypes)[number];
export type CanopyProofIdentityVerificationStatus = (typeof canopyProofIdentityVerificationStatuses)[number];
export type CanopyProofIdentityRole = (typeof canopyProofIdentityRoles)[number];
export type CanopyProofIdentityReputationSource = (typeof canopyProofIdentityReputationSources)[number];

export type CanopyProofIdentityParticipant = {
  readonly id: string;
  readonly participantType: CanopyProofIdentityParticipantType;
  readonly displayName: string;
  readonly ownerId: string;
  readonly organizationId?: string;
  readonly roles: readonly CanopyProofIdentityRole[];
  readonly verificationStatus: CanopyProofIdentityVerificationStatus;
  readonly reputationScore: number;
  readonly credentialCommitments: readonly string[];
  readonly publicKeyHash?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly subjectHash: string;
  readonly auditHistory: readonly CanopyProofAuditEvent[];
};

export type CanopyProofIdentityReputationSnapshot = {
  readonly id: string;
  readonly participantId: string;
  readonly previousScore: number;
  readonly newScore: number;
  readonly source: CanopyProofIdentityReputationSource;
  readonly reason: string;
  readonly recordedBy: string;
  readonly recordedAt: string;
  readonly snapshotHash: string;
  readonly auditEvent: CanopyProofAuditEvent;
};

export type CanopyProofIdentityStatus = {
  readonly service: "canopyproof-identity";
  readonly participantCount: number;
  readonly reputationSnapshotCount: number;
  readonly verifiedParticipantCount: number;
  readonly revokedParticipantCount: number;
  readonly safety: {
    readonly anonymousSettlementGradeEvidenceBlocked: true;
    readonly credentialHistoryAppendOnly: true;
    readonly agentsCannotBeFinalAuthority: true;
    readonly reputationIsNonAuthoritative: true;
  };
  readonly identityRoot: string;
};

export type CanopyProofIdentityAuthoritySnapshot = {
  readonly participants: readonly CanopyProofIdentityParticipant[];
  readonly reputationSnapshots: readonly CanopyProofIdentityReputationSnapshot[];
};

const sha256Schema = z.string().regex(/^(sha256:)?[a-f0-9]{64}$/i);

const identityParticipantSchema = z
  .object({
    id: z.string().min(1).optional(),
    participantType: z.enum(canopyProofIdentityParticipantTypes),
    displayName: z.string().min(2).max(160),
    organizationId: z.string().min(1).optional(),
    roles: z.array(z.enum(canopyProofIdentityRoles)).min(1).default(["observer"]),
    verificationStatus: z.enum(canopyProofIdentityVerificationStatuses).default("pending"),
    reputationScore: z.number().int().min(0).max(100).default(50),
    credentialCommitments: z.array(sha256Schema).default([]),
    publicKeyHash: sha256Schema.optional(),
    createdAt: z.string().datetime().optional(),
  })
  .strict();

const reputationSnapshotSchema = z
  .object({
    newScore: z.number().int().min(0).max(100),
    source: z.enum(canopyProofIdentityReputationSources),
    reason: z.string().min(12).max(2_000),
    recordedAt: z.string().datetime().optional(),
  })
  .strict();

export class CanopyProofIdentityService {
  private readonly participantsById = new Map<string, CanopyProofIdentityParticipant>();
  private readonly reputationSnapshotsById = new Map<string, CanopyProofIdentityReputationSnapshot>();
  private readonly reputationSnapshotIdsByParticipantId = new Map<string, string[]>();

  static fromAuthoritySnapshot(snapshot: CanopyProofIdentityAuthoritySnapshot): CanopyProofIdentityService {
    const service = new CanopyProofIdentityService();
    for (const participant of snapshot.participants) {
      if (service.participantsById.has(participant.id)) {
        throw new Error(`CanopyProof identity snapshot contains duplicate participant: ${participant.id}`);
      }
      service.participantsById.set(participant.id, participant);
    }
    for (const reputationSnapshot of [...snapshot.reputationSnapshots].sort(
      (left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id),
    )) {
      if (!service.participantsById.has(reputationSnapshot.participantId)) {
        throw new Error(`CanopyProof identity snapshot references a missing participant: ${reputationSnapshot.participantId}`);
      }
      if (service.reputationSnapshotsById.has(reputationSnapshot.id)) {
        throw new Error(`CanopyProof identity snapshot contains duplicate reputation snapshot: ${reputationSnapshot.id}`);
      }
      service.reputationSnapshotsById.set(reputationSnapshot.id, reputationSnapshot);
      service.reputationSnapshotIdsByParticipantId.set(reputationSnapshot.participantId, [
        ...(service.reputationSnapshotIdsByParticipantId.get(reputationSnapshot.participantId) ?? []),
        reputationSnapshot.id,
      ]);
    }
    return service;
  }

  registerParticipant(input: unknown, ownerId: string): CanopyProofIdentityParticipant {
    assertAccountableActor(ownerId);
    const parsed = identityParticipantSchema.parse(input);
    assertSafeIdentityText([parsed.displayName, parsed.organizationId ?? ""]);
    const createdAt = parsed.createdAt ?? new Date(0).toISOString();
    const roles = [...new Set(parsed.roles)].sort();
    const credentialCommitments = [...new Set(parsed.credentialCommitments.map(normalizeHash))].sort();
    const subjectSeed = {
      participantType: parsed.participantType,
      displayName: parsed.displayName,
      ownerId,
      organizationId: parsed.organizationId,
      roles,
      verificationStatus: parsed.verificationStatus,
      reputationScore: parsed.reputationScore,
      credentialCommitments,
      publicKeyHash: parsed.publicKeyHash ? normalizeHash(parsed.publicKeyHash) : undefined,
      createdAt,
    };
    const subjectHash = hashJson({ kind: "canopyproof-identity-participant-v1", ...subjectSeed });
    const id = parsed.id ?? `cp_identity_${subjectHash.slice(0, 24)}`;
    const existing = this.participantsById.get(id);
    if (existing) {
      if (existing.subjectHash === subjectHash) {
        return existing;
      }
      throw new Error(`CanopyProof identity participant already exists with conflicting payload: ${id}`);
    }
    const auditHistory = appendCanopyProofAuditEvent([], {
      action: "ASSERT",
      actor: ownerId,
      entityType: "identity_participant",
      entityId: id,
      payload: subjectSeed,
      createdAt,
      rationale: "CanopyProof identity participant registered with accountable owner, roles, credential commitments, and initial reputation.",
    });
    const participant: CanopyProofIdentityParticipant = {
      id,
      participantType: parsed.participantType,
      displayName: parsed.displayName,
      ownerId,
      ...(parsed.organizationId ? { organizationId: parsed.organizationId } : {}),
      roles,
      verificationStatus: parsed.verificationStatus,
      reputationScore: parsed.reputationScore,
      credentialCommitments,
      ...(parsed.publicKeyHash ? { publicKeyHash: normalizeHash(parsed.publicKeyHash) } : {}),
      createdAt,
      updatedAt: createdAt,
      subjectHash,
      auditHistory,
    };
    this.participantsById.set(participant.id, participant);
    return participant;
  }

  listParticipants(filter: Readonly<{ participantType?: string; verificationStatus?: string; organizationId?: string }> = {}) {
    return [...this.participantsById.values()]
      .filter((participant) => !filter.participantType || participant.participantType === filter.participantType)
      .filter((participant) => !filter.verificationStatus || participant.verificationStatus === filter.verificationStatus)
      .filter((participant) => !filter.organizationId || participant.organizationId === filter.organizationId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
  }

  getParticipant(participantId: string) {
    const participant = this.participantsById.get(participantId);
    if (!participant) {
      throw new Error(`CanopyProof identity participant not found: ${participantId}`);
    }
    return participant;
  }

  recordReputationSnapshot(participantId: string, input: unknown, recordedBy: string): CanopyProofIdentityReputationSnapshot {
    assertAccountableActor(recordedBy);
    const participant = this.getParticipant(participantId);
    if (participant.verificationStatus === "revoked") {
      throw new Error(`CanopyProof identity participant is revoked: ${participantId}`);
    }
    const parsed = reputationSnapshotSchema.parse(input);
    assertSafeIdentityText([parsed.reason]);
    const recordedAt = parsed.recordedAt ?? new Date(0).toISOString();
    const snapshotSeed = {
      participantId,
      previousScore: participant.reputationScore,
      newScore: parsed.newScore,
      source: parsed.source,
      reason: parsed.reason,
      recordedBy,
      recordedAt,
    };
    const snapshotHash = hashJson({ kind: "canopyproof-identity-reputation-snapshot-v1", ...snapshotSeed });
    const id = `cp_identity_reputation_${snapshotHash.slice(0, 24)}`;
    const existing = this.reputationSnapshotsById.get(id);
    if (existing) {
      return existing;
    }
    const auditHistory = appendCanopyProofAuditEvent(participant.auditHistory, {
      action: parsed.newScore < participant.reputationScore ? "CHALLENGE" : "REASON",
      actor: recordedBy,
      entityType: "identity_reputation_snapshot",
      entityId: id,
      payload: snapshotSeed,
      createdAt: recordedAt,
      rationale: "CanopyProof identity reputation snapshot recorded as non-authoritative trust context for institutional review.",
    });
    const auditEvent = auditHistory.at(-1);
    if (!auditEvent) {
      throw new Error("CanopyProof identity reputation snapshot failed to append audit event.");
    }
    const snapshot: CanopyProofIdentityReputationSnapshot = {
      id,
      ...snapshotSeed,
      snapshotHash,
      auditEvent,
    };
    this.reputationSnapshotsById.set(snapshot.id, snapshot);
    this.reputationSnapshotIdsByParticipantId.set(participant.id, [
      ...(this.reputationSnapshotIdsByParticipantId.get(participant.id) ?? []),
      snapshot.id,
    ]);
    this.participantsById.set(participant.id, {
      ...participant,
      reputationScore: parsed.newScore,
      updatedAt: recordedAt,
      auditHistory,
    });
    return snapshot;
  }

  listReputationSnapshots(participantId?: string) {
    const snapshots = participantId
      ? (this.reputationSnapshotIdsByParticipantId.get(participantId) ?? []).map((id) => this.getReputationSnapshot(id))
      : [...this.reputationSnapshotsById.values()];
    return snapshots.sort((left, right) => right.recordedAt.localeCompare(left.recordedAt) || left.id.localeCompare(right.id));
  }

  getStatus(): CanopyProofIdentityStatus {
    const participants = [...this.participantsById.values()];
    const snapshots = [...this.reputationSnapshotsById.values()];
    return {
      service: "canopyproof-identity",
      participantCount: participants.length,
      reputationSnapshotCount: snapshots.length,
      verifiedParticipantCount: participants.filter((participant) => participant.verificationStatus === "verified").length,
      revokedParticipantCount: participants.filter((participant) => participant.verificationStatus === "revoked").length,
      safety: {
        anonymousSettlementGradeEvidenceBlocked: true,
        credentialHistoryAppendOnly: true,
        agentsCannotBeFinalAuthority: true,
        reputationIsNonAuthoritative: true,
      },
      identityRoot: hashJson({
        kind: "canopyproof-identity-status-v1",
        participantRoot: merkleRoot(participants.map((participant) => participant.subjectHash).sort()),
        reputationRoot: merkleRoot(snapshots.map((snapshot) => snapshot.snapshotHash).sort()),
      }),
    };
  }

  private getReputationSnapshot(snapshotId: string) {
    const snapshot = this.reputationSnapshotsById.get(snapshotId);
    if (!snapshot) {
      throw new Error(`CanopyProof identity reputation snapshot not found: ${snapshotId}`);
    }
    return snapshot;
  }
}

function normalizeHash(value: string) {
  return value.toLowerCase();
}

function assertAccountableActor(actorId: string) {
  if (!actorId || actorId.toLowerCase().includes("anonymous")) {
    throw new Error("CANOPYPROOF_RBAC_DENIED: accountable identity actor is required.");
  }
}

function assertSafeIdentityText(values: readonly string[]) {
  const unsafeClaims = [
    /certified carbon credit/i,
    /carbon[- ]?tax offset/i,
    /guaranteed yield/i,
    /automatic CANOPY distribution/i,
    /mainnet funds/i,
  ] as const;
  for (const value of values) {
    for (const pattern of unsafeClaims) {
      if (pattern.test(value) && !/\b(?:no|not|never|without|blocked|disallowed|prohibited)\b/i.test(value)) {
        throw new Error("CanopyProof identity text contains an unsupported public claim.");
      }
    }
  }
}
