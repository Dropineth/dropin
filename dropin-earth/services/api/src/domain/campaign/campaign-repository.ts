import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import type {
  AuditLog,
  Campaign,
  CampaignParticipant,
  CampaignReport,
  LeafPointsAccount,
  LeafPointsTransaction,
} from "@dropin/schemas";
import type { AuditInput } from "../lottery/lottery-repository.js";

export type CreateCampaignInput = Omit<Campaign, "id" | "status" | "createdAt" | "updatedAt"> & {
  id?: string | undefined;
  status?: Campaign["status"] | undefined;
};
export type CreateParticipantInput = Omit<CampaignParticipant, "id" | "joinedAt">;
export type CreateLeafPointsTransactionInput = Omit<LeafPointsTransaction, "id" | "createdAt">;
export type CreateCampaignReportInput = Omit<CampaignReport, "id" | "createdAt">;

export interface CampaignRepository {
  makeId(prefix: string): string;
  now(): string;
  createCampaign(input: CreateCampaignInput): Promise<Campaign>;
  updateCampaign(campaign: Campaign): Promise<Campaign>;
  getCampaign(campaignId: string): Promise<Campaign | undefined>;
  getCampaignBySlug(slug: string): Promise<Campaign | undefined>;
  getCampaignByRoundId(roundId: string): Promise<Campaign | undefined>;
  getCampaignByProjectId(projectId: string): Promise<Campaign | undefined>;
  listCampaigns(): Promise<Campaign[]>;
  createCampaignRound(campaignId: string, roundId: string): Promise<void>;
  createCampaignProject(campaignId: string, projectId: string): Promise<void>;
  joinCampaign(input: CreateParticipantInput): Promise<{ participant: CampaignParticipant; idempotent: boolean }>;
  getParticipant(campaignId: string, userId: string): Promise<CampaignParticipant | undefined>;
  listParticipants(campaignId?: string): Promise<CampaignParticipant[]>;
  ensureLeafPointsAccount(campaignId: string, userId: string): Promise<LeafPointsAccount>;
  getLeafPointsAccount(campaignId: string, userId: string): Promise<LeafPointsAccount | undefined>;
  listLeafPointsAccounts(campaignId?: string): Promise<LeafPointsAccount[]>;
  updateLeafPointsBalance(accountId: string, delta: number): Promise<LeafPointsAccount>;
  createLeafPointsTransaction(input: CreateLeafPointsTransactionInput): Promise<LeafPointsTransaction>;
  getLeafPointsTransactionBySource(userId: string, sourceType: string, sourceId: string): Promise<LeafPointsTransaction | undefined>;
  listLeafPointsTransactions(input?: { campaignId?: string | undefined; userId?: string | undefined }): Promise<LeafPointsTransaction[]>;
  createCampaignReport(input: CreateCampaignReportInput): Promise<CampaignReport>;
  getLatestCampaignReport(campaignId: string): Promise<CampaignReport | undefined>;
  createAuditLog(input: AuditInput): Promise<AuditLog>;
  listAuditLogs(): Promise<AuditLog[]>;
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID()}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export class InMemoryCampaignRepository implements CampaignRepository {
  readonly campaigns = new Map<string, Campaign>();
  readonly campaignRounds = new Map<string, { campaignId: string; roundId: string }>();
  readonly campaignProjects = new Map<string, { campaignId: string; projectId: string }>();
  readonly participants = new Map<string, CampaignParticipant>();
  readonly accounts = new Map<string, LeafPointsAccount>();
  readonly transactions = new Map<string, LeafPointsTransaction>();
  readonly reports = new Map<string, CampaignReport>();
  readonly auditLogs: AuditLog[] = [];

  constructor(seed = true) {
    if (seed) {
      const now = this.now();
      const campaign: Campaign = {
        id: "campaign_v1_ggw_testnet",
        title: "Great Green Wall Testnet Co-Plant",
        slug: "great-green-wall-testnet",
        regionId: "region_ggw_sahel",
        status: "active",
        startsAt: now,
        endsAt: new Date(Date.now() + 14 * 86_400_000).toISOString(),
        fundingGoalAmount: "1000",
        fundingGoalCurrency: "USDC",
        treeGoal: 10000,
        roundId: "round_v1_ggw_demo",
        projectId: "project_v1_ggw_demo",
        createdAt: now,
        updatedAt: now,
      };
      this.campaigns.set(campaign.id, campaign);
      this.campaignRounds.set(`${campaign.id}:round_v1_ggw_demo`, { campaignId: campaign.id, roundId: "round_v1_ggw_demo" });
      this.campaignProjects.set(`${campaign.id}:project_v1_ggw_demo`, { campaignId: campaign.id, projectId: "project_v1_ggw_demo" });
      this.participants.set(`${campaign.id}:demo-user`, {
        id: "campaign_participant_v1_demo",
        campaignId: campaign.id,
        userId: "demo-user",
        wallet: "solana_demo_wallet_7xDropinEarthV1",
        status: "joined",
        joinedAt: now,
      });
      const accountId = `leaf_account_${campaign.id}_demo-user`;
      this.accounts.set(`${campaign.id}:demo-user`, {
        id: accountId,
        campaignId: campaign.id,
        userId: "demo-user",
        balance: 35,
        createdAt: now,
        updatedAt: now,
      });
      this.transactions.set("leaf_tx_v1_ggw_seed_demo", {
        id: "leaf_tx_v1_ggw_seed_demo",
        accountId,
        userId: "demo-user",
        campaignId: campaign.id,
        amount: 35,
        sourceType: "seed",
        sourceId: "campaign_v1_ggw_testnet_seed",
        reason: "Seeded testnet campaign points",
        status: "posted",
        createdAt: now,
      });
    }
  }

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createCampaign(input: CreateCampaignInput) {
    const now = this.now();
    const campaign: Campaign = {
      ...input,
      id: input.id ?? this.makeId("campaign"),
      status: input.status ?? "draft",
      createdAt: now,
      updatedAt: now,
    };
    this.campaigns.set(campaign.id, campaign);
    if (campaign.roundId) await this.createCampaignRound(campaign.id, campaign.roundId);
    if (campaign.projectId) await this.createCampaignProject(campaign.id, campaign.projectId);
    return campaign;
  }

  async updateCampaign(campaign: Campaign) {
    const updated = { ...campaign, updatedAt: this.now() };
    this.campaigns.set(campaign.id, updated);
    if (updated.roundId) await this.createCampaignRound(updated.id, updated.roundId);
    if (updated.projectId) await this.createCampaignProject(updated.id, updated.projectId);
    return updated;
  }

  async getCampaign(campaignId: string) {
    return this.campaigns.get(campaignId);
  }

  async getCampaignBySlug(slug: string) {
    return [...this.campaigns.values()].find((campaign) => campaign.slug === slug);
  }

  async getCampaignByRoundId(roundId: string) {
    const link = [...this.campaignRounds.values()].find((item) => item.roundId === roundId);
    return link ? this.campaigns.get(link.campaignId) : [...this.campaigns.values()].find((campaign) => campaign.roundId === roundId);
  }

  async getCampaignByProjectId(projectId: string) {
    const link = [...this.campaignProjects.values()].find((item) => item.projectId === projectId);
    return link ? this.campaigns.get(link.campaignId) : [...this.campaigns.values()].find((campaign) => campaign.projectId === projectId);
  }

  async listCampaigns() {
    return [...this.campaigns.values()].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async createCampaignRound(campaignId: string, roundId: string) {
    this.campaignRounds.set(`${campaignId}:${roundId}`, { campaignId, roundId });
  }

  async createCampaignProject(campaignId: string, projectId: string) {
    this.campaignProjects.set(`${campaignId}:${projectId}`, { campaignId, projectId });
  }

  async joinCampaign(input: CreateParticipantInput) {
    const key = `${input.campaignId}:${input.userId}`;
    const existing = this.participants.get(key);
    if (existing) return { participant: existing, idempotent: true };
    const participant: CampaignParticipant = {
      ...input,
      id: this.makeId("campaign_participant"),
      joinedAt: this.now(),
    };
    this.participants.set(key, participant);
    await this.ensureLeafPointsAccount(input.campaignId, input.userId);
    return { participant, idempotent: false };
  }

  async getParticipant(campaignId: string, userId: string) {
    return this.participants.get(`${campaignId}:${userId}`);
  }

  async listParticipants(campaignId?: string) {
    return [...this.participants.values()].filter((item) => !campaignId || item.campaignId === campaignId);
  }

  async ensureLeafPointsAccount(campaignId: string, userId: string) {
    const key = `${campaignId}:${userId}`;
    const existing = this.accounts.get(key);
    if (existing) return existing;
    const now = this.now();
    const account: LeafPointsAccount = {
      id: `leaf_account_${campaignId}_${userId}`,
      campaignId,
      userId,
      balance: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.accounts.set(key, account);
    return account;
  }

  async getLeafPointsAccount(campaignId: string, userId: string) {
    return this.accounts.get(`${campaignId}:${userId}`);
  }

  async listLeafPointsAccounts(campaignId?: string) {
    return [...this.accounts.values()].filter((account) => !campaignId || account.campaignId === campaignId);
  }

  async updateLeafPointsBalance(accountId: string, delta: number) {
    const entry = [...this.accounts.entries()].find(([, account]) => account.id === accountId);
    if (!entry) throw new Error(`Leaf Points account not found: ${accountId}`);
    const [key, account] = entry;
    const updated = { ...account, balance: Math.max(0, account.balance + delta), updatedAt: this.now() };
    this.accounts.set(key, updated);
    return updated;
  }

  async createLeafPointsTransaction(input: CreateLeafPointsTransactionInput) {
    const existing = await this.getLeafPointsTransactionBySource(input.userId, input.sourceType, input.sourceId);
    if (existing) return existing;
    const transaction: LeafPointsTransaction = {
      ...input,
      id: this.makeId("leaf_tx"),
      createdAt: this.now(),
    };
    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  async getLeafPointsTransactionBySource(userId: string, sourceType: string, sourceId: string) {
    return [...this.transactions.values()].find(
      (transaction) => transaction.userId === userId && transaction.sourceType === sourceType && transaction.sourceId === sourceId,
    );
  }

  async listLeafPointsTransactions(input: { campaignId?: string | undefined; userId?: string | undefined } = {}) {
    return [...this.transactions.values()].filter(
      (transaction) =>
        (!input.campaignId || transaction.campaignId === input.campaignId) &&
        (!input.userId || transaction.userId === input.userId),
    );
  }

  async createCampaignReport(input: CreateCampaignReportInput) {
    const report: CampaignReport = { ...input, id: this.makeId("campaign_report"), createdAt: this.now() };
    this.reports.set(report.id, report);
    return report;
  }

  async getLatestCampaignReport(campaignId: string) {
    return [...this.reports.values()]
      .filter((report) => report.campaignId === campaignId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
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

export class PrismaCampaignRepository implements CampaignRepository {
  constructor(readonly prisma: PrismaClient) {}

  makeId(prefix: string) {
    return makeId(prefix);
  }

  now() {
    return nowIso();
  }

  async createCampaign(input: CreateCampaignInput) {
    const campaign = await this.prisma.campaign.create({
      data: {
        id: input.id ?? this.makeId("campaign"),
        title: input.title,
        slug: input.slug,
        regionId: input.regionId,
        status: input.status ?? "draft",
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        fundingGoalAmount: input.fundingGoalAmount,
        fundingGoalCurrency: input.fundingGoalCurrency,
        treeGoal: input.treeGoal,
        roundId: input.roundId ?? null,
        projectId: input.projectId ?? null,
      },
    });
    const result = toCampaign(campaign);
    if (result.roundId) await this.createCampaignRound(result.id, result.roundId);
    if (result.projectId) await this.createCampaignProject(result.id, result.projectId);
    return result;
  }

  async updateCampaign(campaign: Campaign) {
    const updated = await this.prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        title: campaign.title,
        slug: campaign.slug,
        regionId: campaign.regionId,
        status: campaign.status,
        startsAt: new Date(campaign.startsAt),
        endsAt: new Date(campaign.endsAt),
        fundingGoalAmount: campaign.fundingGoalAmount,
        fundingGoalCurrency: campaign.fundingGoalCurrency,
        treeGoal: campaign.treeGoal,
        roundId: campaign.roundId ?? null,
        projectId: campaign.projectId ?? null,
      },
    });
    const result = toCampaign(updated);
    if (result.roundId) await this.createCampaignRound(result.id, result.roundId);
    if (result.projectId) await this.createCampaignProject(result.id, result.projectId);
    return result;
  }

  async getCampaign(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { id: campaignId } });
    return campaign ? toCampaign(campaign) : undefined;
  }

  async getCampaignBySlug(slug: string) {
    const campaign = await this.prisma.campaign.findUnique({ where: { slug } });
    return campaign ? toCampaign(campaign) : undefined;
  }

  async getCampaignByRoundId(roundId: string) {
    const link = await this.prisma.campaignRound.findFirst({ where: { roundId } });
    const campaign = link
      ? await this.prisma.campaign.findUnique({ where: { id: link.campaignId } })
      : await this.prisma.campaign.findFirst({ where: { roundId } });
    return campaign ? toCampaign(campaign) : undefined;
  }

  async getCampaignByProjectId(projectId: string) {
    const link = await this.prisma.campaignProject.findFirst({ where: { projectId } });
    const campaign = link
      ? await this.prisma.campaign.findUnique({ where: { id: link.campaignId } })
      : await this.prisma.campaign.findFirst({ where: { projectId } });
    return campaign ? toCampaign(campaign) : undefined;
  }

  async listCampaigns() {
    const campaigns = await this.prisma.campaign.findMany({ orderBy: { createdAt: "desc" } });
    return campaigns.map(toCampaign);
  }

  async createCampaignRound(campaignId: string, roundId: string) {
    await this.prisma.campaignRound.upsert({
      where: { campaignId_roundId: { campaignId, roundId } },
      update: {},
      create: { id: this.makeId("campaign_round"), campaignId, roundId },
    });
  }

  async createCampaignProject(campaignId: string, projectId: string) {
    await this.prisma.campaignProject.upsert({
      where: { campaignId_projectId: { campaignId, projectId } },
      update: {},
      create: { id: this.makeId("campaign_project"), campaignId, projectId },
    });
  }

  async joinCampaign(input: CreateParticipantInput) {
    const existing = await this.prisma.campaignParticipant.findUnique({
      where: { campaignId_userId: { campaignId: input.campaignId, userId: input.userId } },
    });
    if (existing) {
      return { participant: toParticipant(existing), idempotent: true };
    }
    const participant = await this.prisma.campaignParticipant.create({
      data: {
        id: this.makeId("campaign_participant"),
        campaignId: input.campaignId,
        userId: input.userId,
        wallet: input.wallet ?? null,
        referralCode: input.referralCode ?? null,
        status: input.status,
      },
    });
    await this.ensureLeafPointsAccount(input.campaignId, input.userId);
    return { participant: toParticipant(participant), idempotent: false };
  }

  async getParticipant(campaignId: string, userId: string) {
    const participant = await this.prisma.campaignParticipant.findUnique({ where: { campaignId_userId: { campaignId, userId } } });
    return participant ? toParticipant(participant) : undefined;
  }

  async listParticipants(campaignId?: string) {
    const participants = campaignId
      ? await this.prisma.campaignParticipant.findMany({ where: { campaignId } })
      : await this.prisma.campaignParticipant.findMany();
    return participants.map(toParticipant);
  }

  async ensureLeafPointsAccount(campaignId: string, userId: string) {
    const account = await this.prisma.leafPointsAccount.upsert({
      where: { campaignId_userId: { campaignId, userId } },
      update: {},
      create: { id: `leaf_account_${campaignId}_${userId}`, campaignId, userId, balance: 0 },
    });
    return toLeafAccount(account);
  }

  async getLeafPointsAccount(campaignId: string, userId: string) {
    const account = await this.prisma.leafPointsAccount.findUnique({ where: { campaignId_userId: { campaignId, userId } } });
    return account ? toLeafAccount(account) : undefined;
  }

  async listLeafPointsAccounts(campaignId?: string) {
    const accounts = campaignId
      ? await this.prisma.leafPointsAccount.findMany({ where: { campaignId } })
      : await this.prisma.leafPointsAccount.findMany();
    return accounts.map(toLeafAccount);
  }

  async updateLeafPointsBalance(accountId: string, delta: number) {
    const account = await this.prisma.leafPointsAccount.update({
      where: { id: accountId },
      data: { balance: { increment: delta } },
    });
    return toLeafAccount(account);
  }

  async createLeafPointsTransaction(input: CreateLeafPointsTransactionInput) {
    const existing = await this.getLeafPointsTransactionBySource(input.userId, input.sourceType, input.sourceId);
    if (existing) return existing;
    const transaction = await this.prisma.leafPointsTransaction.create({
      data: {
        id: this.makeId("leaf_tx"),
        accountId: input.accountId,
        userId: input.userId,
        campaignId: input.campaignId,
        amount: input.amount,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        reason: input.reason,
        status: input.status,
      },
    });
    return toLeafTransaction(transaction);
  }

  async getLeafPointsTransactionBySource(userId: string, sourceType: string, sourceId: string) {
    const transaction = await this.prisma.leafPointsTransaction.findUnique({
      where: { userId_sourceType_sourceId: { userId, sourceType, sourceId } },
    });
    return transaction ? toLeafTransaction(transaction) : undefined;
  }

  async listLeafPointsTransactions(input: { campaignId?: string | undefined; userId?: string | undefined } = {}) {
    const transactions = await this.prisma.leafPointsTransaction.findMany({
      where: {
        ...(input.campaignId ? { campaignId: input.campaignId } : {}),
        ...(input.userId ? { userId: input.userId } : {}),
      },
    });
    return transactions.map(toLeafTransaction);
  }

  async createCampaignReport(input: CreateCampaignReportInput) {
    const report = await this.prisma.campaignReport.create({
      data: {
        id: this.makeId("campaign_report"),
        campaignId: input.campaignId,
        status: input.status,
        participantCount: input.participantCount,
        ticketCount: input.ticketCount,
        confirmedPaymentIntentCount: input.confirmedPaymentIntentCount,
        totalConfirmedPaymentAmount: input.totalConfirmedPaymentAmount,
        fundingGoalAmount: input.fundingGoalAmount,
        fundingGoalCurrency: input.fundingGoalCurrency,
        treeGoal: input.treeGoal,
        evidenceCount: input.evidenceCount,
        challengeCount: input.challengeCount,
        riskEventCount: input.riskEventCount,
        fundAllocations: jsonValue(input.fundAllocations),
        projectMilestones: jsonValue(input.projectMilestones),
        impactCertificateStatuses: jsonValue(input.impactCertificateStatuses),
        leaderboard: jsonValue(input.leaderboard),
      },
    });
    return toCampaignReport(report);
  }

  async getLatestCampaignReport(campaignId: string) {
    const report = await this.prisma.campaignReport.findFirst({ where: { campaignId }, orderBy: { createdAt: "desc" } });
    return report ? toCampaignReport(report) : undefined;
  }

  async createAuditLog(input: AuditInput) {
    const created = await this.prisma.auditLog.create({
      data: {
        id: this.makeId("audit"),
        actor: input.actor,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        beforeState: input.beforeState === undefined ? Prisma.JsonNull : jsonValue(input.beforeState),
        afterState: input.afterState === undefined ? Prisma.JsonNull : jsonValue(input.afterState),
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
    return logs.map((log) => ({
      id: log.id,
      actor: log.actor,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      beforeState: log.beforeState,
      afterState: log.afterState,
      requestId: log.requestId ?? undefined,
      createdAt: log.createdAt.toISOString(),
    }));
  }
}

type PrismaCampaign = Awaited<ReturnType<PrismaClient["campaign"]["findFirst"]>>;
type PrismaParticipant = Awaited<ReturnType<PrismaClient["campaignParticipant"]["findFirst"]>>;
type PrismaLeafAccount = Awaited<ReturnType<PrismaClient["leafPointsAccount"]["findFirst"]>>;
type PrismaLeafTransaction = Awaited<ReturnType<PrismaClient["leafPointsTransaction"]["findFirst"]>>;
type PrismaCampaignReport = Awaited<ReturnType<PrismaClient["campaignReport"]["findFirst"]>>;

function toCampaign(campaign: NonNullable<PrismaCampaign>): Campaign {
  return {
    id: campaign.id,
    title: campaign.title,
    slug: campaign.slug,
    regionId: campaign.regionId,
    status: campaign.status as Campaign["status"],
    startsAt: campaign.startsAt.toISOString(),
    endsAt: campaign.endsAt.toISOString(),
    fundingGoalAmount: campaign.fundingGoalAmount.toString(),
    fundingGoalCurrency: campaign.fundingGoalCurrency as Campaign["fundingGoalCurrency"],
    treeGoal: campaign.treeGoal,
    roundId: campaign.roundId ?? undefined,
    projectId: campaign.projectId ?? undefined,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  };
}

function toParticipant(participant: NonNullable<PrismaParticipant>): CampaignParticipant {
  return {
    id: participant.id,
    campaignId: participant.campaignId,
    userId: participant.userId,
    wallet: participant.wallet ?? undefined,
    referralCode: participant.referralCode ?? undefined,
    status: participant.status as CampaignParticipant["status"],
    joinedAt: participant.joinedAt.toISOString(),
  };
}

function toLeafAccount(account: NonNullable<PrismaLeafAccount>): LeafPointsAccount {
  return {
    id: account.id,
    userId: account.userId,
    campaignId: account.campaignId,
    balance: account.balance,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function toLeafTransaction(transaction: NonNullable<PrismaLeafTransaction>): LeafPointsTransaction {
  return {
    id: transaction.id,
    accountId: transaction.accountId,
    userId: transaction.userId,
    campaignId: transaction.campaignId,
    amount: transaction.amount,
    sourceType: transaction.sourceType,
    sourceId: transaction.sourceId,
    reason: transaction.reason,
    status: transaction.status as LeafPointsTransaction["status"],
    createdAt: transaction.createdAt.toISOString(),
  };
}

function toCampaignReport(report: NonNullable<PrismaCampaignReport>): CampaignReport {
  return {
    id: report.id,
    campaignId: report.campaignId,
    status: report.status as CampaignReport["status"],
    participantCount: report.participantCount,
    ticketCount: report.ticketCount,
    confirmedPaymentIntentCount: report.confirmedPaymentIntentCount,
    totalConfirmedPaymentAmount: report.totalConfirmedPaymentAmount.toString(),
    fundingGoalAmount: report.fundingGoalAmount.toString(),
    fundingGoalCurrency: report.fundingGoalCurrency as CampaignReport["fundingGoalCurrency"],
    treeGoal: report.treeGoal,
    evidenceCount: report.evidenceCount,
    challengeCount: report.challengeCount,
    riskEventCount: report.riskEventCount,
    fundAllocations: report.fundAllocations as CampaignReport["fundAllocations"],
    projectMilestones: report.projectMilestones as CampaignReport["projectMilestones"],
    impactCertificateStatuses: report.impactCertificateStatuses as CampaignReport["impactCertificateStatuses"],
    leaderboard: report.leaderboard as CampaignReport["leaderboard"],
    createdAt: report.createdAt.toISOString(),
  };
}

function jsonValue(input: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(input)) as Prisma.InputJsonValue;
}
