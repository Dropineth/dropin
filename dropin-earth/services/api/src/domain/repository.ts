import { randomUUID } from "node:crypto";
import type {
  AuditLog,
  ChallengeCase,
  DropResult,
  EvidenceObject,
  ImpactCertificate,
  LotteryEntry,
  LotteryRound,
  Project,
  RandomnessCertificate,
} from "@dropin/schemas";
import { seedRegions, seedSpecies } from "@dropin/schemas";

export function nowIso() {
  return new Date().toISOString();
}

export function id(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export class InMemoryRepository {
  readonly regions = [...seedRegions];
  readonly species = [...seedSpecies];
  readonly rounds = new Map<string, LotteryRound>();
  readonly entries = new Map<string, LotteryEntry>();
  readonly randomnessCertificates = new Map<string, RandomnessCertificate>();
  readonly dropResults = new Map<string, DropResult>();
  readonly projects = new Map<string, Project>();
  readonly evidenceObjects = new Map<string, EvidenceObject>();
  readonly impactCertificates = new Map<string, ImpactCertificate>();
  readonly challenges = new Map<string, ChallengeCase>();
  readonly auditLogs: AuditLog[] = [];

  constructor() {
    const createdAt = nowIso();
    const round: LotteryRound = {
      id: "round_v1_ggw_demo",
      chain: "solana",
      regionId: "region_ggw_sahel",
      title: "Great Green Wall V1 Canary Round",
      status: "open",
      ticketPriceAmount: "1",
      ticketPriceSymbol: "USDC",
      prizePoolBps: 2500,
      treeFundBps: 5000,
      canopyDropBps: 700,
      rwaFragmentDropBps: 500,
      referralBps: 500,
      operationsBps: 500,
      challengePoolBps: 300,
      opensAt: createdAt,
      closesAt: new Date(Date.now() + 86_400_000).toISOString(),
      entryCount: 0,
      totalAmount: "0",
      createdAt,
      updatedAt: createdAt,
    };

    this.rounds.set(round.id, round);
  }

  addAuditLog(input: {
    actor: string;
    action: string;
    entityType: string;
    entityId: string;
    beforeState?: unknown;
    afterState?: unknown;
    requestId?: string;
  }) {
    const auditLog: AuditLog = {
      id: id("audit"),
      actor: input.actor,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      beforeState: input.beforeState,
      afterState: input.afterState,
      requestId: input.requestId,
      createdAt: nowIso(),
    };

    this.auditLogs.push(auditLog);
    return auditLog;
  }

  getEntriesForRound(roundId: string) {
    return [...this.entries.values()]
      .filter((entry) => entry.roundId === roundId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  getDropsForRound(roundId: string) {
    return [...this.dropResults.values()].filter((drop) => drop.roundId === roundId);
  }
}

export const repository = new InMemoryRepository();
