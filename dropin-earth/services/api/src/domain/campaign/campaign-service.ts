import {
  createCampaignSchema,
  joinCampaignSchema,
  type Campaign,
  type CampaignReport,
  type Currency,
} from "@dropin/schemas";
import type { FundRepository } from "../fund/fund-repository.js";
import type { ImpactRepository } from "../impact/impact-repository.js";
import type { LotteryRepository } from "../lottery/lottery-repository.js";
import type { PaymentRepository } from "../payment/payment-repository.js";
import type { RiskRepository } from "../risk/risk-repository.js";
import { CampaignNotFoundError } from "./campaign-errors.js";
import type { CampaignRepository } from "./campaign-repository.js";
import { assertCampaignTransition } from "./campaign-state-machine.js";
import { buildLeaderboard } from "./leaderboard-service.js";
import { LeafPointsService } from "./leaf-points-service.js";

export type CampaignDependencies = {
  lotteryRepo?: LotteryRepository | undefined;
  paymentRepo?: PaymentRepository | undefined;
  fundRepo?: FundRepository | undefined;
  impactRepo?: ImpactRepository | undefined;
  riskRepo?: RiskRepository | undefined;
};

export type CampaignDetail = {
  campaign: Campaign;
  participantCount: number;
  leaderboard: ReturnType<typeof buildLeaderboard>;
  latestReport?: CampaignReport | undefined;
};

export class CampaignService {
  readonly leafPoints: LeafPointsService;

  constructor(
    private readonly repo: CampaignRepository,
    private readonly deps: CampaignDependencies = {},
  ) {
    this.leafPoints = new LeafPointsService(repo);
  }

  async listCampaigns() {
    return this.repo.listCampaigns();
  }

  async getCampaignDetail(campaignIdOrSlug: string): Promise<CampaignDetail> {
    const campaign = await this.mustGetCampaign(campaignIdOrSlug);
    const [participants, accounts, latestReport] = await Promise.all([
      this.repo.listParticipants(campaign.id),
      this.repo.listLeafPointsAccounts(campaign.id),
      this.repo.getLatestCampaignReport(campaign.id),
    ]);
    return {
      campaign,
      participantCount: participants.length,
      leaderboard: buildLeaderboard(accounts),
      latestReport,
    };
  }

  async createCampaign(input: unknown, actor = "api-admin") {
    const parsed = createCampaignSchema.parse(input);
    const campaign = await this.repo.createCampaign({ ...parsed, status: "draft" });
    await this.repo.createAuditLog({
      actor,
      action: "campaign.create",
      entityType: "campaign",
      entityId: campaign.id,
      afterState: campaign,
    });
    return campaign;
  }

  async scheduleCampaign(campaignId: string, actor = "api-admin") {
    return this.transitionCampaign(campaignId, "scheduled", "campaign.schedule", actor);
  }

  async startCampaign(campaignId: string, actor = "api-admin") {
    return this.transitionCampaign(campaignId, "active", "campaign.start", actor);
  }

  async endCampaign(campaignId: string, actor = "api-admin") {
    return this.transitionCampaign(campaignId, "ended", "campaign.end", actor);
  }

  async finalizeCampaign(campaignId: string, actor = "api-admin") {
    const campaign = await this.transitionCampaign(campaignId, "finalized", "campaign.finalize", actor);
    const report = await this.publishReport(campaign.id, "published");
    return { campaign, report };
  }

  async joinCampaign(campaignIdOrSlug: string, input: unknown) {
    const campaign = await this.mustGetCampaign(campaignIdOrSlug);
    const parsed = joinCampaignSchema.parse(input);
    return this.repo.joinCampaign({
      campaignId: campaign.id,
      userId: parsed.userId,
      wallet: parsed.wallet,
      referralCode: parsed.referralCode,
      status: "joined",
    });
  }

  async getCampaignMe(campaignIdOrSlug: string, userId = "demo-user") {
    const campaign = await this.mustGetCampaign(campaignIdOrSlug);
    const [participant, account, transactions] = await Promise.all([
      this.repo.getParticipant(campaign.id, userId),
      this.repo.getLeafPointsAccount(campaign.id, userId),
      this.repo.listLeafPointsTransactions({ campaignId: campaign.id, userId }),
    ]);
    return { campaign, participant, leafPointsAccount: account, transactions };
  }

  async getLeafPoints(userId = "demo-user") {
    const [accounts, transactions] = await Promise.all([
      this.repo.listLeafPointsAccounts(),
      this.repo.listLeafPointsTransactions({ userId }),
    ]);
    return {
      accounts: accounts.filter((account) => account.userId === userId),
      transactions,
      total: accounts.filter((account) => account.userId === userId).reduce((sum, account) => sum + account.balance, 0),
      note: "Leaf Points are non-transferable public testnet growth points. They are not $CANOPY and do not represent yield.",
    };
  }

  async getCampaignLeafPoints(campaignIdOrSlug: string) {
    const campaign = await this.mustGetCampaign(campaignIdOrSlug);
    const [accounts, transactions] = await Promise.all([
      this.repo.listLeafPointsAccounts(campaign.id),
      this.repo.listLeafPointsTransactions({ campaignId: campaign.id }),
    ]);
    return { campaign, accounts, transactions, leaderboard: buildLeaderboard(accounts) };
  }

  async getLeaderboard(campaignIdOrSlug: string) {
    const campaign = await this.mustGetCampaign(campaignIdOrSlug);
    const accounts = await this.repo.listLeafPointsAccounts(campaign.id);
    return buildLeaderboard(accounts);
  }

  async awardLotteryEntry(input: { roundId: string; userId: string; entryId: string; wallet?: string | undefined }) {
    const campaign = await this.repo.getCampaignByRoundId(input.roundId);
    if (!campaign) return undefined;
    await this.repo.joinCampaign({
      campaignId: campaign.id,
      userId: input.userId,
      wallet: input.wallet,
      status: "joined",
    });
    return this.leafPoints.award({
      campaignId: campaign.id,
      userId: input.userId,
      amount: 10,
      sourceType: "lottery_entry",
      sourceId: input.entryId,
      reason: "Tree Lotto public testnet entry",
    });
  }

  async awardShareTicket(input: { roundId: string; ticketId: string; userId: string }) {
    const campaign = await this.repo.getCampaignByRoundId(input.roundId);
    if (!campaign) return undefined;
    await this.repo.joinCampaign({ campaignId: campaign.id, userId: input.userId, status: "joined" });
    return this.leafPoints.award({
      campaignId: campaign.id,
      userId: input.userId,
      amount: 5,
      sourceType: "share_ticket",
      sourceId: input.ticketId,
      reason: "Created public testnet Climate Proof Card",
    });
  }

  async awardReferral(input: {
    roundId?: string | undefined;
    referrerUserId: string;
    eventId: string;
    suspicious: boolean;
  }) {
    if (input.suspicious || !input.roundId) return undefined;
    const campaign = await this.repo.getCampaignByRoundId(input.roundId);
    if (!campaign) return undefined;
    await this.repo.joinCampaign({ campaignId: campaign.id, userId: input.referrerUserId, status: "joined" });
    return this.leafPoints.award({
      campaignId: campaign.id,
      userId: input.referrerUserId,
      amount: 20,
      sourceType: "referral_event",
      sourceId: input.eventId,
      reason: "Valid Co-Plant referral claim",
    });
  }

  async getReport(campaignIdOrSlug: string) {
    const campaign = await this.mustGetCampaign(campaignIdOrSlug);
    return this.buildReport(campaign, "draft");
  }

  private async publishReport(campaignId: string, status: CampaignReport["status"]) {
    const campaign = await this.mustGetCampaign(campaignId);
    return this.repo.createCampaignReport(await this.buildReport(campaign, status));
  }

  private async transitionCampaign(
    campaignIdOrSlug: string,
    status: Campaign["status"],
    action: string,
    actor: string,
  ) {
    const campaign = await this.mustGetCampaign(campaignIdOrSlug);
    if (campaign.status !== status) {
      assertCampaignTransition(campaign.status, status);
    }
    const updated = await this.repo.updateCampaign({ ...campaign, status });
    await this.repo.createAuditLog({
      actor,
      action,
      entityType: "campaign",
      entityId: campaign.id,
      beforeState: campaign,
      afterState: updated,
    });
    return updated;
  }

  private async mustGetCampaign(campaignIdOrSlug: string) {
    const campaign =
      (await this.repo.getCampaign(campaignIdOrSlug)) ?? (await this.repo.getCampaignBySlug(campaignIdOrSlug));
    if (!campaign) {
      throw new CampaignNotFoundError(campaignIdOrSlug);
    }
    return campaign;
  }

  private async buildReport(campaign: Campaign, status: CampaignReport["status"]): Promise<Omit<CampaignReport, "id" | "createdAt">> {
    const [participants, accounts, payments, allocations, riskEvents, challenges, projectDetail] = await Promise.all([
      this.repo.listParticipants(campaign.id),
      this.repo.listLeafPointsAccounts(campaign.id),
      this.deps.paymentRepo?.listPaymentIntents() ?? Promise.resolve([]),
      this.deps.fundRepo?.listFundAllocations() ?? Promise.resolve([]),
      this.deps.riskRepo?.listRiskEvents() ?? Promise.resolve([]),
      this.deps.riskRepo?.listChallenges() ?? Promise.resolve([]),
      campaign.projectId ? this.deps.impactRepo?.getProjectDetail(campaign.projectId) : Promise.resolve(undefined),
    ]);
    const confirmedPayments = payments.filter(
      (intent) =>
        intent.purpose === "lottery_entry" &&
        intent.purposeId === campaign.roundId &&
        ["confirmed", "reconciled"].includes(intent.status),
    );
    const fundAllocations = allocations.filter(
      (allocation) =>
        allocation.sourceId === campaign.roundId ||
        allocation.projectId === campaign.projectId ||
        allocation.sourceId === campaign.id,
    );
    const relatedIds = new Set<string>([
      campaign.id,
      campaign.roundId ?? "",
      campaign.projectId ?? "",
      ...(projectDetail?.evidence.map((evidence) => evidence.id) ?? []),
      ...(projectDetail?.certificates.map((certificate) => certificate.id) ?? []),
    ].filter(Boolean));
    const impactCertificateStatuses = (projectDetail?.certificates ?? []).reduce<Record<string, number>>((acc, certificate) => {
      acc[certificate.status] = (acc[certificate.status] ?? 0) + 1;
      return acc;
    }, {});
    return {
      campaignId: campaign.id,
      status,
      participantCount: participants.length,
      ticketCount: await this.countTickets(campaign.roundId),
      confirmedPaymentIntentCount: confirmedPayments.length,
      totalConfirmedPaymentAmount: sumAmounts(confirmedPayments.map((intent) => intent.amount)),
      fundingGoalAmount: campaign.fundingGoalAmount,
      fundingGoalCurrency: campaign.fundingGoalCurrency as Currency,
      treeGoal: campaign.treeGoal,
      evidenceCount: projectDetail?.evidence.length ?? 0,
      challengeCount: challenges.filter((challenge) => relatedIds.has(challenge.targetId)).length,
      riskEventCount: riskEvents.filter((event) => relatedIds.has(event.subjectId) || event.subjectType.includes("campaign")).length,
      fundAllocations,
      projectMilestones: projectDetail?.milestones ?? [],
      impactCertificateStatuses,
      leaderboard: buildLeaderboard(accounts),
    };
  }

  private async countTickets(roundId?: string | undefined) {
    if (!roundId || !this.deps.lotteryRepo) return 0;
    const detail = await this.deps.lotteryRepo.getRoundDetail(roundId);
    return detail?.tickets.length ?? 0;
  }
}

function sumAmounts(amounts: string[]) {
  const total = amounts.reduce((sum, amount) => sum + Number(amount), 0);
  return Number.isFinite(total) ? total.toFixed(2).replace(/\.00$/, "") : "0";
}
