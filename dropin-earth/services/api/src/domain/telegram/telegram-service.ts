import {
  claimReferralSchema,
  shareTicketSchema,
  type ReferralCode,
  type ReferralEvent,
  type RiskEvent,
  type RiskScoreSnapshot,
  type TelegramAccount,
} from "@dropin/schemas";
import type { CertificateService } from "../impact/certificate-service.js";
import type { LotteryService } from "../lottery/lottery-service.js";
import type { RiskRepository } from "../risk/risk-repository.js";
import { computeAntiSybilScore } from "../risk/sybil-score.js";
import { validateTelegramSession } from "./telegram-auth.js";
import { ReferralCodeNotFoundError, TelegramAccountNotFoundError } from "./telegram-errors.js";
import { climateProofCopy, referralCodeFor } from "./telegram-referral.js";
import type { TelegramRepository } from "./telegram-repository.js";

export type TelegramGrowthSink = {
  awardShareTicket(input: { roundId: string; ticketId: string; userId: string }): Promise<unknown>;
  awardReferral(input: {
    roundId?: string | undefined;
    referrerUserId: string;
    eventId: string;
    suspicious: boolean;
  }): Promise<unknown>;
};

export class TelegramService {
  constructor(
    private readonly repo: TelegramRepository,
    private readonly lotteryService: LotteryService,
    private readonly certificateService: CertificateService,
    private readonly riskRepo: RiskRepository,
    private readonly authMode = process.env.TELEGRAM_AUTH_MODE ?? "mock",
    private readonly growthSink?: TelegramGrowthSink,
  ) {}

  async createSession(input: unknown) {
    const session = validateTelegramSession(input, {
      mode: this.authMode,
      botToken: process.env.TELEGRAM_BOT_TOKEN,
    });
    const linkedUserId = `telegram_${session.user.id}`;
    const account = await this.repo.upsertTelegramAccount({
      telegramUserId: session.user.id,
      username: session.user.username,
      firstName: session.user.firstName,
      lastName: session.user.lastName,
      languageCode: session.user.languageCode,
      linkedUserId,
      wallet: "wallet" in (input as Record<string, unknown>) ? String((input as Record<string, unknown>).wallet) : undefined,
    });
    return { account, authMode: this.authMode, initDataValid: session.initDataValid };
  }

  async getMe(input: { telegramUserId?: string | undefined; userId?: string | undefined }) {
    const account = input.telegramUserId
      ? await this.repo.getTelegramAccountByTelegramId(input.telegramUserId)
      : input.userId
        ? await this.repo.getTelegramAccountByLinkedUserId(input.userId)
        : undefined;
    if (!account) {
      throw new TelegramAccountNotFoundError(input.telegramUserId ?? input.userId ?? "missing_identity");
    }
    const [referrals, shareCards] = await Promise.all([
      this.repo.listReferralEventsForUser(account.linkedUserId),
      this.repo.listShareCardsForUser(account.linkedUserId),
    ]);
    return { account, referrals, shareCards };
  }

  async getRounds() {
    return this.lotteryService.listRounds();
  }

  async getForest(userId = "demo-user") {
    const [tickets, drops, rwaFragments, certificates] = await Promise.all([
      this.lotteryService.listTicketsForUser(userId),
      this.lotteryService.listDropsForUser(userId),
      this.lotteryService.listRwaFragmentsForUser(userId),
      this.certificateService.listCertificates(),
    ]);
    const referrals = await this.repo.listReferralEventsForUser(userId);
    return {
      tickets,
      drops,
      rwaFragments,
      impactCertificates: certificates,
      referrals,
      referralStats: {
        claimed: referrals.filter((event) => event.status === "claimed").length,
        suspicious: referrals.filter((event) => event.status === "suspicious").length,
        leafPoints: referrals.reduce((sum, event) => sum + event.leafPoints, 0),
      },
      disclaimer: "Impact Certificates are not certified carbon credits. RWA Fragments are not guaranteed yield.",
    };
  }

  async shareTicket(input: unknown) {
    const parsed = shareTicketSchema.parse(input);
    const referral = await this.ensureReferralCode({
      ownerUserId: parsed.ownerUserId,
      sourceType: "ticket",
      sourceId: parsed.ticketId,
    });
    const url = `${process.env.TELEGRAM_MINIAPP_URL ?? "https://t.me/dropin_earth_bot/dropin"}?startapp=${referral.code}`;
    const card = await this.repo.createShareCard({
      ticketId: parsed.ticketId,
      roundId: parsed.roundId,
      ownerUserId: parsed.ownerUserId,
      referralCode: referral.code,
      title: "Dropin Earth Climate Proof Card",
      copy: climateProofCopy({ roundId: parsed.roundId, referralCode: referral.code }),
      url,
      status: "created",
    });
    await this.growthSink?.awardShareTicket({
      roundId: parsed.roundId,
      ticketId: parsed.ticketId,
      userId: parsed.ownerUserId,
    });
    return { referral, shareCard: card };
  }

  async claimReferral(input: unknown) {
    const parsed = claimReferralSchema.parse(input);
    const referral = await this.repo.getReferralCode(parsed.code);
    if (!referral || referral.status !== "active") {
      throw new ReferralCodeNotFoundError(parsed.code);
    }
    const existing = await this.repo.getReferralEvent(parsed.code, {
      telegramUserId: parsed.telegramUserId,
      userId: parsed.referredUserId,
    });
    if (existing) {
      return { event: existing, idempotent: true };
    }
    const risk = await this.createReferralRiskSnapshot({
      referral,
      telegramUserId: parsed.telegramUserId,
      userId: parsed.referredUserId,
      wallet: parsed.wallet,
    });
    const selfReferral =
      parsed.referredUserId === referral.ownerUserId ||
      (parsed.telegramUserId !== undefined && `telegram_${parsed.telegramUserId}` === referral.ownerUserId);
    const suspicious = selfReferral || risk.score < 0.45;
    const event = await this.repo.createReferralEvent({
      code: referral.code,
      referrerUserId: referral.ownerUserId,
      referredTelegramUserId: parsed.telegramUserId,
      referredUserId: parsed.referredUserId,
      roundId: parsed.roundId,
      status: suspicious ? "suspicious" : "claimed",
      riskScoreSnapshot: risk,
      leafPoints: suspicious ? 0 : 20,
    });
    if (suspicious) {
      await this.createReferralRiskEvent(event, risk, selfReferral ? "self_referral" : "low_referral_score");
    } else {
      await this.growthSink?.awardReferral({
        roundId: parsed.roundId,
        referrerUserId: referral.ownerUserId,
        eventId: event.id,
        suspicious,
      });
    }
    return { event, idempotent: false };
  }

  private async ensureReferralCode(input: Pick<ReferralCode, "ownerUserId" | "sourceType" | "sourceId">) {
    const existing = await this.repo.getReferralCodeBySource(input.sourceType, input.sourceId, input.ownerUserId);
    if (existing) {
      return existing;
    }
    return this.repo.createReferralCode({
      ...input,
      code: referralCodeFor(input),
      status: "active",
    });
  }

  private async createReferralRiskSnapshot(input: {
    referral: ReferralCode;
    telegramUserId?: string | undefined;
    userId?: string | undefined;
    wallet?: string | undefined;
  }): Promise<RiskScoreSnapshot> {
    const risk = computeAntiSybilScore({
      wallet: input.wallet ?? `telegram_${input.telegramUserId ?? input.userId ?? "unknown"}`,
      userId: input.userId,
      entryCount: 0,
      totalContributionAmount: "0",
      walletAgeDays: input.wallet ? 30 : 0,
      priorClaimCount: 0,
      rejectedChallengeCount: input.userId === input.referral.ownerUserId ? 2 : 0,
      acceptedEvidenceCount: 0,
    });
    return this.riskRepo.createRiskScoreSnapshot({
      subjectType: "referral_event",
      subjectId: `${input.referral.code}:${input.telegramUserId ?? input.userId ?? "unknown"}`,
      wallet: input.wallet,
      userId: input.userId,
      input,
      ...risk,
    });
  }

  private async createReferralRiskEvent(event: ReferralEvent, risk: RiskScoreSnapshot, reason: string): Promise<RiskEvent> {
    return this.riskRepo.createRiskEvent({
      subjectType: "referral_event",
      subjectId: event.id,
      riskLevel: risk.riskLevel,
      score: risk.score,
      recommendedAction: "manual_review",
      reasonCodes: [reason, ...risk.reasons],
      status: "open",
    });
  }
}

export type TelegramSession = Awaited<ReturnType<TelegramService["createSession"]>>;
export type TelegramMe = {
  account: TelegramAccount;
};
