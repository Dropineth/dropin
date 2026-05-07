import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  AuditLog,
  ChallengeBond,
  ChallengeCase,
  ChallengeEvidence,
  ChallengeResolution,
  RiskEvent,
  RiskScoreResult,
  RiskScoreSnapshot,
} from "@dropin/schemas";
import type { AuditInput } from "../lottery/lottery-repository.js";

export type CreateRiskEventInput = Omit<RiskEvent, "id" | "createdAt" | "resolvedAt">;
export type CreateRiskScoreSnapshotInput = Omit<RiskScoreSnapshot, "id" | "createdAt">;
export type CreateChallengeInput = Omit<ChallengeCase, "id" | "createdAt" | "updatedAt">;
export type CreateChallengeBondInput = Omit<ChallengeBond, "id" | "lockedAt" | "resolvedAt">;
export type CreateChallengeEvidenceInput = Omit<ChallengeEvidence, "id" | "createdAt">;
export type CreateChallengeResolutionInput = Omit<ChallengeResolution, "id" | "createdAt">;

export interface RiskRepository {
  makeId(prefix: string): string;
  now(): string;
  createRiskScoreSnapshot(input: CreateRiskScoreSnapshotInput): Promise<RiskScoreSnapshot>;
  createRiskEvent(input: CreateRiskEventInput): Promise<RiskEvent>;
  listRiskEvents(): Promise<RiskEvent[]>;
  getRiskEvent(riskEventId: string): Promise<RiskEvent | undefined>;
  resolveRiskEvent(
    riskEventId: string,
    input: Pick<RiskEvent, "status" | "resolution">,
  ): Promise<RiskEvent>;
  createChallenge(input: CreateChallengeInput): Promise<ChallengeCase>;
  updateChallenge(challenge: ChallengeCase): Promise<ChallengeCase>;
  getChallenge(challengeId: string): Promise<ChallengeCase | undefined>;
  listChallenges(): Promise<ChallengeCase[]>;
  createChallengeBond(input: CreateChallengeBondInput): Promise<ChallengeBond>;
  createChallengeEvidence(input: CreateChallengeEvidenceInput): Promise<ChallengeEvidence>;
  listChallengeEvidence(challengeId: string): Promise<ChallengeEvidence[]>;
  createChallengeResolution(input: CreateChallengeResolutionInput): Promise<ChallengeResolution>;
  listChallengeResolutions(challengeId: string): Promise<ChallengeResolution[]>;
  createAuditLog(input: AuditInput): Promise<AuditLog>;
  listAuditLogs(): Promise<AuditLog[]>;
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export class InMemoryRiskRepository implements RiskRepository {
  readonly riskEvents = new Map<string, RiskEvent>();
  readonly riskSnapshots = new Map<string, RiskScoreSnapshot>();
  readonly challenges = new Map<string, ChallengeCase>();
  readonly bonds = new Map<string, ChallengeBond>();
  readonly challengeEvidence = new Map<string, ChallengeEvidence>();
  readonly challengeResolutions = new Map<string, ChallengeResolution>();
  readonly auditLogs: AuditLog[] = [];

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createRiskScoreSnapshot(input: CreateRiskScoreSnapshotInput) {
    const snapshot: RiskScoreSnapshot = {
      ...input,
      id: this.makeId("risk_score"),
      createdAt: this.now(),
    };
    this.riskSnapshots.set(snapshot.id, snapshot);
    return snapshot;
  }

  async createRiskEvent(input: CreateRiskEventInput) {
    const event: RiskEvent = {
      ...input,
      id: this.makeId("risk_event"),
      createdAt: this.now(),
    };
    this.riskEvents.set(event.id, event);
    return event;
  }

  async listRiskEvents() {
    return [...this.riskEvents.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getRiskEvent(riskEventId: string) {
    return this.riskEvents.get(riskEventId);
  }

  async resolveRiskEvent(riskEventId: string, input: Pick<RiskEvent, "status" | "resolution">) {
    const event = this.riskEvents.get(riskEventId);
    if (!event) {
      throw new Error(`Risk event not found: ${riskEventId}`);
    }
    const resolved: RiskEvent = {
      ...event,
      status: input.status,
      resolution: input.resolution,
      resolvedAt: this.now(),
    };
    this.riskEvents.set(riskEventId, resolved);
    return resolved;
  }

  async createChallenge(input: CreateChallengeInput) {
    const now = this.now();
    const challenge: ChallengeCase = {
      ...input,
      id: this.makeId("challenge"),
      createdAt: now,
      updatedAt: now,
    };
    this.challenges.set(challenge.id, challenge);
    return challenge;
  }

  async updateChallenge(challenge: ChallengeCase) {
    const updated: ChallengeCase = {
      ...challenge,
      updatedAt: this.now(),
    };
    this.challenges.set(challenge.id, updated);
    return updated;
  }

  async getChallenge(challengeId: string) {
    return this.challenges.get(challengeId);
  }

  async listChallenges() {
    return [...this.challenges.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createChallengeBond(input: CreateChallengeBondInput) {
    const bond: ChallengeBond = {
      ...input,
      id: this.makeId("challenge_bond"),
      lockedAt: this.now(),
    };
    this.bonds.set(bond.id, bond);
    return bond;
  }

  async createChallengeEvidence(input: CreateChallengeEvidenceInput) {
    const evidence: ChallengeEvidence = {
      ...input,
      id: this.makeId("challenge_evidence"),
      createdAt: this.now(),
    };
    this.challengeEvidence.set(evidence.id, evidence);
    return evidence;
  }

  async listChallengeEvidence(challengeId: string) {
    return [...this.challengeEvidence.values()]
      .filter((evidence) => evidence.challengeId === challengeId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async createChallengeResolution(input: CreateChallengeResolutionInput) {
    const resolution: ChallengeResolution = {
      ...input,
      id: this.makeId("challenge_resolution"),
      createdAt: this.now(),
    };
    this.challengeResolutions.set(resolution.id, resolution);
    return resolution;
  }

  async listChallengeResolutions(challengeId: string) {
    return [...this.challengeResolutions.values()]
      .filter((resolution) => resolution.challengeId === challengeId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  async createAuditLog(input: AuditInput) {
    const auditLog: AuditLog = {
      id: this.makeId("audit"),
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      requestId: input.requestId,
      createdAt: this.now(),
    };
    this.auditLogs.push(auditLog);
    return auditLog;
  }

  async listAuditLogs() {
    return [...this.auditLogs].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}

export class PrismaRiskRepository implements RiskRepository {
  constructor(readonly prisma: PrismaClient) {}

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createRiskScoreSnapshot(input: CreateRiskScoreSnapshotInput) {
    const created = await this.prisma.riskScoreSnapshot.create({
      data: {
        id: this.makeId("risk_score"),
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        wallet: input.wallet ?? null,
        userId: input.userId ?? null,
        score: input.score,
        riskLevel: input.riskLevel,
        recommendedAction: input.recommendedAction,
        reasons: input.reasons,
        input: jsonValue(input.input),
      },
    });
    return toRiskScoreSnapshot(created);
  }

  async createRiskEvent(input: CreateRiskEventInput) {
    const created = await this.prisma.riskEvent.create({
      data: {
        id: this.makeId("risk_event"),
        subjectType: input.subjectType,
        subjectId: input.subjectId,
        riskLevel: input.riskLevel,
        score: input.score,
        recommendedAction: input.recommendedAction,
        reasonCodes: input.reasonCodes,
        status: input.status,
        resolution: input.resolution ?? null,
      },
    });
    return toRiskEvent(created);
  }

  async listRiskEvents() {
    const events = await this.prisma.riskEvent.findMany({ orderBy: { createdAt: "desc" } });
    return events.map(toRiskEvent);
  }

  async getRiskEvent(riskEventId: string) {
    const event = await this.prisma.riskEvent.findUnique({ where: { id: riskEventId } });
    return event ? toRiskEvent(event) : undefined;
  }

  async resolveRiskEvent(riskEventId: string, input: Pick<RiskEvent, "status" | "resolution">) {
    const updated = await this.prisma.riskEvent.update({
      where: { id: riskEventId },
      data: {
        status: input.status,
        resolution: input.resolution ?? null,
        resolvedAt: new Date(),
      },
    });
    return toRiskEvent(updated);
  }

  async createChallenge(input: CreateChallengeInput) {
    const created = await this.prisma.challengeCase.create({
      data: {
        id: this.makeId("challenge"),
        targetType: input.targetType,
        targetId: input.targetId,
        challenger: input.challenger,
        severity: input.severity,
        title: input.title,
        attackScenario: input.attackScenario,
        evidenceHash: input.evidenceHash,
        bondAmount: input.bondAmount,
        status: input.status,
        result: input.result,
        rewardAmount: input.rewardAmount,
        protocolFix: input.protocolFix ?? null,
      },
    });
    return toChallenge(created);
  }

  async updateChallenge(challenge: ChallengeCase) {
    const updated = await this.prisma.challengeCase.update({
      where: { id: challenge.id },
      data: {
        status: challenge.status,
        result: challenge.result,
        rewardAmount: challenge.rewardAmount,
        protocolFix: challenge.protocolFix ?? null,
      },
    });
    return toChallenge(updated);
  }

  async getChallenge(challengeId: string) {
    const challenge = await this.prisma.challengeCase.findUnique({ where: { id: challengeId } });
    return challenge ? toChallenge(challenge) : undefined;
  }

  async listChallenges() {
    const challenges = await this.prisma.challengeCase.findMany({ orderBy: { createdAt: "desc" } });
    return challenges.map(toChallenge);
  }

  async createChallengeBond(input: CreateChallengeBondInput) {
    const created = await this.prisma.challengeBond.create({
      data: {
        id: this.makeId("challenge_bond"),
        challengeId: input.challengeId,
        challengerUserId: input.challengerUserId,
        amount: input.amount,
        currency: input.currency,
        status: input.status,
        slashReason: input.slashReason ?? null,
        rewardReason: input.rewardReason ?? null,
      },
    });
    return toChallengeBond(created);
  }

  async createChallengeEvidence(input: CreateChallengeEvidenceInput) {
    const created = await this.prisma.challengeEvidence.create({
      data: {
        id: this.makeId("challenge_evidence"),
        challengeId: input.challengeId,
        uri: input.uri,
        evidenceHash: input.evidenceHash,
        submittedBy: input.submittedBy,
      },
    });
    return toChallengeEvidence(created);
  }

  async listChallengeEvidence(challengeId: string) {
    const evidence = await this.prisma.challengeEvidence.findMany({
      where: { challengeId },
      orderBy: { createdAt: "asc" },
    });
    return evidence.map(toChallengeEvidence);
  }

  async createChallengeResolution(input: CreateChallengeResolutionInput) {
    const created = await this.prisma.challengeResolution.create({
      data: {
        id: this.makeId("challenge_resolution"),
        challengeId: input.challengeId,
        resolver: input.resolver,
        action: input.action,
        outcome: input.outcome,
        notes: input.notes ?? null,
      },
    });
    return toChallengeResolution(created);
  }

  async listChallengeResolutions(challengeId: string) {
    const resolutions = await this.prisma.challengeResolution.findMany({
      where: { challengeId },
      orderBy: { createdAt: "asc" },
    });
    return resolutions.map(toChallengeResolution);
  }

  async createAuditLog(input: AuditInput) {
    const created = await this.prisma.auditLog.create({
      data: {
        id: this.makeId("audit"),
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState === undefined ? null : JSON.parse(JSON.stringify(input.beforeState)),
        afterState: input.afterState === undefined ? null : JSON.parse(JSON.stringify(input.afterState)),
        requestId: input.requestId ?? null,
      },
    });
    return toAuditLog(created);
  }

  async listAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } });
    return logs.map(toAuditLog);
  }
}

type PrismaRiskEvent = Awaited<ReturnType<PrismaClient["riskEvent"]["findFirst"]>>;
type PrismaRiskScoreSnapshot = Awaited<ReturnType<PrismaClient["riskScoreSnapshot"]["findFirst"]>>;
type PrismaChallenge = Awaited<ReturnType<PrismaClient["challengeCase"]["findFirst"]>>;
type PrismaChallengeBond = Awaited<ReturnType<PrismaClient["challengeBond"]["findFirst"]>>;
type PrismaChallengeEvidence = Awaited<ReturnType<PrismaClient["challengeEvidence"]["findFirst"]>>;
type PrismaChallengeResolution = Awaited<ReturnType<PrismaClient["challengeResolution"]["findFirst"]>>;
type PrismaAuditLog = Awaited<ReturnType<PrismaClient["auditLog"]["findFirst"]>>;

function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function toRiskEvent(event: NonNullable<PrismaRiskEvent>): RiskEvent {
  return {
    id: event.id,
    subjectType: event.subjectType,
    subjectId: event.subjectId,
    riskLevel: event.riskLevel as RiskEvent["riskLevel"],
    score: Number(event.score),
    recommendedAction: event.recommendedAction as RiskEvent["recommendedAction"],
    reasonCodes: stringArray(event.reasonCodes),
    status: event.status as RiskEvent["status"],
    resolution: event.resolution ?? undefined,
    createdAt: event.createdAt.toISOString(),
    resolvedAt: event.resolvedAt?.toISOString(),
  };
}

function toRiskScoreSnapshot(snapshot: NonNullable<PrismaRiskScoreSnapshot>): RiskScoreSnapshot {
  return {
    id: snapshot.id,
    subjectType: snapshot.subjectType,
    subjectId: snapshot.subjectId,
    wallet: snapshot.wallet ?? undefined,
    userId: snapshot.userId ?? undefined,
    score: Number(snapshot.score),
    riskLevel: snapshot.riskLevel as RiskScoreResult["riskLevel"],
    recommendedAction: snapshot.recommendedAction as RiskScoreResult["recommendedAction"],
    reasons: stringArray(snapshot.reasons),
    input: snapshot.input,
    createdAt: snapshot.createdAt.toISOString(),
  };
}

function toChallenge(challenge: NonNullable<PrismaChallenge>): ChallengeCase {
  return {
    id: challenge.id,
    targetType: challenge.targetType as ChallengeCase["targetType"],
    targetId: challenge.targetId,
    challenger: challenge.challenger,
    severity: challenge.severity as ChallengeCase["severity"],
    title: challenge.title,
    attackScenario: challenge.attackScenario,
    evidenceHash: challenge.evidenceHash,
    bondAmount: challenge.bondAmount.toString(),
    status: challenge.status as ChallengeCase["status"],
    result: challenge.result as ChallengeCase["result"],
    rewardAmount: challenge.rewardAmount.toString(),
    protocolFix: challenge.protocolFix ?? undefined,
    createdAt: challenge.createdAt.toISOString(),
    updatedAt: challenge.updatedAt.toISOString(),
  };
}

function toChallengeBond(bond: NonNullable<PrismaChallengeBond>): ChallengeBond {
  return {
    id: bond.id,
    challengeId: bond.challengeId,
    challengerUserId: bond.challengerUserId,
    amount: bond.amount.toString(),
    currency: bond.currency as ChallengeBond["currency"],
    status: bond.status as ChallengeBond["status"],
    slashReason: bond.slashReason ?? undefined,
    rewardReason: bond.rewardReason ?? undefined,
    lockedAt: bond.lockedAt.toISOString(),
    resolvedAt: bond.resolvedAt?.toISOString(),
  };
}

function toChallengeEvidence(evidence: NonNullable<PrismaChallengeEvidence>): ChallengeEvidence {
  return {
    id: evidence.id,
    challengeId: evidence.challengeId,
    uri: evidence.uri,
    evidenceHash: evidence.evidenceHash,
    submittedBy: evidence.submittedBy,
    createdAt: evidence.createdAt.toISOString(),
  };
}

function toChallengeResolution(resolution: NonNullable<PrismaChallengeResolution>): ChallengeResolution {
  return {
    id: resolution.id,
    challengeId: resolution.challengeId,
    resolver: resolution.resolver,
    action: resolution.action as ChallengeResolution["action"],
    outcome: resolution.outcome as ChallengeResolution["outcome"],
    notes: resolution.notes ?? undefined,
    createdAt: resolution.createdAt.toISOString(),
  };
}

function toAuditLog(log: NonNullable<PrismaAuditLog>): AuditLog {
  return {
    id: log.id,
    actor: log.actor,
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    beforeState: log.beforeState,
    afterState: log.afterState,
    requestId: log.requestId ?? undefined,
    createdAt: log.createdAt.toISOString(),
  };
}
