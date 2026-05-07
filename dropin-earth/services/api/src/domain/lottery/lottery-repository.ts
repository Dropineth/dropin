import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { hashJson } from "@dropin/crypto";
import type {
  AuditLog,
  DropResult,
  LotteryEntry,
  LotteryRound,
  LotteryTicket,
  RandomnessCertificate,
  Region,
  RwaFragment,
  Species,
  WinnerResult,
} from "@dropin/schemas";
import { seedRegions, seedSpecies } from "@dropin/schemas";
import { computeTicket } from "./lottery-engine.js";

export type RwaFragmentRecord = RwaFragment & {
  sourceDropResultId?: string | undefined;
  rarity?: DropResult["rarity"] | undefined;
};

export type LotteryRoundDetail = {
  round: LotteryRound;
  entries: LotteryEntry[];
  tickets: LotteryTicket[];
  randomnessCertificate?: RandomnessCertificate | undefined;
  winners: WinnerResult[];
  drops: DropResult[];
  rwaFragments: RwaFragmentRecord[];
};

export type AuditInput = {
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  beforeState?: unknown;
  afterState?: unknown;
  requestId?: string;
};

export type CreateEntryInput = Omit<LotteryEntry, "id" | "createdAt"> & {
  idempotencyKey?: string | undefined;
};

export interface LotteryRepository {
  makeId(prefix: string): string;
  now(): string;
  listRegions(): Promise<Region[]>;
  listSpecies(regionId?: string): Promise<Species[]>;
  listRounds(): Promise<LotteryRound[]>;
  getRound(roundId: string): Promise<LotteryRound | undefined>;
  getRoundDetail(roundId: string): Promise<LotteryRoundDetail | undefined>;
  getEntryByIdempotencyKey(roundId: string, idempotencyKey: string): Promise<LotteryEntry | undefined>;
  listEntriesForRound(roundId: string): Promise<LotteryEntry[]>;
  createEntryAndTicket(input: CreateEntryInput): Promise<{ entry: LotteryEntry; ticket: LotteryTicket }>;
  updateRound(round: LotteryRound): Promise<LotteryRound>;
  createAuditLog(input: AuditInput): Promise<AuditLog>;
  listAuditLogs(): Promise<AuditLog[]>;
  saveFinalization(input: {
    round: LotteryRound;
    certificate: RandomnessCertificate;
    winners: WinnerResult[];
    drops: DropResult[];
    rwaFragments: RwaFragmentRecord[];
  }): Promise<void>;
  getDrop(dropId: string): Promise<DropResult | undefined>;
  getRwaFragment(fragmentId: string): Promise<RwaFragmentRecord | undefined>;
  updateRoundStatus(roundId: string, status: LotteryRound["status"]): Promise<LotteryRound>;
  updateRwaFragmentStatus(fragmentId: string, status: RwaFragment["status"]): Promise<RwaFragmentRecord>;
  listTicketsForUser(userId: string): Promise<LotteryTicket[]>;
  listDropsForUser(userId: string): Promise<DropResult[]>;
  listRwaFragmentsForUser(userId: string): Promise<RwaFragmentRecord[]>;
}

export function nowIso() {
  return new Date().toISOString();
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export class InMemoryLotteryRepository implements LotteryRepository {
  readonly regions = [...seedRegions];
  readonly species = [...seedSpecies];
  readonly rounds = new Map<string, LotteryRound>();
  readonly entries = new Map<string, LotteryEntry>();
  readonly tickets = new Map<string, LotteryTicket>();
  readonly certificates = new Map<string, RandomnessCertificate>();
  readonly winners = new Map<string, WinnerResult>();
  readonly drops = new Map<string, DropResult>();
  readonly rwaFragments = new Map<string, RwaFragmentRecord>();
  readonly auditLogs: AuditLog[] = [];

  constructor(seed = true) {
    if (seed) {
      const createdAt = this.now();
      this.rounds.set("round_v1_ggw_demo", {
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
      });
    }
  }

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async listRegions() {
    return this.regions;
  }

  async listSpecies(regionId?: string) {
    return regionId ? this.species.filter((species) => species.regionId === regionId) : this.species;
  }

  async listRounds() {
    return [...this.rounds.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async getRound(roundId: string) {
    return this.rounds.get(roundId);
  }

  async getRoundDetail(roundId: string) {
    const round = this.rounds.get(roundId);
    if (!round) {
      return undefined;
    }

    return {
      round,
      entries: await this.listEntriesForRound(roundId),
      tickets: [...this.tickets.values()].filter((ticket) => ticket.roundId === roundId),
      randomnessCertificate: [...this.certificates.values()].find((certificate) => certificate.roundId === roundId),
      winners: [...this.winners.values()].filter((winner) => winner.roundId === roundId),
      drops: [...this.drops.values()].filter((drop) => drop.roundId === roundId),
      rwaFragments: [...this.rwaFragments.values()].filter((fragment) => fragment.roundId === roundId),
    };
  }

  async getEntryByIdempotencyKey(roundId: string, idempotencyKey: string) {
    return [...this.entries.values()].find(
      (entry) => entry.roundId === roundId && entry.idempotencyKey === idempotencyKey,
    );
  }

  async listEntriesForRound(roundId: string) {
    return [...this.entries.values()]
      .filter((entry) => entry.roundId === roundId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  }

  async createEntryAndTicket(input: CreateEntryInput) {
    const createdAt = this.now();
    const entry: LotteryEntry = {
      ...input,
      id: this.makeId("entry"),
      createdAt,
    };
    const ticket = computeTicket({
      roundId: input.roundId,
      entry,
      ticketNumber: (await this.listEntriesForRound(input.roundId)).length + 1,
      makeId: (prefix) => this.makeId(prefix),
      createdAt,
    });

    this.entries.set(entry.id, entry);
    this.tickets.set(ticket.id, ticket);
    return { entry, ticket };
  }

  async updateRound(round: LotteryRound) {
    this.rounds.set(round.id, round);
    return round;
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

  async saveFinalization(input: {
    round: LotteryRound;
    certificate: RandomnessCertificate;
    winners: WinnerResult[];
    drops: DropResult[];
    rwaFragments: RwaFragmentRecord[];
  }) {
    this.rounds.set(input.round.id, input.round);
    this.certificates.set(input.certificate.id, input.certificate);
    for (const winner of input.winners) this.winners.set(winner.id, winner);
    for (const drop of input.drops) this.drops.set(drop.id, drop);
    for (const fragment of input.rwaFragments) this.rwaFragments.set(fragment.id, fragment);
  }

  async getDrop(dropId: string) {
    return this.drops.get(dropId);
  }

  async getRwaFragment(fragmentId: string) {
    return this.rwaFragments.get(fragmentId);
  }

  async updateRoundStatus(roundId: string, status: LotteryRound["status"]) {
    const round = this.rounds.get(roundId);
    if (!round) {
      throw new Error(`Lottery round not found: ${roundId}`);
    }
    const updated: LotteryRound = {
      ...round,
      status,
      updatedAt: this.now(),
    };
    this.rounds.set(roundId, updated);
    return updated;
  }

  async updateRwaFragmentStatus(fragmentId: string, status: RwaFragment["status"]) {
    const fragment = this.rwaFragments.get(fragmentId);
    if (!fragment) {
      throw new Error(`RWA fragment not found: ${fragmentId}`);
    }
    const updated: RwaFragmentRecord = {
      ...fragment,
      status,
      updatedAt: this.now(),
    };
    this.rwaFragments.set(fragmentId, updated);
    return updated;
  }

  async listTicketsForUser(userId: string) {
    return [...this.tickets.values()].filter((ticket) => ticket.userId === userId);
  }

  async listDropsForUser(userId: string) {
    return [...this.drops.values()].filter((drop) => drop.userId === userId);
  }

  async listRwaFragmentsForUser(userId: string) {
    return [...this.rwaFragments.values()].filter((fragment) => fragment.holderUserId === userId);
  }
}

export class PrismaLotteryRepository implements LotteryRepository {
  constructor(readonly prisma: PrismaClient) {}

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async listRegions() {
    const regions = await this.prisma.region.findMany({ orderBy: { name: "asc" } });
    return regions.map(toRegion);
  }

  async listSpecies(regionId?: string) {
    const species = regionId
      ? await this.prisma.species.findMany({ where: { regionId }, orderBy: { scientificName: "asc" } })
      : await this.prisma.species.findMany({ orderBy: { scientificName: "asc" } });
    return species.map(toSpecies);
  }

  async listRounds() {
    const rounds = await this.prisma.lotteryRound.findMany({ orderBy: { createdAt: "desc" } });
    return rounds.map(toLotteryRound);
  }

  async getRound(roundId: string) {
    const round = await this.prisma.lotteryRound.findUnique({ where: { id: roundId } });
    return round ? toLotteryRound(round) : undefined;
  }

  async getRoundDetail(roundId: string) {
    const detail = await this.prisma.lotteryRound.findUnique({
      where: { id: roundId },
      include: {
        entries: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
        tickets: { orderBy: { ticketNumber: "asc" } },
        randomnessCertificates: { orderBy: { createdAt: "desc" }, take: 1 },
        winnerResults: { orderBy: { rank: "asc" } },
        dropResults: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!detail) {
      return undefined;
    }
    const rwaFragments = await this.prisma.rwaFragment.findMany({
      where: { roundId },
      orderBy: { createdAt: "asc" },
    });

    return {
      round: toLotteryRound(detail),
      entries: detail.entries.map(toLotteryEntry),
      tickets: detail.tickets.map(toLotteryTicket),
      randomnessCertificate: detail.randomnessCertificates[0]
        ? toRandomnessCertificate(detail.randomnessCertificates[0])
        : undefined,
      winners: detail.winnerResults.map(toWinnerResult),
      drops: detail.dropResults.map(toDropResult),
      rwaFragments: rwaFragments.map(toRwaFragment),
    };
  }

  async getEntryByIdempotencyKey(roundId: string, idempotencyKey: string) {
    const entry = await this.prisma.lotteryEntry.findFirst({ where: { roundId, idempotencyKey } });
    return entry ? toLotteryEntry(entry) : undefined;
  }

  async listEntriesForRound(roundId: string) {
    const entries = await this.prisma.lotteryEntry.findMany({
      where: { roundId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return entries.map(toLotteryEntry);
  }

  async createEntryAndTicket(input: CreateEntryInput) {
    const createdAt = new Date();
    const entryId = this.makeId("entry");
    const ticketId = this.makeId("ticket");
    const ticketNumber = (await this.prisma.lotteryEntry.count({ where: { roundId: input.roundId } })) + 1;
    const receiptHash = hashJson({
      roundId: input.roundId,
      entryId,
      wallet: input.wallet,
      ticketNumber,
    });

    const [entry, ticket] = await this.prisma.$transaction([
      this.prisma.lotteryEntry.create({
        data: {
          id: entryId,
          roundId: input.roundId,
          userId: input.userId,
          wallet: input.wallet,
          amount: input.amount,
          currency: input.currency,
          regionId: input.regionId,
          txHash: input.txHash ?? null,
          paymentIntentId: input.paymentIntentId ?? null,
          antiSybilScore: input.antiSybilScore,
          idempotencyKey: input.idempotencyKey ?? null,
          createdAt,
        },
      }),
      this.prisma.lotteryTicket.create({
        data: {
          id: ticketId,
          roundId: input.roundId,
          entryId,
          userId: input.userId,
          wallet: input.wallet,
          ticketNumber,
          receiptHash,
          status: "issued",
          createdAt,
        },
      }),
    ]);

    return {
      entry: toLotteryEntry(entry),
      ticket: toLotteryTicket(ticket),
    };
  }

  async updateRound(round: LotteryRound) {
    const updated = await this.prisma.lotteryRound.update({
      where: { id: round.id },
      data: {
        status: round.status,
        entryMerkleRoot: round.entryMerkleRoot ?? null,
        entryCount: round.entryCount,
        totalAmount: round.totalAmount,
        randomnessCertificateId: round.randomnessCertificateId ?? null,
        roundCertificateHash: round.roundCertificateHash ?? null,
        updatedAt: new Date(round.updatedAt),
      },
    });
    return toLotteryRound(updated);
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
    return {
      id: created.id,
      actor: created.actor,
      action: created.action,
      entityType: created.entityType,
      entityId: created.entityId,
      beforeState: created.beforeState,
      afterState: created.afterState,
      requestId: created.requestId ?? undefined,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async listAuditLogs() {
    const logs = await this.prisma.auditLog.findMany({ orderBy: { createdAt: "desc" } });
    return logs.map((created) => ({
      id: created.id,
      actor: created.actor,
      action: created.action,
      entityType: created.entityType,
      entityId: created.entityId,
      beforeState: created.beforeState,
      afterState: created.afterState,
      requestId: created.requestId ?? undefined,
      createdAt: created.createdAt.toISOString(),
    }));
  }

  async saveFinalization(input: {
    round: LotteryRound;
    certificate: RandomnessCertificate;
    winners: WinnerResult[];
    drops: DropResult[];
    rwaFragments: RwaFragmentRecord[];
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.randomnessCertificate.create({
        data: {
          id: input.certificate.id,
          roundId: input.certificate.roundId,
          entryMerkleRoot: input.certificate.entryMerkleRoot,
          publicRandomness: input.certificate.publicRandomness,
          committeeCommitment: input.certificate.committeeCommitment,
          committeeReveal: input.certificate.committeeReveal,
          finalSeed: input.certificate.finalSeed,
          algorithm: input.certificate.algorithm,
          winnerMerkleRoot: input.certificate.winnerMerkleRoot,
          dropMerkleRoot: input.certificate.dropMerkleRoot,
          scriptHash: input.certificate.scriptHash,
          signatures: input.certificate.signatures,
          pqSignature: input.certificate.pqSignature ?? null,
          createdAt: new Date(input.certificate.createdAt),
        },
      });

      if (input.winners.length > 0) {
        await tx.winnerResult.createMany({
          data: input.winners.map((winner) => ({
            id: winner.id,
            roundId: winner.roundId,
            entryId: winner.entryId,
            userId: winner.userId,
            wallet: winner.wallet,
            rank: winner.rank,
            prizeAmount: winner.prizeAmount,
            prizeCurrency: winner.prizeCurrency,
            merkleLeaf: winner.merkleLeaf,
            createdAt: new Date(winner.createdAt),
          })),
          skipDuplicates: true,
        });
      }

      if (input.drops.length > 0) {
        await tx.dropResult.createMany({
          data: input.drops.map((drop) => ({
            id: drop.id,
            roundId: drop.roundId,
            entryId: drop.entryId,
            userId: drop.userId,
            wallet: drop.wallet,
            canopyAmount: drop.canopyAmount,
            rwaFragmentAmount: drop.rwaFragmentAmount,
            rarity: drop.rarity,
            merkleLeaf: drop.merkleLeaf,
            createdAt: new Date(drop.createdAt),
          })),
          skipDuplicates: true,
        });
      }

      if (input.rwaFragments.length > 0) {
        await tx.rwaFragment.createMany({
          data: input.rwaFragments.map((fragment) => ({
            id: fragment.id,
            holderUserId: fragment.holderUserId,
            holderWallet: fragment.holderWallet,
            roundId: fragment.roundId ?? null,
            projectId: fragment.projectId ?? null,
            regionId: fragment.regionId ?? null,
            type: fragment.type,
            status: fragment.status,
            notionalCo2e: fragment.notionalCo2e ?? null,
            feeCreditAmount: fragment.feeCreditAmount ?? null,
            sourceDropResultId: fragment.sourceDropResultId ?? null,
            rarity: fragment.rarity ?? null,
            jurisdictionMode: fragment.jurisdictionMode,
            transferability: fragment.transferability,
            evidenceRoot: fragment.evidenceRoot ?? null,
            certificateId: fragment.certificateId ?? null,
            expiresAt: fragment.expiresAt ? new Date(fragment.expiresAt) : null,
            createdAt: new Date(fragment.createdAt),
            updatedAt: new Date(fragment.updatedAt),
          })),
          skipDuplicates: true,
        });
      }

      await tx.lotteryRound.update({
        where: { id: input.round.id },
        data: {
          status: input.round.status,
          randomnessCertificateId: input.round.randomnessCertificateId ?? null,
          roundCertificateHash: input.round.roundCertificateHash ?? null,
          updatedAt: new Date(input.round.updatedAt),
        },
      });
    });
  }

  async listTicketsForUser(userId: string) {
    const tickets = await this.prisma.lotteryTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return tickets.map(toLotteryTicket);
  }

  async listDropsForUser(userId: string) {
    const drops = await this.prisma.dropResult.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return drops.map(toDropResult);
  }

  async listRwaFragmentsForUser(userId: string) {
    const fragments = await this.prisma.rwaFragment.findMany({
      where: { holderUserId: userId },
      orderBy: { createdAt: "desc" },
    });
    return fragments.map(toRwaFragment);
  }

  async getDrop(dropId: string) {
    const drop = await this.prisma.dropResult.findUnique({ where: { id: dropId } });
    return drop ? toDropResult(drop) : undefined;
  }

  async getRwaFragment(fragmentId: string) {
    const fragment = await this.prisma.rwaFragment.findUnique({ where: { id: fragmentId } });
    return fragment ? toRwaFragment(fragment) : undefined;
  }

  async updateRoundStatus(roundId: string, status: LotteryRound["status"]) {
    const updated = await this.prisma.lotteryRound.update({
      where: { id: roundId },
      data: { status },
    });
    return toLotteryRound(updated);
  }

  async updateRwaFragmentStatus(fragmentId: string, status: RwaFragment["status"]) {
    const updated = await this.prisma.rwaFragment.update({
      where: { id: fragmentId },
      data: { status },
    });
    return toRwaFragment(updated);
  }
}

type PrismaRound = Awaited<ReturnType<PrismaClient["lotteryRound"]["findFirst"]>>;
type PrismaEntry = Awaited<ReturnType<PrismaClient["lotteryEntry"]["findFirst"]>>;
type PrismaTicket = Awaited<ReturnType<PrismaClient["lotteryTicket"]["findFirst"]>>;
type PrismaCertificate = Awaited<ReturnType<PrismaClient["randomnessCertificate"]["findFirst"]>>;
type PrismaWinner = Awaited<ReturnType<PrismaClient["winnerResult"]["findFirst"]>>;
type PrismaDrop = Awaited<ReturnType<PrismaClient["dropResult"]["findFirst"]>>;
type PrismaFragment = Awaited<ReturnType<PrismaClient["rwaFragment"]["findFirst"]>>;
type PrismaRegion = Awaited<ReturnType<PrismaClient["region"]["findFirst"]>>;
type PrismaSpecies = Awaited<ReturnType<PrismaClient["species"]["findFirst"]>>;

function toLotteryRound(round: NonNullable<PrismaRound>): LotteryRound {
  return {
    id: round.id,
    chain: round.chain as LotteryRound["chain"],
    regionId: round.regionId,
    title: round.title,
    status: round.status as LotteryRound["status"],
    ticketPriceAmount: round.ticketPriceAmount.toString(),
    ticketPriceSymbol: round.ticketPriceSymbol as LotteryRound["ticketPriceSymbol"],
    prizePoolBps: round.prizePoolBps,
    treeFundBps: round.treeFundBps,
    canopyDropBps: round.canopyDropBps,
    rwaFragmentDropBps: round.rwaFragmentDropBps,
    referralBps: round.referralBps,
    operationsBps: round.operationsBps,
    challengePoolBps: round.challengePoolBps,
    opensAt: round.opensAt.toISOString(),
    closesAt: round.closesAt.toISOString(),
    entryMerkleRoot: round.entryMerkleRoot ?? undefined,
    entryCount: round.entryCount,
    totalAmount: round.totalAmount.toString(),
    randomnessCertificateId: round.randomnessCertificateId ?? undefined,
    roundCertificateHash: round.roundCertificateHash ?? undefined,
    createdAt: round.createdAt.toISOString(),
    updatedAt: round.updatedAt.toISOString(),
  };
}

function toLotteryEntry(entry: NonNullable<PrismaEntry>): LotteryEntry {
  return {
    id: entry.id,
    roundId: entry.roundId,
    userId: entry.userId,
    wallet: entry.wallet,
    amount: entry.amount.toString(),
    currency: entry.currency as LotteryEntry["currency"],
    regionId: entry.regionId,
    txHash: entry.txHash ?? undefined,
    paymentIntentId: entry.paymentIntentId ?? undefined,
    antiSybilScore: entry.antiSybilScore,
    idempotencyKey: entry.idempotencyKey ?? undefined,
    createdAt: entry.createdAt.toISOString(),
  };
}

function toLotteryTicket(ticket: NonNullable<PrismaTicket>): LotteryTicket {
  return {
    id: ticket.id,
    roundId: ticket.roundId,
    entryId: ticket.entryId,
    userId: ticket.userId,
    wallet: ticket.wallet,
    ticketNumber: ticket.ticketNumber,
    receiptHash: ticket.receiptHash,
    status: ticket.status as LotteryTicket["status"],
    createdAt: ticket.createdAt.toISOString(),
  };
}

function toRandomnessCertificate(certificate: NonNullable<PrismaCertificate>): RandomnessCertificate {
  return {
    id: certificate.id,
    roundId: certificate.roundId,
    entryMerkleRoot: certificate.entryMerkleRoot,
    publicRandomness: certificate.publicRandomness,
    committeeCommitment: certificate.committeeCommitment,
    committeeReveal: certificate.committeeReveal,
    finalSeed: certificate.finalSeed,
    algorithm: certificate.algorithm as RandomnessCertificate["algorithm"],
    winnerMerkleRoot: certificate.winnerMerkleRoot,
    dropMerkleRoot: certificate.dropMerkleRoot,
    scriptHash: certificate.scriptHash,
    signatures: Array.isArray(certificate.signatures) ? certificate.signatures.map(String) : [],
    pqSignature: certificate.pqSignature ?? undefined,
    createdAt: certificate.createdAt.toISOString(),
  };
}

function toWinnerResult(winner: NonNullable<PrismaWinner>): WinnerResult {
  return {
    id: winner.id,
    roundId: winner.roundId,
    entryId: winner.entryId,
    userId: winner.userId,
    wallet: winner.wallet,
    rank: winner.rank,
    prizeAmount: winner.prizeAmount.toString(),
    prizeCurrency: winner.prizeCurrency as WinnerResult["prizeCurrency"],
    merkleLeaf: winner.merkleLeaf,
    createdAt: winner.createdAt.toISOString(),
  };
}

function toDropResult(drop: NonNullable<PrismaDrop>): DropResult {
  return {
    id: drop.id,
    roundId: drop.roundId,
    entryId: drop.entryId,
    userId: drop.userId,
    wallet: drop.wallet,
    canopyAmount: drop.canopyAmount.toString(),
    rwaFragmentAmount: drop.rwaFragmentAmount.toString(),
    rarity: drop.rarity as DropResult["rarity"],
    merkleLeaf: drop.merkleLeaf,
    createdAt: drop.createdAt.toISOString(),
  };
}

function toRwaFragment(fragment: NonNullable<PrismaFragment>): RwaFragmentRecord {
  return {
    id: fragment.id,
    holderUserId: fragment.holderUserId,
    holderWallet: fragment.holderWallet,
    roundId: fragment.roundId ?? undefined,
    projectId: fragment.projectId ?? undefined,
    regionId: fragment.regionId ?? undefined,
    type: fragment.type as RwaFragment["type"],
    status: fragment.status as RwaFragment["status"],
    notionalCo2e: fragment.notionalCo2e?.toString(),
    feeCreditAmount: fragment.feeCreditAmount?.toString(),
    sourceDropResultId: fragment.sourceDropResultId ?? undefined,
    rarity: (fragment.rarity as DropResult["rarity"] | null) ?? undefined,
    jurisdictionMode: fragment.jurisdictionMode as RwaFragment["jurisdictionMode"],
    transferability: fragment.transferability as RwaFragment["transferability"],
    evidenceRoot: fragment.evidenceRoot ?? undefined,
    certificateId: fragment.certificateId ?? undefined,
    expiresAt: fragment.expiresAt?.toISOString(),
    createdAt: fragment.createdAt.toISOString(),
    updatedAt: fragment.updatedAt.toISOString(),
  };
}

function toRegion(region: NonNullable<PrismaRegion>): Region {
  return {
    id: region.id,
    name: region.name,
    slug: region.slug,
    country: region.country,
    restorationType: region.restorationType,
    restorationPriority: region.restorationPriority as Region["restorationPriority"],
    requiredTreesLow: Number(region.requiredTreesLow),
    requiredTreesHigh: Number(region.requiredTreesHigh),
    verifiedTrees: Number(region.verifiedTrees),
    estimatedCo2eTonnes: Number(region.estimatedCo2eTonnes),
    survivalRateEstimate: Number(region.survivalRateEstimate),
  };
}

function toSpecies(species: NonNullable<PrismaSpecies>): Species {
  return {
    id: species.id,
    regionId: species.regionId,
    scientificName: species.scientificName,
    commonName: species.commonName,
    waterRequirement: species.waterRequirement as Species["waterRequirement"],
    climateSuitability: species.climateSuitability,
    carbonPotential: species.carbonPotential,
    biodiversityScore: species.biodiversityScore,
    localEconomicValue: species.localEconomicValue,
    invasiveRisk: species.invasiveRisk as Species["invasiveRisk"],
  };
}
